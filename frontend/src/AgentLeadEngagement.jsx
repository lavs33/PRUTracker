import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaChevronRight, FaEdit } from "react-icons/fa";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentLeadEngagement.css";
import { PH_CITY_REGION_OPTIONS, CITY_TO_REGION } from "./constants/phCityRegionOptions";

function SubactivityNavigator({
  steps,
  currentIndex,
  viewedIndex,
  onSelect,
  helperText = "",
  showCurrentStatus = true,
  allowAllSteps = false,
}) {
  return (
    <div className="le-subactivityShell">
      <div className="le-activityTracker le-activityTracker--interactive">
        {steps.map((step, idx) => {
          const isViewed = idx === viewedIndex;
          const isCurrent = showCurrentStatus && idx === currentIndex;
          const isReached = allowAllSteps || idx <= currentIndex;
          const isDone = allowAllSteps || idx < currentIndex;
          const isReachable = allowAllSteps || idx <= currentIndex;

          return (
            <button
              key={step.key}
              type="button"
              className={`${isReachable ? "reachable" : ""} ${isReached ? "reached" : ""} ${isDone ? "done" : ""} ${isViewed ? "viewed" : ""} ${isCurrent ? "live-current" : ""}`.trim()}
              onClick={() => onSelect(step.key)}
              disabled={!isReachable}
              aria-current={isViewed ? "step" : undefined}
              title={!isReachable ? "Finish the current subactivity first." : undefined}
            >
              <span className="le-activityTracker__label">{step.label}</span>
              {isCurrent ? <small className="le-activityTracker__status">Current</small> : null}
            </button>
          );
        })}
      </div>

      {helperText ? <p className="le-smallNote le-subactivityHint">{helperText}</p> : null}
    </div>
  );
}

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
  const [editingAttemptId, setEditingAttemptId] = useState("");
  const [attemptErrors, setAttemptErrors] = useState({});
  const [attemptForm, setAttemptForm] = useState({
    primaryChannel: "",
    otherChannels: [],
    response: "",
    attemptedAtLabel: "", // display only (non-editable)
    notes: "",
  });

  const [validateForm, setValidateForm] = useState({ phoneValidation: "" });
  const [contactingViewedActivityKey, setContactingViewedActivityKey] = useState("");
  const [validatingContact, setValidatingContact] = useState(false);
  const [validateError, setValidateError] = useState("");
  const [validateFieldErrors, setValidateFieldErrors] = useState({});

  const [interestForm, setInterestForm] = useState({
    interestLevel: "",
    preferredChannel: "",
    preferredChannelOther: "",
  });
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestError, setInterestError] = useState("");
  const [interestFieldErrors, setInterestFieldErrors] = useState({});
  const [confirmNotInterestedModalOpen, setConfirmNotInterestedModalOpen] = useState(false);
  const [dropOutcomeModal, setDropOutcomeModal] = useState(null);

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
  const [meetingFieldErrors, setMeetingFieldErrors] = useState({});
  const [rescheduleFromNeedsMode, setRescheduleFromNeedsMode] = useState(false);

  const [needsAssessmentLoading, setNeedsAssessmentLoading] = useState(false);
  const [needsAssessmentSaving, setNeedsAssessmentSaving] = useState(false);
  const [needsAssessmentError, setNeedsAssessmentError] = useState("");
  const [needsAssessmentSavedAt, setNeedsAssessmentSavedAt] = useState("");
  const [needsAssessmentCurrentActivityKey, setNeedsAssessmentCurrentActivityKey] = useState("Record Prospect Attendance");
  const [needsAssessmentViewedActivityKey, setNeedsAssessmentViewedActivityKey] = useState("");
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
  const [proposalCurrentActivityKey, setProposalCurrentActivityKey] = useState("Generate Proposal");
  const [proposalViewedActivityKey, setProposalViewedActivityKey] = useState("");
  const [proposalGenerateForm, setProposalGenerateForm] = useState({
    chosenProductId: "",
    chosenProductName: "",
    chosenProductDescription: "",
    proposalFileName: "",
    proposalFileMimeType: "",
    proposalFileDataUrl: "",
    sentToProspectEmail: false,
    sentToProspectAt: "",
    uploadedAt: "",
  });
  const [applicationChosenProduct, setApplicationChosenProduct] = useState({
    id: "",
    productName: "",
    description: "",
  });
  const [proposalGenerateSaving, setProposalGenerateSaving] = useState(false);
  const [proposalGenerateError, setProposalGenerateError] = useState("");
  const [proposalGenerateFieldErrors, setProposalGenerateFieldErrors] = useState({});
  const [proposalFileInputKey, setProposalFileInputKey] = useState(0);
  const [proposalAttendanceForm, setProposalAttendanceForm] = useState({
    attendanceChoice: "",
    attendanceProofImageDataUrl: "",
    attendanceProofFileName: "",
    attendedAt: "",
  });
  const [proposalAttendanceSaving, setProposalAttendanceSaving] = useState(false);
  const [proposalAttendanceError, setProposalAttendanceError] = useState("");
  const [proposalPresentationForm, setProposalPresentationForm] = useState({
    proposalAccepted: "",
    initialQuotationNotes: "",
    presentedAt: "",
  });
  const [proposalPresentationSaving, setProposalPresentationSaving] = useState(false);
  const [proposalPresentationError, setProposalPresentationError] = useState("");
  const [applicationMeetingForm, setApplicationMeetingForm] = useState({
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
  const [applicationMeetingSaved, setApplicationMeetingSaved] = useState(null);
  const [savingApplicationMeeting, setSavingApplicationMeeting] = useState(false);
  const [applicationMeetingError, setApplicationMeetingError] = useState("");
  const [applicationMeetingFieldErrors, setApplicationMeetingFieldErrors] = useState({});
  const [applicationAttendanceForm, setApplicationAttendanceForm] = useState({
    attendanceChoice: "",
    attendanceProofImageDataUrl: "",
    attendanceProofFileName: "",
    attendedAt: "",
  });
  const [applicationAttendanceError, setApplicationAttendanceError] = useState("");
  const [applicationAttendanceSaving, setApplicationAttendanceSaving] = useState(false);
  const [applicationPremiumPaymentForm, setApplicationPremiumPaymentForm] = useState({
    totalAnnualPremiumPhp: "",
    totalFrequencyPremiumPhp: "",
    methodForInitialPayment: "",
    methodForRenewalPayment: "",
    paymentProofImageDataUrl: "",
    paymentProofFileName: "",
    savedAt: "",
  });
  const [applicationPremiumPaymentError, setApplicationPremiumPaymentError] = useState("");
  const [applicationPremiumPaymentSaving, setApplicationPremiumPaymentSaving] = useState(false);
  const [applicationPremiumPaymentFieldErrors, setApplicationPremiumPaymentFieldErrors] = useState({});
  const [applicationPaymentProofInputKey, setApplicationPaymentProofInputKey] = useState(0);
  const [applicationNeedsPaymentSelection, setApplicationNeedsPaymentSelection] = useState({
    requestedFrequency: "",
  });
  const [applicationSubmissionForm, setApplicationSubmissionForm] = useState({
    pruOneTransactionId: "",
    submissionScreenshotImageDataUrl: "",
    submissionScreenshotFileName: "",
    savedAt: "",
  });
  const [applicationSubmissionFieldErrors, setApplicationSubmissionFieldErrors] = useState({});
  const [applicationSubmissionSaving, setApplicationSubmissionSaving] = useState(false);
  const [applicationSubmissionError, setApplicationSubmissionError] = useState("");
  const [applicationSubmissionScreenshotInputKey, setApplicationSubmissionScreenshotInputKey] = useState(0);
  const [applicationViewedActivityKey, setApplicationViewedActivityKey] = useState("");
  const [policyCurrentActivityKey, setPolicyCurrentActivityKey] = useState("Record Policy Application Status");
  const [policyViewedActivityKey, setPolicyViewedActivityKey] = useState("");
  const [policyStatusForm, setPolicyStatusForm] = useState({
    status: "",
    issuanceDate: "",
    notes: "",
    savedAt: "",
  });
  const [policyStatusFieldErrors, setPolicyStatusFieldErrors] = useState({});
  const [policyStatusSaving, setPolicyStatusSaving] = useState(false);
  const [policyStatusError, setPolicyStatusError] = useState("");
  const [policyInitialEorForm, setPolicyInitialEorForm] = useState({
    eorNumber: "",
    receiptDate: "",
    eorFileDataUrl: "",
    eorFileName: "",
    uploadedAt: "",
  });
  const [policyInitialEorFieldErrors, setPolicyInitialEorFieldErrors] = useState({});
  const [policyInitialEorSaving, setPolicyInitialEorSaving] = useState(false);
  const [policyInitialEorError, setPolicyInitialEorError] = useState("");
  const [policyInitialEorInputKey, setPolicyInitialEorInputKey] = useState(0);
  const [policySummaryForm, setPolicySummaryForm] = useState({
    policyNumber: "",
    policySummaryFileDataUrl: "",
    policySummaryFileName: "",
    uploadedAt: "",
  });
  const [policySummaryFieldErrors, setPolicySummaryFieldErrors] = useState({});
  const [policySummarySaving, setPolicySummarySaving] = useState(false);
  const [policySummaryError, setPolicySummaryError] = useState("");
  const [policySummaryInputKey, setPolicySummaryInputKey] = useState(0);
  const [policyChosenProduct, setPolicyChosenProduct] = useState(null);
  const [policyIssuanceAge, setPolicyIssuanceAge] = useState(null);
  const [policyCoverageForm, setPolicyCoverageForm] = useState({
    selectedPaymentTermLabel: "",
    selectedPaymentTermType: "",
    selectedPaymentTermYears: "",
    selectedPaymentTermUntilAge: "",
    coverageDurationLabel: "",
    coverageDurationType: "",
    coverageDurationYears: "",
    coverageDurationUntilAge: "",
    coverageStartDate: "",
    policyEndDate: "",
    nextPaymentDate: "",
    savedAt: "",
  });
  const [policyCoverageFieldErrors, setPolicyCoverageFieldErrors] = useState({});
  const [policyCoverageSaving, setPolicyCoverageSaving] = useState(false);
  const [policyCoverageError, setPolicyCoverageError] = useState("");
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

      const proposal = data?.engagement?.proposal || {};
      const generate = proposal?.generateProposal || {};
      const attendance = proposal?.recordProspectAttendance || {};
      const presentation = proposal?.presentProposal || {};
      const applicationSubmissionMeeting = proposal?.applicationSubmissionMeeting || null;
      const applicationStage = data?.engagement?.application || {};
      const appAttendance = applicationStage?.recordProspectAttendance || {};
      const appPremiumPayment = applicationStage?.recordPremiumPaymentTransfer || {};
      const appNeedsSelection = applicationStage?.needsAssessmentProductSelection || {};
      const appSubmission = applicationStage?.recordApplicationSubmission || {};
      const appChosenProduct = applicationStage?.chosenProduct || null;
      const policyStage = data?.engagement?.policy || {};
      const chosen = proposal?.chosenProduct || null;
      setProposalCurrentActivityKey(String(proposal?.currentActivityKey || "Generate Proposal").trim() || "Generate Proposal");
      setProposalGenerateForm({
        chosenProductId: String(generate?.productId || chosen?._id || ""),
        chosenProductName: String(generate?.productName || chosen?.productName || ""),
        chosenProductDescription: String(generate?.productDescription || chosen?.description || ""),
        proposalFileName: String(generate?.proposalFileName || ""),
        proposalFileMimeType: String(generate?.proposalFileMimeType || ""),
        proposalFileDataUrl: String(generate?.proposalFileDataUrl || ""),
        sentToProspectEmail: Boolean(generate?.sentToProspectEmail),
        sentToProspectAt: generate?.sentToProspectAt || "",
        uploadedAt: generate?.uploadedAt || generate?.generatedAt || "",
      });
      setProposalAttendanceForm({
        attendanceChoice: attendance?.attended ? "YES" : "",
        attendanceProofImageDataUrl: String(attendance?.attendanceProofImageDataUrl || ""),
        attendanceProofFileName: String(attendance?.attendanceProofFileName || ""),
        attendedAt: attendance?.attendedAt || "",
      });
      setProposalPresentationForm({
        proposalAccepted: String(presentation?.proposalAccepted || ""),
        initialQuotationNotes: String(presentation?.initialQuotationNotes || ""),
        presentedAt: presentation?.presentedAt || "",
      });
      setApplicationMeetingSaved(applicationSubmissionMeeting);
      setApplicationAttendanceForm({
        attendanceChoice: appAttendance?.attended ? "YES" : "",
        attendanceProofImageDataUrl: String(appAttendance?.attendanceProofImageDataUrl || ""),
        attendanceProofFileName: String(appAttendance?.attendanceProofFileName || ""),
        attendedAt: appAttendance?.attendedAt || "",
      });
      setApplicationAttendanceError("");
      setApplicationPremiumPaymentForm({
        totalAnnualPremiumPhp:
          appPremiumPayment?.totalAnnualPremiumPhp !== null && appPremiumPayment?.totalAnnualPremiumPhp !== undefined
            ? String(appPremiumPayment.totalAnnualPremiumPhp)
            : "",
        totalFrequencyPremiumPhp:
          appPremiumPayment?.totalFrequencyPremiumPhp !== null && appPremiumPayment?.totalFrequencyPremiumPhp !== undefined
            ? String(appPremiumPayment.totalFrequencyPremiumPhp)
            : "",
        methodForInitialPayment: String(appPremiumPayment?.methodForInitialPayment || ""),
        methodForRenewalPayment: String(appPremiumPayment?.methodForRenewalPayment || ""),
        paymentProofImageDataUrl: String(appPremiumPayment?.paymentProofImageDataUrl || ""),
        paymentProofFileName: String(appPremiumPayment?.paymentProofFileName || ""),
        savedAt: appPremiumPayment?.savedAt || "",
      });
      setApplicationPremiumPaymentError("");
      setApplicationPremiumPaymentFieldErrors({});
      setApplicationNeedsPaymentSelection({
        requestedFrequency: String(appNeedsSelection?.requestedFrequency || ""),
      });
      setApplicationChosenProduct({
        id: String(appChosenProduct?._id || applicationStage?.chosenProductId || ""),
        productName: String(appChosenProduct?.productName || ""),
        description: String(appChosenProduct?.description || ""),
      });
      setApplicationSubmissionForm({
        pruOneTransactionId: String(appSubmission?.pruOneTransactionId || ""),
        submissionScreenshotImageDataUrl: String(appSubmission?.submissionScreenshotImageDataUrl || ""),
        submissionScreenshotFileName: String(appSubmission?.submissionScreenshotFileName || ""),
        savedAt: appSubmission?.savedAt || "",
      });
      setApplicationSubmissionFieldErrors({});
      setApplicationSubmissionError("");
      setPolicyCurrentActivityKey(String(policyStage?.currentActivityKey || "Record Policy Application Status").trim() || "Record Policy Application Status");
      setPolicyStatusForm({
        status: String(policyStage?.recordPolicyApplicationStatus?.status || ""),
        issuanceDate: policyStage?.recordPolicyApplicationStatus?.issuanceDate
          ? toDateInputValue(policyStage.recordPolicyApplicationStatus.issuanceDate)
          : "",
        notes: String(policyStage?.recordPolicyApplicationStatus?.notes || ""),
        savedAt: policyStage?.recordPolicyApplicationStatus?.savedAt || "",
      });
      setPolicyStatusFieldErrors({});
      setPolicyStatusError("");
      setPolicyInitialEorForm({
        eorNumber: String(policyStage?.uploadInitialPremiumEor?.eorNumber || ""),
        receiptDate: policyStage?.uploadInitialPremiumEor?.receiptDate ? toDateInputValue(policyStage.uploadInitialPremiumEor.receiptDate) : "",
        eorFileDataUrl: String(policyStage?.uploadInitialPremiumEor?.eorFileDataUrl || ""),
        eorFileName: String(policyStage?.uploadInitialPremiumEor?.eorFileName || ""),
        uploadedAt: policyStage?.uploadInitialPremiumEor?.uploadedAt || "",
      });
      setPolicyInitialEorFieldErrors({});
      setPolicyInitialEorError("");
      setPolicySummaryForm({
        policyNumber: String(policyStage?.uploadPolicySummary?.policyNumber || ""),
        policySummaryFileDataUrl: String(policyStage?.uploadPolicySummary?.policySummaryFileDataUrl || ""),
        policySummaryFileName: String(policyStage?.uploadPolicySummary?.policySummaryFileName || ""),
        uploadedAt: policyStage?.uploadPolicySummary?.uploadedAt || "",
      });
      setPolicySummaryFieldErrors({});
      setPolicySummaryError("");
      setPolicyChosenProduct(policyStage?.chosenProduct || null);
      setPolicyIssuanceAge(Number.isFinite(Number(policyStage?.issuanceAge)) ? Number(policyStage.issuanceAge) : null);
      setPolicyCoverageForm({
        selectedPaymentTermLabel: String(policyStage?.recordCoverageDurationDetails?.selectedPaymentTermLabel || ""),
        selectedPaymentTermType: String(policyStage?.recordCoverageDurationDetails?.selectedPaymentTermType || ""),
        selectedPaymentTermYears:
          policyStage?.recordCoverageDurationDetails?.selectedPaymentTermYears !== null
          && policyStage?.recordCoverageDurationDetails?.selectedPaymentTermYears !== undefined
            ? String(policyStage.recordCoverageDurationDetails.selectedPaymentTermYears)
            : "",
        selectedPaymentTermUntilAge:
          policyStage?.recordCoverageDurationDetails?.selectedPaymentTermUntilAge !== null
          && policyStage?.recordCoverageDurationDetails?.selectedPaymentTermUntilAge !== undefined
            ? String(policyStage.recordCoverageDurationDetails.selectedPaymentTermUntilAge)
            : "",
        coverageDurationLabel: String(policyStage?.recordCoverageDurationDetails?.coverageDurationLabel || ""),
        coverageDurationType: String(policyStage?.recordCoverageDurationDetails?.coverageDurationType || ""),
        coverageDurationYears:
          policyStage?.recordCoverageDurationDetails?.coverageDurationYears !== null
          && policyStage?.recordCoverageDurationDetails?.coverageDurationYears !== undefined
            ? String(policyStage.recordCoverageDurationDetails.coverageDurationYears)
            : "",
        coverageDurationUntilAge:
          policyStage?.recordCoverageDurationDetails?.coverageDurationUntilAge !== null
          && policyStage?.recordCoverageDurationDetails?.coverageDurationUntilAge !== undefined
            ? String(policyStage.recordCoverageDurationDetails.coverageDurationUntilAge)
            : "",
        coverageStartDate: policyStage?.recordCoverageDurationDetails?.coverageStartDate
          ? toDateInputValue(policyStage.recordCoverageDurationDetails.coverageStartDate)
          : "",
        policyEndDate: policyStage?.recordCoverageDurationDetails?.policyEndDate
          ? toDateInputValue(policyStage.recordCoverageDurationDetails.policyEndDate)
          : (policyStage?.recordCoverageDurationDetails?.coverageEndDate
            ? toDateInputValue(policyStage.recordCoverageDurationDetails.coverageEndDate)
            : ""),
        nextPaymentDate: policyStage?.recordCoverageDurationDetails?.nextPaymentDate
          ? toDateInputValue(policyStage.recordCoverageDurationDetails.nextPaymentDate)
          : "",
        savedAt: policyStage?.recordCoverageDurationDetails?.savedAt || "",
      });
      setPolicyCoverageFieldErrors({});
      setPolicyCoverageError("");
      setApplicationMeetingForm({
        meetingDate: applicationSubmissionMeeting?.startAt ? toDateInputValue(applicationSubmissionMeeting.startAt) : "",
        meetingStartTime: applicationSubmissionMeeting?.startAt
          ? `${String(new Date(applicationSubmissionMeeting.startAt).getHours()).padStart(2, "0")}:${String(new Date(applicationSubmissionMeeting.startAt).getMinutes()).padStart(2, "0")}`
          : "",
        meetingDurationMin: applicationSubmissionMeeting?.durationMin ?? 120,
        meetingMode: String(applicationSubmissionMeeting?.mode || ""),
        meetingPlatform: String(applicationSubmissionMeeting?.platform || ""),
        meetingPlatformOther: String(applicationSubmissionMeeting?.platformOther || ""),
        meetingLink: String(applicationSubmissionMeeting?.link || ""),
        meetingInviteSent: Boolean(applicationSubmissionMeeting?.inviteSent),
        meetingPlace: String(applicationSubmissionMeeting?.place || ""),
      });
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
    const currentStage = String(engagement?.currentStage || "");
    const shouldLoad =
      selectedStageView === "Needs Assessment" ||
      (selectedStageView === "CURRENT" && currentStage === "Needs Assessment");
    if (!shouldLoad) return;
    fetchNeedsAssessment();
  }, [selectedStageView, engagement?.currentStage, fetchNeedsAssessment]);

  const showCurrentProgressView = useCallback(() => {
    setSelectedStageView("CURRENT");
    setShowAddAttempt(false);
    setContactingViewedActivityKey("");
    setNeedsAssessmentViewedActivityKey("");
    setProposalViewedActivityKey("");
    setApplicationViewedActivityKey("");
    setPolicyViewedActivityKey("");
  }, []);

  const refreshCurrentProgressView = useCallback(async ({ includeNeedsAssessment = false } = {}) => {
    if (includeNeedsAssessment) {
      await fetchNeedsAssessment();
    }
    await fetchEngagement();
    showCurrentProgressView();
  }, [fetchEngagement, fetchNeedsAssessment, showCurrentProgressView]);

  const submitNeedsAssessmentAttendanceOnly = async () => {
    try {
      setNeedsAssessmentError("");

      if (!isNeedsAssessmentCurrentViewEditable || isNeedsAssessmentLocked) return;
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

      setNeedsAssessmentSaving(true);

      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/needs-assessment/attendance?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attended: true,
          attendanceProofImageDataUrl,
          attendanceProofFileName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to record attendance.");

      await refreshCurrentProgressView({ includeNeedsAssessment: true });
    } catch (err) {
      setNeedsAssessmentError(err?.message || "Failed to record attendance.");
    } finally {
      setNeedsAssessmentSaving(false);
    }
  };

  const onSaveNeedsAssessment = async () => {
    setNeedsAssessmentSavedAt("");
    setNeedsAssessmentError("");

    if (!isNeedsAssessmentCurrentViewEditable) return;

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

    const sex = String(needsAssessmentForm.basicInformation?.sex || "").trim();
    const civilStatus = String(needsAssessmentForm.basicInformation?.civilStatus || "").trim();
    const birthday = String(needsAssessmentForm.basicInformation?.birthday || "").trim();
    const occupationCategory = String(needsAssessmentForm.basicInformation?.occupationCategory || "").trim();
    const occupation = String(needsAssessmentForm.basicInformation?.occupation || "").trim();
    const age = Number(needsAssessmentForm.basicInformation?.age || "");

    if (!["Male", "Female"].includes(sex)) { setNeedsAssessmentError("Sex is required."); return; }
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
    const selectedProduct = (availableProductsByPriority || []).find((prod) => String(prod?._id || "") === selectedProductId);
    if (!selectedProductId || !selectedProduct) { setNeedsAssessmentError("Product Selection: please select a product under the chosen priority."); return; }
    if (!["Monthly", "Quarterly", "Half-yearly", "Yearly"].includes(requestedFrequency)) { setNeedsAssessmentError("Product Selection: requested frequency is invalid."); return; }
    if (requestedPremiumPayment === null) { setNeedsAssessmentError("Product Selection: requested premium payment is required."); return; }

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
      await refreshCurrentProgressView({ includeNeedsAssessment: true });
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

  const PROPOSAL_STEPS_UI = useMemo(
    () => [
      { key: "Generate Proposal", label: "Generate Proposal" },
      { key: "Record Prospect Attendance", label: "Record Prospect Attendance" },
      { key: "Present Proposal", label: "Present Proposal" },
      { key: "Schedule Application Submission", label: "Schedule Application Submission" },
    ],
    []
  );

  const APPLICATION_STEPS_UI = useMemo(
    () => [
      { key: "Record Prospect Attendance", label: "Record Prospect Attendance" },
      { key: "Record Premium Payment Transfer", label: "Record Premium Payment Transfer" },
      { key: "Record Application Submission", label: "Record Application Submission" },
    ],
    []
  );

  const POLICY_ISSUANCE_STEPS_UI = useMemo(
    () => [
      { key: "Record Policy Application Status", label: "Record Policy Application Status" },
      { key: "Upload Initial Premium eOR", label: "Upload Initial Premium eOR" },
      { key: "Upload Policy Summary", label: "Upload Policy Summary" },
      { key: "Record Coverage Duration Details", label: "Record Coverage Duration Details" },
    ],
    []
  );

  const syncViewedStepWithCurrent = useCallback((steps, currentKey, setViewedKey, previousCurrentRef) => {
    const fallbackKey = steps[0]?.key || "";
    const nextCurrentKey = steps.some((step) => step.key === currentKey) ? currentKey : fallbackKey;

    setViewedKey((existing) => {
      const existingIndex = steps.findIndex((step) => step.key === existing);
      const currentIndex = steps.findIndex((step) => step.key === nextCurrentKey);
      const previousCurrentKey = previousCurrentRef.current;

      const shouldSnapToCurrent =
        !existing ||
        existingIndex < 0 ||
        existingIndex > currentIndex ||
        (previousCurrentKey && existing === previousCurrentKey && previousCurrentKey !== nextCurrentKey);

      return shouldSnapToCurrent ? nextCurrentKey : existing;
    });

    previousCurrentRef.current = nextCurrentKey;
  }, []);

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

  const contactingMeetingStartSlots = useMemo(() => {
    const allSlots = buildMeetingStartSlots(meetingForm.meetingDurationMin);
    const selectedDate = String(meetingForm.meetingDate || "").trim();
    if (!selectedDate) return allSlots.filter((slot) => Number(slot.split(":")[0]) < 19 || slot === "19:00");

    const today = toLocalDateInputValue(new Date());
    const maxStartMinutes = 19 * 60;
    const baseSlots = allSlots.filter((slot) => {
      const [hh, mm] = slot.split(":").map(Number);
      return hh * 60 + mm <= maxStartMinutes;
    });

    if (selectedDate !== today) return baseSlots;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nextHalfHour = Math.ceil(nowMinutes / 30) * 30;
    return baseSlots.filter((slot) => {
      const [hh, mm] = slot.split(":").map(Number);
      return hh * 60 + mm >= nextHalfHour;
    });
  }, [buildMeetingStartSlots, meetingForm.meetingDate, meetingForm.meetingDurationMin]);
  const proposalMeetingStartSlots = useMemo(() => buildMeetingStartSlots(proposalMeetingForm.meetingDurationMin), [buildMeetingStartSlots, proposalMeetingForm.meetingDurationMin]);
  const applicationMeetingStartSlots = useMemo(() => buildMeetingStartSlots(applicationMeetingForm.meetingDurationMin), [buildMeetingStartSlots, applicationMeetingForm.meetingDurationMin]);

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

      case "clients_relationship":
        navigate(`/agent/${user.username}/clients/relationship`);
        break;

      case "clients_all_prospects":
        navigate(`/agent/${user.username}/prospects`);
        break;

      case "clients_all_policyholders":
        navigate(`/agent/${user.username}/policyholders`);
        break;

      // TASKS
      case "tasks":
        navigate(`/agent/${user.username}/tasks`);
        break;

      case "tasks_progress":
        navigate(`/agent/${user.username}/tasks/progress`);
        break;

      case "tasks_all":
        navigate(`/agent/${user.username}/tasks/all`);
        break;

      case "sales": navigate(`/agent/${user.username}/sales/performance`); break;
      case "sales_performance": navigate(`/agent/${user.username}/sales/performance`); break;

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
    return list.sort((a, b) => Number(b.attemptNo || 0) - Number(a.attemptNo || 0));
  }, [engagement?.attempts, engagement?.contactAttempts]);
  const lastAttempt = attempts.length ? attempts[0] : null;

  // UI stage: if there are attempts but backend still says Not Started, show Contacting on UI
  const rawStage = engagement?.currentStage || "Not Started";
  const stage = rawStage === "Not Started" && attempts.length > 0 ? "Contacting" : rawStage;
  const isLeadClosed = String(lead?.status || "").trim().toLowerCase() === "closed";
  const isLeadDropped = String(lead?.status || "").trim().toLowerCase() === "dropped";
  const isLeadInProgress = String(lead?.status || "").trim().toLowerCase() === "in progress";

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
  const showProposalPanel = viewStage === "Proposal";
  const showApplicationPanel = viewStage === "Application";
  const showPolicyIssuancePanel = viewStage === "Policy Issuance";
  const viewedStageIndex = viewStage === "Not Started" ? -1 : PIPELINE_STEPS.indexOf(viewStage);
  const isViewingPastStage = viewedStageIndex >= 0 && safeIndex > viewedStageIndex;
  const isViewingFutureStage = viewedStageIndex >= 0 && viewedStageIndex > safeIndex;
  const futureStageSubactivityHelperText =
    "This stage is still ahead in the lead journey. Its subactivities stay gray until the progression reaches them.";

  const isNeedsAssessmentEditableNow =
    showNeedsAssessmentPanel &&
    isViewingCurrentStage &&
    stage === "Needs Assessment" &&
    !isLeadClosed &&
    !isLeadDropped;
  const isProposalEditableNow =
    showProposalPanel &&
    isViewingCurrentStage &&
    stage === "Proposal" &&
    !isLeadClosed &&
    !isLeadDropped;

  // Editable when viewing Contacting while current stage is Contacting,
  // or when current stage is Not Started and user moved into Contacting view
  // to create the very first attempt.
  const isContactingEditableNow =
    showContactingPanel &&
    (stage === "Contacting" || stage === "Not Started") &&
    !isLeadClosed &&
    !isLeadDropped;
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

  const savedPhoneValidationResult = String(lastAttempt?.phoneValidation || "").trim().toUpperCase();
  const savedInterestLevel = String(lastAttempt?.interestLevel || "").trim().toUpperCase();
  const hasSavedContactMeeting =
    Boolean(lastAttempt?.meetingAt) ||
    Boolean(String(lastAttempt?.meetingMode || "").trim()) ||
    Boolean(String(lastAttempt?.meetingPlatform || "").trim()) ||
    Boolean(String(lastAttempt?.meetingPlatformOther || "").trim()) ||
    Boolean(String(lastAttempt?.meetingLink || "").trim()) ||
    Boolean(String(lastAttempt?.meetingPlace || "").trim()) ||
    Boolean(Number(lastAttempt?.meetingDurationMin || 0)) ||
    Boolean(lastAttempt?.meetingEndAt);

  const inferredContactingActivityKey = useMemo(() => {
    if (attempts.length === 0) return "Attempt Contact";
    if (isReApproachMode) return "Attempt Contact";

    const outcomeActivity = String(lastAttempt?.outcomeActivity || "").trim();
    if (CONTACTING_STEPS_UI.some((step) => step.key === outcomeActivity)) {
      return outcomeActivity;
    }

    if (!isLastAttemptResponded) return "Attempt Contact";
    if (!savedPhoneValidationResult) return "Validate Contact";
    if (savedPhoneValidationResult === "WRONG_CONTACT") return "Validate Contact";
    if (!savedInterestLevel) return "Assess Interest";
    if (savedInterestLevel === "INTERESTED" && !hasSavedContactMeeting) return "Schedule Meeting";
    if (savedInterestLevel === "INTERESTED" && hasSavedContactMeeting) return "Schedule Meeting";
    return "Assess Interest";
  }, [
    attempts.length,
    isReApproachMode,
    lastAttempt?.outcomeActivity,
    CONTACTING_STEPS_UI,
    isLastAttemptResponded,
    savedPhoneValidationResult,
    savedInterestLevel,
    hasSavedContactMeeting,
  ]);

  const effectiveActivityKey = useMemo(() => {
    const keys = [currentActivityKeyRaw, inferredContactingActivityKey].filter(Boolean);
    if (!keys.length) return attempts.length > 0 ? "Attempt Contact" : "";

    return keys.reduce((furthest, key) => {
      const furthestIndex = CONTACTING_STEPS_UI.findIndex((step) => step.key === furthest);
      const keyIndex = CONTACTING_STEPS_UI.findIndex((step) => step.key === key);
      return keyIndex > furthestIndex ? key : furthest;
    });
  }, [currentActivityKeyRaw, inferredContactingActivityKey, attempts.length, CONTACTING_STEPS_UI]);

  const normalizedActivityIndex = useMemo(() => {
    if (stage === "Not Started" && attempts.length === 0) return -1; // none active
    if (attempts.length === 0) return 0;

    const idx = CONTACTING_STEPS_UI.findIndex((s) => s.key === effectiveActivityKey);
    return idx >= 0 ? idx : 0;
  }, [stage, attempts.length, CONTACTING_STEPS_UI, effectiveActivityKey]);

  const addAttemptActivityIndex = useMemo(() => {
    if (showAddAttempt) return 0;
    return normalizedActivityIndex;
  }, [showAddAttempt, normalizedActivityIndex]);

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

  const contactingCurrentActivityKey = showAddAttempt ? "Attempt Contact" : (effectiveActivityKey || "Attempt Contact");

  const proposalUiActivityKey = useMemo(() => {
    const fallback = "Generate Proposal";
    const raw = String(proposalCurrentActivityKey || fallback).trim();
    return PROPOSAL_STEPS_UI.some((s) => s.key === raw) ? raw : fallback;
  }, [proposalCurrentActivityKey, PROPOSAL_STEPS_UI]);

  const isProposalPresentationEditable =
    proposalUiActivityKey === "Present Proposal" &&
    isProposalEditableNow &&
    !proposalPresentationForm.presentedAt;

  const applicationUiActivityKey = useMemo(() => {
    const fallback = "Record Prospect Attendance";
    const raw = String(engagement?.application?.currentActivityKey || engagement?.currentActivityKey || fallback).trim();
    return APPLICATION_STEPS_UI.some((s) => s.key === raw) ? raw : fallback;
  }, [engagement?.application?.currentActivityKey, engagement?.currentActivityKey, APPLICATION_STEPS_UI]);

  const policyIssuanceUiActivityKey = useMemo(() => {
    const fallback = "Record Policy Application Status";
    const raw = String(engagement?.policy?.currentActivityKey || policyCurrentActivityKey || engagement?.currentActivityKey || fallback).trim();
    return POLICY_ISSUANCE_STEPS_UI.some((s) => s.key === raw) ? raw : fallback;
  }, [engagement?.policy?.currentActivityKey, policyCurrentActivityKey, engagement?.currentActivityKey, POLICY_ISSUANCE_STEPS_UI]);

  const hasSavedApplicationAttendance = useMemo(() => {
    const attended = applicationAttendanceForm.attendanceChoice === "YES";
    const hasProof = Boolean(String(applicationAttendanceForm.attendanceProofImageDataUrl || "").trim());
    const hasSavedTimestamp = Boolean(String(applicationAttendanceForm.attendedAt || "").trim());
    return attended && hasProof && hasSavedTimestamp;
  }, [applicationAttendanceForm.attendanceChoice, applicationAttendanceForm.attendanceProofImageDataUrl, applicationAttendanceForm.attendedAt]);

  const requestedFrequencyFromNeedsAssessment = String(
    applicationNeedsPaymentSelection?.requestedFrequency ||
      needsAssessmentForm?.needsPriorities?.productSelection?.requestedFrequency ||
      ""
  ).trim();
  const initialPaymentMethodFromApplication = String(
    applicationPremiumPaymentForm.methodForInitialPayment || ""
  ).trim();

  const hasSavedApplicationPremiumPaymentTransfer = useMemo(() => {
    const annualRaw = String(applicationPremiumPaymentForm.totalAnnualPremiumPhp ?? "").trim();
    const frequencyRaw = String(applicationPremiumPaymentForm.totalFrequencyPremiumPhp ?? "").trim();
    const hasAnnual = annualRaw !== "" && toNonNegativeNumber(annualRaw) !== null;
    const hasFrequency = frequencyRaw !== "" && toNonNegativeNumber(frequencyRaw) !== null;
    const hasInitialMethod = ["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"].includes(
      String(applicationPremiumPaymentForm.methodForInitialPayment || "").trim()
    );
    const hasRenewalMethod = ["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"].includes(
      String(applicationPremiumPaymentForm.methodForRenewalPayment || "").trim()
    );
    const hasProof = Boolean(String(applicationPremiumPaymentForm.paymentProofImageDataUrl || "").trim());
    const hasSavedTimestamp = Boolean(String(applicationPremiumPaymentForm.savedAt || "").trim());
    return hasAnnual && hasFrequency && hasInitialMethod && hasRenewalMethod && hasProof && hasSavedTimestamp;
  }, [
    applicationPremiumPaymentForm.totalAnnualPremiumPhp,
    applicationPremiumPaymentForm.totalFrequencyPremiumPhp,
    applicationPremiumPaymentForm.methodForInitialPayment,
    applicationPremiumPaymentForm.methodForRenewalPayment,
    applicationPremiumPaymentForm.paymentProofImageDataUrl,
    applicationPremiumPaymentForm.savedAt,
    toNonNegativeNumber,
  ]);

  const hasSavedApplicationSubmission = useMemo(() => {
    const hasTxId = Boolean(String(applicationSubmissionForm.pruOneTransactionId || "").trim());
    const hasScreenshot = Boolean(String(applicationSubmissionForm.submissionScreenshotImageDataUrl || "").trim());
    const hasSavedTimestamp = Boolean(String(applicationSubmissionForm.savedAt || "").trim());
    return hasTxId && hasScreenshot && hasSavedTimestamp;
  }, [applicationSubmissionForm.pruOneTransactionId, applicationSubmissionForm.submissionScreenshotImageDataUrl, applicationSubmissionForm.savedAt]);

  const totalFrequencyPremiumLabel = useMemo(() => {
    const freq = String(requestedFrequencyFromNeedsAssessment || "").trim();
    if (!freq) return "Total Requested Frequency Premium (in Php)";
    if (freq.toLowerCase() === "monthly") return "Total Monthly Premium (in Php)";
    return `Total ${freq} Premium (in Php)`;
  }, [requestedFrequencyFromNeedsAssessment]);

  const shouldShowFrequencyPremiumField = useMemo(() => {
    return String(requestedFrequencyFromNeedsAssessment || "").trim().toLowerCase() !== "yearly";
  }, [requestedFrequencyFromNeedsAssessment]);

  const computedFrequencyPremiumValue = useMemo(() => {
    const annualRaw = String(applicationPremiumPaymentForm.totalAnnualPremiumPhp ?? "").trim();
    const annual = toNonNegativeNumber(annualRaw);
    if (annual === null) return "";

    const freq = String(requestedFrequencyFromNeedsAssessment || "").trim().toLowerCase();
    const divisor = freq === "monthly" ? 12 : freq === "quarterly" ? 4 : freq === "half-yearly" ? 2 : 1;
    const computed = annual / divisor;
    return Number.isFinite(computed) ? String(Math.round(computed * 100) / 100) : "";
  }, [applicationPremiumPaymentForm.totalAnnualPremiumPhp, requestedFrequencyFromNeedsAssessment, toNonNegativeNumber]);

  const needsActivityKeyRaw = useMemo(() => {
    const stageNow = String(engagement?.currentStage || "").trim();
    if (["Proposal", "Application", "Policy Issuance"].includes(stageNow)) {
      return "Schedule Proposal Presentation";
    }

    const steps = ["Record Prospect Attendance", "Perform Needs Analysis", "Schedule Proposal Presentation"];
    const current = String(needsAssessmentCurrentActivityKey || "").trim();
    if (steps.includes(current)) return current;

    const outcome = String(needsAssessmentOutcomeActivity || "").trim();
    if (outcome === "Schedule Proposal Presentation") return "Schedule Proposal Presentation";
    if (outcome === "Perform Needs Analysis") return "Schedule Proposal Presentation";
    if (outcome === "Record Prospect Attendance") return "Perform Needs Analysis";
    return "Record Prospect Attendance";
  }, [needsAssessmentCurrentActivityKey, needsAssessmentOutcomeActivity, engagement?.currentStage]);
  const showProposalSchedulingSection = needsActivityKeyRaw === "Schedule Proposal Presentation";
  const isNeedsAssessmentLocked = showProposalSchedulingSection;

  const shouldRefreshMeetingAvailability =
    showAddAttempt ||
    (showNeedsAssessmentPanel && showProposalSchedulingSection && !proposalMeetingSaved) ||
    (showProposalPanel && proposalUiActivityKey === "Schedule Application Submission" && !applicationMeetingSaved);

  useEffect(() => {
    if (!shouldRefreshMeetingAvailability) return;
    fetchMeetingAvailability();
  }, [shouldRefreshMeetingAvailability, fetchMeetingAvailability]);
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
    const selectedProduct = (availableProductsByPriority || []).find((prod) => String(prod?._id || "") === selectedProductId);
    if (!selectedProductId || !selectedProduct) return false;
    if (!["Monthly", "Quarterly", "Half-yearly", "Yearly"].includes(requestedFrequency)) return false;
    if (requestedPremiumPayment === null) return false;
    if (!/^data:image\/(?:jpeg|png);base64,/i.test(attendanceProofImageDataUrl)) return false;

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

  const previousContactingCurrentActivityRef = useRef("");
  const previousNeedsCurrentActivityRef = useRef("");
  const previousProposalCurrentActivityRef = useRef("");
  const previousApplicationCurrentActivityRef = useRef("");
  const previousPolicyCurrentActivityRef = useRef("");

  useEffect(() => {
    syncViewedStepWithCurrent(
      CONTACTING_STEPS_UI,
      contactingCurrentActivityKey,
      setContactingViewedActivityKey,
      previousContactingCurrentActivityRef
    );
  }, [CONTACTING_STEPS_UI, contactingCurrentActivityKey, syncViewedStepWithCurrent]);

  useEffect(() => {
    syncViewedStepWithCurrent(
      NEEDS_ASSESSMENT_STEPS_UI,
      needsActivityKeyRaw,
      setNeedsAssessmentViewedActivityKey,
      previousNeedsCurrentActivityRef
    );
  }, [NEEDS_ASSESSMENT_STEPS_UI, needsActivityKeyRaw, syncViewedStepWithCurrent]);

  useEffect(() => {
    syncViewedStepWithCurrent(
      PROPOSAL_STEPS_UI,
      proposalUiActivityKey,
      setProposalViewedActivityKey,
      previousProposalCurrentActivityRef
    );
  }, [PROPOSAL_STEPS_UI, proposalUiActivityKey, syncViewedStepWithCurrent]);

  useEffect(() => {
    syncViewedStepWithCurrent(
      APPLICATION_STEPS_UI,
      applicationUiActivityKey,
      setApplicationViewedActivityKey,
      previousApplicationCurrentActivityRef
    );
  }, [APPLICATION_STEPS_UI, applicationUiActivityKey, syncViewedStepWithCurrent]);

  useEffect(() => {
    syncViewedStepWithCurrent(
      POLICY_ISSUANCE_STEPS_UI,
      policyIssuanceUiActivityKey,
      setPolicyViewedActivityKey,
      previousPolicyCurrentActivityRef
    );
  }, [POLICY_ISSUANCE_STEPS_UI, policyIssuanceUiActivityKey, syncViewedStepWithCurrent]);

  const getStepIndex = useCallback(
    (steps, key) => {
      const idx = steps.findIndex((step) => step.key === key);
      return idx >= 0 ? idx : 0;
    },
    []
  );

  const selectReachableViewedStep = useCallback(
    (steps, stepKey, currentIndex, setViewedKey) => {
      const nextIndex = steps.findIndex((step) => step.key === stepKey);
      if (nextIndex < 0 || nextIndex > currentIndex) return;
      setViewedKey(stepKey);
    },
    []
  );

  const contactingCurrentStepIndex = getStepIndex(CONTACTING_STEPS_UI, contactingCurrentActivityKey);
  const contactingViewedStepIndex = getStepIndex(CONTACTING_STEPS_UI, contactingViewedActivityKey || contactingCurrentActivityKey);
  const needsCurrentStepIndex = getStepIndex(NEEDS_ASSESSMENT_STEPS_UI, needsActivityKeyRaw);
  const needsViewedStepIndex = getStepIndex(NEEDS_ASSESSMENT_STEPS_UI, needsAssessmentViewedActivityKey || needsActivityKeyRaw);
  const proposalCurrentStepIndex = getStepIndex(PROPOSAL_STEPS_UI, proposalUiActivityKey);
  const proposalViewedStepIndex = getStepIndex(PROPOSAL_STEPS_UI, proposalViewedActivityKey || proposalUiActivityKey);
  const applicationCurrentStepIndex = getStepIndex(APPLICATION_STEPS_UI, applicationUiActivityKey);
  const applicationViewedStepIndex = getStepIndex(APPLICATION_STEPS_UI, applicationViewedActivityKey || applicationUiActivityKey);
  const policyCurrentStepIndex = getStepIndex(POLICY_ISSUANCE_STEPS_UI, policyIssuanceUiActivityKey);
  const policyViewedStepIndex = getStepIndex(POLICY_ISSUANCE_STEPS_UI, policyViewedActivityKey || policyIssuanceUiActivityKey);

  const isAttemptContactViewed = contactingViewedActivityKey === "Attempt Contact";
  const isValidateContactViewed = contactingViewedActivityKey === "Validate Contact";
  const isAssessInterestViewed = contactingViewedActivityKey === "Assess Interest";
  const isScheduleMeetingViewed = contactingViewedActivityKey === "Schedule Meeting";
  const isContactingCurrentViewEditable =
    isViewingCurrentStage && !isContactingReadOnly && contactingViewedActivityKey === contactingCurrentActivityKey;
  const isValidateContactEditable =
    isContactingCurrentViewEditable && contactingCurrentActivityKey === "Validate Contact" && !isEngagementBlocked;
  const isAssessInterestEditable =
    isContactingCurrentViewEditable && contactingCurrentActivityKey === "Assess Interest" && !savedInterestLevel;
  const isScheduleMeetingEditable =
    (isContactingCurrentViewEditable && contactingCurrentActivityKey === "Schedule Meeting") || rescheduleFromNeedsMode;

  const isNeedsAssessmentCurrentViewEditable =
    isNeedsAssessmentEditableNow && needsAssessmentViewedActivityKey === needsActivityKeyRaw;
  const isNeedsScheduleEditable =
    isNeedsAssessmentCurrentViewEditable &&
    needsActivityKeyRaw === "Schedule Proposal Presentation" &&
    needsAssessmentViewedActivityKey === "Schedule Proposal Presentation";
  const isNeedsAnalysisViewed = needsAssessmentViewedActivityKey === "Perform Needs Analysis";
  const isNeedsScheduleViewed = needsAssessmentViewedActivityKey === "Schedule Proposal Presentation";

  const isProposalGenerateViewed = proposalViewedActivityKey === "Generate Proposal";
  const isProposalAttendanceViewed = proposalViewedActivityKey === "Record Prospect Attendance";
  const isProposalPresentationViewed = proposalViewedActivityKey === "Present Proposal";
  const isProposalScheduleApplicationViewed = proposalViewedActivityKey === "Schedule Application Submission";
  const isApplicationAttendanceViewed = applicationViewedActivityKey === "Record Prospect Attendance";
  const isApplicationPremiumViewed = applicationViewedActivityKey === "Record Premium Payment Transfer";
  const isApplicationSubmissionViewed = applicationViewedActivityKey === "Record Application Submission";
  const isPolicyStatusViewed = policyViewedActivityKey === "Record Policy Application Status";
  const isPolicyInitialEorViewed = policyViewedActivityKey === "Upload Initial Premium eOR";
  const isPolicySummaryViewed = policyViewedActivityKey === "Upload Policy Summary";
  const isPolicyCoverageViewed = policyViewedActivityKey === "Record Coverage Duration Details";

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
    if (errorText === "Sex is required.") return "sex";
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

  const stageActivityBadge =
    showContactingPanel
      ? isViewingCurrentStage
        ? currentActivityLabel
        : previousContactingActivity
      : showNeedsAssessmentPanel
      ? needsUiActivityKey
      : showProposalPanel
      ? proposalUiActivityKey
      : showApplicationPanel
      ? applicationUiActivityKey
      : showPolicyIssuancePanel
      ? policyIssuanceUiActivityKey
      : "";

  const showCurrentSubactivityStatus = isViewingCurrentStage && !isLeadClosed && !isLeadDropped;
  const closedLeadSubactivityHelperText = "";

  const setStageViewIfAllowed = useCallback(
    (nextStage) => {
      if (isLeadDropped || isLeadInProgress) {
        const nextIndex = PIPELINE_STEPS.indexOf(nextStage);
        if (nextIndex > safeIndex) return;
      }
      setSelectedStageView(nextStage);
    },
    [isLeadDropped, isLeadInProgress, PIPELINE_STEPS, safeIndex]
  );

  useEffect(() => {
    if (!isLeadDropped && !isLeadInProgress) return;
    if (selectedStageView === "CURRENT") return;
    const selectedIndex = PIPELINE_STEPS.indexOf(selectedStageView);
    if (selectedIndex > safeIndex) {
      setSelectedStageView("CURRENT");
    }
  }, [isLeadDropped, isLeadInProgress, selectedStageView, PIPELINE_STEPS, safeIndex]);

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

  const validateAttempt = ({ requireResponse = true } = {}) => {
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

    if (requireResponse) {
      if (!response) e.response = "Response is required.";
      if (response && !RESPONSES.includes(response)) e.response = "Invalid response.";
    }

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
    setEditingAttemptId("");
    setShowAddAttempt(true);
    resetAttemptForm();
  };

  const onOpenEditAttempt = (attempt) => {
    if (isContactingReadOnly) return;
    if (isLeadClosed || isLeadDropped) return;
    const attemptId = String(attempt?.attemptId || "").trim();
    if (!attemptId) return;

    setEditingAttemptId(attemptId);
    setAttemptErrors({});
    setShowAddAttempt(true);
    setAttemptForm({
      primaryChannel: String(attempt?.primaryChannel || "").trim(),
      otherChannels: Array.isArray(attempt?.otherChannels) ? attempt.otherChannels : [],
      response: String(attempt?.response || "").trim(),
      attemptedAtLabel: attempt?.attemptedAt ? formatDateTime(attempt.attemptedAt) : "",
      notes: String(attempt?.notes || ""),
    });
  };

  const onCancelAddAttempt = () => {
    setEditingAttemptId("");
    setShowAddAttempt(false);
    resetAttemptForm();
  };

  const mapAttemptServerErrorToFields = (message) => {
    const msg = String(message || "").trim();
    if (!msg) return {};
    if (/primarychannel/i.test(msg)) return { primaryChannel: msg };
    if (/otherchannels/i.test(msg)) return { otherChannels: msg };
    if (/response/i.test(msg)) return { response: msg };
    return { _global: msg };
  };

  const onSubmitAttempt = async () => {
    const isEditingAttempt = Boolean(editingAttemptId);
    const errs = validateAttempt({ requireResponse: true });

    setAttemptErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      setAddingAttempt(true);

      const endpoint = isEditingAttempt
        ? `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/contact-attempts/${editingAttemptId}?userId=${user.id}`
        : `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/contact-attempts?userId=${user.id}`;
      const method = isEditingAttempt ? "PATCH" : "POST";
      const payload = isEditingAttempt
        ? {
            primaryChannel: attemptForm.primaryChannel,
            otherChannels: attemptForm.otherChannels,
            response: String(attemptForm.response || "").trim(),
            notes: String(attemptForm.notes || "").trim(),
          }
        : {
            primaryChannel: attemptForm.primaryChannel,
            otherChannels: attemptForm.otherChannels,
            response: String(attemptForm.response || "").trim(),
            notes: String(attemptForm.notes || "").trim(),
          };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Failed to ${isEditingAttempt ? "update" : "add"} contact attempt.`);

      await refreshCurrentProgressView();
      setEditingAttemptId("");
      setShowAddAttempt(false);
      resetAttemptForm();
    } catch (err) {
      const mapped = mapAttemptServerErrorToFields(err?.message || "Cannot connect to server. Is backend running?");
      setAttemptErrors((er) => ({ ...er, ...mapped }));
    } finally {
      setAddingAttempt(false);
    }
  };

  const submitValidateContact = async (overrideResult = "") => {
    try {
      setValidateError("");
      setValidateFieldErrors({});
      const result = String(overrideResult || validateForm.phoneValidation || "").trim().toUpperCase();
      if (!result) {
        setValidateFieldErrors({ phoneValidation: "Please select a validation result." });
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

      await refreshCurrentProgressView();

      setValidateForm({ phoneValidation: "" });
    } catch (err) {
      setValidateError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setValidatingContact(false);
    }
  };

  const saveAssessInterest = async (interestLevel) => {
    try {
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

      await refreshCurrentProgressView();
      if (data?.leadDropped && data?.droppedLead) {
        setDropOutcomeModal({
          title: "Lead Dropped",
          message: "The lead was automatically dropped because the prospect was not interested.",
          leadCode: String(data.droppedLead.leadCode || lead?.leadCode || "").trim(),
          dropReason: String(data.droppedLead.dropReason || "").trim(),
          dropNotes: String(data.droppedLead.dropNotes || "").trim(),
          droppedAt: data.droppedLead.droppedAt || null,
        });
      }
    } catch (err) {
      setInterestError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setSavingInterest(false);
    }
  };

  const submitAssessInterest = async () => {
    setInterestError("");
    setInterestFieldErrors({});

    const interestLevel = String(interestForm.interestLevel || "").trim().toUpperCase();
    if (!["INTERESTED", "NOT_INTERESTED"].includes(interestLevel)) {
      setInterestFieldErrors({ interestLevel: "Please select a valid interest level." });
      return;
    }

    if (interestLevel === "INTERESTED") {
      const pc = String(interestForm.preferredChannel || "").trim();
      if (!["SMS", "WhatsApp", "Viber", "Telegram", "Other"].includes(pc)) {
        setInterestFieldErrors({ preferredChannel: "Please select a preferred communication channel." });
        return;
      }
      if (pc === "Other" && !String(interestForm.preferredChannelOther || "").trim()) {
        setInterestFieldErrors({ preferredChannelOther: "Please specify the other communication channel." });
        return;
      }
    }

    if (interestLevel === "NOT_INTERESTED") {
      setConfirmNotInterestedModalOpen(true);
      return;
    }

    await saveAssessInterest(interestLevel);
  };

  const confirmNotInterestedAndDrop = async () => {
    setConfirmNotInterestedModalOpen(false);
    await saveAssessInterest("NOT_INTERESTED");
  };

  const requestMarkAsNotInterested = () => {
    setInterestError("");
    setConfirmNotInterestedModalOpen(true);
  };

  const startRescheduleFromNeeds = () => {
    setMeetingError("");
    setMeetingFieldErrors({});
    setSelectedStageView("Contacting");
    setContactingViewedActivityKey("Schedule Meeting");
    setRescheduleFromNeedsMode(true);
  };

  const submitScheduleMeeting = async () => {
    try {
      setMeetingError("");
      setMeetingFieldErrors({});

      const meetingDate = String(meetingForm.meetingDate || "").trim();
      const meetingStartTime = String(meetingForm.meetingStartTime || "").trim();
      const meetingDurationMin = Number(meetingForm.meetingDurationMin || 120);
      const meetingMode = String(meetingForm.meetingMode || "").trim();

      if (!meetingDate) {
        setMeetingFieldErrors({ meetingDate: "Meeting date is required." });
        return;
      }
      if (!meetingStartTime) {
        setMeetingFieldErrors({ meetingStartTime: "Meeting start time is required." });
        return;
      }
      if (![30, 60, 90, 120].includes(meetingDurationMin)) {
        setMeetingFieldErrors({ meetingDurationMin: "Meeting duration must be 30, 60, 90, or 120 minutes." });
        return;
      }
      if (isSlotBooked(meetingDate, meetingStartTime, meetingDurationMin)) {
        setMeetingFieldErrors({ meetingStartTime: "Selected time is already booked." });
        return;
      }

      if (!["Online", "Face-to-face"].includes(meetingMode)) {
        setMeetingFieldErrors({ meetingMode: "Please select meeting mode." });
        return;
      }

      if (meetingMode === "Online") {
        const platform = String(meetingForm.meetingPlatform || "").trim();
        if (!["Zoom", "Google Meet", "Other"].includes(platform)) {
          setMeetingFieldErrors({ meetingPlatform: "Please select online platform." });
          return;
        }
        if (platform === "Other" && !String(meetingForm.meetingPlatformOther || "").trim()) {
          setMeetingFieldErrors({ meetingPlatformOther: "Please specify other platform." });
          return;
        }
        const link = String(meetingForm.meetingLink || "").trim();
        if (!link) {
          setMeetingFieldErrors({ meetingLink: "Meeting link is required for online meetings." });
          return;
        }
        if (!isValidHttpUrl(link)) {
          setMeetingFieldErrors({ meetingLink: "Meeting link must be a valid http/https URL." });
          return;
        }
        if (meetingForm.meetingInviteSent !== true) {
          setMeetingFieldErrors({ meetingInviteSent: "Meeting invite must be sent before saving." });
          return;
        }
      }

      if (meetingMode === "Face-to-face" && !String(meetingForm.meetingPlace || "").trim()) {
        setMeetingFieldErrors({ meetingPlace: "Meeting place is required for face-to-face meetings." });
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
            rescheduleFromNeeds: Boolean(rescheduleFromNeedsMode),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to schedule meeting.");

      await refreshCurrentProgressView();
      if (rescheduleFromNeedsMode) {
        setRescheduleFromNeedsMode(false);
        setSelectedStageView("CURRENT");
      }
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

      await refreshCurrentProgressView({ includeNeedsAssessment: true });
    } catch (err) {
      setProposalMeetingError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setSavingProposalMeeting(false);
    }
  };

  const onProposalPdfPicked = (file) => {
    if (!file) return;
    const looksPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (!looksPdf) {
      setProposalGenerateFieldErrors((prev) => ({ ...prev, proposalFile: "Only PDF files are allowed." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setProposalGenerateForm((f) => ({
        ...f,
        proposalFileName: file.name,
        proposalFileMimeType: file.type || "application/pdf",
        proposalFileDataUrl: dataUrl,
      }));
      setProposalGenerateFieldErrors((prev) => ({ ...prev, proposalFile: "" }));
    };
    reader.onerror = () => {
      setProposalGenerateFieldErrors((prev) => ({ ...prev, proposalFile: "Failed to read PDF file." }));
    };
    reader.readAsDataURL(file);
  };

  const submitGenerateProposal = async () => {
    try {
      setProposalGenerateError("");
      setProposalGenerateFieldErrors({});

      const fileName = String(proposalGenerateForm.proposalFileName || "").trim();
      const fileDataUrl = String(proposalGenerateForm.proposalFileDataUrl || "").trim();
      const fileMimeType = String(proposalGenerateForm.proposalFileMimeType || "").trim();

      if (!fileName || !fileDataUrl) {
        setProposalGenerateFieldErrors({ proposalFile: "Proposal PDF is required." });
        return;
      }

      const validPdf = /\.pdf$/i.test(fileName) && (fileMimeType === "application/pdf" || /^data:application\/pdf;base64,/i.test(fileDataUrl));
      if (!validPdf) {
        setProposalGenerateFieldErrors({ proposalFile: "Proposal file must be a PDF." });
        return;
      }

      if (proposalGenerateForm.sentToProspectEmail !== true) {
        setProposalGenerateFieldErrors({ sentToProspectEmail: `Please confirm this was sent to prospect via email (${prospect?.email || "no email"}).` });
        return;
      }

      setProposalGenerateSaving(true);

      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/proposal/generate?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chosenProductId: proposalGenerateForm.chosenProductId || undefined,
          proposalFileName: fileName,
          proposalFileMimeType: fileMimeType || "application/pdf",
          proposalFileDataUrl: fileDataUrl,
          sentToProspectEmail: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save generated proposal.");

      await refreshCurrentProgressView();
    } catch (err) {
      setProposalGenerateError(err?.message || "Failed to save generated proposal.");
    } finally {
      setProposalGenerateSaving(false);
    }
  };

  const onProposalAttendanceProofPicked = (file) => {
    if (!file) return;
    const looksImage = /^image\/(jpeg|png)$/i.test(String(file.type || "")) || /\.(jpe?g|png)$/i.test(String(file.name || ""));
    if (!looksImage) {
      setProposalAttendanceError("Proof of attendance must be a JPG, JPEG, or PNG image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProposalAttendanceError("");
      setProposalAttendanceForm((f) => ({
        ...f,
        attendanceProofImageDataUrl: String(reader.result || ""),
        attendanceProofFileName: String(file.name || ""),
      }));
    };
    reader.onerror = () => {
      setProposalAttendanceError("Failed to read attendance proof image.");
    };
    reader.readAsDataURL(file);
  };

  const onApplicationAttendanceProofPicked = (file) => {
    if (!file) {
      setApplicationAttendanceForm((f) => ({ ...f, attendanceProofImageDataUrl: "", attendanceProofFileName: "" }));
      return;
    }

    const looksImage = /^image\/(jpeg|png)$/i.test(String(file.type || "")) || /\.(jpe?g|png)$/i.test(String(file.name || ""));
    if (!looksImage) {
      setApplicationAttendanceError("Proof of attendance must be a JPG, JPEG, or PNG image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setApplicationAttendanceError("");
      setApplicationAttendanceForm((f) => ({
        ...f,
        attendanceProofImageDataUrl: String(reader.result || ""),
        attendanceProofFileName: String(file.name || ""),
      }));
    };
    reader.onerror = () => {
      setApplicationAttendanceError("Failed to read attendance proof image.");
    };
    reader.readAsDataURL(file);
  };

  const onApplicationPaymentProofPicked = (file) => {
    if (!file) {
      setApplicationPremiumPaymentForm((f) => ({ ...f, paymentProofImageDataUrl: "", paymentProofFileName: "" }));
      return;
    }

    const looksImage = /^image\/(jpeg|png)$/i.test(String(file.type || "")) || /\.(jpe?g|png)$/i.test(String(file.name || ""));
    if (!looksImage) {
      setApplicationPremiumPaymentError("");
      setApplicationPremiumPaymentFieldErrors((prev) => ({ ...prev, paymentProofImageDataUrl: "Proof of payment must be a JPG, JPEG, or PNG image." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setApplicationPremiumPaymentError("");
      setApplicationPremiumPaymentFieldErrors((prev) => ({ ...prev, paymentProofImageDataUrl: "" }));
      setApplicationPremiumPaymentForm((f) => ({
        ...f,
        paymentProofImageDataUrl: String(reader.result || ""),
        paymentProofFileName: String(file.name || ""),
      }));
    };
    reader.onerror = () => {
      setApplicationPremiumPaymentError("");
      setApplicationPremiumPaymentFieldErrors((prev) => ({ ...prev, paymentProofImageDataUrl: "Failed to read proof of payment image." }));
    };
    reader.readAsDataURL(file);
  };

  const onApplicationSubmissionScreenshotPicked = (file) => {
    if (!file) {
      setApplicationSubmissionForm((f) => ({ ...f, submissionScreenshotImageDataUrl: "", submissionScreenshotFileName: "" }));
      return;
    }

    const looksImage = /^image\/(jpeg|png)$/i.test(String(file.type || "")) || /\.(jpe?g|png)$/i.test(String(file.name || ""));
    if (!looksImage) {
      setApplicationSubmissionFieldErrors((prev) => ({ ...prev, submissionScreenshotImageDataUrl: "Submission screenshot must be a JPG, JPEG, or PNG image." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setApplicationSubmissionFieldErrors((prev) => ({ ...prev, submissionScreenshotImageDataUrl: "" }));
      setApplicationSubmissionForm((f) => ({
        ...f,
        submissionScreenshotImageDataUrl: String(reader.result || ""),
        submissionScreenshotFileName: String(file.name || ""),
      }));
    };
    reader.onerror = () => {
      setApplicationSubmissionFieldErrors((prev) => ({ ...prev, submissionScreenshotImageDataUrl: "Failed to read submission screenshot image." }));
    };
    reader.readAsDataURL(file);
  };

  const submitProposalAttendance = async () => {
    try {
      setProposalAttendanceError("");
      if (proposalAttendanceForm.attendanceChoice !== "YES") {
        setProposalAttendanceError("Prospect attendance must be marked YES before saving.");
        return;
      }

      const proofDataUrl = String(proposalAttendanceForm.attendanceProofImageDataUrl || "").trim();
      const proofFileName = String(proposalAttendanceForm.attendanceProofFileName || "").trim();
      if (!proofDataUrl) {
        setProposalAttendanceError("Please upload a proof of attendance image before proceeding.");
        return;
      }
      if (!/^data:image\/(?:jpeg|png);base64,/i.test(proofDataUrl)) {
        setProposalAttendanceError("Proof of attendance must be a JPG, JPEG, or PNG image.");
        return;
      }

      setProposalAttendanceSaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/proposal/attendance?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attended: true,
          attendanceProofImageDataUrl: proofDataUrl,
          attendanceProofFileName: proofFileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save proposal attendance.");
      await refreshCurrentProgressView();
    } catch (err) {
      setProposalAttendanceError(err?.message || "Failed to save proposal attendance.");
    } finally {
      setProposalAttendanceSaving(false);
    }
  };

  const submitProposalPresentation = async () => {
    try {
      setProposalPresentationError("");
      const accepted = String(proposalPresentationForm.proposalAccepted || "").trim().toUpperCase();
      if (!["YES", "NO"].includes(accepted)) {
        setProposalPresentationError("Please select if proposal is accepted (Yes/No).");
        return;
      }

      setProposalPresentationSaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/proposal/presentation?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalAccepted: accepted,
          initialQuotationNotes: accepted === "YES" ? proposalPresentationForm.initialQuotationNotes : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save proposal presentation details.");
      await refreshCurrentProgressView();
    } catch (err) {
      setProposalPresentationError(err?.message || "Failed to save proposal presentation details.");
    } finally {
      setProposalPresentationSaving(false);
    }
  };

  const submitApplicationAttendance = async () => {
    try {
      setApplicationAttendanceError("");
      if (applicationAttendanceForm.attendanceChoice !== "YES") {
        setApplicationAttendanceError("Prospect attendance is required before proceeding to application submission.");
        return;
      }

      const proofDataUrl = String(applicationAttendanceForm.attendanceProofImageDataUrl || "").trim();
      const proofFileName = String(applicationAttendanceForm.attendanceProofFileName || "").trim();
      if (!proofDataUrl) {
        setApplicationAttendanceError("Please upload a proof of attendance image before proceeding.");
        return;
      }

      setApplicationAttendanceSaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/application/attendance?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attended: true,
          attendanceProofImageDataUrl: proofDataUrl,
          attendanceProofFileName: proofFileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save application attendance.");
      await refreshCurrentProgressView();
    } catch (err) {
      setApplicationAttendanceError(err?.message || "Failed to save application attendance.");
    } finally {
      setApplicationAttendanceSaving(false);
    }
  };

  const submitApplicationPremiumPaymentTransfer = async () => {
    try {
      setApplicationPremiumPaymentError("");
      setApplicationPremiumPaymentFieldErrors({});

      const totalAnnualPremiumRaw = String(applicationPremiumPaymentForm.totalAnnualPremiumPhp ?? "").trim();
      const totalFrequencyPremiumRaw = String(computedFrequencyPremiumValue || applicationPremiumPaymentForm.totalFrequencyPremiumPhp || "").trim();
      const totalAnnualPremiumPhp = toNonNegativeNumber(totalAnnualPremiumRaw);
      const totalFrequencyPremiumPhp = toNonNegativeNumber(totalFrequencyPremiumRaw);
      const methodForInitialPayment = String(applicationPremiumPaymentForm.methodForInitialPayment || "").trim();
      const methodForRenewalPayment = String(applicationPremiumPaymentForm.methodForRenewalPayment || "").trim();
      const paymentProofImageDataUrl = String(applicationPremiumPaymentForm.paymentProofImageDataUrl || "").trim();
      const paymentProofFileName = String(applicationPremiumPaymentForm.paymentProofFileName || "").trim();

      const allowedPaymentMethods = ["Credit Card / Debit Card", "Mobile Wallet / GCash", "Dated Check", "Bills Payments"];

      if (!totalAnnualPremiumRaw || totalAnnualPremiumPhp === null) {
        setApplicationPremiumPaymentFieldErrors({ totalAnnualPremiumPhp: "Total Annual Premium (in Php) is required." });
        return;
      }
      if (!totalFrequencyPremiumRaw || totalFrequencyPremiumPhp === null) {
        setApplicationPremiumPaymentFieldErrors({ totalFrequencyPremiumPhp: `${totalFrequencyPremiumLabel} is required.` });
        return;
      }
      if (!allowedPaymentMethods.includes(methodForInitialPayment)) {
        setApplicationPremiumPaymentFieldErrors({ methodForInitialPayment: "Method for initial payment is required." });
        return;
      }
      if (!allowedPaymentMethods.includes(methodForRenewalPayment)) {
        setApplicationPremiumPaymentFieldErrors({ methodForRenewalPayment: "Method for renewal payment is required." });
        return;
      }
      if (!paymentProofImageDataUrl) {
        setApplicationPremiumPaymentFieldErrors({ paymentProofImageDataUrl: `Proof of Payment via ${methodForInitialPayment || "Initial Payment Method"} (JPG, JPEG, PNG) is required.` });
        return;
      }

      setApplicationPremiumPaymentSaving(true);

      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/application/premium-payment-transfer?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAnnualPremiumPhp,
          totalFrequencyPremiumPhp,
          methodForInitialPayment,
          methodForRenewalPayment,
          paymentProofImageDataUrl,
          paymentProofFileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save premium payment transfer.");

      await refreshCurrentProgressView();
    } catch (err) {
      const msg = String(err?.message || "Failed to save premium payment transfer.");
      if (msg.includes("Total annual premium")) {
        setApplicationPremiumPaymentFieldErrors({ totalAnnualPremiumPhp: "Total Annual Premium (in Php) is required." });
      } else if (msg.includes("Total requested-frequency premium")) {
        setApplicationPremiumPaymentFieldErrors({ totalFrequencyPremiumPhp: `${totalFrequencyPremiumLabel} is required.` });
      } else if (msg.includes("Method for initial payment")) {
        setApplicationPremiumPaymentFieldErrors({ methodForInitialPayment: "Method for initial payment is required." });
      } else if (msg.includes("Method for renewal payment")) {
        setApplicationPremiumPaymentFieldErrors({ methodForRenewalPayment: "Method for renewal payment is required." });
      } else if (msg.includes("Proof of payment")) {
        setApplicationPremiumPaymentFieldErrors({
          paymentProofImageDataUrl: `Proof of Payment via ${String(applicationPremiumPaymentForm.methodForInitialPayment || "").trim() || "Initial Payment Method"} (JPG, JPEG, PNG) is required.`,
        });
      } else {
        setApplicationPremiumPaymentError(msg);
      }
    } finally {
      setApplicationPremiumPaymentSaving(false);
    }
  };

  const submitApplicationSubmission = async () => {
    try {
      setApplicationSubmissionError("");
      setApplicationSubmissionFieldErrors({});

      const txId = String(applicationSubmissionForm.pruOneTransactionId || "").trim();
      const screenshotDataUrl = String(applicationSubmissionForm.submissionScreenshotImageDataUrl || "").trim();
      const screenshotFileName = String(applicationSubmissionForm.submissionScreenshotFileName || "").trim();

      if (!txId) {
        setApplicationSubmissionFieldErrors({ pruOneTransactionId: "PRUOnePH Transaction ID is required." });
        return;
      }
      if (!screenshotDataUrl) {
        setApplicationSubmissionFieldErrors({ submissionScreenshotImageDataUrl: "Submission screenshot is required." });
        return;
      }

      setApplicationSubmissionSaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/application/submission?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pruOneTransactionId: txId,
          submissionScreenshotImageDataUrl: screenshotDataUrl,
          submissionScreenshotFileName: screenshotFileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save application submission.");
      await refreshCurrentProgressView();
    } catch (err) {
      const msg = String(err?.message || "Failed to save application submission.");
      if (msg.includes("Transaction ID")) {
        setApplicationSubmissionFieldErrors({ pruOneTransactionId: "PRUOnePH Transaction ID is required." });
      } else if (msg.includes("screenshot")) {
        setApplicationSubmissionFieldErrors({ submissionScreenshotImageDataUrl: "Submission screenshot is required." });
      } else {
        setApplicationSubmissionError(msg);
      }
    } finally {
      setApplicationSubmissionSaving(false);
    }
  };

  const applicationSubmissionSavedDateInput = useMemo(() => {
    const raw = applicationSubmissionForm?.savedAt ? new Date(applicationSubmissionForm.savedAt) : null;
    if (!raw || Number.isNaN(raw.getTime())) return "";
    return toDateInputValue(raw);
  }, [applicationSubmissionForm?.savedAt]);

  const todayDateInput = useMemo(() => toDateInputValue(new Date()), []);

  const hasSavedPolicyApplicationStatus = useMemo(() => {
    const status = String(policyStatusForm.status || "").trim();
    if (!["Issued", "Declined"].includes(status)) return false;
    if (!String(policyStatusForm.savedAt || "").trim()) return false;
    if (status === "Issued" && !String(policyStatusForm.issuanceDate || "").trim()) return false;
    return true;
  }, [policyStatusForm.status, policyStatusForm.issuanceDate, policyStatusForm.savedAt]);

  const submitPolicyApplicationStatus = async () => {
    try {
      setPolicyStatusError("");
      setPolicyStatusFieldErrors({});

      const status = String(policyStatusForm.status || "").trim();
      const issuanceDate = String(policyStatusForm.issuanceDate || "").trim();
      const notes = String(policyStatusForm.notes || "").trim();

      if (!["Issued", "Declined"].includes(status)) {
        setPolicyStatusFieldErrors({ status: "Please select policy application status." });
        return;
      }

      if (status === "Issued") {
        if (!issuanceDate) {
          setPolicyStatusFieldErrors({ issuanceDate: "Issuance date is required for Issued status." });
          return;
        }
        if (applicationSubmissionSavedDateInput && issuanceDate < applicationSubmissionSavedDateInput) {
          setPolicyStatusFieldErrors({ issuanceDate: "Issuance date cannot be earlier than application submission date." });
          return;
        }
        if (issuanceDate > todayDateInput) {
          setPolicyStatusFieldErrors({ issuanceDate: "Issuance date cannot be in the future." });
          return;
        }
      }

      setPolicyStatusSaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/policy-issuance/status?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          issuanceDate: status === "Issued" ? issuanceDate : "",
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save policy application status.");
      await refreshCurrentProgressView();
    } catch (err) {
      const msg = String(err?.message || "Failed to save policy application status.");
      if (msg.includes("Issued or Declined")) {
        setPolicyStatusFieldErrors({ status: "Please select policy application status." });
      } else if (msg.includes("Issuance date")) {
        setPolicyStatusFieldErrors({ issuanceDate: msg });
      } else {
        setPolicyStatusError(msg);
      }
    } finally {
      setPolicyStatusSaving(false);
    }
  };

  const hasSavedPolicyInitialPremiumEor = useMemo(() => {
    const hasNo = Boolean(String(policyInitialEorForm.eorNumber || "").trim());
    const hasDate = Boolean(String(policyInitialEorForm.receiptDate || "").trim());
    const hasFile = Boolean(String(policyInitialEorForm.eorFileDataUrl || "").trim());
    const hasSaved = Boolean(String(policyInitialEorForm.uploadedAt || "").trim());
    return hasNo && hasDate && hasFile && hasSaved;
  }, [policyInitialEorForm.eorNumber, policyInitialEorForm.receiptDate, policyInitialEorForm.eorFileDataUrl, policyInitialEorForm.uploadedAt]);

  const onPolicyInitialEorPicked = (file) => {
    if (!file) {
      setPolicyInitialEorForm((f) => ({ ...f, eorFileDataUrl: "", eorFileName: "" }));
      return;
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setPolicyInitialEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "eOR file must be a PDF." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPolicyInitialEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "" }));
      setPolicyInitialEorForm((f) => ({ ...f, eorFileDataUrl: String(reader.result || ""), eorFileName: file.name }));
    };
    reader.onerror = () => {
      setPolicyInitialEorFieldErrors((prev) => ({ ...prev, eorFileDataUrl: "Failed to read eOR file." }));
    };
    reader.readAsDataURL(file);
  };

  const submitPolicyInitialEor = async () => {
    try {
      setPolicyInitialEorError("");
      setPolicyInitialEorFieldErrors({});
      const eorNumber = String(policyInitialEorForm.eorNumber || "").trim();
      const receiptDate = String(policyInitialEorForm.receiptDate || "").trim();
      const eorFileDataUrl = String(policyInitialEorForm.eorFileDataUrl || "").trim();
      const eorFileName = String(policyInitialEorForm.eorFileName || "").trim();

      if (!eorNumber) {
        setPolicyInitialEorFieldErrors({ eorNumber: "eOR number is required." });
        return;
      }
      if (!receiptDate) {
        setPolicyInitialEorFieldErrors({ receiptDate: "Receipt date is required." });
        return;
      }
      if (!eorFileDataUrl) {
        setPolicyInitialEorFieldErrors({ eorFileDataUrl: "eOR PDF file is required." });
        return;
      }

      setPolicyInitialEorSaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/policy-issuance/initial-premium-eor?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eorNumber, receiptDate, eorFileDataUrl, eorFileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save Initial Premium eOR.");
      await refreshCurrentProgressView();
    } catch (err) {
      const msg = String(err?.message || "Failed to save Initial Premium eOR.");
      if (msg.includes("eOR number")) setPolicyInitialEorFieldErrors({ eorNumber: "eOR number is required." });
      else if (msg.includes("Receipt date")) setPolicyInitialEorFieldErrors({ receiptDate: msg });
      else if (msg.includes("PDF")) setPolicyInitialEorFieldErrors({ eorFileDataUrl: msg });
      else setPolicyInitialEorError(msg);
    } finally {
      setPolicyInitialEorSaving(false);
    }
  };

  const hasSavedPolicySummary = useMemo(() => {
    const hasPolicyNo = /^\d{8}$/.test(String(policySummaryForm.policyNumber || "").trim());
    const hasFile = Boolean(String(policySummaryForm.policySummaryFileDataUrl || "").trim());
    const hasSaved = Boolean(String(policySummaryForm.uploadedAt || "").trim());
    return hasPolicyNo && hasFile && hasSaved;
  }, [policySummaryForm.policyNumber, policySummaryForm.policySummaryFileDataUrl, policySummaryForm.uploadedAt]);

  const policyPaymentTermOptions = useMemo(() => {
    const list = Array.isArray(policyChosenProduct?.paymentTermOptions) ? policyChosenProduct.paymentTermOptions : [];
    return list
      .map((opt) => ({
        label: String(opt?.label || "").trim(),
        type: String(opt?.type || "").trim(),
        years: opt?.years ?? null,
        minYears: opt?.minYears ?? null,
        untilAge: opt?.untilAge ?? null,
      }))
      .filter((opt) => opt.label && opt.type);
  }, [policyChosenProduct]);

  const policyCoverageRule = useMemo(() => {
    const r = policyChosenProduct?.coverageDurationRule || null;
    if (!r) return null;
    return {
      label: String(r?.label || "").trim(),
      type: String(r?.type || "").trim(),
      years: r?.years ?? null,
      minYears: r?.minYears ?? null,
      untilAge: r?.untilAge ?? null,
    };
  }, [policyChosenProduct]);

  const policyAgeRangeOptions = useMemo(() => {
    const start = Number(policyIssuanceAge);
    if (!Number.isFinite(start)) return [];
    const maxFromPayment = policyPaymentTermOptions
      .filter((opt) => opt.type === "RANGE_TO_AGE" && Number.isFinite(Number(opt.untilAge)))
      .map((opt) => Number(opt.untilAge));
    const maxFromCoverage = policyCoverageRule?.type === "RANGE_TO_AGE" && Number.isFinite(Number(policyCoverageRule?.untilAge))
      ? [Number(policyCoverageRule.untilAge)]
      : [];
    const maxAge = Math.max(0, ...maxFromPayment, ...maxFromCoverage);
    if (!maxAge || maxAge <= start) return [];
    return Array.from({ length: maxAge - start }, (_, idx) => start + idx + 1);
  }, [policyIssuanceAge, policyPaymentTermOptions, policyCoverageRule]);

  useEffect(() => {
    if (!policyPaymentTermOptions.length) return;
    if (String(policyCoverageForm.selectedPaymentTermType || "").trim()) return;
    if (policyPaymentTermOptions.length === 1) {
      const only = policyPaymentTermOptions[0];
      setPolicyCoverageForm((f) => ({
        ...f,
        selectedPaymentTermLabel: only.label,
        selectedPaymentTermType: only.type,
        selectedPaymentTermYears: only.years ?? "",
        selectedPaymentTermUntilAge: only.untilAge ?? "",
      }));
    }
  }, [policyPaymentTermOptions, policyCoverageForm.selectedPaymentTermType]);

  useEffect(() => {
    if (!policyCoverageRule?.type) return;
    setPolicyCoverageForm((f) => ({
      ...f,
      coverageDurationLabel: policyCoverageRule.label,
      coverageDurationType: policyCoverageRule.type,
      coverageDurationYears: policyCoverageRule.type === "FIXED_YEARS" ? (policyCoverageRule.years ?? "") : "",
      coverageDurationUntilAge:
        policyCoverageRule.type === "UNTIL_AGE"
          ? (policyCoverageRule.untilAge ?? "")
          : (f.coverageDurationUntilAge || ""),
    }));
  }, [policyCoverageRule]);

  const computedPolicyEndDate = useMemo(() => {
    const issuanceRaw = String(policyStatusForm.issuanceDate || "").trim();
    if (!issuanceRaw) return "";
    const issuanceDate = new Date(`${issuanceRaw}T00:00:00`);
    if (Number.isNaN(issuanceDate.getTime())) return "";

    const type = String(policyCoverageForm.coverageDurationType || "").trim();
    let yearsToAdd = null;
    if (type === "FIXED_YEARS") {
      const y = Number(policyCoverageForm.coverageDurationYears || "");
      if (Number.isFinite(y) && y > 0) yearsToAdd = y;
    } else if (type === "UNTIL_AGE") {
      const untilAge = Number(policyCoverageForm.coverageDurationUntilAge || "");
      if (Number.isFinite(untilAge) && Number.isFinite(policyIssuanceAge)) {
        yearsToAdd = untilAge - Number(policyIssuanceAge);
      }
    } else if (type === "RANGE_TO_AGE") {
      const untilAge = Number(policyCoverageForm.coverageDurationUntilAge || "");
      if (Number.isFinite(untilAge) && Number.isFinite(policyIssuanceAge)) {
        yearsToAdd = untilAge - Number(policyIssuanceAge);
      }
    }

    if (!Number.isFinite(yearsToAdd) || yearsToAdd <= 0) return "";
    const end = new Date(issuanceDate);
    end.setFullYear(end.getFullYear() + yearsToAdd);
    return toDateInputValue(end);
  }, [policyStatusForm.issuanceDate, policyCoverageForm.coverageDurationType, policyCoverageForm.coverageDurationYears, policyCoverageForm.coverageDurationUntilAge, policyIssuanceAge]);

  const hasSavedPolicyCoverageDetails = useMemo(() => {
    return Boolean(String(policyCoverageForm.savedAt || "").trim());
  }, [policyCoverageForm.savedAt]);

  const computedNextPaymentDate = useMemo(() => {
    const receiptRaw = String(policyInitialEorForm.receiptDate || "").trim();
    if (!receiptRaw) return "";

    const receiptDate = new Date(`${receiptRaw}T00:00:00`);
    if (Number.isNaN(receiptDate.getTime())) return "";

    const frequency = String(requestedFrequencyFromNeedsAssessment || "").trim();
    const monthsByFrequency = {
      Monthly: 1,
      Quarterly: 3,
      "Half-yearly": 6,
      Yearly: 12,
    };
    const recurringIntervalMonths = monthsByFrequency[frequency] ?? null;
    if (!recurringIntervalMonths) return "";

    const issuanceRaw = String(policyStatusForm.issuanceDate || "").trim();
    if (!issuanceRaw) return "";
    const issuanceDate = new Date(`${issuanceRaw}T00:00:00`);
    if (Number.isNaN(issuanceDate.getTime())) return "";

    let paymentTermEndDate = null;
    const paymentType = String(policyCoverageForm.selectedPaymentTermType || "").trim();
    if (paymentType === "FIXED_YEARS") {
      const years = Number(policyCoverageForm.selectedPaymentTermYears || "");
      if (Number.isFinite(years) && years > 0) {
        paymentTermEndDate = new Date(issuanceDate);
        paymentTermEndDate.setFullYear(paymentTermEndDate.getFullYear() + years);
      }
    } else if (["UNTIL_AGE", "RANGE_TO_AGE"].includes(paymentType)) {
      const untilAge = Number(policyCoverageForm.selectedPaymentTermUntilAge || "");
      if (Number.isFinite(untilAge) && Number.isFinite(policyIssuanceAge)) {
        const years = untilAge - Number(policyIssuanceAge);
        if (years > 0) {
          paymentTermEndDate = new Date(issuanceDate);
          paymentTermEndDate.setFullYear(paymentTermEndDate.getFullYear() + years);
        }
      }
    }
    if (!paymentTermEndDate || Number.isNaN(paymentTermEndDate.getTime())) return "";

    const candidate = new Date(receiptDate);
    candidate.setMonth(candidate.getMonth() + recurringIntervalMonths);
    if (candidate >= paymentTermEndDate) return "";
    return toDateInputValue(candidate);
  }, [
    policyInitialEorForm.receiptDate,
    requestedFrequencyFromNeedsAssessment,
    policyStatusForm.issuanceDate,
    policyCoverageForm.selectedPaymentTermType,
    policyCoverageForm.selectedPaymentTermYears,
    policyCoverageForm.selectedPaymentTermUntilAge,
    policyIssuanceAge,
  ]);

  const isViewedStageFullyFinished = useMemo(() => {
    if (!isViewingCurrentStage) return true;
    if (showNeedsAssessmentPanel) return Boolean(proposalMeetingSaved?.startAt);
    if (showProposalPanel) return Boolean(applicationMeetingSaved?.startAt);
    if (showApplicationPanel) return hasSavedApplicationSubmission;
    if (showPolicyIssuancePanel) return hasSavedPolicyCoverageDetails;
    return false;
  }, [
    isViewingCurrentStage,
    showNeedsAssessmentPanel,
    proposalMeetingSaved?.startAt,
    showProposalPanel,
    applicationMeetingSaved?.startAt,
    showApplicationPanel,
    hasSavedApplicationSubmission,
    showPolicyIssuancePanel,
    hasSavedPolicyCoverageDetails,
  ]);

  const shouldShowStageActivityBadge =
    !isLeadClosed &&
    !isLeadDropped &&
    !isViewedStageFullyFinished &&
    String(stageActivityBadge || "").trim() &&
    stageActivityBadge !== "—";

  const onPolicySummaryPicked = (file) => {
    if (!file) {
      setPolicySummaryForm((f) => ({ ...f, policySummaryFileDataUrl: "", policySummaryFileName: "" }));
      return;
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setPolicySummaryFieldErrors((prev) => ({ ...prev, policySummaryFileDataUrl: "Policy summary file must be a PDF." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPolicySummaryFieldErrors((prev) => ({ ...prev, policySummaryFileDataUrl: "" }));
      setPolicySummaryForm((f) => ({ ...f, policySummaryFileDataUrl: String(reader.result || ""), policySummaryFileName: file.name }));
    };
    reader.onerror = () => {
      setPolicySummaryFieldErrors((prev) => ({ ...prev, policySummaryFileDataUrl: "Failed to read policy summary file." }));
    };
    reader.readAsDataURL(file);
  };

  const submitPolicySummary = async () => {
    try {
      setPolicySummaryError("");
      setPolicySummaryFieldErrors({});
      const policyNumber = String(policySummaryForm.policyNumber || "").trim();
      const policySummaryFileDataUrl = String(policySummaryForm.policySummaryFileDataUrl || "").trim();
      const policySummaryFileName = String(policySummaryForm.policySummaryFileName || "").trim();

      if (!/^\d{8}$/.test(policyNumber)) {
        setPolicySummaryFieldErrors({ policyNumber: "Policy number must be exactly 8 digits." });
        return;
      }
      if (!policySummaryFileDataUrl) {
        setPolicySummaryFieldErrors({ policySummaryFileDataUrl: "Policy summary PDF is required." });
        return;
      }

      setPolicySummarySaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/policy-issuance/policy-summary?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyNumber, policySummaryFileDataUrl, policySummaryFileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save policy summary.");
      await refreshCurrentProgressView();
    } catch (err) {
      const msg = String(err?.message || "Failed to save policy summary.");
      if (msg.includes("8 digits")) setPolicySummaryFieldErrors({ policyNumber: "Policy number must be exactly 8 digits." });
      else if (msg.includes("already exists")) setPolicySummaryFieldErrors({ policyNumber: "Policy number already exists." });
      else if (msg.includes("PDF")) setPolicySummaryFieldErrors({ policySummaryFileDataUrl: msg });
      else setPolicySummaryError(msg);
    } finally {
      setPolicySummarySaving(false);
    }
  };


  const submitPolicyCoverageDetails = async () => {
    try {
      setPolicyCoverageError("");
      setPolicyCoverageFieldErrors({});

      const payload = {
        selectedPaymentTermLabel: String(policyCoverageForm.selectedPaymentTermLabel || "").trim(),
        selectedPaymentTermType: String(policyCoverageForm.selectedPaymentTermType || "").trim(),
        selectedPaymentTermYears:
          policyCoverageForm.selectedPaymentTermYears !== "" ? Number(policyCoverageForm.selectedPaymentTermYears) : null,
        selectedPaymentTermUntilAge:
          policyCoverageForm.selectedPaymentTermUntilAge !== "" ? Number(policyCoverageForm.selectedPaymentTermUntilAge) : null,
        coverageDurationLabel: String(policyCoverageForm.coverageDurationLabel || "").trim(),
        coverageDurationType: String(policyCoverageForm.coverageDurationType || "").trim(),
        coverageDurationYears:
          policyCoverageForm.coverageDurationYears !== "" ? Number(policyCoverageForm.coverageDurationYears) : null,
        coverageDurationUntilAge:
          policyCoverageForm.coverageDurationUntilAge !== "" ? Number(policyCoverageForm.coverageDurationUntilAge) : null,
      };

      if (!payload.selectedPaymentTermLabel || !payload.selectedPaymentTermType) {
        setPolicyCoverageFieldErrors({ selectedPaymentTermLabel: "Please select payment term." });
        return;
      }
      if (payload.selectedPaymentTermType === "RANGE_TO_AGE" && !Number.isFinite(payload.selectedPaymentTermUntilAge)) {
        setPolicyCoverageFieldErrors({ selectedPaymentTermUntilAge: "Please select payment term until age." });
        return;
      }

      if (!payload.coverageDurationLabel || !payload.coverageDurationType) {
        setPolicyCoverageFieldErrors({ coverageDurationLabel: "Coverage duration is required." });
        return;
      }
      if (payload.coverageDurationType === "RANGE_TO_AGE" && !Number.isFinite(payload.coverageDurationUntilAge)) {
        setPolicyCoverageFieldErrors({ coverageDurationUntilAge: "Please select coverage duration until age." });
        return;
      }
      if (!String(computedPolicyEndDate || "").trim()) {
        setPolicyCoverageFieldErrors({ policyEndDate: "Unable to compute policy end date from selected coverage duration." });
        return;
      }

      setPolicyCoverageSaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/policy-issuance/coverage-duration?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save coverage duration details.");
      await refreshCurrentProgressView();
    } catch (err) {
      const msg = String(err?.message || "Failed to save coverage duration details.");
      if (msg.toLowerCase().includes("payment term")) {
        setPolicyCoverageFieldErrors((prev) => ({ ...prev, selectedPaymentTermLabel: msg }));
      } else if (msg.toLowerCase().includes("coverage")) {
        setPolicyCoverageFieldErrors((prev) => ({ ...prev, coverageDurationLabel: msg }));
      } else {
        setPolicyCoverageError(msg);
      }
    } finally {
      setPolicyCoverageSaving(false);
    }
  };

  const submitScheduleApplicationSubmission = async () => {
    try {
      setApplicationMeetingError("");
      setApplicationMeetingFieldErrors({});

      const meetingDate = String(applicationMeetingForm.meetingDate || "").trim();
      const meetingStartTime = String(applicationMeetingForm.meetingStartTime || "").trim();
      const meetingDurationMin = Number(applicationMeetingForm.meetingDurationMin || 120);
      const meetingMode = String(applicationMeetingForm.meetingMode || "").trim();

      if (!meetingDate) {
        setApplicationMeetingFieldErrors({ meetingDate: "Meeting date is required." });
        return;
      }
      if (!meetingStartTime) {
        setApplicationMeetingFieldErrors({ meetingStartTime: "Start time is required." });
        return;
      }
      if (![30, 60, 90, 120].includes(meetingDurationMin)) {
        setApplicationMeetingFieldErrors({ meetingDurationMin: "Duration must be 30, 60, 90, or 120 minutes." });
        return;
      }

      const latestWindows = await fetchMeetingAvailability();
      const proposedStart = combineDateAndTimeLocal(meetingDate, meetingStartTime);
      const proposedEnd = proposedStart ? new Date(proposedStart.getTime() + meetingDurationMin * 60 * 1000) : null;
      const hasRealtimeConflict = Boolean(proposedStart && proposedEnd) && (latestWindows || []).some((w) => {
        const ws = w?.startAt ? new Date(w.startAt) : null;
        const we = w?.endAt ? new Date(w.endAt) : null;
        if (!ws || !we || Number.isNaN(ws.getTime()) || Number.isNaN(we.getTime())) return false;
        if (applicationMeetingSaved?.startAt && ws.getTime() === new Date(applicationMeetingSaved.startAt).getTime()) return false;
        return ws < proposedEnd && we > proposedStart;
      });
      if (hasRealtimeConflict) {
        setApplicationMeetingFieldErrors({ meetingStartTime: "Selected start time conflicts with an existing meeting." });
        return;
      }
      if (isSlotBooked(meetingDate, meetingStartTime, meetingDurationMin, applicationMeetingSaved?.startAt)) {
        setApplicationMeetingFieldErrors({ meetingStartTime: "Selected start time conflicts with an existing meeting." });
        return;
      }

      if (!["Online", "Face-to-face"].includes(meetingMode)) {
        setApplicationMeetingFieldErrors({ meetingMode: "Please select meeting mode." });
        return;
      }

      if (meetingMode === "Online") {
        const platform = String(applicationMeetingForm.meetingPlatform || "").trim();
        if (!["Zoom", "Google Meet", "Other"].includes(platform)) {
          setApplicationMeetingFieldErrors({ meetingPlatform: "Please select online platform." });
          return;
        }
        if (platform === "Other" && !String(applicationMeetingForm.meetingPlatformOther || "").trim()) {
          setApplicationMeetingFieldErrors({ meetingPlatformOther: "Please specify other platform." });
          return;
        }
        const link = String(applicationMeetingForm.meetingLink || "").trim();
        if (!link) {
          setApplicationMeetingFieldErrors({ meetingLink: "Meeting link is required for online meetings." });
          return;
        }
        if (!isValidHttpUrl(link)) {
          setApplicationMeetingFieldErrors({ meetingLink: "Meeting link must be a valid http/https URL." });
          return;
        }
        if (applicationMeetingForm.meetingInviteSent !== true) {
          setApplicationMeetingFieldErrors({ meetingInviteSent: "Please confirm invite link has been sent." });
          return;
        }
      }

      if (meetingMode === "Face-to-face" && !String(applicationMeetingForm.meetingPlace || "").trim()) {
        setApplicationMeetingFieldErrors({ meetingPlace: "Meeting place is required for face-to-face meetings." });
        return;
      }

      setSavingApplicationMeeting(true);

      const res = await fetch(
        `${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/proposal/schedule-application?userId=${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingDate,
            meetingStartTime,
            meetingDurationMin,
            meetingMode,
            meetingPlatform: meetingMode === "Online" ? String(applicationMeetingForm.meetingPlatform || "").trim() : undefined,
            meetingPlatformOther:
              meetingMode === "Online" && applicationMeetingForm.meetingPlatform === "Other"
                ? String(applicationMeetingForm.meetingPlatformOther || "").trim()
                : undefined,
            meetingLink: meetingMode === "Online" ? String(applicationMeetingForm.meetingLink || "").trim() : undefined,
            meetingInviteSent: Boolean(applicationMeetingForm.meetingInviteSent),
            meetingPlace: meetingMode === "Face-to-face" ? String(applicationMeetingForm.meetingPlace || "").trim() : undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to schedule application submission.");

      await refreshCurrentProgressView();
    } catch (err) {
      setApplicationMeetingError(err?.message || "Cannot connect to server. Is backend running?");
    } finally {
      setSavingApplicationMeeting(false);
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

          {t.status === "Done" ? (
            <div className="le-taskMetaItem">
              <span className="le-taskMetaLabel">Fulfillment</span>
              <span className="le-taskMetaVal" style={{ color: t?.wasDelayed ? "#B91C1C" : "#166534", fontWeight: 700 }}>
                {t?.wasDelayed ? "Delayed" : "On time"}
              </span>
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

              {engagement.isBlocked && (
                <div className="le-modalOverlay" style={{ zIndex: 1000000 }}>
                  <div className="le-modalCard" style={{ width: "min(760px, calc(100% - 32px))" }}>
                    <button
                      type="button"
                      className="le-modalClose"
                      aria-label="Back to lead details"
                      onClick={goBackToLeadDetails}
                      title="Back to Lead Details"
                    >
                      ×
                    </button>

                    <h3 className="le-modalTitle">Lead Engagement is temporarily locked</h3>
                    <p className="le-modalText">
                      This lead was marked as <strong>Wrong Contact</strong>. Please update the prospect phone number in
                      Prospect Details to unlock this engagement and continue Contacting activities.
                    </p>

                    <div className="le-modalActions">
                      <button type="button" className="le-btn secondary" onClick={goBackToLeadDetails}>
                        Back to Lead Details
                      </button>
                      <button
                        type="button"
                        className="le-btn primary"
                        onClick={() => navigate(`/agent/${username}/prospects/${prospectId}/full`)}
                      >
                        Update Contact Info
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                  const stageDisabledForFuture =
                    (isLeadDropped && i > safeIndex) || (isLeadInProgress && i > safeIndex);

                  return (
                    <div
                      key={step}
                      className="le-pipelineGroup"
                      role="button"
                      tabIndex={stageDisabledForFuture ? -1 : 0}
                      aria-disabled={stageDisabledForFuture}
                      onClick={() => {
                        if (stageDisabledForFuture) return;
                        setStageViewIfAllowed(step);
                      }}
                      onKeyDown={(e) => {
                        if (stageDisabledForFuture) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setStageViewIfAllowed(step);
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
                    {shouldShowStageActivityBadge ? <span className="le-badge">{stageActivityBadge}</span> : null}
                  </div>

                  {stage === "Not Started" && (
                    <p className="le-muted" style={{ marginTop: 10 }}>
                      No engagement activity yet. Move to Contacting to start.
                    </p>
                  )}

                  {(isLeadClosed || isLeadDropped) && (
                    <p className="le-muted" style={{ marginTop: 8, marginBottom: 10 }}>
                      This lead is closed or dropped. Subactivities are view-only.
                    </p>
                  )}

                  {!isViewingCurrentStage && !(isLeadClosed || isLeadDropped) && (
                    <p className="le-muted" style={{ marginTop: 8, marginBottom: 10 }}>
                      You are viewing a non-current stage. This section is read-only.
                    </p>
                  )}

                  {showContactingTracker && isViewingCurrentStage && (
                    <SubactivityNavigator
                      steps={CONTACTING_STEPS_UI}
                      currentIndex={contactingCurrentStepIndex}
                      viewedIndex={contactingViewedStepIndex}
                      onSelect={(stepKey) =>
                        selectReachableViewedStep(
                          CONTACTING_STEPS_UI,
                          stepKey,
                          contactingCurrentStepIndex,
                          setContactingViewedActivityKey
                        )
                      }
                      helperText={
                        isLeadClosed || isLeadDropped
                          ? closedLeadSubactivityHelperText
                          : contactingViewedStepIndex < contactingCurrentStepIndex
                          ? "Viewing a previously saved subactivity. Click the current subactivity to resume editing."
                          : "Click any unlocked subactivity to review saved details. Only the current subactivity can be edited."
                      }
                      showCurrentStatus={showCurrentSubactivityStatus}
                    />
                  )}

                  {showContactingTracker && !isViewingCurrentStage && (
                    <SubactivityNavigator
                      steps={CONTACTING_STEPS_UI}
                      currentIndex={isViewingPastStage ? CONTACTING_STEPS_UI.length - 1 : -1}
                      viewedIndex={contactingViewedStepIndex}
                      onSelect={setContactingViewedActivityKey}
                      helperText={isViewingFutureStage ? futureStageSubactivityHelperText : ""}
                      showCurrentStatus={false}
                      allowAllSteps={isViewingPastStage}
                    />
                  )}

                      {showNeedsAssessmentPanel && (
                    <SubactivityNavigator
                      steps={NEEDS_ASSESSMENT_STEPS_UI}
                      currentIndex={isViewingCurrentStage ? needsCurrentStepIndex : isViewingPastStage ? NEEDS_ASSESSMENT_STEPS_UI.length - 1 : -1}
                      viewedIndex={needsViewedStepIndex}
                      onSelect={(stepKey) =>
                        isViewingCurrentStage
                          ? selectReachableViewedStep(
                              NEEDS_ASSESSMENT_STEPS_UI,
                              stepKey,
                              needsCurrentStepIndex,
                              setNeedsAssessmentViewedActivityKey
                            )
                          : setNeedsAssessmentViewedActivityKey(stepKey)
                      }
                      helperText={
                        !isViewingCurrentStage
                          ? isViewingFutureStage
                            ? futureStageSubactivityHelperText
                            : ""
                          : isLeadClosed || isLeadDropped
                          ? closedLeadSubactivityHelperText
                          : needsViewedStepIndex < needsCurrentStepIndex
                          ? "Viewing a previously saved subactivity. Click the current subactivity to resume editing."
                          : "Click any unlocked subactivity to review saved details. Only the current subactivity can be edited."
                      }
                      showCurrentStatus={showCurrentSubactivityStatus}
                      allowAllSteps={isViewingPastStage}
                    />
                  )}

                  {showProposalPanel && (
                    <SubactivityNavigator
                      steps={PROPOSAL_STEPS_UI}
                      currentIndex={isViewingCurrentStage ? proposalCurrentStepIndex : isViewingPastStage ? PROPOSAL_STEPS_UI.length - 1 : -1}
                      viewedIndex={proposalViewedStepIndex}
                      onSelect={(stepKey) =>
                        isViewingCurrentStage
                          ? selectReachableViewedStep(
                              PROPOSAL_STEPS_UI,
                              stepKey,
                              proposalCurrentStepIndex,
                              setProposalViewedActivityKey
                            )
                          : setProposalViewedActivityKey(stepKey)
                      }
                      helperText={
                        !isViewingCurrentStage
                          ? isViewingFutureStage
                            ? futureStageSubactivityHelperText
                            : ""
                          : isLeadClosed || isLeadDropped
                          ? closedLeadSubactivityHelperText
                          : proposalViewedStepIndex < proposalCurrentStepIndex
                          ? "Viewing a previously saved proposal subactivity in read-only mode. Click the current subactivity to resume editing."
                          : "Click any unlocked subactivity to review saved details. Only the current subactivity can be edited."
                      }
                      showCurrentStatus={showCurrentSubactivityStatus}
                      allowAllSteps={isViewingPastStage}
                    />
                  )}

                  {showApplicationPanel && (
                    <SubactivityNavigator
                      steps={APPLICATION_STEPS_UI}
                      currentIndex={isViewingCurrentStage ? applicationCurrentStepIndex : isViewingPastStage ? APPLICATION_STEPS_UI.length - 1 : -1}
                      viewedIndex={applicationViewedStepIndex}
                      onSelect={(stepKey) =>
                        isViewingCurrentStage
                          ? selectReachableViewedStep(
                              APPLICATION_STEPS_UI,
                              stepKey,
                              applicationCurrentStepIndex,
                              setApplicationViewedActivityKey
                            )
                          : setApplicationViewedActivityKey(stepKey)
                      }
                      helperText={
                        !isViewingCurrentStage
                          ? isViewingFutureStage
                            ? futureStageSubactivityHelperText
                            : ""
                          : isLeadClosed || isLeadDropped
                          ? closedLeadSubactivityHelperText
                          : applicationViewedStepIndex < applicationCurrentStepIndex
                          ? "Viewing a previously saved application subactivity in read-only mode. Click the current subactivity to resume editing."
                          : "Click any unlocked subactivity to review saved details. Only the current subactivity can be edited."
                      }
                      showCurrentStatus={showCurrentSubactivityStatus}
                      allowAllSteps={isViewingPastStage}
                    />
                  )}

                  {showPolicyIssuancePanel && (
                    <SubactivityNavigator
                      steps={POLICY_ISSUANCE_STEPS_UI}
                      currentIndex={isViewingCurrentStage ? policyCurrentStepIndex : isViewingPastStage ? POLICY_ISSUANCE_STEPS_UI.length - 1 : -1}
                      viewedIndex={policyViewedStepIndex}
                      onSelect={(stepKey) =>
                        isViewingCurrentStage
                          ? selectReachableViewedStep(
                              POLICY_ISSUANCE_STEPS_UI,
                              stepKey,
                              policyCurrentStepIndex,
                              setPolicyViewedActivityKey
                            )
                          : setPolicyViewedActivityKey(stepKey)
                      }
                      helperText={
                        !isViewingCurrentStage
                          ? isViewingFutureStage
                            ? futureStageSubactivityHelperText
                            : ""
                          : isLeadClosed || isLeadDropped
                          ? closedLeadSubactivityHelperText
                          : policyViewedStepIndex < policyCurrentStepIndex
                          ? "Viewing a previously saved policy issuance subactivity in read-only mode. Click the current subactivity to resume editing."
                          : "Click any unlocked subactivity to review saved details. Only the current subactivity can be edited."
                      }
                      showCurrentStatus={showCurrentSubactivityStatus}
                      allowAllSteps={isViewingPastStage}
                    />
                  )}

                  {showApplicationPanel && (
                    <>
                      <div className="le-block">
                        <div className="le-attemptMeta">
                          <div>
                            <span className="le-metaLabel">Chosen Product</span>
                            <span className="le-metaValue">{applicationChosenProduct.productName || applicationChosenProduct.id || "—"}</span>
                          </div>
                          <div>
                            <span className="le-metaLabel">Product Description</span>
                            <span className="le-metaValue">{applicationChosenProduct.description || "No product description available."}</span>
                          </div>
                        </div>
                      </div>

                      <div className="le-block">
                        <div className="le-formRow">
                          <label className="le-label">Initial Quotation Proposal Preview:</label>
                          {proposalGenerateForm.proposalFileDataUrl ? (
                            <iframe
                              title="Initial Quotation Proposal Preview"
                              src={proposalGenerateForm.proposalFileDataUrl}
                              style={{ width: "100%", minHeight: 320, border: "1px solid #e5e7eb", borderRadius: 10 }}
                            />
                          ) : (
                            <p className="le-smallNote">No proposal preview available.</p>
                          )}
                        </div>

                        <div className="le-formRow" style={{ marginTop: 8 }}>
                          <label className="le-label">Application Submission link:</label>
                          <p className="le-smallNote">
                            <a href="https://pruone.prulifeuk.com.ph/web" target="_blank" rel="noreferrer">https://pruone.prulifeuk.com.ph/web</a>
                          </p>
                        </div>
                      </div>

                      {isApplicationAttendanceViewed && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Prospect Attendance</h4>

                          {hasSavedApplicationAttendance ? (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Prospect Attended?</label>
                                <p className="le-smallNote">{applicationAttendanceForm.attendanceChoice === "YES" ? "Yes" : "No"}</p>
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Proof of Attendance</label>
                                <p className="le-smallNote">{applicationAttendanceForm.attendanceProofFileName || "Uploaded image"}</p>
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Preview</label>
                                <img
                                  src={applicationAttendanceForm.attendanceProofImageDataUrl}
                                  alt="Application attendance proof preview"
                                  style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                />
                              </div>

                            </>
                          ) : (
                            <>
                              <div className="le-formRow" style={{ alignItems: "center" }}>
                                <label className="le-label">Prospect Attended? *</label>
                                <div className="le-checkboxGrid">
                                  <label className="le-check">
                                    <input
                                      type="radio"
                                      name="application-prospect-attendance"
                                      checked={applicationAttendanceForm.attendanceChoice === "YES"}
                                      onChange={() => {
                                        setApplicationAttendanceError("");
                                        setApplicationAttendanceForm((f) => ({ ...f, attendanceChoice: "YES" }));
                                      }}
                                    />
                                    <span>Yes</span>
                                  </label>
                                  <label className="le-check">
                                    <input
                                      type="radio"
                                      name="application-prospect-attendance"
                                      checked={applicationAttendanceForm.attendanceChoice === "NO"}
                                      onChange={() => {
                                        setApplicationAttendanceForm((f) => ({
                                          ...f,
                                          attendanceChoice: "NO",
                                          attendanceProofImageDataUrl: "",
                                          attendanceProofFileName: "",
                                        }));
                                        setApplicationAttendanceError("Prospect attendance is required before proceeding to application submission.");
                                      }}
                                    />
                                    <span>No</span>
                                  </label>
                                </div>
                              </div>

                              {applicationAttendanceError === "Prospect attendance is required before proceeding to application submission." ? (
                                <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>
                                  {applicationAttendanceError}
                                </p>
                              ) : null}

                              {applicationAttendanceForm.attendanceChoice === "YES" ? (
                                <>
                                  <div className="le-formRow">
                                    <label className="le-label">Proof of Attendance (JPG, JPEG, PNG) *</label>
                                    <input
                                      type="file"
                                      className="le-input"
                                      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                                      onChange={(e) => onApplicationAttendanceProofPicked(e.target.files?.[0] || null)}
                                      disabled={applicationAttendanceSaving || applicationAttendanceForm.attendanceChoice !== "YES"}
                                    />
                                    {applicationAttendanceForm.attendanceProofFileName ? (
                                      <p className="le-smallNote">Selected file: {applicationAttendanceForm.attendanceProofFileName}</p>
                                    ) : null}
                                  </div>

                                  {String(applicationAttendanceForm.attendanceProofImageDataUrl || "").trim() ? (
                                    <div className="le-formRow">
                                      <label className="le-label">Preview</label>
                                      <img
                                        src={applicationAttendanceForm.attendanceProofImageDataUrl}
                                        alt="Application attendance proof preview"
                                        style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                      />
                                    </div>
                                  ) : null}

                                  {applicationAttendanceError && applicationAttendanceError !== "Prospect attendance is required before proceeding to application submission." ? (
                                    <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{applicationAttendanceError}</p>
                                  ) : null}
                                </>
                              ) : null}

                              <div className="le-actions" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setApplicationAttendanceError("");
                                    setApplicationAttendanceForm({
                                      attendanceChoice: "",
                                      attendanceProofImageDataUrl: "",
                                      attendanceProofFileName: "",
                                      attendedAt: "",
                                    });
                                  }}
                                  disabled={applicationAttendanceSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitApplicationAttendance}
                                  disabled={applicationAttendanceSaving || applicationAttendanceForm.attendanceChoice !== "YES"}
                                >
                                  {applicationAttendanceSaving ? "Saving..." : "Record Prospect Attendance"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {isApplicationPremiumViewed && hasSavedApplicationAttendance ? (
                        <div className="le-block">
                          <h4 className="le-blockTitle">{hasSavedApplicationPremiumPaymentTransfer ? "Premium Payment Transfer Details" : "Record Premium Payment Transfer"}</h4>

                          {hasSavedApplicationPremiumPaymentTransfer ? (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Requested Frequency of Premium Payment</label>
                                <p className="le-smallNote">{requestedFrequencyFromNeedsAssessment || "—"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Total Annual Premium (Php)</label>
                                <p className="le-smallNote">{applicationPremiumPaymentForm.totalAnnualPremiumPhp || "—"}</p>
                              </div>
                              {shouldShowFrequencyPremiumField ? (
                                <div className="le-formRow">
                                  <label className="le-label">{totalFrequencyPremiumLabel.replace("(in Php)", "(Php)")}</label>
                                  <p className="le-smallNote">{applicationPremiumPaymentForm.totalFrequencyPremiumPhp || "—"}</p>
                                </div>
                              ) : null}
                              <div className="le-formRow">
                                <label className="le-label">Method for Initial Payment</label>
                                <p className="le-smallNote">{initialPaymentMethodFromApplication || "—"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Method for Renewal Payment</label>
                                <p className="le-smallNote">{applicationPremiumPaymentForm.methodForRenewalPayment || "—"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Proof of Payment</label>
                                <p className="le-smallNote">{applicationPremiumPaymentForm.paymentProofFileName || "Uploaded image"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Preview</label>
                                <img
                                  src={applicationPremiumPaymentForm.paymentProofImageDataUrl}
                                  alt="Application premium payment proof preview"
                                  style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                />
                              </div>

                            </>
                          ) : (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Requested Frequency of Premium Payment</label>
                                <p className="le-smallNote">{requestedFrequencyFromNeedsAssessment || "Not available from Needs Assessment."}</p>
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Total Annual Premium (in Php) *</label>
                                <input
                                  className="le-input"
                                  inputMode="decimal"
                                  value={applicationPremiumPaymentForm.totalAnnualPremiumPhp}
                                  onChange={(e) => {
                                    setApplicationPremiumPaymentForm((f) => ({ ...f, totalAnnualPremiumPhp: e.target.value }));
                                    setApplicationPremiumPaymentFieldErrors((prev) => ({ ...prev, totalAnnualPremiumPhp: "", totalFrequencyPremiumPhp: "" }));
                                  }}
                                  disabled={applicationPremiumPaymentSaving}
                                />
                                {applicationPremiumPaymentFieldErrors.totalAnnualPremiumPhp ? (
                                  <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{applicationPremiumPaymentFieldErrors.totalAnnualPremiumPhp}</p>
                                ) : null}
                              </div>

                              {shouldShowFrequencyPremiumField ? (
                                <div className="le-formRow">
                                  <label className="le-label">{totalFrequencyPremiumLabel} *</label>
                                  <input className="le-input" value={computedFrequencyPremiumValue} disabled />
                                  {applicationPremiumPaymentFieldErrors.totalFrequencyPremiumPhp ? (
                                    <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{applicationPremiumPaymentFieldErrors.totalFrequencyPremiumPhp}</p>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="le-formRow">
                                <label className="le-label">Method for Initial Payment *</label>
                                <select
                                  className="le-input"
                                  value={applicationPremiumPaymentForm.methodForInitialPayment}
                                  onChange={(e) => {
                                    setApplicationPremiumPaymentForm((f) => ({ ...f, methodForInitialPayment: e.target.value }));
                                    setApplicationPremiumPaymentFieldErrors((prev) => ({ ...prev, methodForInitialPayment: "" }));
                                  }}
                                  disabled={applicationPremiumPaymentSaving}
                                >
                                  <option value="">Select</option>
                                  <option value="Credit Card / Debit Card">Credit Card / Debit Card</option>
                                  <option value="Mobile Wallet / GCash">Mobile Wallet / GCash</option>
                                  <option value="Dated Check">Dated Check</option>
                                  <option value="Bills Payments">Bills Payments</option>
                                </select>
                                {applicationPremiumPaymentFieldErrors.methodForInitialPayment ? (
                                  <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{applicationPremiumPaymentFieldErrors.methodForInitialPayment}</p>
                                ) : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Method for Renewal Payment *</label>
                                <select
                                  className="le-input"
                                  value={applicationPremiumPaymentForm.methodForRenewalPayment}
                                  onChange={(e) => {
                                    setApplicationPremiumPaymentForm((f) => ({ ...f, methodForRenewalPayment: e.target.value }));
                                    setApplicationPremiumPaymentFieldErrors((prev) => ({ ...prev, methodForRenewalPayment: "" }));
                                  }}
                                  disabled={applicationPremiumPaymentSaving}
                                >
                                  <option value="">Select</option>
                                  <option value="Credit Card / Debit Card">Credit Card / Debit Card</option>
                                  <option value="Mobile Wallet / GCash">Mobile Wallet / GCash</option>
                                  <option value="Dated Check">Dated Check</option>
                                  <option value="Bills Payments">Bills Payments</option>
                                </select>
                                {applicationPremiumPaymentFieldErrors.methodForRenewalPayment ? (
                                  <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{applicationPremiumPaymentFieldErrors.methodForRenewalPayment}</p>
                                ) : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Proof of Payment via {applicationPremiumPaymentForm.methodForInitialPayment || "Initial Payment Method"} (JPG, JPEG, PNG) *</label>
                                <input
                                  key={applicationPaymentProofInputKey}
                                  type="file"
                                  className="le-input"
                                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                                  onChange={(e) => {
                                    onApplicationPaymentProofPicked(e.target.files?.[0] || null);
                                    setApplicationPremiumPaymentFieldErrors((prev) => ({ ...prev, paymentProofImageDataUrl: "" }));
                                  }}
                                  disabled={applicationPremiumPaymentSaving}
                                />
                                {applicationPremiumPaymentForm.paymentProofFileName ? (
                                  <p className="le-smallNote">Selected file: {applicationPremiumPaymentForm.paymentProofFileName}</p>
                                ) : null}
                                {applicationPremiumPaymentFieldErrors.paymentProofImageDataUrl ? (
                                  <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{applicationPremiumPaymentFieldErrors.paymentProofImageDataUrl}</p>
                                ) : null}
                              </div>

                              {String(applicationPremiumPaymentForm.paymentProofImageDataUrl || "").trim() ? (
                                <div className="le-formRow">
                                  <label className="le-label">Preview</label>
                                  <img
                                    src={applicationPremiumPaymentForm.paymentProofImageDataUrl}
                                    alt="Application premium payment proof preview"
                                    style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                  />
                                </div>
                              ) : null}

                              {applicationPremiumPaymentError ? (
                                <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{applicationPremiumPaymentError}</p>
                              ) : null}

                              <div className="le-actions" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setApplicationPremiumPaymentError("");
                                    setApplicationPremiumPaymentFieldErrors({});
                                    setApplicationPremiumPaymentForm((f) => ({
                                      ...f,
                                      totalAnnualPremiumPhp: "",
                                      totalFrequencyPremiumPhp: "",
                                      methodForInitialPayment: "",
                                      methodForRenewalPayment: "",
                                      paymentProofImageDataUrl: "",
                                      paymentProofFileName: "",
                                      savedAt: "",
                                    }));
                                    setApplicationPaymentProofInputKey((k) => k + 1);
                                  }}
                                  disabled={applicationPremiumPaymentSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitApplicationPremiumPaymentTransfer}
                                  disabled={applicationPremiumPaymentSaving}
                                >
                                  {applicationPremiumPaymentSaving ? "Saving..." : "Save Premium Payment Transfer"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}

                      {isApplicationSubmissionViewed && hasSavedApplicationAttendance && hasSavedApplicationPremiumPaymentTransfer ? (
                        <div className="le-block">
                          <h4 className="le-blockTitle">{hasSavedApplicationSubmission ? "Application Submission Details" : "Record Application Submission"}</h4>

                          {hasSavedApplicationSubmission ? (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">PRUOnePH Transaction ID</label>
                                <p className="le-smallNote">{applicationSubmissionForm.pruOneTransactionId || "—"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Submission Screenshot</label>
                                <p className="le-smallNote">{applicationSubmissionForm.submissionScreenshotFileName || "Uploaded image"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Preview</label>
                                <img
                                  src={applicationSubmissionForm.submissionScreenshotImageDataUrl}
                                  alt="Application submission screenshot preview"
                                  style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">PRUOnePH Transaction ID *</label>
                                <input
                                  className="le-input"
                                  value={applicationSubmissionForm.pruOneTransactionId}
                                  onChange={(e) => {
                                    setApplicationSubmissionForm((f) => ({ ...f, pruOneTransactionId: e.target.value }));
                                    setApplicationSubmissionFieldErrors((prev) => ({ ...prev, pruOneTransactionId: "" }));
                                  }}
                                  disabled={applicationSubmissionSaving}
                                />
                                {applicationSubmissionFieldErrors.pruOneTransactionId ? (
                                  <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{applicationSubmissionFieldErrors.pruOneTransactionId}</p>
                                ) : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Submission Screenshot (JPG, JPEG, PNG) *</label>
                                <input
                                  key={applicationSubmissionScreenshotInputKey}
                                  type="file"
                                  className="le-input"
                                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                                  onChange={(e) => onApplicationSubmissionScreenshotPicked(e.target.files?.[0] || null)}
                                  disabled={applicationSubmissionSaving}
                                />
                                {applicationSubmissionForm.submissionScreenshotFileName ? (
                                  <p className="le-smallNote">Selected file: {applicationSubmissionForm.submissionScreenshotFileName}</p>
                                ) : null}
                                {applicationSubmissionFieldErrors.submissionScreenshotImageDataUrl ? (
                                  <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 6 }}>{applicationSubmissionFieldErrors.submissionScreenshotImageDataUrl}</p>
                                ) : null}
                              </div>

                              {String(applicationSubmissionForm.submissionScreenshotImageDataUrl || "").trim() ? (
                                <div className="le-formRow">
                                  <label className="le-label">Preview</label>
                                  <img
                                    src={applicationSubmissionForm.submissionScreenshotImageDataUrl}
                                    alt="Application submission screenshot preview"
                                    style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                  />
                                </div>
                              ) : null}

                              {applicationSubmissionError ? (
                                <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{applicationSubmissionError}</p>
                              ) : null}

                              <div className="le-actions" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setApplicationSubmissionError("");
                                    setApplicationSubmissionFieldErrors({});
                                    setApplicationSubmissionForm({
                                      pruOneTransactionId: "",
                                      submissionScreenshotImageDataUrl: "",
                                      submissionScreenshotFileName: "",
                                      savedAt: "",
                                    });
                                    setApplicationSubmissionScreenshotInputKey((k) => k + 1);
                                  }}
                                  disabled={applicationSubmissionSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitApplicationSubmission}
                                  disabled={applicationSubmissionSaving}
                                >
                                  {applicationSubmissionSaving ? "Saving..." : "Save Application Submission"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}



                  {showPolicyIssuancePanel && (
                    <>
                      {isPolicyStatusViewed && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">{hasSavedPolicyApplicationStatus ? "Policy Application Status Details" : "Record Policy Application Status"}</h4>

                          {hasSavedPolicyApplicationStatus ? (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Policy Application Status</label>
                                <p className="le-smallNote">{policyStatusForm.status}</p>
                              </div>
                              {policyStatusForm.status === "Issued" ? (
                                <div className="le-formRow">
                                  <label className="le-label">Issuance Date</label>
                                  <p className="le-smallNote">{policyStatusForm.issuanceDate || "—"}</p>
                                </div>
                              ) : null}
                              {String(policyStatusForm.notes || "").trim() ? (
                                <div className="le-formRow">
                                  <label className="le-label">Notes</label>
                                  <p className="le-smallNote">{policyStatusForm.notes}</p>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Policy Application Status *</label>
                                <select
                                  className={`le-input ${policyStatusFieldErrors.status ? "error" : ""}`}
                                  value={policyStatusForm.status}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setPolicyStatusForm((f) => ({ ...f, status: v, issuanceDate: v === "Issued" ? f.issuanceDate : "" }));
                                    setPolicyStatusFieldErrors((prev) => ({ ...prev, status: "", issuanceDate: "" }));
                                  }}
                                  disabled={policyStatusSaving}
                                >
                                  <option value="">Select</option>
                                  <option value="Issued">Issued</option>
                                  <option value="Declined">Declined</option>
                                </select>
                                {policyStatusFieldErrors.status ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyStatusFieldErrors.status}</p> : null}
                              </div>

                              {policyStatusForm.status === "Issued" ? (
                                <div className="le-formRow">
                                  <label className="le-label">Issuance Date *</label>
                                  <input
                                    type="date"
                                    className={`le-input ${policyStatusFieldErrors.issuanceDate ? "error" : ""}`}
                                    value={policyStatusForm.issuanceDate}
                                    onChange={(e) => {
                                      setPolicyStatusForm((f) => ({ ...f, issuanceDate: e.target.value }));
                                      setPolicyStatusFieldErrors((prev) => ({ ...prev, issuanceDate: "" }));
                                    }}
                                    min={applicationSubmissionSavedDateInput || undefined}
                                    max={todayDateInput}
                                    disabled={policyStatusSaving}
                                  />
                                  {policyStatusFieldErrors.issuanceDate ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyStatusFieldErrors.issuanceDate}</p> : null}
                                </div>
                              ) : null}

                              <div className="le-formRow">
                                <label className="le-label">Notes (Optional)</label>
                                <textarea
                                  className="le-input"
                                  rows={3}
                                  value={policyStatusForm.notes}
                                  onChange={(e) => setPolicyStatusForm((f) => ({ ...f, notes: e.target.value }))}
                                  disabled={policyStatusSaving}
                                />
                              </div>

                              {policyStatusError ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyStatusError}</p> : null}

                              <div className="le-actions" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setPolicyStatusError("");
                                    setPolicyStatusFieldErrors({});
                                    setPolicyStatusForm({ status: "", issuanceDate: "", notes: "", savedAt: "" });
                                  }}
                                  disabled={policyStatusSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitPolicyApplicationStatus}
                                  disabled={policyStatusSaving}
                                >
                                  {policyStatusSaving ? "Saving..." : "Save Policy Application Status"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {isPolicyInitialEorViewed && hasSavedPolicyApplicationStatus && policyStatusForm.status === "Issued" ? (
                        <div className="le-block">
                          <h4 className="le-blockTitle">{hasSavedPolicyInitialPremiumEor ? "Initial Premium eOR Details" : "Upload Initial Premium eOR"}</h4>

                          <div className="le-formRow">
                            <label className="le-label">Method of Initial Payment</label>
                            <p className="le-smallNote">{initialPaymentMethodFromApplication || "—"}</p>
                          </div>
                          <div className="le-formRow">
                            <label className="le-label">{`${totalFrequencyPremiumLabel.replace("(in Php)", "")} Payment (Php)`}</label>
                            <p className="le-smallNote">{applicationPremiumPaymentForm.totalFrequencyPremiumPhp || "—"}</p>
                          </div>

                          {hasSavedPolicyInitialPremiumEor ? (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">eOR Number</label>
                                <p className="le-smallNote">{policyInitialEorForm.eorNumber || "—"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Receipt Date</label>
                                <p className="le-smallNote">{policyInitialEorForm.receiptDate || "—"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Uploaded eOR File</label>
                                <p className="le-smallNote">{policyInitialEorForm.eorFileName || "eOR.pdf"}</p>
                              </div>
                              {policyInitialEorForm.eorFileDataUrl ? (
                                <div className="le-formRow">
                                  <label className="le-label">Preview</label>
                                  <iframe
                                    title="Initial Premium eOR Preview"
                                    src={policyInitialEorForm.eorFileDataUrl}
                                    style={{ width: "100%", minHeight: 320, border: "1px solid #e5e7eb", borderRadius: 10 }}
                                  />
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">eOR Number *</label>
                                <input
                                  className="le-input"
                                  value={policyInitialEorForm.eorNumber}
                                  onChange={(e) => {
                                    setPolicyInitialEorForm((f) => ({ ...f, eorNumber: e.target.value }));
                                    setPolicyInitialEorFieldErrors((prev) => ({ ...prev, eorNumber: "" }));
                                  }}
                                  disabled={policyInitialEorSaving}
                                />
                                {policyInitialEorFieldErrors.eorNumber ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyInitialEorFieldErrors.eorNumber}</p> : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Receipt Date *</label>
                                <input
                                  type="date"
                                  className={`le-input ${policyInitialEorFieldErrors.receiptDate ? "error" : ""}`}
                                  value={policyInitialEorForm.receiptDate}
                                  onChange={(e) => {
                                    setPolicyInitialEorForm((f) => ({ ...f, receiptDate: e.target.value }));
                                    setPolicyInitialEorFieldErrors((prev) => ({ ...prev, receiptDate: "" }));
                                  }}
                                  min={applicationSubmissionSavedDateInput || undefined}
                                  max={policyStatusForm.issuanceDate || todayDateInput}
                                  disabled={policyInitialEorSaving}
                                />
                                {policyInitialEorFieldErrors.receiptDate ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyInitialEorFieldErrors.receiptDate}</p> : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Upload eOR (PDF) *</label>
                                <input
                                  key={policyInitialEorInputKey}
                                  type="file"
                                  className="le-input"
                                  accept="application/pdf,.pdf"
                                  onChange={(e) => onPolicyInitialEorPicked(e.target.files?.[0] || null)}
                                  disabled={policyInitialEorSaving}
                                />
                                {policyInitialEorForm.eorFileName ? <p className="le-smallNote">Selected file: {policyInitialEorForm.eorFileName}</p> : null}
                                {policyInitialEorFieldErrors.eorFileDataUrl ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyInitialEorFieldErrors.eorFileDataUrl}</p> : null}
                              </div>

                              {policyInitialEorForm.eorFileDataUrl ? (
                                <div className="le-formRow">
                                  <label className="le-label">Preview</label>
                                  <iframe
                                    title="Initial Premium eOR Preview"
                                    src={policyInitialEorForm.eorFileDataUrl}
                                    style={{ width: "100%", minHeight: 320, border: "1px solid #e5e7eb", borderRadius: 10 }}
                                  />
                                </div>
                              ) : null}

                              {policyInitialEorError ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyInitialEorError}</p> : null}

                              <div className="le-actions" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setPolicyInitialEorError("");
                                    setPolicyInitialEorFieldErrors({});
                                    setPolicyInitialEorForm({ eorNumber: "", receiptDate: "", eorFileDataUrl: "", eorFileName: "", uploadedAt: "" });
                                    setPolicyInitialEorInputKey((k) => k + 1);
                                  }}
                                  disabled={policyInitialEorSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitPolicyInitialEor}
                                  disabled={policyInitialEorSaving}
                                >
                                  {policyInitialEorSaving ? "Saving..." : "Save Initial Premium eOR"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}


                      {isPolicySummaryViewed && hasSavedPolicyInitialPremiumEor ? (
                        <div className="le-block">
                          <h4 className="le-blockTitle">{hasSavedPolicySummary ? "Policy Summary Details" : "Upload Policy Summary"}</h4>

                          {hasSavedPolicySummary ? (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Policy Number</label>
                                <p className="le-smallNote">{policySummaryForm.policyNumber || "—"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Policy Summary File</label>
                                <p className="le-smallNote">{policySummaryForm.policySummaryFileName || "PolicySummary.pdf"}</p>
                              </div>
                              {policySummaryForm.policySummaryFileDataUrl ? (
                                <div className="le-formRow">
                                  <label className="le-label">Preview</label>
                                  <iframe
                                    title="Policy Summary Preview"
                                    src={policySummaryForm.policySummaryFileDataUrl}
                                    style={{ width: "100%", minHeight: 320, border: "1px solid #e5e7eb", borderRadius: 10 }}
                                  />
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Policy Number (8 digits) *</label>
                                <input
                                  className={`le-input ${policySummaryFieldErrors.policyNumber ? "error" : ""}`}
                                  value={policySummaryForm.policyNumber}
                                  onChange={(e) => {
                                    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                                    setPolicySummaryForm((f) => ({ ...f, policyNumber: v }));
                                    setPolicySummaryFieldErrors((prev) => ({ ...prev, policyNumber: "" }));
                                  }}
                                  inputMode="numeric"
                                  maxLength={8}
                                  disabled={policySummarySaving}
                                />
                                {policySummaryFieldErrors.policyNumber ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policySummaryFieldErrors.policyNumber}</p> : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Upload Policy Summary (PDF) *</label>
                                <input
                                  key={policySummaryInputKey}
                                  type="file"
                                  className="le-input"
                                  accept="application/pdf,.pdf"
                                  onChange={(e) => onPolicySummaryPicked(e.target.files?.[0] || null)}
                                  disabled={policySummarySaving}
                                />
                                {policySummaryForm.policySummaryFileName ? <p className="le-smallNote">Selected file: {policySummaryForm.policySummaryFileName}</p> : null}
                                {policySummaryFieldErrors.policySummaryFileDataUrl ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policySummaryFieldErrors.policySummaryFileDataUrl}</p> : null}
                              </div>

                              {policySummaryForm.policySummaryFileDataUrl ? (
                                <div className="le-formRow">
                                  <label className="le-label">Preview</label>
                                  <iframe
                                    title="Policy Summary Preview"
                                    src={policySummaryForm.policySummaryFileDataUrl}
                                    style={{ width: "100%", minHeight: 320, border: "1px solid #e5e7eb", borderRadius: 10 }}
                                  />
                                </div>
                              ) : null}

                              {policySummaryError ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policySummaryError}</p> : null}

                              <div className="le-actions" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setPolicySummaryError("");
                                    setPolicySummaryFieldErrors({});
                                    setPolicySummaryForm({ policyNumber: "", policySummaryFileDataUrl: "", policySummaryFileName: "", uploadedAt: "" });
                                    setPolicySummaryInputKey((k) => k + 1);
                                  }}
                                  disabled={policySummarySaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitPolicySummary}
                                  disabled={policySummarySaving}
                                >
                                  {policySummarySaving ? "Saving..." : "Save Policy Summary"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}


                      {isPolicyCoverageViewed && hasSavedPolicySummary ? (
                        <div className="le-block">
                          <h4 className="le-blockTitle">{hasSavedPolicyCoverageDetails ? "Coverage Duration Details" : "Record Coverage Duration Details"}</h4>

                          <div className="le-formRow">
                            <label className="le-label">Product Name</label>
                            <p className="le-smallNote">{policyChosenProduct?.productName || "—"}</p>
                          </div>

                          <div className="le-grid2" style={{ gap: 12 }}>
                            <div className="le-formRow">
                              <label className="le-label">Policy Issuance Date</label>
                              <p className="le-smallNote">{policyStatusForm.issuanceDate || "—"}</p>
                            </div>
                            <div className="le-formRow">
                              <label className="le-label">Policy End Date</label>
                              <p className="le-smallNote">{computedPolicyEndDate || policyCoverageForm.policyEndDate || "—"}</p>
                              {policyCoverageFieldErrors.policyEndDate ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyCoverageFieldErrors.policyEndDate}</p> : null}
                            </div>
                          </div>

                          {hasSavedPolicyCoverageDetails ? (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Selected Payment Term</label>
                                <p className="le-smallNote">{policyCoverageForm.selectedPaymentTermLabel || "—"}</p>
                              </div>
                              {String(policyCoverageForm.selectedPaymentTermType || "").trim() ? (
                                <div className="le-formRow">
                                  <label className="le-label">Selected Payment Term Type</label>
                                  <p className="le-smallNote">{policyCoverageForm.selectedPaymentTermType}</p>
                                </div>
                              ) : null}
                              {policyCoverageForm.selectedPaymentTermYears !== "" && policyCoverageForm.selectedPaymentTermYears !== null && policyCoverageForm.selectedPaymentTermYears !== undefined ? (
                                <div className="le-formRow">
                                  <label className="le-label">Selected Payment Term Years</label>
                                  <p className="le-smallNote">{policyCoverageForm.selectedPaymentTermYears}</p>
                                </div>
                              ) : null}
                              {policyCoverageForm.selectedPaymentTermUntilAge !== "" && policyCoverageForm.selectedPaymentTermUntilAge !== null && policyCoverageForm.selectedPaymentTermUntilAge !== undefined ? (
                                <div className="le-formRow">
                                  <label className="le-label">Payment Term Until Age</label>
                                  <p className="le-smallNote">{policyCoverageForm.selectedPaymentTermUntilAge}</p>
                                </div>
                              ) : null}
                              <div className="le-formRow">
                                <label className="le-label">Next Payment Date</label>
                                <p className="le-smallNote">{policyCoverageForm.nextPaymentDate || computedNextPaymentDate || "Not applicable"}</p>
                              </div>
                              <div className="le-formRow">
                                <label className="le-label">Coverage Duration</label>
                                <p className="le-smallNote">{policyCoverageForm.coverageDurationLabel || "—"}</p>
                              </div>
                              {String(policyCoverageForm.coverageDurationType || "").trim() ? (
                                <div className="le-formRow">
                                  <label className="le-label">Coverage Duration Type</label>
                                  <p className="le-smallNote">{policyCoverageForm.coverageDurationType}</p>
                                </div>
                              ) : null}
                              {policyCoverageForm.coverageDurationYears !== "" && policyCoverageForm.coverageDurationYears !== null && policyCoverageForm.coverageDurationYears !== undefined ? (
                                <div className="le-formRow">
                                  <label className="le-label">Coverage Duration Years</label>
                                  <p className="le-smallNote">{policyCoverageForm.coverageDurationYears}</p>
                                </div>
                              ) : null}
                              {policyCoverageForm.coverageDurationUntilAge !== "" && policyCoverageForm.coverageDurationUntilAge !== null && policyCoverageForm.coverageDurationUntilAge !== undefined ? (
                                <div className="le-formRow">
                                  <label className="le-label">Coverage Duration Until Age</label>
                                  <p className="le-smallNote">{policyCoverageForm.coverageDurationUntilAge}</p>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Payment Term *</label>
                                {policyPaymentTermOptions.length > 1 ? (
                                  <select
                                    className={`le-input ${policyCoverageFieldErrors.selectedPaymentTermLabel ? "error" : ""}`}
                                    value={policyCoverageForm.selectedPaymentTermLabel}
                                    onChange={(e) => {
                                      const picked = policyPaymentTermOptions.find((opt) => opt.label === e.target.value) || null;
                                      setPolicyCoverageForm((f) => ({
                                        ...f,
                                        selectedPaymentTermLabel: picked?.label || "",
                                        selectedPaymentTermType: picked?.type || "",
                                        selectedPaymentTermYears: picked?.years ?? "",
                                        selectedPaymentTermUntilAge: picked?.type === "RANGE_TO_AGE" ? "" : (picked?.untilAge ?? ""),
                                      }));
                                      setPolicyCoverageFieldErrors((prev) => ({ ...prev, selectedPaymentTermLabel: "", selectedPaymentTermUntilAge: "" }));
                                    }}
                                    disabled={policyCoverageSaving}
                                  >
                                    <option value="">Select payment term</option>
                                    {policyPaymentTermOptions.map((opt) => (
                                      <option key={`${opt.label}-${opt.type}-${opt.years || ""}-${opt.untilAge || ""}`} value={opt.label}>{opt.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <p className="le-smallNote">{policyPaymentTermOptions[0]?.label || policyChosenProduct?.paymentTermLabel || "—"}</p>
                                )}
                                {policyCoverageFieldErrors.selectedPaymentTermLabel ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyCoverageFieldErrors.selectedPaymentTermLabel}</p> : null}
                              </div>

                              {policyCoverageForm.selectedPaymentTermType === "RANGE_TO_AGE" ? (
                                <div className="le-formRow">
                                  <label className="le-label">Payment Term Until Age *</label>
                                  <select
                                    className={`le-input ${policyCoverageFieldErrors.selectedPaymentTermUntilAge ? "error" : ""}`}
                                    value={policyCoverageForm.selectedPaymentTermUntilAge}
                                    onChange={(e) => {
                                      setPolicyCoverageForm((f) => ({ ...f, selectedPaymentTermUntilAge: e.target.value }));
                                      setPolicyCoverageFieldErrors((prev) => ({ ...prev, selectedPaymentTermUntilAge: "" }));
                                    }}
                                    disabled={policyCoverageSaving}
                                  >
                                    <option value="">Select age</option>
                                    {policyAgeRangeOptions.map((age) => (
                                      <option key={`pt-age-${age}`} value={age}>{age}</option>
                                    ))}
                                  </select>
                                  {policyCoverageFieldErrors.selectedPaymentTermUntilAge ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyCoverageFieldErrors.selectedPaymentTermUntilAge}</p> : null}
                                </div>
                              ) : null}

                              <div className="le-formRow">
                                <label className="le-label">Next Payment Date</label>
                                <p className="le-smallNote">{policyCoverageForm.nextPaymentDate || computedNextPaymentDate || "Not applicable"}</p>
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Coverage Duration</label>
                                <p className="le-smallNote">{policyCoverageRule?.label || policyCoverageForm.coverageDurationLabel || "—"}</p>
                                {policyCoverageFieldErrors.coverageDurationLabel ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyCoverageFieldErrors.coverageDurationLabel}</p> : null}
                              </div>

                              {policyCoverageRule?.type === "RANGE_TO_AGE" ? (
                                <div className="le-formRow">
                                  <label className="le-label">Coverage Until Age *</label>
                                  <select
                                    className={`le-input ${policyCoverageFieldErrors.coverageDurationUntilAge ? "error" : ""}`}
                                    value={policyCoverageForm.coverageDurationUntilAge}
                                    onChange={(e) => {
                                      setPolicyCoverageForm((f) => ({ ...f, coverageDurationUntilAge: e.target.value }));
                                      setPolicyCoverageFieldErrors((prev) => ({ ...prev, coverageDurationUntilAge: "" }));
                                    }}
                                    disabled={policyCoverageSaving}
                                  >
                                    <option value="">Select age</option>
                                    {policyAgeRangeOptions.map((age) => (
                                      <option key={`cd-age-${age}`} value={age}>{age}</option>
                                    ))}
                                  </select>
                                  {policyCoverageFieldErrors.coverageDurationUntilAge ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyCoverageFieldErrors.coverageDurationUntilAge}</p> : null}
                                </div>
                              ) : null}

                              {policyCoverageError ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{policyCoverageError}</p> : null}

                              <div className="le-actions" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setPolicyCoverageError("");
                                    setPolicyCoverageFieldErrors({});
                                    setPolicyCoverageForm((f) => ({
                                      ...f,
                                      selectedPaymentTermLabel: "",
                                      selectedPaymentTermType: "",
                                      selectedPaymentTermYears: "",
                                      selectedPaymentTermUntilAge: "",
                                      coverageDurationLabel: String(policyCoverageRule?.label || ""),
                                      coverageDurationType: String(policyCoverageRule?.type || ""),
                                      coverageDurationYears: policyCoverageRule?.type === "FIXED_YEARS" ? String(policyCoverageRule?.years ?? "") : "",
                                      coverageDurationUntilAge: policyCoverageRule?.type === "UNTIL_AGE" ? String(policyCoverageRule?.untilAge ?? "") : "",
                                      policyEndDate: "",
                                      savedAt: "",
                                    }));
                                  }}
                                  disabled={policyCoverageSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitPolicyCoverageDetails}
                                  disabled={policyCoverageSaving}
                                >
                                  {policyCoverageSaving ? "Saving..." : "Save Coverage Duration Details"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}

                  {showContactingPanel && isAttemptContactViewed && (
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

                            <div className="le-activitySectionHeader">
                              {editingAttemptId ? "Edit Contact Attempt" : "1. Attempt Contact"}
                            </div>

                            <div className="le-formRow">
                              <label className="le-label">Attempt No.</label>
                              <input
                                className="le-input"
                                value={editingAttemptId ? `#${attempts.find((a) => a.attemptId === editingAttemptId)?.attemptNo || "—"}` : `#${nextAttemptNo}`}
                                disabled
                              />
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

                            <div className="le-actions">
                              <button type="button" className="le-btn secondary" onClick={onCancelAddAttempt} disabled={addingAttempt}>
                                Cancel
                              </button>
                              <button type="button" className="le-btn primary" onClick={onSubmitAttempt} disabled={addingAttempt}>
                                {addingAttempt ? "Saving..." : editingAttemptId ? "Save Changes" : "Save"}
                              </button>
                            </div>
                          </div>
                        )}

                        {!showAddAttempt && !editingAttemptId && (
                          <div className="le-attemptList">
                            {attempts.map((a) => {
                              return (
                                <div key={a.attemptNo} className="le-attemptItem">
                                <div className="le-attemptTop">
                                  <strong>Attempt #{a.attemptNo}</strong>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span className="le-attemptDate">{formatDateTime(a.attemptedAt)}</span>
                                    {!isContactingReadOnly &&
                                    !isLeadClosed &&
                                    !isLeadDropped &&
                                    String(a.attemptId || "").trim() &&
                                    String(lastAttempt?.attemptId || "") === String(a.attemptId || "") ? (
                                      <button
                                        type="button"
                                        className="le-btn secondary"
                                        style={{ padding: "4px 8px" }}
                                        onClick={() => onOpenEditAttempt(a)}
                                        disabled={addingAttempt}
                                        title="Edit latest contact attempt"
                                      >
                                        <FaEdit style={{ marginRight: 6 }} />
                                        Edit
                                      </button>
                                    ) : null}
                                  </div>
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
                                </div>

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
                        )}
                      </div>
                    </>
                  )}

                  {showContactingPanel && !showAddAttempt && isValidateContactViewed && isEngagementBlocked && (
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

                      {showContactingPanel && !showAddAttempt && isValidateContactViewed && !isEngagementBlocked && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Validate Contact</h4>

                          {isValidateContactEditable ? (
                            <>
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
                                    setValidateFieldErrors((prev) => ({ ...prev, phoneValidation: "" }));
                                  }}
                                  disabled={validatingContact || uiLocked || isContactingReadOnly}
                                >
                                  <option value="">Select</option>
                                  <option value="CORRECT">Correct</option>
                                  <option value="WRONG_CONTACT">Wrong</option>
                                </select>
                                {validateFieldErrors.phoneValidation ? (
                                  <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                    {validateFieldErrors.phoneValidation}
                                  </div>
                                ) : null}
                              </div>

                              <div className="le-actions">
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setValidateForm({ phoneValidation: "" });
                                    setValidateError("");
                                    setValidateFieldErrors({});
                                  }}
                                  disabled={validatingContact || uiLocked || isContactingReadOnly}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={() => submitValidateContact()}
                                  disabled={validatingContact || uiLocked || isContactingReadOnly}
                                >
                                  {validatingContact ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </>
                          ) : savedPhoneValidationResult ? (
                            <>
                              <div className="le-attemptTop" style={{ marginTop: 8, alignItems: "center" }}>
                                <div>
                                  <span className="le-metaLabel">Phone Number Correct?</span>
                                  <span className="le-metaValue">{savedPhoneValidationResult === "CORRECT" ? "Correct" : "Wrong"}</span>
                                </div>

                                {savedPhoneValidationResult === "CORRECT" &&
                                isValidateContactEditable &&
                                !validatingContact &&
                                !isEngagementBlocked &&
                                !isLeadClosed &&
                                !isLeadDropped ? (
                                  <button
                                    type="button"
                                    className="le-btn secondary"
                                    style={{ padding: "4px 8px" }}
                                    onClick={() => submitValidateContact("WRONG_CONTACT")}
                                    disabled={validatingContact}
                                    title="Mark as Wrong Contact"
                                  >
                                    <FaEdit style={{ marginRight: 6 }} />
                                    Mark as Wrong Contact
                                  </button>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <p className="le-muted" style={{ marginTop: 8 }}>
                              No saved validation result yet.
                            </p>
                          )}
                        </div>
                      )}

                      {showContactingPanel && !showAddAttempt && isAssessInterestViewed && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Assess Interest</h4>

                          {isAssessInterestEditable ? (
                            <>
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
                                    {
                                      setInterestForm((f) => ({
                                        ...f,
                                        interestLevel: e.target.value,
                                        preferredChannel: "",
                                        preferredChannelOther: "",
                                      }));
                                      setInterestFieldErrors((prev) => ({
                                        ...prev,
                                        interestLevel: "",
                                        preferredChannel: "",
                                        preferredChannelOther: "",
                                      }));
                                    }
                                  }
                                  disabled={savingInterest}
                                >
                                  <option value="">Select</option>
                                  <option value="INTERESTED">Interested</option>
                                  <option value="NOT_INTERESTED">Not Interested</option>
                                </select>
                                {interestFieldErrors.interestLevel ? (
                                  <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                    {interestFieldErrors.interestLevel}
                                  </div>
                                ) : null}
                              </div>

                              {interestForm.interestLevel === "INTERESTED" && (
                                <>
                                  <div className="le-formRow">
                                    <label className="le-label">Preferred Communication Channel *</label>
                                    <select
                                      className="le-input"
                                      value={interestForm.preferredChannel}
                                      onChange={(e) => {
                                        setInterestForm((f) => ({ ...f, preferredChannel: e.target.value }));
                                        setInterestFieldErrors((prev) => ({
                                          ...prev,
                                          preferredChannel: "",
                                          preferredChannelOther: "",
                                        }));
                                      }}
                                      disabled={savingInterest}
                                    >
                                      <option value="">Select</option>
                                      <option value="SMS">SMS</option>
                                      <option value="WhatsApp">WhatsApp</option>
                                      <option value="Viber">Viber</option>
                                      <option value="Telegram">Telegram</option>
                                      <option value="Other">Other</option>
                                    </select>
                                    {interestFieldErrors.preferredChannel ? (
                                      <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                        {interestFieldErrors.preferredChannel}
                                      </div>
                                    ) : null}
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
                                      {interestFieldErrors.preferredChannelOther ? (
                                        <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                          {interestFieldErrors.preferredChannelOther}
                                        </div>
                                      ) : null}
                                    </div>
                                  )}
                                </>
                              )}

                              <div className="le-actions">
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() =>
                                    {
                                      setInterestForm({ interestLevel: "", preferredChannel: "", preferredChannelOther: "" });
                                      setInterestFieldErrors({});
                                    }
                                  }
                                  disabled={savingInterest}
                                >
                                  Cancel
                                </button>
                                <button type="button" className="le-btn primary" onClick={submitAssessInterest} disabled={savingInterest}>
                                  {savingInterest ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </>
                          ) : savedInterestLevel ? (
                            <>
                              <div className="le-attemptTop" style={{ marginTop: 8, alignItems: "center" }}>
                                <div>
                                  <span className="le-metaLabel">Interest Level</span>
                                  <span className="le-metaValue">{savedInterestLevel}</span>
                                </div>

                                {savedInterestLevel === "INTERESTED" &&
                                isContactingCurrentViewEditable &&
                                !savingInterest &&
                                !isEngagementBlocked &&
                                !isLeadClosed &&
                                !isLeadDropped ? (
                                  <button
                                    type="button"
                                    className="le-btn secondary"
                                    style={{ padding: "4px 8px" }}
                                    onClick={requestMarkAsNotInterested}
                                    disabled={savingInterest}
                                    title="Mark as Not Interested"
                                  >
                                    <FaEdit style={{ marginRight: 6 }} />
                                    Mark as Not Interested
                                  </button>
                                ) : null}
                              </div>
                              <div className="le-attemptMeta" style={{ marginTop: 8 }}>
                                {String(lastAttempt?.preferredChannel || "").trim() ? (
                                  <div>
                                    <span className="le-metaLabel">Preferred Communication Channel</span>
                                    <span className="le-metaValue">{lastAttempt.preferredChannel}</span>
                                  </div>
                                ) : null}
                                {String(lastAttempt?.preferredChannelOther || "").trim() ? (
                                  <div>
                                    <span className="le-metaLabel">Preferred Channel (Other)</span>
                                    <span className="le-metaValue">{lastAttempt.preferredChannelOther}</span>
                                  </div>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <p className="le-muted" style={{ marginTop: 8 }}>
                              No saved interest assessment yet.
                            </p>
                          )}
                        </div>
                      )}

                      {showContactingPanel && !showAddAttempt && isScheduleMeetingViewed && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Schedule Meeting</h4>

                          {isScheduleMeetingEditable ? (
                            <>
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
                                {meetingFieldErrors.meetingDate ? (
                                  <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                    {meetingFieldErrors.meetingDate}
                                  </div>
                                ) : null}
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
                                {meetingFieldErrors.meetingDurationMin ? (
                                  <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                    {meetingFieldErrors.meetingDurationMin}
                                  </div>
                                ) : null}
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
                                  {contactingMeetingStartSlots.map((slot) => {
                                    const booked = isSlotBooked(meetingForm.meetingDate, slot, meetingForm.meetingDurationMin);
                                    return (
                                      <option key={slot} value={slot} disabled={booked}>
                                        {formatTimeLabel(slot)}{booked ? " (Booked)" : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                                {meetingFieldErrors.meetingStartTime ? (
                                  <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                    {meetingFieldErrors.meetingStartTime}
                                  </div>
                                ) : null}
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
                                {meetingFieldErrors.meetingMode ? (
                                  <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                    {meetingFieldErrors.meetingMode}
                                  </div>
                                ) : null}
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
                                    {meetingFieldErrors.meetingPlatform ? (
                                      <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                        {meetingFieldErrors.meetingPlatform}
                                      </div>
                                    ) : null}
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
                                      {meetingFieldErrors.meetingPlatformOther ? (
                                        <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                          {meetingFieldErrors.meetingPlatformOther}
                                        </div>
                                      ) : null}
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
                                    {meetingFieldErrors.meetingLink ? (
                                      <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                        {meetingFieldErrors.meetingLink}
                                      </div>
                                    ) : null}
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
                                    {meetingFieldErrors.meetingInviteSent ? (
                                      <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                        {meetingFieldErrors.meetingInviteSent}
                                      </div>
                                    ) : null}
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
                                  {meetingFieldErrors.meetingPlace ? (
                                    <div className="le-formError" style={{ color: "#DA291C", marginTop: 6 }}>
                                      {meetingFieldErrors.meetingPlace}
                                    </div>
                                  ) : null}
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
                            </>
                          ) : hasSavedContactMeeting ? (
                            <div className="le-attemptMeta" style={{ marginTop: 8 }}>
                              {lastAttempt?.meetingAt ? <div><span className="le-metaLabel">Meeting Date & Time</span><span className="le-metaValue">{formatDateTime(lastAttempt.meetingAt)}</span></div> : null}
                              {Number(lastAttempt?.meetingDurationMin || 0) > 0 ? <div><span className="le-metaLabel">Meeting Duration</span><span className="le-metaValue">{lastAttempt.meetingDurationMin} mins</span></div> : null}
                              {lastAttempt?.meetingEndAt ? <div><span className="le-metaLabel">Meeting Ends</span><span className="le-metaValue">{formatDateTime(lastAttempt.meetingEndAt)}</span></div> : null}
                              {String(lastAttempt?.meetingMode || "").trim() ? <div><span className="le-metaLabel">Meeting Mode</span><span className="le-metaValue">{lastAttempt.meetingMode}</span></div> : null}
                              {String(lastAttempt?.meetingPlatform || "").trim() ? <div><span className="le-metaLabel">Meeting Platform</span><span className="le-metaValue">{lastAttempt.meetingPlatform}</span></div> : null}
                              {String(lastAttempt?.meetingPlatformOther || "").trim() ? <div><span className="le-metaLabel">Meeting Platform (Other)</span><span className="le-metaValue">{lastAttempt.meetingPlatformOther}</span></div> : null}
                              {String(lastAttempt?.meetingLink || "").trim() ? <div><span className="le-metaLabel">Meeting Link</span><span className="le-metaValue">{lastAttempt.meetingLink}</span></div> : null}
                              {String(lastAttempt?.meetingMode || "").trim() === "Online" ? <div><span className="le-metaLabel">Meeting Invite Sent</span><span className="le-metaValue">{lastAttempt?.meetingInviteSent ? "Yes" : "No"}</span></div> : null}
                              {String(lastAttempt?.meetingPlace || "").trim() ? <div><span className="le-metaLabel">Meeting Place</span><span className="le-metaValue">{lastAttempt.meetingPlace}</span></div> : null}
                              {String(lastAttempt?.meetingStatus || "").trim() ? <div><span className="le-metaLabel">Status</span><span className="le-metaValue">{lastAttempt.meetingStatus}</span></div> : null}
                            </div>
                          ) : (
                            <p className="le-muted" style={{ marginTop: 8 }}>
                              No saved meeting schedule yet.
                            </p>
                          )}
                        </div>
                      )}

                      {showProposalPanel && isProposalGenerateViewed && (
                        <div className="le-block">
                          <h4 className="le-blockTitle">{proposalUiActivityKey === "Generate Proposal" ? "Generate Proposal" : "Saved Initial Quotation Proposal Details"}</h4>
                          {proposalUiActivityKey === "Generate Proposal" ? (
                            <p className="le-smallNote" style={{ marginBottom: 10 }}>
                              Complete this first before proceeding to proposal presentation.
                            </p>
                          ) : null}

                          <div className="le-attemptMeta">
                            {String(proposalGenerateForm.chosenProductName || proposalGenerateForm.chosenProductId || "").trim() ? (
                              <div>
                                <span className="le-metaLabel">Chosen Product</span>
                                <span className="le-metaValue">{proposalGenerateForm.chosenProductName || proposalGenerateForm.chosenProductId}</span>
                              </div>
                            ) : (
                              <div>
                                <span className="le-metaLabel">Chosen Product</span>
                                <span className="le-metaValue">No selected product found from Needs Assessment or Proposal data.</span>
                              </div>
                            )}
                            <div>
                              <span className="le-metaLabel">Product Description</span>
                              <span className="le-metaValue">{String(proposalGenerateForm.chosenProductDescription || "").trim() || "No product description available."}</span>
                            </div>
                            <div>
                              <span className="le-metaLabel">Proposal Generation Link</span>
                              <span className="le-metaValue">
                                <a href="https://pruone.prulifeuk.com.ph/web" target="_blank" rel="noreferrer">https://pruone.prulifeuk.com.ph/web</a>
                              </span>
                            </div>
                          </div>

                          {proposalUiActivityKey === "Generate Proposal" && isProposalEditableNow ? (
                            <>
                              <div className="le-formRow" style={{ marginTop: 12 }}>
                                <label className="le-label">Generated Proposal (PDF only) *</label>
                                <input
                                  key={proposalFileInputKey}
                                  type="file"
                                  className="le-input"
                                  accept="application/pdf,.pdf"
                                  onChange={(e) => onProposalPdfPicked(e.target.files?.[0] || null)}
                                  disabled={proposalGenerateSaving}
                                />
                                {proposalGenerateForm.proposalFileName ? (
                                  <p className="le-smallNote">Selected file: {proposalGenerateForm.proposalFileName}</p>
                                ) : null}
                                {proposalGenerateFieldErrors.proposalFile ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalGenerateFieldErrors.proposalFile}</p> : null}
                              </div>

                              {proposalGenerateForm.proposalFileDataUrl ? (
                                <div className="le-formRow">
                                  <label className="le-label">PDF Preview</label>
                                  <iframe
                                    title="Proposal PDF Preview"
                                    src={proposalGenerateForm.proposalFileDataUrl}
                                    style={{ width: "100%", minHeight: 420, border: "1px solid #e5e7eb", borderRadius: 10 }}
                                  />
                                </div>
                              ) : null}

                              <div className="le-formRow">
                                <label className="le-check">
                                  <input
                                    type="checkbox"
                                    checked={proposalGenerateForm.sentToProspectEmail}
                                    onChange={(e) => {
                                      setProposalGenerateForm((f) => ({ ...f, sentToProspectEmail: e.target.checked }));
                                      setProposalGenerateFieldErrors((prev) => ({ ...prev, sentToProspectEmail: "" }));
                                    }}
                                    disabled={proposalGenerateSaving}
                                  />
                                  <span>I confirm this proposal was sent to prospect's email ({prospect?.email || "no email provided"}). *</span>
                                </label>
                                {proposalGenerateFieldErrors.sentToProspectEmail ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{proposalGenerateFieldErrors.sentToProspectEmail}</p> : null}
                              </div>

                              <div className="le-actions">
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setProposalGenerateError("");
                                    setProposalGenerateFieldErrors({});
                                    setProposalGenerateForm((f) => ({
                                      ...f,
                                      proposalFileName: "",
                                      proposalFileMimeType: "",
                                      proposalFileDataUrl: "",
                                      sentToProspectEmail: false,
                                      sentToProspectAt: "",
                                      uploadedAt: "",
                                    }));
                                    setProposalFileInputKey((k) => k + 1);
                                  }}
                                  disabled={proposalGenerateSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitGenerateProposal}
                                  disabled={proposalGenerateSaving || !String(proposalGenerateForm.chosenProductId || "").trim()}
                                >
                                  {proposalGenerateSaving ? "Saving..." : "Complete Proposal Generation"}
                                </button>
                              </div>

                              {proposalGenerateError ? <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{proposalGenerateError}</p> : null}
                            </>
                          ) : (
                            <>
                              {String(proposalGenerateForm.proposalFileName || "").trim() ? (
                                <div className="le-formRow" style={{ marginTop: 10 }}>
                                  <label className="le-label">Initial Quotation Proposal File</label>
                                  <p className="le-smallNote">{proposalGenerateForm.proposalFileName}</p>
                                </div>
                              ) : null}
                              {proposalGenerateForm.proposalFileDataUrl ? (
                                <div className="le-formRow">
                                  <label className="le-label">PDF Preview</label>
                                  <iframe
                                    title="Generated Proposal Preview"
                                    src={proposalGenerateForm.proposalFileDataUrl}
                                    style={{ width: "100%", minHeight: 420, border: "1px solid #e5e7eb", borderRadius: 10 }}
                                  />
                                </div>
                              ) : null}
                              {proposalGenerateForm.uploadedAt ? (
                                <div className="le-formRow">
                                  <label className="le-label">Uploaded At</label>
                                  <p className="le-smallNote">{formatDateTime(proposalGenerateForm.uploadedAt)}</p>
                                </div>
                              ) : null}
                              <div className="le-formRow">
                                <label className="le-label">Sent to Prospect Email</label>
                                <p className="le-smallNote">{proposalGenerateForm.sentToProspectEmail ? `Yes (${prospect?.email || "no email provided"})` : "No"}</p>
                              </div>
                              {proposalGenerateForm.sentToProspectAt ? (
                                <div className="le-formRow">
                                  <label className="le-label">Sent At</label>
                                  <p className="le-smallNote">{formatDateTime(proposalGenerateForm.sentToProspectAt)}</p>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      )}

                      {showProposalPanel && isProposalAttendanceViewed ? (
                        <div className="le-block">
                          <h4 className="le-blockTitle">Prospect Attendance</h4>

                          {proposalUiActivityKey === "Record Prospect Attendance" && isProposalEditableNow ? (
                            <>
                              <div className="le-formRow" style={{ alignItems: "center" }}>
                                <label className="le-label">Prospect Attended? *</label>
                                <div className="le-checkboxGrid">
                                  <label className="le-check">
                                    <input
                                      type="radio"
                                      name="proposal-prospect-attendance"
                                      checked={proposalAttendanceForm.attendanceChoice === "YES"}
                                      onChange={() => {
                                        setProposalAttendanceError("");
                                        setProposalAttendanceForm((f) => ({ ...f, attendanceChoice: "YES" }));
                                      }}
                                      disabled={proposalAttendanceSaving}
                                    />
                                    <span>Yes</span>
                                  </label>
                                  <label className="le-check">
                                    <input
                                      type="radio"
                                      name="proposal-prospect-attendance"
                                      checked={proposalAttendanceForm.attendanceChoice === "NO"}
                                      onChange={() => {
                                        setProposalAttendanceError("");
                                        setProposalAttendanceForm((f) => ({
                                          ...f,
                                          attendanceChoice: "NO",
                                          attendanceProofImageDataUrl: "",
                                          attendanceProofFileName: "",
                                        }));
                                      }}
                                      disabled={proposalAttendanceSaving}
                                    />
                                    <span>No</span>
                                  </label>
                                </div>
                              </div>

                              {proposalAttendanceForm.attendanceChoice === "NO" ? (
                                <p className="le-muted" style={{ marginTop: 8 }}>
                                  Prospect attendance is required before proceeding to proposal presentation.
                                </p>
                              ) : null}

                              {proposalAttendanceForm.attendanceChoice === "YES" ? (
                                <>
                                  <div className="le-formRow" style={{ marginTop: 8 }}>
                                    <label className="le-label">Proof of Attendance (JPG, JPEG, PNG) *</label>
                                    <input
                                      type="file"
                                      className="le-input"
                                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                      onChange={(e) => onProposalAttendanceProofPicked(e.target.files?.[0] || null)}
                                      disabled={proposalAttendanceSaving}
                                    />
                                    {proposalAttendanceForm.attendanceProofFileName ? (
                                      <p className="le-smallNote">Selected file: {proposalAttendanceForm.attendanceProofFileName}</p>
                                    ) : null}
                                  </div>

                                  {String(proposalAttendanceForm.attendanceProofImageDataUrl || "").trim() ? (
                                    <div className="le-formRow">
                                      <label className="le-label">Preview</label>
                                      <img
                                        src={proposalAttendanceForm.attendanceProofImageDataUrl}
                                        alt="Proposal attendance proof preview"
                                        style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                      />
                                    </div>
                                  ) : null}
                                </>
                              ) : null}

                              {proposalAttendanceError ? <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{proposalAttendanceError}</p> : null}

                              <div className="le-actions">
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setProposalAttendanceError("");
                                    setProposalAttendanceForm({
                                      attendanceChoice: "",
                                      attendanceProofImageDataUrl: "",
                                      attendanceProofFileName: "",
                                      attendedAt: "",
                                    });
                                  }}
                                  disabled={proposalAttendanceSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitProposalAttendance}
                                  disabled={proposalAttendanceSaving}
                                >
                                  {proposalAttendanceSaving ? "Saving..." : "Save Prospect Attendance"}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="le-formRow" style={{ marginTop: 4 }}>
                                <label className="le-label">Prospect Attended?</label>
                                <p className="le-smallNote">{proposalAttendanceForm.attendanceChoice === "YES" ? "Yes" : proposalAttendanceForm.attendanceChoice === "NO" ? "No" : "—"}</p>
                              </div>
                              {String(proposalAttendanceForm.attendanceProofImageDataUrl || "").trim() ? (
                                <div className="le-formRow">
                                  <label className="le-label">Preview</label>
                                  <img
                                    src={proposalAttendanceForm.attendanceProofImageDataUrl}
                                    alt="Proposal attendance proof preview"
                                    style={{ maxWidth: 260, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                                  />
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}

                      {showProposalPanel && isProposalPresentationViewed ? (
                        <div className="le-block">
                          <h4 className="le-blockTitle">{isProposalPresentationEditable ? "Present Proposal" : "Proposal Presentation"}</h4>

                          {isProposalPresentationEditable ? (
                            <>
                              <div className="le-formRow" style={{ alignItems: "center" }}>
                                <label className="le-label">Proposal Accepted? *</label>
                                <div className="le-checkboxGrid">
                                  <label className="le-check">
                                    <input
                                      type="radio"
                                      name="proposal-accepted"
                                      checked={proposalPresentationForm.proposalAccepted === "YES"}
                                      onChange={() => {
                                        setProposalPresentationError("");
                                        setProposalPresentationForm((f) => ({ ...f, proposalAccepted: "YES" }));
                                      }}
                                      disabled={proposalPresentationSaving}
                                    />
                                    <span>Yes</span>
                                  </label>
                                  <label className="le-check">
                                    <input
                                      type="radio"
                                      name="proposal-accepted"
                                      checked={proposalPresentationForm.proposalAccepted === "NO"}
                                      onChange={() => {
                                        setProposalPresentationError("");
                                        setProposalPresentationForm((f) => ({ ...f, proposalAccepted: "NO", initialQuotationNotes: "" }));
                                      }}
                                      disabled={proposalPresentationSaving}
                                    />
                                    <span>No</span>
                                  </label>
                                </div>
                              </div>

                              {proposalPresentationForm.proposalAccepted === "YES" ? (
                                <div className="le-formRow">
                                  <label className="le-label">Initial Quotation Proposal Notes (optional)</label>
                                  <textarea
                                    className="le-input"
                                    value={proposalPresentationForm.initialQuotationNotes}
                                    onChange={(e) => setProposalPresentationForm((f) => ({ ...f, initialQuotationNotes: e.target.value }))}
                                    disabled={proposalPresentationSaving}
                                    rows={4}
                                  />
                                </div>
                              ) : null}

                              {proposalPresentationError ? <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{proposalPresentationError}</p> : null}

                              <div className="le-actions">
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setProposalPresentationError("");
                                    setProposalPresentationForm({
                                      proposalAccepted: "",
                                      initialQuotationNotes: "",
                                      presentedAt: "",
                                    });
                                  }}
                                  disabled={proposalPresentationSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitProposalPresentation}
                                  disabled={proposalPresentationSaving}
                                >
                                  {proposalPresentationSaving ? "Saving..." : "Save Proposal Presentation Notes"}
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="le-attemptMeta" style={{ marginTop: 8 }}>
                              <div>
                                <span className="le-metaLabel">Proposal Accepted</span>
                                <span className="le-metaValue">{proposalPresentationForm.proposalAccepted === "YES" ? "Yes" : proposalPresentationForm.proposalAccepted === "NO" ? "No" : "—"}</span>
                              </div>
                              {String(proposalPresentationForm.initialQuotationNotes || "").trim() ? (
                                <div>
                                  <span className="le-metaLabel">Initial Quotation Proposal Notes</span>
                                  <span className="le-metaValue">{proposalPresentationForm.initialQuotationNotes}</span>
                                </div>
                              ) : null}
                              {proposalPresentationForm.presentedAt ? (
                                <div>
                                  <span className="le-metaLabel">Presented At</span>
                                  <span className="le-metaValue">{formatDateTime(proposalPresentationForm.presentedAt)}</span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {showProposalPanel && isProposalScheduleApplicationViewed ? (
                        <div className="le-block">
                          {!applicationMeetingSaved ? <h4 className="le-blockTitle">Schedule Application Submission</h4> : null}

                          {applicationMeetingSaved ? (
                            <div className="le-attemptItem" style={{ marginTop: 8 }}>
                              <div className="le-attemptSectionHeader">Meeting Details</div>
                              <div className="le-attemptMeta">
                                {applicationMeetingSaved?.startAt ? <div><span className="le-metaLabel">Meeting Date & Time</span><span className="le-metaValue">{formatDateTime(applicationMeetingSaved.startAt)}</span></div> : null}
                                {applicationMeetingSaved?.durationMin ? <div><span className="le-metaLabel">Meeting Duration</span><span className="le-metaValue">{applicationMeetingSaved.durationMin} mins</span></div> : null}
                                {applicationMeetingSaved?.endAt ? <div><span className="le-metaLabel">Meeting Ends</span><span className="le-metaValue">{formatDateTime(applicationMeetingSaved.endAt)}</span></div> : null}
                                {applicationMeetingSaved?.mode ? <div><span className="le-metaLabel">Meeting Mode</span><span className="le-metaValue">{applicationMeetingSaved.mode}</span></div> : null}
                                {applicationMeetingSaved?.platform ? <div><span className="le-metaLabel">Meeting Platform</span><span className="le-metaValue">{applicationMeetingSaved.platform}</span></div> : null}
                                {applicationMeetingSaved?.platformOther ? <div><span className="le-metaLabel">Meeting Platform (Other)</span><span className="le-metaValue">{applicationMeetingSaved.platformOther}</span></div> : null}
                                {applicationMeetingSaved?.link ? <div><span className="le-metaLabel">Meeting Link</span><span className="le-metaValue">{applicationMeetingSaved.link}</span></div> : null}
                                {String(applicationMeetingSaved?.mode || "") === "Online" ? <div><span className="le-metaLabel">Meeting Invite Sent</span><span className="le-metaValue">{applicationMeetingSaved?.inviteSent ? "Yes" : "No"}</span></div> : null}
                                {applicationMeetingSaved?.place ? <div><span className="le-metaLabel">Meeting Place</span><span className="le-metaValue">{applicationMeetingSaved.place}</span></div> : null}
                                {applicationMeetingSaved?.status ? <div><span className="le-metaLabel">Status</span><span className="le-metaValue">{applicationMeetingSaved.status}</span></div> : null}
                              </div>
                            </div>
                          ) : null}

                          {!applicationMeetingSaved && proposalUiActivityKey === "Schedule Application Submission" ? (
                            <>
                              <div className="le-formRow">
                                <label className="le-label">Meeting Date *</label>
                                <select
                                  className="le-input"
                                  value={applicationMeetingForm.meetingDate}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setApplicationMeetingForm((f) => ({ ...f, meetingDate: v, meetingStartTime: "" }));
                                    setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingDate: "", meetingStartTime: "" }));
                                  }}
                                  disabled={savingApplicationMeeting || loadingAvailability}
                                >
                                  <option value="">Select date</option>
                                  {availableDateOptions.map((d) => (
                                    <option key={`app-date-${d.value}`} value={d.value}>{d.label}</option>
                                  ))}
                                </select>
                                {applicationMeetingFieldErrors.meetingDate ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingDate}</p> : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Duration *</label>
                                <select
                                  className="le-input"
                                  value={applicationMeetingForm.meetingDurationMin}
                                  onChange={(e) => {
                                    setApplicationMeetingForm((f) => ({ ...f, meetingDurationMin: Number(e.target.value || 120), meetingStartTime: "" }));
                                    setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingDurationMin: "", meetingStartTime: "" }));
                                  }}
                                  disabled={savingApplicationMeeting}
                                >
                                  <option value={30}>30 mins</option>
                                  <option value={60}>60 mins</option>
                                  <option value={90}>90 mins</option>
                                  <option value={120}>120 mins</option>
                                </select>
                                {applicationMeetingFieldErrors.meetingDurationMin ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingDurationMin}</p> : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Start Time *</label>
                                <select
                                  className="le-input"
                                  value={applicationMeetingForm.meetingStartTime}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setApplicationMeetingForm((f) => ({ ...f, meetingStartTime: v }));
                                    setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingStartTime: "" }));
                                  }}
                                  disabled={savingApplicationMeeting || !applicationMeetingForm.meetingDate}
                                >
                                  <option value="">Select time</option>
                                  {applicationMeetingStartSlots.map((slot) => {
                                    const booked = applicationMeetingForm.meetingDate
                                      ? isSlotBooked(applicationMeetingForm.meetingDate, slot, applicationMeetingForm.meetingDurationMin, applicationMeetingSaved?.startAt)
                                      : false;
                                    return (
                                      <option key={`app-time-${slot}`} value={slot} disabled={booked}>
                                        {formatTimeLabel(slot)}{booked ? " (Booked)" : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                                {applicationMeetingFieldErrors.meetingStartTime ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingStartTime}</p> : null}
                              </div>

                              <div className="le-formRow">
                                <label className="le-label">Meeting Mode *</label>
                                <select
                                  className="le-input"
                                  value={applicationMeetingForm.meetingMode}
                                  onChange={(e) => {
                                    const mode = e.target.value;
                                    setApplicationMeetingForm((f) => ({
                                      ...f,
                                      meetingMode: mode,
                                      meetingPlatform: "",
                                      meetingPlatformOther: "",
                                      meetingLink: "",
                                      meetingInviteSent: false,
                                      meetingPlace: "",
                                    }));
                                    setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingMode: "" }));
                                  }}
                                  disabled={savingApplicationMeeting}
                                >
                                  <option value="">Select</option>
                                  <option value="Online">Online</option>
                                  <option value="Face-to-face">Face-to-face</option>
                                </select>
                                {applicationMeetingFieldErrors.meetingMode ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingMode}</p> : null}
                              </div>

                              {applicationMeetingForm.meetingMode === "Online" && (
                                <>
                                  <div className="le-formRow">
                                    <label className="le-label">Meeting Platform *</label>
                                    <select
                                      className="le-input"
                                      value={applicationMeetingForm.meetingPlatform}
                                      onChange={(e) => {
                                        setApplicationMeetingForm((f) => ({ ...f, meetingPlatform: e.target.value }));
                                        setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingPlatform: "", meetingPlatformOther: "" }));
                                      }}
                                      disabled={savingApplicationMeeting}
                                    >
                                      <option value="">Select</option>
                                      <option value="Zoom">Zoom</option>
                                      <option value="Google Meet">Google Meet</option>
                                      <option value="Other">Other</option>
                                    </select>
                                    {applicationMeetingFieldErrors.meetingPlatform ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingPlatform}</p> : null}
                                  </div>
                                  {applicationMeetingForm.meetingPlatform === "Other" ? (
                                    <div className="le-formRow">
                                      <label className="le-label">Platform (Other) *</label>
                                      <input
                                        className="le-input"
                                        value={applicationMeetingForm.meetingPlatformOther}
                                        onChange={(e) => {
                                          setApplicationMeetingForm((f) => ({ ...f, meetingPlatformOther: e.target.value }));
                                          setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingPlatformOther: "" }));
                                        }}
                                        disabled={savingApplicationMeeting}
                                      />
                                      {applicationMeetingFieldErrors.meetingPlatformOther ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingPlatformOther}</p> : null}
                                    </div>
                                  ) : null}

                                  <div className="le-formRow">
                                    <label className="le-label">Meeting Link *</label>
                                    <input
                                      className="le-input"
                                      value={applicationMeetingForm.meetingLink}
                                      onChange={(e) => {
                                        setApplicationMeetingForm((f) => ({ ...f, meetingLink: e.target.value }));
                                        setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingLink: "" }));
                                      }}
                                      placeholder="https://..."
                                      disabled={savingApplicationMeeting}
                                    />
                                    {applicationMeetingFieldErrors.meetingLink ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingLink}</p> : null}
                                  </div>

                                  <div className="le-formRow">
                                    <label className="le-check">
                                      <input
                                        type="checkbox"
                                        checked={applicationMeetingForm.meetingInviteSent}
                                        onChange={(e) => {
                                          setApplicationMeetingForm((f) => ({ ...f, meetingInviteSent: e.target.checked }));
                                          setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingInviteSent: "" }));
                                        }}
                                        disabled={savingApplicationMeeting}
                                      />
                                      <span>I confirm invite link has been sent (required)</span>
                                    </label>
                                    {applicationMeetingFieldErrors.meetingInviteSent ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingInviteSent}</p> : null}
                                  </div>
                                </>
                              )}

                              {applicationMeetingForm.meetingMode === "Face-to-face" && (
                                <div className="le-formRow">
                                  <label className="le-label">Meeting Place *</label>
                                  <input
                                    className="le-input"
                                    value={applicationMeetingForm.meetingPlace}
                                    onChange={(e) => {
                                      setApplicationMeetingForm((f) => ({ ...f, meetingPlace: e.target.value }));
                                      setApplicationMeetingFieldErrors((prev) => ({ ...prev, meetingPlace: "" }));
                                    }}
                                    disabled={savingApplicationMeeting}
                                  />
                                  {applicationMeetingFieldErrors.meetingPlace ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{applicationMeetingFieldErrors.meetingPlace}</p> : null}
                                </div>
                              )}

                              <div className="le-actions">
                                <button
                                  type="button"
                                  className="le-btn secondary"
                                  onClick={() => {
                                    setApplicationMeetingError("");
                                    setApplicationMeetingFieldErrors({});
                                    if (applicationMeetingSaved?.startAt) {
                                      setApplicationMeetingForm({
                                        meetingDate: toDateInputValue(applicationMeetingSaved.startAt),
                                        meetingStartTime: `${String(new Date(applicationMeetingSaved.startAt).getHours()).padStart(2, "0")}:${String(new Date(applicationMeetingSaved.startAt).getMinutes()).padStart(2, "0")}`,
                                        meetingDurationMin: applicationMeetingSaved.durationMin ?? 120,
                                        meetingMode: String(applicationMeetingSaved.mode || ""),
                                        meetingPlatform: String(applicationMeetingSaved.platform || ""),
                                        meetingPlatformOther: String(applicationMeetingSaved.platformOther || ""),
                                        meetingLink: String(applicationMeetingSaved.link || ""),
                                        meetingInviteSent: Boolean(applicationMeetingSaved.inviteSent),
                                        meetingPlace: String(applicationMeetingSaved.place || ""),
                                      });
                                    } else {
                                      setApplicationMeetingForm({
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
                                  }}
                                  disabled={savingApplicationMeeting}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitScheduleApplicationSubmission}
                                  disabled={savingApplicationMeeting}
                                >
                                  {savingApplicationMeeting ? "Saving..." : "Save Application Submission Schedule"}
                                </button>
                              </div>

                              {applicationMeetingError ? <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{applicationMeetingError}</p> : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}

                  {showNeedsAssessmentPanel && (
                    <>
                      {needsAssessmentViewedActivityKey === "Record Prospect Attendance" ? (
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
                                disabled={!isNeedsAssessmentCurrentViewEditable || isNeedsAssessmentLocked || needsAssessmentSaving}
                              />
                              <span>Yes</span>
                            </label>
                            <label className="le-check">
                              <input
                                type="radio"
                                name="prospect-attendance"
                                checked={needsAssessmentForm.attendanceChoice === "NO"}
                                onChange={() => setNeedsAssessmentForm((f) => ({ ...f, attendanceChoice: "NO", attendanceProofImageDataUrl: "", attendanceProofFileName: "" }))}
                                disabled={!isNeedsAssessmentCurrentViewEditable || isNeedsAssessmentLocked || needsAssessmentSaving}
                              />
                              <span>No</span>
                            </label>
                          </div>
                        </div>
                        {renderNeedsAssessmentError("attendanceChoice")}

                        {needsAssessmentForm.attendanceChoice === "NO" ? (
                          <div style={{ marginTop: 10 }}>
                            <button
                              type="button"
                              className="le-btn secondary"
                              onClick={startRescheduleFromNeeds}
                              disabled={!isNeedsAssessmentCurrentViewEditable || isNeedsAssessmentLocked || needsAssessmentSaving}
                            >
                              Reschedule Meeting
                            </button>
                          </div>
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
                                  disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}
                                />
                                {needsAssessmentForm.attendanceProofFileName ? (
                                  <p className="le-smallNote">Selected file: {needsAssessmentForm.attendanceProofFileName}</p>
                                ) : null}
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

                            {isNeedsAssessmentCurrentViewEditable && !isNeedsAssessmentLocked ? (
                              <div className="le-actions" style={{ marginTop: 10 }}>
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
                                <button
                                  type="button"
                                  className="le-btn primary"
                                  onClick={submitNeedsAssessmentAttendanceOnly}
                                  disabled={needsAssessmentSaving}
                                >
                                  {needsAssessmentSaving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                      ) : null}

                      {isNeedsAnalysisViewed && needsAssessmentForm.attendanceChoice === "YES" && !isNeedsAssessmentLocked && String(needsAssessmentForm.attendanceProofImageDataUrl || "").trim() && (
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
                              disabled={!isNeedsAssessmentCurrentViewEditable}
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
                            <label className="le-label">Sex *</label>
                            <select
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.sex || ""}
                              onChange={(e) =>
                                setNeedsAssessmentForm((f) => ({
                                  ...f,
                                  basicInformation: { ...f.basicInformation, sex: e.target.value },
                                }))
                              }
                              disabled={!isNeedsAssessmentCurrentViewEditable}
                            >
                              <option value="">Select</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </div>
                          {renderNeedsAssessmentError("sex")}

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
                              disabled={!isNeedsAssessmentCurrentViewEditable}
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
                              disabled={!isNeedsAssessmentCurrentViewEditable}
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
                              disabled={!isNeedsAssessmentCurrentViewEditable}
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
                              disabled={!isNeedsAssessmentCurrentViewEditable}
                            />
                          </div>
                          {renderNeedsAssessmentError("addressLine")}

                          <div className="le-formRow">
                            <label className="le-label">Barangay *</label>
                            <input
                              className="le-input"
                              value={needsAssessmentForm.basicInformation.barangay || ""}
                              onChange={(e) => setNeedsAssessmentForm((f) => ({ ...f, basicInformation: { ...f.basicInformation, barangay: e.target.value } }))}
                              disabled={!isNeedsAssessmentCurrentViewEditable}
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
                              disabled={!isNeedsAssessmentCurrentViewEditable}
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
                                disabled={!isNeedsAssessmentCurrentViewEditable}
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
                              disabled={!isNeedsAssessmentCurrentViewEditable}
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
                              disabled={!isNeedsAssessmentCurrentViewEditable}
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
                              disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}
                            >
                              + Add Another Dependent
                            </button>
                          </div>

                          {(needsAssessmentForm.dependents || []).map((d, idx) => (
                            <div key={`dep-${idx}`} className="le-attemptItem" style={{ marginTop: 10 }}>
                              <div className="le-formRow"><label className="le-label">Name *</label><input className="le-input" value={d.name || ""} onChange={(e) => updateDependent(idx, "name", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                              <div className="le-formRow"><label className="le-label">Age *</label><input className="le-input" inputMode="numeric" value={d.age ?? ""} onChange={(e) => updateDependent(idx, "age", String(e.target.value).replace(/[^\d]/g, ""))} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                              <div className="le-formRow"><label className="le-label">Gender *</label><select className="le-input" value={d.gender || ""} onChange={(e) => updateDependent(idx, "gender", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
                              <div className="le-formRow"><label className="le-label">Relationship *</label><select className="le-input" value={d.relationship || ""} onChange={(e) => updateDependent(idx, "relationship", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="Child">Child</option><option value="Parent">Parent</option><option value="Sibling">Sibling</option></select></div>
                              <div className="le-actions"><button type="button" className="le-btn secondary" onClick={() => removeDependent(idx)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}>Remove</button></div>
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
                                <select className="le-input" value={needsAssessmentForm.needsPriorities?.currentPriority || ""} onChange={(e) => updateNeedsPriorities("currentPriority", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}>
                                  <option value="">Select</option><option value="Protection">Protection</option><option value="Health">Health</option><option value="Investment">Investment</option>
                                </select>
                              </div>
                              {renderNeedsAssessmentError("currentPriority")}

                              <div className="le-formRow">
                                <label className="le-label">Approximate Monthly Income (All Sources) *</label>
                                <select className="le-input" value={needsAssessmentForm.needsPriorities?.monthlyIncomeBand || ""} onChange={(e) => updateNeedsPriorities("monthlyIncomeBand", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}>
                                  <option value="">Select bracket</option>
                                  {INCOME_BAND_OPTIONS.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}
                                </select>
                              </div>
                              {renderNeedsAssessmentError("monthlyIncomeBand")}

                              {["BELOW_15000", "ABOVE_500000"].includes(String(needsAssessmentForm.needsPriorities?.monthlyIncomeBand || "")) && (
                                <div className="le-formRow">
                                  <label className="le-label">Manual Monthly Income Amount (Php) *</label>
                                  <input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.monthlyIncomeAmount ?? ""} onChange={(e) => updateNeedsPriorities("monthlyIncomeAmount", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} />
                                </div>
                              )}
                              {renderNeedsAssessmentError("monthlyIncomeAmount")}

                              <div className="le-formRow"><label className="le-label">Minimum Willing Monthly Premium (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.minPremium ?? ""} onChange={(e) => updateNeedsPriorities("minPremium", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                              {renderNeedsAssessmentError("minPremium")}
                              <div className="le-formRow"><label className="le-label">Maximum Willing Monthly Premium (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.maxPremium ?? ""} onChange={(e) => updateNeedsPriorities("maxPremium", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                              {renderNeedsAssessmentError("maxPremium")}

                              {needsPrioritiesDerived.priority === "Protection" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Approximate Monthly Spend (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.protection?.monthlySpend ?? ""} onChange={(e) => updateNeedsPrioritySection("protection", "monthlySpend", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("protectionMonthlySpend")}
                                  <div className="le-formRow"><label className="le-label">Number of Dependents</label><input className="le-input" value={needsPrioritiesDerived.numberOfDependents} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Years to Protect Income</label><input className="le-input" value={needsPrioritiesDerived.yearsToProtectIncome} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Savings for Protection (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.protection?.savingsForProtection ?? ""} onChange={(e) => updateNeedsPrioritySection("protection", "savingsForProtection", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("protectionSavings")}
                                  <div className="le-formRow"><label className="le-label">Protection Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.protectionGap) ? needsPrioritiesDerived.protectionGap : ""} disabled /></div>
                                </>
                              )}

                              {needsPrioritiesDerived.priority === "Health" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Approx. Amount to Cover Critical Illness (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.health?.amountToCoverCriticalIllness ?? ""} onChange={(e) => updateNeedsPrioritySection("health", "amountToCoverCriticalIllness", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("healthAmount")}
                                  <div className="le-formRow"><label className="le-label">Savings for Critical Illness (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.health?.savingsForCriticalIllness ?? ""} onChange={(e) => updateNeedsPrioritySection("health", "savingsForCriticalIllness", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("healthSavings")}
                                  <div className="le-formRow"><label className="le-label">Critical Illness and Hospitalization Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.criticalIllnessGap) ? needsPrioritiesDerived.criticalIllnessGap : ""} disabled /></div>
                                </>
                              )}

                              {needsPrioritiesDerived.priority === "Investment" && (
                                <>
                                  <div className="le-formRow"><label className="le-label">Savings Plan *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.savingsPlan || ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsPlan", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="Home">Home</option><option value="Vehicle">Vehicle</option><option value="Holiday">Holiday</option><option value="Early Retirement">Early Retirement</option><option value="Other">Other</option></select></div>
                                  {renderNeedsAssessmentError("investmentSavingsPlan")}
                                  {String(needsAssessmentForm.needsPriorities?.investment?.savingsPlan || "") === "Other" && (<div className="le-formRow"><label className="le-label">Other Savings Plan *</label><input className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.savingsPlanOther || ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsPlanOther", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>)}
                                  {renderNeedsAssessmentError("investmentSavingsPlanOther")}
                                  <div className="le-formRow"><label className="le-label">Target Savings Amount (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.targetSavingsAmount ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "targetSavingsAmount", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("investmentTargetAmount")}
                                  <div className="le-formRow"><label className="le-label">Target Year to Utilize Savings *</label><input className="le-input" inputMode="numeric" value={needsAssessmentForm.needsPriorities?.investment?.targetUtilizationYear ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "targetUtilizationYear", String(e.target.value).replace(/[^\d]/g, "").slice(0, 4))} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("investmentTargetYear")}
                                  <div className="le-formRow"><label className="le-label">Savings for Investment (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.savingsForInvestment ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "savingsForInvestment", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                                  {renderNeedsAssessmentError("investmentSavings")}
                                  <div className="le-formRow"><label className="le-label">Savings Gap (Php)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.savingsGap) ? needsPrioritiesDerived.savingsGap : ""} disabled /></div>

                                  <h5 className="le-attemptSectionHeader" style={{ marginTop: 14 }}>Investment Risk Profiler</h5>
                                  <p className="le-muted" style={{ marginTop: 6, marginBottom: 6 }}>Subsection 1: Risk Appetite Survey</p>
                                  {renderNeedsAssessmentError("investmentRiskProfiler")}

                                  <div className="le-formRow"><label className="le-label">INVESTMENT HORIZON *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>How long will you allow your money to grow before you feel the need to have access to it?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.investmentHorizon || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), investmentHorizon: e.target.value })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="LT_3">Less than three years</option><option value="BETWEEN_3_7">Between three and seven years</option><option value="BETWEEN_7_10">Longer than seven years but less than 10 years</option><option value="AT_LEAST_10">At least 10 years</option></select></div>
                                  <div className="le-formRow"><label className="le-label">INVESTMENT GOAL *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>What is your goal for this investment?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.investmentGoal || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), investmentGoal: e.target.value })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="CAPITAL_PRESERVATION">Capital preservation with a potential return that is slightly higher than time deposit rate</option><option value="STEADY_GROWTH">Steady growth in capital</option><option value="SIGNIFICANT_APPRECIATION">A significant level of capital appreciation</option></select></div>
                                  <div className="le-formRow"><label className="le-label">EXPERIENCE WITH INVESTMENTS AND/OR FINANCIAL MARKETS *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>Have you had any experience investing in the following:</p><p className="le-smallNote" style={{ marginTop: 0, marginBottom: 8 }}>I. Mutual funds, unit investment trust funds, unit-linked insurance policies, local government and/or corporate bonds, listed stocks in the Philippine Stock Market</p><p className="le-smallNote" style={{ marginTop: 0, marginBottom: 8 }}>II. Foreign investments (stocks, bonds, funds outside the Philippine market), foreign currencies, hedge funds, derivatives (options, futures, forwards, etc.)</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.marketExperience || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), marketExperience: e.target.value })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="NONE">None of the above</option><option value="I_ONLY">In "I" only</option><option value="II_ONLY">In "II" only</option><option value="BOTH">In both "I" and "II"</option></select></div>
                                  <div className="le-formRow"><label className="le-label">REACTION TO SHORT-TERM VOLATILITY *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>What will you do if you experience a significant drop (e.g. 30%) in fund value within a year?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.volatilityReaction || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), volatilityReaction: e.target.value })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="FULL_WITHDRAW">Make a full withdrawal</option><option value="LESS_RISKY">Switch to a less risky fund</option><option value="HOLD">Do nothing or hold on to the funds</option><option value="TOP_UPS">Do top-ups or make additional investments</option></select></div>
                                  <div className="le-formRow"><label className="le-label">AFFORDABILITY TO CAPITAL LOSS *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>In the long term (more than five years), what is the level of capital loss you can afford to take?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.capitalLossAffordability || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), capitalLossAffordability: e.target.value })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="NO_LOSS">I cannot afford a loss</option><option value="UP_TO_5">I can afford up to 5% loss</option><option value="UP_TO_10">I can afford up to 10% loss</option><option value="ABOVE_10">I can afford more than 10% loss</option></select></div>
                                  <div className="le-formRow"><label className="le-label">RISK AND RETURN TRADE-OFF *</label><p className="le-muted" style={{ marginTop: 4, marginBottom: 8 }}>Which of the sample portfolio would you prefer?</p><select className="le-input" value={needsAssessmentForm.needsPriorities?.investment?.riskProfiler?.riskReturnTradeoff || ""} onChange={(e) => updateNeedsPrioritySection("investment", "riskProfiler", { ...(needsAssessmentForm.needsPriorities?.investment?.riskProfiler || {}), riskReturnTradeoff: e.target.value })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="">Select</option><option value="PORTFOLIO_A">Portfolio A: 4% Potential annual gain, -3% Potential annual loss</option><option value="PORTFOLIO_B">Portfolio B: 6% Potential annual gain, -6% Potential annual loss</option><option value="PORTFOLIO_C">Portfolio C: 10% Potential annual gain, -12% Potential annual loss</option><option value="PORTFOLIO_D">Portfolio D: 20% or more Potential annual gain, -28% or more Potential annual loss</option></select></div>

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
                                            <div><span className="le-metaLabel">Allocation (%)</span><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.fundChoice?.allocations?.[fund.key] ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "fundChoice", { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice || {}), allocations: { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice?.allocations || {}), [fund.key]: String(e.target.value).replace(/[^\d.]/g, "") } })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
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
                                          <div><span className="le-metaLabel">Allocation (%)</span><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.investment?.fundChoice?.allocations?.[fund.key] ?? ""} onChange={(e) => updateNeedsPrioritySection("investment", "fundChoice", { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice || {}), allocations: { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice?.allocations || {}), [fund.key]: String(e.target.value).replace(/[^\d.]/g, "") } })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="le-formRow"><label className="le-label">Total Allocation (%)</label><input className="le-input" value={Number.isFinite(needsPrioritiesDerived.totalFundAllocation) ? needsPrioritiesDerived.totalFundAllocation : ""} disabled /></div>
                                  <div className="le-formRow"><label className="le-label">Fund Match</label><input className="le-input" value={needsPrioritiesDerived.fundMatch} disabled /></div>
                                  {needsPrioritiesDerived.fundMatch === "No" && (
                                    <div className="le-formRow"><label className="le-label">Reason for Mismatch *</label><textarea className="le-input" rows={3} value={needsAssessmentForm.needsPriorities?.investment?.fundChoice?.mismatchReason || ""} onChange={(e) => updateNeedsPrioritySection("investment", "fundChoice", { ...(needsAssessmentForm.needsPriorities?.investment?.fundChoice || {}), mismatchReason: e.target.value })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
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
                                            })}
                                            disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}
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

                              <div className="le-formRow"><label className="le-label">Requested Frequency of Premium Payment *</label><select className="le-input" value={needsAssessmentForm.needsPriorities?.productSelection?.requestedFrequency || "Monthly"} onChange={(e) => { const v = e.target.value; updateNeedsPriorities("productSelection", { ...(needsAssessmentForm.needsPriorities?.productSelection || {}), requestedFrequency: v, requestedPremiumPayment: v === "Monthly" ? (needsAssessmentForm.needsPriorities?.minPremium ?? "") : "" }); }} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Half-yearly">Half-yearly</option><option value="Yearly">Yearly</option></select></div>
                              {renderNeedsAssessmentError("requestedFrequency")}
                              <div className="le-formRow"><label className="le-label">Requested Premium Payment (Php) *</label><input className="le-input" inputMode="decimal" value={needsAssessmentForm.needsPriorities?.productSelection?.requestedPremiumPayment ?? ""} onChange={(e) => updateNeedsPriorities("productSelection", { ...(needsAssessmentForm.needsPriorities?.productSelection || {}), requestedPremiumPayment: e.target.value })} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>
                              {renderNeedsAssessmentError("requestedPremiumPayment")}

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
                                            disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving}
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
                              <div className="le-formRow"><label className="le-label">Notes about selected product and optional riders</label><textarea className="le-input" rows={3} value={needsAssessmentForm.needsPriorities?.productRidersNotes || ""} onChange={(e) => updateNeedsPriorities("productRidersNotes", e.target.value)} disabled={!isNeedsAssessmentCurrentViewEditable || needsAssessmentSaving} /></div>

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

                      {showProposalSchedulingSection && isNeedsAnalysisViewed && (
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

                        </div>
                      )}

                      {showProposalSchedulingSection && isNeedsScheduleViewed && (
                          <div className="le-block" style={{ marginTop: 16 }}>
                            {!proposalMeetingSaved ? <h4 className="le-blockTitle">Schedule Proposal Presentation</h4> : null}
                            {proposalMeetingSaved ? (
                              <div className="le-attemptItem" style={{ marginTop: 8 }}>
                                <div className="le-attemptSectionHeader">Meeting Details</div>
                                <div className="le-attemptMeta">
                                  {proposalMeetingSaved?.startAt ? <div><span className="le-metaLabel">Meeting Date & Time</span><span className="le-metaValue">{formatDateTime(proposalMeetingSaved.startAt)}</span></div> : null}
                                  {proposalMeetingSaved?.durationMin ? <div><span className="le-metaLabel">Meeting Duration</span><span className="le-metaValue">{proposalMeetingSaved.durationMin} mins</span></div> : null}
                                  {proposalMeetingSaved?.endAt ? <div><span className="le-metaLabel">Meeting Ends</span><span className="le-metaValue">{formatDateTime(proposalMeetingSaved.endAt)}</span></div> : null}
                                  {proposalMeetingSaved?.mode ? <div><span className="le-metaLabel">Meeting Mode</span><span className="le-metaValue">{proposalMeetingSaved.mode}</span></div> : null}
                                  {proposalMeetingSaved?.platform ? <div><span className="le-metaLabel">Meeting Platform</span><span className="le-metaValue">{proposalMeetingSaved.platform}</span></div> : null}
                                  {proposalMeetingSaved?.platformOther ? <div><span className="le-metaLabel">Meeting Platform (Other)</span><span className="le-metaValue">{proposalMeetingSaved.platformOther}</span></div> : null}
                                  {proposalMeetingSaved?.link ? <div><span className="le-metaLabel">Meeting Link</span><span className="le-metaValue">{proposalMeetingSaved.link}</span></div> : null}
                                  {String(proposalMeetingSaved?.mode || "") === "Online" ? <div><span className="le-metaLabel">Meeting Invite Sent</span><span className="le-metaValue">{proposalMeetingSaved?.inviteSent ? "Yes" : "No"}</span></div> : null}
                                  {proposalMeetingSaved?.place ? <div><span className="le-metaLabel">Meeting Place</span><span className="le-metaValue">{proposalMeetingSaved.place}</span></div> : null}
                                  {proposalMeetingSaved?.status ? <div><span className="le-metaLabel">Status</span><span className="le-metaValue">{proposalMeetingSaved.status}</span></div> : null}
                                </div>
                              </div>
                            ) : null}

                            {!proposalMeetingSaved ? (
                              <>
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
                                disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                    disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                      disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                    disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                      disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                  disabled={!isNeedsScheduleEditable || savingProposalMeeting}
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
                                disabled={!isNeedsScheduleEditable || savingProposalMeeting}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="le-btn primary"
                                onClick={submitScheduleProposalPresentation}
                                disabled={!isNeedsScheduleEditable || savingProposalMeeting}
                              >
                                {savingProposalMeeting ? "Saving..." : "Save Proposal Presentation Schedule"}
                              </button>
                            </div>

                            {proposalMeetingError ? <p className="le-smallNote" style={{ color: "#DA291C", marginTop: 8 }}>{proposalMeetingError}</p> : null}
                              </>
                            ) : null}

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

      {confirmNotInterestedModalOpen ? (
        <div className="le-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="le-confirm-drop-title">
          <div className="le-modalCard">
            <button
              type="button"
              className="le-modalClose"
              aria-label="Close not interested confirmation"
              onClick={() => setConfirmNotInterestedModalOpen(false)}
              disabled={savingInterest}
            >
              ×
            </button>
            <h3 className="le-modalTitle" id="le-confirm-drop-title">Confirm lead drop</h3>
            <p className="le-modalText">
              Marking this lead as <strong>Not Interested</strong> will automatically drop the lead and lock further subactivity progress.
            </p>
            <p className="le-modalText" style={{ marginTop: 8 }}>
              Do you want to continue?
            </p>
            <div className="le-modalActions">
              <button
                type="button"
                className="le-btn secondary"
                onClick={() => setConfirmNotInterestedModalOpen(false)}
                disabled={savingInterest}
              >
                Cancel
              </button>
              <button
                type="button"
                className="le-btn primary"
                onClick={confirmNotInterestedAndDrop}
                disabled={savingInterest}
              >
                {savingInterest ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dropOutcomeModal ? (
        <div className="le-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="le-drop-modal-title">
          <div className="le-modalCard">
            <button type="button" className="le-modalClose" aria-label="Close drop modal" onClick={() => setDropOutcomeModal(null)}>
              ×
            </button>
            <h3 className="le-modalTitle" id="le-drop-modal-title">{dropOutcomeModal.title}</h3>
            <p className="le-modalText">{dropOutcomeModal.message}</p>
            <div className="le-attemptMeta" style={{ marginBottom: 16 }}>
              {dropOutcomeModal.leadCode ? (
                <div>
                  <span className="le-metaLabel">Lead Code</span>
                  <span className="le-metaValue">{dropOutcomeModal.leadCode}</span>
                </div>
              ) : null}
              {dropOutcomeModal.dropReason ? (
                <div>
                  <span className="le-metaLabel">Drop Reason</span>
                  <span className="le-metaValue">{dropOutcomeModal.dropReason}</span>
                </div>
              ) : null}
              {dropOutcomeModal.droppedAt ? (
                <div>
                  <span className="le-metaLabel">Dropped At</span>
                  <span className="le-metaValue">{formatDateTime(dropOutcomeModal.droppedAt)}</span>
                </div>
              ) : null}
            </div>
            {dropOutcomeModal.dropNotes ? <p className="le-modalText">{dropOutcomeModal.dropNotes}</p> : null}
            <div className="le-modalActions">
              <button type="button" className="le-btn primary" onClick={() => setDropOutcomeModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AgentLeadEngagement;
