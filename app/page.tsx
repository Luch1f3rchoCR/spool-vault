"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Camera,
  Check,
  Filter,
  LinkIcon,
  LogIn,
  Nfc,
  PackagePlus,
  Plus,
  QrCode,
  ScanLine,
  Search,
  ShoppingCart,
  Sparkles,
  UserRound,
  Weight,
  X
} from "lucide-react";
import { MobileNavigation } from "@/components/mobile-navigation";
import { ProfilePanel } from "@/components/profile-panel";
import { demoLogs, demoRolls } from "@/lib/demo-data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type {
  ConsumptionLog,
  FilamentRoll,
  PackageType,
  PurchaseRecord,
  RollDraft,
  RollStatus,
  Spool,
  Supplier
} from "@/lib/types";

const LOCAL_ROLLS_KEY = "filament-vault-rolls";
const LOCAL_LOGS_KEY = "filament-vault-logs";
const LOCAL_SPOOLS_KEY = "spool-vault-spools";
const LOCAL_PURCHASES_KEY = "spool-vault-purchases";

type DataMode = "authenticated" | "demo" | "local" | "error";
type SpoolMutationResult = { roll: FilamentRoll | null; spool: Spool };

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

function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function payloadForRoll(roll: Pick<FilamentRoll, "id" | "qr_payload">) {
  if (roll.qr_payload) return roll.qr_payload;
  if (typeof window === "undefined") return `filament-roll:${roll.id}`;
  return `${window.location.origin}/?roll=${encodeURIComponent(roll.id)}`;
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

export default function Home() {
  const [rolls, setRolls] = useState<FilamentRoll[]>([]);
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [spools, setSpools] = useState<Spool[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("Todos");
  const [materialFilter, setMaterialFilter] = useState("Todos");
  const [lowOnly, setLowOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showSpools, setShowSpools] = useState(false);
  const [editingSpoolId, setEditingSpoolId] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [draft, setDraft] = useState<RollDraft>(initialDraft);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [syncNote, setSyncNote] = useState("Modo demo local");
  const [authEmail, setAuthEmail] = useState("");
  const [authNote, setAuthNote] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [authVersion, setAuthVersion] = useState(0);
  const [nfcNote, setNfcNote] = useState("");
  const [measuredTotalWeight, setMeasuredTotalWeight] = useState("");
  const [weighingTare, setWeighingTare] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [dataMode, setDataMode] = useState<DataMode>("demo");

  const supabase = useMemo(() => getSupabaseClient(), []);
  const usingSupabase = Boolean(supabase && signedInEmail);

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

        if (userError) {
          setRolls([]);
          setLogs([]);
          setSpools([]);
          setSuppliers([]);
          setPurchases([]);
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
          setSignedInEmail("");
          setRolls(localRolls);
          setLogs(localLogs);
          setSpools(localSpools);
          setPurchases(localPurchases);
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

        const [
          { data: rollData, error: rollError },
          { data: logData, error: logError },
          { data: spoolData, error: spoolError },
          { data: supplierData, error: supplierError },
          { data: purchaseData, error: purchaseError }
        ] =
          await Promise.all([
            supabase.from("filament_rolls").select("*").order("updated_at", { ascending: false }),
            supabase.from("consumption_logs").select("*").order("consumed_at", { ascending: false }),
            supabase.from("spools").select("*").order("code"),
            supabase.from("suppliers").select("*").order("name"),
            supabase.from("purchase_history").select("*").order("purchased_at", { ascending: false })
          ]);

        if (
          !rollError && !logError && !spoolError && !supplierError && !purchaseError && rollData
        ) {
          setRolls(rollData as FilamentRoll[]);
          setLogs((logData ?? []) as ConsumptionLog[]);
          setSpools((spoolData ?? []) as Spool[]);
          setSuppliers((supplierData ?? []) as Supplier[]);
          setPurchases((purchaseData ?? []) as PurchaseRecord[]);
          setSelectedId(rollData[0]?.id ?? "");
          setDataMode("authenticated");
          setSyncNote("Conectado a Supabase · inventario real");
          setIsLoading(false);
          return;
        }

        setRolls([]);
        setLogs([]);
        setSpools([]);
        setSuppliers([]);
        setPurchases([]);
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
      setRolls(localRolls);
      setLogs(localLogs);
      setSpools(localSpools);
      setPurchases(localPurchases);
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
    document.body.style.overflow = showAdd || showSpools || showProfile ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showAdd, showSpools, showProfile]);

  const selectedRoll = rolls.find((roll) => roll.id === selectedId) ?? rolls[0];

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

  const dashboard = useMemo(() => {
    const totalWeight = rolls.reduce((sum, roll) => sum + Number(roll.available_weight_g), 0);
    const lowRolls = rolls.filter((roll) => roll.status === "low" || roll.status === "empty");
    const materials = new Set(rolls.map((roll) => roll.material));
    const inventoryCost = rolls.reduce((sum, roll) => {
      if (roll.currency !== "CRC" || roll.filament_cost_amount == null || !roll.initial_weight_g) return sum;
      return sum + (Number(roll.available_weight_g) / Number(roll.initial_weight_g)) * Number(roll.filament_cost_amount);
    }, 0);

    return {
      rollCount: rolls.length,
      totalWeight,
      lowCount: lowRolls.length,
      materialCount: materials.size,
      inventoryCost
    };
  }, [rolls]);

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

  async function addRoll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    activateLocalMode();

    const form = new FormData(event.currentTarget);
    const initialWeight = parseNumber(form.get("initial_weight_g"), 1000);
    const availableWeight = parseNumber(form.get("available_weight_g"), initialWeight);
    const threshold = parseNumber(form.get("low_threshold_g"), 200);
    const packageType = String(form.get("package_type") || "refill") as PackageType;
    const totalPrice = form.get("price_amount") ? parseNumber(form.get("price_amount")) : null;
    const spoolCost = packageType === "spooled" ? parseNumber(form.get("spool_cost_amount"), 1000) : 0;
    const filamentCost = totalPrice === null ? null : Math.max(0, totalPrice - spoolCost);
    const supplierName = String(form.get("supplier_name") || "Sin proveedor");
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
      status: normalizeStatus(availableWeight, threshold, "new"),
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
      qr_payload: null
    };

    if (usingSupabase && supabase) {
      let supplierId: string | null = null;
      const existingSupplier = suppliers.find(
        (supplier) => supplier.name.toLowerCase() === supplierName.toLowerCase()
      );

      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        const { data: supplierData, error: supplierInsertError } = await supabase
          .from("suppliers")
          .insert({ name: supplierName })
          .select()
          .single();

        if (supplierInsertError) {
          setSyncNote(`No se pudo guardar el proveedor: ${supplierInsertError.message}`);
          return;
        }

        supplierId = (supplierData as Supplier).id;
        setSuppliers((current) => [...current, supplierData as Supplier]);
      }

      const { data, error } = await supabase
        .from("filament_rolls")
        .insert({
          brand: newRoll.brand,
          product_line: newRoll.product_line,
          material: newRoll.material,
          color_name: newRoll.color_name,
          color_hex: newRoll.color_hex,
          initial_weight_g: newRoll.initial_weight_g,
          available_weight_g: newRoll.available_weight_g,
          low_threshold_g: newRoll.low_threshold_g,
          status: newRoll.status,
          location: newRoll.location,
          purchase_date: newRoll.purchase_date || null,
          price_amount: newRoll.price_amount,
          currency: newRoll.currency,
          supplier_id: supplierId,
          package_type: newRoll.package_type,
          spool_cost_amount: newRoll.spool_cost_amount,
          filament_cost_amount: newRoll.filament_cost_amount,
          drying_notes: newRoll.drying_notes,
          photo_url: newRoll.photo_url,
          purchase_url: newRoll.purchase_url
        })
        .select()
        .single();

      if (error) {
        setSyncNote(`No se pudo guardar en Supabase: ${error.message}`);
        return;
      }

      setRolls((current) => [data as FilamentRoll, ...current]);
      setSelectedId((data as FilamentRoll).id);

      if (totalPrice !== null) {
        const purchasePayload = {
          roll_id: (data as FilamentRoll).id,
          supplier_id: supplierId,
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
        };
        const { data: purchaseData, error: purchaseError } = await supabase
          .from("purchase_history")
          .insert(purchasePayload)
          .select()
          .single();

        if (purchaseError) {
          setSyncNote(`Rollo guardado; historial pendiente: ${purchaseError.message}`);
        } else {
          setPurchases((current) => [purchaseData as PurchaseRecord, ...current]);
        }
      }
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
    }

    setDraft(initialDraft);
    setShowAdd(false);
  }

  async function recordConsumption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoll) return;
    activateLocalMode();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const grams = parseNumber(form.get("grams_used"));
    if (grams <= 0) return;
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

    if (usingSupabase && supabase) {
      const { error } = await supabase.from("consumption_logs").insert({
        roll_id: selectedRoll.id,
        project_name: log.project_name,
        grams_used: log.grams_used,
        consumed_at: log.consumed_at,
        notes: log.notes,
        cost_amount: log.cost_amount,
        currency: log.currency
      });

      if (error) {
        setSyncNote(`No se pudo registrar consumo: ${error.message}`);
        return;
      }

      const { data } = await supabase
        .from("filament_rolls")
        .select("*")
        .eq("id", selectedRoll.id)
        .single();

      if (data) {
        setRolls((current) =>
          current.map((roll) => (roll.id === selectedRoll.id ? (data as FilamentRoll) : roll))
        );
      }
      setLogs((current) => [log, ...current]);
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
    }

    formElement.reset();
  }

  async function saveAvailableWeight(availableWeight: number, successNote: string) {
    if (!selectedRoll) return;
    activateLocalMode();

    const currentStatus = availableWeight < Number(selectedRoll.initial_weight_g) && selectedRoll.status === "new"
      ? "open"
      : selectedRoll.status;
    const status = normalizeStatus(availableWeight, selectedRoll.low_threshold_g, currentStatus);

    if (usingSupabase && supabase) {
      const { data, error } = await supabase
        .from("filament_rolls")
        .update({ available_weight_g: availableWeight, status })
        .eq("id", selectedRoll.id)
        .select()
        .single();

      if (error) {
        setSyncNote(`No se pudo ajustar el peso: ${error.message}`);
        return;
      }

      setRolls((current) =>
        current.map((roll) => (roll.id === selectedRoll.id ? (data as FilamentRoll) : roll))
      );
      setSyncNote(successNote);
      return;
    }

    setRolls((current) =>
      current.map((roll) =>
        roll.id === selectedRoll.id
          ? { ...roll, available_weight_g: availableWeight, status }
          : roll
      )
    );
    setSyncNote(successNote);
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
      usingSupabase ? "Peso actualizado en Supabase" : "Peso actualizado en el inventario local"
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

    await saveAvailableWeight(
      calculatedWeight,
      `Balanza: ${totalWeight} g − tara ${tareWeight} g = ${calculatedWeight} g disponibles`
    );
    setMeasuredTotalWeight("");
  }

  async function addSpool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    activateLocalMode();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const spool: Spool = {
      id: crypto.randomUUID(),
      code: String(form.get("code") || `SP-${String(spools.length + 1).padStart(3, "0")}`),
      brand: String(form.get("brand") || "Bambu Lab"),
      spool_material: String(form.get("spool_material") || "Plástico reutilizable"),
      tare_weight_g: form.get("tare_weight_g") ? parseNumber(form.get("tare_weight_g")) : null,
      acquisition_cost: parseNumber(form.get("acquisition_cost"), 1000),
      currency: String(form.get("currency") || "CRC"),
      status: "empty",
      notes: String(form.get("notes") || "")
    };

    if (usingSupabase && supabase) {
      const { data, error } = await supabase.from("spools").insert({
        code: spool.code,
        brand: spool.brand,
        spool_material: spool.spool_material,
        tare_weight_g: spool.tare_weight_g,
        acquisition_cost: spool.acquisition_cost,
        currency: spool.currency,
        status: spool.status,
        notes: spool.notes
      }).select().single();

      if (error) {
        setSyncNote(`No se pudo guardar el spool: ${error.message}`);
        return;
      }
      setSpools((current) => [...current, data as Spool].sort((a, b) => a.code.localeCompare(b.code)));
    } else {
      setSpools((current) => [...current, spool].sort((a, b) => a.code.localeCompare(b.code)));
    }

    formElement.reset();
    setSyncNote(`Spool ${spool.code} agregado como vacío`);
  }

  async function assignSpool(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    activateLocalMode();
    const form = new FormData(event.currentTarget);
    const rollId = String(form.get("roll_id") || "");
    const spoolId = String(form.get("spool_id") || "");
    if (!rollId || !spoolId) return;

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
  }

  async function releaseSpool(roll: FilamentRoll) {
    if (!roll.spool_id) return;
    activateLocalMode();
    const spoolId = roll.spool_id;

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
  }

  async function updateSpool(event: React.FormEvent<HTMLFormElement>, spool: Spool) {
    event.preventDefault();
    activateLocalMode();
    const form = new FormData(event.currentTarget);
    const updates: Partial<Spool> = {
      code: String(form.get("code") || spool.code).trim(),
      brand: String(form.get("brand") || "").trim() || null,
      spool_material: String(form.get("spool_material") || spool.spool_material),
      tare_weight_g: form.get("tare_weight_g") ? parseNumber(form.get("tare_weight_g")) : null,
      acquisition_cost: parseNumber(form.get("acquisition_cost"), 0),
      currency: String(form.get("currency") || spool.currency),
      notes: String(form.get("notes") || "").trim() || null
    };

    if (usingSupabase && supabase) {
      const { data, error } = await supabase
        .from("spools")
        .update(updates)
        .eq("id", spool.id)
        .select()
        .single();
      if (error) {
        setSyncNote(`No se pudo modificar el spool: ${error.message}`);
        return;
      }
      setSpools((current) => current
        .map((item) => item.id === spool.id ? data as Spool : item)
        .sort((a, b) => a.code.localeCompare(b.code)));
    } else {
      setSpools((current) => current
        .map((item) => item.id === spool.id ? { ...item, ...updates } : item)
        .sort((a, b) => a.code.localeCompare(b.code)));
    }

    setEditingSpoolId("");
    setSyncNote(`Spool ${updates.code} actualizado`);
  }

  async function toggleSpoolRetired(spool: Spool) {
    activateLocalMode();
    const retiring = spool.status !== "retired";
    const assignedRoll = rolls.find((roll) => roll.spool_id === spool.id);

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
  }

  async function writeNfcTag() {
    if (!selectedRoll) return;
    if (!("NDEFReader" in window)) {
      setNfcNote("Este navegador no soporta Web NFC. Usá el QR como respaldo.");
      return;
    }

    try {
      const ndef = new NDEFReader();
      const urlPayload = `${window.location.origin}/?roll=${encodeURIComponent(selectedRoll.id)}`;
      await ndef.write({
        records: [
          { recordType: "url", data: urlPayload },
          { recordType: "text", data: `filament-roll:${selectedRoll.id}` }
        ]
      });
      setNfcNote(`Etiqueta NFC escrita para ${selectedRoll.color_name}.`);
    } catch (error) {
      setNfcNote(error instanceof Error ? error.message : "No se pudo escribir la etiqueta NFC.");
    }
  }

  async function scanNfcTag() {
    if (!("NDEFReader" in window)) {
      setNfcNote("Este navegador no soporta Web NFC. Probá con Android + Chrome o escaneá el QR.");
      return;
    }

    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      setNfcNote("Acercá la etiqueta NFC al celular.");

      ndef.onreading = (event) => {
        const decoder = new TextDecoder();
        const readable = event.message.records
          .map((record) => (record.data ? decoder.decode(record.data) : ""))
          .join(" ");
        const found = rolls.find((roll) => readable.includes(roll.id));
        if (found) {
          setSelectedId(found.id);
          setNfcNote(`Rollo detectado: ${found.brand} ${found.color_name}.`);
        } else {
          setNfcNote("Leí la etiqueta, pero no encontré ese rollo en el inventario.");
        }
      };
    } catch (error) {
      setNfcNote(error instanceof Error ? error.message : "No se pudo leer la etiqueta NFC.");
    }
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !authEmail) return;

    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    setAuthNote(
      error
        ? `No se pudo enviar el enlace: ${error.message}`
        : "Listo. Revisá tu correo para abrir la sesión."
    );
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSignedInEmail("");
    setSyncNote("Sesión cerrada");
    setShowProfile(false);
  }

  function goToWeighing() {
    const target = document.getElementById("quick-weigh");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      target?.querySelector<HTMLInputElement>('input[name="available_weight_g"]')?.focus();
    }, 450);
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
  const selectedSpool = selectedRoll?.spool_id
    ? spools.find((spool) => spool.id === selectedRoll.spool_id)
    : undefined;
  const suggestedTare = selectedSpool?.tare_weight_g != null
    ? Number(selectedSpool.tare_weight_g) + (selectedRoll?.brand === "Bambu Lab" ? 41 : 0)
    : selectedRoll?.brand === "Bambu Lab" ? 254 : null;
  const measuredRemaining = measuredTotalWeight !== "" && weighingTare !== ""
    ? Math.round((Number(measuredTotalWeight) - Number(weighingTare)) * 100) / 100
    : null;
  const selectedCostPerGram = selectedRoll?.filament_cost_amount && selectedRoll.initial_weight_g
    ? Number(selectedRoll.filament_cost_amount) / Number(selectedRoll.initial_weight_g)
    : null;

  useEffect(() => {
    setMeasuredTotalWeight("");
    setWeighingTare(suggestedTare == null ? "" : String(suggestedTare));
  }, [selectedRoll?.id, suggestedTare]);

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

          {isSupabaseConfigured() && !signedInEmail && showLogin && (
            <section className="panel auth-panel auth-popover" id="login-panel" aria-label="Iniciar sesión">
              <div className="auth-panel-head">
                <div>
                  <p className="eyebrow">Cuenta segura</p>
                  <h2>Entrá a Spool Vault</h2>
                </div>
                <button className="modal-close" type="button" onClick={() => setShowLogin(false)} aria-label="Cerrar inicio de sesión">
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
              <form onSubmit={sendMagicLink}>
                <label htmlFor="auth-email">Correo electrónico</label>
                <input
                  id="auth-email"
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="nombre@correo.com"
                  autoComplete="email"
                  required
                />
                <button type="submit">Enviar enlace seguro</button>
                <p className="auth-help">Enlace de un solo uso. Sin contraseña.</p>
                {authNote && <p className="auth-result" role="status">{authNote}</p>}
              </form>
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
          <strong>₡{Math.round(dashboard.inventoryCost).toLocaleString("es-CR")}</strong>
          <span>inventario actual</span>
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
            if (event.target === event.currentTarget) setShowAdd(false);
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
                onClick={() => setShowAdd(false)}
                aria-label="Cerrar formulario"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <form className="form-grid" onSubmit={addRoll}>
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
            <button className="primary-action wide" type="submit">
              <PackagePlus size={18} aria-hidden="true" />
              Guardar rollo
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

      {showSpools && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowSpools(false);
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
              <button className="modal-close" type="button" onClick={() => setShowSpools(false)} aria-label="Cerrar spools">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="spool-summary">
              <article><strong>{spools.length}</strong><span>registrados</span></article>
              <article><strong>{emptySpools.length}</strong><span>vacíos</span></article>
              <article><strong>{spools.filter((spool) => spool.status === "in_use").length}</strong><span>en uso</span></article>
              <article><strong>{spools.filter((spool) => spool.status === "retired").length}</strong><span>inactivos</span></article>
            </div>

            <form className="form-grid compact-form" onSubmit={addSpool}>
              <h3 className="wide">Registrar spool vacío</h3>
              <label>
                Código
                <input name="code" required defaultValue={`SP-${String(spools.length + 1).padStart(3, "0")}`} />
              </label>
              <label>
                Marca / compatibilidad
                <select name="brand" defaultValue="Bambu Lab">
                  {brandOptions.map((brand) => <option key={brand}>{brand}</option>)}
                </select>
              </label>
              <label>
                Material del spool
                <select name="spool_material" defaultValue="Plástico reutilizable">
                  <option>Plástico reutilizable</option>
                  <option>Cartón</option>
                  <option>Otro</option>
                </select>
              </label>
              <label>
                Tara en gramos
                <input name="tare_weight_g" type="number" min="0" step="0.01" placeholder="Peso vacío opcional" />
              </label>
              <label>
                Costo
                <input name="acquisition_cost" type="number" min="0" defaultValue="1000" />
              </label>
              <input name="currency" type="hidden" value="CRC" />
              <label>
                Notas
                <input name="notes" placeholder="Estado, origen..." />
              </label>
              <button className="primary-action wide" type="submit">Agregar spool vacío</button>
            </form>

            <form className="form-grid compact-form" onSubmit={assignSpool}>
              <h3 className="wide">Asignar spool a un filamento</h3>
              <label>
                Filamento sin spool
                <select name="roll_id" required disabled={!unassignedRolls.length}>
                  <option value="">Seleccionar filamento</option>
                  {unassignedRolls.map((roll) => (
                    <option key={roll.id} value={roll.id}>{roll.brand} · {roll.product_line} · {roll.color_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Spool vacío
                <select name="spool_id" required disabled={!emptySpools.length}>
                  <option value="">Seleccionar spool</option>
                  {emptySpools.map((spool) => (
                    <option key={spool.id} value={spool.id}>{spool.code} · {spool.brand || "Sin marca"}</option>
                  ))}
                </select>
              </label>
              <button className="primary-action wide" type="submit" disabled={!unassignedRolls.length || !emptySpools.length}>
                Asignar spool
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
                      <button type="button" onClick={() => setEditingSpoolId((current) => current === spool.id ? "" : spool.id)}>
                        {editingSpoolId === spool.id ? "Cancelar" : "Editar"}
                      </button>
                      {assignedRoll && (
                        <button type="button" onClick={() => releaseSpool(assignedRoll)}>Quitar filamento</button>
                      )}
                      <button
                        className={spool.status === "retired" ? "restore" : "danger"}
                        type="button"
                        onClick={() => toggleSpoolRetired(spool)}
                      >
                        {spool.status === "retired" ? "Reactivar" : "Inactivar"}
                      </button>
                    </div>
                    {editingSpoolId === spool.id && (
                      <form className="spool-edit-form" onSubmit={(event) => updateSpool(event, spool)}>
                        <label>Código<input name="code" required defaultValue={spool.code} /></label>
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
                        <button className="primary-action wide" type="submit">Guardar cambios</button>
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
        <ProfilePanel email={signedInEmail} onClose={() => setShowProfile(false)} onSignOut={signOut} />
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
                <p className={statusClass(selectedRoll.status)}>{statusLabels[selectedRoll.status]}</p>
                <h2>{selectedRoll.color_name}</h2>
                <p>
                  {selectedRoll.brand} · {selectedRoll.product_line || "Sin línea"} ·{" "}
                  {selectedRoll.material}
                </p>
              </div>
            </div>

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
              <button className="secondary-action" type="button" onClick={() => releaseSpool(selectedRoll)}>
                Liberar {selectedSpool.code} como spool vacío
              </button>
            )}

            {selectedRoll.drying_notes && <p className="notes">{selectedRoll.drying_notes}</p>}

            <form className="consume-form weighing-form" id="quick-weigh" onSubmit={adjustFromMeasuredWeight}>
              <h3>Actualizar con balanza</h3>
              <p className="form-help">Ingresá el peso completo. Restamos la tara antes de guardar el filamento disponible.</p>
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
              </div>
              {selectedRoll.brand === "Bambu Lab" && (
                <p className="tare-hint">Referencia Bambu: 213 g del spool + 41 g del cartón/NFC = 254 g. Podés corregirla si tu montaje es distinto.</p>
              )}
              <div className={measuredRemaining != null && measuredRemaining < 0 ? "weighing-result invalid" : "weighing-result"}>
                <span>Filamento calculado</span>
                <strong>{measuredRemaining == null ? "—" : `${measuredRemaining.toLocaleString("es-CR")} g`}</strong>
                <small>Peso total − tara</small>
              </div>
              <button className="primary-action" type="submit" disabled={measuredRemaining == null || measuredRemaining < 0}>
                <Weight size={18} aria-hidden="true" />
                Guardar peso calculado
              </button>
            </form>

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
                <button className="primary-action" type="submit">
                  <Weight size={18} aria-hidden="true" />
                  Actualizar gramos
                </button>
                </div>
              </form>
            </details>

            <form className="consume-form" onSubmit={recordConsumption}>
              <h3>Registrar consumo</h3>
              <input name="project_name" required placeholder="Proyecto: Miniatura Hulk" />
              <div className="inline-fields">
                <input name="grams_used" required type="number" min="1" placeholder="Gramos" />
                <input name="consumed_at" type="date" defaultValue={todayIso()} />
              </div>
              <input name="notes" placeholder="Notas opcionales" />
              <button className="primary-action" type="submit">
                <Weight size={18} aria-hidden="true" />
                Descontar gramos
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
          <span>{purchases.length} registros</span>
        </div>
        {purchases.length ? (
          <div className="history-list">
            {purchases.map((purchase) => (
              <article key={purchase.id}>
                <span className="mini-swatch" style={{ backgroundColor: purchase.color_hex }} />
                <div>
                  <strong>{purchase.brand} · {purchase.product_line} · {purchase.color_name}</strong>
                  <span>{purchase.supplier_name} · {purchase.purchased_at} · {purchase.package_type === "spooled" ? "Con spool" : "Refill"}</span>
                </div>
                <div className="history-price">
                  <strong>{purchase.currency} {Number(purchase.total_price).toLocaleString("es-CR")}</strong>
                  <span>{purchase.currency} {(Number(purchase.filament_cost) / Number(purchase.quantity_g)).toLocaleString("es-CR")} / g</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Las próximas compras aparecerán acá sin reemplazar precios anteriores.</p>
        )}
      </section>

      <MobileNavigation isSignedIn={Boolean(signedInEmail)} onAccount={openAccount} onWeigh={goToWeighing} />
    </main>
  );
}
