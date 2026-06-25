import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentSalesPerformance.css";

const API_BASE = "http://localhost:5000";

const DATE_PRESETS = [
  { value: "1d", label: "This Day" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "6m", label: "Last 6 Months" },
  { value: "12m", label: "Last 12 Months" },
];

const DEFAULT_DATA = {
  agent: {},
  filters: { datePreset: "1d", frequency: "Daily" },
  reportContext: { periodLabel: "This Day", startDate: null, endDate: null, generatedAt: null },
  kpis: [],
};

const formatDate = (value) => {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const formatDateTime = (value) => {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
};

const formatReportPeriod = (reportContext) => {
  const start = reportContext?.startDate ? formatDate(reportContext.startDate) : null;
  const end = reportContext?.endDate ? formatDate(reportContext.endDate) : formatDate(reportContext?.generatedAt);
  return start ? `${start} to ${end}` : `Through ${end}`;
};

const getOptionLabel = (value) => DATE_PRESETS.find((option) => option.value === value)?.label || value || "This Day";

const money = (value) => Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatKpiValue = (value, valueType) => {
  if (value === null || value === undefined || value === "") return "—";
  if (valueType === "Currency") return `₱ ${money(value)}`;
  if (valueType === "Percent") return `${Number(value || 0)}%`;
  return Number(value || 0).toLocaleString();
};

const formatKpiTarget = (kpi = {}) => {
  if (kpi.targetValue !== null && kpi.targetValue !== undefined && kpi.targetValue !== "") {
    return formatKpiValue(kpi.targetValue, kpi.valueType);
  }
  const hasMin = kpi.targetMin !== null && kpi.targetMin !== undefined && kpi.targetMin !== "";
  const hasMax = kpi.targetMax !== null && kpi.targetMax !== undefined && kpi.targetMax !== "";
  if (hasMin && hasMax) return `${formatKpiValue(kpi.targetMin, kpi.valueType)} - ${formatKpiValue(kpi.targetMax, kpi.valueType)}`;
  if (hasMin) return `${formatKpiValue(kpi.targetMin, kpi.valueType)} and above`;
  if (hasMax) return `Up to ${formatKpiValue(kpi.targetMax, kpi.valueType)}`;
  return "No target set";
};

const getKpiComparison = (actual, kpi = {}) => {
  const primaryTarget = [kpi.targetValue, kpi.targetMin, kpi.targetMax]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);
  if (!primaryTarget) return { percent: 0, status: "No target set", className: "neutral", deltaLabel: "Set a target to track progress" };
  const numericActual = Number(actual || 0);
  const percent = Math.round((numericActual / primaryTarget) * 100);
  const delta = numericActual - primaryTarget;
  if (delta >= 0) {
    return { percent, status: "Exceeding / On target", className: "good", deltaLabel: `Exceeded by ${formatKpiValue(delta, kpi.valueType)}` };
  }
  return { percent, status: "Below target", className: "warning", deltaLabel: `${formatKpiValue(Math.abs(delta), kpi.valueType)} remaining to target` };
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

function AgentKpiProgress() {
  const navigate = useNavigate();
  const { username } = useParams();
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [datePreset, setDatePreset] = useState("1d");
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (!user || user.username !== username) navigate("/", { replace: true });
  }, [navigate, user, username]);

  useEffect(() => {
    document.title = `${username} | KPI Progress`;
  }, [username]);

  const fetchData = useCallback(async (signal) => {
    if (!user?.id) return;
    const params = new URLSearchParams({ userId: user.id, datePreset });
    const response = await fetch(`${API_BASE}/api/agent/kpi-progress?${params.toString()}`, signal ? { signal } : undefined);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message || "Failed to load KPI progress.");
    setData({ ...DEFAULT_DATA, ...payload, kpis: Array.isArray(payload?.kpis) ? payload.kpis : [] });
    setLastUpdated(new Date());
  }, [datePreset, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setApiError("");
    fetchData(controller.signal)
      .catch((err) => {
        if (err.name !== "AbortError") setApiError(err.message || "Failed to load KPI progress.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [fetchData]);

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
      case "sales":
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;
      case "agent_kpi_progress": navigate(`/agent/${user.username}/kpi/progress`); break;
      default: break;
    }
  };

  const generatePdfReport = () => {
    const agentName = [data.agent?.firstName, data.agent?.middleName, data.agent?.lastName].filter(Boolean).join(" ") || user?.username || "Agent";
    const reportRows = data.kpis.map((kpi) => {
      const comparison = getKpiComparison(kpi.actual, kpi);
      return `
        <tr>
          <td>${escapeHtml(kpi.label)}</td>
          <td>${escapeHtml(kpi.period || data.filters.frequency)}</td>
          <td>${escapeHtml(formatKpiValue(kpi.actual, kpi.valueType))}</td>
          <td>${escapeHtml(formatKpiTarget(kpi))}</td>
          <td>${escapeHtml(comparison.status)}</td>
          <td>${escapeHtml(comparison.deltaLabel)}</td>
        </tr>`;
    }).join("");
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(user?.username || "Agent")} - KPI Progress Report</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: Arial, sans-serif; color:#111827; }
            h1 { margin:0 0 4px; font-size:24px; }
            .muted { color:#6b7280; margin:0 0 16px; }
            .details { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:14px; }
            .details div { border:1px solid #e5e7eb; border-radius:8px; padding:8px; }
            .details b { display:block; font-size:11px; color:#6b7280; margin-bottom:4px; }
            table { width:100%; border-collapse:collapse; font-size:12px; }
            th, td { border:1px solid #e5e7eb; padding:8px; text-align:left; }
            th { background:#f9fafb; }
          </style>
        </head>
        <body>
          <h1>Agent KPI Progress Report</h1>
          <p class="muted">Report Period: ${escapeHtml(formatReportPeriod(data.reportContext))} • Date Range: ${escapeHtml(getOptionLabel(datePreset))}</p>
          <section class="details">
            <div><b>Agent Code</b>${escapeHtml(user?.username || "—")}</div>
            <div><b>Agent Name</b>${escapeHtml(agentName)}</div>
            <div><b>Unit</b>${escapeHtml(data.agent?.unitName || "—")}</div>
            <div><b>Branch</b>${escapeHtml(data.agent?.branchName || "—")}</div>
          </section>
          <table>
            <thead><tr><th>KPI</th><th>Frequency</th><th>Actual</th><th>Target</th><th>Status</th><th>Gap / Excess</th></tr></thead>
            <tbody>${reportRows || `<tr><td colspan="6">No agent KPIs assigned.</td></tr>`}</tbody>
          </table>
        </body>
      </html>
    `;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };
    iframe.contentWindow.onafterprint = cleanup;
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(cleanup, 2000);
    }, 250);
  };

  if (!user || user.username !== username) return null;

  return (
    <div className="sp-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate, "AG")}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="sp-body">
        <SideNav active="agent_kpi_progress" onNavigate={handleSideNav} />

        <main className="sp-content">
          <div className="sp-headRow">
            <div>
              <h1 className="sp-title">Agent KPI Progress</h1>
              <p className="sp-subtitle">View your assigned KPI targets and actual progress for the selected date range.</p>
            </div>
            <div className="sp-headActions">
              <span className="sp-lastUpdated">Updated {lastUpdated ? formatDateTime(lastUpdated) : "—"}</span>
              <button className="sp-refreshBtn" onClick={() => fetchData()} disabled={loading}>Refresh</button>
            </div>
          </div>

          <section className="sp-card sp-filterBar">
            <div className="sp-filterGroup">
              <label>Date Range</label>
              <select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
                {DATE_PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="sp-filterActions">
              <button className="sp-reportBtn" onClick={generatePdfReport} disabled={loading}>Generate Report (PDF)</button>
            </div>
          </section>

          {apiError ? <div className="sp-error">{apiError}</div> : null}
          {loading ? <section className="sp-card"><p className="sp-muted">Loading KPI progress...</p></section> : null}

          {!loading && !data.kpis.length ? (
            <section className="sp-card">
              <p className="sp-muted">No agent KPIs assigned.</p>
            </section>
          ) : null}

          {!loading && data.kpis.length > 0 ? (
            <section className="agent-kpi-grid">
              {data.kpis.map((kpi) => {
                const comparison = getKpiComparison(kpi.actual, kpi);
                return (
                  <article className={`agent-kpi-card ${comparison.className}`} key={kpi.key}>
                    <div className="agent-kpi-card__head">
                      <span>{data.reportContext?.periodLabel || getOptionLabel(datePreset)} • {kpi.period || data.filters.frequency}</span>
                      <strong>{kpi.label}</strong>
                    </div>
                    <div className="agent-kpi-values">
                      <div>
                        <span>Actual Progress</span>
                        <b>{formatKpiValue(kpi.actual, kpi.valueType)}</b>
                      </div>
                      <div>
                        <span>Assigned Target</span>
                        <b>{formatKpiTarget(kpi)}</b>
                      </div>
                    </div>
                    <div className="agent-kpi-progress-bar" aria-label={`${kpi.label} progress ${comparison.percent}%`}>
                      <span style={{ width: `${Math.max(0, Math.min(comparison.percent, 140))}%` }} />
                    </div>
                    <em>{comparison.status}</em>
                    <small>{comparison.deltaLabel}</small>
                  </article>
                );
              })}
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default AgentKpiProgress;
