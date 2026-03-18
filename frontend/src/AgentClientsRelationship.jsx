import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentClientsRelationship.css";

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
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const didFetchRef = useRef(false);

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

  useEffect(() => {
    if (!isReady || !user?.id) return;
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:5000/api/clients/relationship/dashboard?userId=${user.id}`, {
          signal: controller.signal,
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.message || "Failed to load dashboard metrics.");
        setDashboardData(payload || null);
      } catch {
        setDashboardData(null);
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id]);

  const toPct = (value, total) => {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
  };

  const dashboard = useMemo(() => {
    const totals = dashboardData?.totals || {};
    const prospectMix = dashboardData?.prospectMix || {};
    const policyStatus = dashboardData?.policyStatusCounts || {};

    return {
      totalProspects: Number(totals.prospects || 0),
      totalPolicyholders: Number(totals.policyholders || 0),
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
      sampleProspects: Math.max(Number(totals.prospects || 0), 1),
    };
  }, [dashboardData]);

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
          <h1 className="cr-module-title">Client Relationship Dashboard</h1>

          <div className="cr-content-card cr-dashboard-card">
            <div className="cr-kpis">
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Total Prospects</span>
                <span className="cr-kpiValue">{dashboard.totalProspects}</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Total Policyholders</span>
                <span className="cr-kpiValue">{dashboard.totalPolicyholders}</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Prospect → Policyholder</span>
                <span className="cr-kpiValue">{dashboard.conversionRate}%</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Warm Prospects</span>
                <span className="cr-kpiValue">{dashboard.warmRate}%</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Agent-Sourced</span>
                <span className="cr-kpiValue">{dashboard.sourceRate}%</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Active Policyholders</span>
                <span className="cr-kpiValue">{dashboard.activePolicyRate}%</span>
              </div>
            </div>

            <div className="cr-grid">
              <div className="cr-panel">
                <h3 className="cr-panelTitle">Client Type Distribution</h3>
                <div className="cr-chartRows">
                  <div className="cr-rowLabel">Market Type</div>
                  <div className="cr-progressTrack"><span style={{ width: `${toPct(dashboard.warm, dashboard.sampleProspects)}%` }} /></div>
                  <div className="cr-rowMeta">Warm {dashboard.warm} • Cold {dashboard.cold}</div>

                  <div className="cr-rowLabel">Prospect Type</div>
                  <div className="cr-progressTrack alt"><span style={{ width: `${toPct(dashboard.elite, dashboard.sampleProspects)}%` }} /></div>
                  <div className="cr-rowMeta">Elite {dashboard.elite} • Ordinary {dashboard.ordinary}</div>
                </div>
              </div>

              <div className="cr-panel">
                <h3 className="cr-panelTitle">Source Mix</h3>
                <div className="cr-stackBar">
                  <span className="agent" style={{ width: `${toPct(dashboard.agentSourced, dashboard.sampleProspects)}%` }} />
                  <span className="system" style={{ width: `${toPct(dashboard.systemAssigned, dashboard.sampleProspects)}%` }} />
                </div>
                <div className="cr-legend">
                  <span><i className="dot agent" />Agent-Sourced ({dashboard.agentSourced})</span>
                  <span><i className="dot system" />System-Assigned ({dashboard.systemAssigned})</span>
                </div>
              </div>

              <div className="cr-panel">
                <h3 className="cr-panelTitle">Prospect Relationship Status</h3>
                <div className="cr-statusGrid">
                  {dashboard.statusCounts.map((item) => (
                    <div key={item.status} className="cr-statusCard">
                      <span>{item.status}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cr-panel">
                <h3 className="cr-panelTitle">Policyholder Health</h3>
                <div className="cr-healthGrid">
                  <div><span>Active</span><strong>{dashboard.activePolicies}</strong></div>
                  <div><span>Lapsed</span><strong>{dashboard.lapsedPolicies}</strong></div>
                  <div><span>Cancelled</span><strong>{dashboard.cancelledPolicies}</strong></div>
                </div>
                <p className="cr-muted">Focused on policy relationship lifecycle only.</p>
              </div>

              <div className="cr-panel cr-panel-wide">
                <h3 className="cr-panelTitle">Relationship Pipeline Progress</h3>
                <div className="cr-funnel">
                  {dashboard.stageProgress.map((stage) => (
                    <div key={stage.label} className="cr-stageBlock">
                      <div className="cr-stageTop">
                        <span>{stage.label}</span>
                        <strong>{stage.value}%</strong>
                      </div>
                      <div className="cr-progressTrack stage"><span style={{ width: `${stage.value}%` }} /></div>
                    </div>
                  ))}
                </div>
                <p className="cr-muted">UI scaffold for engagement stage analytics (client relationship context).</p>
              </div>
            </div>

            {loading && <p className="cr-muted" style={{ marginTop: 10 }}>Loading dashboard metrics…</p>}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentClientsRelationship;
