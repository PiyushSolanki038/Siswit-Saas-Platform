# Production Readiness Pending Task Report

Date: 2026-03-14
Project: Sunny SISWIT
Prepared from: current repository inspection, current build/typecheck/lint verification, and selective comparison against older internal reports

## Important Context

This document is intended to be the current pending-task report for taking the project to production readiness.

Older documents such as:

- `docs/auth-debug-report.md`
- `docs/loginSystem.md`
- `docs/Release-Notes-2026-03-10.md`

were treated as historical references only. They were not treated as source of truth, because some items in those reports have already been fixed while other items still remain.

This report is based on the code that exists now.

## Current Verified State

Verified directly from the current codebase:

- `npm run build`: passes
- `npx tsc --noEmit -p tsconfig.app.json`: passes
- `npx tsc --noEmit -p tsconfig.node.json`: passes
- `npm run lint`: fails

Current lint blockers still present:

- `src/workspaces/organization_admin/pages/OrganizationAdminDashboard.tsx`: multiple `any` usages
- `src/app/App.tsx`: `react-refresh/only-export-components` warning

## Executive Summary

The project already has broad product coverage and a strong amount of UI surface area, but it is not yet production ready. The highest-risk items are not visual polish issues. The main blockers are data isolation, incomplete auth and invitation architecture, missing route coverage, placeholder background processing, legacy migration seams, and missing operational safeguards.

The most important production blockers are:

1. Customer portal data is filtered by email in several places instead of by active organization plus user identity, which creates a cross-tenant data exposure risk.
2. Invitation and account activation logic is still split between custom token acceptance pages and Supabase native invite calls, which can create inconsistent onboarding behavior.
3. Several pages link to routes that do not exist, which will cause broken user journeys in production.
4. Important admin/platform flows are still partially based on legacy tenant tables or placeholder sample data.
5. Background jobs, monitoring, analytics, error reporting, and production logging are not fully implemented.
6. The public website still contains placeholder links, simulated contact behavior, metadata gaps, and content/encoding issues.
7. There is no meaningful automated test safety net yet.

## Release Gate Recommendation

Do not treat the app as production ready until all of the following are done:

- Fix cross-organization data scoping in the customer portal.
- Unify invitation, signup, password reset, and post-login membership resolution logic.
- Remove or implement all dead routes and placeholder links in user-facing paths.
- Complete at least one real platform-admin data model path instead of mixed legacy and sample-driven behavior.
- Implement real background worker behavior for email, notifications, and async document tasks.
- Add error monitoring, audit verification, and deployment-grade environment validation.
- Bring lint to passing and add at least smoke-level automated tests for critical flows.

## Recommended Delivery Phases

The phases below are ordered to match the requested review order: public marketing pages first, then login and auth, then the rest of the product.

---

## Phase 1: Marketing Site and Public-Facing UI

### Goal

Make the public website credible, complete, accurate, and ready to convert visitors into real leads without broken UX.

### Current Findings

- Public pages exist for home, about, pricing, products, solutions, and contact.
- The site looks polished overall, but several production details are still unfinished.
- `src/workspaces/website/pages/Contact.tsx` simulates form submission with a timeout and toast instead of persisting or routing leads anywhere.
- Public footer and other public CTAs still contain `#` links rather than real destinations.
- `index.html` metadata still reflects an older product story and does not fully match the current app breadth.
- The Open Graph image still points to a `lovable.dev` asset.
- No sitemap file or web manifest was found.
- `public/robots.txt` exists, but there is no sitemap reference.
- Some strings still contain encoding corruption such as `â`, `Â`, or malformed currency symbols.
- Footer branding has at least one visible name typo: `SITWIT`.
- Marketing content is hardcoded and includes product stats/claims that should be verified before public launch.
- No analytics or conversion instrumentation was found.

### Pending Tasks

- Replace simulated contact form behavior with a real submission flow.
- Decide the lead destination path:
  - direct Supabase table
  - CRM lead creation
  - email-to-sales relay
  - webhook to external automation
