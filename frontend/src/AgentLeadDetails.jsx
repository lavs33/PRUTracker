import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentLeadDetails.css";

function AgentLeadDetails() {
  const navigate = useNavigate();
  const { username, prospectId, leadId } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [isReady, setIsReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [prospectName, setProspectName] = useState("—");
  const [prospectSourceType, setProspectSourceType] = useState(""); 
  const [lead, setLead] = useState(null);
  const [leadEngagement, setLeadEngagement] = useState(null);
  const [policy, setPolicy] = useState(null);

  const DROP_REASONS = [
    "Interest / Engagement",
    "Eligibility / Fit",
    "Data / System",
    "Compliance / Risk",
    "Life Event",
    "Other",
  ];

  const [dropBusy, setDropBusy] = useState(false);
  const [dropModal, setDropModal] = useState({
    open: false,
    type: "", // "confirm" | "blocked" | "reopen"
    title: "",
    message: "",
  });

  const [dropDraft, setDropDraft] = useState({ dropReason: "", dropNotes: "" });
  const [dropErrors, setDropErrors] = useState({});

  const openDropModal = (payload) => {
    setDropModal((prev) => ({
      ...prev,
      open: true,
      ...payload,
    }));
  };

  const closeDropModal = () => {
    setDropModal({ open: false, type: "", title: "", message: "" });
    setDropDraft({ dropReason: "", dropNotes: "" });
    setDropErrors({});
    setDropBusy(false);
  };

  // NO "System" in dropdown
  const SOURCES = [
    "Family",
    "Friend",
    "Acquaintance",
    "Webinars",
    "Seminars/Conferences",
    "Other",
  ];

  const [isEditing, setIsEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const [editDraft, setEditDraft] = useState({
    source: "",
    otherSource: "",
    description: "",
  });

  const [editErrors, setEditErrors] = useState({});

  // GUARD
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
    if (user) document.title = `${user.username} | Lead Details`;
  }, [user]);

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

  const formatDateShort = (d) => {
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


  // reusable fetch
  const fetchLeadDetails = useCallback(
    async (signal) => {
      if (!user?.id) {
        setApiError("Missing user id. Please log in again.");
        setLead(null);
        setLeadEngagement(null);
        setPolicy(null);
        return;
      }

      if (!prospectId || !leadId) {
        setApiError("Missing prospectId or leadId.");
        setLead(null);
        setLeadEngagement(null);
        setPolicy(null);
        return;
      }

      const fetchOpts = signal ? { signal } : undefined;

      const res = await fetch(
        `http://localhost:5000/api/prospects/${prospectId}/leads/${leadId}/details?userId=${user.id}`,
        fetchOpts
      );

      const data = await res.json();

      if (!res.ok) {
        setApiError(data.message || "Failed to fetch lead details.");
        setLead(null);
        setPolicy(null);
        return;
      }

      setProspectName(data?.prospect?.fullName || "—");
      setProspectSourceType(data?.prospect?.source || ""); 

      setLead({
        ...(data?.lead || {}),
        leadNo: data?.leadMeta?.leadNo,
      });

      setLeadEngagement(data?.leadEngagement || null);
      setPolicy(data?.policy || null);
    },
    [prospectId, leadId, user?.id]
  );

  // initial fetch
  useEffect(() => {
    if (!isReady) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchLeadDetails(controller.signal);
      } catch (err) {
        if (err.name !== "AbortError") {
          setApiError("Cannot connect to server. Is backend running?");
          setLead(null);
          setLeadEngagement(null);
          setPolicy(null);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, fetchLeadDetails]);

  const isDropped = String(lead?.status || "") === "Dropped";
  const isClosed = String(lead?.status || "") === "Closed";
  const isSystemAssigned = String(prospectSourceType || "") === "System-Assigned";

  const displaySource = useMemo(() => {
    if (!lead) return "—";
    if (lead.source === "Other") return `Other: ${lead.otherSource || "—"}`;
    return lead.source || "—";
  }, [lead]);

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

    case "tasks_progress":
        navigate(`/agent/${user.username}/tasks/progress`);
        break;
      case "tasks_all":
      navigate(`/agent/${user.username}/tasks/all`);
      break;

    // SALES
    case "sales_performance":
        navigate(`/agent/${user.username}/sales/performance`);
        break;
      case "sales":
      alert("Sales module coming soon");
      break;

    default:
      break;
  }
};

  const goBackToProspectDetails = () => {
    navigate(`/agent/${user.username}/prospects/${prospectId}`);
  };

  const startEngaging = () => {
    // IMPORTANT: still allowed even if Dropped (view only)
    navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${leadId}/engage`);
  };

  const goToPolicyDetails = (policyId) => {
    navigate(`/agent/${user.username}/prospects/${prospectId}/policies/${policyId}`);
  };

  const startEdit = () => {
    if (!lead) return;

    // Dropped: do NOT disable button; show blocked modal
    if (isDropped) {
      openDropModal({
        type: "blocked",
        title: "Cannot Edit Lead",
        message: "This lead is Dropped and cannot be edited. Please re-open lead for editing.",
      });
      return;
    }

    setEditErrors({});
    setIsEditing(true);
    setEditDraft({
      source: lead.source || "",
      otherSource: lead.otherSource || "",
      description: lead.description || "",
    });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditBusy(false);
    setEditErrors({});
    setEditDraft({ source: "", otherSource: "", description: "" });
  };

  const validateEdit = () => {
    const next = {};

    // If System-Assigned: source is locked, only description edit allowed
    if (isSystemAssigned) return next;

    const s = String(editDraft.source || "").trim();
    if (!s || !SOURCES.includes(s)) next.source = "Please select a valid lead source.";

    if (s === "Other" && !String(editDraft.otherSource || "").trim()) {
      next.otherSource = "Other source is required when source is Other.";
    }

    return next;
  };

  const attemptSaveEdit = async () => {
    const nextErr = validateEdit();
    setEditErrors(nextErr);
    if (Object.keys(nextErr).length > 0) return;

    try {
      setEditBusy(true);

      // Build payload depending on prospect type
      const payload = {
        description: String(editDraft.description || "").trim(),
      };

      // only include source fields if Agent-Sourced
      if (!isSystemAssigned) {
        payload.source = String(editDraft.source || "").trim();
        payload.otherSource = String(editDraft.otherSource || "").trim();
      }

      const res = await fetch(
        `http://localhost:5000/api/prospects/${prospectId}/leads/${leadId}?userId=${user.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        openDropModal({
          type: "blocked",
          title: "Edit Failed",
          message: data.message || "Failed to update lead.",
        });
        return;
      }

      setIsEditing(false);
      await fetchLeadDetails();
    } catch (err) {
      openDropModal({
        type: "blocked",
        title: "Connection Error",
        message: "Cannot connect to server. Is backend running?",
      });
    } finally {
      setEditBusy(false);
    }
  };

  // DROP / REOPEN
  const onDropClick = () => {
    if (isClosed) {
      openDropModal({
        type: "blocked",
        title: "Cannot Drop Lead",
        message:
          "This lead is already Closed. Closed leads cannot be dropped because the sale was successful.",
      });
      return;
    }

    openDropModal({
      type: "confirm",
      title: "Drop Lead?",
      message:
        "Dropping will mark this lead as Dropped. This action is used when the lead can no longer proceed. Do you want to continue?",
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
      setDropBusy(true);

      const res = await fetch(
        `http://localhost:5000/api/prospects/${prospectId}/leads/${leadId}?userId=${user.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Dropped",
            dropReason: String(dropDraft.dropReason || "").trim(),
            dropNotes: String(dropDraft.dropNotes || "").trim(),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        openDropModal({
          type: "blocked",
          title: "Drop Failed",
          message: data.message || "Failed to drop lead.",
        });
        return;
      }

      closeDropModal();
      await fetchLeadDetails(); // refresh UI
    } catch (err) {
      openDropModal({
        type: "blocked",
        title: "Connection Error",
        message: "Cannot connect to server. Is backend running?",
      });
    } finally {
      setDropBusy(false);
    }
  };

  const attemptReopen = async () => {
    try {
      setDropBusy(true);

      const res = await fetch(
        `http://localhost:5000/api/prospects/${prospectId}/leads/${leadId}?userId=${user.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Reopen", // command only
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        openDropModal({
          type: "blocked",
          title: "Re-open Failed",
          message: data.message || "Failed to re-open lead.",
        });
        return;
      }

      closeDropModal();
      await fetchLeadDetails();
    } catch (err) {
      openDropModal({
        type: "blocked",
        title: "Connection Error",
        message: "Cannot connect to server. Is backend running?",
      });
    } finally {
      setDropBusy(false);
    }
  };

  if (!isReady) return null;

  // Loading
  if (loading) {
    return (
      <div className="ld-shell">
        <TopNav
          user={user}
          onLogoClick={() => navigate(`/agent/${user.username}`)}
          onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
          onLogout={() => logout(navigate)}
          onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
        />
        <div className="ld-body">
          <SideNav onNavigate={handleSideNav} />
          <main className="ld-content">
            <p className="ld-small-note">Loading lead details...</p>
          </main>
        </div>
      </div>
    );
  }

  // Error
  if (apiError || !lead) {
    return (
      <div className="ld-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />
        <div className="ld-body">
          <SideNav onNavigate={handleSideNav} />
          <main className="ld-content">
            <p className="ld-small-note" style={{ color: "#DA291C" }}>
              {apiError || "Lead not found."}
            </p>
            <button type="button" className="ld-crumbLink" onClick={goBackToProspectDetails}>
              ← Back to Prospect
            </button>
          </main>
        </div>
      </div>
    );
  }

  const showOtherInline = isEditing && !isSystemAssigned && String(editDraft.source || "") === "Other";

  return (
    <div className="ld-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="ld-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="ld-content">
          <div className="ld-breadcrumb">
            <button
              type="button"
              className="ld-crumbLink"
              onClick={() => navigate(`/agent/${user.username}/prospects`)}
            >
              Prospects
            </button>
            <span className="ld-crumbSep">›</span>
            <button type="button" className="ld-crumbLink" onClick={goBackToProspectDetails}>
              {prospectName}
            </button>
            <span className="ld-crumbSep">›</span>
            <span className="ld-crumbCurrent">{lead?.leadCode || "Lead Details"}</span>
          </div>

          <div className="ld-card">
            <div className="ld-topRow">
              <div className="ld-mainInfo">
                <h1 className="ld-name">{lead.leadCode || "—"}</h1>

                <div className="ld-subline">
                  <span className="ld-code">
                    Agent&apos;s Lead No. {String(lead.leadNo ?? 0).padStart(2, "0")}
                  </span>
                  <span className="ld-dot">•</span>
                  <span className="ld-subtext">{prospectName}</span>
                </div>

                <div className="ld-detailsGrid">
                  <div className="ld-detailItem">
                    <span className="ld-detailLabel">Lead Source</span>

                    {!isEditing ? (
                      <span className="ld-detailValue">{displaySource}</span>
                    ) : isSystemAssigned ? (
                      <span className="ld-detailValue">System</span>
                    ) : (
                      <div style={{ width: "100%" }}>
                        <select
                          className={`ld-input ${editErrors.source ? "error" : ""}`}
                          value={editDraft.source}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditDraft((d) => ({
                              ...d,
                              source: v,
                              otherSource: v === "Other" ? d.otherSource : "",
                            }));
                            setEditErrors((er) => ({ ...er, source: undefined }));
                            if (v !== "Other") {
                              setEditErrors((er) => ({ ...er, otherSource: undefined }));
                            }
                          }}
                          disabled={editBusy}
                        >
                          <option value="">Select</option>
                          {SOURCES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {editErrors.source && <p className="ld-error">{editErrors.source}</p>}
                      </div>
                    )}
                  </div>

                  {showOtherInline && (
                    <div className="ld-detailItem">
                      <span className="ld-detailLabel">Other Source *</span>
                      <div style={{ width: "100%" }}>
                        <input
                          className={`ld-input ${editErrors.otherSource ? "error" : ""}`}
                          value={editDraft.otherSource}
                          onChange={(e) => {
                            setEditDraft((d) => ({ ...d, otherSource: e.target.value }));
                            setEditErrors((er) => ({ ...er, otherSource: undefined }));
                          }}
                          disabled={editBusy}
                          placeholder="Specify other source..."
                        />
                        {editErrors.otherSource && (
                          <p className="ld-error">{editErrors.otherSource}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="ld-detailItem">
                    <span className="ld-detailLabel">Lead Status</span>
                    <span className="ld-status-pill">{lead.status || "—"}</span>
                  </div>

                  <div className="ld-detailItem ld-detailItem-wide">
                    <span className="ld-detailLabel">Lead Description</span>
                    {!isEditing ? (
                      <span className="ld-detailValue">{lead.description?.trim() ? lead.description : "—"}</span>
                    ) : (
                      <textarea
                        className="ld-input"
                        value={editDraft.description}
                        onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                        rows={3}
                        placeholder="Add notes about this lead..."
                        style={{ resize: "vertical" }}
                        disabled={editBusy}
                      />
                    )}
                  </div>

                  <div className="ld-detailItem">
                    <span className="ld-detailLabel">Date Created</span>
                    <span className="ld-detailValue">{formatDateTime(lead.createdAt)}</span>
                  </div>

                  <div className="ld-detailItem">
                    <span className="ld-detailLabel">Last Updated</span>
                    <span className="ld-detailValue">{formatDateTime(lead.updatedAt)}</span>
                  </div>

                  {isDropped && (
                    <div className="ld-dropGrid">
                      <div className="ld-detailItem">
                        <span className="ld-detailLabel">Drop Reason</span>
                        <span className="ld-detailValue">{lead.dropReason || "—"}</span>
                      </div>

                      <div className="ld-detailItem">
                        <span className="ld-detailLabel">Drop Notes</span>
                        <span className="ld-detailValue">{lead.dropNotes || "—"}</span>
                      </div>

                      <div className="ld-detailItem">
                        <span className="ld-detailLabel">Dropped At</span>
                        <span className="ld-detailValue">{formatDateTime(lead.droppedAt)}</span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="ld-right">
                <div className="ld-actionsRow">
                  {/* LEFT: Edit OR Cancel/Save */}
                  {!isEditing ? (
                    <button
                      type="button"
                      className="ld-iconBtn"
                      title="Edit"
                      disabled={editBusy || dropBusy}
                      onClick={startEdit}
                    >
                      ✎
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ld-btn secondary"
                        onClick={cancelEdit}
                        disabled={editBusy}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="ld-btn primary"
                        onClick={attemptSaveEdit}
                        disabled={editBusy}
                        title="Save changes"
                      >
                        {editBusy ? "Saving..." : "Save Changes"}
                      </button>
                    </>
                  )}

                  {/* RIGHT: Drop/Re-open ONLY when NOT editing */}
                  {!isEditing && (
                    <>
                      {!isDropped ? (
                        <button
                          type="button"
                          className="ld-iconBtn danger"
                          title={isClosed ? "Closed leads cannot be dropped" : "Drop Lead"}
                          onClick={onDropClick}
                          disabled={dropBusy}
                        >
                          ⛔
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ld-btn primary"
                          onClick={() =>
                            openDropModal({
                              type: "reopen",
                              title: "Re-open Lead?",
                              message:
                                "This will re-open the lead and return it to its previous status. Do you want to continue?",
                            })
                          }
                          disabled={dropBusy}
                          title="Re-open Lead"
                        >
                          Re-open Lead
                        </button>
                      )}
                    </>
                  )}
                </div>

                {isDropped && (
                  <p className="ld-small-note muted">
                    This lead is Dropped and cannot be edited, but Lead Engagement is still viewable.
                  </p>
                )}
              </div>
            </div>

            <div className="ld-records">
              <div className="ld-recordsHeader">
                <h2 className="ld-recordsTitle">Lead Engagement</h2>
              </div>

              <div className="ld-recordsBody">
                <button
                  type="button"
                  className="ld-policyCard"
                  onClick={startEngaging}
                  title="Open Lead Engagement"
                >
                  <div className="ld-policyTop">
                    <div className="ld-policyCode">Lead Engagement for {lead.leadCode || "—"}</div>
                    <div className="ld-policyDate">{formatDateShort(leadEngagement?.updatedAt)}</div>
                  </div>

                  {lead.status !== "Closed" && (
                    <div className="ld-policyBottom">
                      <div className="ld-policyStatusRow">
                        <span className="ld-policyStatusLabel">Current Stage</span>
                        <span className="ld-policyStatusPill">{leadEngagement?.currentStage || "Not Started"}</span>
                      </div>
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="ld-records">
              <div className="ld-recordsHeader">
                <h2 className="ld-recordsTitle">Policy Attached</h2>
              </div>

              <div className="ld-recordsBody">
                {policy ? (
                  <button
                    type="button"
                    className="ld-policyCard"
                    onClick={() => goToPolicyDetails(policy._id)}
                    title="View Policy Details"
                  >
                    <div className="ld-policyTop">
                      <div className="ld-policyCode">{policy.policyholderCode || "—"}</div>
                      <div className="ld-policyDate">{formatDateShort(policy.createdAt)}</div>
                    </div>

                    <div className="ld-policyBottom">
                      <div className="ld-policyStatusRow">
                        <span className="ld-policyStatusLabel">Status</span>
                        <span className="ld-policyStatusPill">{policy.status || "—"}</span>
                      </div>
                    </div>
                  </button>
                ) : (
                  <p className="ld-descText">No policy attached yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* =========================
              DROP / REOPEN MODAL
             ========================= */}
          {dropModal.open && (
            <div className="ld-modalOverlay" role="dialog" aria-modal="true">
              <div className="ld-modal">
                <button
                  type="button"
                  className="ld-modalClose"
                  onClick={closeDropModal}
                  aria-label="Close"
                  title="Close"
                  disabled={dropBusy}
                >
                  ×
                </button>

                <h3 className="ld-modalTitle">{dropModal.title}</h3>
                <p className="ld-modalText">{dropModal.message}</p>

                {dropModal.type === "blocked" && (
                  <div className="ld-modalActions">
                    <button type="button" className="ld-btn primary" onClick={closeDropModal}>
                      OK
                    </button>
                  </div>
                )}

                {dropModal.type === "confirm" && (
                  <>
                    <div className="ld-modalBox">
                      <div className="ld-field" style={{ marginBottom: 10 }}>
                        <label className="ld-label">Reason for Dropping *</label>
                        <select
                          className={`ld-input ${dropErrors.dropReason ? "error" : ""}`}
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
                        {dropErrors.dropReason && <p className="ld-error">{dropErrors.dropReason}</p>}
                      </div>

                      <div className="ld-field">
                        <label className="ld-label">Drop Notes *</label>
                        <textarea
                          className={`ld-input ${dropErrors.dropNotes ? "error" : ""}`}
                          value={dropDraft.dropNotes}
                          onChange={(e) => {
                            setDropDraft((d) => ({ ...d, dropNotes: e.target.value }));
                            setDropErrors((er) => ({ ...er, dropNotes: undefined }));
                          }}
                          rows={4}
                          placeholder="Please explain briefly why this lead is being dropped..."
                          style={{ resize: "vertical" }}
                        />
                        {dropErrors.dropNotes && <p className="ld-error">{dropErrors.dropNotes}</p>}
                      </div>
                    </div>

                    <div className="ld-modalActions">
                      <button
                        type="button"
                        className="ld-btn secondary"
                        onClick={closeDropModal}
                        disabled={dropBusy}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="ld-btn primary"
                        onClick={attemptDrop}
                        disabled={dropBusy}
                        title="Mark lead as Dropped"
                      >
                        {dropBusy ? "Dropping..." : "Drop Lead"}
                      </button>
                    </div>
                  </>
                )}

                {dropModal.type === "reopen" && (
                  <div className="ld-modalActions">
                    <button
                      type="button"
                      className="ld-btn secondary"
                      onClick={closeDropModal}
                      disabled={dropBusy}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="ld-btn primary"
                      onClick={attemptReopen}
                      disabled={dropBusy}
                      title="Re-open this lead"
                    >
                      {dropBusy ? "Re-opening..." : "Re-open"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AgentLeadDetails;
