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
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const Admin = require("./models/Admin");
const Agent = require("./models/Agent");
const Prospect = require("./models/Prospect");
const Policyholder = require("./models/Policyholder");
const Lead = require("./models/Lead");
const LeadEngagement = require("./models/LeadEngagement");
const ContactAttempt = require("./models/ContactAttempt");
const ScheduledMeeting = require("./models/ScheduledMeeting");
const NeedsAssessment = require("./models/NeedsAssessment");
const Proposal = require("./models/Proposal");
const Application = require("./models/Application");
const Policy = require("./models/Policy");
const Payment = require("./models/Payment");
const AnnualPayment = require("./models/AnnualPayment");
const LongLeave = require("./models/LongLeave");
const Product = require("./models/Product");
const Task = require("./models/Task");
const Notification = require("./models/Notification");
const KpiAssignment = require("./models/KpiAssignment");

const Unit = require("./models/Unit");
const Branch = require("./models/Branch");
const Area = require("./models/Area");
const BM = require("./models/BM");
const UM = require("./models/UM");
const AUM = require("./models/AUM");
const { createNotificationsRouter } = require("./routes/notificationsRoutes");
const { createAuthRouter } = require("./routes/authRoutes");
const { registerLegacyRoutes } = require("./routes/legacyRoutes");

const app = express();

/**
 * buildManagerPopulateQuery(managerType)
 * ------------------------------------
 * Returns the populate() graph needed to fully hydrate a manager-role record.
 * BM records populate branch directly, while AUM/UM records populate unit then
 * derive the branch/area chain from that unit.
 */
function buildManagerPopulateQuery(managerType = "") {
  const type = String(managerType || "").trim().toUpperCase();
  const populate = [
    {
      path: "userId",
      select: "username password firstName middleName lastName birthday sex age displayPhoto dateEmployed role",
    },
    {
      path: "agentId",
      populate: [
        {
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
        },
      ],
    },
  ];

  if (type === "BM") {
    populate.push({
      path: "branchId",
      select: "branchName areaId",
      populate: {
        path: "areaId",
        select: "areaName",
      },
    });
  } else {
    populate.push({
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
    });
  }

  return populate;
}

/**
 * getManagerProfile(managerDoc)
 * -----------------------------
 * Normalizes the nested populate result of a manager document into a single
 * object containing user, agent, unit, branch, and area references.
 */
function getManagerProfile(managerDoc) {
  const agent = managerDoc?.agentId || {};
  const user = managerDoc?.userId || agent.userId || {};
  const unit = managerDoc?.unitId || agent.unitId || {};
  const branch = managerDoc?.branchId || unit.branchId || agent.unitId?.branchId || {};
  const area = branch.areaId || {};

  return {
    user,
    agent,
    unit,
    branch,
    area,
  };
}

/**
 * getManagerModelByType(typeRaw)
 * ------------------------------
 * Maps a role code (BM/UM/AUM) to its matching Mongoose model.
 */
function getManagerModelByType(typeRaw = "") {
  const type = String(typeRaw || "").trim().toUpperCase();
  if (type === "BM") return BM;
  if (type === "UM") return UM;
  if (type === "AUM") return AUM;
  return null;
}

/**
 * formatManagerRecord(managerDoc, type)
 * ------------------------------------
 * Flattens a populated manager document into the API response shape expected by
 * the admin organization screens.
 */
function formatManagerRecord(managerDoc, type) {
  if (!managerDoc) return null;

  const profile = getManagerProfile(managerDoc);

  return {
    managerId: managerDoc._id,
    agentId: profile.agent?._id || "",
    userId: profile.user?._id || "",
    username: profile.user?.username || "",
    password: profile.user?.password || "",
    firstName: profile.user?.firstName || "",
    middleName: profile.user?.middleName || "",
    lastName: profile.user?.lastName || "",
    birthday: profile.user?.birthday || null,
    sex: profile.user?.sex || "",
    age: profile.user?.age || "",
    displayPhoto: profile.user?.displayPhoto || "",
    dateEmployed: profile.user?.dateEmployed || null,
    managerType: type,
    isBlocked: managerDoc.isBlocked === true,
    blockedAt: managerDoc.blockedAt || null,
    createdAt: managerDoc.createdAt || null,
    updatedAt: managerDoc.updatedAt || null,
    branchId: profile.branch?._id || "",
    branchName: profile.branch?.branchName || "",
    areaId: profile.area?._id || "",
    areaName: profile.area?.areaName || "",
    unitId: type === "BM" ? "" : profile.unit?._id || "",
    unitName: type === "BM" ? "" : profile.unit?.unitName || "",
  };
}

/**
 * matchesManagerScope(managerDoc, managerType, scope)
 * --------------------------------------------------
 * Applies branch/unit scoping rules depending on the manager role being tested.
 */
function matchesManagerScope(managerDoc, managerType, { branchId = "", unitId = "" } = {}) {
  const profile = getManagerProfile(managerDoc);
  if (managerType === "BM") {
    return String(profile.branch?._id || "") === String(branchId || "");
  }

  return String(profile.unit?._id || "") === String(unitId || "");
}

/**
 * matchesSearchTerms(fields, qRaw)
 * -------------------------------
 * Lightweight multi-field search helper used by list payload builders when the
 * filtering logic already runs in memory after querying MongoDB.
 */
function matchesSearchTerms(fields, qRaw) {
  const q = String(qRaw || "").trim().toLowerCase();
  if (!q) return true;

  const values = fields
    .map((field) => String(field || "").trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) return false;

  const combined = values.join(" ");
  if (combined.includes(q)) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return tokens.every((token) => values.some((value) => value.includes(token)));
  }

  return false;
}

/**
 * padSixDigitSequence(value)
 * --------------------------
 * Normalizes a numeric sequence into the fixed six-digit code format used by
 * generated usernames/codes (e.g. 12 -> "000012").
 */
function padSixDigitSequence(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(6, "0");
}

/**
 * escapeRegex(text)
 * -----------------
 * Escapes user-supplied text before embedding it in a RegExp constructor.
 */
function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * getNextRoleSequence(usernames, role)
 * -----------------------------------
 * Scans existing usernames and returns the next available numeric sequence for
 * the requested role prefix.
 */
function getNextRoleSequence(usernames = [], role = "AG") {
  const prefix = String(role || "").trim().toUpperCase();
  const pattern = new RegExp(`^${escapeRegex(prefix)}(\\d{6})$`);

  const maxSequence = usernames.reduce((max, username) => {
    const match = String(username || "").trim().toUpperCase().match(pattern);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return maxSequence + 1;
}

/**
 * buildGeneratedUsername(role, sequenceNumber)
 * -------------------------------------------
 * Composes a system-generated username from a role prefix and padded sequence.
 */
function buildGeneratedUsername(role, sequenceNumber) {
  return `${String(role || "").trim().toUpperCase()}${padSixDigitSequence(sequenceNumber)}`;
}

/**
 * calculateAgeFromDate(value)
 * ---------------------------
 * Calculates current age from a birthday using UTC-safe comparisons.
 */
function calculateAgeFromDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const hasBirthdayPassed =
    today.getUTCMonth() > date.getUTCMonth() ||
    (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() >= date.getUTCDate());

  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * isFutureDate(value)
 * -------------------
 * Returns true when the supplied date falls after today (date-only comparison).
 */
function isFutureDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  date.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);

  return date.getTime() > today.getTime();
}

/**
 * buildGeneratedPassword(role, birthdayValue, sequenceNumber)
 * ----------------------------------------------------------
 * Creates the default generated password pattern used during account creation.
 */
function buildGeneratedPassword(role, birthdayValue, sequenceNumber) {
  const roleCode = String(role || "").trim().toUpperCase();
  const date = birthdayValue instanceof Date ? birthdayValue : new Date(birthdayValue);
  if (Number.isNaN(date.getTime())) return "";

  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = months[date.getUTCMonth()] || "";
  const suffix = padSixDigitSequence(sequenceNumber).slice(-4);

  return `${roleCode}${day}${month}@${suffix}`;
}

async function buildAdminOrganizationListPayload({
  areaSearch = "",
  branchSearch = "",
  unitSearch = "",
  managerSearch = "",
  managerType = "",
  agentSearch = "",
} = {}) {
  // Pull the full hierarchy in parallel so the admin organization screen can
  // build all list/table views from one normalized payload.
  const [areas, branches, units, agents, branchManagers, unitManagers, assistantUnitManagers] = await Promise.all([
    Area.find().sort({ areaName: 1 }).lean(),
    Branch.find().sort({ branchName: 1 }).lean(),
    Unit.find().sort({ unitName: 1 }).lean(),
    Agent.find()
      .populate({
        path: "userId",
        select: "username password firstName middleName lastName birthday sex age displayPhoto dateEmployed role",
      })
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
      .lean(),
    BM.find().populate(buildManagerPopulateQuery("BM")).lean(),
    UM.find().populate(buildManagerPopulateQuery("UM")).lean(),
    AUM.find().populate(buildManagerPopulateQuery("AUM")).lean(),
  ]);

  const areaNameById = new Map(areas.map((area) => [String(area._id), area.areaName || ""]));
  const branchById = new Map(branches.map((branch) => [String(branch._id), branch]));

  // Flatten manager documents once so downstream filters/sequences can work
  // against a consistent response shape regardless of the source model.
  const formattedManagers = {
    bm: branchManagers.map((manager) => formatManagerRecord(manager, "BM")),
    um: unitManagers.map((manager) => formatManagerRecord(manager, "UM")),
    aum: assistantUnitManagers.map((manager) => formatManagerRecord(manager, "AUM")),
  };

  // The UI uses the next sequence values to preview autogenerated credentials
  // before a manager record is actually created.
  const managerSequences = {
    BM: getNextRoleSequence(formattedManagers.bm.map((manager) => manager.username || ""), "BM"),
    UM: getNextRoleSequence(formattedManagers.um.map((manager) => manager.username || ""), "UM"),
    AUM: getNextRoleSequence(formattedManagers.aum.map((manager) => manager.username || ""), "AUM"),
  };

  // Only active managers should occupy the branch/unit "assigned manager"
  // slots in the admin tables; blocked managers remain visible in the manager
  // list itself but are excluded from these active lookups.
  const activeBmByBranchId = new Map(
    formattedManagers.bm.filter((manager) => !manager.isBlocked).map((manager) => [String(manager.branchId), manager])
  );
  const activeUmByUnitId = new Map(
    formattedManagers.um.filter((manager) => !manager.isBlocked).map((manager) => [String(manager.unitId), manager])
  );
  const activeAumByUnitId = new Map(
    formattedManagers.aum.filter((manager) => !manager.isBlocked).map((manager) => [String(manager.unitId), manager])
  );

  const formattedAreas = areas
    .map((area) => ({
      id: area._id,
      areaName: area.areaName,
      createdAt: area.createdAt || null,
      updatedAt: area.updatedAt || null,
    }))
    .filter((area) => matchesSearchTerms([area.areaName], areaSearch));

  const formattedBranches = branches
    .map((branch) => ({
      id: branch._id,
      branchName: branch.branchName,
      areaId: branch.areaId,
      areaName: areaNameById.get(String(branch.areaId)) || "",
      createdAt: branch.createdAt || null,
      updatedAt: branch.updatedAt || null,
      branchManager: activeBmByBranchId.get(String(branch._id)) || null,
    }))
    .filter((branch) => matchesSearchTerms([branch.branchName, branch.areaName], branchSearch));

  const formattedUnits = units
    .map((unit) => {
      const branch = branchById.get(String(unit.branchId)) || null;
      const areaName = branch ? areaNameById.get(String(branch.areaId)) || "" : "";
      return {
        id: unit._id,
        unitName: unit.unitName,
        branchId: unit.branchId,
        branchName: branch?.branchName || "",
        areaName,
        createdAt: unit.createdAt || null,
        updatedAt: unit.updatedAt || null,
        umManager: activeUmByUnitId.get(String(unit._id)) || null,
        aumManager: activeAumByUnitId.get(String(unit._id)) || null,
      };
    })
    .filter((unit) => matchesSearchTerms([unit.unitName, unit.branchName, unit.areaName], unitSearch));

  const requestedManagerType = String(managerType || "").trim().toUpperCase();
  const managerTypes = ["BM", "UM", "AUM"].filter((type) => !requestedManagerType || type === requestedManagerType);
  const formattedFilteredManagers = {
    bm: [],
    um: [],
    aum: [],
  };

  managerTypes.forEach((type) => {
    const key = type.toLowerCase();
    // Manager search intentionally stays in-memory because the same formatted
    // data is already reused by multiple tabs in the response payload.
    formattedFilteredManagers[key] = (formattedManagers[key] || []).filter(
      (manager) =>
        !manager.isBlocked && matchesSearchTerms([manager.username, manager.firstName, manager.lastName], managerSearch)
    );
  });

  const agentOptions = agents
    .map((agent) => ({
      agentId: agent._id,
      userId: agent.userId?._id || "",
      username: agent.userId?.username || "",
      password: agent.userId?.password || "",
      role: agent.userId?.role || "AG",
      firstName: agent.userId?.firstName || "",
      middleName: agent.userId?.middleName || "",
      lastName: agent.userId?.lastName || "",
      birthday: agent.userId?.birthday || null,
      sex: agent.userId?.sex || "",
      age: agent.userId?.age || "",
      displayPhoto: agent.userId?.displayPhoto || "",
      dateEmployed: agent.userId?.dateEmployed || null,
      agentType: agent.agentType || "",
      unitId: agent.unitId?._id || "",
      unitName: agent.unitId?.unitName || "",
      branchId: agent.unitId?.branchId?._id || "",
      branchName: agent.unitId?.branchId?.branchName || "",
      areaId: agent.unitId?.branchId?.areaId?._id || "",
      areaName: agent.unitId?.branchId?.areaId?.areaName || "",
      createdAt: agent.createdAt || null,
      updatedAt: agent.updatedAt || null,
    }))
    .filter((agent) => matchesSearchTerms([agent.username, agent.firstName, agent.lastName], agentSearch));

  return {
    areas: formattedAreas,
    branches: formattedBranches,
    units: formattedUnits,
    agents: agentOptions,
    managers: formattedFilteredManagers,
    managerSequences,
  };
}

