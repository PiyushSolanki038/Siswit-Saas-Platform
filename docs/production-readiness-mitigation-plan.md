# Production Readiness Mitigation Plan & Fix Report

**Date:** 2026-03-20
**Project:** Sunny SISWIT
**Status:** Pre-Production Hardening

## Overview
This document outlines the remaining critical issues identified during the repository audit on March 20, 2026. It provides a structured fixing order and specific code migration steps required to reach production-grade stability.

---

## 1. Critical Issues & Problem Map

### A. Technical Debt & CI Blockers
| Problem | Path | Fix Required |
| :--- | :--- | :--- |
| **Lint Failures (`any` usage)** | `src/workspaces/portal/pages/PortalDashboard.tsx` | Define and apply TypeScript interfaces for Supabase results. |
| **Lint Failures (`any` usage)** | `src/workspaces/website/pages/Contact.tsx` | Remove `as any` from database insert and error handling. |
| **Simulated Background Work** | `scripts/background-worker.mjs` | Implement actual handlers for email/PDF instead of `console.log`. |

### B. Public Site & Brand Integrity
| Problem | Path | Fix Required |
| :--- | :--- | :--- |
| **External Brand Metadata** | `index.html` | Replace `lovable.dev` OG/Twitter images with project assets. |
| **Dead Links in Footer** | `src/workspaces/website/components/layout/Footer.tsx` | Replace `#` with real routes for Legal/Docs. |
| **Missing Legal Pages** | `src/app/App.tsx` | Implement and route Privacy, Terms, and Cookie policy pages. |

### C. Operational Safeguards
| Problem | Path | Fix Required |
| :--- | :--- | :--- |
| **No Production Telemetry** | `src/core/utils/logger.ts` | Replace console structural logging with a Sentry/Datadog sink. |
| **Hardcoded Dashboard Deltas**| `src/workspaces/organization_admin/pages/OrganizationAdminDashboard.tsx` | Calculate "Growth" percentages from real data or hide them. |

---

## 2. Recommended Fixing Order (Prioritized)

1.  **Phase 1: CI Stability (Lint & Types)**
    *   Bringing the codebase to "Green" is essential for reliable deployment.
2.  **Phase 2: Operational Reliability (Worker & Telemetry)**
    *   Emails must actually send and errors must be reported to a monitoring service.
3.  **Phase 3: Public Readiness (Metadata & Legal)**
    *   Finalize the "front door" of the application before driving traffic.
4.  **Phase 4: Data Accuracy (Dashboard Polishing)**
    *   Ensure all user-facing metrics are derived from real state.

---

## 3. Specific Code Migration Guide

### 1. Fix Lint Errors in `Contact.tsx`
**File:** `src/workspaces/website/pages/Contact.tsx`

**Current State (Problematic):**
```tsx
const { error } = await (supabase
  .from("contact_inquiries" as any)
  .insert([{ ... }]) as any);
```

**Target State (Fixed):**
```typescript
// Define the type in a separate schema file or locally
interface ContactInquiry {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company: string;
  interest: string;
  message: string;
}

// In the component:
const { error } = await supabase
  .from("contact_inquiries")
  .insert([formData as ContactInquiry]);
```

### 2. Implement Real Handlers in `background-worker.mjs`
**File:** `scripts/background-worker.mjs`

**Current State (Problematic):**
```javascript
"email.send": async (job) => {
  // TODO: Integrate with Supabase Edge Function 'send-email'
  console.log(`[job:${job.id}] email.send`, job.payload);
},
```

**Target State (Fixed):**
```javascript
"email.send": async (job) => {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: job.payload,
  });
  if (error) throw new Error(`Email failed: ${error.message}`);
},
```

### 3. Update Social Metadata
**File:** `index.html`

**Current State (Problematic):**
```html
<meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
```

**Target State (Fixed):**
```html
<meta property="og:image" content="https://siswit.com/assets/og-brand-image.png" />
```

### 4. Enable Production Logging
**File:** `src/core/utils/logger.ts`

**Current State (Problematic):**
```typescript
// Production sink: For now, we log to console in a structured way
console.log(JSON.stringify({ level, message, ...safeContext }));
```

**Target State (Fixed):**
```typescript
// Integration with Sentry/Browser
if (level === "error") {
  Sentry.captureMessage(message, { extra: safeContext });
}
```

---

## 4. Summary of Improvements (Post-March 14)
*   ✅ **Portal Data Scoping:** Queries now use `organization_id` + `contact_id` for security.
*   ✅ **Portal Detail Routes:** `/portal/quotes/:id` etc. are now fully functional.
*   ✅ **Contact Persistence:** Forms now save to the DB instead of just showing toasts.
*   ✅ **Branding:** "SITWIT" name typo has been completely removed.
