import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentClientsRelationship.css";

const DATE_PRESETS = [
  { value: "ALL", label: "All Time" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "365d", label: "Last 365 Days" },
];

const SOURCE_OPTIONS = [
  { value: "ALL", label: "All Sources" },
  { value: "Agent-Sourced", label: "Agent-Sourced" },
  { value: "System-Assigned", label: "System-Assigned" },
];

const MARKET_OPTIONS = [
  { value: "ALL", label: "All Market Types" },
  { value: "Warm", label: "Warm" },
  { value: "Cold", label: "Cold" },
];

const PROSPECT_TYPE_OPTIONS = [
  { value: "ALL", label: "All Prospect Types" },
  { value: "Elite", label: "Elite" },
  { value: "Ordinary", label: "Ordinary" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Wrong Contact", label: "Wrong Contact" },
  { value: "Dropped", label: "Dropped" },
];

const DEFAULT_DASHBOARD = {
  totals: { prospects: 0, policyholders: 0, engagements: 0, leads: 0 },
  filters: { datePreset: "ALL", source: "ALL", marketType: "ALL", prospectType: "ALL", status: "ALL" },
  conversionRatePct: 0,
  warmRatePct: 0,
  sourceRatePct: 0,
  activePolicyRatePct: 0,
  prospectMix: { warm: 0, cold: 0, elite: 0, ordinary: 0, agentSourced: 0, systemAssigned: 0 },
  prospectStatusCounts: [],
  policyStatusCounts: { active: 0, lapsed: 0, cancelled: 0 },
  stageProgress: [],
  sourceConversion: [],
  marketConversion: [],
  trendSeries: { prospects: [], policyholders: [] },
  recentProspects: [],
  reportContext: { periodLabel: "All available records", generatedAt: null },
  insights: { topSource: null, weakestStage: null, policyRiskPct: 0 },
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

const formatDate = (value) => {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || value || "All";

function AgentClientsRelationship() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [isReady, setIsReady] = useState(false);
  const [dashboardData, setDashboardData] = useState(DEFAULT_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState({
    datePreset: "ALL",
    source: "ALL",
    marketType: "ALL",
    prospectType: "ALL",
    status: "ALL",
  });

  useEffect(() => {
    if (!user || user.username !== username) {
      setIsReady(false);
      navigate("/", { replace: true });
      return;
    }
    setIsReady(true);
  }, [user, username, navigate]);

  useEffect(() => {
    if (user) document.title = `${user.username} | Clients Relationship`;
  }, [user]);

  const fetchDashboard = useCallback(
    async (signal) => {
      if (!user?.id) return;

      const params = new URLSearchParams({
        userId: user.id,
        datePreset: filters.datePreset,
        source: filters.source,
        marketType: filters.marketType,
        prospectType: filters.prospectType,
        status: filters.status,
      });

      const res = await fetch(`http://localhost:5000/api/clients/relationship/dashboard?${params.toString()}`, {
        signal,
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message || "Failed to load dashboard metrics.");
      setDashboardData({ ...DEFAULT_DASHBOARD, ...payload });
      setLastUpdated(new Date());
    },
    [filters, user?.id]
  );

  useEffect(() => {
    if (!isReady || !user?.id) return;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchDashboard(controller.signal);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setApiError(err?.message || "Failed to load dashboard metrics.");
          setDashboardData(DEFAULT_DASHBOARD);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [isReady, user?.id, fetchDashboard]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const dashboard = useMemo(() => {
    const totals = dashboardData?.totals || {};
    const prospectMix = dashboardData?.prospectMix || {};
    const policyStatus = dashboardData?.policyStatusCounts || {};

    return {
      totalProspects: Number(totals.prospects || 0),
      totalPolicyholders: Number(totals.policyholders || 0),
      totalLeads: Number(totals.leads || 0),
      totalEngagements: Number(totals.engagements || 0),
      warm: Number(prospectMix.warm || 0),
      cold: Number(prospectMix.cold || 0),
      elite: Number(prospectMix.elite || 0),
      ordinary: Number(prospectMix.ordinary || 0),
      systemAssigned: Number(prospectMix.systemAssigned || 0),
      agentSourced: Number(prospectMix.agentSourced || 0),
      statusCounts: Array.isArray(dashboardData?.prospectStatusCounts) ? dashboardData.prospectStatusCounts : [],
      activePolicies: Number(policyStatus.active || 0),
      lapsedPolicies: Number(policyStatus.lapsed || 0),
      cancelledPolicies: Number(policyStatus.cancelled || 0),
      conversionRate: Number(dashboardData?.conversionRatePct || 0),
      warmRate: Number(dashboardData?.warmRatePct || 0),
      activePolicyRate: Number(dashboardData?.activePolicyRatePct || 0),
      sourceRate: Number(dashboardData?.sourceRatePct || 0),
      stageProgress: Array.isArray(dashboardData?.stageProgress) ? dashboardData.stageProgress : [],
      sourceConversion: Array.isArray(dashboardData?.sourceConversion) ? dashboardData.sourceConversion : [],
      marketConversion: Array.isArray(dashboardData?.marketConversion) ? dashboardData.marketConversion : [],
      prospectTrend: Array.isArray(dashboardData?.trendSeries?.prospects) ? dashboardData.trendSeries.prospects : [],
      policyholderTrend: Array.isArray(dashboardData?.trendSeries?.policyholders) ? dashboardData.trendSeries.policyholders : [],
      recentProspects: Array.isArray(dashboardData?.recentProspects) ? dashboardData.recentProspects : [],
      reportContext: dashboardData?.reportContext || DEFAULT_DASHBOARD.reportContext,
      insights: dashboardData?.insights || DEFAULT_DASHBOARD.insights,
      maxTrendValue: Math.max(
        1,
        ...(Array.isArray(dashboardData?.trendSeries?.prospects) ? dashboardData.trendSeries.prospects.map((item) => Number(item?.value || 0)) : []),
        ...(Array.isArray(dashboardData?.trendSeries?.policyholders) ? dashboardData.trendSeries.policyholders.map((item) => Number(item?.value || 0)) : [])
      ),
    };
  }, [dashboardData]);

  const insights = useMemo(() => {
    const topSource = dashboard.insights?.topSource;
    const weakestStage = dashboard.insights?.weakestStage;
    const sourceMessage = topSource
      ? `${topSource.label} converts at ${topSource.conversionRatePct}% (${topSource.policyholders}/${topSource.prospects}).`
      : "No source conversion pattern available yet.";
    const stageMessage = weakestStage
      ? `${weakestStage.label} has the lightest pipeline presence with ${weakestStage.count} engagements.`
      : "No stage data available yet.";
    const riskMessage = `${Number(dashboard.insights?.policyRiskPct || 0)}% of policyholders are lapsed or cancelled.`;
    return [
      { title: "Best Conversion Source", body: sourceMessage },
      { title: "Thinnest Pipeline Stage", body: stageMessage },
      { title: "Policy Relationship Risk", body: riskMessage },
    ];
  }, [dashboard]);

  const sourceChartStyle = useMemo(() => {
    const total = dashboard.agentSourced + dashboard.systemAssigned || 1;
    const agentAngle = Math.round((dashboard.agentSourced / total) * 360);
    return {
      background: `conic-gradient(#da291c 0deg ${agentAngle}deg, #2f80ed ${agentAngle}deg 360deg)`,
    };
  }, [dashboard.agentSourced, dashboard.systemAssigned]);

  const policyChartStyle = useMemo(() => {
    const total = dashboard.activePolicies + dashboard.lapsedPolicies + dashboard.cancelledPolicies || 1;
    const activeAngle = Math.round((dashboard.activePolicies / total) * 360);
    const lapsedAngle = activeAngle + Math.round((dashboard.lapsedPolicies / total) * 360);
    return {
      background: `conic-gradient(#1f9d55 0deg ${activeAngle}deg, #f59e0b ${activeAngle}deg ${lapsedAngle}deg, #6b7280 ${lapsedAngle}deg 360deg)`,
    };
  }, [dashboard.activePolicies, dashboard.cancelledPolicies, dashboard.lapsedPolicies]);

  const generatePdfReport = () => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const reportFilename = `${user?.username || "Agent"} - Client Relationship Report`;
    const previousDocumentTitle = document.title;
    const now = new Date();
    const chunk = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const sourceRows = dashboard.sourceConversion
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${Number(row.prospects || 0)}</td>
            <td>${Number(row.policyholders || 0)}</td>
            <td>${Number(row.conversionRatePct || 0)}%</td>
          </tr>
        `
      )
      .join("");

    const marketRows = dashboard.marketConversion
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${Number(row.prospects || 0)}</td>
            <td>${Number(row.policyholders || 0)}</td>
            <td>${Number(row.conversionRatePct || 0)}%</td>
          </tr>
        `
      )
      .join("");

    const stageRows = dashboard.stageProgress
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${Number(row.count || 0)}</td>
            <td>${Number(row.value || 0)}%</td>
          </tr>
        `
      )
      .join("");

    const trendRows = dashboard.prospectTrend
      .map((point, index) => {
        const matchingPolicy = dashboard.policyholderTrend[index];
        return `
          <tr>
            <td>${escapeHtml(point.label)}</td>
            <td>${Number(point.value || 0)}</td>
            <td>${Number(matchingPolicy?.value || 0)}</td>
          </tr>
        `;
      })
      .join("");

    const recentChunks = chunk(dashboard.recentProspects, 14);
    const pages = [];

    pages.push(`
      <section class="pdf-page first-page">
        <div class="header-band"></div>
        <section class="section">
          <div class="top-grid">
            <div>
              <h1 class="report-title">Client Relationship Dashboard Report</h1>
              <div class="report-period">${escapeHtml(dashboard.reportContext?.periodLabel || "All available records")}</div>
              <div class="muted-line">Generated: ${escapeHtml(formatDateTime(now))}</div>
            </div>
            <div class="details-card">
              <h3>Agent Details</h3>
              <div class="details-grid">
                <div class="detail-item"><b>Agent Code</b>${escapeHtml(user?.username || "—")}</div>
                <div class="detail-item"><b>Agent Type</b>${escapeHtml(user?.agentType || "—")}</div>
                <div class="detail-item"><b>First Name</b>${escapeHtml(user?.firstName || "—")}</div>
                <div class="detail-item"><b>Middle Name</b>${escapeHtml(user?.middleName || "—")}</div>
                <div class="detail-item"><b>Last Name</b>${escapeHtml(user?.lastName || "—")}</div>
                <div class="detail-item"><b>Unit</b>${escapeHtml(user?.unitName || "—")}</div>
                <div class="detail-item"><b>Branch</b>${escapeHtml(user?.branchName || "—")}</div>
                <div class="detail-item"><b>Area</b>${escapeHtml(user?.areaName || "—")}</div>
              </div>
            </div>
          </div>
        </section>
        <section class="section">
          <div class="meta-row">
            <div class="meta-chip"><div class="label">Date Range</div><div class="value">${escapeHtml(getOptionLabel(DATE_PRESETS, filters.datePreset))}</div></div>
            <div class="meta-chip"><div class="label">Source</div><div class="value">${escapeHtml(getOptionLabel(SOURCE_OPTIONS, filters.source))}</div></div>
            <div class="meta-chip"><div class="label">Market Type</div><div class="value">${escapeHtml(getOptionLabel(MARKET_OPTIONS, filters.marketType))}</div></div>
            <div class="meta-chip"><div class="label">Prospect Status</div><div class="value">${escapeHtml(getOptionLabel(STATUS_OPTIONS, filters.status))}</div></div>
          </div>
        </section>
        <section class="section">
          <div class="kpi-grid">
            <div class="kpi primary"><div class="label">Total Prospects</div><div class="val">${dashboard.totalProspects}</div></div>
            <div class="kpi"><div class="label">Total Leads</div><div class="val">${dashboard.totalLeads}</div></div>
            <div class="kpi secondary"><div class="label">Policyholders</div><div class="val">${dashboard.totalPolicyholders}</div></div>
            <div class="kpi"><div class="label">Active Engagements</div><div class="val">${dashboard.totalEngagements}</div></div>
            <div class="kpi info"><div class="label">Conversion Rate</div><div class="val">${dashboard.conversionRate}%</div></div>
            <div class="kpi accent"><div class="label">Warm Prospect Rate</div><div class="val">${dashboard.warmRate}%</div></div>
            <div class="kpi secondary"><div class="label">Agent-Sourced Rate</div><div class="val">${dashboard.sourceRate}%</div></div>
            <div class="kpi primary"><div class="label">Active Policyholder Rate</div><div class="val">${dashboard.activePolicyRate}%</div></div>
          </div>
        </section>
        <section class="section">
          <h2 class="section-title">Key Insights</h2>
          <div class="insight-grid">
            ${insights.map((item) => `<div class="insight-card"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.body)}</p></div>`).join("")}
          </div>
        </section>
      </section>
    `);

    pages.push(`
      <section class="pdf-page">
        <section class="section compact-top">
          <h2 class="section-title">Conversion Mix</h2>
          <div class="analytics-grid">
            <div class="panel">
              <h4>Source Conversion</h4>
              <table>
                <thead><tr><th>Source</th><th>Prospects</th><th>Policyholders</th><th>Conversion</th></tr></thead>
                <tbody>${sourceRows || '<tr><td colspan="4">No source conversion data available.</td></tr>'}</tbody>
              </table>
            </div>
            <div class="panel">
              <h4>Market Conversion</h4>
              <table>
                <thead><tr><th>Market</th><th>Prospects</th><th>Policyholders</th><th>Conversion</th></tr></thead>
                <tbody>${marketRows || '<tr><td colspan="4">No market conversion data available.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </section>
        <section class="section compact-top">
          <h2 class="section-title">Pipeline + Trend Summary</h2>
          <div class="analytics-grid">
            <div class="panel">
              <h4>Relationship Pipeline</h4>
              <table>
                <thead><tr><th>Stage</th><th>Engagements</th><th>Share</th></tr></thead>
                <tbody>${stageRows || '<tr><td colspan="3">No stage data available.</td></tr>'}</tbody>
              </table>
            </div>
            <div class="panel">
              <h4>Trend Overview</h4>
              <table>
                <thead><tr><th>Period</th><th>Prospects</th><th>Policyholders</th></tr></thead>
                <tbody>${trendRows || '<tr><td colspan="3">No trend data available.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </section>
      </section>
    `);

    if (!recentChunks.length) {
      pages.push(`
        <section class="pdf-page">
          <section class="section compact-top">
            <h2 class="section-title">Recent Prospects</h2>
            <table>
              <thead><tr><th>Prospect Code</th><th>Name</th><th>Market</th><th>Type</th><th>Source</th><th>Status</th><th>Policyholders</th><th>Created</th></tr></thead>
              <tbody><tr><td colspan="8">No recent prospects available for the selected filters.</td></tr></tbody>
            </table>
          </section>
        </section>
      `);
    } else {
      recentChunks.forEach((rows) => {
        pages.push(`
          <section class="pdf-page">
            <section class="section compact-top">
              <h2 class="section-title">Recent Prospects</h2>
              <table>
                <thead><tr><th>Prospect Code</th><th>Name</th><th>Market</th><th>Type</th><th>Source</th><th>Status</th><th>Policyholders</th><th>Created</th></tr></thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      <td>${escapeHtml(row.prospectCode || "—")}</td>
                      <td>${escapeHtml(row.fullName || "—")}</td>
                      <td>${escapeHtml(row.marketType || "—")}</td>
                      <td>${escapeHtml(row.prospectType || "—")}</td>
                      <td>${escapeHtml(row.source || "—")}</td>
                      <td>${escapeHtml(row.status || "—")}</td>
                      <td>${Number(row.policyholders || 0)}</td>
                      <td>${escapeHtml(formatDate(row.createdAt))}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </section>
          </section>
        `);
      });
    }

    const pagesWithFooters = pages
      .map((pageHtml, index) =>
        pageHtml.replace(
          /<\/section>\s*$/,
          `<div class="report-footer"><div>Generated by PRUTracker • ${escapeHtml(formatDateTime(now))}</div><div>Page ${index + 1} of ${pages.length}</div></div></section>`
        )
      )
      .join("");

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
            .pdf-page { position: relative; min-height: 279mm; padding: 8mm 8mm 14mm; page-break-after: always; overflow: hidden; }
            .pdf-page:last-child { page-break-after: auto; }
            .first-page { padding-top: 6mm; }
            .header-band { height: 8px; background: linear-gradient(90deg, #da291c, #ffb81c, #00539b); border-radius: 6px; margin-bottom: 8px; }
            .top-grid { display:grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 14px; align-items:start; }
            .report-title { margin: 0; color: #991b1b; font-size: 23px; line-height: 1.08; font-weight: 700; }
            .report-period { margin-top: 10px; color: #374151; font-size: 13px; font-weight: 700; }
            .muted-line { margin-top: 6px; color: #6b7280; font-size: 10px; }
            .details-card { border: 1px solid #f3c4c0; background: #fff7f6; border-radius: 10px; padding: 10px 12px; }
            .details-card h3 { margin: 0 0 6px; color: #991b1b; font-size: 12px; text-transform: uppercase; }
            .details-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 5px 14px; }
            .detail-item { font-size: 10px; }
            .detail-item b { color: #6b7280; display:block; font-weight:700; margin-bottom:1px; }
            .meta-row { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 8px; }
            .meta-chip { border: 1px solid #dbe4f0; background: #f8fbff; border-radius: 8px; padding: 6px 8px; }
            .meta-chip .label { color:#6b7280; font-size:10px; }
            .meta-chip .value { color:#111827; font-weight:700; margin-top:2px; }
            .kpi-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
            .kpi { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#ffffff; }
            .kpi.primary { background:#fff5f5; border-color:#f3c4c0; }
            .kpi.secondary { background:#f0fdf4; border-color:#bbf7d0; }
            .kpi.accent { background:#fffbeb; border-color:#fde68a; }
            .kpi.info { background:#eff6ff; border-color:#bfdbfe; }
            .kpi .label { color:#6b7280; font-size:10px; }
            .kpi .val { font-size:18px; font-weight:700; margin-top:2px; color:#111827; }
            .section { margin-bottom: 8px; }
            .compact-top { margin-top: 0; }
            .section-title { margin: 0 0 6px; color: #991b1b; font-size: 14px; font-weight: 700; border-left: 4px solid #da291c; padding-left: 8px; }
            .analytics-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .panel { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#fff; }
            .panel h4 { margin:0 0 6px; color:#111827; font-size:12px; }
            .insight-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .insight-card { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#fff; }
            .insight-card h4 { margin:0 0 6px; color:#111827; font-size:12px; }
            .insight-card p { margin:0; color:#4b5563; font-size:10px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #dfe5ec; padding: 5px 6px; text-align: left; vertical-align: top; }
            th { background: #f3f6fa; color:#374151; }
            tbody tr:nth-child(even) td { background:#fcfcfd; }
            .report-footer { position: absolute; left: 8mm; right: 8mm; bottom: 4mm; font-size: 9px; color: #6b7280; display:flex; justify-content:space-between; align-items:center; border-top: 1px solid #e5e7eb; padding-top: 3px; }
          </style>
        </head>
        <body>${pagesWithFooters}</body>
      </html>
    `);
    reportDoc.close();
    reportDoc.title = reportFilename;

    try {
      iframe.contentWindow.history.replaceState({}, "", "/client-relationship-report");
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

  if (!isReady) return null;

  const handleSideNav = (key) => {
    if (!user) return navigate("/");

    switch (key) {
      case "clients":
        navigate(`/agent/${user.username}/clients`);
        break;
      case "clients_relationship":
        navigate(`/agent/${user.username}/clients/relationship`);
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
      case "tasks_progress":
        navigate(`/agent/${user.username}/tasks/progress`);
        break;
      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;
      case "tasks_workload":
        navigate(`/agent/${user.username}/tasks/workload`);
        break;
      case "sales_performance":
        navigate(`/agent/${user.username}/sales/performance`);
        break;
      case "sales":
        navigate(`/agent/${user.username}/sales/performance`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="cr-page-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="cr-page-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="cr-page-content">
          <div className="cr-headRow">
            <div>
              <h1 className="cr-module-title">Client Relationship Dashboard</h1>
              <p className="cr-module-subtitle">
                Track segment mix, relationship health, conversion quality, and pipeline momentum for your assigned clients.
              </p>
            </div>
            <div className="cr-headActions">
              <span className="cr-lastUpdated">Updated {lastUpdated ? formatDateTime(lastUpdated) : "—"}</span>
              <button className="cr-ghostBtn" onClick={() => fetchDashboard()} disabled={loading}>Refresh</button>
              <button className="cr-reportBtn" onClick={generatePdfReport} disabled={loading}>Generate Report (PDF)</button>
            </div>
          </div>

          <div className="cr-content-card cr-dashboard-card">
            <div className="cr-filterBar">
              <label>
                <span>Date Range</span>
                <select value={filters.datePreset} onChange={(e) => handleFilterChange("datePreset", e.target.value)}>
                  {DATE_PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Source</span>
                <select value={filters.source} onChange={(e) => handleFilterChange("source", e.target.value)}>
                  {SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Market Type</span>
                <select value={filters.marketType} onChange={(e) => handleFilterChange("marketType", e.target.value)}>
                  {MARKET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Prospect Type</span>
                <select value={filters.prospectType} onChange={(e) => handleFilterChange("prospectType", e.target.value)}>
                  {PROSPECT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={filters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            {apiError ? <p className="cr-errorBanner">{apiError}</p> : null}

            <div className="cr-kpis">
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Total Prospects</span>
                <span className="cr-kpiValue">{dashboard.totalProspects}</span>
                <span className="cr-kpiHint">Selected relationship universe</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Total Leads</span>
                <span className="cr-kpiValue">{dashboard.totalLeads}</span>
                <span className="cr-kpiHint">Prospects with lead records</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Total Policyholders</span>
                <span className="cr-kpiValue">{dashboard.totalPolicyholders}</span>
                <span className="cr-kpiHint">Converted relationships</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Active Engagements</span>
                <span className="cr-kpiValue">{dashboard.totalEngagements}</span>
                <span className="cr-kpiHint">Pipeline records in scope</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Prospect → Policyholder</span>
                <span className="cr-kpiValue">{dashboard.conversionRate}%</span>
                <span className="cr-kpiHint">Overall conversion rate</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Active Policyholders</span>
                <span className="cr-kpiValue">{dashboard.activePolicyRate}%</span>
                <span className="cr-kpiHint">Healthy relationship share</span>
              </div>
            </div>

            <div className="cr-grid">
              <section className="cr-panel">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Prospect Creation Trend</h3>
                  <span className="cr-panelMeta">{dashboard.reportContext?.periodLabel || "All available records"}</span>
                </div>
                <div className="cr-trendChart">
                  {dashboard.prospectTrend.map((point) => (
                    <div key={point.label} className="cr-trendCol">
                      <div className="cr-trendBarShell">
                        <div
                          className="cr-trendBar"
                          style={{ height: `${Math.max(8, (Number(point.value || 0) / dashboard.maxTrendValue) * 100)}%` }}
                        />
                      </div>
                      <strong>{point.value}</strong>
                      <span>{point.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cr-panel">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Policyholder Conversion Trend</h3>
                  <span className="cr-panelMeta">Converted relationships by period</span>
                </div>
                <div className="cr-trendChart policy">
                  {dashboard.policyholderTrend.map((point) => (
                    <div key={point.label} className="cr-trendCol">
                      <div className="cr-trendBarShell">
                        <div
                          className="cr-trendBar alt"
                          style={{ height: `${Math.max(8, (Number(point.value || 0) / dashboard.maxTrendValue) * 100)}%` }}
                        />
                      </div>
                      <strong>{point.value}</strong>
                      <span>{point.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cr-panel">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Source Mix</h3>
                  <span className="cr-panelMeta">Agent vs system-assigned prospects</span>
                </div>
                <div className="cr-donutWrap">
                  <div className="cr-donutChart" style={sourceChartStyle}><span>{dashboard.totalProspects}</span></div>
                  <div className="cr-legend">
                    <span><i className="dot agent" />Agent-Sourced ({dashboard.agentSourced})</span>
                    <span><i className="dot system" />System-Assigned ({dashboard.systemAssigned})</span>
                  </div>
                </div>
              </section>

              <section className="cr-panel">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Policyholder Health</h3>
                  <span className="cr-panelMeta">Lifecycle quality of converted clients</span>
                </div>
                <div className="cr-donutWrap">
                  <div className="cr-donutChart" style={policyChartStyle}><span>{dashboard.totalPolicyholders}</span></div>
                  <div className="cr-legend">
                    <span><i className="dot active" />Active ({dashboard.activePolicies})</span>
                    <span><i className="dot lapsed" />Lapsed ({dashboard.lapsedPolicies})</span>
                    <span><i className="dot cancelled" />Cancelled ({dashboard.cancelledPolicies})</span>
                  </div>
                </div>
              </section>

              <section className="cr-panel">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Prospect Relationship Status</h3>
                  <span className="cr-panelMeta">Current quality of prospect records</span>
                </div>
                <div className="cr-barList">
                  {dashboard.statusCounts.map((item) => (
                    <div key={item.status} className="cr-barItem">
                      <div className="cr-barTop"><span>{item.status}</span><strong>{item.value}</strong></div>
                      <div className="cr-progressTrack"><span style={{ width: `${dashboard.totalProspects ? (item.value / dashboard.totalProspects) * 100 : 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cr-panel">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Segment Conversion Comparison</h3>
                  <span className="cr-panelMeta">Warm/cold relationship performance</span>
                </div>
                <div className="cr-compareList">
                  {dashboard.marketConversion.map((row) => (
                    <div key={row.label} className="cr-compareCard">
                      <div className="cr-compareTop">
                        <span>{row.label}</span>
                        <strong>{row.conversionRatePct}%</strong>
                      </div>
                      <p>{row.policyholders}/{row.prospects} converted to policyholders.</p>
                    </div>
                  ))}
                </div>
                <div className="cr-chartRows compact">
                  <div className="cr-rowLabel">Warm vs Cold Share</div>
                  <div className="cr-progressTrack"><span style={{ width: `${dashboard.totalProspects ? (dashboard.warm / dashboard.totalProspects) * 100 : 0}%` }} /></div>
                  <div className="cr-rowMeta">Warm {dashboard.warm} • Cold {dashboard.cold}</div>
                  <div className="cr-rowLabel">Elite vs Ordinary Share</div>
                  <div className="cr-progressTrack alt"><span style={{ width: `${dashboard.totalProspects ? (dashboard.elite / dashboard.totalProspects) * 100 : 0}%` }} /></div>
                  <div className="cr-rowMeta">Elite {dashboard.elite} • Ordinary {dashboard.ordinary}</div>
                </div>
              </section>

              <section className="cr-panel cr-panel-wide">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Relationship Pipeline Progress</h3>
                  <span className="cr-panelMeta">Active engagement mix by stage</span>
                </div>
                <div className="cr-stageGrid">
                  {dashboard.stageProgress.map((stage) => (
                    <div key={stage.label} className="cr-stageCard">
                      <div className="cr-stageTop">
                        <span>{stage.label}</span>
                        <strong>{stage.value}%</strong>
                      </div>
                      <div className="cr-progressTrack stage"><span style={{ width: `${stage.value}%` }} /></div>
                      <small>{stage.count} engagements</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cr-panel cr-panel-wide">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Source Conversion Quality</h3>
                  <span className="cr-panelMeta">How each acquisition source converts</span>
                </div>
                <div className="cr-sourceGrid">
                  {dashboard.sourceConversion.map((row) => (
                    <div key={row.label} className="cr-sourceCard">
                      <div className="cr-sourceTop">
                        <span>{row.label}</span>
                        <strong>{row.conversionRatePct}%</strong>
                      </div>
                      <div className="cr-progressTrack stage"><span style={{ width: `${row.conversionRatePct}%` }} /></div>
                      <p>{row.policyholders} policyholders from {row.prospects} prospects</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="cr-panel cr-panel-wide">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Dashboard Insights</h3>
                  <span className="cr-panelMeta">Actionable reading of current relationship health</span>
                </div>
                <div className="cr-insightGrid">
                  {insights.map((item) => (
                    <article key={item.title} className="cr-insightCard">
                      <h4>{item.title}</h4>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="cr-panel cr-panel-wide">
                <div className="cr-panelHeader">
                  <h3 className="cr-panelTitle">Recent Prospects in Scope</h3>
                  <span className="cr-panelMeta">Most recently created relationship records for the current filters</span>
                </div>
                <div className="cr-tableWrap">
                  <table className="cr-table">
                    <thead>
                      <tr>
                        <th>Prospect Code</th>
                        <th>Name</th>
                        <th>Market</th>
                        <th>Type</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th>Policyholders</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentProspects.length ? (
                        dashboard.recentProspects.map((row) => (
                          <tr key={`${row.prospectCode}-${row.createdAt}`}>
                            <td>{row.prospectCode || "—"}</td>
                            <td>{row.fullName || "—"}</td>
                            <td>{row.marketType || "—"}</td>
                            <td>{row.prospectType || "—"}</td>
                            <td>{row.source || "—"}</td>
                            <td>{row.status || "—"}</td>
                            <td>{row.policyholders || 0}</td>
                            <td>{formatDate(row.createdAt)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="cr-emptyCell">No prospects found for the selected filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {loading ? <p className="cr-muted cr-loadingNote">Loading dashboard metrics…</p> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentClientsRelationship;
