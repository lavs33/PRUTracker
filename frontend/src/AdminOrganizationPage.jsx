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
const EMPTY_MANAGER_CREATE_FORM = { managerType: 'UM', sourceAgentId: '', branchId: '', unitId: '' };
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
const EMPTY_FORM_OPTIONS = {
  areas: [],
  branches: [],
  units: [],
  agents: [],
  managers: { bm: [], um: [], aum: [] },
};

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
        aria-labelledby="manager-success-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="manager-success-title">{title}</h3>
        <p>{message}</p>
        <button type="button" onClick={onClose}>Close</button>
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

function AdminOrganizationPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formOptions, setFormOptions] = useState(EMPTY_FORM_OPTIONS);
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
  const [managerSuccessModal, setManagerSuccessModal] = useState({ open: false, title: '', message: '' });
  const [addAgentForm, setAddAgentForm] = useState(EMPTY_AGENT_FORM);
  const [editAgentId, setEditAgentId] = useState('');
  const [editAgentForm, setEditAgentForm] = useState(EMPTY_AGENT_FORM);

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

  const fetchOrganizationTree = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('http://localhost:5000/api/admin/organization/tree');
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
  }, []);

  const fetchFormOptions = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/organization/form-options');
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to load admin form options.');
        return;
      }

      setFormOptions({
        areas: Array.isArray(data.areas) ? data.areas : [],
        branches: Array.isArray(data.branches) ? data.branches : [],
        units: Array.isArray(data.units) ? data.units : [],
        agents: Array.isArray(data.agents) ? data.agents : [],
        managers: {
          bm: Array.isArray(data.managers?.bm) ? data.managers.bm : [],
          um: Array.isArray(data.managers?.um) ? data.managers.um : [],
          aum: Array.isArray(data.managers?.aum) ? data.managers.aum : [],
        },
      });
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  }, []);

  const refreshAdminData = useCallback(async () => {
    await Promise.all([fetchOrganizationTree(), fetchFormOptions()]);
  }, [fetchFormOptions, fetchOrganizationTree]);

  useEffect(() => {
    document.title = 'PRUTracker | Admin Organization Management';

    if (!adminUser) {
      navigate('/admin/login');
      return;
    }

    refreshAdminData();
  }, [adminUser, navigate, refreshAdminData]);

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

  useEffect(() => {
    if (createManagerForm.managerType === 'BM' && createManagerForm.unitId) {
      setCreateManagerForm((current) => ({ ...current, unitId: '', sourceAgentId: '' }));
    }
  }, [createManagerForm.managerType, createManagerForm.unitId]);

  useEffect(() => {
    if (
      createManagerForm.managerType !== 'BM' &&
      createManagerForm.unitId &&
      !unitOptionsForManager.some((unit) => unit.id === createManagerForm.unitId)
    ) {
      setCreateManagerForm((current) => ({ ...current, unitId: '', sourceAgentId: '' }));
    }
  }, [createManagerForm.managerType, createManagerForm.unitId, unitOptionsForManager]);

  useEffect(() => {
    if (
      createManagerForm.sourceAgentId &&
      !eligibleAgentsForManager.some((agent) => agent.agentId === createManagerForm.sourceAgentId)
    ) {
      setCreateManagerForm((current) => ({ ...current, sourceAgentId: '' }));
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

  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('role');
    navigate('/admin/login');
  };

  const handleAddArea = async (e) => {
    e.preventDefault();
    resetMessages();

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

      setStatusMessage(data.message || 'Area created successfully.');
      setAddAreaForm(EMPTY_AREA_FORM);
      await refreshAdminData();
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

      setStatusMessage(data.message || 'Area updated successfully.');
      await refreshAdminData();
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    resetMessages();

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

      setStatusMessage(data.message || 'Branch created successfully.');
      setAddBranchForm(EMPTY_BRANCH_FORM);
      await refreshAdminData();
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

      setStatusMessage(data.message || 'Branch updated successfully.');
      await refreshAdminData();
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    resetMessages();

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

      setStatusMessage(data.message || 'Unit created successfully.');
      setAddUnitForm(EMPTY_UNIT_FORM);
      await refreshAdminData();
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

      setStatusMessage(data.message || 'Unit updated successfully.');
      await refreshAdminData();
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
    }
  };

  const setScaffoldMessage = (label) => {
    resetMessages();
    setStatusMessage(`${label} form is now organized in the Admin UI with prefills and selection helpers. Backend save wiring is the next step.`);
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
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

    try {
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
      setManagerSuccessModal({
        open: true,
        title: `${createManagerForm.managerType} assignment updated`,
        message: blockedName
          ? `${managerName} is now the active ${createManagerForm.managerType}. ${blockedName} has been blocked from the previous manager portal.`
          : `${managerName} is now the active ${createManagerForm.managerType}.`,
      });
      setCreateManagerForm((current) => ({ ...EMPTY_MANAGER_CREATE_FORM, managerType: current.managerType }));
      await refreshAdminData();
    } catch {
      setErrorMessage('Cannot connect to server. Is backend running?');
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
                <div className="aop-section-head">
                  <h2>Area Forms</h2>
                  <p>Area add and edit remain connected to the current backend endpoints.</p>
                </div>

                <div className="aop-form-grid two-up">
                  <form className="aop-form-card" onSubmit={handleAddArea}>
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

                  <form className="aop-form-card" onSubmit={handleEditArea}>
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
                </div>
              </section>
            )}

            {activeSection === 'branches' && (
              <section className="aop-section aop-section-tight">
                <div className="aop-section-head">
                  <h2>Branch Forms</h2>
                  <p>Branch forms are organized with area pickers so placement stays clear.</p>
                </div>

                <div className="aop-form-grid two-up">
                  <form className="aop-form-card" onSubmit={handleAddBranch}>
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

                  <form className="aop-form-card" onSubmit={handleEditBranch}>
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
                </div>
              </section>
            )}

            {activeSection === 'units' && (
              <section className="aop-section aop-section-tight">
                <div className="aop-section-head">
                  <h2>Unit Forms</h2>
                  <p>Units are grouped under branches, with clean add and edit cards.</p>
                </div>

                <div className="aop-form-grid two-up">
                  <form className="aop-form-card" onSubmit={handleAddUnit}>
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

                  <form className="aop-form-card" onSubmit={handleEditUnit}>
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
                </div>
              </section>
            )}

            {activeSection === 'managers' && (
              <section className="aop-section aop-section-tight">
                <div className="aop-section-head">
                  <h2>Manager Reassignment</h2>
                  <p>Choose the target branch or unit first, review the current manager, then assign a new manager from eligible agents in that same scope.</p>
                </div>

                <div className="aop-form-grid two-up">
                  <form className="aop-form-card" onSubmit={handleCreateManager}>
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
                      onChange={(e) => setCreateManagerForm((current) => ({ ...current, sourceAgentId: e.target.value }))}
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

                    <div className="aop-form-note">
                      Eligible choices only include active agent accounts in the selected scope and exclude the current assigned manager.
                    </div>

                    <button type="submit">Save Manager</button>
                  </form>

                  <div className="aop-form-card">
                    <div className="aop-form-head">
                      <FaUsers />
                      <div>
                        <h3>Active Manager Directory</h3>
                        <p>Edit manager reassignment is intentionally paused for now. Use the reassignment flow on the left for changes.</p>
                      </div>
                    </div>
                    <div className="aop-directory-grid">
                      {['BM', 'UM', 'AUM'].map((type) => (
                        <div key={type} className="aop-directory-card">
                          <strong>{type} Records</strong>
                          {(managerDirectory[type] || []).filter((manager) => !manager.isBlocked).length === 0 ? (
                            <p className="aop-preview-empty">No active {type} records yet.</p>
                          ) : (
                            <ul className="aop-directory-list">
                              {(managerDirectory[type] || [])
                                .filter((manager) => !manager.isBlocked)
                                .map((manager) => (
                                  <li key={manager.managerId}>
                                    <span>
                                      {manager.username} · {[manager.firstName, manager.lastName].filter(Boolean).join(' ')}
                                    </span>
                                    <small>
                                      {type === 'BM'
                                        ? manager.branchName || 'Unassigned branch'
                                        : [manager.branchName, manager.unitName].filter(Boolean).join(' / ') || 'Unassigned unit'}
                                    </small>
                                    <TimestampRow createdAt={manager.createdAt} updatedAt={manager.updatedAt} />
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'agents' && (
              <section className="aop-section aop-section-tight">
                <div className="aop-section-head">
                  <h2>Agent Forms</h2>
                  <p>Agent setup mirrors the `User` plus `Agent` schema fields, with editable details and unit assignment.</p>
                </div>

                <div className="aop-form-grid two-up">
                  <form className="aop-form-card" onSubmit={(e) => { e.preventDefault(); setScaffoldMessage('Agent add'); }}>
                    <div className="aop-form-head">
                      <FaUsers />
                      <div>
                        <h3>Add Agent</h3>
                        <p>Enter the base user details plus agent-specific fields.</p>
                      </div>
                    </div>

                    <div className="aop-inline-grid">
                      <div>
                        <label htmlFor="agent-add-username">Username</label>
                        <input id="agent-add-username" value={addAgentForm.username} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'username', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-add-password">Password</label>
                        <input id="agent-add-password" type="password" value={addAgentForm.password} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'password', e.target.value)} />
                      </div>
                    </div>

                    <div className="aop-inline-grid three-up">
                      <div>
                        <label htmlFor="agent-add-firstName">First Name</label>
                        <input id="agent-add-firstName" value={addAgentForm.firstName} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'firstName', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-add-middleName">Middle Name</label>
                        <input id="agent-add-middleName" value={addAgentForm.middleName} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'middleName', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-add-lastName">Last Name</label>
                        <input id="agent-add-lastName" value={addAgentForm.lastName} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'lastName', e.target.value)} />
                      </div>
                    </div>

                    <div className="aop-inline-grid four-up">
                      <div>
                        <label htmlFor="agent-add-birthday">Birthday</label>
                        <input id="agent-add-birthday" type="date" value={addAgentForm.birthday} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'birthday', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-add-sex">Sex</label>
                        <select id="agent-add-sex" value={addAgentForm.sex} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'sex', e.target.value)}>
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
                        <input id="agent-add-employed" type="date" value={addAgentForm.dateEmployed} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'dateEmployed', e.target.value)} />
                      </div>
                    </div>

                    <div className="aop-inline-grid">
                      <div>
                        <label htmlFor="agent-add-photo">Display Photo URL</label>
                        <input id="agent-add-photo" value={addAgentForm.displayPhoto} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'displayPhoto', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-add-type">Agent Type</label>
                        <select id="agent-add-type" value={addAgentForm.agentType} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'agentType', e.target.value)}>
                          <option value="Full-Time">Full-Time</option>
                          <option value="Part-Time">Part-Time</option>
                        </select>
                      </div>
                    </div>

                    <label htmlFor="agent-add-unit">Assigned Unit</label>
                    <select id="agent-add-unit" value={addAgentForm.unitId} onChange={(e) => handleAgentFieldChange(setAddAgentForm, 'unitId', e.target.value)}>
                      <option value="">Choose a unit</option>
                      {formOptions.units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.unitName}</option>
                      ))}
                    </select>

                    <button type="submit">Save Agent</button>
                  </form>

                  <form className="aop-form-card" onSubmit={(e) => { e.preventDefault(); setScaffoldMessage('Agent edit'); }}>
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
                        <input id="agent-edit-username" value={editAgentForm.username} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'username', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-edit-password">Password</label>
                        <input id="agent-edit-password" type="password" value={editAgentForm.password} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'password', e.target.value)} placeholder="Leave blank to keep current password" />
                      </div>
                    </div>

                    <div className="aop-inline-grid three-up">
                      <div>
                        <label htmlFor="agent-edit-firstName">First Name</label>
                        <input id="agent-edit-firstName" value={editAgentForm.firstName} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'firstName', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-edit-middleName">Middle Name</label>
                        <input id="agent-edit-middleName" value={editAgentForm.middleName} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'middleName', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-edit-lastName">Last Name</label>
                        <input id="agent-edit-lastName" value={editAgentForm.lastName} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'lastName', e.target.value)} />
                      </div>
                    </div>

                    <div className="aop-inline-grid four-up">
                      <div>
                        <label htmlFor="agent-edit-birthday">Birthday</label>
                        <input id="agent-edit-birthday" type="date" value={editAgentForm.birthday} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'birthday', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-edit-sex">Sex</label>
                        <select id="agent-edit-sex" value={editAgentForm.sex} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'sex', e.target.value)}>
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
                        <input id="agent-edit-employed" type="date" value={editAgentForm.dateEmployed} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'dateEmployed', e.target.value)} />
                      </div>
                    </div>

                    <div className="aop-inline-grid">
                      <div>
                        <label htmlFor="agent-edit-photo">Display Photo URL</label>
                        <input id="agent-edit-photo" value={editAgentForm.displayPhoto} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'displayPhoto', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="agent-edit-type">Agent Type</label>
                        <select id="agent-edit-type" value={editAgentForm.agentType} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'agentType', e.target.value)}>
                          <option value="Full-Time">Full-Time</option>
                          <option value="Part-Time">Part-Time</option>
                        </select>
                      </div>
                    </div>

                    <label htmlFor="agent-edit-unit">Assigned Unit</label>
                    <select id="agent-edit-unit" value={editAgentForm.unitId} onChange={(e) => handleAgentFieldChange(setEditAgentForm, 'unitId', e.target.value)}>
                      <option value="">Choose a unit</option>
                      {formOptions.units.map((unit) => (
                        <option key={unit.id} value={unit.id}>{unit.unitName}</option>
                      ))}
                    </select>

                    <button type="submit">Update Agent</button>
                  </form>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>

      <SuccessModal
        isOpen={managerSuccessModal.open}
        title={managerSuccessModal.title}
        message={managerSuccessModal.message}
        onClose={() => setManagerSuccessModal({ open: false, title: '', message: '' })}
      />
    </div>
  );
}

export default AdminOrganizationPage;
