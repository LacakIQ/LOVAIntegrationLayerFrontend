import { useMemo, type ReactNode } from 'react';

export const STYLES = {
  pageCard: 'rounded-3xl border border-gray-200 bg-white shadow-sm',
  sectionCard: 'rounded-3xl border border-gray-200 bg-white p-6 shadow-sm',
  sectionHeaderKicker: 'text-sm font-semibold uppercase tracking-[0.24em] text-blue-600',
  sectionHeaderTitle: 'mt-2 text-xl font-bold tracking-tight text-gray-900',
  sectionHeaderSubtitle: 'mt-2 text-sm leading-6 text-gray-500',
  label: 'text-sm font-semibold text-gray-700',
  helper: 'text-xs text-gray-500',
  input:
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100',
  inputMuted:
    'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100',
  inputError:
    'w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100',
  iconInputWrap:
    'flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm transition focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100',
  buttonPrimary:
    'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400',
  buttonSecondary:
    'rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50',
  buttonDanger:
    'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400',
  buttonGhost:
    'rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400',
  bannerInfo: 'rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800',
  bannerSuccess: 'rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800',
  bannerWarning: 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800',
  bannerDanger: 'rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
} as const;

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  const className = useMemo(() => {
    switch (tone) {
      case 'success':
        return 'rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700';
      case 'warning':
        return 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700';
      case 'danger':
        return 'rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700';
      case 'info':
        return 'rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700';
      default:
        return 'rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700';
    }
  }, [tone]);
  return <span className={className}>{label}</span>;
}

export function Section({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className={STYLES.sectionCard}>
      <header>
        <p className={STYLES.sectionHeaderKicker}>{kicker}</p>
        <h3 className={STYLES.sectionHeaderTitle}>{title}</h3>
        <p className={STYLES.sectionHeaderSubtitle}>{subtitle}</p>
      </header>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

export function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-2 font-semibold text-gray-900">{value}</p>
    </div>
  );
}
