import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FaUsers, FaTasks, FaChartLine } from "react-icons/fa";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./SideNav.css";

const LS_COLLAPSED_KEY = "sidenav_collapsed";

function SideNav({ active, onNavigate }) {
  const location = useLocation();

  const inferredActive = useMemo(() => {
    const p = location.pathname;

    if (p.includes("/notifications")) return null;

    if (p.includes("/tasks/progress")) return "tasks_progress";
    if (p.includes("/tasks/all")) return "tasks_all";
    if (p.includes("/tasks")) return "tasks";

    if (p.includes("/sales/performance")) return "sales_performance";
    if (p.includes("/clients/relationship")) return "clients_relationship";
    if (p.includes("/prospects")) return "clients_all_prospects";
    if (p.includes("/policyholders")) return "clients_all_policyholders";
    if (p.includes("/clients")) return "clients";

    return null;
  }, [location.pathname]);

  const activeKey = active ?? inferredActive; 


  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const isActive = (key) => activeKey === key;

  const isGroupActive = (groupKey) => {
    if (!activeKey) return false;
    if (activeKey === groupKey) return true;
    return String(activeKey).startsWith(`${groupKey}_`);
  };

  const isGroupSubActive = (groupKey) => {
    if (!activeKey) return false;
    return String(activeKey).startsWith(`${groupKey}_`);
  };

  const items = useMemo(
    () => [
      {
        key: "clients",
        label: "Clients",
        icon: <FaUsers size={22} />,
        children: [
          { key: "clients_all_prospects", label: "All Prospects" },
          { key: "clients_all_policyholders", label: "All Policyholders" },
          { key: "clients_relationship", label: "Clients Relationship" },
        ],
      },
      {
        key: "tasks",
        label: "Tasks",
        icon: <FaTasks size={22} />,
        children: [
          { key: "tasks_all", label: "All Tasks" },
          { key: "tasks_progress", label: "Task Progress" },
        ],
      },
      { key: "sales_performance", label: "Sales Performance", icon: <FaChartLine size={22} /> },
    ],
    []
  );

  const [openGroups, setOpenGroups] = useState({ clients: false, tasks: false });

  useEffect(() => {
    const inClients = isGroupActive("clients");
    const inTasks = isGroupActive("tasks");
    setOpenGroups({
      clients: inClients,
      tasks: inTasks,
    });
    // DO NOT REMOVE THE LINE BELOW
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const toggleGroup = (groupKey) => {
    setOpenGroups((g) => ({
      ...g,
      [groupKey]: !g[groupKey],
    }));
  };

  return (
    <aside className={`side-nav ${collapsed ? "collapsed" : ""}`}>
      <div className="side-nav-top">
        <div className="side-nav-brand">
          <span className="side-nav-eyebrow">CRM Workspace</span>
          {!collapsed && (
            <>
              <strong className="side-nav-brandTitle">Agent Command Center</strong>
              <small className="side-nav-brandMeta">Pipeline, tasks, and sales visibility</small>
            </>
          )}
        </div>

        <button
          type="button"
          className="side-nav-collapseBtn"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
        </button>
      </div>

      <div className="side-nav-list">
        {!collapsed && <div className="side-nav-sectionLabel">Navigation</div>}

        {items.map((item) => {
          const groupActive = isGroupActive(item.key);
          const groupSubActive = isGroupSubActive(item.key);
          const groupOpen = !!openGroups[item.key];
          const hasChildren = item.children?.length > 0;

          return (
            <div key={item.key} className="side-nav-group">
              <button
                type="button"
                className={`side-nav-item ${groupActive ? "active" : ""} ${
                  groupSubActive ? "subActive" : ""
                }`}
                onClick={() => onNavigate(item.key)}
              >
                <div className="side-nav-icon">{item.icon}</div>

                {!collapsed && (
                  <div className="side-nav-labelRow">
                    <div className="side-nav-labelBlock">
                      <div className="side-nav-label">{item.label}</div>
                      {hasChildren ? <div className="side-nav-caption">{`${item.children.length} views`}</div> : null}
                    </div>

                    {hasChildren ? (
                      <button
                        type="button"
                        className="side-nav-caretBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(item.key);
                        }}
                        aria-label={groupOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                        title={groupOpen ? "Collapse" : "Expand"}
                      >
                        <span className={`side-nav-caretIcon ${groupOpen ? "open" : ""}`}>▾</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </button>

              {!collapsed && hasChildren && groupOpen && (
                <div className="side-nav-subList">
                  {item.children.map((child) => (
                    <button
                      key={child.key}
                      type="button"
                      className={`side-nav-subItem ${isActive(child.key) ? "active" : ""}`}
                      onClick={() => onNavigate(child.key)}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default SideNav;
 
