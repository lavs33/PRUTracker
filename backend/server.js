/**
 * =========================================================
 * PRUTracker Backend - Server Initialization
 * =========================================================
 * Responsibilities:
 * - Load environment configuration
 * - Initialize Express application
 * - Connect to MongoDB Atlas
 * - Register global middleware
 * - Define authentication route (Login)
 */
require("dotenv").config(); // Loads environment variables from .env into process.env

/**
 * =========================
 * Model Imports
 * =========================
 * These models represent the system's data layer.
 * They are used inside route handlers for database operations.
 */
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const User = require("./models/User");
const Agent = require("./models/Agent");
const Prospect = require("./models/Prospect");
const Policyholder = require("./models/Policyholder");
const Lead = require("./models/Lead");
const LeadEngagement = require("./models/LeadEngagement");
const ContactAttempt = require("./models/ContactAttempt");
const ScheduledMeeting = require("./models/ScheduledMeeting");
const NeedsAssessment = require("./models/NeedsAssessment");
const Task = require("./models/Task");
const Notification = require("./models/Notification");

const Unit = require("./models/Unit");
const Branch = require("./models/Branch");
const Area = require("./models/Area");

const app = express();

/**
 * =========================
 * Global Middleware
 * =========================
 * cors() → Enables cross-origin requests (frontend ↔ backend).
 * express.json() → Parses incoming JSON request bodies.
 */
app.use(cors());
app.use(express.json());

/**
 * =========================
 * Database Connection
 * =========================
 * Connects to MongoDB Atlas using URI from environment variables.
 * Logs connection success or failure.
 */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Atlas connected"))
  .catch((err) => console.error("MongoDB error:", err));

/**
 * =========================
 * Health Check Route
 * =========================
 * GET /
 * Used to verify backend server is running.
 */
app.get("/", (req, res) => {
  res.send("PRUTracker backend is running");
});

/* =========================================================
   AUTH: LOGIN
   Endpoint: POST /api/auth/login
========================================================= */
/**
 * Login Flow:
 * 1. Validate required fields (role, username, password)
 * 2. Map frontend role string to database role code
 * 3. Verify user credentials
 * 4. If Agent, fetch organizational hierarchy
 * 5. Return normalized user payload
 *
 * NOTE:
 * - Password is currently compared as plain text.
 * - Need to implement hashed password comparison.
 */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { role, username, password } = req.body;

    /**
     * Step 1: Basic Input Validation
     */
    if (!role || !username || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    /**
     * Step 2: Map UI Role → Database Role Code
     * Frontend sends:
     *   "Agent", "AUM", "UM", "BM"
     * Database stores:
     *   "AG", "AUM", "UM", "BM"
     */
    const roleMap = { Agent: "AG", AUM: "AUM", UM: "UM", BM: "BM" };
    const dbRole = roleMap[role];

    if (!dbRole) {
      return res.status(400).json({ message: "Invalid role." });
    }

    /**
     * Step 3: Authenticate User
     * - Finds user by username + role
     * - Uses .lean() for performance (returns plain object)
     */
    const user = await User.findOne({ username, role: dbRole }).lean();

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    /**
     * Step 4: Build Response Payload
     * Standardizes user data sent to frontend.
     */
    const payload = {
      id: user._id,
      role: user.role,
      username: user.username,
      firstName: user.firstName,
      middleName: user.middleName || "",
      lastName: user.lastName,
      sex: user.sex,
      birthday: user.birthday,
      age: user.age,
      displayPhoto: user.displayPhoto || "",
      dateEmployed: user.dateEmployed,
      agentType: "",
      unitName: "",
      branchName: "",
      areaName: "",
    };

    /**
     * Step 5: If Agent, Populate Organizational Hierarchy
     * Fetch:
     *   Agent → Unit → Branch → Area
     * Uses nested populate to retrieve full structure.
     */
    if (user.role === "AG") {
      const agent = await Agent.findOne({ userId: user._id })
        .populate({
          path: "unitId",
          select: "unitName branchId",
          populate: {
            path: "branchId",
            select: "branchName areaId",
            populate: {
              path: "areaId",
              select: "areaName",
            },
          },
        })
        .lean();

      if (agent) {
        payload.agentType = agent.agentType || "";
        payload.unitName = agent.unitId?.unitName || "";
        payload.branchName = agent.unitId?.branchId?.branchName || "";
        payload.areaName = agent.unitId?.branchId?.areaId?.areaName || "";
      }
    }

    /**
     * Step 6: Return Success Response
     */
    return res.json({ message: "Login successful", user: payload });
  } catch (err) {
    /**
     * Global Error Handling for Login Route
     */
    console.error("Login error:", err);
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
function isDueTodayInManila(dueAt) {
  const todayKey = dateKeyInTZ(new Date(), "Asia/Manila");
  const dueKey = dateKeyInTZ(dueAt, "Asia/Manila");
  return !!todayKey && todayKey === dueKey;
}

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
}) {
  await Notification.create(
    [
      {
        assignedToUserId,
        type: "TASK_ADDED",
        title: "New task added",
        message: `${task.title} was created for ${prospectFullName} (Lead ${leadCode || "—"}).`,
        status: "Unread",
        entityType: "Task",
        entityId: task._id,
      },
    ],
    { session }
  );

  if (task?.dueAt && isDueTodayInManila(task.dueAt)) {
    await Notification.create(
      [
        {
          assignedToUserId,
          type: "TASK_DUE_TODAY",
          title: "Task due today",
          message: `${task.title} for ${prospectFullName} (Lead ${leadCode || "—"}) is due today at ${formatTimeInManila(task.dueAt)}.`,
          status: "Unread",
          entityType: "Task",
          entityId: task._id,
          dedupeKey: `TASK_DUE_TODAY:${task._id}:${dateKeyInTZ(task.dueAt, "Asia/Manila")}`,
        },
      ],
      { session }
    );
  }
}

