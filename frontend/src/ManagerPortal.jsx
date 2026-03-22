import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import ManagerSideNav from "./components/ManagerSideNav";
import "./ManagerPortal.css";

const API_BASE = "http://localhost:5000";

function formatMoney(value) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH")}`;
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

function ManagerPortal({ roleType }) {
  const navigate = useNavigate();
  const { username } = useParams();
  const normalizedRole = String(roleType || "").trim().toUpperCase();
  const [activeView, setActiveView] = useState("dashboard");
  const [agentSearch, setAgentSearch] = useState("");
  const [portalData, setPortalData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

  const filteredAgents = useMemo(() => {
    const agents = Array.isArray(portalData?.agents) ? portalData.agents : [];
    const query = agentSearch.trim().toLowerCase();
    if (!query) return agents;

    return agents.filter((agent) =>
      [agent.username, agent.name, agent.unit, agent.branch, agent.status].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  }, [agentSearch, portalData?.agents]);

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
    totalAnnualPremium: 0,
    conversionRate: 0,
    completionRate: 0,
  };

  const summaryCards = [
    { label: "Agents in Scope", value: summary.totalAgents },
    { label: "Open Tasks", value: summary.totalOpenTasks },
    { label: "Conversion Rate", value: `${summary.conversionRate}%` },
    { label: "Annual Premium", value: formatMoney(summary.totalAnnualPremium) },
  ];

  const rankingAgents = useMemo(
    () => [...(portalData?.agents || [])].sort((a, b) => b.overdueTasks + b.openTasks - (a.overdueTasks + a.openTasks)),
    [portalData?.agents]
  );

  const salesRows = portalData?.salesRows || [];
  const scopeLabel = getScopeLabel(portalData?.scope || {});
  const emptyAgents = !isLoading && !loadError && filteredAgents.length === 0;

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
        <ManagerSideNav roleLabel={normalizedRole} active={activeView} onNavigate={setActiveView} />

        <main className="manager-portal__content">
          <section className="manager-hero">
            <div>
              <p className="manager-hero__eyebrow">{normalizedRole} Portal</p>
              <h1>{getPortalHeading(normalizedRole)}</h1>
              <p>
                Live backend summary for {scopeLabel}. Use this workspace to monitor agent workload, conversion output,
                and coaching priorities from current records.
              </p>
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
                <p>High-level pulse of agent workload and sales momentum across the current manager scope.</p>
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
              </div>
            </section>
          )}

          {!isLoading && !loadError && activeView === "agents" && (
            <section className="manager-panel">
              <div className="manager-panel__head split">
                <div>
                  <h2>Agents in Scope</h2>
                  <p>Search and review live agent workload and sales output inside the current manager scope.</p>
                </div>
                <label className="manager-search" htmlFor="manager-agents-search">
                  <input
                    id="manager-agents-search"
                    type="search"
                    placeholder="Search username, name, or status"
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
                      <th>Status</th>
                      <th>Open Tasks</th>
                      <th>Overdue</th>
                      <th>Closed</th>
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
                        <td>{agent.status}</td>
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

              {emptyAgents && <div className="manager-empty-state">No agents matched this search yet.</div>}
            </section>
          )}

          {!isLoading && !loadError && activeView === "task_progress" && (
            <section className="manager-grid">
              <article className="manager-panel">
                <div className="manager-panel__head">
                  <h2>{normalizedRole === "BM" ? "Branch Task Progress Dashboard" : "Unit Task Progress Dashboard"}</h2>
                  <p>Aggregated view of task execution across agents in scope.</p>
                </div>
                <div className="manager-kpi-grid">
                  <div>
                    <span>Open Tasks</span>
                    <strong>{summary.totalOpenTasks}</strong>
                  </div>
                  <div>
                    <span>Done Tasks</span>
                    <strong>{summary.totalClosedTasks}</strong>
                  </div>
                  <div>
                    <span>Overdue Tasks</span>
                    <strong>{summary.totalOverdueTasks}</strong>
                  </div>
                  <div>
                    <span>Completion Rate</span>
                    <strong>{summary.completionRate}%</strong>
                  </div>
                </div>
              </article>

              <article className="manager-panel">
                <div className="manager-panel__head">
                  <h2>Task Priority Ranking</h2>
                  <p>Agents needing the fastest task coaching.</p>
                </div>
                <div className="manager-rank-list">
                  {rankingAgents.map((agent) => (
                    <div key={agent.id}>
                      <strong>{agent.name}</strong>
                      <span>
                        {agent.overdueTasks} overdue · {agent.openTasks} open
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}

          {!isLoading && !loadError && activeView === "sales_performance" && (
            <section className="manager-grid">
              <article className="manager-panel">
                <div className="manager-panel__head">
                  <h2>{normalizedRole === "BM" ? "Branch Sales Performance Dashboard" : "Unit Sales Performance Dashboard"}</h2>
                  <p>Sales outcome snapshot for the current manager scope.</p>
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
                    <span>Conversion Rate</span>
                    <strong>{summary.conversionRate}%</strong>
                  </div>
                  <div>
                    <span>Annual Premium</span>
                    <strong>{formatMoney(summary.totalAnnualPremium)}</strong>
                  </div>
                </div>
              </article>

              <article className="manager-panel">
                <div className="manager-panel__head">
                  <h2>Agent Sales Ranking</h2>
                  <p>Top premium contribution inside the active manager scope.</p>
                </div>
                <div className="manager-rank-list">
                  {salesRows.map((agent) => (
                    <div key={agent.id}>
                      <strong>{agent.name}</strong>
                      <span>
                        {formatMoney(agent.annualPremium)} · {agent.conversionRate}% conversion
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default ManagerPortal;
