import type { Job } from "@openshift-migration-advisor/planner-sdk";
import { JobStatus } from "@openshift-migration-advisor/planner-sdk";
import { useInjection } from "@y0n1/react-ioc";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAsyncFn } from "react-use";

import { Symbols } from "../../../config/Dependencies";
import type { IAssessmentsStore } from "../../../data/stores/interfaces/IAssessmentsStore";
import type { IJobsStore } from "../../../data/stores/interfaces/IJobsStore";
import {
  JOB_POLLING_INTERVAL,
  TERMINAL_JOB_STATUSES,
} from "../../../data/stores/JobsStore";
import { routes } from "../../../routing/Routes";

// ---------------------------------------------------------------------------
// Private helpers — job progress mappers
// ---------------------------------------------------------------------------

const getProgressValue = (status: JobStatus): number => {
  switch (status) {
    case JobStatus.Pending:
      return 20;
    case JobStatus.Validating:
      return 50;
    case JobStatus.Parsing:
      return 80;
    case JobStatus.Completed:
      return 100;
    default:
      return 0;
  }
};

const getProgressLabel = (status: JobStatus): string => {
  switch (status) {
    case JobStatus.Pending:
      return "Uploading file..";
    case JobStatus.Parsing:
      return "Parsing data..";
    case JobStatus.Validating:
      return "Validating vms..";
    case JobStatus.Completed:
      return "Complete!";
    case JobStatus.Failed:
      return "Failed";
    case JobStatus.Cancelled:
      return "Cancelled";
    default:
      return "";
  }
};

const extractErrorMessage = (message: string): string => {
  const lastColonIndex = message.lastIndexOf(":");
  return lastColonIndex !== -1
    ? message.slice(lastColonIndex + 1).trim()
    : message;
};

// ---------------------------------------------------------------------------
// View-model interface
// ---------------------------------------------------------------------------

export interface AssessmentPageViewModel {
  /** Current RVTools job (null when idle). */
  currentJob: Job | null;
  /** `true` while the create-job request is in flight. */
  isCreatingJob: boolean;
  /** Error from the last create-job attempt. */
  jobCreateError?: Error;

  /** `true` while the current job is actively processing (non-terminal). */
  isJobProcessing: boolean;
  /** Progress percentage (0-100) derived from the current job status. */
  jobProgressValue: number;
  /** Human-readable progress label for the current job status. */
  jobProgressLabel: string;
  /** Error derived from a failed job (null when job hasn't failed). */
  jobError: Error | null;

  /** `true` while loading assessments and navigating after job completion. */
  isNavigatingToReport: boolean;

  /** `true` while a delete-assessment request is in flight. */
  isDeletingAssessment: boolean;
  /** Error from the last delete-assessment attempt. */
  deleteError?: Error;

  /** `true` while an update-assessment request is in flight. */
  isUpdatingAssessment: boolean;
  /** Error from the last update-assessment attempt. */
  updateError?: Error;

  // -- Actions ---------------------------------------------------------------

  /** Create a new RVTools assessment (starts an async job). */
  createRVToolsJob: (name: string, file: File) => Promise<void>;
  /**
   * Cancel the current job.
   * If the job had already completed, the created assessment is cleaned up.
   */
  cancelRVToolsJob: () => Promise<void>;
  /** Update an existing assessment's name. */
  updateAssessment: (id: string, name: string) => Promise<void>;
  /** Delete an assessment by id. */
  deleteAssessment: (id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAssessmentPageViewModel = (): AssessmentPageViewModel => {
  const navigate = useNavigate();

  const assessmentsStore = useInjection<IAssessmentsStore>(
    Symbols.AssessmentsStore,
  );
  const jobsStore = useInjection<IJobsStore>(Symbols.JobsStore);

  const jobState = useSyncExternalStore(
    jobsStore.subscribe.bind(jobsStore),
    jobsStore.getSnapshot.bind(jobsStore),
  );

  // ---- Detect job completion and navigate to report -----------------------

  const prevJobRef = useRef<Job | null>(null);
  const isNavigatingRef = useRef(false);

  const [navigationState, navigateToReport] = useAsyncFn(
    async (assessmentId: string) => {
      try {
        await assessmentsStore.list();
        navigate(routes.assessmentReport(assessmentId));
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [assessmentsStore, navigate],
  );

  useEffect(() => {
    const { currentJob } = jobState;
    const prevJob = prevJobRef.current;
    prevJobRef.current = currentJob;

    if (
      currentJob?.status === JobStatus.Completed &&
      currentJob.assessmentId &&
      prevJob?.status !== JobStatus.Completed &&
      !isNavigatingRef.current
    ) {
      const assessmentId = currentJob.assessmentId;
      isNavigatingRef.current = true;
      jobsStore.stopPolling();
      jobsStore.reset();

      void navigateToReport(assessmentId);
    }
  }, [jobState, jobsStore, navigateToReport]);

  // ---- Actions ------------------------------------------------------------

  const createRVToolsJob = useCallback(
    async (name: string, file: File): Promise<void> => {
      const job = await jobsStore.createRVToolsJob(name, file);
      if (job) {
        jobsStore.startPolling(JOB_POLLING_INTERVAL);
      }
    },
    [jobsStore],
  );

  const cancelRVToolsJob = useCallback(async (): Promise<void> => {
    jobsStore.stopPolling();
    const latestJob = await jobsStore.cancelRVToolsJob();

    // If the job had already completed before we could cancel, remove the
    // assessment that was created as a side-effect of the job.
    if (latestJob?.status === JobStatus.Completed && latestJob.assessmentId) {
      try {
        await assessmentsStore.remove(latestJob.assessmentId);
      } catch (err) {
        console.error("Failed to delete assessment after job cancel:", err);
      }
    }
  }, [jobsStore, assessmentsStore]);

  const [updateState, doUpdateAssessment] = useAsyncFn(
    async (id: string, name: string): Promise<void> => {
      await assessmentsStore.update(id, { name });
    },
    [assessmentsStore],
  );

  const [deleteState, doDeleteAssessment] = useAsyncFn(
    async (id: string): Promise<void> => {
      await assessmentsStore.remove(id);
    },
    [assessmentsStore],
  );

  // ---- Derived job state ---------------------------------------------------

  const { currentJob } = jobState;

  const isJobProcessing = Boolean(
    currentJob && !TERMINAL_JOB_STATUSES.includes(currentJob.status),
  );

  const jobProgressValue = currentJob ? getProgressValue(currentJob.status) : 0;

  const jobProgressLabel = currentJob
    ? getProgressLabel(currentJob.status)
    : "";

  const jobError = useMemo(() => {
    return currentJob?.status === JobStatus.Failed
      ? new Error(extractErrorMessage(currentJob.error || "Processing failed"))
      : null;
  }, [currentJob]);

  // ---- Return -------------------------------------------------------------

  return {
    currentJob,
    isCreatingJob: jobState.isCreating,
    jobCreateError: jobState.createError,
    isJobProcessing,
    jobProgressValue,
    jobProgressLabel,
    jobError,
    isNavigatingToReport: navigationState.loading,
    isDeletingAssessment: deleteState.loading,
    deleteError: deleteState.error,
    isUpdatingAssessment: updateState.loading,
    updateError: updateState.error,
    createRVToolsJob,
    cancelRVToolsJob,
    updateAssessment: doUpdateAssessment,
    deleteAssessment: doDeleteAssessment,
  };
};
