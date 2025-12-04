# Voice Planner Alexa Skill - Developer Guide

Complete setup and technical documentation for developers.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Database Setup](#database-setup)
4. [Notion OAuth Setup](#notion-oauth-setup)
5. [AWS Lambda Setup](#aws-lambda-setup)
6. [Web Login Setup](#web-login-setup)
7. [Alexa Skill Setup](#alexa-skill-setup)
8. [Environment Variables](#environment-variables)
9. [Authentication System](#authentication-system)
10. [Deployment](#deployment)
11. [Project Structure](#project-structure)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 22.x or later
- AWS Account with CLI configured
- Supabase account
- Notion account
- Vercel account (for web login)
- Alexa Developer account

---

## Architecture Overview

The Voice Planner Alexa Skill consists of three main components:

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

---

## Database Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Create a new project
3. Note your project URL and service role key

### Step 2: Run Database Schema

1. Go to SQL Editor in Supabase
2. Copy contents of `docs/database-schema.sql`
3. Run the SQL script
4. Verify tables are created: `users`, `licenses`, `oauth_sessions`, `oauth_authorization_codes`, `oauth_access_tokens`, `oauth_refresh_tokens`

### Step 3: Add License Keys

```sql
INSERT INTO licenses (license_key, status, notes) VALUES
  ('YOUR-LICENSE-KEY-1', 'active', 'Client license'),
  ('YOUR-LICENSE-KEY-2', 'active', 'Another license');
```

### Fresh Database Setup

If starting from scratch:

1. **Delete all existing tables** (if any)
   - Go to Supabase Dashboard → Table Editor
   - Delete all tables manually, OR
   - Run: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` (⚠️ This deletes EVERYTHING)

2. **Run the complete schema**
   - Open `docs/database-schema.sql`
   - Copy entire contents
   - Paste into Supabase SQL Editor
   - Click "Run" or press Ctrl+Enter

3. **Verify setup**
   - Check that all tables exist
   - Verify columns in `users` table include all required fields

### Database Migration

If you have an existing database and need to add new fields:

1. Run the migration script from `docs/database-schema.sql` (it uses `IF NOT EXISTS` clauses)
2. The schema will add missing columns without affecting existing data

---

## Notion OAuth Setup

### Step 1: Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Select **"Public integration"** (not Internal integration)
4. Fill in the integration details:
   - **Name**: "Voice Planner Alexa Skill" (or any name you prefer)
   - **Logo**: Optional (upload an icon if you want)
   - **Associated workspace**: Select your workspace
5. Set **Redirect URIs**:
   - Click "Add redirect URI"
   - Enter: `https://your-web-app.vercel.app/api/oauth/callback`
   - For local testing: `http://localhost:3000/api/oauth/callback`
6. Click **"Submit"** to create the integration
7. After creation, you'll see:
   - **OAuth client ID** - This is your `NOTION_CLIENT_ID`
   - **OAuth client secret** - This is your `NOTION_CLIENT_SECRET`
   - **⚠️ Important:** Copy the client secret immediately - you can only see it once!

### Step 2: Save Credentials Securely

Save both values in environment variables:

```
NOTION_CLIENT_ID=abc123def456-7890-ghij-klmn-opqrstuvwxyz
NOTION_CLIENT_SECRET=secret_abc123def456...
```

**Security Best Practices:**
- Never commit these to version control
- Store in environment variables
- Use a password manager or secure vault
- Share only with team members who need access

---

## AWS Lambda Setup

### Step 1: Install Dependencies

```bash
cd lambda
npm install
```

### Step 2: Configure Environment Variables

Create `lambda/.env` (for local testing):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

### Step 3: Build

```bash
npm run build
```

### Step 4: Configure AWS Credentials

**Option 1: Using AWS CLI (Recommended)**

```bash
aws configure
```

You'll be prompted for:
- **AWS Access Key ID**: Your AWS access key
- **AWS Secret Access Key**: Your AWS secret key
- **Default region name**: `eu-north-1` (or your preferred region)
- **Default output format**: `json` (recommended)

**Option 2: Using Environment Variables**

```bash
# Windows PowerShell
$env:AWS_ACCESS_KEY_ID="your-access-key-id"
$env:AWS_SECRET_ACCESS_KEY="your-secret-access-key"
$env:AWS_DEFAULT_REGION="eu-north-1"

# Linux/Mac
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_DEFAULT_REGION="eu-north-1"
```

**Required IAM Permissions:**
- Create and manage Lambda functions
- Create and manage IAM roles
- Create and manage CloudFormation stacks
- Upload to S3 (for SAM deployment artifacts)

### Step 5: Deploy with SAM

```bash
# Install AWS SAM CLI if not installed
# https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

sam build
sam deploy --guided
```

Or use your profile:

```bash
sam deploy --profile your-profile-name
```

### Troubleshooting Lambda Deployment

**"Cannot find module 'ask-sdk-core'" error:**

```bash
cd lambda
rm -rf node_modules package-lock.json
npm install
sam build --use-container
sam deploy
```

**"Unable to locate credentials" error:**
- Run `aws configure` to set up credentials
- Or set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables
- Verify with `aws sts get-caller-identity`

---

## Web Login Setup

### Step 1: Install Dependencies

```bash
cd web-login
npm install
```

### Step 2: Configure Environment Variables

Create `web-login/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Notion OAuth
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
NOTION_REDIRECT_URI=https://your-domain.vercel.app/api/oauth/callback

# Alexa OAuth (for account linking)
ALEXA_OAUTH_CLIENT_ID=your-alexa-client-id
ALEXA_OAUTH_CLIENT_SECRET=your-alexa-client-secret
JWT_SECRET=your-jwt-secret-key

# Optional: Skip license check for testing
NEXT_PUBLIC_SKIP_LICENSE_CHECK=true
```

### Step 3: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd web-login
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

### Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `NOTION_CLIENT_ID`
   - `NOTION_CLIENT_SECRET`
   - `NOTION_REDIRECT_URI`
   - `ALEXA_OAUTH_CLIENT_ID`
   - `ALEXA_OAUTH_CLIENT_SECRET`
   - `JWT_SECRET`
4. **Important**: Make sure to select the correct environment (Production, Preview, Development)
5. Redeploy your application after adding variables

---

## Alexa Skill Setup

### Step 1: Create Skill in Developer Console

1. Go to https://developer.amazon.com/alexa/console/ask
2. Click "Create Skill"
3. Choose:
   - Skill name: "Voice Planner"
   - Default language: English (US)
   - Model: Custom
   - Hosting: Provision your own

### Step 2: Upload Interaction Model

1. In the Developer Console, go to "Build" → "Interaction Model"
2. Click "JSON Editor"
3. Copy contents of `docs/alexa-interaction-model.json`
4. Paste and click "Save Model"
5. Click "Build Model"
6. Wait for build to complete (1-2 minutes)

### Step 3: Configure Endpoint

1. Go to "Endpoint"
2. Select "AWS Lambda ARN"
3. Enter your Lambda function ARN (from Step 5 of Lambda Setup)
4. Click "Save Endpoints"

### Step 4: Configure Account Linking

1. Go to "Account Linking"
2. Enable account linking
3. Set:
   - **Authorization URI**: `https://your-web-app.vercel.app/api/oauth/authorize`
   - **Access Token URI**: `https://your-web-app.vercel.app/api/oauth/token`
   - **Client ID**: (use your `ALEXA_OAUTH_CLIENT_ID`)
   - **Client Secret**: (use your `ALEXA_OAUTH_CLIENT_SECRET`)
   - **Authorization Grant Type**: `Auth Code Grant`
   - **Scope**: `alexa`
   - **Redirect URLs**: `https://your-web-app.vercel.app/api/oauth/callback`
4. Click "Save"
5. Click "Build Model" again (to apply account linking)

### Step 5: Configure Permissions

1. Go to "Permissions"
2. Enable:
   - Full Address
   - Full Name
   - Email Address

### Step 6: Test

1. Go to "Test" tab
2. Enable testing for your account
3. Try: "open Voice Planner"

---

## Environment Variables

### Lambda Environment Variables

Set in `template.yaml` or AWS Lambda console:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key

### Web Login Environment Variables

Set in `web-login/.env.local` (local) or Vercel dashboard (production):

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `NOTION_CLIENT_ID` - Notion OAuth client ID
- `NOTION_CLIENT_SECRET` - Notion OAuth client secret
- `NOTION_REDIRECT_URI` - OAuth redirect URI
- `ALEXA_OAUTH_CLIENT_ID` - Alexa OAuth client ID
- `ALEXA_OAUTH_CLIENT_SECRET` - Alexa OAuth client secret
- `JWT_SECRET` - Secret key for signing website JWT tokens (for website sessions, not Alexa tokens)
- `NEXT_PUBLIC_SKIP_LICENSE_CHECK` - Set to `true` for testing (optional)

---

## Authentication System

### Overview

The authentication system provides:
- **Email/Password Authentication** - Traditional signup/login
- **Social Login** - Google, Microsoft, Apple OAuth
- **Onboarding Flow** - Step-by-step setup process
- **Notion Integration** - Automatic workspace setup
- **Amazon Linking** - Required for Alexa skill
- **License Activation** - Final step to activate the skill

### User Flow

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

### Supabase Auth Configuration

1. **Enable Authentication Providers**

   In Supabase Dashboard → Authentication → Providers:

   - **Email Provider**
     - Enable "Enable Email Signup"
     - Enable "Confirm email"
     - Set email template (optional)

   - **Google OAuth**
     - Enable Google provider
     - Add Client ID and Client Secret
     - Set redirect URL: `https://your-domain.com/auth/callback`

   - **Microsoft/Azure OAuth**
     - Enable Azure provider
     - Add Application (client) ID and Secret
     - Set redirect URL: `https://your-domain.com/auth/callback`

   - **Apple OAuth**
     - Enable Apple provider
     - Add Service ID, Key ID, and Private Key
     - Set redirect URL: `https://your-domain.com/auth/callback`

2. **Configure Redirect URLs**

   In Supabase Dashboard → Authentication → URL Configuration:

   - Site URL: `https://your-domain.com`
   - Redirect URLs:
     - `https://your-domain.com/auth/callback`
     - `http://localhost:3000/auth/callback` (for development)

### Automatic Notion Workspace Setup

When a user connects Notion, the system automatically:

1. Creates a "Privacy" page in the user's workspace
2. Creates 6 databases on the Privacy page:
   - **Tasks** - Task management
   - **Shopping** - Shopping list items
   - **Workouts** - Workout logs
   - **Meals** - Meal tracking
   - **Notes** - Quick notes
   - **EnergyLogs** - Energy level tracking

3. Stores all database IDs in the `users` table for future reference

### OAuth Flow

The system uses OAuth2 Authorization Code Grant flow:

1. User initiates account linking from Alexa
2. Redirected to authorization endpoint
3. System validates user has:
   - Active license
   - Notion connection
   - Valid session
4. Authorization code generated
5. Code exchanged for opaque access token (stored in database, not a JWT)
6. Token stored in `oauth_access_tokens` table
7. Token sent to Alexa for account linking

---

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

### CI/CD Setup (Optional)

#### GitHub Secrets

Add these secrets to your GitHub repository:

**For Lambda:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ALEXA_SKILL_ID`

**For Web Login:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `NOTION_REDIRECT_URI`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

#### Workflows

The GitHub Actions workflows (`.github/workflows/`) will automatically deploy on push to `main`.

---

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
│   ├── database-schema.sql
│   ├── user_guide.md
│   ├── developer_guide.md
│   ├── test_guide.md
│   └── alexa-interaction-model.json
└── .github/workflows/      # CI/CD pipelines
```

### Backend (Lambda)

**Entry Point**: `lambda/src/index.ts`

**Handlers**: Each intent has a dedicated handler in `lambda/src/handlers/`:
- LaunchRequestHandler
- AddTaskHandler
- GetTasksHandler
- CompleteTaskHandler
- UpdateTaskStatusHandler
- DeleteTaskHandler
- ShoppingListHandler
- AddWorkoutHandler
- LogMealHandler
- AddNoteHandler
- ReadNotesHandler
- LogEnergyHandler
- TaskCountHandler
- CompletedCountHandler
- SummaryHandler
- NextDeadlineHandler

**Interceptors**: Request interceptors in `lambda/src/interceptors/`:
- AuthInterceptor - Validates access tokens (opaque tokens or JWTs) via introspection endpoint
- NotionConnectionInterceptor - Sets up Notion client

**Utilities**: Utility functions in `lambda/src/utils/`:
- database.ts - Supabase client and user operations
- notion.ts - Notion API wrapper with retry logic
- alexa.ts - Alexa response builders

### Web Login (Next.js)

**Pages**:
- `/` - Login/signup page
- `/dashboard` - User dashboard
- `/alexa/link` - Alexa account linking instructions
- `/billing` - License purchase page
- `/notion` - Notion connection page

**API Routes**:
- `/api/auth/sync-user` - Sync Supabase Auth user
- `/api/users/me` - Get current user data
- `/api/oauth/authorize` - OAuth authorization endpoint
- `/api/oauth/token` - OAuth token exchange endpoint
- `/api/oauth/callback` - Notion OAuth callback
- `/api/billing/generate-test-token` - **REMOVED** - Use Stripe checkout instead

---

## Troubleshooting

### Lambda Deployment Fails

**"Unable to locate credentials" error:**
- Run `aws configure` to set up credentials
- Or set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables
- Verify with `aws sts get-caller-identity`

**Other issues:**
- Verify SAM CLI is installed: `sam --version`
- Check `template.yaml` syntax
- Ensure you have IAM permissions for Lambda, CloudFormation, and S3
- Check CloudFormation console for stack creation errors

### Web Login OAuth Fails

- Verify redirect URI matches Notion OAuth settings
- Check environment variables are set
- Ensure HTTPS is enabled (Vercel provides this)
- Check Vercel function logs for errors

### Alexa Skill Not Responding

- Verify Lambda ARN is correct
- Check CloudWatch logs for errors
- Ensure interaction model is built
- Verify account linking is configured
- Check that user has active license and Notion connection

### Database Errors

- Verify Supabase URL and key are correct
- Check tables exist: `users`, `licenses`, `oauth_*` tables
- Verify RLS policies allow service role access
- Check database connection in Supabase dashboard

### Email Verification Not Received

- Check spam folder
- Verify email address is correct
- Check Supabase Auth logs
- Consider disabling email confirmation for testing

### Notion Setup Fails

- Check Notion OAuth credentials
- Verify Notion integration has correct permissions
- Check logs for specific error messages
- Verify redirect URI matches exactly

### Account Linking Fails

- Check `ALEXA_OAUTH_CLIENT_ID` and `ALEXA_OAUTH_CLIENT_SECRET` are set
- Verify redirect URIs match in Developer Console
- Check user has active license and Notion connection
- Verify opaque token generation is working (via Stripe webhook)

---

## Next Steps

1. Add more license keys as needed
2. Monitor CloudWatch logs for errors
3. Set up alerts for Lambda errors
4. Configure custom domain for web login (optional)
5. Set up analytics (optional)

---

## Support

For issues during setup, check:
- AWS CloudWatch logs
- Vercel deployment logs
- Supabase logs
- Alexa Developer Console test results

---

**Important:** Keep all secrets and API keys secure. Never commit them to version control.

