const PAYMENT_NOTIFICATION_TYPES = ["PAYMENT_TRANSFER_REMINDER", "PAYMENT_EOR_REMINDER"];
const TASK_NOTIFICATION_TYPES = ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED"];
const NOTIFICATION_TYPES = [...TASK_NOTIFICATION_TYPES, ...PAYMENT_NOTIFICATION_TYPES];
const NOTIFICATION_ENTITY_TYPES = ["Task", "Policyholder"];

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

function createNotificationsController({
  Notification,
  Task,
  LeadEngagement,
  Prospect,
  Lead,
  Policyholder,
  AnnualPayment,
  Payment,
  Product,
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

  const ensurePaymentReminders = async (uid) => {
    if (!Policyholder || !AnnualPayment || !Payment || !Product) return;

    const todayKey = dateKeyInTZ(new Date());
    const todayDay = dayNumberFromDateKey(todayKey);
    if (todayDay === null) return;

    const policyholders = await Policyholder.find({
      assignedToUserId: uid,
      status: "Active",
      nextPaymentDate: { $ne: null },
    })
      .select("policyholderCode policyNumber productId leadEngagementId nextPaymentDate annualPaymentRecords")
      .lean();

    if (!policyholders.length) return;

    const annualPaymentIds = uniqueValidIds(
      policyholders.flatMap((policyholder) => (policyholder.annualPaymentRecords || []).map((record) => record?.annualPaymentId))
    );
    const leadEngagementIds = uniqueValidIds(policyholders.map((policyholder) => policyholder.leadEngagementId));
    const productIds = uniqueValidIds(policyholders.map((policyholder) => policyholder.productId));

    const [annualPayments, payments, products, engagements] = await Promise.all([
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

    const leadIds = uniqueValidIds(engagements.map((engagement) => engagement.leadId));
    const leads = leadIds.length ? await Lead.find({ _id: { $in: leadIds } }).select("prospectId").lean() : [];
    const leadById = new Map(leads.map((lead) => [String(lead._id), lead]));
    const prospectIds = uniqueValidIds(leads.map((lead) => lead.prospectId));
    const prospects = prospectIds.length
      ? await Prospect.find({ _id: { $in: prospectIds } }).select("firstName middleName lastName").lean()
      : [];
    const prospectById = new Map(prospects.map((prospect) => [String(prospect._id), prospect]));

    const writes = [];

    for (const policyholder of policyholders) {
      const paymentDateKey = dateKeyInTZ(policyholder.nextPaymentDate);
      const paymentDay = dayNumberFromDateKey(paymentDateKey);
      if (paymentDay === null) continue;

      const daysUntilPayment = paymentDay - todayDay;
      if (daysUntilPayment > 7) continue;

      const linkedAnnualPaymentIds = (policyholder.annualPaymentRecords || [])
        .map((record) => toValidId(record?.annualPaymentId))
        .filter(Boolean);
      const annualPayment = linkedAnnualPaymentIds
        .map((id) => annualPaymentById.get(id))
        .filter(Boolean)
        .filter((record) => ["Not Started", "Ongoing"].includes(String(record?.status || "")))
        .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0))[0]
        || linkedAnnualPaymentIds.map((id) => annualPaymentById.get(id)).filter(Boolean)[0];
      if (!annualPayment) continue;

      const annualPaymentId = String(annualPayment._id);
      const annualPayments = paymentsByAnnualPaymentId.get(annualPaymentId) || [];
      const pendingPayment = annualPayments
        .filter((payment) => paymentHasTransfer(payment) && !paymentHasEor(payment))
        .sort((a, b) => new Date(b?.recordPremiumPaymentTransfer?.paymentDate || b?.createdAt || 0) - new Date(a?.recordPremiumPaymentTransfer?.paymentDate || a?.createdAt || 0))[0];

      let notificationType = "";
      let title = "";
      let actionMessage = "";
      let paymentId = null;

      if (pendingPayment) {
        notificationType = "PAYMENT_EOR_REMINDER";
        title = "Upload premium payment eOR";
        actionMessage = "The premium payment transfer has been recorded, but the eOR has not been uploaded yet. Please upload the premium payment eOR.";
        paymentId = pendingPayment._id;
      } else if (daysUntilPayment >= 0) {
        const paymentAlreadyProcessedForDate = annualPayments.some((payment) => {
          const loggedPaymentDateKey = dateKeyInTZ(payment?.recordPremiumPaymentTransfer?.paymentDate);
          return loggedPaymentDateKey === paymentDateKey && paymentHasEor(payment);
        });
        const transferAlreadyLoggedForDate = annualPayments.some((payment) => {
          const loggedPaymentDateKey = dateKeyInTZ(payment?.recordPremiumPaymentTransfer?.paymentDate);
          return loggedPaymentDateKey === paymentDateKey && paymentHasTransfer(payment);
        });
        if (paymentAlreadyProcessedForDate || transferAlreadyLoggedForDate) continue;
        notificationType = "PAYMENT_TRANSFER_REMINDER";
        title = "Record premium payment transfer";
        actionMessage = `The premium payment deadline is ${formatDateInManila(policyholder.nextPaymentDate)}. Please record the premium payment transfer details.`;
      } else {
        continue;
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
              metadata: {
                policyholderId: String(policyholder._id),
                annualPaymentId,
                paymentId: paymentId ? String(paymentId) : "",
                nextPaymentDate: policyholder.nextPaymentDate,
                reminderDateKey: todayKey,
              },
            },
            $setOnInsert: {
              assignedToUserId: uid,
              dedupeKey,
              status: "Unread",
              readAt: null,
            },
          },
          upsert: true,
        },
      });
    }

    if (writes.length) {
      await Notification.bulkWrite(writes, { ordered: false });
    }
  };

  const listNotifications = async (req, res) => {
    try {
      const { userId, status, type, entityType, includeRefs } = req.query;

      if (!userId) return res.status(400).json({ message: "Missing userId." });
      if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

      const uid = new mongoose.Types.ObjectId(userId);
      await Promise.all([ensureTaskMissed(uid), ensurePaymentReminders(uid)]);

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
        .select("assignedToUserId type title message status readAt entityType entityId metadata createdAt updatedAt")
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
          ? await Task.find({ _id: { $in: taskIds } }).select("prospectId leadEngagementId type").lean()
          : [];

        const taskMap = new Map(tasks.map((t) => [String(t._id), t]));

        const engagementIds = uniqueValidIds(tasks.map((t) => t.leadEngagementId));

        const engagementToLeadId = new Map();
        if (engagementIds.length) {
          const engagements = await LeadEngagement.find({ _id: { $in: engagementIds } }).select("leadId").lean();

          for (const e of engagements) {
            if (e.leadId) engagementToLeadId.set(String(e._id), String(e.leadId));
          }
        }

        const prospectIds = uniqueValidIds(tasks.map((t) => t.prospectId));
        const prospects = prospectIds.length
          ? await Prospect.find({ _id: { $in: prospectIds } }).select("firstName middleName lastName").lean()
          : [];
        const prospectMap = new Map(
          prospects.map((p) => {
            const fullName = `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName}`.trim();
            return [String(p._id), fullName];
          })
        );

        const leadIds = uniqueValidIds(
          tasks.map((t) => (t.leadEngagementId ? engagementToLeadId.get(String(t.leadEngagementId)) : null))
        );
        let leadIdToCode = new Map();
        if (leadIds.length) {
          const leads = await Lead.find({ _id: { $in: leadIds } }).select("leadCode").lean();
          leadIdToCode = new Map(leads.map((l) => [String(l._id), l.leadCode]));
        }

        notifs = notifs.map((n) => {
          const t = n.entityType === "Task" ? taskMap.get(String(n.entityId)) : null;
          const prospectId = t?.prospectId ? String(t.prospectId) : null;

          const engagementIdStr = t?.leadEngagementId ? String(t.leadEngagementId) : null;
          const leadId = engagementIdStr ? engagementToLeadId.get(engagementIdStr) || null : null;

          return {
            ...n,
            prospectId,
            leadId,
            prospectName: prospectId ? prospectMap.get(prospectId) || "—" : "—",
            leadCode: leadId ? leadIdToCode.get(String(leadId)) || "—" : "—",
          };
        });
      }

      return res.json({ notifications: notifs });
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