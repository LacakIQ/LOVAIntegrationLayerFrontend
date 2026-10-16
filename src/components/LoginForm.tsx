import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { supabase } from '../utils/supabase';

type LoginFormProps = {
  onSuccess?: () => void;
};

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setPassword('');
    setIsSubmitting(false);
    onSuccess?.();
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white w-full">
      <div className="mx-auto flex min-h-screen max-w-7xl overflow-hidden rounded-none md:px-6 md:py-8">
        <div className="hidden w-full max-w-md flex-col justify-between bg-gray-900 px-10 py-12 md:flex">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold tracking-widest text-white shadow-inner">
                APP
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Project Name</h1>
                <p className="text-sm font-medium text-gray-400">Tagline</p>
              </div>
            </div>

            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">
                Secure Access
              </span>
              <div className="space-y-3">
                <h2 className="text-4xl font-semibold leading-tight text-white">
                  Sign in to continue to your operational dashboard.
                </h2>
                <p className="max-w-sm text-sm leading-6 text-gray-400">
                  Use your registered Supabase email and password to access the app.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 text-sm text-gray-300">
            <div className="rounded-2xl border border-gray-800 bg-gray-950/50 p-4">
              <p className="font-semibold text-white">Realtime-ready platform</p>
              <p className="mt-1 text-gray-400">Supabase auth persists the session in the browser and keeps users signed in across refreshes.</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/50 p-4">
              <p className="font-semibold text-white">Shared visual language</p>
              <p className="mt-1 text-gray-400">The login experience reuses the same dark navigation palette and blue accent from the main application shell.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-10 sm:px-6 lg:px-12 w-full">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-950/5">
            <div className="mb-8 space-y-2">
              <div className="flex items-center gap-3 md:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold tracking-widest text-white shadow-inner">
                  APP
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-gray-900">Project Name</h1>
                  <p className="text-xs font-medium text-gray-500">Tagline</p>
                </div>
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Authentication</p>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Welcome back</h2>
              <p className="text-sm leading-6 text-gray-500">
                Enter your email and password to access the dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-700">Email</span>
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                  <Mail size={18} className="text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-700">Password</span>
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                  <Lock size={18} className="text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </label>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
