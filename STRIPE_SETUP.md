# 💳 Stripe Payment Integration Setup Guide

This guide will walk you through setting up Stripe payments for YouTube Clip Genie subscription plans.

## 📋 Prerequisites

- A Stripe account (create one at [stripe.com](https://stripe.com))
- Vercel deployment (or any hosting platform)
- Supabase database (already configured)

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Get Stripe API Keys

1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your **Secret key** (starts with `sk_test_...` for testing)
3. Add to Vercel environment variables:
   ```
   STRIPE_SECRET_KEY=sk_test_your_actual_key_here
   ```

### Step 2: Create Webhook Endpoint

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Enter your endpoint URL:
   ```
   https://your-vercel-domain.vercel.app/api/stripe-webhook
   ```
4. Select these events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Add to Vercel environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret_here
   ```

### Step 3: Update Database Schema

1. Go to your Supabase project → SQL Editor
2. Open and run `supabase-stripe-schema.sql`
3. This adds Stripe fields to the `user_plans` table

### Step 4: Deploy Environment Variables

Add these to **Vercel → Project Settings → Environment Variables**:

```bash
# Required
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# Optional (auto-created if not set)
# STRIPE_CASUAL_PRICE_ID=price_xxxxx
# STRIPE_MASTERMIND_PRICE_ID=price_xxxxx
```

### Step 5: Test the Integration

1. Deploy your app to Vercel
2. Click "Upgrade" on any paid plan
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete checkout
5. Verify you're redirected to success page
6. Check Stripe Dashboard → Payments for the test payment

---

## 🧪 Testing with Stripe Test Mode

### Test Credit Cards

| Card Number | Description |
|------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | Requires authentication (3D Secure) |

**Other test details:**
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

### Webhook Testing Locally

To test webhooks on localhost:

1. Install Stripe CLI: [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
2. Login: `stripe login`
3. Forward webhooks:
   ```bash
   stripe listen --forward-to localhost:5173/api/stripe-webhook
   ```
4. Copy the webhook signing secret shown
5. Add to your local `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_local_secret_from_cli
   ```

---

## 💰 Pricing Configuration

The app automatically creates these products in Stripe:

| Plan | Price | Interval |
|------|-------|----------|
| **Casual** | $9.99 | Monthly |
| **Mastermind** | $29.99 | Monthly |

Products are created automatically on first checkout. To create them manually:

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Click **"Add product"**
3. Fill in details:
   - **Name**: YouTube Clip Casual (or Mastermind)
   - **Price**: 9.99 (or 29.99)
   - **Billing period**: Monthly
4. Copy the **Price ID** (starts with `price_...`)
5. Add to environment variables:
   ```
   STRIPE_CASUAL_PRICE_ID=price_xxxxx
   STRIPE_MASTERMIND_PRICE_ID=price_xxxxx
   ```

---

## 🔄 How It Works

### Payment Flow

1. **User clicks "Upgrade"** → `PricingModal.tsx` calls `createCheckoutSession()`
2. **Backend creates session** → `/api/create-checkout-session.ts` calls Stripe API
3. **User redirected to Stripe Checkout** → Secure payment page hosted by Stripe
4. **User completes payment** → Stripe processes card
5. **Webhook fires** → `/api/stripe-webhook.ts` receives `checkout.session.completed`
6. **Database updated** → User plan upgraded in Supabase `user_plans` table
7. **User redirected back** → Success page shows new plan benefits

### Subscription Management

- **Renewals**: Automatic monthly billing
- **Cancellations**: User downgraded to free plan via webhook
- **Failed payments**: Webhook notifies app (you can add email notifications)
- **Billing portal**: Users can manage subscriptions in Stripe's hosted portal

---

## 🔐 Security Notes

### API Keys Security

✅ **DO:**
- Store keys in environment variables only
- Use test keys (`sk_test_...`) in development
- Rotate keys if compromised
- Use separate keys for development and production

❌ **DON'T:**
- Commit keys to git
- Use production keys in development
- Share keys publicly
- Store keys in frontend code

### Webhook Security

The webhook endpoint verifies signatures to ensure requests come from Stripe:

```typescript
const signature = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
```

This prevents malicious requests from fake "Stripe" webhooks.

---

## 🐛 Troubleshooting

### "No such customer" error
**Cause**: Customer ID mismatch
**Fix**: Check database `stripe_customer_id` column matches Stripe

### "Invalid API key" error
**Cause**: Wrong key or not set
**Fix**: Verify `STRIPE_SECRET_KEY` in Vercel environment variables

### Webhook not firing
**Cause**: Wrong URL or not deployed
**Fix**:
1. Check webhook URL matches your Vercel domain
2. Verify webhook secret is correct
3. Check Stripe Dashboard → Webhooks → Recent deliveries for errors

### Payment succeeds but plan doesn't upgrade
**Cause**: Webhook failed or database error
**Fix**:
1. Check Vercel logs for errors in `/api/stripe-webhook`
2. Verify Supabase connection and schema
3. Check Stripe Dashboard → Webhooks for delivery status

### Test mode vs Live mode confusion
**Cause**: Using live keys in test mode or vice versa
**Fix**: Ensure keys match environment (test keys for testing, live keys for production)

---

## 📊 Monitoring

### Stripe Dashboard

Monitor these sections:

- **Payments**: See all transactions
- **Subscriptions**: Track active subscribers
- **Webhooks**: Monitor webhook delivery success rate
- **Logs**: Debug API calls

### Vercel Logs

Check these for errors:

- `/api/create-checkout-session` - Checkout creation errors
- `/api/stripe-webhook` - Webhook processing errors

---

## 🚢 Going Live

When ready for production:

1. **Switch to live mode** in Stripe Dashboard (toggle in top-right)
2. **Get live API keys** from [API Keys](https://dashboard.stripe.com/apikeys)
3. **Create live webhook** with production URL
4. **Update Vercel variables** with live keys:
   ```
   STRIPE_SECRET_KEY=sk_live_your_live_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_live_secret_here
   ```
5. **Test with real card** (use your own card first!)
6. **Monitor carefully** for the first few transactions

---

## 💡 Additional Features

### Customer Portal

Let users manage their subscriptions:

```typescript
// In your backend
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripe_customer_id,
  return_url: 'https://your-domain.com/dashboard',
});
// Redirect user to session.url
```

### Promo Codes

Create discounts in Stripe Dashboard:
1. Go to Products → Coupons
2. Create coupon (e.g., 50% off first month)
3. Apply at checkout with `promotion_code` parameter

### Usage-Based Billing

For more complex pricing (e.g., pay per video):
1. Create metered price in Stripe
2. Report usage via Stripe API
3. Automatically billed monthly

---

## 📚 Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Webhook Events Reference](https://stripe.com/docs/api/events/types)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Best Practices](https://stripe.com/docs/security/best-practices)

---

## ✅ Setup Checklist

- [ ] Create Stripe account
- [ ] Get test API keys
- [ ] Add STRIPE_SECRET_KEY to Vercel
- [ ] Create webhook endpoint
- [ ] Add STRIPE_WEBHOOK_SECRET to Vercel
- [ ] Run supabase-stripe-schema.sql
- [ ] Test with test card 4242...
- [ ] Verify webhook fires correctly
- [ ] Check database updates
- [ ] Test full flow end-to-end
- [ ] (Production) Get live keys
- [ ] (Production) Update environment variables
- [ ] (Production) Test with real card

---

**Need help?** Check [Stripe Support](https://support.stripe.com) or the troubleshooting section above!
