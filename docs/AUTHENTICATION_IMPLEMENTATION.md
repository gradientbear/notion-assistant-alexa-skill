# Authentication Implementation Guide

This document describes the complete authentication flow implementation, including user registration, Notion connection, and automatic workspace setup.

## Overview

The authentication system handles:
1. **User Registration** - Users register with email and license key
2. **Notion OAuth Connection** - Users authorize the app to access their Notion workspace
3. **Automatic Workspace Setup** - Creates Privacy page and three databases automatically
4. **Graceful Denial Handling** - Allows users to retry connection if they deny access

## Database Schema Updates

### New Fields in `users` Table

The `users` table has been extended with the following fields:

- `notion_setup_complete` (BOOLEAN) - Indicates if Notion workspace setup is complete
- `privacy_page_id` (TEXT) - Stores the ID of the created Privacy page
- `tasks_db_id` (TEXT) - Stores the ID of the Tasks database
- `focus_logs_db_id` (TEXT) - Stores the ID of the Focus_Logs database
- `energy_logs_db_id` (TEXT) - Stores the ID of the Energy_Logs database

### Migration

For existing databases, run:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_setup_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_page_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tasks_db_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_logs_db_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_logs_db_id TEXT;
```

## Authentication Flow

### Step 1: User Registration

1. User enters email and license key on the web login page
2. System validates license key against `licenses` table
3. If valid, OAuth flow is initiated

### Step 2: Notion OAuth

1. User is redirected to Notion OAuth authorization page
2. User can either:
   - **Accept**: Grants access to their Notion workspace
   - **Deny**: Cancels the connection

### Step 3: OAuth Callback - Success Path

When user accepts Notion connection:

1. **Token Exchange**: Authorization code is exchanged for access token
2. **Workspace Setup**: Automatic setup is triggered:
   - Creates "Privacy" page in user's workspace
   - Creates "Tasks" database on Privacy page
   - Creates "Focus_Logs" database on Privacy page
   - Creates "Energy_Logs" database on Privacy page
3. **User Record Update**: User record is updated with:
   - Notion access token
   - Privacy page ID
   - All three database IDs
   - `notion_setup_complete = true`
4. **Response**: 
   - For Alexa: Returns OAuth2 token format
   - For Web: Redirects to success page

### Step 4: OAuth Callback - Denial Path

When user denies Notion connection:

1. **Partial User Creation**: User record is created/updated with:
   - Email and license key
   - `notion_token = null`
   - `notion_setup_complete = false`
2. **Response**:
   - For Alexa: Returns `access_denied` error
   - For Web: Redirects to error page with retry option
3. **Retry Capability**: User can retry the connection later

## Implementation Details

### Notion Setup Functions

Located in `web-login/app/api/oauth/notion-setup.ts`:

- `setupNotionWorkspace(accessToken)` - Main setup function
- `createPrivacyPage(client)` - Creates Privacy page
- `createTasksDatabase(client, parentPageId)` - Creates Tasks database
- `createFocusLogsDatabase(client, parentPageId)` - Creates Focus_Logs database
- `createEnergyLogsDatabase(client, parentPageId)` - Creates Energy_Logs database

### Database Functions

Located in `lambda/src/utils/database.ts`:

- `updateUserNotionSetup(userId, setupData)` - Updates user with setup information
- `createOrUpdateUser(...)` - Enhanced to handle setup status

### OAuth Callback

Located in `web-login/app/api/oauth/callback/route.ts`:

- Handles both success and denial scenarios
- Automatically triggers workspace setup on success
- Stores all database IDs for future reference
- Handles both Alexa and web flows

## Handling User Denial

### When User Denies Connection

1. **User Record**: Created/updated with `notion_setup_complete = false`
2. **Error Message**: Clear message explaining they can retry
3. **Retry Flow**: User can return to login page and try again

### Retry Process

1. User visits login page (may see "denied" message)
2. User enters email and license key again
3. OAuth flow is re-initiated
4. If user accepts this time, setup proceeds normally

### Benefits

- **No Data Loss**: User registration is preserved even if Notion is denied
- **Flexible**: User can connect Notion later
- **Clear Feedback**: User knows they can retry

## Database Structure Created

### Privacy Page

A new page named "Privacy" is created in the user's workspace containing all three databases.

### Tasks Database

Properties:
- Task Name (Title)
- Priority (Select: High, Medium, Low)
- Status (Select: To Do, In Progress, Done)
- Category (Select: Work, Personal, Fitness, Shopping)
- Due Date (Date)
- Notes (Rich Text)

### Focus_Logs Database

Properties:
- Date (Date)
- Duration (minutes) (Number)
- Focus Level (Select: Low, Medium, High)
- Notes (Rich Text)

### Energy_Logs Database

Properties:
- Date (Date)
- Energy Level (Select: Low, Medium, High)
- Time of Day (Select: Morning, Afternoon, Evening)
- Notes (Rich Text)

## Error Handling

### Setup Failures

If workspace setup fails:
- User record is still created/updated with token
- `notion_setup_complete = false`
- Database IDs are set to `null`
- User can manually create databases or retry setup

### Retry Logic

All Notion API calls include:
- Automatic retry for rate limits (429 errors)
- Automatic retry for server errors (5xx)
- Maximum 3 retries with 1 second delay

### Existing Resources

The setup functions check for existing:
- Privacy pages (by name)
- Databases (by name)

If found, existing IDs are reused instead of creating duplicates.

## Testing

### Test Success Flow

1. Enter email and license key
2. Accept Notion OAuth
3. Verify Privacy page is created
4. Verify all three databases are created
5. Check user record has all IDs stored

### Test Denial Flow

1. Enter email and license key
2. Deny Notion OAuth
3. Verify user record created with `notion_setup_complete = false`
4. Verify retry option is available
5. Retry and accept - verify setup completes

## Security Considerations

1. **Token Storage**: Notion tokens stored securely in Supabase
2. **Session Management**: OAuth sessions expire after 10 minutes
3. **Error Messages**: Don't expose sensitive information in error messages
4. **Retry Limits**: Consider adding retry limits to prevent abuse

## Future Enhancements

1. **Setup Retry Endpoint**: API endpoint to retry setup if it failed
2. **Manual Setup Option**: Allow users to provide database IDs manually
3. **Setup Status Check**: Verify databases still exist and are accessible
4. **Migration Support**: Help users migrate from manual setup to automatic

## Troubleshooting

### Setup Fails Silently

- Check Notion API permissions
- Verify OAuth token is valid
- Check CloudWatch/logs for errors

### Databases Not Found

- Verify database names match exactly
- Check user has access to Privacy page
- Verify integration has necessary permissions

### User Can't Retry

- Check user record exists
- Verify `notion_setup_complete` is `false`
- Ensure OAuth session is cleaned up

---

**Note**: This implementation assumes the Notion OAuth integration has been properly configured with the correct redirect URIs and permissions.

