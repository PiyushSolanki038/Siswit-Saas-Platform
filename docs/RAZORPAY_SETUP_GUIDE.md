# Razorpay Setup Guide — SISWIT Subscription System

Complete guide to configure Razorpay for SISWIT's subscription billing.

---

## 1. Create a Razorpay Account

1. Go to [https://dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup)
2. Sign up with your business email
3. Complete KYC verification (can be done later for test mode)
4. After login, ensure you are in **Test Mode** (toggle at the top of dashboard)

---

## 2. Generate API Keys

1. In Razorpay Dashboard → **Account & Settings** → **API Keys**
2. Click **Generate Key** (Test Mode)
3. You will see:
   - **Key ID**: `rzp_test_xxxxxxxxxxxx` — this is your **public** key
   - **Key Secret**: a long string — this is your **private** key
4. **SAVE BOTH IMMEDIATELY** — the Key Secret is shown only once

### Where to store them:

| Variable | Where | Value |
|----------|-------|-------|
| `VITE_RAZORPAY_KEY_ID` | `.env` (frontend) | `rzp_test_xxxxxxxxxxxx` |
| `RAZORPAY_KEY_ID` | Supabase Edge Function Secrets | `rzp_test_xxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Supabase Edge Function Secrets | Your Key Secret |

To set Supabase secrets:
```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret_here
```

---

## 3. Create Subscription Plans

1. In Razorpay Dashboard → **Products** → **Subscriptions** → **Plans**
2. Click **+ Create Plan** for each plan below:

### Plan 1: Foundation CRM
| Field | Value |
|-------|-------|
| Plan Name | `SISWIT Foundation CRM` |
| Description | `Foundation plan - CRM, CPQ, Documents` |
| Amount | `799` |
| Currency | `INR` |
| Period | `monthly` |
| Billing Cycle | `1` |

After creation, note the **Plan ID** (format: `plan_xxxxxxxxxxxx`)

### Plan 2: Revenue Growth
| Field | Value |
|-------|-------|
| Plan Name | `SISWIT Revenue Growth` |
| Description | `Growth plan - CRM, CPQ, CLM, Documents` |
| Amount | `1399` |
| Currency | `INR` |
| Period | `monthly` |
| Billing Cycle | `1` |

### Plan 3: Commercial Control
| Field | Value |
|-------|-------|
| Plan Name | `SISWIT Commercial Control` |
| Description | `Commercial plan - All 5 modules` |
| Amount | `2299` |
| Currency | `INR` |
| Period | `monthly` |
| Billing Cycle | `1` |

### Plan 4: Enterprise Governance
| Field | Value |
|-------|-------|
| Plan Name | `SISWIT Enterprise Governance` |
| Description | `Enterprise plan - All modules + governance` |
| Amount | `3799` |
| Currency | `INR` |
| Period | `monthly` |
| Billing Cycle | `1` |

### Store Plan IDs as Supabase Secrets:
```bash
supabase secrets set RAZORPAY_PLAN_FOUNDATION=plan_xxxxxxxxxxxx
supabase secrets set RAZORPAY_PLAN_GROWTH=plan_xxxxxxxxxxxx
supabase secrets set RAZORPAY_PLAN_COMMERCIAL=plan_xxxxxxxxxxxx
supabase secrets set RAZORPAY_PLAN_ENTERPRISE=plan_xxxxxxxxxxxx
```

---

## 4. Configure Webhooks

1. In Razorpay Dashboard → **Account & Settings** → **Webhooks**
2. Click **+ Add New Webhook**
3. Fill in:

| Field | Value |
|-------|-------|
| Webhook URL | `https://<YOUR_SUPABASE_PROJECT_ID>.supabase.co/functions/v1/razorpay-webhook` |
| Secret | Generate a strong random string (min 16 chars) |
| Active Events | Check the following: |

### Events to Subscribe:
- ✅ `subscription.activated`
- ✅ `subscription.charged`
- ✅ `subscription.cancelled`
- ✅ `subscription.completed`
- ✅ `subscription.pending`
- ✅ `payment.failed`

4. Click **Create Webhook**
5. Copy the **Secret** you entered and store it:

```bash
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### Your Webhook URL:
For the SISWIT Supabase project:
```
https://swzepbbpbeoqbiavidfh.supabase.co/functions/v1/razorpay-webhook
```

---

## 5. Test Cards for Development

Use these cards in **Test Mode** to simulate payments:

### Successful Payment
| Field | Value |
|-------|-------|
| Card Number | `4111 1111 1111 1111` |
| Expiry | Any future date (e.g. `12/30`) |
| CVV | Any 3 digits (e.g. `123`) |
| Name | Any name |
| OTP (if prompted) | `1234` |

### Alternative Test Cards
| Scenario | Card Number |
|----------|-------------|
| Visa Success | `4111 1111 1111 1111` |
| Mastercard Success | `5267 3181 8797 5449` |
| Failed Payment | `4000 0000 0000 0002` |
| International Card | `4000 0000 0000 3220` |

### UPI Test
| Field | Value |
|-------|-------|
| UPI ID | `success@razorpay` |
| UPI ID (failure) | `failure@razorpay` |

---

## 6. Complete Environment Variable Reference

### Frontend (.env)
```env
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

### Supabase Edge Function Secrets
```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=your_key_secret
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
supabase secrets set RAZORPAY_PLAN_FOUNDATION=plan_xxxxxxxxxxxx
supabase secrets set RAZORPAY_PLAN_GROWTH=plan_xxxxxxxxxxxx
supabase secrets set RAZORPAY_PLAN_COMMERCIAL=plan_xxxxxxxxxxxx
supabase secrets set RAZORPAY_PLAN_ENTERPRISE=plan_xxxxxxxxxxxx
```

---

## 7. Deployment Checklist

- [ ] Razorpay account created and in test mode
- [ ] API Keys generated and stored
- [ ] 4 subscription plans created with correct amounts
- [ ] Plan IDs copied and stored as secrets
- [ ] Webhook endpoint configured with correct URL
- [ ] Webhook events subscribed
- [ ] Webhook secret stored
- [ ] Edge functions deployed (`razorpay-webhook`, `create-razorpay-subscription`)
- [ ] Test payment completed successfully
- [ ] Webhook events received and processed

---

## 8. Going to Production

When ready for live payments:

1. Toggle Razorpay Dashboard from **Test Mode** → **Live Mode**
2. Generate **Live API Keys** (Settings → API Keys)
3. Update all secrets with live values:
   ```bash
   supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
   supabase secrets set RAZORPAY_KEY_SECRET=live_key_secret_here
   ```
4. Create live subscription plans (same amounts)
5. Update plan ID secrets with live plan IDs
6. Update `.env` with live `VITE_RAZORPAY_KEY_ID`
7. Create new webhook endpoint with live URL and new secret
8. Complete KYC verification in Razorpay Dashboard
