import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBuilding, FaPlus, FaSearch, FaSitemap, FaTrashAlt, FaUserEdit, FaUserShield, FaUsers } from "react-icons/fa";
import "./AdminOrganizationPage.css";
import logo from "./assets/prutracker-landing-logo.png";

const EMPTY_FORM = { areaName: "" };

function countNested(area) {
  const branches = area?.branches || [];
  const units = branches.reduce((sum, branch) => sum + (branch.units?.length || 0), 0);
  const agents = branches.reduce(
    (sum, branch) => sum + (branch.units || []).reduce((unitSum, unit) => unitSum + (unit.agents?.length || 0), 0),
    0
  );

  return { branches: branches.length, units, agents };
}

function AdminOrganizationPage() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [editAreaId, setEditAreaId] = useState("");
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [deleteAreaId, setDeleteAreaId] = useState("");

  const adminUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("adminUser") || "null");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    document.title = "PRUTracker | Admin Organization Management";

    if (!adminUser) {
      navigate("/admin/login");
      return;
    }

    fetchOrganizationTree();
  }, [adminUser, navigate]);

  const fetchOrganizationTree = async (areaSearch = query) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch(
        `http://localhost:5000/api/admin/organization/tree?areaSearch=${encodeURIComponent(areaSearch)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "Failed to load organization structure.");
        setAreas([]);
        return;
      }

      setAreas(Array.isArray(data.areas) ? data.areas : []);
    } catch (err) {
      setErrorMessage("Cannot connect to server. Is backend running?");
      setAreas([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchOrganizationTree(query);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const pickedArea = areas.find((area) => area.id === editAreaId);
    setEditForm({ areaName: pickedArea?.areaName || "" });
  }, [editAreaId, areas]);

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

  const deleteArea = areas.find((area) => area.id === deleteAreaId) || null;
  const deleteCounts = countNested(deleteArea);

  const resetMessages = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const handleLogout = () => {
    localStorage.removeItem("adminUser");
    localStorage.removeItem("role");
    navigate("/admin/login");
  };

  const handleAddArea = async (e) => {
    e.preventDefault();
    resetMessages();

    try {
      const res = await fetch("http://localhost:5000/api/admin/organization/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "Failed to add area.");
        return;
      }

      setStatusMessage(data.message || "Area created successfully.");
      setAddForm(EMPTY_FORM);
      await fetchOrganizationTree(query);
    } catch (err) {
      setErrorMessage("Cannot connect to server. Is backend running?");
    }
  };

  const handleEditArea = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!editAreaId) {
      setErrorMessage("Please choose an area to edit.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/organization/areas/${editAreaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "Failed to update area.");
        return;
      }

      setStatusMessage(data.message || "Area updated successfully.");
      await fetchOrganizationTree(query);
    } catch (err) {
      setErrorMessage("Cannot connect to server. Is backend running?");
    }
  };

  const handleDeleteArea = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!deleteAreaId) {
      setErrorMessage("Please choose an area to delete.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/admin/organization/areas/${deleteAreaId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmCascade: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "Failed to delete area.");
        return;
      }

      setStatusMessage(data.message || "Area deleted successfully.");
      setDeleteAreaId("");
      setEditAreaId((current) => (current === deleteAreaId ? "" : current));
      await fetchOrganizationTree(query);
    } catch (err) {
      setErrorMessage("Cannot connect to server. Is backend running?");
    }
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
            <span>{adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : "Admin"}</span>
            <button type="button" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="aop-main">
        <section className="aop-hero">
          <div>
            <p className="aop-kicker">Frontend-first Admin Module</p>
            <h1>Area, branch, unit, and agent visibility in one organization view.</h1>
            <p className="aop-description">
              This dashboard is the starting point for Admin organization management, now connected to backend area
              records while keeping BM, UM, and AUM placeholders until manager-to-org assignments are wired.
            </p>
          </div>

          <div className="aop-summary-grid">
            <article>
              <FaSitemap />
              <span>Areas</span>
              <strong>{totals.areas}</strong>
            </article>
            <article>
              <FaBuilding />
              <span>Branches</span>
              <strong>{totals.branches}</strong>
            </article>
            <article>
              <FaUserShield />
              <span>Units</span>
              <strong>{totals.units}</strong>
            </article>
            <article>
              <FaUsers />
              <span>Agents</span>
              <strong>{totals.agents}</strong>
            </article>
          </div>
        </section>

        <section className="aop-section">
          <div className="aop-section-head">
            <h2>Organization Structure</h2>
            <p>Search areas and manage area records from the controls below.</p>
          </div>

          <div className="aop-toolbar">
            <div className="aop-toolbar-actions">
              <button type="button" className="aop-action-btn" onClick={() => setAddForm({ areaName: addForm.areaName })}>
                <FaPlus /> <span>Add Area</span>
              </button>
              <button type="button" className="aop-action-btn" onClick={() => setEditAreaId(editAreaId || areas[0]?.id || "") }>
                <FaUserEdit /> <span>Edit Area</span>
              </button>
              <button type="button" className="aop-action-btn danger" onClick={() => setDeleteAreaId(deleteAreaId || areas[0]?.id || "") }>
                <FaTrashAlt /> <span>Delete Area</span>
              </button>
            </div>

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

          {(statusMessage || errorMessage) && (
            <div className={`aop-feedback ${errorMessage ? "error" : "success"}`}>
              {errorMessage || statusMessage}
            </div>
          )}

          <div className="aop-management-grid">
            <form className="aop-form-card" onSubmit={handleAddArea}>
              <div className="aop-form-head">
                <FaPlus />
                <div>
                  <h3>Add Area</h3>
                  <p>Area names must be unique.</p>
                </div>
              </div>
              <label htmlFor="add-area-name">Area Name</label>
              <input
                id="add-area-name"
                value={addForm.areaName}
                onChange={(e) => setAddForm({ areaName: e.target.value })}
                placeholder="Enter area name"
              />
              <button type="submit">Save Area</button>
            </form>

            <form className="aop-form-card" onSubmit={handleEditArea}>
              <div className="aop-form-head">
                <FaUserEdit />
                <div>
                  <h3>Edit Area</h3>
                  <p>Updated names must stay unique.</p>
                </div>
              </div>
              <label htmlFor="edit-area-select">Select Area</label>
              <select id="edit-area-select" value={editAreaId} onChange={(e) => setEditAreaId(e.target.value)}>
                <option value="">Choose an area</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.areaName}</option>
                ))}
              </select>
              <label htmlFor="edit-area-name">New Area Name</label>
              <input
                id="edit-area-name"
                value={editForm.areaName}
                onChange={(e) => setEditForm({ areaName: e.target.value })}
                placeholder="Enter new area name"
              />
              <button type="submit">Update Area</button>
            </form>

            <form className="aop-form-card danger" onSubmit={handleDeleteArea}>
              <div className="aop-form-head">
                <FaTrashAlt />
                <div>
                  <h3>Delete Area</h3>
                  <p>This will cascade under the selected area.</p>
                </div>
              </div>
              <label htmlFor="delete-area-select">Select Area</label>
              <select id="delete-area-select" value={deleteAreaId} onChange={(e) => setDeleteAreaId(e.target.value)}>
                <option value="">Choose an area</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.areaName}</option>
                ))}
              </select>
              <div className="aop-warning-box">
                <strong>Warning:</strong>
                <p>
                  Deleting this area will also delete the branches, units, and agents under it.
                  {deleteArea && (
                    <>
                      <br />Current impact: {deleteCounts.branches} branch(es), {deleteCounts.units} unit(s), and {deleteCounts.agents} agent(s).
                    </>
                  )}
                </p>
              </div>
              <button type="submit">Delete Area</button>
            </form>
          </div>

          {isLoading ? (
            <div className="aop-empty-state">Loading organization structure...</div>
          ) : areas.length === 0 ? (
            <div className="aop-empty-state">No matching areas found.</div>
          ) : (
            <div className="aop-area-list">
              {areas.map((area) => (
                <article key={area.id} className="aop-area-card">
                  <div className="aop-area-head">
                    <div>
                      <p>Area</p>
                      <h3>{area.areaName}</h3>
                    </div>
                    <span>{area.branches.length} Branch{area.branches.length > 1 ? "es" : ""}</span>
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
                              <strong>{branch.bm || "Unassigned"}</strong>
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
                                      <strong>{unit.um || "Unassigned"}</strong>
                                    </div>
                                    <div>
                                      <span>AUM Assigned</span>
                                      <strong>{unit.aum || "Unassigned"}</strong>
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
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminOrganizationPage;
