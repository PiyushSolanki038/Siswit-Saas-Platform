# Project Debug Report

Date: 2026-03-17
Project: Sunny SISWIT
Prepared from: current repository inspection, fresh build/typecheck/lint runs, route and workflow review, and selective comparison against `docs/production-readiness-pending-tasks.md`

## Important Context

This report is based on the code that exists now.

It was prepared after reviewing the repo and running these checks:

- `npm run build`
- `npm run lint`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npx tsc --noEmit -p tsconfig.node.json`

No application code was edited while preparing this report. This file is the only new artifact.

## Current Verified State

Verified directly from the current repository:

- `npm run build`: passes
- `npx tsc --noEmit -p tsconfig.app.json`: passes
- `npx tsc --noEmit -p tsconfig.node.json`: passes
- `npm run lint`: fails

Current verified lint blockers:

- `src/workspaces/organization_admin/pages/OrganizationAdminDashboard.tsx`
  - 8 `@typescript-eslint/no-explicit-any` errors
- `supabase/functions/_shared/email.ts`
  - triple-slash reference error
  - `@ts-ignore` usage error
- `supabase/functions/send-client-invitation/index.ts`
  - triple-slash reference error
- `supabase/functions/send-employee-invitation/index.ts`
  - triple-slash reference error
- `supabase/functions/send-verification-email/index.ts`
  - triple-slash reference error
- `supabase/functions/sync-user-verification/index.ts`
  - triple-slash reference error

Current verified lint warnings:

- `src/app/App.tsx`
  - `react-refresh/only-export-components`
- `src/app/providers/AuthProvider.tsx`
  - unnecessary `useCallback` dependency warning

Important verification gap:

- `tsconfig.app.json` only includes `src`
- `tsconfig.node.json` only includes `vite.config.ts`
- Supabase edge functions are not part of the current TypeScript verification path

This means the main app typecheck is green, but edge-function correctness is not being typechecked by the current repo scripts.

## Confirmed Changes Since The 2026-03-14 Report

These items look improved compared with the earlier production-readiness report:

- Auth callback URL handling is better. `src/app/providers/AuthProvider.tsx` now prefers `VITE_PUBLIC_APP_URL` and only uses the current browser origin for local development or as a fallback.
- The invitation flow is more unified than before. I did not find `inviteUserByEmail`; invite creation now uses `employee_invitations` and `client_invitations`, and email delivery is handled through edge functions.
- The public footer branding typo noted earlier appears fixed from `SITWIT` to `SISWIT`.

These items are still incomplete or newly visible:

- Lint now fails in Supabase edge-function files, not only in the organization admin dashboard.
- The remember-me/session mismatch still exists.
- The customer portal email-only scoping risk still exists.
- The app still has route drift between actual routes and dashboard/portal links.

## Executive Summary

The project is still not production ready.

The biggest confirmed blockers are:

1. Customer portal records are still fetched by email alone in multiple places, which keeps the highest-severity cross-organization exposure risk alive.
2. The auth workflow is improved, but remember-me behavior, active-organization resolution, and verification coverage are still inconsistent.
3. Several user-facing links still point to routes that do not exist.
4. Organization admin, platform admin, and some owner-facing screens still contain placeholder, sample, or read-only behavior.
5. Background jobs, logging, and runtime error reporting are still mostly scaffolding.
6. The public site still has fake submission behavior, placeholder links, SEO/metadata gaps, and encoding defects.
7. There is still no automated test or CI safety net in the repository.

## Release Gate Recommendation

Do not treat the application as production ready until all of the following are done:

- Remove email-only data scoping from the customer portal and enforce organization-safe access rules.
- Make session persistence and active-organization resolution deterministic across auth, organization, tenant, and portal flows.
- Remove or implement all dead links and missing routes in user-facing areas.
- Replace placeholder dashboards and disabled owner/admin actions with real, typed, auditable flows.
- Implement real worker behavior, monitoring, and runtime error reporting.
- Bring lint to green, expand verification to edge functions, and add smoke-level tests plus CI gates.

## Recommended Delivery Phases

The phases below keep the same general order as the earlier report so they are easy to compare. Each phase now includes a concrete fix order based on the current codebase.

---

## Phase 1: Marketing Site and Public-Facing UI

### Goal

Make the public website credible, accurate, and launchable without fake behavior or placeholder exits.

### Current Verified Findings

- `src/workspaces/website/pages/Contact.tsx` still simulates submission with a `setTimeout` and success toast.
- Public footer resource links still point to `#` in `src/workspaces/website/components/layout/Footer.tsx`.
- Contact page still contains `#` links for privacy policy, demo booking, and live chat.
- `index.html` still uses a `lovable.dev` Open Graph image and older metadata.
- `public/robots.txt` exists but does not reference a sitemap.
- No sitemap or manifest/webmanifest file was found under `public` or `docs`.
- Encoding defects are still visible, for example `Â©` in the public footer.

