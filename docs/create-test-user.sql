-- Create Test User for Alexa Skill Testing
-- Run this in Supabase SQL Editor after getting your Amazon Account ID from the simulator

-- Replace 'YOUR_AMAZON_ACCOUNT_ID_HERE' with the actual userId from Alexa Developer Console Simulator
-- Replace 'YOUR_NOTION_TOKEN_HERE' with your Notion integration token

INSERT INTO users (
  amazon_account_id,
  email,
  license_key,
  notion_token,
  notion_setup_complete,
  onboarding_complete,
  created_at,
  updated_at
) VALUES (
  'amzn1.ask.account.XXXXXXXXXXXXX',  -- Replace with actual Amazon Account ID from simulator
  'test@example.com',                  -- Your test email
  'TEST-LICENSE-KEY',                  -- Any value works since license validation is disabled
  'secret_XXXXXXXXXXXXXXXXXXXXXXXX',   -- Replace with your Notion integration token
  false,                               -- Will be set to true after setup
  false,
  NOW(),
  NOW()
)
ON CONFLICT (amazon_account_id) 
DO UPDATE SET
  email = EXCLUDED.email,
  notion_token = EXCLUDED.notion_token,  -- Update token if user exists
  updated_at = NOW();

-- To verify the user was created:
-- SELECT amazon_account_id, email, notion_token IS NOT NULL as has_token FROM users WHERE amazon_account_id = 'amzn1.ask.account.XXXXXXXXXXXXX';

