import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatDate, formatMoney } from "@/lib/i18n";
import type { QuotationVersion } from "@/lib/quotations";

// Only customer-facing fields enter the document. PDF amounts use the saved sale currency.
export function quotationPdfDefinition({ quote_id, version, snapshot, total_minor }: QuotationVersion): TDocumentDefinitions {
  const { seller_name, customer_name, customer_contact, issued_on, valid_until, terms, currency, lines } = snapshot;
  const reference = `${quote_id.slice(0, 13).toUpperCase()} · V${version}`;
  const money = (minor: number) => formatMoney(minor / 100, currency, "es");
  const date = (value: string) => formatDate(value, "es", { dateStyle: "medium" }) ?? value;
  const columns: TableCell[][] = [[
    { text: "Proyecto / variante", style: "columnHeading" },
    { text: "Cant.", style: "columnHeading", alignment: "right" },
    { text: "Precio unitario", style: "columnHeading", alignment: "right" },
    { text: "Importe", style: "columnHeading", alignment: "right" }
  ]];
  for (const line of lines) {
    columns.push([
      { stack: [line.description, ...(line.colors ? [{ text: line.colors, style: "detail" }] : [])] },
      { text: String(line.quantity), alignment: "right" },
      { text: money(line.unit_price_minor), alignment: "right" },
      { text: money(line.quantity * line.unit_price_minor), alignment: "right" }
    ]);
  }

  const content: Content[] = [
    { text: seller_name, style: "seller" },
    { text: "Cotización", style: "title" },
    { text: reference, style: "detail", margin: [0, 0, 0, 18] },
    {
      columns: [
        { stack: [{ text: "CLIENTE", style: "label" }, customer_name, ...(customer_contact ? [{ text: customer_contact, style: "detail" }] : [])] },
        { stack: [
          { text: "EMISIÓN / VIGENCIA", style: "label" },
          { text: `Emitida el ${date(issued_on)}` },
          { text: `Válida hasta el ${date(valid_until)}` }
        ] }
      ],
      columnGap: 18,
      margin: [0, 0, 0, 22]
    },
    {
      table: { headerRows: 1, dontBreakRows: true, widths: ["*", 38, 94, 94], body: columns },
      layout: "lightHorizontalLines"
    },
    { text: `Total  ${money(total_minor)}`, style: "total", alignment: "right", margin: [0, 14, 0, 18] }
  ];
  if (terms) content.push({ text: "CONDICIONES", style: "label" }, { text: terms });

  return {
    pageSize: "A4",
    pageMargins: [38, 38, 38, 54],
    info: { title: `Cotización ${reference}`, author: seller_name },
    defaultStyle: { fontSize: 10, color: "#192C24", lineHeight: 1.2 },
    styles: {
      seller: { fontSize: 13, bold: true, color: "#23634B" },
      title: { fontSize: 27, bold: true, margin: [0, 4, 0, 5] },
      detail: { fontSize: 9, color: "#58695E" },
      label: { fontSize: 9, bold: true, color: "#23634B", margin: [0, 0, 0, 5] },
      columnHeading: { fillColor: "#E8EFE5", color: "#192C24", bold: true },
      total: { fontSize: 15, bold: true, color: "#23634B" }
    },
    content,
    footer: (page, pages) => ({
      text: `Generado con Proper · ${page} / ${pages}`,
      style: "detail",
      margin: [38, 14, 38, 0]
    })
  };
}

export async function createQuotationPdf(quotation: QuotationVersion) {
  const [pdfMake, fonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);
  pdfMake.default.addVirtualFileSystem(fonts.default);
  return pdfMake.default.createPdf(quotationPdfDefinition(quotation)).getBlob();
}
