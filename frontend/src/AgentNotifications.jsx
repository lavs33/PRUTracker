import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentNotifications.css";

const UNIT_KPI_NOTIF_TYPES = ["UNIT_KPI_ASSIGNED", "UNIT_KPI_TARGET_UPDATED", "UNIT_KPI_UNASSIGNED"];
const AGENT_KPI_NOTIF_TYPES = ["AGENT_KPI_ASSIGNED", "AGENT_KPI_TARGET_UPDATED", "AGENT_KPI_UNASSIGNED"];
const KPI_NOTIF_TYPES = [...UNIT_KPI_NOTIF_TYPES, ...AGENT_KPI_NOTIF_TYPES];
const KPI_UNASSIGNED_NOTIF_TYPES = ["UNIT_KPI_UNASSIGNED", "AGENT_KPI_UNASSIGNED"];
const NOTIF_TYPES = ["UM_RECOMMENDATION", "AUM_RECOMMENDATION", "TASK_ADDED", "TASK_DUE_TODAY", "TASK_MISSED", "PAYMENT_TRANSFER_REMINDER", "PAYMENT_EOR_REMINDER", "PAYMENT_MISSED_TRANSFER", "POLICY_LAPSED", "POLICY_PAID_UP", "POLICY_MATURED", "POLICY_PAID_UP_MATURED", "POLICY_CANCELLED", "ORPHAN_CLIENT_ASSIGNED", "ORPHAN_CLIENT_TRANSFERRED", ...KPI_NOTIF_TYPES];
const PRIORITY_LEVELS = ["urgent", "high", "normal", "informational"];
const NOTIFICATIONS_PER_PAGE = 15;
const PRIORITY_BY_TYPE = {
  UM_RECOMMENDATION: "urgent",
  AUM_RECOMMENDATION: "urgent",
  POLICY_LAPSED: "urgent",
  PAYMENT_MISSED_TRANSFER: "urgent",
  TASK_MISSED: "urgent",
  TASK_DUE_TODAY: "high",
  PAYMENT_TRANSFER_REMINDER: "high",
  PAYMENT_EOR_REMINDER: "high",
  POLICY_CANCELLED: "high",
  ORPHAN_CLIENT_ASSIGNED: "high",
  TASK_ADDED: "normal",
  AGENT_KPI_ASSIGNED: "normal",
  AGENT_KPI_TARGET_UPDATED: "normal",
  AGENT_KPI_UNASSIGNED: "normal",
  UNIT_KPI_ASSIGNED: "normal",
  UNIT_KPI_TARGET_UPDATED: "normal",
  UNIT_KPI_UNASSIGNED: "normal",
  POLICY_PAID_UP: "informational",
  POLICY_MATURED: "informational",
  POLICY_PAID_UP_MATURED: "informational",
  ORPHAN_CLIENT_TRANSFERRED: "informational",
};

const notificationPriority = (type) => PRIORITY_BY_TYPE[String(type || "").trim().toUpperCase()] || "normal";

const notificationWithinDateRange = (notification, dateRange) => {
  if (dateRange === "all") return true;
  const timestamp = new Date(notification?.createdAt || 0);
  if (Number.isNaN(timestamp.getTime())) return false;
  const now = new Date();
  let start = new Date(now);
  if (dateRange === "today") start.setHours(0, 0, 0, 0);
  else if (dateRange === "7d") start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  else if (dateRange === "30d") start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  else if (dateRange === "90d") start = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
  else if (dateRange === "6m") start.setMonth(start.getMonth() - 6);
  else if (dateRange === "12m") start.setFullYear(start.getFullYear() - 1);
  return timestamp >= start && timestamp <= now;
};

const notificationResolution = (notification) => KPI_UNASSIGNED_NOTIF_TYPES.includes(String(notification?.type || "").trim().toUpperCase())
  ? "Not Applicable"
  : String(notification?.resolutionStatus || "Not Applicable").trim();
