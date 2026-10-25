// Every Mistville Old Stuff's ID, for reading what's on offer: the log names offered Old Stuff only by ID (offers.js).
// Nothing here ranks or scores: what to pick comes from the advisor (advisor/).
//
// From Beak Mask on, the ID is the Old Stuff's position in tlidb's list (tlidb.com/Mistville_Exploration) + 3; the
// first seven don't follow it and are set here. All 71 are checked against the 43 IDs in the logs (2026-10-22/23);
// any new Old Stuff is learned from your bag and kept in AppData (learned-ids.json).
'use strict';

// in tlidb's order
const NAMES = [
  "Doctor's Lantern", 'Sleeping Spice', 'Wriggling Money Jar', 'Map: Sanatorium', 'Sanatorium Contract',
  "Cartographer's Medicine Bottle", 'Mr. Misfortune', 'Beak Mask', "Explorer's Glasses", "Scavenger's Boots",
  'Burnt Map', "Cartographer's Quill", "Cartographer's Purse", 'Guild Medal - Old Stuff', 'Guild Medal - Food',
  "Chief Trader's Statue", 'Shopping List', "Apprentice Alchemist's Gloves", "Banker's IOU",
  'Coin-Filled Golden Goblet', 'Map: Bank', 'Alchemy Catalyst', 'Map: Alchemy Workshop', 'Map: Mistville Trader',
  "Scavenger's Pliers", 'Map: Unknown Old Stuff', "Gourmet's Knife and Fork", 'Sterling Silver Lunch Box',
  'Map: Food', 'Delicious Condiment', 'Ms. Grumpy', 'Map: Bad Omen Stele - Blindness',
  'Map: Bad Omen Stele - Anxiety', 'Map: Bad Omen Stele - Poverty', 'Map: Bad Omen Stele - Anorexia',
  "Blind Black Goat's Horn", "Anxious Black Goat's Horn", "Poor Black Goat's Horn", "Anorexic Black Goat's Horn",
  'Amulet: Blindness', 'Amulet: Anxiety', 'Amulet: Poverty', 'Amulet: Anorexia', "Filth Eater's Wages",
  "Filth Eater's Dinner", "Filth Eater's Token", "Filth Eater's Map", "First Bank's Shackles", 'Rusty Cranial Nail',
  "Amnesia Patient's Key", 'Uncanny Tales: Secret', 'Uncanny Tales: Gaze', 'Brain in a Jar', 'Torn Map',
  'White Crow Bonsai', 'Black Crow Bonsai', 'Egg of the Deep Mist', 'Egg of the Shallow Mist', 'Fluffy Old Blanket',
  'Watchful Purse', 'Special Protection Pass', "Cartographer's Stool", 'Baby Bear', 'Healthy Condiment',
  "Resident's Old Bowl", "Resident's Wooden Box", '"Diviner"', '"Banker"', '"Cartographer"', '"Explorer"',
  'Spoiled Sauce',
];

// IDs seen in the logs for the first seven (they don't follow the + 3 rule)
const EARLY_IDS = {
  "Doctor's Lantern": 2, 'Sleeping Spice': 3, 'Wriggling Money Jar': 4, 'Map: Sanatorium': 6, 'Sanatorium Contract': 7,
  "Cartographer's Medicine Bottle": 9, 'Mr. Misfortune': 10,
};

const ITEMS = NAMES.map((name, i) => ({ name, id: i + 1 >= 8 ? i + 1 + 3 : EARLY_IDS[name] || null })); // position + 3 from Beak Mask (8th) on
const BY_ID = new Map(ITEMS.filter((x) => x.id).map((x) => [x.id, x]));

module.exports = { ITEMS, BY_ID };
