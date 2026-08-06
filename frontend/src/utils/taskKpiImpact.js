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

export const getTaskKpiImpact = (taskType, assignedKpis = []) => {
  const kpiKey = KPI_KEY_BY_TASK_TYPE[String(taskType || "").toUpperCase()];
  if (!kpiKey) return null;
  const kpi = assignedKpis.find((item) => item?.key === kpiKey);
  if (!kpi) return null;

  const target = [kpi.targetValue, kpi.targetMin, kpi.targetMax]
    .map(Number)
    .find((value) => Number.isFinite(value) && value > 0);
  if (!target) return null;
  const actual = Number(kpi.actual || 0);
  const projected = actual + 1;
  return {
    label: kpi.label || String(taskType || "").replaceAll("_", " "),
    actual,
    projected,
    target,
    currentPct: Math.min(100, Math.round((actual / target) * 100)),
    projectedPct: Math.min(100, Math.round((projected / target) * 100)),
  };
};
