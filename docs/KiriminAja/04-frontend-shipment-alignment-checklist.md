# KiriminAja Frontend Shipment Alignment Checklist

Purpose: lock the frontend work needed so `LOVAIntegrationLayerFrontend` matches the current ThirdPLIL KiriminAja backend contract before and during implementation.

## File Targets

- `src/types/thirdplil.ts`
- `src/utils/thirdplilApi.ts`
- `src/views/thirdplil/ShipmentCreateWizardView.tsx`
- `src/views/thirdplil/ShipmentsDashboardView.tsx`
- `src/components/thirdplil/ShipmentDetailDrawer.tsx`

## Required Changes

- Align `ShipmentStatus` to the backend's 17 canonical statuses.
- Keep wire names as `origin_*`, `destination_*`, and `selected_courier_service_code`.
- Extend `CreateShipmentRequest` with:
  - `origin_kecamatan_area_id`
  - `origin_zipcode`
  - `origin_latitude`
  - `origin_longitude`
  - `destination_kecamatan_area_id`
  - `destination_zipcode`
  - `destination_latitude`
  - `destination_longitude`
  - `base_shipping_fee_idr`
  - `external_ref`
  - `external_order_ref`
- Update shipment types to the real backend row shape:
  - `shipment_id`
  - `credential_id`
  - `sender_*`
  - `recipient_*`
  - `packages: thirdplil_shipment_packages(items: thirdplil_shipment_items)`
- Treat `POST /shipments` as create + provider booking.
- Support success without immediate AWB:
  - `status = provider_submitted`
  - warning that AWB is pending webhook/polling
- Update AWB label consumer to use hosted URL response:
  - `{ url, awb_no, provider }`
- Ensure `is_sandbox` is not hardcoded false when a real environment toggle/credential selection exists.
- Keep `X-ThirdPLIL-Transaction-ID` idempotency behavior; avoid conflicting empty body `transaction_id`.
- Preserve KA credit PIN as ephemeral only.

## UI / UX Behaviors To Fix

- Shipment create wizard must send the selected quote's `base_fee_idr` as `base_shipping_fee_idr`.
- Shipment create wizard must provide sender/recipient district, zipcode, and lat/long.
- Shipment create success banner must distinguish:
  - booking accepted with AWB assigned
  - booking accepted but AWB pending
- Shipment dashboard status badges/labels must match the new backend enum.
- Shipment detail drawer must read the new shipment field names and timeline shape.
- AWB button/open flow must use the hosted URL returned by the backend, not storage-object assumptions.

## Execution Order

1. Types
2. API response consumers
3. Shipment create wizard payload + submit/result flow
4. Shipments dashboard status/AWB handling
5. Shipment detail drawer field mapping
6. Changelogs
