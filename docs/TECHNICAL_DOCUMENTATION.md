# Notion Assistant Alexa Skill - Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Backend (Lambda)](#backend-lambda)
4. [Web Login (Next.js)](#web-login-nextjs)
5. [Database Schema](#database-schema)
6. [Notion Integration](#notion-integration)
7. [License Key System](#license-key-system)
8. [OAuth Flow](#oauth-flow)
9. [Deployment](#deployment)
10. [Environment Variables](#environment-variables)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)

## Architecture Overview

The Notion Assistant Alexa Skill consists of three main components:

1. **AWS Lambda Function** - Handles all Alexa requests and Notion API interactions
2. **Next.js Web Application** - Provides OAuth/account linking interface
3. **Supabase Database** - Stores user data and license keys

```
┌─────────────┐
│   Alexa     │
│   Device    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  AWS Lambda     │
│  (Node.js/TS)   │
└──────┬──────────┘
       │
       ├──────────┐
       ▼          ▼
┌──────────┐  ┌──────────┐
│ Supabase │  │  Notion  │
│ Database │  │   API    │
└──────────┘  └──────────┘
       │
       ▼
┌─────────────────┐
│  Next.js Web    │
│  (OAuth Login)  │
└─────────────────┘
```

## Project Structure

```
notion-assistant-alexa-skill/
├── lambda/                 # AWS Lambda backend
│   ├── src/
│   │   ├── handlers/       # Alexa intent handlers
│   │   ├── interceptors/  # Request interceptors
│   │   ├── utils/          # Utility functions
│   │   ├── types/          # TypeScript types
│   │   └── index.ts        # Lambda entry point
│   ├── template.yaml       # SAM template
│   └── package.json
├── web-login/              # Next.js OAuth app
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── page.tsx       # Login page
│   │   └── layout.tsx
│   └── package.json
├── shared/                 # Shared types/utilities
│   └── src/
├── docs/                   # Documentation
│   ├── TECHNICAL_DOCUMENTATION.md
│   ├── USER_GUIDE.md
│   └── supabase-schema.sql
└── .github/workflows/      # CI/CD pipelines
```

## Backend (Lambda)

### Entry Point

The Lambda function is initialized in `lambda/src/index.ts` using the Alexa Skills Kit SDK.

### Handlers

Each intent has a dedicated handler:

- **LaunchRequestHandler** - Handles skill launch and initial setup
- **BrainDumpHandler** - Multi-turn conversation for adding tasks
- **PriorityListHandler** - Retrieves top 3 priority tasks
- **FocusTimerHandler** - Starts 25-minute Pomodoro timer
- **EnergyTrackerHandler** - Logs energy levels (1-10)
- **ScheduleHandler** - Shows today's tasks
- **ShoppingListHandler** - Manages shopping list items

### Interceptors

- **LicenseValidationInterceptor** - Validates license key on each request
- **NotionConnectionInterceptor** - Sets up Notion client from user token

### Utilities

- **database.ts** - Supabase client and user/license operations
- **notion.ts** - Notion API wrapper with retry logic
- **alexa.ts** - Alexa response builders

## Web Login (Next.js)

The web login application provides the OAuth flow for linking Notion accounts.

### Pages

- **/** - Login form (email + license key)
- **/api/validate-license** - Validates license key
- **/api/oauth/initiate** - Starts Notion OAuth flow
- **/api/oauth/callback** - Handles OAuth callback

### OAuth Flow

1. User enters email and license key
2. System validates license key
3. Redirects to Notion OAuth
4. User authorizes access
5. Notion redirects back with code
6. System exchanges code for access token
7. Token stored in Supabase
8. User can now use Alexa skill

## Database Schema

See `docs/supabase-schema.sql` for complete schema.

### Tables

**users**
- `id` (UUID, PK)
- `amazon_account_id` (string, unique)
- `email` (string)
- `license_key` (string)
- `notion_token` (text, nullable)
- `created_at`, `updated_at` (timestamps)

**licenses**
- `license_key` (string, PK)
- `status` (active/inactive)
- `created_at`, `updated_at` (timestamps)
- `notes` (text, optional)

## Notion Integration

### Required Databases

The skill expects three databases in the user's Notion workspace:

1. **Tasks** - Task management
2. **Focus_Logs** - Focus session logs
3. **Energy_Logs** - Energy level tracking

### Database Structure

See `docs/USER_GUIDE.md` for detailed database schemas.

### API Permissions

- ✅ Read/write pages
- ✅ Read/write database entries
- ❌ Deletion operations
- ❌ PDF/Word/Excel files
- ❌ Audio files

### Error Handling

- Automatic retry (2-3 attempts) for rate limits and server errors
- User-friendly error messages
- All errors logged to database

## License Key System

### Validation Flow

1. User launches skill
2. System checks if user exists in database
3. If new user, prompts for account linking
4. License key validated against `licenses` table
5. Only active licenses allow access

### License Management

- Licenses managed manually in Supabase
- Status can be `active` or `inactive`
- One license per Amazon account

## OAuth Flow

### Notion OAuth Setup

1. Create OAuth integration at https://www.notion.so/my-integrations
2. Set redirect URI: `https://your-web-app.com/api/oauth/callback`
3. Get Client ID and Client Secret
4. Add to environment variables

### Authorization Code Grant with PKCE

The implementation uses PKCE for enhanced security:

1. Generate code verifier (random 32 bytes)
2. Create code challenge (SHA256 hash)
3. Include in OAuth request
4. Exchange code with verifier

## Deployment

### Lambda Deployment

Using AWS SAM:

```bash
cd lambda
npm install
npm run build
sam build
sam deploy
```

Or use GitHub Actions workflow (`.github/workflows/deploy-lambda.yml`).

### Web Login Deployment

Deploy to Vercel:

```bash
cd web-login
npm install
npm run build
vercel --prod
```

Or use GitHub Actions workflow (`.github/workflows/deploy-web.yml`).

## Environment Variables

### Lambda

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key

### Web Login

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `NOTION_CLIENT_ID` - Notion OAuth client ID
- `NOTION_CLIENT_SECRET` - Notion OAuth client secret
- `NOTION_REDIRECT_URI` - OAuth redirect URI

## Testing

### Unit Tests

```bash
cd lambda
npm test
```

Tests cover:
- Database utilities
- Notion utilities
- Handler logic

### Integration Tests

```bash
cd lambda
npm run test:integration
```

Tests full Alexa request flow with mocked dependencies.

## Troubleshooting

### Common Issues

**"License key invalid"**
- Check license exists in `licenses` table
- Verify status is `active`
- Ensure license key matches exactly

**"Notion database not found"**
- Verify database names match exactly: `Tasks`, `Focus_Logs`, `Energy_Logs`
- Check user has access to databases
- Verify Notion token is valid

**"OAuth callback fails"**
- Verify redirect URI matches Notion OAuth settings
- Check environment variables are set
- Ensure HTTPS is enabled (required for OAuth)

**"Lambda timeout"**
- Increase timeout in `template.yaml`
- Check Notion API response times
- Review CloudWatch logs

### Debugging

1. Check CloudWatch logs for Lambda errors
2. Review Supabase logs for database issues
3. Test Notion API directly with user token
4. Verify environment variables are set correctly

## Support

For issues or questions, contact the development team or refer to the user guide.

