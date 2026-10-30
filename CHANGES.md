# njia-smart cleanup

1. Unzip over the project root (same folder as package.json).
2. Run ./delete-obsolete.sh from that folder.
3. Build (vite build) before deploying.

## Overwritten files
src/components/app-shell.tsx                      sidebar groups
src/components/client-assignments.tsx             notifyUser
src/components/client-chat-panel.tsx              openStoredFile
src/components/completion-invoice-dialog.tsx      shared invoice shell
src/components/module-extra-tabs.tsx              file helpers
src/components/service-module.tsx                 thin page, same exports
src/components/tax-assignee-select.tsx            notifyUser
src/components/tax-assignees.tsx                  notifyUser
src/components/tax-filing-invoice-dialog.tsx      shared invoice shell
src/components/tax-obligations.tsx                openStoredFile
src/lib/format.ts                                 + formatKes()
src/routes/_authed/accounts.$id.tsx, accounts.tsx, advisory.tsx, audit.$id.tsx, calendar.tsx,
  chat.tsx, hr.$id.tsx, hr.tsx, tasks.tsx, tax.$type.tsx    notifyUser / file helpers only
src/routes/_authed/clients/index.tsx              session-refresh fix
src/routes/_authed/clients/$id.tsx                thin page
src/routes/_authed/ict-service-desk.tsx           thin page
src/routes/_authed/tax.tsx                        thin page

## New files
src/components/client-detail/*   src/components/ict-service-desk/*
src/components/service-module/*  src/components/tax/*
src/components/invoice-dialog-shell.tsx   src/components/modal-form.tsx
src/lib/notify.ts   src/lib/client-files.ts

## Deleted by delete-obsolete.sh
src/routes/_authed/calendar_v2.tsx, src/routes/_authed/clients/clients.index.tsx,
src/package.json, src/.npmrc
