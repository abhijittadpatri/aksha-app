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
  const {
    clinicOrStoreName,
    patientName,
    invoiceNo,
    amount,
    paymentStatus,
    invoiceUrl,
  } = input;

  const statusLabel =
    paymentStatus === "PAID"
      ? "Paid"
      : paymentStatus === "PARTIAL"
      ? "Partially Paid"
      : "Unpaid";

  const lines: string[] = [
    `*${clinicOrStoreName}*`,
    ``,
    `Hello ${patientName},`,
    ``,
    `Here are the details of your invoice:`,
    `Invoice No: *${invoiceNo}*`,
    `Amount: *₹${amount.toFixed(2)}*`,
    // `Payment Status: *${statusLabel}*`,
  ];

  // if (invoiceUrl) {
  //   lines.push(``, `View Invoice: ${invoiceUrl}`);
  // }

  lines.push(
    ``,
    `Thank you for choosing ${clinicOrStoreName}.`,
    `For any queries, please contact us.`
  );

  return lines.join("\n");
}
