# Voice Planner Alexa Skill (MVP)

A voice-first Alexa Skill integrated with Notion API for task management. This MVP version focuses on core CRUD operations for managing tasks in your Notion workspace.

## 🎯 MVP Features

- **Add Tasks**: Create new tasks in your Notion Tasks database
- **List Tasks**: View your tasks with various filters (all, pending, completed, by priority, etc.)
- **Update Tasks**: Mark tasks as complete or update their status
- **Delete Tasks**: Remove tasks from your Voice Plannerbase
- **Connection Status**: Check if your Notion connection is working

> **Note**: This is an MVP version focusing on core task CRUD operations. Additional features (Brain Dump, Focus Timer, Energy Tracker, etc.) are available in the codebase but disabled for MVP.

## 📁 Project Structure

```
.
├── lambda/              # AWS Lambda backend (Node.js/TypeScript)
│   ├── src/
│   │   ├── handlers/   # Alexa intent handlers
│   │   ├── interceptors/# Request interceptors
│   │   ├── utils/      # Database, Notion, Alexa utilities
│   │   └── index.ts    # Lambda entry point
│   ├── template.yaml   # SAM deployment template
│   └── package.json
├── web-login/          # Next.js web app for OAuth/account linking
│   ├── app/
│   │   ├── api/       # API routes (OAuth, license validation)
│   │   └── page.tsx   # Login page
│   └── package.json
├── shared/             # Shared TypeScript types
├── admin/              # Admin panel for license management (optional)
├── docs/               # Documentation
│   ├── TECHNICAL_DOCUMENTATION.md
│   ├── USER_GUIDE.md
│   ├── NOTION_DATABASE_TEMPLATES.md
│   ├── SETUP_INSTRUCTIONS.md
│   └── supabase-schema.sql
└── .github/workflows/  # CI/CD pipelines
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22.x+
- AWS Account with CLI configured
- Supabase account
- Notion account
- Vercel account (for web login)
- Alexa Developer account

### Installation

1. **Clone and install dependencies:**
```bash
npm install
cd lambda && npm install
cd ../web-login && npm install
```

2. **Set up Supabase:**
   - Create a Supabase project
   - Run `docs/supabase-schema.sql` in SQL Editor
   - Note: License keys are not required for MVP

3. **Configure Notion OAuth:**
   - Create OAuth integration at https://www.notion.so/my-integrations
   - Set redirect URI to your web app URL

4. **Deploy:**
   - See `docs/SETUP_INSTRUCTIONS.md` for detailed deployment steps

## 📚 Documentation

- **[Setup Instructions](docs/SETUP_INSTRUCTIONS.md)** - Complete deployment guide
- **[Notion OAuth Setup](docs/NOTION_OAUTH_SETUP.md)** - Detailed OAuth integration guide
- **[Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md)** - Architecture and implementation details
- **[User Guide](docs/USER_GUIDE.md)** - End-user documentation
- **[Voice Plannerbase Templates](docs/NOTION_DATABASE_TEMPLATES.md)** - Database setup guide
- **[FAQ](docs/FAQ.md)** - Frequently asked questions

## 🧪 Testing

```bash
# Run Lambda tests
cd lambda
npm test

# Run integration tests
npm run test:integration
```

## 🔧 Development

```bash
# Lambda development
cd lambda
npm run watch

# Web login development
cd web-login
npm run dev
```

## 📦 Deployment

### Lambda (AWS SAM)
```bash
cd lambda
sam build
sam deploy
```

### Web Login (Vercel)
```bash
cd web-login
vercel --prod
```

Or use GitHub Actions workflows for automatic deployment.

## 🔐 Environment Variables

See `.env.example` files in each directory for required environment variables.

**Required for MVP:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `NOTION_CLIENT_ID` - Notion OAuth client ID
- `NOTION_CLIENT_SECRET` - Notion OAuth client secret
- `NOTION_REDIRECT_URI` - OAuth redirect URI

## 📝 MVP Notes

- **No License Required**: This MVP version does not require license validation
- **Core CRUD Only**: Focus on task management operations
- **Simplified Onboarding**: Users only need to connect Notion and link Amazon account

## 🤝 Support

For setup issues, see `docs/SETUP_INSTRUCTIONS.md` troubleshooting section.

---

**Note:** TypeScript errors in the IDE are expected until dependencies are installed. Run `npm install` in each directory to resolve.

