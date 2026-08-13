// LoginPage — gerbang auth v1 (admin email+password). Sensei login UI belum
// dibangun (asumsi #5); role viewer read-only tetap disiapkan di skema.

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { login } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const refresh = useAuthStore((s) => s.refresh);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      await refresh();
      navigate('/timeline', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Periksa email & password.');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-card border border-outline-variant bg-surface-container-lowest p-8 shadow-floating">
        <div className="mb-6 text-center">
          <h1 className="font-headline-md text-headline-md font-bold text-primary">Jadwal Sensei</h1>
          <p className="mt-1 font-body-md text-body-md text-secondary">School Admin — PT Ichikara</p>
        </div>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <Field label="Email" required>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ichikara.co.id"
              required
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded border border-error bg-error-container px-3 py-2 text-on-error-container">
              <Icon name="error" size={16} className="mt-0.5 shrink-0" />
              <p className="font-body-md text-body-md">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Masuk...' : 'Masuk'}
          </Button>
        </form>
      </div>
    </div>
  );
}
