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

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [data, setData] = useState({
    totalTasks: 0,
    openTasks: 0,
    doneTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    onTimeRate: 0,
    lateCompletionRate: 0,
    overdueOpenRate: 0,
    delayedDoneTasks: 0,
    typeCounts: [],
    leadWorkloadRows: [],
    statusChart: [],
    drillTasks: [],
    reportTasks: [],
    reportContext: { datePreset: "30d", status: "ALL", type: "ALL" },
  });

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

  const fetchProgress = useCallback(
    async (signal) => {
      if (!user?.id) return;
      const params = new URLSearchParams({
        userId: user.id,
        datePreset,
        status: statusFilter,
        type: typeFilter,
        drillType: selectedTypeDrill || "",
      });

      const res = await fetch(`${API_BASE}/api/tasks/progress?${params.toString()}`, signal ? { signal } : undefined);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message || "Failed to fetch task progress.");

      setData({
        totalTasks: Number(payload?.totalTasks || 0),
        openTasks: Number(payload?.openTasks || 0),
        doneTasks: Number(payload?.doneTasks || 0),
        overdueTasks: Number(payload?.overdueTasks || 0),
        completionRate: Number(payload?.completionRate || 0),
        onTimeRate: Number(payload?.onTimeRate || 0),
        lateCompletionRate: Number(payload?.lateCompletionRate || 0),
        overdueOpenRate: Number(payload?.overdueOpenRate || 0),
        delayedDoneTasks: Number(payload?.delayedDoneTasks || 0),
        typeCounts: Array.isArray(payload?.typeCounts) ? payload.typeCounts : [],
        leadWorkloadRows: Array.isArray(payload?.leadWorkloadRows) ? payload.leadWorkloadRows : [],
        statusChart: Array.isArray(payload?.statusChart) ? payload.statusChart : [],
        drillTasks: Array.isArray(payload?.drillTasks) ? payload.drillTasks : [],
        reportTasks: Array.isArray(payload?.reportTasks) ? payload.reportTasks : [],
        reportContext: payload?.reportContext || { datePreset, status: statusFilter, type: typeFilter },
      });
    },
    [API_BASE, user?.id, datePreset, statusFilter, typeFilter, selectedTypeDrill]
  );

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
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [user?.id, fetchProgress]);

  const generatePdfReport = () => {
    const rows = data.reportTasks
      .slice(0, 120)
      .map(
        (t) => `
          <tr>
            <td>${t?.title || "Untitled task"}</td>
            <td>${t?.type || "—"}</td>
            <td>${t?.status || "—"}</td>
            <td>${t?.isOverdue ? "Yes" : "No"}</td>
            <td>${t?.wasDelayed ? "Yes" : "No"}</td>
            <td>${t?.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}</td>
            <td>${t?.leadCode || "—"}</td>
            <td>${t?.prospectName || "—"}</td>
          </tr>
        `
      )
      .join("");

    const reportWindow = window.open("", "_blank", "width=1200,height=800");
    if (!reportWindow) return;

    reportWindow.document.write(`
      <html><head><title>Task Progress Report - ${username}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
        h1 { margin: 0 0 12px; }
        .meta { margin-bottom: 14px; }
        .meta div { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background: #f3f4f6; }
        @media print { .note { display:none; } }
      </style></head>
      <body>
        <h1>Task Progress and Workload Distribution Dashboard Report</h1>
        <div class="meta">
          <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
          <div><strong>Date Range:</strong> ${data.reportContext?.datePreset || datePreset}</div>
          <div><strong>Status Filter:</strong> ${data.reportContext?.status || statusFilter}</div>
          <div><strong>Type Filter:</strong> ${data.reportContext?.type || typeFilter}</div>
          <div><strong>Total/Open/Done/Overdue:</strong> ${data.totalTasks} / ${data.openTasks} / ${data.doneTasks} / ${data.overdueTasks}</div>
          <div><strong>Completion/On-Time/Late:</strong> ${data.completionRate}% / ${data.onTimeRate}% / ${data.lateCompletionRate}%</div>
        </div>
        <p class="note">Tip: Choose <strong>Save as PDF</strong> in the print dialog.</p>
        <table><thead><tr>
          <th>Title</th><th>Type</th><th>Status</th><th>Overdue Open</th><th>Was Delayed</th><th>Due</th><th>Lead Code</th><th>Prospect</th>
        </tr></thead><tbody>${rows}</tbody></table>
      </body></html>
    `);

    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
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
            <h1 className="tp-title">Task Progress and Workload Distribution Dashboard</h1>
            <button className="tp-reportBtn" onClick={generatePdfReport}>Generate Report (PDF)</button>
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
              <button className="tp-chip" onClick={() => { setDatePreset("30d"); setStatusFilter("ALL"); setTypeFilter("ALL"); setSelectedTypeDrill(""); }}>Reset</button>
            </div>
          </section>

          <div className="tp-kpis">
            <div className="tp-kpi"><span>Total Tasks</span><strong>{data.totalTasks}</strong></div>
            <div className="tp-kpi"><span>Open</span><strong>{data.openTasks}</strong></div>
            <div className="tp-kpi"><span>Done</span><strong>{data.doneTasks}</strong></div>
            <div className="tp-kpi"><span>Overdue</span><strong>{data.overdueTasks}</strong></div>
            <div className="tp-kpi"><span>Completion Rate</span><strong>{data.completionRate}%</strong></div>
            <div className="tp-kpi"><span>On-Time Completion</span><strong>{data.onTimeRate}%</strong></div>
            <div className="tp-kpi"><span>Late Completion Rate</span><strong>{data.lateCompletionRate}%</strong></div>
          </div>

          <div className="tp-grid">
            <section className="tp-card">
              <h3>Progress Overview</h3>
              <div className="tp-progressRow"><label>Completion</label><div className="tp-track"><span style={{ width: `${data.completionRate}%` }} /></div><b>{data.completionRate}%</b></div>
              <div className="tp-progressRow"><label>On-Time Done</label><div className="tp-track alt"><span style={{ width: `${data.onTimeRate}%` }} /></div><b>{data.onTimeRate}%</b></div>
              <div className="tp-progressRow"><label>Overdue Open Tasks</label><div className="tp-track warn"><span style={{ width: `${data.overdueOpenRate}%` }} /></div><b>{data.overdueOpenRate}%</b></div>
              <div className="tp-progressRow"><label>Late Completion Rate</label><div className="tp-track warn"><span style={{ width: `${data.lateCompletionRate}%` }} /></div><b>{data.lateCompletionRate}%</b></div>
            </section>

            <section className="tp-card">
              <h3>Status Distribution Chart</h3>
              <div className="tp-statusChart">
                {data.statusChart.map((s) => {
                  const pct = data.totalTasks ? Math.round((s.value / data.totalTasks) * 100) : 0;
                  return (
                    <div className="tp-statusBar" key={s.key}>
                      <div className="tp-statusFill" style={{ height: `${Math.max(pct, 4)}%`, background: s.color }} />
                      <small>{s.key}</small>
                      <strong>{s.value}</strong>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="tp-card tp-wide">
              <h3>Task Type Performance (Click to Drill)</h3>
              {data.typeCounts.map((t) => {
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
              <h3>Drill-down Task Explorer {selectedTypeDrill ? `• ${selectedTypeDrill}` : ""}</h3>
              {!selectedTypeDrill ? (
                <p className="tp-muted">Click a task type above to drill down into underlying tasks.</p>
              ) : data.drillTasks.length === 0 ? (
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
                      {data.drillTasks.map((t) => (
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

            <section className="tp-card tp-wide">
              <h3>Lead Engagement Workload Distribution</h3>
              {data.leadWorkloadRows.length === 0 ? (
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
                      {data.leadWorkloadRows.map((r) => (
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

          {loading && <p className="tp-muted" style={{ marginTop: 10 }}>Loading task metrics…</p>}
          {!loading && apiError && <p className="tp-muted" style={{ color: "#DA291C", marginTop: 10 }}>{apiError}</p>}
        </main>
      </div>
    </div>
  );
}

export default AgentTasksProgress;
