const express = require("express");
const { createNotificationsController } = require("../controllers/notificationsController");

function createNotificationsRouter(deps) {
  const router = express.Router();
  const controller = createNotificationsController(deps);

  router.get("/", controller.listNotifications);
  router.patch("/:id/read", controller.markNotificationRead);
  router.get("/unread-count", controller.getUnreadCount);
  router.get("/counts", controller.getCounts);

  return router;
}

module.exports = {
  createNotificationsRouter,
};
