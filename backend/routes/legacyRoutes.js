function registerLegacyRoutes(app, deps) {
  const {
    mongoose,
    User,
    Admin,
    Agent,
    Prospect,
    Policyholder,
    Lead,
    LeadEngagement,
    ContactAttempt,
    ScheduledMeeting,
    NeedsAssessment,
    Proposal,
    Application,
    Policy,
    Payment,
    AnnualPayment,
    Product,
    Task,
    Notification,
    Unit,
    Branch,
    Area,
    BM,
    UM,
    AUM,
    buildManagerPopulateQuery,
    getManagerProfile,
    getManagerModelByType,
    formatManagerRecord,
    matchesManagerScope,
    matchesSearchTerms,
    padSixDigitSequence,
    getNextRoleSequence,
    buildGeneratedUsername,
    calculateAgeFromDate,
    isFutureDate,
    buildGeneratedPassword,
    buildAdminOrganizationListPayload,
    findActiveManagerForScope,
    buildManagerPortalPayload,
    toObjectId,
    normalizeString,
    pickDate,
    startOfDay,
    endOfDay,
    toYmd,
    toNum,
    round2,
    rankAndPct,
    computeTaskStatus,
    parseDateRangeFromPreset,
    frequencyToAnnual,
    ensureTaskNotificationsForTask,
    syncTaskNotificationsForTask,
    syncTaskNotificationsForTasks,
    markTaskNotificationAsRead,
  } = deps;
  let contactAttemptCycleIndexEnsured = false;
  async function ensureContactAttemptCycleIndex() {
    if (contactAttemptCycleIndexEnsured) return;
    try {
      const collection = ContactAttempt.collection;
      const legacyIdxName = "leadEngagementId_1_attemptNo_1";
      const hasLegacyUniqueIndex = await collection.indexExists(legacyIdxName);
      if (hasLegacyUniqueIndex) {
        await collection.dropIndex(legacyIdxName);
      }
      contactAttemptCycleIndexEnsured = true;
    } catch (err) {
      if (err?.codeName !== "IndexNotFound") throw err;
      contactAttemptCycleIndexEnsured = true;
    }
  }

  let needsAssessmentAttemptCycleIndexEnsured = false;
  async function ensureNeedsAssessmentAttemptCycleIndex() {
    if (needsAssessmentAttemptCycleIndexEnsured) return;
    try {
      const collection = NeedsAssessment.collection;
      const indexes = await collection.indexes();
      const legacyUniqueIndex = indexes.find((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1"
          && index?.unique === true
          && Object.keys(key).length === 1
          && Number(key.leadEngagementId) === 1;
      });
      if (legacyUniqueIndex) {
        await collection.dropIndex("leadEngagementId_1");
      }
      const refreshedIndexes = legacyUniqueIndex ? await collection.indexes() : indexes;
      const hasCycleIndex = refreshedIndexes.some((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1_attemptCycle_1"
          && index?.unique === true
          && Number(key.leadEngagementId) === 1
          && Number(key.attemptCycle) === 1;
      });
      if (!hasCycleIndex) {
        await collection.createIndex(
          { leadEngagementId: 1, attemptCycle: 1 },
          { name: "leadEngagementId_1_attemptCycle_1", unique: true, background: true }
        );
      }
      needsAssessmentAttemptCycleIndexEnsured = true;
    } catch (err) {
      if (err?.codeName !== "IndexNotFound") throw err;
      needsAssessmentAttemptCycleIndexEnsured = true;
    }
  }

  let applicationAttemptCycleIndexEnsured = false;
  async function ensureApplicationAttemptCycleIndex() {
    if (applicationAttemptCycleIndexEnsured) return;
    try {
      const collection = Application.collection;
      const indexes = await collection.indexes();
      const legacyUniqueIndex = indexes.find((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1"
          && index?.unique === true
          && Object.keys(key).length === 1
          && Number(key.leadEngagementId) === 1;
      });
      if (legacyUniqueIndex) {
        await collection.dropIndex("leadEngagementId_1");
      }
      const refreshedIndexes = legacyUniqueIndex ? await collection.indexes() : indexes;
      const hasCycleIndex = refreshedIndexes.some((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1_attemptCycle_1"
          && index?.unique === true
          && Number(key.leadEngagementId) === 1
          && Number(key.attemptCycle) === 1;
      });
      if (!hasCycleIndex) {
        await collection.createIndex(
          { leadEngagementId: 1, attemptCycle: 1 },
          { name: "leadEngagementId_1_attemptCycle_1", unique: true, background: true }
        );
      }
      applicationAttemptCycleIndexEnsured = true;
    } catch (err) {
      if (err?.codeName !== "IndexNotFound") throw err;
      applicationAttemptCycleIndexEnsured = true;
    }
  }

  let proposalAttemptCycleIndexEnsured = false;
  async function ensureProposalAttemptCycleIndex() {
    if (proposalAttemptCycleIndexEnsured) return;
    try {
      const collection = Proposal.collection;
      const indexes = await collection.indexes();
      const legacyUniqueIndex = indexes.find((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1"
          && index?.unique === true
          && Object.keys(key).length === 1
          && Number(key.leadEngagementId) === 1;
      });
      if (legacyUniqueIndex) {
        await collection.dropIndex("leadEngagementId_1");
      }
      const refreshedIndexes = legacyUniqueIndex ? await collection.indexes() : indexes;
      const hasCycleIndex = refreshedIndexes.some((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1_attemptCycle_1"
          && index?.unique === true
          && Number(key.leadEngagementId) === 1
          && Number(key.attemptCycle) === 1;
      });
      if (!hasCycleIndex) {
        await collection.createIndex(
          { leadEngagementId: 1, attemptCycle: 1 },
          { name: "leadEngagementId_1_attemptCycle_1", unique: true, background: true }
        );
      }
      proposalAttemptCycleIndexEnsured = true;
    } catch (err) {
      if (err?.codeName !== "IndexNotFound") throw err;
      proposalAttemptCycleIndexEnsured = true;
    }
  }


  async function ensureProposalForCurrentAttemptCycle(leadEngagementId, attemptCycle, { session, outcomeActivity = "Generate Proposal" } = {}) {
    const normalizedAttemptCycle = normalizeAttemptCycle(attemptCycle);
    return Proposal.findOneAndUpdate(
      { leadEngagementId, attemptCycle: normalizedAttemptCycle },
      {
        $setOnInsert: {
          leadEngagementId,
          attemptCycle: normalizedAttemptCycle,
          outcomeActivity,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
  }


  async function ensureApplicationForCurrentAttemptCycle(leadEngagementId, attemptCycle, { session, chosenProductId = null } = {}) {
    await ensureApplicationAttemptCycleIndex();
    const normalizedAttemptCycle = normalizeAttemptCycle(attemptCycle);
    const setOnInsert = {
      leadEngagementId,
      attemptCycle: normalizedAttemptCycle,
      outcomeActivity: "Record Prospect Attendance",
    };
    if (chosenProductId) setOnInsert.chosenProductId = chosenProductId;

    return Application.findOneAndUpdate(
      { leadEngagementId, attemptCycle: normalizedAttemptCycle },
      { $setOnInsert: setOnInsert },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
  }


  let policyAttemptCycleIndexEnsured = false;
  async function ensurePolicyAttemptCycleIndex() {
    if (policyAttemptCycleIndexEnsured) return;
    try {
      const collection = Policy.collection;
      const indexes = await collection.indexes();
      const legacyUniqueIndex = indexes.find((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1"
          && index?.unique === true
          && Object.keys(key).length === 1
          && Number(key.leadEngagementId) === 1;
      });
      if (legacyUniqueIndex) {
        await collection.dropIndex("leadEngagementId_1");
      }
      const refreshedIndexes = legacyUniqueIndex ? await collection.indexes() : indexes;
      const hasCycleIndex = refreshedIndexes.some((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1_attemptCycle_1"
          && index?.unique === true
          && Number(key.leadEngagementId) === 1
          && Number(key.attemptCycle) === 1;
      });
      if (!hasCycleIndex) {
        await collection.createIndex(
          { leadEngagementId: 1, attemptCycle: 1 },
          { name: "leadEngagementId_1_attemptCycle_1", unique: true, background: true }
        );
      }
      policyAttemptCycleIndexEnsured = true;
    } catch (err) {
      if (err?.codeName !== "IndexNotFound") throw err;
      policyAttemptCycleIndexEnsured = true;
    }
  }

  async function ensurePolicyForCurrentAttemptCycle(leadEngagementId, attemptCycle, { session, chosenProductId = null } = {}) {
    await ensurePolicyAttemptCycleIndex();
    const normalizedAttemptCycle = normalizeAttemptCycle(attemptCycle);
    const setOnInsert = {
      leadEngagementId,
      attemptCycle: normalizedAttemptCycle,
      outcomeActivity: "Upload Initial Premium eOR",
    };
    if (chosenProductId) setOnInsert.chosenProductId = chosenProductId;

    return Policy.findOneAndUpdate(
      { leadEngagementId, ...attemptCycleFilterForCycle(normalizedAttemptCycle) },
      { $setOnInsert: setOnInsert },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );
  }

  let scheduledMeetingAttemptCycleBackfilled = false;
  let annualPaymentLeadEngagementIndexEnsured = false;
  async function ensureAnnualPaymentLeadEngagementIndex() {
    if (annualPaymentLeadEngagementIndexEnsured) return;
    try {
      const collection = AnnualPayment.collection;
      const indexes = await collection.indexes();
      const legacyUniqueIndex = indexes.find((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1"
          && index?.unique === true
          && Object.keys(key).length === 1
          && Number(key.leadEngagementId) === 1;
      });
      if (legacyUniqueIndex) {
        await collection.dropIndex("leadEngagementId_1");
      }
      const refreshedIndexes = legacyUniqueIndex ? await collection.indexes() : indexes;
      const hasLeadEngagementIndex = refreshedIndexes.some((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1"
          && Object.keys(key).length === 1
          && Number(key.leadEngagementId) === 1;
      });
      if (!hasLeadEngagementIndex) {
        await collection.createIndex({ leadEngagementId: 1 }, { name: "leadEngagementId_1", background: true });
      }
      annualPaymentLeadEngagementIndexEnsured = true;
    } catch (err) {
      if (err?.codeName !== "IndexNotFound") throw err;
      annualPaymentLeadEngagementIndexEnsured = true;
    }
  }

  let paymentLeadEngagementIndexEnsured = false;
  async function ensurePaymentLeadEngagementIndex() {
    if (paymentLeadEngagementIndexEnsured) return;
    try {
      const collection = Payment.collection;
      const indexes = await collection.indexes();
      const legacyUniqueIndex = indexes.find((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1"
          && index?.unique === true
          && Object.keys(key).length === 1
          && Number(key.leadEngagementId) === 1;
      });
      if (legacyUniqueIndex) {
        await collection.dropIndex("leadEngagementId_1");
      }
      const refreshedIndexes = legacyUniqueIndex ? await collection.indexes() : indexes;
      const hasLeadEngagementIndex = refreshedIndexes.some((index) => {
        const key = index?.key || {};
        return index?.name === "leadEngagementId_1"
          && Object.keys(key).length === 1
          && Number(key.leadEngagementId) === 1;
      });
      if (!hasLeadEngagementIndex) {
        await collection.createIndex({ leadEngagementId: 1 }, { name: "leadEngagementId_1", background: true });
      }
      paymentLeadEngagementIndexEnsured = true;
    } catch (err) {
      if (err?.codeName !== "IndexNotFound") throw err;
      paymentLeadEngagementIndexEnsured = true;
    }
  }

  function addMonthsPreservingDay(date, months) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  function formatPaymentPeriodDate(date) {
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }

  function derivePaymentPeriod(paymentDate, frequency) {
    const startDate = paymentDate ? new Date(paymentDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      return { startDate: null, endDate: null, label: "" };
    }

    const normalizedFrequency = String(frequency || "").trim();
    const intervalMonthsByFrequency = {
      Monthly: 1,
      Quarterly: 3,
      "Half-yearly": 6,
      Yearly: 12,
    };
    const intervalMonths = intervalMonthsByFrequency[normalizedFrequency] || 0;
    if (!intervalMonths) {
      return { startDate, endDate: null, label: "" };
    }

    const endDate = addMonthsPreservingDay(startDate, intervalMonths);
    endDate.setDate(endDate.getDate() - 1);
    return {
      startDate,
      endDate,
      label: `${formatPaymentPeriodDate(startDate)} - ${formatPaymentPeriodDate(endDate)}`,
    };
  }

  function deriveAnnualPaymentPeriod(paymentDate) {
    const startDate = paymentDate ? new Date(paymentDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      return { startDate: null, endDate: null, label: "" };
    }

    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    endDate.setDate(endDate.getDate() - 1);

    return {
      startDate,
      endDate,
      label: `${formatPaymentPeriodDate(startDate)} - ${formatPaymentPeriodDate(endDate)}`,
    };
  }


  function nextDay(date) {
    const next = date ? new Date(date) : null;
    if (!next || Number.isNaN(next.getTime())) return null;
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function getPaymentFrequencyIntervalMonths(frequency) {
    const intervalMonthsByFrequency = {
      Monthly: 1,
      Quarterly: 3,
      "Half-yearly": 6,
      Yearly: 12,
    };
    return intervalMonthsByFrequency[String(frequency || "").trim()] || 0;
  }

  function isBeforePaymentTermEnd(date, paymentTermEndDate) {
    if (!date || Number.isNaN(date.getTime())) return false;
    if (!paymentTermEndDate || Number.isNaN(paymentTermEndDate.getTime())) return true;
    return date < paymentTermEndDate;
  }

  const TERMINAL_POLICYHOLDER_STATUSES = ["Cancelled", "Paid-Up", "Matured"];
  const PAYMENT_TRACKING_NOTIFICATION_TYPES = [
    "PAYMENT_TRANSFER_REMINDER",
    "PAYMENT_EOR_REMINDER",
    "PAYMENT_MISSED_TRANSFER",
    "PAYMENT_POLICY_LAPSED",
  ];

  function deriveCoverageEndDate(policy = {}) {
    const coverage = policy?.recordCoverageDurationDetails || {};
    const rawEndDate = coverage.policyEndDate || coverage.coverageEndDate || null;
    const endDate = rawEndDate ? new Date(rawEndDate) : null;
    if (!endDate || Number.isNaN(endDate.getTime())) return null;
    endDate.setHours(0, 0, 0, 0);
    return endDate;
  }

  function isReachedByToday(date) {
    if (!date || Number.isNaN(date.getTime())) return false;
    const todayDay = dayNumberFromDateKey(dateKeyInTZ(new Date(), "Asia/Manila"));
    const targetDay = dayNumberFromDateKey(dateKeyInTZ(date, "Asia/Manila"));
    return todayDay !== null && targetDay !== null && targetDay <= todayDay;
  }

  function hasOpenAnnualPaymentRecord(annualPayments = []) {
    return annualPayments.some((annualPayment) => ["Not Started", "Ongoing"].includes(String(annualPayment?.status || "")));
  }

  function derivePolicyholderLifecycleStatus({ currentStatus, policy, nextPaymentDate, annualPayments = [] }) {
    const normalizedStatus = String(currentStatus || "");
    if (normalizedStatus === "Cancelled") return { status: "Cancelled", isPaidUp: false, isMatured: false };

    const coverageReached = isReachedByToday(deriveCoverageEndDate(policy));
    const noOpenAnnualPayments = annualPayments.length > 0 && !hasOpenAnnualPaymentRecord(annualPayments);
    const paymentTermComplete = !nextPaymentDate && noOpenAnnualPayments;

    if (coverageReached) return { status: "Matured", isPaidUp: paymentTermComplete, isMatured: true };
    if (paymentTermComplete) return { status: "Paid-Up", isPaidUp: true, isMatured: false };
    return { status: normalizedStatus || "Active", isPaidUp: false, isMatured: false };
  }

  function policyLifecycleNotificationConfig(previousStatus, lifecycle) {
    const nextStatus = String(lifecycle?.status || "");
    const prior = String(previousStatus || "");
    if (prior === nextStatus) return null;
    if (nextStatus === "Paid-Up") {
      return { type: "POLICY_PAID_UP", title: "Policy paid up", dedupeSuffix: "PAID_UP" };
    }
    if (nextStatus === "Matured") {
      if (!["Paid-Up", "Matured"].includes(prior) && lifecycle?.isPaidUp && lifecycle?.isMatured) {
        return { type: "POLICY_PAID_UP_MATURED", title: "Policy paid up and matured", dedupeSuffix: "PAID_UP_MATURED" };
      }
      return { type: "POLICY_MATURED", title: "Policy matured", dedupeSuffix: "MATURED" };
    }
    return null;
  }

  function formatLifecycleDate(date) {
    if (!date) return "—";
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return "—";
    return value.toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }

  function buildPolicyLifecycleMessage(config, policyholderCode, policyholderName, policyName, policyNumber, lifecycle, policyholderDoc, policy) {
    const paidUpDate = policyholderDoc?.lastPaidDate || null;
    const maturedDate = deriveCoverageEndDate(policy);
    let actionMessage = `${config.title}.`;
    if (config.type === "POLICY_PAID_UP") {
      actionMessage = `Policy paid up on ${formatLifecycleDate(paidUpDate)}.`;
    } else if (config.type === "POLICY_MATURED") {
      actionMessage = `Policy matured on ${formatLifecycleDate(maturedDate)}.`;
    } else if (config.type === "POLICY_PAID_UP_MATURED") {
      actionMessage = `Policy paid up on ${formatLifecycleDate(paidUpDate)} and matured on ${formatLifecycleDate(maturedDate)}.`;
    }
    return `${actionMessage} Policyholder Code: ${policyholderCode}. Policyholder Name: ${policyholderName}. Policy Name: ${policyName}. Policy Number: ${policyNumber}.`;
  }

  function cancellationDateForPolicyholder(policyholderDoc = {}) {
    return policyholderDoc?.cancellationDetails?.approvedCancellationDate
      || policyholderDoc?.cancellationDetails?.cancelledAt
      || policyholderDoc?.updatedAt
      || policyholderDoc?.createdAt
      || null;
  }

  async function softDeletePaymentTrackingNotificationsForPolicyholder(policyholderDoc, reason) {
    if (!policyholderDoc?._id || !Notification) return;
    await Notification.updateMany(
      {
        entityType: "Policyholder",
        entityId: policyholderDoc._id,
        type: { $in: PAYMENT_TRACKING_NOTIFICATION_TYPES },
        softDeletedAt: null,
      },
      {
        $set: {
          softDeletedAt: new Date(),
          softDeleteReason: reason || "Policy payment tracking ended.",
          softDeletedByUserId: policyholderDoc.assignedToUserId || null,
        },
      }
    );
  }

  async function createPolicyLifecycleNotification(policyholderDoc, policy, prospect, lifecycle, previousStatus) {
    const config = policyLifecycleNotificationConfig(previousStatus, lifecycle);
    if (!config || !policyholderDoc?._id || !policyholderDoc?.assignedToUserId) return;

    const policyholderName = `${prospect?.firstName || ""}${prospect?.middleName ? ` ${prospect.middleName}` : ""} ${prospect?.lastName || ""}`.trim() || "—";
    const product = policyholderDoc.productId ? await Product.findById(policyholderDoc.productId).select("productName").lean() : null;
    const policyName = product?.productName || "—";
    const policyholderCode = policyholderDoc.policyholderCode || "—";
    const policyNumber = policyholderDoc.policyNumber || policy?.recordCoverageDurationDetails?.policyNumber || "—";
    const message = buildPolicyLifecycleMessage(config, policyholderCode, policyholderName, policyName, policyNumber, lifecycle, policyholderDoc, policy);
    const paidUpDate = policyholderDoc?.lastPaidDate || null;
    const maturedDate = deriveCoverageEndDate(policy);

    await Notification.updateOne(
      {
        assignedToUserId: policyholderDoc.assignedToUserId,
        dedupeKey: `${config.type}:${policyholderDoc._id}`,
      },
      {
        $set: {
          type: config.type,
          title: config.title,
          message,
          entityType: "Policyholder",
          entityId: policyholderDoc._id,
          metadata: {
            policyholderId: String(policyholderDoc._id),
            policyholderCode,
            policyholderName,
            policyName,
            policyNumber,
            previousStatus: String(previousStatus || ""),
            nextStatus: String(lifecycle?.status || ""),
            fullyPaidDate: paidUpDate || null,
            maturedDate: maturedDate || null,
          },
          softDeletedAt: null,
          softDeleteReason: "",
          softDeletedByUserId: null,
        },
        $setOnInsert: {
          assignedToUserId: policyholderDoc.assignedToUserId,
          dedupeKey: `${config.type}:${policyholderDoc._id}`,
          status: "Unread",
          readAt: null,
        },
      },
      { upsert: true }
    );
  }

  async function createPolicyCancellationNotification(policyholderDoc, prospect) {
    if (!policyholderDoc?._id || !policyholderDoc?.assignedToUserId) return;

    const policyholderName = `${prospect?.firstName || ""}${prospect?.middleName ? ` ${prospect.middleName}` : ""} ${prospect?.lastName || ""}`.trim() || "—";
    const product = policyholderDoc.productId ? await Product.findById(policyholderDoc.productId).select("productName").lean() : null;
    const policyName = product?.productName || "—";
    const policyholderCode = policyholderDoc.policyholderCode || "—";
    const policyNumber = policyholderDoc.policyNumber || "—";
    const cancelledDate = cancellationDateForPolicyholder(policyholderDoc);
    const message = `Policy cancelled on ${formatLifecycleDate(cancelledDate)}. Policyholder Code: ${policyholderCode}. Policyholder Name: ${policyholderName}. Policy Name: ${policyName}. Policy Number: ${policyNumber}.`;

    await Notification.updateOne(
      {
        assignedToUserId: policyholderDoc.assignedToUserId,
        dedupeKey: `POLICY_CANCELLED:${policyholderDoc._id}`,
      },
      {
        $set: {
          type: "POLICY_CANCELLED",
          title: "Policy cancelled",
          message,
          entityType: "Policyholder",
          entityId: policyholderDoc._id,
          metadata: {
            policyholderId: String(policyholderDoc._id),
            policyholderCode,
            policyholderName,
            policyName,
            policyNumber,
            nextStatus: "Cancelled",
            cancelledDate: cancelledDate || null,
          },
          softDeletedAt: null,
          softDeleteReason: "",
          softDeletedByUserId: null,
        },
        $setOnInsert: {
          assignedToUserId: policyholderDoc.assignedToUserId,
          dedupeKey: `POLICY_CANCELLED:${policyholderDoc._id}`,
          status: "Unread",
          readAt: null,
        },
      },
      { upsert: true }
    );
  }

  function computeAgeAtDate(birthDate, asOfDate) {
    if (!birthDate || !asOfDate || Number.isNaN(birthDate.getTime()) || Number.isNaN(asOfDate.getTime())) return null;
    let age = asOfDate.getFullYear() - birthDate.getFullYear();
    const hasBirthdayPassed = asOfDate.getMonth() > birthDate.getMonth()
      || (asOfDate.getMonth() === birthDate.getMonth() && asOfDate.getDate() >= birthDate.getDate());
    if (!hasBirthdayPassed) age -= 1;
    return age;
  }

  function derivePaymentTermEndDate(policy = {}, prospect = {}) {
    const coverage = policy?.recordCoverageDurationDetails || {};
    const startDate = coverage.coverageStartDate ? new Date(coverage.coverageStartDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) return null;

    const paymentType = String(coverage.selectedPaymentTermType || "").trim();
    let yearsToAdd = null;
    if (paymentType === "FIXED_YEARS") {
      yearsToAdd = Number(coverage.selectedPaymentTermYears || 0);
    } else if (["UNTIL_AGE", "RANGE_TO_AGE"].includes(paymentType)) {
      const birthDate = prospect?.birthday ? new Date(prospect.birthday) : null;
      const ageAtStart = computeAgeAtDate(birthDate, startDate);
      yearsToAdd = Number(coverage.selectedPaymentTermUntilAge || 0) - Number(ageAtStart || 0);
    }

    if (!Number.isFinite(yearsToAdd) || yearsToAdd <= 0) return null;
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + yearsToAdd);
    endDate.setHours(0, 0, 0, 0);
    return endDate;
  }

  function deriveNextPaymentDateAfterPeriod(paymentPeriod = {}, frequency, paymentTermEndDate) {
    const nextStart = nextDay(paymentPeriod?.endDate);
    const intervalMonths = getPaymentFrequencyIntervalMonths(frequency);
    if (!nextStart || !intervalMonths) return null;
    return isBeforePaymentTermEnd(nextStart, paymentTermEndDate) ? nextStart : null;
  }

  function annualPaymentTotalCountForFrequency(frequency) {
    const countsByFrequency = {
      Monthly: 12,
      Quarterly: 4,
      "Half-yearly": 2,
      Yearly: 1,
    };
    return countsByFrequency[String(frequency || "").trim()] || 0;
  }

  function buildAnnualPaymentMetrics({ totalAnnualPremiumPhp, amountPaidSoFarPhp, paidCount, frequencyOfPayment }) {
    const totalAnnual = Number(totalAnnualPremiumPhp || 0);
    const amountPaid = Number(amountPaidSoFarPhp || 0);
    const normalizedPaid = Number.isFinite(amountPaid) && amountPaid > 0 ? Math.round(amountPaid * 100) / 100 : 0;
    const normalizedTotal = Number.isFinite(totalAnnual) && totalAnnual > 0 ? Math.round(totalAnnual * 100) / 100 : 0;
    const totalCount = annualPaymentTotalCountForFrequency(frequencyOfPayment);
    const normalizedPaidCount = Math.max(0, Number(paidCount || 0));
    const isPaymentCountComplete = totalCount > 0 && normalizedPaidCount >= totalCount;
    const remainingBalancePhp = isPaymentCountComplete ? 0 : Math.max(0, Math.round((normalizedTotal - normalizedPaid) * 100) / 100);
    const status = normalizedPaidCount <= 0 && normalizedPaid <= 0
      ? "Not Started"
      : (isPaymentCountComplete || (normalizedTotal > 0 && normalizedPaid >= normalizedTotal) ? "Completed" : "Ongoing");

    return {
      amountPaidSoFarPhp: normalizedPaid,
      remainingBalancePhp,
      paymentProgress: {
        paidCount: normalizedPaidCount,
        totalCount,
        label: `${normalizedPaidCount}/${totalCount}`,
      },
      status,
    };
  }

  function paymentHasCompletedPremiumTransfer(payment = {}) {
    const transfer = payment?.recordPremiumPaymentTransfer || {};
    return Boolean(
      transfer.savedAt
      || transfer.paymentDate
      || transfer.totalPremiumPaidPhp !== undefined && transfer.totalPremiumPaidPhp !== null
      || String(transfer.methodForPayment || "").trim()
      || String(transfer.proofOfPaymentFileDataUrl || "").trim()
      || String(transfer.proofOfPaymentFileName || "").trim()
    );
  }

  function attemptCycleFilterForCycle(cycle) {
    const normalizedCycle = Number(cycle || 1);
    if (normalizedCycle <= 1) {
      return { $or: [{ attemptCycle: 1 }, { attemptCycle: { $exists: false } }, { attemptCycle: null }] };
    }
    return { attemptCycle: normalizedCycle };
  }

  function normalizeAttemptCycle(value, fallback = 1) {
    const cycle = Number(value || 0);
    if (Number.isInteger(cycle) && cycle >= 1) return cycle;
    const fallbackCycle = Number(fallback || 1);
    return Number.isInteger(fallbackCycle) && fallbackCycle >= 1 ? fallbackCycle : 1;
  }


  function needsAssessmentHasSavedDetails(source = {}) {
    return Boolean(
      source.attendanceConfirmed ||
      source.attendedAt ||
      String(source.attendanceProofImageDataUrl || "").trim() ||
      String(source.attendanceProofFileName || "").trim() ||
      String(source.followUpNeedsAssessmentRequired || "").trim() ||
      source.followUpNeedsAssessmentDecidedAt ||
      String(source?.needsPriorities?.currentPriority || "").trim() ||
      String(source?.needsPriorities?.productSelection?.selectedProductId || "").trim() ||
      (Array.isArray(source.dependents) && source.dependents.length > 0)
    );
  }


  function paymentCoveredCount(payment = {}) {
    if (!paymentHasCompletedPremiumTransfer(payment)) return 0;
    const count = Number(payment?.recordPremiumPaymentTransfer?.paymentCountCovered || 1);
    return Number.isFinite(count) && count > 0 ? Math.max(1, Math.floor(count)) : 1;
  }

  function paymentPremiumPaidAmount(payment = {}) {
    if (!paymentHasCompletedPremiumTransfer(payment)) return 0;
    const transfer = payment?.recordPremiumPaymentTransfer || {};
    const paid = Number(transfer.totalPremiumPaidPhp || 0);
    return Number.isFinite(paid) && paid > 0 ? Math.round(paid * 100) / 100 : 0;
  }

  function paymentDisplayPremiumPaidAmount(payment = {}, annualPayment = {}) {
    const transfer = payment?.recordPremiumPaymentTransfer || {};
    if (transfer.isMissedPaymentRecord === true) {
      const expectedCount = annualPaymentTotalCountForFrequency(annualPayment.frequencyOfPayment);
      const totalAnnualPremium = Number(annualPayment.totalAnnualPremiumPhp || 0);
      const coveredCount = paymentCoveredCount(payment);
      if (expectedCount > 0 && Number.isFinite(totalAnnualPremium) && totalAnnualPremium > 0) {
        return Math.round((totalAnnualPremium / expectedCount) * coveredCount * 100) / 100;
      }
    }
    return paymentPremiumPaidAmount(payment);
  }

  function paymentHasUploadedEor(payment = {}) {
    const eor = payment?.uploadPremiumPaymentEor || {};
    return Boolean(
      eor.uploadedAt
      || eor.receiptDate
      || String(eor.eorNumber || "").trim()
      || String(eor.eorFileName || "").trim()
      || String(eor.eorFileDataUrl || "").trim()
    );
  }

  function isPaymentTransferLate(payment = {}) {
    const transfer = payment?.recordPremiumPaymentTransfer || {};
    const paymentDateKey = dateKeyInTZ(transfer.paymentDate, "Asia/Manila");
    const deadlineDateKey = dateKeyInTZ(transfer.paymentPeriod?.startDate, "Asia/Manila");
    const paymentDay = dayNumberFromDateKey(paymentDateKey);
    const deadlineDay = dayNumberFromDateKey(deadlineDateKey);
    return paymentDay !== null && deadlineDay !== null && paymentDay > deadlineDay;
  }


  function dayNumberFromDateKey(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);
    if (!year || !month || !day) return null;
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  }

  async function syncPolicyholderPaymentDates(policyholderDoc) {
    if (!policyholderDoc?.leadEngagementId) return;
    if (String(policyholderDoc.status || "") === "Cancelled") {
      if (policyholderDoc.nextPaymentDate) {
        policyholderDoc.nextPaymentDate = null;
        await policyholderDoc.save();
      }
      await softDeletePaymentTrackingNotificationsForPolicyholder(policyholderDoc, "Policy was cancelled.");
      return;
    }

    const leadEngagement = await LeadEngagement.findById(policyholderDoc.leadEngagementId).select("leadId").lean();
    const lead = leadEngagement?.leadId ? await Lead.findById(leadEngagement.leadId).select("prospectId").lean() : null;
    const [policy, prospect, annualPayments, payments] = await Promise.all([
      Policy.findOne({ leadEngagementId: policyholderDoc.leadEngagementId })
        .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
        .select("recordCoverageDurationDetails")
        .lean(),
      lead?.prospectId ? Prospect.findById(lead.prospectId).select("firstName middleName lastName birthday").lean() : null,
      AnnualPayment.find({ leadEngagementId: policyholderDoc.leadEngagementId })
        .select("_id annualPaymentPeriod frequencyOfPayment paymentProgress status")
        .sort({ "annualPaymentPeriod.startDate": 1, createdAt: 1 })
        .lean(),
      Payment.find({ leadEngagementId: policyholderDoc.leadEngagementId })
        .select("annualPaymentId status recordPremiumPaymentTransfer")
        .lean(),
    ]);

    const recordedTransferPaymentDates = payments
      .filter(paymentHasCompletedPremiumTransfer)
      .map((payment) => payment?.recordPremiumPaymentTransfer?.paymentDate ? new Date(payment.recordPremiumPaymentTransfer.paymentDate) : null)
      .filter((date) => date && !Number.isNaN(date.getTime()))
      .sort((left, right) => right.getTime() - left.getTime());
    const latestRecordedTransferPaymentDate = recordedTransferPaymentDates[0] || null;

    const paymentTermEndDate = derivePaymentTermEndDate(policy, prospect);
    let nextPaymentDate = null;
    for (const annualPayment of annualPayments) {
      if (String(annualPayment?.status || "") === "Completed") continue;

      const annualPaymentId = String(annualPayment?._id || "");
      const annualPaymentPayments = payments.filter((payment) => String(payment?.annualPaymentId || "") === annualPaymentId);
      const paidPayments = annualPaymentPayments.filter(paymentHasCompletedPremiumTransfer);
      const coveredPaymentCount = paidPayments.reduce((sum, payment) => sum + paymentCoveredCount(payment), 0);
      const expectedCount = annualPaymentTotalCountForFrequency(annualPayment?.frequencyOfPayment);
      if (expectedCount > 0 && coveredPaymentCount >= expectedCount) continue;

      const latestPeriodEndDate = paidPayments
        .map((payment) => payment?.recordPremiumPaymentTransfer?.paymentPeriod?.endDate ? new Date(payment.recordPremiumPaymentTransfer.paymentPeriod.endDate) : null)
        .filter((date) => date && !Number.isNaN(date.getTime()))
        .sort((left, right) => right.getTime() - left.getTime())[0] || null;
      const candidate = latestPeriodEndDate
        ? nextDay(latestPeriodEndDate)
        : (annualPayment?.annualPaymentPeriod?.startDate ? new Date(annualPayment.annualPaymentPeriod.startDate) : null);
      const annualEndDate = annualPayment?.annualPaymentPeriod?.endDate ? new Date(annualPayment.annualPaymentPeriod.endDate) : null;
      if (
        candidate
        && !Number.isNaN(candidate.getTime())
        && (!annualEndDate || Number.isNaN(annualEndDate.getTime()) || candidate <= annualEndDate)
        && isBeforePaymentTermEnd(candidate, paymentTermEndDate)
      ) {
        nextPaymentDate = candidate;
        break;
      }
    }

    const nextLastPaidDate = latestRecordedTransferPaymentDate || policyholderDoc.lastPaidDate || null;
    const currentLastPaidTime = policyholderDoc.lastPaidDate ? new Date(policyholderDoc.lastPaidDate).getTime() : null;
    const nextLastPaidTime = nextLastPaidDate ? new Date(nextLastPaidDate).getTime() : null;
    const currentNextTime = policyholderDoc.nextPaymentDate ? new Date(policyholderDoc.nextPaymentDate).getTime() : null;
    const currentStatus = String(policyholderDoc.status || "");
    let nextStatus = currentStatus;
    if (["Active", "At Risk", "Lapsed"].includes(currentStatus)) {
      const todayDay = dayNumberFromDateKey(dateKeyInTZ(new Date(), "Asia/Manila"));
      const nextPaymentDay = dayNumberFromDateKey(dateKeyInTZ(nextPaymentDate, "Asia/Manila"));
      if (todayDay !== null && nextPaymentDay !== null && nextPaymentDay <= todayDay - 32) {
        nextStatus = "Lapsed";
      } else if (todayDay !== null && nextPaymentDay !== null && nextPaymentDay < todayDay) {
        nextStatus = "At Risk";
      } else {
        nextStatus = "Active";
      }
    }
    const lifecycle = derivePolicyholderLifecycleStatus({
      currentStatus: nextStatus,
      policy,
      nextPaymentDate,
      annualPayments,
    });
    if (TERMINAL_POLICYHOLDER_STATUSES.includes(lifecycle.status)) {
      nextPaymentDate = null;
      nextStatus = lifecycle.status;
    }
    const finalNextPaymentTime = nextPaymentDate ? new Date(nextPaymentDate).getTime() : null;

    if (currentLastPaidTime !== nextLastPaidTime || currentNextTime !== finalNextPaymentTime || currentStatus !== nextStatus) {
      policyholderDoc.lastPaidDate = nextLastPaidDate;
      policyholderDoc.nextPaymentDate = nextPaymentDate;
      if (nextStatus && currentStatus !== nextStatus) policyholderDoc.status = nextStatus;
      await policyholderDoc.save();
      if (["Paid-Up", "Matured"].includes(nextStatus)) {
        if (nextStatus === "Matured") {
          await AnnualPayment.updateMany(
            { leadEngagementId: policyholderDoc.leadEngagementId, status: { $in: ["Not Started", "Ongoing"] } },
            { $set: { status: "No Longer Pursued" } }
          );
        }
        await softDeletePaymentTrackingNotificationsForPolicyholder(policyholderDoc, `Policy became ${nextStatus}.`);
        await createPolicyLifecycleNotification(policyholderDoc, policy, prospect, lifecycle, currentStatus);
      }
    }
  }

  async function syncPolicyholderPaymentDatesForUser(userObjectId) {
    const policyholderDocs = await Policyholder.find({ assignedToUserId: userObjectId })
      .select("assignedToUserId policyholderCode policyNumber productId leadEngagementId lastPaidDate nextPaymentDate status")
      .sort({ policyholderCode: 1 });
    for (const policyholderDoc of policyholderDocs) {
      await syncPolicyholderPaymentDates(policyholderDoc);
    }
  }

  async function ensureScheduledMeetingAttemptCycleBackfill() {
    if (scheduledMeetingAttemptCycleBackfilled) return;

    const engagementIds = await ScheduledMeeting.distinct("leadEngagementId");
    for (const leadEngagementId of engagementIds) {
      const meetings = await ScheduledMeeting.find({ leadEngagementId })
        .sort({ createdAt: 1, startAt: 1, _id: 1 })
        .select("_id createdAt startAt attemptCycle")
        .lean();
      if (!meetings.length) continue;

      const attempts = await ContactAttempt.find({ leadEngagementId })
        .sort({ attemptCycle: 1, attemptedAt: 1, _id: 1 })
        .select("attemptCycle attemptedAt")
        .lean();

      const cycleStartByCycle = new Map();
      attempts.forEach((a) => {
        const cycle = Number(a?.attemptCycle || 1);
        const t = a?.attemptedAt ? new Date(a.attemptedAt).getTime() : NaN;
        if (!Number.isFinite(t)) return;
        if (!cycleStartByCycle.has(cycle) || t < cycleStartByCycle.get(cycle)) {
          cycleStartByCycle.set(cycle, t);
        }
      });

      const sortedCycleStarts = Array.from(cycleStartByCycle.entries()).sort((a, b) => a[0] - b[0]);

      const ops = [];
      meetings.forEach((m) => {
        const basisMsRaw = m?.createdAt || m?.startAt;
        const basisMs = basisMsRaw ? new Date(basisMsRaw).getTime() : NaN;

        let assignedCycle = 1;
        if (Number.isFinite(basisMs) && sortedCycleStarts.length) {
          for (const [cycle, startMs] of sortedCycleStarts) {
            if (basisMs >= startMs) assignedCycle = cycle;
            else break;
          }
        }

        if (Number(m?.attemptCycle || 0) !== assignedCycle) {
          ops.push({
            updateOne: {
              filter: { _id: m._id },
              update: { $set: { attemptCycle: assignedCycle } },
            },
          });
        }
      });

      if (ops.length) {
        await ScheduledMeeting.bulkWrite(ops, { ordered: true });
      }
    }

    scheduledMeetingAttemptCycleBackfilled = true;
  }

  let contactAttemptCycleBackfilled = false;
  async function ensureContactAttemptCycleBackfill() {
    if (contactAttemptCycleBackfilled) return;

    const engagementIds = await ContactAttempt.distinct("leadEngagementId");
    for (const leadEngagementId of engagementIds) {
      const attempts = await ContactAttempt.find({ leadEngagementId })
        .sort({ attemptedAt: 1, createdAt: 1, attemptNo: 1, _id: 1 })
        .select("_id attemptNo attemptCycle")
        .lean();

      if (!attempts.length) continue;

      let cycle = 1;
      let prevAttemptNo = 0;
      const plans = [];

      attempts.forEach((attempt, idx) => {
        const attemptNo = Number(attempt?.attemptNo || 0);
        if (idx > 0) {
          const resetByNo = attemptNo === 1 && prevAttemptNo >= 1;
          const nonMonotonic = attemptNo > 0 && prevAttemptNo > 0 && attemptNo <= prevAttemptNo;
          if (resetByNo || nonMonotonic) cycle += 1;
        }

        const currentCycle = Number(attempt?.attemptCycle || 0);
        if (currentCycle !== cycle) {
          plans.push({ _id: attempt._id, finalCycle: cycle });
        }

        prevAttemptNo = attemptNo;
      });

      if (plans.length) {
        // Two-phase update to avoid temporary unique collisions on
        // { leadEngagementId, attemptCycle, attemptNo } while remapping cycles.
        const phaseOneOps = plans.map((plan) => ({
          updateOne: {
            filter: { _id: plan._id },
            update: { $set: { attemptCycle: -1000000 - Number(plan.finalCycle || 0) } },
          },
        }));
        await ContactAttempt.bulkWrite(phaseOneOps, { ordered: true });

        const phaseTwoOps = plans.map((plan) => ({
          updateOne: {
            filter: { _id: plan._id },
            update: { $set: { attemptCycle: Number(plan.finalCycle || 1) } },
          },
        }));
        await ContactAttempt.bulkWrite(phaseTwoOps, { ordered: true });
      }

      // Keep engagement pointer aligned with reconstructed cycles.
      const maxCycle = Math.max(...attempts.map((a, i) => {
        // recompute from same rules to avoid stale read after phase writes
        let c = 1;
        let prev = 0;
        for (let j = 0; j <= i; j += 1) {
          const n = Number(attempts[j]?.attemptNo || 0);
          if (j > 0) {
            const resetByNo = n === 1 && prev >= 1;
            const nonMonotonic = n > 0 && prev > 0 && n <= prev;
            if (resetByNo || nonMonotonic) c += 1;
          }
          prev = n;
        }
        return c;
      }));
      await LeadEngagement.updateOne(
        { _id: leadEngagementId, contactAttemptCycle: { $lt: maxCycle } },
        { $set: { contactAttemptCycle: maxCycle } }
      );
    }

    const cyclePointers = await ContactAttempt.aggregate([
      {
        $group: {
          _id: "$leadEngagementId",
          maxCycle: { $max: "$attemptCycle" },
        },
      },
    ]);

    for (const row of cyclePointers) {
      const maxCycle = Math.max(1, Number(row?.maxCycle || 1));
      await LeadEngagement.updateOne(
        { _id: row._id, contactAttemptCycle: { $lt: maxCycle } },
        { $set: { contactAttemptCycle: maxCycle } }
      );
    }

    await LeadEngagement.updateMany(
      {
        $or: [
          { contactAttemptCycle: { $exists: false } },
          { contactAttemptCycle: null },
          { contactAttemptCycle: { $lt: 1 } },
        ],
      },
      { $set: { contactAttemptCycle: 1 } }
    );

    contactAttemptCycleBackfilled = true;
  }

  let scheduledMeetingHistoryIndexEnsured = false;
  async function ensureScheduledMeetingHistoryIndex() {
    if (scheduledMeetingHistoryIndexEnsured) return;
    try {
      const collection = ScheduledMeeting.collection;
      const uniqueIdxName = "leadEngagementId_1_meetingType_1";
      const hasLegacyUniqueIndex = await collection.indexExists(uniqueIdxName);
      if (hasLegacyUniqueIndex) {
        await collection.dropIndex(uniqueIdxName);
      }
      scheduledMeetingHistoryIndexEnsured = true;
    } catch (err) {
      if (err?.codeName !== "IndexNotFound") throw err;
      scheduledMeetingHistoryIndexEnsured = true;
    }
  }

/* =========================================================
   ADMIN: ORGANIZATION MANAGEMENT
========================================================= */
async function buildAdminOrganizationTree(overviewSearch = "") {
  const areas = await Area.find().sort({ areaName: 1 }).lean();
  const areaIds = areas.map((area) => area._id);

  const branches = areaIds.length
    ? await Branch.find({ areaId: { $in: areaIds } }).sort({ branchName: 1 }).lean()
    : [];
  const branchIds = branches.map((branch) => branch._id);

  const units = branchIds.length
    ? await Unit.find({ branchId: { $in: branchIds } }).sort({ unitName: 1 }).lean()
    : [];
  const unitIds = units.map((unit) => unit._id);
  const [branchManagers, unitManagers, assistantUnitManagers] = await Promise.all([
    BM.find({ isBlocked: { $ne: true } }).populate(buildManagerPopulateQuery("BM")).lean(),
    UM.find({ isBlocked: { $ne: true } }).populate(buildManagerPopulateQuery("UM")).lean(),
    AUM.find({ isBlocked: { $ne: true } }).populate(buildManagerPopulateQuery("AUM")).lean(),
  ]);

  const agents = unitIds.length
    ? await Agent.find({ unitId: { $in: unitIds } })
        .populate({ path: "userId", select: "username firstName lastName" })
        .lean()
    : [];

  const formatManagerLabel = (user) => {
    const account = user || {};
    const fullName = [account.firstName, account.lastName].filter(Boolean).join(" ").trim();
    return fullName || account.username || "Unassigned";
  };

  const bmByBranchId = new Map();
  const umByUnitId = new Map();
  const aumByUnitId = new Map();

  for (const manager of branchManagers) {
    const profile = getManagerProfile(manager);
    const branchId = profile.branch?._id ? String(profile.branch._id) : "";
    if (!branchId || !branchIds.some((id) => String(id) === branchId)) continue;
    bmByBranchId.set(branchId, {
      label: formatManagerLabel(profile.user),
      createdAt: manager.createdAt || null,
      updatedAt: manager.updatedAt || null,
    });
  }

  for (const manager of unitManagers) {
    const profile = getManagerProfile(manager);
    const unitId = profile.unit?._id ? String(profile.unit._id) : "";
    if (!unitId || !unitIds.some((id) => String(id) === unitId)) continue;
    umByUnitId.set(unitId, {
      label: formatManagerLabel(profile.user),
      createdAt: manager.createdAt || null,
      updatedAt: manager.updatedAt || null,
    });
  }

  for (const manager of assistantUnitManagers) {
    const profile = getManagerProfile(manager);
    const unitId = profile.unit?._id ? String(profile.unit._id) : "";
    if (!unitId || !unitIds.some((id) => String(id) === unitId)) continue;
    aumByUnitId.set(unitId, {
      label: formatManagerLabel(profile.user),
      createdAt: manager.createdAt || null,
      updatedAt: manager.updatedAt || null,
    });
  }

  const agentsByUnitId = new Map();
  for (const agent of agents) {
    const unitKey = String(agent.unitId);
    if (!agentsByUnitId.has(unitKey)) agentsByUnitId.set(unitKey, []);

    const user = agent.userId || {};
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const fallbackLabel = user.username || "Unassigned Agent";

    agentsByUnitId.get(unitKey).push({
      id: agent._id,
      username: user.username || "",
      name: fullName || fallbackLabel,
      label: user.username ? `${user.username} · ${fullName || user.username}` : fallbackLabel,
      createdAt: agent.createdAt || null,
      updatedAt: agent.updatedAt || null,
    });
  }

  const unitsByBranchId = new Map();
  for (const unit of units) {
    const branchKey = String(unit.branchId);
    if (!unitsByBranchId.has(branchKey)) unitsByBranchId.set(branchKey, []);

    const umRecord = umByUnitId.get(String(unit._id)) || null;
    const aumRecord = aumByUnitId.get(String(unit._id)) || null;

    unitsByBranchId.get(branchKey).push({
      id: unit._id,
      unitName: unit.unitName,
      createdAt: unit.createdAt || null,
      updatedAt: unit.updatedAt || null,
      um: umRecord?.label || "Unassigned",
      umCreatedAt: umRecord?.createdAt || null,
      umUpdatedAt: umRecord?.updatedAt || null,
      aum: aumRecord?.label || "Unassigned",
      aumCreatedAt: aumRecord?.createdAt || null,
      aumUpdatedAt: aumRecord?.updatedAt || null,
      agents: agentsByUnitId.get(String(unit._id)) || [],
    });
  }

  const branchesByAreaId = new Map();
  for (const branch of branches) {
    const areaKey = String(branch.areaId);
    if (!branchesByAreaId.has(areaKey)) branchesByAreaId.set(areaKey, []);

    const bmRecord = bmByBranchId.get(String(branch._id)) || null;

    branchesByAreaId.get(areaKey).push({
      id: branch._id,
      branchName: branch.branchName,
      createdAt: branch.createdAt || null,
      updatedAt: branch.updatedAt || null,
      bm: bmRecord?.label || "Unassigned",
      bmCreatedAt: bmRecord?.createdAt || null,
      bmUpdatedAt: bmRecord?.updatedAt || null,
      units: unitsByBranchId.get(String(branch._id)) || [],
    });
  }

  return areas
    .map((area) => ({
      id: area._id,
      areaName: area.areaName,
      createdAt: area.createdAt || null,
      updatedAt: area.updatedAt || null,
      branches: branchesByAreaId.get(String(area._id)) || [],
    }))
    .map((area) => {
      if (!overviewSearch.trim()) return area;

      const areaMatches = matchesSearchTerms([area.areaName], overviewSearch);
      if (areaMatches) return area;

      const filteredBranches = area.branches
        .map((branch) => {
          const branchMatches = matchesSearchTerms([branch.branchName, area.areaName], overviewSearch);
          if (branchMatches) return branch;

          const filteredUnits = branch.units.filter((unit) =>
            matchesSearchTerms([unit.unitName, branch.branchName, area.areaName], overviewSearch)
          );

          if (filteredUnits.length === 0) return null;
          return { ...branch, units: filteredUnits };
        })
        .filter(Boolean);

      if (filteredBranches.length === 0) return null;
      return { ...area, branches: filteredBranches };
    })
    .filter(Boolean);
}

app.get("/api/admin/organization/tree", async (req, res) => {
  try {
    const areas = await buildAdminOrganizationTree(req.query.overviewSearch);
    return res.json({ areas });
  } catch (err) {
    console.error("Admin organization tree error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.get("/api/admin/organization/form-options", async (req, res) => {
  try {
    const payload = await buildAdminOrganizationListPayload();

    return res.json(payload);
  } catch (err) {
    console.error("Admin organization form options error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.get("/api/admin/organization/list-data", async (req, res) => {
  try {
    const payload = await buildAdminOrganizationListPayload({
      areaSearch: req.query.areaSearch,
      branchSearch: req.query.branchSearch,
      unitSearch: req.query.unitSearch,
      managerSearch: req.query.managerSearch,
      managerType: req.query.managerType,
      agentSearch: req.query.agentSearch,
    });

    return res.json(payload);
  } catch (err) {
    console.error("Admin organization list data error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.post("/api/admin/organization/areas", async (req, res) => {
  try {
    const areaName = String(req.body?.areaName || "").trim();

    if (!areaName) {
      return res.status(400).json({ message: "Area name is required." });
    }

    const existingArea = await Area.findOne({
      areaName: { $regex: new RegExp(`^${escapeRegex(areaName)}$`, "i") },
    }).lean();

    if (existingArea) {
      return res.status(409).json({ message: "Area name already exists." });
    }

    const area = await Area.create({ areaName });
    return res.status(201).json({ message: "Area created successfully.", area });
  } catch (err) {
    console.error("Admin create area error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.patch("/api/admin/organization/areas/:areaId", async (req, res) => {
  try {
    const { areaId } = req.params;
    const areaName = String(req.body?.areaName || "").trim();

    if (!mongoose.Types.ObjectId.isValid(areaId)) {
      return res.status(400).json({ message: "Invalid area id." });
    }

    if (!areaName) {
      return res.status(400).json({ message: "Area name is required." });
    }

    const existingArea = await Area.findOne({
      _id: { $ne: areaId },
      areaName: { $regex: new RegExp(`^${escapeRegex(areaName)}$`, "i") },
    }).lean();

    if (existingArea) {
      return res.status(409).json({ message: "Area name already exists." });
    }

    const updatedArea = await Area.findByIdAndUpdate(
      areaId,
      { areaName },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedArea) {
      return res.status(404).json({ message: "Area not found." });
    }

    return res.json({ message: "Area updated successfully.", area: updatedArea });
  } catch (err) {
    console.error("Admin update area error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.post("/api/admin/organization/branches", async (req, res) => {
  try {
    const branchName = String(req.body?.branchName || "").trim();
    const areaId = String(req.body?.areaId || "").trim();

    if (!branchName) {
      return res.status(400).json({ message: "Branch name is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(areaId)) {
      return res.status(400).json({ message: "Valid area id is required." });
    }

    const existingBranch = await Branch.findOne({
      areaId,
      branchName: { $regex: new RegExp(`^${escapeRegex(branchName)}$`, "i") },
    }).lean();

    if (existingBranch) {
      return res.status(409).json({ message: "Branch name already exists in the selected area." });
    }

    const branch = await Branch.create({ branchName, areaId });
    return res.status(201).json({ message: "Branch created successfully.", branch });
  } catch (err) {
    console.error("Admin create branch error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.patch("/api/admin/organization/branches/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;
    const branchName = String(req.body?.branchName || "").trim();
    const areaId = String(req.body?.areaId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Invalid branch id." });
    }

    if (!branchName) {
      return res.status(400).json({ message: "Branch name is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(areaId)) {
      return res.status(400).json({ message: "Valid area id is required." });
    }

    const existingBranch = await Branch.findOne({
      _id: { $ne: branchId },
      areaId,
      branchName: { $regex: new RegExp(`^${escapeRegex(branchName)}$`, "i") },
    }).lean();

    if (existingBranch) {
      return res.status(409).json({ message: "Branch name already exists in the selected area." });
    }

    const branch = await Branch.findByIdAndUpdate(
      branchId,
      { branchName, areaId },
      { new: true, runValidators: true }
    ).lean();

    if (!branch) {
      return res.status(404).json({ message: "Branch not found." });
    }

    return res.json({ message: "Branch updated successfully.", branch });
  } catch (err) {
    console.error("Admin update branch error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.post("/api/admin/organization/units", async (req, res) => {
  try {
    const unitName = String(req.body?.unitName || "").trim();
    const branchId = String(req.body?.branchId || "").trim();

    if (!unitName) {
      return res.status(400).json({ message: "Unit name is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Valid branch id is required." });
    }

    const existingUnit = await Unit.findOne({
      branchId,
      unitName: { $regex: new RegExp(`^${escapeRegex(unitName)}$`, "i") },
    }).lean();

    if (existingUnit) {
      return res.status(409).json({ message: "Unit name already exists in the selected branch." });
    }

    const unit = await Unit.create({ unitName, branchId });
    return res.status(201).json({ message: "Unit created successfully.", unit });
  } catch (err) {
    console.error("Admin create unit error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.patch("/api/admin/organization/units/:unitId", async (req, res) => {
  try {
    const { unitId } = req.params;
    const unitName = String(req.body?.unitName || "").trim();
    const branchId = String(req.body?.branchId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(unitId)) {
      return res.status(400).json({ message: "Invalid unit id." });
    }

    if (!unitName) {
      return res.status(400).json({ message: "Unit name is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Valid branch id is required." });
    }

    const existingUnit = await Unit.findOne({
      _id: { $ne: unitId },
      branchId,
      unitName: { $regex: new RegExp(`^${escapeRegex(unitName)}$`, "i") },
    }).lean();

    if (existingUnit) {
      return res.status(409).json({ message: "Unit name already exists in the selected branch." });
    }

    const unit = await Unit.findByIdAndUpdate(
      unitId,
      { unitName, branchId },
      { new: true, runValidators: true }
    ).lean();

    if (!unit) {
      return res.status(404).json({ message: "Unit not found." });
    }

    return res.json({ message: "Unit updated successfully.", unit });
  } catch (err) {
    console.error("Admin update unit error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.post("/api/admin/organization/agents", async (req, res) => {
  try {
    const firstName = String(req.body?.firstName || "").trim();
    const middleName = String(req.body?.middleName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    const birthday = String(req.body?.birthday || "").trim();
    const sex = String(req.body?.sex || "").trim();
    const dateEmployed = String(req.body?.dateEmployed || "").trim();
    const displayPhoto = String(req.body?.displayPhoto || "").trim();
    const agentType = String(req.body?.agentType || "").trim();
    const unitId = String(req.body?.unitId || "").trim();

    if (!firstName) {
      return res.status(400).json({ message: "First name is required." });
    }

    if (!lastName) {
      return res.status(400).json({ message: "Last name is required." });
    }

    if (!birthday) {
      return res.status(400).json({ message: "Birthday is required." });
    }

    if (!dateEmployed) {
      return res.status(400).json({ message: "Date employed is required." });
    }

    if (!["Male", "Female"].includes(sex)) {
      return res.status(400).json({ message: "A valid sex is required." });
    }

    if (!["Full-Time", "Part-Time"].includes(agentType)) {
      return res.status(400).json({ message: "A valid agent type is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(unitId)) {
      return res.status(400).json({ message: "A valid assigned unit is required." });
    }

    const [unit, agentUsernames] = await Promise.all([
      Unit.findById(unitId).lean(),
      User.find({ username: { $regex: /^AG\d{6}$/i } }, { username: 1 }).lean(),
    ]);

    if (!unit) {
      return res.status(404).json({ message: "Selected unit was not found." });
    }

    const birthdayDate = new Date(birthday);
    const employedDate = new Date(dateEmployed);

    if (Number.isNaN(birthdayDate.getTime())) {
      return res.status(400).json({ message: "Birthday is invalid." });
    }

    if (Number.isNaN(employedDate.getTime())) {
      return res.status(400).json({ message: "Date employed is invalid." });
    }

    if (isFutureDate(birthdayDate)) {
      return res.status(400).json({ message: "Birthday cannot be in the future." });
    }

    if (isFutureDate(employedDate)) {
      return res.status(400).json({ message: "Date employed cannot be in the future." });
    }

    const age = calculateAgeFromDate(birthdayDate);
    if (age === null) {
      return res.status(400).json({ message: "Birthday is invalid." });
    }

    if (age < 21) {
      return res.status(400).json({ message: "Agents must be at least 21 years old." });
    }

    const nextSequence = getNextRoleSequence(agentUsernames.map((user) => user.username), "AG");
    const username = `AG${padSixDigitSequence(nextSequence)}`;
    const password = buildGeneratedPassword("AG", birthdayDate, nextSequence);

    const user = await User.create({
      role: "AG",
      username,
      password,
      firstName,
      middleName,
      lastName,
      birthday: birthdayDate,
      sex,
      age,
      displayPhoto,
      dateEmployed: employedDate,
    });

    try {
      const agent = await Agent.create({
        userId: user._id,
        agentType,
        unitId,
      });

      return res.status(201).json({
        message: "Agent created successfully.",
        agentId: agent._id,
        userId: user._id,
        username,
        password,
      });
    } catch (agentError) {
      await User.findByIdAndDelete(user._id);
      throw agentError;
    }
  } catch (err) {
    console.error("Admin create agent error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.patch("/api/admin/organization/agents/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const username = String(req.body?.username || "").trim().toUpperCase();
    const password = String(req.body?.password || "").trim();
    const firstName = String(req.body?.firstName || "").trim();
    const middleName = String(req.body?.middleName || "").trim();
    const lastName = String(req.body?.lastName || "").trim();
    const birthday = String(req.body?.birthday || "").trim();
    const sex = String(req.body?.sex || "").trim();
    const dateEmployed = String(req.body?.dateEmployed || "").trim();
    const displayPhoto = String(req.body?.displayPhoto || "").trim();
    const agentType = String(req.body?.agentType || "").trim();
    const unitId = String(req.body?.unitId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ message: "Invalid agent id." });
    }

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    if (!firstName) {
      return res.status(400).json({ message: "First name is required." });
    }

    if (!lastName) {
      return res.status(400).json({ message: "Last name is required." });
    }

    if (!birthday) {
      return res.status(400).json({ message: "Birthday is required." });
    }

    if (!dateEmployed) {
      return res.status(400).json({ message: "Date employed is required." });
    }

    if (!["Male", "Female"].includes(sex)) {
      return res.status(400).json({ message: "A valid sex is required." });
    }

    if (!["Full-Time", "Part-Time"].includes(agentType)) {
      return res.status(400).json({ message: "A valid agent type is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(unitId)) {
      return res.status(400).json({ message: "A valid assigned unit is required." });
    }

    const [agent, unit] = await Promise.all([
      Agent.findById(agentId).lean(),
      Unit.findById(unitId).lean(),
    ]);

    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    if (!unit) {
      return res.status(404).json({ message: "Selected unit was not found." });
    }

    const existingUser = await User.findOne({ _id: { $ne: agent.userId }, username }).lean();
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const birthdayDate = new Date(birthday);
    const employedDate = new Date(dateEmployed);

    if (Number.isNaN(birthdayDate.getTime())) {
      return res.status(400).json({ message: "Birthday is invalid." });
    }

    if (Number.isNaN(employedDate.getTime())) {
      return res.status(400).json({ message: "Date employed is invalid." });
    }

    if (isFutureDate(birthdayDate)) {
      return res.status(400).json({ message: "Birthday cannot be in the future." });
    }

    if (isFutureDate(employedDate)) {
      return res.status(400).json({ message: "Date employed cannot be in the future." });
    }

    const age = calculateAgeFromDate(birthdayDate);
    if (age === null) {
      return res.status(400).json({ message: "Birthday is invalid." });
    }

    if (age < 21) {
      return res.status(400).json({ message: "Agents must be at least 21 years old." });
    }

    await Promise.all([
      User.findByIdAndUpdate(
        agent.userId,
        {
          username,
          ...(password ? { password } : {}),
          firstName,
          middleName,
          lastName,
          birthday: birthdayDate,
          sex,
          age,
          displayPhoto,
          dateEmployed: employedDate,
        },
        { new: true, runValidators: true }
      ),
      Agent.findByIdAndUpdate(
        agentId,
        {
          agentType,
          unitId,
        },
        { new: true, runValidators: true }
      ),
    ]);

    return res.json({ message: "Agent updated successfully." });
  } catch (err) {
    console.error("Admin update agent error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.post("/api/admin/organization/managers/assign", async (req, res) => {
  try {
    const managerType = String(req.body?.managerType || "").trim().toUpperCase();
    const branchId = String(req.body?.branchId || "").trim();
    const unitId = String(req.body?.unitId || "").trim();
    const sourceAgentId = String(req.body?.sourceAgentId || "").trim();
    const dateEmployed = String(req.body?.dateEmployed || "").trim();

    const ManagerModel = getManagerModelByType(managerType);

    if (!ManagerModel) {
      return res.status(400).json({ message: "Invalid manager type." });
    }

    if (!mongoose.Types.ObjectId.isValid(sourceAgentId)) {
      return res.status(400).json({ message: "A valid source agent is required." });
    }

    if (managerType === "BM" && !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "A valid branch is required for BM assignment." });
    }

    if ((managerType === "UM" || managerType === "AUM") && !mongoose.Types.ObjectId.isValid(unitId)) {
      return res.status(400).json({ message: "A valid unit is required for unit manager assignment." });
    }

    if (!dateEmployed) {
      return res.status(400).json({ message: "Date employed is required for manager assignment." });
    }

    const sourceAgent = await Agent.findById(sourceAgentId)
      .populate({
        path: "userId",
        select: "role username password firstName middleName lastName birthday sex age displayPhoto dateEmployed",
      })
      .populate({
        path: "unitId",
        select: "unitName branchId",
        populate: {
          path: "branchId",
          select: "branchName areaId",
          populate: { path: "areaId", select: "areaName" },
        },
      })
      .exec();

    if (!sourceAgent) {
      return res.status(404).json({ message: "Selected agent was not found." });
    }

    if (!sourceAgent.userId) {
      return res.status(400).json({ message: "Selected agent is missing its linked user account." });
    }

    if (sourceAgent.userId.role !== "AG") {
      return res.status(409).json({ message: "Only active agent accounts can be promoted through this form." });
    }

    if (managerType === "BM") {
      if (String(sourceAgent.unitId?.branchId?._id || "") !== branchId) {
        return res.status(400).json({ message: "Selected agent does not belong to the chosen branch." });
      }
    } else if (String(sourceAgent.unitId?._id || "") !== unitId) {
      return res.status(400).json({ message: "Selected agent does not belong to the chosen unit." });
    }

    const employedDate = new Date(dateEmployed);
    if (Number.isNaN(employedDate.getTime())) {
      return res.status(400).json({ message: "Date employed is invalid." });
    }

    if (isFutureDate(employedDate)) {
      return res.status(400).json({ message: "Date employed cannot be in the future." });
    }

    const agentEmploymentDate = sourceAgent.userId.dateEmployed ? new Date(sourceAgent.userId.dateEmployed) : null;
    if (!agentEmploymentDate || Number.isNaN(agentEmploymentDate.getTime())) {
      return res.status(400).json({ message: "Selected agent is missing a valid agent employment date." });
    }

    if (employedDate.getTime() <= agentEmploymentDate.getTime()) {
      return res.status(400).json({ message: "Manager date employed must be after the selected agent date employed." });
    }

    const usernameCandidates = await ManagerModel.find()
      .populate({ path: "userId", select: "username" })
      .lean();

    const nextSequence = getNextRoleSequence(
      usernameCandidates.map((manager) => manager.userId?.username || ""),
      managerType
    );
    const generatedUsername = buildGeneratedUsername(managerType, nextSequence);
    const generatedPassword = buildGeneratedPassword(managerType, sourceAgent.userId.birthday, nextSequence);

    if (!generatedPassword) {
      return res.status(400).json({ message: "Selected agent is missing a valid birthday for manager credential generation." });
    }

    const scopeUpdate =
      managerType === "BM"
        ? { branchId, unitId: undefined }
        : { unitId, branchId: undefined };

    const activeManager = await findActiveManagerForScope(managerType, { branchId, unitId });

    if (activeManager && String(activeManager.agentId?._id || activeManager.agentId || "") === sourceAgentId) {
      return res.status(409).json({ message: `This agent is already the active ${managerType}.` });
    }

    const existingManagerRecord = await ManagerModel.findOne({ agentId: sourceAgentId }).lean();

    if (existingManagerRecord && existingManagerRecord.isBlocked !== true) {
      return res.status(409).json({ message: `This agent already has an active ${managerType} manager record.` });
    }

    const promotionDate = new Date();
    let blockedManager = null;

    if (activeManager) {
      blockedManager = await ManagerModel.findByIdAndUpdate(
        activeManager._id,
        { isBlocked: true, blockedAt: promotionDate },
        { new: true }
      )
        .populate(buildManagerPopulateQuery(managerType))
        .lean();
    }

    const managerUser = await User.create({
      role: managerType,
      username: generatedUsername,
      password: generatedPassword,
      firstName: sourceAgent.userId.firstName,
      middleName: sourceAgent.userId.middleName || "",
      lastName: sourceAgent.userId.lastName,
      birthday: sourceAgent.userId.birthday,
      sex: sourceAgent.userId.sex,
      age: sourceAgent.userId.age,
      displayPhoto: sourceAgent.userId.displayPhoto || "",
      dateEmployed: employedDate,
    });

    const nextManagerRecord = existingManagerRecord
      ? await ManagerModel.findByIdAndUpdate(
          existingManagerRecord._id,
          { agentId: sourceAgentId, userId: managerUser._id, ...scopeUpdate, isBlocked: false, blockedAt: null },
          { new: true, runValidators: true }
        )
      : await ManagerModel.create({ agentId: sourceAgentId, userId: managerUser._id, ...scopeUpdate, isBlocked: false, blockedAt: null }).then((doc) =>
          doc.toObject()
        );

    if (existingManagerRecord?.userId && String(existingManagerRecord.userId) !== String(managerUser._id)) {
      await User.findByIdAndDelete(existingManagerRecord.userId);
    }

    const agentToPromote = await Agent.findById(sourceAgentId);
    if (!agentToPromote) {
      throw new Error("Agent to promote was not found during manager assignment.");
    }

    agentToPromote.isPromoted = true;
    agentToPromote.promotedToRole = managerType;
    agentToPromote.datePromoted = promotionDate;
    agentToPromote.promotionHistory.push({
      role: managerType,
      datePromoted: promotionDate,
      previousRole: sourceAgent.userId.role || "AG",
      managerUsername: generatedUsername,
      previousUsername: sourceAgent.userId.username || "",
      previousDateEmployed: agentEmploymentDate,
      managerDateEmployed: employedDate,
      managerUserId: managerUser._id,
      branchId: managerType === "BM" ? branchId : sourceAgent.unitId?.branchId?._id || branchId || null,
      unitId: managerType === "BM" ? null : unitId,
    });
    await agentToPromote.save();

    const nextManager = await ManagerModel.findById(nextManagerRecord._id).populate(buildManagerPopulateQuery(managerType)).lean();

    return res.status(201).json({
      message: `${managerType} assignment updated successfully.`,
      manager: formatManagerRecord(nextManager, managerType),
      blockedManager: blockedManager ? formatManagerRecord(blockedManager, managerType) : null,
    });
  } catch (err) {
    console.error("Admin assign manager error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.delete("/api/admin/organization/areas/:areaId", async (req, res) => {
  try {
    const { areaId } = req.params;
    const confirmCascade = req.body?.confirmCascade === true;

    if (!mongoose.Types.ObjectId.isValid(areaId)) {
      return res.status(400).json({ message: "Invalid area id." });
    }

    if (!confirmCascade) {
      return res.status(400).json({
        message:
          "Cascade delete confirmation is required. This action removes branches, units, agents, and linked user accounts under the selected area.",
      });
    }

    const area = await Area.findById(areaId).lean();
    if (!area) {
      return res.status(404).json({ message: "Area not found." });
    }

    const branches = await Branch.find({ areaId }, { _id: 1 }).lean();
    const branchIds = branches.map((branch) => branch._id);
    const units = branchIds.length ? await Unit.find({ branchId: { $in: branchIds } }, { _id: 1 }).lean() : [];
    const unitIds = units.map((unit) => unit._id);
    const [branchManagers, unitManagers, assistantUnitManagers, agents] = await Promise.all([
      BM.find()
        .populate({ path: "agentId", select: "unitId", populate: { path: "unitId", select: "branchId" } })
        .populate({ path: "userId", select: "_id" })
        .lean(),
      UM.find()
        .populate({ path: "agentId", select: "unitId", populate: { path: "unitId", select: "branchId" } })
        .populate({ path: "userId", select: "_id" })
        .lean(),
      AUM.find()
        .populate({ path: "agentId", select: "unitId", populate: { path: "unitId", select: "branchId" } })
        .populate({ path: "userId", select: "_id" })
        .lean(),
      unitIds.length ? Agent.find({ unitId: { $in: unitIds } }, { _id: 1, userId: 1 }).lean() : [],
    ]);
    const filteredBranchManagers = branchManagers.filter((manager) => {
      const branchId = manager.agentId?.unitId?.branchId;
      return branchId && branchIds.some((id) => String(id) === String(branchId));
    });
    const filteredUnitManagers = unitManagers.filter((manager) => {
      const currentUnitId = manager.agentId?.unitId?._id || manager.agentId?.unitId;
      return currentUnitId && unitIds.some((id) => String(id) === String(currentUnitId));
    });
    const filteredAssistantUnitManagers = assistantUnitManagers.filter((manager) => {
      const currentUnitId = manager.agentId?.unitId?._id || manager.agentId?.unitId;
      return currentUnitId && unitIds.some((id) => String(id) === String(currentUnitId));
    });
    const agentIds = agents.map((agent) => agent._id);
    const bmIds = filteredBranchManagers.map((manager) => manager._id);
    const umIds = filteredUnitManagers.map((manager) => manager._id);
    const aumIds = filteredAssistantUnitManagers.map((manager) => manager._id);
    const userIds = [
      ...agents.map((agent) => agent.userId),
      ...filteredBranchManagers.map((manager) => manager.userId?._id || manager.userId),
      ...filteredUnitManagers.map((manager) => manager.userId?._id || manager.userId),
      ...filteredAssistantUnitManagers.map((manager) => manager.userId?._id || manager.userId),
    ].filter(Boolean);

    if (bmIds.length) {
      await BM.deleteMany({ _id: { $in: bmIds } });
    }

    if (umIds.length) {
      await UM.deleteMany({ _id: { $in: umIds } });
    }

    if (aumIds.length) {
      await AUM.deleteMany({ _id: { $in: aumIds } });
    }

    if (agentIds.length) {
      await Agent.deleteMany({ _id: { $in: agentIds } });
    }

    if (userIds.length) {
      await User.deleteMany({ _id: { $in: userIds } });
    }

    if (unitIds.length) {
      await Unit.deleteMany({ _id: { $in: unitIds } });
    }

    if (branchIds.length) {
      await Branch.deleteMany({ _id: { $in: branchIds } });
    }

    await Area.deleteOne({ _id: areaId });

    return res.json({
      message: "Area deleted successfully.",
      deleted: {
        areaName: area.areaName,
        branches: branchIds.length,
        units: unitIds.length,
        branchManagers: bmIds.length,
        unitManagers: umIds.length,
        assistantUnitManagers: aumIds.length,
        agents: agentIds.length,
        users: userIds.length,
      },
    });
  } catch (err) {
    console.error("Admin delete area error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * escapeRegex(text)
 * -----------------
 * Escapes special regex characters in user input so the string can be safely
 * used inside a RegExp without changing its meaning.
 *
 * Example:
 *   "a+b" → "a\+b"
 *
 * Why this exists:
 * - Prevents regex injection / unintended regex behavior when users search.
 * - Ensures user input is treated as literal text.
 */
/**
 * escapeRegex(text)
 * -----------------
 * Escapes user-supplied text before embedding it in a RegExp constructor.
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ===========================
   Helpers
=========================== */
/**
 * buildProspectSearchMatch(qRaw)
 * ------------------------------
 * Builds a MongoDB query object (match) for searching prospects by:
 * - prospectCode
 * - firstName
 * - lastName
 * - combined "full name" matching (first/last in any order)
 *
 * Input:
 * - qRaw: raw search query from request (string-ish)
 *
 * Output:
 * - null if query is empty
 * - { $or: [...] } match object if query exists
 *
 * Security:
 * - Escapes user input before constructing regex patterns.
 */
/**
 * buildProspectSearchMatch(qRaw)
 * -----------------------------
 * Builds the MongoDB $or search filter used by prospect listing endpoints.
 */
function buildProspectSearchMatch(qRaw) {
  const q = String(qRaw || "").trim();
  if (!q) return null;

  // Escape user input to avoid regex injection and unintended pattern behavior
  const safeQ = escapeRegex(q);

  // Split multi-word queries:
  // "jake louis" → ["jake", "louis"]
  const parts = safeQ.split(/\s+/).filter(Boolean);

  // Case-insensitive regex for full raw query
  const rxFull = new RegExp(safeQ, "i");

  // Basic match options: code, first, last
  const or = [
    { prospectCode: { $regex: rxFull } },
    { firstName: { $regex: rxFull } },
    { lastName: { $regex: rxFull } },
  ];

  /**
   * Multi-part name matching:
   * For "jake louis", require both tokens to appear across firstName/lastName
   * (order independent).
   *
   * Implementation:
   * - Builds an $and array of token checks.
   * - Each token can match either firstName or lastName.
   */
  if (parts.length >= 2) {
    or.push({
      $and: parts.map((term) => {
        const rx = new RegExp(term, "i");
        return {
          $or: [{ firstName: { $regex: rx } }, { lastName: { $regex: rx } }],
        };
      }),
    });
  }

  return { $or: or };
}

/**
 * onlyDigits(v)
 * -------------
 * Removes all non-digit characters from a string.
 *
 * Example:
 *  "(+63) 912-345-6789" → "639123456789"
 *
 * Used for:
 * - normalizing phone-like input before validation or storage.
 */
/**
 * buildPolicyholderSearchMatch(qRaw)
 * ---------------------------------
 * Builds the MongoDB $or search filter used by policyholder listing endpoints.
 */
function buildPolicyholderSearchMatch(qRaw) {
  const q = String(qRaw || "").trim();
  if (!q) return null;

  const safeQ = escapeRegex(q);
  const parts = safeQ.split(/\s+/).filter(Boolean);
  const rxFull = new RegExp(safeQ, "i");

  const or = [
    { policyholderCode: { $regex: rxFull } },
    { policyNumber: { $regex: rxFull } },
    { "prospect.firstName": { $regex: rxFull } },
    { "prospect.lastName": { $regex: rxFull } },
    { "product.productName": { $regex: rxFull } },
  ];

  if (parts.length >= 2) {
    or.push({
      $and: parts.map((term) => {
        const rx = new RegExp(term, "i");
        return {
          $or: [{ "prospect.firstName": { $regex: rx } }, { "prospect.lastName": { $regex: rx } }],
        };
      }),
    });
  }

  return { $or: or };
}

/**
 * onlyDigits(v)
 * -------------
 * Utility used by validation helpers to strip non-numeric characters.
 */
function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

/**
 * isValidEmail(email)
 * -------------------
 * Validates email format.
 *
 * Rules:
 * - Empty string / null / undefined is allowed (email is optional).
 * - If provided, must match a basic email regex.
 */
/**
 * isValidEmail(email)
 * -------------------
 * Lightweight email validator for request-body checks.
 */
function isValidEmail(email) {
  // allow empty string (optional field)
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * computeAgeFromBirthday(birthDate)
 * ---------------------------------
 * Computes current age based on a Date object.
 *
 * Returns:
 * - null if birthDate is invalid
 * - computed integer age otherwise
 *
 * Logic:
 * - Calculates year difference
 * - Adjusts down by 1 if birthday hasn't occurred yet this year
 */
/**
 * computeAgeFromBirthday(birthDate)
 * --------------------------------
 * Calculates age from a birthday using the local-calendar expectations of the
 * prospect forms.
 */
function computeAgeFromBirthday(birthDate) {
  if (!(birthDate instanceof Date) || isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * isFutureDateOnly(dateObj)
 * -------------------------
 * "Date-only" comparison to determine if a given date is in the future,
 * ignoring time-of-day.
 *
 * Example:
 * - A birthday set to tomorrow should be rejected as "future date".
 */
/**
 * isFutureDateOnly(dateObj)
 * -------------------------
 * Date-only future check used by form validators that ignore the time portion.
 */
function isFutureDateOnly(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return d.getTime() > today.getTime();
}

/**
 * generateNextProspectCode()
 * -------------------------
 * Generates the next prospectCode in the format:
 *   P-000001
 *
 * Implementation:
 * - Finds the latest prospect whose prospectCode matches /^P-\d{6}$/
 * - Sorts descending by prospectCode (safe because fixed-width zero padding)
 * - Extracts numeric portion, increments, and formats next code
 *
 *   A counter collection or transaction would be needed for enterprise scale.
 */
async function generateNextProspectCode() {
  // Find the max existing prospectCode and increment
  const last = await Prospect.findOne({ prospectCode: /^P-\d{6}$/ })
    .sort({ prospectCode: -1 })
    .select("prospectCode")
    .lean();

  let nextNum = 1;
  if (last?.prospectCode) {
    const n = parseInt(last.prospectCode.replace("P-", ""), 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }

  return `P-${String(nextNum).padStart(6, "0")}`;
}

/**
 * getNextLeadCode()
 * -----------------
 * Generates the next leadCode in the format:
 *   L-000005
 *
 * Implementation:
 * - Finds latest leadCode matching /^L-\d{6}$/
 * - Sorts descending (works because zero padding ensures lexical order == numeric order)
 * - Extracts numeric part, increments, formats next code
 */
async function getNextLeadCode() {
  // Find the latest leadCode that matches our format
  const last = await Lead.findOne({ leadCode: { $regex: /^L-\d{6}$/ } })
    .sort({ leadCode: -1 })
    .select("leadCode")
    .lean();

  let nextNum = 1;

  if (last?.leadCode) {
    const n = Number(String(last.leadCode).replace("L-", ""));
    if (Number.isFinite(n)) nextNum = n + 1;
  }

  return `L-${String(nextNum).padStart(6, "0")}`;
}


async function loadAnnualPaymentRecordsForPolicyholder(policyholder) {
  const rawRecords = Array.isArray(policyholder?.annualPaymentRecords) ? policyholder.annualPaymentRecords : [];
  const annualPaymentIds = rawRecords
    .map((record) => record?.annualPaymentId)
    .filter((id) => id && mongoose.isValidObjectId(id));

  const query = annualPaymentIds.length
    ? { _id: { $in: annualPaymentIds } }
    : { leadEngagementId: policyholder?.leadEngagementId };

  const annualPayments = await AnnualPayment.find(query)
    .select("annualPaymentPeriod totalAnnualPremiumPhp amountPaidSoFarPhp remainingBalancePhp frequencyOfPayment paymentProgress status createdAt updatedAt")
    .lean();

  const recordedAtByAnnualPaymentId = new Map(
    rawRecords.map((record) => [String(record?.annualPaymentId || ""), record?.recordedAt || null])
  );

  return annualPayments
    .map((annualPayment) => ({
      _id: annualPayment._id,
      annualPaymentId: annualPayment._id,
      annualPaymentPeriod: annualPayment.annualPaymentPeriod || {},
      label: annualPayment?.annualPaymentPeriod?.label || "",
      totalAnnualPremiumPhp: annualPayment.totalAnnualPremiumPhp ?? null,
      amountPaidSoFarPhp: annualPayment.amountPaidSoFarPhp ?? 0,
      remainingBalancePhp: annualPayment.remainingBalancePhp ?? 0,
      frequencyOfPayment: annualPayment.frequencyOfPayment || "",
      paymentProgress: annualPayment.paymentProgress || { paidCount: 0, totalCount: 0, label: "0/0" },
      status: annualPayment.status || "Not Started",
      recordedAt: recordedAtByAnnualPaymentId.get(String(annualPayment._id)) || annualPayment.createdAt || null,
      createdAt: annualPayment.createdAt || null,
      updatedAt: annualPayment.updatedAt || null,
    }))
    .sort((left, right) => {
      const rightTime = new Date(right?.annualPaymentPeriod?.startDate || right?.recordedAt || right?.createdAt || 0).getTime();
      const leftTime = new Date(left?.annualPaymentPeriod?.startDate || left?.recordedAt || left?.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
}


const NEEDS_PRIORITY_CATEGORIES = ["Protection", "Health", "Investment"];

async function getNonCancelledPolicyPriorityCategoriesForProspect(prospectObjectId, userObjectId, options = {}) {
  const excludeLeadEngagementId = options.excludeLeadEngagementId ? String(options.excludeLeadEngagementId) : "";
  const leadIds = await Lead.find({ prospectId: prospectObjectId }).distinct("_id");
  if (!leadIds.length) return [];

  const engagementIds = await LeadEngagement.find({ leadId: { $in: leadIds } }).distinct("_id");
  const scopedEngagementIds = excludeLeadEngagementId
    ? engagementIds.filter((id) => String(id) !== excludeLeadEngagementId)
    : engagementIds;
  if (!scopedEngagementIds.length) return [];

  const policyholders = await Policyholder.find({
    assignedToUserId: userObjectId,
    leadEngagementId: { $in: scopedEngagementIds },
    status: { $ne: "Cancelled" },
  })
    .select("productId status")
    .populate("productId", "productCategory")
    .lean();

  return [...new Set((policyholders || [])
    .map((policyholder) => String(policyholder?.productId?.productCategory || "").trim())
    .filter((category) => NEEDS_PRIORITY_CATEGORIES.includes(category)))];
}

async function getNextPolicyholderCode() {
  const last = await Policyholder.findOne({ policyholderCode: { $regex: /^PH-\d{6}$/ } })
    .sort({ policyholderCode: -1 })
    .select("policyholderCode")
    .lean();

  let nextNum = 1;
  if (last?.policyholderCode) {
    const n = Number(String(last.policyholderCode).replace("PH-", ""));
    if (Number.isFinite(n)) nextNum = n + 1;
  }

  return `PH-${String(nextNum).padStart(6, "0")}`;
}

/**
 * dateKeyInTZ(date, timeZone = "Asia/Manila")
 * -------------------------------------------
 * Converts a Date into a timezone-specific YYYY-MM-DD string.
 *
 * Why this exists:
 * - "Due today" depends on the user's timezone (Asia/Manila).
 * - Using timezone-aware formatting prevents off-by-one-day issues.
 *
 * Returns:
 * - "YYYY-MM-DD" or null if date is invalid
 */
/**
 * dateKeyInTZ(date, timeZone)
 * ---------------------------
 * Produces a stable YYYY-MM-DD key for a date in the requested time zone.
 */
function dateKeyInTZ(date, timeZone = "Asia/Manila") {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const da = parts.find((p) => p.type === "day")?.value;

  if (!y || !m || !da) return null;
  return `${y}-${m}-${da}`;
}

/**
 * isDueTodayInManila(dueAt)
 * -------------------------
 * Returns true if dueAt falls on today's date in Asia/Manila timezone.
 *
 * Uses dateKeyInTZ() to compare YYYY-MM-DD keys.
 */
/**
 * isDueTodayInManila(dueAt)
 * -------------------------
 * Convenience helper for dashboard/task widgets that bucket work by Manila day.
 */
function isDueTodayInManila(dueAt) {
  const todayKey = dateKeyInTZ(new Date(), "Asia/Manila");
  const dueKey = dateKeyInTZ(dueAt, "Asia/Manila");
  return !!todayKey && todayKey === dueKey;
}

/**
 * formatTimeInManila(date)
 * ------------------------
 * Formats a timestamp into a short Manila-time clock string.
 */
function formatTimeInManila(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * formatDateTimeInManila(date)
 * ----------------------------
 * Formats a full Manila date-time string for task descriptions and meeting text.
 */
function formatDateTimeInManila(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

async function createTaskAddedNotifications({
  assignedToUserId,
  task,
  prospectFullName,
  leadCode,
  session,
  includeTaskAdded = true,
  refreshTaskAdded = false,
}) {
  const writes = [];
  const taskAddedRefreshAt = new Date();
  const taskDueTodayRefreshAt = new Date(taskAddedRefreshAt.getTime() + 1);
  const taskAddedDedupeKey = `TASK_ADDED:${task._id}`;

  if (includeTaskAdded) {
    writes.push({
      updateOne: {
        filter: refreshTaskAdded
          ? {
              assignedToUserId,
              type: "TASK_ADDED",
              entityType: "Task",
              entityId: task._id,
            }
          : {
              assignedToUserId,
              dedupeKey: taskAddedDedupeKey,
            },
        update: refreshTaskAdded
          ? {
              $set: {
                title: "New task added",
                message: `${task.title} was updated for ${prospectFullName} (Lead ${leadCode || "—"}).`,
                status: "Unread",
                readAt: null,
                entityType: "Task",
                entityId: task._id,
                updatedAt: taskAddedRefreshAt,
              },
              $setOnInsert: {
                assignedToUserId,
                type: "TASK_ADDED",
                dedupeKey: taskAddedDedupeKey,
                createdAt: taskAddedRefreshAt,
              },
            }
          : {
              $setOnInsert: {
                assignedToUserId,
                type: "TASK_ADDED",
                title: "New task added",
                message: `${task.title} was created for ${prospectFullName} (Lead ${leadCode || "—"}).`,
                status: "Unread",
                entityType: "Task",
                entityId: task._id,
                dedupeKey: taskAddedDedupeKey,
                createdAt: taskAddedRefreshAt,
                updatedAt: taskAddedRefreshAt,
              },
            },
        // Reschedules must only update the existing task-added notification row;
        // new task-added notifications are reserved for newly created tasks.
        upsert: !refreshTaskAdded,
      },
    });
  }

  if (task?.dueAt && isDueTodayInManila(task.dueAt)) {
    const dueTodayDedupeKey = `TASK_DUE_TODAY:${task._id}:${dateKeyInTZ(task.dueAt, "Asia/Manila")}`;
    writes.push({
      updateOne: {
        filter: {
          assignedToUserId,
          dedupeKey: dueTodayDedupeKey,
        },
        update: {
          $set: {
            title: "Task due today",
            message: `${task.title} for ${prospectFullName} (Lead ${leadCode || "—"}) is due today at ${formatTimeInManila(task.dueAt)}.`,
            status: "Unread",
            entityType: "Task",
            entityId: task._id,
            updatedAt: taskDueTodayRefreshAt,
          },
          $setOnInsert: {
            assignedToUserId,
            type: "TASK_DUE_TODAY",
            dedupeKey: dueTodayDedupeKey,
            createdAt: taskDueTodayRefreshAt,
          },
        },
        upsert: true,
      },
    });
  }

  if (writes.length) {
    await Notification.bulkWrite(writes, { session, timestamps: false });
  }
}

async function ensureTaskMissedNotificationsForUser(userObjectId, { forceUnread = false, taskIds = null } = {}) {
  const now = new Date();
  const scopedTaskIds = Array.isArray(taskIds)
    ? [...new Set(taskIds.map((id) => toValidObjectIdString(id)).filter(Boolean))]
    : [];
  const scopedTaskIdSet = new Set(scopedTaskIds);
  const refreshAt = new Date();
  const dueTodayRefreshAt = refreshAt;
  const missedRefreshAt = new Date(refreshAt.getTime() + 1);
  const openTasks = await Task.find({
    assignedToUserId: userObjectId,
    status: { $in: ["Open", "Overdue"] },
    softDeletedAt: null,
    dueAt: { $ne: null },
  })
    .select("_id title dueAt prospectId leadEngagementId")
    .lean();
  const scopedOpenTasks = scopedTaskIdSet.size
    ? openTasks.filter((task) => scopedTaskIdSet.has(String(task?._id || "")))
    : openTasks;

  const dueTodayPendingTasks = scopedOpenTasks.filter((task) => task?.dueAt && isDueTodayInManila(task.dueAt));
  const overdueTasks = await Task.find({
    assignedToUserId: userObjectId,
    status: "Open",
    softDeletedAt: null,
    dueAt: { $lt: now },
    ...(scopedTaskIds.length ? { _id: { $in: scopedTaskIds } } : {}),
  })
    .select("_id title dueAt prospectId leadEngagementId")
    .lean();

  if (!overdueTasks.length && !dueTodayPendingTasks.length) return;

  const contextTasks = [...overdueTasks, ...dueTodayPendingTasks];
  const prospectIds = uniqueValidObjectIdStrings(contextTasks.map((task) => task.prospectId));
  const prospects = prospectIds.length
    ? await Prospect.find({ _id: { $in: prospectIds } })
        .select("firstName middleName lastName")
        .lean()
    : [];
  const prospectNameById = new Map(
    prospects.map((prospect) => {
      const fullName = `${prospect.firstName || ""}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName || ""}`.trim();
      return [String(prospect._id), fullName || "this prospect"];
    })
  );

  const engagementIds = uniqueValidObjectIdStrings(contextTasks.map((task) => task.leadEngagementId));
  const engagementDocs = engagementIds.length
    ? await LeadEngagement.find({ _id: { $in: engagementIds } }).select("_id leadId").lean()
    : [];
  const leadIds = uniqueValidObjectIdStrings(engagementDocs.map((engagement) => engagement.leadId));
  const leadCodeById = leadIds.length
    ? new Map(
        (
          await Lead.find({ _id: { $in: leadIds } })
            .select("_id leadCode")
            .lean()
        ).map((lead) => [String(lead._id), lead.leadCode || "—"])
      )
    : new Map();
  const leadCodeByEngagementId = new Map(
    engagementDocs.map((engagement) => [String(engagement._id), leadCodeById.get(String(engagement.leadId)) || "—"])
  );

  const writes = overdueTasks
    .map((task) => {
      const dueKey = dateKeyInTZ(task.dueAt, "Asia/Manila");
      if (!dueKey) return null;

      const dedupeKey = `TASK_MISSED:${task._id}:${dueKey}`;
      const prospectName = prospectNameById.get(String(task.prospectId || "")) || "this prospect";
      const leadCode = leadCodeByEngagementId.get(String(task.leadEngagementId || "")) || "—";
      return {
        updateOne: {
          filter: { assignedToUserId: userObjectId, dedupeKey },
          update: {
            $set: {
              title: "Task missed",
              message: `${task.title || "Task"} for ${prospectName} (Lead ${leadCode}) is now overdue.`,
              entityType: "Task",
              entityId: task._id,
              updatedAt: missedRefreshAt,
              ...(forceUnread ? { status: "Unread", readAt: null, createdAt: missedRefreshAt } : {}),
            },
            $setOnInsert: {
              assignedToUserId: userObjectId,
              type: "TASK_MISSED",
              dedupeKey,
              createdAt: missedRefreshAt,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  const dueTodayWrites = dueTodayPendingTasks
    .map((task) => {
      const dueKey = dateKeyInTZ(task.dueAt, "Asia/Manila");
      if (!dueKey) return null;
      const dedupeKey = `TASK_DUE_TODAY:${task._id}:${dueKey}`;
      const prospectName = prospectNameById.get(String(task.prospectId || "")) || "this prospect";
      const leadCode = leadCodeByEngagementId.get(String(task.leadEngagementId || "")) || "—";
      return {
        updateOne: {
          filter: { assignedToUserId: userObjectId, dedupeKey },
          update: {
            $set: {
              title: "Task due today",
              message: `${task.title || "Task"} for ${prospectName} (Lead ${leadCode}) is due today at ${formatTimeInManila(task.dueAt)}.`,
              entityType: "Task",
              entityId: task._id,
              updatedAt: dueTodayRefreshAt,
              ...(forceUnread ? { status: "Unread", readAt: null, createdAt: dueTodayRefreshAt } : {}),
            },
            $setOnInsert: {
              assignedToUserId: userObjectId,
              type: "TASK_DUE_TODAY",
              dedupeKey,
              createdAt: dueTodayRefreshAt,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (dueTodayWrites.length) {
    await Notification.bulkWrite(dueTodayWrites, { ordered: false, timestamps: false });
  }

  if (writes.length) {
    await Notification.bulkWrite(writes, { ordered: false, timestamps: false });
  }
}

/**
 * toValidObjectIdString(value)
 * ----------------------------
 * Returns a normalized ObjectId string or null when the value is invalid.
 */
function toValidObjectIdString(value) {
  if (!value) return null;
  const str = String(value).trim();
  return mongoose.isValidObjectId(str) ? str : null;
}

/**
 * uniqueValidObjectIdStrings(values)
 * ---------------------------------
 * De-duplicates and filters arrays down to valid ObjectId strings only.
 */
function uniqueValidObjectIdStrings(values = []) {
  return [...new Set(values.map(toValidObjectIdString).filter(Boolean))];
}

/**
 * attachTaskRefs(tasks)
 * ---------------------
 * Enriches task objects with reference fields needed by the frontend UI:
 * - prospectName (computed from Prospect first/middle/last)
 * - leadId (optional; derived via LeadEngagement)
 * - leadCode (optional; derived via Lead)
 *
 * Why this exists:
 * - Tasks store prospectId and leadEngagementId.
 * - Frontend needs human-readable names and routing identifiers.
 *
 * Implementation:
 * 1) Fetch all Prospect names for the tasks' prospectIds (batched query)
 * 2) Fetch LeadEngagement entries to map leadEngagementId → leadId
 * 3) Fetch Leads to map leadId → leadCode
 * 4) Return tasks with additional fields injected
 */
async function attachTaskRefs(tasks) {
  // Prospects
  const prospectIds = uniqueValidObjectIdStrings(tasks.map((t) => t.prospectId));
  const prospects = prospectIds.length
    ? await Prospect.find({ _id: { $in: prospectIds } })
    .select("firstName middleName lastName")
    .lean()
    : [];

  const prospectMap = new Map(
    prospects.map((p) => {
      const fullName = `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName}`.trim();
      return [String(p._id), fullName];
    })
  );

  // LeadEngagement -> leadId -> leadCode
  const engagementIds = uniqueValidObjectIdStrings(tasks.map((t) => t.leadEngagementId));

  const engagementToLeadId = new Map(); // engagementId -> leadId
  let leadIdToCode = new Map(); // leadId -> leadCode
  let leadIdToStatus = new Map(); // leadId -> lead status

  if (engagementIds.length) {
    const engagements = await LeadEngagement.find({ _id: { $in: engagementIds } })
      .select("leadId")
      .lean();

    for (const e of engagements) {
      if (e.leadId) engagementToLeadId.set(String(e._id), String(e.leadId));
    }

    const leadIds = uniqueValidObjectIdStrings(engagements.map((e) => e.leadId));

    if (leadIds.length) {
      const leads = await Lead.find({ _id: { $in: leadIds } })
        .select("leadCode status")
        .lean();

      leadIdToCode = new Map(leads.map((l) => [String(l._id), l.leadCode]));
      leadIdToStatus = new Map(leads.map((l) => [String(l._id), l.status || "—"]));
    }
  }

  return tasks.map((t) => {
    const engagementIdStr = t.leadEngagementId ? String(t.leadEngagementId) : null;
    const leadId = engagementIdStr ? engagementToLeadId.get(engagementIdStr) || null : null;
    const leadCode = leadId ? leadIdToCode.get(String(leadId)) || "—" : "—";
    const leadStatus = leadId ? leadIdToStatus.get(String(leadId)) || "—" : "—";

    return {
      ...t,
      prospectName: prospectMap.get(String(t.prospectId)) || "—",
      leadId,
      leadCode,
      leadStatus,
    };
  });
}

/* ===========================
   PROSPECTS: RECENT (Agent)
   Endpoint: GET /api/prospects/recent?userId=...&limit=5

   Purpose:
   - Returns a small list of the most recent prospects for a specific agent.
   - Also returns total count of prospects assigned to that agent.

   Important design rule:
   - The "prospectNo" shown in UI is stable and agent-specific:
     it is computed by ranking the agent's prospects by prospectCode ASC.
   - The "recent" view itself is still a "latest" list:
     after computing prospectNo, we sort by prospectCode DESC and limit.

   Output:
   {
     totalForThisUser: Number,
     prospects: Array<Prospect + computed fields>
   }
=========================== */
app.get("/api/prospects/recent", async (req, res) => {
  try {
    const { userId, limit = 5 } = req.query;

    // Basic input validation: userId is required to scope results to a single agent
    if (!userId) {
      return res.status(400).json({ message: "Missing userId." });
    }

    // Clamp limit to prevent expensive responses (max 20)
    const n = Math.min(parseInt(limit, 10) || 5, 20);

    // Convert userId into Mongo ObjectId for accurate matching
    const userObjectId = new mongoose.Types.ObjectId(userId);

    /**
     * totalForThisUser
     * ----------------
     * Total number of prospects assigned to this agent.
     * Used for dashboard counts and UI pagination/summary.
     */
    const totalForThisUser = await Prospect.countDocuments({
      assignedToUserId: userObjectId,
    });

    /**
     * Aggregation pipeline:
     * 1) Filter prospects to agent
     * 2) Compute "prospectNo" (stable rank per agent)
     * 3) Sort newest-first and limit
     * 4) Lookup how many "In Progress" leads exist per prospect
     * 5) Shape output fields for frontend
     */
    const prospects = await Prospect.aggregate([
  
      /**
       * Step 1: Filter to only prospects owned by this agent
       */
      { $match: { assignedToUserId: userObjectId } },

      /**
       * Step 2: Compute agent-specific "prospectNo"
       * -------------------------------------------
       * Uses window function to assign a stable ranking number.
       *
       * partitionBy: "$assignedToUserId"
       * - Ranking restarts per agent.
       *
       * sortBy: { prospectCode: 1 }
       * - MUST be exactly one field for stable deterministic ordering (per comment).
       *
       * output.prospectNo: $documentNumber
       * - Produces 1,2,3,... based on the sort order.
       */
      {
        $setWindowFields: {
          partitionBy: "$assignedToUserId",
          sortBy: { prospectCode: 1 }, 
          output: {
            prospectNo: { $documentNumber: {} },
          },
        },
      },

      /**
       * Step 3: "Recent" view ordering
       * ------------------------------
       * After prospectNo is computed in ASC order, we now sort DESC to get newest codes.
       * This makes the returned list "latest prospects" while keeping numbering stable.
       */
      { $sort: { prospectCode: -1 } },
      { $limit: n },

      /**
       * Step 4: Lookup leads in progress for each prospect
       * --------------------------------------------------
       * Joins leads collection and counts how many leads for this prospect
       * are currently in status "In Progress".
       *
       * Uses pipeline lookup:
       * - $expr ensures we match lead.prospectId to current prospect _id
       * - $count returns a single doc like { count: X }
       */
      {
        $lookup: {
          from: "leads",
          let: { pid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$prospectId", "$$pid"] },
                status: "In Progress",
              },
            },
            { $count: "count" },
          ],
          as: "inProgressLeads",
        },
      },
      /**
       * Step 5: Convert lookup array result into scalar number
       * ------------------------------------------------------
       * If no leads found, default to 0.
       */
      {
        $addFields: {
          leadsInProgress: {
            $ifNull: [{ $arrayElemAt: ["$inProgressLeads.count", 0] }, 0],
          },
        },
      },
      /**
       * Step 6: Remove internal/unneeded fields from response
       */
      {
        $project: {
          inProgressLeads: 0,
          __v: 0,
          updatedAt: 0,
        },
      },
    ]);

    // Response includes both the list and total count for UI dashboards
    return res.json({
      totalForThisUser,
      prospects,
    });
  } catch (err) {
    console.error("Recent prospects error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   POLICYHOLDERS: RECENT PAID (Agent)
   Endpoint: GET /api/policyholders/recent?userId=...&limit=5

   Purpose:
   - Returns the agent’s most recently paid policyholders (by lastPaidDate DESC).
   - Computes a stable policyholderNo per agent:
     rank by policyholderCode ASC, partitioned by agent.

   Important design rule:
   - Policyholder does NOT store assignedToUserId directly in this pipeline.
   - Agent filtering is done via:
       Policyholder -> LeadEngagement -> Lead -> Prospect.assignedToUserId
=========================== */
app.get("/api/policyholders/recent", async (req, res) => {
  try {
    const { userId, limit = 5 } = req.query;

    // userId is required to scope results
    if (!userId) return res.status(400).json({ message: "Missing userId." });

    // Validate that userId is a proper MongoDB ObjectId
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    // Clamp limit to max 20 for safety/performance
    const n = Math.min(parseInt(limit, 10) || 5, 20);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    /**
     * Aggregation pipeline overview:
     * 1) Join LeadEngagement (policyholder.leadEngagementId → leadengagements._id)
     * 2) Join Lead (leadEngagement.leadId → leads._id)
     * 3) Join Prospect (lead.prospectId → prospects._id)
     * 4) Filter to this agent via prospect.assignedToUserId
     * 5) Compute stable policyholderNo per agent via policyholderCode ASC
     * 6) Sort by lastPaidDate DESC to get "recently paid"
     * 7) Use $facet to return total count + top N items in one query
     */
    const agg = await Policyholder.aggregate([
      /**
       * Step 1: Lookup Lead for each policyholder
       * - Creates array field "lead"
       */
      {
        $lookup: {
          from: "leadengagements",
          localField: "leadEngagementId",
          foreignField: "_id",
          as: "leadEngagement",
        },
      },
      { $unwind: "$leadEngagement" },

      /**
       * Step 2: Lookup Lead via leadEngagement.leadId
       */
      {
        $lookup: {
          from: "leads",
          localField: "leadEngagement.leadId",
          foreignField: "_id",
          as: "lead",
        },
      },
      { $unwind: "$lead" },

      /**
       * Step 3: Lookup Prospect via lead.prospectId
       * - Needed for filtering by agent and returning name fields
       */
      {
        $lookup: {
          from: "prospects",
          localField: "lead.prospectId",
          foreignField: "_id",
          as: "prospect",
        },
      },
      { $unwind: "$prospect" },

      /**
       * Step 4: Filter policyholders to those belonging to THIS agent
       * - Determined by prospect.assignedToUserId
       */
      { $match: { "prospect.assignedToUserId": userObjectId } },

      /**
       * Step 5: Copy assignedToUserId into root document
       * - Makes it easier to use partitionBy in window fields
       */
      { $addFields: { assignedToUserId: "$prospect.assignedToUserId" } },

      /**
       * Step 6: Compute stable policyholderNo per agent
       * - Ranking is stable because it is based on policyholderCode ASC.
       * - partitionBy ensures ranking resets per agent.
       */
      {
        $setWindowFields: {
          partitionBy: "$assignedToUserId",
          sortBy: { policyholderCode: 1 }, 
          output: { policyholderNo: { $documentNumber: {} } },
        },
      },

      /**
       * Step 7: Most recently paid ordering
       * - Sort by lastPaidDate DESC for "recent payments" view
       */
      { $sort: { lastPaidDate: -1 } },

      /**
       * Step 8: Use $facet to return:
       * - total count for agent
       * - limited list of items for UI
       *
       * This avoids running two separate queries.
       */
      {
        $facet: {
          total: [{ $count: "count" }],
          items: [
            { $limit: n },
            {
              $project: {
                _id: 1,
                leadEngagementId: 1,
                policyholderNo: 1,
                policyholderCode: 1,
                policyNumber: 1,
                status: 1,
                lastPaidDate: 1,
                nextPaymentDate: 1,
                leadId: "$lead._id",
                prospectId: "$prospect._id",
                firstName: "$prospect.firstName",
                lastName: "$prospect.lastName",
              },
            },
          ],
        },
      },
      /**
       * Step 9: Normalize output object structure
       * - totalForThisUser defaults to 0 if no matches
       * - policyholders field contains the list
       */
      {
        $project: {
          totalForThisUser: {
            $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0],
          },
          policyholders: "$items",
        },
      },
    ]);

    // agg returns an array with one object due to final $project
    const out = agg[0] || { totalForThisUser: 0, policyholders: [] };

    return res.json(out);
  } catch (err) {
    console.error("Recent policyholders error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   AGENT HOME: DASHBOARD PREVIEW (Agent)
   Endpoint: GET /api/agent/home?userId=...
=========================== */
app.get("/api/agent/home", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    await ensureTaskMissedNotificationsForUser(userObjectId);

    let openTasks = await Task.find({ assignedToUserId: userObjectId, status: "Open", softDeletedAt: null })
      .select("assignedToUserId prospectId leadEngagementId type title description dueAt status completedAt wasDelayed createdAt")
      .lean();
    openTasks = await attachTaskRefs(openTasks);

    const now = new Date();
    const nowMs = now.getTime();
    const todayKey = dateKeyInTZ(now, "Asia/Manila");
    const normalizedTasks = openTasks.map((task) => {
      const dueMs = new Date(task?.dueAt).getTime();
      const isOverdue = Number.isFinite(dueMs) ? dueMs < nowMs : false;
      return { ...task, __isOverdue: isOverdue };
    });

    const dueTodayTop5 = normalizedTasks
      .filter((task) => {
        const dueMs = new Date(task?.dueAt).getTime();
        const dueOk = Number.isFinite(dueMs) ? dueMs : Infinity;
        return dateKeyInTZ(task?.dueAt, "Asia/Manila") === todayKey && dueOk >= nowMs;
      })
      .slice()
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
      .slice(0, 5);

    const recentlyAddedTop5 = normalizedTasks
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const prospects = await Prospect.find({ assignedToUserId: userObjectId })
      .select("_id prospectCode firstName middleName lastName marketType prospectType source status createdAt")
      .lean();
    const prospectIds = prospects.map((prospect) => prospect._id);

    const leads = prospectIds.length
      ? await Lead.find({ prospectId: { $in: prospectIds } }).select("_id prospectId source otherSource status createdAt").lean()
      : [];
    const leadIds = leads.map((lead) => lead._id);

    const engagements = leadIds.length
      ? await LeadEngagement.find({ leadId: { $in: leadIds } }).select("_id leadId currentStage createdAt").lean()
      : [];
    const engagementIds = engagements.map((engagement) => engagement._id);

    const policyholders = engagementIds.length
      ? await Policyholder.find({ leadEngagementId: { $in: engagementIds } })
          .select("status leadEngagementId createdAt")
          .lean()
      : [];

    const annualPayments = engagementIds.length
      ? await AnnualPayment.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId totalAnnualPremiumPhp")
          .lean()
      : [];

    const leadCountByProspectId = new Map();
    leads.forEach((lead) => {
      const key = String(lead?.prospectId || "");
      leadCountByProspectId.set(key, (leadCountByProspectId.get(key) || 0) + 1);
    });

    const leadById = new Map(leads.map((lead) => [String(lead._id), lead]));
    const engagementById = new Map(engagements.map((engagement) => [String(engagement._id), engagement]));

    const totalProspects = prospects.length;
    const totalPolicyholders = policyholders.length;
    const activePolicies = policyholders.filter((policyholder) => policyholder.status === "Active").length;
    const conversionRate = totalProspects ? Math.round((totalPolicyholders / totalProspects) * 100) : 0;
    const activePolicyRate = totalPolicyholders ? Math.round((activePolicies / totalPolicyholders) * 100) : 0;

    const recentProspects = [...prospects]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3)
      .map((prospect) => ({
        _id: prospect._id,
        prospectCode: prospect.prospectCode || "—",
        fullName: [prospect.firstName, prospect.middleName, prospect.lastName].filter(Boolean).join(" "),
        marketType: prospect.marketType || "—",
        prospectType: prospect.prospectType || "—",
        status: prospect.status || "—",
        createdAt: prospect.createdAt || null,
        leadCount: leadCountByProspectId.get(String(prospect._id)) || 0,
      }));

    const activePolicyholderEngagementIds = new Set();
    const activePolicyholderLeadIds = new Set();
    policyholders.forEach((policyholder) => {
      if (policyholder.status !== "Active") return;
      const engagementId = String(policyholder?.leadEngagementId || "");
      const engagement = engagementById.get(engagementId);
      if (!engagement) return;
      activePolicyholderEngagementIds.add(engagementId);
      activePolicyholderLeadIds.add(String(engagement.leadId));
    });

    const leadSourceBreakdown = new Map();
    leads.forEach((lead) => {
      const label = String(lead?.source || "Other").trim() || "Other";
      const current = leadSourceBreakdown.get(label) || { label, total: 0, activeConverted: 0 };
      current.total += 1;
      if (activePolicyholderLeadIds.has(String(lead._id))) current.activeConverted += 1;
      leadSourceBreakdown.set(label, current);
    });

    const bestSource = [...leadSourceBreakdown.values()]
      .map((item) => ({
        label: item.label,
        activePolicyholders: item.activeConverted,
        convertedLeads: item.activeConverted,
        conversionRatePct: item.total ? Math.round((item.activeConverted / item.total) * 100) : 0,
      }))
      .sort((a, b) => {
        if (b.conversionRatePct !== a.conversionRatePct) return b.conversionRatePct - a.conversionRatePct;
        return b.activePolicyholders - a.activePolicyholders;
      })[0] || null;

    const totalAnnualPremiumPhp = annualPayments
      .filter((annualPayment) => activePolicyholderEngagementIds.has(String(annualPayment?.leadEngagementId || "")))
      .reduce((sum, annualPayment) => sum + Number(annualPayment?.totalAnnualPremiumPhp || 0), 0);

    return res.json({
      tasks: {
        dueTodayTop5,
        recentlyAddedTop5,
      },
      clients: {
        totalProspects,
        totalPolicyholders,
        conversionRate,
        activePolicyRate,
        recentProspects,
      },
      sales: {
        conversionRatePct: activePolicyRate,
        totalPolicies: activePolicies,
        totalAnnualPremiumPhp,
        bestSource,
      },
    });
  } catch (err) {
    console.error("Agent home data error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   CLIENTS: RELATIONSHIP DASHBOARD (Agent)
   Endpoint: GET /api/clients/relationship/dashboard?userId=...
=========================== */
app.get("/api/clients/relationship/dashboard", async (req, res) => {
  try {
    const {
      userId,
      datePreset = "ALL",
      source = "ALL",
      marketType = "ALL",
      prospectType = "ALL",
      status = "ALL",
    } = req.query;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const now = new Date();
    const presetMap = {
      "1d": [1, "This day"],
      "7d": [7, "Last 7 days"],
      "30d": [30, "Last 30 days"],
      "90d": [90, "Last 90 days"],
      "6m": [183, "Last 6 months"],
      "12m": [365, "Last 12 months"],
    };
    const preset = presetMap[String(datePreset || "ALL")];
    const startDate = (() => {
      if (!preset) return null;
      const dt = new Date(now);
      if (String(datePreset) === "1d") dt.setHours(0, 0, 0, 0);
      else dt.setDate(dt.getDate() - preset[0]);
      return dt;
    })();

    const isInSelectedRange = (value) => {
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return false;
      if (startDate && dt < startDate) return false;
      return dt <= now;
    };
    const formatDate = (value) => {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime())
        ? "—"
        : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };
    const toPct = (part, total) => (total ? Math.round((part / total) * 100) : 0);
    const countBy = (arr, predicate) => arr.filter(predicate).length;
    const normalizeKey = (value) => String(value || "");
    const normalizeStatus = (value) => String(value || "").trim();
    const isActiveLead = (lead) => ["New", "In Progress"].includes(normalizeStatus(lead?.status));
    const isClosedLead = (lead) => normalizeStatus(lead?.status) === "Closed";
    const isActivePolicyholder = (policyholder) => normalizeStatus(policyholder?.status) === "Active";
    const isRiskPolicyholder = (policyholder) => ["At Risk", "Lapsed"].includes(normalizeStatus(policyholder?.status));
    const bucketDate = (dateValue, unit) => {
      const dt = new Date(dateValue);
      if (Number.isNaN(dt.getTime())) return null;
      if (unit === "day") return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      if (unit === "week") {
        const normalized = new Date(dt);
        const day = normalized.getDay();
        const diff = (day + 6) % 7;
        normalized.setHours(0, 0, 0, 0);
        normalized.setDate(normalized.getDate() - diff);
        return normalized;
      }
      return new Date(dt.getFullYear(), dt.getMonth(), 1);
    };
    const addBucket = (date, unit) => {
      const next = new Date(date);
      if (unit === "day") next.setDate(next.getDate() + 1);
      else if (unit === "week") next.setDate(next.getDate() + 7);
      else next.setMonth(next.getMonth() + 1);
      return next;
    };
    const buildSeries = (items, dateKey) => {
      const unit = ["1d", "7d"].includes(String(datePreset)) ? "day" : ["30d", "90d"].includes(String(datePreset)) ? "week" : "month";
      const seriesStart = bucketDate(startDate || new Date(now.getFullYear(), now.getMonth() - 5, 1), unit);
      const seriesEnd = bucketDate(now, unit);
      const buckets = [];
      let cursor = new Date(seriesStart);
      while (cursor <= seriesEnd && buckets.length < 370) {
        buckets.push(new Date(cursor));
        cursor = addBucket(cursor, unit);
      }
      const counts = new Map(buckets.map((bucket) => [bucket.getTime(), 0]));
      items.forEach((item) => {
        if (!isInSelectedRange(item?.[dateKey])) return;
        const bucket = bucketDate(item?.[dateKey], unit);
        if (!bucket) return;
        const key = bucket.getTime();
        if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
      });
      return buckets.map((bucket) => ({
        label: unit === "day"
          ? bucket.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : unit === "week"
            ? bucket.toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : bucket.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: counts.get(bucket.getTime()) || 0,
      }));
    };

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectQuery = { assignedToUserId: userObjectId };
    if (startDate) prospectQuery.createdAt = { $gte: startDate, $lte: now };
    if (source !== "ALL") prospectQuery.source = source;
    if (marketType !== "ALL") prospectQuery.marketType = marketType;
    if (prospectType !== "ALL") prospectQuery.prospectType = prospectType;
    if (status !== "ALL") prospectQuery.status = status;

    const prospects = await Prospect.find(prospectQuery)
      .select("_id prospectCode firstName middleName lastName marketType prospectType source status createdAt")
      .lean();

    const prospectIds = prospects.map((p) => p._id);
    const leads = prospectIds.length
      ? await Lead.find({ prospectId: { $in: prospectIds } }).select("_id prospectId status createdAt").lean()
      : [];
    const leadIds = leads.map((l) => l._id);

    const engagements = leadIds.length
      ? await LeadEngagement.find({ leadId: { $in: leadIds } }).select("_id leadId currentStage createdAt").lean()
      : [];
    const engagementIds = engagements.map((e) => e._id);

    const policyholders = engagementIds.length
      ? await Policyholder.find({ leadEngagementId: { $in: engagementIds } })
          .select("status leadEngagementId createdAt policyholderCode policyNumber")
          .lean()
      : [];

    const activeLeadsList = leads.filter(isActiveLead);
    const closedLeadsList = leads.filter(isClosedLead);
    const activePolicyholders = policyholders.filter(isActivePolicyholder);
    const activeLeadByProspectId = new Map();
    activeLeadsList.forEach((lead) => {
      const key = normalizeKey(lead.prospectId);
      const arr = activeLeadByProspectId.get(key) || [];
      arr.push(lead);
      activeLeadByProspectId.set(key, arr);
    });

    const leadById = new Map(leads.map((lead) => [normalizeKey(lead._id), lead]));
    const engagementById = new Map(engagements.map((engagement) => [normalizeKey(engagement._id), engagement]));
    const policyholdersByProspectId = new Map();
    const activePolicyholdersByProspectId = new Map();

    policyholders.forEach((policyholder) => {
      const engagement = engagementById.get(normalizeKey(policyholder.leadEngagementId));
      if (!engagement) return;
      const lead = leadById.get(normalizeKey(engagement.leadId));
      if (!lead) return;
      const prospectId = normalizeKey(lead.prospectId);
      const arr = policyholdersByProspectId.get(prospectId) || [];
      arr.push(policyholder);
      policyholdersByProspectId.set(prospectId, arr);
      if (isActivePolicyholder(policyholder)) {
        const activeArr = activePolicyholdersByProspectId.get(prospectId) || [];
        activeArr.push(policyholder);
        activePolicyholdersByProspectId.set(prospectId, activeArr);
      }
    });

    const totalProspects = prospects.length;
    const totalPolicyholders = policyholders.length;
    const totalActivePolicyholders = activePolicyholders.length;
    const totalLeads = leads.length;
    const prospectsWithActiveLeads = activeLeadByProspectId.size;
    const newLeads = countBy(leads, (lead) => lead.status === "New");
    const inProgressLeads = countBy(leads, (lead) => lead.status === "In Progress");
    const activeLeads = newLeads + inProgressLeads;

    const warm = countBy(prospects, (p) => p.marketType === "Warm");
    const cold = countBy(prospects, (p) => p.marketType === "Cold");
    const elite = countBy(prospects, (p) => p.prospectType === "Elite");
    const ordinary = countBy(prospects, (p) => p.prospectType === "Ordinary");
    const agentSourced = countBy(prospects, (p) => p.source === "Agent-Sourced");
    const systemAssigned = countBy(prospects, (p) => p.source === "System-Assigned");

    const prospectStatusCounts = ["Active", "Wrong Contact", "Dropped"].map((status) => ({
      status,
      value: countBy(prospects, (p) => p.status === status),
    }));

    const POLICY_STATUSES = ["Active", "At Risk", "Lapsed", "Paid-Up", "Matured", "Cancelled"];
    const policyStatusCountsList = POLICY_STATUSES.map((label) => ({
      status: label,
      value: countBy(policyholders, (p) => normalizeStatus(p.status) === label),
    }));
    const policyStatusCounts = policyStatusCountsList.reduce((acc, row) => {
      acc[row.status] = row.value;
      acc[row.status.toLowerCase().replace(/[^a-z0-9]+/g, "")] = row.value;
      return acc;
    }, {});

    const activeEngagements = engagements.filter((engagement) => isActiveLead(leadById.get(normalizeKey(engagement.leadId))));
    const stageLabels = ["Contacting", "Needs Assessment", "Proposal", "Application", "Policy Issuance"];
    const totalActiveEngagements = activeEngagements.length;
    const stageProgress = stageLabels.map((label) => {
      const count = countBy(activeEngagements, (e) => String(e.currentStage || "") === label);
      return { label, count, value: toPct(count, totalActiveEngagements) };
    });

    const countActivePoliciesForProspectSet = (prospectIdSet) => activePolicyholders.filter((policyholder) => {
      const engagement = engagementById.get(normalizeKey(policyholder.leadEngagementId));
      if (!engagement) return false;
      const lead = leadById.get(normalizeKey(engagement.leadId));
      if (!lead) return false;
      return prospectIdSet.has(normalizeKey(lead.prospectId));
    }).length;

    const sourceBuckets = ["Agent-Sourced", "System-Assigned"].map((label) => {
      const sourceProspects = prospects.filter((prospect) => prospect.source === label);
      const sourceProspectIds = new Set(sourceProspects.map((prospect) => normalizeKey(prospect._id)));
      const converted = countActivePoliciesForProspectSet(sourceProspectIds);
      return {
        label,
        prospects: sourceProspects.length,
        policyholders: converted,
        conversionRatePct: toPct(converted, sourceProspects.length),
      };
    });

    const marketBuckets = [
      { group: "Market Type", label: "Warm", predicate: (prospect) => prospect.marketType === "Warm" },
      { group: "Market Type", label: "Cold", predicate: (prospect) => prospect.marketType === "Cold" },
      { group: "Prospect Type", label: "Elite", predicate: (prospect) => prospect.prospectType === "Elite" },
      { group: "Prospect Type", label: "Ordinary", predicate: (prospect) => prospect.prospectType === "Ordinary" },
    ].map((bucket) => {
      const bucketProspects = prospects.filter(bucket.predicate);
      const converted = countActivePoliciesForProspectSet(new Set(bucketProspects.map((prospect) => normalizeKey(prospect._id))));
      return {
        group: bucket.group,
        label: bucket.label,
        prospects: bucketProspects.length,
        policyholders: converted,
        conversionRatePct: toPct(converted, bucketProspects.length),
      };
    });

    const prospectTrend = buildSeries(prospects, "createdAt");
    const policyholderTrend = buildSeries(policyholders, "createdAt");

    const recentProspects = [...prospects]
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map((prospect) => {
        const prospectId = normalizeKey(prospect._id);
        const linkedActiveLeads = activeLeadByProspectId.get(prospectId) || [];
        const linkedActivePolicies = activePolicyholdersByProspectId.get(prospectId) || [];
        return {
          prospectCode: prospect.prospectCode || "—",
          fullName: [prospect.firstName, prospect.middleName, prospect.lastName].filter(Boolean).join(" "),
          marketType: prospect.marketType || "—",
          prospectType: prospect.prospectType || "—",
          source: prospect.source || "—",
          status: prospect.status || "—",
          createdAt: prospect.createdAt || null,
          activeLeads: linkedActiveLeads.length,
          activePolicies: linkedActivePolicies.length,
        };
      });

    const closedLeadProspectsWithActivePolicies = new Set();
    closedLeadsList.forEach((lead) => {
      const prospectId = normalizeKey(lead.prospectId);
      if ((activePolicyholdersByProspectId.get(prospectId) || []).length > 0) closedLeadProspectsWithActivePolicies.add(prospectId);
    });

    const conversionHotspot = [...sourceBuckets].sort((a, b) => b.conversionRatePct - a.conversionRatePct)[0] || null;
    const atRiskPolicies = countBy(policyholders, isRiskPolicyholder);
    const policyRiskPct = toPct(atRiskPolicies, totalPolicyholders);
    const leadCoveragePct = toPct(prospectsWithActiveLeads, totalProspects);
    const periodLabel = startDate ? `${formatDate(startDate)} to ${formatDate(now)}` : "All available records";

    return res.json({
      filters: {
        datePreset,
        source,
        marketType,
        prospectType,
        status,
      },
      totals: {
        prospects: totalProspects,
        prospectsWithLeads: prospectsWithActiveLeads,
        prospectsWithActiveLeads,
        policyholders: totalPolicyholders,
        activePolicyholders: totalActivePolicyholders,
        engagements: totalActiveEngagements,
        leads: totalLeads,
        activeLeads,
      },
      leadStatusCounts: {
        new: newLeads,
        inProgress: inProgressLeads,
      },
      conversionRatePct: toPct(totalPolicyholders, totalProspects),
      warmRatePct: toPct(warm, totalProspects),
      sourceRatePct: toPct(agentSourced, totalProspects),
      activePolicyRatePct: toPct(totalActivePolicyholders, totalPolicyholders),
      prospectMix: { warm, cold, elite, ordinary, agentSourced, systemAssigned },
      prospectStatusCounts,
      policyStatusCounts,
      policyStatusCountsList,
      stageProgress,
      sourceConversion: sourceBuckets,
      marketConversion: marketBuckets,
      trendSeries: {
        prospects: prospectTrend,
        policyholders: policyholderTrend,
      },
      recentProspects,
      reportContext: {
        periodLabel,
        generatedAt: now,
      },
      insights: {
        topSource: conversionHotspot,
        leadCoverage: {
          prospectsWithLeads: prospectsWithActiveLeads,
          prospectsWithActiveLeads,
          prospectsWithoutLeads: Math.max(totalProspects - prospectsWithActiveLeads, 0),
          activeLeads,
          prospectsWithClosedLeadsAndActivePolicies: closedLeadProspectsWithActivePolicies.size,
          leadCoveragePct,
        },
        policyRiskPct,
        atRiskPolicies,
      },
    });
  } catch (err) {
    console.error("Clients relationship dashboard error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   SALES: PERFORMANCE DASHBOARD (Agent)
   Endpoint: GET /api/sales/performance?userId=...
=========================== */
app.get("/api/sales/performance", async (req, res) => {
  try {
    const {
      userId,
      datePreset = "ALL",
      leadSource = "ALL",
    } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();

    const buildSalesReportContext = () => {
      const presetMap = {
        "1d": [1, "This day"],
        "7d": [7, "Last 7 days"],
        "30d": [30, "Last 30 days"],
        "90d": [90, "Last 90 days"],
        "6m": [183, "Last 6 months"],
        "12m": [365, "Last 12 months"],
      };
      const preset = presetMap[String(datePreset || "ALL")];
      if (preset) {
        const [days, label] = preset;
        const start = new Date(now);
        if (String(datePreset) === "1d") start.setHours(0, 0, 0, 0);
        else start.setDate(start.getDate() - days);
        return { startDate: start, periodLabel: label };
      }
      return {
        startDate: null,
        periodLabel: "All available records",
      };
    };

    const reportContext = buildSalesReportContext();
    const defaultResponse = {
      filters: {
        datePreset: String(datePreset || "ALL"),
        leadSource: String(leadSource || "ALL"),
      },
      reportContext: {
        periodLabel: reportContext.periodLabel,
        startDate: reportContext.startDate,
        endDate: now,
        generatedAt: now,
      },
      totalLeads: 0,
      convertedLeads: 0,
      unconvertedLeads: 0,
      conversionRatePct: 0,
      totalPolicies: 0,
      activePolicyRatePct: 0,
      totalAnnualPremiumPhp: 0,
      totalFrequencyPremiumPhp: 0,
      averageAnnualPremiumPerConvertedLeadPhp: 0,
      averageFrequencyPremiumPerConvertedLeadPhp: 0,
      frequencyPremiumBreakdown: {
        monthlyPremiumPhp: 0,
        quarterlyPremiumPhp: 0,
        halfYearlyPremiumPhp: 0,
        yearlyPremiumPhp: 0,
      },
      activePolicies: 0,
      lapsedPolicies: 0,
      cancelledPolicies: 0,
      policyStatusBreakdown: [],
      leadStatusBreakdown: [],
      convertedLeadPolicyStatusBreakdown: [],
      unconvertedLeadStatusBreakdown: [],
      leadGap: 0,
      leadSourceBreakdown: [],
      monthlyConvertedLeads: [],
      salesRows: [],
    };

    const prospects = await Prospect.find({ assignedToUserId: userObjectId })
      .select("_id prospectCode firstName middleName lastName")
      .lean();
    const prospectIds = prospects.map((p) => p._id);

    if (!prospectIds.length) {
      return res.json(defaultResponse);
    }

    const leadQuery = { prospectId: { $in: prospectIds } };
    if (reportContext.startDate) {
      leadQuery.createdAt = { $gte: reportContext.startDate };
    }
    if (leadSource !== "ALL") {
      leadQuery.source = String(leadSource);
    }

    const leads = await Lead.find(leadQuery)
      .select("_id prospectId leadCode source otherSource status createdAt")
      .lean();
    const leadIds = leads.map((l) => l._id);

    if (!leadIds.length) {
      return res.json(defaultResponse);
    }

    const engagements = leadIds.length
      ? await LeadEngagement.find({ leadId: { $in: leadIds } }).select("_id leadId").lean()
      : [];
    const engagementIds = engagements.map((e) => e._id);

    const policyholders = engagementIds.length
      ? await Policyholder.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId status createdAt")
          .lean()
      : [];

    const applications = engagementIds.length
      ? await Application.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId recordPremiumPaymentTransfer")
          .lean()
      : [];

    const needsAssessments = engagementIds.length
      ? await NeedsAssessment.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId needsPriorities.productSelection.requestedFrequency")
          .lean()
      : [];

    const payments = engagementIds.length
      ? await Payment.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId annualPaymentId recordPremiumPaymentTransfer.totalPremiumPaidPhp recordPremiumPaymentTransfer.frequencyOfPremiumPayment recordPremiumPaymentTransfer.isMissedPaymentRecord createdAt")
          .lean()
      : [];

    const annualPayments = engagementIds.length
      ? await AnnualPayment.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId totalAnnualPremiumPhp frequencyOfPayment")
          .lean()
      : [];

    const scopedPolicyholders = policyholders;
    const reportingLeads = leads;
    const totalLeads = reportingLeads.length;

    const scopedApplications = applications;
    const scopedNeedsAssessments = needsAssessments;
    const scopedPayments = payments;
    const scopedAnnualPayments = annualPayments;

    const engagementIdToLeadId = new Map(engagements.map((engagement) => [String(engagement._id), String(engagement.leadId)]));
    const engagementToLead = new Map(engagements.map((e) => [String(e._id), String(e.leadId)]));
    const activePolicyholders = scopedPolicyholders.filter((p) => p.status === "Active");
    const activeEngagementIds = new Set(activePolicyholders.map((policyholder) => String(policyholder.leadEngagementId || "")));
    const activeLeadIds = new Set(activePolicyholders.map((policyholder) => engagementIdToLeadId.get(String(policyholder.leadEngagementId))).filter(Boolean));
    const activeLeadGapStatuses = new Set(["new", "in progress"]);

    const paymentById = new Map(scopedPayments.map((payment) => [String(payment?._id || ""), payment]).filter(([paymentId]) => paymentId));
    const engagementToPayment = new Map();
    for (const application of scopedApplications) {
      const engagementId = String(application?.leadEngagementId || "");
      if (!engagementId) continue;
      const applicationPaymentId = String(application?.recordPremiumPaymentTransfer?.paymentId || "");
      const applicationPayment = applicationPaymentId ? paymentById.get(applicationPaymentId) : null;
      if (applicationPayment) engagementToPayment.set(engagementId, applicationPayment);
    }
    for (const payment of scopedPayments) {
      const engagementId = String(payment?.leadEngagementId || "");
      if (!engagementId || engagementToPayment.has(engagementId)) continue;
      if (payment?.recordPremiumPaymentTransfer?.isMissedPaymentRecord === true) continue;
      engagementToPayment.set(engagementId, payment);
    }
    const engagementToAnnualPayment = new Map(
      scopedAnnualPayments.map((annualPayment) => [String(annualPayment?.leadEngagementId || ""), annualPayment]).filter(([engagementId]) => engagementId)
    );

    const engagementToFrequency = new Map(
      scopedNeedsAssessments.map((n) => [
        String(n.leadEngagementId),
        String(n?.needsPriorities?.productSelection?.requestedFrequency || "").trim(),
      ])
    );

    scopedAnnualPayments.forEach((annualPayment) => {
      const engagementId = String(annualPayment?.leadEngagementId || "");
      const finalFrequency = String(annualPayment?.frequencyOfPayment || "").trim();
      if (engagementId && finalFrequency) engagementToFrequency.set(engagementId, finalFrequency);
    });

    scopedPayments.forEach((payment) => {
      const engagementId = String(payment?.leadEngagementId || "");
      const finalFrequency = String(payment?.recordPremiumPaymentTransfer?.frequencyOfPremiumPayment || "").trim();
      if (engagementId && finalFrequency) engagementToFrequency.set(engagementId, finalFrequency);
    });

    const frequencyPremiumBreakdown = {
      monthlyPremiumPhp: 0,
      quarterlyPremiumPhp: 0,
      halfYearlyPremiumPhp: 0,
      yearlyPremiumPhp: 0,
    };

    const normalizeFrequencyKey = (frequencyValue) => {
      const normalized = String(frequencyValue || "").trim().toLowerCase();
      if (normalized === "monthly") return "monthlyPremiumPhp";
      if (normalized === "quarterly") return "quarterlyPremiumPhp";
      if (normalized === "half-yearly" || normalized === "half yearly" || normalized === "semi-annual" || normalized === "semi annual") {
        return "halfYearlyPremiumPhp";
      }
      if (normalized === "yearly" || normalized === "annual" || normalized === "annually") return "yearlyPremiumPhp";
      return null;
    };

    const activeScopedApplications = scopedApplications.filter((application) => activeEngagementIds.has(String(application?.leadEngagementId || "")));
    const activeScopedAnnualPayments = scopedAnnualPayments.filter((annualPayment) => activeEngagementIds.has(String(annualPayment?.leadEngagementId || "")));

    const totalAnnualPremiumPhp = activeScopedAnnualPayments.reduce(
      (sum, annualPayment) => sum + Number(annualPayment?.totalAnnualPremiumPhp || 0),
      0
    );
    const totalFrequencyPremiumPhp = activeScopedApplications.reduce((sum, application) => {
      const engagementId = String(application?.leadEngagementId || "");
      const payment = engagementToPayment.get(engagementId) || null;
      return sum + Number(
        payment?.recordPremiumPaymentTransfer?.totalPremiumPaidPhp
        ?? 0
      );
    }, 0);

    for (const appDoc of activeScopedApplications) {
      const engagementId = String(appDoc?.leadEngagementId || "");
      const payment = engagementToPayment.get(engagementId) || null;
      const premium = Number(
        payment?.recordPremiumPaymentTransfer?.totalPremiumPaidPhp
        ?? 0
      );
      const freq = engagementToFrequency.get(engagementId) || "";
      const frequencyKey = normalizeFrequencyKey(freq);

      if (frequencyKey) frequencyPremiumBreakdown[frequencyKey] += premium;
    }

    const policyStatusMap = new Map();
    for (const policyholder of scopedPolicyholders) {
      const status = String(policyholder?.status || "Unknown").trim() || "Unknown";
      policyStatusMap.set(status, (policyStatusMap.get(status) || 0) + 1);
    }
    const policyStatusBreakdown = [...policyStatusMap.entries()]
      .map(([label, count]) => ({ label, count, sharePct: scopedPolicyholders.length ? Math.round((count / scopedPolicyholders.length) * 100) : 0 }))
      .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
    const activePolicies = policyStatusMap.get("Active") || 0;
    const lapsedPolicies = policyStatusMap.get("Lapsed") || 0;
    const cancelledPolicies = policyStatusMap.get("Cancelled") || 0;
    const totalPolicies = scopedPolicyholders.length;

    const leadById = new Map(reportingLeads.map((lead) => [String(lead._id), lead]));
    const prospectById = new Map(prospects.map((prospect) => [String(prospect._id), prospect]));
    const normalizeLeadSourceLabel = (lead) => {
      const rawSource = String(lead?.source || "").trim();
      if (rawSource === "Other") return "Other";
      return rawSource || "Other";
    };

    const convertedLeadMomentsByEngagement = new Map();
    for (const policyholder of scopedPolicyholders) {
      const engagementId = String(policyholder?.leadEngagementId || "");
      if (!engagementId) continue;

      const createdAt = new Date(policyholder.createdAt);
      const existingMoment = convertedLeadMomentsByEngagement.get(engagementId);

      if (!existingMoment) {
        convertedLeadMomentsByEngagement.set(engagementId, createdAt);
        continue;
      }

      if (!Number.isNaN(createdAt.getTime()) && (Number.isNaN(existingMoment.getTime()) || createdAt < existingMoment)) {
        convertedLeadMomentsByEngagement.set(engagementId, createdAt);
      }
    }

    const convertedLeadIds = new Set([...convertedLeadMomentsByEngagement.keys()].map((engagementId) => engagementToLead.get(engagementId)).filter(Boolean));
    const convertedLeads = convertedLeadIds.size;
    const unconvertedLeads = reportingLeads.filter((lead) => !convertedLeadIds.has(String(lead._id))).length;
    const leadGap = reportingLeads.filter((lead) => activeLeadGapStatuses.has(String(lead?.status || "").trim().toLowerCase()) && !convertedLeadIds.has(String(lead._id))).length;
    const conversionRatePct = totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    const activePolicyRatePct = totalPolicies ? Math.round((activePolicies / totalPolicies) * 100) : 0;
    const activeConvertedLeadCount = activeLeadIds.size;
    const averageAnnualPremiumPerConvertedLeadPhp = activeConvertedLeadCount
      ? Number((totalAnnualPremiumPhp / activeConvertedLeadCount).toFixed(2))
      : 0;
    const averageFrequencyPremiumPerConvertedLeadPhp = activeConvertedLeadCount
      ? Number((totalFrequencyPremiumPhp / activeConvertedLeadCount).toFixed(2))
      : 0;

    const buildLeadStatusBreakdown = (items, total) => {
      const statusMap = new Map();
      for (const lead of items) {
        const status = String(lead?.status || "Unknown").trim() || "Unknown";
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      }
      return [...statusMap.entries()]
        .map(([label, count]) => ({ label, count, sharePct: total ? Math.round((count / total) * 100) : 0 }))
        .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
    };
    const leadStatusBreakdown = buildLeadStatusBreakdown(reportingLeads, totalLeads);
    const unconvertedLeadStatusBreakdown = buildLeadStatusBreakdown(reportingLeads.filter((lead) => !convertedLeadIds.has(String(lead._id))), unconvertedLeads);

    const leadSourceBreakdownMap = new Map();

    for (const lead of reportingLeads) {
      const bucket = normalizeLeadSourceLabel(lead);
      if (!leadSourceBreakdownMap.has(bucket)) {
        leadSourceBreakdownMap.set(bucket, {
          label: bucket,
          totalLeads: 0,
          convertedLeads: 0,
          convertedAndActiveLeads: 0,
          conversionRatePct: 0,
          activeConversionRatePct: 0,
        });
      }
      leadSourceBreakdownMap.get(bucket).totalLeads += 1;
    }

    for (const engagementId of convertedLeadMomentsByEngagement.keys()) {
      const leadId = engagementToLead.get(engagementId);
      const lead = leadId ? leadById.get(String(leadId)) : null;
      if (!lead) continue;
      const bucket = normalizeLeadSourceLabel(lead);
      if (!leadSourceBreakdownMap.has(bucket)) {
        leadSourceBreakdownMap.set(bucket, {
          label: bucket,
          totalLeads: 0,
          convertedLeads: 0,
          convertedAndActiveLeads: 0,
          conversionRatePct: 0,
          activeConversionRatePct: 0,
        });
      }
      leadSourceBreakdownMap.get(bucket).convertedLeads += 1;
      if (activeLeadIds.has(String(leadId))) leadSourceBreakdownMap.get(bucket).convertedAndActiveLeads += 1;
    }

    const leadSourceBreakdown = [...leadSourceBreakdownMap.values()]
      .map((sourceMetrics) => ({
        ...sourceMetrics,
        conversionRatePct: sourceMetrics.totalLeads
          ? Math.round((sourceMetrics.convertedLeads / sourceMetrics.totalLeads) * 100)
          : 0,
        activeConversionRatePct: sourceMetrics.totalLeads
          ? Math.round((sourceMetrics.convertedAndActiveLeads / sourceMetrics.totalLeads) * 100)
          : 0,
      }))
      .sort((a, b) => {
        if (b.convertedAndActiveLeads !== a.convertedAndActiveLeads) return b.convertedAndActiveLeads - a.convertedAndActiveLeads;
        if (b.convertedLeads !== a.convertedLeads) return b.convertedLeads - a.convertedLeads;
        if (b.totalLeads !== a.totalLeads) return b.totalLeads - a.totalLeads;
        return a.label.localeCompare(b.label);
      });

    for (const sourceMetrics of leadSourceBreakdown) {
      sourceMetrics.conversionRatePct = sourceMetrics.totalLeads
        ? Math.round((sourceMetrics.convertedLeads / sourceMetrics.totalLeads) * 100)
        : 0;
      sourceMetrics.activeConversionRatePct = sourceMetrics.totalLeads
        ? Math.round((sourceMetrics.convertedAndActiveLeads / sourceMetrics.totalLeads) * 100)
        : 0;
    }

    const getTrendBucket = (dateValue) => {
      const dt = new Date(dateValue);
      if (Number.isNaN(dt.getTime())) return null;
      if (String(datePreset) === "1d") return { key: String(dt.getUTCHours()).padStart(2, "0"), label: `${String(dt.getUTCHours()).padStart(2, "0")}:00` };
      if (String(datePreset) === "7d") return { key: String(dt.getUTCDay()), label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()] };
      if (String(datePreset) === "30d" || String(datePreset) === "90d") {
        const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
        return { key, label: key.slice(5) };
      }
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      return { key, label: key };
    };
    const trendMap = new Map();
    for (const conversionDate of convertedLeadMomentsByEngagement.values()) {
      const bucket = getTrendBucket(conversionDate);
      if (!bucket) continue;
      if (!trendMap.has(bucket.key)) trendMap.set(bucket.key, { ...bucket, month: bucket.key, converted: 0 });
      trendMap.get(bucket.key).converted += 1;
    }
    const monthlyConvertedLeads = [...trendMap.values()].sort((a, b) => a.key.localeCompare(b.key));

    const leadIdToPolicyholders = new Map();
    for (const policyholder of scopedPolicyholders) {
      const leadId = engagementToLead.get(String(policyholder.leadEngagementId));
      if (!leadId) continue;
      const key = String(leadId);
      if (!leadIdToPolicyholders.has(key)) {
        leadIdToPolicyholders.set(key, []);
      }
      leadIdToPolicyholders.get(key).push(policyholder);
    }

    const leadIdToApplication = new Map(
      scopedApplications.map((application) => {
        const leadId = engagementToLead.get(String(application.leadEngagementId));
        return [String(leadId || ""), application];
      }).filter(([leadId]) => leadId)
    );
    const leadIdToNeedsAssessment = new Map(
      scopedNeedsAssessments.map((needsAssessment) => {
        const leadId = engagementToLead.get(String(needsAssessment.leadEngagementId));
        return [String(leadId || ""), needsAssessment];
      }).filter(([leadId]) => leadId)
    );
    const leadIdToPayment = new Map(
      [...engagementToPayment.entries()].map(([engagementId, payment]) => {
        const leadId = engagementToLead.get(String(engagementId));
        return [String(leadId || ""), payment];
      }).filter(([leadId]) => leadId)
    );
    const leadIdToAnnualPayment = new Map(
      scopedAnnualPayments.map((annualPayment) => {
        const leadId = engagementToLead.get(String(annualPayment.leadEngagementId));
        return [String(leadId || ""), annualPayment];
      }).filter(([leadId]) => leadId)
    );

    const convertedLeadPolicyStatusMap = new Map();
    for (const leadId of convertedLeadIds) {
      const relatedPolicies = [...(leadIdToPolicyholders.get(String(leadId)) || [])].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      const status = String(relatedPolicies[0]?.status || "Unknown").trim() || "Unknown";
      convertedLeadPolicyStatusMap.set(status, (convertedLeadPolicyStatusMap.get(status) || 0) + 1);
    }
    const convertedLeadPolicyStatusBreakdown = [...convertedLeadPolicyStatusMap.entries()]
      .map(([label, count]) => ({ label, count, sharePct: convertedLeads ? Math.round((count / convertedLeads) * 100) : 0 }))
      .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));

    const salesRows = reportingLeads
      .filter((lead) => convertedLeadIds.has(String(lead._id)))
      .map((lead) => {
        const leadKey = String(lead._id);
        const prospect = prospectById.get(String(lead.prospectId));
        const relatedPolicies = [...(leadIdToPolicyholders.get(leadKey) || [])].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        const latestPolicy = relatedPolicies[0] || null;
        const application = leadIdToApplication.get(leadKey) || null;
        const needsAssessment = leadIdToNeedsAssessment.get(leadKey) || null;
        const payment = leadIdToPayment.get(leadKey) || null;
        const annualPayment = leadIdToAnnualPayment.get(leadKey) || null;
        const fullName = [prospect?.firstName, prospect?.middleName, prospect?.lastName].filter(Boolean).join(" ").trim() || "—";
        const requestedFrequency = String(
          payment?.recordPremiumPaymentTransfer?.frequencyOfPremiumPayment
          || application?.recordPremiumPaymentTransfer?.frequencyOfPremiumPayment
          || needsAssessment?.needsPriorities?.productSelection?.requestedFrequency
          || ""
        ).trim() || "—";
        const frequencyPremiumPhp = Number(
          payment?.recordPremiumPaymentTransfer?.totalPremiumPaidPhp
          ?? application?.recordPremiumPaymentTransfer?.totalFrequencyPremiumPhp
          ?? 0
        );

        return {
          leadCode: lead.leadCode || "—",
          prospectCode: prospect?.prospectCode || "—",
          prospectName: fullName,
          leadSource: normalizeLeadSourceLabel(lead),
          leadStatus: String(lead.status || "—"),
          leadCreatedAt: lead.createdAt || null,
          policies: relatedPolicies.length,
          policyStatus: latestPolicy?.status || "—",
          convertedAt: latestPolicy?.createdAt || null,
          requestedFrequency,
          annualPremiumPhp: Number(annualPayment?.totalAnnualPremiumPhp || application?.recordPremiumPaymentTransfer?.totalAnnualPremiumPhp || 0),
          frequencyPremiumPhp,
        };
      })
      .sort((a, b) => {
        const left = new Date(b.convertedAt || b.leadCreatedAt || 0).getTime();
        const right = new Date(a.convertedAt || a.leadCreatedAt || 0).getTime();
        if (left !== right) return left - right;
        return String(a.leadCode).localeCompare(String(b.leadCode));
      });

    return res.json({
      ...defaultResponse,
      totalLeads,
      convertedLeads,
      unconvertedLeads,
      conversionRatePct,
      totalPolicies,
      activePolicyRatePct,
      totalAnnualPremiumPhp,
      totalFrequencyPremiumPhp,
      averageAnnualPremiumPerConvertedLeadPhp,
      averageFrequencyPremiumPerConvertedLeadPhp,
      frequencyPremiumBreakdown,
      activePolicies,
      lapsedPolicies,
      cancelledPolicies,
      policyStatusBreakdown,
      leadStatusBreakdown,
      convertedLeadPolicyStatusBreakdown,
      unconvertedLeadStatusBreakdown,
      leadGap,
      leadSourceBreakdown,
      monthlyConvertedLeads,
      salesRows,
    });
  } catch (err) {
    console.error("Sales performance error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   POLICYHOLDERS: ALL (Agent, paginated)
   Endpoint: GET /api/policyholders
=========================== */
app.get("/api/policyholders", async (req, res) => {
  try {
    const {
      userId,
      page = 1,
      limit = 10,
      q = "",
      productName = "",
      status = "",
      sort = "policyholderNoAsc",
    } = req.query;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    await syncPolicyholderPaymentDatesForUser(userObjectId);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (pageNum - 1) * pageSize;

    const searchMatch = buildPolicyholderSearchMatch(q);

    const filterAnd = [];
    if (String(productName || "").trim()) {
      filterAnd.push({ "product.productName": String(productName).trim() });
    }
    if (String(status || "").trim()) {
      filterAnd.push({ status: String(status).trim() });
    }
    const filterMatch = filterAnd.length ? { $and: filterAnd } : null;

    const sortMap = {
      policyholderNoAsc: { policyholderNo: 1 },
      policyholderNoDesc: { policyholderNo: -1 },
      policyholderCodeAsc: { policyholderCode: 1 },
      policyholderCodeDesc: { policyholderCode: -1 },
      lastNameAsc: { "prospect.lastName": 1, "prospect.firstName": 1 },
      lastNameDesc: { "prospect.lastName": -1, "prospect.firstName": 1 },
      ageAsc: { "prospect.age": 1, policyholderCode: 1 },
      ageDesc: { "prospect.age": -1, policyholderCode: 1 },
      lastPaidDateAsc: { lastPaidDate: 1, policyholderCode: 1 },
      lastPaidDateDesc: { lastPaidDate: -1, policyholderCode: 1 },
      nextPaymentDateAsc: { nextPaymentDate: 1, policyholderCode: 1 },
      nextPaymentDateDesc: { nextPaymentDate: -1, policyholderCode: 1 },
      dateCreatedAsc: { createdAt: 1, _id: 1 },
      dateCreatedDesc: { createdAt: -1, _id: -1 },
    };
    const sortStage = sortMap[String(sort)] || sortMap.policyholderNoAsc;

    const basePipeline = [
      {
        $lookup: {
          from: "leadengagements",
          localField: "leadEngagementId",
          foreignField: "_id",
          as: "leadEngagement",
        },
      },
      { $unwind: "$leadEngagement" },
      {
        $lookup: {
          from: "leads",
          localField: "leadEngagement.leadId",
          foreignField: "_id",
          as: "lead",
        },
      },
      { $unwind: "$lead" },
      {
        $lookup: {
          from: "prospects",
          localField: "lead.prospectId",
          foreignField: "_id",
          as: "prospect",
        },
      },
      { $unwind: "$prospect" },
      { $match: { "prospect.assignedToUserId": userObjectId } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $addFields: { assignedToUserId: "$prospect.assignedToUserId" } },
      {
        $setWindowFields: {
          partitionBy: "$assignedToUserId",
          sortBy: { policyholderCode: 1 },
          output: { policyholderNo: { $documentNumber: {} } },
        },
      },
      ...(filterMatch ? [{ $match: filterMatch }] : []),
      ...(searchMatch ? [{ $match: searchMatch }] : []),
    ];

    const countAgg = await Policyholder.aggregate([
      ...basePipeline,
      { $count: "count" },
    ]);
    const totalForThisUser = Number(countAgg?.[0]?.count || 0);

    const productNamesForFilter = await Policyholder.aggregate([
      {
        $lookup: {
          from: "leadengagements",
          localField: "leadEngagementId",
          foreignField: "_id",
          as: "leadEngagement",
        },
      },
      { $unwind: "$leadEngagement" },
      {
        $lookup: {
          from: "leads",
          localField: "leadEngagement.leadId",
          foreignField: "_id",
          as: "lead",
        },
      },
      { $unwind: "$lead" },
      {
        $lookup: {
          from: "prospects",
          localField: "lead.prospectId",
          foreignField: "_id",
          as: "prospect",
        },
      },
      { $unwind: "$prospect" },
      { $match: { "prospect.assignedToUserId": userObjectId } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$product.productName",
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          name: "$_id",
        },
      },
    ]).collation({ locale: "en", strength: 2 });

    const policyholders = await Policyholder.aggregate([
      ...basePipeline,
      { $sort: sortStage },
      { $skip: skip },
      { $limit: pageSize },
      {
        $project: {
          _id: 1,
          leadEngagementId: 1,
          policyholderNo: 1,
          policyholderCode: 1,
          policyNumber: 1,
          status: 1,
          lastPaidDate: 1,
          nextPaymentDate: 1,
          createdAt: 1,
          leadId: "$lead._id",
          prospectId: "$prospect._id",
          firstName: "$prospect.firstName",
          lastName: "$prospect.lastName",
          age: "$prospect.age",
          productName: "$product.productName",
        },
      },
    ]).collation({ locale: "en", strength: 2 });

    return res.json({
      page: pageNum,
      limit: pageSize,
      totalForThisUser,
      totalPages: Math.max(1, Math.ceil(totalForThisUser / pageSize)),
      policyholders,
      productNames: productNamesForFilter.map((x) => String(x?.name || "").trim()).filter(Boolean),
      sortUsed: String(sort),
    });
  } catch (err) {
    console.error("All policyholders error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});


/**
 * ACTIVITY_BY_STAGE
 * -----------------
 * Defines the allowed activity keys per engagement stage.
 *
 * Current scope:
 * - Only "Contacting" stage has a defined activity catalog.
 * - Other stages are planned but not enforced yet (commented out).
 *
 * Used by:
 * - Validation helpers to ensure activityKey is consistent with currentStage.
 */
const ACTIVITY_BY_STAGE = {
  Contacting: [
    "Attempt Contact",
    "Validate Contact",
    "Wrong Contact",
    "Assess Interest",
    "Schedule Meeting",
  ],
  Proposal: [
    "Generate Proposal",
    "Record Prospect Attendance",
    "Present Proposal",
    "Schedule Application Submission",
  ],
  "Policy Issuance": [
    "Upload Initial Premium eOR",
    "Record Policy Application Status",
    "Upload Policy Summary",
    "Record Coverage Duration Details",
  ],
  // later:
  // "Needs Assessment": [...],
  // ...
};

/**
 * isValidActivityForStage(stage, activityKey)
 * ------------------------------------------
 * Validates whether the given activityKey is allowed under the specified stage.
 *
 * Rules implemented:
 * 1) If activityKey is null/empty → valid
 *    - Allows LeadEngagement.currentActivityKey to be null (e.g., Not Started).
 * 2) If stage has no defined catalog yet → valid (temporary behavior)
 *    - This prevents blocking future stages until catalogs are implemented.
 * 3) Otherwise → activityKey must be included in ACTIVITY_BY_STAGE[stage]
 *
 * Returns:
 * - true if valid under current rule set
 * - false if stage has a catalog and activityKey is not allowed
 */
/**
 * isValidActivityForStage(stage, activityKey)
 * ------------------------------------------
 * Validates that a currentActivityKey is allowed for the supplied pipeline stage.
 */
function isValidActivityForStage(stage, activityKey) {
  if (!activityKey) return true; 
  const allowed = ACTIVITY_BY_STAGE[String(stage || "")] || null;
  if (!allowed) return true; 
  return allowed.includes(activityKey);
}

/* ===========================
   PROSPECTS: ALL (Agent, paginated)
   Endpoint: GET /api/prospects

   Query parameters:
   - userId (required)
   - page, limit (pagination)
   - q (search string)
   - marketType, prospectType, source, status (filters)
   - sort (controls ordering)

   Key guarantees / design rules:
   - prospectNo is stable across FULL agent list:
     computed by prospectCode ASC before any filtering/searching.
   - Filters/search are applied AFTER prospectNo numbering so numbering stays consistent.
   - Sorting supports multiple keys; some require lookup fields (leadsInProgress).
=========================== */
app.get("/api/prospects", async (req, res) => {
  try {
    const {
      userId,
      page = 1,
      limit = 10,
      q = "",
      marketType = "",
      prospectType = "",
      source = "",
      status = "",
      sort = "prospectCodeAsc",
    } = req.query;

    /**
     * Input validation:
     * - userId must exist and be a valid ObjectId
     */
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    /**
     * Pagination normalization:
     * - page >= 1
     * - limit clamped to 1..50 (prevents expensive queries)
     * - skip computed for aggregation
     */
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const skip = (pageNum - 1) * pageSize;

    /**
     * Search match:
     * - Uses buildProspectSearchMatch() to generate a safe regex-based match object
     * - Returns null if q is empty
     */
    const searchMatch = buildProspectSearchMatch(q);

    /**
     * Filters:
     * - Only include filters that are provided
     * - Combined using $and to require all selected filters
     */
    const filterAnd = [];
    if (marketType) filterAnd.push({ marketType });
    if (prospectType) filterAnd.push({ prospectType });
    if (source) filterAnd.push({ source });
    if (status) filterAnd.push({ status });
    const filterMatch = filterAnd.length ? { $and: filterAnd } : null;

    /**
     * Count query:
     * The count should reflect the same filtering/search as the list.
     *
     * Base requirement:
     * - assignedToUserId must match the agent
     *
     * Then optionally add:
     * - filterMatch
     * - searchMatch
     */
    let finalCountQuery = { assignedToUserId: userObjectId };
    const countAnd = [];
    if (filterMatch) countAnd.push(filterMatch);
    if (searchMatch) countAnd.push(searchMatch);
    if (countAnd.length) finalCountQuery = { $and: [finalCountQuery, ...countAnd] };

    const totalForThisUser = await Prospect.countDocuments(finalCountQuery);

    /**
     * Sorting:
     * map UI-friendly sort keys → MongoDB sort objects
     *
     * Notes:
     * - Some sorts include tie-breakers (e.g., prospectCode) for stability.
     * - leadsInProgress sorts require lookup computation first.
     */
    const sortMap = {
      prospectNoAsc: { prospectNo: 1 },
      prospectNoDesc: { prospectNo: -1 },

      prospectCodeAsc: { prospectCode: 1 },
      prospectCodeDesc: { prospectCode: -1 },

      lastNameAsc: { lastName: 1, firstName: 1 },
      lastNameDesc: { lastName: -1, firstName: 1 },

      ageAsc: { age: 1, prospectCode: 1 },
      ageDesc: { age: -1, prospectCode: 1 },

      // needs lookup first
      leadsInProgressAsc: { leadsInProgress: 1, prospectCode: 1 },
      leadsInProgressDesc: { leadsInProgress: -1, prospectCode: 1 },

      dateCreatedAsc: { createdAt: 1, _id: 1, prospectCode: 1 },
      dateCreatedDesc: { createdAt: -1, _id: -1, prospectCode: 1 },
    };

    const sortStage = sortMap[String(sort)] || sortMap.prospectCodeAsc;

    // Sorting by leadsInProgress requires computing leadsInProgress BEFORE sorting.
    const needsLeadSort =
      sort === "leadsInProgressAsc" || sort === "leadsInProgressDesc";

    /**
     * Aggregation pipeline base:
     * 1) Restrict to agent's prospects
     * 2) Compute stable prospectNo (rank by prospectCode ASC, partitioned by agent)
     * 3) Apply filters/search AFTER numbering so prospectNo stays stable across all views
     */
    const pipeline = [
      { $match: { assignedToUserId: userObjectId } },

      // Stable prospectNo across FULL agent list (not affected by filters/search)
      {
        $setWindowFields: {
          partitionBy: "$assignedToUserId",
          sortBy: { prospectCode: 1 },
          output: { prospectNo: { $documentNumber: {} } },
        },
      },

      // apply filters/search AFTER numbering (so prospectNo stays stable)
      ...(filterMatch ? [{ $match: filterMatch }] : []),
      ...(searchMatch ? [{ $match: searchMatch }] : []),
    ];

    /**
     * leadsLookupStages
     * -----------------
     * Shared stages to compute leadsInProgress:
     * - Looks up "In Progress" leads for each prospect
     * - Converts the lookup result to a numeric field leadsInProgress
     * - Removes temporary fields from output
     */
    const leadsLookupStages = [
      {
        $lookup: {
          from: "leads",
          let: { pid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$prospectId", "$$pid"] },
                status: "In Progress",
              },
            },
            { $count: "count" },
          ],
          as: "inProgressLeads",
        },
      },
      {
        $addFields: {
          leadsInProgress: {
            $ifNull: [{ $arrayElemAt: ["$inProgressLeads.count", 0] }, 0],
          },
        },
      },
      { $project: { inProgressLeads: 0, __v: 0, updatedAt: 0 } },
    ];

    /**
     * Pipeline ordering decision:
     *
     * - If sorting by leadsInProgress:
     *   must compute leadsInProgress BEFORE sort/skip/limit so ordering is correct.
     *
     * - For all other sorts:
     *   perform sort/skip/limit first, THEN compute leadsInProgress
     *   (faster because lookup runs on smaller page-sized dataset).
     */
    if (needsLeadSort) {
      pipeline.push(...leadsLookupStages);
      pipeline.push({ $sort: sortStage });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: pageSize });
    } else {
      // Normal sorts can sort/paginate first, then lookup leads (faster)
      pipeline.push({ $sort: sortStage });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: pageSize });
      pipeline.push(...leadsLookupStages);
    }

    /**
     * collation:
     * - locale "en" + strength 2 makes sorting case-insensitive
     * - helps consistent sorting for names and codes
     */
    const prospects = await Prospect.aggregate(pipeline).collation({
      locale: "en",
      strength: 2, 
    });

    /**
     * Response payload includes pagination metadata and the current sortUsed
     */
    return res.json({
      page: pageNum,
      limit: pageSize,
      totalForThisUser,
      totalPages: Math.max(1, Math.ceil(totalForThisUser / pageSize)),
      prospects,
      sortUsed: String(sort),
    });
  } catch (err) {
    console.error("All prospects error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   PROSPECTS: CREATE (Agent)
   Endpoint: POST /api/prospects

   Purpose:
   - Creates a new Prospect assigned to a specific agent (userId).
   - Enforces input validation, uniqueness (phone per agent), and age rules.
   - Generates a global prospectCode (P-000001 format) using generateNextProspectCode().

   Notes:
   - source and status are locked server-side to prevent UI tampering.
   - phoneNumber is normalized to digits-only and validated to PH local format.
=========================== */
app.post("/api/prospects", async (req, res) => {
  try {
    const {
      userId,
      firstName,
      middleName = "",
      lastName,
      phoneNumber,
      email = "",
      sex,
      birthday,
      age,
      marketType,
      prospectType,
    } = req.body;

    /**
     * Validate required identity field for ownership/scoping.
     * - userId must exist and must be a valid ObjectId.
     */
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    /**
     * Required text fields:
     * - firstName, lastName must be non-empty after trimming.
     */
    if (!String(firstName || "").trim()) {
      return res.status(400).json({ message: "First name is required." });
    }
    if (!String(lastName || "").trim()) {
      return res.status(400).json({ message: "Last name is required." });
    }

    /**
     * Required enum-like input:
     * - marketType must be "Warm" or "Cold".
     */
    if (!marketType || !["Warm", "Cold"].includes(marketType)) {
      return res.status(400).json({ message: "Market type is required." });
    }

    /**
     * Phone validation:
     * - Normalize to digits-only (removes spaces, dashes, etc.)
     * - Enforce PH local format: 10 digits starting with 9
     *
     * Example valid: 9123456789
     */
    const phone = onlyDigits(phoneNumber);
    if (!phone) return res.status(400).json({ message: "Phone number is required." });
    if (!/^9\d{9}$/.test(phone)) {
      return res.status(400).json({
        message: "Phone must be 10 digits (PH local) and start with 9 (e.g., 9123456789).",
      });
    }

    /**
     * Duplicate phone check (per agent):
     * - Prevents the same agent from creating multiple prospects with same phoneNumber.
     * - Note: Prospect schema also has a unique compound index for this,
     *   but this check gives a cleaner error message before insert.
     */
    const existing = await Prospect.findOne({
      assignedToUserId: new mongoose.Types.ObjectId(userId),
      phoneNumber: phone,
    }).lean();

    if (existing) {
      return res.status(409).json({
        message: "A prospect with this phone number already exists.",
        field: "phoneNumber",
      });
    }

    /**
     * Email validation (optional):
     * - Normalizes to trimmed lowercase string
     * - Allows empty string
     * - Uses isValidEmail() helper to validate format if provided
     */
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    /**
     * prospectType validation (optional):
     * - Must be "Elite" or "Ordinary" if provided.
     */
    if (prospectType && !["Elite", "Ordinary"].includes(prospectType)) {
      return res.status(400).json({ message: "Invalid prospect type." });
    }

    /**
     * sex validation (optional):
     * - Must be "Male" or "Female" if provided.
     */
    if (sex && !["Male", "Female"].includes(sex)) {
      return res.status(400).json({ message: "Invalid sex." });
    }

    /**
     * Age/Birthday validation:
     * - Prospect must be between 18 and 70.
     * - If birthday is provided, birthday is the source of truth ("birthday wins").
     * - If no birthday but age is provided, validate age range directly.
     *
     * Additional rule:
     * - Birthday cannot be in the future (date-only timezone-safe comparison).
     */
    let finalBirthday = undefined;
    let finalAge = undefined;

    const hasBirthday = String(birthday || "").trim() !== "";
    const hasAge = String(age || "").trim() !== "";

    if (hasBirthday) {
      const b = new Date(birthday);
      if (isNaN(b.getTime())) {
        return res.status(400).json({ message: "Invalid birthday." });
      }

      // timezone-safe future check
      if (isFutureDateOnly(b)) {
        return res.status(400).json({ message: "Birthday cannot be in the future." });
      }

      const computedAge = computeAgeFromBirthday(b);
      if (computedAge === null) {
        return res.status(400).json({ message: "Invalid birthday." });
      }

      if (computedAge < 18 || computedAge > 70) {
        return res.status(400).json({
          message: "Prospect must be between 18 and 70 years old (based on birthday).",
        });
      }

      finalBirthday = b;
      finalAge = computedAge; // birthday wins
    } else if (hasAge) {
      const inputAge = Number(age);
      if (!Number.isFinite(inputAge)) {
        return res.status(400).json({ message: "Invalid age." });
      }
      if (inputAge < 18 || inputAge > 70) {
        return res.status(400).json({
          message: "Prospect must be between 18 and 70 years old (based on age).",
        });
      }
      finalAge = inputAge;
    }

    /**
     * Locked defaults (server-owned fields):
     * - source is forced to "Agent-Sourced" for this endpoint
     * - status starts as "Active"
     *
     * These are not accepted from client to prevent tampering.
     */
    const source = "Agent-Sourced";
    const status = "Active";

    /**
     * prospectCode generation:
     * - Uses helper that finds last code and increments.
     * - Format: P-000001
     */
    const prospectCode = await generateNextProspectCode();

    /**
     * Create the Prospect record.
     * Note:
     * - assignedToUserId is stored as ObjectId
     * - optional fields use undefined when absent (so they don't store empty strings)
     */
    const created = await Prospect.create({
      assignedToUserId: new mongoose.Types.ObjectId(userId),
      prospectCode,

      firstName: String(firstName).trim(),
      middleName: String(middleName || "").trim(),
      lastName: String(lastName).trim(),

      phoneNumber: phone,
      email: cleanEmail,

      sex: sex || undefined,
      birthday: finalBirthday,
      age: finalAge,

      marketType,
      prospectType: prospectType || undefined,

      source,
      status,
    });

    return res.status(201).json({
      message: "Prospect created",
      prospect: created,
    });
  } catch (err) {
    /**
     * Duplicate key handling:
     * If a race condition occurs between the manual duplicate check
     * and insert, MongoDB unique index may still throw E11000.
     */
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "Duplicate record detected. Phone number already exists.",
        field: "phoneNumber",
      });
    }

    console.error("Create prospect error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   PROSPECT DETAILS (Agent)
   Endpoint:
   GET /api/prospects/:prospectId/details?userId=...

   Purpose:
   - Returns a single prospect owned by an agent, including:
     - stable prospectNo (rank by prospectCode ASC, partitioned by agent)
     - list of leads under the prospect
     - totals (totalLeads, leadsInProgress)
     - banner flag: whether an Open UPDATE_CONTACT_INFO task exists

   Access control:
   - Ensures prospect belongs to the requesting agent (assignedToUserId match).
=========================== */
app.get("/api/prospects/:prospectId/details", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId } = req.params;

    /**
     * Validate request identifiers:
     * - userId required and must be valid ObjectId
     * - prospectId must be valid ObjectId
     */
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }
    if (!mongoose.isValidObjectId(prospectId)) {
      return res.status(400).json({ message: "Invalid prospectId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);

    /**
     * Aggregation pipeline:
     * 1) Restrict to the agent's prospects (authorization)
     * 2) Compute stable prospectNo across agent list (by prospectCode ASC)
     * 3) Filter to requested prospectId
     * 4) Lookup leads belonging to this prospect
     * 5) Lookup open UPDATE_CONTACT_INFO tasks to compute banner flag
     * 6) Add derived fields (lead counts, in-progress counts, banner flag)
     * 7) Remove internal fields
     */
    const agg = await Prospect.aggregate([
      // Step 1: authorization scope (only this agent's prospects)
      { $match: { assignedToUserId: userObjectId } },

      // Step 2: compute stable prospectNo across FULL agent list
      {
        $setWindowFields: {
          partitionBy: "$assignedToUserId",
          sortBy: { prospectCode: 1 },
          output: { prospectNo: { $documentNumber: {} } },
        },
      },
      // Step 3: filter to the requested prospect
      { $match: { _id: prospectObjectId } },

      /**
       * Step 4: Lookup Leads under this prospect
       * - Sorted newest first
       * - Only returns selected lead fields for UI
       */
      {
        $lookup: {
          from: "leads",
          let: { pid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$prospectId", "$$pid"] } } },
            { $sort: { createdAt: -1, _id: -1 } },
            {
              $project: {
                _id: 1,
                leadCode: 1,
                status: 1,
                notes: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          as: "leads",
        },
      },

      /**
       * Step 5: Lookup open UPDATE_CONTACT_INFO tasks
       * - Used only to compute a boolean banner flag for UI.
       * - We limit to 1 for performance since we only care if it exists.
       */
      {
        $lookup: {
          from: "tasks",
          let: { pid: "$_id", uid: "$assignedToUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$prospectId", "$$pid"] },
                    { $eq: ["$assignedToUserId", "$$uid"] },
                    { $eq: ["$type", "UPDATE_CONTACT_INFO"] },
                    { $eq: ["$status", "Open"] }, // only open tasks matter for banner
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: "openUpdateContactTasks",
        },
      },

      /**
       * Step 6: Derived fields for UI
       * - totalLeads: total number of lead documents
       * - leadsInProgress: count of leads with status "In Progress"
       * - hasOpenUpdateContactInfoTask: boolean banner flag
       */
      {
        $addFields: {
          totalLeads: { $size: "$leads" },
          leadsInProgress: {
            $size: {
              $filter: {
                input: "$leads",
                as: "l",
                cond: { $eq: ["$$l.status", "In Progress"] },
              },
            },
          },
          hasOpenUpdateContactInfoTask: { $gt: [{ $size: "$openUpdateContactTasks" }, 0] },
        },
      },

      /**
       * Step 7: Remove internal fields
       * - openUpdateContactTasks removed because it is only helper data
       */
      {
        $project: {
          __v: 0,
          updatedAt: 0,
          openUpdateContactTasks: 0,
        },
      },
    ]);

    // If no results, prospect is not found OR not owned by this agent
    if (!agg.length) {
      return res.status(404).json({ message: "Prospect not found." });
    }

    const unavailablePriorityCategories = await getNonCancelledPolicyPriorityCategoriesForProspect(prospectObjectId, userObjectId);

    return res.json({
      prospect: {
        ...agg[0],
        unavailablePriorityCategories,
        canCreateLead: unavailablePriorityCategories.length < NEEDS_PRIORITY_CATEGORIES.length,
      },
    });
  } catch (err) {
    console.error("Prospect details error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * PROSPECTS: NEXT NUMBER (Agent)
 * GET /api/prospects/next-no?userId=...
 *
 * Purpose:
 * - Returns the next agent-specific "prospectNo" (1-based) for UI display
 *   (e.g., when showing "Prospect #12").
 *
 * Important:
 * - This is NOT the same as prospectCode (P-000123).
 * - prospectNo is computed as (count of prospects owned by agent) + 1.
 */
app.get("/api/prospects/next-no", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;

    // Validate required scope parameter
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Validate required scope parameter
    const count = await Prospect.countDocuments({ assignedToUserId: userObjectId });

    // Next number is 1-based
    const nextProspectNo = count + 1;

    return res.json({ nextProspectNo });
  } catch (err) {
    console.error("Next prospect no error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   PROSPECTS: VIEW FULL (Agent)
   GET /api/prospects/:prospectId/full?userId=...

   Purpose:
   - Returns full prospect record for editing/viewing.
   - Includes stable agent-specific prospectNo computed by prospectCode ASC.
   - Additionally attaches leads for this prospect (minimal fields) as:
       prospect.leads
     (Used by frontend for display and for "drop blocking" checks.)
=========================== */
app.get("/api/prospects/:prospectId/full", async (req, res) => {
  try {
    const { prospectId } = req.params;
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;

    // Validate identifiers
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }
    if (!mongoose.isValidObjectId(prospectId)) {
      return res.status(400).json({ message: "Invalid prospectId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);

    /**
     * Aggregation:
     * 1) Authorize by restricting to agent-owned prospects
     * 2) Compute stable prospectNo across the agent’s entire prospect list
     * 3) Match the requested prospect
     * 4) Remove internal __v
     */
    const agg = await Prospect.aggregate([
      { $match: { assignedToUserId: userObjectId } },
      {
        $setWindowFields: {
          partitionBy: "$assignedToUserId",
          sortBy: { prospectCode: 1 },
          output: { prospectNo: { $documentNumber: {} } },
        },
      },
      { $match: { _id: prospectObjectId } },
      { $project: { __v: 0 } },
    ]);

    const prospect = agg[0];
    if (!prospect) {
      return res.status(404).json({ message: "Prospect not found." });
    }

    /**
     * Attach leads (minimal):
     * - Used by frontend for UI and preventing invalid "drop" actions.
     * - Sorted newest-first.
     */
    const leads = await Lead.find({ prospectId: prospectObjectId })
      .select("_id leadCode status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // Attach to match frontend expectation: prospect.leads
    prospect.leads = leads;

    return res.json({ prospect });
  } catch (err) {
    console.error("View prospect error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});


/* ===========================
   PROSPECTS: UPDATE (Agent)
   PUT /api/prospects/:prospectId?userId=...

   Purpose:
   - Updates editable prospect fields (names, contact info, demographics, tags).
   - Enforces strict status transitions (only Drop/Re-open allowed).
   - Enforces validation on phone/email and age rules (18–70).
   - Does NOT clear optional fields unless explicitly provided in request body.
   - Supports dropping with required reason/notes + blocks dropping if active leads exist.
   - If phone changes AND an Open UPDATE_CONTACT_INFO task exists:
       * engagement is unblocked
       * UPDATE_CONTACT_INFO task is completed
       * engagement contact version is advanced
       * a new APPROACH task is created (6PM cutoff rule)
       * notifications are created (TASK_ADDED + optional TASK_DUE_TODAY)
   - Uses MongoDB transaction to keep multi-document updates consistent.
=========================== */
app.put("/api/prospects/:prospectId", async (req, res) => {

  // Use a session so updates across Prospect/Task/LeadEngagement/Notification are atomic
  const session = await mongoose.startSession();

  try {
    const { prospectId } = req.params;
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;

    // Validate identifiers
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }
    if (!mongoose.isValidObjectId(prospectId)) {
      return res.status(400).json({ message: "Invalid prospectId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    let saved = null;

    let appointmentTaskIdForNotif = null;
    await session.withTransaction(async () => {
      /**
       * Authorization + fetch:
       * Only allow updating prospects owned by this agent.
       */
      const existing = await Prospect.findOne({
        _id: prospectId,
        assignedToUserId: userObjectId,
      }).session(session);

      if (!existing) {
        // Throwing lets the catch handler return the correct status.
        throw Object.assign(new Error("Prospect not found."), { status: 404 });
      }

      // Keep old phone to detect contact change behavior
      const oldPhone = existing.phoneNumber;

      /**
       * Extract request fields.
       * Note:
       * - Some fields are optional and should not be cleared unless explicitly present.
       * - status is controlled (only Drop/Re-open).
       */
      const {
        firstName,
        middleName,
        lastName,
        phoneNumber,
        email,
        sex,
        civilStatus,
        occupationCategory,
        occupation,
        address,
        birthday,
        age,
        marketType,
        prospectType,
        status,

        // for dropping
        dropReason,
        dropNotes,
      } = req.body;

      // ===========================
      // STATUS CONTROL (server-enforced)
      // ===========================
      /**
       * Rule:
       * - Status cannot be freely edited from UI.
       * Only allow:
       *   Active/Wrong Contact -> Dropped
       *   Dropped -> previous status (re-open)
       *
       * Re-opening is intentionally status-only: it does not touch prospect
       * profile fields, drop audit fields, or any lead records.
       */
      const currentStatus = String(existing.status || "");
      const requestedStatus = status !== undefined ? String(status || "").trim() : "";

      let nextStatus = currentStatus;

      if (status !== undefined) {
        const allowed = ["Active", "Wrong Contact", "Dropped"];
        if (requestedStatus !== "" && !allowed.includes(requestedStatus)) {
          throw Object.assign(new Error("Invalid status."), { status: 400 });
        }

        if (["Active", "Wrong Contact"].includes(currentStatus) && requestedStatus === "Dropped") {
          nextStatus = "Dropped";
        } else if (currentStatus === "Dropped" && requestedStatus === "Active") {
          const restoreStatus = ["Active", "Wrong Contact"].includes(String(existing.statusBeforeDrop || ""))
            ? String(existing.statusBeforeDrop)
            : "Active";
          existing.status = restoreStatus;
          existing.statusBeforeDrop = undefined;
          saved = await existing.save({ session });
          return;
        } else if (requestedStatus && requestedStatus !== currentStatus) {
          throw Object.assign(
            new Error("Status cannot be changed manually. Only dropping or re-opening is allowed."),
            { status: 403 }
          );
        }
      }

      // Required fields remain required even on update
      if (!String(firstName || "").trim()) {
        throw Object.assign(new Error("First name is required."), { status: 400 });
      }
      if (!String(lastName || "").trim()) {
        throw Object.assign(new Error("Last name is required."), { status: 400 });
      }
      if (!marketType || !["Warm", "Cold"].includes(marketType)) {
        throw Object.assign(new Error("Market type is required."), { status: 400 });
      }

      /**
       * Phone validation (required):
       * - normalize to digits-only
       * - PH local 10 digits starting with 9
       */
      const phone = onlyDigits(phoneNumber);
      if (!phone) throw Object.assign(new Error("Phone number is required."), { status: 400 });
      if (!/^9\d{9}$/.test(phone)) {
        throw Object.assign(
          new Error("Phone must be 10 digits and start with 9 (PH local)."),
          { status: 400 }
        );
      }

      /**
       * Email validation (optional):
       * - allow empty string
       * - normalize to lowercase trimmed
       */
      const cleanEmail = String(email ?? "").trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        throw Object.assign(new Error("Invalid email format."), { status: 400 });
      }

      // ProspectType (optional)
      if (prospectType && !["Elite", "Ordinary"].includes(prospectType)) {
        throw Object.assign(new Error("Invalid prospect type."), { status: 400 });
      }

      // Sex (optional)
      if (sex && !["Male", "Female"].includes(sex)) {
        throw Object.assign(new Error("Invalid sex."), { status: 400 });
      }

      // Civil status (optional)
      if (civilStatus && !["Single", "Married", "Widowed", "Separated", "Annulled"].includes(civilStatus)) {
        throw Object.assign(new Error("Invalid civil status."), { status: 400 });
      }

      // Occupation category + occupation (optional in full-details edit)
      const occupationCategoryProvided = Object.prototype.hasOwnProperty.call(req.body, "occupationCategory");
      const occupationProvided = Object.prototype.hasOwnProperty.call(req.body, "occupation");
      const rawOccupationCategory = String(occupationCategory ?? "").trim();
      const cleanOccupation = String(occupation ?? "").trim();
      let cleanOccupationCategory = rawOccupationCategory;
      if (!cleanOccupationCategory && cleanOccupation) cleanOccupationCategory = "Employed";

      if (cleanOccupationCategory && !["Employed", "Self-Employed", "Not Employed"].includes(cleanOccupationCategory)) {
        throw Object.assign(new Error("Invalid occupation category."), { status: 400 });
      }
      if (["Employed", "Self-Employed"].includes(cleanOccupationCategory) && !cleanOccupation && occupationProvided) {
        throw Object.assign(new Error("Occupation is required for employed/self-employed prospects."), { status: 400 });
      }
      if (cleanOccupation.length > 150) {
        throw Object.assign(new Error("Occupation must be 150 characters or less."), { status: 400 });
      }

      // Address (Philippines only, optional in full-details edit)
      const addressProvided = Object.prototype.hasOwnProperty.call(req.body, "address");
      const addressIn = address && typeof address === "object" ? address : {};
      const line = String(addressIn.line ?? "").trim();
      const barangay = String(addressIn.barangay ?? "").trim();
      const city = String(addressIn.city ?? "").trim();
      const otherCity = String(addressIn.otherCity ?? "").trim();
      const region = String(addressIn.region ?? "").trim();
      const zipCode = String(addressIn.zipCode ?? "").trim();
      const country = String(addressIn.country ?? "Philippines").trim() || "Philippines";

      if (zipCode && !/^\d{4}$/.test(zipCode)) throw Object.assign(new Error("Zip code must be 4 digits."), { status: 400 });
      if (country && country.toLowerCase() !== "philippines") {
        throw Object.assign(new Error("Country must be Philippines."), { status: 400 });
      }
      if (city === "Other" && !otherCity) {
        throw Object.assign(new Error("Other city is required when city is Other."), { status: 400 });
      }
      if (city && !region) {
        throw Object.assign(new Error("Region is required when city is provided."), { status: 400 });
      }

      // ===========================
      // Drop validation + blocking rule
      // ===========================
      /**
       * If dropping:
       * - dropReason and dropNotes are required.
       * - Prospect can be dropped only when every lead under it is either
       *   Dropped or Policy Declined. New, In Progress, and Closed leads block
       *   dropping to prevent orphaned non-terminal/non-drop lead records.
       */
      if (nextStatus === "Dropped") {
        const r = String(dropReason || "").trim();
        const n = String(dropNotes || "").trim();

        if (!r) throw Object.assign(new Error("dropReason is required when status is Dropped."), { status: 400 });
        if (!n) throw Object.assign(new Error("dropNotes is required when status is Dropped."), { status: 400 });

        const droppableLeadStatuses = ["Dropped", "Policy Declined"];
        const blockingLeads = await Lead.find({
          prospectId: new mongoose.Types.ObjectId(prospectId),
          status: { $nin: droppableLeadStatuses },
        })
          .select("leadCode status")
          .sort({ createdAt: -1 })
          .lean()
          .session(session);

        if (blockingLeads.length > 0) {
          // Custom structured error returned to frontend
          throw Object.assign(
            new Error(
              "Cannot drop this prospect because all lead records must be Dropped or Policy Declined."
            ),
            {
              status: 409,
              code: "PROSPECT_DROP_BLOCKED",
              leadsSummary: {
                count: blockingLeads.length,
                preview: blockingLeads.slice(0, 10).map((l) => ({
                  leadCode: l.leadCode,
                  status: l.status,
                })),
              },
            }
          );
        }
      }

      // ===========================
      // Age/Birthday update rules (only if client touched them)
      // ===========================
      /**
       * IMPORTANT:
       * - Optional fields should not be cleared unless explicitly included in request body.
       * - birthdayProvided/ageProvided detects explicit intent.
       *
       * Rules:
       * - If birthday is set: compute age from birthday (birthday wins).
       * - If birthday cleared OR not provided: age can be set/cleared independently.
       * - Enforce 18–70 and no future birthdays (date-only).
       */
      const birthdayProvided = Object.prototype.hasOwnProperty.call(req.body, "birthday");
      const ageProvided = Object.prototype.hasOwnProperty.call(req.body, "age");

      let nextBirthday = existing.birthday;
      let nextAge = existing.age;

      let birthdayCleared = false;

      if (birthdayProvided) {
        const bStr = String(birthday ?? "").trim();

        if (bStr === "") {
          nextBirthday = undefined;
          birthdayCleared = true;
        } else {
          const b = new Date(bStr);
          if (isNaN(b.getTime())) throw Object.assign(new Error("Invalid birthday."), { status: 400 });
          if (isFutureDateOnly(b)) {
            throw Object.assign(new Error("Birthday cannot be in the future."), { status: 400 });
          }

          const computedAge = computeAgeFromBirthday(b);
          if (computedAge === null) throw Object.assign(new Error("Invalid birthday."), { status: 400 });

          if (computedAge < 18 || computedAge > 70) {
            throw Object.assign(
              new Error("Prospect must be between 18 and 70 years old (based on birthday)."),
              { status: 400 }
            );
          }

          nextBirthday = b;
          nextAge = computedAge;
        }
      }

      if ((!birthdayProvided || birthdayCleared) && ageProvided) {
        const aStr = String(age ?? "").trim();

        if (aStr === "") {
          nextAge = undefined;
        } else {
          const inputAge = Number(aStr);
          if (!Number.isFinite(inputAge)) throw Object.assign(new Error("Invalid age."), { status: 400 });
          if (inputAge < 18 || inputAge > 70) {
            throw Object.assign(
              new Error("Prospect must be between 18 and 70 years old (based on age)."),
              { status: 400 }
            );
          }
          nextAge = inputAge;
        }
      }

      // ===========================
      // Apply field updates
      // ===========================
      existing.firstName = String(firstName).trim();
      existing.middleName = String(middleName ?? "").trim();
      existing.lastName = String(lastName).trim();

      existing.phoneNumber = phone;
      existing.email = cleanEmail;

      existing.sex = sex ? sex : undefined;
      existing.civilStatus = civilStatus ? civilStatus : undefined;

      if (occupationCategoryProvided || occupationProvided) {
        const nextOccupationCategory = occupationCategoryProvided
          ? (cleanOccupationCategory || "Not Employed")
          : (cleanOccupationCategory || existing.occupationCategory || "Not Employed");
        existing.occupationCategory = nextOccupationCategory;
        if (nextOccupationCategory === "Not Employed") {
          existing.occupation = "";
        } else if (occupationProvided) {
          existing.occupation = cleanOccupation;
        }
      }

      if (addressProvided) {
        existing.address = {
          line,
          barangay,
          city,
          otherCity,
          region,
          zipCode,
          country: "Philippines",
        };
      }

      existing.birthday = nextBirthday;
      existing.age = nextAge;

      existing.marketType = marketType;
      existing.prospectType = prospectType ? prospectType : undefined;

      existing.status = nextStatus;

      /**
       * Drop fields:
       * - When Dropped: fill reason/notes + set droppedAt if missing
       * - Otherwise: clear drop fields
       */
      if (nextStatus === "Dropped") {
        existing.statusBeforeDrop = currentStatus === "Dropped"
          ? (existing.statusBeforeDrop || "Active")
          : currentStatus;
        existing.dropReason = String(dropReason || "").trim();
        existing.dropNotes = String(dropNotes || "").trim();
        existing.droppedAt = existing.droppedAt || new Date();
      } else {
        existing.dropReason = undefined;
        existing.dropNotes = undefined;
        existing.droppedAt = null;
      }

      // Detect contact number change
      const phoneChanged = oldPhone !== phone;

      // ===========================
      // Wrong Contact resolution flow (phone changed + open UPDATE_CONTACT_INFO task)
      // ===========================
      /**
       * This block executes only when:
       * - phone number changed AND
       * - an Open UPDATE_CONTACT_INFO task exists for this prospect
       *
       * Guarantees if triggered:
       * - UPDATE_CONTACT_INFO task is completed
       * - Engagement is unblocked + reset to Contacting/Attempt Contact
       * - Engagement currentContactInfoVersion is set to "nextVersion"
       * - A new APPROACH task is created with dueAt at 6PM (cutoff 5:30PM)
       * - Notifications are generated
       *
       * Important implementation detail:
       * - Prospect schema pre-save hook increments contactInfoVersion when phone changes.
       * - We compute nextVersion locally so engagement updates can happen inside the same transaction.
       */
      if (phoneChanged) {
        const nextVersion = (existing.contactInfoVersion || 1) + 1;

        // Find newest open UPDATE_CONTACT_INFO task for this prospect (any engagement)
        const openUpdateTask = await Task.findOne({
          assignedToUserId: userObjectId,
          prospectId: existing._id,
          type: "UPDATE_CONTACT_INFO",
          status: "Open",
        })
          .sort({ createdAt: -1 })
          .session(session);

        // If there is no open update task, no special workflow runs.
        // Regular phone changes still work and version still increments via schema hook.  
        if (openUpdateTask) {
          // If prospect was marked Wrong Contact, restore to Active after phone is fixed
          if (existing.status === "Wrong Contact") {
            existing.status = "Active";
          }

          // Complete the UPDATE_CONTACT_INFO task
          openUpdateTask.status = "Done";
          openUpdateTask.completedAt = new Date();
          await openUpdateTask.save({ session });

          // If task is linked to an engagement, unblock and reset it
          if (openUpdateTask.leadEngagementId) {
            // New contact version = clean slate:
            // remove historical contact attempts tied to older phone versions.
            await ContactAttempt.deleteMany({
              leadEngagementId: openUpdateTask.leadEngagementId,
            }).session(session);

            await LeadEngagement.updateOne(
              { _id: openUpdateTask.leadEngagementId },
              {
                $set: {
                  isBlocked: false,
                  contactInfoVersionAtStart: nextVersion,
                  currentContactInfoVersion: nextVersion,
                  currentActivityKey: "Attempt Contact", // reset activity so UI flow restarts correctly
                  currentStage: "Contacting",
                  contactAttemptsCount: 0,
                  lastContactAttemptNo: 0,
                  lastContactAttemptAt: null,
                  nextAttemptAt: null,
                },
              }
            ).session(session);

            /**
             * Create a new APPROACH task using the "6PM rule":
             * - Default due is today 6:00 PM
             * - If now >= 5:30 PM, due is moved to tomorrow 6:00 PM
             */
            const now = new Date();

            const due = new Date(now);
            due.setHours(18, 0, 0, 0);

            const cutoff = new Date(now);
            cutoff.setHours(17, 30, 0, 0);

            if (now.getTime() >= cutoff.getTime()) {
              due.setDate(due.getDate() + 1);
            }

            const fullName = `${existing.firstName}${existing.middleName ? ` ${existing.middleName}` : ""} ${existing.lastName}`.trim();

            const newApproachTask = await Task.create(
              [
                {
                  assignedToUserId: userObjectId,
                  prospectId: existing._id,
                  leadEngagementId: openUpdateTask.leadEngagementId,
                  type: "APPROACH",
                  title: "Re-approach lead",
                  description: `Contact ${fullName} using the updated phone number.`,
                  dueAt: due,
                  status: "Open",
                },
              ],
              { session }
            ).then((docs) => docs[0]);

            /**
             * Resolve leadCode for notification text (optional but improves UX).
             * - leadEngagementId → LeadEngagement.leadId → Lead.leadCode
             */
            let leadCodeText = "—";

            if (openUpdateTask.leadEngagementId) {
              const engDoc = await LeadEngagement.findById(openUpdateTask.leadEngagementId)
                .select("leadId")
                .session(session);

              if (engDoc?.leadId) {
                const leadDoc = await Lead.findById(engDoc.leadId)
                  .select("leadCode")
                  .session(session);

                leadCodeText = leadDoc?.leadCode || "—";
              }
            }

            /**
             * Notifications:
             * - Always create TASK_ADDED when new task is created
             * - If due date is today (Asia/Manila), also create TASK_DUE_TODAY with dedupeKey
             */
            const taskAddedCreatedAt = new Date();
            const taskDueTodayCreatedAt = new Date(taskAddedCreatedAt.getTime() + 1);

            await Notification.create(
              [
                {
                  assignedToUserId: userObjectId,
                  type: "TASK_ADDED",
                  title: "New task added",
                  message: `A Re-approach task was created for ${fullName} (Lead ${leadCodeText}).`,
                  status: "Unread",
                  entityType: "Task",
                  entityId: newApproachTask._id,
                  createdAt: taskAddedCreatedAt,
                  updatedAt: taskAddedCreatedAt,
                },
              ],
              { session, timestamps: false }
            );

            if (isDueTodayInManila(due)) {
              await Notification.create(
                [
                  {
                    assignedToUserId: userObjectId,
                    type: "TASK_DUE_TODAY",
                    title: "Task due today",
                    message: `Re-approach task for ${fullName} (Lead ${leadCodeText}) is due today at 6:00 PM.`,
                    status: "Unread",
                    entityType: "Task",
                    entityId: newApproachTask._id,
                    dedupeKey: `TASK_DUE_TODAY:${newApproachTask._id}:${dateKeyInTZ(due, "Asia/Manila")}`,
                    createdAt: taskDueTodayCreatedAt,
                    updatedAt: taskDueTodayCreatedAt,
                  },
                ],
                { session, timestamps: false }
              );
            }
          }
        }
      }
      // Save Prospect changes (schema hook may increment contactInfoVersion on phone change)
      saved = await existing.save({ session });
    });

    return res.json({ message: "Prospect updated", prospect: saved });
  } catch (err) {
    /**
     * Custom business error: dropping blocked by active leads
     */
    if (err?.code === "PROSPECT_DROP_BLOCKED") {
      return res.status(409).json({
        code: "PROSPECT_DROP_BLOCKED",
        message: err.message,
        leadsSummary: err.leadsSummary,
      });
    }

    /**
     * Unique index collision:
     * - compound unique index on (assignedToUserId, phoneNumber) can throw E11000
     */
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "Phone number already exists for your prospects. Please use another phone number.",
      });
    }

    const status = err?.status || 500;

    console.error("Update prospect error:", err);
    return res.status(status).json({ message: err?.message || "Server error." });
  } finally {
    // Always clean up session to avoid leaks
    session.endSession();
  }
});

/**
 * LEADS: INIT (Agent)
 * GET /api/leads/init?userId=...&prospectId=...
 *
 * Purpose:
 * - Provides the frontend with everything needed to render the "Create Lead" form:
 *   1) Prospect summary (fullName, source, code, status)
 *   2) An agent-scoped "leadNo" for display only (not the leadCode)
 *   3) Whether lead creation is blocked and why
 *   4) Whether an active lead already exists for this prospect
 *
 * Business rules enforced:
 * - Prospect must belong to the requesting agent (assignedToUserId match).
 * - If prospect is Dropped → lead creation is blocked (409), but prospect info is still returned.
 * - Detect if there is an active lead (New/In Progress) to warn/block in UI logic.
 *
 * Notes:
 * - leadNo is computed by counting leads across ALL prospects owned by this agent.
 *   This is for display only; leadCode is still the unique identifier.
 */
app.get("/api/leads/init", async (req, res) => {
  try {
    const { userId, prospectId } = req.query;

    // Validate required query parameters
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!prospectId) return res.status(400).json({ message: "Missing prospectId." });

    // Validate ObjectId format
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }
    if (!mongoose.isValidObjectId(prospectId)) {
      return res.status(400).json({ message: "Invalid prospectId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);

    /**
     * Authorization + minimal prospect fetch:
     * - Ensures prospect belongs to this agent.
     * - Returns only fields needed for init screen.
     */
    const prospect = await Prospect.findOne({
      _id: prospectObjectId,
      assignedToUserId: userObjectId,
    })
      .select("firstName middleName lastName source prospectCode status")
      .lean();

    if (!prospect) {
      return res.status(404).json({ message: "Prospect not found." });
    }

    // Build human-readable prospect name for UI
    const fullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${
      prospect.lastName
    }`.trim();

    /**
     * Block rule:
     * - If prospect is Dropped, do not allow creating a lead.
     * - Still return prospect summary so UI can display why it’s blocked.
     */
    if (prospect.status === "Dropped") {
      return res.status(409).json({
        message: "Cannot create a lead for a Dropped prospect.",
        isLeadCreationBlocked: true,
        blockReason: "PROSPECT_DROPPED",
        prospect: {
          _id: prospectId,
          fullName,
          source: prospect.source,
          prospectCode: prospect.prospectCode,
          status: prospect.status,
        },
        leadMeta: null,
        hasActiveLead: false,
        activeLead: null,
      });
    }

    /**
     * Active lead detection:
     * - This checks if the prospect already has a lead in "New" or "In Progress".
     * - Only one active lead per prospect is allowed by schema index, but this adds early detection for UI.
     */
    const activeLead = await Lead.findOne({
      prospectId: prospectObjectId,
      status: { $in: ["New", "In Progress"] },
    })
      .select("_id leadCode status")
      .sort({ createdAt: -1 })
      .lean();

    /**
     * leadNo computation (display-only):
     * - Lead number is computed as: (count of leads for all agent prospects) + 1
     * - Used for UI display; NOT used as database identifier.
     */
    const agentProspects = await Prospect.find({ assignedToUserId: userObjectId })
      .select("_id")
      .lean();

    const ids = agentProspects.map((p) => p._id);

    const leadCount = ids.length ? await Lead.countDocuments({ prospectId: { $in: ids } }) : 0;
    const leadNo = leadCount + 1;

    return res.json({
      prospect: {
        _id: prospectId,
        fullName,
        source: prospect.source,
        prospectCode: prospect.prospectCode,
        status: prospect.status, 
      },
      leadMeta: { leadNo },

      isLeadCreationBlocked: false,
      blockReason: null,

      hasActiveLead: !!activeLead,
      activeLead: activeLead
        ? { _id: activeLead._id, leadCode: activeLead.leadCode, status: activeLead.status }
        : null,
    });
  } catch (err) {
    console.error("Init lead error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * LEADS: CREATE (Agent)
 * POST /api/leads?userId=...
 *
 * Purpose:
 * - Creates a new Lead for a Prospect owned by the agent.
 * - Automatically creates related records in ONE transaction:
 *   1) Lead
 *   2) LeadEngagement (1:1 with Lead)
 *   3) Initial Task (APPROACH) due at 6:00 PM (cutoff 5:30 PM)
 *   4) Notifications (TASK_ADDED + optional TASK_DUE_TODAY)
 *
 * Business rules enforced:
 * - Prospect must belong to agent.
 * - Cannot create a lead if prospect is Dropped.
 * - Cannot create a lead if an active lead exists (New/In Progress).
 * - Lead source is validated; if prospect is System-Assigned → source forced to "System".
 *
 * Reliability:
 * - leadCode generation uses getNextLeadCode() which may (rarely) collide under concurrency.
 * - This code retries up to MAX_TRIES when duplicate leadCode occurs.
 */
app.post("/api/leads", async (req, res) => {
  // Session enables MongoDB transaction across multiple collections
  const session = await mongoose.startSession();

  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;

    // Validate agent scope parameter
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const { prospectId, source, otherSource = "", description = "" } = req.body;

    // Validate prospectId
    if (!prospectId || !mongoose.isValidObjectId(prospectId)) {
      return res.status(400).json({ message: "Invalid prospectId." });
    }

    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);

    /**
     * Authorization + prospect read:
     * - Ensures prospect belongs to agent.
     * - Retrieves contactInfoVersion (used to initialize LeadEngagement versioning).
     * - Retrieves name fields for task/notification messaging.
     */
    const prospect = await Prospect.findOne({
      _id: prospectObjectId,
      assignedToUserId: userObjectId,
    })
      .select("source contactInfoVersion firstName middleName lastName status")
      .lean();

    if (!prospect) {
      return res.status(404).json({ message: "Prospect not found." });
    }

    // Block lead creation if prospect was dropped
    if (prospect.status === "Dropped") {
      return res.status(409).json({
        message: "Cannot create a lead for a Dropped prospect.",
        blockReason: "PROSPECT_DROPPED",
      });
    }

    // Used for Task/Notification message text
    const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${
      prospect.lastName
    }`.trim();

    /**
     * Block lead creation if there is an existing active lead.
     * - The Lead schema also enforces this via a partial unique index,
     *   but this gives a user-friendly 409 response before insert.
     */
    const existingActiveLead = await Lead.findOne({
      prospectId: prospectObjectId,
      status: { $in: ["New", "In Progress"] },
    })
      .select("_id leadCode status")
      .sort({ createdAt: -1 })
      .lean();

    if (existingActiveLead) {
      return res.status(409).json({
        message: `Cannot create a new lead. This prospect already has an active lead (${existingActiveLead.leadCode}, ${existingActiveLead.status}).`,
        activeLead: {
          _id: existingActiveLead._id,
          leadCode: existingActiveLead.leadCode,
          status: existingActiveLead.status,
        },
      });
    }

    const nonCancelledPolicyPriorityCategories = await getNonCancelledPolicyPriorityCategoriesForProspect(prospectObjectId, userObjectId);
    if (nonCancelledPolicyPriorityCategories.length >= NEEDS_PRIORITY_CATEGORIES.length) {
      return res.status(409).json({
        message: "Cannot create a new lead. This prospect already has non-cancelled policies for all priority categories.",
        blockReason: "ALL_PRIORITY_POLICIES_ACTIVE",
        unavailablePriorityCategories: nonCancelledPolicyPriorityCategories,
      });
    }

    /**
     * Validate lead source:
     * - Must be one of allowedSources
     * - If Prospect.source is "System-Assigned", force source to "System"
     * - If "Other", require otherSource
     */
    const allowedSources = [
      "System",
      "Family",
      "Friend",
      "Acquaintance",
      "Webinars",
      "Seminars/Conferences",
      "Other",
    ];

    let finalSource = String(source || "").trim();

    if (prospect.source === "System-Assigned") {
      finalSource = "System";
    }

    if (!finalSource || !allowedSources.includes(finalSource)) {
      return res.status(400).json({ message: "Invalid lead source." });
    }

    let finalOther = "";
    if (finalSource === "Other") {
      finalOther = String(otherSource || "").trim();
      if (!finalOther) {
        return res.status(400).json({ message: "Please specify the other source." });
      }
    }

    /**
     * Validate lead source:
     * - Must be one of allowedSources
     * - If Prospect.source is "System-Assigned", force source to "System"
     * - If "Other", require otherSource
     */
    const MAX_TRIES = 5;

    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        let createdLeadDoc = null;

        await session.withTransaction(async () => {
          const leadCode = await getNextLeadCode(); 

          /**
           * APPROACH Task due time rule:
           * - Default due time: today 6:00 PM
           * - Cutoff: if created at/after 5:30 PM → due tomorrow 6:00 PM
           */
        const now = new Date();

        const due = new Date(now);
        due.setHours(18, 0, 0, 0); 

        const cutoff = new Date(now);
        cutoff.setHours(17, 30, 0, 0); 

        // If created at or after 5:30 PM → due tomorrow 6:00 PM
        if (now.getTime() >= cutoff.getTime()) {
          due.setDate(due.getDate() + 1);
        }

          // 1) CREATE LEAD (status starts as "New")
          const leadDocs = await Lead.create(
            [
              {
                leadCode,
                prospectId: prospectObjectId,
                source: finalSource,
                otherSource: finalOther,
                description: String(description || "").trim(),
                status: "New",
              },
            ],
            { session }
          );

          const createdLead = leadDocs[0];
          createdLeadDoc = createdLead;

          // 2) CREATE LEAD ENGAGEMENT (1:1 record controlling the engagement pipeline)
          const engagementStartedAt = new Date();

          const engagementDocs = await LeadEngagement.create(
            [
              {
                leadId: createdLead._id,

                currentStage: "Contacting",
                currentActivityKey: "Attempt Contact",
                stageStartedAt: engagementStartedAt,
                stageCompletedAt: null,
                stageHistory: [
                  {
                    stage: "Contacting",
                    startedAt: engagementStartedAt,
                    completedAt: null,
                    reason: "Lead created.",
                  },
                ],

                isBlocked: false,

                contactAttemptsCount: 0,
                lastContactAttemptNo: 0,
                lastContactAttemptAt: null,
                contactAttemptCycle: 1,

                nextAttemptAt: null,

                // Versioning ties engagement attempts to the correct prospect contact info version
                contactInfoVersionAtStart: prospect.contactInfoVersion || 1,
                currentContactInfoVersion: prospect.contactInfoVersion || 1,
              },
            ],
            { session }
          );

          const createdEngagement = engagementDocs[0];

          // 3) CREATE TASK (APPROACH) as the initial action item for the agent
          const taskDocs = await Task.create(
            [
              {
                assignedToUserId: userObjectId,
                prospectId: prospectObjectId,
                leadEngagementId: createdEngagement._id,

                type: "APPROACH",
                title: "Contact new lead",
                description: `Contact ${prospectFullName} regarding this new lead.`,
                dueAt: due,      
                status: "Open",
              },
            ],
            { session }
          );

          const createdTask = taskDocs[0];

          await createTaskAddedNotifications({
            assignedToUserId: userObjectId,
            task: createdTask,
            prospectFullName,
            leadCode,
            session,
          });
        });

        // Transaction succeeded → return created lead
        return res.status(201).json({ message: "Lead created", lead: createdLeadDoc });
      } catch (err) {

          /**
           * Duplicate key errors:
           * - Retry only when the duplicate is specifically on leadCode.
           * - Otherwise, return a 409 conflict response.
           */
          if (err?.code === 11000) {
            const msg = String(err?.message || "");
            if (msg.includes("leadCode") && attempt < MAX_TRIES) {
              continue;
            }

            return res.status(409).json({
              message: "Duplicate constraint error.",
            });
          }

          // Other errors bubble up to outer catch
          throw err;
      }
    }
  } catch (err) {
    // Fallback duplicate handler
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Lead code conflict. Please try again." });
    }
    console.error("Create lead error:", err);
    return res.status(500).json({ message: "Server error." });
  } finally {
    session.endSession();
  }
});


// View Lead Details (under a Prospect) + 1 Policy Attached
// GET /api/prospects/:prospectId/leads/:leadId/details?userId=...
//
// Purpose:
// - Returns a lead’s details in the context of a prospect owned by the agent.
// - Also attaches at most ONE Policyholder record linked to this lead engagement (1:1 via leadEngagementId).
// - Computes a display-only agent-wide leadNo (rank across all leads under agent’s prospects).
//
// Security model:
// 1) Validate agent (userId)
// 2) Validate that prospect belongs to agent (assignedToUserId match)
// 3) Validate that lead belongs to that prospect
// 4) Attach policy only if it belongs to agent too (assignedToUserId match)
app.get("/api/prospects/:prospectId/leads/:leadId/details", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;

    // Validate required query param
    if (!userId) return res.status(400).json({ message: "Missing userId." });

    // Validate ObjectIds to avoid casting errors and invalid DB queries
    if (!mongoose.isValidObjectId(userId))
      return res.status(400).json({ message: "Invalid userId." });

    if (!mongoose.isValidObjectId(prospectId))
      return res.status(400).json({ message: "Invalid prospectId." });

    if (!mongoose.isValidObjectId(leadId))
      return res.status(400).json({ message: "Invalid leadId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    // 1) Ensure prospect belongs to agent (authorization)
    const prospect = await Prospect.findOne({
      _id: prospectObjectId,
      assignedToUserId: userObjectId,
    })
      .select("firstName middleName lastName source status")
      .lean();

    if (!prospect) {
      // Not found OR not owned by agent
      return res.status(404).json({ message: "Prospect not found." });
    }

    // Construct a single display name for UI
    const prospectName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();

    // 2) Lead must belong to this prospect (prevents cross-prospect access)
    const lead = await Lead.findOne({
      _id: leadObjectId,
      prospectId: prospectObjectId,
    })
      .select("leadCode source otherSource description status statusBeforeDrop dropReason dropNotes droppedAt createdAt updatedAt")
      .lean();

    if (!lead) {
      return res.status(404).json({ message: "Lead not found." });
    }

    // Attach Policyholder (optional 1:1 via leadEngagementId)
    // Security: policy must also belong to the agent (assignedToUserId match)
    const leadEngagement = await LeadEngagement.findOne({ leadId: leadObjectId })
      .select("_id currentStage updatedAt")
      .lean();

    const policy = leadEngagement
      ? await Policyholder.findOne({
          leadEngagementId: leadEngagement._id,
          assignedToUserId: userObjectId,
        })
          .select("policyholderCode status createdAt")
          .lean()
      : null;

    const activeSiblingLead = await Lead.findOne({
      prospectId: prospectObjectId,
      _id: { $ne: leadObjectId },
      status: { $in: ["New", "In Progress"] },
    })
      .select("_id leadCode status")
      .lean();

    /**
     * 3) Compute agent-wide leadNo (display-only)
     * ------------------------------------------
     * Definition here:
     * - Rank this lead among ALL leads whose prospects are owned by this agent.
     * - Ordering used: createdAt ASC, tie-breaker _id ASC (via "beforeCount" query).
     *
     * Implementation:
     * - Gather all prospectIds owned by agent.
     * - Count how many leads were created before this lead:
     *     createdAt < this.createdAt
     *     OR createdAt == this.createdAt AND _id < this leadId
     * - leadNo = beforeCount + 1
     */
    const agentProspects = await Prospect.find({ assignedToUserId: userObjectId })
      .select("_id")
      .lean();

    const ids = agentProspects.map((p) => p._id);

    let leadNo = null;
    if (ids.length) {
      const createdAt = lead.createdAt ? new Date(lead.createdAt) : null;

      if (createdAt && !isNaN(createdAt.getTime())) {
        const beforeCount = await Lead.countDocuments({
          prospectId: { $in: ids },
          $or: [
            { createdAt: { $lt: createdAt } },
            { createdAt: createdAt, _id: { $lt: leadObjectId } },
          ],
        });

        leadNo = beforeCount + 1;
      }
    }

    return res.json({
      prospect: {
        _id: prospectId,
        fullName: prospectName,
        source: prospect.source,
        status: prospect.status || "",
        activeLeadForReopen: activeSiblingLead
          ? {
              _id: activeSiblingLead._id,
              leadCode: activeSiblingLead.leadCode,
              status: activeSiblingLead.status,
            }
          : null,
      },
      lead: {
        ...lead,
        // Convenience string for UI:
        // - If source === Other, show "Other: <otherSource>"
        // - Else show the normal lead.source
        displaySource:
          lead.source === "Other"
            ? `Other: ${lead.otherSource || ""}`.trim()
            : lead.source,
      },
      leadMeta: { leadNo },
      leadEngagement: leadEngagement
        ? {
            _id: leadEngagement._id,
            currentStage: leadEngagement.currentStage || "Not Started",
            updatedAt: leadEngagement.updatedAt || null,
          }
        : null,
      // Policy is either a single object or null
      policy: policy
        ? {
            _id: policy._id,
            policyholderCode: policy.policyholderCode,
            status: policy.status,
            createdAt: policy.createdAt,
          }
        : null,
    });
  } catch (err) {
    console.error("Get lead details error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});


// View Policyholder Details
// GET /api/policyholders/:policyholderId/details?userId=...
app.get("/api/policyholders/:policyholderId/details", async (req, res) => {
  try {
    const { userId } = req.query;
    const { policyholderId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);

    const policyholderDoc = await Policyholder.findOne({
      _id: policyholderObjectId,
      assignedToUserId: userObjectId,
    })
      .select("assignedToUserId policyholderCode productId policyNumber leadEngagementId lastPaidDate nextPaymentDate status annualPaymentRecords cancellationDetails createdAt updatedAt");

    if (!policyholderDoc) return res.status(404).json({ message: "Policyholder not found." });
    await syncPolicyholderPaymentDates(policyholderDoc);
    const policyholder = policyholderDoc.toObject();

    const leadEngagement = await LeadEngagement.findById(policyholder.leadEngagementId)
      .select("_id leadId")
      .lean();

    if (!leadEngagement) return res.status(404).json({ message: "Lead engagement not found." });

    const lead = await Lead.findById(leadEngagement.leadId)
      .select("leadCode prospectId")
      .lean();

    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const prospect = await Prospect.findOne({
      _id: lead.prospectId,
      assignedToUserId: userObjectId,
    })
      .select("firstName middleName lastName age")
      .lean();

    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const [product, policy] = await Promise.all([
      policyholder.productId
        ? Product.findById(policyholder.productId).select("productName").lean()
        : null,
      Policy.findOne({ leadEngagementId: leadEngagement._id })
        .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
        .select("recordPolicyApplicationStatus uploadPolicySummary recordCoverageDurationDetails")
        .lean(),
    ]);

    const coverage = policy?.recordCoverageDurationDetails || {};
    const policyIssuance = policy?.recordPolicyApplicationStatus || {};
    const summary = policy?.uploadPolicySummary || {};
    const prospectName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
    const annualPaymentRecords = await loadAnnualPaymentRecordsForPolicyholder(policyholder);

    return res.json({
      prospect: {
        _id: prospect._id,
        fullName: prospectName,
        age: prospect.age ?? null,
      },
      lead: {
        _id: lead._id,
        leadCode: lead.leadCode,
      },
      policyholder: {
        _id: policyholder._id,
        policyholderCode: policyholder.policyholderCode,
        policyNumber: policyholder.policyNumber || summary.policyNumber || coverage.policyNumber || "",
        status: policyholder.status,
        lastPaidDate: policyholder.lastPaidDate || null,
        nextPaymentDate: policyholder.nextPaymentDate || null,
        createdAt: policyholder.createdAt || null,
        updatedAt: policyholder.updatedAt || null,
        cancellationDetails: policyholder.cancellationDetails || null,
      },
      policySummary: {
        policyNumber: summary.policyNumber || policyholder.policyNumber || coverage.policyNumber || "",
        fileName: summary.policySummaryFileName || "",
        mimeType: summary.policySummaryFileMimeType || "",
        fileDataUrl: summary.policySummaryFileDataUrl || "",
        uploadedAt: summary.uploadedAt || null,
      },
      product: {
        _id: product?._id || policyholder.productId || null,
        productName: product?.productName || "",
      },
      coverage: {
        policyIssuanceDate: policyIssuance.issuanceDate || null,
        policyEndDate: coverage.policyEndDate || coverage.coverageEndDate || null,
        coverageDurationLabel: coverage.coverageDurationLabel || "",
        coverageDurationType: coverage.coverageDurationType || "",
        coverageDurationYears: coverage.coverageDurationYears ?? null,
        coverageDurationUntilAge: coverage.coverageDurationUntilAge ?? null,
        selectedPaymentTermLabel: coverage.selectedPaymentTermLabel || "",
        selectedPaymentTermType: coverage.selectedPaymentTermType || "",
        selectedPaymentTermYears: coverage.selectedPaymentTermYears ?? null,
        selectedPaymentTermUntilAge: coverage.selectedPaymentTermUntilAge ?? null,
      },
      annualPaymentRecords,
    });
  } catch (err) {
    console.error("Get policyholder details error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// POST /api/policyholders/:policyholderId/cancellation?userId=...
app.post("/api/policyholders/:policyholderId/cancellation", async (req, res) => {
  try {
    const { userId } = req.query;
    const { policyholderId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);

    const policyholder = await Policyholder.findOne({
      _id: policyholderObjectId,
      assignedToUserId: userObjectId,
    }).select("assignedToUserId policyholderCode policyNumber productId leadEngagementId status nextPaymentDate cancellationDetails");

    if (!policyholder) return res.status(404).json({ message: "Policyholder not found." });
    if (TERMINAL_POLICYHOLDER_STATUSES.includes(String(policyholder.status || ""))) {
      return res.status(409).json({ message: "Policy cancellation cannot be recorded after policy payment tracking has ended." });
    }

    const policy = await Policy.findOne({ leadEngagementId: policyholder.leadEngagementId })
      .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
      .select("recordPolicyApplicationStatus.issuanceDate")
      .lean();

    const issuanceDate = policy?.recordPolicyApplicationStatus?.issuanceDate
      ? new Date(policy.recordPolicyApplicationStatus.issuanceDate)
      : null;
    const leadEngagement = await LeadEngagement.findById(policyholder.leadEngagementId).select("leadId").lean();
    const lead = leadEngagement?.leadId ? await Lead.findById(leadEngagement.leadId).select("prospectId").lean() : null;
    const prospect = lead?.prospectId ? await Prospect.findById(lead.prospectId).select("firstName middleName lastName").lean() : null;

    const {
      accomplishedPolicySurrenderFormFileName,
      accomplishedPolicySurrenderFormFileMimeType,
      accomplishedPolicySurrenderFormFileDataUrl,
      surrenderChargePhp,
      approvedCancellationDate,
      cancellationReason,
      proofOfApprovedPolicySurrenderFileName,
      proofOfApprovedPolicySurrenderFileMimeType,
      proofOfApprovedPolicySurrenderImageDataUrl,
    } = req.body || {};

    const fieldErrors = {};
    const surrenderFormDataUrl = String(accomplishedPolicySurrenderFormFileDataUrl || "").trim();
    const proofImageDataUrl = String(proofOfApprovedPolicySurrenderImageDataUrl || "").trim();
    const cancellationDateText = String(approvedCancellationDate || "").trim();
    const cancellationReasonText = String(cancellationReason || "").trim();

    if (!surrenderFormDataUrl) {
      fieldErrors.accomplishedPolicySurrenderFormFileDataUrl = String(accomplishedPolicySurrenderFormFileName || "").trim()
        ? "Accomplished policy surrender form must be a PDF."
        : "Accomplished policy surrender form PDF is required.";
    } else if (!/^data:application\/pdf;base64,/i.test(surrenderFormDataUrl)) {
      fieldErrors.accomplishedPolicySurrenderFormFileDataUrl = "Accomplished policy surrender form must be a PDF.";
    }

    let normalizedSurrenderCharge = null;
    if (surrenderChargePhp !== undefined && surrenderChargePhp !== null && String(surrenderChargePhp).trim() !== "") {
      normalizedSurrenderCharge = Number(surrenderChargePhp);
      if (!Number.isFinite(normalizedSurrenderCharge) || normalizedSurrenderCharge < 0) {
        fieldErrors.surrenderChargePhp = "Surrender charge must be a valid non-negative amount.";
      }
    }

    let cancellationDate = null;
    if (!cancellationDateText) {
      fieldErrors.approvedCancellationDate = "Cancellation date is required.";
    } else {
      cancellationDate = new Date(`${cancellationDateText}T00:00:00.000Z`);
      if (Number.isNaN(cancellationDate.getTime())) {
        fieldErrors.approvedCancellationDate = "Approved cancellation date is invalid.";
      } else {
        const today = new Date();
        const todayOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        const cancelOnly = new Date(Date.UTC(cancellationDate.getUTCFullYear(), cancellationDate.getUTCMonth(), cancellationDate.getUTCDate()));
        const issuanceOnly = issuanceDate && !Number.isNaN(issuanceDate.getTime())
          ? new Date(Date.UTC(issuanceDate.getUTCFullYear(), issuanceDate.getUTCMonth(), issuanceDate.getUTCDate()))
          : null;

        if (!issuanceOnly) {
          fieldErrors.approvedCancellationDate = "Policy issuance date is unavailable.";
        } else if (cancelOnly <= issuanceOnly) {
          fieldErrors.approvedCancellationDate = "Approved cancellation date must be after the policy issuance date.";
        } else if (cancelOnly > todayOnly) {
          fieldErrors.approvedCancellationDate = "Approved cancellation date cannot be in the future.";
        }
      }
    }

    if (!cancellationReasonText) {
      fieldErrors.cancellationReason = "Reason for cancellation is required.";
    }

    if (!proofImageDataUrl) {
      fieldErrors.proofOfApprovedPolicySurrenderImageDataUrl = String(proofOfApprovedPolicySurrenderFileName || "").trim()
        ? "Proof of approved policy surrender must be a JPG, JPEG, or PNG image."
        : "Proof of approved policy surrender image is required.";
    } else if (!/^data:image\/(?:jpeg|png);base64,/i.test(proofImageDataUrl)) {
      fieldErrors.proofOfApprovedPolicySurrenderImageDataUrl = "Proof of approved policy surrender must be a JPG, JPEG, or PNG image.";
    }

    if (Object.keys(fieldErrors).length) {
      return res.status(400).json({ message: "Please correct the highlighted fields.", fieldErrors });
    }

    policyholder.status = "Cancelled";
    policyholder.nextPaymentDate = null;
    await AnnualPayment.updateMany(
      {
        leadEngagementId: policyholder.leadEngagementId,
        status: { $in: ["Not Started", "Ongoing"] },
      },
      { $set: { status: "No Longer Pursued" } }
    );
    policyholder.cancellationDetails = {
      accomplishedPolicySurrenderFormFileName: String(accomplishedPolicySurrenderFormFileName || "").trim(),
      accomplishedPolicySurrenderFormFileMimeType: String(accomplishedPolicySurrenderFormFileMimeType || "application/pdf").trim() || "application/pdf",
      accomplishedPolicySurrenderFormFileDataUrl: surrenderFormDataUrl,
      surrenderChargePhp: normalizedSurrenderCharge,
      approvedCancellationDate: cancellationDate,
      cancellationReason: cancellationReasonText,
      proofOfApprovedPolicySurrenderFileName: String(proofOfApprovedPolicySurrenderFileName || "").trim(),
      proofOfApprovedPolicySurrenderFileMimeType: String(proofOfApprovedPolicySurrenderFileMimeType || "image/jpeg").trim() || "image/jpeg",
      proofOfApprovedPolicySurrenderImageDataUrl: proofImageDataUrl,
      cancelledAt: new Date(),
    };

    const saved = await policyholder.save();
    await softDeletePaymentTrackingNotificationsForPolicyholder(saved, "Policy was cancelled.");
    await createPolicyCancellationNotification(saved, prospect);
    return res.json({
      message: "Policy cancellation saved.",
      policyholder: {
        _id: saved._id,
        policyholderCode: saved.policyholderCode,
        policyNumber: saved.policyNumber,
        status: saved.status,
        cancellationDetails: saved.cancellationDetails || null,
      },
    });
  } catch (err) {
    console.error("Policy cancellation save error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// GET /api/policyholders/:policyholderId/annual-payments/:annualPaymentId?userId=...
app.get("/api/policyholders/:policyholderId/annual-payments/:annualPaymentId", async (req, res) => {
  try {
    const { userId } = req.query;
    const { policyholderId, annualPaymentId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });
    if (!mongoose.isValidObjectId(annualPaymentId)) return res.status(400).json({ message: "Invalid annualPaymentId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);
    const annualPaymentObjectId = new mongoose.Types.ObjectId(annualPaymentId);

    const policyholder = await Policyholder.findOne({
      _id: policyholderObjectId,
      assignedToUserId: userObjectId,
    })
      .select("assignedToUserId policyholderCode productId policyNumber leadEngagementId lastPaidDate nextPaymentDate status annualPaymentRecords createdAt updatedAt")
      .lean();

    if (!policyholder) return res.status(404).json({ message: "Policyholder not found." });

    const annualPaymentIsLinked = (policyholder.annualPaymentRecords || []).some(
      (record) => String(record?.annualPaymentId || "") === String(annualPaymentObjectId)
    );

    const annualPayment = await AnnualPayment.findOne({
      _id: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    })
      .select("leadEngagementId annualPaymentPeriod totalAnnualPremiumPhp amountPaidSoFarPhp remainingBalancePhp frequencyOfPayment paymentProgress status createdAt updatedAt")
      .lean();

    if (!annualPayment || (!annualPaymentIsLinked && String(annualPayment.leadEngagementId || "") !== String(policyholder.leadEngagementId || ""))) {
      return res.status(404).json({ message: "Annual payment record not found." });
    }

    const leadEngagement = await LeadEngagement.findById(policyholder.leadEngagementId)
      .select("_id leadId")
      .lean();
    if (!leadEngagement) return res.status(404).json({ message: "Lead engagement not found." });

    const lead = await Lead.findById(leadEngagement.leadId)
      .select("leadCode prospectId")
      .lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const prospect = await Prospect.findOne({
      _id: lead.prospectId,
      assignedToUserId: userObjectId,
    })
      .select("firstName middleName lastName age")
      .lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const policyNumberFilter = String(policyholder.policyNumber || "").trim();
    const policyLookupConditions = [{ leadEngagementId: policyholder.leadEngagementId }];
    if (policyNumberFilter) {
      policyLookupConditions.push(
        { "uploadPolicySummary.policyNumber": policyNumberFilter },
        { "recordCoverageDurationDetails.policyNumber": policyNumberFilter }
      );
    }

    const [product, policy, application, payments] = await Promise.all([
      policyholder.productId
        ? Product.findById(policyholder.productId).select("productName").lean()
        : null,
      Policy.findOne({ $or: policyLookupConditions })
        .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
        .select("uploadPolicySummary recordCoverageDurationDetails")
        .lean(),
      Application.findOne({ leadEngagementId: policyholder.leadEngagementId })
        .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
        .select("attemptCycle recordPremiumPaymentTransfer.methodForRenewalPayment")
        .lean(),
      Payment.find({ annualPaymentId: annualPaymentObjectId })
        .select("status recordPremiumPaymentTransfer uploadPremiumPaymentEor createdAt updatedAt")
        .sort({ "recordPremiumPaymentTransfer.paymentDate": -1, createdAt: -1 })
        .lean(),
    ]);

    const summary = policy?.uploadPolicySummary || {};
    const coverage = policy?.recordCoverageDurationDetails || {};
    const policyNumber = policyholder.policyNumber || summary.policyNumber || coverage.policyNumber || "";
    const prospectName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
    let annualPaymentNextPaymentDate = null;
    if (String(annualPayment.status || "") !== "Completed") {
      const candidateNextPaymentDate = policyholder.nextPaymentDate ? new Date(policyholder.nextPaymentDate) : null;
      const periodStartDate = annualPayment.annualPaymentPeriod?.startDate ? new Date(annualPayment.annualPaymentPeriod.startDate) : null;
      const periodEndDate = annualPayment.annualPaymentPeriod?.endDate ? new Date(annualPayment.annualPaymentPeriod.endDate) : null;
      if (
        candidateNextPaymentDate
        && !Number.isNaN(candidateNextPaymentDate.getTime())
        && (!periodStartDate || Number.isNaN(periodStartDate.getTime()) || candidateNextPaymentDate >= periodStartDate)
        && (!periodEndDate || Number.isNaN(periodEndDate.getTime()) || candidateNextPaymentDate <= periodEndDate)
      ) {
        annualPaymentNextPaymentDate = candidateNextPaymentDate;
      }
    }

    return res.json({
      prospect: {
        _id: prospect._id,
        fullName: prospectName,
        age: prospect.age ?? null,
      },
      lead: {
        _id: lead._id,
        leadCode: lead.leadCode,
      },
      policyholder: {
        _id: policyholder._id,
        policyholderCode: policyholder.policyholderCode,
        policyNumber,
        status: policyholder.status,
        lastPaidDate: policyholder.lastPaidDate || null,
        nextPaymentDate: policyholder.nextPaymentDate || null,
      },
      policySummary: {
        policyNumber,
        fileName: summary.policySummaryFileName || "",
        mimeType: summary.policySummaryFileMimeType || "",
        fileDataUrl: summary.policySummaryFileDataUrl || "",
        uploadedAt: summary.uploadedAt || null,
      },
      application: {
        methodForRenewalPayment: application?.recordPremiumPaymentTransfer?.methodForRenewalPayment || "",
      },
      product: {
        _id: product?._id || policyholder.productId || null,
        productName: product?.productName || "",
      },
      annualPayment: {
        _id: annualPayment._id,
        annualPaymentId: annualPayment._id,
        annualPaymentPeriod: annualPayment.annualPaymentPeriod || {},
        label: annualPayment?.annualPaymentPeriod?.label || "",
        totalAnnualPremiumPhp: annualPayment.totalAnnualPremiumPhp ?? null,
        amountPaidSoFarPhp: annualPayment.amountPaidSoFarPhp ?? 0,
        remainingBalancePhp: annualPayment.remainingBalancePhp ?? 0,
        frequencyOfPayment: annualPayment.frequencyOfPayment || "",
        paymentProgress: annualPayment.paymentProgress || { paidCount: 0, totalCount: 0, label: "0/0" },
        status: annualPayment.status || "Not Started",
        nextPaymentDate: annualPaymentNextPaymentDate,
        createdAt: annualPayment.createdAt || null,
        updatedAt: annualPayment.updatedAt || null,
      },
      payments: payments.map((payment) => ({
        _id: payment._id,
        paymentId: payment._id,
        status: payment.status || "Pending",
        totalPremiumPaidPhp: paymentDisplayPremiumPaidAmount(payment, annualPayment),
        overdueFeePhp: payment?.recordPremiumPaymentTransfer?.overdueFeePhp ?? 0,
        paymentCountCovered: payment?.recordPremiumPaymentTransfer?.paymentCountCovered ?? 1,
        isMissedPaymentRecord: payment?.recordPremiumPaymentTransfer?.isMissedPaymentRecord === true,
        paymentDate: payment?.recordPremiumPaymentTransfer?.paymentDate || null,
        isPaidLate: isPaymentTransferLate(payment),
        paymentDeadlineDate: payment?.recordPremiumPaymentTransfer?.paymentPeriod?.startDate || null,
        paymentPeriod: payment?.recordPremiumPaymentTransfer?.paymentPeriod || {},
        paymentPeriodLabel: payment?.recordPremiumPaymentTransfer?.paymentPeriod?.label || "",
        methodForPayment: payment?.recordPremiumPaymentTransfer?.methodForPayment || "",
        proofOfPaymentFileName: payment?.recordPremiumPaymentTransfer?.proofOfPaymentFileName || "",
        proofOfPaymentFileMimeType: payment?.recordPremiumPaymentTransfer?.proofOfPaymentFileMimeType || "",
        savedAt: payment?.recordPremiumPaymentTransfer?.savedAt || null,
        eorNumber: payment?.uploadPremiumPaymentEor?.eorNumber || "",
        receiptDate: payment?.uploadPremiumPaymentEor?.receiptDate || null,
        eorFileName: payment?.uploadPremiumPaymentEor?.eorFileName || "",
        uploadedAt: payment?.uploadPremiumPaymentEor?.uploadedAt || null,
        createdAt: payment.createdAt || null,
        updatedAt: payment.updatedAt || null,
      })),
    });
  } catch (err) {
    console.error("Get annual payment details error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// GET /api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId?userId=...
app.get("/api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId", async (req, res) => {
  try {
    const { userId } = req.query;
    const { policyholderId, annualPaymentId, paymentId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });
    if (!mongoose.isValidObjectId(annualPaymentId)) return res.status(400).json({ message: "Invalid annualPaymentId." });
    if (!mongoose.isValidObjectId(paymentId)) return res.status(400).json({ message: "Invalid paymentId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);
    const annualPaymentObjectId = new mongoose.Types.ObjectId(annualPaymentId);
    const paymentObjectId = new mongoose.Types.ObjectId(paymentId);

    const policyholder = await Policyholder.findOne({
      _id: policyholderObjectId,
      assignedToUserId: userObjectId,
    })
      .select("assignedToUserId policyholderCode productId policyNumber leadEngagementId status annualPaymentRecords")
      .lean();

    if (!policyholder) return res.status(404).json({ message: "Policyholder not found." });

    const annualPaymentIsLinked = (policyholder.annualPaymentRecords || []).some(
      (record) => String(record?.annualPaymentId || "") === String(annualPaymentObjectId)
    );

    const annualPayment = await AnnualPayment.findOne({
      _id: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    })
      .select("leadEngagementId annualPaymentPeriod totalAnnualPremiumPhp amountPaidSoFarPhp remainingBalancePhp frequencyOfPayment paymentProgress status createdAt updatedAt")
      .lean();

    if (!annualPayment || (!annualPaymentIsLinked && String(annualPayment.leadEngagementId || "") !== String(policyholder.leadEngagementId || ""))) {
      return res.status(404).json({ message: "Annual payment record not found." });
    }

    const payment = await Payment.findOne({
      _id: paymentObjectId,
      annualPaymentId: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    })
      .select("status recordPremiumPaymentTransfer uploadPremiumPaymentEor createdAt updatedAt")
      .lean();

    if (!payment) return res.status(404).json({ message: "Payment record not found." });

    const leadEngagement = await LeadEngagement.findById(policyholder.leadEngagementId)
      .select("_id leadId")
      .lean();
    if (!leadEngagement) return res.status(404).json({ message: "Lead engagement not found." });

    const lead = await Lead.findById(leadEngagement.leadId)
      .select("leadCode prospectId")
      .lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const prospect = await Prospect.findOne({
      _id: lead.prospectId,
      assignedToUserId: userObjectId,
    })
      .select("firstName middleName lastName age")
      .lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const policyNumberFilter = String(policyholder.policyNumber || "").trim();
    const policyLookupConditions = [{ leadEngagementId: policyholder.leadEngagementId }];
    if (policyNumberFilter) {
      policyLookupConditions.push(
        { "uploadPolicySummary.policyNumber": policyNumberFilter },
        { "recordCoverageDurationDetails.policyNumber": policyNumberFilter }
      );
    }

    const [product, policy, annualPayments] = await Promise.all([
      policyholder.productId
        ? Product.findById(policyholder.productId).select("productName").lean()
        : null,
      Policy.findOne({ $or: policyLookupConditions })
        .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
        .select("uploadPolicySummary recordCoverageDurationDetails")
        .lean(),
      Payment.find({ annualPaymentId: annualPaymentObjectId })
        .select("_id")
        .sort({ "recordPremiumPaymentTransfer.paymentDate": -1, createdAt: -1 })
        .lean(),
    ]);

    const paymentIndex = annualPayments.findIndex((candidate) => String(candidate?._id || "") === String(paymentObjectId));
    const paymentNumber = paymentIndex >= 0 ? annualPayments.length - paymentIndex : null;
    const summary = policy?.uploadPolicySummary || {};
    const coverage = policy?.recordCoverageDurationDetails || {};
    const policyNumber = policyholder.policyNumber || summary.policyNumber || coverage.policyNumber || "";
    const prospectName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
    return res.json({
      prospect: {
        _id: prospect._id,
        fullName: prospectName,
        age: prospect.age ?? null,
      },
      lead: {
        _id: lead._id,
        leadCode: lead.leadCode,
      },
      policyholder: {
        _id: policyholder._id,
        policyholderCode: policyholder.policyholderCode,
        policyNumber,
        status: policyholder.status,
      },
      policySummary: {
        policyNumber,
        fileName: summary.policySummaryFileName || "",
        mimeType: summary.policySummaryFileMimeType || "",
        fileDataUrl: summary.policySummaryFileDataUrl || "",
        uploadedAt: summary.uploadedAt || null,
      },
      product: {
        _id: product?._id || policyholder.productId || null,
        productName: product?.productName || "",
      },
      annualPayment: {
        _id: annualPayment._id,
        annualPaymentId: annualPayment._id,
        annualPaymentPeriod: annualPayment.annualPaymentPeriod || {},
        label: annualPayment?.annualPaymentPeriod?.label || "",
        totalAnnualPremiumPhp: annualPayment.totalAnnualPremiumPhp ?? null,
        amountPaidSoFarPhp: annualPayment.amountPaidSoFarPhp ?? 0,
        remainingBalancePhp: annualPayment.remainingBalancePhp ?? 0,
        frequencyOfPayment: annualPayment.frequencyOfPayment || "",
        paymentProgress: annualPayment.paymentProgress || { paidCount: 0, totalCount: 0, label: "0/0" },
        status: annualPayment.status || "Not Started",
      },
      payment: {
        _id: payment._id,
        paymentId: payment._id,
        paymentNumber,
        status: payment.status || "Pending",
        totalPremiumPaidPhp: paymentDisplayPremiumPaidAmount(payment, annualPayment),
        overdueFeePhp: payment?.recordPremiumPaymentTransfer?.overdueFeePhp ?? 0,
        paymentCountCovered: payment?.recordPremiumPaymentTransfer?.paymentCountCovered ?? 1,
        isMissedPaymentRecord: payment?.recordPremiumPaymentTransfer?.isMissedPaymentRecord === true,
        frequencyOfPremiumPayment: payment?.recordPremiumPaymentTransfer?.frequencyOfPremiumPayment || "",
        paymentDate: payment?.recordPremiumPaymentTransfer?.paymentDate || null,
        isPaidLate: isPaymentTransferLate(payment),
        paymentDeadlineDate: payment?.recordPremiumPaymentTransfer?.paymentPeriod?.startDate || null,
        paymentPeriod: payment?.recordPremiumPaymentTransfer?.paymentPeriod || {},
        paymentPeriodLabel: payment?.recordPremiumPaymentTransfer?.paymentPeriod?.label || "",
        methodForPayment: payment?.recordPremiumPaymentTransfer?.methodForPayment || "",
        proofOfPaymentFileName: payment?.recordPremiumPaymentTransfer?.proofOfPaymentFileName || "",
        proofOfPaymentFileMimeType: payment?.recordPremiumPaymentTransfer?.proofOfPaymentFileMimeType || "",
        proofOfPaymentFileDataUrl: payment?.recordPremiumPaymentTransfer?.proofOfPaymentFileDataUrl || "",
        savedAt: payment?.recordPremiumPaymentTransfer?.savedAt || null,
        eorNumber: payment?.uploadPremiumPaymentEor?.eorNumber || "",
        receiptDate: payment?.uploadPremiumPaymentEor?.receiptDate || null,
        eorFileName: payment?.uploadPremiumPaymentEor?.eorFileName || "",
        eorFileMimeType: payment?.uploadPremiumPaymentEor?.eorFileMimeType || "",
        eorFileDataUrl: payment?.uploadPremiumPaymentEor?.eorFileDataUrl || "",
        uploadedAt: payment?.uploadPremiumPaymentEor?.uploadedAt || null,
        createdAt: payment.createdAt || null,
        updatedAt: payment.updatedAt || null,
      },
    });
  } catch (err) {
    console.error("Get payment record details error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});



// POST /api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments?userId=...
app.post("/api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments", async (req, res) => {
  try {
    const { userId } = req.query;
    const { policyholderId, annualPaymentId } = req.params;
    const {
      totalPremiumPaidPhp,
      paymentDate,
      methodForPayment,
      proofOfPaymentFileDataUrl,
      proofOfPaymentFileName,
      proofOfPaymentFileMimeType,
      overdueFeePhp,
      isMissedPaymentRecord,
    } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });
    if (!mongoose.isValidObjectId(annualPaymentId)) return res.status(400).json({ message: "Invalid annualPaymentId." });

    const paymentMethod = String(methodForPayment || "").trim();
    const allowedPaymentMethods = ["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: "Valid method of payment is required." });
    }

    const proofDataUrl = String(proofOfPaymentFileDataUrl || "").trim();
    const proofFileName = String(proofOfPaymentFileName || "").trim();
    const proofMimeType = String(proofOfPaymentFileMimeType || "").trim();
    if (!proofDataUrl || !proofFileName) {
      return res.status(400).json({ message: "Proof of payment file is required." });
    }
    if (!/^data:(?:image\/(?:jpeg|png)|application\/pdf);base64,/i.test(proofDataUrl)) {
      return res.status(400).json({ message: "Proof of payment must be a JPG, PNG, or PDF file." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);
    const annualPaymentObjectId = new mongoose.Types.ObjectId(annualPaymentId);

    const policyholder = await Policyholder.findOne({
      _id: policyholderObjectId,
      assignedToUserId: userObjectId,
    }).select("assignedToUserId policyholderCode policyNumber productId leadEngagementId lastPaidDate nextPaymentDate annualPaymentRecords status");

    if (!policyholder) return res.status(404).json({ message: "Policyholder not found." });
    if (TERMINAL_POLICYHOLDER_STATUSES.includes(String(policyholder.status || ""))) {
      return res.status(409).json({ message: "Payment records cannot be added once policy payment tracking has ended." });
    }

    const annualPaymentIsLinked = (policyholder.annualPaymentRecords || []).some(
      (record) => String(record?.annualPaymentId || "") === String(annualPaymentObjectId)
    );

    const annualPayment = await AnnualPayment.findOne({
      _id: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    });

    if (!annualPayment || (!annualPaymentIsLinked && String(annualPayment.leadEngagementId || "") !== String(policyholder.leadEngagementId || ""))) {
      return res.status(404).json({ message: "Annual payment record not found." });
    }

    if (!["Not Started", "Ongoing"].includes(String(annualPayment.status || ""))) {
      return res.status(409).json({ message: "This annual payment record is already completed." });
    }

    const leadEngagement = await LeadEngagement.findById(policyholder.leadEngagementId).select("leadId contactAttemptCycle").lean();
    const lead = leadEngagement?.leadId ? await Lead.findById(leadEngagement.leadId).select("prospectId").lean() : null;
    const [policy, prospect] = await Promise.all([
      Policy.findOne({ leadEngagementId: policyholder.leadEngagementId })
        .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
        .select("recordCoverageDurationDetails")
        .lean(),
      lead?.prospectId
        ? Prospect.findById(lead.prospectId).select("birthday").lean()
        : null,
    ]);
    const paymentTermEndDate = derivePaymentTermEndDate(policy, prospect);
    const paymentAttemptCycle = normalizeAttemptCycle(leadEngagement?.contactAttemptCycle, annualPayment.attemptCycle || 1);

    const expectedPaymentCount = annualPaymentTotalCountForFrequency(annualPayment.frequencyOfPayment);
    const expectedAmount = expectedPaymentCount > 0
      ? Math.round((Number(annualPayment.totalAnnualPremiumPhp || 0) / expectedPaymentCount) * 100) / 100
      : Number(totalPremiumPaidPhp);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(400).json({ message: "Total premium paid cannot be derived from the annual payment record." });
    }

    const submittedPaymentDate = paymentDate ? new Date(`${String(paymentDate).slice(0, 10)}T00:00:00`) : null;
    if (!submittedPaymentDate || Number.isNaN(submittedPaymentDate.getTime())) {
      return res.status(400).json({ message: "Payment date is required." });
    }
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (submittedPaymentDate > todayEnd) {
      return res.status(400).json({ message: "Payment date cannot be in the future." });
    }

    const missedPaymentMode = isMissedPaymentRecord === true || String(isMissedPaymentRecord || "").toLowerCase() === "true";
    const overdueFee = Number(overdueFeePhp || 0);
    if (!Number.isFinite(overdueFee) || overdueFee < 0) {
      return res.status(400).json({ message: "Overdue fee must be zero or a positive amount." });
    }
    if (missedPaymentMode && String(policyholder.status || "") !== "Lapsed") {
      return res.status(409).json({ message: "Missed payment records can only be added for lapsed policyholders." });
    }

    const existingPayments = await Payment.find({ annualPaymentId: annualPayment._id })
      .select("recordPremiumPaymentTransfer.paymentDate recordPremiumPaymentTransfer.paymentPeriod recordPremiumPaymentTransfer.totalPremiumPaidPhp recordPremiumPaymentTransfer.paymentCountCovered")
      .lean();
    const existingPaidCount = existingPayments.reduce((sum, payment) => sum + paymentCoveredCount(payment), 0);
    if (expectedPaymentCount > 0 && existingPaidCount >= expectedPaymentCount) {
      annualPayment.status = "Completed";
      annualPayment.paymentProgress = {
        paidCount: existingPaidCount,
        totalCount: expectedPaymentCount,
        label: `${existingPaidCount}/${expectedPaymentCount}`,
      };
      await annualPayment.save();
      return res.status(409).json({ message: "Individual payment records are already complete for this annual payment period." });
    }
    const latestActualPaymentDate = existingPayments
      .map((payment) => payment?.recordPremiumPaymentTransfer?.paymentDate ? new Date(payment.recordPremiumPaymentTransfer.paymentDate) : null)
      .filter((date) => date && !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;
    const policyholderLastPaidDate = policyholder.lastPaidDate ? new Date(policyholder.lastPaidDate) : null;
    const lastActualPaymentDate = [latestActualPaymentDate, policyholderLastPaidDate]
      .filter((date) => date && !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;
    if (lastActualPaymentDate) {
      const minimumPaymentDate = new Date(lastActualPaymentDate);
      minimumPaymentDate.setHours(0, 0, 0, 0);
      if (submittedPaymentDate <= minimumPaymentDate) {
        return res.status(400).json({ message: "Payment date must be after the last payment date." });
      }
    }

    const latestPaymentPeriodEndDate = existingPayments
      .map((payment) => payment?.recordPremiumPaymentTransfer?.paymentPeriod?.endDate ? new Date(payment.recordPremiumPaymentTransfer.paymentPeriod.endDate) : null)
      .filter((date) => date && !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;
    const annualStartDate = annualPayment.annualPaymentPeriod?.startDate
      ? new Date(annualPayment.annualPaymentPeriod.startDate)
      : null;
    const paymentPeriodStartDate = latestPaymentPeriodEndDate
      ? new Date(latestPaymentPeriodEndDate)
      : annualStartDate;
    if (latestPaymentPeriodEndDate) paymentPeriodStartDate.setDate(paymentPeriodStartDate.getDate() + 1);
    if (!paymentPeriodStartDate || Number.isNaN(paymentPeriodStartDate.getTime())) {
      return res.status(400).json({ message: "Payment period cannot be derived for this annual payment record." });
    }
    if (missedPaymentMode) {
      const atRiskStartDate = nextDay(paymentPeriodStartDate);
      if (atRiskStartDate && submittedPaymentDate < atRiskStartDate) {
        return res.status(400).json({ message: "Payment date must be on or after the day the policyholder became at risk." });
      }
    }

    let paymentPeriod = derivePaymentPeriod(paymentPeriodStartDate, annualPayment.frequencyOfPayment);
    let paymentCountCovered = 1;
    if (missedPaymentMode) {
      const intervalMonths = getPaymentFrequencyIntervalMonths(annualPayment.frequencyOfPayment);
      const remainingCount = expectedPaymentCount > 0 ? Math.max(1, expectedPaymentCount - existingPaidCount) : 1;
      let cursorStart = new Date(paymentPeriodStartDate);
      let coveredPeriod = derivePaymentPeriod(cursorStart, annualPayment.frequencyOfPayment);
      paymentCountCovered = 1;
      while (
        intervalMonths
        && coveredPeriod?.endDate
        && submittedPaymentDate > new Date(coveredPeriod.endDate)
        && paymentCountCovered < remainingCount
      ) {
        cursorStart = nextDay(coveredPeriod.endDate);
        coveredPeriod = derivePaymentPeriod(cursorStart, annualPayment.frequencyOfPayment);
        paymentCountCovered += 1;
      }
      paymentPeriod = {
        startDate: paymentPeriodStartDate,
        endDate: coveredPeriod?.endDate || paymentPeriod?.endDate || null,
        label: `${formatPaymentPeriodDate(paymentPeriodStartDate)} - ${formatPaymentPeriodDate(coveredPeriod?.endDate || paymentPeriod?.endDate)}`,
      };
    }
    const totalPremiumForRecord = Math.round((expectedAmount * paymentCountCovered) * 100) / 100;
    await ensurePaymentLeadEngagementIndex();
    const now = new Date();
    const paymentDoc = await Payment.create({
      leadEngagementId: policyholder.leadEngagementId,
      annualPaymentId: annualPayment._id,
      attemptCycle: paymentAttemptCycle,
      status: "Pending",
      recordPremiumPaymentTransfer: {
        totalPremiumPaidPhp: totalPremiumForRecord,
        overdueFeePhp: missedPaymentMode ? overdueFee : 0,
        paymentCountCovered,
        isMissedPaymentRecord: missedPaymentMode,
        frequencyOfPremiumPayment: annualPayment.frequencyOfPayment || "",
        paymentDate: submittedPaymentDate,
        paymentPeriod,
        methodForPayment: paymentMethod,
        proofOfPaymentFileName: proofFileName,
        proofOfPaymentFileMimeType: proofMimeType,
        proofOfPaymentFileDataUrl: proofDataUrl,
        savedAt: now,
        eorReminderEnabled: false,
      },
    });

    const annualPayments = await Payment.find({ annualPaymentId: annualPayment._id })
      .select("recordPremiumPaymentTransfer")
      .lean();
    const amountPaidSoFarPhp = annualPayments.reduce((sum, payment) => sum + paymentPremiumPaidAmount(payment), 0);
    const paidCount = annualPayments.reduce((sum, payment) => sum + paymentCoveredCount(payment), 0);
    const metrics = buildAnnualPaymentMetrics({
      totalAnnualPremiumPhp: annualPayment.totalAnnualPremiumPhp,
      amountPaidSoFarPhp,
      paidCount,
      frequencyOfPayment: annualPayment.frequencyOfPayment,
    });
    annualPayment.attemptCycle = paymentAttemptCycle;
    annualPayment.amountPaidSoFarPhp = metrics.amountPaidSoFarPhp;
    annualPayment.remainingBalancePhp = metrics.remainingBalancePhp;
    annualPayment.paymentProgress = metrics.paymentProgress;
    annualPayment.status = metrics.status;
    await annualPayment.save();

    let nextPaymentDate = deriveNextPaymentDateAfterPeriod(paymentPeriod, annualPayment.frequencyOfPayment, paymentTermEndDate);
    let nextAnnualPaymentDoc = null;
    if (metrics.status === "Completed") {
      nextPaymentDate = null;
      const nextAnnualStartDate = nextDay(annualPayment.annualPaymentPeriod?.endDate);
      if (nextAnnualStartDate && isBeforePaymentTermEnd(nextAnnualStartDate, paymentTermEndDate)) {
        await ensureAnnualPaymentLeadEngagementIndex();
        const nextAnnualPeriod = deriveAnnualPaymentPeriod(nextAnnualStartDate);
        const nextAnnualMetrics = buildAnnualPaymentMetrics({
          totalAnnualPremiumPhp: annualPayment.totalAnnualPremiumPhp,
          amountPaidSoFarPhp: 0,
          paidCount: 0,
          frequencyOfPayment: annualPayment.frequencyOfPayment,
        });
        nextAnnualPaymentDoc = await AnnualPayment.findOneAndUpdate(
          {
            leadEngagementId: policyholder.leadEngagementId,
            "annualPaymentPeriod.startDate": nextAnnualPeriod.startDate,
          },
          {
            $setOnInsert: {
              leadEngagementId: policyholder.leadEngagementId,
              annualPaymentPeriod: nextAnnualPeriod,
              totalAnnualPremiumPhp: annualPayment.totalAnnualPremiumPhp,
              frequencyOfPayment: annualPayment.frequencyOfPayment || "",
              ...nextAnnualMetrics,
            },
            $set: {
              attemptCycle: paymentAttemptCycle,
            },
          },
          { upsert: true, new: true }
        );
        nextPaymentDate = nextAnnualStartDate;
      }
    }

    const previousPolicyholderStatus = String(policyholder.status || "");
    let nextPolicyholderStatus = ["At Risk", "Lapsed"].includes(previousPolicyholderStatus) ? "Active" : previousPolicyholderStatus;
    const lifecycle = derivePolicyholderLifecycleStatus({
      currentStatus: nextPolicyholderStatus,
      policy,
      nextPaymentDate,
      annualPayments: [annualPayment, ...(nextAnnualPaymentDoc ? [nextAnnualPaymentDoc] : [])],
    });
    if (TERMINAL_POLICYHOLDER_STATUSES.includes(lifecycle.status)) {
      nextPaymentDate = null;
      nextPolicyholderStatus = lifecycle.status;
    }

    policyholder.lastPaidDate = submittedPaymentDate;
    policyholder.nextPaymentDate = nextPaymentDate;
    policyholder.status = nextPolicyholderStatus;
    if (nextAnnualPaymentDoc?._id) {
      const alreadyRecorded = (policyholder.annualPaymentRecords || []).some(
        (record) => String(record?.annualPaymentId || "") === String(nextAnnualPaymentDoc._id)
      );
      if (!alreadyRecorded) {
        policyholder.annualPaymentRecords.push({ annualPaymentId: nextAnnualPaymentDoc._id, recordedAt: now });
      }
    }
    await policyholder.save();
    if (["Paid-Up", "Matured"].includes(nextPolicyholderStatus)) {
      if (nextPolicyholderStatus === "Matured") {
        await AnnualPayment.updateMany(
          { leadEngagementId: policyholder.leadEngagementId, status: { $in: ["Not Started", "Ongoing"] } },
          { $set: { status: "No Longer Pursued" } }
        );
      }
      await softDeletePaymentTrackingNotificationsForPolicyholder(policyholder, `Policy became ${nextPolicyholderStatus}.`);
      await createPolicyLifecycleNotification(policyholder, policy, prospect, lifecycle, previousPolicyholderStatus);
    }

    return res.status(201).json({
      message: "Payment record added.",
      paymentId: paymentDoc._id,
      annualPaymentId: annualPayment._id,
      nextAnnualPaymentId: nextAnnualPaymentDoc?._id || null,
      lastPaidDate: policyholder.lastPaidDate || null,
      nextPaymentDate: policyholder.nextPaymentDate || null,
    });
  } catch (err) {
    console.error("Add annual payment record error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});




// POST /api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId/eor-reminder?userId=...
app.post("/api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId/eor-reminder", async (req, res) => {
  try {
    const { userId } = req.query;
    const { policyholderId, annualPaymentId, paymentId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });
    if (!mongoose.isValidObjectId(annualPaymentId)) return res.status(400).json({ message: "Invalid annualPaymentId." });
    if (!mongoose.isValidObjectId(paymentId)) return res.status(400).json({ message: "Invalid paymentId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);
    const annualPaymentObjectId = new mongoose.Types.ObjectId(annualPaymentId);
    const paymentObjectId = new mongoose.Types.ObjectId(paymentId);

    const policyholder = await Policyholder.findOne({
      _id: policyholderObjectId,
      assignedToUserId: userObjectId,
    }).select("assignedToUserId policyholderCode policyNumber productId leadEngagementId nextPaymentDate annualPaymentRecords status").lean();

    if (!policyholder) return res.status(404).json({ message: "Policyholder not found." });
    if (TERMINAL_POLICYHOLDER_STATUSES.includes(String(policyholder.status || ""))) {
      return res.status(409).json({ message: "Payment reminders cannot be enabled after policy payment tracking has ended." });
    }

    const annualPaymentIsLinked = (policyholder.annualPaymentRecords || []).some(
      (record) => String(record?.annualPaymentId || "") === String(annualPaymentObjectId)
    );

    const annualPayment = await AnnualPayment.findOne({
      _id: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    }).select("_id leadEngagementId").lean();

    if (!annualPayment || (!annualPaymentIsLinked && String(annualPayment.leadEngagementId || "") !== String(policyholder.leadEngagementId || ""))) {
      return res.status(404).json({ message: "Annual payment record not found." });
    }

    const paymentDoc = await Payment.findOne({
      _id: paymentObjectId,
      annualPaymentId: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    });

    if (!paymentDoc) return res.status(404).json({ message: "Payment record not found." });
    if (!paymentHasCompletedPremiumTransfer(paymentDoc)) {
      return res.status(409).json({ message: "Premium payment transfer must be saved before enabling eOR reminders." });
    }
    if (paymentHasUploadedEor(paymentDoc) || String(paymentDoc.status || "") === "Processed") {
      return res.status(409).json({ message: "Premium payment eOR has already been uploaded." });
    }

    paymentDoc.set("recordPremiumPaymentTransfer.eorReminderEnabled", true);
    await paymentDoc.save();

    const todayKey = dateKeyInTZ(new Date(), "Asia/Manila");
    const paymentDateKey = dateKeyInTZ(
      policyholder.nextPaymentDate || paymentDoc?.recordPremiumPaymentTransfer?.paymentDate || new Date(),
      "Asia/Manila"
    );

    const [product, leadEngagement] = await Promise.all([
      policyholder.productId ? Product.findById(policyholder.productId).select("productName").lean() : null,
      policyholder.leadEngagementId ? LeadEngagement.findById(policyholder.leadEngagementId).select("leadId").lean() : null,
    ]);
    const lead = leadEngagement?.leadId ? await Lead.findById(leadEngagement.leadId).select("prospectId").lean() : null;
    const prospect = lead?.prospectId
      ? await Prospect.findById(lead.prospectId).select("firstName middleName lastName").lean()
      : null;
    const policyholderName = [prospect?.firstName, prospect?.middleName, prospect?.lastName].filter(Boolean).join(" ").trim() || "—";
    const policyName = product?.productName || "—";
    const policyNumber = policyholder.policyNumber || "—";
    const policyholderCode = policyholder.policyholderCode || "—";
    const notificationMessage = `The premium payment transfer has been recorded, but the eOR has not been uploaded yet. Policyholder Code: ${policyholderCode}. Policyholder Name: ${policyholderName}. Policy Name: ${policyName}. Policy Number: ${policyNumber}.`;
    const dedupeKey = `PAYMENT_REMINDER:${policyholder._id}:${annualPayment._id}:${todayKey}`;

    const notificationResult = await Notification.updateOne(
      { assignedToUserId: userObjectId, dedupeKey },
      {
        $set: {
          type: "PAYMENT_EOR_REMINDER",
          title: "Upload premium payment eOR",
          message: notificationMessage,
          entityType: "Policyholder",
          entityId: policyholder._id,
          status: "Unread",
          readAt: null,
          softDeletedAt: null,
          metadata: {
            policyholderId: String(policyholder._id),
            annualPaymentId: String(annualPayment._id),
            paymentId: String(paymentDoc._id),
            nextPaymentDate: policyholder.nextPaymentDate || paymentDoc?.recordPremiumPaymentTransfer?.paymentDate || null,
            nextPaymentDateKey: paymentDateKey || todayKey,
            policyholderCode,
            reminderDateKey: todayKey,
          },
        },
        $setOnInsert: {
          assignedToUserId: userObjectId,
          dedupeKey,
        },
      },
      { upsert: true }
    );

    return res.json({
      message: "Premium payment eOR reminders enabled.",
      paymentId: paymentDoc._id,
      annualPaymentId: annualPayment._id,
      notificationGenerated: true,
      notificationUpserted: Boolean(notificationResult?.upsertedCount || notificationResult?.modifiedCount || notificationResult?.matchedCount),
    });
  } catch (err) {
    console.error("Enable annual payment eOR reminder error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// PUT /api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId/transfer?userId=...
app.put("/api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId/transfer", async (req, res) => {
  try {
    const { userId } = req.query;
    const { policyholderId, annualPaymentId, paymentId } = req.params;
    const {
      totalPremiumPaidPhp,
      paymentDate,
      methodForPayment,
      proofOfPaymentFileDataUrl,
      proofOfPaymentFileName,
      proofOfPaymentFileMimeType,
    } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });
    if (!mongoose.isValidObjectId(annualPaymentId)) return res.status(400).json({ message: "Invalid annualPaymentId." });
    if (!mongoose.isValidObjectId(paymentId)) return res.status(400).json({ message: "Invalid paymentId." });

    const paymentMethod = String(methodForPayment || "").trim();
    const allowedPaymentMethods = ["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"];
    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: "Valid method of payment is required." });
    }

    const proofDataUrl = String(proofOfPaymentFileDataUrl || "").trim();
    const proofFileName = String(proofOfPaymentFileName || "").trim();
    const proofMimeType = String(proofOfPaymentFileMimeType || "").trim();
    if (!proofDataUrl || !proofFileName) {
      return res.status(400).json({ message: "Proof of payment file is required." });
    }
    if (!/^data:(?:image\/(?:jpeg|png)|application\/pdf);base64,/i.test(proofDataUrl)) {
      return res.status(400).json({ message: "Proof of payment must be a JPG, PNG, or PDF file." });
    }

    const submittedPaymentDate = paymentDate ? new Date(`${String(paymentDate).slice(0, 10)}T00:00:00`) : null;
    if (!submittedPaymentDate || Number.isNaN(submittedPaymentDate.getTime())) {
      return res.status(400).json({ message: "Payment date is required." });
    }
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (submittedPaymentDate > todayEnd) {
      return res.status(400).json({ message: "Payment date cannot be in the future." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);
    const annualPaymentObjectId = new mongoose.Types.ObjectId(annualPaymentId);
    const paymentObjectId = new mongoose.Types.ObjectId(paymentId);

    const policyholder = await Policyholder.findOne({
      _id: policyholderObjectId,
      assignedToUserId: userObjectId,
    }).select("assignedToUserId leadEngagementId annualPaymentRecords lastPaidDate nextPaymentDate status");

    if (!policyholder) return res.status(404).json({ message: "Policyholder not found." });

    const annualPaymentIsLinked = (policyholder.annualPaymentRecords || []).some(
      (record) => String(record?.annualPaymentId || "") === String(annualPaymentObjectId)
    );

    const annualPayment = await AnnualPayment.findOne({
      _id: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    });

    if (!annualPayment || (!annualPaymentIsLinked && String(annualPayment.leadEngagementId || "") !== String(policyholder.leadEngagementId || ""))) {
      return res.status(404).json({ message: "Annual payment record not found." });
    }

    const paymentDoc = await Payment.findOne({
      _id: paymentObjectId,
      annualPaymentId: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    });

    if (!paymentDoc) return res.status(404).json({ message: "Payment record not found." });
    if (String(paymentDoc.status || "") === "Processed") {
      return res.status(409).json({ message: "Processed payment transfer details can no longer be edited." });
    }
    const leadEngagement = await LeadEngagement.findById(policyholder.leadEngagementId).select("contactAttemptCycle").lean();
    const paymentAttemptCycle = normalizeAttemptCycle(leadEngagement?.contactAttemptCycle, paymentDoc.attemptCycle || annualPayment.attemptCycle || 1);

    const existingPayments = await Payment.find({
      annualPaymentId: annualPayment._id,
      _id: { $ne: paymentObjectId },
    })
      .select("recordPremiumPaymentTransfer.paymentDate")
      .lean();
    const previousPaymentDate = existingPayments
      .map((payment) => payment?.recordPremiumPaymentTransfer?.paymentDate ? new Date(payment.recordPremiumPaymentTransfer.paymentDate) : null)
      .filter((date) => date && !Number.isNaN(date.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())[0] || null;
    if (previousPaymentDate) {
      const minimumPaymentDate = new Date(previousPaymentDate);
      minimumPaymentDate.setHours(0, 0, 0, 0);
      if (submittedPaymentDate <= minimumPaymentDate) {
        return res.status(400).json({ message: "Payment date must be after the last payment date." });
      }
    }

    const expectedPaymentCount = annualPaymentTotalCountForFrequency(annualPayment.frequencyOfPayment);
    const expectedAmount = expectedPaymentCount > 0
      ? Math.round((Number(annualPayment.totalAnnualPremiumPhp || 0) / expectedPaymentCount) * 100) / 100
      : Number(totalPremiumPaidPhp);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(400).json({ message: "Total premium paid cannot be derived from the annual payment record." });
    }

    const existingTransfer = paymentDoc.recordPremiumPaymentTransfer || {};
    const paymentCountCovered = Number(existingTransfer.paymentCountCovered || 1);
    const safePaymentCountCovered = Number.isFinite(paymentCountCovered) && paymentCountCovered > 0 ? Math.max(1, Math.floor(paymentCountCovered)) : 1;
    const totalPremiumForRecord = Math.round((expectedAmount * safePaymentCountCovered) * 100) / 100;

    paymentDoc.set("attemptCycle", paymentAttemptCycle);
    paymentDoc.set("recordPremiumPaymentTransfer.totalPremiumPaidPhp", totalPremiumForRecord);
    paymentDoc.set("recordPremiumPaymentTransfer.frequencyOfPremiumPayment", annualPayment.frequencyOfPayment || "");
    paymentDoc.set("recordPremiumPaymentTransfer.paymentDate", submittedPaymentDate);
    paymentDoc.set("recordPremiumPaymentTransfer.methodForPayment", paymentMethod);
    paymentDoc.set("recordPremiumPaymentTransfer.proofOfPaymentFileName", proofFileName);
    paymentDoc.set("recordPremiumPaymentTransfer.proofOfPaymentFileMimeType", proofMimeType);
    paymentDoc.set("recordPremiumPaymentTransfer.proofOfPaymentFileDataUrl", proofDataUrl);
    paymentDoc.set("recordPremiumPaymentTransfer.savedAt", paymentDoc.recordPremiumPaymentTransfer?.savedAt || new Date());
    await paymentDoc.save();

    const annualPayments = await Payment.find({ annualPaymentId: annualPayment._id })
      .select("recordPremiumPaymentTransfer")
      .lean();
    const amountPaidSoFarPhp = annualPayments.reduce((sum, payment) => sum + paymentPremiumPaidAmount(payment), 0);
    const paidCount = annualPayments.reduce((sum, payment) => sum + paymentCoveredCount(payment), 0);
    const metrics = buildAnnualPaymentMetrics({
      totalAnnualPremiumPhp: annualPayment.totalAnnualPremiumPhp,
      amountPaidSoFarPhp,
      paidCount,
      frequencyOfPayment: annualPayment.frequencyOfPayment,
    });
    annualPayment.attemptCycle = paymentAttemptCycle;
    annualPayment.amountPaidSoFarPhp = metrics.amountPaidSoFarPhp;
    annualPayment.remainingBalancePhp = metrics.remainingBalancePhp;
    annualPayment.paymentProgress = metrics.paymentProgress;
    annualPayment.status = metrics.status;
    await annualPayment.save();
    await syncPolicyholderPaymentDates(policyholder);

    return res.json({
      message: "Premium payment transfer updated.",
      paymentId: paymentDoc._id,
      annualPaymentId: annualPayment._id,
      paymentDate: paymentDoc.recordPremiumPaymentTransfer?.paymentDate || null,
      lastPaidDate: policyholder.lastPaidDate || null,
      nextPaymentDate: policyholder.nextPaymentDate || null,
    });
  } catch (err) {
    console.error("Update annual payment transfer error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// POST /api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId/eor?userId=...
app.post("/api/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId/eor", async (req, res) => {
  try {
    const { userId } = req.query;
    const { policyholderId, annualPaymentId, paymentId } = req.params;
    const { eorNumber, receiptDate, eorFileDataUrl, eorFileName } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });
    if (!mongoose.isValidObjectId(annualPaymentId)) return res.status(400).json({ message: "Invalid annualPaymentId." });
    if (!mongoose.isValidObjectId(paymentId)) return res.status(400).json({ message: "Invalid paymentId." });

    const eorNo = String(eorNumber || "").trim();
    const receiptDateRaw = String(receiptDate || "").trim();
    const pdfDataUrl = String(eorFileDataUrl || "").trim();
    const fileName = String(eorFileName || "").trim();

    if (!eorNo) return res.status(400).json({ message: "eOR number is required." });
    if (!receiptDateRaw) return res.status(400).json({ message: "Receipt date is required." });
    if (!pdfDataUrl) return res.status(400).json({ message: "eOR PDF file is required." });
    if (!/^data:application\/pdf;base64,/i.test(pdfDataUrl)) {
      return res.status(400).json({ message: "eOR file must be a PDF." });
    }

    const receiptDateValue = new Date(`${receiptDateRaw}T00:00:00`);
    if (Number.isNaN(receiptDateValue.getTime())) {
      return res.status(400).json({ message: "Receipt date is invalid." });
    }
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (receiptDateValue > todayEnd) {
      return res.status(400).json({ message: "Receipt date cannot be in the future." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);
    const annualPaymentObjectId = new mongoose.Types.ObjectId(annualPaymentId);
    const paymentObjectId = new mongoose.Types.ObjectId(paymentId);

    const policyholder = await Policyholder.findOne({
      _id: policyholderObjectId,
      assignedToUserId: userObjectId,
    }).select("assignedToUserId leadEngagementId annualPaymentRecords status");

    if (!policyholder) return res.status(404).json({ message: "Policyholder not found." });

    const annualPaymentIsLinked = (policyholder.annualPaymentRecords || []).some(
      (record) => String(record?.annualPaymentId || "") === String(annualPaymentObjectId)
    );

    const annualPayment = await AnnualPayment.findOne({
      _id: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    }).select("_id leadEngagementId").lean();

    if (!annualPayment || !annualPaymentIsLinked) {
      return res.status(404).json({ message: "Annual payment record not found." });
    }

    const paymentDoc = await Payment.findOne({
      _id: paymentObjectId,
      annualPaymentId: annualPaymentObjectId,
      leadEngagementId: policyholder.leadEngagementId,
    });

    if (!paymentDoc) return res.status(404).json({ message: "Payment record not found." });
    if (!paymentHasCompletedPremiumTransfer(paymentDoc)) {
      return res.status(409).json({ message: "Premium payment transfer must be saved before uploading eOR." });
    }

    const duplicateEor = await Payment.findOne({
      _id: { $ne: paymentObjectId },
      "uploadPremiumPaymentEor.eorNumber": eorNo,
    }).select("_id").lean();
    if (duplicateEor) return res.status(409).json({ message: "Record already exists for this eOR number." });

    const paymentDate = paymentDoc.recordPremiumPaymentTransfer?.paymentDate
      ? new Date(paymentDoc.recordPremiumPaymentTransfer.paymentDate)
      : null;
    if (paymentDate && !Number.isNaN(paymentDate.getTime())) {
      const minReceiptDate = new Date(paymentDate);
      minReceiptDate.setHours(0, 0, 0, 0);
      if (receiptDateValue < minReceiptDate) {
        return res.status(400).json({ message: "Receipt date cannot be before the payment date." });
      }
    }

    const uploadedAt = new Date();
    paymentDoc.status = "Processed";
    paymentDoc.uploadPremiumPaymentEor = {
      eorNumber: eorNo,
      receiptDate: receiptDateValue,
      eorFileDataUrl: pdfDataUrl,
      eorFileName: fileName,
      eorFileMimeType: "application/pdf",
      uploadedAt,
    };
    await paymentDoc.save();
    await syncPolicyholderPaymentDates(policyholder);

    return res.json({
      message: "Premium payment eOR uploaded.",
      paymentId: paymentDoc._id,
      annualPaymentId: annualPayment._id,
      status: paymentDoc.status,
      lastPaidDate: policyholder.lastPaidDate || null,
      nextPaymentDate: policyholder.nextPaymentDate || null,
    });
  } catch (err) {
    console.error("Add annual payment eOR error:", err);
    if (err?.code === 11000 && /uploadPremiumPaymentEor\.eorNumber/.test(String(err?.message || ""))) {
      return res.status(409).json({ message: "Record already exists for this eOR number." });
    }
    return res.status(500).json({ message: "Server error." });
  }
});


// GET /api/prospects/:prospectId/leads/:leadId/policyholders/:policyholderId/details?userId=...
app.get("/api/prospects/:prospectId/leads/:leadId/policyholders/:policyholderId/details", async (req, res) => {
  try {
    const { userId } = req.query;
    const { prospectId, leadId, policyholderId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(prospectId)) return res.status(400).json({ message: "Invalid prospectId." });
    if (!mongoose.isValidObjectId(leadId)) return res.status(400).json({ message: "Invalid leadId." });
    if (!mongoose.isValidObjectId(policyholderId)) return res.status(400).json({ message: "Invalid policyholderId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);
    const policyholderObjectId = new mongoose.Types.ObjectId(policyholderId);

    const prospect = await Prospect.findOne({
      _id: prospectObjectId,
      assignedToUserId: userObjectId,
    })
      .select("firstName middleName lastName age")
      .lean();

    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const lead = await Lead.findOne({
      _id: leadObjectId,
      prospectId: prospectObjectId,
    })
      .select("leadCode")
      .lean();

    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const leadEngagement = await LeadEngagement.findOne({ leadId: leadObjectId })
      .select("_id")
      .lean();

    if (!leadEngagement) return res.status(404).json({ message: "Lead engagement not found." });

    const policyholderDoc = await Policyholder.findOne({
      _id: policyholderObjectId,
      leadEngagementId: leadEngagement._id,
      assignedToUserId: userObjectId,
    })
      .select("assignedToUserId policyholderCode productId policyNumber leadEngagementId lastPaidDate nextPaymentDate status annualPaymentRecords createdAt updatedAt");

    if (!policyholderDoc) return res.status(404).json({ message: "Policyholder not found." });
    await syncPolicyholderPaymentDates(policyholderDoc);
    const policyholder = policyholderDoc.toObject();

    const [product, policy] = await Promise.all([
      policyholder.productId
        ? Product.findById(policyholder.productId).select("productName").lean()
        : null,
      Policy.findOne({ leadEngagementId: leadEngagement._id })
        .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
        .select("recordPolicyApplicationStatus uploadPolicySummary recordCoverageDurationDetails")
        .lean(),
    ]);

    const coverage = policy?.recordCoverageDurationDetails || {};
    const policyIssuance = policy?.recordPolicyApplicationStatus || {};
    const summary = policy?.uploadPolicySummary || {};
    const prospectName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
    const annualPaymentRecords = await loadAnnualPaymentRecordsForPolicyholder(policyholder);

    return res.json({
      prospect: {
        _id: prospect._id,
        fullName: prospectName,
        age: prospect.age ?? null,
      },
      lead: {
        _id: lead._id,
        leadCode: lead.leadCode,
      },
      policyholder: {
        _id: policyholder._id,
        policyholderCode: policyholder.policyholderCode,
        policyNumber: policyholder.policyNumber || summary.policyNumber || coverage.policyNumber || "",
        status: policyholder.status,
        lastPaidDate: policyholder.lastPaidDate || null,
        nextPaymentDate: policyholder.nextPaymentDate || null,
        createdAt: policyholder.createdAt || null,
        updatedAt: policyholder.updatedAt || null,
      },
      policySummary: {
        policyNumber: summary.policyNumber || policyholder.policyNumber || coverage.policyNumber || "",
        fileName: summary.policySummaryFileName || "",
        mimeType: summary.policySummaryFileMimeType || "",
        fileDataUrl: summary.policySummaryFileDataUrl || "",
        uploadedAt: summary.uploadedAt || null,
      },
      product: {
        _id: product?._id || policyholder.productId || null,
        productName: product?.productName || "",
      },
      coverage: {
        policyIssuanceDate: policyIssuance.issuanceDate || null,
        policyEndDate: coverage.policyEndDate || coverage.coverageEndDate || null,
        coverageDurationLabel: coverage.coverageDurationLabel || "",
        coverageDurationType: coverage.coverageDurationType || "",
        coverageDurationYears: coverage.coverageDurationYears ?? null,
        coverageDurationUntilAge: coverage.coverageDurationUntilAge ?? null,
        selectedPaymentTermLabel: coverage.selectedPaymentTermLabel || "",
        selectedPaymentTermType: coverage.selectedPaymentTermType || "",
        selectedPaymentTermYears: coverage.selectedPaymentTermYears ?? null,
        selectedPaymentTermUntilAge: coverage.selectedPaymentTermUntilAge ?? null,
      },
      annualPaymentRecords,
    });
  } catch (err) {
    console.error("Get policyholder details error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* ===========================
   LEADS: UPDATE (Agent)
   PUT /api/prospects/:prospectId/leads/:leadId?userId=...

   Purpose:
   - Handles three operations using one endpoint:
     A) Drop lead (status="Dropped" in request body)
     B) Reopen lead (status="Reopen" in request body)
     C) Normal edit (source/otherSource/description only)

   Ownership rules:
   - Prospect must belong to agent.
   - Lead must belong to prospect.

   Business rules:
   - Status is NOT freely editable.
   - Dropped leads cannot be edited (must reopen first).
   - Closed leads cannot be dropped.
   - Leads with submitted applications cannot be dropped.
   - Drop is only allowed from New/In Progress.
   - Reopen is only allowed from Dropped and restores statusBeforeDrop.
   - Source rules depend on prospect.source:
     * System-Assigned prospect => lead source locked to "System"
     * Agent-Sourced prospect  => lead source editable, but cannot be "System"
=========================== */
app.put("/api/prospects/:prospectId/leads/:leadId", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;

    // Validate required agent scope + ObjectId format
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId))
      return res.status(400).json({ message: "Invalid userId." });

    // Validate route params
    if (!mongoose.isValidObjectId(prospectId))
      return res.status(400).json({ message: "Invalid prospectId." });

    if (!mongoose.isValidObjectId(leadId))
      return res.status(400).json({ message: "Invalid leadId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    // 1) Authorization: ensure prospect belongs to agent
    const prospect = await Prospect.findOne({
      _id: prospectObjectId,
      assignedToUserId: userObjectId,
    })
      .select("_id source status")
      .lean();

    if (!prospect) {
      return res.status(404).json({ message: "Prospect not found." });
    }

    // 2) Ensure lead belongs to this prospect
    const existing = await Lead.findOne({
      _id: leadObjectId,
      prospectId: prospectObjectId,
    });

    if (!existing) {
      return res.status(404).json({ message: "Lead not found." });
    }

    const {
      source,
      otherSource,
      description,

      // for drop/reopen
      status, // only accepted: "Dropped" or "Reopen"
      dropReason,
      dropNotes,
    } = req.body;

    const currentStatus = String(existing.status || "");

    // Flags to select which operation the endpoint should perform
    const wantsDrop = String(status || "") === "Dropped";
    const wantsReopen = String(status || "") === "Reopen";

    // =========================
    // A) DROP FLOW
    // =========================
    if (wantsDrop) {
      // Cannot drop Closed leads
      if (currentStatus === "Closed") {
        return res.status(409).json({
          code: "LEAD_DROP_BLOCKED",
          message: "Cannot drop this lead because it is already Closed.",
        });
      }

      // Only New/In Progress can be dropped
      if (!["New", "In Progress"].includes(currentStatus)) {
        return res.status(409).json({
          code: "LEAD_DROP_INVALID",
          message: "Only New or In Progress leads can be dropped.",
        });
      }

      // Require reason/notes for drop auditability
      const r = String(dropReason || "").trim();
      const n = String(dropNotes || "").trim();
      if (!r) return res.status(400).json({ message: "dropReason is required when dropping." });
      if (!n) return res.status(400).json({ message: "dropNotes is required when dropping." });

      // Save current status so Reopen can restore it
      existing.statusBeforeDrop = currentStatus; // New/In Progress

      // Apply drop fields
      existing.status = "Dropped";
      existing.dropReason = r;
      existing.dropNotes = n;
      existing.droppedAt = existing.droppedAt || new Date();

      const engagement = await LeadEngagement.findOne({ leadId: existing._id }).select("_id currentStage").lean();
      if (engagement?.currentStage === "Policy Issuance") {
        return res.status(409).json({
          code: "LEAD_DROP_APPLICATION_SUBMITTED",
          message: "Cannot drop this lead because an application has already been submitted.",
        });
      }
      let meetingsCancelledCount = 0;
      let tasksSoftDeletedCount = 0;
      let notificationsDeletedCount = 0;

      if (engagement?._id) {
        const cancelMeetingsResult = await ScheduledMeeting.updateMany(
          {
            leadEngagementId: engagement._id,
            status: { $ne: "Completed" },
          },
          { $set: { status: "Cancelled" } }
        );
        meetingsCancelledCount = Number(cancelMeetingsResult?.modifiedCount || 0);

        const tasksToSoftDelete = await Task.find({
          assignedToUserId: userObjectId,
          prospectId: prospectObjectId,
          leadEngagementId: engagement._id,
          status: { $in: ["Open", "Overdue"] },
          softDeletedAt: null,
        })
          .select("_id")
          .lean();

        const taskIds = tasksToSoftDelete.map((t) => t._id);
        if (taskIds.length) {
          const softDeleteNow = new Date();
          const softDeleteResult = await Task.updateMany(
            { _id: { $in: taskIds } },
            {
              $set: {
                softDeletedAt: softDeleteNow,
                softDeleteReason: "LEAD_DROPPED",
                softDeletedByUserId: userObjectId,
              },
            }
          );
          tasksSoftDeletedCount = Number(softDeleteResult?.modifiedCount || 0);

          const softDeleteNotifResult = await Notification.updateMany({
            assignedToUserId: userObjectId,
            entityType: "Task",
            entityId: { $in: taskIds },
            type: { $in: ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED"] },
            softDeletedAt: null,
          }, {
            $set: {
              softDeletedAt: softDeleteNow,
              softDeleteReason: "TASK_SOFT_DELETED_LEAD_DROPPED",
              softDeletedByUserId: userObjectId,
            },
          });
          notificationsDeletedCount = Number(softDeleteNotifResult?.modifiedCount || 0);
        }
      }

      const saved = await existing.save();
      return res.json({
        message: "Lead dropped",
        lead: saved,
        cleanup: {
          meetingsCancelledCount,
          tasksSoftDeletedCount,
          notificationsDeletedCount,
        },
      });
    }

    // =========================
    // B) REOPEN FLOW
    // =========================
    if (wantsReopen) {
      // Only Dropped leads can be re-opened
      if (currentStatus !== "Dropped") {
        return res.status(409).json({
          code: "LEAD_REOPEN_INVALID",
          message: "Only Dropped leads can be re-opened.",
        });
      }

      if (String(prospect.status || "") === "Dropped") {
        return res.status(409).json({
          code: "LEAD_REOPEN_PROSPECT_DROPPED",
          message: "Cannot re-open this lead while the prospect is Dropped.",
        });
      }

      const activeSiblingLead = await Lead.findOne({
        prospectId: prospectObjectId,
        _id: { $ne: leadObjectId },
        status: { $in: ["New", "In Progress"] },
      })
        .select("leadCode status")
        .lean();

      if (activeSiblingLead) {
        return res.status(409).json({
          code: "LEAD_REOPEN_ACTIVE_LEAD_EXISTS",
          message: `Cannot re-open this lead while the prospect has an active lead (${activeSiblingLead.leadCode || "—"}, ${activeSiblingLead.status || "—"}).`,
          activeLead: {
            _id: activeSiblingLead._id,
            leadCode: activeSiblingLead.leadCode,
            status: activeSiblingLead.status,
          },
        });
      }

      // Restore previous status (fallback to New)
      const restore = String(existing.statusBeforeDrop || "New");
      if (!["New", "In Progress"].includes(restore)) {
        existing.status = "New";
      } else {
        existing.status = restore;
      }

      // Clear drop audit fields
      existing.dropReason = undefined;
      existing.dropNotes = undefined;
      existing.droppedAt = null;

      // Clear statusBeforeDrop after successful restore
      existing.statusBeforeDrop = undefined;

      const session = await mongoose.startSession();
      let saved = null;
      await session.withTransaction(async () => {
        const reopenNow = new Date();
        const savedLead = await existing.save({ session });
        saved = savedLead;

        const engagement = await LeadEngagement.findOne({ leadId: existing._id }).session(session);
        if (engagement) {
          engagement.currentStage = "Contacting";
          engagement.currentActivityKey = "Attempt Contact";
          engagement.stageStartedAt = reopenNow;
          engagement.stageCompletedAt = null;
          engagement.isBlocked = false;
          engagement.contactAttemptsCount = 0;
          engagement.lastContactAttemptNo = 0;
          engagement.lastContactAttemptAt = null;
          engagement.contactAttemptCycle = Number(engagement.contactAttemptCycle || 1) + 1;
          engagement.nextAttemptAt = null;
          engagement.stageHistory.push({
            stage: "Contacting",
            startedAt: reopenNow,
            completedAt: null,
            reason: "Lead re-opened. Restarted engagement from Contacting.",
          });
          await engagement.save({ session });

          const prospectFullName = await Prospect.findById(prospectObjectId)
            .select("firstName middleName lastName")
            .session(session)
            .lean()
            .then((p) => `${p?.firstName || ""}${p?.middleName ? ` ${p.middleName}` : ""} ${p?.lastName || ""}`.trim() || "the prospect");

          const now = new Date();
          const due = new Date(now);
          due.setHours(18, 0, 0, 0);
          const cutoff = new Date(now);
          cutoff.setHours(17, 30, 0, 0);
          if (now.getTime() >= cutoff.getTime()) due.setDate(due.getDate() + 1);

          const createdTask = await Task.create(
            [
              {
                assignedToUserId: userObjectId,
                prospectId: prospectObjectId,
                leadEngagementId: engagement._id,
                type: "APPROACH",
                title: "Contact new lead",
                description: `Contact ${prospectFullName} regarding this new lead.`,
                dueAt: due,
                status: "Open",
              },
            ],
            { session }
          ).then((docs) => docs[0]);

          await createTaskAddedNotifications({
            assignedToUserId: userObjectId,
            task: createdTask,
            prospectFullName,
            leadCode: savedLead.leadCode || "—",
            session,
          });
        }
      });
      session.endSession();
      return res.json({ message: "Lead re-opened", lead: saved });
    }

    // =========================
    // C) NORMAL EDIT FLOW
    // =========================

    // Dropped leads cannot be edited unless reopened first
    if (currentStatus === "Dropped") {
      return res.status(409).json({
        code: "LEAD_EDIT_BLOCKED",
        message: "Cannot edit a Dropped lead. Please re-open it first.",
      });
    }

    // Description is always editable (trimmed)
    const finalDesc = String(description || "").trim();

    // System-Assigned prospect: lead source is LOCKED to System
    if (prospect.source === "System-Assigned") {
      // If frontend tried to change source to something else → block
      const incomingSource = String(source || "").trim();
      if (incomingSource && incomingSource !== "System") {
        return res.status(409).json({
          code: "LEAD_SOURCE_LOCKED",
          message: "This lead source is fixed as System because the prospect is System-Assigned.",
        });
      }

      // Enforce System + clear otherSource to keep data consistent
      existing.source = "System";
      existing.otherSource = "";
      existing.description = finalDesc;

      const saved = await existing.save();
      return res.json({ message: "Lead updated", lead: saved });
    }

    // Agent-Sourced prospect: source is editable BUT cannot be System
    const allowedSources = [
      "Family",
      "Friend",
      "Acquaintance",
      "Webinars",
      "Seminars/Conferences",
      "Other",
    ];

    const finalSource = String(source || "").trim();
    if (!finalSource || !allowedSources.includes(finalSource)) {
      return res.status(400).json({ message: "Invalid lead source." });
    }

    // "Other" requires otherSource text
    let finalOther = "";
    if (finalSource === "Other") {
      finalOther = String(otherSource || "").trim();
      if (!finalOther) {
        return res.status(400).json({ message: "Other source is required when source is Other." });
      }
    }

    existing.source = finalSource;
    existing.otherSource = finalOther;
    existing.description = finalDesc;

    const saved = await existing.save();
    return res.json({ message: "Lead updated", lead: saved });
  } catch (err) {
    console.error("Update lead error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});


/* ===========================
   LEAD ENGAGEMENT: DETAILS (Agent)
   GET /api/prospects/:prospectId/leads/:leadId/engagement?userId=...

   Purpose:
   - Returns a combined view used by the Engagement UI:
     * prospect summary (incl. contact info + version)
     * lead summary
     * engagement record (pipeline stage + activity key + history)
     * contactAttempts list
     * engagement-scoped tasks list

   Security / Ownership:
   - Prospect must belong to agent (assignedToUserId == userId)
   - Lead must belong to that prospect (lead.prospectId == prospectId)

   Failsafe:
   - If LeadEngagement is missing for this Lead, the route auto-creates it.
     (This prevents UI breakage if an earlier create flow was interrupted.)
=========================== */
app.get("/api/prospects/:prospectId/leads/:leadId/engagement", async (req, res) => {
  try {
    const { prospectId, leadId } = req.params;
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL", historyCycle } = req.query;

    // Validate required IDs
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }
    if (!mongoose.isValidObjectId(prospectId)) {
      return res.status(400).json({ message: "Invalid prospectId." });
    }
    if (!mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid leadId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1) Authorization: prospect must belong to agent
    const prospect = await Prospect.findOne({
      _id: prospectId,
      assignedToUserId: userObjectId,
    })
      // Include fields the engagement UI needs (contact info + versioning + tags)
      .select("firstName middleName lastName marketType source status phoneNumber contactInfoVersion email birthday")
      .lean();

    if (!prospect) {
      // Not found OR not owned by agent
      return res.status(404).json({ message: "Prospect not found." });
    }

    // Build display name for UI
    const fullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${
      prospect.lastName
    }`.trim();

    // 2) Lead must belong to this prospect (prevents cross-prospect access)
    const lead = await Lead.findOne({
      _id: leadId,
      prospectId: new mongoose.Types.ObjectId(prospectId),
    })
      .select("leadCode source otherSource description status createdAt")
      .lean();

    if (!lead) {
      return res.status(404).json({ message: "Lead not found for this prospect." });
    }

    /**
     * 3) Get (or create) LeadEngagement record (1:1 with Lead)
     * - engagement is the persistent state for pipeline stage + activity + blocking + versioning.
     * - If missing (edge case), auto-create with default "Not Started" state.
     */
    let engagement = await LeadEngagement.findOne({ leadId: lead._id }).lean();

    if (!engagement) {
      const startedAt = new Date();
      const created = await LeadEngagement.create({
        leadId: lead._id,

        currentStage: "Contacting",
        currentActivityKey: "Attempt Contact",
        stageStartedAt: startedAt,
        stageCompletedAt: null,
        stageHistory: [
          {
            stage: "Contacting",
            startedAt,
            completedAt: null,
            reason: "Auto-created missing engagement record.",
          },
        ],

        isBlocked: false,

        contactAttemptsCount: 0,
        lastContactAttemptNo: 0,
        lastContactAttemptAt: null,
        contactAttemptCycle: 1,

        nextAttemptAt: null,

        // Versioning ties attempts/tasks to the correct prospect contact version
        contactInfoVersionAtStart: prospect.contactInfoVersion || 1,
        currentContactInfoVersion: prospect.contactInfoVersion || 1,
      });

      engagement = created.toObject();
    }

    // 4) Load contact attempts for the engagement (oldest→newest by attemptNo)
    await ensureContactAttemptCycleBackfill();
    await ensureScheduledMeetingAttemptCycleBackfill();
    const attempts = await ContactAttempt.find({
      leadEngagementId: engagement._id,
    })
      .sort({ attemptCycle: 1, attemptNo: 1, attemptedAt: 1 })
      .select(
        "attemptNo attemptCycle primaryChannel otherChannels response attemptedAt contactInfoVersion outcomeActivity notes phoneValidation interestLevel preferredChannel preferredChannelOther"
      )
      .lean();

    const scheduledMeetings = await ScheduledMeeting.find({
      leadEngagementId: engagement._id,
      meetingType: "Needs Assessment",
    })
      .sort({ createdAt: -1, startAt: -1 })
      .select("meetingType attemptCycle startAt endAt durationMin mode platform platformOther link inviteSent place status createdAt")
      .lean();

    const sortedAttemptsDesc = [...attempts].sort((a, b) => {
      const cycleDelta = Number(b?.attemptCycle || 1) - Number(a?.attemptCycle || 1);
      if (cycleDelta !== 0) return cycleDelta;
      return Number(b?.attemptNo || 0) - Number(a?.attemptNo || 0);
    });
    const meetingByAttemptKey = new Map();
    const attemptsByCycle = new Map();
    sortedAttemptsDesc.forEach((attemptDoc) => {
      const cycle = Number(attemptDoc?.attemptCycle || 1);
      if (!attemptsByCycle.has(cycle)) attemptsByCycle.set(cycle, []);
      attemptsByCycle.get(cycle).push(attemptDoc);
    });
    const meetingsByCycle = new Map();
    scheduledMeetings.forEach((m) => {
      const cycle = Number(m?.attemptCycle || 1);
      if (!meetingsByCycle.has(cycle)) meetingsByCycle.set(cycle, []);
      meetingsByCycle.get(cycle).push(m);
    });
    attemptsByCycle.forEach((cycleAttempts, cycle) => {
      const cycleMeetings = meetingsByCycle.get(cycle) || [];
      cycleAttempts.forEach((attemptDoc, idx) => {
        const k = `${cycle}:${Number(attemptDoc?.attemptNo || 0)}`;
        meetingByAttemptKey.set(k, cycleMeetings[idx] || null);
      });
    });

    /**
     * 4.5) Load engagement-related tasks for the sidebar (may be empty)
     * Scope is strict to avoid leakage:
     * - assignedToUserId == agent userId
     * - prospectId == requested prospectId
     * - leadEngagementId == this engagement
     */
    const tasks = await Task.find({
      assignedToUserId: userObjectId,
      prospectId: new mongoose.Types.ObjectId(prospectId),
      leadEngagementId: engagement._id,
      softDeletedAt: null,
    })
      // Sort soonest due first; for ties, newest created first
      .sort({ dueAt: 1, createdAt: -1 })
      .select("_id type title description dueAt status completedAt wasDelayed createdAt dedupeKey")
      .lean();

    const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
    const requestedHistoryCycle = Number(historyCycle || 0);
    const isHistoryCycleRequest = Number.isInteger(requestedHistoryCycle) && requestedHistoryCycle > 0;
    const targetAttemptCycle = isHistoryCycleRequest ? requestedHistoryCycle : currentAttemptCycle;
    // History views must stay pinned to the selected prior attempt cycle so
    // current-cycle policy/payment records cannot bleed into saved history.
    const targetAttemptCycleFilter = isHistoryCycleRequest
      ? { attemptCycle: targetAttemptCycle }
      : attemptCycleFilterForCycle(targetAttemptCycle);

    await ensureNeedsAssessmentAttemptCycleIndex();
    const needsAssessment = await NeedsAssessment.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: targetAttemptCycle,
    })
      .select("attemptCycle needsPriorities.productSelection.selectedProductId needsPriorities.productSelection.requestedFrequency needsPriorities.productSelection.requestedPremiumPayment")
      .lean();

    await ensureProposalAttemptCycleIndex();
    const proposalDoc = await Proposal.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: targetAttemptCycle,
    })
      .select("attemptCycle outcomeActivity chosenProductId generateProposal recordProspectAttendance presentProposal")
      .lean();

    await ensureApplicationAttemptCycleIndex();
    const applicationDoc = await Application.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: targetAttemptCycle,
    })
      .select("attemptCycle outcomeActivity chosenProductId recordProspectAttendance recordPremiumPaymentTransfer recordApplicationSubmission")
      .lean();

    await ensurePolicyAttemptCycleIndex();
    const policyDoc = await Policy.findOne({
      leadEngagementId: engagement._id,
      ...targetAttemptCycleFilter,
    })
      .select("attemptCycle chosenProductId outcomeActivity recordPolicyApplicationStatus uploadInitialPremiumEor uploadPolicySummary recordCoverageDurationDetails")
      .lean();

    const currentCycleNeedsAssessment = needsAssessment || null;
    const applicationPaymentId = applicationDoc?.recordPremiumPaymentTransfer?.paymentId || null;
    const policyPaymentId = policyDoc?.uploadInitialPremiumEor?.paymentId || null;

    const paymentSelect = "annualPaymentId attemptCycle recordPremiumPaymentTransfer uploadPremiumPaymentEor";
    let applicationPaymentDoc = null;
    if (applicationPaymentId && mongoose.isValidObjectId(applicationPaymentId)) {
      const linkedApplicationPayment = await Payment.findOne({
        _id: applicationPaymentId,
        leadEngagementId: engagement._id,
        ...targetAttemptCycleFilter,
      })
        .select(paymentSelect)
        .lean();
      if (paymentHasCompletedPremiumTransfer(linkedApplicationPayment)) {
        applicationPaymentDoc = linkedApplicationPayment;
      }
    }
    if (!applicationPaymentDoc) {
      applicationPaymentDoc = await Payment.findOne({
        $and: [
          { leadEngagementId: engagement._id, ...targetAttemptCycleFilter },
          {
            $or: [
              { "recordPremiumPaymentTransfer.savedAt": { $ne: null } },
              { "recordPremiumPaymentTransfer.paymentDate": { $ne: null } },
              { "recordPremiumPaymentTransfer.totalPremiumPaidPhp": { $ne: null } },
              { "recordPremiumPaymentTransfer.methodForPayment": { $nin: [null, ""] } },
              { "recordPremiumPaymentTransfer.proofOfPaymentFileDataUrl": { $nin: [null, ""] } },
              { "recordPremiumPaymentTransfer.proofOfPaymentFileName": { $nin: [null, ""] } },
            ],
          },
        ],
      })
        .sort({ "recordPremiumPaymentTransfer.savedAt": -1, createdAt: -1 })
        .select(paymentSelect)
        .lean();
      if (!paymentHasCompletedPremiumTransfer(applicationPaymentDoc)) {
        applicationPaymentDoc = null;
      }
    }

    let policyPaymentDoc = null;
    if (policyPaymentId && mongoose.isValidObjectId(policyPaymentId)) {
      const linkedPolicyPayment = await Payment.findOne({
        _id: policyPaymentId,
        leadEngagementId: engagement._id,
        ...targetAttemptCycleFilter,
      })
        .select(paymentSelect)
        .lean();
      if (paymentHasUploadedEor(linkedPolicyPayment)) {
        policyPaymentDoc = linkedPolicyPayment;
      }
    }
    if (!policyPaymentDoc) {
      policyPaymentDoc = await Payment.findOne({
        $and: [
          { leadEngagementId: engagement._id, ...targetAttemptCycleFilter },
          {
            $or: [
              { "uploadPremiumPaymentEor.uploadedAt": { $ne: null } },
              { "uploadPremiumPaymentEor.receiptDate": { $ne: null } },
              { "uploadPremiumPaymentEor.eorNumber": { $nin: [null, ""] } },
              { "uploadPremiumPaymentEor.eorFileDataUrl": { $nin: [null, ""] } },
              { "uploadPremiumPaymentEor.eorFileName": { $nin: [null, ""] } },
            ],
          },
        ],
      })
        .sort({ "uploadPremiumPaymentEor.uploadedAt": -1, createdAt: -1 })
        .select(paymentSelect)
        .lean();
      if (!paymentHasUploadedEor(policyPaymentDoc)) {
        policyPaymentDoc = null;
      }
    }

    const annualPaymentId = applicationPaymentDoc?.annualPaymentId || policyPaymentDoc?.annualPaymentId || null;
    const annualPaymentFilter = annualPaymentId
      ? { _id: annualPaymentId }
      : { leadEngagementId: engagement._id, ...targetAttemptCycleFilter };
    const annualPaymentDoc = await AnnualPayment.findOne(annualPaymentFilter)
      .sort({ attemptCycle: -1, createdAt: -1 })
      .select("annualPaymentPeriod totalAnnualPremiumPhp amountPaidSoFarPhp remainingBalancePhp frequencyOfPayment paymentProgress status attemptCycle")
      .lean();

    const proposalProductId = proposalDoc?.chosenProductId || null;
    const needsSelectedProductId = needsAssessment?.needsPriorities?.productSelection?.selectedProductId || null;
    const policyProductId = policyDoc?.chosenProductId || null;

    let selectedProduct = policyProductId && mongoose.isValidObjectId(policyProductId)
      ? await Product.findById(policyProductId)
          .select("_id productName productCategory description paymentTermOptions paymentTermLabel coverageDurationRule coverageDurationLabel ageRequirement minimumSumAssured minimumAnnualPremium")
          .lean()
      : null;

    if (!selectedProduct && proposalProductId && mongoose.isValidObjectId(proposalProductId)) {
      selectedProduct = await Product.findById(proposalProductId)
        .select("_id productName productCategory description paymentTermOptions paymentTermLabel coverageDurationRule coverageDurationLabel ageRequirement minimumSumAssured minimumAnnualPremium")
        .lean();
    }

    if (!selectedProduct && needsSelectedProductId && mongoose.isValidObjectId(needsSelectedProductId)) {
      selectedProduct = await Product.findById(needsSelectedProductId)
        .select("_id productName productCategory description paymentTermOptions paymentTermLabel coverageDurationRule coverageDurationLabel ageRequirement minimumSumAssured minimumAnnualPremium")
        .lean();
    }

    const selectedProductId = selectedProduct?._id || policyProductId || proposalProductId || needsSelectedProductId || null;

    const applicationSubmissionMeeting = await ScheduledMeeting.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: targetAttemptCycle,
      meetingType: "Application Submission",
    })
      .sort({ startAt: -1, createdAt: -1 })
      .select("meetingType attemptCycle startAt endAt durationMin mode platform platformOther link inviteSent place status createdAt updatedAt")
      .lean();

    const applicationSubmissionMeetings = await ScheduledMeeting.find({
      leadEngagementId: engagement._id,
      meetingType: "Application Submission",
    })
      .sort({ attemptCycle: -1, startAt: -1, createdAt: -1 })
      .select("meetingType attemptCycle startAt endAt durationMin mode platform platformOther link inviteSent place status createdAt updatedAt")
      .lean();

    const proposalPresentationMeetings = await ScheduledMeeting.find({
      leadEngagementId: engagement._id,
      attemptCycle: targetAttemptCycle,
      meetingType: "Proposal Presentation",
    })
      .sort({ endAt: -1, startAt: -1, createdAt: -1 })
      .select("meetingType attemptCycle startAt endAt durationMin mode platform platformOther link inviteSent place status createdAt updatedAt")
      .lean();

    const proposalSaved = proposalDoc?.generateProposal || {};
    const proposalAttendance = proposalDoc?.recordProspectAttendance || {};
    const proposalPresentation = proposalDoc?.presentProposal || {};

    const proposalCurrentActivityKey = (() => {
      const stageNow = String(engagement?.currentStage || "").trim();
      if (stageNow === "Proposal") {
        return String(engagement?.currentActivityKey || proposalDoc?.outcomeActivity || "Generate Proposal").trim() || "Generate Proposal";
      }

      if (applicationSubmissionMeeting) return "Schedule Application Submission";
      if (proposalPresentation?.presentedAt) return "Present Proposal";
      if (proposalAttendance?.attended) return "Record Prospect Attendance";
      if (proposalSaved?.proposalFileDataUrl || proposalSaved?.proposalFileName || proposalSaved?.uploadedAt || proposalSaved?.generatedAt) {
        return "Generate Proposal";
      }

      return String(proposalDoc?.outcomeActivity || "Generate Proposal").trim() || "Generate Proposal";
    })();
    const applicationCurrentActivityKey = String(applicationDoc?.outcomeActivity || "Record Prospect Attendance").trim() || "Record Prospect Attendance";
    const isPolicyDeclinedLead = String(lead?.status || "").trim() === "Policy Declined";
    const policyCurrentActivityKey = isPolicyDeclinedLead
      ? "Record Policy Application Status"
      : (String(policyDoc?.outcomeActivity || "Upload Initial Premium eOR").trim() || "Upload Initial Premium eOR");

    const issuedAtRaw = policyDoc?.recordPolicyApplicationStatus?.issuanceDate || null;
    const issuedAt = issuedAtRaw ? new Date(issuedAtRaw) : null;
    const birthDate = prospect?.birthday ? new Date(prospect.birthday) : null;
    const issuanceAge = (() => {
      if (!issuedAt || !birthDate || Number.isNaN(issuedAt.getTime()) || Number.isNaN(birthDate.getTime())) return null;
      let age = issuedAt.getFullYear() - birthDate.getFullYear();
      const birthdayPassed =
        issuedAt.getMonth() > birthDate.getMonth() ||
        (issuedAt.getMonth() === birthDate.getMonth() && issuedAt.getDate() >= birthDate.getDate());
      if (!birthdayPassed) age -= 1;
      return age >= 0 ? age : null;
    })();

    const activeCycle = Number(engagement.contactAttemptCycle || 1);
    const currentCycleAttempts = attempts.filter((a) => Number(a?.attemptCycle || 1) === activeCycle);

    /**
     * 5) Derive currentActivityKey for UI badge/tracker:
     * Priority:
     * 1) engagement.currentActivityKey (source of truth)
     * 2) last attempt outcomeActivity
     * 3) null
     *
     * Special rule:
     * - If stage is Not Started and there are zero attempts, force null.
     *
     * Validation:
     * - Optionally validates that the activity is allowed for the stage
     *   using isValidActivityForStage() (currently only Contacting has a catalog).
     */
    const lastAttempt = currentCycleAttempts.length ? currentCycleAttempts[currentCycleAttempts.length - 1] : null;

    let derivedActivityKey = isPolicyDeclinedLead ? null : (engagement.currentActivityKey || lastAttempt?.outcomeActivity || null);

    if (engagement.currentStage === "Not Started" && currentCycleAttempts.length === 0) {
      derivedActivityKey = null;
    } 

    if (!isValidActivityForStage(engagement.currentStage, derivedActivityKey)) {
      derivedActivityKey = null;
    }

    // Map attempts to frontend-friendly fields (stable key names)
    const taskInferredNeedsMeetings = (tasks || [])
      .filter((t) => String(t?.type || "").toUpperCase() === "APPOINTMENT")
      .map((t) => {
        const key = String(t?.dedupeKey || "");
        const match = key.match(/^APPOINTMENT:[^:]+:(\d{10,})$/);
        if (!match) return null;
        const ts = Number(match[1]);
        if (!Number.isFinite(ts)) return null;
        return {
          meetingAt: new Date(ts),
          meetingEndAt: t?.dueAt ? new Date(new Date(t.dueAt).getTime() - 15 * 60 * 1000) : null,
          meetingDurationMin: null,
          meetingMode: "",
          meetingPlatform: "",
          meetingPlatformOther: "",
          meetingLink: "",
          meetingInviteSent: false,
          meetingPlace: "",
          meetingStatus: t?.status === "Done" ? "Completed" : "Scheduled",
          meetingCreatedAt: t?.createdAt || null,
          attemptCycle: null,
        };
      })
      .filter(Boolean);

    const meetingDetailScore = (m) =>
      [
        m?.meetingDurationMin,
        m?.meetingMode,
        m?.meetingPlatform,
        m?.meetingPlatformOther,
        m?.meetingLink,
        m?.meetingPlace,
      ].filter((value) => Boolean(String(value || "").trim())).length;
    const meetingCreatedMs = (m) => new Date(m?.meetingCreatedAt || m?.meetingAt || 0).getTime();
    const preferNeedsMeeting = (candidate, current) => {
      if (!current) return true;
      if (candidate?.meetingSource === "scheduled" && current?.meetingSource !== "scheduled") return true;
      if (candidate?.meetingSource !== "scheduled" && current?.meetingSource === "scheduled") return false;
      const candidateScore = meetingDetailScore(candidate);
      const currentScore = meetingDetailScore(current);
      if (candidateScore !== currentScore) return candidateScore > currentScore;
      return meetingCreatedMs(candidate) > meetingCreatedMs(current);
    };

    const needsAssessmentMeetingRows = [
      ...scheduledMeetings.map((m) => ({
        attemptCycle: Number(m?.attemptCycle || 1),
        meetingAt: m.startAt || null,
        meetingEndAt: m.endAt || null,
        meetingDurationMin: Number(m.durationMin || 0) || null,
        meetingMode: m.mode || "",
        meetingPlatform: m.platform || "",
        meetingPlatformOther: m.platformOther || "",
        meetingLink: m.link || "",
        meetingInviteSent: Boolean(m.inviteSent),
        meetingPlace: m.place || "",
        meetingStatus: m.status || "",
        meetingCreatedAt: m.createdAt || null,
        meetingSource: "scheduled",
      })),
      ...taskInferredNeedsMeetings.map((m) => ({ ...m, meetingSource: "task" })),
    ].filter((m) => Boolean(m?.meetingAt));

    const needsAssessmentMeetings = Array.from(
      needsAssessmentMeetingRows
        .reduce((byStartAt, meeting) => {
          const startKey = String(new Date(meeting.meetingAt).getTime());
          const current = byStartAt.get(startKey);
          if (preferNeedsMeeting(meeting, current)) byStartAt.set(startKey, meeting);
          return byStartAt;
        }, new Map())
        .values()
    ).sort((a, b) => {
      const bCreated = meetingCreatedMs(b);
      const aCreated = meetingCreatedMs(a);
      if (Number.isFinite(bCreated) && Number.isFinite(aCreated) && bCreated !== aCreated) return bCreated - aCreated;
      return new Date(b?.meetingAt || 0).getTime() - new Date(a?.meetingAt || 0).getTime();
    });

    const contactAttempts = attempts.map((a) => ({
      attemptId: String(a._id || ""),
      attemptCycle: Number(a?.attemptCycle || 1),
      attemptNo: a.attemptNo,
      primaryChannel: a.primaryChannel,
      otherChannels: a.otherChannels || [],
      response: a.response,
      attemptedAt: a.attemptedAt,
      contactInfoVersionUsed: a.contactInfoVersion, 
      outcomeActivity: a.outcomeActivity || "Attempt Contact",
      notes: a.notes || "",
      phoneValidation: a.phoneValidation || "",
      interestLevel: a.interestLevel || "",
      preferredChannel: a.preferredChannel || "",
      preferredChannelOther: a.preferredChannelOther || "",
      ...(function () {
        const m = meetingByAttemptKey.get(`${Number(a?.attemptCycle || 1)}:${Number(a?.attemptNo || 0)}`) || null;
        return {
          meetingAt: m?.startAt || null,
          meetingEndAt: m?.endAt || null,
          meetingDurationMin: Number(m?.durationMin || 0) || null,
          meetingMode: m?.mode || "",
          meetingPlatform: m?.platform || "",
          meetingPlatformOther: m?.platformOther || "",
          meetingLink: m?.link || "",
          meetingInviteSent: Boolean(m?.inviteSent),
          meetingPlace: m?.place || "",
          meetingStatus: m?.status || "",
        };
      })(),
    }));

    // Response combines Prospect + Lead + Engagement + Attempts + Tasks
    return res.json({
      prospect: {
        _id: prospectId,
        fullName,
        marketType: prospect.marketType,
        source: prospect.source,
        status: prospect.status,
        phoneNumber: prospect.phoneNumber,
        contactInfoVersion: prospect.contactInfoVersion || 1,
        email: prospect.email || "",
      },
      lead: {
        _id: lead._id,
        leadCode: lead.leadCode,

        // UI-friendly lead source label
        source: lead.source === "Other" ? `Other: ${lead.otherSource || ""}`.trim() : lead.source,
        
        // Raw values included if frontend needs them for editing
        rawSource: lead.source, 
        otherSource: lead.otherSource || "",
        description: lead.description || "",
        status: lead.status,
        createdAt: lead.createdAt,
      },
      engagement: {
        _id: engagement._id,
        currentStage: engagement.currentStage,
        stageStartedAt: engagement.stageStartedAt,
        stageCompletedAt: engagement.stageCompletedAt,
        stageHistory: Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [],

        isBlocked: !!engagement.isBlocked,

        // If stored counters exist, prefer them; otherwise fallback to derived attempt list
        contactAttemptsCount: engagement.contactAttemptsCount ?? contactAttempts.length,
        lastContactAttemptNo: engagement.lastContactAttemptNo ?? (lastAttempt?.attemptNo || 0),
        lastContactAttemptAt: engagement.lastContactAttemptAt ?? (lastAttempt?.attemptedAt || null),

        nextAttemptAt: engagement.nextAttemptAt,

        contactInfoVersionAtStart: engagement.contactInfoVersionAtStart || 1,
        currentContactInfoVersion: engagement.currentContactInfoVersion || (prospect.contactInfoVersion || 1),
        contactAttemptCycle: Number(engagement.contactAttemptCycle || 1),

        // Derived and validated current activity for tracker/badge
        currentActivityKey: derivedActivityKey, 

        needsAssessmentMeetings,

        // Always an array (empty if none)
        contactAttempts, 

        // Always an array (empty if none)
        tasks: Array.isArray(tasks) ? tasks : [],

        application: {
          attemptCycle: applicationDoc?.attemptCycle || targetAttemptCycle,
          currentActivityKey: applicationCurrentActivityKey,
          chosenProductId: applicationDoc?.chosenProductId || null,
          chosenProduct: applicationDoc?.chosenProductId || selectedProduct
            ? {
                _id: applicationDoc?.chosenProductId || selectedProduct?._id || null,
                productName: selectedProduct?.productName || "",
                description: selectedProduct?.description || "",
              }
            : null,
          outcomeActivity: applicationDoc?.outcomeActivity || "",
          recordProspectAttendance: {
            attended: Boolean(applicationDoc?.recordProspectAttendance?.attended),
            attendedAt: applicationDoc?.recordProspectAttendance?.attendedAt || null,
            attendanceProofImageDataUrl: applicationDoc?.recordProspectAttendance?.attendanceProofImageDataUrl || "",
            attendanceProofFileName: applicationDoc?.recordProspectAttendance?.attendanceProofFileName || "",
          },
          recordPremiumPaymentTransfer: {
            paymentId: applicationPaymentDoc?._id || null,
            annualPaymentId: annualPaymentDoc?._id || applicationPaymentDoc?.annualPaymentId || null,
            frequencyOfPremiumPayment:
              annualPaymentDoc?.frequencyOfPayment
              || applicationPaymentDoc?.recordPremiumPaymentTransfer?.frequencyOfPremiumPayment
              || "",
            totalAnnualPremiumPhp: annualPaymentDoc?.totalAnnualPremiumPhp ?? null,
            annualPaymentPeriodStartDate: annualPaymentDoc?.annualPaymentPeriod?.startDate || null,
            annualPaymentPeriodEndDate: annualPaymentDoc?.annualPaymentPeriod?.endDate || null,
            annualPaymentPeriodLabel: annualPaymentDoc?.annualPaymentPeriod?.label || "",
            annualPaymentAmountPaidSoFarPhp: annualPaymentDoc?.amountPaidSoFarPhp ?? null,
            annualPaymentRemainingBalancePhp: annualPaymentDoc?.remainingBalancePhp ?? null,
            annualPaymentProgressLabel: annualPaymentDoc?.paymentProgress?.label || "",
            annualPaymentStatus: annualPaymentDoc?.status || "",
            totalFrequencyPremiumPhp: applicationPaymentDoc?.recordPremiumPaymentTransfer?.totalPremiumPaidPhp ?? null,
            paymentDate: applicationPaymentDoc?.recordPremiumPaymentTransfer?.paymentDate || null,
            paymentPeriodStartDate: applicationPaymentDoc?.recordPremiumPaymentTransfer?.paymentPeriod?.startDate || null,
            paymentPeriodEndDate: applicationPaymentDoc?.recordPremiumPaymentTransfer?.paymentPeriod?.endDate || null,
            paymentPeriodLabel: applicationPaymentDoc?.recordPremiumPaymentTransfer?.paymentPeriod?.label || "",
            methodForInitialPayment: applicationPaymentDoc?.recordPremiumPaymentTransfer?.methodForPayment || "",
            methodForRenewalPayment: applicationDoc?.recordPremiumPaymentTransfer?.methodForRenewalPayment || "",
            paymentProofImageDataUrl: applicationPaymentDoc?.recordPremiumPaymentTransfer?.proofOfPaymentFileDataUrl || "",
            paymentProofFileName: applicationPaymentDoc?.recordPremiumPaymentTransfer?.proofOfPaymentFileName || "",
            savedAt: applicationPaymentDoc?.recordPremiumPaymentTransfer?.savedAt || null,
          },
          recordApplicationSubmission: {
            pruOneTransactionId: applicationDoc?.recordApplicationSubmission?.pruOneTransactionId || "",
            submissionScreenshotImageDataUrl: applicationDoc?.recordApplicationSubmission?.submissionScreenshotImageDataUrl || "",
            submissionScreenshotFileName: applicationDoc?.recordApplicationSubmission?.submissionScreenshotFileName || "",
            savedAt: applicationDoc?.recordApplicationSubmission?.savedAt || null,
          },
          needsAssessmentProductSelection: {
            requestedFrequency: String(currentCycleNeedsAssessment?.needsPriorities?.productSelection?.requestedFrequency || ""),
            requestedPremiumPayment: currentCycleNeedsAssessment?.needsPriorities?.productSelection?.requestedPremiumPayment ?? "",
          },
        },

        policy: {
          currentActivityKey: policyCurrentActivityKey,
          outcomeActivity: policyDoc?.outcomeActivity || "",
          chosenProduct: policyDoc?.chosenProductId || selectedProduct
            ? {
                _id: policyDoc?.chosenProductId || selectedProduct?._id || null,
                productName: selectedProduct?.productName || "",
                description: selectedProduct?.description || "",
                paymentTermOptions: Array.isArray(selectedProduct?.paymentTermOptions) ? selectedProduct.paymentTermOptions : [],
                paymentTermLabel: selectedProduct?.paymentTermLabel || "",
                coverageDurationRule: selectedProduct?.coverageDurationRule || null,
                coverageDurationLabel: selectedProduct?.coverageDurationLabel || "",
              }
            : null,
          issuanceAge: issuanceAge ?? null,
          recordPolicyApplicationStatus: {
            status: policyDoc?.recordPolicyApplicationStatus?.status || "",
            issuanceDate: policyDoc?.recordPolicyApplicationStatus?.issuanceDate || null,
            declinedDate: policyDoc?.recordPolicyApplicationStatus?.declinedDate || null,
            declinationLetterFileName: policyDoc?.recordPolicyApplicationStatus?.declinationLetterFileName || "",
            declinationLetterFileMimeType: policyDoc?.recordPolicyApplicationStatus?.declinationLetterFileMimeType || "",
            declinationLetterFileDataUrl: policyDoc?.recordPolicyApplicationStatus?.declinationLetterFileDataUrl || "",
            declineReason: policyDoc?.recordPolicyApplicationStatus?.declineReason || "",
            initialPremiumRefundProofFileName: policyDoc?.recordPolicyApplicationStatus?.initialPremiumRefundProofFileName || "",
            initialPremiumRefundProofFileMimeType: policyDoc?.recordPolicyApplicationStatus?.initialPremiumRefundProofFileMimeType || "",
            initialPremiumRefundProofImageDataUrl: policyDoc?.recordPolicyApplicationStatus?.initialPremiumRefundProofImageDataUrl || "",
            notes: policyDoc?.recordPolicyApplicationStatus?.notes || "",
            savedAt: policyDoc?.recordPolicyApplicationStatus?.savedAt || null,
          },
          uploadInitialPremiumEor: {
            paymentId: policyPaymentDoc?._id || null,
            eorNumber: policyPaymentDoc?.uploadPremiumPaymentEor?.eorNumber || "",
            receiptDate: policyPaymentDoc?.uploadPremiumPaymentEor?.receiptDate || null,
            eorFileName: policyPaymentDoc?.uploadPremiumPaymentEor?.eorFileName || "",
            eorFileMimeType: policyPaymentDoc?.uploadPremiumPaymentEor?.eorFileMimeType || "",
            eorFileDataUrl: policyPaymentDoc?.uploadPremiumPaymentEor?.eorFileDataUrl || "",
            uploadedAt: policyPaymentDoc?.uploadPremiumPaymentEor?.uploadedAt || null,
          },
          uploadPolicySummary: {
            policyNumber: policyDoc?.uploadPolicySummary?.policyNumber || "",
            policySummaryFileName: policyDoc?.uploadPolicySummary?.policySummaryFileName || "",
            policySummaryFileMimeType: policyDoc?.uploadPolicySummary?.policySummaryFileMimeType || "",
            policySummaryFileDataUrl: policyDoc?.uploadPolicySummary?.policySummaryFileDataUrl || "",
            uploadedAt: policyDoc?.uploadPolicySummary?.uploadedAt || null,
          },
          recordCoverageDurationDetails: {
            policyNumber: policyDoc?.recordCoverageDurationDetails?.policyNumber || "",
            selectedPaymentTermLabel: policyDoc?.recordCoverageDurationDetails?.selectedPaymentTermLabel || "",
            selectedPaymentTermType: policyDoc?.recordCoverageDurationDetails?.selectedPaymentTermType || "",
            selectedPaymentTermYears: policyDoc?.recordCoverageDurationDetails?.selectedPaymentTermYears ?? null,
            selectedPaymentTermUntilAge: policyDoc?.recordCoverageDurationDetails?.selectedPaymentTermUntilAge ?? null,
            coverageDurationLabel: policyDoc?.recordCoverageDurationDetails?.coverageDurationLabel || "",
            coverageDurationType: policyDoc?.recordCoverageDurationDetails?.coverageDurationType || "",
            coverageDurationYears: policyDoc?.recordCoverageDurationDetails?.coverageDurationYears ?? null,
            coverageDurationUntilAge: policyDoc?.recordCoverageDurationDetails?.coverageDurationUntilAge ?? null,
            coverageStartDate: policyDoc?.recordCoverageDurationDetails?.coverageStartDate || null,
            coverageEndDate: policyDoc?.recordCoverageDurationDetails?.coverageEndDate || null,
            policyEndDate: policyDoc?.recordCoverageDurationDetails?.policyEndDate || null,
            savedAt: policyDoc?.recordCoverageDurationDetails?.savedAt || null,
          },
        },

        proposal: {
          attemptCycle: proposalDoc?.attemptCycle || targetAttemptCycle,
          currentActivityKey: proposalCurrentActivityKey,
          chosenProduct: proposalDoc?.chosenProductId || selectedProduct
            ? {
                _id: proposalDoc?.chosenProductId || selectedProduct?._id || null,
                productName: selectedProduct?.productName || "",
                productCategory: selectedProduct?.productCategory || "",
                description: selectedProduct?.description || "",
                paymentTermLabel: selectedProduct?.paymentTermLabel || "",
                coverageDurationLabel: selectedProduct?.coverageDurationLabel || "",
              }
            : null,
          generateProposal: {
            productId: proposalDoc?.chosenProductId || selectedProduct?._id || null,
            productName: selectedProduct?.productName || "",
            productCategory: selectedProduct?.productCategory || "",
            productDescription: selectedProduct?.description || "",
            productPaymentTermLabel: selectedProduct?.paymentTermLabel || "",
            productCoverageDurationLabel: selectedProduct?.coverageDurationLabel || "",
            proposalFileName: proposalSaved?.proposalFileName || "",
            proposalFileMimeType: proposalSaved?.proposalFileMimeType || "",
            proposalFileDataUrl: proposalSaved?.proposalFileDataUrl || "",
            sentToProspectEmail: Boolean(proposalSaved?.sentToProspectEmail),
            sentToProspectAt: proposalSaved?.sentToProspectAt || null,
            uploadedAt: proposalSaved?.uploadedAt || proposalSaved?.generatedAt || null,
          },
          recordProspectAttendance: {
            attendanceChoice: proposalAttendance?.attendanceChoice || (proposalAttendance?.attended ? "YES" : ""),
            attended: Boolean(proposalAttendance?.attended),
            attendedAt: proposalAttendance?.attendedAt || null,
            attendanceProofImageDataUrl: proposalAttendance?.attendanceProofImageDataUrl || "",
            attendanceProofFileName: proposalAttendance?.attendanceProofFileName || "",
          },
          presentProposal: {
            proposalAccepted: proposalPresentation?.proposalAccepted || "",
            initialQuotationNotes: proposalPresentation?.initialQuotationNotes || "",
            presentedAt: proposalPresentation?.presentedAt || null,
          },
          proposalPresentationMeetings: (proposalPresentationMeetings || []).map((meeting) => ({
            id: meeting._id || null,
            meetingType: meeting.meetingType,
            attemptCycle: meeting.attemptCycle ?? null,
            startAt: meeting.startAt || null,
            endAt: meeting.endAt || null,
            durationMin: meeting.durationMin ?? null,
            mode: meeting.mode || "",
            platform: meeting.platform || "",
            platformOther: meeting.platformOther || "",
            link: meeting.link || "",
            inviteSent: Boolean(meeting.inviteSent),
            place: meeting.place || "",
            status: meeting.status || "",
            createdAt: meeting.createdAt || null,
            updatedAt: meeting.updatedAt || null,
          })),
          applicationSubmissionMeeting: applicationSubmissionMeeting
            ? {
                id: applicationSubmissionMeeting._id || null,
                meetingType: applicationSubmissionMeeting.meetingType,
                attemptCycle: applicationSubmissionMeeting.attemptCycle ?? null,
                startAt: applicationSubmissionMeeting.startAt || null,
                endAt: applicationSubmissionMeeting.endAt || null,
                durationMin: applicationSubmissionMeeting.durationMin ?? null,
                mode: applicationSubmissionMeeting.mode || "",
                platform: applicationSubmissionMeeting.platform || "",
                platformOther: applicationSubmissionMeeting.platformOther || "",
                link: applicationSubmissionMeeting.link || "",
                inviteSent: Boolean(applicationSubmissionMeeting.inviteSent),
                place: applicationSubmissionMeeting.place || "",
                status: applicationSubmissionMeeting.status || "",
                createdAt: applicationSubmissionMeeting.createdAt || null,
                updatedAt: applicationSubmissionMeeting.updatedAt || null,
              }
            : null,
          applicationSubmissionMeetings: (applicationSubmissionMeetings || []).map((meeting) => ({
            id: meeting._id || null,
            meetingType: meeting.meetingType,
            attemptCycle: meeting.attemptCycle ?? null,
            startAt: meeting.startAt || null,
            endAt: meeting.endAt || null,
            durationMin: meeting.durationMin ?? null,
            mode: meeting.mode || "",
            platform: meeting.platform || "",
            platformOther: meeting.platformOther || "",
            link: meeting.link || "",
            inviteSent: Boolean(meeting.inviteSent),
            place: meeting.place || "",
            status: meeting.status || "",
            createdAt: meeting.createdAt || null,
            updatedAt: meeting.updatedAt || null,
          })),
          prospectEmail: prospect.email || "",
          pruOneProposalUrl: "https://pruone.prulifeuk.com.ph/web",
        },
      },
    });
  } catch (err) {
    console.error("Lead engagement details error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});


/* ===========================
   CONTACT ATTEMPTS: CREATE (Agent)
   POST /api/prospects/:prospectId/leads/:leadId/contact-attempts?userId=...

   Purpose:
   - Creates a new ContactAttempt under a LeadEngagement.
   - Updates related state atomically (Lead + LeadEngagement summary fields).
   - Enforces gating rules to prevent invalid attempt sequences.

   Input (Body):
   {
     primaryChannel: "Call" | "SMS" | "WhatsApp" | "Viber" | "Telegram",
     otherChannels: ["WhatsApp", ...] (optional),
     response: "Responded" | "No Response",
     notes: "..." (optional)
   }

   Key guarantees:
   - Prospect ownership enforced (agent-only)
   - Lead must belong to prospect
   - LeadEngagement auto-created if missing
   - attemptNo auto-increments from engagement.lastContactAttemptNo
   - attemptedAt is server-controlled (Date.now) and immutable by schema
   - outcomeActivity is server-controlled (derived from response)
   - contactInfoVersion saved = latest Prospect.contactInfoVersion at time of attempt
   - First attempt transitions:
       Lead: "New" -> "In Progress"
       Engagement: "Not Started" -> "Contacting" (+ stageHistory entry)
=========================== */
app.post("/api/prospects/:prospectId/leads/:leadId/contact-attempts", async (req, res) => {
  // Start a session so attempt creation + engagement/lead updates commit together
  const session = await mongoose.startSession();
 
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;

    // Validate required query + params
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(prospectId)) return res.status(400).json({ message: "Invalid prospectId." });
    if (!mongoose.isValidObjectId(leadId)) return res.status(400).json({ message: "Invalid leadId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    // Validate required query + params
    const primaryChannel = String(req.body?.primaryChannel || "").trim();
    const otherChannels = Array.isArray(req.body?.otherChannels) ? req.body.otherChannels : [];
    const response = String(req.body?.response || "").trim();
    const notes = String(req.body?.notes || "").trim();

    // Normalize and sanitize request body inputs
    const CHANNELS = ["Call", "SMS", "WhatsApp", "Viber", "Telegram"];
    const RESPONSES = ["Responded", "No Response"];

    // Validate primaryChannel
    if (!primaryChannel || !CHANNELS.includes(primaryChannel)) {
      return res.status(400).json({ message: "Invalid primaryChannel." });
    }

    // Validate otherChannels:
    // - ensure each item is trimmed string
    // - ensure uniqueness
    // - ensure it doesn’t include primaryChannel
    // - ensure each channel is valid
    const cleanOthers = otherChannels
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    if (new Set(cleanOthers).size !== cleanOthers.length) {
      return res.status(400).json({ message: "otherChannels must be unique." });
    }
    if (cleanOthers.includes(primaryChannel)) {
      return res.status(400).json({ message: "otherChannels must not include primaryChannel." });
    }
    for (const ch of cleanOthers) {
      if (!CHANNELS.includes(ch)) {
        return res.status(400).json({ message: "Invalid value in otherChannels." });
      }
    }

    if (!response || !RESPONSES.includes(response)) {
      return res.status(400).json({ message: "Invalid response." });
    }

    // Server-controlled attempt timestamp (schema also marks attemptedAt immutable)
    const now = new Date();
    let createdAttempt;

    await ensureContactAttemptCycleIndex();
    await session.withTransaction(async () => {
      // 1) Authorization: prospect must belong to agent
      // Only fetch contactInfoVersion because that is what we need for attempt versioning.
      const prospect = await Prospect.findOne(
        { _id: prospectObjectId, assignedToUserId: userObjectId },
        { contactInfoVersion: 1, firstName: 1, middleName: 1, lastName: 1 }
      )
        .session(session)
        .lean();

      if (!prospect) {
        // Throw inside transaction so no partial changes can commit
        throw Object.assign(new Error("Prospect not found."), { status: 404 });
      }

      // Always store the LATEST contact info version at the moment of attempt creation
      const latestVersion = prospect.contactInfoVersion || 1;

      // 2) Lead must belong to this prospect (and we fetch as a document for status update)
      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);

      if (!lead) {
        throw Object.assign(new Error("Lead not found for this prospect."), { status: 404 });
      }

      // Block adding attempts to terminal statuses
      if (lead.status === "Closed") {
        throw Object.assign(new Error("Cannot add contact attempts to a Closed lead."), { status: 409 });
      }
      if (lead.status === "Dropped") {
        throw Object.assign(new Error("Cannot add contact attempts to a Dropped lead. Re-open it first."), {
          status: 409,
        });
      }

      // 3) Get or create engagement (1:1 with lead)
      let engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);

      if (!engagement) {
        const startedAt = new Date();
        // Failsafe create if missing (prevents UI/flow break)
        engagement = await LeadEngagement.create(
          [
            {
              leadId: leadObjectId,
              currentStage: "Contacting",
              currentActivityKey: "Attempt Contact",
              stageStartedAt: startedAt,
              stageCompletedAt: null,
              stageHistory: [
                {
                  stage: "Contacting",
                  startedAt,
                  completedAt: null,
                  reason: "Auto-created during contact attempt.",
                },
              ],
              isBlocked: false,
              contactAttemptsCount: 0,
              lastContactAttemptNo: 0,
              lastContactAttemptAt: null,
              contactAttemptCycle: 1,
              nextAttemptAt: null,
              contactInfoVersionAtStart: latestVersion,
              currentContactInfoVersion: latestVersion,
            },
          ],
          { session }
        ).then((docs) => docs[0]);
      } else {
        // Keep engagement version synchronized with prospect's latest contact version
        engagement.currentContactInfoVersion = latestVersion;
      }

      // 3.1) HARD BLOCK: if engagement is blocked, no attempts allowed
      // (used for invalid contact info until agent updates it)
      if (engagement.isBlocked) {
        throw Object.assign(new Error("Engagement is blocked. Update contact info to continue."), {
          status: 409,
          code: "ENGAGEMENT_BLOCKED",
        });
      }

      /**
       * 3.2) Responded gating rules:
       * - If the last attempt already got "Responded" and contact info version hasn't changed:
       *     => must validate contact, cannot create another attempt (MUST_VALIDATE_CONTACT).
       *
       * - If last attempt was "Responded" and contact version increased since then:
       *     => allow new attempt only if there is an Open APPROACH task for this engagement,
       *        to enforce re-approach via the proper task flow (REAPPROACH_TASK_REQUIRED).
       */
      const currentAttemptCycle = Number(engagement.contactAttemptCycle || 1);
      const lastAttempt = await ContactAttempt.findOne({ leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle })
        .sort({ attemptNo: -1 })
        .select("response contactInfoVersion attemptedAt attemptNo")
        .session(session)
        .lean();

      const lastResponded = lastAttempt?.response === "Responded";
      const lastVersionUsed = Number(lastAttempt?.contactInfoVersion);
      const lastVersionFinite = Number.isFinite(lastVersionUsed);

      if (lastResponded) {
        // if they responded and contact info hasn't changed -> must validate, no more attempts
        if (lastVersionFinite && lastVersionUsed === latestVersion) {
          throw Object.assign(
            new Error("Prospect already responded. Please validate contact instead of adding another attempt."),
            { status: 409, code: "MUST_VALIDATE_CONTACT" }
          );
        }

        // if they responded and contact info changed -> allow ONLY if open APPROACH task exists (re-approach)
        if (lastVersionFinite && lastVersionUsed < latestVersion) {
          const hasOpenApproachTask = await Task.exists({
            assignedToUserId: userObjectId,
            prospectId: prospectObjectId,
            leadEngagementId: engagement._id,
            type: "APPROACH",
            status: "Open",
            softDeletedAt: null,
          }).session(session);

          if (!hasOpenApproachTask) {
            throw Object.assign(
              new Error("Re-approach is not allowed yet. Please use the generated Re-approach (APPROACH) task."),
              { status: 409, code: "REAPPROACH_TASK_REQUIRED" }
            );
          }
        }
      }

      // 4) attemptNo is derived from engagement's summary counter
      // Note: schema also enforces unique (leadEngagementId, attemptNo)
      const nextAttemptNo = (engagement.lastContactAttemptNo || 0) + 1;

      // outcomeActivity / next activity key is server-controlled based on response
      const nextActivityKey = response === "Responded" ? "Validate Contact" : "Attempt Contact";

      // Validate against stage activity catalog (Contacting stage only for now)
      if (!isValidActivityForStage("Contacting", nextActivityKey)) {
        throw Object.assign(new Error("Invalid currentActivityKey for Contacting stage."), { status: 400 });
      }

      // 5) Create ContactAttempt record
      createdAttempt = await ContactAttempt.create(
        [
          {
            leadEngagementId: engagement._id,
            attemptNo: nextAttemptNo,
            attemptCycle: currentAttemptCycle,
            primaryChannel,
            otherChannels: cleanOthers,
            response,
            attemptedAt: now, // server-controlled; schema immutable
            outcomeActivity: nextActivityKey, // server-controlled
            contactInfoVersion: latestVersion, // always latest prospect version at time of attempt
            notes,
          },
        ],
        { session }
      ).then((docs) => docs[0]);

      // 5.5) First attempt transitions lead to In Progress
      if (nextAttemptNo === 1 && lead.status === "New") {
        lead.status = "In Progress";
        await lead.save({ session });
      }

      // 6) Update engagement summary fields and pipeline stage
      engagement.contactAttemptsCount = (engagement.contactAttemptsCount || 0) + 1;
      engagement.lastContactAttemptNo = nextAttemptNo;
      engagement.lastContactAttemptAt = now;

      // First attempt also starts the "Contacting" stage (Not Started -> Contacting)
      if (engagement.currentStage === "Not Started") {
        engagement.currentStage = "Contacting";
        engagement.stageStartedAt = engagement.stageStartedAt || now;

        engagement.stageHistory = Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [];
        engagement.stageHistory.push({
          stage: "Contacting",
          startedAt: now,
          completedAt: null,
          reason: "First contact attempt created.",
        });
      }
     
      // Persist the currently required UI action/activity
      engagement.currentActivityKey = nextActivityKey;

      if (response === "No Response") {
        const prospectFullName =
          `${prospect.firstName || ""}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName || ""}`
            .trim() || "this prospect";
        await completeCurrentContactTaskAndCreateRecontact({
          session,
          userObjectId,
          prospectObjectId,
          leadObjectId,
          leadEngagementId: engagement._id,
          eventAt: now,
          prospectFullName,
          leadCode: lead.leadCode || "—",
        });
      }

      await engagement.save({ session });
    });

    // If transaction succeeded, return created attempt
    return res.status(201).json({
      message: "Contact attempt created",
      attempt: createdAttempt,
    });
  } catch (err) {
  // Errors thrown inside transaction attach status/code and are converted into API responses
    const status = err?.status || 500;
    console.error("Create contact attempt error:", err);
    return res.status(status).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});

/* ===========================
   CONTACT ATTEMPTS: EDIT (Agent)
   PATCH /api/prospects/:prospectId/leads/:leadId/contact-attempts/:attemptId?userId=...

   Rules:
   - Edit allowed ONLY while LeadEngagement.currentStage === "Contacting".
   - If engagement has progressed to a future stage, attempts are locked.
   - Only the LATEST contact attempt can be edited.
   - Editable fields: primaryChannel, otherChannels, response, notes.
=========================== */
app.patch("/api/prospects/:prospectId/leads/:leadId/contact-attempts/:attemptId", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { userId } = req.query;
    const { prospectId, leadId, attemptId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(prospectId)) return res.status(400).json({ message: "Invalid prospectId." });
    if (!mongoose.isValidObjectId(leadId)) return res.status(400).json({ message: "Invalid leadId." });
    if (!mongoose.isValidObjectId(attemptId)) return res.status(400).json({ message: "Invalid attemptId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);
    const attemptObjectId = new mongoose.Types.ObjectId(attemptId);

    const CHANNELS = ["Call", "SMS", "WhatsApp", "Viber", "Telegram"];
    const RESPONSES = ["Responded", "No Response"];
    let updatedAttempt = null;

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({
        _id: prospectObjectId,
        assignedToUserId: userObjectId,
      })
        .session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({
        _id: leadObjectId,
        prospectId: prospectObjectId,
      })
        .session(session)
        .lean();
      if (!lead) throw Object.assign(new Error("Lead not found for this prospect."), { status: 404 });
      const normalizedLeadStatus = String(lead.status || "").trim();
      if (normalizedLeadStatus === "Closed" || normalizedLeadStatus === "Dropped") {
        throw Object.assign(new Error("Contact attempts cannot be edited for Closed or Dropped leads."), { status: 409 });
      }

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Engagement not found."), { status: 404 });

      if (String(engagement.currentStage || "") !== "Contacting") {
        throw Object.assign(
          new Error("Contact attempts can only be edited while the engagement is in Contacting stage."),
          { status: 409, code: "CONTACT_ATTEMPTS_LOCKED" }
        );
      }

      const attempt = await ContactAttempt.findOne({
        _id: attemptObjectId,
        leadEngagementId: engagement._id,
      }).session(session);
      if (!attempt) throw Object.assign(new Error("Contact attempt not found."), { status: 404 });

      const currentAttemptCycle = Number(engagement.contactAttemptCycle || 1);
      const latestAttempt = await ContactAttempt.findOne({ leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle })
        .sort({ attemptNo: -1 })
        .select("_id attemptNo")
        .session(session)
        .lean();
      if (!latestAttempt || String(latestAttempt._id) !== String(attempt._id)) {
        throw Object.assign(new Error("Only the latest contact attempt can be edited."), {
          status: 409,
          code: "ONLY_LATEST_ATTEMPT_EDITABLE",
        });
      }

      const hasPrimaryChannel = Object.prototype.hasOwnProperty.call(req.body || {}, "primaryChannel");
      const hasOtherChannels = Object.prototype.hasOwnProperty.call(req.body || {}, "otherChannels");
      const hasResponse = Object.prototype.hasOwnProperty.call(req.body || {}, "response");
      const hasNotes = Object.prototype.hasOwnProperty.call(req.body || {}, "notes");

      const primaryChannel = hasPrimaryChannel ? String(req.body?.primaryChannel || "").trim() : attempt.primaryChannel;
      const rawOtherChannels = hasOtherChannels ? req.body?.otherChannels : attempt.otherChannels || [];
      const response = hasResponse ? String(req.body?.response || "").trim() : String(attempt.response || "").trim();
      const notes = hasNotes ? String(req.body?.notes || "").trim() : String(attempt.notes || "");

      if (!primaryChannel || !CHANNELS.includes(primaryChannel)) {
        throw Object.assign(new Error("Invalid primaryChannel."), { status: 400 });
      }

      if (!Array.isArray(rawOtherChannels)) {
        throw Object.assign(new Error("otherChannels must be an array."), { status: 400 });
      }

      const cleanOthers = rawOtherChannels
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      if (new Set(cleanOthers).size !== cleanOthers.length) {
        throw Object.assign(new Error("otherChannels must be unique."), { status: 400 });
      }
      if (cleanOthers.includes(primaryChannel)) {
        throw Object.assign(new Error("otherChannels must not include primaryChannel."), { status: 400 });
      }
      for (const channel of cleanOthers) {
        if (!CHANNELS.includes(channel)) {
          throw Object.assign(new Error("Invalid value in otherChannels."), { status: 400 });
        }
      }
      if (!response || !RESPONSES.includes(response)) {
        throw Object.assign(new Error("Invalid response."), { status: 400 });
      }

      const previousResponse = String(attempt.response || "").trim();
      attempt.primaryChannel = primaryChannel;
      attempt.otherChannels = cleanOthers;
      attempt.response = response;
      attempt.outcomeActivity = response === "Responded" ? "Validate Contact" : "Attempt Contact";
      attempt.notes = notes;

      const responseChanged = previousResponse !== response;
      if (responseChanged && response === "No Response") {
        attempt.phoneValidation = undefined;
        attempt.interestLevel = undefined;
        attempt.preferredChannel = undefined;
        attempt.preferredChannelOther = "";

        // If we edited away from a responded outcome, reset Contacting subactivity state.
        // Keep stage as Contacting but return activity to Attempt Contact.
        engagement.currentActivityKey = "Attempt Contact";
        engagement.isBlocked = false;

        if (String(prospect.status || "").trim() === "Wrong Contact") {
          prospect.status = "Active";
        }

        await ScheduledMeeting.deleteMany({
          leadEngagementId: engagement._id,
          meetingType: "CONTACTING",
        }).session(session);

        const prospectFullName =
          `${prospect.firstName || ""}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName || ""}`
            .trim() || "this prospect";
        await completeCurrentContactTaskAndCreateRecontact({
          session,
          userObjectId,
          prospectObjectId,
          leadObjectId,
          leadEngagementId: engagement._id,
          eventAt: new Date(),
          prospectFullName,
          leadCode: lead.leadCode || "—",
        });
      } else if (response === "Responded") {
        // Preserve progressed Contacting subactivities when response stays Responded.
        // Only promote to Validate Contact when transitioning from No Response -> Responded
        // or when the current activity is not already a valid Responded-path activity.
        const currentActivity = String(engagement.currentActivityKey || "").trim();
        const respondedPathActivities = ["Validate Contact", "Assess Interest", "Schedule Meeting"];
        if (responseChanged && previousResponse !== "Responded") {
          engagement.currentActivityKey = "Validate Contact";
        } else if (!respondedPathActivities.includes(currentActivity)) {
          engagement.currentActivityKey = "Validate Contact";
        }
      } else {
        engagement.currentActivityKey = "Attempt Contact";
      }

      updatedAttempt = await attempt.save({ session });
      await engagement.save({ session });
      await prospect.save({ session });
    });

    return res.json({
      message: "Contact attempt updated",
      attempt: updatedAttempt,
    });
  } catch (err) {
    const status = err?.status || 500;
    console.error("Update contact attempt error:", err);
    return res.status(status).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});

async function getLatestRespondedAttemptForEngagement(leadEngagementId, attemptCycle, session) {
  const cycle = Number(attemptCycle || 1);
  return ContactAttempt.findOne({
    leadEngagementId,
    attemptCycle: cycle,
    response: "Responded",
  })
    .sort({ attemptNo: -1 })
    .session(session || null);
}

function computeNextRecontactDueAt(baseDate = new Date()) {
  const due = new Date(baseDate);
  due.setDate(due.getDate() + 1);
  due.setHours(18, 0, 0, 0);

  // Sunday is excluded (Mon-Sat rule). Move to Monday 6:00 PM.
  if (due.getDay() === 0) {
    due.setDate(due.getDate() + 1);
  }

  return due;
}

function computeUpdateContactDueAt(baseDate = new Date()) {
  const due = new Date(baseDate);
  due.setHours(18, 0, 0, 0);

  let workingDaysAdded = 0;
  while (workingDaysAdded < 2) {
    due.setDate(due.getDate() + 1);
    if (due.getDay() !== 0) {
      workingDaysAdded += 1;
    }
  }

  due.setHours(18, 0, 0, 0);
  return due;
}

async function completeCurrentContactTaskAndCreateRecontact({
  session,
  userObjectId,
  prospectObjectId,
  leadObjectId,
  leadEngagementId,
  eventAt = new Date(),
  prospectFullName = "this prospect",
  leadCode = "—",
}) {
  const activeContactTask = await Task.findOne({
    assignedToUserId: userObjectId,
    prospectId: prospectObjectId,
    leadEngagementId,
    type: { $in: ["APPROACH", "FOLLOW_UP"] },
    status: { $in: ["Open", "Overdue"] },
  })
    .sort({ dueAt: -1, createdAt: -1 })
    .session(session);

  if (activeContactTask) {
    activeContactTask.status = "Done";
    activeContactTask.completedAt = eventAt;
    await activeContactTask.save({ session });
  }

  const recontactTask = await Task.create(
    [
      {
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId,
        type: "FOLLOW_UP",
        title: "Recontact new lead",
        description: `Recontact ${prospectFullName} for lead ${leadCode}.`,
        dueAt: computeNextRecontactDueAt(eventAt),
        status: "Open",
      },
    ],
    { session }
  ).then((docs) => docs[0]);

  await createTaskAddedNotifications({
    assignedToUserId: userObjectId,
    task: recontactTask,
    prospectFullName,
    leadCode,
    session,
  });
}

/* ===========================
   VALIDATE CONTACT: UPDATE CURRENT ATTEMPT (Agent)
   POST /api/prospects/:prospectId/leads/:leadId/validate-contact?userId=...

   Purpose:
   - Updates the SAME latest responded ContactAttempt with phone validation result.
   - Does NOT create a new ContactAttempt.
=========================== */
app.post("/api/prospects/:prospectId/leads/:leadId/validate-contact", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const result = String(req.body?.result || "").trim().toUpperCase();

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(prospectId)) return res.status(400).json({ message: "Invalid prospectId." });
    if (!mongoose.isValidObjectId(leadId)) return res.status(400).json({ message: "Invalid leadId." });

    if (!["CORRECT", "WRONG_CONTACT"].includes(result)) {
      return res.status(400).json({ message: "result must be CORRECT or WRONG_CONTACT." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({
        _id: prospectObjectId,
        assignedToUserId: userObjectId,
      }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({
        _id: leadObjectId,
        prospectId: prospectObjectId,
      }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Engagement not found."), { status: 404 });

      const currentAttemptCycle = Number(engagement.contactAttemptCycle || 1);
      const attempt = await ContactAttempt.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
        response: "Responded",
      })
        .sort({ attemptNo: -1 })
        .session(session);

      if (!attempt) {
        throw Object.assign(new Error("No responded contact attempt found to validate."), { status: 409 });
      }

      const existingPhoneValidation = String(attempt.phoneValidation || "").trim().toUpperCase();
      const isCorrectToWrongEdit = existingPhoneValidation === "CORRECT" && result === "WRONG_CONTACT";
      if (existingPhoneValidation && !isCorrectToWrongEdit) {
        throw Object.assign(new Error("This attempt has already been validated."), { status: 409 });
      }

      attempt.phoneValidation = result;
      attempt.outcomeActivity = "Validate Contact";
      if (result === "WRONG_CONTACT") {
        attempt.interestLevel = undefined;
        attempt.preferredChannel = undefined;
        attempt.preferredChannelOther = "";
      }
      await attempt.save({ session });

      if (result === "CORRECT") {
        engagement.currentActivityKey = "Assess Interest";
        await engagement.save({ session });
        return;
      }

      if (engagement.isBlocked) {
        throw Object.assign(new Error("Engagement is already blocked."), { status: 409 });
      }

      prospect.status = "Wrong Contact";
      await prospect.save({ session });

      engagement.isBlocked = true;
      engagement.currentStage = "Contacting";
      engagement.currentActivityKey = "Validate Contact";
      await engagement.save({ session });

      const openContactTask = await Task.findOne({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: { $in: ["APPROACH", "FOLLOW_UP"] },
        status: { $in: ["Open", "Overdue"] },
        softDeletedAt: null,
      })
        .sort({ dueAt: -1, createdAt: -1 })
        .session(session);

      if (openContactTask) {
        openContactTask.status = "Done";
        openContactTask.completedAt = new Date();
        await openContactTask.save({ session });
      }

      let updateTask = await Task.findOne({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "UPDATE_CONTACT_INFO",
        status: "Open",
        softDeletedAt: null,
      }).session(session);

      let createdNewUpdateTask = false;

      if (!updateTask) {
        const due = computeUpdateContactDueAt(new Date());

        updateTask = await Task.create(
          [
            {
              assignedToUserId: userObjectId,
              prospectId: prospectObjectId,
              leadEngagementId: engagement._id,
              type: "UPDATE_CONTACT_INFO",
              title: "Update phone number",
              description: "Phone number for this prospect was marked invalid. Update required before proceeding.",
              dueAt: due,
              status: "Open",
            },
          ],
          { session }
        ).then((docs) => docs[0]);

        createdNewUpdateTask = true;
      }

      const fullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
      const dueAt = updateTask?.dueAt;

      if (createdNewUpdateTask) {
        const taskAddedCreatedAt = new Date();
        const taskDueTodayCreatedAt = new Date(taskAddedCreatedAt.getTime() + 1);

        await Notification.create(
          [
            {
              assignedToUserId: userObjectId,
              type: "TASK_ADDED",
              title: "New task added",
              message: `Update contact info task created for ${fullName}.`,
              status: "Unread",
              entityType: "Task",
              entityId: updateTask._id,
              createdAt: taskAddedCreatedAt,
              updatedAt: taskAddedCreatedAt,
            },
          ],
          { session, timestamps: false }
        );

        if (dueAt && isDueTodayInManila(dueAt)) {
          await Notification.create(
            [
              {
                assignedToUserId: userObjectId,
                type: "TASK_DUE_TODAY",
                title: "Task due today",
                message: `Update contact info task for ${fullName} is due today.`,
                status: "Unread",
                entityType: "Task",
                entityId: updateTask._id,
                dedupeKey: `TASK_DUE_TODAY:${updateTask._id}:${dateKeyInTZ(dueAt, "Asia/Manila")}`,
                createdAt: taskDueTodayCreatedAt,
                updatedAt: taskDueTodayCreatedAt,
              },
            ],
            { session, timestamps: false }
          );
        }
      }
    });

    return res.json({
      message:
        result === "CORRECT"
          ? "Contact validated as correct. Proceed to Assess Interest."
          : "Marked as Wrong Contact. Update task created.",
    });
  } catch (err) {
    console.error("Validate contact error:", err);
    return res.status(err?.status || 500).json({ message: err.message || "Server error." });
  } finally {
    session.endSession();
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/assess-interest", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const { interestLevel, preferredChannel, preferredChannelOther } = req.body;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(prospectId)) return res.status(400).json({ message: "Invalid prospectId." });
    if (!mongoose.isValidObjectId(leadId)) return res.status(400).json({ message: "Invalid leadId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    let droppedLeadResponse = null;

    await session.withTransaction(async () => {
      // Scope the prospect lookup to the requesting agent/user so this route
      // cannot mutate a lead that belongs to someone else.
      const prospect = await Prospect.findOne({ _id: prospectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadId, prospectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId }).session(session);
      if (!engagement) throw Object.assign(new Error("Engagement not found."), { status: 404 });

      const lvl = String(interestLevel || "").trim().toUpperCase();
      if (!["INTERESTED", "NOT_INTERESTED"].includes(lvl)) {
        throw Object.assign(new Error("interestLevel must be INTERESTED or NOT_INTERESTED."), { status: 400 });
      }

      const attempt = await getLatestRespondedAttemptForEngagement(engagement._id, engagement.contactAttemptCycle, session);
      if (!attempt) throw Object.assign(new Error("No responded contact attempt found."), { status: 409 });
      const previousInterestLevel = String(attempt.interestLevel || "").trim().toUpperCase();

      const isEditInterestedToNotInterested =
        lvl === "NOT_INTERESTED" && previousInterestLevel === "INTERESTED";

      if (lvl === "INTERESTED" && previousInterestLevel === "NOT_INTERESTED") {
        throw Object.assign(new Error("Assess Interest cannot be changed from Not Interested back to Interested."), {
          status: 409,
        });
      }

      if (!isEditInterestedToNotInterested && engagement.currentActivityKey !== "Assess Interest") {
        throw Object.assign(new Error("Assess Interest is not the current activity."), { status: 409 });
      }

      // The latest responded attempt is the canonical record that stores the
      // outcome of the "Assess Interest" step.
      attempt.interestLevel = lvl;
      attempt.outcomeActivity = "Assess Interest";

      let droppedLeadPayload = null;

      if (lvl === "INTERESTED") {
        const pc = String(preferredChannel || "").trim();
        if (!["SMS", "WhatsApp", "Viber", "Telegram", "Other"].includes(pc)) {
          throw Object.assign(new Error("Invalid preferredChannel."), { status: 400 });
        }
        attempt.preferredChannel = pc;
        attempt.preferredChannelOther = pc === "Other" ? String(preferredChannelOther || "").trim() : undefined;

        if (pc === "Other" && !attempt.preferredChannelOther) {
          throw Object.assign(new Error("preferredChannelOther is required when preferredChannel is Other."), {
            status: 400,
          });
        }

        engagement.currentActivityKey = "Schedule Meeting";
      } else {
        attempt.preferredChannel = undefined;
        attempt.preferredChannelOther = undefined;
        // Keep the engagement parked on "Assess Interest" so the UI/history
        // still reflects which activity produced the not-interested outcome.
        engagement.currentActivityKey = "Assess Interest";

        const currentLeadStatus = String(lead.status || "").trim();
        if (currentLeadStatus === "Closed") {
          throw Object.assign(new Error("Cannot auto-drop a Closed lead."), { status: 409 });
        }
        if (!["New", "In Progress", "Dropped"].includes(currentLeadStatus)) {
          throw Object.assign(new Error("Lead cannot be auto-dropped from the current status."), { status: 409 });
        }

        const dropReason = "Interest / Engagement";
        const dropNotes = "Lead was automatically dropped after the prospect was assessed as not interested during Contacting.";
        if (currentLeadStatus !== "Dropped") {
          // Preserve the prior status so reporting/admin tooling can tell
          // whether this lead was dropped from New vs In Progress.
          lead.statusBeforeDrop = currentLeadStatus;
          lead.status = "Dropped";
          lead.dropReason = dropReason;
          lead.dropNotes = dropNotes;
          lead.droppedAt = lead.droppedAt || new Date();
        }

        // Auto-finish the active contact task because the lead can no longer
        // advance through the contacting pipeline once it is dropped.
        // This must cover both the initial APPROACH task and any FOLLOW_UP
        // recontact task generated by prior no-response flows.
        const openContactTask = await Task.findOne({
          assignedToUserId: userObjectId,
          prospectId: prospect._id,
          leadEngagementId: engagement._id,
          type: { $in: ["APPROACH", "FOLLOW_UP"] },
          status: { $in: ["Open", "Overdue"] },
        })
          .sort({ dueAt: -1, createdAt: -1 })
          .session(session);

        if (openContactTask) {
          openContactTask.status = "Done";
          openContactTask.completedAt = new Date();
          await openContactTask.save({ session });
        }

        // Return a concise payload so the frontend can show a confirmation
        // modal without having to re-fetch the lead list immediately.
        droppedLeadPayload = {
          leadCode: lead.leadCode || "",
          status: lead.status,
          dropReason: lead.dropReason || dropReason,
          dropNotes: lead.dropNotes || dropNotes,
          droppedAt: lead.droppedAt || null,
        };
      }

      await attempt.save({ session });
      await engagement.save({ session });
      await lead.save({ session });
      droppedLeadResponse = droppedLeadPayload;
    });

    return res.json({
      message: droppedLeadResponse ? "Assess Interest saved. Lead was dropped." : "Assess Interest saved.",
      leadDropped: Boolean(droppedLeadResponse),
      droppedLead: droppedLeadResponse,
    });
  } catch (err) {
    console.error("Assess interest error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});



/**
 * isValidHttpUrl(value)
 * ---------------------
 * Validates online meeting links and other user-entered HTTP(S) URLs.
 */
function isValidHttpUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * combineDateAndTimeLocal(dateStr, timeStr)
 * ----------------------------------------
 * Combines separate local-date and local-time form values into one Date object.
 */
function combineDateAndTimeLocal(dateStr, timeStr) {
  const [y, m, d] = String(dateStr || "").split("-").map((n) => Number(n));
  const [hh, mm] = String(timeStr || "").split(":").map((n) => Number(n));

  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/**
 * isMeetingSlotValidWindow(startAt, durationMin)
 * ---------------------------------------------
 * Enforces the allowed meeting scheduling window and duration constraints.
 */
function isMeetingSlotValidWindow(startAt, durationMin) {
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return false;
  if (![30, 60, 90, 120].includes(Number(durationMin))) return false;

  const start = new Date(startAt.getTime());
  const end = new Date(startAt.getTime() + Number(durationMin) * 60 * 1000);

  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  return startMin >= 7 * 60 && endMin <= 21 * 60;
}

/**
 * getAgentMeetingWindows(userObjectId, from, to, session)
 * ------------------------------------------------------
 * Collects already-booked meeting time windows for every lead assigned to the
 * requested agent/user so new schedules can be checked for overlap.
 */
async function getAgentMeetingWindows(userObjectId, from, to, session) {
  const matchStage = { status: "Scheduled" };
  if (from || to) {
    matchStage.startAt = {};
    if (from) matchStage.startAt.$gte = from;
    if (to) matchStage.startAt.$lt = to;
  }

  const meetings = await ScheduledMeeting.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: "leadengagements",
        localField: "leadEngagementId",
        foreignField: "_id",
        as: "engagement",
      },
    },
    { $unwind: "$engagement" },
    {
      $lookup: {
        from: "leads",
        localField: "engagement.leadId",
        foreignField: "_id",
        as: "lead",
      },
    },
    { $unwind: "$lead" },
    {
      $lookup: {
        from: "prospects",
        localField: "lead.prospectId",
        foreignField: "_id",
        as: "prospect",
      },
    },
    { $unwind: "$prospect" },
    { $match: { "prospect.assignedToUserId": userObjectId } },
    { $project: { _id: 1, startAt: 1, endAt: 1, durationMin: 1 } },
  ]).session(session || null);

  // Normalize every meeting to an explicit [start, end) window. Older rows may
  // be missing endAt, so durationMin is used as a fallback for conflict checks.
  return meetings
    .map((m) => {
      const start = m.startAt ? new Date(m.startAt) : null;
      if (!start || Number.isNaN(start.getTime())) return null;

      let end = m.endAt ? new Date(m.endAt) : null;
      if (!end || Number.isNaN(end.getTime())) {
        const duration = Number(m.durationMin || 120);
        end = new Date(start.getTime() + duration * 60 * 1000);
      }

      return { id: m._id ? String(m._id) : "", start, end };
    })
    .filter(Boolean);
}

/**
 * hasMeetingConflict(startAt, endAt, windows)
 * ------------------------------------------
 * Returns true when the proposed meeting overlaps an existing time window.
 */
function hasMeetingConflict(startAt, endAt, windows) {
  return windows.some((w) => w.start < endAt && w.end > startAt);
}

app.get("/api/agents/:agentId/meeting-availability", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { agentId } = req.params;
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 60);

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(agentId)) {
      return res.status(400).json({ message: "Invalid userId/agentId." });
    }
    if (String(userId) !== String(agentId)) {
      return res.status(403).json({ message: "Forbidden." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const windows = await getAgentMeetingWindows(userObjectId, start, end, session);

    return res.json({
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
      bookedWindows: windows.map((w) => ({ id: w.id || "", startAt: w.start.toISOString(), endAt: w.end.toISOString() })),
    });
  } catch (err) {
    console.error("Meeting availability error:", err);
    return res.status(500).json({ message: "Server error." });
  } finally {
    session.endSession();
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/schedule-meeting", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await ensureScheduledMeetingHistoryIndex();
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const {
      meetingAt,
      meetingDate,
      meetingStartTime,
      meetingDurationMin,
      meetingMode,
      meetingPlatform,
      meetingPlatformOther,
      meetingLink,
      meetingInviteSent,
      meetingPlace,
      rescheduleFromNeeds,
      addNewNeedsAssessmentMeeting,
      rescheduleFollowUpNeedsAssessmentMeeting,
    } = req.body;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(prospectId)) return res.status(400).json({ message: "Invalid prospectId." });
    if (!mongoose.isValidObjectId(leadId)) return res.status(400).json({ message: "Invalid leadId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({
        _id: prospectObjectId,
        assignedToUserId: userObjectId,
      }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Engagement not found."), { status: 404 });

      const allowedNeedsActivities = ["Record Prospect Attendance", "Perform Needs Analysis", "Schedule Proposal Presentation"];
      const allowRescheduleFromNeeds =
        Boolean(rescheduleFromNeeds) &&
        engagement.currentStage === "Needs Assessment" &&
        allowedNeedsActivities.includes(String(engagement.currentActivityKey || "").trim());
      const allowAddNeedsAssessmentMeeting =
        Boolean(addNewNeedsAssessmentMeeting) &&
        engagement.currentStage === "Needs Assessment" &&
        String(engagement.currentActivityKey || "").trim() === "Perform Needs Analysis";
      const allowRescheduleFollowUpNeedsAssessmentMeeting =
        Boolean(rescheduleFollowUpNeedsAssessmentMeeting) &&
        engagement.currentStage === "Needs Assessment" &&
        String(engagement.currentActivityKey || "").trim() === "Perform Needs Analysis";
      if (
        engagement.currentActivityKey !== "Schedule Meeting" &&
        !allowRescheduleFromNeeds &&
        !allowAddNeedsAssessmentMeeting &&
        !allowRescheduleFollowUpNeedsAssessmentMeeting
      ) {
        throw Object.assign(new Error("Schedule Meeting is not the current activity."), { status: 409 });
      }

      const durationMin = Number(meetingDurationMin || 120);
      const dt = meetingDate && meetingStartTime
        ? combineDateAndTimeLocal(meetingDate, meetingStartTime)
        : new Date(meetingAt);

      if (!dt || Number.isNaN(dt.getTime())) {
        throw Object.assign(new Error("meeting date/time is required and must be valid."), { status: 400 });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const latestDay = new Date(today);
      latestDay.setDate(latestDay.getDate() + 30);

      if (dt < today || dt >= latestDay) {
        throw Object.assign(new Error("Meeting date must be between today and the next 30 days."), { status: 400 });
      }

      if (!isMeetingSlotValidWindow(dt, durationMin)) {
        throw Object.assign(
          new Error("Meeting must start between 7:00 AM and 9:00 PM, and duration must be 30/60/90/120 minutes."),
          { status: 400 }
        );
      }

      const endAt = new Date(dt.getTime() + durationMin * 60 * 1000);
      const meetingType = "Needs Assessment";
      const currentAttemptCycle = Number(engagement.contactAttemptCycle || 1);
      const existingMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
        meetingType,
        status: "Scheduled",
      })
        .sort({ createdAt: -1, startAt: -1 })
        .session(session);

      const existingMeetingOriginalStartAt = existingMeeting?.startAt ? new Date(existingMeeting.startAt) : null;

      const windows = await getAgentMeetingWindows(userObjectId, null, null, session);
      const shouldIgnoreExistingMeetingWindow = existingMeeting && !allowAddNeedsAssessmentMeeting;
      const conflictWindows = shouldIgnoreExistingMeetingWindow
        ? windows.filter((w) => String(w?.id || "") !== String(existingMeeting._id))
        : windows;
      if (hasMeetingConflict(dt, endAt, conflictWindows)) {
        throw Object.assign(new Error("Selected time slot conflicts with an existing meeting."), {
          status: 409,
          code: "MEETING_CONFLICT",
        });
      }

      const mode = String(meetingMode || "").trim();
      if (!["Online", "Face-to-face"].includes(mode)) {
        throw Object.assign(new Error("meetingMode must be Online or Face-to-face."), { status: 400 });
      }

      const platform = String(meetingPlatform || "").trim();
      const platformOther = String(meetingPlatformOther || "").trim();
      const link = String(meetingLink || "").trim();
      const place = String(meetingPlace || "").trim();

      if (mode === "Online") {
        if (!["Zoom", "Google Meet", "Other"].includes(platform)) {
          throw Object.assign(new Error("Invalid meetingPlatform."), { status: 400 });
        }
        if (platform === "Other" && !platformOther) {
          throw Object.assign(new Error("meetingPlatformOther is required when meetingPlatform is Other."), { status: 400 });
        }
        if (!link) throw Object.assign(new Error("meetingLink is required for online meeting."), { status: 400 });
        if (!isValidHttpUrl(link)) {
          throw Object.assign(new Error("meetingLink must be a valid http/https URL."), { status: 400 });
        }
        if (meetingInviteSent !== true) {
          throw Object.assign(new Error("meetingInviteSent must be true before saving an online meeting."), {
            status: 400,
          });
        }
      } else {
        if (!place) throw Object.assign(new Error("meetingPlace is required for face-to-face meeting."), { status: 400 });
      }

      const latestAttempt = await getLatestRespondedAttemptForEngagement(engagement._id, engagement.contactAttemptCycle, session);
      if (!latestAttempt) throw Object.assign(new Error("No responded contact attempt found."), { status: 409 });
      latestAttempt.outcomeActivity = "Schedule Meeting";

      if (allowRescheduleFromNeeds || allowRescheduleFollowUpNeedsAssessmentMeeting) {
        if (!existingMeeting) {
          throw Object.assign(new Error("No scheduled needs assessment meeting found to reschedule."), { status: 409 });
        }
        if (existingMeetingOriginalStartAt && existingMeetingOriginalStartAt.getTime() === dt.getTime()) {
          throw Object.assign(new Error("Rescheduled meeting time cannot be the same as the previous meeting time."), { status: 400 });
        }
        existingMeeting.startAt = dt;
        existingMeeting.endAt = endAt;
        existingMeeting.durationMin = durationMin;
        existingMeeting.mode = mode;
        existingMeeting.platform = mode === "Online" ? platform : undefined;
        existingMeeting.platformOther = mode === "Online" && platform === "Other" ? platformOther : undefined;
        existingMeeting.link = mode === "Online" ? link : undefined;
        existingMeeting.inviteSent = Boolean(meetingInviteSent);
        existingMeeting.place = mode === "Face-to-face" ? place : undefined;
        existingMeeting.status = "Scheduled";
        await existingMeeting.save({ session });
      } else if (existingMeeting && !allowAddNeedsAssessmentMeeting) {
        existingMeeting.startAt = dt;
        existingMeeting.endAt = endAt;
        existingMeeting.durationMin = durationMin;
        existingMeeting.mode = mode;
        existingMeeting.platform = mode === "Online" ? platform : undefined;
        existingMeeting.platformOther = mode === "Online" && platform === "Other" ? platformOther : undefined;
        existingMeeting.link = mode === "Online" ? link : undefined;
        existingMeeting.inviteSent = Boolean(meetingInviteSent);
        existingMeeting.place = mode === "Face-to-face" ? place : undefined;
        existingMeeting.status = "Scheduled";
        await existingMeeting.save({ session });
      } else {
        if (allowAddNeedsAssessmentMeeting && existingMeeting) {
          const currentMeetingStartAt = existingMeeting.startAt ? new Date(existingMeeting.startAt) : null;
          const currentMeetingEndAt = existingMeeting.endAt
            ? new Date(existingMeeting.endAt)
            : currentMeetingStartAt
            ? new Date(currentMeetingStartAt.getTime() + Number(existingMeeting.durationMin || 120) * 60 * 1000)
            : null;
          if (currentMeetingStartAt && currentMeetingStartAt.getTime() === dt.getTime()) {
            throw Object.assign(new Error("New meeting time cannot be the same as the previous meeting time."), { status: 400 });
          }
          if (currentMeetingEndAt && !Number.isNaN(currentMeetingEndAt.getTime()) && dt.getTime() <= currentMeetingEndAt.getTime()) {
            throw Object.assign(new Error("Further needs assessment meeting must start after the current meeting ends."), { status: 400 });
          }
        }
        if (allowAddNeedsAssessmentMeeting) {
          await ScheduledMeeting.updateMany(
            { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle, meetingType, status: "Scheduled" },
            { $set: { status: "Completed" } },
            { session }
          );
        }
        await ScheduledMeeting.create(
          [
            {
              leadEngagementId: engagement._id,
              attemptCycle: currentAttemptCycle,
              meetingType,
              startAt: dt,
              endAt,
              durationMin,
              mode,
              platform: mode === "Online" ? platform : undefined,
              platformOther: mode === "Online" && platform === "Other" ? platformOther : undefined,
              link: mode === "Online" ? link : undefined,
              inviteSent: Boolean(meetingInviteSent),
              place: mode === "Face-to-face" ? place : undefined,
              status: "Scheduled",
            },
          ],
          { session }
        );
      }

      await latestAttempt.save({ session });

      if (!allowRescheduleFromNeeds && !allowAddNeedsAssessmentMeeting && !allowRescheduleFollowUpNeedsAssessmentMeeting) {
        const openContactTask = await Task.findOne({
          assignedToUserId: userObjectId,
          prospectId: prospectObjectId,
          leadEngagementId: engagement._id,
          type: { $in: ["APPROACH", "FOLLOW_UP"] },
          status: { $in: ["Open", "Overdue"] },
        })
          .sort({ dueAt: -1, createdAt: -1 })
          .session(session);

        if (openContactTask) {
          openContactTask.status = "Done";
          openContactTask.completedAt = new Date();
          await openContactTask.save({ session });
        }
      }

      const appointmentDedupeKey = allowRescheduleFromNeeds || allowAddNeedsAssessmentMeeting || allowRescheduleFollowUpNeedsAssessmentMeeting
        ? `APPOINTMENT:${engagement._id}:${dt.getTime()}`
        : `APPOINTMENT:${engagement._id}`;
      const shouldUpdateExistingAppointmentTask = allowRescheduleFromNeeds || allowRescheduleFollowUpNeedsAssessmentMeeting;
      const baseAppointmentDedupeKey = `APPOINTMENT:${engagement._id}`;
      const previousAppointmentDedupeKey =
        shouldUpdateExistingAppointmentTask && existingMeetingOriginalStartAt
          ? `APPOINTMENT:${engagement._id}:${existingMeetingOriginalStartAt.getTime()}`
          : appointmentDedupeKey;
      const appointmentDedupeKeys = [...new Set([baseAppointmentDedupeKey, previousAppointmentDedupeKey, appointmentDedupeKey])];
      let appointmentTask = await Task.findOne({
        assignedToUserId: userObjectId,
        ...(shouldUpdateExistingAppointmentTask
          ? { dedupeKey: { $in: appointmentDedupeKeys } }
          : { dedupeKey: appointmentDedupeKey }),
      })
        .sort({ dueAt: -1, createdAt: -1 })
        .session(session);

      if (shouldUpdateExistingAppointmentTask && !appointmentTask) {
        appointmentTask = await Task.findOne({
          assignedToUserId: userObjectId,
          prospectId: prospectObjectId,
          leadEngagementId: engagement._id,
          type: "APPOINTMENT",
          status: { $in: ["Open", "Overdue"] },
        })
          .sort({ dueAt: -1, createdAt: -1 })
          .session(session);
      }

      const appointmentTitle = `Needs Assessment Meeting scheduled with ${prospect.firstName}`;
      const appointmentDescription = `Attend needs assessment scheduled meeting with ${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName} (Lead ${lead.leadCode || "—"}). Meeting window: ${formatDateTimeInManila(dt)} to ${formatDateTimeInManila(endAt)} (Asia/Manila).`;
      const appointmentDueAt = new Date(endAt.getTime() + 15 * 60 * 1000);
      const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();

      if (allowAddNeedsAssessmentMeeting) {
        const priorOpenAppointments = await Task.find({
          assignedToUserId: userObjectId,
          prospectId: prospectObjectId,
          leadEngagementId: engagement._id,
          type: "APPOINTMENT",
          status: { $in: ["Open", "Overdue"] },
        }).session(session);
        const nowDone = new Date();
        for (const t of priorOpenAppointments) {
          t.status = "Done";
          t.completedAt = nowDone;
          await t.save({ session });
        }
      }

      if (shouldUpdateExistingAppointmentTask) {
        const appointmentTaskWasCreated = !appointmentTask;
        if (appointmentTaskWasCreated) {
          appointmentTask = await Task.create(
            [
              {
                assignedToUserId: userObjectId,
                prospectId: prospectObjectId,
                leadEngagementId: engagement._id,
                type: "APPOINTMENT",
                title: appointmentTitle,
                description: appointmentDescription,
                dueAt: appointmentDueAt,
                status: "Open",
                dedupeKey: appointmentDedupeKey,
              },
            ],
            { session }
          ).then((docs) => docs[0]);
        } else {
          appointmentTask.title = appointmentTitle;
          appointmentTask.description = appointmentDescription;
          appointmentTask.dueAt = appointmentDueAt;
          appointmentTask.status = "Open";
          appointmentTask.completedAt = null;
          appointmentTask.wasDelayed = false;
          appointmentTask.dedupeKey = appointmentDedupeKey;
          await appointmentTask.save({ session });
        }

        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: appointmentTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
          includeTaskAdded: !appointmentTaskWasCreated,
          refreshTaskAdded: !appointmentTaskWasCreated,
        });
      } else if (!appointmentTask) {
        appointmentTask = await Task.create(
          [
            {
              assignedToUserId: userObjectId,
              prospectId: prospectObjectId,
              leadEngagementId: engagement._id,
              type: "APPOINTMENT",
              title: appointmentTitle,
              description: appointmentDescription,
              dueAt: appointmentDueAt,
              status: "Open",
              dedupeKey: appointmentDedupeKey,
            },
          ],
          { session }
        ).then((docs) => docs[0]);

        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: appointmentTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
        });
      } else {
        appointmentTask.title = appointmentTitle;
        appointmentTask.description = appointmentDescription;
        appointmentTask.dueAt = appointmentDueAt;
        appointmentTask.status = "Open";
        appointmentTask.completedAt = null;
        appointmentTask.wasDelayed = false;
        await appointmentTask.save({ session });

        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: appointmentTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
          refreshTaskAdded: true,
        });
      }
      appointmentTaskIdForNotif = appointmentTask?._id || null;
      if (!allowRescheduleFromNeeds && !allowAddNeedsAssessmentMeeting && !allowRescheduleFollowUpNeedsAssessmentMeeting) {
        const now = new Date();
        engagement.currentStage = "Needs Assessment";
        engagement.currentActivityKey = "Record Prospect Attendance";
        engagement.stageCompletedAt = now;
        engagement.stageHistory = Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [];

        const openContacting = [...engagement.stageHistory]
          .reverse()
          .find((h) => h?.stage === "Contacting" && !h?.completedAt);
        if (openContacting) {
          openContacting.completedAt = now;
          openContacting.reason = "Meeting scheduled successfully.";
        }

        engagement.stageHistory.push({
          stage: "Needs Assessment",
          startedAt: now,
          completedAt: null,
          reason: "Moved from Contacting after meeting schedule.",
        });

        engagement.stageStartedAt = now;
      } else {
        engagement.currentStage = "Needs Assessment";
        if (allowAddNeedsAssessmentMeeting) {
          engagement.currentActivityKey = "Perform Needs Analysis";
        }
      }
      await engagement.save({ session });
    });
    await ensureTaskMissedNotificationsForUser(userObjectId, { forceUnread: true, taskIds: [appointmentTaskIdForNotif] });

    return res.json({
      message: Boolean(rescheduleFollowUpNeedsAssessmentMeeting)
        ? "Follow-up needs assessment meeting rescheduled. Continue with Perform Needs Analysis."
        : Boolean(addNewNeedsAssessmentMeeting)
        ? "New needs assessment meeting scheduled. Continue with Perform Needs Analysis."
        : Boolean(rescheduleFromNeeds)
        ? "Meeting rescheduled. Continue with the current Needs Assessment activity."
        : "Meeting scheduled. Contacting completed and Needs Assessment activated.",
    });
  } catch (err) {
    console.error("Schedule meeting error:", err);
    return res.status(err?.status || 500).json({
      message: err?.message || "Server error.",
      code: err?.code,
    });
  } finally {
    session.endSession();
  }
});



app.get("/api/prospects/:prospectId/leads/:leadId/needs-assessment", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL", historyCycle } = req.query;
    const { prospectId, leadId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId })
      .select("firstName middleName lastName sex civilStatus birthday age occupation occupationCategory address")
      .lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).select("_id").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage currentActivityKey contactAttemptCycle").lean();
    if (!engagement) return res.status(404).json({ message: "Lead engagement not found." });

    await ensureNeedsAssessmentAttemptCycleIndex();

    const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
    const requestedHistoryCycle = Number(historyCycle || 0);
    const isHistoryCycleRequest = Number.isInteger(requestedHistoryCycle) && requestedHistoryCycle > 0;
    const targetAttemptCycle = isHistoryCycleRequest ? requestedHistoryCycle : currentAttemptCycle;
    const needsAssessmentSelect = "attemptCycle outcomeActivity attendanceConfirmed attendedAt attendanceProofImageDataUrl attendanceProofFileName dependents needsPriorities followUpNeedsAssessmentRequired followUpNeedsAssessmentDecidedAt";

    let needsAssessment = await NeedsAssessment.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: targetAttemptCycle,
    })
      .select(needsAssessmentSelect)
      .lean();

    if (!needsAssessment && !isHistoryCycleRequest) {
      const created = await NeedsAssessment.create({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      });
      needsAssessment = created.toObject();
    }

    const allCycleNeedsAssessments = await NeedsAssessment.find({ leadEngagementId: engagement._id })
      .select(needsAssessmentSelect)
      .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    const latestPriorNeedsDoc = allCycleNeedsAssessments
      .filter((doc) => normalizeAttemptCycle(doc?.attemptCycle) < currentAttemptCycle && needsAssessmentHasSavedDetails(doc))[0] || null;
    const priorNeedsPrefillSource = latestPriorNeedsDoc;
    const hasPriorNeedsPrefill = !isHistoryCycleRequest && Boolean(priorNeedsPrefillSource);

    if (!needsAssessment) {
      needsAssessment = {
        attemptCycle: targetAttemptCycle,
        outcomeActivity: "Record Prospect Attendance",
        attendanceConfirmed: false,
        attendedAt: null,
        attendanceProofImageDataUrl: "",
        attendanceProofFileName: "",
        dependents: [],
        needsPriorities: {},
        followUpNeedsAssessmentRequired: "",
        followUpNeedsAssessmentDecidedAt: null,
      };
    }

    const allLeadIds = await Lead.find({ prospectId: prospectObjectId }).distinct("_id");
    const allLeadEngagementIds = await LeadEngagement.find({ leadId: { $in: allLeadIds } }).distinct("_id");
    const policyholders = await Policyholder.find({ leadEngagementId: { $in: allLeadEngagementIds } })
      .select("policyNumber status productId")
      .populate("productId", "productName productCategory")
      .lean();

    const existingPolicies = (policyholders || []).map((p) => ({
      policyNumber: p.policyNumber || "",
      productName: p?.productId?.productName || "",
      productCategory: p?.productId?.productCategory || "",
      status: p.status || "",
    }));

    const unavailablePriorityCategories = await getNonCancelledPolicyPriorityCategoriesForProspect(prospectObjectId, userObjectId, {
      excludeLeadEngagementId: engagement._id,
    });

    const computedAge = prospect.birthday ? computeAgeFromBirthday(new Date(prospect.birthday)) : null;

    const products = await Product.find({})
      .select("_id productName productCategory description ageRequirement minimumSumAssured minimumAnnualPremium")
      .sort({ productCategory: 1, productName: 1 })
      .lean();

    await ensureScheduledMeetingAttemptCycleBackfill();

    const proposalMeetingQuery = {
      leadEngagementId: engagement._id,
      meetingType: "Proposal Presentation",
      attemptCycle: targetAttemptCycle,
    };
    const proposalMeetings = await ScheduledMeeting.find(proposalMeetingQuery)
      .sort({ startAt: -1, createdAt: -1 })
      .select("_id meetingType attemptCycle startAt endAt durationMin mode platform platformOther link inviteSent place status createdAt")
      .lean();
    const proposalMeeting = Array.isArray(proposalMeetings) && proposalMeetings.length ? proposalMeetings[0] : null;

    const needsSteps = [
      "Record Prospect Attendance",
      "Perform Needs Analysis",
      "Schedule Proposal Presentation",
    ];
    const engagementActivity = String(engagement.currentActivityKey || "").trim();
    const naOutcome = String(needsAssessment.outcomeActivity || "").trim();

    const hasProposalPresentationMeeting = Array.isArray(proposalMeetings) && proposalMeetings.length > 0;

    let effectiveNeedsActivityKey;
    if (isHistoryCycleRequest) {
      if (hasProposalPresentationMeeting) {
        effectiveNeedsActivityKey = "Schedule Proposal Presentation";
      } else if (!needsAssessment.attendanceConfirmed) {
        effectiveNeedsActivityKey = "Record Prospect Attendance";
      } else if (["Perform Needs Analysis", "Schedule Proposal Presentation"].includes(naOutcome)) {
        effectiveNeedsActivityKey = naOutcome;
      } else if (naOutcome === "Record Prospect Attendance") {
        effectiveNeedsActivityKey = "Perform Needs Analysis";
      } else {
        effectiveNeedsActivityKey = "Perform Needs Analysis";
      }
    } else if (needsSteps.includes(engagementActivity)) {
      effectiveNeedsActivityKey = engagementActivity;
    } else if (["Proposal", "Application", "Policy Issuance"].includes(String(engagement.currentStage || ""))) {
      // Once lead has moved past Needs Assessment, keep this stage at its terminal activity.
      effectiveNeedsActivityKey = "Schedule Proposal Presentation";
    } else if (!needsAssessment.attendanceConfirmed) {
      effectiveNeedsActivityKey = "Record Prospect Attendance";
    } else if (["Perform Needs Analysis", "Schedule Proposal Presentation"].includes(naOutcome)) {
      effectiveNeedsActivityKey = naOutcome;
    } else if (naOutcome === "Record Prospect Attendance") {
      effectiveNeedsActivityKey = "Perform Needs Analysis";
    } else {
      effectiveNeedsActivityKey = "Perform Needs Analysis";
    }

    return res.json({
      prospectProfile: {
        fullName: `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim(),
        sex: prospect.sex || "",
        civilStatus: prospect.civilStatus || "",
        birthday: prospect.birthday || null,
        age: computedAge ?? (prospect.age ?? null),
        occupation: prospect.occupation || "",
        occupationCategory: prospect.occupationCategory || "Not Employed",
        address: prospect.address || {},
      },
      needsAssessment: {
        currentActivityKey: effectiveNeedsActivityKey,
        attendanceConfirmed: Boolean(needsAssessment.attendanceConfirmed),
        attendedAt: needsAssessment.attendedAt || null,
        attendanceProofImageDataUrl: String(needsAssessment.attendanceProofImageDataUrl || ""),
        attendanceProofFileName: String(needsAssessment.attendanceProofFileName || ""),
        outcomeActivity: hasProposalPresentationMeeting && !needsAssessment.outcomeActivity ? "Schedule Proposal Presentation" : (needsAssessment.outcomeActivity || ""),
        followUpNeedsAssessmentRequired: String(needsAssessment.followUpNeedsAssessmentRequired || (hasProposalPresentationMeeting ? "NO" : "")),
        followUpNeedsAssessmentDecidedAt: needsAssessment.followUpNeedsAssessmentDecidedAt || null,
        dependents: Array.isArray(needsAssessment.dependents) ? needsAssessment.dependents : [],
        needsPriorities: needsAssessment.needsPriorities || {},
      },
      needsAssessmentPrefill: hasPriorNeedsPrefill
        ? {
            sourceAttemptCycle: normalizeAttemptCycle(priorNeedsPrefillSource.attemptCycle),
            dependents: Array.isArray(priorNeedsPrefillSource.dependents) ? priorNeedsPrefillSource.dependents : [],
            needsPriorities: priorNeedsPrefillSource.needsPriorities || {},
          }
        : null,
      existingPolicies,
      unavailablePriorityCategories,
      availablePriorityCategories: NEEDS_PRIORITY_CATEGORIES.filter((category) => !unavailablePriorityCategories.includes(category)),
      products: Array.isArray(products) ? products : [],
      proposalMeeting: proposalMeeting
        ? {
            id: proposalMeeting._id || null,
            meetingType: proposalMeeting.meetingType,
            attemptCycle: proposalMeeting.attemptCycle || null,
            startAt: proposalMeeting.startAt || null,
            endAt: proposalMeeting.endAt || null,
            durationMin: proposalMeeting.durationMin ?? null,
            mode: proposalMeeting.mode || "",
            platform: proposalMeeting.platform || "",
            platformOther: proposalMeeting.platformOther || "",
            link: proposalMeeting.link || "",
            inviteSent: Boolean(proposalMeeting.inviteSent),
            place: proposalMeeting.place || "",
            status: proposalMeeting.status || "",
            createdAt: proposalMeeting.createdAt || null,
          }
        : null,
      proposalMeetings: (Array.isArray(proposalMeetings) ? proposalMeetings : []).map((meeting) => ({
        id: meeting._id || null,
        meetingType: meeting.meetingType,
        attemptCycle: meeting.attemptCycle || null,
        startAt: meeting.startAt || null,
        endAt: meeting.endAt || null,
        durationMin: meeting.durationMin ?? null,
        mode: meeting.mode || "",
        platform: meeting.platform || "",
        platformOther: meeting.platformOther || "",
        link: meeting.link || "",
        inviteSent: Boolean(meeting.inviteSent),
        place: meeting.place || "",
        status: meeting.status || "",
        createdAt: meeting.createdAt || null,
      })),
      engagement: {
        currentStage: engagement.currentStage,
        currentActivityKey: engagement.currentActivityKey || "",
      },
    });
  } catch (err) {
    console.error("Get needs assessment error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/needs-assessment/attendance", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const { attended, attendanceProofImageDataUrl, attendanceProofFileName } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }
    if (attended !== true) {
      return res.status(400).json({ message: "Prospect attendance must be marked attended." });
    }

    const proofDataUrl = String(attendanceProofImageDataUrl || "").trim();
    const proofFileName = String(attendanceProofFileName || "").trim();
    const dataUrlMatch = proofDataUrl.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!dataUrlMatch) {
      return res.status(400).json({ message: "Proof of attendance image is required and must be JPG, JPEG, or PNG." });
    }
    const proofBase64 = String(dataUrlMatch[2] || "").replace(/\s+/g, "");
    const proofBytes = Math.floor((proofBase64.length * 3) / 4);
    const MAX_PROOF_IMAGE_BYTES = 5 * 1024 * 1024;
    if (proofBytes > MAX_PROOF_IMAGE_BYTES) {
      return res.status(400).json({ message: "Proof of attendance image must be 5MB or smaller." });
    }
    if (proofFileName && !/\.(jpe?g|png)$/i.test(proofFileName)) {
      return res.status(400).json({ message: "Proof of attendance file type must be JPG, JPEG, or PNG." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    let presentationTaskIdForNotif = null;
    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      await ensureNeedsAssessmentAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const na = (await NeedsAssessment.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      }).session(session)) || new NeedsAssessment({ leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle });

      na.attemptCycle = currentAttemptCycle;
      na.attendanceConfirmed = true;
      na.attendedAt = new Date();
      na.attendanceProofImageDataUrl = proofDataUrl;
      na.attendanceProofFileName = proofFileName;
      const existingOutcomeActivity = String(na.outcomeActivity || "").trim();
      if (!["Perform Needs Analysis", "Schedule Proposal Presentation"].includes(existingOutcomeActivity)) {
        na.outcomeActivity = "Record Prospect Attendance";
      }
      await na.save({ session });

      if (engagement.currentStage === "Needs Assessment") {
        const currentNeedsActivity = String(engagement.currentActivityKey || "").trim();
        if (!currentNeedsActivity || currentNeedsActivity === "Record Prospect Attendance") {
          engagement.currentActivityKey = "Perform Needs Analysis";
          await engagement.save({ session });
        }
      }
    });

    return res.json({ message: "Prospect attendance recorded.", currentActivityKey: "Perform Needs Analysis" });
  } catch (err) {
    console.error("Record attendance error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});

app.put("/api/prospects/:prospectId/leads/:leadId/needs-assessment", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const { basicInformation, dependents, needsPriorities } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const normalizedDependents = Array.isArray(dependents) ? dependents : [];
    for (let i = 0; i < normalizedDependents.length; i += 1) {
      const d = normalizedDependents[i] || {};
      if (!String(d.name || "").trim()) return res.status(400).json({ message: `Dependent #${i + 1}: name is required.` });
      const age = Number(d.age);
      if (!Number.isFinite(age) || age < 0 || age > 120) {
        return res.status(400).json({ message: `Dependent #${i + 1}: age must be between 0 and 120.` });
      }
      if (!["Male", "Female"].includes(String(d.gender || ""))) {
        return res.status(400).json({ message: `Dependent #${i + 1}: invalid gender.` });
      }
      if (!["Child", "Parent", "Sibling"].includes(String(d.relationship || ""))) {
        return res.status(400).json({ message: `Dependent #${i + 1}: invalid relationship.` });
      }
    }

    const toNonNegativeNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const hasAtMostTwoDecimals = (n) => Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-8;

    const INCOME_BANDS = {
      BELOW_15000: { requiresManual: true },
      "15000_29999": { max: 29999 },
      "30000_49999": { max: 49999 },
      "50000_79999": { max: 79999 },
      "80000_99999": { max: 99999 },
      "100000_249999": { max: 249999 },
      "250000_499999": { max: 499999 },
      ABOVE_500000: { requiresManual: true },
    };

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);
    let needsAnalysisNextActivityKey = "Perform Needs Analysis";

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      await ensureNeedsAssessmentAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const na = (await NeedsAssessment.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      }).session(session)) || new NeedsAssessment({ leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle });
      const needsAttemptCycle = normalizeAttemptCycle(na.attemptCycle);

      const currentNeedsActivity = String(engagement.currentActivityKey || "").trim();
      const engagementStage = String(engagement.currentStage || "").trim();
      const canEditNeedsAnalysis = ["Proposal", "Application", "Policy Issuance"].includes(engagementStage) ||
        ["Perform Needs Analysis", "Schedule Proposal Presentation"].includes(currentNeedsActivity);
      if (needsAttemptCycle !== currentAttemptCycle || !na.attendanceConfirmed || !canEditNeedsAnalysis) {
        throw Object.assign(new Error("Record attendance first and proceed to Perform Needs Analysis."), { status: 409 });
      }

      const info = basicInformation || {};
      const sex = String(info.sex || prospect.sex || "").trim();
      const civilStatus = String(info.civilStatus || "").trim();
      const occupationCategory = String(info.occupationCategory || "").trim();
      const occupation = String(info.occupation || "").trim();
      const addressInfo = info.address && typeof info.address === "object" ? info.address : {};
      const line = String(addressInfo.line || "").trim();
      const barangay = String(addressInfo.barangay || "").trim();
      const city = String(addressInfo.city || "").trim();
      const otherCity = String(addressInfo.otherCity || "").trim();
      const region = String(addressInfo.region || "").trim();
      const zipCode = String(addressInfo.zipCode || "").trim();
      const birthdayRaw = String(info.birthday || "").trim();

      if (!["Male", "Female"].includes(sex)) {
        throw Object.assign(new Error("Sex is required."), { status: 400 });
      }
      if (!["Single", "Married", "Widowed", "Separated", "Annulled"].includes(civilStatus)) {
        throw Object.assign(new Error("Civil status is required."), { status: 400 });
      }
      if (!birthdayRaw) {
        throw Object.assign(new Error("Birthday is required."), { status: 400 });
      }
      if (occupation.length > 150) {
        throw Object.assign(new Error("Occupation must be 150 characters or less."), { status: 400 });
      }
      if (!["Employed", "Self-Employed", "Not Employed"].includes(occupationCategory)) {
        throw Object.assign(new Error("Occupation category is required."), { status: 400 });
      }
      if (occupationCategory !== "Not Employed" && !occupation) {
        throw Object.assign(new Error("Occupation is required for employed/self-employed prospects."), { status: 400 });
      }

      if (!line) throw Object.assign(new Error("Street address is required."), { status: 400 });
      if (!barangay) throw Object.assign(new Error("Barangay is required."), { status: 400 });
      if (!city) throw Object.assign(new Error("City is required."), { status: 400 });
      if (city === "Other" && !otherCity) throw Object.assign(new Error("Other city is required."), { status: 400 });
      if (city !== "Other" && otherCity) throw Object.assign(new Error("Other city should be blank unless city is Other."), { status: 400 });
      if (!region) throw Object.assign(new Error("Region is required."), { status: 400 });
      if (!zipCode) throw Object.assign(new Error("Zip code is required."), { status: 400 });
      if (!/^\d{4}$/.test(zipCode)) throw Object.assign(new Error("Zip code must be 4 digits."), { status: 400 });

      const np = needsPriorities && typeof needsPriorities === "object" ? needsPriorities : {};
      const currentPriority = String(np.currentPriority || "").trim();
      if (!NEEDS_PRIORITY_CATEGORIES.includes(currentPriority)) {
        throw Object.assign(new Error("Current priority is required."), { status: 400 });
      }

      const unavailablePriorityCategories = await getNonCancelledPolicyPriorityCategoriesForProspect(prospectObjectId, userObjectId, {
        excludeLeadEngagementId: engagement._id,
      });
      if (unavailablePriorityCategories.includes(currentPriority)) {
        throw Object.assign(new Error(`${currentPriority} priority is unavailable because this prospect already has a non-cancelled policy for this priority.`), { status: 409 });
      }

      const monthlyIncomeBand = String(np.monthlyIncomeBand || "").trim();
      if (!Object.prototype.hasOwnProperty.call(INCOME_BANDS, monthlyIncomeBand)) {
        throw Object.assign(new Error("Approximate monthly income bracket is required."), { status: 400 });
      }

      const monthlyIncomeAmountInput = toNonNegativeNumber(np.monthlyIncomeAmount);
      let approxIncome = null;
      if (INCOME_BANDS[monthlyIncomeBand].requiresManual) {
        if (monthlyIncomeAmountInput === null) {
          throw Object.assign(new Error("Approximate monthly income amount is required for selected bracket."), { status: 400 });
        }
        if (monthlyIncomeBand === "BELOW_15000" && monthlyIncomeAmountInput >= 15000) {
          throw Object.assign(new Error("Manual monthly income must be below Php 15,000 for selected bracket."), { status: 400 });
        }
        if (monthlyIncomeBand === "ABOVE_500000" && monthlyIncomeAmountInput <= 500000) {
          throw Object.assign(new Error("Manual monthly income must be above Php 500,000 for selected bracket."), { status: 400 });
        }
        if (!hasAtMostTwoDecimals(monthlyIncomeAmountInput)) {
          throw Object.assign(new Error("Manual monthly income amount must have at most 2 decimal places."), { status: 400 });
        }
        approxIncome = monthlyIncomeAmountInput;
      } else {
        approxIncome = INCOME_BANDS[monthlyIncomeBand].max;
      }

      const minPremium = toNonNegativeNumber(np.minPremium);
      const maxPremium = toNonNegativeNumber(np.maxPremium);
      if (minPremium === null) throw Object.assign(new Error("Minimum willing monthly premium is required."), { status: 400 });
      if (maxPremium === null) throw Object.assign(new Error("Maximum willing monthly premium is required."), { status: 400 });
      if (!hasAtMostTwoDecimals(minPremium)) throw Object.assign(new Error("Minimum willing monthly premium must have at most 2 decimal places."), { status: 400 });
      if (!hasAtMostTwoDecimals(maxPremium)) throw Object.assign(new Error("Maximum willing monthly premium must have at most 2 decimal places."), { status: 400 });
      if (minPremium > approxIncome) throw Object.assign(new Error("Minimum willing monthly premium cannot be higher than approximate monthly income."), { status: 400 });
      if (maxPremium > approxIncome) throw Object.assign(new Error("Maximum willing monthly premium cannot be higher than approximate monthly income."), { status: 400 });
      if (maxPremium < minPremium) throw Object.assign(new Error("Maximum willing monthly premium must be equal to or higher than minimum."), { status: 400 });

      const productSelectionInput = np?.productSelection && typeof np.productSelection === "object" ? np.productSelection : {};
      const selectedProductId = String(productSelectionInput.selectedProductId || "").trim();
      const requestedFrequency = String(productSelectionInput.requestedFrequency || "Monthly").trim() || "Monthly";
      const requestedPremiumPayment = toNonNegativeNumber(productSelectionInput.requestedPremiumPayment);
      if (!selectedProductId || !mongoose.isValidObjectId(selectedProductId)) {
        throw Object.assign(new Error("Product Selection: product is required."), { status: 400 });
      }
      if (!["Monthly", "Quarterly", "Half-yearly", "Yearly"].includes(requestedFrequency)) {
        throw Object.assign(new Error("Product Selection: requested frequency is invalid."), { status: 400 });
      }
      if (requestedPremiumPayment === null) {
        throw Object.assign(new Error("Product Selection: requested premium payment is required."), { status: 400 });
      }
      if (!hasAtMostTwoDecimals(requestedPremiumPayment)) {
        throw Object.assign(new Error("Product Selection: requested premium payment must have at most 2 decimal places."), { status: 400 });
      }
      const selectedProductDoc = await Product.findById(selectedProductId).select("productCategory").lean();
      if (!selectedProductDoc) {
        throw Object.assign(new Error("Product Selection: selected product not found."), { status: 400 });
      }
      if (String(selectedProductDoc.productCategory || "") !== currentPriority) {
        throw Object.assign(new Error("Product Selection: selected product does not match the chosen priority."), { status: 400 });
      }

      const optionalRidersInput = Array.isArray(np?.optionalRiders) ? np.optionalRiders : [];
      const optionalRiders = optionalRidersInput
        .map((r) => ({
          riderKey: String(r?.riderKey || "").trim(),
          riderName: String(r?.riderName || "").trim(),
          enabled: Boolean(r?.enabled),
        }))
        .filter((r) => r.riderKey && r.riderName);
      const productRidersNotes = String(np?.productRidersNotes || "").trim();
      if (productRidersNotes.length > 2000) {
        throw Object.assign(new Error("Notes about selected product and riders must be 2000 characters or less."), { status: 400 });
      }

      const prioritiesPayload = {
        currentPriority,
        monthlyIncomeBand,
        monthlyIncomeAmount: monthlyIncomeAmountInput,
        minPremium,
        maxPremium,
        productSelection: {
          selectedProductId: new mongoose.Types.ObjectId(selectedProductId),
          requestedPremiumPayment,
          requestedFrequency,
        },
        optionalRiders,
        productRidersNotes,
        protection: {},
        health: {},
        investment: {},
      };

      const currentYear = new Date().getFullYear();
      const ageForCompute = Number(info.age ?? prospect.age);

      if (currentPriority === "Protection") {
        const monthlySpend = toNonNegativeNumber(np?.protection?.monthlySpend);
        const savingsForProtection = toNonNegativeNumber(np?.protection?.savingsForProtection);
        if (monthlySpend === null) throw Object.assign(new Error("Protection: approximate monthly spend is required."), { status: 400 });
        if (!hasAtMostTwoDecimals(monthlySpend)) throw Object.assign(new Error("Protection: monthly spend must have at most 2 decimal places."), { status: 400 });
        if (monthlySpend > approxIncome) throw Object.assign(new Error("Protection: monthly spend cannot be higher than approximate monthly income."), { status: 400 });
        if (savingsForProtection === null) throw Object.assign(new Error("Protection: savings for protection is required."), { status: 400 });
        if (!hasAtMostTwoDecimals(savingsForProtection)) throw Object.assign(new Error("Protection: savings for protection must have at most 2 decimal places."), { status: 400 });

        const numberOfDependents = normalizedDependents.length;
        const yearsToProtectIncome = Number.isFinite(ageForCompute) ? Math.max(0, 60 - ageForCompute) : 0;
        const protectionGap = (monthlySpend * 12 * yearsToProtectIncome) - savingsForProtection;

        prioritiesPayload.protection = {
          monthlySpend,
          numberOfDependents,
          yearsToProtectIncome,
          savingsForProtection,
          protectionGap,
        };
      }

      if (currentPriority === "Health") {
        const amountToCoverCriticalIllness = toNonNegativeNumber(np?.health?.amountToCoverCriticalIllness);
        const savingsForCriticalIllness = toNonNegativeNumber(np?.health?.savingsForCriticalIllness);
        if (amountToCoverCriticalIllness === null) throw Object.assign(new Error("Health: approximate amount to cover critical illness is required."), { status: 400 });
        if (!hasAtMostTwoDecimals(amountToCoverCriticalIllness)) throw Object.assign(new Error("Health: amount to cover critical illness must have at most 2 decimal places."), { status: 400 });
        if (savingsForCriticalIllness === null) throw Object.assign(new Error("Health: savings for critical illness is required."), { status: 400 });
        if (!hasAtMostTwoDecimals(savingsForCriticalIllness)) throw Object.assign(new Error("Health: savings for critical illness must have at most 2 decimal places."), { status: 400 });
        if (savingsForCriticalIllness > amountToCoverCriticalIllness) {
          throw Object.assign(new Error("Health: savings for critical illness cannot be higher than amount to cover critical illness."), { status: 400 });
        }
        prioritiesPayload.health = {
          amountToCoverCriticalIllness,
          savingsForCriticalIllness,
          criticalIllnessGap: amountToCoverCriticalIllness - savingsForCriticalIllness,
        };
      }

      if (currentPriority === "Investment") {
        const savingsPlan = String(np?.investment?.savingsPlan || "").trim();
        const savingsPlanOther = String(np?.investment?.savingsPlanOther || "").trim();
        const targetSavingsAmount = toNonNegativeNumber(np?.investment?.targetSavingsAmount);
        const targetUtilizationYear = Number(np?.investment?.targetUtilizationYear);
        const savingsForInvestment = toNonNegativeNumber(np?.investment?.savingsForInvestment);
        const riskProfiler = np?.investment?.riskProfiler && typeof np.investment.riskProfiler === "object"
          ? np.investment.riskProfiler
          : {};
        const fundChoice = np?.investment?.fundChoice && typeof np.investment.fundChoice === "object"
          ? np.investment.fundChoice
          : {};

        const INVESTMENT_FUNDS = {
          PRULINK_MONEY_MARKET_FUND: { fundName: "PRULink Money Market Fund", currency: "PHP", riskRating: 1 },
          PRULINK_BOND_FUND: { fundName: "PRULink Bond Fund", currency: "PHP", riskRating: 1 },
          PRULINK_MANAGED_FUND: { fundName: "PRULink Managed Fund", currency: "PHP", riskRating: 2 },
          PRULINK_PROACTIVE_FUND: { fundName: "PRULink Proactive Fund", currency: "PHP", riskRating: 3 },
          PRULINK_GROWTH_FUND: { fundName: "PRULink Growth Fund", currency: "PHP", riskRating: 3 },
          PRULINK_EQUITY_FUND: { fundName: "PRULink Equity Fund", currency: "PHP", riskRating: 3 },
          PRULINK_US_DOLLAR_BOND_FUND: { fundName: "PRULink US Dollar Bond Fund", currency: "USD", riskRating: 1 },
          PRULINK_ASIAN_LOCAL_BOND_FUND: { fundName: "PRULink Asian Local Bond Fund", currency: "USD", riskRating: 2 },
          PRULINK_CASH_FLOW_FUND: { fundName: "PRULink Cash Flow Fund", currency: "USD", riskRating: 2 },
          PRULINK_ASIAN_BALANCED_FUND: { fundName: "PRULink Asian Balanced Fund", currency: "USD", riskRating: 2 },
          PRULINK_ASIA_PACIFIC_EQUITY_FUND: { fundName: "PRULink Asia Pacific Equity Fund", currency: "USD", riskRating: 3 },
          PRULINK_GLOBAL_EMERGING_MARKETS_DYNAMIC_FUND: { fundName: "PRULink Global Emerging Markets Dynamic Fund", currency: "USD", riskRating: 3 },
        };

        const horizon = String(riskProfiler.investmentHorizon || "").trim();
        const goal = String(riskProfiler.investmentGoal || "").trim();
        const experience = String(riskProfiler.marketExperience || "").trim();
        const volatility = String(riskProfiler.volatilityReaction || "").trim();
        const capitalLoss = String(riskProfiler.capitalLossAffordability || "").trim();
        const tradeoff = String(riskProfiler.riskReturnTradeoff || "").trim();

        const horizonScores = { LT_3: 0, BETWEEN_3_7: 2, BETWEEN_7_10: 3, AT_LEAST_10: 4 };
        const goalScores = { CAPITAL_PRESERVATION: 1, STEADY_GROWTH: 2, SIGNIFICANT_APPRECIATION: 3 };
        const expScores = { NONE: 0, I_ONLY: 2, II_ONLY: 4, BOTH: 4 };
        const volScores = { FULL_WITHDRAW: 0, LESS_RISKY: 1, HOLD: 2, TOP_UPS: 4 };
        const lossScores = { NO_LOSS: 0, UP_TO_5: 1, UP_TO_10: 2, ABOVE_10: 3 };
        const tradeoffScores = { PORTFOLIO_A: 1, PORTFOLIO_B: 1, PORTFOLIO_C: 2, PORTFOLIO_D: 3 };

        if (!["Home", "Vehicle", "Holiday", "Early Retirement", "Other"].includes(savingsPlan)) {
          throw Object.assign(new Error("Investment: savings plan is required."), { status: 400 });
        }
        if (savingsPlan === "Other" && !savingsPlanOther) {
          throw Object.assign(new Error("Investment: please specify other savings plan."), { status: 400 });
        }
        if (targetSavingsAmount === null) throw Object.assign(new Error("Investment: target savings amount is required."), { status: 400 });
        if (!hasAtMostTwoDecimals(targetSavingsAmount)) throw Object.assign(new Error("Investment: target savings amount must have at most 2 decimal places."), { status: 400 });
        if (!Number.isFinite(targetUtilizationYear)) throw Object.assign(new Error("Investment: target year to utilize savings is required."), { status: 400 });
        if (!Number.isInteger(targetUtilizationYear)) throw Object.assign(new Error("Investment: target year must be a whole number."), { status: 400 });
        if (targetUtilizationYear < currentYear + 2 || targetUtilizationYear > currentYear + 20) {
          throw Object.assign(new Error("Investment: target year must be between 2 and 20 years from current year."), { status: 400 });
        }
        if (savingsForInvestment === null) throw Object.assign(new Error("Investment: savings for investment is required."), { status: 400 });
        if (!hasAtMostTwoDecimals(savingsForInvestment)) throw Object.assign(new Error("Investment: savings for investment must have at most 2 decimal places."), { status: 400 });
        if (savingsForInvestment > targetSavingsAmount) {
          throw Object.assign(new Error("Investment: savings for investment cannot be higher than target savings amount."), { status: 400 });
        }

        if (!Object.prototype.hasOwnProperty.call(horizonScores, horizon)) {
          throw Object.assign(new Error("Investment Risk Profiler: investment horizon is required."), { status: 400 });
        }
        if (!Object.prototype.hasOwnProperty.call(goalScores, goal)) {
          throw Object.assign(new Error("Investment Risk Profiler: investment goal is required."), { status: 400 });
        }
        if (!Object.prototype.hasOwnProperty.call(expScores, experience)) {
          throw Object.assign(new Error("Investment Risk Profiler: market experience is required."), { status: 400 });
        }
        if (!Object.prototype.hasOwnProperty.call(volScores, volatility)) {
          throw Object.assign(new Error("Investment Risk Profiler: short-term volatility reaction is required."), { status: 400 });
        }
        if (!Object.prototype.hasOwnProperty.call(lossScores, capitalLoss)) {
          throw Object.assign(new Error("Investment Risk Profiler: affordability to capital loss is required."), { status: 400 });
        }
        if (!Object.prototype.hasOwnProperty.call(tradeoffScores, tradeoff)) {
          throw Object.assign(new Error("Investment Risk Profiler: risk and return trade-off is required."), { status: 400 });
        }

        const riskProfileScore =
          horizonScores[horizon] +
          goalScores[goal] +
          expScores[experience] +
          volScores[volatility] +
          lossScores[capitalLoss] +
          tradeoffScores[tradeoff];

        const riskProfileCategory =
          riskProfileScore <= 5
            ? "NOT_RECOMMENDED"
            : riskProfileScore <= 9
            ? "CONSERVATIVE"
            : riskProfileScore <= 15
            ? "MODERATE"
            : "AGGRESSIVE";

        const suitableRiskRatingsByCategory = {
          NOT_RECOMMENDED: [],
          CONSERVATIVE: [1],
          MODERATE: [1, 2],
          AGGRESSIVE: [1, 2, 3],
        };
        const allowedRatings = suitableRiskRatingsByCategory[riskProfileCategory] || [];
        const selectedFundsRaw = Array.isArray(fundChoice.selectedFunds) ? fundChoice.selectedFunds : [];
        const normalizedSelectedFunds = [];

        for (const row of selectedFundsRaw) {
          const fundKey = String(row?.fundKey || "").trim();
          if (!fundKey || !Object.prototype.hasOwnProperty.call(INVESTMENT_FUNDS, fundKey)) {
            throw Object.assign(new Error("Fund Choice: invalid fund selection."), { status: 400 });
          }
          const allocationPercent = toNonNegativeNumber(row?.allocationPercent);
          if (allocationPercent === null || allocationPercent > 100) {
            throw Object.assign(new Error("Fund Choice: allocation per fund must be between 0 and 100."), { status: 400 });
          }
          if (!hasAtMostTwoDecimals(allocationPercent)) {
            throw Object.assign(new Error("Fund Choice: allocation per fund must have at most 2 decimal places."), { status: 400 });
          }
          const meta = INVESTMENT_FUNDS[fundKey];
          normalizedSelectedFunds.push({
            fundKey,
            fundName: meta.fundName,
            currency: meta.currency,
            riskRating: meta.riskRating,
            allocationPercent,
            isSuitable: allowedRatings.includes(meta.riskRating),
          });
        }

        if (normalizedSelectedFunds.length === 0) {
          throw Object.assign(new Error("Fund Choice: select at least one fund."), { status: 400 });
        }

        const totalAllocationPercent = normalizedSelectedFunds.reduce((sum, item) => sum + item.allocationPercent, 0);
        if (Math.abs(totalAllocationPercent - 100) > 0.0001) {
          throw Object.assign(new Error("Fund Choice: allocation in percentage must equal 100%."), { status: 400 });
        }

        const fundMatch = normalizedSelectedFunds.some((item) => !item.isSuitable) ? "No" : "Yes";
        const mismatchReason = String(fundChoice.mismatchReason || "").trim();
        if (fundMatch === "No" && !mismatchReason) {
          throw Object.assign(new Error("Fund Choice: reason for mismatch is required when fund match is No."), { status: 400 });
        }

        prioritiesPayload.investment = {
          savingsPlan,
          savingsPlanOther: savingsPlan === "Other" ? savingsPlanOther : "",
          targetSavingsAmount,
          targetUtilizationYear,
          savingsForInvestment,
          savingsGap: targetSavingsAmount - savingsForInvestment,
          riskProfiler: {
            investmentHorizon: horizon,
            investmentGoal: goal,
            marketExperience: experience,
            volatilityReaction: volatility,
            capitalLossAffordability: capitalLoss,
            riskReturnTradeoff: tradeoff,
            riskProfileScore,
            riskProfileCategory,
          },
          fundChoice: {
            selectedFunds: normalizedSelectedFunds,
            totalAllocationPercent,
            fundMatch,
            mismatchReason: fundMatch === "No" ? mismatchReason : "",
          },
        };
      }

      let nextBirthday = prospect.birthday;
      let nextAge = prospect.age;
      if (birthdayRaw) {
        const b = new Date(birthdayRaw);
        if (Number.isNaN(b.getTime())) throw Object.assign(new Error("Invalid birthday."), { status: 400 });
        if (isFutureDateOnly(b)) throw Object.assign(new Error("Birthday cannot be in the future."), { status: 400 });
        const computedAge = computeAgeFromBirthday(b);
        if (computedAge === null || computedAge < 18 || computedAge > 70) {
          throw Object.assign(new Error("Prospect age must be between 18 and 70 years old."), { status: 400 });
        }
        nextBirthday = b;
        nextAge = computedAge;
      }

      prospect.sex = sex || prospect.sex;
      prospect.civilStatus = civilStatus || prospect.civilStatus;
      prospect.occupationCategory = occupationCategory;
      prospect.occupation = occupationCategory === "Not Employed" ? "" : occupation;
      prospect.address = {
        line,
        barangay,
        city,
        otherCity: city === "Other" ? otherCity : "",
        region,
        zipCode,
        country: "Philippines",
      };
      prospect.birthday = nextBirthday;
      prospect.age = nextAge;
      await prospect.save({ session });

      na.attemptCycle = currentAttemptCycle;
      na.attendanceConfirmed = true;
      na.dependents = normalizedDependents.map((d) => ({
        name: String(d.name || "").trim(),
        age: Number(d.age),
        gender: String(d.gender || ""),
        relationship: String(d.relationship || ""),
      }));
      na.needsPriorities = prioritiesPayload;

      if (engagement.currentStage === "Needs Assessment") {
        const followUpDecision = String(na.followUpNeedsAssessmentRequired || "").trim().toUpperCase();
        needsAnalysisNextActivityKey = followUpDecision === "NO" ? "Schedule Proposal Presentation" : "Perform Needs Analysis";
        na.outcomeActivity = needsAnalysisNextActivityKey;
        engagement.currentActivityKey = needsAnalysisNextActivityKey;
        await engagement.save({ session });
      } else {
        needsAnalysisNextActivityKey = "Schedule Proposal Presentation";
        if (!String(na.outcomeActivity || "").trim()) {
          na.outcomeActivity = "Perform Needs Analysis";
        }
      }
      await na.save({ session });
    });

    return res.json({
      message: "Needs analysis saved.",
      currentActivityKey: needsAnalysisNextActivityKey,
    });
  } catch (err) {
    console.error("Save needs assessment error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/needs-assessment/schedule-proposal", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const {
      meetingAt,
      meetingDate,
      meetingStartTime,
      meetingDurationMin,
      meetingMode,
      meetingPlatform,
      meetingPlatformOther,
      meetingLink,
      meetingInviteSent,
      meetingPlace,
      proposalPresentationScheduleAction,
    } = req.body;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      await ensureNeedsAssessmentAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const na = await NeedsAssessment.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      }).session(session);
      await ensureProposalAttemptCycleIndex();
      const proposalDocForReschedule = await Proposal.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      }).session(session);
      const isProposalAttendanceReschedule =
        engagement.currentStage === "Proposal" &&
        engagement.currentActivityKey === "Record Prospect Attendance" &&
        proposalDocForReschedule?.recordProspectAttendance?.attendanceChoice === "NO";
      const proposalAttendanceChoiceForReschedule = String(proposalDocForReschedule?.recordProspectAttendance?.attendanceChoice || "").trim().toUpperCase();
      const proposalPresentationScheduleActionNormalized = String(proposalPresentationScheduleAction || "").trim().toUpperCase();
      const isProposalPresentationExistingReschedule =
        engagement.currentStage === "Proposal" &&
        engagement.currentActivityKey === "Present Proposal" &&
        proposalPresentationScheduleActionNormalized === "RESCHEDULE_EXISTING";
      const isProposalPresentationAddFurther =
        engagement.currentStage === "Proposal" &&
        engagement.currentActivityKey === "Present Proposal" &&
        proposalPresentationScheduleActionNormalized === "ADD_FURTHER" &&
        String(proposalDocForReschedule?.presentProposal?.proposalAccepted || "").trim().toUpperCase() === "NO";
      const isProposalPresentationRetry =
        engagement.currentStage === "Proposal" &&
        engagement.currentActivityKey === "Present Proposal" &&
        !isProposalPresentationExistingReschedule &&
        (isProposalPresentationAddFurther ||
          (!proposalPresentationScheduleActionNormalized &&
            String(proposalDocForReschedule?.presentProposal?.proposalAccepted || "").trim().toUpperCase() === "NO"));
      const isProposalPendingPresentationReschedule =
        engagement.currentStage === "Proposal" &&
        engagement.currentActivityKey === "Record Prospect Attendance" &&
        !["YES", "NO"].includes(proposalAttendanceChoiceForReschedule);
      const isProposalStageReschedule = isProposalAttendanceReschedule || isProposalPresentationRetry || isProposalPresentationExistingReschedule || isProposalPendingPresentationReschedule;

      if (!na || (!isProposalStageReschedule && engagement.currentActivityKey !== "Schedule Proposal Presentation")) {
        throw Object.assign(new Error("Complete attendance and needs analysis first."), { status: 409 });
      }
      if (!isProposalStageReschedule && String(na.followUpNeedsAssessmentRequired || "").trim().toUpperCase() === "YES") {
        throw Object.assign(new Error("Follow-up needs assessment is required before scheduling proposal presentation."), { status: 409 });
      }

      const durationMin = Number(meetingDurationMin || 120);
      const dt = meetingDate && meetingStartTime
        ? combineDateAndTimeLocal(meetingDate, meetingStartTime)
        : new Date(meetingAt);

      if (!dt || Number.isNaN(dt.getTime())) {
        throw Object.assign(new Error("meeting date/time is required and must be valid."), { status: 400 });
      }

      const latestNeedsAssessmentMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType: "Needs Assessment",
      })
        .sort({ createdAt: -1, startAt: -1 })
        .session(session);
      const latestProposalPresentationMeetingForRetry = (isProposalPresentationRetry || isProposalPresentationExistingReschedule)
        ? await ScheduledMeeting.findOne({
            leadEngagementId: engagement._id,
            meetingType: "Proposal Presentation",
          })
            .sort({ startAt: -1, createdAt: -1 })
            .session(session)
        : null;
      const latestCompletedProposalPresentationMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType: "Proposal Presentation",
        status: "Completed",
        endAt: { $ne: null },
      })
        .sort({ endAt: -1, startAt: -1, createdAt: -1 })
        .session(session);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const existingMeetingDay = latestNeedsAssessmentMeeting?.startAt ? new Date(latestNeedsAssessmentMeeting.startAt) : null;
      if (existingMeetingDay) existingMeetingDay.setHours(0, 0, 0, 0);
      const existingProposalPresentationMeetingDay = latestProposalPresentationMeetingForRetry?.startAt
        ? new Date(latestProposalPresentationMeetingForRetry.startAt)
        : null;
      if (existingProposalPresentationMeetingDay) existingProposalPresentationMeetingDay.setHours(0, 0, 0, 0);
      const minimumMeetingDay = isProposalPresentationExistingReschedule
        ? today
        : isProposalPresentationRetry
        ? new Date(Math.max(today.getTime(), existingProposalPresentationMeetingDay?.getTime() || today.getTime()))
        : existingMeetingDay
        ? new Date(Math.max(today.getTime(), existingMeetingDay.getTime()))
        : tomorrow;
      if (dt < minimumMeetingDay) {
        throw Object.assign(new Error("meetingAt must be on or after the existing appointment date."), { status: 400 });
      }
      const currentDateTime = new Date();
      const currentDay = new Date(currentDateTime);
      currentDay.setHours(0, 0, 0, 0);
      if (dt.getTime() < currentDateTime.getTime()) {
        throw Object.assign(new Error("meetingAt must not be in the past."), { status: 400 });
      }
      if (dt.toDateString() === currentDay.toDateString()) {
        const nextThirtyMinuteSlot = new Date(currentDateTime);
        nextThirtyMinuteSlot.setMinutes(Math.floor(currentDateTime.getMinutes() / 30) * 30 + 30, 0, 0);
        if (dt.getTime() < nextThirtyMinuteSlot.getTime()) {
          throw Object.assign(new Error("Meeting start time must be beyond the current time. Select the next available 30-minute slot or later."), { status: 400 });
        }
      }
      if (
        latestNeedsAssessmentMeeting?.endAt &&
        existingMeetingDay &&
        dt.toDateString() === existingMeetingDay.toDateString() &&
        dt.getTime() <= new Date(latestNeedsAssessmentMeeting.endAt).getTime()
      ) {
        throw Object.assign(new Error("Proposal presentation must start after the existing appointment ends."), { status: 400 });
      }
      if (
        isProposalPresentationRetry &&
        latestProposalPresentationMeetingForRetry?.endAt &&
        existingProposalPresentationMeetingDay &&
        dt.toDateString() === existingProposalPresentationMeetingDay.toDateString() &&
        dt.getTime() <= new Date(latestProposalPresentationMeetingForRetry.endAt).getTime()
      ) {
        throw Object.assign(new Error("Further proposal presentation must start after the existing proposal presentation ends."), { status: 400 });
      }
      if (isProposalPresentationRetry && latestProposalPresentationMeetingForRetry?.startAt) {
        const openProposalMeetingStart = new Date(latestProposalPresentationMeetingForRetry.startAt);
        if (!Number.isNaN(openProposalMeetingStart.getTime())) {
          const openProposalMeetingDate = new Date(openProposalMeetingStart);
          openProposalMeetingDate.setHours(0, 0, 0, 0);
          const proposedMeetingDate = new Date(dt);
          proposedMeetingDate.setHours(0, 0, 0, 0);
          if (proposedMeetingDate.getTime() < openProposalMeetingDate.getTime()) {
            throw Object.assign(new Error("Further proposal presentation meeting date must be on or after the existing open proposal presentation meeting date."), { status: 400 });
          }
        }
      }
      if (isProposalPresentationRetry && latestProposalPresentationMeetingForRetry?.endAt) {
        const openProposalMeetingEnd = new Date(latestProposalPresentationMeetingForRetry.endAt);
        if (!Number.isNaN(openProposalMeetingEnd.getTime()) && dt.toDateString() === openProposalMeetingEnd.toDateString()) {
          const endMinutes = openProposalMeetingEnd.getHours() * 60 + openProposalMeetingEnd.getMinutes();
          const earliestAllowedStartMinutes = Math.ceil(endMinutes / 30) * 30;
          const proposedStartMinutes = dt.getHours() * 60 + dt.getMinutes();
          if (proposedStartMinutes < earliestAllowedStartMinutes) {
            throw Object.assign(new Error("Further proposal presentation meeting must start at or after the next 30-minute slot after the existing open proposal presentation meeting ends."), { status: 400 });
          }
        }
      }
      if (
        latestCompletedProposalPresentationMeeting?.endAt &&
        dt.getTime() <= new Date(latestCompletedProposalPresentationMeeting.endAt).getTime()
      ) {
        throw Object.assign(new Error("Proposal presentation must start after the last completed proposal presentation meeting ends."), { status: 400 });
      }

      if (![30, 60, 90, 120].includes(durationMin)) {
        throw Object.assign(new Error("meetingDurationMin must be one of 30, 60, 90, 120."), { status: 400 });
      }

      const mode = String(meetingMode || "").trim();
      if (!["Online", "Face-to-face"].includes(mode)) {
        throw Object.assign(new Error("meetingMode must be Online or Face-to-face."), { status: 400 });
      }

      const platform = String(meetingPlatform || "").trim();
      const platformOther = String(meetingPlatformOther || "").trim();
      const link = String(meetingLink || "").trim();
      const place = String(meetingPlace || "").trim();

      if (mode === "Online") {
        if (!["Zoom", "Google Meet", "Other"].includes(platform)) {
          throw Object.assign(new Error("meetingPlatform is required for online meetings."), { status: 400 });
        }
        if (platform === "Other" && !platformOther) {
          throw Object.assign(new Error("meetingPlatformOther is required when platform is Other."), { status: 400 });
        }
        if (!link || !isValidHttpUrl(link)) {
          throw Object.assign(new Error("Valid meetingLink (http/https) is required for online meetings."), { status: 400 });
        }
        if (meetingInviteSent !== true) {
          throw Object.assign(new Error("meetingInviteSent must be true for online meetings."), { status: 400 });
        }
      }

      if (mode === "Face-to-face" && !place) {
        throw Object.assign(new Error("meetingPlace is required for face-to-face meetings."), { status: 400 });
      }

      const endAt = new Date(dt.getTime() + durationMin * 60 * 1000);

      const windows = await getAgentMeetingWindows(userObjectId, null, null, session);
      const meetingType = "Proposal Presentation";
      const shouldUpdateExistingProposalMeeting = isProposalStageReschedule || isProposalPresentationExistingReschedule;
      const existingMeeting = shouldUpdateExistingProposalMeeting
        ? await ScheduledMeeting.findOne({
            leadEngagementId: engagement._id,
            attemptCycle: currentAttemptCycle,
            meetingType,
            status: { $ne: "Cancelled" },
          })
            .sort({ startAt: -1, createdAt: -1 })
            .session(session)
        : null;
      if (isProposalStageReschedule && !existingMeeting) {
        throw Object.assign(new Error("No existing proposal presentation meeting found to reschedule."), { status: 409 });
      }
      if (
        existingMeeting?.startAt &&
        !Number.isNaN(new Date(existingMeeting.startAt).getTime()) &&
        dt.getTime() === new Date(existingMeeting.startAt).getTime()
      ) {
        throw Object.assign(new Error("Rescheduled meeting time cannot be the same as previous meeting time."), { status: 400 });
      }
      const conflictWindows = existingMeeting?._id && !isProposalPresentationRetry
        ? windows.filter((w) => String(w.id || "") !== String(existingMeeting._id))
        : windows;
      const conflict = hasMeetingConflict(dt, endAt, conflictWindows);
      if (conflict) {
        throw Object.assign(new Error("Selected meeting time conflicts with another scheduled meeting."), {
          status: 409,
          code: "MEETING_SLOT_CONFLICT",
        });
      }

      let activeProposalMeeting = null;
      if (isProposalPresentationRetry) {
        activeProposalMeeting = await ScheduledMeeting.create(
          [{
            leadEngagementId: engagement._id,
            attemptCycle: currentAttemptCycle,
            meetingType,
            startAt: dt,
            endAt,
            durationMin,
            mode,
            platform: mode === "Online" ? platform : undefined,
            platformOther: mode === "Online" && platform === "Other" ? platformOther : undefined,
            link: mode === "Online" ? link : undefined,
            inviteSent: Boolean(meetingInviteSent),
            place: mode === "Face-to-face" ? place : undefined,
            status: "Scheduled",
          }],
          { session }
        ).then((docs) => docs[0]);

        existingMeeting.status = "Completed";
        await existingMeeting.save({ session });
      } else if (existingMeeting) {
        existingMeeting.startAt = dt;
        existingMeeting.endAt = endAt;
        existingMeeting.durationMin = durationMin;
        existingMeeting.mode = mode;
        existingMeeting.platform = mode === "Online" ? platform : undefined;
        existingMeeting.platformOther = mode === "Online" && platform === "Other" ? platformOther : undefined;
        existingMeeting.link = mode === "Online" ? link : undefined;
        existingMeeting.inviteSent = Boolean(meetingInviteSent);
        existingMeeting.place = mode === "Face-to-face" ? place : undefined;
        existingMeeting.status = "Scheduled";
        await existingMeeting.save({ session });
        activeProposalMeeting = existingMeeting;
      } else {
        activeProposalMeeting = await ScheduledMeeting.create(
          [{
            leadEngagementId: engagement._id,
            attemptCycle: currentAttemptCycle,
            meetingType,
            startAt: dt,
            endAt,
            durationMin,
            mode,
            platform: mode === "Online" ? platform : undefined,
            platformOther: mode === "Online" && platform === "Other" ? platformOther : undefined,
            link: mode === "Online" ? link : undefined,
            inviteSent: Boolean(meetingInviteSent),
            place: mode === "Face-to-face" ? place : undefined,
            status: "Scheduled",
          }],
          { session }
        ).then((docs) => docs[0]);
      }

      const now = new Date();

      await ScheduledMeeting.updateMany(
        {
          leadEngagementId: engagement._id,
          attemptCycle: currentAttemptCycle,
          meetingType: "Needs Assessment",
          status: "Scheduled",
        },
        { $set: { status: "Completed" } },
        { session }
      );

      const openAppointmentTasks = await Task.find({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "APPOINTMENT",
        status: { $in: ["Open", "Overdue"] },
      }).session(session);

      for (const t of openAppointmentTasks) {
        t.status = "Done";
        t.completedAt = now;
        await t.save({ session });
      }

      const isUpdatingExistingProposalMeeting = Boolean(existingMeeting?._id) && !isProposalPresentationRetry;
      const presentationDedupeKey = isProposalPresentationRetry
        ? `PRESENTATION:${engagement._id}:${activeProposalMeeting?._id || new mongoose.Types.ObjectId()}`
        : `PRESENTATION:${engagement._id}`;
      let presentationTask = isProposalPresentationRetry
        ? null
        : await Task.findOne({
            assignedToUserId: userObjectId,
            dedupeKey: presentationDedupeKey,
            ...(isUpdatingExistingProposalMeeting ? { status: { $in: ["Open", "Overdue"] } } : {}),
          }).session(session);
      let donePresentationTaskWithSameDedupe = null;
      if (!isProposalPresentationRetry && !presentationTask) {
        donePresentationTaskWithSameDedupe = await Task.findOne({
          assignedToUserId: userObjectId,
          dedupeKey: presentationDedupeKey,
          status: "Done",
        }).session(session);
      }
      let duplicatePresentationTasksToClose = [];
      if (!isProposalPresentationRetry && (isUpdatingExistingProposalMeeting || isProposalStageReschedule)) {
        const openPresentationTasks = await Task.find({
          assignedToUserId: userObjectId,
          prospectId: prospectObjectId,
          leadEngagementId: engagement._id,
          type: "PRESENTATION",
          status: { $in: ["Open", "Overdue"] },
        })
          .sort({ createdAt: 1, dueAt: 1 })
          .session(session);

        if (!presentationTask) {
          presentationTask = openPresentationTasks[0] || null;
        }

        if (isUpdatingExistingProposalMeeting && presentationTask?._id) {
          duplicatePresentationTasksToClose = openPresentationTasks.filter((task) => String(task._id) !== String(presentationTask._id));
        }
      }

      const presentationTitle = `Present proposal to ${prospect.firstName}`;
      const presentationDescription = `Conduct proposal presentation for ${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName} (Lead ${lead.leadCode || "—"}). Meeting window: ${formatDateTimeInManila(dt)} to ${formatDateTimeInManila(endAt)} (Asia/Manila).`;
      const presentationDueAt = new Date(endAt.getTime() + 15 * 60 * 1000);

      if ((isProposalStageReschedule || isUpdatingExistingProposalMeeting) && !isProposalPresentationRetry && !presentationTask) {
        throw Object.assign(new Error("No existing present proposal task found to reschedule."), { status: 409 });
      }

      const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();

      if (isProposalPresentationRetry) {
        const openPresentationTasks = await Task.find({
          assignedToUserId: userObjectId,
          prospectId: prospectObjectId,
          leadEngagementId: engagement._id,
          type: "PRESENTATION",
          status: { $in: ["Open", "Overdue"] },
        }).session(session);

        for (const t of openPresentationTasks) {
          t.status = "Done";
          t.completedAt = now;
          await t.save({ session });
        }

        presentationTask = await Task.create(
          [{
            assignedToUserId: userObjectId,
            prospectId: prospectObjectId,
            leadEngagementId: engagement._id,
            type: "PRESENTATION",
            title: presentationTitle,
            description: presentationDescription,
            dueAt: presentationDueAt,
            status: "Open",
            dedupeKey: presentationDedupeKey,
          }],
          { session }
        ).then((docs) => docs[0]);

        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: presentationTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
        });
      } else if (isUpdatingExistingProposalMeeting) {
        if (
          donePresentationTaskWithSameDedupe?._id &&
          String(donePresentationTaskWithSameDedupe._id) !== String(presentationTask?._id || "")
        ) {
          donePresentationTaskWithSameDedupe.dedupeKey = `ARCHIVED_PRESENTATION:${engagement._id}:${donePresentationTaskWithSameDedupe._id}`;
          await donePresentationTaskWithSameDedupe.save({ session });
        }
        presentationTask.title = presentationTitle;
        presentationTask.description = presentationDescription;
        presentationTask.dueAt = presentationDueAt;
        presentationTask.status = "Open";
        presentationTask.completedAt = null;
        presentationTask.wasDelayed = false;
        presentationTask.dedupeKey = presentationDedupeKey;
        await presentationTask.save({ session });

        for (const duplicateTask of duplicatePresentationTasksToClose) {
          duplicateTask.status = "Done";
          duplicateTask.completedAt = now;
          await duplicateTask.save({ session });
        }

        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: presentationTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
          refreshTaskAdded: true,
        });
      } else if (!presentationTask) {
        presentationTask = await Task.create(
          [{
            assignedToUserId: userObjectId,
            prospectId: prospectObjectId,
            leadEngagementId: engagement._id,
            type: "PRESENTATION",
            title: presentationTitle,
            description: presentationDescription,
            dueAt: presentationDueAt,
            status: "Open",
            dedupeKey: presentationDedupeKey,
          }],
          { session }
        ).then((docs) => docs[0]);

        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: presentationTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
        });
      } else {
        presentationTask.title = presentationTitle;
        presentationTask.description = presentationDescription;
        presentationTask.dueAt = presentationDueAt;
        presentationTask.status = "Open";
        presentationTask.completedAt = null;
        presentationTask.wasDelayed = false;
        presentationTask.dedupeKey = presentationDedupeKey;
        await presentationTask.save({ session });

        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: presentationTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
          refreshTaskAdded: true,
        });
      }
      presentationTaskIdForNotif = presentationTask?._id || null;
      na.outcomeActivity = "Schedule Proposal Presentation";
      await na.save({ session });

      if (isProposalStageReschedule) {
        engagement.currentStage = "Proposal";
        engagement.currentActivityKey = (isProposalPresentationRetry || isProposalPresentationExistingReschedule) ? "Present Proposal" : "Record Prospect Attendance";
        await engagement.save({ session });

        await Proposal.updateOne(
          { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
          {
            $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
            $set: {
              outcomeActivity: (isProposalPresentationRetry || isProposalPresentationExistingReschedule) ? "Present Proposal" : "Record Prospect Attendance",
              ...(isProposalPresentationRetry || isProposalPresentationExistingReschedule
                ? {}
                : {
                    recordProspectAttendance: {
                      attendanceChoice: "",
                      attended: false,
                      attendedAt: null,
                      attendanceProofImageDataUrl: "",
                      attendanceProofFileName: "",
                    },
                  }),
            },
          },
          { upsert: true, session }
        );
      } else {
        engagement.currentStage = "Proposal";
        engagement.currentActivityKey = "Generate Proposal";
        engagement.stageCompletedAt = now;
        engagement.stageHistory = Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [];

        const openNeeds = [...engagement.stageHistory]
          .reverse()
          .find((h) => h?.stage === "Needs Assessment" && !h?.completedAt);
        if (openNeeds) {
          openNeeds.completedAt = now;
          openNeeds.reason = "Proposal presentation meeting scheduled.";
        }

        engagement.stageHistory.push({
          stage: "Proposal",
          startedAt: now,
          completedAt: null,
          reason: "Moved from Needs Assessment after proposal presentation schedule.",
        });
        engagement.stageStartedAt = now;
        await engagement.save({ session });

        await ensureProposalForCurrentAttemptCycle(engagement._id, currentAttemptCycle, {
          session,
          outcomeActivity: "Generate Proposal",
        });
      }
    });
    await ensureTaskMissedNotificationsForUser(userObjectId, { forceUnread: true, taskIds: [presentationTaskIdForNotif] });

    return res.json({ message: "Proposal presentation scheduled. Proposal stage activated." });
  } catch (err) {
    console.error("Schedule proposal presentation error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error.", code: err?.code });
  } finally {
    session.endSession();
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/needs-assessment/follow-up-decision", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId } = req.query;
    const { prospectId, leadId } = req.params;
    const { requiringFurtherNeedsAssessment } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }
    const decision = String(requiringFurtherNeedsAssessment || "").trim().toUpperCase();
    if (!["YES", "NO"].includes(decision)) {
      return res.status(400).json({ message: "requiringFurtherNeedsAssessment must be YES or NO." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);
    let followUpNeedsAssessmentDecidedAt = null;

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });
      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });
      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      if (engagement.currentStage !== "Needs Assessment") {
        throw Object.assign(new Error("Follow-up needs assessment decision can only be edited during Needs Assessment."), { status: 409 });
      }

      await ensureNeedsAssessmentAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const needsAssessment = await NeedsAssessment.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      }).session(session);
      if (!needsAssessment) throw Object.assign(new Error("Needs assessment not found."), { status: 404 });

      const needsAttemptCycle = normalizeAttemptCycle(needsAssessment.attemptCycle);
      if (needsAttemptCycle !== currentAttemptCycle) {
        throw Object.assign(new Error("Record attendance and needs analysis for the current engagement cycle first."), { status: 409 });
      }

      const decidedAt = new Date();
      const nextNeedsActivityKey = decision === "NO" ? "Schedule Proposal Presentation" : "Perform Needs Analysis";
      needsAssessment.attemptCycle = currentAttemptCycle;
      needsAssessment.followUpNeedsAssessmentRequired = decision;
      needsAssessment.followUpNeedsAssessmentDecidedAt = decidedAt;
      needsAssessment.outcomeActivity = nextNeedsActivityKey;
      await needsAssessment.save({ session });
      followUpNeedsAssessmentDecidedAt = decidedAt;

      engagement.currentActivityKey = nextNeedsActivityKey;
      await engagement.save({ session });
    });

    return res.json({
      message: "Follow-up needs assessment decision saved.",
      currentActivityKey: decision === "NO" ? "Schedule Proposal Presentation" : "Perform Needs Analysis",
      followUpNeedsAssessmentDecidedAt,
    });
  } catch (err) {
    console.error("Save needs follow-up decision error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/proposal/generate", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const {
      chosenProductId,
      proposalFileName,
      proposalFileMimeType,
      proposalFileDataUrl,
      sentToProspectEmail,
    } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    let applicationTaskIdForNotif = null;
    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      if (!["Proposal", "Application"].includes(String(engagement.currentStage || "").trim())) {
        throw Object.assign(new Error("Lead is not in Proposal/Application stage."), { status: 409 });
      }

      await ensureProposalAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const proposalDoc = await Proposal.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      })
        .select("outcomeActivity")
        .session(session)
        .lean();

      const proposalActivityOrder = [
        "Generate Proposal",
        "Record Prospect Attendance",
        "Present Proposal",
        "Schedule Application Submission",
      ];
      const activityKey = String(engagement.currentActivityKey || proposalDoc?.outcomeActivity || "Generate Proposal").trim() || "Generate Proposal";
      const activityIndex = proposalActivityOrder.indexOf(activityKey);
      if (activityIndex < 0) {
        throw Object.assign(new Error("Current proposal activity is invalid."), { status: 409 });
      }

      const name = String(proposalFileName || "").trim();
      const mime = String(proposalFileMimeType || "").trim().toLowerCase();
      const dataUrl = String(proposalFileDataUrl || "").trim();
      if (!name) throw Object.assign(new Error("proposalFileName is required."), { status: 400 });
      if (!dataUrl) throw Object.assign(new Error("proposalFileDataUrl is required."), { status: 400 });
      const looksPdfName = /\.pdf$/i.test(name);
      const looksPdfMime = mime === "application/pdf";
      const looksPdfDataUrl = /^data:application\/pdf;base64,/i.test(dataUrl);
      if (!looksPdfName || (!looksPdfMime && !looksPdfDataUrl)) {
        throw Object.assign(new Error("Proposal file must be a PDF."), { status: 400 });
      }

      if (sentToProspectEmail !== true) {
        throw Object.assign(new Error("Please confirm proposal was sent to prospect email."), { status: 400 });
      }

      await ensureNeedsAssessmentAttemptCycleIndex();
      const needsAssessment = await NeedsAssessment.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      })
        .select("needsPriorities.productSelection.selectedProductId")
        .session(session)
        .lean();
      const selectedProductId = chosenProductId || needsAssessment?.needsPriorities?.productSelection?.selectedProductId || null;
      const selectedProduct = selectedProductId && mongoose.isValidObjectId(selectedProductId)
        ? await Product.findById(selectedProductId).select("_id productName description paymentTermOptions paymentTermLabel coverageDurationRule coverageDurationLabel ageRequirement minimumSumAssured minimumAnnualPremium").session(session)
        : null;

      const nextActivity = proposalActivityOrder[Math.max(activityIndex, 1)] || "Record Prospect Attendance";
      engagement.currentActivityKey = nextActivity;
      await engagement.save({ session });

      await Proposal.updateOne(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
          $set: {
            outcomeActivity: nextActivity,
            chosenProductId: selectedProduct?._id || (mongoose.isValidObjectId(selectedProductId) ? new mongoose.Types.ObjectId(selectedProductId) : null),
            generateProposal: {
              proposalFileName: name,
              proposalFileMimeType: "application/pdf",
              proposalFileDataUrl: dataUrl,
              sentToProspectEmail: true,
              sentToProspectAt: new Date(),
              uploadedAt: new Date(),
            },
          },
        },
        { upsert: true, session }
      );
    });

    return res.json({
      message: "Proposal generated and sent details saved.",
      currentActivityKey: "Record Prospect Attendance",
    });
  } catch (err) {
    console.error("Generate proposal error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});



app.post("/api/prospects/:prospectId/leads/:leadId/proposal/attendance", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const { attended, attendanceProofImageDataUrl, attendanceProofFileName } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const normalizedAttended = attended === true;
    const proofDataUrl = String(attendanceProofImageDataUrl || "").trim();
    const proofFileName = String(attendanceProofFileName || "").trim();
    if (normalizedAttended) {
      if (!proofDataUrl) {
        return res.status(400).json({ message: "Proof of attendance image is required and must be JPG, JPEG, or PNG." });
      }

      const isImageDataUrl = /^data:image\/(?:jpeg|png);base64,/i.test(proofDataUrl);
      if (!isImageDataUrl) {
        return res.status(400).json({ message: "Proof of attendance file type must be JPG, JPEG, or PNG." });
      }
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);
    let responseCurrentActivityKey = normalizedAttended ? "Present Proposal" : "Record Prospect Attendance";

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      if (engagement.currentStage !== "Proposal") {
        throw Object.assign(new Error("Lead is not in Proposal stage."), { status: 409 });
      }

      await ensureProposalAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const existingProposalDoc = await Proposal.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      }).session(session);
      const currentProposalActivity = String(engagement.currentActivityKey || "").trim();
      const isAttendanceStep = currentProposalActivity === "Record Prospect Attendance";
      const isFutureProofEdit =
        normalizedAttended &&
        ["Present Proposal", "Schedule Application Submission"].includes(currentProposalActivity) &&
        (existingProposalDoc?.recordProspectAttendance?.attendanceChoice === "YES" || existingProposalDoc?.recordProspectAttendance?.attended === true);

      if (!isAttendanceStep && !isFutureProofEdit) {
        throw Object.assign(new Error("Record Prospect Attendance is not the current activity."), { status: 409 });
      }
      if (!normalizedAttended && !isAttendanceStep) {
        throw Object.assign(new Error("Only proof of attendance can be edited from future proposal subactivities."), { status: 409 });
      }

      const nextActivityKey = isFutureProofEdit
        ? currentProposalActivity
        : normalizedAttended
        ? "Present Proposal"
        : "Record Prospect Attendance";
      responseCurrentActivityKey = nextActivityKey;
      engagement.currentActivityKey = nextActivityKey;
      await engagement.save({ session });

      const nextOutcomeActivity = isFutureProofEdit
        ? String(existingProposalDoc?.outcomeActivity || currentProposalActivity || "Present Proposal").trim()
        : normalizedAttended
        ? "Present Proposal"
        : "Record Prospect Attendance";

      await Proposal.updateOne(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
          $set: {
            outcomeActivity: nextOutcomeActivity,
            recordProspectAttendance: {
              attendanceChoice: normalizedAttended ? "YES" : "NO",
              attended: normalizedAttended,
              attendedAt: normalizedAttended ? (existingProposalDoc?.recordProspectAttendance?.attendedAt || new Date()) : null,
              attendanceProofImageDataUrl: normalizedAttended ? proofDataUrl : "",
              attendanceProofFileName: normalizedAttended ? proofFileName : "",
            },
          },
        },
        { upsert: true, session }
      );
    });

    return res.json({
      message: "Prospect attendance recorded.",
      currentActivityKey: responseCurrentActivityKey,
    });
  } catch (err) {
    console.error("Record proposal attendance error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});


app.post("/api/prospects/:prospectId/leads/:leadId/application/attendance", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const { attended, attendanceProofImageDataUrl, attendanceProofFileName } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    if (attended !== true) {
      return res.status(400).json({ message: "Prospect attendance must be marked attended." });
    }

    const proofDataUrl = String(attendanceProofImageDataUrl || "").trim();
    const proofFileName = String(attendanceProofFileName || "").trim();
    if (!proofDataUrl) {
      return res.status(400).json({ message: "Proof of attendance image is required and must be JPG, JPEG, or PNG." });
    }
    if (!/^data:image\/(?:jpeg|png);base64,/i.test(proofDataUrl)) {
      return res.status(400).json({ message: "Proof of attendance file type must be JPG, JPEG, or PNG." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    let responseCurrentActivityKey = "Record Premium Payment Transfer";

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      if (engagement.currentStage !== "Application") {
        throw Object.assign(new Error("Lead is not in Application stage."), { status: 409 });
      }

      await ensureApplicationAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const existingApplicationDoc = await Application.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      }).session(session);
      const currentApplicationActivity = String(engagement.currentActivityKey || "").trim();
      const isAttendanceStep = currentApplicationActivity === "Record Prospect Attendance";
      const isFutureProofEdit =
        ["Record Premium Payment Transfer", "Record Application Submission"].includes(currentApplicationActivity) &&
        existingApplicationDoc?.recordProspectAttendance?.attended === true;

      if (!isAttendanceStep && !isFutureProofEdit) {
        throw Object.assign(new Error("Record Prospect Attendance is not the current activity."), { status: 409 });
      }

      const nextActivityKey = isFutureProofEdit ? currentApplicationActivity : "Record Premium Payment Transfer";
      responseCurrentActivityKey = nextActivityKey;
      engagement.currentActivityKey = nextActivityKey;
      await engagement.save({ session });

      const nextOutcomeActivity = isFutureProofEdit
        ? String(existingApplicationDoc?.outcomeActivity || currentApplicationActivity || "Record Premium Payment Transfer").trim()
        : "Record Premium Payment Transfer";

      await Application.updateOne(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
          $set: {
            outcomeActivity: nextOutcomeActivity,
            recordProspectAttendance: {
              attended: true,
              attendedAt: existingApplicationDoc?.recordProspectAttendance?.attendedAt || new Date(),
              attendanceProofImageDataUrl: proofDataUrl,
              attendanceProofFileName: proofFileName,
            },
          },
        },
        { upsert: true, session }
      );
    });

    return res.json({
      message: "Application prospect attendance saved.",
      currentActivityKey: responseCurrentActivityKey,
    });
  } catch (err) {
    console.error("Application attendance save error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/application/premium-payment-transfer", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const {
      frequencyOfPremiumPayment,
      totalAnnualPremiumPhp,
      totalFrequencyPremiumPhp,
      paymentDate,
      methodForInitialPayment,
      methodForRenewalPayment,
      paymentProofImageDataUrl,
      paymentProofFileName,
    } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const toNonNegativeNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const hasAtMostTwoDecimals = (n) => Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-8;

    const paymentFrequency = String(frequencyOfPremiumPayment || "").trim();
    const annualPremiumRaw = String(totalAnnualPremiumPhp ?? "").trim();
    const frequencyPremiumRaw = String(totalFrequencyPremiumPhp ?? "").trim();
    const paymentDateRaw = String(paymentDate || "").trim();
    const annualPremium = toNonNegativeNumber(annualPremiumRaw);
    let frequencyPremium = toNonNegativeNumber(frequencyPremiumRaw);
    const initialPaymentMethod = String(methodForInitialPayment || "").trim();
    const renewalMethod = String(methodForRenewalPayment || "").trim();
    const proofDataUrl = String(paymentProofImageDataUrl || "").trim();
    const proofFileName = String(paymentProofFileName || "").trim();

    const allowedFrequencies = ["Monthly", "Quarterly", "Half-yearly", "Yearly"];
    if (!allowedFrequencies.includes(paymentFrequency)) {
      return res.status(400).json({ message: "Frequency of premium payment is required." });
    }
    if (!annualPremiumRaw || annualPremium === null) return res.status(400).json({ message: "Total annual premium is required." });
    if (!paymentDateRaw) return res.status(400).json({ message: "Payment date is required." });
    if (paymentFrequency === "Yearly") {
      frequencyPremium = annualPremium;
    } else if (!frequencyPremiumRaw || frequencyPremium === null) {
      return res.status(400).json({ message: "Total frequency premium is required." });
    }
    if (!hasAtMostTwoDecimals(annualPremium)) return res.status(400).json({ message: "Total annual premium must have at most 2 decimal places." });
    if (!hasAtMostTwoDecimals(frequencyPremium)) return res.status(400).json({ message: "Total frequency premium must have at most 2 decimal places." });

    const paymentDateValue = new Date(`${paymentDateRaw}T00:00:00`);
    if (Number.isNaN(paymentDateValue.getTime())) {
      return res.status(400).json({ message: "Payment date is invalid." });
    }
    const allowedPaymentMethods = ["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"];
    if (!allowedPaymentMethods.includes(initialPaymentMethod)) {
      return res.status(400).json({ message: "Method for initial payment is required." });
    }
    if (!allowedPaymentMethods.includes(renewalMethod)) {
      return res.status(400).json({ message: "Method for renewal payment is required." });
    }

    if (!proofDataUrl) {
      return res.status(400).json({ message: "Proof of payment image is required and must be JPG, JPEG, or PNG." });
    }
    if (!/^data:image\/(?:jpeg|png);base64,/i.test(proofDataUrl)) {
      return res.status(400).json({ message: "Proof of payment file type must be JPG, JPEG, or PNG." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      if (engagement.currentStage !== "Application") {
        throw Object.assign(new Error("Lead is not in Application stage."), { status: 409 });
      }

      const latestApplicationSubmissionMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType: "Application Submission",
      })
        .sort({ startAt: -1, createdAt: -1 })
        .select("startAt")
        .session(session)
        .lean();

      if (latestApplicationSubmissionMeeting?.startAt) {
        const minPaymentDate = new Date(latestApplicationSubmissionMeeting.startAt);
        minPaymentDate.setHours(0, 0, 0, 0);
        if (paymentDateValue < minPaymentDate) {
          throw Object.assign(new Error("Payment date cannot be earlier than the latest scheduled Application Submission meeting date."), { status: 400 });
        }
      }

      engagement.currentActivityKey = "Record Application Submission";
      await engagement.save({ session });

      const savedAt = new Date();
      const proofMimeType = /^data:(image\/(?:jpeg|png));base64,/i.exec(proofDataUrl)?.[1]?.toLowerCase() || "";
      const paymentPeriod = derivePaymentPeriod(paymentDateValue, paymentFrequency);
      const annualPaymentPeriod = deriveAnnualPaymentPeriod(paymentDateValue);
      const annualPaymentMetrics = buildAnnualPaymentMetrics({
        totalAnnualPremiumPhp: annualPremium,
        amountPaidSoFarPhp: frequencyPremium,
        paidCount: 1,
        frequencyOfPayment: paymentFrequency,
      });
      const currentAttemptCycle = Number(engagement.contactAttemptCycle || 1);
      await ensureAnnualPaymentLeadEngagementIndex();
      const annualPaymentDoc = await AnnualPayment.findOneAndUpdate(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            attemptCycle: currentAttemptCycle,
            annualPaymentPeriod,
            totalAnnualPremiumPhp: annualPremium,
            frequencyOfPayment: paymentFrequency,
            ...annualPaymentMetrics,
          },
        },
        { upsert: true, new: true, session }
      );
      const existingPaymentDoc = await Payment.findOne({ leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) })
        .select("status")
        .session(session)
        .lean();
      const nextPaymentStatus = String(existingPaymentDoc?.status || "") === "Processed" ? "Processed" : "Pending";
      const paymentDoc = await Payment.findOneAndUpdate(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            attemptCycle: currentAttemptCycle,
            status: nextPaymentStatus,
            annualPaymentId: annualPaymentDoc._id,
            recordPremiumPaymentTransfer: {
              totalPremiumPaidPhp: frequencyPremium,
              frequencyOfPremiumPayment: paymentFrequency,
              paymentDate: paymentDateValue,
              paymentPeriod,
              methodForPayment: initialPaymentMethod,
              proofOfPaymentFileName: proofFileName,
              proofOfPaymentFileMimeType: proofMimeType,
              proofOfPaymentFileDataUrl: proofDataUrl,
              savedAt,
            },
          },
        },
        { upsert: true, new: true, session }
      );

      await ensureApplicationAttemptCycleIndex();
      await Application.updateOne(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
          $set: {
            outcomeActivity: "Record Application Submission",
            recordPremiumPaymentTransfer: {
              paymentId: paymentDoc._id,
              methodForRenewalPayment: renewalMethod,
            },
          },
        },
        { upsert: true, session }
      );
    });

    return res.json({
      message: "Premium payment transfer saved.",
      currentActivityKey: "Record Application Submission",
    });
  } catch (err) {
    console.error("Application premium payment transfer save error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});


app.get("/api/prospects/:prospectId/leads/:leadId/application/submission/validate", async (req, res) => {
  try {
    const { userId, pruOneTransactionId } = req.query;
    const { prospectId, leadId } = req.params;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const txId = String(pruOneTransactionId || "").trim();
    if (!txId) return res.status(400).json({ message: "PRUOnePH Transaction ID is required." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).select("_id").lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).select("_id").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage").lean();
    if (!engagement) return res.status(404).json({ message: "Lead engagement not found." });
    if (engagement.currentStage !== "Application") {
      return res.status(409).json({ message: "Lead is not in Application stage." });
    }

    const existingTxApplication = await Application.findOne({
      "recordApplicationSubmission.pruOneTransactionId": txId,
      leadEngagementId: { $ne: engagement._id },
    })
      .select("_id")
      .lean();

    if (existingTxApplication) {
      return res.status(409).json({ message: "Record already exists for this Transaction ID." });
    }

    return res.json({ valid: true });
  } catch (err) {
    console.error("Validate application submission error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/application/submission", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const {
      pruOneTransactionId,
      submissionScreenshotImageDataUrl,
      submissionScreenshotFileName,
    } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const txId = String(pruOneTransactionId || "").trim();
    const screenshotDataUrl = String(submissionScreenshotImageDataUrl || "").trim();
    const screenshotFileName = String(submissionScreenshotFileName || "").trim();

    if (!txId) return res.status(400).json({ message: "PRUOnePH Transaction ID is required." });
    if (!screenshotDataUrl) return res.status(400).json({ message: "Submission screenshot is required and must be JPG, JPEG, or PNG." });
    if (!/^data:image\/(?:jpeg|png);base64,/i.test(screenshotDataUrl)) {
      return res.status(400).json({ message: "Submission screenshot file type must be JPG, JPEG, or PNG." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    const addWorkingDays = (fromDate, daysToAdd) => {
      const d = new Date(fromDate);
      let added = 0;
      while (added < daysToAdd) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) added += 1;
      }
      return d;
    };

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      if (engagement.currentStage !== "Application") {
        throw Object.assign(new Error("Lead is not in Application stage."), { status: 409 });
      }

      const now = new Date();

      const existingTxApplication = await Application.findOne({
        "recordApplicationSubmission.pruOneTransactionId": txId,
        leadEngagementId: { $ne: engagement._id },
      })
        .select("_id")
        .session(session);
      if (existingTxApplication) {
        throw Object.assign(new Error("Record already exists for this Transaction ID."), { status: 409 });
      }

      await ensureApplicationAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const existingApplication = await Application.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      })
        .select("chosenProductId")
        .session(session);

      await ensureNeedsAssessmentAttemptCycleIndex();
      await ensureProposalAttemptCycleIndex();
      const proposal = await Proposal.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      })
        .select("chosenProductId")
        .session(session);
      const needsAssessment = await NeedsAssessment.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      })
        .select("needsPriorities.productSelection.selectedProductId")
        .session(session);

      const chosenProductIdRaw = existingApplication?.chosenProductId
        || proposal?.chosenProductId
        || needsAssessment?.needsPriorities?.productSelection?.selectedProductId
        || null;
      const chosenProductId = chosenProductIdRaw && mongoose.isValidObjectId(chosenProductIdRaw)
        ? new mongoose.Types.ObjectId(chosenProductIdRaw)
        : null;

      await Application.updateOne(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
          $set: {
            outcomeActivity: "Record Application Submission",
            ...(chosenProductId ? { chosenProductId } : {}),
            recordApplicationSubmission: {
              pruOneTransactionId: txId,
              submissionScreenshotImageDataUrl: screenshotDataUrl,
              submissionScreenshotFileName: screenshotFileName,
              savedAt: new Date(),
            },
          },
        },
        { upsert: true, session }
      );

      const applicationMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType: "Application Submission",
      }).session(session);
      if (applicationMeeting && applicationMeeting.status !== "Completed") {
        applicationMeeting.status = "Completed";
        await applicationMeeting.save({ session });
      }

      const applicationTaskDedupeKeys = [
        `APPLICATION_SUBMISSION:${engagement._id}`,
        `APPLICATION_SUBMISSION:${engagement._id}:${currentAttemptCycle}`,
      ];

      const openApplicationTasks = await Task.find({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "APPOINTMENT",
        status: { $in: ["Open", "Overdue"] },
        dedupeKey: { $in: applicationTaskDedupeKeys },
      }).session(session);

      for (const t of openApplicationTasks) {
        t.status = "Done";
        t.completedAt = now;
        await t.save({ session });
      }

      const followUpDueAt = addWorkingDays(now, 3);
      followUpDueAt.setHours(18, 0, 0, 0);
      const followUpDedupeKey = `POLICY_APPLICATION_STATUS_FOLLOW_UP:${engagement._id}`;
      let followUpTask = await Task.findOne({
        assignedToUserId: userObjectId,
        dedupeKey: followUpDedupeKey,
      }).session(session);

      const fullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
      const followUpTitle = `Check policy application status for ${prospect.firstName}`;
      const followUpDescription = `Follow up the policy application status for ${fullName} (Lead ${lead.leadCode || "—"}).`;

      if (!followUpTask) {
        followUpTask = await Task.create(
          [{
            assignedToUserId: userObjectId,
            prospectId: prospectObjectId,
            leadEngagementId: engagement._id,
            type: "FOLLOW_UP",
            title: followUpTitle,
            description: followUpDescription,
            dueAt: followUpDueAt,
            status: "Open",
            dedupeKey: followUpDedupeKey,
          }],
          { session }
        ).then((docs) => docs[0]);

        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: followUpTask,
          prospectFullName: fullName,
          leadCode: lead.leadCode,
          session,
        });
      } else if (followUpTask.status !== "Done") {
        followUpTask.title = followUpTitle;
        followUpTask.description = followUpDescription;
        followUpTask.dueAt = followUpDueAt;
        await followUpTask.save({ session });
      }

      await ensurePolicyForCurrentAttemptCycle(engagement._id, currentAttemptCycle, { session, chosenProductId });

      engagement.currentStage = "Policy Issuance";
      engagement.currentActivityKey = "Upload Initial Premium eOR";
      engagement.stageCompletedAt = now;
      engagement.stageHistory = Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [];

      const openApplicationStage = [...engagement.stageHistory]
        .reverse()
        .find((h) => h?.stage === "Application" && !h?.completedAt);
      if (openApplicationStage) {
        openApplicationStage.completedAt = now;
        openApplicationStage.reason = "Application submission details recorded and moved to Policy Issuance.";
      }

      engagement.stageHistory.push({
        stage: "Policy Issuance",
        startedAt: now,
        completedAt: null,
        reason: "Moved from Application after recording application submission details.",
      });

      await engagement.save({ session });
    });

    return res.json({
      message: "Application submission saved.",
      currentActivityKey: "Upload Initial Premium eOR",
      currentStage: "Policy Issuance",
    });
  } catch (err) {
    console.error("Application submission save error:", err);
    if (err?.code === 11000 && String(err?.message || "").includes("recordApplicationSubmission.pruOneTransactionId")) {
      return res.status(409).json({ message: "Record already exists for this Transaction ID." });
    }
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/policy-issuance/status", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const {
      status,
      issuanceDate,
      declinedDate,
      declinationLetterFileDataUrl,
      declinationLetterFileName,
      declinationLetterFileMimeType,
      declineReason,
      initialPremiumRefundProofImageDataUrl,
      initialPremiumRefundProofFileName,
      initialPremiumRefundProofFileMimeType,
      notes,
    } = req.body || {};
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const normalizedStatus = String(status || "").trim();
    const fieldErrors = {};
    if (!["Issued", "Declined"].includes(normalizedStatus)) {
      fieldErrors.status = "Please select policy application status.";
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).select("_id").lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).select("_id status");
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (String(lead.status || "").trim() === "Policy Declined") {
      return res.status(409).json({ message: "Policy declined leads cannot be edited." });
    }

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage contactAttemptCycle");
    if (!engagement) return res.status(404).json({ message: "Lead engagement not found." });
    if (engagement.currentStage !== "Policy Issuance") {
      return res.status(409).json({ message: "Lead is not in Policy Issuance stage." });
    }

    await ensurePolicyAttemptCycleIndex();
    const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
    const existingPolicyDoc = await Policy.findOne({
      leadEngagementId: engagement._id,
      ...attemptCycleFilterForCycle(currentAttemptCycle),
    })
      .select("chosenProductId uploadInitialPremiumEor.paymentId")
      .lean();

    const policyInitialEorPayment = existingPolicyDoc?.uploadInitialPremiumEor?.paymentId
      ? await Payment.findOne({ _id: existingPolicyDoc.uploadInitialPremiumEor.paymentId, leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) })
          .select("annualPaymentId uploadPremiumPaymentEor.receiptDate")
          .lean()
      : null;
    const policyInitialEorReceiptDateStart = policyInitialEorPayment?.uploadPremiumPaymentEor?.receiptDate
      ? new Date(new Date(policyInitialEorPayment.uploadPremiumPaymentEor.receiptDate).setHours(0, 0, 0, 0))
      : null;

    await ensureApplicationAttemptCycleIndex();
    const applicationDoc = await Application.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: currentAttemptCycle,
    })
      .select("chosenProductId recordApplicationSubmission.savedAt")
      .lean();

    await ensureNeedsAssessmentAttemptCycleIndex();
    await ensureProposalAttemptCycleIndex();
    const proposalDoc = await Proposal.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: currentAttemptCycle,
    })
      .select("chosenProductId")
      .lean();
    const needsAssessmentDoc = await NeedsAssessment.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: currentAttemptCycle,
    })
      .select("needsPriorities.productSelection.selectedProductId")
      .lean();

    const fallbackChosenProductIdRaw = existingPolicyDoc?.chosenProductId
      || applicationDoc?.chosenProductId
      || proposalDoc?.chosenProductId
      || needsAssessmentDoc?.needsPriorities?.productSelection?.selectedProductId
      || null;
    const fallbackChosenProductId = fallbackChosenProductIdRaw && mongoose.isValidObjectId(fallbackChosenProductIdRaw)
      ? new mongoose.Types.ObjectId(fallbackChosenProductIdRaw)
      : null;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let issuanceDateValue = null;
    let declinedDateValue = null;
    const declineReasonText = String(declineReason || "").trim();
    const declinationLetterFileDataUrlText = String(declinationLetterFileDataUrl || "").trim();
    const declinationLetterFileNameText = String(declinationLetterFileName || "").trim();
    const declinationLetterFileMimeTypeText = String(declinationLetterFileMimeType || "").trim();
    const initialPremiumRefundProofImageDataUrlText = String(initialPremiumRefundProofImageDataUrl || "").trim();
    const initialPremiumRefundProofFileNameText = String(initialPremiumRefundProofFileName || "").trim();
    const initialPremiumRefundProofFileMimeTypeText = String(initialPremiumRefundProofFileMimeType || "").trim();

    if (normalizedStatus === "Issued") {
      const issuanceDateRaw = String(issuanceDate || "").trim();
      if (!issuanceDateRaw) {
        fieldErrors.issuanceDate = "Issuance date is required when status is Issued.";
      } else {
        issuanceDateValue = new Date(`${issuanceDateRaw}T00:00:00`);
        if (Number.isNaN(issuanceDateValue.getTime())) {
          fieldErrors.issuanceDate = "Issuance date is invalid.";
        } else if (policyInitialEorReceiptDateStart && issuanceDateValue < policyInitialEorReceiptDateStart) {
          fieldErrors.issuanceDate = "Issuance date cannot be earlier than Initial Premium eOR receipt date.";
        }
      }
    }

    if (normalizedStatus === "Declined") {
      const declinedDateRaw = String(declinedDate || "").trim();
      if (!declinedDateRaw) {
        fieldErrors.declinedDate = "Date declined is required when status is Declined.";
      } else {
        declinedDateValue = new Date(`${declinedDateRaw}T00:00:00`);
        if (Number.isNaN(declinedDateValue.getTime())) {
          fieldErrors.declinedDate = "Date declined is invalid.";
        } else if (policyInitialEorReceiptDateStart && declinedDateValue < policyInitialEorReceiptDateStart) {
          fieldErrors.declinedDate = "Date declined cannot be earlier than Initial Premium eOR receipt date.";
        }
      }
      if (!declinationLetterFileDataUrlText) {
        fieldErrors.declinationLetterFileDataUrl = "Declination letter PDF is required when status is Declined.";
      } else if (!/^data:application\/pdf;base64,/i.test(declinationLetterFileDataUrlText)) {
        fieldErrors.declinationLetterFileDataUrl = "Declination letter must be a PDF.";
      }
      if (!declineReasonText) {
        fieldErrors.declineReason = "Reason for decline is required when status is Declined.";
      }
      if (!initialPremiumRefundProofImageDataUrlText) {
        fieldErrors.initialPremiumRefundProofImageDataUrl = "Proof of initial premium refund is required when status is Declined.";
      } else if (!/^data:image\/(?:jpeg|png);base64,/i.test(initialPremiumRefundProofImageDataUrlText)) {
        fieldErrors.initialPremiumRefundProofImageDataUrl = "Proof of initial premium refund must be a JPG, JPEG, or PNG image.";
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: "Please correct the highlighted policy application status field(s).", fieldErrors });
    }

    const hasInitialPremiumEor = Boolean(existingPolicyDoc?.uploadInitialPremiumEor?.paymentId);
    const nextActivityKey = normalizedStatus === "Issued"
      ? (hasInitialPremiumEor ? "Upload Policy Summary" : "Upload Initial Premium eOR")
      : "Record Policy Application Status";
    const engagementActivityUpdate = normalizedStatus === "Declined"
      ? { $unset: { currentActivityKey: "" } }
      : { $set: { currentActivityKey: nextActivityKey } };

    if (normalizedStatus === "Declined") {
      lead.status = "Policy Declined";
      await lead.save();
      await Task.updateMany(
        {
          assignedToUserId: userObjectId,
          prospectId: prospectObjectId,
          leadEngagementId: engagement._id,
          type: "FOLLOW_UP",
          status: "Open",
          dedupeKey: `POLICY_APPLICATION_STATUS_FOLLOW_UP:${engagement._id}`,
        },
        { $set: { status: "Done", completedAt: new Date() } }
      );

      const initialPremiumPaymentId = existingPolicyDoc?.uploadInitialPremiumEor?.paymentId || null;
      if (initialPremiumPaymentId) {
        await Payment.updateOne(
          { _id: initialPremiumPaymentId, leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
          { $set: { status: "Refunded" } }
        );
      }

      const annualPaymentId = policyInitialEorPayment?.annualPaymentId || null;
      const annualPaymentFilter = annualPaymentId
        ? { _id: annualPaymentId, leadEngagementId: engagement._id }
        : { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) };
      await AnnualPayment.updateOne(
        annualPaymentFilter,
        { $set: { status: "No Longer Pursued" } }
      );
    }

    await Policy.updateOne(
      { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
      {
        $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
        $set: {
          outcomeActivity: nextActivityKey,
          ...(fallbackChosenProductId ? { chosenProductId: fallbackChosenProductId } : {}),
          recordPolicyApplicationStatus: {
            status: normalizedStatus,
            issuanceDate: normalizedStatus === "Issued" ? issuanceDateValue : null,
            declinedDate: normalizedStatus === "Declined" ? declinedDateValue : null,
            declinationLetterFileDataUrl: normalizedStatus === "Declined" ? declinationLetterFileDataUrlText : "",
            declinationLetterFileName: normalizedStatus === "Declined" ? declinationLetterFileNameText : "",
            declinationLetterFileMimeType: normalizedStatus === "Declined" ? (declinationLetterFileMimeTypeText || "application/pdf") : "",
            declineReason: normalizedStatus === "Declined" ? declineReasonText : "",
            initialPremiumRefundProofImageDataUrl: normalizedStatus === "Declined" ? initialPremiumRefundProofImageDataUrlText : "",
            initialPremiumRefundProofFileName: normalizedStatus === "Declined" ? initialPremiumRefundProofFileNameText : "",
            initialPremiumRefundProofFileMimeType: normalizedStatus === "Declined" ? (initialPremiumRefundProofFileMimeTypeText || "image/jpeg") : "",
            notes: String(notes || "").trim(),
            savedAt: new Date(),
          },
        },
      },
      { upsert: true }
    );

    await LeadEngagement.updateOne(
      { _id: engagement._id },
      engagementActivityUpdate
    );

    return res.json({
      message: "Policy application status saved.",
      currentActivityKey: normalizedStatus === "Declined" ? "" : nextActivityKey,
      leadStatus: normalizedStatus === "Declined" ? "Policy Declined" : lead.status,
    });
  } catch (err) {
    console.error("Policy issuance status save error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});


app.post("/api/prospects/:prospectId/leads/:leadId/policy-issuance/initial-premium-eor", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const { eorNumber, receiptDate, eorFileDataUrl, eorFileName } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const eorNo = String(eorNumber || "").trim();
    const receiptDateRaw = String(receiptDate || "").trim();
    const pdfDataUrl = String(eorFileDataUrl || "").trim();
    const fileName = String(eorFileName || "").trim();

    const fieldErrors = {};
    if (!eorNo) fieldErrors.eorNumber = "eOR number is required.";
    if (!receiptDateRaw) fieldErrors.receiptDate = "Receipt date is required.";
    if (!pdfDataUrl) {
      fieldErrors.eorFileDataUrl = "eOR PDF file is required.";
    } else if (!/^data:application\/pdf;base64,/i.test(pdfDataUrl)) {
      fieldErrors.eorFileDataUrl = "eOR file must be a PDF.";
    }

    const receiptDateValue = receiptDateRaw ? new Date(`${receiptDateRaw}T00:00:00`) : null;
    if (receiptDateRaw && (!receiptDateValue || Number.isNaN(receiptDateValue.getTime()))) {
      fieldErrors.receiptDate = "Receipt date is invalid.";
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).select("_id").lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).select("_id").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage contactAttemptCycle");
    if (!engagement) return res.status(404).json({ message: "Lead engagement not found." });
    if (engagement.currentStage !== "Policy Issuance") {
      return res.status(409).json({ message: "Lead is not in Policy Issuance stage." });
    }

    await ensureApplicationAttemptCycleIndex();
    const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
    const applicationDoc = await Application.findOne({
      leadEngagementId: engagement._id,
      attemptCycle: currentAttemptCycle,
    })
      .select("recordApplicationSubmission.savedAt recordPremiumPaymentTransfer.paymentId")
      .lean();
    await ensurePolicyAttemptCycleIndex();
    const policyDoc = await Policy.findOne({
      leadEngagementId: engagement._id,
      ...attemptCycleFilterForCycle(currentAttemptCycle),
    })
      .select("recordPolicyApplicationStatus.status recordPolicyApplicationStatus.issuanceDate uploadInitialPremiumEor.paymentId")
      .lean();
    const isEditingInitialPremiumEor = Boolean(policyDoc?.uploadInitialPremiumEor?.paymentId);

    const uploadedAt = new Date();

    const applicationPaymentId = applicationDoc?.recordPremiumPaymentTransfer?.paymentId || null;
    if (!applicationPaymentId) {
      return res.status(409).json({ message: "Record Premium Payment Transfer must be completed before uploading Initial Premium eOR." });
    }

    const paymentDoc = await Payment.findOne({ _id: applicationPaymentId, leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) });
    if (!paymentDoc || !paymentHasCompletedPremiumTransfer(paymentDoc)) {
      return res.status(409).json({ message: "Record Premium Payment Transfer must be completed before uploading Initial Premium eOR." });
    }

    if (eorNo) {
      const duplicateEor = await Payment.findOne({
        _id: { $ne: paymentDoc._id },
        "uploadPremiumPaymentEor.eorNumber": eorNo,
      }).select("_id").lean();
      if (duplicateEor) fieldErrors.eorNumber = "Record already exists for this eOR number.";
    }

    const paymentDate = paymentDoc?.recordPremiumPaymentTransfer?.paymentDate
      ? new Date(paymentDoc.recordPremiumPaymentTransfer.paymentDate)
      : null;
    if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
      return res.status(409).json({ message: "Payment date is required before uploading Initial Premium eOR." });
    }

    const minDate = new Date(paymentDate);
    minDate.setHours(0, 0, 0, 0);
    if (receiptDateValue && !Number.isNaN(receiptDateValue.getTime()) && receiptDateValue < minDate) {
      fieldErrors.receiptDate = "Receipt date cannot be earlier than payment date.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(fieldErrors.eorNumber?.includes("already exists") ? 409 : 400).json({
        message: "Please correct the highlighted Initial Premium eOR field(s).",
        fieldErrors,
      });
    }

    paymentDoc.status = "Processed";
    paymentDoc.uploadPremiumPaymentEor = {
      eorNumber: eorNo,
      receiptDate: receiptDateValue,
      eorFileDataUrl: pdfDataUrl,
      eorFileName: fileName,
      eorFileMimeType: "application/pdf",
      uploadedAt,
    };
    await paymentDoc.save();

    await Policy.updateOne(
      { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
      {
        $setOnInsert: { leadEngagementId: engagement._id },
        $set: {
          attemptCycle: currentAttemptCycle,
          outcomeActivity: "Record Policy Application Status",
          uploadInitialPremiumEor: {
            paymentId: paymentDoc._id,
          },
        },
        ...(isEditingInitialPremiumEor
          ? {
              $unset: {
                recordPolicyApplicationStatus: "",
                uploadPolicySummary: "",
                recordCoverageDurationDetails: "",
              },
            }
          : {}),
      },
      { upsert: true }
    );

    await LeadEngagement.updateOne(
      { _id: engagement._id },
      { $set: { currentActivityKey: "Record Policy Application Status" } }
    );

    return res.json({ message: "Initial premium eOR uploaded.", currentActivityKey: "Record Policy Application Status" });
  } catch (err) {
    console.error("Policy issuance initial premium eOR save error:", err);
    if (err?.code === 11000 && /(?:uploadInitialPremiumEor|uploadPremiumPaymentEor)\.eorNumber/.test(String(err?.message || ""))) {
      return res.status(409).json({
        message: "Please correct the highlighted Initial Premium eOR field(s).",
        fieldErrors: { eorNumber: "Record already exists for this eOR number." },
      });
    }
    return res.status(500).json({ message: "Server error." });
  }
});


app.post("/api/prospects/:prospectId/leads/:leadId/policy-issuance/policy-summary", async (req, res) => {
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const { policyNumber, policySummaryFileDataUrl, policySummaryFileName } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const policyNo = String(policyNumber || "").trim();
    const pdfDataUrl = String(policySummaryFileDataUrl || "").trim();
    const fileName = String(policySummaryFileName || "").trim();

    if (!/^\d{8}$/.test(policyNo)) return res.status(400).json({ message: "Policy number must be exactly 8 digits." });
    if (!pdfDataUrl || !/^data:application\/pdf;base64,/i.test(pdfDataUrl)) {
      return res.status(400).json({ message: "Policy summary file must be a PDF." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).select("_id").lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).select("_id").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage contactAttemptCycle");
    if (!engagement) return res.status(404).json({ message: "Lead engagement not found." });
    if (engagement.currentStage !== "Policy Issuance") {
      return res.status(409).json({ message: "Lead is not in Policy Issuance stage." });
    }

    const existingPolicyNumber = await Policy.findOne({
      "uploadPolicySummary.policyNumber": policyNo,
      leadEngagementId: { $ne: engagement._id },
    })
      .select("_id")
      .lean();
    if (existingPolicyNumber) {
      return res.status(409).json({ message: "Policy number already exists." });
    }

    const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
    await ensurePolicyAttemptCycleIndex();
    await Policy.updateOne(
      { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
      {
        $setOnInsert: { leadEngagementId: engagement._id },
        $set: {
          attemptCycle: currentAttemptCycle,
          outcomeActivity: "Record Coverage Duration Details",
          uploadPolicySummary: {
            policyNumber: policyNo,
            policySummaryFileDataUrl: pdfDataUrl,
            policySummaryFileName: fileName,
            policySummaryFileMimeType: "application/pdf",
            uploadedAt: new Date(),
          },
        },
      },
      { upsert: true }
    );

    await LeadEngagement.updateOne(
      { _id: engagement._id },
      { $set: { currentActivityKey: "Record Coverage Duration Details" } }
    );

    return res.json({ message: "Policy summary uploaded.", currentActivityKey: "Record Coverage Duration Details" });
  } catch (err) {
    console.error("Policy issuance policy summary save error:", err);
    if (err?.code === 11000 && String(err?.message || "").includes("uploadPolicySummary.policyNumber")) {
      return res.status(409).json({ message: "Policy number already exists." });
    }
    return res.status(500).json({ message: "Server error." });
  }
});


app.post("/api/prospects/:prospectId/leads/:leadId/policy-issuance/coverage-duration", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const {
      selectedPaymentTermLabel,
      selectedPaymentTermType,
      selectedPaymentTermYears,
      selectedPaymentTermUntilAge,
      coverageDurationLabel,
      coverageDurationType,
      coverageDurationYears,
      coverageDurationUntilAge,
    } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    let responsePayload = null;

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId })
        .select("_id firstName middleName lastName birthday")
        .session(session)
        .lean();
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId })
        .session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage contactAttemptCycle").session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });
      if (engagement.currentStage !== "Policy Issuance") {
        throw Object.assign(new Error("Lead is not in Policy Issuance stage."), { status: 409 });
      }

      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      await ensurePolicyAttemptCycleIndex();
      const policyDoc = await Policy.findOne({ leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) })
        .select("chosenProductId uploadPolicySummary.policyNumber uploadInitialPremiumEor.paymentId recordPolicyApplicationStatus.status recordPolicyApplicationStatus.issuanceDate")
        .session(session)
        .lean();
      if (!policyDoc) throw Object.assign(new Error("Policy record not found."), { status: 404 });

      const paymentFilters = [{ leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) }];
      if (policyDoc?.uploadInitialPremiumEor?.paymentId) paymentFilters.unshift({ _id: policyDoc.uploadInitialPremiumEor.paymentId, ...attemptCycleFilterForCycle(currentAttemptCycle) });
      const paymentDoc = await Payment.findOne({ $or: paymentFilters })
        .select("_id status annualPaymentId recordPremiumPaymentTransfer uploadPremiumPaymentEor")
        .session(session)
        .lean();
      if (!paymentDoc?._id || String(paymentDoc?.status || "") !== "Processed") {
        throw Object.assign(new Error("Processed premium payment record is required before saving coverage duration details."), { status: 409 });
      }

      const annualPaymentDoc = paymentDoc?.annualPaymentId && mongoose.isValidObjectId(paymentDoc.annualPaymentId)
        ? await AnnualPayment.findById(paymentDoc.annualPaymentId)
            .select("_id frequencyOfPayment")
            .session(session)
            .lean()
        : await AnnualPayment.findOne({ leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) })
            .select("_id frequencyOfPayment")
            .session(session)
            .lean();
      if (!annualPaymentDoc?._id) {
        throw Object.assign(new Error("Annual payment record is required before saving coverage duration details."), { status: 409 });
      }

      const productId = policyDoc?.chosenProductId;
      if (!productId || !mongoose.isValidObjectId(productId)) {
        throw Object.assign(new Error("Chosen product is missing for this policy."), { status: 409 });
      }

      const product = await Product.findById(productId)
        .select("productName paymentTermOptions coverageDurationRule")
        .session(session)
        .lean();
      if (!product) throw Object.assign(new Error("Chosen product not found."), { status: 404 });

      const issuanceDate = policyDoc?.recordPolicyApplicationStatus?.issuanceDate
        ? new Date(policyDoc.recordPolicyApplicationStatus.issuanceDate)
        : null;
      if (!issuanceDate || Number.isNaN(issuanceDate.getTime())) {
        throw Object.assign(new Error("Policy issuance date is required before saving coverage duration details."), { status: 409 });
      }

      const birthDate = prospect?.birthday ? new Date(prospect.birthday) : null;
      if (!birthDate || Number.isNaN(birthDate.getTime())) {
        throw Object.assign(new Error("Prospect birthday is required to compute age-based terms."), { status: 400 });
      }

      let issuanceAge = issuanceDate.getFullYear() - birthDate.getFullYear();
      const hasBirthdayPassed =
        issuanceDate.getMonth() > birthDate.getMonth() ||
        (issuanceDate.getMonth() === birthDate.getMonth() && issuanceDate.getDate() >= birthDate.getDate());
      if (!hasBirthdayPassed) issuanceAge -= 1;
      if (issuanceAge < 0) throw Object.assign(new Error("Invalid prospect birthday for issuance-age computation."), { status: 400 });

      const paymentOptions = Array.isArray(product?.paymentTermOptions) ? product.paymentTermOptions : [];
      if (!paymentOptions.length) {
        throw Object.assign(new Error("Chosen product has no payment-term options configured."), { status: 400 });
      }

      const normalizedPaymentType = String(selectedPaymentTermType || "").trim();
      const normalizedCoverageType = String(coverageDurationType || "").trim();
      const normalizedPaymentLabel = String(selectedPaymentTermLabel || "").trim();
      const normalizedCoverageLabel = String(coverageDurationLabel || "").trim();

      const paymentYears = selectedPaymentTermYears !== undefined && selectedPaymentTermYears !== null && selectedPaymentTermYears !== ""
        ? Number(selectedPaymentTermYears)
        : null;
      const paymentUntilAge = selectedPaymentTermUntilAge !== undefined && selectedPaymentTermUntilAge !== null && selectedPaymentTermUntilAge !== ""
        ? Number(selectedPaymentTermUntilAge)
        : null;

      const coverageUntilAge = coverageDurationUntilAge !== undefined && coverageDurationUntilAge !== null && coverageDurationUntilAge !== ""
        ? Number(coverageDurationUntilAge)
        : null;

      const matchedPayment = paymentOptions.find((opt) => {
        const optType = String(opt?.type || "").trim();
        const optLabel = String(opt?.label || "").trim();
        if (optType !== normalizedPaymentType || optLabel !== normalizedPaymentLabel) {
          return false;
        }

        if (normalizedPaymentType === "FIXED_YEARS") {
          return (opt?.years ?? null) === (paymentYears ?? null);
        }

        if (normalizedPaymentType === "UNTIL_AGE") {
          return (opt?.untilAge ?? null) === (paymentUntilAge ?? null);
        }

        if (normalizedPaymentType === "RANGE_TO_AGE") {
          const optionMaxAge = Number(opt?.untilAge);
          const optionMinYears = Number(opt?.minYears);
          const computedMinAge = Number.isFinite(optionMinYears)
            ? issuanceAge + optionMinYears
            : issuanceAge + 1;
          return Number.isFinite(paymentUntilAge) && paymentUntilAge >= computedMinAge && paymentUntilAge <= optionMaxAge;
        }

        return (opt?.years ?? null) === (paymentYears ?? null) && (opt?.untilAge ?? null) === (paymentUntilAge ?? null);
      });
      if (!matchedPayment) {
        throw Object.assign(new Error("Selected payment term is invalid for the chosen product."), { status: 400 });
      }

      const coverageRule = product?.coverageDurationRule || null;
      if (!coverageRule || !coverageRule.type) {
        throw Object.assign(new Error("Coverage duration rule is not configured for the chosen product."), { status: 400 });
      }

      const coverageRuleType = String(coverageRule.type || "").trim();
      const coverageRuleLabel = String(coverageRule.label || "").trim();
      if (normalizedCoverageType !== coverageRuleType || normalizedCoverageLabel !== coverageRuleLabel) {
        throw Object.assign(new Error("Coverage duration selection does not match product rule."), { status: 400 });
      }

      const computedCoverageUntilAge = coverageRuleType === "RANGE_TO_AGE" ? coverageUntilAge : (coverageRule?.untilAge ?? null);
      const computedCoverageYears = coverageRuleType === "FIXED_YEARS" ? (coverageRule?.years ?? null) : null;

      if (coverageRuleType === "RANGE_TO_AGE") {
        const minAge = Math.max((Number(issuanceAge) || 0) + 1, Number(coverageRule?.minYears || 1));
        const maxAge = Number(coverageRule?.untilAge || 0);
        if (!Number.isFinite(coverageUntilAge) || coverageUntilAge < minAge || coverageUntilAge > maxAge) {
          throw Object.assign(new Error(`Coverage duration age must be between ${minAge} and ${maxAge}.`), { status: 400 });
        }
      }

      let yearsToAdd = null;
      if (coverageRuleType === "FIXED_YEARS") {
        yearsToAdd = Number(coverageRule?.years || 0);
      } else if (coverageRuleType === "UNTIL_AGE") {
        yearsToAdd = Number(coverageRule?.untilAge || 0) - issuanceAge;
      } else if (coverageRuleType === "RANGE_TO_AGE") {
        yearsToAdd = Number(coverageUntilAge || 0) - issuanceAge;
      }

      if (!Number.isFinite(yearsToAdd) || yearsToAdd <= 0) {
        throw Object.assign(new Error("Unable to compute policy end date from selected coverage duration."), { status: 400 });
      }

      const policyEndDate = new Date(issuanceDate);
      policyEndDate.setFullYear(policyEndDate.getFullYear() + yearsToAdd);

      const paymentDate = paymentDoc?.recordPremiumPaymentTransfer?.paymentDate
        ? new Date(paymentDoc.recordPremiumPaymentTransfer.paymentDate)
        : null;

      await ensureNeedsAssessmentAttemptCycleIndex();
      const needsAssessment = await NeedsAssessment.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      })
        .select("needsPriorities.productSelection.requestedFrequency")
        .session(session)
        .lean();
      const requestedFrequency = String(
        annualPaymentDoc?.frequencyOfPayment
        || paymentDoc?.recordPremiumPaymentTransfer?.frequencyOfPremiumPayment
        || needsAssessment?.needsPriorities?.productSelection?.requestedFrequency
        || ""
      ).trim();

      const monthsByFrequency = {
        Monthly: 1,
        Quarterly: 3,
        "Half-yearly": 6,
        Yearly: 12,
      };
      const recurringIntervalMonths = monthsByFrequency[requestedFrequency] ?? null;

      let paymentTermEndDate = null;
      if (normalizedPaymentType === "FIXED_YEARS") {
        const years = Number(paymentYears || 0);
        if (Number.isFinite(years) && years > 0) {
          paymentTermEndDate = new Date(issuanceDate);
          paymentTermEndDate.setFullYear(paymentTermEndDate.getFullYear() + years);
        }
      } else if (["UNTIL_AGE", "RANGE_TO_AGE"].includes(normalizedPaymentType)) {
        const years = Number(paymentUntilAge || 0) - Number(issuanceAge || 0);
        if (Number.isFinite(years) && years > 0) {
          paymentTermEndDate = new Date(issuanceDate);
          paymentTermEndDate.setFullYear(paymentTermEndDate.getFullYear() + years);
        }
      }

      let nextPaymentDate = null;
      if (
        recurringIntervalMonths
        && paymentDate
        && !Number.isNaN(paymentDate.getTime())
        && paymentTermEndDate
        && !Number.isNaN(paymentTermEndDate.getTime())
      ) {
        const candidate = new Date(paymentDate);
        candidate.setMonth(candidate.getMonth() + recurringIntervalMonths);
        if (candidate < paymentTermEndDate) {
          nextPaymentDate = candidate;
        }
      }

      const now = new Date();

      await Policy.updateOne(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            attemptCycle: currentAttemptCycle,
            outcomeActivity: "Record Coverage Duration Details",
            recordCoverageDurationDetails: {
              policyNumber: String(policyDoc?.uploadPolicySummary?.policyNumber || ""),
              selectedPaymentTermLabel: normalizedPaymentLabel,
              selectedPaymentTermType: normalizedPaymentType,
              selectedPaymentTermYears: paymentYears,
              selectedPaymentTermUntilAge: paymentUntilAge,
              coverageDurationLabel: normalizedCoverageLabel,
              coverageDurationType: normalizedCoverageType,
              coverageDurationYears: computedCoverageYears,
              coverageDurationUntilAge: computedCoverageUntilAge,
              coverageStartDate: issuanceDate,
              coverageEndDate: policyEndDate,
              policyEndDate,
              savedAt: now,
            },
          },
        },
        { upsert: true, session }
      );

      await LeadEngagement.updateOne(
        { _id: engagement._id },
        { $set: { currentActivityKey: "Record Coverage Duration Details" } },
        { session }
      );

      await Task.updateMany(
        {
          assignedToUserId: userObjectId,
          prospectId: prospectObjectId,
          leadEngagementId: engagement._id,
          type: "FOLLOW_UP",
          status: "Open",
          dedupeKey: `POLICY_APPLICATION_STATUS_FOLLOW_UP:${engagement._id}`,
        },
        {
          $set: {
            status: "Done",
            completedAt: now,
          },
        },
        { session }
      );

      const policyStatus = String(policyDoc?.recordPolicyApplicationStatus?.status || "").trim();
      let policyholderForResponse = null;
      if (policyStatus === "Issued") {
        lead.status = "Closed";
        await lead.save({ session });

        const policyNumber = String(policyDoc?.uploadPolicySummary?.policyNumber || "").trim();
        if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
          throw Object.assign(new Error("Premium payment date is required to create policyholder."), { status: 409 });
        }
        if (!policyNumber) {
          throw Object.assign(new Error("Policy number is required to create policyholder."), { status: 409 });
        }

        let nextAnnualPaymentDoc = null;
        if (
          requestedFrequency === "Yearly"
          && annualPaymentDoc?._id
          && String(annualPaymentDoc.status || "") === "Completed"
        ) {
          const nextAnnualStartDate = nextDay(annualPaymentDoc.annualPaymentPeriod?.endDate);
          if (nextAnnualStartDate && isBeforePaymentTermEnd(nextAnnualStartDate, paymentTermEndDate)) {
            await ensureAnnualPaymentLeadEngagementIndex();
            const nextAnnualPeriod = deriveAnnualPaymentPeriod(nextAnnualStartDate);
            const nextAnnualMetrics = buildAnnualPaymentMetrics({
              totalAnnualPremiumPhp: annualPaymentDoc.totalAnnualPremiumPhp,
              amountPaidSoFarPhp: 0,
              paidCount: 0,
              frequencyOfPayment: annualPaymentDoc.frequencyOfPayment || requestedFrequency,
            });
            nextAnnualPaymentDoc = await AnnualPayment.findOneAndUpdate(
              {
                leadEngagementId: engagement._id,
                "annualPaymentPeriod.startDate": nextAnnualPeriod.startDate,
              },
              {
                $setOnInsert: {
                  leadEngagementId: engagement._id,
                  annualPaymentPeriod: nextAnnualPeriod,
                  totalAnnualPremiumPhp: annualPaymentDoc.totalAnnualPremiumPhp,
                  frequencyOfPayment: annualPaymentDoc.frequencyOfPayment || requestedFrequency,
                  ...nextAnnualMetrics,
                },
                $set: { attemptCycle: currentAttemptCycle },
              },
              { upsert: true, new: true, session }
            );
            nextPaymentDate = nextAnnualStartDate;
          }
        }

        let existingPolicyholder = await Policyholder.findOne({ leadEngagementId: engagement._id }).session(session);
        if (existingPolicyholder) {
          existingPolicyholder.assignedToUserId = userObjectId;
          existingPolicyholder.productId = new mongoose.Types.ObjectId(productId);
          existingPolicyholder.policyNumber = policyNumber;
          existingPolicyholder.lastPaidDate = paymentDate;
          existingPolicyholder.nextPaymentDate = nextPaymentDate;
          existingPolicyholder.status = "Active";
          for (const recordAnnualPaymentDoc of [annualPaymentDoc, nextAnnualPaymentDoc].filter(Boolean)) {
            const alreadyRecorded = (existingPolicyholder.annualPaymentRecords || []).some((record) => String(record?.annualPaymentId || "") === String(recordAnnualPaymentDoc._id));
            if (!alreadyRecorded) {
              existingPolicyholder.annualPaymentRecords.push({ annualPaymentId: recordAnnualPaymentDoc._id, recordedAt: now });
            }
          }
          await existingPolicyholder.save({ session });
          policyholderForResponse = existingPolicyholder;
        } else {
          const MAX_TRIES = 5;
          let lastErr = null;
          for (let i = 0; i < MAX_TRIES; i += 1) {
            try {
              const policyholderCode = await getNextPolicyholderCode();
              const createdPolicyholders = await Policyholder.create([
                {
                  policyholderCode,
                  assignedToUserId: userObjectId,
                  leadEngagementId: engagement._id,
                  productId: new mongoose.Types.ObjectId(productId),
                  policyNumber,
                  lastPaidDate: paymentDate,
                  nextPaymentDate,
                  status: "Active",
                  annualPaymentRecords: [annualPaymentDoc, nextAnnualPaymentDoc]
                    .filter((recordAnnualPaymentDoc) => recordAnnualPaymentDoc?._id)
                    .map((recordAnnualPaymentDoc) => ({ annualPaymentId: recordAnnualPaymentDoc._id, recordedAt: now })),
                },
              ], { session });
              policyholderForResponse = createdPolicyholders[0] || null;
              lastErr = null;
              break;
            } catch (err) {
              lastErr = err;
              if (!(err?.code === 11000 && String(err?.message || "").includes("policyholderCode"))) {
                throw err;
              }
            }
          }
          if (lastErr) throw lastErr;
        }
      }

      const prospectFullName = `${prospect?.firstName || ""}${prospect?.middleName ? ` ${prospect.middleName}` : ""} ${prospect?.lastName || ""}`.trim();
      responsePayload = {
        message: "Coverage duration details saved.",
        currentActivityKey: "Record Coverage Duration Details",
        policyEndDate,
        nextPaymentDate,
        leadClosed: policyStatus === "Issued",
        policyholder: policyholderForResponse
          ? {
              _id: policyholderForResponse._id,
              policyholderCode: policyholderForResponse.policyholderCode || "",
              name: prospectFullName,
              productName: String(product?.productName || ""),
              policyNumber: String(policyholderForResponse.policyNumber || policyDoc?.uploadPolicySummary?.policyNumber || ""),
            }
          : null,
      };
    });

    return res.json(responsePayload || {
      message: "Coverage duration details saved.",
      currentActivityKey: "Record Coverage Duration Details",
    });
  } catch (err) {
    console.error("Policy issuance coverage duration save error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});


app.post("/api/prospects/:prospectId/leads/:leadId/proposal/schedule-application", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const {
      meetingAt,
      meetingDate,
      meetingStartTime,
      meetingDurationMin,
      meetingMode,
      meetingPlatform,
      meetingPlatformOther,
      meetingLink,
      meetingInviteSent,
      meetingPlace,
    } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      const stageNow = String(engagement.currentStage || "").trim();
      if (!["Proposal", "Application"].includes(stageNow)) {
        throw Object.assign(new Error("Lead is not in Proposal/Application stage."), { status: 409 });
      }

      const activityNow = String(engagement.currentActivityKey || "").trim();
      const meetingType = "Application Submission";
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);
      const existingMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
        meetingType,
      }).session(session);
      const canScheduleFromProposal = stageNow === "Proposal" && activityNow === "Schedule Application Submission";
      const canRescheduleFromProposal = stageNow === "Proposal" && Boolean(existingMeeting);
      const canRescheduleWithinApplication = stageNow === "Application";
      if (!canScheduleFromProposal && !canRescheduleFromProposal && !canRescheduleWithinApplication) {
        throw Object.assign(new Error("Schedule Application Submission is not the current activity."), { status: 409 });
      }

      const durationMin = Number(meetingDurationMin || 120);
      const dt = meetingDate && meetingStartTime
        ? combineDateAndTimeLocal(meetingDate, meetingStartTime)
        : new Date(meetingAt);

      if (!dt || Number.isNaN(dt.getTime())) {
        throw Object.assign(new Error("meeting date/time is required and must be valid."), { status: 400 });
      }

      const nowLocal = new Date();
      const todayStart = new Date(nowLocal);
      todayStart.setHours(0, 0, 0, 0);
      if (dt < todayStart) {
        throw Object.assign(new Error("meetingAt must be today or a future date."), { status: 400 });
      }
      if (dt <= nowLocal) {
        throw Object.assign(new Error("meetingAt must be in the future."), { status: 400 });
      }

      const latestProposalPresentationMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
        meetingType: "Proposal Presentation",
      })
        .sort({ endAt: -1, startAt: -1, createdAt: -1 })
        .session(session);
      if (latestProposalPresentationMeeting?.startAt) {
        const proposalStart = new Date(latestProposalPresentationMeeting.startAt);
        const proposalEnd = latestProposalPresentationMeeting.endAt
          ? new Date(latestProposalPresentationMeeting.endAt)
          : new Date(proposalStart.getTime() + Number(latestProposalPresentationMeeting.durationMin || 120) * 60 * 1000);
        if (!Number.isNaN(proposalEnd.getTime()) && dt.getTime() <= proposalEnd.getTime()) {
          throw Object.assign(new Error("Application submission meeting must start after the last proposal presentation meeting ends."), { status: 400 });
        }
      }

      if (![30, 60, 90, 120].includes(durationMin)) {
        throw Object.assign(new Error("meetingDurationMin must be one of 30, 60, 90, 120."), { status: 400 });
      }

      const mode = String(meetingMode || "").trim();
      if (!["Online", "Face-to-face"].includes(mode)) {
        throw Object.assign(new Error("meetingMode must be Online or Face-to-face."), { status: 400 });
      }

      const platform = String(meetingPlatform || "").trim();
      const platformOther = String(meetingPlatformOther || "").trim();
      const link = String(meetingLink || "").trim();
      const place = String(meetingPlace || "").trim();

      if (mode === "Online") {
        if (!["Zoom", "Google Meet", "Other"].includes(platform)) {
          throw Object.assign(new Error("meetingPlatform is required for online meetings."), { status: 400 });
        }
        if (platform === "Other" && !platformOther) {
          throw Object.assign(new Error("meetingPlatformOther is required when platform is Other."), { status: 400 });
        }
        if (!link || !isValidHttpUrl(link)) {
          throw Object.assign(new Error("Valid meetingLink (http/https) is required for online meetings."), { status: 400 });
        }
        if (meetingInviteSent !== true) {
          throw Object.assign(new Error("meetingInviteSent must be true for online meetings."), { status: 400 });
        }
      }

      if (mode === "Face-to-face" && !place) {
        throw Object.assign(new Error("meetingPlace is required for face-to-face meetings."), { status: 400 });
      }

      const endAt = new Date(dt.getTime() + durationMin * 60 * 1000);

      const windows = await getAgentMeetingWindows(userObjectId, null, null, session);
      if (
        existingMeeting?.startAt &&
        !Number.isNaN(new Date(existingMeeting.startAt).getTime()) &&
        dt.getTime() === new Date(existingMeeting.startAt).getTime()
      ) {
        throw Object.assign(new Error("Rescheduled application submission meeting time cannot be the same as previous meeting time."), { status: 400 });
      }
      const conflictWindows = existingMeeting?._id
        ? windows.filter((w) => String(w.id || "") !== String(existingMeeting._id))
        : windows;
      const conflict = hasMeetingConflict(dt, endAt, conflictWindows);
      if (conflict) {
        throw Object.assign(new Error("Selected meeting time conflicts with another scheduled meeting."), {
          status: 409,
          code: "MEETING_SLOT_CONFLICT",
        });
      }

      if (existingMeeting) {
        existingMeeting.startAt = dt;
        existingMeeting.endAt = endAt;
        existingMeeting.durationMin = durationMin;
        existingMeeting.mode = mode;
        existingMeeting.platform = mode === "Online" ? platform : undefined;
        existingMeeting.platformOther = mode === "Online" && platform === "Other" ? platformOther : undefined;
        existingMeeting.link = mode === "Online" ? link : undefined;
        existingMeeting.inviteSent = Boolean(meetingInviteSent);
        existingMeeting.place = mode === "Face-to-face" ? place : undefined;
        existingMeeting.status = "Scheduled";
        await existingMeeting.save({ session });
      } else {
        await ScheduledMeeting.create(
          [{
            leadEngagementId: engagement._id,
            attemptCycle: currentAttemptCycle,
            meetingType,
            startAt: dt,
            endAt,
            durationMin,
            mode,
            platform: mode === "Online" ? platform : undefined,
            platformOther: mode === "Online" && platform === "Other" ? platformOther : undefined,
            link: mode === "Online" ? link : undefined,
            inviteSent: Boolean(meetingInviteSent),
            place: mode === "Face-to-face" ? place : undefined,
            status: "Scheduled",
          }],
          { session }
        );
      }

      const now = new Date();

      await ScheduledMeeting.updateMany(
        {
          leadEngagementId: engagement._id,
          meetingType: "Proposal Presentation",
          status: { $in: ["Scheduled", "Open", "Overdue"] },
        },
        { $set: { status: "Completed" } },
        { session }
      );

      const openPresentationTasks = await Task.find({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "PRESENTATION",
        status: { $in: ["Open", "Overdue"] },
      }).session(session);

      for (const t of openPresentationTasks) {
        t.status = "Done";
        t.completedAt = now;
        await t.save({ session });
      }

      const applicationDedupeKey = currentAttemptCycle > 1
        ? `APPLICATION_SUBMISSION:${engagement._id}:${currentAttemptCycle}`
        : `APPLICATION_SUBMISSION:${engagement._id}`;
      let applicationTask = await Task.findOne({
        assignedToUserId: userObjectId,
        dedupeKey: applicationDedupeKey,
        softDeletedAt: null,
      }).session(session);

      const appointmentTitle = `Apply for policy with ${prospect.firstName}`;
      const appointmentDescription = `Assist ${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName} in policy application submission (Lead ${lead.leadCode || "—"}). Meeting window: ${formatDateTimeInManila(dt)} to ${formatDateTimeInManila(endAt)} (Asia/Manila).`;
      const appointmentDueAt = new Date(endAt.getTime() + 15 * 60 * 1000);

      if (!applicationTask) {
        applicationTask = await Task.create(
          [{
            assignedToUserId: userObjectId,
            prospectId: prospectObjectId,
            leadEngagementId: engagement._id,
            type: "APPOINTMENT",
            title: appointmentTitle,
            description: appointmentDescription,
            dueAt: appointmentDueAt,
            status: "Open",
            dedupeKey: applicationDedupeKey,
          }],
          { session }
        ).then((docs) => docs[0]);

        const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: applicationTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
        });
      } else if (applicationTask.status !== "Done") {
        applicationTask.title = appointmentTitle;
        applicationTask.description = appointmentDescription;
        applicationTask.dueAt = appointmentDueAt;
        await applicationTask.save({ session });

        const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: applicationTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
          includeTaskAdded: true,
          refreshTaskAdded: true,
        });
      }
      applicationTaskIdForNotif = applicationTask?._id || null;
      engagement.currentStage = "Application";
      engagement.currentActivityKey = "Record Prospect Attendance";
      engagement.stageCompletedAt = now;
      engagement.stageHistory = Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [];

      const openProposalStage = [...engagement.stageHistory]
        .reverse()
        .find((h) => h?.stage === "Proposal" && !h?.completedAt);
      if (openProposalStage) {
        openProposalStage.completedAt = now;
        openProposalStage.reason = "Application submission meeting scheduled.";
      }

      engagement.stageHistory.push({
        stage: "Application",
        startedAt: now,
        completedAt: null,
        reason: "Moved from Proposal after scheduling application submission.",
      });
      engagement.stageStartedAt = now;
      await engagement.save({ session });

      await ensureProposalAttemptCycleIndex();
      await Proposal.updateOne(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
          $set: { outcomeActivity: "Schedule Application Submission" },
        },
        { upsert: true, session }
      );

      const applicationProposal = await Proposal.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      })
        .select("chosenProductId")
        .session(session)
        .lean();
      await ensureNeedsAssessmentAttemptCycleIndex();
      const applicationNeedsAssessment = await NeedsAssessment.findOne({
        leadEngagementId: engagement._id,
        attemptCycle: currentAttemptCycle,
      })
        .select("needsPriorities.productSelection.selectedProductId")
        .session(session)
        .lean();
      const applicationChosenProductIdRaw = applicationProposal?.chosenProductId
        || applicationNeedsAssessment?.needsPriorities?.productSelection?.selectedProductId
        || null;
      const applicationChosenProductId = applicationChosenProductIdRaw && mongoose.isValidObjectId(applicationChosenProductIdRaw)
        ? new mongoose.Types.ObjectId(applicationChosenProductIdRaw)
        : null;
      await ensureApplicationForCurrentAttemptCycle(engagement._id, currentAttemptCycle, {
        session,
        chosenProductId: applicationChosenProductId,
      });
    });
    await ensureTaskMissedNotificationsForUser(userObjectId, { forceUnread: true, taskIds: [applicationTaskIdForNotif] });

    return res.json({
      message: "Application submission meeting scheduled.",
      currentActivityKey: "Record Prospect Attendance",
      currentStage: "Application",
    });
  } catch (err) {
    console.error("Schedule application submission error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error.", code: err?.code });
  } finally {
    session.endSession();
  }
});

app.post("/api/prospects/:prospectId/leads/:leadId/proposal/presentation", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
    const { prospectId, leadId } = req.params;
    const { proposalAccepted, initialQuotationNotes } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const notes = String(initialQuotationNotes || "").trim();
    const hasDecision = proposalAccepted !== undefined && proposalAccepted !== null && String(proposalAccepted || "").trim() !== "";
    const accepted = String(proposalAccepted || "").trim().toUpperCase();
    if (!notes) {
      return res.status(400).json({ message: "Notes on Quotation Proposal is required." });
    }
    if (hasDecision && !["YES", "NO"].includes(accepted)) {
      return res.status(400).json({ message: "Please select whether further proposal presentation is required (Yes/No)." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    let proposalPresentationResponse = { currentActivityKey: "Present Proposal", presentedAt: null };

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      if (engagement.currentStage !== "Proposal") {
        throw Object.assign(new Error("Lead is not in Proposal stage."), { status: 409 });
      }

      if (!["Present Proposal", "Schedule Application Submission"].includes(String(engagement.currentActivityKey || "").trim())) {
        throw Object.assign(new Error("Present Proposal decision can only be edited while in Proposal subactivities."), { status: 409 });
      }

      let currentActivityKey = String(engagement.currentActivityKey || "Present Proposal").trim() || "Present Proposal";
      const presentedAt = hasDecision ? new Date() : null;

      if (hasDecision) {
        currentActivityKey = accepted === "YES" ? "Schedule Application Submission" : "Present Proposal";
        engagement.currentActivityKey = currentActivityKey;
        await engagement.save({ session });
      }

      await ensureProposalAttemptCycleIndex();
      const currentAttemptCycle = normalizeAttemptCycle(engagement.contactAttemptCycle);

      const proposalSet = hasDecision
        ? {
            outcomeActivity: currentActivityKey,
            "presentProposal.proposalAccepted": accepted,
            "presentProposal.initialQuotationNotes": notes,
            "presentProposal.presentedAt": presentedAt,
          }
        : {
            "presentProposal.initialQuotationNotes": notes,
          };

      await Proposal.updateOne(
        { leadEngagementId: engagement._id, ...attemptCycleFilterForCycle(currentAttemptCycle) },
        {
          $setOnInsert: { leadEngagementId: engagement._id, attemptCycle: currentAttemptCycle },
          $set: proposalSet,
        },
        { upsert: true, session }
      );

      proposalPresentationResponse = { currentActivityKey, presentedAt };
    });

    return res.json({
      message: hasDecision ? "Proposal presentation details saved." : "Quotation proposal notes saved.",
      currentActivityKey: proposalPresentationResponse.currentActivityKey,
      presentedAt: proposalPresentationResponse.presentedAt,
    });
  } catch (err) {
    console.error("Save proposal presentation error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});

// ===========================
// TASKS: SUMMARY (Agent dashboard)
// GET /api/tasks/summary?userId=...&includeRefs=1
//
// Purpose:
// - Returns two dashboard card lists (Open tasks only):
//   1) dueTodayTop5: tasks due later today (Asia/Manila) and NOT yet overdue
//   2) recentlyAddedTop5: newest tasks by createdAt
//
// Optional behavior:
// - includeRefs=1 => attaches UI-friendly references (prospectName, leadId, leadCode)
//   using attachTaskRefs()
// ===========================
app.get("/api/tasks/summary", async (req, res) => {
  try {
    const { userId, includeRefs } = req.query;

    // Validate required userId for scoping tasks to a user
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    await ensureTaskMissedNotificationsForUser(userObjectId);

    // Fetch only OPEN tasks for dashboard (Done tasks are excluded entirely)
    let openTasks = await Task.find({ assignedToUserId: userObjectId, status: "Open", softDeletedAt: null })
      .select("assignedToUserId prospectId leadEngagementId type title description dueAt status completedAt wasDelayed createdAt")
      .lean();

    // Optional: attach prospectName + leadId + leadCode for UI routing/display
    if (String(includeRefs) === "1") {
      openTasks = await attachTaskRefs(openTasks);
    }

    // "Now" is server time; "todayKey" uses Asia/Manila date boundaries
    const nowMs = Date.now();
    const todayKey = dateKeyInTZ(new Date(), "Asia/Manila");

    // Add UI-only overdue flag (does not persist to DB)
    const openTasksUi = openTasks.map((t) => {
      const dueMs = new Date(t?.dueAt).getTime();
      const isOverdue = Number.isFinite(dueMs) ? dueMs < nowMs : false;
      return { ...t, __isOverdue: isOverdue };
    });


    /**
     * dueTodayTop5 definition:
     * - due date is "today" in Asia/Manila
     * - AND due time is still in the future (not overdue)
     * - sort ascending by dueAt (soonest first)
     * - limit 5
     */
    const dueTodayTop5 = openTasksUi
      .filter((t) => {
        const dueMs = new Date(t?.dueAt).getTime();
        const dueOk = Number.isFinite(dueMs) ? dueMs : Infinity;

        // due today in Manila AND not yet past
        return dateKeyInTZ(t.dueAt, "Asia/Manila") === todayKey && dueOk >= nowMs;
      })
      .slice()
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
      .slice(0, 5);

    /**
     * recentlyAddedTop5 definition:
     * - Open tasks only
     * - sort by createdAt DESC (newest first)
     * - limit 5
     */
    const recentlyAddedTop5 = openTasksUi
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Response includes two lists + simple counts for cards/badges
    return res.json({
      dueTodayTop5,
      recentlyAddedTop5,
      counts: { open: openTasksUi.length, dueToday: dueTodayTop5.length },
    });
  } catch (err) {
    console.error("Tasks summary error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// ===========================
// TASKS: PROGRESS DASHBOARD (Agent)
// GET /api/tasks/progress?userId=...
// ===========================
app.get("/api/tasks/progress", async (req, res) => {
  try {
    const { userId, datePreset = "ALL", type = "ALL", drillType = "", reportLimit = "120" } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    await ensureTaskMissedNotificationsForUser(userObjectId);

    let tasks = await Task.find({ assignedToUserId: userObjectId, softDeletedAt: null })
      .select("_id prospectId leadEngagementId type title dueAt status completedAt wasDelayed createdAt")
      .lean();

    tasks = await attachTaskRefs(tasks);

    const now = Date.now();
    const buildTaskReportContext = () => {
      const presetMap = {
        "1d": [1, "This day"],
        "7d": [7, "Last 7 days"],
        "30d": [30, "Last 30 days"],
        "90d": [90, "Last 90 days"],
        "6m": [183, "Last 6 months"],
        "12m": [365, "Last 12 months"],
      };
      const preset = presetMap[String(datePreset || "ALL")];
      if (!preset) return { startDate: null, endDate: new Date(now), periodLabel: "All available records" };
      const [days, label] = preset;
      const start = new Date(now);
      if (String(datePreset) === "1d") start.setHours(0, 0, 0, 0);
      else start.setDate(start.getDate() - days);
      return { startDate: start, endDate: new Date(now), periodLabel: label };
    };
    const reportContext = buildTaskReportContext();
    const fromMs = reportContext.startDate ? reportContext.startDate.getTime() : null;

    const normalized = tasks.map((t) => {
      const normalizedStatus = String(t?.status || "Open").toLowerCase() === "done" ? "Done" : "Open";
      const normalizedType = String(t?.type || "UPDATE_CONTACT_INFO").toUpperCase().trim();
      const dueAtMs = new Date(t?.dueAt).getTime();
      const createdAtMs = new Date(t?.createdAt).getTime();
      const isOverdue = normalizedStatus === "Open" && Number.isFinite(dueAtMs) && dueAtMs < now;
      return {
        ...t,
        status: normalizedStatus,
        type: normalizedType,
        dueAtMs,
        createdAtMs,
        isOverdue,
        wasDelayed: Boolean(t?.wasDelayed),
      };
    });

    const filtered = normalized.filter((t) => {
      if (String(type) !== "ALL" && t.type !== String(type).toUpperCase().trim()) return false;

      if (fromMs != null) {
        const refMs = Number.isFinite(t.dueAtMs) ? t.dueAtMs : t.createdAtMs;
        if (!Number.isFinite(refMs) || refMs < fromMs) return false;
      }
      return true;
    });

    const open = filtered.filter((t) => t.status === "Open" && !t.isOverdue);
    const overdue = filtered.filter((t) => t.status === "Open" && t.isOverdue);
    const done = filtered.filter((t) => t.status === "Done");
    const delayedDone = done.filter((t) => t.wasDelayed);
    const onTimeDone = done.filter((t) => !t.wasDelayed);

    const TASK_TYPES = ["APPROACH", "FOLLOW_UP", "UPDATE_CONTACT_INFO", "APPOINTMENT", "PRESENTATION"];
    const typeCounts = TASK_TYPES.map((taskType) => {
      const rows = filtered.filter((t) => t.type === taskType);
      const doneCount = rows.filter((t) => t.status === "Done").length;
      return { type: taskType, total: rows.length, done: doneCount };
    });

    const leadWorkloadMap = new Map();
    for (const t of filtered) {
      if (!t?.leadEngagementId) continue;
      const key = String(t.leadEngagementId);
      const row = leadWorkloadMap.get(key) || {
        leadEngagementId: key,
        leadCode: t?.leadCode || "—",
        prospectName: t?.prospectName || "—",
        leadStatus: t?.leadStatus || "—",
        total: 0,
        open: 0,
        overdue: 0,
        done: 0,
      };
      row.total += 1;
      if (t.status === "Open" && !t.isOverdue) row.open += 1;
      if (t.status === "Open" && t.isOverdue) row.overdue += 1;
      if (t.status === "Done") row.done += 1;
      leadWorkloadMap.set(key, row);
    }

    const compareLeadCodes = (a, b) => String(a.leadCode || "").localeCompare(String(b.leadCode || ""), undefined, { numeric: true, sensitivity: "base" });
    const leadWorkloadRows = [...leadWorkloadMap.values()].sort(compareLeadCodes);

    const normalizedDrillType = String(drillType || "").toUpperCase().trim();
    const reportMax = Math.max(20, Math.min(500, Number(reportLimit) || 120));

    const drillTasks = normalizedDrillType
      ? filtered
          .filter((t) => t.type === normalizedDrillType)
          .sort((a, b) => (Number.isFinite(a.dueAtMs) ? a.dueAtMs : Infinity) - (Number.isFinite(b.dueAtMs) ? b.dueAtMs : Infinity))
      : [];

    const reportTasks = filtered
      .slice()
      .sort((a, b) => (Number.isFinite(a.dueAtMs) ? a.dueAtMs : Infinity) - (Number.isFinite(b.dueAtMs) ? b.dueAtMs : Infinity))
      .slice(0, reportMax);

    const totalTasks = filtered.length;
    const completionRate = totalTasks ? Math.round((onTimeDone.length / totalTasks) * 100) : 0;
    const onTimeRate = done.length ? Math.round((onTimeDone.length / done.length) * 100) : 0;
    const lateCompletionRate = done.length ? Math.round((delayedDone.length / done.length) * 100) : 0;
    const openPool = open.length + overdue.length;
    const overdueOpenRate = openPool ? Math.round((overdue.length / openPool) * 100) : 0;

    return res.json({
      totalTasks,
      openTasks: open.length,
      doneTasks: onTimeDone.length,
      allDoneTasks: done.length,
      overdueTasks: overdue.length,
      delayedDoneTasks: delayedDone.length,
      completionRate,
      onTimeRate,
      lateCompletionRate,
      overdueOpenRate,
      typeCounts,
      leadWorkloadRows,
      statusChart: [
        { key: "Open", value: open.length, color: "#f59e0b" },
        { key: "Overdue Open", value: overdue.length, color: "#ef4444" },
        { key: "On-Time Done", value: onTimeDone.length, color: "#16a34a" },
        { key: "Delayed Done", value: delayedDone.length, color: "#7c3aed" },
      ],
      drillTasks,
      reportTasks,
      reportContext: {
        datePreset: String(datePreset),
        periodLabel: reportContext.periodLabel,
        startDate: reportContext.startDate,
        endDate: reportContext.endDate,
        type: String(type),
      },
    });
  } catch (err) {
    console.error("Task progress dashboard error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// ===========================
// TASKS: LIST (Agent)
// GET /api/tasks?userId=...&status=Open|Done&type=APPROACH&includeRefs=1
//
// Purpose:
// - Returns a task list scoped to a user, with optional filters:
//   - status: Open or Done (defaults to all if not provided)
//   - type: one of allowed TASK_TYPES (validated)
// - Sorted for UI:
//   - dueAt ASC, createdAt DESC
//
// Optional behavior:
// - includeRefs=1 => attach prospectName + leadId + leadCode for UI
// ===========================
app.get("/api/tasks", async (req, res) => {
  try {
    const { userId, status, type, includeRefs } = req.query;

    // Validate required userId
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    await ensureTaskMissedNotificationsForUser(userObjectId);

    // Base query always scoped to the user
    const query = { assignedToUserId: userObjectId };

    // Normalize + apply status filter if provided
    // - Anything equal to "done" (case-insensitive) becomes Done
    // - Otherwise defaults to Open
    if (status) {
      const s = String(status).toLowerCase() === "done" ? "Done" : "Open";
      query.status = s;
    }

    // Normalize + validate type filter if provided
    if (type) {
      const t = String(type).toUpperCase().trim();

      const ALLOWED_TYPES = [
        "APPROACH",
        "FOLLOW_UP",
        "UPDATE_CONTACT_INFO",
        "APPOINTMENT",
        "PRESENTATION",
      ];

      if (!ALLOWED_TYPES.includes(t)) {
        return res.status(400).json({ message: `Invalid task type '${type}'.` });
      }

      query.type = t;
    }

    // Fetch tasks sorted for UI:
    // - earliest due first
    // - for same due date, newest created first
    let tasks = await Task.find({ ...query, softDeletedAt: null })
      .sort({ dueAt: 1, createdAt: -1 })
      .select(
        "assignedToUserId prospectId leadEngagementId type title description dueAt status completedAt wasDelayed createdAt"
      )
      .lean();

    /**
     * includeRefs=1:
     * - Adds prospectName (from Prospect)
     * - Resolves leadId + leadCode via LeadEngagement -> Lead
     * - Useful for routing (leadId) and UI display (leadCode)
     */
    if (String(includeRefs) === "1") {
      // --- Prospects (names) ---
      const prospectIds = uniqueValidObjectIdStrings(tasks.map((t) => t.prospectId));

      const prospects = prospectIds.length
        ? await Prospect.find({ _id: { $in: prospectIds } })
        .select("firstName middleName lastName")
        .lean()
        : [];

      const prospectMap = new Map(
        prospects.map((p) => {
          const fullName = `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName}`.trim();
          return [String(p._id), fullName];
        })
      );

      // --- LeadEngagement -> leadId ---
      const engagementIds = uniqueValidObjectIdStrings(tasks.map((t) => t.leadEngagementId));

      const engagementToLeadId = new Map(); 
      let leadIdToCode = new Map();       

      if (engagementIds.length) {
        const engagements = await LeadEngagement.find({ _id: { $in: engagementIds } })
          .select("leadId")
          .lean();

        for (const e of engagements) {
          if (e.leadId) engagementToLeadId.set(String(e._id), String(e.leadId));
        }

        const leadIds = uniqueValidObjectIdStrings(engagements.map((e) => e.leadId));

        if (leadIds.length) {
          const leads = await Lead.find({ _id: { $in: leadIds } })
            .select("leadCode")
            .lean();

          leadIdToCode = new Map(leads.map((l) => [String(l._id), l.leadCode]));
        }
      }

      // Attach UI refs to each task:
      // - prospectName
      // - leadId (for navigation)
      // - leadCode (display)
      tasks = tasks.map((t) => {
        const engagementIdStr = t.leadEngagementId ? String(t.leadEngagementId) : null;
        const leadId = engagementIdStr ? engagementToLeadId.get(engagementIdStr) || null : null;
        const leadCode = leadId ? leadIdToCode.get(String(leadId)) || "—" : "—";

        return {
          ...t,
          prospectName: prospectMap.get(String(t.prospectId)) || "—",
          leadId,  
          leadCode,
        };
      });
    }

    return res.json({ tasks });
  } catch (err) {
    console.error("List tasks error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

}

module.exports = {
  registerLegacyRoutes,
};
