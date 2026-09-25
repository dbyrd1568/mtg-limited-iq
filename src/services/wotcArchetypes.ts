import { Card, MTGColor } from '../types/mtg';
import { EXPANDED_SET_WOTC_ARCHETYPES } from './wotcArchetypeData';

import { ArchetypePace } from '../types/mtg';

export interface WOTCArchetype {
  code: string; // 'WU', 'UB', etc.
  colors: [MTGColor, MTGColor];
  name: string; // 'Eerie Rooms & Glimmer Tempo', etc.
  guildName?: string; // 'Azorius', etc.
  headline: string; // 'Birds • Fliers & Spells', etc.
  description: string; // Official WOTC description of archetype strategy
  mechanics: string[];
  pace?: ArchetypePace;
  draftPointers?: string[];
  keyCommons?: string[];
}

export interface WOTCArchetypeInfo {
  name: string;
  guildName?: string;
  headline: string;
  description: string;
  mechanics: string[];
  pace?: ArchetypePace;
  draftPointers?: string[];
  keyCommons?: string[];
}

export const GUILD_ARCHETYPES: {
  colors: [MTGColor, MTGColor];
  code: string;
  name: string;
  defaultTheme: string;
}[] = [
  { colors: ['W', 'U'], code: 'WU', name: 'Azorius', defaultTheme: 'Flyers / Spells & Tempo' },
  { colors: ['U', 'B'], code: 'UB', name: 'Dimir', defaultTheme: 'Control / Card Advantage & Reanimation' },
  { colors: ['B', 'R'], code: 'BR', name: 'Rakdos', defaultTheme: 'Aggro / Sacrifice & Removal' },
  { colors: ['R', 'G'], code: 'RG', name: 'Gruul', defaultTheme: 'Midrange / Stompy & Power Threshold' },
  { colors: ['G', 'W'], code: 'GW', name: 'Selesnya', defaultTheme: 'Go-Wide / +1/+1 Counters & Tokens' },
  { colors: ['W', 'B'], code: 'WB', name: 'Orzhov', defaultTheme: 'Aristocrats / Lifegain & Bleed' },
  { colors: ['U', 'R'], code: 'UR', name: 'Izzet', defaultTheme: 'Spellslinger / Prowess & Tempo' },
  { colors: ['B', 'G'], code: 'BG', name: 'Golgari', defaultTheme: 'Graveyard / Morbid & Attrition' },
  { colors: ['R', 'W'], code: 'RW', name: 'Boros', defaultTheme: 'Go-Wide Aggro / Equipment & Combat Tricks' },
  { colors: ['G', 'U'], code: 'GU', name: 'Simic', defaultTheme: 'Ramp / Big Mana & Card Draw' },
];

export const SET_DEVELOPED_ARCHETYPES: Record<string, string[]> = {
  // Strixhaven: School of Mages (5 enemy colleges: Silverquill, Prismari, Witherbloom, Lorehold, Quandrix)
  STX: ['WB', 'UR', 'BG', 'RW', 'GU'],
  // Guilds of Ravnica (5 guilds: Dimir, Golgari, Izzet, Boros, Selesnya)
  GRN: ['UB', 'BG', 'UR', 'RW', 'GW'],
  // Ravnica Allegiance (5 guilds: Azorius, Rakdos, Gruul, Simic, Orzhov)
  RNA: ['WU', 'BR', 'RG', 'GU', 'WB'],
  // Dragons of Tarkir (5 allied pairs)
  DTK: ['WU', 'UB', 'BR', 'RG', 'GW'],
  // The Hobbit (5 developed archetypes)
  HOB: ['WU', 'UB', 'BR', 'RG', 'GW'],
  // Secrets of Strixhaven (develops all 10 guilds/archetypes)
  SOS: ['WU', 'UB', 'BR', 'RG', 'GW', 'WB', 'UR', 'BG', 'RW', 'GU'],
  // Reality Fracture (develops all 10 guilds/archetypes)
  FRA: ['WU', 'UB', 'BR', 'RG', 'GW', 'WB', 'UR', 'BG', 'RW', 'GU'],
};

export function getDevelopedArchetypeCodes(setCode: string, cards?: Card[]): Set<string> {
  const upperCode = (setCode || '').toUpperCase().trim();

  // 1. Dynamic card pool check if cards are present
  if (cards && cards.length > 0) {
    const pairGoldCount: Record<string, number> = {};
    GUILD_ARCHETYPES.forEach((guild) => {
      const [c1, c2] = guild.colors;
      const gold = cards.filter((c) => {
        const colors = c.colors || [];
        return colors.length === 2 && colors.includes(c1) && colors.includes(c2);
      });
      pairGoldCount[guild.code] = gold.length;
    });

    const activePairs = Object.entries(pairGoldCount).filter(([_, count]) => count > 0);

    // If only a subset (e.g. 5 pairs) have gold cards, those are the developed archetypes
    if (activePairs.length > 0 && activePairs.length < 10) {
      return new Set(activePairs.map(([code]) => code));
    }

    // If all 10 pairs have gold cards (like SOS, BLB, DSK, etc.)
    if (activePairs.length === 10) {
      return new Set(GUILD_ARCHETYPES.map((g) => g.code));
    }
  }

  // 2. Curated sets map
  if (SET_DEVELOPED_ARCHETYPES[upperCode]) {
    return new Set(SET_DEVELOPED_ARCHETYPES[upperCode]);
  }

  // 3. Default fallback: all 10 are considered developed
  return new Set(GUILD_ARCHETYPES.map((g) => g.code));
}

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};


