# PRUTracker

PRUTracker is a full-stack insurance sales workflow, client management, and manager operations system. It supports prospect-to-policy conversion, role-based portals, organizational administration, orphan client reassignment, KPI assignment/progress tracking, task management, notifications, and policyholder payment workflows.

---

## Current Application Scope

PRUTracker is organized around four major workflows:

1. **Sales pipeline management** — prospects, leads, contact attempts, meetings, needs assessment, proposal, application, and policy issuance.
2. **Client and policyholder servicing** — policyholder records, annual payment records, payment/EOR handling, cancellation, and relationship dashboards.
3. **Manager operations** — branch/unit/agent oversight, orphan client handling for retired or long-leave agents, endorsements, and KPI assignment/progress monitoring.
4. **Admin organization management** — areas, branches, units, agents, manager assignments, blocking, and profile updates.

---

## User Roles and Portals

### Admin

Admins use a dedicated admin login and organization management page to:

- Create, update, and delete organization records for **Areas**, **Branches**, and **Units**.
- Create and update agent records.
- Assign manager roles to agents.
- Manage supported manager roles:
  - **AUM** — Assistant Unit Manager
  - **UM** — Unit Manager
  - **BM** — Branch Manager
- Block or unblock manager access where supported by the organization workflow.

### Branch Managers (BM)

Branch Managers use the manager portal for branch-level oversight. Current BM capabilities include:

- Viewing branch dashboard and branch agents.
- Recording an agent as **Retired**.
- Recording an agent as **On Long Leave** with supporting proof files.
- Reviewing and confirming affected orphan prospects and policyholders.
- Endorsing orphan clients to the appropriate unit manager.
- Reassigning orphan prospects and policyholders to active agents.
- Assigning KPIs to branch, unit, and agent scopes.
- Viewing branch KPI progress dashboards.

### Unit Managers (UM)

Unit Managers use the manager portal for unit-level oversight. Current UM capabilities include:

- Viewing unit dashboard and unit agents.
- Receiving orphan client endorsement notifications from branch workflows.
- Reviewing orphan endorsements from **long leave** and **retirement** records.
- Viewing KPI progress for their unit scope.

### Assistant Unit Managers (AUM)

Assistant Unit Managers use manager profile and dashboard views scoped to their organizational assignment.

### Agents

Agents use the agent portal to:

- Manage prospects and leads.
- Work through lead engagement stages.
- Schedule and update meetings.
- Complete needs assessment, proposal, application, and policy issuance activities.
- Manage policyholders and payment records.
- Track tasks and progress.
- Read notifications.
- View sales performance, client relationship, and KPI progress dashboards.
- Receive reassigned orphan clients as system-assigned work.

---

## Main Features

### Prospect and Lead Management

- Create and update prospects.
- Generate leads from prospects.
- Track lead status across **New**, **In Progress**, **Closed**, and **Dropped** states.
- Preserve agent-sourced vs. system-assigned lead/prospect attribution.
- Support reassigned prospects through `reassignedToUserId` and reassignment timestamps.
- Automatically handle non-interested prospects by dropping applicable leads.

### Lead Engagement Workflow

Lead engagement is tracked through the following stages:

1. **Not Started**
2. **Contacting**
3. **Needs Assessment**
4. **Proposal**
5. **Application**
6. **Policy Issuance**

The workflow supports:

- Contact attempts and validation.
- Interest assessment.
- Needs assessment attendance and follow-up decisions.
- Proposal generation and presentation tracking.
- Application attendance, submission validation, and premium payment transfer details.
- Policy issuance status, policy summaries, coverage duration, and initial premium EOR information.
- Stage history and task generation.

### Meeting Scheduling

- Schedule meetings for needs assessment, proposal presentation, and application submission.
- Validate meeting availability and prevent overlapping schedules.
- Support online and face-to-face meetings.
- Store meeting platform, meeting link, place, duration, invite status, and meeting status.
- Cancel scheduled meetings when orphan reassignment resets a lead back to contacting.

### Policyholder, Annual Payment, and EOR Workflows

- List and view policyholders.
- View policyholder details from converted lead engagement records.
- Record policy cancellation information.
- Manage annual payment records.
- Add payment records.
- View payment details.
- Transfer payment records where supported.
- Create EOR reminders and validate duplicate EOR numbers.

### Orphan Client Management

The codebase now includes a manager-facing orphan client module for agents who retire or go on long leave.

#### Long Leave Flow

Branch managers can:

- Record long leave details for an agent.
- Require a leave start date and leave end date.
- Enforce long leave duration beyond seven days.
- Upload required supporting documents:
  - Leave application form PDF.
  - Proof of approved leave image.
- Confirm affected orphan prospects and optionally affected ongoing policyholders.
- Endorse confirmed orphan clients to the relevant unit manager.
- Mark the agent as **On Long Leave** after endorsement.
- Automatically reactivate long-leave agents when their leave period ends.

