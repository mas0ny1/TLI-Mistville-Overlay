# Mistville Overlay

A small card over Torchlight: Infinite that helps with Mistville. It follows the game's own log (`UE_game.log`) as you
play and shows:

- **what to take** at every Old Stuff pick, Mistville Trader, Alchemy Workshop and Food pick: a suggested order, with
  the reason for each, drops down as soon as you step on the Cell;
- **an advice line** when it matters: Sanity may run out, the Clock Tower is sealed off, keep Sanity for the odd-day
  fight, a detour worth taking;
- **the day's budget** (`~6 Cells left · Stele removal today: 10 Sanity`) and **today's tip** (what every board has
  today, and the Sanatoriums, Banks and steles you've used);
- **the day's board**: what each Cell is, where the Clock Tower can be, and what's still unused;
- **gain cards** for Old Stuff and Food you get or upgrade, **build progress**, **run history** and a **catalog**.

It only reads the log: no screen capture, no clicks, no administrator rights, and nothing is sent anywhere. The game
writes an unexplored Cell to the log without saying what it is, so the card never shows more than the game does.

- [Getting started](#getting-started)
- [The card](#the-card)
- [The main window](#the-main-window)
- [How the advice works](#how-the-advice-works)
- [The board](#the-board)
- [Runs and history](#runs-and-history)
- [Reading the log](#reading-the-log)
- [Your data](#your-data)
- [Code layout](#code-layout)
- [Checking it against a log](#checking-it-against-a-log)
- [Credits](#credits)

## Getting started

**You need** Windows, Node.js (the first start only, to install Electron, the program the overlay runs in), and the
game in windowed or borderless mode: nothing can show on top of exclusive full screen.

**Start it** by double-clicking `Start-Mistville-Overlay.bat`. Starting it again while it runs just shows the card.

**The log** is found by itself: the one you chose; else each Steam library that has the game; else the launcher's
folders (`C:\Program Files (x86)\Torchlight Infinite`, `C:\Program Files\Torchlight Infinite`). The newest wins. If
it can't find it, use *Choose UE_game.log…* in the tray menu. When the game restarts and writes a new log, the overlay
starts over on it.

**The card** shows while you're in Mistville and hides outside it. Drag it by its title bar; it remembers where you
put it. ▾ folds it down to the essentials. When a fight starts (the board closes: Advent of Folklores, the walk to
the Clock Tower) it folds up into its title bar, marked ⚔ COMBAT, and drops back down as it was when the next board
opens; ▸ peeks at the full card during a fight.

**The tray icon** (teal ring): click it to show or hide the card, double-click it to open the main window. Its menu:

| | |
|---|---|
| Open the main window | monitor, history, catalog and settings |
| Show the overlay (Ctrl+Alt+M) | show or hide the card |
| Click-through (Ctrl+Alt+Shift+M) | the mouse passes through the card to the game |
| Show outside Mistville too | keep the card up everywhere |
| Move back to the top right | if the card ends up off screen |
| Choose UE_game.log… / Find the log automatically | pick the log yourself, or go back to finding it |
| Open the overlay's own log | what it found, where it's reading, and any warnings |

Both hotkeys can be changed in the main window's Settings.

## The card

The title bar shows **Day, Sanity and Coins**, ⚙ (the settings panel), ▾ (fold) and ✕ (hide). Below it are three
tabs: **Live**, **History** and **Catalog**.

### Live, while you explore

From the top:

1. **The advice line**, yellow or red when there's something to act on (see [the advice line](#the-advice-line)).
   On days 1-5, while you hold none of the four Coin gain Old Stuff, a yellow **No Coin source yet** line under it
   names them (see [no Coin source yet](#no-coin-source-yet)).
2. **The day's budget**: about how many Cells your Sanity still pays for at today's cost, and what removing a stele
   costs today. **Today's tip**: the place every board has today, and the Sanatoriums, Banks and steles you've used.
3. **The day's places as counts**: `$ 2/3 · ✚ 3/3 · T 1 · ⚒ 1 · ★ 1/2 · ♨ 1/1`, found / expected, with an orange
   `•2` for ones revealed but not used yet (see [points of interest](#points-of-interest)). While any of a place is
   left on the floor, a bar under its count says so: **orange** when one is revealed but not used yet, **blue
   dashes** when some are still hidden (fewer found than every board has), half of each when both; no bar once
   there's nothing left. Once the Clock Tower is found, a "Before the Clock Tower" box lists anything still hidden or
   unused, and where. On the right, **the Sanity bar**: your Sanity out of Max Sanity, coloured by how full the next
   floor starts if you head for the Clock Tower now, with a white tick where to stop so it starts full (see
   [the Sanity bar](#the-sanity-bar)).
4. **The board**, 5×5, one coloured mark per place: `$` Bank, `✚` Sanatorium, `T` Trader, `⚒` Alchemy Workshop,
   `★` Old Stuff, `♨` Food, `◆` stele, `♜` Watch Tower, `▪` Ruins, `S` start, `C` Clock Tower, `?` where the Clock
   Tower could be, `✕` sealed. A place revealed but not used yet is outlined orange; previewed Cells are outlined
   blue. With *Route to the Clock Tower* on, numbered steps show the cheapest exploring order (see
   [the route](#the-route)).
5. **Your Food**, with how many uses each has left, and *Blocked (Anorexia)* while an Anorexia stele stops you
   eating.
6. While a pick, the Trader, an upgrade or a Food pick is open: **the suggested order** (see below).
7. With *Build progress while exploring* on (it is by default): each build as one row with its progress bar, the
   closest of the Preview, Omen and Food builds marked; click a row to drop down what it still needs. Then your Old
   Stuff (see [build groups](#build-groups)).

The game's own messages ("Obtained Old Stuff: Baby Bear") show at the bottom for 15 seconds.

### Live, at a pick, the Trader, an upgrade or a Food pick

When you step on an Old Stuff Cell, the Mistville Trader, an Alchemy Workshop or a Food Cell, or use a Food that
upgrades Old Stuff, the suggested order drops down under the board (the rest of the card stays as it is, and it shows
even when the card is folded):

- the title (*Old Stuff pick · suggested order*, *Trader · suggested order*, *Workshop upgrade · by gain*, *Food
  pick · suggested order*);
- today's strategy (for days 1–5, for example: *Early: Economy engine and Vendor Items first: look for Coin gain Old
  Stuff, always take Guild Medal - Old Stuff / Chief Trader's Statue; Sanity recovery next*);
- the build summary (`Vendor Items 0/2 · Economy engine 1/1 · Max Sanity pairs 0/1`);
- the top six, numbered, each with ⭐ **must-pick** or **recommended** where it applies and its reason (*Early ·
  Utility (high priority); fills build: Vendor Items (0/2); must-pick*). "Already holding … (same kind)" shows in
  orange instead of the reason;
- at an Old Stuff pick or the Trader, the ones **actually on offer** highlighted: *on offer*, or *in stock · 300* with
  the Trader's price (*bought* once you have). When none of the six is on offer, one more highlighted row below them,
  *Highest of what's on offer*, shows the best-placed of what is, numbered by its place in the whole order (*8*).
  This works from what the log lists at that Cell (the one the pick opened at, else the one you last clicked or used);
  if the log never lists it, nothing is highlighted.

It opens as soon as the log says (the interaction, or the screen itself, whichever comes first) and stays until you
get something (Old Stuff handed to you, or a bag listed: a pick, an upgrade), or a new day or run starts. Closing the
screen without taking anything leaves it up until then.

At the Trader it follows the stock while you're there: refreshing it shows the new stock, and buying something marks it
*bought* and moves the order on (what you now hold drops out), without leaving the Trader. Once you leave a Trader you
bought from, it goes; leave without buying and it stays up, as above. (The game writes the new stock in one go; the
card takes it as soon as the log pauses, within half a second, instead of waiting for your next click.)

How the order is made is in [how the advice works](#how-the-advice-works). It goes by the kind of offer, not by what
that Cell or Trader actually has. Mistville Intel, before day 1, gets no list; the Old Stuff it gave you is marked
*(Intel)* in your bag once the game lists it.

### Gain cards

For six seconds after you get or upgrade Old Stuff, or get Food: what it is (*Old Stuff*, *Food* ×uses or
*Upgraded*), what it does, what it pairs with (each pair on its own line, with what the pair does), and for Old
Stuff not yet upgraded, what the upgrade does and costs.

### History and Catalog

- **History:** every run, newest first: when it started, the furthest day, *cleared*, *failed* or *running*, and how
  long it took. Click a run for its review: the day you died on or reached, how many events and Sanity samples, Old
  Stuff gained, a Sanity chart, Sanity at the end of each day, Food left unused at the end, and every event in order.
- **Catalog:** every Old Stuff with its archetype, tags, effect, upgraded effect and cost, what it pairs with, and
  notes (click one for the details), and its ID (the catalog's, or the one seen in your bag); filters for all Old
  Stuff, *Without ID only* and *With ID only*. Then every Food, and the 15-day cost table.

### ⚙ Settings panel

- **Route to the Clock Tower** (off by default): numbered steps on the board.
- **Build progress while exploring** (on by default): each build with what it still needs, under the board.
- **Open the main window.**

### "The log format may have changed"

If a game update changes what the log says, the card may read it wrongly. When it looks that way, a red box at the top
of the card says so. See [when the game changes its log](#when-the-game-changes-its-log).

## The main window

Open it from the card's ⚙ panel, from the tray menu, or by double-clicking the tray icon. It uses the card's colours
and remembers its size and place. Four pages:

- **Monitor:** the log it's following (with *Show / Hide the card*, *Choose UE_game.log…* and *Find it
  automatically*); the run's numbers (day, Sanity / max, Coins, Food slots, explore cost today, Cells left, stele
  removal today, free Trader refreshes, whether you can eat, the advice line, *No Coin source yet*, and the Sanity bar
  with its details written out); build progress with each group's
  Old Stuff; today's visits (what's due today, Sanatoriums / Banks / steles used); the board as far as the game has
  shown it (each Cell's name, its cost to explore, sealed ✕, *Clock Tower?* where it could be); your Old Stuff and
  Food; the last 100 events, newest first; and the Mistville lines it didn't recognise.
- **History** and **Catalog:** the card's tabs, wider. The history table also shows when each run ended, and every Old
  Stuff's details are open.
- **Settings:** see [tuning it](#tuning-it).

## How the advice works

`advisor/` does all the ranking and scoring; the card only shows its answers.

### The suggested order: Old Stuff picks and the Trader

Each stage of a run has its categories, in order, each with its Old Stuff:

| Days | Category | Priority | Old Stuff | Build it fills |
|---|---|---|---|---|
| 1–5 | Coin gain | high | Banker's IOU, Cartographer's Purse, Filth Eater's Wages, Amulet: Poverty (unreliable, last) | Economy engine |
| | Utility | high | Guild Medal - Old Stuff, Chief Trader's Statue, Shopping List | Vendor Items |
| | Sanity recovery | mid | Doctor's Lantern, Beak Mask, Ms. Grumpy, Mr. Misfortune, Baby Bear, Special Protection Pass | |
| 6–10 | Max Sanity | high | Wriggling Money Jar, Cartographer's Medicine Bottle, Mr. Misfortune | Max Sanity pairs |
| | Preview | high | Cartographer's Quill, Cartographer's Purse, Cartographer's Medicine Bottle, Cartographer's Stool | Preview build |
| | Sanity recovery | mid | Watchful Purse, Special Protection Pass, Baby Bear, Cartographer's Stool | Stele healing |
| | Utility | mid | Alchemy Catalyst, Apprentice Alchemist's Gloves | Upgrade set |
| 11–15 | (filling gaps) | | the missing pieces of each unfinished build group, in this order: Economy engine, Max Sanity pairs, Vendor Items, Preview build, Stele healing, Upgrade set, Free stele removal, Map previews | |

Mr. Misfortune and Baby Bear in the days 1–5 Sanity recovery list are the overlay's own addition (`advisor/sync.js`
adds them each time it rebuilds the data): each gives Sanity back for every stele you remove (8 and 10 at Lv1), and
your runs remove about 3 steles a day in the early days. Without them they'd rank with nothing pushing them until
day 6.

The order is built like this:

- Old Stuff you already hold is never suggested, at any level, and neither is Old Stuff only Folklores give.
- Days 1–10: high-priority categories first, then mid. Within a category: first anything that pairs with Old Stuff or
  Food you hold (*pairs with X (held): …*), then must-picks, then the category's own order; Old Stuff marked
  unreliable goes last.
- When a build group is complete, its other pieces drop below the rest of today's list (*Economy engine done (1/1):
  fine to take more, no longer pushed up*).
- Days 11–15: the missing pieces of every unfinished group, group by group (*fills build: Preview build (2/4)*).
- Everything else comes after, as *No build needs it yet*.
- If you already hold one of the same kind (Maps, Amulets, Black Goat's Horns, Condiments, Guild Medals, Filth
  Eater's, Cartographer's) and they aren't a pair, the reason reads *Already holding X (same kind)*.
- ⭐ **Must-pick**: Guild Medal - Old Stuff and Chief Trader's Statue. **Recommended**: Shopping List and Scavenger's
  Pliers.

At the Trader the list is the same Old Stuff order; your own Food, scored as below, can only come after it.

### The Food pick: your Food by when to eat it

At a Food pick the list is the Food you hold, best to eat now first, by what kind of Food it is:

| Kind | Worth | For example |
|---|---|---|
| Restores Sanity | the Sanity it restores | Walnut Pudding (120), Dried Mistfish (60), Pig Liver Medicine Soup (40) |
| Gives Coins | the Coins × 0.5 | Golden Frog Eggs (120), Golden Worm Cheese (100), Golden Caviar (20) |
| Makes the board explorable | 70; × 1.5 from day 11 (the expensive days), × 0.5 before | Explorer's Meat & Rice, Grilled Raven Skewer |
| Previews the Clock Tower | 60; × 1.5 while it isn't found, × 0.5 once it is | Clock Tower Sleeping Candy, Fluorescent Moth Soup |
| Removes steles | 60; × 1.5 while any Cell is sealed, × 0.5 when none is | Fragrant Cat Food, Super Concentrated Sour Soup, Water of Blithe |
| Cheaper exploring | 50 | Tentacle Cream Soup, Spider Silk Noodles |
| Upgrades | 50 | Alchemy Potion Pickles, Alchemy Potion Cured Meat |
| Cheaper stele removal | 45 | Night Pudding |
| More Food | 40 | Rich Pork Pate, Layered Sandwich |
| Previews Cells (and any Food it doesn't know) | 40 | Firefly Sashimi, Trader's Sugar Cube, Banker's Chocolate Coin |

A Food whose partner you hold is worth 1.3 × as much.

### The Alchemy Workshop: upgrade gain

Your Old Stuff, top six, by what upgrading it adds a day (its value a day once upgraded, less its value a day now;
0 for Old Stuff without known values) × the days left in the run (16 − today, at least 1), with the upgrade cost:
*Upgrade gain 5/day × 13 days left (cost 300)*.

### Build groups

| Group | Done at | Old Stuff |
|---|---|---|
| Economy engine | 1 | Banker's IOU, Cartographer's Purse, Filth Eater's Wages, Amulet: Poverty |
| Max Sanity pairs | 1 pair | Cartographer's Purse + Cartographer's Medicine Bottle, Filth Eater's Wages + Mr. Misfortune, or Wriggling Money Jar with any Coin gain Old Stuff |
| Vendor Items | 2 | Guild Medal - Old Stuff, and Chief Trader's Statue or Shopping List |
| Preview build | 4 | Cartographer's Quill, Purse, Medicine Bottle and Stool |
| Stele healing | 1 | Baby Bear, Watchful Purse |
| Upgrade set | 2 | Alchemy Catalyst, Apprentice Alchemist's Gloves |
| Free stele removal | 2 | Anxious Black Goat's Horn, Amulet: Anxiety |
| Map previews | 7 | Map: Bank, Map: Sanatorium, Map: Alchemy Workshop, Map: Mistville Trader, Map: Unknown Old Stuff, Map: Bad Omen Stele - Anxiety, Burnt Map |

Only **upgraded** (Lv2) Old Stuff counts towards a group: the same Old Stuff at Lv1 doesn't, and shows as *needs
upgrade*. A group is *done*, *almost* (one short) or *not yet*. Each group has a small bar, one segment per piece it
needs: **green** counted (Lv2), **amber** an upgrade away (held at Lv1), **dark** missing. Every group starts as that
one row, to save space; click it to drop down what it still needs, as chips, and each of its Old Stuff (one group open
at a time; click again to close it):

- a **grey** chip for each piece to get (*Chief Trader's Statue* or *Shopping List* where either will do);
- an **amber** chip with ↑ for a piece you hold at Lv1: upgrade it;
- a chip with a **gold** edge for a Key piece, a **fainter gold** one for an Important piece (your builds);
- *any one:* before them when any of them will do (Economy engine, Stele healing);
- *a pair:* for Max Sanity pairs, each pair's pieces joined by +, and *with your Cartographer's Purse* when you have
  half of it.

Hovering a group gives the same as one line of text, without opening it.

Under the chips, each of the group's Old Stuff (*Not owned*, *Lv1 · needs upgrade*, *Lv2*) and the pairs it needs. The line
above the groups names the next one to work on for today's stage: *Vendor Items 0/2, get Guild Medal - Old
Stuff/Chief Trader's Statue/Shopping List first*, or *…, almost there: …*. The build summary shows up to three groups.

**Your builds.** Under the groups, two builds of the overlay's own (from the Mistville Toolkit guide), counted the same
way (Lv2 only) with the same bar and chips, Key pieces edged gold and Important ones a fainter gold. They only show
what you have; the suggested order doesn't use them. The guide's Map build is the Preview build above.

| Build | Core Old Stuff (Key first, then Important) |
|---|---|
| Omen build | Filth Eater's Wages (key), Mr. Misfortune (important), Filth Eater's Dinner (important), Baby Bear, Ms. Grumpy, Anxious Black Goat's Horn, Amulet: Anxiety |
| Food build | Delicious Condiment (key), Chief Trader's Statue (key), Guild Medal - Food (important), Healthy Condiment, Wriggling Money Jar, Gourmet's Knife and Fork, Watchful Purse |

**The closest build.** Of the Preview, Omen and Food builds, the one nearest to complete is marked *closest* (edged
blue): the one with the largest share of its pieces counted (Lv2), then, between equals, the largest share an upgrade
away. A finished build isn't marked; nothing is while none of the three has a piece, and builds tied at the top are
all marked.

### The advice line

One line at a time, the first that applies:

1. **Sanity warning.** The worst case is every Cell not yet revealed or previewed costing today's explore cost. At
   0.8 × your Sanity or more it's yellow (*Sanity is tight: mind your recovery options and detour costs*); at 1.0 × or
   more, red (*Sanity may run out: eat recovery Food or visit a Sanatorium first*). There's no warning once the
   Clock Tower is found. The game writes a new day's Sanity to the log only when you first act, so until then the
   Sanity warning and the odd-day reminder wait, and the budget line says *Sanity updates when you first act*. A new
   run starts from Sanity 120, Max Sanity 120, 200 Coins and 4 Food slots until the log says otherwise.
2. **The Clock Tower sealed off.** If steles wall the Clock Tower off from the start: which stele to remove, its
   Cell and its Sanity (Anxiety steles cost double), or that one isn't enough; and which of your Food removes a stele
   for free (Fragrant Cat Food, Super Concentrated Sour Soup, Secret Recipe Canned Meat).
3. **The odd-day reserve.** On odd days the Clock Tower is a fight: with the Clock Tower found but not yet entered and
   Sanity under 30, *Odd day: keep ≥ 30 Sanity before entering the Clock Tower (now 22)*.
4. **A detour worth taking.** With the start and the Clock Tower both known: a Sanatorium (20 Sanity) or Bank (80
   Coins, worth 40 Sanity) not used yet, when it's worth more than the extra Cells it costs to go by it: *Bank on the
   way, no detour: about 40 Sanity for free*, or *Detour 2 Cells to the Sanatorium (costs 12): about 8 Sanity net,
   worth taking*.

### No Coin source yet

On days 1-5 of a run, while you hold none of the Economy engine's four Coin gain Old Stuff at any level (Banker's
IOU, Cartographer's Purse, Filth Eater's Wages, Amulet: Poverty), a yellow line under the advice line says *No Coin
source yet · look for Banker's IOU, Cartographer's Purse, Filth Eater's Wages or Amulet: Poverty*. It goes once you
get one, even at Lv1 (the Economy engine group itself counts it only at Lv2), and from day 6. It's only a reminder:
the suggested order doesn't change.

### The day's budget and today's tip

- **Cells left**: your Sanity ÷ today's explore cost, rounded down. The explore cost is what the log says (after your
  Old Stuff); before it says, what the board shows.
- **Stele removal today**, by day: 10, 10, 10, 12, 14, 16, 20, 24, 30, 36, 42, 50, 60, 80, 100. (The explore cost by
  day, before Old Stuff: 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24, 30, 36, 42, 50.)
- **Today's tip**: even days always have a Mistville Trader, odd days from day 3 an Alchemy Workshop; then how many
  Sanatoriums, Banks and steles you've actually used today.

### The Sanity bar

Right of the day's counts: your Sanity out of Max Sanity, coloured by **how full the next floor starts if you head for
the Clock Tower now**. The white tick is where to stop exploring so it starts full; a lighter part after your Sanity is
the Sanity still waiting in Sanatoriums you've revealed and not used. Hover it for the numbers.

- **Green**, *26 spare*: the next floor starts full, and you can spend 26 more and still have it start full; *head
  out* when that's less than a Cell.
- **Amber**, *tmrw 96%*: it starts on 90% of Max Sanity or more (108 at Max 120).
- **Red**, *tmrw 88%*: it starts on less. The tooltip says how much more you'd need to start it full (*~14 more: a
  Sanatorium gives 20, or recovery Food*).
- **Day 15** has no next floor: green while you have enough to find the Clock Tower and keep the odd-day reserve (30),
  or a Cell if that's more; red (*12 under*) when you don't.
- **Striped**: the game writes a new day's Sanity only when you first act, so until then the bar shows what the day
  should start on (yesterday's end plus what a new day gives back) with a `~`.

**Heading out now, the next floor starts on** your Sanity, plus the Sanatoriums you've revealed and not used, less
what finding today's Clock Tower should still cost (the route's expected turns at today's cost, for this board;
nothing once it's found), plus what a new day gives back; at most Max Sanity. From the run history:

- **A new day gives back** 10 (for entering the Clock Tower) + 30% of Max Sanity, plus Fluffy Old Blanket (8% of Max
  Sanity, 16% upgraded) and Sleeping Spice (20), each rounded down, never above Max Sanity. At Max Sanity 120 that's
  46, so ending a day on **74** or more means the next floor starts full (the *full-heal line*). This predicts 38 of
  45 day changes in the history to within 1 Sanity; the misses are Old Stuff raising Max Sanity at the day change
  (Doctor's Lantern or Sleeping Spice upgraded, Wriggling Money Jar), which it doesn't count.
- **A Sanatorium** restores 20, 27 with Sanatorium Contract, 10 more with Special Protection Pass (20 upgraded). Only
  the ones you've revealed and not used count; hidden ones don't.

On the dearer days (from about day 5 at Max 120) finding the Clock Tower costs more than a new day gives back, so once
the board's route is known the bar can be amber or red even when you're full, until Sanatoriums make up the
difference.

### Tuning it

The main window's **Settings** page. Empty fields keep the defaults; *Save and apply* takes effect at once, on the card
too.

| Setting | Default | What it changes |
|---|---|---|
| Yellow / Red warning ratio | 0.8 / 1.0 | when the Sanity warning turns yellow or red (worst-case cost ÷ Sanity) |
| Odd-day Sanity reserve | 30 | the odd-day reminder |
| Sanatorium restores | 20 Sanity | the detour advice (a guess worth tuning from play) |
| Bank Coins | 80 | the detour advice (× 0.5 = Sanity) |
| Show / hide the card, Click-through | Ctrl+Alt+M, Ctrl+Alt+Shift+M | the hotkeys (Electron key names, e.g. `Alt+M`; it says so if one is taken) |
| Advanced | | all the value weights as JSON (`relicDailyValue`, `kindScores`, `situational`, `foodKinds`, `detourRoi`, `buffer`…) |

In *Advanced*, only what you give changes; everything else keeps its default. *Fill in the defaults* shows them all,
and *Restore defaults* clears every setting. The page also has the card's two switches.

## The board

### Points of interest

Every board in the mode played since run 2 (dungeons 1–8) had, as first revealed, **3 Banks and 3 Sanatoriums**;
day 1 also had **2 Old Stuff and 1 Food** and no Trader or Alchemy Workshop. Later days vary, so those are just
counted. The card shows each as found / expected (`$ 2/3`), and how many are revealed but not used yet: a used Bank,
Sanatorium, Old Stuff, Food, Watch Tower or Folklores turns into a Clearing, so one still showing its name hasn't
been used. More Banks can turn up during a day (under a stele, say): they show as `3/3 +1`.

### Where the Clock Tower can be

The Clock Tower is always at least 4 steps from the start, and only shows when you explore its own Cell. The board
marks every Cell it could still be in with `?`; sealed Cells stay possible.

### The route

With *Route to the Clock Tower* on, the board numbers the exploring order with the fewest expected turns until you
find the Clock Tower, with every Cell it could be in equally likely. Step 1 pulses; blue steps could be the Clock
Tower, grey ones are on the way, ✂ removes a stele. It's planned again every time the board changes: a revealed omen,
a removed stele, new Old Stuff.

- A Cell can be explored when a revealed Cell beside it (up, down, left, right) opens it. Every revealed Cell does,
  except Ruins. Explorer's Glasses (8 around, or everything at level 2) and Scavenger's Boots (Ruins) change that.
- Revealed steles seal the 4 Cells around them; Bad Omen Stele - Blindness seals all 8 (only 4 with Amulet:
  Blindness; at level 2 its 8 become explorable). The Clock Tower can be under a seal, so reaching a sealed Cell costs
  removing the stele, counted as its Sanity in explorations (10 Sanity ≈ 3 turns at 3 each). Baby Bear and Mr.
  Misfortune give Sanity back for removals, so with them the route removes steles more readily.
- Previewed Cells (Map Old Stuff, Burnt Map, Torn Map…): good ones on the way (Old Stuff, Sanatorium, Food, Bank,
  Watch Tower, Trader, Alchemy Workshop) pull the route through them; previewed steles, Tentacles and Ruins push it
  away. Cartographer's Stool and Medicine Bottle make previewed Cells cheaper. A previewed Clock Tower (Torn Map level
  2) turns the route into the cheapest path to it.
- When two routes cost the same, it takes the one that leaves more Cells open to explore, then the one nearer the
  middle, so one new stele can't wall it off. Over 1,000 random boards (`node test/simulate.js 1000`), re-planning
  after every reveal: 10.5 turns to the Clock Tower with that tie-break, 10.7 without, and 13% fewer stele removals.
  A planner that could see every stele would need 8.4; that gap is information the game doesn't give.
- When you reveal a stele, the route is planned again with its real removal cost: remove it or go round, whichever is
  cheaper. The log shows the cost of every Cell you can explore right now (always the same for all of them on a
  board, so it never hints at what's underneath), and a stele's removal cost only once it's revealed.

On every board in the logs it was checked against, its first step was one the game allows, and the plan made at the
start of each day reached the real Clock Tower in fewer turns than were taken (156 against 198 over 17 days).

## Runs and history

A run starts when the log says day 1 after a map has loaded. It ends at whichever comes first:

- the day counter passing day 15: **cleared**;
- Sanity at 0: **failed**;
- the result screen, once you then leave Mistville or start another run: **failed** if Sanity was 0, else
  **cleared**. A new day after the result screen means it wasn't the end.

A run that never ends (you quit) stays *running* in History. If the game restarts during a run, its new log starts
mid-run; the rest of the run is kept as a run of its own from that day, and still ends as above. Each run is named by
the log time it started at, so reading the same log again (the overlay reads the whole log each time it starts)
rewrites the same run instead of adding a copy.

**What each run keeps**, for the History tab now and for analysing runs later:

- how it started: the dungeon, and Mistville Intel (bought or skipped, and the Old Stuff it gave);
- every day, every change to Sanity, Max Sanity, Coins, Food slots, Food use and free Trader refreshes, and every
  change to the explore cost (before and after Old Stuff);
- the board each time it changes: every Cell's kind, name, explored / previewed / sealed / reachable, done, and cost;
- every Cell clicked, explored, used (with its name: *Sanatorium*, *Bank*, a stele…) or gone;
- every pick, Trader, upgrade and Food pick: when it opened, the six suggestions it opened with, and what it had (the
  Old Stuff and Food, named, with the Trader's prices and what you bought); what you got, and both bags each time
  they change;
- every Food eaten (by name), Folklore event and choice, and the game's own messages;
- the board closing and opening, with your Sanity at each: the fights in between (Advent of Folklores, the odd-day
  Clock Tower);
- how it ended;
- a copy of its Mistville log lines (compressed), from the map load before it, so it can be read again later by a
  better parser, or for questions nobody has thought of yet.

**Older logs.** When the game starts it renames the last session's log to `UE_game-backup-<date>.log`. The overlay
reads each of those once, in the background, so runs played while it wasn't running are kept too, as long as the
game still has the file.

## Reading the log

The lines it uses (S6 = this season, WuDu = Mistville):

| Log | Meaning |
|---|---|
| `LoadMap: …/Maps/WuDuYiZhi02/…` | a Mistville map |
| `当前层数:3` | day 3 (day 1 starts a new run) |
| `属性名:1.理智 变化值:71` / `属性名:3.金币 变化值:231` | Sanity / Coins now (also Max Sanity, Food slots, Food use, free Trader refreshes) |
| `探索理智修正结果:6` / `基础探索理智消耗:5` | today's explore cost, after / before Old Stuff |
| `遗物背包变化:` + `遗物序号:0等级:1 遗物名:Baby Bear 遗物ID66` | the whole Old Stuff bag |
| `道具背包变化:` + `道具序号:0 剩余使用次数:1 道具名:…` | the Food bag |
| `S6GamePlay uiindex = 1..25` + its trees | every Cell: name, type, explored, previewed, sealed, reachable, cost; an Old Stuff Cell's or Trader's offer |
| `S6Maze Run` / `S6Maze Destory` | the board opens / closes |
| `S6GMMgr:PushLog AreaDoInteraction` + `选择遗物` · `商店` · `熔炉遗物升级` · `选择道具` · `道具功能：遗物升级` | an Old Stuff pick, the Trader, an Alchemy Workshop upgrade, a Food pick, a Food that upgrades Old Stuff (the suggestions open) |
| `S6ChooseRelic` · `S6Shop` · `S6Furnace` · `S6ChooseItem` · `S6PrepareExplore` `Run` / `Destory` | an Old Stuff pick, the Trader, the Alchemy Workshop, a Food pick or Mistville Intel opens / closes |
| `新增遗物:` + `遗物名:Baby Bear 遗物ID66` | Old Stuff handed to you |
| `交互地块 12` · `探索地块 12` · `使用道具 0` · `遇到遭遇 ID = 5` | what you did (today's tip, the run's events) |
| `MsgMgr@:Show MsgValue = …` | the game's own message |
| `属性名:1000.… 变化值:16` / Sanity 0 | the run is cleared / failed |
| `OpenView S6Result` | the result screen |

**Offers.** What's on offer is read too (each Old Stuff Cell's choices; the Trader's Old Stuff and Food, prices and
what's been bought) and named by `offers.js`: it highlights the suggestions actually on offer, and the run history
keeps it. The order itself goes by the kind of offer, not by what's on it. The log names offered
Old Stuff and Food only by ID: all 71 Old Stuff IDs are built in (`oldstuff.js`, checked against the 43 seen in the
logs) and 32 Food (`foods.js`). Anything new is learned from your bag and kept (see [your data](#your-data)); copy new
finds into those two files now and then to keep them.

### When the game changes its log

A game update can change what the log says, and then the overlay reads it wrongly. It watches for that and warns:
**"The log format may have changed"**, in red at the top of the card and of the Monitor page, which also lists the
last 20 lines it didn't recognise, newest first; its own log notes it too. It warns while you're in Mistville or in a
run, when either:

- at least 5% of Mistville's lines aren't recognised, once there are 500. Counted while in Mistville: every
  `[Game] S6…` line (Mistville's own systems) and the lines of its log blocks and board dumps. The game's other debug
  lines (music, fights, town) change from patch to patch, so counting them would warn with nothing wrong; or
- the board has opened 3 times and no day, Sanity or board line was read: the lines the overlay relies on most have
  changed. (Without a day line no run starts, so this one doesn't wait for a run.)

Until the overlay is updated, what the card shows may be wrong. `node test/check-log.js "<UE_game.log>"` says whether a
log would set it off and lists the lines it didn't recognise: run it once on a recent log to make sure it stays quiet
when nothing has changed.

## Your data

Everything is kept in `%APPDATA%\Mistville Overlay`:

| File | What's in it |
|---|---|
| `settings.json` | the card's place, shown / hidden, click-through, folded, the two switches, the strategy settings, your hotkeys, the main window's size and place, and the log you chose |
| `learned-ids.json` | Old Stuff and Food IDs learned from your bag |
| `history\index.json`, `history\events\<run>.json` | each run's summary and its events |
| `history\raw\<run>.log.gz` | each run's copy of its Mistville log lines (a plain `.log` while it's being read) |
| `history\imported.json` | the older logs already read into the history |
| `overlay.log` | what it found, where it's reading, and any warnings |

## Code layout

| | |
|---|---|
| `main.js` | finds and follows the log; runs the card, the main window, the tray icon and the hotkeys; keeps the settings |
| `parser.js` | turns the log into the game state and events; the log-format check |
| `view.js` | everything the card shows, from the parser's state |
| `advisor/` | the advice: `engine.js` (all the ranking and scoring), `adapt.js` (feeds it the parser's state), `catalog.json` and `synergy.json` (its data), `sync.js` (rebuilds the folder from its source, with the overlay's names and its one change to the early order) |
| `route.js` | the route to the Clock Tower |
| `sanity.js` | the Sanity bar: a new day's recovery, Sanatoriums still to use, how full the next floor starts |
| `history.js` | the run history |
| `backups.js` | reads the game's older logs into the run history |
| `offers.js` | names what's on offer (for the highlights and the run history) |
| `builds.js` | the overlay's own builds (Omen, Food: Key and Important pieces), and the builds compared for *closest* |
| `oldstuff.js`, `foods.js` | Old Stuff and Food IDs |
| `overlay/` | `overlay.html` / `overlay.js` the card, `window.html` / `window.js` the main window, `panels.js` and `common.css` what they share, `preload.js` their link to `main.js` |
| `test/` | the checks below; `client-lines.json` is a sample of a real client's other debug lines |

## Checking it against a log

- `node test/check-log.js "<UE_game.log>"`: what the card would know each day (build progress and advice), the runs
  History would record, the 4-step rule on every board where the Clock Tower was found, and whether the log-format
  warning would show (with the lines it didn't recognise).
- `node test/check-picks.js "<UE_game.log>"`: every time the suggestions open, what the log says was on offer, the
  suggested order, and what you took.
- `node test/check-ids.js "<UE_game.log>"`: every Old Stuff and Food name and ID in the log against `oldstuff.js`,
  `foods.js` and the advisor's catalog; lists anything that doesn't match, for you to review (it changes nothing).
- `node test/check-route.js "<UE_game.log>"`: the route on every board in the log.
- `node test/check-advisor.js [<path to the source checkout>]`, without a log: `advisor/` is in step with its source,
  its catalog loads, events reach the history and gain cards, the result screen ends runs as above, the suggestions
  open and close as above, the card's suggestions are the advisor's top six in its order (what's on offer
  highlighted), one changed Settings field takes effect, the log-format warning stays quiet on a normal log and shows
  when Mistville's lines change, a new day doesn't warn from yesterday's Sanity, each run keeps everything listed in
  [runs and history](#runs-and-history) (its log copy parses back to the same run), older logs are read in once each,
  and no code file names the advisor's source.
- `node test/simulate.js [boards]`: the route planners on random boards.

## Credits

The advisor's rules and data (`advisor/`) come from FogLight (雾灯) 1.0.0 by sunchuqi, through its English build. It
has no licence (© 2026 sunchuqi, marked private): `advisor/` is for personal use only, isn't covered by this folder's
MIT licence, and the overlay shouldn't be shared with it.
