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

  const formatCoverageType = (type) => {
    const normalized = String(type || "").trim();
    const labels = {
      FIXED_YEARS: "Fixed Years",
      RANGE_TO_AGE: "Range to Age",
      UNTIL_AGE: "Until Age",
      MIXED: "Mixed",
    };
    return labels[normalized] || normalized || "—";
  };

  const buildTypeValue = (type, years, untilAge) => {
    const normalized = String(type || "").trim();
    const y = Number(years);
    const age = Number(untilAge);

    if (normalized === "FIXED_YEARS" && Number.isFinite(y) && y > 0) {
      return `${y} ${y === 1 ? "year" : "years"}`;
    }
    if (normalized === "UNTIL_AGE" && Number.isFinite(age) && age > 0) {
      return `Until age ${age}`;
    }
    if (normalized === "RANGE_TO_AGE" && Number.isFinite(y) && y > 0 && Number.isFinite(age) && age > 0) {
      return `${y} ${y === 1 ? "year" : "years"} / until age ${age}`;
    }
    if (normalized === "MIXED" && Number.isFinite(y) && y > 0 && Number.isFinite(age) && age > 0) {
      return `${y} ${y === 1 ? "year" : "years"} / until age ${age}`;
    }
    return "—";
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

  const rows = [
    ["Policyholder Code", policyholder.policyholderCode],
    ["Product Name", product.productName],
    ["Policy Number", policyholder.policyNumber],
    ["Policy Issuance Date", formatDateOnly(coverage.policyIssuanceDate)],
    ["Policy End Date", formatDateOnly(coverage.policyEndDate)],
    ["Coverage Duration", coverage.coverageDurationLabel],
    ["Coverage Duration Type", formatCoverageType(coverage.coverageDurationType)],
    ["Coverage Duration Type Value", buildTypeValue(coverage.coverageDurationType, coverage.coverageDurationYears, coverage.coverageDurationUntilAge)],
    ["Policyholder Status", policyholder.status],
    ["Last Paid Date", formatDateOnly(policyholder.lastPaidDate)],
    ["Next Payment Date", formatDateOnly(policyholder.nextPaymentDate)],
  ];

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
                <div className="ph-headerRow">
                  <div>
                    <h1 className="ph-title">{policyholder.policyholderCode || "Policyholder Details"}</h1>
                    <p className="ph-subtitle">
                      {product.productName || "—"} <span>•</span> {policyholder.policyNumber || "—"}
                    </p>
                  </div>
                  <span className={`ph-status ${policyholder.status === "Active" ? "active" : "neutral"}`}>
                    {policyholder.status || "—"}
                  </span>
                </div>

                <section className="ph-section">
                  <h2 className="ph-sectionTitle">Policyholder Details</h2>
                  <div className="ph-grid">
                    {rows.map(([label, value]) => (
                      <div key={label} className="ph-detailItem">
                        <span className="ph-detailLabel">{label}</span>
                        <span className="ph-detailValue">{value || "—"}</span>
                      </div>
                    ))}
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
