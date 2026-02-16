import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, License } from '../types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  const error = new Error('Missing Supabase environment variables');
  console.error('[Database] Error:', error.message);
  throw error;
}

// Configure Supabase client with timeout for Lambda environment
// Note: Supabase client uses default fetch which should work, but we handle timeouts in queries
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
});

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors (not found, validation errors)
      if (error?.code === 'PGRST116' || error?.code === '23505') {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break;
      }
      
      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, {
        error: error?.message || error,
        attempt: attempt + 1,
        maxRetries
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Get user by Supabase Auth user ID (OAuth2 flow)
 * This is the primary method for OAuth2 users
 * Note: users.id now matches Supabase Auth user id directly
 * Includes retry logic with exponential backoff for transient failures
 */
export async function getUserByAuthUserId(authUserId: string): Promise<User | null> {
  try {
    return await retryWithBackoff(async () => {
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: { code: string } }>((resolve) => {
        setTimeout(() => {
          resolve({ data: null, error: { code: 'TIMEOUT' } });
        }, 5000); // 5 second timeout
      });

      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data, error } = result as any;

      if (error) {
        if (error.code === 'TIMEOUT') {
          throw new Error('Query timeout');
        }
        if (error.code !== 'PGRST116') {
          console.error('[getUserByAuthUserId] Supabase error:', error);
          throw error;
        }
        return null;
      }

      if (!data) {
        return null;
      }

      return data as User;
    }, 3, 100);
  } catch (err: any) {
    // Only log if it's not a "not found" error
    if (err?.code !== 'PGRST116' && err?.message !== 'Query timeout') {
      console.error('[getUserByAuthUserId] Error after retries:', {
        message: err?.message,
        stack: err?.stack,
        code: err?.code
      });
    }
    return null;
  }
}

/**
 * Get user by Amazon account ID (Legacy fallback)
 * Only used for backward compatibility with old users who haven't migrated to OAuth2
 */
export async function getUserByAmazonId(amazonAccountId: string): Promise<User | null> {
  try {
    // Try direct REST API call as fallback if Supabase client hangs
    // This bypasses the Supabase JS client which might have connection issues
    const directQuery = async () => {
      try {
        const queryUrl = `${supabaseUrl}/rest/v1/users?amazon_account_id=eq.${encodeURIComponent(amazonAccountId)}&select=*`;
        
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
      result = await directQuery();
    } catch (directError: any) {
      // Fallback to Supabase client if direct API fails
      try {
        const queryPromise = supabase
          .from('users')
          .select('*')
          .eq('amazon_account_id', amazonAccountId)
          .maybeSingle();

        const timeoutPromise = new Promise<{ data: null; error: { code: string; message: string } }>((resolve) => {
          setTimeout(() => {
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
    
    const { data, error } = result as any;

    if (error) {
      // Only log non-PGRST116 errors (PGRST116 is "no rows found" which is expected)
      if (error.code !== 'PGRST116' && error.code !== 'TIMEOUT') {
        console.error('[getUserByAmazonId] Supabase error:', JSON.stringify(error, null, 2));
      }
      return null;
    }

    if (!data) {
      return null;
    }

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
}

export async function validateLicense(licenseKey: string): Promise<boolean> {
  // licenseKey stores stripe_payment_intent_id for Stripe payments
  // Query by stripe_payment_intent_id (primary key) for better performance and consistency
  const { data, error } = await supabase
    .from('licenses')
    .select('status')
    .eq('stripe_payment_intent_id', licenseKey)
    .maybeSingle();

  // Fallback to license_key for backward compatibility with legacy licenses
  if (error || !data) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('licenses')
      .select('status')
      .eq('license_key', licenseKey)
      .maybeSingle();

    if (fallbackError || !fallbackData) {
      return false;
    }

    return fallbackData.status === 'active';
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

