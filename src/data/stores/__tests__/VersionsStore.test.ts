import type { InfoApiInterface } from "@openshift-migration-advisor/planner-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_NAME, UI_NAME, VersionsStore } from "../VersionsStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockApi = (): InfoApiInterface =>
  ({
    getInfo: vi.fn(),
  }) as unknown as InfoApiInterface;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VersionsStore", () => {
  let api: InfoApiInterface;
  let store: VersionsStore;

  beforeEach(() => {
    api = createMockApi();
    store = new VersionsStore(api);
  });

  it("initial snapshot has ui.name = migration-assessment", () => {
    const snap = store.getSnapshot();
    expect(snap.ui.name).toBe(UI_NAME);
  });

  it("initial snapshot has api.name = migration-planner", () => {
    const snap = store.getSnapshot();
    expect(snap.api.name).toBe(API_NAME);
  });

  it("initial api.versionName = unknown", () => {
    const snap = store.getSnapshot();
    expect(snap.api.versionName).toBe("unknown");
  });

  it("getApiVersionInfo() merges API response", async () => {
    vi.mocked(api.getInfo).mockResolvedValue({
      versionName: "v1.2.3",
      gitCommit: "abc123",
    } as never);

    const result = await store.getApiVersionInfo();

    expect(api.getInfo).toHaveBeenCalledWith({ signal: undefined });
    expect(result.api.versionName).toBe("v1.2.3");
    expect(result.api.gitCommit).toBe("abc123");
    expect(store.getSnapshot().api.versionName).toBe("v1.2.3");
  });

  it("subscriber notification on fetch", async () => {
    const listener = vi.fn();
    store.subscribe(listener);

    vi.mocked(api.getInfo).mockResolvedValue({
      versionName: "v2.0",
      gitCommit: "def456",
    } as never);
    await store.getApiVersionInfo();

    expect(listener).toHaveBeenCalled();
  });
});
