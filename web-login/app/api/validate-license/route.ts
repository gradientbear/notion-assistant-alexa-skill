import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Check environment variables at runtime, not module load time
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase environment variables' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, licenseKey } = await request.json();

    if (!email || !licenseKey) {
      return NextResponse.json(
        { error: 'Email and license key are required' },
        { status: 400 }
      );
    }

    // Validate license key
    const { data: license, error: licenseError } = await supabase
      .from('licenses')
      .select('status')
      .eq('license_key', licenseKey)
      .single();

    if (licenseError || !license || license.status !== 'active') {
      return NextResponse.json(
        { error: 'Invalid or inactive license key' },
        { status: 401 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error: any) {
    console.error('License validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

