'use server';

import { prisma } from './prisma';

export async function dbGetAllUsers() {
  // Get all profiles with summary data
  const profiles = await prisma.profile.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // For each user, get counts
  const userSummaries = await Promise.all(
    profiles.map(async (p) => {
      const [assetCount, liabilityCount, goalCount, bankAccountCount, creditCardCount, mortgageCount, mislakaCount] = await Promise.all([
        prisma.asset.count({ where: { userId: p.userId } }),
        prisma.liability.count({ where: { userId: p.userId } }),
        prisma.goal.count({ where: { userId: p.userId } }),
        prisma.bankAccount.count({ where: { userId: p.userId } }),
        prisma.creditCardStatement.count({ where: { userId: p.userId } }),
        prisma.mortgageReport.count({ where: { userId: p.userId } }),
        prisma.mislakaReport.count({ where: { userId: p.userId } }),
      ]);

      return {
        userId: p.userId,
        firstName: p.firstName,
        lastName: p.lastName,
        age: p.age,
        maritalStatus: p.maritalStatus,
        monthlyIncome: p.monthlyIncome,
        monthlyExpenses: p.monthlyExpenses,
        createdAt: p.createdAt,
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
