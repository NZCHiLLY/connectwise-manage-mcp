import type { Paging } from "../context.js";

export interface ShapeOptions {
  fields?: string[];
  maxTextChars: number;
  budget: number;
  paging?: Paging;
}

const TEXT_KEYS = new Set(["text", "notes"]);

const DISCLAIMER_RE =
  /This message and its attachments contain confidential information[\s\S]*?transmitted by this email\.?/g;
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
      if (k === "_info") continue;
      const c = compactInner(val, k);
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
  return `${s.slice(0, max)}[... ${s.length - max} more characters]`;
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

function wrapArray(items: unknown[], opts: ShapeOptions, truncated: boolean): string {
  const wrapper: Record<string, unknown> = {
    items,
    returned: items.length,
    hasMore: opts.paging?.hasMore ?? false,
  };
  if (opts.paging?.nextPage !== undefined) wrapper.nextPage = opts.paging.nextPage;
  wrapper.truncated = truncated;
  if (truncated) {
    wrapper.hint =
      "Output was cut to fit the size limit. Request fewer fields with fields= (for example fields=id,summary), use a smaller pageSize, or fetch later records with page=.";
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
  shaped = cleanText(shaped, opts.maxTextChars);
  shaped = compactValue(shaped) ?? (Array.isArray(parsed) ? [] : {});
  if (opts.fields && opts.fields.length > 0) shaped = projectFields(shaped, opts.fields);

  if (!Array.isArray(shaped)) return JSON.stringify(shaped);

  const full = wrapArray(shaped, opts, false);
  if (full.length <= opts.budget) return full;

  // Largest prefix that fits. Length is monotonic in the item count, so bisect.
  let lo = 0;
  let hi = shaped.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (wrapArray(shaped.slice(0, mid), opts, true).length <= opts.budget) lo = mid;
    else hi = mid - 1;
  }
  return wrapArray(shaped.slice(0, lo), opts, true);
}
