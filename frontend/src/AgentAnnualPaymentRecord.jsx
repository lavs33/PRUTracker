import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentAnnualPaymentRecord.css";

function AgentAnnualPaymentRecord() {
  const navigate = useNavigate();
  const { username, policyholderId, annualPaymentId } = useParams();

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
    document.title = `${user.username} | Annual Payment Record Details`;
  }, [user]);

  useEffect(() => {
    if (!isReady || !user?.id) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");

        const res = await fetch(
          `http://localhost:5000/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}?userId=${user.id}`,
          { signal: controller.signal }
        );
        const data = await res.json();

        if (!res.ok) {
          setApiError(data.message || "Failed to fetch annual payment record.");
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
  }, [isReady, user?.id, policyholderId, annualPaymentId]);

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

  const formatAmount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `Php ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const policyholder = details?.policyholder || {};
  const prospect = details?.prospect || {};
  const product = details?.product || {};
  const annualPayment = details?.annualPayment || {};
  const policySummary = details?.policySummary || {};
  const payments = Array.isArray(details?.payments) ? details.payments : [];
  const progressLabel = annualPayment?.paymentProgress?.label || "0/0";
  const annualStatus = String(annualPayment?.status || "Not Started");
  const isAnnualPaymentCompleted = annualStatus.toLowerCase() === "completed";
  const policyNumber = policyholder.policyNumber || policySummary.policyNumber || "";
  const policySummaryFileDataUrl = String(policySummary.fileDataUrl || "").trim();
  const frequencyLabel = annualPayment.frequencyOfPayment === "Half-yearly" ? "Half-Yearly" : (annualPayment.frequencyOfPayment || "Payment");

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
            <button type="button" className="ph-crumbLink" onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholderId}`)}>
              {policyholder.policyholderCode || "Policyholder"}
            </button>
            <span className="ph-crumbSep">›</span>
            <span className="ph-crumbCurrent">{annualPayment.label || "Annual Payment Period"} Payment Record</span>
          </div>

          <div className="ph-card">
            {loading ? (
              <p className="ph-note">Loading annual payment record...</p>
            ) : apiError ? (
              <p className="ph-note ph-note--error">{apiError}</p>
            ) : (
              <>
                <div className="ph-annualHero">
                  <div>
                    <p className="ph-kicker">Annual Payment Record</p>
                    <h1 className="ph-name">{annualPayment.label || "Annual Payment Period"}</h1>
                    <div className="ph-subline">
                      <span className="ph-code">{policyholder.policyholderCode || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-code">{prospect.fullName || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-subtext">{product.productName || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-subtext">
                        {policyNumber ? (
                          <button
                            type="button"
                            className="ph-policyNumberLink"
                            onClick={() => setIsPolicySummaryPreviewOpen(true)}
                            title="Preview policy summary"
                          >
                            {policyNumber}
                          </button>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </div>
                  <span className={`ph-paymentStatus ${annualStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                    {annualStatus}
                  </span>
                </div>

                <section className="ph-annualSummaryGrid" aria-label="Annual payment summary">
                  <div className="ph-summaryTile">
                    <span>Total Annual Premium</span>
                    <strong>{formatAmount(annualPayment.totalAnnualPremiumPhp)}</strong>
                  </div>
                  <div className="ph-summaryTile">
                    <span>Amount Paid So Far</span>
                    <strong>{formatAmount(annualPayment.amountPaidSoFarPhp)}</strong>
                  </div>
                  <div className="ph-summaryTile">
                    <span>Remaining Balance</span>
                    <strong>{formatAmount(annualPayment.remainingBalancePhp)}</strong>
                  </div>
                  <div className="ph-summaryTile">
                    <span>Frequency of Payment</span>
                    <strong>{annualPayment.frequencyOfPayment || "—"}</strong>
                  </div>
                  <div className="ph-summaryTile">
                    <span>Payment Progress</span>
                    <strong>{progressLabel}</strong>
                  </div>
                  {!isAnnualPaymentCompleted ? (
                    <div className="ph-summaryTile">
                      <span>Next Payment Date</span>
                      <strong>{formatDateOnly(policyholder.nextPaymentDate)}</strong>
                    </div>
                  ) : null}
                </section>

                {isPolicySummaryPreviewOpen ? (
                  <div className="ph-previewOverlay" role="dialog" aria-modal="true" aria-labelledby="annual-policy-summary-preview-title">
                    <div className="ph-previewModal">
                      <div className="ph-previewHeader">
                        <div className="ph-previewInfo">
                          <h2 id="annual-policy-summary-preview-title" className="ph-previewTitle">Policy Summary Preview</h2>
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
                              <strong className="ph-previewMetaValue">{policyNumber || "—"}</strong>
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
                          <p>No policy summary PDF is available for preview.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <section className="ph-records ph-paymentTimelineSection">
                  <div className="ph-recordsHeader">
                    <div>
                      <h2 className="ph-recordsTitle">{frequencyLabel} Payment Records</h2>
                      <p className="ph-note">Payments are shown from most recent to oldest within this annual payment period.</p>
                    </div>
                  </div>

                  {payments.length ? (
                    <div className="ph-paymentTimeline">
                      {payments.map((payment, index) => {
                        const paymentId = String(payment?.paymentId || payment?._id || "");
                        const status = String(payment?.status || "Pending");
                        return (
                          <button
                            key={paymentId || index}
                            type="button"
                            className="ph-paymentRecordCard"
                            onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${paymentId}`)}
                            aria-label={`Open payment record ${payments.length - index}`}
                          >
                            <span className="ph-paymentRecordIndex">#{payments.length - index}</span>
                            <span className="ph-paymentRecordMain">
                              <span className="ph-paymentRecordTitle">{formatAmount(payment.totalPremiumPaidPhp)}</span>
                              <span className="ph-paymentRecordSub">{payment.paymentPeriodLabel || "No payment period label"}</span>
                              {payment.eorNumber ? (
                                <span className="ph-paymentRecordPreviewMeta">
                                  <b>eOR:</b> {payment.eorNumber}
                                </span>
                              ) : null}
                            </span>
                            <span className={`ph-paymentStatus ${status.toLowerCase().replace(/\s+/g, "-")}`}>
                              {status}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="ph-recordsBody ph-recordsBodyPad">
                      <div className="ph-empty">
                        <div className="ph-emptyIcon">💳</div>
                        <div className="ph-emptyText">No individual payment records yet.</div>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentAnnualPaymentRecord;
