import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

// Stripe Price IDs - These need to be created in your Stripe Dashboard
// or we'll create them programmatically on first run
const PRICE_IDS = {
  casual: process.env.STRIPE_CASUAL_PRICE_ID || '',
  mastermind: process.env.STRIPE_MASTERMIND_PRICE_ID || '',
};

const PLAN_DETAILS = {
  casual: {
    name: 'YouTube Clip Casual',
    price: 999, // $9.99 in cents
    description: '10 videos per month, up to 3 hours each',
  },
  mastermind: {
    name: 'YouTube Clip Mastermind',
    price: 2999, // $29.99 in cents
    description: '20 videos per month, up to 8 hours each',
  },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, userId, userEmail } = req.body;

    // Validate input
    if (!plan || !userId || !userEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (plan !== 'casual' && plan !== 'mastermind') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Get or create the price ID for this plan
    let priceId = PRICE_IDS[plan];

    // If price doesn't exist in env, create it dynamically
    if (!priceId) {
      console.log(`Creating Stripe price for ${plan} plan...`);

      // First, create or get the product
      const products = await stripe.products.search({
        query: `name:'${PLAN_DETAILS[plan].name}'`,
      });

      let product;
      if (products.data.length > 0) {
        product = products.data[0];
      } else {
        product = await stripe.products.create({
          name: PLAN_DETAILS[plan].name,
          description: PLAN_DETAILS[plan].description,
        });
      }

      // Create the price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: PLAN_DETAILS[plan].price,
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
      });

      priceId = price.id;
      console.log(`Created price ${priceId} for ${plan} plan`);
    }

    // Get the base URL for redirects
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : req.headers.origin || 'http://localhost:5173';

    // Create Stripe Checkout Session with custom branding
    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      client_reference_id: userId, // Link this session to our user
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}?canceled=true`,
      metadata: {
        userId: userId,
        plan: plan,
      },
      subscription_data: {
        metadata: {
          userId: userId,
          plan: plan,
        },
      },
      // Custom branding to match your website
      custom_text: {
        submit: {
          message: 'Start creating amazing clips today!',
        },
      },
      // Customize checkout appearance
      ui_mode: 'hosted', // Use Stripe's hosted checkout page
    });

    // Return the checkout URL
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
