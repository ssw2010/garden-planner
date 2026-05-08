# 🌱 Garden Planner CLI

A command-line app to design and manage your garden beds.

## Setup

```bash
# No install needed — just Node.js required
node garden.js help
```

## Commands

### Create a garden bed
```bash
node garden.js create-bed "Veggie Patch" --width 3 --length 4
```

### Add a plant to a bed
```bash
node garden.js add-plant "Tomato" --bed "Veggie Patch" --spacing 0.5 --sun full --water high
node garden.js add-plant "Basil" --bed "Veggie Patch" --spacing 0.3 --sun full --water medium
node garden.js add-plant "Carrot" --bed "Veggie Patch" --spacing 0.15 --sun full --water medium
```

### List all beds
```bash
node garden.js list-beds
```

### List plants in a bed
```bash
node garden.js list-plants "Veggie Patch"
```

### List all plants
```bash
node garden.js list-plants
```

## Options for add-plant

| Option | Values | Description |
|--------|--------|-------------|
| `--spacing` | e.g. `0.5` | Space needed between plants (metres) |
| `--sun` | `full` `partial` `shade` | Sunlight requirement |
| `--water` | `low` `medium` `high` | Watering need |

## Data

All garden data is saved to `garden.json` in the same folder.
