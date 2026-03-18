import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentSalesPerformance.css";

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

function AgentSalesPerformance() {
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
  const [lastUpdated, setLastUpdated] = useState(null);
  const [data, setData] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    conversionRatePct: 0,
    totalAnnualPremiumPhp: 0,
    totalFrequencyPremiumPhp: 0,
    frequencyPremiumBreakdown: {
      monthlyPremiumPhp: 0,
      quarterlyPremiumPhp: 0,
      halfYearlyPremiumPhp: 0,
      yearlyPremiumPhp: 0,
    },
    activePolicies: 0,
    lapsedPolicies: 0,
    cancelledPolicies: 0,
    conversionBySource: { "Agent-Sourced": 0, "System-Assigned": 0 },
    monthlyConvertedLeads: [],
  });

  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Sales Performance`;
  }, [username]);

  const fetchData = useCallback(async (signal) => {
    if (!user?.id) return;
    const res = await fetch(`http://localhost:5000/api/sales/performance?userId=${user.id}`, signal ? { signal } : undefined);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.message || "Failed to load sales performance.");
    setData(payload || {});
    setLastUpdated(new Date());
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchData(controller.signal);
      } catch (err) {
        if (err?.name !== "AbortError") setApiError(err?.message || "Cannot connect to server.");
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [user?.id, fetchData]);

  const money = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sourceTotal = Number(data?.conversionBySource?.["Agent-Sourced"] || 0) + Number(data?.conversionBySource?.["System-Assigned"] || 0);
  const sourceAgentPct = sourceTotal ? Math.round((Number(data?.conversionBySource?.["Agent-Sourced"] || 0) / sourceTotal) * 100) : 0;

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setApiError("");
      await fetchData();
    } catch (err) {
      setApiError(err?.message || "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const generatePdfReport = () => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const reportFilename = `${user?.username || "Agent"} - Agent Sales Performance Report`;
    const previousDocumentTitle = document.title;
    const now = new Date();
    const trendRows = Array.isArray(data.monthlyConvertedLeads)
      ? data.monthlyConvertedLeads.map((row) => `
          <tr>
            <td>${escapeHtml(row.month)}</td>
            <td>${Number(row.converted || 0)}</td>
          </tr>
        `).join("")
      : "";

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
            .header-band { height: 8px; background: linear-gradient(90deg, #da291c, #ffb81c, #00539b); border-radius: 6px; margin-bottom: 8px; }
            .top-grid { display:grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 14px; align-items:start; }
            .report-title { margin: 0; color: #991b1b; font-size: 23px; line-height: 1.08; font-weight: 700; }
            .report-period { margin-top: 10px; color: #374151; font-size: 13px; font-weight: 700; }
            .details-card { border: 1px solid #f3c4c0; background: #fff7f6; border-radius: 10px; padding: 10px 12px; }
            .details-card h3 { margin: 0 0 6px; color: #991b1b; font-size: 12px; text-transform: uppercase; }
            .details-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 5px 14px; }
            .detail-item { font-size: 10px; }
            .detail-item b { color: #6b7280; display:block; font-weight:700; margin-bottom:1px; }
            .kpi-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
            .kpi { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#ffffff; }
            .kpi .label { color:#6b7280; font-size:10px; }
            .kpi .val { font-size:18px; font-weight:700; margin-top:2px; color:#111827; }
            .section { margin-bottom: 8px; }
            .section-title { margin: 0 0 6px; color: #991b1b; font-size: 14px; font-weight: 700; border-left: 4px solid #da291c; padding-left: 8px; }
            .analytics-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
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
            <section class="section">
              <div class="top-grid">
                <div>
                  <h1 class="report-title">Agent Sales Performance Report</h1>
                  <div class="report-period">Report Period: Last 6 months performance snapshot</div>
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
              <div class="kpi-grid">
                <div class="kpi"><div class="label">Total Leads</div><div class="val">${Number(data.totalLeads || 0)}</div></div>
                <div class="kpi"><div class="label">Converted Leads</div><div class="val">${Number(data.convertedLeads || 0)}</div></div>
                <div class="kpi"><div class="label">Conversion Rate</div><div class="val">${Number(data.conversionRatePct || 0)}%</div></div>
                <div class="kpi"><div class="label">Total Annual Premium</div><div class="val">₱ ${escapeHtml(money(data.totalAnnualPremiumPhp))}</div></div>
                <div class="kpi"><div class="label">Total Frequency Premium</div><div class="val">₱ ${escapeHtml(money(data.totalFrequencyPremiumPhp))}</div></div>
                <div class="kpi"><div class="label">Active Policies</div><div class="val">${Number(data.activePolicies || 0)}</div></div>
              </div>
            </section>
            <section class="section">
              <h2 class="section-title">Premium + Policy Breakdown</h2>
              <div class="analytics-grid">
                <div class="panel">
                  <h4>Frequency Premium Breakdown</h4>
                  <table>
                    <thead><tr><th>Frequency</th><th>Amount</th></tr></thead>
                    <tbody>
                      <tr><td>Monthly</td><td>₱ ${escapeHtml(money(data?.frequencyPremiumBreakdown?.monthlyPremiumPhp))}</td></tr>
                      <tr><td>Quarterly</td><td>₱ ${escapeHtml(money(data?.frequencyPremiumBreakdown?.quarterlyPremiumPhp))}</td></tr>
                      <tr><td>Half-yearly</td><td>₱ ${escapeHtml(money(data?.frequencyPremiumBreakdown?.halfYearlyPremiumPhp))}</td></tr>
                      <tr><td>Yearly</td><td>₱ ${escapeHtml(money(data?.frequencyPremiumBreakdown?.yearlyPremiumPhp))}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div class="panel">
                  <h4>Policy Status Mix</h4>
                  <table>
                    <thead><tr><th>Status</th><th>Count</th></tr></thead>
                    <tbody>
                      <tr><td>Active</td><td>${Number(data.activePolicies || 0)}</td></tr>
                      <tr><td>Lapsed</td><td>${Number(data.lapsedPolicies || 0)}</td></tr>
                      <tr><td>Cancelled</td><td>${Number(data.cancelledPolicies || 0)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            <section class="section">
              <h2 class="section-title">Source + Trend</h2>
              <div class="analytics-grid">
                <div class="panel">
                  <h4>Converted Leads by Source</h4>
                  <table>
                    <thead><tr><th>Source</th><th>Converted Leads</th></tr></thead>
                    <tbody>
                      <tr><td>Agent-Sourced</td><td>${Number(data?.conversionBySource?.["Agent-Sourced"] || 0)}</td></tr>
                      <tr><td>System-Assigned</td><td>${Number(data?.conversionBySource?.["System-Assigned"] || 0)}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div class="panel">
                  <h4>Converted Leads Trend (Last 6 Months)</h4>
                  <table>
                    <thead><tr><th>Month</th><th>Converted Leads</th></tr></thead>
                    <tbody>${trendRows || '<tr><td colspan="2">No conversion trend data yet.</td></tr>'}</tbody>
                  </table>
                </div>
              </div>
            </section>
            <div class="report-footer"><div>Generated by PRUTracker • ${escapeHtml(formatDateTime(now))}</div><div>Page 1 of 1</div></div>
          </section>
        </body>
      </html>
    `);
    reportDoc.close();
    reportDoc.title = reportFilename;

    try {
      iframe.contentWindow.history.replaceState({}, "", "/agent-sales-performance-report");
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
      case "sales": navigate(`/agent/${user.username}/sales/performance`); break;
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;
      default: break;
    }
  };

  if (!user || user.username !== username) return null;

  return (
    <div className="sp-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="sp-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="sp-content">
          <div className="sp-headRow">
            <div>
              <h1 className="sp-title">Sales Performance Dashboard</h1>
              <p className="sp-subtitle">
                Track conversion quality, premium production, source mix, and recent conversion trends across your sales performance data.
              </p>
            </div>
            <div className="sp-headActions">
              <span className="sp-lastUpdated">Updated {lastUpdated ? formatDateTime(lastUpdated) : "—"}</span>
              <button className="sp-refreshBtn" onClick={handleRefresh} disabled={loading}>Refresh</button>
              <button className="sp-reportBtn" onClick={generatePdfReport} disabled={loading}>Generate Report (PDF)</button>
            </div>
          </div>

          <div className="sp-kpis">
            <div className="sp-kpi"><span>Total Leads</span><strong>{data.totalLeads || 0}</strong></div>
            <div className="sp-kpi"><span>Converted Leads</span><strong>{data.convertedLeads || 0}</strong></div>
            <div className="sp-kpi"><span>Conversion Rate</span><strong>{data.conversionRatePct || 0}%</strong></div>
            <div className="sp-kpi"><span>Total Annual Premium</span><strong>₱ {money(data.totalAnnualPremiumPhp)}</strong></div>
            <div className="sp-kpi"><span>Total Frequency Premium</span><strong>₱ {money(data.totalFrequencyPremiumPhp)}</strong></div>
          </div>

          <section className="sp-card sp-frequencyCard">
            <h3>Total Frequency Premium Breakdown</h3>
            <div className="sp-frequencyGrid">
              <div><span>Total Monthly Premium</span><strong>₱ {money(data?.frequencyPremiumBreakdown?.monthlyPremiumPhp)}</strong></div>
              <div><span>Total Quarterly Premium</span><strong>₱ {money(data?.frequencyPremiumBreakdown?.quarterlyPremiumPhp)}</strong></div>
              <div><span>Total Half-yearly Premium</span><strong>₱ {money(data?.frequencyPremiumBreakdown?.halfYearlyPremiumPhp)}</strong></div>
              <div><span>Total Yearly Premium</span><strong>₱ {money(data?.frequencyPremiumBreakdown?.yearlyPremiumPhp)}</strong></div>
            </div>
          </section>

          <div className="sp-grid">
            <section className="sp-card">
              <h3>Lead Conversion Progress</h3>
              <div className="sp-progressRow">
                <label>Converted vs Total Leads</label>
                <div className="sp-track"><span style={{ width: `${data.conversionRatePct || 0}%` }} /></div>
                <b>{data.conversionRatePct || 0}%</b>
              </div>
            </section>

            <section className="sp-card">
              <h3>Converted Leads by Source</h3>
              <div className="sp-stackBar">
                <span className="agent" style={{ width: `${sourceAgentPct}%` }} />
                <span className="system" style={{ width: `${100 - sourceAgentPct}%` }} />
              </div>
              <div className="sp-legend">
                <span><i className="dot agent" />Agent-Sourced ({data?.conversionBySource?.["Agent-Sourced"] || 0})</span>
                <span><i className="dot system" />System-Assigned ({data?.conversionBySource?.["System-Assigned"] || 0})</span>
              </div>
            </section>

            <section className="sp-card">
              <h3>Policy Status Mix</h3>
              <div className="sp-statusGrid">
                <div><span>Active</span><strong>{data.activePolicies || 0}</strong></div>
                <div><span>Lapsed</span><strong>{data.lapsedPolicies || 0}</strong></div>
                <div><span>Cancelled</span><strong>{data.cancelledPolicies || 0}</strong></div>
              </div>
            </section>

            <section className="sp-card sp-wide">
              <h3>Converted Leads Trend (Last 6 Months)</h3>
              {Array.isArray(data.monthlyConvertedLeads) && data.monthlyConvertedLeads.length > 0 ? (
                <div className="sp-bars">
                  {data.monthlyConvertedLeads.map((m) => {
                    const max = Math.max(...data.monthlyConvertedLeads.map((x) => Number(x.converted || 0)), 1);
                    const pct = Math.round((Number(m.converted || 0) / max) * 100);
                    return (
                      <div key={m.month} className="sp-barCol">
                        <div className="sp-barWrap"><span style={{ height: `${pct}%` }} /></div>
                        <strong>{m.converted || 0}</strong>
                        <small>{m.month}</small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="sp-muted">No conversion trend data yet.</p>
              )}
            </section>
          </div>

          {loading && <p className="sp-muted" style={{ marginTop: 10 }}>Loading sales performance…</p>}
          {!loading && apiError && <p className="sp-muted" style={{ color: "#DA291C", marginTop: 10 }}>{apiError}</p>}
        </main>
      </div>
    </div>
  );
}

export default AgentSalesPerformance;
