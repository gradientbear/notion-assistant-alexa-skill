# Complete Authentication Setup Guide

This document describes the new authentication system with email/password, social login, and the complete onboarding flow.

## Overview

The new authentication system provides:
- **Email/Password Authentication** - Traditional signup/login
- **Social Login** - Google, Microsoft, Apple OAuth
- **Onboarding Flow** - Step-by-step setup process
- **Notion Integration** - Automatic workspace setup
- **Amazon Linking** - Required for Alexa skill
- **License Activation** - Final step to activate the skill

## User Flow

```
1. Sign Up/Login (Web)
   ↓
2. Connect Notion (Auto-creates Privacy page + databases)
   ↓
3. Link Amazon Account (Required for Alexa)
   ↓
4. Enter License Key (Final activation)
   ↓
5. Dashboard (Ready to use)
```

## Database Schema Updates

### New Fields in `users` Table

- `auth_user_id` (UUID) - Supabase Auth user ID
- `password_hash` (TEXT) - For email/password (if not using Supabase Auth)
- `email_verified` (BOOLEAN) - Email verification status
- `provider` (VARCHAR) - 'email', 'google', 'microsoft', 'apple'
- `provider_id` (VARCHAR) - Provider-specific user ID
- `onboarding_complete` (BOOLEAN) - Tracks onboarding completion

### Schema Changes

- `amazon_account_id` - Now nullable (linked later)
- `license_key` - Now nullable (entered during onboarding)

### Migration

Run these SQL commands if you have an existing database:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN amazon_account_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN license_key DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_amazon_account_id_unique 
ON users(amazon_account_id) 
WHERE amazon_account_id IS NOT NULL;
```

## Environment Variables

Add to `web-login/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Notion OAuth
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
NOTION_REDIRECT_URI=https://your-domain.com/api/oauth/callback
```

## Supabase Auth Configuration

### 1. Enable Authentication Providers

In Supabase Dashboard → Authentication → Providers:

1. **Email Provider**
   - Enable "Enable Email Signup"
   - Enable "Confirm email"
   - Set email template (optional)

2. **Google OAuth**
   - Enable Google provider
   - Add Client ID and Client Secret
   - Set redirect URL: `https://your-domain.com/auth/callback`

3. **Microsoft/Azure OAuth**
   - Enable Azure provider
   - Add Application (client) ID and Secret
   - Set redirect URL: `https://your-domain.com/auth/callback`

4. **Apple OAuth**
   - Enable Apple provider
   - Add Service ID, Key ID, and Private Key
   - Set redirect URL: `https://your-domain.com/auth/callback`

### 2. Configure Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://your-domain.com`
- Redirect URLs:
  - `https://your-domain.com/auth/callback`
  - `http://localhost:3000/auth/callback` (for development)

## Installation Steps

1. **Install Dependencies**
   ```bash
   cd web-login
   npm install
   ```

2. **Set Up TailwindCSS**
   - Already configured in `tailwind.config.js`
   - Already configured in `postcss.config.js`

3. **Run Database Migration**
   - Execute the SQL migration script in Supabase SQL Editor

4. **Configure Environment Variables**
   - Copy `.env.local.example` to `.env.local`
   - Fill in all required values

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## API Routes

### Authentication Routes

- `POST /api/auth/sync-user` - Sync Supabase Auth user to custom users table
- `GET /api/users/me` - Get current user data
- `POST /api/users/link-amazon` - Link Amazon account
- `POST /api/users/update-license` - Update license key
- `POST /api/users/complete-onboarding` - Mark onboarding as complete

### OAuth Routes

- `POST /api/oauth/initiate` - Start Notion OAuth flow
- `GET /api/oauth/callback` - Handle Notion OAuth callback
- `GET /auth/callback` - Handle Supabase Auth callback

## Pages

### `/` - Authentication Page
- Sign In / Sign Up tabs
- Email/Password form
- Social login buttons (Google, Microsoft, Apple)
- Password validation
- Email verification flow

### `/onboarding` - Onboarding Flow
- Step-by-step progress tracker
- Shows current step
- Allows progression through:
  1. Connect Notion
  2. Link Amazon Account
  3. Enter License Key

### `/amazon/link` - Amazon Account Linking
- Instructions for linking Amazon account
- Handles Alexa skill account linking
- Updates user with `amazon_account_id`

### `/license` - License Key Entry
- License key input form
- Validates license key
- Activates user account
- Marks onboarding as complete

### `/dashboard` - User Dashboard
- Shows account status
- Displays connection status (Notion, Amazon, License)
- Sign out functionality

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

## Error Handling

- Email validation
- Password strength validation
- License key validation
- OAuth error handling
- Session expiration handling

## Security Features

- JWT tokens via Supabase Auth
- HTTP-only cookies (handled by Supabase)
- Email verification required
- Password hashing (handled by Supabase)
- OAuth state validation
- CSRF protection (via Supabase)

## Testing

### Test Sign Up Flow

1. Go to `/`
2. Click "Sign Up" tab
3. Enter email and password
4. Check email for verification link
5. Verify email
6. Sign in
7. Complete onboarding steps

### Test Social Login

1. Click social login button
2. Complete OAuth flow
3. Should redirect to onboarding

### Test Onboarding

1. After login, should see onboarding page
2. Complete each step:
   - Connect Notion → Should create Privacy page and databases
   - Link Amazon → Should update `amazon_account_id`
   - Enter License → Should activate account

## Troubleshooting

### "Missing Supabase environment variables"
- Check `.env.local` file exists
- Verify all required variables are set

### "User not found" errors
- Check if user was synced to database
- Verify `auth_user_id` is set correctly

### OAuth redirect errors
- Check redirect URLs in Supabase Dashboard
- Verify redirect URLs match exactly

### Notion setup fails
- Check Notion OAuth credentials
- Verify Notion integration has correct permissions
- Check logs for specific error messages

## Next Steps

1. Configure Supabase Auth providers
2. Set up OAuth credentials for social login
3. Test complete flow end-to-end
4. Deploy to production
5. Update redirect URLs in all OAuth providers

---

**Note**: This implementation uses Supabase Auth for authentication, which handles JWT tokens, session management, and OAuth flows automatically. The custom `users` table is synced with Supabase Auth users for additional metadata storage.

