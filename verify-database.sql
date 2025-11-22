-- Quick verification script to check if database is set up correctly
-- Run this AFTER running SETUP_DATABASE.sql to verify everything worked

-- 1. Check if tables exist
SELECT
  'Tables Status' as check_type,
  CASE
    WHEN COUNT(*) = 2 THEN '✅ Both tables exist'
    WHEN COUNT(*) = 1 THEN '⚠️ Only one table exists - run SETUP_DATABASE.sql again'
    ELSE '❌ No tables found - run SETUP_DATABASE.sql'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_plans', 'user_usage');

-- 2. Check if RLS is enabled
SELECT
  'RLS Status' as check_type,
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ Enabled'
    ELSE '❌ Disabled - run SETUP_DATABASE.sql'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('user_plans', 'user_usage');

-- 3. Check if policies exist
SELECT
  'Policies Status' as check_type,
  COUNT(*) || ' policies created' as status
FROM pg_policies
WHERE tablename IN ('user_plans', 'user_usage');

-- 4. Check if triggers exist
SELECT
  'Triggers Status' as check_type,
  COUNT(*) || ' triggers created' as status
FROM information_schema.triggers
WHERE event_object_table IN ('user_plans', 'user_usage');

-- 5. Sample data check (run this AFTER you've logged in at least once)
-- This will show if your user plan was created
SELECT
  'User Plans' as check_type,
  COUNT(*) || ' users have plans' as status
FROM user_plans;

-- 6. Usage data check (run this AFTER you've generated at least one video)
SELECT
  'User Usage' as check_type,
  COUNT(*) || ' usage records' as status
FROM user_usage;

-- If all checks pass, you should see:
-- ✅ Both tables exist
-- ✅ RLS Enabled on both tables
-- 6+ policies created
-- 2 triggers created
-- At least 1 user has a plan (after login)
-- At least 1 usage record (after generating video)
