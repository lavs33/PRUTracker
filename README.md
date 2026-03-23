# PRUTracker

PRUTracker is a full-stack sales workflow and client management system built for insurance teams. It helps agents and managers manage prospects, leads, client relationships, meetings, tasks, notifications, product selection, and multi-stage policy workflows from first contact to policy issuance.

---

## Overview

PRUTracker is designed around a structured lead lifecycle:

1. **Prospect creation**
2. **Lead generation**
3. **Lead engagement / contacting**
4. **Needs Assessment**
5. **Proposal**
6. **Application**
7. **Policy Issuance**

The app also includes:
- **Role-based portals** for Agents, AUMs, UMs, BMs, and Admins
- **Organizational hierarchy management** (Area → Branch → Unit)
- **Task and notification tracking**
- **Meeting scheduling and conflict validation**
- **Product catalog + payment/coverage term metadata**
- **Relationship and sales performance dashboards**

---

## User Roles

### Admin
- Logs in through a separate admin login
- Manages the organization structure:
  - Areas
  - Branches
  - Units
  - Agents
  - Manager assignments

### Managers
Supported manager roles:
- **AUM** – Assistant Unit Manager
- **UM** – Unit Manager
- **BM** – Branch Manager

Managers use their own portal pages and are tied to organizational scope.

### Agents
Agents can:
- manage prospects and leads
- track engagements across sales stages
- schedule meetings
- upload stage artifacts
- manage tasks and notifications
- view client relationships and sales performance

---

## Main Features

### 1. Prospect & Lead Management
- Create and update prospects
- Generate leads from prospects
- Track lead status:
  - New
  - In Progress
  - Closed
  - Dropped
- Automatically drop leads when a prospect is assessed as **not interested**

### 2. Multi-Stage Engagement Workflow
Lead engagement is tracked across these stages:
- Not Started
- Contacting
- Needs Assessment
- Proposal
- Application
- Policy Issuance

Each stage can persist its own structured data.

### 3. Meeting Scheduling
- Schedule meetings for:
  - Needs Assessment
  - Proposal Presentation
  - Application Submission
- Prevent overlapping meetings
- Support online and face-to-face meetings
- Store links, platforms, locations, and status

### 4. Product Catalog
- Structured product catalog with:
  - product category
  - description
  - payment term options
  - coverage duration rules

### 5. Organization Management
- Seed and manage the hierarchy:
  - Area
  - Branch
  - Unit
- Assign managers and agents within the hierarchy

### 6. Tasks, Notifications, and Dashboards
- Task summary and progress views
- Notification list + unread counters
- Sales performance dashboard
- Client relationship dashboard

---

## Tech Stack

### Frontend
- React
- React Router
- React Scripts
- Testing Library

### Backend
- Node.js
- Express
- MongoDB
- Mongoose
- dotenv
- cors
- bcryptjs

---

## Project Structure

```bash
PRUTracker/
├── backend/
│   ├── models/          # Mongoose schemas
│   ├── seed/            # Seed scripts
│   ├── server.js        # Express API server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── constants/
│   │   ├── assets/
│   │   └── App.js
│   └── package.json
└── package.json
