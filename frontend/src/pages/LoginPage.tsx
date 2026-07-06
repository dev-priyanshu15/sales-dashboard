// Login/signup form: onSubmit sends credentials via the auth context, navigates home on success.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function LoginPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await (mode === 'login' ? login(email, password) : signup(email, password));
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: '10vh' }}>
      <div className="card">
        <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {mode === 'login' ? 'No account yet?' : 'Already registered?'}{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setError('');
              setMode(mode === 'login' ? 'signup' : 'login');
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </a>
        </p>
      </div>
    </div>
  );
}
