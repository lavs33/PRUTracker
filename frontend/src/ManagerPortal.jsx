import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaFilePdf, FaSearch } from "react-icons/fa";
import TopNav from "./components/TopNav";
import ManagerSideNav from "./components/ManagerSideNav";
import "./ManagerPortal.css";

const API_BASE = "http://localhost:5000";
const DATE_PRESETS = [
  { value: "ALL", label: "All Time" },
  { value: "TODAY", label: "This Day" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "6m", label: "Last 6 Months" },
  { value: "12m", label: "Last 12 Months" },
];
const KPI_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "Semi-Annually", "Annually"];
const KPI_FREQUENCY_WEIGHTS = {
  Daily: 1,
  Weekly: 7,
  Monthly: 30,
  Quarterly: 90,
  "Semi-Annually": 180,
  Annually: 365,
};

function roundUpFinalKpiValue(value) {
  if (!Number.isFinite(value)) return "";
  const nearestInteger = Math.round(value);
  if (Math.abs(value - nearestInteger) < Number.EPSILON * 100) return nearestInteger;
  return Math.ceil(value);
}

function shouldCopyKpiValueAcrossFrequencies(kpi = {}) {
  return kpi.valueType === "Percent" || kpi.key === "monthly_active_agents";
}

function scaleKpiTargetValue(value, valueType, fromPeriod, toPeriod) {
  if (value === null || value === undefined || value === "") return "";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  if (valueType === "Percent" || valueType === "Index") return numericValue;
  const fromWeight = KPI_FREQUENCY_WEIGHTS[fromPeriod] || 1;
  const toWeight = KPI_FREQUENCY_WEIGHTS[toPeriod] || fromWeight;
  const exactScaledValue = numericValue * (toWeight / fromWeight);
  return roundUpFinalKpiValue(exactScaledValue);
}

function formatMoney(value) {
  return `₱ ${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatKpiLabel(kpi = {}, scopeType = "") {
  const label = String(kpi.label || "").trim();
  const legacyAgentLabels = {
    "approaches count": "Number of Approaches",
    "appointments count": "Number of Appointments",
    "presentations count": "Number of Presentations",
    "policies count": "Number of Policies",
    "sales target": "Number of Policies",
    "new prospects": "Number of New Prospects",
  };
  const legacyBranchLabels = {
    "active agents count": "Number of Active Agents",
  };
  const normalizedLabel = label.toLowerCase();
  if (scopeType === "AGENT" && legacyAgentLabels[normalizedLabel]) return legacyAgentLabels[normalizedLabel];
  if (scopeType === "BRANCH" && legacyBranchLabels[normalizedLabel]) return legacyBranchLabels[normalizedLabel];
  return label || "KPI";
}

function formatKpiValue(value, valueType) {
  if (value === null || value === undefined || value === "") return "No standard target";
  if (valueType === "Currency") return formatMoney(value);
  if (valueType === "Percent" || valueType === "Index") return `${value}%`;
  return Number(value).toLocaleString("en-PH");
}

function formatKpiTarget(kpi = {}) {
  if (kpi.targetValue !== null && kpi.targetValue !== undefined && kpi.targetValue !== "") {
    return formatKpiValue(kpi.targetValue, kpi.valueType);
  }
  const hasMin = kpi.targetMin !== null && kpi.targetMin !== undefined && kpi.targetMin !== "";
  const hasMax = kpi.targetMax !== null && kpi.targetMax !== undefined && kpi.targetMax !== "";
  if (hasMin && hasMax) return `${formatKpiValue(kpi.targetMin, kpi.valueType)} - ${formatKpiValue(kpi.targetMax, kpi.valueType)}`;
  if (hasMin) return `${formatKpiValue(kpi.targetMin, kpi.valueType)} and above`;
  if (hasMax) return `Up to ${formatKpiValue(kpi.targetMax, kpi.valueType)}`;
  return "No standard target";
}

function formatRequiredKpiTarget(kpi = {}) {
  const formatted = formatKpiTarget(kpi);
  return formatted === "No standard target" ? "Required" : formatted;
}

function getKpiTargets(kpi = {}) {
  const targetsByPeriod = new Map(
    (Array.isArray(kpi.targets) ? kpi.targets : [])
      .map((target) => [String(target?.period || ""), target])
      .filter(([period]) => KPI_FREQUENCIES.includes(period)),
  );
  return KPI_FREQUENCIES.map((period) => {
    const target = targetsByPeriod.get(period) || {};
    return {
      period,
      targetMin: target.targetMin ?? "",
      targetMax: target.targetMax ?? "",
      targetValue: target.targetValue ?? "",
    };
  });
}

function cloneKpiDraft(kpi = {}) {
  return { ...kpi, targets: getKpiTargets(kpi).map((target) => ({ ...target })) };
}

function buildKpiTargetsFromDefault(kpi = {}, defaultPeriodOverride = "") {
  const defaultPeriod = KPI_FREQUENCIES.includes(defaultPeriodOverride)
    ? defaultPeriodOverride
    : (KPI_FREQUENCIES.includes(kpi.period) ? kpi.period : KPI_FREQUENCIES[0]);
  const targets = getKpiTargets(kpi);
  const defaultTarget = targets.find((target) => target.period === defaultPeriod) || {};
  const hasDefaultTarget = String(defaultTarget.targetValue ?? "").trim() !== "";
  const hasDefaultMin = String(defaultTarget.targetMin ?? "").trim() !== "";
  const hasDefaultMax = String(defaultTarget.targetMax ?? "").trim() !== "";

  const shouldCopyAcrossFrequencies = shouldCopyKpiValueAcrossFrequencies(kpi);
  const nextTargets = (!hasDefaultTarget && !hasDefaultMin && !hasDefaultMax)
    ? targets
    : targets.map((target) => {
      if (target.period === defaultPeriod) return target;
      if (hasDefaultTarget) {
        return {
          ...target,
          targetValue: shouldCopyAcrossFrequencies
            ? defaultTarget.targetValue
            : scaleKpiTargetValue(defaultTarget.targetValue, kpi.valueType, defaultPeriod, target.period),
          targetMin: "",
          targetMax: "",
        };
      }
      return {
        ...target,
        targetValue: "",
        targetMin: hasDefaultMin
          ? (shouldCopyAcrossFrequencies ? defaultTarget.targetMin : scaleKpiTargetValue(defaultTarget.targetMin, kpi.valueType, defaultPeriod, target.period))
          : "",
        targetMax: hasDefaultMax
          ? (shouldCopyAcrossFrequencies ? defaultTarget.targetMax : scaleKpiTargetValue(defaultTarget.targetMax, kpi.valueType, defaultPeriod, target.period))
          : "",
      };
    });
  const primaryTarget = nextTargets.find((target) => target.period === defaultPeriod) || {};
  return {
    ...kpi,
    period: defaultPeriod,
    targets: nextTargets,
    targetMin: primaryTarget.targetMin ?? "",
    targetMax: primaryTarget.targetMax ?? "",
    targetValue: primaryTarget.targetValue ?? "",
  };
}

function getKpiComparison(actual, kpi) {
  const numericActual = Number(actual || 0);
  const primaryTarget = [kpi?.targetValue, kpi?.targetMin, kpi?.targetMax]
    .find((value) => value !== null && value !== undefined && value !== "");
  const target = Number(primaryTarget || 0);
  if (!target) return { percent: 0, status: "No target assigned", className: "neutral", delta: 0, deltaLabel: "Set a target to compare progress." };
  const percent = Math.round((numericActual / target) * 100);
  const delta = numericActual - target;
  if (delta >= 0) {
    return { percent, status: "Exceeding / On target", className: "good", delta, deltaLabel: `Exceeded by ${formatActualKpiValue(delta, kpi.valueType)}` };
  }
  return { percent, status: "Below target", className: "warning", delta, deltaLabel: `${formatActualKpiValue(Math.abs(delta), kpi.valueType)} remaining to target` };
}

function formatActualKpiValue(value, valueType) {
  if (valueType === "Currency") return formatMoney(value);
  if (valueType === "Percent" || valueType === "Index") return `${Number(value || 0).toFixed(0)}%`;
  return Number(value || 0).toLocaleString("en-PH");
}

function summarizeKpiRows(rows = []) {
  const summary = rows.reduce(
    (accumulator, row) => ({
      totalPolicies: accumulator.totalPolicies + Number(row?.totalPolicies || 0),
      activePolicies: accumulator.activePolicies + Number(row?.activePolicies || 0),
      totalAnnualPremium: accumulator.totalAnnualPremium + Number(row?.annualPremium || 0),
    }),
    { totalPolicies: 0, activePolicies: 0, totalAnnualPremium: 0 },
  );
  summary.activePolicyRate = summary.totalPolicies ? Math.round((summary.activePolicies / summary.totalPolicies) * 100) : 0;
  return summary;
}

function getKpiFrequencyRangeLabel(period) {
  const normalized = String(period || "Monthly").trim();
  const labels = {
    Daily: "Today",
    Weekly: "Last 7 days",
    Monthly: "Last 30 days",
    Quarterly: "Last 90 days",
    "Semi-Annually": "Last six months",
    Annually: "Last 12 months",
  };
  return labels[normalized] || "Last 30 days";
}

function formatScopeLabel(scopeType) {
  if (scopeType === "AGENT") return "All Agents";
  if (scopeType === "UNIT") return "All Units";
  return "Branch";
}

function formatDateTime(value) {
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
}

function formatDate(value) {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

function getPortalHeading(roleType) {
  if (roleType === "AUM") return "Assistant Unit Manager Command Center";
  if (roleType === "UM") return "Unit Manager Command Center";
  if (roleType === "BM") return "Branch Manager Command Center";
  return "Manager Command Center";
}

function getScopeLabel(scope = {}) {
  if (scope.role === "BM") {
    return (
      [scope.branchName, scope.areaName].filter(Boolean).join(" • ") ||
      "Branch scope"
    );
  }

  return (
    [scope.unitName, scope.branchName, scope.areaName]
      .filter(Boolean)
      .join(" • ") || "Unit scope"
  );
}

function getPresetLabel(value) {
  return (
    DATE_PRESETS.find((option) => option.value === value)?.label || "All Time"
  );
}

function getKpiPeriodForDatePreset(value) {
  const periodByPreset = {
    TODAY: "Daily",
    "7d": "Weekly",
    "30d": "Monthly",
    "90d": "Quarterly",
    "6m": "Semi-Annually",
    "12m": "Annually",
  };
  return periodByPreset[value] || "";
}

function selectKpiTargetForPeriod(kpi = {}, period = "") {
  if (!period) return kpi;
  const directTarget = getKpiTargets(kpi).find((target) => target.period === period) || {};
  const hasDirectTarget = [directTarget.targetValue, directTarget.targetMin, directTarget.targetMax]
    .some((value) => value !== null && value !== undefined && value !== "");
  const computedTargets = hasDirectTarget ? null : buildKpiTargetsFromDefault(kpi, kpi.period);
  const periodTarget = hasDirectTarget
    ? directTarget
    : (getKpiTargets(computedTargets).find((target) => target.period === period) || directTarget);
  return {
    ...kpi,
    period,
    targetMin: periodTarget.targetMin ?? "",
    targetMax: periodTarget.targetMax ?? "",
    targetValue: periodTarget.targetValue ?? "",
    targets: computedTargets?.targets || kpi.targets,
  };
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildFilter(rows, query, fields) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return rows;

  const queryTokens = normalizedQuery.split(" ");

  return rows.filter((row) => {
    const normalizedFields = fields
      .map((field) => normalizeSearchValue(row?.[field] || ""))
      .filter(Boolean);
    const combinedFields = normalizedFields.join(" ");

    return (
      normalizedFields.some((value) => value.includes(normalizedQuery)) ||
      queryTokens.every((token) => combinedFields.includes(token))
    );
  });
}

function sortByAgentCode(rows = []) {
  return [...rows].sort((left, right) =>
    String(left?.username || "").localeCompare(
      String(right?.username || ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    ),
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPrintableReport({
  filename,
  title,
  periodLabel,
  detailsTitle,
  details,
  filters,
  statCards,
  analyticsSections,
  tableSections,
  orientation = "portrait",
}) {
  const previousDocumentTitle = document.title;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  document.body.appendChild(iframe);

  const reportDoc = iframe.contentWindow?.document;
  if (!reportDoc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return;
  }

  const isLandscape = orientation === "landscape";
  const pageHeight = isLandscape ? "187mm" : "274mm";
  const pageSize = isLandscape ? "A4 landscape" : "A4 portrait";
  const tableFontSize = isLandscape ? "8px" : "10px";
  const tableCellPadding = isLandscape ? "4px 3px" : "6px 5px";

  const chunkRows = (rows, size) => {
    const chunks = [];
    for (let index = 0; index < rows.length; index += size)
      chunks.push(rows.slice(index, index + size));
    return chunks.length ? chunks : [[]];
  };

  const tablePages = [];
  tableSections.forEach((section) => {
    const rowChunks = chunkRows(section.rows || [], section.pageSize || 18);
    rowChunks.forEach((rows, chunkIndex) => {
      tablePages.push({
        title: chunkIndex === 0 ? section.title : `${section.title} (cont.)`,
        columns: section.columns,
        rows,
        emptyMessage: section.emptyMessage || "No rows available.",
      });
    });
  });
  const firstInlineTable = tablePages[0] || null;
  const continuationTablePages = tablePages.slice(1);

  const totalPages = 1 + continuationTablePages.length;
  const nowLabel = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const renderFooter = (pageNumber) => `
    <footer class="pdf-footer">
      <span>Generated by PRUTracker • ${escapeHtml(nowLabel)}</span>
      <span>Page ${pageNumber} of ${totalPages}</span>
    </footer>
  `;

  const renderTableSection = (page) => `
    <section class="pdf-section-block pdf-section-block--table">
      <h3>${escapeHtml(page.title)}</h3>
      <table>
        <thead>
          <tr>${page.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${
            page.rows.length
              ? page.rows
                  .map(
                    (row) => `
                      <tr>
                        ${page.columns
                          .map(
                            (column) =>
                              `<td>${escapeHtml(column.render ? column.render(row) : (row?.[column.key] ?? "—"))}</td>`,
                          )
                          .join("")}
                      </tr>`,
                  )
                  .join("")
              : `<tr><td colspan="${page.columns.length}" class="empty-row">${escapeHtml(page.emptyMessage)}</td></tr>`
          }
        </tbody>
      </table>
    </section>
  `;

  const firstPage = `
    <section class="pdf-page first-page">
      <div class="pdf-top-grid">
        <div class="pdf-title-block">
          <h1>${escapeHtml(title)}</h1>
          <div class="pdf-period">Report Period: ${escapeHtml(periodLabel)}</div>
        </div>
        <section class="pdf-details-card">
          <h2>${escapeHtml(detailsTitle)}</h2>
          <div class="pdf-details-grid">
            ${details
              .map(
                (item) => `
                  <div class="pdf-detail-item">
                    <b>${escapeHtml(item.label)}</b>
                    <span>${escapeHtml(item.value)}</span>
                  </div>`,
              )
              .join("")}
          </div>
        </section>
      </div>

      <section class="pdf-filter-grid">
        ${filters
          .map(
            (item) => `
              <article class="pdf-filter-card">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
              </article>`,
          )
          .join("")}
      </section>

      <section class="pdf-section-block">
        <h3>Performance Analytics</h3>
        <div class="pdf-stats-grid">
          ${statCards
            .map(
              (item) => `
                <article class="pdf-stat-card ${escapeHtml(item.tone || "")}">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(item.value)}</strong>
                </article>`,
            )
            .join("")}
        </div>
        <div class="pdf-analytics-grid">
          ${analyticsSections
            .map(
              (section) => `
                <article class="pdf-analytics-card">
                  <h4>${escapeHtml(section.title)}</h4>
                  <div class="pdf-analytics-rows">
                    ${section.rows
                      .map(
                        (row) => `
                          <div class="pdf-analytics-row">
                            <span>${escapeHtml(row.label)}</span>
                            <strong>${escapeHtml(row.value)}</strong>
                          </div>`,
                      )
                      .join("")}
                  </div>
                </article>`,
            )
            .join("")}
        </div>
      </section>
      ${firstInlineTable ? renderTableSection(firstInlineTable) : ""}
      ${renderFooter(1)}
    </section>
  `;

  const tablePagesHtml = continuationTablePages
    .map(
      (page, index) => `
        <section class="pdf-page">
          ${renderTableSection(page)}
          ${renderFooter(index + 2)}
        </section>
      `,
    )
    .join("");

  document.title = filename;
  reportDoc.open();
  reportDoc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: ${pageSize}; margin: 10mm 8mm 12mm; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Verdana, Geneva, sans-serif; color: #0f172a; }
          .pdf-page { height: ${pageHeight}; padding: 4mm 2mm 16mm; position: relative; page-break-after: always; overflow: hidden; }
          .pdf-page:last-child { page-break-after: auto; }
          .pdf-top-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.9fr); gap: 18px; align-items: start; }
          .pdf-title-block h1 { margin: 0; color: #a32020; font-size: 24px; line-height: 1.12; }
          .pdf-period { margin-top: 10px; color: #1e3a5f; font-size: 12px; font-weight: 700; }
          .pdf-details-card { border: 1px solid #f0c1bc; border-radius: 12px; padding: 10px 14px; }
          .pdf-details-card h2 { margin: 0 0 8px; font-size: 12px; color: #c4382d; text-transform: uppercase; }
          .pdf-details-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; }
          .pdf-detail-item { display: grid; gap: 2px; font-size: 11px; }
          .pdf-detail-item b { color: #1f2937; }
          .pdf-filter-grid, .pdf-stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
          .pdf-filter-card, .pdf-stat-card { border: 1px solid #d6dee8; border-radius: 10px; padding: 8px 10px; min-height: 58px; }
          .pdf-filter-card span, .pdf-stat-card span { display: block; font-size: 10px; color: #1f2937; }
          .pdf-filter-card strong { display: block; margin-top: 4px; font-size: 12px; color: #111827; }
          .pdf-stat-card strong { display: block; margin-top: 6px; font-size: 17px; color: #0f172a; }
          .pdf-stat-card.red { border-color: #f1c0ba; }
          .pdf-stat-card.blue { border-color: #c7d8ff; }
          .pdf-stat-card.green { border-color: #bfe7ca; }
          .pdf-stat-card.gold { border-color: #f3d48a; }
          .pdf-section-block { margin-top: 14px; }
          .pdf-section-block h3 { margin: 0 0 10px; padding-left: 8px; border-left: 4px solid #da291c; color: #c22820; font-size: 13px; }
          .pdf-analytics-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
          .pdf-analytics-card { border: 1px solid #d6dee8; border-radius: 10px; padding: 10px 12px; }
          .pdf-analytics-card h4 { margin: 0 0 8px; font-size: 12px; color: #0f172a; }
          .pdf-analytics-rows { display: grid; gap: 5px; }
          .pdf-analytics-row { display: grid; grid-template-columns: minmax(80px, 0.75fr) minmax(0, 1.25fr); gap: 8px; align-items: start; font-size: 10px; }
          .pdf-analytics-row strong { font-size: 10px; text-align: right; overflow-wrap: anywhere; }
          table { width: 100%; border-collapse: collapse; font-size: ${tableFontSize}; table-layout: fixed; }
          th, td { border: 1px solid #d6dee8; padding: ${tableCellPadding}; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
          th { background: #f8fafc; color: #0f172a; font-size: 9px; }
          .empty-row { text-align: center; color: #6b7280; }
          .pdf-footer { position: absolute; left: 2mm; right: 2mm; bottom: 4mm; padding-top: 6px; border-top: 1px solid #d6dee8; display: flex; justify-content: space-between; font-size: 9px; }
        </style>
      </head>
      <body>
        ${firstPage}
        ${tablePagesHtml}
      </body>
    </html>
  `);
  reportDoc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    document.title = previousDocumentTitle;
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 250);
}