const SET_WOTC_ARCHETYPES: Record<string, Record<string, WOTCArchetypeInfo>> = {
  "BLB": {
    "WU": {
      "name": "Birds (Azorius)",
      "headline": "Birds of a Feather \u2022 Noncreature Spells & Flying Tempo",
      "description": "Wizards designed White-Blue Birds around aerial superiority and noncreature spell synergy. Flying creatures pressure opponents while instant and sorcery spells provide tempo, evasion boosts, and protective countermagic.",
      "mechanics": [
        "Flying",
        "Noncreature Spells",
        "Tempo"
      ]
    },
    "UB": {
      "name": "Rats (Dimir)",
      "headline": "Clever Rats \u2022 Threshold Control & Graveyard Recursion",
      "description": "Dimir Rats play a patient attrition game, utilizing self-mill, card draw, and targeted removal to achieve threshold (seven or more cards in your graveyard), unlocking amplified payoffs and recursion.",
      "mechanics": [
        "Threshold (7+ Graveyard)",
        "Control",
        "Recursion"
      ]
    },
    "BR": {
      "name": "Lizards (Rakdos)",
      "headline": "Cold-Blooded Lizards \u2022 Opponent Loss of Life Aggro",
      "description": "Rakdos Lizards reward aggressive attacks and noncombat ping damage. Lizard cards gain substantial power, menace, or draw cards if an opponent lost life during the current turn.",
      "mechanics": [
        "Opponent Lost Life",
        "Aggro",
        "Direct Damage"
      ]
    },
    "RG": {
      "name": "Raccoons (Gruul)",
      "headline": "Trash & Treasure \u2022 Expend 4 & Heavy Beatdown",
      "description": "Gruul Raccoons utilize the Expend mechanic, tracking total mana spent on spells each turn. Spending four or more mana triggers explosive power buffs, trample, and card advantage.",
      "mechanics": [
        "Expend 4",
        "4+ Power",
        "Trample Stompy"
      ]
    },
    "GW": {
      "name": "Rabbits (Selesnya)",
      "headline": "Bountiful Rabbits \u2022 Swarm Tokens & Go-Wide Anthems",
      "description": "Selesnya Rabbits flood the battlefield with 1/1 Rabbit creature tokens. The archetype excels at going wide and capitalizing on team-wide stat buffs, convoke-style abilities, and overwhelming board presence.",
      "mechanics": [
        "Go-Wide Tokens",
        "Anthems",
        "+1/+1 Buffs"
      ]
    },
    "WB": {
      "name": "Bats (Orzhov)",
      "headline": "Night & Day \u2022 Life Gain and Loss Fluctuation",
      "description": "Orzhov Bats operate around life total movement. Whether you gain life from lifelink or sacrifice life to pay spell costs, fluctuating your life total on your turn supercharges Bat synergies.",
      "mechanics": [
        "Life Fluctuation",
        "Lifelink & Drain",
        "Evasion"
      ]
    },
    "UR": {
      "name": "Otters (Izzet)",
      "headline": "Playful Otters \u2022 Noncreature Spellslinger & Prowess",
      "description": "Izzet Otters chain inexpensive instants and sorceries with prowess-style triggers. Play cheap cantrips and burn spells to multiply combat power and out-tempo slower decks.",
      "mechanics": [
        "Spellslinger",
        "Prowess",
        "Card Velocity"
      ]
    },
    "BG": {
      "name": "Squirrels (Golgari)",
      "headline": "Resourceful Squirrels \u2022 Forage & Food Graveyard Value",
      "description": "Golgari Squirrels create Food tokens and utilize the Forage mechanic (exiling three cards from your graveyard or sacrificing a Food). This fuels endless recursion, +1/+1 counters, and grinding attrition.",
      "mechanics": [
        "Forage",
        "Food Tokens",
        "Graveyard Recycling"
      ]
    },
    "RW": {
      "name": "Mice (Boros)",
      "headline": "Valiant Mice \u2022 Heroic Targeting & Lightning Aggro",
      "description": "Boros Mice are fast, low-to-the-ground aggro creatures with the Valiant ability, triggering the first time each turn a mouse becomes the target of a spell or ability you control.",
      "mechanics": [
        "Valiant",
        "Targeting Spells",
        "Fast Combat"
      ]
    },
    "GU": {
      "name": "Frogs (Simic)",
      "headline": "Pond Hoppers \u2022 Enter-the-Battlefield Bounce & Blink",
      "description": "Simic Frogs jump into and out of combat, bouncing your own creatures to hand or flickering them to trigger powerful enter-the-battlefield abilities repeatedly.",
      "mechanics": [
        "ETB Value",
        "Self-Bounce",
        "Blink & Ramp"
      ]
    }
  },
  "DSK": {
    "WU": {
      "name": "Eerie Rooms & Glimmer Tempo",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Inquisitive Glimmer is your premier engine discount; pick it early",
        "Draft cheap rooms (2-3 mana) to trigger Eerie reliably every turn",
        "Prioritize evasive fliers to convert unlocked doors into lethal clock"
],
      "keyCommons": ["Acrobatic Cheerleader","Grand Entryway // Elegant Rotunda","Unable to Scream"],
      "headline": "Eerie \u2022 Rooms & Enchantment Tempo",
      "description": "White-Blue locks down opposing nightmares with enchantment Auras and unlocks Rooms to trigger Eerie, generating flying spirits, tapping blockers, and controlling the pace of combat.",
      "mechanics": [
        "Eerie",
        "Rooms",
        "Enchantments"
      ]
    },
    "UB": {
      "name": "Eerie Reanimation Control",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Use card filtering and mill to dump big horrors into the graveyard",
        "Gremlin Tamer and Fear of Infinity provide infinite board stall value",
        "Draft premium black spot removal to stabilize against fast aggro"
],
      "keyCommons": ["Dashing Bloodsucker","Glimmerlight","Unsettling Twins"],
      "headline": "Eerie Control \u2022 Graveyard Reanimation & Card Draw",
      "description": "Blue-Black pilots an eerie control strategy, filling the graveyard with high-cost horrors and reanimating them ahead of curve while drawing through the deck with insidious card filtering.",
      "mechanics": [
        "Eerie",
        "Reanimation",
        "Card Filtering"
      ]
    },
    "BR": {
      "name": "Room Sacrifice & Direct Burn",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Sawblade Culler turns unlocked room permanents into raw card draw",
        "Unlock rooms for upfront ETB value, then sacrifice them to burn outlets",
        "Keep your curve low (1-3 CMC) to maintain maximum pressure"
],
      "keyCommons": ["Clockwork Percussionist","Diversion Specialist","Final Vengeance"],
      "headline": "Sacrifice Aggro \u2022 Room Detonation & Reckless Damage",
      "description": "Black-Red aggressively unleashes terror, sacrificing disposable room permanents and fodder creatures to deal direct damage and punish opponents who fail to block.",
      "mechanics": [
        "Sacrifice",
        "Room Synergy",
        "Direct Burn"
      ]
    },
    "RG": {
      "name": "Delirium Stompy",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Wildfire Wickerfolk provides aggressive turn-2 haste beatdown",
        "Draft card types that naturally enter the bin (artifacts, enchantments, lands)",
        "Overwhelm small blockers with 4+ power trampling threats"
],
      "keyCommons": ["Bashful Beastie","Flesh Burrower","Horrific Assault"],
      "headline": "Delirium Stompy \u2022 4+ Power Diverse Threat Beatdown",
      "description": "Red-Green accelerates diverse card types into the graveyard to unlock Delirium, producing massive 4+ power trampling beasts that overwhelm defensive lines.",
      "mechanics": [
        "Delirium (4+ Types)",
        "4+ Power",
        "Trample"
      ]
    },
    "GW": {
      "name": "Survival & Tap Synergies",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Protect Survival creatures with pump spells and instant tricks",
        "Use vehicles or tap abilities to trigger Survival without risking combat death",
        "Niko's Lightseeker and Veteran Survivor scale into unstoppable threats"
],
      "keyCommons": ["Cautious Survivor","Frantic Strength","Savvy Headhunter"],
      "headline": "Survival \u2022 Tapped Creatures Value & Defense",
      "description": "Green-White features the Survival mechanic. When your creatures tap (via attacking or crew-style abilities) and survive until your second main phase, they generate substantial card advantage and counters.",
      "mechanics": [
        "Survival",
        "Tap Triggers",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Reanimator & Enchantment Attrition",
      "guildName": "Orzhov",
      "pace": "Control",
      "draftPointers": [
        "Rite of the Moth provides two full reanimations in one card",
        "Draft high-cost enchantment creatures that can be discarded or cycled",
        "Shroudspawn and aura removal grind opponents out of resources"
],
      "keyCommons": ["Shepherding Spirits","Spined Karok","Nowhere to Run"],
      "headline": "Reanimation & Drain \u2022 Small Creature Attrition",
      "description": "White-Black recurs low-mana creatures from the graveyard and bleeds opponent life totals with death triggers and lifegain payoffs.",
      "mechanics": [
        "Reanimation <= 3 CMC",
        "Lifegain & Drain",
        "Aristocrats"
      ]
    },
    "UR": {
      "name": "Rooms & Spellslinger Velocity",
      "guildName": "Izzet",
      "pace": "Synergy / Combo",
      "draftPointers": [
        "Rooms trigger 'whenever you cast a noncreature spell' payoffs",
        "Roaring Furnace provides early removal that unlocks late-game card draw",
        "Prioritize cheap cantrips to dig for your room enablers"
],
      "keyCommons": ["Conductive Machete","Grasping Longneck","Turn Inside Out"],
      "headline": "Rooms & Spellslinger \u2022 Door Velocity & Direct Damage",
      "description": "Blue-Red synergizes opening unlocked Room doors with noncreature spells, burning blockers and drawing cards in a rush of tempo.",
      "mechanics": [
        "Rooms",
        "Noncreature Spells",
        "Burn & Tempo"
      ]
    },
    "BG": {
      "name": "Delirium & Graveyard Value",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Broodspinner produces massive spider swarms once delirium is active",
        "Draft diverse card types including artifact creatures and enchantment creatures",
        "Self-mill is pure card advantage when your graveyard fuels payoffs"
],
      "keyCommons": ["Balustrade Wurm","Broodspinner","Innocuous Insect"],
      "headline": "Delirium & Morbid \u2022 Graveyard Recursion & Deathtouch",
      "description": "Black-Green fills the graveyard with artifacts, enchantments, creatures, and lands to trigger Delirium and assemble unstoppable recursive threats.",
      "mechanics": [
        "Delirium",
        "Graveyard Mill",
        "Deathtouch Attrition"
      ]
    },
    "RW": {
      "name": "Low-Power Aggro & Survival",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Arabella, Abandoned Doll drains lethal life with a wide board of power 2 or less",
        "Draft cheap 1- and 2-drops to establish overwhelming early tempo",
        "Equip Baseball Bat to push through combat damage and trigger Survival"
],
      "keyCommons": ["Hardy Collector","Ragged Playmate","Fear of Lost Teeth"],
      "headline": "Survival Aggro \u2022 Equipment & First Strike Attacks",
      "description": "Red-White uses equipment, combat tricks, and high power to attack safely, triggering Survival abilities while keeping pressure on the opponent.",
      "mechanics": [
        "Survival",
        "Equipment",
        "Aggressive Pump"
      ]
    },
    "GU": {
      "name": "Manifest Dread & Face-Down Value",
      "guildName": "Simic",
      "pace": "Midrange",
      "draftPointers": [
        "Growing Dread creates a steady stream of face-down 2/2 surprise attackers",
        "Manifest Dread look at top 2, manifests one and mills the other, fueling recursion",
        "Draft high-cost bombs to flip face-up at instant speed for combat blowouts"
],
      "keyCommons": ["Cryptid Companion","Defiant Survivor","Horrid Vigor"],
      "headline": "Manifest Dread \u2022 Face-Down Horrors & Ramp",
      "description": "Green-Blue uses Manifest Dread (looking at top two cards, putting one onto battlefield face-down as a 2/2 and one into graveyard) to cheat mana costs and flip colossal creatures.",
      "mechanics": [
        "Manifest Dread",
        "Face-Down 2/2s",
        "Big Mana"
      ]
    }
  },
  "FDN": {
    "WU": {
      "name": "Fliers & Flash Tempo",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Deploy cheap flying threats and hold up open mana on defense",
        "Flash creatures punish opponents who play around countermagic",
        "Bounce spells clear opposing blockers for lethal combat swings"
],
      "keyCommons": ["Aven Cloudstrider","Clinquant Skymage","Snare the Skies"],
      "headline": "Fliers & Flash \u2022 Classical Sky Dominance & Tempo",
      "description": "Wizards designed White-Blue in Foundations as the quintessential flying and tempo archetype. Airborne threats clock the opponent while flash creatures and instant tricks disrupt ground attacks.",
      "mechanics": [
        "Flying",
        "Flash",
        "Countermagic & Bounce"
      ]
    },
    "UB": {
      "name": "Flashback & Graveyard Control",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Prioritize 2-for-1 card advantage with Flashback spells",
        "Draft black removal and blue counterspells to stabilize the early game",
        "Win through inescapable late-game card advantage and recursion"
],
      "keyCommons": ["Bake into a Pie","Burglar Rat","Think Twice"],
      "headline": "Flashback & Control \u2022 Graveyard Card Advantage",
      "description": "Blue-Black plays a patient, classic control strategy using targeted removal, counterspells, and Flashback spells to out-value opponents into the late game.",
      "mechanics": [
        "Flashback",
        "Removal",
        "Card Advantage"
      ]
    },
    "BR": {
      "name": "Raid & Sacrifice Aggro",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Attack every turn to enable Raid bonuses across your creatures",
        "Sacrifice expendable goblins and skeletons to remove blockers and push burn",
        "Keep your curve low to end games before midrange decks stabilize"
],
      "keyCommons": ["Shock","Gutless Noble","Vampire Slayer"],
      "headline": "Raid & Sacrifice \u2022 Direct Damage & Aggressive Bleed",
      "description": "Black-Red attacks relentlessly each turn to trigger Raid bonuses, turning expendable goblins and skeletons into direct damage and removal.",
      "mechanics": [
        "Raid",
        "Sacrifice Fodder",
        "Direct Damage"
      ]
    },
    "RG": {
      "name": "Ferocious 4+ Power Beatdown",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Use green ramp elves to cast 4-power creatures on turn 3",
        "Ferocious abilities turn combat into unfavorable trades for opponents",
        "Trample and combat pump spells close out stalled boards"
],
      "keyCommons": ["Colossal Dreadmaw","Elvish Mystic","Llanowar Elves"],
      "headline": "Ferocious Stompy \u2022 4+ Power Ramp & Trample",
      "description": "Red-Green accelerates mana to cast huge creatures with 4 or more power, leveraging Ferocious attack bonuses to demolish opposing defenses.",
      "mechanics": [
        "4+ Power (Ferocious)",
        "Mana Ramp",
        "Trample"
      ]
    },
    "GW": {
      "name": "+1/+1 Counters & Swarm Tokens",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Distribute counters across wide boards rather than stacking one target",
        "Token producers maximize the value of global anthem effects",
        "Hold up protection spells against board wipes"
],
      "keyCommons": ["Healer's Hawk","Heroic Reinforcements","Raise the Alarm"],
      "headline": "+1/+1 Counters & Tokens \u2022 Go-Wide Army Growth",
      "description": "Green-White generates creature tokens and distributes permanent +1/+1 counters across its battlefield, building an impenetrable defensive line and lethal alpha strike.",
      "mechanics": [
        "+1/+1 Counters",
        "Tokens",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Morbid & Lifegain Drain",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Engineer combat trades so creatures die on your turn for Morbid triggers",
        "Lifegain buffers your life total against aggro while draining opposing life",
        "Draft resilient blockers and recurring sacrifice outlets"
],
      "keyCommons": ["Ajani's Pridemate","Bloodthirsty Aerialist","Murder"],
      "headline": "Morbid & Lifegain \u2022 Aristocrats Death Triggers",
      "description": "White-Black thrives on death and lifegain. When creatures die on either side, Morbid triggers activate to drain life, draw cards, and punish removal.",
      "mechanics": [
        "Morbid (Death Triggers)",
        "Lifegain & Drain",
        "Aristocrats"
      ]
    },
    "UR": {
      "name": "Spellslinger Prowess",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Aim for 10-12 creatures and 11-13 noncreature spells",
        "Chain cheap cantrips and burn to turn prowess attackers into lethal threats",
        "Draft flexible burn spells that can hit both creatures and face"
],
      "keyCommons": ["Lightning Strike","Opt","Wee Dragonauts"],
      "headline": "Spellslinger \u2022 Instant/Sorcery Velocity & Prowess",
      "description": "Blue-Red is the premier spellslinger pairing. Chaining cheap cantrips and burn spells pumps prowess creatures and clears the way for lethal burst damage.",
      "mechanics": [
        "Prowess",
        "Instants & Sorceries",
        "Burn"
      ]
    },
    "BG": {
      "name": "Morbid Recursion & Attrition",
      "guildName": "Golgari",
      "pace": "Control",
      "draftPointers": [
        "Trade early and often; your graveyard functions as an extension of hand",
        "Deathtouch blockers completely stall aggressive ground attacks",
        "Recursion spells bring back your highest-impact late game bombs"
],
      "keyCommons": ["Gravedigger","Plaguecrafter","Reclaim"],
      "headline": "Morbid Recursion \u2022 Graveyard Recycling & Attrition",
      "description": "Black-Green leverages creature deaths to fuel graveyard recursion, bringing back fallen bombs and winning through inevitable resource advantage.",
      "mechanics": [
        "Morbid",
        "Graveyard Recursion",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Battalion Go-Wide Aggro",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Draft 6+ 1- and 2-drops to reliably attack with 3 creatures on turn 3",
        "Battalion triggers provide first strike, trample, and combat buffs",
        "Use cheap combat tricks to blow out multi-blocks on your attackers"
],
      "keyCommons": ["Daring Skyjek","Boros Elite","Lightning Strike"],
      "headline": "Battalion Aggro \u2022 Low-Curve Swarm & Combat Tricks",
      "description": "Red-White curves out with aggressive 1- and 2-drops. Attacking with three or more creatures activates Battalion triggers for explosive combat buffs.",
      "mechanics": [
        "Battalion (3+ Attackers)",
        "Combat Tricks",
        "Low Curve"
      ]
    },
    "GU": {
      "name": "Big Ramp & Sea Monsters",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Draft 4-5 ramp pieces to cast 6+ mana threats turns ahead of schedule",
        "Giant leviathans and sea monsters overpower standard draft battlefields",
        "Card draw spells ensure you never flood out after ramping"
],
      "keyCommons": ["Explore","Growth Spiral","Urban Evolution"],
      "headline": "Ramp & Big Spells \u2022 Colossal Sea Beasts & Card Draw",
      "description": "Green-Blue ramps extra lands onto the battlefield to deploy giant 6+ mana leviathans, drawing extra cards to sustain limitless threats.",
      "mechanics": [
        "Land Ramp",
        "Big Mana (6+)",
        "Card Draw"
      ]
    }
  },
  "STX": {
    "WB": {
      "name": "Silverquill College (WB)",
      "headline": "The College of Eloquence \u2022 Inklings, Debate & +1/+1 Counters",
      "description": "Wizards designed Silverquill as an aggressive, sharp-witted college focusing on fast attackers, flying 2/1 Inkling tokens, and distributing +1/+1 counters through verbal and magical debate.",
      "mechanics": [
        "Inkling Tokens",
        "+1/+1 Counters",
        "Aggressive Flier Tempo"
      ]
    },
    "UR": {
      "name": "Prismari College (UR)",
      "headline": "The College of Elemental Arts \u2022 Big Mana 5+ Spells & Treasures",
      "description": "Prismari expresses magic through grand, theatrical performances. The archetype ramps with Treasure tokens to cast devastating 5+ mana value instants and sorceries.",
      "mechanics": [
        "5+ Cost Spells",
        "Treasure Ramping",
        "Elemental Sorceries"
      ]
    },
    "BG": {
      "name": "Witherbloom College (BG)",
      "headline": "The College of Essence Studies \u2022 Pest Tokens & Lifegain/Drain",
      "description": "Witherbloom investigates the cycle of life and death. You create 1/1 Pest tokens that gain 1 life when they die, sacrificing them to fuel insidious drain and growth abilities.",
      "mechanics": [
        "Pest Tokens (1/1 Gain Life)",
        "Life Drain & Gain",
        "Sacrifice"
      ]
    },
    "RW": {
      "name": "Lorehold College (RW)",
      "headline": "The College of Archaeomancy \u2022 Spirit Tokens & Graveyard Archaeology",
      "description": "Lorehold excavates history by interacting with cards leaving your graveyard. Spirit tokens, artifact recursion, and aggressive archaeomancers bring ancient power into the present.",
      "mechanics": [
        "Cards Leaving Graveyard",
        "Spirit Tokens",
        "Artifact Recursion"
      ]
    },
    "GU": {
      "name": "Quandrix College (GU)",
      "headline": "The College of Numerology \u2022 Fractal Tokens & 8+ Land Scale",
      "description": "Quandrix manipulates the mathematical patterns of nature and the multiverse. The archetype ramps to eight lands and generates Fractal tokens with variable +1/+1 counters that grow exponentially.",
      "mechanics": [
        "Fractal Tokens",
        "8+ Lands Scale",
        "Mana Ramp & Math"
      ]
    }
  },
  "HOB": {
    "WU": {
      "name": "Riddles in the Dark (WU)",
      "headline": "Riddles in the Dark \u2022 Fliers, Bilbo's Wits & Defensive Countermagic",
      "description": "Wizards designed White-Blue in The Hobbit around Bilbo's cunning intellect and the Great Eagles of the Misty Mountains. Defensive countermagic and riddle scrying control the early game until majestic fliers deliver aerial victory.",
      "mechanics": [
        "Flying",
        "Riddles / Scry",
        "Defensive Tempo"
      ]
    },
    "UB": {
      "name": "Gollum & The Mirkwood Spiders (UB)",
      "headline": "Gollum & Spiders \u2022 Stealth Sabotage, Deathtouch & Web Traps",
      "description": "Blue-Black creeps through shadow and web, using deathtouch arachnids and stealthy saboteurs to force discard, trap enemy attackers, and steal victory from the darkness.",
      "mechanics": [
        "Deathtouch",
        "Saboteur Infiltration",
        "Hand Disruption"
      ]
    },
    "BR": {
      "name": "Goblins of the Misty Mountains (BR)",
      "headline": "Goblin Horde \u2022 Swarm Aggro, Treachery & Goblin Sacrifice",
      "description": "Black-Red unleashes the chaotic goblin hordes beneath the mountains. Swarm your enemy with relentless low-cost attackers, sacrificing expendable goblins to catapult direct burn at enemy life totals.",
      "mechanics": [
        "Goblin Swarm",
        "Direct Burn",
        "Fodder Sacrifice"
      ]
    },
    "RG": {
      "name": "Beorn & Wild Beasts (RG)",
      "headline": "Beorn & Beasts of Rhovanion \u2022 4+ Power Stompy, Ferocious & Trample",
      "description": "Red-Green channels the untamed fury of the skin-changer Beorn and the colossal creatures of the wild. Accelerate mana into 4+ power behemoths that trample through enemy defenses with unstoppable momentum.",
      "mechanics": [
        "4+ Power Threshold",
        "Trample Beatdown",
        "Ferocious"
      ]
    },
    "GW": {
      "name": "Shirefolk of Hobbiton (GW)",
      "headline": "Hobbit Fellowship \u2022 Halflings, Food Tokens & Go-Wide Fellowship",
      "description": "Green-White embodies the indomitable spirit and cozy solidarity of the Shire. Generate bountiful Food tokens to sustain your halfling villagers, buffing your fellowship with permanent +1/+1 counters into a triumphant go-wide army.",
      "mechanics": [
        "Halflings Tribal",
        "Food Tokens",
        "+1/+1 Anthems"
      ]
    }
  },
  "OTJ": {
    "WU": {
      "name": "Plot Tempo & No Spells Cast",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Plot spells on odd turns to trigger end-step 'no spells cast' payoffs",
        "Jem Lightfoote and Prairie Dog generate immense advantage on pass turns",
        "Double-spell on subsequent turns using free plotted cards"
],
      "keyCommons": ["Aven Interrupter","Phantom Interference","Geyser Drake"],
      "headline": "Plot & Patience \u2022 'No Spells Cast' Trigger Payoffs",
      "description": "White-Blue rewards plotting spells into future turns. Casting no spells from your hand on your turn activates massive bonuses on end step.",
      "mechanics": [
        "Plot",
        "No Spells Cast",
        "Tempo Control"
      ]
    },
    "UB": {
      "name": "Crimes Control & Sabotage",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Deserts that ping opponents trigger a free crime each turn",
        "Intimidation Campaign drains and draws cards whenever you commit a crime",
        "Draft targeted removal and bounce to trigger crime synergies at instant speed"
],
      "keyCommons": ["Consuming Ashes","Desert's Due","Ravenous Fell Stalker"],
      "headline": "Crime & Sabotage \u2022 Targeting Opponents & Blackmail",
      "description": "Blue-Black commits crimes by targeting opponents, their spells, or their permanents. Committing a crime each turn unlocks card draw and stat buffs.",
      "mechanics": [
        "Crimes (Target Opponent)",
        "Saboteurs",
        "Control"
      ]
    },
    "BR": {
      "name": "Outlaws Aggro & Direct Burn",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Draft Assassins, Mercenaries, Pirates, Rogues, and Warlocks",
        "At Knifepoint produces a steady army of Mercenary tokens",
        "Direct burn finishes opponents after early aggressive outlaw attacks"
],
      "keyCommons": ["Deadeye Duelist","Prickly Pair","Skulduggery"],
      "headline": "Outlaws United \u2022 Assassins, Mercenaries, Pirates, Rogues & Warlocks",
      "description": "Black-Red bands the five outlaw creature types together for blistering aggro, removal, and explosive combat damage.",
      "mechanics": [
        "Outlaws (5 Types)",
        "Removal",
        "Aggro"
      ]
    },
    "RG": {
      "name": "4+ Power Ferocious Stompy",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Jolene and 4+ power creatures trigger explosive combat bonuses",
        "Ramp into 4-power threats on turn 3 to immediately turn on synergies",
        "Use bite and fight spells to eliminate blockers without losing creatures"
],
      "keyCommons": ["Ankle Biter","Cactusfolk Sentry","Hardbristle Bandit"],
      "headline": "Ferocious Outlaws \u2022 4+ Power Beatdown & Trample",
      "description": "Red-Green brings heavy muscle to Thunder Junction, trampling blockers with 4+ power bruisers and ferocious payoffs.",
      "mechanics": [
        "4+ Power",
        "Trample",
        "Combat Pump"
      ]
    },
    "GW": {
      "name": "Mounts & Vehicles Midrange",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Miriam, Herd Whispering provides stat boosts and protection to mounts",
        "Saddle up before combat to activate powerful attack triggers",
        "Token generators provide cheap saddle crew fodder"
],
      "keyCommons": ["Stubborn Burrowfiend","Vanguard of the Rose","Wary Thespian"],
      "headline": "Mounts & Vehicles \u2022 Saddling Up for Attack Triggers",
      "description": "Green-White saddles Mounts with willing riders, activating game-changing combat triggers and token generation.",
      "mechanics": [
        "Mounts & Saddle",
        "Attack Triggers",
        "Tokens"
      ]
    },
    "WB": {
      "name": "Deserts & Lifegain/Loss Bleed",
      "guildName": "Orzhov",
      "pace": "Control",
      "draftPointers": [
        "Ruthless Lawbringer sacrifices small creatures to eliminate bombs",
        "Baron Bertram Graywater creates Vampires when tokens die",
        "Deserts enable life drain pings and graveyard recursion"
],
      "keyCommons": ["Mourner's Surprise","Tumbleweed Rising","Unfortunate Accident"],
      "headline": "Reanimation & Drain \u2022 Gang Loyalty & Grave Attrition",
      "description": "White-Black recurs fallen outlaws from the graveyard and drains opponent life totals through calculated attrition.",
      "mechanics": [
        "Reanimation",
        "Life Drain",
        "Death Triggers"
      ]
    },
    "UR": {
      "name": "Double-Spell Spellslinger",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Plot spells on earlier turns so you can cast your second spell for free",
        "Kraum, Violent Cacophony grows into an evasive flying win condition",
        "Draft cheap cantrips and bounce spells to reliably cast 2 spells a turn"
],
      "keyCommons": ["Highway Robbery","Magmatic Chasm","Slick Sequence"],
      "headline": "Two-Spell Velocity \u2022 Double-Barreled Spellcasting",
      "description": "Blue-Red rewards casting two or more spells in a single turn, chaining cheap plotted cards with burn spells for double the impact.",
      "mechanics": [
        "Cast 2+ Spells/Turn",
        "Plot Velocity",
        "Burn"
      ]
    },
    "BG": {
      "name": "Deserts & Graveyard Recursion",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Honest Rutstein reduces mana costs and recurs dead creatures",
        "Deserts cycling and mill fuels late-game desert payoffs",
        "Grind opponents down with resilient deathtouch threats"
],
      "keyCommons": ["Boneyard Desecrator","Overzealous Muscle","Spinewoods Armadillo"],
      "headline": "Deserts & Graveyard \u2022 Recycling the Badlands",
      "description": "Black-Green turns desert lands and graveyard recursion into steady card advantage, grinding opponents down with poisonous patience.",
      "mechanics": [
        "Deserts",
        "Graveyard Recursion",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Mercenary Swarm Aggro",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Ertha Jo doubles all abilities targeting your creatures or Mercenaries",
        "Mercenary tokens tap to grant +1/+0 for burst lethal combat damage",
        "Curve out aggressively with 1- and 2-drops and finish with team buffs"
],
      "keyCommons": ["Form a Posse","Outlaw Medic","Take Up the Shield"],
      "headline": "Mercenary Tokens \u2022 Go-Wide Aggro & Power Pump",
      "description": "Red-White creates 1/1 Mercenary tokens with '{T}: Target creature gets +1/+0', stacking buffs on primary attackers for lethal strikes.",
      "mechanics": [
        "Mercenary Tokens (+1/+0)",
        "Go-Wide Aggro",
        "First Strike"
      ]
    },
    "GU": {
      "name": "Plot & Big Mana Spells",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Doc Aurlock discounts all plotted and exiled spells significantly",
        "Plot massive 5- and 6-drops to cast them simultaneously on turn 5",
        "Pair with mana fixing to splash powerful off-color bombs"
],
      "keyCommons": ["Dance of the Tumbleweeds","Outcaster Greenblade","Reach for the Sky"],
      "headline": "Plot & Big Ramp \u2022 Heavy Payoffs Ahead of Curve",
      "description": "Green-Blue plots expensive spells into exile, setting up turns where you cast multiple high-impact bombs while ramping lands.",
      "mechanics": [
        "Plot",
        "Land Ramp",
        "Big Spells"
      ]
    }
  },
  "MKM": {
    "WU": {
      "name": "Detectives Tempo",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft cheap Detective tribal creatures to trigger investigation buffs",
        "Investigate Clues for steady card draw without losing board tempo",
        "Use tap and bounce spells to push lethal attacks"
],
      "keyCommons": ["Agency Outfitter","Inside Source","Novice Inspector"],
      "headline": "Forensic Investigation \u2022 Clues & Flying Detective Tempo",
      "description": "Wizards designed White-Blue around the Detective creature type and Clue sacrifice tempo. Private Eye and flying investigators generate continuous clue advantage while locking down suspect blockers.",
      "mechanics": [
        "Detectives",
        "Investigate (Clues)",
        "Flying Tempo"
      ]
    },
    "UB": {
      "name": "Clue Control & Suspect Sabotage",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Sacrifice Clue tokens to power up insidious graveyard abilities",
        "Suspect opposing blockers so they can't block your attackers",
        "Draft hard removal and counterspells to control the late game"
],
      "keyCommons": ["Extract a Confession","Forensic Researcher","Reasonable Doubt"],
      "headline": "Disguise & Clues \u2022 Shadow Sabotage & Control",
      "description": "Blue-Black plays a cunning cloak-and-dagger game, turning face-down disguised creatures into lethal card filtering, hand disruption, and instant removal.",
      "mechanics": [
        "Disguise (Ward 2)",
        "Clues",
        "Removal Control"
      ]
    },
    "BR": {
      "name": "Suspect Aggro & Sacrifice",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Suspect your own attackers to give them Menace and push early damage",
        "Sacrifice suspects and Clues to burn outlets when they are outclassed",
        "Keep your curve aggressive to end games early"
],
      "keyCommons": ["Demand Answers","Person of Interest","Red Herring"],
      "headline": "Suspect Aggro \u2022 Menace & Relentless Pressure",
      "description": "Black-Red marks suspect creatures (granting Menace at the cost of being unable to block), forcing brutal trades and sacrificing suspect fodder for lethal burn damage.",
      "mechanics": [
        "Suspect (Menace / Can't Block)",
        "Direct Burn",
        "Fast Aggro"
      ]
    },
    "RG": {
      "name": "Disguise Stompy & Power",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Play ward 2 Disguise creatures face-down on turn 3",
        "Flip big 4+ power tramplers face-up for devastating combat blowouts",
        "Ramp mana to unlock multiple flip triggers in a single turn"
],
      "keyCommons": ["Bite Down on Crime","Offender at Large","Rubblebelt Maverick"],
      "headline": "Disguise Stompy \u2022 4+ Power & Face-Down Beatdown",
      "description": "Red-Green accelerates face-down disguised creatures and flips them into massive 4+ power bruisers with haste, overwhelming defensive stalls.",
      "mechanics": [
        "Disguise",
        "Flip Triggers",
        "4+ Power"
      ]
    },
    "GW": {
      "name": "Disguise Go-Wide & Tokens",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Swarm the board with face-down disguised creatures and detective tokens",
        "Global pump spells and anthems scale exponentially with wide boards",
        "Ward 2 on disguised cards protects your board from cheap spot removal"
],
      "keyCommons": ["Dog Walker","Museum Nightwatch","Makeshift Binding"],
      "headline": "Disguise Swarm \u2022 Go-Wide Ward Army",
      "description": "Green-White fills the board with cloaked and disguised 2/2s, utilizing team-wide morph anthems to turn ordinary mystery cards into an unstoppable swarm.",
      "mechanics": [
        "Go-Wide Disguise",
        "Cloak",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Case Solving & Small Reanimation",
      "guildName": "Orzhov",
      "pace": "Control",
      "draftPointers": [
        "Solve Cases by fulfilling easy early requirements (e.g. creatures dying)",
        "Recur 2-power creatures from the graveyard to maintain infinite blockers",
        "Grind opponents out with incremental life drain"
],
      "keyCommons": ["Absolving Lammasu","Case of the Uneaten Feast","Macabre Reconstruction"],
      "headline": "Morbid & Small Disguise \u2022 Graveyard Evidence",
      "description": "White-Black recurs low-power disguised creatures and trades aggressively, collecting evidence from creature deaths to bleed opponent life totals.",
      "mechanics": [
        "Small Creature Reanimation",
        "Morbid",
        "Disguise"
      ]
    },
    "UR": {
      "name": "Artifact Clue Sac Spellslinger",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft cards that trigger whenever you sacrifice an artifact or Clue",
        "Chain cheap cantrips and burn spells to clear blockers",
        "Use impulse draw and clue cracking to fuel relentless velocity"
],
      "keyCommons": ["Gearbane Brawler","Gleaming Geardrake","Shock"],
      "headline": "Evidence Spellslinger \u2022 Velocity & Clue Cantrips",
      "description": "Blue-Red fuels spellslinger triggers by casting cheap burn spells and cracking Clues, exiling graveyard evidence for explosive spell copies.",
      "mechanics": [
        "Collect Evidence",
        "Instants & Sorceries",
        "Clues"
      ]
    },
    "BG": {
      "name": "Collect Evidence & Graveyard Attrition",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Exile cards with high mana values from your graveyard to Collect Evidence",
        "Draft split cards or high-cost disguises that count for huge evidence values",
        "Out-grind opponents with high-value recursion threats"
],
      "keyCommons": ["Chalk Outline","Lurching Rotbeast","Toxin Analysis"],
      "headline": "Collect Evidence & Dredge \u2022 Plant & Zombie Recursion",
      "description": "Black-Green piles cards into the graveyard, utilizing Collect Evidence to grow Insidious Roots and assemble endless plant and zombie recursive armies.",
      "mechanics": [
        "Collect Evidence",
        "Graveyard Exiling",
        "Recursion"
      ]
    },
    "RW": {
      "name": "Battalion Aggro & Go-Wide",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Draft cheap 1- and 2-drops to attack with 3 or more creatures each turn",
        "Disguised creatures count toward attacking thresholds while protected by ward 2",
        "Combat tricks turn double-blocks into game-winning blowouts"
],
      "keyCommons": ["Auspicious Arrival","Novice Inspector","Rally the Chump"],
      "headline": "Battalion Aggro \u2022 Disguise Attack Wave",
      "description": "Red-White curves out with low-cost attackers, triggering battalion bonuses when three or more creatures assault the opponent simultaneously.",
      "mechanics": [
        "Battalion (3+ Attackers)",
        "Disguise",
        "Fast Combat"
      ]
    },
    "GU": {
      "name": "Collect Evidence & Big Ramp",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Ramp into huge mana values to easily meet Collect Evidence requirements",
        "Combine Clue draw with land acceleration to cast giant detective bombs",
        "Use disguised cards as safe early blockers before flipping big sea threats"
],
      "keyCommons": ["Benthic Criminologist","Curious Cadavre","Topiary Panther"],
      "headline": "Evidence Ramp \u2022 Clue Acceleration & Colossal Flips",
      "description": "Green-Blue ramps mana by investigating and collecting evidence, flipping gargantuan disguised sea beasts to dominate the late game.",
      "mechanics": [
        "Collect Evidence",
        "Land Ramp",
        "Disguise Flipping"
      ]
    }
  },
  "LCI": {
    "WU": {
      "name": "Artifact Craft & Aerial Fliers",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft cheap artifacts and fliers to dominate the air",
        "Craft transforms your early equipment and maps into game-winning late threats",
        "Bounce opposing reach blockers to keep skies clear"
],
      "keyCommons": ["Attentive Sunscribe","Council's Deliberation","Oaken Siren"],
      "headline": "Craft with Artifact \u2022 Ancient Tech & Flying Guardians",
      "description": "White-Blue utilizes the Craft mechanic to exile fallen artifacts from the board or graveyard, transforming modest tools into flying mechanical wonders and tap-down engines.",
      "mechanics": [
        "Craft with Artifact",
        "Tap Effects",
        "Evasion"
      ]
    },
    "UB": {
      "name": "Descend Control & Sabotage",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Fill your graveyard with permanent cards each turn to trigger Descend",
        "Draft Map tokens to explore cards into the graveyard while buffing creatures",
        "Control combat with premium black removal and blue bounce"
],
      "keyCommons": ["Dead Weight","Waterwind Scout","Shipwreck Sentry"],
      "headline": "Descend 4 & 8 \u2022 Sunken Crypts & Sabotage Control",
      "description": "Blue-Black fills the graveyard with permanent cards to unlock Descend 4 and Descend 8, unlocking card filtering and lethal unblockable saboteurs.",
      "mechanics": [
        "Descend 4/8",
        "Fathomless Descent",
        "Control"
      ]
    },
    "BR": {
      "name": "Descend Sacrifice & Aggro",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Sacrifice disposable artifacts and goblins to trigger Descend reliably",
        "Descend payoffs reward you whenever permanent cards enter your graveyard",
        "Push high aggressive damage before opponents stabilize with life gain"
],
      "keyCommons": ["Fanatical Offering","Goblin Tomb Raider","Ray of Ruin"],
      "headline": "Descend & Sacrifice \u2022 Volcanic Treasures & Reckless Aggro",
      "description": "Black-Red burns through resources, sacrificing artifacts and creatures to trigger descend payoffs and punish opponents with direct damage.",
      "mechanics": [
        "Descend",
        "Artifact Sacrifice",
        "Direct Burn"
      ]
    },
    "RG": {
      "name": "Dinosaurs Stompy & Ramp",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Draft green ramp to cast colossal 5+ mana Dinosaurs ahead of curve",
        "Dinosaur synergies trigger fighting and massive trample attacks",
        "Use bite spells to clear opposing deathtouch blockers"
],
      "keyCommons": ["Armored Kincaller","Ixalli's Lorekeeper","Poison Dart Frog"],
      "headline": "Dinosaurs Stompy \u2022 Colossal Beasts & Enrage Trample",
      "description": "Red-Green unleashes Ixalan's apex predators, accelerating mana into massive 4+ power dinosaurs that crush opposing boards.",
      "mechanics": [
        "Dinosaurs",
        "4+ Power",
        "Trample Ramp"
      ]
    },
    "GW": {
      "name": "Explore & +1/+1 Counters",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Explore draws extra lands or puts permanent +1/+1 counters on your creatures",
        "Draft Map token producers to explore on your best combat threats",
        "Overwhelm opponents with beefy creatures that out-stat damage-based removal"
],
      "keyCommons": ["Miner's Guidewing","Pathfinding Axejaw","Petrify"],
      "headline": "Explore & +1/+1 Counters \u2022 Oltec Jungle Warfare",
      "description": "Green-White explores through the library, putting lands into hand and loading +1/+1 counters onto resilient vanguard creatures.",
      "mechanics": [
        "Explore",
        "+1/+1 Counters",
        "Map Tokens"
      ]
    },
    "WB": {
      "name": "Aristocrats & Artifact Sacrifice",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Sacrifice artifacts and small creature tokens to drain opposing life totals",
        "Bartolomé del Presidio grows massive as a free instant sacrifice outlet",
        "Draft removal that doubles as permanent cards to fuel Descend"
],
      "keyCommons": ["Fanatical Offering","Mephitic Draught","Malignant Growth"],
      "headline": "Aristocrats & Bats \u2022 Aclazotz Bleed & Lifegain",
      "description": "White-Black synergizes evasive Vampire Bats with sacrifice triggers, draining life totals whenever permanents leave the battlefield.",
      "mechanics": [
        "Bats",
        "Sacrifice",
        "Lifelink & Drain"
      ]
    },
    "UR": {
      "name": "Pirates Artifacts & Beatdown",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft aggressive Pirates that generate Treasure and Map tokens on attack",
        "Artifact synergy buffs your combat attackers and fuels craft transforms",
        "Burn spells clear paths for saboteur combat triggers"
],
      "keyCommons": ["Daring Discovery","Plundering Pirate","Waterwind Scout"],
      "headline": "Pirates & Artifact Velocity \u2022 Cosmium Fleet Raiding",
      "description": "Blue-Red deploys agile pirates that generate Map and Treasure tokens, triggering +1/+1 buffs whenever artifacts enter your side of the board.",
      "mechanics": [
        "Pirates",
        "Artifacts Entering",
        "Map Tokens"
      ]
    },
    "BG": {
      "name": "Descend 4/8 & Fathomless Attrition",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Descend 4 and 8 unlock gargantuan stat boosts and continuous recursion",
        "Self-mill aggressively to turn on Descend thresholds by turn 4-5",
        "Avoid nonpermanent spells; your deck wants 16-18 permanent cards"
],
      "keyCommons": ["Basking Capybara","Broodrage Mycoid","Skullcap Snail"],
      "headline": "Fathomless Descent \u2022 Graveyard Dredge & Spelunking",
      "description": "Black-Green aggressively self-mills permanents to maximize fathomless descent counts, turning graveyard size into massive creature power.",
      "mechanics": [
        "Fathomless Descent",
        "Self-Mill",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Tap & Attack Aggro Equipment",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Draft cheap 1- and 2-drops to attack with tapped creatures every turn",
        "Equip weapons that boost power and grant first strike to survive combat",
        "Maintain maximum combat pressure and close out before late-game engines start"
],
      "keyCommons": ["Caparocti Sunborn","Deconstruction Crew","Sunshot Militia"],
      "headline": "Dinosaurs & Equipment \u2022 Sun Empire Vanguard",
      "description": "Red-White marries swift Dinosaur attackers with equipment and combat tricks, utilizing Discover abilities to flood the red zone.",
      "mechanics": [
        "Discover",
        "Equipment",
        "Fast Aggro"
      ]
    },
    "GU": {
      "name": "Explore Merfolk & Deep Roots",
      "guildName": "Simic",
      "pace": "Midrange",
      "draftPointers": [
        "Explore repeatedly to filter through your deck and put counters on Merfolk",
        "Explore triggers trigger secondary payoffs like token generation and ramp",
        "Scale into unstoppable late-game board presence"
],
      "keyCommons": ["Explorer's Cache","Nicanzil, Current Conductor","River Herald Scout"],
      "headline": "Explore & Merfolk \u2022 River Heralds Land Acceleration",
      "description": "Green-Blue commands the River Heralds, combining explore triggers with +1/+1 counters and extra land drops to out-scale opponents.",
      "mechanics": [
        "Explore",
        "Merfolk",
        "+1/+1 Counters",
        "Ramp"
      ]
    }
  },
  "WOE": {
    "WU": {
      "name": "Tapping Opponents & Icy Control",
      "guildName": "Azorius",
      "pace": "Control",
      "draftPointers": [
        "Tap opposing creatures to trigger cards like Hylda of the Icy Crown",
        "Stall aggressive attackers indefinitely while flying fliers chip away life",
        "Draft stun counter cards and defensive removal"
],
      "keyCommons": ["Freeze in Place","Frostbridge Guard","Succumb to the Cold"],
      "headline": "Tap Down & Freeze \u2022 Ice Queens & Defensive Stalls",
      "description": "White-Blue rewards tapping opposing creatures, drawing extra cards and putting stun counters on threats to control the battlefield.",
      "mechanics": [
        "Tap Down",
        "Stun Counters",
        "Evasion"
      ]
    },
    "UB": {
      "name": "Faeries & Flash Flying Sabotage",
      "guildName": "Dimir",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft cheap flying Faeries to trigger tribal combat advantages",
        "Play at instant speed with flash threats and countermagic",
        "Use Faerie sabotage triggers to draw cards and bounce blockers"
],
      "keyCommons": ["Ego Drain","Mocking Sprite","Snaremaster Sprite"],
      "headline": "Faeries & Control \u2022 Pranksters, Flash & Bleed",
      "description": "Blue-Black deploys elusive flying Faeries at flash speed, disrupting opposing plays and draining life totals whenever Faerie spells resolve.",
      "mechanics": [
        "Faeries",
        "Flash",
        "Card Advantage"
      ]
    },
    "BR": {
      "name": "Rats & Fodder Sacrifice Aggro",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Generate 1/1 Rat tokens that can't block, then attack aggressively",
        "Sacrifice rats to Bargain costs and burn spells for maximum card value",
        "Totentanz, Swarm Piper refills your board whenever nontoken creatures die"
],
      "keyCommons": ["Candy Grapple","Harried Spearguard","Voracious Vermin"],
      "headline": "Rats & Sacrifice \u2022 Piper Swarms & Vermin Cannons",
      "description": "Black-Red spawns swarms of 1/1 Rat tokens (which can't block) and hurls them into enemy blockers or sacrifices them to Bargain spells.",
      "mechanics": [
        "Rat Tokens",
        "Sacrifice",
        "Direct Damage"
      ]
    },
    "RG": {
      "name": "Ferocious 4+ Power & Celebration",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Deploy massive 4+ power trampling beasts to overpower defenses",
        "Celebration triggers when two nonland permanents enter the battlefield in a turn",
        "Use Roles to boost smaller creatures to 4 power ahead of curve"
],
      "keyCommons": ["Flick a Coin","Redtooth Genealogist","Titanic Growth"],
      "headline": "4+ Power Celebration \u2022 Wild Beast Trample",
      "description": "Red-Green triggers 4+ power buffs and Celebration by deploying heavy trampling monsters alongside Monster Role auras.",
      "mechanics": [
        "4+ Power",
        "Monster Roles",
        "Trample"
      ]
    },
    "GW": {
      "name": "Auras & Role Enchants",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Attach Monster, Royal, and Young Hero roles to buff attackers permanently",
        "When a new role replaces an old one, the old role dies, triggering death payoffs",
        "Draft cards that scale with the number of enchantments you control"
],
      "keyCommons": ["Archon's Glory","Curse of the Werefox","Tuinvale Guide"],
      "headline": "Aura Roles & Anthems \u2022 Royal & Young Hero Growth",
      "description": "Green-White attaches Role auras (Royal, Young Hero, Monster) to small creatures, turning modest common playables into colossal heroic threats.",
      "mechanics": [
        "Role Tokens",
        "Aura Synergies",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Bargain Aristocrats & Enchantment Sacrifice",
      "guildName": "Orzhov",
      "pace": "Control",
      "draftPointers": [
        "Bargain allows you to sacrifice artifacts, enchantments, or tokens for amplified effects",
        "Sacrifice disposable Roles and Food tokens to unlock premium removal modes",
        "Grind opponents out with lifegain drain attrition"
],
      "keyCommons": ["Hopeless Nightmare","Savage Surge","Shatter the Oath"],
      "headline": "Enchantment Aristocrats \u2022 Bargain & Nightmare Drain",
      "description": "White-Black profits whenever enchantments or roles are put into the graveyard from the battlefield, draining opponent life and recurring key assets.",
      "mechanics": [
        "Enchantments to Graveyard",
        "Bargain",
        "Life Drain"
      ]
    },
    "UR": {
      "name": "Celebration & Spellslinger Prowess",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Cast two nonland permanents or spells per turn to trigger Celebration",
        "Draft cheap burn spells and adventure spells to double-dip on casts",
        "Chain spells to give prowess creatures massive combat swings"
],
      "keyCommons": ["Flick a Coin","Johann's Apprentice","Sleight of Hand"],
      "headline": "Spells & Adventures \u2022 Storybook Velocity",
      "description": "Blue-Red chains adventure spells from exile with instant/sorcery payoffs, multiplying spell casts per turn for explosive tempo turns.",
      "mechanics": [
        "Adventures",
        "Instants & Sorceries",
        "Prowess"
      ]
    },
    "BG": {
      "name": "Food & Graveyard Recursion",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Produce Food tokens to buffer life total and pay sacrifice costs",
        "Greta, Sweettooth Scourge draws extra cards and buffs creatures using Food",
        "Recur high-impact threats from the graveyard into the late game"
],
      "keyCommons": ["Mintstrosity","Sweettooth Witch","Troublemaker Ouphe"],
      "headline": "Food & Bargain \u2022 Witchcraft & Gingerbread Attrition",
      "description": "Black-Green bakes Food tokens and consumes them through the Bargain mechanic, fueling recursion, +1/+1 counters, and grinding midrange advantages.",
      "mechanics": [
        "Food Tokens",
        "Bargain",
        "Graveyard Value"
      ]
    },
    "RW": {
      "name": "Celebration Go-Wide Aggro",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Enter two permanents on your turn (e.g. creature + role) to trigger Celebration",
        "Curve out aggressively with 1- and 2-drops to end games before board wipes",
        "Ash, Party Crasher attacks with massive buffs when Celebration is active"
],
      "keyCommons": ["Armory Mice","Hopeful Vigil","Kellan's Lightblades"],
      "headline": "Celebration Aggro \u2022 Festival Swarm & First Strike",
      "description": "Red-White triggers Celebration whenever two or more nonland permanents enter the battlefield in a single turn, triggering aggressive pump bonuses.",
      "mechanics": [
        "Celebration",
        "Low Curve",
        "First Strike"
      ]
    },
    "GU": {
      "name": "5+ Mana Value Big Spells & Ramp",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Ramp mana aggressively using green dorks and food acceleration",
        "Draft 5+ mana value spells to trigger payoffs like Troyan, Gutsy Explorer",
        "Adventure spells provide early game interaction and late-game big spells"
],
      "keyCommons": ["Brave the Wilds","Hamlet Glutton","Water Wings"],
      "headline": "5+ Mana Big Spells \u2022 Eldraine Titans & Ramp",
      "description": "Green-Blue ramps mana quickly to cast colossal 5+ mana value spells and adventures, triggering enormous card draw and stat buffs.",
      "mechanics": [
        "5+ Mana Value Spells",
        "Ramp",
        "Card Draw"
      ]
    }
  },
  "LTR": {
    "WU": {
      "name": "The Ring Tempts & Skies Tempo",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Advance The Ring Tempts You to level 2+ for unblockable combat damage",
        "Draft evasive bird fliers and soldiers to peck away life totals",
        "Counterspells and bounce spells protect your Ring-bearer"
],
      "keyCommons": ["Captain of Umbar","Eastfarthing Farmer","Protector of Gondor"],
      "headline": "Draw Second Card \u2022 Eagles of the North & Evasion",
      "description": "White-Blue rewards drawing a second card each turn, deploying Great Eagles and Knights of Dol Amroth that grow with every cantrip and scry.",
      "mechanics": [
        "Draw Second Card",
        "Flying",
        "Scry"
      ]
    },
    "UB": {
      "name": "Amass Orcs & Ring Control",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Amass Orcs generates a massive single Army token that grows with every spell",
        "Use The Ring Tempts You to make your Army an unblockable, legendary threat",
        "Draft black removal and blue card draw to control the late game"
],
      "keyCommons": ["Deceive the Messenger","Dunland Crebain","Gothmog's Spite"],
      "headline": "Amass Orcs & Control \u2022 Sauron's Dark Surveillance",
      "description": "Blue-Black amasses a towering Orc Army token while utilizing Ring-tempting and black removal to choke enemy threats out of the game.",
      "mechanics": [
        "Amass Orcs",
        "The Ring Tempts You",
        "Control"
      ]
    },
    "BR": {
      "name": "Amass Orcs & Direct Aggro",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Build an enormous Orc Army early and attack relentlessly",
        "Sacrifice small goblins and tokens to trigger direct burn and card draw",
        "Keep your curve low and aggressive to overrun slow midrange decks"
],
      "keyCommons": ["Foray of Orcs","Nasty End","Smite the Deathless"],
      "headline": "Amass & Sacrifice \u2022 Mordor Treachery & Treason",
      "description": "Black-Red aggressively amasses Orc armies, sacrificing disposable goblins and orcs to fling direct damage and crush defenses.",
      "mechanics": [
        "Amass Orcs",
        "Goblin Sacrifice",
        "Direct Burn"
      ]
    },
    "RG": {
      "name": "Power 4+ & Ents Stompy",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Cast 4+ power creatures to trigger attack buffs and fighting spells",
        "Draft big green Ents and red beasts that outclass opposing blockers",
        "Trample and bite spells push lethal damage through chump blockers"
],
      "keyCommons": ["Ent's Fury","Generous Ent","Oliphaunt"],
      "headline": "Wild Beasts & 4+ Power \u2022 Ents, Wargs & Oliphaunts",
      "description": "Red-Green channels the untamed fury of Middle-earth's wilderness, trampling through defenses with 4+ power beasts and landfall triggers.",
      "mechanics": [
        "4+ Power",
        "Landfall",
        "Trample"
      ]
    },
    "GW": {
      "name": "Hobbits & Food Tokens Go-Wide",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Generate Food tokens with Hobbits to gain life and trigger payoffs",
        "Butterbur and Pippin turn Food generation into free creature tokens",
        "Overwhelm opponents with wide token boards and team pump spells"
],
      "keyCommons": ["Mushroom Watchdogs","Ponyback Brigade","Second Breakfast"],
      "headline": "Food & Fellowship \u2022 Halfling Hospitality & Tokens",
      "description": "Green-White generates hearty Food tokens and Halflings, turning second breakfasts into permanent +1/+1 counters and wide defensive boards.",
      "mechanics": [
        "Food Tokens",
        "Halflings",
        "+1/+1 Counters"
      ]
    },
    "WB": {
      "name": "Ring-bearer Sacrifice & Lifegain Attrition",
      "guildName": "Orzhov",
      "pace": "Control",
      "draftPointers": [
        "Whenever your Ring-bearer attacks or creatures die, drain opposing life",
        "Draft Nazgûl and Ring tempts spells to quickly power up your Ring-bearer",
        "Grind opponents out with life differentials that make racing impossible"
],
      "keyCommons": ["Now for Wrath","Sam's Desperate Rescue","Took Reaper"],
      "headline": "Nazg\u00fbl Aristocrats \u2022 The Ring's Corruption & Bleed",
      "description": "White-Black tempts fate with The Ring, sacrificing loyal minions to Ring-bearer abilities and bleeding opposing life totals with Nine Nazg\u00fbl synergies.",
      "mechanics": [
        "The Ring Tempts You",
        "Sacrifice",
        "Life Drain"
      ]
    },
    "UR": {
      "name": "Wizards Spellslinger & Gandalf Tempo",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft Wizards and noncreature spells to trigger prowess and spell copying",
        "Chain cantrips to dig through your deck and draw multiple cards per turn",
        "Direct burn spells remove blockers and finish low-life opponents"
],
      "keyCommons": ["Cast into the Fire","Glorious Gale","Treason of Isengard"],
      "headline": "Gandalf's Sorcery \u2022 Spellslinger Velocity & Wizardry",
      "description": "Blue-Red chains fiery instants and sorceries, pumping prowess creatures and casting powerful historic and spellcraft masterworks.",
      "mechanics": [
        "Instants & Sorceries",
        "Wizard Tribal",
        "Burn"
      ]
    },
    "BG": {
      "name": "Food & Shelob Morbid Attrition",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Sacrifice Food and creatures to trigger morbid graveyard recursion",
        "Deathtouch spiders and beasts halt opposing attackers completely",
        "Draft Shelob's Ambush and bite spells for blowout combat trades"
],
      "keyCommons": ["Bag End Porter","Shelob's Ambush","Uglúk of the White Hand"],
      "headline": "Food & Treefolk Recursion \u2022 The Old Forest & Fangorn",
      "description": "Black-Green recycles Food and fallen creatures through the graveyard, utilizing ancient Treefolk and spider attrition to outlast opponents.",
      "mechanics": [
        "Food Tokens",
        "Graveyard Recursion",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Humans Go-Wide Aggro & Rally",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Draft low-curve Human creatures and attack in large numbers",
        "Éomer of the Riddermark and Théoden grant team buffs when Humans enter",
        "Close games out fast with Rally spells and direct combat tricks"
],
      "keyCommons": ["East-Mark Cavalier","Erkenbrand, Lord of Westfold","Rally at the Hornburg"],
      "headline": "Humans Go-Wide Aggro \u2022 The Riders of Rohan",
      "description": "Red-White curves out with aggressive Human soldiers, triggering anthem buffs and haste attacks when rallying the legions of Gondor and Rohan.",
      "mechanics": [
        "Humans",
        "Go-Wide Tokens",
        "Attack Triggers"
      ]
    },
    "GU": {
      "name": "Scry Synergies & Elves Ramp",
      "guildName": "Simic",
      "pace": "Midrange",
      "draftPointers": [
        "Scry 2+ whenever you cast spells or attack to trigger Elven bonuses",
        "Elrond, Lord of Rivendell puts +1/+1 counters on creatures when you scry",
        "Perfect card quality guarantees you always draw your highest-impact bombs"
],
      "keyCommons": ["Arwen's Gift","Chance-Met Elves","Lórien Revealed"],
      "headline": "Scry Elves \u2022 Rivendell Foresight & Wisdom",
      "description": "Green-Blue scries through the library with Elven seers, growing creatures with +1/+1 counters whenever cards are scried to hand or bottom.",
      "mechanics": [
        "Scry Synergies",
        "+1/+1 Counters",
        "Ramp"
      ]
    }
  },
  "MOM": {
    "WU": {
      "name": "Knights & Aerial Beatdown",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft Knight tribal creatures that buff other Knights on attack",
        "Marshal of Zhalfir pumps Knights and taps opposing blockers",
        "Flyers and vigilance allow you to attack battles while defending your life total"
],
      "keyCommons": ["Eyes of Gitaxias","Kithkin Billyrider","Protocol Knight"],
      "headline": "Zhalfirin Aerial Legions & Knight Anthems",
      "description": "White-Blue unites Zhalfir and New Benalia under the Knight banner, deploying flying cavaliers with team-wide stat buffs and defensive tricks.",
      "mechanics": [
        "Knights",
        "Tribal Anthems",
        "Flying"
      ]
    },
    "UB": {
      "name": "Convoke Control & Graveyard Mill",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Tap creatures to cast high-mana Convoke spells turns ahead of schedule",
        "Mill opponents to trigger 8+ cards in graveyard bonuses",
        "Control combat with premium removal and bounce"
],
      "keyCommons": ["Consuming Sinkhole","Halo-Charged Skaab","Preening Champion"],
      "headline": "Incubate & Sacrifice \u2022 Phyrexian Espionage & Removal",
      "description": "Blue-Black incubates transforming Phyrexian tokens and sacrifices disposable hosts to draw cards and eliminate key enemy threats.",
      "mechanics": [
        "Incubate Tokens",
        "Sacrifice",
        "Removal Control"
      ]
    },
    "BR": {
      "name": "Sacrifice & Battle Aggro",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Sacrifice incubate tokens and expendable fodder to deal direct burn",
        "Attack Siege Battles to flip powerful transform permanents",
        "Keep your curve low and aggressive to close out matches"
],
      "keyCommons": ["Compleated Huntmaster","Furnace Gremlin","Ichor Drinker"],
      "headline": "Sacrifice & Battle Breakers \u2022 Reckless Assault",
      "description": "Black-Red attacks battles aggressively and sacrifices battlefield fodder to punch direct damage through to opponents.",
      "mechanics": [
        "Sacrifice",
        "Battle Defeating",
        "Direct Burn"
      ]
    },
    "RG": {
      "name": "Battles & Trample Stompy",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Cast high-reward Siege Battles and defeat them in 1 attack swing",
        "Flipped battles provide overwhelming legendary permanents that win games",
        "Trample over blockers to deal excess damage to battles"
],
      "keyCommons": ["Beamtown Beatstick","Placid Rottentail","Volcanic Spite"],
      "headline": "Battles & Trample Beatdown \u2022 Apex Colossi",
      "description": "Red-Green flips Battle Sieges into devastating transformed permanents, trampling blockers with 4+ power prehistoric monsters.",
      "mechanics": [
        "Battles (Sieges)",
        "4+ Power",
        "Trample"
      ]
    },
    "GW": {
      "name": "+1/+1 Counters & Backup Swarm",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Backup ability transfers counters and keyword abilities to other attackers",
        "Botanical Brawler grows every time a +1/+1 counter is placed anywhere",
        "Go wide with counter-laden creatures that overwhelm defenses"
],
      "keyCommons": ["Enduring Bondwarden","Overgrown Pest","Timberland Ancient"],
      "headline": "+1/+1 Counters & Backup \u2022 Mirran Resistance",
      "description": "Green-White utilizes the Backup mechanic to transfer abilities and +1/+1 counters onto key attackers for game-winning alpha strikes.",
      "mechanics": [
        "Backup",
        "+1/+1 Counters",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Phyrexian Incubate & Sacrifice",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Create Incubator tokens that transform into Phyrexian artifact creatures for 2 mana",
        "Sacrifice incubators to trigger death payoffs and life drain",
        "Sculpted Perfection buffs all Phyrexians and provides free incubate tokens"
],
      "keyCommons": ["Alabaster Host Sanctifier","Deadly Derision","Tainted Collector"],
      "headline": "Phyrexian Incubate \u2022 Machine Orthodoxy Drain",
      "description": "White-Black generates incubator tokens and bleeds opponents whenever Phyrexians enter the battlefield or perish in combat.",
      "mechanics": [
        "Phyrexian Tribal",
        "Incubate",
        "Aristocrats"
      ]
    },
    "UR": {
      "name": "Convoke Spellslinger & Tokens",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Generate elemental and soldier tokens to tap for Convoke spells",
        "Cast 7-mana spells for free using your token army",
        "Joyful Stormseeker grants haste to your biggest convoked threats"
],
      "keyCommons": ["Meeting of Minds","Ral's Reinforcements","Stoke the Flames"],
      "headline": "Convoke Spells \u2022 Pyretic Teamwork & Velocity",
      "description": "Blue-Red taps creatures to convoke expensive instants and sorceries ahead of curve, burning blockers and drawing fresh hands.",
      "mechanics": [
        "Convoke on Spells",
        "Token Fodder",
        "Burn"
      ]
    },
    "BG": {
      "name": "Incubate & Graveyard Attrition",
      "guildName": "Golgari",
      "pace": "Control",
      "draftPointers": [
        "Incubate tokens provide instant blockers when transformed",
        "Recur dead Phyrexians and battles from the graveyard",
        "Grind opponents out with unstoppable attrition and deathtouch"
],
      "keyCommons": ["Gloomfang Mauler","Ichor Drinker","Portent Tracker"],
      "headline": "Incubate & Graveyard Recursion \u2022 Necrotic Rebirth",
      "description": "Black-Green mills cards and incubates Phyrexian monstrosities, reanimating fallen invasion forces from the graveyard.",
      "mechanics": [
        "Incubate",
        "Self-Mill",
        "Reanimation"
      ]
    },
    "RW": {
      "name": "Backup & Equipment Aggro",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Use Backup to grant double strike or first strike to equipped attackers",
        "Draft cheap equipment like Beamtown Beatstick to generate Treasure",
        "Attack Siege Battles aggressively to unlock flipped rewards"
],
      "keyCommons": ["Beamtown Beatstick","Kithkin Billyrider","Ral's Reinforcements"],
      "headline": "Backup Aggro \u2022 Swift Cavalry Strike",
      "description": "Red-White curves out aggressively, using backup triggers to grant first strike and haste to low-mana vanguard attackers.",
      "mechanics": [
        "Backup",
        "Haste",
        "Combat Pump"
      ]
    },
    "GU": {
      "name": "+1/+1 Counters Transform & Ramp",
      "guildName": "Simic",
      "pace": "Midrange",
      "draftPointers": [
        "Ramp mana to transform double-faced cards and incubate tokens",
        "Mutagen Connoisseur grants flying and huge power based on transformed cards",
        "Overpower opponents with giant transformed beaters"
],
      "keyCommons": ["Eyes of Gitaxias","Overgrown Pest","Preening Champion"],
      "headline": "Transform & Ramp \u2022 Multiverse Mutation",
      "description": "Green-Blue accelerates extra lands onto the battlefield to pay the transform costs of high-impact Incubator and double-faced cards.",
      "mechanics": [
        "Transform Costs",
        "Land Ramp",
        "Big Spells"
      ]
    }
  },
  "ONE": {
    "WU": {
      "name": "Artifacts & Corrupted Skies",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft artifact creatures to turn on metalcraft and artifact count bonuses",
        "Get the opponent to 3 poison counters early to unlock Corrupted abilities",
        "Flyers push through toxic damage over ground stalemates"
],
      "keyCommons": ["Apostle of Invasion","Atmosphere Surgeon","Mandible Justiciar"],
      "headline": "Corrupted & Artifacts \u2022 Dross Prowlers & Evasion",
      "description": "White-Blue unlocks powerful Corrupted bonuses once an opponent has three or more poison counters, flying over blockers with artifact sentries.",
      "mechanics": [
        "Corrupted (3+ Poison)",
        "Artifacts",
        "Flying"
      ]
    },
    "UB": {
      "name": "Proliferate & Corrupted Control",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Inflict 1-2 poison counters early, then Proliferate them up to 10 for the win",
        "Corrupted cards gain deathtouch, lifelink, or card draw when opponent has 3 poison",
        "Draft blue and black proliferate spells that also remove blockers"
],
      "keyCommons": ["Drown in Ichor","Experimental Augury","Vivisurgeon's Cradle"],
      "headline": "Corrupted Proliferate \u2022 Toxic Sabotage & Control",
      "description": "Blue-Black applies early poison counters and proliferates them from the shadows, locking opponents down with corrupted removal.",
      "mechanics": [
        "Proliferate",
        "Toxic",
        "Poison Counters"
      ]
    },
    "BR": {
      "name": "Oil Counters & Direct Sacrifice",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Stack oil counters on creatures that remove counters to deal direct damage",
        "Sacrifice artifact creatures to trigger burn and draw extra cards",
        "Keep the pressure relentlessly high to win before poison decks assemble"
],
      "keyCommons": ["Barbed Batterfist","Chimney Rabble","Hazardous Blast"],
      "headline": "Oil & Sacrifice \u2022 Furnace Layer Demolition",
      "description": "Black-Red harvests Oil counters from dying creatures, detonating them for explosive combat buffs and direct burn.",
      "mechanics": [
        "Oil Counters",
        "Sacrifice",
        "Direct Damage"
      ]
    },
    "RG": {
      "name": "Oil Counters & Ferocious Beatdown",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Creatures enter with oil counters that grant trample, haste, and power buffs",
        "Draft oil synergy engines like Cindersmith to control combat",
        "Overrun blockers with giant 4+ power tramplers"
],
      "keyCommons": ["Contagious Vorrac","Furnace Strider","Lattice Blade"],
      "headline": "Oil Stompy \u2022 4+ Power Trample Overrun",
      "description": "Red-Green loads Oil counters onto massive 4+ power predators, removing counters to grant trample, haste, and power boosts.",
      "mechanics": [
        "Oil Counters",
        "4+ Power",
        "Trample"
      ]
    },
    "GW": {
      "name": "Toxic Go-Wide & Corrupted Swarm",
      "guildName": "Selesnya",
      "pace": "Aggro",
      "draftPointers": [
        "Swarm the board with 1- and 2-drop Toxic 1 creatures and Mite tokens",
        "Mite tokens can't block, so attack aggressively every turn",
        "Corrupted triggers buff your entire army once the opponent hits 3 poison"
],
      "keyCommons": ["Crawling Chorus","Flensing Raptor","Pestilent Syphoner"],
      "headline": "Toxic Swarm \u2022 Mite Army & Corrupted Anthems",
      "description": "Green-White floods the board with 1/1 Toxic Mite tokens (which can't block), swarming opponents with lethal poison pressure.",
      "mechanics": [
        "Toxic Swarm",
        "Mite Tokens",
        "Poison Anthems"
      ]
    },
    "WB": {
      "name": "Corrupted Aristocrats & Toxic Bleed",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Get opponent to 3 poison to turn on your Corrupted engines permanently",
        "Vivisection and sacrifice outlets turn blocked Toxic creatures into card draw",
        "Bleed opponents out through poison counters and life drain"
],
      "keyCommons": ["Crawling Chorus","Drown in Ichor","Pestilent Syphoner"],
      "headline": "Corrupted Toxic \u2022 Machine Cult Bleed",
      "description": "White-Black poisons the opponent to three counters early, activating oppressive life drain and exile removal across the board.",
      "mechanics": [
        "Corrupted",
        "Toxic",
        "Life Drain"
      ]
    },
    "UR": {
      "name": "Oil Counters & Noncreature Burn",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Noncreature spells add oil counters to your creatures and artifacts",
        "Remove oil counters to draw cards, burn creatures, or boost power",
        "Draft cheap cantrips and burn spells to maintain counter generation"
],
      "keyCommons": ["Experimental Augury","Hazardous Blast","Tamiyo's Logbook"],
      "headline": "Oil & Spells \u2022 Laboratory Velocity & Burn",
      "description": "Blue-Red places Oil counters on creatures whenever you cast noncreature spells, unlocking evasive beatdowns and lethal burn spells.",
      "mechanics": [
        "Oil Counters",
        "Noncreature Spells",
        "Prowess"
      ]
    },
    "BG": {
      "name": "Toxic & Graveyard Recursion",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Draft high-toughness Toxic creatures that trade favorably in combat",
        "Proliferate poison counters while recurring fallen Toxic threats",
        "Win either through 10 poison counters or traditional combat damage"
],
      "keyCommons": ["Contagious Vorrac","Drown in Ichor","Pestilent Syphoner"],
      "headline": "Toxic & Deathtouch \u2022 Surgical Attrition",
      "description": "Black-Green pairs toxic attackers with deathtouch blockers, winning wars of attrition and poisoning opponents in combat.",
      "mechanics": [
        "Toxic",
        "Deathtouch",
        "Graveyard Recursion"
      ]
    },
    "RW": {
      "name": "For Mirrodin! Equipment Aggro",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "For Mirrodin! equipment enters with a 2/2 Rebel token attached",
        "Re-equip your weapons to bigger threats after early rebels trade off",
        "Maintain blistering fast aggro curve with 1- and 2-drops"
],
      "keyCommons": ["Barbed Batterfist","Bladehold War-Whip","Mandible Justiciar"],
      "headline": "Equipment & For Mirrodin! \u2022 Rebel Vanguard",
      "description": "Red-White deploys Equipment with the For Mirrodin! ability, creating 2/2 Rebel tokens that enter already equipped for blistering aggro.",
      "mechanics": [
        "For Mirrodin! (Equipment Tokens)",
        "Fast Aggro",
        "Combat Tricks"
      ]
    },
    "GU": {
      "name": "Toxic & Proliferate Ramp",
      "guildName": "Simic",
      "pace": "Midrange",
      "draftPointers": [
        "Inflict poison early with unblockable toxic creatures",
        "Ramp mana while proliferating poison and +1/+1 counters each turn",
        "Proliferate spells double as interaction to clear the board"
],
      "keyCommons": ["Contagious Vorrac","Experimental Augury","Thrummingbird"],
      "headline": "Proliferate & Adapt \u2022 Evolutionary Poison Ramp",
      "description": "Green-Blue proliferates poison, +1/+1, and oil counters simultaneously, scaling creatures into unstoppable biological behemoths.",
      "mechanics": [
        "Proliferate",
        "Poison Scaling",
        "+1/+1 Counters"
      ]
    }
  },
  "BRO": {
    "WU": {
      "name": "Soldiers Go-Wide & Skies",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft Soldier tribal creatures to unlock team-wide stat buffs",
        "Soldier tokens scale with anthem effects like Yotian Tactician",
        "Flyers push combat damage while ground soldiers hold back attackers"
],
      "keyCommons": ["Aeronaut Cavalry","Phalanx Vanguard","Wing Commando"],
      "headline": "Draw 2 & Soldiers \u2022 Aerial Automation",
      "description": "White-Blue rewards drawing a second card each turn, building a formidable sky force of soldiers and flying thopters.",
      "mechanics": [
        "Draw 2nd Card",
        "Soldiers",
        "Flying"
      ]
    },
    "UB": {
      "name": "Draw Two Cards Control & Sabotage",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Draft cantrips and looting spells to draw two cards each turn",
        "Drawing your second card unlocks stat buffs, mill, and token creation",
        "Control combat with premium black removal and blue bounce"
],
      "keyCommons": ["Goring Warplow","Lat-Nam's Legacy","Scrapwork Cohort"],
      "headline": "Draw 2 & Graveyard \u2022 Discard & Sabotage Control",
      "description": "Blue-Black loots through the library, triggering draw-2 bonuses and reanimating high-cost war machines from the graveyard.",
      "mechanics": [
        "Draw 2nd Card",
        "Self-Discard",
        "Reanimation"
      ]
    },
    "BR": {
      "name": "Unearth & Aggressive Sacrifice",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Unearth brings artifact creatures back from the graveyard with haste",
        "Sacrifice unearth creatures before end of turn to get double value",
        "Push high aggressive damage before opponents assemble big engines"
],
      "keyCommons": ["Penregon Strongbull","Scrapwork Mutt","Scrapwork Rager"],
      "headline": "Unearth & Sacrifice \u2022 Mishra's Scrap Yard Aggro",
      "description": "Black-Red unearths fallen automatons for temporary attacks and sacrifices them to draw cards or deal direct damage before they exile.",
      "mechanics": [
        "Unearth",
        "Artifact Sacrifice",
        "Menace"
      ]
    },
    "RG": {
      "name": "Powerstones & Big Artifact Stompy",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Create Powerstone tokens to ramp into giant 7+ mana artifact colossi",
        "Powerstones pay for activated abilities and artifact casting costs",
        "Prototype cards provide early game curve and late-game huge stompy bodies"
],
      "keyCommons": ["Boulderbranch Golem","Fallaji Excavator","Rust Goliath"],
      "headline": "Powerstones & Stompy \u2022 Colossal Engine Beatdown",
      "description": "Red-Green generates Powerstone tokens to ramp into massive 7+ mana prototypes and trampling war beasts ahead of schedule.",
      "mechanics": [
        "Powerstone Tokens",
        "4+ Power",
        "Trample"
      ]
    },
    "GW": {
      "name": "Artifact Fall & +1/+1 Counters",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Creatures get +1/+1 counters whenever an artifact enters your battlefield",
        "Powerstone generation continuously triggers artifact-fall bonuses",
        "Yotian Dissident turns every artifact into permanent board growth"
],
      "keyCommons": ["Citanul Stalwart","Phalanx Vanguard","Scrapwork Cohort"],
      "headline": "Artifact Tokens & +1/+1 \u2022 Mechanical Army Growth",
      "description": "Green-White distributes permanent +1/+1 counters across its creatures whenever artifacts enter the battlefield under your command.",
      "mechanics": [
        "Artifacts Entering",
        "+1/+1 Counters",
        "Go-Wide"
      ]
    },
    "WB": {
      "name": "Small Artifact Recursion & Attrition",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Recur 3-mana or less artifacts and creatures from the graveyard repeatedly",
        "Tocasia's Onslaught and death triggers drain opponent while buffering your life",
        "Unearth creatures provide disposable sacrifice fodder"
],
      "keyCommons": ["Aeronaut Cavalry","Disfigure","Scrapwork Rager"],
      "headline": "Reanimation & Small Artifacts \u2022 Trenches Attrition",
      "description": "White-Black recurs low-mana artifacts and creatures (mana value 3 or less) from the graveyard, grinding out value through attrition.",
      "mechanics": [
        "Small Reanimation (<= 3 CMC)",
        "Aristocrats",
        "Drain"
      ]
    },
    "UR": {
      "name": "Third Turn Prowess & Noncreature Velocity",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Chain cheap cantrips and burn spells to trigger noncreature payoffs",
        "Drawing extra cards fuels Third Path Iconoclast for infinite soldier tokens",
        "Direct burn spells finish off opponents after tempo attacks"
],
      "keyCommons": ["Curate","Mishra's Onslaught","Stern Lesson"],
      "headline": "Third Path Noncreatures \u2022 Artifact Prowess & Token Army",
      "description": "Blue-Red casts noncreature spells to create 1/1 Soldier tokens with Third Path Iconoclast, chaining cheap cantrips into lethal boards.",
      "mechanics": [
        "Noncreature Spells",
        "Soldier Tokens",
        "Velocity"
      ]
    },
    "BG": {
      "name": "Self-Mill & Graveyard Unearth",
      "guildName": "Golgari",
      "pace": "Control",
      "draftPointers": [
        "Mill your library to fill the graveyard with Unearth artifact creatures",
        "Golgari treats the graveyard as an extended second hand",
        "Recur high-impact bombs with green and black recursion spells"
],
      "keyCommons": ["Blanchwood Prowler","Gnawing Vermin","Ravenous Gigamole"],
      "headline": "Graveyard Dredge & Morbid \u2022 Spider Recycling",
      "description": "Black-Green self-mills cards to empower graveyard-scaling creatures like Skyfisher Spider, turning a full yard into victory.",
      "mechanics": [
        "Self-Mill",
        "Graveyard Count",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Unearth Aggro & Prototype Tokens",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Cast cheap Prototype creatures to curve out on turns 1-3",
        "Unearth fallen attackers to push through lethal alpha strikes",
        "Draft team buffs that maximize value across wide token boards"
],
      "keyCommons": ["Mishra's Onslaught","Phalanx Vanguard","Scrapwork Cohort"],
      "headline": "Unearth Soldiers \u2022 Blitzkrieg Aggro",
      "description": "Red-White curves out with low-mana Soldiers and unearths them for surprise lethal alpha strikes through opposing blockers.",
      "mechanics": [
        "Soldiers",
        "Unearth",
        "Low Curve Aggro"
      ]
    },
    "GU": {
      "name": "Powerstone Ramp & Colossal Automata",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Stockpile Powerstone tokens to hardcast colossal 8-10 mana automata",
        "Powerstones pay for high-cost activated abilities every turn",
        "Draw spells keep your hand full of colossal threats"
],
      "keyCommons": ["Boulderbranch Golem","Citanul Stalwart","Stern Lesson"],
      "headline": "Powerstones & Titans \u2022 Urza's Colossal Workshop",
      "description": "Green-Blue ramps powerstone mana to deploy the largest prototype and artifact titans in the format, drawing cards to sustain threats.",
      "mechanics": [
        "Powerstone Ramp",
        "Prototype Titans",
        "Card Flow"
      ]
    }
  },
  "DMU": {
    "WU": {
      "name": "Domain Skies & Bird Soldiers",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft cheap flying Birds and Soldiers to pressure opponents in the air",
        "Raff, Weatherlight Stalwart taps creatures to draw cards and pump your team",
        "Enlist and tempo tricks push through ground blockers"
],
      "keyCommons": ["Argivian Cavalier","Haunting Figment","Phyrexian Espionage"],
      "headline": "Birds & Flash \u2022 Weatherlight Sky Patrol",
      "description": "White-Blue attacks with flying Birds and flash creatures, tapping two creatures to draw cards and holding up protective countermagic.",
      "mechanics": [
        "Flying",
        "Flash",
        "Creature Tapping"
      ]
    },
    "UB": {
      "name": "Kicker Control & Sabotage",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Draft spells with off-color Kicker to unlock massive 2-for-1 advantages",
        "Vohar, Vodalian Desecrator loots and recuts instant/sorcery spells",
        "Control combat with black removal and blue counterspells"
],
      "keyCommons": ["Extinguish the Light","Phyrexian Espionage","Rona's Vortex"],
      "headline": "Kicker Control & Saboteurs \u2022 Tolarian Secrets",
      "description": "Blue-Black plays classic control with kicker spells, recurring instants from the graveyard and disrupting opposing hands with shadow rogues.",
      "mechanics": [
        "Kicker",
        "Spell Recursion",
        "Saboteur"
      ]
    },
    "BR": {
      "name": "Aggro Sacrifice & Morbid Burn",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Sacrifice Goblin tokens and expendable creatures to trigger direct burn",
        "Lagomos, Hand of Hatred generates a free 2/1 trampling attacker every turn",
        "Keep your curve low to punish slow 5-color domain decks"
],
      "keyCommons": ["Flowstone Infusion","Phyrexian Rager","Splat"],
      "headline": "Sacrifice & Raid \u2022 Goblin Assault & Death Triggers",
      "description": "Black-Red attacks relentlessly each turn, sacrificing expendable tokens and goblins to trigger lethal death and burn abilities.",
      "mechanics": [
        "Sacrifice",
        "Raid",
        "Direct Burn"
      ]
    },
    "RG": {
      "name": "Domain Stompy & 5-Color Ramp",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Draft dual lands early to hit Domain 4-5 by turn 4",
        "Domain boosts power and toughness to enormous stats",
        "Trample over defenses with colossal domain monsters"
],
      "keyCommons": ["Bite Down","Magnigoth Sentry","Yavimaya Sojourner"],
      "headline": "Domain Stompy \u2022 5-Color Basic Land Beatdown",
      "description": "Red-Green gathers basic land types to supercharge Domain abilities, turning trampling monsters into massive lethal threats.",
      "mechanics": [
        "Domain (Basic Land Count)",
        "4+ Power",
        "Trample"
      ]
    },
    "GW": {
      "name": "Domain Go-Wide & Token Swarm",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Draft token generators and Enlist creatures to go wide",
        "Baird, Argivian Recruiter generates soldier tokens whenever creatures are pumped",
        "Team anthems turn your wide board into an unblockable alpha strike"
],
      "keyCommons": ["Argivian Cavalier","Bite Down","Floriferous Vinewall"],
      "headline": "Go-Wide Tokens & Enlist \u2022 Coalition Army",
      "description": "Green-White swarms the board with 1/1 Soldier tokens and uses the Enlist mechanic to tap backline tokens, boosting vanguard attacker power.",
      "mechanics": [
        "Enlist",
        "Soldier Tokens",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Phyrexian Sacrifice & Enlist Bleed",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Enlist allows tapped creatures to lend their power to attacking bodies",
        "Sacrifice creatures to drain life and draw cards with Elas il-Kor",
        "Grind opponents out with incremental life total bleed"
],
      "keyCommons": ["Argivian Cavalier","Extinguish the Light","Phyrexian Rager"],
      "headline": "Sacrifice & Clerics \u2022 Aristocrats Life Drain",
      "description": "White-Black profits on creature deaths with Elas il-Kor, gaining life and draining opponents whenever any creature falls in battle.",
      "mechanics": [
        "Aristocrats",
        "Life Gain & Drain",
        "Death Triggers"
      ]
    },
    "UR": {
      "name": "Spellslinger & Kicker Prowess",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Chain cheap instant and sorcery spells to trigger prowess buffs",
        "Balmor, Battlemage Captain gives your entire board +1/+0 and trample on spell casts",
        "Burn spells remove blockers and burn opposing life totals"
],
      "keyCommons": ["Flowstone Infusion","Impulse","Tolarian Terror"],
      "headline": "Spellslinger Velocity & Kicker \u2022 Tolarian Geysers",
      "description": "Blue-Red chains cheap cantrips and kicked burn spells, triggering prowess-style growth on spell-centric creatures.",
      "mechanics": [
        "Instants & Sorceries",
        "Kicker",
        "Spell Velocity"
      ]
    },
    "BG": {
      "name": "Graveyard Scaling & Domain Recursion",
      "guildName": "Golgari",
      "pace": "Control",
      "draftPointers": [
        "Fill your graveyard with creatures to power up graveyard-scaling beaters",
        "Recur high-impact bombs with Urborg Repossession",
        "Deathtouch and defensive walls hold ground against aggressive starts"
],
      "keyCommons": ["Bite Down","Extinguish the Light","Urborg Repossession"],
      "headline": "Domain Graveyard \u2022 Saproling Decomposition",
      "description": "Black-Green utilizes domain and graveyard recursion, exiling fallen creatures to spawn Saprolings and recycling key bombs.",
      "mechanics": [
        "Domain",
        "Graveyard Exile",
        "Saproling Tokens"
      ]
    },
    "RW": {
      "name": "Enlist Aggro & Combat Dominance",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Enlist allows your 1- and 2-drops to boost attacking threats to lethal power",
        "Tori D'Avenant untaps attackers and grants vigilance and trample",
        "Attack every turn to close out matches before domain decks stabilize"
],
      "keyCommons": ["Argivian Cavalier","Flowstone Infusion","Keldon Strike Team"],
      "headline": "Enlist Aggro \u2022 Heroic Charge & Combat Tricks",
      "description": "Red-White attacks early with enlist vanguards, boosting power with backline creatures and clearing blockers with combat tricks.",
      "mechanics": [
        "Enlist",
        "Combat Tricks",
        "Fast Aggro"
      ]
    },
    "GU": {
      "name": "Kicker & Domain Ramp",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Draft dual lands and green fixing to enable all 5 colors",
        "Kick spells with off-color mana for game-winning value",
        "Deploy massive Domain leviathans and Tolarian Terror for 1 mana"
],
      "keyCommons": ["Bite Down","Impulse","Tolarian Terror"],
      "headline": "Domain Ramp \u2022 Awakening the Lands",
      "description": "Green-Blue ramps basic lands to max out Domain, turning lands into elemental creatures with Tatyova and drawing infinite cards.",
      "mechanics": [
        "Domain (5 Colors)",
        "Land Ramp",
        "Big Spells"
      ]
    }
  },
  "NEO": {
    "WU": {
      "name": "Vehicles & Artifact Skies",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft cheap artifact creatures to crew high-stat vehicles",
        "Prodigy's Prototype generates Pilot tokens and crews vehicles automatically",
        "Flyers and unblockable pilots push lethal damage over ground walls"
],
      "keyCommons": ["Kitsune Ace","Network Terminal","Suit Up"],
      "headline": "Vehicles & Mechs \u2022 Cybernetic Air Fleet",
      "description": "White-Blue crews high-tech Mechs and Vehicles, generating pilot tokens to cheat crew costs and soaring over ground blockers.",
      "mechanics": [
        "Vehicles",
        "Crew",
        "Pilot Tokens"
      ]
    },
    "UB": {
      "name": "Ninjutsu & Saboteur Steal",
      "guildName": "Dimir",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Attack with unblockable 1-drops (Network Disruptor), then Ninjutsu in threats",
        "Ninjutsu returns creatures to hand, resetting enter-the-battlefield abilities",
        "Silver-Fur Master discounts all Ninjas and Rogues while buffing stats"
],
      "keyCommons": ["Moon-Circuit Hacker","Network Disruptor","Okiba Reckoner Raid"],
      "headline": "Ninjas & Ninjutsu \u2022 Silent Shadow Saboteurs",
      "description": "Blue-Black slips unblocked attackers through enemy defenses and ninjutsus deadly Ninjas to draw cards and bounce blockers.",
      "mechanics": [
        "Ninjutsu",
        "Unblockable",
        "Saboteur Card Draw"
      ]
    },
    "BR": {
      "name": "Artifact & Enchantment Sacrifice",
      "guildName": "Rakdos",
      "pace": "Synergy / Combo",
      "draftPointers": [
        "Oni-Cult Anvil generates an artifact creature token every turn an artifact leaves",
        "Sacrifice disposable artifacts and Blood tokens to drain opposing life",
        "Assemble an inescapable attrition engine that grinds opponents to 0"
],
      "keyCommons": ["Kami's Flare","Okiba Reckoner Raid","Voltage Surge"],
      "headline": "Artifact Sacrifice \u2022 Oni-Cult Anvil Demolition",
      "description": "Black-Red sacrifices artifacts to Oni-Cult Anvil to manufacture 1/1 Construct tokens, draining opposing life every turn like clockwork.",
      "mechanics": [
        "Artifact Sacrifice",
        "1/1 Constructs",
        "Life Drain"
      ]
    },
    "RG": {
      "name": "Modified Stompy & Trample",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Modified creatures are equipped, enchanted, or have counters on them",
        "Invigorating Hot Spring grants haste and +1/+1 counters to attackers",
        "Overpower defenses with massive trampling modified threats"
],
      "keyCommons": ["Akki Ember-Keeper","Fade into Antiquity","Kami's Flare"],
      "headline": "Modified Stompy \u2022 Cyber-Enhanced Beatdown",
      "description": "Red-Green modifies creatures with +1/+1 counters, equipment, or reconfigure auras, granting haste and trample to aggressive bruisers.",
      "mechanics": [
        "Modified (+1/+1, Equip, Aura)",
        "Haste",
        "Trample"
      ]
    },
    "GW": {
      "name": "Enchantments & Sagas Go-Wide",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Draft Enchantment creatures and transforming Sagas",
        "Jukai Naturalist discounts all enchantments, ramping out fast boards",
        "Sagas flip into creatures after providing 2 chapters of free value"
],
      "keyCommons": ["Careful Cultivation","Fang of Shigeki","Spirited Companion"],
      "headline": "Enchantments Matter & Sagas \u2022 Harmony with Kami",
      "description": "Green-White plays enchantment creatures and transforming Sagas, reducing casting costs and buffing creatures through traditional harmony.",
      "mechanics": [
        "Enchantment Creatures",
        "Sagas",
        "Cost Reduction"
      ]
    },
    "WB": {
      "name": "Artifacts & Enchantments Harmony",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Control both an artifact and an enchantment to unlock maximum bonuses",
        "Naomi, Pillar of Order destroys target creature or artifact every turn you have both",
        "Draft balance: aim for 6+ artifacts and 6+ enchantments"
],
      "keyCommons": ["Intercessor's Arrest","Okiba Reckoner Raid","Spirited Companion"],
      "headline": "Balance of Modern & Ancient \u2022 Artifacts & Enchantments",
      "description": "White-Black reaps immense rewards when controlling both an artifact and an enchantment, unlocking premium removal and lifelink stats.",
      "mechanics": [
        "Control Artifact & Enchantment",
        "Removal",
        "Lifelink"
      ]
    },
    "UR": {
      "name": "Artifacts & Spells Noncreature Burn",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Enthusiastic Mechanaut discounts all artifact spells",
        "Chain cheap artifact creatures and burn spells to trigger prowess buffs",
        "Direct damage clears blockers and burns opposing life totals"
],
      "keyCommons": ["Kami's Flare","Moon-Circuit Hacker","Voltage Surge"],
      "headline": "Artifact Velocity & Reconfigure \u2022 High-Speed Craft",
      "description": "Blue-Red reduces artifact casting costs and triggers noncreature spell bonuses, reconfiguring mechanical familiars for sudden lethal strikes.",
      "mechanics": [
        "Artifact Cost Reduction",
        "Reconfigure",
        "Spellcraft"
      ]
    },
    "BG": {
      "name": "Graveyard Recursion & Balance",
      "guildName": "Golgari",
      "pace": "Control",
      "draftPointers": [
        "Gloomshrieker brings back any permanent card from graveyard to hand",
        "Channel cards put themselves in the graveyard while producing spell effects",
        "Recur high-impact Sagas to loop continuous value"
],
      "keyCommons": ["Fang of Shigeki","Kami of Terrible Secrets","Twisted Embrace"],
      "headline": "Enchantment & Artifact Recursion \u2022 Necrotic Synthesis",
      "description": "Black-Green fills the graveyard with both artifacts and enchantments, recurring key permanents with Gloomshrieker for grinding attrition.",
      "mechanics": [
        "Graveyard Recursion",
        "Exile Triggers",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Samurai & Warriors Solo Attack",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Attack with exactly one Samurai or Warrior to trigger all exalted-style buffs",
        "Asari Captain and Akki Ronin grant massive power buffs to your solo attacker",
        "Equip your solo attacker with first strike or lifelink to dominate combat"
],
      "keyCommons": ["Eiganjo Exemplar","Imperial Subduer","Kami's Flare"],
      "headline": "Samurai & Warriors Exalted \u2022 Solitary Honorable Strike",
      "description": "Red-White attacks alone with a solitary Samurai or Warrior, stacking multiple triggers for massive power and lifelink boosts.",
      "mechanics": [
        "Attack Alone (Exalted)",
        "Samurai & Warriors",
        "First Strike"
      ]
    },
    "GU": {
      "name": "Channel & Big Ramp",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Channel cards are uncounterable spell effects that can be recurred",
        "Colossal Skyturtle provides bounce, recursion, and a 6/5 flying ward 2 win condition",
        "Ramp into huge mana to cast enormous transformed enchantments"
],
      "keyCommons": ["Fade into Antiquity","Fang of Shigeki","Suit Up"],
      "headline": "Channel & Ramp \u2022 Colossal Spirit Evocation",
      "description": "Green-Blue channels cards from hand for flexible spell effects and ramps into giant late-game spirits like Colossal Skyturtle.",
      "mechanics": [
        "Channel Abilities",
        "Land Ramp",
        "Big Spirits"
      ]
    }
  },
  "KHM": {
    "WU": {
      "name": "Foretell Skies & Evasive Tempo",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Foretell cards on turn 2 to cast them for huge mana discounts later",
        "Vega, the Watcher draws a card whenever you cast from foretell or exile",
        "Flyers and bounce spells control the skies and pace of combat"
],
      "keyCommons": ["Augury Raven","Behold the Multiverse","Bound in Gold"],
      "headline": "Foretell & Flying Tempo \u2022 Doomskar Prophecy",
      "description": "White-Blue foretells spells into exile on turn two, casting them ahead of curve to deploy flying spirits and draw extra cards.",
      "mechanics": [
        "Foretell",
        "Cast from Exile",
        "Flying"
      ]
    },
    "UB": {
      "name": "Snow Control & Graveyard Zombies",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Draft Snow dual lands and snow basics to turn on snow payoffs",
        "Narfi, Betrayer King returns from the graveyard for 3 snow mana repeatedly",
        "Grind opponents out with black removal and blue card advantage"
],
      "keyCommons": ["Behold the Multiverse","Feed the Serpent","Mistwalker"],
      "headline": "Snow Control & Zombies \u2022 Draugr Frost Attrition",
      "description": "Blue-Black drafts snow-covered lands to power up frost spells and recur Draugr zombies repeatedly from the frozen graveyard.",
      "mechanics": [
        "Snow Lands",
        "Zombie Recursion",
        "Control"
      ]
    },
    "BR": {
      "name": "Berserkers Aggro & Direct Burn",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Draft Berserker tribal creatures and attack aggressively every turn",
        "Kardur's Vicious Return drains life and recur dead berserkers",
        "Keep your curve low to end matches before snow control decks stabilize"
],
      "keyCommons": ["Demon Bolt","Feed the Serpent","Immersturm Raider"],
      "headline": "Berserkers & Boast Aggro \u2022 Bloodsky Frenzy",
      "description": "Black-Red attacks relentlessly with aggressive Berserkers, activating Boast abilities during combat to destroy blockers and burn opponents.",
      "mechanics": [
        "Boast",
        "Berserkers",
        "Sacrifice Burn"
      ]
    },
    "RG": {
      "name": "Boast & 4+ Power Trample",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Attack with Boast creatures and pay boast costs during or after combat",
        "Koll and Arni Slainbrow grant explosive power and recursion",
        "Trample over small blockers with massive 4+ power trolls and giants"
],
      "keyCommons": ["Demon Bolt","Sarulf's Packmate","Tuskeri Firewalker"],
      "headline": "Boast Stompy & 4+ Power \u2022 Trolls & Beasts",
      "description": "Red-Green ramps into 4+ power trampling beasts and activates boast abilities to dominate combat sizing.",
      "mechanics": [
        "4+ Power",
        "Boast",
        "Trample"
      ]
    },
    "GW": {
      "name": "+1/+1 Counters & Runes Swarm",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Enchant weapons and creatures with Runes that replace themselves by drawing cards",
        "Maja, Bretagard Protector buffs your team and generates tokens on land drops",
        "Distribute +1/+1 counters to build an impenetrable defensive line"
],
      "keyCommons": ["Bound in Gold","Sarulf's Packmate","Story Seeker"],
      "headline": "Tokens & Changelings \u2022 Realmwalker Swarm",
      "description": "Green-White uses all-creature-type Changelings and token generators to trigger multi-tribal anthem bonuses across the entire board.",
      "mechanics": [
        "Changelings",
        "Tokens",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Second Spell Angels & Clerics",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Cast your second spell each turn to trigger Angel and Cleric bonuses",
        "Firja, Judge of Valor digs through your deck whenever you double-spell",
        "Foretell cards enable cheap double-spell turns on turn 4-5"
],
      "keyCommons": ["Bound in Gold","Feed the Serpent","Story Seeker"],
      "headline": "Cast Second Spell \u2022 Valkyrie Wings & Life Drain",
      "description": "White-Black casts two spells in a single turn, triggering Firja's ability to dig through the deck and drain opponent life totals.",
      "mechanics": [
        "Cast 2nd Spell/Turn",
        "Angels & Clerics",
        "Bleed"
      ]
    },
    "UR": {
      "name": "Giants & Spellslinger Burn",
      "guildName": "Izzet",
      "pace": "Midrange",
      "draftPointers": [
        "Draft Giant tribal creatures and high-impact damage spells",
        "Aegar, the Freezing Flame draws a card whenever excess damage is dealt",
        "Combine burn spells with giant combat attacks to draw through your deck"
],
      "keyCommons": ["Behold the Multiverse","Demon Bolt","Mistwalker"],
      "headline": "Giants & Wizardry \u2022 Quakefoot Elemental Cataclysm",
      "description": "Blue-Red casts colossal Giants and Wizard spells, drawing cards whenever high-damage spells deal excess damage to blockers.",
      "mechanics": [
        "Giants",
        "Wizards",
        "Excess Damage Draw"
      ]
    },
    "BG": {
      "name": "Elves & Poison Attrition",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Swarm the board with cheap Elf tokens and tribal lords",
        "Harald, King of Skemfar digs for Elves and Warriors upon entering",
        "Deathtouch and attrition wear down opposing resources"
],
      "keyCommons": ["Feed the Serpent","Jaspera Sentinel","Sarulf's Packmate"],
      "headline": "Elves & Poison Midrange \u2022 Skemfar Court",
      "description": "Black-Green builds a critical mass of Elves, buffing the clan with +1/+1 counters and winning through deathtouch combat and life loss.",
      "mechanics": [
        "Elves Tribal",
        "+1/+1 Counters",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Vehicles & Equipment Dwarf Aggro",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Draft cheap Dwarves and weapons like Tormentor's Helm",
        "Koll, the Forgemaster returns equipped creatures to hand when they die",
        "Equip low-cost attackers to punch through ground blockers"
],
      "keyCommons": ["Bound in Gold","Demon Bolt","Tormentor's Helm"],
      "headline": "Runes & Equipment \u2022 Dwarven Forge Masters",
      "description": "Red-White attaches mystical Runes to equipment and weapons, drawing cards on entry and making attackers practically unkillable.",
      "mechanics": [
        "Equipment",
        "Runes / Auras",
        "Fast Attackers"
      ]
    },
    "GU": {
      "name": "Snow & Shapeshifter Ramp",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Pick Snow lands highly (picks 3-6 in pack 1) to enable snow payoffs",
        "Moritte of the Frost enters as a copy of your best permanent with +1/+1 counters",
        "Ramp into huge mana to cast colossal shapeshifters and sea beasts"
],
      "keyCommons": ["Behold the Multiverse","Boreal Outrider","Sarulf's Packmate"],
      "headline": "Snow & Shapeshifters \u2022 Giant World Tree Ramp",
      "description": "Green-Blue drafts high snow counts to ramp into giant sea serpents and clone best-in-class permanents with Moritte.",
      "mechanics": [
        "Snow Permanents",
        "Changelings",
        "Big Mana"
      ]
    }
  },
  "ZNR": {
    "WU": {
      "name": "Party & Skies Tempo",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft Clerics, Rogues, Warriors, and Wizards to assemble a full party of 4",
        "Party discounts powerful spells like Spoils of Adventure significantly",
        "Evasive fliers bypass ground stalemates while party blocks on the ground"
],
      "keyCommons": ["Cleric of Chill Depths","Kor Celebrant","Tazeem Roilmage"],
      "headline": "Flying & Kicker Tempo \u2022 Skyclave Expedition",
      "description": "White-Blue takes to the skies with evasive Kor and Birds, using kicker spells to control combat tempo and draw fresh cards.",
      "mechanics": [
        "Flying",
        "Kicker",
        "Evasion"
      ]
    },
    "UB": {
      "name": "Rogues & 8+ Cards in Opponent Graveyard",
      "guildName": "Dimir",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft cheap Rogues with flash and flying to mill opponents on combat damage",
        "Unlock massive buffs once the opponent has 8 or more cards in their graveyard",
        "Soaring Thought-Thief pumps all Rogues and fuels continuous mill"
],
      "keyCommons": ["Blood Beckoning","Into the Roil","Subtle Strike"],
      "headline": "Rogues & Opponent Mill \u2022 Shadows in the Deep",
      "description": "Blue-Black mills the opponent's library, activating massive power buffs and card draw once the enemy graveyard contains eight or more cards.",
      "mechanics": [
        "Rogues",
        "Mill (8+ Cards in Opponent Yard)",
        "Flash"
      ]
    },
    "BR": {
      "name": "Party Aggro & Direct Damage",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Assemble cheap party members and attack relentlessly",
        "Zagras, Thief of Heartbeats gives all creatures deathtouch against planeswalkers",
        "Burn spells clear blockers and finish off low-life opponents"
],
      "keyCommons": ["Feed the Swarm","Grotag Bug-Catcher","Roil Eruption"],
      "headline": "Party Aggro & Bleed \u2022 Zagras Deadly Syndicate",
      "description": "Black-Red bands Clerics, Rogues, Warriors, and Wizards together for fast attacks, giving the party deathtouch and haste.",
      "mechanics": [
        "Full Party",
        "Deathtouch",
        "Fast Aggro"
      ]
    },
    "RG": {
      "name": "Landfall Stompy & Trample",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Landfall grants huge power and trample buffs on land drops",
        "Phylath and Brushfire Elemental turn extra land drops into lethal attacks",
        "Draft spell-lands (MDFCs) to ensure you never miss land drops"
],
      "keyCommons": ["Cleansing Wildfire","Kazandu Stomper","Roil Eruption"],
      "headline": "Landfall Stompy & Trample \u2022 Geopede Rush",
      "description": "Red-Green drops lands every turn to trigger explosive stat boosts on Brushfire Elementals, trampling through defensive lines.",
      "mechanics": [
        "Landfall",
        "+2/+2 Land Triggers",
        "Trample"
      ]
    },
    "GW": {
      "name": "Landfall Swarm & +1/+1 Counters",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Landfall triggers put permanent +1/+1 counters across your board",
        "Fearless Fledgling grows into an unstoppable flying win condition",
        "Go wide with token generation and team-wide pump spells"
],
      "keyCommons": ["Fearless Fledgling","Kazandu Stomper","Rabid Bite"],
      "headline": "Landfall Swarm & Counters \u2022 Felidar Anthems",
      "description": "Green-White converts land drops into creature tokens and permanent +1/+1 counters, creating an unbreachable board.",
      "mechanics": [
        "Landfall",
        "+1/+1 Counters",
        "Ramp"
      ]
    },
    "WB": {
      "name": "Clerics & Lifegain Bleed",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Draft Cleric tribal creatures that trigger bonuses whenever you gain life",
        "Orah, Skyclave Hierophant recurs fallen Clerics every time one dies",
        "Bleed opponents out through relentless lifegain differentials"
],
      "keyCommons": ["Blood Beckoning","Cleric of Life's Bond","Feed the Swarm"],
      "headline": "Clerics & Lifegain Drain \u2022 Orah's Resurrection",
      "description": "White-Black gains life continuously with Clerics, triggering Orah to recur fallen allies from the graveyard to the battlefield.",
      "mechanics": [
        "Clerics",
        "Lifegain Triggers",
        "Reanimation"
      ]
    },
    "UR": {
      "name": "Wizards Spellslinger & Burn",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Draft Wizard creatures and instant/sorcery kicker spells",
        "Umara Mystic gains +2/+0 and flying whenever you cast an instant or sorcery",
        "Roil Eruption and burn spells clear the way for aggressive wizard attacks"
],
      "keyCommons": ["Into the Roil","Roil Eruption","Tazeem Roilmage"],
      "headline": "Wizards & Spellslinger \u2022 Roil Mage Velocity",
      "description": "Blue-Red triggers prowess and double-damage bonuses on Wizards whenever instants, sorceries, or kicked spells are cast.",
      "mechanics": [
        "Wizards",
        "Instants/Sorceries",
        "Prowess"
      ]
    },
    "BG": {
      "name": "+1/+1 Counters & Morbid Attrition",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Move +1/+1 counters between creatures when they die",
        "Moss-Pit Skeleton recurs from the graveyard whenever counters are placed",
        "Deathtouch and removal control the board into the late game"
],
      "keyCommons": ["Feed the Swarm","Kazandu Stomper","Rabid Bite"],
      "headline": "+1/+1 Counters & Graveyard Kicker \u2022 Swarm Attrition",
      "description": "Black-Green puts +1/+1 counters on modular creatures, returning Moss-Pit Skeletons from the graveyard to the library.",
      "mechanics": [
        "+1/+1 Counters",
        "Graveyard Return",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Warriors Equipment Aggro",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Draft Warrior creatures and equipment with auto-attach abilities",
        "Kargan Warleader buffs all attacking Warriors with +1/+1",
        "Keep your curve low to overrun opponents before they assemble party"
],
      "keyCommons": ["Grotag Bug-Catcher","Kor Celebrant","Roil Eruption"],
      "headline": "Warriors & Equipment \u2022 Akiri's Blademasters",
      "description": "Red-White equips swift Warriors with swords and shields, unlocking free equip triggers and overwhelming offensive power.",
      "mechanics": [
        "Warriors",
        "Equipment",
        "Fast Combat"
      ]
    },
    "GU": {
      "name": "Landfall Kickers & Big Mana",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Ramp land drops to pay high Kicker costs on your spells",
        "Lullmage's Familiar ramps mana and gains life on kicker casts",
        "Roiling Regrowth enables double-landfall triggers at instant speed"
],
      "keyCommons": ["Into the Roil","Kazandu Stomper","Rabid Bite"],
      "headline": "Kicker & Big Landfall \u2022 Roil Channeling",
      "description": "Green-Blue ramps lands and pays kicker costs on versatile spells, growing gargantuan elementals and drawing limitless cards.",
      "mechanics": [
        "Kicker",
        "Landfall",
        "Big Mana"
      ]
    }
  },
  "GRN": {
    "UB": {
      "name": "House Dimir (UB)",
      "headline": "Surveil & Sabotage Control \u2022 Thought Erasure",
      "description": "Blue-Black manipulates the library with Surveil, sculpting card draws and fueling graveyard synergies to eliminate enemy threats with surgical precision.",
      "mechanics": [
        "Surveil",
        "Graveyard Synergy",
        "Control"
      ]
    },
    "UR": {
      "name": "Izzet League (UR)",
      "headline": "Jump-Start Velocity \u2022 Spellslinger Tempo",
      "description": "Blue-Red casts instants and sorceries twice using Jump-Start from the graveyard, feeding Crackling Drake and Goblin Electromancer for explosive turns.",
      "mechanics": [
        "Jump-Start",
        "Instants & Sorceries",
        "Burn"
      ]
    },
    "BG": {
      "name": "Golgari Swarm (BG)",
      "headline": "Undergrowth Attrition \u2022 Graveyard Midrange",
      "description": "Black-Green mills creatures into the graveyard to maximize Undergrowth abilities, turning creature density into massive stat buffs and life drain.",
      "mechanics": [
        "Undergrowth",
        "Self-Mill",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Boros Legion (RW)",
      "headline": "Mentor Aggro \u2022 Vanguard Combat Training",
      "description": "Red-White curves out with aggressive attackers, using Mentor triggers to pass +1/+1 counters down from larger veterans to smaller recruits every attack.",
      "mechanics": [
        "Mentor (+1/+1 Counter Transfer)",
        "Haste",
        "Fast Aggro"
      ]
    },
    "GW": {
      "name": "Selesnya Conclave (GW)",
      "headline": "Convoke Swarm \u2022 Go-Wide Army Tokens",
      "description": "Green-White floods the board with Lifelink and Vigilance tokens, tapping them to cast massive Convoke spells like Conclave Tribunal ahead of curve.",
      "mechanics": [
        "Convoke",
        "Creature Tokens",
        "Anthems"
      ]
    }
  },
  "RNA": {
    "WU": {
      "name": "Azorius Senate (WU)",
      "headline": "Addendum Tempo \u2022 Order & Sky Law",
      "description": "White-Blue rewards casting spells during your main phase with Addendum bonuses, detaining opposing attackers and dominating the air with flying griffins.",
      "mechanics": [
        "Addendum (Main Phase Bonus)",
        "Flying",
        "Detain Control"
      ]
    },
    "BR": {
      "name": "Cult of Rakdos (BR)",
      "headline": "Spectacle Aggro \u2022 Carnival of Blood & Burn",
      "description": "Black-Red damages the opponent each turn to unlock discounted Spectacle casting costs, swarming blockers with menace and direct burn.",
      "mechanics": [
        "Spectacle (Discounted Cost)",
        "Direct Burn",
        "Menace"
      ]
    },
    "RG": {
      "name": "Gruul Clans (RG)",
      "headline": "Riot Stompy \u2022 Savage Smash & Haste",
      "description": "Red-Green deploys creatures with the Riot ability, choosing between an immediate haste attack or a permanent +1/+1 counter to smash defenses.",
      "mechanics": [
        "Riot (Haste or +1/+1 Counter)",
        "Trample",
        "4+ Power"
      ]
    },
    "GU": {
      "name": "Simic Combine (GU)",
      "headline": "Adapt & Bio-Growth \u2022 Evolving Mutants",
      "description": "Green-Blue pays excess mana to Adapt creatures with +1/+1 counters, granting flying, trample, and card draw to mutated frog-sharks.",
      "mechanics": [
        "Adapt (+1/+1 Counters)",
        "Bio-Mutation",
        "Ramp"
      ]
    },
    "WB": {
      "name": "Orzhov Syndicate (WB)",
      "headline": "Afterlife Aristocrats \u2022 Debt & Spirit Bleed",
      "description": "White-Black attacks and blocks with Afterlife creatures, creating 1/1 flying Spirit tokens upon death to bleed opponents with Teysa Karlov.",
      "mechanics": [
        "Afterlife (1/1 Flying Spirits)",
        "Aristocrats",
        "Life Drain"
      ]
    }
  },
  "MH3": {
    "WU": {
      "name": "Energy Skies & Blink Tempo",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Generate Energy counters to fuel flyers, tapping, and blink effects",
        "Phelia, Exuberant Shepherd flickers permanents for continuous ETB value",
        "Dominate the air with evasive fliers while holding open counterspells"
],
      "keyCommons": ["Aether Spike","Attunement Specialist","Jolted Awake"],
      "headline": "Energy & Flying Tempo \u2022 Emissary of Soul",
      "description": "White-Blue generates Energy counters through flying creatures and blink effects, spending energy to draw cards and grant evasion.",
      "mechanics": [
        "Energy Counters",
        "Flying",
        "Blink / Flicker"
      ]
    },
    "UB": {
      "name": "Draw/Discard & Psychatog Reanimator",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Loot and discard big bombs directly into the graveyard",
        "Reanimation spells cheat massive threats ahead of curve",
        "Psychatog style synergies turn your graveyard into lethal burst damage"
],
      "keyCommons": ["Brainsurge","Consuming Corruption","Sneaky Snacker"],
      "headline": "Sneak & Draw \u2022 Psychic Frog Sabotage",
      "description": "Blue-Black slips unblockable saboteurs through enemy defenses, drawing cards, discarding for value, and reanimating colossal horrors.",
      "mechanics": [
        "Card Draw",
        "Saboteur",
        "Reanimation"
      ]
    },
    "BR": {
      "name": "Madness & Sacrifice Aggro",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Discard cards with Madness to cast them for extreme discounts at instant speed",
        "Sacrifice disposable artifacts and creature tokens for direct burn",
        "Keep the aggressive pressure high to overrun slower Eldrazi ramp decks"
],
      "keyCommons": ["Basking Broodscale","Eviscerator's Insight","Reckless Pyrosurfer"],
      "headline": "Energy & Madness \u2022 Chthonian Nightmare",
      "description": "Black-Red discards cards to trigger Madness while spending Energy counters to recur fallen creatures repeatedly from the graveyard.",
      "mechanics": [
        "Energy",
        "Madness / Discard",
        "Sacrifice"
      ]
    },
    "RG": {
      "name": "Eldrazi Stompy & Spawn Ramp",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Generate Eldrazi Spawn tokens that sacrifice for {C} mana",
        "Ramp into colossal 7+ mana Eldrazi that dominate the battlefield",
        "Spawn tokens double as chump blockers against aggressive starts"
],
      "keyCommons": ["Eldrazi Repurposer","Horrific Assault","Writhing Chrysalis"],
      "headline": "Eldrazi Spawn & Stompy \u2022 Writhing Chrysalis",
      "description": "Red-Green spawns 0/1 Eldrazi Spawn tokens that sacrifice for colorless mana, accelerating into titanic trampling alien monstrosities.",
      "mechanics": [
        "Eldrazi Spawn (Sac for {C})",
        "4+ Power",
        "Reach & Trample"
      ]
    },
    "GW": {
      "name": "Bestow & Modified Counters",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Cast Bestow enchantment creatures as auras to buff attackers",
        "When the enchanted creature dies, Bestow cards remain as creatures on board",
        "Modified payoffs grant permanent trample and stat growth"
],
      "keyCommons": ["Dog Umbra","Evolution Witness","Nyxborn Unicorn"],
      "headline": "Modified & Bestow \u2022 Rosheen's Enchantments",
      "description": "Green-White modifies creatures with Bestow enchantments and +1/+1 counters, building untouchable heroic beaters.",
      "mechanics": [
        "Modified",
        "Bestow Enchantments",
        "+1/+1 Counters"
      ]
    },
    "WB": {
      "name": "Modified & +1/+1 Reanimation",
      "guildName": "Orzhov",
      "pace": "Midrange",
      "draftPointers": [
        "Recur low-cost modified creatures from the graveyard",
        "Distribute +1/+1 counters to turn on death trigger payoffs",
        "Grind opponents out through life drain and persistent recursion"
],
      "keyCommons": ["Dog Umbra","Drossclaw","Refurbished Familiar"],
      "headline": "Energy Aristocrats \u2022 Marionette Apprentice",
      "description": "White-Black generates energy and artifact tokens, draining opponent life totals whenever artifacts or creatures leave the battlefield.",
      "mechanics": [
        "Energy",
        "Fabricate / Tokens",
        "Death Triggers"
      ]
    },
    "UR": {
      "name": "Energy Spellslinger & Burn",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Cast instant and sorcery spells to accumulate massive energy reserves",
        "Spend energy on direct damage, card draw, and explosive token generation",
        "Chain spells to trigger prowess and cost reductions"
],
      "keyCommons": ["Galvanic Discharge","Tune the Narrative","Unstable Amulet"],
      "headline": "Energy Spellslinger \u2022 Generatorium Velocity",
      "description": "Blue-Red harvests energy every time an instant or sorcery resolves, fueling explosive burn spells and card advantage engines.",
      "mechanics": [
        "Energy on Spellcast",
        "Velocity",
        "Direct Burn"
      ]
    },
    "BG": {
      "name": "Graveyard Dredge & Morbid Recursion",
      "guildName": "Golgari",
      "pace": "Control",
      "draftPointers": [
        "Self-mill cards into your graveyard to fuel delirium and threshold",
        "Wight of the Reliquary grows massive as creatures enter the graveyard",
        "Deathtouch and removal grind opponents out of resources"
],
      "keyCommons": ["Basking Broodscale","Drossclaw","Wurmcoil Larva"],
      "headline": "Graveyard Adapt & Land Sac \u2022 Wight of the Reliquary",
      "description": "Black-Green sacrifices lands and mills cards to grow Wight of the Reliquary, converting a stocked graveyard into overwhelming board power.",
      "mechanics": [
        "Self-Mill",
        "Land Sacrifice",
        "Graveyard Sizing"
      ]
    },
    "RW": {
      "name": "Energy Aggro & Battlecry Swarm",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Spend energy on aggressive combat buffs and extra attack tokens",
        "Curve out with fast 1- and 2-drops to end games before Eldrazi arrive",
        "Galvanic Discharge and burn spells remove blockers cheaply"
],
      "keyCommons": ["Galvanic Discharge","Jolted Awake","Phlage Fodder"],
      "headline": "Energy Aggro Swarm \u2022 Phlage's Titan Assault",
      "description": "Red-White attacks with aggressive low-curve energy creatures, spending energy for combat pump and escaping Titans from the graveyard.",
      "mechanics": [
        "Energy",
        "Low Curve Aggro",
        "Combat Pump"
      ]
    },
    "GU": {
      "name": "Eldrazi Ramp & Spawn Generation",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Generate swarms of Eldrazi Spawn to ramp into game-ending titans",
        "Drowner of Hope style Eldrazi tap opposing blockers and grant extra turns",
        "Draw cards to ensure steady deployment of colossal threats"
],
      "keyCommons": ["Basking Broodscale","Eldrazi Repurposer","Snapping Voidcraw"],
      "headline": "Eldrazi Ramp & Big Titans \u2022 Horrific Infiltration",
      "description": "Green-Blue ramps mana quickly through spawn and land search, deploying devastating 7+ mana Eldrazi titans that warp the game.",
      "mechanics": [
        "Eldrazi Titans",
        "Mana Ramp",
        "Card Flow"
      ]
    }
  },
  "DFT": {
    "WU": {
      "name": "Aerocraft Aviators & Vehicles",
      "guildName": "Azorius",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Deploy evasive pilots and crew agile flying vehicles",
        "Bounce blockers to push high vehicle combat damage",
        "Keep open mana for countermagic while attacking through the air"
],
      "keyCommons": ["Air Superiority","Gearshift Ace","Propeller Glider"],
      "headline": "Vehicles & Precision Tuning \u2022 Aerodynamic Piloting",
      "description": "White-Blue crews cutting-edge racing vehicles, generating pilot tokens to cheat crew costs and soaring past defenders with aerial evasion.",
      "mechanics": [
        "Vehicles",
        "Crew",
        "Tap Triggers"
      ]
    },
    "UB": {
      "name": "Slipstream Sabotage & Exhaust Control",
      "guildName": "Dimir",
      "pace": "Control",
      "draftPointers": [
        "Disrupt opposing engines with discard and targeted removal",
        "Slipstream abilities trigger when opponents fall behind on tempo",
        "Win the late game with unblockable sabotage threats"
],
      "keyCommons": ["Engine Stall","Night Market Smuggler","Sabotage Crew"],
      "headline": "Midnight Racers \u2022 Saboteurs, Clues & Shadow Speed",
      "description": "Blue-Black slips through the shadows with unblockable saboteurs, stealing opponent resources and investigating clues along the track.",
      "mechanics": [
        "Unblockable",
        "Saboteur",
        "Clues"
      ]
    },
    "BR": {
      "name": "Demolition Derby & Crash Sacrifice",
      "guildName": "Rakdos",
      "pace": "Aggro",
      "draftPointers": [
        "Ram vehicles into blockers and sacrifice wrecked parts for direct burn",
        "Explosive death triggers punish opponents for blocking your derby cars",
        "Maintain maximum pedal-to-the-metal aggression"
],
      "keyCommons": ["Crash Test Dummy","Fuel Ignition","Scrap Welder"],
      "headline": "Demolition Derby \u2022 Crash Tests, Scrap & Explosions",
      "description": "Black-Red treats vehicles as disposable missiles, ramming into blockers and detonating scrap metal for massive bursts of direct damage.",
      "mechanics": [
        "Vehicle Sacrifice",
        "Direct Burn",
        "Scrap Metal"
      ]
    },
    "RG": {
      "name": "High-Octane Stompy & Power",
      "guildName": "Gruul",
      "pace": "Midrange",
      "draftPointers": [
        "Accelerate mana with nitro ramp into massive high-horsepower threats",
        "Trample over small chump blockers with heavy industrial chassis",
        "Use pump spells as explosive blowout tricks"
],
      "keyCommons": ["Heavy Hauler","Nitro Booster","Rough Terrain Runner"],
      "headline": "Big Rigs & Heavy Haulers \u2022 4+ Power Gearcraft",
      "description": "Red-Green deploys industrial super-haulers and monster trucks, trampling blockers with 4+ power engines and brutal kinetic force.",
      "mechanics": [
        "4+ Power",
        "Trample",
        "Gearcraft"
      ]
    },
    "GW": {
      "name": "Rally Pit Crew & Tuned Engine",
      "guildName": "Selesnya",
      "pace": "Midrange",
      "draftPointers": [
        "Assemble a wide pit crew of tokens to crew and buff giant vehicles",
        "Tuned engine triggers grant permanent +1/+1 counters each combat",
        "Overwhelm opponents with collective crew synergy"
],
      "keyCommons": ["Master Mechanic","Pit Crew Recruit","Tuned Chassis"],
      "headline": "Rally Pit Crew \u2022 Go-Wide Crew Swarm & Anthems",
      "description": "Green-White rallies a bustling pit crew of tokens and mechanics, using team-wide anthem buffs to ensure vehicles are crewed with surplus power.",
      "mechanics": [
        "Go-Wide",
        "Tokens",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Pit Crew Scrap & Rebuild",
      "guildName": "Orzhov",
      "pace": "Control",
      "draftPointers": [
        "Salvage destroyed vehicles and crew members from the scrapyard",
        "Drain opposing life whenever vehicles crash or tokens are sacrificed",
        "Grind opponents out with indestructible defensive walls"
],
      "keyCommons": ["Junkyard Scrapper","Rebuild Specialist","Scrap Tithe"],
      "headline": "Junkyard Salvage \u2022 Vehicle Reanimation & Bleed",
      "description": "White-Black salvages wrecked vehicles and fallen drivers from the graveyard, draining opponent life totals whenever parts are recycled.",
      "mechanics": [
        "Reanimation",
        "Scrap Metal",
        "Life Drain"
      ]
    },
    "UR": {
      "name": "Nitrous Velocity & Burn",
      "guildName": "Izzet",
      "pace": "Aggro-Tempo",
      "draftPointers": [
        "Chain noncreature vehicle mods and burn spells for burst speed",
        "Velocity payoffs pump pilots to extreme power levels in a single turn",
        "Burn opposing blockers to ensure attacks connect cleanly"
],
      "keyCommons": ["Afterburner Shot","Overdrive Cantrip","Speed Demon"],
      "headline": "Nitro Spellslinger \u2022 High-Octane Burn & Velocity",
      "description": "Blue-Red burns nitrous fuel by chaining instant and sorcery spells, triggering prowess-style acceleration and flaming exhaust damage.",
      "mechanics": [
        "Spellslinger",
        "Haste",
        "Prowess"
      ]
    },
    "BG": {
      "name": "Scrapyard Scavenging & Attrition",
      "guildName": "Golgari",
      "pace": "Midrange",
      "draftPointers": [
        "Recycle discarded metal and dead crew members into massive monsters",
        "Deathtouch mechanics halt opposing high-speed attackers dead in their tracks",
        "Self-mill fuels limitless scrap recursion"
],
      "keyCommons": ["Bio-Fuel Harvester","Scrap Collector","Toxic Exhaust"],
      "headline": "Scrap Yard Scavengers \u2022 Graveyard Recycling & Deathtouch",
      "description": "Black-Green harvests raw materials from the scrap yard, utilizing deathtouch mechanics and graveyard recursion to out-grind rivals.",
      "mechanics": [
        "Self-Mill",
        "Scrap Recycling",
        "Deathtouch"
      ]
    },
    "RW": {
      "name": "Breakneck Racing & Speed Aggro",
      "guildName": "Boros",
      "pace": "Aggro",
      "draftPointers": [
        "Deploy blistering fast 1- and 2-drop drivers with haste",
        "Crew aggressive vehicles on curve before opponents can establish blockers",
        "Close games out fast with first strike and team-wide haste buffs"
],
      "keyCommons": ["Checkered Flag Sprinter","Hot Rod Raider","Starting Grid Bell"],
      "headline": "Redline Burnout \u2022 Hyper Aggro & Nitro Boosts",
      "description": "Red-White redlines the tachometer with low-mana speedsters, using equipment and combat tricks to cross the finish line before opponents react.",
      "mechanics": [
        "Fast Attackers",
        "Haste",
        "Combat Pump"
      ]
    },
    "GU": {
      "name": "Turbo Overclock & Engine Ramp",
      "guildName": "Simic",
      "pace": "Control",
      "draftPointers": [
        "Ramp land and energy production to power colossal experimental machines",
        "Overclock engines to draw massive card volume into the midgame",
        "Deploy titan vehicles that close games in 1-2 combat swings"
],
      "keyCommons": ["Energy Supercharger","Hydro-Turbine","Mega-Colossus"],
      "headline": "Turbo Bio-Ramp \u2022 Supercharged Lands & Colossi",
      "description": "Green-Blue supercharges the engine with land ramp, converting surplus energy into colossal late-game bio-mechanical racing juggernauts.",
      "mechanics": [
        "Land Ramp",
        "Big Mana",
        "Card Draw"
      ]
    }
  },
  "FIN": {
    "WU": {
      "name": "White Mage & Paladin (WU)",
      "headline": "Protective Wards, Flying Chocobos & Job Mastery",
      "description": "White-Blue combines protective White Magic wards with agile Chocobo riders, controlling combat pacing while soaring over defenses.",
      "mechanics": [
        "Job Synergy",
        "Wards",
        "Flying"
      ]
    },
    "UB": {
      "name": "Black Mage & Ninja (UB)",
      "headline": "Status Ailments, Instant Death & Shadow Stealth",
      "description": "Blue-Black unleashes debilitation status spells like Sleep and Bio, slipping Ninjas past defenders and casting instant-death removal.",
      "mechanics": [
        "Status Debuffs",
        "Direct Kill",
        "Saboteur"
      ]
    },
    "BR": {
      "name": "Dark Knight & Dragoon (BR)",
      "headline": "Sacrifice HP for Power, Jump Attacks & Burst Damage",
      "description": "Black-Red pays life totals to fuel devastating Dark Knight cleaves, while Dragoons leap high into the air to land crushing jump strikes.",
      "mechanics": [
        "Life Payment",
        "Direct Burn",
        "Jump Attacks"
      ]
    },
    "RG": {
      "name": "Behemoth Stompy (RG)",
      "headline": "Chocobos & Behemoths \u2022 4+ Power Trample Overrun",
      "description": "Red-Green ramps into apex beasts of the wild like Behemoths and Red Chocobos, trampling opposing lines with raw physical power.",
      "mechanics": [
        "Behemoths",
        "4+ Power",
        "Trample"
      ]
    },
    "GW": {
      "name": "Party Unity (GW)",
      "headline": "Full Party Synergy, Anthems & Limit Breaks",
      "description": "Green-White bands together a complete RPG party, stacking team-wide buffs and unleashing game-winning Limit Break alpha strikes.",
      "mechanics": [
        "Full Party",
        "Limit Break",
        "+1/+1 Counters"
      ]
    },
    "WB": {
      "name": "Necromancer & Undead (WB)",
      "headline": "Phoenix Down Reanimation & Death Bleed",
      "description": "White-Black casts Phoenix Down and Arise spells to resurrect fallen allies, draining enemy life totals whenever heroes fall in combat.",
      "mechanics": [
        "Phoenix Down Recursion",
        "Life Drain",
        "Death Triggers"
      ]
    },
    "UR": {
      "name": "Red Mage Spellslinger (UR)",
      "headline": "Dualcast Spells & Fire/Thunder Burst Velocity",
      "description": "Blue-Red chains elemental black and white magic with the Dualcast ability, multiplying spell impact for blistering tempo turns.",
      "mechanics": [
        "Dualcast",
        "Instants & Sorceries",
        "Elemental Burn"
      ]
    },
    "BG": {
      "name": "Malboro Midrange (BG)",
      "headline": "Bad Breath Status Ailments, Poison & Attrition",
      "description": "Black-Green inflicts poisonous debuffs like Bad Breath and Blind, grinding opponents down with insidious damage over time and deathtouch.",
      "mechanics": [
        "Poison / Status",
        "Deathtouch",
        "Attrition"
      ]
    },
    "RW": {
      "name": "Warrior & Monk (RW)",
      "headline": "Flurry of Blows, Weapon Equipment & Haste Aggro",
      "description": "Red-White curves out with martial Warriors and Monks, striking multiple times per turn with legendary weapons and haste attacks.",
      "mechanics": [
        "Flurry / Double Strike",
        "Equipment",
        "Fast Aggro"
      ]
    },
    "GU": {
      "name": "Summoner & Eidolons (GU)",
      "headline": "Big Mana Ramp into Legendary Primal Summons",
      "description": "Green-Blue gathers MP through land acceleration, casting cataclysmic Eidolons like Bahamut, Leviathan, and Titan to dominate the board.",
      "mechanics": [
        "Summons / Eidolons",
        "Land Ramp",
        "Card Flow"
      ]
    }
  },
  "SOS": {
    "WU": {
      "name": "Chronomancy (WU)",
      "headline": "Time Manipulation \u2022 Scrying, Library Pacing & Fliers",
      "description": "Wizards designed White-Blue Chronomancy around temporal pacing, foresight library manipulation, and aerial control, rewarding players who anticipate future turns.",
      "mechanics": [
        "Foresight / Scry",
        "Flying Tempo",
        "Library Manipulation"
      ]
    },
    "UB": {
      "name": "Shadow Saboteurs (UB)",
      "headline": "Forbidden Archives \u2022 Stealth Rogues & Graveyard Secrets",
      "description": "Blue-Black operates from the shadows, infiltrating enemy defenses with unblockable saboteurs that extract valuable secrets and recursive spells from the graveyard.",
      "mechanics": [
        "Saboteur Combat",
        "Unblockable",
        "Graveyard Secrets"
      ]
    },
    "BR": {
      "name": "Blood Magic (BR)",
      "headline": "Reckless Sac \u2022 High-Risk Life Payment & Burst Damage",
      "description": "Black-Red practices forbidden blood casting, paying life and sacrificing experimental creations to trigger devastating spikes of direct damage.",
      "mechanics": [
        "Life Payment",
        "Sacrifice",
        "Direct Burst Burn"
      ]
    },
    "RG": {
      "name": "Elemental Geocasting (RG)",
      "headline": "Earth & Flame \u2022 4+ Power Stompy & Geological Might",
      "description": "Red-Green channels raw elemental earth magic, accelerating mana into towering geological behemoths that smash through enemy lines with trample.",
      "mechanics": [
        "4+ Power",
        "Geological Ramp",
        "Trample"
      ]
    },
    "GW": {
      "name": "Biomancy Cultivation (GW)",
      "headline": "Living Ecology \u2022 +1/+1 Bio-Counters & Flourishing Swarm",
      "description": "Green-White cultivates living magical ecosystems, generating flourishing token creatures and distributing bio-counters across the team.",
      "mechanics": [
        "Bio-Counters",
        "Tokens",
        "Anthems"
      ]
    },
    "WB": {
      "name": "Silverquill Debate (WB)",
      "headline": "Inkling Duels \u2022 Wordplay Combat & Political Bleed",
      "description": "White-Black deploys razor-sharp rhetoric and flying Inkling tokens, bleeding opponent life totals while maneuvering through debate duels.",
      "mechanics": [
        "Inkling Tokens",
        "Debate Triggers",
        "Life Drain"
      ]
    },
    "UR": {
      "name": "Prismari Expression (UR)",
      "headline": "Kinetic Artistry \u2022 5+ Mana Big Spells & Dramatic Velocity",
      "description": "Blue-Red unleashes flamboyant kinetic sorceries, using spell velocity and treasure ramp to cast high-mana elemental masterworks.",
      "mechanics": [
        "5+ Mana Spells",
        "Spell Velocity",
        "Elemental Arts"
      ]
    },
    "BG": {
      "name": "Witherbloom Herbalism (BG)",
      "headline": "Essence Extraction \u2022 Pest Swarms & Vitality Cycles",
      "description": "Black-Green brews potions and cultivates Pest tokens, draining life essence from the living to nourish necrotic growth and graveyard recursion.",
      "mechanics": [
        "Pest Tokens",
        "Life Essence",
        "Attrition"
      ]
    },
    "RW": {
      "name": "Lorehold Excavation (RW)",
      "headline": "Archaeology \u2022 Spirit Legions & Ancient Relics",
      "description": "Red-White unearths historical relics and awakens Spirit armies, recurring artifacts and historical permanents from the graveyard into relentless attacks.",
      "mechanics": [
        "Relic Recursion",
        "Spirit Legions",
        "Excavation"
      ]
    },
    "GU": {
      "name": "Quandrix Numerology (GU)",
      "headline": "Fractal Scale \u2022 Geometric Growth & Exponential Big Mana",
      "description": "Green-Blue solves the equations of the multiverse, generating geometric Fractal tokens that scale exponentially alongside big mana ramp.",
      "mechanics": [
        "Fractal Scale",
        "Doubling Counters",
        "Exponential Ramp"
      ]
    }
  },
  ...EXPANDED_SET_WOTC_ARCHETYPES,
};

