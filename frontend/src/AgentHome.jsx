import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaBullseye, FaChartLine, FaTasks, FaUsers } from "react-icons/fa";
import { FiAlertCircle, FiArrowRight, FiCheckCircle } from "react-icons/fi";
import "./AgentHome.css";
import TopNav from "./components/TopNav";
import { logout } from "./utils/logout";

const API_BASE = "http://localhost:5000";

const DEFAULT_HOME_DATA = {
  clients: {
    totalProspects: 0,
    activeProspects: 0,
    totalPolicyholders: 0,
    totalLeads: 0,
    ongoingLeads: 0,
    activePolicyholders: 0,
    conversionRate: 0,
    activePolicyRate: 0,
    recentProspects: [],
  },
  tasks: {
    dueTodayTop5: [],
    recentlyAddedTop5: [],
    openCount: 0,
    dueTodayCount: 0,
    overdueCount: 0,
  },
  sales: {
    conversionRatePct: 0,
    totalPolicies: 0,
    totalAnnualPremiumPhp: 0,
    bestSource: null,
    currentMonthLabel: "Current Month",
    currentMonthConversionRatePct: 0,
    currentMonthAnnualPremiumPhp: 0,
  },
  kpiProgress: {
    belowTargetCount: 0,
    periodLabel: "Current Month",
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
  const [actionItems, setActionItems] = useState([]);

  const navigateToTop = useCallback((path) => {
    navigate(path);
    window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
  }, [navigate]);

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

    const currentMonthParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const currentMonth = `${currentMonthParts.find((part) => part.type === "year")?.value}-${currentMonthParts.find((part) => part.type === "month")?.value}`;
    const [homeResponse, kpiResponse, notificationsResponse, salesResponse] = await Promise.all([
      fetch(
        `${API_BASE}/api/agent/home?${new URLSearchParams({ userId: user.id }).toString()}`,
        signal ? { signal } : undefined
      ),
      fetch(`${API_BASE}/api/agent/kpi-progress?${new URLSearchParams({ userId: user.id, month: currentMonth }).toString()}`, signal ? { signal } : undefined),
      fetch(`${API_BASE}/api/notifications?${new URLSearchParams({ userId: user.id, includeRefs: "1" }).toString()}`, signal ? { signal } : undefined),
      fetch(`${API_BASE}/api/sales/performance?${new URLSearchParams({ userId: user.id, datePreset: currentMonth, leadSource: "ALL" }).toString()}`, signal ? { signal } : undefined),
    ]);

    const payload = await homeResponse.json();
    const kpiPayload = await kpiResponse.json();
    const notificationsPayload = await notificationsResponse.json();
    const salesPayload = await salesResponse.json();

    if (!homeResponse.ok) throw new Error(payload?.message || "Failed to load agent home preview.");
    if (!kpiResponse.ok) throw new Error(kpiPayload?.message || "Failed to load KPI progress preview.");
    if (!notificationsResponse.ok) throw new Error(notificationsPayload?.message || "Failed to load action items.");
    if (!salesResponse.ok) throw new Error(salesPayload?.message || "Failed to load current-month sales preview.");
    const assignedKpis = Array.isArray(kpiPayload?.kpis) ? kpiPayload.kpis : [];
    const belowTargetCount = assignedKpis.filter((kpi) => {
      const target = [kpi?.targetValue, kpi?.targetMin, kpi?.targetMax]
        .map(Number)
        .find((value) => Number.isFinite(value) && value > 0);
      return target && Number(kpi?.actual || 0) < target;
    }).length;
    const priorityByType = {
      POLICY_LAPSED: "urgent", PAYMENT_MISSED_TRANSFER: "urgent", TASK_MISSED: "urgent",
      TASK_DUE_TODAY: "high", PAYMENT_TRANSFER_REMINDER: "high", PAYMENT_EOR_REMINDER: "high",
      POLICY_CANCELLED: "high", ORPHAN_CLIENT_ASSIGNED: "high",
    };
    const concernKey = (notification) => {
      const metadata = notification?.metadata || {};
      if (["PAYMENT_TRANSFER_REMINDER", "PAYMENT_EOR_REMINDER", "PAYMENT_MISSED_TRANSFER", "POLICY_LAPSED"].includes(notification?.type)) {
        return `payment:${metadata.annualPaymentId || metadata.paymentId || metadata.policyholderId || notification.entityId}`;
      }
      if (["TASK_MISSED", "TASK_DUE_TODAY"].includes(notification?.type)) {
        return `task:${notification?.leadId || metadata.leadId || metadata.taskId || notification?.entityId || notification?._id}`;
      }
      return `${notification?.type}:${metadata.leadId || metadata.policyholderId || metadata.prospectId || notification?.entityId || notification?._id}`;
    };
    const priorityRank = { urgent: 0, high: 1 };
    const actionable = (Array.isArray(notificationsPayload?.notifications) ? notificationsPayload.notifications : [])
      .filter((notification) => notification?.resolutionStatus === "Unresolved" && ["urgent", "high"].includes(priorityByType[notification.type]))
      .map((notification) => ({ ...notification, priority: priorityByType[notification.type] }))
      .sort((left, right) => (priorityRank[left.priority] - priorityRank[right.priority]) || (new Date(right.createdAt || 0) - new Date(left.createdAt || 0)))
      .filter((notification, index, notifications) => notifications.findIndex((candidate) => concernKey(candidate) === concernKey(notification)) === index)
      ;
    setActionItems(actionable);

    setHomeData({
      tasks: {
        dueTodayTop5: Array.isArray(payload?.tasks?.dueTodayTop5) ? payload.tasks.dueTodayTop5 : [],
        recentlyAddedTop5: Array.isArray(payload?.tasks?.recentlyAddedTop5) ? payload.tasks.recentlyAddedTop5 : [],
        openCount: Number(payload?.tasks?.openCount || 0),
        dueTodayCount: Number(payload?.tasks?.dueTodayCount || 0),
        overdueCount: Number(payload?.tasks?.overdueCount || 0),
      },
      clients: {
        totalProspects: Number(payload?.clients?.totalProspects || 0),
        activeProspects: Number(payload?.clients?.activeProspects || 0),
        totalPolicyholders: Number(payload?.clients?.totalPolicyholders || 0),
        totalLeads: Number(payload?.clients?.totalLeads || 0),
        ongoingLeads: Number(payload?.clients?.ongoingLeads || 0),
        activePolicyholders: Number(payload?.clients?.activePolicyholders || 0),
        conversionRate: Number(payload?.clients?.conversionRate || 0),
        activePolicyRate: Number(payload?.clients?.activePolicyRate || 0),
        recentProspects: Array.isArray(payload?.clients?.recentProspects) ? payload.clients.recentProspects : [],
      },
      sales: {
        conversionRatePct: Number(payload?.sales?.conversionRatePct || 0),
        totalPolicies: Number(payload?.sales?.totalPolicies || 0),
        totalAnnualPremiumPhp: Number(payload?.sales?.totalAnnualPremiumPhp || 0),
        bestSource: payload?.sales?.bestSource || null,
        currentMonthLabel: payload?.sales?.currentMonthLabel || "Current Month",
        currentMonthConversionRatePct: Number(salesPayload?.conversionRatePct || 0),
        currentMonthAnnualPremiumPhp: Number(salesPayload?.totalAnnualPremiumPhp || 0),
      },
      kpiProgress: {
        belowTargetCount,
        periodLabel: kpiPayload?.reportContext?.periodLabel || "Current Month",
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
          setActionItems([]);
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

  const moduleCards = [
    {
      key: "clients",
      title: "Clients",
      icon: <FaUsers size={28} className="module-icon" />,
      onClick: () => navigateToTop(`/agent/${user.username}/clients`),
      accent: "clients",
      insights: [
        { label: "Ongoing leads", value: homeData.clients.ongoingLeads },
        { label: "Active policyholders", value: homeData.clients.activePolicyholders },
      ],
    },
    {
      key: "tasks",
      title: "Tasks",
      icon: <FaTasks size={28} className="module-icon" />,
      onClick: () => navigateToTop(`/agent/${user.username}/tasks`),
      accent: "tasks",
      insights: [
        { label: "Overdue tasks", value: homeData.tasks.overdueCount },
        { label: "Tasks due today", value: homeData.tasks.dueTodayCount },
      ],
    },
    {
      key: "sales",
      title: "Sales Performance",
      icon: <FaChartLine size={28} className="module-icon" />,
      onClick: () => navigateToTop(`/agent/${user.username}/sales/performance`),
      accent: "sales",
      insights: [
        { label: `${homeData.sales.currentMonthLabel} active-policy conversion rate`, value: `${homeData.sales.currentMonthConversionRatePct}%` },
        { label: `${homeData.sales.currentMonthLabel} active annual premium generated`, value: `₱ ${money(homeData.sales.currentMonthAnnualPremiumPhp)}` },
      ],
    },
    {
      key: "kpi-progress",
      title: "KPI Progress",
      icon: <FaBullseye size={28} className="module-icon" />,
      onClick: () => navigateToTop(`/agent/${user.username}/kpi/progress`),
      accent: "kpi",
      insights: [
        { label: "Reporting month", value: homeData.kpiProgress.periodLabel },
        { label: "Below target KPIs", value: homeData.kpiProgress.belowTargetCount },
      ],
    },
  ];

  const openActionItem = (notification) => {
    const policyholderId = notification?.metadata?.policyholderId || (notification?.entityType === "Policyholder" ? notification.entityId : "");
    const annualPaymentId = notification?.metadata?.annualPaymentId || "";
    const paymentId = notification?.metadata?.paymentId || "";
    if (String(notification?.type || "") === "PAYMENT_EOR_REMINDER" && policyholderId && annualPaymentId && paymentId) {
      return navigateToTop(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${paymentId}`);
    }
    if (policyholderId && annualPaymentId) return navigateToTop(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}`);
    if (policyholderId) return navigateToTop(`/agent/${user.username}/policyholders/${policyholderId}`);
    const prospectId = notification?.prospectId || notification?.metadata?.prospectId || (notification?.entityType === "Prospect" ? notification.entityId : "");
    const leadId = notification?.leadId || notification?.metadata?.leadId || "";
    if (prospectId && leadId) return navigateToTop(`/agent/${user.username}/prospects/${prospectId}/leads/${leadId}/engage`);
    if (prospectId) return navigateToTop(`/agent/${user.username}/prospects/${prospectId}`);
    return navigateToTop(`/agent/${user.username}/tasks/all`);
  };

  const concernDetails = (notification) => {
    const message = String(notification?.message || "Open this concern to complete the required action.");
    const labels = ["Prospect Code", "Prospect Name", "Lead Code", "Policyholder Code", "Policyholder Name", "Policy Name", "Policy Number"];
    const details = labels.flatMap((label) => {
      const match = message.match(new RegExp(`${label}:\\s*([^.]*)`, "i"));
      return match?.[1]?.trim() ? [{ label, value: match[1].trim() }] : [];
    });
    const taskContext = message.match(/\sfor\s+(.+?)\s+\(Lead\s+([^)]+)\)/i);
    if (taskContext) {
      if (!details.some((detail) => detail.label === "Prospect Name")) details.push({ label: "Prospect Name", value: taskContext[1].trim() });
      if (!details.some((detail) => detail.label === "Lead Code")) details.push({ label: "Lead Code", value: taskContext[2].trim() });
    }
    let summary = labels.reduce(
      (value, label) => value.replace(new RegExp(`\\s*${label}:\\s*[^.]*\\.?`, "ig"), ""),
      message
    ).trim();
    if (taskContext) summary = summary.replace(taskContext[0], "").trim();
    return { summary: summary || notification?.title || "Action required.", details };
  };
  const urgentActionItems = actionItems.filter((notification) => notification.priority === "urgent");
  const highActionItems = actionItems.filter((notification) => notification.priority === "high");

  const renderConcern = (notification) => {
    const concern = concernDetails(notification);
    return <article key={notification._id} className={`home-actionItem ${notification.priority}`}>
      <div>
        <strong>{notification.title}</strong>
        <p>{concern.summary}</p>
        {concern.details.length ? <div className="home-actionDetails">
          {concern.details.map((detail) => <span key={detail.label}><small>{detail.label}</small><b>{detail.value}</b></span>)}
        </div> : null}
      </div>
      <button type="button" onClick={() => openActionItem(notification)}>Open</button>
    </article>;
  };

  return (
    <>
      <TopNav
        user={user}
        onLogoClick={() => navigateToTop(`/agent/${user.username}`)}
        onProfileClick={() => navigateToTop(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigateToTop(`/agent/${user.username}/notifications`)}
      />

      <div className="agent-homePage">
        <section className="home-hero">
          <div className="home-heroCopy">
            <span className="home-kicker">Agent command center</span>
            <h1 className="welcome-text">Welcome back, {user.firstName}.</h1>
            <p className="home-subtext">
              Review current client activity, overdue and due-today tasks, this month’s active-policy results, and assigned KPI reporting at a glance.
            </p>

          </div>

          <div className="module-grid home-heroModules" aria-label="Module navigation">
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
                <div className="module-insights">
                  {module.insights.map((insight) => (
                    <span key={insight.label}>
                      <small>{insight.label}</small>
                      <b>{insight.value}</b>
                    </span>
                  ))}
                </div>
                <span className="module-linkText">
                  Open module
                  <FiArrowRight aria-hidden="true" />
                </span>
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

        <section className="home-actionsSection">
          <div className="home-cardHeader home-cardHeaderStandalone">
            <div>
              <span className="home-cardKicker">Action required</span>
              <h2>Urgent and high-priority concerns</h2>
            </div>
          </div>
          {loading ? <div className="home-emptyState">Loading action items…</div> : actionItems.length ? (
            <div className="home-actionColumns">
              <section className="home-actionColumn urgent">
                <div className="home-actionColumnHeader"><span>Urgent</span><b>{urgentActionItems.length}</b></div>
                <div className="home-actionItemsGrid">
                  {urgentActionItems.length ? urgentActionItems.map(renderConcern) : <div className="home-emptyState compact">No unresolved urgent concerns.</div>}
                </div>
              </section>
              <section className="home-actionColumn high">
                <div className="home-actionColumnHeader"><span>High priority</span><b>{highActionItems.length}</b></div>
                <div className="home-actionItemsGrid">
                  {highActionItems.length ? highActionItems.map(renderConcern) : <div className="home-emptyState compact">No unresolved high-priority concerns.</div>}
                </div>
              </section>
            </div>
          ) : <div className="home-emptyState home-emptyState--success"><FiCheckCircle aria-hidden="true" /> No urgent or high-priority actions require resolution.</div>}
        </section>




      </div>
    </>
  );
}

export default AgentHome;
