import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getToken } from '../api/client';
import type { Job, ReportMetrics } from '../types';
import { RevenueBarChart, StatTile, TrendLineChart } from '../components/charts';

const money = (v: number) =>
  v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

// Job detail: polls every 1.5s while processing (live progress bar),
// then loads the aggregate report and renders the dashboard.
export function JobPage() {
  const { id } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [report, setReport] = useState<ReportMetrics | null>(null);
  const [error, setError] = useState('');
  const [reaggregating, setReaggregating] = useState(false);

  const loadJob = useCallback(async () => {
    try {
      setJob(await api.get<Job>(`/api/jobs/${id}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const active = job?.status === 'pending' || job?.status === 'processing';
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(loadJob, 1500);
    return () => clearInterval(timer);
  }, [active, loadJob]);

  const hasValidRows = (job?.validRows ?? 0) > 0;
  useEffect(() => {
    // No point fetching a report when 0 rows were valid — it's all zeros.
    if (job?.status === 'completed' && hasValidRows && !report) {
      api.get<ReportMetrics>(`/api/jobs/${id}/report`).then(setReport).catch((err) => setError(err.message));
    }
  }, [job?.status, hasValidRows, report, id]);

  // "Re-run aggregation" button: recomputes metrics in SQL and stores a fresh report row.
  async function reaggregate() {
    setReaggregating(true);
    try {
      setReport(await api.post<ReportMetrics>(`/api/jobs/${id}/aggregate`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReaggregating(false);
    }
  }

  async function downloadResults() {
    // fetch with auth header, then trigger a browser download
    const res = await fetch(`/api/jobs/${id}/export`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-${id}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!job) {
    return (
      <div className="container">{error ? <p className="error-text">{error}</p> : <p>Loading…</p>}</div>
    );
  }

  const progress = job.totalRows ? Math.round((job.processedRows / job.totalRows) * 100) : 0;

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <p style={{ margin: 0 }}>
        <Link to="/">← All jobs</Link>
      </p>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>
            {job.filename} <span className={`badge ${job.status}`}>{job.status}</span>
          </h2>
          {job.status === 'completed' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ghost" onClick={reaggregate} disabled={reaggregating}>
                {reaggregating ? 'Re-computing…' : 'Re-run aggregation'}
              </button>
              <button onClick={downloadResults}>Download results CSV</button>
            </div>
          )}
        </div>

        {active && (
          <div style={{ marginTop: 16 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {job.processedRows} / {job.totalRows} rows processed ({progress}%)
            </p>
          </div>
        )}

        {job.status === 'failed' && <p className="error-text">{job.errorMessage}</p>}

        <div className="grid tiles" style={{ marginTop: 16 }}>
          <StatTile label="Total rows" value={String(job.totalRows)} />
          <StatTile label="Valid" value={String(job.validRows)} />
          <StatTile label="Invalid" value={String(job.invalidRows)} />
          <StatTile label="Duplicates" value={String(job.duplicateRows)} />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {job.status === 'completed' && !hasValidRows && (
        <div className="card">
          <h3>No valid rows — nothing to aggregate</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
            Every row in this file failed validation, so there are no metrics to report. Download
            the results CSV above to see the exact reason each row was rejected.
          </p>
        </div>
      )}

      {report && (
        <>
          <div className="grid tiles">
            <StatTile label="Total revenue" value={money(report.totalRevenue)} />
            <StatTile label="Average order" value={money(report.averageOrderValue)} />
            <StatTile label="Median order" value={money(report.medianOrderValue)} />
            <StatTile
              label="Std deviation"
              value={money(report.orderValueStdDev)}
              sub="of order values"
            />
            <StatTile
              label="Lost to discounts"
              value={money(report.discountLoss)}
              sub="gross − net revenue"
            />
          </div>

          <div className="grid cols-2">
            <div className="card">
              <h3>Revenue by region</h3>
              <RevenueBarChart data={report.revenueByRegion} nameKey="region" />
            </div>
            <div className="card">
              <h3>Revenue by category</h3>
              <RevenueBarChart data={report.revenueByCategory} nameKey="category" />
            </div>
          </div>

          <div className="card">
            <h3>Revenue trend (daily)</h3>
            <TrendLineChart data={report.dailyTrend} />
          </div>

          <div className="card">
            <h3>Top 5 transactions</h3>
            <table>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Region</th>
                  <th>Category</th>
                  <th className="num">Net amount</th>
                </tr>
              </thead>
              <tbody>
                {report.topTransactions.map((t) => (
                  <tr key={t.transactionId}>
                    <td>{t.transactionId}</td>
                    <td>{t.region}</td>
                    <td>{t.category}</td>
                    <td className="num">{money(t.netAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