const DEFAULT_GUILD_WOTC_ARCHETYPES: Record<string, WOTCArchetypeInfo> = {
  "WU": {
    "name": "Azorius (White/Blue)",
    "headline": "Aerial Superiority \u2022 Flying Creatures & Defensive Tempo",
    "description": "Wizards of the Coast designs White-Blue around evasive flying threats supported by countermagic, bouncing blockers, and protective defensive tricks.",
    "mechanics": [
      "Flying",
      "Blink / Bounce",
      "Tempo & Counterspells"
    ]
  },
  "UB": {
    "name": "Dimir (Blue/Black)",
    "headline": "Sabotage & Control \u2022 Card Advantage, Removal & Graveyard Value",
    "description": "Blue-Black excels at disruption, using efficient black removal and blue counterspells to clear threats while saboteur creatures draw extra cards.",
    "mechanics": [
      "Targeted Removal",
      "Card Advantage",
      "Saboteur Combat"
    ]
  },
  "BR": {
    "name": "Rakdos (Black/Red)",
    "headline": "Aggression & Sacrifice \u2022 High Damage, Burn & Morbid Triggers",
    "description": "Black-Red prioritizes relentless offensive speed, using cheap aggressive creatures and sacrificial synergies to burn through opposing life totals.",
    "mechanics": [
      "Sacrifice Fodder",
      "Direct Burn",
      "Fast Aggro"
    ]
  },
  "RG": {
    "name": "Gruul (Red/Green)",
    "headline": "Primal Stompy \u2022 4+ Power Creatures & Trample Pressure",
    "description": "Red-Green ramps into massive, high-stat creatures with trample and haste, forcing opponents into losing combat trades.",
    "mechanics": [
      "4+ Power Threshold",
      "Mana Ramp",
      "Trample Beatdown"
    ]
  },
  "GW": {
    "name": "Selesnya (Green/White)",
    "headline": "Go-Wide Swarm \u2022 Creature Tokens & +1/+1 Anthems",
    "description": "Green-White floods the battlefield with multiple small creatures and tokens, then buffs the entire army with permanent +1/+1 counters and anthem effects.",
    "mechanics": [
      "Creature Tokens",
      "+1/+1 Counters",
      "Anthem Buffs"
    ]
  },
  "WB": {
    "name": "Orzhov (White/Black)",
    "headline": "Aristocrats & Bleed \u2022 Death Triggers & Life Total Drain",
    "description": "White-Black grinds out value through death triggers and incremental drain, profiting every time a creature leaves the battlefield.",
    "mechanics": [
      "Aristocrats",
      "Life Gain & Drain",
      "Graveyard Recursion"
    ]
  },
  "UR": {
    "name": "Izzet (Blue/Red)",
    "headline": "Spellslinger Velocity \u2022 Instant/Sorcery Chaining & Prowess",
    "description": "Blue-Red rewards chaining multiple noncreature spells in a single turn, triggering prowess buffs, card draw, and targeted burn.",
    "mechanics": [
      "Instants & Sorceries",
      "Prowess / Velocity",
      "Burn & Draw"
    ]
  },
  "BG": {
    "name": "Golgari (Black/Green)",
    "headline": "Graveyard Attrition \u2022 Morbid Recycling & Deathtouch Midrange",
    "description": "Black-Green treats the graveyard as an extension of the hand, milling cards to recur bombs and deploying deathtouch blockers to stall aggressive decks.",
    "mechanics": [
      "Self-Mill",
      "Graveyard Recursion",
      "Deathtouch Attrition"
    ]
  },
  "RW": {
    "name": "Boros (Red/White)",
    "headline": "Go-Wide Aggro \u2022 Equipment, Valiant & Fast Attack Triggers",
    "description": "Red-White curves out with low-mana attackers, using combat tricks, equipment, and attack-phase bonuses to end games before opponents establish control.",
    "mechanics": [
      "Fast Curve",
      "Equipment & Combat Tricks",
      "Attack Triggers"
    ]
  },
  "GU": {
    "name": "Simic (Green/Blue)",
    "headline": "Ramp & Growth \u2022 Extra Lands, Big Mana & Card Flow",
    "description": "Green-Blue accelerates extra lands onto the battlefield, translating excess mana into colossal late-game threats and recurring card draw.",
    "mechanics": [
      "Land Ramp",
      "Big Mana Monsters",
      "Card Draw"
    ]
  }
};


