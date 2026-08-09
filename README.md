# Recipe Vault — Database Workflow

Free-plan workflow. No paid Supabase branches. Local Docker is the development
environment; the hosted Supabase project is production.

> **Web app:** the Next.js frontend and its Vercel deployment are documented in
> [`docs/web.md`](docs/web.md). This file covers the database only.

## Environments

| Environment | What it is | How schema arrives |
|---|---|---|
| Local | `supabase start` (Docker), Postgres 17 | `supabase db reset` replays every migration from scratch |
| Production | Supabase project `recipe--vault` (ref `drjshqggefvxthxgyhte`, us-east-2, Postgres 17.6) | `supabase db push`, only after explicit approval |

There is no staging environment. The local reset is the gate.

## Rules

1. Every schema change is a file in `supabase/migrations/`. No exceptions.
2. No loose SQL. Nothing is typed into the SQL Editor, psql, or a tool call
   against production that is not first a committed migration file.
3. Migrations are immutable once pushed to production. A mistake is corrected by
   a new forward migration, never by editing an applied one.
4. Every migration is validated locally (`supabase db reset` from zero) before it
   goes near production.
5. Nothing is applied to production without explicit approval.
6. Migration files and config are committed to GitHub before the remote push.

## Naming

CLI-generated timestamps, prefixed with the logical migration number:

```
supabase/migrations/<UTC timestamp>_001_<description>.sql
```

Generate with `supabase migration new 001_<description>`, then rename if needed.
The logical number is what we refer to in conversation ("Migration 001"); the
timestamp is what orders execution.

## Local loop

```bash
supabase start                      # boot the local stack (Docker)
supabase migration new 001_initial_schema
# edit the generated file
supabase db reset                   # replay ALL migrations from empty + seed.sql
supabase db diff                    # must report no drift
supabase stop
```

`db reset` is the real test: it proves the migration chain builds a correct
database from nothing, which is exactly what production will do.

## Promotion to production

Only after approval:

```bash
supabase link --project-ref drjshqggefvxthxgyhte
supabase db push --dry-run          # show what would run
supabase db push                    # apply
supabase migration list             # local vs remote must match
```

`--dry-run` output gets reviewed before the real push, every time.

## Reference data and defaults

Per-user reference data — ordered stores, standard tags, equipment and
collections — is created by `public.bootstrap_user_defaults(uuid)`, which the
`auth.users` insert trigger calls alongside profile creation.

The standard Recipe Vault categories are tags with `tag_type = 'course'`. There
is no separate categories table. The fifteen are: Appetizers, Beef & Burgers,
Chicken, Pork, Seafood, Pasta, Soups & Stews, Sides & Salads, Sauces &
Dressings, Breakfast, Desserts, Cocktails, Grilling & Blackstone, Cabin Meals,
Other.

The default collections are: Favorites, Need To Try, Colorado Cabin, Beach
House, Holiday, Date Night, Football, Cocktails.

This runs on **production**, not just locally. It is idempotent: every insert is
`ON CONFLICT DO NOTHING` against a natural key, so re-running changes nothing
and never overwrites a user's own edits. Rows it creates are marked
`is_default = true` so seeded taxonomy stays distinguishable from user-created
taxonomy.

To change the defaults, write a forward migration that replaces the function.
Do not edit an applied migration.

## Application responsibilities

Two things the database deliberately does not maintain for you:

**`recipes.photo_status`** is an explicit workflow field, not a derived one.
The application must update it whenever the hero image changes — on upload,
crop, generated cover, or removal. Nothing keeps it in step with
`recipe_images`. V1 accepts this in exchange for not building derivation logic;
revisit if the field starts drifting in practice.

**Store reordering.** `stores` carries a unique constraint on
`(user_id, sort_order)` so the preferred order is deterministic. It is
`DEFERRABLE INITIALLY IMMEDIATE`, so a reorder that swaps positions must run
inside a transaction that defers it:

```sql
begin;
set constraints all deferred;
-- renumber freely; uniqueness is checked at commit
commit;
```

## Status model

Three independent axes on `recipes`, deliberately not collapsed into one field:

- `recipe_status` — content state: `original_complete`, `cleaned_up`,
  `reconstructed_from_photo`, `needs_review`, `tested`
- `is_favorite` / `do_not_make_again` — user signals, booleans
- `confidence` — trust: `verified`, `reconstructed`, `needs_test`
- `lifecycle_status` — ingestion pipeline state, separate from all of the above

A recipe can be `tested` *and* a favorite. That is why favorites and
do-not-make-again are not `recipe_status` values.

## Import pipeline

`imports.status` moves through: `uploaded` → `analyzing` → `extracted` →
`reconstructed` → `duplicate_check` → `needs_review` → `completed`, with
`failed` and `discarded` as terminal exits.

**Duplicate detection never acts on its own.** `duplicate_of_recipe_id` records
a *candidate* with a `duplicate_score` (0–1) and the raw `duplicate_signals`
that produced it. A non-null candidate with a null `duplicate_resolution` means
the import is waiting on the user, who chooses `merged`, `kept_both`, or
`cancelled`. Nothing is merged or overwritten before that choice.

## Source vs AI-generated content

`recipes.field_provenance` is a JSON map of field name to origin:
`extracted`, `reconstructed`, `estimated`, or `user_entered`. The app writes it
during import and must keep it truthful — it is what lets the UI show which
parts of a recipe came from the source and which the model invented.

`recipes.ai_review_flags` is a JSON array of `{field, reason}` objects the model
wants a human to check. There is a partial GIN index on non-empty values, so
"what needs review" is a cheap query.

## Maintained automatically

`recipes.times_cooked` and `recipes.last_cooked_at` are kept in step with
`cook_log` by trigger, including on delete. Do not write them from the
application.

## Importing legacy recipe numbers

`recipes.recipe_number` has no column default. A `BEFORE INSERT` trigger decides:

- omitted → next value from `recipe_number_seq`
- supplied → honoured exactly, and the sequence is advanced past it

So importing RV-0001 through RV-0037 with explicit numbers leaves the sequence
at 37 and the next generated recipe is RV-0038. The trigger also blocks any
later change to `recipe_number`, which is what makes the RV code permanent
rather than merely unique.

After a bulk load that bypasses the trigger (a `COPY` run as `service_role`),
call `select public.sync_recipe_number_seq();` to re-align the sequence.

## Seed data

`supabase/seed.sql` runs after migrations on `db reset`. Local only. It never
contains DDL and is never pushed to production. It exists for throwaway
development fixtures — anything that must exist in production belongs in
`bootstrap_user_defaults()` instead.

## Fallback validation harness

`scripts/validate-migrations.sh` replays every migration against a plain
PostgreSQL server for environments without Docker. It stands up shim `auth` and
`storage` schemas so migrations referencing `auth.users`, `auth.uid()` and
`storage.objects` will parse and run, and its `auth.uid()` reads
`request.jwt.claim.sub` so RLS can actually be exercised.

It is **not** equivalent to `supabase db reset`. It does not run the real
Supabase image, the real auth schema, or necessarily the same Postgres minor
version. Treat a pass as "the SQL is correct," not "the migration is verified."
