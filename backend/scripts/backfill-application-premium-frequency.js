/**
 * Deprecated Application premium-frequency backfill
 * -------------------------------------------------
 * Frequency of premium payment is now owned by AnnualPayment, not Application.
 * This script is intentionally a no-op to avoid reintroducing obsolete
 * Application.recordPremiumPaymentTransfer.frequencyOfPremiumPayment fields.
 *
 * Use instead:
 *   node backend/scripts/backfill-annual-payment-records.js
 */

console.log("No changes made. Frequency is now stored in AnnualPayment; run backend/scripts/backfill-annual-payment-records.js instead.");
