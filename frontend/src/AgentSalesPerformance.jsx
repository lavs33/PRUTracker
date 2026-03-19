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

const formatMonthLabel = (value) => {
  const [year, month] = String(value || "").split("-");
  const dt = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return Number.isNaN(dt.getTime())
    ? String(value || "—")
    : dt.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
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
    unconvertedLeads: 0,
    conversionRatePct: 0,
    totalPolicies: 0,
    activePolicyRatePct: 0,
    totalAnnualPremiumPhp: 0,
    totalFrequencyPremiumPhp: 0,
    averageAnnualPremiumPerConvertedLeadPhp: 0,
    averageFrequencyPremiumPerConvertedLeadPhp: 0,
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
    leadSourceBreakdown: {
      "Agent-Sourced": { totalLeads: 0, convertedLeads: 0, conversionRatePct: 0 },
      "System-Assigned": { totalLeads: 0, convertedLeads: 0, conversionRatePct: 0 },
      Unknown: { totalLeads: 0, convertedLeads: 0, conversionRatePct: 0 },
    },
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
  const totalPolicies = Number(data?.totalPolicies || 0);
  const sourceTotal = Number(data?.conversionBySource?.["Agent-Sourced"] || 0) + Number(data?.conversionBySource?.["System-Assigned"] || 0);
  const sourceAgentPct = sourceTotal ? Math.round((Number(data?.conversionBySource?.["Agent-Sourced"] || 0) / sourceTotal) * 100) : 0;
  const premiumBreakdownRows = [
    { key: "monthlyPremiumPhp", label: "Monthly" },
    { key: "quarterlyPremiumPhp", label: "Quarterly" },
    { key: "halfYearlyPremiumPhp", label: "Half-yearly" },
    { key: "yearlyPremiumPhp", label: "Yearly" },
  ].map((item) => {
    const amount = Number(data?.frequencyPremiumBreakdown?.[item.key] || 0);
    const sharePct = Number(data?.totalFrequencyPremiumPhp || 0)
      ? Math.round((amount / Number(data.totalFrequencyPremiumPhp)) * 100)
      : 0;
    return { ...item, amount, sharePct };
  });
  const sourcePerformanceRows = [
    ["Agent-Sourced", data?.leadSourceBreakdown?.["Agent-Sourced"]],
    ["System-Assigned", data?.leadSourceBreakdown?.["System-Assigned"]],
    ["Unknown", data?.leadSourceBreakdown?.Unknown],
  ];
  const bestTrendMonth = Array.isArray(data?.monthlyConvertedLeads) && data.monthlyConvertedLeads.length > 0
    ? data.monthlyConvertedLeads.reduce(
        (best, current) => (Number(current?.converted || 0) > Number(best?.converted || 0) ? current : best),
        data.monthlyConvertedLeads[0]
      )
    : null;
  const trendMax = Math.max(
    ...(Array.isArray(data?.monthlyConvertedLeads) ? data.monthlyConvertedLeads.map((x) => Number(x?.converted || 0)) : [0]),
    1
  );
  const kpis = [
    { label: "Total Leads", value: data.totalLeads || 0 },
    { label: "Converted Leads", value: data.convertedLeads || 0 },
    { label: "Unconverted Leads", value: data.unconvertedLeads || 0 },
    { label: "Conversion Rate", value: `${data.conversionRatePct || 0}%` },
    { label: "Total Policies", value: data.totalPolicies || 0 },
    { label: "Active Policy Rate", value: `${data.activePolicyRatePct || 0}%` },
    { label: "Total Annual Premium", value: `₱ ${money(data.totalAnnualPremiumPhp)}` },
    { label: "Avg Annual Premium / Converted Lead", value: `₱ ${money(data.averageAnnualPremiumPerConvertedLeadPhp)}` },
  ];

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
            <td>${escapeHtml(formatMonthLabel(row.month))}</td>
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
            .kpi-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
            .kpi { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#ffffff; }
            .kpi .label { color:#6b7280; font-size:10px; }
            .kpi .val { font-size:16px; font-weight:700; margin-top:2px; color:#111827; }
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
                ${kpis.map((item) => `
                  <div class="kpi">
                    <div class="label">${escapeHtml(item.label)}</div>
                    <div class="val">${escapeHtml(item.value)}</div>
                  </div>
                `).join("")}
              </div>
            </section>
            <section class="section">
              <h2 class="section-title">Premium + Policy Breakdown</h2>
              <div class="analytics-grid">
                <div class="panel">
                  <h4>Frequency Premium Breakdown</h4>
                  <table>
                    <thead><tr><th>Frequency</th><th>Amount</th><th>Share</th></tr></thead>
                    <tbody>
                      ${premiumBreakdownRows.map((row) => `
                        <tr>
                          <td>${escapeHtml(row.label)}</td>
                          <td>₱ ${escapeHtml(money(row.amount))}</td>
                          <td>${row.sharePct}%</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
                <div class="panel">
                  <h4>Policy Status Mix</h4>
                  <table>
                    <thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead>
                    <tbody>
                      <tr><td>Active</td><td>${Number(data.activePolicies || 0)}</td><td>${totalPolicies ? Math.round((Number(data.activePolicies || 0) / totalPolicies) * 100) : 0}%</td></tr>
                      <tr><td>Lapsed</td><td>${Number(data.lapsedPolicies || 0)}</td><td>${totalPolicies ? Math.round((Number(data.lapsedPolicies || 0) / totalPolicies) * 100) : 0}%</td></tr>
                      <tr><td>Cancelled</td><td>${Number(data.cancelledPolicies || 0)}</td><td>${totalPolicies ? Math.round((Number(data.cancelledPolicies || 0) / totalPolicies) * 100) : 0}%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            <section class="section">
              <h2 class="section-title">Source + Trend</h2>
              <div class="analytics-grid">
                <div class="panel">
                  <h4>Lead Source Performance</h4>
                  <table>
                    <thead><tr><th>Source</th><th>Total Leads</th><th>Converted</th><th>Rate</th></tr></thead>
                    <tbody>
                      ${sourcePerformanceRows.map(([label, metrics]) => `
                        <tr>
                          <td>${escapeHtml(label)}</td>
                          <td>${Number(metrics?.totalLeads || 0)}</td>
                          <td>${Number(metrics?.convertedLeads || 0)}</td>
                          <td>${Number(metrics?.conversionRatePct || 0)}%</td>
                        </tr>
                      `).join("")}
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
                Track conversion quality, premium production, source efficiency, and policy health with a clearer sales snapshot.
              </p>
            </div>
            <div className="sp-headActions">
              <span className="sp-lastUpdated">Updated {lastUpdated ? formatDateTime(lastUpdated) : "—"}</span>
              <button className="sp-refreshBtn" onClick={handleRefresh} disabled={loading}>Refresh</button>
              <button className="sp-reportBtn" onClick={generatePdfReport} disabled={loading}>Generate Report (PDF)</button>
            </div>
          </div>

          <section className="sp-highlights">
            <div className="sp-highlight">
              <span>Lead Gap</span>
              <strong>{data.unconvertedLeads || 0}</strong>
              <small>Leads still to convert from your current book.</small>
            </div>
            <div className="sp-highlight">
              <span>Best Conversion Month</span>
              <strong>{bestTrendMonth ? formatMonthLabel(bestTrendMonth.month) : "—"}</strong>
              <small>{bestTrendMonth ? `${bestTrendMonth.converted || 0} converted leads` : "No trend data yet."}</small>
            </div>
            <div className="sp-highlight">
              <span>Policy Health</span>
              <strong>{data.activePolicyRatePct || 0}% active</strong>
              <small>{data.activePolicies || 0} active out of {data.totalPolicies || 0} total policies.</small>
            </div>
          </section>

          <div className="sp-kpis">
            {kpis.map((item) => (
              <div key={item.label} className="sp-kpi">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <section className="sp-card sp-frequencyCard">
            <div className="sp-cardHeader">
              <div>
                <h3>Total Frequency Premium Breakdown</h3>
                <p>See where recurring premium volume is concentrated.</p>
              </div>
              <strong className="sp-cardTotal">₱ {money(data.totalFrequencyPremiumPhp)}</strong>
            </div>
            <div className="sp-frequencyGrid">
              {premiumBreakdownRows.map((row) => (
                <div key={row.key}>
                  <span>{row.label} Premium</span>
                  <strong>₱ {money(row.amount)}</strong>
                  <small>{row.sharePct}% of total frequency premium</small>
                </div>
              ))}
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
              <p className="sp-footnote">{data.convertedLeads || 0} converted leads from {data.totalLeads || 0} total leads.</p>
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
                <div>
                  <span>Active</span>
                  <strong>{data.activePolicies || 0}</strong>
                  <small>{totalPolicies ? Math.round((Number(data.activePolicies || 0) / totalPolicies) * 100) : 0}% of policies</small>
                </div>
                <div>
                  <span>Lapsed</span>
                  <strong>{data.lapsedPolicies || 0}</strong>
                  <small>{totalPolicies ? Math.round((Number(data.lapsedPolicies || 0) / totalPolicies) * 100) : 0}% of policies</small>
                </div>
                <div>
                  <span>Cancelled</span>
                  <strong>{data.cancelledPolicies || 0}</strong>
                  <small>{totalPolicies ? Math.round((Number(data.cancelledPolicies || 0) / totalPolicies) * 100) : 0}% of policies</small>
                </div>
              </div>
            </section>

            <section className="sp-card">
              <h3>Lead Source Quality</h3>
              <div className="sp-sourceTableWrap">
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Total Leads</th>
                      <th>Converted</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourcePerformanceRows.map(([label, metrics]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{metrics?.totalLeads || 0}</td>
                        <td>{metrics?.convertedLeads || 0}</td>
                        <td>{metrics?.conversionRatePct || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="sp-card sp-wide">
              <div className="sp-cardHeader">
                <div>
                  <h3>Converted Leads Trend (Last 6 Months)</h3>
                  <p>Zero-filled monthly trend for easier month-over-month reading.</p>
                </div>
                <strong className="sp-cardTotal">{bestTrendMonth ? `${bestTrendMonth.converted || 0} peak conversions` : "No trend"}</strong>
              </div>
              {Array.isArray(data.monthlyConvertedLeads) && data.monthlyConvertedLeads.length > 0 ? (
                <div className="sp-bars">
                  {data.monthlyConvertedLeads.map((m) => {
                    const pct = Math.round((Number(m.converted || 0) / trendMax) * 100);
                    return (
                      <div key={m.month} className="sp-barCol">
                        <div className="sp-barWrap"><span style={{ height: `${pct}%` }} /></div>
                        <strong>{m.converted || 0}</strong>
                        <small>{formatMonthLabel(m.month)}</small>
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
