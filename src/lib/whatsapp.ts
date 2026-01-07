// src/lib/whatsapp.ts

export type InvoicePaymentStatus = "PAID" | "UNPAID" | "PARTIAL";

export function buildInvoiceWhatsAppMessage(input: {
  clinicOrStoreName: string;
  patientName: string;
  invoiceNo: string;
  amount: number;
  paymentStatus: InvoicePaymentStatus;
  invoiceUrl?: string;
}) {
  const { clinicOrStoreName, patientName, invoiceNo, amount, paymentStatus, invoiceUrl } = input;

  const statusLabel =
    paymentStatus === "PAID"
      ? "PAID"
      : paymentStatus === "PARTIAL"
      ? "PARTIALLY PAID"
      : "UNPAID";

  const lines = [
    `*${clinicOrStoreName}*`,
    `Hi ${patientName},`,
    `Invoice: *${invoiceNo}*`,
    `Amount: *₹${amount.toFixed(2)}*`,
    `Status: *${statusLabel}*`,
  ];

  if (invoiceUrl) lines.push(`Link: ${invoiceUrl}`);

  return lines.join("\n");
}
