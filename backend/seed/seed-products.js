/**
 * Seed Products Script
 * --------------------
 * Seeds PRU product catalog with category mapping and descriptions.
 *
 * Usage:
 *   node backend/seed/seed-products.js
 */

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const Product = require("../models/Product");

const MONGO_URI = process.env.MONGO_URI;

const PRODUCTS = [
  { productName: "PRULove for Life", productCategory: "Protection", description: "This plan is a limited-pay, whole-life insurance plan that provides protection against death, total permanent disability, and accidental death until age 100. Designed for affordability, it allows for flexible premium payments over 5, 10, 15, or 20 years, with premiums starting as low as P87/day." },
  { productName: "PRULifetime Income", productCategory: "Protection", description: "This plan is a limited-pay, participating whole life insurance plan designed for long-term protection and income. It provides a guaranteed 5% annual payout of the sum assured starting from the end of the 6th policy year until age 100, plus 200% life insurance coverage. The plan allows for 5 or 10-year payment terms." },
  { productName: "PRUSteady Income", productCategory: "Protection", description: "This plan is a 20-year non-participating endowment plan designed to provide guaranteed, regular cash flow and life protection. It features guaranteed 10% net annual cash payouts from the end of the 11th year until maturity, a 100% maturity benefit, and 200% protection if the insured passes away before the policy ends." },
  { productName: "PRUWealth 10", productCategory: "Protection", description: "This plan is a limited-offer, single-pay 10-year endowment insurance plan designed for wealth accumulation and protection. It provides guaranteed annual payouts of 5% of the single premium, a 100% return of premium upon maturity, and 110% insurance coverage. It is designed for individuals seeking secure, predictable income." },
  { productName: "PRULife Your Term", productCategory: "Protection", description: "This plan is an affordable, yearly renewable, and customizable term insurance plan designed to provide high protection coverage. It allows for renewal up to age 89 without requiring new proof of health, offering protection against death, accident, disability, and critical illness." },
  { productName: "PRUTerm 15", productCategory: "Protection", description: "This plan is a straightforward 15-year term life insurance plan that provides affordable, high-value coverage. It features a fixed 15-year payment and protection term, allows for conversion to insuravest (investment-linked) plans on the fifth year, and offers optional, additional coverage for accidents, disabilities, or critical illnesses." },
  { productName: "PRUTerm Lindungi", productCategory: "Protection", description: "This plan is the Philippines' first Shari'ah-compliant, Takaful-based life insurance from Pru Life UK. It provides affordable, community-based protection for Muslims and non-Muslims aged 18–60. For as low as ₱250 annually, it offers ₱100,000 in coverage, with 24-hour, paperless application and annual renewal." },
  { productName: "PRUHealth FamLove", productCategory: "Health", description: "This plan is a renewable, 4-in-1 critical illness plan allowing one main insured to cover up to three additional family members (partner, children, or parents) under a single policy. It features SOFI (System and Organ Function Insurance), covering moderate to severe illnesses, and provides coverage until age 85." },
  { productName: "PRUHealth Prime", productCategory: "Health", description: "This plan is an investment-linked life and health insurance plan designed to provide comprehensive coverage against cancer, with benefits starting at age 30 days up to 60 or 65 years old. It features 50% early-stage and 100% late-stage cancer coverage, plus a death benefit, aiming to reduce financial burden through both protection and investment." },
  { productName: "PRUWellness", productCategory: "Health", description: "This plan is a comprehensive, affordable, and renewable health insurance plan, designed to protect savings against hospital bills. It provides daily cash benefits for hospitalization, a lump sum for dread diseases, and coverage for surgical expenses and death." },
  { productName: "PRU Life Care Advance Plus", productCategory: "Health", description: "This plan is a yearly renewable health insurance plan that provides financial protection against 36 critical illnesses. It offers a 25% cash benefit for early-stage diagnoses (up to 4 times for different conditions) and the remaining 75% for advanced-stage illnesses, covering individuals aged 18 to 65 with a minimum sum assured of PhP 250,000." },
  { productName: "PRU Multiple Life Care Plus", productCategory: "Health", description: "This plan is a renewable, yearly health insurance plan providing cash benefits for 36 covered critical illnesses, including diagnosis or surgery. It allows for up to three (3) separate claims (multiple claims) for different critical illness categories. The plan is available for individuals aged 18 to 65." },
  { productName: "PRUMillion Protect", productCategory: "Investment", description: "This plan is a 2-year, limited-pay, investment-linked life insurance plan designed to provide high, long-term coverage (up to 500% of the base annual premium) while allowing for investment growth. It offers accelerated, built-in benefits for total and permanent disability and accidental death/disablement, with a streamlined application process that does not require a medical exam." },
  { productName: "PRULink Elite Protector Series", productCategory: "Investment", description: "This plan is a limited-pay (5, 7, 10, or 15 years) investment-linked life insurance plan designed for high wealth accumulation and maximum protection. It covers individuals up to age 100, offers peso/dollar options, features a loyalty bonus (years 11-15), and boasts high fund allocation for faster growth." },
  { productName: "PRULink Exact Protector", productCategory: "Investment", description: "This plan is a limited-pay, investment-linked life insurance policy designed for both wealth accumulation and long-term protection up to age 100. It offers flexible payment terms of 5, 7, 10, or 15 years, starting at a minimum of PHP 1,500 - 3,000 per month depending on the variant. The plan includes a life insurance benefit (sum assured + fund value) and allows for attaching riders for accidental death, disability, and critical illness." },
  { productName: "PRULink Assurance Account Plus", productCategory: "Investment", description: "This plan is a regular-pay, investment-linked life insurance plan offering high, long-term protection (up to age 100) alongside wealth accumulation opportunities. It provides death, disability, and living benefits, with options to add riders for critical illness, hospitalization, and accidental death." },
  { productName: "PRUMillionaire", productCategory: "Investment", description: "This plan is a single-premium investment-linked life insurance plan designed for high-net-worth individuals to maximize wealth growth, featuring a low 0.5% initial charge, no medical requirements, and potential quarterly payouts. It offers comprehensive protection (125% of single premium) and allows for flexible, diversified investments in professional funds." },
  { productName: "PRULink Investor Account Plus", productCategory: "Investment", description: "This plan is a single-premium, investment-linked life insurance policy designed for medium-to-long-term wealth growth and protection. It allows a one-time payment to access professionally managed funds, offering high potential returns and flexibility, often with no medical requirements needed for basic coverage." },
  { productName: "PRUMax Invest", productCategory: "Investment", description: "This plan is a 15-year renewable term insurance plan that combines traditional life protection with investment-linked opportunities. Designed for individuals aged 18–65, it features a 15-year payment term, and allows policyholders to invest in various Peso PRUlink funds to grow their wealth. It also includes optional benefits like critical illness, accidental death, and disability coverage." },
];

(async () => {
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment (.env).");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  const ops = PRODUCTS.map((p) => ({
    updateOne: {
      filter: { productName: p.productName },
      update: {
        $set: {
          productCategory: p.productCategory,
          description: p.description,
        },
        $setOnInsert: {
          productName: p.productName,
        },
      },
      upsert: true,
    },
  }));

  await Product.bulkWrite(ops, { ordered: false });
  await mongoose.disconnect();
  console.log("✅ Product seed complete.");
  process.exit(0);
})().catch(async (err) => {
  console.error("❌ Product seed failed:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
