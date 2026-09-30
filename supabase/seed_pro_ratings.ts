import dotenv from 'dotenv';
import { HOB_LSV_DATA } from '../src/services/hobLsvData';
import { SOS_LSV_DATA } from '../src/services/sosLsvData';
import { ECL_LSV_DATA } from '../src/services/eclLsvData';
import { lsvScoreToGradeTier } from '../src/services/lsvRatings';

dotenv.config();

const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = 'irxgoelllogcyoiumxup';

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required in .env');
  process.exit(1);
}

const OTHER_SETS: Record<string, Record<string, number>> = {
  'BLB': {
    'Heartfire Hero': 4.0,
    'Fell': 4.0,
    'Might of the Meek': 3.0,
    'Warren Warleader': 4.5,
    'Seedgale Foster': 2.0,
    'Shore Up': 2.5,
    'Gev, Scaled Scorch': 4.0,
    'Agate Blade Assassin': 2.5,
    'Baker\'s Bane Beastie': 2.0,
    'Bonebind Orator': 3.0,
    'Brambleguard Veteran': 3.5,
    'Builder\'s Talent': 3.5,
    'Carrot Cake': 3.0,
    'Crumb and Get It': 2.5,
    'Daggerfang Duo': 2.0,
    'Daring Waverider': 2.5,
    'Early Winter': 1.5,
    'Finneas, Ace Archer': 4.0,
    'Head of the Homestead': 3.0,
    'Huskburster Swarm': 3.5,
    'Into the Flood Maw': 3.5,
    'Kastral, the Windcrested': 4.5,
    'Long River\'s Pull': 3.0,
    'Mindwhisker': 2.5,
    'Osteomancer Adept': 4.0,
    'Patchwork Banner': 3.5,
    'Playful Shove': 2.5,
    'Polliwallop': 3.0,
    'Quirion Beastcaller': 4.0,
    'Rabid Gnaw': 3.5,
    'Sunspine Lynx': 3.0,
    'Take Out the Trash': 3.5,
    'Treeguard Duo': 3.0,
    'Valley Questcaller': 4.0,
    'Vinereap Mentor': 3.5,
    'Wandertale Mentor': 3.5,
    'Wax-Wane Witness': 2.5,
    'Wreaking Havoc': 1.5,
    'Ygra, Eater of All': 4.5,
  },
  'STX': {
    'Expressive Iteration': 4.0,
    'Rip Apart': 3.5,
    'Killian, Ink Duelist': 4.0,
    'Dina, Soul Steeper': 3.5,
    'Quandrix Apprentice': 3.5,
    'Professor Onyx': 4.5,
    'Mila, Crafty Companion // Lukka, Wayward Bonder': 4.0,
    'Beledros Witherbloom': 4.5,
    'Galazeth Prismari': 4.5,
    'Shadrix Silverquill': 4.5,
    'Tanazir Quandrix': 4.5,
    'Velomachus Lorehold': 4.5,
  },
  'OTJ': {
    'Railway Brawler': 5.0,
    'Vault Plunderer': 3.5,
    'Throwing Knife': 3.5,
    'Mystic Confluence': 4.5,
    'Holy Cow': 3.0,
    'Take the Fall': 2.5,
    'Desert\'s Due': 3.5,
    'Consuming Ashes': 3.5,
    'Geyser Drake': 3.0,
  },
  'FRA': {
    'Konstrari Improviser // Soul Tether': 3.0,
    'Woodwork Prodigy // Soul Tether': 3.5,
    'Puppet Crafting': 3.5,
    'Hungering Puppetbeast': 4.0,
    'Tenured Tethermage': 3.5,
    'Puppet Infestation': 4.0,
    'Heartwood Harvester': 3.5,
    'Gideon\'s Memorial': 3.5,
    'Precise Redaction': 3.5,
    'Sphinx\'s Approach': 3.5,
    'Ghalta the Immovable': 4.5,
    'Plan for All Outcomes': 3.0,
  }
};

interface ProRatingRow {
  set_code: string;
  card_name: string;
  source: string;
  score: number;
  grade: string;
  verdict: string;
}

const rows: ProRatingRow[] = [];

function addSet(setCode: string, dict: Record<string, number>) {
  for (const [name, score] of Object.entries(dict)) {
    const grade = lsvScoreToGradeTier(score);
    const verdict = score >= 4.5 ? 'Bomb' : score >= 3.5 ? 'High Pick' : score >= 2.5 ? 'Solid Playable' : score >= 1.5 ? 'Filler' : 'Unplayable';
    rows.push({
      set_code: setCode,
      card_name: name,
      source: 'LSV',
      score,
      grade,
      verdict
    });
  }
}

addSet('HOB', HOB_LSV_DATA);
addSet('SOS', SOS_LSV_DATA);
addSet('ECL', ECL_LSV_DATA);
for (const [set, dict] of Object.entries(OTHER_SETS)) {
  addSet(set, dict);
}

console.log(`Prepared ${rows.length} LSV card ratings across ${new Set(rows.map(r => r.set_code)).size} sets.`);

async function executeSql(sql: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Management API error (${res.status}): ${text}`);
  }
}

async function seed() {
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const values = chunk.map(r => {
      const esc = (s: string) => s.replace(/'/g, "''");
      return `('${esc(r.set_code)}', '${esc(r.card_name)}', '${esc(r.source)}', ${r.score}, '${esc(r.grade)}', '${esc(r.verdict)}')`;
    }).join(',\n');

    const sql = `
      INSERT INTO public.pro_card_ratings (set_code, card_name, source, score, grade, verdict)
      VALUES ${values}
      ON CONFLICT (set_code, card_name, source) DO UPDATE
      SET
        score = excluded.score,
        grade = excluded.grade,
        verdict = excluded.verdict,
        updated_at = timezone('utc'::text, now());
    `;

    console.log(`Seeding batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(rows.length / batchSize)} (${chunk.length} cards)...`);
    await executeSql(sql);
  }

  console.log('🎉 Successfully seeded all pro card ratings into Supabase!');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
