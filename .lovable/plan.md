
# Plan: Interactive Tax, Audit/Advisory, Calendar & Dashboard

## 1. Tax Section — clickable tiles with full detail

- Wrap each tax category tile on `/tax` in a `<Link>` to a new route `/tax/$type` (paye, vat, income, etc.).
- New route `src/routes/_authed/tax.$type.tsx` shows:
  - All `tax_returns` filtered by `return_type`
  - Per row: client, assigned staff (from `tax_returns.assigned_to` + `client_assignments`), status, period, due date, notes, uploaded docs (from `documents` joined by `client_id`)
  - Inline edit dialog: status, assignee, due date, period, notes, payment amount/status
  - Add comment/note thread (new `tax_comments` table)
  - Filter bar: client, assignee, status, due-date range
- Index `/tax` keeps the global table but tiles become drill-downs.

## 2. Audit & Advisory — workflow-driven

- Add `workflow_stage` to `engagements` and `advisory_projects` (Planning, Field Work, Review, Partner Approval, Finalization, Client Delivery).
- Extend existing `/audit/$id` with:
  - Stage stepper (click to advance, logged to `activity_log`)
  - Subtasks list (reuse `tasks` table via `engagement_id`) — add/assign/complete
  - Review notes already present; add "approved by / approval_status"
  - Edit dialog for engagement metadata, add/remove client
- New `src/routes/_authed/advisory.$id.tsx` mirroring audit detail: milestones, tasks, docs, comments, assigned staff, stage stepper.
- Make `/advisory` rows clickable to the detail route.

## 3. Calendar — fully interactive

- New table `calendar_events` (title, type, date, time, recurrence, client_id, engagement_id, assigned_to, color, notes).
- Click empty day → "Add event" dialog (task / reminder / deadline / meeting / compliance) with recurrence + client/project link + assignee.
- Click existing event chip → edit/delete dialog.
- Color-code by type: deadline=red, meeting=blue, compliance=amber, internal=green, task=primary.
- Remove anniversaries entirely from calendar and any dashboard widget referencing them.
- On create/assign, insert a `notifications` row for the assignee (notification bell already wired).

## 4. Dashboard — every card clickable

Wrap each metric/widget on `/dashboard` in `<Link>` to its filtered destination:
- Pending Tax Returns → `/tax?status=pending`
- Upcoming Deadlines → `/calendar`
- Active Audits → `/audit?status=in_progress`
- Outstanding Tasks → `/tasks?status=todo`
- Clients widget → `/clients`
- Announcements → `/announcements`

Add `search`-param filter support on Tax/Audit/Tasks index pages so the deep links land pre-filtered.

## Technical changes

**Migrations**
- `ALTER TABLE engagements ADD COLUMN workflow_stage TEXT NOT NULL DEFAULT 'planning'`
- `ALTER TABLE advisory_projects ADD COLUMN workflow_stage TEXT NOT NULL DEFAULT 'planning'`
- `ALTER TABLE tax_returns ADD COLUMN payment_amount NUMERIC, ADD COLUMN payment_status TEXT`
- New `tax_comments` table (RLS: staff)
- New `calendar_events` table (RLS: staff read, admin manage)

**New files**
- `src/routes/_authed/tax.$type.tsx`
- `src/routes/_authed/advisory.$id.tsx`
- `src/components/event-dialog.tsx`
- `src/components/workflow-stage-stepper.tsx`
- `src/components/comment-thread.tsx` (generalized)

**Edited files**
- `src/routes/_authed/tax.tsx` — clickable tiles + filter search-params
- `src/routes/_authed/audit.$id.tsx` — stepper + subtasks + edit
- `src/routes/_authed/audit.tsx` — search-param filters
- `src/routes/_authed/advisory.tsx` — clickable rows
- `src/routes/_authed/calendar.tsx` — interactive cells, remove anniversaries
- `src/routes/_authed/tasks.tsx` — search-param filters
- `src/routes/_authed/dashboard.tsx` — wrap widgets in Links, remove anniversaries

## Suggested build order
1. Migrations
2. Calendar interactivity + anniversaries removal
3. Tax tile detail + filters + edit
4. Audit workflow stepper + subtasks; advisory detail mirror
5. Dashboard clickable drill-downs

Scope is large — confirm to proceed and I'll ship in this order.