#### Retirement Flow

Branch managers can:

- Record retirement details for an agent.
- Validate retirement date against employment date.
- Upload required supporting documents:
  - Accomplished retirement letter PDF.
  - Proof of approved retirement image.
- Confirm affected orphan prospects and policyholders.
- Endorse confirmed orphan clients to the relevant unit manager.
- Mark the agent as **Retired** after endorsement.

#### Reassignment Behavior

For orphan reassignment, the backend can:

- Reassign orphan prospects to another active agent.
- Reassign orphan policyholders to another active agent.
- Mark affected orphan records as reassigned.
- Preserve original ownership and reassignment metadata.
- Convert reassigned prospects/leads to system-assigned records.
- Cancel pending meetings tied to reassigned active lead engagement.
- Remove stale open/overdue tasks from the original agent.
- Create a new contact task for the receiving agent when an active lead is reassigned.
- Notify both the original agent and the receiving agent about the transfer.
- Notify unit managers about orphan endorsements.

### KPI Assignment and Progress Tracking

The codebase now includes a KPI assignment module and KPI progress views.

#### KPI Assignment

Branch managers can assign KPIs across these scopes:

- **Branch**
- **Unit**
- **Agent**

KPI assignment supports:

- KPI key and label metadata.
- Assignment toggles.
- Value types:
  - Count
  - Currency
  - Percent
  - Index
- KPI frequencies:
  - Daily
  - Weekly
  - Monthly
  - Quarterly
  - Semi-Annually
  - Annually
- Minimum, maximum, or exact target values.
- Multiple period-specific targets per KPI.
- Upsert behavior with one assignment document per scope.
- Tracking the user who last updated the assignment.

#### KPI Progress

Managers and agents can view KPI progress dashboards that compare actual performance against assigned targets. The frontend includes:

- Branch KPI assignment view.
- Branch KPI progress dashboard.
- Unit KPI progress dashboard.
- Agent KPI progress page.
- Date preset handling mapped to KPI frequency periods.
- Progress summaries, target comparison, and status indicators.

### Tasks, Notifications, and Dashboards

- Agent home dashboard.
- Recent prospects and policyholders.
- Client relationship dashboard.
- Sales performance dashboard.
- Task summary, all tasks, and task progress views.
- Agent notifications.
- Manager notifications.
- Notification deduplication and metadata for tasks, orphan transfers, orphan endorsements, and policyholder/prospect events.

### Product Catalog

- Product model and seed scripts.
- Product terms seed support.
- Product metadata used by proposal, policyholder, policy issuance, and payment workflows.

---

## Frontend Routes

The React app uses React Router and currently exposes these main route groups:

### Public and Admin

- `/` — landing page
- `/login` — agent login
- `/admin/login` — admin login
- `/admin/organization` — admin organization management

### Manager

- `/aum/:username`
- `/um/:username`
- `/bm/:username`
- `/aum/:username/profile`
- `/um/:username/profile`
- `/bm/:username/profile`
- `/um/:username/notifications`

Manager views are selected inside the manager portal navigation, including dashboards, agents, KPI assignment/progress, orphan client management, and orphan endorsements where allowed by role.

### Agent

- `/agent/:username`
- `/agent/:username/profile`
- `/agent/:username/clients`
- `/agent/:username/clients/relationship`
- `/agent/:username/prospects`
- `/agent/:username/prospects/new`
- `/agent/:username/prospects/:prospectId`
- `/agent/:username/prospects/:prospectId/full`
- `/agent/:username/prospects/:prospectId/leads/new`
- `/agent/:username/prospects/:prospectId/leads/:leadId`
- `/agent/:username/prospects/:prospectId/leads/:leadId/engage`
- `/agent/:username/policyholders`
- `/agent/:username/policyholders/:policyholderId`
- `/agent/:username/policyholders/:policyholderId/cancel`
- `/agent/:username/policyholders/:policyholderId/annual-payments/:annualPaymentId`
- `/agent/:username/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/new`
- `/agent/:username/policyholders/:policyholderId/annual-payments/:annualPaymentId/payments/:paymentId`
- `/agent/:username/tasks`
- `/agent/:username/tasks/all`
- `/agent/:username/tasks/progress`
- `/agent/:username/notifications`
- `/agent/:username/sales/performance`
- `/agent/:username/kpi/progress`

---

## Backend API Areas

The backend is an Express API with route groups for:

- Authentication and role-specific login.
- Admin organization management.
- Agent and manager profile password updates.
- Prospect CRUD and full prospect details.
- Lead creation and lead details.
- Lead engagement activities.
- Meeting availability and scheduling.
- Needs assessment, proposal, application, and policy issuance.
- Policyholder details, cancellation, annual payments, payment records, transfers, EOR reminders, and duplicate EOR validation.
- Tasks and task progress.
- Notifications.
- Manager retirement records.
- Manager long-leave records.
- Orphan prospect and policyholder reassignment.
- Manager KPI assignments.
- Agent KPI progress.