- Add validation, spam protection, abuse throttling, and submission error handling to the contact form.
- Replace all `#` links with real pages or remove the CTA until the destination exists.
- Create real legal/support pages:
  - privacy policy
  - terms of service
  - cookie policy
  - support/contact details
  - status page or status placeholder policy
- Normalize all public copy and fix all visible encoding issues.
- Review all public claims, numbers, and pricing language for factual correctness.
- Update `index.html` metadata:
  - title
  - description
  - canonical domain
  - Open Graph image
  - Twitter card metadata
- Add per-route SEO metadata if public pages are intended to rank independently.
- Add sitemap generation and update `robots.txt`.
- Add favicon, manifest, and social-sharing asset verification.
- Check all responsive states, especially hero sections, mobile nav, pricing cards, and contact page layouts.
- Audit accessibility:
  - heading structure
  - focus states
  - color contrast
  - keyboard navigation
  - reduced-motion behavior
  - form labels and error messages
- Add analytics and conversion events for:
  - hero CTA clicks
  - pricing CTA clicks
  - contact form submit
  - sign-in and sign-up starts

### Fix Implementation Approach

- Build a real `contact_submissions` or `marketing_leads` pipeline first.
- Replace placeholder links page by page instead of leaving a mixed state.
- Run a dedicated copy and encoding pass across all public pages and shared layout components.
- Introduce a small SEO utility for public routes so metadata is not trapped in `index.html` only.
- Add analytics only after route names and CTA destinations are finalized.

### Exit Criteria

- No dead public links remain.
- Contact form creates a real record or real outbound action.
- Public metadata matches the current product.
- No visible encoding corruption remains.
- Legal, support, and SEO basics are in place.
- Public pages pass mobile and accessibility QA.

---

## Phase 2: Login, Authentication, Invitations, and Session Logic

### Goal

Make authentication predictable, secure, tenant-aware, and production safe across direct sign-in, signup, password reset, and invitation acceptance.

### Current Findings

- Auth pages exist and are visually mature.
- `src/app/providers/AuthProvider.tsx` still accepts `rememberMe`, but session persistence in `src/core/api/client.ts` uses `sessionStorage`, so the UX promise does not match actual behavior.
- Invitation acceptance pages still use custom token validation plus `supabase.auth.signUp`.
- Supabase edge functions for invitations still call `admin.inviteUserByEmail`.
- This means invitation architecture is still mixed rather than unified.
- Membership selection is not fully consistent:
  - `AuthProvider` resolves a prioritized membership choice
  - `OrganizationProvider` still falls back to `rows[0]` as primary organization
- `src/core/auth/components/TenantSlugGuard.tsx` still depends on a legacy `tenants` lookup path for platform-admin access/impersonation support.
- Redirect generation for auth-related flows depends on `window.location.origin`, which is fragile for multi-environment deployment and callback allow-list management.
- Error tracking inside auth flows is minimal.
- Input normalization and sanitization for names and organization fields should be tightened.

### Pending Tasks

- Decide and implement one invitation architecture only.
- Remove the split between native Supabase invite behavior and custom invitation acceptance behavior.
- Define a single source of truth for:
  - employee invitations
  - client invitations
  - account activation
  - membership assignment
  - role assignment
  - post-login landing behavior
- Implement true remember-me behavior or remove the control from the UI.
- Normalize session persistence strategy across browser refresh, logout, and multi-tab behavior.
- Refactor membership resolution so the same active organization logic is used everywhere.
- Remove remaining legacy tenant lookup dependencies from auth and tenant slug guard logic, or isolate them behind an intentional compatibility adapter.
- Replace `window.location.origin` callback generation with environment-aware app URL configuration.
- Verify Supabase auth settings for:
  - redirect URLs
  - site URL
  - invite expiry
  - password reset redirect
  - rate limits
  - email templates
- Add defensive validation to sign-up and invitation forms.
- Add consistent audit logging for:
  - sign in
  - sign out
  - invite created
  - invite accepted
  - invite expired
  - password reset requested
  - password changed
- Add richer auth error states so users do not get dropped into generic failures.

### Fix Implementation Approach

- First choose the durable auth model.
- Recommended direction: keep invitation ownership in app tables and use one deterministic acceptance flow, instead of partially delegating to a separate native invite path.
- Centralize organization and role resolution in one auth/session service so route guards, nav, and post-login redirects all consume the same active-context result.
- Add an environment config layer for callback URLs before changing invite/reset links.
- Only after the model is stable, clean up the invitation pages and edge functions together.

### Exit Criteria

- One invitation system is active.
- Remember-me behavior matches what the UI says.
- Users with multiple memberships land in the correct organization consistently.
- All auth redirects work in local, staging, and production.
- Invite, signup, reset, and login flows are audit-logged and test-covered.

---

## Phase 3: Organization Owner and Organization Admin Workspaces

### Goal

Turn the organization management area from partially complete admin UI into a dependable control plane for real customers.

### Current Findings

- The organization owner workspace has useful coverage for overview, users, invitations, approvals, plans, alerts, and settings.
- Some screens are still presentational or only partially actionable.
- `src/workspaces/organization/pages/OrganizationSettingsPage.tsx` is effectively read-only and marked as soon/coming soon.
- `src/workspaces/organization/pages/OrganizationPlansPage.tsx` has disabled plan and billing actions.
- `src/workspaces/organization/pages/OrganizationOverviewPage.tsx` includes non-essential placeholder utility behavior such as focus-mode UI.
- The organization admin area still contains lint failures and display logic driven partly by placeholders.
- `src/workspaces/organization_admin/pages/OrganizationAdminDashboard.tsx` uses multiple `any` values and at least some derived metrics or progress displays are not real operational values.
- `src/workspaces/organization_admin/hooks/useOrganizationDashboard.ts` still reflects tenant-era query assumptions.

### Pending Tasks

- Bring the organization admin dashboard to typed, lint-clean, production-safe code.
- Remove fake or randomly generated operational signals from dashboards.
- Replace hardcoded growth or trend deltas with real computed metrics or remove them until ready.
- Finish organization settings:
  - profile editing
  - branding/logo upload
  - timezone
  - notification preferences
  - billing contacts
- Finish organization plans/billing:
  - real plan data
  - billing status
  - upgrade/downgrade path
  - invoice/history access
- Complete invitation management:
  - resend invite
  - revoke/cancel invite
  - expiration handling
  - status timeline
  - bulk invite UX
- Complete approvals management with clear states, actor attribution, and auditability.
- Add pagination, filtering, and bulk actions for users and invites.
- Align organization owner and organization admin data definitions so they are not pulling from mismatched legacy structures.
- Ensure all organization-level actions are properly scoped to the active organization ID.

### Fix Implementation Approach

- Remove placeholder dashboard signals first so data trust improves immediately.
- Finish settings and billing next because those are common launch blockers for real customers.
- Then expand invitation, approval, and user-management workflows with audit trail support.
- Use the active organization context from the auth/session layer instead of re-deriving organization identity in multiple places.

### Exit Criteria

- Organization settings can be edited and saved.
- Plans/billing screens reflect real billing state.
- User/invite/approval actions are complete and audit-safe.
- No random or placeholder operational metrics remain.
- Organization admin dashboard passes lint and type review.

---

## Phase 4: Employee Workspace and Product Modules

### Goal

Make the internal operational modules functionally complete, route-consistent, and safe for real business usage.

### Cross-Cutting Findings

- The workspace router supports many module areas, but some module pages still link to routes that do not exist.
- Legacy `/dashboard/*` routing remains as a compatibility layer, which helps short term but increases long-term navigation drift.
- Soft delete support exists in shared utilities, but many module reads explicitly bypass it with `hasSoftDelete: false`.
- This raises the risk of deleted records reappearing in lists or analytics.

### Cross-Cutting Pending Tasks