async function findActiveManagerForScope(managerType, { branchId = "", unitId = "" } = {}) {
  const ManagerModel = getManagerModelByType(managerType);
  if (!ManagerModel) return null;

  const scopeQuery =
    managerType === "BM"
      ? { branchId, isBlocked: { $ne: true } }
      : { unitId, isBlocked: { $ne: true } };

  const directMatch = await ManagerModel.findOne(scopeQuery).populate(buildManagerPopulateQuery(managerType)).lean();
  if (directMatch) return directMatch;

  const managers = await ManagerModel.find({ isBlocked: { $ne: true } })
    .populate(buildManagerPopulateQuery(managerType))
    .lean();

  return managers.find((manager) => matchesManagerScope(manager, managerType, { branchId, unitId })) || null;
}

async function getManagerScopeContext(user) {
  const normalizedRole = String(user?.role || "").trim().toUpperCase();
  const ManagerModel = getManagerModelByType(normalizedRole);

  if (!ManagerModel) {
    return { error: { status: 400, message: "Invalid manager role." } };
  }

  const manager = await ManagerModel.findOne({ userId: user._id }).populate(buildManagerPopulateQuery(normalizedRole)).lean();

  if (!manager) {
    return {
      error: {
        status: 403,
        message: "No active manager assignment was found for this account. Please contact Admin.",
      },
    };
  }

  if (manager.isBlocked === true) {
    return {
      error: {
        status: 403,
        message: "This manager account has been replaced and can no longer access the portal.",
      },
    };
  }

  const profile = getManagerProfile(manager);

  return {
    role: normalizedRole,
    manager,
    profile,
    managerAgentId: String(profile.agent?._id || ""),
    unitId: String(profile.unit?._id || ""),
    branchId: String(profile.branch?._id || ""),
    unitName: profile.unit?.unitName || "",
    branchName: profile.branch?.branchName || "",
    areaName: profile.area?.areaName || "",
  };
}


const KPI_DEFINITIONS = {
  AGENT: [
    { key: "weekly_approaches", label: "Number of Done Approaches", period: "Weekly", valueType: "Count", targetMin: 50, targetMax: 100, targetValue: null, assigned: true },
    { key: "weekly_appointments", label: "Number of Done Appointments", period: "Weekly", valueType: "Count", targetMin: 10, targetMax: 20, targetValue: null, assigned: true },
    { key: "weekly_presentations", label: "Number of Done Presentations", period: "Weekly", valueType: "Count", targetMin: 5, targetMax: 10, targetValue: null, assigned: true },
    { key: "monthly_policies", label: "Number of Active Policies", period: "Monthly", valueType: "Count", targetMin: 2, targetMax: 6, targetValue: null, assigned: true },
    { key: "monthly_new_prospects", label: "Number of New Prospects", period: "Monthly", valueType: "Count", targetMin: 2, targetMax: 6, targetValue: null, assigned: true },
    { key: "monthly_closing_ratio", label: "Closing Ratio", period: "Monthly", valueType: "Percent", targetMin: 20, targetMax: 50, targetValue: null, assigned: true },
  ],
  UNIT: [
    { key: "monthly_sales_production", label: "Sales Production", period: "Monthly", valueType: "Currency", targetMin: null, targetMax: null, targetValue: null, assigned: true },
  ],
  BRANCH: [
    { key: "monthly_sales_production", label: "Sales Production", period: "Monthly", valueType: "Currency", targetMin: null, targetMax: null, targetValue: null, assigned: true },
    { key: "monthly_active_agents", label: "Number of Active Agents", period: "Monthly", valueType: "Count", targetMin: null, targetMax: null, targetValue: null, assigned: true },
    { key: "monthly_persistency_rate", label: "Branch Persistency Rate", period: "Monthly", valueType: "Percent", targetMin: null, targetMax: null, targetValue: 85, assigned: true },
    { key: "monthly_target_achievement_index", label: "Target Achievement Index", period: "Monthly", valueType: "Percent", targetMin: null, targetMax: null, targetValue: 100, assigned: true },
  ],
};

const KPI_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "Semi-Annually", "Annually"];

function buildDefaultKpiTargets(definition = {}, saved = {}) {
  const savedTargetsByPeriod = new Map(
    (Array.isArray(saved.targets) ? saved.targets : [])
      .map((target) => [String(target?.period || ""), target])
      .filter(([period]) => KPI_FREQUENCIES.includes(period))
  );

  return KPI_FREQUENCIES.map((period) => {
    const target = savedTargetsByPeriod.get(period) || {};
    return {
      period,
      targetMin: target.targetMin !== undefined ? target.targetMin : (saved.targetMin !== undefined ? saved.targetMin : definition.targetMin),
      targetMax: target.targetMax !== undefined ? target.targetMax : (saved.targetMax !== undefined ? saved.targetMax : definition.targetMax),
      targetValue: target.targetValue !== undefined ? target.targetValue : (saved.targetValue !== undefined ? saved.targetValue : definition.targetValue),
    };
  });
}

function normalizeKpiList(scopeType, savedKpis = []) {
  const defaults = KPI_DEFINITIONS[scopeType] || [];
  const savedByKey = new Map((Array.isArray(savedKpis) ? savedKpis : []).map((kpi) => [String(kpi?.key || ""), kpi]));
  return defaults.map((definition) => {
    const saved = savedByKey.get(definition.key) || {};
    const assigned = saved.assigned !== undefined ? saved.assigned === true : definition.assigned;
    const targets = buildDefaultKpiTargets(definition, saved);
    const normalizedPeriod = KPI_FREQUENCIES.includes(String(saved.period || "")) ? saved.period : definition.period;
    const primaryTarget = targets.find((target) => target.period === normalizedPeriod) || targets[0] || {};
    return {
      ...definition,
      assigned,
      period: normalizedPeriod,
      targetMin: primaryTarget.targetMin ?? null,
      targetMax: primaryTarget.targetMax ?? null,
      targetValue: primaryTarget.targetValue ?? null,
      targets,
    };
  });
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function buildKpiAssignmentPayload(user) {
  await reactivateEndedLongLeaveAgents();
  const context = await getManagerScopeContext(user);
  if (context.error) return context;

  const role = context.role;
  const branchId = context.branchId;
  const branchName = context.branchName || "Branch";
  const unitName = context.unitName || "Unit";

  const scopes = role === "BM"
    ? [
        {
          scopeType: "AGENT",
          scopeId: branchId,
          code: "",
          name: "All Agents in Branch",
          unitName: "All Units",
          branchName,
        },
        {
          scopeType: "UNIT",
          scopeId: branchId,
          code: "",
          name: "All Units in Branch",
          unitName: "All Units",
          branchName,
        },
        {
          scopeType: "BRANCH",
          scopeId: branchId,
          code: "",
          name: branchName,
          unitName: "—",
          branchName,
        },
      ]
    : [
        {
          scopeType: "AGENT",
          scopeId: branchId,
          code: "",
          name: "All Agents in Branch",
          unitName: "All Units",
          branchName,
        },
        {
          scopeType: "UNIT",
          scopeId: branchId,
          code: "",
          name: "All Units in Branch",
          unitName,
          branchName,
        },
        {
          scopeType: "BRANCH",
          scopeId: branchId,
          code: "",
          name: branchName,
          unitName: "—",
          branchName,
        },
      ];

  const assignmentDocs = scopes.length
    ? await KpiAssignment.find({
        $or: scopes.map((scope) => ({ scopeType: scope.scopeType, scopeId: scope.scopeId })),
      }).lean()
    : [];
  const assignmentByScope = new Map(assignmentDocs.map((doc) => [`${doc.scopeType}:${doc.scopeId}`, doc]));

  return {
    payload: {
      scope: {
        role,
        unitId: context.unitId,
        unitName: context.unitName,
        branchId: context.branchId,
        branchName: context.branchName,
        areaName: context.areaName,
      },
      canEdit: role === "BM",
      assignments: scopes.map((scope) => {
        const saved = assignmentByScope.get(`${scope.scopeType}:${scope.scopeId}`);
        return {
          ...scope,
          kpis: normalizeKpiList(scope.scopeType, saved?.kpis || []),
          updatedAt: saved?.updatedAt || null,
        };
      }),
    },
  };
}


async function reactivateEndedLongLeaveAgents(referenceDate = new Date()) {
  const endedLeaves = await LongLeave.find({
    status: "Endorsed",
    leaveEndDate: { $lt: referenceDate },
  }).select("agentId").lean();
  const agentIds = [...new Set(endedLeaves.map((leave) => String(leave.agentId || "")).filter(Boolean))];
  if (!agentIds.length) return 0;
  const result = await Agent.updateMany(
    { _id: { $in: agentIds }, status: "On Long Leave" },
    { $set: { status: "Active" } },
  );
  return Number(result?.modifiedCount || 0);
}

function formatLongLeaveNotificationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" });
}

