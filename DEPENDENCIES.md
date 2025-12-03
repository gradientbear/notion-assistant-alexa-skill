# Required Dependencies

## Next.js (web-login)

Add these to `web-login/package.json`:

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "stripe": "^14.21.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.6"
  }
}
```

Install command:
```bash
cd web-login
npm install jsonwebtoken @types/jsonwebtoken stripe
```

## Lambda

No new dependencies required. The Lambda uses Node.js built-in `crypto` module for JWT verification.

## Migration Script

The migration script requires:
- `dotenv` (for environment variable loading)
- `jsonwebtoken` (for JWT generation)

Add to root `package.json` or install globally:
```bash
npm install -g dotenv jsonwebtoken
```

Or add to `web-login/package.json` and run from there.

