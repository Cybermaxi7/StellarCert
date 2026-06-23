# StellarCert Issue Tracker

---

## Backend

---

**Title:** Health endpoints require authentication
**Labels:** bug, backend
**Body:** The `/api/v1/health`, `/api/v1/health/ready`, `/api/v1/health/database`, and `/api/v1/health/stellar` endpoints are protected by the global JWT guard because `HealthController` has no `@Public()` decorator. Infrastructure probes (Kubernetes liveness/readiness, uptime monitors) cannot reach the health check without a bearer token, defeating its purpose. Add `@Public()` to the controller or configure the global guard to skip the `/health/*` path prefix.

---

**Title:** Database tables missing — no migration runner on startup
**Labels:** bug, backend, database
**Body:** The app boots successfully but the `users` table (and all others) does not exist, so any call that touches the database returns `relation "users" does not exist`. TypeORM is configured in synchronize or migration mode but migrations are not executed before the app starts. Either set `synchronize: true` in the TypeORM config for development, or wire `typeorm migration:run` into the start script before the NestJS bootstrap. Currently the entire auth flow is broken until this is resolved.

---

**Title:** `InputSanitizationMiddleware` assigns to read-only `req.query`
**Labels:** bug, backend
**Body:** `input-sanitization.middleware.ts` does `req.query = this.sanitize(req.query)`, but `req.query` is a getter-only property on Node.js `IncomingMessage` in modern runtimes. This throws `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter` on every single request, making the entire API return 500. Fixed by mutating the existing query object in-place (`(req.query as Record<string, unknown>)[key] = sanitizedQuery[key]`) instead of replacing the reference. This was causing all endpoints to fail before the fix was applied.

---

**Title:** `UserRole` enum mismatch between `common/constants/roles.ts` and `user.entity.ts`
**Labels:** bug, backend
**Body:** There were two separate `UserRole` enums — one in `common/constants/roles.ts` and another inline in `user.entity.ts`. The entity enum was missing `RECIPIENT` and `VERIFIER` roles that the rest of the system used, causing TypeScript type errors and runtime role-check failures. The entity should import and re-export from the single source of truth in `common/constants`. Any future role additions must be made in one place only.

---

**Title:** `AUDITOR` role is not counted in `getUserStats()`
**Labels:** bug, backend
**Body:** `UsersService.getUserStats()` counts `admin`, `issuer`, `user`, `recipient`, and `verifier` roles but not `auditor`. After `AUDITOR` was added to the `UserRole` enum, the `byRole` map in the stats response omits auditor counts entirely, returning 0 when it should reflect the real count. Add `this.userRepository.countByRole(UserRole.AUDITOR)` to the parallel promises and include the result in the returned object.

---

**Title:** Refresh token stored in plain `localStorage` — comment says otherwise
**Labels:** bug, security, backend
**Body:** `UserAuthService.generateTokens()` returns a refresh token in the JSON response body, and `UserAuthService` stores a hashed copy in the database. However the API design still exposes the raw refresh token over the wire, and the frontend stores it in `localStorage`. The code comment in `tokens.ts` claims "refresh tokens are handled server-side via httpOnly cookies" but the implementation contradicts this — refresh tokens are stored and sent as plain JSON. Either implement httpOnly cookie delivery on the backend (`res.cookie(...)` with `httpOnly: true, sameSite: 'strict'`) or remove the misleading comment. Storing refresh tokens in `localStorage` makes them accessible to any JavaScript on the page.

---

**Title:** `res.send` monkey-patching in middleware uses wrong `this` binding
**Labels:** bug, backend
**Body:** `CorrelationIdMiddleware` and `MetricsMiddleware` were patching `res.send` by binding a custom object as `this`, causing Express to call `this.get()` on that custom object instead of the `Response` instance. This resulted in `TypeError: this.get is not a function` on every request. Fixed by using the closure pattern: `const originalSend = res.send.bind(res)` and capturing service references in outer-scope variables instead of via `this` inside the patched function.

---

**Title:** `uuid` v13 ESM-only package incompatible with CommonJS NestJS build
**Labels:** bug, backend
**Body:** `import { v4 as uuidv4 } from 'uuid'` (version 13) fails with TS1479 ("package uses ESM, cannot be referenced in CommonJS") under `nodenext` module resolution. Affected files: `logging.service.ts`, `audit-context.middleware.ts`, `correlation-id.middleware.ts`. Fixed by replacing with `import { randomUUID as uuidv4 } from 'crypto'` (Node.js built-in). The `uuid` dependency should be pinned to `<13` or removed in `package.json` to prevent re-introduction.

