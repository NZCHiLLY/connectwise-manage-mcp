import type { Paging } from "../context.js";

export interface ShapeOptions {
  fields?: string[];
  /** Undefined leaves text and notes fields untouched: no boilerplate strip, no cap. */
  maxTextChars?: number;
  budget: number;
  paging?: Paging;
}

/** Description given to every tool's `conditions` field by applyToolProfile. */
export const CONDITIONS_HELP =
  "ConnectWise conditions. Operators: = != < <= > >= contains like in (...). Strings in double quotes: company/name = \"Acme\". Dates in square brackets: _info/dateEntered > [2026-11-01T00:00:00Z]. Combine with and, or and brackets. Nested fields use /: status/name = \"Open\". Ticket notes date on _info/dateEntered. On opportunities, filter open ones with closedDate = null.";

/** Description given to every tool's `orderBy` field by applyToolProfile. */
export const ORDERBY_HELP = "Field then asc or desc, for example id desc or _info/dateEntered desc.";

const TEXT_KEYS = new Set(["text", "notes"]);

/** Starts the marker appended to capped text. A write carrying it was built from a shaped read. */
export const DISPLAY_CUT = "[display cut:";

const DISCLAIMER_RE =
  /This message and its attachments contain confidential information(?:(?!This message and its attachments)[\s\S]){0,1500}?transmitted by this email\.?/g;
const EXTERNAL_BANNER_RE =
  /THIS EMAIL IS FROM AN EXTERNAL SENDER\.\s*PLEASE BE CAUTIOUS OF ATTACHMENTS AND LINKS\.?/g;
const INLINE_IMAGE_RE = /!\[(?:\\.|[^\]\\])*\]\([^)]*inlineimages[^)]*\)/g;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/**
 * Recursively drops `_info`, null, undefined, "", empty arrays and empty objects.
 * 0, false and "0" are real values and are kept. Returns undefined when nothing is left.
 */
export function compactValue(v: unknown): unknown {
  return compactInner(v, undefined);
}

