import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logout } from "./utils/logout";
import { FaArrowLeft } from "react-icons/fa";
import { FiBriefcase, FiCalendar, FiKey, FiMapPin, FiShield, FiUser } from "react-icons/fi";
import "./AgentProfile.css";

function AgentProfile() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = JSON.parse(localStorage.getItem("user"));

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/");
    }
  }, [user, username, navigate]);

  useEffect(() => {
    if (user) document.title = `${user.username} | Profile`;
  }, [user]);

  const safeFullName = user
    ? `${user.firstName} ${user.middleName ? `${user.middleName} ` : ""}${user.lastName}`
    : "Agent User";

  const initials = useMemo(
    () =>
      safeFullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(""),
    [safeFullName]
  );

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

  const formatDate = (d) => {
    if (!d) return "Not available yet";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "Not available yet";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  const fullName = `${user.firstName} ${user.middleName ? `${user.middleName} ` : ""}${user.lastName}`;

  const agentType = user.agentType || "Not available yet";
  const dateEmployed = user.dateEmployed || null;
  const unitName = user.unitName || "Not available yet";
  const branchName = user.branchName || "Not available yet";
  const areaName = user.areaName || "Not available yet";

  const personalInfo = [
    { label: "First Name", value: user.firstName },
    { label: "Middle Name", value: user.middleName || "—" },
    { label: "Last Name", value: user.lastName },
    { label: "Sex", value: user.sex || "—" },
    { label: "Birthday", value: formatDate(user.birthday) },
    { label: "Age", value: user.age || "—" },
  ];

  const workInfo = [
    { label: "Agent Type", value: agentType },
    { label: "Date Employed", value: formatDate(dateEmployed) },
    { label: "Unit Name", value: unitName },
    { label: "Branch Name", value: branchName },
    { label: "Area Name", value: areaName },
  ];

  const quickStats = [
    { icon: <FiUser aria-hidden="true" />, label: "Role", value: user.role || "Agent" },
    { icon: <FiBriefcase aria-hidden="true" />, label: "Agent Type", value: agentType },
    { icon: <FiMapPin aria-hidden="true" />, label: "Branch", value: branchName },
  ];

  return (
    <div className="profile-page">
      <div className="profile-shell">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
          <FaArrowLeft size={18} />
          <span>Back</span>
        </button>

        <section className="profile-hero">
          <div className="profile-identityCard">
            <div className="profile-avatarWrap">
              {user.displayPhoto ? (
                <img src={user.displayPhoto} alt="Profile" className="profile-photo" />
              ) : (
                <div className="profile-avatarFallback">{initials}</div>
              )}
            </div>

            <div className="profile-header-info">
              <span className="profile-eyebrow">Agent workspace profile</span>
              <h1 className="profile-name">{fullName}</h1>
              <p className="profile-username">@{user.username}</p>

              <div className="profile-tagRow">
                <span className="profile-tag">
                  <FiShield aria-hidden="true" />
                  Secure account
                </span>
                <span className="profile-tag">{user.role || "Agent"}</span>
              </div>
            </div>
          </div>

          <div className="profile-statsGrid">
            {quickStats.map((stat) => (
              <div key={stat.label} className="profile-statCard">
                <div className="profile-statIcon">{stat.icon}</div>
                <div>
                  <span className="profile-statLabel">{stat.label}</span>
                  <strong className="profile-statValue">{stat.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="profile-sections">
          <section className="profile-card">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Personal</span>
                <h2 className="section-title">Personal Information</h2>
              </div>
            </div>

            <div className="info-grid">
              {personalInfo.map((item) => (
                <div key={item.label} className="info-item">
                  <span className="label">{item.label}</span>
                  <span className="value">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-card">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Organization</span>
                <h2 className="section-title">Agent Information</h2>
              </div>
            </div>

            <div className="info-grid info-grid-work">
              {workInfo.map((item) => (
                <div key={item.label} className="info-item">
                  <span className="label">{item.label}</span>
                  <span className="value">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="profile-card password-card">
            <div className="section-heading section-heading-split">
              <div>
                <span className="section-kicker">Security</span>
                <h2 className="section-title">Password Settings</h2>
              </div>

              <div className="password-note">
                <FiCalendar aria-hidden="true" />
                Update your credentials anytime.
              </div>
            </div>

            <div className="password-grid">
              <label className="password-field">
                <span>Current password</span>
                <input
                  className="password-input"
                  placeholder="Enter current password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>

              <label className="password-field">
                <span>New password</span>
                <input
                  className="password-input"
                  placeholder="Enter new password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>

              <button className="save-btn" onClick={handleSavePassword}>
                <FiKey aria-hidden="true" />
                Save Password
              </button>
            </div>
          </section>
        </div>

        <div className="logout-row">
          <button className="logout-main-btn" onClick={() => logout(navigate)}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default AgentProfile;
