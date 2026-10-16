export type AppView =
  | 'dashboard'
  | 'settings-theme-guide'
  | 'in-development-placeholder'
  | 'kiriminaja-credentials'
  | 'kiriminaja-rate-calculator'
  | 'kiriminaja-shipments-dashboard'
  | 'kiriminaja-shipments-create'
  | 'kiriminaja-webhooks-log'
  | 'kiriminaja-cron-monitor'
  | 'pgil-transactions'
  | 'pgil-credentials'
  | 'pgil-webhooks'
  | 'pgil-api-keys';

export interface UserProfile {
  full_name: string | null;
  timezone_id: number | null;
  subscriber_id: number | null;
  subscriber_role: 'subscriber_admin' | 'subscriber_user' | null;
  active_company_membership_role_id: number | null;
}
