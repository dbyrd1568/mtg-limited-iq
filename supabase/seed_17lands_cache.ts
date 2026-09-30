import dotenv from 'dotenv';
import { HOB_17LANDS_DATA } from '../src/services/hob17LandsData';
import { SOS_17LANDS_DATA } from '../src/services/sos17LandsData';
import { winRateToGradeTier } from '../src/services/seventeenLands';
import { SeventeenLandsCardRating, SeventeenLandsSetData } from '../src/types/mtg';

dotenv.config();

const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = 'irxgoelllogcyoiumxup';

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required in .env');
  process.exit(1);
}

function buildSetData(setCode: string, raw: Record<string, Partial<SeventeenLandsCardRating>>): SeventeenLandsSetData {
  const cards: Record<string, SeventeenLandsCardRating> = {};
  let totalGames = 0;

  Object.entries(raw).forEach(([name, data]) => {
    const wr = data.win_rate || 0.54;
    const games = data.game_count || 6500;
    totalGames += games;
    const cardRating: SeventeenLandsCardRating = {
      name,
      color: data.color || 'C',
      rarity: data.rarity || 'common',
      seen_count: data.seen_count || 3000,
      avg_seen: data.avg_seen || 4.5,
      pick_rate: data.pick_rate || 0.15,
      game_count: games,
      win_rate: wr,
      iwd: data.iwd || 0.015,
      tier_grade: data.tier_grade || winRateToGradeTier(wr),
      card_id: data.card_id ?? data.mtga_id,
      mtga_id: data.mtga_id ?? (typeof data.card_id === 'number' ? data.card_id : undefined),
    };
    cards[name] = cardRating;
    if (name.includes(' // ')) {
      const faceName = name.split(' // ')[0].trim();
      cards[faceName] = cardRating;
    }
  });

  return {
    setCode: setCode.toUpperCase(),
    setName: setCode.toUpperCase(),
    format: 'PremierDraft',
    sampleSize: totalGames > 0 ? totalGames : Object.keys(cards).length * 4000,
    cards,
    updatedAt: new Date().toISOString(),
  };
}

async function seed17LandsCache() {
  const setsToSeed = [
    { code: 'HOB', raw: HOB_17LANDS_DATA },
    { code: 'SOS', raw: SOS_17LANDS_DATA }
  ];

  for (const item of setsToSeed) {
    const dataset = buildSetData(item.code, item.raw);
    const cardCount = Object.keys(dataset.cards).length;
    console.log(`Seeding 17Lands dataset for ${item.code} (${cardCount} cards, ${dataset.total_games} games)...`);

    const query = `
      INSERT INTO public.seventeen_lands_cache (
        set_code, format, sample_size, card_count, dataset, draft_status, is_frozen, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      )
      ON CONFLICT (set_code, format) DO UPDATE SET
        sample_size = EXCLUDED.sample_size,
        card_count = EXCLUDED.card_count,
        dataset = EXCLUDED.dataset,
        draft_status = EXCLUDED.draft_status,
        is_frozen = EXCLUDED.is_frozen,
        updated_at = NOW();
    `;

    // Execute via Supabase Management API
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          INSERT INTO public.seventeen_lands_cache (
            set_code, format, sample_size, card_count, dataset, draft_status, is_frozen, updated_at
          ) VALUES (
            '${item.code}', 'PremierDraft', ${dataset.sampleSize}, ${cardCount}, '${JSON.stringify(dataset).replace(/'/g, "''")}'::jsonb, 'historical', true, NOW()
          )
          ON CONFLICT (set_code, format) DO UPDATE SET
            sample_size = EXCLUDED.sample_size,
            card_count = EXCLUDED.card_count,
            dataset = EXCLUDED.dataset,
            draft_status = EXCLUDED.draft_status,
            is_frozen = EXCLUDED.is_frozen,
            updated_at = NOW();
        `
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Failed to seed ${item.code}:`, errText);
      process.exit(1);
    }

    console.log(`✓ Successfully seeded 17Lands cache for ${item.code}!`);
  }
}

seed17LandsCache().catch((err) => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
