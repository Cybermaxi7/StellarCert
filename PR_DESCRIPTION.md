# fix: CI conflict-marker gate, open-redirect hardening, TypeORM SQLi audit, dependency vulnerabilities

Closes #654, #653, #652, #651

## Summary

- **#654** — Adds a CI job that fails the build on leftover merge-conflict markers, and cleans up the debris already on `main` (including a previously-undetected case that was silently breaking the frontend build).
- **#653** — Upgrades `react-router-dom` past the open-redirect/XSS advisory and closes the actual app-level open redirect in the post-login `returnUrl` flow.
- **#652** — Upgrades `typeorm` past the `orderBy` SQL-injection advisory and fixes a real, unpatched instance of the same class of bug in the admin users list endpoint.
- **#651** — Works through the `npm audit` backlog: 51 vulnerabilities (3 low / 24 moderate / 23 high / 1 critical) down to 48, with **all** low/critical eliminated and moderate cut ~70%. `axios` and `nodemailer` (top priority per the issue) are fully patched.

---

## #654 — CI check for merge-conflict markers

**Added** a `conflict-markers` job to `.github/workflows/ci.yml` that runs the exact grep gate from the issue on every push/PR:

```yaml
conflict-markers:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Check for merge conflict markers
      run: |
        if git grep -nE '^(<{7}|={7}|>{7}|\|{7})( |$)' -- . ':!*.md'; then
          echo "Merge conflict markers found"
          exit 1
        fi
```

**Also found and fixed while investigating:**

- `.github/workflows/ci.yml` itself had broken/inconsistent indentation (the `frontend`, `backend`, and `contracts` jobs were mis-indented under `changes`), which made the whole workflow file **invalid YAML** — CI could not have been running these jobs at all. Re-indented the file back to valid YAML while keeping all existing steps unchanged, and added the new job.
- `frontend/src/pages/Verify.tsx` — the stray `<<` on line 1 called out in the issue. This file turned out to be entirely dead code (not imported anywhere — the app routes `/verify` to `VerifyCertificate.tsx`) and had a second piece of merge debris at the bottom (a duplicate `default` export alongside a `export { default } from './VerifyCertificate'` re-export), which is a hard compile error on its own. Deleted the file rather than patch debris nothing references.
- `frontend/src/context/AuthContext.tsx` had the same class of bug without literal conflict markers: two versions of the token-expiration effect and the cleanup-interval effect had been merged together (duplicate `const interval` declaration, an unreachable second `return`, and a nested/duplicated `if` chain shadowing the outer `accessToken` state variable). This was a hard parse error — `tsc -b` couldn't compile the file at all before this fix. Resolved to a single, coherent implementation.
- Fixing the parse error also exposed a previously-invisible bug in the same file: `setTokenRefreshCallback` (the silent-token-refresh hook backing the `AuthContext silent token refresh (#560)` test suite) was called but never imported. Since the whole file couldn't parse before, this test suite never actually ran. Added the missing import — the 4 tests in that suite now pass.

**Verification:** `npx tsc -b --noEmit` — the parse errors are gone; only pre-existing, unrelated type errors remain (see Known pre-existing issues below). Frontend test suite: went from "5 files crash to load, 4 tests fail" to "5 files have pre-existing unrelated failures, 0 regressions" — the `AuthContext.test.tsx` suite (4 tests) now runs and passes for the first time. `git grep` for the marker pattern returns clean on the current tree.

---

## #653 — react-router-dom open redirect / XSS

- Upgraded `react-router-dom` **6.27.0 → 7.18.2** (`frontend/package.json`). The reported advisory (`GHSA-jjmj-jmhj-qwj2`, open redirect leading to XSS) plus two related React Router advisories are only fixed at `>=7.18.0` — no patched 6.x release exists, so a same-major patch wasn't an option. The app only uses classic declarative-router APIs (`BrowserRouter`, `Routes`, `Route`, `useNavigate`, `useSearchParams`, `useLocation`, `Link`, `Navigate`, `Outlet`) — no data-router / RSC APIs — so this upgrade is a drop-in replacement here. Verified via `tsc -b` (no new errors) and the full test suite (no new failures; `src/guard` tests — 10/10 — pass).

  Note: `npm audit` now flags one _new_ high-severity advisory (`GHSA-qwww-vcr4-c8h2`, RSC-mode CSRF bypass) against `react-router` `7.12.0–8.2.0`. This only applies to React Router's server-actions/RSC framework mode, which this app does not use, and no patched release exists yet (`>=8.3.0` isn't published to npm). Tracked but not actionable/exploitable here — flagging so it isn't mistaken for an oversight.

