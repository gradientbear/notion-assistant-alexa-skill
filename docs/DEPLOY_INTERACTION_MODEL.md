# Deploy Interaction Model - Quick Guide

## Problem: "mark finish quarterly report as done" - No CloudWatch Logs

If there are **NO logs at all** for "mark finish quarterly report as done", the interaction model is **NOT deployed** or **NOT recognized** by Alexa.

## Solution: Deploy the Interaction Model

### Step 1: Open Alexa Developer Console

1. Go to https://developer.amazon.com/alexa/console/ask
2. Sign in with your Amazon Developer account
3. Select your skill: **Notion Data**

### Step 2: Update Interaction Model

1. Click **Build** tab (left sidebar)
2. Click **Interaction Model** (under Build)
3. Click **JSON Editor** (top right)
4. **Delete all existing content** in the JSON Editor
5. Open `docs/alexa-interaction-model.json` from this project
6. **Copy the entire contents** of the file
7. **Paste** into the JSON Editor
8. Click **Save Model** (top right)
9. Click **Build Model** (top right)
10. **Wait for build to complete** (usually 1-2 minutes)

### Step 3: Verify Build Success

- You should see: "Build successful" or "Model built successfully"
- If there are errors, check the error messages and fix them

### Step 4: Test in Developer Console

1. Click **Test** tab (left sidebar)
2. Enable testing: Toggle "Test is enabled for this skill" to **ON**
3. In the test simulator, type: `mark finish quarterly report as done`
4. Check the **JSON Input** tab to see which intent was recognized
5. It should show: `"name": "MarkTaskCompleteIntent"`

### Step 5: Test on Your Device

1. Say: "Alexa, open notion data"
2. Wait for welcome message
3. Say: "Alexa, mark finish quarterly report as done"
4. Check CloudWatch logs - you should now see:
   - `[Request Interceptor] Intent name: MarkTaskCompleteIntent`
   - `[MarkTaskCompleteHandler] Handler invoked`

## Verification Checklist

- [ ] Interaction model JSON is pasted into Developer Console
- [ ] Model is built successfully (no errors)
- [ ] Test simulator recognizes "mark finish quarterly report as done" as `MarkTaskCompleteIntent`
- [ ] CloudWatch logs show `[Request Interceptor]` entries for the command
- [ ] Handler is being invoked

## Common Issues

### Issue 1: Build Errors
- **Symptom**: Red error messages when building
- **Solution**: Check JSON syntax, ensure all intents have samples, check for duplicate intent names

### Issue 2: Intent Not Recognized
- **Symptom**: Test simulator shows wrong intent or "I didn't understand"
- **Solution**: Add more sample utterances to `MarkTaskCompleteIntent` in the JSON file

### Issue 3: Still No Logs After Deployment
- **Symptom**: Model built successfully but still no CloudWatch logs
- **Solution**: 
  - Verify Lambda ARN is correct in Endpoint settings
  - Check that skill is enabled for testing
  - Try saying the invocation name first: "Alexa, open notion data" then "mark finish quarterly report as done"

## Alternative Workaround

If the interaction model still doesn't work, you can use the fallback:

**Say**: "Alexa, set finish quarterly report to in progress"

When a task is already "In Progress", this will automatically mark it as "Done" (this is the smart default behavior).

