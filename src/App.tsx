import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  Bell,
  Calculator,
  ChevronDown,
  CreditCard,
  Home,
  KeyRound,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  Settings,
  ShieldAlert,
  Truck,
  User,
  Webhook,
} from 'lucide-react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { RouteLayoutMode } from './app-routes';
import { APP_ROUTES, getPathForView, getRouteByPathname } from './app-routes';
import LoginForm from './components/LoginForm';
import { PermissionProvider, getViewPermission, usePermissions } from './permission-context';
import type { AppView, UserProfile } from './types';
import { useAuth } from './useAuth';

const DashboardView = lazy(() => import('./views/DashboardView'));
const ThemeGuideView = lazy(() => import('./views/ThemeGuideView'));
const CredentialsKiriminAjaView = lazy(() => import('./views/thirdplil/CredentialsKiriminAjaView'));
const RateCalculatorView = lazy(() => import('./views/thirdplil/RateCalculatorView'));
const ShipmentsDashboardView = lazy(() => import('./views/thirdplil/ShipmentsDashboardView'));
const ShipmentCreateWizardView = lazy(() => import('./views/thirdplil/ShipmentCreateWizardView'));
const WebhookEventLogView = lazy(() => import('./views/thirdplil/WebhookEventLogView'));
const CronMonitorView = lazy(() => import('./views/thirdplil/CronMonitorView'));
// PGIL views
const PgilTransactionsView = lazy(() => import('./views/pgil/TransactionsView'));
const PgilCredentialsView = lazy(() => import('./views/pgil/CredentialsView'));
const PgilWebhooksView = lazy(() => import('./views/pgil/WebhooksView'));
const PgilApiKeysView = lazy(() => import('./views/pgil/ApiKeysView'));

type NavigationChild = {
  id: string;
  name: string;
  icon?: React.ElementType;
  view?: AppView;
  permission?: string;
  children?: NavigationChild[];
};

type NavigationItem = {
  id: string;
  name: string;
  icon: React.ElementType;
  view?: AppView;
  permission?: string;
  children?: NavigationChild[];
};

function clearSupabaseBrowserSession() {
  const stores = [window.localStorage, window.sessionStorage];
  for (const store of stores) {
    const keysToRemove: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (!key) continue;
      if (key.startsWith('sb-') || key.includes('supabase')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => store.removeItem(key));
  }
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6 text-white">
      <div className="rounded-3xl border border-gray-800 bg-gray-900 px-8 py-10 text-center shadow-2xl shadow-gray-950/40">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold tracking-widest shadow-inner">
          APP
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-300">Workspace</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Loading dashboard</h1>
        <p className="mt-2 text-sm text-gray-400">{message}</p>
      </div>
    </div>
  );
}

function PermissionLoadingPanel() {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Permissions</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">Loading access context</h2>
      <p className="mt-2 text-sm text-gray-500">Checking your active role before opening the selected page.</p>
    </div>
  );
}

function RouteChunkLoadingPanel() {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Page</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">Loading route content</h2>
      <p className="mt-2 text-sm text-gray-500">Fetching the selected page module.</p>
    </div>
  );
}

