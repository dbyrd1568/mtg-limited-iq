#!/usr/bin/env tsx
/**
 * ==============================================================================
 * PRO CREATOR RATINGS AUTOMATED INGESTION & SCHEDULED SYNC ENGINE
 * ==============================================================================
 * Ingests card tier list ratings from pro creators (LSV, Limited Level Ups,
 * Draftsim) and syncs them to Supabase public.pro_card_ratings.
 *
 * Runs automatically via GitHub Actions (Daily 4:00 AM Central):
 * - Checks sets within pre-release review window (~7-10 days before launch)
 * - Ingests 17Lands tier list data from creator review tierlists
 * - Seamlessly normalizes tiers (A+ to F, SB) to numerical scores and verdicts
 *
 * Supported Creators:
 * - LSV (Luis Scott-Vargas / Limited Resources)
 * - LLU (Limited Level Ups / Alex Nikolic & Marc)
 * - DS (Draftsim / Draftsim.com Set Reviews & Card Ratings)
 *
 * Usage:
 *   npx tsx scripts/sync-pro-ratings.ts                      # Sync all active/upcoming sets
 *   npx tsx scripts/sync-pro-ratings.ts --set FRA            # Sync specific set
 *   npx tsx scripts/sync-pro-ratings.ts --tierlist <id> --source LLU --set FRA
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Automatically load local .env if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {}

const PROJECT_REF = 'irxgoelllogcyoiumxup';
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  `https://${PROJECT_REF}.supabase.co`;

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ACCESS_TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

export type ProCreator = 'LSV' | 'LLU' | 'DS';

export interface CreatorTierListConfig {
  setCode: string;
  source: ProCreator;
  tierListIds: string[]; // In order of precedence (first takes priority)
  notes?: string;
}

// Registry of known creator tier lists on 17Lands
export const KNOWN_CREATOR_TIERLISTS: CreatorTierListConfig[] = [
  // --- Limited Level Ups (LLU / Alex Nikolic & Marc - sourced from limitedlevelups.com) ---
  {
    setCode: 'FRA',
    source: 'LLU',
    tierListIds: ['643f4ffbcde34632adca80bce7fdcdd9', '24d7fb5b20194808834be19680ae0d8d', 'e95fd9365a86464cae2451e34c39102a'],
    notes: 'LLU Reality Fracture Tier List'
  },
  {
    setCode: 'HOB',
    source: 'LLU',
    tierListIds: ['528d1c45d1f04b59abac2a897a8928c8'],
    notes: 'LLU The Hobbit Tier List'
  },
  {
    setCode: 'MSH',
    source: 'LLU',
    tierListIds: ['1c86af8656f7432c83d9f9bb9c92f9df', 'b07c077b8c8145288f75d71bf4f90d65', 'e0c4c50e90914ac390a1f792e0717ed2'],
    notes: 'LLU Marvel Super Heroes Tier List'
  },
  {
    setCode: 'SOS',
    source: 'LLU',
    tierListIds: ['e195401b1eaa48e3b5d6670e0ae338e9', '3dda4b67b4b0403caeb0a744887b0208', '09ccc33bf4d6461f9c73de01bd8efe0c'],
    notes: 'LLU Secrets of Strixhaven Tier List'
  },
  {
    setCode: 'TMT',
    source: 'LLU',
    tierListIds: ['fd5499ae88854ca0ac1bc2ad95ade9b2', 'c1489602e3d544d9aa90718692f16a32', 'a8a502ee50d84a31b6a501bb6b4d5920'],
    notes: 'LLU TMNT Tier List'
  },
  {
    setCode: 'ECL',
    source: 'LLU',
    tierListIds: ['1745e64176864bb2bec132cbd601b604', '4f09f4891cc148f0bb7afe510d4605ec', '0fef073a7db5401ba7e260e8649f2bea'],
    notes: 'LLU Lorwyn Eclipsed Tier List'
  },
  {
    setCode: 'TLA',
    source: 'LLU',
    tierListIds: ['efdfa8408fb448be846ac06f9d9192ff', '6554520225504ef9a3d5360c062a8274', '10ab962ac03b4774b7cd2cb8bec152af'],
    notes: 'LLU Avatar: The Last Airbender Tier List'
  },
  {
    setCode: 'SPM',
    source: 'LLU',
    tierListIds: ['4f9e6dc9c48c4052805dcfa65568c964', '78638999335b4900b961503d6f58c4a9', '796eb012eb3b4081929da9679ea577d0'],
    notes: 'LLU Spider-Man Tier List'
  },
  {
    setCode: 'EOE',
    source: 'LLU',
    tierListIds: ['4f34ccc070464c6c90f85c78972ee6ac', '13384ec719b74936b0c700126469a22a', '969006b0242e4ab4bfd9b85e3fe4c73e'],
    notes: 'LLU Edge of Eternities Tier List'
  },
  {
    setCode: 'FIN',
    source: 'LLU',
    tierListIds: ['90be207ac0e34b8ea20ae396c434cbae', '9f907d1c51834c4696383aa30f65523a', '35157ab6c45a48a2aabc92853e389af3'],
    notes: 'LLU Final Fantasy Tier List'
  },
  {
    setCode: 'TDM',
    source: 'LLU',
    tierListIds: ['dd9c5b6db6b94ce0bbf3fd285625ceb9', 'b13d129e71b8467dab4de66f770c6b10', 'bb8970942c3d4e42bd0fe91528befada'],
    notes: 'LLU Tarkir: Dragonstorm Tier List'
  },
  {
    setCode: 'DFT',
    source: 'LLU',
    tierListIds: ['b0f9dbffd24843d5b8b693f30bc8b1e9'],
    notes: 'LLU Aetherdrift Tier List'
  },
  {
    setCode: 'FDN',
    source: 'LLU',
    tierListIds: ['597d29e75d704ecf9877fc0e4b2c4116'],
    notes: 'LLU Foundations Tier List'
  },
  {
    setCode: 'DSK',
    source: 'LLU',
    tierListIds: ['edec3f514f264753bf4a46a8a2fc7d82'],
    notes: 'LLU Duskmourn Tier List'
  },
  {
    setCode: 'BLB',
    source: 'LLU',
    tierListIds: ['6057e51272c94a7cb304bd511b7c3bcf'],
    notes: 'LLU Bloomburrow Tier List'
  },
  {
    setCode: 'MH3',
    source: 'LLU',
    tierListIds: ['14b36e19f924475fb93badb9268174a4'],
    notes: 'LLU Modern Horizons 3 Tier List'
  },
  {
    setCode: 'OTJ',
    source: 'LLU',
    tierListIds: ['df75c79fba154f21b4a8bf751b8aa0a4', '317fe1336cac48c8b3a2d731a844ccbe'],
    notes: 'LLU Outlaws of Thunder Junction Tier List'
  },
  {
    setCode: 'WOE',
    source: 'LLU',
    tierListIds: ['87b40a05e0974eafa368be44e1d3e0c4'],
    notes: 'LLU Wilds of Eldraine Tier List'
  },
  {
    setCode: 'MOM',
    source: 'LLU',
    tierListIds: ['a7daeb6a90b246e895c8634e34734090'],
    notes: 'LLU March of the Machine Tier List'
  },
  {
    setCode: 'VOW',
    source: 'LLU',
    tierListIds: ['ac2ca9722737412ba0c4c4c4b2e28598'],
    notes: 'LLU Innistrad: Crimson Vow Tier List'
  },
  {
    setCode: 'STX',
    source: 'LLU',
    tierListIds: ['a2753035da8646038f55b7321de1dfc9'],
    notes: 'LLU Strixhaven Tier List'
  },
  {
    setCode: 'PIO',
    source: 'LLU',
    tierListIds: ['22b77386e0354d84827e732c226ebc91'],
    notes: 'LLU Pioneer Masters Tier List'
  },
  {
    setCode: 'MKM',
    source: 'LLU',
    tierListIds: ['a5c17edddaea4680a28126dae2a5178f'],
    notes: 'LLU Murders at Karlov Manor Tier List'
  },
  {
    setCode: 'LCI',
    source: 'LLU',
    tierListIds: ['b8dad7059ff24da28da636a1c50da7e8'],
    notes: 'LLU Lost Caverns of Ixalan Tier List'
  },
  {
    setCode: 'LTR',
    source: 'LLU',
    tierListIds: ['aa685e825b12489a83f081dec8dc308d'],
    notes: 'LLU The Lord of the Rings Tier List'
  },
  {
    setCode: 'ONE',
    source: 'LLU',
    tierListIds: ['959517c42af04b909ddb6456904b7001'],
    notes: 'LLU Phyrexia: All Will Be One Tier List'
  },
  {
    setCode: 'BRO',
    source: 'LLU',
    tierListIds: ['b8d4ba9d1bad49828bfa6371f6b4f09b'],
    notes: 'LLU The Brothers War Tier List'
  },
  {
    setCode: 'DMU',
    source: 'LLU',
    tierListIds: ['e12ee0b1fadc4ab7b8de4c3730878a90'],
    notes: 'LLU Dominaria United Tier List'
  },
  {
    setCode: 'HBG',
    source: 'LLU',
    tierListIds: ['d24c2d28b6aa4146912b2ca92c503fe1'],
    notes: 'LLU Baldurs Gate Tier List'
  },
  {
    setCode: 'SNC',
    source: 'LLU',
    tierListIds: ['8513f3fa48f140c0a4792862f530dea9'],
    notes: 'LLU Streets of New Capenna Tier List'
  },
  {
    setCode: 'NEO',
    source: 'LLU',
    tierListIds: ['0b2b04f23e104ddba3501cd009385d60'],
    notes: 'LLU Kamigawa: Neon Dynasty Tier List'
  },
  {
    setCode: 'MID',
    source: 'LLU',
    tierListIds: ['ef928c7c17bb4f57b09a75be5daf7df9'],
    notes: 'LLU Innistrad: Midnight Hunt Tier List'
  },
  {
    setCode: 'AFR',
    source: 'LLU',
    tierListIds: ['1d901171375f4cff9834c751667c4254'],
    notes: 'LLU Adventures in the Forgotten Realms Tier List'
  },
  {
    setCode: 'IKO',
    source: 'LLU',
    tierListIds: ['db593297907e41af93eedd994e26da28'],
    notes: 'LLU Ikoria Tier List'
  },
  {
    setCode: 'ELD',
    source: 'LLU',
    tierListIds: ['30588ade239246d0ab12393d00dc801a'],
    notes: 'LLU Throne of Eldraine Tier List'
  },
  {
    setCode: 'KTK',
    source: 'LLU',
    tierListIds: ['a6346d2850ef45918508db61d057388e'],
    notes: 'LLU Khans of Tarkir Tier List'
  },

  // --- Draftsim (DS / Draftsim.com reviews and tierlists) ---
  // Future scraped tier list configs can be registered here
];

export interface ParsedProRating {
  setCode: string;
  cardName: string;
  source: ProCreator;
  score: number;
  grade: string;
  verdict: string;
  notes?: string;
}

/**
 * Maps standard 17Lands tier letters to score and GradeTier
 */
