import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import logo from "./assets/prutracker-landing-logo.png";
import "./LoginPage.css";

function buildPreviewManager(roleType, username) {
  const normalizedRole = String(roleType || "").trim().toUpperCase();
  const normalizedUsername = String(username || normalizedRole).trim().toUpperCase();

  return {
    id: `preview-${normalizedRole.toLowerCase()}-${normalizedUsername.toLowerCase()}`,
    role: normalizedRole,
    username: normalizedUsername,
    firstName: normalizedRole === "AUM" ? "Assistant" : "Unit",
    middleName: "",
    lastName: normalizedRole === "AUM" ? "Manager" : "Leader",
    unitName: "Diamond Unit",
    branchName: "Metro Manila",
    areaName: "NCR",
    displayPhoto: "",
  };
}

function ManagerLoginPage({ roleType }) {
  const navigate = useNavigate();
  const normalizedRole = String(roleType || "").trim().toUpperCase();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = `PRUTracker | ${normalizedRole} Login`;
  }, [normalizedRole]);

  const handleBack = () => {
    localStorage.removeItem("managerPortalUser");
    navigate("/");
  };

  const handleLogin = () => {
    setError("");

    if (!username.trim() || !password.trim()) {
      setError(`Please enter ${normalizedRole} username and password.`);
      return;
    }

    const previewUser = buildPreviewManager(normalizedRole, username);
    localStorage.setItem("managerPortalUser", JSON.stringify(previewUser));
    navigate(`/${normalizedRole.toLowerCase()}/${previewUser.username}`);
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
          <p className="lp-kicker">Frontend Preview</p>
          <h1>{normalizedRole} Portal Sign-In</h1>
          <p className="lp-description">
            This preview login opens the new {normalizedRole} portal layout first so we can validate navigation,
            dashboard structure, and manager workflow screens before backend auth wiring.
          </p>

          <div className="lp-meta">
            <div>
              <span>Selected role</span>
              <strong>{normalizedRole}</strong>
            </div>
            <div>
              <span>Portal scope</span>
              <strong>Unit-level management</strong>
            </div>
          </div>
        </section>

        <section className="lp-card" onKeyDown={onKeyDown}>
          <h2>Log in</h2>
          <p className="lp-role-line">Role: {normalizedRole}</p>

          <label htmlFor={`${normalizedRole}-username`}>{normalizedRole} Username</label>
          <input
            id={`${normalizedRole}-username`}
            placeholder={`Enter ${normalizedRole} username`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label htmlFor={`${normalizedRole}-password`}>Password</label>
          <input
            id={`${normalizedRole}-password`}
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="lp-login-btn" onClick={handleLogin}>
            Open {normalizedRole} Portal
          </button>

          {error ? <p className="lp-error">{error}</p> : null}
        </section>
      </main>
    </div>
  );
}

export default ManagerLoginPage;
