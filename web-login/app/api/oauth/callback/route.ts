import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOAuthSession, deleteOAuthSession } from '../session';
import { setupNotionWorkspace } from '../notion-setup';

// Mark this route as dynamic since it uses searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables at runtime, not module load time
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    const notionClientId = process.env.NOTION_CLIENT_ID || '';
    const notionClientSecret = process.env.NOTION_CLIENT_SECRET || '';
    const notionRedirectUri = process.env.NOTION_REDIRECT_URI || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.redirect(
        new URL('/error?message=Missing Supabase environment variables', request.url)
      );
    }

    if (!notionClientId || !notionClientSecret || !notionRedirectUri) {
      return NextResponse.redirect(
        new URL('/error?message=Missing Notion OAuth configuration', request.url)
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Retrieve session from database
    if (!state) {
      return NextResponse.redirect(
        new URL('/error?message=Missing state parameter', request.url)
      );
    }

    const session = await getOAuthSession(state);
    if (!session) {
      return NextResponse.redirect(
        new URL('/error?message=Invalid or expired session', request.url)
      );
    }

    // Handle user denial or errors
    if (error) {
      // Check error type - Notion may return different error codes
      const errorDescription = searchParams.get('error_description') || '';
      const isNoAccount = error === 'invalid_grant' || 
                         errorDescription.toLowerCase().includes('account') ||
                         errorDescription.toLowerCase().includes('sign up') ||
                         errorDescription.toLowerCase().includes('register');

      // Create partial user registration (without Notion token) if we have Amazon account ID
      if (session.amazon_account_id) {
        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('amazon_account_id', session.amazon_account_id)
          .single();

        if (!existingUser) {
          // Create user without Notion token - setup incomplete
          await supabase
            .from('users')
            .insert({
              amazon_account_id: session.amazon_account_id,
              email: session.email,
              license_key: session.license_key,
              notion_token: null,
              notion_setup_complete: false,
            });
        } else {
          // Update existing user to mark setup as incomplete
          await supabase
            .from('users')
            .update({
              notion_setup_complete: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);
        }
      }

      // Clean up session
      await deleteOAuthSession(state);

      // Return appropriate response
      // Check if this is Alexa account linking (has amazon_account_id in session)
      if (session.amazon_account_id) {
        // For Alexa, return error in OAuth2 format
        const errorMsg = isNoAccount 
          ? 'Notion account not found. Please create a Notion account first, then retry.'
          : 'User denied Notion access. You can retry the connection later.';
        return NextResponse.json(
          { error: 'access_denied', error_description: errorMsg },
          { status: 400 }
        );
      }

      // For web flow, redirect with appropriate message
      if (isNoAccount) {
        return NextResponse.redirect(
          new URL(
            `/error?message=${encodeURIComponent('You need a Notion account to connect. Please create one first.')}&no_account=true&signup_url=https://www.notion.so/signup`,
            request.url
          )
        );
      }

      return NextResponse.redirect(
        new URL(
          `/error?message=${encodeURIComponent('Notion connection was denied. You can retry later.')}&denied=true`,
          request.url
        )
      );
    }

    // Handle success - exchange code for token
    if (!code) {
      return NextResponse.redirect(
        new URL('/error?message=Missing authorization code', request.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${notionClientId}:${notionClientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: notionRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      
      // Clean up session
      await deleteOAuthSession(state);

      return NextResponse.redirect(
        new URL(
          `/error?message=${encodeURIComponent('Failed to exchange token')}`,
          request.url
        )
      );
    }

    const { access_token } = await tokenResponse.json();

    // Setup Notion workspace (create Privacy page and databases)
    console.log('Starting Notion workspace setup...');
    const setupResult = await setupNotionWorkspace(access_token);
    console.log('Notion workspace setup result:', setupResult);
    
    if (!setupResult.success) {
      console.error('Notion workspace setup failed:', setupResult);
      // Continue anyway - user can retry later
    }
    
    // Get auth user from session if available (for web flow)
    let authUserId = session.auth_user_id || null;
    
    // If not in session, try to get from Supabase Auth (this won't work in server context, but keep for reference)
    if (!authUserId) {
      console.log('No auth_user_id in session, will use email for lookup');
    }
    
    // Create or update user with Notion token and setup data
    console.log('=== Starting User Database Update ===');
    console.log('Session data:', {
      amazon_account_id: session.amazon_account_id,
      auth_user_id: session.auth_user_id,
      email: session.email,
      has_license_key: !!session.license_key
    });
    console.log('Setup result:', {
      success: setupResult.success,
      privacyPageId: setupResult.privacyPageId,
      tasksDbId: setupResult.tasksDbId,
      focusLogsDbId: setupResult.focusLogsDbId,
      energyLogsDbId: setupResult.energyLogsDbId
    });

    if (session.amazon_account_id) {
      // Alexa flow - update by amazon_account_id
      console.log('Alexa flow: Looking up user by amazon_account_id:', session.amazon_account_id);
      const { data: existingUser, error: lookupError } = await supabase
        .from('users')
        .select('*')
        .eq('amazon_account_id', session.amazon_account_id)
        .maybeSingle();

      if (lookupError) {
        console.error('Error looking up user by amazon_account_id:', lookupError);
      }

      if (existingUser) {
        console.log('Found existing user:', existingUser.id);
        const { data: updateData, error: updateError } = await supabase
          .from('users')
          .update({
            email: session.email,
            license_key: session.license_key,
            notion_token: access_token,
            notion_setup_complete: setupResult.success,
            privacy_page_id: setupResult.privacyPageId,
            tasks_db_id: setupResult.tasksDbId,
            focus_logs_db_id: setupResult.focusLogsDbId,
            energy_logs_db_id: setupResult.energyLogsDbId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id)
          .select();
        
        if (updateError) {
          console.error('❌ Error updating user (Alexa flow):', updateError);
          console.error('Update error details:', JSON.stringify(updateError, null, 2));
        } else {
          console.log('✅ Successfully updated user (Alexa flow):', updateData);
        }
      } else {
        console.log('User not found, creating new user (Alexa flow)');
        const { data: insertData, error: insertError } = await supabase
          .from('users')
          .insert({
            amazon_account_id: session.amazon_account_id,
            email: session.email,
            license_key: session.license_key,
            notion_token: access_token,
            notion_setup_complete: setupResult.success,
            privacy_page_id: setupResult.privacyPageId,
            tasks_db_id: setupResult.tasksDbId,
            focus_logs_db_id: setupResult.focusLogsDbId,
            energy_logs_db_id: setupResult.energyLogsDbId,
          })
          .select();
        
        if (insertError) {
          console.error('❌ Error creating user (Alexa flow):', insertError);
          console.error('Insert error details:', JSON.stringify(insertError, null, 2));
        } else {
          console.log('✅ Successfully created user (Alexa flow):', insertData);
        }
      }
    } else {
      // Web flow - update user by auth_user_id or email
      console.log('Web flow: Looking up user by auth_user_id or email');
      let existingUser = null;
      let lookupMethod = '';
      
      if (authUserId) {
        console.log('Trying to find user by auth_user_id:', authUserId);
        const { data, error: lookupError } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        
        if (lookupError) {
          console.error('Error looking up by auth_user_id:', lookupError);
        } else if (data) {
          existingUser = data;
          lookupMethod = 'auth_user_id';
          console.log('✅ Found user by auth_user_id:', data.id);
        }
      }
      
      if (!existingUser && session.email) {
        console.log('Trying to find user by email:', session.email);
        const { data, error: lookupError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.email)
          .maybeSingle();
        
        if (lookupError) {
          console.error('Error looking up by email:', lookupError);
        } else if (data) {
          existingUser = data;
          lookupMethod = 'email';
          console.log('✅ Found user by email:', data.id);
        }
      }

      if (existingUser) {
        console.log(`Updating existing user (found by ${lookupMethod}):`, existingUser.id);
        const { data: updateData, error: updateError } = await supabase
          .from('users')
          .update({
            notion_token: access_token,
            notion_setup_complete: setupResult.success,
            privacy_page_id: setupResult.privacyPageId,
            tasks_db_id: setupResult.tasksDbId,
            focus_logs_db_id: setupResult.focusLogsDbId,
            energy_logs_db_id: setupResult.energyLogsDbId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id)
          .select();
        
        if (updateError) {
          console.error('❌ Error updating user (Web flow):', updateError);
          console.error('Update error details:', JSON.stringify(updateError, null, 2));
          console.error('Update query details:', {
            user_id: existingUser.id,
            notion_token_length: access_token?.length,
            setup_success: setupResult.success
          });
        } else {
          console.log('✅ Successfully updated user (Web flow):', updateData);
        }
      } else {
        console.warn('⚠️ User not found for Notion connection');
        console.warn('Lookup attempted with:', {
          auth_user_id: authUserId,
          email: session.email
        });
        
        // Try to create user if we have enough info
        if (authUserId || session.email) {
          console.log('Attempting to create new user...');
          const { data: insertData, error: insertError } = await supabase
            .from('users')
            .insert({
              auth_user_id: authUserId,
              email: session.email,
              notion_token: access_token,
              notion_setup_complete: setupResult.success,
              privacy_page_id: setupResult.privacyPageId,
              tasks_db_id: setupResult.tasksDbId,
              focus_logs_db_id: setupResult.focusLogsDbId,
              energy_logs_db_id: setupResult.energyLogsDbId,
              license_key: session.license_key || '',
              onboarding_complete: false,
            })
            .select();
          
          if (insertError) {
            console.error('❌ Error creating user (Web flow):', insertError);
            console.error('Insert error details:', JSON.stringify(insertError, null, 2));
            console.error('Insert data attempted:', {
              auth_user_id: authUserId,
              email: session.email,
              has_notion_token: !!access_token,
              has_license_key: !!session.license_key
            });
          } else {
            console.log('✅ Successfully created user (Web flow):', insertData);
          }
        } else {
          console.error('❌ Cannot create user: missing both auth_user_id and email');
        }
      }
    }
    console.log('=== User Database Update Complete ===');

    // Clean up session
    await deleteOAuthSession(state);

    // Handle Alexa account linking - return OAuth2 token format
    if (session.amazon_account_id) {
      // Generate a token for Alexa (this could be a JWT or simple token)
      // For simplicity, we'll use a base64 encoded string of user info
      const alexaToken = Buffer.from(
        JSON.stringify({
          amazon_account_id: session.amazon_account_id,
          email: session.email,
          timestamp: Date.now(),
        })
      ).toString('base64');

      return NextResponse.json({
        access_token: alexaToken,
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    // Regular web flow - redirect to onboarding with success message
    const redirectUrl = new URL('/onboarding', request.url);
    if (setupResult.success) {
      redirectUrl.searchParams.set('notion_connected', 'true');
    }
    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/error?message=${encodeURIComponent('OAuth callback failed')}`,
        request.url
      )
    );
  }
}

// Handle POST requests from Alexa account linking
export async function POST(request: NextRequest) {
  // Alexa sends POST with form data for token exchange
  const formData = await request.formData();
  const code = formData.get('code') as string;
  const state = formData.get('state') as string;

  if (!code || !state) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing code or state' },
      { status: 400 }
    );
  }

  // Reuse GET handler logic by constructing a new request
  const url = new URL(request.url);
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);

  const newRequest = new Request(url.toString(), {
    method: 'GET',
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      'content-type': 'application/x-www-form-urlencoded',
    },
  });

  return GET(newRequest as NextRequest);
}

