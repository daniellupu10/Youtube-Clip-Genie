// Stripe integration for subscription management
// This file handles all Stripe-related operations

export const STRIPE_PRICE_IDS = {
  casual: 'price_casual_monthly',    // Will be created in Stripe
  mastermind: 'price_mastermind_monthly', // Will be created in Stripe
} as const;

export interface CheckoutSessionRequest {
  priceId: string;
  userId: string;
  userEmail: string;
  planName: 'casual' | 'mastermind';
}

/**
 * Creates a Stripe Checkout session for subscription purchase
 * Calls the backend API endpoint which securely handles Stripe API
 */
export async function createCheckoutSession(
  plan: 'casual' | 'mastermind',
  userId: string,
  userEmail: string
): Promise<{ url: string } | { error: string }> {
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan,
        userId,
        userEmail,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create checkout session');
    }

    return { url: data.url };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to create checkout session',
    };
  }
}

/**
 * Creates a billing portal session for managing subscriptions
 * Allows users to cancel, update payment methods, etc.
 */
export async function createBillingPortalSession(
  customerId: string
): Promise<{ url: string } | { error: string }> {
  try {
    const response = await fetch('/api/create-billing-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create billing portal session');
    }

    return { url: data.url };
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to create billing portal session',
    };
  }
}
