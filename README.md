# Notion Assistant Alexa Skill

A private, premium Alexa Skill integrated with Notion API for voice-first task management and productivity tracking.

## 🎯 Features

- **Brain Dump**: Add multiple tasks via voice in a multi-turn conversation
- **Priority List**: Get top 3 priority tasks sorted by priority and due date
- **Focus Timer**: 25-minute Pomodoro timer with automatic Notion logging
- **Energy Tracker**: Log energy levels (1-10) mapped to Low/Medium/High
- **Schedule**: View today's tasks and overdue items
- **Shopping List**: Add, read, and mark shopping items as complete

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

- Node.js 20.x+
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
   - Add license keys to `licenses` table

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
- **[Notion Database Templates](docs/NOTION_DATABASE_TEMPLATES.md)** - Database setup guide
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

## 📝 License

Private - License key required for access. See `docs/SETUP_INSTRUCTIONS.md` for license key management.

## 🤝 Support

For setup issues, see `docs/SETUP_INSTRUCTIONS.md` troubleshooting section.

---

**Note:** TypeScript errors in the IDE are expected until dependencies are installed. Run `npm install` in each directory to resolve.

