import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, License } from '../types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

console.log('[Database] Initializing Supabase client:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  urlLength: supabaseUrl.length,
  keyLength: supabaseKey.length
});

if (!supabaseUrl || !supabaseKey) {
  const error = new Error('Missing Supabase environment variables');
  console.error('[Database] Error:', error.message);
  console.error('[Database] SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('[Database] SUPABASE_SERVICE_KEY:', supabaseKey ? 'SET' : 'MISSING');
  throw error;
}

// Configure Supabase client with timeout for Lambda environment
// Note: Supabase client uses default fetch which should work, but we handle timeouts in queries
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
});
console.log('[Database] Supabase client created successfully');

/**
 * Get user by Supabase Auth user ID (OAuth2 flow)
 * This is the primary method for OAuth2 users
 * Note: users.id now matches Supabase Auth user id directly
 */
export async function getUserByAuthUserId(authUserId: string): Promise<User | null> {
  console.log('[getUserByAuthUserId] Looking up user with id:', authUserId);
  console.log('[getUserByAuthUserId] ID type:', typeof authUserId);
  console.log('[getUserByAuthUserId] ID length:', authUserId.length);
  console.log('[getUserByAuthUserId] Supabase URL:', supabaseUrl);
  console.log('[getUserByAuthUserId] Has service key:', !!supabaseKey);
  
  try {
    const startTime = Date.now();
    const queryPromise = supabase
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    const timeoutPromise = new Promise<{ data: null; error: { code: string } }>((resolve) => {
      setTimeout(() => {
        console.warn('[getUserByAuthUserId] Query timeout after 5 seconds');
        resolve({ data: null, error: { code: 'TIMEOUT' } });
      }, 5000); // Increased from 1.5s to 5s for network latency
    });

    const result = await Promise.race([queryPromise, timeoutPromise]);
    const elapsed = Date.now() - startTime;
    const { data, error } = result as any;
    
    console.log('[getUserByAuthUserId] Query completed in', elapsed, 'ms');
    console.log('[getUserByAuthUserId] Query result:', {
      has_data: !!data,
      has_error: !!error,
      error_code: error?.code,
      error_message: error?.message,
      error_details: error?.details,
      error_hint: error?.hint,
      data_keys: data ? Object.keys(data) : null,
      data_id: data?.id,
    });

    if (error) {
      if (error.code !== 'PGRST116' && error.code !== 'TIMEOUT') {
        console.error('[getUserByAuthUserId] Supabase error:', error);
        console.error('[getUserByAuthUserId] Full error object:', JSON.stringify(error, null, 2));
      } else if (error.code === 'PGRST116') {
        console.log('[getUserByAuthUserId] No user found (expected for new users)');
      }
      return null;
    }

    if (!data) {
      console.log('[getUserByAuthUserId] No user found with id:', authUserId);
      // Try direct query to verify user exists and database is accessible
      console.log('[getUserByAuthUserId] Verifying database connectivity...');
      try {
        const { data: allUsers, error: allError } = await supabase
          .from('users')
          .select('id, email')
          .limit(5);
        console.log('[getUserByAuthUserId] Sample users in DB:', {
          count: allUsers?.length || 0,
          sample_ids: allUsers?.map((u: any) => u.id) || [],
          sample_emails: allUsers?.map((u: any) => u.email) || [],
          error: allError,
          error_code: allError?.code,
          error_message: allError?.message,
        });
        
        // Try exact match query with different method
        const { data: exactMatch, error: exactError } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', authUserId);
        console.log('[getUserByAuthUserId] Direct exact match query:', {
          has_data: !!exactMatch,
          data_count: exactMatch?.length || 0,
          data_ids: exactMatch?.map((u: any) => u.id) || [],
          error: exactError,
        });
      } catch (verifyError: any) {
        console.error('[getUserByAuthUserId] Error verifying database:', verifyError?.message);
      }
      return null;
    }

    console.log('[getUserByAuthUserId] User found:', {
      id: data.id,
      email: data.email,
      hasNotionToken: !!data.notion_token,
      notionTokenLength: data.notion_token?.length || 0
    });

    return data as User;
  } catch (err: any) {
    console.error('[getUserByAuthUserId] Unexpected error:', {
      message: err?.message,
      stack: err?.stack
    });
    return null;
  }
}

