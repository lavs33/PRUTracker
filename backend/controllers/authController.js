function createAuthController({
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
}) {
  const login = async (req, res) => {
    try {
      const { role, username, password } = req.body;

      if (!role || !username || !password) {
        return res.status(400).json({ message: "Missing required fields." });
      }

      const roleMap = { Agent: "AG", AUM: "AUM", UM: "UM", BM: "BM" };
      const dbRole = roleMap[role];

      if (!dbRole) {
        return res.status(400).json({ message: "Invalid role." });
      }

      const user = await User.findOne({ username, role: dbRole }).lean();

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password." });
      }

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
      } else if (user.role === "AUM" || user.role === "UM") {
        const ManagerModel = user.role === "AUM" ? AUM : UM;
        const manager = await ManagerModel.findOne({ userId: user._id }).populate(buildManagerPopulateQuery(user.role)).lean();

        if (!manager) {
          return res.status(403).json({
            message: "No active manager assignment was found for this account. Please contact Admin.",
          });
        }

        if (manager.isBlocked === true) {
          return res.status(403).json({
            message: "This manager account has been replaced and can no longer access the portal.",
          });
        }

        const profile = getManagerProfile(manager);

        if (manager) {
          payload.unitName = profile.unit?.unitName || "";
          payload.branchName = profile.branch?.branchName || "";
          payload.areaName = profile.area?.areaName || "";
        }
      } else if (user.role === "BM") {
        const manager = await BM.findOne({ userId: user._id }).populate(buildManagerPopulateQuery("BM")).lean();

        if (!manager) {
          return res.status(403).json({
            message: "No active manager assignment was found for this account. Please contact Admin.",
          });
        }

        if (manager.isBlocked === true) {
          return res.status(403).json({
            message: "This manager account has been replaced and can no longer access the portal.",
          });
        }

        const profile = getManagerProfile(manager);

        if (manager) {
          payload.branchName = profile.branch?.branchName || "";
          payload.areaName = profile.area?.areaName || "";
        }
      }

      return res.json({ message: "Login successful", user: payload });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  };

  const getManagerPortal = async (req, res) => {
    try {
      const { userId, taskDatePreset = "ALL", salesDatePreset = "ALL" } = req.query;

      if (!userId) return res.status(400).json({ message: "Missing userId." });
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid userId." });
      }

      const user = await User.findById(userId).select("username firstName middleName lastName displayPhoto role").lean();

      if (!user) return res.status(404).json({ message: "User not found." });
      if (!["AUM", "UM", "BM"].includes(String(user.role || "").trim().toUpperCase())) {
        return res.status(403).json({ message: "This account does not have manager portal access." });
      }

      const result = await buildManagerPortalPayload(user, { taskDatePreset, salesDatePreset });
      if (result.error) {
        return res.status(result.error.status).json({ message: result.error.message });
      }

      return res.json(result.payload);
    } catch (err) {
      console.error("Manager portal data error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  };

  const adminLogin = async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");

      if (!username || !password) {
        return res.status(400).json({ message: "Missing required fields." });
      }

      const admin = await Admin.findOne({ username }).lean();

      if (!admin) {
        return res.status(401).json({ message: "Invalid username or password." });
      }

      if (admin.isActive === false) {
        return res.status(403).json({ message: "Admin account is inactive." });
      }

      const passwordMatches = await bcrypt.compare(password, admin.passwordHash || "");

      if (!passwordMatches) {
        return res.status(401).json({ message: "Invalid username or password." });
      }

      const payload = {
        id: admin._id,
        role: "Admin",
        username: admin.username,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email || "",
        isActive: admin.isActive !== false,
      };

      return res.json({ message: "Admin login successful", admin: payload });
    } catch (err) {
      console.error("Admin login error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  };

  return {
    login,
    getManagerPortal,
    adminLogin,
  };
}

module.exports = {
  createAuthController,
};