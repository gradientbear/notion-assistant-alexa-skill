# Voice Planner Alexa Skill — Complete Installation Guide

This guide walks you through installing and deploying the **Voice Planner** project on your own infrastructure (client-side install). Follow the steps in order.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and Install Dependencies](#2-clone-and-install-dependencies)
3. [Supabase Setup](#3-supabase-setup)
4. [Notion OAuth Setup](#4-notion-oauth-setup)
5. [Web Login App (Next.js)](#5-web-login-app-nextjs)
6. [Lambda Backend (AWS)](#6-lambda-backend-aws)
7. [Alexa Developer Console](#7-alexa-developer-console)
8. [Account Linking](#8-account-linking)
9. [Optional: Admin Panel](#9-optional-admin-panel)
10. [Verification and Testing](#10-verification-and-testing)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

Before you begin, ensure you have:

| Requirement | Details |
|-------------|---------|
| **Node.js** | Version 22.x or later. Check with `node -v`. |
| **npm** | Comes with Node.js. Check with `npm -v`. |
| **Git** | To clone the repository. |
| **AWS Account** | With permissions to create Lambda functions and IAM roles. |
| **AWS SAM CLI** | For deploying the Lambda. [Install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html). |
| **Supabase account** | Free tier is fine. [supabase.com](https://supabase.com). |
| **Notion account** | For the Notion integration. |
| **Vercel account** | For hosting the web login app. [vercel.com](https://vercel.com). |
| **Alexa Developer account** | [developer.amazon.com](https://developer.amazon.com). |

Configure AWS CLI so SAM can deploy:

```bash
aws configure
```

Enter your Access Key ID, Secret Access Key, and default region (e.g. `us-east-1`).

---

## 2. Clone and Install Dependencies

### 2.1 Clone the repository

```bash
git clone <repository-url>
cd notion-assistant-alexa-skill
```

Replace `<repository-url>` with your actual repo URL.

### 2.2 Install dependencies for all components

**Option A — From project root (recommended):**

```bash
npm install
cd lambda && npm install && cd ..
cd web-login && npm install && cd ..
```

**Option B — Using workspaces from root:**

```bash
npm install
```

**Option C — Manual per folder:**

```bash
cd lambda
npm install
cd ../web-login
npm install
cd ..
```

### 2.3 Optional: web-login extra dependencies (for license/payments)

If you use Stripe or JWT for tokens, install:

```bash
cd web-login
npm install jsonwebtoken @types/jsonwebtoken stripe
cd ..
```

---

## 3. Supabase Setup

### 3.1 Create a Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) and sign in.
2. Click **New Project**.
3. Choose organization, name the project (e.g. `voice-planner`), set a database password, and select a region. Click **Create project**.

### 3.2 Run the database schema

1. In the Supabase dashboard, open **SQL Editor**.
2. Create a new query.
3. Copy the **entire** contents of `docs/database-schema.sql` from this repo.
4. Paste into the SQL Editor and click **Run** (or press Ctrl+Enter).
5. Confirm there are no errors. You should see messages about tables and migrations.

### 3.3 Get API keys

1. In Supabase: **Settings** → **API**.
2. Note:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`) → you will use this as `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`.
   - **Project API keys**:
     - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role secret** → `SUPABASE_SERVICE_KEY` (keep this secret; never expose in frontend code).

You will use these in the Web Login app and in the Lambda.

---

## 4. Notion OAuth Setup

### 4.1 Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations).
2. Click **+ New integration**.
3. Name it (e.g. "Voice Planner"), select your workspace, and create.
4. Open the integration and note:
   - **OAuth domain & redirect URI**: You will set the redirect URI in the next step.

### 4.2 Configure OAuth (redirect URI)

1. In the integration, find **Redirect URIs**.
2. Add your web app callback URL. It must be exactly:
   - **Production:** `https://<your-vercel-domain>/api/oauth/callback`
   - **Local testing:** `http://localhost:3000/api/oauth/callback` (if you test locally).
3. Save.

### 4.3 Get Client ID and Client Secret

1. On the same integration page you will see **Client ID** (and optionally **Client Secret** for OAuth).
2. If you use OAuth 2.0 with Notion, create/copy the **Client Secret** (shown once; store it safely).
3. You will use:
   - `NOTION_CLIENT_ID` = integration Client ID
   - `NOTION_CLIENT_SECRET` = OAuth client secret
   - `NOTION_REDIRECT_URI` = `https://<your-vercel-domain>/api/oauth/callback`

---

## 5. Web Login App (Next.js)

The web login app handles user sign-up, Notion connection, and OAuth/account linking for Alexa.

### 5.1 Create environment file

In the `web-login` folder, create `.env.local` (do not commit this file):

```bash
cd web-login
```

Create a file named `.env.local` with the following (replace placeholders with your values):

```env
# Supabase (from Step 3)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Notion OAuth (from Step 4)
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
NOTION_REDIRECT_URI=https://YOUR_VERCEL_DOMAIN/api/oauth/callback

# JWT for Alexa tokens (generate a long random string, e.g. 32+ characters)
JWT_SECRET=your-min-32-char-secret
JWT_EXPIRES_IN=3600
APP_ISS=https://YOUR_VERCEL_DOMAIN

# Alexa Account Linking (you will get Client ID/Secret in Step 8)
ALEXA_OAUTH_CLIENT_ID=your-alexa-client-id
ALEXA_OAUTH_CLIENT_SECRET=your-alexa-client-secret
ALEXA_REDIRECT_URIS=https://pitangui.amazon.com/api/skill/link/YOUR_SKILL_ID,https://alexa.amazon.co.jp/api/skill/link/YOUR_SKILL_ID,https://layla.amazon.com/api/skill/link/YOUR_SKILL_ID
```

**Notes:**

- `YOUR_VERCEL_DOMAIN`: Your actual Vercel URL (e.g. `voice-planner.vercel.app` or your custom domain). No trailing slash.
- `YOUR_SKILL_ID`: Your Alexa Skill ID from the Alexa Developer Console (you get this in Step 7). Replace `YOUR_SKILL_ID` in each redirect URI. You can deploy web-login first with a placeholder (e.g. `PLACEHOLDER`) and update `ALEXA_REDIRECT_URIS` after creating the skill, then redeploy.
- For **testing without payments**, you can add:  
  `NEXT_PUBLIC_SKIP_LICENSE_CHECK=true` and `SKIP_LICENSE_CHECK=true`.

### 5.2 Local test (optional)

```bash
npm run dev
```

Open `http://localhost:3000`. If you use local redirect, ensure Notion redirect URI includes `http://localhost:3000/api/oauth/callback`.

### 5.3 Deploy to Vercel

1. Install Vercel CLI if needed: `npm i -g vercel`.
2. From `web-login`:

   ```bash
   vercel --prod
   ```

3. When prompted, link to your Vercel account and project (or create one).
4. After deploy, go to **Project → Settings → Environment Variables** and add **the same variables** as in `.env.local` (use your production `NOTION_REDIRECT_URI` and `APP_ISS` with the Vercel URL).
5. Redeploy if you added variables after the first deploy.

Your web login base URL is then `https://YOUR_VERCEL_DOMAIN` (e.g. `https://voice-planner.vercel.app`).

---

## 6. Lambda Backend (AWS)

The Lambda handles Alexa requests and talks to Supabase and (via user tokens) Notion.

### 6.1 Add Lambda environment variables (for auth)

The SAM template only passes Supabase and one flag. For production auth, the Lambda also needs:

- `INTROSPECT_URL` — Web app introspect endpoint (validates tokens).
- `JWT_SECRET` — Same value as in web-login (for optional local JWT verification / legacy support).
- Optionally: `LEGACY_TOKEN_SUPPORT=true` during migration.

You can add these in one of two ways:

**Option A — After first deploy, in AWS Console**

1. After deploying (Step 6.2), open **AWS Console → Lambda → Your function**.
2. **Configuration → Environment variables → Edit**.
3. Add:
   - `INTROSPECT_URL` = `https://YOUR_VERCEL_DOMAIN/api/auth/introspect`
   - `JWT_SECRET` = (same as in web-login, min 32 chars)
   - (Optional) `LEGACY_TOKEN_SUPPORT` = `true` if you need it.
4. Save.

**Option B — In template before deploy**

Edit `lambda/template.yaml`: under `Globals.Function.Environment.Variables` (or under the function’s `Environment.Variables`), add:

```yaml
INTROSPECT_URL: !Ref IntrospectUrl   # add Parameter IntrospectUrl
JWT_SECRET: !Ref JwtSecret           # add Parameter JwtSecret
```

And in `Parameters` add:

```yaml
IntrospectUrl:
  Type: String
  Description: Introspect URL (e.g. https://your-app.vercel.app/api/auth/introspect)
JwtSecret:
  Type: String
  NoEcho: true
  Description: JWT secret (same as web-login)
```

Then pass them during `sam deploy --guided`.

### 6.2 Build and deploy with SAM

From the **project root**:

```bash
cd lambda
npm run build
sam build
sam deploy --guided
```

When prompted:

- **Stack name:** e.g. `voice-planner-lambda`.
- **AWS Region:** e.g. `us-east-1`.
- **Parameter SupabaseUrl:** Your Supabase project URL.
- **Parameter SupabaseServiceKey:** Your Supabase service role key.
- **Parameter AlexaSkillId:** Your Alexa Skill ID (from Step 7; you can re-run deploy later with the correct ID if you deploy the skill in Step 7 first).
- Confirm defaults for the rest (or set as needed).

Note the **Lambda function ARN** from the stack outputs; you will use it in the Alexa Developer Console.

---

## 7. Alexa Developer Console

### 7.1 Create the skill

1. Go to [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask).
2. **Create Skill** → Custom model → Create.
3. **Skill name:** e.g. "Voice Planner". **Default language:** e.g. English (US). Create.

### 7.2 Get Skill ID

In the skill’s **Build** tab, open **Skill ID** (top left or in skill summary). Copy it; you need it for:

- Lambda parameter `AlexaSkillId` (and redeploy if you didn’t have it before).
- Account Linking redirect URIs: `.../api/skill/link/YOUR_SKILL_ID`.
- Web-login `ALEXA_REDIRECT_URIS`.

### 7.3 Set the interaction model

1. In the left menu: **Build → Interaction Model**.
2. **JSON Editor** (or equivalent).
3. Replace the default model with the contents of `docs/alexa-interaction-model.json` from this repo (ensure invocation name and intents match).
4. **Save** and **Build Model**.

### 7.4 Connect the Lambda

1. **Build → Endpoint**.
2. Choose **AWS Lambda ARN** and paste the Lambda ARN from Step 6.2.
3. If your Lambda is in another AWS account, enable **Skill ID verification** and add your Skill ID.
4. Save.

---

## 8. Account Linking

This ties Alexa users to your web app (and thus Notion) via OAuth.

### 8.1 Create LWA security profile (Login with Amazon)

1. Go to [developer.amazon.com/settings/console/securityprofile/overview.html](https://developer.amazon.com/settings/console/securityprofile/overview.html).
2. **Create a new Security Profile** (or use existing). Note the name.
3. **Web Settings** → Edit:
   - **Allowed Origins:** `https://YOUR_VERCEL_DOMAIN` (no trailing slash).
   - **Allowed Return URLs:** Add exactly:
     - `https://pitangui.amazon.com/api/skill/link/YOUR_SKILL_ID`
     - `https://alexa.amazon.co.jp/api/skill/link/YOUR_SKILL_ID`
     - `https://layla.amazon.com/api/skill/link/YOUR_SKILL_ID`
   (Replace `YOUR_SKILL_ID` and use your real Vercel domain.)
4. Save. Note **Client ID** and **Client Secret** for this profile.

### 8.2 Configure Account Linking in the skill

1. In Alexa Developer Console: **Build → Account Linking**.
2. Turn **Account Linking** **On**.
3. Set:
   - **Authorization URI:** `https://YOUR_VERCEL_DOMAIN/api/oauth/authorize`
   - **Access Token URI:** `https://YOUR_VERCEL_DOMAIN/api/oauth/token`
   - **Client ID:** LWA Client ID from Step 8.1.
   - **Client Secret:** LWA Client Secret.
   - **Scope:** e.g. `alexa` (or as required by your web app).
   - **Authorization Grant Type:** Auth Code Grant.
4. **Save** and **Build Model** again if needed.

### 8.3 Sync web-login with Skill ID and redirect URIs

In Vercel (and in `.env.local` for local runs), set:

- `ALEXA_OAUTH_CLIENT_ID` = LWA Client ID.
- `ALEXA_OAUTH_CLIENT_SECRET` = LWA Client Secret.
- `ALEXA_REDIRECT_URIS` = comma-separated list of the three return URLs above (with your real Skill ID and domain).

Redeploy the web-login app after changing env vars.

---

## 9. Optional: Admin Panel

For license and user management:

1. `cd admin`
2. `npm install`
3. Create `admin/.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` = your Supabase service role key
4. Run: `npm run dev` (often on port 3001).  
Deploy to Vercel or another host if you want it in production. Restrict access (e.g. auth or IP) in production.

---

## 10. Verification and Testing

### 10.1 Web login

- Open `https://YOUR_VERCEL_DOMAIN`.
- Sign up / sign in.
- Complete Notion connection (authorize the integration in Notion when prompted).

### 10.2 Alexa link

- In the Alexa app (or alexa.amazon.com): **Skills → Your Skills → Voice Planner** (or your skill name) → **Link account** (or Enable).
- Complete the browser flow; you should land back on Alexa with “Account linked”.

### 10.3 Voice test

- “Alexa, open Voice Planner” (or your invocation name).
- Try: “Add task buy milk”, “What are my tasks?”, etc.

### 10.4 Lambda logs

- AWS Console → CloudWatch → Log groups → `/aws/lambda/<your-function-name>`.
- Look for `[AuthInterceptor] Token validated successfully` or similar to confirm auth.

---

## 11. Troubleshooting

| Issue | What to check |
|-------|----------------|
| “Missing Supabase environment variables” | `.env.local` in `web-login` and Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`. Restart dev / redeploy. |
| Notion redirect error | `NOTION_REDIRECT_URI` must exactly match the URL in Notion integration (including `/api/oauth/callback`). Same for Vercel vs local. |
| Account linking fails | LWA Allowed Return URLs must include the three Alexa redirect URIs with your real Skill ID and domain. `ALEXA_REDIRECT_URIS` in web-login must match. |
| Lambda “Token invalid” / 401 | Lambda has `INTROSPECT_URL` and `JWT_SECRET` set; introspect URL is reachable from Lambda; `JWT_SECRET` matches web-login. |
| Skill not invoking Lambda | Endpoint in Alexa Console = correct Lambda ARN; Skill ID verification enabled if cross-account; interaction model built. |
| Database errors | Re-run `docs/database-schema.sql` and check Supabase logs. For “relation does not exist”, ensure schema ran completely. |

For more detail on env vars, see `web-login/ENV_SETUP.md` and the main `README.md`.

---

## Summary Checklist

- [ ] Node.js 22+ and AWS CLI (and SAM CLI) installed
- [ ] Repo cloned; `npm install` in root, `lambda`, and `web-login`
- [ ] Supabase project created; `docs/database-schema.sql` run; API keys copied
- [ ] Notion OAuth integration created; redirect URI set; client ID/secret and redirect URI noted
- [ ] Web-login `.env.local` and Vercel env vars set (Supabase, Notion, JWT, Alexa LWA and redirect URIs)
- [ ] Web-login deployed to Vercel; production URL noted
- [ ] Lambda built and deployed with SAM; Supabase and (after Step 7) Alexa Skill ID provided; INTROSPECT_URL and JWT_SECRET set
- [ ] Alexa skill created; interaction model from `docs/alexa-interaction-model.json`; endpoint = Lambda ARN
- [ ] LWA security profile with correct origins and return URLs; Account Linking configured in skill
- [ ] User can sign up, link Notion, link Alexa account, and use the skill by voice

You have now installed the Voice Planner project end-to-end on your own accounts and infrastructure.
