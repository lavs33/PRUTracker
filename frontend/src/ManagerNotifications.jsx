import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import { logout } from "./utils/logout";
import "./ManagerNotifications.css";

const API_BASE = "http://localhost:5000";
const MANAGER_NOTIF_TYPES = ["ORPHAN_ENDORSEMENT"];

function ManagerNotifications({ roleType }) {
  const navigate = useNavigate();
  const { username } = useParams();
  const normalizedRole = String(roleType || "").trim().toLowerCase();
  const [tab, setTab] = useState("unread");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [notifs, setNotifs] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, read: 0 });
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingNotifId, setMarkingNotifId] = useState("");

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  }, []);

  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

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

  const typePillClass = () => "notif-pill added";
  const openNotif = async (notification) => {
    if (notification?.status === "Unread") await markNotifAsRead(notification._id);
    navigate(`/${normalizedRole}/${username}`);
  };

  return (
    <div className="notifs-page">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/${normalizedRole}/${username}`)}
        onLogout={logout}
        onProfileClick={() => navigate(`/${normalizedRole}/${username}/profile`)}
        onNotificationsClick={() => navigate(`/${normalizedRole}/${username}/notifications`)}
      />

      <main className="notifs-shell">
        <section className="notifs-card">
          <div className="notifs-head">
            <div>
              <p className="notifs-eyebrow">UM Portal</p>
              <h1 className="notifs-title">Notifications</h1>
              <p className="notifs-subtitle">Review orphan endorsement alerts for your unit.</p>
            </div>
            <div className="notifs-tabs" role="tablist" aria-label="Notification status tabs">
              <button type="button" className={`notifs-tab is-unread ${tab === "unread" ? "active" : ""}`} onClick={() => setTab("unread")}>Unread <span className="notifs-badge unread">{counts.unread}</span></button>
              <button type="button" className={`notifs-tab ${tab === "read" ? "active" : ""}`} onClick={() => setTab("read")}>Read <span className="notifs-badge">{counts.read}</span></button>
            </div>
          </div>

          <div className="notifs-toolbar">
            <label>
              <span>Type</span>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {MANAGER_NOTIF_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <button type="button" className="notifs-mark-all" onClick={markAllAsRead} disabled={tab !== "unread" || markingAllRead || counts.unread <= 0}>{markingAllRead ? "Marking..." : "Mark all as read"}</button>
          </div>

          {apiError && <div className="notifs-error">{apiError}</div>}
          {loading ? <div className="notifs-empty">Loading notifications...</div> : null}
          {!loading && notifs.length > 0 && (
            <div className="notifs-list">
              {notifs.map((n) => (
                <article key={n._id} className={`notif-row ${n.status === "Unread" ? "unread" : ""}`}>
                  <button type="button" className="notif-main" onClick={() => openNotif(n)}>
                    <span className={typePillClass(n.type)}>{n.type}</span>
                    <strong>{n.title}</strong>
                    <p>{n.message || "No details provided."}</p>
                    <small>{formatWhen(n.createdAt)}</small>
                  </button>
                  {tab === "unread" ? <button type="button" className="notif-read-btn" onClick={() => markNotifAsRead(n._id)} disabled={markingNotifId === n._id}>{markingNotifId === n._id ? "Marking..." : "Mark as read"}</button> : null}
                </article>
              ))}
            </div>
          )}
          {!loading && !notifs.length && <div className="notifs-empty">{tab === "unread" ? "No unread notifications." : "No read notifications."}</div>}
        </section>
      </main>
    </div>
  );
}

export default ManagerNotifications;