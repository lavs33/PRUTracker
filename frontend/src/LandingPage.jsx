import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import "./LandingPage.css";
import logo from "./assets/prutracker-landing-logo.png";
import heroImage from "./assets/landing-page-img-1.jpg";
import module1Image from "./assets/landing-page-module-1.jpg";
import module2Image from "./assets/landing-page-module-2.jpg";
import module3Image from "./assets/landing-page-module-3.jpg";
import module4Image from "./assets/landing-page-module-4.jpg";

const MODULES = [
  {
    title: "Client & Orphan Visibility and Management",
    summary:
      "Centralized visibility for clients and orphaned clients, with searchable profiles, policy context, recent activity cues, and follow-up indicators.",
    highlights: [
      "Unified client and orphan lists with quick search",
      "Profile-level context: policy type, status, and activity signals",
      "Weighted orphan recommendation support (specialization, load, fit)",
    ],
    imageSrc: module1Image,
  },
  {
    title: "Agent Task Visibility and Management",
    summary:
      "Role-aware task dashboards for agents and managers, with progress snapshots and monthly performance reporting to guide coaching and accountability.",
    highlights: [
      "Agent, unit, and branch-level visibility by role",
      "Task progress and productivity trends",
      "Monthly performance summary reports",
    ],
    imageSrc: module2Image,
  },
  {
    title: "Sales Monitoring and Analytics",
    summary:
      "Visual sales analytics with KPI tracking, trend comparison, and report outputs to support data-informed sales decisions.",
    highlights: [
      "Current vs historical performance trend views",
      "KPI and conversion-focused monitoring",
      "Sales reporting for documentation and records",
    ],
    imageSrc: module3Image,
  },
  {
    title: "Orphan and KPI Assignment",
    summary:
      "Branch-level controls for orphan assignment decisions and KPI alignment so units stay focused on shared performance goals.",
    highlights: [
      "Manager review and assignment of orphan recommendations",
      "Centralized branch KPI setup and visibility",
      "Performance-overview dashboards for corrective actions",
    ],
    imageSrc: module4Image,
  },
];

const ROLE_OPTIONS = [
  { label: "Agent", portalLabel: "Agent Portal", path: "/login" },
  { label: "AUM", portalLabel: "AUM Portal", path: "/login" },
  { label: "UM", portalLabel: "UM Portal", path: "/login" },
  { label: "BM", portalLabel: "BM Portal", path: "/login" },
  { label: "Admin", portalLabel: "Admin Portal", path: "/admin/login" },
];

