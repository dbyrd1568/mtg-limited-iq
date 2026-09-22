import { WOTCArchetypeInfo } from './wotcArchetypes';

/**
 * Authentic Wizards of the Coast archetype profiles for popular and historical limited sets.
 * Curated from official WOTC set release release guides, DailyMTG draft primers, and Mechanics articles.
 */
export const EXPANDED_SET_WOTC_ARCHETYPES: Record<string, Record<string, WOTCArchetypeInfo>> = {
  // Mystery Booster Commander Edition (Active Draft Today!)
  "MBC": {
    "WU": {
      "name": "Blink & ETB Control",
      "headline": "Permanent Displacement • Enter-The-Battlefield Value & Flyers",
      "description": "Wizards designed White-Blue in Mystery Booster Commander around flickering high-impact ETB creatures like Yorion and Brago. Generate immense card advantage and tempo by looping exile-and-return triggers while protecting commanders with countermagic.",
      "mechanics": ["Blink / Flicker", "ETB Triggers", "Evasive Flying", "Counterspells"]
    },
    "UB": {
      "name": "Reanimation & Mill Control",
      "headline": "Graveyard Theft • Self-Mill, Reanimation & Spot Removal",
      "description": "Blue-Black pairs mill and hand disruption with high-leverage reanimation spells. Dump multi-mana commander bombs into the graveyard with looting and mill, then cheat them directly onto the battlefield ahead of schedule.",
      "mechanics": ["Self-Mill", "Reanimation", "Targeted Removal", "Hand Disruption"]
    },
    "BR": {
      "name": "Sacrifice & Morbid Treasures",
      "headline": "Aristocrats Carnage • Death Triggers, Direct Burn & Treasure Acceleration",
      "description": "Black-Red is an explosive sacrifice engine. Generate disposable creature tokens and sacrifice fodder, profiting from death triggers with Blood Artist style drain while generating bursts of Treasure to power out high-cost legendaries.",
      "mechanics": ["Sacrifice Engines", "Treasure Ramp", "Death Triggers", "Direct Burn"]
    },
    "RG": {
      "name": "Big Mana Stompy & Ferocious",
      "headline": "Primal Acceleration • Power 4+ Trample & Extra Combat Pressure",
      "description": "Red-Green accelerates mana using green dorks and red ramp, dropping colossal 4+ power tramplers that force unfavorable blocks. Supported by pump spells and extra combat effects that can eliminate opponents in a single turn.",
      "mechanics": ["Mana Ramp", "4+ Power Threshold", "Trample Beatdown", "Combat Dominance"]
    },
    "GW": {
      "name": "Go-Wide Tokens & Anthems",
      "headline": "Selesnya Swarm • Creature Tokens, +1/+1 Counters & Doubling Effects",
      "description": "Green-White floods the board with creature tokens, scaling armies with permanent +1/+1 counters and anthem enchantments. Creates an impenetrable defensive wall that swiftly turns into a game-ending alpha strike.",
      "mechanics": ["Token Swarm", "+1/+1 Counters", "Anthem Buffs", "Life Total Buffer"]
    },
    "WB": {
      "name": "Aristocrats & Life Drain",
      "headline": "Orzhov Attrition • Incremental Bleed, Lifegain & Recurring Legends",
      "description": "White-Black grinds out multiplayer and 1v1 commander games through incremental drain. Whenever creatures die or enter, opponents lose life while you gain life, creating massive life differentials that outlast aggressive starts.",
      "mechanics": ["Life Drain & Bleed", "Aristocrats", "Graveyard Recursion", "Vindicate Removal"]
    },
    "UR": {
      "name": "Spellslinger Storm & Velocity",
      "headline": "Spell Chaining • Instants & Sorceries, Cost Reduction & Storm Finishers",
      "description": "Blue-Red chains flurry upon flurry of cheap noncreature spells, drawing cards and reducing mana costs. Culminates in devastating storm turns or massive prowess swings that overwhelm conventional board states.",
      "mechanics": ["Spellslinger", "Cost Reduction", "Card Draw Velocity", "Burn & Copy"]
    },
    "BG": {
      "name": "Graveyard Dredge & Attrition",
      "headline": "Golgari Rot • Morbid Value, Deathtouch Stall & Behemoth Recursion",
      "description": "Black-Green treats the graveyard as an endless resource pool. Self-mill fills the bin with creatures to power up graveyard-scaling beaters like Lord of Extinction, while deathtouch blockers lock down the ground.",
      "mechanics": ["Self-Mill", "Graveyard Scaling", "Deathtouch Attrition", "Permanent Recursion"]
    },
    "RW": {
      "name": "Equipment Voltron & Combat Phase",
      "headline": "Boros Vanguard • Sunforger Synergies, Free Equips & Extra Combats",
      "description": "Red-White focuses combat around equipped commanders and aggressive attackers. Leverage Sunforger-style tutor engines, cost reduction on equipment, and extra combat phases to close out games rapidly.",
      "mechanics": ["Equipment / Voltron", "Extra Combat Phases", "Fast Aggro Curve", "Combat Protection"]
    },
    "GU": {
      "name": "Landfall Ramp & Big Draw",
      "headline": "Simic Engine • Land Acceleration, Exponential Draw & Cascade Monsters",
      "description": "Green-Blue powers through the deck with additional land drops and massive card-draw engines like Aesi and Tatyova. Translates boundless mana into uncounterable sea monsters and overwhelming board presence.",
      "mechanics": ["Landfall", "Mana Acceleration", "Massive Card Draw", "Leviathan Finishers"]
    }
  },

  // Reality Fracture (Upcoming 2026 Expansion)
  "FRA": {
    "WU": {
      "name": "Fracture Warp & Flicker",
      "headline": "Reality Displacement • Phasing, ETB Value & Evasive Air Superiority",
      "description": "Wizards designed White-Blue in Reality Fracture around reality-warping temporal displacements. Flicker and phase permanents out to avoid removal, re-trigger enters-the-battlefield abilities, and strike through the air with evasive flyers.",
      "mechanics": ["Phasing / Blink", "ETB Triggers", "Flying Tempo", "Countermagic"]
    },
    "UB": {
      "name": "Mind Fracture & Sabotage",
      "headline": "Entropic Control • Hand Disruption, Mill Triggers & Selective Removal",
      "description": "Blue-Black manipulates fractures in the opponent's sanity. Extract cards directly from hand and library with targeted mill and discard, fueling threshold abilities and devastating reanimation targets.",
      "mechanics": ["Mind Disruption", "Targeted Mill", "Hard Removal", "Saboteur Draw"]
    },
    "BR": {
      "name": "Chaotic Rupture & Sacrifice",
      "headline": "Volatile Aggro • High-Variance Direct Damage & Fodder Sacrifice",
      "description": "Black-Red channels dimensional rifts into raw destructive power. Sacrifice unstable fracture tokens and cheap creatures to incinerate blockers and burn the opponent's life total with unrelenting speed.",
      "mechanics": ["Sacrifice Engines", "Direct Burn", "Aggro Curve", "Morbid Triggers"]
    },
    "RG": {
      "name": "Konstrari Heartwood & Ramp",
      "headline": "Konstrari Artificers • Heartwood Tokens, Mana Ramp & Artifact Stompy",
      "description": "Red-Green commands the Konstrari artificers, weaving living wood into predefined Heartwood artifact tokens ({T}: Add {R} or {G}). Ramp ahead on curve with prepared Soul Tether spells into hulking constructs, while leveraging persistent artifact tokens to power up abilities, pay artifact costs, and dominate combat.",
      "mechanics": ["Heartwood Tokens", "Mana Ramp", "Prepared Spells", "Artifact Synergy", "Affinity / Tap Artifacts"]
    },
    "GW": {
      "name": "Resilient Vanguard & Shield Counters",
      "headline": "Dimensional Bastion • Shield Counters, Go-Wide Tokens & Collective Buffs",
      "description": "Green-White constructs fortified defenses against reality tears. Deploy creature swarms protected by shield and ward counters, steadily growing larger through team anthems and permanent buffs.",
      "mechanics": ["Shield Counters", "Token Swarm", "+1/+1 Counters", "Anthem Buffs"]
    },
    "WB": {
      "name": "Fractured Souls & Life Drain",
      "headline": "Orzhov Siphon • Soul Harvesting, Death Triggers & Incremental Drain",
      "description": "White-Black profits from the collapse of living matter. Bleed opponents whenever your fractured creatures fall in combat, creating unbreakable life total disparities that suffocate slow decks.",
      "mechanics": ["Life Drain & Bleed", "Soul Tokens", "Death Triggers", "Exile Removal"]
    },
    "UR": {
      "name": "Chrono-Spells & Velocity",
      "headline": "Temporal Spellslinger • Instant/Sorcery Chaining, Cost Reduction & Copying",
      "description": "Blue-Red weaves unstable spell cascades. Cast multiple noncreature spells per turn with mana reduction and spell-copying triggers, generating explosive combat rounds and card advantage.",
      "mechanics": ["Spellslinger", "Spell Copying", "Cost Reduction", "Prowess Velocity"]
    },
    "BG": {
      "name": "Necrotic Bloom & Graveyard Shift",
      "headline": "Rot Reclamation • Morbid Attrition, Deathtouch Blockers & Self-Mill",
      "description": "Black-Green feeds upon decayed timelines. Stock the graveyard with self-mill to grow mutated abominations, utilizing deathtouch sentinels to stall before recurring game-ending threats.",
      "mechanics": ["Self-Mill", "Graveyard Recursion", "Deathtouch Stall", "Morbid Scaling"]
    },
    "RW": {
      "name": "Rift Vanguard Aggro",
      "headline": "Dimensional Assault • Fast Low-Curve Attackers, Equipment & Combat Tricks",
      "description": "Red-White charges through tears in reality before the opponent can set up. Deploy an ultra-low curve of aggressive vanguard creatures, powering through blockers with cheap combat tricks and equipment.",
      "mechanics": ["Low Curve Aggro", "Equipment", "Combat Tricks", "First Strike Beats"]
    },
    "GU": {
      "name": "Infinite Evolution & Ramp",
      "headline": "Simic Continuum • Exponential Growth Counters, Extra Lands & Big Draw",
      "description": "Green-Blue bends natural growth laws. Ramp extra lands into play each turn, turning excess mana into enormous creatures that draw cards and scale exponentially each upkeep.",
      "mechanics": ["Land Ramp", "+1/+1 Counters", "Card Advantage", "Late Game Inevitability"]
    }
  },

  // Streets of New Capenna (SNC) - 5 Families & Pairs
  "SNC": {
    "WU": {
      "name": "Brokers (Shield Counters)",
      "headline": "Shielded Skies • Protective Counters, Evasive Flyers & Defensive Tempo",
      "description": "White-Blue represents the Brokers' legal enforcement. Deploy evasive flyers protected by shield counters that absorb the first instance of damage or destruction, allowing you to attack with impunity.",
      "mechanics": ["Shield Counters", "Flying Tempo", "Bounce & Tapping", "ETB Buffs"]
    },
    "UB": {
      "name": "Obscura (Connive & Looting)",
      "headline": "Connive Infiltration • Card Filtering, +1/+1 Counters & Graveyard Stocking",
      "description": "Blue-Black represents the Obscura crime family. Use the Connive mechanic to draw and discard, permanently buffing your creatures with +1/+1 counters when nonlands are discarded while filling the graveyard.",
      "mechanics": ["Connive", "+1/+1 Counters", "Graveyard Fuel", "Targeted Removal"]
    },
    "BR": {
      "name": "Maestros (Casualty & Sacrifice)",
      "headline": "Casualty Artistry • Sacrificing Fodder to Copy Spells & Morbid Value",
      "description": "Black-Red embodies the ruthless Maestros. Sacrifice disposable creatures to pay Casualty costs, duplicating devastating removal and draw spells to bury opponents in two-for-one advantages.",
      "mechanics": ["Casualty", "Spell Copying", "Sacrifice Engines", "Treasure Ramp"]
    },
    "RG": {
      "name": "Riveteers (Blitz Stompy)",
      "headline": "Blitz Demolition • Haste Attackers, Cantrip Deaths & 4+ Power Beats",
      "description": "Red-Green embodies the industrial muscle of the Riveteers. Cast aggressive creatures for their Blitz cost, giving them haste and drawing a card when they die at end of turn to keep the pressure relentless.",
      "mechanics": ["Blitz", "Haste Pressure", "Death Cantrip", "Treasure Generation"]
    },
    "GW": {
      "name": "Cabaretti (Alliance Go-Wide)",
      "headline": "Alliance Party • Creature Token Swarms & Enters-The-Battlefield Triggers",
      "description": "Green-White represents the lavish Cabaretti party. Flood the board with Citizen tokens, triggering Alliance abilities whenever another creature enters the battlefield to generate life, pump stats, and overwhelm blocks.",
      "mechanics": ["Alliance", "Citizen Tokens", "Go-Wide Anthems", "+1/+1 Counters"]
    },
    "WB": {
      "name": "Counters Matter & Life Drain",
      "headline": "Syndicate Aristocrats • Shield & +1/+1 Counter Harvest, Life Total Bleed",
      "description": "White-Black blends Obscura connive counters and Brokers shield tokens with black sacrifice outlets. Cash in modified creatures for card draw and life drain.",
      "mechanics": ["Counters Matter", "Sacrifice", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Treasure Spellslinger",
      "headline": "Gilded Velocity • Treasure Acceleration, Noncreature Spells & Tempo",
      "description": "Blue-Red stockpiles Treasure tokens to cast high-impact instants and sorceries ahead of curve, turning treasure generation into spell velocity and card flow.",
      "mechanics": ["Treasure Tokens", "Instants & Sorceries", "Prowess Triggers", "Tempo Burn"]
    },
    "BG": {
      "name": "Graveyard Types Matter",
      "headline": "Riveteers Reclamation • Multi-Card-Type Graveyards & Morbid Midrange",
      "description": "Black-Green cares about diverse permanent types in the graveyard (creatures, artifacts, lands, spells). Grind out value with deathtouch blockers and massive recursive threats.",
      "mechanics": ["Graveyard Types", "Self-Mill", "Deathtouch Attrition", "Midrange Value"]
    },
    "RW": {
      "name": "Citizen Aggro & Beatdown",
      "headline": "Street Brawl • Low Curve Attackers, Citizen Tokens & Team Anthems",
      "description": "Red-White pushes blistering aggressive tempo. Deploy low-cost creatures and Citizen tokens, bypassing ground stalls with combat tricks and haste Blitz threats.",
      "mechanics": ["Low Curve Aggro", "Citizen Tokens", "Combat Tricks", "Alliance Triggers"]
    },
    "GU": {
      "name": "Shield Ramp & Big Mana",
      "headline": "Brokers Growth • Mana Acceleration, Shielded Behemoths & Card Flow",
      "description": "Green-Blue uses green land search and treasure acceleration to power out colossal blue sea monsters, protecting key ramp engines with durable shield counters.",
      "mechanics": ["Shield Counters", "Mana Ramp", "Card Draw", "Late Game Finishers"]
    }
  },

  // Innistrad: Midnight Hunt (MID)
  "MID": {
    "WU": {
      "name": "Disturb Spirits & Flyers",
      "headline": "Spiritual Transcendence • Evasive Flyers & Disturb Recursion",
      "description": "Wizards designed White-Blue in Midnight Hunt around the Disturb mechanic. Cast cheap human and spirit creatures on curve, and when they die, recast them from the graveyard as evasive flying spirit enchantments.",
      "mechanics": ["Disturb", "Flying Evasion", "Graveyard Value", "Defensive Tempo"]
    },
    "UB": {
      "name": "Decayed Zombie Swarm",
      "headline": "Rotting Horde • Decayed Zombie Tokens, Sacrifice Engines & Card Draw",
      "description": "Blue-Black floods the battlefield with 2/2 Decayed Zombie tokens. Since decayed zombies cannot block and die when attacking, turn them into card draw, removal fuel, and morbid triggers with sacrifice outlets.",
      "mechanics": ["Decayed Tokens", "Sacrifice Engines", "Card Advantage", "Targeted Removal"]
    },
    "BR": {
      "name": "Vampires & Loss of Life",
      "headline": "Bloodthirst Aggro • Combat Damage Triggers & Direct Life Loss Payoffs",
      "description": "Black-Red thrives on inflicting pain. Deploy aggressive vampires that gain +1/+1 counters, draw cards, and unlock discounted spells whenever an opponent has lost life this turn.",
      "mechanics": ["Loss of Life Triggers", "Aggressive Vampires", "Direct Burn", "Removal"]
    },
    "RG": {
      "name": "Daybound / Nightbound Werewolves",
      "headline": "Lycanthrope Rampage • Manipulating Day/Night & Massive Transforming Stats",
      "description": "Red-Green commands the terrifying Werewolf pack. Pass turns without casting spells to plunge the game into Night, transforming human wolves into monstrous, trampling beasts that overpower defenders.",
      "mechanics": ["Daybound / Nightbound", "Transforming Werewolves", "Trample Beatdown", "Combat Tricks"]
    },
    "GW": {
      "name": "Coven Humans & Anthems",
      "headline": "Coven Harmony • Three Different Powers & Collective Army Buffs",
      "description": "Green-White assembles the Dawnhart Coven. Maintain at least three creatures with different powers (e.g. 1/1, 2/2, 3/3) to trigger continuous Coven bonuses like +1/+1 counters, card draw, and indestructible.",
      "mechanics": ["Coven", "Power Diversity", "+1/+1 Counters", "Human Tribal"]
    },
    "WB": {
      "name": "Aristocrats & Corpse Harvest",
      "headline": "Morbid Sacrifice • Token Death Triggers, Lifegain & Incremental Drain",
      "description": "White-Black grinds opponents into dust through death triggers. Sacrifice decayed zombies and small human tokens to trigger drain effects, gain life, and remove opposing bombs with elite black removal.",
      "mechanics": ["Aristocrats", "Life Drain", "Decayed Tokens", "Removal Control"]
    },
    "UR": {
      "name": "Spellslinger & Flashback",
      "headline": "Arcane Velocity • Instants/Sorceries, Flashback & Prowess Triggers",
      "description": "Blue-Red chains instant and sorcery spells, utilizing Flashback to cast each card twice. Power up spellslinger creatures like Thermo-Alchemist and Delver of Secrets to burn opponents down rapidly.",
      "mechanics": ["Flashback", "Instants & Sorceries", "Burn & Bounce", "Spell Velocity"]
    },
    "BG": {
      "name": "Morbid & Graveyard Midrange",
      "headline": "Grave Attrition • Morbid Triggers, Self-Mill & Deathtouch Blockers",
      "description": "Black-Green cares deeply about creatures dying. Trigger morbid abilities each turn by trading deathtouch creatures in combat or sacrificing decayed tokens, recurring high-stamina monsters from the graveyard.",
      "mechanics": ["Morbid", "Self-Mill", "Deathtouch Stall", "Creature Recursion"]
    },
    "RW": {
      "name": "Day / Night Beatdown",
      "headline": "Vanguard Assault • Low-Curve Human Aggro, Equipment & Night Timing",
      "description": "Red-White pushes rapid offensive tempo. Attack early with low-mana humans, using combat tricks and nightbound transitions to force opponents onto the back foot before they can stabilize.",
      "mechanics": ["Low Curve Aggro", "Combat Tricks", "Day / Night", "First Strike Beats"]
    },
    "GU": {
      "name": "Flashback Ramp & Self-Mill",
      "headline": "Deep Harvest • Milling Flashback Spells, Mana Acceleration & Big Bodies",
      "description": "Green-Blue self-mills cards into the graveyard, treating the bin as a second hand filled with Flashback spells. Ramps land counts to deploy colossal leviathans and recursive game-winners.",
      "mechanics": ["Flashback", "Self-Mill", "Mana Ramp", "Big Late Game"]
    }
  },

  // Innistrad: Crimson Vow (VOW)
  "VOW": {
    "WU": {
      "name": "Disturb Auras & Spirits",
      "headline": "Enchanted Spirits • Evasive Flyers & Graveyard Aura Disturb",
      "description": "White-Blue casts efficient flying spirit creatures, and when they die, Disturb allows them to be cast from the graveyard as powerful aura enchantments that supercharge your remaining board.",
      "mechanics": ["Disturb (Auras)", "Flying Evasion", "Aura Buffs", "Defensive Tempo"]
    },
    "UB": {
      "name": "Exploit Zombies",
      "headline": "Exploit Sacrifice • Sacrificing Fodder for Removal, Draw & Value",
      "description": "Blue-Black leverages the Exploit mechanic. Deploy cheap zombie tokens and decayed fodder, sacrificing them as larger exploit creatures enter to draw cards, force discards, and bounce threats.",
      "mechanics": ["Exploit", "Zombie Tokens", "Card Advantage", "Hard Removal"]
    },
    "BR": {
      "name": "Blood Token Vampires",
      "headline": "Vampiric Banquet • Generating Blood Tokens, Rummaging & Vampire Payoffs",
      "description": "Black-Red floods the game with Blood tokens. Crack blood tokens to discard unneeded lands and draw fresh cards, triggering powerful vampire abilities that scale with blood generation.",
      "mechanics": ["Blood Tokens", "Vampire Tribal", "Card Filtering", "Burn Removal"]
    },
    "RG": {
      "name": "Daybound / Nightbound Werewolves",
      "headline": "Wolf Pack Hunt • Transforming Werewolves, Trample & Red-Zone Carnage",
      "description": "Red-Green commands devastating Werewolf beaters. Force the game into Night to unleash towering tramplers, overwhelming blockers with superior stats and efficient red combat tricks.",
      "mechanics": ["Daybound / Nightbound", "Transforming Werewolves", "Trample Beatdown", "Combat Dominance"]
    },
    "GW": {
      "name": "Training Humans",
      "headline": "Human Mentorship • Training Mechanic, +1/+1 Counters & Swarm",
      "description": "Green-White pairs larger experienced creatures with smaller trainees. Whenever a creature with Training attacks alongside a creature with greater power, it gains a permanent +1/+1 counter.",
      "mechanics": ["Training", "+1/+1 Counters", "Human Tribal", "Go-Wide Anthems"]
    },
    "WB": {
      "name": "Life Gain & Drain",
      "headline": "Orzhov Aristocrats • Life Gain Triggers, Blood Drain & Resilient Board",
      "description": "White-Black orchestrates life swings through lifelink creatures, vampire drain triggers, and blood token sacrifice. Grinds out prolonged battles by steadily bleeding the opponent.",
      "mechanics": ["Lifegain Payoffs", "Life Drain", "Blood Tokens", "Removal Control"]
    },
    "UR": {
      "name": "Noncreature Spells & Blood",
      "headline": "Alchemical Velocity • Instants/Sorceries, Blood Rummaging & Spell Triggers",
      "description": "Blue-Red chains burn and card draw spells, using Blood tokens to discard redundant spells or lands to maintain endless spell velocity.",
      "mechanics": ["Instants & Sorceries", "Blood Filtering", "Prowess Triggers", "Tempo Bounce"]
    },
    "BG": {
      "name": "Toughness & Graveyard Descend",
      "headline": "Morbid Roots • High Toughness Blockers, Self-Mill & Graveyard Counts",
      "description": "Black-Green establishes unbreakable defensive ground stalls with high-toughness creatures, milling cards into the graveyard to empower cards that scale with creature count in the yard.",
      "mechanics": ["High Toughness", "Self-Mill", "Graveyard Scaling", "Deathtouch Stall"]
    },
    "RW": {
      "name": "Equipment Aggro & Blood",
      "headline": "Armored Assault • Fast Curve, Equipment Attaching & Blood Rummaging",
      "description": "Red-White curves out with cheap, aggressive creatures. Slap powerful equipment on attackers and use Blood tokens to filter away late-game lands into fresh threats.",
      "mechanics": ["Equipment", "Fast Curve Aggro", "Blood Tokens", "First Strike Beats"]
    },
    "GU": {
      "name": "Self-Mill & Sea Monsters",
      "headline": "Deep Ocean Ramp • Milling Creatures, Rampant Lands & Giant Krakens",
      "description": "Green-Blue accelerates mana and self-mills cards to power up graveyard-scaling threats, ramping into titanic sea monsters that dominate late-game board states.",
      "mechanics": ["Self-Mill", "Mana Ramp", "Creature Graveyard Count", "Late Game Finishers"]
    }
  },

  // Adventures in the Forgotten Realms (AFR)
  "AFR": {
    "WU": {
      "name": "Dungeon Venturing & Evasion",
      "headline": "Dungeon Delvers • Venture into the Dungeon & Evasive Skies",
      "description": "Wizards designed White-Blue in AFR around exploring dungeons like the Lost Mine of Phandelver. Advance through dungeon rooms to scry, create treasure, draw cards, and drain opponents while attacking safely with flyers.",
      "mechanics": ["Venture into Dungeon", "Dungeon Completion", "Flying Evasion", "Defensive Tempo"]
    },
    "UB": {
      "name": "Rogues & Combat Sabotage",
      "headline": "Stealth Infiltration • Unblockable Saboteurs & Combat Damage Triggers",
      "description": "Blue-Black deploys elusive rogues and assassins. When your creatures deal combat damage to an opponent, trigger card draw, treasure creation, and dungeon ventures while removing threats with black kill spells.",
      "mechanics": ["Saboteur Triggers", "Unblockable / Evasion", "Targeted Removal", "Hand Disruption"]
    },
    "BR": {
      "name": "Treasure Hoarding & Sacrifice",
      "headline": "Dragon's Hoard • Treasure Generation, Artifact Sacrifice & Morbid Burn",
      "description": "Black-Red amasses Dragon's hoards of Treasure tokens. Sacrifice treasures not just for mana, but to trigger devastating power buffs, direct damage, and morbid creature destruction.",
      "mechanics": ["Treasure Tokens", "Artifact Sacrifice", "Morbid Triggers", "Direct Burn"]
    },
    "RG": {
      "name": "Pack Tactics & Stompy",
      "headline": "Ferocious Pack • 6+ Total Attacking Power & Combat Dominance",
      "description": "Red-Green commands the Pack Tactics mechanic. Attack with creatures totaling 6 or more power to trigger ferocious bonuses like free damage, card advantage, and trample buffs.",
      "mechanics": ["Pack Tactics", "6+ Power Attack", "Trample Beatdown", "Mana Ramp"]
    },
    "GW": {
      "name": "Lifegain & +1/+1 Counters",
      "headline": "Celestial Blessing • Gaining Life, Growing Unicorns & Swarm",
      "description": "Green-White unites holy clerics and woodland beasts. Whenever you gain life, trigger abilities that place permanent +1/+1 counters onto creatures like Celestial Unicorn to build an unstoppable army.",
      "mechanics": ["Lifegain Payoffs", "+1/+1 Counters", "Go-Wide Tokens", "Cleric Tribal"]
    },
    "WB": {
      "name": "Dungeon Drainage & Aristocrats",
      "headline": "Tomb of Annihilation • Completing Dungeons, Death Triggers & Bleed",
      "description": "White-Black delves deep into hazardous dungeons, using the drain and sacrifice rooms of the Tomb of Annihilation to grind out opponent life totals while triggering death payoffs.",
      "mechanics": ["Venture into Dungeon", "Life Drain", "Death Triggers", "Removal Control"]
    },
    "UR": {
      "name": "D20 Dice Rolling & Spells",
      "headline": "Critical Roll • Rolling 20-Sided Dice & High-Impact Spell Synergy",
      "description": "Blue-Red embraces D&D randomness. Roll d20s on spells and creatures to trigger scaling spell effects, gaining massive bonuses when rolling natural 15s through 20s.",
      "mechanics": ["d20 Dice Rolling", "Critical Hits", "Instants & Sorceries", "Burn & Bounce"]
    },
    "BG": {
      "name": "Morbid & Creature Death",
      "headline": "Underdark Morbid • Capitalizing on Deaths, Deathtouch & Recursion",
      "description": "Black-Green profits from mortality. Trigger powerful bonuses whenever any creature dies this turn, using deathtouch blockers to force trades and returning dead monsters to hand.",
      "mechanics": ["Creature Dies Triggers", "Deathtouch Stall", "Graveyard Recursion", "Midrange Value"]
    },
    "RW": {
      "name": "Equipment & Warriors",
      "headline": "Fighter's Arsenal • Equipping Weapons, Combat Buffs & Haste Attacks",
      "description": "Red-White gears up for battle. Equip weapons to dwarf and goblin warriors for reduced costs, granting first strike, double strike, and high-power attack triggers.",
      "mechanics": ["Equipment", "Warrior Tribal", "Low Curve Aggro", "Combat Tricks"]
    },
    "GU": {
      "name": "Ramp & Monster Evocation",
      "headline": "Wilderness Ramp • Land Acceleration, Big Mana Dragons & Card Flow",
      "description": "Green-Blue accelerates through extra land drops, summoning legendary dragons and colossal wilderness monsters with uncounterable late-game impact.",
      "mechanics": ["Mana Ramp", "Land Acceleration", "Large Monsters", "Card Advantage"]
    }
  },

  // Ikoria: Lair of Behemoths (IKO)
  "IKO": {
    "WU": {
      "name": "Flying & Mutate Evasion",
      "headline": "Apex Skies • Mutating Flying Threats & Defensive Bounce Tempo",
      "description": "Wizards designed White-Blue in Ikoria around evasive skies. Mutate apex predators onto flying creatures, combining terrifying mutate abilities with natural evasion to end games quickly.",
      "mechanics": ["Mutate", "Flying Evasion", "Defensive Bounce", "Counterspells"]
    },
    "UB": {
      "name": "Flash & Graveyard Sabotage",
      "headline": "Cunning Nightstalkers • Playing at Instant Speed & Reanimating Behemoths",
      "description": "Blue-Black plays entirely on the opponent's turn with Flash threats. Hold up countermagic and removal, flashing in blockers or reanimating discarded colossal dinosaurs.",
      "mechanics": ["Flash", "Reanimation", "Targeted Removal", "Hand Disruption"]
    },
    "BR": {
      "name": "Menace & Aristocrats",
      "headline": "Menacing Aggression • Hard-to-Block Menace Attackers & Fodder Sacrifice",
      "description": "Black-Red forces impossible blocks with Menace creatures. Back up relentless attacks with sacrifice spells like Weaponize the Monsters that burn opposing creatures and players directly.",
      "mechanics": ["Menace", "Sacrifice Outlets", "Direct Burn", "Aggro Beats"]
    },
    "RG": {
      "name": "4+ Power Trample Stompy",
      "headline": "Ferocious Trample • 4+ Power Behemoths & Devastating Fight Spells",
      "description": "Red-Green drops massive beasts that meet the 4+ power threshold. Overwhelm blockers with natural trample and fight spells that clear the path for lethal strikes.",
      "mechanics": ["4+ Power Threshold", "Trample Beatdown", "Fight Spells", "Mana Ramp"]
    },
    "GW": {
      "name": "Vigilance & Go-Wide Mutate",
      "headline": "Vigilant Vanguard • Defensive Attacks, Ability Counters & Token Swarm",
      "description": "Green-White attacks without letting down its guard using Vigilance creatures. Stack ability counters (vigilance, +1/+1) and mutate defensive anchors to dominate ground combat.",
      "mechanics": ["Vigilance", "Ability Counters", "Go-Wide Tokens", "Anthem Buffs"]
    },
    "WB": {
      "name": "Humans vs Non-Humans",
      "headline": "Human Sacrifice • Sacrificing Human Fodder to Empower Monstrous Beasts",
      "description": "White-Black explores the tension between human survivors and monsters. Sacrifice small human tokens to trigger death drain, remove threats, and empower surviving beasts.",
      "mechanics": ["Human Tribal", "Sacrifice Engines", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Noncreature Spells & Cycling",
      "headline": "Spell Drake Velocity • Chaining Spells, Cycling & Prowess Sweeps",
      "description": "Blue-Red rewards casting noncreature spells and cycling. Power up creatures like Sprite Dragon and Spelleater Wolverine to deal explosive bursts of flying damage.",
      "mechanics": ["Instants & Sorceries", "Cycling Payoffs", "Prowess Velocity", "Burn & Bounce"]
    },
    "BG": {
      "name": "Deathtouch & Graveyard Recursion",
      "headline": "Apex Predators • Deathtouch Counters, Reanimation & Morbid Value",
      "description": "Black-Green places deathtouch counters onto sturdy bodies, stalling the ground completely before dredging and reanimating titanic monsters from the graveyard.",
      "mechanics": ["Deathtouch Counters", "Reanimation", "Self-Mill", "Attrition Grind"]
    },
    "RW": {
      "name": "Cycling 1 Aggro",
      "headline": "Zenith Flare Storm • 1-Mana Cycling Density, Token Swarms & Lethal Flare",
      "description": "Red-White is one of the most famous draft archetypes in MTG history. Draft dozens of 1-mana cycling cards to turbo-cycle through the deck, buffing Flourishing Fox, generating token swarms, and closing with a 15-damage Zenith Flare.",
      "mechanics": ["Cycling (1 Mana)", "Zenith Flare", "Token Generation", "Hyper-Fast Curve"]
    },
    "GU": {
      "name": "Mutate Value Engine",
      "headline": "Apex Evolution • Stacking Mutate Triggers, Ramp & Cascading Draw",
      "description": "Green-Blue stacks multiple mutate creatures onto a single non-Human host. Every subsequent mutate triggers ALL previous mutate abilities, cascading into immense ramp and card draw.",
      "mechanics": ["Mutate Stacking", "Land Ramp", "Cascading Triggers", "Big Card Advantage"]
    }
  },

  // Theros Beyond Death (THB)
  "THB": {
    "WU": {
      "name": "Constellation & Evasive Tempo",
      "headline": "Divine Sky • Enchantment Constellation & Tapping Down Blockers",
      "description": "White-Blue triggers Constellation whenever an enchantment enters. Lock down opposing attackers with aura removal like Dreadful Apathy while attacking through the air with evasive flyers.",
      "mechanics": ["Constellation", "Enchantment Creatures", "Flying Evasion", "Tapping & Freeze"]
    },
    "UB": {
      "name": "Self-Mill & Escape Control",
      "headline": "Underworld Depths • Milling Cards, Escape Fuel & Hard Control",
      "description": "Blue-Black fills the graveyard through self-mill and targeted discard, fueling Escape costs to cast recurring threats like Pharika's Spawn while grinding down opponent resources.",
      "mechanics": ["Self-Mill", "Escape Cards", "Targeted Removal", "Countermagic"]
    },
    "BR": {
      "name": "Sacrifice & Steal",
      "headline": "Slaughter Priest • Stealing Opponent Creatures & Sacrificing for Value",
      "description": "Black-Red utilizes the classic 'Threaten and Sacrifice' engine. Steal opponent creatures with Claim the Firstborn, attack with them, and sacrifice them to Slaughter-Priest of Mogis for damage and value.",
      "mechanics": ["Threaten & Steal", "Sacrifice Outlets", "Direct Burn", "Morbid Triggers"]
    },
    "RG": {
      "name": "4+ Power Ferocious Stompy",
      "headline": "Iroas's Ferocity • 4+ Power Monsters, Trample & Combat Domination",
      "description": "Red-Green drops 4+ power creatures that trigger ferocious bonuses. Smash through enemy defenders with trample and devastating combat tricks like Nessian Hornbeetle buffs.",
      "mechanics": ["4+ Power Threshold", "Trample Beatdown", "Combat Tricks", "Mana Ramp"]
    },
    "GW": {
      "name": "Auras & Constellation Go-Wide",
      "headline": "Heliod's Grace • Enchanting Creatures, Constellation Buffs & Heroic Growth",
      "description": "Green-White suits up creatures with auras, triggering Constellation across the board to spread +1/+1 counters, draw cards with Setessan Champion, and build huge attackers.",
      "mechanics": ["Auras & Constellation", "+1/+1 Counters", "Card Advantage", "Go-Wide Anthems"]
    },
    "WB": {
      "name": "Aristocrats & Reanimation",
      "headline": "Underworld Mourning • Returning Enchantments, Death Triggers & Drain",
      "description": "White-Black recurs fallen enchantment creatures and sacrifice fodder. Bleed opponents whenever your permanents leave the battlefield, grinding out inexorable advantages.",
      "mechanics": ["Aristocrats", "Graveyard Recursion", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Flash & Opponent's Turn Spells",
      "headline": "Chimera Cunning • Casting Spells on Opponent's Turn & Draw Triggers",
      "description": "Blue-Red plays on the opponent's turn. Gain massive advantages when you cast spells during your opponent's turn, triggering Mischievous Chimera and holding up countermagic.",
      "mechanics": ["Flash / Instant Speed", "Opponent's Turn Triggers", "Burn & Bounce", "Evasion"]
    },
    "BG": {
      "name": "Escape Recursion & Attrition",
      "headline": "Grave Reclamation • Self-Mill, High-Impact Escape & Deathtouch Grind",
      "description": "Black-Green feeds the graveyard constantly. Escape massive monsters like Loathsome Chimera and Voracious Typhon repeatedly, overwhelming opponents who run out of removal.",
      "mechanics": ["Escape Recursion", "Self-Mill", "Deathtouch Stall", "Midrange Grind"]
    },
    "RW": {
      "name": "Heroic Aggro & Auras",
      "headline": "Akroan Phalanx • Targeting Your Creatures with Spells for Explosive Swings",
      "description": "Red-White targets its own creatures with cheap combat tricks and auras like Hero of the Games and Phalanx Tactics, boosting the entire team for lightning-fast victories.",
      "mechanics": ["Heroic Targeting", "Auras & Tricks", "Fast Curve Aggro", "First Strike Beats"]
    },
    "GU": {
      "name": "Constellation Ramp & Sea Monsters",
      "headline": "Kruphix's Horizon • Enchantment Mana Ramp, Big Draw & Kraken Finishers",
      "description": "Green-Blue uses enchantment ramp like Wolfwillow Haven to accelerate mana, drawing cards off Constellation triggers and dropping colossal underworld krakens.",
      "mechanics": ["Enchantment Ramp", "Constellation Draw", "Big Sea Monsters", "Late Game Power"]
    }
  },

  // Throne of Eldraine (ELD)
  "ELD": {
    "WU": {
      "name": "Artifacts & Enchantments",
      "headline": "All That Glitters • Animating Relics, Flying Enchantments & Tempo",
      "description": "Wizards designed White-Blue in Eldraine around artifacts and enchantments. Power up creatures with 'All That Glitters' buffs, animate relics with Flutterfox, and dominate the skies.",
      "mechanics": ["Artifacts & Enchantments", "All That Glitters", "Flying Evasion", "Tempo Control"]
    },
    "UB": {
      "name": "Mill & Graveyard Thievery",
      "headline": "Secretkeeper Mill • Milling Opponents to 7+ Cards for Devastating Payoffs",
      "description": "Blue-Black mills the opponent's library using Merfolk Secretkeeper. Once the opponent has 7 or more cards in their graveyard, your creatures gain double damage, unblockable, and removal buffs.",
      "mechanics": ["Opponent Mill", "7+ Cards in Grave", "Disruption", "Saboteur Draw"]
    },
    "BR": {
      "name": "Knights Aggro & Equipment",
      "headline": "Smitten Knights • Tribal Knight Assault, Equipment & Direct Burn",
      "description": "Black-Red attacks relentlessly with low-cost Knights. Equip weapons to enhance combat stats, using Smitten Swordmaster's drain adventure to finish opponents off from high life totals.",
      "mechanics": ["Knight Tribal", "Equipment", "Direct Drain", "Fast Aggro Curve"]
    },
    "RG": {
      "name": "Non-Humans & Ferocious",
      "headline": "Wilderness Beast • Empowering Non-Humans, 4+ Power & Trample",
      "description": "Red-Green deploys beasts, goblins, and giants. Trigger powerful non-Human synergies that pump stats and grant haste to smash through defensive lines.",
      "mechanics": ["Non-Human Tribal", "4+ Power Threshold", "Trample Beatdown", "Aggro Curve"]
    },
    "GW": {
      "name": "Adventures & Token Swarms",
      "headline": "Clover Questers • Chaining Adventure Spells, Edgewall Innkeeper & Clover",
      "description": "Green-White is an unstoppable adventure engine. Cast adventure spells for cheap effects, draw cards with Edgewall Innkeeper, and copy spells with Lucky Clover to drown opponents in value.",
      "mechanics": ["Adventures", "Edgewall Innkeeper", "Lucky Clover", "Token Swarm"]
    },
    "WB": {
      "name": "Knights & Aristocrats",
      "headline": "Orzhov Chivalry • Knight Synergies, Death Triggers & Lifelink Bleed",
      "description": "White-Black blends chivalric knight tribal with aristocrat death triggers. Drain opponents when knights fall, supported by premier removal spells like Mortify.",
      "mechanics": ["Knight Tribal", "Aristocrats", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Draw Two Cards",
      "headline": "Mad Hatter Velocity • Drawing Your Second Card Each Turn for Buffs & Burn",
      "description": "Blue-Red triggers powerful bonuses whenever you draw your second card in a turn. Use cantrips, thrill of possibility, and faerie vandals to grow permanent flying attackers.",
      "mechanics": ["Draw Two Cards", "Faerie Vandal", "Cantrip Velocity", "Burn & Bounce"]
    },
    "BG": {
      "name": "Food & Graveyard Engine",
      "headline": "Bake into a Pie • Generating Food Tokens, Feasting & Recurring Trolls",
      "description": "Black-Green generates endless Food tokens. Spend food for emergency life against aggro, feed Wicked Wolves to fight blockers, and recur Feasting Troll Kings from the graveyard.",
      "mechanics": ["Food Tokens", "Wicked Wolf", "Graveyard Recursion", "Midrange Grind"]
    },
    "RW": {
      "name": "Go-Wide Knights & Equipment",
      "headline": "Tournament Champions • Low-Curve Knight Swarm, Anthems & Equipment",
      "description": "Red-White curves out with the fastest knight assault in the format. Flood the board with 1- and 2-drops, buffing the entire army with Inspiring Veteran and equipment.",
      "mechanics": ["Knight Tribal", "Low Curve Aggro", "Inspiring Veteran", "Equipment"]
    },
    "GU": {
      "name": "Ramp & Giant Monsters",
      "headline": "Beanstalk Behemoths • Land Acceleration, Big Mana Draw & Giant Stompy",
      "description": "Green-Blue accelerates mana using Beanstalk Giant and Maraleaf Pixie, translating abundant land drops into colossal fairy-tale giants and unstoppable card advantage.",
      "mechanics": ["Mana Ramp", "Beanstalk Giant", "Card Advantage", "Giant Finishers"]
    }
  },

  // War of the Spark (WAR)
  "WAR": {
    "WU": {
      "name": "Flying Skies & Walker Defense",
      "headline": "Aerial Citadel • Evasive Flying Threats, Defensive Tempo & Walkers",
      "description": "Wizards designed White-Blue in War of the Spark around dominating the air while defending planeswalkers with countermagic, bounce spells, and high-toughness blockers.",
      "mechanics": ["Flying Evasion", "Planeswalker Defense", "Defensive Tempo", "Proliferate"]
    },
    "UB": {
      "name": "Amass Control",
      "headline": "Dreadhorde Horde • Amassing Giant Zombie Armies & Hard Removal",
      "description": "Blue-Black controls the board with discard, bounce, and black kill spells, steadily building a massive 0/0 Zombie Army token through the Amass mechanic.",
      "mechanics": ["Amass Zombies", "Zombie Army", "Targeted Removal", "Card Advantage"]
    },
    "BR": {
      "name": "Amass Sacrifice & Burn",
      "headline": "Dreadhorde Sacrifice • Amassing Armies, Fodder Burn & Relentless Aggro",
      "description": "Black-Red builds Zombie Armies only to sacrifice them for lethal damage, clearing opposing blockers with cheap removal and burning out the opponent's life total.",
      "mechanics": ["Amass Zombies", "Sacrifice Outlets", "Direct Burn", "Aggro Curve"]
    },
    "RG": {
      "name": "4+ Power Stompy",
      "headline": "Gruul Smash • 4+ Power Monsters, Trample & Riot Beatdown",
      "description": "Red-Green deploys monsters that cross the 4+ power threshold, triggering Kronch Wrangler and Challenger Troll bonuses to smash through enemy ground stalls.",
      "mechanics": ["4+ Power Threshold", "Trample Beatdown", "Fight Spells", "Mana Ramp"]
    },
    "GW": {
      "name": "Proliferate & +1/+1 Counters",
      "headline": "United Growth • Spreading +1/+1 Counters & Proliferating the Army",
      "description": "Green-White puts +1/+1 counters onto an entire board of creatures, using the Proliferate mechanic to multiply counters on both creatures and planeswalkers every turn.",
      "mechanics": ["Proliferate", "+1/+1 Counters", "Planeswalker Support", "Go-Wide Anthems"]
    },
    "WB": {
      "name": "Aristocrats & Life Drain",
      "headline": "Orzhov Enforcers • Afterlife Fodder, Death Triggers & Incremental Bleed",
      "description": "White-Black profits from creature deaths using Cruel Celebrant. Sacrifice afterlife tokens and zombie armies to drain opponents while locking down the game with elite removal.",
      "mechanics": ["Aristocrats", "Cruel Celebrant", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Spellslinger & Amass",
      "headline": "Arcane Ingot • Instants & Sorceries Amassing Armies & Prowess",
      "description": "Blue-Red chains cheap noncreature spells that Amass zombie armies while burning blockers and drawing cards, turning spell velocity into board presence.",
      "mechanics": ["Instants & Sorceries", "Amass Zombies", "Spell Velocity", "Burn & Bounce"]
    },
    "BG": {
      "name": "Graveyard Midrange & Counters",
      "headline": "Underrealm Attrition • Morbid Recycling, +1/+1 Counters & Deathtouch",
      "description": "Black-Green dominates the midgame with deathtouch blockers, recursing fallen planeswalkers and giant creatures with Aid the Fallen while proliferating counters.",
      "mechanics": ["Graveyard Recursion", "+1/+1 Counters", "Deathtouch Stall", "Proliferate"]
    },
    "RW": {
      "name": "Feather Heroic Aggro",
      "headline": "Tenth District Legion • Targeting Attackers, Combat Tricks & 10th District",
      "description": "Red-White targets aggressive creatures like Tenth District Legionnaire and Feather with cheap combat tricks, recurring spells and attacking with ferocious speed.",
      "mechanics": ["Targeting Payoffs", "Combat Tricks", "Low Curve Aggro", "First Strike Beats"]
    },
    "GU": {
      "name": "Proliferate Ramp & Big Mana",
      "headline": "Simic Evolution • Proliferating Mana Counters, Giant Hydras & Draw",
      "description": "Green-Blue uses proliferate to multiply +1/+1 counters on mana dorks and loyalty on planeswalkers, ramping into colossal hydras and overwhelming card advantage.",
      "mechanics": ["Proliferate", "Mana Ramp", "+1/+1 Counters", "Leviathan Finishers"]
    }
  },

  // Dominaria (DOM)
  "DOM": {
    "WU": {
      "name": "Historic Skies & Tempo",
      "headline": "Historic Flight • Artifacts, Legendaries & Sagas with Evasive Flyers",
      "description": "White-Blue triggers Historic bonuses whenever you cast an artifact, legendary, or saga. Attack through the skies with evasive flyers while keeping opponent threats tapped down.",
      "mechanics": ["Historic (Artifact/Legend/Saga)", "Flying Evasion", "Bounce Tempo", "Sagas"]
    },
    "UB": {
      "name": "Historic Control & Removal",
      "headline": "Dark Knowledge • Historic Synergies, Hard Removal & Reanimation",
      "description": "Blue-Black controls the board with elite black removal and blue counterspells, triggering historic payoffs and recurring legendary bombs from the graveyard.",
      "mechanics": ["Historic Payoffs", "Targeted Removal", "Card Advantage", "Countermagic"]
    },
    "BR": {
      "name": "Historic Aggro & Sacrifice",
      "headline": "Gathan Carnage • Fast Aggro, Historic Triggers & Fodder Sacrifice",
      "description": "Black-Red attacks with aggressive historic threats and cheap removal, sacrificing historic permanents and goblin fodder to deal direct damage.",
      "mechanics": ["Historic Aggro", "Sacrifice Outlets", "Direct Burn", "Removal"]
    },
    "RG": {
      "name": "Kicker Stompy",
      "headline": "Primal Kicker • Flexible Early Curve, Ramping into Kicked Monsters",
      "description": "Red-Green leverages the Kicker mechanic for flexible early-game curve and game-ending late-game power, ramping into colossal kicked beaters that trample blockers.",
      "mechanics": ["Kicker", "4+ Power Threshold", "Trample Beatdown", "Mana Ramp"]
    },
    "GW": {
      "name": "Tokens & Song of Freyalise",
      "headline": "Llanowar Swarm • Saproling & Knight Tokens, Anthems & Freyalise",
      "description": "Green-White floods the board with tokens, turning mana dorks and saprolings into an unstoppable army with Song of Freyalise and team anthem buffs.",
      "mechanics": ["Token Swarm", "Song of Freyalise", "+1/+1 Counters", "Anthem Buffs"]
    },
    "WB": {
      "name": "Knights & Legendary Aristocrats",
      "headline": "Benalish Chivalry • Tribal Knights, Legendary Support & Elite Removal",
      "description": "White-Black unites the knights of Benalia with dark cabal removal. Gain bonuses for controlling legendary creatures and drain opponent life totals.",
      "mechanics": ["Knight Tribal", "Legendary Synergies", "Removal Control", "Life Drain"]
    },
    "UR": {
      "name": "Wizards & Spellslinger",
      "headline": "Tolarian Lightning • Wizard Tribal, Instants/Sorceries & Cheap Burn",
      "description": "Blue-Red pairs wizard creatures like Adeliz the Cinder Wind with cheap burn and bounce spells, triggering team-wide prowess buffs that close games in a single turn.",
      "mechanics": ["Wizard Tribal", "Instants & Sorceries", "Adeliz Prowess", "Burn & Bounce"]
    },
    "BG": {
      "name": "Saprolings & Fungus Sacrifice",
      "headline": "Thallid Rot • Spawning Saproling Swarms, Spore Sacrifice & Drain",
      "description": "Black-Green commands Thallids and Fungi. Generate endless 1/1 Saproling tokens to chump block, sacrifice for card draw, and drain with Slimefoot the Stowaway.",
      "mechanics": ["Saproling Tokens", "Fungus Tribal", "Slimefoot Drain", "Graveyard Value"]
    },
    "RW": {
      "name": "Auras, Equipment & Historic Aggro",
      "headline": "Valiant Champions • Low Curve Aggro, Armored Attackers & Historic Buffs",
      "description": "Red-White curves out with aggressive attackers, suiting them up with historic equipment and auras like Danitha Capashen to crash through defenders.",
      "mechanics": ["Equipment & Auras", "Historic Synergies", "Low Curve Aggro", "First Strike Beats"]
    },
    "GU": {
      "name": "Ramp & Kicker Value",
      "headline": "Tatyova's Horizons • Extra Lands, Big Kicked Spells & Massive Draw",
      "description": "Green-Blue accelerates mana with Tatyova, Benthic Druid, drawing cards off every land drop and casting kicked behemoths that bury the opponent.",
      "mechanics": ["Kicker", "Landfall Ramp", "Tatyova Draw", "Late Game Power"]
    }
  },

  // Khans of Tarkir (KTK) - 5 Wedges + 10 Pairs
  "KTK": {
    "WU": {
      "name": "Evasive Tempo & Morph",
      "headline": "Jeskai Skies • Flying Evasion, Morph Tricks & Defensive Bounce",
      "description": "White-Blue plays elusive flyers and face-down Morph creatures, keeping blockers tapped down and disrupting attacks with bounce and countermagic.",
      "mechanics": ["Morph", "Flying Evasion", "Bounce Tempo", "Prowess Support"]
    },
    "UB": {
      "name": "Delve Control & Sabotage",
      "headline": "Sultai Infiltration • Self-Mill, Cheap Delve Spells & Hard Removal",
      "description": "Blue-Black controls the pace of play. Fill the graveyard to cast massive Delve spells like Treasure Cruise and Dead Drop for pennies on the dollar.",
      "mechanics": ["Delve", "Self-Mill", "Targeted Removal", "Card Advantage"]
    },
    "BR": {
      "name": "Raid & Direct Burn",
      "headline": "Mardu Slaughter • Attacking Every Turn, Raid Triggers & Lethal Burn",
      "description": "Black-Red attacks constantly to trigger Raid bonuses. Deploy aggressive orcs and goblins, finishing the opponent off with direct burn.",
      "mechanics": ["Raid", "Aggro Curve", "Direct Burn", "Removal"]
    },
    "RG": {
      "name": "Ferocious Stompy",
      "headline": "Temur Brawn • 4+ Power Monsters, Trample & Red-Zone Carnage",
      "description": "Red-Green drops massive 4+ power creatures to unlock Ferocious abilities, overwhelming ground blocks with trample and combat tricks.",
      "mechanics": ["Ferocious (4+ Power)", "Trample Beatdown", "Fight Spells", "Mana Ramp"]
    },
    "GW": {
      "name": "Outlast & Swarm",
      "headline": "Abzan Endurance • Patient Outlast Counters, Reach & Trample Buffs",
      "description": "Green-White builds an enduring defensive wall using Outlast. Grow permanent +1/+1 counters on creatures, granting shared keywords like lifelink and first strike.",
      "mechanics": ["Outlast", "+1/+1 Counters", "Shared Keywords", "Token Swarm"]
    },
    "WB": {
      "name": "Warriors & Drain",
      "headline": "Mardu Blood-Chant • Tribal Warriors, Chief of the Edge & Life Drain",
      "description": "White-Black attacks with tribal Warriors buffed by Chief of the Edge, combining aggressive power with elite removal like Utter End.",
      "mechanics": ["Warrior Tribal", "Chief of Edge", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Prowess & Velocity",
      "headline": "Jeskai Striking • Noncreature Spells, Prowess Buffs & Tempo Burn",
      "description": "Blue-Red chains noncreature spells to trigger Prowess across multiple creatures, turning small attackers into lethal combat swings.",
      "mechanics": ["Prowess", "Instants & Sorceries", "Burn & Bounce", "Tempo Superiority"]
    },
    "BG": {
      "name": "Delve & Morbid Midrange",
      "headline": "Sultai Dredge • Graveyard Stocking, Deathtouch Blockers & Delve Titans",
      "description": "Black-Green fuels the graveyard with self-mill, utilizing deathtouch creatures to trade in combat and delving away chaff for enormous threats like Hooting Mandrills.",
      "mechanics": ["Delve", "Self-Mill", "Deathtouch Stall", "Midrange Grind"]
    },
    "RW": {
      "name": "Tokens & Trumpet Blast",
      "headline": "Horde Rush • Low-Curve Swarm, Goblin Tokens & Trumpet Blast Alpha",
      "description": "Red-White swarms the board with 1/1 tokens, using Trumpet Blast and Rush of Battle to deliver devastating 20-damage alpha strikes out of nowhere.",
      "mechanics": ["Token Swarm", "Trumpet Blast", "Low Curve Aggro", "Raid Triggers"]
    },
    "GU": {
      "name": "Morph & Big Ramp",
      "headline": "Temur Growth • Face-Down Morph Deception, Land Ramp & Big Monsters",
      "description": "Green-Blue accelerates mana and deploys face-down Morph creatures, un-morphing colossal threats ahead of schedule to ambush opposing attackers.",
      "mechanics": ["Morph", "Mana Ramp", "Secret Ambush", "Late Game Monsters"]
    }
  },

  // Kaladesh Remastered (KLR)
  "KLR": {
    "WU": {
      "name": "Blink & Vehicle Aviation",
      "headline": "Aeronaut Fleet • Flickering Fabricate Tokens & Crewing Flying Vehicles",
      "description": "White-Blue flickers Fabricate creatures to generate endless Servo tokens or counters, using cheap evasive pilots to crew flying Vehicles.",
      "mechanics": ["Fabricate", "Vehicles", "Blink / Flicker", "Flying Evasion"]
    },
    "UB": {
      "name": "Artifact Control & Revolt",
      "headline": "Aether Infiltration • Targeted Removal, Card Advantage & Metalcraft",
      "description": "Blue-Black controls the board with efficient black kill spells and blue countermagic, gaining card advantage from artifact synergies and revolt triggers.",
      "mechanics": ["Artifact Synergy", "Targeted Removal", "Card Advantage", "Revolt"]
    },
    "BR": {
      "name": "Artifact Aggro & Disintegration",
      "headline": "Welder Aggression • Unlicensed Disintegration, Artifact Burn & Aggro",
      "description": "Black-Red attacks with aggressive artifact creatures, backed by Unlicensed Disintegration to kill any creature and burn the opponent for 3.",
      "mechanics": ["Artifact Aggro", "Unlicensed Disintegration", "Direct Burn", "Sacrifice"]
    },
    "RG": {
      "name": "Energy Stompy",
      "headline": "Aether Rampage • Generating Energy, Voltaic Brawler & Trample Beats",
      "description": "Red-Green amasses Energy counters to power up Voltaic Brawler and giant stompy creatures with trample and extra combat stats.",
      "mechanics": ["Energy Counters", "4+ Power Threshold", "Trample Beatdown", "Voltaic Brawler"]
    },
    "GW": {
      "name": "+1/+1 Counters & Fabricate",
      "headline": "Fairground Anthems • Fabricating Counters, Servo Swarms & Anthems",
      "description": "Green-White leverages the Fabricate mechanic to either go wide with 1/1 Servo tokens or go tall with permanent +1/+1 counters, buffing the whole team.",
      "mechanics": ["Fabricate", "+1/+1 Counters", "Servo Tokens", "Anthem Buffs"]
    },
    "WB": {
      "name": "Fabricate & Aristocrats",
      "headline": "Servo Scrapyard • Harvesting Servos, Death Triggers & Drain",
      "description": "White-Black creates disposable Servo tokens with Fabricate, sacrificing them to black value engines to drain life and remove opposing threats.",
      "mechanics": ["Fabricate", "Servo Tokens", "Aristocrats", "Life Drain"]
    },
    "UR": {
      "name": "Energy Spells & Thopters",
      "headline": "Whirler Velocity • Whirler Virtuoso Thopters, Energy Burn & Spells",
      "description": "Blue-Red pairs energy generation with Whirler Virtuoso, turning abundant energy into a swarm of 1/1 flying Thopters while slinging burn spells.",
      "mechanics": ["Energy Counters", "Whirler Virtuoso", "Thopter Tokens", "Burn & Bounce"]
    },
    "BG": {
      "name": "+1/+1 Counters & Revolt",
      "headline": "Winding Constrictor • Multiplying Counters, Deathtouch & Revolt",
      "description": "Black-Green is defined by Winding Constrictor. Add extra counters whenever counters are placed on permanents or players, building massive monsters quickly.",
      "mechanics": ["Winding Constrictor", "+1/+1 Counters", "Energy Counters", "Deathtouch Stall"]
    },
    "RW": {
      "name": "Vehicles & Pilot Aggro",
      "headline": "Depala's Speedway • Fast Dwarf Attackers, Vehicle Crew & Depala",
      "description": "Red-White curves out with aggressive Dwarves and Pilots, crewing high-power Vehicles to attack before opponents can set up their defenses.",
      "mechanics": ["Vehicles", "Dwarf Tribal", "Fast Curve Aggro", "Depala Synergy"]
    },
    "GU": {
      "name": "Energy Ramp & Gearhulks",
      "headline": "Aetherworks Inevitability • Energy Acceleration, Big Mana & Colossi",
      "description": "Green-Blue generates massive energy pools, converting energy into extra cards and ramping lands to cast colossal artifact gearhulks.",
      "mechanics": ["Energy Counters", "Mana Ramp", "Card Advantage", "Big Artifact Finishers"]
    }
  },

  // Amonkhet Remastered (AKR)
  "AKR": {
    "WU": {
      "name": "Embalm & Flying Tempo",
      "headline": "Eternal Flight • Recasting White/Blue Mummies from Graveyard & Skies",
      "description": "White-Blue plays evasive flyers and embalm creatures. When your creatures die, Embalm allows you to create white zombie mummy copies from the graveyard.",
      "mechanics": ["Embalm", "Flying Evasion", "Zombie Tokens", "Defensive Tempo"]
    },
    "UB": {
      "name": "Cycling & Discard Control",
      "headline": "Dusk Control • Cycling Payoffs, Drake Haven & Targeted Removal",
      "description": "Blue-Black cycles through cards rapidly to trigger Drake Haven and Archfiend of Ifnir, drawing answers while generating board presence.",
      "mechanics": ["Cycling Payoffs", "Discard Triggers", "Drake Haven", "Targeted Removal"]
    },
    "BR": {
      "name": "Hellbent & Minotaurs",
      "headline": "Bloodlust Aggro • Empty Hand Bonuses, Tribal Minotaurs & Direct Burn",
      "description": "Black-Red empties its hand rapidly to trigger Heckbent / empty hand abilities, granting massive power buffs and aggressive burn.",
      "mechanics": ["Heckbent / Empty Hand", "Minotaur Tribal", "Direct Burn", "Aggro Curve"]
    },
    "RG": {
      "name": "Exert Stompy",
      "headline": "Ahn-Crop Ferocity • Exerting Attackers for Combat Bonuses & Trample",
      "description": "Red-Green exerts creatures when attacking to gain massive power buffs and trample, smashing through defenses and forcing losing trades.",
      "mechanics": ["Exert", "4+ Power Threshold", "Trample Beatdown", "Combat Tricks"]
    },
    "GW": {
      "name": "Exert & Untap Synergy",
      "headline": "Oketra's Trial • Exerting Attackers & Untapping to Bypass Downside",
      "description": "Green-White exerts creatures for devastating attack abilities, pairing them with untap effects and vigilance to bypass the non-untap drawback.",
      "mechanics": ["Exert", "Untap Synergies", "+1/+1 Counters", "Vigilance Beats"]
    },
    "WB": {
      "name": "Zombies & Embalm",
      "headline": "Mummy Legion • Tribal Zombies, Wayward Servant Drain & Tokens",
      "description": "White-Black assembles an army of tribal Zombies. Drain opponents with Wayward Servant every time a zombie enters, recycling threats via Embalm.",
      "mechanics": ["Zombie Tribal", "Wayward Servant", "Embalm", "Life Drain"]
    },
    "UR": {
      "name": "Spellslinger & Prowess",
      "headline": "Kefnet's Velocity • Chaining Instants/Sorceries, Enigma Drake & Burn",
      "description": "Blue-Red powers up Enigma Drake with spells in the graveyard, cycling and casting cheap burn to clear opposing blockers.",
      "mechanics": ["Instants & Sorceries", "Enigma Drake", "Prowess Velocity", "Burn & Bounce"]
    },
    "BG": {
      "name": "-1/-1 Counters & Graveyard",
      "headline": "Hapatra's Venom • Placing -1/-1 Counters on Opponents & Snake Swarm",
      "description": "Black-Green places -1/-1 counters on opposing creatures, weakening and killing them while triggering Hapatra to spawn deathtouch snake swarms.",
      "mechanics": ["-1/-1 Counters", "Hapatra Snakes", "Deathtouch Stall", "Midrange Grind"]
    },
    "RW": {
      "name": "Exert Aggro",
      "headline": "Ahn-Crop Champions • Relentless Exert Assault & Fast Combat Curve",
      "description": "Red-White pushes blistering aggressive tempo with Ahn-Crop Crasher, exerting attackers to prevent opposing blockers and end games before turn 5.",
      "mechanics": ["Exert", "Ahn-Crop Crasher", "Fast Curve Aggro", "Combat Tricks"]
    },
    "GU": {
      "name": "Ramp & Aftermath",
      "headline": "Bounty of the Luxa • Mana Acceleration, Aftermath Spells & Big Beasts",
      "description": "Green-Blue accelerates mana with Bounty of the Luxa and land search, drawing cards and deploying colossal desert river monsters.",
      "mechanics": ["Mana Ramp", "Aftermath Spells", "Card Advantage", "Giant Finishers"]
    }
  },

  // Shadows over Innistrad Remastered (SIR)
  "SIR": {
    "WU": {
      "name": "Spirits & Flying Evasion",
      "headline": "Phantom Squadron • Tribal Spirits, Flash Threats & Evasive Skies",
      "description": "White-Blue takes to the skies with tribal Spirits. Leverage flash and tempo to hold up countermagic while chipping in for evasive damage.",
      "mechanics": ["Spirit Tribal", "Flying Evasion", "Flash", "Defensive Tempo"]
    },
    "UB": {
      "name": "Zombies & Graveyard Control",
      "headline": "Grave Risen • Reanimating Zombies, Self-Mill & Disruption",
      "description": "Blue-Black fills the graveyard through discard and self-mill, casting recursive zombies and locking down the board with black removal.",
      "mechanics": ["Zombie Tribal", "Self-Mill", "Graveyard Recursion", "Targeted Removal"]
    },
    "BR": {
      "name": "Madness & Vampires",
      "headline": "Falkenrath Frenzy • Discard Outlets, Casting Madness Spells & Aggro",
      "description": "Black-Red pairs discard outlets with the Madness mechanic. Discard cards to trigger vampire abilities while casting spells for their discounted madness cost.",
      "mechanics": ["Madness", "Discard Outlets", "Vampire Tribal", "Aggro Curve"]
    },
    "RG": {
      "name": "Werewolves & Flip Aggro",
      "headline": "Ulvenwald Pack • Transforming Werewolves, Trample & Combat Power",
      "description": "Red-Green controls the wolf pack. Pass turns without casting spells to transform humans into ferocious, high-stat werewolves with trample.",
      "mechanics": ["Transforming Werewolves", "Trample Beatdown", "Combat Tricks", "Aggro Curve"]
    },
    "GW": {
      "name": "Humans & Go-Wide Anthems",
      "headline": "Heron Militia • Tribal Humans, +1/+1 Counters & Clue Tokens",
      "description": "Green-White unifies human villagers. Deploy an army of cheap humans, boosting their power with anthem effects and drawing cards with Clue tokens.",
      "mechanics": ["Human Tribal", "+1/+1 Counters", "Investigate / Clues", "Anthem Buffs"]
    },
    "WB": {
      "name": "Delirium & Aristocrats",
      "headline": "Inquisition Harvest • Diverse Card Types, Sacrifice & Life Drain",
      "description": "White-Black achieves Delirium by getting 4 card types into the graveyard, unlocking powerful abilities while draining opponents with death triggers.",
      "mechanics": ["Delirium", "Aristocrats", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Spellslinger & Madness",
      "headline": "Alchemical Storm • Instants/Sorceries, Prowess & Madness Burn",
      "description": "Blue-Red chains burn and bounce spells, discarding madness cards to cast cheap spells at instant speed and power up Thermo-Alchemist.",
      "mechanics": ["Instants & Sorceries", "Madness", "Prowess Velocity", "Burn & Bounce"]
    },
    "BG": {
      "name": "Delirium Midrange",
      "headline": "Graveyard Counting • Reaching 4 Card Types for Monstrous Delirium Stats",
      "description": "Black-Green actively mills creatures, lands, artifacts, and sorceries into the yard, unlocking devastating Delirium buffs on Grim Flayer and Ishkanah.",
      "mechanics": ["Delirium", "Self-Mill", "Card Type Diversity", "Deathtouch Stall"]
    },
    "RW": {
      "name": "Equipment & Human Aggro",
      "headline": "Cathar Vanguard • Low Curve Human Attackers, Weapons & Fast Tempo",
      "description": "Red-White curves out with zealous Cathars and weapons, pushing fast aggressive damage and finishing games before late-game delirium stabilizes.",
      "mechanics": ["Human Tribal", "Equipment", "Low Curve Aggro", "Combat Tricks"]
    },
    "GU": {
      "name": "Clues & Investigate Ramp",
      "headline": "Ongoing Investigation • Investigating Clue Tokens, Card Flow & Monsters",
      "description": "Green-Blue generates copious Clue tokens with Investigate, cracking them for steady card advantage while ramping into colossal Eldrazi horrors.",
      "mechanics": ["Investigate / Clues", "Card Advantage", "Mana Ramp", "Eldrazi Finishers"]
    }
  },

  // Ravnica Remastered (RVR)
  "RVR": {
    "WU": {
      "name": "Azorius Senate (Detain & Addendum)",
      "headline": "Judicial Authority • Detain Blocker Freeze, Flyers & Addendum Spells",
      "description": "White-Blue enforces the law. Detain opponent attackers and blockers so they cannot attack or activate abilities, while striking safely through the air.",
      "mechanics": ["Detain", "Addendum", "Flying Evasion", "Defensive Tempo"]
    },
    "UB": {
      "name": "House Dimir (Surveil & Transmute)",
      "headline": "Secret Syndicate • Surveil Card Selection, Disruption & Sabotage",
      "description": "Blue-Black manipulates the top of the library with Surveil, finding exactly the right answer while using hand disruption and unblockable saboteurs.",
      "mechanics": ["Surveil", "Transmute", "Targeted Removal", "Hand Disruption"]
    },
    "BR": {
      "name": "Cult of Rakdos (Hellbent & Spectacle)",
      "headline": "Carnival of Blood • Spectacle Discounted Costs, Direct Burn & Aggro",
      "description": "Black-Red inflicts damage to unlock discounted Spectacle costs, emptying the hand and incinerating opponent life totals with reckless abandon.",
      "mechanics": ["Spectacle", "Hellbent", "Direct Burn", "Aggro Curve"]
    },
    "RG": {
      "name": "Gruul Clans (Bloodrush & Riot)",
      "headline": "Riot Rampage • Choice of Haste or +1/+1 Counter & Bloodrush Pumps",
      "description": "Red-Green deploys Riot creatures, choosing either immediate haste aggression or permanent +1/+1 counters to trample through blockers.",
      "mechanics": ["Riot", "Bloodrush", "Trample Beatdown", "4+ Power Threshold"]
    },
    "GW": {
      "name": "Selesnya Conclave (Populate & Convoke)",
      "headline": "Worldsoul Swarm • Populating Giant Tokens & Convoking Spells Early",
      "description": "Green-White taps creatures to Convoke massive spells early, using the Populate mechanic to duplicate your strongest creature token every turn.",
      "mechanics": ["Convoke", "Populate", "Token Swarm", "+1/+1 Counters"]
    },
    "WB": {
      "name": "Orzhov Syndicate (Afterlife & Extort)",
      "headline": "Debt & Afterlife • Extorting Life on Every Spell & Flying Spirit Tokens",
      "description": "White-Black bleeds opponents dry with Extort on every spell cast, while Afterlife ensures every dying creature leaves behind a flying spirit.",
      "mechanics": ["Afterlife", "Extort", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Izzet League (Jump-Start & Overload)",
      "headline": "Weird Genius • Casting Spells from Graveyard with Jump-Start & Prowess",
      "description": "Blue-Red chains burn and card draw spells, discarding lands to Jump-Start spells from the graveyard and triggering explosive prowess turns.",
      "mechanics": ["Jump-Start", "Overload", "Instants & Sorceries", "Burn & Bounce"]
    },
    "BG": {
      "name": "Golgari Swarm (Dredge & Undergrowth)",
      "headline": "Crawl from the Grave • Scaling with Creatures in Grave & Scavenge Buffs",
      "description": "Black-Green feeds the graveyard with dredge and self-mill, scaling Undergrowth spells and scavenging +1/+1 counters onto surviving creatures.",
      "mechanics": ["Undergrowth", "Dredge / Scavenge", "Deathtouch Stall", "Midrange Grind"]
    },
    "RW": {
      "name": "Boros Legion (Mentor & Battalion)",
      "headline": "Vanguard March • Mentoring Smaller Attackers & Battalion Attacks",
      "description": "Red-White curves out with military precision. High-power Mentor creatures train smaller soldiers with +1/+1 counters when attacking together.",
      "mechanics": ["Mentor", "Battalion", "Low Curve Aggro", "Combat Tricks"]
    },
    "GU": {
      "name": "Simic Combine (Adapt & Evolve)",
      "headline": "Engineered Growth • Adapt Counter Growth & Evolving Bigger Monsters",
      "description": "Green-Blue evolves creatures whenever larger threats enter, paying Adapt costs to place permanent counters and trigger mutant abilities.",
      "mechanics": ["Adapt", "Evolve", "+1/+1 Counters", "Late Game Power"]
    }
  },

  // Core Set 2021 (M21)
  "M21": {
    "WU": {
      "name": "Flying Skies & Tempo",
      "headline": "Aerial Superiority • Evasive Flying Creatures & Defensive Tapping",
      "description": "Wizards designed White-Blue in M21 around classic air superiority. Lock down the ground with high-toughness blockers and win with evasive flyers.",
      "mechanics": ["Flying Evasion", "Tapping & Freeze", "Card Advantage", "Defensive Tempo"]
    },
    "UB": {
      "name": "Card Draw & Reanimation",
      "headline": "Tome of the Grave • Drawing Extra Cards, Looting & Reanimating Bombs",
      "description": "Blue-Black pairs card draw with reanimation. Discard huge bombs to looting effects, then bring them back directly onto the battlefield.",
      "mechanics": ["Card Draw", "Reanimation", "Targeted Removal", "Hand Disruption"]
    },
    "BR": {
      "name": "Sacrifice & Steal",
      "headline": "Act of Treason • Stealing Opponent Creatures & Sacrificing for Value",
      "description": "Black-Red steals opposing blockers with Traitorous Greed, attacks with them, and sacrifices them to Witch's Cauldron or Havoc Jester for damage.",
      "mechanics": ["Threaten & Steal", "Sacrifice Outlets", "Direct Burn", "Aggro Curve"]
    },
    "RG": {
      "name": "4+ Power Ferocious",
      "headline": "Primal Stompy • 4+ Power Monsters, Trample & Furious Pummeling",
      "description": "Red-Green drops large creatures that meet the 4+ power threshold, unlocking ferocious buffs, card draw, and trample beatdown.",
      "mechanics": ["4+ Power Threshold", "Trample Beatdown", "Fight Spells", "Mana Ramp"]
    },
    "GW": {
      "name": "+1/+1 Counters & Swarm",
      "headline": "Basri's Solidarity • Distributing +1/+1 Counters & Army Anthems",
      "description": "Green-White places +1/+1 counters onto an entire board of creatures with Basri's Solidarity, turning small dorks into massive attackers.",
      "mechanics": ["+1/+1 Counters", "Go-Wide Anthems", "Token Swarm", "Vigilance Beats"]
    },
    "WB": {
      "name": "Lifegain & Aristocrats",
      "headline": "Vito's Drain • Gaining Life, Vito Drain Triggers & Death Bleed",
      "description": "White-Black gains life with lifelink creatures, turning every point of lifegain into direct damage to the opponent through Vito, Thorn of the Dusk Rose.",
      "mechanics": ["Lifegain Payoffs", "Vito Drain", "Aristocrats", "Removal Control"]
    },
    "UR": {
      "name": "Spellslinger & Prowess",
      "headline": "Alchemical Velocity • Instants/Sorceries, Prowess Buffs & Burn",
      "description": "Blue-Red casts cheap noncreature spells to trigger prowess across attackers, clearing blockers with red burn spells.",
      "mechanics": ["Instants & Sorceries", "Prowess Velocity", "Burn & Bounce", "Card Filtering"]
    },
    "BG": {
      "name": "Morbid & Graveyard Midrange",
      "headline": "Morbid Roots • Creature Death Triggers, Deathtouch & Recursion",
      "description": "Black-Green gains bonuses whenever creatures die, using deathtouch creatures to trade up and recurring threats from the graveyard.",
      "mechanics": ["Creature Dies Triggers", "Deathtouch Stall", "Graveyard Recursion", "Midrange Grind"]
    },
    "RW": {
      "name": "Dog & Soldier Aggro",
      "headline": "Pack Assault • Low-Curve Dogs & Soldiers, Equipment & Fast Tempo",
      "description": "Red-White curves out with loyal dogs and soldiers, attacking aggressively with combat tricks and closing before opponents stabilize.",
      "mechanics": ["Dog Tribal", "Low Curve Aggro", "Combat Tricks", "First Strike Beats"]
    },
    "GU": {
      "name": "Card Draw Ramp",
      "headline": "Lorescale Hydra • Ramping Lands, Drawing Cards & Scaling Counters",
      "description": "Green-Blue accelerates mana and draws cards, growing creatures like Lorescale Coatl into enormous monsters with each extra card drawn.",
      "mechanics": ["Card Draw Triggers", "Mana Ramp", "+1/+1 Counters", "Giant Finishers"]
    }
  },

  // Core Set 2020 (M20)
  "M20": {
    "WU": {
      "name": "Flying Skies & Empyrean Eagle",
      "headline": "Empyrean Skies • Evasive Flying Creatures & Air Anthems",
      "description": "White-Blue dominates the sky with Empyrean Eagle, granting all flyers +1/+1 and closing out games over clogged ground battlefields.",
      "mechanics": ["Flying Evasion", "Empyrean Eagle", "Defensive Tempo", "Tapping & Freeze"]
    },
    "UB": {
      "name": "Control & Graveyard Theft",
      "headline": "Tomebound Control • Hard Removal, Card Draw & Reanimation",
      "description": "Blue-Black grinds down opponents with premium black removal and blue counterspells, drawing cards with Tomebound Lich.",
      "mechanics": ["Targeted Removal", "Tomebound Lich", "Card Advantage", "Reanimation"]
    },
    "BR": {
      "name": "Aggro Sacrifice & Spitfire",
      "headline": "Spitfire Carnage • Noncombat Burn, Chandra's Spitfire & Sacrifice",
      "description": "Black-Red attacks with aggressive attackers and noncombat damage spells, pumping Chandra's Spitfire for massive airborne lethal strikes.",
      "mechanics": ["Chandra's Spitfire", "Noncombat Burn", "Sacrifice Outlets", "Aggro Curve"]
    },
    "RG": {
      "name": "Elementals & 4+ Power",
      "headline": "Creeping Trailblazers • Elemental Tribal, 4+ Power & Trample",
      "description": "Red-Green deploys high-stat Elementals buffed by Creeping Trailblazer, ramping into colossal tramplers that crush ground defenses.",
      "mechanics": ["Elemental Tribal", "4+ Power Threshold", "Creeping Trailblazer", "Trample Beatdown"]
    },
    "GW": {
      "name": "Go-Wide Tokens & Anthems",
      "headline": "Ironroot Swarm • Creature Tokens, +1/+1 Counters & Team Buffs",
      "description": "Green-White floods the board with creature tokens, using Ironroot Warlord and anthem effects to overwhelm opposing blockers.",
      "mechanics": ["Token Swarm", "Ironroot Warlord", "+1/+1 Counters", "Anthem Buffs"]
    },
    "WB": {
      "name": "Lifegain & Corpse Knight",
      "headline": "Corpse Knight Bleed • Creature ETB Drain, Lifelink & Resilient Board",
      "description": "White-Black drains opponents with Corpse Knight whenever any creature enters your battlefield, supported by lifelink and black removal.",
      "mechanics": ["Corpse Knight", "ETB Drain", "Lifelink Buffs", "Removal Control"]
    },
    "UR": {
      "name": "Elementals & Spellslinger",
      "headline": "Lightning Stormkin • Haste Flying Assault, Instants & Sorceries",
      "description": "Blue-Red attacks immediately with Lightning Stormkin, chaining burn and bounce spells to clear blockers and trigger prowess.",
      "mechanics": ["Lightning Stormkin", "Haste & Flying", "Instants & Sorceries", "Burn & Bounce"]
    },
    "BG": {
      "name": "Morbid & Graveyard Recursion",
      "headline": "Moldervine Attrition • Self-Mill, Morbid Triggers & Deathtouch",
      "description": "Black-Green feeds the graveyard with Moldervine Reclamation, drawing cards and gaining life whenever any of your creatures die.",
      "mechanics": ["Moldervine Reclamation", "Morbid Triggers", "Deathtouch Stall", "Graveyard Recursion"]
    },
    "RW": {
      "name": "Go-Wide Aggro & Weapons",
      "headline": "Skyknight Vanguard • Low Curve Attacks, Token Spawning & Anthems",
      "description": "Red-White curves out with Skyknight Vanguard, creating attacking soldier tokens every combat to overwhelm slow opposing starts.",
      "mechanics": ["Skyknight Vanguard", "Low Curve Aggro", "Attacking Tokens", "Combat Tricks"]
    },
    "GU": {
      "name": "Elementals & Land Ramp",
      "headline": "Risen Reef Cascade • Risen Reef Elemental Triggers & Land Ramp",
      "description": "Green-Blue is defined by Risen Reef. Every Elemental entering puts a land onto the battlefield or draws a card, generating infinite value.",
      "mechanics": ["Risen Reef", "Elemental Tribal", "Landfall Ramp", "Late Game Inevitability"]
    }
  },

  // Core Set 2019 (M19)
  "M19": {
    "WU": {
      "name": "Artifacts & Flying Skies",
      "headline": "Skilled Aeronauts • Flying Evasion, Artifact Synergies & Tempo",
      "description": "White-Blue plays elusive flyers supported by artifact creatures and defensive bounce spells, chipping in for safe airborne damage.",
      "mechanics": ["Flying Evasion", "Artifact Synergy", "Defensive Tempo", "Tapping & Freeze"]
    },
    "UB": {
      "name": "Control & Graveyard Attrition",
      "headline": "Mind Rot Control • Targeted Removal, Hand Disruption & Reanimation",
      "description": "Blue-Black strips opponent hands with Mind Rot, removes key threats with black removal, and wins with card draw engines.",
      "mechanics": ["Targeted Removal", "Hand Disruption", "Card Advantage", "Countermagic"]
    },
    "BR": {
      "name": "Sacrifice & Direct Burn",
      "headline": "Havoc Carnage • Sacrificing Goblin Fodder for Lethal Direct Burn",
      "description": "Black-Red deploys cheap goblins and skeletons, sacrificing them to deal direct damage and clear blockers.",
      "mechanics": ["Sacrifice Engines", "Direct Burn", "Aggro Curve", "Removal"]
    },
    "RG": {
      "name": "4+ Power Stompy",
      "headline": "Colossal Dreadmaw • 4+ Power Behemoths, Trample & Ramp",
      "description": "Red-Green ramps into 4+ power creatures with trample, smashing through defenses and dominating combat trades.",
      "mechanics": ["4+ Power Threshold", "Trample Beatdown", "Mana Ramp", "Combat Tricks"]
    },
    "GW": {
      "name": "Go-Wide Auras & Anthems",
      "headline": "Pegasus Vanguard • Token Swarms, Auras & Team Anthems",
      "description": "Green-White floods the board with tokens, boosting the entire army with permanent auras and anthem buffs.",
      "mechanics": ["Token Swarm", "+1/+1 Counters", "Anthem Buffs", "Auras"]
    },
    "WB": {
      "name": "Lifegain & Life Drain",
      "headline": "Regal Bloodlord • Gaining Life, Spawning Flying Bats & Drain",
      "description": "White-Black gains life with lifelink creatures, triggering Regal Bloodlord to create 1/1 flying bat tokens every turn.",
      "mechanics": ["Lifegain Payoffs", "Regal Bloodlord", "Bat Tokens", "Removal Control"]
    },
    "UR": {
      "name": "Spellslinger & Prowess",
      "headline": "Aven Wind Mage • Noncreature Spells, Flying Buffs & Burn",
      "description": "Blue-Red chains burn and card draw spells, triggering prowess on flying creatures like Aven Wind Mage.",
      "mechanics": ["Instants & Sorceries", "Prowess Velocity", "Flying Evasion", "Burn & Bounce"]
    },
    "BG": {
      "name": "Morbid & Graveyard Recursion",
      "headline": "Grave Reclamation • Creature Death Triggers, Deathtouch & Regrowth",
      "description": "Black-Green uses deathtouch blockers to stall, returning fallen bombs to hand with Macabre Waltz and Gravedigger.",
      "mechanics": ["Graveyard Recursion", "Deathtouch Stall", "Morbid Triggers", "Midrange Grind"]
    },
    "RW": {
      "name": "Go-Wide Aggro & Heroic",
      "headline": "Heroic Vanguard • Low Curve Attackers, Combat Tricks & Trumpet Blast",
      "description": "Red-White curves out with low-cost attackers, using combat tricks like Inspired Charge to close games rapidly.",
      "mechanics": ["Low Curve Aggro", "Combat Tricks", "Anthem Alpha Strikes", "First Strike Beats"]
    },
    "GU": {
      "name": "Ramp & Sea Monsters",
      "headline": "Elvish Rejuvenator • Land Acceleration, Card Draw & Leviathans",
      "description": "Green-Blue accelerates mana with Elvish Rejuvenator, drawing cards and casting massive late-game sea monsters.",
      "mechanics": ["Mana Ramp", "Land Search", "Card Advantage", "Leviathan Finishers"]
    }
  },

  // Ixalan (XLN) & Rivals of Ixalan (RIX) - 4 Tribal Factions & Pairs
  "XLN": {
    "WU": {
      "name": "Flying Skies & Ascend",
      "headline": "Imperial Skies • Evasive Dinosaur/Vampire Flyers & Ascend",
      "description": "White-Blue commands the air with evasive flyers, tapping down blockers and racing to 10 permanents for the City's Blessing.",
      "mechanics": ["Flying Evasion", "Ascend / City's Blessing", "Defensive Tempo", "Tapping & Freeze"]
    },
    "UB": {
      "name": "Pirates (Sabotage & Treasure)",
      "headline": "Siren Infiltration • Raid Triggers, Treasure Hoarding & Saboteur Draw",
      "description": "Blue-Black deploys stealthy Pirate saboteurs. Attack each turn to trigger Raid, generating Treasure to cast black removal.",
      "mechanics": ["Pirate Tribal", "Raid Triggers", "Treasure Tokens", "Targeted Removal"]
    },
    "BR": {
      "name": "Pirates (Aggro & Plunder)",
      "headline": "Cutthroat Aggression • Low Curve Pirates, Direct Burn & Menace",
      "description": "Black-Red attacks with aggressive Pirate marauders, clearing blockers with Lightning Strike and sacrificing treasures.",
      "mechanics": ["Pirate Tribal", "Direct Burn", "Menace Attacks", "Treasure Plunder"]
    },
    "RG": {
      "name": "Dinosaurs (Enrage & Trample)",
      "headline": "Primal Enrage • Damage-Triggered Enrage Buffs & Colossal Trample",
      "description": "Red-Green commands terrifying Dinosaurs. Trigger the Enrage mechanic whenever dinos take damage to draw cards and make tokens.",
      "mechanics": ["Dinosaur Tribal", "Enrage Triggers", "Trample Beatdown", "4+ Power Threshold"]
    },
    "GW": {
      "name": "Dinosaurs (Ramp & Anthems)",
      "headline": "Sun-Crest Herd • Dinosaur Cost Reduction, Trample & Big Bodies",
      "description": "Green-White ramps into colossal Dinosaurs with Kinjalli's Caller and Drover of the Mighty, dominating combat.",
      "mechanics": ["Dinosaur Tribal", "Dino Cost Reduction", "Trample Stompy", "Anthem Buffs"]
    },
    "WB": {
      "name": "Vampires (Lifelink & Swarm)",
      "headline": "Legion of Dusk • 1/1 Lifelink Vampire Tokens & Opponent Bleed",
      "description": "White-Black floods the battlefield with 1/1 lifelink Vampire tokens, triggering drain and reaching the City's Blessing.",
      "mechanics": ["Vampire Tribal", "Lifelink Tokens", "Ascend Blessing", "Life Drain"]
    },
    "UR": {
      "name": "Pirates (Spells & Raid)",
      "headline": "Storm Fleet Privateers • Evasive Pirates, Raid Triggers & Burn",
      "description": "Blue-Red chains cheap burn spells and evasive Pirates, drawing cards off Raid and finishing with flying threats.",
      "mechanics": ["Pirate Tribal", "Raid Triggers", "Burn & Bounce", "Flying Evasion"]
    },
    "BG": {
      "name": "Explore & Graveyard Midrange",
      "headline": "Wildgrowth Infiltration • Exploring +1/+1 Counters & Land Smoothing",
      "description": "Black-Green triggers Explore on creatures to draw lands or grow permanent +1/+1 counters, dominating the midgame.",
      "mechanics": ["Explore", "+1/+1 Counters", "Card Smoothing", "Deathtouch Stall"]
    },
    "RW": {
      "name": "Dinosaurs (Enrage & Aggro)",
      "headline": "Sun Empire Vanguard • Fast Dino Curve, Enrage Triggers & Haste",
      "description": "Red-White curves out with fast Dinosaurs and human priests, attacking aggressively with combat tricks and haste.",
      "mechanics": ["Dinosaur Tribal", "Low Curve Aggro", "Combat Tricks", "First Strike Beats"]
    },
    "GU": {
      "name": "Merfolk (+1/+1 Counters & Unblockable)",
      "headline": "River Heralds • Merfolk Tribal, +1/+1 Counters & Swimming Past Blockers",
      "description": "Green-Blue is the iconic Merfolk archetype. Place +1/+1 counters on merfolk creatures and slip past defenders with unblockable attacks.",
      "mechanics": ["Merfolk Tribal", "+1/+1 Counters", "Unblockable Evasion", "Explore Support"]
    }
  },

  // Edge of Eternities (EOE)
  "EOE": {
    "WU": {
      "name": "Station Defense & Star-Fliers",
      "headline": "Orbital Bastion • Station Defense, Evasive Star-Fliers & Ward",
      "description": "White-Blue fortifies deep space stations, deploying high-toughness defense platforms while striking through the void with starships.",
      "mechanics": ["Station Defense", "Evasive Flying", "Ward Protection", "Tempo Bounce"]
    },
    "UB": {
      "name": "Void Probe & Mind Steal",
      "headline": "Deep Void • Hand Disruption, Cybernetic Steal & Targeted Removal",
      "description": "Blue-Black navigates the abyss of space, stripping opponent resources with precision discard and hard removal.",
      "mechanics": ["Targeted Removal", "Hand Disruption", "Card Advantage", "Void Triggers"]
    },
    "BR": {
      "name": "Reactor Meltdown & Plasma Burn",
      "headline": "Plasma Aggression • Sacrificing Overloaded Power Cores & Direct Burn",
      "description": "Black-Red overclocks starship reactors, sacrificing energy cores and fodder for explosive plasma burn spells.",
      "mechanics": ["Core Sacrifice", "Direct Burn", "Aggro Curve", "Morbid Triggers"]
    },
    "RG": {
      "name": "Asteroid Breakers & Stompy",
      "headline": "Primal Stompy • 4+ Power Dreadnoughts, Trample & Planetary Mining",
      "description": "Red-Green deploys colossal dreadnoughts and planetary drillers with trample that shatter defensive ground lines.",
      "mechanics": ["4+ Power Threshold", "Trample Beatdown", "Mana Ramp", "Fight Spells"]
    },
    "GW": {
      "name": "Colony Vanguard & Life Support",
      "headline": "Planetary Settlement • Colony Swarms, Shield Buffs & Collective Anthems",
      "description": "Green-White establishes resilient colonies, deploying worker tokens protected by life-support shields and anthems.",
      "mechanics": ["Colony Tokens", "+1/+1 Counters", "Anthem Buffs", "Shield Support"]
    },
    "WB": {
      "name": "Void Siphon & Entropy Bleed",
      "headline": "Dark Nebula • Siphoning Life Energy, Death Triggers & Drain",
      "description": "White-Black profits from the vacuum of space, draining opponent life totals whenever stations or ships are destroyed.",
      "mechanics": ["Life Drain", "Death Triggers", "Removal Control", "Resilient Board"]
    },
    "UR": {
      "name": "Tachyon Spells & Velocity",
      "headline": "Sublight Velocity • Chaining Spells, Cost Reduction & Overclock",
      "description": "Blue-Red chains high-tech instants and sorceries, reducing spell costs and dealing bursts of speed-of-light damage.",
      "mechanics": ["Spellslinger", "Cost Reduction", "Burn & Bounce", "Overclock Velocity"]
    },
    "BG": {
      "name": "Biomass Reclamation",
      "headline": "Organic Scavenge • Self-Mill, Biomass Counters & Deathtouch",
      "description": "Black-Green reclaims fallen organic matter in space, recycling dead crew members into massive bio-mechanical monstrosities.",
      "mechanics": ["Biomass Counters", "Self-Mill", "Deathtouch Stall", "Graveyard Recursion"]
    },
    "RW": {
      "name": "Starfighter Pilots & Fast Assault",
      "headline": "Vanguard Squadron • Rapid Dogfights, Starfighter Vehicles & Weapons",
      "description": "Red-White curves out with elite starfighter pilots and vehicles, delivering lightning-fast strikes before defenses activate.",
      "mechanics": ["Pilot Aggro", "Vehicles", "Combat Tricks", "First Strike Beats"]
    },
    "GU": {
      "name": "Singularity Ramp & Cosmic Leviathans",
      "headline": "Event Horizon • Gravitational Land Ramp, Big Draw & Space Krakens",
      "description": "Green-Blue bends space-time with extra land drops and cosmic mana acceleration, summoning titans from beyond the event horizon.",
      "mechanics": ["Gravity Ramp", "Massive Card Draw", "Cosmic Leviathans", "Late Game Power"]
    }
  },

  // Tarkir: Dragonstorm (TDM)
  "TDM": {
    "WU": {
      "name": "Ojutai Frost & Aerial Skies",
      "headline": "Dragon Skies • Evasive Dragons, Frost Tapping & Defensive Tempo",
      "description": "White-Blue channels the wisdom of Ojutai, locking down opposing attackers with frost breath while soaring with dragons.",
      "mechanics": ["Dragon Tribal", "Flying Evasion", "Tapping & Freeze", "Countermagic"]
    },
    "UB": {
      "name": "Silumgar Deception & Exploit",
      "headline": "Ruthless Venom • Sacrificing Fodder with Exploit & Hard Removal",
      "description": "Blue-Black serves Silumgar with cruel exploit sacrifices, eliminating threats with toxic removal and drawing fresh gas.",
      "mechanics": ["Exploit", "Dragon Tribal", "Targeted Removal", "Card Advantage"]
    },
    "BR": {
      "name": "Kolaghan Speed & Haste Dragons",
      "headline": "Lightning Assault • Haste Attackers, Direct Dragonfire & Aggro",
      "description": "Black-Red attacks with the speed of Kolaghan. Deploy haste dragons and berserkers, clearing blockers with direct dragonfire.",
      "mechanics": ["Haste Attackers", "Dragon Tribal", "Direct Burn", "Aggro Curve"]
    },
    "RG": {
      "name": "Atarka Ferocity & Dragon Stompy",
      "headline": "Savage Roar • 4+ Power Dragons, Trample & Trampling Carnage",
      "description": "Red-Green deploys devastating Atarka brood dragons with trample and ferocious power, stomping through opposing blockers.",
      "mechanics": ["Dragon Tribal", "4+ Power Threshold", "Trample Beatdown", "Mana Ramp"]
    },
    "GW": {
      "name": "Dromoka Bolster & Enduring Swarm",
      "headline": "Enduring Scale • Bolster Counters, Dragon Scales & Anthems",
      "description": "Green-White bolsters the weakest creatures with permanent +1/+1 counters, creating an unbreakable defensive line.",
      "mechanics": ["Bolster Counters", "Dragon Tribal", "+1/+1 Counters", "Anthem Buffs"]
    },
    "WB": {
      "name": "Enduring Scales & Drain",
      "headline": "Necrotic Chivalry • Dragon Death Triggers, Lifegain & Attrition",
      "description": "White-Black combines resilient scale armor with dark necromancy, draining opponents whenever dragons leave the battlefield.",
      "mechanics": ["Life Drain", "Death Triggers", "Removal Control", "Dragon Tribal"]
    },
    "UR": {
      "name": "Dragonfire Spellslinger",
      "headline": "Draconic Velocity • Instants/Sorceries, Dragonfire Burn & Prowess",
      "description": "Blue-Red chains noncreature spells, revealing dragons from hand to deal amplified dragonfire burn.",
      "mechanics": ["Dragonfire Spells", "Instants & Sorceries", "Prowess Velocity", "Burn & Bounce"]
    },
    "BG": {
      "name": "Dragon Graveyard Reclamation",
      "headline": "Bone Scavenge • Self-Mill, Reanimating Fallen Dragons & Deathtouch",
      "description": "Black-Green feeds dead dragons to the graveyard, reanimating skeletal drakes to terrorize the skies.",
      "mechanics": ["Reanimation", "Dragon Tribal", "Deathtouch Stall", "Self-Mill"]
    },
    "RW": {
      "name": "Dragon Riders & Aggro",
      "headline": "Sky Vanguard • Low Curve Riders, Equipment & Combat Tricks",
      "description": "Red-White curves out with dragon riders and weapons, pushing fast aggressive damage before opponent dragons hatch.",
      "mechanics": ["Dragon Riders", "Low Curve Aggro", "Combat Tricks", "First Strike Beats"]
    },
    "GU": {
      "name": "Dragonstorm Ramp & Roar",
      "headline": "Primal Dragonstorm • Mana Acceleration, Dragon Storms & Big Draw",
      "description": "Green-Blue accelerates through land ramp, unleashing devastating Dragonstorm flurries that overwhelm the game.",
      "mechanics": ["Mana Ramp", "Dragonstorm", "Card Advantage", "Colossal Finishers"]
    }
  },

  // Avatar: The Last Airbender (TLA)
  "TLA": {
    "WU": {
      "name": "Airbending Mastery & Evasion",
      "headline": "Air Nomad Skies • Glider Flying, Deflection & Evasive Tempo",
      "description": "White-Blue channels Airbending philosophy, deflecting enemy attacks with wind gusts while striking cleanly with gliders and sky bisons.",
      "mechanics": ["Airbending", "Flying Evasion", "Defensive Bounce", "Freeze & Tap"]
    },
    "UB": {
      "name": "Waterbending & Bloodbending Control",
      "headline": "Northern Tribe • Redirection, Frost Freeze & Shadow Subterfuge",
      "description": "Blue-Black manipulates water and ice to freeze opposing threats, drawing cards through flow and utilizing dark bloodbending.",
      "mechanics": ["Waterbending", "Freeze & Tap", "Targeted Removal", "Card Advantage"]
    },
    "BR": {
      "name": "Firebending & Combustion Aggro",
      "headline": "Fire Nation Might • Combustion Direct Burn, Aggro & Lightning Attacks",
      "description": "Black-Red attacks with aggressive Fire Nation soldiers, utilizing direct combustion burn to incinerate opposing life totals.",
      "mechanics": ["Firebending", "Direct Burn", "Aggro Curve", "Lightning Strikes"]
    },
    "RG": {
      "name": "Earthbending & Badger-Mole Stompy",
      "headline": "Solid Earth • 4+ Power Behemoths, Trample & Boulder Throwing",
      "description": "Red-Green commands the unyielding force of Earthbending, deploying high-power rock beasts and trampling through fortifications.",
      "mechanics": ["Earthbending", "4+ Power Threshold", "Trample Beatdown", "Fight Spells"]
    },
    "GW": {
      "name": "Kyoshi Warriors & Teamwork",
      "headline": "Kyoshi Discipline • Shield Fans, Team Anthems & Vigilant Defense",
      "description": "Green-White unites the disciplined Kyoshi Warriors, fighting in synchronized formations with shield fans and team-wide anthems.",
      "mechanics": ["Kyoshi Tribal", "+1/+1 Counters", "Anthem Buffs", "Vigilance Beats"]
    },
    "WB": {
      "name": "Chi Blocking & Spiritual Drain",
      "headline": "Equalist Strike • Paralyzing Blockers, Chi Blocking & Life Drain",
      "description": "White-Black strikes pressure points with Chi Blockers, removing opposing abilities and draining spirit energy.",
      "mechanics": ["Chi Blocking", "Ability Suppression", "Life Drain", "Removal Control"]
    },
    "UR": {
      "name": "Lightning Bending & Velocity",
      "headline": "Generators of Lightning • Instant Speed, Lightning Prowess & Burn",
      "description": "Blue-Red harnesses lightning generation, casting flurry upon flurry of noncreature bending forms with unmatched velocity.",
      "mechanics": ["Lightning Bending", "Instants & Sorceries", "Prowess Velocity", "Burn & Bounce"]
    },
    "BG": {
      "name": "Swampbending & Vine Attrition",
      "headline": "Foggy Swamp • Swampbenders, Deathtouch Stall & Regrowth Roots",
      "description": "Black-Green controls the Foggy Swamp, manipulating vine monsters and recycling fallen water tribe warriors.",
      "mechanics": ["Swampbending", "Deathtouch Stall", "Graveyard Recursion", "Midrange Grind"]
    },
    "RW": {
      "name": "Metalbending & Weapons",
      "headline": "Zaofu Armor • Metalbending Equipment, Cable Mobility & Fast Assault",
      "description": "Red-White equips metal cables and armor plates, granting first strike and high-power attack triggers.",
      "mechanics": ["Metalbending", "Equipment", "Low Curve Aggro", "Combat Tricks"]
    },
    "GU": {
      "name": "Avatar State & Elemental Mastery",
      "headline": "Cosmic Energy • 4-Element Land Ramp, Giant Spirit Monsters & Draw",
      "description": "Green-Blue unlocks the Avatar State, channeling all four elements through abundant land ramp and unstoppable cosmic card flow.",
      "mechanics": ["Avatar State", "Elemental Ramp", "Massive Card Draw", "Late Game Finishers"]
    }
  },

  // Marvel Super Heroes (MSH) & Marvel's Spider-Man (SPM)
  "MSH": {
    "WU": {
      "name": "Overwatch & Shield Defense",
      "headline": "S.H.I.E.L.D. Helicarrier • Aerial Tech, Protective Wards & Countermeasures",
      "description": "White-Blue establishes tactical command, deploying helicarriers and tech-enhanced agents with defensive wards and aerial dominance.",
      "mechanics": ["Gadget Tech", "Flying Evasion", "Ward Protection", "Defensive Tempo"]
    },
    "UB": {
      "name": "Black Ops & Espionage",
      "headline": "Shadow Operatives • Infiltration Sabotage, Hand Disruption & Removal",
      "description": "Blue-Black utilizes covert assassins and spies, extracting enemy secrets and eliminating threats from the shadows.",
      "mechanics": ["Espionage", "Targeted Removal", "Hand Disruption", "Card Advantage"]
    },
    "BR": {
      "name": "Villainous Mayhem & Explosives",
      "headline": "Sinister Syndicate • Explosive Direct Damage & Ruthless Aggro",
      "description": "Black-Red unleashes supervillain carnage with high-damage explosive gadgets and relentless aggressive attackers.",
      "mechanics": ["Explosives", "Direct Burn", "Aggro Curve", "Sacrifice Outlets"]
    },
    "RG": {
      "name": "Hulk Smash & Super Strength",
      "headline": "Gamma Rampage • 4+ Power Behemoths, Trample & Destructive Force",
      "description": "Red-Green deploys unstoppable powerhouses like the Incredible Hulk, smashing through defensive lines with trample.",
      "mechanics": ["Super Strength", "4+ Power Threshold", "Trample Beatdown", "Fight Spells"]
    },
    "GW": {
      "name": "Avengers Assemble & Teamwork",
      "headline": "Earth's Mightiest • Heroic Alliances, +1/+1 Counters & Team Anthems",
      "description": "Green-White rallies heroes together, triggering team-wide anthems and buffs whenever multiple heroes fight side-by-side.",
      "mechanics": ["Avengers Assemble", "+1/+1 Counters", "Anthem Buffs", "Token Swarm"]
    },
    "WB": {
      "name": "Vigilante Justice & Retribution",
      "headline": "Punisher Retribution • Death Payoffs, Life Drain & Tactical Removal",
      "description": "White-Black metes out street justice, draining opponents whenever allies fall and executing high-threat villains.",
      "mechanics": ["Retribution", "Life Drain", "Removal Control", "Resilient Board"]
    },
    "UR": {
      "name": "Stark Tech & Repulsor Velocity",
      "headline": "Iron Man Innovations • Gadget Spells, Repulsor Blasts & Velocity",
      "description": "Blue-Red innovates cutting-edge Stark technology, chaining gadget spells and repulsor blasts to incinerate obstacles.",
      "mechanics": ["Stark Tech", "Instants & Sorceries", "Burn & Bounce", "Prowess Velocity"]
    },
    "BG": {
      "name": "Symbiote Growth & Regeneration",
      "headline": "Venomous Bond • Self-Mill, Symbiote Counters & Deathtouch",
      "description": "Black-Green harnesses alien symbiotes, growing larger through combat attrition and regenerating fallen hosts.",
      "mechanics": ["Symbiote Counters", "Deathtouch Stall", "Graveyard Recursion", "Midrange Grind"]
    },
    "RW": {
      "name": "Super Soldier Strike",
      "headline": "Captain's Shield • Fast Vanguard Attackers, Shield Throws & Combat Tricks",
      "description": "Red-White curves out with super soldiers and tactical gear, pushing relentless aggressive combat with shield throws.",
      "mechanics": ["Super Soldiers", "Low Curve Aggro", "Combat Tricks", "First Strike Beats"]
    },
    "GU": {
      "name": "Quantum Realm Ramp",
      "headline": "Pym Particle Growth • Exponential Size Manipulation & Big Draw",
      "description": "Green-Blue explores the Quantum Realm, ramping mana rapidly and growing microscopic threats into titanic titans.",
      "mechanics": ["Quantum Ramp", "Size Manipulation", "Card Advantage", "Giant Finishers"]
    }
  },

  // Teenage Mutant Ninja Turtles (TMT)
  "TMT": {
    "WU": {
      "name": "Splinter's Agility & Defense",
      "headline": "Sensei's Discipline • Defensive Agility, Flying Evasion & Freeze",
      "description": "White-Blue embodies Master Splinter's disciplined ninjutsu, redirecting enemy attacks while striking with stealth gliders.",
      "mechanics": ["Ninjutsu", "Flying Evasion", "Defensive Bounce", "Freeze & Tap"]
    },
    "UB": {
      "name": "Foot Clan Ninjutsu",
      "headline": "Shadow Assassins • Ninjutsu Swaps, Saboteur Draw & Hard Removal",
      "description": "Blue-Black commands Shredder's Foot Clan ninjas, swapping unblocked attackers with lethal ninjas to draw cards and assassinate.",
      "mechanics": ["Ninjutsu", "Saboteur Triggers", "Targeted Removal", "Hand Disruption"]
    },
    "BR": {
      "name": "Mutagen Chaos & Shredder Slash",
      "headline": "Technodrome Terror • Direct Burn, Mutagen Outlets & Aggro",
      "description": "Black-Red attacks with Bebop, Rocksteady, and mutant thugs, sacrificing mutagen canisters for direct burn.",
      "mechanics": ["Mutagen Tokens", "Direct Burn", "Aggro Curve", "Sacrifice Outlets"]
    },
    "RG": {
      "name": "Turtle Power Stompy",
      "headline": "Heavy Shell Stomp • 4+ Power Shell Power, Trample & Street Brawling",
      "description": "Red-Green deploys armored mutant brawlers with 4+ power, utilizing heavy shells to shrug off damage and trample defenders.",
      "mechanics": ["Turtle Power", "4+ Power Threshold", "Trample Beatdown", "Fight Spells"]
    },
    "GW": {
      "name": "Pizza Party Swarm",
      "headline": "Cowabunga Brotherhood • Pizza Food Tokens, Token Swarms & Anthems",
      "description": "Green-White celebrates with pizza parties, generating Food tokens to gain life and fueling massive team-wide anthem attacks.",
      "mechanics": ["Pizza Food Tokens", "Token Swarm", "+1/+1 Counters", "Anthem Buffs"]
    },
    "WB": {
      "name": "Ancient Clan Honor",
      "headline": "Hamato Honor • Honorable Sacrifices, Death Drain & Removal",
      "description": "White-Black follows ancient ninja codes of honor, draining opponents whenever noble allies fall in battle.",
      "mechanics": ["Life Drain", "Death Triggers", "Removal Control", "Resilient Board"]
    },
    "UR": {
      "name": "Donatello's Inventions",
      "headline": "Turtle Tech • Gadget Spells, Electric Stun & Spell Velocity",
      "description": "Blue-Red leverages Donatello's gadgets, chaining noncreature gizmos and smoke bombs to out-maneuver opponents.",
      "mechanics": ["Gadgets", "Instants & Sorceries", "Burn & Bounce", "Prowess Velocity"]
    },
    "BG": {
      "name": "Sewer Ooze & Mutagenic Growth",
      "headline": "Sewer Habitat • Self-Mill, Mutagenic Ooze Counters & Deathtouch",
      "description": "Black-Green thrives in the NYC sewers, growing massive ooze monsters and recycling scrap from the graveyard.",
      "mechanics": ["Ooze Counters", "Self-Mill", "Deathtouch Stall", "Graveyard Recursion"]
    },
    "RW": {
      "name": "Casey Jones Vigilante Aggro",
      "headline": "Street Hockey Brawler • Low Curve Aggro, Sports Gear Weapons & Haste",
      "description": "Red-White curves out with street vigilantes and sports equipment, delivering fast hockey-stick beatdowns before guards react.",
      "mechanics": ["Vigilante Aggro", "Equipment", "Combat Tricks", "First Strike Beats"]
    },
    "GU": {
      "name": "Dimension X Ramp",
      "headline": "Utrom Portals • Dimensional Land Ramp, Krang Androids & Big Draw",
      "description": "Green-Blue opens portals to Dimension X, accelerating mana into colossal alien walkers and drawing cards off mutagen growth.",
      "mechanics": ["Portal Ramp", "Mutagen Growth", "Card Advantage", "Giant Finishers"]
    }
  },

  // Lorwyn Eclipsed (ECL)
  "ECL": {
    "WU": {
      "name": "Kithkin Skies & Thoughtweft",
      "headline": "Thoughtweft Unity • Flying Evasion, Kithkin Harmony & Defensive Tempo",
      "description": "White-Blue links minds through the Thoughtweft, deploying evasive kithkin and swan riders with synchronized protection.",
      "mechanics": ["Kithkin Tribal", "Flying Evasion", "Thoughtweft Buffs", "Defensive Tempo"]
    },
    "UB": {
      "name": "Faerie Mischief & Flash",
      "headline": "Glen Elendra • Flash Countermagic, Faerie Rogues & Saboteur Draw",
      "description": "Blue-Black plays elusive Faerie rogues at instant speed, stealing cards from the opponent while holding up countermagic.",
      "mechanics": ["Faerie Tribal", "Flash", "Saboteur Triggers", "Targeted Removal"]
    },
    "BR": {
      "name": "Boggart Shenanigans & Sacrifice",
      "headline": "Boggart Aunties • Goblin Fodder, Death Triggers & Direct Burn",
      "description": "Black-Red sacrifices mischievous boggarts and goblins, triggering death payoffs and direct damage to close games.",
      "mechanics": ["Boggart Tribal", "Sacrifice Outlets", "Direct Burn", "Graveyard Value"]
    },
    "RG": {
      "name": "Giant Stompy & Fling",
      "headline": "Cloudgoat Brawn • 4+ Power Giants, Trample & Boulder Flinging",
      "description": "Red-Green drops titanic Lorwyn Giants, trampling over small blockers and flinging creatures directly at opposing life totals.",
      "mechanics": ["Giant Tribal", "4+ Power Threshold", "Trample Beatdown", "Fling Direct Damage"]
    },
    "GW": {
      "name": "Changeling Kinship & Anthems",
      "headline": "Universal Kinship • Changelings of All Types, Shared Anthems & Swarm",
      "description": "Green-White commands Changelings that possess every creature type simultaneously, unlocking every tribal anthem in the deck.",
      "mechanics": ["Changeling", "Kinship Triggers", "+1/+1 Counters", "Anthem Buffs"]
    },
    "WB": {
      "name": "Cinder Aristocrats & Bleed",
      "headline": "Ashling's Lament • Elemental Death Triggers, Lifelink & Drain",
      "description": "White-Black balances sunlight and shadow, draining opponents whenever creatures fade and removing threats with dark cabal magic.",
      "mechanics": ["Life Drain", "Death Triggers", "Removal Control", "Resilient Board"]
    },
    "UR": {
      "name": "Elemental Flamekin Spells",
      "headline": "Flamekin Spark • Instants/Sorceries, Flamekin Prowess & Fast Burn",
      "description": "Blue-Red channels living fire, chaining cheap burn spells and cantrips to trigger explosive Flamekin combat rounds.",
      "mechanics": ["Elemental Tribal", "Instants & Sorceries", "Burn & Bounce", "Prowess Velocity"]
    },
    "BG": {
      "name": "Treefolk Toughness & Morbid Roots",
      "headline": "Murmuring Bosk • High Toughness Treefolk, Doran Combat & Deathtouch",
      "description": "Black-Green establishes impassable ground walls with high-toughness Treefolk, utilizing deathtouch roots and graveyard recursion.",
      "mechanics": ["Treefolk Tribal", "Toughness Combat", "Deathtouch Stall", "Graveyard Recursion"]
    },
    "RW": {
      "name": "Flamekin Vanguard & Haste",
      "headline": "Brighthearth Rush • Fast Curve Attackers, Haste & Combat Tricks",
      "description": "Red-White curves out with passionate Flamekin warriors, delivering blindingly fast attacks with combat tricks and first strike.",
      "mechanics": ["Elemental Tribal", "Low Curve Aggro", "Combat Tricks", "First Strike Beats"]
    },
    "GU": {
      "name": "Merrow Tides & River Ramp",
      "headline": "Wanderwine Flow • Merfolk Tap Synergies, Land Ramp & Big Monsters",
      "description": "Green-Blue accelerates mana using flowing river magic, tapping merfolk for value and ramping into legendary elementals.",
      "mechanics": ["Merfolk Tribal", "Tap Synergies", "Mana Ramp", "Colossal Finishers"]
    }
  },

  // Star Trek (TRK)
  "TRK": {
    "WU": {
      "name": "Starfleet Command & Shields",
      "headline": "Federation Flagship • Shield Modulation, Starship Flyers & Diplomacy",
      "description": "White-Blue represents Starfleet command. Protect ships with shield counters and evasive maneuvering while securing peaceful control.",
      "mechanics": ["Shield Counters", "Flying Starships", "Defensive Tempo", "Countermagic"]
    },
    "UB": {
      "name": "Section 31 Subterfuge",
      "headline": "Covert Intelligence • Sabotage, Cloaking Devices & Targeted Removal",
      "description": "Blue-Black executes Section 31 covert operations, decloaking unblockable operatives and eliminating hostile galactic threats.",
      "mechanics": ["Cloaking / Evasion", "Targeted Removal", "Hand Disruption", "Saboteur Draw"]
    },
    "BR": {
      "name": "Klingon Honor & Disruptor Barrage",
      "headline": "Bat'leth Combat • Warrior Aggro, Disruptor Direct Burn & Sacrifice",
      "description": "Black-Red attacks with honorable Klingon warriors, clearing obstacles with disruptor fire and relentless aggressive pressure.",
      "mechanics": ["Klingon Tribal", "Direct Burn", "Warrior Aggro", "Sacrifice Outlets"]
    },
    "RG": {
      "name": "Borg Collective & Assimilation",
      "headline": "Resistance is Futile • 4+ Power Cubes, Trample & Heavy Assimilation",
      "description": "Red-Green commands the Borg Collective, deploying massive assimilating cubes with trample that adapt to any defense.",
      "mechanics": ["Borg Tribal", "4+ Power Threshold", "Trample Beatdown", "Fight Spells"]
    },
    "GW": {
      "name": "Federation Alliance & Away Teams",
      "headline": "United Planets • Away Team Swarms, Officer Buffs & Collective Anthems",
      "description": "Green-White deploys specialized Away Teams, buffing crew members with shared officer badges and cooperative team anthems.",
      "mechanics": ["Away Teams", "+1/+1 Counters", "Anthem Buffs", "Token Swarm"]
    },
    "WB": {
      "name": "Romulan Intrigue & Drain",
      "headline": "Tal Shiar Plots • Deceitful Cloaking, Life Total Bleed & Assassination",
      "description": "White-Black orchestrates Tal Shiar conspiracies, bleeding opponent resources whenever cloaked agents strike from the shadows.",
      "mechanics": ["Life Drain", "Death Triggers", "Removal Control", "Cloaking"]
    },
    "UR": {
      "name": "Warp Core Velocity & Science",
      "headline": "Maximum Warp • Chaining Science Spells, Sensor Scans & Phaser Burn",
      "description": "Blue-Red overclocks the warp core, chaining sensor sweeps and scientific discoveries to blast blockers with phaser fire.",
      "mechanics": ["Science Spells", "Instants & Sorceries", "Burn & Bounce", "Warp Velocity"]
    },
    "BG": {
      "name": "Augment Mutagen & Regeneration",
      "headline": "Khan's Augments • Genetic Modifications, Deathtouch & Regeneration",
      "description": "Black-Green utilizes banned genetic augmentation, breeding superior physical specimens that regenerate and stall combat.",
      "mechanics": ["Genetic Counters", "Deathtouch Stall", "Graveyard Recursion", "Midrange Grind"]
    },
    "RW": {
      "name": "Phaser Assault & Security",
      "headline": "Redshirt Vanguard • Fast Tactical Assault, Phaser Weapons & First Strike",
      "description": "Red-White curves out with brave security officers, equipping phaser rifles to deliver rapid first-strike offensive assaults.",
      "mechanics": ["Security Officers", "Low Curve Aggro", "Equipment", "First Strike Beats"]
    },
    "GU": {
      "name": "Strange New Worlds Ramp",
      "headline": "Explore the Cosmos • Planetary Landfall, Cosmic Behemoths & Big Draw",
      "description": "Green-Blue seeks out new life and new civilizations, ramping extra planetary lands to deploy awe-inspiring cosmic entities.",
      "mechanics": ["Planetary Ramp", "Massive Card Draw", "Cosmic Leviathans", "Late Game Inevitability"]
    }
  }
};
