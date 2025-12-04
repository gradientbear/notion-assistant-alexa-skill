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
      shoppingDbId: setupResult.shoppingDbId,
      workoutsDbId: setupResult.workoutsDbId,
      mealsDbId: setupResult.mealsDbId,
      notesDbId: setupResult.notesDbId,
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
        
        // Prepare update data - only include database IDs that were actually created
        // notion_setup_complete should be true if we have a token AND critical setup succeeded
        const criticalSetupSuccess = !!(setupResult.privacyPageId && setupResult.tasksDbId);
        const updateData: any = {
          email: session.email,
          license_key: session.license_key,
          notion_token: access_token,
          notion_setup_complete: criticalSetupSuccess, // True if critical components created
          updated_at: new Date().toISOString(),
        };
        
        // Only update database IDs if they were successfully created (not null)
        if (setupResult.privacyPageId) {
          updateData.privacy_page_id = setupResult.privacyPageId;
        }
        if (setupResult.tasksDbId) {
          updateData.tasks_db_id = setupResult.tasksDbId;
        }
        if (setupResult.shoppingDbId) {
          updateData.shopping_db_id = setupResult.shoppingDbId;
        }
        if (setupResult.workoutsDbId) {
          updateData.workouts_db_id = setupResult.workoutsDbId;
        }
        if (setupResult.mealsDbId) {
          updateData.meals_db_id = setupResult.mealsDbId;
        }
        if (setupResult.notesDbId) {
          updateData.notes_db_id = setupResult.notesDbId;
        }
        if (setupResult.energyLogsDbId) {
          updateData.energy_logs_db_id = setupResult.energyLogsDbId;
        }
        
        console.log('Update data prepared (Alexa flow):', {
          has_notion_token: !!updateData.notion_token,
          notion_setup_complete: updateData.notion_setup_complete,
          database_ids: {
            privacy_page: !!updateData.privacy_page_id,
            tasks: !!updateData.tasks_db_id,
            shopping: !!updateData.shopping_db_id,
            workouts: !!updateData.workouts_db_id,
            meals: !!updateData.meals_db_id,
            notes: !!updateData.notes_db_id,
            energy_logs: !!updateData.energy_logs_db_id,
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
        // notion_setup_complete should be true if we have a token AND critical setup succeeded
        const criticalSetupSuccess = !!(setupResult.privacyPageId && setupResult.tasksDbId);
        const insertDataObj: any = {
          amazon_account_id: session.amazon_account_id,
          email: session.email,
          license_key: session.license_key,
          notion_token: access_token,
          notion_setup_complete: criticalSetupSuccess, // True if critical components created
        };
        
        // Only add database IDs if they were successfully created
        if (setupResult.privacyPageId) {
          insertDataObj.privacy_page_id = setupResult.privacyPageId;
        }
        if (setupResult.tasksDbId) {
          insertDataObj.tasks_db_id = setupResult.tasksDbId;
        }
        if (setupResult.shoppingDbId) {
          insertDataObj.shopping_db_id = setupResult.shoppingDbId;
        }
        if (setupResult.workoutsDbId) {
          insertDataObj.workouts_db_id = setupResult.workoutsDbId;
        }
        if (setupResult.mealsDbId) {
          insertDataObj.meals_db_id = setupResult.mealsDbId;
        }
        if (setupResult.notesDbId) {
          insertDataObj.notes_db_id = setupResult.notesDbId;
        }
        if (setupResult.energyLogsDbId) {
          insertDataObj.energy_logs_db_id = setupResult.energyLogsDbId;
        }
        
        console.log('Insert data prepared (Alexa flow):', {
          has_notion_token: !!insertDataObj.notion_token,
          notion_setup_complete: insertDataObj.notion_setup_complete,
          database_ids: {
            privacy_page: !!insertDataObj.privacy_page_id,
            tasks: !!insertDataObj.tasks_db_id,
            shopping: !!insertDataObj.shopping_db_id,
            workouts: !!insertDataObj.workouts_db_id,
            meals: !!insertDataObj.meals_db_id,
            notes: !!insertDataObj.notes_db_id,
            energy_logs: !!insertDataObj.energy_logs_db_id,
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
      // Web flow - update user by auth_user_id or email
      console.log('Web flow: Looking up user by auth_user_id or email');
      let existingUser = null;
      let lookupMethod = '';
      
      if (authUserId) {
        console.log('Trying to find user by auth_user_id:', authUserId);
        // Use .select() instead of .maybeSingle() to handle duplicate auth_user_id cases
        // Same logic as /api/users/me to ensure consistency
        const { data: usersByAuthId, error: lookupError } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', authUserId);
        
        if (lookupError) {
          console.error('Error looking up by auth_user_id:', lookupError);
        } else if (usersByAuthId && usersByAuthId.length > 0) {
          // If multiple users found, prefer:
          // 1. User with Notion token (most complete) - same as /api/users/me
          // 2. Most recently updated
          const userWithToken = usersByAuthId.find(u => !!(u as any).notion_token);
          if (userWithToken) {
            existingUser = userWithToken;
            console.log('✅ Found user by auth_user_id with Notion token:', {
              user_id: existingUser.id,
              has_notion_token: true,
            });
          } else {
            existingUser = usersByAuthId.sort((a, b) => 
              new Date(b.updated_at || b.created_at).getTime() - 
              new Date(a.updated_at || a.created_at).getTime()
            )[0];
            console.log('✅ Found user by auth_user_id (most recent):', {
              user_id: existingUser.id,
              updated_at: existingUser.updated_at,
            });
          }
          
          if (usersByAuthId.length > 1) {
            console.warn('⚠️ Multiple users found with same auth_user_id!', {
              total_users: usersByAuthId.length,
              selected_user_id: existingUser.id,
              all_user_ids: usersByAuthId.map(u => ({
                id: u.id,
                has_notion_token: !!(u as any).notion_token,
                updated_at: u.updated_at,
              })),
              auth_user_id: authUserId,
            });
          }
          
          lookupMethod = 'auth_user_id';
        }
      }
      
      if (!existingUser && session.email) {
        console.log('Trying to find user by email:', session.email);
        // Use .select() instead of .maybeSingle() to handle multiple users
        const { data: usersByEmail, error: lookupError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.email);
        
        if (lookupError) {
          console.error('Error looking up by email:', lookupError);
        } else if (usersByEmail && usersByEmail.length > 0) {
          // If multiple users found, prioritize:
          // 1. User with matching auth_user_id (if we have it)
          // 2. User with notion_token (already connected)
          // 3. Most recently updated user
          let selectedUser = usersByEmail[0];
          
          // CRITICAL: If we have auth_user_id, prioritize user with matching auth_user_id
          // This ensures we update the correct user record
          if (authUserId) {
            const userWithAuthId = usersByEmail.find(u => u.auth_user_id === authUserId);
            if (userWithAuthId) {
              selectedUser = userWithAuthId;
              console.log('✅ Found user by email + auth_user_id match:', {
                user_id: selectedUser.id,
                auth_user_id: selectedUser.auth_user_id,
                matches: selectedUser.auth_user_id === authUserId,
              });
            } else {
              console.warn('⚠️ No user found with matching auth_user_id:', {
                auth_user_id: authUserId,
                available_auth_user_ids: usersByEmail.map(u => u.auth_user_id),
                user_ids: usersByEmail.map(u => u.id),
              });
            }
          }
          
          // Only fall back to user with token if we don't have auth_user_id match
          if (!authUserId && !selectedUser.notion_token) {
            const userWithToken = usersByEmail.find(u => !!(u as any).notion_token);
            if (userWithToken) {
              selectedUser = userWithToken;
              console.log('✅ Found user by email with existing Notion token:', selectedUser.id);
            }
          }
          
          existingUser = selectedUser;
          lookupMethod = 'email';
          console.log('✅ Selected user by email:', existingUser.id);
          
          // If auth_user_id is missing but we have it, update it
          if (!existingUser.auth_user_id && authUserId) {
            console.log('Updating missing auth_user_id for user found by email');
            await supabase
              .from('users')
              .update({ auth_user_id: authUserId })
              .eq('id', existingUser.id);
          }
        }
      }

      if (existingUser) {
        console.log(`Updating existing user (found by ${lookupMethod}):`, {
          user_id: existingUser.id,
          auth_user_id: existingUser.auth_user_id,
          session_auth_user_id: authUserId,
          email: existingUser.email,
          session_email: session.email,
          matches_auth_user_id: existingUser.auth_user_id === authUserId,
        });
        
        // CRITICAL: If auth_user_id doesn't match and we have it, this might be the wrong user
        // In this case, we should still update but also log a warning
        if (authUserId && existingUser.auth_user_id && existingUser.auth_user_id !== authUserId) {
          console.warn('⚠️ WARNING: User found but auth_user_id mismatch!', {
            found_user_id: existingUser.id,
            found_auth_user_id: existingUser.auth_user_id,
            session_auth_user_id: authUserId,
            lookup_method: lookupMethod,
          });
          console.warn('⚠️ This might indicate duplicate user records. Updating anyway, but verify data integrity.');
        }
        
        // Prepare update data - only include database IDs that were actually created
        // notion_setup_complete should be true if we have a token AND critical setup succeeded
        // Critical setup = Voice Planner page + Tasks database
        const criticalSetupSuccess = !!(setupResult.privacyPageId && setupResult.tasksDbId);
        const updateData: any = {
          notion_token: access_token,
          notion_setup_complete: criticalSetupSuccess, // True if critical components created
          updated_at: new Date().toISOString(),
        };
        
        // Only update database IDs if they were successfully created (not null)
        if (setupResult.privacyPageId) {
          updateData.privacy_page_id = setupResult.privacyPageId;
        }
        if (setupResult.tasksDbId) {
          updateData.tasks_db_id = setupResult.tasksDbId;
        }
        if (setupResult.shoppingDbId) {
          updateData.shopping_db_id = setupResult.shoppingDbId;
        }
        if (setupResult.workoutsDbId) {
          updateData.workouts_db_id = setupResult.workoutsDbId;
        }
        if (setupResult.mealsDbId) {
          updateData.meals_db_id = setupResult.mealsDbId;
        }
        if (setupResult.notesDbId) {
          updateData.notes_db_id = setupResult.notesDbId;
        }
        if (setupResult.energyLogsDbId) {
          updateData.energy_logs_db_id = setupResult.energyLogsDbId;
        }
        
        // CRITICAL: Always ensure auth_user_id is set correctly
        // If auth_user_id is missing or doesn't match, update it
        if (authUserId) {
          if (!existingUser.auth_user_id || existingUser.auth_user_id !== authUserId) {
            updateData.auth_user_id = authUserId;
            console.log('Updating auth_user_id to match session:', {
              old_auth_user_id: existingUser.auth_user_id,
              new_auth_user_id: authUserId,
            });
          }
        }
        
        console.log('Update data prepared:', {
          has_notion_token: !!updateData.notion_token,
          notion_setup_complete: updateData.notion_setup_complete,
          database_ids: {
            privacy_page: !!updateData.privacy_page_id,
            tasks: !!updateData.tasks_db_id,
            shopping: !!updateData.shopping_db_id,
            workouts: !!updateData.workouts_db_id,
            meals: !!updateData.meals_db_id,
            notes: !!updateData.notes_db_id,
            energy_logs: !!updateData.energy_logs_db_id,
          }
        });
        
        const { data: updateResult, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', existingUser.id)
          .select();
        
        if (updateError) {
          console.error('❌ Error updating user (Web flow):', updateError);
          console.error('Update error details:', JSON.stringify(updateError, null, 2));
          console.error('Update query details:', {
            user_id: existingUser.id,
            notion_token_length: access_token?.length,
            setup_success: setupResult.success,
            critical_setup_success: !!(setupResult.privacyPageId && setupResult.tasksDbId),
          });
        } else {
          console.log('✅ Successfully updated user (Web flow):', {
            user_id: updateResult?.[0]?.id,
            notion_token_set: !!updateResult?.[0]?.notion_token,
            notion_setup_complete: updateResult?.[0]?.notion_setup_complete,
            update_data_sent: updateData,
          });
          
          // Verify the update by querying the user back immediately
          const { data: verifyUser, error: verifyError } = await supabase
            .from('users')
            .select('id, auth_user_id, notion_token, notion_setup_complete, tasks_db_id, privacy_page_id')
            .eq('id', existingUser.id)
            .single();
          
          if (verifyError) {
            console.error('❌ Error verifying user update:', verifyError);
          } else {
            console.log('✅ User update verified:', {
              user_id: verifyUser.id,
              auth_user_id: verifyUser.auth_user_id,
              has_notion_token: !!verifyUser.notion_token,
              notion_token_length: verifyUser.notion_token?.length || 0,
              notion_setup_complete: verifyUser.notion_setup_complete,
              has_tasks_db: !!verifyUser.tasks_db_id,
              has_privacy_page: !!verifyUser.privacy_page_id,
            });
            
            // If verification shows update didn't work, log critical error
            if (!verifyUser.notion_token) {
              console.error('❌ CRITICAL: notion_token is NULL after update!', {
                user_id: verifyUser.id,
                update_data_sent: {
                  notion_token_length: access_token?.length,
                  notion_setup_complete: criticalSetupSuccess,
                },
                actual_values: {
                  notion_token: verifyUser.notion_token,
                  notion_setup_complete: verifyUser.notion_setup_complete,
                },
              });
            } else if (verifyUser.notion_setup_complete !== criticalSetupSuccess) {
              console.warn('⚠️ notion_setup_complete mismatch:', {
                expected: criticalSetupSuccess,
                actual: verifyUser.notion_setup_complete,
                has_privacy_page: !!verifyUser.privacy_page_id,
                has_tasks_db: !!verifyUser.tasks_db_id,
              });
            }
          }
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
          
          // Only include database IDs that were actually created (not null)
          // notion_setup_complete should be true if we have a token AND critical setup succeeded
          const criticalSetupSuccess = !!(setupResult.privacyPageId && setupResult.tasksDbId);
          const insertDataObj: any = {
            auth_user_id: authUserId,
            email: session.email,
            notion_token: access_token,
            notion_setup_complete: criticalSetupSuccess, // True if critical components created
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
          if (setupResult.shoppingDbId) {
            insertDataObj.shopping_db_id = setupResult.shoppingDbId;
          }
          if (setupResult.workoutsDbId) {
            insertDataObj.workouts_db_id = setupResult.workoutsDbId;
          }
          if (setupResult.mealsDbId) {
            insertDataObj.meals_db_id = setupResult.mealsDbId;
          }
          if (setupResult.notesDbId) {
            insertDataObj.notes_db_id = setupResult.notesDbId;
          }
          if (setupResult.energyLogsDbId) {
            insertDataObj.energy_logs_db_id = setupResult.energyLogsDbId;
          }
          
          console.log('Insert data prepared:', {
            has_notion_token: !!insertDataObj.notion_token,
            notion_setup_complete: insertDataObj.notion_setup_complete,
            database_ids: {
              privacy_page: !!insertDataObj.privacy_page_id,
              tasks: !!insertDataObj.tasks_db_id,
              shopping: !!insertDataObj.shopping_db_id,
              workouts: !!insertDataObj.workouts_db_id,
              meals: !!insertDataObj.meals_db_id,
              notes: !!insertDataObj.notes_db_id,
              energy_logs: !!insertDataObj.energy_logs_db_id,
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

    // Regular web flow - redirect to dashboard with success message
    // Use critical success (page + Tasks DB) instead of full success (all databases)
    const criticalSetupSuccess = !!(setupResult.privacyPageId && setupResult.tasksDbId);
    const redirectUrl = new URL('/dashboard', request.url);
    
    // Always set notion_connected flag if we have a token (even if setup partially failed)
    // The dashboard will check notion_setup_complete to determine if setup was successful
    if (access_token) {
      redirectUrl.searchParams.set('notion_connected', 'true');
      console.log('✅ Redirecting to dashboard with notion_connected=true (token obtained)');
      if (!criticalSetupSuccess) {
        console.warn('⚠️ Warning: Notion token obtained but critical setup failed:', {
          privacyPageId: setupResult.privacyPageId,
          tasksDbId: setupResult.tasksDbId,
        });
      }
    } else {
      console.error('❌ No access token obtained, redirecting without notion_connected flag');
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

