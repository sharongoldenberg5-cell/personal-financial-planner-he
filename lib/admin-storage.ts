'use client';

import { dbSaveLead, dbUpdateLead, dbDeleteLead as dbRemoveLead, dbSaveAdvisor, dbDeleteAdvisor as dbRemoveAdvisor } from './admin-db-actions';

// Background sync to DB
function syncToDb(fn: () => Promise<unknown>) {
  fn().catch(e => console.warn('[Admin DB Sync]', e));
}

// ===== TYPES =====
export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferredTime: string;
  score: number;
  percentScore: number;
  heatScore: number;
  heatPercent: number;
  status: string;
  recommendations: string[];
  proType: string;
  answers: Record<string, number>;
  assignedTo?: string;
  assignedAt?: string;
  notes?: string;
  timestamp: string;
}

export interface Advisor {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  license: string;
  specialty: ('mortgage' | 'pension' | 'financial')[];
  rating: number;
  active: boolean;
  notes: string;
  createdAt: string;
}

// ===== LEADS =====
export function getLeads(): Lead[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('quiz-leads') || '[]');
}

export function updateLead(id: string, updates: Partial<Lead>): void {
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === id);
  if (idx >= 0) {
    leads[idx] = { ...leads[idx], ...updates };
    localStorage.setItem('quiz-leads', JSON.stringify(leads));
    syncToDb(() => dbUpdateLead(id, updates as any));
  }
}

export function deleteLead(id: string): void {
  const leads = getLeads().filter(l => l.id !== id);
  localStorage.setItem('quiz-leads', JSON.stringify(leads));
  syncToDb(() => dbRemoveLead(id));
}

export function saveLead(lead: Lead): void {
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === lead.id);
  if (idx >= 0) { leads[idx] = lead; } else { leads.push(lead); }
  localStorage.setItem('quiz-leads', JSON.stringify(leads));
  syncToDb(() => dbSaveLead({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    score: lead.percentScore,
    heatScore: lead.heatPercent,
    proType: lead.proType,
    answers: lead.answers,
    assignedTo: lead.assignedTo,
    status: lead.status,
  }));
}

export function getLeadHeatLevel(heatPercent: number): 'hot' | 'warm' | 'cold' {
  if (heatPercent >= 65) return 'hot';
  if (heatPercent >= 40) return 'warm';
  return 'cold';
}

// ===== ADVISORS =====
export function getAdvisors(): Advisor[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('advisors') || '[]');
}

export function saveAdvisor(advisor: Advisor): void {
  const advisors = getAdvisors();
  const idx = advisors.findIndex(a => a.id === advisor.id);
  if (idx >= 0) { advisors[idx] = advisor; } else { advisors.push(advisor); }
  localStorage.setItem('advisors', JSON.stringify(advisors));
  syncToDb(() => dbSaveAdvisor({
    id: advisor.id,
    name: advisor.name,
    company: advisor.company,
    phone: advisor.phone,
    email: advisor.email,
    license: advisor.license,
    specialty: advisor.specialty?.join(','),
    rating: advisor.rating,
    active: advisor.active,
  }));
}

export function deleteAdvisor(id: string): void {
  const advisors = getAdvisors().filter(a => a.id !== id);
  localStorage.setItem('advisors', JSON.stringify(advisors));
  syncToDb(() => dbRemoveAdvisor(id));
}

// ===== STATS =====
export function getLeadStats() {
  const leads = getLeads();
  const advisors = getAdvisors();
  const total = leads.length;
  const hot = leads.filter(l => getLeadHeatLevel(l.heatPercent) === 'hot').length;
  const warm = leads.filter(l => getLeadHeatLevel(l.heatPercent) === 'warm').length;
  const cold = leads.filter(l => getLeadHeatLevel(l.heatPercent) === 'cold').length;
  const assigned = leads.filter(l => l.assignedTo).length;
  const unassigned = total - assigned;
  const red = leads.filter(l => l.percentScore < 45).length;
  const yellow = leads.filter(l => l.percentScore >= 45 && l.percentScore < 70).length;
  const green = leads.filter(l => l.percentScore >= 70).length;

  const perDay: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    perDay[d.toISOString().split('T')[0]] = 0;
  }
  for (const lead of leads) {
    const day = lead.timestamp?.split('T')[0];
    if (day && perDay[day] !== undefined) perDay[day]++;
  }

  return { total, hot, warm, cold, assigned, unassigned, red, yellow, green, perDay, advisorCount: advisors.length };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
