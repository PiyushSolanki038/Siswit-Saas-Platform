# Auth Debug Report

## Executive Summary

This audit reviewed the project auth system across invitation flows, self-signup, email verification, sign-in, role resolution, profile persistence, routing, and the relevant Supabase dashboard settings shown in the provided screenshots.

The main user-visible symptoms are:

- The invitation acceptance UI is oversized and feels too large for a standard single-page auth screen.
- Invitation signup appears to complete, but later sign-in can fail with invalid credentials.
- Full name is not reliably ending up in the expected database/auth display state.
- There are broader auth-system inconsistencies around invitation ownership, redirects, state transitions, and organization bootstrap behavior.

The highest-confidence root cause is that the project currently mixes two incompatible invitation models:

- Custom token acceptance pages:
  - `/auth/accept-invitation`
  - `/auth/accept-client-invitation`
- Supabase native invited-user creation through `admin.inviteUserByEmail`

This likely causes invited users to be pre-created in Supabase Auth before the custom accept page tries to create credentials again, which can produce confusing account state and later invalid-credential errors.

## Evidence Reviewed

### Confirmed from code

Repo files reviewed:

- `src/app/providers/AuthProvider.tsx`
- `src/workspaces/auth/pages/Auth.tsx`
- `src/workspaces/auth/pages/SignUp.tsx`
- `src/workspaces/auth/pages/AcceptEmployeeInvitation.tsx`
- `src/workspaces/auth/pages/AcceptClientInvitation.tsx`
- `src/workspaces/auth/components/InvitationShell.tsx`
- `src/core/api/client.ts`
- `src/core/auth/components/ProtectedRoute.tsx`
- `src/app/App.tsx`
- `src/app/providers/OrganizationProvider.tsx`
- `supabase/migrations/012_claim_pending_invitations.sql`
- `supabase/migrations/013_signup_profile_rpc.sql`
- `supabase/migrations/014_signup_organization_rpc.sql`
- `supabase/migrations/016_invitation_signup_rpcs.sql`
- `supabase/functions/send-employee-invitation/index.ts`
- `supabase/functions/send-client-invitation/index.ts`

Key observed implementation facts:

- Invitation acceptance pages use custom token validation RPCs and then call `supabase.auth.signUp(...)`.
- Invite creation in `AuthProvider` generates custom invitation URLs using `window.location.origin`.
- Both invite edge functions also call `admin.inviteUserByEmail(...)`.
- Full name is persisted through auth signup metadata and `create_signup_profile`.
- Sign-in uses password auth, then separately resolves role and membership state.
- Supabase client storage is configured with `sessionStorage`.
- `rememberMe` is collected in the sign-in UI but ignored by `AuthProvider.signIn`.
- `AuthProvider` prioritizes memberships, but `OrganizationProvider` picks the first returned membership row.

### Confirmed from screenshots

Supabase dashboard screenshots show:

- `Sign In / Providers`
  - Email provider enabled
  - Confirm email enabled
  - New user signup enabled
- `Rate Limits`
  - Email sending rate limit is `2 emails/hour`
- `Edge Functions`
  - `send-employee-invitation`
  - `send-client-invitation`
  - Both are deployed
- `URL Configuration`
  - Site URL is `http://localhost:8080`
  - Redirect allow-list contains only `https://127.0.0.1:3000`
- `Users`
  - Some display names are blank
  - At least one display name contains script-like content
  - Some users are still waiting for verification

### High-confidence inference

- The mixed invite architecture is the most likely explanation for invitation accounts that appear created but later reject the password set on the custom accept page.
- Redirect mismatches are very likely causing verification or reset flows to behave inconsistently in local development.
- Name inconsistency is likely caused by the system trying to treat both the custom accept flow and native Supabase invite flow as the same account-creation path when they are not.

## Confirmed Findings

### Invitation page UI is oversized

`InvitationShell.tsx` currently uses a very large visual treatment:

- Wide outer shell sizing
- Large left visual panel
- Large typography and spacing
- Fixed-feeling visual proportions meant more for a showcase landing panel than a compact auth screen

This makes the invitation page feel too big and less likely to fit comfortably in a standard laptop viewport without appearing overblown.

### Invitation auth flow is internally inconsistent

The invitation system is currently split between two competing ownership models:

- `AuthProvider` creates custom invitation links and validates them via custom RPCs.
- Invite edge functions call `admin.inviteUserByEmail`, which creates or initiates a Supabase-native invite lifecycle.

These two systems should not both own the same invitation acceptance path.

### Likely cause of invalid credentials after invitation acceptance

The current employee/client invitation acceptance path does this:

1. An invite is created in custom invitation tables.
2. A custom acceptance link is generated.
3. The edge function also invokes `admin.inviteUserByEmail`.
4. The user later visits the custom accept page.
5. The custom accept page calls `supabase.auth.signUp` again for the same email.

That can produce a state where:

- the invited user already exists in Supabase Auth from the native invite flow
- the password entered in the custom accept page is not the password actually governing the auth user the person later tries to sign into

This is the strongest likely explanation for the reported invalid-credentials problem after invitation signup.

### Name persistence is only partially implemented

Full name is currently passed into:

- auth signup metadata
- `create_signup_profile`

That means name storage exists, but it is not guaranteed to be unified for already-invited auth users that may have been created first through `inviteUserByEmail`.

As a result:

- profile data can be incomplete or inconsistent
- Supabase Auth display state can remain blank or stale
- the custom accept flow is not a reliable single source of truth once native invite creation has already occurred

### Supabase URL config is misaligned with the app

The application uses `window.location.origin` to build auth redirect URLs for:

- signup verification
- invitation flows
- password reset

The local app itself runs on `http://localhost:8080`, but the screenshot shows the redirect allow-list only contains `https://127.0.0.1:3000`.

This mismatch makes local verification/reset/invite redirects unreliable and may cause flows to fail, fall back incorrectly, or open the wrong origin.

### Email rate limit is too low for auth testing

The screenshot shows email sending is limited to `2 emails/hour`.

That is too low for active auth debugging because the project uses email for:

- verification
- resend verification
- password reset
- invitation delivery

This can easily create false negatives during testing.

### Remember me is misleading

The sign-in UI collects `rememberMe`, but:

- `AuthProvider.signIn` ignores that argument
- Supabase client storage is configured with `sessionStorage`

So the current system behaves as session-only auth regardless of the control shown in the UI.

### Organization selection is inconsistent for multi-membership users

There is a bootstrap inconsistency:

- `AuthProvider` picks a membership using explicit priority logic
- `OrganizationProvider` uses the first returned membership row

This can create mismatched organization context after sign-in for users who belong to more than one organization.

### Input sanitization is insufficient

Full-name input is passed through to persistence without strong normalization or sanitization.

The provided Supabase Users screenshot already shows script-like content in a display name field, which confirms unsafe user-controlled values have already been stored.

### Additional auth consistency risks

These are not the primary reported bug, but they are part of the overall auth instability:

- Pending approval navigation is split between `/auth/pending-approval` and `/pending-approval`.
- Documentation comments and runtime behavior around `pending_verification` vs `pending_approval` are not consistently described across flows.
- The current system relies heavily on post-sign-in repair logic instead of having a single clean source of truth for each auth path.

## Supabase Dashboard Audit

### Sign In / Providers

- Email auth is enabled.
- Confirm email is enabled.
- New user signup is enabled.

This is compatible with the custom signup design, but it must be aligned with the actual invitation architecture used by the app.

### Rate Limits

- Email sending rate limit is extremely low for active development.

Expected impact:

- verification resends may fail
- reset-password testing may fail
- invitation testing may appear broken even when code is correct

### URL Configuration

- Site URL matches the local Vite server port.
- Redirect allow-list does not match the actual local origin the code uses for redirect generation.

This is a confirmed environment/config problem and should be fixed alongside code stabilization.

### Users

The screenshot indicates multiple data-quality/auth-state issues:

- blank display names
- inconsistent display names
- unsafe script-like display-name content
- users still waiting for verification

These symptoms align with the repo findings around weak sanitization and fragmented account-creation paths.

### Edge Functions

The following functions are deployed and active:

- `send-employee-invitation`
- `send-client-invitation`

Both currently participate in the invitation flow and both currently use `admin.inviteUserByEmail`, which conflicts with the custom token-based acceptance pages.

## Flow-by-Flow Debug Notes

### Organization signup

Current flow:

1. Creates auth user with `supabase.auth.signUp`.
2. Persists profile via `create_signup_profile`.
3. Creates organization bundle via `create_signup_organization`.
4. Owner membership starts in `pending_verification`.
5. Later sign-in tries to promote state after email confirmation.

This path is relatively coherent compared with the invite paths.

### Client self-signup

Current flow:

1. Creates auth user.
2. Persists profile via `create_signup_profile`.
3. Creates membership through `create_client_signup_membership`.
4. Membership starts in `pending_verification`.
5. Sign-in later promotes client users to `pending_approval` after email confirmation.

This works conceptually, but the state model should be documented and enforced more clearly.

### Employee invitation

Current flow:

1. Dashboard creates invitation record in `employee_invitations`.
2. Custom invitation URL is generated.
3. Edge function also triggers native Supabase invite email.
4. Accept page validates token via custom RPC.
5. Accept page then calls `supabase.auth.signUp`.
6. Membership is created through `accept_employee_invitation_signup`.