// _info keeps its scalar dates and authors (dateEntered, enteredBy, lastUpdated, updatedBy):
// the model filters notes on _info/dateEntered and needs ticket age. Links and nested objects go.
function compactInfo(v: unknown): unknown {
  if (!isPlainObject(v)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (k.endsWith("_href") || isEmptyValue(val) || typeof val === "object") continue;
    out[k] = val;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function compactInner(v: unknown, key: string | undefined): unknown {
  if (isEmptyValue(v)) return undefined;
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (const el of v) {
      // A custom field entry with no value says nothing, so the whole entry goes.
      if (key === "customFields" && isPlainObject(el) && "value" in el && isEmptyValue(el.value)) {
        continue;
      }
      const c = compactInner(el, undefined);
      if (c !== undefined) out.push(c);
    }
    return out.length > 0 ? out : undefined;
  }
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      const c = k === "_info" ? compactInfo(val) : compactInner(val, k);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return v;
}

/** Removes the Tomizone email disclaimer, the external sender banner and inline signature images. */
export function stripBoilerplate(text: string): string {
  return text
    .replace(DISCLAIMER_RE, "")
    .replace(EXTERNAL_BANNER_RE, "")
    .replace(INLINE_IMAGE_RE, "")
    .trim();
}

function capText(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}${DISPLAY_CUT} ${s.length - max} more characters stored]`;
}

function cleanText(v: unknown, max: number): unknown {
  if (Array.isArray(v)) return v.map((el) => cleanText(el, max));
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] =
        TEXT_KEYS.has(k) && typeof val === "string"
          ? capText(stripBoilerplate(val), max)
          : cleanText(val, max);
    }
    return out;
  }
  return v;
}

function pickPath(src: unknown, parts: string[], dst: Record<string, unknown>): void {
  if (!isPlainObject(src)) return;
  const [head, ...rest] = parts;
  if (head === undefined || !(head in src)) return;
  const val = src[head];
  if (rest.length === 0) {
    dst[head] = val;
    return;
  }
  if (Array.isArray(val)) {
    const existing = Array.isArray(dst[head]) ? (dst[head] as Record<string, unknown>[]) : [];
    dst[head] = val.map((el, i) => {
      const target = existing[i] ?? {};
      pickPath(el, rest, target);
      return target;
    });
    return;
  }
  if (!isPlainObject(val)) return;
  const child = isPlainObject(dst[head]) ? (dst[head] as Record<string, unknown>) : {};
  pickPath(val, rest, child);
  dst[head] = child;
}

/** Keeps only the named paths (`/` nests, e.g. `company/name`). Applied per element on arrays. */
export function projectFields(v: unknown, fields: string[]): unknown {
  if (fields.length === 0) return v;
  if (Array.isArray(v)) return v.map((el) => projectFields(el, fields));
  if (!isPlainObject(v)) return v;
  const out: Record<string, unknown> = {};
  for (const f of fields) pickPath(v, f.split("/"), out);
  return out;
}

function wrapArray(items: unknown[], opts: ShapeOptions, pageTotal?: number): string {
  const truncated = pageTotal !== undefined && pageTotal > items.length;
  const wrapper: Record<string, unknown> = {
    items,
    returned: items.length,
    // Dropped rows are not on nextPage, so a truncated page always has more to see.
    hasMore: truncated ? true : (opts.paging?.hasMore ?? false),
  };
  if (opts.paging?.nextPage !== undefined) wrapper.nextPage = opts.paging.nextPage;
  wrapper.truncated = truncated;
  if (truncated) {
    wrapper.omitted = pageTotal - items.length;
    wrapper.pageTotal = pageTotal;
    wrapper.hint = `${pageTotal - items.length} of ${pageTotal} rows on this page were omitted to fit the size limit and are NOT on nextPage. Re-request this same page with pageSize=${items.length} or fewer fields (for example fields=id,summary) to see them.`;
  }
  return JSON.stringify(wrapper);
}

/**
 * Shapes a tool result: parse, compact, strip boilerplate and cap text fields, project,
 * wrap arrays, then drop trailing items until the output fits `budget`.
 * A single object that is still over budget after text trimming is returned as is;
 * `truncated` does not apply to it. Text that is not a JSON object or array is untouched.
 */
export function shapeToolText(text: string, opts: ShapeOptions): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  if (!Array.isArray(parsed) && !isPlainObject(parsed)) return text;

  let shaped: unknown = compactValue(parsed) ?? (Array.isArray(parsed) ? [] : {});
  if (opts.maxTextChars !== undefined) {
    shaped = cleanText(shaped, opts.maxTextChars);
    shaped = compactValue(shaped) ?? (Array.isArray(parsed) ? [] : {});
  }
  if (opts.fields && opts.fields.length > 0) shaped = projectFields(shaped, opts.fields);

  if (!Array.isArray(shaped)) return JSON.stringify(shaped);

  const total = shaped.length;
  const full = wrapArray(shaped, opts);
  if (full.length <= opts.budget) return full;

  // Largest prefix that fits, always keeping the first item. Length is monotonic in the
  // item count, so bisect.
  let lo = 1;
  let hi = total - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (wrapArray(shaped.slice(0, mid), opts, total).length <= opts.budget) lo = mid;
    else hi = mid - 1;
  }
  return wrapArray(shaped.slice(0, lo), opts, total);
}

const QUERY_KEYS = ["conditions", "childConditions", "customFieldConditions", "orderBy"] as const;

const QUOTED_RE = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function aliasNoteDates(s: string): string {
  return s
    .replace(/(?<![\w/])(?:dateCreated|createdDate)\b/g, "_info/dateEntered")
    .replace(/(?<![\w/])dateEntered\b/g, "_info/dateEntered");
}

function aliasClosedFlag(s: string): string {
  return s
    .replace(/(?<![\w/])closedFlag\s*=\s*false\b/gi, "closedDate = null")
    .replace(/(?<![\w/])closedFlag\s*=\s*true\b/gi, "closedDate != null");
}

/** Applies `fn` to the parts of a query outside quoted strings only. */
function outsideQuotes(s: string, fn: (part: string) => string): string {
  let out = "";
  let last = 0;
  for (const m of s.matchAll(QUOTED_RE)) {
    out += fn(s.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(s.slice(last));
}

/**
 * Repairs known-bad query arguments: HTML-encoded operators, and field names that do not
 * exist on the target resource. Touches conditions, childConditions, customFieldConditions
 * and orderBy only, and never the contents of quoted strings.
 */
export function normaliseQueryArgs(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...args };
  const isNote = /ticket_note/.test(toolName);
  const isOpportunity = /opportunit/.test(toolName);
  for (const key of QUERY_KEYS) {
    const v = out[key];
    if (typeof v !== "string") continue;
    out[key] = outsideQuotes(decodeEntities(v), (part) => {
      let p = part;
      if (isNote) p = aliasNoteDates(p);
      if (isOpportunity) p = aliasClosedFlag(p);
      return p;
    });
  }
  return out;
}
