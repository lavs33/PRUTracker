import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentAddLead.css";

const UI_ONLY = false;

function AgentAddLead() {
  const navigate = useNavigate();
  const { username, prospectId } = useParams();

  // read user once
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [isReady, setIsReady] = useState(false);

  // init data
  const [loading, setLoading] = useState(true);
  const [prospect, setProspect] = useState(null);
  const [leadMeta, setLeadMeta] = useState(null);

  // dropped prospect guard
  const [isProspectDropped, setIsProspectDropped] = useState(false);

  // block lead creation if active lead exists
  const [hasActiveLead, setHasActiveLead] = useState(false);
  const [activeLead, setActiveLead] = useState(null); // { _id, leadCode, status }

  // form
  const [source, setSource] = useState("");
  const [otherSource, setOtherSource] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // success modal
  const [successModal, setSuccessModal] = useState({
    open: false,
    leadId: "",
    leadCode: "",
    leadSource: "",
    leadStatus: "New",
    prospectName: "",
  });

  // error modal
  const [errorModal, setErrorModal] = useState({
    open: false,
    title: "",
    message: "",
    action: null,
  });
  const openErrorModal = (title, message, action = null) =>
    setErrorModal({ open: true, title, message, action });
  const closeErrorModal = () =>
    setErrorModal({ open: false, title: "", message: "", action: null });

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
    if (user) document.title = `${user.username} | Add Lead`;
  }, [user]);

  /**
   * Init:
   * GET /api/leads/init?userId=...&prospectId=...
   */
  useEffect(() => {
    if (!isReady) return;

    // reset init-related state when prospectId changes
    setProspect(null);
    setLeadMeta(null);
    setIsProspectDropped(false);
    setHasActiveLead(false);
    setActiveLead(null);
    setErrors({});
    setDescription("");

    // UI ONLY
    if (UI_ONLY) {
      const dummyProspect = {
        _id: prospectId,
        fullName: "Juan Dela Cruz",
        source: "Agent-Sourced",
        prospectCode: "PR-0004",
        status: "Dropped",
      };

      const dummyLeadMeta = { leadNo: 9 };
      const dummyHasActiveLead = true;
      const dummyActiveLead = { _id: "lead123", leadCode: "L-000022", status: "In Progress" };

      setProspect(dummyProspect);
      setLeadMeta(dummyLeadMeta);

      const dropped = String(dummyProspect.status || "") === "Dropped";
      setIsProspectDropped(dropped);

      setHasActiveLead(dummyHasActiveLead);
      setActiveLead(dummyHasActiveLead ? dummyActiveLead : null);

      if (dummyProspect.source === "System-Assigned") {
        setSource("System");
        setOtherSource("");
      } else {
        setSource("");
        setOtherSource("");
      }

      setLoading(false);

      // dropped takes priority
      if (dropped) {
        openErrorModal("Lead Creation Blocked", "This prospect is Dropped. You cannot create a new lead.", {
          label: "Back to Prospect",
          onClick: () => navigate(`/agent/${user.username}/prospects/${prospectId}`),
        });
        return;
      }

      if (dummyHasActiveLead) {
        openErrorModal(
          "Lead Creation Blocked",
          `This prospect already has an active lead (${dummyActiveLead.leadCode}, ${dummyActiveLead.status}).`,
          {
            label: "Go to Active Lead",
            onClick: () =>
              navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${dummyActiveLead._id}`),
          }
        );
      }

      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);

        if (!user?.id) {
          openErrorModal("Session Error", "Missing user id. Please log in again.");
          return;
        }

        const res = await fetch(
          `http://localhost:5000/api/leads/init?userId=${user.id}&prospectId=${prospectId}`,
          { signal: controller.signal }
        );

        const data = await res.json().catch(() => ({}));

        // ALIGNMENT: handle dropped block (409) coming from init
        if (!res.ok) {
          if (res.status === 409 && data?.blockReason === "PROSPECT_DROPPED") {
            const p = data?.prospect || null;

            setProspect(p);
            setLeadMeta(data?.leadMeta || null);

            setIsProspectDropped(true);
            setHasActiveLead(false);
            setActiveLead(null);

            // set defaults for form even if blocked
            if (p?.source === "System-Assigned") {
              setSource("System");
              setOtherSource("");
            } else {
              setSource("");
              setOtherSource("");
            }

            openErrorModal(
              "Lead Creation Blocked",
              data?.message || "This prospect is Dropped. You cannot create a new lead.",
              {
                label: "Back to Prospect",
                onClick: () => navigate(`/agent/${user.username}/prospects/${prospectId}`),
              }
            );
            return;
          }

          openErrorModal("Init Failed", data?.message || "Failed to initialize Add Lead page.");
          return;
        }

        const p = data.prospect || null;
        const meta = data.leadMeta || null;

        setProspect(p);
        setLeadMeta(meta);

        // dropped (should be false on 200, but keep safe)
        const dropped = String(p?.status || "") === "Dropped";
        setIsProspectDropped(dropped);

        // active lead info
        const blocked = !!data.hasActiveLead;
        const act = data.activeLead || null;
        setHasActiveLead(blocked);
        setActiveLead(act);

        if (p?.source === "System-Assigned") {
          setSource("System");
          setOtherSource("");
        } else {
          setSource("");
          setOtherSource("");
        }

        // If blocked, show modal immediately
        // (dropped should not happen here normally, but keep priority safe)
        if (dropped) {
          openErrorModal(
            "Lead Creation Blocked",
            "This prospect is Dropped. You cannot create a new lead.",
            {
              label: "Back to Prospect",
              onClick: () => navigate(`/agent/${user.username}/prospects/${prospectId}`),
            }
          );
          return;
        }

        if (blocked && act?._id) {
          openErrorModal(
            "Lead Creation Blocked",
            `This prospect already has an active lead (${act.leadCode}, ${act.status}).`,
            {
              label: "Go to Active Lead",
              onClick: () =>
                navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${act._id}`),
            }
          );
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          openErrorModal("Connection Error", "Cannot connect to server. Is backend running?");
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, prospectId, user?.id, navigate, user?.username]);

  const handleSideNav = (key) => {
    if (!user) return navigate("/");

    switch (key) {
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
      case "tasks":
        navigate(`/agent/${user.username}/tasks`);
        break;

      case "tasks_progress":
          navigate(`/agent/${user.username}/tasks/progress`);
          break;

      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;
      case "sales": navigate(`/agent/${user.username}/sales/performance`); break;
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;
      default:
        break;
    }
  };

  const prospectName = prospect?.fullName || "—";
  const isSystemAssigned = prospect?.source === "System-Assigned";

  const validate = () => {
    const next = {};
    if (!String(source || "").trim()) next.source = "Lead source is required.";

    if (source === "Other" && !String(otherSource || "").trim()) {
      next.otherSource = "Please specify the other source.";
    }
    return next;
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // block submit if Dropped
    if (isProspectDropped) {
      openErrorModal("Lead Creation Blocked", "This prospect is Dropped. You cannot create a new lead.", {
        label: "Back to Prospect",
        onClick: () => navigate(`/agent/${user.username}/prospects/${prospectId}`),
      });
      return;
    }

    // block submit if active lead exists
    if (hasActiveLead) {
      openErrorModal(
        "Lead Creation Blocked",
        activeLead?.leadCode
          ? `This prospect already has an active lead (${activeLead.leadCode}, ${activeLead.status}).`
          : "This prospect already has an active lead.",
        activeLead?._id
          ? {
              label: "Go to Active Lead",
              onClick: () =>
                navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${activeLead._id}`),
            }
          : null
      );
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (UI_ONLY) return;

    try {
      setSubmitting(true);

      const payload = {
        prospectId,
        source: isSystemAssigned ? "System" : source,
        otherSource: source === "Other" ? String(otherSource || "").trim() : "",
        description: String(description || "").trim(),
      };

      const res = await fetch(`http://localhost:5000/api/leads?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // active lead block (409)
        if (res.status === 409 && data?.activeLead?._id) {
          openErrorModal("Lead Creation Blocked", data.message || "Active lead exists.", {
            label: "Go to Active Lead",
            onClick: () =>
              navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${data.activeLead._id}`),
          });
          setHasActiveLead(true);
          setActiveLead(data.activeLead);
          return;
        }

        // dropped block (409) from POST
        if (res.status === 409 && data?.blockReason === "PROSPECT_DROPPED") {
          setIsProspectDropped(true);
          openErrorModal(
            "Lead Creation Blocked",
            data.message || "This prospect is Dropped. You cannot create a new lead.",
            {
              label: "Back to Prospect",
              onClick: () => navigate(`/agent/${user.username}/prospects/${prospectId}`),
            }
          );
          return;
        }

        openErrorModal("Create Lead Failed", data.message || "Failed to create lead.");
        return;
      }

      const created = data.lead;

      setSuccessModal({
        open: true,
        leadId: created?._id || "",
        leadCode: created?.leadCode || "—",
        leadSource:
          created?.source === "Other"
            ? `Other: ${created?.otherSource || ""}`.trim()
            : created?.source || payload.source,
        leadStatus: created?.status || "New",
        prospectName,
      });
    } catch (err) {
      openErrorModal("Connection Error", "Cannot connect to server. Is backend running?");
    } finally {
      setSubmitting(false);
    }
  };

  const closeSuccess = () => {
    setSuccessModal((s) => ({ ...s, open: false }));
    navigate(`/agent/${user.username}/prospects/${prospectId}`);
  };

  const startEngaging = () => {
    closeSuccess();
    navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${successModal.leadId}/engage`);
  };

  const goBackToProspect = () => {
    navigate(`/agent/${user.username}/prospects/${prospectId}`);
  };

  if (!isReady) return null;

  if (loading) {
    return (
      <div className="al-shell">
        <TopNav
          user={user}
          onLogoClick={() => navigate(`/agent/${user.username}`)}
          onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
          onLogout={() => logout(navigate)}
          onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
        />

        <div className="al-body">
          <SideNav onNavigate={handleSideNav} />
          <main className="al-content">
            <p className="al-small-note">Loading Add Lead...</p>
          </main>
        </div>
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="al-shell">
        <TopNav
          user={user}
          onLogoClick={() => navigate(`/agent/${user.username}`)}
          onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
          onLogout={() => logout(navigate)}
          onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
        />
        <div className="al-body">
          <SideNav onNavigate={handleSideNav} />
          <main className="al-content">
            <p className="al-error">Prospect not found.</p>
            <button type="button" className="al-btn secondary" onClick={goBackToProspect}>
              Back to Prospect
            </button>
          </main>
        </div>
      </div>
    );
  }

  const formDisabled = submitting || hasActiveLead || isProspectDropped;

  return (
    <div className="al-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="al-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="al-content">
          {/* Breadcrumb */}
          <div className="al-breadcrumb">
            <button
              type="button"
              className="al-crumbLink"
              onClick={() => navigate(`/agent/${user.username}/prospects`)}
            >
              Prospects
            </button>
            <span className="al-crumbSep">›</span>
            <button type="button" className="al-crumbLink" onClick={goBackToProspect}>
              {prospectName}
            </button>
            <span className="al-crumbSep">›</span>
            <span className="al-crumbCurrent">Add Lead</span>
          </div>

          <div className="al-card">
            <div className="al-header">
              <h1 className="al-title">Add a Lead for {prospectName}</h1>
              <button type="button" className="al-btn secondary" onClick={goBackToProspect}>
                ←
              </button>
            </div>

            {/* Dropped warning */}
            {isProspectDropped ? (
              <div className="al-help" style={{ marginBottom: 12 }}>
                <b>Lead creation blocked:</b> This prospect is <b>Dropped</b>.
              </div>
            ) : null}

            {/* Active lead warning */}
            {!isProspectDropped && hasActiveLead && activeLead?.leadCode ? (
              <div className="al-help" style={{ marginBottom: 12 }}>
                <b>Lead creation blocked:</b> Active lead exists ({activeLead.leadCode},{" "}
                {activeLead.status}).
              </div>
            ) : null}

            {/* Locked row */}
            <div className="al-lockedRow">
              <div className="al-lockedItem">
                <span className="al-lockedLabel">Lead No.</span>
                <span className="al-lockedValue">
                  {String(leadMeta?.leadNo ?? 0).padStart(2, "0")}
                </span>
              </div>

              <div className="al-lockedItem">
                <span className="al-lockedLabel">Lead Code</span>
                <span className="al-lockedValue al-muted">Auto-generated</span>
              </div>

              <div className="al-lockedItem">
                <span className="al-lockedLabel">For</span>
                <span className="al-lockedValue">{prospectName}</span>
              </div>
            </div>

            {/* Form */}
            <form className="al-form" onSubmit={onSubmit}>
              <div className="al-grid2">
                <div className="al-field">
                  <label className="al-label">Lead Source *</label>

                  <select
                    className={`al-input ${errors.source ? "error" : ""}`}
                    value={source}
                    disabled={isSystemAssigned || formDisabled}
                    onChange={(e) => {
                      setSource(e.target.value);
                      setErrors((er) => ({ ...er, source: undefined }));
                      if (e.target.value !== "Other") setOtherSource("");
                    }}
                  >
                    {!isSystemAssigned && <option value="">Select</option>}
                    <option value="Family">Family</option>
                    <option value="Friend">Friend</option>
                    <option value="Acquaintance">Acquaintance</option>
                    <option value="Webinars">Webinars</option>
                    <option value="Seminars/Conferences">Seminars/Conferences</option>
                    <option value="Other">Other</option>
                    {isSystemAssigned && <option value="System">System</option>}
                  </select>

                  {isSystemAssigned && (
                    <div className="al-help al-muted">
                      This prospect is System-Assigned, so lead source is locked to <b>System</b>.
                    </div>
                  )}

                  {errors.source && <p className="al-errorText">{errors.source}</p>}
                </div>

                {source === "Other" && !isSystemAssigned && (
                  <div className="al-field">
                    <label className="al-label">Specify other source *</label>
                    <input
                      className={`al-input ${errors.otherSource ? "error" : ""}`}
                      value={otherSource}
                      disabled={formDisabled}
                      onChange={(e) => {
                        setOtherSource(e.target.value);
                        setErrors((er) => ({ ...er, otherSource: undefined }));
                      }}
                      placeholder="e.g., Facebook group, Referral, etc."
                    />
                    {errors.otherSource && <p className="al-errorText">{errors.otherSource}</p>}
                  </div>
                )}
              </div>

              <div className="al-field">
                <label className="al-label">Lead Description (optional)</label>
                <textarea
                  className="al-textarea"
                  value={description}
                  disabled={formDisabled}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes about this lead..."
                  rows={4}
                />
              </div>

              <div className="al-actions">
                <button
                  type="button"
                  className="al-btn secondary"
                  onClick={goBackToProspect}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button type="submit" className="al-btn primary" disabled={formDisabled}>
                  {isProspectDropped
                    ? "Prospect is dropped"
                    : hasActiveLead
                    ? "Active lead exists"
                    : submitting
                    ? "Creating..."
                    : "Create Lead"}
                </button>
              </div>
            </form>
          </div>

          {/* SUCCESS MODAL */}
          {successModal.open && (
            <div className="al-modalOverlay" role="dialog" aria-modal="true">
              <div className="al-modal">
                <button
                  type="button"
                  className="al-modalClose"
                  onClick={closeSuccess}
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </button>

                <h3 className="al-modalTitle">Lead Successfully Created</h3>

                <div className="al-modalBox">
                  <div className="al-modalRow">
                    <span className="al-modalKey">Lead Code</span>
                    <span className="al-modalVal mono">{successModal.leadCode}</span>
                  </div>
                  <div className="al-modalRow">
                    <span className="al-modalKey">Lead Source</span>
                    <span className="al-modalVal">{successModal.leadSource}</span>
                  </div>
                  <div className="al-modalRow">
                    <span className="al-modalKey">Lead Status</span>
                    <span className="al-modalVal">{successModal.leadStatus}</span>
                  </div>
                  <div className="al-modalRow">
                    <span className="al-modalKey">For</span>
                    <span className="al-modalVal">{successModal.prospectName}</span>
                  </div>
                </div>

                <div className="al-modalActions">
                  <button type="button" className="al-btn secondary" onClick={closeSuccess}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="al-btn primary"
                    onClick={startEngaging}
                    disabled={!successModal.leadId}
                  >
                    Start Engaging →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ERROR MODAL */}
          {errorModal.open && (
            <div className="al-modalOverlay" role="dialog" aria-modal="true">
              <div className="al-modal">
                <button
                  type="button"
                  className="al-modalClose"
                  onClick={closeErrorModal}
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </button>

                <h3 className="al-modalTitle">{errorModal.title || "Error"}</h3>
                <p className="al-modalText">{errorModal.message || "Something went wrong."}</p>

                <div className="al-modalActions">
                  {errorModal.action?.label ? (
                    <button
                      type="button"
                      className="al-btn secondary"
                      onClick={() => {
                        const fn = errorModal.action?.onClick;
                        closeErrorModal();
                        if (typeof fn === "function") fn();
                      }}
                    >
                      {errorModal.action.label}
                    </button>
                  ) : null}

                  <button type="button" className="al-btn primary" onClick={closeErrorModal}>
                    OK
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

export default AgentAddLead;