---

**Title:** Global JWT guard blocks all routes without opt-in `@Public()`
**Labels:** enhancement, backend, security
**Body:** The application applies `JwtAuthGuard` globally via `APP_GUARD` in the module, requiring every public endpoint to explicitly add `@Public()`. This is error-prone: new controllers are protected by default, but endpoints like the health check, Swagger, and email verification callbacks are silently broken until the developer remembers to add the decorator. Consider documenting the pattern clearly in CONTRIBUTING.md or switching to an opt-in guard strategy for less critical paths.

---

**Title:** On-chain certificate issuance failure causes DB/chain inconsistency
**Labels:** bug, backend, stellar
**Body:** In `CertificateService.create()`, the database record is committed first, and then the Soroban on-chain call is attempted. If the on-chain call fails, the error is re-thrown — but the DB record already exists. The rollback only covers the initial DB write, not the committed transaction. The caller receives an error, but the certificate persists in the database without a `stellarTransactionHash`. There is no retry mechanism or reconciliation job to detect and resolve these orphaned DB records. Add a background job or expose a `/certificates/:id/sync-chain` endpoint that issuers can use to re-attempt on-chain issuance.

---

**Title:** `StorageService` crashes startup when S3 config is absent and `STORAGE_REQUIRED` is unset
**Labels:** bug, backend
**Body:** If `STORAGE_REQUIRED` is not explicitly set to `false` in `.env`, the `StorageService` throws a fatal error during `onModuleInit()` and prevents the application from starting. The default behavior should be non-fatal (warn-only) in development. Additionally, the `.env.example` file does not include `STORAGE_REQUIRED`, so developers hit this error without any obvious fix. Add `STORAGE_REQUIRED=false` to `.env.example` and make the startup behavior match the documented default.

---

**Title:** `@nestjs/config@4.x` env loading requires `validate` to read from its parameter
**Labels:** bug, backend
**Body:** `@nestjs/config` v4 uses `dotenv.parse()` internally instead of `dotenv.config()`, meaning the `.env` file values are NOT in `process.env` when `validateEnv()` is called. The old implementation read directly from `process.env`, causing all env vars to appear undefined during validation. Fixed by reading from the `config` parameter passed to `validateEnv(config: Record<string, unknown>)` with `process.env` as fallback. Any future additions to the validator must use this pattern or env vars will silently resolve to `undefined`.

---

## Frontend

---

**Title:** `IssueCertificate` component (`components/IssueCertificate.tsx`) is disconnected from the API
**Labels:** bug, frontend
**Body:** `src/components/IssueCertificate.tsx` has a `handleSubmit` that only calls `await new Promise(resolve => setTimeout(resolve, 1500))` and then `alert("Certificate issued successfully")`. It is completely disconnected from the backend API. The real issue-certificate page is `src/pages/IssueCertificate.tsx`, which does call the API properly. The orphan component in `components/` is misleading and should either be removed or wired up to the real API call.

---

**Title:** `AUDITOR` role missing from frontend `UserRole` enum and route map
**Labels:** bug, frontend
**Body:** The frontend `UserRole` enum in `api/types.ts` only defines `ADMIN`, `ISSUER`, `RECIPIENT`, and `VERIFIER`. The `AUDITOR` role exists on the backend but is absent in the frontend. If a user has the auditor role, the `ProtectedRoute` component falls back to an empty `allowedRoutes` array and redirects them to `/` on every protected page. Add `AUDITOR = "auditor"` to the frontend enum and define appropriate allowed routes in `ProtectedRoute.tsx`.

---

**Title:** Access token stored in `localStorage` — `sessionStorage` comment misleading
**Labels:** bug, security, frontend
**Body:** `tokens.ts` has a comment saying access tokens are stored in `sessionStorage` (cleared on tab close), but the actual implementation uses `localStorage` for both access and refresh tokens. Tokens in `localStorage` persist across sessions and are accessible to any JavaScript on the page, increasing the XSS attack surface. The `ACCESS_TOKEN_KEY` constant defined at the top of the file is also never used — actual reads/writes use hardcoded `'accessToken'` strings. Fix: either use the constant consistently, or implement the documented `sessionStorage` approach for access tokens.

---

