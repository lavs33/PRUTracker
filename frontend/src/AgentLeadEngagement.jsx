import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentLeadEngagement.css";
import { PH_CITY_REGION_OPTIONS, CITY_TO_REGION } from "./constants/phCityRegionOptions";

function AgentLeadEngagement() {
  const navigate = useNavigate();
  const { username, prospectId, leadId } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  // page state
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [prospect, setProspect] = useState(null);
  const [lead, setLead] = useState(null);
  const [engagement, setEngagement] = useState(null);

  // ✅ Add Attempt UI
  const [showAddAttempt, setShowAddAttempt] = useState(false);
  const [addingAttempt, setAddingAttempt] = useState(false);
  const [attemptErrors, setAttemptErrors] = useState({});
  const [attemptForm, setAttemptForm] = useState({
    primaryChannel: "",
    otherChannels: [],
    response: "",
    attemptedAtLabel: "", // display only (non-editable)
    notes: "",
  });

  const [validateForm, setValidateForm] = useState({ phoneValidation: "" });
  const [validatingContact, setValidatingContact] = useState(false);
  const [validateError, setValidateError] = useState("");

  const [interestForm, setInterestForm] = useState({
    interestLevel: "",
    preferredChannel: "",
    preferredChannelOther: "",
  });
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestError, setInterestError] = useState("");

  const [meetingForm, setMeetingForm] = useState({
    meetingDate: "",
    meetingStartTime: "",
    meetingDurationMin: 120,
    meetingMode: "",
    meetingPlatform: "",
    meetingPlatformOther: "",
    meetingLink: "",
    meetingInviteSent: false,
    meetingPlace: "",
  });
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [meetingError, setMeetingError] = useState("");

  const [needsAssessmentLoading, setNeedsAssessmentLoading] = useState(false);
  const [needsAssessmentSaving, setNeedsAssessmentSaving] = useState(false);
  const [needsAssessmentError, setNeedsAssessmentError] = useState("");
  const [needsAssessmentSavedAt, setNeedsAssessmentSavedAt] = useState("");
  const [needsAssessmentCurrentActivityKey, setNeedsAssessmentCurrentActivityKey] = useState("Record Prospect Attendance");
  const [needsAssessmentOutcomeActivity, setNeedsAssessmentOutcomeActivity] = useState("");
  const [needsSectionOpen, setNeedsSectionOpen] = useState({
    basicInformation: true,
    needsPriorities: true,
  });
  const [needsAssessmentForm, setNeedsAssessmentForm] = useState({
    attendanceChoice: "",
    basicInformation: {
      fullName: "",
      sex: "",
      civilStatus: "",
      birthday: "",
      age: "",
      occupationCategory: "Not Employed",
      occupation: "",
      addressLine: "",
      barangay: "",
      city: "",
      otherCity: "",
      region: "",
      zipCode: "",
      country: "Philippines",
    },
    dependents: [],
    needsPriorities: {
      currentPriority: "",
      monthlyIncomeBand: "",
      monthlyIncomeAmount: "",
      minPremium: "",
      maxPremium: "",
      protection: {
        monthlySpend: "",
        numberOfDependents: "",
        yearsToProtectIncome: "",
        savingsForProtection: "",
        protectionGap: "",
      },
      health: {
        amountToCoverCriticalIllness: "",
        savingsForCriticalIllness: "",
        criticalIllnessGap: "",
      },
      investment: {
        savingsPlan: "",
        savingsPlanOther: "",
        targetSavingsAmount: "",
        targetUtilizationYear: "",
        savingsForInvestment: "",
        savingsGap: "",
        riskProfiler: {
          investmentHorizon: "",
          investmentGoal: "",
          marketExperience: "",
          volatilityReaction: "",
          capitalLossAffordability: "",
          riskReturnTradeoff: "",
          riskProfileScore: "",
          riskProfileCategory: "",
        },
      },
    },
    existingPolicies: [],
  });

  const [selectedStageView, setSelectedStageView] = useState("CURRENT");

  const [bookedWindows, setBookedWindows] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const computeAgeFromBirthday = (dateStr) => {
    if (!dateStr) return null;
    const b = new Date(dateStr);
    if (Number.isNaN(b.getTime())) return null;
    const today = new Date();
    let yrs = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) yrs -= 1;
    return yrs;
  };

  const toDateInputValue = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const toNonNegativeNumber = useCallback((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, []);

  const resolveApproxIncome = useCallback((band, manualAmount) => {
    if (band === "BELOW_15000" || band === "ABOVE_500000") return toNonNegativeNumber(manualAmount);
    const map = {
      "15000_29999": 29999,
      "30000_49999": 49999,
      "50000_79999": 79999,
      "80000_99999": 99999,
      "100000_249999": 249999,
      "250000_499999": 499999,
    };
    return map[band] ?? null;
  }, [toNonNegativeNumber]);

  const addDependent = () => {
    setNeedsAssessmentForm((f) => ({
      ...f,
      dependents: [
        ...(Array.isArray(f.dependents) ? f.dependents : []),
        { name: "", age: "", gender: "", relationship: "" },
      ],
    }));
  };

  const removeDependent = (idx) => {
    setNeedsAssessmentForm((f) => ({
      ...f,
      dependents: (Array.isArray(f.dependents) ? f.dependents : []).filter((_, i) => i !== idx),
    }));
  };

  const updateDependent = (idx, key, value) => {
    setNeedsAssessmentForm((f) => ({
      ...f,
      dependents: (Array.isArray(f.dependents) ? f.dependents : []).map((d, i) =>
        i === idx ? { ...d, [key]: value } : d
      ),
    }));
  };

  const updateNeedsPriorities = (key, value) => {
    setNeedsAssessmentForm((f) => ({
      ...f,
      needsPriorities: { ...(f.needsPriorities || {}), [key]: value },
    }));
  };

  const updateNeedsPrioritySection = (section, key, value) => {
    setNeedsAssessmentForm((f) => ({
      ...f,
      needsPriorities: {
        ...(f.needsPriorities || {}),
        [section]: { ...(f.needsPriorities?.[section] || {}), [key]: value },
      },
    }));
  };



  // Title
  useEffect(() => {
    document.title = `${username} | Lead Engagement`;
  }, [username]);

  // Guard
  useEffect(() => {
    if (!user || user.username !== username) {
      setIsReady(false);
      navigate("/", { replace: true });
      return;
    }
    setIsReady(true);
  }, [user, username, navigate]);

  const API_BASE = "http://localhost:5000";

  const fetchEngagement = useCallback(
    async (signal) => {
      const options = signal ? { signal } : undefined;

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/engagement?userId=${user.id}`,
        options
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch lead engagement details.");
      }

      setProspect(data?.prospect || null);
      setLead(data?.lead || null);
      setEngagement(data?.engagement || null);
    },
    [API_BASE, prospectId, leadId, user?.id]
  );


  const fetchMeetingAvailability = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingAvailability(true);
      const res = await fetch(`${API_BASE}/api/agents/${user.id}/meeting-availability?userId=${user.id}&days=30`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load meeting availability.");
      setBookedWindows(Array.isArray(data?.bookedWindows) ? data.bookedWindows : []);
    } catch {
      setBookedWindows([]);
    } finally {
      setLoadingAvailability(false);
    }
  }, [API_BASE, user?.id]);

  const fetchNeedsAssessment = useCallback(async () => {
    if (!user?.id) return;
    try {
      setNeedsAssessmentLoading(true);
      setNeedsAssessmentError("");
      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/needs-assessment?userId=${user.id}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load needs assessment.");

      const profile = data?.prospectProfile || {};
      const birthday = toDateInputValue(profile.birthday);
      const age = birthday ? computeAgeFromBirthday(birthday) : profile.age;

      const currentNAActivity = String(data?.needsAssessment?.currentActivityKey || "Record Prospect Attendance").trim();
      const outcomeNAActivity = String(data?.needsAssessment?.outcomeActivity || "").trim();
      setNeedsAssessmentCurrentActivityKey(currentNAActivity);
      setNeedsAssessmentOutcomeActivity(outcomeNAActivity);

      setNeedsAssessmentForm({
        attendanceChoice: Boolean(data?.needsAssessment?.attendanceConfirmed) ? "YES" : "",
        basicInformation: {
          fullName: String(profile.fullName || "").trim(),
          sex: String(profile.sex || ""),
          civilStatus: String(profile.civilStatus || ""),
          birthday,
          age: age ?? "",
          occupationCategory: String(profile.occupationCategory || "Not Employed"),
          occupation: String(profile.occupation || ""),
          addressLine: String(profile.address?.line || ""),
          barangay: String(profile.address?.barangay || ""),
          city: String(profile.address?.city || ""),
          otherCity: String(profile.address?.otherCity || ""),
          region: String(profile.address?.region || ""),
          zipCode: String(profile.address?.zipCode || ""),
          country: "Philippines",
        },
        dependents: Array.isArray(data?.needsAssessment?.dependents)
          ? data.needsAssessment.dependents.map((d) => ({
              name: String(d?.name || ""),
              age: d?.age ?? "",
              gender: String(d?.gender || ""),
              relationship: String(d?.relationship || ""),
            }))
          : [],
        needsPriorities: {
          currentPriority: String(data?.needsAssessment?.needsPriorities?.currentPriority || ""),
          monthlyIncomeBand: String(data?.needsAssessment?.needsPriorities?.monthlyIncomeBand || ""),
          monthlyIncomeAmount: data?.needsAssessment?.needsPriorities?.monthlyIncomeAmount ?? "",
          minPremium: data?.needsAssessment?.needsPriorities?.minPremium ?? "",
          maxPremium: data?.needsAssessment?.needsPriorities?.maxPremium ?? "",
          protection: {
            monthlySpend: data?.needsAssessment?.needsPriorities?.protection?.monthlySpend ?? "",
            numberOfDependents: data?.needsAssessment?.needsPriorities?.protection?.numberOfDependents ?? "",
            yearsToProtectIncome: data?.needsAssessment?.needsPriorities?.protection?.yearsToProtectIncome ?? "",
            savingsForProtection: data?.needsAssessment?.needsPriorities?.protection?.savingsForProtection ?? "",
            protectionGap: data?.needsAssessment?.needsPriorities?.protection?.protectionGap ?? "",
          },
          health: {
            amountToCoverCriticalIllness: data?.needsAssessment?.needsPriorities?.health?.amountToCoverCriticalIllness ?? "",
            savingsForCriticalIllness: data?.needsAssessment?.needsPriorities?.health?.savingsForCriticalIllness ?? "",
            criticalIllnessGap: data?.needsAssessment?.needsPriorities?.health?.criticalIllnessGap ?? "",
          },
          investment: {
            savingsPlan: String(data?.needsAssessment?.needsPriorities?.investment?.savingsPlan || ""),
            savingsPlanOther: String(data?.needsAssessment?.needsPriorities?.investment?.savingsPlanOther || ""),
            targetSavingsAmount: data?.needsAssessment?.needsPriorities?.investment?.targetSavingsAmount ?? "",
            targetUtilizationYear: data?.needsAssessment?.needsPriorities?.investment?.targetUtilizationYear ?? "",
            savingsForInvestment: data?.needsAssessment?.needsPriorities?.investment?.savingsForInvestment ?? "",
            savingsGap: data?.needsAssessment?.needsPriorities?.investment?.savingsGap ?? "",
            riskProfiler: {
              investmentHorizon: String(data?.needsAssessment?.needsPriorities?.investment?.riskProfiler?.investmentHorizon || ""),
              investmentGoal: String(data?.needsAssessment?.needsPriorities?.investment?.riskProfiler?.investmentGoal || ""),
              marketExperience: String(data?.needsAssessment?.needsPriorities?.investment?.riskProfiler?.marketExperience || ""),
              volatilityReaction: String(data?.needsAssessment?.needsPriorities?.investment?.riskProfiler?.volatilityReaction || ""),
              capitalLossAffordability: String(data?.needsAssessment?.needsPriorities?.investment?.riskProfiler?.capitalLossAffordability || ""),
              riskReturnTradeoff: String(data?.needsAssessment?.needsPriorities?.investment?.riskProfiler?.riskReturnTradeoff || ""),
              riskProfileScore: data?.needsAssessment?.needsPriorities?.investment?.riskProfiler?.riskProfileScore ?? "",
              riskProfileCategory: String(data?.needsAssessment?.needsPriorities?.investment?.riskProfiler?.riskProfileCategory || ""),
            },
          },
        },
        existingPolicies: Array.isArray(data?.existingPolicies) ? data.existingPolicies : [],
      });
    } catch (err) {
      setNeedsAssessmentError(err?.message || "Failed to load needs assessment.");
    } finally {
      setNeedsAssessmentLoading(false);
    }
  }, [API_BASE, leadId, prospectId, user?.id]);


  // Fetch engagement details
  useEffect(() => {
    if (!isReady) return;
    if (!user?.id) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setApiError("");
        await fetchEngagement(controller.signal);
      } catch (err) {
        if (err.name !== "AbortError") {
          setApiError(err?.message || "Cannot connect to server. Is backend running?");
          setProspect(null);
          setLead(null);
          setEngagement(null);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id, prospectId, leadId, fetchEngagement]);


  useEffect(() => {
    if (!showAddAttempt) return;
    fetchMeetingAvailability();
  }, [showAddAttempt, fetchMeetingAvailability]);

  useEffect(() => {
    const currentStage = String(engagement?.currentStage || "");
    const shouldLoad =
      selectedStageView === "Needs Assessment" ||
      (selectedStageView === "CURRENT" && currentStage === "Needs Assessment");
    if (!shouldLoad) return;
    fetchNeedsAssessment();
  }, [selectedStageView, engagement?.currentStage, fetchNeedsAssessment]);

  const onSaveNeedsAssessment = async () => {
    setNeedsAssessmentSavedAt("");
    setNeedsAssessmentError("");

    if (!isNeedsAssessmentEditableNow) return;

    if (needsAssessmentForm.attendanceChoice !== "YES") {
      setNeedsAssessmentError("Prospect attendance must be marked YES before saving.");
      return;
    }

    const civilStatus = String(needsAssessmentForm.basicInformation?.civilStatus || "").trim();
    const birthday = String(needsAssessmentForm.basicInformation?.birthday || "").trim();
    const occupationCategory = String(needsAssessmentForm.basicInformation?.occupationCategory || "").trim();
    const occupation = String(needsAssessmentForm.basicInformation?.occupation || "").trim();
    const age = Number(needsAssessmentForm.basicInformation?.age || "");

    if (!civilStatus) {
      setNeedsAssessmentError("Civil status is required.");
      return;
    }
    if (!birthday) {
      setNeedsAssessmentError("Birthday is required.");
      return;
    }
    if (!["Employed", "Self-Employed", "Not Employed"].includes(occupationCategory)) {
      setNeedsAssessmentError("Occupation category is required.");
      return;
    }
    if (["Employed", "Self-Employed"].includes(occupationCategory) && !occupation) {
      setNeedsAssessmentError("Occupation is required for employed/self-employed prospects.");
      return;
    }

    const addressLine = String(needsAssessmentForm.basicInformation?.addressLine || "").trim();
    const barangay = String(needsAssessmentForm.basicInformation?.barangay || "").trim();
    const city = String(needsAssessmentForm.basicInformation?.city || "").trim();
    const otherCity = String(needsAssessmentForm.basicInformation?.otherCity || "").trim();
    const region = String(needsAssessmentForm.basicInformation?.region || "").trim();
    const zipCode = String(needsAssessmentForm.basicInformation?.zipCode || "").trim();

    if (!addressLine) { setNeedsAssessmentError("Street address is required."); return; }
    if (!barangay) { setNeedsAssessmentError("Barangay is required."); return; }
    if (!city) { setNeedsAssessmentError("City is required."); return; }
    if (city === "Other" && !otherCity) { setNeedsAssessmentError("Other city is required."); return; }
    if (!region) { setNeedsAssessmentError("Region is required."); return; }
    if (!zipCode) { setNeedsAssessmentError("Zip code is required."); return; }
    if (!/^\d{4}$/.test(zipCode)) { setNeedsAssessmentError("Zip code must be 4 digits."); return; }

    if (birthday) {
      const b = new Date(birthday);
      const now = new Date();
      if (Number.isNaN(b.getTime())) {
        setNeedsAssessmentError("Birthday is invalid.");
        return;
      }
      const d0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
      const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (d0 > t0) {
        setNeedsAssessmentError("Birthday cannot be in the future.");
        return;
      }
      const computed = computeAgeFromBirthday(birthday);
      if (computed === null || computed < 18 || computed > 70) {
        setNeedsAssessmentError("Prospect age must be between 18 and 70 years old.");
        return;
      }
    }

    if (!Number.isFinite(age) || age < 18 || age > 70) {
      setNeedsAssessmentError("Prospect age must be between 18 and 70 years old.");
      return;
    }

    for (let i = 0; i < (needsAssessmentForm.dependents || []).length; i += 1) {
      const d = needsAssessmentForm.dependents[i] || {};
      const depAge = Number(d.age);
      if (!String(d.name || "").trim()) {
        setNeedsAssessmentError(`Dependent #${i + 1}: name is required.`);
        return;
      }
      if (!Number.isFinite(depAge) || depAge < 0 || depAge > 120) {
        setNeedsAssessmentError(`Dependent #${i + 1}: age must be between 0 and 120.`);
        return;
      }
      if (!["Male", "Female"].includes(String(d.gender || ""))) {
        setNeedsAssessmentError(`Dependent #${i + 1}: please select gender.`);
        return;
      }
      if (!["Child", "Parent", "Sibling"].includes(String(d.relationship || ""))) {
        setNeedsAssessmentError(`Dependent #${i + 1}: please select relationship.`);
        return;
      }
    }

    const np = needsAssessmentForm.needsPriorities || {};
    const currentPriority = String(np.currentPriority || "").trim();
    const monthlyIncomeBand = String(np.monthlyIncomeBand || "").trim();
    const monthlyIncomeAmount = toNonNegativeNumber(np.monthlyIncomeAmount);
    const minPremium = toNonNegativeNumber(np.minPremium);
    const maxPremium = toNonNegativeNumber(np.maxPremium);

    if (!["Protection", "Health", "Investment"].includes(currentPriority)) {
      setNeedsAssessmentError("Current priority is required.");
      return;
    }
    if (!INCOME_BAND_OPTIONS.some((o) => o.value === monthlyIncomeBand)) {
      setNeedsAssessmentError("Approximate monthly income bracket is required.");
      return;
    }
    if (monthlyIncomeBand === "BELOW_15000") {
      if (monthlyIncomeAmount === null || monthlyIncomeAmount >= 15000) {
        setNeedsAssessmentError("Manual monthly income must be below Php 15,000 for selected bracket.");
        return;
      }
    }
    if (monthlyIncomeBand === "ABOVE_500000") {
      if (monthlyIncomeAmount === null || monthlyIncomeAmount <= 500000) {
        setNeedsAssessmentError("Manual monthly income must be above Php 500,000 for selected bracket.");
        return;
      }
    }

    const approxIncome = resolveApproxIncome(monthlyIncomeBand, np.monthlyIncomeAmount);
    if (approxIncome === null) {
      setNeedsAssessmentError("Approximate monthly income amount is required for selected bracket.");
      return;
    }

    if (minPremium === null) { setNeedsAssessmentError("Minimum willing monthly premium is required."); return; }
    if (maxPremium === null) { setNeedsAssessmentError("Maximum willing monthly premium is required."); return; }
    if (minPremium > approxIncome) { setNeedsAssessmentError("Minimum willing monthly premium cannot be higher than approximate monthly income."); return; }
    if (maxPremium > approxIncome) { setNeedsAssessmentError("Maximum willing monthly premium cannot be higher than approximate monthly income."); return; }
    if (maxPremium < minPremium) { setNeedsAssessmentError("Maximum willing monthly premium must be equal to or higher than minimum."); return; }

    if (currentPriority === "Protection") {
      const monthlySpend = toNonNegativeNumber(np?.protection?.monthlySpend);
      const savingsForProtection = toNonNegativeNumber(np?.protection?.savingsForProtection);
      if (monthlySpend === null) { setNeedsAssessmentError("Protection: approximate monthly spend is required."); return; }
      if (monthlySpend > approxIncome) { setNeedsAssessmentError("Protection: monthly spend cannot be higher than approximate monthly income."); return; }
      if (savingsForProtection === null) { setNeedsAssessmentError("Protection: savings for protection is required."); return; }
    }

    if (currentPriority === "Health") {
      const amountToCoverCriticalIllness = toNonNegativeNumber(np?.health?.amountToCoverCriticalIllness);
      const savingsForCriticalIllness = toNonNegativeNumber(np?.health?.savingsForCriticalIllness);
      if (amountToCoverCriticalIllness === null) { setNeedsAssessmentError("Health: approximate amount to cover critical illness is required."); return; }
      if (savingsForCriticalIllness === null) { setNeedsAssessmentError("Health: savings for critical illness is required."); return; }
      if (savingsForCriticalIllness > amountToCoverCriticalIllness) {
        setNeedsAssessmentError("Health: savings for critical illness cannot be higher than amount to cover critical illness.");
        return;
      }
    }

    if (currentPriority === "Investment") {
      const savingsPlan = String(np?.investment?.savingsPlan || "").trim();
      const savingsPlanOther = String(np?.investment?.savingsPlanOther || "").trim();
      const targetSavingsAmount = toNonNegativeNumber(np?.investment?.targetSavingsAmount);
      const targetUtilizationYear = Number(np?.investment?.targetUtilizationYear);
      const savingsForInvestment = toNonNegativeNumber(np?.investment?.savingsForInvestment);
      const rp = np?.investment?.riskProfiler || {};
      const { score: riskProfileScore, category: riskProfileCategory } = scoreRiskProfile(rp);
      const currentYear = new Date().getFullYear();

      if (!["Home", "Vehicle", "Holiday", "Early Retirement", "Other"].includes(savingsPlan)) {
        setNeedsAssessmentError("Investment: savings plan is required.");
        return;
      }
      if (savingsPlan === "Other" && !savingsPlanOther) {
        setNeedsAssessmentError("Investment: please specify other savings plan.");
        return;
      }
      if (targetSavingsAmount === null) { setNeedsAssessmentError("Investment: target savings amount is required."); return; }
      if (!Number.isFinite(targetUtilizationYear)) { setNeedsAssessmentError("Investment: target year to utilize savings is required."); return; }
      if (targetUtilizationYear < currentYear + 2 || targetUtilizationYear > currentYear + 20) {
        setNeedsAssessmentError("Investment: target year must be between 2 and 20 years from current year.");
        return;
      }
      if (savingsForInvestment === null) { setNeedsAssessmentError("Investment: savings for investment is required."); return; }
      if (savingsForInvestment > targetSavingsAmount) {
        setNeedsAssessmentError("Investment: savings for investment cannot be higher than target savings amount.");
        return;
      }
      if (riskProfileScore === null || !riskProfileCategory) {
        setNeedsAssessmentError("Investment Risk Profiler: please answer all survey questions.");
        return;
      }
    }

    const meetingDate = String(meetingForm.meetingDate || "").trim();
    const meetingStartTime = String(meetingForm.meetingStartTime || "").trim();
    const meetingDurationMin = Number(meetingForm.meetingDurationMin || 120);
    const meetingMode = String(meetingForm.meetingMode || "").trim();

    if (!meetingDate || !meetingStartTime) {
      setNeedsAssessmentError("Proposal meeting date and start time are required.");
      return;
    }
    if (![30, 60, 90, 120].includes(meetingDurationMin)) {
      setNeedsAssessmentError("Proposal meeting duration must be 30, 60, 90, or 120 minutes.");
      return;
    }
    if (!["Online", "Face-to-face"].includes(meetingMode)) {
      setNeedsAssessmentError("Proposal meeting mode is required.");
      return;
    }

    try {
      setNeedsAssessmentSaving(true);

      {
        const aRes = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/needs-assessment/attendance?userId=${user.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attended: true }),
        });
        const aData = await aRes.json();
        if (!aRes.ok) throw new Error(aData?.message || "Failed to record attendance.");
      }

      {
        const nRes = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/needs-assessment?userId=${user.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            basicInformation: {
              sex: String(needsAssessmentForm.basicInformation.sex || "").trim(),
              civilStatus: String(needsAssessmentForm.basicInformation.civilStatus || "").trim(),
              birthday: String(needsAssessmentForm.basicInformation.birthday || "").trim(),
              age: needsAssessmentForm.basicInformation.age,
              occupationCategory: String(needsAssessmentForm.basicInformation.occupationCategory || "Not Employed").trim(),
              occupation: ["Employed", "Self-Employed"].includes(String(needsAssessmentForm.basicInformation.occupationCategory || ""))
                ? String(needsAssessmentForm.basicInformation.occupation || "").trim()
                : "",
              address: {
                line: String(needsAssessmentForm.basicInformation.addressLine || "").trim(),
                barangay: String(needsAssessmentForm.basicInformation.barangay || "").trim(),
                city: String(needsAssessmentForm.basicInformation.city || "").trim(),
                otherCity: String(needsAssessmentForm.basicInformation.otherCity || "").trim(),
                region: String(needsAssessmentForm.basicInformation.region || "").trim(),
                zipCode: String(needsAssessmentForm.basicInformation.zipCode || "").trim(),
                country: "Philippines",
              },
            },
            dependents: (needsAssessmentForm.dependents || []).map((d) => ({
              name: String(d.name || "").trim(),
              age: Number(d.age),
              gender: String(d.gender || ""),
              relationship: String(d.relationship || ""),
            })),
            needsPriorities: {
              currentPriority,
              monthlyIncomeBand,
              monthlyIncomeAmount,
              minPremium,
              maxPremium,
              protection: {
                monthlySpend: toNonNegativeNumber(np?.protection?.monthlySpend),
                savingsForProtection: toNonNegativeNumber(np?.protection?.savingsForProtection),
              },
              health: {
                amountToCoverCriticalIllness: toNonNegativeNumber(np?.health?.amountToCoverCriticalIllness),
                savingsForCriticalIllness: toNonNegativeNumber(np?.health?.savingsForCriticalIllness),
              },
              investment: {
                savingsPlan: String(np?.investment?.savingsPlan || "").trim(),
                savingsPlanOther: String(np?.investment?.savingsPlanOther || "").trim(),
                targetSavingsAmount: toNonNegativeNumber(np?.investment?.targetSavingsAmount),
                targetUtilizationYear: Number(np?.investment?.targetUtilizationYear),
                savingsForInvestment: toNonNegativeNumber(np?.investment?.savingsForInvestment),
                riskProfiler: {
                  investmentHorizon: String(np?.investment?.riskProfiler?.investmentHorizon || "").trim(),
                  investmentGoal: String(np?.investment?.riskProfiler?.investmentGoal || "").trim(),
                  marketExperience: String(np?.investment?.riskProfiler?.marketExperience || "").trim(),
                  volatilityReaction: String(np?.investment?.riskProfiler?.volatilityReaction || "").trim(),
                  capitalLossAffordability: String(np?.investment?.riskProfiler?.capitalLossAffordability || "").trim(),
                  riskReturnTradeoff: String(np?.investment?.riskProfiler?.riskReturnTradeoff || "").trim(),
                },
              },
            },
          }),
        });
        const nData = await nRes.json();
        if (!nRes.ok) throw new Error(nData?.message || "Failed to save needs analysis.");
      }

      const sRes = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/needs-assessment/schedule-proposal?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingDate,
          meetingStartTime,
          meetingDurationMin,
          meetingMode,
          meetingPlatform: meetingMode === "Online" ? String(meetingForm.meetingPlatform || "").trim() : undefined,
          meetingPlatformOther:
            meetingMode === "Online" && meetingForm.meetingPlatform === "Other"
              ? String(meetingForm.meetingPlatformOther || "").trim()
              : undefined,
          meetingLink: meetingMode === "Online" ? String(meetingForm.meetingLink || "").trim() : undefined,
          meetingInviteSent: Boolean(meetingForm.meetingInviteSent),
          meetingPlace: meetingMode === "Face-to-face" ? String(meetingForm.meetingPlace || "").trim() : undefined,
        }),
      });
      const sData = await sRes.json();
      if (!sRes.ok) throw new Error(sData?.message || "Failed to schedule proposal presentation.");

      setNeedsAssessmentSavedAt(new Date().toISOString());
      await fetchNeedsAssessment();
      await fetchEngagement();
    } catch (err) {
      setNeedsAssessmentError(err?.message || "Failed to save needs assessment.");
    } finally {
      setNeedsAssessmentSaving(false);
    }
  };


  const PIPELINE_STEPS = useMemo(
    () => ["Contacting", "Needs Assessment", "Proposal", "Application", "Policy Issuance"],
    []
  );

  // ✅ Keep everything present tense (no past tense logic)
  const CONTACTING_STEPS_UI = useMemo(
    () => [
      { key: "Attempt Contact", label: "Attempt Contact" },
      { key: "Validate Contact", label: "Validate Contact" },
      { key: "Assess Interest", label: "Assess Interest" },
      { key: "Schedule Meeting", label: "Schedule Meeting" },
    ],
    []
  );

  const NEEDS_ASSESSMENT_STEPS_UI = useMemo(
    () => [
      { key: "Record Prospect Attendance", label: "Record Prospect Attendance" },
      { key: "Perform Needs Analysis", label: "Perform Needs Analysis" },
      { key: "Schedule Proposal Presentation", label: "Schedule Proposal Presentation" },
    ],
    []
  );

  const CHANNELS = useMemo(() => ["Call", "SMS", "WhatsApp", "Viber", "Telegram"], []);
  const cityOptions = useMemo(() => [...PH_CITY_REGION_OPTIONS].sort((a, b) => a.city.localeCompare(b.city)), []);
  const RESPONSES = useMemo(() => ["Responded", "No Response"], []);
  const INCOME_BAND_OPTIONS = useMemo(
    () => [
      { value: "BELOW_15000", label: "Below Php 15,000" },
      { value: "15000_29999", label: "Php 15,000 - Php 29,999" },
      { value: "30000_49999", label: "Php 30,000 - Php 49,999" },
      { value: "50000_79999", label: "Php 50,000 - Php 79,999" },
      { value: "80000_99999", label: "Php 80,000 - Php 99,999" },
      { value: "100000_249999", label: "Php 100,000 - Php 249,999" },
      { value: "250000_499999", label: "Php 250,000 - Php 499,999" },
      { value: "ABOVE_500000", label: "Above Php 500,000" },
    ],
    []
  );

  const RISK_CATEGORY_LABELS = useMemo(
    () => ({
      NOT_RECOMMENDED: "Variable or unit-linked product is not recommended.",
      CONSERVATIVE: "Conservative",
      MODERATE: "Moderate",
      AGGRESSIVE: "Aggressive",
    }),
    []
  );

  const RISK_CATEGORY_NOTES = useMemo(
    () => ({
      CONSERVATIVE:
        "Capital preservation is your primary concern and you prefer less risk. Potential returns may not always beat inflation. Investors in this category may consider funds with risk rating of 1.",
      MODERATE:
        "You trade off some capital preservation for capital growth in the long run, accepting moderate volatility and potential capital loss. Investors in this category may consider funds with risk rating of 1 and 2.",
      AGGRESSIVE:
        "Your primary goal is significant long-term return and you accept high volatility and high risk of potential capital loss. Investors in this category may consider funds with risk rating of 1, 2 and 3.",
    }),
    []
  );

  const scoreRiskProfile = useCallback((riskProfiler) => {
    const rp = riskProfiler || {};
    const horizonScores = { LT_3: 0, BETWEEN_3_7: 2, BETWEEN_7_10: 3, AT_LEAST_10: 4 };
    const goalScores = { CAPITAL_PRESERVATION: 1, STEADY_GROWTH: 2, SIGNIFICANT_APPRECIATION: 3 };
    const expScores = { NONE: 0, I_ONLY: 2, II_ONLY: 4, BOTH: 4 };
    const volScores = { FULL_WITHDRAW: 0, LESS_RISKY: 1, HOLD: 2, TOP_UPS: 4 };
    const lossScores = { NO_LOSS: 0, UP_TO_5: 1, UP_TO_10: 2, ABOVE_10: 3 };
    const tradeoffScores = { PORTFOLIO_A: 1, PORTFOLIO_B: 1, PORTFOLIO_C: 2, PORTFOLIO_D: 3 };

    const keysOk =
      Object.prototype.hasOwnProperty.call(horizonScores, String(rp.investmentHorizon || "")) &&
      Object.prototype.hasOwnProperty.call(goalScores, String(rp.investmentGoal || "")) &&
      Object.prototype.hasOwnProperty.call(expScores, String(rp.marketExperience || "")) &&
      Object.prototype.hasOwnProperty.call(volScores, String(rp.volatilityReaction || "")) &&
      Object.prototype.hasOwnProperty.call(lossScores, String(rp.capitalLossAffordability || "")) &&
      Object.prototype.hasOwnProperty.call(tradeoffScores, String(rp.riskReturnTradeoff || ""));

    if (!keysOk) return { score: null, category: "" };

    const score =
      horizonScores[rp.investmentHorizon] +
      goalScores[rp.investmentGoal] +
      expScores[rp.marketExperience] +
      volScores[rp.volatilityReaction] +
      lossScores[rp.capitalLossAffordability] +
      tradeoffScores[rp.riskReturnTradeoff];

    const category = score <= 5 ? "NOT_RECOMMENDED" : score <= 9 ? "CONSERVATIVE" : score <= 15 ? "MODERATE" : "AGGRESSIVE";
    return { score, category };
  }, []);

  const formatDateTime = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDueShort = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toLocalDateInputValue = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const combineDateAndTimeLocal = (dateStr, timeStr) => {
    const [y, m, d] = String(dateStr || "").split("-").map(Number);
    const [hh, mm] = String(timeStr || "").split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  };

  const formatTimeLabel = (timeStr) => {
    const dt = combineDateAndTimeLocal("2000-01-01", timeStr);
    return dt
      ? dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : timeStr;
  };

  const isValidHttpUrl = (value) => {
    try {
      const u = new URL(String(value || "").trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const availableDateOptions = useMemo(() => {
    const list = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + 1);

    for (let i = 0; i < 30; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      list.push({
        value: toLocalDateInputValue(d),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }),
      });
    }
    return list;
  }, []);

  const meetingStartSlots = useMemo(() => {
    const duration = Number(meetingForm.meetingDurationMin || 120);
    const latestStartMin = 21 * 60 - duration;
    const slots = [];

    for (let minute = 7 * 60; minute <= latestStartMin; minute += 30) {
      const hh = String(Math.floor(minute / 60)).padStart(2, "0");
      const mm = String(minute % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }, [meetingForm.meetingDurationMin]);

  const isSlotBooked = useCallback(
    (dateStr, timeStr, durationMin) => {
      const start = combineDateAndTimeLocal(dateStr, timeStr);
      if (!start) return false;
      const end = new Date(start.getTime() + Number(durationMin || 120) * 60 * 1000);

      return bookedWindows.some((w) => {
        const ws = new Date(w.startAt);
        const we = new Date(w.endAt);
        return ws < end && we > start;
      });
    },
    [bookedWindows]
  );

  const handleSideNav = (key) => {
    if (!user) return navigate("/");

    switch (key) {
      // CLIENTS
      case "clients":
        navigate(`/agent/${user.username}/clients`);
        break;

      case "clients_all_prospects":
        navigate(`/agent/${user.username}/prospects`);
        break;

      case "clients_all_policyholders":
        alert("All Policyholders page coming soon.");
        break;

      // TASKS
      case "tasks":
        navigate(`/agent/${user.username}/tasks`);
        break;

      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;

      // SALES
      case "sales":
        alert("Sales module coming soon");
        break;

      default:
        break;
    }
  };

  const goBackToLeadDetails = () => {
    navigate(`/agent/${username}/prospects/${prospectId}/leads/${leadId}`);
  };

  // Helpers / derived state
  const prospectName = prospect?.fullName || "—";
  const leadCode = lead?.leadCode || "—";

  const attempts = useMemo(() => {
    const source = Array.isArray(engagement?.attempts)
      ? engagement.attempts
      : Array.isArray(engagement?.contactAttempts)
      ? engagement.contactAttempts
      : [];
    const list = [...source];
    return list.sort((a, b) => Number(a.attemptNo || 0) - Number(b.attemptNo || 0));
  }, [engagement?.attempts, engagement?.contactAttempts]);
  const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;

  // UI stage: if there are attempts but backend still says Not Started, show Contacting on UI
  const rawStage = engagement?.currentStage || "Not Started";
  const stage = rawStage === "Not Started" && attempts.length > 0 ? "Contacting" : rawStage;

  // Not Started => no active pipeline step
  const safeIndex = stage === "Not Started" ? -1 : PIPELINE_STEPS.indexOf(stage);

  // Stage view behavior:
  // - CURRENT: follow backend current stage
  // - explicit stage click: inspect selected stage
  const viewStage = selectedStageView === "CURRENT" ? stage : selectedStageView;
  const isViewingCurrentStage = viewStage === stage;

  // Contacting panel is shown only when viewing Contacting stage
  const showContactingPanel = viewStage === "Contacting";
  const showNeedsAssessmentPanel = viewStage === "Needs Assessment";
  const isNeedsAssessmentEditableNow = showNeedsAssessmentPanel && isViewingCurrentStage && stage === "Needs Assessment";

  // Editable when viewing Contacting while current stage is Contacting,
  // or when current stage is Not Started and user moved into Contacting view
  // to create the very first attempt.
  const isContactingEditableNow = showContactingPanel && (stage === "Contacting" || stage === "Not Started");
  const isContactingReadOnly = !isContactingEditableNow;

  // Activity tracker only relevant when Contacting panel is shown
  const showContactingTracker = showContactingPanel;

  // Current activity (badge + tracker)
  const currentActivityKeyRaw = String(engagement?.currentActivityKey || "").trim();
  const isEngagementBlocked = !!engagement?.isBlocked;
  const uiLocked = isEngagementBlocked;

  const isLastAttemptResponded = lastAttempt?.response === "Responded";

  const currentContactVersion = Number(prospect?.contactInfoVersion ?? 1);
  const lastAttemptVersionUsed = Number(lastAttempt?.contactInfoVersionUsed ?? NaN);

  // show validate ONLY when:
  // - not blocked
  // - last attempt responded
  // - last attempt used the CURRENT contact info version
  const showValidateContact =
    !isEngagementBlocked &&
    isViewingCurrentStage &&
    showContactingPanel &&
    !isContactingReadOnly &&
    lastAttempt?.response === "Responded" &&
    Number.isFinite(lastAttemptVersionUsed) &&
    lastAttemptVersionUsed === currentContactVersion &&
    currentActivityKeyRaw === "Validate Contact";

  const hasOpenApproachTask = useMemo(() => {
      const list = Array.isArray(engagement?.tasks) ? engagement.tasks : [];
      return list.some((t) => t.status === "Open" && String(t.type).toUpperCase() === "APPROACH");
  }, [engagement?.tasks]);

  const isReApproachMode =
    !isEngagementBlocked &&
    hasOpenApproachTask &&
    isLastAttemptResponded &&
    Number.isFinite(lastAttemptVersionUsed) &&
    lastAttemptVersionUsed < currentContactVersion;

  const effectiveActivityKey =
    (isReApproachMode ? "Attempt Contact" : currentActivityKeyRaw) ||
    (attempts.length > 0 ? "Attempt Contact" : "");

  const normalizedActivityIndex = useMemo(() => {
    if (stage === "Not Started" && attempts.length === 0) return -1; // none active
    if (attempts.length === 0) return 0;

    const idx = CONTACTING_STEPS_UI.findIndex((s) => s.key === effectiveActivityKey);
    return idx >= 0 ? idx : 0;
  }, [stage, attempts.length, CONTACTING_STEPS_UI, effectiveActivityKey]);

  const addAttemptActivityIndex = useMemo(() => {
    if (!showAddAttempt) return normalizedActivityIndex;

    if (attemptForm.response !== "Responded") return 0;
    if (!validateForm.phoneValidation) return 1;
    if (validateForm.phoneValidation === "WRONG_CONTACT") return 1;

    if (!interestForm.interestLevel) return 2;
    if (interestForm.interestLevel === "NOT_INTERESTED") return 2;

    return 3;
  }, [
    showAddAttempt,
    normalizedActivityIndex,
    attemptForm.response,
    validateForm.phoneValidation,
    interestForm.interestLevel,
  ]);

  // ✅ Badge label
  const currentActivityLabel = useMemo(() => {
    if (showAddAttempt) {
      return CONTACTING_STEPS_UI[addAttemptActivityIndex]?.label || "Attempt Contact";
    }

    if (stage === "Not Started" && attempts.length === 0) return "—";
    if (attempts.length > 0) return effectiveActivityKey || "Attempt Contact";
    return "Attempt Contact";
  }, [
    showAddAttempt,
    CONTACTING_STEPS_UI,
    addAttemptActivityIndex,
    stage,
    attempts.length,
    effectiveActivityKey,
  ]);

  const needsActivityKeyRaw = String(needsAssessmentCurrentActivityKey || (needsAssessmentOutcomeActivity === "Perform Needs Analysis" ? "Schedule Proposal Presentation" : needsAssessmentOutcomeActivity === "Record Prospect Attendance" ? "Perform Needs Analysis" : "Record Prospect Attendance")).trim();
  const isNeedsAnalysisReady = useMemo(() => {
    if (needsAssessmentForm.attendanceChoice !== "YES") return false;

    const basic = needsAssessmentForm.basicInformation || {};
    if (!String(basic.civilStatus || "").trim()) return false;
    if (!["Employed", "Self-Employed", "Not Employed"].includes(String(basic.occupationCategory || ""))) return false;
    if (["Employed", "Self-Employed"].includes(String(basic.occupationCategory || "")) && !String(basic.occupation || "").trim()) return false;
    if (!String(basic.addressLine || "").trim()) return false;
    if (!String(basic.barangay || "").trim()) return false;
    if (!String(basic.city || "").trim()) return false;
    if (String(basic.city || "") === "Other" && !String(basic.otherCity || "").trim()) return false;
    if (!String(basic.region || "").trim()) return false;
    const zip = String(basic.zipCode || "").trim();
    if (!zip || !/^\d{4}$/.test(zip)) return false;

    const birthday = String(basic.birthday || "").trim();
    const age = Number(basic.age || "");
    if (!birthday) return false;
    const computed = computeAgeFromBirthday(birthday);
    if (computed === null || computed < 18 || computed > 70) return false;
    if (!Number.isFinite(age) || age < 18 || age > 70) return false;

    const depsReady = (needsAssessmentForm.dependents || []).every((d) => {
      const depAge = Number(d?.age);
      return (
        String(d?.name || "").trim() &&
        Number.isFinite(depAge) &&
        depAge >= 0 &&
        depAge <= 120 &&
        ["Male", "Female"].includes(String(d?.gender || "")) &&
        ["Child", "Parent", "Sibling"].includes(String(d?.relationship || ""))
      );
    });
    if (!depsReady) return false;

    const np = needsAssessmentForm.needsPriorities || {};
    const priority = String(np.currentPriority || "").trim();
    const band = String(np.monthlyIncomeBand || "").trim();
    const approxIncome = resolveApproxIncome(band, np.monthlyIncomeAmount);
    const minPremium = toNonNegativeNumber(np.minPremium);
    const maxPremium = toNonNegativeNumber(np.maxPremium);

    if (!["Protection", "Health", "Investment"].includes(priority)) return false;
    if (!["BELOW_15000", "15000_29999", "30000_49999", "50000_79999", "80000_99999", "100000_249999", "250000_499999", "ABOVE_500000"].includes(band)) return false;
    if (band === "BELOW_15000" && !(toNonNegativeNumber(np.monthlyIncomeAmount) !== null && Number(np.monthlyIncomeAmount) < 15000)) return false;
    if (band === "ABOVE_500000" && !(toNonNegativeNumber(np.monthlyIncomeAmount) !== null && Number(np.monthlyIncomeAmount) > 500000)) return false;
    if (approxIncome === null) return false;
    if (minPremium === null || maxPremium === null) return false;
    if (minPremium > approxIncome || maxPremium > approxIncome || maxPremium < minPremium) return false;

    if (priority === "Protection") {
      const monthlySpend = toNonNegativeNumber(np?.protection?.monthlySpend);
      const savingsForProtection = toNonNegativeNumber(np?.protection?.savingsForProtection);
      if (monthlySpend === null || savingsForProtection === null) return false;
      if (monthlySpend > approxIncome) return false;
    }

    if (priority === "Health") {
      const amountToCoverCriticalIllness = toNonNegativeNumber(np?.health?.amountToCoverCriticalIllness);
      const savingsForCriticalIllness = toNonNegativeNumber(np?.health?.savingsForCriticalIllness);
      if (amountToCoverCriticalIllness === null || savingsForCriticalIllness === null) return false;
      if (savingsForCriticalIllness > amountToCoverCriticalIllness) return false;
    }

    if (priority === "Investment") {
      const savingsPlan = String(np?.investment?.savingsPlan || "").trim();
      const targetSavingsAmount = toNonNegativeNumber(np?.investment?.targetSavingsAmount);
      const targetYear = Number(np?.investment?.targetUtilizationYear);
      const savingsForInvestment = toNonNegativeNumber(np?.investment?.savingsForInvestment);
      const { score, category } = scoreRiskProfile(np?.investment?.riskProfiler || {});
      const currentYear = new Date().getFullYear();
      if (!["Home", "Vehicle", "Holiday", "Early Retirement", "Other"].includes(savingsPlan)) return false;
      if (savingsPlan === "Other" && !String(np?.investment?.savingsPlanOther || "").trim()) return false;
      if (targetSavingsAmount === null || !Number.isFinite(targetYear) || savingsForInvestment === null) return false;
      if (targetYear < currentYear + 2 || targetYear > currentYear + 20) return false;
      if (savingsForInvestment > targetSavingsAmount) return false;
      if (score === null || !category) return false;
    }
    return true;
  }, [needsAssessmentForm, resolveApproxIncome, scoreRiskProfile, toNonNegativeNumber]);

  const needsUiActivityKey =
    isNeedsAssessmentEditableNow && isViewingCurrentStage
      ? needsAssessmentForm.attendanceChoice !== "YES"
        ? "Record Prospect Attendance"
        : !isNeedsAnalysisReady
        ? "Perform Needs Analysis"
        : "Schedule Proposal Presentation"
      : needsActivityKeyRaw;

  const needsPrioritiesDerived = useMemo(() => {
    const np = needsAssessmentForm.needsPriorities || {};
    const priority = String(np.currentPriority || "").trim();
    const approxIncome = resolveApproxIncome(String(np.monthlyIncomeBand || "").trim(), np.monthlyIncomeAmount);
    const currentAge = Number(needsAssessmentForm.basicInformation?.age || "");
    const numberOfDependents = Array.isArray(needsAssessmentForm.dependents) ? needsAssessmentForm.dependents.length : 0;
    const yearsToProtectIncome = Number.isFinite(currentAge) ? Math.max(0, 60 - currentAge) : 0;

    const monthlySpend = toNonNegativeNumber(np?.protection?.monthlySpend) ?? 0;
    const savingsForProtection = toNonNegativeNumber(np?.protection?.savingsForProtection) ?? 0;
    const amountToCoverCriticalIllness = toNonNegativeNumber(np?.health?.amountToCoverCriticalIllness) ?? 0;
    const savingsForCriticalIllness = toNonNegativeNumber(np?.health?.savingsForCriticalIllness) ?? 0;
    const targetSavingsAmount = toNonNegativeNumber(np?.investment?.targetSavingsAmount) ?? 0;
    const savingsForInvestment = toNonNegativeNumber(np?.investment?.savingsForInvestment) ?? 0;
    const risk = scoreRiskProfile(np?.investment?.riskProfiler || {});

    return {
      priority,
      approxIncome,
      numberOfDependents,
      yearsToProtectIncome,
      protectionGap: (monthlySpend * 12 * yearsToProtectIncome) - savingsForProtection,
      criticalIllnessGap: amountToCoverCriticalIllness - savingsForCriticalIllness,
      savingsGap: targetSavingsAmount - savingsForInvestment,
      riskProfileScore: risk.score,
      riskProfileCategory: risk.category,
    };
  }, [needsAssessmentForm, resolveApproxIncome, scoreRiskProfile, toNonNegativeNumber]);

  const previousContactingActivity = String(lastAttempt?.outcomeActivity || effectiveActivityKey || "Attempt Contact").trim();
  const previousContactingActivityIndex = useMemo(() => {
    const idx = CONTACTING_STEPS_UI.findIndex((s) => s.key === previousContactingActivity);
    return idx >= 0 ? idx : 0;
  }, [CONTACTING_STEPS_UI, previousContactingActivity]);

  const stageActivityBadge =
    showContactingPanel
      ? isViewingCurrentStage
        ? currentActivityLabel
        : previousContactingActivity
      : showNeedsAssessmentPanel
      ? needsUiActivityKey
      : "";

  const mainTitle = viewStage === "Not Started" ? "Not Started" : viewStage || "—";

    // ✅ Add Attempt is allowed ONLY when:
    // - not blocked
    // - and (no responded yet OR re-approach after Wrong Contact)
    // has open approach task
    const canAddAttempt = useMemo(() => {
    if (isContactingReadOnly) return false;
    if (isEngagementBlocked) return false;

    // if they haven't responded yet -> allow attempts
    if (!isLastAttemptResponded) return true;

    // if they responded, only allow if re-approach conditions are met
    return isReApproachMode;
  }, [isContactingReadOnly, isEngagementBlocked, isLastAttemptResponded, isReApproachMode]);

  const addAttemptDisabledReason = useMemo(() => {
    if (isContactingReadOnly) return "Contacting stage is read-only.";
    if (isEngagementBlocked) return "Engagement is blocked. Update contact info to continue.";
    if (isLastAttemptResponded && !isReApproachMode)
      return "Prospect already responded. Please validate contact instead.";
    return "";
  }, [isContactingReadOnly, isEngagementBlocked, isLastAttemptResponded, isReApproachMode]);

  useEffect(() => {
    if (isEngagementBlocked) setShowAddAttempt(false);
  }, [isEngagementBlocked]);

  // =========================
  // ADD ATTEMPT: helpers
  // =========================
  const resetAttemptForm = () => {
    setAttemptErrors({});
    setAttemptForm({
      primaryChannel: "",
      otherChannels: [],
      response: "",
      attemptedAtLabel: formatDateTime(new Date()),
      notes: "",
    });
  };

  const resetProgressiveSubForms = () => {
    setValidateForm({ phoneValidation: "" });
    setInterestForm({ interestLevel: "", preferredChannel: "", preferredChannelOther: "" });
    setMeetingForm({
      meetingDate: "",
      meetingStartTime: "",
      meetingDurationMin: 120,
      meetingMode: "",
      meetingPlatform: "",
      meetingPlatformOther: "",
      meetingLink: "",
      meetingInviteSent: false,
      meetingPlace: "",
    });
  };


  const validateAttempt = () => {
    const e = {};
    const primary = String(attemptForm.primaryChannel || "").trim();
    const response = String(attemptForm.response || "").trim();

    if (!primary) e.primaryChannel = "Primary channel is required.";
    if (primary && !CHANNELS.includes(primary)) e.primaryChannel = "Invalid primary channel.";

    const others = Array.isArray(attemptForm.otherChannels) ? attemptForm.otherChannels : [];
    const cleanOthers = others.filter(Boolean);

    if (new Set(cleanOthers).size !== cleanOthers.length) e.otherChannels = "Other channels must be unique.";
    if (primary && cleanOthers.includes(primary))
      e.otherChannels = "Other channels cannot include the primary channel.";
    for (const ch of cleanOthers) {
      if (!CHANNELS.includes(ch)) {
        e.otherChannels = "One or more other channels are invalid.";
        break;
      }
    }

    if (!response) e.response = "Response is required.";
    if (response && !RESPONSES.includes(response)) e.response = "Invalid response.";

    return e;
  };

  const toggleOtherChannel = (ch) => {
    setAttemptForm((f) => {
      const set = new Set(Array.isArray(f.otherChannels) ? f.otherChannels : []);
      if (set.has(ch)) set.delete(ch);
      else set.add(ch);
      return { ...f, otherChannels: Array.from(set) };
    });
    setAttemptErrors((er) => ({ ...er, otherChannels: undefined }));
  };

  const onOpenAddAttempt = () => {
    if (!canAddAttempt) return;
    setShowAddAttempt(true);
    resetAttemptForm();
    resetProgressiveSubForms();
  };

  const onCancelAddAttempt = () => {
    setShowAddAttempt(false);
    resetAttemptForm();
    resetProgressiveSubForms();
  };

  const onSubmitAttempt = async () => {
    const baseErrors = validateAttempt();
    const response = String(attemptForm.response || "").trim();
    const phoneValidation = String(validateForm.phoneValidation || "").trim().toUpperCase();
    const interestLevel = String(interestForm.interestLevel || "").trim().toUpperCase();
    const preferredChannel = String(interestForm.preferredChannel || "").trim();
    const preferredChannelOther = String(interestForm.preferredChannelOther || "").trim();
    const meetingDate = String(meetingForm.meetingDate || "").trim();
    const meetingStartTime = String(meetingForm.meetingStartTime || "").trim();
    const meetingDurationMin = Number(meetingForm.meetingDurationMin || 120);
    const meetingMode = String(meetingForm.meetingMode || "").trim();
    const meetingPlatform = String(meetingForm.meetingPlatform || "").trim();
    const meetingPlatformOther = String(meetingForm.meetingPlatformOther || "").trim();
    const meetingLink = String(meetingForm.meetingLink || "").trim();
    const meetingPlace = String(meetingForm.meetingPlace || "").trim();

    const errs = { ...baseErrors };

    if (response === "Responded") {
      if (!phoneValidation) errs.phoneValidation = "Please select phone validation result.";

      if (phoneValidation === "CORRECT") {
        if (!["INTERESTED", "NOT_INTERESTED"].includes(interestLevel)) {
          errs.interestLevel = "Please select a valid interest level.";
        }

        if (interestLevel === "INTERESTED") {
          if (!["SMS", "WhatsApp", "Viber", "Telegram", "Other"].includes(preferredChannel)) {
            errs.preferredChannel = "Please select a preferred communication channel.";
          }
          if (preferredChannel === "Other" && !preferredChannelOther) {
            errs.preferredChannelOther = "Please specify the other communication channel.";
          }

          if (!meetingDate) errs.meetingDate = "Meeting date is required.";
          if (!meetingStartTime) errs.meetingStartTime = "Meeting start time is required.";
          if (![30, 60, 90, 120].includes(meetingDurationMin)) errs.meetingDurationMin = "Duration must be 30, 60, 90, or 120 minutes.";
          if (meetingDate && meetingStartTime && isSlotBooked(meetingDate, meetingStartTime, meetingDurationMin)) {
            errs.meetingStartTime = "Selected time is already booked.";
          }
          if (!["Online", "Face-to-face"].includes(meetingMode)) {
            errs.meetingMode = "Please select meeting mode.";
          }
          if (meetingMode === "Online") {
            if (!["Zoom", "Google Meet", "Other"].includes(meetingPlatform)) {
              errs.meetingPlatform = "Please select online platform.";
            }
            if (meetingPlatform === "Other" && !meetingPlatformOther) {
              errs.meetingPlatformOther = "Please specify other platform.";
            }
            if (!meetingLink) errs.meetingLink = "Meeting link is required for online meetings.";
            if (meetingLink && !isValidHttpUrl(meetingLink)) errs.meetingLink = "Meeting link must be a valid http/https URL.";
            if (meetingForm.meetingInviteSent !== true) errs.meetingInviteSent = "Meeting invite must be sent before saving.";
          }
          if (meetingMode === "Face-to-face" && !meetingPlace) {
            errs.meetingPlace = "Meeting place is required for face-to-face meetings.";
          }
        }
      }
    }

    setAttemptErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      setAddingAttempt(true);

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/contact-attempts?userId=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryChannel: attemptForm.primaryChannel,
            otherChannels: attemptForm.otherChannels,
            response,
            notes: String(attemptForm.notes || "").trim(),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add contact attempt.");

      if (response === "Responded") {
        const validateRes = await fetch(
          `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/validate-contact?userId=${user.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result: phoneValidation }),
          }
        );
        const validateData = await validateRes.json();
        if (!validateRes.ok) throw new Error(validateData?.message || "Failed to validate contact.");

        if (phoneValidation === "CORRECT") {
          const interestRes = await fetch(
            `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/assess-interest?userId=${user.id}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                interestLevel,
                preferredChannel: interestLevel === "INTERESTED" ? preferredChannel : undefined,
                preferredChannelOther:
                  interestLevel === "INTERESTED" && preferredChannel === "Other" ? preferredChannelOther : undefined,
              }),
            }
          );
          const interestData = await interestRes.json();
          if (!interestRes.ok) throw new Error(interestData?.message || "Failed to save assess interest.");

          if (interestLevel === "INTERESTED") {
            const meetingRes = await fetch(
              `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/schedule-meeting?userId=${user.id}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  meetingDate,
                  meetingStartTime,
                  meetingDurationMin,
                  meetingMode,
                  meetingPlatform: meetingMode === "Online" ? meetingPlatform : undefined,
                  meetingPlatformOther:
                    meetingMode === "Online" && meetingPlatform === "Other" ? meetingPlatformOther : undefined,
                  meetingLink: meetingMode === "Online" ? meetingLink : undefined,
                  meetingInviteSent: Boolean(meetingForm.meetingInviteSent),
                  meetingPlace: meetingMode === "Face-to-face" ? meetingPlace : undefined,
                }),
              }
            );
            const meetingData = await meetingRes.json();
            if (!meetingRes.ok) throw new Error(meetingData?.message || "Failed to schedule meeting.");
          }
        }
      }

      await fetchEngagement();
      setShowAddAttempt(false);
      resetAttemptForm();
      resetProgressiveSubForms();
    } catch (err) {
      setAttemptErrors((er) => ({
        ...er,
        _global: err?.message || "Cannot connect to server. Is backend running?",
      }));
    } finally {
      setAddingAttempt(false);
    }
  };

  const submitValidateContact = async () => {
    try {
      setValidateError("");
      const result = String(validateForm.phoneValidation || "").trim().toUpperCase();
      if (!result) {
        setValidateError("Please select a validation result.");
        return;
      }

      setValidatingContact(true);

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/validate-contact?userId=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to validate contact.");

      await fetchEngagement();

      setValidateForm({ phoneValidation: "" });
    } catch (err) {
      setValidateError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setValidatingContact(false);
    }
  };

  const submitAssessInterest = async () => {
    try {
      setInterestError("");

      const interestLevel = String(interestForm.interestLevel || "").trim().toUpperCase();
      if (!["INTERESTED", "NOT_INTERESTED"].includes(interestLevel)) {
        setInterestError("Please select a valid interest level.");
        return;
      }

      if (interestLevel === "INTERESTED") {
        const pc = String(interestForm.preferredChannel || "").trim();
        if (!["SMS", "WhatsApp", "Viber", "Telegram", "Other"].includes(pc)) {
          setInterestError("Please select a preferred communication channel.");
          return;
        }
        if (pc === "Other" && !String(interestForm.preferredChannelOther || "").trim()) {
          setInterestError("Please specify the other communication channel.");
          return;
        }
      }

      setSavingInterest(true);

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/assess-interest?userId=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interestLevel,
            preferredChannel:
              interestLevel === "INTERESTED" ? String(interestForm.preferredChannel || "").trim() : undefined,
            preferredChannelOther:
              interestLevel === "INTERESTED" && interestForm.preferredChannel === "Other"
                ? String(interestForm.preferredChannelOther || "").trim()
                : undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save assess interest.");

      await fetchEngagement();
    } catch (err) {
      setInterestError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setSavingInterest(false);
    }
  };

  const submitScheduleMeeting = async () => {
    try {
      setMeetingError("");

      const meetingDate = String(meetingForm.meetingDate || "").trim();
      const meetingStartTime = String(meetingForm.meetingStartTime || "").trim();
      const meetingDurationMin = Number(meetingForm.meetingDurationMin || 120);
      const meetingMode = String(meetingForm.meetingMode || "").trim();

      if (!meetingDate) {
        setMeetingError("Meeting date is required.");
        return;
      }
      if (!meetingStartTime) {
        setMeetingError("Meeting start time is required.");
        return;
      }
      if (![30, 60, 90, 120].includes(meetingDurationMin)) {
        setMeetingError("Meeting duration must be 30, 60, 90, or 120 minutes.");
        return;
      }
      if (isSlotBooked(meetingDate, meetingStartTime, meetingDurationMin)) {
        setMeetingError("Selected time is already booked.");
        return;
      }

      if (!["Online", "Face-to-face"].includes(meetingMode)) {
        setMeetingError("Please select meeting mode.");
        return;
      }

      if (meetingMode === "Online") {
        const platform = String(meetingForm.meetingPlatform || "").trim();
        if (!["Zoom", "Google Meet", "Other"].includes(platform)) {
          setMeetingError("Please select online platform.");
          return;
        }
        if (platform === "Other" && !String(meetingForm.meetingPlatformOther || "").trim()) {
          setMeetingError("Please specify other platform.");
          return;
        }
        const link = String(meetingForm.meetingLink || "").trim();
        if (!link) {
          setMeetingError("Meeting link is required for online meetings.");
          return;
        }
        if (!isValidHttpUrl(link)) {
          setMeetingError("Meeting link must be a valid http/https URL.");
          return;
        }
        if (meetingForm.meetingInviteSent !== true) {
          setMeetingError("Meeting invite must be sent before saving.");
          return;
        }
      }

      if (meetingMode === "Face-to-face" && !String(meetingForm.meetingPlace || "").trim()) {
        setMeetingError("Meeting place is required for face-to-face meetings.");
        return;
      }

      setSavingMeeting(true);

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/schedule-meeting?userId=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingDate,
            meetingStartTime,
            meetingDurationMin,
            meetingMode,
            meetingPlatform: meetingMode === "Online" ? String(meetingForm.meetingPlatform || "").trim() : undefined,
            meetingPlatformOther:
              meetingMode === "Online" && meetingForm.meetingPlatform === "Other"
                ? String(meetingForm.meetingPlatformOther || "").trim()
                : undefined,
            meetingLink: meetingMode === "Online" ? String(meetingForm.meetingLink || "").trim() : undefined,
            meetingInviteSent: Boolean(meetingForm.meetingInviteSent),
            meetingPlace: meetingMode === "Face-to-face" ? String(meetingForm.meetingPlace || "").trim() : undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to schedule meeting.");

      await fetchEngagement();
    } catch (err) {
      setMeetingError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setSavingMeeting(false);
    }
  };

  // =========================
  // Tasks
  // =========================
  const tasksAll = useMemo(() => {
    const arr = Array.isArray(engagement?.tasks) ? [...engagement.tasks] : [];
    return arr.sort((a, b) => {
      const da = new Date(a?.dueAt).getTime();
      const db = new Date(b?.dueAt).getTime();
      const na = Number.isFinite(da) ? da : Infinity;
      const nb = Number.isFinite(db) ? db : Infinity;
      return na - nb;
    });
  }, [engagement?.tasks]);

  const openTasks = useMemo(() => {
    const now = Date.now();
    return tasksAll.filter((t) => {
      const due = new Date(t?.dueAt).getTime();
      const dueOk = Number.isFinite(due) ? due : Infinity;
      return t.status === "Open" && dueOk >= now;
    });
  }, [tasksAll]);

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return tasksAll.filter((t) => {
      const due = new Date(t?.dueAt).getTime();
      const dueOk = Number.isFinite(due) ? due : -Infinity;
      return t.status === "Open" && dueOk < now;
    });
  }, [tasksAll]);

  const doneTasks = useMemo(() => tasksAll.filter((t) => t.status === "Done"), [tasksAll]);

  const taskTypeClass = (type) => {
    const t = String(type || "").toUpperCase();
    if (["APPROACH", "FOLLOW_UP", "APPOINTMENT", "PRESENTATION"].includes(t)) return "le-taskType urgent";
    if (t === "UPDATE_CONTACT_INFO") return "le-taskType info";
    return "le-taskType";
  };

  const taskStatusClass = (t) => {
    const due = new Date(t?.dueAt).getTime();
    const isOverdue = t.status === "Open" && Number.isFinite(due) && due < Date.now();
    if (t.status === "Done") return "le-taskStatus done";
    if (isOverdue) return "le-taskStatus overdue";
    return "le-taskStatus open";
  };

  const TaskRow = ({ t }) => {
    const due = new Date(t?.dueAt).getTime();
    const isOverdue = t.status === "Open" && Number.isFinite(due) && due < Date.now();
    const uiStatus = t.status === "Done" ? "Done" : isOverdue ? "Overdue" : "Open";

    return (
      <div className="le-taskCard">
        <div className="le-taskTop">
          <div className="le-taskLeft">
            <div className={taskTypeClass(t.type)}>{t.type}</div>
            <div className="le-taskTitle">{t.title}</div>
          </div>
          <span className={taskStatusClass(t)}>{uiStatus}</span>
        </div>

        <div className="le-taskMeta">
          <div className="le-taskMetaItem">
            <span className="le-taskMetaLabel">Due</span>
            <span className="le-taskMetaVal">{formatDueShort(t.dueAt)}</span>
          </div>

          {t.status === "Done" ? (
            <div className="le-taskMetaItem">
              <span className="le-taskMetaLabel">Done</span>
              <span className="le-taskMetaVal">{formatDueShort(t.completedAt)}</span>
            </div>
          ) : null}
        </div>

        {String(t.description || "").trim() ? <div className="le-taskDesc">{t.description}</div> : null}
      </div>
    );
  };

  if (!isReady) return null;

  const nextAttemptNo = attempts.length + 1;

  return (
    <div className="le-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${username}`)}
        onProfileClick={() => navigate(`/agent/${username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${username}/notifications`)}
      />

      <div className="le-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="le-content">
          {loading && <p className="le-small-note">Loading lead engagement...</p>}

          {!loading && apiError && (
            <div>
              <p className="le-muted" style={{ color: "#DA291C" }}>
                {apiError}
              </p>
              <button type="button" className="le-btn secondary" onClick={goBackToLeadDetails}>
                ← Back
              </button>
            </div>
          )}

          {!loading && !apiError && prospect && lead && engagement && (
            <>
              {/* Breadcrumb */}
              <div className="le-breadcrumb">
                <button
                  type="button"
                  className="le-crumbLink"
                  onClick={() => navigate(`/agent/${username}/prospects`)}
                >
                  Prospects
                </button>
                <span className="le-crumbSep">›</span>

                <button
                  type="button"
                  className="le-crumbLink"
                  onClick={() => navigate(`/agent/${username}/prospects/${prospectId}`)}
                >
                  {prospectName}
                </button>
                <span className="le-crumbSep">›</span>

                <button type="button" className="le-crumbLink" onClick={goBackToLeadDetails}>
                  {leadCode}
                </button>
                <span className="le-crumbSep">›</span>

                <span className="le-crumbCurrent">Lead Engagement</span>
              </div>

              {/* Summary Row */}
              <div className="le-summaryRow">
                {/* Prospect Summary */}
                <section className="le-summaryCard">
                  <h3 className="le-summaryTitle">Prospect Details</h3>

                  <div className="le-summaryGrid">
                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Name</span>
                      <strong className="le-summaryValue">{prospectName}</strong>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Market Type</span>
                      <span className={`le-pill market ${String(prospect.marketType || "").toLowerCase()}`}>
                        {prospect.marketType || "—"}
                      </span>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Source</span>
                      <span
                        className={`le-pill source ${String(prospect.source || "")
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {prospect.source || "—"}
                      </span>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Status</span>
                      <span
                        className={`le-status-pill ${
                          prospect.status === "Active"
                            ? "active"
                            : prospect.status === "Dropped"
                            ? "dropped"
                            : prospect.status === "Wrong Contact"
                            ? "wrong"
                            : "unknown"
                        }`}
                      >
                        {prospect.status || "—"}
                      </span>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Phone</span>
                      <strong className="le-summaryValue">
                        {prospect.phoneNumber ? `+63 ${prospect.phoneNumber}` : "—"}
                      </strong>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Phone No. Ver.</span>
                      <strong className="le-summaryValue">{prospect.contactInfoVersion ?? 1}</strong>
                    </div>

                    <div className="le-summaryItem le-span2">
                      <span className="le-summaryLabel">Email</span>
                      <strong className="le-summaryValue">
                        {String(prospect.email || "").trim() ? prospect.email : "—"}
                      </strong>
                    </div>
                  </div>
                </section>

                {/* Lead Summary */}
                <section className="le-summaryCard">
                  <h3 className="le-summaryTitle">Lead Details</h3>

                  <div className="le-summaryGrid">
                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Lead Code</span>
                      <strong className="le-summaryValue">{leadCode}</strong>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Lead Source</span>
                      <strong className="le-summaryValue">{lead.source || "—"}</strong>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Status</span>
                      <span
                        className={`le-status-pill ${
                          lead.status === "New"
                            ? "new"
                            : lead.status === "In Progress"
                            ? "inprogress"
                            : lead.status === "Closed"
                            ? "closed"
                            : lead.status === "Dropped"
                            ? "dropped"
                            : "unknown"
                        }`}
                      >
                        {lead.status || "—"}
                      </span>
                    </div>

                    <div className="le-summaryItem">
                      <span className="le-summaryLabel">Date Created</span>
                      <strong className="le-summaryValue">{formatDateTime(lead.createdAt)}</strong>
                    </div>

                    <div className="le-summaryItem le-span2">
                      <span className="le-summaryLabel">Description</span>
                      <strong className="le-summaryValue">{lead.description || "—"}</strong>
                    </div>
                  </div>
                </section>
              </div>

              {/* Pipeline */}
              <div className="le-pipeline">
                {PIPELINE_STEPS.map((step, i) => {
                  const isActive = safeIndex === i;
                  const isDone = safeIndex > i;

                  return (
                    <div
                      key={step}
                      className="le-pipelineGroup"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedStageView(step)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedStageView(step);
                        }
                      }}
                    >
                      <div className={`le-pipelineStep ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
                        <div className="le-stepCircle">{i + 1}</div>
                        <span className="le-stepText">{step}</span>
                      </div>

                      {i !== PIPELINE_STEPS.length - 1 && (
                        <div
                          className={`le-pipelineArrow ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}
                          aria-hidden="true"
                        >
                          <FaChevronRight />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Main + Sidebar */}
              <div className="le-mainRow">
                <section className="le-card">
                  <div className="le-cardHeader">
                    <h2 className="le-cardTitle">{mainTitle}</h2>
                    {stageActivityBadge ? <span className="le-badge">{stageActivityBadge}</span> : null}
                  </div>

                  {stage === "Not Started" && (
                    <p className="le-muted" style={{ marginTop: 10 }}>
                      No engagement activity yet. Move to Contacting to start.
                    </p>
                  )}
                  
                  {!isViewingCurrentStage && (
                    <p className="le-muted" style={{ marginTop: 8, marginBottom: 10 }}>
                      You are viewing a non-current stage. This section is read-only.
                    </p>
                  )}

                  {showContactingTracker && (
                    <div className="le-activityTracker">
                      {CONTACTING_STEPS_UI.map((s, idx) => {
                        const trackerIndex = showAddAttempt ? addAttemptActivityIndex : (isViewingCurrentStage ? normalizedActivityIndex : previousContactingActivityIndex);
                        const isActiveCurrent = trackerIndex === idx;
                        const isCompleted = trackerIndex > idx;
                        const isReached = trackerIndex >= idx;
                        return (
                          <span
                            key={s.key}
                            className={`${isReached ? "active" : ""} ${isCompleted ? "done" : ""} ${isActiveCurrent ? "current" : ""}`.trim()}
                          >
                            {s.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {showNeedsAssessmentPanel && (
                    <div className="le-activityTracker">
                      {NEEDS_ASSESSMENT_STEPS_UI.map((step, idx) => {
                        const currentIdx = Math.max(
                          0,
                          NEEDS_ASSESSMENT_STEPS_UI.findIndex((x) => x.key === needsUiActivityKey)
                        );
                        const isDone = idx < currentIdx;
                        const isActive = idx === currentIdx;
                        return (
                          <span key={step.key} className={`${isDone ? "done" : ""} ${isActive ? "active current" : ""}`.trim()}>
                            {step.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {showContactingPanel && isContactingReadOnly && (
                    <p className="le-muted" style={{ marginBottom: 10 }}>
                      Contacting records are view-only at this stage. Add Attempt and edits are disabled.
                    </p>
                  )}

                  {showContactingPanel && (
                    <>
                      <div className="le-block">
                        <div className="le-blockHeader">
                          <h4 className="le-blockTitle">{attempts.length > 0 ? "Contact Attempts" : "Add a Contact Attempt"}</h4>

                          {!showAddAttempt ? (
                            <button
                              type="button"
                              className="le-btn secondary"
                              onClick={onOpenAddAttempt}
                              disabled={addingAttempt || !canAddAttempt}
                              title={addAttemptDisabledReason || "Add Attempt"}
                            >
                              + Add Attempt
                            </button>
                          ) : null}
                        </div>

                        {showAddAttempt && (
                          <div className="le-inlineForm">
                            {attemptErrors._global ? (
                              <div className="le-formError" style={{ color: "#DA291C", marginBottom: 10 }}>
                                {attemptErrors._global}
                              </div>
                            ) : null}

                            <div className="le-activitySectionHeader">1. Attempt Contact</div>

                            <div className="le-formRow">
                              <label className="le-label">Attempt No.</label>
                              <input className="le-input" value={`#${nextAttemptNo}`} disabled />
                            </div>

                            <div className="le-formRow">
                              <label className="le-label">Primary Channel *</label>
                              <select
                                className={`le-input ${attemptErrors.primaryChannel ? "error" : ""}`}
                                value={attemptForm.primaryChannel}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setAttemptForm((f) => ({
                                    ...f,
                                    primaryChannel: v,
                                    otherChannels: (f.otherChannels || []).filter((x) => x !== v),
                                  }));
                                  setAttemptErrors((er) => ({
                                    ...er,
                                    primaryChannel: undefined,
                                    otherChannels: undefined,
                                  }));
                                }}
                                disabled={addingAttempt}
                              >
                                <option value="">Select</option>
                                {CHANNELS.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {attemptErrors.primaryChannel ? (
                              <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                {attemptErrors.primaryChannel}
                              </div>
                            ) : null}

                            <div className="le-formRow" style={{ alignItems: "flex-start" }}>
                              <label className="le-label">Other Channels</label>
                              <div className="le-checkboxGrid">
                                {CHANNELS.filter((c) => c !== attemptForm.primaryChannel).map((c) => (
                                  <label key={c} className="le-check">
                                    <input
                                      type="checkbox"
                                      checked={(attemptForm.otherChannels || []).includes(c)}
                                      onChange={() => toggleOtherChannel(c)}
                                      disabled={addingAttempt}
                                    />
                                    <span>{c}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="le-formRow">
                              <label className="le-label">Attempted At</label>
                              <input className="le-input" value={attemptForm.attemptedAtLabel || "—"} disabled />
                            </div>

                            <div className="le-formRow">
                              <label className="le-label">Response *</label>
                              <select
                                className={`le-input ${attemptErrors.response ? "error" : ""}`}
                                value={attemptForm.response}
                                onChange={(e) => {
                                  const nextResponse = e.target.value;
                                  setAttemptForm((f) => ({ ...f, response: nextResponse }));
                                  if (nextResponse !== "Responded") {
                                    resetProgressiveSubForms();
                                  }
                                  setAttemptErrors((er) => ({
                                    ...er,
                                    response: undefined,
                                    phoneValidation: undefined,
                                    interestLevel: undefined,
                                    preferredChannel: undefined,
                                    preferredChannelOther: undefined,
                                    meetingDate: undefined,
                                    meetingStartTime: undefined,
                                    meetingDurationMin: undefined,
                                    meetingMode: undefined,
                                    meetingPlatform: undefined,
                                    meetingPlatformOther: undefined,
                                    meetingLink: undefined,
                                    meetingPlace: undefined,
                                  }));
                                }}
                                disabled={addingAttempt}
                              >
                                <option value="">Select</option>
                                {RESPONSES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {attemptErrors.response ? (
                              <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                {attemptErrors.response}
                              </div>
                            ) : null}

                            <div className="le-formRow" style={{ alignItems: "flex-start" }}>
                              <label className="le-label">Attempt Contact Notes</label>
                              <textarea
                                className="le-input"
                                value={attemptForm.notes}
                                onChange={(e) => setAttemptForm((f) => ({ ...f, notes: e.target.value }))}
                                rows={3}
                                disabled={addingAttempt}
                                placeholder="Optional notes for Attempt Contact..."
                              />
                            </div>

                            {attemptForm.response === "Responded" && (
                              <>
                                <div className="le-activitySectionHeader">2. Validate Contact</div>

                                <div className="le-formRow">
                                  <label className="le-label">Phone Number Correct? *</label>
                                  <select
                                    className={`le-input ${attemptErrors.phoneValidation ? "error" : ""}`}
                                    value={validateForm.phoneValidation}
                                    onChange={(e) => {
                                      const nextValidation = e.target.value;
                                      setValidateForm({ phoneValidation: nextValidation });
                                      if (nextValidation !== "CORRECT") {
                                        setInterestForm({ interestLevel: "", preferredChannel: "", preferredChannelOther: "" });
                                        setMeetingForm({
                                          meetingDate: "",
                                          meetingStartTime: "",
                                          meetingDurationMin: 120,
                                          meetingMode: "",
                                          meetingPlatform: "",
                                          meetingPlatformOther: "",
                                          meetingLink: "",
                                          meetingInviteSent: false,
                                          meetingPlace: "",
                                        });
                                      }
                                      setAttemptErrors((er) => ({
                                        ...er,
                                        phoneValidation: undefined,
                                        interestLevel: undefined,
                                        preferredChannel: undefined,
                                        preferredChannelOther: undefined,
                                        meetingDate: undefined,
                                    meetingStartTime: undefined,
                                    meetingDurationMin: undefined,
                                        meetingMode: undefined,
                                        meetingPlatform: undefined,
                                        meetingPlatformOther: undefined,
                                        meetingLink: undefined,
                                        meetingInviteSent: undefined,
                                        meetingPlace: undefined,
                                      }));
                                    }}
                                    disabled={addingAttempt}
                                  >
                                    <option value="">Select</option>
                                    <option value="CORRECT">Correct</option>
                                    <option value="WRONG_CONTACT">Wrong</option>
                                  </select>
                                </div>

                                {attemptErrors.phoneValidation ? (
                                  <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                    {attemptErrors.phoneValidation}
                                  </div>
                                ) : null}
                              </>
                            )}

                            {attemptForm.response === "Responded" && validateForm.phoneValidation === "CORRECT" && (
                              <>
                                <div className="le-activitySectionHeader">3. Assess Interest</div>

                                <div className="le-formRow">
                                  <label className="le-label">Interest Level *</label>
                                  <select
                                    className={`le-input ${attemptErrors.interestLevel ? "error" : ""}`}
                                    value={interestForm.interestLevel}
                                    onChange={(e) => {
                                      const nextInterestLevel = e.target.value;
                                      setInterestForm((f) => ({
                                        ...f,
                                        interestLevel: nextInterestLevel,
                                        preferredChannel: "",
                                        preferredChannelOther: "",
                                      }));
                                      if (nextInterestLevel !== "INTERESTED") {
                                        setMeetingForm({
                                          meetingDate: "",
                                          meetingStartTime: "",
                                          meetingDurationMin: 120,
                                          meetingMode: "",
                                          meetingPlatform: "",
                                          meetingPlatformOther: "",
                                          meetingLink: "",
                                          meetingInviteSent: false,
                                          meetingPlace: "",
                                        });
                                      }
                                      setAttemptErrors((er) => ({
                                        ...er,
                                        interestLevel: undefined,
                                        preferredChannel: undefined,
                                        preferredChannelOther: undefined,
                                        meetingDate: undefined,
                                    meetingStartTime: undefined,
                                    meetingDurationMin: undefined,
                                        meetingMode: undefined,
                                        meetingPlatform: undefined,
                                        meetingPlatformOther: undefined,
                                        meetingLink: undefined,
                                        meetingInviteSent: undefined,
                                        meetingPlace: undefined,
                                      }));
                                    }}
                                    disabled={addingAttempt}
                                  >
                                    <option value="">Select</option>
                                    <option value="INTERESTED">Interested</option>
                                    <option value="NOT_INTERESTED">Not Interested</option>
                                  </select>
                                </div>

                                {attemptErrors.interestLevel ? (
                                  <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                    {attemptErrors.interestLevel}
                                  </div>
                                ) : null}

                                {interestForm.interestLevel === "INTERESTED" ? (
                                  <>
                                    <div className="le-formRow">
                                      <label className="le-label">Preferred Communication Channel *</label>
                                      <select
                                        className={`le-input ${attemptErrors.preferredChannel ? "error" : ""}`}
                                        value={interestForm.preferredChannel}
                                        onChange={(e) => {
                                          setInterestForm((f) => ({ ...f, preferredChannel: e.target.value }));
                                          setAttemptErrors((er) => ({
                                            ...er,
                                            preferredChannel: undefined,
                                            preferredChannelOther: undefined,
                                          }));
                                        }}
                                        disabled={addingAttempt}
                                      >
                                        <option value="">Select</option>
                                        <option value="SMS">SMS</option>
                                        <option value="WhatsApp">WhatsApp</option>
                                        <option value="Viber">Viber</option>
                                        <option value="Telegram">Telegram</option>
                                        <option value="Other">Other</option>
                                      </select>
                                    </div>

                                    {attemptErrors.preferredChannel ? (
                                      <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                        {attemptErrors.preferredChannel}
                                      </div>
                                    ) : null}

                                    {interestForm.preferredChannel === "Other" && (
                                      <div className="le-formRow">
                                        <label className="le-label">Other Channel *</label>
                                        <input
                                          className={`le-input ${attemptErrors.preferredChannelOther ? "error" : ""}`}
                                          value={interestForm.preferredChannelOther}
                                          onChange={(e) => {
                                            setInterestForm((f) => ({ ...f, preferredChannelOther: e.target.value }));
                                            setAttemptErrors((er) => ({ ...er, preferredChannelOther: undefined }));
                                          }}
                                          disabled={addingAttempt}
                                        />
                                      </div>
                                    )}

                                    {attemptErrors.preferredChannelOther ? (
                                      <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                        {attemptErrors.preferredChannelOther}
                                      </div>
                                    ) : null}
                                  </>
                                ) : null}
                              </>
                            )}

                            {attemptForm.response === "Responded" &&
                              validateForm.phoneValidation === "CORRECT" &&
                              interestForm.interestLevel === "INTERESTED" && (
                                <>
                                  <div className="le-activitySectionHeader">4. Schedule Meeting</div>

                                  <div className="le-formRow">
                                    <label className="le-label">Meeting Date *</label>
                                    <select
                                      className={`le-input ${attemptErrors.meetingDate ? "error" : ""}`}
                                      value={meetingForm.meetingDate}
                                      onChange={(e) => {
                                        setMeetingForm((f) => ({ ...f, meetingDate: e.target.value, meetingStartTime: "" }));
                                        setAttemptErrors((er) => ({ ...er, meetingDate: undefined, meetingStartTime: undefined }));
                                      }}
                                      disabled={addingAttempt || loadingAvailability}
                                    >
                                      <option value="">Select date</option>
                                      {availableDateOptions.map((d) => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {attemptErrors.meetingDate ? (
                                    <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                      {attemptErrors.meetingDate}
                                    </div>
                                  ) : null}

                                  <div className="le-formRow">
                                    <label className="le-label">Duration *</label>
                                    <select
                                      className={`le-input ${attemptErrors.meetingDurationMin ? "error" : ""}`}
                                      value={meetingForm.meetingDurationMin}
                                      onChange={(e) => {
                                        const nextDuration = Number(e.target.value || 120);
                                        setMeetingForm((f) => ({ ...f, meetingDurationMin: nextDuration, meetingStartTime: "" }));
                                        setAttemptErrors((er) => ({ ...er, meetingDurationMin: undefined, meetingStartTime: undefined }));
                                      }}
                                      disabled={addingAttempt}
                                    >
                                      <option value={30}>30 mins</option>
                                      <option value={60}>60 mins</option>
                                      <option value={90}>90 mins</option>
                                      <option value={120}>120 mins</option>
                                    </select>
                                  </div>

                                  {attemptErrors.meetingDurationMin ? (
                                    <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                      {attemptErrors.meetingDurationMin}
                                    </div>
                                  ) : null}

                                  <div className="le-formRow">
                                    <label className="le-label">Start Time *</label>
                                    <select
                                      className={`le-input ${attemptErrors.meetingStartTime ? "error" : ""}`}
                                      value={meetingForm.meetingStartTime}
                                      onChange={(e) => {
                                        setMeetingForm((f) => ({ ...f, meetingStartTime: e.target.value }));
                                        setAttemptErrors((er) => ({ ...er, meetingStartTime: undefined }));
                                      }}
                                      disabled={addingAttempt || !meetingForm.meetingDate}
                                    >
                                      <option value="">Select time</option>
                                      {meetingStartSlots.map((slot) => {
                                        const booked = isSlotBooked(meetingForm.meetingDate, slot, meetingForm.meetingDurationMin);
                                        return (
                                          <option key={slot} value={slot} disabled={booked}>
                                            {formatTimeLabel(slot)}{booked ? " (Booked)" : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>

                                  {attemptErrors.meetingStartTime ? (
                                    <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                      {attemptErrors.meetingStartTime}
                                    </div>
                                  ) : null}

                                  <div className="le-formRow">
                                    <label className="le-label">Meeting Mode *</label>
                                    <select
                                      className={`le-input ${attemptErrors.meetingMode ? "error" : ""}`}
                                      value={meetingForm.meetingMode}
                                      onChange={(e) => {
                                        setMeetingForm((f) => ({
                                          ...f,
                                          meetingMode: e.target.value,
                                          meetingPlatform: "",
                                          meetingPlatformOther: "",
                                          meetingLink: "",
                                          meetingPlace: "",
                                        }));
                                        setAttemptErrors((er) => ({
                                          ...er,
                                          meetingMode: undefined,
                                          meetingPlatform: undefined,
                                          meetingPlatformOther: undefined,
                                          meetingLink: undefined,
                                          meetingInviteSent: undefined,
                                          meetingPlace: undefined,
                                        }));
                                      }}
                                      disabled={addingAttempt}
                                    >
                                      <option value="">Select</option>
                                      <option value="Online">Online</option>
                                      <option value="Face-to-face">Face-to-face</option>
                                    </select>
                                  </div>

                                  {attemptErrors.meetingMode ? (
                                    <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                      {attemptErrors.meetingMode}
                                    </div>
                                  ) : null}

                                  {meetingForm.meetingMode === "Online" && (
                                    <>
                                      <div className="le-formRow">
                                        <label className="le-label">Platform *</label>
                                        <select
                                          className={`le-input ${attemptErrors.meetingPlatform ? "error" : ""}`}
                                          value={meetingForm.meetingPlatform}
                                          onChange={(e) => {
                                            setMeetingForm((f) => ({ ...f, meetingPlatform: e.target.value }));
                                            setAttemptErrors((er) => ({
                                              ...er,
                                              meetingPlatform: undefined,
                                              meetingPlatformOther: undefined,
                                            }));
                                          }}
                                          disabled={addingAttempt}
                                        >
                                          <option value="">Select</option>
                                          <option value="Zoom">Zoom</option>
                                          <option value="Google Meet">Google Meet</option>
                                          <option value="Other">Other</option>
                                        </select>
                                      </div>

                                      {attemptErrors.meetingPlatform ? (
                                        <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                          {attemptErrors.meetingPlatform}
                                        </div>
                                      ) : null}

                                      {meetingForm.meetingPlatform === "Other" && (
                                        <div className="le-formRow">
                                          <label className="le-label">Other Platform *</label>
                                          <input
                                            className={`le-input ${attemptErrors.meetingPlatformOther ? "error" : ""}`}
                                            value={meetingForm.meetingPlatformOther}
                                            onChange={(e) => {
                                              setMeetingForm((f) => ({ ...f, meetingPlatformOther: e.target.value }));
                                              setAttemptErrors((er) => ({ ...er, meetingPlatformOther: undefined }));
                                            }}
                                            disabled={addingAttempt}
                                          />
                                        </div>
                                      )}

                                      {attemptErrors.meetingPlatformOther ? (
                                        <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                          {attemptErrors.meetingPlatformOther}
                                        </div>
                                      ) : null}

                                      <div className="le-formRow">
                                        <label className="le-label">Meeting Link *</label>
                                        <input
                                          className={`le-input ${attemptErrors.meetingLink ? "error" : ""}`}
                                          value={meetingForm.meetingLink}
                                          onChange={(e) => {
                                            setMeetingForm((f) => ({ ...f, meetingLink: e.target.value }));
                                            setAttemptErrors((er) => ({ ...er, meetingLink: undefined }));
                                          }}
                                          disabled={addingAttempt}
                                          placeholder="https://example.com/meeting-link"
                                        />
                                      </div>

                                      {attemptErrors.meetingLink ? (
                                        <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                          {attemptErrors.meetingLink}
                                        </div>
                                      ) : null}

                                      <div className="le-formRow">
                                        <label className="le-check">
                                          <input
                                            type="checkbox"
                                            checked={meetingForm.meetingInviteSent}
                                            onChange={(e) => {
                                              setMeetingForm((f) => ({ ...f, meetingInviteSent: e.target.checked }));
                                              setAttemptErrors((er) => ({ ...er, meetingInviteSent: undefined }));
                                            }}
                                            disabled={addingAttempt}
                                          />
                                          <span>I confirm invite link has been sent (required)</span>
                                        </label>
                                      </div>

                                      {attemptErrors.meetingInviteSent ? (
                                        <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                          {attemptErrors.meetingInviteSent}
                                        </div>
                                      ) : null}
                                    </>
                                  )}

                                  {meetingForm.meetingMode === "Face-to-face" && (
                                    <div className="le-formRow">
                                      <label className="le-label">Meeting Place *</label>
                                      <input
                                        className={`le-input ${attemptErrors.meetingPlace ? "error" : ""}`}
                                        value={meetingForm.meetingPlace}
                                        onChange={(e) => {
                                          setMeetingForm((f) => ({ ...f, meetingPlace: e.target.value }));
                                          setAttemptErrors((er) => ({ ...er, meetingPlace: undefined }));
                                        }}
                                        disabled={addingAttempt}
                                      />
                                    </div>
                                  )}

                                  {attemptErrors.meetingPlace ? (
                                    <div className="le-smallNote" style={{ color: "#DA291C" }}>
                                      {attemptErrors.meetingPlace}
                                    </div>
                                  ) : null}
                                </>
                              )}

                            <div className="le-actions">
                              <button type="button" className="le-btn secondary" onClick={onCancelAddAttempt} disabled={addingAttempt}>
                                Cancel
                              </button>
                              <button type="button" className="le-btn primary" onClick={onSubmitAttempt} disabled={addingAttempt}>
                                {addingAttempt ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="le-attemptList">
                          {attempts.map((a) => {
                            const hasPhoneValidation = !!String(a.phoneValidation || "").trim();
                            const hasInterest = !!String(a.interestLevel || "").trim();
                            const hasPreferredChannel = !!String(a.preferredChannel || "").trim();
                            const hasMeetingData =
                              !!a.meetingAt ||
                              !!String(a.meetingMode || "").trim() ||
                              !!String(a.meetingPlatform || "").trim() ||
                              !!String(a.meetingPlatformOther || "").trim() ||
                              !!String(a.meetingLink || "").trim() ||
                              !!String(a.meetingPlace || "").trim() ||
                              !!Number(a.meetingDurationMin || 0) ||
                              !!a.meetingEndAt;

                            return (
                              <div key={a.attemptNo} className="le-attemptItem">
                                <div className="le-attemptTop">
                                  <strong>Attempt #{a.attemptNo}</strong>
                                  <span className="le-attemptDate">{formatDateTime(a.attemptedAt)}</span>
                                </div>

                                <div className="le-attemptMeta">
                                  <div>
                                    <span className="le-metaLabel">Primary Channel</span>
                                    <span className="le-metaValue">{a.primaryChannel}</span>
                                  </div>
                                  <div>
                                    <span className="le-metaLabel">Others</span>
                                    <span className="le-metaValue">
                                      {a.otherChannels?.length ? a.otherChannels.join(", ") : "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="le-metaLabel">Result</span>
                                    <span className="le-metaValue">{a.response}</span>
                                  </div>
                                  <div>
                                    <span className="le-metaLabel">Phone No. Ver. Used</span>
                                    <span className="le-metaValue">{a.contactInfoVersionUsed ?? "—"}</span>
                                  </div>

                                  {hasPhoneValidation ? (
                                    <div>
                                      <span className="le-metaLabel">Phone Validation</span>
                                      <span className="le-metaValue">{a.phoneValidation}</span>
                                    </div>
                                  ) : null}

                                  {hasInterest ? (
                                    <div>
                                      <span className="le-metaLabel">Interest Level</span>
                                      <span className="le-metaValue">{a.interestLevel}</span>
                                    </div>
                                  ) : null}

                                  {hasPreferredChannel ? (
                                    <div>
                                      <span className="le-metaLabel">Preferred Channel</span>
                                      <span className="le-metaValue">{a.preferredChannel}</span>
                                    </div>
                                  ) : null}

                                  {String(a.preferredChannelOther || "").trim() ? (
                                    <div>
                                      <span className="le-metaLabel">Preferred Channel (Other)</span>
                                      <span className="le-metaValue">{a.preferredChannelOther}</span>
                                    </div>
                                  ) : null}
                                </div>

                                {hasMeetingData ? (
                                  <>
                                    <div className="le-attemptSectionHeader">Meeting Details</div>
                                    <div className="le-attemptMeta">
                                      <div>
                                        <span className="le-metaLabel">Meeting Date & Time</span>
                                        <span className="le-metaValue">{formatDateTime(a.meetingAt)}</span>
                                      </div>

                                      {Number(a.meetingDurationMin || 0) > 0 ? (
                                        <div>
                                          <span className="le-metaLabel">Meeting Duration</span>
                                          <span className="le-metaValue">{a.meetingDurationMin} mins</span>
                                        </div>
                                      ) : null}

                                      {a.meetingEndAt ? (
                                        <div>
                                          <span className="le-metaLabel">Meeting Ends</span>
                                          <span className="le-metaValue">{formatDateTime(a.meetingEndAt)}</span>
                                        </div>
                                      ) : null}

                                      {String(a.meetingMode || "").trim() ? (
                                        <div>
                                          <span className="le-metaLabel">Meeting Mode</span>
                                          <span className="le-metaValue">{a.meetingMode}</span>
                                        </div>
                                      ) : null}

                                      {String(a.meetingPlatform || "").trim() ? (
                                        <div>
                                          <span className="le-metaLabel">Meeting Platform</span>
                                          <span className="le-metaValue">{a.meetingPlatform}</span>
                                        </div>
                                      ) : null}

                                      {String(a.meetingPlatformOther || "").trim() ? (
                                        <div>
                                          <span className="le-metaLabel">Meeting Platform (Other)</span>
                                          <span className="le-metaValue">{a.meetingPlatformOther}</span>
                                        </div>
                                      ) : null}

                                      {String(a.meetingLink || "").trim() ? (
                                        <div>
                                          <span className="le-metaLabel">Meeting Link</span>
                                          <span className="le-metaValue">{a.meetingLink}</span>
                                        </div>
                                      ) : null}

                                      {String(a.meetingMode || "").trim() === "Online" ? (
                                        <div>
                                          <span className="le-metaLabel">Meeting Invite Sent</span>
                                          <span className="le-metaValue">{a.meetingInviteSent ? "Yes" : "No"}</span>
                                        </div>
                                      ) : null}

                                      {String(a.meetingPlace || "").trim() ? (
                                        <div>
                                          <span className="le-metaLabel">Meeting Place</span>
                                          <span className="le-metaValue">{a.meetingPlace}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </>
                                ) : null}

                                {String(a.notes || "").trim() ? (
                                  <div className="le-attemptNotes">
                                    <span className="le-metaLabel">Notes</span>
                                    <div className="le-metaValue">{a.notes}</div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}

                          {!showAddAttempt && attempts.length === 0 && (
                            <div className="le-muted" style={{ padding: "10px 0" }}>
                              No contact attempts yet.
                            </div>
                          )}
                        </div>
                      </div>

                      {!showAddAttempt && isEngagementBlocked && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Validate Contact</h4>
                          <div className="le-formRow">
                            <label className="le-label">Phone Number Correct?</label>
                            <select className="le-input" value="WRONG_CONTACT" disabled>
                              <option value="WRONG_CONTACT">Wrong</option>
                            </select>
                          </div>
                          <p className="le-muted" style={{ marginTop: 8 }}>
                            Contact was marked wrong. Update phone number to continue.
                          </p>
                        </div>
                      )}

                      {!showAddAttempt && showValidateContact && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Validate Contact</h4>

                          {validateError ? (
                            <div className="le-formError" style={{ color: "#DA291C", marginBottom: 10 }}>
                              {validateError}
                            </div>
                          ) : null}

                          <div className="le-formRow">
                            <label className="le-label">Phone Number Correct?</label>
                            <select
                              className="le-input"
                              value={validateForm.phoneValidation}
                              onChange={(e) => {
                                setValidateForm({ phoneValidation: e.target.value });
                                setValidateError("");
                              }}
                              disabled={validatingContact || uiLocked || isContactingReadOnly}
                            >
                              <option value="">Select</option>
                              <option value="CORRECT">Correct</option>
                              <option value="WRONG_CONTACT">Wrong</option>
                            </select>
                          </div>

                          <div className="le-actions">
                            <button
                              type="button"
                              className="le-btn secondary"
                              onClick={() => {
                                setValidateForm({ phoneValidation: "" });
                                setValidateError("");
                              }}
                              disabled={validatingContact || uiLocked || isContactingReadOnly}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="le-btn primary"
                              onClick={submitValidateContact}
                              disabled={validatingContact || uiLocked || isContactingReadOnly}
                            >
                              {validatingContact ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      )}

                      {!showAddAttempt && isViewingCurrentStage && !isContactingReadOnly && currentActivityKeyRaw === "Assess Interest" && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Assess Interest</h4>

                          {interestError ? (
                            <div className="le-formError" style={{ color: "#DA291C", marginBottom: 10 }}>
                              {interestError}
                            </div>
                          ) : null}

                          <div className="le-formRow">
                            <label className="le-label">Interest Level *</label>
                            <select
                              className="le-input"
                              value={interestForm.interestLevel}
                              onChange={(e) =>
                                setInterestForm((f) => ({
                                  ...f,
                                  interestLevel: e.target.value,
                                  preferredChannel: "",
                                  preferredChannelOther: "",
                                }))
                              }
                              disabled={savingInterest}
                            >
                              <option value="">Select</option>
                              <option value="INTERESTED">Interested</option>
                              <option value="NOT_INTERESTED">Not Interested</option>
                            </select>
                          </div>

                          {interestForm.interestLevel === "INTERESTED" && (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Preferred Communication Channel *</label>
                                <select
                                  className="le-input"
                                  value={interestForm.preferredChannel}
                                  onChange={(e) => setInterestForm((f) => ({ ...f, preferredChannel: e.target.value }))}
                                  disabled={savingInterest}
                                >
                                  <option value="">Select</option>
                                  <option value="SMS">SMS</option>
                                  <option value="WhatsApp">WhatsApp</option>
                                  <option value="Viber">Viber</option>
                                  <option value="Telegram">Telegram</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>

                              {interestForm.preferredChannel === "Other" && (
                                <div className="le-formRow">
                                  <label className="le-label">Other Channel *</label>
                                  <input
                                    className="le-input"
                                    value={interestForm.preferredChannelOther}
                                    onChange={(e) =>
                                      setInterestForm((f) => ({ ...f, preferredChannelOther: e.target.value }))
                                    }
                                    disabled={savingInterest}
                                  />
                                </div>
                              )}
                            </>
                          )}

                          <div className="le-actions">
                            <button
                              type="button"
                              className="le-btn secondary"
                              onClick={() =>
                                setInterestForm({ interestLevel: "", preferredChannel: "", preferredChannelOther: "" })
                              }
                              disabled={savingInterest}
                            >
                              Cancel
                            </button>
                            <button type="button" className="le-btn primary" onClick={submitAssessInterest} disabled={savingInterest}>
                              {savingInterest ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      )}

                      {!showAddAttempt && isViewingCurrentStage && !isContactingReadOnly && currentActivityKeyRaw === "Schedule Meeting" && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Schedule Meeting</h4>

                          {meetingError ? (
                            <div className="le-formError" style={{ color: "#DA291C", marginBottom: 10 }}>
                              {meetingError}
                            </div>
                          ) : null}

                          <div className="le-formRow">
                            <label className="le-label">Meeting Date *</label>
                            <select
                              className="le-input"
                              value={meetingForm.meetingDate}
                              onChange={(e) => setMeetingForm((f) => ({ ...f, meetingDate: e.target.value, meetingStartTime: "" }))}
                              disabled={savingMeeting || loadingAvailability}
                            >
                              <option value="">Select date</option>
                              {availableDateOptions.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Duration *</label>
                            <select
                              className="le-input"
                              value={meetingForm.meetingDurationMin}
                              onChange={(e) => setMeetingForm((f) => ({ ...f, meetingDurationMin: Number(e.target.value || 120), meetingStartTime: "" }))}
                              disabled={savingMeeting}
                            >
                              <option value={30}>30 mins</option>
                              <option value={60}>60 mins</option>
                              <option value={90}>90 mins</option>
                              <option value={120}>120 mins</option>
                            </select>
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Start Time *</label>
                            <select
                              className="le-input"
                              value={meetingForm.meetingStartTime}
                              onChange={(e) => setMeetingForm((f) => ({ ...f, meetingStartTime: e.target.value }))}
                              disabled={savingMeeting || !meetingForm.meetingDate}
                            >
                              <option value="">Select time</option>
                              {meetingStartSlots.map((slot) => {
                                const booked = isSlotBooked(meetingForm.meetingDate, slot, meetingForm.meetingDurationMin);
                                return (
                                  <option key={slot} value={slot} disabled={booked}>
                                    {formatTimeLabel(slot)}{booked ? " (Booked)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Meeting Mode *</label>
                            <select
                              className="le-input"
                              value={meetingForm.meetingMode}
                              onChange={(e) =>
                                setMeetingForm((f) => ({
                                  ...f,
                                  meetingMode: e.target.value,
                                  meetingPlatform: "",
                                  meetingPlatformOther: "",
                                  meetingLink: "",
                                  meetingPlace: "",
                                }))
                              }
                              disabled={savingMeeting}
                            >
                              <option value="">Select</option>
                              <option value="Online">Online</option>
                              <option value="Face-to-face">Face-to-face</option>
                            </select>
                          </div>

                          {meetingForm.meetingMode === "Online" && (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Platform *</label>
                                <select
                                  className="le-input"
                                  value={meetingForm.meetingPlatform}
                                  onChange={(e) => setMeetingForm((f) => ({ ...f, meetingPlatform: e.target.value }))}
                                  disabled={savingMeeting}
                                >
                                  <option value="">Select</option>
                                  <option value="Zoom">Zoom</option>
                                  <option value="Google Meet">Google Meet</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>

                              {meetingForm.meetingPlatform === "Other" && (
                                <div className="le-formRow">
                                  <label className="le-label">Other Platform *</label>
                                  <input
                                    className="le-input"
                                    value={meetingForm.meetingPlatformOther}
                                    onChange={(e) =>
                                      setMeetingForm((f) => ({ ...f, meetingPlatformOther: e.target.value }))
                                    }
                                    disabled={savingMeeting}
                                  />
                                </div>
                              )}

                              <div className="le-formRow">
                                <label className="le-label">Meeting Link *</label>
                                <input
                                  className="le-input"
                                  value={meetingForm.meetingLink}
                                  onChange={(e) => setMeetingForm((f) => ({ ...f, meetingLink: e.target.value }))}
                                  disabled={savingMeeting}
                                  placeholder="https://example.com/meeting-link"
                                />
                              </div>

                              <div className="le-formRow">
                                <label className="le-check">
                                  <input
                                    type="checkbox"
                                    checked={meetingForm.meetingInviteSent}
                                    onChange={(e) => setMeetingForm((f) => ({ ...f, meetingInviteSent: e.target.checked }))}
                                    disabled={savingMeeting}
                                  />
                                  <span>I confirm invite link has been sent (required)</span>
                                </label>
                              </div>
                            </>
                          )}

                          {meetingForm.meetingMode === "Face-to-face" && (
                            <div className="le-formRow">
                              <label className="le-label">Meeting Place *</label>
                              <input
                                className="le-input"
                                value={meetingForm.meetingPlace}
                                onChange={(e) => setMeetingForm((f) => ({ ...f, meetingPlace: e.target.value }))}
                                disabled={savingMeeting}
                                placeholder="Enter full place/address"
                              />
                            </div>
                          )}

                          <div className="le-actions">
                            <button
                              type="button"
                              className="le-btn secondary"
                              onClick={() =>
                                setMeetingForm({
                                  meetingDate: "",
                                  meetingStartTime: "",
                                  meetingDurationMin: 120,
                                  meetingMode: "",
                                  meetingPlatform: "",
                                  meetingPlatformOther: "",
                                  meetingLink: "",
                                  meetingInviteSent: false,
                                  meetingPlace: "",
                                })
                              }
                              disabled={savingMeeting}
                            >
                              Cancel
                            </button>
                            <button type="button" className="le-btn primary" onClick={submitScheduleMeeting} disabled={savingMeeting}>
                              {savingMeeting ? "Saving..." : "Save Meeting"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {showNeedsAssessmentPanel && (
                    <>
                      <div className="le-block">
                        <h4 className="le-blockTitle">Prospect Attendance</h4>
                        {needsAssessmentLoading ? <p className="le-muted">Loading needs assessment...</p> : null}
                        {needsAssessmentError ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{needsAssessmentError}</p> : null}
                        {needsAssessmentSavedAt ? <p className="le-smallNote" style={{ color: "#0f766e" }}>Saved successfully.</p> : null}

                        <div className="le-formRow" style={{ alignItems: "center" }}>
                          <label className="le-label">Prospect Attended? *</label>
                          <div className="le-checkboxGrid">
                            <label className="le-check">
                              <input
                                type="radio"
                                name="prospect-attendance"
                                checked={needsAssessmentForm.attendanceChoice === "YES"}
                                onChange={() => setNeedsAssessmentForm((f) => ({ ...f, attendanceChoice: "YES" }))}
                                disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}
                              />
                              <span>Yes</span>
                            </label>
                            <label className="le-check">
                              <input
                                type="radio"
                                name="prospect-attendance"
                                checked={needsAssessmentForm.attendanceChoice === "NO"}
                                onChange={() => setNeedsAssessmentForm((f) => ({ ...f, attendanceChoice: "NO" }))}
                                disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}
                              />
                              <span>No</span>
                            </label>
                          </div>
                        </div>

                        {needsAssessmentForm.attendanceChoice === "NO" ? (
                          <p className="le-muted" style={{ marginTop: 8 }}>
                            Prospect must be marked as attended before Prospect&apos;s Basic Information can be completed.
                          </p>
                        ) : null}
                      </div>

                      {needsAssessmentForm.attendanceChoice === "YES" && (
                        <div className="le-block">
                          <div className="le-blockHeader">
                            <h4 className="le-blockTitle">Prospect&apos;s Basic Information</h4>
                            <button
                              type="button"
                              className="le-btn secondary"
                              onClick={() => setNeedsSectionOpen((s) => ({ ...s, basicInformation: !s.basicInformation }))}
                              aria-label={needsSectionOpen.basicInformation ? "Collapse basic information" : "Expand basic information"}
                            >
                              {needsSectionOpen.basicInformation ? "▴" : "▾"}
                            </button>
                          </div>

                          {needsSectionOpen.basicInformation && (
                            <>

                          <div className="le-formRow">
                            <label className="le-label">Name</label>
                            <input className="le-input" value={needsAssessmentForm.basicInformation.fullName || ""} disabled />
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Civil Status *</label>
                            <select
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.civilStatus || ""}
                              onChange={(e) =>
                                setNeedsAssessmentForm((f) => ({
                                  ...f,
                                  basicInformation: { ...f.basicInformation, civilStatus: e.target.value },
                                }))
                              }
                              disabled={!isNeedsAssessmentEditableNow}
                            >
                              <option value="">Select</option>
                              <option value="Single">Single</option>
                              <option value="Married">Married</option>
                              <option value="Widowed">Widowed</option>
                              <option value="Separated">Separated</option>
                              <option value="Annulled">Annulled</option>
                            </select>
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Birthday *</label>
                            <input
                              className="le-input"
                              type="date"
                              value={needsAssessmentForm.basicInformation.birthday || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setNeedsAssessmentForm((f) => ({
                                  ...f,
                                  basicInformation: {
                                    ...f.basicInformation,
                                    birthday: v,
                                    age: v ? (computeAgeFromBirthday(v) ?? "") : f.basicInformation.age,
                                  },
                                }));
                              }}
                              disabled={!isNeedsAssessmentEditableNow}
                            />
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Age *</label>
                            <input className="le-input" value={needsAssessmentForm.basicInformation.age ?? ""} disabled />
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Occupation Category *</label>
                            <select
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.occupationCategory || "Not Employed"}
                              onChange={(e) =>
                                setNeedsAssessmentForm((f) => ({
                                  ...f,
                                  basicInformation: {
                                    ...f.basicInformation,
                                    occupationCategory: e.target.value,
                                    occupation: e.target.value === "Not Employed" ? "" : f.basicInformation.occupation,
                                  },
                                }))
                              }
                              disabled={!isNeedsAssessmentEditableNow}
                            >
                              <option value="Employed">Employed</option>
                              <option value="Self-Employed">Self-Employed</option>
                              <option value="Not Employed">Not Employed</option>
                            </select>
                          </div>

                          { ["Employed", "Self-Employed"].includes(String(needsAssessmentForm.basicInformation.occupationCategory || "")) && (
                          <div className="le-formRow">
                            <label className="le-label">Occupation *</label>
                            <input
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.occupation || ""}
                              onChange={(e) =>
                                setNeedsAssessmentForm((f) => ({
                                  ...f,
                                  basicInformation: { ...f.basicInformation, occupation: e.target.value },
                                }))
                              }
                              disabled={!isNeedsAssessmentEditableNow}
                            />
                          </div>
                          )}

                          <div className="le-formRow">
                            <label className="le-label">Street Address *</label>
                            <input
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.addressLine || ""}
                              onChange={(e) => setNeedsAssessmentForm((f) => ({ ...f, basicInformation: { ...f.basicInformation, addressLine: e.target.value } }))}
                              disabled={!isNeedsAssessmentEditableNow}
                            />
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Barangay *</label>
                            <input
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.barangay || ""}
                              onChange={(e) => setNeedsAssessmentForm((f) => ({ ...f, basicInformation: { ...f.basicInformation, barangay: e.target.value } }))}
                              disabled={!isNeedsAssessmentEditableNow}
                            />
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">City *</label>
                            <select
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.city || ""}
                              onChange={(e) => {
                                const city = e.target.value;
                                const region = city === "Other" ? (needsAssessmentForm.basicInformation.region || "") : (CITY_TO_REGION[city] || "");
                                setNeedsAssessmentForm((f) => ({
                                  ...f,
                                  basicInformation: {
                                    ...f.basicInformation,
                                    city,
                                    otherCity: city === "Other" ? f.basicInformation.otherCity : "",
                                    region,
                                    country: "Philippines",
                                  },
                                }));
                              }}
                              disabled={!isNeedsAssessmentEditableNow}
                            >
                              <option value="">Select city</option>
                              
                              {cityOptions.map((item) => (<option key={item.city} value={item.city}>{item.city}</option>))}
                            </select>
                          </div>

                          {String(needsAssessmentForm.basicInformation.city || "") === "Other" && (
                            <div className="le-formRow">
                              <label className="le-label">Other City *</label>
                              <input
                                className="le-input"
                                value={needsAssessmentForm.basicInformation.otherCity || ""}
                                onChange={(e) => setNeedsAssessmentForm((f) => ({ ...f, basicInformation: { ...f.basicInformation, otherCity: e.target.value } }))}
                                disabled={!isNeedsAssessmentEditableNow}
                              />
                            </div>
                          )}

                          <div className="le-formRow">
                            <label className="le-label">Region *</label>
                            <input
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.region || ""}
                              onChange={(e) => setNeedsAssessmentForm((f) => ({ ...f, basicInformation: { ...f.basicInformation, region: e.target.value } }))}
                              readOnly={String(needsAssessmentForm.basicInformation.city || "") !== "Other"}
                              disabled={!isNeedsAssessmentEditableNow}
                            />
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Zip Code *</label>
                            <input
                              className="le-input"
                              inputMode="numeric"
                              value={needsAssessmentForm.basicInformation.zipCode || ""}
                              onChange={(e) => setNeedsAssessmentForm((f) => ({ ...f, basicInformation: { ...f.basicInformation, zipCode: String(e.target.value).replace(/[^\d]/g, "").slice(0, 4) } }))}
                              disabled={!isNeedsAssessmentEditableNow}
                            />
                          </div>

                          <div className="le-formRow">
                            <label className="le-label">Country</label>
                            <input className="le-input" value="Philippines" disabled />
                          </div>

                          <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Dependents (optional)</h5>
                          <div className="le-blockHeader">
                            <span className="le-muted">Add if applicable</span>
                            <button
                              type="button"
                              className="le-btn secondary"
                              onClick={addDependent}
                              disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}
                            >
                              + Add Another Dependent
                            </button>
                          </div>

                          {(needsAssessmentForm.dependents || []).map((d, idx) => (
                            <div key={`dep-${idx}`} className="le-attemptItem" style={{ marginTop: 10 }}>
                              <div className="le-formRow"><label className="le-label">Name *</label><input className="le-input" value={d.name || ""} onChange={(e) => updateDependent(idx, "name", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                              <div className="le-formRow"><label className="le-label">Age *</label><input className="le-input" inputMode="numeric" value={d.age ?? ""} onChange={(e) => updateDependent(idx, "age", String(e.target.value).replace(/[^\d]/g, ""))} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                              <div className="le-formRow"><label className="le-label">Gender *</label><select className="le-input" value={d.gender || ""} onChange={(e) => updateDependent(idx, "gender", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
                              <div className="le-formRow"><label className="le-label">Relationship *</label><select className="le-input" value={d.relationship || ""} onChange={(e) => updateDependent(idx, "relationship", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="Child">Child</option><option value="Parent">Parent</option><option value="Sibling">Sibling</option></select></div>
                              <div className="le-actions"><button type="button" className="le-btn secondary" onClick={() => removeDependent(idx)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}>Remove</button></div>
                            </div>
                          ))}

                          <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Existing PRU Life UK Policies (optional)</h5>
                          {!needsAssessmentForm.existingPolicies?.length ? (
                            <p className="le-muted" style={{ marginTop: 8 }}>No existing policy found.</p>
                          ) : (
                            <div className="le-attemptList" style={{ marginTop: 8 }}>
                              {needsAssessmentForm.existingPolicies.map((p, idx) => (
                                <div key={`${p.policyNumber}-${idx}`} className="le-attemptItem">
                                  <div className="le-attemptMeta">
                                    <div><span className="le-metaLabel">Policy Number</span><span className="le-metaValue">{p.policyNumber || "—"}</span></div>
                                    <div><span className="le-metaLabel">Product Name</span><span className="le-metaValue">{p.productName || "—"}</span></div>
                                    <div><span className="le-metaLabel">Status</span><span className="le-metaValue">{p.status || "—"}</span></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                            </>
                          )}

                          <div className="le-blockHeader withTopBorder">
                            <h4 className="le-blockTitle">Needs and Priorities</h4>
                            <button
                              type="button"
                              className="le-btn secondary"
                              onClick={() => setNeedsSectionOpen((s) => ({ ...s, needsPriorities: !s.needsPriorities }))}
                              aria-label={needsSectionOpen.needsPriorities ? "Collapse needs and priorities" : "Expand needs and priorities"}
                            >
                              {needsSectionOpen.needsPriorities ? "▴" : "▾"}
                            </button>
                          </div>

                          {needsSectionOpen.needsPriorities && (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Current Priority *</label>
                                <select className="le-input" value={needsAssessmentForm.needsPriorities?.currentPriority || ""} onChange={(e) => updateNeedsPriorities("currentPriority", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}>
                                  <option value="">Select</option><option value="Protection">Protection</option><option value="Health">Health</option><option value="Investment">Investment</option>
                                </select>
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Approximate Monthly Income (All Sources) *</label>
                                <select className="le-input" value={needsAssessmentForm.needsPriorities?.monthlyIncomeBand || ""} onChange={(e) => updateNeedsPriorities("monthlyIncomeBand", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}>
                                  <option value="">Select bracket</option>
                                  {INCOME_BAND_OPTIONS.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}
                                </select>
                              </div>

                              {["BELOW_15000", "ABOVE_500000"].includes(String(needsAssessmentForm.needsPriorities?.monthlyIncomeBand || "")) && (
                                <div className="le-formRow">
                                  <label className="le-label">Manual Monthly Income Amount (Php) *</label>
                                  <input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.monthlyIncomeAmount ?? ""} onChange={(e) => updateNeedsPriorities("monthlyIncomeAmount", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} />
                                </div>
                              )}

                              <div className="le-formRow"><label className="le-label">Minimum Willing Monthly Premium (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.minPremium ?? ""} onChange={(e) => updateNeedsPriorities("minPremium", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                              <div className="le-formRow"><label className="le-label">Maximum Willing Monthly Premium (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.maxPremium ?? ""} onChange={(e) => updateNeedsPriorities("maxPremium", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>

                              {needsPrioritiesDerived.priority === "Protection" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Approximate Monthly Spend (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.protection?.monthlySpend ?? ""} onChange={(e) => updateNeedsPrioritySection("protection", "monthlySpend", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  <div className="le-formRow"><label className="le-label">Number of Dependents</label><input className="le-input" value={needsPrioritiesDerived.numberOfDependents} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Years to Protect Income</label><input className="le-input" value={needsPrioritiesDerived.yearsToProtectIncome} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Savings for Protection (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.protection?.savingsForProtection ?? ""} onChange={(e) => updateNeedsPrioritySection("protection", "savingsForProtection", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  <div className="le-formRow"><label className="le-label">Protection Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.protectionGap) ? needsPrioritiesDerived.protectionGap : ""} disabled /></div>
                                </>
                              )}

                              {needsPrioritiesDerived.priority === "Health" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Approx. Amount to Cover Critical Illness (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.health?.amountToCoverCriticalIllness ?? ""} onChange={(e) => updateNeedsPrioritySection("health", "amountToCoverCriticalIllness", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  <div className="le-formRow"><label className="le-label">Savings for Critical Illness (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.health?.savingsForCriticalIllness ?? ""} onChange={(e) => updateNeedsPrioritySection("health", "savingsForCriticalIllness", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  <div className="le-formRow"><label className="le-label">Critical Illness and Hospitalization Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.criticalIllnessGap) ? needsPrioritiesDerived.criticalIllnessGap : ""} disabled /></div>
                                </>
                              )}

                              {needsPrioritiesDerived.priority === "Investment" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Savings Plan *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.savingsPlan || ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsPlan", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="Home">Home</option><option value="Vehicle">Vehicle</option><option value="Holiday">Holiday</option><option value="Early Retirement">Early Retirement</option><option value="Other">Other</option></select></div>
                                  {String(needsAssessmentForm.needsPriorities?.investment?.savingsPlan || "") === "Other" && (<div className="le-formRow"><label className="le-label">Other Savings Plan *</label><input className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.savingsPlanOther || ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsPlanOther", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>)}
                                  <div className="le-formRow"><label className="le-label">Target Savings Amount (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.targetSavingsAmount ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "targetSavingsAmount", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  <div className="le-formRow"><label className="le-label">Target Year to Utilize Savings *</label><input className="le-input" inputMode="numeric" value={needsAssessmentForm.needsPriorities?.investment?.targetUtilizationYear ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "targetUtilizationYear", String(e.target.value).replace(/[^\d]/g, "").slice(0, 4))} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  <div className="le-formRow"><label className="le-label">Savings for Investment (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.savingsForInvestment ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsForInvestment", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  <div className="le-formRow"><label className="le-label">Savings Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.savingsGap) ? needsPrioritiesDerived.savingsGap : ""} disabled /></div>

                                  <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Investment Risk Profiler</h5>
                                  <div className="le-formRow"><label className="le-label">Investment Horizon *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.investmentHorizon || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), investmentHorizon: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="LT_3">Less than three years</option><option value="BETWEEN_3_7">Between three and seven years</option><option value="BETWEEN_7_10">Longer than seven years but less than 10 years</option><option value="AT_LEAST_10">At least 10 years</option></select></div>
                                  <div className="le-formRow"><label className="le-label">Investment Goal *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.investmentGoal || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), investmentGoal: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="CAPITAL_PRESERVATION">Capital preservation (slightly above time deposit)</option><option value="STEADY_GROWTH">Steady growth in capital</option><option value="SIGNIFICANT_APPRECIATION">Significant capital appreciation</option></select></div>
                                  <div className="le-formRow"><label className="le-label">Experience with Investments / Markets *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.marketExperience || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), marketExperience: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="NONE">None of the above</option><option value="I_ONLY">In “I” only</option><option value="II_ONLY">In “II” only</option><option value="BOTH">In both “I” and “II”</option></select></div>
                                  <div className="le-formRow"><label className="le-label">Reaction to Short-Term Volatility *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.volatilityReaction || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), volatilityReaction: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="FULL_WITHDRAW">Make a full withdrawal</option><option value="LESS_RISKY">Switch to a less risky fund</option><option value="HOLD">Do nothing / hold on to funds</option><option value="TOP_UPS">Do top-ups / additional investments</option></select></div>
                                  <div className="le-formRow"><label className="le-label">Affordability to Capital Loss *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.capitalLossAffordability || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), capitalLossAffordability: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="NO_LOSS">I cannot afford a loss</option><option value="UP_TO_5">I can afford up to 5% loss</option><option value="UP_TO_10">I can afford up to 10% loss</option><option value="ABOVE_10">I can afford more than 10% loss</option></select></div>
                                  <div className="le-formRow"><label className="le-label">Risk and Return Trade-Off *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.riskReturnTradeoff || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), riskReturnTradeoff: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="PORTFOLIO_A">Portfolio A: +4% / -3%</option><option value="PORTFOLIO_B">Portfolio B: +6% / -6%</option><option value="PORTFOLIO_C">Portfolio C: +10% / -12%</option><option value="PORTFOLIO_D">Portfolio D: +20%+ / -28%+</option></select></div>

                                  <h5 className="le-attemptSectionHeader" style={{ marginTop: 10 }}>Investor Risk Profile</h5>
                                  <div className="le-formRow"><label className="le-label">Risk Profile Score</label><input className="le-input" value={needsPrioritiesDerived.riskProfileScore ?? ""} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Profile Category</label><input className="le-input" value={RISK_CATEGORY_LABELS[needsPrioritiesDerived.riskProfileCategory] || ""} disabled /></div>
                                  {needsPrioritiesDerived.riskProfileCategory && needsPrioritiesDerived.riskProfileCategory !== "NOT_RECOMMENDED" && (
                                    <p className="le-muted" style={{ marginTop: 4 }}>{RISK_CATEGORY_NOTES[needsPrioritiesDerived.riskProfileCategory]}</p>
                                  )}
                                  {needsPrioritiesDerived.riskProfileCategory === "NOT_RECOMMENDED" && (
                                    <p className="le-muted" style={{ marginTop: 4 }}>Variable or unit-linked product is not recommended.</p>
                                  )}
                                  <p className="le-smallNote" style={{ marginTop: 6 }}>
                                    Notes: Profile descriptions are illustrative only and should not be considered a recommendation for specific fund selection.
                                  </p>
                                </>
                              )}
                            </>
                          )}

                          {isNeedsAnalysisReady && (<><h5 className="le-attemptSectionHeader" style={{ marginTop: 16 }}>Schedule Proposal Presentation</h5>
                          <div className="le-formRow">
                            <label className="le-label">Meeting Date *</label>
                            <select className="le-input" value={meetingForm.meetingDate} onChange={(e) => setMeetingForm((f) => ({ ...f, meetingDate: e.target.value, meetingStartTime: "" }))}>
                              <option value="">Select date</option>
                              {availableDateOptions.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
                            </select>
                          </div>
                          <div className="le-formRow">
                            <label className="le-label">Duration *</label>
                            <select className="le-input" value={meetingForm.meetingDurationMin} onChange={(e) => setMeetingForm((f) => ({ ...f, meetingDurationMin: Number(e.target.value || 120), meetingStartTime: "" }))}>
                              <option value={30}>30 mins</option><option value={60}>60 mins</option><option value={90}>90 mins</option><option value={120}>120 mins</option>
                            </select>
                          </div>
                          <div className="le-formRow">
                            <label className="le-label">Start Time *</label>
                            <select className="le-input" value={meetingForm.meetingStartTime} onChange={(e) => setMeetingForm((f) => ({ ...f, meetingStartTime: e.target.value }))}>
                              <option value="">Select time</option>
                              {meetingStartSlots.map((slot) => (<option key={slot} value={slot}>{formatTimeLabel(slot)}</option>))}
                            </select>
                          </div>
                          <div className="le-formRow">
                            <label className="le-label">Meeting Mode *</label>
                            <select className="le-input" value={meetingForm.meetingMode} onChange={(e) => setMeetingForm((f) => ({ ...f, meetingMode: e.target.value, meetingPlatform: "", meetingPlatformOther: "", meetingLink: "", meetingPlace: "" }))}>
                              <option value="">Select</option><option value="Online">Online</option><option value="Face-to-face">Face-to-face</option>
                            </select>
                          </div>
                          {meetingForm.meetingMode === "Online" && (
                            <>
                              <div className="le-formRow"><label className="le-label">Platform *</label><select className="le-input" value={meetingForm.meetingPlatform} onChange={(e) => setMeetingForm((f) => ({ ...f, meetingPlatform: e.target.value }))}><option value="">Select</option><option value="Zoom">Zoom</option><option value="Google Meet">Google Meet</option><option value="Other">Other</option></select></div>
                              {meetingForm.meetingPlatform === "Other" && <div className="le-formRow"><label className="le-label">Other Platform *</label><input className="le-input" value={meetingForm.meetingPlatformOther} onChange={(e)=>setMeetingForm((f)=>({...f,meetingPlatformOther:e.target.value}))} /></div>}
                              <div className="le-formRow"><label className="le-label">Meeting Link *</label><input className="le-input" value={meetingForm.meetingLink} onChange={(e)=>setMeetingForm((f)=>({...f,meetingLink:e.target.value}))} /></div>
                              <label className="le-check"><input type="checkbox" checked={meetingForm.meetingInviteSent} onChange={(e)=>setMeetingForm((f)=>({...f,meetingInviteSent:e.target.checked}))} /><span>Invite sent</span></label>
                            </>
                          )}
                          {meetingForm.meetingMode === "Face-to-face" && <div className="le-formRow"><label className="le-label">Meeting Place *</label><input className="le-input" value={meetingForm.meetingPlace} onChange={(e)=>setMeetingForm((f)=>({...f,meetingPlace:e.target.value}))} /></div>}
                          </>)}

                          {isNeedsAssessmentEditableNow && isNeedsAnalysisReady && (
                            <div className="le-actions" style={{ marginTop: 14 }}>
                              <button
                                type="button"
                                className="le-btn secondary"
                                onClick={() => {
                                  setNeedsAssessmentError("");
                                  setNeedsAssessmentSavedAt("");
                                  fetchNeedsAssessment();
                                  setMeetingForm((f) => ({ ...f, meetingDate: "", meetingStartTime: "", meetingMode: "", meetingPlatform: "", meetingPlatformOther: "", meetingLink: "", meetingInviteSent: false, meetingPlace: "" }));
                                }}
                                disabled={needsAssessmentSaving}
                              >
                                Cancel
                              </button>
                              <button type="button" className="le-btn primary" onClick={onSaveNeedsAssessment} disabled={needsAssessmentSaving}>
                                {needsAssessmentSaving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>

                {/* Sidebar: Tasks */}
                <aside className="le-sidebar">
                  <h4 className="le-sidebarTitle">Tasks</h4>

                  <div className="le-taskSection">
                    <div className="le-taskSectionHeader">
                      <h5 className="le-taskSectionTitle">Open</h5>
                      <span className="le-taskCount">{openTasks.length}</span>
                    </div>

                    {openTasks.length === 0 ? (
                      <div className="le-taskEmpty">No open tasks.</div>
                    ) : (
                      <div className="le-taskList">
                        {openTasks.map((t) => (
                          <TaskRow key={t._id} t={t} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="le-taskSection">
                    <div className="le-taskSectionHeader">
                      <h5 className="le-taskSectionTitle">Overdue</h5>
                      <span className="le-taskCount overdue">{overdueTasks.length}</span>
                    </div>

                    {overdueTasks.length === 0 ? (
                      <div className="le-taskEmpty">No overdue tasks.</div>
                    ) : (
                      <div className="le-taskList">
                        {overdueTasks.map((t) => (
                          <TaskRow key={t._id} t={t} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="le-taskSection">
                    <div className="le-taskSectionHeader">
                      <h5 className="le-taskSectionTitle">Done</h5>
                      <span className="le-taskCount done">{doneTasks.length}</span>
                    </div>

                    {doneTasks.length === 0 ? (
                      <div className="le-taskEmpty">No completed tasks.</div>
                    ) : (
                      <div className="le-taskList">
                        {doneTasks.map((t) => (
                          <TaskRow key={t._id} t={t} />
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>

            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default AgentLeadEngagement;
