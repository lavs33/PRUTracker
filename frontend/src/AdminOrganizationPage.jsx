import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBuilding, FaSitemap, FaUserShield, FaUsers } from "react-icons/fa";
import "./AdminOrganizationPage.css";
import logo from "./assets/prutracker-landing-logo.png";

const ORGANIZATION_DATA = [
  {
    areaName: "NCR North Area",
    branches: [
      {
        branchName: "Quezon Avenue Branch",
        bm: "Marianne Flores",
        units: [
          {
            unitName: "Aurora Unit",
            um: "Paolo Ramirez",
            aum: "Leah Santos",
            agents: ["AG000001 · Angel Dela Cruz", "AG000014 · Bea Mendoza", "AG000018 · Jonah Cruz"],
          },
          {
            unitName: "Scout Unit",
            um: "Jomar Perez",
            aum: "Carla Dominguez",
            agents: ["AG000005 · Mark Villanueva", "AG000022 · Kevin Flores"],
          },
        ],
      },
      {
        branchName: "Fairview Branch",
        bm: "Rica De Leon",
        units: [
          {
            unitName: "Regalado Unit",
            um: "Anton Garcia",
            aum: "Nicole Ramos",
            agents: ["AG000031 · Shane Tan", "AG000032 · Ruth Nicolas", "AG000033 · Abe Martinez"],
          },
        ],
      },
    ],
  },
  {
    areaName: "South Luzon Area",
    branches: [
      {
        branchName: "Nuvali Branch",
        bm: "Dennis Valdez",
        units: [
          {
            unitName: "Solenad Unit",
            um: "Camille Reyes",
            aum: "Ivy Cruz",
            agents: ["AG000041 · Louise Herrera", "AG000042 · Janine Sy", "AG000043 · Marco Uy"],
          },
          {
            unitName: "Santa Rosa Unit",
            um: "Jules Capili",
            aum: "Mico Alvarez",
            agents: ["AG000044 · Trisha Castro", "AG000045 · Neil Javier"],
          },
        ],
      },
    ],
  },
];

function AdminOrganizationPage() {
  const navigate = useNavigate();
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
    }
  }, [adminUser, navigate]);

  const totals = useMemo(() => {
    const areas = ORGANIZATION_DATA.length;
    const branches = ORGANIZATION_DATA.reduce((sum, area) => sum + area.branches.length, 0);
    const units = ORGANIZATION_DATA.reduce(
      (sum, area) => sum + area.branches.reduce((branchSum, branch) => branchSum + branch.units.length, 0),
      0
    );
    const agents = ORGANIZATION_DATA.reduce(
      (sum, area) =>
        sum +
        area.branches.reduce(
          (branchSum, branch) =>
            branchSum + branch.units.reduce((unitSum, unit) => unitSum + unit.agents.length, 0),
          0
        ),
      0
    );

    return { areas, branches, units, agents };
  }, []);

  const handleBack = () => navigate("/admin/login");

  const handleLogout = () => {
    localStorage.removeItem("adminUser");
    localStorage.removeItem("role");
    navigate("/admin/login");
  };

  return (
    <div className="aop-page">
      <header className="aop-header">
        <div className="aop-header-inner">
          <button className="aop-back-btn" onClick={handleBack} aria-label="Back to admin login">
            <FaArrowLeft size={15} />
            <span>Back</span>
          </button>

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
              This dashboard is the starting point for Admin organization management, showing the reporting structure
              from area down to branch, unit, assigned managers, and agents underneath each unit.
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
            <p>Static UI scaffold for the Admin module before live backend organization data is connected.</p>
          </div>

          <div className="aop-area-list">
            {ORGANIZATION_DATA.map((area) => (
              <article key={area.areaName} className="aop-area-card">
                <div className="aop-area-head">
                  <div>
                    <p>Area</p>
                    <h3>{area.areaName}</h3>
                  </div>
                  <span>{area.branches.length} Branch{area.branches.length > 1 ? "es" : ""}</span>
                </div>

                <div className="aop-branch-list">
                  {area.branches.map((branch) => (
                    <section key={`${area.areaName}-${branch.branchName}`} className="aop-branch-card">
                      <div className="aop-branch-head">
                        <div>
                          <p>Branch</p>
                          <h4>{branch.branchName}</h4>
                        </div>
                        <div className="aop-manager-pill">
                          <span>BM Assigned</span>
                          <strong>{branch.bm}</strong>
                        </div>
                      </div>

                      <div className="aop-unit-grid">
                        {branch.units.map((unit) => (
                          <article key={`${branch.branchName}-${unit.unitName}`} className="aop-unit-card">
                            <div className="aop-unit-head">
                              <p>Unit</p>
                              <h5>{unit.unitName}</h5>
                            </div>

                            <div className="aop-assignment-grid">
                              <div>
                                <span>UM Assigned</span>
                                <strong>{unit.um}</strong>
                              </div>
                              <div>
                                <span>AUM Assigned</span>
                                <strong>{unit.aum}</strong>
                              </div>
                            </div>

                            <div className="aop-agent-list-wrap">
                              <span className="aop-agent-label">Agents Under Unit</span>
                              <ul className="aop-agent-list">
                                {unit.agents.map((agent) => (
                                  <li key={agent}>{agent}</li>
                                ))}
                              </ul>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AdminOrganizationPage;
