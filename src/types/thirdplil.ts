export type AppView =
  | 'dashboard'
  | 'settings-theme-guide'
  | 'in-development-placeholder'
  | 'kiriminaja-credentials'
  | 'kiriminaja-rate-calculator'
  | 'kiriminaja-shipments-dashboard'
  | 'kiriminaja-shipments-create'
  | 'kiriminaja-webhooks-log';

export type EnvToggle = 'production' | 'sandbox';
export type CredentialEnvFilter = 'all' | EnvToggle;
export type ProviderSlug = 'kiriminaja' | 'jagopaket' | 'nindya' | string;
export type CoverageAreaLevel = 'province' | 'city' | 'district' | 'subdistrict';
export type CourierServiceType = 'parcel_domestic' | 'parcel_international' | 'document' | 'cold_chain' | 'heavy_cargo';
export type CourierServiceTier = 'economy' | 'regular' | 'express' | 'same_day' | 'next_day' | 'cargo' | 'international';

export type ShipmentStatus =
  | 'draft'
  | 'provider_submitted'
  | 'awb_assigned'
  | 'pickup_requested'
  | 'pickup_scheduled'
  | 'courier_picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'attempt_failed'
  | 'delivered'
  | 'return_in_progress'
  | 'returned'
  | 'problem_pending'
  | 'problem_resolved'
  | 'canceled'
  | 'lost'
  | 'damaged';

export type PackageDimensionUom = 'cm' | 'mm';
export type PickupWindowStatus = 'available' | 'full' | 'cutoff_passed' | 'suspended';
export type WebhookEventDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'failed'
  | 'replayed'
  | 'dead_letter'
  | 'skipped'
  | 'dedup';

export type PermissionCode =
  | 'thirdplil.credentials.view'
  | 'thirdplil.credentials.edit'
  | 'thirdplil.rates.read'
  | 'thirdplil.shipments.view'
  | 'thirdplil.shipments.create'
  | 'thirdplil.shipments.cancel'
  | 'thirdplil.shipments.awb_label.read'
  | 'thirdplil.pickup.schedule'
  | 'thirdplil.webhook.view'
  | 'thirdplil.webhook.consumers.edit'
  | 'thirdplil.webhook.secret.regenerate'
  | 'thirdplil.webhook.replay';

export type ConsumerWebhookEventType =
  | 'shipment.created'
  | 'shipment.status_changed'
  | 'shipment.quoted'
  | 'shipment.awaiting_payment'
  | 'shipment.paid'
  | 'shipment.payment_failed'
  | 'shipment.awb_assigned'
  | 'shipment.canceled'
  | 'shipment.lost'
  | 'shipment.damaged'
  | 'shipment.problem'
  | 'pickup.scheduled'
  | 'pickup.driver_assigned'
  | 'pickup.enroute'
  | 'pickup.completed'
  | 'pickup.canceled'
  | 'delivery.out_for_delivery'
  | 'delivery.delivered'
  | 'delivery.returned'
  | 'return.requested'
  | 'return.in_transit'
  | 'return.delivered'
  | 'consumer.test_ping'
  | string;

