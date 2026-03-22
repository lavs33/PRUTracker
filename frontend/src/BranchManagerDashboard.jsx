import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './BranchManagerDashboard.css';
import KPIManagement from './components/KPIManagement';
import OrphanClientManagement from './components/OrphanClientManagement';
import ClientAssignment from './components/ClientAssignment';
import KPIProgressDashboard from './components/KPIProgressDashboard';
import Notifications from './components/Notifications';
import TopNav from './components/TopNav';
import SideNav from './components/SideNav';
import { logout } from './utils/logout';

const BranchManagerDashboard = () => {
    const navigate = useNavigate();
    const { username } = useParams();

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user"));
        } catch {
            return null;
        }
    }, []);

    const [activeTab, setActiveTab] = useState('kpi');
    const [notifications, setNotifications] = useState([]);
    const [branchData, setBranchData] = useState(null);

    // Redirect/role guard
    useEffect(() => {
        if (!user || user.username !== username || user.role !== 'BM') {
            navigate("/", { replace: true });
        }
    }, [user, username, navigate]);

    // Dynamic title
    useEffect(() => {
        if (user) document.title = `${user.username} | Orphan & KPI Assignment`;
    }, [user]);

    // fetch data
    useEffect(() => {
        const fetchBranchData = async () => {
            if (!user || !user.branchId) return;
            try {
                const response = await fetch(`/api/branch/${user.branchId}/data`);
                const data = await response.json();
                setBranchData(data);
            } catch (err) {
                console.error('Error fetching branch data:', err);
            }
        };
        fetchBranchData();
    }, [user]);

    if (!user || user.username !== username || user.role !== 'BM') return null;

    const handleNotification = (message, type = 'info') => {
        const newNotification = { id: Date.now(), message, type, timestamp: new Date() };
        setNotifications((prev) => [newNotification, ...prev]);
    };

    const handleSideNav = (key) => {
        if (!user) return navigate("/");
        switch (key) {
            case 'dashboard':
                navigate(`/branch-manager/${user.username}/dashboard`);
                break;
            case 'clients':
                navigate(`/agent/${user.username}/clients`);
                break;
            case 'tasks':
                navigate(`/agent/${user.username}/tasks`);
                break;
            case 'sales':
                alert('Sales module coming soon');
                break;
            default:
                break;
        }
    };

    return (
        <div className="page-shell">
            <TopNav
                user={user}
                onLogoClick={() => navigate(`/branch-manager/${user.username}`)}
                onProfileClick={() => navigate(`/agent/${user.username}/profile`)}
                onLogout={() => logout(navigate)}
                onNotificationsClick={() => navigate(`/agent/${user.username}/notifications`)}
            />

            <div className="page-body">
                <SideNav onNavigate={handleSideNav} />

                <main className="page-content">
                    <h1 className="module-title">Orphan & KPI Assignment</h1>

                    <div className="section-row">
                        <button
                            className={`tasks-btn primary ${activeTab === 'kpi' ? 'active' : ''}`}
                            onClick={() => setActiveTab('kpi')}
                        >
                            KPI Management
                        </button>
                        <button
                            className={`tasks-btn primary ${activeTab === 'orphan' ? 'active' : ''}`}
                            onClick={() => setActiveTab('orphan')}
                        >
                            Orphan Clients
                        </button>
                        <button
                            className={`tasks-btn primary ${activeTab === 'clients' ? 'active' : ''}`}
                            onClick={() => setActiveTab('clients')}
                        >
                            Client Assignment
                        </button>
                        <button
                            className={`tasks-btn primary ${activeTab === 'progress' ? 'active' : ''}`}
                            onClick={() => setActiveTab('progress')}
                        >
                            KPI Progress
                        </button>
                    </div>

                    <div className="dashboard-content">
                        {activeTab === 'kpi' && <KPIManagement onNotify={handleNotification} />}
                        {activeTab === 'orphan' && <OrphanClientManagement onNotify={handleNotification} />}
                        {activeTab === 'clients' && <ClientAssignment onNotify={handleNotification} />}
                        {activeTab === 'progress' && <KPIProgressDashboard onNotify={handleNotification} />}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default BranchManagerDashboard;