/**
 * Get user by Amazon account ID (Legacy fallback)
 * Only used for backward compatibility with old users who haven't migrated to OAuth2
 */
export async function getUserByAmazonId(amazonAccountId: string): Promise<User | null> {
  console.log('[getUserByAmazonId] Looking up user with amazon_account_id:', amazonAccountId);
  console.log('[getUserByAmazonId] Supabase URL:', supabaseUrl);
  console.log('[getUserByAmazonId] Has service key:', !!supabaseKey);
  
  try {
    const startTime = Date.now();
    
    // Try direct REST API call as fallback if Supabase client hangs
    // This bypasses the Supabase JS client which might have connection issues
    const directQuery = async () => {
      try {
        const queryUrl = `${supabaseUrl}/rest/v1/users?amazon_account_id=eq.${encodeURIComponent(amazonAccountId)}&select=*`;
        console.log('[getUserByAmazonId] Trying direct REST API call...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 second timeout
        
        const response = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (response.status === 404 || response.status === 406) {
            // No rows found - expected
            return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return { data: Array.isArray(data) ? (data[0] || null) : data, error: null };
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          throw new Error('TIMEOUT');
        }
        throw fetchError;
      }
    };
    
    // Use direct REST API first (more reliable in Lambda environment)
    // Supabase JS client can hang in Lambda due to connection pooling issues
    let result: any;
    
    try {
      console.log('[getUserByAmazonId] Using direct REST API (more reliable in Lambda)...');
      result = await directQuery();
    } catch (directError: any) {
      console.warn('[getUserByAmazonId] Direct REST API failed, trying Supabase client as fallback:', directError.message);
      
      // Fallback to Supabase client if direct API fails
      try {
        const queryPromise = supabase
          .from('users')
          .select('*')
          .eq('amazon_account_id', amazonAccountId)
          .maybeSingle();

        const timeoutPromise = new Promise<{ data: null; error: { code: string; message: string } }>((resolve) => {
          setTimeout(() => {
            const elapsed = Date.now() - startTime;
            console.warn('[getUserByAmazonId] Supabase client query timeout after 2 seconds (elapsed:', elapsed, 'ms)');
            resolve({ data: null, error: { code: 'TIMEOUT', message: 'Query timeout' } });
          }, 2000); // 2 second timeout for fallback
        });

        result = await Promise.race([queryPromise, timeoutPromise]);
        
        if (result && result.error && result.error.code === 'TIMEOUT') {
          console.error('[getUserByAmazonId] Both direct API and Supabase client failed');
          throw new Error('All query methods timed out');
        }
      } catch (clientError: any) {
        console.error('[getUserByAmazonId] Supabase client fallback also failed:', clientError.message);
        throw clientError;
      }
    }
    const elapsed = Date.now() - startTime;
    console.log('[getUserByAmazonId] Promise.race resolved in', elapsed, 'ms');
    console.log('[getUserByAmazonId] Result type:', typeof result);
    console.log('[getUserByAmazonId] Result keys:', result ? Object.keys(result) : 'null');
    
    const { data, error } = result as any;
    console.log('[getUserByAmazonId] Extracted data:', !!data, 'error:', error ? { code: error.code, message: error.message } : 'none');

    if (error) {
      // Only log non-PGRST116 errors (PGRST116 is "no rows found" which is expected)
      if (error.code !== 'PGRST116' && error.code !== 'TIMEOUT') {
        console.error('[getUserByAmazonId] Supabase error:', JSON.stringify(error, null, 2));
      } else if (error.code === 'PGRST116') {
        console.log('[getUserByAmazonId] No user found (expected for new users)');
      } else if (error.code === 'TIMEOUT') {
        console.warn('[getUserByAmazonId] Query timed out');
      }
      return null;
    }

    if (!data) {
      console.log('[getUserByAmazonId] No user found with amazon_account_id:', amazonAccountId);
      return null;
    }

    console.log('[getUserByAmazonId] User found:', {
      id: data.id,
      email: data.email,
      hasNotionToken: !!data.notion_token,
      notionTokenLength: data.notion_token?.length || 0
    });

    return data as User;
  } catch (err: any) {
    console.error('[getUserByAmazonId] Unexpected error:', {
      message: err?.message,
      stack: err?.stack
    });
    return null;
  }
}

export async function createUser(
  amazonAccountId: string,
  email: string,
  licenseKey: string,
  notionToken: string | null = null
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      amazon_account_id: amazonAccountId,
      email,
      license_key: licenseKey,
      notion_token: notionToken,
      notion_setup_complete: notionToken !== null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return data as User;
}

export async function updateUserNotionToken(
  userId: string,
  notionToken: string
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      notion_token: notionToken,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update Notion token: ${error.message}`);
  }
}

export async function updateUserNotionSetup(
  userId: string,
  setupData: {
    privacyPageId?: string | null;
    tasksDbId?: string | null;
    shoppingDbId?: string | null;
    workoutsDbId?: string | null;
    mealsDbId?: string | null;
    notesDbId?: string | null;
    energyLogsDbId?: string | null;
    setupComplete?: boolean;
  }
): Promise<void> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (setupData.privacyPageId !== undefined) {
    updateData.privacy_page_id = setupData.privacyPageId;
  }
  if (setupData.tasksDbId !== undefined) {
    updateData.tasks_db_id = setupData.tasksDbId;
  }
  if (setupData.shoppingDbId !== undefined) {
    updateData.shopping_db_id = setupData.shoppingDbId;
  }
  if (setupData.workoutsDbId !== undefined) {
    updateData.workouts_db_id = setupData.workoutsDbId;
  }
  if (setupData.mealsDbId !== undefined) {
    updateData.meals_db_id = setupData.mealsDbId;
  }
  if (setupData.notesDbId !== undefined) {
    updateData.notes_db_id = setupData.notesDbId;
  }
  if (setupData.energyLogsDbId !== undefined) {
    updateData.energy_logs_db_id = setupData.energyLogsDbId;
  }
  if (setupData.setupComplete !== undefined) {
    updateData.notion_setup_complete = setupData.setupComplete;
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update Notion setup: ${error.message}`);
  }
}

