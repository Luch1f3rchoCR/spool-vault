export type RollStatus = "new" | "open" | "low" | "empty" | "archived";
export type PackageType = "spooled" | "refill";
export type SpoolStatus = "empty" | "in_use" | "reserved" | "retired";
export type TareConfidence = "verified" | "estimated" | "unknown";

export type FilamentRoll = {
  id: string;
  brand: string;
  product_line: string | null;
  material: string;
  color_name: string;
  color_hex: string;
  initial_weight_g: number;
  available_weight_g: number;
  low_threshold_g: number;
  status: RollStatus;
  location: string | null;
  purchase_date: string | null;
  price_amount: number | null;
  currency: string;
  supplier_id: string | null;
  supplier_name?: string | null;
  package_type: PackageType;
  spool_id: string | null;
  spool_cost_amount: number;
  filament_cost_amount: number | null;
  drying_notes: string | null;
  photo_url: string | null;
  purchase_url: string | null;
  nfc_tag_id: string | null;
  qr_payload: string | null;
  created_at?: string;
  updated_at?: string;
  creation_request_id?: string | null;
  last_update_request_id?: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  website_url: string | null;
  notes: string | null;
};

export type Spool = {
  id: string;
  code: string;
  brand: string | null;
  spool_material: string;
  tare_weight_g: number | null;
  acquisition_cost: number;
  currency: string;
  status: SpoolStatus;
  notes: string | null;
  spool_type_id?: string | null;
  creation_request_id?: string | null;
  last_update_request_id?: string | null;
  created_at?: string;
};

export type SpoolType = {
  id: string;
  user_id: string | null;
  manufacturer: string;
  name: string;
  material: string;
  spool_weight_g: number | null;
  insert_weight_g: number | null;
  total_tare_g: number;
  photo_url: string | null;
  notes: string | null;
  weight_source: string | null;
  tare_confidence: TareConfidence;
  is_active: boolean;
};

export type WeighingEvent = {
  id: string;
  request_id: string;
  roll_id: string;
  spool_id: string | null;
  spool_type_id: string | null;
  measurement_kind: "scale" | "manual";
  gross_weight_g: number | null;
  tare_weight_g: number | null;
  available_weight_g: number;
  tare_confidence: TareConfidence;
  weight_source: string | null;
  notes: string | null;
  measured_at: string;
};

export type PurchaseRecord = {
  id: string;
  roll_id: string | null;
  supplier_id: string | null;
  supplier_name: string;
  brand: string;
  material: string;
  product_line: string | null;
  color_name: string;
  color_hex: string;
  purchased_at: string;
  package_type: PackageType;
  total_price: number;
  spool_cost: number;
  filament_cost: number;
  currency: string;
  quantity_g: number;
};

export type PurchaseCorrection = {
  id: string;
  request_id: string;
  purchase_id: string;
  roll_id: string | null;
  supplier_id: string | null;
  supplier_name: string;
  purchased_at: string;
  package_type: PackageType;
  total_price: number;
  spool_cost: number;
  filament_cost: number;
  currency: string;
  quantity_g: number;
  reason: string;
  corrected_at: string;
};

export type ConsumptionLog = {
  id: string;
  roll_id: string;
  project_name: string;
  grams_used: number;
  consumed_at: string;
  notes: string | null;
  cost_amount: number | null;
  currency: string | null;
  request_id?: string | null;
};

export type RollDraft = Omit<
  FilamentRoll,
  "id" | "available_weight_g" | "status" | "nfc_tag_id" | "qr_payload" | "created_at" | "updated_at" | "spool_id" | "supplier_id"
> & {
  available_weight_g?: number;
  status?: RollStatus;
};