async function ensureTaskMissedNotificationsForUser(userObjectId) {
  const now = new Date();
  const overdueTasks = await Task.find({
    assignedToUserId: userObjectId,
    status: "Open",
    dueAt: { $lt: now },
  })
    .select("_id title dueAt")
    .lean();

  if (!overdueTasks.length) return;

  const writes = overdueTasks
    .map((task) => {
      const dueKey = dateKeyInTZ(task.dueAt, "Asia/Manila");
      if (!dueKey) return null;

      const dedupeKey = `TASK_MISSED:${task._id}:${dueKey}`;
      return {
        updateOne: {
          filter: { assignedToUserId: userObjectId, dedupeKey },
          update: {
            $setOnInsert: {
              assignedToUserId: userObjectId,
              type: "TASK_MISSED",
              title: "Task missed",
              message: `${task.title || "Task"} is now overdue.`,
              status: "Unread",
              entityType: "Task",
              entityId: task._id,
              dedupeKey,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (!writes.length) return;
  await Notification.bulkWrite(writes, { ordered: false });
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
  const prospectIds = [...new Set(tasks.map((t) => String(t.prospectId)).filter(Boolean))];
  const prospects = await Prospect.find({ _id: { $in: prospectIds } })
    .select("firstName middleName lastName")
    .lean();

  const prospectMap = new Map(
    prospects.map((p) => {
      const fullName = `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName}`.trim();
      return [String(p._id), fullName];
    })
  );

  // LeadEngagement -> leadId -> leadCode
  const engagementIds = [...new Set(tasks.map((t) => String(t.leadEngagementId)).filter(Boolean))];

  const engagementToLeadId = new Map(); // engagementId -> leadId
  let leadIdToCode = new Map(); // leadId -> leadCode

  if (engagementIds.length) {
    const engagements = await LeadEngagement.find({ _id: { $in: engagementIds } })
      .select("leadId")
      .lean();

    for (const e of engagements) {
      if (e.leadId) engagementToLeadId.set(String(e._id), String(e.leadId));
    }

    const leadIds = [...new Set(engagements.map((e) => String(e.leadId)).filter(Boolean))];

    if (leadIds.length) {
      const leads = await Lead.find({ _id: { $in: leadIds } })
        .select("leadCode")
        .lean();

      leadIdToCode = new Map(leads.map((l) => [String(l._id), l.leadCode]));
    }
  }

  return tasks.map((t) => {
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
       Policyholder -> Lead -> Prospect.assignedToUserId
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
     * 1) Join Lead (policyholder.leadId → leads._id)
     * 2) Join Prospect (lead.prospectId → prospects._id)
     * 3) Filter to this agent via prospect.assignedToUserId
     * 4) Compute stable policyholderNo per agent via policyholderCode ASC
     * 5) Sort by lastPaidDate DESC to get "recently paid"
     * 6) Use $facet to return total count + top N items in one query
     */
    const agg = await Policyholder.aggregate([
      /**
       * Step 1: Lookup Lead for each policyholder
       * - Creates array field "lead"
       */
      {
        $lookup: {
          from: "leads",
          localField: "leadId",
          foreignField: "_id",
          as: "lead",
        },
      },
      { $unwind: "$lead" },

      /**
       * Step 2: Lookup Prospect via lead.prospectId
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
       * Step 3: Filter policyholders to those belonging to THIS agent
       * - Determined by prospect.assignedToUserId
       */
      { $match: { "prospect.assignedToUserId": userObjectId } },

      /**
       * Step 4: Copy assignedToUserId into root document
       * - Makes it easier to use partitionBy in window fields
       */
      { $addFields: { assignedToUserId: "$prospect.assignedToUserId" } },

      /**
       * Step 5: Compute stable policyholderNo per agent
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
       * Step 6: Most recently paid ordering
       * - Sort by lastPaidDate DESC for "recent payments" view
       */
      { $sort: { lastPaidDate: -1 } },

      /**
       * Step 7: Use $facet to return:
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
                policyholderNo: 1,
                policyholderCode: 1,
                policyNumber: 1,
                status: 1,
                lastPaidDate: 1,
                firstName: "$prospect.firstName",
                lastName: "$prospect.lastName",
              },
            },
          ],
        },
      },
      /**
       * Step 8: Normalize output object structure
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
  // later:
  // "Needs Assessment": [...],
  // "Proposal": [...],
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
    const { userId } = req.query;
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

    return res.json({ prospect: agg[0] });
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
    const { userId } = req.query;

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
    const { userId } = req.query;

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
    const { userId } = req.query;

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
      // STATUS CONTROL (server-enforced)
      // ===========================
      /**
       * Rule:
       * - Status cannot be freely edited from UI.
       * Only allow:
       *   Active  -> Dropped
       *   Dropped -> Active (re-open)
       *
       * Everything else:
       * - must remain unchanged
       * - attempting any other transition returns 403.
       */
      const currentStatus = String(existing.status || "");
      const requestedStatus = status !== undefined ? String(status || "").trim() : "";

      let nextStatus = currentStatus;

      if (status !== undefined) {
        const allowed = ["Active", "Wrong Contact", "Dropped"];
        if (requestedStatus !== "" && !allowed.includes(requestedStatus)) {
          throw Object.assign(new Error("Invalid status."), { status: 400 });
        }

        if (currentStatus === "Active" && requestedStatus === "Dropped") {
          nextStatus = "Dropped";
        } else if (currentStatus === "Dropped" && requestedStatus === "Active") {
          nextStatus = "Active";
        } else if (requestedStatus && requestedStatus !== currentStatus) {
          throw Object.assign(
            new Error("Status cannot be changed manually. Only dropping or re-opening is allowed."),
            { status: 403 }
          );
        }
      }

      // ===========================
      // Drop validation + blocking rule
      // ===========================
      /**
       * If dropping:
       * - dropReason and dropNotes are required.
       * - Prospect cannot be dropped if ANY lead under it is not Dropped.
       *   (Prevents "orphaned active leads".)
       */
      if (nextStatus === "Dropped") {
        const r = String(dropReason || "").trim();
        const n = String(dropNotes || "").trim();

        if (!r) throw Object.assign(new Error("dropReason is required when status is Dropped."), { status: 400 });
        if (!n) throw Object.assign(new Error("dropNotes is required when status is Dropped."), { status: 400 });

        const blockingLeads = await Lead.find({
          prospectId: new mongoose.Types.ObjectId(prospectId),
          status: { $ne: "Dropped" },
        })
          .select("leadCode status")
          .sort({ createdAt: -1 })
          .lean()
          .session(session);

        if (blockingLeads.length > 0) {
          // Custom structured error returned to frontend
          throw Object.assign(
            new Error(
              "Cannot drop this prospect because there are existing lead record(s) that are not Dropped. Please drop those leads first."
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
            await LeadEngagement.updateOne(
              { _id: openUpdateTask.leadEngagementId },
              {
                $set: {
                  isBlocked: false,
                  currentContactInfoVersion: nextVersion,
                  currentActivityKey: "Attempt Contact",  // reset activity so UI flow restarts correctly
                  currentStage: "Contacting",
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
                },
              ],
              { session }
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
                  },
                ],
                { session }
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
    const { userId } = req.query;

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
// - Also attaches at most ONE Policyholder record linked to this lead (1:1 via leadId).
// - Computes a display-only agent-wide leadNo (rank across all leads under agent’s prospects).
//
// Security model:
// 1) Validate agent (userId)
// 2) Validate that prospect belongs to agent (assignedToUserId match)
// 3) Validate that lead belongs to that prospect
// 4) Attach policy only if it belongs to agent too (assignedToUserId match)
app.get("/api/prospects/:prospectId/leads/:leadId/details", async (req, res) => {
  try {
    const { userId } = req.query;
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
      .select("firstName middleName lastName source")
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

    // Attach Policyholder (optional 1:1 via leadId)
    // Security: policy must also belong to the agent (assignedToUserId match)
    const policy = await Policyholder.findOne({
      leadId: leadObjectId,
      assignedToUserId: userObjectId,
    })
      .select("policyholderCode status createdAt") 
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
   - Drop is only allowed from New/In Progress.
   - Reopen is only allowed from Dropped and restores statusBeforeDrop.
   - Source rules depend on prospect.source:
     * System-Assigned prospect => lead source locked to "System"
     * Agent-Sourced prospect  => lead source editable, but cannot be "System"
=========================== */
app.put("/api/prospects/:prospectId/leads/:leadId", async (req, res) => {
  try {
    const { userId } = req.query;
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
      .select("_id source")
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

      const saved = await existing.save();
      return res.json({ message: "Lead dropped", lead: saved });
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

      const saved = await existing.save();
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
    const { userId } = req.query;

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
      .select("firstName middleName lastName marketType source status phoneNumber contactInfoVersion email")
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

        nextAttemptAt: null,

        // Versioning ties attempts/tasks to the correct prospect contact version
        contactInfoVersionAtStart: prospect.contactInfoVersion || 1,
        currentContactInfoVersion: prospect.contactInfoVersion || 1,
      });

      engagement = created.toObject();
    }

    // 4) Load contact attempts for the engagement (oldest→newest by attemptNo)
    const attempts = await ContactAttempt.find({
      leadEngagementId: engagement._id,
    })
      .sort({ attemptNo: 1 })
      .select(
        "attemptNo primaryChannel otherChannels response attemptedAt contactInfoVersion outcomeActivity notes phoneValidation interestLevel preferredChannel preferredChannelOther"
      )
      .lean();

    const scheduledMeetings = await ScheduledMeeting.find({
      leadEngagementId: engagement._id,
      status: { $ne: "Cancelled" },
    })
      .sort({ startAt: -1 })
      .select("meetingType startAt endAt durationMin mode platform platformOther link inviteSent place")
      .lean();

    const latestMeeting = scheduledMeetings[0] || null;
    const lastAttemptNo = attempts.length ? attempts[attempts.length - 1].attemptNo : null;

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
    })
      // Sort soonest due first; for ties, newest created first
      .sort({ dueAt: 1, createdAt: -1 })
      .select("_id type title description dueAt status completedAt createdAt")
      .lean();

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
    const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;

    let derivedActivityKey = engagement.currentActivityKey || lastAttempt?.outcomeActivity || null;

    if (engagement.currentStage === "Not Started" && attempts.length === 0) {
      derivedActivityKey = null;
    } 

    if (!isValidActivityForStage(engagement.currentStage, derivedActivityKey)) {
      derivedActivityKey = null;
    }

    // Map attempts to frontend-friendly fields (stable key names)
    const contactAttempts = attempts.map((a) => ({
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
        const m = a.attemptNo === lastAttemptNo ? latestMeeting : null;
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

        // Derived and validated current activity for tracker/badge
        currentActivityKey: derivedActivityKey, 

        // Always an array (empty if none)
        contactAttempts, 

        // Always an array (empty if none)
        tasks: Array.isArray(tasks) ? tasks : [],
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
    const { userId } = req.query;
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

    await session.withTransaction(async () => {
      // 1) Authorization: prospect must belong to agent
      // Only fetch contactInfoVersion because that is what we need for attempt versioning.
      const prospect = await Prospect.findOne(
        { _id: prospectObjectId, assignedToUserId: userObjectId },
        { contactInfoVersion: 1 }
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
      const lastAttempt = await ContactAttempt.findOne({ leadEngagementId: engagement._id })
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

async function getLatestRespondedAttemptForEngagement(leadEngagementId, session) {
  return ContactAttempt.findOne({
    leadEngagementId,
    response: "Responded",
  })
    .sort({ attemptNo: -1 })
    .session(session || null);
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
    const { userId } = req.query;
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

      const attempt = await ContactAttempt.findOne({
        leadEngagementId: engagement._id,
        response: "Responded",
      })
        .sort({ attemptNo: -1 })
        .session(session);

      if (!attempt) {
        throw Object.assign(new Error("No responded contact attempt found to validate."), { status: 409 });
      }

      if (String(attempt.phoneValidation || "").trim()) {
        throw Object.assign(new Error("This attempt has already been validated."), { status: 409 });
      }

      attempt.phoneValidation = result;
      attempt.outcomeActivity = "Validate Contact";
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
      engagement.currentActivityKey = "Validate Contact";
      await engagement.save({ session });

      const openApproachTask = await Task.findOne({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "APPROACH",
        status: "Open",
      }).session(session);

      if (openApproachTask) {
        openApproachTask.status = "Done";
        openApproachTask.completedAt = new Date();
        await openApproachTask.save({ session });
      }

      let updateTask = await Task.findOne({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "UPDATE_CONTACT_INFO",
        status: "Open",
      }).session(session);

      let createdNewUpdateTask = false;

      if (!updateTask) {
        const due = new Date();
        due.setDate(due.getDate() + 2);

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
            },
          ],
          { session }
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
              },
            ],
            { session }
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
    const { userId } = req.query;
    const { prospectId, leadId } = req.params;
    const { interestLevel, preferredChannel, preferredChannelOther } = req.body;

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(prospectId)) return res.status(400).json({ message: "Invalid prospectId." });
    if (!mongoose.isValidObjectId(leadId)) return res.status(400).json({ message: "Invalid leadId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadId, prospectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId }).session(session);
      if (!engagement) throw Object.assign(new Error("Engagement not found."), { status: 404 });

      if (engagement.currentActivityKey !== "Assess Interest") {
        throw Object.assign(new Error("Assess Interest is not the current activity."), { status: 409 });
      }

      const lvl = String(interestLevel || "").trim().toUpperCase();
      if (!["INTERESTED", "NOT_INTERESTED"].includes(lvl)) {
        throw Object.assign(new Error("interestLevel must be INTERESTED or NOT_INTERESTED."), { status: 400 });
      }

      const attempt = await getLatestRespondedAttemptForEngagement(engagement._id, session);
      if (!attempt) throw Object.assign(new Error("No responded contact attempt found."), { status: 409 });

      attempt.interestLevel = lvl;
      attempt.outcomeActivity = "Assess Interest";

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
        engagement.currentActivityKey = "Assess Interest";
      }

      await attempt.save({ session });
      await engagement.save({ session });
    });

    return res.json({ message: "Assess Interest saved." });
  } catch (err) {
    console.error("Assess interest error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error." });
  } finally {
    session.endSession();
  }
});



function isValidHttpUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function combineDateAndTimeLocal(dateStr, timeStr) {
  const [y, m, d] = String(dateStr || "").split("-").map((n) => Number(n));
  const [hh, mm] = String(timeStr || "").split(":").map((n) => Number(n));

  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function isMeetingSlotValidWindow(startAt, durationMin) {
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return false;
  if (![30, 60, 90, 120].includes(Number(durationMin))) return false;

  const start = new Date(startAt.getTime());
  const end = new Date(startAt.getTime() + Number(durationMin) * 60 * 1000);

  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  return startMin >= 7 * 60 && endMin <= 21 * 60;
}

async function getAgentMeetingWindows(userObjectId, from, to, session) {
  const leads = await Lead.find({})
    .select("_id prospectId")
    .session(session || null)
    .lean();

  const prospectIds = [...new Set(leads.map((l) => String(l.prospectId)).filter(Boolean))];
  const prospects = prospectIds.length
    ? await Prospect.find({ _id: { $in: prospectIds }, assignedToUserId: userObjectId })
        .select("_id")
        .session(session || null)
        .lean()
    : [];

  const allowedProspectIds = new Set(prospects.map((p) => String(p._id)));
  const leadIdsForAgent = leads
    .filter((l) => allowedProspectIds.has(String(l.prospectId)))
    .map((l) => l._id);

  if (!leadIdsForAgent.length) return [];

  const engagements = await LeadEngagement.find({ leadId: { $in: leadIdsForAgent } })
    .select("_id")
    .session(session || null)
    .lean();

  const engagementIds = engagements.map((e) => e._id);
  if (!engagementIds.length) return [];

  const q = {
    leadEngagementId: { $in: engagementIds },
    status: { $ne: "Cancelled" },
  };

  if (from || to) {
    q.startAt = {};
    if (from) q.startAt.$gte = from;
    if (to) q.startAt.$lt = to;
  }

  const meetings = await ScheduledMeeting.find(q)
    .select("startAt endAt durationMin")
    .session(session || null)
    .lean();

  return meetings
    .map((m) => {
      const start = m.startAt ? new Date(m.startAt) : null;
      if (!start || Number.isNaN(start.getTime())) return null;

      let end = m.endAt ? new Date(m.endAt) : null;
      if (!end || Number.isNaN(end.getTime())) {
        const duration = Number(m.durationMin || 120);
        end = new Date(start.getTime() + duration * 60 * 1000);
      }

      return { start, end };
    })
    .filter(Boolean);
}

function hasMeetingConflict(startAt, endAt, windows) {
  return windows.some((w) => w.start < endAt && w.end > startAt);
}

app.get("/api/agents/:agentId/meeting-availability", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId } = req.query;
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
    start.setDate(start.getDate() + 1);

    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const windows = await getAgentMeetingWindows(userObjectId, start, end, session);

    return res.json({
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
      bookedWindows: windows.map((w) => ({ startAt: w.start.toISOString(), endAt: w.end.toISOString() })),
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
    const { userId } = req.query;
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

      if (engagement.currentActivityKey !== "Schedule Meeting") {
        throw Object.assign(new Error("Schedule Meeting is not the current activity."), { status: 409 });
      }

      const durationMin = Number(meetingDurationMin || 120);
      const dt = meetingDate && meetingStartTime
        ? combineDateAndTimeLocal(meetingDate, meetingStartTime)
        : new Date(meetingAt);

      if (!dt || Number.isNaN(dt.getTime())) {
        throw Object.assign(new Error("meeting date/time is required and must be valid."), { status: 400 });
      }

      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const latestDay = new Date(tomorrow);
      latestDay.setDate(latestDay.getDate() + 30);

      if (dt < tomorrow || dt >= latestDay) {
        throw Object.assign(new Error("Meeting date must be between tomorrow and the next 30 days."), { status: 400 });
      }

      if (!isMeetingSlotValidWindow(dt, durationMin)) {
        throw Object.assign(
          new Error("Meeting must start between 7:00 AM and 9:00 PM, and duration must be 30/60/90/120 minutes."),
          { status: 400 }
        );
      }

      const endAt = new Date(dt.getTime() + durationMin * 60 * 1000);

      const windows = await getAgentMeetingWindows(userObjectId, null, null, session);
      if (hasMeetingConflict(dt, endAt, windows)) {
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

      const attempt = await getLatestRespondedAttemptForEngagement(engagement._id, session);
      if (!attempt) throw Object.assign(new Error("No responded contact attempt found."), { status: 409 });

      attempt.outcomeActivity = "Schedule Meeting";
      await attempt.save({ session });

      const meetingType = "Needs Assessment";
      const existingMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType,
      }).session(session);

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
          [
            {
              leadEngagementId: engagement._id,
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

      const openApproachTask = await Task.findOne({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "APPROACH",
        status: "Open",
      }).session(session);

      if (openApproachTask) {
        openApproachTask.status = "Done";
        openApproachTask.completedAt = new Date();
        await openApproachTask.save({ session });
      }

      const appointmentDedupeKey = `APPOINTMENT:${engagement._id}`;
      let appointmentTask = await Task.findOne({
        assignedToUserId: userObjectId,
        dedupeKey: appointmentDedupeKey,
      }).session(session);

      const appointmentTitle = `Meeting scheduled with ${prospect.firstName}`;
      const appointmentDescription = `Attend scheduled meeting with ${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName} (Lead ${lead.leadCode || "—"}). Meeting window: ${formatDateTimeInManila(dt)} to ${formatDateTimeInManila(endAt)} (Asia/Manila).`;
      const appointmentDueAt = new Date(endAt.getTime() + 15 * 60 * 1000);

      if (!appointmentTask) {
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

        const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: appointmentTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
        });
      } else if (appointmentTask.status !== "Done") {
        appointmentTask.title = appointmentTitle;
        appointmentTask.description = appointmentDescription;
        appointmentTask.dueAt = appointmentDueAt;
        await appointmentTask.save({ session });
      }

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
      await engagement.save({ session });
    });

    return res.json({
      message: "Meeting scheduled. Contacting completed and Needs Assessment activated.",
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
    const { userId } = req.query;
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

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage currentActivityKey").lean();
    if (!engagement) return res.status(404).json({ message: "Lead engagement not found." });

    let needsAssessment = await NeedsAssessment.findOne({ leadEngagementId: engagement._id })
      .select("outcomeActivity attendanceConfirmed attendedAt dependents needsPriorities")
      .lean();

    if (!needsAssessment) {
      const created = await NeedsAssessment.create({
        leadEngagementId: engagement._id,
      });
      needsAssessment = created.toObject();
    }

    const allLeadIds = await Lead.find({ prospectId: prospectObjectId }).distinct("_id");
    const policyholders = await Policyholder.find({ leadId: { $in: allLeadIds } })
      .select("policyNumber status productId")
      .populate("productId", "productName")
      .lean();

    const existingPolicies = (policyholders || []).map((p) => ({
      policyNumber: p.policyNumber || "",
      productName: p?.productId?.productName || "",
      status: p.status || "",
    }));

    const computedAge = prospect.birthday ? computeAgeFromBirthday(new Date(prospect.birthday)) : null;

    const needsSteps = [
      "Record Prospect Attendance",
      "Perform Needs Analysis",
      "Schedule Proposal Presentation",
    ];
    const engagementActivity = String(engagement.currentActivityKey || "").trim();
    const effectiveNeedsActivityKey = needsSteps.includes(engagementActivity)
      ? engagementActivity
      : !needsAssessment.attendanceConfirmed
      ? "Record Prospect Attendance"
      : String(needsAssessment.outcomeActivity || "") === "Perform Needs Analysis"
      ? "Schedule Proposal Presentation"
      : "Perform Needs Analysis";

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
        outcomeActivity: needsAssessment.outcomeActivity || "",
        dependents: Array.isArray(needsAssessment.dependents) ? needsAssessment.dependents : [],
        needsPriorities: needsAssessment.needsPriorities || {},
      },
      existingPolicies,
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
    const { userId } = req.query;
    const { prospectId, leadId } = req.params;
    const { attended } = req.body || {};

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }
    if (attended !== true) {
      return res.status(400).json({ message: "Prospect attendance must be marked attended." });
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

      const na = (await NeedsAssessment.findOne({ leadEngagementId: engagement._id }).session(session)) ||
        new NeedsAssessment({ leadEngagementId: engagement._id });

      na.attendanceConfirmed = true;
      na.attendedAt = new Date();
      na.outcomeActivity = "Record Prospect Attendance";
      await na.save({ session });

      if (engagement.currentStage === "Needs Assessment") {
        engagement.currentActivityKey = "Perform Needs Analysis";
        await engagement.save({ session });
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
    const { userId } = req.query;
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

    await session.withTransaction(async () => {
      const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).session(session);
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });

      const na = (await NeedsAssessment.findOne({ leadEngagementId: engagement._id }).session(session)) ||
        new NeedsAssessment({ leadEngagementId: engagement._id });

      if (!na.attendanceConfirmed || engagement.currentActivityKey !== "Perform Needs Analysis") {
        throw Object.assign(new Error("Record attendance first and proceed to Perform Needs Analysis."), { status: 409 });
      }

      const info = basicInformation || {};
      const sex = String(info.sex || "").trim();
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

      if (sex && !["Male", "Female"].includes(sex)) {
        throw Object.assign(new Error("Invalid sex."), { status: 400 });
      }
      if (civilStatus && !["Single", "Married", "Widowed", "Separated", "Annulled"].includes(civilStatus)) {
        throw Object.assign(new Error("Invalid civil status."), { status: 400 });
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
      if (!region) throw Object.assign(new Error("Region is required."), { status: 400 });
      if (!zipCode) throw Object.assign(new Error("Zip code is required."), { status: 400 });
      if (!/^\d{4}$/.test(zipCode)) throw Object.assign(new Error("Zip code must be 4 digits."), { status: 400 });

      const np = needsPriorities && typeof needsPriorities === "object" ? needsPriorities : {};
      const currentPriority = String(np.currentPriority || "").trim();
      if (!["Protection", "Health", "Investment"].includes(currentPriority)) {
        throw Object.assign(new Error("Current priority is required."), { status: 400 });
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
        approxIncome = monthlyIncomeAmountInput;
      } else {
        approxIncome = INCOME_BANDS[monthlyIncomeBand].max;
      }

      const minPremium = toNonNegativeNumber(np.minPremium);
      const maxPremium = toNonNegativeNumber(np.maxPremium);
      if (minPremium === null) throw Object.assign(new Error("Minimum willing monthly premium is required."), { status: 400 });
      if (maxPremium === null) throw Object.assign(new Error("Maximum willing monthly premium is required."), { status: 400 });
      if (minPremium > approxIncome) throw Object.assign(new Error("Minimum willing monthly premium cannot be higher than approximate monthly income."), { status: 400 });
      if (maxPremium > approxIncome) throw Object.assign(new Error("Maximum willing monthly premium cannot be higher than approximate monthly income."), { status: 400 });
      if (maxPremium < minPremium) throw Object.assign(new Error("Maximum willing monthly premium must be equal to or higher than minimum."), { status: 400 });

      const prioritiesPayload = {
        currentPriority,
        monthlyIncomeBand,
        monthlyIncomeAmount: monthlyIncomeAmountInput,
        minPremium,
        maxPremium,
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
        if (monthlySpend > approxIncome) throw Object.assign(new Error("Protection: monthly spend cannot be higher than approximate monthly income."), { status: 400 });
        if (savingsForProtection === null) throw Object.assign(new Error("Protection: savings for protection is required."), { status: 400 });

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
        if (savingsForCriticalIllness === null) throw Object.assign(new Error("Health: savings for critical illness is required."), { status: 400 });
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
        if (!Number.isFinite(targetUtilizationYear)) throw Object.assign(new Error("Investment: target year to utilize savings is required."), { status: 400 });
        if (targetUtilizationYear < currentYear + 2 || targetUtilizationYear > currentYear + 20) {
          throw Object.assign(new Error("Investment: target year must be between 2 and 20 years from current year."), { status: 400 });
        }
        if (savingsForInvestment === null) throw Object.assign(new Error("Investment: savings for investment is required."), { status: 400 });
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

      na.dependents = normalizedDependents.map((d) => ({
        name: String(d.name || "").trim(),
        age: Number(d.age),
        gender: String(d.gender || ""),
        relationship: String(d.relationship || ""),
      }));
      na.needsPriorities = prioritiesPayload;
      na.outcomeActivity = "Perform Needs Analysis";
      await na.save({ session });

      if (engagement.currentStage === "Needs Assessment") {
        engagement.currentActivityKey = "Schedule Proposal Presentation";
        await engagement.save({ session });
      }
    });

    return res.json({ message: "Needs analysis saved.", currentActivityKey: "Schedule Proposal Presentation" });
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
    const { userId } = req.query;
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

      const na = await NeedsAssessment.findOne({ leadEngagementId: engagement._id }).session(session);
      if (!na || engagement.currentActivityKey !== "Schedule Proposal Presentation") {
        throw Object.assign(new Error("Complete attendance and needs analysis first."), { status: 409 });
      }

      const durationMin = Number(meetingDurationMin || 120);
      const dt = meetingDate && meetingStartTime
        ? combineDateAndTimeLocal(meetingDate, meetingStartTime)
        : new Date(meetingAt);

      if (!dt || Number.isNaN(dt.getTime())) {
        throw Object.assign(new Error("meeting date/time is required and must be valid."), { status: 400 });
      }

      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (dt < tomorrow) throw Object.assign(new Error("meetingAt must be at least tomorrow."), { status: 400 });

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
      const conflict = hasMeetingConflict(dt, endAt, windows);
      if (conflict) {
        throw Object.assign(new Error("Selected meeting time conflicts with another scheduled meeting."), {
          status: 409,
          code: "MEETING_SLOT_CONFLICT",
        });
      }

      const meetingType = "Proposal Presentation";
      const existingMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType,
      }).session(session);

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

      na.outcomeActivity = "Schedule Proposal Presentation";
      await na.save({ session });

      const now = new Date();
      engagement.currentStage = "Proposal";
      engagement.currentActivityKey = "";
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
    });

    return res.json({ message: "Proposal presentation scheduled. Proposal stage activated." });
  } catch (err) {
    console.error("Schedule proposal presentation error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error.", code: err?.code });
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
    let openTasks = await Task.find({ assignedToUserId: userObjectId, status: "Open" })
      .select("assignedToUserId prospectId leadEngagementId type title description dueAt status completedAt createdAt")
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
        "CUSTOM",
      ];

      if (!ALLOWED_TYPES.includes(t)) {
        return res.status(400).json({ message: `Invalid task type '${type}'.` });
      }

      query.type = t;
    }

    // Fetch tasks sorted for UI:
    // - earliest due first
    // - for same due date, newest created first
    let tasks = await Task.find(query)
      .sort({ dueAt: 1, createdAt: -1 })
      .select(
        "assignedToUserId prospectId leadEngagementId type title description dueAt status completedAt createdAt"
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
      const prospectIds = [...new Set(tasks.map((t) => String(t.prospectId)).filter(Boolean))];

      const prospects = await Prospect.find({ _id: { $in: prospectIds } })
        .select("firstName middleName lastName")
        .lean();

      const prospectMap = new Map(
        prospects.map((p) => {
          const fullName = `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName}`.trim();
          return [String(p._id), fullName];
        })
      );

      // --- LeadEngagement -> leadId ---
      const engagementIds = [...new Set(tasks.map((t) => String(t.leadEngagementId)).filter(Boolean))];

      const engagementToLeadId = new Map(); 
      let leadIdToCode = new Map();       

      if (engagementIds.length) {
        const engagements = await LeadEngagement.find({ _id: { $in: engagementIds } })
          .select("leadId")
          .lean();

        for (const e of engagements) {
          if (e.leadId) engagementToLeadId.set(String(e._id), String(e.leadId));
        }

        const leadIds = [...new Set(engagements.map((e) => String(e.leadId)).filter(Boolean))];

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

// ===========================
// NOTIFICATIONS: LIST (Agent)
// GET /api/notifications?userId=...&status=Unread|Read&type=TASK_ADDED&entityType=Task&includeRefs=1
//
// Purpose:
// - Returns notifications for a specific user (assignedToUserId scope).
// - Currently focused on Task notifications (entityType defaults to "Task").
// - Supports optional filtering by:
//   - status: Unread | Read
//   - type: TASK_ADDED | TASK_DUE_TODAY | TASK_MISSED
//   - entityType: Task (only allowed value right now)
//
// Optional enrichment:
// - includeRefs=1 attaches task navigation references:
//   - prospectId (from Task)
//   - leadId (resolved from LeadEngagement -> Lead)
//   - optional display helpers: prospectName, leadCode
// ===========================
app.get("/api/notifications", async (req, res) => {
  try {
    const { userId, status, type, entityType, includeRefs } = req.query;

    // Validate required userId
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

    const uid = new mongoose.Types.ObjectId(userId);
    await ensureTaskMissedNotificationsForUser(uid);

    // Always scope notifications to this user
    const query = { assignedToUserId: uid };

    // Entity scoping:
    // - If entityType provided, validate it (Task only for now)
    // - If not provided, default to Task notifications only
    if (entityType) {
      const e = String(entityType).trim();
      if (!["Task"].includes(e)) {
        return res.status(400).json({ message: `Invalid entityType '${entityType}'.` });
      }
      query.entityType = e;
    } else {
      // default: task only
      query.entityType = "Task";
    }

    // Optional: status filter (defaults to Unread if status provided but not "read")
    if (status) {
      const s = String(status).toLowerCase() === "read" ? "Read" : "Unread";
      query.status = s;
    }

    // Optional: notification type filter (task notification types only for now)
    if (type) {
      const t = String(type).toUpperCase().trim();
      const ALLOWED = ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED"];
      if (!ALLOWED.includes(t)) {
        return res.status(400).json({ message: `Invalid notification type '${type}'.` });
      }
      query.type = t;
    }

    // Base fetch: newest first
    let notifs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .select("assignedToUserId type title message status readAt entityType entityId createdAt")
      .lean();

    /**
     * includeRefs=1:
     * For Task notifications only:
     * - Pull all task entities referenced by notifications
     * - Attach prospectId + leadId for frontend navigation
     * - Optionally attach prospectName + leadCode for display
     *
     * NOTE: This never mutates DB; it only enriches the response objects.
     */
    if (String(includeRefs) === "1" && notifs.length) {
    // Collect unique task IDs referenced by notifications
      const taskIds = [
        ...new Set(
          notifs
            .filter((n) => n.entityType === "Task" && n.entityId)
            .map((n) => String(n.entityId))
        ),
      ];
      // Fetch minimal task fields needed for navigation
      const tasks = await Task.find({ _id: { $in: taskIds } })
        .select("prospectId leadEngagementId type")
        .lean();

      const taskMap = new Map(tasks.map((t) => [String(t._id), t]));

      // Resolve engagement -> leadId
      const engagementIds = [
        ...new Set(tasks.map((t) => String(t.leadEngagementId)).filter(Boolean)),
      ];

      const engagementToLeadId = new Map();
      if (engagementIds.length) {
        const engagements = await LeadEngagement.find({ _id: { $in: engagementIds } })
          .select("leadId")
          .lean();

        for (const e of engagements) {
          if (e.leadId) engagementToLeadId.set(String(e._id), String(e.leadId));
        }
      }

      // Prospect name helpers (prospectId -> fullName)
      const prospectIds = [
        ...new Set(tasks.map((t) => String(t.prospectId)).filter(Boolean)),
      ];
      const prospects = await Prospect.find({ _id: { $in: prospectIds } })
        .select("firstName middleName lastName")
        .lean();
      const prospectMap = new Map(
        prospects.map((p) => {
          const fullName = `${p.firstName}${p.middleName ? ` ${p.middleName}` : ""} ${p.lastName}`.trim();
          return [String(p._id), fullName];
        })
      );

      // leadCode helpers (leadId -> leadCode)
      const leadIds = [
        ...new Set(
          tasks
            .map((t) => (t.leadEngagementId ? engagementToLeadId.get(String(t.leadEngagementId)) : null))
            .filter(Boolean)
        ),
      ];
      let leadIdToCode = new Map();
      if (leadIds.length) {
        const leads = await Lead.find({ _id: { $in: leadIds } })
          .select("leadCode")
          .lean();
        leadIdToCode = new Map(leads.map((l) => [String(l._id), l.leadCode]));
      }

      // Enrich each notification with navigation + display fields
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
});

// ===========================
// NOTIFICATIONS: MARK READ (one)
// PATCH /api/notifications/:id/read?userId=...
//
// Purpose:
// - Marks a single notification as Read for a specific user.
// - Ensures user ownership: can only read their own notification.
// - Idempotent: if already Read, returns ok without updating.
// ===========================
app.patch("/api/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    // Validate required IDs
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid notification id." });

    // Ownership check (must belong to this user)
    const uid = new mongoose.Types.ObjectId(userId);

    const notif = await Notification.findOne({ _id: id, assignedToUserId: uid }).lean();
    if (!notif) return res.status(404).json({ message: "Notification not found." });

   // Idempotent behavior: already read => return success without writing
    if (notif.status === "Read") {
      return res.json({ ok: true, status: "Read" });
    }

    // Update to Read and set read timestamp
    await Notification.updateOne(
      { _id: id, assignedToUserId: uid },
      { $set: { status: "Read", readAt: new Date() } }
    );

    return res.json({ ok: true, status: "Read" });
  } catch (err) {
    console.error("Mark read error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// ===========================
// NOTIFICATIONS: UNREAD COUNT
// GET /api/notifications/unread-count?userId=...&entityType=Task
//
// Purpose:
// - Returns the number of unread notifications for a user.
// - Currently focuses only on entityType=Task (default if omitted).
// ===========================
app.get("/api/notifications/unread-count", async (req, res) => {
  try {
    const { userId, entityType } = req.query;

    // Validate required userId
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

    const uid = new mongoose.Types.ObjectId(userId);
    await ensureTaskMissedNotificationsForUser(uid);

    // Base query: user-scoped + Unread only
    const q = { assignedToUserId: uid, status: "Unread" };

    // entityType validation (Task only for now)
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
});

// ===========================
// NOTIFICATIONS: COUNTS (Unread + Read)
// GET /api/notifications/counts?userId=...&entityType=Task
//
// Purpose:
// - Returns both unread and read counts for a user's notifications.
// - Currently restricted to entityType=Task.
// - Uses Promise.all for efficiency.
// ===========================
app.get("/api/notifications/counts", async (req, res) => {
  try {
    const { userId, entityType } = req.query;

    // Validate required userId
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

    const uid = new mongoose.Types.ObjectId(userId);
    await ensureTaskMissedNotificationsForUser(uid);

    // Base query always user-scoped
    const qBase = { assignedToUserId: uid };

    // Validate entityType (Task only)
    const e = entityType ? String(entityType).trim() : "Task";
    if (!["Task"].includes(e)) return res.status(400).json({ message: "Invalid entityType." });
    qBase.entityType = e;

    // Count unread + read in parallel
    const [unread, read] = await Promise.all([
      Notification.countDocuments({ ...qBase, status: "Unread" }),
      Notification.countDocuments({ ...qBase, status: "Read" }),
    ]);

    return res.json({ unread, read });
  } catch (err) {
    console.error("Counts error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// Start the HTTP server.
// - Uses environment PORT if provided (deployment-friendly)
// - Defaults to 5000 locally
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
