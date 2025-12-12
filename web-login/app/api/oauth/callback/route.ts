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

    console.log('[OAuth Callback] Retrieving OAuth session for state:', state.substring(0, 16) + '...');
    const session = await getOAuthSession(state);
    
    if (!session) {
      console.error('[OAuth Callback] ❌ OAuth session not found or expired:', {
        state: state.substring(0, 16) + '...',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.redirect(
        new URL('/error?message=Invalid or expired session. Please try connecting Notion again.', request.url)
      );
    }
    
    console.log('[OAuth Callback] ✅ OAuth session retrieved:', {
      session_id: session.id,
      email: session.email,
      has_auth_user_id: !!session.auth_user_id,
      auth_user_id: session.auth_user_id,
      has_amazon_account_id: !!session.amazon_account_id,
      expires_at: session.expires_at,
    });

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

    console.log('🔍 Token exchange result:', {
      has_access_token: !!access_token,
      access_token_length: access_token?.length || 0,
      access_token_preview: access_token ? access_token.substring(0, 20) + '...' : 'null',
    });

    // Setup Notion workspace (create Privacy page and databases)
    console.log('Starting Notion workspace setup...');
    const setupResult = await setupNotionWorkspace(access_token);
    console.log('Notion workspace setup result:', setupResult);
    
    if (!setupResult.success) {
      console.error('Notion workspace setup failed:', setupResult);
      // If critical setup failed (no page or no database), log detailed error
      if (!setupResult.privacyPageId) {
        console.error('❌ CRITICAL: Voice Planner page was not created!');
      }
      if (!setupResult.tasksDbId) {
        console.error('❌ CRITICAL: Tasks database was not created!');
      }
      // Continue anyway - user can retry later, but we should still save the token
    } else {
      console.log('✅ Notion workspace setup completed successfully:', {
        privacyPageId: setupResult.privacyPageId,
        tasksDbId: setupResult.tasksDbId,
      });
    }
    
    // Get Supabase Auth user ID from OAuth session (MOST RELIABLE - stored during initiation)
    let authUserId: string | null = session.auth_user_id || null;
    
    console.log('[OAuth Callback] 🔍 User ID resolution:', {
      session_auth_user_id: session.auth_user_id,
      session_email: session.email,
      session_amazon_account_id: session.amazon_account_id,
      resolved_auth_user_id: authUserId,
    });
    
    if (authUserId) {
      console.log('[OAuth Callback] ✅ Got auth user ID from OAuth session:', authUserId);
    } else {
      // Fallback: Try to get from Supabase session token (for backward compatibility)
      const supabaseAuthUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseAuthUrl && supabaseAnonKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAuth = createClient(supabaseAuthUrl, supabaseAnonKey);
        
        // Try to get session token from cookies
        const projectRef = supabaseAuthUrl.split('//')[1]?.split('.')[0] || 'default';
        const cookieNames = [
          'sb-access-token',
          `sb-${projectRef}-auth-token`,
          `sb-${projectRef}-auth-token-code-verifier`,
        ];
        
        let sessionToken: string | null = null;
        for (const cookieName of cookieNames) {
          const cookieValue = request.cookies.get(cookieName)?.value;
          if (cookieValue) {
            sessionToken = cookieValue;
            break;
          }
        }
        
        // Try Authorization header
        if (!sessionToken) {
          const authHeader = request.headers.get('authorization');
          sessionToken = authHeader?.replace('Bearer ', '') || null;
        }
        
        if (sessionToken) {
          try {
            const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(sessionToken);
            if (!authError && authUser) {
              authUserId = authUser.id;
              console.log('✅ Got auth user ID from Supabase session token:', authUserId);
            }
          } catch (err) {
            console.log('Error getting user from session token:', err);
          }
        }
      }
      
      // LAST RESORT: Email lookup (ONLY for Alexa flow, NOT web flow)
      if (!authUserId && session.amazon_account_id && session.email) {
        console.log('⚠️ Alexa flow: Looking up user by email as fallback:', session.email);
        const { data: userByEmail, error: emailError } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.email)
          .maybeSingle();
        
        if (!emailError && userByEmail) {
          authUserId = userByEmail.id;
          console.log('✅ Got user ID from email lookup (Alexa flow):', authUserId);
        }
      }
    }
    
    // For web flow, REQUIRE authUserId
    if (!authUserId && !session.amazon_account_id) {
      console.error('❌ CRITICAL: No auth user ID found for web flow!');
      return NextResponse.redirect(
        new URL('/error?message=Authentication required. Please sign in and try again.', request.url)
      );
    }
    
    // Create or update user with Notion token and setup data
    console.log('=== Starting User Database Update ===');
    console.log('Session data:', {
      amazon_account_id: session.amazon_account_id,
      email: session.email,
      has_license_key: !!session.license_key,
      auth_user_id_from_session: authUserId,
    });
    console.log('Setup result:', {
      success: setupResult.success,
      privacyPageId: setupResult.privacyPageId,
      tasksDbId: setupResult.tasksDbId,
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
        
        // Prepare update data - only include database IDs that were actually created
        // notion_setup_complete should be true if we have a token (connection successful)
        const hasToken = !!access_token;
        const updateData: any = {
          email: session.email,
          license_key: session.license_key,
          notion_token: access_token,
          notion_setup_complete: hasToken, // True if we have a token (connection successful)
          updated_at: new Date().toISOString(),
        };
        
        // Always update database IDs if setup returned them (even if user already had them)
        // This ensures IDs are refreshed if pages were recreated
        if (setupResult.privacyPageId) {
          updateData.privacy_page_id = setupResult.privacyPageId;
        }
        if (setupResult.tasksDbId) {
          updateData.tasks_db_id = setupResult.tasksDbId;
        }
        // If setup failed but user had existing IDs, keep them
        // But log a warning
        const existingPrivacyPageId = (existingUser as any).privacy_page_id;
        const existingTasksDbId = (existingUser as any).tasks_db_id;
        if (!setupResult.success && (existingPrivacyPageId || existingTasksDbId)) {
          console.warn('⚠️ Setup failed but user has existing page/database IDs. Keeping existing IDs.');
          // Don't overwrite existing IDs if setup failed
          if (!setupResult.privacyPageId && existingPrivacyPageId) {
            updateData.privacy_page_id = existingPrivacyPageId;
          }
          if (!setupResult.tasksDbId && existingTasksDbId) {
            updateData.tasks_db_id = existingTasksDbId;
          }
        }
        
        console.log('Update data prepared (Alexa flow):', {
          has_notion_token: !!updateData.notion_token,
          notion_setup_complete: updateData.notion_setup_complete,
          database_ids: {
            privacy_page: !!updateData.privacy_page_id,
            tasks: !!updateData.tasks_db_id,
          }
        });
        
        const { data: updateResult, error: updateError } = await supabase
          .from('users')
          .update(updateData)
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
        
        // Only include database IDs that were actually created (not null)
        // notion_setup_complete should be true if we have a token (connection successful)
        const hasToken = !!access_token;
        const insertDataObj: any = {
          amazon_account_id: session.amazon_account_id,
          email: session.email,
          license_key: session.license_key,
          notion_token: access_token,
          notion_setup_complete: hasToken, // True if we have a token (connection successful)
        };
        
        // Only add database IDs if they were successfully created
        if (setupResult.privacyPageId) {
          insertDataObj.privacy_page_id = setupResult.privacyPageId;
        }
        if (setupResult.tasksDbId) {
          insertDataObj.tasks_db_id = setupResult.tasksDbId;
        }
        
        console.log('Insert data prepared (Alexa flow):', {
          has_notion_token: !!insertDataObj.notion_token,
          notion_setup_complete: insertDataObj.notion_setup_complete,
          database_ids: {
            privacy_page: !!insertDataObj.privacy_page_id,
            tasks: !!insertDataObj.tasks_db_id,
          }
        });
        
        const { data: insertData, error: insertError } = await supabase
          .from('users')
          .insert(insertDataObj)
          .select();
        
        if (insertError) {
          console.error('❌ Error creating user (Alexa flow):', insertError);
          console.error('Insert error details:', JSON.stringify(insertError, null, 2));
        } else {
          console.log('✅ Successfully created user (Alexa flow):', insertData);
        }
      }
    } else {
      // Web flow - update user by id (which matches Supabase Auth user id) or email
      console.log('Web flow: Looking up user by id or email');
      let existingUser = null;
      let verifyUser: any = null; // Declare at web flow scope for final verification
      
      if (authUserId) {
        console.log('[OAuth Callback] 🔍 Looking up user by id (users.id = auth.users.id):', authUserId);
        const { data: user, error: lookupError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUserId)
          .single();
        
        if (lookupError) {
          console.error('[OAuth Callback] ❌ Error looking up user by id:', {
            error_code: lookupError.code,
            error_message: lookupError.message,
            error_details: lookupError.details,
            auth_user_id: authUserId,
          });
        } else if (user) {
          existingUser = user;
          console.log('[OAuth Callback] ✅ Found user by id:', {
            user_id: existingUser.id,
            email: existingUser.email,
            has_notion_token: !!(existingUser as any).notion_token,
            notion_setup_complete: (existingUser as any).notion_setup_complete,
            ids_match: existingUser.id === authUserId,
          });
        } else {
          console.warn('[OAuth Callback] ⚠️ User not found by id:', authUserId);
        }
      }
      
      // For web flow, ONLY lookup by authUserId (never by email to avoid wrong user)
      if (!existingUser && authUserId && !session.amazon_account_id) {
        console.error('❌ User not found for Notion connection:', {
              auth_user_id: authUserId,
          email: session.email,
        });
        
        // User must be created via /auth/callback first
        return NextResponse.redirect(
          new URL(
            `/error?message=${encodeURIComponent('User account not found. Please sign in first.')}`,
            request.url
          )
        );
      }
      
      // For Alexa flow, allow email lookup as fallback
      if (!existingUser && session.amazon_account_id && session.email) {
        console.log('Trying to find user by email (Alexa flow):', session.email);
        const { data: userByEmail, error: lookupError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.email)
          .maybeSingle();
        
        if (lookupError) {
          console.error('Error looking up by email:', lookupError);
        } else if (userByEmail) {
          existingUser = userByEmail;
          console.log('✅ Found user by email (Alexa flow):', existingUser.id);
        }
      }

      console.log('🔍 Checking if existingUser is set:', {
        has_existing_user: !!existingUser,
        existing_user_id: existingUser?.id,
        existing_user_email: existingUser?.email,
      });

      if (existingUser) {
        console.log('✅ Updating existing user:', {
          user_id: existingUser.id,
          email: existingUser.email,
          session_email: session.email,
          auth_user_id_from_session: authUserId,
          id_matches: authUserId ? existingUser.id === authUserId : 'no_auth_id',
        });
        
        // CRITICAL: If id doesn't match and we have authUserId, this might be the wrong user
        // In this case, we should still update but also log a warning
        if (authUserId && existingUser.id !== authUserId) {
          console.warn('⚠️ WARNING: User found but id mismatch!', {
            found_user_id: existingUser.id,
            expected_id: authUserId,
            email: existingUser.email,
          });
          console.warn('⚠️ This might indicate duplicate user records. Updating anyway, but verify data integrity.');
        }
        
        // Prepare update data - only include database IDs that were actually created
        // notion_setup_complete should be true if we have a token (connection successful)
        const hasToken = !!access_token;
        const updateData: any = {
          notion_token: access_token,
          notion_setup_complete: hasToken, // True if we have a token (connection successful)
          updated_at: new Date().toISOString(),
        };
        
        // Always update database IDs if setup returned them (even if user already had them)
        // This ensures IDs are refreshed if pages were recreated
        if (setupResult.privacyPageId) {
          updateData.privacy_page_id = setupResult.privacyPageId;
        }
        if (setupResult.tasksDbId) {
          updateData.tasks_db_id = setupResult.tasksDbId;
        }
        // If setup failed but user had existing IDs, keep them
        // But log a warning
        const existingPrivacyPageId = (existingUser as any).privacy_page_id;
        const existingTasksDbId = (existingUser as any).tasks_db_id;
        if (!setupResult.success && (existingPrivacyPageId || existingTasksDbId)) {
          console.warn('⚠️ Setup failed but user has existing page/database IDs. Keeping existing IDs.');
          // Don't overwrite existing IDs if setup failed
          if (!setupResult.privacyPageId && existingPrivacyPageId) {
            updateData.privacy_page_id = existingPrivacyPageId;
          }
          if (!setupResult.tasksDbId && existingTasksDbId) {
            updateData.tasks_db_id = existingTasksDbId;
          }
        }
        
        // Note: users.id should already match Supabase Auth user id (authUserId)
        // If there's a mismatch, it indicates a data integrity issue that should be fixed separately
        if (authUserId && existingUser.id !== authUserId) {
          console.warn('⚠️ WARNING: User id mismatch detected:', {
            user_id: existingUser.id,
            auth_user_id: authUserId,
            message: 'This may indicate a data integrity issue. User will be updated anyway.',
          });
        }
        
        console.log('Update data prepared:', {
          has_notion_token: !!updateData.notion_token,
          notion_setup_complete: updateData.notion_setup_complete,
          database_ids: {
            privacy_page: !!updateData.privacy_page_id,
            tasks: !!updateData.tasks_db_id,
          },
          privacy_page_id: updateData.privacy_page_id,
          tasks_db_id: updateData.tasks_db_id,
          setup_result: {
            privacyPageId: setupResult.privacyPageId,
            tasksDbId: setupResult.tasksDbId,
            success: setupResult.success,
          },
        });
        
        console.log('🔍 CRITICAL: About to update user:', {
          existing_user_id: existingUser.id,
          auth_user_id: authUserId,
          ids_match: existingUser.id === authUserId,
          existing_user_updated_at: existingUser.updated_at,
          update_data_keys: Object.keys(updateData),
          notion_token_present: !!updateData.notion_token,
          notion_token_length: updateData.notion_token?.length || 0,
        });
        
        // CRITICAL: Ensure we're updating the correct user
        console.log('🔍 CRITICAL: Pre-update check:', {
          existing_user_id: existingUser.id,
          auth_user_id: authUserId,
          ids_match: existingUser.id === authUserId,
          existing_user_email: existingUser.email,
          update_data_notion_token_length: updateData.notion_token?.length || 0,
          update_data_notion_setup_complete: updateData.notion_setup_complete,
        });
        
        const { data: updateResult, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', existingUser.id)
          .select();
        
        console.log('🔍 Update query executed:', {
          has_result: !!updateResult,
          result_count: updateResult?.length || 0,
          has_error: !!updateError,
          error_message: updateError?.message,
          error_code: updateError?.code,
          update_result_first: updateResult?.[0] ? {
            id: updateResult[0].id,
            has_notion_token: !!updateResult[0].notion_token,
            notion_setup_complete: updateResult[0].notion_setup_complete,
            updated_at: updateResult[0].updated_at,
            privacy_page_id: (updateResult[0] as any).privacy_page_id,
            tasks_db_id: (updateResult[0] as any).tasks_db_id,
            has_privacy_page_id: !!(updateResult[0] as any).privacy_page_id,
            has_tasks_db_id: !!(updateResult[0] as any).tasks_db_id,
          } : null,
        });
        
        if (updateError) {
          console.error('❌ Error updating user (Web flow):', updateError);
          console.error('Update error details:', JSON.stringify(updateError, null, 2));
          console.error('Update query details:', {
            user_id: existingUser.id,
            notion_token_length: access_token?.length,
            setup_success: setupResult.success,
            critical_setup_success: !!(setupResult.privacyPageId && setupResult.tasksDbId),
            update_data: updateData,
          });
          // Don't continue if update failed
          return NextResponse.redirect(
            new URL('/error?message=Failed to save Notion connection. Please try again.', request.url)
          );
        }
        
        // CRITICAL: Check if update actually returned data
        if (!updateResult || updateResult.length === 0) {
          console.error('❌ CRITICAL: Update query returned no data! This means no rows were updated!', {
            user_id: existingUser.id,
            update_data: updateData,
            possible_causes: [
              'User ID does not exist in database',
              'RLS policy blocking update (unlikely with service key)',
              'Database connection issue',
            ],
          });
          return NextResponse.redirect(
            new URL('/error?message=Failed to save Notion connection. Please try again.', request.url)
          );
        }
        
        // CRITICAL: Verify the update result matches what we sent
        if (updateResult[0].id !== existingUser.id) {
          console.error('❌ CRITICAL: Update returned wrong user!', {
            expected_id: existingUser.id,
            returned_id: updateResult[0].id,
          });
          return NextResponse.redirect(
            new URL('/error?message=Failed to save Notion connection. Please try again.', request.url)
          );
        }
        
        console.log('✅ Successfully updated user (Web flow):', {
          user_id: updateResult[0]?.id,
          notion_token_set: !!updateResult[0]?.notion_token,
          notion_setup_complete: updateResult[0]?.notion_setup_complete,
          updated_at: updateResult[0]?.updated_at,
          update_data_sent: updateData,
          update_result_full: updateResult[0],
        });
        
        // Use the update result directly as primary verification (most reliable)
        verifyUser = updateResult[0];
        
        console.log('✅ User update verified (from update result):', {
          user_id: verifyUser.id,
          auth_user_id: authUserId,
          ids_match: verifyUser.id === authUserId,
          has_notion_token: !!verifyUser.notion_token,
          notion_token_length: verifyUser.notion_token?.length || 0,
          notion_setup_complete: verifyUser.notion_setup_complete,
          has_tasks_db: !!(verifyUser as any).tasks_db_id,
          has_privacy_page: !!(verifyUser as any).privacy_page_id,
          tasks_db_id: (verifyUser as any).tasks_db_id,
          privacy_page_id: (verifyUser as any).privacy_page_id,
          updated_at: verifyUser.updated_at,
        });
        
        // Additional verification: Query back after delay to ensure write is visible
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { data: verifyUserData, error: verifyError } = await supabase
            .from('users')
          .select('id, notion_token, notion_setup_complete, tasks_db_id, privacy_page_id, updated_at')
            .eq('id', existingUser.id)
            .single();
        
        if (!verifyError && verifyUserData) {
          console.log('🔍 CRITICAL: After update verification query:', {
            verified_user_id: verifyUserData.id,
            verified_updated_at: verifyUserData.updated_at,
            previous_updated_at: existingUser.updated_at,
            timestamp_changed: verifyUserData.updated_at !== existingUser.updated_at,
            has_notion_token: !!verifyUserData.notion_token,
            notion_setup_complete: verifyUserData.notion_setup_complete,
            privacy_page_id: (verifyUserData as any).privacy_page_id,
            tasks_db_id: (verifyUserData as any).tasks_db_id,
            has_privacy_page_id: !!(verifyUserData as any).privacy_page_id,
            has_tasks_db_id: !!(verifyUserData as any).tasks_db_id,
          });
          
          // If verification query shows different data, log warning
          if (verifyUserData.updated_at === existingUser.updated_at) {
            console.error('❌ CRITICAL WARNING: updated_at timestamp did not change in verification query!', {
              verified_user_id: verifyUserData.id,
              verified_updated_at: verifyUserData.updated_at,
              previous_updated_at: existingUser.updated_at,
            });
          }
          
          if (!verifyUserData.notion_token) {
            console.error('❌ CRITICAL: notion_token is NULL in verification query!', {
              user_id: verifyUserData.id,
              update_result_notion_token: !!verifyUser.notion_token,
              verification_query_notion_token: !!verifyUserData.notion_token,
            });
          }
          
          // Verify page/database IDs were saved
          if (!(verifyUserData as any).privacy_page_id) {
            console.error('❌ CRITICAL: privacy_page_id is NULL in verification query!', {
              user_id: verifyUserData.id,
              setup_result_privacy_page_id: setupResult.privacyPageId,
              update_data_privacy_page_id: updateData.privacy_page_id,
            });
          }
          
          if (!(verifyUserData as any).tasks_db_id) {
            console.error('❌ CRITICAL: tasks_db_id is NULL in verification query!', {
              user_id: verifyUserData.id,
              setup_result_tasks_db_id: setupResult.tasksDbId,
              update_data_tasks_db_id: updateData.tasks_db_id,
            });
          }
        } else if (verifyError) {
          console.error('❌ Error in verification query (non-critical):', verifyError);
        }
      } else {
        console.error('❌ User not found for Notion connection');
        console.error('Lookup attempted with:', {
          id: authUserId,
          email: session.email
        });
        
        // User must be created via /auth/callback first
        if (!authUserId) {
          console.error('❌ Cannot update user: no auth user ID available. User must sign in first.');
          return NextResponse.redirect(
            new URL(
              `/error?message=${encodeURIComponent('User account not found. Please sign in first.')}`,
              request.url
            )
          );
        }
        
        // Try to create user if we have authUserId (user should exist, but handle edge case)
        console.log('Attempting to create new user with Notion connection...');
          
          // Only include database IDs that were actually created (not null)
          // notion_setup_complete should be true if we have a token (connection successful)
          const hasToken = !!access_token;
          const insertDataObj: any = {
          id: authUserId, // Use id directly (matches Supabase Auth user id)
            email: session.email,
          provider: 'email', // Default, will be updated on next auth
          email_verified: false,
            notion_token: access_token,
            notion_setup_complete: hasToken, // True if we have a token (connection successful)
            license_key: session.license_key || '',
            onboarding_complete: false,
          };
          
          // Only add database IDs if they were successfully created
          if (setupResult.privacyPageId) {
            insertDataObj.privacy_page_id = setupResult.privacyPageId;
          }
          if (setupResult.tasksDbId) {
            insertDataObj.tasks_db_id = setupResult.tasksDbId;
          }
          
          console.log('Insert data prepared:', {
            has_notion_token: !!insertDataObj.notion_token,
            notion_setup_complete: insertDataObj.notion_setup_complete,
            database_ids: {
              privacy_page: !!insertDataObj.privacy_page_id,
              tasks: !!insertDataObj.tasks_db_id,
            }
          });
          
          const { data: insertData, error: insertError } = await supabase
            .from('users')
            .insert(insertDataObj)
            .select();
          
          if (insertError) {
            console.error('❌ Error creating user (Web flow):', insertError);
            console.error('Insert error details:', JSON.stringify(insertError, null, 2));
            console.error('Insert data attempted:', {
              id: authUserId,
              email: session.email,
              has_notion_token: !!access_token,
              has_license_key: !!session.license_key
            });
          } else {
            console.log('✅ Successfully created user (Web flow):', insertData);
          }
        }
      }
    
    console.log('=== User Database Update Complete ===');

    // Clean up session BEFORE redirect/response to prevent race conditions
    await deleteOAuthSession(state);

    // Handle Alexa account linking - return OAuth2 token format
    // BUT: Only return JSON if this is actually an Alexa OAuth request
    // Check if request is coming from Alexa (has specific headers or referer)
    // For web browser requests, always redirect to dashboard
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const isAlexaRequest = userAgent.includes('Alexa') || 
                          userAgent.includes('Amazon') ||
                          referer.includes('alexa.amazon.com') ||
                          referer.includes('layla.amazon.com') ||
                          request.headers.get('x-alexa-request') === 'true';
    
    // Only return JSON for actual Alexa requests
    // Web users with amazon_account_id should still get redirected
    if (session.amazon_account_id && isAlexaRequest) {
      // Generate a token for Alexa
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

    // Regular web flow - redirect to dashboard with success message
    // Use critical success (page + Tasks DB) instead of full success (all databases)
    const criticalSetupSuccess = !!(setupResult.privacyPageId && setupResult.tasksDbId);
    const redirectUrl = new URL('/dashboard', request.url);
    
    // Always set notion_connected flag if we have a token (even if setup partially failed)
    // The dashboard will check notion_setup_complete to determine if setup was successful
    if (access_token) {
      redirectUrl.searchParams.set('notion_connected', 'true');
      redirectUrl.searchParams.set('timestamp', Date.now().toString()); // Cache busting
      console.log('[OAuth Callback] ✅ Redirecting to dashboard with notion_connected=true (token obtained)');
      if (!criticalSetupSuccess) {
        console.warn('[OAuth Callback] ⚠️ Warning: Notion token obtained but critical setup failed:', {
          privacyPageId: setupResult.privacyPageId,
          tasksDbId: setupResult.tasksDbId,
        });
      }
      
      // Add a delay to allow database replication to catch up
      // This helps with read-after-write consistency in distributed systems
      // Increased to 2000ms (2 seconds) to handle Supabase replication lag
      console.log('[OAuth Callback] ⏳ Waiting 2000ms before redirect to ensure database write is visible...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Final verification: Query the user one more time to ensure update is visible
      if (authUserId) {
        const { data: finalVerifyUser, error: finalVerifyError } = await supabase
          .from('users')
          .select('id, notion_token, notion_setup_complete, updated_at')
          .eq('id', authUserId)
          .single();
        
        if (finalVerifyError) {
          console.error('[OAuth Callback] ❌ Final verification failed:', {
            error_code: finalVerifyError.code,
            error_message: finalVerifyError.message,
            auth_user_id: authUserId,
          });
        } else {
          console.log('[OAuth Callback] 🔍 Final verification before redirect:', {
            user_id: finalVerifyUser.id,
            has_notion_token: !!finalVerifyUser.notion_token,
            notion_setup_complete: finalVerifyUser.notion_setup_complete,
            updated_at: finalVerifyUser.updated_at,
            ids_match: finalVerifyUser.id === authUserId,
          });
          
          if (!finalVerifyUser.notion_token) {
            console.error('[OAuth Callback] ❌ CRITICAL: notion_token is NULL in final verification! Update may not have persisted!');
          } else {
            console.log('[OAuth Callback] ✅ Final verification passed - notion_token exists');
          }
        }
      }
    } else {
      console.error('[OAuth Callback] ❌ No access token obtained, redirecting without notion_connected flag');
    }
    
    console.log('[OAuth Callback] 🔄 Redirecting to:', redirectUrl.toString());
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

