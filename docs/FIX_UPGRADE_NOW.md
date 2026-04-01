# Fix Upgrade Flow — Step by Step

Do these steps **in order**. Each step takes 1-2 minutes.

---

## ✅ Step 1: Fix Browser Login (30 seconds)

Your browser session has expired. You need to clear it.

1. Open **Chrome** where your SISWIT app is running
2. Press **F12** (opens Developer Tools)
3. Click on **Console** tab
4. Click in the text box at the bottom
5. Type this and press **Enter**:

```
localStorage.clear(); sessionStorage.clear(); location.reload();
```

6. The page reloads → you see the **Login** page
7. **Sign in** with your email and password
8. ✅ Done! You should see the dashboard now with no errors

---

## ✅ Step 2: Get Supabase Access Token (1 minute)

You need a token to deploy edge functions.

1. Open a new browser tab
2. Go to: **https://supabase.com/dashboard/account/tokens**
3. Sign in if asked
4. Click **"Generate new token"**
5. Name: type `deploy` (or anything)
6. Click **Generate**
7. A token appears (starts with `sbp_...`)
8. **Click the copy button** next to it
9. ✅ Save it somewhere (notepad) — you'll need it in Step 3

---

## ✅ Step 3: Deploy Edge Functions (2 minutes)

1. In **VS Code**, open a **new terminal** (Terminal → New Terminal)
2. Run this command (replace `PASTE_YOUR_TOKEN` with the token from Step 2):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "PASTE_YOUR_TOKEN"
```

3. Press **Enter**. Nothing will appear — that's normal.

4. Now run this command:

```powershell
npx supabase functions deploy create-razorpay-subscription --no-verify-jwt --project-ref swzepbbpbeoqbiavidfh
```

5. Wait for it to finish. You should see a success message.

6. Now run this command:

```powershell
npx supabase functions deploy razorpay-webhook --no-verify-jwt --project-ref swzepbbpbeoqbiavidfh
```

7. Wait for success message.
8. ✅ Both functions are deployed!

---

## ✅ Step 4: Set Razorpay Secrets (2 minutes)

In the **same terminal** (where you set the token), run these commands.

**Replace** each `xxxx` value with your real Razorpay values:

```powershell
npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxx --project-ref swzepbbpbeoqbiavidfh
```

```powershell
npx supabase secrets set RAZORPAY_KEY_SECRET=xxxx --project-ref swzepbbpbeoqbiavidfh
```

```powershell
npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=xxxx --project-ref swzepbbpbeoqbiavidfh
```

```powershell
npx supabase secrets set RAZORPAY_PLAN_FOUNDATION=plan_xxxx --project-ref swzepbbpbeoqbiavidfh
```

```powershell
npx supabase secrets set RAZORPAY_PLAN_GROWTH=plan_xxxx --project-ref swzepbbpbeoqbiavidfh
```

```powershell
npx supabase secrets set RAZORPAY_PLAN_COMMERCIAL=plan_xxxx --project-ref swzepbbpbeoqbiavidfh
```

```powershell
npx supabase secrets set RAZORPAY_PLAN_ENTERPRISE=plan_xxxx --project-ref swzepbbpbeoqbiavidfh
```

> **Where to get these values?**
> - Razorpay Key ID & Secret → Razorpay Dashboard → Account & Settings → API Keys
> - Plan IDs → Razorpay Dashboard → Products → Subscriptions → Plans
> - Webhook Secret → the secret you chose when creating the webhook
> - See `docs/RAZORPAY_SETUP_GUIDE.md` for full details

---

## ✅ Step 5: Update .env File (30 seconds)

1. Open the file `.env` in VS Code (it's in the project root)
2. Find the line: `VITE_RAZORPAY_KEY_ID=rzp_test_xxxx`
3. Replace `rzp_test_xxxx` with your **real Razorpay test Key ID**
4. Save the file
5. Restart the dev server (Ctrl+C in terminal, then `npm run dev`)

---

## ✅ Step 6: Apply Database Migration (1 minute)

1. Open browser → go to **https://supabase.com/dashboard/project/swzepbbpbeoqbiavidfh/sql/new**
2. Copy the **entire contents** of this file:
   `supabase/migrations/055_subscription_management.sql`
3. Paste it into the SQL editor
4. Click **Run**
5. ✅ Should show "Success. No rows returned"

> **Already done this?** Skip this step.

---

## ✅ Step 7: Test It! (1 minute)

1. Open your SISWIT app in Chrome (http://localhost:5173)
2. Sign in if needed
3. Go to **Subscription & Billing** page
4. Click **"Change Plan"** or **"Upgrade Now"**
5. Select a plan (e.g. Growth)
6. Razorpay payment modal should open
7. Use test card: `4111 1111 1111 1111`, any future expiry, any 3-digit CVV

---

## 🔧 Troubleshooting

### Still getting "Invalid Refresh Token"?
→ Do Step 1 again. Make sure you typed the localStorage.clear() command correctly.

### Getting 401 on edge function?
→ Make sure you deployed with `--no-verify-jwt` flag (Step 3).

### Getting 500 or 502?
→ Check Supabase Dashboard → Edge Functions → Logs to see the error.
→ Make sure all secrets from Step 4 are set correctly.

### "Razorpay key not configured"?
→ Make sure `.env` has the real `VITE_RAZORPAY_KEY_ID` value (Step 5).

### Upgrade button does nothing?
→ Make sure migration 055 was applied (Step 6).
→ Make sure the dev server was restarted after changing `.env`.
