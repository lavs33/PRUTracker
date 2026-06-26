import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentSalesPerformance.css";
import "./AgentKpiProgress.css";

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
  unitSalesContribution: null,
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
  if (!start) return `Through ${end}`;
  return start === end ? start : `${start} to ${end}`;
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
    const agentCode = user?.username || "Agent";
    const agentName = [data.agent?.firstName, data.agent?.middleName, data.agent?.lastName].filter(Boolean).join(" ") || agentCode;
    const reportFilename = `${agentCode} - Agent KPI Progress Report`;
    const previousDocumentTitle = document.title;
    const now = new Date();
    const reportPeriod = formatReportPeriod(data.reportContext);
    const unitContribution = data.unitSalesContribution;
    const unitContributionComparison = unitContribution ? getKpiComparison(unitContribution.actual, unitContribution.kpi) : null;
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

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const reportDoc = iframe.contentWindow?.document;
    if (!reportDoc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      return;
    }

    document.title = reportFilename;
    reportDoc.open();
    reportDoc.write(`
      <html>
        <head>
          <title>${escapeHtml(reportFilename)}</title>
          <style>
            @page { size: A4 portrait; margin: 8mm 8mm 10mm 8mm; }
            * { box-sizing: border-box; }
            body { font-family: Verdana, Geneva, sans-serif; color: #1f2937; margin: 0; font-size: 11px; line-height: 1.3; background:#fff; }
            .pdf-page { position: relative; min-height: 279mm; padding: 6mm 6mm 12mm; overflow: hidden; }
            .header-band { height: 6px; background: linear-gradient(90deg, #da291c, #ffb81c, #00539b); border-radius: 6px; margin-bottom: 6px; }
            .top-grid { display:grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 14px; align-items:start; }
            .report-title { margin: 0; color: #991b1b; font-size: 23px; line-height: 1.08; font-weight: 700; }
            .report-period { margin-top: 10px; color: #374151; font-size: 13px; font-weight: 700; }
            .details-card { border: 1px solid #f3c4c0; background: #fff7f6; border-radius: 10px; padding: 10px 12px; }
            .details-card h3 { margin: 0 0 6px; color: #991b1b; font-size: 12px; text-transform: uppercase; }
            .details-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 5px 14px; }
            .detail-item { font-size: 10px; }
            .detail-item b { color: #6b7280; display:block; font-weight:700; margin-bottom:1px; }
            .section { margin-bottom: 8px; }
            .report-header-section { padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
            .meta-row { display:grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; }
            .meta-chip { border:1px solid #f0d2cf; background:#fff7f6; border-radius:10px; padding:8px 10px; }
            .meta-chip .label { color:#6b7280; font-size:10px; text-transform:uppercase; }
            .meta-chip .value { color:#991b1b; font-size:12px; font-weight:700; margin-top:3px; }
            .kpi-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
            .kpi { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#ffffff; }
            .kpi .label { color:#6b7280; font-size:10px; }
            .kpi .val { font-size:16px; font-weight:700; margin-top:2px; color:#111827; }
            .panel { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#fff; }
            .panel h4 { margin:0 0 6px; color:#111827; font-size:12px; }
            table { width:100%; border-collapse: collapse; font-size:10px; }
            th, td { border: 1px solid #dfe5ec; padding: 5px 6px; text-align:left; vertical-align:top; }
            th { background: #f3f6fa; color:#374151; }
            tbody tr:nth-child(even) td { background:#fcfcfd; }
            .report-footer { position:absolute; left:8mm; right:8mm; bottom:4mm; font-size:9px; color:#6b7280; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e5e7eb; padding-top:3px; }
          </style>
        </head>
        <body>
          <section class="pdf-page">
            <div class="header-band"></div>
            <section class="section report-header-section">
              <div class="top-grid">
                <div>
                  <h1 class="report-title">Agent KPI Progress Report</h1>
                  <div class="report-period">Report Period: ${escapeHtml(reportPeriod)}</div>
                </div>
                <div class="details-card compact">
                  <h3>Agent Details</h3>
                  <div class="details-grid">
                    <div class="detail-item"><b>Agent Code</b>${escapeHtml(agentCode)}</div>
                    <div class="detail-item"><b>Agent Type</b>${escapeHtml(data.agent?.agentType || user?.agentType || "—")}</div>
                    <div class="detail-item"><b>Name</b>${escapeHtml(agentName)}</div>
                    <div class="detail-item"><b>Unit</b>${escapeHtml(data.agent?.unitName || user?.unitName || "—")}</div>
                    <div class="detail-item"><b>Branch</b>${escapeHtml(data.agent?.branchName || user?.branchName || "—")}</div>
                    <div class="detail-item"><b>Area</b>${escapeHtml(data.agent?.areaName || user?.areaName || "—")}</div>
                  </div>
                </div>
              </div>
            </section>
            <section class="section">
              <div class="meta-row">
                <div class="meta-chip"><div class="label">Date Range</div><div class="value">${escapeHtml(getOptionLabel(datePreset))}</div></div>
                <div class="meta-chip"><div class="label">KPI Frequency</div><div class="value">${escapeHtml(data.filters?.frequency || "Daily")}</div></div>
                <div class="meta-chip"><div class="label">Assigned KPI Cards</div><div class="value">${data.kpis.length}</div></div>
              </div>
            </section>
            <section class="section">
              <div class="kpi-grid">
                ${data.kpis.map((kpi) => `<div class="kpi"><div class="label">${escapeHtml(kpi.label)}</div><div class="val">${escapeHtml(formatKpiValue(kpi.actual, kpi.valueType))}</div></div>`).join("") || '<div class="kpi"><div class="label">Assigned KPI Cards</div><div class="val">0</div></div>'}
              </div>
            </section>
            <section class="section">
              <div class="panel">
                <h4>Agent KPI Progress</h4>
                <table>
                  <thead><tr><th>KPI</th><th>Frequency</th><th>Actual</th><th>Target</th><th>Status</th><th>Gap / Excess</th></tr></thead>
                  <tbody>${reportRows || `<tr><td colspan="6">No agent KPIs assigned.</td></tr>`}</tbody>
                </table>
              </div>
            </section>
            ${unitContribution ? `
              <section class="section">
                <div class="panel">
                  <h4>Contribution to Unit Sales Production</h4>
                  <table>
                    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                    <tbody>
                      <tr><td>Agent Sales Production</td><td>${escapeHtml(formatKpiValue(unitContribution.actual, unitContribution.kpi?.valueType || "Currency"))}</td></tr>
                      <tr><td>Unit Sales Production Achieved</td><td>${escapeHtml(formatKpiValue(unitContribution.unitActual || 0, unitContribution.kpi?.valueType || "Currency"))}</td></tr>
                      <tr><td>Agent Contribution Share</td><td>${Number(unitContribution.contributionShare || 0)}%</td></tr>
                      <tr><td>Unit Sales Production Target</td><td>${escapeHtml(formatKpiTarget(unitContribution.kpi))}</td></tr>
                      <tr><td>Status</td><td>${escapeHtml(unitContributionComparison?.status || "—")}</td></tr>
                      <tr><td>Gap / Excess</td><td>${escapeHtml(unitContributionComparison?.deltaLabel || "—")}</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            ` : ""}
            <div class="report-footer"><div>Generated by PRUTracker • ${escapeHtml(formatDateTime(now))}</div><div>Page 1 of 1</div></div>
          </section>
        </body>
      </html>
    `);
    reportDoc.close();
    reportDoc.title = reportFilename;

    try {
      iframe.contentWindow.history.replaceState({}, "", "/agent-kpi-progress-report");
    } catch {}

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      document.title = previousDocumentTitle;
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 400);
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
              <p className="sp-subtitle">View the assigned KPI targets and actual progress for the selected date range.</p>
            </div>
            <div className="sp-headActions">
              <span className="sp-lastUpdated">Updated {lastUpdated ? formatDateTime(lastUpdated) : "—"}</span>
              <button className="sp-refreshBtn" onClick={() => fetchData()} disabled={loading}>Refresh</button>
              <button className="sp-reportBtn" onClick={generatePdfReport} disabled={loading}>Generate Report (PDF)</button>
            </div>
          </div>

          <section className="sp-card sp-filterBar">
            <div className="sp-filterGroup">
              <label>Date Range</label>
              <select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
                {DATE_PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
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

          {!loading && data.unitSalesContribution ? (() => {
            const contribution = data.unitSalesContribution;
            const comparison = getKpiComparison(contribution.actual, contribution.kpi);
            const agentName = [data.agent?.firstName, data.agent?.middleName, data.agent?.lastName].filter(Boolean).join(" ") || data.agent?.username || user?.username || "Agent";
            return (
              <section className="agent-kpi-contribution-section">
                <h2>Contribution in Unit Sales Production</h2>
                <article className="agent-kpi-contribution-card">
                  <div className="agent-kpi-card__head">
                    <span>{data.reportContext?.periodLabel || getOptionLabel(datePreset)} • {contribution.kpi?.period || data.filters.frequency}</span>
                    <strong>{agentName}</strong>
                  </div>
                  <div className="agent-kpi-values">
                    <div>
                      <span>Agent Sales Production</span>
                      <b>{formatKpiValue(contribution.actual, contribution.kpi?.valueType || "Currency")}</b>
                    </div>
                    <div>
                      <span>Unit KPI Target</span>
                      <b>{formatKpiTarget(contribution.kpi)}</b>
                    </div>
                  </div>
                  <p className="agent-kpi-contribution-note">
                    Unit sales production achieved: {formatKpiValue(contribution.unitActual || 0, contribution.kpi?.valueType || "Currency")} • Agent contribution share: {Number(contribution.contributionShare || 0)}%
                  </p>
                  <div className="agent-kpi-progress-bar" aria-label={`Contribution to unit sales production progress ${comparison.percent}%`}>
                    <span style={{ width: `${Math.max(0, Math.min(comparison.percent, 140))}%` }} />
                  </div>
                  <em>{comparison.status}</em>
                  <small>{comparison.deltaLabel}</small>
                </article>
              </section>
            );
          })() : null}
        </main>
      </div>
    </div>
  );
}

export default AgentKpiProgress;
