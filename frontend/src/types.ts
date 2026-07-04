// Mirrors the backend's API response shapes.

export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

export interface Job {
  id: number;
  userId: number;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ReportMetrics {
  totalRevenue: number;
  averageOrderValue: number;
  medianOrderValue: number;
  orderValueStdDev: number;
  discountLoss: number;
  revenueByRegion: { region: string; revenue: number }[];
  revenueByCategory: { category: string; revenue: number }[];
  topTransactions: { transactionId: string; region: string; category: string; netAmount: number }[];
  dailyTrend: { date: string; revenue: number }[];
  monthlyTrend: { month: string; revenue: number }[];
}
