import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Job } from '../types';

// Upload a CSV + list of the user's jobs. The list polls every 2s
// while any job is still pending/processing so statuses stay live.
export function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setJobs(await api.get<Job[]>('/api/jobs'));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'processing');
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [hasActive, refresh]);

  async function onUpload() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const job = await api.upload<Job>('/api/jobs/upload', file);
      await api.post(`/api/jobs/${job.id}/process`); // start immediately after upload
      fileInput.current!.value = '';
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <div className="card">
        <h2>Upload sales CSV</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input type="file" accept=".csv" ref={fileInput} />
          <button onClick={onUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload & process'}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <h2>Your jobs</h2>
        {jobs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No uploads yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th className="num">Rows</th>
                <th className="num">Valid</th>
                <th className="num">Invalid</th>
                <th className="num">Duplicates</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link to={`/jobs/${job.id}`}>{job.filename}</Link>
                  </td>
                  <td>
                    <span className={`badge ${job.status}`}>{job.status}</span>
                  </td>
                  <td className="num">{job.totalRows}</td>
                  <td className="num">{job.validRows}</td>
                  <td className="num">{job.invalidRows}</td>
                  <td className="num">{job.duplicateRows}</td>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
