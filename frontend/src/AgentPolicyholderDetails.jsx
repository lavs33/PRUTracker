import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentPolicyholderDetails.css";

function AgentPolicyholderDetails() {
  const navigate = useNavigate();
  const { username, prospectId, leadId, policyholderId } = useParams();

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
  const [details, setDetails] = useState(null);

  useEffect(() => {
    if (!user || user.username !== username) {
      setIsReady(false);
      navigate("/", { replace: true });
      return;
    }
    setIsReady(true);
  }, [user, username, navigate]);

  useEffect(() => {
    if (!user) return;
    const code = details?.policyholder?.policyholderCode;
    document.title = `${user.username} | ${code || "Policyholder Details"}`;
  }, [details?.policyholder?.policyholderCode, user]);

  useEffect(() => {
    if (!isReady || !user?.id) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");

        const res = await fetch(
          `http://localhost:5000/api/prospects/${prospectId}/leads/${leadId}/policyholders/${policyholderId}/details?userId=${user.id}`,
          { signal: controller.signal }
        );
        const data = await res.json();

        if (!res.ok) {
          setApiError(data.message || "Failed to fetch policyholder details.");
          setDetails(null);
          return;
        }

        setDetails(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setApiError("Cannot connect to server. Is backend running?");
          setDetails(null);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id, prospectId, leadId, policyholderId]);

  const formatDateOnly = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

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
      case "sales":
      case "sales_performance":
        navigate(`/agent/${user.username}/sales/performance`);
        break;
      default:
        break;
    }
  };

  if (!isReady) return null;

  const prospect = details?.prospect || {};
  const lead = details?.lead || {};
  const policyholder = details?.policyholder || {};
  const product = details?.product || {};
  const coverage = details?.coverage || {};

  const detailRows = [
    ["Policy Issuance Date", formatDateOnly(coverage.policyIssuanceDate)],
    ["Policy End Date", formatDateOnly(coverage.policyEndDate)],
    ["Coverage Duration", coverage.coverageDurationLabel],
    ["Last Paid Date", formatDateOnly(policyholder.lastPaidDate)],
    ["Next Payment Date", formatDateOnly(policyholder.nextPaymentDate)],
  ];

  const statusClass = policyholder.status === "Active" ? "active" : "dropped";

  return (
    <div className="ph-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="ph-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="ph-content">
          <div className="ph-breadcrumb">
            <button type="button" className="ph-crumbLink" onClick={() => navigate(`/agent/${user.username}/prospects`)}>
              Prospects
            </button>
            <span className="ph-crumbSep">›</span>
            <button type="button" className="ph-crumbLink" onClick={() => navigate(`/agent/${user.username}/prospects/${prospectId}`)}>
              {prospect.fullName || "Prospect"}
            </button>
            <span className="ph-crumbSep">›</span>
            <button type="button" className="ph-crumbLink" onClick={() => navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${leadId}`)}>
              {lead.leadCode || "Lead Code"}
            </button>
            <span className="ph-crumbSep">›</span>
            <span className="ph-crumbCurrent">{policyholder.policyholderCode || "Policyholder Code"}</span>
          </div>

          <div className="ph-card">
            {loading ? (
              <p className="ph-note">Loading policyholder details...</p>
            ) : apiError ? (
              <p className="ph-note ph-note--error">{apiError}</p>
            ) : (
              <>
                <div className="ph-topRow">
                  <div className="ph-mainInfo">
                    <h1 className="ph-name">{policyholder.policyholderCode || "Policyholder Details"}</h1>

                    <div className="ph-subline">
                      <span className="ph-code">{product.productName || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-subtext">Policy Number: {policyholder.policyNumber || "—"}</span>
                    </div>

                    <div className="ph-contacts">
                      {detailRows.map(([label, value]) => (
                        <div key={label} className="ph-contactItem">
                          <span className="ph-contactLabel">{label}</span>
                          <span className="ph-contactValue">{value || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="ph-right">
                    <div className="ph-tags">
                      <div className="ph-tagRow">
                        <span className="ph-tagLabel">Status</span>
                        <span className={`status-pill ${statusClass}`}>
                          {policyholder.status || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <section className="ph-records">
                  <div className="ph-recordsHeader">
                    <h2 className="ph-recordsTitle">Records</h2>
                  </div>

                  <div className="ph-recordTabsRow">
                    <div className="ph-tabs">
                      <button type="button" className="ph-tab active">
                        Payment Records
                      </button>
                    </div>

                    <div className="ph-recordActions">
                      <button type="button" className="ph-actionBtn" title="Add new payment">
                        + New Payment
                      </button>
                    </div>
                  </div>

                  <div className="ph-recordsBody ph-recordsBodyPad">
                    <div className="ph-empty">
                      <div className="ph-emptyIcon">💳</div>
                      <div className="ph-emptyText">No payment records yet.</div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentPolicyholderDetails;