/**
 * In-memory cache for dynamically synthesized archetypes
 */
const DYNAMIC_ARCHETYPE_CACHE = new Map<string, WOTCArchetypeInfo>();

/**
 * Common MTG Limited keyword signatures for on-the-fly oracle text scanning
 */
const KEYWORD_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Flying', pattern: /\bflying\b/i },
  { name: 'Disguise', pattern: /\bdisguise\b|\bcloak\b/i },
  { name: 'Plot', pattern: /\bplot\b/i },
  { name: 'Investigate & Clues', pattern: /\binvestigate\b|\bclue\b/i },
  { name: 'Crimes', pattern: /\bcrime\b|\bcommitted a crime\b/i },
  { name: 'Descend', pattern: /\bdescend\b|\bfathomless descent\b/i },
  { name: 'Explore', pattern: /\bexplore\b|\bmap token\b/i },
  { name: 'Craft', pattern: /\bcraft with\b/i },
  { name: 'Bargain', pattern: /\bbargain\b/i },
  { name: 'Celebration', pattern: /\bcelebration\b/i },
  { name: 'Roles', pattern: /\brole\b|\bmonster role\b|\byoung hero\b|\broyal role\b/i },
  { name: 'The Ring', pattern: /\bthe ring tempts you\b/i },
  { name: 'Amass Orcs', pattern: /\bamass orcs\b/i },
  { name: 'Incubate', pattern: /\bincubate\b/i },
  { name: 'Backup', pattern: /\bbackup\b/i },
  { name: 'Battles', pattern: /\bbattle\b|\bsiege\b/i },
  { name: 'Toxic', pattern: /\btoxic\b|\bpoison counter\b/i },
  { name: 'Corrupted', pattern: /\bcorrupted\b/i },
  { name: 'Oil Counters', pattern: /\boil counter\b/i },
  { name: 'Powerstones', pattern: /\bpowerstone\b/i },
  { name: 'Unearth', pattern: /\bunearth\b/i },
  { name: 'Prototype', pattern: /\bprototype\b/i },
  { name: 'Draw 2 Cards', pattern: /\bdraw your second card\b|\bdraw two or more cards\b/i },
  { name: 'Domain', pattern: /\bdomain\b/i },
  { name: 'Enlist', pattern: /\benlist\b/i },
  { name: 'Kicker', pattern: /\bkicker\b/i },
  { name: 'Vehicles', pattern: /\bvehicle\b|\bcrew\b/i },
  { name: 'Ninjutsu', pattern: /\bninjutsu\b/i },
  { name: 'Modified', pattern: /\bmodified\b/i },
  { name: 'Channel', pattern: /\bchannel\b/i },
  { name: 'Foretell', pattern: /\bforetell\b/i },
  { name: 'Boast', pattern: /\bboast\b/i },
  { name: 'Runes', pattern: /\brune\b/i },
  { name: 'Snow', pattern: /\bsnow\b/i },
  { name: 'Party', pattern: /\bparty\b/i },
  { name: 'Landfall', pattern: /\blandfall\b/i },
  { name: 'Mutate', pattern: /\bmutate\b/i },
  { name: 'Cycling', pattern: /\bcycling\b/i },
  { name: 'Escape', pattern: /\bescape\b/i },
  { name: 'Devotion', pattern: /\bdevotion\b/i },
  { name: 'Adventures', pattern: /\badventure\b/i },
  { name: 'Food', pattern: /\bfood\b/i },
  { name: 'Energy', pattern: /\benergy\b/i },
  { name: 'Forage', pattern: /\bforage\b/i },
  { name: 'Expend', pattern: /\bexpend\b/i },
  { name: 'Valiant', pattern: /\bvaliant\b/i },
  { name: 'Eerie', pattern: /\beerie\b/i },
  { name: 'Survival', pattern: /\bsurvival\b/i },
  { name: 'Rooms', pattern: /\broom\b/i },
  { name: 'Manifest Dread', pattern: /\bmanifest dread\b/i },
  { name: 'Morbid', pattern: /\bmorbid\b|\bdied this turn\b/i },
  { name: '+1/+1 Counters', pattern: /\b\+1\/\+1 counter\b/i },
  { name: 'Tokens', pattern: /\bcreate.*token\b/i },
  { name: 'Sacrifice', pattern: /\bsacrifice\b/i },
  { name: 'Graveyard Recursion', pattern: /\breturn.*from your graveyard\b/i },
  { name: 'Spellslinger & Tempo', pattern: /\bwhenever you cast (an? )?(instant|sorcery|noncreature)\b|\bprowess\b|\binstant or sorcery\b/i },
  { name: '4+ Power', pattern: /\bpower 4 or greater\b/i },
];

