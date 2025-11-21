# ⚠️ MUST RUN THIS FIRST - DATABASE SETUP

## Your Console Errors Explained

```
Error loading user plan: Could not find the table 'public.user_plans' in the schema cache
Error loading user usage: Could not find the table 'public.user_usage' in the schema cache
Error loading clips: Could not find the table 'public.clips' in the schema cache
```

**These errors mean the database tables don't exist yet!**

---

## 🚨 STEP 1: Create Database Tables (5 minutes)

### Go to Supabase SQL Editor:
https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/sql/new

### Copy the ENTIRE file `supabase-schema.sql` and paste it there

### Click "RUN" button

### You should see:
```
Success. No rows returned
```

That's it! Tables are created.

---

## ✅ STEP 2: Verify Tables Exist

Go to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/editor

You should see 4 new tables:
- ✅ `user_plans`
- ✅ `user_usage`
- ✅ `user_videos`
- ✅ `clips`

---

## 🎯 STEP 3: Test the App

1. Refresh your app
2. Log in
3. Paste a YouTube URL
4. Generate clips
5. **Clips should save to database and persist forever!**

---

## Why This Matters

**Before** (no database):
- Clips only in browser memory
- Lost on logout/refresh
- No persistence

**After** (with database):
- ✅ Clips saved forever
- ✅ Access from any device
- ✅ Persistent across sessions
- ✅ Usage tracking works
- ✅ Plan limits enforced

---

## Still Getting Errors?

### Check browser console:
Press F12 → Console tab

### Look for:
- ✅ "Auth event: SIGNED_IN" (you're logged in)
- ✅ "Successfully fetched transcript" (transcript works)
- ✅ "Successfully extracted X clips" (Gemini works)

### If you see:
- ❌ "Could not find the table..." → You haven't run the SQL schema yet
- ❌ "Failed to save video metadata" → Database tables don't exist
- ❌ "GEMINI_API_KEY is missing" → Add to .env file

---

## Quick Checklist

- [ ] Run `supabase-schema.sql` in Supabase SQL Editor
- [ ] Verify 4 tables exist in Supabase Editor
- [ ] Have `.env` file with GEMINI_API_KEY
- [ ] Restart dev server: `npm run dev`
- [ ] Log in to app
- [ ] Test clip generation

---

**DO THIS NOW. It takes 5 minutes and fixes everything.** 🚀
