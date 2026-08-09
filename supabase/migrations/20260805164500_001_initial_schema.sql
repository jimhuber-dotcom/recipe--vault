-- =============================================================================
-- Recipe Vault — Migration 001: Initial Schema  (revision 4)
-- =============================================================================
-- Version 1 scope: profiles, recipes and their child records, cocktail details,
-- taxonomy (tags / collections / equipment), shopping stores, cooking history,
-- meal planning, grocery lists, and the import / AI extraction pipeline.
--
-- Conventions used throughout:
--   * UUID primary keys, generated with gen_random_uuid() (core, PG13+).
--   * auth.users is the sole identity source. Every user-owned row carries
--     user_id referencing auth.users(id) ON DELETE CASCADE.
--   * Child tables are bound to their parent by a COMPOSITE foreign key that
--     includes user_id, e.g. (recipe_id, user_id) -> recipes(id, user_id). This
--     makes it structurally impossible for a child row's owner to drift from
--     its parent's owner, and lets every RLS policy be a simple indexed
--     equality check rather than a subquery.
--   * created_at / updated_at on every table; updated_at maintained by trigger.
--   * Soft delete on recipes only (deleted_at). Everything else hard-deletes.
--   * Status/type columns use CHECK constraints rather than ENUM types so the
--     allowed values can be changed by a forward migration without a type
--     rewrite.
--   * Per-user default data (stores, tags, equipment, collections) is created
--     idempotently by bootstrap_user_defaults(), invoked on profile creation.
--     It is production-safe and does not depend on supabase/seed.sql.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Helper functions
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: stamps updated_at = now() on UPDATE.';


-- =============================================================================
-- SECTION 2 — Permanent recipe number (RV-0001) and import-safe assignment
-- =============================================================================
-- recipe_number is drawn from a sequence that is never reset and never reused,
-- so the derived recipe_code is permanent for the life of the row. recipe_code
-- is a STORED generated column: it cannot be edited by application code or by
-- accident, only recomputed from recipe_number.
--
-- IMPORT SAFETY. Historical records RV-0001..RV-0037 already exist and must
-- keep their numbers. recipe_number therefore has NO column default. A BEFORE
-- INSERT trigger decides:
--
--   recipe_number omitted (NULL) -> draw the next value from the sequence
--   recipe_number supplied       -> honour it exactly, then advance the
--                                   sequence to at least that value
--
-- Importing RV-0001..RV-0037 with explicit numbers therefore leaves the
-- sequence at 37, and the next generated recipe is RV-0038. The trigger also
-- rejects any attempt to change recipe_number after insert, which is what makes
-- the identifier permanent rather than merely unique.
--
-- The sequence is global rather than per-user: this is a personal application
-- with one primary account, and a global sequence guarantees an RV number is
-- never issued twice under any circumstance.

create sequence public.recipe_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no cycle;

comment on sequence public.recipe_number_seq is
  'Source of the permanent RV-#### recipe number. Never reset, never reused.';

create or replace function public.assign_recipe_number()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_last bigint;
begin
  if (tg_op = 'UPDATE') then
    if new.recipe_number is distinct from old.recipe_number then
      raise exception
        'recipe_number is permanent and cannot be changed (RV-% -> RV-%)',
        old.recipe_number, new.recipe_number
        using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if new.recipe_number is null then
    new.recipe_number := nextval('public.recipe_number_seq');
  else
    if new.recipe_number < 1 then
      raise exception 'recipe_number must be >= 1, got %', new.recipe_number
        using errcode = 'check_violation';
    end if;
    -- Honour the supplied number, then make sure the sequence can never hand
    -- it out again. pg_sequence_last_value() is NULL until the sequence has
    -- been used at least once.
    v_last := coalesce(
      pg_sequence_last_value('public.recipe_number_seq'::regclass), 0);
    if new.recipe_number > v_last then
      perform setval('public.recipe_number_seq', new.recipe_number, true);
    end if;
  end if;

  return new;
end;
$$;

comment on function public.assign_recipe_number() is
  'Assigns recipe_number on insert, preserving explicitly supplied numbers and '
  'advancing recipe_number_seq past them. Blocks any later change.';

-- Repair / verification helper for bulk loads that bypass the trigger (for
-- example a COPY performed by service_role). Safe to run at any time.
create or replace function public.sync_recipe_number_seq()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max bigint;
begin
  select coalesce(max(recipe_number), 0) into v_max from public.recipes;
  if v_max > 0 then
    perform setval('public.recipe_number_seq', v_max, true);
  end if;
  return v_max;
end;
$$;

revoke all on function public.sync_recipe_number_seq() from public, anon, authenticated;
grant execute on function public.sync_recipe_number_seq() to service_role;

comment on function public.sync_recipe_number_seq() is
  'Advances recipe_number_seq to max(recipes.recipe_number). service_role only.';


-- =============================================================================
-- SECTION 3 — profiles
-- =============================================================================

create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text
                          check (display_name is null
                                 or length(btrim(display_name)) between 1 and 100),
  avatar_path           text,
  default_servings      integer not null default 4
                          check (default_servings between 1 and 100),
  measurement_system    text not null default 'imperial'
                          check (measurement_system in ('imperial', 'metric')),
  time_zone             text not null default 'America/New_York',
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Created automatically by the auth.users trigger.';


-- =============================================================================
-- SECTION 4 — sources
-- =============================================================================

