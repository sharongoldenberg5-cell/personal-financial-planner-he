'use client';

import type { AppState, UserProfile, Asset, Liability, MortgageReport, MislakaReport, RetirementGoals, BankAccount, PensionData, FinancialRecord, Goal, Recommendation, UploadedFile } from './types';

const STORAGE_KEY = 'financial-planner-data';

function getDefaultState(): AppState {
  return {
    profile: null,
    assets: [],
    liabilities: [],
    mortgageReports: [],
    mislakaReports: [],
    pensionData: [],
    bankAccounts: [],
    financialRecords: [],
    retirementGoals: null,
    goals: [],
    recommendations: [],
    uploadedFiles: [],
  };
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return getDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    return JSON.parse(raw) as AppState;
  } catch {
    return getDefaultState();
  }
}

function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Profile
export function saveProfile(profile: UserProfile): void {
  const state = loadState();
  state.profile = profile;
  saveState(state);
}

export function getProfile(): UserProfile | null {
  return loadState().profile;
}

// Assets
export function getAssets(): Asset[] {
  return loadState().assets;
}

export function saveAsset(asset: Asset): void {
  const state = loadState();
  const idx = state.assets.findIndex(a => a.id === asset.id);
  if (idx >= 0) {
    state.assets[idx] = asset;
  } else {
    state.assets.push(asset);
  }
  saveState(state);
}

export function deleteAsset(id: string): void {
  const state = loadState();
  state.assets = state.assets.filter(a => a.id !== id);
  saveState(state);
}

// Liabilities
export function getLiabilities(): Liability[] {
  return loadState().liabilities || [];
}

export function saveLiability(liability: Liability): void {
  const state = loadState();
  if (!state.liabilities) state.liabilities = [];
  // Deduplicate by name + category + currentBalance (same liability from re-upload)
  const dupeIdx = state.liabilities.findIndex(l =>
    l.name === liability.name && l.category === liability.category && l.currentBalance === liability.currentBalance
  );
  if (dupeIdx >= 0) {
    state.liabilities[dupeIdx] = { ...liability, id: state.liabilities[dupeIdx].id };
  } else {
    const idx = state.liabilities.findIndex(l => l.id === liability.id);
    if (idx >= 0) {
      state.liabilities[idx] = liability;
    } else {
      state.liabilities.push(liability);
    }
  }
  saveState(state);
}

export function deleteLiability(id: string): void {
  const state = loadState();
  state.liabilities = (state.liabilities || []).filter(l => l.id !== id);
  saveState(state);
}

export function calculateTotalLiabilities(): number {
  const state = loadState();
  return (state.liabilities || []).reduce((sum, l) => sum + l.currentBalance, 0);
}

// Mortgage Reports
export function getMortgageReports(): MortgageReport[] {
  return loadState().mortgageReports || [];
}

export function saveMortgageReport(report: MortgageReport): void {
  const state = loadState();
  if (!state.mortgageReports) state.mortgageReports = [];
  const r = { ...report, id: report.id || generateId() };
  // Deduplicate by bank + loanNumber + totalBalance (same report uploaded again)
  const dupeIdx = state.mortgageReports.findIndex(m =>
    m.bank === r.bank && m.totalBalance === r.totalBalance &&
    (m.loanNumber === r.loanNumber || m.borrowerName === r.borrowerName)
  );
  if (dupeIdx >= 0) {
    state.mortgageReports[dupeIdx] = { ...r, id: state.mortgageReports[dupeIdx].id };
  } else {
    state.mortgageReports.push(r);
  }
  saveState(state);
}

export function deleteMortgageReport(id: string): void {
  const state = loadState();
  state.mortgageReports = (state.mortgageReports || []).filter(m => m.id !== id);
  saveState(state);
}

// Mislaka Reports
export function getMislakaReports(): MislakaReport[] {
  return loadState().mislakaReports || [];
}

export function saveMislakaReport(report: MislakaReport): void {
  const state = loadState();
  if (!state.mislakaReports) state.mislakaReports = [];
  const r = { ...report, id: report.id || generateId() };
  // Deduplicate by owner ID
  const dupeIdx = state.mislakaReports.findIndex(m => m.ownerId === r.ownerId);
  if (dupeIdx >= 0) {
    state.mislakaReports[dupeIdx] = { ...r, id: state.mislakaReports[dupeIdx].id };
  } else {
    state.mislakaReports.push(r);
  }
  saveState(state);
}

