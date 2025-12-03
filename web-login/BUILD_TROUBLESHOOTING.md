# Build Troubleshooting for Windows

## Issue: `UNKNOWN: unknown error` when building

This is a Windows-specific file system issue. Here are solutions:

### Solution 1: Deploy to Vercel (Recommended)
Vercel builds automatically - you don't need to build locally. Just push your code and Vercel will handle the build.

### Solution 2: Run as Administrator
1. Close your terminal
2. Right-click PowerShell/Command Prompt
3. Select "Run as Administrator"
4. Navigate to `web-login` directory
5. Run `npm run build`

### Solution 3: Check Antivirus/Windows Defender
Windows Defender or antivirus software might be blocking file access:
1. Temporarily disable real-time protection
2. Add the project folder to exclusions
3. Try building again

### Solution 4: Use WSL (Windows Subsystem for Linux)
If you have WSL installed:
```bash
wsl
cd /mnt/e/Work/alex/notion-assistant-alexa-skill/web-login
npm run build
```

### Solution 5: Check Path Length
Windows has a 260 character path limit. Your path might be too long:
- Move project to a shorter path (e.g., `C:\dev\notion-assistant`)
- Or enable long path support in Windows

### Solution 6: Clean Build
```powershell
# Stop any running Node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Remove build artifacts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# Rebuild
npm run build
```

### Solution 7: Use Development Mode
For local testing, use dev mode instead of build:
```bash
npm run dev
```

This doesn't require the production build step.


