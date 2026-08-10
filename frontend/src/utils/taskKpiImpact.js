const KPI_KEY_BY_TASK_TYPE = {
  APPROACH: "weekly_approaches",
  APPOINTMENT: "weekly_appointments",
  PRESENTATION: "weekly_presentations",
};

export const currentManilaMonth = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
};

const finitePositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export const getKpiTargetRules = (kpi = {}) => {
  const fixed = finitePositiveNumber(kpi.targetValue);
  const min = finitePositiveNumber(kpi.targetMin);
  const max = finitePositiveNumber(kpi.targetMax);
  if (fixed) return { basis: fixed, min: fixed, max: fixed, kind: "fixed", canExceed: true };
  if (min && max) return { basis: max, min, max, kind: "range", canExceed: true };
  if (min) return { basis: min, min, max: null, kind: "minimum", canExceed: false };
  if (max) return { basis: max, min: null, max, kind: "maximum", canExceed: true };
  return { basis: null, min: null, max: null, kind: "none", canExceed: false };
};

export const formatTaskKpiTarget = (kpi = {}) => {
  const formatValue = (value) => Number(value || 0).toLocaleString();
  const { kind, min, max, basis } = getKpiTargetRules(kpi);
  if (!basis) return "No target set";
  if (kind === "range") return `${formatValue(min)} - ${formatValue(max)}`;
  if (kind === "minimum") return `${formatValue(min)} and above`;
  if (kind === "maximum") return `Up to ${formatValue(max)}`;
  return formatValue(basis);
};

export const getKpiProgressPercent = (actualValue, targetRules = getKpiTargetRules({})) => {
  const actual = Number(actualValue || 0);
  if (!targetRules?.basis) return 0;
  if (targetRules.kind === "range") {
    if (actual < targetRules.min) return Math.round((actual / targetRules.min) * 100);
    if (actual <= targetRules.max) return 100;
    return Math.round((actual / targetRules.max) * 100);
  }
  if (targetRules.kind === "minimum") {
    return actual >= targetRules.min ? 100 : Math.round((actual / targetRules.min) * 100);
  }
  return Math.round((actual / targetRules.basis) * 100);
};

export const getTaskKpiImpact = (taskType, assignedKpis = [], task = {}) => {
  const kpiKey = KPI_KEY_BY_TASK_TYPE[String(taskType || "").toUpperCase()];
  if (!kpiKey) return null;
  const kpi = assignedKpis.find((item) => item?.key === kpiKey);
  if (!kpi) return null;

  const targetRules = getKpiTargetRules(kpi);
  if (!targetRules.basis) return null;
  const actual = Number(kpi.actual || 0);
  const isCompleted = String(task?.status || task?.uiStatus || "").toLowerCase() === "done";
  const projected = isCompleted ? actual : actual + 1;
  const currentPct = getKpiProgressPercent(actual, targetRules);
  const projectedPct = getKpiProgressPercent(projected, targetRules);
  const isTargetReached = targetRules.min !== null ? actual >= targetRules.min : actual <= targetRules.max;
  const isExceeded = targetRules.canExceed && targetRules.max !== null && actual > targetRules.max;
  return {
    label: kpi.label || String(taskType || "").replaceAll("_", " "),
    actual,
    projected,
    target: targetRules.basis,
    targetLabel: formatTaskKpiTarget(kpi),
    targetRules,
    isCompleted,
    isTargetReached,
    isExceeded,
    successMessage: isCompleted && isExceeded
      ? "Completed — this task is already counted and the related KPI has exceeded its assigned target."
      : isTargetReached
        ? "Completed — the related KPI target has already been reached for this period."
        : "",
    currentPct,
    projectedPct,
  };
};