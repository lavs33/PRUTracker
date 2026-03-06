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
  const [proposalMeetingForm, setProposalMeetingForm] = useState({
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
  const [proposalMeetingSaved, setProposalMeetingSaved] = useState(null);
  const [savingProposalMeeting, setSavingProposalMeeting] = useState(false);
  const [proposalMeetingError, setProposalMeetingError] = useState("");
  const [proposalMeetingFieldErrors, setProposalMeetingFieldErrors] = useState({});
  const [needsSectionOpen, setNeedsSectionOpen] = useState({
    basicInformation: true,
    needsPriorities: true,
  });
  const [needsAssessmentForm, setNeedsAssessmentForm] = useState({
    attendanceChoice: "",
    attendanceProofImageDataUrl: "",
    attendanceProofFileName: "",
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
        fundChoice: {
          allocations: {},
          mismatchReason: "",
        },
      },
    },
    existingPolicies: [],
  });

  const [selectedStageView, setSelectedStageView] = useState("CURRENT");
  const [availableProducts, setAvailableProducts] = useState([]);

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
      const windows = Array.isArray(data?.bookedWindows) ? data.bookedWindows : [];
      setBookedWindows(windows);
      return windows;
    } catch {
      setBookedWindows([]);
      return [];
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
      setAvailableProducts(Array.isArray(data?.products) ? data.products : []);

      const proposalMeeting = data?.proposalMeeting || null;
      setProposalMeetingSaved(proposalMeeting);
      setProposalMeetingForm({
        meetingDate: proposalMeeting?.startAt ? toDateInputValue(proposalMeeting.startAt) : "",
        meetingStartTime: proposalMeeting?.startAt
          ? `${String(new Date(proposalMeeting.startAt).getHours()).padStart(2, "0")}:${String(new Date(proposalMeeting.startAt).getMinutes()).padStart(2, "0")}`
          : "",
        meetingDurationMin: proposalMeeting?.durationMin ?? 120,
        meetingMode: String(proposalMeeting?.mode || ""),
        meetingPlatform: String(proposalMeeting?.platform || ""),
        meetingPlatformOther: String(proposalMeeting?.platformOther || ""),
        meetingLink: String(proposalMeeting?.link || ""),
        meetingInviteSent: Boolean(proposalMeeting?.inviteSent),
        meetingPlace: String(proposalMeeting?.place || ""),
      });

      setNeedsAssessmentForm({
        attendanceChoice: Boolean(data?.needsAssessment?.attendanceConfirmed) ? "YES" : "",
        attendanceProofImageDataUrl: String(data?.needsAssessment?.attendanceProofImageDataUrl || ""),
        attendanceProofFileName: String(data?.needsAssessment?.attendanceProofFileName || ""),
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
          productSelection: {
            selectedProductId: String(data?.needsAssessment?.needsPriorities?.productSelection?.selectedProductId || ""),
            requestedPremiumPayment: data?.needsAssessment?.needsPriorities?.productSelection?.requestedPremiumPayment ?? "",
            requestedFrequency: String(data?.needsAssessment?.needsPriorities?.productSelection?.requestedFrequency || "Monthly") || "Monthly",
            methodForInitialPayment: String(data?.needsAssessment?.needsPriorities?.productSelection?.methodForInitialPayment || ""),
          },
          optionalRiders: Array.isArray(data?.needsAssessment?.needsPriorities?.optionalRiders)
            ? data.needsAssessment.needsPriorities.optionalRiders.map((r) => ({
                riderKey: String(r?.riderKey || ""),
                riderName: String(r?.riderName || ""),
                enabled: Boolean(r?.enabled),
              }))
            : [],
          productRidersNotes: String(data?.needsAssessment?.needsPriorities?.productRidersNotes || ""),
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
            fundChoice: {
              allocations: Array.isArray(data?.needsAssessment?.needsPriorities?.investment?.fundChoice?.selectedFunds)
                ? data.needsAssessment.needsPriorities.investment.fundChoice.selectedFunds.reduce((acc, item) => {
                    const k = String(item?.fundKey || "").trim();
                    if (k) acc[k] = item?.allocationPercent ?? "";
                    return acc;
                  }, {})
                : {},
              mismatchReason: String(data?.needsAssessment?.needsPriorities?.investment?.fundChoice?.mismatchReason || ""),
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
    const attendanceProofImageDataUrl = String(needsAssessmentForm.attendanceProofImageDataUrl || "").trim();
    const attendanceProofFileName = String(needsAssessmentForm.attendanceProofFileName || "").trim();
    if (!attendanceProofImageDataUrl) {
      setNeedsAssessmentError("Please upload a proof of attendance image before proceeding.");
      return;
    }
    if (!/^data:image\/(?:jpeg|png);base64,/i.test(attendanceProofImageDataUrl)) {
      setNeedsAssessmentError("Proof of attendance must be a JPG, JPEG, or PNG image.");
      return;
    }
    if (attendanceProofFileName && !/\.(jpe?g|png)$/i.test(attendanceProofFileName)) {
      setNeedsAssessmentError("Proof of attendance file type must be JPG, JPEG, or PNG.");
      return;
    }

    const civilStatus = String(needsAssessmentForm.basicInformation?.civilStatus || "").trim();
    const birthday = String(needsAssessmentForm.basicInformation?.birthday || "").trim();
    const occupationCategory = String(needsAssessmentForm.basicInformation?.occupationCategory || "").trim();
    const occupation = String(needsAssessmentForm.basicInformation?.occupation || "").trim();
    const age = Number(needsAssessmentForm.basicInformation?.age || "");

    if (!civilStatus) { setNeedsAssessmentError("Civil status is required."); return; }
    if (!birthday) { setNeedsAssessmentError("Birthday is required."); return; }
    if (!["Employed", "Self-Employed", "Not Employed"].includes(occupationCategory)) { setNeedsAssessmentError("Occupation category is required."); return; }
    if (["Employed", "Self-Employed"].includes(occupationCategory) && !occupation) { setNeedsAssessmentError("Occupation is required for employed/self-employed prospects."); return; }

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
      if (Number.isNaN(b.getTime())) { setNeedsAssessmentError("Birthday is invalid."); return; }
      const d0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
      const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (d0 > t0) { setNeedsAssessmentError("Birthday cannot be in the future."); return; }
      const computed = computeAgeFromBirthday(birthday);
      if (computed === null || computed < 18 || computed > 70) { setNeedsAssessmentError("Prospect age must be between 18 and 70 years old."); return; }
    }

    if (!Number.isFinite(age) || age < 18 || age > 70) { setNeedsAssessmentError("Prospect age must be between 18 and 70 years old."); return; }

    for (let i = 0; i < (needsAssessmentForm.dependents || []).length; i += 1) {
      const d = needsAssessmentForm.dependents[i] || {};
      const depAge = Number(d.age);
      if (!String(d.name || "").trim()) { setNeedsAssessmentError(`Dependent #${i + 1}: name is required.`); return; }
      if (!Number.isFinite(depAge) || depAge < 0 || depAge > 120) { setNeedsAssessmentError(`Dependent #${i + 1}: age must be between 0 and 120.`); return; }
      if (!["Male", "Female"].includes(String(d.gender || ""))) { setNeedsAssessmentError(`Dependent #${i + 1}: please select gender.`); return; }
      if (!["Child", "Parent", "Sibling"].includes(String(d.relationship || ""))) { setNeedsAssessmentError(`Dependent #${i + 1}: please select relationship.`); return; }
    }

    const np = needsAssessmentForm.needsPriorities || {};
    const currentPriority = String(np.currentPriority || "").trim();
    const monthlyIncomeBand = String(np.monthlyIncomeBand || "").trim();
    const monthlyIncomeAmount = toNonNegativeNumber(np.monthlyIncomeAmount);
    const minPremium = toNonNegativeNumber(np.minPremium);
    const maxPremium = toNonNegativeNumber(np.maxPremium);

    if (!["Protection", "Health", "Investment"].includes(currentPriority)) { setNeedsAssessmentError("Current priority is required."); return; }
    if (!INCOME_BAND_OPTIONS.some((o) => o.value === monthlyIncomeBand)) { setNeedsAssessmentError("Approximate monthly income bracket is required."); return; }
    if (monthlyIncomeBand === "BELOW_15000" && (monthlyIncomeAmount === null || monthlyIncomeAmount >= 15000)) { setNeedsAssessmentError("Manual monthly income must be below Php 15,000 for selected bracket."); return; }
    if (monthlyIncomeBand === "ABOVE_500000" && (monthlyIncomeAmount === null || monthlyIncomeAmount <= 500000)) { setNeedsAssessmentError("Manual monthly income must be above Php 500,000 for selected bracket."); return; }

    const approxIncome = resolveApproxIncome(monthlyIncomeBand, np.monthlyIncomeAmount);
    if (approxIncome === null) { setNeedsAssessmentError("Approximate monthly income amount is required for selected bracket."); return; }

    if (minPremium === null) { setNeedsAssessmentError("Minimum willing monthly premium is required."); return; }
    if (maxPremium === null) { setNeedsAssessmentError("Maximum willing monthly premium is required."); return; }
    if (minPremium > approxIncome) { setNeedsAssessmentError("Minimum willing monthly premium cannot be higher than approximate monthly income."); return; }
    if (maxPremium > approxIncome) { setNeedsAssessmentError("Maximum willing monthly premium cannot be higher than approximate monthly income."); return; }
    if (maxPremium < minPremium) { setNeedsAssessmentError("Maximum willing monthly premium must be equal to or higher than minimum."); return; }

    const selectedProductId = String(np?.productSelection?.selectedProductId || "").trim();
    const requestedFrequency = String(np?.productSelection?.requestedFrequency || "Monthly").trim() || "Monthly";
    const requestedPremiumPayment = toNonNegativeNumber(np?.productSelection?.requestedPremiumPayment);
    const methodForInitialPayment = String(np?.productSelection?.methodForInitialPayment || "").trim();
    const selectedProduct = (availableProductsByPriority || []).find((prod) => String(prod?._id || "") === selectedProductId);
    if (!selectedProductId || !selectedProduct) { setNeedsAssessmentError("Product Selection: please select a product under the chosen priority."); return; }
    if (!["Monthly", "Quarterly", "Half-yearly", "Yearly"].includes(requestedFrequency)) { setNeedsAssessmentError("Product Selection: requested frequency is invalid."); return; }
    if (requestedPremiumPayment === null) { setNeedsAssessmentError("Product Selection: requested premium payment is required."); return; }
    if (!["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"].includes(methodForInitialPayment)) { setNeedsAssessmentError("Product Selection: method for initial payment is required."); return; }

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
      if (savingsForCriticalIllness > amountToCoverCriticalIllness) { setNeedsAssessmentError("Health: savings for critical illness cannot be higher than amount to cover critical illness."); return; }
    }

    if (currentPriority === "Investment") {
      const savingsPlan = String(np?.investment?.savingsPlan || "").trim();
      const savingsPlanOther = String(np?.investment?.savingsPlanOther || "").trim();
      const targetSavingsAmount = toNonNegativeNumber(np?.investment?.targetSavingsAmount);
      const targetUtilizationYear = Number(String(np?.investment?.targetUtilizationYear || "").trim());
      const savingsForInvestment = toNonNegativeNumber(np?.investment?.savingsForInvestment);
      const rp = np?.investment?.riskProfiler || {};

      if (!savingsPlan) { setNeedsAssessmentError("Investment: savings plan is required."); return; }
      if (savingsPlan === "Other" && !savingsPlanOther) { setNeedsAssessmentError("Investment: please specify other savings plan."); return; }
      if (targetSavingsAmount === null) { setNeedsAssessmentError("Investment: target savings amount is required."); return; }
      if (!Number.isFinite(targetUtilizationYear)) { setNeedsAssessmentError("Investment: target year to utilize savings is required."); return; }
      const yearNow = new Date().getFullYear();
      if (targetUtilizationYear < yearNow + 2 || targetUtilizationYear > yearNow + 20) { setNeedsAssessmentError("Investment: target year must be between 2 and 20 years from current year."); return; }
      if (savingsForInvestment === null) { setNeedsAssessmentError("Investment: savings for investment is required."); return; }
      if (savingsForInvestment > targetSavingsAmount) { setNeedsAssessmentError("Investment: savings for investment cannot be higher than target savings amount."); return; }

      const scored = scoreRiskProfile(rp);
      if (scored.score === null || !scored.category) { setNeedsAssessmentError("Investment Risk Profiler: please answer all survey questions."); return; }

      const allowedRatings = SUITABLE_RISK_RATINGS_BY_CATEGORY[scored.category] || [];
      const allocations = np?.investment?.fundChoice?.allocations && typeof np.investment.fundChoice.allocations === "object"
        ? np.investment.fundChoice.allocations
        : {};
      const selectedFunds = INVESTMENT_FUNDS
        .map((fund) => ({
          ...fund,
          allocationPercent: toNonNegativeNumber(allocations[fund.key]) ?? 0,
          isSuitable: allowedRatings.includes(fund.riskRating),
        }))
        .filter((item) => item.allocationPercent > 0);
      const totalAllocation = selectedFunds.reduce((sum, item) => sum + item.allocationPercent, 0);
      const fundMatch = selectedFunds.some((item) => !item.isSuitable) ? "No" : "Yes";
      const mismatchReason = String(np?.investment?.fundChoice?.mismatchReason || "").trim();

      if (selectedFunds.length === 0) { setNeedsAssessmentError("Fund Choice: select at least one fund."); return; }
      if (Math.abs(totalAllocation - 100) > 0.0001) { setNeedsAssessmentError("Fund Choice: allocation in percentage must equal 100%."); return; }
      if (fundMatch === "No" && !mismatchReason) { setNeedsAssessmentError("Fund Choice: reason for mismatch is required when Fund Match is No."); return; }
    }

    try {
      setNeedsAssessmentSaving(true);

      {
        const aRes = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/needs-assessment/attendance?userId=${user.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attended: true,
            attendanceProofImageDataUrl: String(needsAssessmentForm.attendanceProofImageDataUrl || ""),
            attendanceProofFileName: String(needsAssessmentForm.attendanceProofFileName || ""),
          }),
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
              productSelection: {
                selectedProductId: String(np?.productSelection?.selectedProductId || "").trim(),
                requestedPremiumPayment: toNonNegativeNumber(np?.productSelection?.requestedPremiumPayment),
                requestedFrequency: String(np?.productSelection?.requestedFrequency || "Monthly").trim() || "Monthly",
                methodForInitialPayment: String(np?.productSelection?.methodForInitialPayment || "").trim(),
              },
              optionalRiders: (np?.optionalRiders || [])
                .map((r) => ({
                  riderKey: String(r?.riderKey || "").trim(),
                  riderName: String(r?.riderName || "").trim(),
                  enabled: Boolean(r?.enabled),
                }))
                .filter((r) => r.riderKey && r.riderName),
              productRidersNotes: String(np?.productRidersNotes || ""),
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
                fundChoice: {
                  selectedFunds: needsPrioritiesDerived.selectedFunds.map((fund) => ({
                    fundKey: fund.key,
                    fundName: fund.fundName,
                    currency: fund.currency,
                    riskRating: fund.riskRating,
                    allocationPercent: fund.allocationPercent,
                    isSuitable: !needsPrioritiesDerived.otherFunds.some((f) => f.key === fund.key),
                  })),
                  totalAllocationPercent: needsPrioritiesDerived.totalFundAllocation,
                  fundMatch: needsPrioritiesDerived.fundMatch,
                  mismatchReason: String(np?.investment?.fundChoice?.mismatchReason || "").trim(),
                },
              },
            },
          }),
        });
        const nData = await nRes.json();
        if (!nRes.ok) throw new Error(nData?.message || "Failed to save needs analysis.");
      }

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
  const availableProductsByPriority = useMemo(() => {
    const p = String(needsAssessmentForm.needsPriorities?.currentPriority || "").trim();
    return (availableProducts || []).filter((item) => String(item?.productCategory || "").trim() === p);
  }, [availableProducts, needsAssessmentForm.needsPriorities?.currentPriority]);
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
      NOT_RECOMMENDED: "Variable or unit-linked product is not recommended.",
      CONSERVATIVE:
        "This means that when you invest, capital preservation is your primary concern and you prefer to take less risk. While there is low risk of potential capital loss, you understand that potential returns may not always beat inflation.\n\nInvestors in this category may consider funds with risk rating of 1.",
      MODERATE:
        "This means that when you invest, you look to trade-off some capital preservation for capital growth in the long run. You understand that to achieve this potential, you should be willing to accept an increased level of investment volatility and moderate risk of potential capital loss.\n\nInvestors in this category may consider funds with risk rating of 1 and 2.",
      AGGRESSIVE:
        "This means that when you invest, your primary goal is to achieve significant return on your capital in the long run. You understand that to realize this potential, you should be willing to accept high level of investment volatility and high risk of potential capital loss.\n\nInvestors in this category may consider funds with risk rating of 1, 2 and 3.",
    }),
    []
  );

  const INVESTMENT_FUNDS = useMemo(
    () => [
      { key: "PRULINK_MONEY_MARKET_FUND", fundName: "PRULink Money Market Fund", currency: "PHP", riskRating: 1 },
      { key: "PRULINK_BOND_FUND", fundName: "PRULink Bond Fund", currency: "PHP", riskRating: 1 },
      { key: "PRULINK_MANAGED_FUND", fundName: "PRULink Managed Fund", currency: "PHP", riskRating: 2 },
      { key: "PRULINK_PROACTIVE_FUND", fundName: "PRULink Proactive Fund", currency: "PHP", riskRating: 3 },
      { key: "PRULINK_GROWTH_FUND", fundName: "PRULink Growth Fund", currency: "PHP", riskRating: 3 },
      { key: "PRULINK_EQUITY_FUND", fundName: "PRULink Equity Fund", currency: "PHP", riskRating: 3 },
      { key: "PRULINK_US_DOLLAR_BOND_FUND", fundName: "PRULink US Dollar Bond Fund", currency: "USD", riskRating: 1 },
      { key: "PRULINK_ASIAN_LOCAL_BOND_FUND", fundName: "PRULink Asian Local Bond Fund", currency: "USD", riskRating: 2 },
      { key: "PRULINK_CASH_FLOW_FUND", fundName: "PRULink Cash Flow Fund", currency: "USD", riskRating: 2 },
      { key: "PRULINK_ASIAN_BALANCED_FUND", fundName: "PRULink Asian Balanced Fund", currency: "USD", riskRating: 2 },
      { key: "PRULINK_ASIA_PACIFIC_EQUITY_FUND", fundName: "PRULink Asia Pacific Equity Fund", currency: "USD", riskRating: 3 },
      { key: "PRULINK_GLOBAL_EMERGING_MARKETS_DYNAMIC_FUND", fundName: "PRULink Global Emerging Markets Dynamic Fund", currency: "USD", riskRating: 3 },
    ],
    []
  );

  const SUITABLE_RISK_RATINGS_BY_CATEGORY = useMemo(
    () => ({
      NOT_RECOMMENDED: [],
      CONSERVATIVE: [1],
      MODERATE: [1, 2],
      AGGRESSIVE: [1, 2, 3],
    }),
    []
  );

  const OPTIONAL_RIDER_CATALOG = useMemo(
    () => [
      { riderKey: "ACCELERATED_TPD", riderName: "Accelerated Total and Permanent Disability", description: "Advances a portion of the basic sum assured if life insured becomes totally and permanently disabled due to bodily injury or disease." },
      { riderKey: "ACCIDENTAL_DEATH_DISMEMBERMENT", riderName: "Accidental Death and Disablement", description: "Pays benefit if life insured dies due to accident or is totally and permanently disabled due to accident." },
      { riderKey: "ACCELERATED_LIFE_CARE", riderName: "Accelerated Life Care Benefit", description: "Pays a percentage of base sum assured upon diagnosis of or surgery due to covered critical illnesses." },
      { riderKey: "MULTIPLE_LIFE_CARE_PLUS", riderName: "Multiple Life Care Plus", description: "Provides multiple-claim critical illness benefit under covered categories." },
      { riderKey: "LIFE_CARE_ADVANCE_PLUS", riderName: "Life Care Advance Plus", description: "Provides benefit upon diagnosis/surgery for covered critical illnesses including early-stage conditions." },
      { riderKey: "LIFE_CARE_PLUS", riderName: "Life Care Plus", description: "Pays benefit amount upon diagnosis/surgery due to covered critical illnesses." },
      { riderKey: "PA_ACCIDENTAL_DEATH_DISMEMBERMENT", riderName: "Personal Accident - Accidental Death and Disablement", description: "Pays benefit due to accidental death or percentage based on disability schedule." },
      { riderKey: "PA_ACCIDENTAL_TPD", riderName: "Personal Accident - Accidental Total and Permanent Disability", description: "Pays benefit due to accident-related total and permanent disability." },
      { riderKey: "PA_MURDER_ASSAULT", riderName: "Personal Accident - Murder & Assault Benefit", description: "Pays benefit if life insured is proven murdered or assaulted under rider terms." },
      { riderKey: "PA_DOUBLE_INDEMNITY", riderName: "Personal Accident - Double Indemnity Benefit", description: "Pays additional benefit for accidental death while travelling on covered public transportation." },
      { riderKey: "PA_MEDICAL_REIMBURSEMENT", riderName: "Personal Accident - Accidental Medical Expense Reimbursement", description: "Reimburses medical expenses due to accident (in-patient/out-patient) up to rider limits." },
      { riderKey: "HOSPITAL_DAILY_INCOME", riderName: "Hospital Income - Daily Hospital Income", description: "Pays daily cash benefit for hospital confinement due to accident or illness." },
      { riderKey: "HOSPITAL_SURGICAL_REIMBURSEMENT", riderName: "Hospital Income - Surgical Expense Reimbursement", description: "Reimburses actual surgical expenses while under confinement up to rider limits." },
      { riderKey: "HOSPITAL_ICU", riderName: "Hospital Income - Intensive Care Unit", description: "Pays daily cash benefit for confinement in an ICU under rider terms." },
      { riderKey: "HOSPITAL_LONG_TERM", riderName: "Hospital Income - Long-Term Hospitalization", description: "Pays daily cash benefit for extended hospital confinement beyond initial covered days." },
      { riderKey: "PAYOR_TERM", riderName: "Payor Term Benefit", description: "Provides 100% of rider benefit amount upon death of payor." },
      { riderKey: "LIFE_CARE_WAIVER", riderName: "Life Care Waiver", description: "Waives future regular premiums due to covered critical illness." },
      { riderKey: "WAIVER_PREMIUM_TPD", riderName: "Waiver of Premium due to Total and Permanent Disability Benefit", description: "Waives future regular premiums due to total and permanent disability." },
      { riderKey: "FUTURE_SAFE_RIDER", riderName: "Future Safe Rider", description: "Provides guaranteed increase in sum assured on policy anniversaries under rider terms." },
    ],
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

  const buildMeetingStartSlots = useCallback((durationMin) => {
    const duration = Number(durationMin || 120);
    const latestStartMin = 21 * 60 - duration;
    const slots = [];

    for (let minute = 7 * 60; minute <= latestStartMin; minute += 30) {
      const hh = String(Math.floor(minute / 60)).padStart(2, "0");
      const mm = String(minute % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }, []);

  const meetingStartSlots = useMemo(() => buildMeetingStartSlots(meetingForm.meetingDurationMin), [buildMeetingStartSlots, meetingForm.meetingDurationMin]);
  const proposalMeetingStartSlots = useMemo(() => buildMeetingStartSlots(proposalMeetingForm.meetingDurationMin), [buildMeetingStartSlots, proposalMeetingForm.meetingDurationMin]);

  const isSlotBooked = useCallback(
    (dateStr, timeStr, durationMin, ignoreStartAt = null) => {
      const start = combineDateAndTimeLocal(dateStr, timeStr);
      if (!start) return false;
      const end = new Date(start.getTime() + Number(durationMin || 120) * 60 * 1000);
      const ignoreTs = ignoreStartAt ? new Date(ignoreStartAt).getTime() : null;

      return bookedWindows.some((w) => {
        const ws = new Date(w.startAt);
        const we = new Date(w.endAt);
        if (ignoreTs && ws.getTime() === ignoreTs) return false;
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
  const showProposalSchedulingSection = needsActivityKeyRaw === "Schedule Proposal Presentation";
  const isNeedsAssessmentLocked = showProposalSchedulingSection;
  const isNeedsAnalysisReady = useMemo(() => {
    if (needsAssessmentForm.attendanceChoice !== "YES") return false;

    const basic = needsAssessmentForm.basicInformation || {};
    if (!["Male", "Female"].includes(String(basic.sex || "").trim())) return false;
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

    const attendanceProofImageDataUrl = String(needsAssessmentForm.attendanceProofImageDataUrl || "").trim();

    const selectedProductId = String(np?.productSelection?.selectedProductId || "").trim();
    const requestedFrequency = String(np?.productSelection?.requestedFrequency || "Monthly").trim() || "Monthly";
    const requestedPremiumPayment = toNonNegativeNumber(np?.productSelection?.requestedPremiumPayment);
    const methodForInitialPayment = String(np?.productSelection?.methodForInitialPayment || "").trim();
    const selectedProduct = (availableProductsByPriority || []).find((prod) => String(prod?._id || "") === selectedProductId);
    if (!selectedProductId || !selectedProduct) return false;
    if (!["Monthly", "Quarterly", "Half-yearly", "Yearly"].includes(requestedFrequency)) return false;
    if (requestedPremiumPayment === null) return false;
    if (!/^data:image\/(?:jpeg|png);base64,/i.test(attendanceProofImageDataUrl)) return false;
    if (!["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"].includes(methodForInitialPayment)) return false;

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

      const allocations = np?.investment?.fundChoice?.allocations && typeof np.investment.fundChoice.allocations === "object"
        ? np.investment.fundChoice.allocations
        : {};
      const allowedRatings = SUITABLE_RISK_RATINGS_BY_CATEGORY[category] || [];
      const selectedFunds = INVESTMENT_FUNDS
        .map((fund) => ({ ...fund, allocationPercent: toNonNegativeNumber(allocations[fund.key]) ?? 0 }))
        .filter((fund) => fund.allocationPercent > 0);
      if (selectedFunds.length === 0) return false;
      const totalAllocation = selectedFunds.reduce((sum, item) => sum + item.allocationPercent, 0);
      if (Math.abs(totalAllocation - 100) > 0.0001) return false;
      const fundMatch = selectedFunds.some((item) => !allowedRatings.includes(item.riskRating)) ? "No" : "Yes";
      if (fundMatch === "No" && !String(np?.investment?.fundChoice?.mismatchReason || "").trim()) return false;
    }
    return true;
  }, [needsAssessmentForm, resolveApproxIncome, scoreRiskProfile, toNonNegativeNumber, INVESTMENT_FUNDS, SUITABLE_RISK_RATINGS_BY_CATEGORY, availableProductsByPriority]);

  const needsUiActivityKey =
    isNeedsAssessmentEditableNow && isViewingCurrentStage
      ? needsAssessmentForm.attendanceChoice !== "YES" || !String(needsAssessmentForm.attendanceProofImageDataUrl || "").trim()
        ? "Record Prospect Attendance"
        : !isNeedsAnalysisReady
        ? "Perform Needs Analysis"
        : "Schedule Proposal Presentation"
      : needsActivityKeyRaw;

  const attendanceProofErrorMessages = useMemo(
    () => [
      "Please upload a proof of attendance image before proceeding.",
      "Proof of attendance must be a JPG, JPEG, or PNG image.",
      "Proof of attendance file type must be JPG, JPEG, or PNG.",
      "Proof of attendance image is required and must be JPG, JPEG, or PNG.",
    ],
    []
  );
  const errorText = String(needsAssessmentError || "");
  const attendanceProofInlineError = attendanceProofErrorMessages.includes(errorText)
    ? errorText
    : "";

  const needsAssessmentErrorField = useMemo(() => {
    if (!errorText) return "";
    if (attendanceProofErrorMessages.includes(errorText)) return "attendanceProof";
    if (errorText === "Prospect attendance must be marked YES before saving.") return "attendanceChoice";
    if (errorText === "Civil status is required.") return "civilStatus";
    if (errorText.startsWith("Birthday")) return "birthday";
    if (errorText.startsWith("Prospect age")) return "birthday";
    if (errorText === "Occupation category is required.") return "occupationCategory";
    if (errorText.startsWith("Occupation is required")) return "occupation";
    if (errorText === "Street address is required.") return "addressLine";
    if (errorText === "Barangay is required.") return "barangay";
    if (errorText === "City is required.") return "city";
    if (errorText === "Other city is required.") return "otherCity";
    if (errorText === "Region is required.") return "region";
    if (errorText.startsWith("Zip code")) return "zipCode";
    if (errorText.startsWith("Dependent #")) return "dependents";
    if (errorText === "Current priority is required.") return "currentPriority";
    if (errorText === "Approximate monthly income bracket is required.") return "monthlyIncomeBand";
    if (errorText.startsWith("Manual monthly income") || errorText.startsWith("Approximate monthly income amount")) return "monthlyIncomeAmount";
    if (errorText.startsWith("Minimum willing monthly premium")) return "minPremium";
    if (errorText.startsWith("Maximum willing monthly premium")) return "maxPremium";
    if (errorText.startsWith("Product Selection: please select")) return "selectedProductId";
    if (errorText.startsWith("Product Selection: requested frequency")) return "requestedFrequency";
    if (errorText.startsWith("Product Selection: requested premium")) return "requestedPremiumPayment";
    if (errorText.startsWith("Product Selection: method for initial payment")) return "methodForInitialPayment";
    if (errorText.startsWith("Protection: approximate monthly spend") || errorText.startsWith("Protection: monthly spend")) return "protectionMonthlySpend";
    if (errorText.startsWith("Protection: savings for protection")) return "protectionSavings";
    if (errorText.startsWith("Health: approximate amount")) return "healthAmount";
    if (errorText.startsWith("Health: savings for critical")) return "healthSavings";
    if (errorText.startsWith("Investment: savings plan is required")) return "investmentSavingsPlan";
    if (errorText.startsWith("Investment: please specify other savings plan")) return "investmentSavingsPlanOther";
    if (errorText.startsWith("Investment: target savings amount")) return "investmentTargetAmount";
    if (errorText.startsWith("Investment: target year")) return "investmentTargetYear";
    if (errorText.startsWith("Investment: savings for investment")) return "investmentSavings";
    if (errorText.startsWith("Investment Risk Profiler")) return "investmentRiskProfiler";
    if (errorText.startsWith("Fund Choice:")) return "fundChoice";
    return "general";
  }, [errorText, attendanceProofErrorMessages]);

  const renderNeedsAssessmentError = (fieldKey) => (
    needsAssessmentErrorField === fieldKey
      ? <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{errorText}</p>
      : null
  );

  const showTopNeedsAssessmentError = needsAssessmentErrorField === "general";

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

    const allocations = np?.investment?.fundChoice?.allocations && typeof np.investment.fundChoice.allocations === "object"
      ? np.investment.fundChoice.allocations
      : {};
    const allowedRatings = SUITABLE_RISK_RATINGS_BY_CATEGORY[risk.category] || [];
    const selectedFunds = INVESTMENT_FUNDS
      .map((fund) => ({ ...fund, allocationPercent: toNonNegativeNumber(allocations[fund.key]) ?? 0 }))
      .filter((fund) => fund.allocationPercent > 0);
    const totalFundAllocation = selectedFunds.reduce((sum, item) => sum + item.allocationPercent, 0);
    const hasUnsuitableFunds = selectedFunds.some((fund) => !allowedRatings.includes(fund.riskRating));
    const fundMatch = selectedFunds.length > 0 && !hasUnsuitableFunds ? "Yes" : "No";

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
      selectedFunds,
      totalFundAllocation,
      hasUnsuitableFunds,
      fundMatch,
      suitableFunds: INVESTMENT_FUNDS.filter((fund) => allowedRatings.includes(fund.riskRating)),
      otherFunds: INVESTMENT_FUNDS.filter((fund) => !allowedRatings.includes(fund.riskRating)),
    };
  }, [needsAssessmentForm, resolveApproxIncome, scoreRiskProfile, toNonNegativeNumber, INVESTMENT_FUNDS, SUITABLE_RISK_RATINGS_BY_CATEGORY]);

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


  const submitScheduleProposalPresentation = async () => {
    try {
      setProposalMeetingError("");
      setProposalMeetingFieldErrors({});

      const meetingDate = String(proposalMeetingForm.meetingDate || "").trim();
      const meetingStartTime = String(proposalMeetingForm.meetingStartTime || "").trim();
      const meetingDurationMin = Number(proposalMeetingForm.meetingDurationMin || 120);
      const meetingMode = String(proposalMeetingForm.meetingMode || "").trim();

      if (!meetingDate) {
        setProposalMeetingFieldErrors({ meetingDate: "Meeting date is required." });
        return;
      }
      if (!meetingStartTime) {
        setProposalMeetingFieldErrors({ meetingStartTime: "Start time is required." });
        return;
      }
      if (![30, 60, 90, 120].includes(meetingDurationMin)) {
        setProposalMeetingFieldErrors({ meetingDurationMin: "Duration must be 30, 60, 90, or 120 minutes." });
        return;
      }
      const latestWindows = await fetchMeetingAvailability();
      const proposedStart = combineDateAndTimeLocal(meetingDate, meetingStartTime);
      const proposedEnd = proposedStart ? new Date(proposedStart.getTime() + meetingDurationMin * 60 * 1000) : null;
      const hasRealtimeConflict = Boolean(proposedStart && proposedEnd) && (latestWindows || []).some((w) => {
        const ws = w?.startAt ? new Date(w.startAt) : null;
        const we = w?.endAt ? new Date(w.endAt) : null;
        if (!ws || !we || Number.isNaN(ws.getTime()) || Number.isNaN(we.getTime())) return false;
        if (proposalMeetingSaved?.startAt && ws.getTime() === new Date(proposalMeetingSaved.startAt).getTime()) return false;
        return ws < proposedEnd && we > proposedStart;
      });
      if (hasRealtimeConflict) {
        setProposalMeetingFieldErrors({ meetingStartTime: "Selected start time conflicts with an existing meeting." });
        return;
      }
      if (isSlotBooked(meetingDate, meetingStartTime, meetingDurationMin, proposalMeetingSaved?.startAt)) {
        setProposalMeetingFieldErrors({ meetingStartTime: "Selected start time conflicts with an existing meeting." });
        return;
      }
      if (!["Online", "Face-to-face"].includes(meetingMode)) {
        setProposalMeetingFieldErrors({ meetingMode: "Please select meeting mode." });
        return;
      }

      if (meetingMode === "Online") {
        const platform = String(proposalMeetingForm.meetingPlatform || "").trim();
        if (!["Zoom", "Google Meet", "Other"].includes(platform)) {
          setProposalMeetingFieldErrors({ meetingPlatform: "Please select online platform." });
          return;
        }
        if (platform === "Other" && !String(proposalMeetingForm.meetingPlatformOther || "").trim()) {
          setProposalMeetingFieldErrors({ meetingPlatformOther: "Please specify other platform." });
          return;
        }
        const link = String(proposalMeetingForm.meetingLink || "").trim();
        if (!link) {
          setProposalMeetingFieldErrors({ meetingLink: "Meeting link is required for online meetings." });
          return;
        }
        if (!isValidHttpUrl(link)) {
          setProposalMeetingFieldErrors({ meetingLink: "Meeting link must be a valid http/https URL." });
          return;
        }
        if (proposalMeetingForm.meetingInviteSent !== true) {
          setProposalMeetingFieldErrors({ meetingInviteSent: "Please confirm invite link has been sent." });
          return;
        }
      }

      if (meetingMode === "Face-to-face" && !String(proposalMeetingForm.meetingPlace || "").trim()) {
        setProposalMeetingFieldErrors({ meetingPlace: "Meeting place is required for face-to-face meetings." });
        return;
      }

      setSavingProposalMeeting(true);

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/needs-assessment/schedule-proposal?userId=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingDate,
            meetingStartTime,
            meetingDurationMin,
            meetingMode,
            meetingPlatform: meetingMode === "Online" ? String(proposalMeetingForm.meetingPlatform || "").trim() : undefined,
            meetingPlatformOther:
              meetingMode === "Online" && proposalMeetingForm.meetingPlatform === "Other"
                ? String(proposalMeetingForm.meetingPlatformOther || "").trim()
                : undefined,
            meetingLink: meetingMode === "Online" ? String(proposalMeetingForm.meetingLink || "").trim() : undefined,
            meetingInviteSent: Boolean(proposalMeetingForm.meetingInviteSent),
            meetingPlace: meetingMode === "Face-to-face" ? String(proposalMeetingForm.meetingPlace || "").trim() : undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to schedule proposal presentation.");

      await fetchNeedsAssessment();
      await fetchEngagement();
    } catch (err) {
      setProposalMeetingError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setSavingProposalMeeting(false);
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
                        {showTopNeedsAssessmentError ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{needsAssessmentError}</p> : null}
                                                <div className="le-formRow" style={{ alignItems: "center" }}>
                          <label className="le-label">Prospect Attended? *</label>
                          <div className="le-checkboxGrid">
                            <label className="le-check">
                              <input
                                type="radio"
                                name="prospect-attendance"
                                checked={needsAssessmentForm.attendanceChoice === "YES"}
                                onChange={() => setNeedsAssessmentForm((f) => ({ ...f, attendanceChoice: "YES" }))}
                                disabled={!isNeedsAssessmentEditableNow || isNeedsAssessmentLocked || needsAssessmentSaving}
                              />
                              <span>Yes</span>
                            </label>
                            <label className="le-check">
                              <input
                                type="radio"
                                name="prospect-attendance"
                                checked={needsAssessmentForm.attendanceChoice === "NO"}
                                onChange={() => setNeedsAssessmentForm((f) => ({ ...f, attendanceChoice: "NO", attendanceProofImageDataUrl: "", attendanceProofFileName: "" }))}
                                disabled={!isNeedsAssessmentEditableNow || isNeedsAssessmentLocked || needsAssessmentSaving}
                              />
                              <span>No</span>
                            </label>
                          </div>
                        </div>
                        {renderNeedsAssessmentError("attendanceChoice")}

                        {needsAssessmentForm.attendanceChoice === "NO" ? (
                          <p className="le-muted" style={{ marginTop: 8 }}>
                            Prospect must be marked as attended before Prospect&apos;s Basic Information can be completed.
                          </p>
                        ) : null}

                        {needsAssessmentForm.attendanceChoice === "YES" && (
                          <>
                            {!isNeedsAssessmentLocked ? (
                              <div className="le-formRow" style={{ marginTop: 8 }}>
                                <label className="le-label">Proof of Attendance (JPG, JPEG, PNG) *</label>
                                <input
                                  type="file"
                                  className="le-input"
                                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) {
                                      setNeedsAssessmentForm((f) => ({ ...f, attendanceProofImageDataUrl: "", attendanceProofFileName: "" }));
                                      return;
                                    }
                                    const extOk = /\.(jpe?g|png)$/i.test(file.name || "");
                                    const mimeOk = ["image/jpeg", "image/png"].includes(String(file.type || "").toLowerCase());
                                    if (!extOk || !mimeOk) {
                                      setNeedsAssessmentError("");
                                      setNeedsAssessmentForm((f) => ({ ...f, attendanceProofImageDataUrl: "", attendanceProofFileName: "" }));
                                      e.target.value = "";
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      setNeedsAssessmentError("");
                                      setNeedsAssessmentForm((f) => ({
                                        ...f,
                                        attendanceProofImageDataUrl: String(reader.result || ""),
                                        attendanceProofFileName: String(file.name || ""),
                                      }));
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                  disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}
                                />
                              </div>
                            ) : null}
                            {attendanceProofInlineError ? (
                              <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{attendanceProofInlineError}</p>
                            ) : null}
                            {String(needsAssessmentForm.attendanceProofImageDataUrl || "").trim() ? (
                              <div className="le-formRow" style={{ marginTop: 8 }}>
                                <label className="le-label">Preview</label>
                                <img
                                  src={needsAssessmentForm.attendanceProofImageDataUrl}
                                  alt="Proof of attendance preview"
                                  style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                />
                              </div>
                            ) : (
                              <p className="le-muted" style={{ marginTop: 8 }}>
                                Upload proof of attendance first to proceed to Prospect&apos;s Basic Information.
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {needsAssessmentForm.attendanceChoice === "YES" && !isNeedsAssessmentLocked && String(needsAssessmentForm.attendanceProofImageDataUrl || "").trim() && (
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
                          {renderNeedsAssessmentError("civilStatus")}

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
                          {renderNeedsAssessmentError("birthday")}

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
                          {renderNeedsAssessmentError("occupationCategory")}

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
                          {renderNeedsAssessmentError("occupation")}

                          <div className="le-formRow">
                            <label className="le-label">Street Address *</label>
                            <input
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.addressLine || ""}
                              onChange={(e) => setNeedsAssessmentForm((f) => ({ ...f, basicInformation: { ...f.basicInformation, addressLine: e.target.value } }))}
                              disabled={!isNeedsAssessmentEditableNow}
                            />
                          </div>
                          {renderNeedsAssessmentError("addressLine")}

                          <div className="le-formRow">
                            <label className="le-label">Barangay *</label>
                            <input
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.barangay || ""}
                              onChange={(e) => setNeedsAssessmentForm((f) => ({ ...f, basicInformation: { ...f.basicInformation, barangay: e.target.value } }))}
                              disabled={!isNeedsAssessmentEditableNow}
                            />
                          </div>
                          {renderNeedsAssessmentError("barangay")}

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
                          {renderNeedsAssessmentError("city")}

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
                          {renderNeedsAssessmentError("otherCity")}

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
                          {renderNeedsAssessmentError("region")}

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
                          {renderNeedsAssessmentError("zipCode")}

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
                          {renderNeedsAssessmentError("dependents")}

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
                              {renderNeedsAssessmentError("currentPriority")}

                              <div className="le-formRow">
                                <label className="le-label">Approximate Monthly Income (All Sources) *</label>
                                <select className="le-input" value={needsAssessmentForm.needsPriorities?.monthlyIncomeBand || ""} onChange={(e) => updateNeedsPriorities("monthlyIncomeBand", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}>
                                  <option value="">Select bracket</option>
                                  {INCOME_BAND_OPTIONS.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}
                                </select>
                              </div>
                              {renderNeedsAssessmentError("monthlyIncomeBand")}

                              {["BELOW_15000", "ABOVE_500000"].includes(String(needsAssessmentForm.needsPriorities?.monthlyIncomeBand || "")) && (
                                <div className="le-formRow">
                                  <label className="le-label">Manual Monthly Income Amount (Php) *</label>
                                  <input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.monthlyIncomeAmount ?? ""} onChange={(e) => updateNeedsPriorities("monthlyIncomeAmount", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} />
                                </div>
                              )}
                              {renderNeedsAssessmentError("monthlyIncomeAmount")}

                              <div className="le-formRow"><label className="le-label">Minimum Willing Monthly Premium (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.minPremium ?? ""} onChange={(e) => updateNeedsPriorities("minPremium", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                              {renderNeedsAssessmentError("minPremium")}
                              <div className="le-formRow"><label className="le-label">Maximum Willing Monthly Premium (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.maxPremium ?? ""} onChange={(e) => updateNeedsPriorities("maxPremium", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                              {renderNeedsAssessmentError("maxPremium")}

                              {needsPrioritiesDerived.priority === "Protection" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Approximate Monthly Spend (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.protection?.monthlySpend ?? ""} onChange={(e) => updateNeedsPrioritySection("protection", "monthlySpend", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("protectionMonthlySpend")}
                                  <div className="le-formRow"><label className="le-label">Number of Dependents</label><input className="le-input" value={needsPrioritiesDerived.numberOfDependents} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Years to Protect Income</label><input className="le-input" value={needsPrioritiesDerived.yearsToProtectIncome} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Savings for Protection (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.protection?.savingsForProtection ?? ""} onChange={(e) => updateNeedsPrioritySection("protection", "savingsForProtection", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("protectionSavings")}
                                  <div className="le-formRow"><label className="le-label">Protection Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.protectionGap) ? needsPrioritiesDerived.protectionGap : ""} disabled /></div>
                                </>
                              )}

                              {needsPrioritiesDerived.priority === "Health" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Approx. Amount to Cover Critical Illness (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.health?.amountToCoverCriticalIllness ?? ""} onChange={(e) => updateNeedsPrioritySection("health", "amountToCoverCriticalIllness", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("healthAmount")}
                                  <div className="le-formRow"><label className="le-label">Savings for Critical Illness (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.health?.savingsForCriticalIllness ?? ""} onChange={(e) => updateNeedsPrioritySection("health", "savingsForCriticalIllness", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("healthSavings")}
                                  <div className="le-formRow"><label className="le-label">Critical Illness and Hospitalization Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.criticalIllnessGap) ? needsPrioritiesDerived.criticalIllnessGap : ""} disabled /></div>
                                </>
                              )}

                              {needsPrioritiesDerived.priority === "Investment" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Savings Plan *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.savingsPlan || ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsPlan", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="Home">Home</option><option value="Vehicle">Vehicle</option><option value="Holiday">Holiday</option><option value="Early Retirement">Early Retirement</option><option value="Other">Other</option></select></div>
                                  {renderNeedsAssessmentError("investmentSavingsPlan")}
                                  {String(needsAssessmentForm.needsPriorities?.investment?.savingsPlan || "") === "Other" && (<div className="le-formRow"><label className="le-label">Other Savings Plan *</label><input className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.savingsPlanOther || ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsPlanOther", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>)}
                                  {renderNeedsAssessmentError("investmentSavingsPlanOther")}
                                  <div className="le-formRow"><label className="le-label">Target Savings Amount (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.targetSavingsAmount ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "targetSavingsAmount", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("investmentTargetAmount")}
                                  <div className="le-formRow"><label className="le-label">Target Year to Utilize Savings *</label><input className="le-input" inputMode="numeric" value={needsAssessmentForm.needsPriorities?.investment?.targetUtilizationYear ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "targetUtilizationYear", String(e.target.value).replace(/[^\d]/g, "").slice(0, 4))} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("investmentTargetYear")}
                                  <div className="le-formRow"><label className="le-label">Savings for Investment (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.savingsForInvestment ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsForInvestment", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("investmentSavings")}
                                  <div className="le-formRow"><label className="le-label">Savings Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.savingsGap) ? needsPrioritiesDerived.savingsGap : ""} disabled /></div>

                                  <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Investment Risk Profiler</h5>
                                  <p className="le-muted" style={{ marginTop: 6, marginBottom: 6 }}>Subsection 1: Risk Appetite Survey</p>
                                  {renderNeedsAssessmentError("investmentRiskProfiler")}

                                  <div className="le-formRow"><label className="le-label">INVESTMENT HORIZON *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>How long will you allow your money to grow before you feel the need to have access to it?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.investmentHorizon || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), investmentHorizon: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="LT_3">Less than three years</option><option value="BETWEEN_3_7">Between three and seven years</option><option value="BETWEEN_7_10">Longer than seven years but less than 10 years</option><option value="AT_LEAST_10">At least 10 years</option></select></div>
                                  <div className="le-formRow"><label className="le-label">INVESTMENT GOAL *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>What is your goal for this investment?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.investmentGoal || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), investmentGoal: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="CAPITAL_PRESERVATION">Capital preservation with a potential return that is slightly higher than time deposit rate</option><option value="STEADY_GROWTH">Steady growth in capital</option><option value="SIGNIFICANT_APPRECIATION">A significant level of capital appreciation</option></select></div>
                                  <div className="le-formRow"><label className="le-label">EXPERIENCE WITH INVESTMENTS AND/OR FINANCIAL MARKETS *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>Have you had any experience investing in the following:</p><p className="le-smallNote" style={{ marginTop: 0, marginBottom: 8 }}>I. Mutual funds, unit investment trust funds, unit-linked insurance policies, local government and/or corporate bonds, listed stocks in the Philippine Stock Market</p><p className="le-smallNote" style={{ marginTop: 0, marginBottom: 8 }}>II. Foreign investments (stocks, bonds, funds outside the Philippine market), foreign currencies, hedge funds, derivatives (options, futures, forwards, etc.)</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.marketExperience || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), marketExperience: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="NONE">None of the above</option><option value="I_ONLY">In "I" only</option><option value="II_ONLY">In "II" only</option><option value="BOTH">In both "I" and "II"</option></select></div>
                                  <div className="le-formRow"><label className="le-label">REACTION TO SHORT-TERM VOLATILITY *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>What will you do if you experience a significant drop (e.g. 30%) in fund value within a year?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.volatilityReaction || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), volatilityReaction: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="FULL_WITHDRAW">Make a full withdrawal</option><option value="LESS_RISKY">Switch to a less risky fund</option><option value="HOLD">Do nothing or hold on to the funds</option><option value="TOP_UPS">Do top-ups or make additional investments</option></select></div>
                                  <div className="le-formRow"><label className="le-label">AFFORDABILITY TO CAPITAL LOSS *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>In the long term (more than five years), what is the level of capital loss you can afford to take?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.capitalLossAffordability || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), capitalLossAffordability: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="NO_LOSS">I cannot afford a loss</option><option value="UP_TO_5">I can afford up to 5% loss</option><option value="UP_TO_10">I can afford up to 10% loss</option><option value="ABOVE_10">I can afford more than 10% loss</option></select></div>
                                  <div className="le-formRow"><label className="le-label">RISK AND RETURN TRADE-OFF *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>Which of the sample portfolio would you prefer?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.riskReturnTradeoff || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), riskReturnTradeoff: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="PORTFOLIO_A">Portfolio A: 4% Potential annual gain, -3% Potential annual loss</option><option value="PORTFOLIO_B">Portfolio B: 6% Potential annual gain, -6% Potential annual loss</option><option value="PORTFOLIO_C">Portfolio C: 10% Potential annual gain, -12% Potential annual loss</option><option value="PORTFOLIO_D">Portfolio D: 20% or more Potential annual gain, -28% or more Potential annual loss</option></select></div>

                                  <h5 className="le-attemptSectionHeader" style={{ marginTop: 10 }}>Investor Risk Profile</h5>
                                  <div className="le-formRow"><label className="le-label">Risk Profile Score</label><input className="le-input" value={needsPrioritiesDerived.riskProfileScore ?? ""} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Profile Category</label><input className="le-input" value={RISK_CATEGORY_LABELS[needsPrioritiesDerived.riskProfileCategory] || ""} disabled /></div>
                                  <p className="le-muted" style={{ marginTop: 4, whiteSpace: "pre-line" }}>{RISK_CATEGORY_NOTES[needsPrioritiesDerived.riskProfileCategory] || ""}</p>
                                  <p className="le-smallNote" style={{ marginTop: 6, whiteSpace: "pre-line" }}>
                                    NOTES: The profile descriptions are only illustrative and outline the common traits of individuals with the corresponding investment risk profiles for reference. The fund risk rating, ranging from 1 to 3, is based on the underlying investments or assets and the volatility of the fund options. The higher the risk rating, the greater the potential return and the risk of loss. The investment risk profiling and its results should not be considered as a recommendation for the selection of the specific fund(s).
                                  </p>

                                  <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Fund/s Choice</h5>
                                  {renderNeedsAssessmentError("fundChoice")}
                                  <p className="le-muted" style={{ marginTop: 4 }}>After assessing prospect’s risk profile, current age, investment horizon and financial goals, choose the fund/s below (allocation in percentage must equal 100%).</p>

                                  <h6 className="le-attemptSectionHeader" style={{ marginTop: 10 }}>Suitable Funds</h6>
                                  {(needsPrioritiesDerived.suitableFunds || []).length === 0 ? (
                                    <p className="le-muted">No suitable funds for the current risk profile category.</p>
                                  ) : (
                                    <div className="le-attemptList" style={{ marginTop: 8 }}>
                                      {needsPrioritiesDerived.suitableFunds.map((fund) => (
                                        <div key={fund.key} className="le-attemptItem">
                                          <div className="le-attemptMeta">
                                            <div><span className="le-metaLabel">Fund</span><span className="le-metaValue">{fund.fundName}</span></div>
                                            <div><span className="le-metaLabel">Currency</span><span className="le-metaValue">{fund.currency}</span></div>
                                            <div><span className="le-metaLabel">Risk Rating</span><span className="le-metaValue">{fund.riskRating}</span></div>
                                            <div><span className="le-metaLabel">Allocation (%)</span><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.fundChoice?.allocations?.[fund.key] ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "fundChoice", { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice || {}), allocations: { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice?.allocations || {}), [fund.key]: String(e.target.value).replace(/[^\d.]/g, "") } })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <h6 className="le-attemptSectionHeader" style={{ marginTop: 10 }}>Other Funds</h6>
                                  <div className="le-attemptList" style={{ marginTop: 8 }}>
                                    {needsPrioritiesDerived.otherFunds.map((fund) => (
                                      <div key={fund.key} className="le-attemptItem">
                                        <div className="le-attemptMeta">
                                          <div><span className="le-metaLabel">Fund</span><span className="le-metaValue">{fund.fundName}</span></div>
                                          <div><span className="le-metaLabel">Currency</span><span className="le-metaValue">{fund.currency}</span></div>
                                          <div><span className="le-metaLabel">Risk Rating</span><span className="le-metaValue">{fund.riskRating}</span></div>
                                          <div><span className="le-metaLabel">Allocation (%)</span><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.fundChoice?.allocations?.[fund.key] ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "fundChoice", { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice || {}), allocations: { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice?.allocations || {}), [fund.key]: String(e.target.value).replace(/[^\d.]/g, "") } })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="le-formRow"><label className="le-label">Total Allocation (%)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.totalFundAllocation) ? needsPrioritiesDerived.totalFundAllocation : ""} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Fund Match</label><input className="le-input" value={needsPrioritiesDerived.fundMatch} disabled /></div>
                                  {needsPrioritiesDerived.fundMatch === "No" && (
                                    <div className="le-formRow"><label className="le-label">Reason for Mismatch *</label><textarea className="le-input" rows={3} value={needsAssessmentForm.needsPriorities?.investment?.fundChoice?.mismatchReason || ""} onChange={(e) => updateNeedsPrioritySection("investment", "fundChoice", { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice || {}), mismatchReason: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                                  )}
                                </>
                              )}
                              <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Product Selection *</h5>
                              <p className="le-muted">Your financial priority: {needsPrioritiesDerived.priority || "—"}</p>
                              <p className="le-muted" style={{ marginTop: 4 }}>{needsPrioritiesDerived.priority || "Selected"} Products Available:</p>
                              {!needsPrioritiesDerived.priority ? (
                                <p className="le-muted" style={{ marginTop: 8 }}>Select a financial priority first to view available products.</p>
                              ) : availableProductsByPriority.length === 0 ? (
                                <p className="le-muted" style={{ marginTop: 8 }}>No products found for this priority.</p>
                              ) : (
                                <div className="le-attemptList" style={{ marginTop: 8 }}>
                                  {availableProductsByPriority.map((product) => {
                                    const isSelected = String(needsAssessmentForm.needsPriorities?.productSelection?.selectedProductId || "") === String(product?._id || "");
                                    return (
                                      <div key={String(product?._id || product?.productName)} className="le-attemptItem">
                                        <h6 className="le-attemptSectionHeader" style={{ marginTop: 0 }}>{product?.productName || "—"}</h6>
                                        <p className="le-muted" style={{ marginTop: 4 }}>{product?.description || "No description available."}</p>
                                        <div className="le-actions" style={{ marginTop: 8 }}>
                                          <button
                                            type="button"
                                            className={`le-btn ${isSelected ? "primary" : "secondary"}`}
                                            onClick={() => updateNeedsPriorities("productSelection", {
                                              selectedProductId: String(product?._id || ""),
                                              requestedFrequency: "Monthly",
                                              requestedPremiumPayment: needsAssessmentForm.needsPriorities?.minPremium ?? "",
                                              methodForInitialPayment: "",
                                            })}
                                            disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}
                                          >
                                            {isSelected ? "Selected" : "Select"}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {renderNeedsAssessmentError("selectedProductId")}

                              <div className="le-formRow"><label className="le-label">Requested Frequency of Premium Payment *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.productSelection?.requestedFrequency || "Monthly"} onChange={(e) => { const v = e.target.value; updateNeedsPriorities("productSelection", { ...(needsAssessmentForm.needsPriorities?.productSelection || {}), requestedFrequency: v, requestedPremiumPayment: v === "Monthly" ? (needsAssessmentForm.needsPriorities?.minPremium ?? "") : "" }); }} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Half-yearly">Half-yearly</option><option value="Yearly">Yearly</option></select></div>
                              {renderNeedsAssessmentError("requestedFrequency")}
                              <div className="le-formRow"><label className="le-label">Requested Premium Payment (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.productSelection?.requestedPremiumPayment ?? ""} onChange={(e) => updateNeedsPriorities("productSelection", { ...(needsAssessmentForm.needsPriorities?.productSelection || {}), requestedPremiumPayment: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>
                              {renderNeedsAssessmentError("requestedPremiumPayment")}
                              <div className="le-formRow"><label className="le-label">Method for Initial Payment *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.productSelection?.methodForInitialPayment || ""} onChange={(e) => updateNeedsPriorities("productSelection", { ...(needsAssessmentForm.needsPriorities?.productSelection || {}), methodForInitialPayment: e.target.value })} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}><option value="">Select</option><option value="Credit Card / Debit Card">Credit Card / Debit Card</option><option value="Mobile Wallet / GCash">Mobile Wallet / GCash</option><option value="Dated Check">Dated Check</option><option value="Bills Payments">Bills Payments</option></select></div>
                              {renderNeedsAssessmentError("methodForInitialPayment")}

                              <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Optional Riders</h5>
                              <div className="le-attemptList" style={{ marginTop: 8 }}>
                                {OPTIONAL_RIDER_CATALOG.map((rider, idx) => {
                                  const saved = (needsAssessmentForm.needsPriorities?.optionalRiders || []).find((r) => String(r?.riderKey || "") === rider.riderKey);
                                  const enabled = Boolean(saved?.enabled);
                                  return (
                                    <div key={`${rider.riderKey}-${idx}`} className="le-attemptItem">
                                      <div className="le-attemptMeta">
                                        <div><span className="le-metaLabel">Rider</span><span className="le-metaValue">{rider.riderName || "—"}</span></div>
                                        <div><span className="le-metaLabel">Description</span><span className="le-metaValue">{rider.description || "—"}</span></div>
                                        <div style={{ marginTop: 8 }}>
                                          <button
                                            type="button"
                                            className={`le-toggleBtn ${enabled ? "is-on" : "is-off"}`}
                                            aria-pressed={enabled}
                                            onClick={() => {
                                              const current = OPTIONAL_RIDER_CATALOG.map((item) => {
                                                const prev = (needsAssessmentForm.needsPriorities?.optionalRiders || []).find((r) => String(r?.riderKey || "") === item.riderKey);
                                                return {
                                                  riderKey: item.riderKey,
                                                  riderName: item.riderName,
                                                  enabled: Boolean(prev?.enabled),
                                                };
                                              });
                                              current[idx] = { ...current[idx], enabled: !enabled };
                                              updateNeedsPriorities("optionalRiders", current);
                                            }}
                                            disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}
                                          >
                                            <span className="le-toggleTrack" aria-hidden="true">
                                              <span className="le-toggleThumb" />
                                            </span>
                                            <span className="le-toggleText">{enabled ? "Included" : "Not Included"}</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>


                              <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Notes (Optional)</h5>
                              <div className="le-formRow"><label className="le-label">Notes about selected product and optional riders</label><textarea className="le-input" rows={3} value={needsAssessmentForm.needsPriorities?.productRidersNotes || ""} onChange={(e) => updateNeedsPriorities("productRidersNotes", e.target.value)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving} /></div>

                            </>
                          )}

                          

                          {isNeedsAssessmentEditableNow && !isNeedsAssessmentLocked && (
                            <div className="le-actions" style={{ marginTop: 14 }}>
                              <button
                                type="button"
                                className="le-btn secondary"
                                onClick={() => {
                                  setNeedsAssessmentError("");
                                  setNeedsAssessmentSavedAt("");
                                  fetchNeedsAssessment();
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

                      {showProposalSchedulingSection && (
                        <div>
                          <div className="le-block" style={{ marginTop: 16 }}>
                            <h4 className="le-blockTitle">Saved Needs Assessment Details</h4>
                            <p className="le-smallNote">Basic Information</p>
                            <div className="le-attemptMeta">
                              {String(needsAssessmentForm.basicInformation?.fullName || "").trim() ? <div><span className="le-metaLabel">Full Name</span><span className="le-metaValue">{needsAssessmentForm.basicInformation.fullName}</span></div> : null}
                              {String(needsAssessmentForm.basicInformation?.sex || "").trim() ? <div><span className="le-metaLabel">Sex</span><span className="le-metaValue">{needsAssessmentForm.basicInformation.sex}</span></div> : null}
                              {String(needsAssessmentForm.basicInformation?.civilStatus || "").trim() ? <div><span className="le-metaLabel">Civil Status</span><span className="le-metaValue">{needsAssessmentForm.basicInformation.civilStatus}</span></div> : null}
                              {String(needsAssessmentForm.basicInformation?.birthday || "").trim() ? <div><span className="le-metaLabel">Birthday</span><span className="le-metaValue">{needsAssessmentForm.basicInformation.birthday}</span></div> : null}
                              {String(needsAssessmentForm.basicInformation?.age || "").trim() ? <div><span className="le-metaLabel">Age</span><span className="le-metaValue">{needsAssessmentForm.basicInformation.age}</span></div> : null}
                              {String(needsAssessmentForm.basicInformation?.occupation || "").trim() ? <div><span className="le-metaLabel">Occupation</span><span className="le-metaValue">{needsAssessmentForm.basicInformation.occupation}</span></div> : null}
                              {[
                                needsAssessmentForm.basicInformation?.addressLine,
                                needsAssessmentForm.basicInformation?.barangay,
                                needsAssessmentForm.basicInformation?.city === "Other"
                                  ? needsAssessmentForm.basicInformation?.otherCity
                                  : needsAssessmentForm.basicInformation?.city,
                                needsAssessmentForm.basicInformation?.region,
                                needsAssessmentForm.basicInformation?.zipCode,
                              ].filter(Boolean).join(", ")
                                ? <div><span className="le-metaLabel">Address</span><span className="le-metaValue">{[
                                    needsAssessmentForm.basicInformation?.addressLine,
                                    needsAssessmentForm.basicInformation?.barangay,
                                    needsAssessmentForm.basicInformation?.city === "Other"
                                      ? needsAssessmentForm.basicInformation?.otherCity
                                      : needsAssessmentForm.basicInformation?.city,
                                    needsAssessmentForm.basicInformation?.region,
                                    needsAssessmentForm.basicInformation?.zipCode,
                                  ].filter(Boolean).join(", ")}</span></div>
                                : null}
                            </div>
                            {(needsAssessmentForm.dependents || []).length > 0 ? (
                              <>
                                <p className="le-smallNote" style={{ marginTop: 12 }}>Dependents</p>
                                <div className="le-attemptList" style={{ marginTop: 8 }}>
                                  {(needsAssessmentForm.dependents || []).map((d, idx) => (
                                    <div key={`saved-dep-${idx}`} className="le-attemptItem">
                                      <div className="le-attemptMeta">
                                        {String(d?.name || "").trim() ? <div><span className="le-metaLabel">Name</span><span className="le-metaValue">{d.name}</span></div> : null}
                                        {d?.age !== "" && d?.age !== null && d?.age !== undefined ? <div><span className="le-metaLabel">Age</span><span className="le-metaValue">{d.age}</span></div> : null}
                                        {String(d?.gender || "").trim() ? <div><span className="le-metaLabel">Gender</span><span className="le-metaValue">{d.gender}</span></div> : null}
                                        {String(d?.relationship || "").trim() ? <div><span className="le-metaLabel">Relationship</span><span className="le-metaValue">{d.relationship}</span></div> : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : null}

                            <p className="le-smallNote" style={{ marginTop: 12 }}>Needs & Priorities</p>
                            <div className="le-attemptMeta">
                              {String(needsAssessmentForm.needsPriorities?.currentPriority || "").trim() ? <div><span className="le-metaLabel">Current Priority</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.currentPriority}</span></div> : null}
                              {String(needsAssessmentForm.needsPriorities?.monthlyIncomeBand || "").trim() ? <div><span className="le-metaLabel">Income Band</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.monthlyIncomeBand}</span></div> : null}
                              {needsAssessmentForm.needsPriorities?.minPremium !== "" && needsAssessmentForm.needsPriorities?.minPremium !== null && needsAssessmentForm.needsPriorities?.minPremium !== undefined ? <div><span className="le-metaLabel">Min Premium</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.minPremium}</span></div> : null}
                              {needsAssessmentForm.needsPriorities?.maxPremium !== "" && needsAssessmentForm.needsPriorities?.maxPremium !== null && needsAssessmentForm.needsPriorities?.maxPremium !== undefined ? <div><span className="le-metaLabel">Max Premium</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.maxPremium}</span></div> : null}
                              {(availableProducts || []).find((p) => String(p?._id || "") === String(needsAssessmentForm.needsPriorities?.productSelection?.selectedProductId || ""))?.productName ? <div><span className="le-metaLabel">Selected Product</span><span className="le-metaValue">{(availableProducts || []).find((p) => String(p?._id || "") === String(needsAssessmentForm.needsPriorities?.productSelection?.selectedProductId || ""))?.productName}</span></div> : null}
                              {needsAssessmentForm.needsPriorities?.productSelection?.requestedPremiumPayment !== "" && needsAssessmentForm.needsPriorities?.productSelection?.requestedPremiumPayment !== null && needsAssessmentForm.needsPriorities?.productSelection?.requestedPremiumPayment !== undefined ? <div><span className="le-metaLabel">Requested Premium Payment</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.productSelection.requestedPremiumPayment}</span></div> : null}
                              {String(needsAssessmentForm.needsPriorities?.productSelection?.requestedFrequency || "").trim() ? <div><span className="le-metaLabel">Requested Frequency</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.productSelection.requestedFrequency}</span></div> : null}
                              {String(needsAssessmentForm.needsPriorities?.productSelection?.methodForInitialPayment || "").trim() ? <div><span className="le-metaLabel">Initial Payment Method</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.productSelection.methodForInitialPayment}</span></div> : null}
                            </div>

                            {needsPrioritiesDerived.priority === "Protection" ? (
                              <>
                                <p className="le-smallNote" style={{ marginTop: 12 }}>Protection Details</p>
                                <div className="le-attemptMeta">
                                  {needsAssessmentForm.needsPriorities?.protection?.monthlySpend !== "" && needsAssessmentForm.needsPriorities?.protection?.monthlySpend !== null && needsAssessmentForm.needsPriorities?.protection?.monthlySpend !== undefined ? <div><span className="le-metaLabel">Monthly Spend</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.protection.monthlySpend}</span></div> : null}
                                  {Number.isFinite(needsPrioritiesDerived.numberOfDependents) ? <div><span className="le-metaLabel">Number of Dependents</span><span className="le-metaValue">{needsPrioritiesDerived.numberOfDependents}</span></div> : null}
                                  {Number.isFinite(needsPrioritiesDerived.yearsToProtectIncome) ? <div><span className="le-metaLabel">Years to Protect Income</span><span className="le-metaValue">{needsPrioritiesDerived.yearsToProtectIncome}</span></div> : null}
                                  {needsAssessmentForm.needsPriorities?.protection?.savingsForProtection !== "" && needsAssessmentForm.needsPriorities?.protection?.savingsForProtection !== null && needsAssessmentForm.needsPriorities?.protection?.savingsForProtection !== undefined ? <div><span className="le-metaLabel">Savings for Protection</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.protection.savingsForProtection}</span></div> : null}
                                  {Number.isFinite(needsPrioritiesDerived.protectionGap) ? <div><span className="le-metaLabel">Protection Gap</span><span className="le-metaValue">{needsPrioritiesDerived.protectionGap}</span></div> : null}
                                </div>
                              </>
                            ) : null}

                            {needsPrioritiesDerived.priority === "Health" ? (
                              <>
                                <p className="le-smallNote" style={{ marginTop: 12 }}>Health Details</p>
                                <div className="le-attemptMeta">
                                  {needsAssessmentForm.needsPriorities?.health?.amountToCoverCriticalIllness !== "" && needsAssessmentForm.needsPriorities?.health?.amountToCoverCriticalIllness !== null && needsAssessmentForm.needsPriorities?.health?.amountToCoverCriticalIllness !== undefined ? <div><span className="le-metaLabel">Amount to Cover Critical Illness</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.health.amountToCoverCriticalIllness}</span></div> : null}
                                  {needsAssessmentForm.needsPriorities?.health?.savingsForCriticalIllness !== "" && needsAssessmentForm.needsPriorities?.health?.savingsForCriticalIllness !== null && needsAssessmentForm.needsPriorities?.health?.savingsForCriticalIllness !== undefined ? <div><span className="le-metaLabel">Savings for Critical Illness</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.health.savingsForCriticalIllness}</span></div> : null}
                                  {Number.isFinite(needsPrioritiesDerived.criticalIllnessGap) ? <div><span className="le-metaLabel">Critical Illness Gap</span><span className="le-metaValue">{needsPrioritiesDerived.criticalIllnessGap}</span></div> : null}
                                </div>
                              </>
                            ) : null}

                            {needsPrioritiesDerived.priority === "Investment" ? (
                              <>
                                <p className="le-smallNote" style={{ marginTop: 12 }}>Investment Details</p>
                                <div className="le-attemptMeta">
                                  {String(needsAssessmentForm.needsPriorities?.investment?.savingsPlan || "").trim() ? <div><span className="le-metaLabel">Savings Plan</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.investment.savingsPlan}</span></div> : null}
                                  {String(needsAssessmentForm.needsPriorities?.investment?.savingsPlanOther || "").trim() ? <div><span className="le-metaLabel">Savings Plan (Other)</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.investment.savingsPlanOther}</span></div> : null}
                                  {needsAssessmentForm.needsPriorities?.investment?.targetSavingsAmount !== "" && needsAssessmentForm.needsPriorities?.investment?.targetSavingsAmount !== null && needsAssessmentForm.needsPriorities?.investment?.targetSavingsAmount !== undefined ? <div><span className="le-metaLabel">Target Savings Amount</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.investment.targetSavingsAmount}</span></div> : null}
                                  {needsAssessmentForm.needsPriorities?.investment?.targetUtilizationYear ? <div><span className="le-metaLabel">Target Utilization Year</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.investment.targetUtilizationYear}</span></div> : null}
                                  {needsAssessmentForm.needsPriorities?.investment?.savingsForInvestment !== "" && needsAssessmentForm.needsPriorities?.investment?.savingsForInvestment !== null && needsAssessmentForm.needsPriorities?.investment?.savingsForInvestment !== undefined ? <div><span className="le-metaLabel">Savings for Investment</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.investment.savingsForInvestment}</span></div> : null}
                                  {Number.isFinite(needsPrioritiesDerived.savingsGap) ? <div><span className="le-metaLabel">Savings Gap</span><span className="le-metaValue">{needsPrioritiesDerived.savingsGap}</span></div> : null}
                                  {needsPrioritiesDerived.riskProfileScore !== null && needsPrioritiesDerived.riskProfileScore !== undefined ? <div><span className="le-metaLabel">Risk Profile Score</span><span className="le-metaValue">{needsPrioritiesDerived.riskProfileScore}</span></div> : null}
                                  {String(RISK_CATEGORY_LABELS[needsPrioritiesDerived.riskProfileCategory] || "").trim() ? <div><span className="le-metaLabel">Risk Category</span><span className="le-metaValue">{RISK_CATEGORY_LABELS[needsPrioritiesDerived.riskProfileCategory]}</span></div> : null}
                                  {Number.isFinite(needsPrioritiesDerived.totalFundAllocation) ? <div><span className="le-metaLabel">Total Allocation (%)</span><span className="le-metaValue">{needsPrioritiesDerived.totalFundAllocation}</span></div> : null}
                                  {String(needsPrioritiesDerived.fundMatch || "").trim() ? <div><span className="le-metaLabel">Fund Match</span><span className="le-metaValue">{needsPrioritiesDerived.fundMatch}</span></div> : null}
                                  {String(needsAssessmentForm.needsPriorities?.investment?.fundChoice?.mismatchReason || "").trim() ? <div><span className="le-metaLabel">Mismatch Reason</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.investment.fundChoice.mismatchReason}</span></div> : null}
                                </div>

                                {(needsPrioritiesDerived.selectedFunds || []).length > 0 ? (
                                  <>
                                    <p className="le-smallNote" style={{ marginTop: 12 }}>Selected Funds</p>
                                    <div className="le-attemptList" style={{ marginTop: 8 }}>
                                      {needsPrioritiesDerived.selectedFunds.map((fund) => (
                                        <div key={`saved-fund-${fund.key}`} className="le-attemptItem">
                                          <div className="le-attemptMeta">
                                            <div><span className="le-metaLabel">Fund</span><span className="le-metaValue">{fund.fundName}</span></div>
                                            <div><span className="le-metaLabel">Allocation (%)</span><span className="le-metaValue">{fund.allocationPercent}</span></div>
                                            <div><span className="le-metaLabel">Risk Rating</span><span className="le-metaValue">{fund.riskRating}</span></div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : null}
                              </>
                            ) : null}

                            {((needsAssessmentForm.needsPriorities?.optionalRiders || []).filter((r) => r?.enabled).length > 0 || String(needsAssessmentForm.needsPriorities?.productRidersNotes || "").trim()) ? (
                              <>
                                <p className="le-smallNote" style={{ marginTop: 12 }}>Riders & Notes</p>
                                <div className="le-attemptMeta">
                                  {(needsAssessmentForm.needsPriorities?.optionalRiders || []).filter((r) => r?.enabled).length > 0 ? (
                                    <div>
                                      <span className="le-metaLabel">Selected Riders</span>
                                      <span className="le-metaValue">{(needsAssessmentForm.needsPriorities?.optionalRiders || []).filter((r) => r?.enabled).map((r) => r?.riderName).filter(Boolean).join(", ")}</span>
                                    </div>
                                  ) : null}
                                  {String(needsAssessmentForm.needsPriorities?.productRidersNotes || "").trim() ? (
                                    <div><span className="le-metaLabel">Notes</span><span className="le-metaValue">{needsAssessmentForm.needsPriorities.productRidersNotes}</span></div>
                                  ) : null}
                                </div>
                              </>
                            ) : null}
                          </div>

                          {!needsAssessmentSaving && needsAssessmentSavedAt ? (
                            <p className="le-smallNote" style={{ color: "#0f766e", marginTop: 12, marginBottom: 8 }}>Saved successfully.</p>
                          ) : null}

                          <div className="le-block" style={{ marginTop: 16 }}>
                            <h4 className="le-blockTitle">Schedule Proposal Presentation</h4>
                            {proposalMeetingSaved ? (
                              <p className="le-smallNote" style={{ color: "#0f766e" }}>
                                Existing schedule: {formatDateTime(proposalMeetingSaved.startAt)} ({proposalMeetingSaved.durationMin} mins, {proposalMeetingSaved.mode})
                              </p>
                            ) : null}

                            <div className="le-formRow">
                              <label className="le-label">Meeting Date *</label>
                              <input
                                type="date"
                                className="le-input"
                                value={proposalMeetingForm.meetingDate}
                                min={toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setProposalMeetingForm((f) => ({ ...f, meetingDate: v }));
                                  setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingDate: "", meetingStartTime: "" }));
                                }}
                                disabled={savingProposalMeeting}
                              />
                              {proposalMeetingFieldErrors.meetingDate ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingDate}</p> : null}
                            </div>
                            <div className="le-formRow">
                              <label className="le-label">Start Time *</label>
                              <select
                                className="le-input"
                                value={proposalMeetingForm.meetingStartTime}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setProposalMeetingForm((f) => ({ ...f, meetingStartTime: v }));
                                  setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingStartTime: "" }));
                                }}
                                disabled={savingProposalMeeting}
                              >
                                <option value="">Select Time</option>
                                {proposalMeetingStartSlots.map((t) => {
                                  const isBooked = proposalMeetingForm.meetingDate
                                    ? isSlotBooked(proposalMeetingForm.meetingDate, t, proposalMeetingForm.meetingDurationMin, proposalMeetingSaved?.startAt)
                                    : false;
                                  return (
                                    <option key={`proposal-${t}`} value={t} disabled={isBooked}>
                                      {isBooked ? `${formatTimeLabel(t)} (Unavailable)` : formatTimeLabel(t)}
                                    </option>
                                  );
                                })}
                              </select>
                              {proposalMeetingFieldErrors.meetingStartTime ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingStartTime}</p> : null}
                            </div>
                            <div className="le-formRow">
                              <label className="le-label">Duration *</label>
                              <select
                                className="le-input"
                                value={proposalMeetingForm.meetingDurationMin}
                                onChange={(e) => {
                                  setProposalMeetingForm((f) => ({ ...f, meetingDurationMin: Number(e.target.value) }));
                                  setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingDurationMin: "", meetingStartTime: "" }));
                                }}
                                disabled={savingProposalMeeting}
                              >
                                <option value={30}>30 mins</option>
                                <option value={60}>60 mins</option>
                                <option value={90}>90 mins</option>
                                <option value={120}>120 mins</option>
                              </select>
                              {proposalMeetingFieldErrors.meetingDurationMin ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingDurationMin}</p> : null}
                            </div>
                            <div className="le-formRow">
                              <label className="le-label">Meeting Mode *</label>
                              <select
                                className="le-input"
                                value={proposalMeetingForm.meetingMode}
                                onChange={(e) => {
                                  setProposalMeetingForm((f) => ({
                                    ...f,
                                    meetingMode: e.target.value,
                                    meetingPlatform: "",
                                    meetingPlatformOther: "",
                                    meetingLink: "",
                                    meetingInviteSent: false,
                                    meetingPlace: "",
                                  }));
                                  setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingMode: "" }));
                                }}
                                disabled={savingProposalMeeting}
                              >
                                <option value="">Select</option>
                                <option value="Online">Online</option>
                                <option value="Face-to-face">Face-to-face</option>
                              </select>
                              {proposalMeetingFieldErrors.meetingMode ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingMode}</p> : null}
                            </div>

                            {proposalMeetingForm.meetingMode === "Online" && (
                              <>
                                <div className="le-formRow">
                                  <label className="le-label">Meeting Platform *</label>
                                  <select
                                    className="le-input"
                                    value={proposalMeetingForm.meetingPlatform}
                                    onChange={(e) => {
                                      setProposalMeetingForm((f) => ({ ...f, meetingPlatform: e.target.value }));
                                      setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingPlatform: "", meetingPlatformOther: "" }));
                                    }}
                                    disabled={savingProposalMeeting}
                                  >
                                    <option value="">Select</option>
                                    <option value="Zoom">Zoom</option>
                                    <option value="Google Meet">Google Meet</option>
                                    <option value="Other">Other</option>
                                  </select>
                                  {proposalMeetingFieldErrors.meetingPlatform ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingPlatform}</p> : null}
                                </div>
                                {proposalMeetingForm.meetingPlatform === "Other" && (
                                  <div className="le-formRow">
                                    <label className="le-label">Specify Platform *</label>
                                    <input
                                      className="le-input"
                                      value={proposalMeetingForm.meetingPlatformOther}
                                      onChange={(e) => {
                                        setProposalMeetingForm((f) => ({ ...f, meetingPlatformOther: e.target.value }));
                                        setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingPlatformOther: "" }));
                                      }}
                                      disabled={savingProposalMeeting}
                                    />
                                    {proposalMeetingFieldErrors.meetingPlatformOther ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingPlatformOther}</p> : null}
                                  </div>
                                )}
                                <div className="le-formRow">
                                  <label className="le-label">Meeting Link *</label>
                                  <input
                                    className="le-input"
                                    value={proposalMeetingForm.meetingLink}
                                    onChange={(e) => {
                                      setProposalMeetingForm((f) => ({ ...f, meetingLink: e.target.value }));
                                      setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingLink: "" }));
                                    }}
                                    placeholder="https://..."
                                    disabled={savingProposalMeeting}
                                  />
                                  {proposalMeetingFieldErrors.meetingLink ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingLink}</p> : null}
                                </div>
                                <div className="le-formRow">
                                  <label className="le-check">
                                    <input
                                      type="checkbox"
                                      checked={proposalMeetingForm.meetingInviteSent}
                                      onChange={(e) => {
                                        setProposalMeetingForm((f) => ({ ...f, meetingInviteSent: e.target.checked }));
                                        setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingInviteSent: "" }));
                                      }}
                                      disabled={savingProposalMeeting}
                                    />
                                    <span>I confirm invite link has been sent (required)</span>
                                  </label>
                                  {proposalMeetingFieldErrors.meetingInviteSent ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingInviteSent}</p> : null}
                                </div>
                              </>
                            )}

                            {proposalMeetingForm.meetingMode === "Face-to-face" && (
                              <div className="le-formRow">
                                <label className="le-label">Meeting Place *</label>
                                <input
                                  className="le-input"
                                  value={proposalMeetingForm.meetingPlace}
                                  onChange={(e) => {
                                    setProposalMeetingForm((f) => ({ ...f, meetingPlace: e.target.value }));
                                    setProposalMeetingFieldErrors((prev) => ({ ...prev, meetingPlace: "" }));
                                  }}
                                  disabled={savingProposalMeeting}
                                />
                                {proposalMeetingFieldErrors.meetingPlace ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalMeetingFieldErrors.meetingPlace}</p> : null}
                              </div>
                            )}

                            <div className="le-actions">
                              <button
                                type="button"
                                className="le-btn secondary"
                                onClick={() => {
                                  setProposalMeetingError("");
                                  setProposalMeetingFieldErrors({});
                                  fetchNeedsAssessment();
                                }}
                                disabled={savingProposalMeeting}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="le-btn primary"
                                onClick={submitScheduleProposalPresentation}
                                disabled={savingProposalMeeting}
                              >
                                {savingProposalMeeting ? "Saving..." : "Save Proposal Presentation Schedule"}
                              </button>
                            </div>

                            {proposalMeetingError ? <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{proposalMeetingError}</p> : null}

                          </div>
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
