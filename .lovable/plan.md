

# 🚀 OpenClaw Mission Control — MVP Dashboard

## Overview
A dark sci-fi / NASA-style mission control dashboard for monitoring and managing your OpenClaw agents (ClawdBot/MoltBot). Single-user, PWA-enabled, built on Lovable Cloud for backend storage.

---

## Phase 1: Core Dashboard & Layout

### Dark Sci-Fi Shell
- Dark theme with glowing accents (cyan/green terminal vibes), monospace fonts for data, and a NASA command center aesthetic
- Collapsible sidebar with navigation icons
- Top header bar showing system status, current time, and a global search
- PWA setup so it's installable on desktop and mobile

### Agent Monitoring Panel (Home)
- Card-based grid showing each agent (ClawdBot, MoltBot, etc.)
- Status indicators: online/offline/error with glowing badges
- Last activity timestamp and current task
- Quick-action buttons (restart, pause, view logs)
- Live activity feed / log stream at the bottom

---

## Phase 2: Task Management

### Task Board
- Kanban-style board with columns: To Do, In Progress, Done
- Create tasks with title, description, priority, and assignee (which agent or yourself)
- Due dates and reminders
- Filter and search tasks

---

## Phase 3: Finance Tracking

### Finance Overview
- Summary cards: total income, expenses, balance
- Transaction list with category tags
- Simple charts showing spending trends over time
- Add/edit transactions manually

---

## Phase 4: Calendar & Reminders

### Calendar View
- Monthly/weekly calendar view
- Events tied to tasks and reminders
- Quick-add events from any page
- Reminder notifications via toast/alerts

---

## Backend (Lovable Cloud)

- **Database tables**: agents, tasks, transactions, calendar_events, reminders
- **Edge functions**: for Telegram bot webhook integration and external API calls
- **Secrets management**: store Telegram Bot API key, OpenAI key, and other service keys securely
- **Auth**: simple single-user auth to protect the dashboard

---

## External Service Integration
- API keys (Telegram, OpenAI, etc.) stored securely via Lovable Cloud secrets
- Edge function to receive Telegram webhook messages and relay to the dashboard
- Expandable to more integrations over time

