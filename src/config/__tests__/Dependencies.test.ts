import { Container } from "@y0n1/react-ioc";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createContainer, Symbols } from "../Dependencies";

// ---------------------------------------------------------------------------
// Mocks — API clients (stateless, so we just need constructable stubs)
// ---------------------------------------------------------------------------

vi.mock("@openshift-migration-advisor/planner-sdk", () => ({
  AssessmentApi: vi.fn(),
  ImageApi: vi.fn(),
  InfoApi: vi.fn(),
  JobApi: vi.fn(),
  SourceApi: vi.fn(),
  Configuration: vi.fn(),
}));

vi.mock("../../data/stores/AssessmentsStore", () => ({
  AssessmentsStore: class {
    _type = "AssessmentsStore";
  },
}));
vi.mock("../../data/stores/ImagesStore", () => ({
  ImagesStore: class {
    _type = "ImagesStore";
  },
}));
vi.mock("../../data/stores/JobsStore", () => ({
  JobsStore: class {
    _type = "JobsStore";
  },
}));
vi.mock("../../data/stores/ReportStore", () => ({
  ReportStore: class {
    _type = "ReportStore";
  },
}));
vi.mock("../../data/stores/SourcesStore", () => ({
  SourcesStore: class {
    _type = "SourcesStore";
  },
}));
vi.mock("../../data/stores/VersionsStore", () => ({
  VersionsStore: class {
    _type = "VersionsStore";
  },
}));
vi.mock("../../services/html-export/HtmlExportService", () => ({
  HtmlExportService: class {},
}));
vi.mock("../../services/pdf-export/PdfExportService", () => ({
  PdfExportService: class {},
}));
vi.mock("../../lib/middleware/Auth", () => ({
  createAuthMiddleware: vi.fn().mockReturnValue({ pre: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Chrome stub
// ---------------------------------------------------------------------------

const makeChromeStub = () =>
  ({
    auth: { getToken: vi.fn().mockResolvedValue("tok") },
  }) as unknown as Parameters<typeof createContainer>[0];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Symbols", () => {
  it("contains a frozen object with all expected symbol keys", () => {
    expect(Object.isFrozen(Symbols)).toBe(true);

    const expected = [
      "AssessmentsStore",
      "ImagesStore",
      "SourcesStore",
      "VersionsStore",
      "JobsStore",
      "ReportStore",
    ];

    for (const key of expected) {
      expect(Symbols).toHaveProperty(key);
      expect(typeof (Symbols as Record<string, symbol>)[key]).toBe("symbol");
    }
  });

  it("all symbols have matching description", () => {
    for (const [key, sym] of Object.entries(Symbols)) {
      expect(sym.description).toBe(key);
    }
  });
});

describe("createContainer", () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer(makeChromeStub());
  });

  it("returns a Container instance", () => {
    expect(container).toBeInstanceOf(Container);
  });

  it("registers AssessmentsStore", () => {
    const store = container.get(Symbols.AssessmentsStore);
    expect(store).toBeDefined();
    expect((store as Record<string, string>)._type).toBe("AssessmentsStore");
  });

  it("registers ImagesStore", () => {
    const store = container.get(Symbols.ImagesStore);
    expect(store).toBeDefined();
    expect((store as Record<string, string>)._type).toBe("ImagesStore");
  });

  it("registers SourcesStore", () => {
    const store = container.get(Symbols.SourcesStore);
    expect(store).toBeDefined();
    expect((store as Record<string, string>)._type).toBe("SourcesStore");
  });

  it("registers VersionsStore", () => {
    const store = container.get(Symbols.VersionsStore);
    expect(store).toBeDefined();
    expect((store as Record<string, string>)._type).toBe("VersionsStore");
  });

  it("registers JobsStore", () => {
    const store = container.get(Symbols.JobsStore);
    expect(store).toBeDefined();
    expect((store as Record<string, string>)._type).toBe("JobsStore");
  });

  it("registers ReportStore", () => {
    const store = container.get(Symbols.ReportStore);
    expect(store).toBeDefined();
    expect((store as Record<string, string>)._type).toBe("ReportStore");
  });
});