**Title:** No automatic token refresh on 401 in `AuthContext`
**Labels:** bug, frontend
**Body:** When the access token expires mid-session, `AuthContext` checks expiry on a 5-minute timer but does not attempt a refresh — it simply clears the auth state and logs the user out. Meanwhile `apiClient` in `endpoints.ts` does attempt a refresh on 401 responses, but on success it only updates `tokenStorage` without updating the `AuthContext` user state. If the 401 retry succeeds, the user's `isAuthenticated` remains stale until the next `checkTokenExpiration` interval fires. Align the two refresh paths: when `apiClient` refreshes tokens, dispatch an event or call a shared setter so `AuthContext` reflects the updated state.

---

**Title:** `ProtectedRoute` does not handle unauthenticated access to `/wallet`, `/issue`, `/revoke`, `/certificates`
**Labels:** bug, frontend
**Body:** The `App.tsx` route tree places authentication-required routes inside a `<ProtectedRoute allowedRoles={[...]}>` wrapper, but `ProtectedRoute` has a hardcoded early-return for `/verify`: `if (currentPath === "/verify") return <Outlet />`. This bypasses all auth checks for `/verify`. More critically, if `user` is null and the path is not `/verify`, the component redirects to `/login` — but the redirect does not preserve the `returnUrl`. After login the user is always sent to `/`, losing their intended destination. Add `?returnUrl=...` to the login redirect and honor it after successful authentication.

---

**Title:** Register page sends `role` field which backend rejects
**Labels:** bug, frontend
**Body:** The Login/Register form collects a `role` field (default: `UserRole.RECIPIENT`) and passes it to `authApi.register()`. The backend's `CreateUserDto` rejects any unknown fields with `"property role should not exist"` (due to `whitelist: true` in ValidationPipe). The frontend registration call always fails. Either: (a) remove the role selector from the registration form and let the backend assign the default, or (b) add `role` to `CreateUserDto` as an optional field with the appropriate validation.

---

**Title:** Dashboard `IssuanceChart` uses custom SVG with no tooltip or accessibility
**Labels:** enhancement, frontend
**Body:** The `IssuanceChart` in `Dashboard.tsx` is hand-rolled SVG with no tooltip on hover, no accessible axis labels, and no fallback for screen readers beyond a single `aria-label`. The `axisLabel` elements are rendered at the bottom but truncated when there are many data points. Consider replacing with a lightweight charting library (e.g., Recharts, which is already in many React stacks) or at minimum add `<title>` and `role="img"` to each bar `<rect>`.

---

**Title:** Missing `NotFound` page export — lazy import will fail at runtime
**Labels:** bug, frontend
**Body:** `App.tsx` does `const NotFound = lazy(() => import("./pages/NotFound"))` but the file is named `Notfound.tsx` (lowercase 'f'). On case-sensitive filesystems (Linux, CI) this import will throw a module-not-found error when the catch-all route is hit, displaying a blank screen instead of the 404 page. Rename the file to `NotFound.tsx` to match the import.

---

**Title:** `CertificateWallet` page accessible to `VERIFIER` role but displays issuer-only actions
**Labels:** bug, frontend
**Body:** `ProtectedRoute` allows `RECIPIENT`, `VERIFIER`, `ISSUER`, and `ADMIN` to access `/wallet`. However, `CertificateWallet` renders download, transfer, and revoke buttons without checking whether the logged-in user actually owns the displayed certificates. A `VERIFIER` user who navigates to `/wallet` can see actions that the API will reject. Add server-side ownership checks and hide action buttons based on `user.role` in the component.

---

## Stellar Contracts

---

**Title:** No storage TTL extension calls — persistent storage will expire
**Labels:** bug, contract
**Body:** All contract data (certificates, issuers, transfers, multisig configs) is stored with `env.storage().persistent()` but `extend_ttl()` is never called on any key. On Stellar Soroban, persistent storage entries expire after `max_entry_expiration` ledgers unless TTL is explicitly extended. Once expired, a certificate or issuer record is permanently lost. Add `env.storage().persistent().extend_ttl(key, threshold, extend_to)` calls at read time (when accessing an entry) and after writes to ensure data persists as long as the issuer intends.

---

**Title:** Multisig contract uses `instance()` storage for per-request data
**Labels:** bug, contract
**Body:** In `multisig.rs`, `PendingRequest`, `MultisigConfig`, `IssuerRequestIds`, and `SignerRequestIds` are stored in `env.storage().instance()`. Instance storage shares a single TTL with the contract instance itself and has a fixed, relatively small storage budget. Pending requests (which can be numerous) should use `persistent()` storage with per-key TTL management. Using `instance()` for unbounded per-request data can cause the instance to grow indefinitely and will silently fail once the instance storage limit is reached.

---

