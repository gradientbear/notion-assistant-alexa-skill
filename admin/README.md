# Admin Panel

Simple web interface for managing license keys and viewing users.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_SERVICE_KEY=your-service-role-key
```

3. Run development server:
```bash
npm run dev
```

The admin panel will be available at http://localhost:3001

## Features

- **License Management**
  - View all license keys
  - Add new licenses
  - Activate/Deactivate licenses
  - Delete licenses
  - Add notes to licenses

- **User Management**
  - View all registered users
  - See which users have linked Notion accounts
  - View user email, license key, and Amazon account ID

## Deployment

Deploy to Vercel or any hosting platform:

```bash
vercel --prod
```

**Security Note:** This admin panel should be protected with authentication in production. Consider adding:
- Password protection
- IP whitelist
- OAuth authentication
- Environment-based access control

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` - Supabase service role key (has full access)

