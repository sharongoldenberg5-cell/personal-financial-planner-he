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
    const errors: string[] = [];

    const headers = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };

    // Save profile - first try to update, if not found then insert
    if (body.profile) {
      const { createdAt, updatedAt, id, ...profileData } = body.profile;
      const payload = { ...profileData, userId };

      // Try PATCH (update existing)
      const patchResp = await fetch(`${supabaseUrl}/rest/v1/Profile?userId=eq.${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });

      // If no rows updated, INSERT
      if (patchResp.status === 200 || patchResp.status === 204) {
        // Check if it actually updated something by trying to GET
        const getResp = await fetch(`${supabaseUrl}/rest/v1/Profile?userId=eq.${userId}&select=userId`, {
          headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
        });
        const existing = await getResp.json();
        if (!existing || existing.length === 0) {
          // Insert new
          const insertResp = await fetch(`${supabaseUrl}/rest/v1/Profile`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          if (!insertResp.ok) {
            const err = await insertResp.text();
            errors.push('Profile insert: ' + err);
          }
        }
      } else {
        const err = await patchResp.text();
        errors.push('Profile patch: ' + err);
      }
    }

    return NextResponse.json({ ok: true, errors: errors.length > 0 ? errors : undefined });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