export function parseTierToRating(rawTier: string): { grade: string; score: number; verdict: string } {
  const tier = rawTier.trim().toUpperCase();
  switch (tier) {
    case 'A+': return { grade: 'A+', score: 4.8, verdict: 'Bomb' };
    case 'A':  return { grade: 'A',  score: 4.5, verdict: 'Bomb' };
    case 'A-': return { grade: 'A-', score: 4.0, verdict: 'Bomb' };
    case 'B+': return { grade: 'B+', score: 3.5, verdict: 'High Pick' };
    case 'B':  return { grade: 'B',  score: 3.0, verdict: 'High Pick' };
    case 'B-': return { grade: 'B-', score: 2.5, verdict: 'High Pick' };
    case 'C+': return { grade: 'C+', score: 2.0, verdict: 'Solid Playable' };
    case 'C':  return { grade: 'C',  score: 1.5, verdict: 'Playable' };
    case 'C-': return { grade: 'C-', score: 1.0, verdict: 'Filler' };
    case 'D+': return { grade: 'D',  score: 0.8, verdict: 'Marginal' };
    case 'D':  return { grade: 'D',  score: 0.5, verdict: 'D-Tier' };
    case 'D-': return { grade: 'D',  score: 0.3, verdict: 'Poor' };
    case 'F':  return { grade: 'F',  score: 0.0, verdict: 'Unplayable' };
    case 'SB': return { grade: 'C-', score: 1.0, verdict: 'Sideboard' };
    default:   return { grade: 'C',  score: 1.5, verdict: 'Playable' };
  }
}

