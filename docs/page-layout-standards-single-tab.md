# Single-Tab Standard Page Layout Guideline

This document defines the standard design and architectural guidelines for single-tab (standalone) settings and master data pages in the application (e.g., **Departments**, **Countries**, **Sites**).

---

## 1. Core Layout Principles

### A. List View Mode (`!isFormPage`)
- **Page Header Card**: Positioned at the top of the page. Displays module kicker, title with icon, subtitle description, and the primary **"Add [Entity]"** button on the top-right side (`flex flex-col md:flex-row md:items-center md:justify-between`).
- **Data Table**: Rendered directly below the Page Header Card inside `<ServerDataTable />` without redundant secondary header cards.

### B. Full-Page Form View Mode (`isFormPage === true`)
- Triggered when URL query parameters indicate `mode=create` or `mode=edit`.
- **Top Header Card**: Hidden completely using `{!isFormPage && (...)}`.
- **Form Card**: Displays a standalone full-page form card (`<form className={STYLES.pageCard}>`) with a top bar containing the form title, a **"Back to list"** secondary button, and a **"Save"** primary button.

### C. Pop-up / Modal Exception
- If an entity's create/edit action is performed via a **Pop-up / Modal Dialog** (e.g., Delete Confirmation Modal or modal dialogs), **do NOT hide** the Page Header Card or table. The modal opens on top of the list view.

---

## 2. Standard Code Pattern & Example

Below is the reference implementation based on `SettingsDepartmentsView.tsx`:

```tsx
import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Building2, Plus, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { usePermissions } from '../permission-context';
import type { UserProfile } from '../types';
import ServerDataTable from '../components/ServerDataTable';

const STYLES = {
  pageCard: 'rounded-3xl border border-gray-200 bg-white shadow-sm',
  sectionHeaderKicker: 'text-sm font-semibold uppercase tracking-[0.24em] text-blue-600',
  buttonPrimary: 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700',
  buttonSecondary: 'rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50',
} as const;

export default function SettingsDepartmentsView({ currentUserProfile, userId }: { currentUserProfile: UserProfile; userId: string | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pageMode = searchParams.get('mode');
  const editId = searchParams.get('id');

  const isFormPage = pageMode === 'create' || (pageMode === 'edit' && Boolean(editId));
  const canCreate = can('settings.department.create');

  const handleOpenCreate = () => navigate(`${location.pathname}?mode=create`);
  const handleBackToList = () => navigate(location.pathname);

  return (
    <div className="space-y-6">
      {/* 1. Top Page Header Card (Rendered only in list mode) */}
      {!isFormPage && (
        <div className={STYLES.pageCard}>
          <div className="border-b border-gray-100 px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className={STYLES.sectionHeaderKicker}>Master Data</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                <Building2 className="text-blue-600" size={28} />
                Departments
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Configure business departments, parent organization hierarchies, and assign department heads.
              </p>
            </div>
            {canCreate && (
              <div>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className={`${STYLES.buttonPrimary} flex items-center gap-2`}
                >
                  <Plus size={16} />
                  Add Department
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Content Area */}
      {isFormPage ? (
        <form onSubmit={handleSave} className={STYLES.pageCard}>
          <div className="border-b border-gray-100 px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Department</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
                  {pageMode === 'edit' ? 'Edit Department' : 'Create Department'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleBackToList} className={STYLES.buttonSecondary}>
                  <ArrowLeft size={16} />
                  Back to list
                </button>
                <button type="submit" className={STYLES.buttonPrimary}>
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            {/* Form Input Fields */}
          </div>
        </form>
      ) : (
        <ServerDataTable
          userId={userId}
          tableKey="settings.department"
          columns={columns}
          fetchPage={fetchPage}
          emptyLabel="No departments found."
          rowKey={(row) => row.id}
        />
      )}
    </div>
  );
}
```

---

## 3. Checklist for Single-Tab Pages

- [ ] Top Header Card has Kicker, Title with Icon, Description, and top-right **"Add [Entity]"** button.
- [ ] Top Header Card is wrapped in `{!isFormPage && (...)}`.
- [ ] Form Mode is evaluated using `const isFormPage = pageMode === 'create' || (pageMode === 'edit' && Boolean(editId));`.
- [ ] Form View renders as a standalone `<form className={STYLES.pageCard}>` with *Back to list* and *Save* buttons.
- [ ] Modal pop-ups (e.g., Delete Modal) do not alter the top Header Card visibility.
