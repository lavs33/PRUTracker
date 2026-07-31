import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentNotifications.css";

const UNIT_KPI_NOTIF_TYPES = ["UNIT_KPI_ASSIGNED", "UNIT_KPI_TARGET_UPDATED", "UNIT_KPI_UNASSIGNED"];
const AGENT_KPI_NOTIF_TYPES = ["AGENT_KPI_ASSIGNED", "AGENT_KPI_TARGET_UPDATED", "AGENT_KPI_UNASSIGNED"];
const KPI_NOTIF_TYPES = [...UNIT_KPI_NOTIF_TYPES, ...AGENT_KPI_NOTIF_TYPES];
const NOTIF_TYPES = ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED", "PAYMENT_TRANSFER_REMINDER", "PAYMENT_EOR_REMINDER", "PAYMENT_MISSED_TRANSFER", "POLICY_LAPSED", "POLICY_PAID_UP", "POLICY_MATURED", "POLICY_PAID_UP_MATURED", "POLICY_CANCELLED", "ORPHAN_CLIENT_ASSIGNED", "ORPHAN_CLIENT_TRANSFERRED", ...KPI_NOTIF_TYPES];
const PRIORITY_LEVELS = ["urgent", "high", "normal", "informational"];
const PRIORITY_BY_TYPE = {
  POLICY_LAPSED: "urgent",
  PAYMENT_MISSED_TRANSFER: "urgent",
  TASK_MISSED: "urgent",
  TASK_DUE_TODAY: "high",
  PAYMENT_TRANSFER_REMINDER: "high",
  PAYMENT_EOR_REMINDER: "high",
  POLICY_CANCELLED: "high",
  ORPHAN_CLIENT_ASSIGNED: "high",
  TASK_ADDED: "normal",
  AGENT_KPI_ASSIGNED: "normal",
  AGENT_KPI_TARGET_UPDATED: "normal",
  AGENT_KPI_UNASSIGNED: "normal",
  UNIT_KPI_ASSIGNED: "normal",
  UNIT_KPI_TARGET_UPDATED: "normal",
  UNIT_KPI_UNASSIGNED: "normal",
  POLICY_PAID_UP: "informational",
  POLICY_MATURED: "informational",
  POLICY_PAID_UP_MATURED: "informational",
  ORPHAN_CLIENT_TRANSFERRED: "informational",
};

const notificationPriority = (type) => PRIORITY_BY_TYPE[String(type || "").trim().toUpperCase()] || "normal";

const notificationWithinDateRange = (notification, dateRange) => {
  if (dateRange === "all") return true;
  const timestamp = new Date(notification?.createdAt || 0);
  if (Number.isNaN(timestamp.getTime())) return false;
  const now = new Date();
  let start = new Date(now);
  if (dateRange === "today") start.setHours(0, 0, 0, 0);
  else if (dateRange === "7d") start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  else if (dateRange === "30d") start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  else if (dateRange === "90d") start = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
  else if (dateRange === "6m") start.setMonth(start.getMonth() - 6);
  else if (dateRange === "12m") start.setFullYear(start.getFullYear() - 1);
  return timestamp >= start && timestamp <= now;
};