create table public.sources (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  source_type      text not null
                     check (source_type in ('website', 'cookbook', 'instagram',
                                            'pinterest', 'facebook', 'family',
                                            'restaurant', 'handwritten',
                                            'screenshot', 'video', 'other')),
  name             text not null
                     check (length(btrim(name)) between 1 and 200),
  url              text
                     check (url is null or length(url) <= 2048),
  author           text,
  publication      text,
  page_reference   text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id)
);

create unique index sources_user_name_url_key
  on public.sources (user_id, lower(btrim(name)), coalesce(url, ''));

create index sources_user_id_idx on public.sources (user_id);
create index sources_source_type_idx on public.sources (user_id, source_type);

comment on table public.sources is
  'Provenance records. A recipe may reference at most one source, and only one '
  'belonging to the same user (enforced by composite FK).';


-- =============================================================================
-- SECTION 5 — shopping stores (ordered)
-- =============================================================================
-- Ordered shopping preference. sort_order is the shopping priority: lower runs
-- first. Not declared unique, so reordering does not require a deferred
-- constraint dance; ties break on name.

create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 120),
  sort_order  integer not null default 0 check (sort_order >= 0),
  is_active   boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  -- Deterministic ordering: no two of a user's stores may share a position.
  -- DEFERRABLE so a reorder can swap positions inside one transaction —
  -- issue SET CONSTRAINTS ALL DEFERRED first, then renumber.
  constraint stores_user_sort_order_key unique (user_id, sort_order)
    deferrable initially immediate
);

create unique index stores_user_name_key
  on public.stores (user_id, lower(btrim(name)));
create index stores_user_order_idx
  on public.stores (user_id, sort_order) where is_active;

comment on table public.stores is
  'Per-user ordered list of grocery stores. sort_order ascending = shop first.';


-- =============================================================================
-- SECTION 6 — recipes
-- =============================================================================

create table public.recipes (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,

  -- Permanent identity. No default: assigned by trigger (see Section 2).
  recipe_number            bigint not null,
  recipe_code              text generated always as
                             ('RV-' || lpad(recipe_number::text, 4, '0')) stored,

  -- Core content
  title                    text not null
                             check (length(btrim(title)) between 1 and 300),
  subtitle                 text
                             check (subtitle is null or length(subtitle) <= 300),
  description              text
                             check (description is null or length(description) <= 5000),
  cuisine                  text check (cuisine is null or length(cuisine) <= 100),
  cooking_method           text check (cooking_method is null or length(cooking_method) <= 100),
  course                   text check (course is null or length(course) <= 100),
  main_type                text check (main_type is null or length(main_type) <= 60),
  main_protein             text check (main_protein is null or length(main_protein) <= 60),
  yield_text               text,
  notes                    text,
  preferred_version_notes  text,

  -- Timing and effort
  servings                 integer check (servings is null or servings between 1 and 1000),
  prep_minutes             integer check (prep_minutes is null or prep_minutes between 0 and 100000),
  cook_minutes             integer check (cook_minutes is null or cook_minutes between 0 and 100000),
  total_minutes            integer generated always as
                             (coalesce(prep_minutes, 0) + coalesce(cook_minutes, 0)) stored,
  difficulty               text check (difficulty is null
                                       or difficulty in ('easy', 'medium', 'hard')),

  -- Curation state of the recipe content itself. Deliberately excludes
  -- 'favorite' and 'do_not_make_again': those are independent user signals and
  -- live in their own boolean columns, so a recipe can be (for example) both
  -- 'tested' and a favorite without the two states conflicting.
  recipe_status            text not null default 'needs_review'
                             check (recipe_status in ('original_complete',
                                                      'cleaned_up',
                                                      'reconstructed_from_photo',
                                                      'needs_review',
                                                      'tested')),

  -- State of the recipe's imagery. EXPLICIT WORKFLOW FIELD, not derived: the
  -- application is responsible for updating this whenever the hero image
  -- changes (upload, crop, generated cover, or removal). Nothing in the
  -- database keeps it in step with recipe_images.
  photo_status             text not null default 'no_image_yet'
                             check (photo_status in ('original_photo',
                                                     'cropped_from_screenshot',
                                                     'generated_cover_image',
                                                     'generate_cover_image_needed',
                                                     'no_image_yet')),

  -- How much the content is trusted
  confidence               text not null default 'needs_test'
                             check (confidence in ('verified',
                                                   'reconstructed',
                                                   'needs_test')),

  -- Pipeline state, distinct from recipe_status: this tracks whether the row
  -- has finished being ingested, not how good the recipe is.
  lifecycle_status         text not null default 'complete'
                             check (lifecycle_status in ('draft', 'processing',
                                                         'needs_review',
                                                         'complete', 'archived')),

  -- Provenance
  source_id                uuid,

  -- User signals, independent of recipe_status
  is_favorite              boolean not null default false,
  do_not_make_again        boolean not null default false,
  rating                   smallint check (rating is null or rating between 1 and 5),

  -- Cook tracking. Maintained by trigger from cook_log (Section 15) so the
  -- dashboard can sort and filter without aggregating on every read.
  times_cooked             integer not null default 0 check (times_cooked >= 0),
  last_cooked_at           timestamptz,

  -- Per-field provenance: which fields were extracted from the source, which
  -- the AI reconstructed, which it estimated, and which the user typed.
  -- Shape: {"title": "extracted", "servings": "estimated", ...}
  -- Values: extracted | reconstructed | estimated | user_entered
  field_provenance         jsonb not null default '{}'::jsonb,

  -- Fields the AI flagged as uncertain and wants a human to look at.
  -- Shape: [{"field": "cook_minutes", "reason": "not stated in source"}]
  ai_review_flags          jsonb not null default '[]'::jsonb,

  -- Full-text search, maintained by trigger (see Section 18)
  search_vector            tsvector,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,

  constraint recipes_deleted_after_created
    check (deleted_at is null or deleted_at >= created_at),
  unique (recipe_number),
  unique (recipe_code),
  -- Target for the composite foreign keys used by every child table.
  unique (id, user_id),
  -- A recipe may only cite a source belonging to the same user. Column-scoped
  -- SET NULL (PG15+) clears source_id alone and leaves user_id intact.
  constraint recipes_source_id_user_id_fkey
    foreign key (source_id, user_id)
    references public.sources (id, user_id)
    on delete set null (source_id) on update cascade
);

