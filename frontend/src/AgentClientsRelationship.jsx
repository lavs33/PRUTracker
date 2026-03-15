import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentClients.css";

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
          fetch(`http://localhost:5000/api/prospects/recent?userId=${user.id}&limit=10`, { signal: controller.signal }),
          fetch(`http://localhost:5000/api/policyholders/recent?userId=${user.id}&limit=5`, { signal: controller.signal }),
        ]);

        const prospectsData = await prospectsRes.json();
        const policyholdersData = await policyholdersRes.json();

        if (prospectsRes.ok) {
          setRecentProspects(Array.isArray(prospectsData.prospects) ? prospectsData.prospects : []);
          setTotalProspects(Number(prospectsData.totalForThisUser ?? 0));
        }

        if (policyholdersRes.ok) {
          setTotalPolicyholders(Number(policyholdersData.totalForThisUser ?? 0));
        }
      } catch {
        setRecentProspects([]);
        setTotalProspects(0);
        setTotalPolicyholders(0);
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id]);

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
      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;
      case "sales":
        alert("Sales module coming soon");
        break;
      default:
        break;
    }
  };

  return (
    <div className="page-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="page-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="page-content">
          <h1 className="module-title">Client Relationship Dashboard</h1>

          <div className="content-card dashboard-card">
            <div className="crd-kpis">
              <div className="crd-kpiTile"><span className="crd-kpiLabel">Total Prospects</span><span className="crd-kpiValue">{totalProspects}</span></div>
              <div className="crd-kpiTile"><span className="crd-kpiLabel">Total Policyholders</span><span className="crd-kpiValue">{totalPolicyholders}</span></div>
              <div className="crd-kpiTile"><span className="crd-kpiLabel">Leads In Progress</span><span className="crd-kpiValue">{recentProspects.reduce((sum, p) => sum + Number(p.leadsInProgress || 0), 0)}</span></div>
              <div className="crd-kpiTile"><span className="crd-kpiLabel">Open Tasks</span><span className="crd-kpiValue">—</span></div>
              <div className="crd-kpiTile"><span className="crd-kpiLabel">Due Today</span><span className="crd-kpiValue">—</span></div>
              <div className="crd-kpiTile"><span className="crd-kpiLabel">Unread Notifications</span><span className="crd-kpiValue">—</span></div>
            </div>

            <div className="crd-grid">
              <div className="crd-panel">
                <h3 className="crd-panelTitle">Pipeline Snapshot</h3>
                <div className="crd-funnel">
                  {["Contacting", "Needs Assessment", "Proposal", "Application", "Policy Issuance"].map((stage) => (
                    <div key={stage} className="crd-stageRow">
                      <span className="crd-stageName">{stage}</span>
                      <span className="crd-stageValue">—</span>
                    </div>
                  ))}
                </div>
                <p className="ac-muted">UI-only preview: stage counts to be wired next.</p>
              </div>

              <div className="crd-panel">
                <h3 className="crd-panelTitle">Needs Attention</h3>
                <ul className="crd-list">
                  <li>Tasks due today</li>
                  <li>Upcoming payments (next 7 days)</li>
                  <li>Overdue payments</li>
                  <li>Recently added leads</li>
                </ul>
                <p className="ac-muted">UI-only preview: actionable lists to be connected to APIs.</p>
              </div>
            </div>

            {loading && <p className="ac-muted" style={{ marginTop: 10 }}>Loading dashboard metrics…</p>}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentClientsRelationship;
