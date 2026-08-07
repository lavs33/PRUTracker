import { useEffect, useState, useCallback, useMemo } from "react";
import { FaBell } from "react-icons/fa";
import { FiActivity, FiCalendar, FiShield } from "react-icons/fi";
import logo from "../assets/prutracker-navbar-logo.png";
import "./TopNav.css";

const unreadCountCache = new Map();
const UNREAD_COUNT_REFRESH_MS = 5_000;

function TopNav({
  user,
  onLogoClick,
  onProfileClick,
  onLogout,
  onNotificationsClick,
  showAlerts = true,
  showDate = showAlerts,
  profileClickable = true,
}) {
  const API_BASE = "http://localhost:5000";

  const [unreadCount, setUnreadCount] = useState(() => Number(unreadCountCache.get(String(user?.id))?.count || 0));

  const fetchUnreadCount = useCallback(async (signal, forceRefresh = false) => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    try {
      const cacheKey = String(user.id);
      const cached = unreadCountCache.get(cacheKey);
      if (!forceRefresh && cached) {
        setUnreadCount(cached.count);
        return;
      }
      const res = await fetch(
        `${API_BASE}/api/notifications/unread-count?userId=${user.id}`,
        { ...(signal ? { signal } : {}), cache: "no-store" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch unread count.");

      const nextCount = Number(data?.unreadCount || 0);
      unreadCountCache.set(cacheKey, { count: nextCount, loadedAt: Date.now() });
      setUnreadCount(nextCount);
    } catch (err) {
      if (err.name !== "AbortError" && !unreadCountCache.has(String(user?.id))) setUnreadCount(0);
    }
  }, [API_BASE, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchUnreadCount(controller.signal, true);
    return () => controller.abort();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!user?.id) return;

    const refresh = () => fetchUnreadCount(undefined, true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = window.setInterval(refreshWhenVisible, UNREAD_COUNT_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [user?.id, fetchUnreadCount]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const refreshAfterNotificationChange = (event) => {
      const immediateCount = Number(event?.detail?.unreadCount);
      if (Number.isFinite(immediateCount)) {
        unreadCountCache.set(String(user.id), { count: immediateCount, loadedAt: Date.now() });
        setUnreadCount(immediateCount);
      }
      fetchUnreadCount(undefined, true);
    };
    window.addEventListener("notifications:changed", refreshAfterNotificationChange);
    return () => window.removeEventListener("notifications:changed", refreshAfterNotificationChange);
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

        {showDate && (
          <div className="tn-commandMeta" aria-label="Workspace status">
            <div className="tn-metaPill">
              <FiCalendar aria-hidden="true" />
              <div>
                <span>Today</span>
                <strong>{todayLabel}</strong>
              </div>
            </div>

            {showAlerts && (
              <div className="tn-metaPill">
                <FiActivity aria-hidden="true" />
                <div>
                  <span>Unread alerts</span>
                  <strong>{alertLabel}</strong>
                </div>
              </div>
            )}
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