-- Repairs schema drift on the shared service-module tables (ICT, Outsourced
-- Accounting, Payroll Management, Financial & Business Management).
--
-- The tables were first created by an earlier attempt, and CREATE TABLE IF NOT
-- EXISTS never adds columns that were missing then. The module page reads all
-- of the columns below, so a missing one made its project list fail while the
-- ICT dashboard cards (which read fewer columns) still counted the projects.
-- Every statement is idempotent: columns that already exist are left alone.

ALTER TABLE public.service_projects
  ADD COLUMN IF NOT EXISTS service_type  text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS stage         text NOT NULL DEFAULT 'onboarding',
  ADD COLUMN IF NOT EXISTS closure_notes text,
  ADD COLUMN IF NOT EXISTS closed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invoice_id    uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.service_milestones
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS assigned_to  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS stage        text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at  timestamptz;

-- Make PostgREST pick up the columns straight away.
NOTIFY pgrst, 'reload schema';
