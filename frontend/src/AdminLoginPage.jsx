import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaLock } from "react-icons/fa";
import "./AdminLoginPage.css";
import logo from "./assets/prutracker-landing-logo.png";

function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "PRUTracker | Admin Login";
    localStorage.setItem("role", "Admin");
  }, []);

  const handleBack = () => {
    localStorage.removeItem("role");
    navigate("/");
  };

  const handleLogin = () => {
    if (!username || !password) {
      setMessage("Please enter the admin username and password.");
      return;
    }

    setMessage(
      "Admin login UI is ready, but backend admin authentication is not connected yet. Frontend portal only for now."
    );
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="alp-page">
      <header className="alp-header">
        <button className="alp-back-btn" onClick={handleBack} aria-label="Back to landing page">
          <FaArrowLeft size={15} />
          <span>Back</span>
        </button>
      </header>

      <main className="alp-main">
        <section className="alp-left">
          <img src={logo} alt="PRUTracker Logo" className="alp-logo" />
          <p className="alp-kicker">Administrator Portal</p>
          <h1>Manage PRUTracker from the dedicated admin portal.</h1>
          <p className="alp-description">
            This portal is reserved for standalone administrator accounts and is intentionally separate from the
            agent and manager login flow.
          </p>

          <div className="alp-meta">
            <div>
              <span>Portal</span>
              <strong>Admin</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>Frontend ready</strong>
            </div>
          </div>

          <div className="alp-note">
            <FaLock />
            <p>
              Admin authentication backend will be connected next. For now, this page establishes the dedicated
              entry point and experience for admin users.
            </p>
          </div>
        </section>

        <section className="alp-card" onKeyDown={onKeyDown}>
          <div className="alp-card-head">
            <p>PRUTracker Admin</p>
            <h2>Admin Sign In</h2>
          </div>

          <label htmlFor="admin-username">Admin Username</label>
          <input
            id="admin-username"
            placeholder="Enter admin username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="alp-login-btn" onClick={handleLogin}>
            Enter Admin Portal
          </button>

          <p className="alp-helper">Frontend-first setup: backend admin login wiring comes next.</p>
          {message && <p className="alp-message">{message}</p>}
        </section>
      </main>
    </div>
  );
}

export default AdminLoginPage;
