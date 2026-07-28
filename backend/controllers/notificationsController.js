const PAYMENT_NOTIFICATION_TYPES = ["PAYMENT_TRANSFER_REMINDER", "PAYMENT_EOR_REMINDER", "PAYMENT_MISSED_TRANSFER", "POLICY_LAPSED"];
const POLICY_LIFECYCLE_NOTIFICATION_TYPES = ["POLICY_PAID_UP", "POLICY_MATURED", "POLICY_PAID_UP_MATURED", "POLICY_CANCELLED"];
const TASK_NOTIFICATION_TYPES = ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED"];
const MANAGER_NOTIFICATION_TYPES = ["ORPHANS_ENDORSEMENTS"];
const AGENT_ORPHAN_NOTIFICATION_TYPES = ["ORPHAN_CLIENT_ASSIGNED", "ORPHAN_CLIENT_TRANSFERRED"];
const BRANCH_KPI_NOTIFICATION_TYPES = ["BRANCH_KPI_ASSIGNED", "BRANCH_KPI_TARGET_UPDATED", "BRANCH_KPI_UNASSIGNED"];
const UNIT_KPI_NOTIFICATION_TYPES = ["UNIT_KPI_ASSIGNED", "UNIT_KPI_TARGET_UPDATED", "UNIT_KPI_UNASSIGNED"];
const AGENT_KPI_NOTIFICATION_TYPES = ["AGENT_KPI_ASSIGNED", "AGENT_KPI_TARGET_UPDATED", "AGENT_KPI_UNASSIGNED"];
const NOTIFICATION_TYPES = [...TASK_NOTIFICATION_TYPES, ...PAYMENT_NOTIFICATION_TYPES, ...POLICY_LIFECYCLE_NOTIFICATION_TYPES, ...MANAGER_NOTIFICATION_TYPES, ...AGENT_ORPHAN_NOTIFICATION_TYPES, ...BRANCH_KPI_NOTIFICATION_TYPES, ...UNIT_KPI_NOTIFICATION_TYPES, ...AGENT_KPI_NOTIFICATION_TYPES];
const NOTIFICATION_ENTITY_TYPES = ["Task", "Policyholder", "Prospect", "LongLeave", "Retirement", "KpiAssignment"];
const RESOLUTION_REQUIRED_NOTIFICATION_TYPES = [...TASK_NOTIFICATION_TYPES, ...PAYMENT_NOTIFICATION_TYPES, ...MANAGER_NOTIFICATION_TYPES];

function defaultResolutionStatus(notification) {
  const requiresResolution = RESOLUTION_REQUIRED_NOTIFICATION_TYPES.includes(String(notification?.type || "").toUpperCase());
  if (!requiresResolution) return "Not Applicable";
  return notification?.resolutionStatus === "Resolved" ? "Resolved" : "Unresolved";
}

function effectivePolicyholderOwnerFilter(userId) {
  return {
    $or: [
      { reassignedToUserId: userId },
      { reassignedToUserId: null, assignedToUserId: userId },
      { reassignedToUserId: { $exists: false }, assignedToUserId: userId },
    ],
  };
}

