# Complete Test Guide: Signup to Alexa Communication

This guide walks you through testing the entire flow from user registration to communicating with Alexa using the Alexa Developer Console.

---

## Phase 1: Web Registration & Setup

### Step 1: Sign Up on Website
1. Go to your website: `https://your-domain.com`
2. Click **"Sign Up"** tab
3. Enter:
   - Email: `test@example.com`
   - Password: (choose a secure password)
4. Click **"Sign Up"**
5. **Check your email** for verification link
6. Click verification link in email
7. Sign in with your credentials
8. **Expected:** Redirected to `/dashboard`

### Step 2: Connect Notion
1. On dashboard, click **"Connect Notion"** button
2. You'll be redirected to Notion OAuth page
3. Click **"Allow"** to authorize
4. **Expected:**
   - Privacy page created in your Notion workspace
   - 6 databases created (Tasks, Shopping, Workouts, Meals, Notes, EnergyLogs)
   - Redirected back to dashboard
   - "Connect Notion" step shows as complete

### Step 3: Purchase License (Buy License)
1. On dashboard, click **"Buy License"** button
2. On billing page, click **"Buy Lifetime License"**
3. **Expected:**
   - Opaque access token generated automatically via Stripe webhook after payment
   - Redirected to dashboard
   - "Buy License" step shows as complete
   - **"Link Alexa" button becomes enabled**

---

## Phase 2: Alexa Developer Console Setup

### Step 4: Configure Skill in Developer Console
1. Go to: https://developer.amazon.com/alexa/console/ask
2. Sign in with your Amazon Developer account
3. Select your skill: **"Voice Planner"** (or create it if needed)

### Step 5: Deploy Interaction Model
1. Click **Build** tab (left sidebar)
2. Click **Interaction Model** (under Build)
3. Click **JSON Editor** (top right)
4. **Delete all existing content**
5. Open `docs/alexa-interaction-model.json` from your project
6. **Copy entire contents**
7. **Paste** into JSON Editor
8. Click **Save Model** (top right)
9. Click **Build Model** (top right)
10. **Wait for build to complete** (1-2 minutes)
11. **Expected:** "Build successful" message

### Step 6: Configure Endpoint
1. Click **Endpoint** (under Build)
2. Select **"AWS Lambda ARN"**
3. Enter your Lambda function ARN
4. Click **Save Endpoints**

### Step 7: Configure Account Linking
1. Click **Account Linking** (under Build)
2. **Enable account linking**
3. Set:
   - **Authorization URI**: `https://your-domain.com/api/oauth/authorize`
   - **Access Token URI**: `https://your-domain.com/api/oauth/token`
   - **Client ID**: `[Your ALEXA_OAUTH_CLIENT_ID]`
   - **Client Secret**: `[Your ALEXA_OAUTH_CLIENT_SECRET]`
   - **Authorization Grant Type**: `Auth Code Grant`
   - **Scope**: `alexa`
4. Click **Save**
5. Click **Build Model** again (to apply account linking)

### Step 8: Enable Testing
1. Click **Test** tab (left sidebar)
2. Toggle **"Test is enabled for this skill"** to **ON**
3. **Expected:** Test simulator becomes available

---

## Phase 3: Account Linking

### Step 9: Get Your Amazon Account ID
1. In **Test** tab, type: `open Voice Planner`
2. Click **JSON Input** tab
3. Find: `context.System.user.userId`
4. Copy the value (e.g., `amzn1.ask.account.XXXXX`)
5. **Save this ID** - you'll need it

### Step 10: Link Account via OAuth Flow
1. In **Test** tab, type: `link account` or `open Voice Planner`
2. **Expected:** You'll see a LinkAccount card response
3. Click the **"Link Account"** button in the simulator
4. Browser opens with authorization URL
5. **Sign in** to your website if prompted
6. Click **"Continue Linking"** or **"Authorize"**
7. System checks:
   - ✅ User authenticated
   - ✅ Notion connected
   - ✅ License active (opaque access token exists in database)
8. **Expected:** Redirected back to Alexa with success
9. Account is now linked

### Step 11: Verify Account Linking
1. **Check database:**
   - `users.amazon_account_id` should be set
   - `oauth_access_tokens` table should have new token
2. In **Test** tab, type: `open Voice Planner`
3. **Expected:** Welcome message (not LinkAccount card)

