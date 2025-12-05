import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    // Client-side: show user-friendly error
    console.error('❌ Missing Supabase configuration!')
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.')
  }
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'For local development, create a .env.local file. ' +
    'For production (Vercel), add them in your project settings.'
  )
}

// Validate URL format - should be https://[project-ref].supabase.co
if (supabaseUrl.includes('supabase.com/dashboard') || supabaseUrl.includes('dashboard/project')) {
  const errorMsg = `❌ Invalid Supabase URL format!
  
Your NEXT_PUBLIC_SUPABASE_URL is set to: ${supabaseUrl}

This looks like a dashboard URL. It should be the API URL instead.

Correct format: https://[project-ref].supabase.co
Example: https://ptasyynqqlvrbhqmtvhl.supabase.co

To fix:
1. Go to Supabase Dashboard → Settings → API
2. Copy the "Project URL" (not the dashboard URL)
3. Update NEXT_PUBLIC_SUPABASE_URL in Vercel
4. Redeploy your application`

  if (typeof window !== 'undefined') {
    console.error(errorMsg)
    alert('Configuration Error: Supabase URL is incorrect. Check console for details.')
  }
  throw new Error(errorMsg)
}

// Client-side Supabase client (no custom fetch override to avoid breaking Supabase's internal logic)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
})

// Server-side client for admin operations
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || ''
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  
  if (!serviceKey || !url) {
    throw new Error('Missing SUPABASE_SERVICE_KEY or NEXT_PUBLIC_SUPABASE_URL')
  }
  
  // Server-side client (no custom fetch override to avoid breaking Supabase's internal logic)
  // Cache control is handled at the API route level via response headers
  return createClient(url, serviceKey, {
    db: {
      schema: 'public',
    },
  })
}

