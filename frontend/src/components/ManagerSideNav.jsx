import { FaBars, FaChartLine, FaChevronLeft, FaChevronRight, FaHome, FaTasks, FaUsers } from "react-icons/fa";
import "./ManagerSideNav.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: <FaHome size={18} /> },
  { key: "agents", label: "Agents", icon: <FaUsers size={18} /> },
  { key: "task_progress", label: "Task Progress", icon: <FaTasks size={18} /> },
  { key: "sales_performance", label: "Sales Performance", icon: <FaChartLine size={18} /> },
];

function ManagerSideNav({ roleLabel, active, onNavigate, collapsed, onToggle }) {
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
              <small>Team visibility, coaching, and performance insights.</small>
            </div>
          )}
        </div>
      </div>

      <div className="manager-side-nav__list">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`manager-side-nav__item ${active === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
            title={collapsed ? item.label : undefined}
          >
            <span className="manager-side-nav__icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}

export default ManagerSideNav;
