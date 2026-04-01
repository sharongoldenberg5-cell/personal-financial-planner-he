export type Locale = 'he' | 'en';

export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type EmploymentStatus = 'employed' | 'self-employed' | 'controlling-shareholder' | 'unemployed' | 'retired' | 'student';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: Gender;
  maritalStatus: MaritalStatus;
  numberOfChildren: number;
  childrenAges: number[];
  employmentStatus: EmploymentStatus;
  occupation: string;
  monthlyIncomeGross: number;
  monthlyIncome: number; // net
  monthlyExpenses: number;
  retirementAge: number;
  // Spouse details
  spouseFirstName: string;
  spouseLastName: string;
  spouseAge: number;
  spouseGender: Gender;
  spouseOccupation: string;
  spouseEmploymentStatus: EmploymentStatus;
  spouseMonthlyIncomeGross: number;
  spouseMonthlyIncomeNet: number;
  spouseRetirementAge: number;
  createdAt: string;
  updatedAt: string;
}

export type AssetCategory =
  | 'real-estate'
  | 'vehicle'
  | 'bank-account'
  | 'savings'
  | 'investment'
  | 'pension'
  | 'provident-fund'
  | 'insurance'
  | 'other';

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  value: number;
  currency: string;
  monthlyContribution?: number;
  interestRate?: number;
  linkedGoalId?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PensionData {
  id: string;
  provider: string;
  type: 'pension' | 'provident' | 'education-fund' | 'managers-insurance';
  currentBalance: number;
  monthlyEmployeeContribution: number;
  monthlyEmployerContribution: number;
  managementFeePercent: number;
  investmentTrack: string;
  notes: string;
  createdAt: string;
}

export interface FinancialRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  source: string;
}

export type LiabilityCategory = 'mortgage' | 'loan' | 'credit-card' | 'other';

export interface Liability {
  id: string;
  name: string;
  category: LiabilityCategory;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  lender: string;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MortgageSubLoan {
  subLoanNumber: string;
  loanNumber: string;
  originalAmount: number;
  currentBalance: number;
  principalBalance: number;
  interestBalance: number;
  interestRate: number;
  interestType: string;
  monthlyPayment: number;
  repaymentMethod: string;
  startDate: string;
  endDate: string;
  purpose: string;
}

export interface MortgageReport {
  id?: string;
  borrowerName: string;
  reportDate: string;
  loanNumber: string;
  totalBalance: number;
  totalPrincipal: number;
  totalInterest: number;
  subLoans: MortgageSubLoan[];
  bank: string;
}

// Mislaka (clearing house) product types
export type MislakaProductType = 'pension' | 'provident' | 'education-fund' | 'managers-insurance' | 'investment-provident';

export interface MislakaProduct {
  id: string;
  owner: string; // 'client' or 'spouse'
  productType: MislakaProductType;
  providerName: string; // שם יצרן
  planName: string; // שם תוכנית
  policyNumber: string;
  status: string; // פעיל/לא פעיל
  totalBalance: number; // צבירה מצטברת
  redemptionValue: number; // ערך פדיון
  monthlyPensionEstimate: number; // קצבה חודשית צפויה
  projectedRetirementBalance: number; // סכום הוני צפוי לגיל פרישה
  employeeContributionPct: number;
  employerContributionPct: number;
  severanceContributionPct: number;
  managementFeeDeposit: number; // דמי ניהול הפקדה %
  managementFeeBalance: number; // דמי ניהול צבירה %
  investmentTrack: string; // מסלול השקעה
  returnRate: number; // תשואה נטו %
  retirementAge: number;
  joinDate: string;
  lastUpdate: string;
  deathCoverage: number; // כיסוי למקרה מוות
  disabilityCoverage: number; // כיסוי אובדן כושר עבודה
}

export interface MislakaReport {
  id?: string;
  owner: string; // 'client' or 'spouse'
  ownerName: string;
  ownerId: string;
  products: MislakaProduct[];
  importDate: string;
}

// Bank account transactions
export type AccountType = 'personal' | 'business';

export interface BankTransaction {
  date: string;
  code: string;
  action: string;
  details: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  category: string;
}

export interface BankAccount {
  id: string;
  accountNumber: string;
  bank: string;
  type: AccountType;
  owner: string;
  period: string;
  transactions: BankTransaction[];
  importDate: string;
}

export type GoalPriority = 'high' | 'medium' | 'low';
export type GoalStatus = 'active' | 'completed' | 'paused';

export interface RetirementGoals {
  pensionTarget: number;    // יעד קצבה חודשית
  lumpSumTarget: number;    // יעד הוני
}

export type GoalTemplate =
  | 'education-fund'
  | 'home-purchase'
  | 'emergency-fund'
  | 'travel'
  | 'car'
  | 'custom';

export interface Goal {
  id: string;
  name: string;
  template: GoalTemplate;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: GoalPriority;
  status: GoalStatus;
  monthlyContribution: number;
  linkedAssetIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: 'savings' | 'investment' | 'pension' | 'tax' | 'insurance' | 'general';
  priority: 'high' | 'medium' | 'low';
  source: 'rules' | 'ai';
  actionItems: string[];
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  parsedData: FinancialRecord[] | null;
  uploadedAt: string;
}

export interface AppState {
  profile: UserProfile | null;
  assets: Asset[];
  liabilities: Liability[];
  mortgageReports: MortgageReport[];
  mislakaReports: MislakaReport[];
  pensionData: PensionData[];
  financialRecords: FinancialRecord[];
  retirementGoals: RetirementGoals | null;
  goals: Goal[];
  recommendations: Recommendation[];
  bankAccounts: BankAccount[];
  uploadedFiles: UploadedFile[];
}
