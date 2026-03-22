import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import "./LoginPage.css";
import logo from "./assets/prutracker-landing-logo.png";

const API_BASE = "http://localhost:5000";

function LoginPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  useEffect(() => {
    if (role) document.title = `PRUTracker | ${role} Login`;
  }, [role]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!role) navigate("/");
  }, [role, navigate]);

  const rolePrefixMap = {
    Agent: "AG",
    AUM: "AUM",
    UM: "UM",
    BM: "BM",
  };

  const handleBack = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("managerPortalUser");
    navigate("/");
  };

  const handleLogin = async () => {
    setError("");

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError("Please enter username and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username: normalizedUsername, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed.");
        return;
      }

      if (["AUM", "UM", "BM"].includes(data.user?.role)) {
        localStorage.removeItem("user");
        localStorage.setItem("managerPortalUser", JSON.stringify(data.user));
        navigate(`/${data.user.role.toLowerCase()}/${data.user.username}`);
        return;
      }

      localStorage.removeItem("managerPortalUser");
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate(`/agent/${data.user.username}`);
    } catch (err) {
      setError("Cannot connect to server. Is backend running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="lp-page">
      <header className="lp-header">
        <button className="lp-back-btn" onClick={handleBack} aria-label="Back to role selection">
          <FaArrowLeft size={15} />
          <span>Back</span>
        </button>
      </header>

      <main className="lp-main">
        <section className="lp-left">
          <img src={logo} alt="PRUTracker Logo" className="lp-logo" />
          <p className="lp-kicker">Secure Sign-In</p>
          <h1>Welcome back to PRUTracker</h1>
          <p className="lp-description">
            Continue to your role dashboard to manage client relationships, monitor activity, and track performance.
          </p>

          <div className="lp-meta">
            <div>
              <span>Selected role</span>
              <strong>{role || "—"}</strong>
            </div>
            <div>
              <span>Access type</span>
              <strong>Internal platform</strong>
            </div>
          </div>
        </section>

        <section className="lp-card" onKeyDown={onKeyDown}>
          <h2>Log in</h2>
          <p className="lp-role-line">Role: {role || "Not selected"}</p>

          <label htmlFor="username">{rolePrefixMap[role] || "User"} Code</label>
          <input
            id="username"
            placeholder={`Enter ${rolePrefixMap[role] || "user"} code`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="lp-login-btn" onClick={handleLogin} disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Log in"}
          </button>

          {error && <p className="lp-error">{error}</p>}
        </section>
      </main>
    </div>
  );
}

export default LoginPage;
