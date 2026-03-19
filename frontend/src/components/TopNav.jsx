import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { FaBell } from "react-icons/fa";
import { FiActivity, FiCalendar, FiChevronRight, FiCommand, FiShield } from "react-icons/fi";
import logo from "../assets/prutracker-navbar-logo.png";
import "./TopNav.css";

function TopNav({ user, onLogoClick, onProfileClick, onLogout, onNotificationsClick }) {
  const API_BASE = "http://localhost:5000";
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async (signal) => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/notifications/unread-count?userId=${user.id}&entityType=Task`,
        signal ? { signal } : undefined
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch unread count.");

      setUnreadCount(Number(data?.unreadCount || 0));
    } catch (err) {
      setUnreadCount(0);
    }
  }, [API_BASE, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchUnreadCount(controller.signal);
    return () => controller.abort();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!user?.id) return;

    const tick = () => fetchUnreadCount();
    const id = window.setInterval(tick, 30_000);

    return () => window.clearInterval(id);
  }, [user?.id, fetchUnreadCount]);

  const handleNotifications = (e) => {
    e.stopPropagation();
    if (onNotificationsClick) return onNotificationsClick();
  };

  const routeMeta = useMemo(() => {
    const path = location.pathname;

    if (path.includes("/notifications")) {
      return {
        eyebrow: "Inbox",
        title: "Notifications hub",
        subtitle: "Monitor workflow alerts, reminders, and follow-up activity.",
        metricLabel: "Unread alerts",
      };
    }

    if (path.includes("/sales/performance")) {
      return {
        eyebrow: "Revenue",
        title: "Sales performance workspace",
        subtitle: "Track production trends, close rates, and advisor momentum.",
        metricLabel: "Pipeline alerts",
      };
    }

    if (path.includes("/tasks/progress")) {
      return {
        eyebrow: "Execution",
        title: "Task progress monitor",
        subtitle: "Review active milestones, bottlenecks, and next-step readiness.",
        metricLabel: "Open blockers",
      };
    }

    if (path.includes("/tasks/all")) {
      return {
        eyebrow: "Execution",
        title: "Task operations board",
        subtitle: "Scan the full delivery queue and prioritize outreach efficiently.",
        metricLabel: "Open tasks",
      };
    }

    if (path.includes("/tasks")) {
      return {
        eyebrow: "Execution",
        title: "Task command center",
        subtitle: "Stay on top of assignments, reminders, and advisor follow-through.",
        metricLabel: "Due soon",
      };
    }

    if (path.includes("/clients/relationship")) {
      return {
        eyebrow: "Relationships",
        title: "Client relationship map",
        subtitle: "Understand household ties, referrals, and account adjacency at a glance.",
        metricLabel: "Engagement alerts",
      };
    }

    if (path.includes("/policyholders")) {
      return {
        eyebrow: "Coverage",
        title: "Policyholder portfolio",
        subtitle: "Review active coverage, policy ownership, and servicing opportunities.",
        metricLabel: "Service items",
      };
    }

    if (path.includes("/prospects")) {
      return {
        eyebrow: "Pipeline",
        title: "Prospect pipeline workspace",
        subtitle: "Manage lead flow, outreach readiness, and prospect conversion momentum.",
        metricLabel: "Warm leads",
      };
    }

    if (path.match(/\/agent\/[^/]+\/profile/)) {
      return {
        eyebrow: "Profile",
        title: "Advisor profile desk",
        subtitle: "Maintain your working identity, contact details, and workspace context.",
        metricLabel: "Account notices",
      };
    }

    return {
      eyebrow: "Workspace",
      title: "Agent command center",
      subtitle: "Navigate clients, tasks, and sales priorities from one unified control bar.",
      metricLabel: "Live alerts",
    };
  }, [location.pathname]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    []
  );

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "Advisor";
  const initials = useMemo(() => {
    const seed = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "A";
    return seed
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [user?.firstName, user?.lastName, user?.username]);

  const showBadge = unreadCount > 0;

  return (
    <nav className="top-nav">
      <div className="tn-command-shell">
        <button type="button" className="tn-brandPanel" onClick={onLogoClick} aria-label="Go to dashboard home">
          <div className="tn-brandLogoWrap">
            <img src={logo} alt="PRUTracker" className="tn-logo" />
          </div>

          <div className="tn-brandCopy">
            <span className="tn-kicker">CRM command bar</span>
            <div className="tn-headingRow">
              <strong>{routeMeta.title}</strong>
              <FiChevronRight aria-hidden="true" />
              <span>{routeMeta.eyebrow}</span>
            </div>
            <small>{routeMeta.subtitle}</small>
          </div>
        </button>

        <div className="tn-commandMeta" aria-label="Workspace status">
          <div className="tn-metaPill tn-metaPillAccent">
            <FiCommand aria-hidden="true" />
            <div>
              <span>Workspace</span>
              <strong>{routeMeta.eyebrow}</strong>
            </div>
          </div>

          <div className="tn-metaPill">
            <FiCalendar aria-hidden="true" />
            <div>
              <span>Today</span>
              <strong>{todayLabel}</strong>
            </div>
          </div>

          <div className="tn-metaPill">
            <FiActivity aria-hidden="true" />
            <div>
              <span>{routeMeta.metricLabel}</span>
              <strong>{showBadge ? `${unreadCount > 99 ? "99+" : unreadCount} active` : "All clear"}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="tn-right">
        <button
          type="button"
          className="tn-bell-btn"
          onClick={handleNotifications}
          aria-label="Notifications"
          title="Notifications"
        >
          <div className="tn-bellIconWrap">
            <FaBell size={20} />
            {showBadge && <span className="tn-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </div>
          <div className="tn-bellText">
            <span>Alerts</span>
            <strong>{showBadge ? `${unreadCount} unread` : "No unread items"}</strong>
          </div>
        </button>

        <div
          className="tn-profile-card"
          onClick={onProfileClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onProfileClick?.();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="tn-profileIdentity">
            {user?.displayPhoto ? (
              <img src={user.displayPhoto} alt="Profile" className="tn-profile-pic" />
            ) : (
              <div className="tn-profile-fallback" aria-hidden="true">
                {initials}
              </div>
            )}

            <div className="tn-profile-info">
              <span className="tn-profile-label">Signed in as</span>
              <strong>{displayName}</strong>
              <small>@{user?.username || "advisor"}</small>
            </div>
          </div>

          <div className="tn-profile-actions">
            <span className="tn-securityPill">
              <FiShield aria-hidden="true" />
              Secure session
            </span>

            <span
              className="tn-logout-btn"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onLogout();
                }
              }}
              role="button"
              tabIndex={0}
            >
              Log out
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default TopNav;
