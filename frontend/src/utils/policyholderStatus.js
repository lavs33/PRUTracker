export function normalizePolicyholderStatus(status, nextPaymentDate) {
  const normalized = String(status || "").trim();
  if (!nextPaymentDate && ["At Risk", "Lapsed"].includes(normalized)) return "Active";
  return normalized;
}

export function policyholderStatusClass(status) {
  const normalized = String(status || "").trim();
  if (normalized === "Active") return "active";
  if (normalized === "At Risk") return "at-risk";
  if (normalized === "Lapsed") return "lapsed";
  if (normalized === "Paid-Up") return "paid-up";
  if (normalized === "Matured") return "matured";
  if (normalized === "Cancelled") return "cancelled";
  return "nurture";
}
