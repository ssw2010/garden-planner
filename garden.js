#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'garden.json');

// ─── Companion Planting Database ─────────────────────────────────────────────
// Relationships are checked bidirectionally at runtime, so each entry only
// needs to list the plants it "knows about" — no strict symmetry required.

const COMPANION_DB = {
  'Tomato':    { companions: ['Basil', 'Carrot', 'Parsley', 'Garlic', 'Onion', 'Mint'],  enemies: ['Fennel', 'Dill'] },
  'Basil':     { companions: ['Tomato', 'Pepper', 'Oregano'],                              enemies: ['Sage', 'Fennel'] },
  'Carrot':    { companions: ['Tomato', 'Lettuce', 'Onion', 'Sage', 'Pea', 'Rosemary', 'Garlic'],  enemies: ['Dill', 'Fennel'] },
  'Lettuce':   { companions: ['Carrot', 'Radish', 'Garlic', 'Onion', 'Spinach'],          enemies: ['Fennel', 'Parsley'] },
  'Pepper':    { companions: ['Basil', 'Tomato', 'Carrot', 'Spinach'],                    enemies: ['Fennel'] },
  'Cucumber':  { companions: ['Beans', 'Pea', 'Radish', 'Lettuce', 'Dill'],               enemies: ['Sage', 'Rosemary', 'Fennel'] },
  'Beans':     { companions: ['Carrot', 'Cucumber', 'Pea', 'Radish', 'Squash', 'Rosemary', 'Mint'],  enemies: ['Onion', 'Garlic', 'Fennel'] },
  'Pea':       { companions: ['Beans', 'Carrot', 'Cucumber', 'Radish', 'Spinach', 'Mint'],  enemies: ['Onion', 'Garlic', 'Fennel'] },
  'Spinach':   { companions: ['Pea', 'Beans', 'Pepper', 'Radish', 'Lettuce'],             enemies: ['Fennel'] },
  'Radish':    { companions: ['Pea', 'Lettuce', 'Cucumber', 'Squash', 'Spinach', 'Beans'],  enemies: [] },
  'Garlic':    { companions: ['Tomato', 'Carrot', 'Lettuce', 'Beet'],                     enemies: ['Pea', 'Beans', 'Sage', 'Parsley'] },
  'Onion':     { companions: ['Carrot', 'Lettuce', 'Tomato', 'Beet'],                     enemies: ['Pea', 'Beans', 'Sage'] },
  'Sage':      { companions: ['Carrot', 'Rosemary', 'Beans'],                             enemies: ['Cucumber', 'Onion', 'Garlic', 'Basil'] },
  'Dill':      { companions: ['Cucumber', 'Lettuce', 'Onion'],                            enemies: ['Tomato', 'Carrot', 'Fennel'] },
  'Parsley':   { companions: ['Tomato', 'Carrot'],                                         enemies: ['Lettuce', 'Garlic'] },
  'Rosemary':  { companions: ['Carrot', 'Beans', 'Sage'],                                  enemies: ['Cucumber'] },
  'Fennel':    { companions: [],                                                             enemies: ['Tomato', 'Basil', 'Carrot', 'Dill', 'Cucumber', 'Beans', 'Pea', 'Pepper', 'Spinach', 'Lettuce'] },
  'Squash':    { companions: ['Beans', 'Radish', 'Mint'],                                  enemies: ['Fennel', 'Potato'] },
  'Beet':      { companions: ['Garlic', 'Lettuce', 'Onion'],                               enemies: ['Beans'] },
  'Mint':      { companions: ['Pea', 'Beans', 'Squash', 'Tomato'],                         enemies: ['Parsley'] },
};

// ─── Companion Helpers ───────────────────────────────────────────────────────

function findDbEntry(name) {
  const key = Object.keys(COMPANION_DB).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? { key, info: COMPANION_DB[key] } : null;
}

function checkBedCompatibility(newName, bedPlants) {
  const companions = [];
  const enemies = [];
  const entry = findDbEntry(newName);

  for (const plant of bedPlants) {
    const bedEntry = findDbEntry(plant.name);

    const newListsCompanion = entry && entry.info.companions.some(c => c.toLowerCase() === plant.name.toLowerCase());
    const newListsEnemy = entry && entry.info.enemies.some(e => e.toLowerCase() === plant.name.toLowerCase());
    const bedListsCompanion = bedEntry && bedEntry.info.companions.some(c => c.toLowerCase() === newName.toLowerCase());
    const bedListsEnemy = bedEntry && bedEntry.info.enemies.some(e => e.toLowerCase() === newName.toLowerCase());

    if (newListsCompanion || bedListsCompanion) companions.push(plant.name);
    if (newListsEnemy || bedListsEnemy) enemies.push(plant.name);
  }

  return { companions, enemies };
}

