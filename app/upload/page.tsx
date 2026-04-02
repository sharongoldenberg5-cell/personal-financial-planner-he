'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from '@/lib/translations';
import { saveFinancialRecords, saveUploadedFile, saveAsset, saveLiability, saveMortgageReport, saveMislakaReport, saveBankAccount, saveCreditCard, generateId } from '@/lib/storage';
import { formatCurrency } from '@/lib/utils';
import type { FinancialRecord, Asset, Liability, MortgageReport as MortgageReportType, MislakaReport } from '@/lib/types';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, X,
  FileText, FileArchive, File as FileIcon, Wallet, TrendingDown,
  ChevronDown, ChevronUp, Shield, Building, BarChart3, CreditCard,
} from 'lucide-react';

interface MortgageSubLoan {
  subLoanNumber: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  interestType: string;
  monthlyPayment: number;
}

type MortgageReport = MortgageReportType;

interface MislakaData {
  ownerName: string;
  ownerId: string;
  products: { id: string; productType: string; providerName: string; planName: string; totalBalance: number; [key: string]: unknown }[];
}

interface BankAccountData {
  accountNumber: string;
  bank: string;
  period: string;
  transactions: {
    date: string;
    code: string;
    action: string;
    details: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
    category: string;
  }[];
}

interface CreditCardData {
  cardNumber: string;
  cardName: string;
  period: string;
  totalCharged: number;
  transactions: {
    date: string;
    businessName: string;
    category: string;
    amount: number;
    currency: string;
    originalAmount: number;
    originalCurrency: string;
    installmentCurrent: number;
    installmentTotal: number;
    totalDealAmount: number;
    isInstallment: boolean;
  }[];
}

interface ParseResult {
  records: FinancialRecord[];
  rawData: Record<string, string>[];
  headers: string[];
  fileName?: string;
  error?: string;
  mortgageReport?: MortgageReport;
  mislakaData?: MislakaData;
  bankAccountData?: BankAccountData;
  creditCardData?: CreditCardData;
}

interface ZipParseResult {
  files: ParseResult[];
  totalRecords: number;
  error?: string;
}

type ApiResponse =
  | { type: 'single'; data: ParseResult }
  | { type: 'zip'; data: ZipParseResult };

interface FileResult {
  id: string;
  fileName: string;
  result: ParseResult | null;
  zipResult: ZipParseResult | null;
  imported: boolean;
  liabilityCreated: boolean;
  assetCreated: boolean;
  bankAccountSaved: boolean;
  creditCardSaved: boolean;
  processing?: boolean;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'zip') return <FileArchive size={20} className="text-purple-500" />;
  if (ext === 'pdf') return <FileText size={20} className="text-red-500" />;
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) return <FileSpreadsheet size={20} className="text-green-500" />;
  if (['docx', 'doc'].includes(ext)) return <FileText size={20} className="text-blue-500" />;
  return <FileIcon size={20} className="text-text-light" />;
}

const ACCEPTED_FORMATS = '.xlsx,.xls,.csv,.tsv,.pdf,.docx,.doc,.zip';

const SESSION_KEY = 'upload-file-results';
const SESSION_JOBS_KEY = 'upload-job-map';

function loadSessionResults(): FileResult[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessionResults(results: FileResult[]) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(results)); } catch {}
}

