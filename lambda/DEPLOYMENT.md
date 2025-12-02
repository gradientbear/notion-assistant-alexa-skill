# Lambda Deployment Guide

## Prerequisites

1. AWS CLI configured with your profile
2. SAM CLI installed (`sam --version`)
3. Node.js 22.x installed
4. All dependencies installed (`npm install`)

## Build and Deploy Steps

### 1. Install Dependencies

```bash
cd lambda
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 3. Build with SAM

SAM will automatically bundle `node_modules` when using `CodeUri: .`

```bash
sam build
```

**Important**: If you see "Cannot find module" errors after deployment, try:

```bash
# Option 1: Use container build (recommended for consistent builds)
sam build --use-container

# Option 2: Ensure node_modules exists
npm install --production
sam build
```

### 4. Deploy

```bash
sam deploy
```

Or use your profile:

```bash
sam deploy --profile remy
```

## Troubleshooting

### Issue: "Cannot find module 'ask-sdk-core'"

**Solution 1**: Ensure dependencies are installed
```bash
cd lambda
rm -rf node_modules package-lock.json
npm install
sam build --use-container
sam deploy
```

**Solution 2**: Check that `node_modules` exists in the lambda directory
```bash
ls -la lambda/node_modules/ask-sdk-core
```

**Solution 3**: Verify SAM build includes node_modules
```bash
sam build --debug
# Check the .aws-sam/build/NotionAssistantFunction/ folder
# Should contain node_modules/
```

### Issue: Database query errors (PGRST116)

This is now fixed by using `.maybeSingle()` instead of `.single()` in database queries. The error is expected when a user doesn't exist yet.

## Quick Deploy Command

```bash
cd lambda && npm install && npm run build && sam build && sam deploy --profile remy
```

## Verify Deployment

After deployment, test the function:

```bash
aws lambda invoke \
  --function-name notion-data-NotionAssistantFunction-XXXXX \
  --region eu-north-1 \
  --profile remy \
  --payload '{"version":"1.0","session":{},"request":{"type":"LaunchRequest","requestId":"test"}}' \
  response.json

cat response.json
```

## Check Logs

```bash
aws logs tail /aws/lambda/notion-data-NotionAssistantFunction-XXXXX \
  --region eu-north-1 \
  --profile remy \
  --since 1h \
  --follow
```

