import { FaBuilding, FaMapMarkedAlt, FaProjectDiagram, FaSitemap, FaUserTie, FaUsers } from 'react-icons/fa';
import './AdminNav.css';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: FaSitemap, description: 'Hierarchy view and quick counts.' },
  { id: 'areas', label: 'Areas', icon: FaMapMarkedAlt, description: 'Create or update area records.' },
  { id: 'branches', label: 'Branches', icon: FaBuilding, description: 'Manage branch placements per area.' },
  { id: 'units', label: 'Units', icon: FaProjectDiagram, description: 'Assign units under branches.' },
  { id: 'managers', label: 'Managers', icon: FaUserTie, description: 'Promote agents into BM / UM / AUM roles.' },
  { id: 'agents', label: 'Agents', icon: FaUsers, description: 'Create and edit agent details.' },
];

function AdminNav({ activeSection, isCollapsed, onChange, onToggle }) {
  return (
    <aside className={`admin-nav${isCollapsed ? ' collapsed' : ''}`}>
      <div className="admin-nav-head">
        <div>
          <p>Admin Workspace</p>
          <strong>{isCollapsed ? 'Admin' : 'Organization Controls'}</strong>
        </div>
        <button type="button" className="admin-nav-toggle" onClick={onToggle} aria-label={isCollapsed ? 'Expand admin navigation' : 'Collapse admin navigation'}>
          {isCollapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="admin-nav-list" aria-label="Admin organization navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-item${isActive ? ' active' : ''}`}
              onClick={() => onChange(item.id)}
            >
              <Icon />
              <span>
                <strong>{item.label}</strong>
                {!isCollapsed ? <small>{item.description}</small> : null}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default AdminNav;
