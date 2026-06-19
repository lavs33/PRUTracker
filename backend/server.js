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
    { key: "weekly_approaches", label: "Weekly Approaches Count", period: "Weekly", valueType: "Count", targetMin: 50, targetMax: 100, targetValue: null, assigned: true },
    { key: "weekly_appointments", label: "Weekly Appointments Count", period: "Weekly", valueType: "Count", targetMin: 10, targetMax: 20, targetValue: null, assigned: true },
    { key: "weekly_presentations", label: "Weekly Presentations Count", period: "Weekly", valueType: "Count", targetMin: 5, targetMax: 10, targetValue: null, assigned: true },
    { key: "monthly_policies", label: "Sales Target", period: "Monthly", valueType: "Count", targetMin: 2, targetMax: 6, targetValue: null, assigned: true },
    { key: "monthly_new_prospects", label: "New Prospects", period: "Monthly", valueType: "Count", targetMin: 2, targetMax: 6, targetValue: null, assigned: true },
    { key: "monthly_closing_ratio", label: "Closing Ratio", period: "Monthly", valueType: "Percent", targetMin: 20, targetMax: 50, targetValue: null, assigned: true },
  ],
  UNIT: [
    { key: "monthly_sales_production", label: "Sales Production", period: "Monthly", valueType: "Currency", targetMin: null, targetMax: null, targetValue: null, assigned: true },
  ],
  BRANCH: [
    { key: "monthly_sales_production", label: "Sales Production", period: "Monthly", valueType: "Currency", targetMin: null, targetMax: null, targetValue: null, assigned: true },
    { key: "monthly_active_agents", label: "Active Agents Count", period: "Monthly", valueType: "Count", targetMin: null, targetMax: null, targetValue: null, assigned: true },
    { key: "monthly_persistency_rate", label: "Branch Persistency Rate", period: "Monthly", valueType: "Percent", targetMin: null, targetMax: null, targetValue: 85, assigned: true },
    { key: "monthly_target_achievement_index", label: "Target Achievement Index", period: "Monthly", valueType: "Index", targetMin: null, targetMax: null, targetValue: 100, assigned: true },
  ],
};

