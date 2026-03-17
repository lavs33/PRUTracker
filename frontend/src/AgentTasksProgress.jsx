import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentTasksProgress.css";

const TASK_TYPES = ["APPROACH", "FOLLOW_UP", "UPDATE_CONTACT_INFO", "APPOINTMENT", "PRESENTATION"];

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

  const [datePreset, setDatePreset] = useState("30d");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedTypeDrill, setSelectedTypeDrill] = useState("");

  const API_BASE = "http://localhost:5000";

  useEffect(() => {
    if (!user || user.username !== username) navigate("/", { replace: true });
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Task Progress Dashboard`;
  }, [username]);

  const fetchTasks = useCallback(
    async (signal) => {
      if (!user?.id) return;
      const res = await fetch(
        `${API_BASE}/api/tasks?userId=${user.id}&includeRefs=1`,
        signal ? { signal } : undefined
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch task data.");
      setTasksRaw(Array.isArray(data?.tasks) ? data.tasks : []);
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

  const normalizedTasks = useMemo(() => {
    const now = Date.now();
    return (Array.isArray(tasksRaw) ? tasksRaw : []).map((t) => {
      const dueAtMs = new Date(t?.dueAt).getTime();
      const status = String(t?.status || "Open").toLowerCase() === "done" ? "Done" : "Open";
      const isOverdue = status === "Open" && Number.isFinite(dueAtMs) && dueAtMs < now;
      return {
        ...t,
        type: String(t?.type || "UPDATE_CONTACT_INFO").toUpperCase().trim(),
        status,
        dueAtMs,
        isOverdue,
        wasDelayed: Boolean(t?.wasDelayed),
      };
    });
  }, [tasksRaw]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    const fromMs = (() => {
      if (datePreset === "7d") return now - 7 * 24 * 60 * 60 * 1000;
      if (datePreset === "30d") return now - 30 * 24 * 60 * 60 * 1000;
      if (datePreset === "90d") return now - 90 * 24 * 60 * 60 * 1000;
      return null;
    })();

    return normalizedTasks.filter((t) => {
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;

      if (statusFilter === "OPEN" && t.status !== "Open") return false;
      if (statusFilter === "DONE" && t.status !== "Done") return false;
      if (statusFilter === "OVERDUE_OPEN" && !t.isOverdue) return false;
      if (statusFilter === "DELAYED_DONE" && !(t.status === "Done" && t.wasDelayed)) return false;

      if (fromMs != null) {
        const refMs = Number.isFinite(t.dueAtMs) ? t.dueAtMs : new Date(t?.createdAt).getTime();
        if (!Number.isFinite(refMs) || refMs < fromMs) return false;
      }

      return true;
    });
  }, [normalizedTasks, datePreset, statusFilter, typeFilter]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const total = filteredTasks.length;
    const open = filteredTasks.filter((t) => t.status === "Open");
    const done = filteredTasks.filter((t) => t.status === "Done");
    const overdue = open.filter((t) => Number.isFinite(t.dueAtMs) && t.dueAtMs < now);
    const delayedDone = done.filter((t) => t.wasDelayed);
    const onTimeDone = done.filter((t) => !t.wasDelayed);

    const dueSoon = open
      .filter((t) => Number.isFinite(t.dueAtMs) && t.dueAtMs >= now)
      .sort((a, b) => a.dueAtMs - b.dueAtMs)
      .slice(0, 5);

    const typeCounts = TASK_TYPES.map((type) => {
      const rows = filteredTasks.filter((t) => t.type === type);
      const doneCount = rows.filter((t) => t.status === "Done").length;
      return { type, total: rows.length, done: doneCount };
    });

    const leadMap = new Map();
    for (const t of filteredTasks) {
      if (!t?.leadEngagementId) continue;
      const key = String(t.leadEngagementId);
      const row = leadMap.get(key) || {
        leadEngagementId: key,
        leadCode: t?.leadCode || "—",
        prospectName: t?.prospectName || "—",
        total: 0,
        open: 0,
        overdue: 0,
      };
      row.total += 1;
      if (t.status === "Open") row.open += 1;
      if (t.isOverdue) row.overdue += 1;
      leadMap.set(key, row);
    }

    return {
      totalTasks: total,
      openTasks: open.length,
      doneTasks: done.length,
      overdueTasks: overdue.length,
      delayedDoneTasks: delayedDone.length,
      completionRate: total ? Math.round((done.length / total) * 100) : 0,
      onTimeRate: done.length ? Math.round((onTimeDone.length / done.length) * 100) : 0,
      lateCompletionRate: done.length ? Math.round((delayedDone.length / done.length) * 100) : 0,
      overdueOpenRate: open.length ? Math.round((overdue.length / open.length) * 100) : 0,
      dueSoon,
      typeCounts,
      leadWorkloadRows: [...leadMap.values()].sort((a, b) => b.open - a.open || b.total - a.total).slice(0, 8),
    };
  }, [filteredTasks]);

  const drillTasks = useMemo(() => {
    if (!selectedTypeDrill) return [];
    return filteredTasks
      .filter((t) => t.type === selectedTypeDrill)
      .sort((a, b) => (Number.isFinite(a.dueAtMs) ? a.dueAtMs : Infinity) - (Number.isFinite(b.dueAtMs) ? b.dueAtMs : Infinity))
      .slice(0, 12);
  }, [filteredTasks, selectedTypeDrill]);

  const generateCsvReport = () => {
    const headers = [
      "title",
      "type",
      "status",
      "overdueOpen",
      "wasDelayed",
      "dueAt",
      "completedAt",
      "leadCode",
      "prospectName",
    ];

    const rows = filteredTasks.map((t) => [
      JSON.stringify(t?.title || "Untitled task"),
      t.type,
      t.status,
      t.isOverdue ? "Yes" : "No",
      t.wasDelayed ? "Yes" : "No",
      t?.dueAt || "",
      t?.completedAt || "",
      JSON.stringify(t?.leadCode || "—"),
      JSON.stringify(t?.prospectName || "—"),
    ]);

    const metaRows = [
      ["reportGeneratedAt", new Date().toISOString()],
      ["datePreset", datePreset],
      ["statusFilter", statusFilter],
      ["typeFilter", typeFilter],
      ["totalTasks", String(metrics.totalTasks)],
      ["openTasks", String(metrics.openTasks)],
      ["doneTasks", String(metrics.doneTasks)],
      ["overdueTasks", String(metrics.overdueTasks)],
      ["completionRate", `${metrics.completionRate}%`],
      ["onTimeRate", `${metrics.onTimeRate}%`],
      ["lateCompletionRate", `${metrics.lateCompletionRate}%`],
      [],
    ];

    const csv = [
      ...metaRows.map((r) => r.join(",")),
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-progress-report-${username}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
          <div className="tp-headRow">
            <h1 className="tp-title">Task Progress & Workload Dashboard</h1>
            <button className="tp-reportBtn" onClick={generateCsvReport}>Generate Report (CSV)</button>
          </div>

          <section className="tp-card tp-filterBar">
            <div className="tp-filterGroup">
              <label>Date Range</label>
              <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            <div className="tp-filterGroup">
              <label>Status Slice</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All</option>
                <option value="OPEN">Open</option>
                <option value="DONE">Done</option>
                <option value="OVERDUE_OPEN">Overdue Open</option>
                <option value="DELAYED_DONE">Delayed Done</option>
              </select>
            </div>

            <div className="tp-filterGroup">
              <label>Task Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="ALL">All types</option>
                {TASK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div className="tp-filterChips">
              <button className={`tp-chip ${statusFilter === "OVERDUE_OPEN" ? "active" : ""}`} onClick={() => setStatusFilter("OVERDUE_OPEN")}>Needs Attention</button>
              <button className={`tp-chip ${datePreset === "7d" ? "active" : ""}`} onClick={() => setDatePreset("7d")}>Weekly Review</button>
              <button className="tp-chip" onClick={() => { setDatePreset("30d"); setStatusFilter("ALL"); setTypeFilter("ALL"); setSelectedTypeDrill(""); }}>Reset</button>
            </div>
          </section>

          <div className="tp-kpis">
            <div className="tp-kpi"><span>Total Tasks</span><strong>{metrics.totalTasks}</strong></div>
            <div className="tp-kpi"><span>Open</span><strong>{metrics.openTasks}</strong></div>
            <div className="tp-kpi"><span>Done</span><strong>{metrics.doneTasks}</strong></div>
            <div className="tp-kpi"><span>Overdue</span><strong>{metrics.overdueTasks}</strong></div>
            <div className="tp-kpi"><span>Completion Rate</span><strong>{metrics.completionRate}%</strong></div>
            <div className="tp-kpi"><span>On-Time Completion</span><strong>{metrics.onTimeRate}%</strong></div>
            <div className="tp-kpi"><span>Late Completion Rate</span><strong>{metrics.lateCompletionRate}%</strong></div>
          </div>

          <div className="tp-grid">
            <section className="tp-card">
              <h3>Progress Overview</h3>
              <div className="tp-progressRow"><label>Completion</label><div className="tp-track"><span style={{ width: `${metrics.completionRate}%` }} /></div><b>{metrics.completionRate}%</b></div>
              <div className="tp-progressRow"><label>On-Time Done</label><div className="tp-track alt"><span style={{ width: `${metrics.onTimeRate}%` }} /></div><b>{metrics.onTimeRate}%</b></div>
              <div className="tp-progressRow"><label>Overdue Open Tasks</label><div className="tp-track warn"><span style={{ width: `${metrics.overdueOpenRate}%` }} /></div><b>{metrics.overdueOpenRate}%</b></div>
              <div className="tp-progressRow"><label>Late Completion Rate</label><div className="tp-track warn"><span style={{ width: `${metrics.lateCompletionRate}%` }} /></div><b>{metrics.lateCompletionRate}%</b></div>
            </section>

            <section className="tp-card">
              <h3>Task Type Performance (Click to Drill)</h3>
              {metrics.typeCounts.map((t) => {
                const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
                const active = selectedTypeDrill === t.type;
                return (
                  <button key={t.type} className={`tp-typeBtn ${active ? "active" : ""}`} onClick={() => setSelectedTypeDrill(active ? "" : t.type)}>
                    <div className="tp-typeMeta"><span>{t.type}</span><small>{t.done}/{t.total}</small></div>
                    <div className="tp-track"><span style={{ width: `${pct}%` }} /></div>
                  </button>
                );
              })}
            </section>

            <section className="tp-card tp-wide">
              <h3>Lead Engagement Workload Distribution</h3>
              {metrics.leadWorkloadRows.length === 0 ? (
                <p className="tp-muted">No lead engagement workload data for current filters.</p>
              ) : (
                <div className="tp-tableWrap" style={{ marginBottom: 10 }}>
                  <table className="tp-table">
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
                      {metrics.leadWorkloadRows.map((r) => (
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

              <h3>Due Soon (Top 5)</h3>
              {metrics.dueSoon.length === 0 ? (
                <p className="tp-muted">No upcoming open tasks for current filters.</p>
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

            <section className="tp-card tp-wide">
              <h3>Drill-down Task Explorer {selectedTypeDrill ? `• ${selectedTypeDrill}` : ""}</h3>
              {!selectedTypeDrill ? (
                <p className="tp-muted">Click a task type above to drill down into underlying tasks.</p>
              ) : drillTasks.length === 0 ? (
                <p className="tp-muted">No tasks available for this drill selection.</p>
              ) : (
                <div className="tp-tableWrap">
                  <table className="tp-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Overdue Open</th>
                        <th>Due</th>
                        <th>Lead Code</th>
                        <th>Prospect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillTasks.map((t) => (
                        <tr key={t._id}>
                          <td>{t.title || "Untitled task"}</td>
                          <td>{t.status}</td>
                          <td>{t.isOverdue ? "Yes" : "No"}</td>
                          <td>{t?.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}</td>
                          <td>{t?.leadCode || "—"}</td>
                          <td>{t?.prospectName || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
