import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import ManagerSideNav from "./components/ManagerSideNav";
import { logout } from "./utils/logout";
import "./ManagerNotifications.css";

const API_BASE = "http://localhost:5000";
const BRANCH_KPI_NOTIF_TYPES = ["BRANCH_KPI_ASSIGNED", "BRANCH_KPI_TARGET_UPDATED", "BRANCH_KPI_UNASSIGNED"];
const MANAGER_NOTIF_TYPES = ["ORPHANS_ENDORSEMENTS", ...BRANCH_KPI_NOTIF_TYPES];

function ManagerNotifications({ roleType }) {
  const navigate = useNavigate();
  const { username } = useParams();
  const [tab, setTab] = useState("unread");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [notifs, setNotifs] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, read: 0 });
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingNotifId, setMarkingNotifId] = useState("");
  const [sideNavCollapsed, setSideNavCollapsed] = useState(false);

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("managerPortalUser") || "null"); } catch { return null; }
  }, []);
  const normalizedRole = String(roleType || user?.role || "UM").trim().toLowerCase();

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

  useEffect(() => { document.title = `${username} | Notifications`; }, [username]);

  const fetchCounts = useCallback(async (signal) => {
    if (!user?.id) return;
    const qs = new URLSearchParams({ userId: user.id });
    if (typeFilter) qs.set("type", typeFilter);
    const res = await fetch(`${API_BASE}/api/notifications/counts?${qs.toString()}`, signal ? { signal } : undefined);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch notification counts.");
    setCounts({ unread: Number(data?.unread || 0), read: Number(data?.read || 0) });
  }, [user?.id, typeFilter]);

  const fetchNotifs = useCallback(async (signal) => {
    if (!user?.id) return;
    const qs = new URLSearchParams({ userId: user.id, status: tab === "read" ? "Read" : "Unread", includeRefs: "1" });
    if (typeFilter) qs.set("type", typeFilter);
    const res = await fetch(`${API_BASE}/api/notifications?${qs.toString()}`, signal ? { signal } : undefined);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications.");
    setNotifs(Array.isArray(data?.notifications) ? data.notifications : []);
  }, [user?.id, tab, typeFilter]);

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

  const typePillClass = (type) => BRANCH_KPI_NOTIF_TYPES.includes(type) ? "notif-pill kpi" : "notif-pill added";

  const handleManagerSideNav = (key) => {
    navigate(`/${normalizedRole}/${user?.username || username}`, { state: { activeView: key } });
  };

  const openNotif = async (notification) => {
    if (notification?.status === "Unread") await markNotifAsRead(notification._id);
    const activeView = BRANCH_KPI_NOTIF_TYPES.includes(notification?.type) ? "kpi_progress" : "orphan_endorsements";
    navigate(`/${normalizedRole}/${username}`, { state: { activeView } });
  };

  const canOpenReadNotification = (notification) => (
    (BRANCH_KPI_NOTIF_TYPES.includes(notification?.type) && normalizedRole === "bm")
    || (!BRANCH_KPI_NOTIF_TYPES.includes(notification?.type) && normalizedRole === "um")
  );

  const NotifRow = ({ n }) => (
    <div className={`notif-row ${n.status === "Unread" ? "unread" : ""}`}>
      <div className="notif-left">
        <div className="notif-topline">
          {n.status === "Unread" ? <span className="notif-dot" aria-label="Unread" /> : null}
          <span className={typePillClass(n.type)}>{n.type}</span>
          <span className="notif-time">{formatWhen(n.updatedAt || n.createdAt)}</span>
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
              <select className="notifs-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Notification type filter">
                <option value="">All Types</option>
                {MANAGER_NOTIF_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <button type="button" className="notif-btn ghost" onClick={() => setTypeFilter("")} disabled={!typeFilter}>Clear</button>
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
