-- =============================================================================
-- Recipe Vault — Migration 002: Harden SECURITY DEFINER function grants
-- =============================================================================
-- The Supabase database linter (0028 / 0029) flags every SECURITY DEFINER
-- function in `public` that the `anon` or `authenticated` role can execute via
-- PostgREST (`/rest/v1/rpc/<fn>`). Migration 001 locked down
-- `sync_recipe_number_seq` correctly (revoked from public, anon, authenticated;
-- granted to service_role) but left five other SECURITY DEFINER functions
-- reachable:
--
--   handle_new_user()                       anon + authenticated  (trigger-only)
--   refresh_recipe_cook_stats()             anon + authenticated  (trigger-only)
--   bootstrap_user_defaults(uuid)           authenticated         (see below)
--   refresh_recipe_search_vector(uuid)      anon + authenticated  (see below)
--
-- None of these is meant to be an API entry point:
--   * handle_new_user / refresh_recipe_cook_stats are trigger functions. A
--     trigger fires without an EXECUTE privilege check on the invoking role, so
--     revoking EXECUTE does NOT stop the triggers — it only closes the RPC hole.
--   * bootstrap_user_defaults is only ever called from handle_new_user, which is
--     SECURITY DEFINER and therefore runs the nested call as the owner. Leaving
--     it executable let any signed-in user seed default taxonomy for an
--     arbitrary user id. 001 revoked it from public + anon but not authenticated.
--   * refresh_recipe_search_vector is called from the two search-vector wrapper
--     triggers. Those are SECURITY INVOKER today, so they call it *as the
--     authenticated user*; revoking that grant on its own would break search
--     indexing. This migration first promotes the two wrappers to SECURITY
--     DEFINER (identical bodies, still search_path = ''), so the nested call
--     runs as the owner, and only then removes the public grant.
--
-- Revoking FROM public is required: the roles inherit EXECUTE through the PUBLIC
-- grant and/or a direct default-privilege grant, so both must be cleared. This
-- mirrors the `sync_recipe_number_seq` pattern already in 001. service_role
-- keeps EXECUTE only where it is actually used: bootstrap_user_defaults retains
-- its explicit 001 grant; the trigger-only functions do not need it.
--
-- End state (verify with has_function_privilege / get_advisors):
--   all five functions: anon = false, authenticated = false
--   bootstrap_user_defaults: service_role = true (unchanged, explicit grant)
-- =============================================================================


-- Promote the two search-vector wrapper triggers to SECURITY DEFINER so their
-- nested call to public.refresh_recipe_search_vector(uuid) runs as the owner and
-- no longer depends on the invoking role holding EXECUTE. Bodies are unchanged
-- from Migration 001 Section 18.
create or replace function public.trg_recipes_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_recipe_search_vector(new.id);
  return null;
end;
$$;

create or replace function public.trg_child_search_vector()
returns trigger
language plpgsql
security definer
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


-- Close the RPC surface on every non-API SECURITY DEFINER function. Revoking
-- from PUBLIC clears the inherited grant; naming anon + authenticated clears any
-- direct default-privilege grants. Owner (and superuser) execution is retained,
-- which is all the triggers and internal callers need.
revoke all on function public.handle_new_user()               from public, anon, authenticated;
revoke all on function public.refresh_recipe_cook_stats()     from public, anon, authenticated;
revoke all on function public.bootstrap_user_defaults(uuid)   from public, anon, authenticated;
revoke all on function public.refresh_recipe_search_vector(uuid) from public, anon, authenticated;

-- The wrappers are now SECURITY DEFINER too, so lock their RPC surface as well.
-- They are trigger-only; revoking EXECUTE does not affect trigger firing.
revoke all on function public.trg_recipes_search_vector()     from public, anon, authenticated;
revoke all on function public.trg_child_search_vector()       from public, anon, authenticated;

comment on function public.trg_recipes_search_vector() is
  'AFTER trigger on recipes: recomputes search_vector. SECURITY DEFINER so the '
  'nested refresh call runs as owner; EXECUTE revoked from anon/authenticated.';
comment on function public.trg_child_search_vector() is
  'AFTER trigger on recipe_ingredients/recipe_tags: recomputes the parent '
  'recipe search_vector. SECURITY DEFINER; EXECUTE revoked from anon/authenticated.';

-- =============================================================================
-- End of Migration 002
-- =============================================================================
