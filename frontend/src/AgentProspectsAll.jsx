import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentProspectsAll.css";

function AgentProspectsAll() {
  const navigate = useNavigate();
  const { username } = useParams();

  // Read user once
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [isReady, setIsReady] = useState(false);

  // UI controls
  const [query, setQuery] = useState("");
  const [marketType, setMarketType] = useState("");
  const [prospectType, setProspectType] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  
  const [sortKey, setSortKey] = useState("prospectNoAsc");

  // Pagination
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Data
  const [rows, setRows] = useState([]);
  const [totalForThisUser, setTotalForThisUser] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  // Guard
  useEffect(() => {
    if (!user || user.username !== username) {
      setIsReady(false);
      navigate("/", { replace: true });
      return;
    }
    setIsReady(true);
  }, [user, username, navigate]);

  // Title
  useEffect(() => {
    if (user) document.title = `${user.username} | All Prospects`;
  }, [user]);

  // Fetch paginated prospects (NOW includes query + page)
  useEffect(() => {
    if (!isReady) return;

    const controller = new AbortController();

    const fetchPage = async () => {
      try {
        setLoading(true);
        setApiError("");

        if (!user?.id) {
          setApiError("Missing user id. Please log in again.");
          setRows([]);
          setTotalForThisUser(0);
          setTotalPages(1);
          return;
        }

        const res = await fetch(
          `http://localhost:5000/api/prospects?userId=${user.id}&page=${page}&limit=${PAGE_SIZE}` +
            `&q=${encodeURIComponent(query)}` +
            `&marketType=${encodeURIComponent(marketType)}` +
            `&prospectType=${encodeURIComponent(prospectType)}` +
            `&source=${encodeURIComponent(source)}` +
            `&status=${encodeURIComponent(status)}`+ 
            `&sort=${encodeURIComponent(sortKey)}`,
          { signal: controller.signal }
        );

        const data = await res.json();

        if (!res.ok) {
          setApiError(data.message || "Failed to fetch prospects.");
          setRows([]);
          setTotalForThisUser(0);
          setTotalPages(1);
          return;
        }

        const nextRows = Array.isArray(data.prospects) ? data.prospects : [];
        const nextTotal = Number(data.totalForThisUser ?? 0);
        const nextTotalPages = Number(data.totalPages ?? 1);

        setRows(nextRows);
        setTotalForThisUser(nextTotal);
        setTotalPages(nextTotalPages);
      } catch (err) {
        if (err.name !== "AbortError") {
          setApiError("Cannot connect to server. Is backend running?");
          setRows([]);
          setTotalForThisUser(0);
          setTotalPages(1);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
    return () => controller.abort();
  }, [isReady, user?.id, page, query, marketType, prospectType, source, status, sortKey, PAGE_SIZE]);

  const sortedRows = useMemo(() => {
  const arr = Array.isArray(rows) ? [...rows] : [];

  const getStr = (v) => String(v ?? "").toLowerCase();
  const getNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : -Infinity;
  };
  const getDate = (v) => {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : -Infinity;
  };

  const compare = (a, b, dir) => (dir === "asc" ? a - b : b - a);

  switch (sortKey) {
    case "prospectNoAsc":
    return arr.sort(
      (a, b) => Number(a.prospectNo ?? 0) - Number(b.prospectNo ?? 0)
    );

    case "prospectNoDesc":
    return arr.sort(
      (a, b) => Number(b.prospectNo ?? 0) - Number(a.prospectNo ?? 0)
    );

    case "prospectCodeAsc":
      return arr.sort((a, b) => getStr(a.prospectCode).localeCompare(getStr(b.prospectCode)));
    case "prospectCodeDesc":
      return arr.sort((a, b) => getStr(b.prospectCode).localeCompare(getStr(a.prospectCode)));

    case "lastNameAsc":
      return arr.sort((a, b) => getStr(a.lastName).localeCompare(getStr(b.lastName)));
    case "lastNameDesc":
      return arr.sort((a, b) => getStr(b.lastName).localeCompare(getStr(a.lastName)));

    case "ageAsc":
      return arr.sort((a, b) => compare(getNum(a.age), getNum(b.age), "asc"));
    case "ageDesc":
      return arr.sort((a, b) => compare(getNum(a.age), getNum(b.age), "desc"));

    case "leadsAsc":
      return arr.sort((a, b) => compare(getNum(a.leadsInProgress), getNum(b.leadsInProgress), "asc"));
    case "leadsDesc":
      return arr.sort((a, b) => compare(getNum(a.leadsInProgress), getNum(b.leadsInProgress), "desc"));

    case "dateCreatedAsc":
      return arr.sort((a, b) => {
        const da = getDate(a.createdAt);
        const db = getDate(b.createdAt);
        if (da !== db) return da - db; // oldest -> newest
        // tie-breaker (stable + predictable)
        return getStr(a.prospectCode).localeCompare(getStr(b.prospectCode)); // A -> Z
    });

    case "dateCreatedDesc":
      return arr.sort((a, b) => {
        const da = getDate(a.createdAt);
        const db = getDate(b.createdAt);
        if (da !== db) return db - da; // newest -> oldest
        // tie-breaker: higher code first
        return getStr(b.prospectCode).localeCompare(getStr(a.prospectCode)); // Z -> A
    });

    default:
      return arr;
  }
}, [rows, sortKey]);

  // If totalPages shrinks, keep page valid
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

    // SALES
    case "sales":
      alert("Sales module coming soon");
      break;

    default:
      break;
  }
};

const formatDate = (d) => {
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

  if (!isReady) return null;

  // "Showing X of Y" (Y is filtered total, because backend counts with q)
  const shownCount = rows.length;
  const totalCount = totalForThisUser;

  return (
    <div className="allpros-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="allpros-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="allpros-content">
          <div className="allpros-header">
            <h1 className="allpros-title">All Prospects</h1>

            <div className="allpros-controls">
              <input
                className="allpros-search"
                placeholder="Search by code / first name / last name"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1); // reset to page 1 on new search
                }}
              />

              <button
                className="allpros-addBtn"
                onClick={() => navigate(`/agent/${user.username}/prospects/new`)}
                type="button"
              >
                + Add a Prospect
              </button>

              <select
              className="allpros-sort"
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value);
                setPage(1);
              }}
             >
              <option value="prospectNoAsc">Prospect No. (Low → High)</option>
              <option value="prospectNoDesc">Prospect No. (High → Low)</option>

              <option value="prospectCodeAsc">Prospect Code (A → Z)</option>
              <option value="prospectCodeDesc">Prospect Code (Z → A)</option>

              <option value="lastNameAsc">Last Name (A → Z)</option>
              <option value="lastNameDesc">Last Name (Z → A)</option>

              <option value="ageAsc">Age (Low → High)</option>
              <option value="ageDesc">Age (High → Low)</option>

              <option value="leadsAsc">Leads In Progress (Low → High)</option>
              <option value="leadsDesc">Leads In Progress (High → Low)</option>

              <option value="dateCreatedAsc">Date Created (Oldest → Newest)</option>
              <option value="dateCreatedDesc">Date Created (Newest → Oldest)</option>
            </select>
              

              <div className="allpros-chips">
                <select
                  className="chip-select"
                  value={marketType}
                  onChange={(e) => {
                    setMarketType(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Market Type</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>

                <select
                  className="chip-select"
                  value={prospectType}
                  onChange={(e) => {
                    setProspectType(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Prospect Type</option>
                  <option value="Elite">Elite</option>
                  <option value="Ordinary">Ordinary</option>
                </select>

                <select
                  className="chip-select"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Source</option>
                  <option value="Agent-Sourced">Agent-Sourced</option>
                  <option value="System-Assigned">System-Assigned</option>
                </select>

                <select
                  className="chip-select"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Status</option>
                  <option value="Active">Active</option>
                  <option value="Wrong Contact">Wrong Contact</option>
                  <option value="Dropped">Dropped</option>
                </select>

                <button
                  className="chip-clear"
                  onClick={() => {
                    setMarketType("");
                    setProspectType("");
                    setSource("");
                    setStatus("");
                    setQuery("");
                    setPage(1);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="allpros-card">
            <div className="allpros-tableWrap">
              {loading && <p className="allpros-small-note">Loading prospects...</p>}

              {!loading && apiError && (
                <p className="allpros-small-note" style={{ color: "#DA291C" }}>
                  {apiError}
                </p>
              )}

              {!loading && !apiError && (
                <table className="allpros-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Prospect Code</th>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Age</th>
                      <th>Market Type</th>
                      <th>Prospect Type</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Leads In Progress</th>
                      <th>Date Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedRows.map((p, idx) => {
                      
                      return (
                        <tr
                          key={p._id}
                          className="allpros-row"
                            onClick={() =>
                                     navigate(`/agent/${user.username}/prospects/${p._id}`)
                            }
                        >
                          <td>{String(p.prospectNo ?? 0).padStart(2, "0")}</td>

                          <td className="mono">{p.prospectCode || "—"}</td>
                          <td>{p.firstName}</td>
                          <td>{p.lastName}</td>
                          <td>{p.age ?? "—"}</td>

                          <td>
                            <div className="pill-cell">
                              <span className={`pill market ${String(p.marketType || "").toLowerCase()}`}>
                                {p.marketType || "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="pill-cell">
                              <span
                                className={`pill prospect ${
                                  p.prospectType ? String(p.prospectType).toLowerCase() : "unknown"
                                }`}
                              >
                                {p.prospectType || "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="pill-cell">
                              <span
                                className={`pill source ${String(p.source || "")
                                  .toLowerCase()
                                  .replace(/\s+/g, "-")}`}
                                title={p.source || ""}
                              >
                                {p.source || "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="pill-cell">
                              <span
                                className={`status-pill ${
                                  p.status === "Active"
                                    ? "active"
                                    : p.status === "Dropped"
                                    ? "dropped"
                                    : p.status === "Wrong Contact"
                                    ? "wrong"
                                    : ""
                                }`}
                                title={p.status || ""}
                              >
                                {p.status || "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`lead-badge ${
                                (p.leadsInProgress || 0) > 0 ? "has" : "none"
                              }`}
                            >
                              {p.leadsInProgress ?? 0}
                            </span>
                          </td>

                          <td>{formatDate(p.createdAt)}</td>
                        </tr>
                      );
                    })}

                    {rows.length === 0 && (
                      <tr>
                        <td colSpan="11" className="empty-row">
                          No prospects found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && !apiError && (
              <div className="allpros-pagination">
                <div className="muted">
                  Showing {shownCount} of {totalCount}
                </div>

                <div className="pager">
                  <button
                    className="pager-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Prev
                  </button>

                  <span className="pager-meta">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    className="pager-btn"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentProspectsAll;