This is the clearest place where the two invitation models collide.

### Client invitation

Current flow is structurally the same as employee invitation:

1. Dashboard creates client invitation record.
2. Custom invitation URL is generated.
3. Edge function also triggers native Supabase invite email.
4. Accept page validates custom token.
5. Accept page calls `supabase.auth.signUp`.
6. Membership is created through `accept_client_invitation_signup`.

This has the same core inconsistency and the same likely credential mismatch risk.

### Sign-in

Current sign-in flow:

1. Uses `supabase.auth.signInWithPassword`.
2. Resolves user access from memberships.
3. If no role is found, attempts `claim_pending_invitations`.
4. If role is `pending_verification`, checks whether email is now confirmed.
5. If confirmed, tries to promote membership state:
   - client -> `pending_approval`
   - employee/admin/manager/owner -> `active`

This means sign-in is doing both authentication and repair/reconciliation work, which increases fragility.

### Password reset

Password reset currently builds the redirect URL from `window.location.origin`:

- `/auth/reset-password`

So the active local or production origin must be present in Supabase redirect allow-lists for reset to work reliably.

## Fix Implementation Plan

### Phase 1: Stabilize invitation architecture

Choose one invitation model only.

Recommended choice:

- Keep the custom token-based invitation system already implemented in the repo.

Implementation direction:

- Remove `admin.inviteUserByEmail` usage from:
  - `supabase/functions/send-employee-invitation/index.ts`
  - `supabase/functions/send-client-invitation/index.ts`
- Keep edge functions only for sending plain custom invitation emails.
- Use the existing generated `invitationUrl` as the single invite acceptance entry point.

### Phase 2: Fix invite acceptance

- Ensure the accept pages are the only place invited users create credentials.
- Preserve the existing token validation RPCs and membership RPCs.
- After successful signup, persist name in one consistent way for:
  - `public.profiles`
  - auth user metadata/display identity
- Make invited-user creation and invited-user password setup a single coherent path.

### Phase 3: Fix redirect configuration

Align Supabase redirect allow-lists with the actual app origins.

For local development, include at minimum:

- `http://localhost:8080/auth/sign-in`
- `http://localhost:8080/auth/reset-password`
- any other active local auth callback URL used by the app

Also:

- keep production Site URL aligned with the deployed frontend origin
- ensure all production auth redirect URLs are explicitly allowed

### Phase 4: Fix invitation UI sizing

- Reduce invitation shell max width.
- Reduce large hero-panel sizing and oversized spacing.
- Scale headings and padding down for auth context.
- Make the full invitation page fit cleanly within a standard laptop viewport without feeling cropped or oversized.

### Phase 5: Clean up auth UX inconsistencies

- Either implement real persistent remember-me behavior or remove the UI control.
- Unify primary organization selection logic between:
  - `AuthProvider`
  - `OrganizationProvider`
- Normalize pending-approval route usage so one canonical route is used throughout guards and redirects.

### Phase 6: Harden input handling

- Normalize and sanitize full-name input before persistence.
- Reject clearly unsafe name values.
- Backfill or clean previously stored unsafe display-name/profile data if needed.
- Ensure profile persistence and auth metadata updates follow the same validation rules.

## Recommended Test Cases

### Employee invite

- Create an employee invite.
- Open the custom invite link.
- Set a password.
- Verify email.
- Sign in successfully with that password.
- Confirm membership state transitions correctly.

### Client invite

- Create a client invite.
- Open the custom invite link.
- Set a password.
- Verify email.
- Confirm portal or pending-approval behavior is correct.

### Organization signup

- Verify auth user is created.
- Verify profile row is created.
- Verify organization and owner membership are created.
- Verify post-verification sign-in works.

### Client self-signup

- Verify membership is created.
- Verify post-verification routing is correct.
- Verify client transitions to `pending_approval` when expected.

### Password reset

- Request password reset.
- Open reset link.
- Verify reset page loads correctly on the active origin.
- Verify new password works on sign-in.

### Name persistence

- Verify full name appears consistently in:
  - `public.profiles`
  - auth-visible identity data or metadata used by the app

### Multi-membership user

- Verify the same organization is chosen consistently after sign-in for:
  - role resolution
  - provider bootstrap
  - routing

### UI

- Verify the invitation page fits a standard laptop viewport and no longer feels oversized.

## Assumptions

- File path for this report is `docs/auth-debug-report.md`.
- This report is diagnostic only and does not apply code or SQL fixes.
- Findings are evidence-backed and intentionally concise.
- The invitation/password issue is labeled `high-confidence` rather than `definitively proven` because live auth logs were not part of this audit.