### Fix Order

1. Replace the fake contact-form submit path with a real write, email relay, or CRM handoff.
2. Replace all remaining `#` links with real routes or remove the actions until they exist.
3. Add legal/support destinations:
   - privacy policy
   - terms of service
   - cookie policy
   - support path
4. Update `index.html` metadata:
   - title
   - description
   - canonical
   - Open Graph image
   - Twitter image
5. Add sitemap and manifest support and update `robots.txt`.
6. Run a copy and encoding cleanup pass across the public site.

### Exit Criteria

- Contact submission performs a real action.
- No public CTA or footer link points to `#`.
- Metadata and sharing assets reflect the current product.
- No visible encoding corruption remains on public pages.

---

## Phase 2: Login, Authentication, Invitations, and Session Logic

### Goal

Make auth predictable, tenant-aware, and consistent across sign-in, signup, invitation acceptance, and post-login routing.

### Current Verified Findings

- Auth callback generation is improved in `src/app/providers/AuthProvider.tsx` and is now environment-aware.
- Invitation creation and delivery are more unified:
  - app-managed invitation tables are used
  - edge functions send email
  - no `inviteUserByEmail` usage was found
- `src/workspaces/auth/pages/Auth.tsx` still renders a Remember me checkbox and passes `rememberMe` into `signIn`.
- `src/app/providers/AuthProvider.tsx` no longer uses the remember-me argument in sign-in.
- `src/core/api/client.ts` still hardcodes Supabase auth storage to `sessionStorage`.
- `src/app/providers/OrganizationProvider.tsx` still chooses the active organization from `rows[0]` instead of using the same membership-priority logic that `AuthProvider` now has.
- Supabase edge functions are not in the current typecheck path, and lint is now failing in those files.

### Fix Order

1. Make remember-me behavior real or remove the UI control.
2. Reuse one active-membership selection strategy across:
   - `AuthProvider`
   - `OrganizationProvider`
   - tenant resolution
   - post-login redirects
3. Add edge functions to the verification path so auth-related backend code is not exempt from type checks.
4. Clear the current edge-function lint issues:
   - triple-slash reference usage
   - `@ts-ignore` in shared email code
5. Add smoke tests for:
   - sign-in
   - verification resend
   - employee invite acceptance
   - client invite acceptance
   - multi-membership landing behavior

### Exit Criteria

- Remember-me behavior matches the UI promise.
- Users with multiple memberships land in the correct organization consistently.
- Edge functions are part of repo verification and lint/type-safe.
- Invite and signup flows are deterministic end to end.

---

## Phase 3: Organization Owner and Organization Admin Workspaces

### Goal

Turn owner/admin areas into dependable operational surfaces instead of partly presentational dashboards.

### Current Verified Findings

- `src/workspaces/organization/pages/OrganizationSettingsPage.tsx` is still read-only and exposes disabled "Save Changes (Soon)" and "Upload Logo (Soon)" buttons.
- `src/workspaces/organization/pages/OrganizationPlansPage.tsx` is still read-only and exposes disabled "Change Plan (Soon)" and "Manage Billing (Soon)" actions.
- `src/workspaces/organization/components/OrganizationSidebar.tsx` still contains a disabled "Coming soon" control.
- `src/workspaces/organization_admin/pages/OrganizationAdminDashboard.tsx` still contains explicit `any` types and hardcoded KPI deltas such as `+12.7%`, `+5.2%`, and `-1.9%`.
- `src/workspaces/organization_admin/hooks/useOrganizationDashboard.ts` still depends on `useTenant()` and queries by `tenant_id`.

### Fix Order

1. Remove fake deltas and placeholder dashboard signals from organization admin.
2. Replace `any` usage in organization admin and make the dashboard lint-clean.
3. Move org-admin data loading from tenant-era assumptions to organization-aware data loading.
4. Turn organization settings into an actual editable/saveable surface.
5. Turn plans/billing from a status display into a real operational workflow.
6. Remove or implement remaining "Soon" and "Coming soon" controls.

### Exit Criteria

- Organization settings can be edited and saved.
- Plan and billing actions reflect a real system.
- Org-admin dashboard is typed, lint-clean, and backed by real values.
- No placeholder owner/admin actions remain in primary workflows.

---

