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
  const [currentPasswordTouched, setCurrentPasswordTouched] = useState(false);
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [currentPasswordMatches, setCurrentPasswordMatches] = useState(false);
  const [isCheckingCurrentPassword, setIsCheckingCurrentPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordServerError, setPasswordServerError] = useState("");
  const [passwordSuccessOpen, setPasswordSuccessOpen] = useState(false);

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

  const newPasswordErrors = useMemo(() => {
    const errors = [];
    if (newPassword.length < 8) errors.push("Password must be at least 8 characters.");
    if (!/\d/.test(newPassword)) errors.push("Password must include at least one number.");
    if (!/[^A-Za-z0-9]/.test(newPassword)) errors.push("Password must include at least one special character.");
    return errors;
  }, [newPassword]);

  useEffect(() => {
    setPasswordServerError("");
    setCurrentPasswordMatches(false);

    if (!currentPassword) {
      setIsCheckingCurrentPassword(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsCheckingCurrentPassword(true);

      try {
        const res = await fetch("http://localhost:5000/api/agent/profile/password/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.id || "",
            username: user?.username || username,
            currentPassword,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted) setCurrentPasswordMatches(res.ok && data.matches === true);
      } catch (err) {
        if (!controller.signal.aborted) setCurrentPasswordMatches(false);
      } finally {
        if (!controller.signal.aborted) setIsCheckingCurrentPassword(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [currentPassword, user?.id, user?.username, username]);

  if (!user || user.username !== username) return null;

  const currentPasswordError = currentPasswordTouched && currentPassword && !isCheckingCurrentPassword && !currentPasswordMatches
    ? "Current password does not match."
    : "";
  const visibleNewPasswordErrors = newPasswordTouched ? newPasswordErrors : [];
  const canSavePassword = currentPasswordMatches && newPasswordErrors.length === 0 && !isCheckingCurrentPassword && !isSavingPassword;

  const handleSavePassword = async () => {
    setCurrentPasswordTouched(true);
    setNewPasswordTouched(true);
    setPasswordServerError("");

    if (!canSavePassword) {
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await fetch("http://localhost:5000/api/agent/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id || "",
          username: user.username,
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.field === "currentPassword") {
          setCurrentPasswordMatches(false);
          setCurrentPasswordTouched(true);
        }
        setPasswordServerError(data.message || "Failed to update password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setCurrentPasswordTouched(false);
      setNewPasswordTouched(false);
      setCurrentPasswordMatches(false);
      setPasswordSuccessOpen(true);
    } catch {
      setPasswordServerError("Cannot connect to server. Is backend running?");
    } finally {
      setIsSavingPassword(false);
    }
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
                  onBlur={() => setCurrentPasswordTouched(true)}
                  onChange={(e) => {
                    setCurrentPasswordTouched(true);
                    setCurrentPassword(e.target.value);
                  }}
                />
                {isCheckingCurrentPassword ? <small className="password-helper">Checking current password...</small> : null}
                {currentPasswordError ? <small className="password-error">{currentPasswordError}</small> : null}
              </label>

              <label className="password-field">
                <span>New password</span>
                <input
                  className="password-input"
                  placeholder="Enter new password"
                  type="password"
                  value={newPassword}
                  onBlur={() => setNewPasswordTouched(true)}
                  onChange={(e) => {
                    setNewPasswordTouched(true);
                    setNewPassword(e.target.value);
                  }}
                />
                {visibleNewPasswordErrors.length ? (
                  <div className="password-error-list">
                    {visibleNewPasswordErrors.map((error) => (
                      <small key={error} className="password-error">{error}</small>
                    ))}
                  </div>
                ) : null}
              </label>

              <button className="save-btn" onClick={handleSavePassword} disabled={!canSavePassword}>
                <FiKey aria-hidden="true" />
                {isSavingPassword ? "Saving..." : "Save Password"}
              </button>
            </div>
            {passwordServerError ? <p className="password-server-error">{passwordServerError}</p> : null}
          </section>
        </div>

        <div className="logout-row">
          <button className="logout-main-btn" onClick={() => logout(navigate, user.role || "AG")}>
            Log out
          </button>
        </div>
      </div>
      {passwordSuccessOpen ? (
        <div className="password-modal-backdrop" role="presentation">
          <div className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-success-title">
            <button
              type="button"
              className="password-modal-close"
              aria-label="Close password update confirmation"
              onClick={() => setPasswordSuccessOpen(false)}
            >
              ×
            </button>
            <h2 id="password-success-title">Password successfully updated</h2>
            <p>Your new password has been saved.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AgentProfile;