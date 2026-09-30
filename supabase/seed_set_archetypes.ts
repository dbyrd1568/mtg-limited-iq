import dotenv from 'dotenv';
import { SET_WOTC_ARCHETYPES, GUILD_ARCHETYPES, WOTCArchetypeInfo } from '../src/services/wotcArchetypes';
import { EXPANDED_SET_WOTC_ARCHETYPES } from '../src/services/wotcArchetypeData';

dotenv.config();

const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = 'irxgoelllogcyoiumxup';

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required in .env');
  process.exit(1);
}

interface ArchetypeRow {
  set_code: string;
  color_pair: string;
  name: string;
  guild_name: string;
  headline: string;
  description: string;
  mechanics: string[];
  pace: string;
  draft_pointers: string[];
  key_commons: string[];
}

function gatherAllArchetypes(): ArchetypeRow[] {
  const merged: Record<string, Record<string, WOTCArchetypeInfo>> = {};

  // 1. Ingest from SET_WOTC_ARCHETYPES
  for (const [setCode, pairs] of Object.entries(SET_WOTC_ARCHETYPES)) {
    const upper = setCode.toUpperCase().trim();
    merged[upper] = { ...merged[upper], ...pairs };
  }

  // 2. Ingest from EXPANDED_SET_WOTC_ARCHETYPES (higher or complementary priority)
  for (const [setCode, pairs] of Object.entries(EXPANDED_SET_WOTC_ARCHETYPES)) {
    const upper = setCode.toUpperCase().trim();
    merged[upper] = { ...merged[upper], ...pairs };
  }

  const rows: ArchetypeRow[] = [];

  for (const [setCode, pairs] of Object.entries(merged)) {
    for (const [colorPair, info] of Object.entries(pairs)) {
      const pairUpper = colorPair.toUpperCase().trim();
      const guild = GUILD_ARCHETYPES.find((g) => g.code === pairUpper);
      rows.push({
        set_code: setCode.toUpperCase(),
        color_pair: pairUpper,
        name: info.name || guild?.name || pairUpper,
        guild_name: info.guildName || guild?.name || pairUpper,
        headline: info.headline || `${guild?.defaultTheme || 'Draft Synergy'}`,
        description: info.description || `${pairUpper} focuses on core color pair synergies and tempo.`,
        mechanics: info.mechanics || ['Combat', 'Synergy'],
        pace: info.pace || 'Midrange',
        draft_pointers: info.draftPointers || [],
        key_commons: info.keyCommons || [],
      });
    }
  }

  return rows;
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

async function seedSetArchetypes() {
  const allRows = gatherAllArchetypes();
  console.log(`Total archetypes gathered across all sets: ${allRows.length}`);

  const BATCH_SIZE = 50;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const valueTuples = batch.map((r) => {
      const mechanicsJson = JSON.stringify(r.mechanics);
      const pointersJson = JSON.stringify(r.draft_pointers);
      const commonsJson = JSON.stringify(r.key_commons);

      return `(
        '${r.set_code}',
        '${r.color_pair}',
        '${escapeSql(r.name)}',
        '${escapeSql(r.guild_name)}',
        '${escapeSql(r.headline)}',
        '${escapeSql(r.description)}',
        '${escapeSql(mechanicsJson)}'::jsonb,
        '${escapeSql(r.pace)}',
        '${escapeSql(pointersJson)}'::jsonb,
        '${escapeSql(commonsJson)}'::jsonb,
        NOW(),
        NOW()
      )`;
    }).join(',\n');

    const sql = `
      INSERT INTO public.set_archetypes (
        set_code, color_pair, name, guild_name, headline, description,
        mechanics, pace, draft_pointers, key_commons, created_at, updated_at
      ) VALUES
      ${valueTuples}
      ON CONFLICT (set_code, color_pair) DO UPDATE SET
        name = EXCLUDED.name,
        guild_name = EXCLUDED.guild_name,
        headline = EXCLUDED.headline,
        description = EXCLUDED.description,
        mechanics = EXCLUDED.mechanics,
        pace = EXCLUDED.pace,
        draft_pointers = EXCLUDED.draft_pointers,
        key_commons = EXCLUDED.key_commons,
        updated_at = NOW();
    `;

    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, err);
      process.exit(1);
    }

    console.log(`Seeded batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(allRows.length / BATCH_SIZE)} (${batch.length} archetypes)...`);
  }

  console.log('🎉 Successfully seeded all set archetypes into Supabase!');
}

seedSetArchetypes().catch((err) => {
  console.error('Fatal error seeding set archetypes:', err);
  process.exit(1);
});
