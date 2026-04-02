import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
    }

    const headers = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    };

    // Fetch all user data in parallel
    const [profileRes, assetsRes, liabilitiesRes, goalsRes, recommendationsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/Profile?userId=eq.${userId}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/Asset?userId=eq.${userId}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/Liability?userId=eq.${userId}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/Goal?userId=eq.${userId}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/Recommendation?userId=eq.${userId}&select=*`, { headers }),
    ]);

    const profile = (await profileRes.json())?.[0] || null;
    const assets = await assetsRes.json() || [];
    const liabilities = await liabilitiesRes.json() || [];
    const goals = await goalsRes.json() || [];
    const recommendations = await recommendationsRes.json() || [];

    const totalAssets = (assets as any[]).reduce((s: number, a: any) => s + (a.value || 0), 0);
    const totalLiabilities = (liabilities as any[]).reduce((s: number, l: any) => s + (l.currentBalance || 0), 0);

    return NextResponse.json({
      profile,
      assets,
      liabilities,
      goals,
      recommendations,
      summary: {
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets - totalLiabilities,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
