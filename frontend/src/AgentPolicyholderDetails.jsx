import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentPolicyholderDetails.css";

function AgentPolicyholderDetails() {
  const navigate = useNavigate();
  const { username, policyholderId } = useParams();

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
  const [isPolicySummaryPreviewOpen, setIsPolicySummaryPreviewOpen] = useState(false);
  const [cancellationPreview, setCancellationPreview] = useState(null);

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
    document.title = `${user.username} | Policyholder Details`;
  }, [user]);

  useEffect(() => {
    if (!isReady || !user?.id) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");

        const res = await fetch(
          `http://localhost:5000/api/policyholders/${policyholderId}/details?userId=${user.id}`,
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
  }, [isReady, user?.id, policyholderId]);

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

  const formatTermValue = (type, years, untilAge) => {
    const normalized = String(type || "").trim();
    const y = Number(years);
    const age = Number(untilAge);

    if (normalized === "FIXED_YEARS" && Number.isFinite(y) && y > 0) {
      return `${y} ${y === 1 ? "year" : "years"}`;
    }
    if (normalized === "UNTIL_AGE" && Number.isFinite(age) && age > 0) {
      return `Until age ${age}`;
    }
    if (["RANGE_TO_AGE", "MIXED"].includes(normalized)) {
      if (Number.isFinite(y) && y > 0 && Number.isFinite(age) && age > 0) {
        return `${y} ${y === 1 ? "year" : "years"} / until age ${age}`;
      }
      if (Number.isFinite(age) && age > 0) {
        return `Until age ${age}`;
      }
      if (Number.isFinite(y) && y > 0) {
        return `${y} ${y === 1 ? "year" : "years"}`;
      }
    }
    return "";
  };

  const formatPaymentTerm = (type, years, untilAge) => formatTermValue(type, years, untilAge) || "—";

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
  const policySummary = details?.policySummary || {};
  const annualPaymentRecords = Array.isArray(details?.annualPaymentRecords) ? details.annualPaymentRecords : [];
  const policySummaryFileDataUrl = String(policySummary.fileDataUrl || "").trim();
  const cancellationDetails = policyholder.cancellationDetails || {};

  const formatAge = (value) => {
    const age = Number(value);
    if (!Number.isFinite(age) || age <= 0) return "—";
    return `${age} ${age === 1 ? "year old" : "years old"}`;
  };

  const detailSections = [
    {
      title: "Policy Overview",
      rows: [
        ["Age", formatAge(prospect.age)],
        ["Policy Issuance Date", formatDateOnly(coverage.policyIssuanceDate)],
        ["Policy End Date", formatDateOnly(coverage.policyEndDate)],
        ["Date Created", formatDateOnly(policyholder.createdAt)],
      ],
    },
    {
      title: "Coverage & Payments",
      rows: [
        ["Coverage Duration", coverage.coverageDurationLabel],
        [
          "Selected Payment Term",
          formatPaymentTerm(
            coverage.selectedPaymentTermType,
            coverage.selectedPaymentTermYears,
            coverage.selectedPaymentTermUntilAge
          ),
        ],
        ["Last Paid Date", formatDateOnly(policyholder.lastPaidDate)],
        ["Next Payment Due", formatDateOnly(policyholder.nextPaymentDate)],
      ],
    },
  ];

  const buildCancellationPreviewLink = ({ label, fileName, fileDataUrl, type }) => {
    const displayName = fileName || "—";
    if (!fileDataUrl) return displayName;

    return (
      <button
        type="button"
        className="ph-filePreviewLink"
        onClick={() => setCancellationPreview({
          title: `${label} Preview`,
          fileName: displayName,
          fileDataUrl,
          type,
        })}
        title={`Preview ${displayName}`}
      >
        {displayName}
      </button>
    );
  };

  const cancellationSection = policyholder.status === "Cancelled" && policyholder.cancellationDetails
    ? {
        title: "Cancellation Details",
        rows: [
          ["Cancellation Date", formatDateOnly(cancellationDetails.approvedCancellationDate)],
          ["Reason for Cancellation", cancellationDetails.cancellationReason || "—"],
          [
            "Surrender Charge",
            cancellationDetails.surrenderChargePhp !== null && cancellationDetails.surrenderChargePhp !== undefined
              ? `PHP ${Number(cancellationDetails.surrenderChargePhp).toLocaleString()}`
              : "—",
          ],
          [
            "Accomplished Policy Surrender Form",
            buildCancellationPreviewLink({
              label: "Accomplished Policy Surrender Form",
              fileName: cancellationDetails.accomplishedPolicySurrenderFormFileName,
              fileDataUrl: cancellationDetails.accomplishedPolicySurrenderFormFileDataUrl,
              type: "pdf",
            }),
          ],
          [
            "Proof of Approved Policy Surrender",
            buildCancellationPreviewLink({
              label: "Proof of Approved Policy Surrender",
              fileName: cancellationDetails.proofOfApprovedPolicySurrenderFileName,
              fileDataUrl: cancellationDetails.proofOfApprovedPolicySurrenderImageDataUrl,
              type: "image",
            }),
          ],
        ],
      }
    : null;

  const displaySections = cancellationSection ? [...detailSections, cancellationSection] : detailSections;

  const statusClass = policyholder.status === "Active" ? "active" : (policyholder.status === "At Risk" ? "at-risk" : (policyholder.status === "Lapsed" ? "lapsed" : (policyholder.status === "Paid-Up" ? "paid-up" : (policyholder.status === "Matured" ? "matured" : "dropped"))));

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
            <button type="button" className="ph-crumbLink" onClick={() => navigate(`/agent/${user.username}/policyholders`)}>
              Policyholders
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
                    <div className="ph-titleRow">
                      <h1 className="ph-name">{prospect.fullName || "Policyholder Details"}</h1>
                      {lead._id && prospect._id ? (
                        <button
                          type="button"
                          className="ph-leadLinkIcon"
                          onClick={() => navigate(`/agent/${user.username}/prospects/${prospect._id}/leads/${lead._id}`)}
                          title={`View Lead Details (${lead.leadCode || "Lead Code"})`}
                          aria-label={`View Lead Details (${lead.leadCode || "Lead Code"})`}
                        >
                          👤
                        </button>
                      ) : null}
                    </div>

                    <div className="ph-subline">
                      <span className="ph-code">{policyholder.policyholderCode || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-code">{product.productName || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-subtext">
                        Policy Number:{" "}
                        {policyholder.policyNumber ? (
                          <button
                            type="button"
                            className="ph-policyNumberLink"
                            onClick={() => setIsPolicySummaryPreviewOpen(true)}
                            title="Preview policy summary"
                          >
                            {policyholder.policyNumber}
                          </button>
                        ) : (
                          "—"
                        )}

                      </span>
                    </div>

                    <div className="ph-detailSections">
                      {policyholder.policyNumber && !["Cancelled", "Paid-Up", "Matured"].includes(policyholder.status) ? (
                        <div className="ph-cancelPolicyRow">
                          <a
                            href={`/agent/${user.username}/policyholders/${policyholder._id || policyholderId}/cancel`}
                            className="ph-cancelPolicyLink"
                            onClick={(event) => {
                              event.preventDefault();
                              navigate(`/agent/${user.username}/policyholders/${policyholder._id || policyholderId}/cancel`);
                            }}
                          >
                            Cancel Policy
                          </a>
                        </div>
                      ) : null}
                      {displaySections.map((section) => (
                        <section key={section.title} className="ph-detailSection">
                          <h2 className="ph-detailSectionTitle">{section.title}</h2>
                          <div className="ph-contacts">
                            {section.rows.map(([label, value]) => (
                              <div key={label} className="ph-contactItem">
                                <span className="ph-contactLabel">{label}</span>
                                <span className="ph-contactValue">{value || "—"}</span>
                              </div>
                            ))}
                          </div>
                        </section>
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

                {isPolicySummaryPreviewOpen ? (
                  <div className="ph-previewOverlay" role="dialog" aria-modal="true" aria-labelledby="policy-summary-preview-title">
                    <div className="ph-previewModal">
                      <div className="ph-previewHeader">
                        <div className="ph-previewInfo">
                          <h2 id="policy-summary-preview-title" className="ph-previewTitle">Policy Summary Preview</h2>
                          <div className="ph-previewMetaGrid">
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Policyholder Code</span>
                              <strong className="ph-previewMetaValue">{policyholder.policyholderCode || "—"}</strong>
                            </div>
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Policyholder Name</span>
                              <strong className="ph-previewMetaValue">{prospect.fullName || "—"}</strong>
                            </div>
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Product Name</span>
                              <strong className="ph-previewMetaValue">{product.productName || "—"}</strong>
                            </div>
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Policy Number</span>
                              <strong className="ph-previewMetaValue">{policyholder.policyNumber || policySummary.policyNumber || "—"}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="ph-previewActions">
                          <button
                            type="button"
                            className="ph-previewClose"
                            onClick={() => setIsPolicySummaryPreviewOpen(false)}
                            aria-label="Close policy summary preview"
                            title="Close"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {policySummaryFileDataUrl ? (
                        <iframe
                          title="Policy Summary Preview"
                          src={policySummaryFileDataUrl}
                          className="ph-previewFrame"
                        />
                      ) : (
                        <div className="ph-previewEmpty">
                          <p className="ph-note">No policy summary file is available for this policyholder yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {cancellationPreview ? (
                  <div className="ph-previewOverlay" role="dialog" aria-modal="true" aria-labelledby="cancellation-file-preview-title">
                    <div className="ph-previewModal">
                      <div className="ph-previewHeader">
                        <div className="ph-previewInfo">
                          <h2 id="cancellation-file-preview-title" className="ph-previewTitle">{cancellationPreview.title}</h2>
                          <div className="ph-previewMetaGrid">
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Policyholder Code</span>
                              <strong className="ph-previewMetaValue">{policyholder.policyholderCode || "—"}</strong>
                            </div>
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Policyholder Name</span>
                              <strong className="ph-previewMetaValue">{prospect.fullName || "—"}</strong>
                            </div>
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Product Name</span>
                              <strong className="ph-previewMetaValue">{product.productName || "—"}</strong>
                            </div>
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Policy Number</span>
                              <strong className="ph-previewMetaValue">{policyholder.policyNumber || policySummary.policyNumber || "—"}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="ph-previewActions">
                          <button
                            type="button"
                            className="ph-previewClose"
                            onClick={() => setCancellationPreview(null)}
                            aria-label="Close cancellation file preview"
                            title="Close"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {cancellationPreview.fileDataUrl ? (
                        cancellationPreview.type === "image" ? (
                          <div className="ph-previewImageWrap">
                            <img
                              src={cancellationPreview.fileDataUrl}
                              alt={`${cancellationPreview.fileName} preview`}
                              className="ph-previewImage"
                            />
                          </div>
                        ) : (
                          <iframe
                            title={cancellationPreview.title}
                            src={cancellationPreview.fileDataUrl}
                            className="ph-previewFrame"
                          />
                        )
                      ) : (
                        <div className="ph-previewEmpty">
                          <p className="ph-note">No cancellation file is available for preview.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

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
                  </div>

                  <div className={`ph-recordsBody ph-recordsBodyPad ${annualPaymentRecords.length ? "ph-recordsBodyList" : ""}`.trim()}>
                    {annualPaymentRecords.length ? (
                      <div className="ph-annualPaymentGrid">
                        {annualPaymentRecords.map((record) => {
                          const recordId = String(record?.annualPaymentId || record?._id || "");
                          const status = String(record?.status || "Not Started");
                          const progressLabel = String(record?.paymentProgress?.label || "0/0");
                          return (
                            <button
                              key={recordId || record?.label || record?.recordedAt}
                              type="button"
                              className="ph-annualPaymentCard"
                              onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholder._id || policyholderId}/annual-payments/${recordId}`)}
                            >
                              <span className="ph-annualPaymentCardLabel">{record?.label || record?.annualPaymentPeriod?.label || "Annual payment period"}</span>
                              <span className="ph-annualPaymentMetaRow">
                                <span className="ph-annualPaymentMeta">
                                  <span className="ph-annualPaymentMetaLabel">Progress</span>
                                  <strong>{progressLabel}</strong>
                                </span>
                                <span className={`ph-paymentStatus ${status.toLowerCase().replace(/\s+/g, "-")}`}>
                                  {status}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="ph-empty">
                        <div className="ph-emptyIcon">💳</div>
                        <div className="ph-emptyText">No payment records yet.</div>
                      </div>
                    )}
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