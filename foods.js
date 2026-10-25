// Mistville Food: ID -> name, as the game logs it in your bag ("道具名:Golden Worm Cheese 道具ID22"). Offers (Food
// Cells, the Trader) name Food only by ID. Collected from the logs (2026-10-22/23); Food not listed here is learned
// from your bag and kept in AppData (learned-ids.json). No effects yet: the logs don't carry them.
'use strict';

const FOOD_IDS = {
  1: 'Clock Tower Sleeping Candy', 2: "Trader's Sugar Cube", 3: "Banker's Chocolate Coin", 7: 'Alchemy Workshop Rainbow Candy',
  10: 'Grilled White Truffle', 11: 'Golden Caviar', 12: 'Fragrant Cat Food', 13: 'Secret Recipe Canned Meat', 19: 'Lard Potion',
  21: 'Rich Pork Pate', 22: 'Golden Worm Cheese', 25: 'Fireflies in Oil', 37: 'Alchemy Potion Pickles', 38: 'Alchemy Potion Cured Meat',
  40: 'Dried Mistfish', 41: 'Skewered Fish Eyes', 42: 'Firefly Sashimi', 44: 'Rotten Raven Bisque', 45: 'Golden Frog Eggs',
  47: 'Walnut Pudding', 48: 'Super Concentrated Sour Soup', 49: 'Pig Liver Medicine Soup', 51: "Wally's Grapes", 54: 'Tentacle Cream Soup',
  57: 'Water of Blithe', 58: "Explorer's Meat & Rice", 59: 'Fluorescent Moth Soup', 61: 'Mud-Boiled Sheep Eyes', 68: 'Night Pudding',
  69: 'Spider Silk Noodles', 72: 'Half a Piece of Golden Lava Cake', 999: 'Fragrant Cat Food',
};

module.exports = { FOOD_IDS };
