import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentTasksWorkload.css";

function AgentTasksWorkload() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!user || user.username !== username) navigate("/", { replace: true });
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Workload Distribution`;
  }, [username]);

  const fetchTasks = useCallback(async (signal) => {
    if (!user?.id) return;
    const res = await fetch(`http://localhost:5000/api/tasks?userId=${user.id}&includeRefs=1`, signal ? { signal } : undefined);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.message || "Failed to load workload distribution.");
    setTasks(Array.isArray(payload?.tasks) ? payload.tasks : []);
  }, [user?.id]);

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
          setApiError(err?.message || "Cannot connect to server.");
          setTasks([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [fetchTasks, user?.id]);

  const workload = useMemo(() => {
    const now = Date.now();
    const leadTasks = (Array.isArray(tasks) ? tasks : [])
      .filter((t) => Boolean(t?.leadEngagementId))
      .map((t) => {
        const dueMs = new Date(t?.dueAt).getTime();
        const status = String(t?.status || "Open").toLowerCase() === "done" ? "Done" : "Open";
        return {
          ...t,
          status,
          dueMs,
          type: String(t?.type || "CUSTOM").toUpperCase(),
        };
      });

    const total = leadTasks.length;
    const open = leadTasks.filter((t) => t.status === "Open");
    const overdue = open.filter((t) => Number.isFinite(t.dueMs) && t.dueMs < now);
    const done = leadTasks.filter((t) => t.status === "Done");

    const byType = ["APPROACH", "FOLLOW_UP", "UPDATE_CONTACT_INFO", "APPOINTMENT", "PRESENTATION", "CUSTOM"].map((type) => {
      const totalType = leadTasks.filter((t) => t.type === type).length;
      const openType = leadTasks.filter((t) => t.type === type && t.status === "Open").length;
      const doneType = leadTasks.filter((t) => t.type === type && t.status === "Done").length;
      return { type, total: totalType, open: openType, done: doneType };
    });

    const byLead = new Map();
    for (const t of leadTasks) {
      const key = String(t.leadEngagementId);
      const x = byLead.get(key) || {
        leadEngagementId: key,
        leadCode: t.leadCode || "—",
        prospectName: t.prospectName || "—",
        total: 0,
        open: 0,
        overdue: 0,
      };
      x.total += 1;
      if (t.status === "Open") x.open += 1;
      if (t.status === "Open" && Number.isFinite(t.dueMs) && t.dueMs < now) x.overdue += 1;
      byLead.set(key, x);
    }

    const topLeads = [...byLead.values()].sort((a, b) => b.open - a.open || b.total - a.total).slice(0, 8);

    return {
      total,
      open: open.length,
      done: done.length,
      overdue: overdue.length,
      completionRate: total ? Math.round((done.length / total) * 100) : 0,
      byType,
      topLeads,
    };
  }, [tasks]);

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
      case "tasks_workload": navigate(`/agent/${user.username}/tasks/workload`); break;
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;
      case "sales": navigate(`/agent/${user.username}/sales/performance`); break;
      default: break;
    }
  };

  if (!user || user.username !== username) return null;

  return (
    <div className="tw-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="tw-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="tw-content">
          <h1 className="tw-title">Workload Distribution Dashboard</h1>

          <div className="tw-kpis">
            <div className="tw-kpi"><span>Lead Engagement Tasks</span><strong>{workload.total}</strong></div>
            <div className="tw-kpi"><span>Open</span><strong>{workload.open}</strong></div>
            <div className="tw-kpi"><span>Done</span><strong>{workload.done}</strong></div>
            <div className="tw-kpi"><span>Overdue</span><strong>{workload.overdue}</strong></div>
            <div className="tw-kpi"><span>Completion Rate</span><strong>{workload.completionRate}%</strong></div>
          </div>

          <div className="tw-grid">
            <section className="tw-card">
              <h3>Task Type Distribution</h3>
              {workload.byType.map((row) => {
                const pct = workload.total ? Math.round((row.total / workload.total) * 100) : 0;
                return (
                  <div key={row.type} className="tw-row">
                    <div className="tw-rowTop">
                      <span>{row.type}</span>
                      <small>{row.total} tasks ({pct}%)</small>
                    </div>
                    <div className="tw-track"><span style={{ width: `${pct}%` }} /></div>
                    <div className="tw-rowMeta">Open {row.open} • Done {row.done}</div>
                  </div>
                );
              })}
            </section>

            <section className="tw-card tw-wide">
              <h3>Top Lead Engagements by Open Workload</h3>
              {workload.topLeads.length === 0 ? (
                <p className="tw-muted">No lead engagement tasks available yet.</p>
              ) : (
                <div className="tw-tableWrap">
                  <table className="tw-table">
                    <thead>
                      <tr>
                        <th>Lead Code</th>
                        <th>Prospect</th>
                        <th>Total Tasks</th>
                        <th>Open</th>
                        <th>Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workload.topLeads.map((r) => (
                        <tr key={r.leadEngagementId}>
                          <td>{r.leadCode}</td>
                          <td>{r.prospectName}</td>
                          <td>{r.total}</td>
                          <td>{r.open}</td>
                          <td>{r.overdue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {loading && <p className="tw-muted" style={{ marginTop: 10 }}>Loading workload metrics…</p>}
          {!loading && apiError && <p className="tw-muted" style={{ color: "#DA291C", marginTop: 10 }}>{apiError}</p>}
        </main>
      </div>
    </div>
  );
}

export default AgentTasksWorkload;
