import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logout } from "./utils/logout";
import { FaArrowLeft } from "react-icons/fa";
import "./AgentProfile.css";

function AgentProfile() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = JSON.parse(localStorage.getItem("user"));

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Redirect guard
  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/");
    }
  }, [user, username, navigate]);

  // Dynamic title
  useEffect(() => {
    if (user) document.title = `${user.username} | Profile`;
  }, [user]);

  if (!user || user.username !== username) return null;

  const handleSavePassword = () => {
    if (!currentPassword || !newPassword) {
      alert("Please enter current password and new password.");
      return;
    }
    alert("Password successfully changed!");
    setCurrentPassword("");
    setNewPassword("");
  };

  // Helpers
  const formatDate = (d) => {
    if (!d) return "Not available yet";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "Not available yet";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  const fullName = `${user.firstName} ${user.middleName ? user.middleName + " " : ""}${user.lastName}`;

  // Agent/org fields (not in localStorage yet)
  const agentType = user.agentType || "Not available yet";
  const dateEmployed = user.dateEmployed || null;
  const unitName = user.unitName || "Not available yet";
  const branchName = user.branchName || "Not available yet";
  const areaName = user.areaName || "Not available yet";

  return (
    <div className="profile-page">
      {/* Top-left back icon */}
      <button
        className="back-btn"
        onClick={() => navigate(-1)}
        aria-label="Go Back"
        >
        <FaArrowLeft size={30} />
    </button>

      {/* Profile header */}
      <div className="profile-header">
        <img src={user.displayPhoto} alt="Profile" className="profile-photo" />

        <div className="profile-header-info">
          <h2 className="profile-name">{fullName}</h2>

          <p className="profile-meta">Username: {user.username}</p>
          <p className="profile-meta">Role: {user.role}</p>
        </div>
      </div>

      {/* Sections */}
      <div className="profile-sections">
        {/* Personal Info */}
        <div className="profile-card">
          <h3 className="section-title">Personal Information</h3>

          <div className="info-grid">
            <div className="info-item">
              <span className="label">First Name:</span>
              <span className="value">{user.firstName}</span>
            </div>

            <div className="info-item">
              <span className="label">Middle Name:</span>
              <span className="value">{user.middleName || "—"}</span>
            </div>

            <div className="info-item">
              <span className="label">Last Name:</span>
              <span className="value">{user.lastName}</span>
            </div>

            <div className="info-item">
              <span className="label">Sex:</span>
              <span className="value">{user.sex}</span>
            </div>

            <div className="info-item">
              <span className="label">Birthday:</span>
              <span className="value">{formatDate(user.birthday)}</span>
            </div>

            <div className="info-item">
              <span className="label">Age:</span>
              <span className="value">{user.age}</span>
            </div>
          </div>
        </div>

        {/* Agent Info */}
        <div className="profile-card">
          <h3 className="section-title">Agent Information</h3>

          <div className="info-grid">
            <div className="info-item">
              <span className="label">Agent Type:</span>
              <span className="value">{agentType}</span>
            </div>

            <div className="info-item">
              <span className="label">Date Employed:</span>
              <span className="value">{formatDate(dateEmployed)}</span>
            </div>

            <div className="info-item">
              <span className="label">Unit Name:</span>
              <span className="value">{unitName}</span>
            </div>

            <div className="info-item">
              <span className="label">Branch Name:</span>
              <span className="value">{branchName}</span>
            </div>

            <div className="info-item">
              <span className="label">Area Name:</span>
              <span className="value">{areaName}</span>
            </div>
          </div>
        </div>

        {/* Password settings */}
        <div className="profile-card">
          <h3 className="section-title">Password Settings</h3>

          <div className="password-grid">
            <input
              className="password-input"
              placeholder="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />

            <input
              className="password-input"
              placeholder="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <button className="save-btn" onClick={handleSavePassword}>
              Save Password
            </button>
          </div>
        </div>
      </div>

      {/* Bottom logout */}
      <div className="logout-row">
        <button className="logout-main-btn" onClick={() => logout(navigate)}>
          Log out
        </button>
      </div>
    </div>
  );
}

export default AgentProfile;
