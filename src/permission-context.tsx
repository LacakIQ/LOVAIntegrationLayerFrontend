import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { AppView, UserProfile } from './types';

type PermissionContextValue = {
  loading: boolean;
  ready: boolean;
  error: string | null;
  isSubscriberAdmin: boolean;
  hasActiveRole: boolean;
  permissionCodes: Set<string>;
  activeRoleName: string | null;
  can: (permission: string | null | undefined) => boolean;
  canAny: (permissions: Array<string | null | undefined>) => boolean;
  canAll: (permissions: Array<string | null | undefined>) => boolean;
  reloadPermissions: () => Promise<void>;
};

type PermissionProviderProps = {
  profile: UserProfile | null;
  children: ReactNode;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export const VIEW_PERMISSIONS: Partial<Record<AppView, string>> = {
  'dashboard': 'dashboard.view',
  'kiriminaja-credentials': 'thirdplil.credentials.view',
  'kiriminaja-rate-calculator': 'thirdplil.rates.read',
  'kiriminaja-shipments-dashboard': 'thirdplil.shipments.view',
  'kiriminaja-shipments-create': 'thirdplil.shipments.create',
  'kiriminaja-webhooks-log': 'thirdplil.webhook.view',
  'kiriminaja-cron-monitor': 'thirdplil.webhook.view',
  // PGIL
  'pgil-transactions': 'pgil.transactions.view',
  'pgil-credentials': 'pgil.credentials.view',
  'pgil-webhooks': 'pgil.webhook.view',
  'pgil-api-keys': 'pgil.api_keys.manage',
};

const ALWAYS_ALLOWED_VIEWS = new Set<AppView>(['settings-theme-guide']);

export function getViewPermission(view: AppView): string | null {
  if (ALWAYS_ALLOWED_VIEWS.has(view)) return null;
  return VIEW_PERMISSIONS[view] ?? null;
}

export function PermissionProvider({ profile, children }: PermissionProviderProps) {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubscriberAdmin, setIsSubscriberAdmin] = useState(false);
  const [hasActiveRole, setHasActiveRole] = useState(true);
  const [activeRoleName, setActiveRoleName] = useState<string | null>(null);
  const [permissionCodes, setPermissionCodes] = useState<Set<string>>(new Set());

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace this stub with a call to your actual backend.
      // For DSS this was:
      //   const { data } = await supabase.rpc('get_my_permission_context');
      //   const ctx = data?.[0] ?? null;
      //   setIsSubscriberAdmin(!!ctx?.is_subscriber_admin);
      //   setHasActiveRole(!!ctx?.has_active_role);
      //   setActiveRoleName(ctx?.active_role_name ?? null);
      //   setPermissionCodes(new Set(ctx?.permission_codes ?? []));

      // Stub: always allow everything. Remove once your backend RBAC is in place.
      await new Promise((resolve) => setTimeout(resolve, 80));
      setIsSubscriberAdmin(true);
      setHasActiveRole(true);
      setActiveRoleName('Admin');
      setPermissionCodes(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission context failed to load.');
      setIsSubscriberAdmin(false);
      setHasActiveRole(false);
      setActiveRoleName(null);
      setPermissionCodes(new Set());
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const can = useCallback(
    (permission: string | null | undefined) => {
      if (!permission) return true;
      if (isSubscriberAdmin) return true;
      return permissionCodes.has(permission);
    },
    [isSubscriberAdmin, permissionCodes],
  );

  const canAny = useCallback(
    (permissions: Array<string | null | undefined>) => {
      if (!permissions || permissions.length === 0) return true;
      return permissions.some((p) => can(p));
    },
    [can],
  );

  const canAll = useCallback(
    (permissions: Array<string | null | undefined>) => {
      if (!permissions || permissions.length === 0) return true;
      return permissions.every((p) => can(p));
    },
    [can],
  );

  const value = useMemo<PermissionContextValue>(() => ({
    loading,
    ready,
    error,
    isSubscriberAdmin,
    hasActiveRole,
    permissionCodes,
    activeRoleName,
    can,
    canAny,
    canAll,
    reloadPermissions: loadContext,
  }), [loading, ready, error, isSubscriberAdmin, hasActiveRole, permissionCodes, activeRoleName, can, canAny, canAll, loadContext]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error('usePermissions must be used inside a PermissionProvider.');
  }
  return ctx;
}
