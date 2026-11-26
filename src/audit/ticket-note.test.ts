import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CwManageClient } from "../api-client.js";
import { resolveCallerMemberId } from "../attribution.js";
import {
  __resetAuditNoteCache,
  buildAuditNoteText,
  describeDeletedNote,
  describeFieldChanges,
  describeRecordChanges,
  renderValue,
  resolveNoteAuthor,
  topLevelKeys,
} from "./ticket-note.js";

vi.mock("../attribution.js", () => ({
  resolveCallerMemberId: vi.fn(),
}));

const resolve = resolveCallerMemberId as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  __resetAuditNoteCache();
});

describe("buildAuditNoteText", () => {
  it("names the resolved member", () => {
    expect(buildAuditNoteText({ memberId: 7, name: "Alex Example" }, "Created this ticket.", "user asked for a new ticket")).toBe(
      "Changed by Claude for Alex Example (ConnectWise MCP).\nWhat: Created this ticket.\nWhy: user asked for a new ticket",
    );
  });

  it("says shared service account when no member resolves", () => {
    expect(buildAuditNoteText({}, "Created this ticket.", "why").split("\n")[0]).toBe(
      "Changed by Claude via the ConnectWise MCP (shared service account).",
    );
  });

  it("names the member by id when the name could not be read", () => {
    expect(buildAuditNoteText({ memberId: 7 }, "x", "y").split("\n")[0]).toBe(
      "Changed by Claude for ConnectWise member #7 (ConnectWise MCP).",
    );
  });
});

describe("describeFieldChanges", () => {
  it("renders several changes by name, before and after", () => {
    expect(describeFieldChanges([
      { label: "Status", beforeKnown: true, before: { id: 1, name: "New (Portal)" }, after: { id: 5, name: "Completed" } },
      { label: "Owner", beforeKnown: true, before: { id: 7, identifier: "aexample" }, after: { id: 8, identifier: "sexample" } },
    ])).toBe("Status New (Portal) -> Completed. Owner aexample -> sexample.");
  });

  it("skips fields whose value did not change", () => {
    expect(describeFieldChanges([
      { label: "Summary", beforeKnown: true, before: "Printer down", after: "Printer down" },
      { label: "Priority", beforeKnown: true, before: { id: 2, name: "High", _info: {} }, after: { id: 2, name: "High" } },
      { label: "Status", beforeKnown: true, before: { id: 1, name: "New" }, after: { id: 5, name: "Completed" } },
    ])).toBe("Status New -> Completed.");
  });

  it("renders empty values as (none) and booleans as yes/no", () => {
    expect(describeFieldChanges([
      { label: "Team", beforeKnown: true, before: null, after: { id: 3, name: "Helpdesk" } },
      { label: "Auto-CC addresses", beforeKnown: true, before: "a@example.com", after: "" },
      { label: "Auto-CC", beforeKnown: true, before: true, after: false },
    ])).toBe("Team (none) -> Helpdesk. Auto-CC addresses a@example.com -> (none). Auto-CC yes -> no.");
  });

  it("falls back to the after value alone when the before value is unknown", () => {
    expect(describeFieldChanges([
      { label: "Status", beforeKnown: false, after: { id: 5, name: "Completed" } },
    ])).toBe("Status set to Completed.");
  });

  it("says so when nothing changed", () => {
    expect(describeFieldChanges([
      { label: "Summary", beforeKnown: true, before: "Same", after: "Same" },
    ])).toBe("No field values changed (Summary).");
  });
});

describe("describeRecordChanges", () => {
  it("uses the requested value when the response lacks the field", () => {
    expect(describeRecordChanges(["status"], { status: { id: 1, name: "New" } }, {}, { status: { id: 5 } }, { status: "Status" }))
      .toBe("Status New -> 5.");
  });
});

describe("renderValue", () => {
  it("prefers name, then identifier, then id", () => {
    expect(renderValue({ id: 7, identifier: "aexample", name: "Alex Example" })).toBe("Alex Example");
    expect(renderValue({ id: 7, identifier: "aexample" })).toBe("aexample");
    expect(renderValue({ id: 7 })).toBe("7");
  });

  it("caps long values", () => {
    expect(renderValue("x".repeat(300))).toBe(`${"x".repeat(120)}...`);
  });
});

describe("topLevelKeys", () => {
  it("names each field once and drops ids and private keys", () => {
    expect(topLevelKeys(["/status/id", "/status/name", "owner/id", "/id", "/_info", "/summary"]))
      .toStrictEqual(["status", "owner", "summary"]);
  });
});

describe("describeDeletedNote", () => {
  it("names type, author and date but never the text", () => {
    const what = describeDeletedNote(5001, {
      id: 5001,
      internalAnalysisFlag: true,
      member: { id: 7, name: "Alex Example" },
      dateCreated: "2026-11-20T01:00:00Z",
      text: "words that were deleted",
    });
    expect(what).toBe("Deleted note #5001 (internal note by Alex Example, dated 2026-11-20).");
    expect(what).not.toContain("words that were deleted");
  });

  it("calls a detail description note a discussion note and falls back to the contact", () => {
    expect(describeDeletedNote(5001, { detailDescriptionFlag: true, contact: { name: "Sam Example" }, dateCreated: "2026-11-21T00:00:00Z" }))
      .toBe("Deleted note #5001 (discussion note by Sam Example, dated 2026-11-21).");
  });

  it("labels a resolution note", () => {
    expect(describeDeletedNote(5001, { resolutionFlag: true, createdBy: "aexample" }))
      .toBe("Deleted note #5001 (resolution note by aexample, dated an unknown date).");
  });

  it("says so when the note could not be read first", () => {
    expect(describeDeletedNote(5001, undefined)).toBe("Deleted note #5001 (its details could not be read before deletion).");
  });
});

describe("resolveNoteAuthor", () => {
  const get = vi.fn();
  const client = { get, companyId: "example", apiBase: "https://cw.example.com" } as unknown as CwManageClient;

  it("returns nothing when no member resolves, without reading a member", async () => {
    resolve.mockResolvedValue(undefined);
    expect(await resolveNoteAuthor(client)).toStrictEqual({});
    expect(get).not.toHaveBeenCalled();
  });

  it("reads and caches the member's first and last name", async () => {
    resolve.mockResolvedValue(7);
    get.mockResolvedValue({ firstName: "Alex", lastName: "Example" });
    expect(await resolveNoteAuthor(client)).toStrictEqual({ memberId: 7, name: "Alex Example" });
    expect(await resolveNoteAuthor(client)).toStrictEqual({ memberId: 7, name: "Alex Example" });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/system/members/7", { fields: "firstName,lastName" });
  });

  it("keeps the member id when the name read fails", async () => {
    resolve.mockResolvedValue(7);
    get.mockRejectedValue(new Error("ConnectWise API error 403: Forbidden"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await resolveNoteAuthor(client)).toStrictEqual({ memberId: 7 });
    spy.mockRestore();
  });
});
