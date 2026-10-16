# Multi-Tab Standard Page Layout Guideline

This document defines the standard design and architectural guidelines for multi-tab setting menus in the application (e.g., **General Setting Addresses**, **App Setting**, **Product Setting**, **Vendor / Principal Setting**, **Customer Setting**, **IMS Warehouses / Inventory Setting**).

---

## 1. Core Layout Principles

### A. Container Layout Structure
A multi-tab settings view consists of three primary components rendered by the parent container view:
1. **Parent Header Card**: General header describing the menu section.
2. **SubTabs Navigation Bar**: Renders available subtabs using the `<SubTabs />` component.
3. **Active Tab View**: Renders the selected tab component (e.g. `<SettingsAddressView />`, `<SettingsVendorAddressesView />`).

### B. List View Mode (`!isFormPage`)
- When viewing any tab in list mode (no `mode` parameter in URL search params):
  - **Parent Header Card** is visible.
  - **Parent SubTabs Bar** is visible.
  - **Active Child Sub-View** renders its own internal header card with the **"Create / Add [Entity]"** button on the top-right side, followed by its `<ServerDataTable />`.

### C. Full-Page Form View Mode (`isFormPage === true`)
- Triggered when URL query parameters contain `mode=create`, `mode=edit`, or `mode=import` for a tab that uses full-page forms (e.g. `Addresses`, `Document Sequences`, `Uom Classes`, `Categories`, `Vendors`, `Vendor Addresses`, `Customers`, `Customer Tiers`, `Sites`, `Warehouses`, `Location List`, `Location Template`).
- **Parent Header Card**: Hidden completely using `{!isFormPage && (...)}`.
- **Parent SubTabs Bar**: Hidden completely using `{!isFormPage && (...)}`.
- **Child View Form**: Renders as a standalone full-page form card (`<form className={STYLES.pageCard}>`) with a top action bar (*Back to list* and *Save*).

### D. Pop-up / Modal Exception
- Tabs that use **Pop-up Modals / Dialogs** instead of full-page forms (e.g., **Brands** & **Attributes** in Product Setting; **Currencies**, **Tax Types & Codes**, **Tax Matrix** in App Setting; **Location Zones**, **Location Groups**, **LPN** in Inventory Setting) **MUST NOT** hide the parent Header Card or parent SubTabs Bar.
- The modal opens directly over the list view while preserving the top header and tabs navigation.

---

## 2. Standard Code Patterns & Reference Implementation

### A. Parent Container View Pattern (`SettingsSalesCustomerView.tsx` / `SettingsGeneralAddressesView.tsx`)

```tsx
import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import SubTabs from '../components/SubTabs';
import type { UserProfile } from '../types';
import SettingsCustomersView from './SettingsCustomersView';
import SettingsCustomerTiersView from './SettingsCustomerTiersView';

type TabId = 'customer' | 'customer_tiers';

const TABS: { id: TabId; label: string }[] = [
  { id: 'customer', label: 'Customer' },
  { id: 'customer_tiers', label: 'Customer Tiers' },
];

export default function SettingsSalesCustomerView({ currentUserProfile, userId }: { currentUserProfile: UserProfile; userId: string | null }) {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = (searchParams.get('tab') as TabId) || 'customer';
  const pageMode = searchParams.get('mode');

  // Full-page form scoping check: Returns true only for tabs that render full-page forms when mode is present
  const isFormPage = (activeTab === 'customer' || activeTab === 'customer_tiers') && Boolean(pageMode);

  const handleTabChange = (tabId: string) => {
    navigate(`?tab=${tabId}`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Parent Header Card (Rendered ONLY when not in form mode) */}
      {!isFormPage && (
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                Sales Data
              </p>
              <h2 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight text-gray-900">
                <Users className="text-blue-600 shrink-0" size={28} />
                Customer
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Master data pelanggan dan tingkatan (tiering) pelanggan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Parent SubTabs Bar (Rendered ONLY when not in form mode) */}
      {!isFormPage && (
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <SubTabs tabs={TABS} active={activeTab} setActive={handleTabChange} />
        </div>
      )}

      {/* 3. Active Tab Content Area */}
      <div>
        {activeTab === 'customer' && (
          <SettingsCustomersView currentUserProfile={currentUserProfile} userId={userId} />
        )}
        {activeTab === 'customer_tiers' && (
          <SettingsCustomerTiersView currentUserProfile={currentUserProfile} userId={userId} />
        )}
      </div>
    </div>
  );
}
```

### B. Child Tab Sub-View Pattern (`SettingsCustomerTiersView.tsx`)

```tsx
export default function SettingsCustomerTiersView({ currentUserProfile, userId }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pageMode = searchParams.get('mode');
  const editId = searchParams.get('id');

  const isFormPage = pageMode === 'create' || (pageMode === 'edit' && Boolean(editId));

  const handleOpenCreate = () => navigate('?tab=customer_tiers&mode=create');
  const handleBackToList = () => navigate('?tab=customer_tiers');

  return (
    <div className="space-y-6">
      {isFormPage ? (
        /* Standalone Full-Page Form View */
        <form onSubmit={handleSave} className={STYLES.pageCard}>
          <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-900">
              {pageMode === 'edit' ? 'Edit Customer Tier' : 'Create Customer Tier'}
            </h3>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleBackToList} className={STYLES.buttonSecondary}>
                Back to list
              </button>
              <button type="submit" className={STYLES.buttonPrimary}>
                Save
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Form Fields */}
          </div>
        </form>
      ) : (
        /* List View: Top Sub-Header Card + Clean ServerDataTable Container */
        <div className="space-y-6">
          <div className={STYLES.pageCard}>
            <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                  Customer Tiers
                </p>
                <h3 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
                  <Layers className="text-blue-600 shrink-0" size={24} />
                  Customer Tier List
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Configure customer segment classifications and priority tiers.
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
                    <span>Create Customer Tier</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <ServerDataTable
              userId={userId}
              tableKey="settings.customer_tiers"
              columns={columns}
              fetchPage={fetchPage}
              emptyLabel="No customer tiers found."
              rowKey={(row) => row.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 3. Checklist for Multi-Tab Pages

- [ ] `isFormPage` in parent container checks `Boolean(pageMode)` only for tabs with full-page forms.
- [ ] Parent Header Card is wrapped in `{!isFormPage && (...)}`.
- [ ] Parent SubTabs Bar is wrapped in `{!isFormPage && (...)}`.
- [ ] Tabs using pop-up modals (e.g., Brands, Attributes, Currencies, Tax Matrix, Location Zones) are excluded from `isFormPage` hiding logic.
- [ ] Child Sub-View list mode renders a Sub-Header Card with the top-right **"Create [Entity]"** button and a separate `<ServerDataTable />` below it.
- [ ] Child Sub-View form mode renders a standalone `<form className={STYLES.pageCard}>` with *Back to list* and *Save* buttons.
- [ ] Navigation callbacks use `navigate('?tab=target_tab&mode=create')` and `navigate('?tab=target_tab')` to preserve tab state in the URL.
