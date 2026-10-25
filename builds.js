// Builds of the overlay's own (from the Mistville Toolkit guide), shown with the advisor's build groups: each one's
// core Old Stuff, Key ones first, then the Important ones. They only show what you have and what's missing; the
// suggested order doesn't use them. (The guide's Map build is the advisor's Preview build: the same four
// Cartographer's Old Stuff.)
'use strict';

const BUILDS = [
  {
    id: 'omen', label: 'Omen build',
    note: 'Steles carry the early game, then move into another build',
    key: ["Filth Eater's Wages"],
    important: ['Mr. Misfortune', "Filth Eater's Dinner"],
    core: ["Filth Eater's Wages", 'Mr. Misfortune', "Filth Eater's Dinner", 'Baby Bear', 'Ms. Grumpy', "Anxious Black Goat's Horn", 'Amulet: Anxiety'],
  },
  {
    id: 'food', label: 'Food build',
    note: 'Resources through Food; the Condiments give the extra',
    key: ['Delicious Condiment', "Chief Trader's Statue"],
    important: ['Guild Medal - Food'],
    core: ['Delicious Condiment', "Chief Trader's Statue", 'Guild Medal - Food', 'Healthy Condiment', 'Wriggling Money Jar', "Gourmet's Knife and Fork", 'Watchful Purse'],
  },
];

// the builds compared to mark the one closest to complete: the Preview build (the advisor's group) and the two above
const CLOSEST_OF = ['preview', 'omen', 'food'];

module.exports = { BUILDS, CLOSEST_OF };
