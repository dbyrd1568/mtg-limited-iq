# MTG Limited IQ

> **Elevate your Limited game with active recall drills, card evaluations, and empirical 17Lands draft telemetry.**

**MTG Limited IQ** is an advanced Magic: The Gathering Limited format training platform and evaluation suite designed to build card recognition, test metagame heuristics, and sharpen draft and sealed decision-making.

---

## Key Features

### 1. Card Quiz & Flashcard Drills
- **Active Recall**: Test your memory of mana costs, power/toughness, combat tricks, and removal at instant speed.
- **Drill Modes**: Standard Quiz, Spaced Repetition, and Flashcard Review.
- **Granular Customization**: Filter practice sessions by set, mana colors, card types, and rarities.

### 2. Set Explorer & Scryfall / Arena Search
- **Arena & Scryfall Search Engine**: Direct in-set filtering using standard tokens:
  - Text & Types: `t:creature`, `t:instant`, `o:"draw a card"`, `name:"Shock"`
  - Colors: `c:w`, `c>=g`, `c<=wgb`, `c=r`, `c:colorless`
  - Numbers & Stats: `pow>3`, `tou>=4`, `mv<3`, `cmc=2`
  - Rarities: `r:common`, `r=u`, `r>=r`
  - Negation: `-t:creature`, `-c:u`
- **Visual Advanced Search Modal**: Build complex queries with interactive sliders, type chips, and color toggles.
- **Search Syntax Cheat Sheet**: Built-in 1-click reference with copyable examples.
- **Filtered Subset Notice**: Keep context while inspecting cards, with instant "Clear Filter" navigation.

### 3. Evaluation Hub & Metagame Synthesis
- **Personal Card Grading**: Assign letter tiers (`S, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F`) with custom strategic notes.
- **Precedent Slot Picker**: Substitute comparable benchmark cards with full-text rules search and historical win rate anchors.
- **17Lands Data Comparison**: Direct integration with empirical 17Lands Game-in-Hand (GIH) win rates and pick priority.
- **Side-by-Side Mode**: Compare personal intuition against empirical win rates to discover personal traps and sleeper cards.
- **Archetype Forecast**: Monocolor and 2-color archetype rankings, speed indicators, and draft reads with creator-style synthesis reports.
- **Unreleased Set Guardrails**: Automatic TBD indicators for unreleased sets awaiting initial 17Lands match telemetry.

### 4. Universal 17Lands Data Caching & Auto-Sync
- **3-Tier Caching Architecture**:
  1. *In-Memory Preloaded Bundle*: Instant frame-0 rendering for core sets without waiting for network roundtrips.
  2. *Cloudflare Worker Edge Cache (`caches.default`)*: Global edge proxy with stampede deduplication and stale-if-error protection against 17Lands rate limits.
  3. *Supabase Database Fallback*: Centralized `seventeenlands_cache` table shared across all active users.
- **Automated Sync Pipeline**: Daily GitHub Actions cron workflow (`.github/workflows/sync-17lands.yml`) running `scripts/sync-17lands.ts`.
- **Active Set Recalibration**:
  - *Active Formats* (`HOB`, `MBC`, upcoming `FRA`): Revalidated every 24 hours while on Magic Arena.
  - *Historical Formats* (`DFT`, etc.): Revalidated every 7 days to detect Flashback draft runs after completing their primary season.

### 5. Authentication & Local Development
- **Multi-Provider Social SSO**: Google, Discord, Apple, Magic Link, and Password authentication powered by Supabase.
- **Google Identity Services (GSI) & Resilient OAuth**: Native Google ID token exchange with automatic fallback to OAuth PKCE redirect.
- **1-Click Localhost Developer Access**: When running locally on `http://localhost:5173`, the Login Gate presents a dedicated `⚡ Dev Quick Login` button to immediately authenticate as Devon Byrd (`dbyrd1568@gmail.com`) with permanent super-admin privileges.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + Lucide Icons
- **Tooling**: Vite 6
- **Backend / Auth / DB**: Supabase (PostgreSQL + RLS + GoTrue)
- **Edge Proxy**: Cloudflare Workers (`caches.default`)
- **Data Providers**: Scryfall REST API + 17Lands Public Telemetry

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm / yarn / pnpm

### Installation

```bash
# Clone or navigate to the repository
git clone https://github.com/dbyrd1568/mtg-limited-iq.git
cd mtg-limited-iq

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build
```

See [`supabase/SETUP_GUIDE.md`](./supabase/SETUP_GUIDE.md) for full Supabase, Google OAuth, and database migration instructions.

---

## License
MIT

