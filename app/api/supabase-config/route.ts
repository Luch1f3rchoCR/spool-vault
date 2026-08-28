import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function readPublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY
  };
}

function decodeJwtRole(key: string) {
  const [, payload] = key.split(".");
  if (!payload) return "";

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as { role?: string };
    return decoded.role ?? "";
  } catch {
    return "";
  }
}

function isBrowserSafeSupabaseKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  if (key.startsWith("sb_secret_")) return false;

  return decodeJwtRole(key) === "anon";
}

export function GET() {
  const { url, publishableKey } = readPublicConfig();
  const hasSafeKey = publishableKey ? isBrowserSafeSupabaseKey(publishableKey) : false;

  return NextResponse.json({
    url: url ?? "",
    publishableKey: hasSafeKey ? publishableKey : "",
    hasUrl: Boolean(url),
    hasPublishableKey: hasSafeKey,
    rejectedUnsafeKey: Boolean(publishableKey && !hasSafeKey)
  });
}
