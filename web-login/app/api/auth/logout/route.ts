import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Logout Endpoint
 * POST /api/auth/logout
 * 
 * Clears HTTP-only refresh token cookie and optionally revokes refresh token
 * This endpoint is called during logout to ensure all server-side tokens are cleared
 */
export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const refreshToken = request.cookies.get('refresh_token')?.value;
    
    // Revoke refresh token if it exists
    if (refreshToken) {
      const supabase = createServerClient();
      
      // Revoke the refresh token in database
      const { error } = await supabase
        .from('website_refresh_tokens')
        .update({ 
          revoked: true, 
          revoked_at: new Date().toISOString() 
        })
        .eq('token', refreshToken);
      
      if (error) {
        console.error('[Logout] Error revoking refresh token:', error);
        // Continue even if revocation fails
      }
    }
    
    // Create response and clear refresh token cookie
    const response = NextResponse.json({ success: true });
    
    // Clear refresh token cookie
    response.cookies.delete('refresh_token');
    
    // Also clear any Supabase auth cookies (if they exist)
    // Supabase cookies follow pattern: sb-<project-ref>-auth-token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'default';
      const cookieName = `sb-${projectRef}-auth-token`;
      response.cookies.delete(cookieName);
      response.cookies.delete('sb-access-token');
    }
    
    return response;
  } catch (error: any) {
    console.error('[Logout] Error:', error);
    
    // Still try to clear cookies even if there's an error
    const response = NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
    
    // Clear cookies on error too
    response.cookies.delete('refresh_token');
    
    return response;
  }
}