function dateKeyInTZ(date, timeZone = "Asia/Manila") {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayNumberFromDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function formatDateInManila(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

function fullName(prospect) {
  return `${prospect?.firstName || ""}${prospect?.middleName ? ` ${prospect.middleName}` : ""} ${prospect?.lastName || ""}`.trim();
}

function deriveCoverageEndDate(policy = {}) {
  const coverage = policy?.recordCoverageDurationDetails || {};
  const rawEndDate = coverage.policyEndDate || coverage.coverageEndDate || null;
  const endDate = rawEndDate ? new Date(rawEndDate) : null;
  if (!endDate || Number.isNaN(endDate.getTime())) return null;
  endDate.setHours(0, 0, 0, 0);
  return endDate;
}

function isReachedByToday(date, todayDay = dayNumberFromDateKey(dateKeyInTZ(new Date()))) {
  if (!date || Number.isNaN(date.getTime()) || todayDay === null) return false;
  const targetDay = dayNumberFromDateKey(dateKeyInTZ(date));
  return targetDay !== null && targetDay <= todayDay;
}

function buildLifecycleActionMessage({ title, type, paidUpDate, maturedDate }) {
  if (type === "POLICY_PAID_UP") {
    return `Policy paid up on ${formatDateInManila(paidUpDate)}.`;
  }
  if (type === "POLICY_MATURED") {
    return `Policy matured on ${formatDateInManila(maturedDate)}.`;
  }
  if (type === "POLICY_PAID_UP_MATURED") {
    return `Policy paid up on ${formatDateInManila(paidUpDate)} and matured on ${formatDateInManila(maturedDate)}.`;
  }
  return `${title}.`;
}

function paymentHasTransfer(payment) {
  const transfer = payment?.recordPremiumPaymentTransfer || {};
  return Boolean(
    transfer.savedAt
      || transfer.paymentDate
      || String(transfer.proofOfPaymentFileDataUrl || "").trim()
      || String(transfer.proofOfPaymentFileName || "").trim()
  );
}

function paymentHasEor(payment) {
  const eor = payment?.uploadPremiumPaymentEor || {};
  return Boolean(
    String(payment?.status || "") === "Processed"
      || eor.uploadedAt
      || String(eor.eorNumber || "").trim()
      || String(eor.eorFileDataUrl || "").trim()
  );
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

function paymentCoveredCount(payment = {}) {
  if (!paymentHasTransfer(payment)) return 0;
  const count = Number(payment?.recordPremiumPaymentTransfer?.paymentCountCovered || 1);
  return Number.isFinite(count) && count > 0 ? Math.max(1, Math.floor(count)) : 1;
}

function paymentProcessedCoveredCount(payment = {}) {
  if (!paymentHasEor(payment)) return 0;
  return paymentCoveredCount(payment);
}

function isPaymentNotification(notification) {
  return PAYMENT_NOTIFICATION_TYPES.includes(String(notification?.type || "").toUpperCase());
}

function notificationTime(notification) {
  const date = new Date(notification?.updatedAt || notification?.createdAt || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function withoutPaymentReminderActionText(message) {
  return String(message || "")
    .replace(/\s*Please record the premium payment transfer details\./gi, "")
    .replace(/\s*Please upload the premium payment eOR\./gi, "")
    .trim();
}

function normalizeNotificationForDisplay(notification) {
  if (!isPaymentNotification(notification)) return notification;
  return {
    ...notification,
    message: withoutPaymentReminderActionText(notification?.message),
  };
}

function paymentNotificationTimestamp(baseDate, type) {
  const base = baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date();
  const normalizedType = String(type || "").toUpperCase();
  if (normalizedType === "PAYMENT_EOR_REMINDER") return new Date(base.getTime() + 1);
  if (normalizedType === "PAYMENT_MISSED_TRANSFER") return new Date(base.getTime() + 1);
  if (normalizedType === "POLICY_LAPSED") return new Date(base.getTime() + 2);
  return base;
}

function sortNotificationsForDisplay(notifications) {
  return [...notifications].sort((a, b) => {
    const aIsPayment = isPaymentNotification(a);
    const bIsPayment = isPaymentNotification(b);
    if (aIsPayment && bIsPayment && a?.status === "Unread" && b?.status === "Unread") {
      const aDeadline = String(a?.metadata?.nextPaymentDateKey || "");
      const bDeadline = String(b?.metadata?.nextPaymentDateKey || "");
      if (aDeadline && aDeadline === bDeadline) {
        const codeCompare = String(b?.metadata?.policyholderCode || "").localeCompare(
          String(a?.metadata?.policyholderCode || ""),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
        if (codeCompare !== 0) return codeCompare;
      }
    }
    return notificationTime(b) - notificationTime(a);
  });
}

function createNotificationsController({
  Notification,
  Task,
  LeadEngagement,
  Prospect,
  Lead,
  Policyholder,
  AnnualPayment,
  Payment,
  ScheduledMeeting,
  LongLeave,
  Retirement,
  Product,
  Policy,
  mongoose,
  ensureTaskMissedNotificationsForUser,
  toValidObjectIdString,
  uniqueValidObjectIdStrings,
}) {
  const ensureTaskMissed =
    typeof ensureTaskMissedNotificationsForUser === "function"
      ? ensureTaskMissedNotificationsForUser
      : async () => {};
  const toValidId =
    typeof toValidObjectIdString === "function"
      ? toValidObjectIdString
      : (value) => {
          if (!value) return null;
          const raw = typeof value === "object" && value._id ? value._id : value;
          const id = String(raw).trim();
          return mongoose.isValidObjectId(id) ? id : null;
        };
  const uniqueValidIds =
    typeof uniqueValidObjectIdStrings === "function"
      ? uniqueValidObjectIdStrings
      : (values = []) => [...new Set(values.map((value) => toValidId(value)).filter(Boolean))];

  const orphanEndorsementAffectedRecords = (kind, record) => kind === "retirement"
    ? [...(record?.affectedProspects || [])]
    : [...(record?.affectedProspects || []), ...(record?.affectedPolicyholders || [])];

  const orphanEndorsementIsResolved = (kind, record) => {
    if (!record) return false;
    const affectedRecords = orphanEndorsementAffectedRecords(kind, record);
    return affectedRecords.every((item) => (
      item?.reassigned === true
      || String(item?.reassigned || "").toLowerCase() === "true"
      || Boolean(item?.reassignedAt)
      || Boolean(item?.reassignedToUserId)
      || Boolean(item?.reassignedToAgentId)
    ));
  };

  const syncOrphanEndorsementResolutions = async (uid) => {
    const resolutionsByNotificationId = new Map();
    if (!LongLeave || !Retirement) return resolutionsByNotificationId;
    const notifications = await Notification.find({
      assignedToUserId: uid,
      type: "ORPHANS_ENDORSEMENTS",
      softDeletedAt: null,
    }).select("_id entityType entityId metadata resolutionStatus resolvedAt createdAt").lean();
    if (!notifications.length) return resolutionsByNotificationId;

    const longLeaveIds = uniqueValidIds(notifications.flatMap((notification) => [
      notification.entityType === "LongLeave" ? notification.entityId : null,
      notification?.metadata?.longLeaveId,
    ]));
    const retirementIds = uniqueValidIds(notifications.flatMap((notification) => [
      notification.entityType === "Retirement" ? notification.entityId : null,
      notification?.metadata?.retirementId,
    ]));
    // Load all endorsement records so legacy notifications remain resolvable.
    // Older rows may contain a User id (rather than an Agent id) in metadata,
    // or may not contain a related-record id at all.
    const [longLeaves, retirements] = await Promise.all([
      LongLeave.find({}).select("agentId affectedProspects affectedPolicyholders createdAt updatedAt").lean(),
      Retirement.find({}).select("agentId affectedProspects affectedPolicyholders createdAt updatedAt").lean(),
    ]);
    const longLeaveMap = new Map(longLeaves.map((record) => [String(record._id), record]));
    const retirementMap = new Map(retirements.map((record) => [String(record._id), record]));
    const closestRecordForNotification = (records, notification) => {
      const agentId = String(notification?.metadata?.agentId || "");
      const candidates = records.filter((record) => agentId && String(record.agentId || "") === agentId);
      const notificationTime = new Date(notification.createdAt || 0).getTime();
      const eligibleRecords = candidates.length ? candidates : records;
      return eligibleRecords.sort((a, b) => (
        Math.abs(new Date(a.createdAt || 0).getTime() - notificationTime)
        - Math.abs(new Date(b.createdAt || 0).getTime() - notificationTime)
      ))[0] || null;
    };
    const writes = notifications.map((notification) => {
      const retirementId = toValidId(notification?.metadata?.retirementId)
        || (notification.entityType === "Retirement" ? toValidId(notification.entityId) : null);
      const longLeaveId = toValidId(notification?.metadata?.longLeaveId)
        || (notification.entityType === "LongLeave" ? toValidId(notification.entityId) : null);
      const kind = retirementId || notification?.metadata?.endorsementType === "retirement" ? "retirement" : "longLeave";
      const record = retirementId
        ? (retirementMap.get(retirementId) || closestRecordForNotification(retirements, notification))
        : kind === "retirement"
          ? closestRecordForNotification(retirements, notification)
          : (longLeaveMap.get(longLeaveId) || closestRecordForNotification(longLeaves, notification));
      const resolved = orphanEndorsementIsResolved(kind, record);
      if (!record) return null;
      const resolvedAt = resolved ? (record.updatedAt || new Date()) : null;
      resolutionsByNotificationId.set(String(notification._id), {
        resolutionStatus: resolved ? "Resolved" : "Unresolved",
        resolvedAt,
      });
      return {
        updateOne: {
          filter: { _id: notification._id },
          update: { $set: { resolutionStatus: resolved ? "Resolved" : "Unresolved", resolvedAt } },
        },
      };
    }).filter(Boolean);
    if (writes.length) await Notification.bulkWrite(writes, { ordered: false });
    return resolutionsByNotificationId;
  };

  const ensurePaymentReminders = async (uid) => {
    if (!Policyholder || !AnnualPayment || !Payment || !Product) return;

    const todayKey = dateKeyInTZ(new Date());
    const todayDay = dayNumberFromDateKey(todayKey);
    if (todayDay === null) return;

    const policyholders = await Policyholder.find({
      ...effectivePolicyholderOwnerFilter(uid),
      status: { $in: ["Active", "At Risk", "Lapsed", "Paid-Up"] },
    })
      .select("policyholderCode policyNumber productId leadEngagementId lastPaidDate nextPaymentDate status annualPaymentRecords")
      .sort({ nextPaymentDate: 1, policyholderCode: -1 })
      .lean();

    if (!policyholders.length) return;

    const annualPaymentIds = uniqueValidIds(
      policyholders.flatMap((policyholder) => (policyholder.annualPaymentRecords || []).map((record) => record?.annualPaymentId))
    );
    const leadEngagementIds = uniqueValidIds(policyholders.map((policyholder) => policyholder.leadEngagementId));
    const productIds = uniqueValidIds(policyholders.map((policyholder) => policyholder.productId));

    const [annualPayments, payments, products, engagements, policies] = await Promise.all([
      annualPaymentIds.length
        ? AnnualPayment.find({ _id: { $in: annualPaymentIds } })
            .select("leadEngagementId status paymentProgress annualPaymentPeriod frequencyOfPayment createdAt updatedAt")
            .lean()
        : [],
      annualPaymentIds.length
        ? Payment.find({ annualPaymentId: { $in: annualPaymentIds } })
            .select("annualPaymentId status recordPremiumPaymentTransfer uploadPremiumPaymentEor createdAt updatedAt")
            .lean()
        : [],
      productIds.length ? Product.find({ _id: { $in: productIds } }).select("productName").lean() : [],
      leadEngagementIds.length ? LeadEngagement.find({ _id: { $in: leadEngagementIds } }).select("leadId").lean() : [],
      Policy && leadEngagementIds.length
        ? Policy.find({ leadEngagementId: { $in: leadEngagementIds } })
            .sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 })
            .select("leadEngagementId recordCoverageDurationDetails")
            .lean()
        : [],
    ]);

    const annualPaymentById = new Map(annualPayments.map((annualPayment) => [String(annualPayment._id), annualPayment]));
    const paymentsByAnnualPaymentId = new Map();
    for (const payment of payments) {
      const key = String(payment?.annualPaymentId || "");
      if (!key) continue;
      if (!paymentsByAnnualPaymentId.has(key)) paymentsByAnnualPaymentId.set(key, []);
      paymentsByAnnualPaymentId.get(key).push(payment);
    }
    const productNameById = new Map(products.map((product) => [String(product._id), product.productName || "—"]));
    const engagementById = new Map(engagements.map((engagement) => [String(engagement._id), engagement]));
    const policyByLeadEngagementId = new Map();
    for (const policy of policies || []) {
      const key = String(policy?.leadEngagementId || "");
      if (key && !policyByLeadEngagementId.has(key)) policyByLeadEngagementId.set(key, policy);
    }

    const leadIds = uniqueValidIds(engagements.map((engagement) => engagement.leadId));
    const leads = leadIds.length ? await Lead.find({ _id: { $in: leadIds } }).select("prospectId").lean() : [];
    const leadById = new Map(leads.map((lead) => [String(lead._id), lead]));
    const prospectIds = uniqueValidIds(leads.map((lead) => lead.prospectId));
    const prospects = prospectIds.length
      ? await Prospect.find({ _id: { $in: prospectIds } }).select("firstName middleName lastName").lean()
      : [];
    const prospectById = new Map(prospects.map((prospect) => [String(prospect._id), prospect]));

    const writes = [];
    const policyholderWrites = [];
    const annualPaymentWrites = [];
    const lifecycleWrites = [];
    const paymentTrackingSoftDeleteWrites = [];

    const buildLifecycleNotification = ({ policyholder, prospect, policyName, nextStatus, previousStatus, isPaidUp, isMatured, paidUpDate, maturedDate }) => {
      let type = "";
      let title = "";
      if (nextStatus === "Paid-Up") {
        type = "POLICY_PAID_UP";
        title = "Policy paid up";
      } else if (nextStatus === "Matured" && !["Paid-Up", "Matured"].includes(previousStatus) && isPaidUp && isMatured) {
        type = "POLICY_PAID_UP_MATURED";
        title = "Policy paid up and matured";
      } else if (nextStatus === "Matured") {
        type = "POLICY_MATURED";
        title = "Policy matured";
      }
      if (!type) return null;
      const policyholderName = fullName(prospect) || "—";
      const policyholderCode = policyholder.policyholderCode || "—";
      const policyNumber = policyholder.policyNumber || "—";
      const actionMessage = buildLifecycleActionMessage({ title, type, paidUpDate, maturedDate });
      return {
        updateOne: {
          filter: { assignedToUserId: uid, dedupeKey: `${type}:${policyholder._id}` },
          update: {
            $set: {
              type,
              title,
              message: `${actionMessage} Policyholder Code: ${policyholderCode}. Policyholder Name: ${policyholderName}. Policy Name: ${policyName}. Policy Number: ${policyNumber}.`,
              entityType: "Policyholder",
              entityId: policyholder._id,
              metadata: {
                policyholderId: String(policyholder._id),
                policyholderCode,
                policyholderName,
                policyName,
                policyNumber,
                previousStatus,
                nextStatus,
                fullyPaidDate: paidUpDate || null,
                maturedDate: maturedDate || null,
              },
              softDeletedAt: null,
              softDeleteReason: "",
              softDeletedByUserId: null,
            },
            $setOnInsert: {
              assignedToUserId: uid,
              dedupeKey: `${type}:${policyholder._id}`,
              status: "Unread",
              readAt: null,
            },
          },
          upsert: true,
        },
      };
    };

    for (const policyholder of policyholders) {
      const linkedAnnualPaymentIds = (policyholder.annualPaymentRecords || [])
        .map((record) => toValidId(record?.annualPaymentId))
        .filter(Boolean);
      if (!linkedAnnualPaymentIds.length) continue;

      const linkedAnnualPayments = linkedAnnualPaymentIds.map((id) => annualPaymentById.get(id)).filter(Boolean);
      const currentStatus = String(policyholder.status || "");
      const policy = policyByLeadEngagementId.get(String(policyholder.leadEngagementId || ""));
      const coverageReached = isReachedByToday(deriveCoverageEndDate(policy), todayDay);
      const paymentTermComplete = linkedAnnualPayments.length > 0
        && !linkedAnnualPayments.some((record) => ["Not Started", "Ongoing"].includes(String(record?.status || "")))
        && !policyholder.nextPaymentDate;
      const nextLifecycleStatus = coverageReached ? "Matured" : (paymentTermComplete ? "Paid-Up" : currentStatus);
      if (["Paid-Up", "Matured"].includes(nextLifecycleStatus)) {
        if (currentStatus !== nextLifecycleStatus || policyholder.nextPaymentDate) {
          policyholderWrites.push({
            updateOne: {
              filter: { _id: policyholder._id, ...effectivePolicyholderOwnerFilter(uid) },
              update: { $set: { status: nextLifecycleStatus, nextPaymentDate: null } },
            },
          });
          if (nextLifecycleStatus === "Matured") {
            annualPaymentWrites.push({
              updateMany: {
                filter: { leadEngagementId: policyholder.leadEngagementId, status: { $in: ["Not Started", "Ongoing"] } },
                update: { $set: { status: "No Longer Pursued" } },
              },
            });
          }
          const engagement = engagementById.get(String(policyholder.leadEngagementId || ""));
          const lead = engagement?.leadId ? leadById.get(String(engagement.leadId)) : null;
          const prospect = lead?.prospectId ? prospectById.get(String(lead.prospectId)) : null;
          const lifecycleNotification = buildLifecycleNotification({
            policyholder,
            prospect,
            policyName: productNameById.get(String(policyholder.productId || "")) || "—",
            nextStatus: nextLifecycleStatus,
            previousStatus: currentStatus,
            isPaidUp: paymentTermComplete,
            isMatured: coverageReached,
            paidUpDate: policyholder.lastPaidDate || null,
            maturedDate: deriveCoverageEndDate(policy),
          });
          if (lifecycleNotification) lifecycleWrites.push(lifecycleNotification);
        }
        paymentTrackingSoftDeleteWrites.push({
          updateMany: {
            filter: {
              assignedToUserId: uid,
              entityType: "Policyholder",
              entityId: policyholder._id,
              type: { $in: PAYMENT_NOTIFICATION_TYPES },
              softDeletedAt: null,
            },
            update: {
              $set: {
                softDeletedAt: new Date(),
                softDeleteReason: `Policy became ${nextLifecycleStatus}.`,
                softDeletedByUserId: uid,
              },
            },
          },
        });
        continue;
      }

      if (!policyholder.nextPaymentDate && ["At Risk", "Lapsed"].includes(String(policyholder.status || ""))) {
        policyholderWrites.push({
          updateOne: {
            filter: { _id: policyholder._id, ...effectivePolicyholderOwnerFilter(uid), status: { $in: ["At Risk", "Lapsed"] } },
            update: { $set: { status: "Active" } },
          },
        });
        continue;
      }

      const linkedPayments = linkedAnnualPaymentIds.flatMap((id) => paymentsByAnnualPaymentId.get(id) || []);
      const waitingForFinalEorProcessing = linkedAnnualPayments.some((record) => {
        if (!record || !["Not Started", "Ongoing"].includes(String(record.status || ""))) return false;
        const annualPaymentsForRecord = paymentsByAnnualPaymentId.get(String(record._id || "")) || [];
        const expectedCount = annualPaymentTotalCountForFrequency(record.frequencyOfPayment);
        const coveredCount = annualPaymentsForRecord.reduce((sum, payment) => sum + paymentCoveredCount(payment), 0);
        const processedCount = annualPaymentsForRecord.reduce((sum, payment) => sum + paymentProcessedCoveredCount(payment), 0);
        return expectedCount > 0 && coveredCount >= expectedCount && processedCount < expectedCount;
      });
      if (waitingForFinalEorProcessing) {
        if (["At Risk", "Lapsed"].includes(String(policyholder.status || "")) || policyholder.nextPaymentDate) {
          policyholderWrites.push({
            updateOne: {
              filter: { _id: policyholder._id, ...effectivePolicyholderOwnerFilter(uid) },
              update: { $set: { status: "Active", nextPaymentDate: null } },
            },
          });
        }
        continue;
      }

      const pendingPayment = linkedPayments
        .filter((payment) => paymentHasTransfer(payment) && !paymentHasEor(payment) && payment?.recordPremiumPaymentTransfer?.eorReminderEnabled === true)
        .sort((a, b) => new Date(b?.recordPremiumPaymentTransfer?.paymentDate || b?.createdAt || 0) - new Date(a?.recordPremiumPaymentTransfer?.paymentDate || a?.createdAt || 0))[0];

      let annualPayment = null;
      let annualPaymentId = "";
      let annualPayments = [];
      let paymentDateKey = dateKeyInTZ(policyholder.nextPaymentDate);
      let notificationType = "";
      let title = "";
      let actionMessage = "";
      let paymentId = null;
      const paymentNotificationBaseAt = new Date();

      if (pendingPayment) {
        annualPaymentId = String(pendingPayment.annualPaymentId || "");
        annualPayment = annualPaymentById.get(annualPaymentId);
        if (!annualPayment) continue;
        annualPayments = paymentsByAnnualPaymentId.get(annualPaymentId) || [];
        paymentDateKey = paymentDateKey || dateKeyInTZ(pendingPayment?.recordPremiumPaymentTransfer?.paymentDate) || todayKey;
        if (["At Risk", "Lapsed"].includes(String(policyholder.status || ""))) {
          policyholderWrites.push({
            updateOne: {
              filter: { _id: policyholder._id, ...effectivePolicyholderOwnerFilter(uid), status: { $in: ["At Risk", "Lapsed"] } },
              update: { $set: { status: "Active" } },
            },
          });
        }
        notificationType = "PAYMENT_EOR_REMINDER";
        title = "Upload premium payment eOR";
        actionMessage = "The premium payment transfer has been recorded, but the eOR has not been uploaded yet.";
        paymentId = pendingPayment._id;
      } else {
        const paymentDay = dayNumberFromDateKey(paymentDateKey);
        if (paymentDay === null) continue;

        const daysUntilPayment = paymentDay - todayDay;
        if (daysUntilPayment > 7) continue;
        if (String(policyholder.status || "") === "Lapsed" && daysUntilPayment > -32) continue;

        annualPayment = linkedAnnualPaymentIds
          .map((id) => annualPaymentById.get(id))
          .filter(Boolean)
          .filter((record) => ["Not Started", "Ongoing"].includes(String(record?.status || "")))
          .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0))[0]
          || linkedAnnualPaymentIds.map((id) => annualPaymentById.get(id)).filter(Boolean)[0];
        if (!annualPayment) continue;

        annualPaymentId = String(annualPayment._id);
        annualPayments = paymentsByAnnualPaymentId.get(annualPaymentId) || [];
        const paymentAlreadyProcessedForDate = annualPayments.some((payment) => {
          const loggedPaymentDateKey = dateKeyInTZ(
            payment?.recordPremiumPaymentTransfer?.paymentPeriod?.startDate
              || payment?.recordPremiumPaymentTransfer?.paymentDate
          );
          return loggedPaymentDateKey === paymentDateKey && paymentHasEor(payment);
        });
        const transferAlreadyLoggedForDate = annualPayments.some((payment) => {
          const loggedPaymentDateKey = dateKeyInTZ(
            payment?.recordPremiumPaymentTransfer?.paymentPeriod?.startDate
              || payment?.recordPremiumPaymentTransfer?.paymentDate
          );
          return loggedPaymentDateKey === paymentDateKey && paymentHasTransfer(payment);
        });
        if (paymentAlreadyProcessedForDate || transferAlreadyLoggedForDate) {
          if (["At Risk", "Lapsed"].includes(String(policyholder.status || ""))) {
            policyholderWrites.push({
              updateOne: {
                filter: { _id: policyholder._id, ...effectivePolicyholderOwnerFilter(uid), status: { $in: ["At Risk", "Lapsed"] } },
                update: { $set: { status: "Active" } },
              },
            });
          }
          continue;
        }

        if (daysUntilPayment <= -32) {
          const engagement = engagementById.get(String(policyholder.leadEngagementId || ""));
          const lead = engagement?.leadId ? leadById.get(String(engagement.leadId)) : null;
          const prospect = lead?.prospectId ? prospectById.get(String(lead.prospectId)) : null;
          const policyholderName = fullName(prospect) || "—";
          const policyName = productNameById.get(String(policyholder.productId || "")) || "—";
          const policyNumber = policyholder.policyNumber || "—";
          const policyholderCode = policyholder.policyholderCode || "—";
          const lapseDedupeKey = `POLICY_LAPSED:${policyholder._id}:${annualPayment._id}:${paymentDateKey}`;
          const lapseMessage = `This policyholder is marked as lapsed now due to prolonged payment transfer inactivity. Policyholder Code: ${policyholderCode}. Policyholder Name: ${policyholderName}. Policy Name: ${policyName}. Policy Number: ${policyNumber}.`;
          const notificationTimestamp = paymentNotificationTimestamp(paymentNotificationBaseAt, "POLICY_LAPSED");
          policyholderWrites.push({
            updateOne: {
              filter: { _id: policyholder._id, ...effectivePolicyholderOwnerFilter(uid), status: { $ne: "Lapsed" } },
              update: { $set: { status: "Lapsed" } },
            },
          });
          writes.push({
            updateOne: {
              filter: { assignedToUserId: uid, dedupeKey: lapseDedupeKey },
              update: {
                $set: {
                  type: "POLICY_LAPSED",
                  title: "Policy lapsed due to missed premium payment",
                  message: lapseMessage,
                  entityType: "Policyholder",
                  entityId: policyholder._id,
                  updatedAt: notificationTimestamp,
                  metadata: {
                    policyholderId: String(policyholder._id),
                    annualPaymentId: "",
                    paymentId: "",
                    nextPaymentDate: policyholder.nextPaymentDate,
                    nextPaymentDateKey: paymentDateKey,
                    policyholderCode,
                    reminderDateKey: todayKey,
                  },
                },
                $setOnInsert: {
                  assignedToUserId: uid,
                  dedupeKey: lapseDedupeKey,
                  status: "Unread",
                  readAt: null,
                  createdAt: notificationTimestamp,
                },
              },
              upsert: true,
            },
          });
          continue;
        }

        if (daysUntilPayment < 0 && String(policyholder.status || "") !== "At Risk") {
          policyholderWrites.push({
            updateOne: {
              filter: { _id: policyholder._id, ...effectivePolicyholderOwnerFilter(uid), status: { $ne: "At Risk" } },
              update: { $set: { status: "At Risk" } },
            },
          });
        }

        if (daysUntilPayment === -1) {
          const engagement = engagementById.get(String(policyholder.leadEngagementId || ""));
          const lead = engagement?.leadId ? leadById.get(String(engagement.leadId)) : null;
          const prospect = lead?.prospectId ? prospectById.get(String(lead.prospectId)) : null;
          const policyholderName = fullName(prospect) || "—";
          const policyName = productNameById.get(String(policyholder.productId || "")) || "—";
          const policyNumber = policyholder.policyNumber || "—";
          const policyholderCode = policyholder.policyholderCode || "—";
          const missedMessage = `This policy is now at risk of being lapsed due to missed premium payment transfer on or before ${formatDateInManila(policyholder.nextPaymentDate)}. Policyholder Code: ${policyholderCode}. Policyholder Name: ${policyholderName}. Policy Name: ${policyName}. Policy Number: ${policyNumber}.`;
          const notificationTimestamp = paymentNotificationTimestamp(paymentNotificationBaseAt, "PAYMENT_MISSED_TRANSFER");
          writes.push({
            updateOne: {
              filter: { assignedToUserId: uid, dedupeKey: `PAYMENT_MISSED_TRANSFER:${policyholder._id}:${annualPayment._id}:${paymentDateKey}` },
              update: {
                $set: {
                  type: "PAYMENT_MISSED_TRANSFER",
                  title: "Policy at risk due to missed premium payment",
                  message: missedMessage,
                  entityType: "Policyholder",
                  entityId: policyholder._id,
                  updatedAt: notificationTimestamp,
                  metadata: {
                    policyholderId: String(policyholder._id),
                    annualPaymentId: "",
                    paymentId: "",
                    nextPaymentDate: policyholder.nextPaymentDate,
                    nextPaymentDateKey: paymentDateKey,
                    policyholderCode,
                    reminderDateKey: todayKey,
                  },
                },
                $setOnInsert: {
                  assignedToUserId: uid,
                  dedupeKey: `PAYMENT_MISSED_TRANSFER:${policyholder._id}:${annualPayment._id}:${paymentDateKey}`,
                  status: "Unread",
                  readAt: null,
                  createdAt: notificationTimestamp,
                },
              },
              upsert: true,
            },
          });
        }

        notificationType = "PAYMENT_TRANSFER_REMINDER";
        title = "Record premium payment transfer";
        actionMessage = daysUntilPayment < 0
          ? `The premium payment due was ${formatDateInManila(policyholder.nextPaymentDate)}.`
          : `The premium payment due is ${formatDateInManila(policyholder.nextPaymentDate)}.`;
      }

      const engagement = engagementById.get(String(policyholder.leadEngagementId || ""));
      const lead = engagement?.leadId ? leadById.get(String(engagement.leadId)) : null;
      const prospect = lead?.prospectId ? prospectById.get(String(lead.prospectId)) : null;
      const policyholderName = fullName(prospect) || "—";
      const policyName = productNameById.get(String(policyholder.productId || "")) || "—";
      const policyNumber = policyholder.policyNumber || "—";
      const policyholderCode = policyholder.policyholderCode || "—";
      const message = `${actionMessage} Policyholder Code: ${policyholderCode}. Policyholder Name: ${policyholderName}. Policy Name: ${policyName}. Policy Number: ${policyNumber}.`;
      const dedupeKey = `PAYMENT_REMINDER:${policyholder._id}:${annualPaymentId}:${todayKey}`;
      const notificationTimestamp = paymentNotificationTimestamp(paymentNotificationBaseAt, notificationType);

      writes.push({
        updateOne: {
          filter: { assignedToUserId: uid, dedupeKey },
          update: {
            $set: {
              type: notificationType,
              title,
              message,
              entityType: "Policyholder",
              entityId: policyholder._id,
              updatedAt: notificationTimestamp,
              metadata: {
                policyholderId: String(policyholder._id),
                annualPaymentId,
                paymentId: paymentId ? String(paymentId) : "",
                nextPaymentDate: policyholder.nextPaymentDate,
                nextPaymentDateKey: paymentDateKey,
                policyholderCode,
                reminderDateKey: todayKey,
              },
            },
            $setOnInsert: {
              assignedToUserId: uid,
              dedupeKey,
              status: "Unread",
              readAt: null,
              createdAt: notificationTimestamp,
            },
          },
          upsert: true,
        },
      });
    }

    await Promise.all([
      policyholderWrites.length ? Policyholder.bulkWrite(policyholderWrites, { ordered: false }) : Promise.resolve(),
      annualPaymentWrites.length ? AnnualPayment.bulkWrite(annualPaymentWrites, { ordered: false }) : Promise.resolve(),
      paymentTrackingSoftDeleteWrites.length ? Notification.bulkWrite(paymentTrackingSoftDeleteWrites, { ordered: false }) : Promise.resolve(),
      lifecycleWrites.length ? Notification.bulkWrite(lifecycleWrites, { ordered: false }) : Promise.resolve(),
      writes.length ? Notification.bulkWrite(writes, { ordered: false, timestamps: false }) : Promise.resolve(),
    ]);
  };

  const listNotifications = async (req, res) => {
    try {
      const { userId, status, type, entityType, includeRefs } = req.query;

      if (!userId) return res.status(400).json({ message: "Missing userId." });
      if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

      const uid = new mongoose.Types.ObjectId(userId);
      await Promise.all([ensureTaskMissed(uid), ensurePaymentReminders(uid)]);
      // Keep orphan resolution independent from display priority. Returning the
      // freshly calculated values also guarantees legacy notifications use the
      // current reassignment progress in this response, even before persistence
      // is observed by a subsequent database read.
      const orphanResolutions = await syncOrphanEndorsementResolutions(uid);

      const query = { assignedToUserId: uid, softDeletedAt: null };

      if (entityType) {
        const e = String(entityType).trim();
        if (!NOTIFICATION_ENTITY_TYPES.includes(e)) {
          return res.status(400).json({ message: `Invalid entityType '${entityType}'.` });
        }
        query.entityType = e;
      }

      if (status) {
        const s = String(status).toLowerCase() === "read" ? "Read" : "Unread";
        query.status = s;
      }

      if (type) {
        const t = String(type).toUpperCase().trim();
        if (!NOTIFICATION_TYPES.includes(t)) {
          return res.status(400).json({ message: `Invalid notification type '${type}'.` });
        }
        query.type = t;
      }

      let notifs = await Notification.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .select("assignedToUserId type title message status readAt resolutionStatus resolvedAt entityType entityId metadata createdAt updatedAt")
        .lean();

      if (String(includeRefs) === "1" && notifs.length) {
        const taskIds = [
          ...new Set(
            notifs
              .filter((n) => n.entityType === "Task" && n.entityId)
              .map((n) => toValidId(n.entityId))
              .filter(Boolean)
          ),
        ];

        const tasks = taskIds.length
              ? await Task.find({ _id: { $in: taskIds } }).select("prospectId leadEngagementId type title dueAt status completedAt").lean()
          : [];

        const taskMap = new Map(tasks.map((t) => [String(t._id), t]));
        const taskEngagementIds = uniqueValidIds(tasks.map((task) => task.leadEngagementId));
        const completedMeetings = ScheduledMeeting && taskEngagementIds.length
          ? await ScheduledMeeting.find({ leadEngagementId: { $in: taskEngagementIds }, status: "Completed" })
            .select("leadEngagementId meetingType endAt updatedAt")
            .lean()
          : [];
        const taskHasCompletedMeeting = (task) => {
          if (!task?.leadEngagementId || !task?.dueAt) return false;
          const title = String(task.title || "").toLowerCase();
          const expectedMeetingType = title.includes("needs assessment")
            ? "Needs Assessment"
            : title.includes("proposal")
              ? "Proposal Presentation"
              : title.includes("application")
                ? "Application Submission"
                : "";
          if (!expectedMeetingType) return false;
          const taskDueAt = new Date(task.dueAt).getTime();
          return completedMeetings.some((meeting) => (
            String(meeting.leadEngagementId) === String(task.leadEngagementId)
            && meeting.meetingType === expectedMeetingType
            && Math.abs(taskDueAt - new Date(meeting.endAt).getTime()) <= (20 * 60 * 1000)
          ));
        };

        const engagementIds = uniqueValidIds(tasks.map((t) => t.leadEngagementId));

        const engagementToLeadId = new Map();
        if (engagementIds.length) {
          const engagements = await LeadEngagement.find({ _id: { $in: engagementIds } }).select("leadId").lean();

          for (const e of engagements) {
            if (e.leadId) engagementToLeadId.set(String(e._id), String(e.leadId));
          }
        }

        const prospectIds = uniqueValidIds([
          ...tasks.map((t) => t.prospectId),
          ...notifs.map((n) => n?.metadata?.prospectId),
          ...notifs.filter((n) => n.entityType === "Prospect").map((n) => n.entityId),
        ]);
        const prospects = prospectIds.length
          ? await Prospect.find({ _id: { $in: prospectIds } }).select("firstName middleName lastName assignedToUserId reassignedToUserId").lean()
          : [];
        const prospectMap = new Map(
          prospects.map((p) => {
            const fullName = `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName}`.trim();
            return [String(p._id), {
              fullName,
              reassignedToUserId: p.reassignedToUserId ? String(p.reassignedToUserId) : "",
              assignedToUserId: p.assignedToUserId ? String(p.assignedToUserId) : "",
            }];
          })
        );

        const leadIds = uniqueValidIds([
          ...tasks.map((t) => (t.leadEngagementId ? engagementToLeadId.get(String(t.leadEngagementId)) : null)),
          ...notifs.map((n) => n?.metadata?.leadId),
        ]);
        let leadIdToCode = new Map();
        if (leadIds.length) {
          const leads = await Lead.find({ _id: { $in: leadIds } }).select("leadCode").lean();
          leadIdToCode = new Map(leads.map((l) => [String(l._id), l.leadCode]));
        }

        notifs = notifs.map((n) => {
          const t = n.entityType === "Task" ? taskMap.get(String(n.entityId)) : null;
          const metadataProspectId = toValidId(n?.metadata?.prospectId);
          const prospectId = t?.prospectId ? String(t.prospectId) : metadataProspectId;

          const engagementIdStr = t?.leadEngagementId ? String(t.leadEngagementId) : null;
          const metadataLeadId = toValidId(n?.metadata?.leadId);
          const leadId = engagementIdStr ? engagementToLeadId.get(engagementIdStr) || metadataLeadId : metadataLeadId;
          const prospectRef = prospectId ? prospectMap.get(prospectId) : null;
          const reassignedToViewer = prospectRef?.reassignedToUserId && prospectRef.reassignedToUserId === String(uid);
          const transferredAwayForViewer = Boolean(prospectRef?.reassignedToUserId && !reassignedToViewer);

          const taskResolved = n.entityType === "Task" && (t?.status === "Done" || taskHasCompletedMeeting(t));
          return {
            ...n,
            resolutionStatus: n.entityType === "Task"
              ? (taskResolved ? "Resolved" : "Unresolved")
              : defaultResolutionStatus(n),
            resolvedAt: taskResolved
              ? (t.completedAt || n.resolvedAt || null)
              : (n.resolvedAt || null),
            prospectId,
            leadId,
            prospectName: prospectRef?.fullName || (prospectId ? "—" : "—"),
            leadCode: leadId ? leadIdToCode.get(String(leadId)) || "—" : "—",
            transferredAwayForViewer,
          };
        });
      }

      notifs = notifs.map((notification) => {
        const orphanResolution = notification.type === "ORPHANS_ENDORSEMENTS"
          ? orphanResolutions.get(String(notification._id))
          : null;
        const normalizedNotification = orphanResolution
          ? { ...notification, ...orphanResolution }
          : notification;
        return {
          ...normalizedNotification,
          resolutionStatus: defaultResolutionStatus(normalizedNotification),
          resolvedAt: normalizedNotification.resolvedAt || null,
        };
      });

      return res.json({ notifications: sortNotificationsForDisplay(notifs.map(normalizeNotificationForDisplay)) });
    } catch (err) {
      console.error("List notifications error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  };

  const markNotificationRead = async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      if (!userId) return res.status(400).json({ message: "Missing userId." });
      if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid notification id." });

      const uid = new mongoose.Types.ObjectId(userId);

      const notif = await Notification.findOne({ _id: id, assignedToUserId: uid, softDeletedAt: null }).lean();
      if (!notif) return res.status(404).json({ message: "Notification not found." });

      if (notif.status === "Read") {
        return res.json({ ok: true, status: "Read" });
      }

      await Notification.updateOne(
        { _id: id, assignedToUserId: uid, softDeletedAt: null },
        { $set: { status: "Read", readAt: new Date() } }
      );

      return res.json({ ok: true, status: "Read" });
    } catch (err) {
      console.error("Mark read error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  };

  const markAllNotificationsRead = async (req, res) => {
    try {
      const { userId, entityType, type } = req.query;

      if (!userId) return res.status(400).json({ message: "Missing userId." });
      if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

      const uid = new mongoose.Types.ObjectId(userId);
      await Promise.all([ensureTaskMissed(uid), ensurePaymentReminders(uid)]);

      const query = {
        assignedToUserId: uid,
        status: "Unread",
        softDeletedAt: null,
      };

      const e = entityType ? String(entityType).trim() : "";
      if (e) {
        if (!NOTIFICATION_ENTITY_TYPES.includes(e)) return res.status(400).json({ message: "Invalid entityType." });
        query.entityType = e;
      }

      if (type) {
        const t = String(type).toUpperCase().trim();
        if (!NOTIFICATION_TYPES.includes(t)) {
          return res.status(400).json({ message: `Invalid notification type '${type}'.` });
        }
        query.type = t;
      }

      const result = await Notification.updateMany(query, {
        $set: { status: "Read", readAt: new Date() },
      });

      return res.json({ ok: true, modifiedCount: Number(result?.modifiedCount || 0) });
    } catch (err) {
      console.error("Mark all read error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  };

  const getUnreadCount = async (req, res) => {
    try {
      const { userId, entityType, type } = req.query;

      if (!userId) return res.status(400).json({ message: "Missing userId." });
      if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

      const uid = new mongoose.Types.ObjectId(userId);
      await Promise.all([ensureTaskMissed(uid), ensurePaymentReminders(uid)]);

      const q = { assignedToUserId: uid, status: "Unread", softDeletedAt: null };

      if (entityType) {
        const e = String(entityType).trim();
        if (!NOTIFICATION_ENTITY_TYPES.includes(e)) return res.status(400).json({ message: "Invalid entityType." });
        q.entityType = e;
      }

      if (type) {
        const t = String(type).toUpperCase().trim();
        if (!NOTIFICATION_TYPES.includes(t)) {
          return res.status(400).json({ message: `Invalid notification type '${type}'.` });
        }
        q.type = t;
      }

      const count = await Notification.countDocuments(q);
      return res.json({ unreadCount: count });
    } catch (err) {
      console.error("Unread count error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  };

  const getCounts = async (req, res) => {
    try {
      const { userId, entityType, type } = req.query;

      if (!userId) return res.status(400).json({ message: "Missing userId." });
      if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

      const uid = new mongoose.Types.ObjectId(userId);
      await Promise.all([ensureTaskMissed(uid), ensurePaymentReminders(uid)]);

      const qBase = { assignedToUserId: uid, softDeletedAt: null };

      const e = entityType ? String(entityType).trim() : "";
      if (e) {
        if (!NOTIFICATION_ENTITY_TYPES.includes(e)) return res.status(400).json({ message: "Invalid entityType." });
        qBase.entityType = e;
      }

      if (type) {
        const t = String(type).toUpperCase().trim();
        if (!NOTIFICATION_TYPES.includes(t)) {
          return res.status(400).json({ message: `Invalid notification type '${type}'.` });
        }
        qBase.type = t;
      }

      const [unread, read] = await Promise.all([
        Notification.countDocuments({ ...qBase, status: "Unread" }),
        Notification.countDocuments({ ...qBase, status: "Read" }),
      ]);

      return res.json({ unread, read });
    } catch (err) {
      console.error("Counts error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  };

  return {
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    getCounts,
  };
}

module.exports = {
  createNotificationsController,
};