function suggestCompanions(newName, bedPlants) {
  const entry = findDbEntry(newName);
  if (!entry) return [];

  const bedNames = bedPlants.map(p => p.name.toLowerCase());

  const fromEntry = entry.info.companions.filter(c => !bedNames.includes(c.toLowerCase()));

  const fromOthers = Object.entries(COMPANION_DB)
    .filter(([k, v]) =>
      k.toLowerCase() !== newName.toLowerCase() &&
      !bedNames.includes(k.toLowerCase()) &&
      !fromEntry.map(c => c.toLowerCase()).includes(k.toLowerCase()) &&
      v.companions.some(c => c.toLowerCase() === newName.toLowerCase())
    )
    .map(([k]) => k);

  return [...fromEntry, ...fromOthers].slice(0, 5);
}

// ─── Data Helpers ────────────────────────────────────────────────────────────

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { beds: {} };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ─── Commands ────────────────────────────────────────────────────────────────

function createBed(name, width, length) {
  if (!name || !width || !length) {
    console.error('❌  Usage: node garden.js create-bed "Bed Name" --width <m> --length <m>');
    process.exit(1);
  }

  const data = loadData();

  if (data.beds[name]) {
    console.error(`❌  A bed called "${name}" already exists.`);
    process.exit(1);
  }

  data.beds[name] = {
    width: parseFloat(width),
    length: parseFloat(length),
    plants: []
  };

  saveData(data);

  const area = (parseFloat(width) * parseFloat(length)).toFixed(1);
  console.log(`✅  Created "${name}" (${width}m x ${length}m = ${area}m²)`);
}

function addPlant(plantName, bedName, spacing, sun, water) {
  if (!plantName || !bedName || !spacing) {
    console.error('❌  Usage: node garden.js add-plant "Plant" --bed "Bed Name" --spacing <m> --sun <full|partial|shade> --water <low|medium|high>');
    process.exit(1);
  }

  const data = loadData();

  if (!data.beds[bedName]) {
    console.error(`❌  No bed called "${bedName}" found. Create it first with create-bed.`);
    process.exit(1);
  }

  const bed = data.beds[bedName];
  const spacingNum = parseFloat(spacing);
  const area = bed.width * bed.length;
  const plantArea = spacingNum * spacingNum;
  const maxPlants = Math.floor(area / plantArea);

  const usedArea = bed.plants.reduce((sum, p) => sum + (p.spacing * p.spacing), 0);
  const remainingArea = area - usedArea;

  if (plantArea > remainingArea) {
    console.warn(`⚠️   Not enough space in "${bedName}" for another ${plantName} (needs ${plantArea.toFixed(2)}m², only ${remainingArea.toFixed(2)}m² left).`);
    process.exit(1);
  }

  bed.plants.push({
    name: plantName,
    spacing: spacingNum,
    sun: sun || 'full',
    water: water || 'medium',
    addedDate: new Date().toISOString().split('T')[0]
  });

  saveData(data);

  console.log(`✅  Added ${plantName} to "${bedName}"`);
  console.log(`   Spacing: ${spacing}m | Sun: ${sun || 'full'} | Water: ${water || 'medium'}`);
  console.log(`   Max plants of this size in bed: ${maxPlants}`);
  console.log(`   Remaining space: ${(remainingArea - plantArea).toFixed(2)}m²`);

  // Companion planting report (check against plants already in the bed, excluding the one just added)
  const existingPlants = bed.plants.slice(0, -1);
  if (existingPlants.length > 0) {
    const { companions, enemies } = checkBedCompatibility(plantName, existingPlants);
    if (companions.length || enemies.length) {
      console.log('\n🌿  Companion check:');
      if (companions.length) console.log(`   ✓  Good neighbors in this bed: ${companions.join(', ')}`);
      if (enemies.length)   console.log(`   ✗  Conflicts in this bed:       ${enemies.join(', ')}`);
    }
  }
  const suggestions = suggestCompanions(plantName, bed.plants);
  if (suggestions.length) {
    console.log(`   💡 Consider adding: ${suggestions.join(', ')}`);
  }
}

