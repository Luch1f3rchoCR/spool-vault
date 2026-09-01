"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import {
  AlertTriangle,
  BarChart3,
  Camera,
  Check,
  Filter,
  LinkIcon,
  LogIn,
  Nfc,
  PackagePlus,
  Pencil,
  Plus,
  QrCode,
  ReceiptText,
  ScanLine,
  Search,
  ShoppingCart,
  Sparkles,
  UserRound,
  Weight,
  X
} from "lucide-react";
import { InventoryReportModal } from "@/components/inventory-report-modal";
import { MobileNavigation } from "@/components/mobile-navigation";
import {
  MissingPurchaseModal,
  type MissingPurchaseValues
} from "@/components/missing-purchase-modal";
import { ProfilePanel, type ProfileValues } from "@/components/profile-panel";
import {
  PurchaseOrdersModal,
  type PurchaseOrderValues
} from "@/components/purchase-orders-modal";
import {
  PurchaseCorrectionModal,
  type PurchaseCorrectionValues
} from "@/components/purchase-correction-modal";
import { RollEditModal, type EditableRollValues } from "@/components/roll-edit-modal";
import { demoLogs, demoRolls } from "@/lib/demo-data";
import {
  getAuthRedirectUrl,
  getSupabaseClient,
  getSupabaseConfigStatus,
  initializeSupabaseClient
} from "@/lib/supabase";
import type {
  ConsumptionLog,
  FilamentRoll,
  InventoryBalanceRow,
  PackageType,
  PurchaseCorrection,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderPayment,
  PurchaseRecord,
  RollDraft,
  RollStatus,
  Spool,
  SpoolType,
  TareConfidence,
  UserProfile,
  WeighingEvent,
  Supplier
} from "@/lib/types";

const LOCAL_ROLLS_KEY = "filament-vault-rolls";
const LOCAL_LOGS_KEY = "filament-vault-logs";
const LOCAL_SPOOLS_KEY = "spool-vault-spools";
const LOCAL_PURCHASES_KEY = "spool-vault-purchases";
const LOCAL_PURCHASE_CORRECTIONS_KEY = "spool-vault-purchase-corrections";
const LOCAL_PURCHASE_ORDERS_KEY = "spool-vault-purchase-orders";
const LOCAL_PURCHASE_ORDER_ITEMS_KEY = "spool-vault-purchase-order-items";
const LOCAL_PURCHASE_ORDER_PAYMENTS_KEY = "spool-vault-purchase-order-payments";
const LOCAL_PROFILE_KEY = "spool-vault-user-profile";
const LOCAL_WEIGHINGS_KEY = "spool-vault-weighings";
const AUTH_REQUEST_TIMEOUT_MS = 15000;

type DataMode = "authenticated" | "demo" | "local" | "error";
type SpoolMutationResult = { roll: FilamentRoll | null; spool: Spool };
type AtomicRollCreationResult = {
  roll: FilamentRoll;
  supplier: Supplier | null;
  purchase: PurchaseRecord | null;
  replayed: boolean;
};
type ConsumptionMutationResult = {
  roll: FilamentRoll;
  log: ConsumptionLog;
  replayed: boolean;
};
type SpoolWriteResult = { spool: Spool; replayed: boolean };
type WeightMutationResult = { roll: FilamentRoll; event: WeighingEvent; replayed: boolean };
type RollUpdateResult = { roll: FilamentRoll; replayed: boolean };
type PurchaseCorrectionResult = {
  correction: PurchaseCorrection;
  roll: FilamentRoll | null;
  supplier?: Supplier;
  replayed: boolean;
};
type MissingPurchaseResult = {
  purchase: PurchaseRecord;
  roll: FilamentRoll;
  supplier: Supplier;
  replayed: boolean;
};
type PurchaseOrderMutationResult = {
  order: PurchaseOrder;
  items: PurchaseOrderItem[];
  payment: PurchaseOrderPayment | null;
  replayed: boolean;
};
type PurchaseView = {
  original: PurchaseRecord;
  effective: PurchaseRecord;
  latestCorrection: PurchaseCorrection | null;
  correctionCount: number;
};
type WeightInput = {
  kind: "scale" | "manual";
  grossWeight: number | null;
  tareWeight: number | null;
  spoolTypeId: string | null;
  confidence: TareConfidence;
  source: string;
};

const brandOptions = ["Bambu Lab", "Pritonic", "Genérico", "Creality", "Polymaker", "eSUN"];
const materialOptions = ["PLA", "PETG", "ABS", "ASA", "TPU", "PA", "PC", "Resina"];
const lineOptionsByMaterial: Record<string, string[]> = {
  PLA: [
    "PLA Basic",
    "PLA Matte",
    "PLA Silk+",
    "PLA Silk Multicolor",
    "PLA Sparkle",
    "PLA Marble",
    "PLA Glow",
    "PLA Tough+",
    "PLA Translucent",
    "PLA-CF",
    "PLA Wood"
  ],
  PETG: ["PETG Basic", "PETG Translucent"],
  ABS: ["ABS"],
  ASA: ["ASA"],
  TPU: ["TPU 95A"],
  PA: ["PA"],
  PC: ["PC"],
  Resina: ["Resina estándar"]
};
const supplierOptions = ["Maker Store", "Pritonic", "Bambu Lab", "Otro"];
const colorPresets = [
  "#f7f4e8",
  "#17211d",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#2563eb",
  "#7c3aed",
  "#ec4899",
  "#9ca3af",
  "#92400e"
];
const statusLabels: Record<RollStatus, string> = {
  new: "Nuevo",
  open: "Abierto",
  low: "Bajo",
  empty: "Agotado",
  archived: "Archivado"
};
const spoolStatusLabels: Record<Spool["status"], string> = {
  empty: "Vacío",
  in_use: "En uso",
  reserved: "Reservado",
  retired: "Inactivo"
};
const tareConfidenceLabels: Record<TareConfidence, string> = {
  verified: "Verificada",
  estimated: "Estimada",
  unknown: "Desconocida"
};
const fallbackSpoolTypes: SpoolType[] = [
  {
    id: "local-bambu-reusable",
    user_id: null,
    manufacturer: "Bambu Lab",
    name: "Reusable Spool",
    material: "Plástico reutilizable",
    spool_weight_g: 213,
    insert_weight_g: 41,
    total_tare_g: 254,
    photo_url: null,
    notes: "213 g de spool + 41 g de cartón/RFID/NFC",
    weight_source: "Medición física real",
    tare_confidence: "verified",
    is_active: true
  },
  {
    id: "local-pritonic-plastic",
    user_id: null,
    manufacturer: "Pritonic",
    name: "Spool plástico",
    material: "Plástico",
    spool_weight_g: null,
    insert_weight_g: null,
    total_tare_g: 250,
    photo_url: null,
    notes: "Pendiente de medición física individual",
    weight_source: "Referencia provisional",
    tare_confidence: "estimated",
    is_active: true
  },
  {
    id: "local-pritonic-cardboard",
    user_id: null,
    manufacturer: "Pritonic",
    name: "Spool cartón",
    material: "Cartón",
    spool_weight_g: null,
    insert_weight_g: null,
    total_tare_g: 170,
    photo_url: null,
    notes: "Pendiente de medición física individual",
    weight_source: "Referencia provisional",
    tare_confidence: "estimated",
    is_active: true
  }
];

const initialDraft: RollDraft = {
  brand: "Bambu Lab",
  product_line: "PLA Basic",
  material: "PLA",
  color_name: "",
  color_hex: "#22c55e",
  initial_weight_g: 1000,
  low_threshold_g: 200,
  location: "Gaveta seca",
  purchase_date: "",
  price_amount: null,
  currency: "CRC",
  supplier_name: "Maker Store",
  package_type: "refill",
  spool_cost_amount: 0,
  filament_cost_amount: null,
  drying_notes: "",
  photo_url: "",
  purchase_url: ""
};

function defaultUserProfile(userId = "local", email = ""): UserProfile {
  return {
    user_id: userId,
    display_name: null,
    base_currency: "CRC",
    billing_name: null,
    billing_tax_id: null,
    billing_email: email || null,
    billing_address: null,
    membership_status: "early_access"
  };
}

function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(currency: string, value: number) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CRC" ? 0 : 2
  }).format(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, AUTH_REQUEST_TIMEOUT_MS);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function payloadForRoll(roll: Pick<FilamentRoll, "id" | "qr_payload">) {
  if (roll.qr_payload) return roll.qr_payload;
  if (typeof window === "undefined") return `filament-roll:${roll.id}`;
  return `${window.location.origin}/?roll=${encodeURIComponent(roll.id)}`;
}

function rollIdFromPayload(payload: string) {
  const cleaned = payload.trim();

  try {
    const url = new URL(cleaned, typeof window === "undefined" ? "https://spool-vault.local" : window.location.origin);
    const rollId = url.searchParams.get("roll");
    if (rollId) return rollId;
  } catch {
    // QR payloads may also be plain text.
  }

  const plainMatch = cleaned.match(/filament-roll:([a-z0-9-]+)/i);
  if (plainMatch?.[1]) return plainMatch[1];

  return cleaned;
}

function payloadMatchesRoll(roll: Pick<FilamentRoll, "id" | "qr_payload">, payload: string) {
  const cleaned = payload.trim();
  const storedPayload = roll.qr_payload?.trim();
  const scannedId = rollIdFromPayload(cleaned);

  return (
    roll.id === scannedId ||
    cleaned.includes(roll.id) ||
    Boolean(storedPayload && (cleaned === storedPayload || cleaned.includes(storedPayload)))
  );
}

async function detectQrPayload(video: HTMLVideoElement, detector: BarcodeDetector | null) {
  if (detector) {
    const barcodes = await detector.detect(video);
    const nativePayload = barcodes[0]?.rawValue;
    if (nativePayload) return nativePayload;
  }

  if (!video.videoWidth || !video.videoHeight) return "";

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "";

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth"
  });

  return code?.data ?? "";
}

function normalizeStatus(available: number, threshold: number, current: RollStatus = "open"): RollStatus {
  if (available <= 0) return "empty";
  if (available <= threshold) return "low";
  if (current === "new") return "new";
  return "open";
}

function statusClass(status: RollStatus) {
  return `status status-${status}`;
}