const taskNotificationOrder = {
  TASK_MISSED: 0,
  TASK_DUE_TODAY: 1,
  TASK_ADDED: 2,
};
const notificationCreatedTime = (notification) => {
  const timestamp = new Date(notification?.createdAt || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
const compareAgentNotifications = (a, b) => {
  const createdDifference = notificationCreatedTime(b) - notificationCreatedTime(a);
  if (createdDifference !== 0) return createdDifference;

  const aTaskOrder = taskNotificationOrder[String(a?.type || "").toUpperCase()];
  const bTaskOrder = taskNotificationOrder[String(b?.type || "").toUpperCase()];
  if (aTaskOrder !== undefined && bTaskOrder !== undefined) return aTaskOrder - bTaskOrder;
  return 0;
};
const filterNotifications = (notifications, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignorePriority = false, ignoreResolution = false }) => {
  const normalizedType = String(typeFilter || "").trim().toUpperCase();
  return notifications.filter((notification) => (
    (!normalizedType || String(notification?.type || "").trim().toUpperCase() === normalizedType)
    && (ignorePriority || priorityFilter === "all" || notificationPriority(notification?.type) === priorityFilter)
    && (ignoreResolution || resolutionFilter === "all" || notificationResolution(notification) === resolutionFilter)
    && notificationWithinDateRange(notification, dateRange)
  ));
};

const orphanClientSections = (message = "") => {
  const text = String(message || "").trim();
  const prospectMatch = text.match(/Prospect Name:\s*(.*?)\.\s*(?=Leads:)/i);
  const withoutProspect = prospectMatch ? text.replace(prospectMatch[0], "") : text;
  const policyStart = withoutProspect.indexOf("Policyholders:");
  const leadsText = withoutProspect.startsWith("Leads:")
    ? withoutProspect.slice("Leads:".length, policyStart >= 0 ? policyStart : undefined).trim().replace(/[.\s]+$/, "")
    : "";
  const policiesText = policyStart >= 0
    ? withoutProspect.slice(policyStart + "Policyholders:".length).trim().replace(/[.\s]+$/, "")
    : "";
  const parseItems = (value, labels) => (
    !value || /^none$/i.test(value)
      ? []
      : value.split(/;\s*/).filter(Boolean).map((entry) => {
          const values = entry.split(/\s+\/\s+/).map((part) => part.trim());
          return labels.map((label, index) => ({ label, value: values[index] || "—" }));
        })
  );
  return {
    prospectName: prospectMatch?.[1] || "",
    sections: [
      { title: "Leads", items: parseItems(leadsText, ["Lead code", "Source", "Status"]) },
      { title: "Policies", items: parseItems(policiesText, ["Policyholder code", "Product", "Policy number", "Status"]) },
    ],
  };
};

const OrphanClientMessage = ({ notification }) => {
  const { prospectName, sections } = orphanClientSections(notification?.message);
  const displayedProspectName = prospectName || String(notification?.prospectName || "").trim();
  return (
    <div className="notif-msg notif-msg--orphan-client">
      {displayedProspectName && displayedProspectName !== "—" ? (
        <div className="notif-orphan-prospect">
          <b>Prospect name</b>
          <strong>{displayedProspectName}</strong>
        </div>
      ) : null}
      {sections.map((section) => (
        <section className="notif-orphan-section" key={section.title}>
          <div className="notif-orphan-heading"><strong>{section.title}</strong><span>{section.items.length}</span></div>
          {section.items.length ? (
            <ul className="notif-orphan-list">
              {section.items.map((item, index) => (
                <li key={`${section.title}-${index}`}>
                  {item.map((field) => <span key={field.label}><b>{field.label}</b><em>{field.value}</em></span>)}
                </li>
              ))}
            </ul>
          ) : <p>None.</p>}
        </section>
      ))}
    </div>
  );
};

const SalesRecommendationMessage = ({ notification }) => {
  const metadata = notification?.metadata || {};
  const metrics = [["Agent Sales Production", metadata.agentContribution || "—"], ["Unit Sales Production", metadata.unitProduction || "—"], ["Unit Sales Production Target", metadata.unitTarget || "—"], ["Unit Sales Production Share", metadata.contributionShare || "0.0%"], ["Reporting Period", metadata.periodLabel || "—"]];
  const recommendation = String(notification?.message || "").split(/Recommended action:/i)[1]?.trim() || "Strengthen sales production.";
  return <div className="notif-agent-recommendation"><div className="notif-agent-recommendation__metrics">{metrics.map(([label, value]) => <article key={label}><small>{label}</small><b>{value}</b></article>)}</div><p>Your contribution is below the unit fair-share benchmark of <b>{metadata.fairShare || "—"}</b>.</p><div className="notif-agent-recommendation__action"><strong>Recommended action:</strong><span>{recommendation}</span></div></div>;
};

function AgentNotifications() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const API_BASE = "http://localhost:5000";

  // Tabs: unread | read
  const [tab, setTab] = useState("unread");

  // Filter: type only
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [resolutionFilter, setResolutionFilter] = useState(() => {
    const requestedResolution = new URLSearchParams(window.location.search).get("resolution");
    return ["Unresolved", "Resolved"].includes(requestedResolution) ? requestedResolution : "all";
  });

  // list state
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [notifs, setNotifs] = useState([]);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingNotifId, setMarkingNotifId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const tabsRef = useRef(null);
  const notificationsCacheRef = useRef(null);

  // counts state (always numeric)
  const [counts, setCounts] = useState({ unread: 0, read: 0 });
  const [priorityCounts, setPriorityCounts] = useState({ urgent: 0, high: 0, normal: 0, informational: 0 });
  const [resolutionCounts, setResolutionCounts] = useState({ all: 0, unresolved: 0, resolved: 0 });

  // Guard
  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Notifications`;
  }, [username]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, typeFilter, priorityFilter, resolutionFilter, dateRange]);

  const formatWhen = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

      // notifications route exists for bell
      case "notifications":
        navigate(`/agent/${user.username}/notifications`);
        break;

      case "sales": navigate(`/agent/${user.username}/sales/performance`); break;
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;

      default:
        break;
    }
  };

  // One request supplies both tabs and their counts. Previously this screen
  // requested the same expensive notification hydration three times per load.
  const fetchNotifs = useCallback(
    async (signal, forceRefresh = false) => {
      if (!user?.id) return;

      let allNotifications = !forceRefresh ? notificationsCacheRef.current : null;
      if (!allNotifications) {
        const qs = new URLSearchParams({ userId: user.id, includeRefs: "1" });
        const res = await fetch(
          `${API_BASE}/api/notifications?${qs.toString()}`,
          { ...(signal ? { signal } : {}), cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications.");
        allNotifications = Array.isArray(data?.notifications) ? data.notifications : [];
        notificationsCacheRef.current = allNotifications;
      }
      const countForStatus = (status) => filterNotifications(
        allNotifications.filter((notification) => notification.status === status),
        { typeFilter, priorityFilter, resolutionFilter, dateRange }
      ).length;
      setCounts({ unread: countForStatus("Unread"), read: countForStatus("Read") });
      const arr = allNotifications.filter((notification) => notification.status === (tab === "read" ? "Read" : "Unread"));
      const resolutionCountBase = filterNotifications(arr, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignoreResolution: true });
      setResolutionCounts({
        all: resolutionCountBase.length,
        unresolved: resolutionCountBase.filter((notification) => notificationResolution(notification) === "Unresolved").length,
        resolved: resolutionCountBase.filter((notification) => notificationResolution(notification) === "Resolved").length,
      });
      const typeFiltered = filterNotifications(arr, { typeFilter, priorityFilter, resolutionFilter, dateRange, ignorePriority: true });
      setPriorityCounts(PRIORITY_LEVELS.reduce((result, priority) => ({
        ...result,
        [priority]: typeFiltered.filter((notification) => notificationPriority(notification?.type) === priority).length,
      }), {}));
      const priorityFiltered = priorityFilter === "all"
        ? typeFiltered
        : typeFiltered.filter((notification) => notificationPriority(notification?.type) === priorityFilter);
      setNotifs([...priorityFiltered].sort(compareAgentNotifications));
    },
    [API_BASE, user?.id, tab, typeFilter, priorityFilter, resolutionFilter, dateRange]
  );

  const applyReadToCache = (ids = null) => {
    const idSet = ids ? new Set(ids.map(String)) : null;
    const readAt = new Date().toISOString();
    notificationsCacheRef.current = (notificationsCacheRef.current || []).map((notification) => (
      notification.status === "Unread" && (!idSet || idSet.has(String(notification._id)))
        ? { ...notification, status: "Read", readAt }
        : notification
    ));
  };
  const notifyUnreadChanged = () => window.dispatchEvent(new CustomEvent("notifications:changed", {
    detail: { unreadCount: (notificationsCacheRef.current || []).filter((notification) => notification.status === "Unread").length },
  }));

  // Load counts + list
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchNotifs(controller.signal);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server. Is backend running?");
          setNotifs([]);
          setCounts({ unread: 0, read: 0 });
          setPriorityCounts({ urgent: 0, high: 0, normal: 0, informational: 0 });
          setResolutionCounts({ all: 0, unresolved: 0, resolved: 0 });
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [user?.id, fetchNotifs]);

  const typePillClass = (type) => {
    const t = String(type || "").toUpperCase();
    if (t === "TASK_ADDED") return "notif-pill added";
    if (t === "TASK_DUE_TODAY") return "notif-pill due";
    if (t === "TASK_MISSED") return "notif-pill missed";
    if (t === "PAYMENT_TRANSFER_REMINDER" || t === "PAYMENT_EOR_REMINDER" || t === "PAYMENT_MISSED_TRANSFER" || t === "POLICY_LAPSED" || t === "POLICY_PAID_UP" || t === "POLICY_MATURED" || t === "POLICY_PAID_UP_MATURED" || t === "POLICY_CANCELLED") return "notif-pill payment";
    if (t === "ORPHAN_CLIENT_ASSIGNED" || t === "ORPHAN_CLIENT_TRANSFERRED") return "notif-pill orphan";
    if (t === "UM_RECOMMENDATION") return "notif-pill um-recommendation";
    if (t === "AUM_RECOMMENDATION") return "notif-pill aum-recommendation";
    if (t === "UNIT_KPI_ASSIGNED" || t === "AGENT_KPI_ASSIGNED") return "notif-pill kpi-assigned";
    if (t === "UNIT_KPI_TARGET_UPDATED" || t === "AGENT_KPI_TARGET_UPDATED") return "notif-pill kpi-updated";
    if (t === "UNIT_KPI_UNASSIGNED" || t === "AGENT_KPI_UNASSIGNED") return "notif-pill kpi-unassigned";
    return "notif-pill";
  };

  const markNotifAsRead = async (notifId) => {
    if (!user?.id || !notifId) return;
    setMarkingNotifId(String(notifId));
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${notifId}/read?userId=${user.id}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to mark notification as read.");
      applyReadToCache([notifId]);
      await fetchNotifs();
      notifyUnreadChanged();
    } catch (err) {
      setApiError(err?.message || "Failed to mark notification as read.");
    } finally {
      setMarkingNotifId("");
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    setMarkingAllRead(true);
    try {
      if (priorityFilter !== "all" || resolutionFilter !== "all" || dateRange !== "all") {
        const ids = notifs.map((notification) => notification._id);
        const res = await fetch(`${API_BASE}/api/notifications/read-many?userId=${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) throw new Error("Failed to mark all filtered notifications as read.");
        applyReadToCache(ids);
        await fetchNotifs();
        notifyUnreadChanged();
        return;
      }
      const qs = new URLSearchParams({
        userId: user.id,
      });
      if (typeFilter) qs.set("type", typeFilter);

      const res = await fetch(`${API_BASE}/api/notifications/read-all?${qs.toString()}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to mark all notifications as read.");
      const matchingIds = (notificationsCacheRef.current || [])
        .filter((notification) => notification.status === "Unread" && (!typeFilter || notification.type === typeFilter))
        .map((notification) => notification._id);
      applyReadToCache(matchingIds);
      await fetchNotifs();
      notifyUnreadChanged();
    } catch (err) {
      setApiError(err?.message || "Failed to mark all notifications as read.");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const isOpenDisabled = (n) => String(n?.type || "") === "ORPHAN_CLIENT_TRANSFERRED"
    || n?.metadata?.transferredAway === true
    || n?.transferredAwayForViewer === true;

  const openNotif = async (n) => {
    if (["UM_RECOMMENDATION", "AUM_RECOMMENDATION"].includes(String(n?.type || "").toUpperCase())) {
      navigate(`/agent/${username}/sales/performance`);
      return;
    }
    if (isOpenDisabled(n)) return;
    const metadataProspectId = n?.metadata?.prospectId || (n.entityType === "Prospect" ? n.entityId : "");
    const metadataLeadId = n?.metadata?.leadId || "";
    const policyholderId = n?.metadata?.policyholderId || (n.entityType === "Policyholder" ? n.entityId : "");
    const annualPaymentId = n?.metadata?.annualPaymentId || "";
    const paymentId = n?.metadata?.paymentId || "";
    if (String(n?.type || "") === "PAYMENT_EOR_REMINDER" && policyholderId && annualPaymentId && paymentId) {
      navigate(`/agent/${username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${paymentId}`);
      return;
    }
    if (policyholderId && annualPaymentId) {
      navigate(`/agent/${username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}`);
      return;
    }

    if (policyholderId) {
      navigate(`/agent/${username}/policyholders/${policyholderId}`);
      return;
    }

    const prospectId = n.prospectId || metadataProspectId;
    const leadId = n.leadId || metadataLeadId;

    if (String(n?.type || "") !== "ORPHAN_CLIENT_ASSIGNED" && prospectId && leadId) {
      navigate(`/agent/${username}/prospects/${prospectId}/leads/${leadId}/engage`);
      return;
    }

    if (prospectId) {
      navigate(`/agent/${username}/prospects/${prospectId}`);
      return;
    }

    navigate(`/agent/${username}/tasks/all`);
  };

  const NotifRow = ({ n }) => (
    <div className={`notif-row ${n.status === "Unread" ? "unread" : ""}`}>
      <div className="notif-left">
        <div className="notif-topline">
          {n.status === "Unread" ? <span className="notif-dot" aria-label="Unread" /> : null}
          <span className={typePillClass(n.type)}>{n.type}</span>
          <span className={`notif-priority notif-priority--${notificationPriority(n.type)}`}>{notificationPriority(n.type)}</span>
          {notificationResolution(n) !== "Not Applicable" ? <span className={`notif-resolution notif-resolution--${notificationResolution(n).toLowerCase()}`}>{notificationResolution(n)}</span> : null}
          <span className="notif-time">{formatWhen(n.createdAt)}</span>
        </div>

        <div className="notif-title">{n.title}</div>
        {String(n.message || "").trim()
          ? (["ORPHAN_CLIENT_ASSIGNED", "ORPHAN_CLIENT_TRANSFERRED"].includes(String(n.type || "").toUpperCase())
            ? <OrphanClientMessage notification={n} />
            : (["UM_RECOMMENDATION", "AUM_RECOMMENDATION"].includes(String(n.type || "").toUpperCase())
              ? <SalesRecommendationMessage notification={n} />
              : <div className="notif-msg">{n.message}</div>))
          : null}
      </div>

      <div className="notif-right">
        {n.status === "Read" && !KPI_NOTIF_TYPES.includes(String(n?.type || "").toUpperCase()) ? (
          <button
            type="button"
            className="notif-btn ghost"
            onClick={() => openNotif(n)}
            disabled={isOpenDisabled(n)}
            title={isOpenDisabled(n) ? "🚫" : "Open notification record"}
          >
            Open
          </button>
        ) : null}
        {n.status === "Unread" ? (
          <button
            type="button"
            className="notif-btn secondary"
            onClick={() => markNotifAsRead(n._id)}
            disabled={markingNotifId === String(n._id) || markingAllRead}
          >
            {markingNotifId === String(n._id) ? "Marking..." : "Mark as Read"}
          </button>
        ) : null}
      </div>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(notifs.length / NOTIFICATIONS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedNotifs = notifs.slice(
    (safeCurrentPage - 1) * NOTIFICATIONS_PER_PAGE,
    safeCurrentPage * NOTIFICATIONS_PER_PAGE
  );
  const changePage = (nextPage) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)));
    window.requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (!user || user.username !== username) return null;

  return (
    <div className="notifs-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="notifs-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="notifs-content">
          <div className="notifs-headerRow">
            <div>
              <h1 className="notifs-title">Notifications</h1>
            </div>
          </div>

          {/* Tabs + Type filter */}
          <div ref={tabsRef} className="notifs-toolbar">
            <div className="notifs-tabs">
              <button
                type="button"
                className={`notifs-tab is-unread ${tab === "unread" ? "active" : ""}`}
                onClick={() => setTab("unread")}
              >
                Unread <span className="notifs-badge unread">{counts.unread}</span>
              </button>

              <button
                type="button"
                className={`notifs-tab is-read ${tab === "read" ? "active" : ""}`}
                onClick={() => setTab("read")}
              >
                Read <span className="notifs-badge read">{counts.read}</span>
              </button>
            </div>

            <div className="notifs-filter">
              <select
                className="notifs-select"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                aria-label="Notification priority filter"
              >
                <option value="all">All Priorities ({PRIORITY_LEVELS.reduce((total, priority) => total + Number(priorityCounts[priority] || 0), 0)})</option>
                {PRIORITY_LEVELS.map((priority) => (
                  <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)} ({priorityCounts[priority]})</option>
                ))}
              </select>

              <select
                className="notifs-select"
                value={resolutionFilter}
                onChange={(e) => setResolutionFilter(e.target.value)}
                aria-label="Notification resolution filter"
              >
                <option value="all">All Resolution Statuses ({resolutionCounts.all})</option>
                <option value="Unresolved">Unresolved ({resolutionCounts.unresolved})</option>
                <option value="Resolved">Resolved ({resolutionCounts.resolved})</option>
              </select>

              <select
                className="notifs-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {NOTIF_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                className="notifs-select"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                aria-label="Notification date range filter"
              >
                <option value="all">All Time</option>
                <option value="today">This Day</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="6m">Last 6 Months</option>
                <option value="12m">Last 12 Months</option>
              </select>

              <button type="button" className="notif-btn ghost" onClick={() => { setTypeFilter(""); setPriorityFilter("all"); setResolutionFilter("all"); setDateRange("all"); }} disabled={!typeFilter && priorityFilter === "all" && resolutionFilter === "all" && dateRange === "all"}>
                Clear
              </button>

              <button
                type="button"
                className="notif-btn secondary"
                onClick={markAllAsRead}
                disabled={tab !== "unread" || markingAllRead || counts.unread <= 0}
              >
                {markingAllRead ? "Marking..." : "Mark All as Read"}
              </button>
            </div>
          </div>

          {/* Loading / Error */}
          {loading ? <div className="notifs-empty">Loading notifications...</div> : null}

          {!loading && apiError ? (
            <div className="notifs-empty" style={{ color: "#FFFFFF" }}>
              {apiError}
            </div>
          ) : null}

          {/* List */}
          {!loading && !apiError ? (
            <div className="notifs-list">
              {notifs.length === 0 ? (
                <div className="notifs-empty">
                  {tab === "unread" ? "No unread notifications." : "No read notifications."}
                </div>
              ) : (
                paginatedNotifs.map((n) => <NotifRow key={n._id} n={n} />)
              )}
            </div>
          ) : null}
          {!loading && !apiError && notifs.length > 0 ? (
            <nav className="notifs-pagination" aria-label="Notifications pagination">
              <span>
                Showing {(safeCurrentPage - 1) * NOTIFICATIONS_PER_PAGE + 1}–{Math.min(safeCurrentPage * NOTIFICATIONS_PER_PAGE, notifs.length)} of {notifs.length}
              </span>
              <div>
                <span title={safeCurrentPage === 1 ? "🚫 You are already on the first page." : "Go to the previous page"}>
                  <button type="button" className="notif-btn ghost" onClick={() => changePage(safeCurrentPage - 1)} disabled={safeCurrentPage === 1} aria-disabled={safeCurrentPage === 1}>Previous</button>
                </span>
                <strong>Page {safeCurrentPage} of {totalPages}</strong>
                <span title={safeCurrentPage === totalPages ? "🚫 You are already on the last page." : "Go to the next page"}>
                  <button type="button" className="notif-btn ghost" onClick={() => changePage(safeCurrentPage + 1)} disabled={safeCurrentPage === totalPages} aria-disabled={safeCurrentPage === totalPages}>Next</button>
                </span>
              </div>
            </nav>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default AgentNotifications;
