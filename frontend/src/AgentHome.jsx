import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaChartLine, FaTasks, FaUsers } from "react-icons/fa";
import { FiAlertCircle, FiArrowRight, FiCheckCircle, FiClock, FiTrendingUp } from "react-icons/fi";
import "./AgentHome.css";
import TopNav from "./components/TopNav";
import { logout } from "./utils/logout";

const API_BASE = "http://localhost:5000";

const DEFAULT_HOME_DATA = {
  clients: {
    totalProspects: 0,
    totalPolicyholders: 0,
    conversionRate: 0,
    activePolicyRate: 0,
    recentProspects: [],
  },
  tasks: {
    dueTodayTop5: [],
    recentlyAddedTop5: [],
  },
  sales: {
    conversionRatePct: 0,
    totalPolicies: 0,
    totalAnnualPremiumPhp: 0,
    bestSource: null,
  },
};

function AgentHome() {
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
  const [homeData, setHomeData] = useState(DEFAULT_HOME_DATA);

  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

  useEffect(() => {
    if (user) {
      document.title = `${user.username} | Home`;
    }
  }, [user]);

  const fetchHomeData = useCallback(async (signal) => {
    if (!user?.id) return;

    const response = await fetch(
      `${API_BASE}/api/agent/home?${new URLSearchParams({ userId: user.id }).toString()}`,
      signal ? { signal } : undefined
    );

    const payload = await response.json();

    if (!response.ok) throw new Error(payload?.message || "Failed to load agent home preview.");

    setHomeData({
      tasks: {
        dueTodayTop5: Array.isArray(payload?.tasks?.dueTodayTop5) ? payload.tasks.dueTodayTop5 : [],
        recentlyAddedTop5: Array.isArray(payload?.tasks?.recentlyAddedTop5) ? payload.tasks.recentlyAddedTop5 : [],
      },
      clients: {
        totalProspects: Number(payload?.clients?.totalProspects || 0),
        totalPolicyholders: Number(payload?.clients?.totalPolicyholders || 0),
        conversionRate: Number(payload?.clients?.conversionRate || 0),
        activePolicyRate: Number(payload?.clients?.activePolicyRate || 0),
        recentProspects: Array.isArray(payload?.clients?.recentProspects) ? payload.clients.recentProspects : [],
      },
      sales: {
        conversionRatePct: Number(payload?.sales?.conversionRatePct || 0),
        totalPolicies: Number(payload?.sales?.totalPolicies || 0),
        totalAnnualPremiumPhp: Number(payload?.sales?.totalAnnualPremiumPhp || 0),
        bestSource: payload?.sales?.bestSource || null,
      },
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchHomeData(controller.signal);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server.");
          setHomeData(DEFAULT_HOME_DATA);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [user?.id, fetchHomeData]);

  if (!user || user.username !== username) return null;

  const money = (n) =>
    Number(n || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const dueTodayCount = homeData.tasks.dueTodayTop5.length;
  const recentTaskCount = homeData.tasks.recentlyAddedTop5.length;
  const recentProspectsCount = homeData.clients.recentProspects.length;

  const topMetrics = [
    { label: "Prospects", value: homeData.clients.totalProspects, icon: <FaUsers aria-hidden="true" /> },
    { label: "Due Today", value: dueTodayCount, icon: <FiClock aria-hidden="true" /> },
    { label: "Policies", value: homeData.sales.totalPolicies, icon: <FiCheckCircle aria-hidden="true" /> },
    { label: "Conversion", value: `${homeData.sales.conversionRatePct}%`, icon: <FiTrendingUp aria-hidden="true" /> },
  ];

  const moduleCards = [
    {
      key: "clients",
      title: "Clients",
      description: "Relationship visibility, recent prospects, and policyholder overview.",
      icon: <FaUsers size={28} className="module-icon" />,
      onClick: () => navigate(`/agent/${user.username}/clients`),
      accent: "clients",
    },
    {
      key: "tasks",
      title: "Tasks",
      description: "Open today’s follow-ups, due items, and execution queues.",
      icon: <FaTasks size={28} className="module-icon" />,
      onClick: () => navigate(`/agent/${user.username}/tasks`),
      accent: "tasks",
    },
    {
      key: "sales",
      title: "Sales Performance",
      description: "Monitor conversion, premium production, and source quality.",
      icon: <FaChartLine size={28} className="module-icon" />,
      onClick: () => navigate(`/agent/${user.username}/sales/performance`),
      accent: "sales",
    },
  ];

  return (
    <>
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="agent-homePage">
        <section className="home-hero">
          <div className="home-heroCopy">
            <span className="home-kicker">Agent command center</span>
            <h1 className="welcome-text">Welcome back, {user.firstName}.</h1>
            <p className="home-subtext">
              Preview your client pipeline, task queue, and sales momentum before jumping into a module.
            </p>

            <div className="home-quickActions">
              <button type="button" className="home-actionBtn primary" onClick={() => navigate(`/agent/${user.username}/tasks`)}>
                Review tasks
              </button>
              <button type="button" className="home-actionBtn" onClick={() => navigate(`/agent/${user.username}/clients/relationship`)}>
                Open client dashboard
              </button>
              <button type="button" className="home-actionBtn" onClick={() => navigate(`/agent/${user.username}/sales/performance`)}>
                View sales performance
              </button>
            </div>
          </div>

          <div className="home-metricsGrid">
            {topMetrics.map((metric) => (
              <div key={metric.label} className="home-metricCard">
                <div className="home-metricIcon">{metric.icon}</div>
                <span className="home-metricLabel">{metric.label}</span>
                <strong className="home-metricValue">{metric.value}</strong>
              </div>
            ))}
          </div>
        </section>

        {apiError ? (
          <div className="home-errorBanner">
            <FiAlertCircle aria-hidden="true" />
            <span>{apiError}</span>
          </div>
        ) : null}

        <section className="home-previewGrid">
          <article className="home-previewCard">
            <div className="home-cardHeader">
              <div>
                <span className="home-cardKicker">Clients</span>
                <h2>Relationship snapshot</h2>
              </div>
              <button type="button" className="home-inlineLink" onClick={() => navigate(`/agent/${user.username}/clients/relationship`)}>
                Open dashboard
                <FiArrowRight aria-hidden="true" />
              </button>
            </div>

            <div className="home-statRow">
              <div className="home-statBlock">
                <span>Total Prospects</span>
                <strong>{homeData.clients.totalProspects}</strong>
              </div>
              <div className="home-statBlock">
                <span>Policyholders</span>
                <strong>{homeData.clients.totalPolicyholders}</strong>
              </div>
              <div className="home-statBlock">
                <span>Conversion Rate</span>
                <strong>{homeData.clients.conversionRate}%</strong>
              </div>
              <div className="home-statBlock">
                <span>Active Policy Rate</span>
                <strong>{homeData.clients.activePolicyRate}%</strong>
              </div>
            </div>

            <div className="home-listBlock">
              <span className="home-listTitle">Recent prospects</span>
              {loading ? (
                <div className="home-emptyState">Loading client preview…</div>
              ) : recentProspectsCount > 0 ? (
                homeData.clients.recentProspects.map((prospect) => (
                  <button
                    key={prospect._id}
                    type="button"
                    className="home-listItem"
                    onClick={() => navigate(`/agent/${user.username}/prospects/${prospect._id}`)}
                  >
                    <div>
                      <strong>{prospect.fullName || prospect.name || "Unnamed prospect"}</strong>
                      <span>{prospect.leadCount || 0} leads • {prospect.marketType || "No market type"}</span>
                    </div>
                    <FiArrowRight aria-hidden="true" />
                  </button>
                ))
              ) : (
                <div className="home-emptyState">No recent prospects to preview yet.</div>
              )}
            </div>
          </article>

          <article className="home-previewCard">
            <div className="home-cardHeader">
              <div>
                <span className="home-cardKicker">Tasks</span>
                <h2>Today’s queue</h2>
              </div>
              <button type="button" className="home-inlineLink" onClick={() => navigate(`/agent/${user.username}/tasks`)}>
                Open tasks
                <FiArrowRight aria-hidden="true" />
              </button>
            </div>

            <div className="home-statRow twoCol">
              <div className="home-statBlock emphasis">
                <span>Due Today</span>
                <strong>{dueTodayCount}</strong>
              </div>
              <div className="home-statBlock">
                <span>Recently Added</span>
                <strong>{recentTaskCount}</strong>
              </div>
            </div>

            <div className="home-listBlock">
              <span className="home-listTitle">Priority items</span>
              {loading ? (
                <div className="home-emptyState">Loading task preview…</div>
              ) : dueTodayCount > 0 ? (
                homeData.tasks.dueTodayTop5.slice(0, 3).map((task) => (
                  <button
                    key={task._id}
                    type="button"
                    className="home-listItem"
                    onClick={() => navigate(`/agent/${user.username}/tasks`)}
                  >
                    <div>
                      <strong>{task.title || "Untitled task"}</strong>
                      <span>{task.prospectName || "No linked prospect"}</span>
                    </div>
                    <span className="home-pill">Due today</span>
                  </button>
                ))
              ) : (
                <div className="home-emptyState">No due-today tasks at the moment.</div>
              )}
            </div>
          </article>

          <article className="home-previewCard">
            <div className="home-cardHeader">
              <div>
                <span className="home-cardKicker">Sales</span>
                <h2>Performance preview</h2>
              </div>
              <button type="button" className="home-inlineLink" onClick={() => navigate(`/agent/${user.username}/sales/performance`)}>
                Open sales
                <FiArrowRight aria-hidden="true" />
              </button>
            </div>

            <div className="home-statRow">
              <div className="home-statBlock">
                <span>Conversion</span>
                <strong>{homeData.sales.conversionRatePct}%</strong>
              </div>
              <div className="home-statBlock">
                <span>Total Policies</span>
                <strong>{homeData.sales.totalPolicies}</strong>
              </div>
              <div className="home-statBlock wide">
                <span>Total Annual Premium</span>
                <strong>₱ {money(homeData.sales.totalAnnualPremiumPhp)}</strong>
              </div>
            </div>

            <div className="home-featureBox">
              <span className="home-listTitle">Best source right now</span>
              {loading ? (
                <div className="home-emptyState compact">Loading sales preview…</div>
              ) : homeData.sales.bestSource ? (
                <>
                  <strong>{homeData.sales.bestSource.label || "Unspecified source"}</strong>
                  <p>
                    {homeData.sales.bestSource.conversionRatePct || 0}% conversion across {homeData.sales.bestSource.convertedLeads || 0} converted leads.
                  </p>
                </>
              ) : (
                <div className="home-emptyState compact">No sales source data available yet.</div>
              )}
            </div>
          </article>
        </section>

        <section className="home-modulesSection">
          <div className="home-cardHeader home-cardHeaderStandalone">
            <div>
              <span className="home-cardKicker">Navigation</span>
              <h2>Jump into a module</h2>
            </div>
          </div>

          <div className="module-grid">
            {moduleCards.map((module) => (
              <div
                key={module.key}
                className={`module-card ${module.accent}`}
                role="button"
                tabIndex={0}
                onClick={module.onClick}
                onKeyDown={(e) => e.key === "Enter" && module.onClick()}
              >
                <div className="module-iconWrap">{module.icon}</div>
                <strong>{module.title}</strong>
                <p>{module.description}</p>
                <span className="module-linkText">
                  Open module
                  <FiArrowRight aria-hidden="true" />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default AgentHome;
