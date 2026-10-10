-- Card #51: to reject a score (and to stop the submitter from also being the
-- one who accepts/rejects it), the API needs to know who submitted it —
-- there was no column tracking that before.
alter table public.matches add column score_submitted_by uuid references users(id);