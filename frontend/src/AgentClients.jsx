import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "./components/TopNav";
import SideNav from "./components/SideNav";
import { logout } from "./utils/logout";
import "./AgentClients.css";

function AgentClients() {
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

  const [recentProspects, setRecentProspects] = useState([]);
  const [recentPolicyholders, setRecentPolicyholders] = useState([]);

  const [loadingProspects, setLoadingProspects] = useState(true);
  const [loadingPolicyholders, setLoadingPolicyholders] = useState(true);

  const [prospectsError, setProspectsError] = useState("");
  const [policyholdersError, setPolicyholdersError] = useState("");

  const didFetchProspectsRef = useRef(false);
  const didFetchPolicyholdersRef = useRef(false);

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
    if (user) document.title = `${user.username} | Clients`;
  }, [user]);

  // Fetch recent prospects
  useEffect(() => {
    if (!isReady || !user?.id) return;
    if (didFetchProspectsRef.current) return;
    didFetchProspectsRef.current = true;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoadingProspects(true);
        setProspectsError("");

        if (!user?.id) {
          setProspectsError("Missing user id. Please log in again.");
          setRecentProspects([]);
          return;
        }

        const res = await fetch(
          `http://localhost:5000/api/prospects/recent?userId=${user.id}&limit=5`,
          { signal: controller.signal }
        );

        const data = await res.json();

        if (!res.ok) {
          setProspectsError(data.message || "Failed to fetch prospects.");
          setRecentProspects([]);
          return;
        }

        setRecentProspects(Array.isArray(data.prospects) ? data.prospects : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setProspectsError("Cannot connect to server. Is backend running?");
          setRecentProspects([]);
        }
      } finally {
        setLoadingProspects(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id]);

  // Fetch 5 most recently paid policyholders
  useEffect(() => {
    if (!isReady || !user?.id) return;
    if (didFetchPolicyholdersRef.current) return;
    didFetchPolicyholdersRef.current = true;

    const controller = new AbortController();

    const run = async () => {
      try {
        setLoadingPolicyholders(true);
        setPolicyholdersError("");

        if (!user?.id) {
          setPolicyholdersError("Missing user id. Please log in again.");
          setRecentPolicyholders([]);
          return;
        }

        const res = await fetch(
          `http://localhost:5000/api/policyholders/recent?userId=${user.id}&limit=5`,
          { signal: controller.signal }
        );

        const data = await res.json();

        if (!res.ok) {
          setPolicyholdersError(data.message || "Failed to fetch policyholders.");
          setRecentPolicyholders([]);
          return;
        }

        setRecentPolicyholders(
          Array.isArray(data.policyholders) ? data.policyholders : []
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          setPolicyholdersError("Cannot connect to server. Is backend running?");
          setRecentPolicyholders([]);
        }
      } finally {
        setLoadingPolicyholders(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isReady, user?.id]);

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

const formatDateOnly = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

  if (!isReady) return null;

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
      navigate(`/agent/${user.username}/policyholders`);
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

  return (
    <div className="page-shell">
      <TopNav
        user={user}
        onLogoClick={() => navigate(`/agent/${user.username}`)}
        onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
        onLogout={() => logout(navigate)}
        onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
      />

      <div className="page-body">
        <SideNav onNavigate={handleSideNav} />

        <main className="page-content">
          <h1 className="module-title">Client Visibility &amp; Management</h1>

          {/* PROSPECTS */}
          <div className="content-card">
            <div className="section-row">
              <h2 className="section-header">Prospects</h2>
              <button
                className="view-all-btn"
                onClick={() => navigate(`/agent/${user.username}/prospects`)}
              >
                View all prospects
              </button>
            </div>

            <div className="table-wrap" style={{ minHeight: "260px" }}>
              {loadingProspects && (
                <p className="ac-small-note" style={{ padding: "10px 0" }}>
                  Loading prospects...
                </p>
              )}

              {!loadingProspects && prospectsError && (
                <p className="ac-small-note" style={{ color: "#DA291C" }}>
                  {prospectsError}
                </p>
              )}

              {!loadingProspects && !prospectsError && (
                <table className="prospects-table">
                  <thead>
                    <tr>
                      <th>Prospect No.</th>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Market Type</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Leads In Progress</th>
                      <th>Date Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentProspects.map((p) => (
                      <tr key={p._id} className="prospect-row" onClick={() => navigate(`/agent/${user.username}/prospects/${p._id}`)}>
                        <td>{String(p.prospectNo ?? 0).padStart(2, "0")}</td>

                        <td>{p.firstName || "—"}</td>
                        <td>{p.lastName || "—"}</td>

                        <td>
                          <span
                            className={`pill market ${String(p.marketType || "").toLowerCase()}`}
                          >
                            {p.marketType || "—"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`pill source ${String(p.source || "")
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            {p.source || "—"}
                          </span>
                        </td>

                        <td>
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
                          >
                            {p.status || "—"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`lead-badge ${(p.leadsInProgress || 0) > 0 ? "has" : "none"}`}
                          >
                            {p.leadsInProgress ?? 0}
                          </span>
                        </td>

                        <td className="date-cell">{formatDate(p.createdAt)}</td>
                      </tr>
                    ))}

                    {recentProspects.length === 0 && (
                      <tr>
                        <td colSpan="9" className="empty-row">
                          No prospects yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {!loadingProspects && !prospectsError && (
              <p className="ac-muted">Showing most recently added prospects.</p>
            )}
          </div>

          {/* RECENTLY PAID POLICYHOLDERS */}
          <div className="content-card mt-18">
            <div className="section-row">
              <h2 className="section-header">Policyholders</h2>

              <button
                className="view-all-btn"
                onClick={() => navigate(`/agent/${user.username}/policyholders`)}
              >
                View all policyholders
              </button>
            </div>

            <div className="table-wrap" style={{ minHeight: "240px" }}>
              {loadingPolicyholders && (
                <p className="ac-small-note" style={{ padding: "10px 0" }}>
                  Loading policyholders...
                </p>
              )}

              {!loadingPolicyholders && policyholdersError && (
                <p className="ac-small-note" style={{ color: "#DA291C" }}>
                  {policyholdersError}
                </p>
              )}

              {!loadingPolicyholders && !policyholdersError && (
                <table className="prospects-table">
                  <thead>
                    <tr>
                      <th>Policyholder No.</th>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>Policy Number</th>
                      <th>Status</th>
                      <th>Last Paid Date</th>
                      <th>Next Payment Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentPolicyholders.map((c) => (
                      <tr key={c._id} className="prospect-row">
                        <td>{String(c.policyholderNo ?? 0).padStart(2, "0")}</td>
                        <td>{c.firstName || "—"}</td>
                        <td>{c.lastName || "—"}</td>
                        <td className="mono">{c.policyNumber || "—"}</td>
                        <td>
                          <span
                            className={`status-pill ${c.status === "Active" ? "active" : "nurture"}`}
                          >
                            {c.status || "—"}
                          </span>
                        </td>
                        <td>{formatDateOnly(c.lastPaidDate)}</td>
                        <td>{formatDateOnly(c.nextPaymentDate)}</td>
                      </tr>
                    ))}

                    {recentPolicyholders.length === 0 && (
                      <tr>
                        <td colSpan="7" className="empty-row">
                          No policyholders yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {!loadingPolicyholders && !policyholdersError && (
              <p className="ac-muted">
                Showing most recently paid policyholders.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentClients;