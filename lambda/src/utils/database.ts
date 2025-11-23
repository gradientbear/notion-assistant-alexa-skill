import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, License } from '../types';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export async function getUserByAmazonId(amazonAccountId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('amazon_account_id', amazonAccountId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

export async function createUser(
  amazonAccountId: string,
  email: string,
  licenseKey: string
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      amazon_account_id: amazonAccountId,
      email,
      license_key: licenseKey,
      notion_token: null,
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

