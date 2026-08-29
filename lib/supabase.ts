import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let runtimeConfig: SupabaseRuntimeConfig | null = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;

type SupabaseRuntimeConfig = {
  url: string;
  publishableKey: string;
  source: "build" | "runtime";
};

function getCurrentConfig(): SupabaseRuntimeConfig | null {
  if (supabaseUrl && supabasePublishableKey) {
    return {
      url: supabaseUrl,
      publishableKey: supabasePublishableKey,
      source: "build"
    };
  }

  return runtimeConfig;
}

function isLocalUrl(url: string) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1");
  }
}

export function getSupabaseConfigStatus() {
  const config = getCurrentConfig();
  const hasUrl = Boolean(config?.url ?? supabaseUrl);
  const hasPublishableKey = Boolean(config?.publishableKey ?? supabasePublishableKey);
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const isBrowserLocal = browserOrigin ? isLocalUrl(browserOrigin) : false;
  const isSiteUrlLocal = siteUrl ? isLocalUrl(siteUrl) : false;
  const redirectUrl = getAuthRedirectUrl();

  return {
    hasUrl,
    hasPublishableKey,
    isConfigured: hasUrl && hasPublishableKey,
    isBrowserLocal,
    isSiteUrlLocal,
    redirectUrl,
    source: config?.source ?? "build"
  };
}

export function isSupabaseConfigured() {
  return getSupabaseConfigStatus().isConfigured;
}

export function getAuthRedirectUrl() {
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  let url = browserOrigin || siteUrl || vercelUrl || "http://localhost:3000";

  if (browserOrigin && !isLocalUrl(browserOrigin) && siteUrl && isLocalUrl(siteUrl)) {
    url = vercelUrl || browserOrigin;
  }

  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }

  return url.endsWith("/") ? url : `${url}/`;
}

export function getSupabaseClient() {
  const config = getCurrentConfig();

  if (!config) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(
      config.url,
      config.publishableKey
    );
  }

  return browserClient;
}

export async function initializeSupabaseClient() {
  const existingClient = getSupabaseClient();

  if (existingClient || typeof window === "undefined") {
    return existingClient;
  }

  try {
    const response = await fetch("/api/supabase-config", { cache: "no-store" });
    if (!response.ok) return null;

    const config = await response.json() as Partial<SupabaseRuntimeConfig>;

    if (!config.url || !config.publishableKey) {
      return null;
    }

    runtimeConfig = {
      url: config.url,
      publishableKey: config.publishableKey,
      source: "runtime"
    };

    return getSupabaseClient();
  } catch {
    return null;
  }
}