function buildLongLeaveEndorsementNotificationMessage(longLeave = {}) {
  const prospects = Array.isArray(longLeave.affectedProspects) ? longLeave.affectedProspects : [];
  const policyholders = Array.isArray(longLeave.affectedPolicyholders) ? longLeave.affectedPolicyholders : [];
  const prospectText = prospects.length
    ? `Prospects with active leads endorsed: ${prospects.map((prospect) => `${prospect.prospectCode || "—"} / ${prospect.leadCode || "—"} / ${prospect.name || "—"}`).join("; ")}.`
    : "Prospects with active leads endorsed: None.";
  const policyholderText = policyholders.length
    ? `Policyholders with ongoing policies endorsed: ${policyholders.map((policyholder) => `${policyholder.policyholderCode || "—"} / ${policyholder.productName || "—"} / ${policyholder.policyNumber || "—"} / ${policyholder.status || "—"}`).join("; ")}.`
    : "Policyholders with ongoing policies endorsed: None.";
  return `${prospectText} ${policyholderText}`;
}

async function buildManagerPortalPayload(user, { taskDatePreset = "ALL", salesDatePreset = "ALL", unitPerformanceDatePreset = "ALL" } = {}) {
  await reactivateEndedLongLeaveAgents();
  const context = await getManagerScopeContext(user);
  if (context.error) return context;

  const buildPresetContext = (presetRaw = "ALL") => {
    const preset = String(presetRaw || "ALL").trim().toUpperCase();
    const now = new Date();
    if (preset === "TODAY") {
      const startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      return { key: "TODAY", startDate, periodLabel: "Today" };
    }
    const rollingPresets = {
      "7D": [7, "7d", "Last 7 days"],
      "30D": [30, "30d", "Last 30 days"],
      "90D": [90, "90d", "Last 90 days"],
      "6M": [183, "6m", "Last six months"],
      "12M": [365, "12m", "Last 12 months"],
    };
    if (rollingPresets[preset]) {
      const [days, key, periodLabel] = rollingPresets[preset];
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      return { key, startDate, periodLabel };
    }
    return { key: "ALL", startDate: null, periodLabel: "All time" };
  };

  const taskContext = buildPresetContext(taskDatePreset);
  const salesContext = buildPresetContext(salesDatePreset);
  const unitPerformanceContext = buildPresetContext(unitPerformanceDatePreset);

  const isWithinPreset = (value, presetContext, fallbackValue = null) => {
    if (!presetContext?.startDate) return true;
    const candidates = [value, fallbackValue];
    for (const candidate of candidates) {
      const candidateDate = new Date(candidate);
      if (!Number.isNaN(candidateDate.getTime())) {
        return candidateDate >= presetContext.startDate;
      }
    }
    return false;
  };

  const createMetricsMap = (agents) =>
    new Map(
      agents.map((agent) => {
        const assignedUserId = String(agent?.userId?._id || "");
        const fullName = [agent?.userId?.firstName, agent?.userId?.middleName, agent?.userId?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();

        return [
          assignedUserId,
          {
            id: String(agent?._id || assignedUserId),
            userId: assignedUserId,
            username: agent?.userId?.username || "",
            firstName: agent?.userId?.firstName || "",
            middleName: agent?.userId?.middleName || "",
            lastName: agent?.userId?.lastName || "",
            name: fullName || agent?.userId?.username || "—",
            unit: agent?.unitId?.unitName || "",
            branch: agent?.unitId?.branchId?.branchName || "",
            area: agent?.unitId?.branchId?.areaId?.areaName || "",
            displayPhoto: agent?.userId?.displayPhoto || "",
            dateEmployed: agent?.userId?.dateEmployed || null,
            agentType: agent?.agentType || "",
            status: agent?.status || "Active",
            sex: agent?.userId?.sex || "",
            birthday: agent?.userId?.birthday || null,
            age: agent?.userId?.age || null,
            promotionHistory: Array.isArray(agent?.promotionHistory) ? agent.promotionHistory : [],
            totalTasks: 0,
            completedApproaches: 0,
            completedAppointments: 0,
            completedPresentations: 0,
            openTasks: 0,
            openApproachTasksDueThisWeek: 0,
            overdueTasks: 0,
            closedTasks: 0,
            delayedDoneTasks: 0,
            completionRate: 0,
            nextDueAt: null,
            lastCompletedAt: null,
            topTaskType: "—",
            totalProspects: 0,
            activeProspects: 0,
            activeProspectIds: new Set(),
            leads: 0,
            activeLeads: 0,
            converted: 0,
            submittedApplications: 0,
            totalPolicies: 0,
            activePolicies: 0,
            atRiskPolicies: 0,
            lapsedPolicies: 0,
            cancelledPolicies: 0,
            annualPremium: 0,
            frequencyPremium: 0,
            monthlyPremium: 0,
            quarterlyPremium: 0,
            halfYearlyPremium: 0,
            yearlyPremium: 0,
            latestLeadCreatedAt: null,
            latestPolicyIssuedAt: null,
            latestPolicyStatus: "—",
            taskTypeCounts: new Map(),
            convertedLeadIds: new Set(),
          },
        ];
      })
    );

  const buildRows = (metricsByUserId) =>
    [...metricsByUserId.values()].map((metrics) => {
      const topTaskTypeEntry = [...metrics.taskTypeCounts.entries()].sort(
        (left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0]))
      )[0];
      const completionRate = metrics.totalTasks ? Math.round((metrics.closedTasks / metrics.totalTasks) * 100) : 0;
      const conversionRate = metrics.leads ? Math.round((metrics.convertedLeadIds.size / metrics.leads) * 100) : 0;

      return {
        id: metrics.id,
        userId: metrics.userId,
        username: metrics.username,
        firstName: metrics.firstName,
        middleName: metrics.middleName,
        lastName: metrics.lastName,
        name: metrics.name,
        unit: metrics.unit,
        branch: metrics.branch,
        area: metrics.area,
        displayPhoto: metrics.displayPhoto,
        dateEmployed: metrics.dateEmployed,
        agentType: metrics.agentType,
        status: metrics.status,
        sex: metrics.sex,
        birthday: metrics.birthday,
        age: metrics.age,
        promotionHistory: metrics.promotionHistory,
        totalTasks: metrics.totalTasks,
        completedApproaches: metrics.completedApproaches,
        completedAppointments: metrics.completedAppointments,
        completedPresentations: metrics.completedPresentations,
        openTasks: metrics.openTasks,
        openApproachTasksDueThisWeek: metrics.openApproachTasksDueThisWeek,
        overdueTasks: metrics.overdueTasks,
        closedTasks: metrics.closedTasks,
        delayedDoneTasks: metrics.delayedDoneTasks,
        completionRate,
        nextDueAt: metrics.nextDueAt,
        lastCompletedAt: metrics.lastCompletedAt,
        topTaskType: topTaskTypeEntry?.[0] || "—",
        totalProspects: metrics.totalProspects,
        activeProspects: metrics.activeProspects,
        leads: metrics.leads,
        activeLeads: metrics.activeLeads,
        converted: metrics.convertedLeadIds.size,
        submittedApplications: metrics.submittedApplications,
        conversionRate,
        totalPolicies: metrics.totalPolicies,
        activePolicies: metrics.activePolicies,
        atRiskPolicies: metrics.atRiskPolicies,
        lapsedPolicies: metrics.lapsedPolicies,
        cancelledPolicies: metrics.cancelledPolicies,
        annualPremium: metrics.annualPremium,
        frequencyPremium: metrics.frequencyPremium,
        monthlyPremium: metrics.monthlyPremium,
        quarterlyPremium: metrics.quarterlyPremium,
        halfYearlyPremium: metrics.halfYearlyPremium,
        yearlyPremium: metrics.yearlyPremium,
        latestLeadCreatedAt: metrics.latestLeadCreatedAt,
        latestPolicyIssuedAt: metrics.latestPolicyIssuedAt,
        latestPolicyStatus: metrics.latestPolicyStatus,
      };
    });

  const summarizeRows = (rows) => {
    const summary = rows.reduce(
      (accumulator, row) => ({
        totalAgents: accumulator.totalAgents + 1,
        totalOpenTasks: accumulator.totalOpenTasks + Number(row.openTasks || 0),
        totalOverdueTasks: accumulator.totalOverdueTasks + Number(row.overdueTasks || 0),
        totalClosedTasks: accumulator.totalClosedTasks + Number(row.closedTasks || 0),
        totalProspects: accumulator.totalProspects + Number(row.totalProspects || 0),
        totalActiveProspects: accumulator.totalActiveProspects + Number(row.activeProspects || 0),
        totalLeads: accumulator.totalLeads + Number(row.leads || 0),
        totalActiveLeads: accumulator.totalActiveLeads + Number(row.activeLeads || 0),
        totalConverted: accumulator.totalConverted + Number(row.converted || 0),
        totalPolicies: accumulator.totalPolicies + Number(row.totalPolicies || 0),
        activePolicies: accumulator.activePolicies + Number(row.activePolicies || 0),
        atRiskPolicies: accumulator.atRiskPolicies + Number(row.atRiskPolicies || 0),
        lapsedPolicies: accumulator.lapsedPolicies + Number(row.lapsedPolicies || 0),
        totalAnnualPremium: accumulator.totalAnnualPremium + Number(row.annualPremium || 0),
        totalFrequencyPremium: accumulator.totalFrequencyPremium + Number(row.frequencyPremium || 0),
        frequencyPremiumBreakdown: {
          monthlyPremium: accumulator.frequencyPremiumBreakdown.monthlyPremium + Number(row.monthlyPremium || 0),
          quarterlyPremium: accumulator.frequencyPremiumBreakdown.quarterlyPremium + Number(row.quarterlyPremium || 0),
          halfYearlyPremium: accumulator.frequencyPremiumBreakdown.halfYearlyPremium + Number(row.halfYearlyPremium || 0),
          yearlyPremium: accumulator.frequencyPremiumBreakdown.yearlyPremium + Number(row.yearlyPremium || 0),
        },
      }),
      {
        totalAgents: 0,
        totalOpenTasks: 0,
        totalOverdueTasks: 0,
        totalClosedTasks: 0,
        totalProspects: 0,
        totalActiveProspects: 0,
        totalLeads: 0,
        totalActiveLeads: 0,
        totalConverted: 0,
        totalPolicies: 0,
        activePolicies: 0,
        atRiskPolicies: 0,
        lapsedPolicies: 0,
        totalAnnualPremium: 0,
        totalFrequencyPremium: 0,
        frequencyPremiumBreakdown: {
          monthlyPremium: 0,
          quarterlyPremium: 0,
          halfYearlyPremium: 0,
          yearlyPremium: 0,
        },
      }
    );

    summary.conversionRate = summary.totalLeads ? Math.round((summary.totalConverted / summary.totalLeads) * 100) : 0;
    summary.completionRate = summary.totalOpenTasks + summary.totalClosedTasks
      ? Math.round((summary.totalClosedTasks / (summary.totalOpenTasks + summary.totalClosedTasks)) * 100)
      : 0;
    summary.activePolicyRate = summary.totalPolicies ? Math.round((summary.activePolicies / summary.totalPolicies) * 100) : 0;
    return summary;
  };

  const normalizeFrequencyKey = (frequencyValue) => {
    const normalized = String(frequencyValue || "").trim().toLowerCase();
    if (normalized === "monthly") return "monthlyPremium";
    if (normalized === "quarterly") return "quarterlyPremium";
    if (normalized === "half-yearly" || normalized === "half yearly" || normalized === "semi-annual" || normalized === "semi annual" || normalized === "semi-annually" || normalized === "semi annually") {
      return "halfYearlyPremium";
    }
    if (normalized === "yearly" || normalized === "annual" || normalized === "annually") return "yearlyPremium";
    return null;
  };

  const agentQuery = {};
  if (context.role === "BM") {
    const branchUnits = await Unit.find({ branchId: context.branchId }).select("_id").lean();
    agentQuery.unitId = { $in: branchUnits.map((unit) => unit._id) };
  } else {
    agentQuery.unitId = context.unitId;
  }

  const scopedAgents = await Agent.find(agentQuery)
    .populate({
      path: "userId",
      select: "username firstName middleName lastName birthday sex age displayPhoto dateEmployed role",
    })
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

  const scopedUnits = context.role === "BM"
    ? await Unit.find({ branchId: context.branchId }).sort({ unitName: 1 }).lean()
    : await Unit.find({ _id: context.unitId }).sort({ unitName: 1 }).lean();
  const scopedUnitIds = scopedUnits.map((unit) => unit._id);
  const [unitManagers, assistantUnitManagers] = await Promise.all([
    scopedUnitIds.length
      ? UM.find({ unitId: { $in: scopedUnitIds }, isBlocked: { $ne: true } })
          .populate({ path: "userId", select: "username firstName middleName lastName" })
          .lean()
      : [],
    scopedUnitIds.length
      ? AUM.find({ unitId: { $in: scopedUnitIds }, isBlocked: { $ne: true } })
          .populate({ path: "userId", select: "username firstName middleName lastName" })
          .lean()
      : [],
  ]);
  const formatUnitManager = (manager) => {
    const userDoc = manager?.userId || {};
    return {
      userId: String(userDoc._id || ""),
      code: userDoc.username || "—",
      name: [userDoc.firstName, userDoc.middleName, userDoc.lastName].filter(Boolean).join(" ").trim() || userDoc.username || "—",
    };
  };
  const umByUnitId = new Map(unitManagers.map((manager) => [String(manager.unitId || ""), formatUnitManager(manager)]));
  const aumByUnitId = new Map(assistantUnitManagers.map((manager) => [String(manager.unitId || ""), formatUnitManager(manager)]));

  const scopedAgentIds = scopedAgents.map((agent) => agent._id).filter(Boolean);
  const scopedUserIds = scopedAgents.map((agent) => agent.userId?._id).filter(Boolean);
  const agentIdByUserId = new Map(
    scopedAgents.map((agent) => [String(agent?.userId?._id || ""), String(agent?._id || "")]).filter(([userId, agentId]) => userId && agentId)
  );
  const allMetricsByUserId = createMetricsMap(scopedAgents);
  const taskMetricsByUserId = createMetricsMap(scopedAgents);
  const salesMetricsByUserId = createMetricsMap(scopedAgents);

  const [tasks, prospects, longLeaves] = await Promise.all([
    scopedUserIds.length
      ? Task.find({ assignedToUserId: { $in: scopedUserIds }, softDeletedAt: null })
          .select("assignedToUserId type title dueAt status completedAt wasDelayed createdAt")
          .lean()
      : [],
    scopedUserIds.length
      ? Prospect.find({ assignedToUserId: { $in: scopedUserIds } })
          .select("_id assignedToUserId prospectCode firstName middleName lastName marketType prospectType status createdAt")
          .lean()
      : [],
    scopedAgentIds.length || scopedUserIds.length
      ? LongLeave.find({
          $or: [
            ...(scopedAgentIds.length ? [{ agentId: { $in: scopedAgentIds } }] : []),
            ...(scopedUserIds.length ? [{ userId: { $in: scopedUserIds } }] : []),
          ],
        })
          .select("agentId userId leaveStartDate leaveEndDate leaveApplicationForm approvedLeaveProof status includeOngoingPolicyholders affectedProspects affectedPolicyholders createdAt updatedAt")
          .sort({ createdAt: -1, _id: -1 })
          .lean()
      : [],
  ]);

  const longLeaveRecordsByAgentId = new Map();
  for (const longLeave of longLeaves) {
    const agentId = String(longLeave?.agentId || agentIdByUserId.get(String(longLeave?.userId || "")) || "");
    if (!agentId) continue;
    const records = longLeaveRecordsByAgentId.get(agentId) || [];
    records.push({
      id: String(longLeave._id),
      leaveStartDate: longLeave.leaveStartDate || null,
      leaveEndDate: longLeave.leaveEndDate || null,
      status: longLeave.status || "Recorded",
      includeOngoingPolicyholders: longLeave.includeOngoingPolicyholders === true,
      affectedProspects: Array.isArray(longLeave.affectedProspects) ? longLeave.affectedProspects : [],
      affectedPolicyholders: Array.isArray(longLeave.affectedPolicyholders) ? longLeave.affectedPolicyholders : [],
      leaveApplicationForm: longLeave.leaveApplicationForm || null,
      approvedLeaveProof: longLeave.approvedLeaveProof || null,
      createdAt: longLeave.createdAt || null,
      updatedAt: longLeave.updatedAt || null,
    });
    longLeaveRecordsByAgentId.set(agentId, records);
  }

  const nowMs = Date.now();
  const currentWeekStart = new Date(nowMs);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
  const currentWeekStartMs = currentWeekStart.getTime();
  const currentWeekEndMs = currentWeekEnd.getTime();
  const applyTaskMetrics = (taskList, metricsByUserId) => {
    for (const task of taskList) {
      const assignedUserId = String(task?.assignedToUserId || "");
      const metrics = metricsByUserId.get(assignedUserId);
      if (!metrics) continue;

      metrics.totalTasks += 1;
      const taskType = String(task?.type || "").trim().toUpperCase() || "UNSPECIFIED";
      metrics.taskTypeCounts.set(taskType, Number(metrics.taskTypeCounts.get(taskType) || 0) + 1);

      const normalizedStatus = String(task?.status || "Open").toLowerCase() === "done" ? "Done" : "Open";
      const dueAtMs = new Date(task?.dueAt).getTime();
      const completedAtMs = new Date(task?.completedAt).getTime();

      if (normalizedStatus === "Done") {
        metrics.closedTasks += 1;
        if (taskType === "APPROACH") metrics.completedApproaches += 1;
        else if (taskType === "APPOINTMENT") metrics.completedAppointments += 1;
        else if (taskType === "PRESENTATION") metrics.completedPresentations += 1;
        if (task?.wasDelayed) metrics.delayedDoneTasks += 1;
        if (Number.isFinite(completedAtMs) && (!metrics.lastCompletedAt || completedAtMs > new Date(metrics.lastCompletedAt).getTime())) {
          metrics.lastCompletedAt = task.completedAt;
        }
        continue;
      }

      const isDueThisWeek = Number.isFinite(dueAtMs) && dueAtMs >= currentWeekStartMs && dueAtMs < currentWeekEndMs;
      if (taskType === "APPROACH" && isDueThisWeek) metrics.openApproachTasksDueThisWeek += 1;

      const isOverdue = Number.isFinite(dueAtMs) && dueAtMs < nowMs;
      if (isOverdue) metrics.overdueTasks += 1;
      else metrics.openTasks += 1;
      if (Number.isFinite(dueAtMs) && (!metrics.nextDueAt || dueAtMs < new Date(metrics.nextDueAt).getTime())) {
        metrics.nextDueAt = task.dueAt;
      }
    }
  };

  applyTaskMetrics(tasks, allMetricsByUserId);
  applyTaskMetrics(
    tasks.filter((task) => isWithinPreset(
      String(task?.status || "").toLowerCase() === "done" ? task?.completedAt : task?.dueAt,
      taskContext,
      task?.createdAt
    )),
    taskMetricsByUserId
  );


  const applyProspectMetrics = (prospectList, metricsByUserId) => {
    for (const prospect of prospectList) {
      const assignedUserId = String(prospect?.assignedToUserId || "");
      const metrics = metricsByUserId.get(assignedUserId);
      if (!metrics) continue;
      metrics.totalProspects += 1;
      if (String(prospect?.status || "").trim() === "Active") metrics.activeProspects += 1;
    }
  };

  applyProspectMetrics(prospects, allMetricsByUserId);

  const prospectIds = prospects.map((prospect) => prospect._id);
  const prospectIdToAssignedUserId = new Map(
    prospects.map((prospect) => [String(prospect._id), String(prospect.assignedToUserId || "")])
  );

  const leads = prospectIds.length
    ? await Lead.find({ prospectId: { $in: prospectIds } })
        .select("_id leadCode prospectId source otherSource status createdAt")
        .lean()
    : [];
  const leadIds = leads.map((lead) => lead._id);
  const leadIdToAssignedUserId = new Map(
    leads.map((lead) => [String(lead._id), prospectIdToAssignedUserId.get(String(lead.prospectId)) || ""])
  );
  const leadIdToProspectId = new Map(
    leads.map((lead) => [String(lead._id), String(lead.prospectId || "")])
  );


  const prospectById = new Map(prospects.map((prospect) => [String(prospect._id), prospect]));
  const activeLeadProspectIds = new Set();
  const orphanTransferProspectsByUserId = new Map();
  for (const lead of leads.filter((item) => ["New", "In Progress"].includes(String(item?.status || "")))) {
    const prospectId = String(lead?.prospectId || "");
    const prospect = prospectById.get(prospectId);
    if (!prospect) continue;
    const assignedUserId = String(prospect.assignedToUserId || "");
    if (!assignedUserId) continue;
    const fullName = [prospect.firstName, prospect.middleName, prospect.lastName].filter(Boolean).join(" ").trim();
    const source = String(lead?.source || "").trim();
    const rows = orphanTransferProspectsByUserId.get(assignedUserId) || [];
    activeLeadProspectIds.add(prospectId);
    rows.push({
      id: String(lead._id),
      prospectId,
      prospectCode: prospect.prospectCode || "—",
      leadCode: lead.leadCode || "—",
      name: fullName || "—",
      source: source === "Other" ? (lead.otherSource ? `Other - ${lead.otherSource}` : "Other") : (source || "—"),
      status: lead.status || "—",
      marketType: prospect.marketType || "—",
      prospectType: prospect.prospectType || "—",
    });
    orphanTransferProspectsByUserId.set(assignedUserId, rows);
  }

  const engagements = leadIds.length
    ? await LeadEngagement.find({ leadId: { $in: leadIds } })
        .select("_id leadId")
        .lean()
    : [];
  const engagementIds = engagements.map((engagement) => engagement._id);
  const engagementIdToAssignedUserId = new Map(
    engagements.map((engagement) => [String(engagement._id), leadIdToAssignedUserId.get(String(engagement.leadId)) || ""])
  );
  const engagementIdToLeadId = new Map(
    engagements.map((engagement) => [String(engagement._id), String(engagement.leadId || "")])
  );

  const [policyholders, policies, applications, needsAssessments, payments, annualPayments] = await Promise.all([
    scopedUserIds.length || engagementIds.length
      ? Policyholder.find({
          $or: [
            ...(scopedUserIds.length ? [{ assignedToUserId: { $in: scopedUserIds } }] : []),
            ...(engagementIds.length ? [{ leadEngagementId: { $in: engagementIds } }] : []),
          ],
        })
          .select("assignedToUserId leadEngagementId productId policyholderCode policyNumber status createdAt")
          .populate({ path: "productId", select: "productName" })
          .lean()
      : [],
    engagementIds.length
      ? Policy.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId recordPolicyApplicationStatus.issuanceDate uploadPolicySummary.policyNumber")
          .lean()
      : [],
    engagementIds.length
      ? Application.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId recordApplicationSubmission.savedAt recordApplicationSubmission.pruOneTransactionId recordPremiumPaymentTransfer")
          .lean()
      : [],
    engagementIds.length
      ? NeedsAssessment.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId needsPriorities.productSelection.requestedFrequency")
          .lean()
      : [],
    engagementIds.length
      ? Payment.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId annualPaymentId recordPremiumPaymentTransfer.totalPremiumPaidPhp recordPremiumPaymentTransfer.frequencyOfPremiumPayment")
          .lean()
      : [],
    engagementIds.length
      ? AnnualPayment.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId totalAnnualPremiumPhp frequencyOfPayment")
          .lean()
      : [],
  ]);

  const prospectNameById = new Map(
    prospects.map((prospect) => [
      String(prospect._id),
      [prospect.firstName, prospect.middleName, prospect.lastName].filter(Boolean).join(" ").trim() || "—",
    ])
  );
  const policyByEngagementId = new Map(
    policies.map((policy) => [String(policy?.leadEngagementId || ""), policy])
  );

  const ongoingPolicyholderStatuses = new Set(["Active", "At Risk", "Lapsed", "Paid-Up"]);
  const activeLeadOngoingPoliciesByProspectId = new Map();
  const orphanTransferPolicyholdersByUserId = new Map();
  for (const policyholder of policyholders) {
    if (!ongoingPolicyholderStatuses.has(String(policyholder?.status || ""))) continue;
    const assignedUserId = String(
      policyholder?.assignedToUserId || engagementIdToAssignedUserId.get(String(policyholder?.leadEngagementId || "")) || ""
    );
    if (!assignedUserId) continue;
    const engagementId = String(policyholder?.leadEngagementId || "");
    const leadId = engagementIdToLeadId.get(engagementId) || "";
    const prospectId = leadIdToProspectId.get(leadId) || "";
    const policy = policyByEngagementId.get(engagementId);
    const policyholderRow = {
      id: String(policyholder._id),
      policyholderCode: policyholder.policyholderCode || "—",
      policyholderName: prospectNameById.get(prospectId) || "—",
      productName: policyholder.productId?.productName || "—",
      policyNumber: policyholder.policyNumber || policy?.uploadPolicySummary?.policyNumber || "—",
      policyIssuanceDate: policy?.recordPolicyApplicationStatus?.issuanceDate || null,
      status: policyholder.status || "—",
    };
    if (activeLeadProspectIds.has(prospectId)) {
      const activeLeadPolicies = activeLeadOngoingPoliciesByProspectId.get(prospectId) || [];
      activeLeadPolicies.push(policyholderRow);
      activeLeadOngoingPoliciesByProspectId.set(prospectId, activeLeadPolicies);
      continue;
    }
    const rows = orphanTransferPolicyholdersByUserId.get(assignedUserId) || [];
    rows.push(policyholderRow);
    orphanTransferPolicyholdersByUserId.set(assignedUserId, rows);
  }

  for (const rows of orphanTransferProspectsByUserId.values()) {
    rows.forEach((row) => {
      row.ongoingPolicies = activeLeadOngoingPoliciesByProspectId.get(String(row.prospectId || "")) || [];
    });
  }

  const engagementIdToFrequency = new Map(
    needsAssessments.map((needsAssessment) => [
      String(needsAssessment?.leadEngagementId || ""),
      String(needsAssessment?.needsPriorities?.productSelection?.requestedFrequency || "").trim(),
    ])
  );

  annualPayments.forEach((annualPayment) => {
    const engagementId = String(annualPayment?.leadEngagementId || "");
    const finalFrequency = String(annualPayment?.frequencyOfPayment || "").trim();
    if (engagementId && finalFrequency) engagementIdToFrequency.set(engagementId, finalFrequency);
  });

  payments.forEach((payment) => {
    const engagementId = String(payment?.leadEngagementId || "");
    const finalFrequency = String(payment?.recordPremiumPaymentTransfer?.frequencyOfPremiumPayment || "").trim();
    if (engagementId && finalFrequency) engagementIdToFrequency.set(engagementId, finalFrequency);
  });

  const engagementIdToPayment = new Map(
    payments.map((payment) => [String(payment?.leadEngagementId || ""), payment]).filter(([engagementId]) => engagementId)
  );
  const engagementIdToAnnualPayment = new Map(
    annualPayments.map((annualPayment) => [String(annualPayment?.leadEngagementId || ""), annualPayment]).filter(([engagementId]) => engagementId)
  );

  const applySalesMetrics = ({ leadList, metricsByUserId, policyholderList, applicationList }) => {
    for (const lead of leadList) {
      const assignedUserId = leadIdToAssignedUserId.get(String(lead._id)) || "";
      const metrics = metricsByUserId.get(assignedUserId);
      if (!metrics) continue;

      metrics.leads += 1;
      if (["New", "In Progress"].includes(String(lead?.status || "").trim())) {
        metrics.activeLeads += 1;
        if (lead?.prospectId) metrics.activeProspectIds.add(String(lead.prospectId));
      }
      const leadCreatedAtMs = new Date(lead?.createdAt).getTime();
      if (Number.isFinite(leadCreatedAtMs) && (!metrics.latestLeadCreatedAt || leadCreatedAtMs > new Date(metrics.latestLeadCreatedAt).getTime())) {
        metrics.latestLeadCreatedAt = lead.createdAt;
      }
    }

    const activePolicyholderEngagementIds = new Set(
      (policyholderList || [])
        .filter((policyholder) => String(policyholder?.status || "").trim() === "Active")
        .map((policyholder) => String(policyholder?.leadEngagementId || ""))
        .filter(Boolean)
    );

    for (const policyholder of policyholderList) {
      const assignedUserId = String(
        policyholder?.assignedToUserId || engagementIdToAssignedUserId.get(String(policyholder?.leadEngagementId || "")) || ""
      );
      const metrics = metricsByUserId.get(assignedUserId);
      if (!metrics) continue;

      metrics.totalPolicies += 1;
      const policyStatus = String(policyholder?.status || "").trim();
      if (policyStatus === "Active") metrics.activePolicies += 1;
      else if (policyStatus === "At Risk") metrics.atRiskPolicies += 1;
      else if (policyStatus === "Lapsed") metrics.lapsedPolicies += 1;
      else if (policyStatus === "Cancelled") metrics.cancelledPolicies += 1;

      const leadId = engagementIdToLeadId.get(String(policyholder?.leadEngagementId || ""));
      if (leadId) metrics.convertedLeadIds.add(leadId);

      const policyCreatedAtMs = new Date(policyholder?.createdAt).getTime();
      if (Number.isFinite(policyCreatedAtMs) && (!metrics.latestPolicyIssuedAt || policyCreatedAtMs > new Date(metrics.latestPolicyIssuedAt).getTime())) {
        metrics.latestPolicyIssuedAt = policyholder.createdAt;
        metrics.latestPolicyStatus = policyStatus || "—";
      }
    }

    for (const application of applicationList) {
      const engagementId = String(application?.leadEngagementId || "");
      const assignedUserId = engagementIdToAssignedUserId.get(engagementId) || "";
      const metrics = metricsByUserId.get(assignedUserId);
      if (!metrics) continue;

      const submittedAt = new Date(application?.recordApplicationSubmission?.savedAt).getTime();
      const hasSubmission = Number.isFinite(submittedAt) || String(application?.recordApplicationSubmission?.pruOneTransactionId || "").trim();
      if (hasSubmission) metrics.submittedApplications += 1;

      if (!activePolicyholderEngagementIds.has(engagementId)) continue;

      const payment = engagementIdToPayment.get(engagementId) || null;
      const annualPayment = engagementIdToAnnualPayment.get(engagementId) || null;
      const annualPremium = Number(annualPayment?.totalAnnualPremiumPhp || 0);
      const frequencyPremium = Number(payment?.recordPremiumPaymentTransfer?.totalPremiumPaidPhp ?? 0);
      metrics.annualPremium += annualPremium;
      metrics.frequencyPremium += frequencyPremium;

      const frequencyKey = normalizeFrequencyKey(engagementIdToFrequency.get(engagementId));
      if (frequencyKey) metrics[frequencyKey] += frequencyPremium;
    }
  };

  applySalesMetrics({
    leadList: leads,
    metricsByUserId: allMetricsByUserId,
    policyholderList: policyholders,
    applicationList: applications,
  });

  const buildSalesMetricInput = (presetContext) => {
    const filteredLeadIds = new Set(
      leads
        .filter((lead) => isWithinPreset(lead?.createdAt, presetContext))
        .map((lead) => String(lead._id))
    );
    const filteredLeads = leads.filter((lead) => filteredLeadIds.has(String(lead._id)));
    const filteredPolicyholders = policyholders.filter((policyholder) => isWithinPreset(policyholder?.createdAt, presetContext));
    const filteredApplications = applications.filter((application) => {
      const engagementId = String(application?.leadEngagementId || "");
      if (!engagementIdToAssignedUserId.get(engagementId)) return false;
      const submittedAt = application?.recordApplicationSubmission?.savedAt;
      if (submittedAt) return isWithinPreset(submittedAt, presetContext);
      return !presetContext?.startDate && String(application?.recordApplicationSubmission?.pruOneTransactionId || "").trim();
    });

    return {
      leadList: filteredLeads,
      policyholderList: filteredPolicyholders,
      applicationList: filteredApplications,
    };
  };

  const buildRowsForSalesContext = (presetContext) => {
    const metricsByUserId = createMetricsMap(scopedAgents);
    applySalesMetrics({
      ...buildSalesMetricInput(presetContext),
      metricsByUserId,
    });
    return buildRows(metricsByUserId);
  };

  const buildRowsForUnitPerformanceContext = (presetContext) => {
    const metricsByUserId = createMetricsMap(scopedAgents);
    applyTaskMetrics(
      tasks.filter((task) => isWithinPreset(
        String(task?.status || "").toLowerCase() === "done" ? task?.completedAt : task?.dueAt,
        presetContext,
        task?.createdAt
      )),
      metricsByUserId
    );
    applyProspectMetrics(
      prospects.filter((prospect) => isWithinPreset(prospect?.createdAt, presetContext)),
      metricsByUserId
    );
    applySalesMetrics({
      ...buildSalesMetricInput(presetContext),
      metricsByUserId,
    });
    return buildRows(metricsByUserId);
  };

  applySalesMetrics({
    ...buildSalesMetricInput(salesContext),
    metricsByUserId: salesMetricsByUserId,
  });


  const allRows = buildRows(allMetricsByUserId);
  const taskRows = buildRows(taskMetricsByUserId);
  const salesRows = buildRows(salesMetricsByUserId);
  const unitPerformanceRows = buildRowsForUnitPerformanceContext(unitPerformanceContext);
  const reassignmentWeeklyRows = buildRowsForUnitPerformanceContext(buildPresetContext("7d"));
  const reassignmentMonthlySalesRows = buildRowsForSalesContext(buildPresetContext("30d"));
  const reassignmentWeeklyRowByUserId = new Map(reassignmentWeeklyRows.map((row) => [String(row.userId || ""), row]));
  const reassignmentMonthlySalesRowByUserId = new Map(reassignmentMonthlySalesRows.map((row) => [String(row.userId || ""), row]));
  const calculateKpiClosingRatio = (row = {}) => {
    const activePolicies = Number(row.activePolicies || 0);
    const submittedApplications = Number(row.submittedApplications || 0);
    return submittedApplications ? Math.round((activePolicies / submittedApplications) * 100) : 0;
  };
  const kpiSalesRowsByFrequency = {
    Daily: buildRowsForSalesContext(buildPresetContext("TODAY")),
    Weekly: buildRowsForSalesContext(buildPresetContext("7d")),
    Monthly: buildRowsForSalesContext(buildPresetContext("30d")),
    Quarterly: buildRowsForSalesContext(buildPresetContext("90d")),
    "Semi-Annually": buildRowsForSalesContext(buildPresetContext("6m")),
    Annually: buildRowsForSalesContext(buildPresetContext("12m")),
  };

  let branchKpiSalesTotalsByFrequency = null;
  if (context.role !== "BM" && context.branchId) {
    const branchUnitsForKpi = await Unit.find({ branchId: context.branchId }).select("_id").lean();
    const branchAgentsForKpi = branchUnitsForKpi.length
      ? await Agent.find({ unitId: { $in: branchUnitsForKpi.map((unit) => unit._id) } }).select("userId").lean()
      : [];
    const branchUserIdsForKpi = branchAgentsForKpi.map((agent) => agent.userId).filter(Boolean);
    const branchProspectsForKpi = branchUserIdsForKpi.length
      ? await Prospect.find({ assignedToUserId: { $in: branchUserIdsForKpi } }).select("_id").lean()
      : [];
    const branchLeadsForKpi = branchProspectsForKpi.length
      ? await Lead.find({ prospectId: { $in: branchProspectsForKpi.map((prospect) => prospect._id) } }).select("_id").lean()
      : [];
    const branchEngagementsForKpi = branchLeadsForKpi.length
      ? await LeadEngagement.find({ leadId: { $in: branchLeadsForKpi.map((lead) => lead._id) } }).select("_id").lean()
      : [];
    const branchEngagementIdsForKpi = branchEngagementsForKpi.map((engagement) => engagement._id).filter(Boolean);
    const branchActivePolicyholdersForKpi = branchUserIdsForKpi.length || branchEngagementIdsForKpi.length
      ? await Policyholder.find({
          status: "Active",
          $or: [
            ...(branchUserIdsForKpi.length ? [{ assignedToUserId: { $in: branchUserIdsForKpi } }] : []),
            ...(branchEngagementIdsForKpi.length ? [{ leadEngagementId: { $in: branchEngagementIdsForKpi } }] : []),
          ],
        })
          .select("leadEngagementId createdAt")
          .lean()
      : [];
    const branchActiveEngagementIdsForKpi = branchActivePolicyholdersForKpi.map((policyholder) => policyholder.leadEngagementId).filter(Boolean);
    const branchAnnualPaymentsForKpi = branchActiveEngagementIdsForKpi.length
      ? await AnnualPayment.find({ leadEngagementId: { $in: branchActiveEngagementIdsForKpi } })
          .select("leadEngagementId totalAnnualPremiumPhp")
          .lean()
      : [];
    const branchAnnualPaymentByEngagementId = new Map(
      branchAnnualPaymentsForKpi.map((payment) => [String(payment?.leadEngagementId || ""), Number(payment?.totalAnnualPremiumPhp || 0)])
    );
    const totalForBranchKpiContext = (presetContext) => branchActivePolicyholdersForKpi
      .filter((policyholder) => isWithinPreset(policyholder?.createdAt, presetContext))
      .reduce((total, policyholder) => total + Number(branchAnnualPaymentByEngagementId.get(String(policyholder?.leadEngagementId || "")) || 0), 0);
    branchKpiSalesTotalsByFrequency = {
      Daily: { totalAnnualPremium: totalForBranchKpiContext(buildPresetContext("TODAY")) },
      Weekly: { totalAnnualPremium: totalForBranchKpiContext(buildPresetContext("7d")) },
      Monthly: { totalAnnualPremium: totalForBranchKpiContext(buildPresetContext("30d")) },
      Quarterly: { totalAnnualPremium: totalForBranchKpiContext(buildPresetContext("90d")) },
      "Semi-Annually": { totalAnnualPremium: totalForBranchKpiContext(buildPresetContext("6m")) },
      Annually: { totalAnnualPremium: totalForBranchKpiContext(buildPresetContext("12m")) },
    };
  }

  const byName = (left, right) => String(left.name).localeCompare(String(right.name)) || String(left.username).localeCompare(String(right.username));
  const agents = allRows
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      username: row.username,
      firstName: row.firstName,
      middleName: row.middleName,
      lastName: row.lastName,
      name: row.name,
      unit: row.unit,
      branch: row.branch,
      area: row.area,
      displayPhoto: row.displayPhoto,
      dateEmployed: row.dateEmployed,
      agentType: row.agentType,
      status: row.status,
      sex: row.sex,
      birthday: row.birthday,
      age: row.age,
      promotionHistory: row.promotionHistory,
      totalTasks: row.totalTasks,
      completedApproaches: row.completedApproaches,
      completedAppointments: row.completedAppointments,
      completedPresentations: row.completedPresentations,
      openTasks: row.openTasks,
      openApproachTasksDueThisWeek: row.openApproachTasksDueThisWeek,
      overdueTasks: row.overdueTasks,
      closedTasks: row.closedTasks,
      delayedDoneTasks: row.delayedDoneTasks,
      completionRate: row.completionRate,
      nextDueAt: row.nextDueAt,
      lastCompletedAt: row.lastCompletedAt,
      topTaskType: row.topTaskType,
      totalProspects: row.totalProspects,
      activeProspects: row.activeProspects,
      leads: row.leads,
      activeLeads: row.activeLeads,
      converted: row.converted,
      submittedApplications: row.submittedApplications,
      conversionRate: row.conversionRate,
      totalPolicies: row.totalPolicies,
      activePolicies: row.activePolicies,
      atRiskPolicies: row.atRiskPolicies,
      lapsedPolicies: row.lapsedPolicies,
      cancelledPolicies: row.cancelledPolicies,
      annualPremium: row.annualPremium,
      frequencyPremium: row.frequencyPremium,
      monthlyPremium: row.monthlyPremium,
      quarterlyPremium: row.quarterlyPremium,
      halfYearlyPremium: row.halfYearlyPremium,
      yearlyPremium: row.yearlyPremium,
      latestLeadCreatedAt: row.latestLeadCreatedAt,
      latestPolicyIssuedAt: row.latestPolicyIssuedAt,
      latestPolicyStatus: row.latestPolicyStatus,
      reassignmentWeeklyDoneApproaches: Number(reassignmentWeeklyRowByUserId.get(String(row.userId))?.completedApproaches || 0),
      reassignmentOpenApproachTasksDueThisWeek: Number(row.openApproachTasksDueThisWeek || 0),
      reassignmentMonthlyClosingRatio: calculateKpiClosingRatio(reassignmentMonthlySalesRowByUserId.get(String(row.userId))),
      reassignmentMonthlyActivePolicies: Number(reassignmentMonthlySalesRowByUserId.get(String(row.userId))?.activePolicies || 0),
      leaveRecords: longLeaveRecordsByAgentId.get(String(row.id)) || [],
      orphanTransferProspects: orphanTransferProspectsByUserId.get(String(row.userId)) || [],
      orphanTransferPolicyholders: orphanTransferPolicyholdersByUserId.get(String(row.userId)) || [],
    }))
    .sort(byName);

  const sortedTaskRows = [...taskRows].sort((left, right) => {
    if (right.overdueTasks !== left.overdueTasks) return right.overdueTasks - left.overdueTasks;
    if (right.openTasks !== left.openTasks) return right.openTasks - left.openTasks;
    if (right.totalTasks !== left.totalTasks) return right.totalTasks - left.totalTasks;
    return byName(left, right);
  });

  const sortedSalesRows = [...salesRows].sort((left, right) => {
    if (right.annualPremium !== left.annualPremium) return right.annualPremium - left.annualPremium;
    if (right.converted !== left.converted) return right.converted - left.converted;
    if (right.leads !== left.leads) return right.leads - left.leads;
    return byName(left, right);
  });

  return {
    payload: {
      manager: {
        id: String(user._id),
        role: context.role,
        username: user.username,
        firstName: user.firstName,
        middleName: user.middleName || "",
        lastName: user.lastName,
        displayPhoto: user.displayPhoto || "",
      },
      scope: {
        role: context.role,
        unitId: context.unitId,
        branchId: context.branchId,
        unitName: context.unitName,
        branchName: context.branchName,
        areaName: context.areaName,
      },
      units: scopedUnits.map((unit) => ({
        id: String(unit._id),
        name: unit.unitName || "Unassigned Unit",
        manager: umByUnitId.get(String(unit._id)) || { code: "—", name: "—" },
        assistantManager: aumByUnitId.get(String(unit._id)) || { code: "—", name: "—" },
      })),
      reportContext: {
        generatedAt: new Date(),
        taskDatePreset: taskContext.key,
        salesDatePreset: salesContext.key,
        unitPerformanceDatePreset: unitPerformanceContext.key,
        taskPeriodLabel: taskContext.periodLabel,
        salesPeriodLabel: salesContext.periodLabel,
        unitPerformancePeriodLabel: unitPerformanceContext.periodLabel,
        unitPerformanceStartDate: unitPerformanceContext.startDate || null,
        unitPerformanceEndDate: new Date(),
      },
      summary: summarizeRows(allRows),
      taskSummary: summarizeRows(taskRows),
      salesSummary: summarizeRows(salesRows),
      kpiSalesRowsByFrequency,
      branchKpiSalesTotalsByFrequency,
      agents,
      taskRows: sortedTaskRows,
      salesRows: sortedSalesRows,
      unitPerformanceRows,
    },
  };
}



