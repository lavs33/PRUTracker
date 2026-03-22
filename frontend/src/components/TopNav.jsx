import { useEffect, useState, useCallback, useMemo } from "react";
import { FaBell } from "react-icons/fa";
import { FiActivity, FiCalendar, FiShield } from "react-icons/fi";
import logo from "../assets/prutracker-navbar-logo.png";
import "./TopNav.css";

function TopNav({
  user,
  onLogoClick,
  onProfileClick,
  onLogout,
  onNotificationsClick,
  showAlerts = true,
  profileClickable = true,
}) {
  const API_BASE = "http://localhost:5000";

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
  const alertLabel = showBadge ? `${unreadCount > 99 ? "99+" : unreadCount} active` : "All clear";
  const alertSummary = showBadge ? `${unreadCount} unread` : "No unread items";

  return (
    <nav className={`top-nav ${showAlerts ? "" : "top-nav--compact"}`}>
      <div className="tn-command-shell">
        <button type="button" className="tn-brandPanel" onClick={onLogoClick} aria-label="Go to dashboard home">
          <div className="tn-brandLogoWrap">
            <img src={logo} alt="PRUTracker" className="tn-logo" />
          </div>
        </button>

        {showAlerts && (
          <div className="tn-commandMeta" aria-label="Workspace status">
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
                <span>Unread alerts</span>
                <strong>{alertLabel}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tn-right">
        {showAlerts && (
          <button
            type="button"
            className="tn-bell-btn"
            onClick={handleNotifications}
            aria-label="Notifications"
            title="Notifications"
          >
            <div className="tn-bellIconWrap">
              <FaBell size={18} />
              {showBadge && <span className="tn-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </div>
            <div className="tn-bellText">
              <span>Alerts</span>
              <strong>{alertSummary}</strong>
            </div>
          </button>
        )}

        <div
          className={`tn-profile-card ${profileClickable ? "clickable" : ""}`}
          onClick={profileClickable ? onProfileClick : undefined}
          onKeyDown={
            profileClickable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onProfileClick?.();
                  }
                }
              : undefined
          }
          role={profileClickable ? "button" : undefined}
          tabIndex={profileClickable ? 0 : undefined}
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

            <button
              type="button"
              className="tn-logout-btn"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default TopNav;