function LandingPage() {
  const navigate = useNavigate();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "PRUTracker | Overview";
  }, []);

  const year = useMemo(() => new Date().getFullYear(), []);

  const handleRoleSelect = (option) => {
    localStorage.setItem("role", option.label);
    setRoleMenuOpen(false);
    navigate(option.path);
  };

  return (
    <div className="mp-page">
      <header className="mp-header">
        <div className="mp-header-inner">
          <img src={logo} alt="PRUTracker Logo" className="mp-logo" />

          <nav className="mp-nav" aria-label="Primary">
            <a href="#overview">Overview</a>
            <a href="#modules">Functions</a>
            <a href="#footer-contact">Contact</a>
          </nav>

          <div className="mp-auth">
            <button type="button" className="mp-login-btn" onClick={() => setRoleMenuOpen((v) => !v)}>
              Log in
            </button>
            {roleMenuOpen && (
              <div className="mp-role-dropdown" role="menu" aria-label="Select role">
                <p>Select role</p>
                {ROLE_OPTIONS.map((option) => (
                  <button key={option.label} type="button" onClick={() => handleRoleSelect(option)}>
                    <span>{option.label}</span>
                    <small>{option.portalLabel}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        <section id="overview" className="mp-hero">
          <div className="mp-hero-inner">
            <div className="mp-hero-copy">
              <span className="mp-chip">Pru Life UK's Salesforce Automation System</span>
              <h1>Track client relationships, tasks, and sales performance in one place.</h1>
              <p>
                PRUTracker is designed to support Pru Life UK agents and managers with visibility dashboards,
                structured workflows, and decision support tools for client and branch performance.
              </p>
            </div>

            <figure className="mp-hero-imageWrap" aria-label="Header visual">
              <img src={heroImage} alt="Pru Life UK overview visual" className="mp-hero-image" />
            </figure>
          </div>
        </section>

        <section id="modules" className="mp-modules">
          <div className="mp-modules-head">
            <h2>PRUTracker Core at a Glance</h2>
            <p>What PRUTracker offers for Pru Life UK agents, managers, and units.</p>
          </div>

          <div className="mp-module-grid">
            {MODULES.map((module) => (
              <article key={module.title} className="mp-module-card">
                <div className="mp-card-top">
                  <h3>{module.title}</h3>
                </div>
                <p>{module.summary}</p>
                <figure className="mp-module-imageWrap">
                  <img src={module.imageSrc} alt={`${module.title} visual`} className="mp-module-image" />
                </figure>
                <ul>
                  {module.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer id="footer-contact" className="mp-footer">
        <div className="mp-footer-inner">
          <div className="mp-footer-col">
            <h4>Pru Life UK Phone</h4>
            <p>
              <strong>PLDT Metro Manila</strong>
              <br />+63 (2) 8887 5433
            </p>
            <p>
              <strong>Domestic Toll-free</strong>
              <br />1 800 10 PRULINK (1 800 10 7785465)
            </p>
            <p>
              <strong>Globe Metro Manila</strong>
              <br />+63 (2) 7793-5433
            </p>
            <p>
              <strong>Globe Domestic Toll-free</strong>
              <br />1-800-82-785465
            </p>
          </div>

          <div className="mp-footer-col">
            <h4>Pru Life UK Email Address</h4>
            <p>contact.us@prulifeuk.com.ph</p>

            <h4>Address</h4>
            <p>
              <strong>Head Office</strong>
              <br />9/F Uptown Place Tower 1,
              <br />1 East 11th Drive,
              <br />Uptown Bonifacio, Taguig City 1634,
              <br />Metro Manila
              <br />+63 (2) 8683 9000
            </p>
            <p>
              <strong>Customer Center</strong>
              <br />G/F Cluster 2, Uptown Parade, Megaworld Blvd. corner 36th street Uptown Bonifacio,
              <br />Taguig City 1634, Metro Manila
              <br />+63 (2) 88875433 (within Metro Manila)
              <br />1-800-107785465 (for domestic toll-free via PLDT landline)
            </p>
          </div>

          <div className="mp-footer-col">
            <h4>Pru Life UK Socials</h4>
            <div className="mp-social-links">
              <a href="https://www.facebook.com/prulifeukofficial/" target="_blank" rel="noreferrer" aria-label="Facebook">
                <FaFacebookF /> <span>Facebook</span>
              </a>
              <a href="https://www.instagram.com/prulifeuk/" target="_blank" rel="noreferrer" aria-label="Instagram">
                <FaInstagram /> <span>Instagram</span>
              </a>
              <a href="https://x.com/PruLifeUK" target="_blank" rel="noreferrer" aria-label="X formerly Twitter">
                <FaXTwitter /> <span>X</span>
              </a>
              <a href="https://www.linkedin.com/company/prulife-uk/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <FaLinkedinIn /> <span>LinkedIn</span>
              </a>
            </div>

            <h4>Pru Life UK Website</h4>
            <p>
              <a href="https://www.prulifeuk.com.ph/en/" target="_blank" rel="noreferrer">
                www.prulifeuk.com.ph
              </a>
            </p>

            <h4>Other Internal Systems</h4>
            <p>
              <a href="https://prism.prulifeuk.com.ph/" target="_blank" rel="noreferrer">
                PRISM - PRU Information Systems Management
              </a>
              <br />
              <a href="https://pruone.prulifeuk.com.ph/web" target="_blank" rel="noreferrer">
                PRUOnePH
              </a>
              <br />
              <a href="https://pruservices.prulifeuk.com.ph/welcome" target="_blank" rel="noreferrer">
                PRUServices
              </a>
            </p>

            <p>
              To know more about Pru Life UK’s business and contact information, visit{" "}
              <a href="https://pru.ph/ContactUs" target="_blank" rel="noreferrer">
                pru.ph/ContactUs
              </a>
              .
            </p>
          </div>
        </div>

        <div className="mp-footer-bottom">Copyright © {year} PRUTracker. All rights reserved.</div>
      </footer>
    </div>
  );
}

export default LandingPage;