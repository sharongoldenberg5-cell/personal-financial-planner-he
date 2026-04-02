'use server';

import { prisma } from './prisma';
import { createServerSupabase } from './supabase-server';

async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

// ============ Profile ============
export async function dbSaveProfile(data: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return null;
  return prisma.profile.upsert({
    where: { userId },
    update: { ...data, userId },
    create: { ...data, userId } as any,
  });
}

export async function dbGetProfile() {
  const userId = await getUserId();
  if (!userId) return null;
  return prisma.profile.findUnique({ where: { userId } });
}

// ============ Assets ============
export async function dbGetAssets() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.asset.findMany({ where: { userId } });
}

export async function dbSaveAsset(data: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return null;
  const id = data.id as string;
  return prisma.asset.upsert({
    where: { id },
    update: { ...data, userId },
    create: { ...data, userId, id } as any,
  });
}

export async function dbDeleteAsset(id: string) {
  const userId = await getUserId();
  if (!userId) return;
  await prisma.asset.deleteMany({ where: { id, userId } });
}

// ============ Liabilities ============
export async function dbGetLiabilities() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.liability.findMany({ where: { userId } });
}

export async function dbSaveLiability(data: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return null;
  const id = data.id as string;
  return prisma.liability.upsert({
    where: { id },
    update: { ...data, userId },
    create: { ...data, userId, id } as any,
  });
}

export async function dbDeleteLiability(id: string) {
  const userId = await getUserId();
  if (!userId) return;
  await prisma.liability.deleteMany({ where: { id, userId } });
}

// ============ Goals ============
export async function dbGetGoals() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.goal.findMany({ where: { userId } });
}

export async function dbSaveGoal(data: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return null;
  const id = data.id as string;
  return prisma.goal.upsert({
    where: { id },
    update: { ...data, userId },
    create: { ...data, userId, id } as any,
  });
}

export async function dbDeleteGoal(id: string) {
  const userId = await getUserId();
  if (!userId) return;
  await prisma.goal.deleteMany({ where: { id, userId } });
}

// ============ Retirement Goals ============
export async function dbGetRetirementGoals() {
  const userId = await getUserId();
  if (!userId) return null;
  return prisma.retirementGoals.findUnique({ where: { userId } });
}

export async function dbSaveRetirementGoals(data: { pensionTarget?: number; lumpSumTarget?: number }) {
  const userId = await getUserId();
  if (!userId) return null;
  return prisma.retirementGoals.upsert({
    where: { userId },
    update: data,
    create: { ...data, userId },
  });
}

// ============ Recommendations ============
export async function dbGetRecommendations() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.recommendation.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function dbSaveRecommendations(recs: Record<string, unknown>[]) {
  const userId = await getUserId();
  if (!userId) return;
  await prisma.recommendation.deleteMany({ where: { userId } });
  if (recs.length > 0) {
    await prisma.recommendation.createMany({
      data: recs.map(r => ({ ...r, userId })) as any,
    });
  }
}

// ============ Mortgage Reports ============
export async function dbGetMortgageReports() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.mortgageReport.findMany({ where: { userId }, include: { subLoans: true } });
}

export async function dbSaveMortgageReport(data: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return null;
  const id = data.id as string;
  const subLoans = (data.subLoans || []) as Record<string, unknown>[];
  const { subLoans: _, ...reportData } = data;

  // Delete old and recreate
  await prisma.mortgageReport.deleteMany({ where: { id, userId } }).catch(() => {});
  return prisma.mortgageReport.create({
    data: {
      ...reportData,
      userId,
      id,
      subLoans: {
        create: subLoans.map(sl => {
          const { id: slId, ...rest } = sl;
          return rest;
        }) as any,
      },
    } as any,
    include: { subLoans: true },
  });
}

// ============ Mislaka Reports ============
export async function dbGetMislakaReports() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.mislakaReport.findMany({ where: { userId }, include: { products: true } });
}

export async function dbSaveMislakaReport(data: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return null;
  const id = data.id as string;
  const products = (data.products || []) as Record<string, unknown>[];
  const { products: _, ...reportData } = data;

  await prisma.mislakaReport.deleteMany({ where: { id, userId } }).catch(() => {});
  return prisma.mislakaReport.create({
    data: {
      ...reportData,
      userId,
      id,
      products: {
        create: products.map(p => {
          const { id: pId, ...rest } = p;
          return rest;
        }) as any,
      },
    } as any,
    include: { products: true },
  });
}

