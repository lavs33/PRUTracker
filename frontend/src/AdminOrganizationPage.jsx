import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBuilding,
  FaPlus,
  FaProjectDiagram,
  FaSearch,
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
const EMPTY_MANAGER_EDIT_FORM = { managerType: 'UM', managerRecordId: '', branchId: '', unitId: '' };
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
  const [areas, setAreas] = useState([]);
  const [query, setQuery] = useState('');
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
  const [editManagerForm, setEditManagerForm] = useState(EMPTY_MANAGER_EDIT_FORM);
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

  const fetchOrganizationTree = async (areaSearch = query) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/organization/tree?areaSearch=${encodeURIComponent(areaSearch)}`
      );
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
  };

  const fetchFormOptions = async () => {
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
  };

  const refreshAdminData = async (areaSearch = query) => {
    await Promise.all([fetchOrganizationTree(areaSearch), fetchFormOptions()]);
  };

  useEffect(() => {
    document.title = 'PRUTracker | Admin Organization Management';

    if (!adminUser) {
      navigate('/admin/login');
      return;
    }

    refreshAdminData();
  }, [adminUser, navigate]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchOrganizationTree(query);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query]);

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

  const selectedEditManager = useMemo(
    () =>
      managerDirectory[editManagerForm.managerType]?.find(
        (manager) => manager.managerId === editManagerForm.managerRecordId
      ) || null,
    [editManagerForm.managerRecordId, editManagerForm.managerType, managerDirectory]
  );

  useEffect(() => {
    if (!selectedEditManager) return;

    setEditManagerForm((current) => ({
      ...current,
      branchId: selectedEditManager.branchId || '',
      unitId: selectedEditManager.unitId || '',
    }));
  }, [selectedEditManager]);

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

  const setScaffoldMessage = (label) => {
    resetMessages();
    setStatusMessage(`${label} form is now organized in the Admin UI with prefills and selection helpers. Backend save wiring is the next step.`);
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
            <span>{adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin'}</span>
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

        <section className="aop-workspace">
          <AdminNav activeSection={activeSection} onChange={(section) => { resetMessages(); setActiveSection(section); }} />

          <div className="aop-content-shell">
            {activeSection === 'overview' && (
              <section className="aop-section aop-section-tight">
                <div className="aop-section-head">
                  <h2>Organization Structure</h2>
                  <p>Search the live hierarchy and use the navigation on the left to open the setup forms you need.</p>
                </div>

                <div className="aop-toolbar">
                  <label className="aop-search" htmlFor="area-search">
                    <FaSearch />
                    <input
                      id="area-search"
                      type="search"
                      placeholder="Search area"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>

                {isLoading ? (
                  <div className="aop-empty-state">Loading organization structure...</div>
                ) : areas.length === 0 ? (
                  <div className="aop-empty-state">No matching areas found.</div>
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
                                    </div>
                                    <div className="aop-manager-pill">
                                      <span>BM Assigned</span>
                                      <strong>{branch.bm || 'Unassigned'}</strong>
                                    </div>
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
                                          </div>

                                          <div className="aop-assignment-grid">
                                            <div>
                                              <span>UM Assigned</span>
                                              <strong>{unit.um || 'Unassigned'}</strong>
                                            </div>
                                            <div>
                                              <span>AUM Assigned</span>
                                              <strong>{unit.aum || 'Unassigned'}</strong>
                                            </div>
                                          </div>

                                          <div className="aop-agent-list-wrap">
                                            <span className="aop-agent-label">Agents Under Unit</span>
                                            {unit.agents.length === 0 ? (
                                              <p className="aop-agent-empty">No agents found under this unit yet.</p>
                                            ) : (
                                              <ul className="aop-agent-list">
                                                {unit.agents.map((agent) => (
                                                  <li key={agent.id}>{agent.label}</li>
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
                  <form className="aop-form-card" onSubmit={(e) => { e.preventDefault(); setScaffoldMessage('Branch add'); }}>
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
                    <button type="submit">Prepare Branch</button>
                  </form>

                  <form className="aop-form-card" onSubmit={(e) => { e.preventDefault(); setScaffoldMessage('Branch edit'); }}>
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
                    <button type="submit">Prepare Update</button>
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
                  <form className="aop-form-card" onSubmit={(e) => { e.preventDefault(); setScaffoldMessage('Unit add'); }}>
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
                    <button type="submit">Prepare Unit</button>
                  </form>

                  <form className="aop-form-card" onSubmit={(e) => { e.preventDefault(); setScaffoldMessage('Unit edit'); }}>
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
                    <button type="submit">Prepare Update</button>
                  </form>
                </div>
              </section>
            )}

            {activeSection === 'managers' && (
              <section className="aop-section aop-section-tight">
                <div className="aop-section-head">
                  <h2>Manager Forms</h2>
                  <p>Select an existing agent to prefill promotion details for BM, UM, or AUM setup.</p>
                </div>

                <div className="aop-form-grid two-up">
                  <form className="aop-form-card" onSubmit={(e) => { e.preventDefault(); setScaffoldMessage('Manager promotion'); }}>
                    <div className="aop-form-head">
                      <FaUserTie />
                      <div>
                        <h3>Create Manager from Agent</h3>
                        <p>All managers are selected from existing agent records first.</p>
                      </div>
                    </div>
                    <label htmlFor="manager-type-create">Manager Type</label>
                    <select
                      id="manager-type-create"
                      value={createManagerForm.managerType}
                      onChange={(e) => setCreateManagerForm((current) => ({ ...current, managerType: e.target.value, branchId: '', unitId: '' }))}
                    >
                      <option value="BM">BM</option>
                      <option value="UM">UM</option>
                      <option value="AUM">AUM</option>
                    </select>
                    <label htmlFor="manager-agent-select">Select Existing Agent</label>
                    <select
                      id="manager-agent-select"
                      value={createManagerForm.sourceAgentId}
                      onChange={(e) => setCreateManagerForm((current) => ({ ...current, sourceAgentId: e.target.value }))}
                    >
                      <option value="">Choose an agent</option>
                      {formOptions.agents.map((agent) => (
                        <option key={agent.agentId} value={agent.agentId}>
                          {agent.username} · {[agent.firstName, agent.lastName].filter(Boolean).join(' ')}
                        </option>
                      ))}
                    </select>

                    <UserPreviewCard
                      title="Selected Agent Details"
                      subtitle="Prefilled from the existing agent record."
                      data={selectedCreateManagerAgent}
                      emptyMessage="Choose an existing agent to prefill this manager setup form."
                    />

                    {createManagerForm.managerType === 'BM' ? (
                      <>
                        <label htmlFor="manager-branch-create">Assign Branch</label>
                        <select
                          id="manager-branch-create"
                          value={createManagerForm.branchId}
                          onChange={(e) => setCreateManagerForm((current) => ({ ...current, branchId: e.target.value }))}
                        >
                          <option value="">Choose a branch</option>
                          {formOptions.branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <label htmlFor="manager-unit-create">Assign Unit</label>
                        <select
                          id="manager-unit-create"
                          value={createManagerForm.unitId}
                          onChange={(e) => setCreateManagerForm((current) => ({ ...current, unitId: e.target.value }))}
                        >
                          <option value="">Choose a unit</option>
                          {formOptions.units.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unit.unitName}</option>
                          ))}
                        </select>
                      </>
                    )}

                    <button type="submit">Prepare Promotion</button>
                  </form>

                  <form className="aop-form-card" onSubmit={(e) => { e.preventDefault(); setScaffoldMessage('Manager edit'); }}>
                    <div className="aop-form-head">
                      <FaUserEdit />
                      <div>
                        <h3>Edit Existing Manager</h3>
                        <p>Review the current manager profile and update assignment fields.</p>
                      </div>
                    </div>
                    <label htmlFor="manager-type-edit">Manager Type</label>
                    <select
                      id="manager-type-edit"
                      value={editManagerForm.managerType}
                      onChange={(e) => setEditManagerForm({ ...EMPTY_MANAGER_EDIT_FORM, managerType: e.target.value })}
                    >
                      <option value="BM">BM</option>
                      <option value="UM">UM</option>
                      <option value="AUM">AUM</option>
                    </select>
                    <label htmlFor="manager-record-select">Select Manager</label>
                    <select
                      id="manager-record-select"
                      value={editManagerForm.managerRecordId}
                      onChange={(e) => setEditManagerForm((current) => ({ ...current, managerRecordId: e.target.value }))}
                    >
                      <option value="">Choose a manager</option>
                      {(managerDirectory[editManagerForm.managerType] || []).map((manager) => (
                        <option key={manager.managerId} value={manager.managerId}>
                          {manager.username} · {[manager.firstName, manager.lastName].filter(Boolean).join(' ')}
                        </option>
                      ))}
                    </select>

                    <UserPreviewCard
                      title="Selected Manager Details"
                      subtitle="Prefilled from the current manager record."
                      data={selectedEditManager}
                      emptyMessage="Choose a current BM, UM, or AUM record to review its details here."
                    />

                    {editManagerForm.managerType === 'BM' ? (
                      <>
                        <label htmlFor="manager-branch-edit">Assigned Branch</label>
                        <select
                          id="manager-branch-edit"
                          value={editManagerForm.branchId}
                          onChange={(e) => setEditManagerForm((current) => ({ ...current, branchId: e.target.value }))}
                        >
                          <option value="">Choose a branch</option>
                          {formOptions.branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <label htmlFor="manager-unit-edit">Assigned Unit</label>
                        <select
                          id="manager-unit-edit"
                          value={editManagerForm.unitId}
                          onChange={(e) => setEditManagerForm((current) => ({ ...current, unitId: e.target.value }))}
                        >
                          <option value="">Choose a unit</option>
                          {formOptions.units.map((unit) => (
                            <option key={unit.id} value={unit.id}>{unit.unitName}</option>
                          ))}
                        </select>
                      </>
                    )}

                    <button type="submit">Prepare Manager Update</button>
                  </form>
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

                    <button type="submit">Prepare Agent</button>
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

                    <button type="submit">Prepare Agent Update</button>
                  </form>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AdminOrganizationPage;
