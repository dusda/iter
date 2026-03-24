### Iterator app (local Supabase stack)

**About**

This repository contains the front-end for an internal funding / requests app, plus a local Supabase stack for development. It is built with React + Vite and talks directly to Supabase Auth and the PostgREST API.

---

### Tech stack

- **Frontend**: React 18, Vite, React Router, Tailwind‑based UI components.
- **Backend (local dev)**: Supabase CLI (`npx supabase`) for Postgres/Auth/REST and supporting services.
- **Database**: SQL migrations in `supabase/migrations/` and seed SQL in `supabase/seed.sql`.

---

### Prerequisites

- **Node.js**: `>=24 <25` (see `package.json`)
- **Docker** (required by Supabase CLI local stack)
- **Supabase CLI** (available via `npx supabase` in this project)

For consistent local development, it’s recommended to use [nvm](https://github.com/nvm-sh/nvm) to install the correct version of Node.

```bash
# this will find .nvmrc in the repo and install the correct version of node.
~) nvm use
```

---

### Getting started

**1. Clone and install**

- **Clone** the repo and `cd` into it.
- **Install dependencies**:

```bash
~) nvm use
~) npm install
```

**2. Start the local Supabase stack**

Start the local Supabase services:

```bash
~) npx supabase start
```

Key local endpoints:

- **Postgres**: `localhost:54322`
- **Supabase API gateway**: `http://127.0.0.1:54321`
- **Studio**: `http://127.0.0.1:54323`

Stop and remove local Supabase containers + volumes (equivalent to `docker compose down -v`):

```bash
~) npx supabase stop --no-backup
```

**3. Apply database migrations and seed data**

Migrations live under `supabase/migrations/`.

- Apply pending migrations:

```bash
npm run db:migrate
```

- Regenerate `supabase/seed.sql` from `doc/*.csv`:

```bash
npm run db:seed
```

- Apply `supabase/seed.sql` to current DB:

```bash
npm run db:seed:apply
```

- Full local setup (migrate + generate seed + apply seed + ensure default admin user):

```bash
npm run db:setup
```

You can also run Supabase CLI reset flow (migrations + seed from `supabase/seed.sql`):

```bash
npx supabase db reset
```

**5. Run the app**

Start the Vite dev server:

```bash
npm run dev
```

Then open:

- **App**: `http://localhost:5173`

The dev server proxies API calls to local services:

- `http://localhost:5173/auth/v1/*` -> `http://127.0.0.1:54321/auth/v1/*`
- `http://localhost:5173/rest/v1/*` -> `http://127.0.0.1:54321/rest/v1/*`

---

### Environment variables

The front‑end Supabase client uses:

- **`VITE_SUPABASE_URL`** – optional. Defaults to `window.location.origin` in development (e.g. `http://localhost:5173`).
- **`VITE_SUPABASE_ANON_KEY`** – optional. Defaults to a local demo anon key suitable for development.

If you want to point the app at a different Supabase project or deployment, set these in `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Restart the dev server after changing environment variables.

---

### Useful scripts

- **`npm run dev`**: Start the Vite dev server.
- **`npm run build`**: Build the production bundle.
- **`npm run lint` / `npm run lint:fix`**: Run ESLint.
- **`npm run typecheck`**: Run TypeScript checks.
- **`npm run db:migrate`**: Apply pending migrations using `npx supabase db push`.
- **`npm run db:seed`**: Generate `supabase/seed.sql` from `doc/*.csv`.
- **`npm run db:seed:apply`**: Apply `supabase/seed.sql` with `psql`.
- **`npm run db:setup`**: Run migrations, generate/apply seed, and ensure default admin user.
- **`npm run db:create-admin`**: Create/update default admin user (`dev@gotham.design`) via Auth + profile upsert.

