import { pool } from '../config/db.js';

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

// All aggregate math runs in Postgres, not JS: at 10k+ rows the DB
// does this in one pass over an indexed table instead of shipping
// every row over the wire.
export const reportRepository = {
  async computeMetrics(jobId: number): Promise<ReportMetrics> {
    const valid = `FROM transactions WHERE job_id = $1 AND validation_status = 'valid'`;

    const [summary, byRegion, byCategory, top5, daily, monthly] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(net_amount), 0)::float                                          AS total_revenue,
           COALESCE(AVG(net_amount), 0)::float                                          AS avg_order_value,
           COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY net_amount), 0)::float  AS median_order_value,
           COALESCE(STDDEV(net_amount), 0)::float                                       AS order_value_stddev,
           COALESCE(SUM(quantity * unit_price) - SUM(net_amount), 0)::float             AS discount_loss
         ${valid}`,
        [jobId]
      ),
      pool.query(
        `SELECT region, SUM(net_amount)::float AS revenue ${valid} GROUP BY region ORDER BY revenue DESC`,
        [jobId]
      ),
      pool.query(
        `SELECT product_category AS category, SUM(net_amount)::float AS revenue
         ${valid} GROUP BY product_category ORDER BY revenue DESC`,
        [jobId]
      ),
      pool.query(
        `SELECT transaction_id, region, product_category, net_amount::float
         ${valid} ORDER BY net_amount DESC LIMIT 5`,
        [jobId]
      ),
      pool.query(
        `SELECT transaction_date::text AS date, SUM(net_amount)::float AS revenue
         ${valid} GROUP BY transaction_date ORDER BY transaction_date`,
        [jobId]
      ),
      pool.query(
        `SELECT to_char(date_trunc('month', transaction_date), 'YYYY-MM') AS month,
                SUM(net_amount)::float AS revenue
         ${valid} GROUP BY 1 ORDER BY 1`,
        [jobId]
      ),
    ]);

    const s = summary.rows[0];
    return {
      totalRevenue: s.total_revenue,
      averageOrderValue: s.avg_order_value,
      medianOrderValue: s.median_order_value,
      orderValueStdDev: s.order_value_stddev,
      discountLoss: s.discount_loss,
      revenueByRegion: byRegion.rows,
      revenueByCategory: byCategory.rows,
      topTransactions: top5.rows.map((r) => ({
        transactionId: r.transaction_id,
        region: r.region,
        category: r.product_category,
        netAmount: r.net_amount,
      })),
      dailyTrend: daily.rows,
      monthlyTrend: monthly.rows,
    };
  },

  async saveReport(jobId: number, metrics: ReportMetrics): Promise<void> {
    await pool.query('INSERT INTO reports (job_id, metrics) VALUES ($1, $2)', [
      jobId,
      JSON.stringify(metrics),
    ]);
  },

  async latestForJob(jobId: number): Promise<{ metrics: ReportMetrics; createdAt: Date } | null> {
    const { rows } = await pool.query(
      'SELECT metrics, created_at FROM reports WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [jobId]
    );
    return rows[0] ? { metrics: rows[0].metrics, createdAt: rows[0].created_at } : null;
  },
};

export type ReportRepository = typeof reportRepository;
