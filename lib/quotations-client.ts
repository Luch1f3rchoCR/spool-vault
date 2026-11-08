import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotationSnapshot, QuotationVersion } from "@/lib/quotations";

export type QuotationAttempt = {
  requestId: string;
  quoteId: string;
  expectedVersion: number;
  snapshot: QuotationSnapshot;
};

export type QuotationSaveResult =
  | { status: "saved"; version: QuotationVersion }
  | { status: "rejected" | "uncertain"; message: string };

export async function saveQuotation(client: SupabaseClient, owner: string, attempt: QuotationAttempt): Promise<QuotationSaveResult> {
  const { data, error } = await client.rpc("save_quotation_version", {
    p_request_id: attempt.requestId,
    p_quote_id: attempt.quoteId,
    p_expected_version: attempt.expectedVersion,
    p_snapshot: attempt.snapshot
  }).abortSignal(AbortSignal.timeout(15000));
  if (error && ["22023", "22007", "22008", "22P02", "42501", "40001"].includes(error.code)) {
    return { status: "rejected", message: error.message };
  }
  const version = data as QuotationVersion | null;
  if (error || !version || version.user_id !== owner || version.quote_id !== attempt.quoteId
    || version.version !== attempt.expectedVersion + 1 || version.request_id !== attempt.requestId) {
    return { status: "uncertain", message: "No se pudo confirmar el guardado. Reintentá con los mismos datos." };
  }
  return { status: "saved", version };
}

export type QuotationCursor = Pick<QuotationVersion, "created_at" | "request_id">;

export async function listQuotationVersions(client: SupabaseClient, owner: string, before?: QuotationCursor): Promise<QuotationVersion[]> {
  const query = client.from("quotation_versions").select("*").eq("user_id", owner)
    .order("created_at", { ascending: false }).order("request_id", { ascending: false }).limit(20);
  if (before) {
    const date = JSON.stringify(before.created_at);
    query.or(`created_at.lt.${date},and(created_at.eq.${date},request_id.lt.${before.request_id})`);
  }
  const { data, error } = await query.abortSignal(AbortSignal.timeout(15000));
  if (error) throw error;
  return (data ?? []) as QuotationVersion[];
}