// ============ Bank Accounts ============
export async function dbGetBankAccounts() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.bankAccount.findMany({ where: { userId }, include: { transactions: true } });
}

export async function dbSaveBankAccount(data: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return null;
  const id = data.id as string;
  const transactions = (data.transactions || []) as Record<string, unknown>[];
  const { transactions: _, ...accountData } = data;

  await prisma.bankAccount.deleteMany({ where: { id, userId } }).catch(() => {});
  return prisma.bankAccount.create({
    data: {
      ...accountData,
      userId,
      id,
      transactions: {
        create: transactions.map(t => {
          const { id: tId, ...rest } = t;
          return rest;
        }) as any,
      },
    } as any,
    include: { transactions: true },
  });
}

// ============ Credit Cards ============
export async function dbGetCreditCards() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.creditCardStatement.findMany({ where: { userId }, include: { transactions: true } });
}

export async function dbSaveCreditCard(data: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return null;
  const id = data.id as string;
  const transactions = (data.transactions || []) as Record<string, unknown>[];
  const { transactions: _, ...cardData } = data;

  await prisma.creditCardStatement.deleteMany({ where: { id, userId } }).catch(() => {});
  return prisma.creditCardStatement.create({
    data: {
      ...cardData,
      userId,
      id,
      transactions: {
        create: transactions.map(t => {
          const { id: tId, ...rest } = t;
          return rest;
        }) as any,
      },
    } as any,
    include: { transactions: true },
  });
}

// ============ Pension Data ============
export async function dbGetPensionData() {
  const userId = await getUserId();
  if (!userId) return [];
  return prisma.pensionData.findMany({ where: { userId } });
}

// ============ Sync: Pull all data from DB ============
export async function dbPullAllData() {
  const userId = await getUserId();
  if (!userId) return null;

  const [profile, assets, liabilities, goals, retirementGoals, recommendations, mortgageReports, mislakaReports, bankAccounts, creditCards, pensionData] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.liability.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.retirementGoals.findUnique({ where: { userId } }),
    prisma.recommendation.findMany({ where: { userId } }),
    prisma.mortgageReport.findMany({ where: { userId }, include: { subLoans: true } }),
    prisma.mislakaReport.findMany({ where: { userId }, include: { products: true } }),
    prisma.bankAccount.findMany({ where: { userId }, include: { transactions: true } }),
    prisma.creditCardStatement.findMany({ where: { userId }, include: { transactions: true } }),
    prisma.pensionData.findMany({ where: { userId } }),
  ]);

  return {
    profile,
    assets,
    liabilities,
    goals,
    retirementGoals,
    recommendations,
    mortgageReports,
    mislakaReports,
    bankAccounts,
    creditCards,
    pensionData,
  };
}

// ============ Sync: Push all data to DB ============
export async function dbPushAllData(data: {
  profile?: Record<string, unknown> | null;
  assets?: Record<string, unknown>[];
  liabilities?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  retirementGoals?: { pensionTarget?: number; lumpSumTarget?: number } | null;
  recommendations?: Record<string, unknown>[];
  mortgageReports?: Record<string, unknown>[];
  mislakaReports?: Record<string, unknown>[];
  bankAccounts?: Record<string, unknown>[];
  creditCards?: Record<string, unknown>[];
}) {
  const userId = await getUserId();
  if (!userId) return false;

  try {
    if (data.profile) await dbSaveProfile(data.profile);
    if (data.assets) for (const a of data.assets) await dbSaveAsset(a);
    if (data.liabilities) for (const l of data.liabilities) await dbSaveLiability(l);
    if (data.goals) for (const g of data.goals) await dbSaveGoal(g);
    if (data.retirementGoals) await dbSaveRetirementGoals(data.retirementGoals);
    if (data.recommendations) await dbSaveRecommendations(data.recommendations);
    if (data.mortgageReports) for (const r of data.mortgageReports) await dbSaveMortgageReport(r);
    if (data.mislakaReports) for (const r of data.mislakaReports) await dbSaveMislakaReport(r);
    if (data.bankAccounts) for (const a of data.bankAccounts) await dbSaveBankAccount(a);
    if (data.creditCards) for (const c of data.creditCards) await dbSaveCreditCard(c);
    return true;
  } catch (e) {
    console.error('Push error:', e);
    return false;
  }
}