/**
 * =========================
 * Global Middleware
 * =========================
 * cors() → Enables cross-origin requests (frontend ↔ backend).
 * express.json() → Parses incoming JSON request bodies.
 */
app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));

/**
 * =========================
 * Database Connection
 * =========================
 * Connects to MongoDB Atlas using URI from environment variables.
 * Logs connection success or failure.
 */
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Atlas connected");
    await reactivateEndedLongLeaveAgents();
  })
  .catch((err) => console.error("MongoDB error:", err));

setInterval(() => {
  reactivateEndedLongLeaveAgents().catch((err) => console.error("Long leave reactivation check failed:", err));
}, 60 * 60 * 1000);

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
   AUTH ROUTES
========================================================= */
app.use(
  createAuthRouter({
    User,
    Agent,
    AUM,
    UM,
    BM,
    Admin,
    bcrypt,
    mongoose,
    buildManagerPopulateQuery,
    getManagerProfile,
    buildManagerPortalPayload,
  })
);


/* =========================================================
   KPI ASSIGNMENT ROUTES
========================================================= */

app.post("/api/manager/agents/:agentId/long-leave", async (req, res) => {
  try {
    const { agentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ message: "Invalid agent ID." });
    }

    const agent = await Agent.findById(agentId).select("_id userId").lean();
    if (!agent) return res.status(404).json({ message: "Agent not found." });

    const leaveStartDate = new Date(req.body?.leaveStartDate);
    const leaveEndDate = new Date(req.body?.leaveEndDate);
    if (Number.isNaN(leaveStartDate.getTime())) {
      return res.status(400).json({ field: "leaveStartDate", message: "Leave start date is required." });
    }
    if (Number.isNaN(leaveEndDate.getTime())) {
      return res.status(400).json({ field: "leaveEndDate", message: "Leave end date is required." });
    }
    const dayDifference = Math.round((leaveEndDate.getTime() - leaveStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDifference <= 7) {
      return res.status(400).json({ field: "leaveEndDate", message: "Leave end date should be beyond 7 days to be marked as on long leave." });
    }

    const leaveApplicationForm = req.body?.leaveApplicationForm || {};
    const approvedLeaveProof = req.body?.approvedLeaveProof || {};
    if (!leaveApplicationForm?.fileName || !leaveApplicationForm?.dataUrl || !/^data:application\/pdf;base64,/i.test(String(leaveApplicationForm.dataUrl))) {
      return res.status(400).json({ field: "leaveApplicationForm", message: "Leave application form PDF is required." });
    }
    if (!approvedLeaveProof?.fileName || !approvedLeaveProof?.dataUrl || !/^data:image\/(?:jpeg|png);base64,/i.test(String(approvedLeaveProof.dataUrl))) {
      return res.status(400).json({ field: "approvedLeaveProof", message: "Proof of approved leave image is required." });
    }

    const existingId = req.body?.longLeaveId;
    if (!existingId) {
      const existingOpenLongLeave = await LongLeave.findOne({
        agentId: agent._id,
        status: { $in: ["Recorded", "Confirmed Orphans"] },
      }).select("_id status").lean();
      if (existingOpenLongLeave) {
        return res.status(409).json({ message: `This agent already has a ${existingOpenLongLeave.status} long leave record.` });
      }
    }

    const payload = {
      agentId: agent._id,
      userId: agent.userId,
      leaveStartDate,
      leaveEndDate,
      leaveApplicationForm: {
        fileName: String(leaveApplicationForm.fileName || "").trim(),
        mimeType: String(leaveApplicationForm.mimeType || "application/pdf").trim(),
        dataUrl: String(leaveApplicationForm.dataUrl || ""),
      },
      approvedLeaveProof: {
        fileName: String(approvedLeaveProof.fileName || "").trim(),
        mimeType: String(approvedLeaveProof.mimeType || "image/jpeg").trim(),
        dataUrl: String(approvedLeaveProof.dataUrl || ""),
      },
      status: "Recorded",
      includeOngoingPolicyholders: false,
      affectedProspects: [],
      affectedPolicyholders: [],
    };

    const longLeave = existingId && mongoose.Types.ObjectId.isValid(existingId)
      ? await LongLeave.findOneAndUpdate({ _id: existingId, agentId: agent._id }, { $set: payload }, { new: true, runValidators: true })
      : await LongLeave.create(payload);

    if (!longLeave) return res.status(404).json({ message: "Long leave record not found for this agent." });
    return res.json({ message: "Long leave details recorded.", longLeave });
  } catch (err) {
    console.error("Save long leave failed:", err);
    return res.status(500).json({ message: err.message || "Failed to save long leave details." });
  }
});


