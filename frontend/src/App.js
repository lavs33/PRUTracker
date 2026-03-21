import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./LandingPage";
import LoginPage from "./LoginPage";
import AdminLoginPage from "./AdminLoginPage";
import AdminOrganizationPage from "./AdminOrganizationPage";
import AgentHome from "./AgentHome";
import AgentProfile from "./AgentProfile";
import AgentClients from "./AgentClients";
import AgentClientsRelationship from "./AgentClientsRelationship";
import AgentProspectsAll from "./AgentProspectsAll";
import AgentPolicyholdersAll from "./AgentPolicyholdersAll";
import AgentProspectDetails from "./AgentProspectDetails";
import AgentProspectFullDetails from "./AgentProspectFullDetails";
import AgentAddProspect from "./AgentAddProspect";
import AgentAddLead from "./AgentAddLead";
import AgentLeadDetails from "./AgentLeadDetails";
import AgentLeadEngagement from "./AgentLeadEngagement";

import AgentTasks from "./AgentTasks";
import AgentTasksAll from "./AgentTasksAll";
import AgentTasksProgress from "./AgentTasksProgress";

import AgentNotifications from "./AgentNotifications";
import AgentSalesPerformance from "./AgentSalesPerformance";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/organization" element={<AdminOrganizationPage />} />

        {/* Agent routes (guard handled inside pages) */}
        <Route path="/agent/:username" element={<AgentHome />} />
        <Route path="/agent/:username/profile" element={<AgentProfile />} />
        <Route path="/agent/:username/clients" element={<AgentClients />} />
        <Route path="/agent/:username/clients/relationship" element={<AgentClientsRelationship />} />
      
        <Route path="/agent/:username/prospects" element={<AgentProspectsAll />} />
        <Route path="/agent/:username/policyholders" element={<AgentPolicyholdersAll />} />
        <Route path="/agent/:username/prospects/new" element={<AgentAddProspect />} />
        <Route path="/agent/:username/prospects/:prospectId" element={<AgentProspectDetails />}  />
        <Route path="/agent/:username/prospects/:prospectId/full" element={<AgentProspectFullDetails />} />

        <Route path="/agent/:username/prospects/:prospectId/leads/new" element={<AgentAddLead />}/>
        <Route path="/agent/:username/prospects/:prospectId/leads/:leadId" element={<AgentLeadDetails />} />
        <Route path="/agent/:username/prospects/:prospectId/leads/:leadId/engage" element={<AgentLeadEngagement />}/>
        
        <Route path="/agent/:username/tasks" element={<AgentTasks />} />
        <Route path="/agent/:username/tasks/all" element={<AgentTasksAll />} />
        <Route path="/agent/:username/tasks/progress" element={<AgentTasksProgress />} />

        <Route path="/agent/:username/notifications" element={<AgentNotifications />} />
        <Route path="/agent/:username/sales/performance" element={<AgentSalesPerformance />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
