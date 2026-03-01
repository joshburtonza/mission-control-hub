import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

const B = '#4B9EFF';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--s-bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8 space-y-6"
        style={{
          background: 'var(--s-card)',
          backdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid var(--s-card-b)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: `${B}18`, border: `1px solid ${B}35` }}
          >
            <div
              className="w-0 h-0"
              style={{
                borderLeft: '9px solid ' + B,
                borderTop: '5.5px solid transparent',
                borderBottom: '5.5px solid transparent',
                marginLeft: '2px',
              }}
            />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold" style={{ color: 'var(--tc-90)' }}>Mission Control</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tc-35)' }}>Amalfi AI · Internal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--tc-45)' }}>
              Email address
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: 'var(--tc-30)' }}
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@amalfiai.com"
                required
                autoFocus
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{
                  background: 'var(--s-input)',
                  border: `1px solid ${error ? '#f87171' : 'var(--s-input-b)'}`,
                  color: 'var(--tc-80)',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium" style={{ color: 'var(--tc-45)' }}>
              Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: 'var(--tc-30)' }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{
                  background: 'var(--s-input)',
                  border: `1px solid ${error ? '#f87171' : 'var(--s-input-b)'}`,
                  color: 'var(--tc-80)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--tc-30)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword
                  ? <EyeOff className="h-3.5 w-3.5" />
                  : <Eye className="h-3.5 w-3.5" />
                }
              </button>
            </div>
            {error && (
              <p className="text-[11px]" style={{ color: '#f87171' }}>{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              background: loading || !email.trim() || !password ? `${B}40` : B,
              color: '#fff',
              cursor: loading || !email.trim() || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