export function deleteMislakaReport(id: string): void {
  const state = loadState();
  state.mislakaReports = (state.mislakaReports || []).filter(m => m.id !== id);
  saveState(state);
}

export function clearAllMislakaReports(): void {
  const state = loadState();
  state.mislakaReports = [];
  saveState(state);
}

// Pension
export function getPensionData(): PensionData[] {
  return loadState().pensionData;
}

export function savePensionData(data: PensionData): void {
  const state = loadState();
  const idx = state.pensionData.findIndex(p => p.id === data.id);
  if (idx >= 0) {
    state.pensionData[idx] = data;
  } else {
    state.pensionData.push(data);
  }
  saveState(state);
}

export function deletePensionData(id: string): void {
  const state = loadState();
  state.pensionData = state.pensionData.filter(p => p.id !== id);
  saveState(state);
}

// Financial Records
export function getFinancialRecords(): FinancialRecord[] {
  return loadState().financialRecords;
}

export function saveFinancialRecords(records: FinancialRecord[]): void {
  const state = loadState();
  state.financialRecords = [...state.financialRecords, ...records];
  saveState(state);
}

export function clearFinancialRecords(): void {
  const state = loadState();
  state.financialRecords = [];
  saveState(state);
}

// Retirement Goals
export function getRetirementGoals(): RetirementGoals | null {
  return loadState().retirementGoals || null;
}

export function saveRetirementGoals(goals: RetirementGoals): void {
  const state = loadState();
  state.retirementGoals = goals;
  saveState(state);
}

// Goals
export function getGoals(): Goal[] {
  return loadState().goals;
}

export function saveGoal(goal: Goal): void {
  const state = loadState();
  const idx = state.goals.findIndex(g => g.id === goal.id);
  if (idx >= 0) {
    state.goals[idx] = goal;
  } else {
    state.goals.push(goal);
  }
  saveState(state);
}

export function deleteGoal(id: string): void {
  const state = loadState();
  state.goals = state.goals.filter(g => g.id !== id);
  saveState(state);
}

// Recommendations
export function getRecommendations(): Recommendation[] {
  return loadState().recommendations;
}

export function saveRecommendations(recs: Recommendation[]): void {
  const state = loadState();
  state.recommendations = recs;
  saveState(state);
}

// Uploaded Files
export function getUploadedFiles(): UploadedFile[] {
  return loadState().uploadedFiles;
}

export function saveUploadedFile(file: UploadedFile): void {
  const state = loadState();
  state.uploadedFiles.push(file);
  saveState(state);
}

// Bank Accounts
export function getBankAccounts(): BankAccount[] {
  return loadState().bankAccounts || [];
}

export function saveBankAccount(account: BankAccount): void {
  const state = loadState();
  if (!state.bankAccounts) state.bankAccounts = [];
  const dupeIdx = state.bankAccounts.findIndex(a => a.accountNumber === account.accountNumber && a.period === account.period);
  if (dupeIdx >= 0) {
    state.bankAccounts[dupeIdx] = account;
  } else {
    state.bankAccounts.push(account);
  }
  saveState(state);
}

export function clearAllBankAccounts(): void {
  const state = loadState();
  state.bankAccounts = [];
  saveState(state);
}

// Clear all functions
export function clearAllAssets(): void { const s = loadState(); s.assets = []; saveState(s); }
export function clearAllLiabilities(): void { const s = loadState(); s.liabilities = []; saveState(s); }
export function clearAllMortgageReports(): void { const s = loadState(); s.mortgageReports = []; saveState(s); }
export function clearAllGoals(): void { const s = loadState(); s.goals = []; saveState(s); }
export function clearAllRecommendations(): void { const s = loadState(); s.recommendations = []; saveState(s); }
export function clearProfile(): void { const s = loadState(); s.profile = null; saveState(s); }
export function clearAllUploadedFiles(): void { const s = loadState(); s.uploadedFiles = []; s.financialRecords = []; saveState(s); }

// Total net worth
export function calculateNetWorth(): number {
  const state = loadState();
  const assetsTotal = state.assets.reduce((sum, a) => sum + a.value, 0);
  const pensionTotal = state.pensionData.reduce((sum, p) => sum + p.currentBalance, 0);
  const liabilitiesTotal = (state.liabilities || []).reduce((sum, l) => sum + l.currentBalance, 0);
  return assetsTotal + pensionTotal - liabilitiesTotal;
}
