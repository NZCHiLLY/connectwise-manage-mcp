import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/** Paging state of the most recent ConnectWise response, from its Link header. */
export interface Paging {
  hasMore: boolean;
  nextPage?: number;
}

export interface RequestContext {
  correlationId: string;
  paging?: Paging;
  /** Who is calling, set once the bearer token has been validated. */
  identity?: { upn: string; oid: string };
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getCorrelationId(): string {
  return requestContext.getStore()?.correlationId ?? "-";
}

export function getCallerIdentity(): { upn: string; oid: string } | undefined {
  return requestContext.getStore()?.identity;
}

export function newCorrelationId(): string {
  return randomUUID();
}