function AccessDeniedPanel({ title, description, showProfileLink = false }: {
  title: string;
  description: string;
  showProfileLink?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-white px-8 py-10 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <ShieldAlert size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">403</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">{description}</p>
          {showProfileLink && (
            <div className="mt-5">
              <Link to={getPathForView('settings-theme-guide')}
                className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
                Open Profile Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotFoundPanel() {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-500">404</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">Page not found</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
        The requested page does not exist.
      </p>
      <div className="mt-5">
        <Link to={getPathForView('dashboard')}
          className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function getFirstAccessibleView(can: (permission: string | null | undefined) => boolean): AppView {
  const preferredViews: AppView[] = [
    'dashboard',
    'kiriminaja-shipments-dashboard',
    'kiriminaja-shipments-create',
    'kiriminaja-rate-calculator',
    'settings-theme-guide',
  ];
  const nextView = preferredViews.find((view) => can(getViewPermission(view)));
  return nextView ?? 'settings-theme-guide';
}

function getFirstAccessiblePath(can: (permission: string | null | undefined) => boolean) {
  return getPathForView(getFirstAccessibleView(can));
}

function DefaultRouteRedirect() {
  const { loading, ready, can } = usePermissions();
  if (loading || !ready) return <PermissionLoadingPanel />;
  return <Navigate to={getFirstAccessiblePath(can)} replace />;
}

function ProtectedPage({ view, children }: { view: AppView; children: React.ReactNode }) {
  const { loading, ready, can } = usePermissions();
  const requiredPermission = getViewPermission(view);
  if (requiredPermission && (loading || !ready)) return <PermissionLoadingPanel />;
  if (!can(requiredPermission)) {
    return (
      <AccessDeniedPanel
        title="You do not have access to this page"
        description="Your current role does not include the required permission for this route."
      />
    );
  }
  return <Suspense fallback={<RouteChunkLoadingPanel />}>{children}</Suspense>;
}

function AppShell({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { loading: permissionLoading, ready: permissionReady, error: permissionError, can, reloadPermissions } = usePermissions();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({ settings: true, thirdplil: true, tools: true });
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const currentRoute = useMemo(() => getRouteByPathname(location.pathname), [location.pathname]);
  const currentView = currentRoute?.view ?? null;
  const layoutMode: RouteLayoutMode = currentRoute?.layoutMode ?? 'wide';
  const displayName = 'Signed in user';
  const userInitial = displayName.charAt(0).toUpperCase() || 'U';

  const navigation = useMemo<NavigationItem[]>(() => [
    { id: 'dashboard', name: 'Dashboard', icon: Home, view: 'dashboard', permission: 'dashboard.view' },
    {
      id: 'thirdplil', name: 'ThirdPLIL', icon: Truck,
      children: [
        { id: 'thirdplil-shipments-dashboard', name: 'Shipments Dashboard', icon: Package, view: 'kiriminaja-shipments-dashboard', permission: 'thirdplil.shipments.view' },
        { id: 'thirdplil-shipments-create', name: 'Create Shipment', icon: PlusCircle, view: 'kiriminaja-shipments-create', permission: 'thirdplil.shipments.create' },
        { id: 'thirdplil-webhooks-admin', name: 'Webhook Admin', icon: Webhook, view: 'kiriminaja-webhooks-log', permission: 'thirdplil.webhook.view' },
        { id: 'thirdplil-cron-monitor', name: 'Cron Monitor', icon: Bell, view: 'kiriminaja-cron-monitor', permission: 'thirdplil.webhook.view' },
      ],
    },
    {
      id: 'tools', name: 'Tools', icon: Calculator,
      children: [
        { id: 'tools-rate-calculator', name: 'Rate Calculator', view: 'kiriminaja-rate-calculator', permission: 'thirdplil.rates.read' },
      ],
    },
    {
      id: 'settings', name: 'Setting', icon: Settings,
      children: [
        { id: 'settings-theme-guide', name: 'Theme Guide', view: 'settings-theme-guide' },
        { id: 'settings-kiriminaja-credentials', name: 'Credentials (Logistics)', view: 'kiriminaja-credentials', permission: 'thirdplil.credentials.view' },
      ],
    },
    {
      id: 'pgil', name: 'Payment Gateway', icon: CreditCard,
      children: [
        { id: 'pgil-transactions', name: 'Transactions', icon: Package, view: 'pgil-transactions', permission: 'pgil.transactions.view' },
        { id: 'pgil-credentials', name: 'Credentials (Read-Only)', icon: ShieldAlert, view: 'pgil-credentials', permission: 'pgil.credentials.view' },
        { id: 'pgil-webhooks', name: 'Webhooks', icon: Webhook, view: 'pgil-webhooks', permission: 'pgil.webhook.view' },
        { id: 'pgil-api-keys', name: 'API Keys', icon: KeyRound, view: 'pgil-api-keys', permission: 'pgil.api_keys.manage' },
      ],
    },
  ], []);

  const visibleNavigation = useMemo(() =>
    navigation.map((item) => {
      const filterChildren = (children?: NavigationChild[]): NavigationChild[] | undefined => {
        if (!children) return undefined;
        const filtered = children.map((child) => {
          const subChildren = filterChildren(child.children);
          const hasSub = (subChildren?.length ?? 0) > 0;
          const childVisible = child.permission ? can(child.permission) : (child.view ? true : hasSub);
          if (!childVisible) return null;
          return { ...child, children: subChildren };
        }).filter(Boolean) as NavigationChild[];
        return filtered.length > 0 ? filtered : undefined;
      };
      const visibleChildren = filterChildren(item.children);
      const itemVisible = item.view ? can(item.permission) : (visibleChildren?.length ?? 0) > 0;
      if (!itemVisible) return null;
      return { ...item, children: visibleChildren };
    }).filter(Boolean) as NavigationItem[],
    [can, navigation]);

  const contentWidthClass =
    layoutMode === 'full' ? 'w-full min-w-0 space-y-4'
    : layoutMode === 'wide' ? 'mx-auto w-full max-w-[1600px] min-w-0 space-y-4'
    : 'mx-auto w-full max-w-6xl min-w-0 space-y-4';

  function toggleNavItem(itemId: string) {
    setExpandedItems((previous) => ({ ...previous, [itemId]: !previous[itemId] }));
  }

  function handleOpenProfile() {
    setProfileMenuOpen(false);
    navigate(getPathForView('settings-theme-guide'));
  }

  async function handleSignOut() {
    setProfileMenuOpen(false);
    await onSignOut();
  }

  function renderView(view: AppView) {
    switch (view) {
      case 'dashboard': return <DashboardView />;
      case 'settings-theme-guide': return <ThemeGuideView />;
      case 'kiriminaja-credentials': return <CredentialsKiriminAjaView />;
      case 'kiriminaja-rate-calculator': return <RateCalculatorView />;
      case 'kiriminaja-shipments-dashboard': return <ShipmentsDashboardView />;
      case 'kiriminaja-shipments-create': return <ShipmentCreateWizardView />;
      case 'kiriminaja-webhooks-log': return <WebhookEventLogView />;
      case 'kiriminaja-cron-monitor': return <CronMonitorView />;
      case 'pgil-transactions': return <PgilTransactionsView />;
      case 'pgil-credentials': return <PgilCredentialsView />;
      case 'pgil-webhooks': return <PgilWebhooksView />;
      case 'pgil-api-keys': return <PgilApiKeysView />;
      default: return null;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      <div className={(sidebarHidden ? 'hidden ' : 'hidden md:flex ') + 'w-64 flex-shrink-0 flex-col bg-gray-900 text-white'}>
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold tracking-widest text-white shadow-inner">
            APP
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Project Name</h1>
            <p className="text-xs font-medium text-gray-400">Tagline</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {permissionLoading ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-800/70 px-4 py-4 text-sm text-gray-300">
              Loading menu permissions...
            </div>
          ) : (
            visibleNavigation.map((item) => {
              const hasChildren = (item.children?.length ?? 0) > 0;
              const isExpanded = expandedItems[item.id] ?? false;
              const isActive = item.view === currentView || item.children?.some((child) => child.view === currentView) === true;
              const Icon = item.icon;
              return (
                <div key={item.id} className="space-y-1">
                  {hasChildren ? (
                    <button type="button" onClick={() => toggleNavItem(item.id)}
                      className={'w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors '
                        + (isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:bg-gray-800 hover:text-white')}>
                      <span className="flex items-center justify-between">
                        <span className="flex items-center gap-3">
                          <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                          {item.name}
                        </span>
                        <ChevronDown size={16} className={'transition-transform ' + (isExpanded ? 'rotate-180' : '')} />
                      </span>
                    </button>
                  ) : item.view ? (
                    <NavLink to={getPathForView(item.view)}
                      className={({ isActive: routeActive }) =>
                        'block w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors '
                        + (routeActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:bg-gray-800 hover:text-white')}>
                      <span className="flex items-center gap-3">
                        <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                        {item.name}
                      </span>
                    </NavLink>
                  ) : null}

                  {hasChildren && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-gray-700 pl-3">
                      {item.children?.map((child) => {
                        if (!child.view) return null;
                        const ChildIcon = child.icon;
                        return (
                          <NavLink key={child.id} to={getPathForView(child.view)}>
                            {({ isActive: routeActive }) => (
                              <span
                                className={
                                  'block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors '
                                  + (routeActive ? 'bg-gray-800 font-semibold text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white')
                                }
                              >
                                <span className="flex items-center gap-3">
                                  {ChildIcon && (
                                    <ChildIcon size={16} className={routeActive ? 'text-white' : 'text-gray-500'} />
                                  )}
                                  {child.name}
                                </span>
                              </span>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <div className="border-t border-gray-800 p-4 text-xs text-gray-500">
          v1.0.0
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSidebarHidden((hidden) => !hidden)}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label={sidebarHidden ? 'Show navigation' : 'Hide navigation'}>
              <Menu />
            </button>
            <h2 className="hidden font-semibold text-gray-800 sm:block">Company Name</h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-400 transition-colors hover:text-gray-600">
              <Bell size={20} />
            </button>
            <div className="relative">
              <button type="button" onClick={() => setProfileMenuOpen((open) => !open)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:bg-gray-50">
                <div className="hidden flex-col items-end sm:flex">
                  <span className="text-sm font-semibold text-gray-800">{displayName}</span>
                  <span className="text-xs text-gray-500">Signed in</span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-100 font-bold text-blue-700">
                  {userInitial}
                </div>
                <ChevronDown size={16} className={'text-gray-400 transition-transform ' + (profileMenuOpen ? 'rotate-180' : '')} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white py-2 shadow-xl shadow-gray-950/10">
                  <button type="button" onClick={handleOpenProfile}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                    <User size={16} /> Profile
                  </button>
                  <button type="button" onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className={contentWidthClass}>
            {permissionError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Permission context could not be loaded: {permissionError}
              </div>
            )}
            <Routes>
              <Route path="/" element={<DefaultRouteRedirect />} />
              {APP_ROUTES.map((route) => (
                <Route key={route.view} path={route.path}
                  element={
                    <ProtectedPage view={route.view}>
                      {renderView(route.view)}
                    </ProtectedPage>
                  } />
              ))}
              <Route path="*" element={<NotFoundPanel />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { session, loading: authLoading } = useAuth();

  async function handleSignOut() {
    const { supabase } = await import('./utils/supabase');
    await supabase.auth.signOut({ scope: 'global' });
    clearSupabaseBrowserSession();
  }

  if (authLoading) {
    return <LoadingScreen message="Authenticating your session..." />;
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6 text-white">
        <LoginForm />
      </div>
    );
  }

  return (
    <PermissionProvider profile={null}>
      <AppShell onSignOut={handleSignOut} />
    </PermissionProvider>
  );
}
