# Windows Build Issues - Workaround Guide

## Problem

On Windows, Next.js builds may fail with:
```
Error: UNKNOWN: unknown error, open '...\.next\server\pages-manifest.json'
errno: -4094
```

This is a known Windows file system issue, often related to:
- Path length limitations (Windows 260 character limit)
- File permissions
- Antivirus software interference
- File locks from other processes

## Solutions

### Option 1: Use Windows Build Script (Recommended for Local Testing)

```powershell
npm run build:windows
```

This script automatically:
- Stops any Node processes that might lock files
- Clears the `.next` directory
- Clears build cache
- Runs the build

### Option 2: Deploy to Vercel (Recommended for Production)

Vercel builds in a Linux environment, avoiding Windows issues entirely:

```bash
npm run deploy
```

Or connect your GitHub repository to Vercel for automatic deployments.

### Option 3: Manual Clean Build

If the script doesn't work, try manually:

```powershell
# Stop Node processes
Get-Process | Where-Object {$_.Path -like "*node*"} | Stop-Process -Force

# Clear build directories
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item node_modules\.cache -Recurse -Force -ErrorAction SilentlyContinue

# Wait a moment
Start-Sleep -Seconds 2

# Build
npm run build
```

### Option 4: Use WSL (Windows Subsystem for Linux)

If you have WSL installed:

```bash
wsl
cd /mnt/e/Work/alex/notion-assistant-alexa-skill/web-login
npm run build
```

## Why This Happens

Windows has stricter file system constraints than Linux:
- Default 260 character path limit (can be extended with registry changes)
- Different file locking behavior
- Antivirus software can interfere with file operations

## Recommendation

For production builds, **always deploy to Vercel**. The build environment is Linux-based and avoids these Windows-specific issues entirely.

For local testing, use `npm run build:windows` or the manual steps above.

