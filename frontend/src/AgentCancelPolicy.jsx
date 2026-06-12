import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentCancelPolicy.css";

function AgentCancelPolicy() {
  const navigate = useNavigate();
  const { username, policyholderId } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const surrenderFormInputRef = useRef(null);
  const surrenderProofInputRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [details, setDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPolicySummaryPreviewOpen, setIsPolicySummaryPreviewOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    accomplishedPolicySurrenderFormFileName: "",
    accomplishedPolicySurrenderFormFileMimeType: "",
    accomplishedPolicySurrenderFormFileDataUrl: "",
    surrenderChargePhp: "",
    approvedCancellationDate: "",
    proofOfApprovedPolicySurrenderFileName: "",
    proofOfApprovedPolicySurrenderFileMimeType: "",
    proofOfApprovedPolicySurrenderImageDataUrl: "",
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
    if (user) document.title = `${user.username} | Cancel Policy`;
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

  const policyholder = details?.policyholder || {};
  const prospect = details?.prospect || {};
  const product = details?.product || {};
  const coverage = details?.coverage || {};
  const policySummary = details?.policySummary || {};
  const policySummaryFileDataUrl = String(policySummary.fileDataUrl || "").trim();

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

  const toDateInputValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const addDaysToDateInput = (dateInputValue, days) => {
    if (!dateInputValue) return "";
    const date = new Date(`${dateInputValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + days);
    return toDateInputValue(date);
  };

  const todayInputValue = toDateInputValue(new Date());
  const issuanceDateInputValue = toDateInputValue(coverage.policyIssuanceDate);
  const minCancellationDate = addDaysToDateInput(issuanceDateInputValue, 1);

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

  const handleSurrenderFormFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    setFieldErrors((prev) => ({ ...prev, accomplishedPolicySurrenderFormFileDataUrl: undefined }));
    if (!file) {
      setForm((prev) => ({
        ...prev,
        accomplishedPolicySurrenderFormFileName: "",
        accomplishedPolicySurrenderFormFileMimeType: "",
        accomplishedPolicySurrenderFormFileDataUrl: "",
      }));
      return;
    }

    if (file.type !== "application/pdf") {
      setForm((prev) => ({
        ...prev,
        accomplishedPolicySurrenderFormFileName: file.name,
        accomplishedPolicySurrenderFormFileMimeType: file.type,
        accomplishedPolicySurrenderFormFileDataUrl: "",
      }));
      setFieldErrors((prev) => ({
        ...prev,
        accomplishedPolicySurrenderFormFileDataUrl: "Accomplished policy surrender form must be a PDF.",
      }));
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setForm((prev) => ({
      ...prev,
      accomplishedPolicySurrenderFormFileName: file.name,
      accomplishedPolicySurrenderFormFileMimeType: file.type,
      accomplishedPolicySurrenderFormFileDataUrl: dataUrl,
    }));
  };

  const handleSurrenderProofFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    setFieldErrors((prev) => ({ ...prev, proofOfApprovedPolicySurrenderImageDataUrl: undefined }));
    if (!file) {
      setForm((prev) => ({
        ...prev,
        proofOfApprovedPolicySurrenderFileName: "",
        proofOfApprovedPolicySurrenderFileMimeType: "",
        proofOfApprovedPolicySurrenderImageDataUrl: "",
      }));
      return;
    }

    const looksImage = String(file.type || "").startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(String(file.name || ""));
    if (!looksImage) {
      setForm((prev) => ({
        ...prev,
        proofOfApprovedPolicySurrenderFileName: file.name,
        proofOfApprovedPolicySurrenderFileMimeType: file.type,
        proofOfApprovedPolicySurrenderImageDataUrl: "",
      }));
      setFieldErrors((prev) => ({
        ...prev,
        proofOfApprovedPolicySurrenderImageDataUrl: "Proof of approved policy surrender must be an image file.",
      }));
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setForm((prev) => ({
      ...prev,
      proofOfApprovedPolicySurrenderFileName: file.name,
      proofOfApprovedPolicySurrenderFileMimeType: file.type,
      proofOfApprovedPolicySurrenderImageDataUrl: dataUrl,
    }));
  };

  const validateForm = () => {
    const next = {};

    if (!form.accomplishedPolicySurrenderFormFileDataUrl) {
      next.accomplishedPolicySurrenderFormFileDataUrl = form.accomplishedPolicySurrenderFormFileName
        ? "Accomplished policy surrender form must be a PDF."
        : "Accomplished policy surrender form PDF is required.";
    } else if (!/^data:application\/pdf;base64,/i.test(form.accomplishedPolicySurrenderFormFileDataUrl)) {
      next.accomplishedPolicySurrenderFormFileDataUrl = "Accomplished policy surrender form must be a PDF.";
    }

    if (String(form.surrenderChargePhp || "").trim()) {
      const amount = Number(form.surrenderChargePhp);
      if (!Number.isFinite(amount) || amount < 0) {
        next.surrenderChargePhp = "Surrender charge must be a valid non-negative amount.";
      }
    }

    if (!form.approvedCancellationDate) {
      next.approvedCancellationDate = "Cancellation date is required.";
    } else if (!minCancellationDate) {
      next.approvedCancellationDate = "Policy issuance date is unavailable.";
    } else if (form.approvedCancellationDate < minCancellationDate) {
      next.approvedCancellationDate = "Approved cancellation date must be after the policy issuance date.";
    } else if (form.approvedCancellationDate > todayInputValue) {
      next.approvedCancellationDate = "Approved cancellation date cannot be in the future.";
    }

    if (!form.proofOfApprovedPolicySurrenderImageDataUrl) {
      next.proofOfApprovedPolicySurrenderImageDataUrl = form.proofOfApprovedPolicySurrenderFileName
        ? "Proof of approved policy surrender must be an image file."
        : "Proof of approved policy surrender image is required.";
    } else if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(form.proofOfApprovedPolicySurrenderImageDataUrl)) {
      next.proofOfApprovedPolicySurrenderImageDataUrl = "Proof of approved policy surrender must be an image file.";
    }

    return next;
  };

  const handleOpenConfirm = (event) => {
    event.preventDefault();
    const next = validateForm();
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    try {
      setSaving(true);
      setFieldErrors({});
      const res = await fetch(`http://localhost:5000/api/policyholders/${policyholderId}/cancellation?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setIsConfirmOpen(false);
        setFieldErrors(data.fieldErrors || {});
        setApiError(data.message || "Failed to save policy cancellation details.");
        return;
      }

      navigate(`/agent/${user.username}/policyholders/${policyholderId}`);
    } catch (err) {
      setIsConfirmOpen(false);
      setApiError("Cannot connect to server. Is backend running?");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/agent/${user.username}/policyholders/${policyholderId}`);
  };

  if (!isReady) return null;

  return (
    <div className="cancelpol-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="cancelpol-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="cancelpol-content">
          <div className="cancelpol-breadcrumb">
            <button type="button" className="cancelpol-crumbLink" onClick={() => navigate(`/agent/${user.username}/policyholders`)}>
              Policyholders
            </button>
            <span className="cancelpol-crumbSep">›</span>
            <button type="button" className="cancelpol-crumbLink" onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholderId}`)}>
              {policyholder.policyholderCode || "Policyholder Code"}
            </button>
            <span className="cancelpol-crumbSep">›</span>
            <span className="cancelpol-crumbCurrent">Cancel Policy</span>
          </div>

          <div className="cancelpol-card">
            {loading ? (
              <p className="cancelpol-note">Loading policy cancellation form...</p>
            ) : apiError && !details ? (
              <p className="cancelpol-note cancelpol-note--error">{apiError}</p>
            ) : (
              <>
                <div className="cancelpol-header">
                  <div>
                    <h1 className="cancelpol-title">Cancel Policy</h1>
                    <p className="cancelpol-subtitle">
                      {policyholder.policyholderCode || "—"} • {product.productName || "—"} • Policy Number:{" "}
                      {policyholder.policyNumber ? (
                        <button
                          type="button"
                          className="cancelpol-policyNumberLink"
                          onClick={() => setIsPolicySummaryPreviewOpen(true)}
                          title="Preview policy summary"
                        >
                          {policyholder.policyNumber}
                        </button>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <div className="cancelpol-summaryGrid">
                    <div className="cancelpol-summaryItem">
                      <span>Policyholder Name</span>
                      <strong>{prospect.fullName || "—"}</strong>
                    </div>
                    <div className="cancelpol-summaryItem">
                      <span>Policy Issuance Date</span>
                      <strong>{formatDateOnly(coverage.policyIssuanceDate)}</strong>
                    </div>
                  </div>
                </div>


                {apiError ? <p className="cancelpol-note cancelpol-note--error cancelpol-formError">{apiError}</p> : null}

                <form className="cancelpol-form" onSubmit={handleOpenConfirm}>
                  <div className="cancelpol-field">
                    <label htmlFor="approvedCancellationDate">Cancellation Date <span>*</span></label>
                    <input
                      id="approvedCancellationDate"
                      type="date"
                      min={minCancellationDate}
                      max={todayInputValue}
                      value={form.approvedCancellationDate}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, approvedCancellationDate: event.target.value }));
                        setFieldErrors((prev) => ({ ...prev, approvedCancellationDate: undefined }));
                      }}
                    />
                    {fieldErrors.approvedCancellationDate ? <p className="cancelpol-error">{fieldErrors.approvedCancellationDate}</p> : null}
                  </div>

                  <div className="cancelpol-field">
                    <label>Accomplished Policy Surrender Form (PDF) <span>*</span></label>
                    <input ref={surrenderFormInputRef} type="file" accept="application/pdf" onChange={handleSurrenderFormFileChange} />
                    {fieldErrors.accomplishedPolicySurrenderFormFileDataUrl ? (
                      <p className="cancelpol-error">{fieldErrors.accomplishedPolicySurrenderFormFileDataUrl}</p>
                    ) : null}
                    {form.accomplishedPolicySurrenderFormFileDataUrl ? (
                      <div className="cancelpol-filePreview">
                        <iframe title="Accomplished policy surrender form preview" src={form.accomplishedPolicySurrenderFormFileDataUrl} className="cancelpol-filePreviewFrame" />
                        <p className="cancelpol-filePreviewName">{form.accomplishedPolicySurrenderFormFileName || "Policy surrender form.pdf"}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="cancelpol-field">
                    <label htmlFor="surrenderChargePhp">Surrender Charge (PHP)</label>
                    <input
                      id="surrenderChargePhp"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.surrenderChargePhp}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, surrenderChargePhp: event.target.value }));
                        setFieldErrors((prev) => ({ ...prev, surrenderChargePhp: undefined }));
                      }}
                      placeholder="Optional"
                    />
                    {fieldErrors.surrenderChargePhp ? <p className="cancelpol-error">{fieldErrors.surrenderChargePhp}</p> : null}
                  </div>

                  <div className="cancelpol-field">
                    <label>Proof of Approved Policy Surrender (JPG, JPEG, PNG, GIF, WEBP, BMP, HEIC, HEIF) <span>*</span></label>
                    <input ref={surrenderProofInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,.heif" onChange={handleSurrenderProofFileChange} />
                    {fieldErrors.proofOfApprovedPolicySurrenderImageDataUrl ? (
                      <p className="cancelpol-error">{fieldErrors.proofOfApprovedPolicySurrenderImageDataUrl}</p>
                    ) : null}
                    {form.proofOfApprovedPolicySurrenderImageDataUrl ? (
                      <div className="cancelpol-filePreview cancelpol-filePreview--image">
                        <img src={form.proofOfApprovedPolicySurrenderImageDataUrl} alt="Proof of approved policy surrender preview" className="cancelpol-imagePreview" />
                        <p className="cancelpol-filePreviewName">{form.proofOfApprovedPolicySurrenderFileName || "Proof of approved surrender"}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="cancelpol-actions">
                    <button type="button" className="cancelpol-btn secondary" onClick={handleCancel} disabled={saving}>Cancel</button>
                    <button type="submit" className="cancelpol-btn primary" disabled={saving}>Save Cancellation Details</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </main>
      </div>

      {isPolicySummaryPreviewOpen ? (
        <div className="cancelpol-previewOverlay" role="dialog" aria-modal="true" aria-labelledby="cancel-policy-summary-preview-title">
          <div className="cancelpol-previewModal">
            <div className="cancelpol-previewModalHeader">
              <div className="cancelpol-previewInfo">
                <h2 id="cancel-policy-summary-preview-title" className="cancelpol-previewTitle">Policy Summary Preview</h2>
                <div className="cancelpol-previewMetaGrid">
                  <div className="cancelpol-previewMetaItem">
                    <span className="cancelpol-previewMetaLabel">Policyholder Code</span>
                    <strong className="cancelpol-previewMetaValue">{policyholder.policyholderCode || "—"}</strong>
                  </div>
                  <div className="cancelpol-previewMetaItem">
                    <span className="cancelpol-previewMetaLabel">Policyholder Name</span>
                    <strong className="cancelpol-previewMetaValue">{prospect.fullName || "—"}</strong>
                  </div>
                  <div className="cancelpol-previewMetaItem">
                    <span className="cancelpol-previewMetaLabel">Product Name</span>
                    <strong className="cancelpol-previewMetaValue">{product.productName || "—"}</strong>
                  </div>
                  <div className="cancelpol-previewMetaItem">
                    <span className="cancelpol-previewMetaLabel">Policy Number</span>
                    <strong className="cancelpol-previewMetaValue">{policyholder.policyNumber || policySummary.policyNumber || "—"}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="cancelpol-previewClose"
                onClick={() => setIsPolicySummaryPreviewOpen(false)}
                aria-label="Close policy summary preview"
                title="Close"
              >
                ×
              </button>
            </div>

            {policySummaryFileDataUrl ? (
              <iframe title="Policy Summary Preview" src={policySummaryFileDataUrl} className="cancelpol-previewFrame" />
            ) : (
              <div className="cancelpol-previewEmpty">
                <p className="cancelpol-note">No policy summary file is available for this policyholder yet.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isConfirmOpen ? (
        <div className="cancelpol-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="cancel-policy-confirm-title">
          <div className="cancelpol-modal">
            <div className="cancelpol-modalHeader">
              <h2 id="cancel-policy-confirm-title">Confirm Policy Cancellation</h2>
              <button type="button" className="cancelpol-modalClose" onClick={() => setIsConfirmOpen(false)} aria-label="Close confirmation" disabled={saving}>×</button>
            </div>
            <div className="cancelpol-confirmGrid">
              <div><span>Policyholder Code</span><strong>{policyholder.policyholderCode || "—"}</strong></div>
              <div><span>Policyholder Name</span><strong>{prospect.fullName || "—"}</strong></div>
              <div><span>Policy Name</span><strong>{product.productName || "—"}</strong></div>
              <div><span>Policy Number</span><strong>{policyholder.policyNumber || "—"}</strong></div>
              <div><span>Accomplished Surrender Form</span><strong>{form.accomplishedPolicySurrenderFormFileName || "—"}</strong></div>
              <div><span>Surrender Charge</span><strong>{form.surrenderChargePhp ? `PHP ${Number(form.surrenderChargePhp).toLocaleString()}` : "—"}</strong></div>
              <div><span>Cancellation Date</span><strong>{formatDateOnly(form.approvedCancellationDate)}</strong></div>
              <div><span>Proof of Approved Surrender</span><strong>{form.proofOfApprovedPolicySurrenderFileName || "—"}</strong></div>
            </div>
            <div className="cancelpol-modalActions">
              <button type="button" className="cancelpol-btn secondary" onClick={() => setIsConfirmOpen(false)} disabled={saving}>Close</button>
              <button type="button" className="cancelpol-btn primary" onClick={handleConfirmSave} disabled={saving}>{saving ? "Saving..." : "Confirm"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AgentCancelPolicy;
