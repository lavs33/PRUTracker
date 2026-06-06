import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentPaymentRecordDetails.css";

const API_BASE = "http://localhost:5000";

function toDateInputValue(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialEorForm(payment = {}) {
  return {
    eorNumber: "",
    receiptDate: toDateInputValue(payment.receiptDate || payment.paymentDate || new Date()),
    eorFileDataUrl: "",
    eorFileName: "",
    eorFileMimeType: "",
  };
}

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
  const [isEditingEor, setIsEditingEor] = useState(false);
  const [savingEor, setSavingEor] = useState(false);
  const [isEorConfirmOpen, setIsEorConfirmOpen] = useState(false);
  const [eorFieldErrors, setEorFieldErrors] = useState({});
  const [eorForm, setEorForm] = useState(() => getInitialEorForm());

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
    const frequency = (details?.payment?.frequencyOfPremiumPayment || details?.annualPayment?.frequencyOfPayment) === "Half-yearly"
      ? "Half-Yearly"
      : (details?.payment?.frequencyOfPremiumPayment || details?.annualPayment?.frequencyOfPayment || "Payment");
    document.title = `${user.username} | ${frequency} Payment Record Details`;
  }, [details?.annualPayment?.frequencyOfPayment, details?.payment?.frequencyOfPremiumPayment, user]);

  const loadDetails = useCallback(async (signal, { showLoading = true } = {}) => {
    if (!user?.id) return;
    try {
      if (showLoading) setLoading(true);
      setApiError("");

      const res = await fetch(
        `${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${paymentId}?userId=${user.id}`,
        signal ? { signal } : undefined
      );
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.message || "Failed to fetch payment record details.");
        setDetails(null);
        return;
      }

      setDetails(data);
      setEorForm(getInitialEorForm(data?.payment));
      setIsEorConfirmOpen(false);
    } catch (err) {
      if (err.name !== "AbortError") {
        setApiError("Cannot connect to server. Is backend running?");
        setDetails(null);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [annualPaymentId, paymentId, policyholderId, user?.id]);

  useEffect(() => {
    if (!isReady || !user?.id) return;

    const controller = new AbortController();
    loadDetails(controller.signal);
    return () => controller.abort();
  }, [isReady, user?.id, loadDetails]);

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

  const handleEorFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^application\/pdf$/i.test(file.type)) {
      setEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "eOR file must be a PDF." }));
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEorForm((prev) => ({
        ...prev,
        eorFileDataUrl: String(reader.result || ""),
        eorFileName: file.name,
        eorFileMimeType: file.type || "application/pdf",
      }));
      setEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "" }));
    };
    reader.onerror = () => setEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "Failed to read eOR file." }));
    reader.readAsDataURL(file);
  };

  const validateEor = () => {
    const nextErrors = {};
    const paymentDateValue = details?.payment?.paymentDate ? toDateInputValue(details.payment.paymentDate) : "";
    const todayValue = toDateInputValue(new Date());
    if (!String(eorForm.eorNumber || "").trim()) nextErrors.eorNumber = "eOR number is required.";
    if (!eorForm.receiptDate) nextErrors.receiptDate = "Receipt date is required.";
    if (eorForm.receiptDate && paymentDateValue && eorForm.receiptDate < paymentDateValue) {
      nextErrors.receiptDate = "Receipt date cannot be before the payment date.";
    }
    if (eorForm.receiptDate && todayValue && eorForm.receiptDate > todayValue) {
      nextErrors.receiptDate = "Receipt date cannot be in the future.";
    }
    if (!eorForm.eorFileDataUrl) nextErrors.eorFileDataUrl = "eOR PDF file is required.";
    setEorFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEorSubmit = async (event) => {
    event.preventDefault();
    if (!validateEor() || !user?.id) return;
    setIsEorConfirmOpen(true);
  };

  const handleConfirmEorSave = async () => {
    if (!user?.id) return;
    try {
      setSavingEor(true);
      setApiError("");
      const res = await fetch(`${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${paymentId}/eor?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eorForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIsEorConfirmOpen(false);
        setApiError(data.message || "Failed to upload premium payment eOR.");
        return;
      }
      setIsEorConfirmOpen(false);
      setIsEditingEor(false);
      setEorFieldErrors({});
      setEorForm(getInitialEorForm(data.payment));
      await loadDetails(undefined, { showLoading: false });
    } catch {
      setIsEorConfirmOpen(false);
      setApiError("Cannot connect to server. Is backend running?");
    } finally {
      setSavingEor(false);
    }
  };

  if (!isReady) return null;

  const policyholder = details?.policyholder || {};
  const prospect = details?.prospect || {};
  const product = details?.product || {};
  const annualPayment = details?.annualPayment || {};
  const payment = details?.payment || {};
  const policySummary = details?.policySummary || {};
  const paymentStatus = String(payment.status || "Pending");
  const hasUploadedEor = Boolean(payment.eorNumber || payment.eorFileDataUrl || payment.uploadedAt || paymentStatus === "Processed");
  const canEditEor = Boolean(payment._id && !hasUploadedEor);
  const receiptDateMin = payment.paymentDate ? toDateInputValue(payment.paymentDate) : "";
  const receiptDateMax = toDateInputValue(new Date());
  const paymentNumber = payment.paymentNumber ? `#${payment.paymentNumber}` : "—";
  const frequencyLabel = (payment.frequencyOfPremiumPayment || annualPayment.frequencyOfPayment) === "Half-yearly"
    ? "Half-Yearly"
    : (payment.frequencyOfPremiumPayment || annualPayment.frequencyOfPayment || "Payment");
  const paymentPeriodTitle = payment.paymentPeriodLabel || "Payment Period Covered";
  const policyNumber = policyholder.policyNumber || policySummary.policyNumber || "";

  const transferRows = [
    ["Total Premium Paid", formatAmount(payment.totalPremiumPaidPhp)],
    ["Frequency", payment.frequencyOfPremiumPayment || annualPayment.frequencyOfPayment || "—"],
    ["Payment Date", formatDateOnly(payment.paymentDate)],
    ["Payment Period Covered", payment.paymentPeriodLabel || "—"],
    ["Method", payment.methodForPayment || "—"],
    ["Saved At", formatDateOnly(payment.savedAt)],
  ];

  const eorRows = [
    ["eOR Number", payment.eorNumber || "—"],
    ["Receipt Date", formatDateOnly(payment.receiptDate)],
    ["Uploaded At", formatDateOnly(payment.uploadedAt)],
  ];

  const handleStartEorEdit = () => {
    setEorFieldErrors({});
    setEorForm(getInitialEorForm(payment));
    setIsEditingEor(true);
  };

  const handleCancelEorEdit = () => {
    setIsEditingEor(false);
    setEorFieldErrors({});
    setActivePreview((current) => (current === "eor" ? null : current));
    setIsEorConfirmOpen(false);
    setEorForm(getInitialEorForm(payment));
  };

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
          fileName: payment.eorFileName || eorForm.eorFileName,
          dataUrl: payment.eorFileDataUrl || eorForm.eorFileDataUrl,
          mimeType: payment.eorFileMimeType || eorForm.eorFileMimeType || "application/pdf",
          receiptDate: payment.receiptDate || eorForm.receiptDate,
        }
      : activePreview === "policy"
        ? {
            title: "Policy Summary Preview",
            fileName: policySummary.fileName,
            dataUrl: policySummary.fileDataUrl,
            mimeType: policySummary.mimeType || "application/pdf",
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
            <span className="ph-crumbCurrent">{paymentPeriodTitle} Payment Record</span>
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
                    <p className="ph-kicker">{frequencyLabel} Payment Record</p>
                    <h1 className="ph-name">{paymentPeriodTitle}</h1>
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
                            onClick={() => setActivePreview("policy")}
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
                  <span className={`ph-paymentStatus ${paymentStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                    {paymentStatus}
                  </span>
                </div>

                <section className="pay-summaryGrid" aria-label="Payment summary">
                  <div className="ph-summaryTile">
                    <span>Payment No.</span>
                    <strong>{paymentNumber}</strong>
                  </div>
                  <div className="ph-summaryTile pay-summaryTilePrimary">
                    <span>Total Premium Paid</span>
                    <strong>{formatAmount(payment.totalPremiumPaidPhp)}</strong>
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
                    </div>
                    <div className="pay-detailRows">
                      {transferRows.map(([label, value]) => (
                        <div key={label} className="pay-detailRow">
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                      <div className="pay-detailRow">
                        <span>Proof of Payment</span>
                        <strong>
                          {payment.proofOfPaymentFileDataUrl ? (
                            <button
                              type="button"
                              className="pay-fileLink"
                              onClick={() => setActivePreview("proof")}
                              title="Preview proof of payment"
                            >
                              {payment.proofOfPaymentFileName || "Proof of payment file"}
                            </button>
                          ) : (
                            payment.proofOfPaymentFileName || "—"
                          )}
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section className="pay-detailCard">
                    <div className="pay-detailCardHeader">
                      <h2>Premium Payment eOR</h2>
                      {canEditEor && !isEditingEor ? (
                        <button
                          type="button"
                          className="pay-editButton"
                          onClick={handleStartEorEdit}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                    {isEditingEor && canEditEor ? (
                      <form className="pay-eorForm" onSubmit={handleEorSubmit}>
                        <label className="pay-eorField">
                          <span>eOR Number *</span>
                          <input
                            type="text"
                            value={eorForm.eorNumber}
                            onChange={(event) => setEorForm((prev) => ({ ...prev, eorNumber: event.target.value }))}
                            disabled={savingEor}
                          />
                          {eorFieldErrors.eorNumber ? <small>{eorFieldErrors.eorNumber}</small> : null}
                        </label>
                        <label className="pay-eorField">
                          <span>Receipt Date *</span>
                          <input
                            type="date"
                            value={eorForm.receiptDate}
                            min={receiptDateMin || undefined}
                            max={receiptDateMax || undefined}
                            onChange={(event) => setEorForm((prev) => ({ ...prev, receiptDate: event.target.value }))}
                            disabled={savingEor}
                          />
                          {eorFieldErrors.receiptDate ? <small>{eorFieldErrors.receiptDate}</small> : null}
                        </label>
                        <div className="pay-eorField">
                          <span>eOR File (PDF) *</span>
                          <input type="file" accept="application/pdf" onChange={handleEorFileChange} disabled={savingEor} />
                          {eorForm.eorFileName ? (
                            <>
                              <p className="pay-selectedFile">Selected file: {eorForm.eorFileName}</p>
                              {eorForm.eorFileDataUrl ? (
                                <div className="pay-inlinePreview">
                                  <span>Preview</span>
                                  <iframe
                                    title="Selected eOR preview"
                                    src={eorForm.eorFileDataUrl}
                                    className="pay-inlinePreviewFrame"
                                  />
                                  <button type="button" className="pay-fileLink" onClick={() => setActivePreview("eor")} title="Open selected eOR preview">
                                    Open full preview
                                  </button>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                          {eorFieldErrors.eorFileDataUrl ? <small>{eorFieldErrors.eorFileDataUrl}</small> : null}
                        </div>
                        <div className="pay-eorActions">
                          <button type="button" className="pay-formAction pay-formAction--secondary" onClick={handleCancelEorEdit} disabled={savingEor}>
                            Cancel
                          </button>
                          <button type="submit" className="pay-formAction pay-formAction--primary" disabled={savingEor}>
                            {savingEor ? "Saving..." : "Save eOR"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="pay-detailRows">
                        {eorRows.map(([label, value]) => (
                          <div key={label} className="pay-detailRow">
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </div>
                        ))}
                        <div className="pay-detailRow">
                          <span>eOR File</span>
                          <strong>
                            {payment.eorFileDataUrl ? (
                              <button
                                type="button"
                                className="pay-fileLink"
                                onClick={() => setActivePreview("eor")}
                                title="Preview eOR file"
                              >
                                {payment.eorFileName || "eOR file"}
                              </button>
                            ) : (
                              payment.eorFileName || "—"
                            )}
                          </strong>
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                {isEorConfirmOpen ? (
                  <div className="pay-confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="pay-eor-confirm-title">
                    <div className="pay-confirmModal">
                      <button
                        type="button"
                        className="pay-confirmClose"
                        onClick={() => setIsEorConfirmOpen(false)}
                        aria-label="Close eOR confirmation"
                        title="Close"
                      >
                        ×
                      </button>
                      <h2 id="pay-eor-confirm-title">Confirm Premium Payment eOR</h2>
                      <p>Once confirmed, these eOR details will be saved and can no longer be edited thereafter.</p>
                      <div className="pay-confirmGrid">
                        <div><span>eOR Number</span><strong>{eorForm.eorNumber || "—"}</strong></div>
                        <div><span>Receipt Date</span><strong>{formatDateOnly(eorForm.receiptDate)}</strong></div>
                        <div><span>eOR File</span><strong>{eorForm.eorFileName || "—"}</strong></div>
                      </div>
                      <div className="pay-confirmActions">
                        <button type="button" className="pay-formAction pay-formAction--secondary" onClick={() => setIsEorConfirmOpen(false)} disabled={savingEor}>Cancel</button>
                        <button type="button" className="pay-formAction pay-formAction--primary" onClick={handleConfirmEorSave} disabled={savingEor}>{savingEor ? "Saving..." : "Confirm"}</button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {preview ? (
                  <div className="ph-previewOverlay" role="dialog" aria-modal="true" aria-labelledby="payment-file-preview-title">
                    <div className="ph-previewModal">
                      <div className="ph-previewHeader">
                        <div className="ph-previewInfo">
                          <h2 id="payment-file-preview-title" className="ph-previewTitle">{preview.title}</h2>
                          {activePreview === "policy" ? (
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
                          ) : activePreview === "proof" ? (
                            <div className="ph-previewMetaGrid">
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">Payment Date</span>
                                <strong className="ph-previewMetaValue">{formatDateOnly(payment.paymentDate)}</strong>
                              </div>
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">Method of Payment</span>
                                <strong className="ph-previewMetaValue">{payment.methodForPayment || "—"}</strong>
                              </div>
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">File Name</span>
                                <strong className="ph-previewMetaValue">{preview.fileName || "—"}</strong>
                              </div>
                            </div>
                          ) : (
                            <div className="ph-previewMetaGrid">
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">Receipt Date</span>
                                <strong className="ph-previewMetaValue">{formatDateOnly(preview.receiptDate)}</strong>
                              </div>
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">File Name</span>
                                <strong className="ph-previewMetaValue">{preview.fileName || "—"}</strong>
                              </div>
                            </div>
                          )}
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