#!/usr/bin/env node

/**
 * Migration Script: Convert Legacy OAuth Tokens to JWT Access Tokens
 * 
 * This script:
 * 1. Reads oauth_sessions table
 * 2. For valid sessions with amazon_account_id, generates JWT tokens
 * 3. Inserts tokens into oauth_access_tokens table
 * 4. Logs results and provides preview mode
 * 
 * Usage:
 *   node scripts/migrate_legacy_tokens.js --preview
 *   node scripts/migrate_legacy_tokens.js --apply
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);
const APP_ISS = process.env.APP_ISS || 'https://notion-data-user.vercel.app';
const ALEXA_CLIENT_ID = process.env.ALEXA_OAUTH_CLIENT_ID || 'alexa';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('❌ Missing JWT_SECRET');
  console.error('Please set JWT_SECRET environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Generate JWT access token
 */
function generateJWT(userId, email, notionDbId, amazonAccountId) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: APP_ISS,
    sub: userId,
    email: email,
    iat: now,
    exp: now + JWT_EXPIRES_IN,
    scope: 'alexa',
    notion_db_id: notionDbId,
    amazon_account_id: amazonAccountId,
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Main migration function
 */
async function migrateTokens(preview = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Migration Mode: ${preview ? 'PREVIEW' : 'APPLY'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all active oauth_sessions with amazon_account_id
  const { data: sessions, error: sessionsError } = await supabase
    .from('oauth_sessions')
    .select('*')
    .not('amazon_account_id', 'is', null)
    .gt('expires_at', new Date().toISOString());

  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError);
    process.exit(1);
  }

  console.log(`Found ${sessions.length} active OAuth sessions with amazon_account_id\n`);

  const results = {
    processed: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  for (const session of sessions) {
    results.processed++;

    try {
      // Find user by amazon_account_id
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('amazon_account_id', session.amazon_account_id)
        .single();

      if (userError || !user) {
        console.log(`⚠️  Session ${session.id}: User not found for amazon_account_id: ${session.amazon_account_id}`);
        results.skipped++;
        results.details.push({
          session_id: session.id,
          status: 'skipped',
          reason: 'User not found',
        });
        continue;
      }

      // Check if user already has an active token
      const { data: existingToken } = await supabase
        .from('oauth_access_tokens')
        .select('token')
        .eq('user_id', user.id)
        .eq('revoked', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();

      if (existingToken) {
        console.log(`ℹ️  User ${user.email} already has an active token, skipping`);
        results.skipped++;
        results.details.push({
          session_id: session.id,
          user_email: user.email,
          status: 'skipped',
          reason: 'Active token exists',
        });
        continue;
      }

      // Generate JWT token
      const accessToken = generateJWT(
        user.auth_user_id || user.id,
        user.email,
        user.tasks_db_id,
        user.amazon_account_id
      );

      const expiresAt = new Date(Date.now() + JWT_EXPIRES_IN * 1000);

      if (preview) {
        console.log(`📋 Would migrate:`);
        console.log(`   Session ID: ${session.id}`);
        console.log(`   User: ${user.email}`);
        console.log(`   Amazon Account ID: ${session.amazon_account_id}`);
        console.log(`   Token expires: ${expiresAt.toISOString()}`);
        console.log('');
        results.details.push({
          session_id: session.id,
          user_email: user.email,
          status: 'preview',
          expires_at: expiresAt.toISOString(),
        });
      } else {
        // Insert token
        const { error: insertError } = await supabase
          .from('oauth_access_tokens')
          .insert({
            token: accessToken,
            user_id: user.id,
            client_id: ALEXA_CLIENT_ID,
            scope: 'alexa',
            expires_at: expiresAt.toISOString(),
            revoked: false,
          });

        if (insertError) {
          console.error(`❌ Error inserting token for ${user.email}:`, insertError);
          results.errors++;
          results.details.push({
            session_id: session.id,
            user_email: user.email,
            status: 'error',
            error: insertError.message,
          });
        } else {
          console.log(`✅ Migrated token for ${user.email}`);
          results.migrated++;
          results.details.push({
            session_id: session.id,
            user_email: user.email,
            status: 'migrated',
            expires_at: expiresAt.toISOString(),
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error processing session ${session.id}:`, error.message);
      results.errors++;
      results.details.push({
        session_id: session.id,
        status: 'error',
        error: error.message,
      });
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Migration Summary:');
  console.log(`${'='.repeat(60)}`);
  console.log(`Processed: ${results.processed}`);
  console.log(`Migrated: ${results.migrated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors}`);
  console.log(`${'='.repeat(60)}\n`);

  if (preview) {
    console.log('💡 This was a preview. Run with --apply to actually migrate tokens.\n');
  } else {
    console.log('✅ Migration complete!\n');
    console.log('📧 Next steps:');
    console.log('   1. Notify users to re-link their Alexa account (recommended)');
    console.log('   2. Keep legacy token support enabled for 30 days');
    console.log('   3. After transition period, disable legacy support\n');
  }

  return results;
}

// Main execution
const args = process.argv.slice(2);
const preview = !args.includes('--apply');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node scripts/migrate_legacy_tokens.js [options]

Options:
  --preview    Preview migration without applying (default)
  --apply      Actually perform the migration
  --help, -h   Show this help message

Environment Variables Required:
  - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
  - SUPABASE_SERVICE_KEY
  - JWT_SECRET
  - JWT_EXPIRES_IN (optional, default: 3600)
  - APP_ISS (optional, default: https://notion-data-user.vercel.app)
  - ALEXA_OAUTH_CLIENT_ID (optional, default: alexa)
  `);
  process.exit(0);
}

migrateTokens(preview)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

