import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import { getKpiProgressPercent, getKpiTargetRules } from "./utils/taskKpiImpact";
import "./AgentSalesPerformance.css";
import "./AgentKpiProgress.css";

const API_BASE = "http://localhost:5000";

const monthKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
};
const CURRENT_MONTH = monthKey();
const TASK_KPI_TYPE_BY_KEY = {
  weekly_approaches: "APPROACH",
  weekly_appointments: "APPOINTMENT",
  weekly_presentations: "PRESENTATION",
};
const buildMonthOptions = (dataStartDate) => {
  const options = [];
  const currentYear = CURRENT_MONTH.split("-")[0];
  const startParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" })
    .formatToParts(new Date(dataStartDate || `${currentYear}-01-01T00:00:00.000Z`));
  const dataYear = startParts.find((part) => part.type === "year")?.value || currentYear;
  const startYear = dataYear === currentYear ? dataYear : currentYear;
  const startMonth = dataYear === currentYear ? (startParts.find((part) => part.type === "month")?.value || "01") : "01";
  let cursor = `${startYear}-${startMonth}`;
  while (cursor <= CURRENT_MONTH) {
    const [year, month] = cursor.split("-").map(Number);
    options.push({
      value: cursor,
      label: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" }),
    });
    cursor = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  }
  return options;
};
const MONTH_OPTIONS = buildMonthOptions();

