# Lambda Backend

AWS Lambda function for the Voice Planner Alexa Skill.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (see `.env.example`)

3. Build:
```bash
npm run build
```

## Development

```bash
# Watch mode
npm run watch

# Run tests
npm test
```

## Deployment

### Using SAM

```bash
sam build
sam deploy --guided
```

### Using GitHub Actions

Push to `main` branch to trigger automatic deployment.

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration
```

## Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `DISABLE_LICENSE_VALIDATION` - Set to `'true'` to bypass license validation (useful for testing in Alexa Developer Console Simulator)

### Testing Without License Validation

To test your skill in the Alexa Developer Console Simulator without license validation:

1. **Option 1: Set in AWS Lambda Console**
   - Go to your Lambda function in AWS Console
   - Navigate to Configuration → Environment variables
   - Add `DISABLE_LICENSE_VALIDATION` with value `true`

2. **Option 2: Set in template.yaml** (for SAM deployments)
   - Uncomment the `DISABLE_LICENSE_VALIDATION` line in `template.yaml`
   - Redeploy using `sam deploy`

3. **Option 3: Set in local development**
   - Add `DISABLE_LICENSE_VALIDATION=true` to your `.env` file (if using local testing)

**Note:** Remember to remove or disable this setting before production deployment!

