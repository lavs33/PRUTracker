import { FaBars, FaBullseye, FaChartLine, FaChevronLeft, FaChevronRight, FaHome, FaUserFriends, FaUsers } from "react-icons/fa";
import "./ManagerSideNav.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Home", icon: <FaHome size={18} /> },
  { key: "agents", label: "Units", icon: <FaUsers size={18} /> },
  { key: "orphan_endorsements", label: "Orphan Clients Endorsements", icon: <FaUserFriends size={18} />, umOnly: true },
  { key: "kpi_assignment", label: "KPI Assignment", icon: <FaBullseye size={18} /> },
  { key: "orphan_clients", label: "Orphan Client Management", icon: <FaUserFriends size={18} />, bmOnly: true },
  { key: "kpi_progress", label: "Branch KPI Progress", icon: <FaChartLine size={18} /> },
];

function ManagerSideNav({ roleLabel, active, onNavigate, collapsed, onToggle, showUnitKpiProgress = true }) {
  return (
    <aside className={`manager-side-nav ${collapsed ? "collapsed" : ""}`}>
      <div className="manager-side-nav__head">
        <div className="manager-side-nav__topline">
          <span className="manager-side-nav__eyebrow">Manager Workspace</span>
          <button
            type="button"
            className="manager-side-nav__toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Expand manager navigation" : "Collapse manager navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <FaChevronRight size={14} /> : <FaChevronLeft size={14} />}
          </button>
        </div>

        <div className="manager-side-nav__branding">
          <span className="manager-side-nav__brand-icon">
            <FaBars size={14} />
          </span>
          {!collapsed && (
            <div>
              <strong>{roleLabel} Portal</strong>
              <small>Team visibility and performance insights.</small>
            </div>
          )}
        </div>
      </div>

      <div className="manager-side-nav__list">
        {NAV_ITEMS.filter((item) => (roleLabel === "BM" || item.key !== "kpi_assignment") && (roleLabel === "BM" || item.key !== "kpi_progress" || showUnitKpiProgress) && (!item.bmOnly || roleLabel === "BM") && (!item.umOnly || roleLabel === "UM")).map((item) => {
          const itemLabel = item.key === "agents" && roleLabel !== "BM"
            ? "Unit Details"
            : item.key === "kpi_progress" && roleLabel !== "BM"
              ? "Unit KPI Progress"
              : item.label;
          return (
            <button
              key={item.key}
              type="button"
              className={`manager-side-nav__item ${active === item.key ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
              title={collapsed ? itemLabel : undefined}
            >
              <span className="manager-side-nav__icon">{item.icon}</span>
              {!collapsed && <span>{itemLabel}</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default ManagerSideNav;