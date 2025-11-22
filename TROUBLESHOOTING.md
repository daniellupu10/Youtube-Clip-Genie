# 🚨 CRITICAL: Database Setup Required

## Problem: Users Not Persisting After Payment

If you're experiencing these issues:
- ✗ After payment, user returns to free plan
- ✗ Usage counter resets on logout/login
- ✗ User has to log in again after payment

**The cause:** Database tables don't exist yet!

---

## ✅ Solution: Run Database Setup (5 minutes)

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New Query"**

### Step 2: Run Setup Script

1. Open the file **`SETUP_DATABASE.sql`** from your repo
2. Copy **ALL** the contents (from line 1 to the end)
3. Paste into the SQL Editor
4. Click **"Run"** (or press Cmd/Ctrl + Enter)

### Step 3: Verify Tables Created

You should see:
```
✓ user_plans table created
✓ user_usage table created
✓ Indexes created
✓ RLS policies created
✓ Triggers created
```

---

## 🧪 How to Test It's Working

### Test 1: Check if tables exist

Run this query in SQL Editor:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_plans', 'user_usage');
```

Should return 2 rows:
- `user_plans`
- `user_usage`

### Test 2: Check your current plan

Run this query (replace YOUR_USER_ID with your actual user ID):
```sql
SELECT * FROM user_plans WHERE user_id = 'YOUR_USER_ID';
```

To find your user ID, check the browser console after logging in - it's logged there.

### Test 3: Check your usage

```sql
SELECT * FROM user_usage WHERE user_id = 'YOUR_USER_ID';
```

---

## 🔍 Check Stripe Webhook Logs

After payment, check **Vercel Logs** to see what happened:

1. Go to Vercel Dashboard → Your Project → Logs
2. Filter by `/api/stripe-webhook`
3. Look for these messages:

**✅ Good (working):**
```
✅ Checkout completed for user abc123, plan: casual
✅ Successfully updated user abc123 to casual plan
✅ Usage recorded successfully to database
```

**❌ Bad (tables missing):**
```
❌ Error updating user plan: Could not find the table 'public.user_plans'
🚨 CRITICAL: user_plans table does not exist!
👉 ACTION REQUIRED: Run SETUP_DATABASE.sql
```

If you see the second message, run `SETUP_DATABASE.sql` now!

---

## 📋 Quick Troubleshooting

### Issue: "Could not find table user_plans"
**Solution:** Run `SETUP_DATABASE.sql` in Supabase

### Issue: "Row Level Security policy violation"
**Solution:** The SQL script creates RLS policies automatically

### Issue: Webhook not firing at all
**Solution:** Create webhook endpoint in Stripe Dashboard:
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-app.vercel.app/api/stripe-webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.*`
4. Copy signing secret to Vercel env var `STRIPE_WEBHOOK_SECRET`

### Issue: User still on free plan after payment
**Possible causes:**
1. Database tables not created → Run `SETUP_DATABASE.sql`
2. Webhook not set up → Create webhook in Stripe
3. Webhook failing → Check Vercel logs

---

## 🎯 Expected Behavior After Fix

**After running SETUP_DATABASE.sql:**

1. **Payment Flow:**
   - User clicks "Upgrade" ✅
   - Pays with card ✅
   - Redirects to success page ✅
   - **Stays logged in** ✅
   - **Shows new plan (Casual or Mastermind)** ✅

2. **Usage Tracking:**
   - Generate 1 clip → Counter shows "2 remaining" ✅
   - Log out ✅
   - Log back in → **Still shows "2 remaining"** ✅
   - Generate another clip → Counter shows "1 remaining" ✅

3. **Next Month:**
   - Counter automatically resets to "3 remaining" (or 15/35 for paid plans) ✅

---

## 📞 Still Not Working?

Check these in order:

1. [ ] Database tables created (`SETUP_DATABASE.sql` run)
2. [ ] Webhook endpoint created in Stripe
3. [ ] `STRIPE_WEBHOOK_SECRET` added to Vercel
4. [ ] `STRIPE_SECRET_KEY` added to Vercel
5. [ ] App redeployed after adding env vars
6. [ ] Browser console shows no errors
7. [ ] Vercel logs show webhook receiving events

---

**Run `SETUP_DATABASE.sql` now and everything will work!** 🚀
