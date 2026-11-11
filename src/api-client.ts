/**
 * ConnectWise Manage API Client
 *
 * Fetch-based HTTP client that handles authentication, pagination,
 * and self-signed certificate support for both cloud and self-hosted instances.
 *
 * Environment variables:
 *   CW_MANAGE_URL              - API base URL (e.g. https://api-na.myconnectwise.net)
 *   CW_MANAGE_COMPANY_ID       - Company identifier
 *   CW_MANAGE_PUBLIC_KEY        - API member public key
 *   CW_MANAGE_PRIVATE_KEY       - API member private key
 *   CW_MANAGE_CLIENT_ID         - Client ID from ConnectWise Developer Portal
 *   CW_MANAGE_REJECT_UNAUTHORIZED - Set to "false" to allow self-signed certs (default: "true")
 *   CW_REQUEST_TIMEOUT_MS      - Env-mode request timeout in ms (default: none)
 */

export interface CwManageConfig {
  baseUrl: string;
  companyId: string;
  publicKey: string;
  privateKey: string;
  clientId: string;
  /** Set when baseUrl came from the X-CW-Url header; checked before every request. */
  untrustedBaseUrl?: boolean;
}

export function getConfig(): CwManageConfig | null {
  const companyId = process.env.CW_MANAGE_COMPANY_ID;
  const publicKey = process.env.CW_MANAGE_PUBLIC_KEY;
  const privateKey = process.env.CW_MANAGE_PRIVATE_KEY;
  const clientId = process.env.CW_MANAGE_CLIENT_ID;

  if (!companyId || !publicKey || !privateKey || !clientId) {
    return null;
  }

  // Default to North America cloud. Override for EU, AU, or self-hosted.
  const baseUrl = (
    process.env.CW_MANAGE_URL || "https://api-na.myconnectwise.net"
  ).replace(/\/+$/, "");

  return { baseUrl, companyId, publicKey, privateKey, clientId };
}

/** Timeout for a gateway (X-CW-Url) request. */
const GATEWAY_TIMEOUT_MS = 30_000;

const MAX_TIMER_MS = 2_147_483_647;

/**
 * Env-mode timeout: none unless CW_REQUEST_TIMEOUT_MS is a positive integer.
 * Production runs env mode and has real ConnectWise calls of 32 s to 50 s
 * (Log Analytics, 30 days to 12 Nov 2026). An abort fails the call here while
 * a write may still commit in ConnectWise, so no default is imposed.
 */
function envModeTimeoutMs(): number | undefined {
  const raw = process.env.CW_REQUEST_TIMEOUT_MS;
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const ms = Number(raw);
  // Past the signed 32-bit timer limit a Node timer misbehaves, and past 2^32 - 1
  // AbortSignal.timeout throws, which would fail every call. Ignore such values.
  return ms > 0 && ms <= MAX_TIMER_MS ? ms : undefined;
}

/**
 * Low-level API client for ConnectWise Manage REST API.
 */
import { getCorrelationId } from "./context.js";
import { assertSafeGatewayUrl } from "./url-guard.js";

export class CwManageClient {
  private readonly authHeader: string;
  private readonly clientId: string;
  private readonly apiBase: string;
  private readonly rejectUnauthorized: boolean;
  private tlsAgent?: unknown;
  private readonly untrustedBaseUrl: string | undefined;

  /**
   * Company identifier this client authenticates as. This is also CW's
   * "My Company" identifier, which is how cw_get_my_company finds the
   * tenant's own /company/companies record.
   */
  readonly companyId: string;

  constructor(config: CwManageConfig) {
    // Auth: Basic base64("{companyId}+{publicKey}:{privateKey}")
    const credentials = `${config.companyId}+${config.publicKey}:${config.privateKey}`;
    this.authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;
    this.clientId = config.clientId;
    this.companyId = config.companyId;
    this.untrustedBaseUrl = config.untrustedBaseUrl ? config.baseUrl : undefined;
    // Append the standard API path if the URL doesn't already contain it
    this.apiBase = config.baseUrl.includes("/v4_6_release/")
      ? config.baseUrl.replace(/\/+$/, "")
      : `${config.baseUrl}/v4_6_release/apis/3.0`;
    this.rejectUnauthorized =
      process.env.CW_MANAGE_REJECT_UNAUTHORIZED !== "false";
    // tlsAgent is lazy-initialised on first request (see request() below)
  }

