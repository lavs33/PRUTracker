import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentSalesPerformance.css";

const MANILA_MONTH_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit",
}).formatToParts(new Date());
const CURRENT_YEAR = Number(MANILA_MONTH_PARTS.find((part) => part.type === "year")?.value);
const CURRENT_MONTH = Number(MANILA_MONTH_PARTS.find((part) => part.type === "month")?.value);
const CURRENT_MONTH_KEY = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, "0")}`;
const buildDatePresets = (dataStartDate) => {
  const start = new Date(dataStartDate || Date.UTC(CURRENT_YEAR, 0, 1));
  const startParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(start);
  const startYear = Number(startParts.find((part) => part.type === "year")?.value);
  const startMonth = startYear === CURRENT_YEAR ? Number(startParts.find((part) => part.type === "month")?.value) : 1;
  const monthName = (month) => new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(CURRENT_YEAR, month - 1, 1)));
  return [{ value: "YTD", label: `${monthName(startMonth)} ${CURRENT_YEAR} - ${monthName(CURRENT_MONTH)} ${CURRENT_YEAR}` }, ...Array.from({ length: CURRENT_MONTH - startMonth + 1 }, (_, index) => {
  const month = startMonth + index;
  const value = `${CURRENT_YEAR}-${String(month).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(CURRENT_YEAR, month - 1, 1)));
  return { value, label };
})];
};
const DATE_PRESETS = buildDatePresets();

const LEAD_SOURCE_OPTIONS = [
  { value: "ALL", label: "All Lead Sources" },
  { value: "Family", label: "Family" },
  { value: "Friend", label: "Friend" },
  { value: "Acquaintance", label: "Acquaintance" },
  { value: "Webinars", label: "Webinars" },
  { value: "Seminars/Conferences", label: "Seminars/Conferences" },
  { value: "Other", label: "Other" },
  { value: "System", label: "System" },
];

const DEFAULT_FILTERS = {
  datePreset: CURRENT_MONTH_KEY,
  leadSource: "ALL",
};

const DEFAULT_DATA = {
  filters: DEFAULT_FILTERS,
  reportContext: { periodLabel: DATE_PRESETS.find((option) => option.value === CURRENT_MONTH_KEY)?.label || "Current month", generatedAt: null },
  totalLeads: 0,
  totalOngoingLeads: 0,
  totalHandledLeads: 0,
  convertedLeads: 0,
  unconvertedLeads: 0,
  conversionRatePct: 0,
  totalPolicies: 0,
  activePolicyRatePct: 0,
  totalAnnualPremiumPhp: 0,
  totalFrequencyPremiumPhp: 0,
  averageAnnualPremiumPerConvertedLeadPhp: 0,
  averageFrequencyPremiumPerConvertedLeadPhp: 0,
  frequencyPremiumBreakdown: {
    monthlyPremiumPhp: 0,
    quarterlyPremiumPhp: 0,
    halfYearlyPremiumPhp: 0,
    yearlyPremiumPhp: 0,
  },
  activePolicies: 0,
  lapsedPolicies: 0,
  cancelledPolicies: 0,
  leadSourceBreakdown: [],
  monthlyConvertedLeads: [],
  salesRows: [],
  salesDetails: {
    frequencyPremiumPolicies: [],
    leadConversion: { converted: [], unconverted: [] },
    policyStatusPolicies: [],
  },
};

const formatDateTime = (value) => {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
};