create trigger recipes_assign_recipe_number
  before insert or update on public.recipes
  for each row execute function public.assign_recipe_number();

create index recipes_user_id_idx on public.recipes (user_id);
create index recipes_user_active_idx
  on public.recipes (user_id, created_at desc) where deleted_at is null;
create index recipes_user_favorite_idx
  on public.recipes (user_id) where is_favorite and deleted_at is null;
create index recipes_user_do_not_make_again_idx
  on public.recipes (user_id) where do_not_make_again and deleted_at is null;
create index recipes_user_last_cooked_idx
  on public.recipes (user_id, last_cooked_at desc nulls last)
  where deleted_at is null;
create index recipes_ai_review_flags_idx
  on public.recipes using gin (ai_review_flags)
  where ai_review_flags <> '[]'::jsonb;
create index recipes_user_recipe_status_idx on public.recipes (user_id, recipe_status);
create index recipes_user_photo_status_idx on public.recipes (user_id, photo_status);
create index recipes_user_confidence_idx on public.recipes (user_id, confidence);
create index recipes_user_lifecycle_idx on public.recipes (user_id, lifecycle_status);
create index recipes_user_main_type_idx on public.recipes (user_id, main_type);
create index recipes_user_main_protein_idx on public.recipes (user_id, main_protein);
create index recipes_source_id_idx on public.recipes (source_id);
create index recipes_deleted_at_idx on public.recipes (deleted_at)
  where deleted_at is not null;
create index recipes_search_vector_idx on public.recipes using gin (search_vector);

comment on table public.recipes is
  'Master recipe record. Single source of truth. Soft-deleted via deleted_at.';
comment on column public.recipes.recipe_code is
  'Permanent human-readable identifier, e.g. RV-0001. Generated, never editable.';
comment on column public.recipes.recipe_status is
  'Curation state of the recipe content. Favorites and do-not-make-again are '
  'separate booleans so they cannot conflict with a content state.';
comment on column public.recipes.photo_status is
  'Explicit imagery workflow state for V1. NOT derived: the application must '
  'update this whenever the hero image changes.';
comment on column public.recipes.do_not_make_again is
  'User signal, independent of recipe_status and rating.';
comment on column public.recipes.lifecycle_status is
  'Ingestion pipeline state, independent of recipe_status.';
comment on column public.recipes.preferred_version_notes is
  'Free-form notes on which variation of this recipe is the preferred one.';


-- =============================================================================
-- SECTION 7 — cocktail_details
-- =============================================================================
-- One-to-one extension of recipes for drinks. Absent for food recipes.

create table public.cocktail_details (
  id                   uuid primary key default gen_random_uuid(),
  recipe_id            uuid not null,
  user_id              uuid not null references auth.users(id) on delete cascade,
  glassware            text,
  ice                  text,
  technique            text,
  garnish              text,
  abv_percent          numeric(5, 2)
                         check (abv_percent is null
                                or (abv_percent >= 0 and abv_percent <= 100)),
  flavor_profile       text,
  history              text,
  recommended_spirits  text[],
  variations           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (recipe_id),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade
);

create index cocktail_details_user_id_idx on public.cocktail_details (user_id);

comment on table public.cocktail_details is
  'One-to-one cocktail extension of a recipe: service, technique and lore.';


-- =============================================================================
-- SECTION 8 — recipe_ingredients
-- =============================================================================

create table public.recipe_ingredients (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  position       integer not null check (position >= 0),
  section        text,
  quantity       numeric(12, 4) check (quantity is null or quantity >= 0),
  unit           text,
  item           text not null check (length(btrim(item)) between 1 and 300),
  preparation    text,
  raw_text       text,
  is_optional    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (recipe_id, position),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade
);

create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_user_id_idx on public.recipe_ingredients (user_id);

comment on column public.recipe_ingredients.raw_text is
  'The ingredient line exactly as captured, retained even after parsing.';


-- =============================================================================
-- SECTION 9 — recipe_steps
-- =============================================================================

