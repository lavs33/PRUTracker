import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentClientsRelationship.css";

const PROSPECT_STATUS = ["Active", "Wrong Contact", "Dropped"];

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
  const [recentProspects, setRecentProspects] = useState([]);
  const [recentPolicyholders, setRecentPolicyholders] = useState([]);
  const [totalProspects, setTotalProspects] = useState(0);
  const [totalPolicyholders, setTotalPolicyholders] = useState(0);
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
        const [prospectsRes, policyholdersRes] = await Promise.all([
          fetch(`http://localhost:5000/api/prospects/recent?userId=${user.id}&limit=20`, { signal: controller.signal }),
          fetch(`http://localhost:5000/api/policyholders/recent?userId=${user.id}&limit=20`, { signal: controller.signal }),
        ]);

        const prospectsData = await prospectsRes.json();
        const policyholdersData = await policyholdersRes.json();

        if (prospectsRes.ok) {
          setRecentProspects(Array.isArray(prospectsData.prospects) ? prospectsData.prospects : []);
          setTotalProspects(Number(prospectsData.totalForThisUser ?? 0));
        }

        if (policyholdersRes.ok) {
          setRecentPolicyholders(Array.isArray(policyholdersData.policyholders) ? policyholdersData.policyholders : []);
          setTotalPolicyholders(Number(policyholdersData.totalForThisUser ?? 0));
        }
      } catch {
        setRecentProspects([]);
        setRecentPolicyholders([]);
        setTotalProspects(0);
        setTotalPolicyholders(0);
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
    const sampleProspects = recentProspects.length || 1;
    const samplePolicyholders = recentPolicyholders.length || 1;

    const warm = recentProspects.filter((p) => p.marketType === "Warm").length;
    const cold = recentProspects.filter((p) => p.marketType === "Cold").length;

    const elite = recentProspects.filter((p) => p.prospectType === "Elite").length;
    const ordinary = recentProspects.filter((p) => p.prospectType === "Ordinary").length;

    const systemAssigned = recentProspects.filter((p) => p.source === "System-Assigned").length;
    const agentSourced = recentProspects.filter((p) => p.source === "Agent-Sourced").length;

    const statusCounts = PROSPECT_STATUS.map((status) => ({
      status,
      value: recentProspects.filter((p) => p.status === status).length,
    }));

    const activePolicies = recentPolicyholders.filter((p) => p.status === "Active").length;
    const lapsedPolicies = recentPolicyholders.filter((p) => p.status === "Lapsed").length;
    const cancelledPolicies = recentPolicyholders.filter((p) => p.status === "Cancelled").length;

    const conversionRate = toPct(totalPolicyholders, totalProspects || 1);
    const warmRate = toPct(warm, sampleProspects);
    const activePolicyRate = toPct(activePolicies, samplePolicyholders);
    const sourceRate = toPct(agentSourced, sampleProspects);

    // UI-only staged progress scaffold (relationship-focused, not tasks)
    const stageProgress = [
      { label: "Contacting", value: 78 },
      { label: "Needs Assessment", value: 64 },
      { label: "Proposal", value: 49 },
      { label: "Application", value: 37 },
      { label: "Policy Issuance", value: 26 },
    ];

    return {
      warm,
      cold,
      elite,
      ordinary,
      systemAssigned,
      agentSourced,
      statusCounts,
      activePolicies,
      lapsedPolicies,
      cancelledPolicies,
      conversionRate,
      warmRate,
      activePolicyRate,
      sourceRate,
      stageProgress,
      sampleProspects,
      samplePolicyholders,
    };
  }, [recentProspects, recentPolicyholders, totalProspects, totalPolicyholders]);

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
      case "sales_performance":
        navigate(`/agent/${user.username}/sales/performance`);
        break;
      case "sales":
        alert("Sales module coming soon");
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
                <span className="cr-kpiValue">{totalProspects}</span>
              </div>
              <div className="cr-kpiTile">
                <span className="cr-kpiLabel">Total Policyholders</span>
                <span className="cr-kpiValue">{totalPolicyholders}</span>
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
