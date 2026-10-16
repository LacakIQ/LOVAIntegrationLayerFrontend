import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Info, Loader2, Mail, ShieldAlert, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPathForView } from '../app-routes';
import SubTabs from '../components/SubTabs';
import { STYLES, Badge, Section, KeyValueRow } from '../components/ui/STYLES.tsx';

type DemoFormState = {
  fullName: string;
  email: string;
  company: string;
  notes: string;
  receiveUpdates: boolean;
  accessLevel: 'viewer' | 'editor' | 'admin';
};

export default function ThemeGuideView() {
  const [demoTab, setDemoTab] = useState('form');
  const [showModal, setShowModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning' | 'danger' | 'info'; message: string } | null>(
    null,
  );
  const [formState, setFormState] = useState<DemoFormState>({
    fullName: '',
    email: '',
    company: '',
    notes: '',
    receiveUpdates: true,
    accessLevel: 'viewer',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sampleTabs = useMemo(() => {
    return [
      { id: 'form', label: 'Form Layout' },
      { id: 'table', label: 'Table + Actions' },
      { id: 'status', label: 'Status UI' },
    ];
  }, []);

  async function handleSubmitDemoForm() {
    setSubmitting(true);
    setFormError(null);
    setBanner(null);

    await new Promise((resolve) => setTimeout(resolve, 600));

    if (!formState.fullName.trim() || !formState.email.trim()) {
      setFormError('Full name and email are required for this demo submit.');
      setSubmitting(false);
      return;
    }

    setBanner({ tone: 'success', message: 'Demo form submitted. This is the success banner style.' });
    setSubmitting(false);
  }

  function openModal() {
    setModalName('');
    setModalError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setModalName('');
    setModalError(null);
  }

  function confirmModal() {
    if (!modalName.trim()) {
      setModalError('This is the modal validation placeholder. Fill in a name to continue.');
      return;
    }

    setShowModal(false);
    setBanner({ tone: 'info', message: `Modal confirmed for: ${modalName}` });
  }

  return (
    <div className="space-y-4">
      <div className={STYLES.pageCard}>
        <div className="border-b border-gray-100 px-6 py-5">
          <p className={STYLES.sectionHeaderKicker}>Theme</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">UI Component Guide</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Use this page as the reference implementation for forms, buttons, status UI, tables, and modal layouts in
            this project. New screens should match these patterns.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-3">
          <KeyValueRow label="Primary Color" value="Blue 600" />
          <KeyValueRow label="Surface" value="White cards on Gray 50 background" />
          <KeyValueRow label="Rounding" value="xl / 2xl / 3xl" />
        </div>
      </div>

      {banner && (
        <div
          className={
            banner.tone === 'success'
              ? STYLES.bannerSuccess
              : banner.tone === 'warning'
                ? STYLES.bannerWarning
                : banner.tone === 'danger'
                  ? STYLES.bannerDanger
                  : STYLES.bannerInfo
          }
        >
          {banner.message}
        </div>
      )}

      <Section
        kicker="Typography"
        title="Text hierarchy"
        subtitle="Headings are bold/track-tight. Subtitles use muted gray-500 with relaxed leading."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <p className={STYLES.sectionHeaderKicker}>Label / Kicker</p>
            <h3 className="text-2xl font-bold tracking-tight text-gray-900">Section headline</h3>
            <p className="text-sm leading-6 text-gray-500">
              Body text uses gray-500 and slightly relaxed line height. Links are blue-600 and underline on hover.
            </p>
            <Link to={getPathForView('settings-theme-guide')} className="text-sm font-semibold text-blue-600 hover:underline">
              Example link
            </Link>
          </div>
          <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">Inline emphasis</p>
            <p className="text-sm leading-6 text-gray-600">
              Use <span className="font-semibold text-gray-900">font-semibold</span> for emphasis and
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-700"> code</span>{' '}
              styling for identifiers.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral" label="Neutral" />
              <Badge tone="info" label="Info" />
              <Badge tone="success" label="Success" />
              <Badge tone="warning" label="Warning" />
              <Badge tone="danger" label="Danger" />
            </div>
          </div>
        </div>
      </Section>

      <Section
        kicker="Buttons"
        title="Primary, secondary, danger"
        subtitle="Actions use rounded-xl, semibold text, and subtle shadow for primary fills."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={STYLES.buttonPrimary} onClick={() => setBanner({ tone: 'info', message: 'Primary action pressed.' })}>
            Primary
          </button>
          <button type="button" className={STYLES.buttonSecondary} onClick={() => setBanner({ tone: 'info', message: 'Secondary action pressed.' })}>
            Secondary
          </button>
          <button type="button" className={STYLES.buttonDanger} onClick={() => setBanner({ tone: 'danger', message: 'Danger action pressed.' })}>
            Danger
          </button>
          <button type="button" className={STYLES.buttonGhost} onClick={() => setBanner({ tone: 'warning', message: 'Ghost action pressed.' })}>
            Ghost
          </button>
          <button type="button" disabled className={STYLES.buttonPrimary}>
            Disabled
          </button>
        </div>
      </Section>

      <Section
        kicker="Tabs"
        title="Sub tabs"
        subtitle="Use the shared SubTabs component for simple in-page sections."
      >
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
          <SubTabs tabs={sampleTabs} active={demoTab} setActive={setDemoTab} />
          <div className="space-y-4 px-6 py-6">
            {demoTab === 'form' ? (
              <div className="space-y-4">
                <div className={STYLES.bannerInfo}>
                  This card demonstrates form layout, field styles, helper text, and validation banners.
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className={STYLES.label}>Full Name</span>
                    <input
                      value={formState.fullName}
                      onChange={(event) => setFormState((previous) => ({ ...previous, fullName: event.target.value }))}
                      placeholder="Jane Doe"
                      className={STYLES.input}
                    />
                    <span className={STYLES.helper}>Use sentence case labels. Keep helper text short.</span>
                  </label>

                  <label className="block space-y-2">
                    <span className={STYLES.label}>Email</span>
                    <div className={STYLES.iconInputWrap}>
                      <Mail size={18} className="text-gray-400" />
                      <input
                        value={formState.email}
                        onChange={(event) => setFormState((previous) => ({ ...previous, email: event.target.value }))}
                        type="email"
                        placeholder="name@company.com"
                        className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                      />
                    </div>
                    <span className={STYLES.helper}>Icon inputs use focus-within ring on the wrapper.</span>
                  </label>

                  <label className="block space-y-2">
                    <span className={STYLES.label}>Company</span>
                    <select
                      value={formState.company}
                      onChange={(event) => setFormState((previous) => ({ ...previous, company: event.target.value }))}
                      className={STYLES.inputMuted}
                    >
                      <option value="">Select a company</option>
                      <option value="pt-cms">PT CMS</option>
                      <option value="pt-supplier">PT Supplier</option>
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className={STYLES.label}>Access Level</span>
                    <div className="grid gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      {(['viewer', 'editor', 'admin'] as const).map((level) => (
                        <label key={level} className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-gray-700">
                            {level === 'viewer' ? 'Viewer' : level === 'editor' ? 'Editor' : 'Admin'}
                          </span>
                          <input
                            type="radio"
                            name="access-level"
                            value={level}
                            checked={formState.accessLevel === level}
                            onChange={() => setFormState((previous) => ({ ...previous, accessLevel: level }))}
                            className="h-4 w-4 accent-blue-600"
                          />
                        </label>
                      ))}
                    </div>
                    <span className={STYLES.helper}>Use radio cards for small option sets.</span>
                  </label>

                  <label className="block space-y-2 md:col-span-2">
                    <span className={STYLES.label}>Notes</span>
                    <textarea
                      value={formState.notes}
                      onChange={(event) => setFormState((previous) => ({ ...previous, notes: event.target.value }))}
                      rows={4}
                      placeholder="Add optional notes..."
                      className={STYLES.input}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={formState.receiveUpdates}
                      onChange={(event) =>
                        setFormState((previous) => ({ ...previous, receiveUpdates: event.target.checked }))
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-gray-700">Receive update emails</span>
                      <span className={STYLES.helper}>Checkboxes align at top with helper text underneath.</span>
                    </span>
                  </label>

                  <div className="flex items-center gap-3">
                    <button type="button" className={STYLES.buttonSecondary} onClick={() => setBanner(null)}>
                      Reset banners
                    </button>
                    <button
                      type="button"
                      className={STYLES.buttonPrimary}
                      disabled={submitting}
                      onClick={handleSubmitDemoForm}
                    >
                      <span className="inline-flex items-center gap-2">
                        {submitting && <Loader2 size={16} className="animate-spin" />}
                        {submitting ? 'Submitting...' : 'Submit sample form'}
                      </span>
                    </button>
                  </div>
                </div>

                {formError && <div className={STYLES.bannerDanger}>{formError}</div>}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-900">Input error state</p>
                    <p className="mt-1 text-sm text-gray-500">Use red borders + red ring for invalid fields.</p>
                    <div className="mt-4 space-y-2">
                      <input className={STYLES.inputError} defaultValue="Invalid value" />
                      <p className="text-xs font-semibold text-red-600">Example inline error message.</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-900">Compact info blocks</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <Info size={18} className="mt-0.5 text-blue-600" />
                        <p className="text-sm text-gray-700">
                          Keep informational copy inside lightly tinted surfaces.
                        </p>
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <Copy size={18} className="mt-0.5 text-gray-500" />
                        <p className="text-sm text-gray-700">Inline icons are typically gray-500 unless semantic.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : demoTab === 'table' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className={STYLES.sectionHeaderKicker}>Table</p>
                    <h4 className="text-lg font-semibold text-gray-900">List with actions</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" className={STYLES.buttonSecondary}>
                      Export
                    </button>
                    <button type="button" className={STYLES.buttonPrimary} onClick={openModal}>
                      Open modal example
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                          User
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                          Role
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                          Status
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        { user: 'jane@company.com', role: 'Admin', tone: 'success' as const, status: 'Active' },
                        { user: 'rano@company.com', role: 'Editor', tone: 'warning' as const, status: 'Pending' },
                        { user: 'guest@company.com', role: 'Viewer', tone: 'neutral' as const, status: 'Invited' },
                      ].map((row) => (
                        <tr key={row.user} className="hover:bg-gray-50">
                          <td className="px-5 py-4 font-medium text-gray-900">{row.user}</td>
                          <td className="px-5 py-4 text-gray-700">{row.role}</td>
                          <td className="px-5 py-4">
                            <Badge tone={row.tone} label={row.status} />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button type="button" className={STYLES.buttonGhost}>
                                Edit
                              </button>
                              <button type="button" className={STYLES.buttonSecondary}>
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-900">Semantic banners</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        <Info size={18} className="mt-0.5 text-blue-600" />
                        Informational hint banner.
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <CheckCircle2 size={18} className="mt-0.5 text-green-600" />
                        Success confirmation banner.
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <AlertTriangle size={18} className="mt-0.5 text-amber-600" />
                        Warning banner for non-blocking issues.
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <XCircle size={18} className="mt-0.5 text-red-600" />
                        Error banner for blocking issues.
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-900">Status strip</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Use small badges for table rows and context indicators.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone="success" label="System Online" />
                      <Badge tone="danger" label="System Offline" />
                      <Badge tone="warning" label="Needs attention" />
                      <Badge tone="info" label="Info" />
                    </div>
                    <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <ShieldAlert size={18} className="mt-0.5 text-amber-600" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Access reminder</p>
                          <p className="mt-1 text-sm text-gray-600">
                            Short messages with an icon help users understand access context.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section
        kicker="Modal"
        title="Header actions pattern"
        subtitle="Cancel + primary action live in the header top-right. Validation placeholder sits under the header row."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">Modal trigger</p>
            <p className="text-sm text-gray-500">This follows the same modal layout used in Company Roles.</p>
          </div>
          <button type="button" onClick={openModal} className={STYLES.buttonPrimary}>
            Open modal
          </button>
        </div>
      </Section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 px-4 py-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/20">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={STYLES.sectionHeaderKicker}>Confirm action</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeModal} className={STYLES.buttonSecondary}>
                    Cancel
                  </button>
                  <button type="button" onClick={confirmModal} className={STYLES.buttonPrimary}>
                    Confirm
                  </button>
                </div>
              </div>
              <div className="mt-4">
                {modalError ? (
                  <div className={STYLES.bannerDanger}>{modalError}</div>
                ) : (
                  <div className="rounded-2xl border border-transparent px-4 py-3 text-sm text-transparent">Placeholder</div>
                )}
              </div>
            </div>

            <div className="space-y-4 px-6 py-6">
              <label className="block space-y-2">
                <span className={STYLES.label}>Name</span>
                <input
                  value={modalName}
                  onChange={(event) => {
                    setModalName(event.target.value);
                    setModalError(null);
                  }}
                  placeholder="Type a name to enable confirmation"
                  className={STYLES.input}
                />
                <span className={STYLES.helper}>This content area scrolls if it grows too tall.</span>
              </label>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Modal body uses padding and gray-50 surfaces for grouped notes.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
