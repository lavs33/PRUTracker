import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentNotifications.css";

const NOTIF_TYPES = ["TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED"];

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

  // list state
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [notifs, setNotifs] = useState([]);

  // counts state (always numeric)
  const [counts, setCounts] = useState({ unread: 0, read: 0 });

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
      case "clients_all_prospects":
        navigate(`/agent/${user.username}/prospects`);
        break;
      case "clients_all_policyholders":
        navigate(`/agent/${user.username}/policyholders`);
        break;

      case "tasks":
        navigate(`/agent/${user.username}/tasks`);
        break;
      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;

      // notifications route exists for bell
      case "notifications":
        navigate(`/agent/${user.username}/notifications`);
        break;

      case "sales":
        alert("Sales module coming soon");
        break;

      default:
        break;
    }
  };

  // Fetch counts from backend (Unread + Read)
  const fetchCounts = useCallback(
    async (signal) => {
      if (!user?.id) return;

      const res = await fetch(
        `${API_BASE}/api/notifications/counts?userId=${user.id}&entityType=Task`,
        signal ? { signal } : undefined
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to fetch notification counts.");

      setCounts({
        unread: Number(data?.unread || 0),
        read: Number(data?.read || 0),
      });
    },
    [API_BASE, user?.id]
  );

  // Fetch notifications list for current tab + filters
  const fetchNotifs = useCallback(
    async (signal) => {
      if (!user?.id) return;

      const status = tab === "read" ? "Read" : "Unread";

      const qs = new URLSearchParams({
        userId: user.id,
        status,
        entityType: "Task",
        includeRefs: "1",
      });

      if (typeFilter) qs.set("type", typeFilter);

      const res = await fetch(
        `${API_BASE}/api/notifications?${qs.toString()}`,
        signal ? { signal } : undefined
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications.");

      const arr = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifs(arr);
    },
    [API_BASE, user?.id, tab, typeFilter]
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
    return "notif-pill";
  };

  // Mark read ONLY on click Open 
  const openNotif = async (n) => {
    if (!user?.id) return;

    try {
      if (n.status === "Unread") {
        await fetch(`${API_BASE}/api/notifications/${n._id}/read?userId=${user.id}`, {
          method: "PATCH",
        });

        // refresh counts + list after marking read
        await Promise.all([fetchCounts(), fetchNotifs()]);
      }
    } catch {
      // ignore mark-read errors; still navigate
    }

    if (n.prospectId && n.leadId) {
      navigate(`/agent/${username}/prospects/${n.prospectId}/leads/${n.leadId}/engage`);
      return;
    }

    if (n.prospectId) {
      navigate(`/agent/${username}/prospects/${n.prospectId}`);
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
          <span className="notif-time">{formatWhen(n.createdAt)}</span>
        </div>

        <div className="notif-title">{n.title}</div>
        {String(n.message || "").trim() ? <div className="notif-msg">{n.message}</div> : null}
      </div>

      <div className="notif-right">
        <button type="button" className="notif-btn secondary" onClick={() => openNotif(n)}>
          Open
        </button>
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

              <button type="button" className="notif-btn ghost" onClick={() => setTypeFilter("")}>
                Clear
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