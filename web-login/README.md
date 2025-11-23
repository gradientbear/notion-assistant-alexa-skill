# Web Login Application

Next.js application for OAuth/account linking with Notion.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (see `.env.example`)

3. Run development server:
```bash
npm run dev
```

## Deployment

### Using Vercel

```bash
vercel --prod
```

### Using GitHub Actions

Push to `main` branch to trigger automatic deployment.

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `NOTION_CLIENT_ID` - Notion OAuth client ID
- `NOTION_CLIENT_SECRET` - Notion OAuth client secret
- `NOTION_REDIRECT_URI` - OAuth redirect URI

