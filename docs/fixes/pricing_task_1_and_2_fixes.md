# Pricing Implementation Fixes - Task 1 & 2

**Date:** March 23, 2026
**Area:** Database Schema, RPCs, TypeScript Utilities

## Overview

This document tracks the fixes and implementations applied for **Task 1** and **Task 2** of the `PRICING_IMPLEMENTATION_GUIDE.md`. The core goal of these tasks is to establish a secure database schema for tracking organization plan limits and resource usages, and mapping these securely to frontend utilities.

## Fixes & Implementations Applied

### 1. Database Migrations & Conflict Resolution
- **Issue:** Supabase CLI encountered duplicate version constraint errors during `supabase db push` due to conflicting local migration prefixes (`031_` and `032_` were used multiply).
- **Fix:** Renamed existing unapplied migrations to enforce strict version sequencing:
  - `031_fix_manager_delete_policy.sql` → `039_fix_manager_delete_policy.sql`
  - `032_invitation_signup_rpcs.sql` → `040_invitation_signup_rpcs.sql`
- **Implementation:** Created the target pricing migration as `041_plan_limits_and_usage_tracking.sql`.
- **Status:** All migrations were safely pushed and verified against the remote database.

### 2. Plan Limits & Usage Tracking Tables (Task 1)
- **Implementation:** Created the `plan_limits` and `usage_tracking` tables with strict referential integrity mapped to the `organizations` table.
- **Security:** Enabled `ROW LEVEL SECURITY` (RLS) policies correctly mapping `plan_limits_select`, `insert`, `update`, and `delete` across platform super admins and organization roles.
- **RPCs Added:**
  - `seed_plan_limits_for_organization()`: Successfully tested setting up 11 resources (contacts, accounts, leads, opportunities, quotes, etc.) when an organization is created.
  - `check_plan_limit()`, `increment_usage()`, `decrement_usage()`, `get_organization_usage()`: Verified functional atomicity constraints bounding usage limits natively within the database transactions.

### 3. Frontend Types & Constants (Task 2)
- **File Created:** `src/core/utils/plan-limits.ts`.
- **Types Exported:** `PlanType`, `ResourceType`, `LimitPeriod`, `PlanLimitEntry`, `UsageEntry`, `PlanLimitCheckResult`, and `UsageIncrementResult`.
- **Constants Exported:** `PLAN_PRICES` mapping all 4 plan tiers respectively to ₹799, ₹1,399, ₹2,299, and ₹3,799 along with `PLAN_LIMITS` fully encapsulating all tier capacities. 
- **Helpers Tested:** `getLimit()`, `isUnlimited()`, `getUsagePercent()`, `isNearLimit()` (at 80%), `isAtLimit()`, and `getUpgradePlanFor()` passing edge limitations smoothly without unexpected NaNs or false limits on infinite integers.
