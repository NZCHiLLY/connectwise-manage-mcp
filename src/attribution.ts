import type { CwManageClient } from "./api-client.js";
import { getCallerIdentity } from "./context.js";

const CACHE_TTL_MS = 60 * 60 * 1000;

// Quotes, backslashes and whitespace would break out of the quoted value in a
// ConnectWise conditions string, so a UPN containing any of them is never sent.
const SAFE_UPN = /^[^"\\\s]+@[^"\\\s]+$/;

const cache = new Map<string, { memberId: number; expiresAt: number }>();

export function __resetAttributionCache(): void {
  cache.clear();
}

/**
 * Resolve the signed-in caller to exactly one active ConnectWise member by
 * office email. Never fuzzy-matches: zero or several matches is unresolved, and
 * unresolved must never fall back to the shared API member.
 */
export async function resolveCallerMemberId(client: CwManageClient): Promise<number | undefined> {
  const caller = getCallerIdentity();
  if (!caller || caller.oid === "static") return undefined;

  const upn = caller.upn;
  if (!SAFE_UPN.test(upn)) return undefined;

  const key = `${client.companyId}|${client.apiBase}|${upn.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.memberId;

  let members: Array<{ id?: unknown }>;
  try {
    members = await client.get<Array<{ id?: unknown }>>("/system/members", {
      conditions: `officeEmail = "${upn}" and inactiveFlag = false`,
      fields: "id",
      pageSize: 2,
    });
  } catch (err) {
    // A failed lookup is unresolved, never a reason to fail the caller's write.
    // The UPN is deliberately not logged.
    console.error(`[attribution] member lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
  if (!Array.isArray(members) || members.length !== 1) return undefined;

  const id = members[0]?.id;
  if (typeof id !== "number" || !Number.isInteger(id)) return undefined;

  cache.set(key, { memberId: id, expiresAt: Date.now() + CACHE_TTL_MS });
  return id;
}
