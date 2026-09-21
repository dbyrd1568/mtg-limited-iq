# Critical Operational Directives

## 1. NEVER GUESS NAMES, SET CODES, OR IDENTIFIERS — LOOK THEM UP EVERY TIME
- **Zero Hallucination / Guessing Policy**: Never guess, assume, or reconstruct names, set names, card names, mechanic names, expansion codes, or data identifiers from memory or intuition.
- **Always Look Up in Canonical Sources**:
  - For Magic: The Gathering sets and cards, look up the code or name **every single time** using:
    - In-repo sources: `src/services/scryfall.ts` (`SUPPORTED_SETS`), `src/services/sos17LandsData.ts`, `HISTORICAL_BENCHMARK_CARDS`, `BENCHMARK_17LANDS_CARDS`, etc.
    - External APIs: Scryfall API (`https://api.scryfall.com/sets/<code>`, `https://api.scryfall.com/cards/search?q=...`) or 17Lands data endpoints.
  - Example: `SOS` is strictly **Secrets of Strixhaven** (never guess or invent names like "Scars of Sorrow").
- If an unfamiliar or ambiguous set code, card name, or mechanic is encountered, search the codebase (`grep_search`, `find_by_name`) or query the API before outputting or using it in code, tests, documentation, or user communication.

## 2. STRICT ACCURACY FOR CARD DATA
- When creating mock objects, test fixtures, or benchmark entries:
  - Exact spelling of card names and set names.
  - Exact mana cost, CMC, types, subtypes, rarity, and power/toughness.
  - Exact word-for-word Oracle text from Scryfall.
