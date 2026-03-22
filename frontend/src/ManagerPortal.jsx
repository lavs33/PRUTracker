import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import ManagerSideNav from "./components/ManagerSideNav";
import "./ManagerPortal.css";

const AGENT_ROWS = [
  { username: "AG000101", name: "Angel Dela Cruz", unit: "Diamond Unit", branch: "Metro Manila", status: "Top Performer", openTasks: 5, overdueTasks: 1, closedTasks: 24, leads: 42, converted: 10, annualPremium: 315000 },
  { username: "AG000102", name: "Miguel Santos", unit: "Diamond Unit", branch: "Metro Manila", status: "Healthy Pipeline", openTasks: 7, overdueTasks: 0, closedTasks: 19, leads: 37, converted: 8, annualPremium: 248000 },
  { username: "AG000103", name: "Rina Bautista", unit: "Diamond Unit", branch: "Metro Manila", status: "Needs Follow-up", openTasks: 9, overdueTasks: 3, closedTasks: 14, leads: 31, converted: 5, annualPremium: 173000 },
  { username: "AG000104", name: "Paolo Reyes", unit: "Diamond Unit", branch: "Metro Manila", status: "Recovery Mode", openTasks: 11, overdueTasks: 4, closedTasks: 11, leads: 26, converted: 4, annualPremium: 121000 },
  { username: "AG000105", name: "Kris Mariano", unit: "Diamond Unit", branch: "Metro Manila", status: "Top Performer", openTasks: 4, overdueTasks: 0, closedTasks: 28, leads: 44, converted: 11, annualPremium: 364000 },
  { username: "AG000106", name: "Elaine Rivera", unit: "Diamond Unit", branch: "Metro Manila", status: "New Momentum", openTasks: 6, overdueTasks: 1, closedTasks: 17, leads: 29, converted: 6, annualPremium: 190000 },
];

function buildScopeData(roleType) {
  const isUM = roleType === "UM";
  const agents = isUM
    ? [
        ...AGENT_ROWS,
        { username: "AG000107", name: "Marco Lim", unit: "Diamond Unit", branch: "Metro Manila", status: "Healthy Pipeline", openTasks: 8, overdueTasks: 2, closedTasks: 15, leads: 33, converted: 7, annualPremium: 207000 },
        { username: "AG000108", name: "Bea Navarro", unit: "Diamond Unit", branch: "Metro Manila", status: "Needs Follow-up", openTasks: 10, overdueTasks: 3, closedTasks: 12, leads: 22, converted: 3, annualPremium: 98000 },
      ]
    : AGENT_ROWS;

  const totalAgents = agents.length;
  const totalOpenTasks = agents.reduce((sum, agent) => sum + agent.openTasks, 0);
  const totalOverdueTasks = agents.reduce((sum, agent) => sum + agent.overdueTasks, 0);
  const totalClosedTasks = agents.reduce((sum, agent) => sum + agent.closedTasks, 0);
  const totalLeads = agents.reduce((sum, agent) => sum + agent.leads, 0);
  const totalConverted = agents.reduce((sum, agent) => sum + agent.converted, 0);
  const totalAnnualPremium = agents.reduce((sum, agent) => sum + agent.annualPremium, 0);
  const conversionRate = totalLeads ? Math.round((totalConverted / totalLeads) * 100) : 0;
  const completionRate = totalOpenTasks + totalClosedTasks ? Math.round((totalClosedTasks / (totalOpenTasks + totalClosedTasks)) * 100) : 0;

  return {
    summary: {
      totalAgents,
      totalOpenTasks,
      totalOverdueTasks,
      totalClosedTasks,
      totalLeads,
      totalConverted,
      totalAnnualPremium,
      conversionRate,
      completionRate,
    },
    agents,
    salesRows: agents
      .map((agent) => ({
        ...agent,
        conversionRate: agent.leads ? Math.round((agent.converted / agent.leads) * 100) : 0,
      }))
      .sort((a, b) => b.annualPremium - a.annualPremium),
  };
}

function formatMoney(value) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH")}`;
}