/**
 * Update user's Amazon account ID
 * Called after successful account linking to store the Amazon user ID
 */
export async function updateUserAmazonAccountId(
  userId: string,
  amazonAccountId: string
): Promise<void> {
  console.log('[updateUserAmazonAccountId] Updating amazon_account_id:', {
    user_id: userId,
    amazon_account_id: amazonAccountId,
  });

  const { error } = await supabase
    .from('users')
    .update({
      amazon_account_id: amazonAccountId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[updateUserAmazonAccountId] Error:', error);
    throw new Error(`Failed to update Amazon account ID: ${error.message}`);
  }

  console.log('[updateUserAmazonAccountId] Successfully updated amazon_account_id');
}

export async function validateLicense(licenseKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('licenses')
    .select('status')
    .eq('license_key', licenseKey)
    .single();

  if (error || !data) {
    return false;
  }

  return data.status === 'active';
}

export async function getUserLicenseKey(amazonAccountId: string): Promise<string | null> {
  const user = await getUserByAmazonId(amazonAccountId);
  return user?.license_key || null;
}

export async function getUserByEmailAndLicense(
  email: string,
  licenseKey: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('license_key', licenseKey)
    .maybeSingle(); // Use maybeSingle() to handle "no rows found" gracefully

  if (error || !data) {
    return null;
  }

  return data as User;
}

export async function createOrUpdateUser(
  amazonAccountId: string,
  email: string,
  licenseKey: string,
  notionToken: string | null = null
): Promise<User> {
  // Check if user exists by Amazon account ID
  const existingUser = await getUserByAmazonId(amazonAccountId);
  
  if (existingUser) {
    // Update existing user
    const updateData: any = {
      email,
      license_key: licenseKey,
      updated_at: new Date().toISOString(),
    };
    
    // Only update notion_token if provided
    if (notionToken !== null) {
      updateData.notion_token = notionToken;
      // If token is being set, mark setup as incomplete (will be completed after database creation)
      updateData.notion_setup_complete = false;
    }
    
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', existingUser.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data as User;
  } else {
    // Create new user
    return await createUser(amazonAccountId, email, licenseKey, notionToken);
  }
}

