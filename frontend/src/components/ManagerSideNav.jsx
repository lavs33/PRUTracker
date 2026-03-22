import { FaChartLine, FaHome, FaTasks, FaUsers } from "react-icons/fa";
import "./ManagerSideNav.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: <FaHome size={20} /> },
  { key: "agents", label: "Agents", icon: <FaUsers size={20} /> },
  { key: "task_progress", label: "Task Progress", icon: <FaTasks size={20} /> },
  { key: "sales_performance", label: "Sales Performance", icon: <FaChartLine size={20} /> },
];

function ManagerSideNav({ roleLabel, active, onNavigate }) {
  return (
    <aside className="manager-side-nav">
      <div className="manager-side-nav__head">
        <span className="manager-side-nav__eyebrow">Manager Workspace</span>
        <strong>{roleLabel} Portal</strong>
        <small>Unit visibility, coaching, and team performance.</small>
      </div>

      <div className="manager-side-nav__list">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`manager-side-nav__item ${active === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            <span className="manager-side-nav__icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default ManagerSideNav;
