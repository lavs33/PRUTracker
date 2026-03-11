import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import logo from "./assets/prutracker-landing-logo.png";

function LandingPage() {

  const navigate = useNavigate();

  useEffect(() => {
        document.title = "PRUTracker | Select Role";
  }, []);

  const handleRoleSelect = (role) => {
    localStorage.setItem("role", role);
    navigate("/login");
  };


  return (
    <div className="mp-landing-container">
      <img src={logo} alt="PRUTracker Logo" className="mp-logo" />

      <p className="mp-tagline">
        Your centralized platform to manage clients and boost performance.
      </p>

      <p className="mp-welcome">
        What would you like to do today?
      </p>

      <div className="mp-role-buttons">
        <button onClick={() => handleRoleSelect("Agent")}>Agent</button>
        <button onClick={() => handleRoleSelect("AUM")}>AUM</button>
        <button onClick={() => handleRoleSelect("UM")}>UM</button>
        <button onClick={() => handleRoleSelect("BM")}>BM</button>
      </div>
    </div>
  );
}

export default LandingPage;