app.patch("/api/manager/long-leave/:longLeaveId/status", async (req, res) => {
  try {
    const { longLeaveId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(longLeaveId)) {
      return res.status(400).json({ message: "Invalid long leave ID." });
    }
    const allowedStatuses = new Set(["Recorded", "Confirmed Orphans", "Endorsed"]);
    const status = String(req.body?.status || "").trim();
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: "Invalid long leave status." });
    }
    const snapshotProspects = Array.isArray(req.body?.affectedProspects) ? req.body.affectedProspects : undefined;
    const snapshotPolicyholders = Array.isArray(req.body?.affectedPolicyholders) ? req.body.affectedPolicyholders : undefined;
    const longLeaveUpdate = {
      status,
      ...(req.body?.includeOngoingPolicyholders !== undefined ? { includeOngoingPolicyholders: req.body.includeOngoingPolicyholders === true } : {}),
      ...(snapshotProspects ? { affectedProspects: snapshotProspects } : {}),
      ...(snapshotPolicyholders ? { affectedPolicyholders: snapshotPolicyholders } : {}),
    };
    const longLeave = await LongLeave.findByIdAndUpdate(
      longLeaveId,
      { $set: longLeaveUpdate },
      { new: true, runValidators: true },
    );
    if (!longLeave) return res.status(404).json({ message: "Long leave record not found." });

    if (status === "Endorsed") {
      const agent = await Agent.findByIdAndUpdate(
        longLeave.agentId,
        { $set: { status: "On Long Leave" } },
        { new: true },
      )
        .populate({ path: "userId", select: "username firstName middleName lastName" })
        .populate({ path: "unitId", select: "unitName" })
        .lean();
      const unitManager = agent?.unitId?._id
        ? await UM.findOne({ unitId: agent.unitId._id, isBlocked: { $ne: true } }).select("userId").lean()
        : null;
      const agentUser = agent?.userId || {};
      const agentName = [agentUser.firstName, agentUser.middleName, agentUser.lastName].filter(Boolean).join(" ").trim() || agentUser.username || "agent";
      if (unitManager?.userId) {
        await Notification.updateOne(
          { dedupeKey: `orphan-endorsement:${longLeave._id}:um:${unitManager.userId}` },
          {
            $set: {
              assignedToUserId: unitManager.userId,
              type: "ORPHANS_ENDORSEMENTS",
              title: `${agentUser.username || "—"} - ${agentName} marked as on long leave (${formatLongLeaveNotificationDate(longLeave.leaveStartDate)} to ${formatLongLeaveNotificationDate(longLeave.leaveEndDate)})`,
              message: buildLongLeaveEndorsementNotificationMessage(longLeave),
              status: "Unread",
              readAt: null,
              entityType: "LongLeave",
              entityId: longLeave._id,
              metadata: {
                longLeaveId: String(longLeave._id),
                agentId: String(agent?._id || ""),
                agentCode: agentUser.username || "",
                agentName,
                unitName: agent?.unitId?.unitName || "",
                leaveStartDate: longLeave.leaveStartDate || null,
                leaveEndDate: longLeave.leaveEndDate || null,
              },
              softDeletedAt: null,
              softDeleteReason: "",
              softDeletedByUserId: null,
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true },
        );
      }
    }

    return res.json({ message: "Long leave status updated.", longLeave });
  } catch (err) {
    console.error("Update long leave status failed:", err);
    return res.status(500).json({ message: err.message || "Failed to update long leave status." });
  }
});

