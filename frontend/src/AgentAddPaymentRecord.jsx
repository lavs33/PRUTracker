import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentAddPaymentRecord.css";

const API_BASE = "http://localhost:5000";
const PAYMENT_METHODS = ["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"];
function getDataUrlMimeType(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)[;,]/i);
  return match?.[1] || "";
}

function isSupportedProofFile(file) {
  const mimeType = String(file?.type || "");
  const fileName = String(file?.name || "");
  return /^(image\/(jpeg|png)|application\/pdf)$/i.test(mimeType) || /\.(jpe?g|png|pdf)$/i.test(fileName);
}

function getProofFileMimeType(file, dataUrl = "") {
  const mimeType = String(file?.type || "");
  if (/^(image\/(jpeg|png)|application\/pdf)$/i.test(mimeType)) return mimeType;
  const fileName = String(file?.name || "").toLowerCase();
  if (fileName.endsWith(".pdf")) return "application/pdf";
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
  return getDataUrlMimeType(dataUrl);
}

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

function derivePaymentPeriodLabel(paymentPeriodStartDate, frequency) {
  const startDate = paymentPeriodStartDate ? new Date(paymentPeriodStartDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return "";
  const intervals = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 };
  const months = intervals[String(frequency || "").trim()] || 0;
  if (!months) return "";
  const endDate = addMonthsPreservingDay(startDate, months);
  endDate.setDate(endDate.getDate() - 1);
  return `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}`;
}

function deriveMissedPaymentPeriod(paymentPeriodStartDate, frequency, paymentDate, maxCount = 12) {
  const startDate = paymentPeriodStartDate ? new Date(paymentPeriodStartDate) : null;
  const actualPaymentDate = paymentDate ? new Date(paymentDate) : null;
  const intervals = { Monthly: 1, Quarterly: 3, "Half-yearly": 6, Yearly: 12 };
  const months = intervals[String(frequency || "").trim()] || 0;
  if (!startDate || Number.isNaN(startDate.getTime()) || !actualPaymentDate || Number.isNaN(actualPaymentDate.getTime()) || !months) {
    return { label: derivePaymentPeriodLabel(paymentPeriodStartDate, frequency), count: 1 };
  }
  let count = 1;
  let endDate = addMonthsPreservingDay(startDate, months);
  endDate.setDate(endDate.getDate() - 1);
  while (actualPaymentDate > endDate && count < Math.max(1, Number(maxCount || 1))) {
    const nextStart = addDays(endDate, 1);
    endDate = addMonthsPreservingDay(nextStart, months);
    endDate.setDate(endDate.getDate() - 1);
    count += 1;
  }
  return { label: `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}`, count };
}

