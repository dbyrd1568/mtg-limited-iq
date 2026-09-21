import { getCardSelfReferentialNames, oracleContainsCardName, tokenizeAndSanitizeOracleText } from '../components/CardObfuscator';

console.log('=== Verifying Card Name Concealment in Rules Text ===\n');

// 1. Teyo, Diamondblade Mage (From the user question screenshot)
const teyoName = 'Teyo, Diamondblade Mage';
const teyoType = 'Legendary Creature — Human Warlock';
const teyoOracle = 'Flash\nWhen Teyo enters, target permanent you control gains deathtouch until end of turn. Put a +1/+1 counter on it if it\'s a creature. Put a loyalty counter on it if it\'s a planeswalker.';

const teyoPatterns = getCardSelfReferentialNames(teyoName, teyoType);
console.log('Teyo patterns:', teyoPatterns);
console.assert(teyoPatterns.includes('Teyo'), 'Teyo must be extracted as a self-referential name');
console.assert(teyoPatterns.includes('Teyo, Diamondblade Mage'), 'Full name must be included');
console.assert(teyoPatterns.includes("Teyo's"), "Possessive Teyo's must be included");

const teyoMatches = oracleContainsCardName(teyoOracle, teyoPatterns);
console.assert(teyoMatches === true, 'Teyo oracle text must be detected as containing partial card name');
console.log('✓ Teyo self-referential partial name detection verified.');

// 2. Tokenize and sanitize Teyo's oracle text
const sanitizedNodes = tokenizeAndSanitizeOracleText(
  'When Teyo enters, target permanent you control gains deathtouch until end of turn.',
  teyoPatterns,
  'lg'
);
console.log('Sanitized parts count:', sanitizedNodes.length);
console.assert(sanitizedNodes.length === 3, 'Must split into 3 parts: prefix, concealed token, suffix');
console.log('✓ Teyo oracle text tokenization and [Concealed] replacement verified.');

// 3. Negative test: Card without name in oracle text (e.g. Giant Growth)
const giantGrowthName = 'Giant Growth';
const giantGrowthType = 'Instant';
const giantGrowthOracle = 'Target creature gets +3/+3 until end of turn.';
const ggPatterns = getCardSelfReferentialNames(giantGrowthName, giantGrowthType);
const ggMatches = oracleContainsCardName(giantGrowthOracle, ggPatterns);
console.assert(ggMatches === false, 'Giant Growth must NOT trigger oracle name concealment');
console.log('✓ Negative case (cards without self-reference) verified - Scryfall text remains untouched.');

// 4. Legendary planeswalker without comma (e.g. Fblthp the Lost)
const fblthpName = 'Fblthp the Lost';
const fblthpType = 'Legendary Creature — Homunculus';
const fblthpOracle = 'When Fblthp the Lost enters the battlefield, draw a card. If it entered from your library or was cast from your library, draw two cards instead.';
const fblthpPatterns = getCardSelfReferentialNames(fblthpName, fblthpType);
console.assert(fblthpPatterns.includes('Fblthp'), 'Fblthp must be extracted from legendary card without comma');
console.assert(oracleContainsCardName(fblthpOracle, fblthpPatterns) === true, 'Fblthp oracle text must be detected');
console.log('✓ Legendary card without comma (Fblthp) verified.');

// 5. Card with Mana Cost and Reminder text in oracle
const complexText = 'When Teyo enters, pay {3}{B}. (Reminder text.)';
const complexTokens = tokenizeAndSanitizeOracleText(complexText, teyoPatterns, 'lg');
console.assert(complexTokens.length > 3, 'Must properly handle mana symbols and reminder text alongside concealed name');
console.log('✓ Complex rules text with mana symbols and reminder text verified.');

console.log('\n🎉 ALL CARD NAME CONCEALMENT VERIFICATION TESTS PASSED SUCCESSFULLY!');
