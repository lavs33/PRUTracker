import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import ManagerSideNav from "./components/ManagerSideNav";
import { logout } from "./utils/logout";
import "./ManagerNotifications.css";

const API_BASE = "http://localhost:5000";
const BRANCH_KPI_NOTIF_TYPES = ["BRANCH_KPI_ASSIGNED", "BRANCH_KPI_TARGET_UPDATED", "BRANCH_KPI_UNASSIGNED"];
const UNIT_KPI_NOTIF_TYPES = ["UNIT_KPI_ASSIGNED", "UNIT_KPI_TARGET_UPDATED", "UNIT_KPI_UNASSIGNED"];
const AGENT_KPI_NOTIF_TYPES = ["AGENT_KPI_ASSIGNED", "AGENT_KPI_TARGET_UPDATED", "AGENT_KPI_UNASSIGNED"];
const KPI_NOTIF_TYPES = [...BRANCH_KPI_NOTIF_TYPES, ...UNIT_KPI_NOTIF_TYPES, ...AGENT_KPI_NOTIF_TYPES];
const KPI_UNASSIGNED_NOTIF_TYPES = ["BRANCH_KPI_UNASSIGNED", "UNIT_KPI_UNASSIGNED", "AGENT_KPI_UNASSIGNED"];
const PRIORITY_LEVELS = ["urgent", "high", "normal"];
const notificationPriority = (type) => {
  const normalizedType = String(type || "").trim().toUpperCase();
  if (normalizedType === "ORPHANS_ENDORSEMENTS") return "urgent";
  if (KPI_UNASSIGNED_NOTIF_TYPES.includes(normalizedType)) return "urgent";
  return "normal";
};
const notificationCreatedTime = (notification) => {
  const timestamp = new Date(notification?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const notificationWithinDateRange = (notification, dateRange) => {
  if (dateRange === "all") return true;
  const timestamp = new Date(notificationCreatedTime(notification));
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
const filterNotifications = (notifications, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignorePriority = false, ignoreResolution = false }) => {
  const normalizedType = String(typeFilter || "").trim().toUpperCase();
  return notifications.filter((notification) => (
    (!normalizedType || String(notification?.type || "").trim().toUpperCase() === normalizedType)
    && (ignorePriority || priorityFilter === "all" || notificationPriority(notification?.type) === priorityFilter)
    && (ignoreResolution || resolutionFilter === "all" || notificationResolution(notification) === resolutionFilter)
    && notificationWithinDateRange(notification, dateRange)
  ));
};

function ManagerNotifications({ roleType }) {
  const navigate = useNavigate();
  const { username } = useParams();
  const [tab, setTab] = useState("unread");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [resolutionFilter, setResolutionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [notifs, setNotifs] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, read: 0 });
  const [priorityCounts, setPriorityCounts] = useState({ urgent: 0, high: 0, normal: 0 });
  const [resolutionCounts, setResolutionCounts] = useState({ all: 0, unresolved: 0, resolved: 0 });
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingNotifId, setMarkingNotifId] = useState("");
  const [sideNavCollapsed, setSideNavCollapsed] = useState(false);

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("managerPortalUser") || "null"); } catch { return null; }
  }, []);
  const normalizedRole = String(roleType || user?.role || "UM").trim().toLowerCase();
  const availablePriorityLevels = normalizedRole === "bm" ? ["urgent", "normal"] : normalizedRole === "aum" ? ["high", "normal"] : PRIORITY_LEVELS;
  const managerNotifTypes = normalizedRole === "um"
    ? ["ORPHANS_ENDORSEMENTS", ...BRANCH_KPI_NOTIF_TYPES, ...UNIT_KPI_NOTIF_TYPES]
    : normalizedRole === "aum"
      ? [...BRANCH_KPI_NOTIF_TYPES, ...UNIT_KPI_NOTIF_TYPES]
      : [...BRANCH_KPI_NOTIF_TYPES, ...UNIT_KPI_NOTIF_TYPES, ...AGENT_KPI_NOTIF_TYPES];

  useEffect(() => {
    const sessionRole = String(user?.role || "").trim().toLowerCase();
    const hasMatchingManagerSession = ["aum", "um", "bm"].includes(normalizedRole) && sessionRole === normalizedRole;

    if (!user || !hasMatchingManagerSession) {
      localStorage.setItem("role", normalizedRole.toUpperCase());
      navigate("/login", { replace: true });
      return;
    }

    if (user.username !== username) {
      navigate(`/${normalizedRole}/${user.username}/notifications`, { replace: true });
    }
  }, [user, username, normalizedRole, navigate]);

  useEffect(() => {
    if (normalizedRole === "aum" && priorityFilter === "urgent") setPriorityFilter("all");
    if (!["um", "bm"].includes(normalizedRole) && resolutionFilter !== "all") setResolutionFilter("all");
  }, [normalizedRole, priorityFilter, resolutionFilter]);

  useEffect(() => { document.title = `${username} | Notifications`; }, [username]);

  const fetchCounts = useCallback(async (signal) => {
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
  }, [user?.id, typeFilter, priorityFilter, resolutionFilter, dateRange]);

  const fetchNotifs = useCallback(async (signal) => {
    if (!user?.id) return;
    const qs = new URLSearchParams({ userId: user.id, status: tab === "read" ? "Read" : "Unread", includeRefs: "1" });
    const res = await fetch(`${API_BASE}/api/notifications?${qs.toString()}`, { ...(signal ? { signal } : {}), cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications.");
    const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
    const resolutionCountBase = filterNotifications(notifications, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignoreResolution: true });
    const resolutionNotifications = normalizedRole === "bm"
      ? resolutionCountBase.filter((notification) => KPI_UNASSIGNED_NOTIF_TYPES.includes(notification.type))
      : resolutionCountBase.filter((notification) => notification.type === "ORPHANS_ENDORSEMENTS");
    setResolutionCounts({
      all: resolutionNotifications.length,
      unresolved: resolutionNotifications.filter((notification) => notificationResolution(notification) === "Unresolved").length,
      resolved: resolutionNotifications.filter((notification) => notificationResolution(notification) === "Resolved").length,
    });
    const typeAndDateFiltered = filterNotifications(notifications, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignorePriority: true });
    setPriorityCounts(PRIORITY_LEVELS.reduce((result, priority) => ({
      ...result,
      [priority]: typeAndDateFiltered.filter((notification) => notificationPriority(notification?.type) === priority).length,
    }), {}));
    const visibleNotifications = priorityFilter === "all"
      ? typeAndDateFiltered
      : typeAndDateFiltered.filter((notification) => notificationPriority(notification?.type) === priorityFilter);
    setNotifs([...visibleNotifications].sort((a, b) => notificationCreatedTime(b) - notificationCreatedTime(a)));
  }, [user?.id, tab, typeFilter, priorityFilter, resolutionFilter, dateRange, normalizedRole]);

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
          setPriorityCounts({ urgent: 0, high: 0, normal: 0 });
          setResolutionCounts({ all: 0, unresolved: 0, resolved: 0 });
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [user?.id, fetchCounts, fetchNotifs]);

  const formatWhen = (d) => {
    const date = d ? new Date(d) : null;
    if (!date || Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const markNotifAsRead = async (notifId) => {
    if (!user?.id || !notifId) return;
    setMarkingNotifId(String(notifId));
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${notifId}/read?userId=${user.id}`, { method: "PATCH" });
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
        if (responses.some((response) => !response.ok)) throw new Error("Failed to mark all filtered notifications as read.");
        await Promise.all([fetchCounts(), fetchNotifs()]);
        return;
      }
      const qs = new URLSearchParams({ userId: user.id });
      if (typeFilter) qs.set("type", typeFilter);
      const res = await fetch(`${API_BASE}/api/notifications/read-all?${qs.toString()}`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to mark all notifications as read.");
      await Promise.all([fetchCounts(), fetchNotifs()]);
    } catch (err) {
      setApiError(err?.message || "Failed to mark all notifications as read.");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const typePillClass = (type) => {
    if (type === "BRANCH_KPI_ASSIGNED" || type === "UNIT_KPI_ASSIGNED") return "notif-pill kpi-assigned";
    if (type === "BRANCH_KPI_TARGET_UPDATED" || type === "UNIT_KPI_TARGET_UPDATED") return "notif-pill kpi-updated";
    if (KPI_UNASSIGNED_NOTIF_TYPES.includes(type)) return "notif-pill kpi-unassigned";
    return "notif-pill added";
  };

  const handleManagerSideNav = (key) => {
    navigate(`/${normalizedRole}/${user?.username || username}`, { state: { activeView: key } });
  };

  const openNotif = async (notification) => {
    if (notification?.status === "Unread") await markNotifAsRead(notification._id);
    navigate(`/${normalizedRole}/${username}`, {
      state: { activeView: normalizedRole === "bm" && KPI_UNASSIGNED_NOTIF_TYPES.includes(notification?.type) ? "kpi_assignment" : "orphan_endorsements" },
    });
  };

  const canOpenReadNotification = (notification) => (
    (normalizedRole === "um" && !KPI_NOTIF_TYPES.includes(notification?.type))
    || (normalizedRole === "bm" && KPI_UNASSIGNED_NOTIF_TYPES.includes(notification?.type))
  );

  const NotifRow = ({ n }) => (
    <div className={`notif-row ${n.status === "Unread" ? "unread" : ""}`}>
      <div className="notif-left">
        <div className="notif-topline">
          {n.status === "Unread" ? <span className="notif-dot" aria-label="Unread" /> : null}
          <span className={typePillClass(n.type)}>{n.type}</span>
          <span className={`notif-priority notif-priority--${notificationPriority(n.type)}`}>{notificationPriority(n.type)}</span>
          {normalizedRole === "um" && n.type === "ORPHANS_ENDORSEMENTS" ? <span className={`notif-resolution notif-resolution--${notificationResolution(n).toLowerCase()}`}>{notificationResolution(n)}</span> : null}
          {normalizedRole === "bm" && KPI_UNASSIGNED_NOTIF_TYPES.includes(n.type) ? <span className={`notif-resolution notif-resolution--${notificationResolution(n).toLowerCase()}`}>{notificationResolution(n)}</span> : null}
          <span className="notif-time">{formatWhen(n.createdAt)}</span>
        </div>
        <div className="notif-title">{n.title}</div>
        {String(n.message || "").trim() ? <div className="notif-msg">{n.message}</div> : null}
      </div>

      <div className="notif-right">
        {n.status === "Unread" ? (
          <button
            type="button"
            className="notif-btn secondary"
            onClick={() => markNotifAsRead(n._id)}
            disabled={markingNotifId === String(n._id) || markingAllRead}
          >
            {markingNotifId === String(n._id) ? "Marking..." : "Mark as Read"}
          </button>
        ) : canOpenReadNotification(n) ? (
          <button type="button" className="notif-btn secondary" onClick={() => openNotif(n)}>
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
        onLogoClick={() => navigate(`/${normalizedRole}/${username}`)}
        onLogout={() => logout(navigate, normalizedRole.toUpperCase())}
        onProfileClick={() => navigate(`/${normalizedRole}/${username}/profile`)}
        onNotificationsClick={() => navigate(`/${normalizedRole}/${username}/notifications`)}
      />

      <div className="notifs-body">
        <ManagerSideNav
          roleLabel={normalizedRole.toUpperCase()}
          active=""
          onNavigate={handleManagerSideNav}
          collapsed={sideNavCollapsed}
          onToggle={() => setSideNavCollapsed((current) => !current)}
        />

        <main className="notifs-content">
          <div className="notifs-headerRow">
            <div>
              <h1 className="notifs-title">Notifications</h1>
            </div>
          </div>

          <div className="notifs-toolbar">
            <div className="notifs-tabs" role="tablist" aria-label="Notification status tabs">
              <button type="button" className={`notifs-tab is-unread ${tab === "unread" ? "active" : ""}`} onClick={() => setTab("unread")}>Unread <span className="notifs-badge unread">{counts.unread}</span></button>
              <button type="button" className={`notifs-tab is-read ${tab === "read" ? "active" : ""}`} onClick={() => setTab("read")}>Read <span className="notifs-badge read">{counts.read}</span></button>
            </div>

            <div className="notifs-filter">
              <select className="notifs-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Notification priority filter">
                <option value="all">All Priorities ({availablePriorityLevels.reduce((total, priority) => total + Number(priorityCounts[priority] || 0), 0)})</option>
                {availablePriorityLevels.map((priority) => <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)} ({priorityCounts[priority]})</option>)}
              </select>
              <select className="notifs-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Notification type filter">
                <option value="">All Types</option>
                {managerNotifTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              {["um", "bm"].includes(normalizedRole) ? (
                <select className="notifs-select" value={resolutionFilter} onChange={(e) => setResolutionFilter(e.target.value)} aria-label="Orphan endorsement resolution filter">
                  <option value="all">All Resolutions ({resolutionCounts.all})</option>
                  <option value="Unresolved">Unresolved ({resolutionCounts.unresolved})</option>
                  <option value="Resolved">Resolved ({resolutionCounts.resolved})</option>
                </select>
              ) : null}
              <select className="notifs-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)} aria-label="Notification date range filter">
                <option value="all">All Time</option>
                <option value="today">This Day</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="6m">Last 6 Months</option>
                <option value="12m">Last 12 Months</option>
              </select>
              <button type="button" className="notif-btn ghost" onClick={() => { setTypeFilter(""); setPriorityFilter("all"); setResolutionFilter("all"); setDateRange("all"); }} disabled={!typeFilter && priorityFilter === "all" && resolutionFilter === "all" && dateRange === "all"}>Clear</button>
              <button type="button" className="notif-btn secondary" onClick={markAllAsRead} disabled={tab !== "unread" || markingAllRead || counts.unread <= 0}>{markingAllRead ? "Marking..." : "Mark All as Read"}</button>
            </div>
          </div>

          {loading ? <div className="notifs-empty">Loading notifications...</div> : null}
          {!loading && apiError ? <div className="notifs-empty" style={{ color: "#FFFFFF" }}>{apiError}</div> : null}
          {!loading && !apiError ? (
            <div className="notifs-list">
              {notifs.length === 0 ? (
                <div className="notifs-empty">{tab === "unread" ? "No unread notifications." : "No read notifications."}</div>
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

export default ManagerNotifications;