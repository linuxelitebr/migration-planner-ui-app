import type { JobApi } from "@openshift-migration-advisor/planner-sdk";
import type { Job } from "@openshift-migration-advisor/planner-sdk";
import {
  JobStatus,
  ResponseError,
} from "@openshift-migration-advisor/planner-sdk";

import { PollableStoreBase } from "../../lib/mvvm/PollableStore";
import type { IJobsStore } from "./interfaces/IJobsStore";

/** Polling interval in milliseconds for active job status checks. */
export const JOB_POLLING_INTERVAL = 1000;

/** Job statuses that indicate the job has reached a final state. */
export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  JobStatus.Completed,
  JobStatus.Failed,
  JobStatus.Cancelled,
];

export type JobsStoreState = {
  currentJob: Job | null;
  isCreating: boolean;
  createError?: Error;
};

export class JobsStore
  extends PollableStoreBase<JobsStoreState>
  implements IJobsStore
{
  private state: JobsStoreState = {
    currentJob: null,
    isCreating: false,
    createError: undefined,
  };
  private abortController: AbortController | null = null;
  private cancelInProgress = false;
  private api: JobApi;

  constructor(api: JobApi) {
    super();
    this.api = api;
  }

  override getSnapshot(): JobsStoreState {
    return this.state;
  }

  /**
   * Create a new RVTools assessment job.
   * The caller (view model) is responsible for starting polling after this.
   */
  async createRVToolsJob(name: string, file: File): Promise<Job | undefined> {
    this.cancelInProgress = false;

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.setState({ isCreating: true, createError: undefined });

    try {
      const job = await this.api.createRVToolsAssessment(
        { name, file },
        { signal: this.abortController.signal },
      );

      if (this.abortController.signal.aborted) {
        if (job?.id && !TERMINAL_JOB_STATUSES.includes(job.status)) {
          this.api.cancelJob({ id: job.id }).catch(() => undefined);
        }
        return undefined;
      }

      this.setState({ currentJob: job, isCreating: false });
      return job;
    } catch (err) {
      if (this.abortController.signal.aborted) {
        return undefined;
      }

      let errorToStore: Error;
      if (err instanceof ResponseError) {
        try {
          const responseText = await err.response.text();
          let message = responseText;

          // Try to parse as JSON and extract the message field
          try {
            const parsed: unknown = JSON.parse(responseText);
            if (
              parsed !== null &&
              typeof parsed === "object" &&
              "message" in parsed &&
              typeof (parsed as Record<string, unknown>).message === "string"
            ) {
              message = (parsed as Record<string, unknown>).message as string;
            }
          } catch {
            // Not JSON, use the raw text
          }

          errorToStore = new Error(message || err.message);
        } catch {
          errorToStore = new Error(err.message);
        }
      } else {
        errorToStore =
          err instanceof Error
            ? err
            : new Error("Failed to create RVTools job");
      }

      this.setState({ createError: errorToStore, isCreating: false });
      return undefined;
    }
  }

  /**
   * Cancel the current job.
   *
   * - If the job is still running, cancels it on the server.
   * - Returns the **latest** job state so the caller (view model) can decide
   *   whether to perform cross-store cleanup (e.g. delete a completed assessment).
   */
  async cancelRVToolsJob(): Promise<Job | null> {
    if (this.cancelInProgress) {
      return null;
    }
    this.cancelInProgress = true;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    let latestJob: Job | null = null;
    const currentJob = this.state.currentJob;

    if (currentJob) {
      try {
        latestJob = await this.api.getJob({ id: currentJob.id });
      } catch {
        latestJob = currentJob;
      }

      if (!TERMINAL_JOB_STATUSES.includes(latestJob.status)) {
        try {
          await this.api.cancelJob({ id: latestJob.id });
        } catch (err) {
          console.error("Failed to cancel job:", err);
        }
      }
    }

    this.reset();
    this.cancelInProgress = false;
    return latestJob;
  }

  /**
   * Clear all job state.
   * The caller (view model) is responsible for stopping polling beforehand.
   */
  reset(): void {
    this.setState({
      currentJob: null,
      isCreating: false,
      createError: undefined,
    });
  }

  protected override async poll(_signal: AbortSignal): Promise<void> {
    if (this.cancelInProgress) {
      return;
    }

    const currentJob = this.state.currentJob;
    if (!currentJob || TERMINAL_JOB_STATUSES.includes(currentJob.status)) {
      return;
    }

    try {
      const updated = await this.api.getJob({ id: currentJob.id });
      if (this.cancelInProgress) {
        return;
      }
      this.setState({ currentJob: updated });

      // State is kept with the terminal job — the view model reacts to
      // this change (e.g. stopping polling, navigating to the report).
    } catch (err) {
      console.error("Failed to poll job status:", err);
    }
  }

  private setState(partial: Partial<JobsStoreState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }
}
