# Lambda Backend

AWS Lambda function for the Notion Data Alexa Skill.

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

