import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentLeadEngagement.css";

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
  const [needsAssessmentForm, setNeedsAssessmentForm] = useState({
    attendanceConfirmed: false,
    basicInformation: {
      fullName: "",
      sex: "",
      civilStatus: "",
      birthday: "",
      age: "",
      occupation: "",
    },
    dependents: [],
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

      setNeedsAssessmentForm({
        attendanceConfirmed: Boolean(data?.needsAssessment?.attendanceConfirmed),
        basicInformation: {
          fullName: String(profile.fullName || "").trim(),
          sex: String(profile.sex || ""),
          civilStatus: String(profile.civilStatus || ""),
          birthday,
          age: age ?? "",
          occupation: String(profile.occupation || ""),
        },
        dependents: Array.isArray(data?.needsAssessment?.dependents)
          ? data.needsAssessment.dependents.map((d) => ({
              name: String(d?.name || ""),
              age: d?.age ?? "",
              gender: String(d?.gender || ""),
              relationship: String(d?.relationship || ""),
            }))
          : [],
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

    if (!needsAssessmentForm.attendanceConfirmed) {
      setNeedsAssessmentError("Prospect attendance must be confirmed before Needs Analysis.");
      return;
    }

    const birthday = String(needsAssessmentForm.basicInformation?.birthday || "").trim();
    const age = Number(needsAssessmentForm.basicInformation?.age || "");

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
    } else if (!Number.isFinite(age) || age < 18 || age > 70) {
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
      if (!["Male", "Female", "Other"].includes(String(d.gender || ""))) {
        setNeedsAssessmentError(`Dependent #${i + 1}: please select gender.`);
        return;
      }
      if (!["Child", "Parent", "Sibling"].includes(String(d.relationship || ""))) {
        setNeedsAssessmentError(`Dependent #${i + 1}: please select relationship.`);
        return;
      }
    }

    try {
      setNeedsAssessmentSaving(true);
      const res = await fetch(`${API_BASE}/api/prospects/${prospectId}/leads/${leadId}/needs-assessment?userId=${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceConfirmed: Boolean(needsAssessmentForm.attendanceConfirmed),
          basicInformation: {
            sex: String(needsAssessmentForm.basicInformation.sex || "").trim(),
            civilStatus: String(needsAssessmentForm.basicInformation.civilStatus || "").trim(),
            birthday: String(needsAssessmentForm.basicInformation.birthday || "").trim(),
            age: needsAssessmentForm.basicInformation.age,
            occupation: String(needsAssessmentForm.basicInformation.occupation || "").trim(),
          },
          dependents: (needsAssessmentForm.dependents || []).map((d) => ({
            name: String(d.name || "").trim(),
            age: Number(d.age),
            gender: String(d.gender || ""),
            relationship: String(d.relationship || ""),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save needs assessment.");
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

  const CHANNELS = useMemo(() => ["Call", "SMS", "WhatsApp", "Viber", "Telegram"], []);
  const RESPONSES = useMemo(() => ["Responded", "No Response"], []);

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
                    {showContactingPanel && isViewingCurrentStage ? <span className="le-badge">{currentActivityLabel}</span> : null}
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
                        const trackerIndex = showAddAttempt ? addAttemptActivityIndex : normalizedActivityIndex;
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
                        <label className="le-check" style={{ marginTop: 10 }}>
                          <input
                            type="checkbox"
                            checked={!!needsAssessmentForm.attendanceConfirmed}
                            onChange={(e) =>
                              setNeedsAssessmentForm((f) => ({ ...f, attendanceConfirmed: e.target.checked }))
                            }
                            disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}
                          />
                          <span>Prospect attended</span>
                        </label>
                      </div>

                      <div className="le-block">
                        <h4 className="le-blockTitle">Needs Analysis - Basic Information</h4>
                        {needsAssessmentLoading ? <p className="le-muted">Loading needs assessment...</p> : null}
                        {needsAssessmentError ? <p className="le-smallNote" style={{ color: "#DA291C" }}>{needsAssessmentError}</p> : null}
                        {needsAssessmentSavedAt ? <p className="le-smallNote" style={{ color: "#0f766e" }}>Saved successfully.</p> : null}

                        <div className="le-formRow">
                          <label className="le-label">Name</label>
                          <input className="le-input" value={needsAssessmentForm.basicInformation.fullName || ""} disabled />
                        </div>

                        <div className="le-formRow">
                          <label className="le-label">Civil Status</label>
                          <select
                            className="le-input"
                            value={needsAssessmentForm.basicInformation.civilStatus || ""}
                            onChange={(e) =>
                              setNeedsAssessmentForm((f) => ({
                                ...f,
                                basicInformation: { ...f.basicInformation, civilStatus: e.target.value },
                              }))
                            }
                            disabled={!isNeedsAssessmentEditableNow || !needsAssessmentForm.attendanceConfirmed || !!needsAssessmentForm.basicInformation.civilStatus}
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
                          <label className="le-label">Birthday</label>
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
                            disabled={!isNeedsAssessmentEditableNow || !needsAssessmentForm.attendanceConfirmed || !!needsAssessmentForm.basicInformation.birthday}
                          />
                        </div>

                        <div className="le-formRow">
                          <label className="le-label">Age</label>
                          <input className="le-input" value={needsAssessmentForm.basicInformation.age ?? ""} disabled />
                        </div>

                        <div className="le-formRow">
                          <label className="le-label">Occupation</label>
                          <input
                            className="le-input"
                            value={needsAssessmentForm.basicInformation.occupation || ""}
                            onChange={(e) =>
                              setNeedsAssessmentForm((f) => ({
                                ...f,
                                basicInformation: { ...f.basicInformation, occupation: e.target.value },
                              }))
                            }
                            disabled={!isNeedsAssessmentEditableNow || !needsAssessmentForm.attendanceConfirmed || !!needsAssessmentForm.basicInformation.occupation}
                          />
                        </div>
                      </div>

                      <div className="le-block">
                        <div className="le-blockHeader">
                          <h4 className="le-blockTitle">Dependents (optional)</h4>
                          <button
                            type="button"
                            className="le-btn secondary"
                            onClick={addDependent}
                            disabled={!isNeedsAssessmentEditableNow || !needsAssessmentForm.attendanceConfirmed || needsAssessmentSaving}
                          >
                            + Add Another Dependent
                          </button>
                        </div>

                        {(needsAssessmentForm.dependents || []).map((d, idx) => (
                          <div key={`dep-${idx}`} className="le-attemptItem" style={{ marginTop: 10 }}>
                            <div className="le-formRow"><label className="le-label">Name</label><input className="le-input" value={d.name || ""} onChange={(e) => updateDependent(idx, "name", e.target.value)} disabled={!isNeedsAssessmentEditableNow || !needsAssessmentForm.attendanceConfirmed || needsAssessmentSaving} /></div>
                            <div className="le-formRow"><label className="le-label">Age</label><input className="le-input" inputMode="numeric" value={d.age ?? ""} onChange={(e) => updateDependent(idx, "age", String(e.target.value).replace(/[^\d]/g, ""))} disabled={!isNeedsAssessmentEditableNow || !needsAssessmentForm.attendanceConfirmed || needsAssessmentSaving} /></div>
                            <div className="le-formRow"><label className="le-label">Gender</label><select className="le-input" value={d.gender || ""} onChange={(e) => updateDependent(idx, "gender", e.target.value)} disabled={!isNeedsAssessmentEditableNow || !needsAssessmentForm.attendanceConfirmed || needsAssessmentSaving}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                            <div className="le-formRow"><label className="le-label">Relationship</label><select className="le-input" value={d.relationship || ""} onChange={(e) => updateDependent(idx, "relationship", e.target.value)} disabled={!isNeedsAssessmentEditableNow || !needsAssessmentForm.attendanceConfirmed || needsAssessmentSaving}><option value="">Select</option><option value="Child">Child</option><option value="Parent">Parent</option><option value="Sibling">Sibling</option></select></div>
                            <div className="le-actions"><button type="button" className="le-btn secondary" onClick={() => removeDependent(idx)} disabled={!isNeedsAssessmentEditableNow || needsAssessmentSaving}>Remove</button></div>
                          </div>
                        ))}
                      </div>

                      <div className="le-block">
                        <h4 className="le-blockTitle">Existing PRU Life UK Policies (optional)</h4>
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
                      </div>

                      {isNeedsAssessmentEditableNow && (
                        <div className="le-actions" style={{ marginTop: 14 }}>
                          <button type="button" className="le-btn primary" onClick={onSaveNeedsAssessment} disabled={needsAssessmentSaving}>
                            {needsAssessmentSaving ? "Saving..." : "Save Needs Assessment"}
                          </button>
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
