import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import "./LoginPage.css";
import logo from "./assets/prutracker-landing-logo.png";

function LoginPage() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  useEffect(() => {
    if (role) document.title = `PRUTracker | ${role} Login`;
  }, [role]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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
    navigate("/");
  };

  const handleLogin = async () => {
    setError("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed.");
        return;
      }

      // Save logged-in user info
      localStorage.setItem("user", JSON.stringify(data.user));

      // Navigate using react-router
      navigate(`/agent/${data.user.username}`);
    } catch (err) {
      setError("Cannot connect to server. Is backend running?");
    }
  };

  return (
    <div className="lp-landing-container">

      <button className="lp-back-top" onClick={handleBack}>
        <FaArrowLeft size={30} />
      </button>

      <img src={logo} alt="PRUTracker Logo" className="lp-logo" />

      <div style={{ width: "350px", marginTop: "100px" }}>

        <input
          placeholder={`${rolePrefixMap[role]} Code`}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
        />

        <br /><br />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <br /><br />

        <button
          style={buttonStyle}
          onClick={handleLogin}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#B9D3DC")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#FFFFFF")}
        >
          Log-in
        </button>

        {error && (
          <p style={{ color: "white", fontSize: "18px", marginTop: "15px" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "14px",
  fontSize: "16px",
  borderRadius: "6px",
  border: "none",
  fontFamily: "FSAlbertArabic, sans-serif",
};

const buttonStyle = {
  width: "40%",
  padding: "14px",
  fontSize: "18px",
  backgroundColor: "#FFFFFF",
  color: "#373A36",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
  fontFamily: "FSAlbertArabic, sans-serif",
  display: "block",
  margin: "0 auto",
  transition: "all 0.25s ease",
};

export default LoginPage;
