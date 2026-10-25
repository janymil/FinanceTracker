# Archived migrations (2025)

These files predate the baseline in `migrations/`. They are kept for archaeology only.

- `0000_fixed_thena.sql` — the original six-table schema (integer user ids, `password`
  column). It was in the journal, so it *was* applied once, to the first database.
- `0001_add_ocr_fields.sql`, `0002_add_billing_interval.sql` — were **never** in
  `meta/_journal.json`, so the migrator never ran them. Their changes reached the databases by
  hand or through `db:push`.

Nothing here should be applied. A fresh database starts from
`migrations/0000_baseline_2026_10.sql`, and production was stamped as already being at that
point (see the README one level up).
