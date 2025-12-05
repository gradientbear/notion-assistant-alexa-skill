# Environment Variables Setup

## Required Environment Variables

You **must** set these environment variables for the authentication to work:

### Supabase Configuration

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

### Notion OAuth Configuration

```env
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
NOTION_REDIRECT_URI=https://your-domain.vercel.app/api/oauth/callback
```

## Where to Set Them

### Local Development

1. Create a file named `.env.local` in the `web-login` directory
2. Add all the variables above with your actual values
3. Restart your dev server: `npm run dev`

### Vercel (Production)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `NOTION_CLIENT_ID`
   - `NOTION_CLIENT_SECRET`
   - `NOTION_REDIRECT_URI`
4. **Important**: Make sure to select the correct environment (Production, Preview, Development)
5. Redeploy your application after adding variables

## How to Get These Values

### Supabase Values

1. Go to your Supabase project dashboard
2. **Project URL**: Found in Settings → API → Project URL
3. **Anon Key**: Found in Settings → API → Project API keys → `anon` `public`
4. **Service Key**: Found in Settings → API → Project API keys → `service_role` `secret` (⚠️ Keep this secret!)

### Notion OAuth Values

1. Go to https://www.notion.so/my-integrations
2. Create or select your OAuth integration
3. **Client ID**: Found on the integration page
4. **Client Secret**: Click "Show" to reveal (only shown once!)
5. **Redirect URI**: Should match your Vercel domain: `https://your-domain.vercel.app/api/oauth/callback`

### Test Mode (Skip Payment)

To skip payment/license checks during testing:

```env
NEXT_PUBLIC_SKIP_LICENSE_CHECK=true
SKIP_LICENSE_CHECK=true
```

**Note:** Set both variables:
- `NEXT_PUBLIC_SKIP_LICENSE_CHECK` - for client-side (dashboard)
- `SKIP_LICENSE_CHECK` - for server-side (API routes like OAuth authorize)

**Local Development:**
- Add both to `.env.local` in `web-login` directory
- Restart dev server

**Vercel:**
- Add both as environment variables in Vercel dashboard
- Redeploy application

When enabled:
- Dashboard will show license as active without payment
- OAuth authorize endpoint will skip license checks
- Useful for testing without Stripe integration

## Verification

After setting environment variables:

1. **Local**: Restart dev server and check console for errors
2. **Vercel**: Redeploy and check function logs
3. Try signing up - you should NOT see `placeholder.supabase.co` in the URL

## Troubleshooting

### Still seeing "placeholder.supabase.co"?

- ✅ Check `.env.local` exists and has correct values (local)
- ✅ Check Vercel environment variables are set (production)
- ✅ Restart dev server after changing `.env.local`
- ✅ Redeploy on Vercel after adding environment variables
- ✅ Make sure variable names match exactly (case-sensitive)

### "Missing Supabase environment variables" error?

- The app will throw an error if variables are missing
- This prevents using placeholder values
- Set the variables and restart/redeploy

