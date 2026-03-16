import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentTasksProgress.css";

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

  const [metrics, setMetrics] = useState({
    totalTasks: 0,
    openTasks: 0,
    doneTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    onTimeRate: 0,
    typeCounts: [],
    dueSoon: [],
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const API_BASE = "http://localhost:5000";

  useEffect(() => {
    if (!user || user.username !== username) navigate("/", { replace: true });
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Task Progress Dashboard`;
  }, [username]);

  const fetchProgress = useCallback(async (signal) => {
    if (!user?.id) return;
    const res = await fetch(`${API_BASE}/api/tasks/progress?userId=${user.id}`, signal ? { signal } : undefined);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch task progress.");
    setMetrics({
      totalTasks: Number(data?.totalTasks || 0),
      openTasks: Number(data?.openTasks || 0),
      doneTasks: Number(data?.doneTasks || 0),
      overdueTasks: Number(data?.overdueTasks || 0),
      completionRate: Number(data?.completionRate || 0),
      onTimeRate: Number(data?.onTimeRate || 0),
      typeCounts: Array.isArray(data?.typeCounts) ? data.typeCounts : [],
      dueSoon: Array.isArray(data?.dueSoon) ? data.dueSoon : [],
    });
  }, [API_BASE, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchProgress(controller.signal);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server. Is backend running?");
          setMetrics({
            totalTasks: 0,
            openTasks: 0,
            doneTasks: 0,
            overdueTasks: 0,
            completionRate: 0,
            onTimeRate: 0,
            typeCounts: [],
            dueSoon: [],
          });
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [user?.id, fetchProgress]);

  const overdueOpenRate = useMemo(() => {
    if (!metrics.openTasks) return 0;
    return Math.round((metrics.overdueTasks / metrics.openTasks) * 100);
  }, [metrics.openTasks, metrics.overdueTasks]);

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
            <div className="tp-kpi"><span>Total Tasks</span><strong>{metrics.totalTasks}</strong></div>
            <div className="tp-kpi"><span>Open</span><strong>{metrics.openTasks}</strong></div>
            <div className="tp-kpi"><span>Done</span><strong>{metrics.doneTasks}</strong></div>
            <div className="tp-kpi"><span>Overdue</span><strong>{metrics.overdueTasks}</strong></div>
            <div className="tp-kpi"><span>Completion Rate</span><strong>{metrics.completionRate}%</strong></div>
            <div className="tp-kpi"><span>On-Time Completion</span><strong>{metrics.onTimeRate}%</strong></div>
          </div>

          <div className="tp-grid">
            <section className="tp-card">
              <h3>Progress Overview</h3>
              <div className="tp-progressRow"><label>Completion</label><div className="tp-track"><span style={{ width: `${metrics.completionRate}%` }} /></div><b>{metrics.completionRate}%</b></div>
              <div className="tp-progressRow"><label>On-Time Done</label><div className="tp-track alt"><span style={{ width: `${metrics.onTimeRate}%` }} /></div><b>{metrics.onTimeRate}%</b></div>
              <div className="tp-progressRow"><label>Overdue vs Open</label><div className="tp-track warn"><span style={{ width: `${overdueOpenRate}%` }} /></div><b>{overdueOpenRate}%</b></div>
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
                      <time>{t?.dueAt ? new Date(t.dueAt).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</time>
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