/**
 * Fetches a tier list JSON from 17Lands API
 */
async function fetchTierList(tierListId: string): Promise<any> {
  const url = `https://www.17lands.com/data/tier_list/${tierListId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch 17Lands tier list ${tierListId}: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Executes SQL directly via Supabase Management API or service role key
 */
async function upsertProRatings(ratings: ParsedProRating[]): Promise<number> {
  if (ratings.length === 0) return 0;

  // Option A: Use Supabase Service Role Key (preferred in GitHub Actions)
  if (SUPABASE_SERVICE_ROLE_KEY) {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const batchSize = 100;
    let upserted = 0;

    for (let i = 0; i < ratings.length; i += batchSize) {
      const chunk = ratings.slice(i, i + batchSize).map(r => ({
        set_code: r.setCode,
        card_name: r.cardName,
        source: r.source,
        score: r.score,
        grade: r.grade,
        verdict: r.verdict,
        notes: r.notes || null,
        updated_at: new Date().toISOString()
      }));

      const { error } = await sb
        .from('pro_card_ratings')
        .upsert(chunk, { onConflict: 'set_code,card_name,source' });

      if (error) {
        throw new Error(`Supabase upsert error: ${error.message}`);
      }
      upserted += chunk.length;
    }
    return upserted;
  }

  // Option B: Use Supabase Management API Token (local CLI or CI fallback)
  if (SUPABASE_ACCESS_TOKEN) {
    const batchSize = 100;
    let upserted = 0;

    for (let i = 0; i < ratings.length; i += batchSize) {
      const chunk = ratings.slice(i, i + batchSize);
      const values = chunk.map(r => {
        const esc = (s: string) => s.replace(/'/g, "''");
        const notesVal = r.notes ? `'${esc(r.notes)}'` : 'NULL';
        return `('${esc(r.setCode)}', '${esc(r.cardName)}', '${esc(r.source)}', ${r.score}, '${esc(r.grade)}', '${esc(r.verdict)}', ${notesVal})`;
      }).join(',\n');

      const sql = `
        INSERT INTO public.pro_card_ratings (set_code, card_name, source, score, grade, verdict, notes)
        VALUES ${values}
        ON CONFLICT (set_code, card_name, source) DO UPDATE
        SET
          score = excluded.score,
          grade = excluded.grade,
          verdict = excluded.verdict,
          notes = COALESCE(excluded.notes, public.pro_card_ratings.notes),
          updated_at = timezone('utc'::text, now());
      `;

      const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Management API query error (${res.status}): ${text}`);
      }
      upserted += chunk.length;
    }
    return upserted;
  }

  throw new Error('Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ACCESS_TOKEN is configured!');
}

