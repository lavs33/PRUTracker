function createNotificationsController({
  Notification,
  Task,
  LeadEngagement,
  Prospect,
  Lead,
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

  const listNotifications = async (req, res) => {
    try {
      const { userId, status, type, entityType, includeRefs } = req.query;

      if (!userId) return res.status(400).json({ message: "Missing userId." });
      if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

      const uid = new mongoose.Types.ObjectId(userId);
      await ensureTaskMissed(uid);

      const query = { assignedToUserId: uid };

      if (entityType) {
        const e = String(entityType).trim();
        if (!["Task"].includes(e)) {
          return res.status(400).json({ message: `Invalid entityType '${entityType}'.` });
        }
        query.entityType = e;
      } else {
        query.entityType = "Task";
      }

      if (status) {
        const s = String(status).toLowerCase() === "read" ? "Read" : "Unread";
        query.status = s;
      }

      if (type) {
        const t = String(type).toUpperCase().trim();
        const ALLOWED = ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED"];
        if (!ALLOWED.includes(t)) {
          return res.status(400).json({ message: `Invalid notification type '${type}'.` });
        }
        query.type = t;
      }

      let notifs = await Notification.find(query)
        .sort({ createdAt: -1 })
        .select("assignedToUserId type title message status readAt entityType entityId createdAt")
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

      const notif = await Notification.findOne({ _id: id, assignedToUserId: uid }).lean();
      if (!notif) return res.status(404).json({ message: "Notification not found." });

      if (notif.status === "Read") {
        return res.json({ ok: true, status: "Read" });
      }

      await Notification.updateOne({ _id: id, assignedToUserId: uid }, { $set: { status: "Read", readAt: new Date() } });

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
      await ensureTaskMissed(uid);

      const query = {
        assignedToUserId: uid,
        status: "Unread",
      };

      const e = entityType ? String(entityType).trim() : "Task";
      if (!["Task"].includes(e)) return res.status(400).json({ message: "Invalid entityType." });
      query.entityType = e;

      if (type) {
        const t = String(type).toUpperCase().trim();
        const ALLOWED = ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED"];
        if (!ALLOWED.includes(t)) {
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
      await ensureTaskMissed(uid);

      const q = { assignedToUserId: uid, status: "Unread" };

      if (entityType) {
        const e = String(entityType).trim();
        if (!["Task"].includes(e)) return res.status(400).json({ message: "Invalid entityType." });
        q.entityType = e;
      } else {
        q.entityType = "Task";
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
      await ensureTaskMissed(uid);

      const qBase = { assignedToUserId: uid };

      const e = entityType ? String(entityType).trim() : "Task";
      if (!["Task"].includes(e)) return res.status(400).json({ message: "Invalid entityType." });
      qBase.entityType = e;

      if (type) {
        const t = String(type).toUpperCase().trim();
        const ALLOWED = ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED"];
        if (!ALLOWED.includes(t)) {
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