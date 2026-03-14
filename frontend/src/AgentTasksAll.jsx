import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentTasksAll.css";

const TASK_TYPES = [
  "APPROACH",
  "FOLLOW_UP",
  "UPDATE_CONTACT_INFO",
  "APPOINTMENT",
  "PRESENTATION",
  "CUSTOM",
];

// Date helpers OUTSIDE component
function startOfDay(dt) {
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Safe time helper
function safeTime(value, fallback = Infinity) {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : fallback;
}

function AgentTasksAll() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  // Tabs: open | overdue | done
  const [tab, setTab] = useState("open");

  // Type filter only
  const [typeFilter, setTypeFilter] = useState("");

  // Backend tasks state
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [tasksRaw, setTasksRaw] = useState([]);

  const API_BASE = "http://localhost:5000";

  // Guard
  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | All Tasks`;
  }, [username]);

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

  const formatDay = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      weekday: "long",
    });
  };

  /**
   * Backend route:
   * GET /api/tasks?userId=<agentUserId>&includeRefs=1
   */
  const fetchTasks = useCallback(
    async (signal) => {
      if (!user?.id) return;

      const res = await fetch(
        `${API_BASE}/api/tasks?userId=${user.id}&includeRefs=1`,
        signal ? { signal } : undefined
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to fetch tasks.");

      const arr = Array.isArray(data?.tasks) ? data.tasks : Array.isArray(data) ? data : [];
      setTasksRaw(arr);
    },
    [API_BASE, user?.id]
  );

  // Load tasks from backend
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    const run = async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchTasks(controller.signal);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server. Is backend running?");
          setTasksRaw([]);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [user?.id, fetchTasks]);

  // Normalize for UI + filtering consistency
  const tasks = useMemo(() => {
    const arr = Array.isArray(tasksRaw) ? tasksRaw : [];

    return arr.map((t) => {
      const normalizedType = String(t?.type || "CUSTOM").toUpperCase().trim();
      const normalizedStatus =
        String(t?.status || "Open").toLowerCase() === "done" ? "Done" : "Open";

      return {
        ...t,
        prospectName: t?.prospectName || "—",
        leadCode: t?.leadCode || "—",
        dueAt: t?.dueAt || null,
        completedAt: t?.completedAt || null,
        wasDelayed: Boolean(t?.wasDelayed),
        createdAt: t?.createdAt || null,
        status: normalizedStatus,
        type: normalizedType,
        title: t?.title || "Untitled task",
        description: t?.description || "",
      };
    });
  }, [tasksRaw]);

  // Tab lists + Type filter
  const tabbed = useMemo(() => {
    const now = Date.now();
    const selectedType = String(typeFilter || "").toUpperCase().trim();

    const base = selectedType
      ? tasks.filter((t) => String(t.type).toUpperCase().trim() === selectedType)
      : tasks.slice();

    const open = base
      .filter((t) => t.status === "Open" && safeTime(t.dueAt) >= now)
      .slice()
      .sort((a, b) => safeTime(a.dueAt) - safeTime(b.dueAt));

    const overdue = base
      .filter((t) => t.status === "Open" && safeTime(t.dueAt, -Infinity) < now)
      .slice()
      .sort((a, b) => safeTime(b.dueAt, -Infinity) - safeTime(a.dueAt, -Infinity));

    const done = base
      .filter((t) => t.status === "Done")
      .slice()
      .sort((a, b) => safeTime(b.completedAt, 0) - safeTime(a.completedAt, 0));

    return { open, overdue, done };
  }, [tasks, typeFilter]);

  // =========================
  // Open tab grouping:
  // Today / Tomorrow / This Week / Due Soon
  //
  // Requested rule:
  // "Due This Week" = day after tomorrow → Saturday only
  // (i.e., < upcoming Sunday 00:00)
  // =========================
  const openGroups = useMemo(() => {
    const now = new Date();

    const todayStart = startOfDay(now).getTime();
    const tomorrowStart = startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000)).getTime();
    const dayAfterTomorrowStart = startOfDay(
      new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    ).getTime();

    // Next Sunday 00:00 boundary (end of Saturday)
    // If today is Sunday, we want NEXT Sunday, not today.
    const nextSunday = new Date(now);
    const day = nextSunday.getDay(); // 0=Sun ... 6=Sat
    const daysUntilNextSunday = ((7 - day) % 7) || 7; // Sunday => 7, Mon => 6, Sat => 1
    nextSunday.setDate(nextSunday.getDate() + daysUntilNextSunday);
    const nextSundayStart = startOfDay(nextSunday).getTime();

    const groups = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      dueSoon: [],
    };

    for (const t of tabbed.open) {
      const due = safeTime(t.dueAt);

      if (due >= todayStart && due < tomorrowStart) {
        groups.today.push(t);
      } else if (due >= tomorrowStart && due < dayAfterTomorrowStart) {
        groups.tomorrow.push(t);
      }
      // Day after tomorrow up to Saturday
      else if (due >= dayAfterTomorrowStart && due < nextSundayStart) {
        groups.thisWeek.push(t);
      }
      // Next Sunday onward (next week and beyond)
      else {
        groups.dueSoon.push(t);
      }
    }

    return groups;
  }, [tabbed.open]);

  const typePillClass = (type) => {
    const x = String(type || "").toUpperCase();
    if (x === "APPROACH" || x === "FOLLOW_UP") return "task-pill urgent";
    if (x === "UPDATE_CONTACT_INFO") return "task-pill info";
    return "task-pill";
  };

  const statusClass = (s) => {
    const x = String(s || "").toLowerCase();
    if (x === "open") return "task-status open";
    if (x === "overdue") return "task-status overdue";
    if (x === "done") return "task-status done";
    return "task-status";
  };

  const openTask = (t) => {
    if (t.prospectId && t.leadId) {
      navigate(`/agent/${username}/prospects/${t.prospectId}/leads/${t.leadId}/engage`);
      return;
    }

    if (t.prospectId) {
      navigate(`/agent/${username}/prospects/${t.prospectId}`);
      return;
    }

    alert("Task has no linked record.");
  };

  const TaskCard = ({ t, uiStatus }) => (
    <div className={`task-card ${uiStatus === "Done" ? "doneCard" : ""}`}>
      <div className="task-top">
        <div className="task-left">
          <div className={typePillClass(t.type)}>{t.type}</div>
          <div className="task-title">{t.title}</div>
        </div>
        <span className={statusClass(uiStatus)}>{uiStatus}</span>
      </div>

      <div className="task-meta">
        <div className="meta-item">
          <div className="meta-label">Prospect</div>
          <div className="meta-value">{t.prospectName}</div>
        </div>

        <div className="meta-item">
          <div className="meta-label">Lead</div>
          <div className="meta-value task-mono">{t.leadCode}</div>
        </div>

        <div className="meta-item">
          <div className="meta-label">Due</div>
          <div className="meta-value">{formatDue(t.dueAt)}</div>
        </div>

        {uiStatus === "Done" ? (
          <div className="meta-item">
            <div className="meta-label">Completed</div>
            <div className="meta-value">{formatDue(t.completedAt)}</div>
          </div>
        ) : null}

        {uiStatus === "Done" ? (
          <div className="meta-item">
            <div className="meta-label">Fulfillment</div>
            <div className="meta-value" style={{ color: t.wasDelayed ? "#B91C1C" : "#166534", fontWeight: 700 }}>
              {t.wasDelayed ? "Delayed" : "On time"}
            </div>
          </div>
        ) : null}
      </div>

      {String(t.description || "").trim() ? <div className="task-desc">{t.description}</div> : null}

      {uiStatus !== "Done" && (
        <div className="task-actions">
          <button type="button" className="tasks-btn secondary" onClick={() => openTask(t)}>
            Open
          </button>
        </div>
      )}
    </div>
  );

  const Group = ({ title, subtitle, count, children }) => (
    <div className="alltasks-group">
      <div className="alltasks-groupHeader">
        <div className="alltasks-groupTitleRow">
          <div className="alltasks-groupTitle">{title}</div>
          <span className="alltasks-count alltasks-count--inline">{count}</span>
        </div>
        {subtitle ? <div className="alltasks-groupSub">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );

  if (!user || user.username !== username) return null;

  return (
    <div className="alltasks-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="alltasks-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="alltasks-content">
          <div className="alltasks-headerRow">
            <div>
              <h1 className="alltasks-title">All Tasks</h1>
            </div>
          </div>

          {loading ? <div className="alltasks-empty2">Loading tasks...</div> : null}

          {!loading && apiError ? (
            <div className="alltasks-empty2" style={{ color: "#FFFFFF" }}>
              {apiError}
            </div>
          ) : null}

          {!loading && !apiError ? (
            <>
              <div className="alltasks-toolbar">
                <div className="alltasks-tabs">
                  <button
                    type="button"
                    className={`alltasks-tab is-open ${tab === "open" ? "active" : ""}`}
                    onClick={() => setTab("open")}
                  >
                    Open <span className="alltasks-badge">{tabbed.open.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`alltasks-tab is-overdue ${tab === "overdue" ? "active" : ""}`}
                    onClick={() => setTab("overdue")}
                  >
                    Overdue <span className="alltasks-badge overdue">{tabbed.overdue.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`alltasks-tab is-done ${tab === "done" ? "active" : ""}`}
                    onClick={() => setTab("done")}
                  >
                    Done <span className="alltasks-badge done">{tabbed.done.length}</span>
                  </button>
                </div>

                <div className="alltasks-filtersInline">
                  <select
                    className="alltasks-select"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="">All Types</option>
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <button type="button" className="tasks-btn tb-clear" onClick={() => setTypeFilter("")}>
                    Clear
                  </button>
                </div>
              </div>

              {tab === "open" ? (
                <div className="alltasks-tabBody">
                  <Group title="Due Today" subtitle={formatDay(new Date())} count={openGroups.today.length}>
                    {openGroups.today.length === 0 ? (
                      <div className="alltasks-empty">No tasks due today.</div>
                    ) : (
                      <div className="alltasks-grid">
                        {openGroups.today.map((t) => (
                          <TaskCard key={t._id} t={t} uiStatus="Open" />
                        ))}
                      </div>
                    )}
                  </Group>

                  <Group
                    title="Due Tomorrow"
                    subtitle={formatDay(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                    count={openGroups.tomorrow.length}
                  >
                    {openGroups.tomorrow.length === 0 ? (
                      <div className="alltasks-empty">No tasks due tomorrow.</div>
                    ) : (
                      <div className="alltasks-grid">
                        {openGroups.tomorrow.map((t) => (
                          <TaskCard key={t._id} t={t} uiStatus="Open" />
                        ))}
                      </div>
                    )}
                  </Group>

                  {/* Subtitle updated to match new behavior */}
                  <Group
                    title="Due This Week"
                    subtitle="Day after tomorrow – Sat"
                    count={openGroups.thisWeek.length}
                  >
                    {openGroups.thisWeek.length === 0 ? (
                      <div className="alltasks-empty">No tasks due this week.</div>
                    ) : (
                      <div className="alltasks-grid">
                        {openGroups.thisWeek.map((t) => (
                          <TaskCard key={t._id} t={t} uiStatus="Open" />
                        ))}
                      </div>
                    )}
                  </Group>

                  <Group title="Due Soon" subtitle="Sunday onward" count={openGroups.dueSoon.length}>
                    {openGroups.dueSoon.length === 0 ? (
                      <div className="alltasks-empty">No tasks due soon.</div>
                    ) : (
                      <div className="alltasks-grid">
                        {openGroups.dueSoon.map((t) => (
                          <TaskCard key={t._id} t={t} uiStatus="Open" />
                        ))}
                      </div>
                    )}
                  </Group>
                </div>
              ) : null}

              {tab === "overdue" ? (
                <div className="alltasks-tabBody">
                  {tabbed.overdue.length === 0 ? (
                    <div className="alltasks-empty2">No overdue tasks.</div>
                  ) : (
                    <div className="alltasks-grid">
                      {tabbed.overdue.map((t) => (
                        <TaskCard key={t._id} t={t} uiStatus="Overdue" />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {tab === "done" ? (
                <div className="alltasks-tabBody">
                  {tabbed.done.length === 0 ? (
                    <div className="alltasks-empty2">No completed tasks.</div>
                  ) : (
                    <div className="alltasks-grid">
                      {tabbed.done.map((t) => (
                        <TaskCard key={t._id} t={t} uiStatus="Done" />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default AgentTasksAll;
