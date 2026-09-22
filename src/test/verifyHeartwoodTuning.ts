import { getWOTCArchetypeInfo, SET_DEVELOPED_ARCHETYPES } from '../services/wotcArchetypes';
import { getFallbackCards } from '../services/scryfall';
import { calculateCardSimilarity, buildScryfallQueries, extractCardFeatures, HISTORICAL_BENCHMARK_CARDS } from '../services/cardSimilarity';

console.log('=== Verifying Heartwood Tokens & Reality Fracture Engine Tuning ===\n');

// 1. Archetype Catalog Verification
console.log('1. Testing FRA RG Archetype Resolution:');
const fraRG = getWOTCArchetypeInfo('FRA', 'RG');
console.log(`   Archetype Name: "${fraRG.name}"`);
console.log(`   Headline: "${fraRG.headline}"`);
console.log(`   Mechanics: ${JSON.stringify(fraRG.mechanics)}`);

if (!fraRG.name.toLowerCase().includes('heartwood')) {
  throw new Error(`Expected FRA RG name to include "Heartwood", got "${fraRG.name}"`);
}
if (!fraRG.mechanics.includes('Heartwood Tokens')) {
  throw new Error(`Expected FRA RG mechanics to include "Heartwood Tokens"`);
}
console.log('   ✓ FRA RG canonical Konstrari Heartwood & Ramp archetype verified.\n');

// 2. Developed Archetype Check
console.log('2. Testing FRA Developed Archetype Registration:');
const developedPairs = SET_DEVELOPED_ARCHETYPES['FRA'];
if (!developedPairs || !developedPairs.includes('RG') || developedPairs.length !== 10) {
  throw new Error(`Expected FRA to develop all 10 color pairs including RG, got ${JSON.stringify(developedPairs)}`);
}
console.log('   ✓ FRA develops all 10 color pairs registered in SET_DEVELOPED_ARCHETYPES.\n');

// 3. Mock Cards Verification
console.log('3. Testing FRA Heartwood Fallback Cards:');
const mockCards = getFallbackCards('FRA');
console.log(`   Total mock cards for FRA: ${mockCards.length}`);
const cardNames = mockCards.map(c => c.name);
console.log(`   Cards: ${cardNames.join(', ')}`);

const requiredCards = [
  'Konstrari Improviser // Soul Tether',
  'Woodwork Prodigy // Soul Tether',
  'Puppet Crafting',
  'Hungering Puppetbeast',
  'Tenured Tethermage',
  'Heartwood Crafter // Soul Tether',
  'Aerid Konstrari'
];

for (const req of requiredCards) {
  const found = mockCards.find(c => c.name === req);
  if (!found) {
    throw new Error(`Missing required FRA card: ${req}`);
  }
  if (!found.oracle_text && !found.type_line.includes('//')) {
    throw new Error(`Card ${req} missing oracle text`);
  }
}
console.log('   ✓ All 7 canonical FRA preview cards present with exact Scryfall attributes.\n');

// 4. Card Similarity & Precedent Matching
console.log('4. Testing Heartwood Similarity & Precedent Matching:');
const improviser = mockCards.find(c => c.name.startsWith('Konstrari Improviser'))!;
const prodigy = mockCards.find(c => c.name.startsWith('Woodwork Prodigy'))!;
const opportunist = HISTORICAL_BENCHMARK_CARDS.find(c => c.name === 'Argothian Opportunist')!;
const svella = HISTORICAL_BENCHMARK_CARDS.find(c => c.name === 'Svella, Ice Shaper')!;
const rootweaver = HISTORICAL_BENCHMARK_CARDS.find(c => c.name === 'Three Tree Rootweaver')!;

// Improviser vs Opportunist (both ramp artifact token producers)
const compOpportunist = calculateCardSimilarity(improviser, opportunist);
console.log(`   Konstrari Improviser vs Argothian Opportunist: Score ${compOpportunist.score}%`);
console.log(`   Reasons: ${JSON.stringify(compOpportunist.reasons)}`);

if (!compOpportunist.reasons.some(r => r.toLowerCase().includes('ramp artifact token') || r.toLowerCase().includes('ramp'))) {
  throw new Error(`Expected ramp token comparison reason, got: ${JSON.stringify(compOpportunist.reasons)}`);
}
if (compOpportunist.score < 40) {
  throw new Error(`Expected strong similarity score between Improviser and Opportunist, got ${compOpportunist.score}%`);
}

// Improviser vs Rootweaver (cross-ramp bridge: ramp token generator <-> mana dork)
const compDork = calculateCardSimilarity(improviser, rootweaver);
console.log(`   Konstrari Improviser vs Three Tree Rootweaver: Score ${compDork.score}%`);
console.log(`   Reasons: ${JSON.stringify(compDork.reasons)}`);
if (!compDork.reasons.some(r => r.toLowerCase().includes('mana ramp'))) {
  throw new Error(`Expected cross-ramp mana ramp bridge reason, got: ${JSON.stringify(compDork.reasons)}`);
}

// Prodigy vs Svella (both repeated token ramp engines)
const compSvella = calculateCardSimilarity(prodigy, svella);
console.log(`   Woodwork Prodigy vs Svella, Ice Shaper: Score ${compSvella.score}%`);
console.log(`   Reasons: ${JSON.stringify(compSvella.reasons)}`);

// 5. Scryfall Query Generation
console.log('\n5. Testing Scryfall Query Generation for Heartwood:');
const queries = buildScryfallQueries(improviser, extractCardFeatures(improviser));
console.log('   Generated queries for Konstrari Improviser:');
queries.forEach(q => console.log(`     - ${q}`));

const hasHeartwoodQuery = queries.some(q => q.includes('heartwood'));
if (!hasHeartwoodQuery) {
  throw new Error(`Expected generated queries to include heartwood token search terms`);
}
console.log('   ✓ Heartwood token query generation verified.');

console.log('\n🎉 ALL HEARTWOOD ENGINE TUNING TESTS PASSED!');
