# 🚀 Supabase Integration Setup Guide

This guide will walk you through setting up the complete Supabase backend for YouTube Clip Genie.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Storage Setup](#storage-setup)
4. [Authentication Setup](#authentication-setup)
5. [Environment Variables](#environment-variables)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Supabase project created at: https://supabase.com/dashboard
- Project URL: `https://cnxnxfgbfjqakvclcvmn.supabase.co`
- Node.js 18+ installed
- npm or yarn package manager

---

## 1️⃣ Database Setup

### Step 1: Run the SQL Schema

1. Go to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/sql/new
2. Copy the entire contents of `supabase-schema.sql`
3. Paste into the SQL Editor
4. Click **Run** to execute

This will create:
- ✅ **Tables**: `user_videos`, `clips`, `user_usage`, `user_plans`
- ✅ **RLS Policies**: Row-level security ensuring users only see their own data
- ✅ **Triggers**: Auto-create user plan on signup
- ✅ **Indexes**: Optimized queries for performance

### Step 2: Verify Tables

Go to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/editor

You should see 4 new tables:
- `user_videos`
- `clips`
- `user_usage`
- `user_plans`

---

## 2️⃣ Storage Setup

### Step 1: Create the Storage Bucket

1. Go to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/storage/buckets
2. Click **New bucket**
3. Configure:
   - **Name**: `clips`
   - **Public bucket**: ✅ Yes (for easy access to video URLs)
   - **File size limit**: 100 MB
   - **Allowed MIME types**: `video/mp4`, `video/webm`
4. Click **Create bucket**

### Step 2: Set Storage Policies (Optional - for private buckets)

If you want to make the bucket **private** instead, you'll need to add these policies:

```sql
-- Allow users to upload to their own folder
create policy "Users can upload own clips"
  on storage.objects for insert
  with check (
    bucket_id = 'clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to view their own clips
create policy "Users can view own clips"
  on storage.objects for select
  using (
    bucket_id = 'clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own clips
create policy "Users can delete own clips"
  on storage.objects for delete
  using (
    bucket_id = 'clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

### Step 3: Test Storage

Upload a test file manually to verify the bucket works.

---

## 3️⃣ Authentication Setup

### Step 1: Enable Email Authentication

1. Go to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/auth/providers
2. Under **Email**, click **Enable**
3. Configure:
   - ✅ **Enable email provider**
   - ✅ **Confirm email** (recommended for production)
   - ✅ **Secure email change** (optional)
   - ✅ **Secure password change** (optional)
4. Click **Save**

### Step 2: Enable Google OAuth

1. Still in **Providers**, scroll to **Google**
2. Click **Enable**
3. You'll need to create a **Google OAuth app**:

#### Create Google OAuth App:

a. Go to: https://console.cloud.google.com/apis/credentials

b. Create a new project or select existing

c. Click **Create Credentials** → **OAuth 2.0 Client ID**

d. Configure consent screen if prompted

e. Application type: **Web application**

f. Add these **Authorized redirect URIs**:
   ```
   https://cnxnxfgbfjqakvclcvmn.supabase.co/auth/v1/callback
   http://localhost:3000
   ```

g. Copy the **Client ID** and **Client Secret**

h. Paste them into Supabase Google provider settings

i. Click **Save**

### Step 3: Configure Site URL and Redirect URLs

1. Go to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/auth/url-configuration
2. Set:
   - **Site URL**: `https://your-domain.com` (or `http://localhost:3000` for dev)
   - **Redirect URLs**: Add both:
     ```
     http://localhost:3000
     https://your-domain.com
     ```

---

## 4️⃣ Environment Variables

### Step 1: Copy the Template

```bash
cp .env.example .env
```

### Step 2: Fill in Your Keys

Edit `.env` and add:

```env
# Supabase
VITE_SUPABASE_URL=https://cnxnxfgbfjqakvclcvmn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInRlZiI6ImNueG54ZmdiZmpxYWt2Y2xjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTYwNjgsImV4cCI6MjA3ODM5MjA2OH0.8lle8F9krxM-3MgS-_ZrT-1H5a8OTsIjCMmak-lhafU

# Google Gemini AI
GEMINI_API_KEY=your-actual-gemini-key-here

# Optional
TRANSCRIPT_API_KEY=your-transcript-api-key-here
```

### Step 3: Add to Vercel (Production)

If deploying to Vercel:

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Add each variable from `.env`
3. Set for: **Production**, **Preview**, **Development**
4. Redeploy your app

---

## 5️⃣ Testing

### Test Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Visit: http://localhost:3000

### Test Checklist

- [ ] **Signup**: Create new account with email/password
- [ ] **Email confirmation**: Check inbox (if enabled)
- [ ] **Login**: Log in with existing account
- [ ] **Google OAuth**: Click "Continue with Google"
- [ ] **Generate Clips**: Paste YouTube URL and generate clips
- [ ] **Clip Storage**: Verify clips appear in Supabase database
- [ ] **Video Upload**: Check if MP4s are in Storage bucket `clips`
- [ ] **Logout**: Logout and verify clips are cleared
- [ ] **Re-login**: Log back in and verify clips persist

---

## 6️⃣ Troubleshooting

### Issue: "Invalid API key" error

**Solution**:
- Check that `VITE_SUPABASE_ANON_KEY` is correct
- Restart Vite dev server after changing `.env`

### Issue: "User not authenticated"

**Solution**:
- Check browser console for auth errors
- Clear browser localStorage and cookies
- Verify RLS policies are enabled
- Check if user is in `auth.users` table

### Issue: "Failed to save clips to database"

**Solution**:
- Open browser DevTools → Network tab
- Look for failed Supabase API calls
- Check error message (common: RLS policy blocking insert)
- Verify user_video_id exists before inserting clips

### Issue: "Storage upload failed"

**Solution**:
- Verify bucket `clips` exists and is public
- Check storage policies if using private bucket
- Verify user is authenticated
- Check file size doesn't exceed 100MB

### Issue: Google OAuth redirect error

**Solution**:
- Verify redirect URI matches exactly in Google Console
- Check Site URL in Supabase auth settings
- Make sure Google OAuth is enabled in Supabase

---

## 🎉 Success!

Your YouTube Clip Genie app is now powered by Supabase! Features include:

✅ **User Authentication** (Email + Google OAuth)
✅ **Persistent Clip Storage** (Database)
✅ **Video File Storage** (Supabase Storage)
✅ **Usage Tracking** (Monthly limits)
✅ **Row-Level Security** (Users can't see others' data)
✅ **Plan Management** (Free, Casual, Mastermind)

---

## 📚 Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## 🐛 Need Help?

Open an issue on GitHub or check the browser console for error messages.
