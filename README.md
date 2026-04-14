# Restaurant Ops Pro

This is a real multi-device restaurant table management web app starter built for live use on a computer and iPad.

## What it does
- Shared live floor plan across devices
- Drag-and-drop tables
- Table status board
- Turn timers
- Cover tracking
- Check total tracking
- Reservations and waitlist
- Activity feed
- Multiple floors
- Safari-friendly web app

## What you need
1. A free Supabase project
2. A free Netlify account

## 1) Create the database
In Supabase:
- Create a new project
- Open the SQL Editor
- Paste everything from `supabase/schema.sql`
- Run it

Then in Supabase:
- Go to **Project Settings > API**
- Copy the **Project URL**
- Copy the **anon public key**

## 2) Add environment variables
Create a `.env` file from `.env.example` and add:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## 3) Run locally
```bash
npm install
npm run dev
```

## 4) Deploy to Netlify
- Push this folder to GitHub, or upload it through Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Add the same 2 environment variables in Netlify

## 5) Use on iPad
- Open the deployed website in Safari
- Tap Share
- Tap Add to Home Screen

## Important truth
This is a working full-stack app package, but it is still a custom app starter, not the finished product of a commercial SaaS company.

What it already gives you:
- shared live updates across devices
- cloud-backed data with Supabase
- restaurant floor control workflow

What would still be added for a true enterprise-grade OpenTable competitor:
- staff logins and role permissions
- SMS/email guest confirmations
- calendar views
- shift reports and analytics dashboards
- printer/KDS/POS integrations
- audit history by employee
- richer reservation pacing rules
- sections by shift and automatic rotation

## Fastest setup path
If you want the quickest route:
1. Create Supabase
2. Run `schema.sql`
3. Add env vars
4. Deploy to Netlify
5. Open on both computer and iPad

## Files to know
- `src/App.tsx` — main app
- `src/hooks/useRealtimeOps.ts` — live data logic
- `supabase/schema.sql` — database schema and seed data
- `.env.example` — environment variable template