---

## Phase 4: Testing Voice Commands

### Step 12: Test Launch Request
1. In **Test** tab, type: `open Voice Planner`
2. **Expected:** Welcome message like "Welcome to Voice Planner..."

### Step 13: Test Adding Tasks
1. Type: `add finish the report`
2. **Expected:** "I've added finish the report to your tasks"
3. Type: `add call mom`
4. **Expected:** Task added confirmation
5. **Verify in Notion:** Check your Tasks database - tasks should appear

### Step 14: Test Listing Tasks
1. Type: `what are my tasks`
2. **Expected:** Alexa reads your tasks from Notion
3. Type: `read my tasks`
4. **Expected:** Same result

### Step 15: Test Marking Tasks Complete
1. Type: `mark finish the report as done`
2. **Expected:** "I've marked finish the report as complete"
3. **Verify in Notion:** Task status should be "Done"

### Step 16: Test Shopping List
1. Type: `add to shopping: milk, eggs, bread`
2. **Expected:** Items added to shopping list
3. Type: `read my shopping list`
4. **Expected:** Alexa reads shopping items

### Step 17: Test Workouts
1. Type: `log workout running 30 minutes`
2. **Expected:** Workout logged confirmation
3. **Verify in Notion:** Check Workouts database

### Step 18: Test Meals
1. Type: `log breakfast 500 calories`
2. **Expected:** Meal logged confirmation
3. **Verify in Notion:** Check Meals database

### Step 19: Test Notes
1. Type: `add note meeting notes`
2. **Expected:** Note added confirmation
3. Type: `read my notes`
4. **Expected:** Alexa reads your notes

### Step 20: Test Energy Tracking
1. Type: `log energy 7`
2. **Expected:** Energy logged confirmation
3. **Verify in Notion:** Check EnergyLogs database

### Step 21: Test Statistics
1. Type: `how many tasks do I have`
2. **Expected:** Task count
3. Type: `give me a summary`
4. **Expected:** Productivity summary
5. Type: `when is my next deadline`
6. **Expected:** Next deadline information

---

## Phase 5: Comprehensive Test Scenarios

### Test Scenario 1: Complete CRUD Workflow
1. **Create**: "Alexa, add finish quarterly report"
2. **Read**: "Alexa, what are my tasks" (verify task appears)
3. **Update**: "Alexa, set finish quarterly report to in progress"
4. **Read**: "Alexa, what am I working on" (verify status changed)
5. **Update**: "Alexa, mark finish quarterly report as done"
6. **Read**: "Alexa, what have I completed" (verify completion)
7. **Delete**: "Alexa, delete finish quarterly report"
8. **Read**: "Alexa, what are my tasks" (verify task removed)

### Test Scenario 2: Task Status Updates
Test all status transitions:
- **To Do → In Progress**: "set [task] to in progress"
- **In Progress → Done**: "set [task] to done"
- **Done → To Do**: "set [task] to to do"
- **Explicit status**: Verify explicit status is respected even if it matches current status

### Test Scenario 3: Date-Based Queries
- "what's due tomorrow"
- "what's due today"
- "what's overdue"
- "what's due this week"

### Test Scenario 4: Category and Priority Filters
- "what are my work tasks"
- "what are my high priority tasks"
- "what are my personal tasks"

### Test Scenario 5: Statistics and Summaries
- "how many tasks do I have"
- "how many tasks are done"
- "give me a summary"
- "when is my next deadline"

---

## Test Sentences Reference

### Task Management
- "add finish the report"
- "add call mom high priority"
- "add buy groceries due tomorrow"
- "what are my tasks"
- "what are my work tasks"
- "what's due tomorrow"
- "mark finish report as done"
- "set finish report to in progress"
- "delete finish report"
- "how many tasks do I have"
- "give me a summary"

### Shopping
- "add milk to shopping list"
- "read my shopping list"
- "mark milk as bought"

### Workouts
- "log workout running 30 minutes"
- "I did chest day for 45 minutes"

### Meals
- "log breakfast 500 calories"
- "I ate pizza for 800 calories"

### Notes
- "add note meeting notes"
- "read my notes"

### Energy
- "log energy 7"
- "my energy is 5"

---

## Verification Steps

