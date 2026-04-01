# SISWIT Subscription & Payment System — Implementation Complete

**Date:** 2026-03-30  
**Author:** Solanki 

---

## Summary

A complete subscription and payment system has been implemented for SISWIT, integrating Razorpay for recurring billing with a 14-day free trial flow.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│                                                                 │
│  useSubscription()  →  initiateCheckout()  →  Razorpay Modal   │
│  TrialBanner        →  PlanSelectionModal                       │
│  OrganizationSubscriptionPage (plans + billing + history)       │
└──────────────────┬─────────────────────┬────────────────────────┘
                   │                     │
          ┌────────▼────────┐   ┌────────▼──────────┐
          │ Edge Function:  │   │  Edge Function:    │
          │ create-razorpay │   │  razorpay-webhook  │
          │ -subscription   │   │                    │
          └────────┬────────┘   └────────┬───────────┘
                   │                     │
          ┌────────▼────────┐   ┌────────▼───────────┐
          │   Razorpay API  │──▶│   Razorpay Events  │
          │  (Subscriptions)│   │   (Webhooks)       │
          └─────────────────┘   └────────────────────┘
                   │                     │
          ┌────────▼─────────────────────▼───────────┐
          │              Supabase DB                  │
          │                                           │
          │  organization_subscriptions (enhanced)    │
          │  subscription_events (new)                │
          │  billing_customers (existing)             │
          │                                           │
          │  RPCs:                                    │
          │  - start_trial()                          │
          │  - activate_subscription()                │
          │  - cancel_subscription()                  │
          │  - get_subscription_status()              │
          └───────────────────────────────────────────┘
```

---

## Files Created / Modified

### New Files (7)

| File | Purpose |
|------|---------|
| `docs/RAZORPAY_SETUP_GUIDE.md` | Step-by-step Razorpay Dashboard configuration |
| `supabase/migrations/055_subscription_management.sql` | Schema changes, RPCs, triggers |
| `supabase/functions/razorpay-webhook/index.ts` | Webhook handler for Razorpay events |
| `supabase/functions/create-razorpay-subscription/index.ts` | Edge function to create subscriptions |
| `src/core/hooks/useSubscription.ts` | React hook for subscription state + checkout |
| `src/ui/trial-banner.tsx` | Color-coded trial banner component |
| `src/ui/plan-selection-modal.tsx` | Plan comparison modal with checkout |

### Modified Files (5)

| File | Changes |
|------|---------|
| `src/core/types/organization.ts` | Added trial/subscription fields to `OrganizationSubscription` |
| `src/workspaces/organization/pages/OrganizationSubscriptionPage.tsx` | Full rewrite with subscription integration |
| `src/ui/upgrade-prompt.tsx` | Wired to Razorpay checkout instead of direct RPC |
| `src/workspaces/organization/components/OrganizationOwnerLayout.tsx` | Added `<TrialBanner />` to layout |
| `.env` | Added `VITE_RAZORPAY_KEY_ID` placeholder |

---

## Database Changes (Migration 055)

### Modified Table: `organization_subscriptions`
- `trial_start_date` — changed from `date` to `timestamptz`
- `trial_end_date` — changed from `date` to `timestamptz`
- `is_trial` BOOLEAN DEFAULT true — **new**
- `razorpay_subscription_id` TEXT — **new**
- `razorpay_plan_id` TEXT — **new**
- `cancelled_at` TIMESTAMPTZ — **new**
- `cancel_reason` TEXT — **new**
- `subscription_start_date` TIMESTAMPTZ — **new**
- `subscription_end_date` TIMESTAMPTZ — **new**

### New Table: `subscription_events`
Tracks all billing events (trial_started, payment_success, payment_failed, subscription_cancelled, etc.)

### New RPCs
| RPC | Purpose |
|-----|---------|
| `start_trial(p_org_id, p_plan_type)` | Starts 14-day trial, seeds limits |
| `activate_subscription(p_org_id, p_plan_type, p_razorpay_sub_id, p_razorpay_plan_id)` | Activates paid plan |
| `cancel_subscription(p_org_id, p_reason)` | Cancels plan, downgrades to Foundation |
| `get_subscription_status(p_org_id)` | Returns full subscription state |

### New Trigger
- `trg_auto_start_trial` — auto-starts 14-day trial on subscription row insert

---

## Environment Variables

### Frontend (`.env`)
```
VITE_RAZORPAY_KEY_ID=rzp_test_xxxx
```

### Supabase Edge Function Secrets
```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxx
supabase secrets set RAZORPAY_WEBHOOK_SECRET=xxxx
supabase secrets set RAZORPAY_PLAN_FOUNDATION=plan_xxxx
supabase secrets set RAZORPAY_PLAN_GROWTH=plan_xxxx
supabase secrets set RAZORPAY_PLAN_COMMERCIAL=plan_xxxx
supabase secrets set RAZORPAY_PLAN_ENTERPRISE=plan_xxxx
```

---

## Setup Checklist

1. [ ] Run migration `055_subscription_management.sql` in Supabase SQL Editor
2. [ ] Follow `docs/RAZORPAY_SETUP_GUIDE.md` to configure Razorpay
3. [ ] Set all Razorpay secrets in Supabase Edge Function settings
4. [ ] Deploy edge functions:
   ```bash
   supabase functions deploy razorpay-webhook
   supabase functions deploy create-razorpay-subscription
   ```
5. [ ] Update `.env` with your real `VITE_RAZORPAY_KEY_ID`
6. [ ] Test with Razorpay test card: `4111 1111 1111 1111`

---

## User Flows

### New Organization Signup → Trial
1. User signs up and creates organization
2. `organization_subscriptions` INSERT trigger auto-starts 14-day trial
3. Trial banner appears on every page
4. User can upgrade anytime via banner or plans page

### Upgrade (Trial → Paid)
1. User clicks "Upgrade Now" or "Change Plan"
2. Plan Selection Modal opens showing all 4 plans
3. User selects plan → billing customer created if needed
4. Edge function creates Razorpay subscription
5. Razorpay checkout modal opens
6. User completes payment
7. Razorpay webhook fires `subscription.activated`
8. Webhook calls `activate_subscription` RPC
9. Plan upgraded, limits reseeded, event logged

### Cancel Subscription
1. User clicks "Cancel Subscription" on plans page
2. Confirmation dialog with reason input
3. `cancel_subscription` RPC called
4. Plan downgraded to Foundation
5. Event logged in history

### Monthly Billing
1. Razorpay charges card automatically
2. Webhook fires `subscription.charged`
3. Payment logged in `subscription_events`
4. Subscription end date extended +30 days

### Payment Failure
1. Razorpay webhook fires `payment.failed`
2. Event logged in `subscription_events`
3. Notification sent to organization owner

---

## Testing

### Test Cards
| Scenario | Card Number |
|----------|-------------|
| Success | `4111 1111 1111 1111` |
| Failure | `4000 0000 0000 0002` |
| Expiry | Any future date |
| CVV | Any 3 digits |

### Verification Commands
```bash
# TypeScript compilation check
npx tsc --noEmit

# Run dev server
npm run dev
```
