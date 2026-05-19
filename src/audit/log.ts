import { promises as fs } from "node:fs";
import path from "node:path";
import { getCorrelationId } from "../context.js";

export interface AuditEntry {
  tool: string;
  entityType: string;
  entityId: number | string;
  userIntent: string;
  userQuote: string;
  operations?: unknown;
}

const AUDIT_PATH = process.env.CW_SENTINEL_AUDIT_PATH
  ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".cw-mcp-sentinel", "audit.jsonl");

let initialised = false;

async function ensureDir() {
  if (initialised) return;
  await fs.mkdir(path.dirname(AUDIT_PATH), { recursive: true });
  initialised = true;
}

async function append(record: Record<string, unknown>): Promise<void> {
  await ensureDir();
  const line = JSON.stringify({ ...record, correlationId: getCorrelationId(), timestamp: new Date().toISOString() }) + "\n";
  await fs.appendFile(AUDIT_PATH, line, { encoding: "utf-8" });
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await append({ type: "intent", ...entry });
  } catch (err) {
    // Never let an audit failure block a CW write. Surface to stderr so
    // it shows up in claude_desktop_config.json log capture, but don't throw.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cw-mcp-sentinel] audit write failed: ${msg}`);
  }
}

export async function auditOutcome(tool: string, outcome: "success" | "failure", error?: string): Promise<void> {
  try {
    await append({ type: "outcome", tool, outcome, ...(error !== undefined && { error }) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cw-mcp-sentinel] audit outcome write failed: ${msg}`);
  }
}
