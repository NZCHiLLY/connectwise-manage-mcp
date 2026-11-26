import type { CwManageClient } from "../api-client.js";
import { resolveCallerMemberId } from "../attribution.js";
import { applyPatch, type PatchOp } from "../tools/shared.js";

export interface TextResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface NoteAuthor {
  memberId?: number;
  name?: string;
}

export interface AuditNote {
  ticketId: number | undefined;
  what: string;
}

export interface FieldChange {
  label: string;
  before?: unknown;
  after: unknown;
  beforeKnown: boolean;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const VALUE_CAP = 120;
// Keeps a full-body replace from turning the note into a copy of the ticket.
const WHAT_CAP = 2000;

const nameCache = new Map<string, { name: string; expiresAt: number }>();

export function __resetAuditNoteCache(): void {
  nameCache.clear();
}

export const TICKET_FIELD_LABELS: Record<string, string> = {
  summary: "Summary",
  status: "Status",
  priority: "Priority",
  board: "Board",
  type: "Type",
  subType: "Subtype",
  item: "Item",
  owner: "Owner",
  team: "Team",
  contact: "Contact",
  company: "Company",
  site: "Site",
  serviceLocation: "Service location",
  location: "Location",
  department: "Department",
  requiredDate: "Required date",
  agreement: "Agreement",
  severity: "Severity",
  impact: "Impact",
  source: "Source",
  sla: "SLA",
  budgetHours: "Budget hours",
  billTime: "Bill time",
  billExpenses: "Bill expenses",
  billProducts: "Bill products",
  automaticEmailCcFlag: "Auto-CC",
  automaticEmailCc: "Auto-CC addresses",
  automaticEmailContactFlag: "Auto-email contact",
  automaticEmailResourceFlag: "Auto-email resources",
  closedFlag: "Closed",
  customFields: "Custom fields",
};

export const TASK_FIELD_LABELS: Record<string, string> = {
  notes: "Notes",
  closedFlag: "Done",
  priority: "Priority",
  resolution: "Resolution",
  schedule: "Schedule entry",
};

export const SCHEDULE_ENTRY_FIELD_LABELS: Record<string, string> = {
  doneFlag: "Done",
  status: "Status",
  member: "Member",
  dateStart: "Start",
  dateEnd: "End",
  hours: "Hours",
  span: "Span",
  reminder: "Reminder",
  where: "Where",
  allowScheduleConflictsFlag: "Allow schedule conflicts",
  acknowledgedFlag: "Acknowledged",
};

function truncate(text: string, cap = VALUE_CAP): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > cap ? `${flat.slice(0, cap)}...` : flat;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function withoutInfo(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutInfo);
  if (!isRecord(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) if (!k.startsWith("_")) out[k] = withoutInfo(val);
  return out;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Reference objects render as name, then identifier, then id; booleans as yes/no; empty as (none). */
export function renderValue(v: unknown): string {
  if (isEmpty(v)) return "(none)";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") return truncate(v);
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (isRecord(v)) {
    for (const key of ["name", "identifier", "id"]) {
      const label = v[key];
      if (!isEmpty(label) && (typeof label === "string" || typeof label === "number")) {
        return truncate(String(label));
      }
    }
    return truncate(JSON.stringify(withoutInfo(v)));
  }
  return truncate(JSON.stringify(withoutInfo(v)));
}

function canonical(v: unknown): string {
  if (isEmpty(v)) return "null";
  if (isRecord(v) && (typeof v.id === "number" || typeof v.id === "string")) return `ref:${v.id}`;
  return JSON.stringify(withoutInfo(v));
}

export function describeFieldChanges(changes: FieldChange[]): string {
  const parts: string[] = [];
  for (const c of changes) {
    if (c.beforeKnown) {
      if (canonical(c.before) === canonical(c.after)) continue;
      parts.push(`${c.label} ${renderValue(c.before)} -> ${renderValue(c.after)}.`);
    } else {
      parts.push(`${c.label} set to ${renderValue(c.after)}.`);
    }
  }
  if (parts.length === 0) {
    return changes.length === 0
      ? "No field values changed."
      : `No field values changed (${changes.map((c) => c.label).join(", ")}).`;
  }
  return truncate(parts.join(" "), WHAT_CAP);
}

/** "/status/id" and "/status/name" both name the status field. */
export function topLevelKeys(paths: string[]): string[] {
  const keys: string[] = [];
  for (const p of paths) {
    const key = p.split("/").find((k) => k !== "");
    if (key && !key.startsWith("_") && key !== "id" && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * Before values come from a read taken ahead of the write, after values from the
 * write's own response. When the response lacks a field, the requested value is
 * the best evidence of what was written.
 */
export function describeRecordChanges(
  keys: string[],
  before: unknown,
  after: unknown,
  requested: Record<string, unknown>,
  labels: Record<string, string>,
): string {
  const beforeRec = isRecord(before) ? before : undefined;
  const afterRec = isRecord(after) ? after : {};
  return describeFieldChanges(keys.map((key) => ({
    label: labels[key] ?? key,
    beforeKnown: beforeRec !== undefined,
    before: beforeRec?.[key],
    after: key in afterRec ? afterRec[key] : requested[key],
  })));
}

export function requestedFromPatch(ops: Array<{ op: string; path: string; value?: unknown }>): Record<string, unknown> {
  try {
    return applyPatch({}, ops as PatchOp[]);
  } catch {
    return {};
  }
}

/** A read that only enriches the audit note never blocks or fails the tool. */
export async function tryRead<T>(
  client: CwManageClient,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T | undefined> {
  try {
    return await client.get<T>(path, params);
  } catch (err) {
    console.error(`[audit-note] read failed path=${path} error=${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

export function idOf(v: unknown): number | undefined {
  if (!isRecord(v)) return undefined;
  return typeof v.id === "number" && Number.isInteger(v.id) && v.id > 0 ? v.id : undefined;
}

export function nameOf(ref: unknown): string | undefined {
  if (!isRecord(ref)) return undefined;
  for (const key of ["name", "identifier"]) {
    const v = ref[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

export function excerpt(text: unknown): string {
  return typeof text === "string" && text.trim() !== "" ? truncate(text) : "(no text)";
}

/** Names the type, author and date of a deleted note. Never the text: that is what was deleted. */
export function describeDeletedNote(noteId: number, note: unknown): string {
  if (!isRecord(note)) return `Deleted note #${noteId} (its details could not be read before deletion).`;
  const kind = note.internalAnalysisFlag === true
    ? "internal"
    : note.resolutionFlag === true
      ? "resolution"
      : "discussion";
  const createdBy = typeof note.createdBy === "string" && note.createdBy.trim() !== "" ? note.createdBy.trim() : undefined;
  const author = nameOf(note.member) ?? nameOf(note.contact) ?? createdBy ?? "an unknown author";
  const date = typeof note.dateCreated === "string" && note.dateCreated.length >= 10
    ? note.dateCreated.slice(0, 10)
    : "an unknown date";
  return `Deleted note #${noteId} (${kind} note by ${author}, dated ${date}).`;
}

export async function resolveNoteAuthor(client: CwManageClient): Promise<NoteAuthor> {
  const memberId = await resolveCallerMemberId(client);
  if (memberId === undefined) return {};

  const key = `${client.companyId}|${client.apiBase}|${memberId}`;
  const hit = nameCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { memberId, name: hit.name };

  const member = await tryRead<{ firstName?: unknown; lastName?: unknown }>(
    client,
    `/system/members/${memberId}`,
    { fields: "firstName,lastName" },
  );
  const name = [member?.firstName, member?.lastName]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .map((s) => s.trim())
    .join(" ");
  if (name === "") return { memberId };
  nameCache.set(key, { name, expiresAt: Date.now() + CACHE_TTL_MS });
  return { memberId, name };
}

export function buildAuditNoteText(author: NoteAuthor, what: string, why: string): string {
  const first = author.memberId === undefined
    ? "Changed by Claude via the ConnectWise MCP (shared service account)."
    : author.name
      ? `Changed by Claude for ${author.name} (ConnectWise MCP).`
      : `Changed by Claude for ConnectWise member #${author.memberId} (ConnectWise MCP).`;
  return `${first}\nWhat: ${what}\nWhy: ${why}`;
}

export function textResult(result: unknown): TextResult {
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

function warningText(ticketId: number | undefined, message: string): string {
  return `WARNING: the change succeeded but the internal audit note could not be written (${message}). ` +
    `Add an internal note to ticket ${ticketId ?? "(id unknown)"} by hand saying what was done and why.`;
}

/**
 * Runs after the ticket change has succeeded. A failure here never turns that
 * success into an error: the caller gets the normal result plus a WARNING item
 * per note that could not be written, so a human can add it by hand.
 */
export async function withAuditNotes(
  client: CwManageClient,
  tool: string,
  why: string,
  result: TextResult,
  build: () => AuditNote[] | Promise<AuditNote[]>,
): Promise<TextResult> {
  const warnings: string[] = [];
  const fail = (ticketId: number | undefined, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[audit-note] tool=${tool} ticket=${ticketId ?? "unknown"} error=${msg}`);
    warnings.push(warningText(ticketId, msg));
  };

  let notes: AuditNote[] = [];
  try {
    notes = await build();
  } catch (err) {
    fail(undefined, err);
  }

  let author: NoteAuthor | undefined;
  for (const note of notes) {
    try {
      if (note.ticketId === undefined || !Number.isInteger(note.ticketId) || note.ticketId <= 0) {
        throw new Error("the ConnectWise response did not include the ticket id");
      }
      author ??= await resolveNoteAuthor(client);
      const body: Record<string, unknown> = {
        text: buildAuditNoteText(author, note.what, why),
        internalAnalysisFlag: true,
        detailDescriptionFlag: false,
        resolutionFlag: false,
        processNotifications: false,
      };
      if (author.memberId !== undefined) body.member = { id: author.memberId };
      await client.post(`/service/tickets/${note.ticketId}/notes`, body);
    } catch (err) {
      fail(note.ticketId, err);
    }
  }

  if (warnings.length === 0) return result;
  return {
    ...result,
    content: [...result.content, ...warnings.map((text) => ({ type: "text" as const, text }))],
  };
}
