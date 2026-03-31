# Business Dashboard Template

A production-ready business dashboard built with Next.js 14, Supabase, and Tailwind CSS. Clone it, configure it, deploy it to Vercel.

This template was extracted from a real dashboard running in production. Every module has been battle-tested.

## Features

| Module | What it does |
|--------|-------------|
| **Revenue** | Pulls payment data from Stripe. Monthly totals, goal tracking, revenue charts. |
| **Content Analytics** | Connects to Instagram Graph API. Views, likes, shares, engagement rates on your posts. |
| **Competitor Intelligence** | Scrapes competitor Instagram accounts via Apify. Tracks their top posts, extracts viral hooks. |
| **Tasks** | Kanban board with drag-and-drop. Columns: To Do, In Progress, Review, Done. |
| **Calendar** | Google Calendar integration. Shows upcoming events inline. |
| **Email** | Gmail integration with AI triage. Categorizes emails by priority using Claude or GPT. |
| **Ads** | Meta Ads reporting. Spend, CPL, campaign performance. Read-only. |
| **Content Scheduling** | Google Drive folder monitoring. Detects new videos, auto-generates captions, schedules to Instagram/TikTok/YouTube/Facebook via Zernio. |

## Prerequisites

Run `/dashboard-setup` first. It installs:
- Vercel CLI
- Google Cloud SDK (for Calendar + Gmail OAuth)
- Supabase project connection

## Quick Start

1. Clone this repo
2. Copy `.env.example` to `.env.local` and fill in your keys
3. Edit `config.json` to enable the modules you want
4. Run the database migration: paste `scripts/setup-db.sql` into your Supabase SQL editor
5. Install dependencies and start:

```bash
npm install
npm run dev
```

Or run `/dashboard-builder` and it walks you through everything interactively.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Styling:** Tailwind CSS with CSS variables for theming
- **Deployment:** Vercel
- **APIs:** Stripe, Instagram Graph API, Gmail, Google Calendar, Google Drive, Meta Ads, Apify, Zernio, Anthropic, OpenAI

## Configuration

All customization lives in `config.json`. The `/dashboard-builder` skill reads this file to know which modules to wire up.

### Modules

Set `"enabled": true` on any module you want active. Disabled modules won't render and their API routes won't fire.

### Theme

- `accent` — your brand color (hex). Used for buttons, charts, active states.
- `mode` — `"dark"` or `"light"`.

### Platforms

Fill in your Zernio account IDs for each social platform you want to schedule content to.

### Drive

- `folderId` — Google Drive folder ID where you drop videos for scheduling.
- `cutoffDate` — ISO date string. Only files created after this date get picked up.

## Project Structure

```
app/
  page.tsx              # Overview / home
  financials/           # Revenue module (Stripe)
  content/              # Content analytics + competitors + hooks
  tasks/                # Kanban board
  calendar/             # Google Calendar
  email/                # Gmail + AI triage
  ads/                  # Meta Ads reporting
  schedule/             # Content scheduling (Drive + Zernio)
  settings/             # Dashboard settings
  api/                  # All API routes
    cron/               # Scheduled jobs (competitor scraping, idea generation)
    content/            # Content endpoints (queue, hooks, scrape, competitors)
    email/              # Gmail endpoints
    tasks/              # Kanban endpoints
    ...
components/             # Shared UI components
lib/
  supabase/             # Supabase client setup
  google-auth.ts        # Google OAuth helpers
  queries.ts            # Database query functions
  types.ts              # TypeScript types
scripts/
  setup-db.sql          # Full database migration
```