const formatMonthLabel = (value) => {
  const [year, month] = String(value || "").split("-");
  const dt = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return Number.isNaN(dt.getTime())
    ? String(value || "—")
    : dt.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

const formatDate = (value) => {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const formatReportPeriod = (reportContext) => {
  const start = reportContext?.startDate ? formatDate(reportContext.startDate) : null;
  const end = reportContext?.endDate ? formatDate(reportContext.endDate) : formatDate(reportContext?.generatedAt);
  if (!start) return `Through ${end}`;
  return start === end ? start : `${start} to ${end}`;
};

const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || value || "All";

function AgentSalesPerformance() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [datePresets, setDatePresets] = useState(DATE_PRESETS);
  const [data, setData] = useState(DEFAULT_DATA);

  useEffect(() => {
    if (!user || user.username !== username) {
      navigate("/", { replace: true });
    }
  }, [user, username, navigate]);

  useEffect(() => {
    document.title = `${username} | Sales Performance`;
  }, [username]);

  const fetchData = useCallback(async (signal) => {
    if (!user?.id) return;
    const params = new URLSearchParams({
      userId: user.id,
      datePreset: filters.datePreset,
      leadSource: filters.leadSource,
    });
    const res = await fetch(`http://localhost:5000/api/sales/performance?${params.toString()}`, signal ? { signal } : undefined);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.message || "Failed to load sales performance.");
    setData({ ...DEFAULT_DATA, ...payload });
    setDatePresets(buildDatePresets(payload?.dataStartDate));
    setLastUpdated(new Date());
  }, [filters, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchData(controller.signal);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server.");
          setData(DEFAULT_DATA);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [user?.id, fetchData]);

  const money = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const policyStatusRows = Array.isArray(data?.policyStatusBreakdown) ? data.policyStatusBreakdown : [];
  const convertedLeadPolicyStatusRows = Array.isArray(data?.convertedLeadPolicyStatusBreakdown) ? data.convertedLeadPolicyStatusBreakdown : [];
  const unconvertedLeadStatusRows = Array.isArray(data?.unconvertedLeadStatusBreakdown) ? data.unconvertedLeadStatusBreakdown : [];
  const sourcePerformanceRows = Array.isArray(data?.leadSourceBreakdown) ? data.leadSourceBreakdown : [];
  const topConvertedSourceRows = [...sourcePerformanceRows].sort((a, b) => {
    if (Number(b.convertedLeads || 0) !== Number(a.convertedLeads || 0)) return Number(b.convertedLeads || 0) - Number(a.convertedLeads || 0);
    if (Number(b.conversionRatePct || 0) !== Number(a.conversionRatePct || 0)) return Number(b.conversionRatePct || 0) - Number(a.conversionRatePct || 0);
    return String(a.label || "").localeCompare(String(b.label || ""));
  });
  const premiumBreakdownRows = [
    { key: "monthlyPremiumPhp", label: "Monthly" },
    { key: "quarterlyPremiumPhp", label: "Quarterly" },
    { key: "halfYearlyPremiumPhp", label: "Half-yearly" },
    { key: "yearlyPremiumPhp", label: "Yearly" },
  ].map((item) => {
    const amount = Number(data?.frequencyPremiumBreakdown?.[item.key] || 0);
    const sharePct = Number(data?.totalFrequencyPremiumPhp || 0)
      ? Math.round((amount / Number(data.totalFrequencyPremiumPhp)) * 100)
      : 0;
    return { ...item, amount, sharePct };
  });
  const bestTrendMonth = Array.isArray(data?.monthlyConvertedLeads) && data.monthlyConvertedLeads.length > 0
    ? data.monthlyConvertedLeads.reduce(
        (best, current) => (Number(current?.converted || 0) > Number(best?.converted || 0) ? current : best),
        data.monthlyConvertedLeads[0]
      )
    : null;
  const bestSourceCount = Math.max(...sourcePerformanceRows.map((row) => Number(row?.convertedAndActiveLeads || 0)), 0);
  const bestSources = bestSourceCount > 0
    ? sourcePerformanceRows
        .filter((row) => Number(row?.convertedAndActiveLeads || 0) === bestSourceCount)
        .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")))
    : [];
  const bestSource = bestSources[0] || null;
  const formatSourceList = (items = []) => {
    const labels = items.map((item) => item.label || "—").filter(Boolean);
    if (labels.length <= 1) return labels[0] || "—";
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
  };
  const bestSourceNames = formatSourceList(bestSources);
  const bestSourceSummary = bestSources.length > 1
    ? `${bestSourceNames} are tied as best lead sources, each with ${bestSourceCount} converted active lead${bestSourceCount === 1 ? "" : "s"}.`
    : bestSource
      ? `${bestSource.label} is the best lead source with ${bestSourceCount} converted active lead${bestSourceCount === 1 ? "" : "s"} (${bestSource.activeConversionRatePct || 0}% of ${bestSource.handledLeads || 0} handled).`
      : "No active-policy lead source pattern yet.";
  const trendMax = Math.max(
    ...(Array.isArray(data?.monthlyConvertedLeads) ? data.monthlyConvertedLeads.map((x) => Number(x?.converted || 0)) : [0]),
    1
  );
  const salesRows = Array.isArray(data?.salesRows) ? data.salesRows : [];
  const salesDetails = data?.salesDetails || {};
  const frequencyPremiumPolicies = Array.isArray(salesDetails.frequencyPremiumPolicies) ? salesDetails.frequencyPremiumPolicies : [];
  const convertedLeadDetails = Array.isArray(salesDetails.leadConversion?.converted) ? salesDetails.leadConversion.converted : [];
  const unconvertedLeadDetails = Array.isArray(salesDetails.leadConversion?.unconverted) ? salesDetails.leadConversion.unconverted : [];
  const policyStatusPolicies = Array.isArray(salesDetails.policyStatusPolicies) ? salesDetails.policyStatusPolicies : [];
  const leadDetailRows = [...convertedLeadDetails, ...unconvertedLeadDetails];
  const leadHref = (row) => row?.prospectId && row?.leadId ? `/agent/${username}/prospects/${row.prospectId}/leads/${row.leadId}/engage` : `/agent/${username}/prospects`;
  const policyHref = (row) => row?.policyholderId ? `/agent/${username}/policyholders/${row.policyholderId}` : leadHref(row);
  const kpis = [
    { label: "Total Leads Handled", value: data.totalHandledLeads || 0 },
    { label: "Total Converted Leads", value: data.convertedLeads || 0 },
    { label: "Total Unconverted Leads", value: data.unconvertedLeads || 0 },
    { label: "Conversion Rate", value: `${data.conversionRatePct || 0}%` },
    { label: "Total Policies", value: data.totalPolicies || 0 },
    { label: "Active Policy Rate", value: `${data.activePolicyRatePct || 0}%` },
    { label: "Total Annual Premium", value: `₱ ${money(data.totalAnnualPremiumPhp)}` },
    { label: "Avg Annual Premium / Converted Lead", value: `₱ ${money(data.averageAnnualPremiumPerConvertedLeadPhp)}` },
  ];

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setApiError("");
      await fetchData();
    } catch (err) {
      setApiError(err?.message || "Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const generatePdfReport = () => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const reportFilename = `${user?.username || "Agent"} - Agent Sales Performance Report`;
    const previousDocumentTitle = document.title;
    const now = new Date();
    const chunk = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };
    const reportPeriod = formatReportPeriod(data?.reportContext);
    const trendRows = Array.isArray(data.monthlyConvertedLeads)
      ? data.monthlyConvertedLeads.map((row) => `
          <tr>
            <td>${escapeHtml(row.label || formatMonthLabel(row.month))}</td>
            <td>${Number(row.converted || 0)}</td>
          </tr>
        `).join("")
      : "";
    const sourceRowsHtml = sourcePerformanceRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${Number(row.handledLeads || 0)}</td>
        <td>${Number(row.convertedAndActiveLeads || 0)}</td>
        <td>${Number(row.activeConversionRatePct || 0)}%</td>
      </tr>
    `).join("");
    const topSourceRowsHtml = topConvertedSourceRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${Number(row.convertedLeads || 0)}/${Number(row.handledLeads || 0)}</td>
        <td>${Number(row.conversionRatePct || 0)}%</td>
      </tr>
    `).join("");
    const policyStatusRowsHtml = policyStatusRows.map((row) => `
      <tr><td>${escapeHtml(row.label)}</td><td>${Number(row.count || 0)}</td><td>${Number(row.sharePct || 0)}%</td></tr>
    `).join("");
    const convertedLeadPolicyStatusRowsHtml = convertedLeadPolicyStatusRows.map((row) => `
      <tr><td>${escapeHtml(row.label)}</td><td>${Number(row.count || 0)}</td><td>${Number(row.sharePct || 0)}%</td></tr>
    `).join("");
    const unconvertedLeadStatusRowsHtml = unconvertedLeadStatusRows.map((row) => `
      <tr><td>${escapeHtml(row.label)}</td><td>${Number(row.count || 0)}</td><td>${Number(row.sharePct || 0)}%</td></tr>
    `).join("");
    const premiumPolicyRowsHtml = frequencyPremiumPolicies.map((row) => `
      <tr><td>${escapeHtml(row.frequency || "—")}</td><td>${escapeHtml(row.policyholderCode || "—")}</td><td>${escapeHtml(row.prospectName || "—")} / ${escapeHtml(row.leadCode || "—")}</td><td>${escapeHtml(row.productName || "—")}</td><td>₱ ${escapeHtml(money(row.frequencyPremiumPhp))}</td><td>${escapeHtml(formatDate(row.issuedAt))}</td></tr>
    `).join("");
    const leadDetailRowsHtml = leadDetailRows.map((row) => `
      <tr><td>${escapeHtml(row.conversionStatus || "—")}</td><td>${escapeHtml(row.leadCode || "—")}</td><td>${escapeHtml(row.prospectName || "—")}</td><td>${escapeHtml(row.leadSource || "—")}</td><td>${escapeHtml(row.conversionStatus === "Converted" ? `${row.policyholderCode || "Policy —"} / ${row.policyStatus || "—"}` : row.leadStatus || "—")}</td><td>${escapeHtml(formatDate(row.convertedAt || row.createdAt))}</td></tr>
    `).join("");
    const policyDetailRowsHtml = policyStatusPolicies.map((row) => `
      <tr><td>${escapeHtml(row.status || "—")}</td><td>${escapeHtml(row.policyholderCode || "—")}</td><td>${escapeHtml(row.prospectName || "—")} / ${escapeHtml(row.leadCode || "—")}</td><td>${escapeHtml(row.productName || "—")}</td><td>₱ ${escapeHtml(money(row.frequencyPremiumPhp))} ${escapeHtml(row.frequency || "")}</td><td>${escapeHtml(formatDate(row.issuedAt))}</td></tr>
    `).join("");

    const salesChunks = chunk(salesRows, 20);
    if (!salesChunks.length) salesChunks.push([]);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const reportDoc = iframe.contentWindow?.document;
    if (!reportDoc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      return;
    }

    document.title = reportFilename;
    reportDoc.open();

    const overviewPage = `
        <div class="header-band"></div>
        <section class="section report-header-section">
          <div class="top-grid">
            <div>
              <h1 class="report-title">Agent Sales Performance Report</h1>
              <div class="report-period">Report Period: ${escapeHtml(reportPeriod)}</div>
            </div>
            <div class="details-card compact">
              <h3>Agent Details</h3>
              <div class="details-grid">
                <div class="detail-item"><b>Agent Code</b>${escapeHtml(user?.username || "—")}</div>
                <div class="detail-item"><b>Agent Type</b>${escapeHtml(user?.agentType || "—")}</div>
                <div class="detail-item"><b>Name</b>${escapeHtml([user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(" ") || "—")}</div>
                <div class="detail-item"><b>Unit</b>${escapeHtml(user?.unitName || "—")}</div>
                <div class="detail-item"><b>Branch</b>${escapeHtml(user?.branchName || "—")}</div>
                <div class="detail-item"><b>Area</b>${escapeHtml(user?.areaName || "—")}</div>
              </div>
            </div>
          </div>
        </section>
        <section class="section report-body-section">
          <div class="meta-row tight">
            <div class="meta-chip"><div class="label">Date Range</div><div class="value">${escapeHtml(getOptionLabel(datePresets, filters.datePreset))}</div></div>
            <div class="meta-chip"><div class="label">Lead Source</div><div class="value">${escapeHtml(getOptionLabel(LEAD_SOURCE_OPTIONS, filters.leadSource))}</div></div>
          </div>
        </section>
        <section class="section">
          <div class="insight-grid">
            <div class="insight-card"><h4>Lead Gap</h4><p>${Number(data.leadGap || 0)} Unconverted Active Leads.</p></div>
            <div class="insight-card"><h4>Best Lead Source</h4><p>${escapeHtml(bestSourceSummary)}</p></div>
            <div class="insight-card"><h4>Policy Health</h4><p>${Number(data.activePolicyRatePct || 0)}% of all policies are active (${Number(data.activePolicies || 0)}/${Number(data.totalPolicies || 0)}).</p></div>
          </div>
        </section>
        <section class="section">
          <div class="kpi-grid">
            ${kpis.map((item) => `<div class="kpi"><div class="label">${escapeHtml(item.label)}</div><div class="val">${escapeHtml(item.value)}</div></div>`).join("")}
          </div>
        </section>
        <section class="section">
          <div class="panel">
            <div class="panel-title-row"><h4>Total Frequency Premium Breakdown</h4><strong>₱ ${escapeHtml(money(data.totalFrequencyPremiumPhp))}</strong></div>
            <p class="panel-note">${escapeHtml(data?.reportContext?.periodLabel || "All available records")} • active policies only</p>
            <table><thead><tr><th>Frequency</th><th>Amount</th><th>Share</th></tr></thead><tbody>
              ${premiumBreakdownRows.map((row) => `<tr><td>${escapeHtml(row.label)} Premium</td><td>₱ ${escapeHtml(money(row.amount))}</td><td>${row.sharePct}% of total frequency premium</td></tr>`).join("")}
            </tbody></table>
          </div>
        </section>
        <section class="section">
          <div class="analytics-grid">
            <div class="panel">
              <h4>Lead Conversion Progress</h4>
              <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
                <tr><td>Total Leads Handled</td><td>${Number(data.totalHandledLeads || 0)}</td></tr>
                <tr><td>Total Converted Leads</td><td>${Number(data.convertedLeads || 0)}</td></tr>
                <tr><td>Total Unconverted Leads</td><td>${Number(data.unconvertedLeads || 0)}</td></tr>
                <tr><td>Conversion Rate</td><td>${Number(data.conversionRatePct || 0)}%</td></tr>
              </tbody></table>
              <div class="mini-grid">
                <div><h5>Converted by Policy Status</h5><table><tbody>${convertedLeadPolicyStatusRowsHtml || '<tr><td>No converted policy status data.</td></tr>'}</tbody></table></div>
                <div><h5>Unconverted by Lead Status</h5><table><tbody>${unconvertedLeadStatusRowsHtml || '<tr><td>No unconverted lead status data.</td></tr>'}</tbody></table></div>
              </div>
            </div>
            <div class="panel">
              <h4>Top Converted Lead Sources</h4>
              <table><thead><tr><th>Lead Source</th><th>Converted / Handled</th><th>Rate</th></tr></thead><tbody>${topSourceRowsHtml || '<tr><td colspan="3">No converted lead source data.</td></tr>'}</tbody></table>
            </div>
          </div>
        </section>
      `;

    const analyticsPage = `
        <div class="header-band"></div>
        <section class="section">
          <div class="analytics-grid">
            <div class="panel">
              <h4>Policy Status Mix</h4>
              <table><thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead><tbody>${policyStatusRowsHtml || '<tr><td colspan="3">No policy status data.</td></tr>'}</tbody></table>
            </div>
            <div class="panel">
              <h4>Lead Source Quality</h4>
              <table><thead><tr><th>Lead Source</th><th>Total Leads Handled</th><th>Converted and Active</th><th>Active Rate</th></tr></thead><tbody>${sourceRowsHtml || '<tr><td colspan="4">No lead source data available.</td></tr>'}</tbody></table>
            </div>
          </div>
        </section>
        <section class="section">
          <div class="panel">
            <div class="panel-title-row"><h4>Converted Leads Trend</h4><strong>${bestTrendMonth ? `${Number(bestTrendMonth.converted || 0)} peak conversions` : "No trend"} • ${Number(data.totalHandledLeads || 0)} leads handled</strong></div>
            <p class="panel-note">Bars adjust to the selected date range and include all converted leads regardless of policy status.</p>
            <table><thead><tr><th>Bucket</th><th>Converted Leads</th></tr></thead><tbody>${trendRows || '<tr><td colspan="2">No conversion trend data yet.</td></tr>'}</tbody></table>
          </div>
        </section>
        <section class="section">
          <div class="panel">
            <h4>Total Frequency Premium Policy Details</h4>
            <table><thead><tr><th>Frequency</th><th>Policy</th><th>Prospect / Lead</th><th>Product</th><th>Premium</th><th>Issued</th></tr></thead><tbody>${premiumPolicyRowsHtml || '<tr><td colspan="6">No active policy premium details.</td></tr>'}</tbody></table>
          </div>
        </section>
        <section class="section">
          <div class="panel">
            <h4>Lead Conversion Details</h4>
            <table><thead><tr><th>Type</th><th>Lead</th><th>Prospect</th><th>Source</th><th>Status / Policy</th><th>Date</th></tr></thead><tbody>${leadDetailRowsHtml || '<tr><td colspan="6">No lead conversion details.</td></tr>'}</tbody></table>
          </div>
        </section>
        <section class="section">
          <div class="panel">
            <h4>Policy Status Details</h4>
            <table><thead><tr><th>Status</th><th>Policy</th><th>Prospect / Lead</th><th>Product</th><th>Premium</th><th>Issued</th></tr></thead><tbody>${policyDetailRowsHtml || '<tr><td colspan="6">No policy status details.</td></tr>'}</tbody></table>
          </div>
        </section>
      `;

    const pageBodies = [
      overviewPage,
      analyticsPage,
      ...salesChunks.map((rows, chunkIndex) => `
        <div class="header-band"></div>
        <section class="section sales-detail-section">
          <h2 class="section-title">Detailed Sales Data</h2>
          <div class="panel">
            <div class="panel-title-row">
              <h4>Current Filter Scope</h4>
              <strong>Rows ${chunkIndex * 20 + 1}–${chunkIndex * 20 + rows.length} of ${salesRows.length}</strong>
            </div>
            <table class="sales-detail-table">
              <thead>
                <tr>
                  <th>Lead Code</th>
                  <th>Policyholder Code</th>
                  <th>Policyholder</th>
                  <th>Lead Source</th>
                  <th>Policy Name</th>
                  <th>Policy Status</th>
                  <th>Payment Frequency</th>
                  <th>Annual Premium</th>
                  <th>Frequency Premium</th>
                  <th>Policy Issuance Date</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.leadCode || "—")}</td>
                    <td>${escapeHtml(row.policyholderCode || "—")}</td>
                    <td>${escapeHtml(row.policyholderName || "—")}</td>
                    <td>${escapeHtml(row.leadSource || "—")}</td>
                    <td>${escapeHtml(row.policyName || "—")}</td>
                    <td>${escapeHtml(row.policyStatus || "—")}</td>
                    <td>${escapeHtml(row.requestedFrequency || "—")}</td>
                    <td>₱ ${escapeHtml(money(row.annualPremiumPhp || 0))}</td>
                    <td>₱ ${escapeHtml(money(row.frequencyPremiumPhp || 0))}</td>
                    <td>${escapeHtml(formatDate(row.convertedAt))}</td>
                  </tr>
                `).join("") || '<tr><td colspan="10">No sales records available for the selected filters.</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      `),
    ];
    const totalPages = pageBodies.length;
    const pagesHtml = pageBodies.map((body, index) => `
      <section class="pdf-page ${index >= 2 ? "sales-detail-page" : ""}">
        ${body}
        <div class="report-footer"><div>Generated by PRUTracker • ${escapeHtml(formatDateTime(now))}</div><div>Page ${index + 1} of ${totalPages}</div></div>
      </section>
    `).join("");

    reportDoc.write(`
      <html>
        <head>
          <title>${escapeHtml(reportFilename)}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            * { box-sizing: border-box; }
            body { font-family: Verdana, Geneva, sans-serif; color: #1f2937; margin: 0; font-size: 11px; line-height: 1.3; background:#fff; }
            .pdf-page { position: relative; width: 210mm; height: 297mm; padding: 14mm 14mm 22mm; break-after: page; page-break-after: always; overflow: hidden; }
            .pdf-page + .pdf-page { break-before: page; page-break-before: always; }
            .pdf-page:last-child { break-after: auto; page-break-after: auto; }
            .header-band { height: 6px; background: linear-gradient(90deg, #da291c, #ffb81c, #00539b); border-radius: 6px; margin-bottom: 6px; }
            .top-grid { display:grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 14px; align-items:start; }
            .report-title { margin: 0; color: #991b1b; font-size: 23px; line-height: 1.08; font-weight: 700; }
            .report-period { margin-top: 10px; color: #374151; font-size: 13px; font-weight: 700; }
            .details-card { border: 1px solid #f3c4c0; background: #fff7f6; border-radius: 10px; padding: 10px 12px; }
            .details-card h3 { margin: 0 0 6px; color: #991b1b; font-size: 12px; text-transform: uppercase; }
            .details-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 5px 14px; }
            .detail-item { font-size: 10px; }
            .detail-item b { color: #6b7280; display:block; font-weight:700; margin-bottom:1px; }
            .meta-row { display:grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 8px 0 0; }
            .meta-row.tight { max-width: 520px; }
            .meta-chip { border:1px solid #f0d2cf; background:#fff7f6; border-radius:10px; padding:8px 10px; }
            .meta-chip .label { color:#6b7280; font-size:10px; text-transform:uppercase; }
            .meta-chip .value { color:#991b1b; font-size:12px; font-weight:700; margin-top:3px; }
            .insight-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
            .insight-card { border:1px solid #fde2df; border-radius:10px; background:#fffafa; padding:10px; }
            .insight-card h4 { margin:0 0 4px; color:#991b1b; font-size:12px; }
            .insight-card p { margin:0; color:#374151; font-size:10px; }
            .kpi-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
            .kpi { border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#ffffff; }
            .kpi .label { color:#6b7280; font-size:10px; }
            .kpi .val { font-size:16px; font-weight:700; margin-top:2px; color:#111827; }
            .section { margin-bottom: 6px; }
            .report-header-section { padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
            .report-body-section { margin-top: 0; }
            .section-title { margin: 0 0 6px; color: #991b1b; font-size: 14px; font-weight: 700; border-left: 4px solid #da291c; padding-left: 8px; }
            .analytics-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 6px; }
            .analytics-grid.three { grid-template-columns: 1fr 1fr 1fr; }
            .mini-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 6px; }
            .mini-grid h5 { margin:0 0 4px; color:#374151; font-size:9px; }
            .panel { border:1px solid #e5e7eb; border-radius:8px; padding:6px; background:#fff; }
            .panel h4 { margin:0 0 5px; color:#111827; font-size:11px; }
            .panel h4 span { color:#6b7280; font-size:9px; font-weight:700; }
            .panel-title-row { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px; }
            .panel-title-row h4 { margin:0; }
            .panel-title-row strong { color:#991b1b; font-size:11px; }
            .panel-note { margin:0 0 5px; color:#6b7280; font-size:9px; font-weight:700; }
            table { width:100%; border-collapse: collapse; font-size:10px; }
            th, td { border: 1px solid #dfe5ec; padding: 4px 5px; text-align:left; vertical-align:top; }
            th { background: #f3f6fa; color:#374151; }
            tbody tr:nth-child(even) td { background:#fcfcfd; }
            .sales-detail-page { padding: 8mm 8mm 18mm; }
            .sales-detail-section { margin-bottom: 0; }
            .sales-detail-table { table-layout: fixed; font-size: 8.2px; line-height: 1.12; }
            .sales-detail-table th, .sales-detail-table td { padding: 2.5px 2px; overflow-wrap: anywhere; word-break: normal; }
            .sales-detail-table th { font-size: 7.8px; line-height: 1.08; }
            .sales-detail-table tr { break-inside: avoid; page-break-inside: avoid; }
            .report-footer { position:absolute; left:16mm; right:16mm; bottom:14mm; font-size:9px; color:#6b7280; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e5e7eb; padding-top:3px; }
          </style>
        </head>
        <body>${pagesHtml}</body>
      </html>
    `);
    reportDoc.close();
    reportDoc.title = reportFilename;


    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      document.title = previousDocumentTitle;
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 400);
    };

    iframe.contentWindow.onafterprint = cleanup;
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      // Keep every generated sales page alive while the browser builds print
      // preview; removing the iframe too early can truncate later row pages.
      setTimeout(cleanup, 60_000);
    }, 250);
  };

  const handleSideNav = (key) => {
    if (!user) return navigate("/");
    switch (key) {
      case "clients": navigate(`/agent/${user.username}/clients`); break;
      case "clients_relationship": navigate(`/agent/${user.username}/clients/relationship`); break;
      case "clients_all_prospects": navigate(`/agent/${user.username}/prospects`); break;
      case "clients_all_policyholders": navigate(`/agent/${user.username}/policyholders`); break;
      case "tasks": navigate(`/agent/${user.username}/tasks`); break;
      case "tasks_progress": navigate(`/agent/${user.username}/tasks/progress`); break;
      case "tasks_all": navigate(`/agent/${user.username}/tasks/all`); break;
      case "tasks_workload": navigate(`/agent/${user.username}/tasks/workload`); break;
      case "sales": navigate(`/agent/${user.username}/sales/performance`); break;
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;
      default: break;
    }
  };

  if (!user || user.username !== username) return null;

  return (
    <div className="sp-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="sp-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="sp-content">
          <div className="sp-headRow">
            <div>
              <h1 className="sp-title">Sales Performance Dashboard</h1>
              <p className="sp-subtitle">
                Track conversion quality, premium production, true lead-source performance, and policy health with a consistent filtered sales snapshot.
              </p>
            </div>
            <div className="sp-headActions">
              <span className="sp-lastUpdated">Updated {lastUpdated ? formatDateTime(lastUpdated) : "—"}</span>
              <button className="sp-refreshBtn" onClick={handleRefresh} disabled={loading}>Refresh</button>
              <button className="sp-reportBtn" onClick={generatePdfReport} disabled={loading}>Generate Report (PDF)</button>
            </div>
          </div>

          <section className="sp-card sp-filterBar">
            <div className="sp-filterGroup">
              <label>Date Range</label>
              <select value={filters.datePreset} onChange={(e) => handleFilterChange("datePreset", e.target.value)}>
                {datePresets.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="sp-filterGroup">
              <label>Lead Source</label>
              <select value={filters.leadSource} onChange={(e) => handleFilterChange("leadSource", e.target.value)}>
                {LEAD_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="sp-filterActions">
              <button className="sp-resetBtn" onClick={() => setFilters(DEFAULT_FILTERS)} disabled={loading}>Reset Filters</button>
            </div>
          </section>

          <section className="sp-highlights">
            <div className="sp-highlight">
              <span>Lead Gap</span>
              <strong>{data.leadGap || 0}</strong>
              <small>Unconverted Active Leads</small>
            </div>
            <div className="sp-highlight">
              <span>Best Lead Source</span>
              <strong>{bestSources.length ? bestSourceNames : "—"}</strong>
              <small>{bestSourceSummary}</small>
            </div>
            <div className="sp-highlight">
              <span>Policy Health</span>
              <strong>{data.activePolicyRatePct || 0}% active</strong>
              <small>{data.activePolicies || 0} active out of {data.totalPolicies || 0} total policies.</small>
            </div>
          </section>

          <div className="sp-kpis">
            {kpis.map((item) => (
              <div key={item.label} className="sp-kpi">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <section className="sp-card sp-frequencyCard">
            <div className="sp-cardHeader">
              <div>
                <h3>Total Frequency Premium Breakdown</h3>
                <p>{data?.reportContext?.periodLabel || "All available records"} • active policies only</p>
              </div>
              <strong className="sp-cardTotal">₱ {money(data.totalFrequencyPremiumPhp)}</strong>
            </div>
            <div className="sp-frequencyGrid">
              {premiumBreakdownRows.map((row) => (
                <div key={row.key}>
                  <span>{row.label} Premium</span>
                  <strong>₱ {money(row.amount)}</strong>
                  <small>{row.sharePct}% of total frequency premium</small>
                </div>
              ))}
            </div>
            <div className="sp-sourceTableWrap" style={{ marginTop: 16 }}>
              <table className="sp-table">
                <thead><tr><th>Frequency</th><th>Policy / Lead</th><th>Prospect</th><th>Product</th><th>Premium</th><th>Issued</th></tr></thead>
                <tbody>
                  {frequencyPremiumPolicies.length ? frequencyPremiumPolicies.map((row) => (
                    <tr key={`${row.frequencyKey}:${row.policyholderId}`}>
                      <td>{row.frequency || "—"}</td>
                      <td><Link className="sp-contextLink" to={policyHref(row)}>{row.policyholderCode || "—"}</Link><br /><small>{row.leadCode || "Lead —"}</small></td>
                      <td><Link className="sp-contextLink" to={leadHref(row)}>{row.prospectName || "—"}</Link><br /><small>{row.prospectCode || "—"}</small></td>
                      <td>{row.productName || "—"}</td>
                      <td>₱ {money(row.frequencyPremiumPhp)}<br /><small>Annual ₱ {money(row.annualPremiumPhp)}</small></td>
                      <td>{formatDate(row.issuedAt)}</td>
                    </tr>
                  )) : <tr><td colSpan="6">No active policy premium details for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="sp-grid">
            <section className="sp-card">
              <h3>Lead Conversion Progress</h3>
              <div className="sp-progressRow">
                <label>Converted vs Total Leads Handled</label>
                <div className="sp-track"><span style={{ width: `${data.conversionRatePct || 0}%` }} /></div>
                <b>{data.conversionRatePct || 0}%</b>
              </div>
              <p className="sp-footnote">{data.convertedLeads || 0} converted leads from {data.totalHandledLeads || 0} leads handled in this period.</p>
              <div className="sp-miniBreakdowns">
                <div><b>Converted by Policy Status</b>{convertedLeadPolicyStatusRows.map((row) => <small key={row.label}>{row.label}: {row.count} ({row.sharePct}%)</small>)}</div>
                <div><b>Unconverted by Lead Status</b>{unconvertedLeadStatusRows.map((row) => <small key={row.label}>{row.label}: {row.count} ({row.sharePct}%)</small>)}</div>
              </div>
              <div className="sp-sourceTableWrap" style={{ marginTop: 14 }}>
                <table className="sp-table">
                  <thead><tr><th>Conversion</th><th>Lead</th><th>Prospect</th><th>Source</th><th>Status / Policy</th><th>Date</th></tr></thead>
                  <tbody>
                    {leadDetailRows.length ? leadDetailRows.map((row) => (
                      <tr key={`${row.conversionStatus}:${row.leadId}`}>
                        <td>{row.conversionStatus}</td>
                        <td><Link className="sp-contextLink" to={leadHref(row)}>{row.leadCode || "—"}</Link></td>
                        <td><Link className="sp-contextLink" to={leadHref(row)}>{row.prospectName || "—"}</Link><br /><small>{row.prospectCode || "—"}</small></td>
                        <td>{row.leadSource || "—"}</td>
                        <td>{row.conversionStatus === "Converted" ? <><Link className="sp-contextLink" to={policyHref(row)}>{row.policyholderCode || "Policy —"}</Link><br /><small>{row.productName || "—"} • {row.policyStatus || "—"}</small></> : row.leadStatus}</td>
                        <td>{formatDate(row.convertedAt || row.createdAt)}</td>
                      </tr>
                    )) : <tr><td colSpan="6">No lead conversion details for this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="sp-card">
              <h3>Top Converted Lead Sources</h3>
              <div className="sp-sourceList">
                {topConvertedSourceRows.length > 0 ? topConvertedSourceRows.map((row) => (
                  <div key={row.label} className="sp-sourceRow">
                    <div className="sp-sourceMeta">
                      <strong>{row.label}</strong>
                      <span>{row.convertedLeads || 0} converted / {row.handledLeads || 0} handled • {row.conversionRatePct || 0}%</span>
                    </div>
                    <div className="sp-sourceTrack">
                      <span style={{ width: `${Math.max(0, Math.min(100, Number(row.conversionRatePct || 0)))}%` }} />
                    </div>
                  </div>
                )) : <p className="sp-muted">No lead source rows for the selected filters.</p>}
              </div>
            </section>

            <section className="sp-card">
              <h3>Policy Status Mix</h3>
              <div className="sp-statusGrid">
                {policyStatusRows.length > 0 ? policyStatusRows.map((row) => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.count || 0}</strong>
                    <small>{row.sharePct || 0}% of all policies</small>
                  </div>
                )) : <p className="sp-muted">No policy status data available.</p>}
              </div>
              <div className="sp-sourceTableWrap" style={{ marginTop: 14 }}>
                <table className="sp-table">
                  <thead><tr><th>Status</th><th>Policy</th><th>Prospect / Lead</th><th>Product</th><th>Premium</th><th>Issued</th></tr></thead>
                  <tbody>
                    {policyStatusPolicies.length ? policyStatusPolicies.map((row) => (
                      <tr key={`${row.status}:${row.policyholderId}`}>
                        <td>{row.status || "—"}</td>
                        <td><Link className="sp-contextLink" to={policyHref(row)}>{row.policyholderCode || "—"}</Link><br /><small>{row.policyNumber || "Policy # —"}</small></td>
                        <td><Link className="sp-contextLink" to={leadHref(row)}>{row.prospectName || "—"}</Link><br /><small>{row.leadCode || "Lead —"}</small></td>
                        <td>{row.productName || "—"}</td>
                        <td>₱ {money(row.frequencyPremiumPhp)}<br /><small>{row.frequency || "—"}</small></td>
                        <td>{formatDate(row.issuedAt)}</td>
                      </tr>
                    )) : <tr><td colSpan="6">No policy details for this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="sp-card">
              <h3>Lead Source Quality</h3>
              <div className="sp-sourceTableWrap">
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th>Lead Source</th>
                      <th>Total Leads Handled</th>
                      <th>Converted and Active</th>
                      <th>Active Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourcePerformanceRows.length > 0 ? sourcePerformanceRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td>{row.handledLeads || 0}</td>
                        <td>{row.convertedAndActiveLeads || 0}</td>
                        <td>{row.activeConversionRatePct || 0}%</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4">No lead source data available for the selected filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="sp-card sp-wide">
              <div className="sp-cardHeader">
                <div>
                  <h3>Converted Leads Trend</h3>
                  <p>Bars adjust to the selected date range and include all converted leads regardless of policy status.</p>
                </div>
                <strong className="sp-cardTotal">{bestTrendMonth ? `${bestTrendMonth.converted || 0} peak conversions` : "No trend"} • {data.totalHandledLeads || 0} leads handled</strong>
              </div>
              {Array.isArray(data.monthlyConvertedLeads) && data.monthlyConvertedLeads.length > 0 ? (
                <div className="sp-bars">
                  {data.monthlyConvertedLeads.map((m) => {
                    const pct = Math.round((Number(m.converted || 0) / trendMax) * 100);
                    return (
                      <div key={m.month} className="sp-barCol">
                        <div className="sp-barWrap"><span style={{ height: `${pct}%` }} /></div>
                        <strong>{m.converted || 0}</strong>
                        <small>{m.label || formatMonthLabel(m.month)}</small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="sp-muted">No conversion trend data yet.</p>
              )}
            </section>

            <section className="sp-card sp-wide">
              <div className="sp-cardHeader">
                <div>
                  <h3>Detailed Sales Data</h3>
                  <p>Full sales rows for the current date range and active dashboard filters.</p>
                </div>
                <strong className="sp-cardTotal">{salesRows.length} rows</strong>
              </div>
              <div className="sp-sourceTableWrap">
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th>Lead Code</th>
                      <th>Policyholder Code</th>
                      <th>Policyholder</th>
                      <th>Lead Source</th>
                      <th>Policy Name</th>
                      <th>Policy Status</th>
                      <th>Payment Frequency</th>
                      <th>Annual Premium</th>
                      <th>Frequency Premium</th>
                      <th>Policy Issuance Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesRows.length > 0 ? salesRows.map((row) => (
                      <tr key={`${row.leadCode}-${row.convertedAt || row.prospectCode}`}>
                        <td><Link className="sp-contextLink" to={`/agent/${username}/prospects/${row.prospectId}/leads/${row.leadId}`}>{row.leadCode || "—"}</Link></td>
                        <td><Link className="sp-contextLink" to={`/agent/${username}/policyholders/${row.policyholderId}`}>{row.policyholderCode || "—"}</Link></td>
                        <td><Link className="sp-contextLink" to={`/agent/${username}/policyholders/${row.policyholderId}`}>{row.policyholderName || "—"}</Link></td>
                        <td>{row.leadSource || "—"}</td>
                        <td>{row.policyName || "—"}</td>
                        <td>{row.policyStatus || "—"}</td>
                        <td>{row.requestedFrequency || "—"}</td>
                        <td>₱ {money(row.annualPremiumPhp || 0)}</td>
                        <td>₱ {money(row.frequencyPremiumPhp || 0)}</td>
                        <td>{formatDate(row.convertedAt)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="10">No sales records available for the selected filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {loading && <p className="sp-muted" style={{ marginTop: 10 }}>Loading sales performance…</p>}
          {!loading && apiError && <p className="sp-muted" style={{ color: "#DA291C", marginTop: 10 }}>{apiError}</p>}
        </main>
      </div>
    </div>
  );
}

export default AgentSalesPerformance;