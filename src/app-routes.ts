import type { AppView } from './types';

export type RouteLayoutMode = 'default' | 'wide' | 'full';

export type AppRouteDefinition = {
  view: AppView;
  path: string;
  navGroup?: string;
  layoutMode?: RouteLayoutMode;
};

export const APP_ROUTES: AppRouteDefinition[] = [
  { view: 'dashboard', path: '/dashboard', layoutMode: 'wide' },
  { view: 'settings-theme-guide', path: '/settings/theme-guide', navGroup: 'settings', layoutMode: 'wide' },
  { view: 'kiriminaja-credentials', path: '/settings/kiriminAja/credentials', navGroup: 'settings', layoutMode: 'wide' },
  { view: 'kiriminaja-rate-calculator', path: '/tools/rates', navGroup: 'tools', layoutMode: 'wide' },
  { view: 'kiriminaja-shipments-dashboard', path: '/shipments', navGroup: 'thirdplil', layoutMode: 'full' },
  { view: 'kiriminaja-shipments-create', path: '/shipments/new', navGroup: 'thirdplil', layoutMode: 'wide' },
  { view: 'kiriminaja-webhooks-log', path: '/admin/webhooks', navGroup: 'thirdplil', layoutMode: 'full' },
  { view: 'kiriminaja-cron-monitor', path: '/admin/crons', navGroup: 'thirdplil', layoutMode: 'full' },
  // PGIL (Payment Gateway)
  { view: 'pgil-transactions', path: '/payments/transactions', navGroup: 'pgil', layoutMode: 'full' },
  { view: 'pgil-credentials', path: '/payments/credentials', navGroup: 'pgil', layoutMode: 'wide' },
  { view: 'pgil-webhooks', path: '/payments/webhooks', navGroup: 'pgil', layoutMode: 'full' },
  { view: 'pgil-api-keys', path: '/payments/api-keys', navGroup: 'pgil', layoutMode: 'wide' },
];

const routeByView = new Map(APP_ROUTES.map((route) => [route.view, route]));

function normalizePathname(pathname: string) {
  if (pathname === '/') return pathname;
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function getRouteByView(view: AppView) {
  return routeByView.get(view);
}

export function getPathForView(view: AppView) {
  return getRouteByView(view)?.path ?? '/dashboard';
}

export function getRouteByPathname(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  return APP_ROUTES.find((route) => route.path === normalizedPathname);
}
