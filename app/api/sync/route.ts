import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
    }

    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const userId = user.id;
    const body = await request.json();

    const headers = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    };

    // Save profile via Supabase REST API
    if (body.profile) {
      const { createdAt, updatedAt, id, ...profileData } = body.profile;
      await fetch(`${supabaseUrl}/rest/v1/Profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...profileData, userId }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
