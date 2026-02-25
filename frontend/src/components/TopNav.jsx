import { useEffect, useState, useCallback } from "react";
import { FaBell } from "react-icons/fa";
import logo from "../assets/prutracker-navbar-logo.png";
import "./TopNav.css";

function TopNav({ user, onLogoClick, onProfileClick, onLogout, onNotificationsClick }) {
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
    const id = window.setInterval(tick, 30_000); // every 30s

    return () => window.clearInterval(id);
  }, [user?.id, fetchUnreadCount]);

  const handleNotifications = (e) => {
    e.stopPropagation();
    if (onNotificationsClick) return onNotificationsClick();
  };

  const showBadge = unreadCount > 0;

  return (
    <nav className="top-nav">
      <img src={logo} alt="PRUTracker" className="tn-logo" onClick={onLogoClick} />

      <div className="tn-right">
        {/* 🔔 Notifications */}
        <button
          type="button"
          className="tn-bell-btn"
          onClick={handleNotifications}
          aria-label="Notifications"
          title="Notifications"
        >
          <FaBell size={26} />

          {showBadge && (
            <span className="tn-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>

        {/* Profile */}
        <div className="tn-profile-card" onClick={onProfileClick}>
          <img src={user.displayPhoto} alt="Profile" className="tn-profile-pic" />

          <div className="tn-profile-info">
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <small>{user.username}</small>

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