create table public.recipe_steps (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null,
  user_id           uuid not null references auth.users(id) on delete cascade,
  step_number       integer not null check (step_number > 0),
  section           text,
  instruction       text not null check (length(btrim(instruction)) >= 1),
  duration_minutes  integer check (duration_minutes is null or duration_minutes >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (recipe_id, step_number),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade
);

create index recipe_steps_recipe_id_idx on public.recipe_steps (recipe_id);
create index recipe_steps_user_id_idx on public.recipe_steps (user_id);


-- =============================================================================
-- SECTION 10 — recipe_images
-- =============================================================================

create table public.recipe_images (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  bucket_id      text not null default 'recipe-images',
  storage_path   text not null check (length(btrim(storage_path)) >= 1),
  is_primary     boolean not null default false,
  position       integer not null default 0 check (position >= 0),
  caption        text,
  content_type   text,
  byte_size      bigint check (byte_size is null or byte_size >= 0),
  width_px       integer check (width_px is null or width_px > 0),
  height_px      integer check (height_px is null or height_px > 0),
  image_origin   text check (image_origin is null
                             or image_origin in ('original_photo',
                                                 'cropped_from_screenshot',
                                                 'generated_cover_image',
                                                 'imported')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (bucket_id, storage_path),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade
);

create unique index recipe_images_one_primary_idx
  on public.recipe_images (recipe_id) where is_primary;

create index recipe_images_recipe_id_idx on public.recipe_images (recipe_id);
create index recipe_images_user_id_idx on public.recipe_images (user_id);


-- =============================================================================
-- SECTION 11 — nutrition
-- =============================================================================

create table public.nutrition (
  id                 uuid primary key default gen_random_uuid(),
  recipe_id          uuid not null,
  user_id            uuid not null references auth.users(id) on delete cascade,
  basis              text not null default 'per_serving'
                       check (basis in ('per_serving', 'per_recipe', 'per_100g')),
  calories           numeric(10, 2) check (calories is null or calories >= 0),
  protein_g          numeric(10, 2) check (protein_g is null or protein_g >= 0),
  carbohydrates_g    numeric(10, 2) check (carbohydrates_g is null or carbohydrates_g >= 0),
  fat_g              numeric(10, 2) check (fat_g is null or fat_g >= 0),
  saturated_fat_g    numeric(10, 2) check (saturated_fat_g is null or saturated_fat_g >= 0),
  fiber_g            numeric(10, 2) check (fiber_g is null or fiber_g >= 0),
  sugar_g            numeric(10, 2) check (sugar_g is null or sugar_g >= 0),
  sodium_mg          numeric(10, 2) check (sodium_mg is null or sodium_mg >= 0),
  cholesterol_mg     numeric(10, 2) check (cholesterol_mg is null or cholesterol_mg >= 0),
  data_source        text not null default 'manual'
                       check (data_source in ('manual', 'ai_estimated', 'imported')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (recipe_id),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade
);

create index nutrition_user_id_idx on public.nutrition (user_id);


-- =============================================================================
-- SECTION 12 — tags and recipe_tags
-- =============================================================================

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tag_type    text not null default 'custom'
                check (tag_type in ('cuisine', 'diet', 'course', 'occasion',
                                    'method', 'ingredient', 'season', 'custom')),
  color       text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slug),
  unique (id, user_id)
);

create index tags_user_id_idx on public.tags (user_id);
create index tags_user_type_idx on public.tags (user_id, tag_type);

comment on column public.tags.is_default is
  'True for rows created by bootstrap_user_defaults(), so seeded taxonomy can '
  'be distinguished from tags the user made.';

create table public.recipe_tags (
  recipe_id   uuid not null,
  tag_id      uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (recipe_id, tag_id),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade,
  foreign key (tag_id, user_id)
    references public.tags (id, user_id) on delete cascade on update cascade
);

create index recipe_tags_tag_id_idx on public.recipe_tags (tag_id);
create index recipe_tags_user_id_idx on public.recipe_tags (user_id);


-- =============================================================================
-- SECTION 13 — collections and recipe_collections
-- =============================================================================

create table public.collections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null check (length(btrim(name)) between 1 and 150),
  slug              text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description       text,
  cover_image_path  text,
  is_pinned         boolean not null default false,
  is_default        boolean not null default false,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, slug),
  unique (id, user_id)
);

create index collections_user_id_idx on public.collections (user_id);

create table public.recipe_collections (
  collection_id  uuid not null,
  recipe_id      uuid not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  position       integer not null default 0 check (position >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (collection_id, recipe_id),
  foreign key (collection_id, user_id)
    references public.collections (id, user_id) on delete cascade on update cascade,
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade
);

create index recipe_collections_recipe_id_idx on public.recipe_collections (recipe_id);
create index recipe_collections_user_id_idx on public.recipe_collections (user_id);


-- =============================================================================
-- SECTION 14 — equipment and recipe_equipment
-- =============================================================================

create table public.equipment (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 120),
  category    text,
  is_owned    boolean not null default true,
  is_default  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

create unique index equipment_user_name_key
  on public.equipment (user_id, lower(btrim(name)));
create index equipment_user_id_idx on public.equipment (user_id);

create table public.recipe_equipment (
  recipe_id     uuid not null,
  equipment_id  uuid not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  is_required   boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (recipe_id, equipment_id),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade,
  foreign key (equipment_id, user_id)
    references public.equipment (id, user_id) on delete cascade on update cascade
);

create index recipe_equipment_equipment_id_idx on public.recipe_equipment (equipment_id);
create index recipe_equipment_user_id_idx on public.recipe_equipment (user_id);


-- =============================================================================
-- SECTION 15 — cook_log
-- =============================================================================

create table public.cook_log (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null,
  user_id           uuid not null references auth.users(id) on delete cascade,
  cooked_at         timestamptz not null default now(),
  servings_made     integer check (servings_made is null or servings_made > 0),
  rating            smallint check (rating is null or rating between 1 and 5),
  would_make_again  boolean,
  modifications     text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade
);

create index cook_log_recipe_id_idx on public.cook_log (recipe_id);
create index cook_log_user_cooked_at_idx on public.cook_log (user_id, cooked_at desc);

comment on table public.cook_log is
  'History of times a recipe was actually cooked, with outcome notes.';

-- Keep recipes.times_cooked / last_cooked_at in step with cook_log, so the
-- application never has to remember to update them.
create or replace function public.refresh_recipe_cook_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipe_id uuid := coalesce(new.recipe_id, old.recipe_id);
begin
  update public.recipes r
     set times_cooked   = (select count(*) from public.cook_log c
                            where c.recipe_id = v_recipe_id),
         last_cooked_at = (select max(c.cooked_at) from public.cook_log c
                            where c.recipe_id = v_recipe_id)
   where r.id = v_recipe_id;

  if (tg_op = 'UPDATE' and old.recipe_id is distinct from new.recipe_id) then
    update public.recipes r
       set times_cooked   = (select count(*) from public.cook_log c
                              where c.recipe_id = old.recipe_id),
           last_cooked_at = (select max(c.cooked_at) from public.cook_log c
                              where c.recipe_id = old.recipe_id)
     where r.id = old.recipe_id;
  end if;

  return null;
end;
$$;

create trigger cook_log_refresh_stats_aiud
  after insert or update or delete on public.cook_log
  for each row execute function public.refresh_recipe_cook_stats();


-- =============================================================================
-- SECTION 16 — meal_plans, grocery_lists and their children
-- =============================================================================

create table public.meal_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 150),
  start_date  date not null,
  end_date    date not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint meal_plans_date_order check (end_date >= start_date),
  unique (id, user_id)
);