function listBeds() {
  const data = loadData();
  const beds = Object.entries(data.beds);

  if (beds.length === 0) {
    console.log('🌱  No garden beds yet. Create one with: node garden.js create-bed "My Bed" --width 2 --length 3');
    return;
  }

  console.log('\n🌿  Your Garden Beds\n');
  console.log('─'.repeat(50));

  beds.forEach(([name, bed]) => {
    const area = (bed.width * bed.length).toFixed(1);
    const usedArea = bed.plants.reduce((sum, p) => sum + (p.spacing * p.spacing), 0);
    const freeArea = (area - usedArea).toFixed(2);
    const freePercent = Math.round((freeArea / area) * 100);

    console.log(`\n📦  ${name}`);
    console.log(`    Size: ${bed.width}m x ${bed.length}m = ${area}m²`);
    console.log(`    Plants: ${bed.plants.length}`);
    console.log(`    Free space: ${freeArea}m² (${freePercent}%)`);
  });

  console.log('\n' + '─'.repeat(50));
}

function listPlants(bedName) {
  const data = loadData();

  if (bedName) {
    // List plants in a specific bed
    if (!data.beds[bedName]) {
      console.error(`❌  No bed called "${bedName}" found.`);
      process.exit(1);
    }

    const bed = data.beds[bedName];
    const area = (bed.width * bed.length).toFixed(1);
    const usedArea = bed.plants.reduce((sum, p) => sum + (p.spacing * p.spacing), 0);
    const freeArea = (area - usedArea).toFixed(2);

    console.log(`\n🌿  ${bedName} (${bed.width}m x ${bed.length}m)\n`);
    console.log('─'.repeat(50));

    if (bed.plants.length === 0) {
      console.log('   No plants yet. Add one with: node garden.js add-plant "Tomato" --bed "' + bedName + '" --spacing 0.5');
    } else {
      bed.plants.forEach((plant, i) => {
        const plantArea = (plant.spacing * plant.spacing).toFixed(2);
        const isLast = i === bed.plants.length - 1;
        const prefix = isLast ? '└──' : '├──';
        console.log(`   ${prefix} ${plant.name}`);
        console.log(`       Spacing: ${plant.spacing}m | Sun: ${plant.sun} | Water: ${plant.water}`);
        console.log(`       Space used: ${plantArea}m² | Added: ${plant.addedDate}`);
      });

      console.log(`\n   Remaining space: ${freeArea}m²`);
    }

    console.log('─'.repeat(50) + '\n');

  } else {
    // List all plants across all beds
    const beds = Object.entries(data.beds);

    if (beds.length === 0) {
      console.log('🌱  No garden beds yet.');
      return;
    }

    console.log('\n🌿  All Plants\n');
    console.log('─'.repeat(50));

    beds.forEach(([name, bed]) => {
      console.log(`\n📦  ${name}:`);
      if (bed.plants.length === 0) {
        console.log('    (no plants)');
      } else {
        bed.plants.forEach(p => {
          console.log(`    • ${p.name} — spacing: ${p.spacing}m | sun: ${p.sun} | water: ${p.water}`);
        });
      }
    });

    console.log('\n' + '─'.repeat(50));
  }
}

function companionsCmd(plantName) {
  if (!plantName) {
    console.error('❌  Usage: node garden.js companions "Plant Name"');
    process.exit(1);
  }

  const entry = findDbEntry(plantName);
  if (!entry) {
    console.log(`ℹ️   "${plantName}" is not in the companion database.`);
    console.log(`   Known plants: ${Object.keys(COMPANION_DB).join(', ')}`);
    return;
  }

  const { key, info } = entry;
  console.log(`\n🌿  Companion info for ${key}`);
  console.log('─'.repeat(50));
  if (info.companions.length) {
    console.log(`   ✓  Good companions:    ${info.companions.join(', ')}`);
  } else {
    console.log(`   ✓  Good companions:    (none in database)`);
  }
  if (info.enemies.length) {
    console.log(`   ✗  Avoid planting near: ${info.enemies.join(', ')}`);
  } else {
    console.log(`   ✗  Avoid planting near: (none known)`);
  }

  // Also find plants that name this one in their own lists
  const alsoCompanionOf = Object.entries(COMPANION_DB)
    .filter(([k, v]) => k !== key && v.companions.some(c => c.toLowerCase() === key.toLowerCase()))
    .map(([k]) => k);
  const alsoEnemyOf = Object.entries(COMPANION_DB)
    .filter(([k, v]) => k !== key && v.enemies.some(e => e.toLowerCase() === key.toLowerCase()))
    .map(([k]) => k);

  const extraCompanions = alsoCompanionOf.filter(p => !info.companions.map(c=>c.toLowerCase()).includes(p.toLowerCase()));
  const extraEnemies = alsoEnemyOf.filter(p => !info.enemies.map(e=>e.toLowerCase()).includes(p.toLowerCase()));

  if (extraCompanions.length) console.log(`   ✓  Also liked by:      ${extraCompanions.join(', ')}`);
  if (extraEnemies.length)    console.log(`   ✗  Also disliked by:   ${extraEnemies.join(', ')}`);

  console.log('─'.repeat(50) + '\n');
}