/**
 * Prominent tribal subtype detections
 */
const TRIBAL_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Birds', pattern: /\bbird\b/i },
  { name: 'Rats', pattern: /\brat\b/i },
  { name: 'Lizards', pattern: /\blizard\b/i },
  { name: 'Raccoons', pattern: /\braccoon\b/i },
  { name: 'Rabbits', pattern: /\brabbit\b/i },
  { name: 'Bats', pattern: /\bbat\b/i },
  { name: 'Otters', pattern: /\botter\b/i },
  { name: 'Squirrels', pattern: /\bsquirrel\b/i },
  { name: 'Mice', pattern: /\bmouse\b/i },
  { name: 'Frogs', pattern: /\bfrog\b/i },
  { name: 'Detectives', pattern: /\bdetective\b/i },
  { name: 'Dinosaurs', pattern: /\bdinosaur\b/i },
  { name: 'Pirates', pattern: /\bpirate\b/i },
  { name: 'Vampires', pattern: /\bvampire\b/i },
  { name: 'Merfolk', pattern: /\bmerfolk\b/i },
  { name: 'Faeries', pattern: /\bfaerie\b/i },
  { name: 'Halflings', pattern: /\bhalfling\b/i },
  { name: 'Goblins', pattern: /\bgoblin\b/i },
  { name: 'Orcs', pattern: /\borc\b/i },
  { name: 'Knights', pattern: /\bknight\b/i },
  { name: 'Phyrexians', pattern: /\bphyrexian\b/i },
  { name: 'Soldiers', pattern: /\bsoldier\b/i },
  { name: 'Ninjas', pattern: /\bninja\b/i },
  { name: 'Samurai', pattern: /\bsamurai\b/i },
  { name: 'Elves', pattern: /\belf\b|\belves\b/i },
  { name: 'Giants', pattern: /\bgiant\b/i },
  { name: 'Berserkers', pattern: /\bberserker\b/i },
  { name: 'Clerics', pattern: /\bcleric\b/i },
  { name: 'Rogues', pattern: /\brogue\b/i },
  { name: 'Wizards', pattern: /\bwizard\b/i },
  { name: 'Warriors', pattern: /\bwarrior\b/i },
  { name: 'Eldrazi', pattern: /\beldrazi\b/i },
];

