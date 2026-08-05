import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
const KPI_MONTH_START = "2026-01";
const monthKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
};
const followingMonthKey = (value) => {
  const [year, month] = String(value).split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
};
const currentKpiMonth = monthKey();
const nextKpiMonth = followingMonthKey(currentKpiMonth);
const buildKpiMonthOptions = (throughMonth = nextKpiMonth) => {
  const rows = [];
  let cursor = KPI_MONTH_START;
  while (cursor <= throughMonth) {
    const [year, month] = cursor.split("-").map(Number);
    rows.push({ value: cursor, label: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" }) });
    cursor = followingMonthKey(cursor);
  }
  return rows;
};
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
  const agentLabelsByKey = {
    weekly_approaches: "Number of Done Approaches",
    weekly_appointments: "Number of Done Appointments",
    weekly_presentations: "Number of Done Presentations",
    monthly_policies: "Number of Active Policies",
  };
  const legacyAgentLabels = {
    "approaches count": "Number of Done Approaches",
    "appointments count": "Number of Done Appointments",
    "presentations count": "Number of Done Presentations",
    "policies count": "Number of Active Policies",
    "sales target": "Number of Active Policies",
    "number of approaches": "Number of Done Approaches",
    "number of appointments": "Number of Done Appointments",
    "number of presentations": "Number of Done Presentations",
    "number of policies": "Number of Active Policies",
    "new prospects": "Number of New Prospects",
  };
  const legacyBranchLabels = {
    "active agents count": "Number of Active Agents",
  };
  const normalizedLabel = label.toLowerCase();
  if (scopeType === "AGENT" && agentLabelsByKey[kpi.key]) return agentLabelsByKey[kpi.key];
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
  return {
    ...kpi,
    targets: getKpiTargets(kpi).map((target) => ({ ...target })),
    monthlyAssignments: (Array.isArray(kpi.monthlyAssignments) ? kpi.monthlyAssignments : []).map((row) => ({ ...row })),
  };
}

function getMonthlyKpiAssignment(kpi = {}, selectedMonth = currentKpiMonth) {
  return (Array.isArray(kpi.monthlyAssignments) ? kpi.monthlyAssignments : []).find((row) => row.monthKey === selectedMonth) || {
    monthKey: selectedMonth,
    assigned: false,
    targetMin: "",
    targetMax: "",
    targetValue: "",
  };
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
  if (delta > 0) {
    return { percent, status: "Exceeded target", className: "good", delta, deltaLabel: `Exceeded by ${formatActualKpiValue(delta, kpi.valueType)}` };
  }
  if (delta === 0) {
    return { percent, status: "On target", className: "good", delta, deltaLabel: "" };
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

function getCurrentAgeFromBirthday(value) {
  const birthday = new Date(value);
  if (Number.isNaN(birthday.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function formatPromotionRole(role) {
  return String(role || "").trim() || "—";
}

function getAgentStatusClass(status) {
  const normalized = String(status || "Active").trim().toLowerCase();
  if (normalized === "on long leave") return "leave";
  if (normalized === "resigned") return "resigned";
  return "active";
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


const REASSIGNMENT_KPI_TARGETS = {
  monthlyDoneApproaches: 50,
  monthlyClosingRatio: 20,
  monthlyActivePolicies: 2,
};

function normalizeAgentType(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function formatReassignedFlag(value) {
  return value === true ? "Yes" : "No";
}

function getLongLeaveReassignmentProgress(record = {}) {
  const affectedClients = [
    ...(Array.isArray(record.affectedProspects) ? record.affectedProspects : []),
    ...(Array.isArray(record.affectedPolicyholders) ? record.affectedPolicyholders : []),
  ];
  const reassignedCount = affectedClients.filter((client) => client?.reassigned === true).length;
  return `${reassignedCount}/${affectedClients.length}`;
}

function getResignationReassignmentProgress(record = {}) {
  const affectedProspects = Array.isArray(record.affectedProspects) ? record.affectedProspects : [];
  const reassignedCount = affectedProspects.filter((prospect) => prospect?.reassigned === true).length;
  return `${reassignedCount}/${affectedProspects.length}`;
}

function toDateInputValue(value) {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
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

  const populatedTableSections = tableSections.filter((section) => (section.rows || []).length > 0);
  const reportTableSections = populatedTableSections.length ? populatedTableSections : tableSections.slice(0, 1);
  const getReportPageSize = (section = {}) => {
    const fallbackSize = isLandscape ? 18 : 14;
    const hasExplicitSize = section.pageSize !== undefined && section.pageSize !== null;
    const requestedSize = hasExplicitSize ? Number(section.pageSize) : fallbackSize;
    const safeRequestedSize = Number.isFinite(requestedSize) && requestedSize > 0 ? requestedSize : fallbackSize;
    if ((section.columns || []).length >= 10) {
      const widePageSizeCap = Number(section.widePageSizeCap || 0);
      const defaultWidePageSizeCap = isLandscape ? 5 : 4;
      return Math.min(safeRequestedSize, widePageSizeCap > 0 ? widePageSizeCap : defaultWidePageSizeCap);
    }
    if (hasExplicitSize) return safeRequestedSize;
    const minimumSize = isLandscape ? 14 : 10;
    return Math.max(safeRequestedSize, minimumSize);
  };
  const chunkRows = (rows, size, firstSize = size) => {
    const chunks = [];
    const safeSize = Math.max(Number(size || 0), 1);
    const safeFirstSize = Math.max(Number(firstSize || safeSize), 1);
    let index = 0;
    if (rows.length) {
      chunks.push(rows.slice(0, safeFirstSize));
      index = safeFirstSize;
    }
    for (; index < rows.length; index += safeSize) chunks.push(rows.slice(index, index + safeSize));
    return chunks.length ? chunks : [[]];
  };
  const tablePages = [];
  reportTableSections.forEach((section) => {
    const pageSize = getReportPageSize(section);
    const rowChunks = chunkRows(section.rows || [], pageSize, section.firstPageRows || pageSize);
    rowChunks.forEach((rows, chunkIndex) => {
      tablePages.push({
        title: chunkIndex === 0 ? section.title : `${section.title} (cont.)`,
        columns: section.columns,
        rows,
        emptyMessage: section.emptyMessage || "No rows available.",
        compactWithPrevious: Boolean(section.compactWithPrevious && chunkIndex === 0),
        compactMaxRows: section.compactMaxRows || 18,
        estimatedRows: Math.max(rows.length, 1),
        startNewPage: Boolean(section.startNewPage && chunkIndex === 0),
        allowFirstPage: section.allowFirstPage !== false,
        firstPageLimit: section.firstPageLimit,
      });
    });
  });

  const tablePageGroups = [];
  tablePages.forEach((page) => {
    const currentGroup = tablePageGroups[tablePageGroups.length - 1];
    const compactLimit = Math.min(Number(page.compactMaxRows || 18), isLandscape ? 24 : 18);
    if (!page.startNewPage && page.compactWithPrevious && currentGroup && currentGroup.estimatedRows + page.estimatedRows <= compactLimit) {
      currentGroup.pages.push(page);
      currentGroup.estimatedRows += page.estimatedRows;
      currentGroup.allowFirstPage = currentGroup.allowFirstPage && page.allowFirstPage;
      currentGroup.firstPageLimit = Math.max(Number(currentGroup.firstPageLimit || 0), Number(page.firstPageLimit || 0));
      return;
    }
    tablePageGroups.push({
      pages: [page],
      estimatedRows: page.estimatedRows,
      allowFirstPage: page.allowFirstPage,
      firstPageLimit: Number(page.firstPageLimit || 0),
    });
  });
  const firstInlineLimit = isLandscape ? 12 : 8;
  const firstTableGroup = tablePageGroups[0];
  const firstTableGroupLimit = Math.max(firstInlineLimit, Number(firstTableGroup?.firstPageLimit || 0));
  const firstInlineTables = firstTableGroup?.allowFirstPage && firstTableGroup.estimatedRows <= firstTableGroupLimit ? firstTableGroup.pages : [];
  const continuationTablePageGroups = firstInlineTables.length ? tablePageGroups.slice(1) : tablePageGroups;

  const totalPages = 1 + continuationTablePageGroups.length;
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
          <tr class="pdf-table-top-spacer"><th colspan="${page.columns.length}"></th></tr>
          <tr>${page.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
        </thead>
        <tfoot>
          <tr class="pdf-table-bottom-spacer"><td colspan="${page.columns.length}"></td></tr>
        </tfoot>
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
      ${firstInlineTables.map(renderTableSection).join("")}
      ${renderFooter(1)}
    </section>
  `;

  const tablePagesHtml = continuationTablePageGroups
    .map(
      (group, index) => `
        <section class="pdf-page">
          ${group.pages.map(renderTableSection).join("")}
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
          @page { size: ${pageSize}; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Verdana, Geneva, sans-serif; color: #0f172a; }
          .pdf-page { height: ${pageHeight}; margin: 0; padding: 10mm 8mm 14mm; position: relative; page-break-after: always; overflow: hidden; }
          .pdf-page:last-of-type { page-break-after: auto; }
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
          .pdf-section-block--table { break-inside: auto; page-break-inside: auto; }
          .pdf-section-block h3 { margin: 0 0 10px; padding-left: 8px; border-left: 4px solid #da291c; color: #c22820; font-size: 13px; }
          .pdf-analytics-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
          .pdf-analytics-card { border: 1px solid #d6dee8; border-radius: 10px; padding: 10px 12px; }
          .pdf-analytics-card h4 { margin: 0 0 8px; font-size: 12px; color: #0f172a; }
          .pdf-analytics-rows { display: grid; gap: 5px; }
          .pdf-analytics-row { display: grid; grid-template-columns: minmax(80px, 0.75fr) minmax(0, 1.25fr); gap: 8px; align-items: start; font-size: 10px; }
          .pdf-analytics-row strong { font-size: 10px; text-align: right; overflow-wrap: anywhere; }
          table { width: 100%; border-collapse: collapse; font-size: ${tableFontSize}; table-layout: fixed; break-inside: auto; page-break-inside: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          th, td { border: 1px solid #d6dee8; padding: ${tableCellPadding}; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
          th { background: #f8fafc; color: #0f172a; font-size: 9px; }
          .pdf-table-top-spacer th { height: 4mm; padding: 0; border: 0; background: transparent; }
          .pdf-table-bottom-spacer td { height: 6mm; padding: 0; border: 0; background: transparent; }
          .empty-row { text-align: center; color: #6b7280; }
          .pdf-footer { position: absolute; left: 8mm; right: 8mm; bottom: 1mm; padding-top: 6px; border-top: 1px solid #d6dee8; display: flex; justify-content: space-between; font-size: 9px; break-inside: avoid; page-break-inside: avoid; }
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
  const location = useLocation();
  const { username } = useParams();
  const normalizedRole = String(roleType || "")
    .trim()
    .toUpperCase();
  const [kpiCalendarDate, setKpiCalendarDate] = useState(() => new Date());
  const activeCurrentKpiMonth = monthKey(kpiCalendarDate);
  const activeNextKpiMonth = followingMonthKey(activeCurrentKpiMonth);
  const activeKpiMonthOptions = useMemo(() => buildKpiMonthOptions(activeNextKpiMonth), [activeNextKpiMonth]);
  const agentTableTopScrollRef = useRef(null);
  const agentTableScrollRef = useRef(null);
  const orphanTableTopScrollRef = useRef(null);
  const orphanTableScrollRef = useRef(null);
  const orphanActionTopRef = useRef(null);
  const longLeaveStepperRef = useRef(null);
  const [activeView, setActiveView] = useState(() => location.state?.activeView || "dashboard");
  const [agentSearch, setAgentSearch] = useState("");
  const [agentSort, setAgentSort] = useState("usernameAsc");
  const [orphanAgentSearch, setOrphanAgentSearch] = useState("");
  const [orphanAgentSort, setOrphanAgentSort] = useState("usernameAsc");
  const [orphanAgentTypeFilter, setOrphanAgentTypeFilter] = useState("ALL");
  const [orphanUnitFilter, setOrphanUnitFilter] = useState("ALL");
  const [orphanStatusFilter, setOrphanStatusFilter] = useState("ALL");
  const [orphanAgentAction, setOrphanAgentAction] = useState("");
  const [orphanLeaveStartDate, setOrphanLeaveStartDate] = useState("");
  const [orphanLeaveEndDate, setOrphanLeaveEndDate] = useState("");
  const [orphanLeaveApplicationForm, setOrphanLeaveApplicationForm] = useState(null);
  const [orphanApprovedLeaveProof, setOrphanApprovedLeaveProof] = useState(null);
  const [orphanLongLeaveFieldErrors, setOrphanLongLeaveFieldErrors] = useState({});
  const [orphanLongLeaveId, setOrphanLongLeaveId] = useState("");
  const [orphanLongLeaveSaving, setOrphanLongLeaveSaving] = useState(false);
  const [orphanLongLeaveDetailsDirty, setOrphanLongLeaveDetailsDirty] = useState(false);
  const [orphanSavedLongLeaveDetails, setOrphanSavedLongLeaveDetails] = useState(null);
  const [orphanViewingSavedLongLeave, setOrphanViewingSavedLongLeave] = useState(false);
  const [orphanLongLeaveStatus, setOrphanLongLeaveStatus] = useState("Recorded");
  const [scrollToLongLeaveRecordId, setScrollToLongLeaveRecordId] = useState("");
  const [orphanLongLeaveStep, setOrphanLongLeaveStep] = useState(1);
  const [orphanResignationId, setOrphanResignationId] = useState("");
  const [orphanResignationDate, setOrphanResignationDate] = useState("");
  const [orphanResignationLetter, setOrphanResignationLetter] = useState(null);
  const [orphanApprovedResignationProof, setOrphanApprovedResignationProof] = useState(null);
  const [orphanResignationStatus, setOrphanResignationStatus] = useState("Recorded");
  const [orphanResignationStep, setOrphanResignationStep] = useState(1);
  const [orphanSavedResignationDetails, setOrphanSavedResignationDetails] = useState(null);
  const [includeOngoingPolicyholders, setIncludeOngoingPolicyholders] = useState(false);
  const [confirmOrphanTransfer, setConfirmOrphanTransfer] = useState(false);
  const [longLeaveStepperScrollSignal, setLongLeaveStepperScrollSignal] = useState(0);
  const [showEndorseOrphansModal, setShowEndorseOrphansModal] = useState(false);
  const [orphanConfirmedProspects, setOrphanConfirmedProspects] = useState([]);
  const [orphanConfirmedPolicyholders, setOrphanConfirmedPolicyholders] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedUnitName, setSelectedUnitName] = useState("");
  const [unitPerformanceTab, setUnitPerformanceTab] = useState("clients");
  const [orphanEndorsementTab, setOrphanEndorsementTab] = useState("long_leaves");
  const [selectedUmLongLeaveRecordId, setSelectedUmLongLeaveRecordId] = useState("");
  const [selectedUmAffectedClient, setSelectedUmAffectedClient] = useState(null);
  const [selectedReassignmentAgentId, setSelectedReassignmentAgentId] = useState("");
  const [reassignmentSaving, setReassignmentSaving] = useState(false);
  const [reassignmentSuccess, setReassignmentSuccess] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [taskSearch, setTaskSearch] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [salesSearch, setSalesSearch] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [taskDatePreset, setTaskDatePreset] = useState("ALL");
  // eslint-disable-next-line no-unused-vars
  const [salesDatePreset, setSalesDatePreset] = useState("ALL");
  const [unitPerformanceDatePreset, setUnitPerformanceDatePreset] = useState("ALL");
  const [unitKpiDatePreset, setUnitKpiDatePreset] = useState("TODAY");
  const [branchKpiDatePreset, setBranchKpiDatePreset] = useState("TODAY");
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
  const [kpiSelectedMonths, setKpiSelectedMonths] = useState({});
  useEffect(() => {
    const timer = window.setInterval(() => {
      setKpiCalendarDate((current) => {
        if (monthKey(current) === monthKey()) return current;
        setKpiSelectedMonths({});
        return new Date();
      });
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sideNavCollapsed, setSideNavCollapsed] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  useLayoutEffect(() => {
    if (!longLeaveStepperScrollSignal) return;
    const scrollToStepper = (behavior = "smooth") => {
      const formStart = orphanActionTopRef.current || longLeaveStepperRef.current;
      if (!formStart) return;
      formStart.scrollIntoView({ behavior, block: "start", inline: "nearest" });
      const top = Math.max(0, formStart.getBoundingClientRect().top + window.scrollY - 12);
      window.scrollTo({ top, behavior });
      document.documentElement.scrollTop = top;
      document.body.scrollTop = top;
    };
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollToStepper("auto"));
    });
    const timeoutId = window.setTimeout(() => scrollToStepper("smooth"), 260);
    const secondTimeoutId = window.setTimeout(() => scrollToStepper("smooth"), 620);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(secondTimeoutId);
    };
  }, [longLeaveStepperScrollSignal, orphanLongLeaveStep]);

  useLayoutEffect(() => {
    if (!scrollToLongLeaveRecordId || orphanAgentAction) return;
    const target = document.querySelector(`[data-long-leave-id="${scrollToLongLeaveRecordId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrollToLongLeaveRecordId("");
  }, [scrollToLongLeaveRecordId, orphanAgentAction]);

  const syncScrollPair = (source, topScroller, tableScroller) => {
    if (!topScroller || !tableScroller) return;
    const sourceScroller = source === "top" ? topScroller : tableScroller;
    const targetScroller = source === "top" ? tableScroller : topScroller;
    const sourceMax = Math.max(1, sourceScroller.scrollWidth - sourceScroller.clientWidth);
    const targetMax = Math.max(0, targetScroller.scrollWidth - targetScroller.clientWidth);
    const nextLeft = (sourceScroller.scrollLeft / sourceMax) * targetMax;
    if (Math.abs(targetScroller.scrollLeft - nextLeft) > 1) targetScroller.scrollLeft = nextLeft;
  };

  const syncAgentTableScroll = (source) => {
    syncScrollPair(source, agentTableTopScrollRef.current, agentTableScrollRef.current);
  };

  const syncOrphanTableScroll = (source) => {
    syncScrollPair(source, orphanTableTopScrollRef.current, orphanTableScrollRef.current);
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
    if (location.state?.activeView) setActiveView(location.state.activeView);
  }, [location.state]);

  useEffect(() => {
    const branchPageLabels = {
      dashboard: "Branch Overview",
      agents: "Branch Units",
      kpi_assignment: "Branch KPI Assignment",
      kpi_progress: "Branch KPI Progress",
      orphan_clients: "Orphan Client Management",
    };
    const unitPageLabels = {
      dashboard: "Unit Overview",
      agents: "Unit Details",
      kpi_progress: "Branch KPI Progress Dashboard",
      orphan_endorsements: "Orphan Clients Endorsements",
    };
    const pageLabels = normalizedRole === "BM" ? branchPageLabels : unitPageLabels;
    if ((activeView === "agents" || activeView === "orphan_clients") && selectedAgentId) {
      document.title = `${portalData?.scope?.branchCode || user?.username || normalizedRole} | Agent Details`;
      return;
    }
    document.title = `${user?.username || normalizedRole} | ${pageLabels[activeView] || pageLabels.dashboard}`;
  }, [activeView, normalizedRole, portalData?.scope?.branchCode, selectedAgentId, user?.username]);

  useEffect(() => {
    if (normalizedRole !== "BM" && (activeView === "kpi_assignment" || activeView === "orphan_clients")) setActiveView("dashboard");
    if (normalizedRole !== "UM" && activeView === "orphan_endorsements") setActiveView("dashboard");
  }, [activeView, normalizedRole]);

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
    const kpiViews = normalizedRole === "BM" ? ["dashboard", "agents", "kpi_assignment", "kpi_progress", "orphan_clients"] : ["dashboard", "agents", "kpi_progress", "orphan_endorsements"];
    if (!kpiViews.includes(activeView)) return;

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
  }, [activeView, normalizedRole, refreshCount, user?.id, user?.role, activeCurrentKpiMonth]);

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

  const updateAgentMonthlyKpiDraft = (assignment, kpiKey, field, value) => {
    const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
    const rowKey = `${assignmentKey}:${kpiKey}`;
    const selectedMonth = kpiSelectedMonths[rowKey] || activeCurrentKpiMonth;
    setKpiDrafts((current) => ({
      ...current,
      [assignmentKey]: (current[assignmentKey] || assignment.kpis || []).map((kpi) => {
        if (kpi.key !== kpiKey) return kpi;
        const rows = (Array.isArray(kpi.monthlyAssignments) ? kpi.monthlyAssignments : []).map((row) => ({ ...row }));
        const index = rows.findIndex((row) => row.monthKey === selectedMonth);
        const nextRow = { ...getMonthlyKpiAssignment(kpi, selectedMonth), [field]: value };
        if (field === "targetValue" && String(value).trim() !== "") Object.assign(nextRow, { targetMin: "", targetMax: "" });
        if ((field === "targetMin" || field === "targetMax") && String(value).trim() !== "") nextRow.targetValue = "";
        if (index >= 0) rows[index] = nextRow;
        else rows.push(nextRow);
        return { ...kpi, monthlyAssignments: rows };
      }),
    }));
    setKpiFieldErrors((current) => ({ ...current, [rowKey]: {} }));
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

  const validateMonthlyKpiAssignment = (kpi, row) => {
    if (row?.assigned !== true) return {};
    const errors = {};
    const hasMin = String(row.targetMin ?? "").trim() !== "";
    const hasMax = String(row.targetMax ?? "").trim() !== "";
    const hasTarget = String(row.targetValue ?? "").trim() !== "";
    const values = { targetMin: Number(row.targetMin), targetMax: Number(row.targetMax), targetValue: Number(row.targetValue) };
    if (!hasMin && !hasMax && !hasTarget) errors.targetValue = "Target or min/max is required.";
    for (const field of ["targetMin", "targetMax", "targetValue"]) {
      const present = field === "targetMin" ? hasMin : field === "targetMax" ? hasMax : hasTarget;
      if (present && (!Number.isFinite(values[field]) || values[field] < 0 || !Number.isInteger(values[field]))) {
        errors[field] = "Enter a non-negative whole number.";
      }
    }
    if (hasMin && hasMax && values.targetMin >= values.targetMax) {
      errors.targetMin = "Min must be less than max.";
      errors.targetMax = "Max must be greater than min.";
    }
    return errors;
  };

  const saveKpi = async (assignment, kpiKey, kpiOverride = null) => {
    const assignmentKey = `${assignment.scopeType}:${assignment.scopeId}`;
    const draftList = kpiOverride
      ? (kpiDrafts[assignmentKey] || assignment.kpis || []).map((item) => (item.key === kpiKey ? kpiOverride : item))
      : (kpiDrafts[assignmentKey] || assignment.kpis || []);
    const kpi = kpiOverride || draftList.find((item) => item.key === kpiKey);
    const rowKey = `${assignmentKey}:${kpiKey}`;
    const selectedMonth = kpiSelectedMonths[rowKey] || activeCurrentKpiMonth;
    const isMonthlyScope = ["AGENT", "UNIT", "BRANCH"].includes(assignment.scopeType);
    const monthlyAssignment = isMonthlyScope ? getMonthlyKpiAssignment(kpi, selectedMonth) : null;
    const validationErrors = isMonthlyScope
      ? validateMonthlyKpiAssignment(kpi, monthlyAssignment)
      : validateKpiDraft(kpi || {});
    if (Object.keys(validationErrors).length) {
      setKpiFieldErrors((current) => ({ ...current, [rowKey]: validationErrors }));
      setExpandedKpiKey(rowKey);
      return;
    }
    setKpiFieldErrors((current) => ({ ...current, [rowKey]: {} }));

    const currentDraft = isMonthlyScope
      ? { ...cloneKpiDraft(kpi || {}), monthAssignment: monthlyAssignment }
      : cloneKpiDraft(kpi || {});

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
      // Keep the saved KPI open with its month selector unlocked. Saving next
      // month must not turn the still-current month into a historical record;
      // the manager can immediately switch back and continue editing it.
      setExpandedKpiKey(rowKey);
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
    { key: "monthlyPremium", label: "Monthly Premium Breakdown" },
    { key: "quarterlyPremium", label: "Quarterly Premium Breakdown" },
    { key: "halfYearlyPremium", label: "Half-Yearly Premium Breakdown" },
    { key: "yearlyPremium", label: "Yearly Premium Breakdown" },
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
    if (sortedBackendUnits.length) return normalizedRole === "BM" ? [{ name: "All Units", isAllUnits: true }, ...sortedBackendUnits] : sortedBackendUnits;
    const fallbackUnits = [...new Set((portalData?.agents || []).map((agent) => String(agent?.unit || "").trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .map((name) => ({ name, manager: { code: "—", name: "—" }, assistantManager: { code: "—", name: "—" } }));
    return fallbackUnits.length ? (normalizedRole === "BM" ? [{ name: "All Units", isAllUnits: true }, ...fallbackUnits] : fallbackUnits) : fallbackUnits;
  }, [normalizedRole, portalData?.agents, portalData?.units]);

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

  const unitLongLeaveEndorsementRows = useMemo(() =>
    (portalData?.agents || [])
      .filter((agent) => (selectedUnit?.name && !isAllUnitsSelected ? String(agent?.unit || "") === selectedUnit.name : true))
      .flatMap((agent) => (Array.isArray(agent?.leaveRecords) ? agent.leaveRecords : [])
        .filter((leaveRecord) => String(leaveRecord?.status || "").trim() === "Endorsed")
        .map((leaveRecord) => ({
          ...leaveRecord,
          recordType: "long_leave",
          agentId: agent?.id || "",
          agentCode: agent?.username || "—",
          agentName: agent?.name || agent?.username || "—",
          unitName: agent?.unit || "",
        })))
      .sort((left, right) => {
        const leftTime = new Date(left?.leaveStartDate || 0).getTime() || 0;
        const rightTime = new Date(right?.leaveStartDate || 0).getTime() || 0;
        return leftTime - rightTime;
      }),
    [isAllUnitsSelected, portalData?.agents, selectedUnit?.name],
  );

  const unitResignationEndorsementRows = useMemo(() =>
    (portalData?.agents || [])
      .filter((agent) => (selectedUnit?.name && !isAllUnitsSelected ? String(agent?.unit || "") === selectedUnit.name : true))
      .flatMap((agent) => (Array.isArray(agent?.resignationRecords) ? agent.resignationRecords : [])
        .filter((resignationRecord) => String(resignationRecord?.status || "").trim() === "Endorsed")
        .map((resignationRecord) => ({
          ...resignationRecord,
          recordType: "resignation",
          agentId: agent?.id || "",
          agentCode: agent?.username || "—",
          agentName: agent?.name || agent?.username || "—",
          unitName: agent?.unit || "",
        })))
      .sort((left, right) => {
        const leftTime = new Date(left?.resignationDate || 0).getTime() || 0;
        const rightTime = new Date(right?.resignationDate || 0).getTime() || 0;
        return leftTime - rightTime;
      }),
    [isAllUnitsSelected, portalData?.agents, selectedUnit?.name],
  );

  const selectedUmLongLeaveRecord = useMemo(() => {
    const rows = orphanEndorsementTab === "resignations" ? unitResignationEndorsementRows : unitLongLeaveEndorsementRows;
    return rows.find((record) => String(record?.id || record?._id || "") === String(selectedUmLongLeaveRecordId || "")) || null;
  }, [orphanEndorsementTab, selectedUmLongLeaveRecordId, unitLongLeaveEndorsementRows, unitResignationEndorsementRows]);

  const selectedUmEndorsementIsResignation = selectedUmLongLeaveRecord?.recordType === "resignation";
  const reassignmentMonthLabel = portalData?.reportContext?.reassignmentMonthLabel || "Current Month";

  const reassignmentAgentRows = useMemo(() =>
    (portalData?.agents || [])
      .filter((agent) => String(agent?.unit || "") === String(selectedUmLongLeaveRecord?.unitName || selectedUnit?.name || ""))
      .filter((agent) => String(agent?.id || "") !== String(selectedUmLongLeaveRecord?.agentId || ""))
      .map((agent) => {
        const completedApproaches = Number(agent?.reassignmentMonthlyDoneApproaches ?? agent?.completedApproaches ?? 0);
        const openApproachTasks = Number(agent?.reassignmentOpenApproachTasksDueThisMonth ?? agent?.openApproachTasksDueThisMonth ?? agent?.openApproachTasks ?? 0);
        const monthlyDoneApproachesTarget = Number(agent?.reassignmentMonthlyApproachTarget || REASSIGNMENT_KPI_TARGETS.monthlyDoneApproaches);
        const closingRatio = Number(agent?.reassignmentMonthlyClosingRatio ?? agent?.conversionRate ?? 0);
        const monthlyClosingRatioTarget = Number(agent?.reassignmentMonthlyClosingRatioTarget || REASSIGNMENT_KPI_TARGETS.monthlyClosingRatio);
        const activePolicies = Number(agent?.reassignmentMonthlyActivePolicies ?? agent?.activePolicies ?? 0);
        const totalActivePolicies = Number(agent?.activePolicies ?? 0);
        const monthlyActivePoliciesTarget = Number(agent?.reassignmentMonthlyActivePoliciesTarget || REASSIGNMENT_KPI_TARGETS.monthlyActivePolicies);
        return {
          ...agent,
          reassignmentMetrics: {
            completedApproaches,
            openApproachTasks,
            projectedApproaches: completedApproaches + openApproachTasks,
            monthlyDoneApproachesTarget,
            closingRatio,
            monthlyClosingRatioTarget,
            activePolicies,
            totalActivePolicies,
            monthlyActivePoliciesTarget,
          },
        };
      })
      .filter((agent) => String(agent?.status || "").trim() === "Active")
      .filter((agent) => normalizeAgentType(agent?.agentType) === "full time" || normalizeAgentType(agent?.agentType) === "full-time")
      .filter((agent) => agent.reassignmentMetrics.completedApproaches < agent.reassignmentMetrics.monthlyDoneApproachesTarget)
      .filter((agent) => agent.reassignmentMetrics.projectedApproaches < agent.reassignmentMetrics.monthlyDoneApproachesTarget)
      .filter((agent) => agent.reassignmentMetrics.closingRatio >= agent.reassignmentMetrics.monthlyClosingRatioTarget)
      .filter((agent) => agent.reassignmentMetrics.activePolicies >= agent.reassignmentMetrics.monthlyActivePoliciesTarget)
      .filter((agent) => agent.reassignmentMetrics.totalActivePolicies <= 9)
      .sort((left, right) => String(left?.name || left?.username || "").localeCompare(String(right?.name || right?.username || ""))),
    [portalData?.agents, selectedUmLongLeaveRecord?.agentId, selectedUmLongLeaveRecord?.unitName, selectedUnit?.name],
  );


  const getReassignmentProgressStatus = (value, target) => {
    const progressValue = Number(value || 0);
    const targetValue = Number(target || 0);
    if (!targetValue) return { key: "neutral", label: "No target" };
    if (progressValue > targetValue) return { key: "exceeded", label: "Exceeded" };
    if (progressValue === targetValue) return { key: "on-target", label: "On target" };
    return { key: "below", label: "Below target" };
  };

  const renderReassignmentMetricTile = ({ label, value, target, suffix = "", note = "", variant = "progress" }) => {
    const status = variant === "progress" ? getReassignmentProgressStatus(value, target) : { key: variant, label: note };
    return (
      <div className={`manager-reassignment-metric-cell manager-reassignment-metric-cell--${variant} manager-reassignment-metric-cell--${status.key}`}>
        <span className="manager-reassignment-metric-label">{label}</span>
        <strong className="manager-reassignment-metric-value">{value}{suffix}</strong>
        {status.label ? <span className="manager-reassignment-status-indicator">{status.label}</span> : null}
        {Number.isFinite(Number(target)) && Number(target) > 0 && <small>Target: {target}{suffix}</small>}
      </div>
    );
  };


  const selectedReassignmentAgent = useMemo(() => {
    const selectedId = selectedReassignmentAgentId || selectedUmAffectedClient?.reassignedToAgentId || "";
    return (portalData?.agents || []).find((agent) => String(agent?.id || "") === String(selectedId)) || null;
  }, [portalData?.agents, selectedReassignmentAgentId, selectedUmAffectedClient?.reassignedToAgentId]);

  const displayedReassignmentAgentRows = useMemo(() => {
    if (selectedUmAffectedClient?.reassigned === true && selectedReassignmentAgent) {
      const selectedRow = reassignmentAgentRows.find((agent) => String(agent.id || "") === String(selectedReassignmentAgent.id || ""));
      return [selectedRow || {
        ...selectedReassignmentAgent,
        reassignmentMetrics: {
          completedApproaches: Number(selectedReassignmentAgent?.reassignmentMonthlyDoneApproaches || 0),
          openApproachTasks: Number(selectedReassignmentAgent?.reassignmentOpenApproachTasksDueThisMonth || 0),
          projectedApproaches: Number(selectedReassignmentAgent?.reassignmentMonthlyDoneApproaches || 0) + Number(selectedReassignmentAgent?.reassignmentOpenApproachTasksDueThisMonth || 0),
          monthlyDoneApproachesTarget: Number(selectedReassignmentAgent?.reassignmentMonthlyApproachTarget || REASSIGNMENT_KPI_TARGETS.monthlyDoneApproaches),
          closingRatio: Number(selectedReassignmentAgent?.reassignmentMonthlyClosingRatio || selectedReassignmentAgent?.conversionRate || 0),
          monthlyClosingRatioTarget: Number(selectedReassignmentAgent?.reassignmentMonthlyClosingRatioTarget || REASSIGNMENT_KPI_TARGETS.monthlyClosingRatio),
          activePolicies: Number(selectedReassignmentAgent?.reassignmentMonthlyActivePolicies || selectedReassignmentAgent?.activePolicies || 0),
          monthlyActivePoliciesTarget: Number(selectedReassignmentAgent?.reassignmentMonthlyActivePoliciesTarget || REASSIGNMENT_KPI_TARGETS.monthlyActivePolicies),
        },
      }];
    }
    return reassignmentAgentRows;
  }, [reassignmentAgentRows, selectedReassignmentAgent, selectedUmAffectedClient?.reassigned]);

  const openAffectedClientDetail = (client) => {
    setSelectedUmAffectedClient(client);
    setSelectedReassignmentAgentId(client?.reassignedToAgentId || "");
    setReassignmentSuccess(null);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const applyLongLeaveRecordUpdate = (updatedRecord) => {
    if (!updatedRecord?.id) return;
    setPortalData((current) => {
      if (!current?.agents) return current;
      return {
        ...current,
        agents: current.agents.map((agent) => {
          const records = Array.isArray(agent?.leaveRecords) ? agent.leaveRecords : [];
          const hasRecord = records.some((record) => String(record?.id || "") === String(updatedRecord.id));
          if (!hasRecord) return agent;
          return {
            ...agent,
            leaveRecords: records.map((record) => String(record?.id || "") === String(updatedRecord.id) ? updatedRecord : record),
          };
        }),
      };
    });
  };

  const applyResignationRecordUpdate = (updatedRecord) => {
    const updatedId = String(updatedRecord?.id || updatedRecord?._id || "");
    if (!updatedId) return;
    setPortalData((current) => {
      if (!current?.agents) return current;
      return {
        ...current,
        agents: current.agents.map((agent) => {
          const records = Array.isArray(agent?.resignationRecords) ? agent.resignationRecords : [];
          const hasRecord = records.some((record) => String(record?.id || record?._id || "") === updatedId);
          if (!hasRecord) return agent;
          return {
            ...agent,
            resignationRecords: records.map((record) => String(record?.id || record?._id || "") === updatedId ? { ...updatedRecord, id: updatedId, recordType: "resignation" } : record),
          };
        }),
      };
    });
  };

  const confirmAffectedClientReassignment = async () => {
    const selectedEndorsementRecordId = selectedUmLongLeaveRecord?.id || selectedUmLongLeaveRecord?._id || "";
    if (!selectedEndorsementRecordId || !selectedUmAffectedClient || !selectedReassignmentAgentId) return;
    const isResignationReassignment = selectedUmEndorsementIsResignation || selectedUmAffectedClient?.recordType === "resignation";
    const isPolicyholderReassignment = selectedUmAffectedClient?.kind === "policyholder";
    const endpoint = isResignationReassignment ? "reassign-prospect" : (isPolicyholderReassignment ? "reassign-policyholder" : "reassign-prospect");
    setReassignmentSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/manager/${isResignationReassignment ? "resignation" : "long-leave"}/${selectedEndorsementRecordId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isPolicyholderReassignment && !isResignationReassignment
          ? {
              policyholderId: selectedUmAffectedClient.id,
              reassignmentAgentId: selectedReassignmentAgentId,
            }
          : {
              prospectId: selectedUmAffectedClient.prospectId,
              leadId: selectedUmAffectedClient.leadId || selectedUmAffectedClient.id,
              reassignmentAgentId: selectedReassignmentAgentId,
            }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to confirm reassignment.");
      if (isResignationReassignment) applyResignationRecordUpdate(data?.resignation);
      else {
        const updatedRecord = normalizeLongLeaveRecord(data?.longLeave);
        applyLongLeaveRecordUpdate(updatedRecord);
      }
      const reassignment = data?.reassignment || {};
      setSelectedUmAffectedClient((current) => current ? {
        ...current,
        reassigned: true,
        reassignedAt: reassignment.reassignedAt,
        reassignedToUserId: reassignment.reassignedToUserId,
        reassignedToAgentId: reassignment.reassignedToAgentId || selectedReassignmentAgentId,
        reassignedToAgentName: reassignment.reassignedToAgentName || selectedReassignmentAgent?.name || "—",
      } : current);
      setSelectedReassignmentAgentId(reassignment.reassignedToAgentId || selectedReassignmentAgentId);
      setReassignmentSuccess({
        message: data?.message || (isPolicyholderReassignment
          ? `${selectedUmAffectedClient.name || "Prospect"} with policyholder code ${selectedUmAffectedClient.code || "—"} has been reassigned to ${reassignment.reassignedToAgentName || selectedReassignmentAgent?.name || "—"} from ${reassignment.originalAgentName || selectedUmLongLeaveRecord.agentName || "—"}.`
          : `${selectedUmAffectedClient.name || "Prospect"} with lead code ${selectedUmAffectedClient.leadCode || "—"} has been reassigned to ${reassignment.reassignedToAgentName || selectedReassignmentAgent?.name || "—"} from ${reassignment.originalAgentName || selectedUmLongLeaveRecord.agentName || "—"}.`),
      });
    } catch (err) {
      setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: err?.message || "Failed to confirm reassignment." }));
    } finally {
      setReassignmentSaving(false);
    }
  };

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
  const unitKpiPeriod = getKpiPeriodForDatePreset(unitKpiDatePreset) || "Daily";
  const branchKpiPeriod = getKpiPeriodForDatePreset(branchKpiDatePreset) || "Daily";
  const branchKpiDateOptions = DATE_PRESETS.filter((option) => option.value !== "ALL");

  const branchKpiPeriodLabel = useMemo(() => getPresetLabel(branchKpiDatePreset), [branchKpiDatePreset]);
  const branchKpiReportPeriodLabel = useMemo(() => {
    const endDate = new Date();
    const daysByPreset = { "7d": 7, "30d": 30, "90d": 90, "6m": 180, "12m": 365 };
    if (branchKpiDatePreset === "TODAY") return formatDate(endDate);
    const days = daysByPreset[branchKpiDatePreset] || 30;
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }, [branchKpiDatePreset]);
  const unitKpiReportPeriodLabel = useMemo(() => {
    const endDate = new Date();
    const daysByPreset = { "7d": 7, "30d": 30, "90d": 90, "6m": 180, "12m": 365 };
    if (unitKpiDatePreset === "TODAY") return formatDate(endDate);
    const days = daysByPreset[unitKpiDatePreset] || 30;
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }, [unitKpiDatePreset]);

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

  const dashboardUnitKpiCards = useMemo(() => {
    if (isAllUnitsSelected || !unitKpiPeriod) return [];
    const unitAssignment = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "UNIT");
    if (!unitAssignment) return [];
    const rowsForSelectedPeriod = (portalData?.kpiSalesRowsByFrequency?.[unitKpiPeriod] || [])
      .filter((row) => String(row?.unit || "") === String(selectedUnit?.name || ""));
    const periodSummary = summarizeKpiRows(rowsForSelectedPeriod);

    return (unitAssignment.kpis || []).filter((kpi) => kpi.assigned !== false && kpi.key === "monthly_sales_production").map((kpi) => {
      const kpiForPeriod = selectKpiTargetForPeriod(kpi, unitKpiPeriod);
      const actualByKey = {
        monthly_sales_production: Number(periodSummary.totalAnnualPremium || 0),
      };
      const actual = actualByKey[kpi.key] || 0;
      return { kpi: kpiForPeriod, actual, comparison: getKpiComparison(actual, kpiForPeriod), dateRangeLabel: getKpiFrequencyRangeLabel(unitKpiPeriod) };
    });
  }, [isAllUnitsSelected, kpiData?.assignments, portalData?.kpiSalesRowsByFrequency, selectedUnit?.name, unitKpiPeriod]);

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
    () => {
      const unitRow = selectedUnitRows.find((agent) => String(agent?.id || "") === selectedAgentId) || null;
      const fullAgent = (portalData?.agents || []).find((agent) => String(agent?.id || "") === selectedAgentId) || null;
      if (fullAgent) return { ...(unitRow || {}), ...fullAgent };
      return unitRow;
    },
    [portalData?.agents, selectedAgentId, selectedUnitRows],
  );

  const orphanAgentTypeOptions = useMemo(() =>
    [...new Set((portalData?.agents || []).map((agent) => String(agent?.agentType || "").trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })),
    [portalData?.agents],
  );

  const orphanUnitOptions = useMemo(() =>
    [...new Set((portalData?.agents || []).map((agent) => String(agent?.unit || "").trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })),
    [portalData?.agents],
  );

  const orphanStatusOptions = ["Active", "On Long Leave", "Resigned"];

  const orphanAgentRows = useMemo(() => {
    const searchedAgents = buildFilter(portalData?.agents || [], orphanAgentSearch, ["username", "name"]);
    const filteredByDropdowns = searchedAgents.filter((agent) => {
      const agentType = String(agent?.agentType || "");
      const unit = String(agent?.unit || "");
      const status = String(agent?.status || "Active");
      return (orphanAgentTypeFilter === "ALL" || agentType === orphanAgentTypeFilter)
        && (orphanUnitFilter === "ALL" || unit === orphanUnitFilter)
        && (orphanStatusFilter === "ALL" || status === orphanStatusFilter);
    });

    const compareText = (left, right, key) => String(left?.[key] || "").localeCompare(String(right?.[key] || ""), undefined, { numeric: true, sensitivity: "base" });
    const compareDate = (left, right, key) => {
      const leftTime = new Date(left?.[key] || 0).getTime() || 0;
      const rightTime = new Date(right?.[key] || 0).getTime() || 0;
      return leftTime - rightTime;
    };
    const sorters = {
      usernameAsc: (left, right) => compareText(left, right, "username"),
      usernameDesc: (left, right) => compareText(left, right, "username") * -1,
      nameAsc: (left, right) => compareText(left, right, "name"),
      nameDesc: (left, right) => compareText(left, right, "name") * -1,
      dateEmployedAsc: (left, right) => compareDate(left, right, "dateEmployed"),
      dateEmployedDesc: (left, right) => compareDate(left, right, "dateEmployed") * -1,
    };

    return [...filteredByDropdowns].sort((left, right) => (sorters[orphanAgentSort] || sorters.usernameAsc)(left, right) || compareText(left, right, "username"));
  }, [orphanAgentSearch, orphanAgentSort, orphanAgentTypeFilter, orphanStatusFilter, orphanUnitFilter, portalData?.agents]);

  const clearOrphanAgentControls = () => {
    setOrphanAgentSort("usernameAsc");
    setOrphanAgentTypeFilter("ALL");
    setOrphanUnitFilter("ALL");
    setOrphanStatusFilter("ALL");
  };

  const todayDateInputValue = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const minimumOrphanLeaveStartDate = useMemo(() => {
    const records = Array.isArray(selectedAgent?.leaveRecords) ? selectedAgent.leaveRecords : [];
    const currentLongLeaveId = String(orphanLongLeaveId || "");
    const latestEndTime = records.reduce((latest, record) => {
      if (currentLongLeaveId && String(record?.id || record?._id || "") === currentLongLeaveId) return latest;
      const status = String(record?.status || "").trim();
      if (["Recorded", "Confirmed Orphans"].includes(status)) return latest;
      const endTime = new Date(record?.leaveEndDate || 0).getTime() || 0;
      return Math.max(latest, endTime);
    }, 0);
    if (!latestEndTime) return todayDateInputValue;
    const nextAvailableDate = new Date(latestEndTime);
    nextAvailableDate.setDate(nextAvailableDate.getDate() + 1);
    return nextAvailableDate.toISOString().slice(0, 10) > todayDateInputValue ? nextAvailableDate.toISOString().slice(0, 10) : todayDateInputValue;
  }, [orphanLongLeaveId, selectedAgent?.leaveRecords, todayDateInputValue]);

  const minimumResignationDate = useMemo(() => {
    if (!selectedAgent?.dateEmployed) return "";
    const employedDate = new Date(selectedAgent.dateEmployed);
    if (Number.isNaN(employedDate.getTime())) return "";
    employedDate.setDate(employedDate.getDate() + 1);
    return employedDate.toISOString().slice(0, 10);
  }, [selectedAgent?.dateEmployed]);

  const orphanResignationDateError = useMemo(() => {
    if (orphanAgentAction !== "resigned" || orphanResignationStep !== 1 || !orphanResignationDate || !minimumResignationDate) return "";
    return orphanResignationDate < minimumResignationDate ? `Resignation date must be after ${formatDate(selectedAgent?.dateEmployed)}.` : "";
  }, [minimumResignationDate, orphanAgentAction, orphanResignationDate, orphanResignationStep, selectedAgent?.dateEmployed]);
  const resignationDetailsDirty = useMemo(() => {
    if (!orphanSavedResignationDetails) return Boolean(orphanResignationDate || orphanResignationLetter || orphanApprovedResignationProof);
    return orphanResignationDate !== (orphanSavedResignationDetails.resignationDate || "")
      || (orphanResignationLetter?.dataUrl || "") !== (orphanSavedResignationDetails.resignationLetter?.dataUrl || "")
      || (orphanApprovedResignationProof?.dataUrl || "") !== (orphanSavedResignationDetails.approvedResignationProof?.dataUrl || "");
  }, [orphanApprovedResignationProof, orphanResignationDate, orphanResignationLetter, orphanSavedResignationDetails]);

  const orphanLeaveEndDateError = useMemo(() => {
    if (orphanAgentAction !== "long_leave" || orphanLongLeaveStep !== 1 || orphanViewingSavedLongLeave || orphanLongLeaveStatus === "Endorsed" || !orphanLeaveStartDate || !orphanLeaveEndDate) return "";
    const start = new Date(`${orphanLeaveStartDate}T00:00:00`);
    const end = new Date(`${orphanLeaveEndDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
    const minimumStart = new Date(`${minimumOrphanLeaveStartDate}T00:00:00`);
    if (!Number.isNaN(minimumStart.getTime()) && start < minimumStart) return `Leave start date must be on or after ${formatDate(minimumOrphanLeaveStartDate)}.`;
    const dayDifference = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return dayDifference <= 7 ? "Leave end date should be beyond 7 days to be marked as on long leave." : "";
  }, [minimumOrphanLeaveStartDate, orphanAgentAction, orphanLeaveEndDate, orphanLeaveStartDate, orphanLongLeaveStatus, orphanLongLeaveStep, orphanViewingSavedLongLeave]);

  const orphanProspectsWithActiveLeads = selectedAgent?.orphanTransferProspects || [];
  const orphanPolicyholdersWithOngoingPolicies = selectedAgent?.orphanTransferPolicyholders || [];
  const resignationAffectedProspects = selectedAgent?.resignationTransferProspects || [];
  const displayedConfirmedProspects = orphanAgentAction === "resigned"
    ? resignationAffectedProspects
    : (orphanConfirmedProspects.length ? orphanConfirmedProspects : orphanProspectsWithActiveLeads);
  const displayedConfirmedPolicyholders = includeOngoingPolicyholders
    ? (orphanConfirmedPolicyholders.length ? orphanConfirmedPolicyholders : orphanPolicyholdersWithOngoingPolicies)
    : [];
  const resignationAffectedPolicyholders = resignationAffectedProspects.flatMap((prospect) =>
    (prospect.policies || []).map((policy) => ({
      ...policy,
      prospectId: prospect.prospectId || prospect.id,
      prospectCode: prospect.prospectCode,
      prospectName: prospect.name,
    })),
  );
  const hasPendingLongLeaveRecord = (Array.isArray(selectedAgent?.leaveRecords) ? selectedAgent.leaveRecords : []).some((record) => ["Recorded", "Confirmed Orphans"].includes(String(record?.status || "").trim()));
  const hasPendingResignationRecord = (Array.isArray(selectedAgent?.resignationRecords) ? selectedAgent.resignationRecords : []).some((record) => ["Recorded", "Confirmed Orphans"].includes(String(record?.status || "").trim()));
  const selectedAgentStatusLabel = String(selectedAgent?.status || "").trim();
  const selectedAgentIsResigned = selectedAgentStatusLabel === "Resigned";
  const selectedAgentIsOnLongLeave = selectedAgentStatusLabel === "On Long Leave";
  const disableOrphanStatusActions = selectedAgentIsResigned || selectedAgentIsOnLongLeave || hasPendingLongLeaveRecord || hasPendingResignationRecord;
  const disabledOrphanStatusActionHint = selectedAgentIsOnLongLeave ? "🚫" : undefined;
  const canAccessLongLeaveStep2 = Boolean(orphanLongLeaveId) && !orphanLongLeaveDetailsDirty;
  const canAccessLongLeaveStep3 = canAccessLongLeaveStep2 && ["Confirmed Orphans", "Endorsed"].includes(orphanLongLeaveStatus);
  const isEditingSavedLongLeaveDetails = orphanAgentAction === "long_leave" && orphanLongLeaveStep === 1 && Boolean(orphanLongLeaveId) && !orphanViewingSavedLongLeave;
  const isLongLeaveReadOnly = orphanViewingSavedLongLeave || orphanLongLeaveStatus === "Endorsed";
  const step2Prospects = isLongLeaveReadOnly && orphanConfirmedProspects.length ? orphanConfirmedProspects : orphanProspectsWithActiveLeads;
  const step2Policyholders = isLongLeaveReadOnly && orphanConfirmedPolicyholders.length ? orphanConfirmedPolicyholders : orphanPolicyholdersWithOngoingPolicies;

  const readOrphanLeaveFile = (file, field, validator) => {
    if (!file) return;
    const validationError = validator(file);
    if (validationError) {
      setOrphanLongLeaveFieldErrors((current) => ({ ...current, [field]: validationError }));
      if (field === "leaveApplicationForm") setOrphanLeaveApplicationForm(null);
      if (field === "approvedLeaveProof") setOrphanApprovedLeaveProof(null);
      if (field === "resignationLetter") setOrphanResignationLetter(null);
      if (field === "approvedResignationProof") setOrphanApprovedResignationProof(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const nextFile = {
        fileName: file.name,
        mimeType: file.type,
        dataUrl: String(reader.result || ""),
        size: file.size,
      };
      if (field === "leaveApplicationForm") setOrphanLeaveApplicationForm(nextFile);
      if (field === "approvedLeaveProof") setOrphanApprovedLeaveProof(nextFile);
      if (field === "resignationLetter") setOrphanResignationLetter(nextFile);
      if (field === "approvedResignationProof") setOrphanApprovedResignationProof(nextFile);
      setOrphanLongLeaveFieldErrors((current) => ({ ...current, [field]: "" }));
    };
    reader.onerror = () => setOrphanLongLeaveFieldErrors((current) => ({ ...current, [field]: "Failed to read uploaded file." }));
    reader.readAsDataURL(file);
  };

  const validateLongLeaveDetails = () => {
    const errors = {};
    if (!orphanLeaveStartDate) errors.leaveStartDate = "Leave start date is required.";
    if (!orphanLeaveEndDate) errors.leaveEndDate = "Leave end date is required.";
    if (orphanLeaveEndDateError) errors.leaveEndDate = orphanLeaveEndDateError;
    if (!orphanLeaveApplicationForm) errors.leaveApplicationForm = "Leave application form PDF is required.";
    if (!orphanApprovedLeaveProof) errors.approvedLeaveProof = "Proof of approved leave image is required.";
    setOrphanLongLeaveFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const saveLongLeaveDetails = async () => {
    if (!selectedAgent?.id || !validateLongLeaveDetails()) return false;
    setOrphanLongLeaveSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/manager/agents/${selectedAgent.id}/long-leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          longLeaveId: orphanLongLeaveId || undefined,
          leaveStartDate: orphanLeaveStartDate,
          leaveEndDate: orphanLeaveEndDate,
          leaveApplicationForm: orphanLeaveApplicationForm,
          approvedLeaveProof: orphanApprovedLeaveProof,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.field) setOrphanLongLeaveFieldErrors((current) => ({ ...current, [data.field]: data.message || "Invalid value." }));
        throw new Error(data?.message || "Failed to save long leave details.");
      }
      const savedRecord = normalizeLongLeaveRecord(data?.longLeave);
      setOrphanLongLeaveId(savedRecord?.id || orphanLongLeaveId);
      setOrphanLongLeaveStatus(savedRecord?.status || "Recorded");
      const savedSnapshot = savedRecord ? buildLongLeaveSnapshot(savedRecord) : {
        leaveStartDate: orphanLeaveStartDate,
        leaveEndDate: orphanLeaveEndDate,
        leaveApplicationForm: orphanLeaveApplicationForm,
        approvedLeaveProof: orphanApprovedLeaveProof,
      };
      setOrphanLeaveStartDate(savedSnapshot.leaveStartDate);
      setOrphanLeaveEndDate(savedSnapshot.leaveEndDate);
      setOrphanLeaveApplicationForm(savedSnapshot.leaveApplicationForm);
      setOrphanApprovedLeaveProof(savedSnapshot.approvedLeaveProof);
      setOrphanSavedLongLeaveDetails(savedSnapshot);
      if (savedRecord) upsertSelectedAgentLeaveRecord(savedRecord);
      setOrphanLongLeaveDetailsDirty(false);
      return true;
    } catch (err) {
      if (!err?.message) setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: "Failed to save long leave details." }));
      else setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: err.message }));
      return false;
    } finally {
      setOrphanLongLeaveSaving(false);
    }
  };

  const openSavedResignationRecord = (record) => {
    if (!record) return;
    setOrphanAgentAction("resigned");
    setOrphanResignationId(String(record.id || record._id || ""));
    setOrphanResignationDate(toDateInputValue(record.resignationDate));
    setOrphanResignationLetter(normalizeLongLeaveFile(record.resignationLetter, "application/pdf"));
    setOrphanApprovedResignationProof(normalizeLongLeaveFile(record.approvedResignationProof, "image/jpeg"));
    const normalizedStatus = String(record.status || "Recorded").trim();
    setOrphanResignationStatus(normalizedStatus);
    setOrphanResignationStep(normalizedStatus === "Endorsed" ? 1 : (normalizedStatus === "Recorded" ? 2 : 3));
    setOrphanLongLeaveFieldErrors({});
    setOrphanConfirmedProspects(Array.isArray(record.affectedProspects) ? record.affectedProspects : []);
    setOrphanConfirmedPolicyholders(Array.isArray(record.affectedPolicyholders) ? record.affectedPolicyholders : []);
    setOrphanSavedResignationDetails({
      resignationDate: toDateInputValue(record.resignationDate),
      resignationLetter: normalizeLongLeaveFile(record.resignationLetter, "application/pdf"),
      approvedResignationProof: normalizeLongLeaveFile(record.approvedResignationProof, "image/jpeg"),
    });
    setConfirmOrphanTransfer(true);
    scrollLongLeaveFormStartIntoView();
  };

  const cancelResignationDetailEdits = () => {
    if (!orphanSavedResignationDetails) return;
    setOrphanResignationDate(orphanSavedResignationDetails.resignationDate || "");
    setOrphanResignationLetter(orphanSavedResignationDetails.resignationLetter || null);
    setOrphanApprovedResignationProof(orphanSavedResignationDetails.approvedResignationProof || null);
    setOrphanLongLeaveFieldErrors({});
    setOrphanResignationStep(2);
  };

  const validateResignationDetails = () => {
    const errors = {};
    if (!orphanResignationDate) errors.resignationDate = "Resignation date is required.";
    if (orphanResignationDateError) errors.resignationDate = orphanResignationDateError;
    if (!orphanResignationLetter) errors.resignationLetter = "Accomplished resignation letter PDF is required.";
    if (!orphanApprovedResignationProof) errors.approvedResignationProof = "Proof of approved resignation image is required.";
    setOrphanLongLeaveFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const upsertSelectedAgentResignationRecord = (resignation = {}) => {
    const resignationId = String(resignation._id || resignation.id || orphanResignationId || "");
    if (!selectedAgent?.id || !resignationId) return;
    const nextRecord = {
      id: resignationId,
      resignationDate: resignation.resignationDate || orphanResignationDate,
      resignationLetter: resignation.resignationLetter || orphanResignationLetter,
      approvedResignationProof: resignation.approvedResignationProof || orphanApprovedResignationProof,
      status: resignation.status || orphanResignationStatus || "Recorded",
      affectedProspects: Array.isArray(resignation.affectedProspects) ? resignation.affectedProspects : [],
      affectedPolicyholders: Array.isArray(resignation.affectedPolicyholders) ? resignation.affectedPolicyholders : [],
      createdAt: resignation.createdAt,
      updatedAt: resignation.updatedAt,
    };
    setPortalData((current) => current?.agents ? ({
      ...current,
      agents: current.agents.map((agent) => String(agent.id || "") === String(selectedAgent.id || "") ? {
        ...agent,
        resignationRecords: [
          ...(agent.resignationRecords || []).filter((record) => String(record.id || record._id || "") !== resignationId),
          nextRecord,
        ],
      } : agent),
    }) : current);
  };

  const saveResignationDetails = async () => {
    if (!selectedAgent?.id || !validateResignationDetails()) return false;
    setOrphanLongLeaveSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/manager/agents/${selectedAgent.id}/resignation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resignationId: orphanResignationId || undefined,
          resignationDate: orphanResignationDate,
          resignationLetter: orphanResignationLetter,
          approvedResignationProof: orphanApprovedResignationProof,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.field) setOrphanLongLeaveFieldErrors((current) => ({ ...current, [data.field]: data.message || "Invalid value." }));
        throw new Error(data?.message || "Failed to save resignation details.");
      }
      const resignation = data?.resignation || {};
      setOrphanResignationId(resignation._id || resignation.id || orphanResignationId);
      setOrphanResignationStatus(resignation.status || "Recorded");
      setOrphanSavedResignationDetails({
        resignationDate: toDateInputValue(resignation.resignationDate || orphanResignationDate),
        resignationLetter: resignation.resignationLetter || orphanResignationLetter,
        approvedResignationProof: resignation.approvedResignationProof || orphanApprovedResignationProof,
      });
      upsertSelectedAgentResignationRecord(resignation);
      return true;
    } catch (err) {
      setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: err?.message || "Failed to save resignation details." }));
      return false;
    } finally {
      setOrphanLongLeaveSaving(false);
    }
  };

  const goToNextResignationStep = async () => {
    if (orphanResignationStep === 1) {
      const saved = await saveResignationDetails();
      if (saved) setOrphanResignationStep(2);
      return;
    }
    if (orphanResignationStep === 2) {
      if (!orphanResignationId) return;
      setOrphanLongLeaveSaving(true);
      try {
        const res = await fetch(`${API_BASE}/api/manager/resignation/${orphanResignationId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Confirmed Orphans", affectedProspects: displayedConfirmedProspects, affectedPolicyholders: resignationAffectedPolicyholders }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to confirm orphan clients.");
        setOrphanResignationStatus(data?.resignation?.status || "Confirmed Orphans");
        upsertSelectedAgentResignationRecord(data?.resignation || { status: "Confirmed Orphans", affectedProspects: displayedConfirmedProspects, affectedPolicyholders: resignationAffectedPolicyholders });
        setOrphanResignationStep(3);
      } catch (err) {
        setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: err?.message || "Failed to confirm orphan clients." }));
      } finally {
        setOrphanLongLeaveSaving(false);
      }
    }
  };

  const endorseResignationOrphans = () => {
    if (!orphanResignationId) return;
    setShowEndorseOrphansModal(true);
  };

  const confirmEndorseResignationOrphans = async () => {
    if (!orphanResignationId) return;
    setOrphanLongLeaveSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/manager/resignation/${orphanResignationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Endorsed", affectedProspects: displayedConfirmedProspects, affectedPolicyholders: resignationAffectedPolicyholders }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to endorse orphan clients.");
      setOrphanResignationStatus(data?.resignation?.status || "Endorsed");
      upsertSelectedAgentResignationRecord(data?.resignation || { status: "Endorsed", affectedProspects: displayedConfirmedProspects, affectedPolicyholders: resignationAffectedPolicyholders });
      setPortalData((current) => current?.agents ? ({ ...current, agents: current.agents.map((agent) => String(agent.id || "") === String(selectedAgent?.id || "") ? { ...agent, status: "Resigned" } : agent) }) : current);
      setShowEndorseOrphansModal(false);
      closeOrphanAgentAction();
    } catch (err) {
      setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: err?.message || "Failed to endorse orphan clients." }));
    } finally {
      setOrphanLongLeaveSaving(false);
    }
  };

  const scrollLongLeaveFormStartIntoView = () => {
    setLongLeaveStepperScrollSignal((current) => current + 1);
  };

  const setLongLeaveStepAndScroll = (step) => {
    setOrphanLongLeaveStep(step);
    scrollLongLeaveFormStartIntoView();
  };

  const goToNextLongLeaveStep = async () => {
    if (orphanLongLeaveStep === 1) {
      const saved = await saveLongLeaveDetails();
      if (!saved) return;
      setConfirmOrphanTransfer(false);
      setOrphanLongLeaveStep(2);
      scrollLongLeaveFormStartIntoView();
      return;
    }
    if (orphanLongLeaveStep === 2) {
      if (!confirmOrphanTransfer || !orphanLongLeaveId) return;
      setOrphanLongLeaveSaving(true);
      try {
        const res = await fetch(`${API_BASE}/api/manager/long-leave/${orphanLongLeaveId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Confirmed Orphans",
            includeOngoingPolicyholders,
            affectedProspects: orphanProspectsWithActiveLeads,
            affectedPolicyholders: includeOngoingPolicyholders ? orphanPolicyholdersWithOngoingPolicies : [],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to confirm orphan clients.");
        const updatedRecord = normalizeLongLeaveRecord(data?.longLeave);
        if (updatedRecord) {
          upsertSelectedAgentLeaveRecord(updatedRecord);
          setOrphanConfirmedProspects(updatedRecord.affectedProspects || []);
          setOrphanConfirmedPolicyholders(updatedRecord.affectedPolicyholders || []);
          setOrphanLongLeaveStatus(updatedRecord.status || "Confirmed Orphans");
        }
        setOrphanLongLeaveStep(3);
        scrollLongLeaveFormStartIntoView();
      } catch (err) {
        setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: err?.message || "Failed to confirm orphan clients." }));
      } finally {
        setOrphanLongLeaveSaving(false);
      }
    }
  };

  const endorseLongLeaveOrphans = () => {
    if (!orphanLongLeaveId) return;
    setShowEndorseOrphansModal(true);
  };

  const closeEndorseOrphansModal = () => {
    if (orphanLongLeaveSaving) return;
    setShowEndorseOrphansModal(false);
  };

  const confirmEndorseLongLeaveOrphans = async () => {
    if (!orphanLongLeaveId) return;
    setOrphanLongLeaveSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/manager/long-leave/${orphanLongLeaveId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Endorsed",
          includeOngoingPolicyholders,
          affectedProspects: displayedConfirmedProspects,
          affectedPolicyholders: displayedConfirmedPolicyholders,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to endorse orphan clients.");
      const updatedRecord = normalizeLongLeaveRecord(data?.longLeave);
      if (updatedRecord) {
        upsertSelectedAgentLeaveRecord(updatedRecord);
        setOrphanLongLeaveStatus(updatedRecord.status || "Endorsed");
        setScrollToLongLeaveRecordId(updatedRecord.id);
      }
      setPortalData((current) => ({
        ...current,
        agents: (current?.agents || []).map((agent) => (agent.id === selectedAgent?.id ? { ...agent, status: "On Long Leave" } : agent)),
      }));
      setShowEndorseOrphansModal(false);
      closeOrphanAgentAction();
    } catch (err) {
      setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: err?.message || "Failed to endorse orphan clients." }));
    } finally {
      setOrphanLongLeaveSaving(false);
    }
  };

  const cancelLongLeaveDetailEdits = () => {
    if (!orphanLongLeaveId || !orphanSavedLongLeaveDetails) return;
    setOrphanLeaveStartDate(orphanSavedLongLeaveDetails.leaveStartDate || "");
    setOrphanLeaveEndDate(orphanSavedLongLeaveDetails.leaveEndDate || "");
    setOrphanLeaveApplicationForm(orphanSavedLongLeaveDetails.leaveApplicationForm || null);
    setOrphanApprovedLeaveProof(orphanSavedLongLeaveDetails.approvedLeaveProof || null);
    setOrphanLongLeaveFieldErrors({});
    setOrphanLongLeaveDetailsDirty(false);
    setConfirmOrphanTransfer(false);
    setOrphanLongLeaveStep(2);
    scrollLongLeaveFormStartIntoView();
  };

  const openOrphanAgentAction = (action) => {
    setOrphanAgentAction(action);
    setOrphanLeaveStartDate("");
    setOrphanLeaveEndDate("");
    setOrphanLeaveApplicationForm(null);
    setOrphanApprovedLeaveProof(null);
    setOrphanLongLeaveFieldErrors({});
    setOrphanLongLeaveId("");
    setOrphanLongLeaveDetailsDirty(false);
    setOrphanSavedLongLeaveDetails(null);
    setOrphanViewingSavedLongLeave(false);
    setOrphanLongLeaveStatus("Recorded");
    setOrphanLongLeaveStep(1);
    setOrphanResignationId("");
    setOrphanResignationDate("");
    setOrphanResignationLetter(null);
    setOrphanApprovedResignationProof(null);
    setOrphanResignationStatus("Recorded");
    setOrphanResignationStep(1);
    setOrphanSavedResignationDetails(null);
    setIncludeOngoingPolicyholders(false);
    setConfirmOrphanTransfer(false);
    setShowEndorseOrphansModal(false);
    setOrphanConfirmedProspects([]);
    setOrphanConfirmedPolicyholders([]);
    scrollLongLeaveFormStartIntoView();
  };

  const closeOrphanAgentAction = () => {
    setOrphanAgentAction("");
    setOrphanLeaveStartDate("");
    setOrphanLeaveEndDate("");
    setOrphanLeaveApplicationForm(null);
    setOrphanApprovedLeaveProof(null);
    setOrphanLongLeaveFieldErrors({});
    setOrphanLongLeaveId("");
    setOrphanLongLeaveDetailsDirty(false);
    setOrphanSavedLongLeaveDetails(null);
    setOrphanViewingSavedLongLeave(false);
    setOrphanLongLeaveStatus("Recorded");
    setOrphanLongLeaveStep(1);
    setOrphanResignationId("");
    setOrphanResignationDate("");
    setOrphanResignationLetter(null);
    setOrphanApprovedResignationProof(null);
    setOrphanResignationStatus("Recorded");
    setOrphanResignationStep(1);
    setOrphanSavedResignationDetails(null);
    setIncludeOngoingPolicyholders(false);
    setConfirmOrphanTransfer(false);
    setShowEndorseOrphansModal(false);
    setOrphanConfirmedProspects([]);
    setOrphanConfirmedPolicyholders([]);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const openSavedLongLeaveRecord = (record) => {
    const normalizedRecord = normalizeLongLeaveRecord(record);
    if (!normalizedRecord?.id) return;
    const savedSnapshot = buildLongLeaveSnapshot(normalizedRecord);
    setOrphanAgentAction("long_leave");
    setOrphanLongLeaveId(normalizedRecord.id);
    setOrphanLeaveStartDate(savedSnapshot.leaveStartDate);
    setOrphanLeaveEndDate(savedSnapshot.leaveEndDate);
    setOrphanLeaveApplicationForm(savedSnapshot.leaveApplicationForm);
    setOrphanApprovedLeaveProof(savedSnapshot.approvedLeaveProof);
    setOrphanSavedLongLeaveDetails(savedSnapshot);
    setOrphanViewingSavedLongLeave(true);
    setOrphanLongLeaveFieldErrors({});
    setOrphanLongLeaveDetailsDirty(false);
    const normalizedStatus = String(normalizedRecord.status || "Recorded").trim();
    setOrphanLongLeaveStatus(normalizedStatus);
    setOrphanLongLeaveStep(normalizedStatus === "Endorsed" ? 1 : (normalizedStatus === "Recorded" ? 2 : 3));
    setIncludeOngoingPolicyholders(normalizedRecord.includeOngoingPolicyholders === true);
    setConfirmOrphanTransfer(normalizedStatus !== "Recorded");
    setShowEndorseOrphansModal(false);
    setOrphanConfirmedProspects(Array.isArray(normalizedRecord.affectedProspects) ? normalizedRecord.affectedProspects : []);
    setOrphanConfirmedPolicyholders(Array.isArray(normalizedRecord.affectedPolicyholders) ? normalizedRecord.affectedPolicyholders : []);
    scrollLongLeaveFormStartIntoView();
  };

  const selectedAgentAge = selectedAgent?.birthday ? getCurrentAgeFromBirthday(selectedAgent.birthday) : selectedAgent?.age;
  const selectedAgentPromotionHistory = useMemo(() =>
    (Array.isArray(selectedAgent?.promotionHistory) ? selectedAgent.promotionHistory : [])
      .slice()
      .sort((left, right) => (new Date(right?.datePromoted || 0).getTime() || 0) - (new Date(left?.datePromoted || 0).getTime() || 0)),
    [selectedAgent?.promotionHistory],
  );
  const selectedAgentLeaveRecords = useMemo(() =>
    (Array.isArray(selectedAgent?.leaveRecords) ? selectedAgent.leaveRecords : [])
      .slice()
      .sort((left, right) => {
        const rightTime = new Date(right?.createdAt || right?.leaveStartDate || 0).getTime() || 0;
        const leftTime = new Date(left?.createdAt || left?.leaveStartDate || 0).getTime() || 0;
        return rightTime - leftTime;
      }),
    [selectedAgent?.leaveRecords],
  );
  const selectedAgentResignationRecords = useMemo(() =>
    (Array.isArray(selectedAgent?.resignationRecords) ? selectedAgent.resignationRecords : [])
      .slice()
      .sort((left, right) => {
        const rightTime = new Date(right?.createdAt || right?.resignationDate || 0).getTime() || 0;
        const leftTime = new Date(left?.createdAt || left?.resignationDate || 0).getTime() || 0;
        return rightTime - leftTime;
      }),
    [selectedAgent?.resignationRecords],
  );

  const selectedAgentUnitManager = useMemo(() => {
    const unitName = String(selectedAgent?.unit || "").trim();
    const unitRow = (portalData?.units || []).find((unit) => String(unit?.name || "").trim() === unitName);
    return {
      code: unitRow?.manager?.code || "—",
      name: unitRow?.manager?.name || "—",
      unitName: unitRow?.name || unitName || "—",
    };
  }, [portalData?.units, selectedAgent?.unit]);

  const normalizeLongLeaveFile = (file, fallbackMimeType = "") => {
    if (!file) return null;
    return {
      fileName: file.fileName || "",
      mimeType: file.mimeType || fallbackMimeType,
      dataUrl: file.dataUrl || "",
      size: Number(file.size || 0),
    };
  };

  const normalizeLongLeaveRecord = (record) => {
    if (!record) return null;
    return {
      id: String(record._id || record.id || ""),
      leaveStartDate: record.leaveStartDate || null,
      leaveEndDate: record.leaveEndDate || null,
      status: record.status || "Recorded",
      includeOngoingPolicyholders: record.includeOngoingPolicyholders === true,
      affectedProspects: Array.isArray(record.affectedProspects) ? record.affectedProspects : [],
      affectedPolicyholders: Array.isArray(record.affectedPolicyholders) ? record.affectedPolicyholders : [],
      leaveApplicationForm: normalizeLongLeaveFile(record.leaveApplicationForm, "application/pdf"),
      approvedLeaveProof: normalizeLongLeaveFile(record.approvedLeaveProof, "image/jpeg"),
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null,
    };
  };

  const buildLongLeaveSnapshot = (record) => ({
    leaveStartDate: toDateInputValue(record?.leaveStartDate),
    leaveEndDate: toDateInputValue(record?.leaveEndDate),
    leaveApplicationForm: normalizeLongLeaveFile(record?.leaveApplicationForm, "application/pdf"),
    approvedLeaveProof: normalizeLongLeaveFile(record?.approvedLeaveProof, "image/jpeg"),
  });


  const getLongLeaveStatusHint = (agent = {}) => {
    if (String(agent?.status || "").trim() !== "On Long Leave") return "";
    const records = Array.isArray(agent?.leaveRecords) ? agent.leaveRecords : [];
    const record = records.find((item) => String(item?.status || "") === "Endorsed") || records[0];
    if (!record?.leaveStartDate || !record?.leaveEndDate) return "";
    const start = new Date(record.leaveStartDate);
    const now = new Date();
    return start <= now
      ? `Started: ${formatDate(record.leaveStartDate)}. Will End: ${formatDate(record.leaveEndDate)}.`
      : `Starts: ${formatDate(record.leaveStartDate)}. Ends: ${formatDate(record.leaveEndDate)}.`;
  };

  const getResignationStatusHint = (agent = {}) => {
    if (String(agent?.status || "").trim() !== "Resigned") return "";
    const records = Array.isArray(agent?.resignationRecords) ? agent.resignationRecords : [];
    const record = records.find((item) => String(item?.status || "") === "Endorsed") || records[0];
    if (!record?.resignationDate) return "";
    const resignationDate = new Date(record.resignationDate);
    if (Number.isNaN(resignationDate.getTime())) return "";
    const now = new Date();
    return resignationDate <= now
      ? `Resigned on: ${formatDate(record.resignationDate)}.`
      : `Resigns on: ${formatDate(record.resignationDate)}.`;
  };



  const renderAgentStatusPill = (agent = {}, { table = false } = {}) => {
    const hint = getLongLeaveStatusHint(agent) || getResignationStatusHint(agent);
    const className = `manager-agent-status-pill ${table ? "manager-agent-status-pill--table " : ""}manager-agent-status-pill--${getAgentStatusClass(agent?.status)}`;
    return (
      <span className={`${className}${hint ? " manager-status-hint" : ""}`} data-hint={hint || undefined}>
        {agent?.status || "Active"}
      </span>
    );
  };

  const upsertSelectedAgentLeaveRecord = (record) => {
    if (!record?.id || !selectedAgent?.id) return;
    setPortalData((current) => {
      if (!current?.agents) return current;
      return {
        ...current,
        agents: current.agents.map((agent) => {
          if (String(agent?.id || "") !== String(selectedAgent.id)) return agent;
          const existingRecords = Array.isArray(agent.leaveRecords) ? agent.leaveRecords : [];
          const nextRecords = [
            record,
            ...existingRecords.filter((item) => String(item?.id || "") !== String(record.id)),
          ].sort((left, right) => {
            const rightTime = new Date(right?.createdAt || right?.leaveStartDate || 0).getTime() || 0;
            const leftTime = new Date(left?.createdAt || left?.leaveStartDate || 0).getTime() || 0;
            return rightTime - leftTime;
          });
          return { ...agent, leaveRecords: nextRecords };
        }),
      };
    });
  };

  const selectedAgentKpiCards = useMemo(() => {
    if (!selectedAgent || !selectedKpiPeriod) return [];
    const kpiKeysByTab = {
      clients: new Set(["monthly_new_prospects"]),
      tasks: new Set(["weekly_approaches", "weekly_appointments", "weekly_presentations"]),
      sales: new Set(["monthly_policies", "monthly_closing_ratio"]),
    };
    const visibleKpiKeys = kpiKeysByTab[unitPerformanceTab] || new Set();
    const assignments = (kpiData?.assignments || []).filter((assignment) => assignment.scopeType === "AGENT");

    return assignments.flatMap((assignment) =>
      (assignment.kpis || [])
        .filter((kpi) => kpi.assigned !== false && visibleKpiKeys.has(kpi.key))
        .map((kpi) => {
          const kpiForPeriod = selectKpiTargetForPeriod(kpi, selectedKpiPeriod);
          const rowsForFrequency = portalData?.kpiSalesRowsByFrequency?.[selectedKpiPeriod] || [];
          const agentRow = rowsForFrequency.find((row) => String(row?.userId || "") === String(selectedAgent.userId || "")) || selectedAgent || {};
          const activePolicies = Number(agentRow.activePolicies || selectedAgent.activePolicies || 0);
          const submittedApplications = Number(agentRow.submittedApplications || selectedAgent.submittedApplications || 0);
          const actualByKey = {
            weekly_approaches: Number(agentRow.completedApproaches || selectedAgent.completedApproaches || 0),
            weekly_appointments: Number(agentRow.completedAppointments || selectedAgent.completedAppointments || 0),
            weekly_presentations: Number(agentRow.completedPresentations || selectedAgent.completedPresentations || 0),
            monthly_policies: activePolicies,
            monthly_new_prospects: Number(agentRow.totalProspects || selectedAgent.totalProspects || 0),
            monthly_closing_ratio: submittedApplications ? Math.round((activePolicies / submittedApplications) * 100) : 0,
          };
          const actual = actualByKey[kpi.key] || 0;
          return {
            assignment,
            kpi: kpiForPeriod,
            actual,
            comparison: getKpiComparison(actual, kpiForPeriod),
            dateRangeLabel: getKpiFrequencyRangeLabel(selectedKpiPeriod),
          };
        }),
    );
  }, [kpiData?.assignments, portalData?.kpiSalesRowsByFrequency, selectedAgent, selectedKpiPeriod, unitPerformanceTab]);

  const selectedAgentSummary = useMemo(() => {
    if (!selectedAgent) return null;
    const totalTasks = Number(selectedAgent.totalTasks || 0);
    const closedTasks = Number(selectedAgent.closedTasks || 0);
    const delayedDoneTasks = Number(selectedAgent.delayedDoneTasks || 0);
    const onTimeDoneTasks = Math.max(0, closedTasks - delayedDoneTasks);
    const leads = Number(selectedAgent.leads || 0);
    const converted = Number(selectedAgent.converted || 0);
    const totalPolicies = Number(selectedAgent.totalPolicies || 0);
    const activePolicies = Number(selectedAgent.activePolicies || 0);
    return {
      ...selectedAgent,
      totalTasks,
      closedTasks,
      delayedDoneTasks,
      onTimeDoneTasks,
      overallCompletionRate: totalTasks ? Math.round((closedTasks / totalTasks) * 100) : 0,
      onTimeCompletionRate: closedTasks ? Math.round((onTimeDoneTasks / closedTasks) * 100) : 0,
      lateCompletionRate: closedTasks ? Math.round((delayedDoneTasks / closedTasks) * 100) : 0,
      unconverted: Math.max(0, leads - converted),
      conversionRate: leads ? Math.round((converted / leads) * 100) : 0,
      activePolicyRate: totalPolicies ? Math.round((activePolicies / totalPolicies) * 100) : 0,
    };
  }, [selectedAgent]);

  const openAgentDetails = (agentId) => {
    setSelectedAgentId(String(agentId || ""));
    setOrphanAgentAction("");
    setActiveView(activeView === "orphan_clients" ? "orphan_clients" : "agents");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const goToAgentUnit = () => {
    setSelectedAgentId("");
    setUnitPerformanceTab("clients");
    setSelectedUnitName(selectedAgent?.unit || "");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

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
    const kpiRows = portalData?.kpiSalesRowsByFrequency?.[branchKpiPeriod] || [];
    const rowSummary = summarizeKpiRows(kpiRows);
    const hasSalesProductionKpi = (branchAssignment.kpis || []).some((kpi) => kpi.key === "monthly_sales_production" && kpi.assigned !== false);
    const salesProductionKpi = selectKpiTargetForPeriod((branchAssignment.kpis || []).find((kpi) => kpi.key === "monthly_sales_production") || {}, branchKpiPeriod);
    const productionTargetValue = [salesProductionKpi.targetValue, salesProductionKpi.targetMin, salesProductionKpi.targetMax]
      .find((value) => value !== null && value !== undefined && value !== "");
    const productionTarget = Number(productionTargetValue || 0);
    const productionTargetLabel = formatKpiTarget({ ...salesProductionKpi, valueType: "Currency" });
    const productionActual = Number(rowSummary.totalAnnualPremium || 0);
    const activeAgentCount = kpiRows.filter((row) => Number(row?.annualPremium || 0) > 0).length;
    const persistencyRate = rowSummary.totalPolicies ? Math.round((rowSummary.activePolicies / rowSummary.totalPolicies) * 100) : 0;
    const targetAchievementIndex = productionTarget ? Math.round((Number(rowSummary.totalAnnualPremium || 0) / productionTarget) * 100) : 0;
    const orderByKey = { monthly_sales_production: 0, monthly_target_achievement_index: 1, monthly_active_agents: 2, monthly_persistency_rate: 3 };

    return (branchAssignment.kpis || [])
      .filter((kpi) => kpi.assigned !== false && (kpi.key !== "monthly_target_achievement_index" || hasSalesProductionKpi))
      .map((kpi) => {
        const kpiForPeriod = selectKpiTargetForPeriod(kpi, branchKpiPeriod);
        const actualByKey = {
          monthly_sales_production: Number(rowSummary.totalAnnualPremium || 0),
          monthly_target_achievement_index: targetAchievementIndex,
          monthly_active_agents: activeAgentCount,
          monthly_persistency_rate: persistencyRate,
        };
        return {
          assignment: branchAssignment,
          kpi: kpiForPeriod,
          actual: actualByKey[kpi.key] || 0,
          dateRangeLabel: getKpiFrequencyRangeLabel(branchKpiPeriod),
          targetBasis: kpi.key === "monthly_target_achievement_index" ? productionTarget : null,
          targetBasisLabel: kpi.key === "monthly_target_achievement_index" ? productionTargetLabel : "",
          productionActual: kpi.key === "monthly_target_achievement_index" ? productionActual : null,
        };
      })
      .sort((left, right) => (orderByKey[left.kpi.key] ?? 99) - (orderByKey[right.kpi.key] ?? 99));
  }, [branchKpiPeriod, kpiData?.assignments, portalData?.kpiSalesRowsByFrequency]);

  const branchSalesKpiProgressRows = useMemo(() => {
    if (!selectedKpiPeriod) return [];
    const branchAssignment = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "BRANCH");
    if (!branchAssignment) return [];
    const selectedPeriodRows = portalData?.kpiSalesRowsByFrequency?.[selectedKpiPeriod] || [];
    const rowSummary = summarizeKpiRows(selectedPeriodRows);
    const salesProductionKpi = (branchAssignment.kpis || []).find((kpi) => kpi.key === "monthly_sales_production" && kpi.assigned !== false);
    if (!salesProductionKpi) return [];
    const salesProductionKpiForPeriod = selectKpiTargetForPeriod(salesProductionKpi, selectedKpiPeriod);
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

  const unitKpiSalesAgents = useMemo(
    () => [...(portalData?.kpiSalesRowsByFrequency?.[unitKpiPeriod] || [])]
      .filter((row) => String(row?.unit || "") === String(selectedUnit?.name || "") && Number(row?.annualPremium || 0) > 0)
      .sort((left, right) => Number(right?.annualPremium || 0) - Number(left?.annualPremium || 0) || String(left?.username || "").localeCompare(String(right?.username || ""), undefined, { numeric: true, sensitivity: "base" })),
    [portalData?.kpiSalesRowsByFrequency, selectedUnit?.name, unitKpiPeriod],
  );

  const unitBranchSalesContribution = useMemo(() => {
    const unitHasSalesProductionKpi = dashboardUnitKpiCards.some(({ kpi }) => kpi.key === "monthly_sales_production");
    if (!unitHasSalesProductionKpi) return null;
    const branchAssignment = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "BRANCH");
    const branchSalesProductionKpi = (branchAssignment?.kpis || []).find((kpi) => kpi.key === "monthly_sales_production" && kpi.assigned !== false);
    if (!branchSalesProductionKpi) return null;
    const branchKpiForPeriod = selectKpiTargetForPeriod(branchSalesProductionKpi, unitKpiPeriod);
    const periodRows = portalData?.kpiSalesRowsByFrequency?.[unitKpiPeriod] || [];
    const branchTotalFromPayload = Number(portalData?.branchKpiSalesTotalsByFrequency?.[unitKpiPeriod]?.totalAnnualPremium);
    const branchActual = Number.isFinite(branchTotalFromPayload)
      ? branchTotalFromPayload
      : periodRows.reduce((total, row) => total + Number(row?.annualPremium || 0), 0);
    const unitActual = periodRows
      .filter((row) => String(row?.unit || "") === String(selectedUnit?.name || ""))
      .reduce((total, row) => total + Number(row?.annualPremium || 0), 0);
    const contributionShare = branchActual ? Math.round((unitActual / branchActual) * 100) : 0;
    return {
      actual: unitActual,
      branchActual,
      contributionShare,
      comparison: getKpiComparison(branchActual, branchKpiForPeriod),
      dateRangeLabel: getKpiFrequencyRangeLabel(unitKpiPeriod),
      kpi: branchKpiForPeriod,
    };
  }, [dashboardUnitKpiCards, kpiData?.assignments, portalData?.branchKpiSalesTotalsByFrequency, portalData?.kpiSalesRowsByFrequency, selectedUnit?.name, unitKpiPeriod]);


  const branchSalesKpiUnitRows = useMemo(() => {
    if (!selectedKpiPeriod) return [];
    const byUnit = new Map();
    const drilldownRows = portalData?.kpiSalesRowsByFrequency?.[selectedKpiPeriod] || [];
    drilldownRows.forEach((row) => {
      const unit = row?.unit || "Unassigned Unit";
      if (!byUnit.has(unit)) {
        byUnit.set(unit, { unit, annualPremium: 0, activeAgents: 0, totalPolicies: 0, activePolicies: 0, agents: [] });
      }
      const item = byUnit.get(unit);
      item.annualPremium += Number(row?.annualPremium || 0);
      item.totalPolicies += Number(row?.totalPolicies || 0);
      item.activePolicies += Number(row?.activePolicies || 0);
      if (Number(row?.annualPremium || 0) > 0) item.activeAgents += 1;
      item.agents.push(row);
    });
    const branchAssignmentForTarget = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "BRANCH");
    const productionKpiForTarget = selectKpiTargetForPeriod((branchAssignmentForTarget?.kpis || []).find((kpi) => kpi.key === "monthly_sales_production") || {}, selectedKpiPeriod);
    const productionTargetValue = [productionKpiForTarget.targetValue, productionKpiForTarget.targetMin, productionKpiForTarget.targetMax]
      .find((value) => value !== null && value !== undefined && value !== "");
    const productionTarget = Number(productionTargetValue || 0);
    return [...byUnit.values()].map((item) => ({
      ...item,
      persistencyRate: item.totalPolicies ? Math.round((item.activePolicies / item.totalPolicies) * 100) : 0,
      targetAchievementIndex: productionTarget ? Math.round((Number(item.annualPremium || 0) / productionTarget) * 100) : 0,
      topAgents: [...item.agents]
        .filter((agent) => Number(agent?.annualPremium || 0) > 0)
        .sort((left, right) => Number(right?.annualPremium || 0) - Number(left?.annualPremium || 0) || String(left?.username || "").localeCompare(String(right?.username || ""), undefined, { numeric: true, sensitivity: "base" }))
        .slice(0, 5),
    })).sort((a, b) => b.annualPremium - a.annualPremium || a.unit.localeCompare(b.unit));
  }, [kpiData?.assignments, portalData?.kpiSalesRowsByFrequency, selectedKpiPeriod]);

  const branchKpiUnitRows = useMemo(() => {
    const byUnit = new Map();
    const productionFrequency = branchKpiPeriod;
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
      if (Number(row?.annualPremium || 0) > 0) item.activeAgents += 1;
      item.agents.push(row);
    });
    const branchAssignmentForTarget = (kpiData?.assignments || []).find((assignment) => assignment.scopeType === "BRANCH");
    const productionKpiForTarget = selectKpiTargetForPeriod((branchAssignmentForTarget?.kpis || []).find((kpi) => kpi.key === "monthly_sales_production") || {}, branchKpiPeriod);
    const productionTargetValue = [productionKpiForTarget.targetValue, productionKpiForTarget.targetMin, productionKpiForTarget.targetMax]
      .find((value) => value !== null && value !== undefined && value !== "");
    const productionTarget = Number(productionTargetValue || 0);
    return [...byUnit.values()].map((item) => ({
      ...item,
      persistencyRate: item.totalPolicies ? Math.round((item.activePolicies / item.totalPolicies) * 100) : 0,
      targetAchievementIndex: productionTarget ? Math.round((Number(item.annualPremium || 0) / productionTarget) * 100) : 0,
      topAgents: [...item.agents]
        .filter((agent) => Number(agent?.annualPremium || 0) > 0)
        .sort((left, right) => Number(right?.annualPremium || 0) - Number(left?.annualPremium || 0) || String(left?.username || "").localeCompare(String(right?.username || ""), undefined, { numeric: true, sensitivity: "base" })),
    })).sort((a, b) => b.annualPremium - a.annualPremium || a.unit.localeCompare(b.unit));
  }, [branchKpiPeriod, kpiData?.assignments, portalData?.kpiSalesRowsByFrequency]);



  const branchAssignedKpiKeys = useMemo(
    () => new Set(branchKpiProgressRows.map(({ kpi }) => kpi.key)),
    [branchKpiProgressRows],
  );
  const branchHasSalesProductionKpi = branchAssignedKpiKeys.has("monthly_sales_production");
  const branchKpiUnitFields = useMemo(() => [
    { key: "monthly_sales_production", columnKey: "salesProduction", label: "Sales Production", render: (unit) => formatMoney(unit.annualPremium), dashboardLabel: "Sales Production" },
    { key: "monthly_target_achievement_index", columnKey: "targetAchievement", label: "Target Achievement", render: (unit) => `${unit.targetAchievementIndex}%`, dashboardLabel: "Target Achievement" },
    { key: "monthly_active_agents", columnKey: "activeAgents", label: "Active Agents", render: (unit) => unit.activeAgents, dashboardLabel: "Active Agents" },
    { key: "monthly_persistency_rate", columnKey: "persistency", label: "Persistency", render: (unit) => `${unit.persistencyRate}%`, dashboardLabel: "Persistency" },
  ].filter((field) => branchAssignedKpiKeys.has(field.key)), [branchAssignedKpiKeys]);

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
          { label: "Total Prospects", value: summary.totalProspects },
          { label: "Total Active Policies", value: summary.activePolicies },
          {
            label: "Annual Premium",
            value: formatMoney(summary.totalAnnualPremium),
          },
        ]
      : [
          { label: "Agents in Scope", value: summary.totalAgents },
          { label: "Open Tasks", value: summary.totalOpenTasks },
          { label: "Total Prospects", value: summary.totalProspects },
          { label: "Total Active Policies", value: summary.activePolicies },
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
          pageSize: 12,
          firstPageRows: 8,
          emptyMessage: "No task detail rows available.",
        },
      ],
    });
  };

  const generateKpiPdfReport = () => {
    const salesProductionActual = Number(branchKpiProgressRows.find(({ kpi }) => kpi.key === "monthly_sales_production")?.actual || 0);
    const targetAchievementActual = Number(branchKpiProgressRows.find(({ kpi }) => kpi.key === "monthly_target_achievement_index")?.actual || 0);
    const kpiTableRows = branchKpiProgressRows.map(({ assignment, kpi, actual, dateRangeLabel }) => {
      const comparison = getKpiComparison(actual, kpi);
      return {
        kpi: formatKpiLabel(kpi, assignment.scopeType),
        frequency: kpi.period,
        dateRange: dateRangeLabel,
        actual: formatActualKpiValue(actual, kpi.valueType),
        target: formatKpiTarget(kpi),
        status: comparison.status,
        gap: comparison.deltaLabel,
      };
    });

    createPrintableReport({
      filename: `${scope.branchCode || user?.username || normalizedRole} - ${scope.branchName || "Branch"} KPI Progress Report`,
      title: "Branch KPI Progress Report",
      periodLabel: branchKpiReportPeriodLabel,
      detailsTitle: "Branch Details",
      details: [
        { label: "Area", value: scope.areaName || "—" },
        { label: "Branch", value: scope.branchName || "—" },
        { label: "Branch Manager", value: `${user?.username || "—"} • ${[user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(" ").trim() || user?.username || "—"}` },
      ],
      filters: [
        { label: "Assigned KPI Cards", value: String(branchKpiProgressRows.length) },
        { label: "Date Range", value: branchKpiPeriodLabel },
        { label: "Unit Drilldown Rows", value: String(branchKpiUnitRows.length) },
        ...(branchHasSalesProductionKpi
          ? [{ label: "Agent Drilldown Rows", value: String(branchKpiUnitRows.reduce((total, unit) => total + unit.topAgents.length, 0)) }]
          : []),
      ],
      statCards: [
        ...(branchAssignedKpiKeys.has("monthly_sales_production") ? [{ label: "Sales Production", value: formatMoney(salesProductionActual), tone: "red" }] : []),
        ...(branchAssignedKpiKeys.has("monthly_target_achievement_index") ? [{ label: "Target Achievement", value: `${targetAchievementActual}%`, tone: "gold" }] : []),
        ...(branchAssignedKpiKeys.has("monthly_active_agents") ? [{ label: "Active Agents", value: branchKpiProgressRows.find(({ kpi }) => kpi.key === "monthly_active_agents")?.actual || 0, tone: "blue" }] : []),
        ...(branchAssignedKpiKeys.has("monthly_persistency_rate") ? [{ label: "Persistency Rate", value: `${branchKpiProgressRows.find(({ kpi }) => kpi.key === "monthly_persistency_rate")?.actual || 0}%`, tone: "green" }] : []),
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
          pageSize: 12,
          emptyMessage: "No KPIs assigned.",
        },
        ...(branchKpiUnitFields.length ? [{
          title: "Unit Drilldown",
          columns: [
            { key: "unit", label: "Unit" },
            ...branchKpiUnitFields.map((field) => ({ key: field.columnKey, label: field.label })),
          ],
          rows: branchKpiUnitRows.map((unit) => ({
            unit: unit.unit,
            ...Object.fromEntries(branchKpiUnitFields.map((field) => [field.columnKey, field.render(unit)])),
          })),
          pageSize: 10,
          compactWithPrevious: true,
          compactMaxRows: 22,
          firstPageLimit: 22,
          emptyMessage: "No unit KPI activity for this date range.",
        }] : []),
        ...(branchHasSalesProductionKpi ? [{
          title: "Agent Drilldown",
          columns: [
            { key: "unit", label: "Unit" },
            { key: "username", label: "Agent Code" },
            { key: "name", label: "Agent Name" },
            { key: "salesProduction", label: "Sales Production" },
          ],
          rows: branchKpiUnitRows.flatMap((unit) => unit.topAgents.map((agent) => ({
            unit: unit.unit,
            username: agent.username,
            name: agent.name || agent.username,
            salesProduction: formatMoney(agent.annualPremium),
          }))),
          pageSize: 18,
          startNewPage: true,
          compactMaxRows: 22,
          emptyMessage: "No contributing agents for this date range.",
        }] : []),
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
          pageSize: 8,
          widePageSizeCap: 8,
          allowFirstPage: false,
          emptyMessage: "No sales detail rows available.",
        },
      ],
    });
  };

  const generateAgentDetailsPdfReport = () => {
    if (!selectedAgentSummary) return;
    const tabLabel = unitPerformanceTab.charAt(0).toUpperCase() + unitPerformanceTab.slice(1);
    const reportNameByTab = {
      clients: "Clients Relationship Report",
      tasks: "Tasks Performance Report",
      sales: "Sales Performance Report",
    };
    const reportFileName = reportNameByTab[unitPerformanceTab] || `${tabLabel} Performance Report`;
    const reportName = `Agent ${reportFileName}`;
    const agentFullName = [selectedAgentSummary.firstName, selectedAgentSummary.middleName, selectedAgentSummary.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || selectedAgentSummary.name || selectedAgentSummary.username || "Agent";
    const detailRowsByTab = {
      clients: [
        ["Total Prospects", selectedAgentSummary.totalProspects],
        ["Active Prospects", selectedAgentSummary.activeProspects],
        ["Total Leads", selectedAgentSummary.leads],
        ["Active Leads", selectedAgentSummary.activeLeads],
        ["Total Policyholders", selectedAgentSummary.totalPolicies],
        ["Active Policyholders", selectedAgentSummary.activePolicies],
        ["At Risk Policyholders", selectedAgentSummary.atRiskPolicies],
        ["Lapsed Policies", selectedAgentSummary.lapsedPolicies],
      ],
      tasks: [
        ["Total Tasks", selectedAgentSummary.totalTasks],
        ["Open Tasks", selectedAgentSummary.openTasks],
        ["Overdue Tasks", selectedAgentSummary.overdueTasks],
        ["On-Time Done Tasks", selectedAgentSummary.onTimeDoneTasks],
        ["Overall Completion Rate", `${selectedAgentSummary.overallCompletionRate}%`],
        ["On-Time Completion Rate", `${selectedAgentSummary.onTimeCompletionRate}%`],
        ["Late Completion Rate", `${selectedAgentSummary.lateCompletionRate}%`],
      ],
      sales: [
        ["Total Leads", selectedAgentSummary.leads],
        ["Converted Leads", selectedAgentSummary.converted],
        ["Unconverted Leads", selectedAgentSummary.unconverted],
        ["Conversion Rate", `${selectedAgentSummary.conversionRate}%`],
        ["Total Policies", selectedAgentSummary.totalPolicies],
        ["Active Policies", selectedAgentSummary.activePolicies],
        ["Active Policy Rate", `${selectedAgentSummary.activePolicyRate}%`],
        ["Total Annual Premium", formatMoney(selectedAgentSummary.annualPremium)],
        ["Monthly Premium Breakdown", formatMoney(selectedAgentSummary.monthlyPremium)],
        ["Quarterly Premium Breakdown", formatMoney(selectedAgentSummary.quarterlyPremium)],
        ["Half-Yearly Premium Breakdown", formatMoney(selectedAgentSummary.halfYearlyPremium)],
        ["Yearly Premium Breakdown", formatMoney(selectedAgentSummary.yearlyPremium)],
      ],
    };

    createPrintableReport({
      filename: `${user?.username || "Branch Manager"} - ${agentFullName} ${reportFileName}`,
      title: reportName,
      periodLabel: unitPerformancePeriodLabel,
      detailsTitle: "Agent Details",
      details: [
        { label: "Agent Code", value: selectedAgentSummary.username || "—" },
        { label: "Agent Type", value: selectedAgentSummary.agentType || "—" },
        { label: "First Name", value: selectedAgentSummary.firstName || "—" },
        { label: "Middle Name", value: selectedAgentSummary.middleName || "—" },
        { label: "Last Name", value: selectedAgentSummary.lastName || "—" },
        { label: "Unit", value: selectedAgentSummary.unit || "—" },
        { label: "Branch", value: scope.branchName || selectedAgentSummary.branch || "—" },
        { label: "Area", value: scope.areaName || selectedAgentSummary.area || "—" },
      ],
      filters: [
        { label: "Performance Tab", value: tabLabel },
        { label: "Date Range", value: getPresetLabel(unitPerformanceDatePreset) },
      ],
      statCards: (detailRowsByTab[unitPerformanceTab] || []).map(([label, value], index) => ({
        label,
        value,
        tone: ["red", "blue", "green", "gold"][index % 4],
      })),
      analyticsSections: selectedKpiPeriod && selectedAgentKpiCards.length
        ? [
            {
              title: "Agent KPI Progress",
              rows: selectedAgentKpiCards.map(({ kpi, actual }) => ({
                label: formatKpiLabel(kpi, "AGENT"),
                value: `Actual ${formatActualKpiValue(actual, kpi.valueType)} • Target ${formatKpiTarget(kpi)}`,
              })),
            },
          ]
        : [],
      tableSections: [],
    });
  };

  const generateUnitKpiPdfReport = () => {
    if (!dashboardUnitKpiCards.length) return;
    const unitName = selectedUnit?.name || scope.unitName || "Unit";
    createPrintableReport({
      filename: `${user?.username || normalizedRole} - ${unitName} KPI Progress Report`,
      title: "Unit KPI Progress Report",
      periodLabel: unitKpiReportPeriodLabel,
      detailsTitle: "Unit Details",
      details: [
        { label: "Area", value: scope.areaName || "—" },
        { label: "Branch", value: scope.branchName || "—" },
        { label: "Unit", value: unitName },
        { label: "Unit Manager", value: `${selectedUnit?.manager?.code || "—"} • ${selectedUnit?.manager?.name || "—"}` },
        { label: "Assistant Unit Manager", value: `${selectedUnit?.assistantManager?.code || "—"} • ${selectedUnit?.assistantManager?.name || "—"}` },
      ],
      filters: [
        { label: "Assigned KPI Cards", value: String(dashboardUnitKpiCards.length) },
        { label: "Date Range", value: getPresetLabel(unitKpiDatePreset) },
        { label: "Agent Drilldown Rows", value: String(unitKpiSalesAgents.length) },
      ],
      statCards: dashboardUnitKpiCards.map(({ kpi, actual }) => ({
        label: formatKpiLabel(kpi, "UNIT"),
        value: formatActualKpiValue(actual, kpi.valueType),
        tone: "red",
      })),
      analyticsSections: [],
      tableSections: [
        {
          title: "Unit KPI Progress",
          columns: [
            { key: "kpi", label: "KPI" },
            { key: "frequency", label: "Frequency" },
            { key: "dateRange", label: "Date Range" },
            { key: "actual", label: "Actual" },
            { key: "target", label: "Target" },
            { key: "status", label: "Status" },
            { key: "gap", label: "Gap / Excess" },
          ],
          rows: dashboardUnitKpiCards.map(({ kpi, actual, comparison, dateRangeLabel }) => ({
            kpi: formatKpiLabel(kpi, "UNIT"),
            frequency: kpi.period,
            dateRange: dateRangeLabel,
            actual: formatActualKpiValue(actual, kpi.valueType),
            target: formatKpiTarget(kpi),
            status: comparison.status,
            gap: comparison.deltaLabel,
          })),
          pageSize: 12,
          emptyMessage: "No KPIs assigned.",
        },
        {
          title: "Agent Drilldown",
          columns: [
            { key: "username", label: "Agent Code" },
            { key: "name", label: "Agent Name" },
            { key: "salesProduction", label: "Sales Production" },
          ],
          rows: unitKpiSalesAgents.map((agent) => ({
            username: agent.username,
            name: agent.name || agent.username,
            salesProduction: formatMoney(agent.annualPremium),
          })),
          pageSize: 10,
          compactWithPrevious: true,
          compactMaxRows: 18,
          firstPageLimit: 18,
          emptyMessage: "No contributing agents for this date range.",
        },
        ...(unitBranchSalesContribution ? [
          {
            title: "Contribution in Branch Sales Production",
            columns: [
              { key: "metric", label: "Metric" },
              { key: "value", label: "Value" },
            ],
            rows: [
              { metric: "Unit Sales Production", value: formatMoney(unitBranchSalesContribution.actual) },
              { metric: "Branch Sales Production", value: formatMoney(unitBranchSalesContribution.branchActual) },
              { metric: "Contribution Share", value: `${unitBranchSalesContribution.contributionShare}%` },
              { metric: "Branch KPI Target", value: formatKpiTarget(unitBranchSalesContribution.kpi) },
              { metric: "Status", value: unitBranchSalesContribution.comparison.status },
              { metric: "Gap / Excess", value: unitBranchSalesContribution.comparison.deltaLabel },
            ],
            pageSize: 8,
            startNewPage: true,
            compactMaxRows: 18,
            emptyMessage: "No branch sales production contribution for this date range.",
          },
        ] : []),
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
        { key: "monthlyPremium", label: "Monthly Premium Breakdown" },
        { key: "quarterlyPremium", label: "Quarterly Premium Breakdown" },
        { key: "halfYearlyPremium", label: "Half-Yearly Premium Breakdown" },
        { key: "yearlyPremium", label: "Yearly Premium Breakdown" },
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
                  rows: branchSalesKpiUnitRows.map((unit) => ({
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
          pageSize: unitPerformanceTab === "sales" ? 8 : 12,
          firstPageRows: unitPerformanceTab === "sales" ? undefined : 8,
          widePageSizeCap: unitPerformanceTab === "sales" ? 8 : unitPerformanceTab === "clients" ? 8 : undefined,
          allowFirstPage: unitPerformanceTab !== "sales",
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
        showAlerts={["AUM", "UM", "BM"].includes(normalizedRole)}
        onNotificationsClick={() => navigate(`/${normalizedRole.toLowerCase()}/${user?.username || username}/notifications`)}
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
              <h1>{normalizedRole === "BM" ? `${scope.branchName || "Branch"} Branch` : (scope.unitName || "Unit")}</h1>
              <p>
                {normalizedRole === "BM"
                  ? `Monitor ${scope.branchName || "this branch"} • ${scope.areaName || "this area"} with live backend metrics, branch-wide agent coverage, auto-updating date-filtered tables, printable reports, and in-page branch KPI progress.`
                  : `Monitor ${scopeLabel} with live backend metrics, unit-wide agent coverage, auto-updating date-filtered tables, printable reports, and in-page unit KPI progress.`}
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
                <nav className="manager-breadcrumb manager-breadcrumb--agent" aria-label="Agent detail breadcrumb">
                  {normalizedRole === "BM" ? (
                    <>
                      <button type="button" onClick={() => { setSelectedAgentId(""); setActiveView("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{scope.branchName || selectedAgent.branch || "Branch"}</button>
                      <span>&gt;</span>
                      <button type="button" onClick={goToAgentUnit}>{selectedAgent.unit || "Unassigned Unit"}</button>
                    </>
                  ) : (
                    <button type="button" onClick={goToAgentUnit}>{selectedAgent.unit || scope.unitName || "Unit"}</button>
                  )}
                  <span>&gt;</span>
                  <strong>{selectedAgent.username || selectedAgent.name}</strong>
                </nav>

                <div className="manager-panel__head">
                  <div>
                    <h2 className="manager-agent-title">
                      <span>{selectedAgent.name}</span>
                      {renderAgentStatusPill(selectedAgent)}
                    </h2>
                    <p>
                      Agent Type: {selectedAgent.agentType || "—"} • Date Employed: {selectedAgent.dateEmployed ? formatDate(selectedAgent.dateEmployed) : "—"}
                    </p>
                  </div>
                </div>

                <div className="manager-tab-row">
                  <div className="manager-tab-buttons" role="tablist" aria-label="Agent performance tabs">
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
                  <label className="manager-select manager-select--unit-date" htmlFor="manager-agent-performance-date-preset">
                    <span>Date Range</span>
                    <select
                      id="manager-agent-performance-date-preset"
                      value={unitPerformanceDatePreset}
                      onChange={(e) => setUnitPerformanceDatePreset(e.target.value)}
                    >
                      {DATE_PRESETS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="manager-report-btn" onClick={generateAgentDetailsPdfReport}>
                    <FaFilePdf size={15} />
                    <span>Generate Report (PDF)</span>
                  </button>
                </div>

                <div className="manager-agent-detail-grid manager-agent-detail-grid--single">
                  {unitPerformanceTab === "clients" && selectedAgentSummary && (
                    <article>
                      <h3>Clients Relationship Performance</h3>
                      <div className="manager-metric-pair"><span>Total Prospects</span><strong>{selectedAgentSummary.totalProspects}</strong></div>
                      <div className="manager-metric-pair"><span>Active Prospects</span><strong>{selectedAgentSummary.activeProspects}</strong></div>
                      <div className="manager-metric-pair"><span>Total Leads</span><strong>{selectedAgentSummary.leads}</strong></div>
                      <div className="manager-metric-pair"><span>Active Leads</span><strong>{selectedAgentSummary.activeLeads}</strong></div>
                      <div className="manager-metric-pair"><span>Total Policyholders</span><strong>{selectedAgentSummary.totalPolicies}</strong></div>
                      <div className="manager-metric-pair"><span>Active Policyholders</span><strong>{selectedAgentSummary.activePolicies}</strong></div>
                      <div className="manager-metric-pair"><span>At Risk Policyholders</span><strong>{selectedAgentSummary.atRiskPolicies}</strong></div>
                      <div className="manager-metric-pair"><span>Lapsed Policies</span><strong>{selectedAgentSummary.lapsedPolicies}</strong></div>
                    </article>
                  )}
                  {unitPerformanceTab === "tasks" && selectedAgentSummary && (
                    <article>
                      <h3>Tasks Performance</h3>
                      <div className="manager-metric-pair"><span>Total Tasks</span><strong>{selectedAgentSummary.totalTasks}</strong></div>
                      <div className="manager-metric-pair"><span>Open Tasks</span><strong>{selectedAgentSummary.openTasks}</strong></div>
                      <div className="manager-metric-pair"><span>Overdue Tasks</span><strong>{selectedAgentSummary.overdueTasks}</strong></div>
                      <div className="manager-metric-pair"><span>On-Time Done Tasks</span><strong>{selectedAgentSummary.onTimeDoneTasks}</strong></div>
                      <div className="manager-metric-pair"><span>Overall Completion Rate</span><strong>{selectedAgentSummary.overallCompletionRate}%</strong></div>
                      <div className="manager-metric-pair"><span>On-Time Completion Rate</span><strong>{selectedAgentSummary.onTimeCompletionRate}%</strong></div>
                      <div className="manager-metric-pair"><span>Late Completion Rate</span><strong>{selectedAgentSummary.lateCompletionRate}%</strong></div>
                    </article>
                  )}
                  {unitPerformanceTab === "sales" && selectedAgentSummary && (
                    <article>
                      <h3>Sales Performance</h3>
                      <div className="manager-metric-pair"><span>Total Leads</span><strong>{selectedAgentSummary.leads}</strong></div>
                      <div className="manager-metric-pair"><span>Converted Leads</span><strong>{selectedAgentSummary.converted}</strong></div>
                      <div className="manager-metric-pair"><span>Unconverted Leads</span><strong>{selectedAgentSummary.unconverted}</strong></div>
                      <div className="manager-metric-pair"><span>Conversion Rate</span><strong>{selectedAgentSummary.conversionRate}%</strong></div>
                      <div className="manager-metric-pair"><span>Total Policies</span><strong>{selectedAgentSummary.totalPolicies}</strong></div>
                      <div className="manager-metric-pair"><span>Active Policies</span><strong>{selectedAgentSummary.activePolicies}</strong></div>
                      <div className="manager-metric-pair"><span>Active Policy Rate</span><strong>{selectedAgentSummary.activePolicyRate}%</strong></div>
                      <div className="manager-metric-pair"><span>Total Annual Premium</span><strong>{formatMoney(selectedAgentSummary.annualPremium)}</strong></div>
                      <div className="manager-metric-pair"><span>Monthly Premium Breakdown</span><strong>{formatMoney(selectedAgentSummary.monthlyPremium)}</strong></div>
                      <div className="manager-metric-pair"><span>Quarterly Premium Breakdown</span><strong>{formatMoney(selectedAgentSummary.quarterlyPremium)}</strong></div>
                      <div className="manager-metric-pair"><span>Half-Yearly Premium Breakdown</span><strong>{formatMoney(selectedAgentSummary.halfYearlyPremium)}</strong></div>
                      <div className="manager-metric-pair"><span>Yearly Premium Breakdown</span><strong>{formatMoney(selectedAgentSummary.yearlyPremium)}</strong></div>
                    </article>
                  )}
                </div>

                {selectedKpiPeriod && selectedAgentKpiCards.length ? (
                  <div className="manager-agent-kpi-section">
                    <h3>Agent KPI Progress</h3>
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
                  </div>
                ) : null}
              </section>
            ) : (
              <section className="manager-panel">
                <div className="manager-panel__head">
                  <div>
                    <h2>
                      {normalizedRole === "BM" ? (
                        <>
                          <button type="button" className="manager-heading-link" onClick={() => setActiveView("dashboard")}>{scope.branchName || "Branch"}</button>
                          <span> &gt; </span>
                          <span>{selectedUnit?.name || "Unit"}</span>
                        </>
                      ) : (
                        <button type="button" className="manager-heading-link" onClick={() => setActiveView("dashboard")}>{selectedUnit?.name || scope.unitName || "Unit"}</button>
                      )}
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
                  {normalizedRole === "BM" ? (
                    <label className="manager-select" htmlFor="manager-unit-selector">
                      <span>Unit</span>
                      <select id="manager-unit-selector" value={selectedUnit?.name || ""} onChange={(e) => { setSelectedUnitName(e.target.value); setSelectedAgentId(""); }}>
                        {unitOptions.map((unit) => (
                          <option key={unit.name} value={unit.name}>{unit.name}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                                  <button type="button" className="manager-kpi-agent-link" onClick={() => openAgentDetails(agent.id)}>
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
                            {branchSalesKpiUnitRows.map((unit) => (
                              <article key={`branch-unit:${unit.unit}`}>
                                <strong>{unit.unit}</strong>
                                <span>Sales Production: {formatMoney(unit.annualPremium)}</span>
                                {unit.topAgents.length ? (
                                  <>
                                    <small className="manager-kpi-gap-note">Top 5 Contributing Agents</small>
                                    <ul className="manager-kpi-agent-list manager-kpi-agent-list--compact">
                                    {unit.topAgents.map((agent) => (
                                      <li key={`unit-top-agent:${unit.unit}:${agent.id}`}>
                                        <button type="button" className="manager-kpi-agent-link" onClick={() => openAgentDetails(agent.id)}>
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
                            <button type="button" className="manager-agent-link" onClick={() => openAgentDetails(agent.id)}>
                              {agent.username}
                            </button>
                          </td>
                          <td>
                            <button type="button" className="manager-agent-link" onClick={() => openAgentDetails(agent.id)}>
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


          {!isLoading && !loadError && activeView === "orphan_endorsements" && normalizedRole === "UM" && (
            <section className="manager-panel">
              {!selectedUmLongLeaveRecord && (
                <>
                  <div className="manager-panel__head">
                    <div>
                      <h2>Orphan Clients Endorsements</h2>
                      <p>Review long leave and resignation orphan endorsements involving agents in {selectedUnit?.name || "your unit"}.</p>
                    </div>
                  </div>

                  <div className="manager-tab-row manager-orphan-endorsement-tabs">
                    <div className="manager-tab-buttons">
                      <button type="button" className={orphanEndorsementTab === "long_leaves" ? "active" : ""} onClick={() => { setSelectedUmLongLeaveRecordId(""); setSelectedUmAffectedClient(null); setSelectedReassignmentAgentId(""); setOrphanEndorsementTab("long_leaves"); }}>From Long Leaves</button>
                      <button type="button" className={orphanEndorsementTab === "resignations" ? "active" : ""} onClick={() => { setSelectedUmLongLeaveRecordId(""); setSelectedUmAffectedClient(null); setSelectedReassignmentAgentId(""); setOrphanEndorsementTab("resignations"); }}>From Resignations</button>
                    </div>
                  </div>
                </>
              )}

              {selectedUmLongLeaveRecord ? (
                selectedUmAffectedClient ? (
                  <>
                    <nav className="manager-breadcrumb manager-breadcrumb--agent" aria-label="Affected client reassignment breadcrumb">
                      <button type="button" onClick={() => { setSelectedUmLongLeaveRecordId(""); setSelectedUmAffectedClient(null); setSelectedReassignmentAgentId(""); }}>Orphan Clients Endorsements</button>
                      <span>&gt;</span>
                      <button type="button" onClick={() => { setSelectedUmAffectedClient(null); setSelectedReassignmentAgentId(""); }}>{selectedUmEndorsementIsResignation ? "Resignation" : "Long Leave"} Record for {selectedUmLongLeaveRecord.agentCode || "—"} - {selectedUmLongLeaveRecord.agentName || "—"}</button>
                      <span>&gt;</span>
                      <strong>{selectedUmAffectedClient.code || "—"} - {selectedUmAffectedClient.name || "—"}</strong>
                    </nav>

                    <div className="manager-section-subhead">
                      <h3>{selectedUmAffectedClient.kind === "policyholder" ? "Policyholder Details" : "Prospect Details"}</h3>
                      {selectedUmAffectedClient.reassigned === true ? null : <p>Review the recorded orphan client details before choosing a reassignment agent.</p>}
                    </div>
                    <div className="manager-agent-detail-grid manager-agent-detail-grid--profile">
                      {Object.entries(selectedUmAffectedClient.details || {}).map(([label, value]) => (
                        <article key={label}><span>{label}</span><strong>{value || "—"}</strong></article>
                      ))}
                    </div>

                    {selectedUmAffectedClient.recordType === "resignation" && (
                      <div className="manager-resignation-client-cards">
                        <article>
                          <h4>Leads</h4>
                          {(selectedUmAffectedClient.leads || []).length ? (selectedUmAffectedClient.leads || []).map((lead) => (
                            <p key={lead.leadCode || lead.id || lead._id}><strong>{lead.leadCode || "—"}</strong><span>{lead.source || "—"}</span><span>{lead.status || "—"}</span></p>
                          )) : <small>No leads recorded.</small>}
                        </article>
                        <article>
                          <h4>Policies</h4>
                          {(selectedUmAffectedClient.policies || []).length ? (selectedUmAffectedClient.policies || []).map((policy) => (
                            <p key={policy.policyholderCode || policy.id || policy._id}><strong>{policy.policyholderCode || "—"}</strong><span>{policy.policyNumber || "—"}</span><span>{policy.status || "—"}</span></p>
                          )) : <small>No policies recorded.</small>}
                        </article>
                      </div>
                    )}

                    <div className="manager-section-subhead">
                      <h3>{selectedUmAffectedClient.reassigned === true ? "Selected Agent for Reassignment" : "Recommended Agents for Reassignment"}</h3>
                    </div>
                    <div className="manager-reassignment-card-grid">
                      {displayedReassignmentAgentRows.map((agent) => (
                        <article className={`manager-reassignment-agent-card ${selectedReassignmentAgentId === agent.id || selectedUmAffectedClient.reassigned === true ? "selected" : ""}`} key={agent.id}>
                          <div className="manager-reassignment-agent-head">
                            <div>
                              <span className="manager-reassignment-agent-code">{agent.username || "—"}</span>
                              <h4>{agent.name || "—"}</h4>
                              <p>{agent.agentType || "—"}</p>
                            </div>
                            <div className="manager-reassignment-agent-status">
                              {renderAgentStatusPill(agent, { table: true })}
                              {selectedUmAffectedClient.reassigned === true && <small>Reassigned {formatDateTime(selectedUmAffectedClient.reassignedAt)}</small>}
                            </div>
                          </div>
                          <div className="manager-reassignment-metric-grid">
                            {renderReassignmentMetricTile({
                              label: `${reassignmentMonthLabel} Done Approaches`,
                              value: agent.reassignmentMetrics.completedApproaches,
                              target: agent.reassignmentMetrics.monthlyDoneApproachesTarget,
                            })}
                            {renderReassignmentMetricTile({
                              label: `Open/Overdue Approach Tasks as of ${reassignmentMonthLabel}`,
                              value: agent.reassignmentMetrics.openApproachTasks,
                              variant: "open",
                              note: "",
                            })}
                            {renderReassignmentMetricTile({
                              label: `Projected ${reassignmentMonthLabel} Approaches`,
                              value: agent.reassignmentMetrics.projectedApproaches,
                              target: agent.reassignmentMetrics.monthlyDoneApproachesTarget,
                            })}
                            {renderReassignmentMetricTile({
                              label: `${reassignmentMonthLabel} Closing Ratio`,
                              value: agent.reassignmentMetrics.closingRatio,
                              target: agent.reassignmentMetrics.monthlyClosingRatioTarget,
                              suffix: "%",
                            })}
                            {renderReassignmentMetricTile({
                              label: `${reassignmentMonthLabel} Active Policies`,
                              value: agent.reassignmentMetrics.activePolicies,
                              target: agent.reassignmentMetrics.monthlyActivePoliciesTarget,
                            })}
                          </div>
                          <div className="manager-reassignment-card-actions">
                            <button type="button" className="manager-refresh-btn" disabled={selectedUmAffectedClient.reassigned === true} onClick={() => setSelectedReassignmentAgentId(agent.id)}>{selectedReassignmentAgentId === agent.id || selectedUmAffectedClient.reassigned === true ? "Selected" : "Select Agent"}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {!displayedReassignmentAgentRows.length && <div className="manager-empty-state">No recommended agents matched all reassignment criteria for this unit.</div>}
                    {orphanLongLeaveFieldErrors.form && <small className="manager-field-error">{orphanLongLeaveFieldErrors.form}</small>}
                    {selectedUmAffectedClient.reassigned !== true && (
                      <div className="manager-orphan-action-buttons">
                        <button type="button" className="manager-refresh-btn manager-long-leave-next-btn" disabled={!selectedReassignmentAgentId || reassignmentSaving} onClick={confirmAffectedClientReassignment}>{reassignmentSaving ? "Confirming..." : "Confirm Reassignment"}</button>
                      </div>
                    )}
                  </>
                ) : (
                <>
                  <nav className="manager-breadcrumb manager-breadcrumb--agent" aria-label="Long leave endorsement breadcrumb">
                    <button type="button" onClick={() => setSelectedUmLongLeaveRecordId("")}>Orphan Clients Endorsements</button>
                    <span>&gt;</span>
                    <strong>{selectedUmEndorsementIsResignation ? "Resignation" : "Long Leave"} Record for {selectedUmLongLeaveRecord.agentCode || "—"} - {selectedUmLongLeaveRecord.agentName || "—"}</strong>
                  </nav>

                  <div className="manager-agent-detail-grid manager-agent-detail-grid--profile">
                    {selectedUmEndorsementIsResignation ? (
                      <article><span>Resignation Date</span><strong>{formatDate(selectedUmLongLeaveRecord.resignationDate)}</strong></article>
                    ) : (
                      <>
                        <article><span>Leave Start Date</span><strong>{formatDate(selectedUmLongLeaveRecord.leaveStartDate)}</strong></article>
                        <article><span>Leave End Date</span><strong>{formatDate(selectedUmLongLeaveRecord.leaveEndDate)}</strong></article>
                      </>
                    )}
                    <article><span>Status</span><strong>{selectedUmLongLeaveRecord.status || "Endorsed"}</strong></article>
                  </div>

                  {selectedUmEndorsementIsResignation && (
                    <>
                      <div className="manager-section-subhead">
                        <h3>Affected Prospects</h3>
                        <p>Prospects endorsed from this resignation record.</p>
                      </div>
                      {Array.isArray(selectedUmLongLeaveRecord.affectedProspects) && selectedUmLongLeaveRecord.affectedProspects.length ? (
                        <div className="manager-table-wrap">
                          <table className="manager-table manager-table--promotion-history manager-table--clickable">
                            <thead>
                              <tr><th>Prospect Code</th><th>Prospect Name</th><th>Leads</th><th>Policies</th><th>Reassigned</th></tr>
                            </thead>
                            <tbody>
                              {selectedUmLongLeaveRecord.affectedProspects.map((prospect) => (
                                <tr key={prospect.id || prospect.prospectId || prospect.prospectCode} onClick={() => openAffectedClientDetail({ kind: "prospect", recordType: "resignation", id: prospect.id || prospect.prospectId, prospectId: prospect.prospectId || prospect.id, code: prospect.prospectCode || "—", name: prospect.name || "—", leads: prospect.leads || [], policies: prospect.policies || [], reassigned: prospect.reassigned === true, reassignedAt: prospect.reassignedAt, reassignedToAgentId: prospect.reassignedToAgentId, reassignedToAgentName: prospect.reassignedToAgentName, details: { "Prospect Code": prospect.prospectCode, "Prospect Name": prospect.name, "Market Type": prospect.marketType, "Prospect Type": prospect.prospectType } })} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openAffectedClientDetail({ kind: "prospect", recordType: "resignation", id: prospect.id || prospect.prospectId, prospectId: prospect.prospectId || prospect.id, code: prospect.prospectCode || "—", name: prospect.name || "—", leads: prospect.leads || [], policies: prospect.policies || [], reassigned: prospect.reassigned === true, reassignedAt: prospect.reassignedAt, reassignedToAgentId: prospect.reassignedToAgentId, reassignedToAgentName: prospect.reassignedToAgentName, details: { "Prospect Code": prospect.prospectCode, "Prospect Name": prospect.name, "Market Type": prospect.marketType, "Prospect Type": prospect.prospectType } }); }}>
                                  <td>{prospect.prospectCode || "—"}</td>
                                  <td>{prospect.name || "—"}</td>
                                  <td>{(prospect.leads || []).map((lead) => lead.leadCode || "—").join(", ") || "—"}</td>
                                  <td>{(prospect.policies || []).map((policy) => policy.policyholderCode || "—").join(", ") || "—"}</td>
                                  <td>{formatReassignedFlag(prospect.reassigned)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <div className="manager-empty-state">No affected prospects recorded for this resignation endorsement.</div>}
                    </>
                  )}

                  {!selectedUmEndorsementIsResignation && (<>
                  <div className="manager-section-subhead">
                    <h3>Affected Prospects with Active Leads</h3>
                    <p>Prospects endorsed from this long leave record.</p>
                  </div>
                  {Array.isArray(selectedUmLongLeaveRecord.affectedProspects) && selectedUmLongLeaveRecord.affectedProspects.length ? (
                    <div className="manager-table-wrap">
                      <table className="manager-table manager-table--promotion-history manager-table--clickable">
                        <thead>
                          <tr><th>Prospect Code</th><th>Lead Code</th><th>Name</th><th>Status</th><th>Reassigned</th></tr>
                        </thead>
                        <tbody>
                          {selectedUmLongLeaveRecord.affectedProspects.map((prospect) => (
                            <tr key={prospect.id || `${prospect.prospectCode}:${prospect.leadCode}`} onClick={() => openAffectedClientDetail({ kind: "prospect", id: prospect.id, prospectId: prospect.prospectId, leadId: prospect.leadId || prospect.id, code: prospect.prospectCode || "—", leadCode: prospect.leadCode || "—", name: prospect.name || "—", reassigned: prospect.reassigned === true, reassignedAt: prospect.reassignedAt, reassignedToAgentId: prospect.reassignedToAgentId, reassignedToAgentName: prospect.reassignedToAgentName, details: { "Prospect Code": prospect.prospectCode, "Lead Code": prospect.leadCode, Name: prospect.name, Source: prospect.source, Status: prospect.status, "Market Type": prospect.marketType, "Prospect Type": prospect.prospectType } })} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openAffectedClientDetail({ kind: "prospect", id: prospect.id, prospectId: prospect.prospectId, leadId: prospect.leadId || prospect.id, code: prospect.prospectCode || "—", leadCode: prospect.leadCode || "—", name: prospect.name || "—", reassigned: prospect.reassigned === true, reassignedAt: prospect.reassignedAt, reassignedToAgentId: prospect.reassignedToAgentId, reassignedToAgentName: prospect.reassignedToAgentName, details: { "Prospect Code": prospect.prospectCode, "Lead Code": prospect.leadCode, Name: prospect.name, Source: prospect.source, Status: prospect.status, "Market Type": prospect.marketType, "Prospect Type": prospect.prospectType } }); }}>
                              <td>{prospect.prospectCode || "—"}</td>
                              <td>{prospect.leadCode || "—"}</td>
                              <td>{prospect.name || "—"}</td>
                              <td>{prospect.status || "—"}</td>
                              <td>{formatReassignedFlag(prospect.reassigned)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="manager-empty-state">No affected prospects recorded for this endorsement.</div>}

                  <div className="manager-section-subhead">
                    <h3>Affected Policyholders with Ongoing Policies</h3>
                    <p>Policyholders endorsed from this long leave record, if selected.</p>
                  </div>
                  {Array.isArray(selectedUmLongLeaveRecord.affectedPolicyholders) && selectedUmLongLeaveRecord.affectedPolicyholders.length ? (
                    <div className="manager-table-wrap">
                      <table className="manager-table manager-table--promotion-history manager-table--clickable">
                        <thead>
                          <tr><th>Policyholder Code</th><th>Policyholder Name</th><th>Product Name</th><th>Policy Number</th><th>Status</th><th>Reassigned</th></tr>
                        </thead>
                        <tbody>
                          {selectedUmLongLeaveRecord.affectedPolicyholders.map((policyholder) => (
                            <tr key={policyholder.id || `${policyholder.policyholderCode}:${policyholder.policyNumber}`} onClick={() => openAffectedClientDetail({ kind: "policyholder", id: policyholder.id, prospectId: policyholder.prospectId, leadId: policyholder.leadId, code: policyholder.policyholderCode || "—", name: policyholder.policyholderName || "—", reassigned: policyholder.reassigned === true, reassignedAt: policyholder.reassignedAt, reassignedToAgentId: policyholder.reassignedToAgentId, reassignedToAgentName: policyholder.reassignedToAgentName, details: { "Policyholder Code": policyholder.policyholderCode, "Policyholder Name": policyholder.policyholderName, "Product Name": policyholder.productName, "Policy Number": policyholder.policyNumber, Status: policyholder.status } })} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openAffectedClientDetail({ kind: "policyholder", id: policyholder.id, prospectId: policyholder.prospectId, leadId: policyholder.leadId, code: policyholder.policyholderCode || "—", name: policyholder.policyholderName || "—", reassigned: policyholder.reassigned === true, reassignedAt: policyholder.reassignedAt, reassignedToAgentId: policyholder.reassignedToAgentId, reassignedToAgentName: policyholder.reassignedToAgentName, details: { "Policyholder Code": policyholder.policyholderCode, "Policyholder Name": policyholder.policyholderName, "Product Name": policyholder.productName, "Policy Number": policyholder.policyNumber, Status: policyholder.status } }); }}>
                              <td>{policyholder.policyholderCode || "—"}</td>
                              <td>{policyholder.policyholderName || "—"}</td>
                              <td>{policyholder.productName || "—"}</td>
                              <td>{policyholder.policyNumber || "—"}</td>
                              <td>{policyholder.status || "—"}</td>
                              <td>{formatReassignedFlag(policyholder.reassigned)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="manager-empty-state">No affected policyholders recorded for this endorsement.</div>}
                  </>)}
                </>
                )
              ) : orphanEndorsementTab === "long_leaves" ? (
                <>
                  <div className="manager-table-wrap">
                    <table className="manager-table manager-table--promotion-history manager-table--clickable">
                      <thead>
                        <tr>
                          <th>Agent Code</th>
                          <th>Agent Name</th>
                          <th>Leave Start Date</th>
                          <th>Leave End Date</th>
                          <th>Reassignments Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitLongLeaveEndorsementRows.map((record) => (
                          <tr key={record.id || `${record.agentCode}:${record.leaveStartDate}:${record.leaveEndDate}`} onClick={() => setSelectedUmLongLeaveRecordId(record.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedUmLongLeaveRecordId(record.id); }}>
                            <td>{record.agentCode || "—"}</td>
                            <td>{record.agentName || "—"}</td>
                            <td>{formatDate(record.leaveStartDate)}</td>
                            <td>{formatDate(record.leaveEndDate)}</td>
                            <td>{getLongLeaveReassignmentProgress(record)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!unitLongLeaveEndorsementRows.length && <div className="manager-empty-state">No endorsed long leave orphan endorsements recorded for this unit.</div>}
                </>
              ) : (
                <>
                  <div className="manager-table-wrap">
                    <table className="manager-table manager-table--promotion-history manager-table--clickable">
                      <thead>
                        <tr>
                          <th>Agent Code</th>
                          <th>Agent Name</th>
                          <th>Resignation Date</th>
                          <th>Reassignments Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitResignationEndorsementRows.map((record) => (
                          <tr key={record.id || record._id || `${record.agentCode}:${record.resignationDate}`} onClick={() => setSelectedUmLongLeaveRecordId(record.id || record._id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedUmLongLeaveRecordId(record.id || record._id); }}>
                            <td>{record.agentCode || "—"}</td>
                            <td>{record.agentName || "—"}</td>
                            <td>{formatDate(record.resignationDate)}</td>
                            <td>{getResignationReassignmentProgress(record)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!unitResignationEndorsementRows.length && <div className="manager-empty-state">No resignation orphan endorsements recorded for this unit yet.</div>}
                </>
              )}
            </section>
          )}

          {!isLoading && !loadError && activeView === "orphan_clients" && normalizedRole === "BM" && (
            selectedAgent ? (
              <section className="manager-panel">
                <nav className="manager-breadcrumb manager-breadcrumb--agent" aria-label="Orphan client agent detail breadcrumb">
                  <button type="button" onClick={() => { setSelectedAgentId(""); setActiveView("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{scope.branchName || selectedAgent.branch || "Branch"}</button>
                  <span>&gt;</span>
                  <button type="button" onClick={() => { setSelectedAgentId(""); setOrphanAgentAction(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>All Agents</button>
                  <span>&gt;</span>
                  {orphanAgentAction ? (
                    <>
                      <button type="button" onClick={closeOrphanAgentAction}>{selectedAgent.username || selectedAgent.name}</button>
                      <span>&gt;</span>
                      <strong>{orphanAgentAction === "long_leave" ? "Mark as On Long Leave" : "Mark as Resigned"}</strong>
                    </>
                  ) : (
                    <strong>{selectedAgent.username || selectedAgent.name}</strong>
                  )}
                </nav>

                {orphanAgentAction ? (
                  <div className="manager-orphan-action-page" ref={orphanActionTopRef}>
                    <div className="manager-panel__head">
                      <div>
                        <h2>{orphanAgentAction === "long_leave" ? "Mark as On Long Leave" : "Mark as Resigned"}</h2>
                        <p>{selectedAgent.name || selectedAgent.username} • {selectedAgent.username || "—"}</p>
                      </div>
                    </div>

                    {orphanAgentAction === "long_leave" && (
                      <>
                        <div className="manager-stepper" ref={longLeaveStepperRef} aria-label="Mark as On Long Leave steps">
                          {[
                            [1, "Record Long Leave Details"],
                            [2, "Confirm Orphan Clients"],
                            [3, "Endorse Orphan Clients"],
                          ].map(([step, label]) => (
                            <button
                              key={step}
                              type="button"
                              className={orphanLongLeaveStep === step ? "active" : ""}
                              disabled={(step === 2 && !canAccessLongLeaveStep2) || (step === 3 && !canAccessLongLeaveStep3)}
                              onClick={() => setLongLeaveStepAndScroll(step)}
                            >
                              <span>Step {step}</span>
                              <strong>{label}</strong>
                            </button>
                          ))}
                        </div>

                        {orphanLongLeaveStep === 1 && (
                          <div className="manager-orphan-action-form">
                            <label>
                              <span>Leave Start Date <em>*</em></span>
                              <input type="date" disabled={isLongLeaveReadOnly} min={minimumOrphanLeaveStartDate} value={orphanLeaveStartDate} onChange={(e) => { setOrphanLeaveStartDate(e.target.value); setConfirmOrphanTransfer(false); setOrphanLongLeaveDetailsDirty(Boolean(orphanLongLeaveId)); setOrphanLongLeaveFieldErrors((current) => ({ ...current, leaveStartDate: "" })); }} required />
                              {orphanLongLeaveFieldErrors.leaveStartDate && <small className="manager-field-error">{orphanLongLeaveFieldErrors.leaveStartDate}</small>}
                            </label>
                            <label>
                              <span>Leave End Date <em>*</em></span>
                              <input type="date" disabled={isLongLeaveReadOnly} min={orphanLeaveStartDate || todayDateInputValue} value={orphanLeaveEndDate} onChange={(e) => { setOrphanLeaveEndDate(e.target.value); setConfirmOrphanTransfer(false); setOrphanLongLeaveDetailsDirty(Boolean(orphanLongLeaveId)); setOrphanLongLeaveFieldErrors((current) => ({ ...current, leaveEndDate: "" })); }} required />
                              {(orphanLeaveEndDateError || orphanLongLeaveFieldErrors.leaveEndDate) && <small className="manager-field-error">{orphanLeaveEndDateError || orphanLongLeaveFieldErrors.leaveEndDate}</small>}
                            </label>
                            <label className="manager-file-upload">
                              <span>Leave Application Form (PDF) <em>*</em></span>
                              <input type="file" disabled={isLongLeaveReadOnly} accept="application/pdf,.pdf" onChange={(e) => { setOrphanLongLeaveDetailsDirty(Boolean(orphanLongLeaveId)); readOrphanLeaveFile(e.target.files?.[0], "leaveApplicationForm", (file) => (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) ? "" : "Leave application form must be a PDF file."); }} required />
                              {orphanLongLeaveFieldErrors.leaveApplicationForm && <small className="manager-field-error">{orphanLongLeaveFieldErrors.leaveApplicationForm}</small>}
                            </label>
                            {orphanLeaveApplicationForm && (
                              <div className="manager-file-preview manager-file-preview--wide">
                                <strong>{orphanLeaveApplicationForm.fileName}</strong>
                                <span>{orphanLeaveApplicationForm.mimeType || "application/pdf"}</span>
                                <small>{(orphanLeaveApplicationForm.size / 1024).toFixed(1)} KB</small>
                                <iframe title="Leave application form preview" src={orphanLeaveApplicationForm.dataUrl} />
                              </div>
                            )}
                            <label className="manager-file-upload">
                              <span>Proof of Approved Leave (JPG/JPEG/PNG) <em>*</em></span>
                              <input type="file" disabled={isLongLeaveReadOnly} accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={(e) => { setOrphanLongLeaveDetailsDirty(Boolean(orphanLongLeaveId)); readOrphanLeaveFile(e.target.files?.[0], "approvedLeaveProof", (file) => /^image\/(?:jpeg|png)$/i.test(file.type || "") || /\.(jpe?g|png)$/i.test(file.name || "") ? "" : "Proof of approved leave must be a JPG, JPEG, or PNG image."); }} required />
                              {orphanLongLeaveFieldErrors.approvedLeaveProof && <small className="manager-field-error">{orphanLongLeaveFieldErrors.approvedLeaveProof}</small>}
                            </label>
                            {orphanLongLeaveFieldErrors.form && <small className="manager-field-error">{orphanLongLeaveFieldErrors.form}</small>}
                            {orphanApprovedLeaveProof && (
                              <div className="manager-file-preview manager-file-preview--wide">
                                <strong>{orphanApprovedLeaveProof.fileName}</strong>
                                <span>{orphanApprovedLeaveProof.mimeType || "image"}</span>
                                <small>{(orphanApprovedLeaveProof.size / 1024).toFixed(1)} KB</small>
                                <img src={orphanApprovedLeaveProof.dataUrl} alt="Proof of approved leave preview" />
                              </div>
                            )}
                          </div>
                        )}

                        {orphanLongLeaveStep === 2 && (
                          <div className="manager-orphan-confirm-step">
                            <div className="manager-section-subhead">
                              <h3>Confirm Orphan Clients</h3>
                              <p>Prospects and selected policyholders affected by this long leave.</p>
                            </div>

                            <h4>Prospects with Active Leads</h4>
                            <div className="manager-promotion-table-wrap">
                              <table className="manager-table manager-table--promotion-history">
                                <thead>
                                  <tr>
                                    <th>Prospect Code</th>
                                    <th>Lead Code</th>
                                    <th>Name</th>
                                    <th>Source</th>
                                    <th>Status</th>
                                    <th>Market Type</th>
                                    <th>Prospect Type</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {step2Prospects.map((prospect) => (
                                    <tr key={prospect.id}>
                                      <td>{prospect.prospectCode || "—"}</td>
                                      <td>{prospect.leadCode || "—"}</td>
                                      <td>
                                        <span>{prospect.name || "—"}</span>
                                        {Array.isArray(prospect.ongoingPolicies) && prospect.ongoingPolicies.length > 0 && (
                                          <small className="manager-table-subtext">
                                            This prospect also has the following policies: {prospect.ongoingPolicies.map((policy) => `${policy.policyholderCode || "—"} • ${policy.productName || "—"} • ${policy.policyNumber || "—"} • ${policy.status || "—"}`).join("; ")}.
                                          </small>
                                        )}
                                      </td>
                                      <td>{prospect.source || "—"}</td>
                                      <td>{prospect.status || "—"}</td>
                                      <td>{prospect.marketType || "—"}</td>
                                      <td>{prospect.prospectType || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {!step2Prospects.length && <div className="manager-empty-state">No prospects with active leads found for this agent.</div>}

                            <label className="manager-toggle-line manager-toggle-line--optional">
                              <input type="checkbox" disabled={isLongLeaveReadOnly} checked={includeOngoingPolicyholders} onChange={(e) => { setIncludeOngoingPolicyholders(e.target.checked); setConfirmOrphanTransfer(false); }} />
                              <span>Allow policyholders with ongoing policies transfer</span>
                            </label>

                            {includeOngoingPolicyholders && (
                              <>
                                <h4>Policyholders with Ongoing Policies</h4>
                                <div className="manager-promotion-table-wrap">
                                  <table className="manager-table manager-table--promotion-history">
                                    <thead>
                                      <tr>
                                        <th>Policyholder Code</th>
                                        <th>Policyholder Name</th>
                                        <th>Product Name</th>
                                        <th>Policy Number</th>
                                        <th>Policy Issuance Date</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {step2Policyholders.map((policyholder) => (
                                        <tr key={policyholder.id}>
                                          <td>{policyholder.policyholderCode || "—"}</td>
                                          <td>{policyholder.policyholderName || "—"}</td>
                                          <td>{policyholder.productName || "—"}</td>
                                          <td>{policyholder.policyNumber || "—"}</td>
                                          <td>{formatDate(policyholder.policyIssuanceDate)}</td>
                                          <td>{policyholder.status || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {!step2Policyholders.length && <div className="manager-empty-state">No policyholders with ongoing policies found for this agent.</div>}
                              </>
                            )}

                            <label className="manager-toggle-line manager-toggle-line--confirm manager-toggle-line--confirm-orphans">
                              <input type="checkbox" disabled={isLongLeaveReadOnly} checked={confirmOrphanTransfer} onChange={(e) => { setConfirmOrphanTransfer(e.target.checked); setOrphanLongLeaveFieldErrors((current) => ({ ...current, form: "" })); }} />
                              <span>Confirm transfer of orphaned clients by prospects with active leads{includeOngoingPolicyholders ? " and policyholders with ongoing policies" : ""}.</span>
                            </label>
                            {orphanLongLeaveFieldErrors.form && <small className="manager-field-error">{orphanLongLeaveFieldErrors.form}</small>}
                          </div>
                        )}

                        {orphanLongLeaveStep === 3 && (
                          <div className="manager-orphan-confirm-step">
                            <div className="manager-section-subhead">
                              <h3>Endorse Orphan Clients</h3>
                              <p>Review the confirmed orphan clients selected for endorsement to {selectedAgentUnitManager.code} - {selectedAgentUnitManager.name} from {selectedAgentUnitManager.unitName}.</p>
                            </div>

                            <h4>Confirmed Prospects with Active Leads</h4>
                            {displayedConfirmedProspects.length ? (
                              <div className="manager-promotion-table-wrap">
                                <table className="manager-table manager-table--promotion-history">
                                  <thead>
                                    <tr>
                                      <th>Prospect Code</th>
                                      <th>Lead Code</th>
                                      <th>Name</th>
                                      <th>Source</th>
                                      <th>Status</th>
                                      <th>Market Type</th>
                                      <th>Prospect Type</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {displayedConfirmedProspects.map((prospect) => (
                                      <tr key={`confirmed-${prospect.id}`}>
                                        <td>{prospect.prospectCode || "—"}</td>
                                        <td>{prospect.leadCode || "—"}</td>
                                        <td>
                                          <span>{prospect.name || "—"}</span>
                                          {Array.isArray(prospect.ongoingPolicies) && prospect.ongoingPolicies.length > 0 && (
                                            <small className="manager-table-subtext">
                                              This prospect also has the following policies: {prospect.ongoingPolicies.map((policy) => `${policy.policyholderCode || "—"} • ${policy.productName || "—"} • ${policy.policyNumber || "—"} • ${policy.status || "—"}`).join("; ")}.
                                            </small>
                                          )}
                                        </td>
                                        <td>{prospect.source || "—"}</td>
                                        <td>{prospect.status || "—"}</td>
                                        <td>{prospect.marketType || "—"}</td>
                                        <td>{prospect.prospectType || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="manager-empty-state">No confirmed prospects with active leads selected.</div>
                            )}

                            {includeOngoingPolicyholders && (
                              <>
                                <h4>Confirmed Policyholders with Ongoing Policies</h4>
                                {displayedConfirmedPolicyholders.length ? (
                                  <div className="manager-promotion-table-wrap">
                                    <table className="manager-table manager-table--promotion-history">
                                      <thead>
                                        <tr>
                                          <th>Policyholder Code</th>
                                          <th>Policyholder Name</th>
                                          <th>Product Name</th>
                                          <th>Policy Number</th>
                                          <th>Policy Issuance Date</th>
                                          <th>Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {displayedConfirmedPolicyholders.map((policyholder) => (
                                          <tr key={`confirmed-${policyholder.id}`}>
                                            <td>{policyholder.policyholderCode || "—"}</td>
                                            <td>{policyholder.policyholderName || "—"}</td>
                                            <td>{policyholder.productName || "—"}</td>
                                            <td>{policyholder.policyNumber || "—"}</td>
                                            <td>{formatDate(policyholder.policyIssuanceDate)}</td>
                                            <td>{policyholder.status || "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="manager-empty-state">No confirmed policyholders with ongoing policies selected.</div>
                                )}
                              </>
                            )}
                            {orphanLongLeaveFieldErrors.form && <small className="manager-field-error">{orphanLongLeaveFieldErrors.form}</small>}
                          </div>
                        )}
                      </>
                    )}

                    {orphanAgentAction === "resigned" && (
                      <>
                        <div className="manager-stepper" ref={longLeaveStepperRef} aria-label="Mark as Resigned steps">
                          {[
                            [1, "Record Resignation Details"],
                            [2, "Confirm Orphan Clients"],
                            [3, "Endorse Orphan Clients"],
                          ].map(([step, label]) => (
                            <button
                              key={step}
                              type="button"
                              className={orphanResignationStep === step ? "active" : ""}
                              disabled={(step === 2 && !orphanResignationId) || (step === 3 && !["Confirmed Orphans", "Endorsed"].includes(orphanResignationStatus))}
                              onClick={() => setOrphanResignationStep(step)}
                            >
                              <span>Step {step}</span>
                              <strong>{label}</strong>
                            </button>
                          ))}
                        </div>

                        {orphanResignationStep === 1 && (
                          <div className="manager-orphan-action-form">
                            <label>
                              <span>Resignation Date <em>*</em></span>
                              <input type="date" min={minimumResignationDate} value={orphanResignationDate} onChange={(e) => { setOrphanResignationDate(e.target.value); setOrphanLongLeaveFieldErrors((current) => ({ ...current, resignationDate: "" })); }} required />
                              {(orphanResignationDateError || orphanLongLeaveFieldErrors.resignationDate) && <small className="manager-field-error">{orphanResignationDateError || orphanLongLeaveFieldErrors.resignationDate}</small>}
                            </label>
                            <label className="manager-file-upload">
                              <span>Accomplished Resignation Letter (PDF) <em>*</em></span>
                              <input type="file" accept="application/pdf,.pdf" onChange={(e) => readOrphanLeaveFile(e.target.files?.[0], "resignationLetter", (file) => (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) ? "" : "Accomplished resignation letter must be a PDF file.")} required />
                              {orphanLongLeaveFieldErrors.resignationLetter && <small className="manager-field-error">{orphanLongLeaveFieldErrors.resignationLetter}</small>}
                            </label>
                            {orphanResignationLetter && (
                              <div className="manager-file-preview manager-file-preview--wide">
                                <strong>{orphanResignationLetter.fileName}</strong>
                                <span>{orphanResignationLetter.mimeType || "application/pdf"}</span>
                                <small>{(orphanResignationLetter.size / 1024).toFixed(1)} KB</small>
                                <iframe title="Resignation letter preview" src={orphanResignationLetter.dataUrl} />
                              </div>
                            )}
                            <label className="manager-file-upload">
                              <span>Proof of Approved Resignation (JPG/JPEG/PNG) <em>*</em></span>
                              <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={(e) => readOrphanLeaveFile(e.target.files?.[0], "approvedResignationProof", (file) => /^image\/(?:jpeg|png)$/i.test(file.type || "") || /\.(jpe?g|png)$/i.test(file.name || "") ? "" : "Proof of approved resignation must be a JPG, JPEG, or PNG image.")} required />
                              {orphanLongLeaveFieldErrors.approvedResignationProof && <small className="manager-field-error">{orphanLongLeaveFieldErrors.approvedResignationProof}</small>}
                            </label>
                            {orphanApprovedResignationProof && (
                              <div className="manager-file-preview manager-file-preview--wide">
                                <strong>{orphanApprovedResignationProof.fileName}</strong>
                                <span>{orphanApprovedResignationProof.mimeType || "image"}</span>
                                <small>{(orphanApprovedResignationProof.size / 1024).toFixed(1)} KB</small>
                                <img src={orphanApprovedResignationProof.dataUrl} alt="Proof of approved resignation preview" />
                              </div>
                            )}
                            {orphanLongLeaveFieldErrors.form && <small className="manager-field-error">{orphanLongLeaveFieldErrors.form}</small>}
                          </div>
                        )}

                        {orphanResignationStep === 2 && (
                          <div className="manager-orphan-confirm-step">
                            <div className="manager-section-subhead"><h3>Confirm Orphan Clients</h3><p>Prospects and related leads and policies affected by this resignation.</p></div>
                            {resignationAffectedProspects.length ? (
                              <div className="manager-promotion-table-wrap manager-promotion-table-wrap--resignation">
                                <table className="manager-table manager-table--promotion-history manager-table--resignation-orphans">
                                  <thead><tr><th>Prospect Code</th><th>Prospect Name</th><th>Market Type</th><th>Prospect Type</th><th>Leads</th><th>Policies</th></tr></thead>
                                  <tbody>
                                    {resignationAffectedProspects.map((prospect) => (
                                      <tr key={prospect.id || prospect.prospectId || prospect.prospectCode}>
                                        <td>{prospect.prospectCode || "—"}</td>
                                        <td>{prospect.name || "—"}</td>
                                        <td>{prospect.marketType || "—"}</td>
                                        <td>{prospect.prospectType || "—"}</td>
                                        <td>{(prospect.leads || []).length ? prospect.leads.map((lead) => `${lead.leadCode || "—"} • ${lead.source || "—"} • ${lead.status || "—"}`).join("; ") : "—"}</td>
                                        <td>{(prospect.policies || []).length ? prospect.policies.map((policy) => `${policy.policyholderCode || "—"} • ${policy.policyNumber || "—"} • ${policy.status || "—"}`).join("; ") : "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : <div className="manager-empty-state">No prospects found for this resigned agent.</div>}
                            {orphanLongLeaveFieldErrors.form && <small className="manager-field-error">{orphanLongLeaveFieldErrors.form}</small>}
                          </div>
                        )}

                        {orphanResignationStep === 3 && (
                          <div className="manager-orphan-confirm-step">
                            <div className="manager-section-subhead"><h3>Endorse Orphan Clients</h3>{orphanResignationStatus !== "Endorsed" && <p>Endorse confirmed resignation orphan clients to the unit manager.</p>}</div>
                            {resignationAffectedProspects.length ? (
                              <div className="manager-promotion-table-wrap manager-promotion-table-wrap--resignation">
                                <table className="manager-table manager-table--promotion-history manager-table--resignation-orphans">
                                  <thead><tr><th>Prospect Code</th><th>Prospect Name</th><th>Market Type</th><th>Prospect Type</th><th>Leads</th><th>Policies</th></tr></thead>
                                  <tbody>
                                    {resignationAffectedProspects.map((prospect) => (
                                      <tr key={`resignation-endorse-${prospect.id || prospect.prospectId || prospect.prospectCode}`}>
                                        <td>{prospect.prospectCode || "—"}</td>
                                        <td>{prospect.name || "—"}</td>
                                        <td>{prospect.marketType || "—"}</td>
                                        <td>{prospect.prospectType || "—"}</td>
                                        <td>{(prospect.leads || []).length ? prospect.leads.map((lead) => `${lead.leadCode || "—"} • ${lead.source || "—"} • ${lead.status || "—"}`).join("; ") : "—"}</td>
                                        <td>{(prospect.policies || []).length ? prospect.policies.map((policy) => `${policy.policyholderCode || "—"} • ${policy.policyNumber || "—"} • ${policy.status || "—"}`).join("; ") : "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : <div className="manager-empty-state">No confirmed resignation orphan clients found.</div>}
                            {orphanLongLeaveFieldErrors.form && <small className="manager-field-error">{orphanLongLeaveFieldErrors.form}</small>}
                          </div>
                        )}
                      </>
                    )}

                    <div className="manager-orphan-action-buttons">
                      {!(orphanAgentAction === "long_leave" && (orphanLongLeaveStep === 2 || orphanLongLeaveStep === 3)) && !(orphanAgentAction === "resigned" && orphanResignationStep !== 1) && !(orphanAgentAction === "resigned" && orphanResignationId && !resignationDetailsDirty) && (
                        <button
                          type="button"
                          className="manager-refresh-btn"
                          disabled={isLongLeaveReadOnly || (orphanAgentAction === "resigned" && orphanResignationStatus === "Endorsed") || (isEditingSavedLongLeaveDetails && !orphanLongLeaveDetailsDirty)}
                          onClick={orphanAgentAction === "resigned" && orphanResignationId ? cancelResignationDetailEdits : (isEditingSavedLongLeaveDetails ? cancelLongLeaveDetailEdits : closeOrphanAgentAction)}
                        >
                          Cancel
                        </button>
                      )}
                      {(orphanAgentAction === "long_leave" && orphanLongLeaveStep < 3) || (orphanAgentAction === "resigned" && orphanResignationStep < 3) ? (
                        <button
                          type="button"
                          className="manager-refresh-btn manager-long-leave-next-btn"
                          disabled={orphanLongLeaveSaving || (orphanAgentAction === "long_leave" ? (isLongLeaveReadOnly || (orphanLongLeaveStep === 1 ? (Boolean(orphanLeaveEndDateError) || (Boolean(orphanLongLeaveId) && !orphanLongLeaveDetailsDirty)) : !confirmOrphanTransfer)) : (orphanResignationStatus === "Endorsed" || (orphanResignationStep === 1 ? (!resignationDetailsDirty || !orphanResignationDate || !orphanResignationLetter || !orphanApprovedResignationProof || Boolean(orphanResignationDateError)) : false)))}
                          onClick={orphanAgentAction === "long_leave" ? goToNextLongLeaveStep : goToNextResignationStep}
                        >
                          {orphanLongLeaveSaving ? "Saving..." : (orphanAgentAction === "long_leave" ? (orphanLongLeaveStep === 1 && orphanLongLeaveId ? "Save Details" : (orphanLongLeaveStep === 2 ? "Confirm Orphans" : "Next")) : (orphanResignationStep === 2 ? "Confirm Orphans" : (orphanResignationId ? "Save Details" : "Next")))}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="manager-refresh-btn"
                          disabled={orphanAgentAction === "long_leave" ? (!canAccessLongLeaveStep3 || orphanLongLeaveStatus === "Endorsed" || orphanLongLeaveSaving) : (orphanResignationStatus === "Endorsed" || orphanLongLeaveSaving || orphanResignationStep < 3)}
                          onClick={orphanAgentAction === "long_leave" ? endorseLongLeaveOrphans : endorseResignationOrphans}
                        >
                          {orphanLongLeaveSaving ? "Endorsing..." : (orphanAgentAction === "long_leave" ? "Endorse Orphans" : "Endorse Orphans")}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                <div className="manager-panel__head manager-agent-profile-head">
                  <div className="manager-agent-photo-wrap">
                    {selectedAgent.displayPhoto ? (
                      <img src={selectedAgent.displayPhoto} alt={`${selectedAgent.name || selectedAgent.username} display`} className="manager-agent-photo" />
                    ) : (
                      <div className="manager-agent-photo manager-agent-photo--placeholder">{String(selectedAgent.name || selectedAgent.username || "A").charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <div>
                    <h2 className="manager-agent-title">
                      <span>{selectedAgent.name || "Agent Details"}</span>
                      {renderAgentStatusPill(selectedAgent)}
                    </h2>
                    <p>{selectedAgent.username || "—"} • {selectedAgent.agentType || "—"} • {selectedAgent.unit || "Unassigned Unit"}</p>
                  </div>
                  {!selectedAgentIsResigned && (
                    <div className="manager-orphan-agent-actions">
                      <button type="button" className="manager-refresh-btn" onClick={() => openOrphanAgentAction("long_leave")} disabled={disableOrphanStatusActions} title={disabledOrphanStatusActionHint}>Mark as On Long Leave</button>
                      <button type="button" className="manager-refresh-btn" onClick={() => openOrphanAgentAction("resigned")} disabled={disableOrphanStatusActions} title={disabledOrphanStatusActionHint}>Mark as Resigned</button>
                    </div>
                  )}
                </div>

                <div className="manager-agent-detail-grid manager-agent-detail-grid--profile">
                  <article><span>Sex</span><strong>{selectedAgent.sex || "—"}</strong></article>
                  <article><span>Birthday</span><strong>{selectedAgent.birthday ? formatDate(selectedAgent.birthday) : "—"}</strong></article>
                  <article><span>Age</span><strong>{selectedAgentAge ?? "—"}</strong></article>
                  <article><span>Date Employed as Agent</span><strong>{selectedAgent.dateEmployed ? formatDate(selectedAgent.dateEmployed) : "—"}</strong></article>
                </div>

                <div className="manager-section-subhead">
                  <h3>Promotion History</h3>
                  <p>Full promotion history recorded for this agent.</p>
                </div>
                {selectedAgentPromotionHistory.length ? (
                  <div className="manager-promotion-table-wrap">
                    <table className="manager-table manager-table--promotion-history">
                      <thead>
                        <tr>
                          <th>Promoted Role</th>
                          <th>Date Promoted</th>
                          <th>Manager Username</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAgentPromotionHistory.map((promotion, index) => (
                          <tr key={`${promotion?.datePromoted || index}-${promotion?.role || "role"}`}>
                            <td>{formatPromotionRole(promotion?.role)}</td>
                            <td>{promotion?.datePromoted ? formatDate(promotion.datePromoted) : "—"}</td>
                            <td>{promotion?.managerUsername || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="manager-empty-state">No promotion history recorded for this agent.</div>
                )}

                <div className="manager-section-subhead">
                  <h3>Long Leave Records</h3>
                  <p>Initial long-leave details and orphan clients endorsement status recorded for this agent.</p>
                </div>
                {selectedAgentLeaveRecords.length ? (
                  <div className="manager-promotion-table-wrap">
                    <table className="manager-table manager-table--promotion-history manager-table--clickable">
                      <thead>
                        <tr>
                          <th>Leave Start Date</th>
                          <th>Leave End Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAgentLeaveRecords.map((leaveRecord) => (
                          <tr key={leaveRecord.id} data-long-leave-id={leaveRecord.id} onClick={() => openSavedLongLeaveRecord(leaveRecord)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openSavedLongLeaveRecord(leaveRecord); }}>
                            <td>{formatDate(leaveRecord.leaveStartDate)}</td>
                            <td>{formatDate(leaveRecord.leaveEndDate)}</td>
                            <td>{leaveRecord.status || "Recorded"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="manager-empty-state">No long leave records recorded for this agent.</div>
                )}

                <div className="manager-section-subhead">
                  <h3>Resignation Records</h3>
                  <p>Resignation details and orphan clients endorsement status recorded for this agent.</p>
                </div>
                {selectedAgentResignationRecords.length ? (
                  <div className="manager-promotion-table-wrap">
                    <table className="manager-table manager-table--promotion-history manager-table--clickable">
                      <thead><tr><th>Resignation Date</th><th>Status</th></tr></thead>
                      <tbody>
                        {selectedAgentResignationRecords.map((resignationRecord) => (
                          <tr key={resignationRecord.id} onClick={() => openSavedResignationRecord(resignationRecord)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openSavedResignationRecord(resignationRecord); }}>
                            <td>{formatDate(resignationRecord.resignationDate)}</td>
                            <td>{resignationRecord.status || "Recorded"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="manager-empty-state">No resignation records recorded for this agent.</div>}
                  </>
                )}
              </section>
            ) : (
              <section className="manager-panel">
                <nav className="manager-breadcrumb manager-breadcrumb--agent" aria-label="Orphan client management breadcrumb">
                  <button type="button" onClick={() => { setActiveView("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{scope.branchName || "Branch"}</button>
                  <span>&gt;</span>
                  <strong>All Agents</strong>
                </nav>
                <div className="manager-panel__head manager-panel__head--orphan">
                  <div>
                    <h2 className="manager-orphan-title">Orphan Client Management</h2>
                    <p>Review all agents under {scope.branchName || "this branch"} before managing orphan client relationships.</p>
                  </div>
                </div>
                <div className="manager-toolbar manager-toolbar--orphan">
                  <div className="manager-toolbar__filters">
                    <label className="manager-search manager-orphan-search" htmlFor="manager-orphan-agent-search">
                      <FaSearch size={14} />
                      <input
                        id="manager-orphan-agent-search"
                        type="search"
                        placeholder="Search by username or agent name"
                        value={orphanAgentSearch}
                        onChange={(e) => setOrphanAgentSearch(e.target.value)}
                      />
                    </label>
                    <label className="manager-select manager-orphan-control manager-orphan-control--type" htmlFor="manager-orphan-agent-type-filter">
                      <span>Agent Type</span>
                      <select id="manager-orphan-agent-type-filter" value={orphanAgentTypeFilter} onChange={(e) => setOrphanAgentTypeFilter(e.target.value)}>
                        <option value="ALL">All Agent Types</option>
                        {orphanAgentTypeOptions.map((agentType) => <option key={agentType} value={agentType}>{agentType}</option>)}
                      </select>
                    </label>
                    <label className="manager-select manager-orphan-control manager-orphan-control--unit" htmlFor="manager-orphan-unit-filter">
                      <span>Unit Name</span>
                      <select id="manager-orphan-unit-filter" value={orphanUnitFilter} onChange={(e) => setOrphanUnitFilter(e.target.value)}>
                        <option value="ALL">All Units</option>
                        {orphanUnitOptions.map((unitName) => <option key={unitName} value={unitName}>{unitName}</option>)}
                      </select>
                    </label>
                    <label className="manager-select manager-orphan-control manager-orphan-control--status" htmlFor="manager-orphan-status-filter">
                      <span>Agent Status</span>
                      <select id="manager-orphan-status-filter" value={orphanStatusFilter} onChange={(e) => setOrphanStatusFilter(e.target.value)}>
                        <option value="ALL">All Statuses</option>
                        {orphanStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                    <label className="manager-select manager-orphan-control manager-orphan-control--sort" htmlFor="manager-orphan-sort">
                      <span>Sort By</span>
                      <select id="manager-orphan-sort" value={orphanAgentSort} onChange={(e) => setOrphanAgentSort(e.target.value)}>
                        <option value="usernameAsc">Username (A → Z)</option>
                        <option value="usernameDesc">Username (Z → A)</option>
                        <option value="nameAsc">Agent Name (A → Z)</option>
                        <option value="nameDesc">Agent Name (Z → A)</option>
                        <option value="dateEmployedAsc">Date Employed (Oldest → Newest)</option>
                        <option value="dateEmployedDesc">Date Employed (Newest → Oldest)</option>
                      </select>
                    </label>
                    <button type="button" className="manager-clear-btn manager-clear-btn--orphan" onClick={clearOrphanAgentControls}>Clear</button>
                  </div>
                </div>
                <div className="manager-table-scroll-top manager-table-scroll-top--orphan" ref={orphanTableTopScrollRef} onScroll={() => syncOrphanTableScroll("top")}>
                  <div className="manager-table-scroll-top__inner manager-table-scroll-top__inner--orphan" />
                </div>
                <div className="manager-table-wrap manager-table-wrap--orphan" ref={orphanTableScrollRef} onScroll={() => syncOrphanTableScroll("table")}>
                  <table className="manager-table manager-table--clickable manager-table--orphan">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Agent Name</th>
                        <th>Agent Type</th>
                        <th>Agent Status</th>
                        <th>Unit Name</th>
                        <th>Date Employed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orphanAgentRows.map((agent) => (
                        <tr key={agent.id} onClick={() => openAgentDetails(agent.id)} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openAgentDetails(agent.id); }}>
                          <td>{agent.username || "—"}</td>
                          <td>{agent.name || "—"}</td>
                          <td>{agent.agentType || "—"}</td>
                          <td>{renderAgentStatusPill(agent, { table: true })}</td>
                          <td>{agent.unit || "—"}</td>
                          <td>{agent.dateEmployed ? formatDate(agent.dateEmployed) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!orphanAgentRows.length && <div className="manager-empty-state">No agents found for this branch yet.</div>}
              </section>
            )
          )}

          {!isLoading && !loadError && activeView === "kpi_assignment" && normalizedRole === "BM" && (
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
                      ? `Assign or unassign branch-level KPI sets for all agents in ${scope.branchName || "the branch"}, all units in ${scope.branchName || "the branch"}, and ${scope.branchName || "the branch"} itself.`
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
                        if (["AGENT", "UNIT", "BRANCH"].includes(assignment.scopeType)) {
                          const selectedMonth = kpiSelectedMonths[rowKey] || activeCurrentKpiMonth;
                          const monthAssignment = getMonthlyKpiAssignment(kpi, selectedMonth);
                          const canEditMonth = [activeCurrentKpiMonth, activeNextKpiMonth].includes(selectedMonth);
                          return (
                            <div className={`manager-kpi-edit-row manager-kpi-edit-row--agent ${isEditing ? "editing" : ""} ${isExpanded ? "expanded" : ""}`} key={kpi.key}>
                              <div className="manager-kpi-edit-row__head">
                                <button type="button" className="manager-kpi-collapse-btn" aria-expanded={isExpanded} onClick={() => setExpandedKpiKey(isExpanded ? "" : rowKey)}>
                                  <span className="manager-kpi-caret">{isExpanded ? "−" : "+"}</span>
                                  <span className="manager-kpi-name">
                                    <strong>{formatKpiLabel(kpi, assignment.scopeType)}</strong>
                                    <span>{formatScopeLabel(assignment.scopeType)} • {kpi.valueType}</span>
                                  </span>
                                </button>
                                <div className="manager-kpi-row-actions">
                                  <div className="manager-kpi-agent-toggle-stack">
                                    <button
                                      type="button"
                                      className={`manager-kpi-toggle ${monthAssignment.assigned === true ? "assigned" : ""}`}
                                      disabled={!kpiData?.canEdit || !isEditing || !canEditMonth}
                                      onClick={() => updateAgentMonthlyKpiDraft(assignment, kpi.key, "assigned", monthAssignment.assigned !== true)}
                                    >
                                      {monthAssignment.assigned === true ? "Assigned" : "Unassigned"}
                                    </button>
                                    {!canEditMonth ? <span className="manager-kpi-readonly-label">Historical record</span> : null}
                                  </div>
                                  {kpiData?.canEdit && canEditMonth ? (isEditing ? (
                                    <>
                                      <button type="button" className="manager-refresh-btn" onClick={() => cancelKpiEdit(assignment, kpi.key)} disabled={isSaving}>Cancel</button>
                                      <button type="button" className="manager-refresh-btn" onClick={() => saveKpi(assignment, kpi.key)} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>
                                    </>
                                  ) : <button type="button" className="manager-refresh-btn" onClick={() => { setEditingKpiKey(rowKey); setExpandedKpiKey(rowKey); }}>Edit</button>) : null}
                                </div>
                              </div>
                              {isExpanded ? <div className="manager-kpi-month-editor">
                                <label className="manager-select manager-kpi-month-select">
                                  <span>Assignment Month</span>
                                  <select disabled={isEditing || isSaving} value={selectedMonth} onChange={(event) => { setKpiSelectedMonths((current) => ({ ...current, [rowKey]: event.target.value })); setKpiFieldErrors((current) => ({ ...current, [rowKey]: {} })); }}>
                                    {activeKpiMonthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                                  </select>
                                </label>
                                <div className="manager-kpi-frequency-grid manager-kpi-month-target-grid">
                                {monthAssignment.assigned === true ? (
                                  <div className="manager-kpi-frequency-card">
                                    <div className="manager-kpi-frequency-card__head"><strong>Monthly Target</strong></div>
                                    {["targetValue", "targetMin", "targetMax"].map((field) => (
                                      <label key={field}>
                                        <span>{field === "targetValue" ? "Target" : field === "targetMin" ? "Min" : "Max"}</span>
                                        <input
                                          className={`manager-kpi-input ${rowErrors[field] ? "has-error" : ""}`}
                                          type="number"
                                          step="1"
                                          value={monthAssignment[field] ?? ""}
                                          disabled={!isEditing || !canEditMonth}
                                          onChange={(event) => updateAgentMonthlyKpiDraft(assignment, kpi.key, field, event.target.value)}
                                        />
                                        {rowErrors[field] ? <em className="manager-kpi-field-error">{rowErrors[field]}</em> : null}
                                      </label>
                                    ))}
                                    <div className="manager-kpi-target-display"><span>Display Target</span><strong>{formatRequiredKpiTarget({ ...monthAssignment, valueType: kpi.valueType })}</strong></div>
                                  </div>
                                ) : <div className="manager-empty-state">Unassigned for this month. Target remains blank.</div>}
                                </div>
                              </div>
                              : null}
                            </div>
                          );
                        }
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

          {!isLoading && !loadError && activeView === "dashboard" && normalizedRole !== "BM" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <div>
                  <h2>Unit KPI Progress</h2>
                  <p>View actual unit KPI performance against assigned targets.</p>
                </div>
              </div>
              {dashboardUnitKpiCards.length ? (
                <div className="manager-toolbar manager-kpi-toolbar manager-kpi-toolbar--end">
                  <label className="manager-select manager-select--unit-date" htmlFor="manager-unit-kpi-date-preset">
                    <span>Date Range</span>
                    <select
                      id="manager-unit-kpi-date-preset"
                      value={unitKpiDatePreset}
                      onChange={(e) => setUnitKpiDatePreset(e.target.value)}
                    >
                      {DATE_PRESETS.filter((option) => option.value !== "ALL").map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="manager-report-btn" onClick={generateUnitKpiPdfReport}>
                    <FaFilePdf size={15} />
                    <span>Generate Report (PDF)</span>
                  </button>
                </div>
              ) : null}
              <div className="manager-kpi-progress-grid">
                {dashboardUnitKpiCards.map(({ kpi, actual, comparison, dateRangeLabel }) => (
                  <article className={`manager-kpi-progress-card ${comparison.className}`} key={`dashboard-unit:${kpi.key}`}>
                    <span>{selectedUnit?.name || scope.unitName || "Unit"}</span>
                    <strong>{formatKpiLabel(kpi, "UNIT")}</strong>
                    <p>{kpi.period} • {dateRangeLabel}</p>
                    <div className="manager-kpi-progress-values">
                      <div><small>Actual Progress</small><b>{formatActualKpiValue(actual, kpi.valueType)}</b></div>
                      <div><small>Assigned Target</small><b>{formatKpiTarget(kpi)}</b></div>
                    </div>
                    <div className="manager-kpi-progress-bar" aria-label={`${formatKpiLabel(kpi, "UNIT")} progress ${comparison.percent}%`}>
                      <span style={{ width: `${Math.max(0, Math.min(comparison.percent, 140))}%` }} />
                    </div>
                    <em>{comparison.status}</em>
                    <small className="manager-kpi-gap-note">{comparison.deltaLabel}</small>
                  </article>
                ))}
              </div>
              {!dashboardUnitKpiCards.length ? (
                <div className="manager-empty-state">No KPIs assigned for unit.</div>
              ) : (
                <>
                <div className="manager-kpi-unit-drilldown">
                  <h3>Agent Drilldown</h3>
                  {unitKpiSalesAgents.length ? (
                    <ul className="manager-kpi-agent-list">
                      {unitKpiSalesAgents.map((agent) => (
                        <li key={`dashboard-unit-top-agent:${agent.id}`}>
                          <button type="button" className="manager-kpi-agent-link" onClick={() => openAgentDetails(agent.id)}>
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
                {unitBranchSalesContribution ? (
                  <div className="manager-kpi-unit-drilldown">
                    <h3>Contribution in Branch Sales Production</h3>
                    <div className="manager-kpi-progress-grid">
                      <article className={`manager-kpi-progress-card ${unitBranchSalesContribution.comparison.className}`}>
                        <span>{unitBranchSalesContribution.dateRangeLabel} • {unitBranchSalesContribution.kpi.period}</span>
                        <strong>{selectedUnit?.name || scope.unitName || "Unit"}</strong>
                        <div className="manager-kpi-progress-values">
                          <div><small>Unit Sales Production</small><b>{formatMoney(unitBranchSalesContribution.actual)}</b></div>
                          <div><small>Branch KPI Target</small><b>{formatKpiTarget(unitBranchSalesContribution.kpi)}</b></div>
                        </div>
                        <small className="manager-kpi-gap-note">Branch sales production achieved: {formatMoney(unitBranchSalesContribution.branchActual)} • Unit contribution share: {unitBranchSalesContribution.contributionShare}%</small>
                        <div className="manager-kpi-progress-bar" aria-label={`Branch sales production progress ${unitBranchSalesContribution.comparison.percent}%`}>
                          <span style={{ width: `${Math.max(0, Math.min(unitBranchSalesContribution.comparison.percent, 140))}%` }} />
                        </div>
                        <em>{unitBranchSalesContribution.comparison.status}</em>
                        <small className="manager-kpi-gap-note">{unitBranchSalesContribution.comparison.deltaLabel}</small>
                      </article>
                    </div>
                  </div>
                ) : null}
                </>
              )}
            </section>
          )}

          {!isLoading && !loadError && activeView === "dashboard" && normalizedRole === "BM" && (
            <section className="manager-panel">
              <div className="manager-panel__head">
                <div>
                  <h2>Branch KPI Progress</h2>
                  <p>View actual branch KPI performance against assigned targets.</p>
                </div>
              </div>
              {branchKpiProgressRows.length ? (
                <div className="manager-toolbar manager-kpi-toolbar manager-kpi-toolbar--end">
                  <label className="manager-select manager-select--unit-date" htmlFor="manager-branch-kpi-date-preset">
                    <span>Date Range</span>
                    <select
                      id="manager-branch-kpi-date-preset"
                      value={branchKpiDatePreset}
                      onChange={(e) => setBranchKpiDatePreset(e.target.value)}
                    >
                      {branchKpiDateOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="manager-report-btn" onClick={generateKpiPdfReport}>
                    <FaFilePdf size={15} />
                    <span>Generate Report (PDF)</span>
                  </button>
                </div>
              ) : null}
              {kpiLoading && <div className="manager-empty-state">Loading KPI progress...</div>}
              {kpiMessage && <div className="manager-filter-note">{kpiMessage}</div>}
              <div className="manager-kpi-progress-grid">
                {branchKpiProgressRows.map(({ assignment, kpi, actual, targetBasis, targetBasisLabel, productionActual, dateRangeLabel }) => {
                  const comparison = getKpiComparison(actual, kpi);
                  const barPercent = Math.max(0, Math.min(comparison.percent, 140));
                  return (
                    <article className={`manager-kpi-progress-card ${comparison.className}`} key={`${assignment.scopeType}:${assignment.scopeId}:${kpi.key}`}>
                      <span>{assignment.name}</span>
                      <strong>{formatKpiLabel(kpi, assignment.scopeType)}</strong>
                      <p>{kpi.period} • {dateRangeLabel}</p>
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
                      {kpi.key === "monthly_target_achievement_index" && targetBasis ? (
                        <small className="manager-kpi-gap-note">Actual sales production achieved: {formatMoney(productionActual)} • Sales production target for {kpi.period}: {targetBasisLabel || formatMoney(targetBasis)}</small>
                      ) : null}
                      <div className="manager-kpi-progress-bar" aria-label={`${formatKpiLabel(kpi, assignment.scopeType)} progress ${comparison.percent}%`}>
                        <span style={{ width: `${barPercent}%` }} />
                      </div>
                      <em>{comparison.status}</em>
                      <small className="manager-kpi-gap-note">{comparison.deltaLabel}</small>
                    </article>
                  );
                })}
              </div>
              {!kpiLoading && !branchKpiProgressRows.length && <div className="manager-empty-state">No KPIs assigned.</div>}
              {branchKpiProgressRows.length ? (
                <>
              {branchKpiUnitFields.length ? (
                <div className="manager-kpi-unit-drilldown">
                  <h3>Unit Drilldown</h3>
                  <div className="manager-kpi-unit-grid">
                    {branchKpiUnitRows.map((unit) => (
                      <article key={unit.unit}>
                        <strong>{unit.unit}</strong>
                        {branchKpiUnitFields.map((field) => (
                          <span key={`${unit.unit}:${field.key}`}>{field.dashboardLabel}: {field.render(unit)}</span>
                        ))}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              {branchHasSalesProductionKpi ? (
                <div className="manager-kpi-unit-drilldown">
                  <h3>Agent Drilldown</h3>
                  <div className="manager-kpi-unit-grid">
                    {branchKpiUnitRows.map((unit) => (
                      <article key={`agent-drilldown:${unit.unit}`}>
                        <strong>{unit.unit}</strong>
                        {unit.topAgents.length ? (
                          <ul className="manager-kpi-agent-list manager-kpi-agent-list--compact">
                            {unit.topAgents.map((agent) => (
                              <li key={`branch-unit-agent:${unit.unit}:${agent.id}`}>
                                <button type="button" className="manager-kpi-agent-link" onClick={() => openAgentDetails(agent.id)}>
                                  <strong>{agent.username}</strong>
                                  <span>{agent.name || agent.username}</span>
                                </button>
                                <b>{formatMoney(agent.annualPremium)}</b>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <small>No contributing agents for this date range.</small>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
                </>
              ) : null}
            </section>
          )}

        </main>
      </div>

      {reassignmentSuccess && (
        <div className="manager-modal-backdrop" role="presentation">
          <div className="manager-endorse-modal" role="dialog" aria-modal="true" aria-labelledby="reassignment-success-title">
            <button type="button" className="manager-endorse-modal__x" onClick={() => setReassignmentSuccess(null)} aria-label="Close reassignment confirmation">×</button>
            <div className="manager-endorse-modal__header">
              <h2 id="reassignment-success-title">Reassignment confirmed</h2>
              <p>{reassignmentSuccess.message}</p>
            </div>
            <div className="manager-endorse-modal__actions">
              <button type="button" className="manager-refresh-btn manager-long-leave-next-btn" onClick={() => setReassignmentSuccess(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {showEndorseOrphansModal && (
        <div className="manager-modal-backdrop" role="presentation">
          <div className="manager-endorse-modal" role="dialog" aria-modal="true" aria-labelledby="endorse-orphans-title">
            <button type="button" className="manager-endorse-modal__x" onClick={closeEndorseOrphansModal} aria-label="Close endorsement confirmation">×</button>
            <div className="manager-endorse-modal__header">
              <h2 id="endorse-orphans-title">Confirm orphan endorsement</h2>
              <p>{orphanAgentAction === "resigned" ? "Review the resignation details and orphan clients before endorsement." : "Review the long leave details and selected orphan clients before endorsement."}</p>
            </div>

            <div className="manager-endorse-modal__content">
              <section>
                <h3>Agent Assignment</h3>
                <dl className="manager-endorse-detail-grid manager-endorse-detail-grid--compact">
                  <div><dt>Unit Name</dt><dd>{selectedAgentUnitManager.unitName}</dd></div>
                  <div><dt>Agent Code</dt><dd>{selectedAgent?.username || "—"}</dd></div>
                  <div><dt>Agent Name</dt><dd>{selectedAgent?.name || "—"}</dd></div>
                </dl>
              </section>

              {orphanAgentAction === "resigned" ? (
                <>
                  <section>
                    <h3>Resignation Details</h3>
                    <dl className="manager-endorse-detail-grid">
                      <div><dt>Resignation Date</dt><dd>{formatDate(orphanResignationDate)}</dd></div>
                      <div><dt>Accomplished Resignation Letter</dt><dd>{orphanResignationLetter?.fileName || "—"}</dd></div>
                      <div><dt>Proof of Approved Resignation</dt><dd>{orphanApprovedResignationProof?.fileName || "—"}</dd></div>
                    </dl>
                  </section>
                  <section>
                    <h3>List of All Prospects</h3>
                    {resignationAffectedProspects.length ? (
                      <div className="manager-table-wrap">
                        <table className="manager-table manager-table--promotion-history">
                          <thead><tr><th>Prospect Code</th><th>Prospect Name</th><th>Leads</th><th>Policies</th></tr></thead>
                          <tbody>
                            {resignationAffectedProspects.map((prospect) => (
                              <tr key={`modal-resignation-${prospect.id || prospect.prospectId || prospect.prospectCode}`}>
                                <td>{prospect.prospectCode || "—"}</td>
                                <td>{prospect.name || "—"}</td>
                                <td>{(prospect.leads || []).map((lead) => lead.leadCode || "—").join(", ") || "—"}</td>
                                <td>{(prospect.policies || []).map((policy) => policy.policyholderCode || "—").join(", ") || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="manager-endorse-empty">No prospects recorded.</p>}
                  </section>
                </>
              ) : (
                <>
                  <section>
                    <h3>Long Leave Details</h3>
                    <dl className="manager-endorse-detail-grid">
                      <div><dt>Leave Start Date</dt><dd>{formatDate(orphanLeaveStartDate)}</dd></div>
                      <div><dt>Leave End Date</dt><dd>{formatDate(orphanLeaveEndDate)}</dd></div>
                      <div><dt>Leave Application Form</dt><dd>{orphanLeaveApplicationForm?.fileName || "—"}</dd></div>
                      <div><dt>Proof of Approved Leave</dt><dd>{orphanApprovedLeaveProof?.fileName || "—"}</dd></div>
                    </dl>
                  </section>
                  <section>
                    <h3>Prospects with Active Leads</h3>
                    {displayedConfirmedProspects.length ? (
                      <div className="manager-endorse-list">
                        {displayedConfirmedProspects.map((prospect) => (
                          <div key={`modal-prospect-${prospect.id}`}>
                            <strong>{prospect.name || "—"}</strong>
                            <span>{prospect.prospectCode || "—"} • {prospect.leadCode || "—"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="manager-endorse-empty">No prospects with active leads selected.</p>
                    )}
                  </section>
                  {includeOngoingPolicyholders && (
                    <section>
                      <h3>Policyholders with Ongoing Policies</h3>
                      {displayedConfirmedPolicyholders.length ? (
                        <div className="manager-endorse-list">
                          {displayedConfirmedPolicyholders.map((policyholder) => (
                            <div key={`modal-policyholder-${policyholder.id}`}>
                              <strong>{policyholder.policyholderName || "—"}</strong>
                              <span>{policyholder.policyholderCode || "—"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="manager-endorse-empty">No policyholders with ongoing policies selected.</p>
                      )}
                    </section>
                  )}
                </>
              )}

              <section>
                <h3>Endorsement To</h3>
                <dl className="manager-endorse-detail-grid manager-endorse-detail-grid--compact">
                  <div><dt>Unit Name</dt><dd>{selectedAgentUnitManager.unitName}</dd></div>
                  <div><dt>UM Code</dt><dd>{selectedAgentUnitManager.code}</dd></div>
                  <div><dt>UM Name</dt><dd>{selectedAgentUnitManager.name}</dd></div>
                </dl>
              </section>

              {orphanLongLeaveFieldErrors.form && <small className="manager-field-error">{orphanLongLeaveFieldErrors.form}</small>}
            </div>

            <div className="manager-endorse-modal__actions">
              <button type="button" className="manager-refresh-btn" onClick={closeEndorseOrphansModal} disabled={orphanLongLeaveSaving}>Cancel</button>
              <button type="button" className="manager-refresh-btn manager-long-leave-next-btn" onClick={orphanAgentAction === "resigned" ? confirmEndorseResignationOrphans : confirmEndorseLongLeaveOrphans} disabled={orphanLongLeaveSaving}>
                {orphanLongLeaveSaving ? "Confirming..." : "Confirm Endorsement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagerPortal;