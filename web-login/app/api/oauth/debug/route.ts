import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check OAuth configuration
 * This helps diagnose client_id mismatch issues
 * 
 * GET /api/oauth/debug?client_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const providedClientId = searchParams.get('client_id');

    const expectedClientId = process.env.ALEXA_OAUTH_CLIENT_ID;
    const hasClientSecret = !!process.env.ALEXA_OAUTH_CLIENT_SECRET;

    // Only show first 8 characters for security
    const mask = (str: string | undefined) => {
      if (!str) return 'NOT SET';
      if (str.length <= 8) return '***';
      return `${str.substring(0, 8)}...`;
    };

    const debugInfo = {
      provided_client_id: providedClientId ? mask(providedClientId) : 'NOT PROVIDED',
      expected_client_id: mask(expectedClientId),
      client_id_match: providedClientId === expectedClientId,
      has_client_secret: hasClientSecret,
      has_client_id_env: !!expectedClientId,
      environment: process.env.NODE_ENV || 'development',
    };

    return NextResponse.json(debugInfo, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


