-- ============================================================================
-- STRIPE INTEGRATION SCHEMA UPDATE
-- ============================================================================
-- This file adds Stripe-related fields to the user_plans table
-- Run this in your Supabase SQL Editor AFTER running supabase-schema.sql
--
-- Purpose: Track Stripe customer IDs, subscription IDs, and subscription status
-- ============================================================================

-- Add Stripe fields to user_plans table
ALTER TABLE user_plans
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for faster lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_user_plans_stripe_customer
ON user_plans(stripe_customer_id);

-- Create index for faster lookups by Stripe subscription ID
CREATE INDEX IF NOT EXISTS idx_user_plans_stripe_subscription
ON user_plans(stripe_subscription_id);

-- Add comment explaining subscription_status values
COMMENT ON COLUMN user_plans.subscription_status IS
'Possible values: active, canceled, past_due, incomplete, incomplete_expired, trialing, unpaid';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at on row changes
DROP TRIGGER IF EXISTS update_user_plans_updated_at ON user_plans;
CREATE TRIGGER update_user_plans_updated_at
    BEFORE UPDATE ON user_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES (Optional - run these to verify setup)
-- ============================================================================

-- Check if columns were added successfully
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_plans'
AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'updated_at');

-- View current structure of user_plans table
\d user_plans;