function loadSessionJobs(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SESSION_JOBS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSessionJobs(jobs: Map<string, string>) {
  try { sessionStorage.setItem(SESSION_JOBS_KEY, JSON.stringify(Object.fromEntries(jobs))); } catch {}
}

export default function UploadPage() {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const jobMapRef = useRef<Map<string, string>>(new Map());
  const initialized = useRef(false);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = loadSessionResults();
    if (saved.length > 0) setFileResults(saved);
    const savedJobs = loadSessionJobs();
    jobMapRef.current = new Map(Object.entries(savedJobs));
  }, []);

  // Persist state to sessionStorage on every change
  useEffect(() => {
    if (!initialized.current) return;
    saveSessionResults(fileResults);
    saveSessionJobs(jobMapRef.current);
  }, [fileResults]);

  // Poll for processing jobs
  useEffect(() => {
    const interval = setInterval(async () => {
      const processing = fileResults.filter(f => f.processing);
      if (processing.length === 0) return;

      for (const fr of processing) {
        const jobId = jobMapRef.current.get(fr.id);
        if (!jobId) continue;

        try {
          const resp = await fetch(`/api/parse-file?jobId=${jobId}`);
          if (!resp.ok) continue;
          const data = await resp.json();

          if (data.status === 'done') {
            const apiResult: ApiResponse = data.result;
            const singleData = apiResult.type === 'single' ? apiResult.data : null;
            // Auto-save mortgage report if detected
            if (singleData?.mortgageReport && !savedMortgageIds.current.has(fr.id)) {
              saveMortgageReport({ ...singleData.mortgageReport, id: fr.id });
              savedMortgageIds.current.add(fr.id);
            }
            setFileResults(prev => prev.map(f => f.id === fr.id ? {
              ...f,
              result: singleData,
              zipResult: apiResult.type === 'zip' ? apiResult.data : null,
              processing: false,
            } : f));
            jobMapRef.current.delete(fr.id);
          } else if (data.status === 'error') {
            setFileResults(prev => prev.map(f => f.id === fr.id ? {
              ...f,
              result: { records: [], rawData: [], headers: [], error: data.error },
              processing: false,
            } : f));
            jobMapRef.current.delete(fr.id);
          }
          // status === 'processing' -> keep polling
        } catch {
          // Network error during poll - will retry next interval
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [fileResults]);

  // Auto-save mortgage reports, mislaka data, and bank accounts when detected
  const savedMortgageIds = useRef<Set<string>>(new Set());
  const savedMislakaIds = useRef<Set<string>>(new Set());
  const savedBankAccountIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const fr of fileResults) {
      if (fr.processing) continue;
      // Mortgage reports
      const mortgage = fr.result?.mortgageReport;
      if (mortgage && mortgage.subLoans.length > 0 && !savedMortgageIds.current.has(fr.id)) {
        saveMortgageReport({ ...mortgage, id: fr.id });
        savedMortgageIds.current.add(fr.id);
      }
      // Mislaka data (from ZIP files)
      if (fr.zipResult && !savedMislakaIds.current.has(fr.id)) {
        const mislakaFile = fr.zipResult.files?.find(f => f.mislakaData);
        if (mislakaFile?.mislakaData) {
          const md = mislakaFile.mislakaData;
          const allProducts = md.products as unknown as MislakaReport['products'];

          // Save mislaka report (pension page will filter pension/insurance/provident)
          saveMislakaReport({
            id: fr.id,
            owner: 'client',
            ownerName: md.ownerName,
            ownerId: md.ownerId,
            products: allProducts,
            importDate: new Date().toISOString(),
          });

          // Auto-add education funds and investment provident to assets
          const now = new Date().toISOString();
          for (const p of allProducts) {
            if (p.productType === 'education-fund' || p.productType === 'investment-provident') {
              saveAsset({
                id: generateId(),
                name: `${p.planName} - ${p.providerName}`,
                category: p.productType === 'education-fund' ? 'provident-fund' : 'investment',
                value: p.totalBalance,
                currency: 'ILS',
                monthlyContribution: 0,
                interestRate: p.returnRate,
                notes: `מסלקה | ${md.ownerName}`,
                createdAt: now,
                updatedAt: now,
              });
            }
          }

          savedMislakaIds.current.add(fr.id);
        }
      }
      // Bank account data - not auto-saved, user must approve via button
    }
  }, [fileResults]);

  const processingCount = useMemo(() => fileResults.filter(f => f.processing).length, [fileResults]);

  const processFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);

    const placeholders: FileResult[] = fileArray.map(file => ({
      id: generateId(),
      fileName: file.name,
      result: null,
      zipResult: null,
      imported: false,
      liabilityCreated: false,
      assetCreated: false,
      bankAccountSaved: false,
      creditCardSaved: false,
      processing: true,
    }));
    setFileResults(prev => [...prev, ...placeholders]);
    if (fileArray.length === 1) setExpandedFile(placeholders[0].id);

    // Upload all files in parallel - server returns immediately with jobId
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const placeholderId = placeholders[i].id;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-file', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const data = await response.json();

        if (data.status === 'done') {
          // Fast file (Excel/CSV) - result came back immediately
          const apiResult: ApiResponse = data.result;
          setFileResults(prev => prev.map(f => f.id === placeholderId ? {
            ...f,
            result: apiResult.type === 'single' ? apiResult.data : null,
            zipResult: apiResult.type === 'zip' ? apiResult.data : null,
            processing: false,
          } : f));
        } else if (data.status === 'processing') {
          // Slow file (PDF/Word) - store jobId for polling
          jobMapRef.current.set(placeholderId, data.jobId);
        } else if (data.status === 'error') {
          setFileResults(prev => prev.map(f => f.id === placeholderId ? {
            ...f,
            result: { records: [], rawData: [], headers: [], error: data.error },
            processing: false,
          } : f));
        }
      } catch (e) {
        setFileResults(prev => prev.map(f => f.id === placeholderId ? {
          ...f,
          result: { records: [], rawData: [], headers: [], error: String(e) },
          processing: false,
        } : f));
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
    e.target.value = '';
  }, [processFiles]);

  const getRecords = (fr: FileResult): FinancialRecord[] => {
    if (fr.result) return fr.result.records;
    if (fr.zipResult) return fr.zipResult.files.flatMap(f => f.records);
    return [];
  };

  const handleImport = (fr: FileResult) => {
    const records = getRecords(fr);
    if (records.length === 0) return;
    saveFinancialRecords(records);
    saveUploadedFile({
      id: generateId(),
      name: fr.fileName,
      type: fr.fileName.split('.').pop() || 'unknown',
      size: 0,
      parsedData: records,
      uploadedAt: new Date().toISOString(),
    });
    setFileResults(prev => prev.map(f => f.id === fr.id ? { ...f, imported: true } : f));
  };

  const handleCreateAsset = (fr: FileResult) => {
    const records = getRecords(fr);
    const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const balance = totalIncome - totalExpense;
    const now = new Date().toISOString();
    const asset: Asset = {
      id: generateId(),
      name: fr.fileName.replace(/\.[^.]+$/, ''),
      category: 'bank-account',
      value: Math.abs(balance > 0 ? balance : totalIncome || totalExpense),
      currency: 'ILS',
      monthlyContribution: 0,
      interestRate: 0,
      notes: `Imported from ${fr.fileName} (${records.length} records)`,
      createdAt: now,
      updatedAt: now,
    };
    saveAsset(asset);
    setFileResults(prev => prev.map(f => f.id === fr.id ? { ...f, assetCreated: true } : f));
  };

  const handleCreateLiability = (fr: FileResult) => {
    const mortgage = fr.result?.mortgageReport;
    const now = new Date().toISOString();
    if (mortgage && mortgage.subLoans.length > 0) {
      // Save full mortgage report for analysis page
      saveMortgageReport({ ...mortgage, id: generateId() });
      for (const sl of mortgage.subLoans.filter(sl => sl.currentBalance > 0)) {
        const liability: Liability = {
          id: generateId(),
          name: `משכנתא משנה ${sl.subLoanNumber} - ${sl.interestType || 'לא ידוע'}`,
          category: 'mortgage',
          originalAmount: sl.originalAmount,
          currentBalance: sl.currentBalance,
          interestRate: sl.interestRate,
          monthlyPayment: sl.monthlyPayment,
          lender: mortgage.bank,
          startDate: '',
          endDate: '',
          notes: `הלוואה ${mortgage.loanNumber} | ${mortgage.borrowerName}`,
          createdAt: now,
          updatedAt: now,
        };
        saveLiability(liability);
      }
    } else {
      const records = getRecords(fr);
      const totalAmount = records.reduce((s, r) => s + r.amount, 0);
      const liability: Liability = {
        id: generateId(),
        name: fr.fileName.replace(/\.[^.]+$/, ''),
        category: 'loan',
        originalAmount: totalAmount,
        currentBalance: totalAmount,
        interestRate: 0,
        monthlyPayment: 0,
        lender: '',
        startDate: '',
        endDate: '',
        notes: `Imported from ${fr.fileName}`,
        createdAt: now,
        updatedAt: now,
      };
      saveLiability(liability);
    }
    setFileResults(prev => prev.map(f => f.id === fr.id ? { ...f, liabilityCreated: true } : f));
  };

  const handleSaveBankAccount = (fr: FileResult) => {
    const bankData = fr.result?.bankAccountData;
    if (!bankData || bankData.transactions.length === 0) return;
    saveBankAccount({
      id: fr.id,
      accountNumber: bankData.accountNumber,
      bank: bankData.bank,
      type: 'personal',
      owner: 'client',
      period: bankData.period,
      transactions: bankData.transactions,
      importDate: new Date().toISOString(),
    });
    setFileResults(prev => prev.map(f => f.id === fr.id ? { ...f, bankAccountSaved: true } : f));
  };

  const handleSaveCreditCard = (fr: FileResult) => {
    const ccData = fr.result?.creditCardData;
    if (!ccData || ccData.transactions.length === 0) return;
    saveCreditCard({
      id: fr.id,
      cardNumber: ccData.cardNumber,
      cardName: ccData.cardName,
      owner: 'client',
      period: ccData.period,
      totalCharged: ccData.totalCharged,
      transactions: ccData.transactions,
      importDate: new Date().toISOString(),
    });
    setFileResults(prev => prev.map(f => f.id === fr.id ? { ...f, creditCardSaved: true } : f));
  };

  const removeFile = (id: string) => {
    setFileResults(prev => prev.filter(f => f.id !== id));
    if (expandedFile === id) setExpandedFile(null);
  };

  const handleImportAll = () => {
    for (const fr of fileResults) {
      if (fr.imported) continue;
      const records = getRecords(fr);
      if (records.length === 0) continue;
      saveFinancialRecords(records);
      saveUploadedFile({
        id: generateId(),
        name: fr.fileName,
        type: fr.fileName.split('.').pop() || 'unknown',
        size: 0,
        parsedData: records,
        uploadedAt: new Date().toISOString(),
      });
    }
    setFileResults(prev => prev.map(f => ({ ...f, imported: true })));
  };

  const handleCreateAllLiabilities = () => {
    for (const fr of fileResults) {
      if (fr.liabilityCreated) continue;
      handleCreateLiability(fr);
    }
  };

  const clearAll = () => {
    setFileResults([]);
    setExpandedFile(null);
    jobMapRef.current.clear();
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_JOBS_KEY); } catch {}
  };

  const pendingImport = fileResults.filter(f => !f.imported && getRecords(f).length > 0).length;
  const pendingLiability = fileResults.filter(f => !f.liabilityCreated && (f.result?.mortgageReport || getRecords(f).length > 0)).length;

  return (
    <div className="max-w-4xl mx-auto"
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('upload.title')}</h1>
        {fileResults.length > 0 && (
          <button onClick={clearAll} className="text-sm text-text-light hover:text-danger transition-colors">
            {t('upload.clearAll')}
          </button>
        )}
      </div>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input
          type="file"
          accept={ACCEPTED_FORMATS}
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
          multiple
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <Upload size={48} className="mx-auto mb-4 text-text-light" />
          <p className="text-lg font-medium mb-2">{t('upload.dragDrop')}</p>
          <p className="text-sm text-text-light">{t('upload.supportedFormats')}</p>
          <p className="text-xs text-text-light mt-1">{t('upload.multipleFiles')}</p>
        </label>
      </div>

      {/* Supported file types info */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-xl p-3 flex items-start gap-3">
          <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
            <Shield size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold">דוחות מסלקה</p>
            <p className="text-[10px] text-text-light">פנסיה, ביטוח מנהלים, קופות גמל</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3 flex items-start gap-3">
          <div className="bg-green-100 p-2 rounded-lg flex-shrink-0">
            <Building size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold">דוחות בנק</p>
            <p className="text-[10px] text-text-light">משכנתא, תנועות חשבון (Excel)</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3 flex items-start gap-3">
          <div className="bg-purple-100 p-2 rounded-lg flex-shrink-0">
            <CreditCard size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold">דוחות כרטיסי אשראי</p>
            <p className="text-[10px] text-text-light">פירוט עסקאות, זיהוי תשלומים</p>
          </div>
        </div>
      </div>

      {/* External services links */}
      <div className="mt-4 space-y-3">
        {/* Mislaka */}
        <a href="https://www.swiftness.co.il/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
            <Shield size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('upload.mislakaLink')}</p>
            <p className="text-[10px] text-text-light">{t('upload.mislakaLinkDesc')}</p>
          </div>
        </a>

        {/* Banks - mortgage + account transactions */}
        <details className="bg-surface border border-border rounded-xl">
          <summary className="p-3 cursor-pointer hover:bg-background/50 transition-colors flex items-center gap-2">
            <Building size={18} className="text-green-600" />
            <span className="text-sm font-medium">בנקים</span>
            <span className="text-[10px] text-text-light">(דוחות משכנתא, תנועות חשבון)</span>
          </summary>
          <p className="px-3 text-[10px] text-text-light mb-2">היכנס לבנק שלך והורד: דוח יתרת משכנתא (PDF) + תנועות חשבון עו"ש (Excel)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 pt-0">
            {[
              { name: 'בנק הפועלים', url: 'https://www.bankhapoalim.co.il/' },
              { name: 'בנק לאומי', url: 'https://www.leumi.co.il/' },
              { name: 'בנק דיסקונט', url: 'https://www.discountbank.co.il/' },
              { name: 'מזרחי טפחות', url: 'https://www.mizrahi-tefahot.co.il/' },
              { name: 'הבינלאומי (FIBI)', url: 'https://www.fibi.co.il/' },
              { name: 'בנק ירושלים', url: 'https://www.bankjerusalem.co.il/' },
              { name: 'וואן זירו (ONE ZERO)', url: 'https://www.onezerobank.com/' },
            ].map(bank => (
              <a key={bank.name} href={bank.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-background rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors text-sm">
                <Building size={14} className="text-text-light flex-shrink-0" />
                {bank.name}
              </a>
            ))}
          </div>
        </details>

        {/* Credit Card companies */}
        <details className="bg-surface border border-border rounded-xl">
          <summary className="p-3 cursor-pointer hover:bg-background/50 transition-colors flex items-center gap-2">
            <CreditCard size={18} className="text-purple-600" />
            <span className="text-sm font-medium">חברות כרטיסי אשראי</span>
            <span className="text-[10px] text-text-light">(דוחות פירוט עסקאות)</span>
          </summary>
          <p className="px-3 text-[10px] text-text-light mb-2">היכנס לאתר חברת האשראי שלך והורד דוח פירוט עסקאות בפורמט Excel</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 pt-0">
            {[
              { name: 'כאל (CAL)', url: 'https://www.cal-online.co.il/' },
              { name: 'ישראכרט', url: 'https://www.isracard.co.il/' },
              { name: 'מקס (MAX)', url: 'https://www.max.co.il/' },
              { name: 'לאומי קארד', url: 'https://www.leumi-card.co.il/' },
              { name: 'אמריקן אקספרס', url: 'https://www.americanexpress.co.il/' },
              { name: 'דיינרס', url: 'https://www.diners.co.il/' },
            ].map(cc => (
              <a key={cc.name} href={cc.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-background rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-colors text-sm">
                <CreditCard size={14} className="text-text-light flex-shrink-0" />
                {cc.name}
              </a>
            ))}
          </div>
        </details>
      </div>

      {/* Processing indicator */}
      {processingCount > 0 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-primary">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>{t('upload.processing')} ({processingCount})</span>
        </div>
      )}

      {/* File count */}
      {fileResults.length > 1 && (
        <div className="mt-6 p-3 bg-surface rounded-xl border border-border text-center">
          <span className="text-sm font-medium">{fileResults.length} {t('upload.filesUploaded')}</span>
        </div>
      )}

      {/* File Results */}
      {fileResults.length > 0 && (
        <div className="mt-4 space-y-3">
          {fileResults.map(fr => {
            const records = getRecords(fr);
            const totalRecords = fr.result?.records.length || fr.zipResult?.totalRecords || 0;
            const hasError = fr.result?.error || fr.zipResult?.error;
            const isExpanded = expandedFile === fr.id;
            const mortgage = fr.result?.mortgageReport;
            const hasMislaka = fr.zipResult?.files?.some(f => f.mislakaData) || false;
            const bankData = fr.result?.bankAccountData;

            return (
              <div key={fr.id} className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
                {/* File Header - always visible */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={() => setExpandedFile(isExpanded ? null : fr.id)}
                >
                  <div className="flex items-center gap-3">
                    {fr.processing ? (
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    ) : getFileIcon(fr.fileName)}
                    <div>
                      <p className="font-medium">{fr.fileName}</p>
                      <p className="text-sm text-text-light">
                        {fr.processing ? (
                          <span className="text-primary">{t('upload.processing')}</span>
                        ) : hasError ? (
                          <span className="text-danger">{hasError}</span>
                        ) : mortgage ? (
                          <span>{t('upload.mortgageReport')} • {formatCurrency(mortgage.totalBalance)}</span>
                        ) : bankData ? (
                          <span>תנועות בנק • {bankData.transactions.length} תנועות</span>
                        ) : fr.result?.creditCardData ? (
                          <span>כרטיס אשראי {fr.result.creditCardData.cardName} • {fr.result.creditCardData.transactions.length} עסקאות</span>
                        ) : (
                          <span>{totalRecords} {t('upload.records')}</span>
                        )}
                        {fr.imported && <span className="text-success ms-2">✓ {t('upload.imported')}</span>}
                        {fr.liabilityCreated && <span className="text-danger ms-2">✓ {t('upload.liabilityCreated')}</span>}
                        {fr.assetCreated && <span className="text-primary ms-2">✓ {t('upload.assetCreated')}</span>}
                        {fr.bankAccountSaved && <span className="text-blue-600 ms-2">✓ תנועות יובאו</span>}
                        {fr.creditCardSaved && <span className="text-purple-600 ms-2">✓ כרטיס אשראי יובא</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); removeFile(fr.id); }}
                      className="text-text-light hover:text-danger p-1"><X size={16} /></button>
                    {isExpanded ? <ChevronUp size={18} className="text-text-light" /> : <ChevronDown size={18} className="text-text-light" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && !hasError && !fr.processing && (
                  <div className="px-4 pb-4 border-t border-border pt-4">
                    {/* Mortgage Report */}
                    {mortgage && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <h3 className="text-base font-bold text-danger mb-3">{t('upload.mortgageReport')}</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div><span className="text-text-light">{t('upload.mortgageBorrower')}:</span> <strong>{mortgage.borrowerName}</strong></div>
                          <div><span className="text-text-light">{t('upload.mortgageBank')}:</span> <strong>{mortgage.bank}</strong></div>
                          <div><span className="text-text-light">{t('upload.mortgageDate')}:</span> <strong>{mortgage.reportDate}</strong></div>
                          <div><span className="text-text-light">{t('upload.mortgageTotal')}:</span> <strong className="text-danger text-lg">{formatCurrency(mortgage.totalBalance)}</strong></div>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-red-200">
                              <th className="px-2 py-1 text-start">{t('upload.mortgageSubLoan')}</th>
                              <th className="px-2 py-1 text-end">{t('liabilities.originalAmount')}</th>
                              <th className="px-2 py-1 text-end">{t('liabilities.currentBalance')}</th>
                              <th className="px-2 py-1 text-end">{t('liabilities.interestRate')}</th>
                              <th className="px-2 py-1 text-start">{t('upload.mortgageType')}</th>
                              <th className="px-2 py-1 text-end">{t('liabilities.monthlyPayment')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mortgage.subLoans.filter(sl => sl.currentBalance > 0).map((sl, i) => (
                              <tr key={i} className="border-b border-red-100">
                                <td className="px-2 py-1">{sl.subLoanNumber}</td>
                                <td className="px-2 py-1 text-end">{formatCurrency(sl.originalAmount)}</td>
                                <td className="px-2 py-1 text-end font-semibold text-danger">{formatCurrency(sl.currentBalance)}</td>
                                <td className="px-2 py-1 text-end">{sl.interestRate}%</td>
                                <td className="px-2 py-1">{sl.interestType}</td>
                                <td className="px-2 py-1 text-end">{formatCurrency(sl.monthlyPayment)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Bank Account Transactions Preview */}
                    {bankData && bankData.transactions.length > 0 && (
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <h3 className="text-base font-bold text-blue-800 mb-3 flex items-center gap-2">
                          <BarChart3 size={18} /> תנועות חשבון בנק
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          <div className="bg-white rounded-lg p-2.5 text-center">
                            <p className="text-xs text-text-light">בנק</p>
                            <p className="font-semibold text-sm">{bankData.bank || 'לא ידוע'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 text-center">
                            <p className="text-xs text-text-light">חשבון</p>
                            <p className="font-semibold text-sm">{bankData.accountNumber || '-'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 text-center">
                            <p className="text-xs text-text-light">תקופה</p>
                            <p className="font-semibold text-sm">{bankData.period || '-'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 text-center">
                            <p className="text-xs text-text-light">תנועות</p>
                            <p className="font-semibold text-sm">{bankData.transactions.length}</p>
                          </div>
                        </div>
                        {/* Summary */}
                        {(() => {
                          const income = bankData.transactions.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0);
                          const expenses = bankData.transactions.filter(t => t.debit > 0).reduce((s, t) => s + t.debit, 0);
                          return (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="bg-green-100 rounded-lg p-2 text-center">
                                <p className="text-xs text-green-700">הכנסות</p>
                                <p className="font-bold text-green-700 text-sm">{formatCurrency(income)}</p>
                              </div>
                              <div className="bg-red-100 rounded-lg p-2 text-center">
                                <p className="text-xs text-red-700">הוצאות</p>
                                <p className="font-bold text-red-700 text-sm">{formatCurrency(expenses)}</p>
                              </div>
                              <div className={`${income >= expenses ? 'bg-blue-100' : 'bg-orange-100'} rounded-lg p-2 text-center`}>
                                <p className={`text-xs ${income >= expenses ? 'text-blue-700' : 'text-orange-700'}`}>תזרים נטו</p>
                                <p className={`font-bold text-sm ${income >= expenses ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(income - expenses)}</p>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Sample transactions */}
                        <table className="w-full text-xs mb-3">
                          <thead>
                            <tr className="border-b border-blue-200 text-text-light">
                              <th className="px-1.5 py-1 text-start">תאריך</th>
                              <th className="px-1.5 py-1 text-start">פעולה</th>
                              <th className="px-1.5 py-1 text-start">פרטים</th>
                              <th className="px-1.5 py-1 text-end">חובה</th>
                              <th className="px-1.5 py-1 text-end">זכות</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bankData.transactions.slice(0, 5).map((t, i) => (
                              <tr key={i} className="border-b border-blue-100">
                                <td className="px-1.5 py-1">{t.date}</td>
                                <td className="px-1.5 py-1">{t.action}</td>
                                <td className="px-1.5 py-1 max-w-[150px] truncate">{t.details}</td>
                                <td className="px-1.5 py-1 text-end">{t.debit > 0 ? <span className="text-danger">{formatCurrency(t.debit)}</span> : ''}</td>
                                <td className="px-1.5 py-1 text-end">{t.credit > 0 ? <span className="text-success">{formatCurrency(t.credit)}</span> : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {bankData.transactions.length > 5 && (
                          <p className="text-xs text-blue-600 mb-3">... +{bankData.transactions.length - 5} תנועות נוספות</p>
                        )}
                        {!fr.bankAccountSaved ? (
                          <button onClick={() => handleSaveBankAccount(fr)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                            <BarChart3 size={16} /> ייבא תנועות לניתוח
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 text-blue-700 text-sm">
                            <CheckCircle size={16} />
                            <span>התנועות יובאו בהצלחה</span>
                            <a href="/transactions" className="underline hover:text-blue-900 ms-1">עבור לניתוח תנועות →</a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Credit Card Statement Preview */}
                    {fr.result?.creditCardData && fr.result.creditCardData.transactions.length > 0 && (() => {
                      const ccData = fr.result.creditCardData!;
                      const installmentTxs = ccData.transactions.filter(t => t.isInstallment);
                      const installmentTotal = installmentTxs.reduce((s, t) => s + t.totalDealAmount, 0);
                      return (
                        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                          <h3 className="text-base font-bold text-purple-800 mb-3 flex items-center gap-2">
                            <CreditCard size={18} /> דוח כרטיס אשראי
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                            <div className="bg-white rounded-lg p-2.5 text-center">
                              <p className="text-xs text-text-light">כרטיס</p>
                              <p className="font-semibold text-sm">{ccData.cardName}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 text-center">
                              <p className="text-xs text-text-light">מספר</p>
                              <p className="font-semibold text-sm">****{ccData.cardNumber}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 text-center">
                              <p className="text-xs text-text-light">תקופה</p>
                              <p className="font-semibold text-sm">{ccData.period}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 text-center">
                              <p className="text-xs text-text-light">סה"כ חיוב</p>
                              <p className="font-semibold text-sm text-purple-700">{formatCurrency(ccData.totalCharged)}</p>
                            </div>
                          </div>
                          {/* Installment warning */}
                          {installmentTxs.length > 0 && (
                            <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 mb-3">
                              <p className="text-sm font-semibold text-orange-800">⚠️ {installmentTxs.length} עסקאות בתשלומים</p>
                              <p className="text-xs text-orange-700 mt-1">
                                סה"כ עסקאות בתשלומים: {formatCurrency(installmentTotal)} | חיוב חודשי: {formatCurrency(installmentTxs.reduce((s, t) => s + t.amount, 0))}
                              </p>
                            </div>
                          )}
                          {/* Sample transactions */}
                          <table className="w-full text-xs mb-3">
                            <thead>
                              <tr className="border-b border-purple-200 text-text-light">
                                <th className="px-1.5 py-1 text-start">תאריך</th>
                                <th className="px-1.5 py-1 text-start">בית עסק</th>
                                <th className="px-1.5 py-1 text-end">סכום</th>
                                <th className="px-1.5 py-1 text-start">תשלומים</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ccData.transactions.slice(0, 5).map((t, i) => (
                                <tr key={i} className="border-b border-purple-100">
                                  <td className="px-1.5 py-1">{t.date}</td>
                                  <td className="px-1.5 py-1">{t.businessName}</td>
                                  <td className="px-1.5 py-1 text-end text-purple-700">{formatCurrency(t.amount)}</td>
                                  <td className="px-1.5 py-1">
                                    {t.isInstallment ? (
                                      <span className="text-orange-600 font-medium">{t.installmentCurrent}/{t.installmentTotal}</span>
                                    ) : 'רגילה'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {ccData.transactions.length > 5 && (
                            <p className="text-xs text-purple-600 mb-3">... +{ccData.transactions.length - 5} עסקאות נוספות</p>
                          )}
                          {!fr.creditCardSaved ? (
                            <button onClick={() => handleSaveCreditCard(fr)}
                              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm">
                              <CreditCard size={16} /> ייבא דוח כרטיס אשראי
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-purple-700 text-sm">
                              <CheckCircle size={16} />
                              <span>דוח כרטיס האשראי יובא בהצלחה</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ZIP file list */}
                    {fr.zipResult && (
                      <div className="mb-4 space-y-2">
                        <h3 className="text-sm font-semibold mb-2">{t('upload.filesInZip')}:</h3>
                        {fr.zipResult.files.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded-lg text-sm">
                            {getFileIcon(f.fileName || '')}
                            <span className="flex-1">{f.fileName}</span>
                            <span className="text-text-light">
                              {f.error ? <span className="text-danger">{f.error}</span> : `${f.records.length} ${t('upload.records')}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Preview Table */}
                    {records.length > 0 && !mortgage && (
                      <div className="overflow-x-auto mb-4">
                        <h3 className="text-sm font-semibold mb-2">{t('upload.preview')}</h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="px-3 py-2 text-start">#</th>
                              <th className="px-3 py-2 text-start">{t('upload.colDate')}</th>
                              <th className="px-3 py-2 text-start">{t('upload.colDescription')}</th>
                              <th className="px-3 py-2 text-end">{t('upload.colAmount')}</th>
                              <th className="px-3 py-2 text-start">{t('upload.colType')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.slice(0, 10).map((rec, idx) => (
                              <tr key={rec.id} className="border-b border-border/50">
                                <td className="px-3 py-2">{idx + 1}</td>
                                <td className="px-3 py-2">{rec.date}</td>
                                <td className="px-3 py-2 max-w-xs truncate">{rec.description}</td>
                                <td className="px-3 py-2 text-end">{formatCurrency(rec.amount)}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    rec.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {rec.type === 'income' ? t('upload.typeIncome') : t('upload.typeExpense')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {records.length > 10 && (
                          <p className="text-sm text-text-light mt-2">... +{records.length - 10} {t('upload.moreRecords')}</p>
                        )}
                      </div>
                    )}

                    {/* Raw text fallback */}
                    {records.length === 0 && !mortgage && fr.result && fr.result.rawData.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold mb-2">{t('upload.extractedText')}</h3>
                        <div className="bg-background rounded-lg p-4 max-h-48 overflow-y-auto text-sm whitespace-pre-wrap">
                          {fr.result.rawData.slice(0, 30).map((row, i) => (
                            <div key={i} className="py-0.5">{row.content || Object.values(row).join(' ')}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Import button for generic files */}
                    {records.length > 0 && !fr.imported && !mortgage && !bankData && !fr.result?.creditCardData && !hasMislaka && (
                      <div className="pt-2 border-t border-border">
                        <button onClick={() => handleImport(fr)}
                          className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                          <CheckCircle size={16} />
                          {t('upload.confirmImport')} ({totalRecords})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
