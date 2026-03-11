### Iterator app (local Supabase stack)

**About**

This repository contains the front‑end for an internal funding / requests app, plus a lightweight local Supabase stack (PostgreSQL, Auth, and PostgREST) for development. It is built with React + Vite and talks directly to Supabase Auth and the PostgREST API.

---

### Tech stack

- **Frontend**: React 18, Vite, React Router, Tailwind‑based UI components.
- **Backend (local dev)**: PostgreSQL, Supabase GoTrue Auth, PostgREST (via Docker Compose).
- **Database**: SQL migrations in `supabase/migrations/` plus helper scripts in `scripts/`.

---

### Prerequisites

- **Node.js**: v22.13
- **Docker + Docker Compose**

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

The `docker-compose.yml` file runs:

- **PostgreSQL** on `localhost:54322`
- **Supabase Auth (GoTrue)** on `http://localhost:9999`
- **PostgREST** on `http://localhost:3001`
- **Iter Funding App** on `http://localhost:5173`

Start the services:

```bash
~) docker compose up -d
```

**3. Apply database migrations, seed data, and admin user**

Migrations live under `supabase/migrations/`. You can apply them all with:

```bash
npm run db:setup
```

See `scripts/README.md` for more details on migrations and data import.

**5. Run the app**

Start the Vite dev server:

```bash
npm run dev
```

Then open:

- **App**: `http://localhost:5173`

The dev server proxies API calls to the local services:

- `http://localhost:5173/auth/v1/*` → `http://localhost:9999`
- `http://localhost:5173/rest/v1/*` → `http://localhost:3001`

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
- **`npm run db:migrate`**: Apply all SQL migrations under `supabase/migrations/`.
- **`npm run db:seed`**: Import CSV seed data into the DB.
- **`npm run db:setup`**: Run migrations, seed data, and admin user.
- **`npm run db:create-admin`**: Create the default admin user (`dev@gotham.design`).

