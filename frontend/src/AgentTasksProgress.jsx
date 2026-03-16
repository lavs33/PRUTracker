import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentTasksProgress.css";

const TASK_TYPES = ["APPROACH", "FOLLOW_UP", "UPDATE_CONTACT_INFO", "APPOINTMENT", "PRESENTATION", "CUSTOM"];

function AgentTasksProgress() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [tasksRaw, setTasksRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const API_BASE = "http://localhost:5000";

  useEffect(() => {
    if (!user || user.username !== username) navigate("/", { replace: true });
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Task Progress Dashboard`;
  }, [username]);

  const fetchTasks = useCallback(async (signal) => {
    if (!user?.id) return;
    const res = await fetch(`${API_BASE}/api/tasks?userId=${user.id}&includeRefs=1`, signal ? { signal } : undefined);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch tasks.");
    const arr = Array.isArray(data?.tasks) ? data.tasks : Array.isArray(data) ? data : [];
    setTasksRaw(arr);
  }, [API_BASE, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    (async () => {
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
    })();
    return () => controller.abort();
  }, [user?.id, fetchTasks]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const tasks = (Array.isArray(tasksRaw) ? tasksRaw : []).map((t) => ({
      ...t,
      status: String(t?.status || "Open").toLowerCase() === "done" ? "Done" : "Open",
      type: String(t?.type || "CUSTOM").toUpperCase().trim(),
      dueAtMs: new Date(t?.dueAt).getTime(),
      completedAtMs: new Date(t?.completedAt).getTime(),
      createdAtMs: new Date(t?.createdAt).getTime(),
      wasDelayed: Boolean(t?.wasDelayed),
    }));

    const open = tasks.filter((t) => t.status === "Open");
    const done = tasks.filter((t) => t.status === "Done");
    const overdue = open.filter((t) => Number.isFinite(t.dueAtMs) && t.dueAtMs < now);
    const dueSoon = open.filter((t) => Number.isFinite(t.dueAtMs) && t.dueAtMs >= now).sort((a, b) => a.dueAtMs - b.dueAtMs).slice(0, 5);

    const delayedDone = done.filter((t) => t.wasDelayed);
    const onTimeDone = done.filter((t) => !t.wasDelayed);

    const typeCounts = TASK_TYPES.map((type) => ({
      type,
      total: tasks.filter((t) => t.type === type).length,
      done: tasks.filter((t) => t.type === type && t.status === "Done").length,
    }));

    const completionRate = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
    const onTimeRate = done.length ? Math.round((onTimeDone.length / done.length) * 100) : 0;

    return {
      tasks,
      open,
      done,
      overdue,
      dueSoon,
      delayedDone,
      onTimeDone,
      typeCounts,
      completionRate,
      onTimeRate,
    };
  }, [tasksRaw]);

  const handleSideNav = (key) => {
    if (!user) return navigate("/");
    switch (key) {
      case "clients": navigate(`/agent/${user.username}/clients`); break;
      case "clients_relationship": navigate(`/agent/${user.username}/clients/relationship`); break;
      case "clients_all_prospects": navigate(`/agent/${user.username}/prospects`); break;
      case "clients_all_policyholders": navigate(`/agent/${user.username}/policyholders`); break;
      case "tasks": navigate(`/agent/${user.username}/tasks`); break;
      case "tasks_progress": navigate(`/agent/${user.username}/tasks/progress`); break;
      case "tasks_all": navigate(`/agent/${user.username}/tasks/all`); break;
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;
      case "sales": navigate(`/agent/${user.username}/sales/performance`); break;
      default: break;
    }
  };

  if (!user || user.username !== username) return null;

  return (
    <div className="tp-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="tp-body">
        <SideNav onNavigate={handleSideNav} />
        <main className="tp-content">
          <h1 className="tp-title">Task Progress Dashboard</h1>

          <div className="tp-kpis">
            <div className="tp-kpi"><span>Total Tasks</span><strong>{metrics.tasks.length}</strong></div>
            <div className="tp-kpi"><span>Open</span><strong>{metrics.open.length}</strong></div>
            <div className="tp-kpi"><span>Done</span><strong>{metrics.done.length}</strong></div>
            <div className="tp-kpi"><span>Overdue</span><strong>{metrics.overdue.length}</strong></div>
            <div className="tp-kpi"><span>Completion Rate</span><strong>{metrics.completionRate}%</strong></div>
            <div className="tp-kpi"><span>On-Time Completion</span><strong>{metrics.onTimeRate}%</strong></div>
          </div>

          <div className="tp-grid">
            <section className="tp-card">
              <h3>Progress Overview</h3>
              <div className="tp-progressRow"><label>Completion</label><div className="tp-track"><span style={{ width: `${metrics.completionRate}%` }} /></div><b>{metrics.completionRate}%</b></div>
              <div className="tp-progressRow"><label>On-Time Done</label><div className="tp-track alt"><span style={{ width: `${metrics.onTimeRate}%` }} /></div><b>{metrics.onTimeRate}%</b></div>
              <div className="tp-progressRow"><label>Overdue vs Open</label><div className="tp-track warn"><span style={{ width: `${metrics.open.length ? Math.round((metrics.overdue.length / metrics.open.length) * 100) : 0}%` }} /></div><b>{metrics.open.length ? Math.round((metrics.overdue.length / metrics.open.length) * 100) : 0}%</b></div>
            </section>

            <section className="tp-card">
              <h3>Task Type Performance</h3>
              {metrics.typeCounts.map((t) => {
                const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
                return (
                  <div key={t.type} className="tp-typeRow">
                    <div className="tp-typeMeta"><span>{t.type}</span><small>{t.done}/{t.total}</small></div>
                    <div className="tp-track"><span style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </section>

            <section className="tp-card tp-wide">
              <h3>Due Soon (Top 5)</h3>
              {metrics.dueSoon.length === 0 ? (
                <p className="tp-muted">No upcoming open tasks.</p>
              ) : (
                <div className="tp-list">
                  {metrics.dueSoon.map((t) => (
                    <div key={t._id} className="tp-item">
                      <div><strong>{t.title || "Untitled task"}</strong><span>{t.type}</span></div>
                      <time>{Number.isFinite(t.dueAtMs) ? new Date(t.dueAtMs).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</time>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {loading && <p className="tp-muted" style={{ marginTop: 10 }}>Loading task metrics…</p>}
          {!loading && apiError && <p className="tp-muted" style={{ color: "#DA291C", marginTop: 10 }}>{apiError}</p>}
        </main>
      </div>
    </div>
  );
}

export default AgentTasksProgress;
