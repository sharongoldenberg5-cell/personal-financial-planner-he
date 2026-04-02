import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Missing env vars', hasUrl: !!supabaseUrl, hasKey: !!serviceKey }, { status: 500 });
    }

    const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: 'Supabase error', status: resp.status, body: text.substring(0, 200) }, { status: 500 });
    }

    const data = await resp.json();
    const users = (data.users || []).map((u: any) => ({
      userId: u.id,
      email: u.email || '',
      firstName: u.user_metadata?.full_name || null,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
    }));

    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
