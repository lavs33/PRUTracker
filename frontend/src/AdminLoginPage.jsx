import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import "./AdminLoginPage.css";
import logo from "./assets/prutracker-landing-logo.png";

function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    document.title = "PRUTracker | Admin Login";
    localStorage.setItem("role", "Admin");
  }, []);

  const handleBack = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("adminUser");
    navigate("/");
  };

  const handleLogin = async () => {
    setError("");
    setSuccess("");

    if (!username || !password) {
      setError("Please enter admin username and password.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed.");
        return;
      }

      localStorage.setItem("adminUser", JSON.stringify(data.admin));
      setSuccess("Admin login successful. Admin dashboard UI can now be connected next.");
    } catch (err) {
      setError("Cannot connect to server. Is backend running?");
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="alp-page">
      <header className="alp-header">
        <button className="alp-back-btn" onClick={handleBack} aria-label="Back to role selection">
          <FaArrowLeft size={15} />
          <span>Back</span>
        </button>
      </header>

      <main className="alp-main">
        <section className="alp-left">
          <img src={logo} alt="PRUTracker Logo" className="alp-logo" />
          <p className="alp-kicker">Secure Sign-In</p>
          <h1>Welcome back to PRUTracker</h1>
          <p className="alp-description">
            Continue to the standalone admin portal to manage administrator-level access and future system-wide
            functions from a dedicated sign-in flow.
          </p>

          <div className="alp-meta">
            <div>
              <span>Selected role</span>
              <strong>Admin</strong>
            </div>
            <div>
              <span>Access type</span>
              <strong>Standalone portal</strong>
            </div>
          </div>
        </section>

        <section className="alp-card" onKeyDown={onKeyDown}>
          <h2>Log in</h2>
          <p className="alp-role-line">Role: Admin</p>

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
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="alp-login-btn" onClick={handleLogin}>
            Log in
          </button>

          {error && <p className="alp-error">{error}</p>}
          {success && <p className="alp-success">{success}</p>}
        </section>
      </main>
    </div>
  );
}

export default AdminLoginPage;
