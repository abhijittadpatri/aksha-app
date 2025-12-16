export function buildInvoiceWhatsAppMessage(input: {
  clinicOrStoreName: string;
  patientName: string;
  invoiceNo: string;
  amount: number;
  paymentStatus: "PAID" | "UNPAID";
  invoiceUrl: string;
}) {
  const amountINR = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(input.amount || 0);

  const statusText = input.paymentStatus === "PAID" ? "Paid ✅" : "Pending ❗";

  // Professional, short, clinic-friendly
  return [
    `Hello ${input.patientName},`,
    ``,
    `Thank you for visiting *${input.clinicOrStoreName}*.`,
    `Invoice *${input.invoiceNo}* • Amount *${amountINR}* • Status: *${statusText}*`,
    ``,
    `You can view/print your invoice here:`,
    `${input.invoiceUrl}`,
    ``,
    `Regards,`,
    `${input.clinicOrStoreName}`,
  ].join("\n");
}
