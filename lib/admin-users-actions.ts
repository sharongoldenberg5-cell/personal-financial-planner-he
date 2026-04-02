'use server';

import { prisma } from './prisma';

export async function dbGetAllUsers() {
  // Get all users from auth.users table (via raw query since Prisma doesn't manage auth schema)
  const { PrismaClient } = require('@prisma/client');
  const rawClient = new PrismaClient();

  // Get profiles
  const profiles = await prisma.profile.findMany();
  const profileMap = new Map(profiles.map(p => [p.userId, p]));

  // Get auth users via Supabase Admin API
  let authUsers: { id: string; email: string; created_at: string; last_sign_in_at: string | null }[] = [];
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey! },
    });
    if (resp.ok) {
      const data = await resp.json();
      authUsers = (data.users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }));
    }
  } catch (e) {
    console.error('Failed to fetch auth users:', e);
  }
  await rawClient.$disconnect();

  // Build user list from auth users (includes those without profile)
  const userIds = authUsers.length > 0
    ? authUsers.map(u => u.id)
    : profiles.map(p => p.userId);

  const userSummaries = await Promise.all(
    (authUsers.length > 0 ? authUsers : profiles.map(p => ({ id: p.userId, email: '', created_at: p.createdAt, last_sign_in_at: null }))).map(async (authUser) => {
      const profile = profileMap.get(authUser.id);

      const [assetCount, liabilityCount, goalCount, bankAccountCount, creditCardCount, mortgageCount, mislakaCount] = await Promise.all([
        prisma.asset.count({ where: { userId: authUser.id } }),
        prisma.liability.count({ where: { userId: authUser.id } }),
        prisma.goal.count({ where: { userId: authUser.id } }),
        prisma.bankAccount.count({ where: { userId: authUser.id } }),
        prisma.creditCardStatement.count({ where: { userId: authUser.id } }),
        prisma.mortgageReport.count({ where: { userId: authUser.id } }),
        prisma.mislakaReport.count({ where: { userId: authUser.id } }),
      ]);

      return {
        userId: authUser.id,
        email: authUser.email,
        firstName: profile?.firstName || null,
        lastName: profile?.lastName || null,
        age: profile?.age || null,
        maritalStatus: profile?.maritalStatus || null,
        monthlyIncome: profile?.monthlyIncome || null,
        monthlyExpenses: profile?.monthlyExpenses || null,
        createdAt: authUser.created_at,
        lastSignIn: authUser.last_sign_in_at,
        hasProfile: !!profile,
        assetCount,
        liabilityCount,
        goalCount,
        bankAccountCount,
        creditCardCount,
        mortgageCount,
        mislakaCount,
      };
    })
  );

  return userSummaries;
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
