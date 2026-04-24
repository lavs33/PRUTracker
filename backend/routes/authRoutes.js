const express = require("express");
const { createAuthController } = require("../controllers/authController");

function createAuthRouter(deps) {
  const router = express.Router();
  const controller = createAuthController(deps);

  router.post("/api/auth/login", controller.login);
  router.get("/api/manager/portal", controller.getManagerPortal);
  router.post("/api/admin/auth/login", controller.adminLogin);

  return router;
}

module.exports = {
  createAuthRouter,
};