**Title:** `freeze_certificate` does not verify the caller is an authorized issuer
**Labels:** bug, security, contract
**Body:** `lib.rs freeze_certificate()` calls `cert.issuer.require_auth()` — it requires the stored issuer address to authorize. This is correct but it means the function does not check whether that issuer is still in the authorized issuers list. An issuer who has been removed via `remove_issuer()` can still freeze certificates they previously issued. Add a check: `if !env.storage().persistent().get(&DataKey::Issuer(cert.issuer.clone())).unwrap_or(false) { panic!("Issuer is no longer authorized"); }`.

---

**Title:** `update_certificate_metadata` blocked for frozen certificates — no unfreeze path
**Labels:** enhancement, contract
**Body:** `update_certificate_metadata()` panics if `cert.status != Active`. A frozen certificate cannot have its metadata updated, even by the issuer. This is overly restrictive: legitimate use cases include updating a metadata URI while a certificate is temporarily frozen. Consider allowing metadata updates for frozen certificates, or document clearly that callers must `unfreeze_certificate` first and then `freeze_certificate` again, which creates an unnecessary window of unfrozen state.

---

**Title:** `reissue_certificate` does not revoke the original certificate
**Labels:** bug, contract
**Body:** `reissue_certificate()` creates a new child certificate linked to `parent_certificate_id` but leaves the original certificate in `Active` status. Both the old and new certificate are simultaneously valid. Unless the issuer manually revokes the original, verifiers querying the old ID will get a valid response. This defeats the purpose of reissuance. Either automatically set the original certificate to `Revoked` (with reason "Superseded") as part of reissuance, or document prominently that callers must separately call `revoke_certificate` on the original.

---

**Title:** CRL contract is a separate, independently deployed contract with no link to main contract
**Labels:** enhancement, contract
**Body:** The `CRLContract` in `crl.rs` is a separate Soroban contract that tracks revocations independently. When `revoke_certificate()` is called on `CertificateContract`, it updates the certificate status on-chain but does NOT notify or update the CRL contract. The CRL contract's `revoke_certificate()` must be called separately by the issuer. This means a certificate can be revoked in the main contract but still pass CRL checks (or vice versa). Either make revocation atomic via a cross-contract call or add documentation and tooling to ensure both are always called together.

---

**Title:** No on-chain event emitted when `update_certificate_metadata` is called
**Labels:** enhancement, contract
**Body:** `issue_certificate`, `revoke_certificate`, `freeze_certificate`, and `unfreeze_certificate` all emit events via `env.events().publish(...)`. However, `update_certificate_metadata()` makes no `publish()` call. Off-chain indexers and the backend service cannot detect metadata changes without polling the certificate record. Add a `CertificateMetadataUpdatedEvent` type and publish it in `update_certificate_metadata()`.

---

**Title:** No pagination limit enforcement in `get_certificates_by_issuer` / `get_certificates_by_owner`
**Labels:** enhancement, contract
**Body:** `get_certificates_by_issuer` and `get_certificates_by_owner` call `paginate_certificates()`, which returns up to `limit` items. However, there is no maximum cap on `limit`. A caller passing `limit = u32::MAX` will cause the function to iterate over the entire certificate list in a single invocation, consuming all available computation units and causing the transaction to fail or be rejected. Add a maximum limit (e.g., 100) and either cap or reject values exceeding it.

---

**Title:** `batch_verify_certificates` treats `Suspended` and `Frozen` status as revoked
**Labels:** bug, contract
**Body:** In `batch_verify_certificates()`, the `is_revoked` flag is set to `true` for certificates with status `Suspended`, `Frozen`, or `Expired`. Callers using this function may incorrectly report a suspended/frozen certificate as "revoked" in user-facing messages, when the correct status is different. The `VerificationResult` struct only has a boolean `revoked` field with no status detail. Add a `status` string field to `VerificationResult` so callers can distinguish between `Revoked`, `Suspended`, `Frozen`, and `Expired`.

---

**Title:** Transfer completion does not update `OwnerCertIds` index
**Labels:** bug, contract
**Body:** `complete_transfer()` updates `cert.owner` to the new address and saves the certificate, but it does not update the `OwnerCertIds` index. After a transfer, `get_certificates_by_owner(old_owner)` still returns the transferred certificate, and `get_certificates_by_owner(new_owner)` does not include it. The index becomes permanently inconsistent. Add: remove `certificate_id` from `OwnerCertIds(from_owner)` and append it to `OwnerCertIds(to_owner)` inside `complete_transfer()`.