---

## Data Models

The backend uses Mongoose models for:

- `Admin`
- `User`
- `Agent`
- `AUM`, `UM`, `BM`
- `Area`, `Branch`, `Unit`
- `Prospect`
- `Lead`
- `LeadEngagement`
- `ContactAttempt`
- `ScheduledMeeting`
- `NeedsAssessment`
- `Proposal`
- `Application`
- `Policy`
- `Policyholder`
- `AnnualPayment`
- `Payment`
- `Product`
- `Task`
- `Notification`
- `LongLeave`
- `Retirement`
- `KpiAssignment`

---

## Tech Stack

### Frontend

- React 19
- React DOM
- React Router DOM 7
- React Scripts 5
- React Icons
- Testing Library
- Web Vitals

### Backend

- Node.js
- Express 5
- MongoDB
- Mongoose 9
- dotenv
- cors
- bcryptjs

---

## Project Structure

```text
PRUTracker/
├── backend/
│   ├── controllers/          # Route controller helpers, including auth and notifications
│   ├── models/               # Mongoose schemas for users, agents, sales workflows, orphan flows, and KPIs
│   ├── routes/               # Auth, notification, and legacy API route registration
│   ├── seed/                 # Admin/product/product-term seed scripts
│   ├── utils/                # Backend utility helpers
│   ├── server.js             # Express app, MongoDB connection, manager orphan routes, KPI routes
│   └── package.json
├── frontend/
│   ├── public/               # CRA public assets
│   ├── src/
│   │   ├── assets/           # Images, logo, and font assets
│   │   ├── components/       # Shared navigation components
│   │   ├── constants/        # Shared frontend constants
│   │   ├── utils/            # Frontend helper utilities
│   │   ├── App.js            # React Router route definitions
│   │   └── *.jsx / *.css     # Page-level modules and styles
│   └── package.json
├── package.json              # Root dependency metadata
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js and npm
- MongoDB Atlas or another reachable MongoDB connection string

### Backend Setup

```bash
cd backend
npm install
```

Create a backend `.env` file with at least:

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

Start the backend:

```bash
node server.js
```

The health check route is available at:

```text
GET /
```

Expected response:

```text
PRUTracker backend is running
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend is a Create React App application. If the frontend needs to call a non-default backend URL, configure the API base URL according to the environment variables used by the frontend code.

---

## Seed Scripts

Available backend seed scripts include:

```bash
node backend/seed/seedAdmin.js
node backend/seed/seed-products.js
node backend/seed/seed-product-terms.js
```

---

## Testing and Build Commands

### Frontend

```bash
cd frontend
npm test
npm run build
```

### Backend

The backend package currently has a placeholder `npm test` script. For backend validation, run the server locally against a configured MongoDB connection and exercise the API routes used by the frontend.

---

## Notes for Current Development

- Most legacy business endpoints are registered through `backend/routes/legacyRoutes.js`.
- Manager orphan client and KPI routes currently live in `backend/server.js`.
- The orphan module depends on `LongLeave`, `Retirement`, `Prospect`, `Policyholder`, `Task`, and `Notification` data staying in sync during reassignment.
- KPI assignments are stored in `KpiAssignment` documents keyed by `scopeType` and `scopeId`.
- Agent-facing prospect and policyholder queries account for reassignment using `reassignedToUserId` where applicable.
## Deploying to Vercel

This repository is configured for a Vercel deployment with the React frontend served from `frontend/build` and the Express API exposed through `api/index.js`.

### Required environment variables

Set these in **Vercel Project Settings → Environment Variables** before deploying:

| Variable | Where | Description |
| --- | --- | --- |
| `MONGO_URI` | Server | MongoDB Atlas connection string used by the Express API. |
| `REACT_APP_API_BASE_URL` | Frontend | API base URL for browser requests. Leave blank for same-origin Vercel deployments, or set to your deployed backend origin if the API is hosted separately. |
| `CORS_ORIGIN` | Server | Optional comma-separated list of allowed frontend origins. Omit to allow all origins. |

### Vercel settings

Use the repository root as the Vercel project root. The included `vercel.json` handles the build and routing configuration:

- Vercel installs both `frontend` and `backend` dependencies before building.
- `/api/*` routes are served by the Express app through `api/index.js`.
- All other routes are served by the React static build in `frontend/build`, with React Router paths falling back to `index.html`.

### Local deployment check

Before pushing to Vercel, run:

```bash
cd frontend && npm run build
```

You can then import the repository in Vercel or run `vercel --prod` from the repository root after installing and logging in to the Vercel CLI.