const notificationResolution = (notification) => String(notification?.resolutionStatus || "Not Applicable").trim();
const taskNotificationOrder = {
  TASK_MISSED: 0,
  TASK_DUE_TODAY: 1,
  TASK_ADDED: 2,
};
const notificationCreatedTime = (notification) => {
  const timestamp = new Date(notification?.createdAt || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
const compareAgentNotifications = (a, b) => {
  const createdDifference = notificationCreatedTime(b) - notificationCreatedTime(a);
  if (createdDifference !== 0) return createdDifference;

  const aTaskOrder = taskNotificationOrder[String(a?.type || "").toUpperCase()];
  const bTaskOrder = taskNotificationOrder[String(b?.type || "").toUpperCase()];
  if (aTaskOrder !== undefined && bTaskOrder !== undefined) return aTaskOrder - bTaskOrder;
  return 0;
};
const filterNotifications = (notifications, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignorePriority = false, ignoreResolution = false }) => {
  const normalizedType = String(typeFilter || "").trim().toUpperCase();
  return notifications.filter((notification) => (
    (!normalizedType || String(notification?.type || "").trim().toUpperCase() === normalizedType)
    && (ignorePriority || priorityFilter === "all" || notificationPriority(notification?.type) === priorityFilter)
    && (ignoreResolution || resolutionFilter === "all" || notificationResolution(notification) === resolutionFilter)
    && notificationWithinDateRange(notification, dateRange)
  ));
};

function AgentNotifications() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const API_BASE = "http://localhost:5000";

  // Tabs: unread | read
  const [tab, setTab] = useState("unread");

  // Filter: type only
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [resolutionFilter, setResolutionFilter] = useState("all");

  // list state
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [notifs, setNotifs] = useState([]);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingNotifId, setMarkingNotifId] = useState("");

  // counts state (always numeric)
  const [counts, setCounts] = useState({ unread: 0, read: 0 });
  const [priorityCounts, setPriorityCounts] = useState({ urgent: 0, high: 0, normal: 0, informational: 0 });
  const [resolutionCounts, setResolutionCounts] = useState({ all: 0, unresolved: 0, resolved: 0 });

  // Guard
  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Notifications`;
  }, [username]);

  const formatWhen = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSideNav = (key) => {
    if (!user) return navigate("/");

    switch (key) {
      case "clients":
        navigate(`/agent/${user.username}/clients`);
        break;

      case "clients_relationship":
        navigate(`/agent/${user.username}/clients/relationship`);
        break;

      case "clients_all_prospects":
        navigate(`/agent/${user.username}/prospects`);
        break;

      case "clients_all_policyholders":
        navigate(`/agent/${user.username}/policyholders`);
        break;

      case "tasks":
        navigate(`/agent/${user.username}/tasks`);
        break;

      case "tasks_progress":
        navigate(`/agent/${user.username}/tasks/progress`);
        break;

      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;

      // notifications route exists for bell
      case "notifications":
        navigate(`/agent/${user.username}/notifications`);
        break;

      case "sales": navigate(`/agent/${user.username}/sales/performance`); break;
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;

      default:
        break;
    }
  };

  // Fetch counts from backend (Unread + Read)
  const fetchCounts = useCallback(
    async (signal) => {
      if (!user?.id) return;
      const loadStatusCount = async (status) => {
        const qs = new URLSearchParams({ userId: user.id, status, includeRefs: "1" });
        const res = await fetch(`${API_BASE}/api/notifications?${qs.toString()}`, { ...(signal ? { signal } : {}), cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to fetch notification counts.");
        const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
        return filterNotifications(notifications, { typeFilter, priorityFilter, resolutionFilter, dateRange }).length;
      };
      const [unread, read] = await Promise.all([loadStatusCount("Unread"), loadStatusCount("Read")]);
      setCounts({ unread, read });
    },
    [API_BASE, user?.id, typeFilter, priorityFilter, resolutionFilter, dateRange]
  );

  // Fetch notifications list for current tab + filters
  const fetchNotifs = useCallback(
    async (signal) => {
      if (!user?.id) return;

      const status = tab === "read" ? "Read" : "Unread";

      const qs = new URLSearchParams({
        userId: user.id,
        status,
        includeRefs: "1",
      });

      const res = await fetch(
        `${API_BASE}/api/notifications?${qs.toString()}`,
        { ...(signal ? { signal } : {}), cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications.");

      const arr = Array.isArray(data?.notifications) ? data.notifications : [];
      const resolutionCountBase = filterNotifications(arr, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignoreResolution: true });
      setResolutionCounts({
        all: resolutionCountBase.length,
        unresolved: resolutionCountBase.filter((notification) => notificationResolution(notification) === "Unresolved").length,
        resolved: resolutionCountBase.filter((notification) => notificationResolution(notification) === "Resolved").length,
      });
      const typeFiltered = filterNotifications(arr, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignorePriority: true });
      setPriorityCounts(PRIORITY_LEVELS.reduce((result, priority) => ({
        ...result,
        [priority]: typeFiltered.filter((notification) => notificationPriority(notification?.type) === priority).length,
      }), {}));
      const priorityFiltered = priorityFilter === "all"
        ? typeFiltered
        : typeFiltered.filter((notification) => notificationPriority(notification?.type) === priorityFilter);
      setNotifs([...priorityFiltered].sort(compareAgentNotifications));
    },
    [API_BASE, user?.id, tab, typeFilter, priorityFilter, resolutionFilter, dateRange]
  );

  // Load counts + list
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setApiError("");
        await Promise.all([fetchCounts(controller.signal), fetchNotifs(controller.signal)]);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server. Is backend running?");
          setNotifs([]);
          setCounts({ unread: 0, read: 0 });
          setPriorityCounts({ urgent: 0, high: 0, normal: 0, informational: 0 });
          setResolutionCounts({ all: 0, unresolved: 0, resolved: 0 });
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [user?.id, fetchCounts, fetchNotifs]);

  const typePillClass = (type) => {
    const t = String(type || "").toUpperCase();
    if (t === "TASK_ADDED") return "notif-pill added";
    if (t === "TASK_DUE_TODAY") return "notif-pill due";
    if (t === "TASK_MISSED") return "notif-pill missed";
    if (t === "PAYMENT_TRANSFER_REMINDER" || t === "PAYMENT_EOR_REMINDER" || t === "PAYMENT_MISSED_TRANSFER" || t === "POLICY_LAPSED" || t === "POLICY_PAID_UP" || t === "POLICY_MATURED" || t === "POLICY_PAID_UP_MATURED" || t === "POLICY_CANCELLED") return "notif-pill payment";
    if (t === "ORPHAN_CLIENT_ASSIGNED" || t === "ORPHAN_CLIENT_TRANSFERRED") return "notif-pill orphan";
    if (t === "UNIT_KPI_ASSIGNED" || t === "AGENT_KPI_ASSIGNED") return "notif-pill kpi-assigned";
    if (t === "UNIT_KPI_TARGET_UPDATED" || t === "AGENT_KPI_TARGET_UPDATED") return "notif-pill kpi-updated";
    if (t === "UNIT_KPI_UNASSIGNED" || t === "AGENT_KPI_UNASSIGNED") return "notif-pill kpi-unassigned";
    return "notif-pill";
  };

  const markNotifAsRead = async (notifId) => {
    if (!user?.id || !notifId) return;
    setMarkingNotifId(String(notifId));
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${notifId}/read?userId=${user.id}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to mark notification as read.");
      await Promise.all([fetchCounts(), fetchNotifs()]);
    } catch (err) {
      setApiError(err?.message || "Failed to mark notification as read.");
    } finally {
      setMarkingNotifId("");
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    setMarkingAllRead(true);
    try {
      if (priorityFilter !== "all" || resolutionFilter !== "all" || dateRange !== "all") {
        const responses = await Promise.all(notifs.map((notification) => fetch(
          `${API_BASE}/api/notifications/${notification._id}/read?userId=${user.id}`,
          { method: "PATCH" }
        )));
        if (responses.some((response) => !response.ok)) throw new Error("Failed to mark all priority notifications as read.");
        await Promise.all([fetchCounts(), fetchNotifs()]);
        return;
      }
      const qs = new URLSearchParams({
        userId: user.id,
      });
      if (typeFilter) qs.set("type", typeFilter);

      const res = await fetch(`${API_BASE}/api/notifications/read-all?${qs.toString()}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to mark all notifications as read.");
      await Promise.all([fetchCounts(), fetchNotifs()]);
    } catch (err) {
      setApiError(err?.message || "Failed to mark all notifications as read.");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const isOpenDisabled = (n) => String(n?.type || "") === "ORPHAN_CLIENT_TRANSFERRED"
    || n?.metadata?.transferredAway === true
    || n?.transferredAwayForViewer === true;

  const openNotif = async (n) => {
    if (isOpenDisabled(n)) return;
    const metadataProspectId = n?.metadata?.prospectId || (n.entityType === "Prospect" ? n.entityId : "");
    const metadataLeadId = n?.metadata?.leadId || "";
    const policyholderId = n?.metadata?.policyholderId || (n.entityType === "Policyholder" ? n.entityId : "");
    const annualPaymentId = n?.metadata?.annualPaymentId || "";
    if (policyholderId && annualPaymentId) {
      navigate(`/agent/${username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}`);
      return;
    }

    if (policyholderId) {
      navigate(`/agent/${username}/policyholders/${policyholderId}`);
      return;
    }

    const prospectId = n.prospectId || metadataProspectId;
    const leadId = n.leadId || metadataLeadId;

    if (String(n?.type || "") !== "ORPHAN_CLIENT_ASSIGNED" && prospectId && leadId) {
      navigate(`/agent/${username}/prospects/${prospectId}/leads/${leadId}/engage`);
      return;
    }

    if (prospectId) {
      navigate(`/agent/${username}/prospects/${prospectId}`);
      return;
    }

    navigate(`/agent/${username}/tasks/all`);
  };

  const NotifRow = ({ n }) => (
    <div className={`notif-row ${n.status === "Unread" ? "unread" : ""}`}>
      <div className="notif-left">
        <div className="notif-topline">
          {n.status === "Unread" ? <span className="notif-dot" aria-label="Unread" /> : null}
          <span className={typePillClass(n.type)}>{n.type}</span>
          <span className={`notif-priority notif-priority--${notificationPriority(n.type)}`}>{notificationPriority(n.type)}</span>
          {notificationResolution(n) !== "Not Applicable" ? <span className={`notif-resolution notif-resolution--${notificationResolution(n).toLowerCase()}`}>{notificationResolution(n)}</span> : null}
          <span className="notif-time">{formatWhen(n.createdAt)}</span>
        </div>

        <div className="notif-title">{n.title}</div>
        {String(n.message || "").trim() ? <div className="notif-msg">{n.message}</div> : null}
      </div>

      <div className="notif-right">
        {tab === "unread" ? (
          <button
            type="button"
            className="notif-btn secondary"
            onClick={() => markNotifAsRead(n._id)}
            disabled={markingNotifId === String(n._id) || markingAllRead}
          >
            {markingNotifId === String(n._id) ? "Marking..." : "Mark as Read"}
          </button>
        ) : !KPI_NOTIF_TYPES.includes(String(n?.type || "").toUpperCase()) ? (
          <button
            type="button"
            className="notif-btn secondary"
            onClick={() => openNotif(n)}
            disabled={isOpenDisabled(n)}
            title={isOpenDisabled(n) ? "🚫" : "Open notification record"}
          >
            Open
          </button>
        ) : null}
      </div>
    </div>
  );

  if (!user || user.username !== username) return null;

  return (
    <div className="notifs-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="notifs-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="notifs-content">
          <div className="notifs-headerRow">
            <div>
              <h1 className="notifs-title">Notifications</h1>
            </div>
          </div>

          {/* Tabs + Type filter */}
          <div className="notifs-toolbar">
            <div className="notifs-tabs">
              <button
                type="button"
                className={`notifs-tab is-unread ${tab === "unread" ? "active" : ""}`}
                onClick={() => setTab("unread")}
              >
                Unread <span className="notifs-badge unread">{counts.unread}</span>
              </button>

              <button
                type="button"
                className={`notifs-tab is-read ${tab === "read" ? "active" : ""}`}
                onClick={() => setTab("read")}
              >
                Read <span className="notifs-badge read">{counts.read}</span>
              </button>
            </div>

            <div className="notifs-filter">
              <select
                className="notifs-select"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                aria-label="Notification priority filter"
              >
                <option value="all">All Priorities ({PRIORITY_LEVELS.reduce((total, priority) => total + Number(priorityCounts[priority] || 0), 0)})</option>
                {PRIORITY_LEVELS.map((priority) => (
                  <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)} ({priorityCounts[priority]})</option>
                ))}
              </select>

              <select
                className="notifs-select"
                value={resolutionFilter}
                onChange={(e) => setResolutionFilter(e.target.value)}
                aria-label="Notification resolution filter"
              >
                <option value="all">All Resolution Statuses ({resolutionCounts.all})</option>
                <option value="Unresolved">Unresolved ({resolutionCounts.unresolved})</option>
                <option value="Resolved">Resolved ({resolutionCounts.resolved})</option>
              </select>

              <select
                className="notifs-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {NOTIF_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                className="notifs-select"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                aria-label="Notification date range filter"
              >
                <option value="all">All Time</option>
                <option value="today">This Day</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="6m">Last 6 Months</option>
                <option value="12m">Last 12 Months</option>
              </select>

              <button type="button" className="notif-btn ghost" onClick={() => { setTypeFilter(""); setPriorityFilter("all"); setResolutionFilter("all"); setDateRange("all"); }} disabled={!typeFilter && priorityFilter === "all" && resolutionFilter === "all" && dateRange === "all"}>
                Clear
              </button>

              <button
                type="button"
                className="notif-btn secondary"
                onClick={markAllAsRead}
                disabled={tab !== "unread" || markingAllRead || counts.unread <= 0}
              >
                {markingAllRead ? "Marking..." : "Mark All as Read"}
              </button>
            </div>
          </div>

          {/* Loading / Error */}
          {loading ? <div className="notifs-empty">Loading notifications...</div> : null}

          {!loading && apiError ? (
            <div className="notifs-empty" style={{ color: "#FFFFFF" }}>
              {apiError}
            </div>
          ) : null}

          {/* List */}
          {!loading && !apiError ? (
            <div className="notifs-list">
              {notifs.length === 0 ? (
                <div className="notifs-empty">
                  {tab === "unread" ? "No unread notifications." : "No read notifications."}
                </div>
              ) : (
                notifs.map((n) => <NotifRow key={n._id} n={n} />)
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default AgentNotifications;