export interface ThirdPLILCoverageArea {
  id: number;
  level: CoverageAreaLevel;
  parent_id: number | null;
  code: string;
  name: string;
  full_path?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface CourierServiceCache {
  id?: number;
  provider_id?: number;
  courier_code?: string | null;       // 'jne', 'jnt', etc. — 3PL identifier
  courier_name?: string | null;       // 'JNE', 'J&T', etc. — 3PL display name
  service_code: string;               // 'REG', 'YES', etc. — service tier within courier
  service_name: string;               // 'Regular (2-3 hari)' — full service name
  service_type?: CourierServiceType;
  service_tier?: CourierServiceTier;
  etd_days_min?: number;
  etd_days_max?: number;
  volumetric_divisor_kgm3?: number;
  insurance_percent_premium?: string;
  insurance_min_fee_idr?: string;
  cod_percent_fee?: string;
  cod_min_fee_idr?: string;
  is_active?: boolean;
}

export interface SubscriberCredential {
  id: number;
  subscriber_id: number;
  provider_id: number;
  provider_slug: ProviderSlug;
  is_sandbox: boolean;
  is_default: boolean;
  account_label: string;
  /** KA `request_pickup` order_id prefix registered on the KA account (Dashboard > Integrasi). */
  order_id_prefix?: string | null;
  api_user?: string | null;
  api_url_base?: string | null;
  credit_balance_idr?: string | null;
  credit_updated_at?: string | null;
  callback_url?: string | null;
  ka_callback_registered_at?: string | null;
  ka_callback_register_ok?: boolean | null;
  ka_callback_register_message?: string | null;
  /** True when an encrypted KA credit PIN is stored for this credential (value itself is never returned). */
  has_ka_credit_pin?: boolean | null;
  ka_credit_pin_set_at?: string | null;
  webhook_shared_secret_hash?: string | null;
  last_test_conn_at?: string | null;
  last_test_conn_ok?: boolean | null;
}

export interface RateDimension {
  origin_subdistrict_id: number;
  destination_subdistrict_id: number;
  weight_g: number;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  declared_value_idr?: string | null;
  cod_amount_idr?: string | null;
  is_cold_chain?: boolean;
  is_heavy_cargo?: boolean;
}

export interface RateQuote {
  provider_slug: ProviderSlug;
  provider_credential_id: number;
  credential_id?: number;
  is_sandbox?: boolean;
  courier_code?: string | null;         // 'jne', 'jnt', 'gosend', 'sicepat' — the 3PL identifier
  courier_name?: string | null;         // 'JNE', 'J&T', 'GoSend' — 3PL display name
  courier_service_code: string;         // 'REG', 'YES', 'INSTANT' — service tier within courier
  courier_service_name: string;         // 'Regular (2-3 hari)' — full service name
  service_tier: CourierServiceTier;     // normalized tier grouping
  etd_days_min: number;
  etd_days_max: number;
  billed_weight_g: number;
  base_fee_idr: string;
  insurance_fee_idr?: string | null;
  cod_fee_idr?: string | null;
  platform_service_fee_idr?: string | null;
  grand_total_idr: string;
  supports_cod?: boolean;
  supports_insurance?: boolean;
  can_pickup_today?: boolean;
  raw_quote_ref?: unknown;
}

export interface PickupWindowOption {
  window_id: string;
  date_local: string;
  start_time: string;
  end_time: string;
  status: PickupWindowStatus;
  cut_off_time_local?: string | null;
  driver_note_max_chars?: number | null;
  fee_idr?: string | null;
  capacity_remaining_pct?: number | null;
}

export interface PackageItemRow {
  sku?: string | null;
  name: string;
  qty: number;
  unit_value_idr: string;
  line_value_idr?: string;
  hs_code?: string | null;
  is_fragile?: boolean;
}

export interface PackageWithItems {
  package_seq_no?: number | null;
  actual_weight_g: number;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  volumetric_weight_g?: number | null;
  billed_weight_g?: number | null;
  description?: string | null;
  items: PackageItemRow[];
}

export interface ShipmentHeader {
  shipment_id: number;
  id?: number;
  subscriber_id: number;
  credential_id: number;
  provider_credential_id?: number;
  provider_slug?: ProviderSlug;
  provider_id?: number;
  is_sandbox?: boolean;
  transaction_id: string;
  status: ShipmentStatus;
  courier_service_code?: string | null;
  courier_service_name?: string | null;
  courier_code?: string | null;         // 3PL identifier ('jne', 'jnt', etc.)
  courier_name?: string | null;         // 3PL display name ('JNE', 'J&T', etc.)
  provider_order_id?: string | null;    // KA internal order_id (for tracking/cancel)
  partner_order_ids?: string[] | null;
  awb_no?: string | null;
  awb_label_storage?: string | null;
  sender_subdistrict_id: number;
  sender_kecamatan_area_id?: number | null;
  sender_zipcode?: string | null;
  sender_latitude?: number | null;
  sender_longitude?: number | null;
  recipient_subdistrict_id: number;
  recipient_kecamatan_area_id?: number | null;
  recipient_zipcode?: string | null;
  recipient_latitude?: number | null;
  recipient_longitude?: number | null;
  sender_address: string;
  sender_contact_name?: string | null;
  sender_name?: string | null;
  sender_contact_phone?: string | null;
  sender_phone?: string | null;
  sender_contact_email?: string | null;
  recipient_address: string;
  recipient_contact_name?: string | null;
  recipient_name?: string | null;
  recipient_contact_phone?: string | null;
  recipient_phone?: string | null;
  recipient_contact_email?: string | null;
  payment_method?: 'ka_credit' | 'postpaid' | 'cod' | 'shipper_prepaid';
  ka_pin_was_used?: boolean;
  total_packages: number;
  total_actual_weight_g: number;
  total_billed_weight_g: number;
  grand_total_idr?: string | null;
  grand_total_fee_idr?: string | null;
  base_shipping_fee_idr?: string | null;
  cod_amount_idr?: string | null;
  insurance_fee_idr?: string | null;
  is_insurance_enabled?: boolean;
  platform_service_fee_idr?: string | null;
  pickup_window_id?: string | null;
  pickup_date_local?: string | null;
  pickup_start_time?: string | null;
  pickup_end_time?: string | null;
  pickup_driver_note?: string | null;
  provider_data?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  delivered_at?: string | null;
  // Compatibility aliases for older screens still using origin_/destination_ names.
  origin_subdistrict_id?: number;
  destination_subdistrict_id?: number;
  origin_address_line?: string;
  origin_contact_name?: string;
  origin_contact_phone?: string;
  origin_contact_email?: string | null;
  destination_address_line?: string;
  destination_contact_name?: string;
  destination_contact_phone?: string;
  destination_contact_email?: string | null;
}

export interface ShipmentDetail extends ShipmentHeader {
  packages: PackageWithItems[];
}

export interface CreateShipmentRequest {
  credential_id?: number | null;
  provider_slug?: ProviderSlug;
  is_sandbox?: boolean;
  transaction_id?: string | null;
  external_ref?: string | null;
  external_order_ref?: string | null;
  origin_subdistrict_id: number;
  origin_kecamatan_area_id?: number | null;
  origin_address_line: string;
  origin_contact_name: string;
  origin_contact_phone: string;
  origin_contact_email?: string | null;
  origin_zipcode?: string | null;
  origin_latitude?: number | null;
  origin_longitude?: number | null;
  destination_subdistrict_id: number;
  destination_kecamatan_area_id?: number | null;
  destination_address_line: string;
  destination_contact_name: string;
  destination_contact_phone: string;
  destination_contact_email?: string | null;
  destination_zipcode?: string | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  selected_courier_service_code: string;
  payment_method?: ShipmentHeader['payment_method'];
  ka_credit_pin?: string | null;
  base_shipping_fee_idr?: string | null;
  cod_amount_idr?: string | null;
  declared_value_total_idr?: string | null;
  is_insurance_enabled?: boolean;
  pickup_window_id?: string | null;
  pickup_date_local?: string | null;
  pickup_start_time?: string | null;
  pickup_end_time?: string | null;
  pickup_driver_note?: string | null;
  packages: PackageWithItems[];
}

export interface TransitionStatusResponse {
  ok: boolean;
  shipment_id: number;
  prior_status: ShipmentStatus;
  new_status: ShipmentStatus;
  skipped: boolean;
  skip_reason?: string | null;
  history_id?: number | null;
  webhooks_enqueued?: number | null;
}

export interface InboundWebhookEvent {
  id: number;
  provider_id: number;
  provider_event_id: string;
  provider_ref_no?: string | null;
  awb_no?: string | null;
  raw_status?: string | null;
  mapped_status?: ShipmentStatus | null;
  raw_headers_jsonb?: unknown;
  raw_body_jsonb?: unknown;
  occurred_at: string;
  received_at: string;
  subscriber_id: number;
}

export interface ConsumerWebhookRegistration {
  id: number;
  subscriber_id: number;
  description?: string | null;
  endpoint_url: string;
  hmac_secret_masked?: string | null;
  subscribe_event_names?: ConsumerWebhookEventType[] | null;
  is_active?: boolean;
  extra_headers_jsonb?: unknown;
  last_delivery_at?: string | null;
  last_http_status?: number | null;
  total_deliveries?: number | null;
  total_failures?: number | null;
  consecutive_failures?: number | null;
  last_error_message?: string | null;
  paused_until_at?: string | null;
  created_at?: string | null;
}

export interface AdminWebhookEvent {
  id: number;
  event_name: string;
  direction: 'inbound' | 'outbound';
  shipment_id?: number | null;
  consumer_id?: number | null;
  received_at?: string | null;
  delivery_status?: WebhookEventDeliveryStatus | null;
  attempts_count?: number | null;
  max_attempts?: number | null;
  last_http_status?: number | null;
  delivery_http_status?: number | null;
  next_retry_at?: string | null;
  created_at?: string | null;
}

export interface AdminWebhookDLQEntry {
  id: number;
  consumer_id: number;
  shipment_id?: number | null;
  event_name: string;
  attempts_count: number;
  max_attempts?: number | null;
  last_error_message?: string | null;
  error_reason?: string | null;
  last_delivery_at?: string | null;
  last_http_status?: number | null;
  last_response_snippet?: string | null;
}

export interface PagedListResponse<T> {
  rows: T[];
  total_rows: number;
  page: number;
  per_page: number;
  total_pages: number;
  banner?: BannerState;
  warnings?: string[] | null;
}

export type IntegrationLayerModule = 'thirdplil' | 'pgil';

export interface CronMonitorPgCronJob {
  module: IntegrationLayerModule;
  job_id: number;
  job_name: string;
  schedule: string;
  active: boolean;
  command: string;
  last_run_status?: string | null;
  last_return_message?: string | null;
  last_started_at?: string | null;
  last_finished_at?: string | null;
}

export interface CronMonitorScheduledWorker {
  module: IntegrationLayerModule;
  function_name: string;
  expected_schedule: string;
  status_source: 'scheduled_edge_function';
  description: string;
  monitor_note: string;
}

export interface CronMonitorOverview {
  generated_at: string;
  pg_cron_jobs: CronMonitorPgCronJob[];
  scheduled_edge_workers: CronMonitorScheduledWorker[];
}

export interface StandardError {
  code: string;
  message: string;
  field?: string | null;
  http_status: number;
}

export interface StandardEnvelope<T> {
  success: boolean;
  data?: T | null;
  errors?: StandardError[] | null;
  is_duplicate?: boolean | null;
  duplicate_of_id?: number | string | null;
  warnings?: string[] | null;
}

export interface BannerMessage {
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  body?: string | null;
}

export type BannerStateSetter = React.Dispatch<React.SetStateAction<BannerMessage | null>>;

export type BannerState = BannerMessage | null;
