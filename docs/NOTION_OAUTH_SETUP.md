# Notion OAuth Setup Guide

Detailed step-by-step guide for setting up Notion OAuth integration.

## Overview

You need to create a **Public OAuth Integration** in Notion to enable account linking. This allows users to authorize your Alexa skill to access their Notion workspace.

## Step-by-Step Instructions

### Step 1: Navigate to Notion Integrations

1. Go to https://www.notion.so/my-integrations
2. Sign in with your Notion account
3. You'll see a list of your existing integrations (if any)

### Step 2: Create New Public Integration

1. Click the **"New integration"** button (usually in the top right)
2. You'll see two options:
   - **Internal integration** - For server-to-server access (not what we need)
   - **Public integration** - For OAuth user authorization (this is what we need)
3. Select **"Public integration"**

### Step 3: Configure Integration Details

Fill in the form:

- **Integration name**: 
  - Example: "Notion Assistant Alexa Skill"
  - This name will be shown to users during OAuth

- **Logo** (optional):
  - Upload a square image (recommended: 512x512px)
  - This appears in the OAuth authorization screen

- **Associated workspace**:
  - Select your workspace
  - This is where the integration will be created

### Step 4: Set Redirect URIs

This is critical for OAuth to work:

1. In the **"Redirect URIs"** section, click **"Add redirect URI"**
2. Add your production URL:
   ```
   https://your-web-app.vercel.app/api/oauth/callback
   ```
   Replace `your-web-app.vercel.app` with your actual Vercel domain

3. For local development, also add:
   ```
   http://localhost:3000/api/oauth/callback
   ```

4. You can add multiple redirect URIs (one per line)

**Important Notes:**
- The redirect URI must match **exactly** (including `https://` and `/api/oauth/callback`)
- Notion requires HTTPS for production (localhost is OK for testing)
- The path `/api/oauth/callback` must match your Next.js API route

### Step 5: Submit and Get Credentials

1. Click **"Submit"** to create the integration
2. You'll be redirected to the integration's settings page
3. On this page, you'll see:

   **OAuth client ID**
   - Visible at the top of the page
   - Looks like: `abc123def456-7890-ghij-klmn-opqrstuvwxyz`
   - This is your `NOTION_CLIENT_ID`
   - Copy this value

   **OAuth client secret**
   - Click the **"Show"** button to reveal it
   - Looks like: `secret_abc123def456...`
   - This is your `NOTION_CLIENT_SECRET`
   - **⚠️ CRITICAL:** Copy this immediately - you can only see it once!
   - If you lose it, you'll need to regenerate it (which invalidates the old one)

### Step 6: Save Credentials Securely

Save both values in a secure location:

```
NOTION_CLIENT_ID=abc123def456-7890-ghij-klmn-opqrstuvwxyz
NOTION_CLIENT_SECRET=secret_abc123def456...
```

**Security Best Practices:**
- Never commit these to version control
- Store in environment variables
- Use a password manager or secure vault
- Share only with team members who need access

## Using the Credentials

### In Web Login App

Add to `web-login/.env.local`:

```env
NOTION_CLIENT_ID=your-client-id-here
NOTION_CLIENT_SECRET=your-client-secret-here
NOTION_REDIRECT_URI=https://your-web-app.vercel.app/api/oauth/callback
```

### In Vercel (Production)

Add as environment variables in Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable:
   - `NOTION_CLIENT_ID`
   - `NOTION_CLIENT_SECRET`
   - `NOTION_REDIRECT_URI`

### In GitHub Actions (CI/CD)

Add as GitHub Secrets:
1. Go to repository settings
2. Navigate to "Secrets and variables" → "Actions"
3. Add repository secrets:
   - `NOTION_CLIENT_ID`
   - `NOTION_CLIENT_SECRET`
   - `NOTION_REDIRECT_URI`

## Troubleshooting

### "Invalid redirect URI" Error

**Problem:** OAuth fails with redirect URI mismatch

**Solutions:**
1. Verify the redirect URI in Notion matches exactly (including protocol and path)
2. Check for trailing slashes - they must match exactly
3. Ensure you're using `https://` for production (not `http://`)
4. Verify the path is `/api/oauth/callback` (matches your Next.js route)

### "Client secret not found" Error

**Problem:** Lost the client secret

**Solutions:**
1. Go back to https://www.notion.so/my-integrations
2. Find your integration
3. Click on it to open settings
4. Look for "Regenerate client secret" option
5. **Warning:** Regenerating invalidates the old secret - update all places using it

### "Integration not found" Error

**Problem:** Integration was deleted or doesn't exist

**Solutions:**
1. Verify you're using the correct Client ID
2. Check that the integration still exists in your Notion workspace
3. Ensure you have access to the workspace where it was created
4. Create a new integration if needed

## Testing OAuth Flow

### Local Testing

1. Add `http://localhost:3000/api/oauth/callback` to redirect URIs
2. Run web login app: `cd web-login && npm run dev`
3. Visit http://localhost:3000
4. Try the OAuth flow
5. Check browser console and server logs for errors

### Production Testing

1. Ensure production redirect URI is added in Notion
2. Deploy web login app to Vercel
3. Visit your production URL
4. Test the complete OAuth flow
5. Verify token is stored in Supabase

## Additional Resources

- [Notion API Documentation](https://developers.notion.com/)
- [OAuth 2.0 Guide](https://developers.notion.com/reference/authorization)
- [Notion Integrations Guide](https://developers.notion.com/docs/getting-started)

## Quick Reference

| What | Where to Find |
|------|---------------|
| Create Integration | https://www.notion.so/my-integrations → "New integration" → "Public integration" |
| Client ID | Integration settings page (top of page) |
| Client Secret | Integration settings page (click "Show" to reveal) |
| Redirect URI | Integration settings → "Redirect URIs" section |
| Regenerate Secret | Integration settings → "Regenerate client secret" |

---

**Remember:** Keep your client secret secure and never expose it in client-side code!

