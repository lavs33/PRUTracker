import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentAddPaymentRecord.css";

const API_BASE = "http://localhost:5000";
const PAYMENT_METHODS = ["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"];

function addMonthsPreservingDay(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== day) next.setDate(0);
  return next;
}

function formatPeriodDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function derivePaymentPeriodLabel(paymentDate, frequency) {
  const startDate = paymentDate ? new Date(paymentDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return "";
  const intervals = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 };
  const months = intervals[String(frequency || "").trim()] || 0;
  if (!months) return "";
  const endDate = addMonthsPreservingDay(startDate, months);
  endDate.setDate(endDate.getDate() - 1);
  return `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}`;
}

function AgentAddPaymentRecord() {
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
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [details, setDetails] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [activePreview, setActivePreview] = useState(null);
  const [activeStage, setActiveStage] = useState("transfer");
  const [savedPaymentId, setSavedPaymentId] = useState("");
  const [eorFieldErrors, setEorFieldErrors] = useState({});
  const [eorForm, setEorForm] = useState({
    eorNumber: "",
    receiptDate: new Date().toISOString().slice(0, 10),
    eorFileDataUrl: "",
    eorFileName: "",
    eorFileMimeType: "",
  });
  const [form, setForm] = useState({
    totalPremiumPaidPhp: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    methodForPayment: "",
    proofOfPaymentFileDataUrl: "",
    proofOfPaymentFileName: "",
    proofOfPaymentFileMimeType: "",
  });

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
    const frequency = details?.annualPayment?.frequencyOfPayment === "Half-yearly"
      ? "Half-Yearly"
      : (details?.annualPayment?.frequencyOfPayment || "Payment");
    document.title = `${user.username} | Add ${frequency} Payment Record`;
  }, [details?.annualPayment?.frequencyOfPayment, user]);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");
        const res = await fetch(`${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}?userId=${user.id}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setApiError(data.message || "Failed to fetch annual payment record.");
          setDetails(null);
          return;
        }
        setDetails(data);
        setActiveStage("transfer");
        setSavedPaymentId("");
        const annual = data?.annualPayment || {};
        const records = Array.isArray(data?.payments) ? data.payments : [];
        const totalCount = Number(annual?.paymentProgress?.totalCount || 0);
        const totalAnnual = Number(annual?.totalAnnualPremiumPhp || 0);
        const computedPremium = totalCount > 0 && Number.isFinite(totalAnnual) ? (totalAnnual / totalCount).toFixed(2) : "";
        const latestEndDate = records
          .map((payment) => payment?.paymentPeriod?.endDate ? new Date(payment.paymentPeriod.endDate) : null)
          .filter((date) => date && !Number.isNaN(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const fallbackStartDate = annual?.annualPaymentPeriod?.startDate ? new Date(annual.annualPaymentPeriod.startDate) : new Date();
        const nextPaymentDate = latestEndDate ? new Date(latestEndDate) : fallbackStartDate;
        if (latestEndDate) nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
        const methodForRenewalPayment = String(data?.application?.methodForRenewalPayment || "");
        setForm((prev) => ({
          ...prev,
          totalPremiumPaidPhp: computedPremium || prev.totalPremiumPaidPhp,
          paymentDate: !Number.isNaN(nextPaymentDate.getTime()) ? nextPaymentDate.toISOString().slice(0, 10) : prev.paymentDate,
          methodForPayment: methodForRenewalPayment || prev.methodForPayment,
        }));
        setEorForm((prev) => ({
          ...prev,
          receiptDate: !Number.isNaN(nextPaymentDate.getTime()) ? nextPaymentDate.toISOString().slice(0, 10) : prev.receiptDate,
        }));
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

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^(image\/(jpeg|png)|application\/pdf)$/i.test(file.type)) {
      setFieldErrors((prev) => ({ ...prev, proofOfPaymentFileDataUrl: "Proof of payment must be a JPG, PNG, or PDF file." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        proofOfPaymentFileDataUrl: String(reader.result || ""),
        proofOfPaymentFileName: file.name,
        proofOfPaymentFileMimeType: file.type,
      }));
      setFieldErrors((prev) => ({ ...prev, proofOfPaymentFileDataUrl: "" }));
    };
    reader.onerror = () => setFieldErrors((prev) => ({ ...prev, proofOfPaymentFileDataUrl: "Failed to read proof of payment file." }));
    reader.readAsDataURL(file);
  };

  const handleEorFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^application\/pdf$/i.test(file.type)) {
      setEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "eOR file must be a PDF." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEorForm((prev) => ({
        ...prev,
        eorFileDataUrl: String(reader.result || ""),
        eorFileName: file.name,
        eorFileMimeType: file.type,
      }));
      setEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "" }));
    };
    reader.onerror = () => setEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "Failed to read eOR file." }));
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const nextErrors = {};
    const amount = Number(form.totalPremiumPaidPhp);
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.totalPremiumPaidPhp = "Total premium paid is required.";
    if (!form.paymentDate) nextErrors.paymentDate = "Payment date is required.";
    if (!form.methodForPayment) nextErrors.methodForPayment = "Method of payment is required.";
    if (!form.proofOfPaymentFileDataUrl) nextErrors.proofOfPaymentFileDataUrl = "Proof of payment file is required.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate() || !user?.id) return;
    try {
      setSaving(true);
      setApiError("");
      const res = await fetch(`${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.message || "Failed to add payment record.");
        return;
      }
      setSavedPaymentId(String(data.paymentId || ""));
      setActiveStage("eor");
      setApiError("");
    } catch {
      setApiError("Cannot connect to server. Is backend running?");
    } finally {
      setSaving(false);
    }
  };

  const validateEor = () => {
    const nextErrors = {};
    if (!String(eorForm.eorNumber || "").trim()) nextErrors.eorNumber = "eOR number is required.";
    if (!eorForm.receiptDate) nextErrors.receiptDate = "Receipt date is required.";
    if (!eorForm.eorFileDataUrl) nextErrors.eorFileDataUrl = "eOR PDF file is required.";
    setEorFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEorSubmit = async (event) => {
    event.preventDefault();
    if (!savedPaymentId || !validateEor() || !user?.id) return;
    try {
      setSaving(true);
      setApiError("");
      const res = await fetch(`${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${savedPaymentId}/eor?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eorForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.message || "Failed to upload premium payment eOR.");
        return;
      }
      navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${savedPaymentId}`);
    } catch {
      setApiError("Cannot connect to server. Is backend running?");
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) return null;

  const policyholder = details?.policyholder || {};
  const prospect = details?.prospect || {};
  const product = details?.product || {};
  const annualPayment = details?.annualPayment || {};
  const policySummary = details?.policySummary || {};
  const frequencyLabel = annualPayment.frequencyOfPayment === "Half-yearly" ? "Half-Yearly" : (annualPayment.frequencyOfPayment || "Payment");
  const paymentPeriodLabel = derivePaymentPeriodLabel(form.paymentDate, annualPayment.frequencyOfPayment);
  const policyNumber = policyholder.policyNumber || policySummary.policyNumber || "";
  const preview = activePreview === "policy"
    ? {
        title: "Policy Summary Preview",
        fileName: policySummary.fileName,
        dataUrl: policySummary.fileDataUrl,
        mimeType: policySummary.mimeType || "application/pdf",
      }
    : activePreview === "proof"
      ? {
          title: "Proof of Payment Preview",
          fileName: form.proofOfPaymentFileName,
          dataUrl: form.proofOfPaymentFileDataUrl,
          mimeType: form.proofOfPaymentFileMimeType,
        }
      : activePreview === "eor"
        ? {
            title: "Premium Payment eOR Preview",
            fileName: eorForm.eorFileName,
            dataUrl: eorForm.eorFileDataUrl,
            mimeType: eorForm.eorFileMimeType || "application/pdf",
          }
        : null;

  const renderPreviewContent = () => {
    if (!preview?.dataUrl) {
      return <div className="ph-previewEmpty"><p>No file is available for preview.</p></div>;
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
            <button type="button" className="ph-crumbLink" onClick={() => navigate(`/agent/${user.username}/policyholders`)}>Policyholders</button>
            <span className="ph-crumbSep">›</span>
            <button type="button" className="ph-crumbLink" onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholderId}`)}>
              {policyholder.policyholderCode || "Policyholder"}
            </button>
            <span className="ph-crumbSep">›</span>
            <button type="button" className="ph-crumbLink" onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}`)}>
              {annualPayment.label || "Annual Payment Period"} Payment Record
            </button>
            <span className="ph-crumbSep">›</span>
            <span className="ph-crumbCurrent">Add {frequencyLabel} Payment Record</span>
          </div>

          <div className="ph-card">
            {loading ? (
              <p className="ph-note">Loading annual payment record...</p>
            ) : apiError && !details ? (
              <p className="ph-note ph-note--error">{apiError}</p>
            ) : (
              <>
                <div className="addpay-hero">
                  <div>
                    <p className="ph-kicker">Add {frequencyLabel} Payment Record</p>
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
                </div>

                <div className="addpay-pipeline" aria-label="Add payment record progress">
                  <button type="button" className={`addpay-stage ${activeStage === "transfer" ? "is-active" : ""} ${savedPaymentId ? "is-complete" : ""}`} onClick={() => setActiveStage("transfer")}>
                    <span>1</span>
                    <strong>Record Premium Payment Transfer</strong>
                  </button>
                  <div className="addpay-stageLine" />
                  <button type="button" className={`addpay-stage ${activeStage === "eor" ? "is-active" : ""}`} disabled={!savedPaymentId} onClick={() => savedPaymentId && setActiveStage("eor")}>
                    <span>2</span>
                    <strong>Upload Premium Payment eOR</strong>
                  </button>
                </div>

                {apiError ? <p className="ph-note ph-note--error addpay-error">{apiError}</p> : null}

                {activeStage === "transfer" ? (
                <form className="addpay-form" onSubmit={handleSubmit}>
                  <label className="addpay-field">
                    <span>Total Premium Paid (Php) *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.totalPremiumPaidPhp}
                      readOnly
                    />
                    {fieldErrors.totalPremiumPaidPhp ? <small>{fieldErrors.totalPremiumPaidPhp}</small> : null}
                  </label>

                  <label className="addpay-field">
                    <span>Frequency of Payment</span>
                    <input type="text" value={annualPayment.frequencyOfPayment || ""} readOnly />
                  </label>

                  <label className="addpay-field">
                    <span>Payment Date *</span>
                    <input
                      type="date"
                      value={form.paymentDate}
                      readOnly
                    />
                    {fieldErrors.paymentDate ? <small>{fieldErrors.paymentDate}</small> : null}
                  </label>

                  <label className="addpay-field">
                    <span>Payment Period Covered</span>
                    <input type="text" value={paymentPeriodLabel || "—"} readOnly />
                  </label>

                  <label className="addpay-field">
                    <span>Method of Payment *</span>
                    <select value={form.methodForPayment} disabled={Boolean(savedPaymentId)} onChange={(event) => setForm((prev) => ({ ...prev, methodForPayment: event.target.value }))}>
                      <option value="">Select method</option>
                      {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                    {fieldErrors.methodForPayment ? <small>{fieldErrors.methodForPayment}</small> : null}
                  </label>

                  <label className="addpay-field addpay-fileField">
                    <span>Proof of Payment *</span>
                    <input type="file" accept="image/jpeg,image/png,application/pdf" disabled={Boolean(savedPaymentId)} onChange={handleFileChange} />
                    {form.proofOfPaymentFileName ? (
                      <button
                        type="button"
                        className="addpay-filePreview"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setActivePreview("proof");
                        }}
                        title="Preview proof of payment"
                      >
                        Selected: {form.proofOfPaymentFileName}
                      </button>
                    ) : null}
                    {fieldErrors.proofOfPaymentFileDataUrl ? <small>{fieldErrors.proofOfPaymentFileDataUrl}</small> : null}
                  </label>

                  <div className="addpay-actions">
                    <button type="button" className="addpay-secondary" onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}`)}>
                      Cancel
                    </button>
                    <button type="submit" className="addpay-primary" disabled={saving || Boolean(savedPaymentId)}>
                      {savedPaymentId ? "Premium Payment Transfer Saved" : (saving ? "Saving..." : "Save Premium Payment Transfer")}
                    </button>
                  </div>
                </form>
                ) : (
                <form className="addpay-form" onSubmit={handleEorSubmit}>
                  <div className="addpay-stageNotice">
                    <strong>Premium payment transfer saved.</strong> Upload the eOR to finish this {frequencyLabel} payment record.
                  </div>

                  <label className="addpay-field">
                    <span>eOR Number *</span>
                    <input
                      type="text"
                      value={eorForm.eorNumber}
                      onChange={(event) => setEorForm((prev) => ({ ...prev, eorNumber: event.target.value }))}
                    />
                    {eorFieldErrors.eorNumber ? <small>{eorFieldErrors.eorNumber}</small> : null}
                  </label>

                  <label className="addpay-field">
                    <span>Receipt Date *</span>
                    <input
                      type="date"
                      value={eorForm.receiptDate}
                      onChange={(event) => setEorForm((prev) => ({ ...prev, receiptDate: event.target.value }))}
                    />
                    {eorFieldErrors.receiptDate ? <small>{eorFieldErrors.receiptDate}</small> : null}
                  </label>

                  <label className="addpay-field addpay-fileField">
                    <span>eOR File (PDF) *</span>
                    <input type="file" accept="application/pdf" onChange={handleEorFileChange} />
                    {eorForm.eorFileName ? (
                      <button
                        type="button"
                        className="addpay-filePreview"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setActivePreview("eor");
                        }}
                        title="Preview eOR file"
                      >
                        Selected: {eorForm.eorFileName}
                      </button>
                    ) : null}
                    {eorFieldErrors.eorFileDataUrl ? <small>{eorFieldErrors.eorFileDataUrl}</small> : null}
                  </label>

                  <div className="addpay-actions">
                    <button type="button" className="addpay-secondary" onClick={() => setActiveStage("transfer")}>
                      Back
                    </button>
                    <button type="submit" className="addpay-primary" disabled={saving}>
                      {saving ? "Saving..." : "Save Premium Payment eOR"}
                    </button>
                  </div>
                </form>
                )}

                {preview ? (
                  <div className="ph-previewOverlay" role="dialog" aria-modal="true" aria-labelledby="add-payment-preview-title">
                    <div className="ph-previewModal">
                      <div className="ph-previewHeader">
                        <div className="ph-previewInfo">
                          <h2 id="add-payment-preview-title" className="ph-previewTitle">{preview.title}</h2>
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
                          ) : activePreview === "eor" ? (
                            <div className="ph-previewMetaGrid">
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">Receipt Date</span>
                                <strong className="ph-previewMetaValue">{eorForm.receiptDate || "—"}</strong>
                              </div>
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">File Name</span>
                                <strong className="ph-previewMetaValue">{preview.fileName || "—"}</strong>
                              </div>
                            </div>
                          ) : (
                            <div className="ph-previewMetaGrid">
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">Payment Date</span>
                                <strong className="ph-previewMetaValue">{form.paymentDate || "—"}</strong>
                              </div>
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">Method of Payment</span>
                                <strong className="ph-previewMetaValue">{form.methodForPayment || "—"}</strong>
                              </div>
                              <div className="ph-previewMetaItem">
                                <span className="ph-previewMetaLabel">File Name</span>
                                <strong className="ph-previewMetaValue">{preview.fileName || "—"}</strong>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="ph-previewActions">
                          <button type="button" className="ph-previewClose" onClick={() => setActivePreview(null)} aria-label="Close preview" title="Close">×</button>
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

export default AgentAddPaymentRecord;
