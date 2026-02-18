# MISSION CONTROL BLUEPRINT
## Alex Claww Autonomous Agent Command Centre

---

## ARCHITECTURE OVERVIEW

**Mission Control Hub** = Central command centre for autonomous agents (Sophia CSM, Alex Outreach, System Tasks)

**Three Core Pillars:**
1. **Agent Management** — Control Sophia, Alex, system tasks (start/stop/status)
2. **Email Queue & Workflow** — Incoming customer emails → analysis → approval → execution
3. **Audit Trail** — Every action logged, every decision tracked

---

## DATABASE SCHEMA (Supabase)

### 1. AGENTS TABLE
```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  name TEXT (sophia_csm, alex_outreach, system_tasks),
  status TEXT (online, idle, offline, error),
  current_task TEXT,
  last_activity TIMESTAMP,
  role TEXT (csm, outreach, automation),
  health_check BOOLEAN
);
```

### 2. EMAIL_QUEUE TABLE
```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY,
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body TEXT,
  received_at TIMESTAMP,
  client TEXT (ascend_lc, favorite_logistics, race_technik),
  status TEXT (pending, analyzing, awaiting_approval, approved, sent, skipped),
  priority INT,
  requires_approval BOOLEAN,
  analysis JSON (escalation_type, reasons, sophia_recommendation),
  created_at TIMESTAMP
);
```

### 3. APPROVALS TABLE
```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY,
  email_queue_id UUID FOREIGN KEY,
  approval_type TEXT (routine_response, escalation, terminal_command),
  request_body TEXT,
  status TEXT (pending, approved, rejected),
  requested_at TIMESTAMP,
  approved_by TEXT (josh, salah),
  approved_at TIMESTAMP,
  notes TEXT
);
```

### 4. AUDIT_LOG TABLE
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  agent TEXT,
  action TEXT,
  details JSON,
  status TEXT (success, failure, pending),
  executed_at TIMESTAMP,
  duration_ms INT,
  error_message TEXT
);
```

### 5. KILL_SWITCH TABLE
```sql
CREATE TABLE kill_switch (
  id UUID PRIMARY KEY DEFAULT 1,
  status TEXT (running, stopped),
  reason TEXT,
  triggered_at TIMESTAMP,
  triggered_by TEXT
);
```

### 6. TASK_QUEUE TABLE
```sql
CREATE TABLE task_queue (
  id UUID PRIMARY KEY,
  agent TEXT,
  task_type TEXT (email_send, email_analysis, terminal_command, cron_job),
  status TEXT (queued, executing, completed, failed, skipped),
  payload JSON,
  result JSON,
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INT DEFAULT 0
);
```

---

## UI COMPONENTS TO BUILD/MODIFY

### Home Dashboard
- **Real-time Agent Status** (Sophia: online/idle, Alex: online/idle, System: online/offline)
- **Quick Stats**:
  - Emails pending approval
  - Tasks in queue
  - Audit log live feed
  - System health (CPU, memory, storage)
- **Action Buttons**:
  - "View Pending Approvals"
  - "View Email Queue"
  - "Kill Switch Status"
  - "Live Logs"

### Agents Page (MODIFY)
**Current state:** Generic agent cards  
**New state:** Sophia + Alex specific

**Sophia CSM Card:**
- Status (Online/Idle/Offline)
- Current task ("Analyzing email from Riaan...")
- Last activity
- Client context (Ascend LC, Favorite Logistics, Race Technik)
- Controls: Start, Pause, Restart, View Logs
- Quick link to "Pending Approvals"

**Alex Outreach Card:**
- Status
- Current campaign (if running)
- Leads processed this week
- Response rate
- Controls: Start, Pause, Restart, View Logs
- Quick link to "Outreach Queue"

### Tasks Page (NEW/MODIFY)
**Email Queue View:**
- Column: From, Subject, Client, Received, Status
- Filter: By client, status, priority
- Actions:
  - View full email
  - View Sophia's analysis
  - Approve/Reject if pending approval
  - Mark as "no response needed"

**Approval Panel:**
- Card layout showing email + Sophia's analysis
- Green "Approve" button
- Red "Reject" button
- Text field for notes/feedback
- Shows: Date, client, escalation reason (if applicable)

**Task Queue View:**
- Running tasks
- Completed tasks (last 24h)
- Failed tasks with error details
- Retry controls

### New: Kill Switch Panel
- **Status indicator** (Green = running, Red = stopped)
- **Manual trigger button** ("STOP ALL OPERATIONS")
- **History of activations** (who, when, why)
- **Auto-recovery** after X minutes (optional)

### New: Audit Log Viewer
- Real-time feed of all operations
- Filter by:
  - Agent (Sophia, Alex, System)
  - Action type
  - Status (success/failure)
  - Time range
- Searchable
- Export to CSV

### Settings Page (MODIFY)
**New sections:**
- **Kill Switch Configuration** (auto-timeout, notifications)
- **Approval Workflow** (who gets notified, approval timeout)
- **Email Config** (client list, SMTP, polling interval)
- **Agent Config** (Sophia rules, Alex campaign settings)

---

## API ENDPOINTS NEEDED

### Email Management
- `POST /api/email/queue` — Add email to queue
- `GET /api/email/queue` — Get pending emails
- `POST /api/email/analyze` — Analyze email (Sophia's job)
- `POST /api/email/approve` — Approve response
- `POST /api/email/reject` — Reject response
- `POST /api/email/send` — Send approved response

### Agent Management
- `GET /api/agents` — Get all agents
- `POST /api/agents/{id}/start` — Start agent
- `POST /api/agents/{id}/stop` — Stop agent
- `POST /api/agents/{id}/status` — Get status
- `GET /api/agents/{id}/logs` — Get agent logs

### Approvals
- `GET /api/approvals/pending` — Get pending approvals
- `POST /api/approvals/{id}/approve` — Approve
- `POST /api/approvals/{id}/reject` — Reject

### Kill Switch
- `GET /api/kill-switch` — Check status
- `POST /api/kill-switch/trigger` — Trigger stop
- `POST /api/kill-switch/resume` — Resume operations

### Audit
- `GET /api/audit-log` — Get audit trail
- `POST /api/audit-log/query` — Search logs

---

## WORKFLOW: EMAIL INBOUND → RESPONSE

```
1. Email arrives at sophia@amalfiai.com
   ↓
