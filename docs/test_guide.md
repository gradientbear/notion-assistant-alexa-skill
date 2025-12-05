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

✅ ADD TASK — Sample Test Sentences (≈ 35)

These simulate natural, messy user requests.

🧪 Basic adds

"add buy milk"

"add pick up dry cleaning tomorrow"

"create a task to call Sarah"

"add take out the trash tonight"

"add schedule dentist appointment"

🧪 Adds with time parsing (chrono-node)

"add pay rent next Tuesday"

"remind me to water the plants every morning"

"create a task to send the invoice at 4 pm"

"add book flight in two weeks"

"schedule gym session for tomorrow morning"

🧪 Adds with category

"add finish presentation to my work list"

"add buy groceries to my personal list"

🧪 Adds with complex phrasing

"set a reminder to check the oven in 20 minutes"

"add prepare report due Friday afternoon"

"create call mom Sunday evening"

"add revise homework before next Monday"

"add finish the code review after lunch"

🧪 Adds with priority

"add urgent task submit tax forms today"

"add high priority update project timeline"

🧪 Messy / natural language

"hey remind me to get a birthday gift for John"

"uh add feed the dog at 7"

"I need to remember to email the bank tomorrow morning"

✅ UPDATE TASK — Sample Test Sentences (≈ 30)
🧪 Rename tasks

"rename buy milk to buy almond milk"

"change task call mom to call mom and dad"

"change fix sink to repair kitchen sink"

🧪 Reschedule (date, time, both)

"move dentist appointment to next Friday"

"reschedule pay rent to tomorrow morning"

"change meeting with Steve to 4 pm"

"set house cleaning for Saturday at 2 pm"

"move morning workout to next Monday at 6 am"

🧪 Change status

"mark buy milk as in process"

"set email bank to done"

"set laundry task to to do"

🧪 Change category

"move presentation draft to work category"

"set grocery shopping to personal category"

🧪 Complex update sentences

"update finish taxes move it to Tuesday afternoon"

"change call with doctor move it to tomorrow at noon"

"reschedule submit report from Friday to Monday morning"

✅ DELETE TASK — Sample Test Sentences (≈ 25)
🧪 Delete by name

"delete buy milk"

"remove dentist appointment"

"erase task call John"

🧪 Delete by status

"delete all completed tasks"

"clear all done tasks"

"remove in process tasks"

🧪 Delete by time

"delete tasks due today"

"remove overdue tasks"

"clear tasks due tomorrow"

🧪 Delete bulk

"delete everything"

"clear entire list"

"remove all tasks"

🧪 Natural messy phrasing

"ugh delete that task about fixing the sink"

"remove whatever is done already"

✅ QUERY TASKS — Sample Test Sentences (≈ 35)
🧪 General queries

"what’s on my todo list"

"read my tasks"

"what do I need to do"

"show all tasks"

🧪 Time-based

"what do I need to do today"

"what are my tasks for tomorrow"

"what tasks are due next week"

"show tasks due after 5 pm"

"what’s scheduled for Sunday morning"

"what’s overdue"

"what do I have this afternoon"

🧪 Status-based

"what tasks are incomplete"

"show done tasks"

"what did I finish today"

"what is in process"

🧪 Category and priority

"show my work tasks"

"read my personal reminders"

"what are my high priority tasks"

🧪 Keyword search

"do I have anything about groceries"

"show tasks related to the bank"

"is there anything about cleaning"

"what tasks mention birthday"

🧪 Messy / complex

"what incomplete tasks do I have for tomorrow"

"show personal tasks due today"

"what work tasks are overdue"

"list my tasks after noon that are not done"