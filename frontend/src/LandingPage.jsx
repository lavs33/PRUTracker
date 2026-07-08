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
      "Keep prospect, lead, policyholder, and orphan-client records organized under the agent currently handling the relationship.",
    highlights: [
      "Prospect, lead, and policyholder lists with complete client details",
      "Lead engagement history, policy information, and payment records in agent views",
      "Long-leave and retirement orphan clients reassigned without losing original history",
    ],
    imageSrc: module1Image,
  },
  {
    title: "Agent Task Visibility and Management",
    summary:
      "Help agents and managers monitor daily work through tasks, reminders, meetings, notifications, and progress dashboards.",
    highlights: [
      "Open, overdue, completed, missed, and due-today task tracking",
      "Contact-new-lead and follow-up workflows tied to the assigned agent",
      "Unit and branch task reports for coaching and performance review",
    ],
    imageSrc: module2Image,
  },
  {
    title: "Sales Monitoring and Analytics",
    summary:
      "Review sales performance, active policies, annual premium production, conversion results, and KPI progress across agent and manager portals.",
    highlights: [
      "Agent sales dashboards with client, lead, policy, and premium context",
      "UM/AUM/BM rollups for unit and branch sales performance",
      "Printable manager reports for clients, tasks, sales, and KPI progress",
    ],
    imageSrc: module3Image,
  },
  {
    title: "Orphan and KPI Assignment",
    summary:
      "Support BM and UM workflows for KPI setup, long-leave or retirement endorsements, recommended-agent review, and orphan reassignment.",
    highlights: [
      "Record long leave or retirement and confirm affected orphan clients",
      "Endorse orphan clients to the UM portal for reassignment follow-through",
      "Track reassignment progress and recommended-agent metrics",
    ],
    imageSrc: module4Image,
  },
];

const OVERVIEW_CARDS = [
  {
    label: "Role-based portals",
    text: "Separate workspaces for agents, UM/AUM/BM managers, admins, and endorsed orphan-client handling.",
  },
  {
    label: "Client lifecycle",
    text: "Prospecting, lead engagement, policyholder servicing, payments, and historical reassignment context.",
  },
  {
    label: "Performance visibility",
    text: "Dashboards and printable reports for clients, tasks, sales production, KPI progress, units, and branches.",
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
              <h1>Manage agency operations from prospecting to policy servicing.</h1>
              <p>
                PRUTracker supports agents, UM/AUM/BM managers, and administrators with role-based dashboards for
                clients, lead engagement, tasks, sales production, KPI progress, long-leave endorsements, retirement
                endorsements, and orphan-client reassignment workflows.
              </p>
              <div className="mp-hero-actions" aria-label="System capabilities">
                <a href="#modules" className="mp-primary-link">Explore functions</a>
                <span>Ownership-aware client records</span>
                <span>Printable manager reports</span>
              </div>
            </div>

            <figure className="mp-hero-imageWrap" aria-label="Header visual">
              <img src={heroImage} alt="Pru Life UK overview visual" className="mp-hero-image" />
            </figure>
          </div>

          <div className="mp-overview-cards" aria-label="PRUTracker overview highlights">
            {OVERVIEW_CARDS.map((card) => (
              <article key={card.label} className="mp-overview-card">
                <h2>{card.label}</h2>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="modules" className="mp-modules">
          <div className="mp-modules-head">
            <span className="mp-section-kicker">Functions</span>
            <h2>PRUTracker Core at a Glance</h2>
            <p>Current system capabilities across agent, manager, and admin workflows.</p>
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