2. Polling cron detects it
   ↓
3. Creates record in EMAIL_QUEUE (status: pending)
   ↓
4. API calls /api/email/analyze
   ↓
5. Sophia analyzes:
   - Is this routine or escalation?
   - What's the response?
   - What's needed from Josh?
   ↓
6. Creates APPROVALS record (if needed)
   ↓
7. If routine → Dashboard shows "Pending Approval: Sophia drafted..."
   ↓
8. Josh clicks "Approve" in Mission Control
   ↓
9. API calls /api/email/send
   ↓
10. Response sent via gog gmail send
   ↓
11. AUDIT_LOG records the whole chain
   ↓
12. EMAIL_QUEUE status updated to "sent"
   ↓
13. Dashboard updates in real-time (Supabase realtime)
```

---

## KILL SWITCH MECHANISM

**File:** `/Users/henryburton/.openclaw/KILL_SWITCH`

**Before ANY operation:**
```
1. Check if /Users/henryburton/.openclaw/KILL_SWITCH exists
2. Read contents
3. If contains "STOP" → halt immediately, log to audit
4. If empty/missing → continue
5. If contains "RUNNING" → continue
```

**Manual activation:**
```
Josh clicks "Kill Switch" button in Mission Control
→ File is written with "STOP"
→ All operations halt
→ Audit log records: "Kill switch triggered by Josh at [time]"
→ Agents go offline
→ Nothing executes until Josh clicks "Resume"
```

---

## REALTIME UPDATES

**Using Supabase Realtime:**
- Mission Control subscribes to email_queue changes
- When Sophia updates analysis → Dashboard shows immediately
- When approval approved → Email sends automatically
- Audit log streams live to "Live Logs" tab

---

## MODIFICATIONS TO EXISTING CODE

### Pages to MODIFY:
- `Agents.tsx` — Show Sophia + Alex specific cards
- `Tasks.tsx` — Email queue + approvals UI
- `Index.tsx` — Real-time dashboard with new stats

### Pages to DELETE:
- `CalendarPage.tsx` (not needed)
- `Finances.tsx` (not needed)

### Pages to CREATE:
- `KillSwitch.tsx` — Kill switch control panel
- `AuditLog.tsx` — Audit trail viewer
- `EmailQueue.tsx` — Email queue detailed view

### Components to CREATE:
- `EmailCard.tsx` — Individual email with analysis + approval buttons
- `ApprovalPanel.tsx` — Josh's approval interface
- `AgentStatusCard.tsx` — Agent-specific status (Sophia, Alex)
- `KillSwitchButton.tsx` — Red emergency stop
- `RealtimeSubscriber.tsx` — Supabase realtime connection

---

## INTEGRATION POINTS

**This Mission Control connects to:**
1. **OpenClaw** — Crons trigger email analysis, email sending
2. **Supabase** — State, queue, approvals
3. **Gmail API** — Read emails, send responses
4. **Telegram** — Approval notifications + quick actions
5. **File system** — Kill switch file
6. **Mac terminal** — Execute commands via OpenClaw exec

---

## DEPLOYMENT FLOW

1. **Lovable publishes** → Website goes live
2. **Josh accesses** Mission Control at published URL
3. **Supabase** connects to database (realtime)
4. **OpenClaw** reads Supabase queue every 5 mins
5. **When email arrives:**
   - OpenClaw triggers analysis
   - Sophia drafts response in Supabase
   - Dashboard updates live
   - Josh approves in UI
   - OpenClaw sends via Gmail API
6. **Kill switch** accessible from both Mission Control UI and file

---

## BUILD ORDER

1. Create Supabase schema (tables)
2. Modify `Agents.tsx` for Sophia + Alex
3. Create `EmailQueue.tsx` + `ApprovalPanel.tsx`
4. Create `KillSwitch.tsx`
5. Create `AuditLog.tsx`
6. Build API endpoints (in Lovable or separate)
7. Wire Supabase realtime to dashboard
8. Integrate Telegram approvals
9. Test full flow: Email → Queue → Approval → Send

---

## THIS GIVES ME

✅ Full visibility (dashboard shows everything)  
✅ Real autonomy (I manage queue, execute approvals)  
✅ Emergency brake (kill switch always available)  
✅ Audit trail (every action logged)  
✅ Multiple approval paths (Mission Control UI or Telegram)  
✅ No Discord dependency (real command centre)  
✅ Scalable (add more agents, campaigns, tasks easily)