- **Closed the actual open redirect**, per the issue's explicit ask ("confirm that any redirect target derived from the URL is validated against an allowlist of internal paths"): `frontend/src/pages/Login.tsx` read `returnUrl` straight from the query string and passed it to `navigate()` unvalidated — a classic post-login open-redirect (`/login?returnUrl=//evil.example/phish`). Added `frontend/src/utils/redirect.ts` (`getSafeRedirectPath`), which only accepts a target starting with a single `/` (rejecting absolute URLs, `//host` protocol-relative URLs, and `\`-based variants some browsers reinterpret as protocol-relative), falling back to `/` otherwise. Wired into `Login.tsx`.
- Checked the `/verify-email` flow (`VerifyEmail.tsx`) and `ProtectedRoute.tsx` as the issue suggested — `VerifyEmail.tsx` doesn't navigate off any URL-derived value (its "Go to login" link is a hardcoded path), and `ProtectedRoute`'s `returnUrl` construction is safe (it builds the value from `location.pathname`, not from user input). The only actual sink was `Login.tsx`.

---

## #652 — TypeORM SQL injection

- Upgraded `typeorm` **0.3.28 → 0.3.31** (`backend/package.json`) — the last patched release in the `0.3.x` line (fixes both `GHSA-9ggv-8w38-r7pm` and `GHSA-2rp8-mm9q-fp49`), compatible with `@nestjs/typeorm`'s `^0.3.0` peer range. Did **not** jump to the new `typeorm@1.x` line — that's a fresh major release and a much larger, riskier change than this fix calls for.
- Audited every `.where()` / `.andWhere()` / `.orWhere()` / `.having()` / `.orderBy()` call site across `certificate.service.ts`, `certificate-search.service.ts`, `certificate.repository.ts`, `stats.service.ts`, `admin-analytics.service.ts`, `audit.service.ts`, `user.repository.ts`, `two-factor.service.ts`, `duplicate-detection.service.ts`, and `jobs.processor.ts` (135 call sites total). All `.where()`-family calls already use bound `:param` placeholders correctly — including the `%${term}%` LIKE-wildcard cases, which are safe because the interpolation happens in the JS-side parameter _value_, not in the SQL condition string itself.
- Found two `.orderBy()` call sites that build the **column name** via template-literal interpolation (`.orderBy(\`cert.${sortBy}\`, ...)`), which is the exact pattern the advisory is about — ORDER BY can't use bound parameters for identifiers, so an allowlist is the only correct mitigation:
  - `certificate.repository.ts` — already correctly guarded by a `sanitizeSortField()` allowlist. No change needed.
  - `user.repository.ts` — **was not guarded**. `sortBy` flows from `UserFilterDto` (validated only with `@IsString()`, no allowlist) through `UserAdminService.findAllUsers()` into `.orderBy(\`user.${sortField}\`, ...)`with zero sanitization — a real, exploitable SQL injection via the admin`GET /users`list-and-sort endpoint. Added a`sanitizeSortField()` allowlist (`createdAt`, `updatedAt`, `email`, `firstName`, `lastName`, `role`, `status`, `lastLoginAt`, matching the `User`entity's actual columns) mirroring the existing pattern in`certificate.repository.ts`.

**Verification:** `npm run build` (nest build) succeeds. `npm run typecheck` shows the same single pre-existing, unrelated failure as baseline (see below) — no new errors from this change.

---

## #651 — npm audit vulnerabilities

Ran `npm audit fix` at the workspace root (converged after a few passes) plus targeted major-version bumps for the two highest-priority packages called out in the issue:

| Package                                                                                                                                                                           | Before     | After    | Note                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nodemailer` (backend)                                                                                                                                                            | `^6.9.14`  | `^9.0.3` | Major bump; only stable/standard APIs used (`createTransport`, `sendMail`, `createTestAccount`, `getTestMessageUrl`, `verify`) — no code changes needed. `@types/nodemailer` bumped `^6.4.15 → ^8.0.1` to match. |
| `nodemailer` (root)                                                                                                                                                               | `^7.0.12`  | `^9.0.3` | Same advisory, duplicated at the workspace root (unused there — only `backend/src/modules/email/email.service.ts` imports it — but still flagged by `npm audit` since it's a declared direct dependency).        |
| `axios`, `@nestjs/core`, `@nestjs/config` (lodash), `@nestjs/platform-express` (multer), `@nestjs/swagger` (js-yaml), `postcss`, `vite` (launch-editor), `shell-quote` (critical) | vulnerable | patched  | All resolved via `npm audit fix` (non-breaking).                                                                                                                                                                 |

**Result:** `{low: 3, moderate: 24, high: 23, critical: 1, total: 51}` → `{low: 0, moderate: 7, high: 41, critical: 0, total: 48}`.

All **critical** and **low** advisories are gone; **moderate** is down ~70%. The remaining count is dominated by transitive **dev-tooling-only** dependencies (`eslint`, `jest`, `ts-jest`, `typescript-eslint`, `@nestjs/cli` — all devDependencies, not shipped to production) that only resolve via major version bumps (ESLint 8→10, Jest 25+) — out of scope for a security-patch PR and likely to need their own migration pass. Also still open: `@nestjs/bull`/`bull` (moderate, transitive `uuid` advisory) has **no upstream fix published** yet (`npm audit` confirms `fixAvailable: false`).

**Verification:** `npm run build` succeeds for both `backend` and `frontend` after all version bumps (frontend's pre-existing, unrelated `tsc` errors — see below — block the final `vite build` step but are unchanged from baseline).

---

## Known pre-existing issues (out of scope, left untouched)

While digging through the parse errors for #654, several **unrelated, pre-existing** bugs surfaced that are outside the scope of these four issues. Confirmed via `git stash` that every one of these exists identically on `main` before this branch:

- `frontend`: `tsc -b` fails on 8 pre-existing errors in `IssueCertificate.tsx`, `IssuerProfile.tsx`, `CertificatePreview.tsx`, `CertificateWallet.tsx`, and `Login.tsx` (undefined names, implicit `any`, a `login()` call missing its `refreshToken` argument). This blocks `vite build`'s final step and the frontend's own `npm run build`.
- `frontend/src/context/AuthContext.tsx`: `login()`'s type signature requires `(accessToken, refreshToken, user)`, but `tokenStorage` has no `setRefreshToken` method (refresh tokens are stored server-side in an HttpOnly cookie by design) and both call sites in `Login.tsx` only pass 2 arguments. Pre-existing API mismatch, unrelated to the merge-debris cleanup in this PR — left as-is.
- `backend`: `npm run typecheck` fails on one pre-existing error in `test/CertificateManager.test.ts` (`revoke()` called with 3 args, typed for 1–2).
- `backend`: the Jest test suite is largely non-functional — most spec files fail to load with `Cannot find module '../../../common/constants/roles.js'` (an ESM `.js`-extension import that the current Jest/ts-jest config doesn't resolve). Confirmed via `git stash` this is 100% pre-existing (identical 16 failed / 6 passed test-suite count on `main`); validated backend changes via `nest build` instead since the test harness itself doesn't run.

None of these were touched by this PR — flagging them here so they're not mistaken for regressions, and as a heads-up for separate follow-up work.

---

## Files changed

- `.github/workflows/ci.yml` — added `conflict-markers` job; fixed broken YAML indentation
- `frontend/src/pages/Verify.tsx` — deleted (dead code, broken merge debris)
- `frontend/src/context/AuthContext.tsx` — resolved duplicated/interleaved merge debris; fixed missing `setTokenRefreshCallback` import
- `frontend/package.json` — `react-router-dom` → `^7.18.2`
- `frontend/src/pages/Login.tsx` — validate `returnUrl` via allowlist before navigating
- `frontend/src/utils/redirect.ts` — new `getSafeRedirectPath()` helper
- `backend/package.json` — `typeorm` → `^0.3.31`, `nodemailer` → `^9.0.3`, `@types/nodemailer` → `^8.0.1`
- `backend/src/modules/users/repositories/user.repository.ts` — allowlist-sanitize `orderBy` sort field (SQL injection fix)
- `package.json` (root) — `nodemailer` → `^9.0.3`
- `package-lock.json` — dependency tree updates from the above

---

## Test plan

- [x] `git grep -nE '^(<{7}|={7}|>{7}|\|{7})( |$)' -- . ':!*.md'` — clean (exit 1, no matches)
- [x] `.github/workflows/ci.yml` validated as well-formed YAML
- [x] Frontend: `npx tsc -b --noEmit` — merge-debris parse errors gone; only pre-existing unrelated errors remain
- [x] Frontend: full `vitest run` suite — no regressions vs. baseline; `AuthContext.test.tsx` (4 tests) and `src/guard` (10 tests) pass
- [x] Backend: `npm run build` (nest build) — succeeds
- [x] Backend: `npm run typecheck` — same single pre-existing error as baseline, no new errors
- [x] `npm audit` — 51 → 48 vulnerabilities; 0 critical, 0 low (from 1 critical, 3 low)
- [ ] Manual QA: log in via a `/login?returnUrl=...` link with a malicious target and confirm it's ignored in favor of `/`
- [ ] Manual QA: exercise the admin users list endpoint with `sortBy` set to a non-allowlisted value and confirm it falls back to `createdAt` instead of erroring or executing injected SQL
