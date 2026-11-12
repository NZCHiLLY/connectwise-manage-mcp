import { z } from "zod";

export const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]).describe(
    "JSON Patch operation. Use 'replace' to set a field value.",
  ),
  path: z.string().describe(
    "Field path with leading slash — e.g. '/summary', '/status/id'.",
  ),
  value: z.unknown().optional().describe("New value for the field"),
});

export type PatchOp = z.infer<typeof patchOp>;

/**
 * Applies JSON Patch replace/add/remove ops on slash paths to a deep copy of
 * doc. Intermediate objects are created for add and replace; the input is
 * never mutated.
 */
export function applyPatch(doc: Record<string, unknown>, ops: PatchOp[]): Record<string, unknown> {
  const out = structuredClone(doc);
  for (const { op, path, value } of ops) {
    const keys = path.split("/").filter((k) => k !== "");
    if (keys.length === 0) throw new Error(`applyPatch: empty path "${path}"`);
    if (keys.some((k) => k === "__proto__" || k === "constructor" || k === "prototype")) {
      throw new Error(`Patch path ${path} is not allowed`);
    }
    if (op !== "remove" && value === undefined) {
      throw new Error(`Patch op ${op} on ${path} needs a value`);
    }
    const last = keys[keys.length - 1];
    let node = out;
    for (const key of keys.slice(0, -1)) {
      const next = node[key];
      if (next === undefined || next === null) {
        if (op === "remove") {
          node = undefined as unknown as Record<string, unknown>;
          break;
        }
        node[key] = {};
      } else if (typeof next !== "object") {
        throw new Error(`Patch path ${path} walks into a non-object`);
      }
      node = node[key] as Record<string, unknown>;
    }
    if (node === undefined) continue;
    if (op === "remove") delete node[last];
    else node[last] = value;
  }
  return out;
}

export const sentinelParams = {
  user_intent: z.string().min(20).describe(
    "Plain-English description of what the user asked for. " +
      "Must be at least 20 characters. Example: " +
      "'User asked to close ticket 12345 because they have billed it.'",
  ),
  user_quote: z.string().min(1).describe(
    "Verbatim quote of the user's actual words that motivated this action. " +
      "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
  ),
};

/**
 * Callers mix up the id parameter name between sibling tools (id vs ticketId,
 * id vs agreementId). The schema accepts both and this picks whichever was sent.
 * It must run in the handler: the SDK strips unknown keys before it is called.
 */
export function normaliseIdArgs(
  args: Record<string, unknown>,
  canonical: string,
  alias: string,
  toolName: string,
): number {
  const a = args[canonical] as number | undefined;
  const b = args[alias] as number | undefined;
  if (a !== undefined && b !== undefined && a !== b) {
    throw new Error(`${toolName}: ${canonical} and ${alias} disagree`);
  }
  const value = a ?? b;
  if (value === undefined) {
    throw new Error(`${toolName}: ${canonical} is required (${alias} is accepted as an alias)`);
  }
  return value;
}