## Phase 4: Employee Workspace and Product Modules

### Goal

Make module navigation and operational workflows route-complete, scoped, and consistent.

### Current Verified Findings

- `src/modules/cpq/pages/CPQDashboard.tsx` still links to `/dashboard/cpq/pricing`, but there is no matching route in `src/app/App.tsx`.
- `src/modules/cpq/pages/QuoteDetailPage.tsx` links to `/dashboard/clm/contracts/new?quote_id=...`, but that route does not exist in `src/app/App.tsx`.
- `src/modules/clm/pages/CLMDashboard.tsx` still has mislabeled actions such as "Manage Products" and "Create Quote" inside CLM.
- Several CLM pages exist in the repo but are not wired into the router:
  - `ContractBuilderPage`
  - `ContractDetailPage`
  - `ContractScanPage`
  - `ContractsListPage`
  - `ESignaturePage`
- Soft-delete bypass remains widespread. Many hooks still pass `hasSoftDelete: false` in:
  - `src/modules/cpq/hooks/useCPQ.ts`
  - `src/modules/crm/hooks/useCRM.ts`
  - `src/modules/clm/hooks/useCLM.ts`
  - `src/modules/erp/hooks/useERP.ts`
  - `src/modules/documents/hooks/useDocuments.ts`

### Fix Order

1. Make the route map authoritative and remove dead links from module dashboards and detail pages.
2. Fully wire the intended CLM route set or delete the links to unfinished pages.
3. Replace legacy `/dashboard/...` link usage with canonical tenant-scoped route helpers where possible.
4. Audit soft-delete behavior module by module and stop bypassing it by default.
5. Add missing validation, audit, and permission checks to module write paths.

### Exit Criteria

- Every module CTA resolves to a real route.
- CLM route coverage is intentional and complete.
- Soft-deleted records do not leak into normal list views.
- Module dashboards only surface supported actions.

---

## Phase 5: Customer Portal

### Goal

Make the portal safe, scoped, and reliable for real external users.

### Current Verified Findings

- Portal scoping is still email-only in multiple places:
  - `src/workspaces/portal/pages/PortalDashboard.tsx`
  - `src/workspaces/portal/pages/CustomerQuotesPage.tsx`
  - `src/workspaces/portal/pages/CustomerContractsPage.tsx`
  - `src/workspaces/portal/pages/CustomerPendingSignaturesPage.tsx`
- These files query by `customer_email` or `signer_email` without first enforcing an organization-aware customer mapping.
- Portal detail links still point to routes that do not exist:
  - `/portal/quotes/:id`
  - `/portal/contracts/:id`
  - `/portal/pending-signatures/:id`
- `src/app/App.tsx` only mounts list-level portal routes under `/:tenantSlug/app/portal`.
- Portal quick actions still use legacy absolute `/portal/...` paths instead of tenant-scoped helpers.
- Portal settings still redirect back to the parent route instead of opening a real settings page.
- Encoding corruption is still visible in the portal welcome headline.

### Fix Order

1. Treat portal access control as the top release blocker.
2. Define one customer-to-organization access model and apply it to every portal query.
3. Enforce the same rules at the database-policy layer, not only in the UI.
4. Implement real detail routes for quotes, contracts, and pending signatures or remove the links.
5. Replace legacy absolute portal paths with tenant-scoped route helpers.
6. Implement portal settings or remove the nav destination until it exists.

### Exit Criteria

- Portal data cannot leak across organizations.
- Every portal link resolves to a real destination.
- Customer access is enforced both in UI code and database policy.
- Portal navigation no longer depends on legacy redirect behavior for primary actions.

---

## Phase 6: Platform Admin and Legacy Migration Cleanup

### Goal

Make the platform layer trustworthy and aligned with the current organization-based architecture.

### Current Verified Findings

- `src/workspaces/platform/pages/PlatformAdminDashboard.tsx` still uses hardcoded stats and sample tenant data.
- `src/workspaces/platform/pages/panels/BillingPanel.tsx` still reads from `tenant_subscriptions` and `tenants`.
- `src/core/auth/components/TenantSlugGuard.tsx` still queries legacy `tenants` for platform impersonation lookups.
- `src/workspaces/organization_admin/hooks/useOrganizationDashboard.ts` still depends on `tenant_id`.
- Legacy tenant tables still remain heavily present in `src/database/schema.sql` and related SQL/debug files.

### Fix Order

1. Decide whether legacy tenant tables are temporary compatibility layers or the long-term admin abstraction.
2. Move platform dashboards and impersonation logic onto one declared model.
3. Replace hardcoded platform metrics with real queries.
4. Document and isolate any remaining tenant compatibility layer instead of letting it leak into unrelated flows.