- Standardize navigation on canonical tenant-scoped routes instead of relying on legacy redirect paths.
- Audit all module list queries for deleted-record filtering.
- Introduce shared patterns for:
  - pagination
  - empty states
  - skeleton/loading states
  - retry/error states
  - optimistic updates
  - permission checks
  - audit logging
  - import/export handling
  - file upload/storage handling

### CPQ Findings and Tasks

Current findings:

- `src/modules/cpq/pages/CPQDashboard.tsx` links to `/dashboard/cpq/pricing`, but there is no matching route in `src/app/App.tsx`.
- Quote creation and detail pages exist and appear more complete than some other modules.
- Some display copy still contains encoding issues.

Pending CPQ tasks:

- Implement the pricing route or remove the dashboard link.
- Validate quote lifecycle completeness:
  - draft
  - edit
  - approve
  - send
  - convert
  - archive
- Verify customer ownership and organization scoping on all quote queries.
- Add stronger validation around pricing math, discounts, taxes, currency formatting, and approval thresholds.
- Add export/share/send coverage and audit events.

### CLM Findings and Tasks

Current findings:

- `src/modules/clm/pages/CLMDashboard.tsx` contains mismatched labels such as product/quote language in a contract module context.
- Several CLM pages exist in the repository but are not wired into the app router.
- Links exist to routes such as `/dashboard/clm/contracts/new` and `/dashboard/clm/pending` without matching current routes in `src/app/App.tsx`.

Pending CLM tasks:

- Decide the real CLM route map and wire it fully into `App.tsx`.
- Connect contract list, builder, detail, scan, and e-sign flows through actual routes.
- Fix mislabeled CTA copy in the CLM dashboard.
- Verify contract state transitions and permissions.
- Add document generation, review history, approval workflow, and signing-state coverage end to end.

### CRM Findings and Tasks

Current findings:

- CRM has good page coverage for leads, pipeline, accounts, contacts, opportunities, and activities.
- The data hooks are serviceable but still need production hardening.

Pending CRM tasks:

- Audit all queries for organization scope and soft-delete filtering.
- Add pagination and large-dataset handling.
- Add stricter input validation for names, contact data, stages, and revenue values.
- Verify ownership and assignment logic for sales users.
- Add import/export and deduplication rules if CRM data is customer-facing or high volume.

### Documents Findings and Tasks

Current findings:

- The documents area is more connected than some other modules, but still depends on shared legacy patterns.
- Some hooks use fallback behavior that should be normalized before production.

Pending Documents tasks:

- Standardize document ownership and permission checks.
- Verify upload, storage, preview, download, and delete flows against real storage policies.
- Add virus-scan or file-type validation strategy if uploads are public or external.
- Confirm soft-delete and retention behavior for document records.

### ERP Findings and Tasks

Current findings:

- ERP sections exist for inventory, procurement, production, and finance.
- The workflow breadth is present, but production-grade validation and traceability need review.

Pending ERP tasks:

- Validate stock adjustment, procurement, production, and finance write paths.
- Add guardrails for negative inventory, duplicate transactions, and invalid status transitions.
- Add reconciliation and audit views for important ERP mutations.
- Confirm role-based access for finance-sensitive operations.

### Exit Criteria

- All module links resolve to real routes.
- Deleted records do not leak into normal list views.
- Core modules have real validation, permission checks, and audit events.
- Module dashboards only show real, supportable actions.

---

## Phase 5: Customer Portal

### Goal

Make the external customer-facing portal safe, scoped, and reliable for quotes, contracts, documents, and signatures.

### Current Findings

- The portal includes dashboard, quotes, contracts, documents, templates, approvals, and pending signatures screens.
- Several portal queries are filtered only by email address, including quotes, contracts, and signature records.
- This is the single most serious production risk found in the code review because it can expose another organization's records to the wrong customer if email reuse occurs.
- The portal contains links to detail routes that do not exist:
  - `/portal/quotes/:id`
  - `/portal/contracts/:id`
  - `/portal/pending-signatures/:id`
- Portal settings currently redirect back instead of opening a real settings experience.
- Some portal text still contains encoding corruption.

### Pending Tasks

