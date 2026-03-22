import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaFilePdf, FaSearch } from "react-icons/fa";
import TopNav from "./components/TopNav";
import ManagerSideNav from "./components/ManagerSideNav";
import "./ManagerPortal.css";

const API_BASE = "http://localhost:5000";

function formatMoney(value) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH")}`;
}

function formatDateTime(value) {
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
}

function getPortalHeading(roleType) {
  if (roleType === "AUM") return "Assistant Unit Manager Command Center";
  if (roleType === "UM") return "Unit Manager Command Center";
  if (roleType === "BM") return "Branch Manager Command Center";
  return "Manager Command Center";
}

function getScopeLabel(scope = {}) {
  if (scope.role === "BM") {
    return [scope.branchName, scope.areaName].filter(Boolean).join(" • ") || "Branch scope";
  }

  return [scope.unitName, scope.branchName, scope.areaName].filter(Boolean).join(" • ") || "Unit scope";
}

function buildFilter(rows, query, extraFields = []) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) =>
    [row.username, row.name, row.unit, row.branch, ...extraFields.map((field) => row[field])].some((value) =>
      String(value || "").toLowerCase().includes(normalized)
    )
  );
}

function createPrintableReport({ filename, title, subtitle, summaryCards, tableColumns, tableRows }) {
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const previousDocumentTitle = document.title;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  document.body.appendChild(iframe);

  const reportDoc = iframe.contentWindow?.document;
  if (!reportDoc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return;
  }

  const summaryHtml = summaryCards
    .map(
      (card) => `
        <article class="summary-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>`
    )
    .join("");

  const headHtml = tableColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const bodyHtml = tableRows.length
    ? tableRows
        .map(
          (row) => `
            <tr>
              ${tableColumns
                .map((column) => `<td>${escapeHtml(column.render ? column.render(row) : row[column.key] ?? "—")}</td>`)
                .join("")}
            </tr>`
        )
        .join("")
    : `<tr><td colspan="${tableColumns.length}" class="empty-row">No rows available.</td></tr>`;

  document.title = filename;
  reportDoc.open();
  reportDoc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
          .page { padding: 6mm; }
          .header { background: linear-gradient(135deg, #da291c 0%, #ef4444 100%); color: white; border-radius: 18px; padding: 18px 22px; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.95; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
          .summary-card { border: 1px solid #fecaca; border-radius: 16px; padding: 14px; background: #fff5f5; }
          .summary-card span { display: block; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #b91c1c; font-weight: 700; }
          .summary-card strong { display: block; margin-top: 8px; font-size: 22px; color: #111827; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; vertical-align: top; }
          th { background: #fee2e2; color: #991b1b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
          tbody tr:nth-child(even) { background: #fffaf9; }
          .empty-row { text-align: center; color: #6b7280; }
          .footer { margin-top: 12px; font-size: 10px; color: #6b7280; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="page">
          <section class="header">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </section>
          <section class="summary-grid">${summaryHtml}</section>
          <table>
            <thead><tr>${headHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
          <div class="footer">
            <span>Generated by PRUTracker</span>
            <span>${escapeHtml(formatDateTime(new Date()))}</span>
          </div>
        </div>
      </body>
    </html>
  `);
  reportDoc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    document.title = previousDocumentTitle;
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 250);
}

function Toolbar({ searchId, searchValue, onSearchChange, searchPlaceholder, onPdfClick, pdfLabel }) {
  return (
    <div className="manager-toolbar">
      <label className="manager-search" htmlFor={searchId}>
        <FaSearch size={14} />
        <input id={searchId} type="search" placeholder={searchPlaceholder} value={searchValue} onChange={onSearchChange} />
      </label>

      <button type="button" className="manager-report-btn" onClick={onPdfClick}>
        <FaFilePdf size={15} />
        <span>{pdfLabel}</span>
      </button>
    </div>
  );
}

function ManagerPortal({ roleType }) {
  const navigate = useNavigate();
  const { username } = useParams();
  const normalizedRole = String(roleType || "").trim().toUpperCase();
  const [activeView, setActiveView] = useState("dashboard");
  const [agentSearch, setAgentSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [portalData, setPortalData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sideNavCollapsed, setSideNavCollapsed] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("managerPortalUser") || "null");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== normalizedRole) {
      localStorage.setItem("role", normalizedRole);
      navigate("/login", { replace: true });
      return;
    }

    if (user.username !== username) {
      navigate(`/${normalizedRole.toLowerCase()}/${user.username}`, { replace: true });
    }
  }, [navigate, normalizedRole, user, username]);

  useEffect(() => {
    document.title = `PRUTracker | ${normalizedRole} Portal`;
  }, [normalizedRole]);

  useEffect(() => {
    if (!user?.id || user.role !== normalizedRole) return;

    const controller = new AbortController();

    const fetchPortalData = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const res = await fetch(`${API_BASE}/api/manager/portal?userId=${user.id}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message || "Failed to load manager portal data.");
        }

        setPortalData(data);
      } catch (err) {
        if (err.name === "AbortError") return;
        setLoadError(err.message || "Failed to load manager portal data.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchPortalData();
    return () => controller.abort();
  }, [normalizedRole, user?.id, user?.role]);

  const handleLogout = () => {
    localStorage.removeItem("managerPortalUser");
    localStorage.setItem("role", normalizedRole);
    navigate("/login", { replace: true });
  };

  const summary = portalData?.summary || {
    totalAgents: 0,
    totalOpenTasks: 0,
    totalOverdueTasks: 0,
    totalClosedTasks: 0,
    totalLeads: 0,
    totalConverted: 0,
    totalPolicies: 0,
    activePolicies: 0,
    totalAnnualPremium: 0,
    totalFrequencyPremium: 0,
    conversionRate: 0,
    completionRate: 0,
    activePolicyRate: 0,
  };

  const filteredAgents = useMemo(() => buildFilter(portalData?.agents || [], agentSearch), [portalData?.agents, agentSearch]);
  const filteredTaskRows = useMemo(
    () => buildFilter(portalData?.taskRows || [], taskSearch, ["topTaskType"]),
    [portalData?.taskRows, taskSearch]
  );
  const filteredSalesRows = useMemo(() => buildFilter(portalData?.salesRows || [], salesSearch), [portalData?.salesRows, salesSearch]);

  const summaryCards = [
    { label: "Agents in Scope", value: summary.totalAgents },
    { label: "Open Tasks", value: summary.totalOpenTasks },
    { label: "Conversion Rate", value: `${summary.conversionRate}%` },
    { label: "Annual Premium", value: formatMoney(summary.totalAnnualPremium) },
  ];

  const scopeLabel = getScopeLabel(portalData?.scope || {});
  const generatedAtLabel = portalData?.reportContext?.generatedAt ? formatDateTime(portalData.reportContext.generatedAt) : null;

  const taskReportColumns = [
    { key: "username", label: "Username" },
    { key: "name", label: "Name" },
    { key: "totalTasks", label: "Total Tasks" },
    { key: "openTasks", label: "Open" },
    { key: "overdueTasks", label: "Overdue" },
    { key: "closedTasks", label: "Done" },
    { key: "delayedDoneTasks", label: "Delayed Done" },
    { key: "completionRate", label: "Completion Rate", render: (row) => `${row.completionRate}%` },
    { key: "nextDueAt", label: "Next Due", render: (row) => formatDateTime(row.nextDueAt) },
    { key: "topTaskType", label: "Top Task Type" },
  ];

  const salesReportColumns = [
    { key: "username", label: "Username" },
    { key: "name", label: "Name" },
    { key: "leads", label: "Leads" },
    { key: "converted", label: "Converted" },
    { key: "conversionRate", label: "Conversion Rate", render: (row) => `${row.conversionRate}%` },
    { key: "totalPolicies", label: "Policies" },
    { key: "activePolicies", label: "Active" },
    { key: "lapsedPolicies", label: "Lapsed" },
    { key: "cancelledPolicies", label: "Cancelled" },
    { key: "annualPremium", label: "Annual Premium", render: (row) => formatMoney(row.annualPremium) },
    { key: "frequencyPremium", label: "Frequency Premium", render: (row) => formatMoney(row.frequencyPremium) },
  ];

  const generateTaskPdfReport = () => {
    createPrintableReport({
      filename: `${user?.username || normalizedRole} - Manager Task Progress Report`,
      title: `${normalizedRole} Task Progress Report`,
      subtitle: `${scopeLabel} • ${generatedAtLabel || "Latest available data"}`,
      summaryCards: [
        { label: "Agents in Scope", value: summary.totalAgents },
        { label: "Open Tasks", value: summary.totalOpenTasks },
        { label: "Overdue Tasks", value: summary.totalOverdueTasks },
        { label: "Completion Rate", value: `${summary.completionRate}%` },
      ],
      tableColumns: taskReportColumns,
      tableRows: filteredTaskRows,
    });
  };

  const generateSalesPdfReport = () => {
    createPrintableReport({
      filename: `${user?.username || normalizedRole} - Manager Sales Performance Report`,
      title: `${normalizedRole} Sales Performance Report`,
      subtitle: `${scopeLabel} • ${generatedAtLabel || "Latest available data"}`,
      summaryCards: [
        { label: "Agents in Scope", value: summary.totalAgents },
        { label: "Total Leads", value: summary.totalLeads },
        { label: "Converted Leads", value: summary.totalConverted },
        { label: "Annual Premium", value: formatMoney(summary.totalAnnualPremium) },
      ],
      tableColumns: salesReportColumns,
      tableRows: filteredSalesRows,
    });
  };

  return (
    <div className="manager-portal">
      <TopNav
        user={user}
        onLogoClick={() => setActiveView("dashboard")}
        onLogout={handleLogout}
        showAlerts={false}
        profileClickable={false}
      />

      <div className="manager-portal__body">
        <ManagerSideNav
          roleLabel={normalizedRole}
          active={activeView}
          onNavigate={setActiveView}
          collapsed={sideNavCollapsed}
          onToggle={() => setSideNavCollapsed((current) => !current)}
        />

        <main className="manager-portal__content">
          <section className="manager-hero">
            <div>
              <p className="manager-hero__eyebrow">{normalizedRole} Portal</p>
              <h1>{getPortalHeading(normalizedRole)}</h1>
              <p>
                Monitor {scopeLabel} with live backend metrics, searchable team tables, and printable task and sales reports.
              </p>
              {generatedAtLabel && <small className="manager-hero__meta">Updated {generatedAtLabel}</small>}
            </div>
            <div className="manager-hero__cards">
              {summaryCards.map((card) => (
                <article key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </article>
              ))}
            </div>
          </section>

          {isLoading && <section className="manager-panel manager-feedback">Loading manager portal data...</section>}
          {loadError && <section className="manager-panel manager-feedback manager-feedback--error">{loadError}</section>}

          {!isLoading && !loadError && activeView === "dashboard" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <h2>{normalizedRole === "BM" ? "Branch Overview" : "Unit Overview"}</h2>
                <p>High-level pulse of workload, conversion output, and policy momentum across the current manager scope.</p>
              </div>
              <div className="manager-kpi-grid">
                <div>
                  <span>Completed Tasks</span>
                  <strong>{summary.totalClosedTasks}</strong>
                </div>
                <div>
                  <span>Overdue Tasks</span>
                  <strong>{summary.totalOverdueTasks}</strong>
                </div>
                <div>
                  <span>Leads Managed</span>
                  <strong>{summary.totalLeads}</strong>
                </div>
                <div>
                  <span>Converted Leads</span>
                  <strong>{summary.totalConverted}</strong>
                </div>
                <div>
                  <span>Total Policies</span>
                  <strong>{summary.totalPolicies}</strong>
                </div>
                <div>
                  <span>Active Policy Rate</span>
                  <strong>{summary.activePolicyRate}%</strong>
                </div>
                <div>
                  <span>Annual Premium</span>
                  <strong>{formatMoney(summary.totalAnnualPremium)}</strong>
                </div>
                <div>
                  <span>Frequency Premium</span>
                  <strong>{formatMoney(summary.totalFrequencyPremium)}</strong>
                </div>
              </div>
            </section>
          )}

          {!isLoading && !loadError && activeView === "agents" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <div>
                  <h2>Agents in Scope</h2>
                  <p>The scoped agent list now includes the current {normalizedRole} account’s underlying agent record as part of the count and table.</p>
                </div>
              </div>

              <div className="manager-toolbar manager-toolbar--search-only">
                <label className="manager-search" htmlFor="manager-agents-search">
                  <FaSearch size={14} />
                  <input
                    id="manager-agents-search"
                    type="search"
                    placeholder="Search username, name, unit, or branch"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                  />
                </label>
              </div>

              <div className="manager-table-wrap">
                <table className="manager-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Unit</th>
                      <th>Branch</th>
                      <th>Open Tasks</th>
                      <th>Overdue</th>
                      <th>Done</th>
                      <th>Leads</th>
                      <th>Converted</th>
                      <th>Annual Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr key={agent.id}>
                        <td>{agent.username}</td>
                        <td>{agent.name}</td>
                        <td>{agent.unit || "—"}</td>
                        <td>{agent.branch || "—"}</td>
                        <td>{agent.openTasks}</td>
                        <td>{agent.overdueTasks}</td>
                        <td>{agent.closedTasks}</td>
                        <td>{agent.leads}</td>
                        <td>{agent.converted}</td>
                        <td>{formatMoney(agent.annualPremium)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!filteredAgents.length && <div className="manager-empty-state">No agents matched this search yet.</div>}
            </section>
          )}

          {!isLoading && !loadError && activeView === "task_progress" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <div>
                  <h2>{normalizedRole === "BM" ? "Branch Task Progress" : "Unit Task Progress"}</h2>
                  <p>Review task execution per agent with meaningful workload and deadline columns, then print a PDF summary when needed.</p>
                </div>
              </div>

              <div className="manager-kpi-grid">
                <div>
                  <span>Open Tasks</span>
                  <strong>{summary.totalOpenTasks}</strong>
                </div>
                <div>
                  <span>Overdue Tasks</span>
                  <strong>{summary.totalOverdueTasks}</strong>
                </div>
                <div>
                  <span>Done Tasks</span>
                  <strong>{summary.totalClosedTasks}</strong>
                </div>
                <div>
                  <span>Completion Rate</span>
                  <strong>{summary.completionRate}%</strong>
                </div>
              </div>

              <Toolbar
                searchId="manager-task-search"
                searchValue={taskSearch}
                onSearchChange={(e) => setTaskSearch(e.target.value)}
                searchPlaceholder="Search username, name, branch, or task type"
                onPdfClick={generateTaskPdfReport}
                pdfLabel="Generate Task Report (PDF)"
              />

              <div className="manager-table-wrap">
                <table className="manager-table manager-table--wide">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Total Tasks</th>
                      <th>Open</th>
                      <th>Overdue</th>
                      <th>Done</th>
                      <th>Delayed Done</th>
                      <th>Completion Rate</th>
                      <th>Next Due</th>
                      <th>Last Completed</th>
                      <th>Top Task Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTaskRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.username}</td>
                        <td>{row.name}</td>
                        <td>{row.totalTasks}</td>
                        <td>{row.openTasks}</td>
                        <td>{row.overdueTasks}</td>
                        <td>{row.closedTasks}</td>
                        <td>{row.delayedDoneTasks}</td>
                        <td>{row.completionRate}%</td>
                        <td>{formatDateTime(row.nextDueAt)}</td>
                        <td>{formatDateTime(row.lastCompletedAt)}</td>
                        <td>{row.topTaskType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!filteredTaskRows.length && <div className="manager-empty-state">No task rows matched this search yet.</div>}
            </section>
          )}

          {!isLoading && !loadError && activeView === "sales_performance" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <div>
                  <h2>{normalizedRole === "BM" ? "Branch Sales Performance" : "Unit Sales Performance"}</h2>
                  <p>Track conversion and policy outcomes per agent with meaningful sales columns and printable PDF reporting.</p>
                </div>
              </div>

              <div className="manager-kpi-grid">
                <div>
                  <span>Total Leads</span>
                  <strong>{summary.totalLeads}</strong>
                </div>
                <div>
                  <span>Converted Leads</span>
                  <strong>{summary.totalConverted}</strong>
                </div>
                <div>
                  <span>Total Policies</span>
                  <strong>{summary.totalPolicies}</strong>
                </div>
                <div>
                  <span>Active Policy Rate</span>
                  <strong>{summary.activePolicyRate}%</strong>
                </div>
                <div>
                  <span>Annual Premium</span>
                  <strong>{formatMoney(summary.totalAnnualPremium)}</strong>
                </div>
                <div>
                  <span>Frequency Premium</span>
                  <strong>{formatMoney(summary.totalFrequencyPremium)}</strong>
                </div>
              </div>

              <Toolbar
                searchId="manager-sales-search"
                searchValue={salesSearch}
                onSearchChange={(e) => setSalesSearch(e.target.value)}
                searchPlaceholder="Search username, name, branch, or unit"
                onPdfClick={generateSalesPdfReport}
                pdfLabel="Generate Sales Report (PDF)"
              />

              <div className="manager-table-wrap">
                <table className="manager-table manager-table--wide">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Leads</th>
                      <th>Converted</th>
                      <th>Conversion Rate</th>
                      <th>Policies</th>
                      <th>Active</th>
                      <th>Lapsed</th>
                      <th>Cancelled</th>
                      <th>Annual Premium</th>
                      <th>Frequency Premium</th>
                      <th>Latest Policy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalesRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.username}</td>
                        <td>{row.name}</td>
                        <td>{row.leads}</td>
                        <td>{row.converted}</td>
                        <td>{row.conversionRate}%</td>
                        <td>{row.totalPolicies}</td>
                        <td>{row.activePolicies}</td>
                        <td>{row.lapsedPolicies}</td>
                        <td>{row.cancelledPolicies}</td>
                        <td>{formatMoney(row.annualPremium)}</td>
                        <td>{formatMoney(row.frequencyPremium)}</td>
                        <td>{formatDateTime(row.latestPolicyIssuedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!filteredSalesRows.length && <div className="manager-empty-state">No sales rows matched this search yet.</div>}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default ManagerPortal;
