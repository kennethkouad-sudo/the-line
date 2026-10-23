-- One-off: until this release, an upload that failed while saving still counted towards
-- the day's 3 notes (first staging test, 23 October). Rate-limit rows hold no notes and
-- expire within 24 hours anyway, so clearing them is harmless.
DELETE FROM rate_limits;
