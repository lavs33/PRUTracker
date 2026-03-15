import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentProspectDetails.css";

function AgentProspectDetails() {
  const navigate = useNavigate();
  const { username, prospectId } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [isReady, setIsReady] = useState(false);
  const [prospect, setProspect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  // Keep leads tab
  const [recordsTab, setRecordsTab] = useState("leads");

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
    if (user) document.title = `${user.username} | Prospect Details`;
  }, [user]);

  // Fetch Prospect Details
  useEffect(() => {
    if (!isReady) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");

        if (!user?.id) {
          setApiError("Missing user id. Please log in again.");
          setProspect(null);
          return;
        }

        if (!prospectId) {
          setApiError("Missing prospect id.");
          setProspect(null);
          return;
        }

        const res = await fetch(
          `http://localhost:5000/api/prospects/${prospectId}/details?userId=${user.id}`,
          { signal: controller.signal }
        );

        const data = await res.json();

        if (!res.ok) {
          setApiError(data.message || "Failed to fetch prospect details.");
          setProspect(null);
          return;
        }

        setProspect(data.prospect || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setApiError("Cannot connect to server. Is backend running?");
          setProspect(null);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id, prospectId]);

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

      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;

      case "sales":
        alert("Sales module coming soon");
        break;

      default:
        break;
    }
  };

  const goBackToProspects = () => navigate(`/agent/${user.username}/prospects`);

  const fullName = useMemo(() => {
    if (!prospect) return "";
    return `${prospect.firstName || ""}${prospect.middleName ? ` ${prospect.middleName}` : ""} ${
      prospect.lastName || ""
    }`.trim();
  }, [prospect]);

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

  // Leads (most recent first)
  const leadRows = useMemo(() => {
    const arr = Array.isArray(prospect?.leads) ? [...prospect.leads] : [];
    return arr.sort((a, b) => {
      const ta = new Date(a?.createdAt).getTime();
      const tb = new Date(b?.createdAt).getTime();
      const na = Number.isFinite(ta) ? ta : -Infinity;
      const nb = Number.isFinite(tb) ? tb : -Infinity;
      return nb - na;
    });
  }, [prospect]);

  // Loading
  if (!isReady) return null;

  if (loading) {
    return (
      <div className="pd-shell">
        <TopNav
          user={user}
          onLogoClick={() => navigate(`/agent/${username}`)}
          onProfileClick={() => navigate(`/agent/${username}/profile`)}
          onLogout={() => logout(navigate)}
          onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
        />

        <div className="pd-body">
          <SideNav onNavigate={handleSideNav} />
          <main className="pd-content">
            <p className="pd-small-note">Loading prospect details...</p>
          </main>
        </div>
      </div>
    );
  }

  // Error / Not found
  if (apiError || !prospect) {
    return (
      <div className="pd-shell">
        <TopNav
          user={user}
          onLogoClick={() => navigate(`/agent/${username}`)}
          onProfileClick={() => navigate(`/agent/${username}/profile`)}
          onLogout={() => logout(navigate)}
          onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
        />

        <div className="pd-body">
          <SideNav onNavigate={handleSideNav} />
          <main className="pd-content">
            <p className="pd-small-note" style={{ color: "#DA291C" }}>
              {apiError || "Prospect not found."}
            </p>

            <button type="button" className="pd-crumbLink" onClick={goBackToProspects}>
              ← Back to Prospects
            </button>
          </main>
        </div>
      </div>
    );
  }

  // Banner rule:
  // show if Wrong Contact OR has open update-contact task
  const showInvalidPhoneBanner =
    prospect.status === "Wrong Contact" || !!prospect.hasOpenUpdateContactInfoTask;

  // Dropped prospects cannot create new lead
  const isDropped = String(prospect.status || "").trim().toLowerCase() === "dropped";

  // Keep tab sane (in case old localStorage/logic tries to set tasks)
  const safeTab = recordsTab === "leads" ? "leads" : "leads";

  return (
    <div className="pd-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="pd-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="pd-content">
          <div className="pd-breadcrumb">
            <button type="button" className="pd-crumbLink" onClick={goBackToProspects}>
              Prospects
            </button>
            <span className="pd-crumbSep">›</span>
            <span className="pd-crumbCurrent">{fullName}</span>
          </div>

          <div className="pd-card">
            {/* Top row */}
            <div className="pd-topRow">
              <div className="pd-mainInfo">
                <h1 className="pd-name">{fullName || "—"}</h1>

                <div className="pd-subline">
                  <span className="pd-code">{prospect.prospectCode || "—"}</span>
                  <span className="pd-dot">•</span>
                  <span className="pd-subtext">
                    Potential Customer |{" "}
                    {prospect.source === "Agent-Sourced" ? "Agent-Sourced" : "System-Assigned"}
                  </span>
                </div>

                <div className="pd-contacts">
                  <div className="pd-contactItem">
                    <span className="pd-contactLabel">Phone</span>

                    <span className="pd-contactValue">
                      {prospect.phoneNumber ? `+63 ${prospect.phoneNumber}` : "—"}
                    </span>

                    {/* phone version */}
                    <span className="pd-contactSubValue">
                      Version:{" "}
                      {Number.isFinite(Number(prospect.contactInfoVersion))
                        ? prospect.contactInfoVersion
                        : "—"}
                    </span>

                    {/* Banner (no button) */}
                    {showInvalidPhoneBanner ? (
                      <div className="pd-alert pd-alert--warning">
                        Phone number is marked invalid. Please update contact info.
                      </div>
                    ) : null}
                  </div>

                  <div className="pd-contactItem">
                    <span className="pd-contactLabel">Email</span>
                    <span className="pd-contactValue">{prospect.email || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Right panel */}
              <div className="pd-right">
                <button
                  className="pd-actionBtn"
                  type="button"
                  onClick={() => navigate(`/agent/${user.username}/prospects/${prospectId}/full`)}
                >
                  →
                </button>

                <div className="pd-tags">
                  <div className="pd-tagRow">
                    <span className="pd-tagLabel">Market Type</span>
                    <span className={`pill market ${String(prospect.marketType || "").toLowerCase()}`}>
                      {prospect.marketType || "—"}
                    </span>
                  </div>

                  <div className="pd-tagRow">
                    <span className="pd-tagLabel">Prospect Type</span>
                    {prospect.prospectType ? (
                      <span className={`pill prospect ${String(prospect.prospectType).toLowerCase()}`}>
                        {prospect.prospectType}
                      </span>
                    ) : (
                      <span className="pill prospect unknown">—</span>
                    )}
                  </div>

                  <div className="pd-tagRow">
                    <span className="pd-tagLabel">Status</span>
                    <span
                      className={`status-pill ${
                        prospect.status === "Active"
                          ? "active"
                          : prospect.status === "Dropped"
                          ? "dropped"
                          : prospect.status === "Wrong Contact"
                          ? "wrong"
                          : ""
                      }`}
                    >
                      {prospect.status || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Records */}
            <div className="pd-records">
              <div className="pd-recordsHeader">
                <h2 className="pd-recordsTitle">Records</h2>
              </div>

              {/* Tabs row (keep Leads tab) */}
              <div className="pd-recordTabsRow">
                <div className="pd-tabs">
                  <button
                    type="button"
                    className={`pd-tab ${safeTab === "leads" ? "active" : ""}`}
                    onClick={() => setRecordsTab("leads")}
                  >
                    Leads
                  </button>
                </div>

                {safeTab === "leads" ? (
                  <div className="pd-recordActions">
                    {isDropped ? (
                      <div className="pd-recordNotice pd-recordNotice--warning">
                        This prospect is <b>Dropped</b>. You cannot create new leads.
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="pd-actionBtn"
                      disabled={isDropped}
                      title={isDropped ? "Cannot add lead: prospect is Dropped" : "Add new lead"}
                      onClick={() => {
                        if (isDropped) return;
                        navigate(`/agent/${user.username}/prospects/${prospectId}/leads/new`);
                      }}
                    >
                      + New Lead
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Body */}
              <div className="pd-recordsBody pd-recordsBodyPad">
                {/* LEADS TAB */}
                {safeTab === "leads" ? (
                  leadRows.length === 0 ? (
                    <div className="pd-empty">
                      <div className="pd-emptyIcon">✉️</div>
                      <div className="pd-emptyText">Prospect has no lead</div>
                    </div>
                  ) : (
                    <div className="pd-leadsList">
                      {leadRows.map((l) => (
                        <div
                          key={l._id}
                          className="pd-leadRow"
                          onClick={() =>
                            navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${l._id}`)
                          }
                        >
                          <div className="pd-leadLeft">
                            <div className="pd-leadCode">{l.leadCode || "—"}</div>
                            <div className="pd-leadMeta">
                              <span className="pd-leadLabel">Status</span>
                              <span className="pd-leadStatus">{l.status || "—"}</span>
                            </div>
                          </div>

                          <div className="pd-leadRight">
                            <div className="pd-leadDate">{formatDateTime(l.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentProspectDetails;