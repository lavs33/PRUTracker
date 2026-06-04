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
    document.title = `${user.username} | Add Payment Record`;
  }, [user]);

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
      navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}/payments/${data.paymentId}`);
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
  const frequencyLabel = annualPayment.frequencyOfPayment === "Half-yearly" ? "Half-Yearly" : (annualPayment.frequencyOfPayment || "Payment");
  const paymentPeriodLabel = derivePaymentPeriodLabel(form.paymentDate, annualPayment.frequencyOfPayment);

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
                    </div>
                  </div>
                </div>

                {apiError ? <p className="ph-note ph-note--error addpay-error">{apiError}</p> : null}

                <form className="addpay-form" onSubmit={handleSubmit}>
                  <label className="addpay-field">
                    <span>Total Premium Paid (Php) *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.totalPremiumPaidPhp}
                      onChange={(event) => setForm((prev) => ({ ...prev, totalPremiumPaidPhp: event.target.value }))}
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

                  <label className="addpay-field addpay-fileField">
                    <span>Proof of Payment *</span>
                    <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} />
                    {form.proofOfPaymentFileName ? <strong>Selected: {form.proofOfPaymentFileName}</strong> : null}
                    {fieldErrors.proofOfPaymentFileDataUrl ? <small>{fieldErrors.proofOfPaymentFileDataUrl}</small> : null}
                  </label>

                  <div className="addpay-actions">
                    <button type="button" className="addpay-secondary" onClick={() => navigate(`/agent/${user.username}/policyholders/${policyholderId}/annual-payments/${annualPaymentId}`)}>
                      Cancel
                    </button>
                    <button type="submit" className="addpay-primary" disabled={saving}>
                      {saving ? "Saving..." : `Save ${frequencyLabel} Payment Record`}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentAddPaymentRecord;
