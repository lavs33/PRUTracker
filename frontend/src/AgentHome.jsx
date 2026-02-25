import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaUsers, FaTasks, FaChartLine } from "react-icons/fa";
import "./AgentHome.css";
import TopNav from "./components/TopNav";
import { logout } from "./utils/logout";

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

  // Redirect guard
  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

  // Dynamic browser title
  useEffect(() => {
    if (user) {
      document.title = `${user.username} | Home`;
    }
  }, [user]);

  if (!user || user.username !== username) return null;

  return (
    <>
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="agent-content">
        <h1 className="welcome-text">Welcome, Agent {user.firstName}!</h1>

        <div className="module-grid">
          <div
            className="module-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/agent/${user.username}/clients`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/agent/${user.username}/clients`)}
          >
            <FaUsers size={48} className="module-icon" />
            <p>Client Visibility &amp; Management</p>
          </div>

          <div
            className="module-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/agent/${user.username}/tasks`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/agent/${user.username}/tasks`)}
          >
            <FaTasks size={48} className="module-icon" />
            <p>Task Visibility &amp; Management</p>
          </div>

          <div
            className="module-card"
            role="button"
            tabIndex={0}
            onClick={() => alert("Sales module coming soon")}
            onKeyDown={(e) => e.key === "Enter" && alert("Sales module coming soon")}
          >
            <FaChartLine size={48} className="module-icon" />
            <p>Sales Monitoring &amp; Analytics</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default AgentHome;
