// AgentTasks.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentTasks.css";

function AgentTasks() {
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

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [dueTodayTop5, setDueTodayTop5] = useState([]);
  const [recentlyAddedTop5, setRecentlyAddedTop5] = useState([]);

  useEffect(() => {
    document.title = `${username} | Tasks`;
  }, [username]);

  // Guard
  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

  const handleSideNav = (key) => {
    if (!user) return navigate("/");

    switch (key) {
      // CLIENTS
      case "clients":
        navigate(`/agent/${user.username}/clients`);
        break;

      case "clients_all_prospects":
        navigate(`/agent/${user.username}/prospects`);
        break;

      case "clients_all_policyholders":
        navigate(`/agent/${user.username}/policyholders`);
        break;

      // TASKS
      case "tasks":
        navigate(`/agent/${user.username}/tasks`);
        break;

      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;

      // SALES
      case "sales":
        alert("Sales module coming soon");
        break;

      default:
        break;
    }
  };

  const formatDue = (d) => {
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

  // ✅ UI-only status: Open | Overdue | Done
  const normalizeTasks = (arr) => {
    const list = Array.isArray(arr) ? arr : [];
    const now = Date.now();

    return list.map((t) => {
      const normalizedStatus =
        String(t?.status || "Open").toLowerCase() === "done" ? "Done" : "Open";

      const dueMs = new Date(t?.dueAt).getTime();
      const isOverdue =
        normalizedStatus === "Open" && Number.isFinite(dueMs) && dueMs < now;

      const uiStatus = normalizedStatus === "Done" ? "Done" : isOverdue ? "Overdue" : "Open";

      return {
        ...t,
        prospectName: t?.prospectName || "—",
        leadCode: t?.leadCode || "—",
        dueAt: t?.dueAt || null,
        createdAt: t?.createdAt || null,
        wasDelayed: Boolean(t?.wasDelayed),

        status: normalizedStatus, // DB status (Open/Done)
        uiStatus, // ✅ UI status (Open/Overdue/Done)

        type: String(t?.type || "CUSTOM").toUpperCase().trim(),
        title: t?.title || "Untitled task",
        description: t?.description || "",
        leadId: t?.leadId || null, // ✅ comes from backend includeRefs=1 for engagement tasks
      };
    });
  };

  const fetchSummary = useCallback(
    async (signal) => {
      if (!user?.id) return;

      const res = await fetch(
        `${API_BASE}/api/tasks/summary?userId=${user.id}&includeRefs=1`,
        signal ? { signal } : undefined
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to fetch task summary.");

      setDueTodayTop5(normalizeTasks(data?.dueTodayTop5));
      setRecentlyAddedTop5(normalizeTasks(data?.recentlyAddedTop5));
    },
    [API_BASE, user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchSummary(controller.signal);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server. Is backend running?");
          setDueTodayTop5([]);
          setRecentlyAddedTop5([]);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [user?.id, fetchSummary]);

  const statusClass = (uiStatus) => {
    const s = String(uiStatus || "").toLowerCase();
    if (s === "open") return "task-status open";
    if (s === "overdue") return "task-status overdue";
    if (s === "done") return "task-status done";
    return "task-status";
  };

  const typePillClass = (type) => {
    const t = String(type || "").toUpperCase();
    if (t === "APPROACH" || t === "FOLLOW_UP") return "task-pill urgent";
    if (t === "UPDATE_CONTACT_INFO") return "task-pill info";
    return "task-pill";
  };

  const openTask = (t) => {
    // ✅ Engagement-based tasks: leadId exists (from backend includeRefs=1)
    if (t.prospectId && t.leadId) {
      navigate(`/agent/${username}/prospects/${t.prospectId}/leads/${t.leadId}/engage`);
      return;
    }

    // ✅ Prospect-only tasks: no leadId needed
    if (t.prospectId) {
      navigate(`/agent/${username}/prospects/${t.prospectId}`);
      return;
    }

    alert("Task has no linked record.");
  };

  const viewAllTasks = () => {
    // your button label says open, but the page shows open/overdue/done.
    // keep route same for now.
    navigate(`/agent/${username}/tasks/all`);
  };

  if (!user || user.username !== username) return null;

  const TaskCard = ({ t }) => (
    <div className="task-card">
      <div className="task-top">
        <div>
          <div className={typePillClass(t.type)}>{t.type}</div>
          <div className="task-name">{t.title}</div>
        </div>

        {/* ✅ show UI status (Open/Overdue/Done) */}
        <span className={statusClass(t.uiStatus)}>{t.uiStatus}</span>
      </div>

      <div className="task-meta">
        <div>
          <div className="task-label">Prospect</div>
          <div className="task-value">{t.prospectName}</div>
        </div>
        <div>
          <div className="task-label">Lead</div>
          <div className="task-value mono">{t.leadCode}</div>
        </div>
        <div>
          <div className="task-label">Due</div>
          <div className="task-value">{formatDue(t.dueAt)}</div>
        </div>
      </div>

      {t.uiStatus === "Done" ? (
        <div className="task-meta" style={{ marginTop: 8 }}>
          <div>
            <div className="task-label">Fulfillment</div>
            <div className="task-value" style={{ color: t.wasDelayed ? "#B91C1C" : "#166534", fontWeight: 700 }}>
              {t.wasDelayed ? "Delayed" : "On time"}
            </div>
          </div>
        </div>
      ) : null}

      {String(t.description || "").trim() ? <div className="task-note">{t.description}</div> : null}

      <div className="task-actions">
        <button type="button" className="tasks-btn secondary" onClick={() => openTask(t)}>
          Open
        </button>
      </div>
    </div>
  );

  return (
    <div className="tasks-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="tasks-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="tasks-content">
          <div className="tasks-headerRow">
            <div>
              <h1 className="tasks-title">Task Visibility &amp; Management</h1>
            </div>

            <div className="tasks-actions">
              <button type="button" className="tasks-btn primary" onClick={viewAllTasks}>
                View all open tasks
              </button>
            </div>
          </div>

          {/* ✅ Loading / Error */}
          {loading ? <div className="tasks-empty">Loading tasks...</div> : null}

          {!loading && apiError ? (
            <div className="tasks-empty" style={{ color: "#FFFFFF" }}>
              {apiError}
            </div>
          ) : null}

          {!loading && !apiError ? (
            <>
              {/* ✅ DUE TODAY (Top 5)
                  NOTE: backend should already exclude tasks whose due time has passed.
                  But even if it doesn’t, UI status will still show Overdue correctly.
              */}
              <section className="tasks-section">
                <div className="tasks-sectionHeader">
                  <h2>Due Today</h2>
                  <span className="tasks-count">{dueTodayTop5.length}</span>
                </div>

                {dueTodayTop5.length === 0 ? (
                  <div className="tasks-empty">No tasks due today.</div>
                ) : (
                  <div className="tasks-grid">
                    {dueTodayTop5.map((t) => (
                      <TaskCard key={t._id} t={t} />
                    ))}
                  </div>
                )}
              </section>

              {/* ✅ RECENTLY ADDED (Top 5) */}
              <section className="tasks-section">
                <div className="tasks-sectionHeader">
                  <h2>Recently Added</h2>
                  <span className="tasks-count">{recentlyAddedTop5.length}</span>
                </div>

                {recentlyAddedTop5.length === 0 ? (
                  <div className="tasks-empty">No new tasks.</div>
                ) : (
                  <div className="tasks-grid">
                    {recentlyAddedTop5.map((t) => (
                      <TaskCard key={t._id} t={t} />
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default AgentTasks;