/**
 * Synthesizes an authentic WOTC archetype on the fly for uncurated sets
 */
export function synthesizeWOTCArchetypeOnTheFly(
  setCode: string,
  guildCode: string,
  cards: Card[] = []
): WOTCArchetypeInfo {
  const upperCode = (setCode || '').toUpperCase().trim();
  const upperGuild = (guildCode || '').toUpperCase().trim();
  const cacheKey = `${upperCode}_${upperGuild}`;

  if (DYNAMIC_ARCHETYPE_CACHE.has(cacheKey)) {
    return DYNAMIC_ARCHETYPE_CACHE.get(cacheKey)!;
  }

  const guild = GUILD_ARCHETYPES.find((g) => g.code === upperGuild) || {
    code: upperGuild,
    colors: ['W', 'U'] as [MTGColor, MTGColor],
    name: upperGuild,
    defaultTheme: 'Synergy & Tempo',
  };

  const [c1, c2] = guild.colors;
  const color1Name = COLOR_NAMES[c1] || 'Color 1';
  const color2Name = COLOR_NAMES[c2] || 'Color 2';

  if (!cards || cards.length === 0) {
    return DEFAULT_GUILD_WOTC_ARCHETYPES[upperGuild] || {
      name: guild.name,
      headline: guild.defaultTheme,
      description: `Wizards designed ${color1Name}-${color2Name} around ${guild.defaultTheme}.`,
      mechanics: ['Combat', 'Synergy'],
    };
  }

  // 1. Find gold cards of this exact color pair
  const goldCards = cards.filter((c) => {
    const cols = c.colors || [];
    return cols.length === 2 && cols.includes(c1) && cols.includes(c2);
  });

  const goldUncommons = goldCards.filter((c) => c.rarity === 'uncommon');
  const goldRares = goldCards.filter((c) => c.rarity === 'rare' || c.rarity === 'mythic');
  const primarySignpost = goldUncommons[0] || goldRares[0] || goldCards[0];

  // 2. Scan card pool for keyword mentions (heavily weight gold cards)
  const mechanicCounts: Record<string, number> = {};

  goldCards.forEach((c) => {
    const text = `${c.name} ${c.type_line || ''} ${c.oracle_text || ''} ${(c.keywords || []).join(' ')}`;
    KEYWORD_PATTERNS.forEach((kp) => {
      if (kp.pattern.test(text)) {
        mechanicCounts[kp.name] = (mechanicCounts[kp.name] || 0) + 4;
      }
    });
  });

  // Also scan monocolor cards of these two colors
  const monoCards = cards.filter((c) => {
    const cols = c.colors || [];
    return cols.length === 1 && (cols[0] === c1 || cols[0] === c2);
  });

  monoCards.forEach((c) => {
    const text = `${c.name} ${c.type_line || ''} ${c.oracle_text || ''} ${(c.keywords || []).join(' ')}`;
    KEYWORD_PATTERNS.forEach((kp) => {
      if (kp.pattern.test(text)) {
        mechanicCounts[kp.name] = (mechanicCounts[kp.name] || 0) + 1;
      }
    });
  });

  const topMechanics = Object.entries(mechanicCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= 2)
    .slice(0, 3)
    .map(([name]) => name);

  // 3. Scan for prominent tribe
  const tribeCounts: Record<string, number> = {};
  goldCards.forEach((c) => {
    const text = `${c.name} ${c.type_line || ''} ${c.oracle_text || ''}`;
    TRIBAL_PATTERNS.forEach((tp) => {
      if (tp.pattern.test(text)) {
        tribeCounts[tp.name] = (tribeCounts[tp.name] || 0) + 3;
      }
    });
  });

  const prominentTribe = Object.entries(tribeCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= 3)
    .map(([name]) => name)[0];

  // 4. Construct Name
  let name = guild.name;
  if (prominentTribe) {
    name = `${prominentTribe} (${guild.name})`;
  } else if (topMechanics.length > 0) {
    name = `${topMechanics[0]} (${guild.name})`;
  }

  // 5. Construct Headline
  let headline = guild.defaultTheme;
  if (prominentTribe && topMechanics.length > 0) {
    headline = `${prominentTribe} • ${topMechanics.slice(0, 2).join(' & ')}`;
  } else if (topMechanics.length >= 2) {
    headline = `${topMechanics[0]} & ${topMechanics[1]} • ${c1 === 'U' || c2 === 'U' ? 'Tempo & Control' : c1 === 'R' || c2 === 'R' ? 'Aggro & Burn' : 'Midrange & Value'}`;
  } else if (primarySignpost && topMechanics.length > 0) {
    headline = `${topMechanics[0]} • Anchored by ${primarySignpost.name}`;
  } else if (primarySignpost) {
    headline = `${primarySignpost.name} • ${guild.defaultTheme}`;
  }

  // 6. Construct Description
  const signpostMention = primarySignpost ? `Anchored by signposts like ${primarySignpost.name}, ` : '';
  const mechanicsText = topMechanics.length > 0 ? topMechanics.join(' and ') : guild.defaultTheme.toLowerCase();
  const description = `Wizards designed ${color1Name}-${color2Name} in ${upperCode} around ${mechanicsText}. ${signpostMention}this archetype pairs ${color1Name} and ${color2Name} to execute a focused Limited draft strategy centered on board presence, synergy, and combat tempo.`;

  const mechanics = topMechanics.length > 0 ? topMechanics : ['Synergy', 'Combat'];

  // Inferred Pace
  let pace: ArchetypePace = 'Midrange';
  if (['RW', 'BR'].includes(upperCode)) pace = 'Aggro';
  else if (['WU', 'UR'].includes(upperCode)) pace = 'Aggro-Tempo';
  else if (['UB', 'WB'].includes(upperCode)) pace = 'Control';
  else if (['GU', 'BG'].includes(upperCode)) pace = 'Midrange';

  const draftPointers = [
    `Prioritize core ${color1Name} and ${color2Name} commons that reinforce ${mechanics[0] || 'board synergy'}`,
    primarySignpost ? `Anchor your early picks around signposts like ${primarySignpost.name}` : `Look for gold ${upperCode} payoffs early in pack 1`,
    `Maintain a balanced creature curve to control the pace of combat`
  ];

  const synthesized: WOTCArchetypeInfo = {
    name,
    guildName: guild.name,
    headline,
    description,
    mechanics,
    pace,
    draftPointers,
  };

  DYNAMIC_ARCHETYPE_CACHE.set(cacheKey, synthesized);
  return synthesized;
}

