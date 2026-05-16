import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mocked fs.promises handles shared across the module under test. */
const fsMock = {
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
};

/**
 * Dynamically import a fresh copy of log.ts so the module-level `initialised`
 * flag is reset for each test.  We use vi.doMock (non-hoisted) here because
 * vi.resetModules() has already run when this function executes.
 */
async function importFresh() {
  vi.resetModules();
  fsMock.mkdir.mockResolvedValue(undefined);
  fsMock.appendFile.mockResolvedValue(undefined);

  vi.doMock("node:fs", () => ({ promises: fsMock }));

  const mod = await import("./log.js");
  return { auditLog: mod.auditLog };
}

const baseEntry = {
  tool: "update_ticket",
  entityType: "ticket" as const,
  entityId: 42,
  userIntent: "Close the ticket",
  userQuote: "Please close ticket 42",
  operations: [{ op: "replace", path: "/status/name", value: "Closed" }],
  timestamp: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: writes a JSONL line via appendFile", async () => {
    const { auditLog } = await importFresh();

    await auditLog(baseEntry);

    expect(fsMock.appendFile).toHaveBeenCalledOnce();
    const callArgs = fsMock.appendFile.mock.calls[0] as [unknown, string, ...unknown[]];
    const data = callArgs[1] as string;
    const parsed = JSON.parse(data.trimEnd());
    expect(parsed).toMatchObject({
      tool: "update_ticket",
      entityType: "ticket",
      entityId: 42,
    });
    // Line must end with newline
    expect(data).toMatch(/\n$/);
  });

  it("mkdir is called on first invocation but NOT on second (initialised flag)", async () => {
    const { auditLog } = await importFresh();

    await auditLog(baseEntry);
    await auditLog({ ...baseEntry, entityId: 43 });

    expect(fsMock.mkdir).toHaveBeenCalledOnce();
    expect(fsMock.appendFile).toHaveBeenCalledTimes(2);
  });

  it("catch block: appendFile throws → logs to stderr and does NOT rethrow", async () => {
    const { auditLog } = await importFresh();

    fsMock.appendFile.mockRejectedValueOnce(new Error("ENOSPC: no space left"));

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Must not throw
    await expect(auditLog(baseEntry)).resolves.toBeUndefined();

    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0][0]).toContain("[cw-mcp-sentinel] audit write failed:");
    expect(stderrSpy.mock.calls[0][0]).toContain("ENOSPC");

    stderrSpy.mockRestore();
  });

  it("catch block: mkdir throws → logs to stderr and does NOT rethrow", async () => {
    const { auditLog } = await importFresh();

    fsMock.mkdir.mockRejectedValueOnce(new Error("EPERM: operation not permitted"));

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(auditLog(baseEntry)).resolves.toBeUndefined();

    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0][0]).toContain("EPERM");

    stderrSpy.mockRestore();
  });
});
