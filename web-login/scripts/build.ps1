# PowerShell build script for Windows
# Handles Windows file system issues with Next.js builds

Write-Host "Cleaning build artifacts..." -ForegroundColor Yellow

# Stop any Node processes that might be locking files
Get-Process | Where-Object {$_.Path -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Clear build directories
if (Test-Path .next) {
    Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cleared .next directory" -ForegroundColor Green
}

if (Test-Path node_modules\.cache) {
    Remove-Item node_modules\.cache -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cleared node_modules cache" -ForegroundColor Green
}

# Wait a moment for file system to settle
Start-Sleep -Seconds 2

Write-Host "Starting build..." -ForegroundColor Yellow
$env:NEXT_TELEMETRY_DISABLED = "1"

# Run the build
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Build failed. This is a known Windows file system issue." -ForegroundColor Red
    Write-Host "Recommendation: Deploy directly to Vercel for production builds." -ForegroundColor Yellow
    exit 1
}

