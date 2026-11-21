alter table public.user_preferences
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists legacy_imported_at timestamptz;