function checkBed(bedName) {
  if (!bedName) {
    console.error('❌  Usage: node garden.js check-bed "Bed Name"');
    process.exit(1);
  }

  const data = loadData();
  if (!data.beds[bedName]) {
    console.error(`❌  No bed called "${bedName}" found.`);
    process.exit(1);
  }

  const plants = data.beds[bedName].plants;
  if (plants.length < 2) {
    console.log(`ℹ️   "${bedName}" needs at least 2 plants for a compatibility check.`);
    return;
  }

  const goodPairs = [];
  const badPairs  = [];

  for (let i = 0; i < plants.length; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      const a = plants[i].name;
      const b = plants[j].name;
      const { companions, enemies } = checkBedCompatibility(a, [plants[j]]);
      if (companions.length) goodPairs.push(`${a} + ${b}`);
      if (enemies.length)    badPairs.push(`${a} + ${b}`);
    }
  }

  console.log(`\n🌿  Compatibility check for "${bedName}"\n`);
  console.log('─'.repeat(50));

  if (goodPairs.length) {
    console.log('   ✓  Good pairings:');
    goodPairs.forEach(p => console.log(`      • ${p}`));
  }
  if (badPairs.length) {
    console.log('   ✗  Conflicts:');
    badPairs.forEach(p => console.log(`      • ${p}`));
  }
  if (!goodPairs.length && !badPairs.length) {
    console.log('   ℹ️   No known companion or conflict relationships between these plants.');
  }

  console.log('─'.repeat(50) + '\n');
}

function showHelp() {
  console.log(`
🌱  Garden Planner CLI
${'─'.repeat(50)}

Commands:

  create-bed <name> --width <m> --length <m>
    Create a new garden bed

  add-plant <name> --bed <bed-name> --spacing <m> --sun <full|partial|shade> --water <low|medium|high>
    Add a plant to a bed (shows companion warnings automatically)

  list-beds
    Show all garden beds

  list-plants [bed-name]
    Show plants in a bed, or all plants if no bed given

  companions <plant-name>
    Show companion and enemy plants for a given plant

  check-bed <bed-name>
    Report all good pairings and conflicts among plants in a bed

  help
    Show this help message

Examples:

  node garden.js create-bed "Veggie Patch" --width 3 --length 4
  node garden.js add-plant "Tomato" --bed "Veggie Patch" --spacing 0.5 --sun full --water high
  node garden.js add-plant "Basil" --bed "Veggie Patch" --spacing 0.3 --sun full --water medium
  node garden.js list-beds
  node garden.js list-plants "Veggie Patch"
  node garden.js companions "Tomato"
  node garden.js check-bed "Veggie Patch"

${'─'.repeat(50)}
`);
}

// ─── Argument Parser ─────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = value;
    } else {
      positional.push(argv[i]);
    }
  }

  return { args, positional };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const [,, command, ...rest] = process.argv;
const { args, positional } = parseArgs(rest);

switch (command) {
  case 'create-bed':
    createBed(positional[0], args.width, args.length);
    break;

  case 'add-plant':
    addPlant(positional[0], args.bed, args.spacing, args.sun, args.water);
    break;

  case 'list-beds':
    listBeds();
    break;

  case 'list-plants':
    listPlants(positional[0]);
    break;

  case 'companions':
    companionsCmd(positional[0]);
    break;

  case 'check-bed':
    checkBed(positional[0]);
    break;

  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;

  default:
    console.error(`❌  Unknown command: "${command}"`);
    showHelp();
    process.exit(1);
}
