import { STYLES, KeyValueRow } from '../components/ui/STYLES.tsx';

export default function DashboardView() {
  return (
    <div className="space-y-4">
      <div className={STYLES.pageCard}>
        <div className="border-b border-gray-100 px-6 py-5">
          <p className={STYLES.sectionHeaderKicker}>Overview</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Welcome. Build out your overview KPIs here.
          </p>
        </div>
        <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
          <KeyValueRow label="Active Users" value="—" />
          <KeyValueRow label="Today's Activity" value="—" />
          <KeyValueRow label="System Status" value="Online" />
        </div>
      </div>
    </div>
  );
}
