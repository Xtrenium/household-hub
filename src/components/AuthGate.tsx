import React, { useState } from 'react';
import { Lock, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const AuthGate: React.FC = () => {
  const [email, setEmail] = useState('bkmlscott@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(signInError.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-500/20">
            H
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Household Hub</h1>
            <p className="text-xs text-slate-400">
              Brandon &amp; Meg • Sydney Supabase (ap-southeast-2)
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Strict Household RLS Active:</span> Sign in once on your phone and Meg&apos;s phone. Your session stays persisted automatically, and you can toggle between <strong>Brandon</strong> and <strong>Meg</strong> inside the app.
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="hub-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Household Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="hub-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                placeholder="bkmlscott@gmail.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="hub-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                id="hub-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                placeholder="Enter household password"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
          >
            <Lock className="w-4 h-4" />
            {loading ? 'Unlocking Household Hub...' : 'Sign In to Household Hub'}
          </button>
        </form>
      </div>
    </div>
  );
};