create index meal_plans_user_id_idx on public.meal_plans (user_id);
create index meal_plans_user_range_idx on public.meal_plans (user_id, start_date, end_date);

create table public.meal_plan_recipes (
  id            uuid primary key default gen_random_uuid(),
  meal_plan_id  uuid not null,
  recipe_id     uuid not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  planned_date  date not null,
  meal_slot     text not null default 'dinner'
                  check (meal_slot in ('breakfast', 'lunch', 'dinner',
                                       'snack', 'dessert', 'other')),
  servings      integer check (servings is null or servings > 0),
  position      integer not null default 0 check (position >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (meal_plan_id, planned_date, meal_slot, recipe_id),
  foreign key (meal_plan_id, user_id)
    references public.meal_plans (id, user_id) on delete cascade on update cascade,
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id) on delete cascade on update cascade
);

create index meal_plan_recipes_meal_plan_id_idx on public.meal_plan_recipes (meal_plan_id);
create index meal_plan_recipes_recipe_id_idx on public.meal_plan_recipes (recipe_id);
create index meal_plan_recipes_user_date_idx on public.meal_plan_recipes (user_id, planned_date);

create table public.grocery_lists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  meal_plan_id  uuid,
  name          text not null check (length(btrim(name)) between 1 and 150),
  status        text not null default 'active'
                  check (status in ('active', 'completed', 'archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  foreign key (meal_plan_id, user_id)
    references public.meal_plans (id, user_id)
    on delete set null (meal_plan_id) on update cascade
);

create index grocery_lists_user_id_idx on public.grocery_lists (user_id);
create index grocery_lists_meal_plan_id_idx on public.grocery_lists (meal_plan_id);

create table public.grocery_items (
  id               uuid primary key default gen_random_uuid(),
  grocery_list_id  uuid not null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  recipe_id        uuid,
  store_id         uuid,
  name             text not null check (length(btrim(name)) between 1 and 300),
  quantity         numeric(12, 4) check (quantity is null or quantity >= 0),
  unit             text,
  aisle            text,
  is_checked       boolean not null default false,
  position         integer not null default 0 check (position >= 0),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (grocery_list_id, user_id)
    references public.grocery_lists (id, user_id) on delete cascade on update cascade,
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id)
    on delete set null (recipe_id) on update cascade,
  foreign key (store_id, user_id)
    references public.stores (id, user_id)
    on delete set null (store_id) on update cascade
);

create index grocery_items_list_id_idx on public.grocery_items (grocery_list_id);
create index grocery_items_user_id_idx on public.grocery_items (user_id);
create index grocery_items_recipe_id_idx on public.grocery_items (recipe_id);
create index grocery_items_store_id_idx on public.grocery_items (store_id);


-- =============================================================================
-- SECTION 17 — imports and ai_jobs
-- =============================================================================

create table public.imports (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  import_type        text not null
                       check (import_type in ('screenshot', 'photo', 'url',
                                              'text', 'file', 'manual')),
  status             text not null default 'uploaded'
                       check (status in ('uploaded', 'analyzing', 'extracted',
                                         'reconstructed', 'duplicate_check',
                                         'needs_review', 'completed', 'failed',
                                         'discarded')),
  bucket_id          text not null default 'temp-imports',
  storage_path       text,
  source_url         text,
  original_filename  text,
  content_type       text,
  byte_size          bigint check (byte_size is null or byte_size >= 0),
  raw_text           text,
  extracted_payload  jsonb,
  recipe_id          uuid,
  -- Duplicate detection. duplicate_of_recipe_id is a CANDIDATE, never an
  -- automatic action: nothing is merged or overwritten until the user picks a
  -- resolution. NULL resolution with a non-null candidate = awaiting the user.
  duplicate_of_recipe_id  uuid,
  duplicate_score         numeric(5, 4)
                            check (duplicate_score is null
                                   or (duplicate_score >= 0 and duplicate_score <= 1)),
  duplicate_signals       jsonb not null default '{}'::jsonb,
  duplicate_resolution    text
                            check (duplicate_resolution is null
                                   or duplicate_resolution in ('merged',
                                                               'kept_both',
                                                               'cancelled')),
  error_message      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  completed_at       timestamptz,
  unique (id, user_id),
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id)
    on delete set null (recipe_id) on update cascade,
  foreign key (duplicate_of_recipe_id, user_id)
    references public.recipes (id, user_id)
    on delete set null (duplicate_of_recipe_id) on update cascade
);

