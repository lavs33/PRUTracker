import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentAddProspect.css";

function AgentAddProspect() {
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

  // Form state
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const [phoneNumber, setPhoneNumber] = useState(""); // digits only
  const [email, setEmail] = useState("");

  const [marketType, setMarketType] = useState(""); // required
  const [prospectType, setProspectType] = useState(""); // optional

  const [sex, setSex] = useState(""); // optional
  const [birthday, setBirthday] = useState(""); // optional yyyy-mm-dd
  const [age, setAge] = useState(""); // optional (only when birthday is blank)

  // Agent-specific preview number (display-only)
  const [nextProspectNo, setNextProspectNo] = useState(null);
  const [loadingNextNo, setLoadingNextNo] = useState(true);

  // Locked defaults (display-only)
  const lockedSource = "Agent-Sourced";
  const lockedStatus = "Active";

  const [showSuccess, setShowSuccess] = useState(false);
  const [createdProspect, setCreatedProspect] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState({});

  // Compute age from birthday (client-side mirror of backend)
  const computeAgeFromBirthday = (dateStr) => {
    if (!dateStr) return null;
    const b = new Date(dateStr);
    if (isNaN(b.getTime())) return null;

    const today = new Date();
    let yrs = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) yrs--;
    return yrs;
  };

  const computedAge = computeAgeFromBirthday(birthday);

  // Birthday wins: clear manual age whenever birthday is set
  useEffect(() => {
    if (String(birthday || "").trim()) {
      setAge("");
      setErrors((e) => ({ ...e, age: undefined }));
    }
  }, [birthday]);

  // Guard
  useEffect(() => {
    if (!user || user.username !== username) {
      setIsReady(false);
      navigate("/", { replace: true });
      return;
    }
    setIsReady(true);
  }, [user, username, navigate]);

  // Title
  useEffect(() => {
    if (user) document.title = `${user.username} | Add Prospect`;
  }, [user]);

  // Fetch next Prospect No (agent-specific)
  useEffect(() => {
    if (!isReady) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoadingNextNo(true);
        setNextProspectNo(null);

        if (!user?.id) return;

        const res = await fetch(
          `http://localhost:5000/api/prospects/next-no?userId=${user.id}`,
          { signal: controller.signal }
        );

        const data = await res.json();

        if (!res.ok) {
          setNextProspectNo(null);
          return;
        }

        setNextProspectNo(Number(data.nextProspectNo) || null);
      } catch (err) {
        if (err.name !== "AbortError") setNextProspectNo(null);
      } finally {
        setLoadingNextNo(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id]);

  const handleSideNav = (key) => {
  if (!user) return navigate("/");

  switch (key) {
    // CLIENTS
    case "clients":
      navigate(`/agent/${user.username}/clients`);
      break;

    case "clients_relationship":
      navigate(`/agent/${user.username}/clients/relationship`);
      break;

    case "clients_all_prospects":
      navigate(`/agent/${user.username}/prospects`);
      break;

    case "clients_all_policyholders":
      navigate(`/agent/${user.username}/policyholders`);
      break;

    // TASKS
    case "tasks":
      navigate(`/agent/${user.username}/tasks`);
      break;

    case "tasks_all":
      navigate(`/agent/${user.username}/tasks/all`);
      break;

    // SALES
    case "sales":
      alert("Sales module coming soon");
      break;

    default:
      break;
  }
};

  const goBack = () => navigate(`/agent/${user.username}/prospects`);

  const digitsOnly = (v) => String(v || "").replace(/\D/g, "");

  const validate = () => {
    const next = {};

    if (!firstName.trim()) next.firstName = "First name is required.";
    if (!lastName.trim()) next.lastName = "Last name is required.";

    const phone = digitsOnly(phoneNumber);
    if (!phone) next.phoneNumber = "Phone number is required.";
    else if (!/^9\d{9}$/.test(phone)) {
       next.phoneNumber = "Phone must be 10 digits (PH local) and start with 9 (e.g., 9123456789).";
    }

    if (!marketType) next.marketType = "Market type is required.";

    // Email (optional)
    if (email.trim()) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      if (!ok) next.email = "Invalid email format.";
    }

    // Birthday/Age critical validation (18–70)
    const hasBirthday = String(birthday || "").trim() !== "";
    const hasAge = String(age || "").trim() !== "";

    if (hasBirthday) {
      const b = new Date(birthday);
      if (isNaN(b.getTime())) {
        next.birthday = "Invalid birthday.";
      } else {
        const today = new Date();
        // normalize both to midnight to avoid timezone weirdness
        const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
        const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (b0 > t0) {
          next.birthday = "Birthday cannot be in the future.";
        } else {
          const computed = computeAgeFromBirthday(birthday);
          if (computed === null) {
            next.birthday = "Invalid birthday.";
          } else if (computed < 18 || computed > 70) {
            next.birthday = "Prospect must be between 18 and 70 years old (based on birthday).";
          }
        }
      }
    } else if (hasAge) {
      const n = Number(age);
      if (!Number.isFinite(n)) next.age = "Invalid age.";
      else if (n < 18 || n > 70) {
        next.age = "Prospect must be between 18 and 70 years old.";
      }
    }

    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSubmitting(true);

      const payload = {
        userId: user.id,
        firstName,
        middleName,
        lastName,
        phoneNumber, // already digits-only
        email,
        sex,
        birthday,
        marketType,
        prospectType,
        // if birthday is provided, don't send age (birthday wins + avoids confusion)
        ...(String(birthday || "").trim() ? {} : { age }),
      };

      const res = await fetch("http://localhost:5000/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.field === "phoneNumber") {
            setErrors((e) => ({
            ...e,
            phoneNumber: data.message,
            }));
      } else {
            alert(data.message || "Failed to create prospect.");
      }
        return;
      }

      setCreatedProspect(data.prospect);
      setShowSuccess(true);
    } catch (err) {
      alert("Cannot connect to server. Is backend running?");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady) return null;

  const prospectNoLabel = loadingNextNo
    ? "Loading..."
    : nextProspectNo
    ? String(nextProspectNo).padStart(2, "0")
    : "—";

  const birthdayHasValue = String(birthday || "").trim() !== "";

  return (
    <div className="ap-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="ap-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="ap-content">
          <div className="ap-breadcrumb">
            <button type="button" className="ap-crumbLink" onClick={goBack}>
              Prospects
            </button>
            <span className="ap-crumbSep">›</span>
            <span className="ap-crumbCurrent">Add Prospect</span>
          </div>

          <div className="ap-card">
            <div className="ap-cardTop">
              <div>
                <h1 className="ap-title">Add a Prospect</h1>
                <p className="ap-subtitle">
                  Create a new prospect record. Some fields are system-set by default.
                </p>
              </div>

              <button type="button" className="ap-backBtn" onClick={goBack}>
                ←
              </button>
            </div>

            <div className="ap-lockedRow">
              <div className="ap-lockedItem">
                <span className="ap-lockedLabel">Prospect No.</span>
                <span className="ap-lockedValue">{prospectNoLabel}</span>
              </div>

              <div className="ap-lockedItem">
                <span className="ap-lockedLabel">Source</span>
                <span className="ap-lockedValue">{lockedSource}</span>
              </div>

              <div className="ap-lockedItem">
                <span className="ap-lockedLabel">Status</span>
                <span className="ap-lockedValue">{lockedStatus}</span>
              </div>
            </div>

            <form className="ap-form" onSubmit={handleSubmit}>
              {/* Identity */}
              <div className="ap-section">
                <h2 className="ap-sectionTitle">Identity</h2>

                <div className="ap-grid3">
                  <div className="ap-field">
                    <label className="ap-label">First Name *</label>
                    <input
                      className={`ap-input ${errors.firstName ? "error" : ""}`}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g., Juan"
                    />
                    {errors.firstName && <p className="ap-error">{errors.firstName}</p>}
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Middle Name (optional)</label>
                    <input
                      className="ap-input"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="e.g., Agoncillo"
                    />
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Last Name *</label>
                    <input
                      className={`ap-input ${errors.lastName ? "error" : ""}`}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g., Dela Cruz"
                    />
                    {errors.lastName && <p className="ap-error">{errors.lastName}</p>}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="ap-section">
                <h2 className="ap-sectionTitle">Contact</h2>

                <div className="ap-grid2">
                  <div className="ap-field">
                    <label className="ap-label">Phone Number (PH local) *</label>
                    <div className="ap-phoneWrap">
                      <span className="ap-phonePrefix">+63</span>
                      <input
                        className={`ap-input ap-phoneInput ${errors.phoneNumber ? "error" : ""}`}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(digitsOnly(e.target.value))}
                        placeholder="10 digits (e.g., 9123456789)"
                        inputMode="numeric"
                      />
                    </div>
                    {errors.phoneNumber && <p className="ap-error">{errors.phoneNumber}</p>}
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Email (optional)</label>
                    <input
                      className={`ap-input ${errors.email ? "error" : ""}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g., name@email.com"
                    />
                    {errors.email && <p className="ap-error">{errors.email}</p>}
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div className="ap-section">
                <h2 className="ap-sectionTitle">Classification</h2>

                <div className="ap-grid2">
                  <div className="ap-field">
                    <label className="ap-label">Market Type *</label>
                    <select
                      className={`ap-input ${errors.marketType ? "error" : ""}`}
                      value={marketType}
                      onChange={(e) => setMarketType(e.target.value)}
                    >
                      <option value="">Select Market Type</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                    </select>
                    {errors.marketType && <p className="ap-error">{errors.marketType}</p>}
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Prospect Type (optional)</label>
                    <select
                      className="ap-input"
                      value={prospectType}
                      onChange={(e) => setProspectType(e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="Elite">Elite</option>
                      <option value="Ordinary">Ordinary</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Demographics */}
              <div className="ap-section">
                <h2 className="ap-sectionTitle">Demographics (optional)</h2>

                <div className="ap-grid3">
                  <div className="ap-field">
                    <label className="ap-label">Sex</label>
                    <select className="ap-input" value={sex} onChange={(e) => setSex(e.target.value)}>
                      <option value="">—</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Birthday</label>
                    <input
                      className={`ap-input ${errors.birthday ? "error" : ""}`}
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                    />
                    {errors.birthday && <p className="ap-error">{errors.birthday}</p>}
                  </div>

                  <div className="ap-field">
                    <label className="ap-label">Age</label>

                    {/* Live age preview when birthday is provided */}
                    {birthdayHasValue ? (
                      <>
                        <input
                          className={`ap-input ${errors.age ? "error" : ""}`}
                          value={computedAge ?? "—"}
                          disabled
                          title="Age is computed from Birthday"
                        />
                        <p className="ap-hint">Age is computed from Birthday.</p>
                      </>
                    ) : (
                      <>
                        <input
                          className={`ap-input ${errors.age ? "error" : ""}`}
                          value={age}
                          onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ""))}
                          inputMode="numeric"
                          placeholder="e.g., 25"
                        />
                        {errors.age && <p className="ap-error">{errors.age}</p>}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="ap-actions">
                <button type="button" className="ap-secondaryBtn" onClick={goBack}>
                  Cancel
                </button>

                <button type="submit" className="ap-primaryBtn" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Prospect"}
                </button>
              </div>

              <p className="ap-note">Note: Source and Status are system-set for newly created prospects.</p>
            </form>
          </div>

          {showSuccess && createdProspect && (
            <div className="ap-modalOverlay" role="dialog" aria-modal="true">
              <div className="ap-modal">
                <button
                  type="button"
                  className="ap-modalClose"
                  onClick={() =>
                    navigate(`/agent/${user.username}/prospects/${createdProspect._id}`)
                  }
                  aria-label="Close"
                  title="Go to Prospect Details"
                >
                  ×
                </button>

                <h3 className="ap-modalTitle">Prospect Created</h3>
                <p className="ap-modalText">
                  <span className="ap-modalName">
                    {createdProspect.firstName}
                    {createdProspect.middleName ? ` ${createdProspect.middleName}` : ""}{" "}
                    {createdProspect.lastName}
                  </span>
                  <br />
                  <span className="ap-modalCode">{createdProspect.prospectCode}</span>
                </p>

                <div className="ap-modalActions">
                  <button
                    type="button"
                    className="ap-primaryBtn"
                    onClick={() =>
                      navigate(`/agent/${user.username}/prospects/${createdProspect._id}`)
                    }
                  >
                    View New Prospect →
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AgentAddProspect;
