import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: 'env' }, { status: 500 });
    }

    // Auth check
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });

    const userId = user.id;
    const body = await request.json();

    if (body.profile) {
      const p = body.profile;
      // Use Supabase client with service key for DB operations
      const { createClient } = await import('@supabase/supabase-js');
      const adminClient = createClient(supabaseUrl, serviceKey);

      // Delete existing profile first, then insert
      await adminClient.from('Profile').delete().eq('userId', userId);
      const now = new Date().toISOString();
      const { error } = await adminClient.from('Profile').insert({
        id: crypto.randomUUID(),
        userId,
        firstName: p.firstName || null,
        lastName: p.lastName || null,
        idNumber: p.idNumber || null,
        gender: p.gender || null,
        age: p.age || null,
        maritalStatus: p.maritalStatus || null,
        numberOfChildren: p.numberOfChildren || null,
        childrenAges: p.childrenAges || [],
        employmentStatus: p.employmentStatus || null,
        occupation: p.occupation || null,
        monthlyIncomeGross: p.monthlyIncomeGross || null,
        monthlyIncome: p.monthlyIncome || null,
        monthlyExpenses: p.monthlyExpenses || null,
        spouseFirstName: p.spouseFirstName || null,
        spouseAge: p.spouseAge || null,
        spouseEmploymentStatus: p.spouseEmploymentStatus || null,
        spouseMonthlyIncomeGross: p.spouseMonthlyIncomeGross || null,
        spouseMonthlyIncomeNet: p.spouseMonthlyIncomeNet || null,
        spouseRetirementAge: p.spouseRetirementAge || null,
        retirementAge: p.retirementAge || 67,
        createdAt: now,
        updatedAt: now,
      });

      if (error) {
        return NextResponse.json({ error: 'insert: ' + error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'sync endpoint ready' });
}