create index imports_duplicate_of_idx on public.imports (duplicate_of_recipe_id);
create index imports_awaiting_dupe_idx on public.imports (user_id)
  where duplicate_of_recipe_id is not null and duplicate_resolution is null;
create index imports_user_id_idx on public.imports (user_id);
create index imports_user_status_idx on public.imports (user_id, status);
create index imports_recipe_id_idx on public.imports (recipe_id);
create index imports_created_at_idx on public.imports (user_id, created_at desc);

comment on table public.imports is
  'Raw capture events (screenshot, photo, URL, pasted text) awaiting extraction.';

create table public.ai_jobs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  import_id          uuid,
  recipe_id          uuid,
  job_type           text not null
                       check (job_type in ('ocr', 'extract_recipe',
                                           'normalize_ingredients',
                                           'estimate_nutrition', 'suggest_tags',
                                           'generate_summary',
                                           'generate_cover_image')),
  status             text not null default 'queued'
                       check (status in ('queued', 'running', 'succeeded',
                                         'failed', 'cancelled')),
  provider           text,
  model              text,
  attempt            integer not null default 1 check (attempt >= 1),
  prompt_tokens      integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens  integer check (completion_tokens is null or completion_tokens >= 0),
  cost_usd           numeric(10, 4) check (cost_usd is null or cost_usd >= 0),
  request_payload    jsonb,
  response_payload   jsonb,
  error_message      text,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint ai_jobs_completed_after_started
    check (completed_at is null or started_at is null or completed_at >= started_at),
  foreign key (import_id, user_id)
    references public.imports (id, user_id) on delete cascade on update cascade,
  foreign key (recipe_id, user_id)
    references public.recipes (id, user_id)
    on delete set null (recipe_id) on update cascade
);

create index ai_jobs_user_id_idx on public.ai_jobs (user_id);
create index ai_jobs_import_id_idx on public.ai_jobs (import_id);
create index ai_jobs_recipe_id_idx on public.ai_jobs (recipe_id);
create index ai_jobs_status_idx on public.ai_jobs (status)
  where status in ('queued', 'running');

comment on table public.ai_jobs is
  'Unit of AI work against an import or recipe. Retains cost and token usage.';


-- =============================================================================
-- SECTION 18 — Full-text search
-- =============================================================================
-- search_vector aggregates content from four tables, so it cannot be a
-- generated column. It is maintained by trigger instead.
--
-- Weighting:
--   A  title
--   B  cuisine, cooking method, course, main type, main protein, tags
--   C  ingredients (item text and the original raw line)
--   D  description and notes

