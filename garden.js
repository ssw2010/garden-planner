#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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

function mapCmd(bedName) {
  if (!bedName) {
    console.error('❌  Usage: node garden.js map "Bed Name"');
    process.exit(1);
  }

  const data = loadData();
  if (!data.beds[bedName]) {
    console.error(`❌  No bed called "${bedName}" found.`);
    process.exit(1);
  }

  const bed = data.beds[bedName];
  if (bed.plants.length === 0) {
    console.log(`ℹ️   "${bedName}" has no plants to map.`);
    return;
  }

  const SCALE = 120;       // px per metre
  const GRID_STEP = 0.5;   // metres between grid lines
  const PAD = { top: 30, right: 30, bottom: 50, left: 50 };

  const svgW = Math.round(bed.width * SCALE);
  const svgH = Math.round(bed.length * SCALE);

  const PALETTE = [
    '#e74c3c', '#e67e22', '#f39c12', '#27ae60', '#16a085',
    '#2980b9', '#8e44ad', '#e91e63', '#00bcd4', '#8bc34a',
    '#ff5722', '#607d8b', '#795548', '#ff9800', '#cddc39',
  ];

  const colorMap = {};
  bed.plants.forEach(p => {
    if (!colorMap[p.name]) colorMap[p.name] = PALETTE[Object.keys(colorMap).length % PALETTE.length];
  });

  // Greedy row-packing layout (left→right, top→bottom)
  const placements = [];
  let curX = 0, curY = 0, rowH = 0;
  for (const plant of bed.plants) {
    const d = plant.spacing, r = d / 2;
    if (curX > 0 && curX + d > bed.width) { curX = 0; curY += rowH; rowH = 0; }
    placements.push({ plant, cx: curX + r, cy: curY + r });
    curX += d;
    rowH = Math.max(rowH, d);
  }

  // Grid lines + axis labels
  let grid = '';
  for (let x = 0; x <= bed.width + 0.001; x += GRID_STEP) {
    const px = Math.round(x * SCALE);
    const onMetre = Math.abs(x - Math.round(x)) < 0.001;
    grid += `<line x1="${px}" y1="0" x2="${px}" y2="${svgH}" stroke="${onMetre ? '#c8c8c8' : '#e8e8e8'}" stroke-width="${onMetre ? 1.5 : 0.75}"/>`;
    if (onMetre) grid += `<text x="${px}" y="${svgH + 18}" text-anchor="middle" font-size="11" fill="#888">${Math.round(x)}m</text>`;
  }
  for (let y = 0; y <= bed.length + 0.001; y += GRID_STEP) {
    const py = Math.round(y * SCALE);
    const onMetre = Math.abs(y - Math.round(y)) < 0.001;
    grid += `<line x1="0" y1="${py}" x2="${svgW}" y2="${py}" stroke="${onMetre ? '#c8c8c8' : '#e8e8e8'}" stroke-width="${onMetre ? 1.5 : 0.75}"/>`;
    if (onMetre) grid += `<text x="-8" y="${py + 4}" text-anchor="end" font-size="11" fill="#888">${Math.round(y)}m</text>`;
  }

  // Companion / enemy lines between placed plants
  let lines = '';
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i], b = placements[j];
      const { companions, enemies } = checkBedCompatibility(a.plant.name, [b.plant]);
      const x1 = Math.round(a.cx * SCALE), y1 = Math.round(a.cy * SCALE);
      const x2 = Math.round(b.cx * SCALE), y2 = Math.round(b.cy * SCALE);
      if (companions.length)
        lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#27ae60" stroke-width="2" stroke-dasharray="5,3" opacity="0.7"/>`;
      else if (enemies.length)
        lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e74c3c" stroke-width="2" stroke-dasharray="5,3" opacity="0.7"/>`;
    }
  }

  // Plant circles + labels
  let circles = '';
  for (const { plant, cx, cy } of placements) {
    const px = Math.round(cx * SCALE), py = Math.round(cy * SCALE);
    const r  = Math.round((plant.spacing / 2) * SCALE);
    const col = colorMap[plant.name];
    const fs1 = Math.max(9,  Math.min(13, r * 0.45));
    const fs2 = Math.max(7,  Math.min(10, r * 0.30));
    const tip = `${plant.name} | spacing: ${plant.spacing}m | sun: ${plant.sun} | water: ${plant.water}`;

    if (r < 22) {
      // Small circle — label below
      circles += `<g><title>${tip}</title>
  <circle cx="${px}" cy="${py}" r="${r}" fill="${col}" fill-opacity="0.85" stroke="white" stroke-width="2"/>
  <text x="${px}" y="${py + r + 13}" text-anchor="middle" font-size="10" fill="#333">${plant.name}</text>
</g>`;
    } else {
      // Large enough — label inside
      circles += `<g><title>${tip}</title>
  <circle cx="${px}" cy="${py}" r="${r}" fill="${col}" fill-opacity="0.85" stroke="white" stroke-width="2"/>
  <text x="${px}" y="${py - 1}" text-anchor="middle" dominant-baseline="middle" font-size="${fs1}" fill="white" font-weight="600">${plant.name}</text>
  <text x="${px}" y="${py + fs1 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="${fs2}" fill="rgba(255,255,255,.85)">${plant.spacing}m</text>
</g>`;
    }
  }

  // Legend + key
  const legendItems = Object.entries(colorMap).map(([name, col]) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;margin-bottom:4px"><svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="${col}"/></svg>${name}</span>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${bedName} — Garden Map</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f0f4ec;min-height:100vh;padding:40px 32px}
  h1{font-size:1.7rem;color:#2d5016;margin-bottom:6px}
  .sub{color:#6b7a5e;font-size:.92rem;margin-bottom:28px}
  .card{background:#fff;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,.09);padding:32px;display:inline-block}
  svg text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .legend{margin-top:20px;font-size:.85rem;color:#444;display:flex;flex-wrap:wrap;align-items:center}
  .leg-title{font-weight:600;margin-right:12px;color:#333;flex-shrink:0}
  .key{margin-top:14px;font-size:.78rem;color:#999;display:flex;gap:20px;flex-wrap:wrap}
  .key span{display:flex;align-items:center;gap:6px}
</style>
</head>
<body>
<h1>🌿 ${bedName}</h1>
<p class="sub">${bed.width}m &times; ${bed.length}m &nbsp;&middot;&nbsp; ${bed.plants.length} plant${bed.plants.length !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; circle diameter = spacing</p>
<div class="card">
  <svg width="${svgW + PAD.left + PAD.right}" height="${svgH + PAD.top + PAD.bottom}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${PAD.left},${PAD.top})">
      <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#f2f9ea" stroke="#7aac3a" stroke-width="2" rx="4"/>
      ${grid}
      ${lines}
      ${circles}
    </g>
  </svg>
  <div class="legend"><span class="leg-title">Plants:</span>${legendItems}</div>
  <div class="key">
    <span><svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#27ae60" stroke-width="2" stroke-dasharray="5,3"/></svg>Good companions</span>
    <span><svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#e74c3c" stroke-width="2" stroke-dasharray="5,3"/></svg>Conflict</span>
  </div>
</div>
</body>
</html>`;

  const outPath = path.join(__dirname, `map-${bedName.replace(/[^a-z0-9]/gi, '-')}.html`);
  fs.writeFileSync(outPath, html);
  console.log(`🗺️   Map saved → ${outPath}`);

  const opener = process.platform === 'win32' ? `start "" "${outPath}"` :
                 process.platform === 'darwin' ? `open "${outPath}"` : `xdg-open "${outPath}"`;
  exec(opener, err => { if (err) console.warn('   (Could not auto-open — open the file manually)'); });
  console.log('🌐  Opening in browser…');
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

  map <bed-name>
    Generate an HTML visual layout of a bed and open it in the browser

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
  node garden.js map "Veggie Patch"

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

  case 'map':
    mapCmd(positional[0]);
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
