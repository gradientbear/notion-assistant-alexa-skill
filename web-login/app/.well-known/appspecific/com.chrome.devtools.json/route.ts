import { NextResponse } from 'next/server'

// Chrome DevTools automatically requests this file
// Return empty JSON to suppress 404/500 errors
export async function GET() {
  return NextResponse.json({}, { status: 200 })
}
