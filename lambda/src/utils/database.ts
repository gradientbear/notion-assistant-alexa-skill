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

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
console.log('[Database] Supabase client created successfully');

export async function getUserByAmazonId(amazonAccountId: string): Promise<User | null> {
  console.log('[getUserByAmazonId] Looking up user with amazon_account_id:', amazonAccountId);
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('amazon_account_id', amazonAccountId)
    .maybeSingle(); // Use maybeSingle() to handle "no rows found" gracefully

  if (error) {
    // Only log non-PGRST116 errors (PGRST116 is "no rows found" which is expected)
    if (error.code !== 'PGRST116') {
      console.error('[getUserByAmazonId] Supabase error:', error);
    } else {
      console.log('[getUserByAmazonId] No user found (expected for new users)');
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
    focusLogsDbId?: string | null;
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
  if (setupData.focusLogsDbId !== undefined) {
    updateData.focus_logs_db_id = setupData.focusLogsDbId;
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

