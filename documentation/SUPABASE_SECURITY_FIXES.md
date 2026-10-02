# Supabase Security Lint Fixes — 2026-09-27

The Supabase database linter flagged five warnings on 2026-09-27. This isn't
something Claude Code can apply directly — there's no Supabase connection
configured in this environment (the app only ever holds the public
`anon` key, via `/api/config`), and this project doesn't track schema
changes as SQL migrations. Run the SQL below yourself in the Supabase
**SQL Editor** (Project → SQL Editor).

## Findings and fixes

| Lint | Object | Fix |
|---|---|---|
| `pg_graphql_anon_table_exposed` | `public.user_data` | Revoke all `anon` privileges |
| `pg_graphql_authenticated_table_exposed` | `public.user_data` | Accepted trade-off — see below |
| `anon_security_definer_function_executable` | `public.rls_auto_enable()` | Revoke `EXECUTE` from `PUBLIC` |
| `authenticated_security_definer_function_executable` | `public.rls_auto_enable()` | Same revoke (fixes both) |
| `auth_leaked_password_protection` | Auth config | Dashboard toggle, not SQL |

### `public.user_data` — private per-user data, `anon` should never touch it

`user_data` holds one row per signed-in user (`current_team`,
`custom_prices`, `team_history`, `price_history`, `ai_prediction`) — see
`AuthContext.jsx`. Every access is `.eq('id', user.id)`, gated behind
`if (!supabase || !user) return;`. The app never reads or writes this table
before sign-in, so `anon`'s access was never intentional — it's the default
privilege Supabase grants every new `public` table.

```sql
revoke all privileges on table public.user_data from anon;
```

`authenticated` genuinely needs `SELECT`/`INSERT`/`UPDATE` here (every
signed-in user reads/writes their own row) — **do not** revoke that, it
would break cloud sync entirely. Because the grant is legitimate, lint
`pg_graphql_authenticated_table_exposed` will keep firing; that's expected,
not a sign of a leak, *as long as row-level security actually restricts
each user to their own row*. Verify that with:

```sql
select policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'user_data';
```

Every policy's `qual` should reduce to `auth.uid() = id` (or similar). If
`pg_policies` returns no rows for this table, RLS isn't enforcing anything —
that's a bigger problem than this lint and needs its own fix (not included
here, since it wasn't one of the reported warnings and doing it blind
without seeing your actual policies risks locking out the app or leaving a
gap).

If you don't use Supabase's GraphQL API anywhere (`/graphql/v1`, or the
GraphiQL explorer in Studio) — this app doesn't, it only uses the REST API
via `supabase-js` — disabling GraphQL entirely resolves *both* `user_data`
warnings at once, with no effect on the app:

```sql
-- OPTIONAL: only if nothing (in or outside this repo) uses this project's
-- GraphQL API. Skip if unsure.
drop extension if exists pg_graphql;
```

### `public.rls_auto_enable()` — publicly callable admin function

This is a `SECURITY DEFINER` function, meaning it runs with its **owner's**
privileges regardless of who calls it — a classic Postgres/PostgREST trap:
tables require an explicit `GRANT` to be reachable, but functions are
callable by `PUBLIC` (which `anon` and `authenticated` both inherit from)
unless you explicitly revoke it. The app never calls it (no `.rpc()` call
anywhere in the codebase), so it's almost certainly a one-off setup helper
that was left publicly reachable at `/rest/v1/rpc/rls_auto_enable`.

```sql
revoke all on function public.rls_auto_enable() from public;
```

This one statement fixes both the `anon` and `authenticated` findings,
since both inherited access the same way. Nothing needs to be re-granted —
the app doesn't call this function, so only the database owner can run it
from the SQL Editor going forward, which is exactly what an admin-only
helper should be.

### Leaked password protection

Not a schema change — this is an Auth setting. In the Supabase Dashboard:
**Authentication → Sign In / Providers → Password**, enable "Leaked
password protection" (checks new passwords against HaveIBeenPwned). No SQL
required.

## Full script

```sql
-- ============================================================================
-- Supabase security-lint remediation — 2026-09-27. Safe to re-run.
-- ============================================================================

-- public.user_data: anon has no legitimate access to this table at all.
revoke all privileges on table public.user_data from anon;

-- public.rls_auto_enable(): SECURITY DEFINER, never called by the app —
-- revoking from PUBLIC removes the inherited anon/authenticated access.
revoke all on function public.rls_auto_enable() from public;

-- Sanity check: every policy here should reduce to `auth.uid() = id`.
select policyname, permissive, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'user_data';

-- OPTIONAL — only if nothing uses this project's GraphQL API — resolves
-- the remaining "authenticated can see user_data in GraphQL" warning too.
-- drop extension if exists pg_graphql;
```
