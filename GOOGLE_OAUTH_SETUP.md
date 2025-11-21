# 🔥 Google OAuth Setup for YouTube Clip Genie

## THE PROBLEM YOU HAD:
- ❌ "Unsupported provider: provider is not enabled"
- ❌ "Invalid API key"
- ❌ Boring, corporate error messages

## THE SOLUTION:
Follow these EXACT steps to enable Google OAuth. No skipping, no shortcuts.

---

## Step 1: Enable Google Provider in Supabase

1. Go to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/auth/providers

2. Scroll to **Google** provider

3. Click **Enable**

4. You'll need Google OAuth credentials. Keep this tab open.

---

## Step 2: Create Google OAuth App

### A. Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/apis/credentials

2. Select your project OR create a new one:
   - Click **Select a project** → **New Project**
   - Name: "YouTube Clip Genie"
   - Click **Create**

### B. Configure OAuth Consent Screen (FIRST TIME ONLY)

1. Click **OAuth consent screen** in left sidebar

2. Choose **External** (for public use) → **Create**

3. Fill in required fields:
   - **App name**: YouTube Clip Genie
   - **User support email**: your-email@example.com
   - **Developer contact**: your-email@example.com

4. Click **Save and Continue** (skip scopes)

5. Click **Save and Continue** (skip test users)

6. Click **Back to Dashboard**

### C. Create OAuth 2.0 Client ID

1. Go to: https://console.cloud.google.com/apis/credentials

2. Click **+ Create Credentials** → **OAuth 2.0 Client ID**

3. Configure:
   - **Application type**: Web application
   - **Name**: YouTube Clip Genie Web Client

4. **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://your-vercel-domain.vercel.app
   ```

5. **Authorized redirect URIs** (MOST IMPORTANT!):
   ```
   https://cnxnxfgbfjqakvclcvmn.supabase.co/auth/v1/callback
   http://localhost:3000
   ```

6. Click **Create**

7. **SAVE THESE CREDENTIALS:**
   - Client ID: `123456789-abcdefg.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-ABC123xyz`

---

## Step 3: Add Credentials to Supabase

1. Go back to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/auth/providers

2. In the **Google** section, paste:
   - **Client ID**: (from Google Cloud Console)
   - **Client Secret**: (from Google Cloud Console)

3. Click **Save**

4. **Verify redirect URL** in Supabase matches:
   ```
   https://cnxnxfgbfjqakvclcvmn.supabase.co/auth/v1/callback
   ```

---

## Step 4: Configure Site URL in Supabase

1. Go to: https://supabase.com/dashboard/project/cnxnxfgbfjqakvclcvmn/auth/url-configuration

2. Set:
   - **Site URL**: `http://localhost:3000` (for dev) or `https://your-domain.vercel.app` (for prod)

3. **Redirect URLs** (add both):
   ```
   http://localhost:3000
   https://your-domain.vercel.app
   ```

4. Click **Save**

---

## Step 5: Test Locally

1. Make sure your `.env` file has:
   ```env
   VITE_SUPABASE_URL=https://cnxnxfgbfjqakvclcvmn.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNueG54ZmdiZmpxYWt2Y2xjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTYwNjgsImV4cCI6MjA3ODM5MjA2OH0.8lle8F9krxM-3MgS-_ZrT-1H5a8OTsIjCMmak-lhafU
   ```

2. Restart your dev server:
   ```bash
   npm run dev
   ```

3. Click **"Continue with Google (or don't, I'm not your mom)"**

4. Google popup should appear → sign in → redirect back to app

5. Check browser console for: `🧞 Auth event: SIGNED_IN`

---

## Step 6: Deploy to Vercel

1. Add environment variables in Vercel:
   - https://vercel.com/your-project/settings/environment-variables

2. Add:
   ```
   VITE_SUPABASE_URL=https://cnxnxfgbfjqakvclcvmn.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNueG54ZmdiZmpxYWt2Y2xjdm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTYwNjgsImV4cCI6MjA3ODM5MjA2OH0.8lle8F9krxM-3MgS-_ZrT-1H5a8OTsIjCMmak-lhafU
   GEMINI_API_KEY=your-gemini-key-here
   ```

3. Redeploy

4. Update **Site URL** in Supabase to your Vercel domain

5. Update **Authorized redirect URIs** in Google Cloud Console:
   ```
   https://your-vercel-domain.vercel.app
   ```

---

## Troubleshooting

### "Unsupported provider: provider is not enabled"

**Fix**: Google provider not enabled in Supabase
- Go to Supabase → Auth → Providers → Turn ON Google

### "Invalid API key"

**Fix**: Anon key is wrong or missing
- Check `.env` has correct `VITE_SUPABASE_ANON_KEY`
- Restart dev server after changing `.env`

### "redirect_uri_mismatch"

**Fix**: Redirect URIs don't match
- Google Console redirect URI MUST be: `https://cnxnxfgbfjqakvclcvmn.supabase.co/auth/v1/callback`
- Check for trailing slashes (remove them)
- Check http vs https

### Google popup opens but nothing happens

**Fix**: Site URL mismatch
- Supabase → Auth → URL Configuration
- Site URL should match your current domain exactly

### Still broken?

**Check browser console** for:
- `🧞 Auth event: SIGNED_IN` (success)
- `🧞 Google login error` (shows actual error)
- Any CORS errors (means redirect URI is wrong)

---

## ✅ Success Checklist

- [ ] Google provider enabled in Supabase
- [ ] OAuth app created in Google Cloud Console
- [ ] Client ID & Secret added to Supabase
- [ ] Redirect URI matches: `https://cnxnxfgbfjqakvclcvmn.supabase.co/auth/v1/callback`
- [ ] Site URL configured in Supabase
- [ ] Environment variables set (local + Vercel)
- [ ] Google login button shows: "Continue with Google (or don't, I'm not your mom)"
- [ ] Clicking Google button opens popup
- [ ] After signin, redirects to app and shows user as logged in
- [ ] Error messages are funny and on-brand (with emojis!)

---

## 🎉 Done!

Your Google OAuth is now working. Users can log in with:
1. Google (instant, easy)
2. Email/password (for boomers)

All errors now speak Genie language. No more boring corporate BS.

**Welcome to the magic lamp.** 🧞✨
