
alter table public.users add column onboarding_completed_at timestamptz;

-- Backfill existing rows so no current account sees the onboarding flow.
update public.users set onboarding_completed_at = now() where onboarding_completed_at is null;