- Replace email-only portal filtering with organization-aware and identity-aware access rules.
- Define the correct customer portal data model:
  - active organization
  - customer identity
  - allowed records
  - signer identity
  - document access boundaries
- Review database policies for quotes, contracts, documents, and signatures to ensure they cannot be fetched across organizations.
- Implement real detail routes for portal quotes, contracts, and pending signatures or remove the links.
- Audit all portal actions for organization scoping, not just dashboard counts.
- Add customer-safe error states and "no access" handling.
- Implement portal settings or remove the nav item until ready.
- Verify document download permissions and signed-document visibility.
- Add notification and activity history for customer actions.

### Fix Implementation Approach

- Treat this phase as a release blocker, not a later polish task.
- Start by defining a customer-to-organization mapping that is enforced in every portal query.
- Then rewrite portal dashboard and list queries to use the same shared access helper.
- Only after scoping is correct, add the missing detail routes and UX polish.

### Exit Criteria

- Portal data cannot leak across organizations.
- Every portal link resolves to a real destination.
- Customer-facing permissions are enforced at both query and UI levels.
- Portal settings/status/history behavior is intentional, not placeholder.

---

## Phase 6: Platform Admin and Legacy Migration Cleanup

### Goal

Make the top-level platform administration area trustworthy and aligned with the current organization-based architecture.

### Current Findings

- `src/workspaces/platform/pages/PlatformAdminDashboard.tsx` still contains sample-style content.
- Platform admin panels still rely on legacy structures such as `tenants`, `tenant_users`, and `tenant_subscriptions`.
- This is consistent with the broader migration state of the codebase, but it means the platform layer is not yet a clean production control surface.
- `src/workspaces/platform/panels/SettingsPanel.tsx` is informational rather than fully functional.

### Pending Tasks

- Decide whether legacy tenant tables are temporary compatibility layers or long-term admin abstractions.
- If temporary, define the migration completion plan and retire the old query paths.
- If long-term, formalize and document the compatibility contract.
- Replace sample dashboard metrics with real platform metrics.
- Build production-grade platform admin actions for:
  - organization lookup
  - user lookup
  - subscription/billing review
  - audit review
  - impersonation or support access
- Verify impersonation rules, logging, and safety controls.
- Align platform analytics and billing with the actual organization model.
- Add admin-only protections and stronger auditing for all elevated actions.

### Fix Implementation Approach

- First resolve the data model question.
- After that, migrate platform panels one by one from legacy or sample-driven logic to real services.
- Add admin audit logging and support tooling before enabling any sensitive impersonation workflows in production.

### Exit Criteria

- Platform admin is backed by real data.
- Legacy migration status is intentional and documented.
- Admin actions are auditable and safe.

---

## Phase 7: Background Jobs, Integrations, Observability, and Operations

### Goal

Make async work, production monitoring, and operational support reliable enough for real customer usage.

### Current Findings

- `src/core/utils/jobs.ts` provides job-enqueue behavior, but `scripts/background-worker.mjs` currently only logs payloads rather than performing complete production work.
- Email-related edge functions exist, but invite delivery strategy is still mixed.
- `src/core/utils/logger.ts` has a production sink placeholder rather than a complete telemetry integration.
- `src/ui/components/ErrorBoundary.tsx` does not currently report runtime failures to a monitoring system.
- No full observability stack was found.

### Pending Tasks

- Implement the real background worker responsibilities:
  - email delivery
  - reminders
  - contract expiry checks
  - notification fan-out
  - document processing tasks
- Add retry, lock, failure visibility, and dead-letter handling for background jobs.
- Decide which provider stack will be used for production email and alerting.
- Wire real logging and error monitoring:
  - Sentry
  - Datadog
  - Logtail
  - or equivalent
- Add structured logs for important workflows.
- Report exceptions from error boundaries and async handlers.
- Add uptime and service health monitoring.
- Add analytics for product usage beyond the marketing site.
- Create operational runbooks for:
  - failed invites
  - stuck jobs
  - email provider downtime
  - document processing failures
  - auth callback misconfiguration

### Fix Implementation Approach

