'use server';

import { prisma } from './prisma';

// ============ Leads ============
export async function dbGetLeads() {
  return prisma.quizLead.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function dbSaveLead(data: Record<string, unknown>) {
  const id = data.id as string;
  return prisma.quizLead.upsert({
    where: { id },
    update: data as any,
    create: { ...data, id } as any,
  });
}

export async function dbUpdateLead(id: string, updates: Record<string, unknown>) {
  return prisma.quizLead.update({ where: { id }, data: updates as any });
}

export async function dbDeleteLead(id: string) {
  return prisma.quizLead.delete({ where: { id } });
}

// ============ Advisors ============
export async function dbGetAdvisors() {
  return prisma.advisor.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function dbSaveAdvisor(data: Record<string, unknown>) {
  const id = data.id as string;
  return prisma.advisor.upsert({
    where: { id },
    update: data as any,
    create: { ...data, id } as any,
  });
}

export async function dbDeleteAdvisor(id: string) {
  return prisma.advisor.delete({ where: { id } });
}

// ============ Stats ============
export async function dbGetLeadStats() {
  const leads = await prisma.quizLead.findMany();
  const advisorCount = await prisma.advisor.count();

  const total = leads.length;
  const hot = leads.filter(l => (l.heatScore || 0) >= 65).length;
  const warm = leads.filter(l => (l.heatScore || 0) >= 40 && (l.heatScore || 0) < 65).length;
  const cold = leads.filter(l => (l.heatScore || 0) < 40).length;
  const assigned = leads.filter(l => l.assignedTo).length;
  const unassigned = total - assigned;
  const red = leads.filter(l => (l.score || 0) < 45).length;
  const yellow = leads.filter(l => (l.score || 0) >= 45 && (l.score || 0) < 70).length;
  const green = leads.filter(l => (l.score || 0) >= 70).length;

  const perDay: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    perDay[d.toISOString().split('T')[0]] = 0;
  }
  for (const lead of leads) {
    const day = lead.createdAt?.toISOString().split('T')[0];
    if (day && perDay[day] !== undefined) perDay[day]++;
  }

  return { total, hot, warm, cold, assigned, unassigned, red, yellow, green, perDay, advisorCount };
}
