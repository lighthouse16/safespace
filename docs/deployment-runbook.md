# SafeSpace Production Deployment Runbook

## 1. Prerequisites & Environment Variables

Configure the following environment variables in production (Vercel, AWS, or Docker runtime):

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase Project URL | `https://[project-ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase Public Anon Key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Supabase Service Role Key for admin ops | `eyJhbGci...` |
| `SESSION_SECRET` | **Yes** | Secret for session tokens and encryption | 32+ character random string |
| `GEMINI_API_KEY` | Optional | Google Gemini API Key for AI interpretation | `AIzaSy...` |
| `EXPORT_GH_PAGES` | Optional | Set to `"true"` only for static GH Pages deploy | `"false"` |

## 2. Database Setup & Migration

Run the migration script against your Supabase or PostgreSQL database:

```bash
# Using Supabase CLI:
supabase db push

# Or via psql directly:
psql -h db.[project-ref].supabase.co -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
```

Verify that all tables and RLS policies are enabled:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
All application tables must show `rowsecurity = true`.

## 3. Private Storage Bucket Setup

1. In Supabase Dashboard, navigate to **Storage**.
2. Verify bucket `floorplans` exists with:
   - **Public**: `false` (Private)
   - **File size limit**: `52428800` (50MB)
   - **Allowed MIME types**: `image/png, image/jpeg, image/webp, application/pdf`
3. Storage policies in `001_initial_schema.sql` enforce that users can only upload/read/delete files inside `floorplans/{userId}/*`.

## 4. Building & Running the Application

### Production Build
```bash
npm run build
```

### Starting the Production Server
```bash
npm run start
```

### Production Health Check
Verify API health:
```bash
curl -I https://[your-domain]/api/v1/auth/session
# Expect HTTP 200 {"authenticated":false,"user":null}
```

## 5. Automated Verification Checklist

Before releasing to production:
- [x] Run full unit & integration test suite: `npm test` (247 passing tests)
- [x] Run TypeScript typecheck: `npm run typecheck` (0 errors)
- [x] Run linter: `npm run lint` (0 errors)
- [x] Verify Docker PostgreSQL migration & RLS isolation: `npx tsx --test tests/db-schema-isolation.test.ts`
- [x] Verify spatial parity: `npx tsx --test tests/spatial-parity.test.ts`
- [x] Verify full 23-step journey: `npx tsx --test tests/full-stack-journey.test.ts`