function ManagerPortal({ roleType }) {
  const navigate = useNavigate();
  const { username } = useParams();
  const normalizedRole = String(roleType || "").trim().toUpperCase();
  const [activeView, setActiveView] = useState("dashboard");
  const [agentSearch, setAgentSearch] = useState("");

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

  const scopeData = useMemo(() => buildScopeData(normalizedRole), [normalizedRole]);

  const filteredAgents = useMemo(() => {
    const query = agentSearch.trim().toLowerCase();
    if (!query) return scopeData.agents;

    return scopeData.agents.filter((agent) =>
      [agent.username, agent.name, agent.unit, agent.branch, agent.status].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  }, [agentSearch, scopeData.agents]);

  const handleLogout = () => {
    localStorage.removeItem("managerPortalUser");
    localStorage.setItem("role", normalizedRole);
    navigate("/login", { replace: true });
  };

  const summaryCards = [
    { label: "Agents in Scope", value: scopeData.summary.totalAgents },
    { label: "Open Tasks", value: scopeData.summary.totalOpenTasks },
    { label: "Conversion Rate", value: `${scopeData.summary.conversionRate}%` },
    { label: "Annual Premium", value: formatMoney(scopeData.summary.totalAnnualPremium) },
  ];

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
              <h1>{normalizedRole === "AUM" ? "Assistant Unit Manager" : "Unit Manager"} Command Center</h1>
              <p>
                Frontend-first workspace for team monitoring, unit execution visibility, and manager-level coaching
                decisions before backend data wiring.
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

          {activeView === "dashboard" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <h2>Unit Overview</h2>
                <p>High-level pulse of agent workload and sales momentum.</p>
              </div>
              <div className="manager-kpi-grid">
                <div>
                  <span>Completed Tasks</span>
                  <strong>{scopeData.summary.totalClosedTasks}</strong>
                </div>
                <div>
                  <span>Overdue Tasks</span>
                  <strong>{scopeData.summary.totalOverdueTasks}</strong>
                </div>
                <div>
                  <span>Leads Managed</span>
                  <strong>{scopeData.summary.totalLeads}</strong>
                </div>
                <div>
                  <span>Converted Leads</span>
                  <strong>{scopeData.summary.totalConverted}</strong>
                </div>
              </div>
            </section>
          )}

          {activeView === "agents" && (
            <section className="manager-panel">
              <div className="manager-panel__head split">
                <div>
                  <h2>Agents in Scope</h2>
                  <p>Search and review agents under the current manager scope.</p>
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
                      <tr key={agent.username}>
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
            </section>
          )}

          {activeView === "task_progress" && (
            <section className="manager-grid">
              <article className="manager-panel">
                <div className="manager-panel__head">
                  <h2>Unit Task Progress Dashboard</h2>
                  <p>Aggregated view of task execution across agents in scope.</p>
                </div>
                <div className="manager-kpi-grid">
                  <div>
                    <span>Open Tasks</span>
                    <strong>{scopeData.summary.totalOpenTasks}</strong>
                  </div>
                  <div>
                    <span>Done Tasks</span>
                    <strong>{scopeData.summary.totalClosedTasks}</strong>
                  </div>
                  <div>
                    <span>Overdue Tasks</span>
                    <strong>{scopeData.summary.totalOverdueTasks}</strong>
                  </div>
                  <div>
                    <span>Completion Rate</span>
                    <strong>{scopeData.summary.completionRate}%</strong>
                  </div>
                </div>
              </article>

              <article className="manager-panel">
                <div className="manager-panel__head">
                  <h2>Task Priority Ranking</h2>
                  <p>Agents needing the fastest task coaching.</p>
                </div>
                <div className="manager-rank-list">
                  {[...scopeData.agents]
                    .sort((a, b) => (b.overdueTasks + b.openTasks) - (a.overdueTasks + a.openTasks))
                    .map((agent) => (
                      <div key={agent.username}>
                        <strong>{agent.name}</strong>
                        <span>{agent.overdueTasks} overdue · {agent.openTasks} open</span>
                      </div>
                    ))}
                </div>
              </article>
            </section>
          )}

          {activeView === "sales_performance" && (
            <section className="manager-grid">
              <article className="manager-panel">
                <div className="manager-panel__head">
                  <h2>Unit Sales Performance Dashboard</h2>
                  <p>Sales outcome snapshot for the current manager scope.</p>
                </div>
                <div className="manager-kpi-grid">
                  <div>
                    <span>Total Leads</span>
                    <strong>{scopeData.summary.totalLeads}</strong>
                  </div>
                  <div>
                    <span>Converted Leads</span>
                    <strong>{scopeData.summary.totalConverted}</strong>
                  </div>
                  <div>
                    <span>Conversion Rate</span>
                    <strong>{scopeData.summary.conversionRate}%</strong>
                  </div>
                  <div>
                    <span>Annual Premium</span>
                    <strong>{formatMoney(scopeData.summary.totalAnnualPremium)}</strong>
                  </div>
                </div>
              </article>

              <article className="manager-panel">
                <div className="manager-panel__head">
                  <h2>Agent Sales Ranking</h2>
                  <p>Top premium contribution inside the unit scope.</p>
                </div>
                <div className="manager-rank-list">
                  {scopeData.salesRows.map((agent) => (
                    <div key={agent.username}>
                      <strong>{agent.name}</strong>
                      <span>{formatMoney(agent.annualPremium)} · {agent.conversionRate}% conversion</span>
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