create or replace function public.refresh_recipe_search_vector(p_recipe_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.recipes r
     set search_vector =
             setweight(to_tsvector('english', coalesce(r.title, '')), 'A')
          || setweight(to_tsvector('english',
                 concat_ws(' ', coalesce(r.cuisine, ''),
                                coalesce(r.cooking_method, ''),
                                coalesce(r.course, ''),
                                coalesce(r.main_type, ''),
                                coalesce(r.main_protein, ''),
                                coalesce((select string_agg(t.name, ' ')
                                            from public.recipe_tags rt
                                            join public.tags t on t.id = rt.tag_id
                                           where rt.recipe_id = r.id), ''))), 'B')
          || setweight(to_tsvector('english',
                 coalesce((select string_agg(concat_ws(' ', ri.item, ri.raw_text), ' ')
                             from public.recipe_ingredients ri
                            where ri.recipe_id = r.id), '')), 'C')
          || setweight(to_tsvector('english',
                 concat_ws(' ', coalesce(r.description, ''),
                                coalesce(r.notes, ''))), 'D')
   where r.id = p_recipe_id;
$$;

comment on function public.refresh_recipe_search_vector(uuid) is
  'Recomputes recipes.search_vector from the recipe and its ingredients and tags.';

create or replace function public.trg_recipes_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.refresh_recipe_search_vector(new.id);
  return null;
end;
$$;

-- Scoped to the source columns, so the nested UPDATE of search_vector does not
-- re-fire this trigger.
create trigger recipes_search_vector_aiu
  after insert or update of title, description, notes, cuisine, cooking_method,
                            course, main_type, main_protein
  on public.recipes
  for each row
  execute function public.trg_recipes_search_vector();

create or replace function public.trg_child_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.refresh_recipe_search_vector(old.recipe_id);
  else
    perform public.refresh_recipe_search_vector(new.recipe_id);
    if (tg_op = 'UPDATE' and old.recipe_id is distinct from new.recipe_id) then
      perform public.refresh_recipe_search_vector(old.recipe_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger recipe_ingredients_search_vector_aiud
  after insert or update or delete on public.recipe_ingredients
  for each row execute function public.trg_child_search_vector();

create trigger recipe_tags_search_vector_aiud
  after insert or update or delete on public.recipe_tags
  for each row execute function public.trg_child_search_vector();


-- =============================================================================
-- SECTION 19 — updated_at triggers
-- =============================================================================

do $$
declare
  t text;
  stamped text[] := array[
    'profiles', 'sources', 'stores', 'recipes', 'cocktail_details',
    'recipe_ingredients', 'recipe_steps', 'recipe_images', 'nutrition',
    'tags', 'recipe_tags', 'collections', 'recipe_collections', 'equipment',
    'recipe_equipment', 'cook_log', 'meal_plans', 'meal_plan_recipes',
    'grocery_lists', 'grocery_items', 'imports', 'ai_jobs'
  ];
begin
  foreach t in array stamped loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end;
$$;


-- =============================================================================
-- SECTION 20 — Per-user default data (production-safe, idempotent)
-- =============================================================================
-- This is the mechanism that replaces reliance on supabase/seed.sql. It runs on
-- production, on every environment, for every user, and is safe to re-run: every
-- insert is ON CONFLICT DO NOTHING against a natural key, so a second call
-- changes nothing and a user's later edits are never overwritten.
--
-- The standard Recipe Vault categories are implemented as tags with
-- tag_type = 'course'. There is no separate categories table.

create or replace function public.bootstrap_user_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ordered shopping stores -------------------------------------------------
  insert into public.stores (user_id, name, sort_order)
  values
    (p_user_id, 'Costco',                    1),
    (p_user_id, 'Sprouts',                   2),
    (p_user_id, 'Fresh Market',              3),
    (p_user_id, 'Publix',                    4),
    (p_user_id, 'Walmart',                   5),
    (p_user_id, 'Whole Foods',               6),
    (p_user_id, 'Joseph''s Italian Market',  7),
    (p_user_id, 'Doris Italian Market',      8),
    (p_user_id, 'Carmine''s Gourmet Market', 9)
  on conflict (user_id, lower(btrim(name))) do nothing;

  -- Standard tags. The 'course' rows are the standard Recipe Vault categories.
  insert into public.tags (user_id, name, slug, tag_type, is_default)
  values
    (p_user_id, 'Appetizers',            'appetizers',            'course', true),
    (p_user_id, 'Beef & Burgers',        'beef-and-burgers',      'course', true),
    (p_user_id, 'Chicken',               'chicken',               'course', true),
    (p_user_id, 'Pork',                  'pork',                  'course', true),
    (p_user_id, 'Seafood',               'seafood',               'course', true),
    (p_user_id, 'Pasta',                 'pasta',                 'course', true),
    (p_user_id, 'Soups & Stews',         'soups-and-stews',       'course', true),
    (p_user_id, 'Sides & Salads',        'sides-and-salads',      'course', true),
    (p_user_id, 'Sauces & Dressings',    'sauces-and-dressings',  'course', true),
    (p_user_id, 'Breakfast',             'breakfast',             'course', true),
    (p_user_id, 'Desserts',              'desserts',              'course', true),
    (p_user_id, 'Cocktails',             'cocktails',             'course', true),
    (p_user_id, 'Grilling & Blackstone', 'grilling-and-blackstone', 'course', true),
    (p_user_id, 'Cabin Meals',           'cabin-meals',           'course', true),
    (p_user_id, 'Other',                 'other',                 'course', true),
    (p_user_id, 'Grilled',        'grilled',        'method', true),
    (p_user_id, 'Smoked',         'smoked',         'method', true),
    (p_user_id, 'Roasted',        'roasted',        'method', true),
    (p_user_id, 'Braised',        'braised',        'method', true),
    (p_user_id, 'Sous Vide',      'sous-vide',      'method', true),
    (p_user_id, 'Fried',          'fried',          'method', true),
    (p_user_id, 'Slow Cooker',    'slow-cooker',    'method', true),
    (p_user_id, 'No Cook',        'no-cook',        'method', true),
    (p_user_id, 'Vegetarian',     'vegetarian',     'diet',   true),
    (p_user_id, 'Vegan',          'vegan',          'diet',   true),
    (p_user_id, 'Gluten Free',    'gluten-free',    'diet',   true),
    (p_user_id, 'Dairy Free',     'dairy-free',     'diet',   true),
    (p_user_id, 'Low Carb',       'low-carb',       'diet',   true),
    (p_user_id, 'Weeknight',      'weeknight',      'occasion', true),
    (p_user_id, 'Holiday',        'holiday',        'occasion', true),
    (p_user_id, 'Party',          'party',          'occasion', true),
    (p_user_id, 'Game Day',       'game-day',       'occasion', true),
    (p_user_id, 'Company Worthy', 'company-worthy', 'occasion', true)
  on conflict (user_id, slug) do nothing;

  -- Equipment ---------------------------------------------------------------
  insert into public.equipment (user_id, name, category, is_default)
  values
    (p_user_id, 'Grill',                'cooking', true),
    (p_user_id, 'Smoker',               'cooking', true),
    (p_user_id, 'Cast Iron Skillet',    'cooking', true),
    (p_user_id, 'Dutch Oven',           'cooking', true),
    (p_user_id, 'Sheet Pan',            'cooking', true),
    (p_user_id, 'Stock Pot',            'cooking', true),
    (p_user_id, 'Sous Vide Circulator', 'appliance', true),
    (p_user_id, 'Air Fryer',            'appliance', true),
    (p_user_id, 'Pressure Cooker',      'appliance', true),
    (p_user_id, 'Slow Cooker',          'appliance', true),
    (p_user_id, 'Stand Mixer',          'appliance', true),
    (p_user_id, 'Food Processor',       'appliance', true),
    (p_user_id, 'Blender',              'appliance', true),
    (p_user_id, 'Immersion Blender',    'appliance', true),
    (p_user_id, 'Cocktail Shaker',      'bar', true),
    (p_user_id, 'Mixing Glass',         'bar', true),
    (p_user_id, 'Jigger',               'bar', true),
    (p_user_id, 'Bar Spoon',            'bar', true),
    (p_user_id, 'Muddler',              'bar', true),
    (p_user_id, 'Hawthorne Strainer',   'bar', true)
  on conflict (user_id, lower(btrim(name))) do nothing;

  -- Collections -------------------------------------------------------------
  insert into public.collections (user_id, name, slug, sort_order, is_default, is_pinned)
  values
    (p_user_id, 'Favorites',      'favorites',      1, true, true),
    (p_user_id, 'Need To Try',    'need-to-try',    2, true, false),
    (p_user_id, 'Colorado Cabin', 'colorado-cabin', 3, true, false),
    (p_user_id, 'Beach House',    'beach-house',    4, true, false),
    (p_user_id, 'Holiday',        'holiday',        5, true, false),
    (p_user_id, 'Date Night',     'date-night',     6, true, false),
    (p_user_id, 'Football',       'football',       7, true, false),
    (p_user_id, 'Cocktails',      'cocktails',      8, true, false)
  on conflict (user_id, slug) do nothing;
end;
$$;

revoke all on function public.bootstrap_user_defaults(uuid) from public, anon;
grant execute on function public.bootstrap_user_defaults(uuid) to service_role;

comment on function public.bootstrap_user_defaults(uuid) is
  'Idempotently creates a user''s default stores, tags, equipment and '
  'collections. Safe to re-run; never overwrites user edits.';


-- =============================================================================
-- SECTION 21 — auth.users -> profiles trigger
-- =============================================================================
-- Every new auth user gets a profile row and their default data, in the same
-- transaction as the signup.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name',
                          new.raw_user_meta_data ->> 'name',
                          split_part(coalesce(new.email, ''), '@', 1))), '')
  )
  on conflict (id) do nothing;

  perform public.bootstrap_user_defaults(new.id);
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT on auth.users: creates the profile row and default data.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any auth user that predates this migration gets the same treatment.
do $$
declare
  u record;
