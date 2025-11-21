-- ← SUPABASE: Database schema for YouTube Clip Genie
-- Run this SQL in Supabase SQL Editor: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/sql

-- Enable UUID extension (if not already enabled)
create extension if not exists "uuid-ossp";

-- =====================================================
-- TABLE: user_videos
-- Stores YouTube videos that users have processed
-- =====================================================
create table if not exists user_videos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  youtube_url text not null,
  video_title text,
  video_id text not null, -- YouTube video ID extracted from URL
  duration integer, -- Video duration in seconds
  thumbnail_url text, -- YouTube thumbnail URL
  created_at timestamp with time zone default now(),

  -- Ensure user can't add same video twice
  unique(user_id, youtube_url)
);

-- Index for faster queries by user
create index if not exists idx_user_videos_user_id on user_videos(user_id);
create index if not exists idx_user_videos_created_at on user_videos(created_at desc);

-- =====================================================
-- TABLE: clips
-- Stores generated clips for each video
-- =====================================================
create table if not exists clips (
  id uuid primary key default uuid_generate_v4(),
  user_video_id uuid references user_videos(id) on delete cascade not null,
  start_time integer not null, -- Start time in seconds
  end_time integer not null, -- End time in seconds
  title text not null,
  description text,
  tags text[], -- Array of tag strings
  transcript text, -- Transcript text for this clip segment
  clip_url text, -- Supabase Storage URL or S3 URL for downloaded MP4
  thumbnail_url text, -- YouTube thumbnail URL
  created_at timestamp with time zone default now(),

  -- Ensure valid time range
  check (end_time > start_time)
);

-- Index for faster queries
create index if not exists idx_clips_user_video_id on clips(user_video_id);
create index if not exists idx_clips_created_at on clips(created_at desc);

-- =====================================================
-- TABLE: user_usage
-- Tracks monthly usage per user for plan limits
-- =====================================================
create table if not exists user_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month text not null, -- Format: YYYY-MM
  videos_processed integer default 0,
  minutes_processed integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- One row per user per month
  unique(user_id, month)
);

-- Index for faster queries
create index if not exists idx_user_usage_user_id on user_usage(user_id);
create index if not exists idx_user_usage_month on user_usage(month);

-- =====================================================
-- TABLE: user_plans
-- Stores user subscription plans
-- =====================================================
create table if not exists user_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  plan text not null default 'free', -- 'free', 'casual', 'mastermind'
  stripe_customer_id text, -- For future Stripe integration
  stripe_subscription_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for faster queries
create index if not exists idx_user_plans_user_id on user_plans(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- Ensures users can only access their own data
-- =====================================================

-- Enable RLS on all tables
alter table user_videos enable row level security;
alter table clips enable row level security;
alter table user_usage enable row level security;
alter table user_plans enable row level security;

-- =====================================================
-- RLS POLICIES: user_videos
-- =====================================================

-- Policy: Users can view their own videos
create policy "Users can view own videos"
  on user_videos for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own videos
create policy "Users can insert own videos"
  on user_videos for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own videos
create policy "Users can update own videos"
  on user_videos for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own videos
create policy "Users can delete own videos"
  on user_videos for delete
  using (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES: clips
-- =====================================================

-- Policy: Users can view clips belonging to their videos
create policy "Users can view own clips"
  on clips for select
  using (
    exists (
      select 1 from user_videos
      where user_videos.id = clips.user_video_id
      and user_videos.user_id = auth.uid()
    )
  );

-- Policy: Users can insert clips for their videos
create policy "Users can insert own clips"
  on clips for insert
  with check (
    exists (
      select 1 from user_videos
      where user_videos.id = clips.user_video_id
      and user_videos.user_id = auth.uid()
    )
  );

-- Policy: Users can update their own clips
create policy "Users can update own clips"
  on clips for update
  using (
    exists (
      select 1 from user_videos
      where user_videos.id = clips.user_video_id
      and user_videos.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own clips
create policy "Users can delete own clips"
  on clips for delete
  using (
    exists (
      select 1 from user_videos
      where user_videos.id = clips.user_video_id
      and user_videos.user_id = auth.uid()
    )
  );

-- =====================================================
-- RLS POLICIES: user_usage
-- =====================================================

-- Policy: Users can view their own usage
create policy "Users can view own usage"
  on user_usage for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own usage
create policy "Users can insert own usage"
  on user_usage for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own usage
create policy "Users can update own usage"
  on user_usage for update
  using (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES: user_plans
-- =====================================================

-- Policy: Users can view their own plan
create policy "Users can view own plan"
  on user_plans for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own plan (signup)
create policy "Users can insert own plan"
  on user_plans for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own plan
create policy "Users can update own plan"
  on user_plans for update
  using (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Auto-create user plan on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_plans (user_id, plan)
  values (new.id, 'free');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: Create user plan when user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function: Update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger: Update user_plans.updated_at
drop trigger if exists set_updated_at_user_plans on user_plans;
create trigger set_updated_at_user_plans
  before update on user_plans
  for each row execute procedure public.handle_updated_at();

-- Trigger: Update user_usage.updated_at
drop trigger if exists set_updated_at_user_usage on user_usage;
create trigger set_updated_at_user_usage
  before update on user_usage
  for each row execute procedure public.handle_updated_at();

-- =====================================================
-- STORAGE BUCKET for video clips
-- =====================================================
-- Run this in Supabase Dashboard → Storage → Create Bucket
-- Bucket name: "clips"
-- Public: true (or use signed URLs for private)
-- File size limit: 100 MB
-- Allowed MIME types: video/mp4, video/webm

-- To create bucket via SQL (requires service role):
-- insert into storage.buckets (id, name, public)
-- values ('clips', 'clips', true);

-- Storage policy: Users can upload to their own folder
-- create policy "Users can upload own clips"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'clips'
--     and auth.uid()::text = (storage.foldername(name))[1]
--   );

-- create policy "Users can view own clips"
--   on storage.objects for select
--   using (
--     bucket_id = 'clips'
--     and auth.uid()::text = (storage.foldername(name))[1]
--   );

-- =====================================================
-- DONE! Now you can:
-- 1. Signup/login users with Supabase Auth
-- 2. Store videos in user_videos table
-- 3. Store clips in clips table
-- 4. Track usage in user_usage table
-- 5. Manage plans in user_plans table
-- 6. Upload video files to Supabase Storage bucket 'clips'
-- =====================================================
