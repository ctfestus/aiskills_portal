# Festman White-Label Deployment Plan

## Context

AI Skills Africa (AISA) is deploying a white-labeled version of its learning platform for Festman at `learn.festman.com`. The strategy is: **one GitHub repo, two separate Vercel deployments** (AISA + Festman), each with its own Supabase project and env vars. All branding comes from environment variables — no code fork needed.

---

## Step 1: Create `lib/tenant.ts` — Central Branding Config

Create a new file that reads all tenant-specific values from env vars, with AISA as defaults:

```ts
// lib/tenant.ts
export const tenant = {
  appName:      process.env.NEXT_PUBLIC_APP_NAME      ?? 'AI Skills Africa',
  orgName:      process.env.NEXT_PUBLIC_ORG_NAME      ?? 'AI Skills Africa',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@app.aiskillsafrica.com',
  appUrl:       process.env.NEXT_PUBLIC_APP_URL       ?? 'https://app.aiskillsafrica.com',
  logoUrl:      process.env.NEXT_PUBLIC_LOGO_URL      ?? 'https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/assets/logo.png',
  brandColor:   process.env.NEXT_PUBLIC_BRAND_COLOR   ?? '#006128',
  senderEmail:  process.env.SENDER_EMAIL              ?? 'AI Skills Africa <support@app.aiskillsafrica.com>',
  teamName:     process.env.NEXT_PUBLIC_TEAM_NAME     ?? 'The AI Skills Africa Team',
};
```

---

## Step 2: Replace Hardcoded Branding References

### 2a. Email Sender (13+ files)

Replace `'AI Skills Africa <support@app.aiskillsafrica.com>'` with `tenant.senderEmail` in:

| File |
|------|
| `app/api/bulk-message/route.ts` |
| `app/api/certificate/[id]/route.ts` |
| `app/api/cron/deadline-reminders/route.ts` |
| `app/api/cron/progress-nudges/route.ts` |
| `app/api/cron/weekly-digest/route.ts` |
| `app/api/email/route.ts` |
| `app/api/event-register/route.ts` |
| `app/api/notify-assignment/route.ts` |
| `app/api/nudge-student/route.ts` |
| `app/api/workflows/onboarding/route.ts` |

**How:** Add `import { tenant } from '@/lib/tenant'` and replace hardcoded string with `tenant.senderEmail`.

---

### 2b. Logo URLs

Replace hardcoded Supabase logo URL with `tenant.logoUrl` in:

| File | Location |
|------|----------|
| `lib/email-templates.ts` | `<img src="...">` in HTML email bodies |
| `app/api/og/[id]/route.ts` | OG image generation |

---

### 2c. App Name in Metadata

- **File:** `app/layout.tsx`
- **Fields:** `title`, `description`, `og:title`, `og:site_name`, `twitter:title`
- **Change:** Use `tenant.appName`

---

### 2d. Email Team Signature

- **File:** `lib/email-templates.ts`
- **Text:** `"The AI Skills Africa Team"` at the bottom of every email
- **Change:** Use `tenant.teamName`

---

### 2e. Certificate Org Name

- **File:** `components/CertificateTemplate.tsx`
- **Change:** Replace hardcoded org name with `tenant.orgName`

---

### 2f. App URL in Emails

- **Files:** `lib/email-templates.ts` and any route that links back to the app
- **Change:** Replace `https://app.aiskillsafrica.com` with `tenant.appUrl`

---

## Step 3: Vercel Setup for Festman

1. Go to **Vercel → Add New Project** → import the same GitHub repo
2. Set project name: `festman-learn`
3. Add these environment variables:

| Variable | Festman Value |
|----------|---------------|
| `NEXT_PUBLIC_APP_NAME` | `Festman Learn` |
| `NEXT_PUBLIC_ORG_NAME` | `Festman` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@festman.com` |
| `NEXT_PUBLIC_APP_URL` | `https://learn.festman.com` |
| `NEXT_PUBLIC_LOGO_URL` | *(upload logo to Festman Supabase storage first, paste URL here)* |
| `NEXT_PUBLIC_BRAND_COLOR` | *(Festman brand hex color)* |
| `SENDER_EMAIL` | `Festman <no-reply@festman.com>` |
| `NEXT_PUBLIC_TEAM_NAME` | `The Festman Team` |
| `NEXT_PUBLIC_SUPABASE_URL` | *(Festman Supabase project URL)* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Festman Supabase anon key)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Festman Supabase service role key)* |
| `RESEND_API_KEY` | *(Festman's own Resend API key)* |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | *(Festman's Cloudinary cloud name)* |
| `CLOUDINARY_API_KEY` | *(Festman's Cloudinary API key)* |
| `CLOUDINARY_API_SECRET` | *(Festman's Cloudinary API secret)* |
| `UPSTASH_REDIS_REST_URL` | *(Festman's Upstash Redis URL)* |
| `UPSTASH_REDIS_REST_TOKEN` | *(Festman's Upstash Redis token)* |
| `BUNNY_API_KEY` | *(Festman's Bunny.net API key, if using video)* |
| `BUNNY_LIBRARY_ID` | *(Festman's Bunny stream library ID)* |

4. Under **Domains**, add `learn.festman.com`
5. Point Festman's DNS: add a **CNAME** record pointing `learn` → `cname.vercel-dns.com`

---

## Step 4: Festman Supabase Project

1. Create a new project at [supabase.com](https://supabase.com) — name it `festman-learn`
2. In the **SQL Editor**, run every file in `migrations/` in numeric order (001 → latest)
3. In **Auth → Settings**:
   - Enable Email auth
   - Set **Site URL** to `https://learn.festman.com`
   - Add redirect URL: `https://learn.festman.com/**`
4. In **Storage**, create a bucket called `assets` (public)
5. Upload Festman's logo → copy the public URL → paste into Vercel as `NEXT_PUBLIC_LOGO_URL`

---

## Step 5: Seed First Admin

After the Supabase project is live:

1. Create the first admin account via **Supabase Auth → Users → Invite user**
2. Run in SQL Editor:

```sql
INSERT INTO profiles (id, role)
VALUES ('<paste-user-id-from-auth>', 'admin');
```

---

## Critical Files Summary

| File | What Changes |
|------|-------------|
| `lib/tenant.ts` | **Create** — central env-var branding config |
| `app/layout.tsx` | App name in page metadata |
| `lib/email-templates.ts` | Logo URL, team name, app URL in all email HTML |
| `app/api/email/route.ts` | Sender name |
| `app/api/bulk-message/route.ts` | Sender name |
| `app/api/certificate/[id]/route.ts` | Sender name |
| `app/api/cron/deadline-reminders/route.ts` | Sender name |
| `app/api/cron/progress-nudges/route.ts` | Sender name |
| `app/api/cron/weekly-digest/route.ts` | Sender name |
| `app/api/event-register/route.ts` | Sender name |
| `app/api/notify-assignment/route.ts` | Sender name |
| `app/api/nudge-student/route.ts` | Sender name |
| `app/api/workflows/onboarding/route.ts` | Sender name |
| `app/api/og/[id]/route.ts` | Logo in OG image |
| `components/CertificateTemplate.tsx` | Org name on certificate |

---

## Verification Checklist

### Local Test (before deploying Festman)

Add to `.env.local`:

```env
NEXT_PUBLIC_APP_NAME=Festman Learn
NEXT_PUBLIC_LOGO_URL=<festman-logo-url>
NEXT_PUBLIC_BRAND_COLOR=#<hex>
SENDER_EMAIL=Festman <no-reply@festman.com>
NEXT_PUBLIC_TEAM_NAME=The Festman Team
NEXT_PUBLIC_ORG_NAME=Festman
```

Run `npm run dev` and check:

- [ ] Browser tab shows "Festman Learn"
- [ ] Logo renders as Festman's logo
- [ ] Send a test email — sender shows "Festman" not "AI Skills Africa"
- [ ] Email footer shows "The Festman Team"
- [ ] Certificate shows "Festman" as org name
- [ ] `/api/og/[course-id]` shows Festman logo

### AISA Regression Check

- [ ] AISA Vercel deployment (no new env vars) still shows AISA branding — defaults apply
