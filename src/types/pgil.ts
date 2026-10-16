// =============================================================================
// PGIL (Payment Gateway IL) — Frontend Types
// =============================================================================

export type ProviderSlug = 'midtrans' | string;

export type TransactionStatus =
  | 'created'
  | 'awaiting_payment'
  | 'capture'
  | 'settlement'
  | 'partial_refund'
  | 'refunded'
  | 'deny'
  | 'cancel'
  | 'expire'
  | 'failed';

export type PaymentChannel =
  | 'credit_card'
  | 'bank_transfer_bca'
  | 'bank_transfer_bri'
  | 'bank_transfer_mandiri'
  | 'bank_transfer_bni'
  | 'bank_transfer_permata'
  | 'echannel_mandiri_bill'
  | 'gopay'
  | 'ovo'
  | 'dana'
  | 'shopeepay'
  | 'qris'
  | 'indomaret'
  | 'alfamart'
  | 'akulaku'
  | 'kredivo'
  | 'other';

export type WebhookDirection = 'inbound_provider' | 'outbound_consumer';

export type WebhookStatus =
  | 'pending'
  | 'retrying'
  | 'delivered'
  | 'permanent_failed';

export interface SubscriberCredential {
  credential_id: number;
  provider_slug: ProviderSlug;
  external_credential_ref: string;
  account_label: string | null;
  is_sandbox: boolean;
  is_default: boolean;
  is_active: boolean;
  synced_at: string | null;
  server_key_masked: string;
  client_key_masked: string;
  last_test_conn_at: string | null;
  last_test_conn_ok: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  brand?: string;
  category?: string;
  merchant_name?: string;
}

export interface Transaction {
  transaction_id: number;
  credential_id: number;
  external_order_ref: string;
  provider_order_id: string | null;
  status: TransactionStatus;
  payment_channel: PaymentChannel | null;
  gross_amount: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  item_details_json: TransactionItem[] | null;
  snap_token: string | null;
  payment_url: string | null;
  fraud_status: string | null;
  meta_jsonb: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  settlement_at: string | null;
}

export interface TransactionStatusHistory {
  history_id: number;
  transaction_id: number;
  previous_status: TransactionStatus | null;
  new_status: TransactionStatus;
  transition_reason: string | null;
  actor: string | null;
  created_at: string;
}

export interface Refund {
  refund_id: number;
  transaction_id: number;
  external_refund_ref: string | null;
  provider_refund_id: string | null;
  amount: number;
  reason: string | null;
  status: string;
  provider_response_jsonb: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  event_id: number;
  subscriber_id: number;
  provider_id: number | null;
  direction: WebhookDirection;
  inbound_event_type: string | null;
  provider_event_id: string | null;
  status: WebhookStatus;
  consumer_slug: string | null;
  outbound_event_type: string | null;
  target_url: string | null;
  raw_payload: Record<string, unknown>;
  attempt_count: number;
  last_attempted_at: string | null;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsumerWebhook {
  wh_id: number;
  consumer_slug: string;
  display_name: string;
  target_url: string;
  is_active: boolean;
  subscribed_events: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ConsumerApiKey {
  key_id: number;
  consumer_slug: string;
  key_prefix: string;
  label: string;
  scopes: string[] | null;
  is_active: boolean;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface PagedListResponse<T> {
  rows: T[];
  total_rows: number;
  page: number;
  per_page: number;
  total_pages: number;
  banner?: BannerState;
}

export type BannerState =
  | { tone: 'info' | 'success' | 'warning' | 'danger'; title: string; body?: string }
  | null;

export interface StandardEnvelope<T> {
  success?: boolean;
  data: T;
  errors?: Array<{ field?: string; message: string; code?: string }>;
  warnings?: string[];
  is_duplicate?: boolean;
  duplicate_of_id?: string | number | null;
  banner?: BannerState;
}