app.get("/api/manager/kpi-assignments", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

    const user = await User.findById(userId).select("username role").lean();
    if (!user) return res.status(404).json({ message: "User not found." });
    if (!["AUM", "UM", "BM"].includes(String(user.role || "").trim().toUpperCase())) {
      return res.status(403).json({ message: "This account does not have manager KPI access." });
    }

    const result = await buildKpiAssignmentPayload(user);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    return res.json(result.payload);
  } catch (err) {
    console.error("KPI assignment load error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.put("/api/manager/kpi-assignments/:scopeType/:scopeId", async (req, res) => {
  try {
    const { userId, kpis } = req.body || {};
    const scopeType = String(req.params.scopeType || "").trim().toUpperCase();
    const scopeId = String(req.params.scopeId || "").trim();

    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(scopeId)) {
      return res.status(400).json({ message: "Invalid userId or scopeId." });
    }
    if (!["AGENT", "UNIT", "BRANCH"].includes(scopeType)) {
      return res.status(400).json({ message: "Invalid KPI scope type." });
    }

    const user = await User.findById(userId).select("role").lean();
    if (!user || String(user.role || "").trim().toUpperCase() !== "BM") {
      return res.status(403).json({ message: "Only branch managers can edit KPI assignments." });
    }

    const context = await getManagerScopeContext(user);
    if (context.error) return res.status(context.error.status).json({ message: context.error.message });

    if (scopeId !== context.branchId) {
      return res.status(403).json({ message: "Cannot edit KPI assignments outside your branch." });
    }

    const existingAssignment = await KpiAssignment.findOne({ scopeType, scopeId }).select("kpis").lean();
    const existingByKey = new Map((Array.isArray(existingAssignment?.kpis) ? existingAssignment.kpis : []).map((kpi) => [String(kpi?.key || ""), kpi]));
    const defaults = KPI_DEFINITIONS[scopeType] || [];
    const inputByKey = new Map((Array.isArray(kpis) ? kpis : []).map((kpi) => [String(kpi?.key || ""), kpi]));
    const normalizedKpis = [];

    for (const definition of defaults) {
      const hasInput = inputByKey.has(definition.key);
      const input = hasInput ? (inputByKey.get(definition.key) || {}) : (existingByKey.get(definition.key) || {});
      const defaultPeriod = KPI_FREQUENCIES.includes(String(input.period || "")) ? String(input.period) : definition.period;
      const inputTargetsByPeriod = new Map(
        (Array.isArray(input.targets) ? input.targets : [])
          .map((target) => [String(target?.period || ""), target])
          .filter(([period]) => KPI_FREQUENCIES.includes(period))
      );
      const assigned = input.assigned !== undefined ? input.assigned === true : definition.assigned;
      const normalizedTargets = [];

      if (assigned === false) {
        for (const period of KPI_FREQUENCIES) {
          const targetInput = inputTargetsByPeriod.get(period) || {};
          const hasMin = targetInput.targetMin !== null && targetInput.targetMin !== undefined && String(targetInput.targetMin).trim() !== "";
          const hasMax = targetInput.targetMax !== null && targetInput.targetMax !== undefined && String(targetInput.targetMax).trim() !== "";
          const hasTarget = targetInput.targetValue !== null && targetInput.targetValue !== undefined && String(targetInput.targetValue).trim() !== "";
          const targetMin = parseOptionalNumber(targetInput.targetMin);
          const targetMax = parseOptionalNumber(targetInput.targetMax);
          const targetValue = parseOptionalNumber(targetInput.targetValue);
          if ((hasMin && targetMin === null) || (hasMax && targetMax === null) || (hasTarget && targetValue === null)) {
            return res.status(400).json({ message: `${definition.label} (${period}): Targets must be valid numbers.` });
          }
          if ((hasMin && targetMin < 0) || (hasMax && targetMax < 0) || (hasTarget && targetValue < 0)) {
            return res.status(400).json({ message: `${definition.label} (${period}): Negative values are not allowed.` });
          }
          if ((hasMin && !Number.isInteger(targetMin)) || (hasMax && !Number.isInteger(targetMax)) || (hasTarget && !Number.isInteger(targetValue))) {
            return res.status(400).json({ message: `${definition.label} (${period}): Whole numbers are counted only.` });
          }
          normalizedTargets.push({
            period,
            targetMin: hasTarget ? null : targetMin,
            targetMax: hasTarget ? null : targetMax,
            targetValue: hasMin || hasMax ? null : targetValue,
          });
        }
        const primaryTarget = normalizedTargets.find((target) => target.period === defaultPeriod) || normalizedTargets[0] || {};
        normalizedKpis.push({
          ...definition,
          assigned: false,
          period: defaultPeriod,
          targetMin: primaryTarget.targetMin ?? null,
          targetMax: primaryTarget.targetMax ?? null,
          targetValue: primaryTarget.targetValue ?? null,
          targets: normalizedTargets,
        });
        continue;
      }

      for (const period of KPI_FREQUENCIES) {
        const targetInput = inputTargetsByPeriod.get(period) || {};
        const targetMin = parseOptionalNumber(targetInput.targetMin);
        const targetMax = parseOptionalNumber(targetInput.targetMax);
        const targetValue = parseOptionalNumber(targetInput.targetValue);
        const hasMin = targetInput.targetMin !== null && targetInput.targetMin !== undefined && String(targetInput.targetMin).trim() !== "";
        const hasMax = targetInput.targetMax !== null && targetInput.targetMax !== undefined && String(targetInput.targetMax).trim() !== "";
        const hasTarget = targetInput.targetValue !== null && targetInput.targetValue !== undefined && String(targetInput.targetValue).trim() !== "";

        if (hasInput && !hasTarget && !hasMin && !hasMax) {
          return res.status(400).json({ message: `${definition.label} (${period}): Target or min/max is required.` });
        }
        if ((hasMin && targetMin === null) || (hasMax && targetMax === null) || (hasTarget && targetValue === null)) {
          return res.status(400).json({ message: `${definition.label} (${period}): Targets must be valid numbers.` });
        }
        if ((hasMin && targetMin < 0) || (hasMax && targetMax < 0) || (hasTarget && targetValue < 0)) {
          return res.status(400).json({ message: `${definition.label} (${period}): Negative values are not allowed.` });
        }
        if ((hasMin && !Number.isInteger(targetMin)) || (hasMax && !Number.isInteger(targetMax)) || (hasTarget && !Number.isInteger(targetValue))) {
          return res.status(400).json({ message: `${definition.label} (${period}): Whole numbers are counted only.` });
        }
        if (hasMin && hasMax && targetMin >= targetMax) {
          return res.status(400).json({ message: `${definition.label} (${period}): Min must be less than max.` });
        }

        normalizedTargets.push({
          period,
          targetMin: hasTarget ? null : targetMin,
          targetMax: hasTarget ? null : targetMax,
          targetValue: hasMin || hasMax ? null : targetValue,
        });
      }

      const primaryTarget = normalizedTargets.find((target) => target.period === defaultPeriod) || normalizedTargets[0] || {};

      normalizedKpis.push({
        ...definition,
        assigned,
        period: defaultPeriod,
        targetMin: primaryTarget.targetMin ?? null,
        targetMax: primaryTarget.targetMax ?? null,
        targetValue: primaryTarget.targetValue ?? null,
        targets: normalizedTargets,
      });
    }

    const updated = await KpiAssignment.findOneAndUpdate(
      { scopeType, scopeId },
      { $set: { kpis: normalizedKpis, updatedByUserId: userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      message: "KPI assignment saved.",
      assignment: {
        scopeType,
        scopeId,
        kpis: normalizeKpiList(scopeType, updated?.kpis || []),
        updatedAt: updated?.updatedAt || null,
      },
    });
  } catch (err) {
    console.error("KPI assignment save error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.get("/api/agent/kpi-progress", async (req, res) => {
  try {
    const { userId, datePreset = "1d" } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "Invalid userId." });

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const agent = await Agent.findOne({ userId: userObjectId })
      .populate({
        path: "userId",
        select: "username firstName middleName lastName displayPhoto dateEmployed role",
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
      .lean();

    if (!agent) return res.status(404).json({ message: "Agent not found." });
    const branchId = String(agent?.unitId?.branchId?._id || agent?.unitId?.branchId || "");
    if (!branchId) return res.status(404).json({ message: "Agent branch not found." });

    const now = new Date();
    const presetMap = {
      "1d": { label: "This Day", frequency: "Daily", days: 1 },
      "7d": { label: "Last 7 Days", frequency: "Weekly", days: 7 },
      "30d": { label: "Last 30 Days", frequency: "Monthly", days: 30 },
      "90d": { label: "Last 90 Days", frequency: "Quarterly", days: 90 },
      "6m": { label: "Last 6 Months", frequency: "Semi-Annually", days: 183 },
      "12m": { label: "Last 12 Months", frequency: "Annually", days: 365 },
    };
    const preset = presetMap[String(datePreset || "1d")] || presetMap["1d"];
    const startDate = new Date(now);
    if (String(datePreset || "1d") === "1d") startDate.setHours(0, 0, 0, 0);
    else startDate.setDate(startDate.getDate() - preset.days);
    const withinRange = (value) => {
      const ms = new Date(value).getTime();
      return Number.isFinite(ms) && ms >= startDate.getTime() && ms <= now.getTime();
    };

    const assignment = await KpiAssignment.findOne({ scopeType: "AGENT", scopeId: branchId }).select("kpis updatedAt").lean();
    const unitAssignment = await KpiAssignment.findOne({ scopeType: "UNIT", scopeId: branchId }).select("kpis updatedAt").lean();
    const unitSalesProductionKpi = normalizeKpiList("UNIT", unitAssignment?.kpis || [])
      .find((kpi) => kpi.key === "monthly_sales_production" && kpi.assigned !== false);
    const unitSalesProductionKpiForPeriod = unitSalesProductionKpi ? (() => {
      const periodTarget = (Array.isArray(unitSalesProductionKpi.targets) ? unitSalesProductionKpi.targets : []).find((target) => target.period === preset.frequency) || {};
      return {
        ...unitSalesProductionKpi,
        period: preset.frequency,
        targetMin: periodTarget.targetMin ?? unitSalesProductionKpi.targetMin ?? null,
        targetMax: periodTarget.targetMax ?? unitSalesProductionKpi.targetMax ?? null,
        targetValue: periodTarget.targetValue ?? unitSalesProductionKpi.targetValue ?? null,
      };
    })() : null;
    const assignedKpis = normalizeKpiList("AGENT", assignment?.kpis || [])
      .filter((kpi) => kpi.assigned !== false)
      .map((kpi) => {
        const defaultPeriod = kpi.period;
        const periodTarget = (Array.isArray(kpi.targets) ? kpi.targets : []).find((target) => target.period === preset.frequency) || {};
        return {
          ...kpi,
          defaultPeriod,
          period: preset.frequency,
          targetMin: periodTarget.targetMin ?? kpi.targetMin ?? null,
          targetMax: periodTarget.targetMax ?? kpi.targetMax ?? null,
          targetValue: periodTarget.targetValue ?? kpi.targetValue ?? null,
        };
      });

    const tasks = await Task.find({ assignedToUserId: userObjectId, softDeletedAt: null })
      .select("type status completedAt createdAt")
      .lean();
    const doneTasks = tasks.filter((task) => String(task?.status || "").toLowerCase() === "done" && withinRange(task?.completedAt || task?.createdAt));
    const countDoneType = (type) => doneTasks.filter((task) => String(task?.type || "").toUpperCase() === type).length;

    const prospects = await Prospect.find({ assignedToUserId: userObjectId })
      .select("_id createdAt")
      .lean();
    const prospectIds = prospects.map((prospect) => prospect._id);
    const leads = prospectIds.length
      ? await Lead.find({ prospectId: { $in: prospectIds } }).select("_id").lean()
      : [];
    const leadIds = leads.map((lead) => lead._id);
    const engagements = leadIds.length
      ? await LeadEngagement.find({ leadId: { $in: leadIds } }).select("_id").lean()
      : [];
    const engagementIds = engagements.map((engagement) => engagement._id);
    const applications = engagementIds.length
      ? await Application.find({ leadEngagementId: { $in: engagementIds } })
        .select("leadEngagementId recordApplicationSubmission.savedAt recordApplicationSubmission.pruOneTransactionId createdAt")
        .lean()
      : [];
    const policyholders = await Policyholder.find({ assignedToUserId: userObjectId })
      .select("leadEngagementId status createdAt")
      .lean();

    const newProspects = prospects.filter((prospect) => withinRange(prospect?.createdAt)).length;
    const activePolicyholdersInRange = policyholders.filter((policyholder) => String(policyholder?.status || "").toLowerCase() === "active" && withinRange(policyholder?.createdAt));
    const activePolicies = activePolicyholdersInRange.length;
    const activePolicyholderEngagementIds = activePolicyholdersInRange.map((policyholder) => policyholder.leadEngagementId).filter(Boolean);
    const annualPayments = activePolicyholderEngagementIds.length
      ? await AnnualPayment.find({ leadEngagementId: { $in: activePolicyholderEngagementIds } })
        .select("leadEngagementId totalAnnualPremiumPhp")
        .lean()
      : [];
    const agentSalesProduction = annualPayments.reduce((total, payment) => total + Number(payment?.totalAnnualPremiumPhp || 0), 0);
    let unitSalesProduction = 0;
    if (unitSalesProductionKpiForPeriod) {
      const unitAgents = await Agent.find({ unitId: agent.unitId?._id || agent.unitId })
        .select("userId")
        .lean();
      const unitAgentUserIds = unitAgents.map((unitAgent) => unitAgent.userId).filter(Boolean);
      const unitActivePolicyholders = unitAgentUserIds.length
        ? await Policyholder.find({ assignedToUserId: { $in: unitAgentUserIds }, status: "Active" })
          .select("leadEngagementId createdAt")
          .lean()
        : [];
      const unitActivePolicyholderEngagementIds = unitActivePolicyholders
        .filter((policyholder) => withinRange(policyholder?.createdAt))
        .map((policyholder) => policyholder.leadEngagementId)
        .filter(Boolean);
      const unitAnnualPayments = unitActivePolicyholderEngagementIds.length
        ? await AnnualPayment.find({ leadEngagementId: { $in: unitActivePolicyholderEngagementIds } })
          .select("leadEngagementId totalAnnualPremiumPhp")
          .lean()
        : [];
      unitSalesProduction = unitAnnualPayments.reduce((total, payment) => total + Number(payment?.totalAnnualPremiumPhp || 0), 0);
    }
    const submittedApplications = applications.filter((application) => {
      const submittedAt = application?.recordApplicationSubmission?.savedAt;
      if (submittedAt) return withinRange(submittedAt);
      return withinRange(application?.createdAt) && String(application?.recordApplicationSubmission?.pruOneTransactionId || "").trim();
    }).length;
    const closingRatio = submittedApplications ? Math.round((activePolicies / submittedApplications) * 100) : 0;

    const actualsByKey = {
      weekly_approaches: countDoneType("APPROACH"),
      weekly_appointments: countDoneType("APPOINTMENT"),
      weekly_presentations: countDoneType("PRESENTATION"),
      monthly_policies: activePolicies,
      monthly_new_prospects: newProspects,
      monthly_closing_ratio: closingRatio,
    };

    return res.json({
      agent: {
        id: String(agent._id),
        userId: String(agent.userId?._id || userId),
        username: agent.userId?.username || "",
        firstName: agent.userId?.firstName || "",
        middleName: agent.userId?.middleName || "",
        lastName: agent.userId?.lastName || "",
        agentType: agent.agentType || "",
        unitName: agent.unitId?.unitName || "",
        branchName: agent.unitId?.branchId?.branchName || "",
        areaName: agent.unitId?.branchId?.areaId?.areaName || "",
      },
      filters: { datePreset: String(datePreset || "1d"), frequency: preset.frequency },
      reportContext: { periodLabel: preset.label, startDate, endDate: now, generatedAt: now },
      kpis: assignedKpis.map((kpi) => ({ ...kpi, actual: Number(actualsByKey[kpi.key] || 0) })),
      unitSalesContribution: unitSalesProductionKpiForPeriod ? {
        kpi: unitSalesProductionKpiForPeriod,
        actual: agentSalesProduction,
        unitActual: unitSalesProduction,
        contributionShare: unitSalesProduction ? Math.round((agentSalesProduction / unitSalesProduction) * 100) : 0,
      } : null,
    });
  } catch (err) {
    console.error("Agent KPI progress error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/* =========================================================
   LEGACY APP ROUTES
========================================================= */
registerLegacyRoutes(app, {
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
});

// ===========================
// NOTIFICATIONS ROUTES
// ===========================
app.use(
  "/api/notifications",
  createNotificationsRouter({
    Notification,
    Task,
    LeadEngagement,
    Prospect,
    Lead,
    Policyholder,
    AnnualPayment,
    Payment,
    Product,
    Policy,
    mongoose,
  })
);

// Start the HTTP server.
// - Uses environment PORT if provided (deployment-friendly)
// - Defaults to 5000 locally
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({
      message: "Uploaded payload is too large. Please use a proof image that is 5MB or smaller.",
    });
  }
  return next(err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});