// eslint-disable-next-line no-unused-vars
function Toolbar({
  searchId,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  datePreset,
  onDatePresetChange,
  onPdfClick,
  pdfLabel,
}) {
  return (
    <div className="manager-toolbar">
      <div className="manager-toolbar__filters">
        <label className="manager-search" htmlFor={searchId}>
          <FaSearch size={14} />
          <input
            id={searchId}
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchChange}
          />
        </label>

        {onDatePresetChange && (
          <label className="manager-select" htmlFor={`${searchId}-date-preset`}>
            <span>Date Range</span>
            <select
              id={`${searchId}-date-preset`}
              value={datePreset}
              onChange={onDatePresetChange}
            >
              {DATE_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button type="button" className="manager-report-btn" onClick={onPdfClick}>
        <FaFilePdf size={15} />
        <span>{pdfLabel}</span>
      </button>
    </div>
  );
}

function ManagerPortal({ roleType }) {
  const navigate = useNavigate();
  const { username } = useParams();
  const normalizedRole = String(roleType || "")
    .trim()
    .toUpperCase();
  const agentTableTopScrollRef = useRef(null);
  const agentTableScrollRef = useRef(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [agentSearch, setAgentSearch] = useState("");
  const [agentSort, setAgentSort] = useState("usernameAsc");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedUnitName, setSelectedUnitName] = useState("");
  const [unitPerformanceTab, setUnitPerformanceTab] = useState("clients");
  // eslint-disable-next-line no-unused-vars
  const [taskSearch, setTaskSearch] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [salesSearch, setSalesSearch] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [taskDatePreset, setTaskDatePreset] = useState("ALL");
  // eslint-disable-next-line no-unused-vars
  const [salesDatePreset, setSalesDatePreset] = useState("ALL");
  const [unitPerformanceDatePreset, setUnitPerformanceDatePreset] = useState("ALL");
  const [portalData, setPortalData] = useState(null);
  const [kpiData, setKpiData] = useState(null);
  const [kpiDrafts, setKpiDrafts] = useState({});
  const [lastAssignedKpiDrafts, setLastAssignedKpiDrafts] = useState({});
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiSavingKey, setKpiSavingKey] = useState("");
  const [editingKpiKey, setEditingKpiKey] = useState("");
  const [expandedKpiKey, setExpandedKpiKey] = useState("");
  const [kpiFieldErrors, setKpiFieldErrors] = useState({});
  const [kpiMessage, setKpiMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sideNavCollapsed, setSideNavCollapsed] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const syncAgentTableScroll = (source) => {
    const topScroller = agentTableTopScrollRef.current;
    const tableScroller = agentTableScrollRef.current;
    if (!topScroller || !tableScroller) return;
    const sourceScroller = source === "top" ? topScroller : tableScroller;
    const targetScroller = source === "top" ? tableScroller : topScroller;
    const sourceMax = Math.max(1, sourceScroller.scrollWidth - sourceScroller.clientWidth);
    const targetMax = Math.max(0, targetScroller.scrollWidth - targetScroller.clientWidth);
    const nextLeft = (sourceScroller.scrollLeft / sourceMax) * targetMax;
    if (Math.abs(targetScroller.scrollLeft - nextLeft) > 1) targetScroller.scrollLeft = nextLeft;
  };

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("managerPortalUser") || "null");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== normalizedRole) {
      localStorage.setItem("role", normalizedRole);
      navigate("/login", { replace: true });
      return;
    }

    if (user.username !== username) {
      navigate(`/${normalizedRole.toLowerCase()}/${user.username}`, {
        replace: true,
      });
    }
  }, [navigate, normalizedRole, user, username]);

  useEffect(() => {
    const branchPageLabels = {
      dashboard: "Home",
      agents: "Branch Units",
      kpi_assignment: "Branch KPI Assignment",
      kpi_progress: "Branch KPI Progress",
    };
    const unitPageLabels = {
      dashboard: "Home",
      agents: "Unit",
      kpi_assignment: "Branch KPI Assignment",
      kpi_progress: "Branch KPI Progress Dashboard",
    };
    const pageLabels = normalizedRole === "BM" ? branchPageLabels : unitPageLabels;
    document.title = `${user?.username || normalizedRole} | ${pageLabels[activeView] || pageLabels.dashboard}`;
  }, [activeView, normalizedRole, user?.username]);

  useEffect(() => {
    if (!user?.id || user.role !== normalizedRole) return;

    const controller = new AbortController();

    const fetchPortalData = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const params = new URLSearchParams({
          userId: user.id,
          taskDatePreset,
          salesDatePreset,
          unitPerformanceDatePreset,
        });
        const res = await fetch(
          `${API_BASE}/api/manager/portal?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.message || "Failed to load manager portal data.",
          );
        }

        setPortalData(data);
      } catch (err) {
        if (err.name === "AbortError") return;
        setLoadError(err.message || "Failed to load manager portal data.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchPortalData();
    return () => controller.abort();
  }, [
    normalizedRole,
    refreshCount,
    salesDatePreset,
    taskDatePreset,
    unitPerformanceDatePreset,
    user?.id,
    user?.role,
  ]);

  useEffect(() => {
    if (!user?.id || user.role !== normalizedRole) return;
    if (!["agents", "kpi_assignment", "kpi_progress"].includes(activeView)) return;

    const controller = new AbortController();
    const fetchKpis = async () => {
      setKpiLoading(true);
      setKpiMessage("");
      try {
        const res = await fetch(`${API_BASE}/api/manager/kpi-assignments?userId=${user.id}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load KPI assignments.");
        setKpiData(data);
        const drafts = {};
        (data.assignments || []).forEach((assignment) => {
          drafts[`${assignment.scopeType}:${assignment.scopeId}`] = (assignment.kpis || []).map(cloneKpiDraft);
        });
        setKpiDrafts(drafts);
        setLastAssignedKpiDrafts((current) => {
          const next = { ...current };
          (data.assignments || []).forEach((assignment) => {
            const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
            (assignment.kpis || []).forEach((kpi) => {
              if (kpi?.assigned !== false) next[`${assignmentKey}:${kpi.key}`] = cloneKpiDraft(kpi);
            });
          });
          return next;
        });
      } catch (err) {
        if (err.name !== "AbortError") setKpiMessage(err.message || "Failed to load KPI assignments.");
      } finally {
        if (!controller.signal.aborted) setKpiLoading(false);
      }
    };
    fetchKpis();
    return () => controller.abort();
  }, [activeView, normalizedRole, refreshCount, user?.id, user?.role]);

  const updateKpiDraft = (assignment, kpiKey, field, value) => {
    const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
    setKpiDrafts((current) => ({
      ...current,
      [assignmentKey]: (current[assignmentKey] || assignment.kpis || []).map((kpi) => {
        if (kpi.key !== kpiKey) return kpi;
        const next = { ...kpi, [field]: field === "assigned" ? value === true : value };
        if (field === "assigned" && value !== true) return buildUnassignedKpiDraft(next);
        if (field === "assigned" && value === true && !KPI_FREQUENCIES.includes(next.period)) {
          next.period = KPI_FREQUENCIES[0];
        }
        if (field === "targetValue" && String(value || "").trim()) {
          next.targetMin = "";
          next.targetMax = "";
        }
        if ((field === "targetMin" || field === "targetMax") && String(value || "").trim()) {
          next.targetValue = "";
        }
        if (field === "period") {
          const primaryTarget = getKpiTargets(next).find((target) => target.period === value) || {};
          next.targetMin = primaryTarget.targetMin ?? "";
          next.targetMax = primaryTarget.targetMax ?? "";
          next.targetValue = primaryTarget.targetValue ?? "";
        }
        return next;
      }),
    }));
  };

  const updateKpiTargetDraft = (assignment, kpiKey, period, field, value) => {
    const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
    const rowKey = `${assignmentKey}:${kpiKey}`;
    setKpiDrafts((current) => ({
      ...current,
      [assignmentKey]: (current[assignmentKey] || assignment.kpis || []).map((kpi) => {
        if (kpi.key !== kpiKey) return kpi;
        const baseTargets = getKpiTargets(kpi);
        const shouldCopyAcrossFrequencies = shouldCopyKpiValueAcrossFrequencies(kpi) && period === kpi.period;
        const shouldScaleAcrossFrequencies = !shouldCopyKpiValueAcrossFrequencies(kpi) && (kpi.valueType === "Currency" || kpi.valueType === "Count") && period === kpi.period;
        const hasValue = String(value || "").trim() !== "";
        const nextTargets = baseTargets.map((target) => {
          if (!shouldCopyAcrossFrequencies && !shouldScaleAcrossFrequencies && target.period !== period) return target;
          const nextValue = shouldScaleAcrossFrequencies && hasValue
            ? scaleKpiTargetValue(value, kpi.valueType, period, target.period)
            : value;
          const nextTarget = { ...target, [field]: nextValue };
          if (field === "targetValue" && hasValue) {
            nextTarget.targetMin = "";
            nextTarget.targetMax = "";
          }
          if ((field === "targetMin" || field === "targetMax") && hasValue) {
            nextTarget.targetValue = "";
          }
          return nextTarget;
        });
        if (period === kpi.period) {
          return buildKpiTargetsFromDefault({ ...kpi, targets: nextTargets }, kpi.period);
        }
        const primaryTarget = nextTargets.find((target) => target.period === kpi.period) || nextTargets[0] || {};
        return {
          ...kpi,
          targets: nextTargets,
          targetMin: primaryTarget.targetMin,
          targetMax: primaryTarget.targetMax,
          targetValue: primaryTarget.targetValue,
        };
      }),
    }));
    setKpiFieldErrors((current) => {
      const next = { ...(current[rowKey] || {}) };
      delete next[`${period}.${field}`];
      if (field === "targetValue") {
        delete next[`${period}.targetMin`];
        delete next[`${period}.targetMax`];
      }
      if (field === "targetMin" || field === "targetMax") delete next[`${period}.targetValue`];
      return { ...current, [rowKey]: next };
    });
  };

  const prefillKpiTargetsFromDefault = (assignment, kpiKey, defaultPeriodOverride = "") => {
    const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
    const rowKey = `${assignmentKey}:${kpiKey}`;
    setKpiDrafts((current) => ({
      ...current,
      [assignmentKey]: (current[assignmentKey] || assignment.kpis || []).map((kpi) => {
        if (kpi.key !== kpiKey) return kpi;
        return buildKpiTargetsFromDefault(kpi, defaultPeriodOverride);
      }),
    }));
    setKpiFieldErrors((current) => ({ ...current, [rowKey]: {} }));
  };

  const buildUnassignedKpiDraft = (kpi = {}) => ({
    ...kpi,
    assigned: false,
  });

  const restoreAssignedKpiDraft = (assignment, kpiKey, fallbackKpi = {}) => {
    const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
    const rowKey = `${assignmentKey}:${kpiKey}`;
    const restoredKpi = {
      ...(lastAssignedKpiDrafts[rowKey] ? cloneKpiDraft(lastAssignedKpiDrafts[rowKey]) : cloneKpiDraft(fallbackKpi)),
      assigned: true,
    };
    const normalizedKpi = KPI_FREQUENCIES.includes(restoredKpi.period)
      ? restoredKpi
      : buildKpiTargetsFromDefault({ ...restoredKpi, period: KPI_FREQUENCIES[0] }, KPI_FREQUENCIES[0]);
    setKpiDrafts((current) => ({
      ...current,
      [assignmentKey]: (current[assignmentKey] || assignment.kpis || []).map((kpi) => (kpi.key === kpiKey ? normalizedKpi : kpi)),
    }));
    setKpiFieldErrors((current) => ({ ...current, [rowKey]: {} }));
  };

  const validateKpiDraft = (kpi) => {
    const errors = {};
    getKpiTargets(kpi).forEach((target) => {
      const prefix = target.period;
      const hasMin = String(target.targetMin ?? "").trim() !== "";
      const hasMax = String(target.targetMax ?? "").trim() !== "";
      const hasTarget = String(target.targetValue ?? "").trim() !== "";
      const min = Number(target.targetMin);
      const max = Number(target.targetMax);
      const targetValue = Number(target.targetValue);

      if (kpi?.assigned !== false && !hasTarget && !hasMin && !hasMax) {
        errors[`${prefix}.targetValue`] = "Target or min/max is required.";
      }
      if (hasTarget && !Number.isFinite(targetValue)) errors[`${prefix}.targetValue`] = "Enter a valid number.";
      if (hasMin && !Number.isFinite(min)) errors[`${prefix}.targetMin`] = "Enter a valid number.";
      if (hasMax && !Number.isFinite(max)) errors[`${prefix}.targetMax`] = "Enter a valid number.";
      if (hasTarget && Number.isFinite(targetValue) && targetValue < 0) errors[`${prefix}.targetValue`] = "Negative values are not allowed.";
      if (hasMin && Number.isFinite(min) && min < 0) errors[`${prefix}.targetMin`] = "Negative values are not allowed.";
      if (hasMax && Number.isFinite(max) && max < 0) errors[`${prefix}.targetMax`] = "Negative values are not allowed.";
      if (hasTarget && Number.isFinite(targetValue) && !Number.isInteger(targetValue)) errors[`${prefix}.targetValue`] = "Whole numbers are counted only.";
      if (hasMin && Number.isFinite(min) && !Number.isInteger(min)) errors[`${prefix}.targetMin`] = "Whole numbers are counted only.";
      if (hasMax && Number.isFinite(max) && !Number.isInteger(max)) errors[`${prefix}.targetMax`] = "Whole numbers are counted only.";
      if (hasMin && hasMax && Number.isFinite(min) && Number.isFinite(max) && min >= max) {
        errors[`${prefix}.targetMin`] = "Min must be less than max.";
        errors[`${prefix}.targetMax`] = "Max must be greater than min.";
      }
    });
    return errors;
  };

  const saveKpi = async (assignment, kpiKey, kpiOverride = null) => {
    const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
    const draftList = kpiOverride
      ? (kpiDrafts[assignmentKey] || assignment.kpis || []).map((item) => (item.key === kpiKey ? kpiOverride : item))
      : (kpiDrafts[assignmentKey] || assignment.kpis || []);
    const kpi = kpiOverride || draftList.find((item) => item.key === kpiKey);
    const rowKey = `${assignmentKey}:${kpiKey}`;
    const validationErrors = validateKpiDraft(kpi || {});
    if (Object.keys(validationErrors).length) {
      setKpiFieldErrors((current) => ({ ...current, [rowKey]: validationErrors }));
      setExpandedKpiKey(rowKey);
      return;
    }
    setKpiFieldErrors((current) => ({ ...current, [rowKey]: {} }));

    const currentDraft = cloneKpiDraft(kpi || {});

    const savingKey = `${assignmentKey}:${kpiKey}`;
    setKpiSavingKey(savingKey);
    setKpiMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/manager/kpi-assignments/${assignment.scopeType}/${assignment.scopeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          kpis: [currentDraft],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save KPI assignment.");
      setKpiData((current) => ({
        ...(current || {}),
        assignments: (current?.assignments || []).map((item) =>
          item.scopeType === assignment.scopeType && item.scopeId === assignment.scopeId
            ? { ...item, kpis: data.assignment?.kpis || item.kpis, updatedAt: data.assignment?.updatedAt || item.updatedAt }
            : item,
        ),
      }));
      setKpiDrafts((current) => ({ ...current, [assignmentKey]: (data.assignment?.kpis || current[assignmentKey] || []).map(cloneKpiDraft) }));
      const savedKpi = (data.assignment?.kpis || []).find((item) => item.key === kpiKey);
      if ((savedKpi || kpi)?.assigned !== false) {
        setLastAssignedKpiDrafts((current) => ({ ...current, [rowKey]: cloneKpiDraft(savedKpi || kpi) }));
      }
      setEditingKpiKey("");
      setExpandedKpiKey("");
      setKpiMessage(kpi?.assigned === false ? "KPI unassigned." : "KPI saved.");
    } catch (err) {
      setKpiMessage(err.message || "Failed to save KPI assignment.");
    } finally {
      setKpiSavingKey("");
    }
  };

  const cancelKpiEdit = (assignment, kpiKey) => {
    const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
    const savedAssignment = (kpiData?.assignments || []).find((item) => item.scopeType === assignment.scopeType && item.scopeId === assignment.scopeId);
    const savedKpi = (savedAssignment?.kpis || assignment.kpis || []).find((item) => item.key === kpiKey);
    const rowKey = `${assignmentKey}:${kpiKey}`;
    setKpiDrafts((current) => ({
      ...current,
      [assignmentKey]: (current[assignmentKey] || assignment.kpis || []).map((kpi) => (kpi.key === kpiKey ? cloneKpiDraft(savedKpi || kpi) : kpi)),
    }));
    setKpiFieldErrors((current) => ({ ...current, [rowKey]: {} }));
    setEditingKpiKey("");
    setExpandedKpiKey("");
  };

  const handleLogout = () => {
    localStorage.removeItem("managerPortalUser");
    localStorage.setItem("role", normalizedRole);
    navigate("/login", { replace: true });
  };

  const summary = portalData?.summary || {
    totalAgents: 0,
    totalOpenTasks: 0,
    totalOverdueTasks: 0,
    totalClosedTasks: 0,
    totalLeads: 0,
    totalActiveLeads: 0,
    totalConverted: 0,
    totalPolicies: 0,
    activePolicies: 0,
    totalAnnualPremium: 0,
    totalFrequencyPremium: 0,
    conversionRate: 0,
    completionRate: 0,
    activePolicyRate: 0,
    frequencyPremiumBreakdown: {
      monthlyPremium: 0,
      quarterlyPremium: 0,
      halfYearlyPremium: 0,
      yearlyPremium: 0,
    },
  };
  const taskSummary = portalData?.taskSummary || summary;
  const salesSummary = portalData?.salesSummary || summary;
  const summaryFrequencyPremiumCards = [
    { key: "monthlyPremium", label: "Monthly Premium" },
    { key: "quarterlyPremium", label: "Quarterly Premium" },
    { key: "halfYearlyPremium", label: "Half-Yearly Premium" },
    { key: "yearlyPremium", label: "Yearly Premium" },
  ]
    .map((item) => ({
      ...item,
      value: Number(summary.frequencyPremiumBreakdown?.[item.key] || 0),
    }));

  const unitOptions = useMemo(() => {
    const backendUnits = (portalData?.units || []).map((unit) => ({
      ...unit,
      name: String(unit?.name || "").trim(),
    })).filter((unit) => unit.name);
    const sortedBackendUnits = backendUnits.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
    if (sortedBackendUnits.length) return [{ name: "All Units", isAllUnits: true }, ...sortedBackendUnits];
    const fallbackUnits = [...new Set((portalData?.agents || []).map((agent) => String(agent?.unit || "").trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map((name) => ({ name, manager: { code: "—", name: "—" }, assistantManager: { code: "—", name: "—" } }));
    return fallbackUnits.length ? [{ name: "All Units", isAllUnits: true }, ...fallbackUnits] : fallbackUnits;
  }, [portalData?.agents, portalData?.units]);

  useEffect(() => {
    if (!unitOptions.length) return;
    if (!selectedUnitName || !unitOptions.some((unit) => unit.name === selectedUnitName)) {
      setSelectedUnitName(unitOptions[0].name);
    }
  }, [selectedUnitName, unitOptions]);

  useEffect(() => {
    setAgentSort("usernameAsc");
  }, [unitPerformanceTab]);

  const selectedUnit = unitOptions.find((unit) => unit.name === selectedUnitName) || unitOptions[0] || null;
  const isAllUnitsSelected = selectedUnit?.isAllUnits === true;

  const selectedUnitRows = useMemo(
    () => (portalData?.unitPerformanceRows || portalData?.agents || []).filter((agent) => (selectedUnit?.name && !isAllUnitsSelected ? String(agent?.unit || "") === selectedUnit.name : true)),
    [isAllUnitsSelected, portalData?.agents, portalData?.unitPerformanceRows, selectedUnit?.name],
  );

  const filteredAgents = useMemo(() => {
    const searchedAgents = buildFilter(selectedUnitRows, agentSearch, ["username", "name"]);
    const sortedAgents = [...searchedAgents].sort((left, right) => {
      const compareNumber = (key) => Number(left?.[key] || 0) - Number(right?.[key] || 0);
      const compareDerived = (resolver) => Number(resolver(left) || 0) - Number(resolver(right) || 0);
      const unconvertedLeads = (row) => Math.max(0, Number(row?.leads || 0) - Number(row?.converted || 0));
      const activePolicyRate = (row) => Number(row?.totalPolicies || 0) ? Math.round((Number(row?.activePolicies || 0) / Number(row?.totalPolicies || 0)) * 100) : 0;
      const compareUsername = () =>
        String(left?.username || "").localeCompare(String(right?.username || ""), undefined, { numeric: true, sensitivity: "base" });

      switch (agentSort) {
        case "totalProspectsDesc":
          return compareNumber("totalProspects") * -1 || compareUsername();
        case "totalProspectsAsc":
          return compareNumber("totalProspects") || compareUsername();
        case "activeProspectsDesc":
          return compareNumber("activeProspects") * -1 || compareUsername();
        case "activeProspectsAsc":
          return compareNumber("activeProspects") || compareUsername();
        case "leadsDesc":
          return compareNumber("leads") * -1 || compareUsername();
        case "leadsAsc":
          return compareNumber("leads") || compareUsername();
        case "totalTasksDesc":
          return compareNumber("totalTasks") * -1 || compareUsername();
        case "totalTasksAsc":
          return compareNumber("totalTasks") || compareUsername();
        case "openTasksDesc":
          return compareNumber("openTasks") * -1 || compareUsername();
        case "openTasksAsc":
          return compareNumber("openTasks") || compareUsername();
        case "overdueTasksDesc":
          return compareNumber("overdueTasks") * -1 || compareUsername();
        case "overdueTasksAsc":
          return compareNumber("overdueTasks") || compareUsername();
        case "onTimeDoneTasksDesc":
          return (compareNumber("closedTasks") - compareNumber("delayedDoneTasks")) * -1 || compareUsername();
        case "onTimeDoneTasksAsc":
          return (compareNumber("closedTasks") - compareNumber("delayedDoneTasks")) || compareUsername();
        case "overallCompletionRateDesc":
          return compareNumber("completionRate") * -1 || compareUsername();
        case "overallCompletionRateAsc":
          return compareNumber("completionRate") || compareUsername();
        case "onTimeCompletionRateDesc":
          return ((((Number(left?.closedTasks || 0) - Number(left?.delayedDoneTasks || 0)) / (Number(left?.closedTasks || 0) || 1)) || 0) - (((Number(right?.closedTasks || 0) - Number(right?.delayedDoneTasks || 0)) / (Number(right?.closedTasks || 0) || 1)) || 0)) * -1 || compareUsername();
        case "onTimeCompletionRateAsc":
          return ((((Number(left?.closedTasks || 0) - Number(left?.delayedDoneTasks || 0)) / (Number(left?.closedTasks || 0) || 1)) || 0) - (((Number(right?.closedTasks || 0) - Number(right?.delayedDoneTasks || 0)) / (Number(right?.closedTasks || 0) || 1)) || 0)) || compareUsername();
        case "lateCompletionRateDesc":
          return ((Number(left?.delayedDoneTasks || 0) / (Number(left?.closedTasks || 0) || 1)) - (Number(right?.delayedDoneTasks || 0) / (Number(right?.closedTasks || 0) || 1))) * -1 || compareUsername();
        case "lateCompletionRateAsc":
          return (Number(left?.delayedDoneTasks || 0) / (Number(left?.closedTasks || 0) || 1)) - (Number(right?.delayedDoneTasks || 0) / (Number(right?.closedTasks || 0) || 1)) || compareUsername();
        case "annualPremiumDesc":
          return compareNumber("annualPremium") * -1 || compareUsername();
        case "annualPremiumAsc":
          return compareNumber("annualPremium") || compareUsername();
        case "convertedDesc":
          return compareNumber("converted") * -1 || compareUsername();
        case "convertedAsc":
          return compareNumber("converted") || compareUsername();
        case "unconvertedDesc":
          return compareDerived(unconvertedLeads) * -1 || compareUsername();
        case "unconvertedAsc":
          return compareDerived(unconvertedLeads) || compareUsername();
        case "conversionRateDesc":
          return compareNumber("conversionRate") * -1 || compareUsername();
        case "conversionRateAsc":
          return compareNumber("conversionRate") || compareUsername();
        case "activePolicyRateDesc":
          return compareDerived(activePolicyRate) * -1 || compareUsername();
        case "activePolicyRateAsc":
          return compareDerived(activePolicyRate) || compareUsername();
        case "monthlyPremiumDesc":
          return compareNumber("monthlyPremium") * -1 || compareUsername();
        case "monthlyPremiumAsc":
          return compareNumber("monthlyPremium") || compareUsername();
        case "quarterlyPremiumDesc":
          return compareNumber("quarterlyPremium") * -1 || compareUsername();
        case "quarterlyPremiumAsc":
          return compareNumber("quarterlyPremium") || compareUsername();
        case "halfYearlyPremiumDesc":
          return compareNumber("halfYearlyPremium") * -1 || compareUsername();
        case "halfYearlyPremiumAsc":
          return compareNumber("halfYearlyPremium") || compareUsername();
        case "yearlyPremiumDesc":
          return compareNumber("yearlyPremium") * -1 || compareUsername();
        case "yearlyPremiumAsc":
          return compareNumber("yearlyPremium") || compareUsername();
        case "activeLeadsDesc":
          return compareNumber("activeLeads") * -1 || compareUsername();
        case "activeLeadsAsc":
          return compareNumber("activeLeads") || compareUsername();
        case "activePoliciesDesc":
          return compareNumber("activePolicies") * -1 || compareUsername();
        case "activePoliciesAsc":
          return compareNumber("activePolicies") || compareUsername();
        case "totalPoliciesDesc":
          return compareNumber("totalPolicies") * -1 || compareUsername();
        case "totalPoliciesAsc":
          return compareNumber("totalPolicies") || compareUsername();
        case "atRiskPoliciesDesc":
          return compareNumber("atRiskPolicies") * -1 || compareUsername();
        case "atRiskPoliciesAsc":
          return compareNumber("atRiskPolicies") || compareUsername();
        case "lapsedPoliciesDesc":
          return compareNumber("lapsedPolicies") * -1 || compareUsername();
        case "lapsedPoliciesAsc":
          return compareNumber("lapsedPolicies") || compareUsername();
        default:
          return compareUsername();
      }
    });
    return sortedAgents;
  }, [agentSearch, agentSort, selectedUnitRows]);

  const selectedUnitSummary = useMemo(() => {
    const rows = selectedUnitRows;
    const totals = rows.reduce((acc, row) => ({
      totalProspects: acc.totalProspects + Number(row.totalProspects || 0),
      activeProspects: acc.activeProspects + Number(row.activeProspects || 0),
      leads: acc.leads + Number(row.leads || 0),
      activeLeads: acc.activeLeads + Number(row.activeLeads || 0),
      converted: acc.converted + Number(row.converted || 0),
      totalPolicies: acc.totalPolicies + Number(row.totalPolicies || 0),
      activePolicies: acc.activePolicies + Number(row.activePolicies || 0),
      atRiskPolicies: acc.atRiskPolicies + Number(row.atRiskPolicies || 0),
      lapsedPolicies: acc.lapsedPolicies + Number(row.lapsedPolicies || 0),
      totalTasks: acc.totalTasks + Number(row.totalTasks || 0),
      openTasks: acc.openTasks + Number(row.openTasks || 0),
      overdueTasks: acc.overdueTasks + Number(row.overdueTasks || 0),
      closedTasks: acc.closedTasks + Number(row.closedTasks || 0),
      delayedDoneTasks: acc.delayedDoneTasks + Number(row.delayedDoneTasks || 0),
      annualPremium: acc.annualPremium + Number(row.annualPremium || 0),
      frequencyPremium: acc.frequencyPremium + Number(row.frequencyPremium || 0),
      monthlyPremium: acc.monthlyPremium + Number(row.monthlyPremium || 0),
      quarterlyPremium: acc.quarterlyPremium + Number(row.quarterlyPremium || 0),
      halfYearlyPremium: acc.halfYearlyPremium + Number(row.halfYearlyPremium || 0),
      yearlyPremium: acc.yearlyPremium + Number(row.yearlyPremium || 0),
    }), { totalProspects: 0, activeProspects: 0, leads: 0, activeLeads: 0, converted: 0, totalPolicies: 0, activePolicies: 0, atRiskPolicies: 0, lapsedPolicies: 0, totalTasks: 0, openTasks: 0, overdueTasks: 0, closedTasks: 0, delayedDoneTasks: 0, annualPremium: 0, frequencyPremium: 0, monthlyPremium: 0, quarterlyPremium: 0, halfYearlyPremium: 0, yearlyPremium: 0 });
    totals.onTimeDoneTasks = Math.max(0, totals.closedTasks - totals.delayedDoneTasks);
    totals.overallCompletionRate = totals.totalTasks ? Math.round((totals.closedTasks / totals.totalTasks) * 100) : 0;
    totals.onTimeCompletionRate = totals.closedTasks ? Math.round((totals.onTimeDoneTasks / totals.closedTasks) * 100) : 0;
    totals.lateCompletionRate = totals.closedTasks ? Math.round((totals.delayedDoneTasks / totals.closedTasks) * 100) : 0;
    totals.unconverted = Math.max(0, totals.leads - totals.converted);
    totals.conversionRate = totals.leads ? Math.round((totals.converted / totals.leads) * 100) : 0;
    totals.activePolicyRate = totals.totalPolicies ? Math.round((totals.activePolicies / totals.totalPolicies) * 100) : 0;
    return totals;
  }, [selectedUnitRows]);

  const selectedKpiPeriod = getKpiPeriodForDatePreset(unitPerformanceDatePreset);

  const selectedUnitKpiCards = useMemo(() => {
    if (isAllUnitsSelected || !selectedKpiPeriod) return [];
    const unitAssignment = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "UNIT");
    if (!unitAssignment) return [];
    const rowsForSelectedPeriod = (portalData?.kpiSalesRowsByFrequency?.[selectedKpiPeriod] || [])
      .filter((row) => String(row?.unit || "") === String(selectedUnit?.name || ""));
    const periodSummary = summarizeKpiRows(rowsForSelectedPeriod);

    return (unitAssignment.kpis || []).filter((kpi) => kpi.assigned !== false && kpi.key === "monthly_sales_production").map((kpi) => {
      const kpiForPeriod = selectKpiTargetForPeriod(kpi, selectedKpiPeriod);
      const actualByKey = {
        monthly_sales_production: Number(periodSummary.totalAnnualPremium || 0),
      };
      const actual = actualByKey[kpi.key] || 0;
      return { kpi: kpiForPeriod, actual, comparison: getKpiComparison(actual, kpiForPeriod), dateRangeLabel: getKpiFrequencyRangeLabel(selectedKpiPeriod) };
    });
  }, [isAllUnitsSelected, kpiData?.assignments, portalData?.kpiSalesRowsByFrequency, selectedKpiPeriod, selectedUnit?.name]);

  const unitPerformancePeriodLabel = useMemo(() => {
    const reportContext = portalData?.reportContext || {};
    const endDate = reportContext.unitPerformanceEndDate ? new Date(reportContext.unitPerformanceEndDate) : new Date();
    const startDate = reportContext.unitPerformanceStartDate ? new Date(reportContext.unitPerformanceStartDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) return `All Time to ${formatDate(endDate)}`;
    if (unitPerformanceDatePreset === "TODAY") return formatDate(endDate);
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }, [portalData?.reportContext, unitPerformanceDatePreset]);

  const unitSortLabel = useMemo(() => {
    const selectLabels = {
      usernameAsc: "Username (A → Z)",
      totalProspectsDesc: "Total Prospects (High → Low)",
      totalProspectsAsc: "Total Prospects (Low → High)",
      activeProspectsDesc: "Active Prospects (High → Low)",
      activeProspectsAsc: "Active Prospects (Low → High)",
      leadsDesc: "Total Leads (High → Low)",
      leadsAsc: "Total Leads (Low → High)",
      activeLeadsDesc: "Active Leads (High → Low)",
      activeLeadsAsc: "Active Leads (Low → High)",
      totalPoliciesDesc: "Total Policyholders (High → Low)",
      totalPoliciesAsc: "Total Policyholders (Low → High)",
      activePoliciesDesc: "Active Policyholders (High → Low)",
      activePoliciesAsc: "Active Policyholders (Low → High)",
      atRiskPoliciesDesc: "At Risk Policyholders (High → Low)",
      atRiskPoliciesAsc: "At Risk Policyholders (Low → High)",
      lapsedPoliciesDesc: "Lapsed Policies (High → Low)",
      lapsedPoliciesAsc: "Lapsed Policies (Low → High)",
      totalTasksDesc: "Total Tasks (High → Low)",
      totalTasksAsc: "Total Tasks (Low → High)",
      openTasksDesc: "Open Tasks (High → Low)",
      openTasksAsc: "Open Tasks (Low → High)",
      overdueTasksDesc: "Overdue Tasks (High → Low)",
      overdueTasksAsc: "Overdue Tasks (Low → High)",
      onTimeDoneTasksDesc: "On-Time Done Tasks (High → Low)",
      onTimeDoneTasksAsc: "On-Time Done Tasks (Low → High)",
      overallCompletionRateDesc: "Overall Completion Rate (High → Low)",
      overallCompletionRateAsc: "Overall Completion Rate (Low → High)",
      onTimeCompletionRateDesc: "On-Time Completion Rate (High → Low)",
      onTimeCompletionRateAsc: "On-Time Completion Rate (Low → High)",
      lateCompletionRateDesc: "Late Completion Rate (High → Low)",
      lateCompletionRateAsc: "Late Completion Rate (Low → High)",
      annualPremiumDesc: "Total Annual Premium (High → Low)",
      annualPremiumAsc: "Total Annual Premium (Low → High)",
      convertedDesc: "Converted Leads (High → Low)",
      convertedAsc: "Converted Leads (Low → High)",
      unconvertedDesc: "Unconverted Leads (High → Low)",
      unconvertedAsc: "Unconverted Leads (Low → High)",
      conversionRateDesc: "Conversion Rate (High → Low)",
      conversionRateAsc: "Conversion Rate (Low → High)",
      activePolicyRateDesc: "Active Policy Rate (High → Low)",
      activePolicyRateAsc: "Active Policy Rate (Low → High)",
      monthlyPremiumDesc: "Monthly Premium (High → Low)",
      monthlyPremiumAsc: "Monthly Premium (Low → High)",
      quarterlyPremiumDesc: "Quarterly Premium (High → Low)",
      quarterlyPremiumAsc: "Quarterly Premium (Low → High)",
      halfYearlyPremiumDesc: "Half-Yearly Premium (High → Low)",
      halfYearlyPremiumAsc: "Half-Yearly Premium (Low → High)",
      yearlyPremiumDesc: "Yearly Premium (High → Low)",
      yearlyPremiumAsc: "Yearly Premium (Low → High)",
    };
    return selectLabels[agentSort] || selectLabels.usernameAsc;
  }, [agentSort]);

  const selectedAgent = useMemo(
    () => (portalData?.agents || []).find((agent) => String(agent?.id || "") === selectedAgentId) || null,
    [portalData?.agents, selectedAgentId],
  );

  const selectedAgentKpiCards = useMemo(() => {
    if (!selectedAgent) return [];
    const assignments = (kpiData?.assignments || []).filter((assignment) => assignment.scopeType === "AGENT");

    return assignments.flatMap((assignment) =>
      (assignment.kpis || [])
        .filter((kpi) => kpi.assigned !== false)
        .map((kpi) => {
          const rowsForFrequency = portalData?.kpiSalesRowsByFrequency?.[kpi.period] || [];
          const agentRow = rowsForFrequency.find((row) => String(row?.userId || "") === String(selectedAgent.userId || "")) || selectedAgent || {};
          const actualByKey = {
            weekly_approaches: 0,
            weekly_appointments: 0,
            weekly_presentations: 0,
            monthly_policies: Number(agentRow.totalPolicies || selectedAgent.totalPolicies || 0),
            monthly_new_prospects: Number(agentRow.totalProspects || selectedAgent.totalProspects || 0),
            monthly_closing_ratio: Number(agentRow.conversionRate || selectedAgent.conversionRate || 0),
          };
          const actual = actualByKey[kpi.key] || 0;
          return {
            assignment,
            kpi,
            actual,
            comparison: getKpiComparison(actual, kpi),
            dateRangeLabel: getKpiFrequencyRangeLabel(kpi.period),
          };
        }),
    );
  }, [kpiData?.assignments, portalData?.kpiSalesRowsByFrequency, selectedAgent]);

  const filteredTaskRows = useMemo(
    () =>
      sortByAgentCode(
        buildFilter(portalData?.taskRows || [], taskSearch, [
          "username",
          "name",
          "unit",
          "topTaskType",
        ]),
      ),
    [portalData?.taskRows, taskSearch],
  );
  const filteredSalesRows = useMemo(
    () =>
      sortByAgentCode(
        buildFilter(portalData?.salesRows || [], salesSearch, [
          "username",
          "name",
          "unit",
        ]),
      ),
    [portalData?.salesRows, salesSearch],
  );

  const branchKpiProgressRows = useMemo(() => {
    const branchAssignment = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "BRANCH");
    if (!branchAssignment) return [];
    const resolveRowsForKpi = (kpi) => portalData?.kpiSalesRowsByFrequency?.[kpi.period] || [];
    const salesProductionKpi = (branchAssignment.kpis || []).find((kpi) => kpi.key === "monthly_sales_production") || {};
    return (branchAssignment.kpis || [])
      .filter((kpi) => kpi.assigned !== false)
      .map((kpi) => {
        const kpiRows = resolveRowsForKpi(kpi);
        const rowSummary = summarizeKpiRows(kpiRows);
        const activeAgentCount = kpiRows.filter((row) => Number(row?.totalPolicies || 0) > 0).length;
        const persistencyRate = rowSummary.totalPolicies ? Math.round((rowSummary.activePolicies / rowSummary.totalPolicies) * 100) : 0;
        const productionTarget = Number(salesProductionKpi.targetValue ?? salesProductionKpi.targetMin ?? 0);
        const targetAchievementIndex = productionTarget ? Math.round((Number(rowSummary.totalAnnualPremium || 0) / productionTarget) * 100) : 0;
        const actualByKey = {
          monthly_sales_production: Number(rowSummary.totalAnnualPremium || 0),
          monthly_active_agents: activeAgentCount,
          monthly_persistency_rate: persistencyRate,
          monthly_target_achievement_index: targetAchievementIndex,
        };
        return {
          assignment: branchAssignment,
          kpi,
          actual: actualByKey[kpi.key] || 0,
          dateRangeLabel: getKpiFrequencyRangeLabel(kpi.period),
        };
      });
  }, [kpiData?.assignments, portalData?.kpiSalesRowsByFrequency]);

  const branchSalesKpiProgressRows = useMemo(() => {
    if (!selectedKpiPeriod) return [];
    const branchAssignment = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "BRANCH");
    if (!branchAssignment) return [];
    const selectedPeriodRows = portalData?.kpiSalesRowsByFrequency?.[selectedKpiPeriod] || [];
    const rowSummary = summarizeKpiRows(selectedPeriodRows);
    const salesProductionKpi = (branchAssignment.kpis || []).find((kpi) => kpi.key === "monthly_sales_production" && kpi.assigned !== false);
    const salesProductionKpiForPeriod = selectKpiTargetForPeriod(salesProductionKpi || {}, selectedKpiPeriod);
    const productionTargetValue = [salesProductionKpiForPeriod.targetValue, salesProductionKpiForPeriod.targetMin, salesProductionKpiForPeriod.targetMax]
      .find((value) => value !== null && value !== undefined && value !== "");
    const productionTarget = Number(productionTargetValue || 0);
    const targetAchievementIndex = productionTarget ? Math.round((Number(rowSummary.totalAnnualPremium || 0) / productionTarget) * 100) : 0;
    const productionTargetLabel = formatKpiTarget({ ...salesProductionKpiForPeriod, valueType: "Currency" });
    const productionActual = Number(rowSummary.totalAnnualPremium || 0);

    return (branchAssignment.kpis || [])
      .filter((kpi) => kpi.assigned !== false && ["monthly_sales_production", "monthly_target_achievement_index"].includes(kpi.key))
      .map((kpi) => {
        const kpiForPeriod = selectKpiTargetForPeriod(kpi, selectedKpiPeriod);
        const actualByKey = {
          monthly_sales_production: Number(rowSummary.totalAnnualPremium || 0),
          monthly_target_achievement_index: targetAchievementIndex,
        };
        return {
          assignment: branchAssignment,
          kpi: kpiForPeriod,
          actual: actualByKey[kpi.key] || 0,
          targetBasis: kpi.key === "monthly_target_achievement_index" ? productionTarget : null,
          targetBasisLabel: kpi.key === "monthly_target_achievement_index" ? productionTargetLabel : "",
          productionActual: kpi.key === "monthly_target_achievement_index" ? productionActual : null,
          dateRangeLabel: getKpiFrequencyRangeLabel(selectedKpiPeriod),
        };
      });
  }, [kpiData?.assignments, portalData?.kpiSalesRowsByFrequency, selectedKpiPeriod]);

  const topUnitSalesAgents = useMemo(
    () => [...selectedUnitRows]
      .filter((row) => Number(row?.annualPremium || 0) > 0)
      .sort((left, right) => Number(right?.annualPremium || 0) - Number(left?.annualPremium || 0) || String(left?.username || "").localeCompare(String(right?.username || ""), undefined, { numeric: true, sensitivity: "base" }))
      .slice(0, 5),
    [selectedUnitRows],
  );

  const branchKpiUnitRows = useMemo(() => {
    const byUnit = new Map();
    const branchAssignment = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "BRANCH");
    const productionFrequency = selectedKpiPeriod || (branchAssignment?.kpis || []).find((kpi) => kpi.key === "monthly_sales_production")?.period || "Monthly";
    const drilldownRows = portalData?.kpiSalesRowsByFrequency?.[productionFrequency] || [];
    drilldownRows.forEach((row) => {
      const unit = row?.unit || "Unassigned Unit";
      if (!byUnit.has(unit)) {
        byUnit.set(unit, { unit, annualPremium: 0, activeAgents: 0, totalPolicies: 0, activePolicies: 0, agents: [] });
      }
      const item = byUnit.get(unit);
      item.annualPremium += Number(row?.annualPremium || 0);
      item.totalPolicies += Number(row?.totalPolicies || 0);
      item.activePolicies += Number(row?.activePolicies || 0);
      if (Number(row?.totalPolicies || 0) > 0) item.activeAgents += 1;
      item.agents.push(row);
    });
    return [...byUnit.values()].map((item) => ({
      ...item,
      persistencyRate: item.totalPolicies ? Math.round((item.activePolicies / item.totalPolicies) * 100) : 0,
      topAgents: [...item.agents]
        .filter((agent) => Number(agent?.annualPremium || 0) > 0)
        .sort((left, right) => Number(right?.annualPremium || 0) - Number(left?.annualPremium || 0) || String(left?.username || "").localeCompare(String(right?.username || ""), undefined, { numeric: true, sensitivity: "base" }))
        .slice(0, 5),
    })).sort((a, b) => b.annualPremium - a.annualPremium || a.unit.localeCompare(b.unit));
  }, [kpiData?.assignments, portalData?.kpiSalesRowsByFrequency, selectedKpiPeriod]);

  const scope = portalData?.scope || {};
  const scopeLabel = getScopeLabel(scope);
  const generatedAtLabel = portalData?.reportContext?.generatedAt
    ? formatDateTime(portalData.reportContext.generatedAt)
    : null;
  const taskPeriodLabel =
    portalData?.reportContext?.taskPeriodLabel ||
    getPresetLabel(taskDatePreset);
  const salesPeriodLabel =
    portalData?.reportContext?.salesPeriodLabel ||
    getPresetLabel(salesDatePreset);
  const totalUnitsInScope =
    normalizedRole === "BM"
      ? new Set(
          (portalData?.agents || [])
            .map((agent) => String(agent?.unit || "").trim())
            .filter(Boolean),
        ).size
      : scope.unitName
        ? 1
        : 0;

  const summaryCards =
    normalizedRole === "BM"
      ? [
          { label: "Total Units", value: totalUnitsInScope },
          { label: "Agents in Scope", value: summary.totalAgents },
          { label: "Open Tasks", value: summary.totalOpenTasks },
          { label: "Total Policies", value: summary.totalPolicies },
          {
            label: "Annual Premium",
            value: formatMoney(summary.totalAnnualPremium),
          },
        ]
      : [
          { label: "Agents in Scope", value: summary.totalAgents },
          { label: "Open Tasks", value: summary.totalOpenTasks },
          { label: "Conversion Rate", value: `${summary.conversionRate}%` },
          { label: "Total Policies", value: summary.totalPolicies },
          {
            label: "Annual Premium",
            value: formatMoney(summary.totalAnnualPremium),
          },
        ];

  const taskReportColumns = [
    { key: "username", label: "Username" },
    { key: "name", label: "Name" },
    { key: "unit", label: "Unit" },
    { key: "totalTasks", label: "Total Tasks" },
    { key: "openTasks", label: "Open" },
    { key: "overdueTasks", label: "Overdue Open" },
    { key: "closedTasks", label: "Done" },
    { key: "delayedDoneTasks", label: "Delayed Done" },
    {
      key: "completionRate",
      label: "Completion Rate",
      render: (row) => `${row.completionRate}%`,
    },
    { key: "topTaskType", label: "Top Task Type" },
  ];

  const salesReportColumns = [
    { key: "username", label: "Username" },
    { key: "name", label: "Name" },
    { key: "unit", label: "Unit" },
    { key: "leads", label: "Total Leads" },
    { key: "converted", label: "Converted Leads" },
    { key: "unconverted", label: "Unconverted Leads" },
    { key: "conversionRate", label: "Conversion Rate" },
    { key: "totalPolicies", label: "Total Policies" },
    { key: "activePolicies", label: "Active Policies" },
    { key: "activePolicyRate", label: "Active Policy Rate" },
    { key: "annualPremium", label: "Total Annual Premium", render: (row) => formatMoney(row.annualPremium) },
    { key: "monthlyPremium", label: "Monthly Premium", render: (row) => formatMoney(row.monthlyPremium) },
    { key: "quarterlyPremium", label: "Quarterly Premium", render: (row) => formatMoney(row.quarterlyPremium) },
    { key: "halfYearlyPremium", label: "Half-Yearly Premium", render: (row) => formatMoney(row.halfYearlyPremium) },
    { key: "yearlyPremium", label: "Yearly Premium", render: (row) => formatMoney(row.yearlyPremium) },
  ];

  const managerNameLabel =
    normalizedRole === "AUM"
      ? "AUM Name"
      : normalizedRole === "UM"
        ? "UM Name"
        : "BM Name";

  const reportTitlePrefix = normalizedRole === "BM" ? "Branch" : "Unit";
  const reportDetailsTitle =
    normalizedRole === "BM" ? "Branch Details" : "Unit Details";
  const reportTaskTitle = `${reportTitlePrefix} Task Performance Report`;
  const reportSalesTitle = `${reportTitlePrefix} Sales Performance Report`;
  const taskDetailTitle = `${reportTitlePrefix} Task Detail`;
  const salesDetailTitle = `${reportTitlePrefix} Sales Detail`;
  const topTaskTypeLeader = [...filteredTaskRows].sort((left, right) => {
    if (right.totalTasks !== left.totalTasks)
      return Number(right.totalTasks || 0) - Number(left.totalTasks || 0);
    return String(left?.username || "").localeCompare(
      String(right?.username || ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );
  })[0];
  const topSalesRows = [...filteredSalesRows].sort((left, right) => {
    if (right.annualPremium !== left.annualPremium)
      return Number(right.annualPremium || 0) - Number(left.annualPremium || 0);
    if (right.converted !== left.converted)
      return Number(right.converted || 0) - Number(left.converted || 0);
    return String(left?.username || "").localeCompare(
      String(right?.username || ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );
  });
  const reportDetails = [
    {
      label:
        normalizedRole === "BM"
          ? "BM Code"
          : normalizedRole === "AUM"
            ? "AUM Code"
            : "Unit Manager Code",
      value: user?.username || "—",
    },
    {
      label: managerNameLabel,
      value:
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.username ||
        "—",
    },
    {
      label: normalizedRole === "BM" ? "Branch" : "Unit",
      value:
        normalizedRole === "BM"
          ? scope.branchName || "—"
          : scope.unitName || "—",
    },
    {
      label: normalizedRole === "BM" ? "Area" : "Branch",
      value:
        normalizedRole === "BM"
          ? scope.areaName || "—"
          : scope.branchName || "—",
    },
    {
      label: normalizedRole === "BM" ? "Total Units" : "Area",
      value:
        normalizedRole === "BM"
          ? String(totalUnitsInScope)
          : scope.areaName || "—",
    },
    { label: "Agents in Scope", value: String(summary.totalAgents || 0) },
  ];

  // eslint-disable-next-line no-unused-vars
  const generateTaskPdfReport = () => {
    const statusDistribution = [
      {
        label: "Open",
        value: `${taskSummary.totalOpenTasks} (${taskSummary.totalOpenTasks + taskSummary.totalClosedTasks ? Math.round((taskSummary.totalOpenTasks / (taskSummary.totalOpenTasks + taskSummary.totalClosedTasks)) * 100) : 0}%)`,
      },
      {
        label: "Done",
        value: `${taskSummary.totalClosedTasks} (${taskSummary.completionRate}%)`,
      },
      { label: "Overdue Open", value: `${taskSummary.totalOverdueTasks}` },
      {
        label: "Delayed Done",
        value: `${filteredTaskRows.reduce((sum, row) => sum + Number(row.delayedDoneTasks || 0), 0)}`,
      },
    ];
    const typeBreakdown = filteredTaskRows
      .map((row) => ({
        label: row.name || row.username,
        value: `${row.topTaskType || "—"} • ${row.totalTasks || 0} tasks`,
      }))
      .slice(0, 8);

    createPrintableReport({
      filename: `${user?.username || normalizedRole} - ${reportTaskTitle}`,
      title: reportTaskTitle,
      periodLabel:
        taskDatePreset === "ALL"
          ? `${taskPeriodLabel}${filteredTaskRows.length ? ` • Updated ${generatedAtLabel || formatDateTime(new Date())}` : ""}`
          : `${formatDate(new Date(Date.now() - (taskDatePreset === "30d" ? 30 : 90) * 24 * 60 * 60 * 1000))} to ${formatDate(new Date())}`,
      detailsTitle: reportDetailsTitle,
      details: reportDetails,
      filters: [
        { label: "Date Range Filter", value: taskPeriodLabel },
        { label: "Search Filter", value: taskSearch.trim() || "All" },
        { label: "Report Scope", value: scopeLabel },
        { label: "Rows Included", value: String(filteredTaskRows.length) },
      ],
      statCards: [
        {
          label: "Total Tasks",
          value: filteredTaskRows.reduce(
            (sum, row) => sum + Number(row.totalTasks || 0),
            0,
          ),
          tone: "red",
        },
        { label: "Open", value: taskSummary.totalOpenTasks, tone: "blue" },
        { label: "Done", value: taskSummary.totalClosedTasks, tone: "green" },
        {
          label: "Overdue",
          value: taskSummary.totalOverdueTasks,
          tone: "gold",
        },
        {
          label: "Completion Rate",
          value: `${taskSummary.completionRate}%`,
          tone: "blue",
        },
        {
          label: "Late Completion Rate",
          value: `${
            filteredTaskRows.reduce(
              (sum, row) => sum + Number(row.closedTasks || 0),
              0,
            )
              ? Math.round(
                  (filteredTaskRows.reduce(
                    (sum, row) => sum + Number(row.delayedDoneTasks || 0),
                    0,
                  ) /
                    Math.max(
                      filteredTaskRows.reduce(
                        (sum, row) => sum + Number(row.closedTasks || 0),
                        0,
                      ),
                      1,
                    )) *
                    100,
                )
              : 0
          }%`,
          tone: "gold",
        },
        {
          label: "Agents Listed",
          value: filteredTaskRows.length,
          tone: "green",
        },
        {
          label: "Top Task Type",
          value: topTaskTypeLeader?.topTaskType || "—",
          tone: "red",
        },
      ],
      analyticsSections: [
        { title: "Status Distribution", rows: statusDistribution },
        {
          title: "Task Type Performance",
          rows: typeBreakdown.length
            ? typeBreakdown
            : [{ label: "No task rows", value: "No rows available." }],
        },
      ],
      tableSections: [
        {
          title: taskDetailTitle,
          columns: taskReportColumns,
          rows: filteredTaskRows,
          pageSize: 14,
          emptyMessage: "No task detail rows available.",
        },
      ],
      orientation: unitPerformanceTab === "sales" ? "landscape" : "portrait",
    });
  };

  const generateKpiPdfReport = () => {
    const kpiTableRows = branchKpiProgressRows.map(({ assignment, kpi, actual, dateRangeLabel }) => {
      const comparison = getKpiComparison(actual, kpi);
      return {
        kpi: formatKpiLabel(kpi, assignment.scopeType),
        frequency: kpi.period,
        dateRange: dateRangeLabel,
        type: kpi.valueType,
        actual: formatActualKpiValue(actual, kpi.valueType),
        target: formatKpiTarget(kpi),
        status: comparison.status,
        gap: comparison.deltaLabel,
        scope: assignment.name,
      };
    });

    createPrintableReport({
      filename: `${user?.username || normalizedRole} - Branch KPI Progress`,
      title: "Branch KPI Progress Dashboard",
      periodLabel: "Default by KPI assignment frequency",
      detailsTitle: reportDetailsTitle,
      details: reportDetails,
      filters: [
        { label: "Report Scope", value: scopeLabel },
        { label: "Assigned KPI Cards", value: String(branchKpiProgressRows.length) },
        { label: "KPI Date Range", value: "Based on each KPI assignment frequency" },
        { label: "Unit Drilldown Rows", value: String(branchKpiUnitRows.length) },
      ],
      statCards: [
        { label: "Sales Production", value: formatMoney(branchKpiProgressRows.find(({ kpi }) => kpi.key === "monthly_sales_production")?.actual || 0), tone: "red" },
        { label: "Active Agents", value: branchKpiProgressRows.find(({ kpi }) => kpi.key === "monthly_active_agents")?.actual || 0, tone: "blue" },
        { label: "Persistency Rate", value: `${branchKpiProgressRows.find(({ kpi }) => kpi.key === "monthly_persistency_rate")?.actual || 0}%`, tone: "green" },
        { label: "KPI Date Range", value: "By assignment frequency", tone: "gold" },
      ],
      analyticsSections: [],
      tableSections: [
        {
          title: "Branch KPI Progress",
          columns: [
            { key: "kpi", label: "KPI" },
            { key: "frequency", label: "Frequency" },
            { key: "dateRange", label: "Date Range" },
            { key: "actual", label: "Actual" },
            { key: "target", label: "Target" },
            { key: "status", label: "Status" },
            { key: "gap", label: "Gap / Excess" },
          ],
          rows: kpiTableRows,
          pageSize: 14,
          emptyMessage: "No branch KPI progress rows available.",
        },
        {
          title: "Unit Drilldown",
          columns: [
            { key: "unit", label: "Unit" },
            { key: "salesProduction", label: "Sales Production" },
            { key: "activeAgents", label: "Active Agents" },
            { key: "persistency", label: "Persistency" },
          ],
          rows: branchKpiUnitRows.map((unit) => ({
            unit: unit.unit,
            salesProduction: formatMoney(unit.annualPremium),
            activeAgents: unit.activeAgents,
            persistency: `${unit.persistencyRate}%`,
          })),
          pageSize: 18,
          emptyMessage: "No unit KPI activity for the branch sales-production KPI frequency.",
        },
      ],
    });
  };

  // eslint-disable-next-line no-unused-vars
  const generateSalesPdfReport = () => {
    const frequencyBreakdown = salesSummary.frequencyPremiumBreakdown || {
      monthlyPremium: 0,
      quarterlyPremium: 0,
      halfYearlyPremium: 0,
      yearlyPremium: 0,
    };

    createPrintableReport({
      filename: `${user?.username || normalizedRole} - ${reportSalesTitle}`,
      title: reportSalesTitle,
      periodLabel:
        salesDatePreset === "ALL"
          ? salesPeriodLabel
          : `${formatDate(new Date(Date.now() - (salesDatePreset === "30d" ? 30 : 90) * 24 * 60 * 60 * 1000))} to ${formatDate(new Date())}`,
      detailsTitle: reportDetailsTitle,
      details: reportDetails,
      filters: [
        { label: "Date Range Filter", value: salesPeriodLabel },
        { label: "Search Filter", value: salesSearch.trim() || "All" },
        { label: "Report Scope", value: scopeLabel },
        { label: "Rows Included", value: String(filteredSalesRows.length) },
      ],
      statCards: [
        { label: "Total Leads", value: salesSummary.totalLeads, tone: "red" },
        {
          label: "Converted",
          value: salesSummary.totalConverted,
          tone: "green",
        },
        { label: "Policies", value: salesSummary.totalPolicies, tone: "blue" },
        {
          label: "Active Policy Rate",
          value: `${salesSummary.activePolicyRate}%`,
          tone: "gold",
        },
        {
          label: "Annual Premium",
          value: formatMoney(salesSummary.totalAnnualPremium),
          tone: "blue",
        },
        {
          label: "Monthly Premium",
          value: formatMoney(frequencyBreakdown.monthlyPremium),
          tone: "green",
        },
        {
          label: "Quarterly Premium",
          value: formatMoney(frequencyBreakdown.quarterlyPremium),
          tone: "gold",
        },
        {
          label: "Half-yearly Premium",
          value: formatMoney(frequencyBreakdown.halfYearlyPremium),
          tone: "red",
        },
      ],
      analyticsSections: [
        {
          title: "Frequency Premium Breakdown",
          rows: [
            {
              label: "Monthly",
              value: formatMoney(frequencyBreakdown.monthlyPremium),
            },
            {
              label: "Quarterly",
              value: formatMoney(frequencyBreakdown.quarterlyPremium),
            },
            {
              label: "Half-yearly",
              value: formatMoney(frequencyBreakdown.halfYearlyPremium),
            },
            {
              label: "Yearly",
              value: formatMoney(frequencyBreakdown.yearlyPremium),
            },
          ],
        },
        {
          title: "Top Sales Producers",
          rows: topSalesRows.length
            ? topSalesRows.slice(0, 8).map((row) => ({
                label: row.name || row.username,
                value: formatMoney(row.annualPremium),
              }))
            : [{ label: "No sales rows", value: "No rows available." }],
        },
      ],
      tableSections: [
        {
          title: salesDetailTitle,
          columns: salesReportColumns,
          rows: filteredSalesRows,
          pageSize: 12,
          emptyMessage: "No sales detail rows available.",
        },
      ],
    });
  };

  const generateUnitPerformancePdfReport = () => {
    const tabLabel = unitPerformanceTab.charAt(0).toUpperCase() + unitPerformanceTab.slice(1);
    const unitName = selectedUnit?.name || "Unit";
    const columnsByTab = {
      clients: [
        { key: "username", label: "Agent Code" },
        { key: "name", label: "Agent Name" },
        { key: "totalProspects", label: "Total Prospects" },
        { key: "activeProspects", label: "Active Prospects" },
        { key: "leads", label: "Total Leads" },
        { key: "activeLeads", label: "Active Leads" },
        { key: "totalPolicies", label: "Total Policyholders" },
        { key: "activePolicies", label: "Active Policyholders" },
        { key: "atRiskPolicies", label: "At Risk Policyholders" },
        { key: "lapsedPolicies", label: "Lapsed Policies" },
      ],
      tasks: [
        { key: "username", label: "Agent Code" },
        { key: "name", label: "Agent Name" },
        { key: "totalTasks", label: "Total Tasks" },
        { key: "openTasks", label: "Open Tasks" },
        { key: "overdueTasks", label: "Overdue Tasks" },
        { key: "onTimeDoneTasks", label: "On-Time Done Tasks" },
        { key: "overallCompletionRate", label: "Overall Completion Rate" },
        { key: "onTimeRate", label: "On-Time Completion Rate" },
        { key: "lateCompletionRate", label: "Late Completion Rate" },
      ],
      sales: [
        { key: "username", label: "Agent Code" },
        { key: "name", label: "Agent Name" },
        { key: "leads", label: "Total Leads" },
        { key: "converted", label: "Converted Leads" },
        { key: "unconverted", label: "Unconverted Leads" },
        { key: "conversionRate", label: "Conversion Rate" },
        { key: "totalPolicies", label: "Total Policies" },
        { key: "activePolicies", label: "Active Policies" },
        { key: "activePolicyRate", label: "Active Policy Rate" },
        { key: "annualPremium", label: "Total Annual Premium" },
        { key: "monthlyPremium", label: "Monthly Premium" },
        { key: "quarterlyPremium", label: "Quarterly Premium" },
        { key: "halfYearlyPremium", label: "Half-Yearly Premium" },
        { key: "yearlyPremium", label: "Yearly Premium" },
      ],
    };
    const columnsForReport = isAllUnitsSelected
      ? {
          ...columnsByTab,
          clients: [columnsByTab.clients[0], columnsByTab.clients[1], { key: "unit", label: "Unit" }, ...columnsByTab.clients.slice(2)],
          tasks: [columnsByTab.tasks[0], columnsByTab.tasks[1], { key: "unit", label: "Unit" }, ...columnsByTab.tasks.slice(2)],
          sales: [columnsByTab.sales[0], columnsByTab.sales[1], { key: "unit", label: "Unit" }, ...columnsByTab.sales.slice(2)],
        }
      : columnsByTab;
    const reportScopeName = isAllUnitsSelected ? (scope.branchName || "Branch") : unitName;
    const reportScopeLabel = isAllUnitsSelected ? "Branch" : "Unit";

    const rows = filteredAgents.map((agent) => ({
      ...agent,
      onTimeDoneTasks: Math.max(0, Number(agent.closedTasks || 0) - Number(agent.delayedDoneTasks || 0)),
      overallCompletionRate: `${Number(agent.totalTasks || 0) ? Math.round((Number(agent.closedTasks || 0) / Number(agent.totalTasks || 0)) * 100) : 0}%`,
      onTimeRate: `${Number(agent.closedTasks || 0) ? Math.round(((Number(agent.closedTasks || 0) - Number(agent.delayedDoneTasks || 0)) / Number(agent.closedTasks || 0)) * 100) : 0}%`,
      lateCompletionRate: `${Number(agent.closedTasks || 0) ? Math.round((Number(agent.delayedDoneTasks || 0) / Number(agent.closedTasks || 0)) * 100) : 0}%`,
      unconverted: Math.max(0, Number(agent.leads || 0) - Number(agent.converted || 0)),
      conversionRate: `${Number(agent.conversionRate || 0)}%`,
      activePolicyRate: `${Number(agent.totalPolicies || 0) ? Math.round((Number(agent.activePolicies || 0) / Number(agent.totalPolicies || 0)) * 100) : 0}%`,
      annualPremium: formatMoney(agent.annualPremium),
      monthlyPremium: formatMoney(agent.monthlyPremium),
      quarterlyPremium: formatMoney(agent.quarterlyPremium),
      halfYearlyPremium: formatMoney(agent.halfYearlyPremium),
      yearlyPremium: formatMoney(agent.yearlyPremium),
    }));

    createPrintableReport({
      filename: `${user?.username || normalizedRole} - ${reportScopeName} ${unitPerformanceTab === "clients" ? "Clients Relationship Report" : unitPerformanceTab === "tasks" ? "Tasks Performance Report" : `${tabLabel} Performance Report`}`,
      title: unitPerformanceTab === "clients" ? `${reportScopeLabel} Clients Relationship Report` : unitPerformanceTab === "tasks" ? `${reportScopeLabel} Tasks Performance Report` : `${reportScopeLabel} Sales Performance Report`,
      periodLabel: unitPerformancePeriodLabel,
      detailsTitle: isAllUnitsSelected ? "Branch Details" : "Unit Details",
      details: isAllUnitsSelected
        ? [
            { label: "Area", value: scope.areaName || "—" },
            { label: "Branch", value: scope.branchName || "—" },
            { label: "Branch Manager", value: `${user?.username || "—"} • ${[user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(" ").trim() || user?.username || "—"}` },
          ]
        : [
            { label: "Area", value: scope.areaName || "—" },
            { label: "Branch", value: scope.branchName || "—" },
            { label: "Unit", value: unitName },
            { label: "Unit Manager", value: `${selectedUnit?.manager?.code || "—"} • ${selectedUnit?.manager?.name || "—"}` },
            { label: "Assistant Unit Manager", value: `${selectedUnit?.assistantManager?.code || "—"} • ${selectedUnit?.assistantManager?.name || "—"}` },
          ],
      filters: [
        { label: "Performance Tab", value: tabLabel },
        { label: "Date Range", value: getPresetLabel(unitPerformanceDatePreset) },
        { label: "Search Filter", value: agentSearch.trim() || "All" },
        { label: "Sort Filter", value: unitSortLabel },
      ],
      statCards: unitPerformanceTab === "clients"
        ? [
            { label: "Total Prospects", value: selectedUnitSummary.totalProspects, tone: "red" },
            { label: "Active Prospects", value: selectedUnitSummary.activeProspects, tone: "blue" },
            { label: "Total Leads", value: selectedUnitSummary.leads, tone: "green" },
            { label: "Active Leads", value: selectedUnitSummary.activeLeads, tone: "gold" },
            { label: "Total Policyholders", value: selectedUnitSummary.totalPolicies, tone: "red" },
            { label: "Active Policyholders", value: selectedUnitSummary.activePolicies, tone: "green" },
            { label: "At Risk Policyholders", value: selectedUnitSummary.atRiskPolicies, tone: "gold" },
            { label: "Lapsed Policies", value: selectedUnitSummary.lapsedPolicies, tone: "blue" },
          ]
        : unitPerformanceTab === "tasks"
          ? [
              { label: "Total Tasks", value: selectedUnitSummary.totalTasks, tone: "red" },
              { label: "Open Tasks", value: selectedUnitSummary.openTasks, tone: "blue" },
              { label: "Overdue Tasks", value: selectedUnitSummary.overdueTasks, tone: "gold" },
              { label: "On-Time Done Tasks", value: selectedUnitSummary.onTimeDoneTasks, tone: "green" },
              { label: "Overall Completion Rate", value: `${selectedUnitSummary.overallCompletionRate}%`, tone: "red" },
              { label: "On-Time Completion Rate", value: `${selectedUnitSummary.onTimeCompletionRate}%`, tone: "blue" },
              { label: "Late Completion Rate", value: `${selectedUnitSummary.lateCompletionRate}%`, tone: "gold" },
            ]
          : [
              { label: "Total Leads", value: selectedUnitSummary.leads, tone: "red" },
              { label: "Converted Leads", value: selectedUnitSummary.converted, tone: "green" },
              { label: "Unconverted Leads", value: selectedUnitSummary.unconverted, tone: "gold" },
              { label: "Conversion Rate", value: `${selectedUnitSummary.conversionRate}%`, tone: "blue" },
              { label: "Total Policies", value: selectedUnitSummary.totalPolicies, tone: "red" },
              { label: "Active Policies", value: selectedUnitSummary.activePolicies, tone: "green" },
              { label: "Active Policy Rate", value: `${selectedUnitSummary.activePolicyRate}%`, tone: "blue" },
              { label: "Total Annual Premium", value: formatMoney(selectedUnitSummary.annualPremium), tone: "red" },
              { label: "Monthly Premium Breakdown", value: formatMoney(selectedUnitSummary.monthlyPremium), tone: "blue" },
              { label: "Quarterly Premium Breakdown", value: formatMoney(selectedUnitSummary.quarterlyPremium), tone: "green" },
              { label: "Half-Yearly Premium Breakdown", value: formatMoney(selectedUnitSummary.halfYearlyPremium), tone: "gold" },
              { label: "Yearly Premium Breakdown", value: formatMoney(selectedUnitSummary.yearlyPremium), tone: "red" },
            ],
      analyticsSections: unitPerformanceTab === "sales" && selectedKpiPeriod
        ? (isAllUnitsSelected && branchSalesKpiProgressRows.length
            ? [
                {
                  title: "Branch KPI Progress",
                  rows: branchSalesKpiProgressRows.map(({ kpi, actual }) => ({
                    label: formatKpiLabel(kpi, "BRANCH"),
                    value: `Actual ${formatActualKpiValue(actual, kpi.valueType)} • Target ${formatKpiTarget(kpi)}`,
                  })),
                },
                {
                  title: "Unit Drilldown",
                  rows: branchKpiUnitRows.map((unit) => ({
                    label: unit.unit,
                    value: `${formatMoney(unit.annualPremium)}${unit.topAgents.length ? ` • Top contributing agents: ${unit.topAgents.map((agent) => `${agent.username} ${agent.name || ""} (${formatMoney(agent.annualPremium)})`.trim()).join(", ")}` : ""}`,
                  })),
                },
              ]
            : (!isAllUnitsSelected && selectedUnitKpiCards.length
                ? [
                    {
                      title: "Unit KPI Progress",
                      rows: selectedUnitKpiCards.map(({ kpi, actual }) => ({
                        label: formatKpiLabel(kpi, "UNIT"),
                        value: `Actual ${formatActualKpiValue(actual, kpi.valueType)} • Target ${formatKpiTarget(kpi)}`,
                      })),
                    },
                    {
                      title: "Top 5 Contributing Agents",
                      rows: topUnitSalesAgents.map((agent) => ({
                        label: `${agent.username} • ${agent.name || agent.username}`,
                        value: formatMoney(agent.annualPremium),
                      })),
                    },
                  ]
                : []))
        : [],
      tableSections: [
        {
          title: "Agents in Scope",
          columns: columnsForReport[unitPerformanceTab],
          rows,
          pageSize: unitPerformanceTab === "sales" ? 5 : 8,
          emptyMessage: "No agents available for this unit report.",
        },
      ],
    });
  };

  return (
    <div className="manager-portal">
      <TopNav
        user={user}
        onLogoClick={() => setActiveView("dashboard")}
        onLogout={handleLogout}
        onProfileClick={() => navigate(`/${normalizedRole.toLowerCase()}/${user?.username || username}/profile`)}
        showAlerts={false}
        showDate
        profileClickable
      />

      <div className="manager-portal__body">
        <ManagerSideNav
          roleLabel={normalizedRole}
          active={activeView}
          onNavigate={setActiveView}
          collapsed={sideNavCollapsed}
          onToggle={() => setSideNavCollapsed((current) => !current)}
        />

        <main className="manager-portal__content">
          {activeView === "dashboard" && <section className="manager-hero">
            <div>
              <p className="manager-hero__eyebrow">{normalizedRole} Portal</p>
              <h1>{getPortalHeading(normalizedRole)}</h1>
              <p>
                Monitor {scopeLabel} with live backend metrics,{" "}
                {normalizedRole === "BM" ? "branch-wide" : "unit-wide"} agent
                coverage, auto-updating date-filtered tables, and printable
                reports.
              </p>
              <div className="manager-hero__meta-row">
                {generatedAtLabel && (
                  <small className="manager-hero__meta">
                    Updated {generatedAtLabel}
                  </small>
                )}
                <button
                  type="button"
                  className="manager-refresh-btn"
                  onClick={() => setRefreshCount((current) => current + 1)}
                  disabled={isLoading}
                >
                  {isLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            <div className="manager-hero__cards">
              {summaryCards.map((card) => (
                <article key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </article>
              ))}
            </div>
          </section>}

          {isLoading && (
            <section className="manager-panel manager-feedback">
              Loading manager portal data...
            </section>
          )}
          {loadError && (
            <section className="manager-panel manager-feedback manager-feedback--error">
              {loadError}
            </section>
          )}

          {!isLoading && !loadError && activeView === "dashboard" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <h2>
                  {normalizedRole === "BM" ? "Branch Overview" : "Unit Overview"}
                </h2>
                <p>
                  High-level pulse of workload, conversion output, and premium
                  momentum across the current manager scope.
                </p>
              </div>
              <div className="manager-kpi-grid">
                <div>
                  <span>Completed Tasks</span>
                  <strong>{summary.totalClosedTasks}</strong>
                </div>
                <div>
                  <span>Open Tasks</span>
                  <strong>{summary.totalOpenTasks}</strong>
                </div>
                <div>
                  <span>Overdue Tasks</span>
                  <strong>{summary.totalOverdueTasks}</strong>
                </div>
                <div>
                  <span>Leads Managed</span>
                  <strong>{summary.totalLeads}</strong>
                </div>
                <div>
                  <span>Active Leads</span>
                  <strong>{summary.totalActiveLeads}</strong>
                </div>
                <div>
                  <span>Converted Leads</span>
                  <strong>{summary.totalConverted}</strong>
                </div>
                <div>
                  <span>Total Policies</span>
                  <strong>{summary.totalPolicies}</strong>
                </div>
                <div>
                  <span>Total Active Policies</span>
                  <strong>{summary.activePolicies}</strong>
                </div>
                <div>
                  <span>Active Policy Rate</span>
                  <strong>{summary.activePolicyRate}%</strong>
                </div>
                <div>
                  <span>Annual Premium</span>
                  <strong>{formatMoney(summary.totalAnnualPremium)}</strong>
                </div>
                {summaryFrequencyPremiumCards.map((card) => (
                  <div key={card.key}>
                    <span>{card.label}</span>
                    <strong>{formatMoney(card.value)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isLoading && !loadError && activeView === "agents" && (
            selectedAgent ? (
              <section className="manager-panel">
                <nav className="manager-breadcrumb" aria-label="Agent detail breadcrumb">
                  <button type="button" onClick={() => setSelectedAgentId("")}>Agents in Scope</button>
                  <span>&gt;</span>
                  <span>{selectedAgent.unit || "Unassigned Unit"}</span>
                  <span>&gt;</span>
                  <strong>{selectedAgent.username || selectedAgent.name}</strong>
                </nav>

                <div className="manager-panel__head">
                  <div>
                    <h2>{selectedAgent.name}</h2>
                    <p>
                      Full agent performance across clients, tasks, sales, and KPI progress for {selectedAgent.username}.
                    </p>
                  </div>
                </div>

                <div className="manager-agent-detail-grid">
                  <article>
                    <h3>Clients</h3>
                    <span>Total Prospects</span>
                    <strong>{Number(selectedAgent.totalProspects || 0)}</strong>
                    <span>Active Prospects</span>
                    <strong>{Number(selectedAgent.activeProspects || 0)}</strong>
                    <span>Total Leads</span>
                    <strong>{Number(selectedAgent.leads || 0)}</strong>
                    <span>Active Leads</span>
                    <strong>{Number(selectedAgent.activeLeads || 0)}</strong>
                    <span>Total Policyholders</span>
                    <strong>{Number(selectedAgent.totalPolicies || 0)}</strong>
                    <span>Active Policyholders</span>
                    <strong>{Number(selectedAgent.activePolicies || 0)}</strong>
                    <span>At Risk Policyholders</span>
                    <strong>{Number(selectedAgent.atRiskPolicies || 0)}</strong>
                    <span>Lapsed Policies</span>
                    <strong>{Number(selectedAgent.lapsedPolicies || 0)}</strong>
                  </article>
                  <article>
                    <h3>Tasks</h3>
                    <span>Open Tasks</span>
                    <strong>{Number(selectedAgent.openTasks || 0)}</strong>
                    <span>Overdue Tasks</span>
                    <strong>{Number(selectedAgent.overdueTasks || 0)}</strong>
                    <span>Done Tasks</span>
                    <strong>{Number(selectedAgent.closedTasks || 0)}</strong>
                    <span>On-Time Completion Rate</span>
                    <strong>{Number(selectedAgent.closedTasks || 0) ? Math.round(((Number(selectedAgent.closedTasks || 0) - Number(selectedAgent.delayedDoneTasks || 0)) / Number(selectedAgent.closedTasks || 0)) * 100) : 0}%</strong>
                  </article>
                  <article>
                    <h3>Sales</h3>
                    <span>Annual Premium</span>
                    <strong>{formatMoney(selectedAgent.annualPremium)}</strong>
                    <span>Monthly</span>
                    <strong>{formatMoney(selectedAgent.monthlyPremium)}</strong>
                    <span>Quarterly</span>
                    <strong>{formatMoney(selectedAgent.quarterlyPremium)}</strong>
                    <span>Half-Yearly</span>
                    <strong>{formatMoney(selectedAgent.halfYearlyPremium)}</strong>
                    <span>Yearly</span>
                    <strong>{formatMoney(selectedAgent.yearlyPremium)}</strong>
                  </article>
                </div>

                <div className="manager-agent-kpi-section">
                  <h3>KPI Progress</h3>
                  {selectedAgentKpiCards.length ? (
                    <div className="manager-kpi-progress-grid">
                      {selectedAgentKpiCards.map(({ assignment, kpi, actual, comparison, dateRangeLabel }) => (
                        <article className={`manager-kpi-progress-card ${comparison.className}`} key={`${assignment.scopeType}:${assignment.scopeId}:${kpi.key}`}>
                          <span>{assignment.name}</span>
                          <strong>{formatKpiLabel(kpi, assignment.scopeType)}</strong>
                          <small>{dateRangeLabel} • {kpi.period}</small>
                          <div className="manager-kpi-progress-values">
                            <b>{formatActualKpiValue(actual, kpi.valueType)}</b>
                            <em>{comparison.status}</em>
                          </div>
                          <div className="manager-kpi-progress-bar" aria-label={`${formatKpiLabel(kpi, assignment.scopeType)} progress ${comparison.percent}%`}>
                            <span style={{ width: `${comparison.percent}%` }} />
                          </div>
                          <small className="manager-kpi-gap-note">{comparison.deltaLabel}</small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="manager-empty-state">No KPI progress is available for this agent yet.</div>
                  )}
                </div>
              </section>
            ) : (
              <section className="manager-panel">
                <div className="manager-panel__head">
                  <div>
                    <h2>
                      <button type="button" className="manager-heading-link" onClick={() => setActiveView("dashboard")}>{scope.branchName || "Branch"}</button>
                      <span> &gt; </span>
                      <span>{selectedUnit?.name || "Unit"}</span>
                    </h2>
                  </div>
                </div>

                <section className="manager-unit-details-card">
                  <div>
                    <h3>{isAllUnitsSelected ? "All Units Details" : "Unit Details"}</h3>
                    <div className={`manager-unit-details-grid ${isAllUnitsSelected ? "manager-unit-details-grid--all" : ""}`}>
                      {isAllUnitsSelected ? unitOptions.filter((unit) => !unit.isAllUnits).map((unit) => (
                        <div className="manager-unit-summary" key={unit.name}>
                          <strong>{unit.name}</strong>
                          <div className="manager-metric-pair"><span>Unit Manager Code</span><b>{unit?.manager?.code || "—"}</b></div>
                          <div className="manager-metric-pair"><span>Unit Manager Name</span><b>{unit?.manager?.name || "—"}</b></div>
                          <div className="manager-metric-pair"><span>Assistant Unit Manager Code</span><b>{unit?.assistantManager?.code || "—"}</b></div>
                          <div className="manager-metric-pair"><span>Assistant Unit Manager Name</span><b>{unit?.assistantManager?.name || "—"}</b></div>
                        </div>
                      )) : (
                        <>
                          <div className="manager-metric-pair"><span>Unit Manager Code</span><strong>{selectedUnit?.manager?.code || "—"}</strong></div>
                          <div className="manager-metric-pair"><span>Unit Manager Name</span><strong>{selectedUnit?.manager?.name || "—"}</strong></div>
                          <div className="manager-metric-pair"><span>Assistant Unit Manager Code</span><strong>{selectedUnit?.assistantManager?.code || "—"}</strong></div>
                          <div className="manager-metric-pair"><span>Assistant Unit Manager Name</span><strong>{selectedUnit?.assistantManager?.name || "—"}</strong></div>
                        </>
                      )}
                    </div>
                  </div>
                  <label className="manager-select" htmlFor="manager-unit-selector">
                    <span>Unit</span>
                    <select id="manager-unit-selector" value={selectedUnit?.name || ""} onChange={(e) => { setSelectedUnitName(e.target.value); setSelectedAgentId(""); }}>
                      {unitOptions.map((unit) => (
                        <option key={unit.name} value={unit.name}>{unit.name}</option>
                      ))}
                    </select>
                  </label>
                </section>

                <div className="manager-tab-row">
                  <div className="manager-tab-buttons" role="tablist" aria-label="Unit performance tabs">
                    {[
                      ["clients", "Clients"],
                      ["tasks", "Tasks"],
                      ["sales", "Sales"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={unitPerformanceTab === key ? "active" : ""}
                        onClick={() => setUnitPerformanceTab(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="manager-select manager-select--unit-date" htmlFor="manager-unit-performance-date-preset">
                    <span>Date Range</span>
                    <select
                      id="manager-unit-performance-date-preset"
                      value={unitPerformanceDatePreset}
                      onChange={(e) => setUnitPerformanceDatePreset(e.target.value)}
                    >
                      {DATE_PRESETS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="manager-report-btn" onClick={generateUnitPerformancePdfReport}>
                    <FaFilePdf size={15} />
                    <span>Generate Report (PDF)</span>
                  </button>
                </div>

                <div className="manager-agent-detail-grid manager-agent-detail-grid--single">
                  {unitPerformanceTab === "clients" && (
                    <article>
                      <h3>Clients Relationship Performance</h3>
                      <div className="manager-metric-pair"><span>Total Prospects</span><strong>{selectedUnitSummary.totalProspects}</strong></div>
                      <div className="manager-metric-pair"><span>Active Prospects</span><strong>{selectedUnitSummary.activeProspects}</strong></div>
                      <div className="manager-metric-pair"><span>Total Leads</span><strong>{selectedUnitSummary.leads}</strong></div>
                      <div className="manager-metric-pair"><span>Active Leads</span><strong>{selectedUnitSummary.activeLeads}</strong></div>
                      <div className="manager-metric-pair"><span>Total Policyholders</span><strong>{selectedUnitSummary.totalPolicies}</strong></div>
                      <div className="manager-metric-pair"><span>Active Policyholders</span><strong>{selectedUnitSummary.activePolicies}</strong></div>
                      <div className="manager-metric-pair"><span>At Risk Policyholders</span><strong>{selectedUnitSummary.atRiskPolicies}</strong></div>
                      <div className="manager-metric-pair"><span>Lapsed Policies</span><strong>{selectedUnitSummary.lapsedPolicies}</strong></div>
                    </article>
                  )}
                  {unitPerformanceTab === "tasks" && (
                    <article>
                      <h3>Tasks Performance</h3>
                      <div className="manager-metric-pair"><span>Total Tasks</span><strong>{selectedUnitSummary.totalTasks}</strong></div>
                      <div className="manager-metric-pair"><span>Open Tasks</span><strong>{selectedUnitSummary.openTasks}</strong></div>
                      <div className="manager-metric-pair"><span>Overdue Tasks</span><strong>{selectedUnitSummary.overdueTasks}</strong></div>
                      <div className="manager-metric-pair"><span>On-Time Done Tasks</span><strong>{selectedUnitSummary.onTimeDoneTasks}</strong></div>
                      <div className="manager-metric-pair"><span>Overall Completion Rate</span><strong>{selectedUnitSummary.overallCompletionRate}%</strong></div>
                      <div className="manager-metric-pair"><span>On-Time Completion Rate</span><strong>{selectedUnitSummary.onTimeCompletionRate}%</strong></div>
                      <div className="manager-metric-pair"><span>Late Completion Rate</span><strong>{selectedUnitSummary.lateCompletionRate}%</strong></div>
                    </article>
                  )}
                  {unitPerformanceTab === "sales" && (
                    <article>
                      <h3>Sales Performance</h3>
                      <div className="manager-metric-pair"><span>Total Leads</span><strong>{selectedUnitSummary.leads}</strong></div>
                      <div className="manager-metric-pair"><span>Converted Leads</span><strong>{selectedUnitSummary.converted}</strong></div>
                      <div className="manager-metric-pair"><span>Unconverted Leads</span><strong>{selectedUnitSummary.unconverted}</strong></div>
                      <div className="manager-metric-pair"><span>Conversion Rate</span><strong>{selectedUnitSummary.conversionRate}%</strong></div>
                      <div className="manager-metric-pair"><span>Total Policies</span><strong>{selectedUnitSummary.totalPolicies}</strong></div>
                      <div className="manager-metric-pair"><span>Active Policies</span><strong>{selectedUnitSummary.activePolicies}</strong></div>
                      <div className="manager-metric-pair"><span>Active Policy Rate</span><strong>{selectedUnitSummary.activePolicyRate}%</strong></div>
                      <div className="manager-metric-pair"><span>Total Annual Premium</span><strong>{formatMoney(selectedUnitSummary.annualPremium)}</strong></div>
                      <div className="manager-metric-pair"><span>Monthly Premium Breakdown</span><strong>{formatMoney(selectedUnitSummary.monthlyPremium)}</strong></div>
                      <div className="manager-metric-pair"><span>Quarterly Premium Breakdown</span><strong>{formatMoney(selectedUnitSummary.quarterlyPremium)}</strong></div>
                      <div className="manager-metric-pair"><span>Half-Yearly Premium Breakdown</span><strong>{formatMoney(selectedUnitSummary.halfYearlyPremium)}</strong></div>
                      <div className="manager-metric-pair"><span>Yearly Premium Breakdown</span><strong>{formatMoney(selectedUnitSummary.yearlyPremium)}</strong></div>
                    </article>
                  )}
                </div>

                {unitPerformanceTab === "sales" && !isAllUnitsSelected && selectedKpiPeriod && (
                  <div className="manager-agent-kpi-section">
                    <h3>Unit KPI Progress</h3>
                    {selectedUnitKpiCards.length ? (
                      <>
                        <div className="manager-kpi-progress-grid">
                          {selectedUnitKpiCards.map(({ kpi, actual, comparison, dateRangeLabel }) => (
                            <article className={`manager-kpi-progress-card ${comparison.className}`} key={`unit:${kpi.key}`}>
                              <span>{selectedUnit?.name || "Unit"}</span>
                              <strong>{formatKpiLabel(kpi, "UNIT")}</strong>
                              <small>{dateRangeLabel} • {kpi.period}</small>
                              <div className="manager-kpi-progress-values">
                                <div><small>Actual Progress</small><b>{formatActualKpiValue(actual, kpi.valueType)}</b></div>
                                <div><small>Assigned Target</small><b>{formatKpiTarget(kpi)}</b></div>
                              </div>
                              <div className="manager-kpi-progress-bar" aria-label={`${formatKpiLabel(kpi, "UNIT")} progress ${comparison.percent}%`}><span style={{ width: `${Math.max(0, Math.min(comparison.percent, 140))}%` }} /></div>
                              <em>{comparison.status}</em>
                              <small className="manager-kpi-gap-note">{comparison.deltaLabel}</small>
                            </article>
                          ))}
                        </div>
                        <div className="manager-kpi-unit-drilldown">
                          <h3>Top 5 Contributing Agents</h3>
                          {topUnitSalesAgents.length ? (
                            <ul className="manager-kpi-agent-list">
                              {topUnitSalesAgents.map((agent) => (
                                <li key={`top-agent:${agent.id}`}>
                                  <button type="button" className="manager-kpi-agent-link" onClick={() => setSelectedAgentId(String(agent.id || ""))}>
                                    <strong>{agent.username}</strong>
                                    <span>{agent.name || agent.username}</span>
                                  </button>
                                  <b>{formatMoney(agent.annualPremium)}</b>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="manager-empty-state">No agents have sales production for this period yet.</div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="manager-empty-state">No assigned sales-production unit KPI is available yet.</div>
                    )}
                  </div>
                )}

                {unitPerformanceTab === "sales" && isAllUnitsSelected && selectedKpiPeriod && (
                  <div className="manager-agent-kpi-section">
                    <h3>Branch KPI Progress</h3>
                    {branchSalesKpiProgressRows.length ? (
                      <>
                        <div className="manager-kpi-progress-grid">
                          {branchSalesKpiProgressRows.map(({ assignment, kpi, actual, targetBasis, targetBasisLabel, productionActual, dateRangeLabel }) => {
                            const comparison = getKpiComparison(actual, kpi);
                            return (
                              <article className={`manager-kpi-progress-card ${comparison.className}`} key={`branch-sales:${kpi.key}`}>
                                <span>{assignment.name}</span>
                                <strong>{formatKpiLabel(kpi, assignment.scopeType)}</strong>
                                <small>{dateRangeLabel} • {kpi.period}</small>
                                <div className="manager-kpi-progress-values">
                                  <div><small>Actual Progress</small><b>{formatActualKpiValue(actual, kpi.valueType)}</b></div>
                                  <div><small>Assigned Target</small><b>{formatKpiTarget(kpi)}</b></div>
                                </div>
                                {kpi.key === "monthly_target_achievement_index" && targetBasis ? (
                                  <small className="manager-kpi-gap-note">Actual sales production achieved: {formatMoney(productionActual)} • Sales production target for {kpi.period}: {targetBasisLabel || formatMoney(targetBasis)}</small>
                                ) : null}
                                <div className="manager-kpi-progress-bar" aria-label={`${formatKpiLabel(kpi, assignment.scopeType)} progress ${comparison.percent}%`}><span style={{ width: `${Math.max(0, Math.min(comparison.percent, 140))}%` }} /></div>
                                <em>{comparison.status}</em>
                                <small className="manager-kpi-gap-note">{comparison.deltaLabel}</small>
                              </article>
                            );
                          })}
                        </div>
                        <div className="manager-kpi-unit-drilldown">
                          <h3>Unit Drilldown</h3>
                          <div className="manager-kpi-unit-grid">
                            {branchKpiUnitRows.map((unit) => (
                              <article key={`branch-unit:${unit.unit}`}>
                                <strong>{unit.unit}</strong>
                                <span>Sales Production: {formatMoney(unit.annualPremium)}</span>
                                {unit.topAgents.length ? (
                                  <>
                                    <small className="manager-kpi-gap-note">Top 5 Contributing Agents</small>
                                    <ul className="manager-kpi-agent-list manager-kpi-agent-list--compact">
                                    {unit.topAgents.map((agent) => (
                                      <li key={`unit-top-agent:${unit.unit}:${agent.id}`}>
                                        <button type="button" className="manager-kpi-agent-link" onClick={() => setSelectedAgentId(String(agent.id || ""))}>
                                          <strong>{agent.username}</strong>
                                          <span>{agent.name || agent.username}</span>
                                        </button>
                                        <b>{formatMoney(agent.annualPremium)}</b>
                                      </li>
                                    ))}
                                    </ul>
                                  </>
                                ) : (
                                  <small>No agents have sales production for this period yet.</small>
                                )}
                              </article>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="manager-empty-state">No assigned branch sales KPI progress is available yet.</div>
                    )}
                  </div>
                )}

                <div className="manager-panel__head"><h2>Agents in Scope</h2></div>

                <div className="manager-toolbar manager-toolbar--search-only manager-toolbar--agents">
                  <div className="manager-toolbar__filters">
                    <label
                      className="manager-search"
                      htmlFor="manager-agents-search"
                    >
                      <FaSearch size={14} />
                      <input
                        id="manager-agents-search"
                        type="text"
                        placeholder="Search username or name"
                        value={agentSearch}
                        onChange={(e) => setAgentSearch(e.target.value)}
                      />
                      {agentSearch && (
                        <button type="button" className="manager-search__clear" onClick={() => setAgentSearch("")} aria-label="Clear agent search">
                          ×
                        </button>
                      )}
                    </label>
                    <label className="manager-select" htmlFor="manager-agents-sort">
                      <span>Sort By</span>
                      <select
                        id="manager-agents-sort"
                        value={agentSort}
                        onChange={(e) => setAgentSort(e.target.value)}
                      >
                        <option value="usernameAsc">Username (A → Z)</option>
                        {unitPerformanceTab === "clients" && (
                          <>
                            <option value="totalProspectsDesc">Total Prospects (High → Low)</option>
                            <option value="totalProspectsAsc">Total Prospects (Low → High)</option>
                            <option value="activeProspectsDesc">Active Prospects (High → Low)</option>
                            <option value="activeProspectsAsc">Active Prospects (Low → High)</option>
                            <option value="leadsDesc">Total Leads (High → Low)</option>
                            <option value="leadsAsc">Total Leads (Low → High)</option>
                            <option value="activeLeadsDesc">Active Leads (High → Low)</option>
                            <option value="activeLeadsAsc">Active Leads (Low → High)</option>
                            <option value="totalPoliciesDesc">Total Policyholders (High → Low)</option>
                            <option value="totalPoliciesAsc">Total Policyholders (Low → High)</option>
                            <option value="activePoliciesDesc">Active Policyholders (High → Low)</option>
                            <option value="activePoliciesAsc">Active Policyholders (Low → High)</option>
                            <option value="atRiskPoliciesDesc">At Risk Policyholders (High → Low)</option>
                            <option value="atRiskPoliciesAsc">At Risk Policyholders (Low → High)</option>
                            <option value="lapsedPoliciesDesc">Lapsed Policies (High → Low)</option>
                            <option value="lapsedPoliciesAsc">Lapsed Policies (Low → High)</option>
                          </>
                        )}
                        {unitPerformanceTab === "tasks" && (
                          <>
                            <option value="totalTasksDesc">Total Tasks (High → Low)</option>
                            <option value="totalTasksAsc">Total Tasks (Low → High)</option>
                            <option value="openTasksDesc">Open Tasks (High → Low)</option>
                            <option value="openTasksAsc">Open Tasks (Low → High)</option>
                            <option value="overdueTasksDesc">Overdue Tasks (High → Low)</option>
                            <option value="overdueTasksAsc">Overdue Tasks (Low → High)</option>
                            <option value="onTimeDoneTasksDesc">On-Time Done Tasks (High → Low)</option>
                            <option value="onTimeDoneTasksAsc">On-Time Done Tasks (Low → High)</option>
                            <option value="overallCompletionRateDesc">Overall Completion Rate (High → Low)</option>
                            <option value="overallCompletionRateAsc">Overall Completion Rate (Low → High)</option>
                            <option value="onTimeCompletionRateDesc">On-Time Completion Rate (High → Low)</option>
                            <option value="onTimeCompletionRateAsc">On-Time Completion Rate (Low → High)</option>
                            <option value="lateCompletionRateDesc">Late Completion Rate (High → Low)</option>
                            <option value="lateCompletionRateAsc">Late Completion Rate (Low → High)</option>
                          </>
                        )}
                        {unitPerformanceTab === "sales" && (
                          <>
                            <option value="leadsDesc">Total Leads (High → Low)</option>
                            <option value="leadsAsc">Total Leads (Low → High)</option>
                            <option value="convertedDesc">Converted Leads (High → Low)</option>
                            <option value="convertedAsc">Converted Leads (Low → High)</option>
                            <option value="unconvertedDesc">Unconverted Leads (High → Low)</option>
                            <option value="unconvertedAsc">Unconverted Leads (Low → High)</option>
                            <option value="conversionRateDesc">Conversion Rate (High → Low)</option>
                            <option value="conversionRateAsc">Conversion Rate (Low → High)</option>
                            <option value="totalPoliciesDesc">Total Policies (High → Low)</option>
                            <option value="totalPoliciesAsc">Total Policies (Low → High)</option>
                            <option value="activePoliciesDesc">Active Policies (High → Low)</option>
                            <option value="activePoliciesAsc">Active Policies (Low → High)</option>
                            <option value="activePolicyRateDesc">Active Policy Rate (High → Low)</option>
                            <option value="activePolicyRateAsc">Active Policy Rate (Low → High)</option>
                            <option value="annualPremiumDesc">Total Annual Premium (High → Low)</option>
                            <option value="annualPremiumAsc">Total Annual Premium (Low → High)</option>
                            <option value="monthlyPremiumDesc">Monthly Premium (High → Low)</option>
                            <option value="monthlyPremiumAsc">Monthly Premium (Low → High)</option>
                            <option value="quarterlyPremiumDesc">Quarterly Premium (High → Low)</option>
                            <option value="quarterlyPremiumAsc">Quarterly Premium (Low → High)</option>
                            <option value="halfYearlyPremiumDesc">Half-Yearly Premium (High → Low)</option>
                            <option value="halfYearlyPremiumAsc">Half-Yearly Premium (Low → High)</option>
                            <option value="yearlyPremiumDesc">Yearly Premium (High → Low)</option>
                            <option value="yearlyPremiumAsc">Yearly Premium (Low → High)</option>
                          </>
                        )}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="manager-table-scroll-top" ref={agentTableTopScrollRef} onScroll={() => syncAgentTableScroll("top")}>
                  <div className={`manager-table-scroll-top__inner manager-table-scroll-top__inner--${unitPerformanceTab} ${isAllUnitsSelected ? "manager-table-scroll-top__inner--all-units" : ""}`} />
                </div>

                <div className="manager-table-wrap manager-table-wrap--agents" ref={agentTableScrollRef} onScroll={() => syncAgentTableScroll("table")}>
                  <table className={`manager-table manager-table--agents manager-table--agents-${unitPerformanceTab} ${isAllUnitsSelected ? "manager-table--all-units" : ""}`}>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Name</th>
                        {isAllUnitsSelected && <th>Unit</th>}
                        {unitPerformanceTab === "clients" && (
                          <>
                            <th>Total Prospects</th>
                            <th>Active Prospects</th>
                            <th>Total Leads</th>
                            <th>Active Leads</th>
                            <th>Total Policyholders</th>
                            <th>Active Policyholders</th>
                            <th>At Risk Policyholders</th>
                            <th>Lapsed Policies</th>
                          </>
                        )}
                        {unitPerformanceTab === "tasks" && (
                          <>
                            <th>Total Tasks</th>
                            <th>Open Tasks</th>
                            <th>Overdue Tasks</th>
                            <th>On-Time Done Tasks</th>
                            <th>Overall Completion Rate</th>
                            <th>On-Time Completion Rate</th>
                            <th>Late Completion Rate</th>
                          </>
                        )}
                        {unitPerformanceTab === "sales" && (
                          <>
                            <th>Total Leads</th>
                            <th>Converted Leads</th>
                            <th>Unconverted Leads</th>
                            <th>Conversion Rate</th>
                            <th>Total Policies</th>
                            <th>Active Policies</th>
                            <th>Active Policy Rate</th>
                            <th>Total Annual Premium</th>
                            <th>Monthly Premium</th>
                            <th>Quarterly Premium</th>
                            <th>Half-Yearly Premium</th>
                            <th>Yearly Premium</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAgents.map((agent) => (
                        <tr key={agent.id}>
                          <td>
                            <button type="button" className="manager-agent-link" onClick={() => setSelectedAgentId(String(agent.id || ""))}>
                              {agent.username}
                            </button>
                          </td>
                          <td>
                            <button type="button" className="manager-agent-link" onClick={() => setSelectedAgentId(String(agent.id || ""))}>
                              {agent.name}
                            </button>
                          </td>
                          {isAllUnitsSelected && <td>{agent.unit || "—"}</td>}
                          {unitPerformanceTab === "clients" && (
                            <>
                              <td>{Number(agent.totalProspects || 0)}</td>
                              <td>{Number(agent.activeProspects || 0)}</td>
                              <td>{Number(agent.leads || 0)}</td>
                              <td>{Number(agent.activeLeads || 0)}</td>
                              <td>{Number(agent.totalPolicies || 0)}</td>
                              <td>{Number(agent.activePolicies || 0)}</td>
                              <td>{Number(agent.atRiskPolicies || 0)}</td>
                              <td>{Number(agent.lapsedPolicies || 0)}</td>
                            </>
                          )}
                          {unitPerformanceTab === "tasks" && (
                            <>
                              <td>{Number(agent.totalTasks || 0)}</td>
                              <td>{Number(agent.openTasks || 0)}</td>
                              <td>{Number(agent.overdueTasks || 0)}</td>
                              <td>{Math.max(0, Number(agent.closedTasks || 0) - Number(agent.delayedDoneTasks || 0))}</td>
                              <td>{Number(agent.totalTasks || 0) ? Math.round((Number(agent.closedTasks || 0) / Number(agent.totalTasks || 0)) * 100) : 0}%</td>
                              <td>{Number(agent.closedTasks || 0) ? Math.round(((Number(agent.closedTasks || 0) - Number(agent.delayedDoneTasks || 0)) / Number(agent.closedTasks || 0)) * 100) : 0}%</td>
                              <td>{Number(agent.closedTasks || 0) ? Math.round((Number(agent.delayedDoneTasks || 0) / Number(agent.closedTasks || 0)) * 100) : 0}%</td>
                            </>
                          )}
                          {unitPerformanceTab === "sales" && (
                            <>
                              <td>{Number(agent.leads || 0)}</td>
                              <td>{Number(agent.converted || 0)}</td>
                              <td>{Math.max(0, Number(agent.leads || 0) - Number(agent.converted || 0))}</td>
                              <td>{Number(agent.conversionRate || 0)}%</td>
                              <td>{Number(agent.totalPolicies || 0)}</td>
                              <td>{Number(agent.activePolicies || 0)}</td>
                              <td>{Number(agent.totalPolicies || 0) ? Math.round((Number(agent.activePolicies || 0) / Number(agent.totalPolicies || 0)) * 100) : 0}%</td>
                              <td>{formatMoney(agent.annualPremium)}</td>
                              <td>{formatMoney(agent.monthlyPremium)}</td>
                              <td>{formatMoney(agent.quarterlyPremium)}</td>
                              <td>{formatMoney(agent.halfYearlyPremium)}</td>
                              <td>{formatMoney(agent.yearlyPremium)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!filteredAgents.length && (
                  <div className="manager-empty-state">
                    No agents matched this search yet.
                  </div>
                )}
              </section>
            )
          )}

          {!isLoading && !loadError && activeView === "kpi_assignment" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <div>
                  <h2>
                    <button type="button" className="manager-heading-link" onClick={() => setActiveView("dashboard")}>{scope.branchName || "Branch"}</button>
                    <span> &gt; </span>
                    <span>KPI Assignment</span>
                  </h2>
                  <p>
                    {normalizedRole === "BM"
                      ? "Assign or unassign branch-level KPI sets for all agents in the branch, all units in the branch, and the branch itself."
                      : "View branch KPI assignments for your manager scope."}
                  </p>
                </div>
              </div>
              {kpiLoading && <div className="manager-empty-state">Loading KPI assignments...</div>}
              {!kpiLoading && (kpiData?.assignments || []).map((assignment) => {
                const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
                const draftKpis = kpiDrafts[assignmentKey] || assignment.kpis || [];
                return (
                  <div className="manager-kpi-assignment-card" key={assignmentKey}>
                    <div className="manager-kpi-assignment-card__head">
                      <div>
                        <strong>{assignment.name}</strong>
                        <span>{assignment.scopeType} {assignment.code ? `• ${assignment.code}` : ""} {assignment.unitName && assignment.unitName !== "—" ? `• ${assignment.unitName}` : ""}</span>
                      </div>
                    </div>
                    <div className="manager-kpi-edit-grid">
                      {draftKpis.map((kpi) => {
                        const rowKey = `${assignmentKey}:${kpi.key}`;
                        const isEditing = editingKpiKey === rowKey;
                        const isSaving = kpiSavingKey === rowKey;
                        const isExpanded = expandedKpiKey === rowKey;
                        const rowErrors = kpiFieldErrors[rowKey] || {};
                        const kpiTargets = getKpiTargets(kpi);
                        return (
                          <div className={`manager-kpi-edit-row ${isEditing ? "editing" : ""} ${isExpanded ? "expanded" : ""}`} key={kpi.key}>
                            <div className="manager-kpi-edit-row__head">
                              <button
                                type="button"
                                className="manager-kpi-collapse-btn"
                                aria-expanded={isExpanded}
                                onClick={() => setExpandedKpiKey(isExpanded ? "" : rowKey)}
                              >
                                <span className="manager-kpi-caret">{isExpanded ? "−" : "+"}</span>
                                <span className="manager-kpi-name">
                                  <strong>{formatKpiLabel(kpi, assignment.scopeType)}</strong>
                                  <span>{formatScopeLabel(assignment.scopeType)} • {kpi.valueType}</span>
                                </span>
                              </button>
                              {kpi.assigned !== false ? (
                                <div className="manager-kpi-summary-targets" aria-hidden={isExpanded}>
                                  <strong>Targets</strong>
                                  <span>{getKpiTargets(kpi).filter((target) => formatRequiredKpiTarget({ ...target, valueType: kpi.valueType }) !== "Required").length}/6 targets filled</span>
                                  <span>Default: {KPI_FREQUENCIES.includes(kpi.period) ? kpi.period : "Not set"}</span>
                                </div>
                              ) : (
                                <div className="manager-kpi-summary-targets manager-kpi-summary-targets--empty" aria-hidden="true" />
                              )}
                              <div className="manager-kpi-row-actions">
                                <button
                                  type="button"
                                  className={`manager-kpi-toggle ${kpi.assigned !== false ? "assigned" : ""}`}
                                  disabled={!kpiData?.canEdit || !isEditing}
                                  onClick={() => {
                                    const nextAssigned = kpi.assigned === false;
                                    if (!nextAssigned) {
                                      setLastAssignedKpiDrafts((current) => ({ ...current, [rowKey]: cloneKpiDraft(kpi) }));
                                      updateKpiDraft(assignment, kpi.key, "assigned", false);
                                      setKpiFieldErrors((current) => ({ ...current, [rowKey]: {} }));
                                      setExpandedKpiKey(rowKey);
                                      return;
                                    }
                                    restoreAssignedKpiDraft(assignment, kpi.key, kpi);
                                    setEditingKpiKey(rowKey);
                                    setExpandedKpiKey(rowKey);
                                  }}
                                >
                                  {kpi.assigned !== false ? "Assigned" : "Unassigned"}
                                </button>
                                {kpiData?.canEdit ? (
                                  isEditing ? (
                                    <>
                                      <button type="button" className="manager-refresh-btn" onClick={() => cancelKpiEdit(assignment, kpi.key)} disabled={isSaving}>
                                        Cancel
                                      </button>
                                      <button type="button" className="manager-refresh-btn" onClick={() => saveKpi(assignment, kpi.key)} disabled={isSaving}>
                                        {isSaving ? "Saving..." : "Save"}
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="manager-refresh-btn"
                                      onClick={() => {
                                        setEditingKpiKey(rowKey);
                                        setExpandedKpiKey(rowKey);
                                      }}
                                    >
                                      Edit
                                    </button>
                                  )
                                ) : null}
                              </div>
                            </div>
                            {isExpanded ? <div className="manager-kpi-frequency-grid">
                              {kpiTargets.map((target) => (
                                <div className="manager-kpi-frequency-card" key={target.period}>
                                  <div className="manager-kpi-frequency-card__head">
                                    <strong>{target.period}</strong>
                                    <label className="manager-kpi-default-check">
                                      <input
                                        type="radio"
                                        name={`${rowKey}-default-frequency`}
                                        checked={(kpi.period || "") === target.period}
                                        disabled={!kpiData?.canEdit || !isEditing || kpi.assigned === false}
                                        onChange={() => prefillKpiTargetsFromDefault(assignment, kpi.key, target.period)}
                                      />
                                      <span>Default</span>
                                    </label>
                                  </div>
                                  <label>
                                    <span>Target</span>
                                    <input
                                      className={`manager-kpi-input ${rowErrors[`${target.period}.targetValue`] ? "has-error" : ""}`}
                                      type="number"
                                      step="1"
                                      value={target.targetValue ?? ""}
                                      disabled={!kpiData?.canEdit || !isEditing || kpi.assigned === false}
                                      onChange={(e) => updateKpiTargetDraft(assignment, kpi.key, target.period, "targetValue", e.target.value)}
                                    />
                                    {rowErrors[`${target.period}.targetValue`] ? <em className="manager-kpi-field-error">{rowErrors[`${target.period}.targetValue`]}</em> : null}
                                  </label>
                                  <label>
                                    <span>Min</span>
                                    <input
                                      className={`manager-kpi-input ${rowErrors[`${target.period}.targetMin`] ? "has-error" : ""}`}
                                      type="number"
                                      step="1"
                                      value={target.targetMin ?? ""}
                                      disabled={!kpiData?.canEdit || !isEditing || kpi.assigned === false}
                                      onChange={(e) => updateKpiTargetDraft(assignment, kpi.key, target.period, "targetMin", e.target.value)}
                                    />
                                    {rowErrors[`${target.period}.targetMin`] ? <em className="manager-kpi-field-error">{rowErrors[`${target.period}.targetMin`]}</em> : null}
                                  </label>
                                  <label>
                                    <span>Max</span>
                                    <input
                                      className={`manager-kpi-input ${rowErrors[`${target.period}.targetMax`] ? "has-error" : ""}`}
                                      type="number"
                                      step="1"
                                      value={target.targetMax ?? ""}
                                      disabled={!kpiData?.canEdit || !isEditing || kpi.assigned === false}
                                      onChange={(e) => updateKpiTargetDraft(assignment, kpi.key, target.period, "targetMax", e.target.value)}
                                    />
                                    {rowErrors[`${target.period}.targetMax`] ? <em className="manager-kpi-field-error">{rowErrors[`${target.period}.targetMax`]}</em> : null}
                                  </label>
                                  <div className="manager-kpi-target-display">
                                    <span>Display Target</span>
                                    <strong>{formatRequiredKpiTarget({ ...target, valueType: kpi.valueType })}</strong>
                                  </div>
                                </div>
                              ))}
                            </div> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {!isLoading && !loadError && activeView === "kpi_progress" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <div>
                  <h2>Branch KPI Progress Dashboard</h2>
                  <p>View actual branch KPI performance against assigned targets.</p>
                </div>
              </div>
              <div className="manager-toolbar manager-kpi-toolbar manager-kpi-toolbar--end">
                <button type="button" className="manager-report-btn" onClick={generateKpiPdfReport}>
                  <FaFilePdf size={15} />
                  <span>Generate KPI Progress Report (PDF)</span>
                </button>
              </div>
              {kpiLoading && <div className="manager-empty-state">Loading KPI progress...</div>}
              {kpiMessage && <div className="manager-filter-note">{kpiMessage}</div>}
              <div className="manager-kpi-progress-grid">
                {branchKpiProgressRows.map(({ assignment, kpi, actual, dateRangeLabel }) => {
                  const comparison = getKpiComparison(actual, kpi);
                  const barPercent = Math.max(0, Math.min(comparison.percent, 140));
                  return (
                    <article className={`manager-kpi-progress-card ${comparison.className}`} key={`${assignment.scopeType}:${assignment.scopeId}:${kpi.key}`}>
                      <span>{assignment.name}</span>
                      <strong>{formatKpiLabel(kpi, assignment.scopeType)}</strong>
                      <p>{kpi.period} • {dateRangeLabel} • {kpi.valueType}</p>
                      <div className="manager-kpi-progress-values">
                        <div>
                          <small>Actual Progress</small>
                          <b>{formatActualKpiValue(actual, kpi.valueType)}</b>
                        </div>
                        <div>
                          <small>Assigned Target</small>
                          <b>{formatKpiTarget(kpi)}</b>
                        </div>
                      </div>
                      <div className="manager-kpi-progress-bar" aria-label={`${formatKpiLabel(kpi, assignment.scopeType)} progress ${comparison.percent}%`}>
                        <span style={{ width: `${barPercent}%` }} />
                      </div>
                      <em>{comparison.status}</em>
                      <small className="manager-kpi-gap-note">{comparison.deltaLabel}</small>
                    </article>
                  );
                })}
              </div>
              {!kpiLoading && !branchKpiProgressRows.length && <div className="manager-empty-state">No branch KPI assignments available yet.</div>}
              <div className="manager-kpi-unit-drilldown">
                <h3>Unit Drilldown</h3>
                <div className="manager-kpi-unit-grid">
                  {branchKpiUnitRows.map((unit) => (
                    <article key={unit.unit}>
                      <strong>{unit.unit}</strong>
                      <span>Sales Production: {formatMoney(unit.annualPremium)}</span>
                      <span>Active Agents: {unit.activeAgents}</span>
                      <span>Persistency: {unit.persistencyRate}%</span>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

        </main>
      </div>
    </div>
  );
}

export default ManagerPortal;