# Setup Instructions

Complete setup guide for deploying the Notion Assistant Alexa Skill.

## Prerequisites

- Node.js 20.x or later
- AWS Account with CLI configured
- Supabase account
- Notion account
- Vercel account (for web login)
- Alexa Developer account

## Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Create a new project
3. Note your project URL and service role key

### 1.2 Run Database Schema

1. Go to SQL Editor in Supabase
2. Copy contents of `docs/supabase-schema.sql`
3. Run the SQL script
4. Verify tables are created: `users`, `licenses`

### 1.3 Add License Keys

```sql
INSERT INTO licenses (license_key, status, notes) VALUES
  ('YOUR-LICENSE-KEY-1', 'active', 'Client license'),
  ('YOUR-LICENSE-KEY-2', 'active', 'Another license');
```

## Step 2: Notion OAuth Setup

### 2.1 Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it "Notion Assistant Alexa Skill"
4. Select your workspace
5. Set capabilities:
   - ✅ Read content
   - ✅ Update content
   - ✅ Insert content
6. Copy the **Internal Integration Token** (you'll need this later)

### 2.2 Create OAuth App (for Account Linking)

**Important:** This is different from the Internal Integration in Step 2.1. You need an **OAuth integration** for account linking.

1. Go to https://www.notion.so/my-integrations
2. Click **"New integration"** button
3. Select **"Public integration"** (not Internal integration)
   - This enables OAuth flow for users to authorize access
4. Fill in the integration details:
   - **Name**: "Notion Assistant Alexa Skill" (or any name you prefer)
   - **Logo**: Optional (upload an icon if you want)
   - **Associated workspace**: Select your workspace
5. Set **Redirect URIs**:
   - Click "Add redirect URI"
   - Enter: `https://your-web-app.vercel.app/api/oauth/callback`
   - **Note:** Replace `your-web-app.vercel.app` with your actual Vercel domain
   - You can add multiple redirect URIs (e.g., localhost for testing)
6. Click **"Submit"** to create the integration
7. After creation, you'll see:
   - **OAuth client ID** - This is your `NOTION_CLIENT_ID`
   - **OAuth client secret** - This is your `NOTION_CLIENT_SECRET`
   - **⚠️ Important:** Copy the client secret immediately - you can only see it once!
8. Copy both values and save them securely

**Where to find them:**
- After creating the integration, you'll be on the integration's settings page
- The **OAuth client ID** is visible at the top of the page
- The **OAuth client secret** is shown once after creation - click "Show" to reveal it
- If you lose the secret, you'll need to create a new integration or regenerate it

**For testing (localhost):**
- You can add `http://localhost:3000/api/oauth/callback` as a redirect URI
- This allows you to test the OAuth flow locally before deploying

## Step 3: AWS Lambda Setup

### 3.1 Install Dependencies

```bash
cd lambda
npm install
```

### 3.2 Configure Environment Variables

Create `lambda/.env` (for local testing):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

### 3.3 Build

```bash
npm run build
```

### 3.4 Deploy with SAM

```bash
# Install AWS SAM CLI if not installed
# https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

sam build
sam deploy --guided
```

Or use the GitHub Actions workflow (see Step 6).

## Step 4: Web Login Setup

### 4.1 Install Dependencies

```bash
cd web-login
npm install
```

### 4.2 Configure Environment Variables

Create `web-login/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
NOTION_REDIRECT_URI=https://your-web-app.vercel.app/api/oauth/callback
```

### 4.3 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd web-login
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Step 5: Alexa Skill Setup

### 5.1 Create Skill in Developer Console

1. Go to https://developer.amazon.com/alexa/console/ask
2. Click "Create Skill"
3. Choose:
   - Skill name: "Notion Assistant"
   - Default language: English (US)
   - Model: Custom
   - Hosting: Provision your own

### 5.2 Upload Interaction Model

1. In the Developer Console, go to "Build" → "Interaction Model"
2. Click "JSON Editor"
3. Copy contents of `docs/alexa-interaction-model.json`
4. Paste and click "Save Model"
5. Click "Build Model"

### 5.3 Configure Endpoint

1. Go to "Endpoint"
2. Select "AWS Lambda ARN"
3. Enter your Lambda function ARN (from Step 3.4)
4. Click "Save Endpoints"

### 5.4 Configure Account Linking

1. Go to "Account Linking"
2. Enable account linking
3. Set:
   - Authorization URI: `https://your-web-app.vercel.app/api/oauth/initiate`
   - Access Token URI: `https://your-web-app.vercel.app/api/oauth/callback`
   - Client ID: (use a simple identifier, e.g., "notion-assistant")
   - Client Secret: (generate a random string)
   - Scopes: (leave empty or add as needed)
4. Click "Save"

### 5.5 Configure Permissions

1. Go to "Permissions"
2. Enable:
   - Full Address
   - Full Name
   - Email Address

### 5.6 Test

1. Go to "Test" tab
2. Enable testing for your account
3. Try: "open notion assistant"

## Step 6: CI/CD Setup (Optional)

### 6.1 GitHub Secrets

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

### 6.2 Workflows

The GitHub Actions workflows (`.github/workflows/`) will automatically deploy on push to `main`.

## Step 7: Verification

### 7.1 Test Lambda Function

```bash
# Test locally with SAM
sam local invoke NotionAssistantFunction --event test-event.json
```

### 7.2 Test Web Login

1. Visit your Vercel deployment URL
2. Enter test email and license key
3. Verify OAuth flow works

### 7.3 Test Alexa Skill

1. Enable skill in Alexa app
2. Link account
3. Test all intents:
   - "Alexa, open Notion Assistant"
   - "Alexa, dump my brain"
   - "Alexa, what's my priority?"

## Troubleshooting

### Lambda Deployment Fails

- Check AWS credentials are configured
- Verify SAM CLI is installed
- Check `template.yaml` syntax

### Web Login OAuth Fails

- Verify redirect URI matches Notion OAuth settings
- Check environment variables are set
- Ensure HTTPS is enabled (Vercel provides this)

### Alexa Skill Not Responding

- Verify Lambda ARN is correct
- Check CloudWatch logs for errors
- Ensure interaction model is built
- Verify account linking is configured

### Database Errors

- Verify Supabase URL and key are correct
- Check tables exist: `users`, `licenses`
- Verify RLS policies allow service role access

## Next Steps

1. Add more license keys as needed
2. Monitor CloudWatch logs for errors
3. Set up alerts for Lambda errors
4. Configure custom domain for web login (optional)
5. Set up analytics (optional)

## Support

For issues during setup, check:
- AWS CloudWatch logs
- Vercel deployment logs
- Supabase logs
- Alexa Developer Console test results

---

**Important:** Keep all secrets and API keys secure. Never commit them to version control.