function normalizeKpiList(scopeType, savedKpis = []) {
  const defaults = KPI_DEFINITIONS[scopeType] || [];
  const savedByKey = new Map((Array.isArray(savedKpis) ? savedKpis : []).map((kpi) => [String(kpi?.key || ""), kpi]));
  return defaults.map((definition) => {
    const saved = savedByKey.get(definition.key) || {};
    return {
      ...definition,
      assigned: saved.assigned !== undefined ? saved.assigned === true : definition.assigned,
      period: saved.period || definition.period,
      targetMin: definition.key === "monthly_persistency_rate" ? definition.targetMin : (saved.targetMin !== undefined ? saved.targetMin : definition.targetMin),
      targetMax: saved.targetMax !== undefined ? saved.targetMax : definition.targetMax,
      targetValue: definition.key === "monthly_persistency_rate" && (saved.targetValue === undefined || saved.targetValue === null) ? 85 : (saved.targetValue !== undefined ? saved.targetValue : definition.targetValue),
    };
  });
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function buildKpiAssignmentPayload(user) {
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

async function buildManagerPortalPayload(user, { taskDatePreset = "ALL", salesDatePreset = "ALL" } = {}) {
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
            name: fullName || agent?.userId?.username || "—",
            unit: agent?.unitId?.unitName || "",
            branch: agent?.unitId?.branchId?.branchName || "",
            area: agent?.unitId?.branchId?.areaId?.areaName || "",
            displayPhoto: agent?.userId?.displayPhoto || "",
            totalTasks: 0,
            openTasks: 0,
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
        name: metrics.name,
        unit: metrics.unit,
        branch: metrics.branch,
        area: metrics.area,
        displayPhoto: metrics.displayPhoto,
        totalTasks: metrics.totalTasks,
        openTasks: metrics.openTasks,
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
    if (normalized === "half-yearly" || normalized === "half yearly" || normalized === "semi-annual" || normalized === "semi annual") {
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
      select: "username firstName middleName lastName displayPhoto role",
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
      code: userDoc.username || "—",
      name: [userDoc.firstName, userDoc.middleName, userDoc.lastName].filter(Boolean).join(" ").trim() || userDoc.username || "—",
    };
  };
  const umByUnitId = new Map(unitManagers.map((manager) => [String(manager.unitId || ""), formatUnitManager(manager)]));
  const aumByUnitId = new Map(assistantUnitManagers.map((manager) => [String(manager.unitId || ""), formatUnitManager(manager)]));

  const scopedUserIds = scopedAgents.map((agent) => agent.userId?._id).filter(Boolean);
  const allMetricsByUserId = createMetricsMap(scopedAgents);
  const taskMetricsByUserId = createMetricsMap(scopedAgents);
  const salesMetricsByUserId = createMetricsMap(scopedAgents);

  const [tasks, prospects] = await Promise.all([
    scopedUserIds.length
      ? Task.find({ assignedToUserId: { $in: scopedUserIds }, softDeletedAt: null })
          .select("assignedToUserId type title dueAt status completedAt wasDelayed createdAt")
          .lean()
      : [],
    scopedUserIds.length
      ? Prospect.find({ assignedToUserId: { $in: scopedUserIds } })
          .select("_id assignedToUserId status")
          .lean()
      : [],
  ]);

  const nowMs = Date.now();
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
        if (task?.wasDelayed) metrics.delayedDoneTasks += 1;
        if (Number.isFinite(completedAtMs) && (!metrics.lastCompletedAt || completedAtMs > new Date(metrics.lastCompletedAt).getTime())) {
          metrics.lastCompletedAt = task.completedAt;
        }
        continue;
      }

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
    tasks.filter((task) => isWithinPreset(task?.dueAt, taskContext, task?.createdAt)),
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
        .select("_id prospectId status createdAt")
        .lean()
    : [];
  const leadIds = leads.map((lead) => lead._id);
  const leadIdToAssignedUserId = new Map(
    leads.map((lead) => [String(lead._id), prospectIdToAssignedUserId.get(String(lead.prospectId)) || ""])
  );

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

  const [policyholders, applications, needsAssessments, payments, annualPayments] = await Promise.all([
    scopedUserIds.length
      ? Policyholder.find({ assignedToUserId: { $in: scopedUserIds } })
          .select("assignedToUserId leadEngagementId status createdAt")
          .lean()
      : [],
    engagementIds.length
      ? Application.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId recordPremiumPaymentTransfer")
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
    const filteredPolicyholderEngagementIds = new Set(
      filteredPolicyholders
        .map((policyholder) => String(policyholder?.leadEngagementId || ""))
        .filter(Boolean)
    );

    return {
      leadList: filteredLeads,
      policyholderList: filteredPolicyholders,
      applicationList: applications.filter((application) => filteredPolicyholderEngagementIds.has(String(application?.leadEngagementId || ""))),
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

  applySalesMetrics({
    ...buildSalesMetricInput(salesContext),
    metricsByUserId: salesMetricsByUserId,
  });


  const allRows = buildRows(allMetricsByUserId);
  const taskRows = buildRows(taskMetricsByUserId);
  const salesRows = buildRows(salesMetricsByUserId);
  const kpiSalesRowsByFrequency = {
    Daily: buildRowsForSalesContext(buildPresetContext("TODAY")),
    Weekly: buildRowsForSalesContext(buildPresetContext("7d")),
    Monthly: buildRowsForSalesContext(buildPresetContext("30d")),
    Quarterly: buildRowsForSalesContext(buildPresetContext("90d")),
    "Semi-Annually": buildRowsForSalesContext(buildPresetContext("6m")),
    Annually: buildRowsForSalesContext(buildPresetContext("12m")),
  };

  const byName = (left, right) => String(left.name).localeCompare(String(right.name)) || String(left.username).localeCompare(String(right.username));
  const agents = allRows
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      username: row.username,
      name: row.name,
      unit: row.unit,
      branch: row.branch,
      area: row.area,
      displayPhoto: row.displayPhoto,
      openTasks: row.openTasks,
      overdueTasks: row.overdueTasks,
      closedTasks: row.closedTasks,
      leads: row.leads,
      converted: row.converted,
      annualPremium: row.annualPremium,
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
        taskPeriodLabel: taskContext.periodLabel,
        salesPeriodLabel: salesContext.periodLabel,
      },
      summary: summarizeRows(allRows),
      taskSummary: summarizeRows(taskRows),
      salesSummary: summarizeRows(salesRows),
      kpiSalesRowsByFrequency,
      agents,
      taskRows: sortedTaskRows,
      salesRows: sortedSalesRows,
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

    const defaults = KPI_DEFINITIONS[scopeType] || [];
    const inputByKey = new Map((Array.isArray(kpis) ? kpis : []).map((kpi) => [String(kpi?.key || ""), kpi]));
    const normalizedKpis = defaults.map((definition) => {
      const input = inputByKey.get(definition.key) || {};
      return {
        ...definition,
        assigned: input.assigned !== undefined ? input.assigned === true : definition.assigned,
        period: ["Daily", "Weekly", "Monthly", "Quarterly", "Semi-Annually", "Annually"].includes(String(input.period || "")) ? input.period : definition.period,
        targetMin: parseOptionalNumber(input.targetMin),
        targetMax: parseOptionalNumber(input.targetMax),
        targetValue: parseOptionalNumber(input.targetValue),
      };
    });

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