const DEFAULT_DATA = {
  agent: {},
  filters: { month: CURRENT_MONTH, frequency: "Monthly" },
  reportContext: { periodLabel: MONTH_OPTIONS.at(-1)?.label || CURRENT_MONTH, startDate: null, endDate: null, generatedAt: null },
  kpis: [],
  unitSalesContribution: null,
  recommendations: { ongoingLeads: [] },
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

const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || value || CURRENT_MONTH;

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
  const targetRules = getKpiTargetRules(kpi);
  if (!targetRules.basis) return { percent: 0, status: "No target set", className: "neutral", deltaLabel: "Set a target to track progress" };
  const numericActual = Number(actual || 0);
  const percent = getKpiProgressPercent(numericActual, targetRules);
  if (targetRules.kind === "range") {
    if (numericActual > targetRules.max) {
      return { percent, status: "Exceeded target", className: "good", deltaLabel: `Exceeded range maximum by ${formatKpiValue(numericActual - targetRules.max, kpi.valueType)}` };
    }
    if (numericActual >= targetRules.min) {
      return { percent, status: "On target", className: "good", deltaLabel: "Within assigned target range" };
    }
    return { percent, status: "Below target", className: "warning", deltaLabel: `${formatKpiValue(targetRules.min - numericActual, kpi.valueType)} remaining to target range` };
  }
  if (targetRules.kind === "minimum") {
    if (numericActual >= targetRules.min) return { percent, status: "On target", className: "good", deltaLabel: "At or above assigned minimum target" };
    return { percent, status: "Below target", className: "warning", deltaLabel: `${formatKpiValue(targetRules.min - numericActual, kpi.valueType)} remaining to minimum target` };
  }
  const delta = numericActual - targetRules.basis;
  if (delta > 0) return { percent, status: "Exceeded target", className: "good", deltaLabel: `Exceeded by ${formatKpiValue(delta, kpi.valueType)}` };
  if (delta === 0) return { percent, status: "On target", className: "good", deltaLabel: "" };
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

  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [monthOptions, setMonthOptions] = useState(MONTH_OPTIONS);
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [recommendationTasks, setRecommendationTasks] = useState([]);

  useEffect(() => {
    if (!user || user.username !== username) navigate("/", { replace: true });
  }, [navigate, user, username]);

  useEffect(() => {
    document.title = `${username} | KPI Progress`;
  }, [username]);

  const fetchData = useCallback(async (signal) => {
    if (!user?.id) return;
    const params = new URLSearchParams({ userId: user.id, month: selectedMonth });
    const kpiRequest = fetch(`${API_BASE}/api/agent/kpi-progress?${params.toString()}`, signal ? { signal } : undefined);
    const tasksRequest = selectedMonth === CURRENT_MONTH
      ? fetch(`${API_BASE}/api/tasks?${new URLSearchParams({ userId: user.id, status: "Open", includeRefs: "1" }).toString()}`, signal ? { signal } : undefined)
      : Promise.resolve(null);
    const [response, tasksResponse] = await Promise.all([kpiRequest, tasksRequest]);
    const payload = await response.json();
    const tasksPayload = tasksResponse ? await tasksResponse.json() : { tasks: [] };
    if (!response.ok) throw new Error(payload?.message || "Failed to load KPI progress.");
    setData({ ...DEFAULT_DATA, ...payload, kpis: Array.isArray(payload?.kpis) ? payload.kpis : [] });
    setMonthOptions(buildMonthOptions(payload?.dataStartDate));
    setRecommendationTasks(tasksResponse?.ok && Array.isArray(tasksPayload?.tasks) ? tasksPayload.tasks : []);
    setLastUpdated(new Date());
  }, [selectedMonth, user?.id]);

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

  const getKpiRecommendations = (kpi, comparison) => {
    if (selectedMonth !== CURRENT_MONTH) return [];
    const targetReached = comparison.className === "good";
    const missingCount = Math.max(1, Math.ceil(Number(kpi.targetValue || kpi.targetMin || kpi.targetMax || 0) - Number(kpi.actual || 0)));
    const taskType = TASK_KPI_TYPE_BY_KEY[kpi.key];
    if (taskType) {
      const matchingTasks = recommendationTasks
        .filter((task) => String(task?.type || "").toUpperCase() === taskType && String(task?.status || "").toLowerCase() !== "done")
        .slice(0, Math.max(missingCount, 10));
      return [{
        title: matchingTasks.length ? `Review ${matchingTasks.length} open/overdue ${taskType.toLowerCase()} task${matchingTasks.length === 1 ? "" : "s"}` : `No open/overdue ${taskType.toLowerCase()} tasks`,
        description: matchingTasks.length
          ? `These ${taskType.toLowerCase()} tasks are still open or overdue and should remain visible even when this KPI is on target or exceeded.`
          : `There are no open/overdue ${taskType.toLowerCase()} tasks related to this KPI.`,
        tasks: matchingTasks,
      }];
    }
    if (kpi.key === "monthly_new_prospects") {
      return targetReached ? [] : [{ title: `Add ${missingCount} new prospect${missingCount === 1 ? "" : "s"}`, description: "Create new prospect records this month to increase this KPI.", path: `/agent/${username}/prospects` }];
    }
    if (["monthly_policies", "monthly_closing_ratio"].includes(kpi.key)) {
      const leads = Array.isArray(data.recommendations?.ongoingLeads) ? data.recommendations.ongoingLeads : [];
      return [{
        title: leads.length ? `Review ${leads.length} ongoing lead${leads.length === 1 ? "" : "s"} that could still be converted` : "No ongoing leads to convert",
        description: leads.length ? "These active leads could still become issued active policies and improve this KPI." : "There are no ongoing leads related to this KPI right now.",
        leads,
      }];
    }
    return comparison.className === "warning" ? [{ title: "Focus on this KPI gap", description: "Review related client, task, and sales records for the current month and complete the next action that contributes to this KPI." }] : [];
  };

  const navigateToPageTop = (path) => {
    navigate(path);
    window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
  };

  const openLead = (lead) => {
    if (lead?.prospectId && lead?.leadId) return navigateToPageTop(`/agent/${username}/prospects/${lead.prospectId}/leads/${lead.leadId}/engage`);
    if (lead?.prospectId) return navigateToPageTop(`/agent/${username}/prospects/${lead.prospectId}`);
    return navigateToPageTop(`/agent/${username}/sales/performance`);
  };

  const formatTaskDueDateTime = (value) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "No due date";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const taskTimingLabel = (task) => {
    const dueTime = new Date(task?.dueAt).getTime();
    const isOverdue = String(task?.status || "").toLowerCase() !== "done" && Number.isFinite(dueTime) && dueTime < Date.now();
    return `${isOverdue ? "Overdue" : "Open"} • Due ${formatTaskDueDateTime(task?.dueAt)}`;
  };

  const openTask = (task) => {
    if (task?.prospectId && task?.leadId) return navigateToPageTop(`/agent/${username}/prospects/${task.prospectId}/leads/${task.leadId}/engage`);
    if (task?.prospectId) return navigateToPageTop(`/agent/${username}/prospects/${task.prospectId}`);
    return navigateToPageTop(`/agent/${username}/tasks/all`);
  };

  const generatePdfReport = () => {
    const agentCode = user?.username || "Agent";
    const agentName = [data.agent?.firstName, data.agent?.middleName, data.agent?.lastName].filter(Boolean).join(" ") || agentCode;
    const reportFilename = `${agentCode} - Agent KPI Progress Report`;
    const previousDocumentTitle = document.title;
    const now = new Date();
    const reportPeriod = formatReportPeriod(data.reportContext);
    const unitContribution = data.unitSalesContribution;
    const unitContributionComparison = unitContribution ? getKpiComparison(unitContribution.unitActual || 0, unitContribution.kpi) : null;
    const reportRows = data.kpis.map((kpi) => {
      const comparison = getKpiComparison(kpi.actual, kpi);
      return `
        <tr>
          <td>${escapeHtml(kpi.label)}</td>
          <td>${escapeHtml(data.reportContext?.periodLabel || getOptionLabel(monthOptions, selectedMonth))}</td>
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
            @page { size: A4 portrait; margin: 0; }
            * { box-sizing: border-box; }
            body { font-family: Verdana, Geneva, sans-serif; color: #1f2937; margin: 0; font-size: 11px; line-height: 1.3; background:#fff; }
            .pdf-page { position: relative; min-height: 297mm; padding: 14mm 14mm 22mm; overflow: hidden; }
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
            .report-footer { position:absolute; left:16mm; right:16mm; bottom:14mm; font-size:9px; color:#6b7280; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e5e7eb; padding-top:3px; }
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
                <div class="meta-chip"><div class="label">Selected Month</div><div class="value">${escapeHtml(getOptionLabel(monthOptions, selectedMonth))}</div></div>
                <div class="meta-chip"><div class="label">KPI Target Period</div><div class="value">Monthly</div></div>
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
                  <thead><tr><th>KPI</th><th>Month</th><th>Actual</th><th>Target</th><th>Status</th><th>Gap / Excess</th></tr></thead>
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
              <h1 className="sp-title">KPI Progress Dashboard</h1>
              <p className="sp-subtitle">View actual KPI progress against the assigned targets for the selected month.</p>
            </div>
            <div className="sp-headActions">
              <span className="sp-lastUpdated">Updated {lastUpdated ? formatDateTime(lastUpdated) : "—"}</span>
              <button className="sp-refreshBtn" onClick={() => fetchData()} disabled={loading}>Refresh</button>
              <button className="sp-reportBtn" onClick={generatePdfReport} disabled={loading}>Generate Report (PDF)</button>
            </div>
          </div>

          <section className="sp-card sp-filterBar">
            <div className="sp-filterGroup">
              <label>Month</label>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                const recommendations = getKpiRecommendations(kpi, comparison);
                return (
                  <article className={`agent-kpi-card ${comparison.className}`} key={kpi.key}>
                    <div className="agent-kpi-card__head">
                      <span>{data.reportContext?.periodLabel || getOptionLabel(monthOptions, selectedMonth)} • Monthly</span>
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
                    {comparison.deltaLabel ? <small>{comparison.deltaLabel}</small> : null}
                    {recommendations.length ? <div className="agent-kpi-recommendations">
                      <span className="agent-kpi-recommendations__label">Recommended actions</span>
                      {recommendations.map((recommendation) => (
                        <div className="agent-kpi-recommendation" key={recommendation.title}>
                          <strong>{recommendation.title}</strong>
                          <p>{recommendation.description}</p>
                          {recommendation.path ? <button type="button" onClick={() => navigateToPageTop(recommendation.path)}>Open related dashboard</button> : null}
                          {recommendation.tasks?.length ? <div className="agent-kpi-recommendation__tasks">
                            {recommendation.tasks.map((task) => (
                              <button type="button" key={task._id} onClick={() => openTask(task)}>
                                <b>{task.title || `${task.type} task`}</b>
                                <span>{task.prospectName || "Prospect"} • {task.leadCode || "Lead —"} • {taskTimingLabel(task)}</span>
                              </button>
                            ))}
                          </div> : null}
                          {recommendation.leads?.length ? <div className="agent-kpi-recommendation__tasks">
                            {recommendation.leads.map((lead) => (
                              <button type="button" key={lead.id || lead.leadId} onClick={() => openLead(lead)}>
                                <b>{lead.leadCode || "Lead —"} • {lead.status || "Ongoing"}</b>
                                <span>{lead.prospectName || "Prospect"} • {lead.source || "Source —"}</span>
                              </button>
                            ))}
                          </div> : null}
                        </div>
                      ))}
                    </div> : null}
                  </article>
                );
              })}
            </section>
          ) : null}

          {!loading && data.unitSalesContribution ? (() => {
            const contribution = data.unitSalesContribution;
            const comparison = getKpiComparison(contribution.unitActual || 0, contribution.kpi);
            return (
              <section className="agent-kpi-contribution-section">
                <h2>Contribution in Unit Sales Production</h2>
                <article className="agent-kpi-contribution-card">
                  <div className="agent-kpi-contribution-period">
                    <span>{data.reportContext?.periodLabel || getOptionLabel(monthOptions, selectedMonth)} • Monthly</span>
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
                  {comparison.deltaLabel ? <small>{comparison.deltaLabel}</small> : null}
                  {selectedMonth === CURRENT_MONTH ? <div className="agent-kpi-recommendations">
                    <span className="agent-kpi-recommendations__label">Recommended actions</span>
                    <div className="agent-kpi-recommendation">
                      <strong>{(data.recommendations?.ongoingLeads || []).length ? `Review ${(data.recommendations?.ongoingLeads || []).length} ongoing lead${(data.recommendations?.ongoingLeads || []).length === 1 ? "" : "s"} that could still be converted` : "No ongoing leads to convert"}</strong>
                      <p>{(data.recommendations?.ongoingLeads || []).length ? "These active leads can still contribute to unit sales production if converted." : "There are no ongoing leads related to this KPI right now."}</p>
                      {(data.recommendations?.ongoingLeads || []).length ? <div className="agent-kpi-recommendation__tasks">
                        {(data.recommendations?.ongoingLeads || []).map((lead) => (
                          <button type="button" key={lead.id || lead.leadId} onClick={() => openLead(lead)}>
                            <b>{lead.leadCode || "Lead —"} • {lead.status || "Ongoing"}</b>
                            <span>{lead.prospectName || "Prospect"} • {lead.source || "Source —"}</span>
                          </button>
                        ))}
                      </div> : null}
                    </div>
                  </div> : null}
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