### Step 22: Check CloudWatch Logs
1. Go to **AWS Console → CloudWatch**
2. Find your Lambda function logs
3. Look for:
   - `[AuthInterceptor] Token validated successfully`
   - `[Request Interceptor] Intent name: AddTaskIntent`
   - Handler invocation messages
4. **Expected:** All requests logged successfully

### Step 23: Check Database
1. Query `oauth_access_tokens` table:
   ```sql
   SELECT * FROM oauth_access_tokens 
   WHERE user_id = 'YOUR_USER_ID' 
   AND revoked = false;
   ```
2. **Expected:** Active token exists

### Step 24: Verify Voice Planner
1. Check Tasks database in Notion
2. Verify tasks created via voice commands appear
3. Verify status updates are reflected
4. Check other databases (Shopping, Workouts, Meals, Notes, EnergyLogs)

---

## Troubleshooting

### "Link Alexa" button disabled:
- Check browser console for `hasNotionConnection` and `hasJwtToken`
- Ensure Notion is connected
- Ensure you clicked "Buy License"

### Account linking fails:
- Check `ALEXA_OAUTH_CLIENT_ID` and `ALEXA_OAUTH_CLIENT_SECRET` are set
- Verify redirect URIs match in Developer Console
- Check user has active license and Notion connection

### Intent not recognized:
- Verify interaction model is built successfully
- Check JSON Input tab shows correct intent name
- Try re-building the interaction model

### No CloudWatch logs:
- Verify Lambda ARN is correct in Endpoint settings
- Check skill is enabled for testing
- Ensure account is linked

### Task not found errors:
- Verify task exists in Notion
- Check task name matches exactly
- Try using the full task name

### Database not found errors:
- Verify all 6 databases exist in Notion
- Check database names match exactly (case-sensitive)
- Try reconnecting Notion from dashboard

### Email verification not received:
- Check spam folder
- Verify email address is correct
- Check Supabase Auth logs
- Consider disabling email confirmation for testing

---

## Test Checklist

### Setup
- [ ] User registered and verified email
- [ ] Notion connected (Privacy page + 6 databases created)
- [ ] Opaque access token generated (Stripe payment completed)
- [ ] Interaction model deployed successfully
- [ ] Account linking configured in Developer Console
- [ ] Account linked via OAuth flow

### Basic Operations
- [ ] Can launch skill: "open Voice Planner"
- [ ] Can add tasks: "add [task]"
- [ ] Can list tasks: "what are my tasks"
- [ ] Can mark complete: "mark [task] as done"
- [ ] Can update status: "set [task] to in progress"
- [ ] Can delete tasks: "delete [task]"

### Advanced Operations
- [ ] Can filter by category: "what are my work tasks"
- [ ] Can filter by priority: "what are my high priority tasks"
- [ ] Can query by date: "what's due tomorrow"
- [ ] Can get statistics: "how many tasks do I have"
- [ ] Can get summary: "give me a summary"
- [ ] Can find deadlines: "when is my next deadline"

### New Features
- [ ] Can add shopping items: "add milk to shopping list"
- [ ] Can read shopping list: "read my shopping list"
- [ ] Can log workouts: "log workout running 30 minutes"
- [ ] Can log meals: "log breakfast 500 calories"
- [ ] Can add notes: "add note meeting notes"
- [ ] Can read notes: "read my notes"
- [ ] Can log energy: "log energy 7"

### Verification
- [ ] Tasks appear in Voice Plannerbase
- [ ] CloudWatch logs show successful requests
- [ ] All databases are accessible
- [ ] Status updates are reflected in Notion

---

## Notes

- You can test everything **without certification** using the Alexa Developer Console Test tab
- Certification is only needed to publish to the Skills Store
- All testing can be done in development mode before submission
- Use the test sentences reference for comprehensive testing

---

## Quick Test Commands

### Basic Operations:
- `open Voice Planner` - Launch skill
- `add [task name]` - Add task
- `what are my tasks` - List tasks
- `mark [task] as done` - Complete task
- `delete [task]` - Remove task

### Advanced:
- `what are my work tasks` - Filter by category
- `what's due tomorrow` - Date-based query
- `how many tasks do I have` - Statistics
- `give me a summary` - Productivity summary
- `add to shopping: [items]` - Add to shopping list
- `log workout running 30 minutes` - Log workout
- `log energy 7` - Log energy level