function readLocal<T>(key: string, fallback: T) {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function normalizeRollData(roll: FilamentRoll): FilamentRoll {
  return {
    ...roll,
    supplier_id: roll.supplier_id ?? null,
    package_type: roll.package_type ?? "spooled",
    spool_id: roll.spool_id ?? null,
    spool_cost_amount: Number(roll.spool_cost_amount ?? 0),
    filament_cost_amount: roll.filament_cost_amount ?? null
  };
}

function buildLocalBalanceReport(rolls: FilamentRoll[], spools: Spool[]): InventoryBalanceRow[] {
  return rolls.map((roll) => {
    const initialWeight = Number(roll.initial_weight_g);
    const availableWeight = Number(roll.available_weight_g);
    const filamentCost = roll.filament_cost_amount == null ? null : Number(roll.filament_cost_amount);
    const spool = spools.find((item) => item.id === roll.spool_id);
    return {
      roll_id: roll.id,
      brand: roll.brand,
      material: roll.material,
      product_line: roll.product_line,
      color_name: roll.color_name,
      color_hex: roll.color_hex,
      initial_weight_g: initialWeight,
      available_weight_g: availableWeight,
      remaining_percent: initialWeight > 0 ? Math.round(availableWeight / initialWeight * 10000) / 100 : 0,
      low_threshold_g: Number(roll.low_threshold_g),
      status: roll.status,
      location: roll.location,
      package_type: roll.package_type,
      supplier_name: roll.supplier_name ?? null,
      purchase_date: roll.purchase_date,
      purchase_total: roll.price_amount,
      spool_cost_amount: Number(roll.spool_cost_amount),
      filament_cost_amount: filamentCost,
      currency: roll.currency,
      filament_cost_per_g: filamentCost == null || initialWeight <= 0 ? null : filamentCost / initialWeight,
      remaining_filament_value: filamentCost == null || initialWeight <= 0 ? null : availableWeight / initialWeight * filamentCost,
      cost_status: filamentCost == null ? "incomplete" : "recorded",
      spool_code: spool?.code ?? null,
      spool_tare_weight_g: spool?.tare_weight_g ?? null,
      spool_status: spool?.status ?? null,
      qr_payload: roll.qr_payload,
      nfc_tag_id: roll.nfc_tag_id,
      created_at: roll.created_at,
      updated_at: roll.updated_at
    };
  });
}

function allocateLocalOrderCharge(
  total: number,
  purchases: PurchaseRecord[],
  method: PurchaseOrderValues["allocation_method"],
  manual: PurchaseOrderValues["manual_allocations"],
  field: "shipping" | "other"
) {
  const allocations = new Map<string, number>();
  const subtotal = purchases.reduce((sum, purchase) => sum + Number(purchase.total_price), 0);
  let running = 0;
  purchases.forEach((purchase, index) => {
    let amount = 0;
    if (method === "manual") amount = Number(manual[purchase.id]?.[field] ?? 0);
    else if (index === purchases.length - 1) amount = Math.round((total - running) * 100) / 100;
    else if (method === "by_value" && subtotal > 0) amount = Math.round(total * Number(purchase.total_price) / subtotal * 100) / 100;
    else amount = Math.round(total / purchases.length * 100) / 100;
    running += amount;
    allocations.set(purchase.id, amount);
  });
  return allocations;
}

function buildLocalPurchaseOrder(
  requestId: string,
  values: PurchaseOrderValues,
  purchases: PurchaseRecord[]
): PurchaseOrderMutationResult {
  const orderId = crypto.randomUUID();
  const subtotal = purchases.reduce((sum, purchase) => sum + Number(purchase.total_price), 0);
  const shipping = allocateLocalOrderCharge(values.shipping_amount, purchases, values.allocation_method, values.manual_allocations, "shipping");
  const other = allocateLocalOrderCharge(values.other_charges_amount, purchases, values.allocation_method, values.manual_allocations, "other");
  const order: PurchaseOrder = {
    id: orderId,
    request_id: requestId,
    supplier_id: purchases[0]?.supplier_id ?? null,
    supplier_name: purchases[0]?.supplier_name.trim() || "Sin proveedor",
    purchased_at: values.purchased_at,
    currency: purchases[0]?.currency ?? "CRC",
    subtotal_amount: subtotal,
    shipping_amount: values.shipping_amount,
    other_charges_amount: values.other_charges_amount,
    total_amount: subtotal + values.shipping_amount + values.other_charges_amount,
    allocation_method: values.allocation_method,
    cost_confidence: values.cost_confidence,
    notes: values.notes.trim() || null,
    created_at: new Date().toISOString()
  };
  const items = purchases.map((purchase) => {
    const allocatedShipping = shipping.get(purchase.id) ?? 0;
    const allocatedOther = other.get(purchase.id) ?? 0;
    return {
      id: crypto.randomUUID(),
      order_id: orderId,
      purchase_history_id: purchase.id,
      roll_id: purchase.roll_id,
      brand: purchase.brand,
      material: purchase.material,
      product_line: purchase.product_line,
      color_name: purchase.color_name,
      color_hex: purchase.color_hex,
      package_type: purchase.package_type,
      quantity_g: Number(purchase.quantity_g),
      base_amount: Number(purchase.total_price),
      spool_cost: Number(purchase.spool_cost),
      filament_base_cost: Number(purchase.filament_cost),
      allocated_shipping: allocatedShipping,
      allocated_other_charges: allocatedOther,
      landed_total: Number(purchase.total_price) + allocatedShipping + allocatedOther,
      filament_landed_cost: Number(purchase.filament_cost) + allocatedShipping + allocatedOther,
      currency: purchase.currency,
      cost_confidence: values.cost_confidence,
      created_at: new Date().toISOString()
    } satisfies PurchaseOrderItem;
  });
  const payment = values.paid_amount !== null
    && values.paid_currency
    && values.exchange_rate !== null
    && values.exchange_rate_date
    && values.exchange_rate_kind
    ? {
        order_id: orderId,
        paid_amount: values.paid_amount,
        paid_currency: values.paid_currency,
        exchange_rate: values.exchange_rate,
        exchange_rate_date: values.exchange_rate_date,
        exchange_rate_kind: values.exchange_rate_kind,
        exchange_rate_source: values.exchange_rate_source.trim() || null,
        created_at: new Date().toISOString()
      } satisfies PurchaseOrderPayment
    : null;
  return { order, items, payment, replayed: false };
}

export default function Home() {
  const [rolls, setRolls] = useState<FilamentRoll[]>([]);
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [spools, setSpools] = useState<Spool[]>([]);
  const [spoolTypes, setSpoolTypes] = useState<SpoolType[]>([]);
  const [weighingEvents, setWeighingEvents] = useState<WeighingEvent[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [purchaseCorrections, setPurchaseCorrections] = useState<PurchaseCorrection[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [purchaseOrderPayments, setPurchaseOrderPayments] = useState<PurchaseOrderPayment[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => defaultUserProfile());
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("Todos");
  const [materialFilter, setMaterialFilter] = useState("Todos");
  const [lowOnly, setLowOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showQuickWeigh, setShowQuickWeigh] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scanActionRollId, setScanActionRollId] = useState("");
  const [editingRollId, setEditingRollId] = useState("");
  const [correctingPurchaseId, setCorrectingPurchaseId] = useState("");
  const [missingPurchaseRollId, setMissingPurchaseRollId] = useState("");
  const [showSpools, setShowSpools] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showPurchaseOrders, setShowPurchaseOrders] = useState(false);
  const [reportRows, setReportRows] = useState<InventoryBalanceRow[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const [editingSpoolId, setEditingSpoolId] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [draft, setDraft] = useState<RollDraft>(initialDraft);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [syncNote, setSyncNote] = useState("Modo demo local");
  const [authEmail, setAuthEmail] = useState("");
  const [authNote, setAuthNote] = useState("");
  const [authRedirectUrl, setAuthRedirectUrl] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [signedInUserId, setSignedInUserId] = useState("");
  const [authVersion, setAuthVersion] = useState(0);
  const [nfcNote, setNfcNote] = useState("");
  const [qrScanNote, setQrScanNote] = useState("");
  const [manualQrPayload, setManualQrPayload] = useState("");
  const [pendingQrPayload, setPendingQrPayload] = useState("");
  const [measuredTotalWeight, setMeasuredTotalWeight] = useState("");
  const [weighingTare, setWeighingTare] = useState("");
  const [weighingSpoolTypeId, setWeighingSpoolTypeId] = useState("");
  const [weighingConfidence, setWeighingConfidence] = useState<TareConfidence>("unknown");
  const [newSpoolTypeId, setNewSpoolTypeId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [dataMode, setDataMode] = useState<DataMode>("demo");
  const [isAddingRoll, setIsAddingRoll] = useState(false);
  const [isUpdatingRoll, setIsUpdatingRoll] = useState(false);
  const [isCorrectingPurchase, setIsCorrectingPurchase] = useState(false);
  const [isAddingMissingPurchase, setIsAddingMissingPurchase] = useState(false);
  const [isSavingPurchaseOrder, setIsSavingPurchaseOrder] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isRecordingConsumption, setIsRecordingConsumption] = useState(false);
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isWeighingHighlighted, setIsWeighingHighlighted] = useState(false);
  const [pendingSpoolAction, setPendingSpoolAction] = useState("");
  const addRollRequestId = useRef<string | null>(null);
  const updateRollRequests = useRef<Record<string, string>>({});
  const purchaseCorrectionRequests = useRef<Record<string, { id: string; fingerprint: string }>>({});
  const missingPurchaseRequests = useRef<Record<string, { id: string; fingerprint: string }>>({});
  const purchaseOrderRequest = useRef<{ id: string; fingerprint: string } | null>(null);
  const consumptionRequest = useRef<{ id: string; rollId: string } | null>(null);
  const weightRequest = useRef<{ id: string; rollId: string; fingerprint: string } | null>(null);
  const createSpoolRequestId = useRef<string | null>(null);
  const updateSpoolRequests = useRef<Record<string, string>>({});
  const quickWeighInputRef = useRef<HTMLInputElement | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrFrameRef = useRef<number | null>(null);

  const [supabase, setSupabase] = useState(() => getSupabaseClient());
  const [supabaseConfig, setSupabaseConfig] = useState(() => getSupabaseConfigStatus());
  const usingSupabase = Boolean(supabase && signedInEmail);

  useEffect(() => {
    setAuthRedirectUrl(getAuthRedirectUrl());
    setSupabaseConfig(getSupabaseConfigStatus());

    let isActive = true;

    initializeSupabaseClient().then((client) => {
      if (!isActive) return;
      setSupabase(client);
      setSupabaseConfig(getSupabaseConfigStatus());
      setAuthRedirectUrl(getAuthRedirectUrl());
    });

    return () => {
      isActive = false;
    };
  }, []);

  function activateLocalMode() {
    if (!usingSupabase) {
      setDataMode("local");
      setSyncNote("Modo local · estos cambios no están sincronizados");
    }
  }

  useEffect(() => {
    async function loadData() {
      if (supabase) {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        const sessionIsSimplyMissing = userError?.name === "AuthSessionMissingError"
          || userError?.message === "Auth session missing!";

        if (userError && !sessionIsSimplyMissing) {
          setRolls([]);
          setLogs([]);
          setSpools([]);
          setSpoolTypes([]);
          setWeighingEvents([]);
          setSuppliers([]);
          setPurchases([]);
          setPurchaseCorrections([]);
          setPurchaseOrders([]);
          setPurchaseOrderItems([]);
          setPurchaseOrderPayments([]);
          setUserProfile(defaultUserProfile());
          setSignedInUserId("");
          setSelectedId("");
          setDataMode("error");
          setSyncNote("No se pudo comprobar la sesión. No se muestran datos demo.");
          setIsLoading(false);
          return;
        }

        if (!user) {
          const hasLocalInventory = window.localStorage.getItem(LOCAL_ROLLS_KEY) !== null;
          const localRolls = readLocal<FilamentRoll[]>(LOCAL_ROLLS_KEY, demoRolls).map(normalizeRollData);
          const localLogs = readLocal<ConsumptionLog[]>(LOCAL_LOGS_KEY, demoLogs);
          const localSpools = readLocal<Spool[]>(LOCAL_SPOOLS_KEY, []);
          const localPurchases = readLocal<PurchaseRecord[]>(LOCAL_PURCHASES_KEY, []);
          const localPurchaseCorrections = readLocal<PurchaseCorrection[]>(LOCAL_PURCHASE_CORRECTIONS_KEY, []);
          const localPurchaseOrders = readLocal<PurchaseOrder[]>(LOCAL_PURCHASE_ORDERS_KEY, []);
          const localPurchaseOrderItems = readLocal<PurchaseOrderItem[]>(LOCAL_PURCHASE_ORDER_ITEMS_KEY, []);
          const localPurchaseOrderPayments = readLocal<PurchaseOrderPayment[]>(LOCAL_PURCHASE_ORDER_PAYMENTS_KEY, []);
          const localProfile = readLocal<UserProfile>(LOCAL_PROFILE_KEY, defaultUserProfile());
          const localWeighings = readLocal<WeighingEvent[]>(LOCAL_WEIGHINGS_KEY, []);
          setSignedInEmail("");
          setSignedInUserId("");
          setRolls(localRolls);
          setLogs(localLogs);
          setSpools(localSpools);
          setSpoolTypes(fallbackSpoolTypes);
          setWeighingEvents(localWeighings);
          setPurchases(localPurchases);
          setPurchaseCorrections(localPurchaseCorrections);
          setPurchaseOrders(localPurchaseOrders);
          setPurchaseOrderItems(localPurchaseOrderItems);
          setPurchaseOrderPayments(localPurchaseOrderPayments);
          setUserProfile(localProfile);
          setSelectedId(localRolls[0]?.id ?? "");
          setDataMode(hasLocalInventory ? "local" : "demo");
          setSyncNote(
            hasLocalInventory
              ? "Modo local · estos datos no están sincronizados"
              : "Modo demostración · iniciá sesión para ver tu inventario real"
          );
          setIsLoading(false);
          return;
        }

        setSignedInEmail(user.email ?? "Sesión activa");
        setSignedInUserId(user.id);

        const [
          { data: rollData, error: rollError },
          { data: logData, error: logError },
          { data: spoolData, error: spoolError },
          { data: spoolTypeData, error: spoolTypeError },
          { data: weighingData, error: weighingError },
          { data: supplierData, error: supplierError },
          { data: purchaseData, error: purchaseError },
          { data: purchaseCorrectionData, error: purchaseCorrectionError },
          { data: purchaseOrderData, error: purchaseOrderError },
          { data: purchaseOrderItemData, error: purchaseOrderItemError },
          { data: purchaseOrderPaymentData, error: purchaseOrderPaymentError },
          { data: profileData, error: profileError }
        ] =
          await Promise.all([
            supabase.from("filament_rolls").select("*").order("updated_at", { ascending: false }),
            supabase.from("consumption_logs").select("*").order("consumed_at", { ascending: false }),
            supabase.from("spools").select("*").order("code"),
            supabase.from("spool_types").select("*").eq("is_active", true).order("manufacturer").order("name"),
            supabase.from("weighing_events").select("*").order("measured_at", { ascending: false }),
            supabase.from("suppliers").select("*").order("name"),
            supabase.from("purchase_history").select("*").order("purchased_at", { ascending: false }),
            supabase.from("purchase_corrections").select("*").order("corrected_at", { ascending: false }),
            supabase.from("purchase_orders").select("*").order("purchased_at", { ascending: false }),
            supabase.from("purchase_order_items").select("*").order("created_at", { ascending: false }),
            supabase.from("purchase_order_payments").select("*").order("created_at", { ascending: false }),
            supabase.from("user_profiles").select("*").maybeSingle()
          ]);

        if (
          !rollError && !logError && !spoolError && !spoolTypeError && !weighingError
          && !supplierError && !purchaseError && !purchaseCorrectionError
          && !purchaseOrderError && !purchaseOrderItemError && !purchaseOrderPaymentError
          && !profileError && rollData
        ) {
          const loadedSuppliers = (supplierData ?? []) as Supplier[];
          const loadedRolls = (rollData as FilamentRoll[]).map((roll) => ({
            ...normalizeRollData(roll),
            supplier_name: loadedSuppliers.find((supplier) => supplier.id === roll.supplier_id)?.name ?? null
          }));
          setRolls(loadedRolls);
          setLogs((logData ?? []) as ConsumptionLog[]);
          setSpools((spoolData ?? []) as Spool[]);
          setSpoolTypes((spoolTypeData ?? []) as SpoolType[]);
          setWeighingEvents((weighingData ?? []) as WeighingEvent[]);
          setSuppliers(loadedSuppliers);
          setPurchases((purchaseData ?? []) as PurchaseRecord[]);
          setPurchaseCorrections((purchaseCorrectionData ?? []) as PurchaseCorrection[]);
          setPurchaseOrders((purchaseOrderData ?? []) as PurchaseOrder[]);
          setPurchaseOrderItems((purchaseOrderItemData ?? []) as PurchaseOrderItem[]);
          setPurchaseOrderPayments((purchaseOrderPaymentData ?? []) as PurchaseOrderPayment[]);
          setUserProfile((profileData as UserProfile | null) ?? defaultUserProfile(user.id, user.email ?? ""));
          setSelectedId(loadedRolls[0]?.id ?? "");
          setDataMode("authenticated");
          setSyncNote("Conectado a Supabase · inventario real");
          setIsLoading(false);
          return;
        }

        setRolls([]);
        setLogs([]);
        setSpools([]);
        setSpoolTypes([]);
        setWeighingEvents([]);
        setSuppliers([]);
        setPurchases([]);
        setPurchaseCorrections([]);
        setPurchaseOrders([]);
        setPurchaseOrderItems([]);
        setPurchaseOrderPayments([]);
        setUserProfile(defaultUserProfile(user.id, user.email ?? ""));
        setSelectedId("");
        setDataMode("error");
        setSyncNote("No se pudo cargar el inventario real. No se muestran datos demo.");
        setIsLoading(false);
        return;
      }

      const hasLocalInventory = window.localStorage.getItem(LOCAL_ROLLS_KEY) !== null;
      const localRolls = readLocal<FilamentRoll[]>(LOCAL_ROLLS_KEY, demoRolls).map(normalizeRollData);
      const localLogs = readLocal<ConsumptionLog[]>(LOCAL_LOGS_KEY, demoLogs);
      const localSpools = readLocal<Spool[]>(LOCAL_SPOOLS_KEY, []);
      const localPurchases = readLocal<PurchaseRecord[]>(LOCAL_PURCHASES_KEY, []);
      const localPurchaseCorrections = readLocal<PurchaseCorrection[]>(LOCAL_PURCHASE_CORRECTIONS_KEY, []);
      const localPurchaseOrders = readLocal<PurchaseOrder[]>(LOCAL_PURCHASE_ORDERS_KEY, []);
      const localPurchaseOrderItems = readLocal<PurchaseOrderItem[]>(LOCAL_PURCHASE_ORDER_ITEMS_KEY, []);
      const localPurchaseOrderPayments = readLocal<PurchaseOrderPayment[]>(LOCAL_PURCHASE_ORDER_PAYMENTS_KEY, []);
      const localProfile = readLocal<UserProfile>(LOCAL_PROFILE_KEY, defaultUserProfile());
      const localWeighings = readLocal<WeighingEvent[]>(LOCAL_WEIGHINGS_KEY, []);
      setRolls(localRolls);
      setLogs(localLogs);
      setSpools(localSpools);
      setSpoolTypes(fallbackSpoolTypes);
      setWeighingEvents(localWeighings);
      setPurchases(localPurchases);
      setPurchaseCorrections(localPurchaseCorrections);
      setPurchaseOrders(localPurchaseOrders);
      setPurchaseOrderItems(localPurchaseOrderItems);
      setPurchaseOrderPayments(localPurchaseOrderPayments);
      setUserProfile(localProfile);
      setSelectedId(localRolls[0]?.id ?? "");
      setDataMode(hasLocalInventory ? "local" : "demo");
      setSyncNote(
        hasLocalInventory
          ? "Modo local · Supabase no está configurado"
          : "Modo demostración · Supabase no está configurado"
      );
      setIsLoading(false);
    }

    loadData();
  }, [authVersion, supabase]);

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? "");
      setSignedInUserId(session?.user.id ?? "");
      if (session?.user) setShowLogin(false);
      setAuthVersion((value) => value + 1);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local" && rolls.length) saveLocal(LOCAL_ROLLS_KEY, rolls);
  }, [dataMode, rolls, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local" && logs.length) saveLocal(LOCAL_LOGS_KEY, logs);
  }, [dataMode, logs, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local") saveLocal(LOCAL_SPOOLS_KEY, spools);
  }, [dataMode, spools, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local") saveLocal(LOCAL_PURCHASES_KEY, purchases);
  }, [dataMode, purchases, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local") {
      saveLocal(LOCAL_PURCHASE_CORRECTIONS_KEY, purchaseCorrections);
    }
  }, [dataMode, purchaseCorrections, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local") saveLocal(LOCAL_PURCHASE_ORDERS_KEY, purchaseOrders);
  }, [dataMode, purchaseOrders, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local") saveLocal(LOCAL_PURCHASE_ORDER_ITEMS_KEY, purchaseOrderItems);
  }, [dataMode, purchaseOrderItems, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local") saveLocal(LOCAL_PURCHASE_ORDER_PAYMENTS_KEY, purchaseOrderPayments);
  }, [dataMode, purchaseOrderPayments, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local") saveLocal(LOCAL_PROFILE_KEY, userProfile);
  }, [dataMode, userProfile, usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && dataMode === "local") saveLocal(LOCAL_WEIGHINGS_KEY, weighingEvents);
  }, [dataMode, usingSupabase, weighingEvents]);

  useEffect(() => {
    document.body.style.overflow = showAdd || showQuickWeigh || showQrScanner || Boolean(scanActionRollId) || showSpools || showReport || showPurchaseOrders || showProfile
      || Boolean(editingRollId) || Boolean(correctingPurchaseId) || Boolean(missingPurchaseRollId) ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [
    correctingPurchaseId,
    editingRollId,
    missingPurchaseRollId,
    showAdd,
    showPurchaseOrders,
    showProfile,
    showQrScanner,
    showQuickWeigh,
    showReport,
    showSpools,
    scanActionRollId
  ]);

  const selectedRoll = rolls.find((roll) => roll.id === selectedId) ?? rolls[0];
  const scanActionRoll = rolls.find((roll) => roll.id === scanActionRollId);
  const editingRoll = rolls.find((roll) => roll.id === editingRollId);
  const purchaseViews = useMemo<PurchaseView[]>(() => purchases.map((purchase) => {
    const relatedCorrections = purchaseCorrections
      .filter((correction) => correction.purchase_id === purchase.id)
      .sort((a, b) => b.corrected_at.localeCompare(a.corrected_at));
    const latestCorrection = relatedCorrections[0] ?? null;
    const effective = latestCorrection
      ? {
          ...purchase,
          supplier_id: latestCorrection.supplier_id,
          supplier_name: latestCorrection.supplier_name,
          purchased_at: latestCorrection.purchased_at,
          package_type: latestCorrection.package_type,
          total_price: Number(latestCorrection.total_price),
          spool_cost: Number(latestCorrection.spool_cost),
          filament_cost: Number(latestCorrection.filament_cost),
          currency: latestCorrection.currency,
          quantity_g: Number(latestCorrection.quantity_g)
        }
      : purchase;

    return {
      original: purchase,
      effective,
      latestCorrection,
      correctionCount: relatedCorrections.length
    };
  }), [purchaseCorrections, purchases]);
  const effectivePurchases = useMemo(
    () => purchaseViews.map((view) => view.effective),
    [purchaseViews]
  );
  const correctingPurchase = purchaseViews.find((view) => view.original.id === correctingPurchaseId);
  const missingPurchaseRoll = rolls.find((roll) => roll.id === missingPurchaseRollId);
  const selectedRollPurchase = purchaseViews.find((view) => view.original.roll_id === selectedRoll?.id);
  const selectedSpool = spools.find((spool) => spool.id === selectedRoll?.spool_id);
  const recentWeighings = weighingEvents
    .filter((event) => event.roll_id === selectedRoll?.id)
    .slice(0, 3);

  useEffect(() => {
    if (!selectedRoll) return;
    const preferredType = spoolTypes.find((type) => type.id === selectedSpool?.spool_type_id)
      ?? (selectedRoll.brand === "Bambu Lab"
        ? spoolTypes.find((type) => type.manufacturer === "Bambu Lab")
        : undefined);

    setWeighingSpoolTypeId(preferredType?.id ?? "");
    setWeighingTare(preferredType ? String(preferredType.total_tare_g) : selectedSpool?.tare_weight_g ? String(selectedSpool.tare_weight_g) : "");
    setWeighingConfidence(preferredType?.tare_confidence ?? "unknown");
    setMeasuredTotalWeight("");
    weightRequest.current = null;
  }, [selectedRoll?.id, selectedRoll?.brand, selectedSpool?.spool_type_id, selectedSpool?.tare_weight_g, spoolTypes]);

  useEffect(() => {
    if (!selectedRoll) return;

    QRCode.toDataURL(payloadForRoll(selectedRoll), {
      margin: 1,
      scale: 7,
      color: {
        dark: "#1e2b26",
        light: "#fffaf0"
      }
    }).then(setQrDataUrl);
  }, [selectedRoll]);

  useEffect(() => {
    if (!showQuickWeigh) return;
    window.setTimeout(() => quickWeighInputRef.current?.focus(), 120);
  }, [showQuickWeigh, selectedRoll?.id]);

  useEffect(() => {
    if (!showQrScanner) return;

    let isActive = true;

    async function startQrScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setQrScanNote("Este navegador no permite abrir la cámara desde la app.");
        return;
      }

      try {
        const detector = "BarcodeDetector" in window ? new BarcodeDetector({ formats: ["qr_code"] }) : null;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" }
          }
        });

        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        qrStreamRef.current = stream;

        const video = qrVideoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        setQrScanNote(
          detector
            ? "Apuntá la cámara al QR del rollo."
            : "Apuntá la cámara al QR. Usando lector compatible con iPhone."
        );

        const scanFrame = async () => {
          if (!isActive || !qrVideoRef.current) return;

          try {
            const payload = await detectQrPayload(qrVideoRef.current, detector);

            if (payload && selectRollFromScannedPayload(payload)) {
              return;
            }
          } catch {
            setQrScanNote("No pude leer ese cuadro. Mové un poco el cel o acercá el QR.");
          }

          qrFrameRef.current = window.requestAnimationFrame(scanFrame);
        };

        qrFrameRef.current = window.requestAnimationFrame(scanFrame);
      } catch (error) {
        setQrScanNote(error instanceof Error ? error.message : "No pude abrir la cámara para escanear.");
      }
    }

    startQrScanner();

    return () => {
      isActive = false;
      stopQrScanner();
    };
  }, [showQrScanner, rolls]);

  const dashboard = useMemo(() => {
    const totalWeight = rolls.reduce((sum, roll) => sum + Number(roll.available_weight_g), 0);
    const lowRolls = rolls.filter((roll) => roll.status === "low" || roll.status === "empty");
    const materials = new Set(rolls.map((roll) => roll.material));
    const inventoryCost = rolls.reduce((sum, roll) => {
      if (roll.currency !== userProfile.base_currency || roll.filament_cost_amount == null || !roll.initial_weight_g) return sum;
      return sum + (Number(roll.available_weight_g) / Number(roll.initial_weight_g)) * Number(roll.filament_cost_amount);
    }, 0);

    return {
      rollCount: rolls.length,
      totalWeight,
      lowCount: lowRolls.length,
      materialCount: materials.size,
      inventoryCost
    };
  }, [rolls, userProfile.base_currency]);

  const filteredRolls = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return rolls.filter((roll) => {
      const searchable = [
        roll.brand,
        roll.product_line,
        roll.material,
        roll.color_name,
        roll.location,
        roll.drying_notes
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !cleanQuery || searchable.includes(cleanQuery);
      const matchesBrand = brandFilter === "Todos" || roll.brand === brandFilter;
      const matchesMaterial = materialFilter === "Todos" || roll.material === materialFilter;
      const matchesLow = !lowOnly || roll.status === "low" || roll.status === "empty";

      return matchesQuery && matchesBrand && matchesMaterial && matchesLow;
    });
  }, [brandFilter, lowOnly, materialFilter, query, rolls]);

  const shoppingList = useMemo(
    () =>
      rolls
        .filter((roll) => roll.status === "low" || roll.status === "empty")
        .sort((a, b) => a.available_weight_g - b.available_weight_g),
    [rolls]
  );
  const emptySpools = spools.filter((spool) => spool.status === "empty");
  const unassignedRolls = rolls.filter(
    (roll) => !roll.spool_id && roll.status !== "archived" && roll.status !== "empty"
  );

  async function openReport() {
    setShowReport(true);
    setReportError("");
    if (!usingSupabase || !supabase) {
      setReportRows(buildLocalBalanceReport(rolls, spools));
      return;
    }

    setIsLoadingReport(true);
    const { data, error } = await supabase
      .from("filament_balance_report")
      .select("*")
      .order("available_weight_g", { ascending: true });
    setIsLoadingReport(false);
    if (error) {
      setReportRows([]);
      setReportError("No se pudo cargar el reporte. Tu inventario principal no fue modificado.");
      return;
    }
    setReportRows((data ?? []) as InventoryBalanceRow[]);
  }

  async function createPurchaseOrder(values: PurchaseOrderValues) {
    if (isSavingPurchaseOrder) return false;
    activateLocalMode();
    const selectedPurchases = values.purchase_ids
      .map((id) => effectivePurchases.find((purchase) => purchase.id === id))
      .filter(Boolean) as PurchaseRecord[];
    if (!selectedPurchases.length) {
      setSyncNote("Seleccioná al menos una compra para crear la orden.");
      return false;
    }
    const supplierKey = selectedPurchases[0].supplier_name.trim().toLowerCase();
    const currency = selectedPurchases[0].currency;
    if (selectedPurchases.some((purchase) => purchase.supplier_name.trim().toLowerCase() !== supplierKey || purchase.currency !== currency)) {
      setSyncNote("Una orden solo puede agrupar compras del mismo proveedor y moneda.");
      return false;
    }

    setIsSavingPurchaseOrder(true);
    const fingerprint = JSON.stringify({ ...values, purchase_ids: [...values.purchase_ids].sort() });
    try {
      if (usingSupabase && supabase) {
        const pending = purchaseOrderRequest.current;
        const request = pending?.fingerprint === fingerprint
          ? pending
          : { id: crypto.randomUUID(), fingerprint };
        purchaseOrderRequest.current = request;
        const { data, error } = await supabase.rpc("create_purchase_order_v2", {
          p_request_id: request.id,
          p_purchase_ids: values.purchase_ids,
          p_purchased_at: values.purchased_at,
          p_shipping_amount: values.shipping_amount,
          p_other_charges_amount: values.other_charges_amount,
          p_allocation_method: values.allocation_method,
          p_cost_confidence: values.cost_confidence,
          p_notes: values.notes || null,
          p_manual_allocations: values.manual_allocations,
          p_paid_amount: values.paid_amount,
          p_paid_currency: values.paid_currency,
          p_exchange_rate: values.exchange_rate,
          p_exchange_rate_date: values.exchange_rate_date,
          p_exchange_rate_kind: values.exchange_rate_kind,
          p_exchange_rate_source: values.exchange_rate_source || null
        });
        if (error || !data) {
          setSyncNote(`No se pudo confirmar la orden. Podés reintentar sin duplicarla: ${error?.message ?? "respuesta vacía"}`);
          return false;
        }
        const result = data as PurchaseOrderMutationResult;
        setPurchaseOrders((current) => [result.order, ...current.filter((order) => order.id !== result.order.id)]);
        setPurchaseOrderItems((current) => [
          ...result.items,
          ...current.filter((item) => !result.items.some((saved) => saved.id === item.id))
        ]);
        if (result.payment) {
          setPurchaseOrderPayments((current) => [
            result.payment as PurchaseOrderPayment,
            ...current.filter((payment) => payment.order_id !== result.payment?.order_id)
          ]);
        }
        purchaseOrderRequest.current = null;
        setSyncNote(result.replayed ? "Esta orden ya estaba guardada; recuperamos su resultado." : "Orden y prorrateo guardados correctamente.");
        return true;
      }

      const requestId = crypto.randomUUID();
      const result = buildLocalPurchaseOrder(requestId, values, selectedPurchases);
      setPurchaseOrders((current) => [result.order, ...current]);
      setPurchaseOrderItems((current) => [...result.items, ...current]);
      if (result.payment) setPurchaseOrderPayments((current) => [result.payment as PurchaseOrderPayment, ...current]);
      setSyncNote("Orden guardada en este dispositivo.");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo confirmar la orden. Podés reintentar sin duplicarla: ${message}`);
      return false;
    } finally {
      setIsSavingPurchaseOrder(false);
    }
  }

  async function saveProfile(values: ProfileValues) {
    if (isSavingProfile) return false;
    setIsSavingProfile(true);

    try {
      if (usingSupabase && supabase) {
        const { data, error } = await supabase.rpc("save_user_profile", {
          p_display_name: values.display_name || null,
          p_base_currency: values.base_currency,
          p_billing_name: values.billing_name || null,
          p_billing_tax_id: values.billing_tax_id || null,
          p_billing_email: values.billing_email || null,
          p_billing_address: values.billing_address || null
        });

        if (error || !data) {
          setSyncNote(`No se pudo guardar el perfil: ${error?.message ?? "respuesta vacía"}`);
          return false;
        }

        setUserProfile(data as UserProfile);
        setSyncNote("Perfil y preferencias financieras guardados.");
        return true;
      }

      const localProfile: UserProfile = {
        ...userProfile,
        user_id: signedInUserId || "local",
        display_name: values.display_name.trim() || null,
        base_currency: values.base_currency,
        billing_name: values.billing_name.trim() || null,
        billing_tax_id: values.billing_tax_id.trim() || null,
        billing_email: values.billing_email.trim() || null,
        billing_address: values.billing_address.trim() || null,
        updated_at: new Date().toISOString()
      };
      setUserProfile(localProfile);
      setDataMode("local");
      setSyncNote("Perfil guardado en este dispositivo.");
      return true;
    } catch (error) {
      setSyncNote(`No se pudo guardar el perfil: ${error instanceof Error ? error.message : "error inesperado"}`);
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function addRoll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAddingRoll) return;
    activateLocalMode();

    const form = new FormData(event.currentTarget);
    const initialWeight = parseNumber(form.get("initial_weight_g"), 1000);
    const availableWeight = parseNumber(form.get("available_weight_g"), initialWeight);
    const threshold = parseNumber(form.get("low_threshold_g"), 200);
    const packageType = String(form.get("package_type") || "refill") as PackageType;
    const totalPrice = form.get("price_amount") ? parseNumber(form.get("price_amount")) : null;
    const spoolCost = packageType === "spooled" ? parseNumber(form.get("spool_cost_amount"), 1000) : 0;
    const filamentCost = totalPrice === null ? null : Math.max(0, totalPrice - spoolCost);
    const supplierName = String(form.get("supplier_name") || "Sin proveedor").trim() || "Sin proveedor";
    const scannedQrPayload = pendingQrPayload.trim();

    if (availableWeight < 0 || availableWeight > initialWeight) {
      setSyncNote("El peso disponible debe estar entre cero y el peso inicial.");
      return;
    }

    if (totalPrice !== null && spoolCost > totalPrice) {
      setSyncNote("El precio total debe cubrir el costo del spool.");
      return;
    }

    const newRoll: FilamentRoll = {
      id: crypto.randomUUID(),
      brand: String(form.get("brand") || "Bambu Lab"),
      product_line: String(form.get("product_line") || "Genérico"),
      material: String(form.get("material") || "PLA"),
      color_name: String(form.get("color_name") || "Sin nombre"),
      color_hex: String(form.get("color_hex") || "#999999"),
      initial_weight_g: initialWeight,
      available_weight_g: availableWeight,
      low_threshold_g: threshold,
      status: normalizeStatus(availableWeight, threshold, availableWeight < initialWeight ? "open" : "new"),
      location: String(form.get("location") || ""),
      purchase_date: String(form.get("purchase_date") || ""),
      price_amount: totalPrice,
      currency: String(form.get("currency") || "CRC"),
      supplier_id: null,
      supplier_name: supplierName,
      package_type: packageType,
      spool_id: null,
      spool_cost_amount: spoolCost,
      filament_cost_amount: filamentCost,
      drying_notes: String(form.get("drying_notes") || ""),
      photo_url: String(form.get("photo_url") || ""),
      purchase_url: String(form.get("purchase_url") || ""),
      nfc_tag_id: null,
      qr_payload: scannedQrPayload || null
    };

    setIsAddingRoll(true);

    try {
      if (usingSupabase && supabase) {
        const requestId = addRollRequestId.current ?? crypto.randomUUID();
        addRollRequestId.current = requestId;

        const { data, error } = await supabase.rpc("create_roll_with_purchase", {
          p_request_id: requestId,
          p_brand: newRoll.brand,
          p_product_line: newRoll.product_line,
          p_material: newRoll.material,
          p_color_name: newRoll.color_name,
          p_color_hex: newRoll.color_hex,
          p_initial_weight_g: newRoll.initial_weight_g,
          p_available_weight_g: newRoll.available_weight_g,
          p_low_threshold_g: newRoll.low_threshold_g,
          p_location: newRoll.location || null,
          p_purchase_date: newRoll.purchase_date || null,
          p_total_price: newRoll.price_amount,
          p_currency: newRoll.currency,
          p_supplier_name: supplierName,
          p_package_type: newRoll.package_type,
          p_spool_cost: newRoll.spool_cost_amount,
          p_drying_notes: newRoll.drying_notes || null,
          p_photo_url: newRoll.photo_url || null,
          p_purchase_url: newRoll.purchase_url || null
        });

        if (error || !data) {
          setSyncNote(
            `No se pudo confirmar el alta. Podés reintentar sin duplicar datos: ${error?.message ?? "respuesta vacía"}`
          );
          return;
        }

        const result = data as AtomicRollCreationResult;
        let savedRoll = normalizeRollData(result.roll);
        let tagErrorMessage = "";

        if (scannedQrPayload) {
          const { data: taggedRoll, error: tagError } = await supabase
            .from("filament_rolls")
            .update({ qr_payload: scannedQrPayload })
            .eq("id", savedRoll.id)
            .select("*")
            .single();

          if (tagError) {
            tagErrorMessage = `Rollo guardado, pero no pude vincular la etiqueta QR: ${tagError.message}`;
          } else if (taggedRoll) {
            savedRoll = normalizeRollData(taggedRoll as FilamentRoll);
          }
        }

        setRolls((current) => [savedRoll, ...current.filter((roll) => roll.id !== savedRoll.id)]);
        setSelectedId(savedRoll.id);

        if (result.supplier) {
          setSuppliers((current) =>
            [result.supplier as Supplier, ...current.filter((supplier) => supplier.id !== result.supplier?.id)]
              .sort((a, b) => a.name.localeCompare(b.name))
          );
        }

        if (result.purchase) {
          setPurchases((current) => [
            result.purchase as PurchaseRecord,
            ...current.filter((purchase) => purchase.id !== result.purchase?.id)
          ]);
        }

        setSyncNote(
          tagErrorMessage ||
          (result.replayed
            ? "Esta operación ya estaba guardada; recuperamos el rollo y su compra."
            : scannedQrPayload
              ? "Rollo, proveedor, compra y etiqueta QR guardados correctamente."
              : "Rollo, proveedor y compra guardados correctamente.")
        );
        addRollRequestId.current = null;
      } else {
        setRolls((current) => [newRoll, ...current]);
        setSelectedId(newRoll.id);
        if (totalPrice !== null) {
          setPurchases((current) => [
            {
              id: crypto.randomUUID(),
              roll_id: newRoll.id,
              supplier_id: null,
              supplier_name: supplierName,
              brand: newRoll.brand,
              material: newRoll.material,
              product_line: newRoll.product_line,
              color_name: newRoll.color_name,
              color_hex: newRoll.color_hex,
              purchased_at: newRoll.purchase_date || todayIso(),
              package_type: packageType,
              total_price: totalPrice,
              spool_cost: spoolCost,
              filament_cost: filamentCost ?? totalPrice,
              currency: newRoll.currency,
              quantity_g: initialWeight
            },
            ...current
          ]);
        }
        setSyncNote(scannedQrPayload ? "Rollo y etiqueta QR guardados en el inventario local." : "Rollo guardado en el inventario local.");
      }

      setDraft(initialDraft);
      setPendingQrPayload("");
      setShowAdd(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo confirmar el alta. Podés reintentar sin duplicar datos: ${message}`);
    } finally {
      setIsAddingRoll(false);
    }
  }

  async function updateRoll(values: EditableRollValues) {
    const roll = rolls.find((item) => item.id === editingRollId);
    if (!roll || isUpdatingRoll) return;
    activateLocalMode();

    if (values.initial_weight_g < Number(roll.available_weight_g)) {
      setSyncNote(`El peso inicial no puede ser menor a los ${roll.available_weight_g} g disponibles.`);
      return;
    }
    if (values.low_threshold_g < 0 || values.low_threshold_g > values.initial_weight_g) {
      setSyncNote("El umbral bajo debe estar entre cero y el peso inicial.");
      return;
    }

    setIsUpdatingRoll(true);
    try {
      if (usingSupabase && supabase) {
        const requestId = updateRollRequests.current[roll.id] ?? crypto.randomUUID();
        updateRollRequests.current[roll.id] = requestId;
        const { data, error } = await supabase.rpc("update_filament_roll", {
          p_request_id: requestId,
          p_roll_id: roll.id,
          p_brand: values.brand,
          p_product_line: values.product_line || null,
          p_material: values.material,
          p_color_name: values.color_name,
          p_color_hex: values.color_hex,
          p_initial_weight_g: values.initial_weight_g,
          p_low_threshold_g: values.low_threshold_g,
          p_location: values.location || null,
          p_drying_notes: values.drying_notes || null,
          p_photo_url: values.photo_url || null,
          p_purchase_url: values.purchase_url || null
        });

        if (error || !data) {
          setSyncNote(
            `No se pudo confirmar la edición. Podés reintentar sin repetirla: ${error?.message ?? "respuesta vacía"}`
          );
          return;
        }

        const result = data as RollUpdateResult;
        const savedRoll = normalizeRollData(result.roll);
        setRolls((current) => current.map((item) => item.id === savedRoll.id ? savedRoll : item));
        setSyncNote(result.replayed
          ? "Esta edición ya estaba guardada; recuperamos su resultado."
          : `Filamento ${savedRoll.color_name} actualizado correctamente.`);
        delete updateRollRequests.current[roll.id];
      } else {
        const nextStatus = roll.status === "archived"
          ? "archived"
          : normalizeStatus(Number(roll.available_weight_g), values.low_threshold_g,
            Number(roll.available_weight_g) < values.initial_weight_g ? "open" : "new");
        setRolls((current) => current.map((item) => item.id === roll.id
          ? { ...item, ...values, product_line: values.product_line || null, status: nextStatus }
          : item));
        setSyncNote(`Filamento ${values.color_name} actualizado en el inventario local.`);
      }

      setEditingRollId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo confirmar la edición. Podés reintentar sin repetirla: ${message}`);
    } finally {
      setIsUpdatingRoll(false);
    }
  }

  async function correctPurchase(values: PurchaseCorrectionValues) {
    if (!correctingPurchase || isCorrectingPurchase) return;
    activateLocalMode();

    if (!values.supplier_name.trim()) {
      setSyncNote("El proveedor es requerido para corregir la compra.");
      return;
    }
    if (!values.purchased_at) {
      setSyncNote("La fecha de compra es requerida.");
      return;
    }
    if (values.total_price < 0 || values.spool_cost < 0 || values.spool_cost > values.total_price) {
      setSyncNote("El costo del spool debe estar entre cero y el precio total.");
      return;
    }
    if (values.reason.trim().length < 3) {
      setSyncNote("Indicá brevemente por qué se corrige esta compra.");
      return;
    }

    const purchase = correctingPurchase.original;
    const fingerprint = JSON.stringify(values);
    setIsCorrectingPurchase(true);

    try {
      if (usingSupabase && supabase) {
        const pending = purchaseCorrectionRequests.current[purchase.id];
        const request = pending?.fingerprint === fingerprint
          ? pending
          : { id: crypto.randomUUID(), fingerprint };
        purchaseCorrectionRequests.current[purchase.id] = request;

        const { data, error } = await supabase.rpc("correct_purchase", {
          p_request_id: request.id,
          p_purchase_id: purchase.id,
          p_supplier_name: values.supplier_name.trim(),
          p_purchased_at: values.purchased_at,
          p_package_type: values.package_type,
          p_total_price: values.total_price,
          p_spool_cost: values.spool_cost,
          p_currency: values.currency,
          p_reason: values.reason.trim()
        });

        if (error || !data) {
          setSyncNote(
            `No se pudo confirmar la corrección. Podés reintentar sin duplicarla: ${error?.message ?? "respuesta vacía"}`
          );
          return;
        }

        const result = data as PurchaseCorrectionResult;
        const savedCorrection = {
          ...result.correction,
          total_price: Number(result.correction.total_price),
          spool_cost: Number(result.correction.spool_cost),
          filament_cost: Number(result.correction.filament_cost),
          quantity_g: Number(result.correction.quantity_g)
        };
        setPurchaseCorrections((current) => [
          savedCorrection,
          ...current.filter((correction) => correction.id !== savedCorrection.id)
        ]);

        if (result.roll) {
          const savedRoll = normalizeRollData({
            ...result.roll,
            supplier_name: result.supplier?.name ?? values.supplier_name.trim()
          });
          setRolls((current) => current.map((roll) => roll.id === savedRoll.id ? savedRoll : roll));
        }
        if (result.supplier) {
          setSuppliers((current) => [
            result.supplier as Supplier,
            ...current.filter((supplier) => supplier.id !== result.supplier?.id)
          ]);
        }

        setSyncNote(result.replayed
          ? "Esta corrección ya estaba guardada; recuperamos el resultado sin duplicarla."
          : "Compra corregida y costo vigente actualizado en una sola operación.");
        delete purchaseCorrectionRequests.current[purchase.id];
      } else {
        const requestId = crypto.randomUUID();
        const correction: PurchaseCorrection = {
          id: crypto.randomUUID(),
          request_id: requestId,
          purchase_id: purchase.id,
          roll_id: purchase.roll_id,
          supplier_id: null,
          supplier_name: values.supplier_name.trim(),
          purchased_at: values.purchased_at,
          package_type: values.package_type,
          total_price: values.total_price,
          spool_cost: values.spool_cost,
          filament_cost: values.total_price - values.spool_cost,
          currency: values.currency,
          quantity_g: Number(correctingPurchase.effective.quantity_g),
          reason: values.reason.trim(),
          corrected_at: new Date().toISOString()
        };
        setPurchaseCorrections((current) => [correction, ...current]);
        if (purchase.roll_id) {
          setRolls((current) => current.map((roll) => roll.id === purchase.roll_id
            ? {
                ...roll,
                supplier_name: correction.supplier_name,
                supplier_id: correction.supplier_id,
                purchase_date: correction.purchased_at,
                price_amount: correction.total_price,
                currency: correction.currency,
                package_type: correction.package_type,
                spool_cost_amount: correction.spool_cost,
                filament_cost_amount: correction.filament_cost
              }
            : roll));
        }
        setSyncNote("Compra corregida en el inventario local con su registro de auditoría.");
      }

      setCorrectingPurchaseId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo confirmar la corrección. Podés reintentar sin duplicarla: ${message}`);
    } finally {
      setIsCorrectingPurchase(false);
    }
  }

  async function registerMissingPurchase(values: MissingPurchaseValues) {
    if (!missingPurchaseRoll || isAddingMissingPurchase) return;
    activateLocalMode();

    if (!values.supplier_name.trim()) {
      setSyncNote("El proveedor es requerido para registrar la compra.");
      return;
    }
    if (!values.purchased_at) {
      setSyncNote("La fecha de compra es requerida.");
      return;
    }
    if (values.total_price < 0 || values.spool_cost < 0 || values.spool_cost > values.total_price) {
      setSyncNote("El costo del spool debe estar entre cero y el precio total.");
      return;
    }

    const roll = missingPurchaseRoll;
    const fingerprint = JSON.stringify(values);
    setIsAddingMissingPurchase(true);

    try {
      if (usingSupabase && supabase) {
        const pending = missingPurchaseRequests.current[roll.id];
        const request = pending?.fingerprint === fingerprint
          ? pending
          : { id: crypto.randomUUID(), fingerprint };
        missingPurchaseRequests.current[roll.id] = request;

        const { data, error } = await supabase.rpc("register_missing_purchase", {
          p_request_id: request.id,
          p_roll_id: roll.id,
          p_supplier_name: values.supplier_name.trim(),
          p_purchased_at: values.purchased_at,
          p_package_type: values.package_type,
          p_total_price: values.total_price,
          p_spool_cost: values.spool_cost,
          p_currency: values.currency
        });

        if (error || !data) {
          setSyncNote(
            `No se pudo confirmar la compra faltante. Podés reintentar sin duplicarla: ${error?.message ?? "respuesta vacía"}`
          );
          return;
        }

        const result = data as MissingPurchaseResult;
        const savedPurchase = {
          ...result.purchase,
          total_price: Number(result.purchase.total_price),
          spool_cost: Number(result.purchase.spool_cost),
          filament_cost: Number(result.purchase.filament_cost),
          quantity_g: Number(result.purchase.quantity_g)
        };
        const savedRoll = normalizeRollData({
          ...result.roll,
          supplier_name: result.supplier.name
        });

        setPurchases((current) => [
          savedPurchase,
          ...current.filter((purchase) => purchase.id !== savedPurchase.id)
        ]);
        setRolls((current) => current.map((item) => item.id === savedRoll.id ? savedRoll : item));
        setSuppliers((current) => [
          result.supplier,
          ...current.filter((supplier) => supplier.id !== result.supplier.id)
        ].sort((a, b) => a.name.localeCompare(b.name)));
        setSyncNote(result.replayed
          ? "Esta compra ya estaba guardada; recuperamos el resultado sin duplicarla."
          : "Compra faltante registrada y costo vigente actualizado en una sola operación.");
        delete missingPurchaseRequests.current[roll.id];
      } else {
        const purchase: PurchaseRecord = {
          id: crypto.randomUUID(),
          roll_id: roll.id,
          supplier_id: null,
          supplier_name: values.supplier_name.trim(),
          brand: roll.brand,
          material: roll.material,
          product_line: roll.product_line,
          color_name: roll.color_name,
          color_hex: roll.color_hex,
          purchased_at: values.purchased_at,
          package_type: values.package_type,
          total_price: values.total_price,
          spool_cost: values.spool_cost,
          filament_cost: values.total_price - values.spool_cost,
          currency: values.currency,
          quantity_g: Number(roll.initial_weight_g)
        };
        setPurchases((current) => [purchase, ...current]);
        setRolls((current) => current.map((item) => item.id === roll.id
          ? {
              ...item,
              supplier_id: null,
              supplier_name: purchase.supplier_name,
              purchase_date: purchase.purchased_at,
              price_amount: purchase.total_price,
              currency: purchase.currency,
              package_type: purchase.package_type,
              spool_cost_amount: purchase.spool_cost,
              filament_cost_amount: purchase.filament_cost
            }
          : item));
        setSyncNote("Compra faltante registrada en el inventario local.");
      }

      setMissingPurchaseRollId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo confirmar la compra faltante. Podés reintentar sin duplicarla: ${message}`);
    } finally {
      setIsAddingMissingPurchase(false);
    }
  }

  async function recordConsumption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoll || isRecordingConsumption) return;
    activateLocalMode();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const grams = parseNumber(form.get("grams_used"));
    if (grams <= 0) return;
    if (grams > Number(selectedRoll.available_weight_g)) {
      setSyncNote(`Solo hay ${selectedRoll.available_weight_g} g disponibles en este rollo.`);
      return;
    }
    const costPerGram = selectedRoll.filament_cost_amount && selectedRoll.initial_weight_g
      ? Number(selectedRoll.filament_cost_amount) / Number(selectedRoll.initial_weight_g)
      : null;

    const log: ConsumptionLog = {
      id: crypto.randomUUID(),
      roll_id: selectedRoll.id,
      project_name: String(form.get("project_name") || "Proyecto sin nombre"),
      grams_used: grams,
      consumed_at: String(form.get("consumed_at") || todayIso()),
      notes: String(form.get("notes") || ""),
      cost_amount: costPerGram === null ? null : grams * costPerGram,
      currency: costPerGram === null ? null : selectedRoll.currency
    };

    setIsRecordingConsumption(true);

    try {
      if (usingSupabase && supabase) {
        if (!consumptionRequest.current || consumptionRequest.current.rollId !== selectedRoll.id) {
          consumptionRequest.current = { id: crypto.randomUUID(), rollId: selectedRoll.id };
        }

        const { data, error } = await supabase.rpc("record_consumption", {
          p_request_id: consumptionRequest.current.id,
          p_roll_id: selectedRoll.id,
          p_project_name: log.project_name,
          p_grams_used: log.grams_used,
          p_consumed_at: log.consumed_at,
          p_notes: log.notes || null
        });

        if (error || !data) {
          setSyncNote(
            `No se pudo confirmar el consumo. Podés reintentar sin descontar dos veces: ${error?.message ?? "respuesta vacía"}`
          );
          return;
        }

        const result = data as ConsumptionMutationResult;
        const savedRoll = normalizeRollData(result.roll);
        setRolls((current) =>
          current.map((roll) => (roll.id === savedRoll.id ? savedRoll : roll))
        );
        setLogs((current) => [result.log, ...current.filter((item) => item.id !== result.log.id)]);
        setSyncNote(
          result.replayed
            ? "Este consumo ya estaba registrado; recuperamos su resultado sin descontar de nuevo."
            : `${grams} g descontados correctamente.`
        );
        consumptionRequest.current = null;
      } else {
        setRolls((current) =>
          current.map((roll) => {
            if (roll.id !== selectedRoll.id) return roll;
            const nextWeight = Math.max(0, Number(roll.available_weight_g) - grams);
            return {
              ...roll,
              available_weight_g: nextWeight,
              status: normalizeStatus(nextWeight, roll.low_threshold_g, roll.status)
            };
          })
        );
        setLogs((current) => [log, ...current]);
        setSyncNote(`${grams} g descontados del inventario local.`);
      }

      formElement.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo confirmar el consumo. Podés reintentar sin descontar dos veces: ${message}`);
    } finally {
      setIsRecordingConsumption(false);
    }
  }

  async function saveAvailableWeight(availableWeight: number, successNote: string, input: WeightInput) {
    if (!selectedRoll || isSavingWeight) return false;
    activateLocalMode();

    const currentStatus = availableWeight < Number(selectedRoll.initial_weight_g) && selectedRoll.status === "new"
      ? "open"
      : selectedRoll.status;
    const status = normalizeStatus(availableWeight, selectedRoll.low_threshold_g, currentStatus);

    setIsSavingWeight(true);

    try {
      if (usingSupabase && supabase) {
        const fingerprint = JSON.stringify({ availableWeight, ...input });
        if (
          !weightRequest.current
          || weightRequest.current.rollId !== selectedRoll.id
          || weightRequest.current.fingerprint !== fingerprint
        ) {
          weightRequest.current = {
            id: crypto.randomUUID(),
            rollId: selectedRoll.id,
            fingerprint
          };
        }

        const { data, error } = await supabase.rpc("record_roll_weight", {
          p_request_id: weightRequest.current.id,
          p_roll_id: selectedRoll.id,
          p_measurement_kind: input.kind,
          p_gross_weight_g: input.grossWeight,
          p_tare_weight_g: input.tareWeight,
          p_available_weight_g: availableWeight,
          p_spool_type_id: input.spoolTypeId,
          p_tare_confidence: input.confidence,
          p_weight_source: input.source,
          p_notes: null
        });

        if (error || !data) {
          setSyncNote(
            `No se pudo confirmar el pesaje. Podés reintentar sin duplicar el historial: ${error?.message ?? "respuesta vacía"}`
          );
          return false;
        }

        const result = data as WeightMutationResult;
        const savedRoll = normalizeRollData(result.roll);
        setRolls((current) =>
          current.map((roll) => (roll.id === savedRoll.id ? savedRoll : roll))
        );
        setWeighingEvents((current) => [
          result.event,
          ...current.filter((event) => event.id !== result.event.id)
        ]);
        setSyncNote(result.replayed
          ? "Este pesaje ya estaba guardado; recuperamos el resultado sin duplicarlo."
          : successNote);
        weightRequest.current = null;
        return true;
      }

      const localEvent: WeighingEvent = {
        id: crypto.randomUUID(),
        request_id: crypto.randomUUID(),
        roll_id: selectedRoll.id,
        spool_id: selectedRoll.spool_id,
        spool_type_id: input.spoolTypeId,
        measurement_kind: input.kind,
        gross_weight_g: input.grossWeight,
        tare_weight_g: input.tareWeight,
        available_weight_g: availableWeight,
        tare_confidence: input.confidence,
        weight_source: input.source,
        notes: null,
        measured_at: new Date().toISOString()
      };
      setRolls((current) =>
        current.map((roll) =>
          roll.id === selectedRoll.id
            ? { ...roll, available_weight_g: availableWeight, status }
            : roll
        )
      );
      setWeighingEvents((current) => [localEvent, ...current]);
      setSyncNote(successNote);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo ajustar el peso: ${message}`);
      return false;
    } finally {
      setIsSavingWeight(false);
    }
  }

  async function adjustAvailableWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoll) return;
    const form = new FormData(event.currentTarget);
    const availableWeight = Math.min(
      Number(selectedRoll.initial_weight_g),
      Math.max(0, parseNumber(form.get("available_weight_g"), selectedRoll.available_weight_g))
    );
    await saveAvailableWeight(
      availableWeight,
      usingSupabase ? "Ajuste manual guardado con historial" : "Peso actualizado en el inventario local",
      {
        kind: "manual",
        grossWeight: null,
        tareWeight: null,
        spoolTypeId: null,
        confidence: "unknown",
        source: "Ajuste manual"
      }
    );
  }

  async function adjustFromMeasuredWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoll) return;
    const form = new FormData(event.currentTarget);
    const totalWeight = parseNumber(form.get("measured_total_weight_g"), -1);
    const tareWeight = parseNumber(form.get("tare_weight_g"), -1);
    const calculatedWeight = Math.round((totalWeight - tareWeight) * 100) / 100;

    if (totalWeight < 0 || tareWeight < 0 || calculatedWeight < 0) {
      setSyncNote("Revisá el peso total y la tara: el resultado no puede ser negativo.");
      return;
    }
    if (calculatedWeight > Number(selectedRoll.initial_weight_g)) {
      setSyncNote(`El resultado supera los ${selectedRoll.initial_weight_g} g nominales del rollo. Revisá la tara.`);
      return;
    }

    const saved = await saveAvailableWeight(
      calculatedWeight,
      `Balanza: ${totalWeight} g − tara ${tareWeight} g = ${calculatedWeight} g disponibles`,
      {
        kind: "scale",
        grossWeight: totalWeight,
        tareWeight,
        spoolTypeId: weighingSpoolTypeId || null,
        confidence: weighingConfidence,
        source: spoolTypes.find((type) => type.id === weighingSpoolTypeId)?.weight_source ?? "Tara indicada manualmente"
      }
    );
    if (saved) {
      setMeasuredTotalWeight("");
      if (event.currentTarget.id === "quick-weigh-sheet") setShowQuickWeigh(false);
    }
  }

  async function addSpool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingSpoolAction) return;
    activateLocalMode();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const spoolTypeId = String(form.get("spool_type_id") || "");
    const spoolType = spoolTypes.find((type) => type.id === spoolTypeId);
    const spool: Spool = {
      id: crypto.randomUUID(),
      code: String(form.get("code") || `SP-${String(spools.length + 1).padStart(3, "0")}`),
      brand: spoolType?.manufacturer ?? String(form.get("brand") || "Bambu Lab"),
      spool_material: spoolType?.material ?? String(form.get("spool_material") || "Plástico reutilizable"),
      tare_weight_g: spoolType?.total_tare_g ?? (form.get("tare_weight_g") ? parseNumber(form.get("tare_weight_g")) : null),
      acquisition_cost: parseNumber(form.get("acquisition_cost"), 1000),
      currency: String(form.get("currency") || "CRC"),
      status: "empty",
      notes: String(form.get("notes") || ""),
      spool_type_id: spoolTypeId || null
    };

    setPendingSpoolAction("create");
    try {
      if (usingSupabase && supabase) {
        const requestId = createSpoolRequestId.current ?? crypto.randomUUID();
        createSpoolRequestId.current = requestId;
        const { data, error } = await supabase.rpc("create_spool", {
          p_request_id: requestId,
          p_code: spool.code,
          p_spool_type_id: spool.spool_type_id || null,
          p_brand: spool.brand,
          p_spool_material: spool.spool_material,
          p_tare_weight_g: spool.tare_weight_g,
          p_acquisition_cost: spool.acquisition_cost,
          p_currency: spool.currency,
          p_notes: spool.notes || null
        });

        if (error || !data) {
          setSyncNote(
            `No se pudo confirmar el spool. Podés reintentar sin duplicarlo: ${error?.message ?? "respuesta vacía"}`
          );
          return;
        }
        const result = data as SpoolWriteResult;
        setSpools((current) => [
          result.spool,
          ...current.filter((item) => item.id !== result.spool.id)
        ].sort((a, b) => a.code.localeCompare(b.code)));
        setSyncNote(result.replayed
          ? `El spool ${result.spool.code} ya estaba guardado; recuperamos su resultado.`
          : `Spool ${result.spool.code} agregado como vacío`);
        createSpoolRequestId.current = null;
      } else {
        setSpools((current) => [...current, spool].sort((a, b) => a.code.localeCompare(b.code)));
        setSyncNote(`Spool ${spool.code} agregado como vacío`);
      }

      formElement.reset();
      setNewSpoolTypeId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo confirmar el spool. Podés reintentar sin duplicarlo: ${message}`);
    } finally {
      setPendingSpoolAction("");
    }
  }

  async function assignSpool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingSpoolAction) return;
    activateLocalMode();
    const form = new FormData(event.currentTarget);
    const rollId = String(form.get("roll_id") || "");
    const spoolId = String(form.get("spool_id") || "");
    if (!rollId || !spoolId) return;

    setPendingSpoolAction("assign");
    try {
      if (usingSupabase && supabase) {
        const { data, error } = await supabase.rpc("assign_spool_to_roll", {
          p_roll_id: rollId,
          p_spool_id: spoolId
        });
        if (error) {
          setSyncNote(`No se pudo asignar el spool: ${error.message}`);
          return;
        }

        const result = data as SpoolMutationResult;
        setRolls((current) => current.map((roll) => roll.id === rollId ? result.roll ?? roll : roll));
        setSpools((current) => current.map((spool) => spool.id === spoolId ? result.spool : spool));
      } else {
        setRolls((current) => current.map((roll) => roll.id === rollId ? { ...roll, spool_id: spoolId } : roll));
        setSpools((current) => current.map((spool) => spool.id === spoolId ? { ...spool, status: "in_use" } : spool));
      }

      const assignedSpool = spools.find((spool) => spool.id === spoolId);
      setSyncNote(`Spool ${assignedSpool?.code ?? ""} asignado correctamente`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo asignar el spool: ${message}`);
    } finally {
      setPendingSpoolAction("");
    }
  }

  async function releaseSpool(roll: FilamentRoll) {
    if (!roll.spool_id || pendingSpoolAction) return;
    activateLocalMode();
    const spoolId = roll.spool_id;

    setPendingSpoolAction(`release:${spoolId}`);
    try {
      if (usingSupabase && supabase) {
        const { data, error } = await supabase.rpc("release_spool_from_roll", {
          p_roll_id: roll.id,
          p_retire: false
        });
        if (error) {
          setSyncNote(`No se pudo liberar el spool: ${error.message}`);
          return;
        }
        const result = data as SpoolMutationResult;
        setRolls((current) => current.map((item) => item.id === roll.id ? result.roll ?? item : item));
        setSpools((current) => current.map((spool) => spool.id === spoolId ? result.spool : spool));
      } else {
        setRolls((current) => current.map((item) => item.id === roll.id ? { ...item, spool_id: null } : item));
        setSpools((current) => current.map((spool) => spool.id === spoolId ? { ...spool, status: "empty" } : spool));
      }
      setSyncNote("Spool liberado y disponible");
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo liberar el spool: ${message}`);
    } finally {
      setPendingSpoolAction("");
    }
  }

  async function updateSpool(event: React.FormEvent<HTMLFormElement>, spool: Spool) {
    event.preventDefault();
    if (pendingSpoolAction) return;
    activateLocalMode();
    const form = new FormData(event.currentTarget);
    const spoolTypeId = String(form.get("spool_type_id") || "");
    const spoolType = spoolTypes.find((type) => type.id === spoolTypeId);
    const updates: Partial<Spool> = {
      code: String(form.get("code") || spool.code).trim(),
      brand: spoolType?.manufacturer ?? (String(form.get("brand") || "").trim() || null),
      spool_material: spoolType?.material ?? String(form.get("spool_material") || spool.spool_material),
      tare_weight_g: spoolType?.total_tare_g ?? (form.get("tare_weight_g") ? parseNumber(form.get("tare_weight_g")) : null),
      acquisition_cost: parseNumber(form.get("acquisition_cost"), 0),
      currency: String(form.get("currency") || spool.currency),
      notes: String(form.get("notes") || "").trim() || null,
      spool_type_id: spoolTypeId || null
    };

    setPendingSpoolAction(`update:${spool.id}`);
    try {
      if (usingSupabase && supabase) {
        const requestId = updateSpoolRequests.current[spool.id] ?? crypto.randomUUID();
        updateSpoolRequests.current[spool.id] = requestId;
        const { data, error } = await supabase.rpc("update_spool", {
          p_request_id: requestId,
          p_spool_id: spool.id,
          p_code: updates.code,
          p_spool_type_id: updates.spool_type_id || null,
          p_brand: updates.brand,
          p_spool_material: updates.spool_material,
          p_tare_weight_g: updates.tare_weight_g,
          p_acquisition_cost: updates.acquisition_cost,
          p_currency: updates.currency,
          p_notes: updates.notes
        });
        if (error || !data) {
          setSyncNote(
            `No se pudo confirmar la edición. Podés reintentar sin repetirla: ${error?.message ?? "respuesta vacía"}`
          );
          return;
        }
        const result = data as SpoolWriteResult;
        setSpools((current) => current
          .map((item) => item.id === spool.id ? result.spool : item)
          .sort((a, b) => a.code.localeCompare(b.code)));
        setSyncNote(result.replayed
          ? `La edición del spool ${result.spool.code} ya estaba guardada.`
          : `Spool ${result.spool.code} actualizado`);
        delete updateSpoolRequests.current[spool.id];
      } else {
        setSpools((current) => current
          .map((item) => item.id === spool.id ? { ...item, ...updates } : item)
          .sort((a, b) => a.code.localeCompare(b.code)));
        setSyncNote(`Spool ${updates.code} actualizado`);
      }

      setEditingSpoolId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo confirmar la edición. Podés reintentar sin repetirla: ${message}`);
    } finally {
      setPendingSpoolAction("");
    }
  }

  async function toggleSpoolRetired(spool: Spool) {
    if (pendingSpoolAction) return;
    activateLocalMode();
    const retiring = spool.status !== "retired";
    const assignedRoll = rolls.find((roll) => roll.spool_id === spool.id);

    setPendingSpoolAction(`retire:${spool.id}`);
    try {
      if (usingSupabase && supabase) {
        const { data, error } = await supabase.rpc("set_spool_retired", {
          p_spool_id: spool.id,
          p_retired: retiring
        });
        if (error) {
          setSyncNote(`No se pudo ${retiring ? "inactivar" : "reactivar"} el spool: ${error.message}`);
          return;
        }
        const result = data as SpoolMutationResult;
        setSpools((current) => current.map((item) => item.id === spool.id ? result.spool : item));
        if (result.roll) {
          setRolls((current) => current.map((roll) => roll.id === result.roll?.id ? result.roll : roll));
        }
      } else {
        if (assignedRoll) {
          setRolls((current) => current.map((roll) => roll.id === assignedRoll.id ? { ...roll, spool_id: null } : roll));
        }
        setSpools((current) => current.map((item) => item.id === spool.id
          ? { ...item, status: retiring ? "retired" : "empty" }
          : item));
      }

      setEditingSpoolId("");
      setSyncNote(retiring
        ? `Spool ${spool.code} inactivado${assignedRoll ? " y filamento liberado" : ""}`
        : `Spool ${spool.code} reactivado como vacío`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "error inesperado";
      setSyncNote(`No se pudo ${retiring ? "inactivar" : "reactivar"} el spool: ${message}`);
    } finally {
      setPendingSpoolAction("");
    }
  }

  function stopQrScanner() {
    if (qrFrameRef.current) {
      window.cancelAnimationFrame(qrFrameRef.current);
      qrFrameRef.current = null;
    }

    qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    qrStreamRef.current = null;

    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
  }

  function closeQrScanner() {
    stopQrScanner();
    setShowQrScanner(false);
  }

  function closeAddRoll() {
    if (isAddingRoll) return;
    setShowAdd(false);
    setPendingQrPayload("");
  }

  function selectRollFromScannedPayload(payload: string) {
    const found = rolls.find((roll) => payloadMatchesRoll(roll, payload));

    if (!found) {
      stopQrScanner();
      setPendingQrPayload(payload.trim());
      setQrScanNote("Leí una etiqueta nueva. Podés crear un rollo y dejarla vinculada.");
      return false;
    }

    setSelectedId(found.id);
    setQrScanNote(`Rollo detectado: ${found.brand} ${found.color_name}.`);
    setSyncNote(`Rollo detectado por QR: ${found.brand} ${found.color_name}`);
    closeQrScanner();
    setScanActionRollId(found.id);
    return true;
  }

  function addRollFromScannedPayload() {
    stopQrScanner();
    setShowQrScanner(false);
    setScanActionRollId("");
    setShowAdd(true);
    setSyncNote("Etiqueta QR lista para vincularse al nuevo rollo.");
  }

  function closeScanActions() {
    setScanActionRollId("");
  }

  function showScannedRollDetail() {
    closeScanActions();
    window.setTimeout(() => {
      document.getElementById("inventario")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function weighScannedRoll() {
    closeScanActions();
    setShowQuickWeigh(true);
    setIsWeighingHighlighted(true);
    window.setTimeout(() => setIsWeighingHighlighted(false), 1800);
  }

  function consumeScannedRoll() {
    closeScanActions();
    window.setTimeout(() => {
      document.getElementById("consume-selected-roll")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("consumption-project-name")?.focus();
    }, 80);
  }

  async function copyScannedRollLink() {
    if (!scanActionRoll) return;
    const url = `${window.location.origin}/?roll=${encodeURIComponent(scanActionRoll.id)}`;

    try {
      await navigator.clipboard.writeText(url);
      setSyncNote(`Link copiado para ${scanActionRoll.color_name}`);
    } catch {
      setSyncNote(`Link del rollo: ${url}`);
    }
  }

  async function copySelectedRollPayload() {
    if (!selectedRoll) return;
    const payload = payloadForRoll(selectedRoll);

    try {
      await navigator.clipboard.writeText(payload);
      setNfcNote("Contenido de etiqueta copiado.");
    } catch {
      setNfcNote(`Contenido de etiqueta: ${payload}`);
    }
  }

  function openQrScanner() {
    setManualQrPayload("");
    setPendingQrPayload("");
    setQrScanNote("Preparando cámara...");
    setShowQrScanner(true);
  }

  function submitManualQrPayload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualQrPayload.trim()) {
      setQrScanNote("Pegá el texto o link del QR para buscar el rollo.");
      return;
    }

    selectRollFromScannedPayload(manualQrPayload);
  }

  async function writeNfcTag() {
    if (!selectedRoll) return;
    if (!("NDEFReader" in window)) {
      setNfcNote("Este navegador no soporta Web NFC. Usá el QR como respaldo.");
      return;
    }

    try {
      const ndef = new NDEFReader();
      const rollPayload = payloadForRoll(selectedRoll);
      const urlPayload = `${window.location.origin}/?roll=${encodeURIComponent(selectedRoll.id)}`;
      await ndef.write({
        records: [
          { recordType: "url", data: urlPayload },
          { recordType: "text", data: rollPayload }
        ]
      });
      setNfcNote(`Etiqueta NFC escrita para ${selectedRoll.color_name}.`);
    } catch (error) {
      setNfcNote(error instanceof Error ? error.message : "No se pudo escribir la etiqueta NFC.");
    }
  }

  async function scanNfcTag() {
    if (!("NDEFReader" in window)) {
      const message = "Este navegador no soporta Web NFC. Probá con Android + Chrome o escaneá el QR.";
      setNfcNote(message);
      if (showQrScanner) setQrScanNote(message);
      return;
    }

    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      setNfcNote("Acercá la etiqueta NFC al celular.");
      if (showQrScanner) setQrScanNote("Acercá la etiqueta NFC al celular.");

      ndef.onreading = (event) => {
        const decoder = new TextDecoder();
        const readable = event.message.records
          .map((record) => (record.data ? decoder.decode(record.data) : ""))
          .join(" ");
        const found = rolls.find((roll) => payloadMatchesRoll(roll, readable));
        if (found) {
          setSelectedId(found.id);
          const message = `Rollo detectado: ${found.brand} ${found.color_name}.`;
          setNfcNote(message);
          if (showQrScanner) {
            setQrScanNote(message);
            closeQrScanner();
            setScanActionRollId(found.id);
          }
        } else {
          const message = "Leí la etiqueta, pero no encontré ese rollo en el inventario.";
          setNfcNote(message);
          if (showQrScanner) {
            setPendingQrPayload(readable.trim());
            setQrScanNote("Leí una etiqueta NFC nueva. Podés crear un rollo y dejarla vinculada.");
          }
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer la etiqueta NFC.";
      setNfcNote(message);
      if (showQrScanner) setQrScanNote(message);
    }
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSendingMagicLink) return;

    const email = authEmail.trim();

    if (!isValidEmail(email)) {
      setAuthNote("Escribí un correo válido para enviarte el enlace.");
      return;
    }

    setIsSendingMagicLink(true);
    setAuthNote("Enviando enlace seguro...");

    try {
      const client = supabase ?? await initializeSupabaseClient();
      setSupabase(client);
      setSupabaseConfig(getSupabaseConfigStatus());

      if (!client) {
        setAuthNote("Supabase no está configurado en este deployment.");
        return;
      }

      const emailRedirectTo = getAuthRedirectUrl();
      setAuthRedirectUrl(emailRedirectTo);

      const { error } = await withTimeout(
        client.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo
          }
        }),
        "Supabase no respondió a tiempo. Revisá conexión o probá abrir la app fuera de WhatsApp."
      );

      setAuthNote(
        error
          ? `No se pudo enviar el enlace: ${error.message}`
          : `Listo. Revisá tu correo. El enlace vuelve a ${emailRedirectTo}`
      );
    } catch (error) {
      setAuthNote(error instanceof Error ? error.message : "No se pudo enviar el enlace seguro.");
    } finally {
      setIsSendingMagicLink(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSignedInEmail("");
    setSignedInUserId("");
    setUserProfile(defaultUserProfile());
    setSyncNote("Sesión cerrada");
    setShowProfile(false);
  }

  function goToWeighing() {
    if (!selectedRoll) {
      setSyncNote("Agregá o seleccioná un rollo antes de pesar.");
      return;
    }
    setShowQuickWeigh(true);
    setIsWeighingHighlighted(true);
    window.setTimeout(() => setIsWeighingHighlighted(false), 1800);
  }

  function openAccount() {
    if (signedInEmail) {
      setShowProfile(true);
      return;
    }

    if (showLogin) {
      setShowLogin(false);
      return;
    }

    setShowLogin(true);
    window.setTimeout(() => {
      document.getElementById("auth-email")?.focus();
    }, 100);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rollId = params.get("roll");
    if (rollId) setSelectedId(rollId);
  }, []);

  const brands = ["Todos", ...Array.from(new Set([...brandOptions, ...rolls.map((roll) => roll.brand)]))];
  const materials = [
    "Todos",
    ...Array.from(new Set([...materialOptions, ...rolls.map((roll) => roll.material)]))
  ];
  const availableLineOptions = lineOptionsByMaterial[draft.material] ?? ["Genérico"];
  const measuredRemaining = measuredTotalWeight !== "" && weighingTare !== ""
    ? Math.round((Number(measuredTotalWeight) - Number(weighingTare)) * 100) / 100
    : null;
  const measuredDelta = selectedRoll && measuredRemaining !== null
    ? Math.round((measuredRemaining - Number(selectedRoll.available_weight_g)) * 100) / 100
    : null;
  const selectedCostPerGram = selectedRoll?.filament_cost_amount && selectedRoll.initial_weight_g
    ? Number(selectedRoll.filament_cost_amount) / Number(selectedRoll.initial_weight_g)
    : null;
  const isDemoMode = dataMode === "demo";
  const isAuthRedirectLocal =
    authRedirectUrl.includes("localhost") || authRedirectUrl.includes("127.0.0.1");

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="hero">
          <p className="eyebrow">Spool Vault · Inventario 3D</p>
          <h1>Cargando filamentos...</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" id="inicio">
      <header className="account-strip">
        <a className="account-brand" href="#inicio" aria-label="Ir al inicio de Spool Vault">
          <span className="account-logo"><PackagePlus size={17} aria-hidden="true" /></span>
          <span><strong>Spool Vault</strong><small>Tu inventario 3D</small></span>
        </a>
        <div className="account-menu">
          <button
            className="account-access"
            type="button"
            onClick={openAccount}
            aria-expanded={!signedInEmail && showLogin}
            aria-controls={!signedInEmail ? "login-panel" : undefined}
          >
            {signedInEmail ? <UserRound size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
            <span>
              <strong>{signedInEmail ? "Perfil" : "Iniciar sesión"}</strong>
              <small>{signedInEmail || "Sincronizá tu inventario"}</small>
            </span>
          </button>

          {!signedInEmail && showLogin && (
            <section className="panel auth-panel auth-popover" id="login-panel" aria-label="Iniciar sesión">
              <div className="auth-panel-head">
                <div>
                  <p className="eyebrow">{supabaseConfig.isConfigured ? "Cuenta segura" : "Configuración"}</p>
                  <h2>{supabaseConfig.isConfigured ? "Entrá a Spool Vault" : "Conectá Supabase"}</h2>
                </div>
                <button className="modal-close" type="button" onClick={() => setShowLogin(false)} aria-label="Cerrar inicio de sesión">
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
              {supabaseConfig.isConfigured ? (
                <form onSubmit={sendMagicLink} noValidate>
                  <label htmlFor="auth-email">Correo electrónico</label>
                  <input
                    id="auth-email"
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="nombre@correo.com"
                    autoComplete="email"
                    disabled={isSendingMagicLink}
                    required
                  />
                  <button type="submit" disabled={isSendingMagicLink} aria-busy={isSendingMagicLink}>
                    {isSendingMagicLink ? "Enviando..." : "Enviar enlace seguro"}
                  </button>
                  <p className="auth-help">Enlace de un solo uso. Sin contraseña.</p>
                  <p className="auth-redirect">
                    El enlace vuelve a <code>{authRedirectUrl || "detectando URL..."}</code>
                  </p>
                  {isAuthRedirectLocal && (
                    <p className="auth-warning">
                      Desde celular no usés localhost. Abrí el preview de Vercel para que el enlace vuelva al teléfono.
                    </p>
                  )}
                  {authNote && <p className="auth-result" role="status">{authNote}</p>}
                </form>
              ) : (
                <div className="auth-config-missing">
                  <p>Supabase no está configurado para este deployment.</p>
                  <ul>
                    {!supabaseConfig.hasUrl && <li>Falta URL: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL</li>}
                    {!supabaseConfig.hasPublishableKey && (
                      <li>Falta public key: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY</li>
                    )}
                  </ul>
                  <p>
                    Para magic links desde el cel, el redirect autorizado debe incluir el dominio donde abriste la app.
                  </p>
                  <p className="auth-redirect">
                    URL actual: <code>{authRedirectUrl || "detectando URL..."}</code>
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Inventario 3D</p>
          <h1>Filamentos listos para imprimir</h1>
          <p className="hero-copy">
            Rollos Bambu Lab, Pritonic y genéricos con peso, consumo, QR y NFC por rollo.
          </p>
        </div>
        <div className="hero-actions">
          <button className="icon-action secondary" type="button" onClick={() => setShowPurchaseOrders(true)}>
            <ReceiptText size={20} aria-hidden="true" />
            <span>Compras</span>
          </button>
          <button className="icon-action secondary" type="button" onClick={openReport}>
            <BarChart3 size={20} aria-hidden="true" />
            <span>Reportes</span>
          </button>
          <button className="icon-action secondary" type="button" onClick={() => setShowSpools(true)}>
            <PackagePlus size={20} aria-hidden="true" />
            <span>Spools</span>
          </button>
          <button className="icon-action" type="button" onClick={() => setShowAdd(true)}>
            <Plus size={22} aria-hidden="true" />
            <span>Agregar</span>
          </button>
        </div>
      </section>

      <section className="metrics" aria-label="Resumen">
        <article>
          <PackagePlus size={18} aria-hidden="true" />
          <strong>{dashboard.rollCount}</strong>
          <span>rollos</span>
        </article>
        <article>
          <Weight size={18} aria-hidden="true" />
          <strong>{Math.round(dashboard.totalWeight)} g</strong>
          <span>disponibles</span>
        </article>
        <article>
          <AlertTriangle size={18} aria-hidden="true" />
          <strong>{dashboard.lowCount}</strong>
          <span>bajos</span>
        </article>
        <article>
          <Sparkles size={18} aria-hidden="true" />
          <strong>{dashboard.materialCount}</strong>
          <span>materiales</span>
        </article>
        <article>
          <PackagePlus size={18} aria-hidden="true" />
          <strong>{emptySpools.length}</strong>
          <span>spools vacíos</span>
        </article>
        <article>
          <Weight size={18} aria-hidden="true" />
          <strong>{formatMoney(userProfile.base_currency, dashboard.inventoryCost)}</strong>
          <span>inventario en {userProfile.base_currency}</span>
        </article>
      </section>

      <p className={`sync-note sync-${dataMode}`} role={dataMode === "error" ? "alert" : "status"}>
        {dataMode === "error" || dataMode === "demo" ? (
          <AlertTriangle size={15} aria-hidden="true" />
        ) : (
          <Check size={15} aria-hidden="true" />
        )}
        {syncNote}
      </p>

      {isDemoMode && (
        <section className="panel demo-banner" aria-label="Datos de demostración">
          <div>
            <strong>Datos de muestra</strong>
            <p>Estos rollos son ejemplos para probar la app. Al iniciar sesión, se carga solamente tu inventario real de Supabase.</p>
          </div>
          <button type="button" onClick={openAccount}>
            {supabaseConfig.isConfigured ? "Entrar" : "Configurar Supabase"}
          </button>
        </section>
      )}

      {dataMode === "error" && (
        <section className="panel data-error" aria-label="Error de conexión">
          <div>
            <strong>Tu inventario está protegido</strong>
            <p>No cargamos ejemplos ni copias antiguas mientras tu sesión está activa.</p>
          </div>
          <button type="button" onClick={() => setAuthVersion((value) => value + 1)}>Reintentar</button>
        </section>
      )}

      {showAdd && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddRoll();
          }}
        >
          <section
            className="panel add-panel modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-roll-title"
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Inventario</p>
                <h2 id="add-roll-title">Nuevo rollo</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={closeAddRoll}
                disabled={isAddingRoll}
                aria-label="Cerrar formulario"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <form className="form-grid" onSubmit={addRoll} aria-busy={isAddingRoll}>
            {pendingQrPayload && (
              <div className="pending-qr-banner wide">
                <strong>Etiqueta QR lista</strong>
                <span>Este rollo quedará vinculado al QR escaneado.</span>
              </div>
            )}
            <label>
              Marca
              <select
                name="brand"
                value={draft.brand}
                onChange={(event) => setDraft({ ...draft, brand: event.target.value })}
              >
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </label>
            <label>
              Material
              <select
                name="material"
                value={draft.material}
                onChange={(event) => {
                  const material = event.target.value;
                  setDraft({
                    ...draft,
                    material,
                    product_line: lineOptionsByMaterial[material]?.[0] ?? "Genérico"
                  });
                }}
              >
                {materialOptions.map((material) => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </select>
            </label>
            <label>
              Línea
              <select
                name="product_line"
                value={draft.product_line ?? ""}
                onChange={(event) => setDraft({ ...draft, product_line: event.target.value })}
              >
                {availableLineOptions.map((line) => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
            </label>
            <label>
              Color
              <input name="color_name" required placeholder="Grass Green, Negro, Dorado..." />
            </label>
            <fieldset className="color-helper wide">
              <legend>Color visual y HEX</legend>
              <div className="color-inputs">
                <input
                  className="color-picker"
                  type="color"
                  value={draft.color_hex}
                  onChange={(event) => setDraft({ ...draft, color_hex: event.target.value })}
                  aria-label="Elegir color visualmente"
                />
                <input
                  name="color_hex"
                  value={draft.color_hex}
                  onChange={(event) => setDraft({ ...draft, color_hex: event.target.value })}
                  pattern="#[0-9A-Fa-f]{6}"
                  placeholder="#22c55e"
                  aria-label="Código hexadecimal del color"
                />
              </div>
              <p>Elegí visualmente o tocá un color parecido. No tiene que ser exacto.</p>
              <div className="color-presets" aria-label="Colores rápidos">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={draft.color_hex === color ? "selected" : ""}
                    style={{ backgroundColor: color }}
                    onClick={() => setDraft({ ...draft, color_hex: color })}
                    aria-label={`Usar color ${color}`}
                    title={color}
                  />
                ))}
              </div>
            </fieldset>
            <label>
              Peso inicial
              <input name="initial_weight_g" type="number" min="1" defaultValue={1000} />
            </label>
            <label>
              Peso disponible
              <input name="available_weight_g" type="number" min="0" defaultValue={1000} />
            </label>
            <label>
              Bajo desde
              <input name="low_threshold_g" type="number" min="0" defaultValue={200} />
            </label>
            <label>
              Ubicación
              <input name="location" placeholder="AMS Slot 2, SUNLU, Gaveta..." />
            </label>
            <label>
              Fecha de compra
              <input name="purchase_date" type="date" />
            </label>
            <label>
              Proveedor
              <input
                name="supplier_name"
                list="supplier-options"
                defaultValue={draft.supplier_name ?? "Maker Store"}
                placeholder="Maker Store, Pritonic..."
                required
              />
            </label>
            <label>
              Presentación
              <select
                name="package_type"
                value={draft.package_type}
                onChange={(event) => {
                  const packageType = event.target.value as PackageType;
                  setDraft({
                    ...draft,
                    package_type: packageType,
                    spool_cost_amount: packageType === "spooled" ? 1000 : 0
                  });
                }}
              >
                <option value="refill">Refill · sin spool</option>
                <option value="spooled">Con spool</option>
              </select>
            </label>
            <label>
              Precio total pagado
              <input
                name="price_amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="12500"
                value={draft.price_amount ?? ""}
                onChange={(event) => setDraft({
                  ...draft,
                  price_amount: event.target.value ? Number(event.target.value) : null
                })}
              />
            </label>
            <label>
              Costo del spool
              <input
                name="spool_cost_amount"
                type="number"
                min="0"
                value={draft.spool_cost_amount}
                disabled={draft.package_type === "refill"}
                onChange={(event) => setDraft({ ...draft, spool_cost_amount: Number(event.target.value) })}
              />
            </label>
            <label>
              Moneda
              <select
                name="currency"
                value={draft.currency}
                onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
              >
                <option value="CRC">CRC · colones</option>
                <option value="USD">USD · dólares</option>
              </select>
            </label>
            <div className="cost-preview wide">
              <span>Costo consumible</span>
              <strong>
                {draft.price_amount === null
                  ? "Ingresá el precio"
                  : `${draft.currency} ${Math.max(0, draft.price_amount - draft.spool_cost_amount).toLocaleString("es-CR")}`}
              </strong>
              <small>
                {draft.price_amount === null
                  ? ""
                  : `${(Math.max(0, draft.price_amount - draft.spool_cost_amount) / 1000).toLocaleString("es-CR")} por gramo`}
              </small>
            </div>
            <label className="wide">
              Secado / observaciones
              <textarea name="drying_notes" placeholder="Secado 4 h a 50 C, stringing, perfil..." />
            </label>
            <label className="wide">
              Foto URL
              <input name="photo_url" placeholder="https://..." />
            </label>
            <label className="wide">
              Link de compra
              <input name="purchase_url" placeholder="Amazon, Bambu Lab, tienda local..." />
            </label>
            <button className="primary-action wide" type="submit" disabled={isAddingRoll}>
              <PackagePlus size={18} aria-hidden="true" />
              {isAddingRoll ? "Guardando rollo y compra…" : "Guardar rollo"}
            </button>
            </form>
            <datalist id="supplier-options">
              {Array.from(new Set([...supplierOptions, ...suppliers.map((supplier) => supplier.name)])).map((supplier) => (
                <option key={supplier} value={supplier} />
              ))}
            </datalist>
          </section>
        </div>
      )}

      {showQuickWeigh && selectedRoll && (
        <div
          className="modal-backdrop quick-weigh-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingWeight) setShowQuickWeigh(false);
          }}
        >
          <section
            className="panel modal-panel quick-weigh-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-weigh-title"
          >
            <div className="modal-head quick-weigh-head">
              <div>
                <p className="eyebrow">Balanza</p>
                <h2 id="quick-weigh-title">Actualizar peso</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setShowQuickWeigh(false)}
                disabled={isSavingWeight}
                aria-label="Cerrar pesaje"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form className="quick-weigh-form" id="quick-weigh-sheet" onSubmit={adjustFromMeasuredWeight}>
              <label className="quick-roll-picker">
                Rollo
                <select
                  value={selectedRoll.id}
                  disabled={isSavingWeight}
                  onChange={(event) => {
                    setSelectedId(event.target.value);
                    setMeasuredTotalWeight("");
                    weightRequest.current = null;
                  }}
                >
                  {rolls.map((roll) => (
                    <option key={roll.id} value={roll.id}>
                      {roll.color_name} · {roll.brand} · {Math.round(Number(roll.available_weight_g))} g
                    </option>
                  ))}
                </select>
              </label>

              <div className="quick-weigh-card">
                <span className="quick-weigh-swatch" style={{ backgroundColor: selectedRoll.color_hex }} />
                <div>
                  {isDemoMode && <span className="demo-pill">Muestra</span>}
                  <strong>{selectedRoll.color_name}</strong>
                  <span>{selectedRoll.brand} · {selectedRoll.product_line || "Sin línea"} · {selectedRoll.material}</span>
                  <small>{Math.round(Number(selectedRoll.available_weight_g))} g guardados ahora</small>
                </div>
              </div>

              {isDemoMode && (
                <p className="demo-weigh-note">
                  Si guardás este pesaje, la app pasa a modo local en esta PC. No afecta tu inventario real.
                </p>
              )}

              <label>
                Peso total medido
                <input
                  ref={quickWeighInputRef}
                  name="measured_total_weight_g"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Ej. 469"
                  value={measuredTotalWeight}
                  disabled={isSavingWeight}
                  onChange={(event) => setMeasuredTotalWeight(event.target.value)}
                />
              </label>

              <label>
                Referencia de tara
                <select
                  value={weighingSpoolTypeId}
                  disabled={isSavingWeight}
                  onChange={(event) => {
                    const typeId = event.target.value;
                    const type = spoolTypes.find((item) => item.id === typeId);
                    setWeighingSpoolTypeId(typeId);
                    if (type) {
                      setWeighingTare(String(type.total_tare_g));
                      setWeighingConfidence(type.tare_confidence);
                    } else {
                      setWeighingConfidence("unknown");
                    }
                    weightRequest.current = null;
                  }}
                >
                  <option value="">Tara manual</option>
                  {spoolTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.manufacturer} · {type.name} · {type.total_tare_g} g
                    </option>
                  ))}
                </select>
              </label>

              <div className="quick-weigh-row">
                <label>
                  Tara
                  <input
                    name="tare_weight_g"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Ej. 254"
                    value={weighingTare}
                    disabled={isSavingWeight}
                    onChange={(event) => {
                      setWeighingTare(event.target.value);
                      weightRequest.current = null;
                    }}
                  />
                </label>
                <label>
                  Confianza
                  <select
                    value={weighingConfidence}
                    disabled={isSavingWeight}
                    onChange={(event) => {
                      setWeighingConfidence(event.target.value as TareConfidence);
                      weightRequest.current = null;
                    }}
                  >
                    <option value="verified">Verificada</option>
                    <option value="estimated">Estimada</option>
                    <option value="unknown">Desconocida</option>
                  </select>
                </label>
              </div>

              <div className={measuredRemaining != null && measuredRemaining < 0 ? "quick-weigh-result invalid" : "quick-weigh-result"}>
                <span>Disponible calculado</span>
                <strong>{measuredRemaining == null ? "—" : `${measuredRemaining.toLocaleString("es-CR")} g`}</strong>
                <small>
                  {measuredDelta == null
                    ? "Peso total menos tara"
                    : `${measuredDelta >= 0 ? "+" : ""}${measuredDelta.toLocaleString("es-CR")} g vs registro actual`}
                </small>
              </div>

              <button
                className="primary-action"
                type="submit"
                disabled={isSavingWeight || measuredRemaining == null || measuredRemaining < 0}
              >
                <Weight size={18} aria-hidden="true" />
                {isSavingWeight ? "Guardando pesaje..." : "Guardar pesaje"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showQrScanner && (
        <div
          className="modal-backdrop qr-scan-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeQrScanner();
          }}
        >
          <section
            className="panel modal-panel qr-scan-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scan-title"
          >
            <div className="modal-head quick-weigh-head">
              <div>
                <p className="eyebrow">Cámara</p>
                <h2 id="qr-scan-title">Escanear rollo</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={closeQrScanner}
                aria-label="Cerrar escáner"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="qr-scanner">
              <video ref={qrVideoRef} muted playsInline />
              <div className="qr-scan-frame" aria-hidden="true" />
            </div>

            <div className="qr-scan-content">
              <p className="qr-scan-note" role="status">{qrScanNote}</p>
              {pendingQrPayload && (
                <div className="pending-qr-card">
                  <span>Nueva etiqueta detectada</span>
                  <code>{pendingQrPayload}</code>
                  <button className="secondary-action" type="button" onClick={addRollFromScannedPayload}>
                    <PackagePlus size={18} aria-hidden="true" />
                    Agregar rollo con esta etiqueta
                  </button>
                </div>
              )}
              <form className="manual-qr-form" onSubmit={submitManualQrPayload}>
                <label>
                  Link o texto del QR
                  <input
                    value={manualQrPayload}
                    onChange={(event) => setManualQrPayload(event.target.value)}
                    placeholder="https://spool-vault.vercel.app/?roll=..."
                    inputMode="url"
                  />
                </label>
                <button className="secondary-action" type="submit">Buscar rollo</button>
              </form>
              <button className="primary-action" type="button" onClick={scanNfcTag}>
                <Nfc size={18} aria-hidden="true" />
                Leer NFC
              </button>
            </div>
          </section>
        </div>
      )}

      {scanActionRoll && (
        <div
          className="modal-backdrop scan-actions-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeScanActions();
          }}
        >
          <section
            className="panel modal-panel scan-actions-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-actions-title"
          >
            <div className="modal-head quick-weigh-head">
              <div>
                <p className="eyebrow">Rollo detectado</p>
                <h2 id="scan-actions-title">{scanActionRoll.color_name}</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={closeScanActions}
                aria-label="Cerrar acciones"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="scan-roll-card">
              <span className="quick-weigh-swatch" style={{ backgroundColor: scanActionRoll.color_hex }} />
              <div>
                <strong>{scanActionRoll.brand} · {scanActionRoll.product_line || "Sin línea"}</strong>
                <span>{scanActionRoll.material} · {Math.round(Number(scanActionRoll.available_weight_g))} g disponibles</span>
                <small>{scanActionRoll.location || "Sin ubicación registrada"}</small>
              </div>
            </div>

            <div className="scan-action-grid">
              <button type="button" onClick={showScannedRollDetail}>
                <Search size={18} aria-hidden="true" />
                Ver ficha
              </button>
              <button type="button" onClick={weighScannedRoll}>
                <Weight size={18} aria-hidden="true" />
                Pesar
              </button>
              <button type="button" onClick={consumeScannedRoll}>
                <Pencil size={18} aria-hidden="true" />
                Consumo
              </button>
              <button type="button" onClick={copyScannedRollLink}>
                <LinkIcon size={18} aria-hidden="true" />
                Copiar link
              </button>
            </div>
          </section>
        </div>
      )}

      {editingRoll && (
        <RollEditModal
          roll={editingRoll}
          brandOptions={brandOptions}
          materialOptions={materialOptions}
          lineOptionsByMaterial={lineOptionsByMaterial}
          colorPresets={colorPresets}
          isSaving={isUpdatingRoll}
          onClose={() => setEditingRollId("")}
          onSave={updateRoll}
        />
      )}

      {correctingPurchase && (
        <PurchaseCorrectionModal
          originalPurchase={correctingPurchase.original}
          effectivePurchase={correctingPurchase.effective}
          correctionCount={correctingPurchase.correctionCount}
          supplierOptions={Array.from(new Set([
            ...supplierOptions,
            ...suppliers.map((supplier) => supplier.name)
          ]))}
          isSaving={isCorrectingPurchase}
          onClose={() => setCorrectingPurchaseId("")}
          onSave={correctPurchase}
        />
      )}

      {missingPurchaseRoll && (
        <MissingPurchaseModal
          roll={missingPurchaseRoll}
          supplierOptions={Array.from(new Set([
            ...supplierOptions,
            ...suppliers.map((supplier) => supplier.name)
          ]))}
          isSaving={isAddingMissingPurchase}
          onClose={() => setMissingPurchaseRollId("")}
          onSave={registerMissingPurchase}
        />
      )}

      {showSpools && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pendingSpoolAction) setShowSpools(false);
          }}
        >
          <section
            className="panel modal-panel spool-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spool-modal-title"
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Spools reutilizables</p>
                <h2 id="spool-modal-title">Asignar y controlar spools</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setShowSpools(false)}
                disabled={Boolean(pendingSpoolAction)}
                aria-label="Cerrar spools"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="spool-summary">
              <article><strong>{spools.length}</strong><span>registrados</span></article>
              <article><strong>{emptySpools.length}</strong><span>vacíos</span></article>
              <article><strong>{spools.filter((spool) => spool.status === "in_use").length}</strong><span>en uso</span></article>
              <article><strong>{spools.filter((spool) => spool.status === "retired").length}</strong><span>inactivos</span></article>
            </div>

            <form className="form-grid compact-form" onSubmit={addSpool} aria-busy={pendingSpoolAction === "create"}>
              <h3 className="wide">Registrar spool vacío</h3>
              <label className="wide">
                Tipo de spool
                <select
                  name="spool_type_id"
                  value={newSpoolTypeId}
                  onChange={(event) => setNewSpoolTypeId(event.target.value)}
                  disabled={Boolean(pendingSpoolAction)}
                >
                  <option value="">Personalizado · indicar tara manualmente</option>
                  {spoolTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.manufacturer} · {type.name} · {type.total_tare_g} g ({tareConfidenceLabels[type.tare_confidence].toLowerCase()})
                    </option>
                  ))}
                </select>
              </label>
              {newSpoolTypeId && (() => {
                const type = spoolTypes.find((item) => item.id === newSpoolTypeId);
                return type ? (
                  <p className="spool-type-reference wide">
                    <strong>{type.total_tare_g} g de tara · {tareConfidenceLabels[type.tare_confidence]}</strong>
                    <span>{type.weight_source || "Sin fuente indicada"}{type.notes ? ` · ${type.notes}` : ""}</span>
                  </p>
                ) : null;
              })()}
              <label>
                Código
                <input name="code" required defaultValue={`SP-${String(spools.length + 1).padStart(3, "0")}`} disabled={Boolean(pendingSpoolAction)} />
              </label>
              <label>
                Marca / compatibilidad
                <select name="brand" defaultValue="Bambu Lab" disabled={Boolean(newSpoolTypeId) || Boolean(pendingSpoolAction)}>
                  {brandOptions.map((brand) => <option key={brand}>{brand}</option>)}
                </select>
              </label>
              <label>
                Material del spool
                <select name="spool_material" defaultValue="Plástico reutilizable" disabled={Boolean(newSpoolTypeId) || Boolean(pendingSpoolAction)}>
                  <option>Plástico reutilizable</option>
                  <option>Cartón</option>
                  <option>Otro</option>
                </select>
              </label>
              <label>
                Tara en gramos
                <input name="tare_weight_g" type="number" min="0" step="0.01" placeholder="Peso vacío opcional" disabled={Boolean(newSpoolTypeId) || Boolean(pendingSpoolAction)} />
              </label>
              <label>
                Costo
                <input name="acquisition_cost" type="number" min="0" defaultValue="1000" disabled={Boolean(pendingSpoolAction)} />
              </label>
              <input name="currency" type="hidden" value="CRC" />
              <label>
                Notas
                <input name="notes" placeholder="Estado, origen..." disabled={Boolean(pendingSpoolAction)} />
              </label>
              <button className="primary-action wide" type="submit" disabled={Boolean(pendingSpoolAction)}>
                {pendingSpoolAction === "create" ? "Guardando sin duplicar…" : "Agregar spool vacío"}
              </button>
            </form>

            <form className="form-grid compact-form" onSubmit={assignSpool} aria-busy={pendingSpoolAction === "assign"}>
              <h3 className="wide">Asignar spool a un filamento</h3>
              <label>
                Filamento sin spool
                <select name="roll_id" required disabled={!unassignedRolls.length || Boolean(pendingSpoolAction)}>
                  <option value="">Seleccionar filamento</option>
                  {unassignedRolls.map((roll) => (
                    <option key={roll.id} value={roll.id}>{roll.brand} · {roll.product_line} · {roll.color_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Spool vacío
                <select name="spool_id" required disabled={!emptySpools.length || Boolean(pendingSpoolAction)}>
                  <option value="">Seleccionar spool</option>
                  {emptySpools.map((spool) => (
                    <option key={spool.id} value={spool.id}>{spool.code} · {spool.brand || "Sin marca"}</option>
                  ))}
                </select>
              </label>
              <button className="primary-action wide" type="submit" disabled={!unassignedRolls.length || !emptySpools.length || Boolean(pendingSpoolAction)}>
                {pendingSpoolAction === "assign" ? "Asignando…" : "Asignar spool"}
              </button>
            </form>

            <div className="spool-list">
              <h3>Inventario de spools</h3>
              {spools.length ? spools.map((spool) => {
                const assignedRoll = rolls.find((roll) => roll.spool_id === spool.id);
                return (
                  <article key={spool.id} className={spool.status === "retired" ? "spool-item retired" : "spool-item"}>
                    <div className="spool-item-info"><strong>{spool.code}</strong><span>{spool.brand || "Sin marca"} · {spool.spool_material}</span></div>
                    <div className="spool-item-status"><strong>{spoolStatusLabels[spool.status]}</strong><span>{assignedRoll ? `${assignedRoll.product_line || assignedRoll.material} · ${assignedRoll.color_name}` : spool.tare_weight_g ? `Tara ${spool.tare_weight_g} g` : "Sin tara"}</span></div>
                    <div className="spool-actions">
                      <button type="button" disabled={Boolean(pendingSpoolAction)} onClick={() => setEditingSpoolId((current) => current === spool.id ? "" : spool.id)}>
                        {editingSpoolId === spool.id ? "Cancelar" : "Editar"}
                      </button>
                      {assignedRoll && (
                        <button type="button" disabled={Boolean(pendingSpoolAction)} onClick={() => releaseSpool(assignedRoll)}>
                          {pendingSpoolAction === `release:${spool.id}` ? "Liberando…" : "Quitar filamento"}
                        </button>
                      )}
                      <button
                        className={spool.status === "retired" ? "restore" : "danger"}
                        type="button"
                        disabled={Boolean(pendingSpoolAction)}
                        onClick={() => toggleSpoolRetired(spool)}
                      >
                        {pendingSpoolAction === `retire:${spool.id}`
                          ? (spool.status === "retired" ? "Reactivando…" : "Inactivando…")
                          : (spool.status === "retired" ? "Reactivar" : "Inactivar")}
                      </button>
                    </div>
                    {editingSpoolId === spool.id && (
                      <form className="spool-edit-form" onSubmit={(event) => updateSpool(event, spool)}>
                        <label>Código<input name="code" required defaultValue={spool.code} /></label>
                        <label className="wide">
                          Tipo de spool
                          <select name="spool_type_id" defaultValue={spool.spool_type_id || ""}>
                            <option value="">Personalizado</option>
                            {spoolTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.manufacturer} · {type.name} · {type.total_tare_g} g
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Marca / compatibilidad
                          <select name="brand" defaultValue={spool.brand || "Bambu Lab"}>
                            {spool.brand && !brandOptions.includes(spool.brand) && <option>{spool.brand}</option>}
                            {brandOptions.map((brand) => <option key={brand}>{brand}</option>)}
                          </select>
                        </label>
                        <label>
                          Material del spool
                          <select name="spool_material" defaultValue={spool.spool_material}>
                            {!['Plástico reutilizable', 'Cartón', 'Otro'].includes(spool.spool_material) && <option>{spool.spool_material}</option>}
                            <option>Plástico reutilizable</option>
                            <option>Cartón</option>
                            <option>Otro</option>
                          </select>
                        </label>
                        <label>Tara en gramos<input name="tare_weight_g" type="number" min="0" step="0.01" defaultValue={spool.tare_weight_g ?? ""} /></label>
                        <label>Costo<input name="acquisition_cost" type="number" min="0" defaultValue={spool.acquisition_cost} /></label>
                        <label>Notas<input name="notes" defaultValue={spool.notes || ""} /></label>
                        <input name="currency" type="hidden" value={spool.currency} />
                        <p className="form-help wide">Si elegís un tipo de referencia, su marca, material y tara reemplazan los valores manuales al guardar.</p>
                        <button className="primary-action wide" type="submit" disabled={Boolean(pendingSpoolAction)}>
                          {pendingSpoolAction === `update:${spool.id}` ? "Guardando sin repetir…" : "Guardar cambios"}
                        </button>
                      </form>
                    )}
                  </article>
                );
              }) : <p className="empty-state">Todavía no hay spools registrados.</p>}
            </div>
          </section>
        </div>
      )}

      {showProfile && (
        <ProfilePanel
          email={signedInEmail}
          profile={userProfile}
          isSaving={isSavingProfile}
          onClose={() => setShowProfile(false)}
          onSave={saveProfile}
          onSignOut={signOut}
        />
      )}

      {showReport && (
        <InventoryReportModal
          rows={reportRows}
          mode={dataMode}
          isLoading={isLoadingReport}
          error={reportError}
          onClose={() => setShowReport(false)}
        />
      )}

      {showPurchaseOrders && (
        <PurchaseOrdersModal
          purchases={effectivePurchases}
          orders={purchaseOrders}
          items={purchaseOrderItems}
          payments={purchaseOrderPayments}
          baseCurrency={userProfile.base_currency}
          mode={dataMode}
          isSaving={isSavingPurchaseOrder}
          onClose={() => setShowPurchaseOrders(false)}
          onCreate={createPurchaseOrder}
        />
      )}

      <section className="filters" id="inventario" aria-label="Filtros">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar color, marca, material..."
          />
        </label>
        <div className="filter-row">
          <label>
            <Filter size={15} aria-hidden="true" />
            <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </select>
          </label>
          <label>
            <Filter size={15} aria-hidden="true" />
            <select value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)}>
              {materials.map((material) => (
                <option key={material}>{material}</option>
              ))}
            </select>
          </label>
          <button
            className={lowOnly ? "toggle active" : "toggle"}
            type="button"
            onClick={() => setLowOnly((value) => !value)}
          >
            <ShoppingCart size={16} aria-hidden="true" />
            Comprar
          </button>
        </div>
      </section>

      <section className="content-grid">
        <div className="roll-list" aria-label="Rollos">
          {filteredRolls.map((roll) => {
            const percent = Math.max(
              0,
              Math.min(100, (Number(roll.available_weight_g) / Number(roll.initial_weight_g)) * 100)
            );
            const isSelected = selectedRoll?.id === roll.id;

            return (
              <button
                key={roll.id}
                className={isSelected ? "roll-card selected" : "roll-card"}
                type="button"
                onClick={() => setSelectedId(roll.id)}
              >
                <span className="swatch" style={{ backgroundColor: roll.color_hex }} />
                <span className="roll-main">
                  <span className="roll-title">{roll.color_name}</span>
                  <span className="roll-meta">
                    {roll.brand} · {roll.product_line || "Sin línea"} · {roll.material}
                  </span>
                  <span className="progress-track">
                    <span className="progress-fill" style={{ width: `${percent}%` }} />
                  </span>
                </span>
                <span className="roll-side">
                  <span className={statusClass(roll.status)}>{statusLabels[roll.status]}</span>
                  {isDemoMode && <span className="demo-pill">Muestra</span>}
                  <strong>{Math.round(roll.available_weight_g)} g</strong>
                </span>
              </button>
            );
          })}

          {!filteredRolls.length && (
            <div className="empty-state">No hay rollos con esos filtros.</div>
          )}
        </div>

        {selectedRoll && (
          <aside className="panel detail-panel">
            <div className="detail-head">
              <span className="detail-swatch" style={{ backgroundColor: selectedRoll.color_hex }} />
              <div>
                <div className="detail-badges">
                  <p className={statusClass(selectedRoll.status)}>{statusLabels[selectedRoll.status]}</p>
                  {isDemoMode && <span className="demo-pill">Muestra</span>}
                </div>
                <h2>{selectedRoll.color_name}</h2>
                <p>
                  {selectedRoll.brand} · {selectedRoll.product_line || "Sin línea"} ·{" "}
                  {selectedRoll.material}
                </p>
              </div>
            </div>

            <div className="detail-actions">
              <button
                className="secondary-action edit-roll-action"
                type="button"
                onClick={() => setEditingRollId(selectedRoll.id)}
              >
                <Pencil size={16} aria-hidden="true" />
                Editar filamento
              </button>
              {selectedRollPurchase ? (
                <button
                  className="secondary-action edit-roll-action"
                  type="button"
                  onClick={() => setCorrectingPurchaseId(selectedRollPurchase.original.id)}
                >
                  <ReceiptText size={16} aria-hidden="true" />
                  Corregir compra
                </button>
              ) : (
                <button
                  className="secondary-action edit-roll-action missing-purchase-action"
                  type="button"
                  onClick={() => setMissingPurchaseRollId(selectedRoll.id)}
                >
                  <AlertTriangle size={16} aria-hidden="true" />
                  Registrar compra faltante
                </button>
              )}
            </div>

            {!selectedRollPurchase && (
              <p className="missing-purchase-alert">
                <AlertTriangle size={16} aria-hidden="true" />
                El costo de este rollo está incompleto porque no existe una compra en su historial.
              </p>
            )}

            <div className="detail-facts">
              <span>{Math.round(selectedRoll.available_weight_g)} g disponibles</span>
              <span>{Math.round(selectedRoll.initial_weight_g)} g iniciales</span>
              <span>{selectedRoll.location || "Sin ubicación"}</span>
              <span>
                {selectedRoll.price_amount
                  ? `${selectedRoll.currency} ${selectedRoll.price_amount}`
                  : "Sin precio"}
              </span>
              <span>{selectedRoll.package_type === "refill" ? "Refill · sin spool" : "Comprado con spool"}</span>
              <span>{selectedSpool ? `Spool ${selectedSpool.code}` : "Sin spool asignado"}</span>
              <span>
                {selectedCostPerGram === null
                  ? "Sin costo por gramo"
                  : `${selectedRoll.currency} ${selectedCostPerGram.toLocaleString("es-CR")} / g`}
              </span>
              <span>
                {selectedRoll.filament_cost_amount == null
                  ? "Sin costo consumible"
                  : `${selectedRoll.currency} ${Number(selectedRoll.filament_cost_amount).toLocaleString("es-CR")} consumible`}
              </span>
            </div>

            {selectedSpool && (
              <button
                className="secondary-action"
                type="button"
                disabled={Boolean(pendingSpoolAction)}
                onClick={() => releaseSpool(selectedRoll)}
              >
                {pendingSpoolAction === `release:${selectedSpool.id}`
                  ? `Liberando ${selectedSpool.code}…`
                  : `Liberar ${selectedSpool.code} como spool vacío`}
              </button>
            )}

            {selectedRoll.drying_notes && <p className="notes">{selectedRoll.drying_notes}</p>}

            <form
              className={isWeighingHighlighted ? "consume-form weighing-form weighing-form-active" : "consume-form weighing-form"}
              id="quick-weigh"
              onSubmit={adjustFromMeasuredWeight}
            >
              <h3>Actualizar con balanza</h3>
              <p className="form-help">Ingresá el peso completo. Restamos la tara antes de guardar el filamento disponible.</p>
              <label className="weighing-type-field">
                Referencia de tara
                <select
                  value={weighingSpoolTypeId}
                  disabled={isSavingWeight}
                  onChange={(event) => {
                    const typeId = event.target.value;
                    const type = spoolTypes.find((item) => item.id === typeId);
                    setWeighingSpoolTypeId(typeId);
                    if (type) {
                      setWeighingTare(String(type.total_tare_g));
                      setWeighingConfidence(type.tare_confidence);
                    } else {
                      setWeighingConfidence("unknown");
                    }
                    weightRequest.current = null;
                  }}
                >
                  <option value="">Tara manual</option>
                  {spoolTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.manufacturer} · {type.name} · {type.total_tare_g} g
                    </option>
                  ))}
                </select>
              </label>
              <div className="weighing-fields">
                <label>
                  Peso total medido
                  <input
                    name="measured_total_weight_g"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej. 469"
                    value={measuredTotalWeight}
                    onChange={(event) => setMeasuredTotalWeight(event.target.value)}
                  />
                </label>
                <label>
                  Tara usada
                  <input
                    name="tare_weight_g"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej. 254"
                    value={weighingTare}
                    onChange={(event) => setWeighingTare(event.target.value)}
                  />
                </label>
                <label>
                  Confianza de la tara
                  <select
                    value={weighingConfidence}
                    disabled={isSavingWeight}
                    onChange={(event) => {
                      setWeighingConfidence(event.target.value as TareConfidence);
                      weightRequest.current = null;
                    }}
                  >
                    <option value="verified">Verificada · la pesé</option>
                    <option value="estimated">Estimada · referencia</option>
                    <option value="unknown">Desconocida</option>
                  </select>
                </label>
              </div>
              {selectedRoll.brand === "Bambu Lab" && (
                <p className="tare-hint">Referencia Bambu: 213 g del spool + 41 g del cartón/NFC = 254 g. Podés corregirla si tu montaje es distinto.</p>
              )}
              <div className={measuredRemaining != null && measuredRemaining < 0 ? "weighing-result invalid" : "weighing-result"}>
                <span>Filamento calculado</span>
                <strong>{measuredRemaining == null ? "—" : `${measuredRemaining.toLocaleString("es-CR")} g`}</strong>
                <small>Peso total − tara</small>
              </div>
              <button className="primary-action" type="submit" disabled={isSavingWeight || measuredRemaining == null || measuredRemaining < 0}>
                <Weight size={18} aria-hidden="true" />
                {isSavingWeight ? "Guardando peso…" : "Guardar peso calculado"}
              </button>
            </form>

            <section className="weighing-history" aria-label="Historial reciente de pesajes">
              <div className="weighing-history-head">
                <h3>Pesajes recientes</h3>
                <span>{weighingEvents.filter((event) => event.roll_id === selectedRoll.id).length} registros</span>
              </div>
              {recentWeighings.length ? recentWeighings.map((event) => (
                <article key={event.id}>
                  <div>
                    <strong>{event.measurement_kind === "scale" ? "Balanza" : "Ajuste manual"}</strong>
                    <span>{new Date(event.measured_at).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  <div className="weighing-history-values">
                    {event.measurement_kind === "scale" && (
                      <span>{Number(event.gross_weight_g).toLocaleString("es-CR")} g − {Number(event.tare_weight_g).toLocaleString("es-CR")} g</span>
                    )}
                    <strong>{Number(event.available_weight_g).toLocaleString("es-CR")} g</strong>
                  </div>
                  <span className={`confidence-badge confidence-${event.tare_confidence}`}>
                    {tareConfidenceLabels[event.tare_confidence]}
                  </span>
                </article>
              )) : (
                <p className="empty-state">El primer pesaje quedará guardado acá con la tara que usaste.</p>
              )}
            </section>

            <details className="manual-weight">
              <summary>Ajuste manual de gramos</summary>
              <form className="consume-form" onSubmit={adjustAvailableWeight}>
                <div className="inline-fields">
                <input
                  key={`${selectedRoll.id}-${selectedRoll.available_weight_g}`}
                  name="available_weight_g"
                  required
                  type="number"
                  min="0"
                  max={selectedRoll.initial_weight_g}
                  step="0.01"
                  defaultValue={selectedRoll.available_weight_g}
                  aria-label="Peso disponible en gramos"
                />
                <button className="primary-action" type="submit" disabled={isSavingWeight}>
                  <Weight size={18} aria-hidden="true" />
                  {isSavingWeight ? "Guardando…" : "Actualizar gramos"}
                </button>
                </div>
              </form>
            </details>

            <form className="consume-form" id="consume-selected-roll" onSubmit={recordConsumption}>
              <h3>Registrar consumo</h3>
              <input id="consumption-project-name" name="project_name" required placeholder="Proyecto: Miniatura Hulk" />
              <div className="inline-fields">
                <input name="grams_used" required type="number" min="1" placeholder="Gramos" />
                <input name="consumed_at" type="date" defaultValue={todayIso()} />
              </div>
              <input name="notes" placeholder="Notas opcionales" />
              <button className="primary-action" type="submit" disabled={isRecordingConsumption}>
                <Weight size={18} aria-hidden="true" />
                {isRecordingConsumption ? "Registrando consumo…" : "Descontar gramos"}
              </button>
            </form>

            <div className="qr-nfc">
              <div className="qr-box">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt={`QR del rollo ${selectedRoll.color_name}`} />
                ) : (
                  <QrCode size={80} aria-hidden="true" />
                )}
              </div>
              <div className="nfc-actions">
                <button type="button" onClick={copySelectedRollPayload}>
                  <QrCode size={18} aria-hidden="true" />
                  Copiar etiqueta
                </button>
                <button type="button" onClick={writeNfcTag}>
                  <Nfc size={18} aria-hidden="true" />
                  Escribir NFC
                </button>
                <button type="button" onClick={scanNfcTag}>
                  <ScanLine size={18} aria-hidden="true" />
                  Leer NFC
                </button>
                {nfcNote && <p>{nfcNote}</p>}
              </div>
            </div>

            <div className="link-actions">
              {selectedRoll.photo_url && (
                <a href={selectedRoll.photo_url} target="_blank" rel="noreferrer">
                  <Camera size={16} aria-hidden="true" />
                  Foto
                </a>
              )}
              {selectedRoll.purchase_url && (
                <a href={selectedRoll.purchase_url} target="_blank" rel="noreferrer">
                  <LinkIcon size={16} aria-hidden="true" />
                  Comprar
                </a>
              )}
            </div>
          </aside>
        )}
      </section>

      <section className="panel shopping-panel">
        <h2>Por comprar</h2>
        {shoppingList.length ? (
          <div className="shopping-list">
            {shoppingList.map((roll) => (
              <div key={roll.id}>
                <span className="mini-swatch" style={{ backgroundColor: roll.color_hex }} />
                <span>
                  {roll.brand} {roll.product_line} {roll.color_name}
                </span>
                <strong>{Math.round(roll.available_weight_g)} g</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No hay rollos bajos por ahora.</p>
        )}
      </section>

      <section className="panel history-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Compras</p>
            <h2>Histórico de precios</h2>
          </div>
          <span>{purchaseViews.length} registros</span>
        </div>
        {purchaseViews.length ? (
          <div className="history-list">
            {purchaseViews.map(({ original, effective, latestCorrection, correctionCount }) => (
              <article key={original.id} className={latestCorrection ? "corrected" : ""}>
                <span className="mini-swatch" style={{ backgroundColor: original.color_hex }} />
                <div className="history-copy">
                  <strong>{effective.brand} · {effective.product_line} · {effective.color_name}</strong>
                  <span>{effective.supplier_name} · {effective.purchased_at} · {effective.package_type === "spooled" ? "Con spool" : "Refill"}</span>
                  {latestCorrection && (
                    <small className="correction-badge" title={latestCorrection.reason}>
                      Corregida · {correctionCount} revisión{correctionCount === 1 ? "" : "es"}
                    </small>
                  )}
                </div>
                <div className="history-actions">
                  <div className="history-price">
                    <strong>{effective.currency} {Number(effective.total_price).toLocaleString("es-CR")}</strong>
                    <span>{effective.currency} {(Number(effective.filament_cost) / Number(effective.quantity_g)).toLocaleString("es-CR")} / g</span>
                  </div>
                  <button type="button" onClick={() => setCorrectingPurchaseId(original.id)}>
                    <Pencil size={15} aria-hidden="true" />
                    Corregir
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Las próximas compras aparecerán acá sin reemplazar precios anteriores.</p>
        )}
      </section>

      <MobileNavigation
        isSignedIn={Boolean(signedInEmail)}
        onAccount={openAccount}
        onScan={openQrScanner}
        onWeigh={goToWeighing}
      />
    </main>
  );
}
