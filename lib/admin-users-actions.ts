'use server';

import { prisma } from './prisma';

export async function dbGetAllUsers() {
  // Get all users from auth.users table (via raw query since Prisma doesn't manage auth schema)
  const { PrismaClient } = require('@prisma/client');
  const rawClient = new PrismaClient();

  // Get profiles
  const profiles = await prisma.profile.findMany();
  const profileMap = new Map(profiles.map(p => [p.userId, p]));

  // Get auth users via raw SQL
  let authUsers: { id: string; email: string; created_at: Date; last_sign_in_at: Date | null }[] = [];
  try {
    authUsers = await rawClient.$queryRaw`SELECT id, email, created_at, last_sign_in_at FROM auth.users ORDER BY created_at DESC`;
  } catch {
    // Fallback: use profiles only
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
