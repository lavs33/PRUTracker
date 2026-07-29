
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentTasksProgress.css";

const TASK_TYPES = ["APPROACH", "FOLLOW_UP", "UPDATE_CONTACT_INFO", "APPOINTMENT", "PRESENTATION"];
const DATE_PRESETS = [
  { value: "ALL", label: "All Time" },
  { value: "1d", label: "This Day" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "6m", label: "Last 6 Months" },
  { value: "12m", label: "Last 12 Months" },
];
const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || value || "All";
const formatDateTime = (value) => {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

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
  const [lastUpdated, setLastUpdated] = useState(null);
  const [data, setData] = useState({
    totalTasks: 0,
    openTasks: 0,
    doneTasks: 0,
    allDoneTasks: 0,
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
    reportContext: { datePreset: "ALL", type: "ALL" },
  });

  const [datePreset, setDatePreset] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedTypeDrill, setSelectedTypeDrill] = useState("");

  const API_BASE = "http://localhost:5000";

  useEffect(() => {
    if (!user || user.username !== username) navigate("/", { replace: true });
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Task Progress and Workload Distribution`;
  }, [username]);

  const fetchProgress = useCallback(
    async (signal) => {
      if (!user?.id) return;
      const params = new URLSearchParams({
        userId: user.id,
        datePreset,
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
        allDoneTasks: Number(payload?.allDoneTasks || 0),
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
        reportContext: payload?.reportContext || { datePreset, type: typeFilter },
      });
      setLastUpdated(new Date());
    },
    [API_BASE, user?.id, datePreset, typeFilter, selectedTypeDrill]
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
    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const now = new Date();
    const formatDate = (value) => {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    };
    const computePeriod = () => {
      const start = data.reportContext?.startDate ? new Date(data.reportContext.startDate) : null;
      const end = data.reportContext?.endDate ? new Date(data.reportContext.endDate) : new Date(now);
      if (start && !Number.isNaN(start.getTime())) return { label: `${formatDate(start)} to ${formatDate(end)}`, start, end };
      return { label: `Through ${formatDate(end)}`, start: null, end };
    };

    const period = computePeriod();
    const agentCode = user?.username || "—";
    const reportFilename = `${agentCode} - Agent Task Performance Report`;
    const firstName = user?.firstName || "—";
    const middleName = user?.middleName || "—";
    const lastName = user?.lastName || "—";
    const agentType = user?.agentType || "—";
    const unitName = user?.unitName || "—";
    const branchName = user?.branchName || "—";
    const areaName = user?.areaName || "—";

    const statusRows = (Array.isArray(data.statusChart) ? data.statusChart : [])
      .map((s) => {
        const pct = data.totalTasks ? Math.round((Number(s?.value || 0) / data.totalTasks) * 100) : 0;
        return `
          <div class="mini-bar-row compact-row">
            <div class="mini-bar-label">${escapeHtml(s?.key || "—")}</div>
            <div class="mini-bar-track"><span style="width:${pct}%;background:${escapeHtml(s?.color || "#da291c")};"></span></div>
            <div class="mini-bar-val">${Number(s?.value || 0)} (${pct}%)</div>
          </div>
        `;
      })
      .join("");

    const typeRows = (Array.isArray(data.typeCounts) ? data.typeCounts : [])
      .map((t) => {
        const total = Number(t?.total || 0);
        const done = Number(t?.done || 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        return `
          <div class="mini-bar-row compact-row">
            <div class="mini-bar-label">${escapeHtml(t?.type || "—")}</div>
            <div class="mini-bar-track"><span style="width:${pct}%;background:#00539b;"></span></div>
            <div class="mini-bar-val">${done}/${total} (${pct}%)</div>
          </div>
        `;
      })
      .join("");

    const iframe = document.createElement("iframe");
    const previousDocumentTitle = document.title;
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
    const detailChunkSize = 18;
    const workloadChunkSize = 35;
    const chunk = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const detailSourceRows = selectedTypeDrill && Array.isArray(data.drillTasks) ? data.drillTasks : data.reportTasks;
    const detailItems = Array.isArray(detailSourceRows) ? detailSourceRows : [];
    const workloadItems = Array.isArray(data.leadWorkloadRows) ? data.leadWorkloadRows.slice(0, 140) : [];
    const detailChunks = chunk(detailItems, detailChunkSize);
    const workloadChunks = chunk(workloadItems, workloadChunkSize);

    const pages = [];
    pages.push(`
      <section class="pdf-page first-page">
        <div class="header-band"></div>
        <section class="section">
          <div class="top-grid">
            <div class="title-block">
              <h1 class="report-title">Agent Task Performance Report</h1>
              <div class="report-period">Report Period: ${escapeHtml(period.label)}</div>
            </div>
            <div class="details-card">
              <h3>Agent Details</h3>
              <div class="details-grid">
                <div class="detail-item"><b>Agent Code</b>${escapeHtml(agentCode)}</div>
                <div class="detail-item"><b>Agent Type</b>${escapeHtml(agentType)}</div>
                <div class="detail-item"><b>Name</b>${escapeHtml([firstName, middleName !== "—" ? middleName : "", lastName].filter(Boolean).join(" "))}</div>
                <div class="detail-item"><b>Unit</b>${escapeHtml(unitName)}</div>
                <div class="detail-item"><b>Branch</b>${escapeHtml(branchName)}</div>
                <div class="detail-item"><b>Area</b>${escapeHtml(areaName)}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="meta-row">
            <div class="meta-chip"><div class="label">Date Range Filter</div><div class="value">${escapeHtml(getOptionLabel(DATE_PRESETS, data.reportContext?.datePreset || datePreset))}</div></div>
            <div class="meta-chip"><div class="label">Task Type Filter</div><div class="value">${escapeHtml(data.reportContext?.type || typeFilter)}</div></div>
            <div class="meta-chip"><div class="label">Rows Included</div><div class="value">${Number(detailItems.length)}</div></div>
          </div>
        </section>

        <section class="section">
          <div class="kpi-grid">
            <div class="kpi primary"><div class="label">Total Tasks</div><div class="val">${data.totalTasks}</div></div>
            <div class="kpi"><div class="label">Open</div><div class="val">${data.openTasks}</div></div>
            <div class="kpi accent"><div class="label">Overdue</div><div class="val">${data.overdueTasks}</div></div>
            <div class="kpi secondary"><div class="label">Done</div><div class="val">${data.allDoneTasks}</div></div>
            <div class="kpi secondary"><div class="label">On-Time Done</div><div class="val">${data.doneTasks}</div></div>
            <div class="kpi accent"><div class="label">Late Done</div><div class="val">${data.delayedDoneTasks}</div></div>
            <div class="kpi info"><div class="label">Overall Completion Rate</div><div class="val">${data.completionRate}%</div></div>
            <div class="kpi secondary"><div class="label">On-Time Completion Rate</div><div class="val">${data.onTimeRate}%</div></div>
            <div class="kpi accent"><div class="label">Late Completion Rate</div><div class="val">${data.lateCompletionRate}%</div></div>
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">Performance Analytics</h2>
          <div class="analytics-grid">
            <div class="panel">
              <h4>Status Distribution</h4>
              ${statusRows || '<div class="footnote">No status distribution data.</div>'}
            </div>
            <div class="panel">
              <h4>Task Type Performance</h4>
              ${typeRows || '<div class="footnote">No task type data.</div>'}
            </div>
          </div>
        </section>
      </section>
    `);

    if (!detailChunks.length) {
      pages.push(`
        <section class="pdf-page">
          <section class="section compact-top">
            <h2 class="section-title">Drill-down Task Detail</h2>
            <table>
              <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Overdue Open</th><th>Was Delayed</th><th>Due</th><th>Lead Code</th><th>Prospect</th><th>Lead Status</th></tr></thead>
              <tbody><tr><td colspan="9">No task detail rows available.</td></tr></tbody>
            </table>
          </section>
        </section>
      `);
    } else {
      detailChunks.forEach((rowsChunk) => {
        const chunkRows = rowsChunk.map((t) => `
          <tr class="${t?.isOverdue ? "is-overdue" : t?.status === "Open" ? "is-open" : ""}">
            <td>${escapeHtml(t?.title || "Untitled task")}</td>
            <td>${escapeHtml(t?.type || "—")}</td>
            <td>${escapeHtml(t?.status || "—")}</td>
            <td>${t?.isOverdue ? "Yes" : "No"}</td>
            <td>${t?.status === "Done" ? (t?.wasDelayed ? "Yes" : "No") : "—"}</td>
            <td>${t?.dueAt ? escapeHtml(formatDateTime(t.dueAt)) : "—"}</td>
            <td>${escapeHtml(t?.leadCode || "—")}</td>
            <td>${escapeHtml(t?.prospectName || "—")}</td>
            <td>${escapeHtml(t?.leadStatus || "—")}</td>
          </tr>
        `).join("");
        pages.push(`
          <section class="pdf-page">
            <section class="section compact-top">
              <h2 class="section-title">Drill-down Task Detail</h2>
              <table>
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Status</th><th>Overdue Open</th><th>Was Delayed</th><th>Due</th><th>Lead Code</th><th>Prospect</th><th>Lead Status</th></tr>
                </thead>
                <tbody>${chunkRows}</tbody>
              </table>
              <div class="footnote">Rows are sorted by earliest due date from the current dashboard filter context.</div>
            </section>
          </section>
        `);
      });
    }

    if (!workloadChunks.length) {
      pages.push(`
        <section class="pdf-page">
          <section class="section compact-top">
            <h2 class="section-title">Lead Engagement Workload Distribution</h2>
            <table>
              <thead><tr><th>Lead Code</th><th>Prospect</th><th>Lead Status</th><th>Total Tasks</th><th>Open</th><th>Overdue</th><th>Done</th></tr></thead>
              <tbody><tr><td colspan="7">No workload rows available.</td></tr></tbody>
            </table>
          </section>
        </section>
      `);
    } else {
      workloadChunks.forEach((rowsChunk) => {
        const chunkRows = rowsChunk.map((r) => `
          <tr>
            <td>${escapeHtml(r?.leadCode || "—")}</td>
            <td>${escapeHtml(r?.prospectName || "—")}</td>
            <td>${escapeHtml(r?.leadStatus || "—")}</td>
            <td>${Number(r?.total || 0)}</td>
            <td class="${Number(r?.open || 0) > 0 ? "cell-open" : ""}">${Number(r?.open || 0)}</td>
            <td class="${Number(r?.overdue || 0) > 0 ? "cell-overdue" : ""}">${Number(r?.overdue || 0)}</td>
            <td>${Number(r?.done || 0)}</td>
          </tr>
        `).join("");
        pages.push(`
          <section class="pdf-page">
            <section class="section compact-top">
              <h2 class="section-title">Lead Engagement Workload Distribution</h2>
              <table>
                <thead><tr><th>Lead Code</th><th>Prospect</th><th>Lead Status</th><th>Total Tasks</th><th>Open</th><th>Overdue</th><th>Done</th></tr></thead>
                <tbody>${chunkRows}</tbody>
              </table>
            </section>
          </section>
        `);
      });
    }

    const pagesWithFooters = pages.map((pageHtml, index) => {
      const pageNo = index + 1;
      const total = pages.length;
      return pageHtml.replace(
        /<\/section>\s*$/,
        `<div class="report-footer"><div>Generated by PRUTracker • ${escapeHtml(formatDateTime(now))}</div><div>Page ${pageNo} of ${total}</div></div></section>`
      );
    }).join('');

    reportDoc.write(`
      <html>
        <head>
          <title>${escapeHtml(reportFilename)}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            * { box-sizing: border-box; }
            body { font-family: Verdana, Geneva, sans-serif; color: #1f2937; margin: 0; font-size: 11px; line-height: 1.3; background:#fff; }
            .pdf-page { position: relative; min-height: 297mm; padding: 16mm 16mm 24mm; page-break-after: always; overflow: hidden; }
            .pdf-page:last-child { page-break-after: auto; }
            .first-page { padding-top: 14mm; }
            .header-band { height: 8px; background: linear-gradient(90deg, #da291c, #ffb81c, #00539b); border-radius: 6px; margin-bottom: 8px; }
            .top-grid { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(280px, 1fr); gap: 14px; align-items: start; }
            .title-block { padding: 4px 0 2px; }
            .report-title { margin: 0; color: #991b1b; font-size: 23px; line-height: 1.08; font-weight: 700; letter-spacing: .2px; }
            .report-period { margin-top: 10px; color: #374151; font-size: 13px; font-weight: 700; }
            .details-card { border: 1px solid #f3c4c0; background: #fff7f6; border-radius: 10px; padding: 10px 12px; }
            .details-card h3 { margin: 0 0 6px; color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 14px; }
            .detail-item { font-size: 10px; }
            .detail-item b { color: #6b7280; display:block; font-weight:700; margin-bottom: 1px; }
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
            .section { margin-bottom: 6px; }
            .compact-top { margin-top: 0; }
            .section-title { margin: 0 0 6px; color: #991b1b; font-size: 14px; font-weight: 700; border-left: 4px solid #da291c; padding-left: 8px; }
            .analytics-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .panel { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#fff; }
            .panel h4 { margin:0 0 6px; color:#111827; font-size:12px; }
            .mini-bar-row { display:grid; grid-template-columns: 120px 1fr 85px; gap: 6px; align-items:center; margin-bottom:4px; }
            .mini-bar-label, .mini-bar-val { font-size: 10px; }
            .mini-bar-track { height: 10px; border-radius: 999px; background:#eef2f7; overflow:hidden; }
            .mini-bar-track span { display:block; height:100%; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #dfe5ec; padding: 5px 6px; text-align: left; vertical-align: top; }
            th { background: #f3f6fa; color:#374151; }
            tbody tr:nth-child(even) td { background:#fcfcfd; }
            tr.is-open td { font-weight:800; background:#fffbeb !important; color:#92400e !important; }
            tr.is-overdue td { font-weight:800; background:#fef2f2 !important; color:#991b1b; }
            td.cell-open { font-weight:800; background:#fffbeb !important; color:#92400e; }
            td.cell-overdue { font-weight:900; background:#fef2f2 !important; color:#991b1b; }
            .footnote { margin-top: 5px; font-size: 9px; color: #6b7280; }
            .report-footer { position: absolute; left: 16mm; right: 16mm; bottom: 14mm; font-size: 9px; color: #6b7280; display:flex; justify-content:space-between; align-items:center; border-top: 1px solid #e5e7eb; padding-top: 3px; }
          </style>
        </head>
        <body>${pagesWithFooters}</body>
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

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setApiError("");
      await fetchProgress();
    } catch (err) {
      setApiError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setLoading(false);
    }
  };

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
            <div>
              <h1 className="tp-title">Task Progress and Workload Distribution Dashboard</h1>
              <p className="tp-subtitle">
                Monitor task completion, timing quality, workload distribution, and drill-down task detail for your current dashboard filters.
              </p>
            </div>
            <div className="tp-headActions">
              <span className="tp-lastUpdated">Updated {lastUpdated ? formatDateTime(lastUpdated) : "—"}</span>
              <button className="tp-refreshBtn" onClick={handleRefresh} disabled={loading}>Refresh</button>
              <button className="tp-reportBtn" onClick={generatePdfReport} disabled={loading}>Generate Report (PDF)</button>
            </div>
          </div>

          <section className="tp-card tp-filterBar">
            <div className="tp-filterGroup">
              <label>Date Range</label>
              <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
                {DATE_PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="tp-filterGroup">
              <label>Task Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="ALL">All types</option>
                {TASK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div className="tp-filterActions">
              <button className="tp-resetBtn" onClick={() => { setDatePreset("ALL"); setTypeFilter("ALL"); setSelectedTypeDrill(""); }} disabled={loading}>Reset Filters</button>
            </div>
          </section>

          <div className="tp-kpis">
            <div className="tp-kpi"><span>Total Tasks</span><strong>{data.totalTasks}</strong></div>
            <div className="tp-kpi"><span>Open</span><strong>{data.openTasks}</strong></div>
            <div className="tp-kpi"><span>Overdue</span><strong>{data.overdueTasks}</strong></div>
            <div className="tp-kpi"><span>Done</span><strong>{data.allDoneTasks}</strong></div>
            <div className="tp-kpi"><span>On-Time Done</span><strong>{data.doneTasks}</strong></div>
            <div className="tp-kpi"><span>Late Done</span><strong>{data.delayedDoneTasks}</strong></div>
            <div className="tp-kpi"><span>Overall Completion Rate</span><strong>{data.completionRate}%</strong></div>
            <div className="tp-kpi"><span>On-Time Completion Rate</span><strong>{data.onTimeRate}%</strong></div>
            <div className="tp-kpi"><span>Late Completion Rate</span><strong>{data.lateCompletionRate}%</strong></div>
          </div>

          <div className="tp-grid">
            <section className="tp-card">
              <h3>Progress Overview</h3>
              <div className="tp-progressRow"><label>Overall Completion</label><div className="tp-track"><span style={{ width: `${data.completionRate}%` }} /></div><b>{data.completionRate}%</b></div>
              <div className="tp-progressRow"><label>On-Time Done</label><div className="tp-track alt"><span style={{ width: `${data.onTimeRate}%` }} /></div><b>{data.onTimeRate}%</b></div>
              <div className="tp-progressRow"><label>Late Done</label><div className="tp-track warn"><span style={{ width: `${data.lateCompletionRate}%` }} /></div><b>{data.lateCompletionRate}%</b></div>
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
                        <th>Was Delayed</th>
                        <th>Due</th>
                        <th>Lead Code</th>
                        <th>Prospect</th>
                        <th>Lead Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.drillTasks.map((t) => (
                        <tr key={t._id} className={t.isOverdue ? "tp-rowOverdue" : t.status === "Open" ? "tp-rowOpen" : ""}>
                          <td>{t.title || "Untitled task"}</td>
                          <td>{t.status}</td>
                          <td>{t.isOverdue ? "Yes" : "No"}</td>
                          <td>{t.status === "Done" ? (t.wasDelayed ? "Yes" : "No") : "—"}</td>
                          <td>{t?.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}</td>
                          <td><Link className="tp-contextLink" to={`/agent/${username}/prospects/${t.prospectId}/leads/${t.leadId}`}>{t?.leadCode || "—"}</Link></td>
                          <td><Link className="tp-contextLink" to={`/agent/${username}/prospects/${t.prospectId}/leads/${t.leadId}`}>{t?.prospectName || "—"}</Link></td>
                          <td>{t?.leadStatus || "—"}</td>
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
                        <th>Lead Status</th>
                        <th>Total Tasks</th>
                        <th>Open</th>
                        <th>Overdue</th>
                        <th>Done</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leadWorkloadRows.map((r) => (
                        <tr key={r.leadEngagementId}>
                          <td><Link className="tp-contextLink" to={`/agent/${username}/prospects/${r.prospectId}/leads/${r.leadId}`}>{r.leadCode}</Link></td>
                          <td><Link className="tp-contextLink" to={`/agent/${username}/prospects/${r.prospectId}/leads/${r.leadId}`}>{r.prospectName}</Link></td>
                          <td>{r.leadStatus || "—"}</td>
                          <td>{r.total}</td>
                          <td className={Number(r.open || 0) > 0 ? "tp-cellOpen" : ""}>{r.open}</td>
                          <td className={Number(r.overdue || 0) > 0 ? "tp-cellOverdue" : ""}>{r.overdue}</td>
                          <td>{r.done || 0}</td>
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