export function lsvScoreToRating(score: number): { grade: string; score: number; verdict: string } {
  let grade = 'F';
  if (score >= 4.8) grade = 'A+';
  else if (score >= 4.5) grade = 'A';
  else if (score >= 4.0) grade = 'A-';
  else if (score >= 3.5) grade = 'B+';
  else if (score >= 3.0) grade = 'B';
  else if (score >= 2.5) grade = 'B-';
  else if (score >= 2.0) grade = 'C+';
  else if (score >= 1.5) grade = 'C';
  else if (score >= 1.0) grade = 'C-';
  else if (score >= 0.5) grade = 'D';

  let verdict = 'Unplayable';
  if (score >= 4.5) verdict = 'Bomb';
  else if (score >= 3.5) verdict = 'High Pick';
  else if (score >= 2.5) verdict = 'Solid Playable';
  else if (score >= 1.5) verdict = 'Playable';
  else if (score >= 1.0) verdict = 'Filler';
  else if (score >= 0.5) verdict = 'Marginal';

  return { grade, score, verdict };
}

export const LSV_TCGPLAYER_SETS = [
  { match: /Bloomburrow/i, setCode: 'BLB' },
  { match: /Duskmourn/i, setCode: 'DSK' },
  { match: /Foundations/i, setCode: 'FDN' },
  { match: /Modern Horizons 3/i, setCode: 'MH3' },
  { match: /Thunder Junction/i, setCode: 'OTJ' },
  { match: /Murders at Karlov Manor|MKM/i, setCode: 'MKM' },
  { match: /Lost Caverns of Ixalan/i, setCode: 'LCI' },
  { match: /Wilds of Eldraine/i, setCode: 'WOE' },
  { match: /Lord of the Rings/i, setCode: 'LTR' },
  { match: /March of the Machine/i, setCode: 'MOM' },
  { match: /Phyrexia: All Will Be One/i, setCode: 'ONE' },
  { match: /The Brothers' War/i, setCode: 'BRO' },
  { match: /Dominaria United/i, setCode: 'DMU' },
  { match: /New Capenna/i, setCode: 'SNC' },
  { match: /Kamigawa: Neon Dynasty/i, setCode: 'NEO' },
  { match: /Crimson Vow/i, setCode: 'VOW' },
  { match: /Midnight Hunt/i, setCode: 'MID' },
  { match: /Forgotten Realms/i, setCode: 'AFR' },
  { match: /Strixhaven/i, setCode: 'STX' },
  { match: /Kaldheim/i, setCode: 'KHM' },
  { match: /Edge of Eternities/i, setCode: 'EOE' },
  { match: /FINAL FANTASY/i, setCode: 'FIN' },
  { match: /Tarkir: Dragonstorm/i, setCode: 'TDM' },
  { match: /Lorwyn Eclipsed/i, setCode: 'ECL' },
  { match: /Avatar: The Last Airbender/i, setCode: 'TLA' },
  { match: /Spider-Man/i, setCode: 'SPM' },
  { match: /Marvel Super Heroes/i, setCode: 'MSH' },
];

export const LSV_COMMUNITY_SHEETS = [
  {
    setCode: 'WAR',
    url: 'https://docs.google.com/spreadsheets/d/1lOJVk23R0TwvoayMCv1cjLku0I7zdsrkyWkbgNGLQEM/export?format=csv'
  },
  {
    setCode: 'RNA',
    url: 'https://docs.google.com/spreadsheets/d/1QBn-wQy3arGTtyekA8Wa9N93zcghDVeIfcdybWPdeG8/export?format=csv'
  }
];

function parseLsvArticleBody(body: string): { cardName: string; score: number; notes?: string }[] {
  const cards: { cardName: string; score: number; notes?: string }[] = [];
  const parts = body.split(/<card-spotlight\s+card-id=\"|<card-showcase\s+ids=\"|<h3[^>]*>/i);
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    let cardName = '';
    const q = part.indexOf('\"');
    const t = part.indexOf('<');
    if (q !== -1 && (t === -1 || q < t)) cardName = part.slice(0, q).trim();
    else if (t !== -1) cardName = part.slice(0, t).trim();
    if (!cardName || cardName.length > 50) continue;
    if (['Pack Rat', 'Writhing Chrysalis', 'Ocelot Pride'].includes(cardName)) continue;
    if (['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless', 'Artifacts', 'Lands', 'Multicolor'].includes(cardName)) continue;

    const sm = part.slice(0, 500).match(/Limited:[\s\S]*?(\d+(?:\.\d+)?)/i);
    if (sm) {
      const score = parseFloat(sm[1]);
      if (score >= 0 && score <= 5.0) {
        const commentMatch = part.slice(0, 1000).match(/Limited:[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/i);
        const notes = commentMatch ? commentMatch[1].replace(/<[^>]+>/g, '').trim() : undefined;
        cards.push({ cardName, score, notes: notes ? notes.slice(0, 250) : undefined });
      }
    }
  }
  return cards;
}

async function syncLsvRatings(targetSet?: string | null): Promise<void> {
  console.log('\n🎙️ Starting LSV (ChannelFireball / TCGplayer & Community Reviews) Sync...');

  // 1. Ingest TCGplayer Infinite articles
  const setsToIngest = LSV_TCGPLAYER_SETS.filter(s => !targetSet || s.setCode === targetSet);
  if (setsToIngest.length > 0) {
    const articlesBySet = new Map<string, { title: string; uuid: string }[]>();
    for (const s of setsToIngest) articlesBySet.set(s.setCode, []);

    const authors = ['Luis Scott-Vargas', 'Martin Juza', 'Reid Duke'];
    for (const author of authors) {
      for (let offset = 0; offset < 850; offset += 48) {
        try {
          const res = await fetch(`https://infinite-api.tcgplayer.com/content/search?author=${encodeURIComponent(author)}&offset=${offset}`);
          const data = await res.json();
          if (!data.result || data.result.length === 0) break;
          for (const a of data.result) {
            if (!a.title || (!a.title.includes('Limited Set Review') && !a.title.includes('Limited MTG Set Review'))) continue;
            for (const s of setsToIngest) {
              if (s.match.test(a.title)) {
                const list = articlesBySet.get(s.setCode);
                if (list && !list.some(x => x.uuid === a.uuid)) list.push(a);
                break;
              }
            }
          }
        } catch (e) {}
      }
    }

    for (const [setCode, arts] of articlesBySet.entries()) {
      if (arts.length === 0) continue;
      console.log(`\n📋 Processing [LSV] for Set [${setCode}] from ${arts.length} CFB review articles...`);
      const cardMap = new Map<string, ParsedProRating>();

      for (const art of arts) {
        try {
          const r = await fetch(`https://infinite-api.tcgplayer.com/content/article/${art.uuid}`);
          const d = await r.json();
          const b = d.result?.article?.body || '';
          const parsed = parseLsvArticleBody(b);
          for (const c of parsed) {
            const { grade, score, verdict } = lsvScoreToRating(c.score);
            cardMap.set(c.cardName, {
              setCode,
              cardName: c.cardName,
              source: 'LSV',
              score,
              grade,
              verdict,
              notes: c.notes
            });
          }
        } catch (err: any) {
          console.warn(`  ⚠️ Failed to fetch LSV article ${art.uuid}: ${err.message}`);
        }
      }

      const uniqueRatings = Array.from(cardMap.values());
      console.log(`  ⭐ Prepared ${uniqueRatings.length} unique card ratings for ${setCode} (LSV).`);
      if (uniqueRatings.length > 0) {
        const count = await upsertProRatings(uniqueRatings);
        console.log(`  ✅ Successfully saved ${count} ratings for ${setCode} (LSV)!`);
      }
    }
  }

  // 2. Ingest Community Sheets (WAR, RNA)
  const sheetsToRun = LSV_COMMUNITY_SHEETS.filter(s => !targetSet || s.setCode === targetSet);
  for (const sheet of sheetsToRun) {
    try {
      console.log(`\n📋 Processing [LSV] for Set [${sheet.setCode}] from community review spreadsheet...`);
      const res = await fetch(sheet.url);
      const text = await res.text();
      const lines = text.split('\n');
      const cardMap = new Map<string, ParsedProRating>();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(\d+),(\"[^\"]+\"|[^,]+),[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,\"?[^\",]*\"?,(\"[^\"]+\"|[^,]*)/);
        if (match) {
          const cardName = match[2].replace(/^\"|\"$/g, '').trim();
          let rawGrade = match[3].replace(/^\"|\"$/g, '').trim();
          if (rawGrade.includes('/')) rawGrade = rawGrade.split('/')[0].trim();
          if (rawGrade.toLowerCase().startsWith('build')) rawGrade = rawGrade.replace(/build\s*/i, '').trim();
          if (!cardName || !rawGrade || rawGrade === '-' || rawGrade === 'Sideboard') continue;

          const { grade, score, verdict } = parseTierToRating(rawGrade);
          cardMap.set(cardName, {
            setCode: sheet.setCode,
            cardName,
            source: 'LSV',
            score,
            grade,
            verdict
          });
        }
      }

      const uniqueRatings = Array.from(cardMap.values());
      console.log(`  ⭐ Prepared ${uniqueRatings.length} unique card ratings for ${sheet.setCode} (LSV).`);
      if (uniqueRatings.length > 0) {
        const count = await upsertProRatings(uniqueRatings);
        console.log(`  ✅ Successfully saved ${count} ratings for ${sheet.setCode} (LSV)!`);
      }
    } catch (e: any) {
      console.warn(`  ⚠️ Failed to ingest community sheet for ${sheet.setCode}: ${e.message}`);
    }
  }
}

/**
 * Main ingestion flow
 */
async function main() {
  const args = process.argv.slice(2);
  let targetSet: string | null = null;
  let customTierlistId: string | null = null;
  let customSource: ProCreator | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--set' && args[i + 1]) {
      targetSet = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--tierlist' && args[i + 1]) {
      customTierlistId = args[i + 1];
      i++;
    } else if (args[i] === '--source' && args[i + 1]) {
      customSource = args[i + 1].toUpperCase() as ProCreator;
      i++;
    } else if (!args[i].startsWith('-')) {
      targetSet = args[i].toUpperCase();
    }
  }

  console.log('🎙️ Starting Pro Creator Ratings Ingestion...');

  // If specific creator tier lists (LLU or LOL) are requested or running all
  if (!customSource || customSource === 'LLU' || customSource === 'LOL') {
    const configsToRun: CreatorTierListConfig[] = [];

    if (customTierlistId && targetSet) {
      configsToRun.push({
        setCode: targetSet,
        source: customSource || 'LLU',
        tierListIds: [customTierlistId],
        notes: `Custom run for ${targetSet} from ${customSource || 'LLU'}`
      });
    } else {
      for (const cfg of KNOWN_CREATOR_TIERLISTS) {
        if ((!targetSet || cfg.setCode === targetSet) && (!customSource || cfg.source === customSource)) {
          configsToRun.push(cfg);
        }
      }
    }

    for (const config of configsToRun) {
      console.log(`\n📋 Processing [${config.source}] for Set [${config.setCode}]...`);
      const cardMap = new Map<string, ParsedProRating>();

      // Process tier list IDs in reverse so earlier in array overrides later
      const reversedIds = [...config.tierListIds].reverse();
      for (const tId of reversedIds) {
        try {
          console.log(`  Fetching 17Lands tier list: ${tId}...`);
          const data = await fetchTierList(tId);
          const listName = data.name || tId;
          const ratingsArray = Array.isArray(data.ratings) ? data.ratings : [];
          console.log(`  → Found "${listName}" with ${ratingsArray.length} items.`);

          for (const item of ratingsArray) {
            if (!item.name || !item.tier || item.tier === 'TBD') continue;
            const cardName = item.name.trim();
            const { grade, score, verdict } = parseTierToRating(item.tier);

            cardMap.set(cardName, {
              setCode: config.setCode,
              cardName,
              source: config.source,
              score,
              grade,
              verdict,
              notes: item.comment ? item.comment.trim() : undefined
            });
          }
        } catch (err: any) {
          console.error(`  ⚠️ Warning: failed to fetch tierlist ${tId}:`, err.message);
        }
      }

      const uniqueRatings = Array.from(cardMap.values());
      console.log(`  ⭐ Prepared ${uniqueRatings.length} unique card ratings for ${config.setCode} (${config.source}).`);

      if (uniqueRatings.length > 0) {
        console.log(`  Writing ratings to Supabase pro_card_ratings table...`);
        const count = await upsertProRatings(uniqueRatings);
        console.log(`  ✅ Successfully saved ${count} ratings for ${config.setCode} (${config.source})!`);
      }
    }
  }

  // If LSV requested or running all
  if (!customSource || customSource === 'LSV') {
    await syncLsvRatings(targetSet);
  }

  console.log('\n🎉 Pro Creator Ratings Sync completed successfully!');
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal error during pro ratings sync:', err);
    process.exit(1);
  });
}

