# Quick Start Guide

## 1. Install Dependencies

```bash
cd web-login
npm install jsonwebtoken @types/jsonwebtoken stripe
```

## 2. Run Database Migrations

In Supabase SQL Editor, run:
1. `docs/migrations/20250101_add_oauth_tables.sql`
2. `docs/migrations/20250101_add_license_fields.sql`

## 3. Set Environment Variables

**Vercel:**
- `JWT_SECRET` (min 32 chars)
- `JWT_EXPIRES_IN=3600`
- `APP_ISS=https://voice-planner-murex.vercel.app`
- `ALEXA_OAUTH_CLIENT_ID`
- `ALEXA_OAUTH_CLIENT_SECRET`
- `ALEXA_REDIRECT_URIS`
- `STRIPE_SECRET_KEY` (optional)
- `STRIPE_WEBHOOK_SECRET` (optional)

**Lambda:**
- `JWT_SECRET` (same as Vercel)
- `INTROSPECT_URL=https://voice-planner-murex.vercel.app/api/auth/introspect`
- `LEGACY_TOKEN_SUPPORT=true`

## 4. Deploy

**Next.js:**
```bash
cd web-login
npm run build
vercel --prod
```

**Lambda:**
```bash
cd lambda
npm run build
sam build
sam deploy
```

## 5. Configure Alexa

1. Go to Alexa Developer Console
2. Build → Account Linking
3. Set:
   - Authorization URI: `https://voice-planner-murex.vercel.app/api/oauth/authorize`
   - Access Token URI: `https://voice-planner-murex.vercel.app/api/oauth/token`
   - Client ID/Secret: Your values
4. Save and Build

## 6. Test

1. Link account in Alexa app
2. Test: "Alexa, open Voice Planner"
3. Check CloudWatch logs for `[AuthInterceptor] Token validated successfully`

## Files Created

All files are in place. See `IMPLEMENTATION_SUMMARY.md` for complete list.

## Need Help?

- See `docs/oauth_jwt_migration.md` for detailed guide
- See `docs/TESTING.md` for test procedures
- See `PR_TEMPLATE.md` for manual apply instructions

