# Upstream security picks, November 2026

## Outcome

Decided and executed on branch `chore/upstream-security`. The sections below record the pre-decision analysis. Sentences marked "Superseded" no longer describe the plan.

- #106: hand-ported. A cherry-pick conflicted on upstream #116's safe-error code, which the fork did not take, so the SSRF guard was re-applied by hand with the verbatim ConnectWise error body kept.
- #107: reproduced with `npm audit fix --omit=dev` rather than cherry-picked. Production advisories went from 10 to 0, the SDK from 1.26.0 to 1.32.2, transitive `@hono/node-server` from 1.19.14 to 2.1.7 and `undici` from 8.3.0 to 8.12.4.
- #115: cherry-picked.
- #122: deferred, because it is unmerged upstream.
- #116: deliberately absent. The fork keeps ConnectWise error bodies verbatim.
- Hunks for `src/worker.ts` and `src/__tests__/http-s2s-auth.test.ts` were dropped, because the fork has neither file.

Source: `upstream` = wyre-technology/connectwise-manage-mcp, fetched 12 Nov 2026 (`git fetch upstream`, tip `ae2e8d0`). Fork base: `origin/main` 69b08d0. Read with `gh pr view <n> --repo wyre-technology/connectwise-manage-mcp` and `git show`.

## Number mapping

#101 and #103 are issues, not pull requests (`gh api repos/.../issues/<n>` returns `pull_request: false`, both closed). The fixing pull requests are #106 (body says "Fixes #101") and #107 (body says "Fixes #103"). #122 is a pull request and is still OPEN.

| Brief ref | Pull request | Title | Pick SHA | Kind | Files |
|---|---|---|---|---|---|
| #101 SSRF | #106 | fix(security): validate the gateway X-CW-Url before every request | 17f5802bc9394b6643c71fa693c6efb612e4bf84 | squash, 1 parent | 6 |
| #103 dependency advisories | #107 | fix(deps): refresh the lockfile to clear production advisories | becd064109fcb6701cb9370d6a5737f7a988b6e0 | squash, 1 parent | 2 |
| #115 Host header | #115 | fix(http): answer a malformed Host header with 400 instead of crashing | f48886b3e76588d3e2a042508d05ac81603df64e | squash, 1 parent | 5 |
| #122 input caps | #122 | fix(security): cap request body and tool input elements (CVE-2026-111768, GHSA-f897) | NOT MERGED. Head b358f88a82ea05631cf225f65a0a6a8de98cb149 (two commits c308e4dbf, b358f88a8), base 4218e3062 | open, mergeCommit null | 9 |
| never take | #116 | fix(security): return status and a reference id, not the upstream error body | b797e8a6d815c10254aefa2cdc2a5592752eb97b | squash, 1 parent | 10 |

All merged picks are squash commits, so a plain `git cherry-pick <sha>` is right and `-m 1` is not needed. Superseded: only #115 was cherry-picked, #106 and #107 were not (see Outcome). #122 has no merge commit, so it can only be taken as its two head commits. Its head is fetched locally as `upstream/pr-122` (`git fetch upstream pull/122/head`).

## Changed files

- #106: CHANGELOG.md, src/__tests__/gateway-url-guard.test.ts, src/__tests__/http-s2s-auth.test.ts, src/api-client.ts, src/mcp-server.ts, src/url-guard.ts
- #107: CHANGELOG.md, package-lock.json
- #115: CHANGELOG.md, src/__tests__/host-header.test.ts, src/auth/routes.ts, src/index.ts, src/request-target.ts
- #122: README.md, package-lock.json, package.json, src/__tests__/input-limits.test.ts, src/__tests__/request-body-limit.test.ts, src/index.ts, src/input-limits.ts, src/mcp-server.ts, src/worker.ts
- #116 (reference only): CHANGELOG.md, src/__tests__/invoices.test.ts, src/__tests__/safe-error.test.ts, src/__tests__/update-contact.test.ts, src/api-client.ts, src/auth/routes.ts, src/safe-error.ts, src/tools/invoices.ts, src/tools/projects.ts, src/tools/tickets.ts

## Files the fork does not have (checked with `git cat-file -e origin/main:<path>`)

- src/url-guard.ts (new in #106), src/request-target.ts (new in #115), src/input-limits.ts (new in #122): new files, expected.
- src/worker.ts: #122 edits it, but the fork has no such file. That hunk will not apply and needs a decision. Superseded: the hunk was dropped and #122 deferred (see Outcome).
- src/safe-error.ts: from #116, absent, as intended.
- src/__tests__/http-s2s-auth.test.ts: #106 edits it, but the fork has no such file. That hunk will not apply.
- Present in the fork: src/auth/routes.ts, src/mcp-server.ts, src/api-client.ts, src/index.ts, package-lock.json, CHANGELOG.md, README.md.

## Overlap with #116 (reported, not decided)

Per the controller ruling, `merge-base --is-ancestor` was not used. Overlap is by changed files.

| Pick | Overlapping files with #116 | Hunks look dependent? |
|---|---|---|
| #106 | CHANGELOG.md, src/api-client.ts | api-client.ts: YES in context. The first hunk's context lines are #116's `import { ... } from "./safe-error.js"` block, and the diff is built on #116's `CwApiError` text (index 2ff2b11 to 0a4da77). The `assertSafeGatewayUrl` import is added directly after that block. The fork has no safe-error import, so that hunk conflicts. The new code itself (url-guard, `untrustedBaseUrl`, redirect handling) does not call safe-error functions in the portions read, but the later fetch hunk was only read to line 90 of the diff and not checked for `CwApiError` fields. CHANGELOG.md: context only. |
| #107 | CHANGELOG.md | No. Context only. package-lock.json does not overlap #116. |
| #115 | CHANGELOG.md, src/auth/routes.ts | routes.ts: #116 adds `safeOAuthErrorCode` near the top and removes a log line in `handleToken`. #115's routes.ts hunk applies cleanly to the fork with `--3way`, so it looks independent. CHANGELOG.md: context only. |
| #122 | none by its 9 files | No file overlap. But src/index.ts hunks use #115 and #110 as context (imports of `request-target.js` and `s2s-verify.js`), so #122 depends on #115, and on #110 (fail-closed S2S) if the fork lacks `s2s-verify`. |

CHANGELOG.md overlaps on every pick, because each PR adds a top entry. These are expected textual conflicts and are not dependencies.

## Dry-run of applying each pick to origin/main (`git apply --check`, nothing written)

All four fail a plain apply, because the fork lags upstream.
- #106: CHANGELOG.md, src/api-client.ts and src/mcp-server.ts do not apply, and src/__tests__/http-s2s-auth.test.ts is missing. With `--3way`, mcp-server.ts applies cleanly, api-client.ts and CHANGELOG.md conflict.
- #107: CHANGELOG.md and package-lock.json do not apply. package-lock.json conflicts under `--3way`.
- #115: CHANGELOG.md and src/index.ts do not apply. With `--3way`, routes.ts applies cleanly, index.ts and CHANGELOG.md conflict.
- #122 (diff from its base 4218e3062): README.md, package-lock.json, package.json, src/index.ts do not apply.

## Findings for the controller

1. Brief numbers #101 and #103 are issues. Pick #106 and #107.
2. #122 is OPEN and unmerged, so there is no merge SHA and its content may still change upstream. Pin to head b358f88a8 or defer. Superseded: deferred (see Outcome).
3. #106 is textually built on #116 in api-client.ts. That is a reported dependency in context only. Whether to resolve by hand is the controller's call.
4. #122 depends on #115 being applied first.
