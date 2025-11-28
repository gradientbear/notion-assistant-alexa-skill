# Interaction Model Troubleshooting Guide

## Issue: "mark finish quarterly report as done" - No CloudWatch Logs

If you say "alexa mark finish quarterly report as done" and there are **NO CloudWatch logs at all**, this means the request is **NOT reaching Lambda**. This is an interaction model deployment issue.

## Root Cause

The interaction model file (`docs/alexa-interaction-model.json`) has the correct samples, but it needs to be **deployed to the Alexa Developer Console**.

## Solution Steps

### 1. Update the Interaction Model in Alexa Developer Console

1. Go to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Select your skill: **Notion Data**
3. Go to **Build** → **Interaction Model** → **JSON Editor**
4. Copy the contents from `docs/alexa-interaction-model.json`
5. Paste it into the JSON Editor
6. Click **Save Model**
7. Click **Build Model**
8. Wait for the build to complete

### 2. Verify the Interaction Model

After building, check that `MarkTaskCompleteIntent` has these samples:
- "mark {task} as done"
- "mark {task} as complete"
- "complete {task}"
- "finish {task}"
- etc.

### 3. Test the Skill

1. Go to **Test** tab in Alexa Developer Console
2. Enable testing for your skill
3. Type or say: "mark finish quarterly report as done"
4. Check if it recognizes as `MarkTaskCompleteIntent`

### 4. Check CloudWatch Logs

After testing, check CloudWatch logs. You should now see:
- `[Request Interceptor] Intent name: MarkTaskCompleteIntent`
- `[MarkTaskCompleteHandler] canHandle check: ...`
- `[MarkTaskCompleteHandler] Handler invoked`

## Alternative: Use UpdateTaskStatusIntent as Fallback

If the interaction model still doesn't work, the code has a fallback:
- If a task is "In Progress" and you update it via `UpdateTaskStatusIntent`, it will automatically mark it as done.

Try saying: "alexa set finish quarterly report to in progress" (when it's already in progress, it will mark as done).

## Verification Checklist

- [ ] Interaction model is built and deployed in Alexa Developer Console
- [ ] Skill is enabled for testing
- [ ] CloudWatch logs show `[Request Interceptor]` entries
- [ ] Intent is recognized correctly
- [ ] Handler is being invoked

## Common Issues

1. **No logs at all**: Interaction model not deployed
2. **Wrong intent recognized**: Need more sample utterances
3. **Handler not invoked**: Check handler registration order in `lambda/src/index.ts`

