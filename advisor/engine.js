// The advisor: the Old Stuff ranking (day stages × categories × build groups), Food timing, Alchemy Workshop upgrade
// gain, Sanity warnings, Clock Tower reachability, detours, build progress and gain cards. adapt.js feeds it the
// overlay's state. Written by advisor/sync.js: don't edit it here; sync again instead.
'use strict';
const node_fs = require('fs');
const node_path = require('path');
const tiles = { "1000": "Bench", "2002": "Stele · Blindness", "2003": "Stele · Anxiety", "2004": "Stele · Poverty", "2005": "Stele · Anorexia", "2013": "Stele · Anxiety", "2023": "Stele · Anxiety", "3000": "Old Stuff", "4000": "Food", "4001": "Food", "4002": "Food", "5000": "Trader", "5001": "Trader", "5002": "Trader", "6001": "Sanatorium", "6002": "Bank", "6004": "Ruins", "6005": "Watchtower", "6014": "Ruins", "7001": "Folklores", "8000": "Workshop", "98000": "Clearing", "99000": "Clock Tower", "99001": "Clock Tower" };
const tileNameData = {
  tiles
};
const TILE_NAMES$1 = tileNameData.tiles;
function guaranteeOf(day) {
  if (day < 2) return null;
  return day % 2 === 0 ? "Mistville Trader" : "Alchemy Workshop";
}
const version$1 = 1;
const comment$1 = "Worst-case warning thresholds (design §8.2 / implementation plan §1.1, decision 6). Worst-case Cells = unknown Cells now; worst-case cost = worst-case Cells × today's cost; as a share of the Sanity left, ≥ yellowRatio → yellow, ≥ redRatio → red. No warning once the Clock Tower is revealed, with no unknown Cells, with an unknown cost, or after the run ends. To try the red state for real, lower redRatio for a while (e.g. 0.3) so it fires while healthy, then put it back; changes apply after a restart.";
const yellowRatio = 0.8;
const redRatio = 1;
const warningThresholds = {
  version: version$1,
  comment: comment$1,
  yellowRatio,
  redRatio
};
const version = 1;
const comment = "Recommendation weights (M3.2, reworked in M8). Since M8, Old Stuff picks follow the day-stage guide order (synergy.json guide); relicDailyValue here (base/up, equivalent Sanity per day) is only used for the net gain of Workshop upgrades; the Food timing types (kindScores/foodKinds/situational multipliers) are kept as they were (confirmed by the author, D13-1). The numbers are conservative, explainable estimates, and all of them can be tuned.";
const remainingDaysTotal = 15;
const unknownDailyValue = 2;
const relicDailyValue = { "Doctor's Lantern": { "base": 12, "up": 22 }, "Sleeping Spice": { "base": 20, "up": 22 }, "Fluffy Old Blanket": { "base": 10, "up": 19 }, "Wriggling Money Jar": { "base": 3, "up": 12 }, "Watchful Purse": { "base": 3, "up": 6 }, "Sanatorium Contract": { "base": 7, "up": 8 }, "Special Protection Pass": { "base": 10, "up": 20 }, "Cartographer's Medicine Bottle": { "base": 5, "up": 10 }, "Cartographer's Stool": { "base": 6, "up": 12 }, "Mr. Misfortune": { "base": 4, "up": 8 }, "Baby Bear": { "base": 5, "up": 10 }, "Delicious Condiment": { "base": 5, "up": 10 }, "Healthy Condiment": { "base": 6, "up": 12 }, "Beak Mask": { "base": 4, "up": 12 }, "Ms. Grumpy": { "base": 5, "up": 10 }, "Scavenger's Boots": { "base": 3, "up": 8 }, "Banker's IOU": { "base": 3, "up": 6 }, "Coin-Filled Golden Goblet": { "base": 4, "up": 8 }, "Burnt Map": { "base": 6, "up": 12 }, "Map: Sanatorium": { "base": 2, "up": 4 }, "Map: Bank": { "base": 2, "up": 4 }, "Map: Alchemy Workshop": { "base": 2, "up": 4 }, "Map: Mistville Trader": { "base": 2, "up": 4 }, "Map: Unknown Old Stuff": { "base": 3, "up": 6 }, "Map: Food": { "base": 3, "up": 6 }, "Cartographer's Quill": { "base": 4, "up": 8 }, "Cartographer's Purse": { "base": 5, "up": 10 }, "Guild Medal - Old Stuff": { "base": 10, "up": 18 }, "Guild Medal - Food": { "base": 8, "up": 15 }, "Chief Trader's Statue": { "base": 3, "up": 5 }, "Shopping List": { "base": 3, "up": 6 }, "Apprentice Alchemist's Gloves": { "base": 3, "up": 6 }, "Alchemy Catalyst": { "base": 3, "up": 6 }, "Scavenger's Pliers": { "base": 3, "up": 6 }, "Gourmet's Knife and Fork": { "base": 4, "up": 7 }, "Sterling Silver Lunch Box": { "base": 5, "up": 9 }, "Map: Bad Omen Stele - Blindness": { "base": 3, "up": 5 }, "Map: Bad Omen Stele - Anxiety": { "base": 3, "up": 5 }, "Map: Bad Omen Stele - Poverty": { "base": 3, "up": 5 }, "Map: Bad Omen Stele - Anorexia": { "base": 3, "up": 5 }, "Blind Black Goat's Horn": { "base": 2, "up": 4 }, "Anxious Black Goat's Horn": { "base": 2, "up": 4 }, "Poor Black Goat's Horn": { "base": 2, "up": 4 }, "Anorexic Black Goat's Horn": { "base": 2, "up": 4 }, "Amulet: Blindness": { "base": 2, "up": 5 }, "Amulet: Anxiety": { "base": 3, "up": 6 }, "Amulet: Poverty": { "base": 2, "up": 5 }, "Amulet: Anorexia": { "base": 2, "up": 5 }, "Filth Eater's Wages": { "base": 3, "up": 5 }, "Filth Eater's Dinner": { "base": 3, "up": 5 }, "Filth Eater's Token": { "base": 2, "up": 4 }, "Filth Eater's Map": { "base": 3, "up": 5 }, "\"Explorer\"": { "base": 2, "up": 4 }, "Spoiled Sauce": { "base": 2, "up": 4 }, "Torn Map": { "base": 2, "up": 4 }, "Explorer's Glasses": { "base": 0, "up": 0 }, "Brain in a Jar": { "base": 0, "up": 0 }, "\"Diviner\"": { "base": 0, "up": 0 }, "\"Banker\"": { "base": 0, "up": 0 }, "\"Cartographer\"": { "base": 0, "up": 0 }, "First Bank's Shackles": { "base": 0, "up": 0 }, "Rusty Cranial Nail": { "base": 0, "up": 0 }, "Amnesia Patient's Key": { "base": 0, "up": 0 }, "Uncanny Tales: Secret": { "base": 0, "up": 0 }, "Uncanny Tales: Gaze": { "base": 0, "up": 0 }, "White Crow Bonsai": { "base": 0, "up": 0 }, "Black Crow Bonsai": { "base": 0, "up": 0 }, "Egg of the Deep Mist": { "base": 0, "up": 0 }, "Egg of the Shallow Mist": { "base": 0, "up": 0 }, "Resident's Old Bowl": { "base": 0, "up": 0 }, "Resident's Wooden Box": { "base": 0, "up": 0 } };
const kindScores = { "preview": 40, "previewTower": 60, "clearStone": 60, "restore": 0, "gold": 0, "highCostDay": 70, "exploreDown": 50, "clearCostDown": 45, "foodUp": 40, "upgrade": 50 };
const situational = { "towerUnknownBoost": 1.5, "towerKnownCut": 0.5, "blockedBoost": 1.5, "noBlockedCut": 0.5, "highCostDayBoost": 1.5, "lowCostDayCut": 0.5, "highCostDayFrom": 11, "goldToSanity": 0.5 };
const detourRoi = { "comment": "Detour ROI (M3.4): the notes give no fixed base gain for Sanatoriums/Banks (Sanatorium Contract/Special Protection Pass/Banker's IOU only add to it), so these are conservative defaults to tune after testing; Bank Coins convert to equivalent Sanity by goldToSanity.", "sanatoriumRest": 20, "bankGold": 80 };
const buffer = { "comment": "Odd-day buffer reminder (M3.4): what the Folklore fight (Advent of Folklores) costs depends on the build and can't be predicted from the log, so a conservative fixed reserve is suggested.", "reserveSanity": 30 };
const synergy = { "comment": "M5.3 Food synergy bonus (D4): ownedBoost = score multiplier for a candidate whose partner you hold (Food timing only; since M8, Old Stuff puts held pairs first in its order instead of using a multiplier). Defaults to 1 (no bonus).", "ownedBoost": 1.3 };
const foodKinds = { "Clock Tower Sleeping Candy": { "kind": "previewTower" }, "Delicate Frosting": { "kind": "previewTower" }, "Fluorescent Moth Soup": { "kind": "previewTower" }, "Firefly Sashimi": { "kind": "preview" }, "Skewered Fish Eyes": { "kind": "preview" }, "Butter-Grilled Fish Eyes": { "kind": "preview" }, "Banker's Chocolate Coin": { "kind": "preview" }, "Sanatorium Sugar Pill": { "kind": "preview" }, "Trader's Sugar Cube": { "kind": "preview" }, "Alchemy Workshop Rainbow Candy": { "kind": "preview" }, "Dreamfish Sashimi": { "kind": "preview" }, "Mud-Boiled Sheep Eyes": { "kind": "preview" }, "Half a Piece of Raspberry Pie": { "kind": "preview" }, "Fragrant Cat Food": { "kind": "clearStone" }, "Super Concentrated Sour Soup": { "kind": "clearStone" }, "Secret Recipe Canned Meat": { "kind": "clearStone" }, "Raven Consomme": { "kind": "clearStone" }, "Rotten Raven Bisque": { "kind": "clearStone" }, "Water of Joy": { "kind": "clearStone" }, "Water of Blithe": { "kind": "clearStone" }, "Walnut Pudding": { "kind": "restore", "value": 120 }, "Dried Mistfish": { "kind": "restore", "value": 60 }, "Charcoal-Grilled Tentacle Skewer": { "kind": "restore", "value": 20 }, "Pickled Mistfish": { "kind": "restore", "value": 25 }, "Wally's Grapes": { "kind": "restore", "value": 30 }, "Pig Liver Medicine Soup": { "kind": "restore", "value": 40 }, "Explorer's Meat & Rice": { "kind": "highCostDay" }, "Grilled Raven Skewer": { "kind": "highCostDay" }, "Tentacle Cream Soup": { "kind": "exploreDown" }, "Spider Silk Noodles": { "kind": "exploreDown" }, "Night Pudding": { "kind": "clearCostDown" }, "Golden Caviar": { "kind": "gold", "value": 20 }, "Golden Frog Eggs": { "kind": "gold", "value": 120 }, "Golden Worm Cheese": { "kind": "gold", "value": 100 }, "Grilled White Truffle": { "kind": "gold", "value": 80 }, "Half a Piece of Golden Lava Cake": { "kind": "gold", "value": 80 }, "Lard Potion": { "kind": "gold", "value": 60 }, "Rich Pork Pate": { "kind": "foodUp" }, "Layered Sandwich": { "kind": "foodUp" }, "Alchemy Potion Pickles": { "kind": "upgrade" }, "Alchemy Potion Cured Meat": { "kind": "upgrade" } };
const valueWeightsData = {
  version,
  comment,
  remainingDaysTotal,
  unknownDailyValue,
  relicDailyValue,
  kindScores,
  situational,
  detourRoi,
  buffer,
  synergy,
  foodKinds
};
const dailyClearCost = [10, 10, 10, 12, 14, 16, 20, 24, 30, 36, 42, 50, 60, 80, 100];
const catalogData = {
  dailyClearCost
};
const ARCHETYPES = ["General", "Preview", "Stele", "Food"];
const TAGS = ["Coin gain", "Coin savings", "Sanity recovery", "Sanity savings", "Max Sanity", "Preview", "Other"];
const PRIORITIES = ["must", "high"];
const SOURCES = ["encounter"];
function emptySynergy() {
  return { guide: { segments: [], groupPriority: [] }, relics: [], foods: [], builds: [] };
}
function isFiniteNumber$1(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function normPairs(v, ctx, warnings) {
  if (v === void 0 || v === null) return [];
  if (!Array.isArray(v)) {
    warnings.push(`${ctx}: pairs is not an array, ignored`);
    return [];
  }
  const out = [];
  for (const p of v) {
    const o = p;
    if (typeof o.with === "string" && o.with !== "" && typeof o.note === "string" && o.note !== "") {
      out.push({ with: o.with, note: o.note });
    } else {
      warnings.push(`${ctx}: invalid pair (with/note missing), removed`);
    }
  }
  return out;
}
function normStringArray(v, ctx, field, warnings) {
  if (v === void 0 || v === null) return [];
  if (!Array.isArray(v)) {
    warnings.push(`${ctx}: ${field} is not an array, ignored`);
    return [];
  }
  const out = [];
  for (const item of v) {
    if (typeof item === "string" && item !== "") out.push(item);
    else warnings.push(`${ctx}: ${field} has an invalid entry, removed`);
  }
  return out;
}
function normRelic(v, warnings) {
  const o = v;
  if (typeof o.name !== "string" || o.name === "") {
    warnings.push("synergy: Old Stuff entry without a name, removed");
    return null;
  }
  const ctx = `Old Stuff ${o.name}`;
  if (typeof o.archetype !== "string" || !ARCHETYPES.includes(o.archetype)) {
    warnings.push(`${ctx}: invalid archetype, removed`);
    return null;
  }
  const tag = (val, field) => {
    if (val === void 0 || val === null) return null;
    if (typeof val === "string" && TAGS.includes(val)) return val;
    warnings.push(`${ctx}: invalid ${field}, treated as null`);
    return null;
  };
  let priority = null;
  if (o.priority !== void 0 && o.priority !== null) {
    if (typeof o.priority === "string" && PRIORITIES.includes(o.priority)) priority = o.priority;
    else warnings.push(`${ctx}: invalid priority, treated as null`);
  }
  let source = null;
  if (o.source !== void 0 && o.source !== null) {
    if (typeof o.source === "string" && SOURCES.includes(o.source)) source = o.source;
    else warnings.push(`${ctx}: invalid source, treated as null`);
  }
  return {
    name: o.name,
    archetype: o.archetype,
    tier1: tag(o.tier1, "tier1"),
    tier2: tag(o.tier2, "tier2"),
    pairs: normPairs(o.pairs, ctx, warnings),
    requires: normStringArray(o.requires, ctx, "requires", warnings),
    requiresAny: o.requiresAny === true,
    priority,
    source,
    note: typeof o.note === "string" ? o.note : null
  };
}
function normFood(v, warnings) {
  const o = v;
  if (typeof o.name !== "string" || o.name === "") {
    warnings.push("synergy: Food entry without a name, removed");
    return null;
  }
  const ctx = `Food ${o.name}`;
  if (typeof o.archetype !== "string" || !ARCHETYPES.includes(o.archetype)) {
    warnings.push(`${ctx}: invalid archetype, removed`);
    return null;
  }
  return {
    name: o.name,
    archetype: o.archetype,
    pairs: normPairs(o.pairs, ctx, warnings),
    note: typeof o.note === "string" ? o.note : null
  };
}
function normGuide(v, warnings) {
  const o = v;
  if (typeof o !== "object" || o === null || !Array.isArray(o.segments)) {
    warnings.push("synergy: guide missing or invalid (segments must be an array), using an empty guide");
    return null;
  }
  const segments = [];
  const seenSeg = /* @__PURE__ */ new Set();
  for (const s of o.segments) {
    const so = s;
    if (typeof so?.label !== "string" || so.label === "" || !isFiniteNumber$1(so.fromDay) || !isFiniteNumber$1(so.toDay) || typeof so.strategy !== "string" || so.strategy === "") {
      warnings.push("synergy: guide stage with missing or invalid fields, removed");
      continue;
    }
    const rawCategories = Array.isArray(so.categories) ? so.categories : [];
    if (seenSeg.has(so.label)) {
      warnings.push(`synergy: duplicate guide stage: ${so.label} (later one removed)`);
      continue;
    }
    seenSeg.add(so.label);
    const categories = [];
    for (const c of rawCategories) {
      const co = c;
      if (typeof co?.label !== "string" || co.label === "" || co.priority !== "high" && co.priority !== "mid" || !Array.isArray(co.items)) {
        warnings.push(`Guide stage ${so.label}: category with missing or invalid fields, removed`);
        continue;
      }
      if (co.build !== void 0 && co.build !== null && typeof co.build !== "string") {
        warnings.push(`Guide stage ${so.label}, category ${co.label}: invalid build, treated as null`);
      }
      const items = [];
      for (const it of co.items) {
        const io = it;
        if (typeof io?.name === "string" && io.name !== "") {
          items.push(io.lowest === true ? { name: io.name, lowest: true } : { name: io.name });
        } else {
          warnings.push(`Guide stage ${so.label}, category ${co.label}: invalid item, removed`);
        }
      }
      const build = typeof co.build === "string" && co.build !== "" ? co.build : null;
      categories.push({ label: co.label, priority: co.priority, build, items });
    }
    const mode = so.mode === "gap-fill" ? "gap-fill" : void 0;
    segments.push({ label: so.label, fromDay: so.fromDay, toDay: so.toDay, ...mode !== void 0 ? { mode } : {}, strategy: so.strategy, categories });
  }
  const groupPriority = normStringArray(o.groupPriority, "guide", "groupPriority", warnings);
  return { segments, groupPriority };
}
function normBuild(v, warnings) {
  const o = v;
  if (typeof o.id !== "string" || o.id === "" || typeof o.label !== "string" || o.label === "") {
    warnings.push("synergy: build group without id/label, removed");
    return null;
  }
  const ctx = `Build group ${o.id}`;
  if (o.kind !== "count" && o.kind !== "collect" && o.kind !== "pair") {
    warnings.push(`${ctx}: invalid kind (must be count|collect|pair), removed`);
    return null;
  }
  const members = normStringArray(o.members, ctx, "members", warnings);
  if (members.length === 0 || !isFiniteNumber$1(o.target) || o.target < 1) {
    warnings.push(`${ctx}: members/target missing or invalid, removed`);
    return null;
  }
  if (o.kind === "count") {
    for (const tag of members) {
      if (!TAGS.includes(tag)) {
        warnings.push(`${ctx}: invalid tag ${tag} in a count group, whole group removed`);
        return null;
      }
    }
  }
  const anyOf = [];
  if (o.anyOf !== void 0 && o.anyOf !== null) {
    if (Array.isArray(o.anyOf)) {
      for (const grp of o.anyOf) {
        if (Array.isArray(grp)) {
          const names = grp.filter((x) => typeof x === "string" && x !== "");
          if (names.length > 0) anyOf.push(names);
          else warnings.push(`${ctx}: empty anyOf group, removed`);
        } else {
          warnings.push(`${ctx}: anyOf entry is not an array, removed`);
        }
      }
    } else {
      warnings.push(`${ctx}: anyOf is not an array, ignored`);
    }
  }
  const pairs = [];
  if (o.kind === "pair" && o.pairs !== void 0 && o.pairs !== null) {
    if (Array.isArray(o.pairs)) {
      for (const p of o.pairs) {
        const cand = p;
        if (typeof cand?.base === "string" && cand.base !== "" && typeof cand?.partner === "string" && cand.partner !== "") {
          pairs.push({ base: cand.base, partner: cand.partner });
        } else {
          warnings.push(`${ctx}: pair without base/partner, removed`);
        }
      }
    } else {
      warnings.push(`${ctx}: pairs is not an array, ignored`);
    }
    if (pairs.length === 0 && normStringArray(o.wildcardPartners, ctx, "wildcardPartners", warnings).length === 0) {
      warnings.push(`${ctx}: pair group with neither pairs nor wildcardPartners, whole group removed`);
      return null;
    }
  }
  const wildcardPartners = o.kind === "pair" ? normStringArray(o.wildcardPartners, ctx, "wildcardPartners", warnings) : [];
  let wildcardBaseTag = null;
  if (o.kind === "pair" && typeof o.wildcardBaseTag === "string" && o.wildcardBaseTag !== "") {
    if (TAGS.includes(o.wildcardBaseTag)) wildcardBaseTag = o.wildcardBaseTag;
    else warnings.push(`${ctx}: wildcardBaseTag ${o.wildcardBaseTag} is not a valid tag, ignored`);
  }
  const minDay = isFiniteNumber$1(o.minDay) && o.minDay >= 1 ? o.minDay : 1;
  return { id: o.id, label: o.label, kind: o.kind, members, anyOf, pairs, wildcardPartners, wildcardBaseTag, target: o.target, minDay, note: typeof o.note === "string" ? o.note : null };
}
function loadSynergy(resourceDir) {
  let raw;
  try {
    raw = node_fs.readFileSync(node_path.join(resourceDir, "synergy.json"), "utf8");
  } catch (err) {
    return { synergy: emptySynergy(), warnings: [`Couldn't read synergy.json (using empty synergy data): ${String(err)}`] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { synergy: emptySynergy(), warnings: [`Couldn't parse synergy.json (using empty synergy data): ${String(err)}`] };
  }
  const warnings = [];
  const data = parsed;
  if (!Array.isArray(data.relics) || !Array.isArray(data.foods)) {
    return { synergy: emptySynergy(), warnings: ["synergy.json is malformed: relics/foods missing or not arrays (using empty synergy data)"] };
  }
  const guide = data.guide !== void 0 && data.guide !== null ? normGuide(data.guide, warnings) : null;
  const relics = [];
  const seenRelic = /* @__PURE__ */ new Set();
  for (const r of data.relics) {
    const norm = normRelic(r, warnings);
    if (norm === null) continue;
    if (seenRelic.has(norm.name)) {
      warnings.push(`synergy: duplicate Old Stuff entry: ${norm.name} (later one removed)`);
      continue;
    }
    seenRelic.add(norm.name);
    relics.push(norm);
  }
  const foods = [];
  const seenFood = /* @__PURE__ */ new Set();
  for (const f of data.foods) {
    const norm = normFood(f, warnings);
    if (norm === null) continue;
    if (seenFood.has(norm.name)) {
      warnings.push(`synergy: duplicate Food entry: ${norm.name} (later one removed)`);
      continue;
    }
    seenFood.add(norm.name);
    foods.push(norm);
  }
  const builds = [];
  if (data.builds !== void 0 && data.builds !== null) {
    if (Array.isArray(data.builds)) {
      const seenBuild = /* @__PURE__ */ new Set();
      for (const b of data.builds) {
        const norm = normBuild(b, warnings);
        if (norm === null) continue;
        if (seenBuild.has(norm.id)) {
          warnings.push(`synergy: duplicate build group id: ${norm.id} (later one removed)`);
          continue;
        }
        seenBuild.add(norm.id);
        builds.push(norm);
      }
    } else {
      warnings.push("synergy: builds is not an array, ignored");
    }
  }
  return { synergy: { guide: guide ?? { segments: [], groupPriority: [] }, relics, foods, builds }, warnings };
}
function resolveSynergyEntries(synergy2, knownNames) {
  const warnings = [];
  const relics = synergy2.relics.filter((r) => {
    if (knownNames.has(r.name)) return true;
    warnings.push(`synergy: Old Stuff ${r.name} is not in the catalog, removed`);
    return false;
  });
  const foods = synergy2.foods.filter((f) => {
    if (knownNames.has(f.name)) return true;
    warnings.push(`synergy: Food ${f.name} is not in the catalog, removed`);
    return false;
  });
  const normRelicPairs = (r) => ({
    ...r,
    pairs: r.pairs.filter((p) => {
      if (knownNames.has(p.with)) return true;
      warnings.push(`Old Stuff ${r.name}: partner ${p.with} is not in the catalog, removed`);
      return false;
    }),
    requires: r.requires.filter((req) => {
      if (knownNames.has(req)) return true;
      warnings.push(`Old Stuff ${r.name}: required piece ${req} is not in the catalog, removed`);
      return false;
    })
  });
  const normFoodPairs = (f) => ({
    ...f,
    pairs: f.pairs.filter((p) => {
      if (knownNames.has(p.with)) return true;
      warnings.push(`Food ${f.name}: partner ${p.with} is not in the catalog, removed`);
      return false;
    })
  });
  const normBuildMembers = (b) => {
    if (b.kind === "count") return b;
    const ctx = `Build group ${b.id}`;
    const members = b.members.filter((m) => {
      if (knownNames.has(m)) return true;
      warnings.push(`${ctx}: member ${m} is not in the catalog, removed`);
      return false;
    });
    if (b.kind === "pair") {
      const pairs = b.pairs.filter((p) => {
        if (knownNames.has(p.base) && knownNames.has(p.partner)) return true;
        warnings.push(`${ctx}: pair ${p.base}↔${p.partner} names something not in the catalog, removed`);
        return false;
      });
      const wildcardPartners = b.wildcardPartners.filter((w) => {
        if (knownNames.has(w)) return true;
        warnings.push(`${ctx}: wildcard member ${w} is not in the catalog, removed`);
        return false;
      });
      if (members.length === 0 || pairs.length === 0 && wildcardPartners.length === 0) {
        warnings.push(`${ctx}: no valid pair members, whole group removed`);
        return null;
      }
      return { ...b, members, pairs, wildcardPartners };
    }
    const anyOf = b.anyOf.map(
      (grp) => grp.filter((m) => {
        if (knownNames.has(m)) return true;
        warnings.push(`${ctx}: anyOf item ${m} is not in the catalog, removed`);
        return false;
      })
    ).filter((grp) => grp.length > 0);
    if (members.length === 0) {
      warnings.push(`${ctx}: no valid members, whole group removed`);
      return null;
    }
    return { ...b, members, anyOf };
  };
  const buildIds = new Set(synergy2.builds.map((b) => b.id));
  const normGuide2 = (g) => {
    const segments = g.segments.map((seg) => ({
      ...seg,
      categories: seg.categories.map((c) => {
        const build = c.build !== null && !buildIds.has(c.build) ? (warnings.push(`Guide category ${c.label}: build group ${c.build} is not in builds, treated as null`), null) : c.build;
        const items = c.items.filter((it) => {
          if (knownNames.has(it.name)) return true;
          warnings.push(`Guide category ${c.label}: item ${it.name} is not in the catalog, removed`);
          return false;
        });
        if (items.length === 0) {
          warnings.push(`Guide category ${c.label}: no valid items, category removed`);
          return null;
        }
        return { ...c, build, items };
      }).filter((c) => c !== null)
    }));
    return { segments, groupPriority: g.groupPriority };
  };
  const guideResolved = normGuide2(synergy2.guide);
  const gpFiltered = guideResolved.groupPriority.filter((id) => {
    if (buildIds.has(id)) return true;
    warnings.push(`groupPriority has an unknown group id: ${id} (removed)`);
    return false;
  });
  for (const b of synergy2.builds) {
    if (!gpFiltered.includes(b.id)) {
      gpFiltered.push(b.id);
      warnings.push(`groupPriority is missing group id: ${b.id} (appended in builds order)`);
    }
  }
  guideResolved.groupPriority = gpFiltered;
  return {
    synergy: { guide: guideResolved, relics: relics.map(normRelicPairs), foods: foods.map(normFoodPairs), builds: synergy2.builds.map(normBuildMembers).filter((b) => b !== null) },
    warnings
  };
}
function buildSynergyIndexes(synergy2) {
  const relicsByName = new Map(synergy2.relics.map((r) => [r.name, r]));
  const foodsByName = new Map(synergy2.foods.map((f) => [f.name, f]));
  const reverseByTarget = /* @__PURE__ */ new Map();
  const push = (target, ref) => {
    const list = reverseByTarget.get(target);
    if (list) list.push(ref);
    else reverseByTarget.set(target, [ref]);
  };
  for (const r of synergy2.relics) for (const p of r.pairs) push(p.with, { kind: "relic", name: r.name, note: p.note });
  for (const f of synergy2.foods) for (const p of f.pairs) push(p.with, { kind: "food", name: f.name, note: p.note });
  return { relicsByName, foodsByName, reverseByTarget };
}
const DAILY_COSTS = {
  dailyClearCost: catalogData.dailyClearCost
};
const WARNING_THRESHOLDS = warningThresholds;
const BELL_TOWER_TYPE = "S6_EndPoint";
function lookupClearCost(day) {
  if (day < 1 || day > DAILY_COSTS.dailyClearCost.length) return null;
  return DAILY_COSTS.dailyClearCost[day - 1];
}
function computeWarning(state, thresholds = WARNING_THRESHOLDS) {
  if (state.status !== "running") return null;
  const cost = state.dayExploreCost;
  if (cost <= 0) return null;
  if (state.tiles.some((t) => t.type === BELL_TOWER_TYPE)) return null;
  const unknownTiles = state.tiles.filter((t) => t.type === null).length;
  if (unknownTiles === 0) return null;
  const worstCost = unknownTiles * cost;
  const sanity = state.attrs.sanity;
  if (worstCost >= thresholds.redRatio * sanity) {
    return { level: "red", worstTiles: unknownTiles, worstCost, advice: "Sanity may run out: eat recovery Food or visit a Sanatorium first" };
  }
  if (worstCost >= thresholds.yellowRatio * sanity) {
    return { level: "yellow", worstTiles: unknownTiles, worstCost, advice: "Sanity is tight: mind your recovery options and detour costs" };
  }
  return null;
}
const TILE_NAMES = tileNameData.tiles;
const FREE_CLEAR_FOODS = ["Fragrant Cat Food", "Super Concentrated Sour Soup", "Secret Recipe Canned Meat"];
function neighbors(index) {
  const row = Math.floor(index / 5);
  const col = index % 5;
  const out = [];
  if (row > 0) out.push(index - 5);
  if (row < 4) out.push(index + 5);
  if (col > 0) out.push(index - 1);
  if (col < 4) out.push(index + 1);
  return out;
}
function tileName(tile) {
  return tile.tileId !== null ? TILE_NAMES[String(tile.tileId)] ?? null : null;
}
function bfsReachable(tiles2, from, to, unblockStoneIdx) {
  const unblocked = new Set(unblockStoneIdx === null ? [] : neighbors(unblockStoneIdx));
  const visited = /* @__PURE__ */ new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === to) return true;
    for (const nb of neighbors(cur)) {
      if (visited.has(nb)) continue;
      const tile = tiles2[nb];
      if (tile === void 0) continue;
      if (tile.blocked && !unblocked.has(nb)) continue;
      visited.add(nb);
      queue.push(nb);
    }
  }
  return false;
}
function computeReachability(state) {
  if (state.status !== "running") return null;
  const names = state.tiles.map(tileName);
  const benchIdx = names.findIndex((n) => n === "Bench");
  const towerIdx = names.findIndex((n) => n === "Clock Tower");
  if (benchIdx < 0 || towerIdx < 0) return null;
  const freeClearFoods = FREE_CLEAR_FOODS.filter((name) => state.foods.some((f) => f.name === name && f.uses > 0));
  if (bfsReachable(state.tiles, benchIdx, towerIdx, null)) {
    return { reachable: true, clearPlan: null, freeClearFoods: [], advice: null };
  }
  const baseClear = lookupClearCost(state.day);
  let clearPlan = null;
  for (let i = 0; i < state.tiles.length; i++) {
    const name = names[i];
    if (name === null || name === void 0 || !name.startsWith("Stele")) continue;
    if (!bfsReachable(state.tiles, benchIdx, towerIdx, i)) continue;
    const doubled = name.includes("Anxiety");
    clearPlan = { index: i, name, cost: baseClear !== null ? doubled ? baseClear * 2 : baseClear : 0 };
    break;
  }
  const foodHint = freeClearFoods.length > 0 ? `; remove for free with: ${freeClearFoods.join("/")}` : "";
  const advice = clearPlan !== null ? `Clock Tower sealed off: remove ${clearPlan.name} (Cell ${clearPlan.index}, ${clearPlan.cost} Sanity) to reach it${foodHint}` : `Clock Tower walled in: one stele isn't enough, remove several or change route${foodHint}`;
  return { reachable: false, clearPlan, freeClearFoods, advice };
}
function buildOwnedCount(b, state, relicsByName) {
  const upgraded = state.relics.filter((r) => r.level >= 1);
  if (b.kind === "count") {
    let n2 = 0;
    for (const r of upgraded) {
      const entry = relicsByName.get(r.name);
      if (entry !== void 0 && b.members.includes(entry.tier1 ?? "")) n2++;
    }
    return n2;
  }
  const owned = new Set(upgraded.map((r) => r.name));
  if (b.kind === "pair") {
    let n2 = 0;
    for (const p of b.pairs) {
      if (owned.has(p.base) && owned.has(p.partner)) n2++;
    }
    for (const w of b.wildcardPartners) {
      if (!owned.has(w)) continue;
      if (upgraded.some((r) => relicsByName.get(r.name)?.tier1 === b.wildcardBaseTag)) n2++;
    }
    return n2;
  }
  const anyOfNames = new Set(b.anyOf.flat());
  let n = 0;
  for (const m of b.members) {
    if (anyOfNames.has(m)) continue;
    if (owned.has(m)) n++;
  }
  for (const grp of b.anyOf) {
    if (grp.some((m) => owned.has(m))) n++;
  }
  return n;
}
function buildMissing(b, owned) {
  if (b.kind === "count") return [];
  const anyOfNames = new Set(b.anyOf.flat());
  const missing = b.members.filter((m) => !anyOfNames.has(m) && !owned.has(m));
  for (const grp of b.anyOf) {
    if (!grp.some((m) => owned.has(m))) missing.push(...grp.filter((m) => !owned.has(m)));
  }
  return missing;
}
function evaluateBuilds(state, catalog) {
  if (state.status === "idle") return null;
  const builds = catalog.synergy.builds;
  if (builds.length === 0) return null;
  const synIdx = buildSynergyIndexes(catalog.synergy);
  const owned = new Set(state.relics.filter((r) => r.level >= 1).map((r) => r.name));
  const groups = builds.map((b) => {
    const ownedN = buildOwnedCount(b, state, synIdx.relicsByName);
    const missing = buildMissing(b, owned);
    let status;
    if (b.minDay > state.day) status = "open";
    else if (ownedN >= b.target) status = "done";
    else if (b.target >= 2 && ownedN === b.target - 1) status = "near";
    else status = "open";
    return { id: b.id, label: b.label, owned: Math.min(ownedN, b.target), target: b.target, status, missing, note: b.note };
  }).sort((a, b) => {
    const ia = catalog.synergy.guide.groupPriority.indexOf(a.id);
    const ib = catalog.synergy.guide.groupPriority.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const byId = new Map(groups.map((g) => [g.id, g]));
  const buildById = new Map(builds.map((b) => [b.id, b]));
  const seg = catalog.synergy.guide.segments.find((s) => state.day >= s.fromDay && state.day <= s.toDay) ?? null;
  const orderIds = seg?.mode === "gap-fill" ? catalog.synergy.guide.groupPriority : (seg?.categories.map((c) => c.build).filter((id) => id !== null) ?? []).filter((id, i, arr) => arr.indexOf(id) === i);
  const priorityIds = orderIds.filter((id) => {
    const g = byId.get(id);
    return g !== void 0 && g.status !== "done";
  });
  let advice = null;
  for (const id of priorityIds) {
    const g = byId.get(id);
    if (g === void 0 || g.status === "done") continue;
    const b = buildById.get(id);
    const what = g.missing.length > 0 ? g.missing.join("/") : b?.members.join("/") ?? "";
    advice = g.status === "near" ? `${g.label} ${g.owned}/${g.target}, almost there: ${g.missing.join("/")}` : `${g.label} ${g.owned}/${g.target}, get ${what} first`;
    break;
  }
  const picks = [];
  const pushPick = (g) => {
    if (g !== void 0 && !picks.includes(g) && picks.length < 3) picks.push(g);
  };
  for (const id of priorityIds) pushPick(byId.get(id));
  for (const g of groups) {
    if (picks.length >= 3) break;
    if (g.status === "near") pushPick(g);
  }
  for (const g of groups) pushPick(g);
  const summary = picks.length > 0 ? picks.map((g) => `${g.label} ${g.owned}/${g.target}`).join(" · ") : null;
  return { groups, priorityIds, advice, summary };
}
function computeBudget(state, policy = {}, catalog) {
  if (state.status === "idle") {
    return { dayExploreCost: null, tilesLeft: null, dayClearCost: null, clearHint: null, warning: null, reachability: null, detour: null, bufferHint: null, builds: null };
  }
  const cost = state.dayExploreCost;
  const tilesLeft = cost > 0 ? Math.floor(state.attrs.sanity / cost) : null;
  const clearCost = lookupClearCost(state.day);
  const weights = policy.weights ?? VALUE_WEIGHTS;
  return {
    dayExploreCost: cost > 0 ? cost : null,
    tilesLeft,
    dayClearCost: clearCost,
    clearHint: clearCost === null ? null : `Stele removal today: ${clearCost} Sanity`,
    warning: computeWarning(state, policy.thresholds),
    reachability: computeReachability(state),
    detour: computeDetourRoi(state, weights),
    bufferHint: computeBufferReminder(state, weights),
    builds: catalog !== void 0 ? evaluateBuilds(state, catalog) : null
  };
}
function bfsDistance(tiles2, from, to) {
  const visited = /* @__PURE__ */ new Set([from]);
  const queue = [[from, 0]];
  while (queue.length > 0) {
    const [cur, d] = queue.shift();
    if (cur === to) return d;
    for (const nb of neighbors(cur)) {
      if (visited.has(nb)) continue;
      const tile = tiles2[nb];
      if (tile === void 0) continue;
      if (tile.blocked) continue;
      visited.add(nb);
      queue.push([nb, d + 1]);
    }
  }
  return null;
}
function computeDetourRoi(state, weights = VALUE_WEIGHTS) {
  if (state.status !== "running") return null;
  const cost = state.dayExploreCost;
  if (cost <= 0) return null;
  const names = state.tiles.map(tileName);
  const benchIdx = names.findIndex((n) => n === "Bench");
  const towerIdx = names.findIndex((n) => n === "Clock Tower");
  if (benchIdx < 0 || towerIdx < 0) return null;
  const direct = bfsDistance(state.tiles, benchIdx, towerIdx);
  if (direct === null) return null;
  let best = null;
  for (let i = 0; i < state.tiles.length; i++) {
    const name = names[i];
    if (name !== "Sanatorium" && name !== "Bank") continue;
    if (state.tiles[i]?.explored === true) continue;
    const toTarget = bfsDistance(state.tiles, benchIdx, i);
    const toTower = bfsDistance(state.tiles, i, towerIdx);
    if (toTarget === null || toTower === null) continue;
    const extra = toTarget + toTower - direct;
    const restore = name === "Sanatorium" ? weights.detourRoi.sanatoriumRest : Math.round(weights.detourRoi.bankGold * weights.situational.goldToSanity);
    const detourCost = extra * cost;
    const netGain = restore - detourCost;
    if (netGain <= 0) continue;
    const advice = extra === 0 ? `${name} on the way, no detour: about ${restore} Sanity for free` : `Detour ${extra} Cells to the ${name} (costs ${detourCost}): about ${netGain} Sanity net, worth taking`;
    if (best === null || netGain > best.netGain) {
      best = { index: i, name, extraTiles: extra, detourCost, netGain, advice };
    }
  }
  return best;
}
function computeBufferReminder(state, weights = VALUE_WEIGHTS) {
  if (state.status !== "running") return null;
  if (state.day % 2 === 0) return null;
  const towerIdx = state.tiles.findIndex((t) => t.type === BELL_TOWER_TYPE);
  if (towerIdx < 0) return null;
  if (state.tiles[towerIdx]?.explored === true) return null;
  const reserve = weights.buffer.reserveSanity;
  if (state.attrs.sanity >= reserve) return null;
  return `Odd day: keep ≥ ${reserve} Sanity before entering the Clock Tower (now ${state.attrs.sanity})`;
}
const VALUE_WEIGHTS = valueWeightsData;
function rankRelicsByGuide(state, catalog, synIdx) {
  const owned = new Set(state.relics.map((r) => r.name));
  const heldNames = /* @__PURE__ */ new Set([...owned, ...state.foods.filter((f) => f.uses > 0).map((f) => f.name)]);
  const guide = catalog.synergy.guide;
  const buildResult = evaluateBuilds(state, catalog);
  const progressById = buildResult !== null ? new Map(buildResult.groups.map((g) => [g.id, g])) : null;
  const buildIdOfName = /* @__PURE__ */ new Map();
  for (const b of catalog.synergy.builds) {
    for (const m of b.members) if (!buildIdOfName.has(m)) buildIdOfName.set(m, b.id);
    for (const grp of b.anyOf) for (const m of grp) if (!buildIdOfName.has(m)) buildIdOfName.set(m, b.id);
    for (const p of b.pairs) {
      if (!buildIdOfName.has(p.base)) buildIdOfName.set(p.base, b.id);
      if (!buildIdOfName.has(p.partner)) buildIdOfName.set(p.partner, b.id);
    }
    for (const w of b.wildcardPartners) if (!buildIdOfName.has(w)) buildIdOfName.set(w, b.id);
  }
  const out = [];
  const placed = /* @__PURE__ */ new Set();
  const push = (name, reason) => {
    if (placed.has(name)) return;
    placed.add(name);
    out.push({ name, kind: "relic", score: 5e3 - out.length, reason });
  };
  const pairHeldOf = (name) => {
    const fwd = synIdx.relicsByName.get(name)?.pairs.find((p) => heldNames.has(p.with));
    if (fwd !== void 0) return { partner: fwd.with, note: fwd.note };
    const rev = synIdx.reverseByTarget.get(name)?.find((ref) => heldNames.has(ref.name));
    if (rev !== void 0) return { partner: rev.name, note: rev.note };
    return null;
  };
  const doneNoteOf = (name) => {
    const bId = buildIdOfName.get(name);
    if (bId === void 0) return null;
    const p = progressById?.get(bId);
    if (p === void 0 || p.status !== "done") return null;
    return `${p.label} done (${p.owned}/${p.target}): fine to take more, no longer pushed up`;
  };
  const seg = guide.segments.find((s) => state.day >= s.fromDay && state.day <= s.toDay) ?? null;
  const gapFill = seg === null || seg.mode === "gap-fill";
  if (gapFill) {
    for (const id of guide.groupPriority) {
      const b = catalog.synergy.builds.find((bb) => bb.id === id);
      if (b === void 0) continue;
      const p = progressById?.get(id);
      if (p === void 0 || p.status === "done") continue;
      const memberNames = [...b.members, ...b.anyOf.flat(), ...b.pairs.flatMap((pp) => [pp.base, pp.partner]), ...b.wildcardPartners];
      for (const n of memberNames) {
        if (!placed.has(n) && owned.has(n) === false && synIdx.relicsByName.get(n)?.source !== "encounter") {
          push(n, `${seg !== null ? `${seg.label} · ` : ""}fills build: ${p.label} (${p.owned}/${p.target})`);
        }
      }
    }
  } else {
    const sunk = [];
    const cats = [...seg?.categories ?? []].sort((a, b) => a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1);
    for (const cat of cats) {
      const prioLabel = cat.priority === "high" ? "high priority" : "mid priority";
      const inCat = cat.items.filter((it) => owned.has(it.name) === false && placed.has(it.name) === false && synIdx.relicsByName.get(it.name)?.source !== "encounter").map((it, idx) => ({
        it,
        idx,
        pairHeld: pairHeldOf(it.name),
        done: doneNoteOf(it.name),
        must: synIdx.relicsByName.get(it.name)?.priority === "must"
      }));
      const active = inCat.filter((x) => x.done === null);
      for (const x of inCat) {
        if (x.done !== null) sunk.push({ name: x.it.name, reason: `${seg.label} · ${cat.label} (${prioLabel}); ${x.done}` });
      }
      const sorted = [...active].sort((a, b) => {
        const ka = { pair: a.pairHeld !== null ? 0 : 1, must: a.must ? 0 : 1, lowest: a.it.lowest === true ? 1 : 0, idx: a.idx };
        const kb = { pair: b.pairHeld !== null ? 0 : 1, must: b.must ? 0 : 1, lowest: b.it.lowest === true ? 1 : 0, idx: b.idx };
        return ka.pair - kb.pair || ka.must - kb.must || ka.lowest - kb.lowest || ka.idx - kb.idx;
      });
      for (const x of sorted) {
        let reason = `${seg.label} · ${cat.label} (${prioLabel})`;
        const bId = cat.build;
        if (bId !== null && buildIdOfName.get(x.it.name) === bId) {
          const p = progressById?.get(bId);
          if (p !== void 0 && p.status !== "done") reason += `; fills build: ${p.label} (${p.owned}/${p.target})`;
        }
        if (x.pairHeld !== null) reason += `; pairs with ${x.pairHeld.partner} (held): ${x.pairHeld.note}`;
        if (x.must) reason += "; must-pick";
        if (x.it.lowest === true) reason += "; unreliable, lowest priority";
        push(x.it.name, reason);
      }
    }
    for (const s of sunk) push(s.name, s.reason);
  }
  for (const r of catalog.relics) {
    if (placed.has(r.name) || owned.has(r.name)) continue;
    if (synIdx.relicsByName.get(r.name)?.source === "encounter") continue;
    push(r.name, "No build needs it yet");
  }
  return out;
}
function rankFoodsByTiming(state, catalog, weights, synIdx) {
  const s = weights.situational;
  const heldNames = /* @__PURE__ */ new Set([...state.relics.map((r) => r.name), ...state.foods.filter((f) => f.uses > 0).map((f) => f.name)]);
  const towerKnown = state.tiles.some((t) => t.type === BELL_TOWER_TYPE);
  const blockedCount = state.tiles.filter((t) => t.blocked).length;
  const ownedBoost = weights.synergy?.ownedBoost ?? 1;
  const synergyHitOf = (name, pairs) => {
    const fwd = pairs?.find((p) => heldNames.has(p.with));
    if (fwd !== void 0) return { partner: fwd.with, note: fwd.note };
    const rev = synIdx.reverseByTarget.get(name)?.find((ref) => heldNames.has(ref.name));
    if (rev !== void 0) return { partner: rev.name, note: rev.note };
    return null;
  };
  const out = [];
  for (const food of state.foods) {
    if (food.uses <= 0) continue;
    const conf = weights.foodKinds[food.name];
    const kind = conf?.kind ?? "preview";
    let score = weights.kindScores[kind] ?? 0;
    let reason = `Timing type ${kind}`;
    switch (kind) {
      case "restore":
        score = conf?.value ?? 0;
        reason = `Restores ${score} Sanity now`;
        break;
      case "gold":
        score = Math.round((conf?.value ?? 0) * s.goldToSanity);
        reason = `Coins now (worth ${score} Sanity)`;
        break;
      case "previewTower":
        score = Math.round(kindScoreOf(weights, kind) * (towerKnown ? s.towerKnownCut : s.towerUnknownBoost));
        reason = towerKnown ? "Previews the Clock Tower: already found, worth less" : "Previews the Clock Tower: not found yet, worth the most";
        break;
      case "clearStone":
        score = Math.round(kindScoreOf(weights, kind) * (blockedCount > 0 ? s.blockedBoost : s.noBlockedCut));
        reason = blockedCount > 0 ? `${blockedCount} sealed Cells: removing steles is worth a lot` : "No sealed Cells: removing steles is worth little";
        break;
      case "highCostDay":
        score = Math.round(kindScoreOf(weights, kind) * (state.day >= s.highCostDayFrom ? s.highCostDayBoost : s.lowCostDayCut));
        reason = state.day >= s.highCostDayFrom ? `Day ${state.day} is an expensive day: an explorable map is worth a lot` : "Cheap day: an explorable map is worth less";
        break;
    }
    const synFood = synIdx.foodsByName.get(food.name);
    const synHitF = synergyHitOf(food.name, synFood?.pairs);
    if (synHitF !== null) {
      score = Math.round(score * ownedBoost);
      reason += `; with ${synHitF.partner}: ${synHitF.note}`;
    }
    out.push({ name: food.name, kind: "food", score, reason });
  }
  return out.sort((a, b) => b.score - a.score);
}
function rankValueOptions(state, catalog, weights = VALUE_WEIGHTS) {
  if (state.status === "idle") return [];
  const synIdx = buildSynergyIndexes(catalog.synergy);
  return [...rankRelicsByGuide(state, catalog, synIdx), ...rankFoodsByTiming(state, catalog, weights, synIdx)];
}
function kindScoreOf(weights, kind) {
  return weights.kindScores[kind] ?? 0;
}
function familyOf(name) {
  const colon = name.indexOf(": ");
  if (colon > 0) return name.slice(0, colon);
  if (name.endsWith(" Black Goat's Horn")) return "Black Goat's Horn";
  if (name.endsWith(" Condiment")) return "Condiment";
  const dash = name.indexOf(" - ");
  if (dash > 0) return name.slice(0, dash);
  for (const prefix of ["Filth Eater's ", "Cartographer's "]) {
    if (name.startsWith(prefix)) return name.slice(0, prefix.length - 1);
  }
  return null;
}
function hasExplicitPair(candidateName, heldNames, synIdx) {
  const held = new Set(heldNames);
  if (synIdx.relicsByName.get(candidateName)?.pairs.some((p) => held.has(p.with)) === true) return true;
  return (synIdx.reverseByTarget.get(candidateName) ?? []).some((ref) => ref.kind === "relic" && held.has(ref.name));
}
function buildOfferRanking(state, catalog, kind, weights = VALUE_WEIGHTS) {
  if (state.status === "idle") return { kind, items: [], phaseStrategy: null, buildSummary: null };
  const seg = catalog.synergy.guide.segments.find((s) => state.day >= s.fromDay && state.day <= s.toDay) ?? null;
  const phaseStrategy = seg !== null ? `${seg.label}: ${seg.strategy}` : null;
  const synIdx = buildSynergyIndexes(catalog.synergy);
  const buildSummary = evaluateBuilds(state, catalog)?.summary ?? null;
  if (kind === "furnaceUpgrade") {
    const remaining = Math.max(1, weights.remainingDaysTotal + 1 - state.day);
    const costByName = new Map(catalog.relics.map((r) => [r.name, r.upgradeCost]));
    const items2 = state.relics.map((r) => {
      const daily = weights.relicDailyValue[r.name];
      const gain = (daily?.up ?? weights.unknownDailyValue) - (daily?.base ?? weights.unknownDailyValue);
      const cost = costByName.get(r.name) ?? null;
      return {
        name: r.name,
        kind: "relic",
        score: gain * remaining,
        reason: `Upgrade gain ${gain}/day × ${remaining} days left${cost !== null ? ` (cost ${cost})` : ""}`,
        familyNote: null,
        priority: synIdx.relicsByName.get(r.name)?.priority ?? null
      };
    }).sort((a, b) => b.score - a.score);
    return { kind, items: items2, phaseStrategy, buildSummary };
  }
  const ownedFamilyNames = /* @__PURE__ */ new Map();
  for (const r of state.relics) {
    const fam = familyOf(r.name);
    if (fam === null) continue;
    const held = ownedFamilyNames.get(fam);
    if (held === void 0) ownedFamilyNames.set(fam, [r.name]);
    else held.push(r.name);
  }
  const items = rankValueOptions(state, catalog, weights).map((opt) => {
    const priority = synIdx.relicsByName.get(opt.name)?.priority ?? null;
    if (opt.kind !== "relic") return { ...opt, familyNote: null, priority };
    const fam = familyOf(opt.name);
    const held = fam !== null ? ownedFamilyNames.get(fam) : void 0;
    if (fam === null || held === void 0) return { ...opt, familyNote: null, priority };
    if (hasExplicitPair(opt.name, held, synIdx)) return { ...opt, familyNote: null, priority };
    return { ...opt, familyNote: `Already holding ${held[0]} (same kind)`, priority };
  }).sort((a, b) => b.score - a.score);
  const filtered = items.filter((it) => {
    if (kind === "relic") return it.kind === "relic";
    if (kind === "food") return it.kind === "food";
    return true;
  });
  return { kind, items: filtered, phaseStrategy, buildSummary };
}
const EMPTY_CATALOG = { relics: [], foods: [], dailyExploreCost: [], dailyClearCost: [], synergy: emptySynergy() };
function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function loadCatalog(resourceDir) {
  const warnings = [];
  let raw;
  try {
    raw = node_fs.readFileSync(node_path.join(resourceDir, "catalog.json"), "utf8");
  } catch (err) {
    return { catalog: null, warnings: [`Couldn't read catalog.json: ${String(err)}`] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { catalog: null, warnings: [`Couldn't parse catalog.json: ${String(err)}`] };
  }
  const data = parsed;
  if (!Array.isArray(data.relics) || !Array.isArray(data.foods)) {
    return { catalog: null, warnings: ["catalog.json is malformed: relics/foods missing or not arrays"] };
  }
  const relics = [];
  for (const r of data.relics) {
    if (typeof r.name !== "string" || r.name === "" || typeof r.effect !== "string") {
      warnings.push(`Old Stuff entry without name/effect, removed: ${JSON.stringify(r).slice(0, 60)}`);
      continue;
    }
    if (r.id !== void 0 && r.id !== null && !isFiniteNumber(r.id)) warnings.push(`Old Stuff ${r.name}: id is not a number, treated as null`);
    relics.push({
      id: isFiniteNumber(r.id) ? r.id : null,
      name: r.name,
      effect: r.effect,
      upgradeEffect: typeof r.upgradeEffect === "string" ? r.upgradeEffect : null,
      upgradeCost: isFiniteNumber(r.upgradeCost) ? r.upgradeCost : null,
      note: typeof r.note === "string" ? r.note : void 0
    });
  }
  const foods = [];
  for (const f of data.foods) {
    if (typeof f.name !== "string" || f.name === "" || typeof f.effect !== "string") {
      warnings.push(`Food entry without name/effect, removed: ${JSON.stringify(f).slice(0, 60)}`);
      continue;
    }
    if (f.id !== void 0 && f.id !== null && !isFiniteNumber(f.id)) warnings.push(`Food ${f.name}: id is not a number, treated as null`);
    foods.push({
      id: isFiniteNumber(f.id) ? f.id : null,
      name: f.name,
      effect: f.effect,
      initialUses: isFiniteNumber(f.initialUses) ? f.initialUses : null,
      note: typeof f.note === "string" ? f.note : void 0
    });
  }
  const costsOk = Array.isArray(data.dailyExploreCost) && Array.isArray(data.dailyClearCost) && data.dailyExploreCost.length === 15 && data.dailyClearCost.length === 15 && data.dailyExploreCost.every(isFiniteNumber) && data.dailyClearCost.every(isFiniteNumber);
  if (!costsOk) {
    warnings.push("catalog.json cost tables are missing, not 15 long, or not all numbers; the advisor falls back to rules/daily-costs.json");
    return { catalog: null, warnings };
  }
  const dup = (arr) => {
    const seen = /* @__PURE__ */ new Set();
    for (const item of arr) {
      if (seen.has(item.name)) warnings.push(`Duplicate catalog entry: ${item.name}`);
      seen.add(item.name);
    }
  };
  dup(relics);
  dup(foods);
  const knownNames = /* @__PURE__ */ new Set([...relics.map((r) => r.name), ...foods.map((f) => f.name)]);
  const synLoaded = loadSynergy(resourceDir);
  warnings.push(...synLoaded.warnings);
  const synResolved = resolveSynergyEntries(synLoaded.synergy, knownNames);
  warnings.push(...synResolved.warnings);
  return {
    catalog: {
      relics,
      foods,
      dailyExploreCost: data.dailyExploreCost,
      dailyClearCost: data.dailyClearCost,
      synergy: synResolved.synergy
    },
    warnings
  };
}
function buildNameIndex(catalog) {
  return {
    relicsByName: new Map(catalog.relics.map((r) => [r.name, r])),
    foodsByName: new Map(catalog.foods.map((f) => [f.name, f]))
  };
}
function emptyCatalog() {
  return { ...EMPTY_CATALOG, relics: [], foods: [], dailyExploreCost: [], dailyClearCost: [], synergy: emptySynergy() };
}
class GainCardTracker {
  prevFoods = null;
  prevRelicLevels = null;
  heldRelics = /* @__PURE__ */ new Set();
  heldFoods = /* @__PURE__ */ new Set();
  card = null;
  index;
  synIdx;
  constructor(catalog) {
    this.index = buildNameIndex(catalog);
    this.synIdx = buildSynergyIndexes(catalog.synergy);
  }
  get current() {
    return this.card;
  }
  reset() {
    this.prevFoods = null;
    this.prevRelicLevels = null;
    this.heldRelics.clear();
    this.heldFoods.clear();
    this.card = null;
  }
  synergyLinesOf(name) {
    const entry = this.synIdx.relicsByName.get(name) ?? this.synIdx.foodsByName.get(name);
    const isHeld = (partner) => this.heldRelics.has(partner) || this.heldFoods.has(partner);
    const lines = [];
    const seen = /* @__PURE__ */ new Set([name]);
    for (const p of entry?.pairs ?? []) {
      if (seen.has(p.with)) continue;
      seen.add(p.with);
      lines.push({ partner: p.with, note: p.note, held: isHeld(p.with) });
    }
    for (const ref of this.synIdx.reverseByTarget.get(name) ?? []) {
      if (seen.has(ref.name)) continue;
      seen.add(ref.name);
      lines.push({ partner: ref.name, note: ref.note, held: isHeld(ref.name) });
    }
    lines.sort((a, b) => a.held === b.held ? 0 : a.held ? -1 : 1);
    return lines.slice(0, 2).map((l) => `Pairs with ${l.partner}${l.held ? " (held)" : ""}: ${l.note}`);
  }
  apply(event) {
    const unknown = (name) => `Not in the catalog: ${name}`;
    if (event.type === "RunStart") {
      this.reset();
      return;
    }
    if (event.type === "RelicGained") {
      this.heldRelics.add(event.name);
      const entry = this.index.relicsByName.get(event.name);
      this.card = {
        at: event.at,
        kind: "relic",
        name: event.name,
        effect: entry?.effect ?? unknown(event.name),
        upgradeEffect: entry?.upgradeEffect ?? null,
        upgradeCost: entry?.upgradeCost ?? null,
        initialUses: null,
        upgraded: false,
        synergyLines: this.synergyLinesOf(event.name)
      };
      return;
    }
    if (event.type === "RelicBagUpdated") {
      const prev = this.prevRelicLevels;
      this.prevRelicLevels = new Map(event.relics.map((r) => [r.name, r.level]));
      this.heldRelics = new Set(event.relics.map((r) => r.name));
      if (prev === null) return;
      for (const r of event.relics) {
        const before = prev.get(r.name);
        if (before !== void 0 && r.level > before) {
          const entry = this.index.relicsByName.get(r.name);
          this.card = {
            at: event.at,
            kind: "relic",
            name: r.name,
            effect: entry?.upgradeEffect ?? entry?.effect ?? unknown(r.name),
            upgradeEffect: entry?.upgradeEffect ?? null,
            upgradeCost: entry?.upgradeCost ?? null,
            initialUses: null,
            upgraded: true,
            synergyLines: []
          };
          return;
        }
      }
      return;
    }
    if (event.type === "FoodBagUpdated") {
      const prev = this.prevFoods;
      this.prevFoods = new Map(event.foods.filter((f) => f.uses > 0).map((f) => [f.name, f.uses]));
      this.heldFoods = new Set(this.prevFoods.keys());
      if (prev === null) return;
      for (const f of event.foods) {
        if (f.uses <= 0) continue;
        const before = prev.get(f.name);
        if (before === void 0 || f.uses > before) {
          const entry = this.index.foodsByName.get(f.name);
          this.card = {
            at: event.at,
            kind: "food",
            name: f.name,
            effect: entry?.effect ?? unknown(f.name),
            upgradeEffect: null,
            upgradeCost: null,
            initialUses: entry?.initialUses ?? null,
            upgraded: false,
            synergyLines: this.synergyLinesOf(f.name)
          };
          return;
        }
      }
    }
  }
}
module.exports = { loadCatalog, buildNameIndex, buildSynergyIndexes, evaluateBuilds, buildOfferRanking, computeBudget, rankValueOptions, rankFoodsByTiming, familyOf, lookupClearCost, guaranteeOf, GainCardTracker, VALUE_WEIGHTS, WARNING_THRESHOLDS, TILE_NAMES, FREE_CLEAR_FOODS };
