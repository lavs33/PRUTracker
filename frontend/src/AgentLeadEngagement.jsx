import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentLeadEngagement.css";

function AgentLeadEngagement() {
  const navigate = useNavigate();
  const { username, prospectId, leadId } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  // page state
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [prospect, setProspect] = useState(null);
  const [lead, setLead] = useState(null);
  const [engagement, setEngagement] = useState(null);

  // ✅ Add Attempt UI
  const [showAddAttempt, setShowAddAttempt] = useState(false);
  const [addingAttempt, setAddingAttempt] = useState(false);
  const [attemptErrors, setAttemptErrors] = useState({});
  const [attemptForm, setAttemptForm] = useState({
    primaryChannel: "",
    otherChannels: [],
    response: "",
    attemptedAtLabel: "", // display only (non-editable)
    notes: "",
  });

  // ✅ NEW: attempt warning modal BEFORE opening form
  const [showAttemptLimitModal, setShowAttemptLimitModal] = useState(false);

  // ✅ NEW: Validate Contact UI
  const [validateForm, setValidateForm] = useState({
    phoneValidation: "", // "CORRECT" | "WRONG_CONTACT"
  });
  const [validatingContact, setValidatingContact] = useState(false);
  const [validateError, setValidateError] = useState("");

  // ✅ NEW: Blocked modal (when Wrong Contact is confirmed)
  const [showBlockedModal, setShowBlockedModal] = useState(false);

  // Title
  useEffect(() => {
    document.title = `${username} | Lead Engagement`;
  }, [username]);

  // Guard
  useEffect(() => {
    if (!user || user.username !== username) {
      setIsReady(false);
      navigate("/", { replace: true });
      return;
    }
    setIsReady(true);
  }, [user, username, navigate]);

  const API_BASE = "http://localhost:5000";

  const fetchEngagement = useCallback(
    async (signal) => {
      const options = signal ? { signal } : undefined;

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/engagement?userId=${user.id}`,
        options
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch lead engagement details.");
      }

      setProspect(data?.prospect || null);
      setLead(data?.lead || null);
      setEngagement(data?.engagement || null);
    },
    [API_BASE, prospectId, leadId, user?.id]
  );

  // Fetch engagement details
  useEffect(() => {
    if (!isReady) return;
    if (!user?.id) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchEngagement(controller.signal);
      } catch (err) {
        if (err.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server. Is backend running?");
          setProspect(null);
          setLead(null);
          setEngagement(null);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id, prospectId, leadId, fetchEngagement]);

  const PIPELINE_STEPS = useMemo(
    () => ["Contacting", "Needs Assessment", "Proposal", "Application", "Policy Issuance"],
    []
  );

  // ✅ Keep everything present tense (no past tense logic)
  const CONTACTING_STEPS_UI = useMemo(
    () => [
      { key: "Attempt Contact", label: "Attempt Contact" },
      { key: "Validate Contact", label: "Validate Contact" },
      { key: "Assess Interest", label: "Assess Interest" },
      { key: "Schedule Meeting", label: "Schedule Meeting" },
    ],
    []
  );

  const CHANNELS = useMemo(() => ["Call", "SMS", "WhatsApp", "Viber", "Telegram"], []);
  const RESPONSES = useMemo(() => ["Responded", "No Response"], []);

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

  const formatDueShort = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSideNav = (key) => {
    if (!user) return navigate("/");

    switch (key) {
      // CLIENTS
      case "clients":
        navigate(`/agent/${user.username}/clients`);
        break;

      case "clients_all_prospects":
        navigate(`/agent/${user.username}/prospects`);
        break;

      case "clients_all_policyholders":
        alert("All Policyholders page coming soon.");
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

  const goBackToLeadDetails = () => {
    navigate(`/agent/${username}/prospects/${prospectId}/leads/${leadId}`);
  };

  // Helpers / derived state
  const prospectName = prospect?.fullName || "—";
  const leadCode = lead?.leadCode || "—";

  const attempts = Array.isArray(engagement?.contactAttempts) ? engagement.contactAttempts : [];
  const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;

  // UI stage: if there are attempts but backend still says Not Started, show Contacting on UI
  const rawStage = engagement?.currentStage || "Not Started";
  const stage = rawStage === "Not Started" && attempts.length > 0 ? "Contacting" : rawStage;

  // Not Started => no active pipeline step
  const safeIndex = stage === "Not Started" ? -1 : PIPELINE_STEPS.indexOf(stage);

  // Activity tracker only relevant in Contacting
  const showContactingTracker = stage === "Contacting";

  // Current activity (badge + tracker)
  const currentActivityKeyRaw = String(engagement?.currentActivityKey || "").trim();

  
  // ✅ NEW: block flags
  const isEngagementBlocked = !!engagement?.isBlocked;
  const uiLocked = isEngagementBlocked; // clearer name

  const isLastAttemptResponded = lastAttempt?.response === "Responded";

  const currentContactVersion = Number(prospect?.contactInfoVersion ?? 1);
  const lastAttemptVersionUsed = Number(lastAttempt?.contactInfoVersionUsed ?? NaN);

  // show validate ONLY when:
  // - not blocked
  // - last attempt responded
  // - last attempt used the CURRENT contact info version
  const showValidateContact =
    !isEngagementBlocked &&
    lastAttempt?.response === "Responded" &&
    Number.isFinite(lastAttemptVersionUsed) &&
    lastAttemptVersionUsed === currentContactVersion;

  const hasOpenApproachTask = useMemo(() => {
      const list = Array.isArray(engagement?.tasks) ? engagement.tasks : [];
      return list.some((t) => t.status === "Open" && String(t.type).toUpperCase() === "APPROACH");
  }, [engagement?.tasks]);

  const isReApproachMode =
    !isEngagementBlocked &&
    hasOpenApproachTask &&
    isLastAttemptResponded &&
    Number.isFinite(lastAttemptVersionUsed) &&
    lastAttemptVersionUsed < currentContactVersion;

  const effectiveActivityKey =
    (isReApproachMode ? "Attempt Contact" : currentActivityKeyRaw) ||
    (attempts.length > 0 ? "Attempt Contact" : "");

  const normalizedActivityIndex = useMemo(() => {
    if (stage === "Not Started" && attempts.length === 0) return -1; // none active
    if (attempts.length === 0) return 0;

    const idx = CONTACTING_STEPS_UI.findIndex((s) => s.key === effectiveActivityKey);
    return idx >= 0 ? idx : 0;
  }, [stage, attempts.length, CONTACTING_STEPS_UI, effectiveActivityKey]);

  // ✅ Badge label
  const currentActivityLabel = useMemo(() => {
    if (stage === "Not Started" && attempts.length === 0) return "—";
    if (attempts.length > 0) return effectiveActivityKey || "Attempt Contact";
    return "Attempt Contact";
  }, [stage, attempts.length, effectiveActivityKey]);

  const mainTitle = stage === "Not Started" ? "Not Started" : stage || "—";

    // ✅ Add Attempt is allowed ONLY when:
    // - not blocked
    // - and (no responded yet OR re-approach after Wrong Contact)
    // has open approach task
    const canAddAttempt = useMemo(() => {
    if (isEngagementBlocked) return false;

    // if they haven't responded yet -> allow attempts
    if (!isLastAttemptResponded) return true;

    // if they responded, only allow if re-approach conditions are met
    return isReApproachMode;
  }, [isEngagementBlocked, isLastAttemptResponded, isReApproachMode]);

  const addAttemptDisabledReason = useMemo(() => {
    if (isEngagementBlocked) return "Engagement is blocked. Update contact info to continue.";
    if (isLastAttemptResponded && !isReApproachMode)
      return "Prospect already responded. Please validate contact instead.";
    return "";
  }, [isEngagementBlocked, isLastAttemptResponded, isReApproachMode]);


  // ✅ Auto open/close blocked modal based on backend flag
  useEffect(() => {
    if (isEngagementBlocked) {
      setShowBlockedModal(true);
    } else {
      setShowBlockedModal(false);
    }
  }, [isEngagementBlocked]);

  // =========================
  // ADD ATTEMPT: helpers
  // =========================
  const resetAttemptForm = () => {
    setAttemptErrors({});
    setAttemptForm({
      primaryChannel: "",
      otherChannels: [],
      response: "",
      attemptedAtLabel: formatDateTime(new Date()), // show "now", not editable
      notes: "",
    });
  };

  const validateAttempt = () => {
    const e = {};
    const primary = String(attemptForm.primaryChannel || "").trim();
    const response = String(attemptForm.response || "").trim();

    if (!primary) e.primaryChannel = "Primary channel is required.";
    if (primary && !CHANNELS.includes(primary)) e.primaryChannel = "Invalid primary channel.";

    const others = Array.isArray(attemptForm.otherChannels) ? attemptForm.otherChannels : [];
    const cleanOthers = others.filter(Boolean);

    if (new Set(cleanOthers).size !== cleanOthers.length) e.otherChannels = "Other channels must be unique.";
    if (primary && cleanOthers.includes(primary))
      e.otherChannels = "Other channels cannot include the primary channel.";
    for (const ch of cleanOthers) {
      if (!CHANNELS.includes(ch)) {
        e.otherChannels = "One or more other channels are invalid.";
        break;
      }
    }

    if (!response) e.response = "Response is required.";
    if (response && !RESPONSES.includes(response)) e.response = "Invalid response.";

    return e;
  };

  const toggleOtherChannel = (ch) => {
    setAttemptForm((f) => {
      const set = new Set(Array.isArray(f.otherChannels) ? f.otherChannels : []);
      if (set.has(ch)) set.delete(ch);
      else set.add(ch);
      return { ...f, otherChannels: Array.from(set) };
    });
    setAttemptErrors((er) => ({ ...er, otherChannels: undefined }));
  };

  // ✅ show warning modal BEFORE opening the form if attempts >= 10
  const shouldWarnAttemptLimit = useMemo(() => attempts.length >= 10, [attempts.length]);

  const onOpenAddAttempt = () => {
    // If blocked, show blocked modal
    if (isEngagementBlocked) {
      setShowBlockedModal(true);
      return;
    }

    // If disabled due to responded (not wrong-contact re-approach), do nothing
    if (!canAddAttempt) return;

    if (shouldWarnAttemptLimit) {
      setShowAttemptLimitModal(true);
      return;
    }

    setShowAddAttempt(true);
    resetAttemptForm();
  };

  const onCancelAddAttempt = () => {
    setShowAddAttempt(false);
    resetAttemptForm();
  };

  const onSubmitAttempt = async () => {
    const errs = validateAttempt();
    setAttemptErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      setAddingAttempt(true);

      const payload = {
        primaryChannel: attemptForm.primaryChannel,
        otherChannels: attemptForm.otherChannels,
        response: attemptForm.response,
        notes: String(attemptForm.notes || "").trim(),
      };

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/contact-attempts?userId=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to add contact attempt.");
      }

      await fetchEngagement();

      setShowAddAttempt(false);
      resetAttemptForm();
    } catch (err) {
      setAttemptErrors((er) => ({
        ...er,
        _global: err?.message || "Cannot connect to server. Is backend running?",
      }));
    } finally {
      setAddingAttempt(false);
    }
  };

  // =========================
  // ✅ Validate Contact submit
  // =========================
  const submitValidateContact = async () => {
    try {
      setValidateError("");

      const result = String(validateForm.phoneValidation || "").trim();
      if (!result) {
        setValidateError("Please select a validation result.");
        return;
      }

      // ✅ If Correct: no backend route needed yet (your backend only handles WRONG_CONTACT)
      if (result === "CORRECT") {
        // Optionally you can also move UI forward (ex: show badge/step change) later,
        // but safest is: just clear the validate UI and let user continue attempts/next steps.
        setValidateForm({ phoneValidation: "" });
        setValidateError("");
        // If you want, you can also refetch just to sync, but not required:
        // await fetchEngagement();
        return;
      }

      setValidatingContact(true);

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/validate-contact?userId=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to validate contact.");

      await fetchEngagement();

      setValidateForm({ phoneValidation: "" });
    } catch (err) {
      setValidateError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setValidatingContact(false);
    }
  };

  // =========================
  // Tasks
  // =========================
  const tasksAll = useMemo(() => {
    const arr = Array.isArray(engagement?.tasks) ? [...engagement.tasks] : [];
    return arr.sort((a, b) => {
      const da = new Date(a?.dueAt).getTime();
      const db = new Date(b?.dueAt).getTime();
      const na = Number.isFinite(da) ? da : Infinity;
      const nb = Number.isFinite(db) ? db : Infinity;
      return na - nb;
    });
  }, [engagement?.tasks]);

  const openTasks = useMemo(() => {
    const now = Date.now();
    return tasksAll.filter((t) => {
      const due = new Date(t?.dueAt).getTime();
      const dueOk = Number.isFinite(due) ? due : Infinity;
      return t.status === "Open" && dueOk >= now;
    });
  }, [tasksAll]);

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return tasksAll.filter((t) => {
      const due = new Date(t?.dueAt).getTime();
      const dueOk = Number.isFinite(due) ? due : -Infinity;
      return t.status === "Open" && dueOk < now;
    });
  }, [tasksAll]);

  const doneTasks = useMemo(() => tasksAll.filter((t) => t.status === "Done"), [tasksAll]);

  const taskTypeClass = (type) => {
    const t = String(type || "").toUpperCase();
    if (["APPROACH", "FOLLOW_UP", "APPOINTMENT", "PRESENTATION"].includes(t)) return "le-taskType urgent";
    if (t === "UPDATE_CONTACT_INFO") return "le-taskType info";
    return "le-taskType";
  };

  const taskStatusClass = (t) => {
    const due = new Date(t?.dueAt).getTime();
    const isOverdue = t.status === "Open" && Number.isFinite(due) && due < Date.now();
    if (t.status === "Done") return "le-taskStatus done";
    if (isOverdue) return "le-taskStatus overdue";
    return "le-taskStatus open";
  };

  const TaskRow = ({ t }) => {
    const due = new Date(t?.dueAt).getTime();
    const isOverdue = t.status === "Open" && Number.isFinite(due) && due < Date.now();
    const uiStatus = t.status === "Done" ? "Done" : isOverdue ? "Overdue" : "Open";

    return (
      <div className="le-taskCard">
        <div className="le-taskTop">
          <div className="le-taskLeft">
            <div className={taskTypeClass(t.type)}>{t.type}</div>
            <div className="le-taskTitle">{t.title}</div>
          </div>
          <span className={taskStatusClass(t)}>{uiStatus}</span>
        </div>

        <div className="le-taskMeta">
          <div className="le-taskMetaItem">
            <span className="le-taskMetaLabel">Due</span>
            <span className="le-taskMetaVal">{formatDueShort(t.dueAt)}</span>
          </div>

          {t.status === "Done" ? (
            <div className="le-taskMetaItem">
              <span className="le-taskMetaLabel">Done</span>
              <span className="le-taskMetaVal">{formatDueShort(t.completedAt)}</span>
            </div>
          ) : null}
        </div>

        {String(t.description || "").trim() ? <div className="le-taskDesc">{t.description}</div> : null}
      </div>
    );
  };

  if (!isReady) return null;

  const nextAttemptNo = attempts.length + 1;

  return (
    <div className="le-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="le-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="le-content">
          {loading && <p className="le-small-note">Loading lead engagement...</p>}

          {!loading && apiError && (
            <div>
              <p className="le-muted" style={{ color: "#DA291C" }}>
                {apiError}
              </p>
              <button type="button" className="le-btn secondary" onClick={goBackToLeadDetails}>
                ← Back
              </button>
            </div>
          )}

          {!loading && !apiError && prospect && lead && engagement && (
            <>
              {/* Breadcrumb */}
              <div className="le-breadcrumb">
                <button
                  type="button"
                  className="le-crumbLink"
                  onClick={() => navigate(`/agent/${username}/prospects`)}
                >
                  Prospects
                </button>
                <span className="le-crumbSep">›</span>

                <button
                  type="button"
                  className="le-crumbLink"
                  onClick={() => navigate(`/agent/${username}/prospects/${prospectId}`)}
                >
                  {prospectName}
                </button>
                <span className="le-crumbSep">›</span>

                <button type="button" className="le-crumbLink" onClick={goBackToLeadDetails}>
                  {leadCode}
                </button>
                <span className="le-crumbSep">›</span>

                <span className="le-crumbCurrent">Lead Engagement</span>
              </div>

              {/* Summary Row */}
              <div className="le-summaryRow">
                {/* Prospect Summary */}
                <section className="le-summaryCard">
                  <h3 className="le-summaryTitle">Prospect Details</h3>

                  <div className="le-summaryGrid">
                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Name</span>
                      <strong className="le-summaryValue">{prospectName}</strong>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Market Type</span>
                      <span className={`le-pill market ${String(prospect.marketType || "").toLowerCase()}`}>
                        {prospect.marketType || "—"}
                      </span>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Source</span>
                      <span
                        className={`le-pill source ${String(prospect.source || "")
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {prospect.source || "—"}
                      </span>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Status</span>
                      <span
                        className={`le-status-pill ${
                          prospect.status === "Active"
                            ? "active"
                            : prospect.status === "Dropped"
                            ? "dropped"
                            : prospect.status === "Wrong Contact"
                            ? "wrong"
                            : "unknown"
                        }`}
                      >
                        {prospect.status || "—"}
                      </span>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Phone</span>
                      <strong className="le-summaryValue">
                        {prospect.phoneNumber ? `+63 ${prospect.phoneNumber}` : "—"}
                      </strong>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Phone No. Ver.</span>
                      <strong className="le-summaryValue">{prospect.contactInfoVersion ?? 1}</strong>
                    </div>

                    <div className="le-summaryItem le-span2">
                      <span className="le-summaryLabel">Email</span>
                      <strong className="le-summaryValue">
                        {String(prospect.email || "").trim() ? prospect.email : "—"}
                      </strong>
                    </div>
                  </div>
                </section>

                {/* Lead Summary */}
                <section className="le-summaryCard">
                  <h3 className="le-summaryTitle">Lead Details</h3>

                  <div className="le-summaryGrid">
                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Lead Code</span>
                      <strong className="le-summaryValue">{leadCode}</strong>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Lead Source</span>
                      <strong className="le-summaryValue">{lead.source || "—"}</strong>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Status</span>
                      <span
                        className={`le-status-pill ${
                          lead.status === "New"
                            ? "new"
                            : lead.status === "In Progress"
                            ? "inprogress"
                            : lead.status === "Closed"
                            ? "closed"
                            : lead.status === "Dropped"
                            ? "dropped"
                            : "unknown"
                        }`}
                      >
                        {lead.status || "—"}
                      </span>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Date Created</span>
                      <strong className="le-summaryValue">{formatDateTime(lead.createdAt)}</strong>
                    </div>

                    <div className="le-summaryItem le-span2">
                      <span className="le-summaryLabel">Description</span>
                      <strong className="le-summaryValue">{lead.description || "—"}</strong>
                    </div>
                  </div>
                </section>
              </div>

              {/* Pipeline */}
              <div className="le-pipeline">
                {PIPELINE_STEPS.map((step, i) => {
                  const isActive = safeIndex === i;
                  const isDone = safeIndex > i;

                  return (
                    <div key={step} className="le-pipelineGroup">
                      <div className={`le-pipelineStep ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
                        <div className="le-stepCircle">{i + 1}</div>
                        <span className="le-stepText">{step}</span>
                      </div>

                      {i !== PIPELINE_STEPS.length - 1 && (
                        <div
                          className={`le-pipelineArrow ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}
                          aria-hidden="true"
                        >
                          <FaChevronRight />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Main + Sidebar */}
              <div className="le-mainRow">
                <section className="le-card">
                  <div className="le-cardHeader">
                    <h2 className="le-cardTitle">{mainTitle}</h2>
                    <span className="le-badge">{currentActivityLabel}</span>
                  </div>

                  {/* Tracker */}
                  {showContactingTracker && (
                    <div className="le-activityTracker">
                      {CONTACTING_STEPS_UI.map((s, idx) => {
                        const isActive = normalizedActivityIndex === idx;
                        return (
                          <span key={s.key} className={isActive ? "active" : ""}>
                            {s.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Contact Attempts block */}
                  <div className="le-block">
                    <div className="le-blockHeader">
                      <h4 className="le-blockTitle">
                        {attempts.length > 0 ? "Contact Attempts" : "Add a Contact Attempt"}
                      </h4>

                      {!showAddAttempt ? (
                        <button
                          type="button"
                          className="le-btn secondary"
                          onClick={onOpenAddAttempt}
                          disabled={addingAttempt || !canAddAttempt}
                          title={addAttemptDisabledReason || "Add Attempt"}
                        >
                          + Add Attempt
                        </button>
                      ) : null}
                    </div>

                    {showAddAttempt && (
                      <div className="le-inlineForm">
                        {attemptErrors._global ? (
                          <div className="le-formError" style={{ color: "#DA291C", marginBottom: 10 }}>
                            {attemptErrors._global}
                          </div>
                        ) : null}

                        <div className="le-formRow">
                          <label className="le-label">Attempt No.</label>
                          <input className="le-input" value={`#${nextAttemptNo}`} disabled />
                        </div>

                        <div className="le-formRow">
                          <label className="le-label">Primary Channel *</label>
                          <select
                            className={`le-input ${attemptErrors.primaryChannel ? "error" : ""}`}
                            value={attemptForm.primaryChannel}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAttemptForm((f) => ({
                                ...f,
                                primaryChannel: v,
                                otherChannels: (f.otherChannels || []).filter((x) => x !== v),
                              }));
                              setAttemptErrors((er) => ({ ...er, primaryChannel: undefined, otherChannels: undefined }));
                            }}
                            disabled={addingAttempt}
                          >
                            <option value="">Select</option>
                            {CHANNELS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        {attemptErrors.primaryChannel ? (
                          <div className="le-smallNote" style={{ color: "#DA291C" }}>
                            {attemptErrors.primaryChannel}
                          </div>
                        ) : null}

                        <div className="le-formRow" style={{ alignItems: "flex-start" }}>
                          <label className="le-label">Other Channels</label>
                          <div className="le-checkboxGrid">
                            {CHANNELS.filter((c) => c !== attemptForm.primaryChannel).map((c) => (
                              <label key={c} className="le-check">
                                <input
                                  type="checkbox"
                                  checked={(attemptForm.otherChannels || []).includes(c)}
                                  onChange={() => toggleOtherChannel(c)}
                                  disabled={addingAttempt}
                                />
                                <span>{c}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        {attemptErrors.otherChannels ? (
                          <div className="le-smallNote" style={{ color: "#DA291C" }}>
                            {attemptErrors.otherChannels}
                          </div>
                        ) : null}

                        <div className="le-formRow">
                          <label className="le-label">Attempted At</label>
                          <input className="le-input" value={attemptForm.attemptedAtLabel || "—"} disabled />
                        </div>

                        <div className="le-formRow">
                          <label className="le-label">Response *</label>
                          <select
                            className={`le-input ${attemptErrors.response ? "error" : ""}`}
                            value={attemptForm.response}
                            onChange={(e) => {
                              setAttemptForm((f) => ({ ...f, response: e.target.value }));
                              setAttemptErrors((er) => ({ ...er, response: undefined }));
                            }}
                            disabled={addingAttempt}
                          >
                            <option value="">Select</option>
                            {RESPONSES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        {attemptErrors.response ? (
                          <div className="le-smallNote" style={{ color: "#DA291C" }}>
                            {attemptErrors.response}
                          </div>
                        ) : null}

                        <div className="le-formRow" style={{ alignItems: "flex-start" }}>
                          <label className="le-label">Notes</label>
                          <textarea
                            className="le-input"
                            value={attemptForm.notes}
                            onChange={(e) => setAttemptForm((f) => ({ ...f, notes: e.target.value }))}
                            rows={3}
                            disabled={addingAttempt}
                            placeholder="Optional notes..."
                          />
                        </div>

                        <div className="le-actions">
                          <button
                            type="button"
                            className="le-btn secondary"
                            onClick={onCancelAddAttempt}
                            disabled={addingAttempt}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="le-btn primary"
                            onClick={onSubmitAttempt}
                            disabled={addingAttempt}
                          >
                            {addingAttempt ? "Saving..." : "Save Attempt"}
                          </button>
                        </div>
                      </div>
                    )}

                    {showAddAttempt && attempts.length > 0 && (
                      <div className="le-dividerWrapper">
                        <div className="le-divider" />
                        <span className="le-dividerLabel">Previous Attempts</span>
                        <div className="le-divider" />
                      </div>
                    )}

                    <div className="le-attemptList">
                      {attempts.map((a) => (
                        <div key={a.attemptNo} className="le-attemptItem">
                          <div className="le-attemptTop">
                            <strong>Attempt #{a.attemptNo}</strong>
                            <span className="le-attemptDate">{formatDateTime(a.attemptedAt)}</span>
                          </div>

                          <div className="le-attemptMeta">
                            <div>
                              <span className="le-metaLabel">Primary Channel</span>
                              <span className="le-metaValue">{a.primaryChannel}</span>
                            </div>

                            <div>
                              <span className="le-metaLabel">Others</span>
                              <span className="le-metaValue">
                                {a.otherChannels?.length ? a.otherChannels.join(", ") : "—"}
                              </span>
                            </div>

                            <div>
                              <span className="le-metaLabel">Result</span>
                              <span className="le-metaValue">{a.response}</span>
                            </div>

                            <div>
                              <span className="le-metaLabel">Phone No. Ver. Used</span>
                              <span className="le-metaValue">{a.contactInfoVersionUsed ?? "—"}</span>
                            </div>
                          </div>

                          {String(a.notes || "").trim() ? (
                            <div className="le-attemptNotes">
                              <span className="le-metaLabel">Notes</span>
                              <div className="le-metaValue">{a.notes}</div>
                            </div>
                          ) : null}
                        </div>
                      ))}

                      {!showAddAttempt && attempts.length === 0 && (
                        <div className="le-muted" style={{ padding: "10px 0" }}>
                          No contact attempts yet.
                        </div>
                      )}
                    </div>

                    {!showAddAttempt && attempts.length === 0 && (
                      <p className="le-muted">Next Step: Create your first contact attempt to start engagement.</p>
                    )}
                  </div>

                  {/* ✅ Read-only validation indicator when blocked / wrong contact already confirmed */}
                  {isEngagementBlocked && (
                    <div className="le-block">
                      <h4 className="le-blockTitle">Validate Contact</h4>

                      <div className="le-formRow">
                        <label className="le-label">Phone Number Correct?</label>
                        <select className="le-input" value="WRONG_CONTACT" disabled>
                          <option value="WRONG_CONTACT">Wrong</option>
                        </select>
                      </div>

                      <p className="le-muted" style={{ marginTop: 8 }}>
                        Contact was marked wrong. Update phone number to continue.
                      </p>
                    </div>
                  )}

                  {/* Validate Contact */}
                  {showValidateContact && (
                    <div className="le-block">
                      <h4 className="le-blockTitle">Validate Contact</h4>

                      {validateError ? (
                        <div className="le-formError" style={{ color: "#DA291C", marginBottom: 10 }}>
                          {validateError}
                        </div>
                      ) : null}

                      <div className="le-formRow">
                        <label className="le-label">Phone Number Correct?</label>
                        <select
                          className="le-input"
                          value={validateForm.phoneValidation}
                          onChange={(e) => {
                            setValidateForm({ phoneValidation: e.target.value });
                            setValidateError("");
                          }}
                          disabled={validatingContact || uiLocked}
                        >
                          <option value="">Select</option>
                          <option value="CORRECT">Correct</option>
                          <option value="WRONG_CONTACT">Wrong</option>
                        </select>
                      </div>

                      <div className="le-actions">
                        <button
                          type="button"
                          className="le-btn secondary"
                          onClick={() => {
                            setValidateForm({ phoneValidation: "" });
                            setValidateError("");
                          }}
                          disabled={validatingContact || uiLocked}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="le-btn primary"
                          onClick={submitValidateContact}
                          disabled={validatingContact || uiLocked}
                        >
                          {validatingContact ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Sidebar: Tasks */}
                <aside className="le-sidebar">
                  <h4 className="le-sidebarTitle">Tasks</h4>

                  <div className="le-taskSection">
                    <div className="le-taskSectionHeader">
                      <h5 className="le-taskSectionTitle">Open</h5>
                      <span className="le-taskCount">{openTasks.length}</span>
                    </div>

                    {openTasks.length === 0 ? (
                      <div className="le-taskEmpty">No open tasks.</div>
                    ) : (
                      <div className="le-taskList">
                        {openTasks.map((t) => (
                          <TaskRow key={t._id} t={t} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="le-taskSection">
                    <div className="le-taskSectionHeader">
                      <h5 className="le-taskSectionTitle">Overdue</h5>
                      <span className="le-taskCount overdue">{overdueTasks.length}</span>
                    </div>

                    {overdueTasks.length === 0 ? (
                      <div className="le-taskEmpty">No overdue tasks.</div>
                    ) : (
                      <div className="le-taskList">
                        {overdueTasks.map((t) => (
                          <TaskRow key={t._id} t={t} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="le-taskSection">
                    <div className="le-taskSectionHeader">
                      <h5 className="le-taskSectionTitle">Done</h5>
                      <span className="le-taskCount done">{doneTasks.length}</span>
                    </div>

                    {doneTasks.length === 0 ? (
                      <div className="le-taskEmpty">No completed tasks.</div>
                    ) : (
                      <div className="le-taskList">
                        {doneTasks.map((t) => (
                          <TaskRow key={t._id} t={t} />
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              {/* Attempt Limit Modal */}
              {showAttemptLimitModal && (
                <div
                  className="le-modalOverlay"
                  onClick={() => setShowAttemptLimitModal(false)}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="le-modalCard" onClick={(e) => e.stopPropagation()}>
                    <h3 className="le-modalTitle">10 attempts reached</h3>
                    <p className="le-modalText">
                      You already have <strong>{attempts.length}</strong> contact attempts for this lead.
                      <br />
                      Do you want to continue attempting, or drop this lead for unresponsiveness?
                    </p>

                    <div className="le-modalActions">
                      <button
                        type="button"
                        className="le-btn secondary"
                        onClick={() => setShowAttemptLimitModal(false)}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="le-btn secondary"
                        onClick={() => {
                          setShowAttemptLimitModal(false);
                          setShowAddAttempt(true);
                          resetAttemptForm();
                        }}
                      >
                        Continue Attempting
                      </button>

                      <button
                        type="button"
                        className="le-btn primary"
                        onClick={() => {
                          setShowAttemptLimitModal(false);
                          alert("TODO: Drop lead action (backend route not yet wired).");
                        }}
                      >
                        Drop Lead
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ✅ NEW: Blocked Modal (Wrong Contact confirmed) */}
              {showBlockedModal && (
                <div
                  className="le-modalOverlay"
                  onClick={() => setShowBlockedModal(false)}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="le-modalCard" onClick={(e) => e.stopPropagation()}>
                    <h3 className="le-modalTitle">Update required</h3>
                    <p className="le-modalText">Phone number marked invalid. Update required to continue.</p>

                    <div className="le-modalActions">
                      <button
                        type="button"
                        className="le-btn primary"
                        onClick={() => {
                          navigate(`/agent/${username}/prospects/${prospectId}`);
                        }}
                      >
                        Go to Prospect Details
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default AgentLeadEngagement;