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
}) {
  const writes = [];

  if (includeTaskAdded) {
    writes.push({
      updateOne: {
        filter: {
          assignedToUserId,
          dedupeKey: `TASK_ADDED:${task._id}`,
        },
        update: {
          $setOnInsert: {
            assignedToUserId,
            type: "TASK_ADDED",
            title: "New task added",
            message: `${task.title} was created for ${prospectFullName} (Lead ${leadCode || "—"}).`,
            status: "Unread",
            entityType: "Task",
            entityId: task._id,
            dedupeKey: `TASK_ADDED:${task._id}`,
          },
        },
        upsert: true,
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
          },
          $setOnInsert: {
            assignedToUserId,
            type: "TASK_DUE_TODAY",
            dedupeKey: dueTodayDedupeKey,
          },
        },
        upsert: true,
      },
    });
  }

  if (writes.length) {
    await Notification.bulkWrite(writes, { session });
  }
}

async function ensureTaskMissedNotificationsForUser(userObjectId) {
  const now = new Date();
  const openTasks = await Task.find({
    assignedToUserId: userObjectId,
    status: { $in: ["Open", "Overdue"] },
    dueAt: { $ne: null },
  })
    .select("_id title dueAt prospectId leadEngagementId")
    .lean();

  const dueTodayPendingTasks = openTasks.filter((task) => task?.dueAt && isDueTodayInManila(task.dueAt));
  const overdueTasks = await Task.find({
    assignedToUserId: userObjectId,
    status: "Open",
    dueAt: { $lt: now },
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
              status: "Unread",
              entityType: "Task",
              entityId: task._id,
            },
            $setOnInsert: {
              assignedToUserId: userObjectId,
              type: "TASK_MISSED",
              dedupeKey,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (writes.length) {
    await Notification.bulkWrite(writes, { ordered: false });
  }

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
              status: "Unread",
              entityType: "Task",
              entityId: task._id,
            },
            $setOnInsert: {
              assignedToUserId: userObjectId,
              type: "TASK_DUE_TODAY",
              dedupeKey,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (dueTodayWrites.length) {
    await Notification.bulkWrite(dueTodayWrites, { ordered: false });
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

    let openTasks = await Task.find({ assignedToUserId: userObjectId, status: "Open" })
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

    const applications = engagementIds.length
      ? await Application.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId recordPremiumPaymentTransfer.totalAnnualPremiumPhp")
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

    const convertedLeadIds = new Set();
    policyholders.forEach((policyholder) => {
      const engagement = engagementById.get(String(policyholder?.leadEngagementId || ""));
      if (!engagement) return;
      convertedLeadIds.add(String(engagement.leadId));
    });

    const leadSourceBreakdown = new Map();
    leads.forEach((lead) => {
      const label = String(lead?.source || "Other").trim() || "Other";
      const current = leadSourceBreakdown.get(label) || { label, total: 0, converted: 0 };
      current.total += 1;
      if (convertedLeadIds.has(String(lead._id))) current.converted += 1;
      leadSourceBreakdown.set(label, current);
    });

    const bestSource = [...leadSourceBreakdown.values()]
      .map((item) => ({
        label: item.label,
        convertedLeads: item.converted,
        conversionRatePct: item.total ? Math.round((item.converted / item.total) * 100) : 0,
      }))
      .sort((a, b) => {
        if (b.conversionRatePct !== a.conversionRatePct) return b.conversionRatePct - a.conversionRatePct;
        return b.convertedLeads - a.convertedLeads;
      })[0] || null;

    const totalAnnualPremiumPhp = applications.reduce(
      (sum, application) => sum + Number(application?.recordPremiumPaymentTransfer?.totalAnnualPremiumPhp || 0),
      0
    );

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
        conversionRatePct: conversionRate,
        totalPolicies: totalPolicyholders,
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
    const startDate = (() => {
      const dt = new Date(now);
      if (datePreset === "30d") {
        dt.setDate(dt.getDate() - 30);
        return dt;
      }
      if (datePreset === "90d") {
        dt.setDate(dt.getDate() - 90);
        return dt;
      }
      if (datePreset === "365d") {
        dt.setDate(dt.getDate() - 365);
        return dt;
      }
      return null;
    })();

    const formatDate = (value) => {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime())
        ? "—"
        : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };
    const toPct = (part, total) => (total ? Math.round((part / total) * 100) : 0);
    const countBy = (arr, predicate) => arr.filter(predicate).length;
    const normalizeKey = (value) => String(value || "");
    const bucketDate = (dateValue, unit) => {
      const dt = new Date(dateValue);
      if (Number.isNaN(dt.getTime())) return null;
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
    const buildSeries = (items, dateKey) => {
      const unit = datePreset === "30d" || datePreset === "90d" ? "week" : "month";
      const desiredBuckets = 6;
      const seriesEnd = bucketDate(now, unit);
      const seriesStart = new Date(seriesEnd);
      if (unit === "week") seriesStart.setDate(seriesStart.getDate() - ((desiredBuckets - 1) * 7));
      else seriesStart.setMonth(seriesStart.getMonth() - (desiredBuckets - 1));
      const buckets = [];
      const cursor = new Date(seriesStart);
      for (let i = 0; i < desiredBuckets; i += 1) {
        buckets.push(new Date(cursor));
        if (unit === "week") cursor.setDate(cursor.getDate() + 7);
        else cursor.setMonth(cursor.getMonth() + 1);
      }

      const counts = new Map(buckets.map((bucket) => [bucket.getTime(), 0]));
      items.forEach((item) => {
        const bucket = bucketDate(item?.[dateKey], unit);
        if (!bucket) return;
        const key = bucket.getTime();
        if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
      });

      return buckets.map((bucket) => ({
        label: unit === "week"
          ? `${bucket.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : bucket.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: counts.get(bucket.getTime()) || 0,
      }));
    };

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectQuery = { assignedToUserId: userObjectId };
    if (startDate) prospectQuery.createdAt = { $gte: startDate };
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

    const leadById = new Map(leads.map((lead) => [normalizeKey(lead._id), lead]));
    const engagementById = new Map(engagements.map((engagement) => [normalizeKey(engagement._id), engagement]));
    const policyholdersByProspectId = new Map();

    policyholders.forEach((policyholder) => {
      const engagement = engagementById.get(normalizeKey(policyholder.leadEngagementId));
      if (!engagement) return;
      const lead = leadById.get(normalizeKey(engagement.leadId));
      if (!lead) return;
      const prospectId = normalizeKey(lead.prospectId);
      const arr = policyholdersByProspectId.get(prospectId) || [];
      arr.push(policyholder);
      policyholdersByProspectId.set(prospectId, arr);
    });

    const totalProspects = prospects.length;
    const totalPolicyholders = policyholders.length;
    const totalLeads = leads.length;
    const prospectsWithLeads = new Set(leads.map((lead) => normalizeKey(lead.prospectId))).size;
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

    const activePolicies = countBy(policyholders, (p) => p.status === "Active");
    const lapsedPolicies = countBy(policyholders, (p) => p.status === "Lapsed");
    const cancelledPolicies = countBy(policyholders, (p) => p.status === "Cancelled");

    const stageLabels = ["Contacting", "Needs Assessment", "Proposal", "Application", "Policy Issuance"];
    const totalEngagements = engagements.length;
    const stageProgress = stageLabels.map((label) => {
      const count = countBy(engagements, (e) => {
        if (String(e.currentStage || "") !== label) return false;
        if (label !== "Policy Issuance") return true;

        const lead = leadById.get(normalizeKey(e.leadId));
        return String(lead?.status || "").trim() !== "Closed";
      });
      return { label, count, value: toPct(count, totalEngagements) };
    });

    const sourceBuckets = ["Agent-Sourced", "System-Assigned"].map((label) => {
      const sourceProspects = prospects.filter((prospect) => prospect.source === label);
      const sourceProspectIds = new Set(sourceProspects.map((prospect) => normalizeKey(prospect._id)));
      const converted = policyholders.filter((policyholder) => {
        const engagement = engagementById.get(normalizeKey(policyholder.leadEngagementId));
        if (!engagement) return false;
        const lead = leadById.get(normalizeKey(engagement.leadId));
        if (!lead) return false;
        return sourceProspectIds.has(normalizeKey(lead.prospectId));
      }).length;
      return {
        label,
        prospects: sourceProspects.length,
        policyholders: converted,
        conversionRatePct: toPct(converted, sourceProspects.length),
      };
    });

    const marketBuckets = ["Warm", "Cold"].map((label) => {
      const marketProspects = prospects.filter((prospect) => prospect.marketType === label);
      const converted = marketProspects.reduce((sum, prospect) => {
        const linked = policyholdersByProspectId.get(normalizeKey(prospect._id)) || [];
        return sum + linked.length;
      }, 0);
      return {
        label,
        prospects: marketProspects.length,
        policyholders: converted,
        conversionRatePct: toPct(converted, marketProspects.length),
      };
    });

    const prospectTrend = buildSeries(prospects, "createdAt");
    const policyholderTrend = buildSeries(policyholders, "createdAt");

    const recentProspects = [...prospects]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10)
      .map((prospect) => {
        const linkedPolicies = policyholdersByProspectId.get(normalizeKey(prospect._id)) || [];
        return {
          prospectCode: prospect.prospectCode || "—",
          fullName: [prospect.firstName, prospect.middleName, prospect.lastName].filter(Boolean).join(" "),
          marketType: prospect.marketType || "—",
          prospectType: prospect.prospectType || "—",
          source: prospect.source || "—",
          status: prospect.status || "—",
          createdAt: prospect.createdAt || null,
          policyholders: linkedPolicies.length,
        };
      });

    const conversionHotspot = [...sourceBuckets].sort((a, b) => b.conversionRatePct - a.conversionRatePct)[0] || null;
    const policyRiskPct = toPct(lapsedPolicies + cancelledPolicies, totalPolicyholders);
    const leadCoveragePct = toPct(prospectsWithLeads, totalProspects);
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
        prospectsWithLeads,
        policyholders: totalPolicyholders,
        engagements: totalEngagements,
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
      activePolicyRatePct: toPct(activePolicies, totalPolicyholders),
      prospectMix: { warm, cold, elite, ordinary, agentSourced, systemAssigned },
      prospectStatusCounts,
      policyStatusCounts: {
        active: activePolicies,
        lapsed: lapsedPolicies,
        cancelled: cancelledPolicies,
      },
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
          prospectsWithLeads,
          prospectsWithoutLeads: Math.max(totalProspects - prospectsWithLeads, 0),
          leadCoveragePct,
        },
        policyRiskPct,
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
      policyStatus = "ALL",
    } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();

    const buildSalesReportContext = () => {
      if (datePreset === "30d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 30);
        return {
          startDate: start,
          periodLabel: "Last 30 days",
        };
      }
      if (datePreset === "90d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 90);
        return {
          startDate: start,
          periodLabel: "Last 90 days",
        };
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
        policyStatus: String(policyStatus || "ALL"),
      },
      reportContext: {
        periodLabel: reportContext.periodLabel,
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
          .select("leadEngagementId recordPremiumPaymentTransfer.totalAnnualPremiumPhp recordPremiumPaymentTransfer.totalFrequencyPremiumPhp")
          .lean()
      : [];

    const needsAssessments = engagementIds.length
      ? await NeedsAssessment.find({ leadEngagementId: { $in: engagementIds } })
          .select("leadEngagementId needsPriorities.productSelection.requestedFrequency")
          .lean()
      : [];

    const scopedPolicyholders =
      policyStatus === "ALL"
        ? policyholders
        : policyholders.filter((policyholder) => policyholder.status === String(policyStatus));
    const engagementIdToLeadId = new Map(engagements.map((engagement) => [String(engagement._id), String(engagement.leadId)]));
    const leadIdsWithScopedPolicies = new Set(
      scopedPolicyholders.map((policyholder) => engagementIdToLeadId.get(String(policyholder.leadEngagementId))).filter(Boolean)
    );
    const reportingLeads =
      policyStatus === "ALL"
        ? leads
        : leads.filter((lead) => leadIdsWithScopedPolicies.has(String(lead._id)));
    const totalLeads = reportingLeads.length;

    if (policyStatus !== "ALL" && !reportingLeads.length) {
      return res.json(defaultResponse);
    }

    const scopedEngagementIds = new Set(scopedPolicyholders.map((policyholder) => String(policyholder.leadEngagementId)));
    const scopedApplications =
      policyStatus === "ALL"
        ? applications
        : applications.filter((application) => scopedEngagementIds.has(String(application?.leadEngagementId || "")));
    const scopedNeedsAssessments =
      policyStatus === "ALL"
        ? needsAssessments
        : needsAssessments.filter((needsAssessment) => scopedEngagementIds.has(String(needsAssessment?.leadEngagementId || "")));

    const engagementToFrequency = new Map(
      scopedNeedsAssessments.map((n) => [
        String(n.leadEngagementId),
        String(n?.needsPriorities?.productSelection?.requestedFrequency || "").trim(),
      ])
    );

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

    const totalAnnualPremiumPhp = scopedApplications.reduce(
      (sum, a) => sum + Number(a?.recordPremiumPaymentTransfer?.totalAnnualPremiumPhp || 0),
      0
    );
    const totalFrequencyPremiumPhp = scopedApplications.reduce(
      (sum, a) => sum + Number(a?.recordPremiumPaymentTransfer?.totalFrequencyPremiumPhp || 0),
      0
    );

    for (const appDoc of scopedApplications) {
      const premium = Number(appDoc?.recordPremiumPaymentTransfer?.totalFrequencyPremiumPhp || 0);
      const freq = engagementToFrequency.get(String(appDoc?.leadEngagementId)) || "";
      const frequencyKey = normalizeFrequencyKey(freq);

      if (frequencyKey) frequencyPremiumBreakdown[frequencyKey] += premium;
    }

    const activePolicies = scopedPolicyholders.filter((p) => p.status === "Active").length;
    const lapsedPolicies = scopedPolicyholders.filter((p) => p.status === "Lapsed").length;
    const cancelledPolicies = scopedPolicyholders.filter((p) => p.status === "Cancelled").length;
    const totalPolicies = scopedPolicyholders.length;

    const engagementToLead = new Map(engagements.map((e) => [String(e._id), String(e.leadId)]));
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

    const convertedLeads = convertedLeadMomentsByEngagement.size;
    const unconvertedLeads = Math.max(totalLeads - convertedLeads, 0);
    const conversionRatePct = totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    const activePolicyRatePct = totalPolicies ? Math.round((activePolicies / totalPolicies) * 100) : 0;
    const averageAnnualPremiumPerConvertedLeadPhp = convertedLeads
      ? Number((totalAnnualPremiumPhp / convertedLeads).toFixed(2))
      : 0;
    const averageFrequencyPremiumPerConvertedLeadPhp = convertedLeads
      ? Number((totalFrequencyPremiumPhp / convertedLeads).toFixed(2))
      : 0;

    const leadSourceBreakdownMap = new Map();

    for (const lead of reportingLeads) {
      const bucket = normalizeLeadSourceLabel(lead);
      if (!leadSourceBreakdownMap.has(bucket)) {
        leadSourceBreakdownMap.set(bucket, {
          label: bucket,
          totalLeads: 0,
          convertedLeads: 0,
          conversionRatePct: 0,
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
          conversionRatePct: 0,
        });
      }
      leadSourceBreakdownMap.get(bucket).convertedLeads += 1;
    }

    const leadSourceBreakdown = [...leadSourceBreakdownMap.values()]
      .map((sourceMetrics) => ({
        ...sourceMetrics,
        conversionRatePct: sourceMetrics.totalLeads
          ? Math.round((sourceMetrics.convertedLeads / sourceMetrics.totalLeads) * 100)
          : 0,
      }))
      .sort((a, b) => {
        if (b.convertedLeads !== a.convertedLeads) return b.convertedLeads - a.convertedLeads;
        if (b.totalLeads !== a.totalLeads) return b.totalLeads - a.totalLeads;
        return a.label.localeCompare(b.label);
      });

    for (const sourceMetrics of leadSourceBreakdown) {
      sourceMetrics.conversionRatePct = sourceMetrics.totalLeads
        ? Math.round((sourceMetrics.convertedLeads / sourceMetrics.totalLeads) * 100)
        : 0;
    }

    const monthMap = new Map();
    for (const conversionDate of convertedLeadMomentsByEngagement.values()) {
      if (Number.isNaN(conversionDate.getTime())) continue;
      const key = `${conversionDate.getUTCFullYear()}-${String(conversionDate.getUTCMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }

    const monthlyConvertedLeads = [];
    const currentMonth = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - offset, 1));
      const monthKey = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyConvertedLeads.push({
        month: monthKey,
        converted: monthMap.get(monthKey) || 0,
      });
    }

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

    const salesRows = reportingLeads
      .filter((lead) => String(lead?.status || "").trim().toLowerCase() !== "dropped")
      .map((lead) => {
        const leadKey = String(lead._id);
        const prospect = prospectById.get(String(lead.prospectId));
        const relatedPolicies = [...(leadIdToPolicyholders.get(leadKey) || [])].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        const latestPolicy = relatedPolicies[0] || null;
        const application = leadIdToApplication.get(leadKey) || null;
        const needsAssessment = leadIdToNeedsAssessment.get(leadKey) || null;
        const fullName = [prospect?.firstName, prospect?.middleName, prospect?.lastName].filter(Boolean).join(" ").trim() || "—";
        const requestedFrequency = String(needsAssessment?.needsPriorities?.productSelection?.requestedFrequency || "").trim() || "—";

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
          annualPremiumPhp: Number(application?.recordPremiumPaymentTransfer?.totalAnnualPremiumPhp || 0),
          frequencyPremiumPhp: Number(application?.recordPremiumPaymentTransfer?.totalFrequencyPremiumPhp || 0),
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
    "Record Policy Application Status",
    "Upload Initial Premium eOR",
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
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;

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
      meetingType: "Needs Assessment",
      status: { $ne: "Cancelled" },
    })
      .sort({ startAt: -1 })
      .select("meetingType startAt endAt durationMin mode platform platformOther link inviteSent place status")
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
      .select("_id type title description dueAt status completedAt wasDelayed createdAt")
      .lean();

    const needsAssessment = await NeedsAssessment.findOne({ leadEngagementId: engagement._id })
      .select("needsPriorities.productSelection.selectedProductId needsPriorities.productSelection.requestedFrequency")
      .lean();

    const proposalDoc = await Proposal.findOne({ leadEngagementId: engagement._id })
      .select("outcomeActivity chosenProductId generateProposal recordProspectAttendance presentProposal")
      .lean();

    const applicationDoc = await Application.findOne({ leadEngagementId: engagement._id })
      .select("outcomeActivity chosenProductId recordProspectAttendance recordPremiumPaymentTransfer recordApplicationSubmission")
      .lean();

    const policyDoc = await Policy.findOne({ leadEngagementId: engagement._id })
      .select("chosenProductId outcomeActivity recordPolicyApplicationStatus uploadInitialPremiumEor uploadPolicySummary recordCoverageDurationDetails")
      .lean();

    const proposalProductId = proposalDoc?.chosenProductId || null;
    const needsSelectedProductId = needsAssessment?.needsPriorities?.productSelection?.selectedProductId || null;
    const policyProductId = policyDoc?.chosenProductId || null;

    let selectedProduct = policyProductId && mongoose.isValidObjectId(policyProductId)
      ? await Product.findById(policyProductId)
          .select("_id productName description paymentTermOptions paymentTermLabel coverageDurationRule coverageDurationLabel")
          .lean()
      : null;

    if (!selectedProduct && proposalProductId && mongoose.isValidObjectId(proposalProductId)) {
      selectedProduct = await Product.findById(proposalProductId)
        .select("_id productName description paymentTermOptions paymentTermLabel coverageDurationRule coverageDurationLabel")
        .lean();
    }

    if (!selectedProduct && needsSelectedProductId && mongoose.isValidObjectId(needsSelectedProductId)) {
      selectedProduct = await Product.findById(needsSelectedProductId)
        .select("_id productName description paymentTermOptions paymentTermLabel coverageDurationRule coverageDurationLabel")
        .lean();
    }

    const selectedProductId = selectedProduct?._id || policyProductId || proposalProductId || needsSelectedProductId || null;

    const applicationSubmissionMeeting = await ScheduledMeeting.findOne({
      leadEngagementId: engagement._id,
      meetingType: "Application Submission",
      status: { $ne: "Cancelled" },
    })
      .select("meetingType startAt endAt durationMin mode platform platformOther link inviteSent place status")
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
    const policyCurrentActivityKey = String(policyDoc?.outcomeActivity || "Record Policy Application Status").trim() || "Record Policy Application Status";

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
      attemptId: String(a._id || ""),
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

        // Derived and validated current activity for tracker/badge
        currentActivityKey: derivedActivityKey, 

        // Always an array (empty if none)
        contactAttempts, 

        // Always an array (empty if none)
        tasks: Array.isArray(tasks) ? tasks : [],

        application: {
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
            totalAnnualPremiumPhp: applicationDoc?.recordPremiumPaymentTransfer?.totalAnnualPremiumPhp ?? null,
            totalFrequencyPremiumPhp: applicationDoc?.recordPremiumPaymentTransfer?.totalFrequencyPremiumPhp ?? null,
            methodForInitialPayment:
              applicationDoc?.recordPremiumPaymentTransfer?.methodForInitialPayment
              || "",
            methodForRenewalPayment: applicationDoc?.recordPremiumPaymentTransfer?.methodForRenewalPayment || "",
            paymentProofImageDataUrl: applicationDoc?.recordPremiumPaymentTransfer?.paymentProofImageDataUrl || "",
            paymentProofFileName: applicationDoc?.recordPremiumPaymentTransfer?.paymentProofFileName || "",
            savedAt: applicationDoc?.recordPremiumPaymentTransfer?.savedAt || null,
          },
          recordApplicationSubmission: {
            pruOneTransactionId: applicationDoc?.recordApplicationSubmission?.pruOneTransactionId || "",
            submissionScreenshotImageDataUrl: applicationDoc?.recordApplicationSubmission?.submissionScreenshotImageDataUrl || "",
            submissionScreenshotFileName: applicationDoc?.recordApplicationSubmission?.submissionScreenshotFileName || "",
            savedAt: applicationDoc?.recordApplicationSubmission?.savedAt || null,
          },
          needsAssessmentProductSelection: {
            requestedFrequency: String(needsAssessment?.needsPriorities?.productSelection?.requestedFrequency || ""),
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
            notes: policyDoc?.recordPolicyApplicationStatus?.notes || "",
            savedAt: policyDoc?.recordPolicyApplicationStatus?.savedAt || null,
          },
          uploadInitialPremiumEor: {
            eorNumber: policyDoc?.uploadInitialPremiumEor?.eorNumber || "",
            receiptDate: policyDoc?.uploadInitialPremiumEor?.receiptDate || null,
            eorFileName: policyDoc?.uploadInitialPremiumEor?.eorFileName || "",
            eorFileMimeType: policyDoc?.uploadInitialPremiumEor?.eorFileMimeType || "",
            eorFileDataUrl: policyDoc?.uploadInitialPremiumEor?.eorFileDataUrl || "",
            uploadedAt: policyDoc?.uploadInitialPremiumEor?.uploadedAt || null,
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
            nextPaymentDate: policyDoc?.recordCoverageDurationDetails?.nextPaymentDate || null,
            savedAt: policyDoc?.recordCoverageDurationDetails?.savedAt || null,
          },
        },

        proposal: {
          currentActivityKey: proposalCurrentActivityKey,
          chosenProduct: proposalDoc?.chosenProductId || selectedProduct
            ? {
                _id: proposalDoc?.chosenProductId || selectedProduct?._id || null,
                productName: selectedProduct?.productName || "",
                description: selectedProduct?.description || "",
              }
            : null,
          generateProposal: {
            productId: proposalDoc?.chosenProductId || selectedProduct?._id || null,
            productName: selectedProduct?.productName || "",
            productDescription: selectedProduct?.description || "",
            proposalFileName: proposalSaved?.proposalFileName || "",
            proposalFileMimeType: proposalSaved?.proposalFileMimeType || "",
            proposalFileDataUrl: proposalSaved?.proposalFileDataUrl || "",
            sentToProspectEmail: Boolean(proposalSaved?.sentToProspectEmail),
            sentToProspectAt: proposalSaved?.sentToProspectAt || null,
            uploadedAt: proposalSaved?.uploadedAt || proposalSaved?.generatedAt || null,
          },
          recordProspectAttendance: {
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
          applicationSubmissionMeeting: applicationSubmissionMeeting
            ? {
                meetingType: applicationSubmissionMeeting.meetingType,
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
              }
            : null,
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

      const latestAttempt = await ContactAttempt.findOne({ leadEngagementId: engagement._id })
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

async function getLatestRespondedAttemptForEngagement(leadEngagementId, session) {
  return ContactAttempt.findOne({
    leadEngagementId,
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

      const attempt = await ContactAttempt.findOne({
        leadEngagementId: engagement._id,
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

      const attempt = await getLatestRespondedAttemptForEngagement(engagement._id, session);
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
  const matchStage = { status: { $ne: "Cancelled" } };
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

      const allowRescheduleFromNeeds =
        Boolean(rescheduleFromNeeds) &&
        engagement.currentStage === "Needs Assessment" &&
        engagement.currentActivityKey === "Record Prospect Attendance";
      if (engagement.currentActivityKey !== "Schedule Meeting" && !allowRescheduleFromNeeds) {
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
      const existingMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType,
      }).session(session);

      const windows = await getAgentMeetingWindows(userObjectId, null, null, session);
      const conflictWindows = existingMeeting
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

      const attempt = await getLatestRespondedAttemptForEngagement(engagement._id, session);
      if (!attempt) throw Object.assign(new Error("No responded contact attempt found."), { status: 409 });

      attempt.outcomeActivity = "Schedule Meeting";
      await attempt.save({ session });

      if (existingMeeting) {
        if (allowRescheduleFromNeeds && new Date(existingMeeting.startAt).getTime() === dt.getTime()) {
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

      if (!allowRescheduleFromNeeds) {
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

      const appointmentDedupeKey = `APPOINTMENT:${engagement._id}`;
      let appointmentTask = await Task.findOne({
        assignedToUserId: userObjectId,
        dedupeKey: appointmentDedupeKey,
      }).session(session);

      const appointmentTitle = `Meeting scheduled with ${prospect.firstName}`;
      const appointmentDescription = `Attend scheduled meeting with ${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName} (Lead ${lead.leadCode || "—"}). Meeting window: ${formatDateTimeInManila(dt)} to ${formatDateTimeInManila(endAt)} (Asia/Manila).`;
      const appointmentDueAt = new Date(endAt.getTime() + 15 * 60 * 1000);
      const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();

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
          includeTaskAdded: false,
        });
      }
      await ensureTaskMissedNotificationsForUser(userObjectId);

      if (!allowRescheduleFromNeeds) {
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
        engagement.currentActivityKey = "Record Prospect Attendance";
      }
      await engagement.save({ session });
    });

    return res.json({
      message: Boolean(rescheduleFromNeeds)
        ? "Meeting rescheduled. Please record prospect attendance again."
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
    const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;
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
      .select("outcomeActivity attendanceConfirmed attendedAt attendanceProofImageDataUrl attendanceProofFileName dependents needsPriorities")
      .lean();

    if (!needsAssessment) {
      const created = await NeedsAssessment.create({
        leadEngagementId: engagement._id,
      });
      needsAssessment = created.toObject();
    }

    const allLeadIds = await Lead.find({ prospectId: prospectObjectId }).distinct("_id");
    const allLeadEngagementIds = await LeadEngagement.find({ leadId: { $in: allLeadIds } }).distinct("_id");
    const policyholders = await Policyholder.find({ leadEngagementId: { $in: allLeadEngagementIds } })
      .select("policyNumber status productId")
      .populate("productId", "productName")
      .lean();

    const existingPolicies = (policyholders || []).map((p) => ({
      policyNumber: p.policyNumber || "",
      productName: p?.productId?.productName || "",
      status: p.status || "",
    }));

    const computedAge = prospect.birthday ? computeAgeFromBirthday(new Date(prospect.birthday)) : null;

    const products = await Product.find({})
      .select("_id productName productCategory description")
      .sort({ productCategory: 1, productName: 1 })
      .lean();

    const proposalMeeting = await ScheduledMeeting.findOne({
      leadEngagementId: engagement._id,
      meetingType: "Proposal Presentation",
    })
      .select("meetingType startAt endAt durationMin mode platform platformOther link inviteSent place status")
      .lean();

    const needsSteps = [
      "Record Prospect Attendance",
      "Perform Needs Analysis",
      "Schedule Proposal Presentation",
    ];
    const engagementActivity = String(engagement.currentActivityKey || "").trim();
    const naOutcome = String(needsAssessment.outcomeActivity || "").trim();

    let effectiveNeedsActivityKey;
    if (needsSteps.includes(engagementActivity)) {
      effectiveNeedsActivityKey = engagementActivity;
    } else if (["Proposal", "Application", "Policy Issuance"].includes(String(engagement.currentStage || ""))) {
      // Once lead has moved past Needs Assessment, keep this stage at its terminal activity.
      effectiveNeedsActivityKey = "Schedule Proposal Presentation";
    } else if (!needsAssessment.attendanceConfirmed) {
      effectiveNeedsActivityKey = "Record Prospect Attendance";
    } else if (["Perform Needs Analysis", "Schedule Proposal Presentation"].includes(naOutcome)) {
      effectiveNeedsActivityKey = "Schedule Proposal Presentation";
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
        outcomeActivity: needsAssessment.outcomeActivity || "",
        dependents: Array.isArray(needsAssessment.dependents) ? needsAssessment.dependents : [],
        needsPriorities: needsAssessment.needsPriorities || {},
      },
      existingPolicies,
      products: Array.isArray(products) ? products : [],
      proposalMeeting: proposalMeeting
        ? {
            meetingType: proposalMeeting.meetingType,
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
          }
        : null,
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
      na.attendanceProofImageDataUrl = proofDataUrl;
      na.attendanceProofFileName = proofFileName;
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

      const now = new Date();

      const needsAssessmentMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType: "Needs Assessment",
      }).session(session);
      if (needsAssessmentMeeting && needsAssessmentMeeting.status !== "Completed") {
        needsAssessmentMeeting.status = "Completed";
        await needsAssessmentMeeting.save({ session });
      }

      const openAppointmentTasks = await Task.find({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "APPOINTMENT",
        status: "Open",
      }).session(session);

      for (const t of openAppointmentTasks) {
        t.status = "Done";
        t.completedAt = now;
        await t.save({ session });
      }

      const presentationDedupeKey = `PRESENTATION:${engagement._id}`;
      let presentationTask = await Task.findOne({
        assignedToUserId: userObjectId,
        dedupeKey: presentationDedupeKey,
      }).session(session);

      const presentationTitle = `Present proposal to ${prospect.firstName}`;
      const presentationDescription = `Conduct proposal presentation for ${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName} (Lead ${lead.leadCode || "—"}). Meeting window: ${formatDateTimeInManila(dt)} to ${formatDateTimeInManila(endAt)} (Asia/Manila).`;
      const presentationDueAt = new Date(endAt.getTime() + 15 * 60 * 1000);

      if (!presentationTask) {
        presentationTask = await Task.create(
          [
            {
              assignedToUserId: userObjectId,
              prospectId: prospectObjectId,
              leadEngagementId: engagement._id,
              type: "PRESENTATION",
              title: presentationTitle,
              description: presentationDescription,
              dueAt: presentationDueAt,
              status: "Open",
              dedupeKey: presentationDedupeKey,
            },
          ],
          { session }
        ).then((docs) => docs[0]);

        const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: presentationTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
        });
      } else if (presentationTask.status !== "Done") {
        presentationTask.title = presentationTitle;
        presentationTask.description = presentationDescription;
        presentationTask.dueAt = presentationDueAt;
        await presentationTask.save({ session });

        const prospectFullName = `${prospect.firstName}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${prospect.lastName}`.trim();
        await createTaskAddedNotifications({
          assignedToUserId: userObjectId,
          task: presentationTask,
          prospectFullName,
          leadCode: lead.leadCode,
          session,
          includeTaskAdded: false,
        });
      }
      await ensureTaskMissedNotificationsForUser(userObjectId);

      na.outcomeActivity = "Schedule Proposal Presentation";
      await na.save({ session });

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

      await Proposal.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: {
            leadEngagementId: engagement._id,
          },
          $set: {
            outcomeActivity: "Generate Proposal",
          },
        },
        { upsert: true, session }
      );
    });

    return res.json({ message: "Proposal presentation scheduled. Proposal stage activated." });
  } catch (err) {
    console.error("Schedule proposal presentation error:", err);
    return res.status(err?.status || 500).json({ message: err?.message || "Server error.", code: err?.code });
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

      const proposalDoc = await Proposal.findOne({ leadEngagementId: engagement._id })
        .select("outcomeActivity")
        .session(session)
        .lean();

      const activityKey = String(engagement.currentActivityKey || proposalDoc?.outcomeActivity || "Generate Proposal").trim() || "Generate Proposal";
      if (activityKey !== "Generate Proposal") {
        throw Object.assign(new Error("Generate Proposal is not the current activity."), { status: 409 });
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

      const needsAssessment = await NeedsAssessment.findOne({ leadEngagementId: engagement._id })
        .select("needsPriorities.productSelection.selectedProductId")
        .session(session)
        .lean();
      const selectedProductId = chosenProductId || needsAssessment?.needsPriorities?.productSelection?.selectedProductId || null;
      const selectedProduct = selectedProductId && mongoose.isValidObjectId(selectedProductId)
        ? await Product.findById(selectedProductId).select("_id productName description paymentTermOptions paymentTermLabel coverageDurationRule coverageDurationLabel").session(session)
        : null;

      engagement.currentActivityKey = "Record Prospect Attendance";
      await engagement.save({ session });

      await Proposal.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            outcomeActivity: "Record Prospect Attendance",
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

    if (attended !== true) {
      return res.status(400).json({ message: "Prospect attendance must be marked attended." });
    }

    const proofDataUrl = String(attendanceProofImageDataUrl || "").trim();
    const proofFileName = String(attendanceProofFileName || "").trim();
    if (!proofDataUrl) {
      return res.status(400).json({ message: "Proof of attendance image is required and must be JPG, JPEG, or PNG." });
    }

    const isImageDataUrl = /^data:image\/(?:jpeg|png);base64,/i.test(proofDataUrl);
    if (!isImageDataUrl) {
      return res.status(400).json({ message: "Proof of attendance file type must be JPG, JPEG, or PNG." });
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

      if (engagement.currentStage !== "Proposal") {
        throw Object.assign(new Error("Lead is not in Proposal stage."), { status: 409 });
      }

      if (engagement.currentActivityKey !== "Record Prospect Attendance") {
        throw Object.assign(new Error("Record Prospect Attendance is not the current activity."), { status: 409 });
      }

      engagement.currentActivityKey = "Present Proposal";
      await engagement.save({ session });

      await Proposal.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            outcomeActivity: "Record Prospect Attendance",
            recordProspectAttendance: {
              attended: true,
              attendedAt: new Date(),
              attendanceProofImageDataUrl: proofDataUrl,
              attendanceProofFileName: proofFileName,
            },
          },
        },
        { upsert: true, session }
      );
    });

    return res.json({
      message: "Prospect attendance recorded.",
      currentActivityKey: "Present Proposal",
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

      engagement.currentActivityKey = "Record Premium Payment Transfer";
      await engagement.save({ session });

      await Application.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            outcomeActivity: "Record Premium Payment Transfer",
            recordProspectAttendance: {
              attended: true,
              attendedAt: new Date(),
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
      currentActivityKey: "Record Premium Payment Transfer",
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
      totalAnnualPremiumPhp,
      totalFrequencyPremiumPhp,
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

    const annualPremiumRaw = String(totalAnnualPremiumPhp ?? "").trim();
    const frequencyPremiumRaw = String(totalFrequencyPremiumPhp ?? "").trim();
    const annualPremium = toNonNegativeNumber(annualPremiumRaw);
    const frequencyPremium = toNonNegativeNumber(frequencyPremiumRaw);
    const initialPaymentMethod = String(methodForInitialPayment || "").trim();
    const renewalMethod = String(methodForRenewalPayment || "").trim();
    const proofDataUrl = String(paymentProofImageDataUrl || "").trim();
    const proofFileName = String(paymentProofFileName || "").trim();

    if (!annualPremiumRaw || annualPremium === null) return res.status(400).json({ message: "Total annual premium is required." });
    if (!frequencyPremiumRaw || frequencyPremium === null) return res.status(400).json({ message: "Total requested-frequency premium is required." });
    if (!hasAtMostTwoDecimals(annualPremium)) return res.status(400).json({ message: "Total annual premium must have at most 2 decimal places." });
    if (!hasAtMostTwoDecimals(frequencyPremium)) return res.status(400).json({ message: "Total requested-frequency premium must have at most 2 decimal places." });

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

      const needsAssessment = await NeedsAssessment.findOne({ leadEngagementId: engagement._id })
        .select("needsPriorities.productSelection.requestedFrequency")
        .session(session);

      const requestedFrequency = String(needsAssessment?.needsPriorities?.productSelection?.requestedFrequency || "").trim();

      if (!requestedFrequency) {
        throw Object.assign(new Error("Requested frequency is missing from Needs Assessment."), { status: 409 });
      }

      engagement.currentActivityKey = "Record Application Submission";
      await engagement.save({ session });

      await Application.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            outcomeActivity: "Record Application Submission",
            recordPremiumPaymentTransfer: {
              totalAnnualPremiumPhp: annualPremium,
              totalFrequencyPremiumPhp: frequencyPremium,
              methodForInitialPayment: initialPaymentMethod,
              methodForRenewalPayment: renewalMethod,
              paymentProofImageDataUrl: proofDataUrl,
              paymentProofFileName: proofFileName,
              savedAt: new Date(),
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
        throw Object.assign(new Error("PRUOnePH Transaction ID already exists."), { status: 409 });
      }

      const existingApplication = await Application.findOne({ leadEngagementId: engagement._id })
        .select("chosenProductId")
        .session(session);

      const proposal = await Proposal.findOne({ leadEngagementId: engagement._id })
        .select("chosenProductId")
        .session(session);
      const needsAssessment = await NeedsAssessment.findOne({ leadEngagementId: engagement._id })
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
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
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

      const openApplicationTasks = await Task.find({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "APPOINTMENT",
        status: "Open",
        dedupeKey: `APPLICATION_SUBMISSION:${engagement._id}`,
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

      await Policy.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            outcomeActivity: "Record Policy Application Status",
            ...(chosenProductId ? { chosenProductId } : {}),
          },
        },
        { upsert: true, session }
      );

      engagement.currentStage = "Policy Issuance";
      engagement.currentActivityKey = "Record Policy Application Status";
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
      currentActivityKey: "Record Policy Application Status",
      currentStage: "Policy Issuance",
    });
  } catch (err) {
    console.error("Application submission save error:", err);
    if (err?.code === 11000 && String(err?.message || "").includes("recordApplicationSubmission.pruOneTransactionId")) {
      return res.status(409).json({ message: "PRUOnePH Transaction ID already exists." });
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
    const { status, issuanceDate, notes } = req.body || {};
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(prospectId) || !mongoose.isValidObjectId(leadId)) {
      return res.status(400).json({ message: "Invalid id(s)." });
    }

    const normalizedStatus = String(status || "").trim();
    if (!["Issued", "Declined"].includes(normalizedStatus)) {
      return res.status(400).json({ message: "Policy application status must be Issued or Declined." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).select("_id").lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).select("_id").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage");
    if (!engagement) return res.status(404).json({ message: "Lead engagement not found." });
    if (engagement.currentStage !== "Policy Issuance") {
      return res.status(409).json({ message: "Lead is not in Policy Issuance stage." });
    }

    const existingPolicyDoc = await Policy.findOne({ leadEngagementId: engagement._id })
      .select("chosenProductId")
      .lean();

    const applicationDoc = await Application.findOne({ leadEngagementId: engagement._id })
      .select("chosenProductId recordApplicationSubmission.savedAt")
      .lean();

    const proposalDoc = await Proposal.findOne({ leadEngagementId: engagement._id })
      .select("chosenProductId")
      .lean();

    const needsAssessmentDoc = await NeedsAssessment.findOne({ leadEngagementId: engagement._id })
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

    const applicationSubmittedAt = applicationDoc?.recordApplicationSubmission?.savedAt
      ? new Date(applicationDoc.recordApplicationSubmission.savedAt)
      : null;

    let issuanceDateValue = null;
    if (normalizedStatus === "Issued") {
      const issuanceDateRaw = String(issuanceDate || "").trim();
      if (!issuanceDateRaw) {
        return res.status(400).json({ message: "Issuance date is required when status is Issued." });
      }
      issuanceDateValue = new Date(`${issuanceDateRaw}T00:00:00`);
      if (Number.isNaN(issuanceDateValue.getTime())) {
        return res.status(400).json({ message: "Issuance date is invalid." });
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (issuanceDateValue > today) {
        return res.status(400).json({ message: "Issuance date cannot be in the future." });
      }
      if (applicationSubmittedAt && issuanceDateValue < new Date(new Date(applicationSubmittedAt).setHours(0, 0, 0, 0))) {
        return res.status(400).json({ message: "Issuance date cannot be earlier than application submission date." });
      }
    }

    const nextActivityKey = normalizedStatus === "Issued" ? "Upload Initial Premium eOR" : "Record Policy Application Status";

    await Policy.updateOne(
      { leadEngagementId: engagement._id },
      {
        $setOnInsert: { leadEngagementId: engagement._id },
        $set: {
          outcomeActivity: nextActivityKey,
          ...(fallbackChosenProductId ? { chosenProductId: fallbackChosenProductId } : {}),
          recordPolicyApplicationStatus: {
            status: normalizedStatus,
            issuanceDate: issuanceDateValue,
            notes: String(notes || "").trim(),
            savedAt: new Date(),
          },
        },
      },
      { upsert: true }
    );

    await LeadEngagement.updateOne(
      { _id: engagement._id },
      { $set: { currentActivityKey: nextActivityKey } }
    );

    return res.json({ message: "Policy application status saved.", currentActivityKey: nextActivityKey });
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

    if (!eorNo) return res.status(400).json({ message: "eOR number is required." });
    if (!receiptDateRaw) return res.status(400).json({ message: "Receipt date is required." });
    if (!pdfDataUrl || !/^data:application\/pdf;base64,/i.test(pdfDataUrl)) {
      return res.status(400).json({ message: "eOR file must be a PDF." });
    }

    const receiptDateValue = new Date(`${receiptDateRaw}T00:00:00`);
    if (Number.isNaN(receiptDateValue.getTime())) {
      return res.status(400).json({ message: "Receipt date is invalid." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const prospectObjectId = new mongoose.Types.ObjectId(prospectId);
    const leadObjectId = new mongoose.Types.ObjectId(leadId);

    const prospect = await Prospect.findOne({ _id: prospectObjectId, assignedToUserId: userObjectId }).select("_id").lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found." });

    const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId }).select("_id").lean();
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage");
    if (!engagement) return res.status(404).json({ message: "Lead engagement not found." });
    if (engagement.currentStage !== "Policy Issuance") {
      return res.status(409).json({ message: "Lead is not in Policy Issuance stage." });
    }

    const applicationDoc = await Application.findOne({ leadEngagementId: engagement._id })
      .select("recordApplicationSubmission.savedAt")
      .lean();
    const policyDoc = await Policy.findOne({ leadEngagementId: engagement._id })
      .select("recordPolicyApplicationStatus.status recordPolicyApplicationStatus.issuanceDate")
      .lean();

    const applicationSubmittedAt = applicationDoc?.recordApplicationSubmission?.savedAt
      ? new Date(applicationDoc.recordApplicationSubmission.savedAt)
      : null;
    const issuanceDate = policyDoc?.recordPolicyApplicationStatus?.issuanceDate
      ? new Date(policyDoc.recordPolicyApplicationStatus.issuanceDate)
      : null;
    const status = String(policyDoc?.recordPolicyApplicationStatus?.status || "").trim();

    if (status !== "Issued") {
      return res.status(409).json({ message: "Policy application status must be Issued before uploading Initial Premium eOR." });
    }
    if (!applicationSubmittedAt || !issuanceDate) {
      return res.status(409).json({ message: "Application submission date and policy issuance date are required before uploading Initial Premium eOR." });
    }

    const minDate = new Date(applicationSubmittedAt);
    minDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(issuanceDate);
    maxDate.setHours(23, 59, 59, 999);
    if (receiptDateValue < minDate || receiptDateValue > maxDate) {
      return res.status(400).json({ message: "Receipt date must be between application submission date and policy issuance date." });
    }

    await Policy.updateOne(
      { leadEngagementId: engagement._id },
      {
        $setOnInsert: { leadEngagementId: engagement._id },
        $set: {
          outcomeActivity: "Upload Policy Summary",
          uploadInitialPremiumEor: {
            eorNumber: eorNo,
            receiptDate: receiptDateValue,
            eorFileDataUrl: pdfDataUrl,
            eorFileName: fileName,
            eorFileMimeType: "application/pdf",
            uploadedAt: new Date(),
          },
        },
      },
      { upsert: true }
    );

    await LeadEngagement.updateOne(
      { _id: engagement._id },
      { $set: { currentActivityKey: "Upload Policy Summary" } }
    );

    return res.json({ message: "Initial premium eOR uploaded.", currentActivityKey: "Upload Policy Summary" });
  } catch (err) {
    console.error("Policy issuance initial premium eOR save error:", err);
    if (err?.code === 11000 && String(err?.message || "").includes("uploadInitialPremiumEor.eorNumber")) {
      return res.status(409).json({ message: "eOR number already exists." });
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

    const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage");
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

    await Policy.updateOne(
      { leadEngagementId: engagement._id },
      {
        $setOnInsert: { leadEngagementId: engagement._id },
        $set: {
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
        .select("_id birthday")
        .session(session)
        .lean();
      if (!prospect) throw Object.assign(new Error("Prospect not found."), { status: 404 });

      const lead = await Lead.findOne({ _id: leadObjectId, prospectId: prospectObjectId })
        .session(session);
      if (!lead) throw Object.assign(new Error("Lead not found."), { status: 404 });

      const engagement = await LeadEngagement.findOne({ leadId: leadObjectId }).select("_id currentStage").session(session);
      if (!engagement) throw Object.assign(new Error("Lead engagement not found."), { status: 404 });
      if (engagement.currentStage !== "Policy Issuance") {
        throw Object.assign(new Error("Lead is not in Policy Issuance stage."), { status: 409 });
      }

      const policyDoc = await Policy.findOne({ leadEngagementId: engagement._id })
        .select("chosenProductId uploadPolicySummary.policyNumber uploadInitialPremiumEor.receiptDate recordPolicyApplicationStatus.status recordPolicyApplicationStatus.issuanceDate")
        .session(session)
        .lean();
      if (!policyDoc) throw Object.assign(new Error("Policy record not found."), { status: 404 });

      const productId = policyDoc?.chosenProductId;
      if (!productId || !mongoose.isValidObjectId(productId)) {
        throw Object.assign(new Error("Chosen product is missing for this policy."), { status: 409 });
      }

      const product = await Product.findById(productId)
        .select("paymentTermOptions coverageDurationRule")
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

      const receiptDate = policyDoc?.uploadInitialPremiumEor?.receiptDate
        ? new Date(policyDoc.uploadInitialPremiumEor.receiptDate)
        : null;

      const needsAssessment = await NeedsAssessment.findOne({ leadEngagementId: engagement._id })
        .select("needsPriorities.productSelection.requestedFrequency")
        .session(session)
        .lean();
      const requestedFrequency = String(needsAssessment?.needsPriorities?.productSelection?.requestedFrequency || "").trim();

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
        && receiptDate
        && !Number.isNaN(receiptDate.getTime())
        && paymentTermEndDate
        && !Number.isNaN(paymentTermEndDate.getTime())
      ) {
        const candidate = new Date(receiptDate);
        candidate.setMonth(candidate.getMonth() + recurringIntervalMonths);
        if (candidate < paymentTermEndDate) {
          nextPaymentDate = candidate;
        }
      }

      const now = new Date();

      await Policy.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
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
              nextPaymentDate,
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
      if (policyStatus === "Issued") {
        lead.status = "Closed";
        await lead.save({ session });

        const policyNumber = String(policyDoc?.uploadPolicySummary?.policyNumber || "").trim();
        if (!receiptDate || Number.isNaN(receiptDate.getTime())) {
          throw Object.assign(new Error("Initial premium receipt date is required to create policyholder."), { status: 409 });
        }
        if (!policyNumber) {
          throw Object.assign(new Error("Policy number is required to create policyholder."), { status: 409 });
        }

        let existingPolicyholder = await Policyholder.findOne({ leadEngagementId: engagement._id }).session(session);
        if (existingPolicyholder) {
          existingPolicyholder.assignedToUserId = userObjectId;
          existingPolicyholder.productId = new mongoose.Types.ObjectId(productId);
          existingPolicyholder.policyNumber = policyNumber;
          existingPolicyholder.lastPaidDate = receiptDate;
          existingPolicyholder.nextPaymentDate = nextPaymentDate;
          existingPolicyholder.status = "Active";
          await existingPolicyholder.save({ session });
        } else {
          const MAX_TRIES = 5;
          let lastErr = null;
          for (let i = 0; i < MAX_TRIES; i += 1) {
            try {
              const policyholderCode = await getNextPolicyholderCode();
              await Policyholder.create([
                {
                  policyholderCode,
                  assignedToUserId: userObjectId,
                  leadEngagementId: engagement._id,
                  productId: new mongoose.Types.ObjectId(productId),
                  policyNumber,
                  lastPaidDate: receiptDate,
                  nextPaymentDate,
                  status: "Active",
                },
              ], { session });
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

      responsePayload = {
        message: "Coverage duration details saved.",
        currentActivityKey: "Record Coverage Duration Details",
        policyEndDate,
        nextPaymentDate,
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

      if (engagement.currentStage !== "Proposal") {
        throw Object.assign(new Error("Lead is not in Proposal stage."), { status: 409 });
      }

      if (engagement.currentActivityKey !== "Schedule Application Submission") {
        throw Object.assign(new Error("Schedule Application Submission is not the current activity."), { status: 409 });
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

      const meetingType = "Application Submission";
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

      const now = new Date();

      const proposalPresentationMeeting = await ScheduledMeeting.findOne({
        leadEngagementId: engagement._id,
        meetingType: "Proposal Presentation",
      }).session(session);
      if (proposalPresentationMeeting && proposalPresentationMeeting.status !== "Completed") {
        proposalPresentationMeeting.status = "Completed";
        await proposalPresentationMeeting.save({ session });
      }

      const openPresentationTasks = await Task.find({
        assignedToUserId: userObjectId,
        prospectId: prospectObjectId,
        leadEngagementId: engagement._id,
        type: "PRESENTATION",
        status: "Open",
      }).session(session);

      for (const t of openPresentationTasks) {
        t.status = "Done";
        t.completedAt = now;
        await t.save({ session });
      }

      const applicationDedupeKey = `APPLICATION_SUBMISSION:${engagement._id}`;
      let applicationTask = await Task.findOne({
        assignedToUserId: userObjectId,
        dedupeKey: applicationDedupeKey,
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
          includeTaskAdded: false,
        });
      }
      await ensureTaskMissedNotificationsForUser(userObjectId);

      engagement.currentStage = "Application";
      engagement.currentActivityKey = "Schedule Application Submission";
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

      await Proposal.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: { outcomeActivity: "Schedule Application Submission" },
        },
        { upsert: true, session }
      );
    });

    return res.json({
      message: "Application submission meeting scheduled.",
      currentActivityKey: "Schedule Application Submission",
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

    const accepted = String(proposalAccepted || "").trim().toUpperCase();
    if (!["YES", "NO"].includes(accepted)) {
      return res.status(400).json({ message: "Please select whether proposal is accepted (Yes/No)." });
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

      if (engagement.currentStage !== "Proposal") {
        throw Object.assign(new Error("Lead is not in Proposal stage."), { status: 409 });
      }

      if (engagement.currentActivityKey !== "Present Proposal") {
        throw Object.assign(new Error("Present Proposal is not the current activity."), { status: 409 });
      }

      engagement.currentActivityKey = "Schedule Application Submission";
      await engagement.save({ session });

      await Proposal.updateOne(
        { leadEngagementId: engagement._id },
        {
          $setOnInsert: { leadEngagementId: engagement._id },
          $set: {
            outcomeActivity: "Present Proposal",
            presentProposal: {
              proposalAccepted: accepted,
              initialQuotationNotes: accepted === "YES" ? String(initialQuotationNotes || "").trim() : "",
              presentedAt: new Date(),
            },
          },
        },
        { upsert: true, session }
      );
    });

    return res.json({
      message: "Proposal presentation details saved.",
      currentActivityKey: "Schedule Application Submission",
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
    let openTasks = await Task.find({ assignedToUserId: userObjectId, status: "Open" })
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
    const { userId, datePreset = "30d", status = "ALL", type = "ALL", drillType = "", drillLimit = "12", reportLimit = "120" } = req.query;
    if (!userId) return res.status(400).json({ message: "Missing userId." });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId." });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    await ensureTaskMissedNotificationsForUser(userObjectId);

    let tasks = await Task.find({ assignedToUserId: userObjectId })
      .select("_id prospectId leadEngagementId type title dueAt status completedAt wasDelayed createdAt")
      .lean();

    tasks = await attachTaskRefs(tasks);

    const now = Date.now();
    const fromMs = (() => {
      if (String(datePreset) === "7d") return now - 7 * 24 * 60 * 60 * 1000;
      if (String(datePreset) === "30d") return now - 30 * 24 * 60 * 60 * 1000;
      if (String(datePreset) === "90d") return now - 90 * 24 * 60 * 60 * 1000;
      return null;
    })();

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

      const s = String(status).toUpperCase().trim();
      if (s === "OPEN" && t.status !== "Open") return false;
      if (s === "DONE" && t.status !== "Done") return false;
      if (s === "OVERDUE_OPEN" && !t.isOverdue) return false;
      if (s === "DELAYED_DONE" && !(t.status === "Done" && t.wasDelayed)) return false;

      if (fromMs != null) {
        const refMs = Number.isFinite(t.dueAtMs) ? t.dueAtMs : t.createdAtMs;
        if (!Number.isFinite(refMs) || refMs < fromMs) return false;
      }
      return true;
    });

    const open = filtered.filter((t) => t.status === "Open");
    const done = filtered.filter((t) => t.status === "Done");
    const overdue = open.filter((t) => t.isOverdue);
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
        total: 0,
        open: 0,
        overdue: 0,
      };
      row.total += 1;
      if (t.status === "Open") row.open += 1;
      if (t.isOverdue) row.overdue += 1;
      leadWorkloadMap.set(key, row);
    }

    const leadWorkloadRows = [...leadWorkloadMap.values()]
      .sort((a, b) => b.open - a.open || b.total - a.total)
      .slice(0, 8);

    const normalizedDrillType = String(drillType || "").toUpperCase().trim();
    const drillMax = Math.max(1, Math.min(100, Number(drillLimit) || 12));
    const reportMax = Math.max(20, Math.min(500, Number(reportLimit) || 120));

    const drillTasks = normalizedDrillType
      ? filtered
          .filter((t) => t.type === normalizedDrillType)
          .sort((a, b) => (Number.isFinite(a.dueAtMs) ? a.dueAtMs : Infinity) - (Number.isFinite(b.dueAtMs) ? b.dueAtMs : Infinity))
          .slice(0, drillMax)
      : [];

    const reportTasks = filtered
      .slice()
      .sort((a, b) => (Number.isFinite(a.dueAtMs) ? a.dueAtMs : Infinity) - (Number.isFinite(b.dueAtMs) ? b.dueAtMs : Infinity))
      .slice(0, reportMax);

    const totalTasks = filtered.length;
    const completionRate = totalTasks ? Math.round((done.length / totalTasks) * 100) : 0;
    const onTimeRate = done.length ? Math.round((onTimeDone.length / done.length) * 100) : 0;
    const lateCompletionRate = done.length ? Math.round((delayedDone.length / done.length) * 100) : 0;
    const overdueOpenRate = open.length ? Math.round((overdue.length / open.length) * 100) : 0;

    return res.json({
      totalTasks,
      openTasks: open.length,
      doneTasks: done.length,
      overdueTasks: overdue.length,
      delayedDoneTasks: delayedDone.length,
      completionRate,
      onTimeRate,
      lateCompletionRate,
      overdueOpenRate,
      typeCounts,
      leadWorkloadRows,
      statusChart: [
        { key: "Open", value: open.length, color: "#ef4444" },
        { key: "Done", value: done.length, color: "#16a34a" },
        { key: "Overdue Open", value: overdue.length, color: "#f59e0b" },
        { key: "Delayed Done", value: delayedDone.length, color: "#7c3aed" },
      ],
      drillTasks,
      reportTasks,
      reportContext: {
        datePreset: String(datePreset),
        status: String(status),
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
    let tasks = await Task.find(query)
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
