import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBuilding,
  FaPlus,
  FaProjectDiagram,
  FaSitemap,
  FaUserEdit,
  FaUserTie,
  FaUsers,
} from 'react-icons/fa';
import './AdminOrganizationPage.css';
import AdminNav from './components/AdminNav';
import logo from './assets/prutracker-landing-logo.png';

const EMPTY_AREA_FORM = { areaName: '' };
const EMPTY_BRANCH_FORM = { branchName: '', areaId: '' };
const EMPTY_UNIT_FORM = { unitName: '', branchId: '' };
const EMPTY_MANAGER_CREATE_FORM = { managerType: 'UM', sourceAgentId: '', branchId: '', unitId: '', dateEmployed: '' };
const EMPTY_AGENT_FORM = {
  username: '',
  password: '',
  firstName: '',
  middleName: '',
  lastName: '',
  birthday: '',
  sex: 'Male',
  age: '',
  displayPhoto: '',
  dateEmployed: '',
  agentType: 'Full-Time',
  unitId: '',
};
const EMPTY_DIRECTORY_DATA = {
  areas: [],
  branches: [],
  units: [],
  agents: [],
  managers: { bm: [], um: [], aum: [] },
  managerSequences: { BM: 1, UM: 1, AUM: 1 },
};

const EMPTY_FORM_OPTIONS = EMPTY_DIRECTORY_DATA;

function calculateAge(value) {
  if (!value) return '';

  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 ? age : '';
}

function countNested(area) {
  const branches = area?.branches || [];
  const units = branches.reduce((sum, branch) => sum + (branch.units?.length || 0), 0);
  const agents = branches.reduce(
    (sum, branch) => sum + (branch.units || []).reduce((unitSum, unit) => unitSum + (unit.agents?.length || 0), 0),
    0
  );

  return { branches: branches.length, units, agents };
}

function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function padSixDigitSequence(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(6, '0');
}

function getNextRoleSequence(records, role) {
  const prefix = String(role || '').trim().toUpperCase();
  const pattern = new RegExp(`^${prefix}(\\d{6})$`);

  const maxSequence = records.reduce((max, record) => {
    const username = String(record?.username || '').trim().toUpperCase();
    const match = username.match(pattern);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return maxSequence + 1;
}

function buildGeneratedUsername(role, sequenceNumber) {
  return `${String(role || '').trim().toUpperCase()}${padSixDigitSequence(sequenceNumber)}`;
}

function buildGeneratedPassword(role, birthdayValue, sequenceNumber) {
  if (!birthdayValue) return '';

  const date = new Date(birthdayValue);
  if (Number.isNaN(date.getTime())) return '';

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = months[date.getUTCMonth()] || '';

  return `${String(role || '').trim().toUpperCase()}${day}${month}@${padSixDigitSequence(sequenceNumber).slice(-4)}`;
}

function isFutureDateValue(value) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  date.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);

  return date.getTime() > today.getTime();
}

