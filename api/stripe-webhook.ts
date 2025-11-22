import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

// Initialize Supabase (server-side with service role key)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Disable body parsing, need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('⚠️ STRIPE_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'] as string;

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log(`📥 Received webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`✅ Payment succeeded for invoice ${invoice.id}`);
        // Optionally handle successful recurring payments
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`❌ Payment failed for invoice ${invoice.id}`);
        // Optionally notify user of failed payment
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * Handle completed checkout session
 * Update user's plan in Supabase when they successfully subscribe
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId || session.client_reference_id;
  const plan = session.metadata?.plan as 'casual' | 'mastermind' | undefined;

  console.log('🔍 Checkout session details:', {
    userId,
    plan,
    customerId: session.customer,
    subscriptionId: session.subscription,
    sessionId: session.id,
  });

  if (!userId || !plan) {
    console.error('❌ Missing userId or plan in checkout session metadata');
    console.error('Session metadata:', session.metadata);
    console.error('Client reference ID:', session.client_reference_id);
    return;
  }

  console.log(`✅ Checkout completed for user ${userId}, plan: ${plan}`);

  try {
    // First, check if user_plans table exists and is accessible
    const { data: existingPlan, error: fetchError } = await supabase
      .from('user_plans')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error checking existing plan:', fetchError);
      console.error('This might mean the database tables are not set up. Run SETUP_DATABASE.sql!');
    } else {
      console.log('📋 Existing plan:', existingPlan || 'No existing plan (new user)');
    }

    // Update user's plan in Supabase
    const { data, error } = await supabase
      .from('user_plans')
      .upsert({
        user_id: userId,
        plan: plan,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select();

    if (error) {
      console.error('❌ Error updating user plan:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // Log specific error messages
      if (error.message?.includes('user_plans')) {
        console.error('🚨 CRITICAL: user_plans table does not exist!');
        console.error('👉 ACTION REQUIRED: Run SETUP_DATABASE.sql in Supabase SQL Editor');
      }
    } else {
      console.log(`✅ Successfully updated user ${userId} to ${plan} plan`);
      console.log('Updated data:', data);
    }
  } catch (err) {
    console.error('❌ Exception in handleCheckoutComplete:', err);
  }
}

/**
 * Handle subscription updates (renewals, plan changes)
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const plan = subscription.metadata?.plan as 'casual' | 'mastermind' | undefined;

  if (!userId) {
    console.error('❌ Missing userId in subscription metadata');
    return;
  }

  console.log(`🔄 Subscription updated for user ${userId}, status: ${subscription.status}`);

  // Update subscription status
  const { error } = await supabase
    .from('user_plans')
    .update({
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('❌ Error updating subscription status:', error);
  } else {
    console.log(`✅ Updated subscription status for user ${userId}`);
  }
}

/**
 * Handle subscription cancellation
 * Downgrade user back to free plan
 */
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('❌ Missing userId in subscription metadata');
    return;
  }

  console.log(`❌ Subscription canceled for user ${userId}`);

  // Downgrade to free plan
  const { error } = await supabase
    .from('user_plans')
    .update({
      plan: 'free',
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('❌ Error downgrading user to free plan:', error);
  } else {
    console.log(`✅ Downgraded user ${userId} to free plan`);
  }
}