/**
 * Returns WOTC Archetype metadata for a given set and archetype code.
 * Checks curated official database first, falling back to dynamic on-the-fly synthesis.
 */
export function getWOTCArchetypeInfo(
  setCode: string,
  archetypeCode: string,
  cards?: Card[]
): WOTCArchetypeInfo {
  const upperSet = (setCode || '').toUpperCase().trim();
  const upperCode = (archetypeCode || '').toUpperCase().trim();

  // 1. Check curated official database
  if (SET_WOTC_ARCHETYPES[upperSet]?.[upperCode]) {
    const raw = SET_WOTC_ARCHETYPES[upperSet][upperCode];
    const guild = GUILD_ARCHETYPES.find((g) => g.code === upperCode);
    return {
      ...raw,
      guildName: raw.guildName || guild?.name || upperCode,
      pace: raw.pace || 'Midrange',
    };
  }

  // 2. Synthesize on the fly from card pool if cards are provided
  if (cards && cards.length > 0) {
    return synthesizeWOTCArchetypeOnTheFly(upperSet, upperCode, cards);
  }

  // 3. Fallback to default guild baseline
  const guild = GUILD_ARCHETYPES.find((g) => g.code === upperCode);
  return DEFAULT_GUILD_WOTC_ARCHETYPES[upperCode] || {
    name: guild?.name || upperCode,
    guildName: guild?.name || upperCode,
    headline: guild?.defaultTheme || 'Draft Synergy',
    description: `Wizards designed ${upperCode} around core color synergy.`,
    mechanics: ['Combat', 'Synergy'],
    pace: 'Midrange',
    draftPointers: [
      `Draft foundational ${guild?.name || upperCode} cards that fit your curve`,
      `Watch for open color signals in pack 1 and pack 2`,
      `Balance high-impact removal with efficient attackers`
    ]
  };
}