### Exit Criteria

- Platform admin surfaces are backed by real data.
- Impersonation and cross-scope navigation use a documented model.
- Legacy tenant compatibility is intentional, isolated, and auditable.

---

## Phase 7: Background Jobs, Integrations, Observability, and Operations

### Goal

Make asynchronous work and production support tooling operational instead of scaffold-level.

### Current Verified Findings

- `scripts/background-worker.mjs` still only logs payloads for all registered job handlers.
- `src/core/utils/logger.ts` still has a production sink placeholder.
- `src/ui/components/ErrorBoundary.tsx` claims the error has been logged automatically, but `componentDidCatch` is empty.
- SMTP-based invite email delivery now exists and includes basic org-level hourly rate limits in the invite edge functions.

### Fix Order

1. Implement real worker handlers for queued job types.
2. Add retries, failure visibility, and operational handling beyond console logging.
3. Wire `logger` and `ErrorBoundary` into a real monitoring provider.
4. Add operator-facing runbooks for auth/email/job failures.

### Exit Criteria

- Background jobs perform real work.
- Failed async work is observable and actionable.
- Runtime exceptions are actually reported to a monitoring system.

---

## Phase 8: Security, QA, Performance, and Final Release Readiness

### Goal

Add the safety rails, verification, and performance work needed for a real launch.

### Current Verified Findings

- No test files or test framework configuration were found in the repo.
- No repository-level `.github` CI directory was found.
- Build passes, but the final `index` bundle is still over the Vite warning threshold at about 605.76 kB minified.
- Build warns that `src/app/App.tsx` is dynamically imported by `src/app/providers/AuthProvider.tsx` but also statically imported by `src/main.tsx`, so that dynamic import will not split a chunk.
- The dynamic import is currently at `src/app/providers/AuthProvider.tsx` where `clearAllCaches` is imported from `@/app/App`.
- Build also warns that Browserslist data is 9 months old.

### Fix Order

1. Add CI gates for:
   - lint
   - app typecheck
   - node typecheck
   - edge-function verification
   - build
2. Add smoke tests for:
   - auth
   - portal access control
   - major route existence
   - invitation acceptance
3. Extract `clearAllCaches` out of `App.tsx` so the dynamic-import warning can be removed cleanly.
4. Reduce main bundle size through route/chunk analysis.
5. Add environment validation, security headers, and deployment checks that are currently not visible in the repo.

### Exit Criteria

- CI blocks regressions before merge or deploy.
- Core user flows have smoke coverage.
- Edge functions are verified alongside the main app.
- Build warnings are reduced to intentional, understood exceptions only.

---

## Consolidated Critical Issues List

These are the highest-priority current issues before any public production launch:

1. Customer portal data is still scoped by email only.
2. Portal detail routes are still linked but not implemented.
3. Remember-me still does not match actual session persistence.
4. Active organization selection is still inconsistent between auth and organization providers.
5. Organization admin lint failures and placeholder deltas are still present.
6. Platform and org-admin flows still mix organization and legacy tenant models.
7. Public site still has fake contact submission, dead links, metadata gaps, and encoding defects.
8. Background worker, logger, and runtime error reporting are still mostly placeholders.
9. Edge functions are not part of the current typecheck path.
10. No tests or CI safety net exists in the repository.

## Suggested Engineering Execution Order

If the goal is the shortest safe path to production, the recommended engineering order is:

1. Phase 5 customer portal access-control fixes
2. Phase 2 auth/session and active-organization consistency fixes
3. Phase 8 verification expansion, lint cleanup, smoke tests, and CI
4. Phase 4 route cleanup for missing or dead user-facing paths
5. Phase 3 organization owner/admin completion
6. Phase 6 legacy tenant-model cleanup in platform and admin surfaces
7. Phase 1 public-site completion
8. Phase 7 worker, monitoring, and operational hardening

This execution order is intentionally different from the documentation order. The most urgent engineering work is still portal safety and auth consistency, not public-site polish.

## Final Readiness Standard

The app should be considered production ready only when:

- portal and tenant data cannot leak across organizations
- auth, invites, and organization selection are deterministic
- all primary user-facing routes are real and intentional
- owner/admin/platform surfaces are backed by real data and real actions
- background jobs and runtime errors are observable
- lint, typecheck, build, and smoke tests run in CI
- public-site content, legal paths, metadata, and submission flows are complete

Until then, the codebase is best described as materially improved from the earlier report in some auth/invitation areas, but still in pre-production hardening with several release-blocking issues unresolved.
