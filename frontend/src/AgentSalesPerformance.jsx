import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentSalesPerformance.css";

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
          <h1 className="sp-title">Sales Performance Dashboard</h1>

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
