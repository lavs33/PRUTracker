import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentPaymentRecordDetails.css";

function AgentPaymentRecordDetails() {
  const navigate = useNavigate();
  const { username, policyholderId, annualPaymentId, paymentId } = useParams();

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
  const [activePreview, setActivePreview] = useState(null);

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
    document.title = `${user.username} | Payment Record Details`;
  }, [user]);

  useEffect(() => {
    if (!isReady || !user?.id) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");

        const res = await fetch(
          `http://localhost:5000/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${paymentId}?userId=${user.id}`,
          { signal: controller.signal }
        );
        const data = await res.json();

        if (!res.ok) {
          setApiError(data.message || "Failed to fetch payment record details.");
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
  }, [isReady, user?.id, policyholderId, annualPaymentId, paymentId]);

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
  const payment = details?.payment || {};
  const paymentStatus = String(payment.status || "Pending");
  const paymentNumber = payment.paymentNumber ? `#${payment.paymentNumber}` : "Payment Record";

  const transferRows = [
    ["Total Premium Paid", formatAmount(payment.totalPremiumPaidPhp)],
    ["Frequency", payment.frequencyOfPremiumPayment || annualPayment.frequencyOfPayment || "—"],
    ["Payment Date", formatDateOnly(payment.paymentDate)],
    ["Payment Period Covered", payment.paymentPeriodLabel || "—"],
    ["Method", payment.methodForPayment || "—"],
    ["Proof of Payment", payment.proofOfPaymentFileName || "—"],
    ["Saved At", formatDateOnly(payment.savedAt)],
  ];

  const eorRows = [
    ["eOR Number", payment.eorNumber || "—"],
    ["Receipt Date", formatDateOnly(payment.receiptDate)],
    ["eOR File", payment.eorFileName || "—"],
    ["Uploaded At", formatDateOnly(payment.uploadedAt)],
  ];

  const preview = activePreview === "proof"
    ? {
        title: "Proof of Payment Preview",
        fileName: payment.proofOfPaymentFileName,
        dataUrl: payment.proofOfPaymentFileDataUrl,
        mimeType: payment.proofOfPaymentFileMimeType,
      }
    : activePreview === "eor"
      ? {
          title: "eOR File Preview",
          fileName: payment.eorFileName,
          dataUrl: payment.eorFileDataUrl,
          mimeType: payment.eorFileMimeType,
        }
      : null;

  const renderPreviewContent = () => {
    if (!preview?.dataUrl) {
      return (
        <div className="ph-previewEmpty">
          <p>No file is available for preview.</p>
        </div>
      );
    }

    if (String(preview.mimeType || "").startsWith("image/")) {
      return <img src={preview.dataUrl} alt={preview.fileName || preview.title} className="pay-previewImage" />;
    }

    return <iframe title={preview.title} src={preview.dataUrl} className="ph-previewFrame" />;
  };

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
            <button
              type="button"
              className="ph-crumbLink"
              onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}`)}
            >
              {annualPayment.label || "Annual Payment Period"} Payment Record
            </button>
            <span className="ph-crumbSep">›</span>
            <span className="ph-crumbCurrent">{paymentNumber}</span>
          </div>

          <div className="ph-card">
            {loading ? (
              <p className="ph-note">Loading payment record details...</p>
            ) : apiError ? (
              <p className="ph-note ph-note--error">{apiError}</p>
            ) : (
              <>
                <div className="pay-hero">
                  <div>
                    <p className="ph-kicker">Individual Payment Record</p>
                    <h1 className="ph-name">{paymentNumber}</h1>
                    <div className="ph-subline">
                      <span className="ph-code">{policyholder.policyholderCode || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-code">{prospect.fullName || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-subtext">{product.productName || "—"}</span>
                      <span className="ph-dot">•</span>
                      <span className="ph-subtext">{policyholder.policyNumber || "—"}</span>
                    </div>
                  </div>
                  <span className={`ph-paymentStatus ${paymentStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                    {paymentStatus}
                  </span>
                </div>

                <section className="pay-summaryGrid" aria-label="Payment summary">
                  <div className="ph-summaryTile pay-summaryTilePrimary">
                    <span>Total Premium Paid</span>
                    <strong>{formatAmount(payment.totalPremiumPaidPhp)}</strong>
                  </div>
                  <div className="ph-summaryTile">
                    <span>Payment Period Covered</span>
                    <strong>{payment.paymentPeriodLabel || "—"}</strong>
                  </div>
                  <div className="ph-summaryTile">
                    <span>eOR Number</span>
                    <strong>{payment.eorNumber || "Pending"}</strong>
                  </div>
                </section>

                <div className="pay-detailGrid">
                  <section className="pay-detailCard">
                    <div className="pay-detailCardHeader">
                      <h2>Premium Payment Transfer</h2>
                      {payment.proofOfPaymentFileDataUrl ? (
                        <button type="button" className="pay-previewButton" onClick={() => setActivePreview("proof")}>
                          Preview Proof
                        </button>
                      ) : null}
                    </div>
                    <div className="pay-detailRows">
                      {transferRows.map(([label, value]) => (
                        <div key={label} className="pay-detailRow">
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="pay-detailCard">
                    <div className="pay-detailCardHeader">
                      <h2>Premium Payment eOR</h2>
                      {payment.eorFileDataUrl ? (
                        <button type="button" className="pay-previewButton" onClick={() => setActivePreview("eor")}>
                          Preview eOR
                        </button>
                      ) : null}
                    </div>
                    <div className="pay-detailRows">
                      {eorRows.map(([label, value]) => (
                        <div key={label} className="pay-detailRow">
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {preview ? (
                  <div className="ph-previewOverlay" role="dialog" aria-modal="true" aria-labelledby="payment-file-preview-title">
                    <div className="ph-previewModal">
                      <div className="ph-previewHeader">
                        <div className="ph-previewInfo">
                          <h2 id="payment-file-preview-title" className="ph-previewTitle">{preview.title}</h2>
                          <div className="ph-previewMetaGrid">
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">File Name</span>
                              <strong className="ph-previewMetaValue">{preview.fileName || "—"}</strong>
                            </div>
                            <div className="ph-previewMetaItem">
                              <span className="ph-previewMetaLabel">Payment Record</span>
                              <strong className="ph-previewMetaValue">{paymentNumber}</strong>
                            </div>
                          </div>
                        </div>
                        <div className="ph-previewActions">
                          <button
                            type="button"
                            className="ph-previewClose"
                            onClick={() => setActivePreview(null)}
                            aria-label="Close file preview"
                            title="Close"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {renderPreviewContent()}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentPaymentRecordDetails;