  private defaultHeaders(): Record<string, string> {
    return {
      Authorization: this.authHeader,
      clientId: this.clientId,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Make a request to the ConnectWise Manage API.
   */
  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | undefined>;
    },
  ): Promise<T> {
    // Re-checked per request so a hostname re-pointed after the last call is caught.
    // Known gap (documented, not closed): DNS can change between this lookup and
    // the connection. Closing it needs a lookup that pins the resolved address on
    // the socket, which global fetch does not offer without a custom dispatcher.
    // With redirects refused for gateway URLs, the window is small.
    if (this.untrustedBaseUrl !== undefined) {
      await assertSafeGatewayUrl(this.untrustedBaseUrl);
    }
    const url = new URL(`${this.apiBase}${path}`);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // Redirect blocking is gateway-only: env-mode CW_MANAGE_URL may legitimately
    // 301/302 to a canonical HTTPS origin on a self-hosted server. Cloudflare
    // Workers reject redirect: "error", so gateway mode uses "manual" and a throw.
    const blockRedirects = this.untrustedBaseUrl !== undefined;
    // Omit<RequestInit, 'dispatcher'> avoids a type conflict between the
    // undici-types shipped with @types/node and undici's own Agent type.
    const fetchOptions: Omit<RequestInit, "dispatcher"> & { dispatcher?: unknown } = {
      method,
      headers: this.defaultHeaders(),
      redirect: blockRedirects ? "manual" : "follow",
    };
    const timeoutMs = blockRedirects ? GATEWAY_TIMEOUT_MS : envModeTimeoutMs();
    if (timeoutMs !== undefined) {
      fetchOptions.signal = AbortSignal.timeout(timeoutMs);
    }

    if (options?.body !== undefined) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // Scoped TLS agent for self-hosted instances with self-signed certs.
    // Lazy-initialised to keep the constructor synchronous. Avoids mutating
    // the global NODE_TLS_REJECT_UNAUTHORIZED env var which would otherwise
    // disable TLS verification for all concurrent requests (JWKS fetch, OAuth proxy).
    if (!this.rejectUnauthorized) {
      if (!this.tlsAgent) {
        const { Agent } = await import("undici");
        this.tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });
      }
      fetchOptions.dispatcher = this.tlsAgent;
    }

    const cid = getCorrelationId();
    const start = Date.now();
    const response = await fetch(url.toString(), fetchOptions as RequestInit);
    const elapsed = Date.now() - start;

    // Before the !ok branch: under redirect "manual" a 3xx is not ok, and would
    // otherwise surface as a generic API error rather than a refused redirect.
    if (blockRedirects && response.status >= 300 && response.status < 400) {
      throw new Error(
        `ConnectWise API ${method} ${path} returned a redirect (HTTP ${response.status}); refusing to follow it.`,
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[cw-api] cid:${cid} | ${method} ${path} → ${response.status} (${elapsed}ms) | ${errorBody}`);
      throw new Error(`ConnectWise API error ${response.status}: ${errorBody}`);
    }

    console.error(`[cw-api] cid:${cid} | ${method} ${path} → ${response.status} (${elapsed}ms)`);

    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  /** GET helper */
  async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  /** POST helper */
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  /** PATCH helper — normalises JSON Patch op paths to ensure leading '/' */
  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const normalised = Array.isArray(body)
      ? body.map((op: Record<string, unknown>) => ({
          ...op,
          path: typeof op.path === "string" && !op.path.startsWith("/")
            ? `/${op.path}`
            : op.path,
        }))
      : body;
    return this.request<T>("PATCH", path, { body: normalised });
  }

  /** PUT helper */
  async put<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }
}
