import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;

function isLocalUrl(url: string) {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1");
  }
}

export function getSupabaseConfigStatus() {
  const hasUrl = Boolean(supabaseUrl);
  const hasPublishableKey = Boolean(supabasePublishableKey);
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
    redirectUrl
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
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(
      supabaseUrl!,
      supabasePublishableKey!
    );
  }

  return browserClient;
}
