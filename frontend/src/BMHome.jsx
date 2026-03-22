import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaUsers, FaTasks, FaChartLine, FaClipboardList } from "react-icons/fa";
import "./BMHome.css";
import TopNav from "./components/TopNav";
import { logout } from "./utils/logout";

function BMHome() {
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

  // Redirect guard
  useEffect(() => {
    if (!user || user.username !== username || user.role !== "BM") {
      setIsReady(false);
      navigate("/", { replace: true });
      return;
    }
    setIsReady(true);
  }, [user, username, navigate]);

  // Dynamic title
  useEffect(() => {
    if (user) document.title = `${user.username} | BM Home`;
  }, [user]);

  if (!isReady) return null;


  return (
    <>
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/branch-manager/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="agent-content">
        <h1 className="welcome-text">Welcome, Branch Manager {user.firstName}!</h1>

        <div className="module-grid">
          <div
            className="module-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/branch-manager/${user.username}/dashboard`)}
            onKeyDown={(e) =>
              e.key === "Enter" && navigate(`/branch-manager/${user.username}/dashboard`)
            }
          >
            <FaClipboardList size={48} className="module-icon" />
            <p>Orphan &amp; KPI Assignment</p>
          </div>

          <div
            className="module-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/agent/${user.username}/clients`)}
            onKeyDown={(e) =>
              e.key === "Enter" && navigate(`/agent/${user.username}/clients`)
            }
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
            onKeyDown={(e) =>
              e.key === "Enter" && alert("Sales module coming soon")
            }
          >
            <FaChartLine size={48} className="module-icon" />
            <p>Sales Monitoring &amp; Analytics</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default BMHome;