function toDateInputValue(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeTransferForm(form = {}) {
  return {
    totalPremiumPaidPhp: String(form.totalPremiumPaidPhp || ""),
    paymentDate: String(form.paymentDate || ""),
    methodForPayment: String(form.methodForPayment || ""),
    proofOfPaymentFileDataUrl: String(form.proofOfPaymentFileDataUrl || ""),
    proofOfPaymentFileName: String(form.proofOfPaymentFileName || ""),
    proofOfPaymentFileMimeType: String(form.proofOfPaymentFileMimeType || ""),
    overdueFeePhp: String(form.overdueFeePhp || ""),
  };
}

function areTransferFormsEqual(left, right) {
  const a = normalizeTransferForm(left);
  const b = normalizeTransferForm(right);
  return Object.keys(a).every((key) => a[key] === b[key]);
}

function AgentAddPaymentRecord() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, policyholderId, annualPaymentId } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);
  const isMissedPaymentRecord = new URLSearchParams(location.search).get("missed") === "1";

  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [details, setDetails] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [paymentDateBounds, setPaymentDateBounds] = useState({ min: "", max: "" });
  const [paymentPeriodStartDate, setPaymentPeriodStartDate] = useState("");
  const [basePremiumAmount, setBasePremiumAmount] = useState(0);
  const [activePreview, setActivePreview] = useState(null);
  const [activeStage, setActiveStage] = useState("transfer");
  const [savedPaymentId, setSavedPaymentId] = useState("");
  const [savedTransferForm, setSavedTransferForm] = useState(null);
  const [isEorConfirmOpen, setIsEorConfirmOpen] = useState(false);
  const [isPendingTransferConfirmOpen, setIsPendingTransferConfirmOpen] = useState(false);
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
    overdueFeePhp: "",
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
    document.title = `${user.username} | ${isMissedPaymentRecord ? "Add Missed Payment Record" : `Add ${frequency} Payment Record`}`;
  }, [details?.annualPayment?.frequencyOfPayment, isMissedPaymentRecord, user]);

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
        setSavedTransferForm(null);
        setIsEorConfirmOpen(false);
        setIsPendingTransferConfirmOpen(false);
        const annual = data?.annualPayment || {};
        const records = Array.isArray(data?.payments) ? data.payments : [];
        const totalCount = Number(annual?.paymentProgress?.totalCount || 0);
        const totalAnnual = Number(annual?.totalAnnualPremiumPhp || 0);
        const computedPremium = totalCount > 0 && Number.isFinite(totalAnnual) ? (totalAnnual / totalCount).toFixed(2) : "";
        setBasePremiumAmount(Number(computedPremium || 0));
        const latestEndDate = records
          .map((payment) => payment?.paymentPeriod?.endDate ? new Date(payment.paymentPeriod.endDate) : null)
          .filter((date) => date && !Number.isNaN(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const fallbackStartDate = annual?.annualPaymentPeriod?.startDate ? new Date(annual.annualPaymentPeriod.startDate) : new Date();
        const nextPaymentPeriodStart = latestEndDate ? addDays(latestEndDate, 1) : fallbackStartDate;
        const latestPaymentDate = records
          .map((payment) => payment?.paymentDate ? new Date(payment.paymentDate) : null)
          .filter((date) => date && !Number.isNaN(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const policyholderLastPaidDate = data?.policyholder?.lastPaidDate ? new Date(data.policyholder.lastPaidDate) : null;
        const lastActualPaymentDate = [latestPaymentDate, policyholderLastPaidDate]
          .filter((date) => date && !Number.isNaN(date.getTime()))
          .sort((a, b) => b.getTime() - a.getTime())[0] || null;
        const atRiskPaymentDate = nextPaymentPeriodStart ? addDays(nextPaymentPeriodStart, 1) : null;
        const minPaymentDate = isMissedPaymentRecord
          ? toDateInputValue(atRiskPaymentDate)
          : (lastActualPaymentDate ? toDateInputValue(lastActualPaymentDate) : "");
        const defaultPaymentDate = minPaymentDate || toDateInputValue(new Date());
        setPaymentDateBounds({ min: minPaymentDate, max: "" });
        setPaymentPeriodStartDate(toDateInputValue(nextPaymentPeriodStart));
        const methodForRenewalPayment = String(data?.application?.methodForRenewalPayment || "");
        setForm((prev) => ({
          ...prev,
          totalPremiumPaidPhp: computedPremium || prev.totalPremiumPaidPhp,
          paymentDate: defaultPaymentDate || prev.paymentDate,
          methodForPayment: methodForRenewalPayment || prev.methodForPayment,
        }));
        setEorForm((prev) => ({
          ...prev,
          receiptDate: defaultPaymentDate || prev.receiptDate,
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
  }, [isReady, user?.id, policyholderId, annualPaymentId, isMissedPaymentRecord]);

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
    if (!isSupportedProofFile(file)) {
      setFieldErrors((prev) => ({ ...prev, proofOfPaymentFileDataUrl: "Proof of payment must be a JPG, PNG, or PDF file." }));
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setForm((prev) => ({
        ...prev,
        proofOfPaymentFileDataUrl: dataUrl,
        proofOfPaymentFileName: file.name,
        proofOfPaymentFileMimeType: getProofFileMimeType(file, dataUrl),
      }));
      setFieldErrors((prev) => ({ ...prev, proofOfPaymentFileDataUrl: "" }));
    };
    reader.onerror = () => setFieldErrors((prev) => ({ ...prev, proofOfPaymentFileDataUrl: "Failed to read proof of payment file." }));
    reader.readAsDataURL(file);
  };

  const handleEorFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^application\/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name || "")) {
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

  const validate = () => {
    const nextErrors = {};
    const amount = Number(form.totalPremiumPaidPhp);
    const overdueFee = Number(form.overdueFeePhp || 0);
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.totalPremiumPaidPhp = "Total premium paid is required.";
    if (isMissedPaymentRecord && (!Number.isFinite(overdueFee) || overdueFee < 0)) nextErrors.overdueFeePhp = "Overdue fee must be zero or a positive amount.";
    if (!form.paymentDate) nextErrors.paymentDate = "Payment date is required.";
    if (form.paymentDate && paymentDateBounds.min && form.paymentDate < paymentDateBounds.min) {
      nextErrors.paymentDate = isMissedPaymentRecord
        ? "Payment date must be on or after the day the policyholder became at risk."
        : "Payment date must be on or after the last payment date.";
    }
    if (!form.methodForPayment) nextErrors.methodForPayment = "Method of payment is required.";
    if (!form.proofOfPaymentFileDataUrl) nextErrors.proofOfPaymentFileDataUrl = "Proof of payment file is required.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate() || !user?.id) return;
    const isUpdatingTransfer = Boolean(savedPaymentId);
    if (isUpdatingTransfer && areTransferFormsEqual(form, savedTransferForm)) return;
    try {
      setSaving(true);
      setApiError("");
      const url = isUpdatingTransfer
        ? `${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${savedPaymentId}/transfer?userId=${user.id}`
        : `${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments?userId=${user.id}`;
      const res = await fetch(url, {
        method: isUpdatingTransfer ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isMissedPaymentRecord }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.message || (isUpdatingTransfer ? "Failed to update payment transfer." : "Failed to add payment record."));
        return;
      }
      const nextPaymentId = String(data.paymentId || savedPaymentId || "");
      setSavedPaymentId(nextPaymentId);
      setSavedTransferForm(normalizeTransferForm(form));
      setEorForm((prev) => ({
        ...prev,
        receiptDate: prev.receiptDate && prev.receiptDate >= form.paymentDate ? prev.receiptDate : form.paymentDate,
      }));
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
    if (eorForm.receiptDate && form.paymentDate && eorForm.receiptDate < form.paymentDate) {
      nextErrors.receiptDate = "Receipt date cannot be before the payment date.";
    }
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
      const encodedEorNumber = encodeURIComponent(String(eorForm.eorNumber || "").trim());
      const res = await fetch(`${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${savedPaymentId}/eor-duplicate?userId=${user.id}&eorNumber=${encodedEorNumber}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.message || "Failed to validate eOR number.";
        if (message.includes("eOR number")) setEorFieldErrors((prev) => ({ ...prev, eorNumber: message }));
        else setApiError(message);
        return;
      }
      if (data.duplicate) {
        setEorFieldErrors((prev) => ({ ...prev, eorNumber: "Record already exists for this eOR number." }));
        return;
      }
      setIsEorConfirmOpen(true);
    } catch {
      setApiError("Cannot connect to server. Is backend running?");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmEorSave = async () => {
    if (!savedPaymentId || !user?.id) return;
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
        setIsEorConfirmOpen(false);
        setIsPendingTransferConfirmOpen(false);
        const message = data.message || "Failed to upload premium payment eOR.";
        if (message.includes("already exists")) {
          setEorFieldErrors((prev) => ({ ...prev, eorNumber: "Record already exists for this eOR number." }));
          setApiError("");
        } else {
          setApiError(message);
        }
        return;
      }
      navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${savedPaymentId}`);
    } catch {
      setIsEorConfirmOpen(false);
      setApiError("Cannot connect to server. Is backend running?");
    } finally {
      setSaving(false);
    }
  };

  const handleEorUnavailable = () => {
    if (!savedPaymentId) return;
    setIsPendingTransferConfirmOpen(true);
  };

  const handleConfirmPendingTransfer = async () => {
    if (!savedPaymentId || !user?.id) return;
    try {
      setSaving(true);
      setApiError("");
      const res = await fetch(`${API_BASE}/api/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${savedPaymentId}/eor-reminder?userId=${user.id}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIsPendingTransferConfirmOpen(false);
        setApiError(data.message || "Failed to save transfer-only payment status.");
        return;
      }
      navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${savedPaymentId}`);
    } catch {
      setIsPendingTransferConfirmOpen(false);
      setApiError("Cannot connect to server. Is backend running?");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTransferEdits = () => {
    if (!savedPaymentId || !savedTransferForm) {
      navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}`);
      return;
    }
    setForm(savedTransferForm);
    setFieldErrors({});
    setActiveStage("eor");
  };


  const policyholder = details?.policyholder || {};
  const prospect = details?.prospect || {};
  const product = details?.product || {};
  const annualPayment = details?.annualPayment || {};
  const policySummary = details?.policySummary || {};
  const frequencyLabel = annualPayment.frequencyOfPayment === "Half-yearly" ? "Half-Yearly" : (annualPayment.frequencyOfPayment || "Payment");
  const remainingPaymentCount = Math.max(1, Number(annualPayment?.paymentProgress?.totalCount || 1) - Number(annualPayment?.paymentProgress?.paidCount || 0));
  const missedPaymentPeriod = deriveMissedPaymentPeriod(paymentPeriodStartDate, annualPayment.frequencyOfPayment, form.paymentDate, remainingPaymentCount);
  const paymentPeriodLabel = isMissedPaymentRecord ? missedPaymentPeriod.label : derivePaymentPeriodLabel(paymentPeriodStartDate, annualPayment.frequencyOfPayment);
  const policyNumber = policyholder.policyNumber || policySummary.policyNumber || "";

  useEffect(() => {
    if (!isMissedPaymentRecord) return;
    const count = Number(missedPaymentPeriod.count || 1);
    const total = Math.round((Number(basePremiumAmount || 0) * Math.max(1, count)) * 100) / 100;
    setForm((prev) => {
      const nextTotal = total > 0 ? total.toFixed(2) : prev.totalPremiumPaidPhp;
      return String(prev.totalPremiumPaidPhp) === String(nextTotal) ? prev : { ...prev, totalPremiumPaidPhp: nextTotal };
    });
  }, [basePremiumAmount, isMissedPaymentRecord, missedPaymentPeriod.count]);

  if (!isReady) return null;
  const proofMimeType = form.proofOfPaymentFileMimeType || getDataUrlMimeType(form.proofOfPaymentFileDataUrl);
  const isProofImage = String(proofMimeType || "").startsWith("image/");
  const isTransferDirty = savedPaymentId ? !areTransferFormsEqual(form, savedTransferForm) : true;
  const eorReceiptDateMin = form.paymentDate || "";
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
          mimeType: proofMimeType,
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
    const mimeType = preview.mimeType || getDataUrlMimeType(preview.dataUrl);
    if (String(mimeType || "").startsWith("image/")) {
      return <img src={preview.dataUrl} alt={preview.fileName || preview.title} className="pay-previewImage" />;
    }
    return <iframe title={preview.title} src={preview.dataUrl} className="ph-previewFrame" />;
  };

  const handlePreviewButtonClick = (event, previewType) => {
    event.preventDefault();
    event.stopPropagation();
    setActivePreview(previewType);
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
            <span className="ph-crumbCurrent">{isMissedPaymentRecord ? "Add Missed Payment Record" : `Add ${frequencyLabel} Payment Record`}</span>
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
                    <p className="ph-kicker">{isMissedPaymentRecord ? "Add Missed Payment Record" : `Add ${frequencyLabel} Payment Record`}</p>
                    <h1 className="ph-name">{paymentPeriodLabel || annualPayment.label || "Payment Period Covered"}</h1>
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
                    {isMissedPaymentRecord ? <small>Computed for the covered payment periods: {paymentPeriodLabel || "—"}. This includes {missedPaymentPeriod.count || 1} payment period(s). Overdue fees are stored separately and are not included in this premium amount.</small> : null}
                    {fieldErrors.totalPremiumPaidPhp ? <small>{fieldErrors.totalPremiumPaidPhp}</small> : null}
                  </label>

                  {isMissedPaymentRecord ? (
                    <label className="addpay-field">
                      <span>Overdue Fee (Php) (Optional)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.overdueFeePhp}
                        onChange={(event) => setForm((prev) => ({ ...prev, overdueFeePhp: event.target.value }))}
                        placeholder="0.00"
                      />
                      {fieldErrors.overdueFeePhp ? <small>{fieldErrors.overdueFeePhp}</small> : null}
                    </label>
                  ) : null}

                  <label className="addpay-field">
                    <span>Frequency of Payment</span>
                    <input type="text" value={annualPayment.frequencyOfPayment || ""} readOnly />
                  </label>

                  <label className="addpay-field">
                    <span>Payment Date *</span>
                    <input
                      type="date"
                      value={form.paymentDate}
                      min={paymentDateBounds.min || undefined}
                      onChange={(event) => setForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                    />
                    {fieldErrors.paymentDate ? <small>{fieldErrors.paymentDate}</small> : null}
                  </label>

                  <label className="addpay-field">
                    <span>Payment Period Covered</span>
                    <input type="text" value={paymentPeriodLabel || "—"} readOnly />
                  </label>

                  <label className="addpay-field">
                    <span>Method of Payment *</span>
                    <select value={form.methodForPayment} onChange={(event) => setForm((prev) => ({ ...prev, methodForPayment: event.target.value }))}>
                      <option value="">Select method</option>
                      {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                    {fieldErrors.methodForPayment ? <small>{fieldErrors.methodForPayment}</small> : null}
                  </label>

                  <div className="addpay-field addpay-fileField">
                    <span>Proof of Payment *</span>
                    <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} />
                    {form.proofOfPaymentFileName ? (
                      <p className="addpay-fileName">Selected file: {form.proofOfPaymentFileName}</p>
                    ) : null}
                    {isProofImage && form.proofOfPaymentFileDataUrl ? (
                      <div className="addpay-inlinePreview">
                        <span>Preview</span>
                        <img
                          src={form.proofOfPaymentFileDataUrl}
                          alt="Proof of payment preview"
                          className="addpay-inlinePreviewImage"
                        />
                      </div>
                    ) : form.proofOfPaymentFileDataUrl ? (
                      <button
                        type="button"
                        className="addpay-filePreview"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => handlePreviewButtonClick(event, "proof")}
                        title="Preview proof of payment PDF"
                      >
                        Preview PDF
                      </button>
                    ) : null}
                    {fieldErrors.proofOfPaymentFileDataUrl ? <small>{fieldErrors.proofOfPaymentFileDataUrl}</small> : null}
                  </div>

                  <div className="addpay-actions">
                    <button type="button" className="addpay-secondary" onClick={handleCancelTransferEdits} disabled={Boolean(savedPaymentId) && !isTransferDirty}>
                      {savedPaymentId ? "Cancel Edits" : "Cancel"}
                    </button>
                    <button type="submit" className="addpay-primary" disabled={saving || (Boolean(savedPaymentId) && !isTransferDirty)}>
                      {saving ? "Saving..." : (savedPaymentId ? "Save Transfer Edits" : "Save Premium Payment Transfer")}
                    </button>
                  </div>
                </form>
                ) : (
                <form className="addpay-form" onSubmit={handleEorSubmit}>
                  <div className="addpay-transferSummary">
                    <div>
                      <span>Payment Date</span>
                      <strong>{form.paymentDate || "—"}</strong>
                    </div>
                    <div>
                      <span>Payment Period Covered</span>
                      <strong>{paymentPeriodLabel || "—"}</strong>
                    </div>
                    <div>
                      <span>Method of Payment</span>
                      <strong>{form.methodForPayment || "—"}</strong>
                    </div>
                    <div>
                      <span>Proof of Payment</span>
                      {form.proofOfPaymentFileName ? (
                        <button
                          type="button"
                          className="addpay-filePreview"
                          onClick={(event) => handlePreviewButtonClick(event, "proof")}
                          title="Preview proof of payment"
                        >
                          Selected file: {form.proofOfPaymentFileName}
                        </button>
                      ) : (
                        <strong>—</strong>
                      )}
                    </div>
                  </div>

                  <label className="addpay-field">
                    <span>eOR Number *</span>
                    <input
                      type="text"
                      value={eorForm.eorNumber}
                      onChange={(event) => {
                        setEorForm((prev) => ({ ...prev, eorNumber: event.target.value }));
                        setEorFieldErrors((prev) => ({ ...prev, eorNumber: "" }));
                      }}
                    />
                    {eorFieldErrors.eorNumber ? <small>{eorFieldErrors.eorNumber}</small> : null}
                  </label>

                  <label className="addpay-field">
                    <span>Receipt Date *</span>
                    <input
                      type="date"
                      value={eorForm.receiptDate}
                      min={eorReceiptDateMin || undefined}
                      onChange={(event) => setEorForm((prev) => ({ ...prev, receiptDate: event.target.value }))}
                    />
                    {eorFieldErrors.receiptDate ? <small>{eorFieldErrors.receiptDate}</small> : null}
                  </label>

                  <div className="addpay-field addpay-fileField">
                    <span>eOR File (PDF) *</span>
                    <input type="file" accept="application/pdf" onChange={handleEorFileChange} />
                    {eorForm.eorFileName ? (
                      <>
                        <p className="addpay-fileName">Selected file: {eorForm.eorFileName}</p>
                        {eorForm.eorFileDataUrl ? (
                          <div className="addpay-inlinePreview">
                            <span>Preview</span>
                            <iframe title="Selected eOR preview" src={eorForm.eorFileDataUrl} className="addpay-inlinePreviewFrame" />
                            <button
                              type="button"
                              className="addpay-filePreview"
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => handlePreviewButtonClick(event, "eor")}
                              title="Open selected eOR preview"
                            >
                              Open full preview
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {eorFieldErrors.eorFileDataUrl ? <small>{eorFieldErrors.eorFileDataUrl}</small> : null}
                  </div>

                  <div className="addpay-actions">
                    <button type="button" className="addpay-secondary" onClick={handleEorUnavailable} disabled={saving}>
                      eOR Not Available Yet
                    </button>
                    <button type="submit" className="addpay-primary" disabled={saving}>
                      {saving ? "Saving..." : "Save eOR"}
                    </button>
                  </div>
                </form>
                )}

                {isPendingTransferConfirmOpen ? (
                  <div className="addpay-confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="addpay-transfer-confirm-title">
                    <div className="addpay-confirmModal">
                      <button
                        type="button"
                        className="addpay-confirmClose"
                        onClick={() => setIsPendingTransferConfirmOpen(false)}
                        aria-label="Close transfer confirmation"
                        title="Close"
                      >
                        ×
                      </button>
                      <h2 id="addpay-transfer-confirm-title">Save Transfer Details for Now?</h2>
                      <p>The premium payment transfer details will remain saved with pending status until the eOR is uploaded.</p>
                      <div className="addpay-confirmGrid">
                        <div><span>Total Premium Paid</span><strong>Php {form.totalPremiumPaidPhp || "—"}</strong></div>
                        <div><span>Frequency</span><strong>{annualPayment.frequencyOfPayment || "—"}</strong></div>
                        <div><span>Payment Date</span><strong>{form.paymentDate || "—"}</strong></div>
                        <div><span>Payment Period Covered</span><strong>{paymentPeriodLabel || "—"}</strong></div>
                        <div><span>Method of Payment</span><strong>{form.methodForPayment || "—"}</strong></div>
                        <div><span>Proof of Payment</span><strong>{form.proofOfPaymentFileName || "—"}</strong></div>
                      </div>
                      <div className="addpay-confirmActions">
                        <button type="button" className="addpay-secondary" onClick={() => setIsPendingTransferConfirmOpen(false)} disabled={saving}>Cancel</button>
                        <button type="button" className="addpay-primary" onClick={handleConfirmPendingTransfer} disabled={saving}>{saving ? "Saving..." : "Confirm"}</button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isEorConfirmOpen ? (
                  <div className="addpay-confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="addpay-payment-confirm-title">
                    <div className="addpay-confirmModal">
                      <button
                        type="button"
                        className="addpay-confirmClose"
                        onClick={() => setIsEorConfirmOpen(false)}
                        aria-label="Close payment confirmation"
                        title="Close"
                      >
                        ×
                      </button>
                      <h2 id="addpay-payment-confirm-title">Confirm Premium Payment Transfer and eOR</h2>
                      <p>Review the premium payment transfer and eOR details below before saving this payment record as processed. Once confirmed, both the premium payment transfer and eOR details can no longer be edited thereafter.</p>
                      <div className="addpay-confirmGrid">
                        <div><span>Total Premium Paid</span><strong>Php {form.totalPremiumPaidPhp || "—"}</strong></div>
                        <div><span>Frequency</span><strong>{annualPayment.frequencyOfPayment || "—"}</strong></div>
                        <div><span>Payment Date</span><strong>{form.paymentDate || "—"}</strong></div>
                        <div><span>Payment Period Covered</span><strong>{paymentPeriodLabel || "—"}</strong></div>
                        <div><span>Method of Payment</span><strong>{form.methodForPayment || "—"}</strong></div>
                        <div><span>Proof of Payment</span><strong>{form.proofOfPaymentFileName || "—"}</strong></div>
                        <div><span>eOR Number</span><strong>{eorForm.eorNumber || "—"}</strong></div>
                        <div><span>Receipt Date</span><strong>{eorForm.receiptDate || "—"}</strong></div>
                        <div><span>eOR File</span><strong>{eorForm.eorFileName || "—"}</strong></div>
                      </div>
                      <div className="addpay-confirmActions">
                        <button type="button" className="addpay-secondary" onClick={() => setIsEorConfirmOpen(false)} disabled={saving}>Cancel</button>
                        <button type="button" className="addpay-primary" onClick={handleConfirmEorSave} disabled={saving}>{saving ? "Saving..." : "Confirm"}</button>
                      </div>
                    </div>
                  </div>
                ) : null}

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