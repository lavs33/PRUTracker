import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentPolicyholdersAll.css";

function AgentPolicyholdersAll() {
  const navigate = useNavigate();
  const { username } = useParams();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [isReady, setIsReady] = useState(false);

  const [query, setQuery] = useState("");
  const [productName, setProductName] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState("policyholderNoAsc");

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [totalForThisUser, setTotalForThisUser] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [productOptions, setProductOptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!user || user.username !== username) {
      setIsReady(false);
      navigate("/", { replace: true });
      return;
    }
    setIsReady(true);
  }, [user, username, navigate]);

  useEffect(() => {
    if (user) document.title = `${user.username} | All Policyholders`;
  }, [user]);

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
          setProductOptions([]);
          return;
        }

        const res = await fetch(
          `http://localhost:5000/api/policyholders?userId=${user.id}&page=${page}&limit=${PAGE_SIZE}` +
            `&q=${encodeURIComponent(query)}` +
            `&productName=${encodeURIComponent(productName)}` +
            `&status=${encodeURIComponent(status)}` +
            `&sort=${encodeURIComponent(sortKey)}`,
          { signal: controller.signal }
        );

        const data = await res.json();

        if (!res.ok) {
          setApiError(data.message || "Failed to fetch policyholders.");
          setRows([]);
          setTotalForThisUser(0);
          setTotalPages(1);
          setProductOptions([]);
          return;
        }

        setRows(Array.isArray(data.policyholders) ? data.policyholders : []);
        setTotalForThisUser(Number(data.totalForThisUser ?? 0));
        setTotalPages(Number(data.totalPages ?? 1));
        setProductOptions(Array.isArray(data.productNames) ? data.productNames : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setApiError("Cannot connect to server. Is backend running?");
          setRows([]);
          setTotalForThisUser(0);
          setTotalPages(1);
          setProductOptions([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
    return () => controller.abort();
  }, [isReady, user?.id, page, query, productName, status, sortKey, PAGE_SIZE]);

  useEffect(() => {
    setPage(1);
  }, [query, productName, status, sortKey]);

  const formatDateOnly = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const shownCount = rows.length;
  const totalCount = totalForThisUser;

  const openPolicyholderLeadDetails = (policyholder) => {
    const prospectId = String(policyholder?.prospectId || "").trim();
    const leadId = String(policyholder?.leadId || "").trim();
    if (!prospectId || !leadId) return;
    navigate(`/agent/${user.username}/prospects/${prospectId}/leads/${leadId}`);
  };

  const resetFilters = () => {
    setQuery("");
    setProductName("");
    setStatus("");
    setSortKey("policyholderNoAsc");
    setPage(1);
  };

  if (!isReady) return null;

  const handleSideNav = (key) => {
    if (!user) return navigate("/");

    switch (key) {
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

  return (
    <div className="allpol-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="allpol-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="allpol-content">
          <div className="allpol-header">
            <h1 className="allpol-title">All Policyholders</h1>

            <div className="allpol-controls">
              <input
                className="allpol-search"
                placeholder="Search by code / first name / last name / policy number / product name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <select className="allpol-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="policyholderNoAsc">Policyholder No. (Low → High)</option>
                <option value="policyholderNoDesc">Policyholder No. (High → Low)</option>
                <option value="policyholderCodeAsc">Policyholder Code (A → Z)</option>
                <option value="policyholderCodeDesc">Policyholder Code (Z → A)</option>
                <option value="lastNameAsc">Last Name (A → Z)</option>
                <option value="lastNameDesc">Last Name (Z → A)</option>
                <option value="ageAsc">Age (Low → High)</option>
                <option value="ageDesc">Age (High → Low)</option>
                <option value="lastPaidDateAsc">Last Paid Date (Oldest → Newest)</option>
                <option value="lastPaidDateDesc">Last Paid Date (Newest → Oldest)</option>
                <option value="nextPaymentDateAsc">Next Payment Date (Oldest → Newest)</option>
                <option value="nextPaymentDateDesc">Next Payment Date (Newest → Oldest)</option>
                <option value="dateCreatedAsc">Date Created (Oldest → Newest)</option>
                <option value="dateCreatedDesc">Date Created (Newest → Oldest)</option>
              </select>

              <div className="allpol-chips">
                <select className="allpol-select" value={productName} onChange={(e) => setProductName(e.target.value)}>
                  <option value="">All Products</option>
                  {productOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                <select className="allpol-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Lapsed">Lapsed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <button className="allpol-clearBtn" onClick={resetFilters}>Clear</button>
              </div>
            </div>
          </div>

          <div className="allpol-card">
            <div className="allpol-tableWrap">
              {loading && <p className="allpol-note">Loading policyholders...</p>}
              {!loading && apiError && <p className="allpol-note" style={{ color: "#DA291C" }}>{apiError}</p>}

              {!loading && !apiError && (
                <table className="allpol-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Policyholder Code</th>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Age</th>
                      <th>Product Name</th>
                      <th>Policy Number</th>
                      <th>Status</th>
                      <th>Last Paid Date</th>
                      <th>Next Payment Date</th>
                      <th>Date Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const canOpenLeadDetails = Boolean(String(p?.prospectId || "").trim() && String(p?.leadId || "").trim());

                      return (
                      <tr
                        key={p._id}
                        className={`allpol-row ${canOpenLeadDetails ? "allpol-row--clickable" : ""}`.trim()}
                        onClick={canOpenLeadDetails ? () => openPolicyholderLeadDetails(p) : undefined}
                        onKeyDown={canOpenLeadDetails
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openPolicyholderLeadDetails(p);
                              }
                            }
                          : undefined}
                        role={canOpenLeadDetails ? "link" : undefined}
                        tabIndex={canOpenLeadDetails ? 0 : undefined}
                        title={canOpenLeadDetails ? "Open lead details" : undefined}
                      >
                        <td>{String(p.policyholderNo ?? 0).padStart(2, "0")}</td>
                        <td className="allpol-mono allpol-cell-nowrap">{p.policyholderCode || "—"}</td>
                        <td>{p.firstName || "—"}</td>
                        <td>{p.lastName || "—"}</td>
                        <td>{p.age ?? "—"}</td>
                        <td>{p.productName || "—"}</td>
                        <td className="allpol-mono allpol-cell-nowrap">{p.policyNumber || "—"}</td>
                        <td className="allpol-cell-nowrap">
                          <span className={`allpol-status ${p.status === "Active" ? "active" : "nurture"}`}>{p.status || "—"}</span>
                        </td>
                        <td className="allpol-cell-date">{formatDateOnly(p.lastPaidDate)}</td>
                        <td className="allpol-cell-date">{formatDateOnly(p.nextPaymentDate)}</td>
                        <td className="allpol-cell-date">{formatDateOnly(p.createdAt)}</td>
                      </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan="11" className="allpol-empty">No policyholders found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && !apiError && (
              <div className="allpol-pagination">
                <div className="allpol-muted">Showing {shownCount} of {totalCount}</div>
                <div className="allpol-pager">
                  <button className="allpol-pagerBtn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                  <span className="allpol-pagerMeta">Page {page} of {totalPages}</span>
                  <button className="allpol-pagerBtn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentPolicyholdersAll;