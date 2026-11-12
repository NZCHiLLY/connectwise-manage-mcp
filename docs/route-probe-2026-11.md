# ConnectWise route probe, 12 Nov 2026

Source: `scripts/probe-routes.mjs`, GET only, run on 12 Nov 2026 with the server's own credentials (approved by Jayson 12 Nov 2026). Base path `/v4_6_release/apis/3.0`, each candidate called with `pageSize=1`. Instance version from `GET /system/info`: **v2025.1.10778**.

## Results

| Status | Path | Purpose |
| --- | --- | --- |
| 404 | `/sales/opportunities/notes/types` | note types candidate |
| 404 | `/sales/opportunities/noteTypes` | note types candidate |
| 200 | `/company/noteTypes` | note types candidate |
| 404 | `/sales/noteTypes` | note types candidate |
| 404 | `/sales/quotes` | quotes candidate |
| 404 | `/sales/quotes/count` | quotes candidate |
| 200 | `/sales/orders` | quotes candidate |
| 404 | `/procurement/quotes` | quotes candidate |
| 200 | `/procurement/products?conditions=opportunity/id=2081` | control, expected 200 |
| 404 | `/sales/opportunities/2081/products` | control, expected 404 |

Both controls returned the expected status, so the probe is trustworthy for the rows above.

## Note types

`/company/noteTypes` returns 200. ConnectWise's own reference agrees: the `type` reference on a note of opportunity 2083 points at `/company/noteTypes/2` (the href path as printed by the probe was `//company/noteTypes/2`, with a doubled leading slash that is how the reference was returned). Note bodies were not printed.

## Quotes

None of the three quote candidates probed (`/sales/quotes`, `/sales/quotes/count`, `/procurement/quotes`) returned 200. They all returned 404.

Caveat: the 200 on `/sales/orders` only shows that the route exists and answers a GET. It does not show quote semantics, field parity, or that any rows exist.

## Decision

Ruling of 12 Nov 2026: the quote tools stay registered and return a clear error naming this evidence, without calling ConnectWise. They are not repointed to sales orders, because sales orders are a different object.

The note types route used is `/company/noteTypes`. The note type href on the opportunity note was returned with a doubled leading slash (`//company/noteTypes/2`), which is how ConnectWise returned it.