- Prioritize logging and error reporting first so later phase changes are observable.
- Then implement worker execution and retries.
- Finally, add alerting and runbooks for operational support.

### Exit Criteria

- Background jobs perform real work.
- Failures are observable and actionable.
- Runtime exceptions reach a monitoring platform.
- Operators have enough telemetry to support customers.

---

## Phase 8: Security, Performance, QA, and Final Release Readiness

### Goal

Add the safety rails, performance improvements, and validation steps needed to support an actual launch.

### Current Findings

- Main build currently succeeds, but the largest JavaScript chunk is above the Vite warning threshold.
- A dynamic-import warning is present around `App.tsx` usage.
- No meaningful automated test suite was found.
- There is no confirmed CI gate for lint, typecheck, build, and smoke tests.
- Security-related hardening such as CSP, rate limiting, secret handling review, and deployment checklists are not fully visible in repo-level implementation.

### Pending Tasks

- Bring lint to green.
- Split or lazy-load large bundles more aggressively.
- Resolve the dynamic import warning.
- Add automated tests:
  - auth smoke tests
  - invitation acceptance tests
  - portal access-control tests
  - critical module happy paths
  - route existence checks for major CTAs
- Add CI gates for:
  - lint
  - typecheck
  - build
  - tests
- Add environment validation for required secrets and URLs.
- Audit `.env` handling and secret exposure practices.
- Add content security policy and security headers.
- Add rate limiting and abuse protection for public forms and auth endpoints.
- Review row-level security and access policies across every multi-tenant table.
- Perform bundle analysis and optimize heavy routes.
- Run browser QA across:
  - Chrome
  - Edge
  - Firefox
  - Safari
  - mobile Safari
  - mobile Chrome
- Run role-based UAT for:
  - public visitor
  - employee
  - organization owner
  - organization admin
  - platform admin
  - customer portal user
- Create a production launch checklist and rollback plan.

### Fix Implementation Approach

- Start by making the codebase gateable: lint, typecheck, build, and minimal tests in CI.
- In parallel, fix access-control tests around the portal and auth flows.
- Then address bundle optimization and deployment hardening.
- Finish with UAT, launch checklist, and rollback rehearsal.

### Exit Criteria

- CI gates block regressions.
- Core flows are covered by automated smoke tests.
- Security and deployment configuration are reviewed and documented.
- Performance is acceptable on both desktop and mobile.
- The team has a clear launch and rollback process.

---

## Consolidated Critical Issues List

These are the highest-priority issues to fix before any public production launch:

1. Portal email-only data scoping can expose cross-organization customer data.
2. Auth and invitation system still mixes two onboarding models.
3. Several user-facing routes are linked but not implemented.
4. Organization and platform admin areas still contain placeholders or legacy migration seams.
5. Background worker is not performing real production tasks.
6. Lint is failing today.
7. Public site still contains dead links, fake contact submission, metadata gaps, and encoding defects.
8. No real automated test safety net is in place.

## Suggested Execution Order

If the team wants the shortest path to a safe production launch, the recommended order is:

1. Phase 5 customer portal data isolation fixes
2. Phase 2 auth and invitation unification
3. Phase 8 lint, tests, CI, and security hardening
4. Phase 7 logging, monitoring, and background workers
5. Phase 1 public-site completion
6. Phase 3 organization owner/admin completion
7. Phase 4 module route and workflow hardening
8. Phase 6 platform admin migration cleanup

This ordering is different from the documentation order on purpose. The documentation order starts with the marketing site as requested, but the safest engineering release order starts with data isolation and auth.

## Final Readiness Standard

The project should be considered production ready only when:

- all user-facing routes are real and intentional
- all multi-tenant data paths are organization-safe
- auth and invites are unified and deterministic
- admin and portal actions are auditable
- background jobs and email delivery are operational
- monitoring and logging are live
- lint, build, typecheck, and smoke tests pass in CI
- public site content, legal pages, and SEO are complete

Until then, the app is best described as feature-rich and promising, but still in pre-production hardening.
