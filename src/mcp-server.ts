/**
 * Shared credential resolution for ConnectWise Manage.
 *
 * This module is **side-effect free** (importing it never starts a transport),
 * so it can be reused by every entrypoint:
 * - `index.ts`  — stdio + Node HTTP transport
 * - `worker.ts` — Cloudflare Workers (Web Standard) transport
 *
 * Credentials are resolved per request, in order:
 * 1. An explicit `CwManageConfig` override (gateway mode / Workers headers).
 * 2. `getConfig()` reading from `process.env` (env mode).
 *
 * Pulled in from upstream (WYRE Technology) for per-request credential isolation.
 * The full `createMcpServer` factory lives in `src/index.ts` (fork-extended with
 * tool profiles, SENTINEL middleware, and additional domain tools).
 */

import type { CwManageConfig } from "./api-client.js";

export type { CwManageConfig };

/**
 * Build a validated CwManageConfig from raw values.
 * Returns `{ config }` on success or `{ error }` when required fields are
 * missing. Shared by every transport (Node HTTP headers, Workers headers).
 */
export function buildConfig(
  companyId: string | undefined,
  publicKey: string | undefined,
  privateKey: string | undefined,
  clientId: string | undefined,
  baseUrl?: string,
): { config?: CwManageConfig; error?: string } {
  if (!companyId || !publicKey || !privateKey || !clientId) {
    return {
      error:
        "Missing credentials: X-CW-Company-Id, X-CW-Public-Key, X-CW-Private-Key, X-CW-Client-Id (or CW_MANAGE_* environment variables)",
    };
  }

  const resolvedBaseUrl = (
    baseUrl || "https://api-na.myconnectwise.net"
  ).replace(/\/+$/, "");

  return {
    config: {
      baseUrl: resolvedBaseUrl,
      companyId,
      publicKey,
      privateKey,
      clientId,
    },
  };
}

/**
 * Resolve per-request gateway credentials from a header accessor.
 *
 * Works with any transport: pass a getter that returns a (lowercased) header
 * value. Returns `{ config }` on success, or `{ error }` when required headers
 * are missing.
 */
export function resolveGatewayConfig(
  getHeader: (lowerName: string) => string | undefined,
): { config?: CwManageConfig; error?: string } {
  return buildConfig(
    getHeader("x-cw-company-id"),
    getHeader("x-cw-public-key"),
    getHeader("x-cw-private-key"),
    getHeader("x-cw-client-id"),
    getHeader("x-cw-url"),
  );
}
