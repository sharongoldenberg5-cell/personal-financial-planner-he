import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
    }

    // Get auth users
    const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Supabase API error', status: resp.status }, { status: 500 });
    }

    const data = await resp.json();
    const authUsers = data.users || [];

    // Get profiles from DB
    const prisma = new PrismaClient();
    const profiles = await prisma.profile.findMany();
    await prisma.$disconnect();

    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    const users = authUsers.map((u: any) => {
      const profile = profileMap.get(u.id);
      return {
        userId: u.id,
        email: u.email || '',
        firstName: profile?.firstName || u.user_metadata?.full_name || null,
        lastName: profile?.lastName || null,
        age: profile?.age || null,
        monthlyIncome: profile?.monthlyIncome || null,
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at,
        hasProfile: !!profile,
      };
    });

    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