function sortByCreatedAtAsc(records) {
  return [...records].sort((left, right) => {
    const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftTime - rightTime;
  });
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function TimestampRow({ createdAt, updatedAt }) {
  return (
    <div className="aop-timestamp-row">
      <div>
        <span>Date Created</span>
        <strong>{formatDateTime(createdAt)}</strong>
      </div>
      <div>
        <span>Last Updated</span>
        <strong>{formatDateTime(updatedAt)}</strong>
      </div>
    </div>
  );
}

function ManagerAssignmentCard({ label, name, createdAt, updatedAt }) {
  return (
    <div className="aop-assignment-card">
      <span>{label}</span>
      <strong>{name || 'Unassigned'}</strong>
      <TimestampRow createdAt={createdAt} updatedAt={updatedAt} />
    </div>
  );
}

function SuccessModal({ isOpen, title, message, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="aop-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="aop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="aop-modal-close" aria-label="Close success modal" onClick={onClose}>×</button>
        <h3 id="success-modal-title">{title}</h3>
        <p>{message}</p>
      </div>
    </div>
  );
}

function UserPreviewCard({ title, subtitle, data, emptyMessage }) {
  return (
    <div className="aop-preview-card">
      <div className="aop-preview-head">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>

      {data ? (
        <div className="aop-preview-grid">
          <div>
            <span>Username</span>
            <strong>{data.username || '—'}</strong>
          </div>
          <div>
            <span>Name</span>
            <strong>{[data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ') || '—'}</strong>
          </div>
          <div>
            <span>Sex</span>
            <strong>{data.sex || '—'}</strong>
          </div>
          <div>
            <span>Birthday</span>
            <strong>{formatDateInput(data.birthday) || '—'}</strong>
          </div>
          <div>
            <span>Date Employed</span>
            <strong>{formatDateInput(data.dateEmployed) || '—'}</strong>
          </div>
          <div>
            <span>Current Assignment</span>
            <strong>
              {[data.areaName, data.branchName, data.unitName].filter(Boolean).join(' / ') || data.branchName || data.unitName || '—'}
            </strong>
          </div>
        </div>
      ) : (
        <p className="aop-preview-empty">{emptyMessage}</p>
      )}
    </div>
  );
}

function FormActionBar({ backLabel, onBack }) {
  return (
    <div className="aop-form-topbar">
      <button type="button" className="aop-close-btn" aria-label={backLabel} onClick={onBack}>←</button>
      <button type="button" className="aop-cancel-btn" onClick={onBack}>Cancel</button>
    </div>
  );
}

function AdminOrganizationPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formOptions, setFormOptions] = useState(EMPTY_FORM_OPTIONS);
  const [directoryData, setDirectoryData] = useState(EMPTY_DIRECTORY_DATA);
  const [addAreaForm, setAddAreaForm] = useState(EMPTY_AREA_FORM);
  const [editAreaId, setEditAreaId] = useState('');
  const [editAreaForm, setEditAreaForm] = useState(EMPTY_AREA_FORM);
  const [addBranchForm, setAddBranchForm] = useState(EMPTY_BRANCH_FORM);
  const [editBranchId, setEditBranchId] = useState('');
  const [editBranchForm, setEditBranchForm] = useState(EMPTY_BRANCH_FORM);
  const [addUnitForm, setAddUnitForm] = useState(EMPTY_UNIT_FORM);
  const [editUnitId, setEditUnitId] = useState('');
  const [editUnitForm, setEditUnitForm] = useState(EMPTY_UNIT_FORM);
  const [createManagerForm, setCreateManagerForm] = useState(EMPTY_MANAGER_CREATE_FORM);
  const [successModal, setSuccessModal] = useState({ open: false, title: '', message: '', onClose: null });
  const [addAgentForm, setAddAgentForm] = useState(EMPTY_AGENT_FORM);
  const [addAgentErrors, setAddAgentErrors] = useState({});
  const [addAgentPhotoName, setAddAgentPhotoName] = useState('');
  const [editAgentId, setEditAgentId] = useState('');
  const [editAgentForm, setEditAgentForm] = useState(EMPTY_AGENT_FORM);
  const [editAgentErrors, setEditAgentErrors] = useState({});
  const [editAgentPhotoName, setEditAgentPhotoName] = useState('');
  const [overviewSearch, setOverviewSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [areaView, setAreaView] = useState('list');
  const [branchView, setBranchView] = useState('list');
  const [unitView, setUnitView] = useState('list');
  const [managerView, setManagerView] = useState('list');
  const [agentView, setAgentView] = useState('list');
  const [managerTab, setManagerTab] = useState('BM');
  const [visibleManagerPasswords, setVisibleManagerPasswords] = useState({});
  const [isSavingManager, setIsSavingManager] = useState(false);
  const [visibleAgentPasswords, setVisibleAgentPasswords] = useState({});

  const adminUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || 'null');
    } catch {
      return null;
    }
  }, []);

  const resetMessages = () => {
    setStatusMessage('');
    setErrorMessage('');
  };

  const fetchOrganizationTree = useCallback(async (nextOverviewSearch = overviewSearch) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams();
      if (String(nextOverviewSearch || '').trim()) params.set('overviewSearch', String(nextOverviewSearch).trim());
      const query = params.toString();
      const res = await fetch(`http://localhost:5000/api/admin/organization/tree${query ? `?${query}` : ''}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to load organization structure.');
        setAreas([]);
        return;
      }

      setAreas(Array.isArray(data.areas) ? data.areas : []);
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
      setAreas([]);
    } finally {
      setIsLoading(false);
    }
  }, [overviewSearch]);

  const normalizeDirectoryPayload = useCallback((data) => ({
    areas: Array.isArray(data.areas) ? data.areas : [],
    branches: Array.isArray(data.branches) ? data.branches : [],
    units: Array.isArray(data.units) ? data.units : [],
    agents: Array.isArray(data.agents) ? data.agents : [],
    managers: {
      bm: Array.isArray(data.managers?.bm) ? data.managers.bm : [],
      um: Array.isArray(data.managers?.um) ? data.managers.um : [],
      aum: Array.isArray(data.managers?.aum) ? data.managers.aum : [],
    },
    managerSequences: {
      BM: Number(data.managerSequences?.BM) > 0 ? Number(data.managerSequences.BM) : 1,
      UM: Number(data.managerSequences?.UM) > 0 ? Number(data.managerSequences.UM) : 1,
      AUM: Number(data.managerSequences?.AUM) > 0 ? Number(data.managerSequences.AUM) : 1,
    },
  }), []);

  const fetchFormOptions = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/organization/form-options');
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to load admin form options.');
        return;
      }

      setFormOptions(normalizeDirectoryPayload(data));
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  }, [normalizeDirectoryPayload]);

  const fetchDirectoryData = useCallback(async ({ areaSearch: nextAreaSearch = areaSearch, branchSearch: nextBranchSearch = branchSearch, unitSearch: nextUnitSearch = unitSearch, managerSearch: nextManagerSearch = managerSearch, agentSearch: nextAgentSearch = agentSearch, managerType: nextManagerType = managerTab } = {}) => {
    setIsDirectoryLoading(true);

    try {
      const params = new URLSearchParams();
      if (nextAreaSearch.trim()) params.set('areaSearch', nextAreaSearch.trim());
      if (nextBranchSearch.trim()) params.set('branchSearch', nextBranchSearch.trim());
      if (nextUnitSearch.trim()) params.set('unitSearch', nextUnitSearch.trim());
      if (nextManagerSearch.trim()) params.set('managerSearch', nextManagerSearch.trim());
      if (nextAgentSearch.trim()) params.set('agentSearch', nextAgentSearch.trim());
      if (nextManagerType.trim()) params.set('managerType', nextManagerType.trim());

      const query = params.toString();
      const res = await fetch(`http://localhost:5000/api/admin/organization/list-data${query ? `?${query}` : ''}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to load admin list data.');
        setDirectoryData(EMPTY_DIRECTORY_DATA);
        return;
      }

      setDirectoryData(normalizeDirectoryPayload(data));
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
      setDirectoryData(EMPTY_DIRECTORY_DATA);
    } finally {
      setIsDirectoryLoading(false);
    }
  }, [agentSearch, areaSearch, branchSearch, managerSearch, managerTab, normalizeDirectoryPayload, unitSearch]);

  const refreshAdminData = useCallback(async () => {
    await Promise.all([fetchOrganizationTree(), fetchFormOptions(), fetchDirectoryData()]);
  }, [fetchDirectoryData, fetchFormOptions, fetchOrganizationTree]);

  useEffect(() => {
    document.title = 'PRUTracker | Admin Organization Management';

    if (!adminUser) {
      navigate('/admin/login');
      return;
    }

    refreshAdminData();
  }, [adminUser, navigate, refreshAdminData]);

  useEffect(() => {
    if (!adminUser) return undefined;

    const timeoutId = window.setTimeout(() => {
      fetchDirectoryData();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [adminUser, areaSearch, branchSearch, unitSearch, managerSearch, agentSearch, managerTab, fetchDirectoryData]);

  useEffect(() => {
    if (!adminUser) return undefined;

    const timeoutId = window.setTimeout(() => {
      fetchOrganizationTree();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [adminUser, overviewSearch, fetchOrganizationTree]);

  useEffect(() => {
    const branch = formOptions.branches.find((item) => item.id === editBranchId);
    setEditBranchForm(
      branch
        ? {
            branchName: branch.branchName || '',
            areaId: branch.areaId || '',
          }
        : EMPTY_BRANCH_FORM
    );
  }, [editBranchId, formOptions.branches]);

  useEffect(() => {
    const unit = formOptions.units.find((item) => item.id === editUnitId);
    setEditUnitForm(
      unit
        ? {
            unitName: unit.unitName || '',
            branchId: unit.branchId || '',
          }
        : EMPTY_UNIT_FORM
    );
  }, [editUnitId, formOptions.units]);

  useEffect(() => {
    const area = formOptions.areas.find((item) => item.id === editAreaId);
    setEditAreaForm(area ? { areaName: area.areaName || '' } : EMPTY_AREA_FORM);
  }, [editAreaId, formOptions.areas]);

  useEffect(() => {
    const agent = formOptions.agents.find((item) => item.agentId === editAgentId);
    setEditAgentPhotoName('');
    setEditAgentErrors({});
    setEditAgentForm(
      agent
        ? {
            username: agent.username || '',
            password: '',
            firstName: agent.firstName || '',
            middleName: agent.middleName || '',
            lastName: agent.lastName || '',
            birthday: formatDateInput(agent.birthday),
            sex: agent.sex || 'Male',
            age: agent.age || calculateAge(agent.birthday),
            displayPhoto: agent.displayPhoto || '',
            dateEmployed: formatDateInput(agent.dateEmployed),
            agentType: agent.agentType || 'Full-Time',
            unitId: agent.unitId || '',
          }
        : EMPTY_AGENT_FORM
    );
  }, [editAgentId, formOptions.agents]);

  const managerDirectory = useMemo(
    () => ({
      BM: formOptions.managers.bm,
      UM: formOptions.managers.um,
      AUM: formOptions.managers.aum,
    }),
    [formOptions.managers]
  );

  const selectedCreateManagerAgent = useMemo(
    () => formOptions.agents.find((agent) => agent.agentId === createManagerForm.sourceAgentId) || null,
    [createManagerForm.sourceAgentId, formOptions.agents]
  );

  const branchOptionsForManager = useMemo(() => {
    if (createManagerForm.managerType === 'BM') {
      return formOptions.branches;
    }

    const branchIds = new Set(
      formOptions.units
        .filter((unit) => !createManagerForm.branchId || unit.branchId === createManagerForm.branchId)
        .map((unit) => unit.branchId)
    );

    return formOptions.branches.filter((branch) => branchIds.has(branch.id));
  }, [createManagerForm.branchId, createManagerForm.managerType, formOptions.branches, formOptions.units]);

  const unitOptionsForManager = useMemo(
    () =>
      createManagerForm.managerType === 'BM'
        ? []
        : formOptions.units.filter((unit) => !createManagerForm.branchId || unit.branchId === createManagerForm.branchId),
    [createManagerForm.branchId, createManagerForm.managerType, formOptions.units]
  );

  const currentScopeManager = useMemo(() => {
    const managers = managerDirectory[createManagerForm.managerType] || [];

    if (createManagerForm.managerType === 'BM') {
      return managers.find((manager) => manager.branchId === createManagerForm.branchId && !manager.isBlocked) || null;
    }

    return managers.find((manager) => manager.unitId === createManagerForm.unitId && !manager.isBlocked) || null;
  }, [createManagerForm.branchId, createManagerForm.managerType, createManagerForm.unitId, managerDirectory]);

  const eligibleAgentsForManager = useMemo(() => {
    const currentManagerAgentId = currentScopeManager?.agentId || '';

    return formOptions.agents.filter((agent) => {
      if (agent.role !== 'AG') return false;
      if (currentManagerAgentId && agent.agentId === currentManagerAgentId) return false;

      if (createManagerForm.managerType === 'BM') {
        return !!createManagerForm.branchId && agent.branchId === createManagerForm.branchId;
      }

      return !!createManagerForm.unitId && agent.unitId === createManagerForm.unitId;
    });
  }, [createManagerForm.branchId, createManagerForm.managerType, createManagerForm.unitId, currentScopeManager?.agentId, formOptions.agents]);

  const selectedManagerBranch = useMemo(
    () => formOptions.branches.find((branch) => branch.id === createManagerForm.branchId) || null,
    [createManagerForm.branchId, formOptions.branches]
  );

  const selectedManagerUnit = useMemo(
    () => formOptions.units.find((unit) => unit.id === createManagerForm.unitId) || null,
    [createManagerForm.unitId, formOptions.units]
  );

  const nextManagerSequence = useMemo(() => {
    const configuredSequence = Number(formOptions.managerSequences?.[createManagerForm.managerType]);
    if (configuredSequence > 0) return configuredSequence;

    const usernames = (managerDirectory[createManagerForm.managerType] || []).map((manager) => manager.username);
    return getNextRoleSequence(usernames, createManagerForm.managerType);
  }, [createManagerForm.managerType, formOptions.managerSequences, managerDirectory]);

  const generatedManagerUsername = useMemo(
    () => buildGeneratedUsername(createManagerForm.managerType, nextManagerSequence),
    [createManagerForm.managerType, nextManagerSequence]
  );

  const generatedManagerPassword = useMemo(
    () => buildGeneratedPassword(createManagerForm.managerType, selectedCreateManagerAgent?.birthday, nextManagerSequence),
    [createManagerForm.managerType, nextManagerSequence, selectedCreateManagerAgent?.birthday]
  );

  useEffect(() => {
    if (createManagerForm.managerType === 'BM' && createManagerForm.unitId) {
      setCreateManagerForm((current) => ({ ...current, unitId: '', sourceAgentId: '', dateEmployed: '' }));
    }
  }, [createManagerForm.managerType, createManagerForm.unitId]);

  useEffect(() => {
    if (
      createManagerForm.managerType !== 'BM' &&
      createManagerForm.unitId &&
      !unitOptionsForManager.some((unit) => unit.id === createManagerForm.unitId)
    ) {
      setCreateManagerForm((current) => ({ ...current, unitId: '', sourceAgentId: '', dateEmployed: '' }));
    }
  }, [createManagerForm.managerType, createManagerForm.unitId, unitOptionsForManager]);

  useEffect(() => {
    if (
      createManagerForm.sourceAgentId &&
      !eligibleAgentsForManager.some((agent) => agent.agentId === createManagerForm.sourceAgentId)
    ) {
      setCreateManagerForm((current) => ({ ...current, sourceAgentId: '', dateEmployed: '' }));
    }
  }, [createManagerForm.sourceAgentId, eligibleAgentsForManager]);

  const totals = useMemo(() => {
    const branches = areas.reduce((sum, area) => sum + area.branches.length, 0);
    const units = areas.reduce(
      (sum, area) => sum + area.branches.reduce((branchSum, branch) => branchSum + branch.units.length, 0),
      0
    );
    const agents = areas.reduce(
      (sum, area) =>
        sum +
        area.branches.reduce(
          (branchSum, branch) => branchSum + branch.units.reduce((unitSum, unit) => unitSum + unit.agents.length, 0),
          0
        ),
      0
    );

    return { areas: areas.length, branches, units, agents };
  }, [areas]);

  const overviewCards = [
    { label: 'Areas', value: totals.areas, icon: FaSitemap },
    { label: 'Branches', value: totals.branches, icon: FaBuilding },
    { label: 'Units', value: totals.units, icon: FaProjectDiagram },
    { label: 'Agents', value: totals.agents, icon: FaUsers },
  ];

  const branchList = directoryData.branches;

  const unitList = directoryData.units;

  const managerList = useMemo(
    () =>
      ['BM', 'UM', 'AUM'].flatMap((type) =>
        (directoryData.managers[type.toLowerCase()] || []).map((manager) => ({ ...manager, managerType: type }))
      ),
    [directoryData.managers]
  );

  const filteredAreas = useMemo(() => sortByCreatedAtAsc(directoryData.areas), [directoryData.areas]);
  const filteredBranches = useMemo(() => sortByCreatedAtAsc(branchList), [branchList]);
  const filteredUnits = useMemo(() => sortByCreatedAtAsc(unitList), [unitList]);
  const filteredManagers = managerList;
  const filteredAgents = directoryData.agents;
  const nextAgentSequence = useMemo(() => getNextRoleSequence(formOptions.agents, 'AG'), [formOptions.agents]);
  const generatedAgentUsername = useMemo(() => buildGeneratedUsername('AG', nextAgentSequence), [nextAgentSequence]);
  const generatedAgentPassword = useMemo(
    () => buildGeneratedPassword('AG', addAgentForm.birthday, nextAgentSequence),
    [addAgentForm.birthday, nextAgentSequence]
  );
  const unitSelectionOptions = useMemo(
    () =>
      formOptions.units.map((unit) => ({
        ...unit,
        assignmentLabel: [unit.unitName, unit.branchName, unit.areaName].filter(Boolean).join(', '),
      })),
    [formOptions.units]
  );

  useEffect(() => {
    setAddAgentForm((current) => {
      if (current.username === generatedAgentUsername && current.password === generatedAgentPassword) {
        return current;
      }

      return {
        ...current,
        username: generatedAgentUsername,
        password: generatedAgentPassword,
      };
    });
  }, [generatedAgentPassword, generatedAgentUsername]);

  const closeSuccessModal = useCallback(() => {
    const onClose = successModal.onClose;
    setSuccessModal({ open: false, title: '', message: '', onClose: null });
    if (typeof onClose === 'function') onClose();
  }, [successModal]);

  const hasDuplicateAreaName = useCallback((areaName, excludeAreaId = '') => {
    const normalizedName = normalizeName(areaName);
    if (!normalizedName) return false;

    return formOptions.areas.some((area) => normalizeName(area.areaName) === normalizedName && String(area.id || '') !== String(excludeAreaId || ''));
  }, [formOptions.areas]);

  const hasDuplicateBranchName = useCallback((branchName, areaId, excludeBranchId = '') => {
    const normalizedName = normalizeName(branchName);
    if (!normalizedName || !areaId) return false;

    return formOptions.branches.some(
      (branch) =>
        String(branch.areaId || '') === String(areaId || '') &&
        normalizeName(branch.branchName) === normalizedName &&
        String(branch.id || '') !== String(excludeBranchId || '')
    );
  }, [formOptions.branches]);

  const hasDuplicateUnitName = useCallback((unitName, branchId, excludeUnitId = '') => {
    const normalizedName = normalizeName(unitName);
    if (!normalizedName || !branchId) return false;

    return formOptions.units.some(
      (unit) =>
        String(unit.branchId || '') === String(branchId || '') &&
        normalizeName(unit.unitName) === normalizedName &&
        String(unit.id || '') !== String(excludeUnitId || '')
    );
  }, [formOptions.units]);

  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('role');
    navigate('/admin/login');
  };

  const handleAddArea = async (e) => {
    e.preventDefault();
    resetMessages();

    const areaName = String(addAreaForm.areaName || '').trim();

    if (!areaName) {
      setErrorMessage('Area name is required.');
      return;
    }

    if (hasDuplicateAreaName(areaName)) {
      setErrorMessage('Area name already exists.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/admin/organization/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addAreaForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to add area.');
        return;
      }

      setAddAreaForm(EMPTY_AREA_FORM);
      await refreshAdminData();
      setSuccessModal({
        open: true,
        title: 'Area created successfully',
        message: data.message || 'Area created successfully.',
        onClose: () => setAreaView('list'),
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleEditArea = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!editAreaId) {
      setErrorMessage('Please choose an area to edit.');
      return;
    }

    const areaName = String(editAreaForm.areaName || '').trim();

    if (!areaName) {
      setErrorMessage('Area name is required.');
      return;
    }

    if (hasDuplicateAreaName(areaName, editAreaId)) {
      setErrorMessage('Area name already exists.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/organization/areas/${editAreaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editAreaForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to update area.');
        return;
      }

      await refreshAdminData();
      setSuccessModal({
        open: true,
        title: 'Area updated successfully',
        message: data.message || 'Area updated successfully.',
        onClose: () => setAreaView('list'),
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    resetMessages();

    const branchName = String(addBranchForm.branchName || '').trim();
    const areaId = String(addBranchForm.areaId || '').trim();

    if (!branchName) {
      setErrorMessage('Branch name is required.');
      return;
    }

    if (!areaId) {
      setErrorMessage('Please choose an area for this branch.');
      return;
    }

    if (hasDuplicateBranchName(branchName, areaId)) {
      setErrorMessage('Branch name already exists in the selected area.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/admin/organization/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addBranchForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to add branch.');
        return;
      }

      setAddBranchForm(EMPTY_BRANCH_FORM);
      await refreshAdminData();
      setSuccessModal({
        open: true,
        title: 'Branch created successfully',
        message: data.message || 'Branch created successfully.',
        onClose: () => setBranchView('list'),
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleEditBranch = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!editBranchId) {
      setErrorMessage('Please choose a branch to edit.');
      return;
    }

    const branchName = String(editBranchForm.branchName || '').trim();
    const areaId = String(editBranchForm.areaId || '').trim();

    if (!branchName) {
      setErrorMessage('Branch name is required.');
      return;
    }

    if (!areaId) {
      setErrorMessage('Please choose an area for this branch.');
      return;
    }

    if (hasDuplicateBranchName(branchName, areaId, editBranchId)) {
      setErrorMessage('Branch name already exists in the selected area.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/organization/branches/${editBranchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editBranchForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to update branch.');
        return;
      }

      await refreshAdminData();
      setSuccessModal({
        open: true,
        title: 'Branch updated successfully',
        message: data.message || 'Branch updated successfully.',
        onClose: () => setBranchView('list'),
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    resetMessages();

    const unitName = String(addUnitForm.unitName || '').trim();
    const branchId = String(addUnitForm.branchId || '').trim();

    if (!unitName) {
      setErrorMessage('Unit name is required.');
      return;
    }

    if (!branchId) {
      setErrorMessage('Please choose a branch for this unit.');
      return;
    }

    if (hasDuplicateUnitName(unitName, branchId)) {
      setErrorMessage('Unit name already exists in the selected branch.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/admin/organization/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addUnitForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to add unit.');
        return;
      }

      setAddUnitForm(EMPTY_UNIT_FORM);
      await refreshAdminData();
      setSuccessModal({
        open: true,
        title: 'Unit created successfully',
        message: data.message || 'Unit created successfully.',
        onClose: () => setUnitView('list'),
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleEditUnit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!editUnitId) {
      setErrorMessage('Please choose a unit to edit.');
      return;
    }

    const unitName = String(editUnitForm.unitName || '').trim();
    const branchId = String(editUnitForm.branchId || '').trim();

    if (!unitName) {
      setErrorMessage('Unit name is required.');
      return;
    }

    if (!branchId) {
      setErrorMessage('Please choose a branch for this unit.');
      return;
    }

    if (hasDuplicateUnitName(unitName, branchId, editUnitId)) {
      setErrorMessage('Unit name already exists in the selected branch.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/organization/units/${editUnitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUnitForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to update unit.');
        return;
      }

      await refreshAdminData();
      setSuccessModal({
        open: true,
        title: 'Unit updated successfully',
        message: data.message || 'Unit updated successfully.',
        onClose: () => setUnitView('list'),
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const validateAgentForm = useCallback((formValues, { isGeneratedPassword = false } = {}) => {
    const errors = {};

    if (!String(formValues.firstName || '').trim()) {
      errors.firstName = 'First name is required.';
    }

    if (!String(formValues.lastName || '').trim()) {
      errors.lastName = 'Last name is required.';
    }

    if (!formValues.birthday) {
      errors.birthday = 'Birthday is required.';
    } else if (isFutureDateValue(formValues.birthday)) {
      errors.birthday = 'Birthday cannot be in the future.';
    } else if (Number(calculateAge(formValues.birthday) || 0) < 21) {
      errors.birthday = 'Agent must be at least 21 years old.';
    }

    if (!formValues.dateEmployed) {
      errors.dateEmployed = 'Date employed is required.';
    } else if (isFutureDateValue(formValues.dateEmployed)) {
      errors.dateEmployed = 'Date employed cannot be in the future.';
    }

    if (!String(formValues.unitId || '').trim()) {
      errors.unitId = 'Assigned unit is required.';
    }

    if (!isGeneratedPassword && !String(formValues.username || '').trim()) {
      errors.username = 'Username is required.';
    }

    if (!String(formValues.password || '').trim()) {
      errors.password = 'Password cannot be generated until a valid birthday is selected.';
    }

    return errors;
  }, []);

  const handleAddAgentFieldChange = useCallback((field, value) => {
    handleAgentFieldChange(setAddAgentForm, field, value);

    setAddAgentErrors((current) => {
      const next = { ...current };

      if (field === 'birthday') {
        if (!value) {
          next.birthday = 'Birthday is required.';
        } else if (isFutureDateValue(value)) {
          next.birthday = 'Birthday cannot be in the future.';
        } else if (Number(calculateAge(value) || 0) < 21) {
          next.birthday = 'Agent must be at least 21 years old.';
        } else {
          delete next.birthday;
          delete next.password;
        }
      } else if (field === 'dateEmployed') {
        if (!value) {
          next.dateEmployed = 'Date employed is required.';
        } else if (isFutureDateValue(value)) {
          next.dateEmployed = 'Date employed cannot be in the future.';
        } else {
          delete next.dateEmployed;
        }
      } else if (field === 'unitId') {
        if (!value) {
          next.unitId = 'Assigned unit is required.';
        } else {
          delete next.unitId;
        }
      } else if (field === 'firstName' || field === 'lastName') {
        if (!String(value || '').trim()) {
          next[field] = `${field === 'firstName' ? 'First' : 'Last'} name is required.`;
        } else {
          delete next[field];
        }
      } else {
        delete next[field];
      }

      return next;
    });
  }, []);

  const handleAddAgentPhotoChange = useCallback((e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setAddAgentPhotoName('');
      setAddAgentForm((current) => ({ ...current, displayPhoto: '' }));
      setAddAgentErrors((current) => {
        const next = { ...current };
        delete next.displayPhoto;
        return next;
      });
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setAddAgentErrors((current) => ({ ...current, displayPhoto: 'Display photo must be a JPG, JPEG, or PNG file.' }));
      setAddAgentPhotoName('');
      setAddAgentForm((current) => ({ ...current, displayPhoto: '' }));
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAddAgentPhotoName(file.name);
      setAddAgentForm((current) => ({ ...current, displayPhoto: String(reader.result || '') }));
      setAddAgentErrors((current) => {
        const next = { ...current };
        delete next.displayPhoto;
        return next;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAddAgent = async (e) => {
    e.preventDefault();
    resetMessages();

    const payload = {
      ...addAgentForm,
      username: generatedAgentUsername,
      password: generatedAgentPassword,
      firstName: String(addAgentForm.firstName || '').trim(),
      middleName: String(addAgentForm.middleName || '').trim(),
      lastName: String(addAgentForm.lastName || '').trim(),
      age: calculateAge(addAgentForm.birthday),
    };

    const validationErrors = validateAgentForm(payload, { isGeneratedPassword: true });
    setAddAgentErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage('Please fix the highlighted Add Agent fields.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/admin/organization/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to add agent.');
        return;
      }

      setAddAgentErrors({});
      setAddAgentPhotoName('');
      setAddAgentForm(EMPTY_AGENT_FORM);
      await refreshAdminData();
      setSuccessModal({
        open: true,
        title: 'Agent created successfully',
        message: data.message || 'Agent created successfully.',
        onClose: () => setAgentView('list'),
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleEditAgentFieldChange = useCallback((field, value) => {
    handleAgentFieldChange(setEditAgentForm, field, value);

    setEditAgentErrors((current) => {
      const next = { ...current };

      if (field === 'birthday') {
        if (!value) {
          next.birthday = 'Birthday is required.';
        } else if (isFutureDateValue(value)) {
          next.birthday = 'Birthday cannot be in the future.';
        } else if (Number(calculateAge(value) || 0) < 21) {
          next.birthday = 'Agent must be at least 21 years old.';
        } else {
          delete next.birthday;
        }
      } else if (field === 'dateEmployed') {
        if (!value) {
          next.dateEmployed = 'Date employed is required.';
        } else if (isFutureDateValue(value)) {
          next.dateEmployed = 'Date employed cannot be in the future.';
        } else {
          delete next.dateEmployed;
        }
      } else if (field === 'unitId') {
        if (!value) {
          next.unitId = 'Assigned unit is required.';
        } else {
          delete next.unitId;
        }
      } else if (field === 'firstName' || field === 'lastName' || field === 'username') {
        if (!String(value || '').trim()) {
          next[field] = `${field === 'username' ? 'Username' : field === 'firstName' ? 'First' : 'Last'} is required.`;
        } else {
          delete next[field];
        }
      } else if (field === 'password') {
        delete next.password;
      } else {
        delete next[field];
      }

      return next;
    });
  }, []);

  const handleEditAgentPhotoChange = useCallback((e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setEditAgentPhotoName('');
      setEditAgentErrors((current) => {
        const next = { ...current };
        delete next.displayPhoto;
        return next;
      });
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setEditAgentErrors((current) => ({ ...current, displayPhoto: 'Display photo must be a JPG, JPEG, or PNG file.' }));
      setEditAgentPhotoName('');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditAgentPhotoName(file.name);
      setEditAgentForm((current) => ({ ...current, displayPhoto: String(reader.result || '') }));
      setEditAgentErrors((current) => {
        const next = { ...current };
        delete next.displayPhoto;
        return next;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleEditAgent = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!editAgentId) {
      setErrorMessage('Please choose an agent to edit.');
      return;
    }

    const payload = {
      ...editAgentForm,
      username: String(editAgentForm.username || '').trim().toUpperCase(),
      firstName: String(editAgentForm.firstName || '').trim(),
      middleName: String(editAgentForm.middleName || '').trim(),
      lastName: String(editAgentForm.lastName || '').trim(),
      age: calculateAge(editAgentForm.birthday),
    };

    const validationErrors = validateAgentForm(
      {
        ...payload,
        password: payload.password || 'existing-password',
      },
      { isGeneratedPassword: false }
    );
    setEditAgentErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage('Please fix the highlighted Edit Agent fields.');
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/organization/agents/${editAgentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to update agent.');
        return;
      }

      setEditAgentErrors({});
      setEditAgentPhotoName('');
      await refreshAdminData();
      setSuccessModal({
        open: true,
        title: 'Agent updated successfully',
        message: data.message || 'Agent updated successfully.',
        onClose: () => setAgentView('list'),
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
    if (isSavingManager) return;
    resetMessages();

    if (createManagerForm.managerType === 'BM' && !createManagerForm.branchId) {
      setErrorMessage('Please choose a branch before assigning a BM.');
      return;
    }

    if ((createManagerForm.managerType === 'UM' || createManagerForm.managerType === 'AUM') && !createManagerForm.unitId) {
      setErrorMessage(`Please choose a unit before assigning a ${createManagerForm.managerType}.`);
      return;
    }

    if (!createManagerForm.sourceAgentId) {
      setErrorMessage('Please choose an eligible agent for this manager assignment.');
      return;
    }

    if (!createManagerForm.dateEmployed) {
      setErrorMessage(`Please enter the date employed for this ${createManagerForm.managerType}.`);
      return;
    }

    if (isFutureDateValue(createManagerForm.dateEmployed)) {
      setErrorMessage('Date employed cannot be in the future.');
      return;
    }

    const agentDateEmployed = formatDateInput(selectedCreateManagerAgent?.dateEmployed);
    if (agentDateEmployed && createManagerForm.dateEmployed <= agentDateEmployed) {
      setErrorMessage(`Date employed as ${createManagerForm.managerType} must be after the selected agent date employed.`);
      return;
    }

    try {
      setIsSavingManager(true);
      const res = await fetch('http://localhost:5000/api/admin/organization/managers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createManagerForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to update manager assignment.');
        return;
      }

      const blockedName = data.blockedManager
        ? [data.blockedManager.firstName, data.blockedManager.lastName].filter(Boolean).join(' ') || data.blockedManager.username
        : '';
      const managerName =
        [data.manager?.firstName, data.manager?.lastName].filter(Boolean).join(' ') || data.manager?.username || 'Selected agent';

      setStatusMessage(data.message || 'Manager assignment updated successfully.');
      setSuccessModal({
        open: true,
        title: `${createManagerForm.managerType} assignment updated`,
        message: blockedName
          ? `${managerName} is now the active ${createManagerForm.managerType}. ${blockedName} has been blocked from the previous manager portal.`
          : `${managerName} is now the active ${createManagerForm.managerType}.`,
        onClose: () => setManagerView('list'),
      });
      setCreateManagerForm((current) => ({ ...EMPTY_MANAGER_CREATE_FORM, managerType: current.managerType }));
      await refreshAdminData();
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    } finally {
      setIsSavingManager(false);
    }
  };

  const handleAgentFieldChange = (setter, field, value) => {
    setter((current) => {
      const next = { ...current, [field]: value };
      if (field === 'birthday') {
        next.age = calculateAge(value);
      }
      return next;
    });
  };

  const togglePasswordVisibility = (setter, id) => {
    setter((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <div className="aop-page">
      <header className="aop-header">
        <div className="aop-header-inner no-back">
          <div className="aop-header-brand">
            <img src={logo} alt="PRUTracker Logo" className="aop-logo" />
            <div>
              <p>Admin Dashboard</p>
              <strong>Organization Management</strong>
            </div>
          </div>

          <div className="aop-header-user">
            <div className="aop-header-user-meta">
              <span>{adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin'}</span>
              <small>{adminUser?.username || 'admin'}</small>
            </div>
            <button type="button" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="aop-main">
        <section className="aop-hero aop-hero-admin">
          <div>
            <p className="aop-kicker">Frontend-first Admin Module</p>
            <h1>Organized setup for areas, branches, units, managers, and agents.</h1>
            <p className="aop-description">
              This workspace keeps the organization chart visible while grouping Admin forms into focused sections so you
              can set up hierarchy records and manager promotions more cleanly.
            </p>
          </div>

          <div className="aop-summary-grid">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label}>
                  <Icon />
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </article>
              );
            })}
          </div>
        </section>

        {(statusMessage || errorMessage) && (
          <div className={`aop-feedback ${errorMessage ? 'error' : 'success'}`}>
            {errorMessage || statusMessage}
          </div>
        )}

        <section className={`aop-workspace${isNavCollapsed ? ' nav-collapsed' : ''}`}>
          <AdminNav
            activeSection={activeSection}
            isCollapsed={isNavCollapsed}
            onToggle={() => setIsNavCollapsed((current) => !current)}
            onChange={(section) => { resetMessages(); setActiveSection(section); }}
          />

          <div className="aop-content-shell">
            {activeSection === 'overview' && (
              <section className="aop-section aop-section-tight">
                <div className="aop-section-head">
                  <h2>Organization Structure</h2>
                  <p>Review the live hierarchy and use the navigation on the left to open the setup forms you need.</p>
                </div>

                <div className="aop-list-toolbar">
                  <label className="aop-search" htmlFor="overview-search">
                    <input
                      id="overview-search"
                      type="search"
                      placeholder="Search area, branch, or unit name"
                      value={overviewSearch}
                      onChange={(e) => setOverviewSearch(e.target.value)}
                    />
                  </label>
                </div>

                {isLoading ? (
                  <div className="aop-empty-state">Loading organization structure...</div>
                ) : areas.length === 0 ? (
                  <div className="aop-empty-state">No areas found yet.</div>
                ) : (
                  <div className="aop-area-list">
                    {areas.map((area) => {
                      const nestedCounts = countNested(area);

                      return (
                        <article key={area.id} className="aop-area-card">
                          <div className="aop-area-head">
                            <div>
                              <p>Area</p>
                              <h3>{area.areaName}</h3>
                              <TimestampRow createdAt={area.createdAt} updatedAt={area.updatedAt} />
                            </div>
                            <span>
                              {nestedCounts.branches} Branch{nestedCounts.branches !== 1 ? 'es' : ''} · {nestedCounts.units} Unit
                              {nestedCounts.units !== 1 ? 's' : ''} · {nestedCounts.agents} Agent{nestedCounts.agents !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="aop-branch-list">
                            {area.branches.length === 0 ? (
                              <div className="aop-nested-empty">No branches found under this area yet.</div>
                            ) : (
                              area.branches.map((branch) => (
                                <section key={`${area.id}-${branch.id}`} className="aop-branch-card">
                                  <div className="aop-branch-head">
                                    <div>
                                      <p>Branch</p>
                                      <h4>{branch.branchName}</h4>
                                      <TimestampRow createdAt={branch.createdAt} updatedAt={branch.updatedAt} />
                                    </div>
                                    <ManagerAssignmentCard
                                      label="BM Assigned"
                                      name={branch.bm || 'Unassigned'}
                                      createdAt={branch.bmCreatedAt}
                                      updatedAt={branch.bmUpdatedAt}
                                    />
                                  </div>

                                  <div className="aop-unit-grid">
                                    {branch.units.length === 0 ? (
                                      <div className="aop-nested-empty light">No units found under this branch yet.</div>
                                    ) : (
                                      branch.units.map((unit) => (
                                        <article key={`${branch.id}-${unit.id}`} className="aop-unit-card">
                                          <div className="aop-unit-head">
                                            <p>Unit</p>
                                            <h5>{unit.unitName}</h5>
                                            <TimestampRow createdAt={unit.createdAt} updatedAt={unit.updatedAt} />
                                          </div>

                                          <div className="aop-assignment-grid">
                                            <ManagerAssignmentCard
                                              label="UM Assigned"
                                              name={unit.um || 'Unassigned'}
                                              createdAt={unit.umCreatedAt}
                                              updatedAt={unit.umUpdatedAt}
                                            />
                                            <ManagerAssignmentCard
                                              label="AUM Assigned"
                                              name={unit.aum || 'Unassigned'}
                                              createdAt={unit.aumCreatedAt}
                                              updatedAt={unit.aumUpdatedAt}
                                            />
                                          </div>

                                          <div className="aop-agent-list-wrap">
                                            <span className="aop-agent-label">Agents Under Unit</span>
                                            {unit.agents.length === 0 ? (
                                              <p className="aop-agent-empty">No agents found under this unit yet.</p>
                                            ) : (
                                              <ul className="aop-agent-list">
                                                {unit.agents.map((agent) => (
                                                  <li key={agent.id}>
                                                    <span>{agent.label}</span>
                                                    <TimestampRow createdAt={agent.createdAt} updatedAt={agent.updatedAt} />
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                          </div>
                                        </article>
                                      ))
                                    )}
                                  </div>
                                </section>
                              ))
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeSection === 'areas' && (
              <section className="aop-section aop-section-tight">
                {areaView === 'list' ? (
                  <>
                    <div className="aop-section-head">
                      <h2>All Areas</h2>
                      <p>Review every area record, search by area name, and open the area forms when needed.</p>
                    </div>

                    <div className="aop-list-toolbar">
                      <label className="aop-search" htmlFor="areas-search">
                        <input
                          id="areas-search"
                          type="search"
                          placeholder="Search area name"
                          value={areaSearch}
                          onChange={(e) => setAreaSearch(e.target.value)}
                        />
                      </label>

                      <div className="aop-toolbar-actions">
                        <button type="button" className="aop-action-btn" onClick={() => setAreaView('add')}>
                          Open Add Area
                        </button>
                        <button type="button" className="aop-action-btn" onClick={() => setAreaView('edit')}>
                          Open Edit Area
                        </button>
                      </div>
                    </div>

                    {isDirectoryLoading ? (
                      <div className="aop-empty-state">Loading areas...</div>
                    ) : filteredAreas.length === 0 ? (
                      <div className="aop-empty-state">No areas found.</div>
                    ) : (
                      <div className="aop-table-wrap">
                        <table className="aop-table">
                          <thead>
                            <tr>
                              <th>Area Name</th>
                              <th>Date Created</th>
                              <th>Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAreas.map((area) => (
                              <tr key={area.id}>
                                <td>{area.areaName}</td>
                                <td>{formatDateTime(area.createdAt)}</td>
                                <td>{formatDateTime(area.updatedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="aop-form-grid">
                    {areaView === 'add' ? (
                      <form className="aop-form-card" onSubmit={handleAddArea}>
                        <FormActionBar backLabel="Back to All Areas" onBack={() => setAreaView('list')} />
                        <div className="aop-form-head">
                          <FaPlus />
                          <div>
                            <h3>Add Area</h3>
                            <p>Create a top-level area record.</p>
                          </div>
                        </div>
                        <label htmlFor="add-area-name">Area Name</label>
                        <input
                          id="add-area-name"
                          value={addAreaForm.areaName}
                          onChange={(e) => setAddAreaForm({ areaName: e.target.value })}
                          placeholder="Enter area name"
                        />
                        <button type="submit">Save Area</button>
                      </form>
                    ) : (
                      <form className="aop-form-card" onSubmit={handleEditArea}>
                        <FormActionBar backLabel="Back to All Areas" onBack={() => setAreaView('list')} />
                        <div className="aop-form-head">
                          <FaUserEdit />
                          <div>
                            <h3>Edit Area</h3>
                            <p>Update an existing area name.</p>
                          </div>
                        </div>
                        <label htmlFor="edit-area-select">Select Area</label>
                        <select id="edit-area-select" value={editAreaId} onChange={(e) => setEditAreaId(e.target.value)}>
                          <option value="">Choose an area</option>
                          {formOptions.areas.map((area) => (
                            <option key={area.id} value={area.id}>{area.areaName}</option>
                          ))}
                        </select>
                        <label htmlFor="edit-area-name">Area Name</label>
                        <input
                          id="edit-area-name"
                          value={editAreaForm.areaName}
                          onChange={(e) => setEditAreaForm({ areaName: e.target.value })}
                          placeholder="Enter updated area name"
                        />
                        <button type="submit">Update Area</button>
                      </form>
                    )}
                  </div>
                )}
              </section>
            )}

            {activeSection === 'branches' && (
              <section className="aop-section aop-section-tight">
                {branchView === 'list' ? (
                  <>
                    <div className="aop-section-head">
                      <h2>All Branches</h2>
                      <p>Review every branch, search the list, and open the add or edit forms from the action bar.</p>
                    </div>

                    <div className="aop-list-toolbar">
                      <label className="aop-search" htmlFor="branches-search">
                        <input
                          id="branches-search"
                          type="search"
                          placeholder="Search branch or area"
                          value={branchSearch}
                          onChange={(e) => setBranchSearch(e.target.value)}
                        />
                      </label>

                      <div className="aop-toolbar-actions">
                        <button type="button" className="aop-action-btn" onClick={() => setBranchView('add')}>
                          Open Add Branch
                        </button>
                        <button type="button" className="aop-action-btn" onClick={() => setBranchView('edit')}>
                          Open Edit Branch
                        </button>
                      </div>
                    </div>

                    {isDirectoryLoading ? (
                      <div className="aop-empty-state">Loading branches...</div>
                    ) : filteredBranches.length === 0 ? (
                      <div className="aop-empty-state">No branches found.</div>
                    ) : (
                      <div className="aop-table-wrap">
                        <table className="aop-table">
                          <thead>
                            <tr>
                              <th>Branch Name</th>
                              <th>Area</th>
                              <th>Branch Manager</th>
                              <th>Date Created</th>
                              <th>Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBranches.map((branch) => (
                              <tr key={branch.id}>
                                <td>{branch.branchName}</td>
                                <td>{branch.areaName}</td>
                                <td>{branch.branchManager ? `${branch.branchManager.username} · ${[branch.branchManager.firstName, branch.branchManager.lastName].filter(Boolean).join(' ')}` : 'Unassigned'}</td>
                                <td>{formatDateTime(branch.createdAt)}</td>
                                <td>{formatDateTime(branch.updatedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="aop-form-grid">
                    {branchView === 'add' ? (
                      <form className="aop-form-card" onSubmit={handleAddBranch}>
                        <FormActionBar backLabel="Back to All Branches" onBack={() => setBranchView('list')} />
                        <div className="aop-form-head">
                          <FaBuilding />
                          <div>
                            <h3>Add Branch</h3>
                            <p>Create a branch under a selected area.</p>
                          </div>
                        </div>
                        <label htmlFor="add-branch-area">Parent Area</label>
                        <select
                          id="add-branch-area"
                          value={addBranchForm.areaId}
                          onChange={(e) => setAddBranchForm((current) => ({ ...current, areaId: e.target.value }))}
                        >
                          <option value="">Choose an area</option>
                          {formOptions.areas.map((area) => (
                            <option key={area.id} value={area.id}>{area.areaName}</option>
                          ))}
                        </select>
                        <label htmlFor="add-branch-name">Branch Name</label>
                        <input
                          id="add-branch-name"
                          value={addBranchForm.branchName}
                          onChange={(e) => setAddBranchForm((current) => ({ ...current, branchName: e.target.value }))}
                          placeholder="Enter branch name"
                        />
                        <button type="submit">Save Branch</button>
                      </form>
                    ) : (
                      <form className="aop-form-card" onSubmit={handleEditBranch}>
                        <FormActionBar backLabel="Back to All Branches" onBack={() => setBranchView('list')} />
                        <div className="aop-form-head">
                          <FaUserEdit />
                          <div>
                            <h3>Edit Branch</h3>
                            <p>Update branch details and area placement.</p>
                          </div>
                        </div>
                        <label htmlFor="edit-branch-select">Select Branch</label>
                        <select id="edit-branch-select" value={editBranchId} onChange={(e) => setEditBranchId(e.target.value)}>
                          <option value="">Choose a branch</option>
                          {formOptions.branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                          ))}
                        </select>
                        <label htmlFor="edit-branch-area">Parent Area</label>
                        <select
                          id="edit-branch-area"
                          value={editBranchForm.areaId}
                          onChange={(e) => setEditBranchForm((current) => ({ ...current, areaId: e.target.value }))}
                        >
                          <option value="">Choose an area</option>
                          {formOptions.areas.map((area) => (
                            <option key={area.id} value={area.id}>{area.areaName}</option>
                          ))}
                        </select>
                        <label htmlFor="edit-branch-name">Branch Name</label>
                        <input
                          id="edit-branch-name"
                          value={editBranchForm.branchName}
                          onChange={(e) => setEditBranchForm((current) => ({ ...current, branchName: e.target.value }))}
                          placeholder="Enter updated branch name"
                        />
                        <button type="submit">Update Branch</button>
                      </form>
                    )}
                  </div>
                )}
              </section>
            )}

            {activeSection === 'units' && (
              <section className="aop-section aop-section-tight">
                {unitView === 'list' ? (
                  <>
                    <div className="aop-section-head">
                      <h2>All Units</h2>
                      <p>Review every unit, search the list, and open the unit forms from the action bar.</p>
                    </div>

                    <div className="aop-list-toolbar">
                      <label className="aop-search" htmlFor="units-search">
                        <input
                          id="units-search"
                          type="search"
                          placeholder="Search unit, branch, or area"
                          value={unitSearch}
                          onChange={(e) => setUnitSearch(e.target.value)}
                        />
                      </label>

                      <div className="aop-toolbar-actions">
                        <button type="button" className="aop-action-btn" onClick={() => setUnitView('add')}>
                          Open Add Unit
                        </button>
                        <button type="button" className="aop-action-btn" onClick={() => setUnitView('edit')}>
                          Open Edit Unit
                        </button>
                      </div>
                    </div>

                    {isDirectoryLoading ? (
                      <div className="aop-empty-state">Loading units...</div>
                    ) : filteredUnits.length === 0 ? (
                      <div className="aop-empty-state">No units found.</div>
                    ) : (
                      <div className="aop-table-wrap">
                        <table className="aop-table">
                          <thead>
                            <tr>
                              <th>Unit Name</th>
                              <th>Branch</th>
                              <th>Area</th>
                              <th>UM</th>
                              <th>AUM</th>
                              <th>Date Created</th>
                              <th>Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUnits.map((unit) => (
                              <tr key={unit.id}>
                                <td>{unit.unitName}</td>
                                <td>{unit.branchName}</td>
                                <td>{unit.areaName}</td>
                                <td>{unit.umManager ? `${unit.umManager.username} · ${[unit.umManager.firstName, unit.umManager.lastName].filter(Boolean).join(' ')}` : 'Unassigned'}</td>
                                <td>{unit.aumManager ? `${unit.aumManager.username} · ${[unit.aumManager.firstName, unit.aumManager.lastName].filter(Boolean).join(' ')}` : 'Unassigned'}</td>
                                <td>{formatDateTime(unit.createdAt)}</td>
                                <td>{formatDateTime(unit.updatedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="aop-form-grid">
                    {unitView === 'add' ? (
                      <form className="aop-form-card" onSubmit={handleAddUnit}>
                        <FormActionBar backLabel="Back to All Units" onBack={() => setUnitView('list')} />
                        <div className="aop-form-head">
                          <FaProjectDiagram />
                          <div>
                            <h3>Add Unit</h3>
                            <p>Create a unit under a selected branch.</p>
                          </div>
                        </div>
                        <label htmlFor="add-unit-branch">Parent Branch</label>
                        <select
                          id="add-unit-branch"
                          value={addUnitForm.branchId}
                          onChange={(e) => setAddUnitForm((current) => ({ ...current, branchId: e.target.value }))}
                        >
                          <option value="">Choose a branch</option>
                          {formOptions.branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                          ))}
                        </select>
                        <label htmlFor="add-unit-name">Unit Name</label>
                        <input
                          id="add-unit-name"
                          value={addUnitForm.unitName}
                          onChange={(e) => setAddUnitForm((current) => ({ ...current, unitName: e.target.value }))}
                          placeholder="Enter unit name"
                        />
                        <button type="submit">Save Unit</button>
                      </form>
                    ) : (
                      <form className="aop-form-card" onSubmit={handleEditUnit}>
                        <FormActionBar backLabel="Back to All Units" onBack={() => setUnitView('list')} />
                        <div className="aop-form-head">
                          <FaUserEdit />
                          <div>
                            <h3>Edit Unit</h3>
                            <p>Update the unit name or move it to another branch.</p>
                          </div>
                        </div>
                        <label htmlFor="edit-unit-select">Select Unit</label>
                        <select id="edit-unit-select" value={editUnitId} onChange={(e) => setEditUnitId(e.target.value)}>
                          <option value="">Choose a unit</option>
                          {formOptions.units.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unit.unitName}</option>
                          ))}
                        </select>
                        <label htmlFor="edit-unit-branch">Parent Branch</label>
                        <select
                          id="edit-unit-branch"
                          value={editUnitForm.branchId}
                          onChange={(e) => setEditUnitForm((current) => ({ ...current, branchId: e.target.value }))}
                        >
                          <option value="">Choose a branch</option>
                          {formOptions.branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                          ))}
                        </select>
                        <label htmlFor="edit-unit-name">Unit Name</label>
                        <input
                          id="edit-unit-name"
                          value={editUnitForm.unitName}
                          onChange={(e) => setEditUnitForm((current) => ({ ...current, unitName: e.target.value }))}
                          placeholder="Enter updated unit name"
                        />
                        <button type="submit">Update Unit</button>
                      </form>
                    )}
                  </div>
                )}
              </section>
            )}

            {activeSection === 'managers' && (
              <section className="aop-section aop-section-tight">
                {managerView === 'list' ? (
                  <>
                    <div className="aop-section-head">
                      <h2>All Managers</h2>
                      <p>Review manager records using full user-schema details, then open the reassignment form when needed.</p>
                    </div>

                    <div className="aop-list-toolbar">
                      <label className="aop-search" htmlFor="managers-search">
                        <input
                          id="managers-search"
                          type="search"
                          placeholder="Search username or first/last name"
                          value={managerSearch}
                          onChange={(e) => setManagerSearch(e.target.value)}
                        />
                      </label>

                      <div className="aop-toolbar-actions">
                        {['BM', 'UM', 'AUM'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={`aop-action-btn${managerTab === type ? ' active' : ''}`}
                            onClick={() => setManagerTab(type)}
                          >
                            {type}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="aop-action-btn"
                          onClick={() => {
                            setCreateManagerForm({ ...EMPTY_MANAGER_CREATE_FORM, managerType: managerTab });
                            setManagerView('form');
                          }}
                        >
                          Open {managerTab} Assignment
                        </button>
                      </div>
                    </div>

                    {isDirectoryLoading ? (
                      <div className="aop-empty-state">Loading managers...</div>
                    ) : filteredManagers.length === 0 ? (
                      <div className="aop-empty-state">No active managers found.</div>
                    ) : (
                      <div className="aop-table-wrap aop-table-wrap-wide">
                        <table className="aop-table aop-table-compact">
                          <thead>
                            <tr>
                              <th>Role</th>
                              <th>Username</th>
                              <th>Password</th>
                              <th>First Name</th>
                              <th>Middle Name</th>
                              <th>Last Name</th>
                              <th>Birthday</th>
                              <th>Sex</th>
                              <th>Age</th>
                              <th>Display Photo</th>
                              <th>Date Employed</th>
                              <th>Area</th>
                              <th>Branch</th>
                              <th>Unit</th>
                              <th>Date Created</th>
                              <th>Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredManagers.map((manager) => (
                              <tr key={manager.managerId}>
                                <td>{manager.managerType}</td>
                                <td>{manager.username || '—'}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="aop-inline-link"
                                    onClick={() => togglePasswordVisibility(setVisibleManagerPasswords, manager.managerId)}
                                  >
                                    {visibleManagerPasswords[manager.managerId] ? manager.password || '—' : '••••••••'}
                                  </button>
                                </td>
                                <td>{manager.firstName || '—'}</td>
                                <td>{manager.middleName || '—'}</td>
                                <td>{manager.lastName || '—'}</td>
                                <td>{formatDateInput(manager.birthday) || '—'}</td>
                                <td>{manager.sex || '—'}</td>
                                <td>{manager.age || '—'}</td>
                                <td>{manager.displayPhoto ? <a className="aop-inline-link" href={manager.displayPhoto} target="_blank" rel="noreferrer">Preview</a> : '—'}</td>
                                <td>{formatDateInput(manager.dateEmployed) || '—'}</td>
                                <td>{manager.areaName || '—'}</td>
                                <td>{manager.branchName || '—'}</td>
                                <td>{manager.unitName || '—'}</td>
                                <td>{formatDateTime(manager.createdAt)}</td>
                                <td>{formatDateTime(manager.updatedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="aop-form-grid">
                    <form className="aop-form-card" onSubmit={handleCreateManager}>
                    <FormActionBar backLabel="Back to All Managers" onBack={() => setManagerView('list')} />
                    <div className="aop-form-head">
                      <FaUserTie />
                      <div>
                        <h3>Create Manager from Agent</h3>
                        <p>Changing a manager blocks the previous manager record from portal access.</p>
                      </div>
                    </div>
                    <label htmlFor="manager-type-create">Manager Type</label>
                    <select
                      id="manager-type-create"
                      value={createManagerForm.managerType}
                      onChange={(e) =>
                        setCreateManagerForm({
                          ...EMPTY_MANAGER_CREATE_FORM,
                          managerType: e.target.value,
                        })
                      }
                    >
                      <option value="BM">BM</option>
                      <option value="UM">UM</option>
                      <option value="AUM">AUM</option>
                    </select>

                    <label htmlFor="manager-branch-select">Select Branch</label>
                    <select
                      id="manager-branch-select"
                      value={createManagerForm.branchId}
                      onChange={(e) =>
                        setCreateManagerForm((current) => ({
                          ...current,
                          branchId: e.target.value,
                          unitId: '',
                          sourceAgentId: '',
                          dateEmployed: '',
                        }))
                      }
                    >
                      <option value="">{createManagerForm.managerType === 'BM' ? 'Choose a branch' : 'Choose a branch first'}</option>
                      {branchOptionsForManager.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                      ))}
                    </select>

                    {createManagerForm.managerType !== 'BM' && (
                      <>
                        <label htmlFor="manager-unit-select">Select Unit</label>
                        <select
                          id="manager-unit-select"
                          value={createManagerForm.unitId}
                          onChange={(e) =>
                            setCreateManagerForm((current) => ({
                              ...current,
                              unitId: e.target.value,
                              sourceAgentId: '',
                              dateEmployed: '',
                            }))
                          }
                          disabled={!createManagerForm.branchId}
                        >
                          <option value="">{createManagerForm.branchId ? 'Choose a unit' : 'Choose a branch first'}</option>
                          {unitOptionsForManager.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unit.unitName}</option>
                          ))}
                        </select>
                      </>
                    )}

                    <UserPreviewCard
                      title={`Current ${createManagerForm.managerType}`}
                      subtitle="This manager will be blocked from portal access once a new manager is assigned."
                      data={currentScopeManager}
                      emptyMessage={`No active ${createManagerForm.managerType} is assigned to the selected ${createManagerForm.managerType === 'BM' ? 'branch' : 'unit'} yet.`}
                    />

                    <div className="aop-form-note">
                      Scope:{' '}
                      {createManagerForm.managerType === 'BM'
                        ? selectedManagerBranch?.branchName || 'Choose a branch'
                        : [selectedManagerBranch?.branchName, selectedManagerUnit?.unitName].filter(Boolean).join(' / ') || 'Choose a branch and unit'}
                    </div>

                    <label htmlFor="manager-agent-select">Select Existing Agent</label>
                    <select
                      id="manager-agent-select"
                      value={createManagerForm.sourceAgentId}
                      onChange={(e) =>
                        setCreateManagerForm((current) => ({
                          ...current,
                          sourceAgentId: e.target.value,
                          dateEmployed: '',
                        }))
                      }
                      disabled={
                        createManagerForm.managerType === 'BM'
                          ? !createManagerForm.branchId
                          : !createManagerForm.branchId || !createManagerForm.unitId
                      }
                    >
                      <option value="">Choose an eligible agent</option>
                      {eligibleAgentsForManager.map((agent) => (
                        <option key={agent.agentId} value={agent.agentId}>
                          {agent.username} · {[agent.firstName, agent.lastName].filter(Boolean).join(' ')} · {agent.branchName}
                          {agent.unitName ? ` / ${agent.unitName}` : ''}
                        </option>
                      ))}
                    </select>

                    <UserPreviewCard
                      title="Selected Agent Details"
                      subtitle="Prefilled from the existing agent record."
                      data={selectedCreateManagerAgent}
                      emptyMessage="Choose an existing agent to prefill this manager setup form."
                    />

                    {selectedCreateManagerAgent ? (
                      <>
                        <div className="aop-inline-grid">
                          <div>
                            <label htmlFor="manager-generated-username">Generated Username</label>
                            <input id="manager-generated-username" value={generatedManagerUsername} readOnly />
                          </div>
                          <div>
                            <label htmlFor="manager-generated-password">Generated Password</label>
                            <div className="aop-password-field">
                              <input
                                id="manager-generated-password"
                                type={visibleManagerPasswords.newManagerPassword ? 'text' : 'password'}
                                value={generatedManagerPassword}
                                readOnly
                              />
                              <button
                                type="button"
                                className="aop-password-toggle"
                                onClick={() => togglePasswordVisibility(setVisibleManagerPasswords, 'newManagerPassword')}
                              >
                                {visibleManagerPasswords.newManagerPassword ? 'Hide' : 'Show'}
                              </button>
                            </div>
                            <p className="aop-field-note">
                              Generated using the {createManagerForm.managerType} credential rule and the selected agent birthday.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="manager-date-employed">Date Employed as {createManagerForm.managerType}</label>
                          <input
                            id="manager-date-employed"
                            type="date"
                            max={new Date().toISOString().slice(0, 10)}
                            value={createManagerForm.dateEmployed}
                            onChange={(e) => setCreateManagerForm((current) => ({ ...current, dateEmployed: e.target.value }))}
                          />
                          <p className="aop-field-note">
                            This must be after the selected agent employment date of {formatDateInput(selectedCreateManagerAgent.dateEmployed) || '—'}.
                          </p>
                        </div>
                      </>
                    ) : null}

                    <div className="aop-form-note">
                      Eligible choices only include active agent accounts in the selected scope and exclude the current assigned manager.
                      This assignment is now stored directly on the manager record for the selected branch or unit.
                    </div>

                    <button type="submit" disabled={isSavingManager}>{isSavingManager ? 'Saving Manager...' : 'Save Manager'}</button>
                    </form>
                  </div>
                )}
              </section>
            )}

            {activeSection === 'agents' && (
              <section className="aop-section aop-section-tight">
                {agentView === 'list' ? (
                  <>
                    <div className="aop-section-head">
                      <h2>All Agents</h2>
                      <p>Review all agent records using full user-schema details, then open the add or edit forms when needed.</p>
                    </div>

                    <div className="aop-list-toolbar">
                      <label className="aop-search" htmlFor="agents-search">
                        <input
                          id="agents-search"
                          type="search"
                          placeholder="Search username or first/last name"
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                        />
                      </label>

                      <div className="aop-toolbar-actions">
                        <button type="button" className="aop-action-btn" onClick={() => setAgentView('add')}>
                          Open Add Agent
                        </button>
                        <button type="button" className="aop-action-btn" onClick={() => setAgentView('edit')}>
                          Open Edit Agent
                        </button>
                      </div>
                    </div>

                    {isDirectoryLoading ? (
                      <div className="aop-empty-state">Loading agents...</div>
                    ) : filteredAgents.length === 0 ? (
                      <div className="aop-empty-state">No agents found.</div>
                    ) : (
                      <div className="aop-table-wrap aop-table-wrap-wide">
                        <table className="aop-table aop-table-wide">
                          <thead>
                            <tr>
                              <th>Username</th>
                              <th>Password</th>
                              <th>First Name</th>
                              <th>Middle Name</th>
                              <th>Last Name</th>
                              <th>Birthday</th>
                              <th>Sex</th>
                              <th>Age</th>
                              <th>Display Photo</th>
                              <th>Date Employed</th>
                              <th>Agent Type</th>
                              <th>Area</th>
                              <th>Branch</th>
                              <th>Unit</th>
                              <th>Date Created</th>
                              <th>Last Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAgents.map((agent) => (
                              <tr key={agent.agentId}>
                                <td>{agent.username || '—'}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="aop-inline-link"
                                    onClick={() => togglePasswordVisibility(setVisibleAgentPasswords, agent.agentId)}
                                  >
                                    {visibleAgentPasswords[agent.agentId] ? agent.password || '—' : '••••••••'}
                                  </button>
                                </td>
                                <td>{agent.firstName || '—'}</td>
                                <td>{agent.middleName || '—'}</td>
                                <td>{agent.lastName || '—'}</td>
                                <td>{formatDateInput(agent.birthday) || '—'}</td>
                                <td>{agent.sex || '—'}</td>
                                <td>{agent.age || '—'}</td>
                                <td>{agent.displayPhoto ? <a className="aop-inline-link" href={agent.displayPhoto} target="_blank" rel="noreferrer">Preview</a> : '—'}</td>
                                <td>{formatDateInput(agent.dateEmployed) || '—'}</td>
                                <td>{agent.agentType || '—'}</td>
                                <td>{agent.areaName || '—'}</td>
                                <td>{agent.branchName || '—'}</td>
                                <td>{agent.unitName || '—'}</td>
                                <td>{formatDateTime(agent.createdAt)}</td>
                                <td>{formatDateTime(agent.updatedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="aop-form-grid">
                    {agentView === 'add' ? (
                      <form className="aop-form-card" onSubmit={handleAddAgent}>
                        <FormActionBar backLabel="Back to All Agents" onBack={() => setAgentView('list')} />
                        <div className="aop-form-head">
                          <FaUsers />
                          <div>
                            <h3>Add Agent</h3>
                            <p>Username and password are auto-generated using the AG credential rule.</p>
                          </div>
                        </div>

                        <div className="aop-inline-grid">
                          <div>
                            <label htmlFor="agent-add-username">Username</label>
                            <input id="agent-add-username" value={generatedAgentUsername} readOnly />
                          </div>
                          <div>
                            <label htmlFor="agent-add-password">Password</label>
                            <div className="aop-password-field">
                              <input
                                id="agent-add-password"
                                type={visibleAgentPasswords.newAgentPassword ? 'text' : 'password'}
                                value={generatedAgentPassword}
                                readOnly
                              />
                              <button
                                type="button"
                                className="aop-password-toggle"
                                onClick={() => togglePasswordVisibility(setVisibleAgentPasswords, 'newAgentPassword')}
                              >
                                {visibleAgentPasswords.newAgentPassword ? 'Hide' : 'Show'}
                              </button>
                            </div>
                            {addAgentErrors.password ? <p className="aop-field-error">{addAgentErrors.password}</p> : null}
                          </div>
                        </div>

                        <div className="aop-inline-grid three-up">
                          <div>
                            <label htmlFor="agent-add-firstName">First Name</label>
                            <input id="agent-add-firstName" value={addAgentForm.firstName} onChange={(e) => handleAddAgentFieldChange('firstName', e.target.value)} />
                            {addAgentErrors.firstName ? <p className="aop-field-error">{addAgentErrors.firstName}</p> : null}
                          </div>
                          <div>
                            <label htmlFor="agent-add-middleName">Middle Name</label>
                            <input id="agent-add-middleName" value={addAgentForm.middleName} onChange={(e) => handleAddAgentFieldChange('middleName', e.target.value)} />
                          </div>
                          <div>
                            <label htmlFor="agent-add-lastName">Last Name</label>
                            <input id="agent-add-lastName" value={addAgentForm.lastName} onChange={(e) => handleAddAgentFieldChange('lastName', e.target.value)} />
                            {addAgentErrors.lastName ? <p className="aop-field-error">{addAgentErrors.lastName}</p> : null}
                          </div>
                        </div>

                        <div className="aop-inline-grid four-up">
                          <div>
                            <label htmlFor="agent-add-birthday">Birthday</label>
                            <input
                              id="agent-add-birthday"
                              type="date"
                              max={new Date().toISOString().slice(0, 10)}
                              value={addAgentForm.birthday}
                              onChange={(e) => handleAddAgentFieldChange('birthday', e.target.value)}
                            />
                            {addAgentErrors.birthday ? <p className="aop-field-error">{addAgentErrors.birthday}</p> : null}
                          </div>
                          <div>
                            <label htmlFor="agent-add-sex">Sex</label>
                            <select id="agent-add-sex" value={addAgentForm.sex} onChange={(e) => handleAddAgentFieldChange('sex', e.target.value)}>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="agent-add-age">Age</label>
                            <input id="agent-add-age" value={addAgentForm.age} readOnly />
                          </div>
                          <div>
                            <label htmlFor="agent-add-employed">Date Employed</label>
                            <input
                              id="agent-add-employed"
                              type="date"
                              max={new Date().toISOString().slice(0, 10)}
                              value={addAgentForm.dateEmployed}
                              onChange={(e) => handleAddAgentFieldChange('dateEmployed', e.target.value)}
                            />
                            {addAgentErrors.dateEmployed ? <p className="aop-field-error">{addAgentErrors.dateEmployed}</p> : null}
                          </div>
                        </div>

                        <div className="aop-inline-grid">
                          <div>
                            <label htmlFor="agent-add-photo">Display Photo</label>
                            <input
                              id="agent-add-photo"
                              type="file"
                              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                              onChange={handleAddAgentPhotoChange}
                            />
                            {addAgentPhotoName ? <p className="aop-field-note">Selected file: {addAgentPhotoName}</p> : null}
                            {addAgentErrors.displayPhoto ? <p className="aop-field-error">{addAgentErrors.displayPhoto}</p> : null}
                          </div>
                          <div>
                            <label htmlFor="agent-add-type">Agent Type</label>
                            <select id="agent-add-type" value={addAgentForm.agentType} onChange={(e) => handleAddAgentFieldChange('agentType', e.target.value)}>
                              <option value="Full-Time">Full-Time</option>
                              <option value="Part-Time">Part-Time</option>
                            </select>
                          </div>
                        </div>

                        <div className="aop-photo-preview-card">
                          <span>Display Photo Preview</span>
                          {addAgentForm.displayPhoto ? (
                            <div className="aop-photo-preview-body">
                              <img src={addAgentForm.displayPhoto} alt="New agent display preview" className="aop-photo-preview-image" />
                              <a className="aop-inline-link" href={addAgentForm.displayPhoto} target="_blank" rel="noreferrer">Preview selected image</a>
                            </div>
                          ) : (
                            <p className="aop-field-note">Upload a JPG or PNG to preview the agent display photo.</p>
                          )}
                        </div>

                        <label htmlFor="agent-add-unit">Assigned Unit</label>
                        <select id="agent-add-unit" value={addAgentForm.unitId} onChange={(e) => handleAddAgentFieldChange('unitId', e.target.value)}>
                          <option value="">Choose a unit</option>
                          {unitSelectionOptions.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unit.assignmentLabel}</option>
                          ))}
                        </select>
                        {addAgentErrors.unitId ? <p className="aop-field-error">{addAgentErrors.unitId}</p> : null}

                        <button type="submit">Save Agent</button>
                      </form>
                    ) : (
                      <form className="aop-form-card" onSubmit={handleEditAgent}>
                        <FormActionBar backLabel="Back to All Agents" onBack={() => setAgentView('list')} />
                        <div className="aop-form-head">
                          <FaUserEdit />
                          <div>
                            <h3>Edit Agent</h3>
                            <p>Select an existing agent to prefill editable details.</p>
                          </div>
                        </div>

                        <label htmlFor="agent-edit-select">Select Agent</label>
                        <select id="agent-edit-select" value={editAgentId} onChange={(e) => setEditAgentId(e.target.value)}>
                          <option value="">Choose an agent</option>
                          {formOptions.agents.map((agent) => (
                            <option key={agent.agentId} value={agent.agentId}>
                              {agent.username} · {[agent.firstName, agent.lastName].filter(Boolean).join(' ')}
                            </option>
                          ))}
                        </select>

                        <div className="aop-inline-grid">
                          <div>
                            <label htmlFor="agent-edit-username">Username</label>
                            <input id="agent-edit-username" value={editAgentForm.username} onChange={(e) => handleEditAgentFieldChange('username', e.target.value)} />
                            {editAgentErrors.username ? <p className="aop-field-error">{editAgentErrors.username}</p> : null}
                          </div>
                          <div>
                            <label htmlFor="agent-edit-password">Password</label>
                            <div className="aop-password-field">
                              <input
                                id="agent-edit-password"
                                type={visibleAgentPasswords.editAgentPassword ? 'text' : 'password'}
                                value={editAgentForm.password}
                                onChange={(e) => handleEditAgentFieldChange('password', e.target.value)}
                                placeholder="Leave blank to keep current password"
                              />
                              <button
                                type="button"
                                className="aop-password-toggle"
                                onClick={() => togglePasswordVisibility(setVisibleAgentPasswords, 'editAgentPassword')}
                              >
                                {visibleAgentPasswords.editAgentPassword ? 'Hide' : 'Show'}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="aop-inline-grid three-up">
                          <div>
                            <label htmlFor="agent-edit-firstName">First Name</label>
                            <input id="agent-edit-firstName" value={editAgentForm.firstName} onChange={(e) => handleEditAgentFieldChange('firstName', e.target.value)} />
                            {editAgentErrors.firstName ? <p className="aop-field-error">{editAgentErrors.firstName}</p> : null}
                          </div>
                          <div>
                            <label htmlFor="agent-edit-middleName">Middle Name</label>
                            <input id="agent-edit-middleName" value={editAgentForm.middleName} onChange={(e) => handleEditAgentFieldChange('middleName', e.target.value)} />
                          </div>
                          <div>
                            <label htmlFor="agent-edit-lastName">Last Name</label>
                            <input id="agent-edit-lastName" value={editAgentForm.lastName} onChange={(e) => handleEditAgentFieldChange('lastName', e.target.value)} />
                            {editAgentErrors.lastName ? <p className="aop-field-error">{editAgentErrors.lastName}</p> : null}
                          </div>
                        </div>

                        <div className="aop-inline-grid four-up">
                          <div>
                            <label htmlFor="agent-edit-birthday">Birthday</label>
                            <input id="agent-edit-birthday" type="date" max={new Date().toISOString().slice(0, 10)} value={editAgentForm.birthday} onChange={(e) => handleEditAgentFieldChange('birthday', e.target.value)} />
                            {editAgentErrors.birthday ? <p className="aop-field-error">{editAgentErrors.birthday}</p> : null}
                          </div>
                          <div>
                            <label htmlFor="agent-edit-sex">Sex</label>
                            <select id="agent-edit-sex" value={editAgentForm.sex} onChange={(e) => handleEditAgentFieldChange('sex', e.target.value)}>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="agent-edit-age">Age</label>
                            <input id="agent-edit-age" value={editAgentForm.age} readOnly />
                          </div>
                          <div>
                            <label htmlFor="agent-edit-employed">Date Employed</label>
                            <input id="agent-edit-employed" type="date" max={new Date().toISOString().slice(0, 10)} value={editAgentForm.dateEmployed} onChange={(e) => handleEditAgentFieldChange('dateEmployed', e.target.value)} />
                            {editAgentErrors.dateEmployed ? <p className="aop-field-error">{editAgentErrors.dateEmployed}</p> : null}
                          </div>
                        </div>

                        <div className="aop-inline-grid">
                          <div>
                            <label htmlFor="agent-edit-photo">Display Photo</label>
                            <input
                              id="agent-edit-photo"
                              type="file"
                              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                              onChange={handleEditAgentPhotoChange}
                            />
                            {editAgentPhotoName ? <p className="aop-field-note">Selected file: {editAgentPhotoName}</p> : null}
                            {editAgentErrors.displayPhoto ? <p className="aop-field-error">{editAgentErrors.displayPhoto}</p> : null}
                          </div>
                          <div>
                            <label htmlFor="agent-edit-type">Agent Type</label>
                            <select id="agent-edit-type" value={editAgentForm.agentType} onChange={(e) => handleEditAgentFieldChange('agentType', e.target.value)}>
                              <option value="Full-Time">Full-Time</option>
                              <option value="Part-Time">Part-Time</option>
                            </select>
                          </div>
                        </div>

                        <div className="aop-photo-preview-card">
                          <span>Current Display Photo</span>
                          {editAgentForm.displayPhoto ? (
                            <div className="aop-photo-preview-body">
                              <img src={editAgentForm.displayPhoto} alt="Current agent display" className="aop-photo-preview-image" />
                              <a className="aop-inline-link" href={editAgentForm.displayPhoto} target="_blank" rel="noreferrer">Preview current image</a>
                            </div>
                          ) : (
                            <p className="aop-field-note">No display photo uploaded yet.</p>
                          )}
                        </div>

                        <label htmlFor="agent-edit-unit">Assigned Unit</label>
                        <select id="agent-edit-unit" value={editAgentForm.unitId} onChange={(e) => handleEditAgentFieldChange('unitId', e.target.value)}>
                          <option value="">Choose a unit</option>
                          {unitSelectionOptions.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unit.assignmentLabel}</option>
                          ))}
                        </select>
                        {editAgentErrors.unitId ? <p className="aop-field-error">{editAgentErrors.unitId}</p> : null}

                        <button type="submit">Update Agent</button>
                      </form>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </section>
      </main>

      <SuccessModal
        isOpen={successModal.open}
        title={successModal.title}
        message={successModal.message}
        onClose={closeSuccessModal}
      />
    </div>
  );
}

export default AdminOrganizationPage;
