import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentProspectFullDetails.css";
import { PH_CITY_REGION_OPTIONS, CITY_TO_REGION } from "./constants/phCityRegionOptions";

function AgentProspectFullDetails() {
  const navigate = useNavigate();
  const { username, prospectId } = useParams();

  // Read user once
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [isReady, setIsReady] = useState(false);

  // Fetched from backend
  const [prospect, setProspect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});

  const [touched, setTouched] = useState({ birthday: false, age: false });

  // Success modal (update)
  const [showUpdated, setShowUpdated] = useState(false);

  // Generic error modal (no alerts)
  const [errorModal, setErrorModal] = useState({
    open: false,
    title: "",
    message: "",
  });

  // Drop modal (re-using existing modal structure)
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    type: "", // "confirm" | "blocked" | "reopen"
    title: "",
    message: "",
    leadsPreview: null, // { count, preview:[{leadCode,status}] }
    policyholder: null,
  });

  // Drop form (required)
  const DROP_REASONS = [
    "Interest / Engagement",
    "Eligibility / Fit",
    "Data / System",
    "Compliance / Risk",
    "Life Event",
    "Other",
  ];
  const [dropDraft, setDropDraft] = useState({ dropReason: "", dropNotes: "" });
  const [dropErrors, setDropErrors] = useState({});

  const openErrorModal = (title, message) => {
    setErrorModal({ open: true, title, message });
  };

  const closeErrorModal = () => {
    setErrorModal({ open: false, title: "", message: "" });
  };

  const openDeleteModal = (payload) => {
    setDeleteModal((prev) => ({
      ...prev,
      open: true,
      ...payload,
    }));
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      open: false,
      type: "",
      title: "",
      message: "",
      leadsPreview: null,
      policyholder: null,
    });
    setDropDraft({ dropReason: "", dropNotes: "" });
    setDropErrors({});
  };

  // ===== Helpers =====
  const digitsOnly = (v) => String(v || "").replace(/\D/g, "");

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

  const isFutureDateOnly = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d0 > t0;
  };

  // Normalize date for <input type="date">
  const toDateInputValue = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateTime = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const cityOptions = useMemo(
    () => [...PH_CITY_REGION_OPTIONS].sort((a, b) => a.city.localeCompare(b.city)),
    []
  );

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
    if (user) document.title = `${user.username} | Edit Prospect Details`;
  }, [user]);

  // Reusable fetch
  const fetchFullProspect = useCallback(
    async (signal) => {
      if (!user?.id) {
        setApiError("Missing user id. Please log in again.");
        setProspect(null);
        setDraft(null);
        return;
      }

      const res = await fetch(
        `http://localhost:5000/api/prospects/${prospectId}/full?userId=${user.id}`,
        { signal }
      );

      const data = await res.json();

      if (!res.ok) {
        setApiError(data.message || "Failed to fetch prospect.");
        setProspect(null);
        setDraft(null);
        return;
      }

      const p = data.prospect || null;
      setProspect(p);
      setDraft(p); // replace entire draft (prevents old optional values sticking)
    },
    [prospectId, user?.id]
  );

  // Initial fetch
  useEffect(() => {
    if (!isReady) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchFullProspect(controller.signal);
      } catch (err) {
        if (err.name !== "AbortError") {
          setApiError("Cannot connect to server. Is backend running?");
          setProspect(null);
          setDraft(null);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, fetchFullProspect]);

  const isDropped = String(prospect?.status || "") === "Dropped";

  // If birthday is set in edit mode, birthday wins → compute age
  useEffect(() => {
    if (!isEditing) return;
    if (!draft) return;

    const bStr = String(draft.birthday || "").trim();
    if (!bStr) return; // birthday cleared -> don't compute

    const computed = computeAgeFromBirthday(bStr);
    setDraft((d) => ({
      ...d,
      age: computed !== null ? computed : d.age,
    }));

    setErrors((e) => ({ ...e, age: undefined }));

    // DO NOT REMOVE LINE BELOW
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, draft?.birthday]);

  const validateDraft = () => {
    const next = {};
    if (!draft) return next;

    if (!String(draft.firstName || "").trim()) next.firstName = "First name is required.";
    if (!String(draft.lastName || "").trim()) next.lastName = "Last name is required.";

    const phone = digitsOnly(draft.phoneNumber);
    if (!phone) next.phoneNumber = "Phone number is required.";
    else if (!/^9\d{9}$/.test(phone)) {
      next.phoneNumber = "Phone must be 10 digits and start with 9 (e.g., 9123456789).";
    }

    if (!draft.marketType) next.marketType = "Market type is required.";

    const email = String(draft.email || "").trim();
    if (email) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!ok) next.email = "Invalid email format.";
    }

    if (draft.sex && !["Male", "Female"].includes(draft.sex)) next.sex = "Invalid sex.";

    if (draft.civilStatus && !["Single", "Married", "Widowed", "Separated", "Annulled"].includes(draft.civilStatus)) {
      next.civilStatus = "Invalid civil status.";
    }

    if (draft.occupationCategory && !["Employed", "Self-Employed", "Not Employed"].includes(draft.occupationCategory)) {
      next.occupationCategory = "Invalid occupation category.";
    }

    const occupationVal = String(draft.occupation || "").trim();
    if (draft.occupationCategory && ["Employed", "Self-Employed"].includes(draft.occupationCategory) && !occupationVal) {
      next.occupation = "Occupation is required for employed/self-employed.";
    }
    if (occupationVal.length > 150) {
      next.occupation = "Occupation must be 150 characters or less.";
    }

    const addr = draft.address || {};
    const addrLine = String(addr.line || "").trim();
    const addrBarangay = String(addr.barangay || "").trim();
    const addrCity = String(addr.city || "").trim();
    const addrOtherCity = String(addr.otherCity || "").trim();
    const addrRegion = String(addr.region || "").trim();
    const zip = String(addr.zipCode || "").trim();
    const hasAnyAddressValue = Boolean(addrLine || addrBarangay || addrCity || addrOtherCity || addrRegion || zip);

    if (hasAnyAddressValue) {
      if (!addrLine) next.addressLine = "Street address is required once address is provided.";
      if (!addrBarangay) next.addressBarangay = "Barangay is required once address is provided.";
      if (!addrCity) next.addressCity = "City is required once address is provided.";
      if (addrCity === "Other" && !addrOtherCity) next.addressOtherCity = "Other city is required.";
      if (!addrRegion) next.addressRegion = "Region is required once address is provided.";
      if (!zip) next.addressZipCode = "Zip code is required once address is provided.";
    }
    if (zip && !/^\d{4}$/.test(zip)) next.addressZipCode = "Zip code must be 4 digits.";

    if (draft.prospectType && !["Elite", "Ordinary"].includes(draft.prospectType)) {
      next.prospectType = "Invalid prospect type.";
    }

    if (draft.marketType && !["Warm", "Cold"].includes(draft.marketType)) next.marketType = "Invalid market type.";

    const hasBirthday = String(draft.birthday || "").trim() !== "";
    const hasAge = String(draft.age ?? "").toString().trim() !== "";

    if (hasBirthday) {
      if (isFutureDateOnly(draft.birthday)) {
        next.birthday = "Birthday cannot be in the future.";
      } else {
        const computed = computeAgeFromBirthday(draft.birthday);
        if (computed === null) next.birthday = "Invalid birthday.";
        else if (computed < 18 || computed > 70) next.birthday = "Prospect must be between 18 and 70 years old.";
      }
    } else if (hasAge) {
      const n = Number(draft.age);
      if (!Number.isFinite(n)) next.age = "Invalid age.";
      else if (n < 18 || n > 70) next.age = "Age must be between 18 and 70.";
    }

    return next;
  };

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

  const startEdit = () => {
    if (isDropped) {
      openErrorModal("Cannot Edit", "Please re-open this prospect before editing details.");
      return;
    }
    setDraft(prospect);
    setErrors({});
    setTouched({ birthday: false, age: false });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(prospect);
    setErrors({});
    setTouched({ birthday: false, age: false });
    setIsEditing(false);
  };

  const saveEdit = async () => {
    const nextErrors = validateDraft();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const cleanedPhone = digitsOnly(draft.phoneNumber);

      const payload = {
        firstName: String(draft.firstName || "").trim(),
        middleName: String(draft.middleName || "").trim(),
        lastName: String(draft.lastName || "").trim(),
        phoneNumber: cleanedPhone,
        email: String(draft.email ?? "").trim(),
        sex: draft.sex || "", // allow clearing
        civilStatus: draft.civilStatus || "", // optional
        occupationCategory: draft.occupationCategory ? draft.occupationCategory : undefined,
        occupation: ["Employed", "Self-Employed"].includes(draft.occupationCategory)
          ? String(draft.occupation || "").trim()
          : (String(draft.occupation || "").trim() || undefined),
        address: {
          line: String(draft.address?.line || "").trim(),
          barangay: String(draft.address?.barangay || "").trim(),
          city: String(draft.address?.city || "").trim(),
          otherCity: String(draft.address?.otherCity || "").trim(),
          region: String(draft.address?.region || "").trim(),
          zipCode: String(draft.address?.zipCode || "").trim(),
          country: "Philippines",
        },
        marketType: draft.marketType,
        prospectType: draft.prospectType || "", // allow clearing
      };

      // Only send birthday if user touched it
      if (touched.birthday) {
        payload.birthday = String(draft.birthday ?? "").trim(); // "" clears
      }

      // Only send age if user touched it AND birthday not set
      const bStr = String(draft.birthday || "").trim();
      if (touched.age && !bStr) {
        payload.age = String(draft.age ?? "").trim(); // "" clears
      }

      const res = await fetch(`http://localhost:5000/api/prospects/${prospectId}?userId=${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        openErrorModal("Update Failed", data.message || "Failed to update prospect.");
        return;
      }

      // RE-FETCH /full so cleared optional fields + prospectNo are correct
      await fetchFullProspect();

      setIsEditing(false);
      setShowUpdated(true);
    } catch (err) {
      openErrorModal("Connection Error", "Cannot connect to server. Is backend running?");
    }
  };

  // DROP LOGIC
  const getBlockingLeadsPreview = () => {
    const leads = Array.isArray(prospect?.leads) ? prospect.leads : [];
    const blocking = leads.filter((l) => String(l?.status || "") !== "Dropped");
    return {
      count: blocking.length,
      preview: blocking.map((l) => ({
        leadCode: l?.leadCode || "—",
        status: l?.status || "—",
      })),
    };
  };

  const onDropClick = () => {
    const preview = getBlockingLeadsPreview();

    if (preview.count > 0) {
      // Block dropping
      openDeleteModal({
        type: "blocked",
        title: "Cannot Drop Prospect",
        message:
          "This prospect cannot be dropped because there are existing lead record(s) that are not Dropped. Please drop those leads first.",
        leadsPreview: preview,
        policyholder: null,
      });
      return;
    }

    // Allow drop (confirm)
    openDeleteModal({
      type: "confirm",
      title: "Drop Prospect?",
      message:
        "Dropping will mark this prospect as Dropped. This action is used when the prospect is no longer eligible or cannot be contacted. Do you want to continue?",
      leadsPreview: null,
      policyholder: null,
    });
  };

  const validateDrop = () => {
    const next = {};
    if (!String(dropDraft.dropReason || "").trim()) next.dropReason = "Please select a reason.";
    if (!String(dropDraft.dropNotes || "").trim()) next.dropNotes = "Drop notes are required.";
    return next;
  };

  const attemptDrop = async () => {
    const nextErr = validateDrop();
    setDropErrors(nextErr);
    if (Object.keys(nextErr).length > 0) return;

    try {
      setDeleteBusy(true);

      // Safety: re-check leads before submit 
      const preview = getBlockingLeadsPreview();
      if (preview.count > 0) {
        openDeleteModal({
          type: "blocked",
          title: "Cannot Drop Prospect",
          message:
            "This prospect cannot be dropped because there are existing lead record(s) that are not Dropped. Please drop those leads first.",
          leadsPreview: preview,
          policyholder: null,
        });
        return;
      }

      // Send minimal + required fields (to avoid backend requiring other fields)
      const payload = {
        firstName: String(prospect.firstName || "").trim(),
        middleName: String(prospect.middleName || "").trim(),
        lastName: String(prospect.lastName || "").trim(),
        phoneNumber: String(prospect.phoneNumber || "").trim(),
        email: String(prospect.email ?? "").trim(),
        sex: prospect.sex || "",
        birthday: prospect.birthday ? toDateInputValue(prospect.birthday) : "",
        age: prospect.age ?? "",
        occupationCategory: prospect.occupationCategory || "Not Employed",
        occupation: String(prospect.occupation || "").trim(),
        address: {
          line: String(prospect.address?.line || "").trim(),
          barangay: String(prospect.address?.barangay || "").trim(),
          city: String(prospect.address?.city || "").trim(),
          region: String(prospect.address?.region || "").trim(),
          zipCode: String(prospect.address?.zipCode || "").trim(),
          country: "Philippines",
        },
        marketType: prospect.marketType,
        prospectType: prospect.prospectType || "",
        source: prospect.source,
        status: "Dropped",
        dropReason: String(dropDraft.dropReason || "").trim(),
        dropNotes: String(dropDraft.dropNotes || "").trim(),
      };

      const res = await fetch(`http://localhost:5000/api/prospects/${prospectId}?userId=${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        openErrorModal("Drop Failed", data.message || "Failed to drop prospect.");
        return;
      }

      closeDeleteModal();
      // Go back to Prospect Details page so they see the updated status there
      navigate(`/agent/${user.username}/prospects/${prospectId}`);
    } catch (err) {
      openErrorModal("Connection Error", "Cannot connect to server. Is backend running?");
    } finally {
      setDeleteBusy(false);
    }
  };

  // Re-Open Logic
  const onReopenClick = () => {
    openDeleteModal({
      type: "reopen",
      title: "Re-open Prospect?",
      message: "This will change the prospect status from Dropped to Active. Do you want to continue?",
      leadsPreview: null,
      policyholder: null,
    });
  };

  const attemptReopen = async () => {
    try {
      setDeleteBusy(true);

      // Keep required fields so PUT validation won’t fail
      const payload = {
        firstName: String(prospect.firstName || "").trim(),
        middleName: String(prospect.middleName || "").trim(),
        lastName: String(prospect.lastName || "").trim(),
        phoneNumber: String(prospect.phoneNumber || "").trim(),
        email: String(prospect.email ?? "").trim(),
        sex: prospect.sex || "",
        birthday: prospect.birthday ? toDateInputValue(prospect.birthday) : "",
        age: prospect.age ?? "",
        occupationCategory: prospect.occupationCategory || "Not Employed",
        occupation: String(prospect.occupation || "").trim(),
        address: {
          line: String(prospect.address?.line || "").trim(),
          barangay: String(prospect.address?.barangay || "").trim(),
          city: String(prospect.address?.city || "").trim(),
          region: String(prospect.address?.region || "").trim(),
          zipCode: String(prospect.address?.zipCode || "").trim(),
          country: "Philippines",
        },
        marketType: prospect.marketType,
        prospectType: prospect.prospectType || "",
        source: prospect.source,

        // reopen
        status: "Active",

        // clear drop fields
        dropReason: "",
        dropNotes: "",
      };

      const res = await fetch(`http://localhost:5000/api/prospects/${prospectId}?userId=${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        openErrorModal("Re-open Failed", data.message || "Failed to re-open prospect.");
        return;
      }

      closeDeleteModal();
      await fetchFullProspect();
    } catch (err) {
      openErrorModal("Connection Error", "Cannot connect to server. Is backend running?");
    } finally {
      setDeleteBusy(false);
    }
  };

  const display = isEditing ? draft : prospect;

  const fullName = display
    ? `${display.firstName || ""}${display.middleName ? ` ${display.middleName}` : ""} ${display.lastName || ""}`.trim()
    : "—";

  if (!isReady) return null;

  if (loading) {
    return (
      <div className="vp-shell">
        <TopNav
          user={user}
          onLogoClick={() => navigate(`/agent/${user.username}`)}
          onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
          onLogout={() => logout(navigate)}
          onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
        />
        <div className="vp-body">
          <SideNav onNavigate={handleSideNav} />
          <main className="vp-content">
            <p className="vp-note">Loading prospect...</p>
          </main>
        </div>
      </div>
    );
  }

  if (apiError || !prospect) {
    return (
      <div className="vp-shell">
        <TopNav
          user={user}
          onLogoClick={() => navigate(`/agent/${user.username}`)}
          onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
          onLogout={() => logout(navigate)}
          onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
        />
        <div className="vp-body">
          <SideNav onNavigate={handleSideNav} />
          <main className="vp-content">
            <p className="vp-note" style={{ color: "#DA291C", fontWeight: 800 }}>
              {apiError || "Prospect not found."}
            </p>
            <button type="button" className="vp-btn secondary" onClick={() => navigate(`/agent/${user.username}/prospects`)}>
              Back to Prospects
            </button>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="vp-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="vp-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="vp-content">
          {/* Breadcrumb */}
          <div className="pfd-breadcrumb">
            <button type="button" className="pfd-crumbLink" onClick={() => navigate(`/agent/${user.username}/prospects`)}>
              Prospects
            </button>

            <span className="pfd-crumbSep">›</span>

            <button
              type="button"
              className="pfd-crumbLink"
              onClick={() => navigate(`/agent/${user.username}/prospects/${prospectId}`)}
            >
              {fullName}
            </button>

            <span className="pfd-crumbSep">›</span>

            <span className="pfd-crumbCurrent">Edit Details</span>
          </div>

          <div className="vp-card">
            {/* Header */}
            <div className="vp-header">
              <div>
                <h1 className="vp-name">{fullName}</h1>
              </div>

              <div className="vp-actions">
                {!isEditing ? (
                  <>
                    <button type="button" className="vp-iconBtn" onClick={startEdit} title="Edit">
                      ✎
                    </button>

                    {!isDropped ? (
                      <button
                        type="button"
                        className="vp-iconBtn danger"
                        onClick={onDropClick}
                        title="Drop Prospect"
                        disabled={deleteBusy}
                      >
                        ⛔
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="vp-btn primary"
                        onClick={onReopenClick}
                        disabled={deleteBusy}
                        title="Re-open Prospect"
                      >
                        Re-open Prospect
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button type="button" className="vp-btn secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button type="button" className="vp-btn primary" onClick={saveEdit}>
                      Save Changes
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Locked row */}
            <div className="vp-lockedRow">
              <div className="vp-lockedItem">
                <span className="vp-lockedLabel">Agent's Prospect No.</span>
                <span className="vp-lockedValue">{String(prospect.prospectNo ?? 0).padStart(2, "0")}</span>
              </div>

              <div className="vp-lockedItem">
                <span className="vp-lockedLabel">Prospect Code</span>
                <span className="vp-lockedValue vp-mono">{prospect.prospectCode}</span>
              </div>

              <div className="vp-lockedItem">
                <span className="vp-lockedLabel">Source</span>
                <span className="vp-lockedValue">{prospect.source}</span>
              </div>

              <div className="vp-lockedItem">
                <span className="vp-lockedLabel">Status</span>
                <span
                  className={`status-pill ${
                    prospect.status === "Active"
                      ? "active"
                      : prospect.status === "Wrong Contact"
                      ? "wrong"
                      : "dropped"
                  }`}
                >
                  {prospect.status || "—"}
                </span>
              </div>

                {/* Dropped details (only show when Dropped) */}
                {isDropped && (
                  <div className="vp-dropRow">
                    <div className="vp-dropItem">
                      <span className="vp-lockedLabel">Drop Reason</span>
                      <span className="vp-lockedValue">{prospect.dropReason || "—"}</span>
                    </div>

                    <div className="vp-dropItem">
                      <span className="vp-lockedLabel">Drop Notes</span>
                      <span className="vp-lockedValue">{prospect.dropNotes || "—"}</span>
                    </div>

                    <div className="vp-dropItem">
                      <span className="vp-lockedLabel">Dropped At</span>
                      <span className="vp-lockedValue">{formatDateTime(prospect.droppedAt)}</span>
                    </div>
                  </div>
                )}
            </div>

            {/* Sections */}
            <div className="vp-grid">
              {/* Identity */}
              <section className="vp-section">
                <h2 className="vp-sectionTitle">Identity</h2>

                <div className="vp-grid3">
                  <div className="vp-field">
                    <label className="vp-label">First Name *</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.firstName || "—"}</div>
                    ) : (
                      <>
                        <input
                          className={`vp-input ${errors.firstName ? "error" : ""}`}
                          value={draft.firstName || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                        />
                        {errors.firstName && <p className="vp-error">{errors.firstName}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Middle Name (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.middleName || "—"}</div>
                    ) : (
                      <input
                        className="vp-input"
                        value={draft.middleName || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, middleName: e.target.value }))}
                      />
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Last Name *</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.lastName || "—"}</div>
                    ) : (
                      <>
                        <input
                          className={`vp-input ${errors.lastName ? "error" : ""}`}
                          value={draft.lastName || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                        />
                        {errors.lastName && <p className="vp-error">{errors.lastName}</p>}
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Contact */}
              <section className="vp-section">
                <h2 className="vp-sectionTitle">Contact</h2>

                <div className="vp-grid2">
                  <div className="vp-field">
                    <label className="vp-label">Phone Number (PH local) *</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.phoneNumber ? `+63 ${display.phoneNumber}` : "—"}</div>
                    ) : (
                      <>
                        <div className="vp-phoneWrap">
                          <span className="vp-phonePrefix">+63</span>
                          <input
                            className={`vp-input vp-phoneInput ${errors.phoneNumber ? "error" : ""}`}
                            value={draft.phoneNumber || ""}
                            onChange={(e) => setDraft((d) => ({ ...d, phoneNumber: digitsOnly(e.target.value) }))}
                            inputMode="numeric"
                            placeholder="10 digits starting with 9"
                          />
                        </div>
                        {errors.phoneNumber && <p className="vp-error">{errors.phoneNumber}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Email (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.email || "—"}</div>
                    ) : (
                      <>
                        <input
                          className={`vp-input ${errors.email ? "error" : ""}`}
                          value={draft.email || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                          placeholder="name@email.com"
                        />
                        {errors.email && <p className="vp-error">{errors.email}</p>}
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Classification */}
              <section className="vp-section">
                <h2 className="vp-sectionTitle">Classification</h2>

                <div className="vp-grid3">
                  <div className="vp-field">
                    <label className="vp-label">Market Type *</label>
                    {!isEditing ? (
                      <div className="vp-value">
                        <span className={`pill market ${String(display.marketType || "").toLowerCase()}`}>
                          {display.marketType || "—"}
                        </span>
                      </div>
                    ) : (
                      <>
                        <select
                          className={`vp-input ${errors.marketType ? "error" : ""}`}
                          value={draft.marketType || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, marketType: e.target.value }))}
                        >
                          <option value="">Select</option>
                          <option value="Warm">Warm</option>
                          <option value="Cold">Cold</option>
                        </select>
                        {errors.marketType && <p className="vp-error">{errors.marketType}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Prospect Type (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">
                        {display.prospectType ? (
                          <span className={`pill prospect ${String(display.prospectType).toLowerCase()}`}>
                            {display.prospectType}
                          </span>
                        ) : (
                          "—"
                        )}
                      </div>
                    ) : (
                      <>
                        <select
                          className={`vp-input ${errors.prospectType ? "error" : ""}`}
                          value={draft.prospectType || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, prospectType: e.target.value }))}
                        >
                          <option value="">—</option>
                          <option value="Elite">Elite</option>
                          <option value="Ordinary">Ordinary</option>
                        </select>
                        {errors.prospectType && <p className="vp-error">{errors.prospectType}</p>}
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Demographics */}
              <section className="vp-section">
                <h2 className="vp-sectionTitle">Demographics</h2>

                <div className="vp-grid3">
                  <div className="vp-field">
                    <label className="vp-label">Sex (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.sex || "—"}</div>
                    ) : (
                      <>
                        <select
                          className={`vp-input ${errors.sex ? "error" : ""}`}
                          value={draft.sex || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, sex: e.target.value }))}
                        >
                          <option value="">—</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                        {errors.sex && <p className="vp-error">{errors.sex}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Civil Status (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.civilStatus || "—"}</div>
                    ) : (
                      <>
                        <select
                          className={`vp-input ${errors.civilStatus ? "error" : ""}`}
                          value={draft.civilStatus || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, civilStatus: e.target.value }))}
                        >
                          <option value="">—</option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Widowed">Widowed</option>
                          <option value="Separated">Separated</option>
                          <option value="Annulled">Annulled</option>
                        </select>
                        {errors.civilStatus && <p className="vp-error">{errors.civilStatus}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Occupation Category (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.occupationCategory || "—"}</div>
                    ) : (
                      <>
                        <select
                          className={`vp-input ${errors.occupationCategory ? "error" : ""}`}
                          value={draft.occupationCategory || ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              occupationCategory: e.target.value,
                              occupation: e.target.value === "Not Employed" ? "" : d.occupation,
                            }))
                          }
                        >
                          <option value="">Select</option>
                          <option value="Employed">Employed</option>
                          <option value="Self-Employed">Self-Employed</option>
                          <option value="Not Employed">Not Employed</option>
                        </select>
                        {errors.occupationCategory && <p className="vp-error">{errors.occupationCategory}</p>}
                      </>
                    )}
                  </div>

                  {(String(display.occupationCategory || "") === "Employed" ||
                    String(display.occupationCategory || "") === "Self-Employed" ||
                    (isEditing && ["Employed", "Self-Employed"].includes(String(draft.occupationCategory || "")))) && (
                    <div className="vp-field">
                      <label className="vp-label">Occupation (optional)</label>
                      {!isEditing ? (
                        <div className="vp-value">{display.occupation || "—"}</div>
                      ) : (
                        <>
                          <input
                            className={`vp-input ${errors.occupation ? "error" : ""}`}
                            value={draft.occupation || ""}
                            onChange={(e) => setDraft((d) => ({ ...d, occupation: e.target.value }))}
                            maxLength={150}
                            placeholder="e.g., Engineer"
                          />
                          {errors.occupation && <p className="vp-error">{errors.occupation}</p>}
                        </>
                      )}
                    </div>
                  )}

                  <div className="vp-field">
                    <label className="vp-label">Street Address (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.address?.line || "—"}</div>
                    ) : (
                      <>
                        <input
                          className={`vp-input ${errors.addressLine ? "error" : ""}`}
                          value={draft.address?.line || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, address: { ...(d.address || {}), line: e.target.value } }))}
                        />
                        {errors.addressLine && <p className="vp-error">{errors.addressLine}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Barangay (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.address?.barangay || "—"}</div>
                    ) : (
                      <>
                        <input
                          className={`vp-input ${errors.addressBarangay ? "error" : ""}`}
                          value={draft.address?.barangay || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, address: { ...(d.address || {}), barangay: e.target.value } }))}
                        />
                        {errors.addressBarangay && <p className="vp-error">{errors.addressBarangay}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">City (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.address?.city || "—"}</div>
                    ) : (
                      <>
                        <select
                          className={`vp-input ${errors.addressCity ? "error" : ""}`}
                          value={draft.address?.city || ""}
                          onChange={(e) => {
                            const city = e.target.value;
                            const region = CITY_TO_REGION[city] || "";
                            setDraft((d) => ({ ...d, address: { ...(d.address || {}), city, otherCity: city === "Other" ? d.address?.otherCity || "" : "", region: city === "Other" ? (d.address?.region || "") : region, country: "Philippines" } }));
                          }}
                        >
                          <option value="">Select city</option>
                          <option value="Other">Other</option>
                          {cityOptions.map((item) => (
                            <option key={item.city} value={item.city}>{item.city}</option>
                          ))}
                        </select>
                        {errors.addressCity && <p className="vp-error">{errors.addressCity}</p>}
                      </>
                    )}
                  </div>

                  {isEditing && String(draft.address?.city || "") === "Other" && (
                    <div className="vp-field">
                      <label className="vp-label">Other City (optional)</label>
                      <input
                        className={`vp-input ${errors.addressOtherCity ? "error" : ""}`}
                        value={draft.address?.otherCity || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, address: { ...(d.address || {}), otherCity: e.target.value } }))}
                      />
                      {errors.addressOtherCity && <p className="vp-error">{errors.addressOtherCity}</p>}
                    </div>
                  )}

                  <div className="vp-field">
                    <label className="vp-label">Region (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.address?.region || "—"}</div>
                    ) : (
                      <>
                        <input className={`vp-input ${errors.addressRegion ? "error" : ""}`} value={draft.address?.region || ""} readOnly={String(draft.address?.city || "") !== "Other"} onChange={(e) => setDraft((d) => ({ ...d, address: { ...(d.address || {}), region: e.target.value } }))} />
                        {errors.addressRegion && <p className="vp-error">{errors.addressRegion}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Zip Code (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.address?.zipCode || "—"}</div>
                    ) : (
                      <>
                        <input
                          className={`vp-input ${errors.addressZipCode ? "error" : ""}`}
                          value={draft.address?.zipCode || ""}
                          onChange={(e) => setDraft((d) => ({ ...d, address: { ...(d.address || {}), zipCode: String(e.target.value).replace(/[^\d]/g, "").slice(0, 4) } }))}
                          inputMode="numeric"
                        />
                        {errors.addressZipCode && <p className="vp-error">{errors.addressZipCode}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Country</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.address?.country || "Philippines"}</div>
                    ) : (
                      <input className="vp-input" value="Philippines" readOnly />
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Birthday (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.birthday ? toDateInputValue(display.birthday) : "—"}</div>
                    ) : (
                      <>
                        <input
                          className={`vp-input ${errors.birthday ? "error" : ""}`}
                          type="date"
                          value={toDateInputValue(draft.birthday)}
                          onChange={(e) => {
                            const v = e.target.value; // "" or "YYYY-MM-DD"
                            setTouched((t) => ({ ...t, birthday: true }));

                            setDraft((d) => ({
                              ...d,
                              birthday: v, // empty string clears
                            }));

                            if (v === "") {
                              setErrors((er) => ({ ...er, birthday: undefined }));
                            }
                          }}
                        />
                        {errors.birthday && <p className="vp-error">{errors.birthday}</p>}
                      </>
                    )}
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Age (optional)</label>
                    {!isEditing ? (
                      <div className="vp-value">{display.age ?? "—"}</div>
                    ) : (
                      <>
                        <input
                          className={`vp-input ${errors.age ? "error" : ""}`}
                          value={draft.age ?? ""}
                          onChange={(e) => {
                            setTouched((t) => ({ ...t, age: true }));
                            setDraft((d) => ({
                              ...d,
                              age: String(e.target.value).replace(/[^\d]/g, ""),
                            }));
                          }}
                          inputMode="numeric"
                          disabled={String(draft.birthday || "").trim() !== ""}
                          title={String(draft.birthday || "").trim() ? "Age will be computed from Birthday" : ""}
                        />
                        <div className="vp-help muted">
                          {String(draft.birthday || "").trim()
                            ? `Auto-computed age: ${computeAgeFromBirthday(draft.birthday) ?? "—"}`
                            : "Enter age only if birthday is unknown."}
                        </div>
                        {errors.age && <p className="vp-error">{errors.age}</p>}
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* System */}
              <section className="vp-section">
                <h2 className="vp-sectionTitle">System</h2>

                <div className="vp-grid2">
                  <div className="vp-field">
                    <label className="vp-label">Date Created</label>
                    <div className="vp-value">{formatDateTime(prospect.createdAt)}</div>
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Last Updated</label>
                    <div className="vp-value">{formatDateTime(prospect.updatedAt)}</div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* UPDATED SUCCESS MODAL */}
          {showUpdated && (
            <div className="vp-modalOverlay" role="dialog" aria-modal="true">
              <div className="vp-modal">
                <button
                  type="button"
                  className="vp-modalClose"
                  onClick={() => setShowUpdated(false)}
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </button>

                <h3 className="vp-modalTitle">Prospect Updated</h3>
                <p className="vp-modalText">Changes have been saved successfully.</p>

                <div className="vp-modalActions">
                  <button type="button" className="vp-btn secondary" onClick={() => setShowUpdated(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ERROR MODAL */}
          {errorModal.open && (
            <div className="vp-modalOverlay" role="dialog" aria-modal="true">
              <div className="vp-modal">
                <button
                  type="button"
                  className="vp-modalClose"
                  onClick={closeErrorModal}
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </button>

                <h3 className="vp-modalTitle">{errorModal.title || "Error"}</h3>
                <p className="vp-modalText">{errorModal.message || "Something went wrong."}</p>

                <div className="vp-modalActions">
                  <button type="button" className="vp-btn primary" onClick={closeErrorModal}>
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DROP / REOPEN MODAL (re-using deleteModal UI) */}
          {deleteModal.open && (
            <div className="vp-modalOverlay" role="dialog" aria-modal="true">
              <div className="vp-modal">
                <button
                  type="button"
                  className="vp-modalClose"
                  onClick={closeDeleteModal}
                  aria-label="Close"
                  title="Close"
                  disabled={deleteBusy}
                >
                  ×
                </button>

                <h3 className="vp-modalTitle">{deleteModal.title}</h3>
                <p className="vp-modalText">{deleteModal.message}</p>

                {/* BLOCKED: show leads that block dropping */}
                {deleteModal.type === "blocked" && deleteModal.leadsPreview && (
                  <div className="vp-modalBox">
                    <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 15}}>
                      Lead record(s) blocking drop: {deleteModal.leadsPreview.count}
                    </div>

                    {(deleteModal.leadsPreview.preview || []).map((l) => (
                      <div key={`${l.leadCode}-${l.status}`} className="vp-modalLeadRow">
                        <span className="vp-mono">{l.leadCode}</span>
                        <span className="vp-mono">{l.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CONFIRM (DROP): show required drop fields */}
                {deleteModal.type === "confirm" && (
                  <div className="vp-modalBox">
                    <div className="vp-field" style={{ marginBottom: 10 }}>
                      <label className="vp-label">Reason for Dropping *</label>
                      <select
                        className={`vp-input ${dropErrors.dropReason ? "error" : ""}`}
                        value={dropDraft.dropReason}
                        onChange={(e) => {
                          setDropDraft((d) => ({ ...d, dropReason: e.target.value }));
                          setDropErrors((er) => ({ ...er, dropReason: undefined }));
                        }}
                      >
                        <option value="">Select</option>
                        {DROP_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      {dropErrors.dropReason && <p className="vp-error">{dropErrors.dropReason}</p>}
                    </div>

                    <div className="vp-field">
                      <label className="vp-label">Drop Notes *</label>
                      <textarea
                        className={`vp-input ${dropErrors.dropNotes ? "error" : ""}`}
                        value={dropDraft.dropNotes}
                        onChange={(e) => {
                          setDropDraft((d) => ({ ...d, dropNotes: e.target.value }));
                          setDropErrors((er) => ({ ...er, dropNotes: undefined }));
                        }}
                        rows={4}
                        placeholder="Please explain briefly why this prospect is being dropped..."
                        style={{ resize: "vertical" }}
                      />
                      {dropErrors.dropNotes && <p className="vp-error">{dropErrors.dropNotes}</p>}
                    </div>
                  </div>
                )}

                <div className="vp-modalActions">
                  <button
                    type="button"
                    className="vp-btn secondary"
                    onClick={closeDeleteModal}
                    disabled={deleteBusy}
                  >
                    Close
                  </button>

                  {/* Only show Drop button when confirm */}
                  {deleteModal.type === "confirm" && (
                    <button
                      type="button"
                      className="vp-btn primary"
                      onClick={attemptDrop}
                      disabled={deleteBusy}
                      title="Mark prospect as Dropped"
                    >
                      {deleteBusy ? "Dropping..." : "Drop Prospect"}
                    </button>
                  )}

                  {/* Re-open */}
                  {deleteModal.type === "reopen" && (
                    <button
                      type="button"
                      className="vp-btn primary"
                      onClick={attemptReopen}
                      disabled={deleteBusy}
                      title="Re-open this prospect"
                    >
                      {deleteBusy ? "Re-opening..." : "Re-open"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AgentProspectFullDetails;
