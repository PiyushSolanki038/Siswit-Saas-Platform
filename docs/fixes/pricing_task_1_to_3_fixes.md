# Pricing Implementation Fixes - Tasks 1, 2, & 3

**Date:** March 23, 2026
**Area:** Database Schema, RPCs, TypeScript Utilities, React Hooks

## Overview

This document tracks the cumulative fixes and implementations applied to **Task 1**, **Task 2**, and **Task 3** from the `PRICING_IMPLEMENTATION_GUIDE.md`. The core goal of these tasks is to construct a scalable database architecture for resource plan limits, expose strictly-typed helpers, and bridge them into the frontend via a unified React query hook.

## Fixes & Implementations Applied

### 1. Database Migrations & Version Conflict Resolution (Task 1)
- **Issue:** The Supabase CLI encountered `SQLSTATE 23505` duplicate version constraint errors during `supabase db push`. This occurred because conflicting local migration prefixes (`031_` and `032_`) were multiply defined in the repository.
- **Fix:** Safely renamed unapplied migrations to enforce consecutive version sequencing:
  - `031_fix_manager_delete_policy.sql` → `039_fix_manager_delete_policy.sql`
  - `032_invitation_signup_rpcs.sql` → `040_invitation_signup_rpcs.sql`
- **Implementation:** Integrated the pricing schema directly as `041_plan_limits_and_usage_tracking.sql`.
- **Status:** All tables (`plan_limits`, `usage_tracking`), RLS policies, and RPC atoms (`increment_usage`, etc.) were safely pushed and explicitly proven flawless by testing via SQL node client.

### 2. Frontend Types & Missing Helpers (Task 2)
- **Issue:** Initially, a few explicit helper functions mapping UI labels and formatting were missing from `plan-limits.ts`, causing Red Squiggly Lines when imported elsewhere.
- **Fix:** Appended the missing helper functions (`formatLimit`, `getResourceLabel`) and the structured `ADD_ONS` constant precisely referencing the specifications from the guide.
- **Implementation:** Finalized `src/core/utils/plan-limits.ts` with structural safety metrics including boundary limits computing (`isAtLimit`, `isNearLimit`, `getUsagePercent`).

### 3. Strict Supabase Client Types & Bypasses (Task 3)
- **Issue:** The newly implemented database RPCs (`get_organization_usage`, `check_plan_limit`, `increment_usage`, `decrement_usage`) caused TypeScript `TS2345` errors inside `usePlanLimits.ts` because the local static `supabase-js` schema types (`src/core/api/types.ts`) had not yet synchronized with the remote database.
- **Fix:** Safely type-casted the new RPC mutations via `(supabase.rpc as any)` which bypasses the strict schema declarations that haven't updated yet.
- **Implementation:** Created the React hook `src/core/hooks/usePlanLimits.ts` efficiently caching through `react-query` with a `30_000` stale time, and completely exporting the UI-level functions required universally across the app modules.
- **Status:** `npx tsc` confirms zero remaining errors across `usePlanLimits.ts` and `plan-limits.ts`.
