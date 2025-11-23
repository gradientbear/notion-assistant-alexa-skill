# Frequently Asked Questions

## 1. Does everyone need their own Notion account?

**Yes!** This project is designed so that **each user links their own Notion account**.

### How it works:
- Each user has their own Notion workspace
- Each user creates their own databases (Tasks, Focus_Logs, Energy_Logs) in their workspace
- When a user links their account via OAuth, their Notion access token is stored securely
- All task management happens in the user's personal Notion workspace
- Users cannot see or access each other's data

### Why this design?
- **Privacy**: Each user's data stays in their own Notion workspace
- **Flexibility**: Users can customize their databases as needed
- **Security**: No shared data or cross-user access
- **Scalability**: Each user manages their own Notion workspace

## 2. Do I need to copy files to Amazon Console?

**No!** You don't copy code files to the Amazon Developer Console. Here's what goes where:

### Amazon Developer Console (Alexa Skills Kit)
- **Only upload**: `docs/alexa-interaction-model.json`
  - Go to Build → Interaction Model → JSON Editor
  - Copy and paste the contents
  - This defines the voice commands and intents

### AWS Lambda
- **Deploy the Lambda code** (not copy to console)
  - Use AWS SAM CLI: `sam build && sam deploy`
  - Or use GitHub Actions (automatic deployment)
  - The Lambda function code lives in AWS, not in the console

### Vercel (Web Login)
- **Deploy the Next.js app** to Vercel
  - Use Vercel CLI or connect GitHub repo
  - The web login page is hosted on Vercel

### Summary:
```
Amazon Console → Upload interaction model JSON only
AWS Lambda → Deploy code (not copy files)
Vercel → Deploy web app (not copy files)
Supabase → Run SQL schema (not copy files)
```

## 3. Where can managers manage license keys?

Currently, **license keys are managed directly in Supabase database**. There's no built-in admin interface yet.

### Current Method: Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor**
3. Select the **`licenses`** table
4. You can:
   - **Add new licenses**: Click "Insert row"
   - **Activate/Deactivate**: Change `status` field
   - **View all licenses**: See the full list
   - **Add notes**: Use the `notes` field for tracking

### SQL Method (Alternative)

You can also use SQL in Supabase's SQL Editor:

```sql
-- Add a new license
INSERT INTO licenses (license_key, status, notes) 
VALUES ('NEW-LICENSE-123', 'active', 'Client: John Doe');

-- Deactivate a license
UPDATE licenses 
SET status = 'inactive' 
WHERE license_key = 'OLD-LICENSE-456';

-- View all active licenses
SELECT * FROM licenses WHERE status = 'active';
```

### Admin Interface (Optional)

A simple admin web interface is available in the `admin/` folder:

1. **Navigate to admin folder:**
```bash
cd admin
npm install
```

2. **Set environment variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_SERVICE_KEY=your-service-role-key
```

3. **Run locally:**
```bash
npm run dev
```

4. **Access at:** http://localhost:3001

**Features:**
- View all license keys
- Add new licenses
- Activate/Deactivate licenses
- Delete licenses
- View all users
- See which users have linked Notion accounts

**Security Note:** Add authentication before deploying to production!

---

## Additional Clarifications

### Deployment Architecture

```
┌─────────────────────────────────────────┐
│  Amazon Developer Console               │
│  (Upload interaction model JSON only)    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  AWS Lambda                              │
│  (Deploy via SAM/GitHub Actions)        │
│  - Handles all Alexa requests           │
└──────────────┬──────────────────────────┘
               │
               ├─────────────────┐
               ▼                 ▼
┌──────────────────┐   ┌──────────────────┐
│  Supabase        │   │  Notion API      │
│  (Run SQL schema)│   │  (User's account)│
└──────────────────┘   └──────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Vercel                                  │
│  (Deploy Next.js app)                   │
│  - Web login page                       │
│  - OAuth flow                           │
└─────────────────────────────────────────┘
```

### What Gets Deployed Where

| Component | Location | How to Deploy |
|-----------|----------|---------------|
| Interaction Model | Amazon Console | Upload JSON via web interface |
| Lambda Function | AWS Lambda | `sam deploy` or GitHub Actions |
| Web Login | Vercel | `vercel --prod` or GitHub Actions |
| Database Schema | Supabase | Run SQL in SQL Editor |

---

Need more clarification? Check the [Setup Instructions](SETUP_INSTRUCTIONS.md) for detailed deployment steps.