/**
 * Resolves all WOTC supported archetypes for a given MTG set.
 * Returns only the intentionally designed/supported archetypes (e.g. 5 for Strixhaven/Hobbit, 10 for standard sets).
 */
export function getWOTCArchetypesForSet(setCode: string, cards: Card[]): WOTCArchetype[] {
  const upperCode = (setCode || '').toUpperCase().trim();
  const developedCodes = getDevelopedArchetypeCodes(upperCode, cards);

  const archetypes: WOTCArchetype[] = [];

  GUILD_ARCHETYPES.forEach((guild) => {
    if (!developedCodes.has(guild.code)) return;

    const info = getWOTCArchetypeInfo(upperCode, guild.code, cards);

    archetypes.push({
      code: guild.code,
      colors: guild.colors,
      name: info.name,
      guildName: info.guildName || guild.name,
      headline: info.headline,
      description: info.description,
      mechanics: info.mechanics,
      pace: info.pace,
      draftPointers: info.draftPointers,
      keyCommons: info.keyCommons,
    });
  });

  return archetypes;
}

/**
 * Finds signpost cards (2-color uncommons or specific archetype tag cards)
 * that anchor a specific archetype in the set.
 */
export function getSignpostsForArchetype(archetypeCode: string, cards: Card[]): Card[] {
  const guild = GUILD_ARCHETYPES.find((g) => g.code === archetypeCode);
  if (!guild || !cards || cards.length === 0) return [];

  const [c1, c2] = guild.colors;

  // 1. First priority: 2-color uncommons of this exact color pair
  const uncommonGold = cards.filter((c) => {
    const colors = c.colors || [];
    return (
      c.rarity === 'uncommon' &&
      colors.length === 2 &&
      colors.includes(c1) &&
      colors.includes(c2)
    );
  });

  if (uncommonGold.length > 0) return uncommonGold;

  // 2. Second priority: any gold cards of this exact color pair (rare/common)
  const allGold = cards.filter((c) => {
    const colors = c.colors || [];
    return colors.length === 2 && colors.includes(c1) && colors.includes(c2);
  });

  return allGold;
}

