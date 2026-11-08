export type QuotationCurrency = "CRC" | "USD" | "EUR";

export const quotationCostCategories = [
  "filament", "supplies", "labor", "electricity", "machine", "finishing", "packaging", "other"
] as const;

export type QuotationLine = {
  project_id: string;
  description: string;
  colors: string;
  quantity: number;
  unit_price_minor: number;
};

export type QuotationSnapshot = {
  seller_name: string;
  seller_contact?: string;
  seller_logo?: string;
  customer_name: string;
  customer_contact: string;
  issued_on: string;
  valid_until: string;
  currency: QuotationCurrency;
  delivery?: string;
  payment_terms?: string;
  terms: string;
  observations?: string;
  lines: QuotationLine[];
  internal_costs: Array<{
    category: typeof quotationCostCategories[number];
    currency: QuotationCurrency;
    amount_minor: number;
  }>;
};

export type QuotationVersion = {
  user_id: string;
  quote_id: string;
  version: number;
  request_id: string;
  snapshot: QuotationSnapshot;
  total_minor: number;
  created_at: string;
};
