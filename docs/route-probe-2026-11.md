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

`/sales/quotes`, `/sales/quotes/count` and `/procurement/quotes` all return 404. Only `/sales/orders` returns 200. There is no quotes route on this instance.

Decision for Jayson: point the quote tools at sales orders, or mark them unavailable. Not decided here.
