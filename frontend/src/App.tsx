import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { JobPage } from './pages/JobPage';

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <header className="topbar">
        <h1>Sales Analytics Pipeline</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{user.email}</span>
          <button className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <Shell>
                <DashboardPage />
              </Shell>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <Shell>
                <JobPage />
              </Shell>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