begin
  for u in select id, email, raw_user_meta_data from auth.users loop
    insert into public.profiles (id, display_name)
    values (
      u.id,
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                            u.raw_user_meta_data ->> 'name',
                            split_part(coalesce(u.email, ''), '@', 1))), '')
    )
    on conflict (id) do nothing;
    perform public.bootstrap_user_defaults(u.id);
  end loop;
end;
$$;


-- =============================================================================
-- SECTION 22 — Row Level Security
-- =============================================================================
-- Policy model:
--   anon           no policies at all, and privileges revoked -> zero access
--   authenticated  full CRUD restricted to rows where user_id = auth.uid()
--   service_role   unrestricted, for backend processing
--
-- auth.uid() is wrapped in a scalar subquery so the planner evaluates it once
-- per statement rather than once per row.

do $$
declare
  t text;
  secured text[] := array[
    'profiles', 'sources', 'stores', 'recipes', 'cocktail_details',
    'recipe_ingredients', 'recipe_steps', 'recipe_images', 'nutrition',
    'tags', 'recipe_tags', 'collections', 'recipe_collections', 'equipment',
    'recipe_equipment', 'cook_log', 'meal_plans', 'meal_plan_recipes',
    'grocery_lists', 'grocery_items', 'imports', 'ai_jobs'
  ];
begin
  foreach t in array secured loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- profiles keys on id rather than user_id.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = (select auth.uid()));
create policy profiles_service_role on public.profiles
  for all to service_role using (true) with check (true);

-- Every remaining user-owned table follows the identical user_id pattern.
do $$
declare
  t text;
  owned_tables text[] := array[
    'sources', 'stores', 'recipes', 'cocktail_details', 'recipe_ingredients',
    'recipe_steps', 'recipe_images', 'nutrition', 'tags', 'recipe_tags',
    'collections', 'recipe_collections', 'equipment', 'recipe_equipment',
    'cook_log', 'meal_plans', 'meal_plan_recipes', 'grocery_lists',
    'grocery_items', 'imports', 'ai_jobs'
  ];
begin
  foreach t in array owned_tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for all to service_role
         using (true) with check (true)', t || '_service_role', t);
  end loop;
end;
$$;


-- =============================================================================
-- SECTION 23 — Privileges
-- =============================================================================

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;


-- =============================================================================
-- SECTION 24 — Storage buckets
-- =============================================================================
-- All four buckets are private. Objects are addressed as <user_id>/<path...>,
-- and the policies below enforce that the first path segment matches the
-- caller's uid, giving storage the same ownership rule as the tables.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recipe-images',  'recipe-images',  false, 26214400,
     array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('recipe-exports', 'recipe-exports', false, 52428800,
     array['application/pdf', 'text/markdown', 'application/json', 'text/csv']),
  ('temp-imports',   'temp-imports',   false, 26214400,
     array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
           'application/pdf', 'text/plain']),
  ('avatars',        'avatars',        false, 5242880,
     array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
declare
  b text;
  buckets text[] := array['recipe-images', 'recipe-exports', 'temp-imports', 'avatars'];
begin
  foreach b in array buckets loop
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L
                and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_select_own', b);
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L
                     and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_insert_own', b);
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L
                and (storage.foldername(name))[1] = (select auth.uid())::text)
         with check (bucket_id = %L
                     and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_update_own', b, b);
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L
                and (storage.foldername(name))[1] = (select auth.uid())::text)',
      b || '_delete_own', b);
    execute format(
      'create policy %I on storage.objects for all to service_role
         using (bucket_id = %L) with check (bucket_id = %L)',
      b || '_service_role', b, b);
  end loop;
end;
$$;

-- =============================================================================
-- End of Migration 001
-- =============================================================================
