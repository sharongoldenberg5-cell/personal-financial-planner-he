'use server';

import { prisma } from './prisma';

export async function dbGetAllUsers() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Get auth users via Supabase Admin API
  let authUsers: any[] = [];
  if (serviceKey && supabaseUrl) {
    try {
      const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        cache: 'no-store',
      });
      if (resp.ok) {
        const data = await resp.json();
        authUsers = data.users || [];
      }
    } catch {}
  }

  // Get profiles
  const profiles = await prisma.profile.findMany();
  const profileMap = new Map(profiles.map(p => [p.userId, p]));

  // If no auth users found, fall back to profiles
  if (authUsers.length === 0) {
    return profiles.map(p => ({
      userId: p.userId,
      email: '',
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      createdAt: p.createdAt.toISOString(),
      lastSignIn: null,
      hasProfile: true,
    }));
  }

  return authUsers.map((u: any) => {
    const profile = profileMap.get(u.id);
    return {
      userId: u.id,
      email: u.email || '',
      firstName: profile?.firstName || null,
      lastName: profile?.lastName || null,
      age: profile?.age || null,
      monthlyIncome: profile?.monthlyIncome || null,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
      hasProfile: !!profile,
    };
  });
}

export async function dbGetUserDetail(userId: string) {
  const [profile, assets, liabilities, goals, retirementGoals, bankAccounts, creditCards, mortgageReports, mislakaReports, recommendations] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.liability.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.retirementGoals.findUnique({ where: { userId } }),
    prisma.bankAccount.findMany({ where: { userId }, include: { transactions: true } }),
    prisma.creditCardStatement.findMany({ where: { userId }, include: { transactions: true } }),
    prisma.mortgageReport.findMany({ where: { userId }, include: { subLoans: true } }),
    prisma.mislakaReport.findMany({ where: { userId }, include: { products: true } }),
    prisma.recommendation.findMany({ where: { userId } }),
  ]);

  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.currentBalance, 0);

  return {
    profile,
    assets,
    liabilities,
    goals,
    retirementGoals,
    bankAccounts,
    creditCards,
    mortgageReports,
    mislakaReports,
    recommendations,
    summary: {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    },
  };
}
