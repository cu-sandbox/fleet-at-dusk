"use strict";

const size = 10;
const fleet = [
  { name: "Flagship", length: 5 },
  { name: "Cruiser", length: 4 },
  { name: "Patrol ship", length: 3 },
  { name: "Submersible", length: 3 },
  { name: "Cutter", length: 2 },
];
const letters = "ABCDEFGHIJ";

const byId = (id) => document.getElementById(id);
const status = byId("status");
const rotate = byId("rotate");
const shuffle = byId("shuffle");
const start = byId("start");
const reset = byId("reset");

function coordinate(index) {
  return letters[Math.floor(index / size)] + (index % size + 1);
}

function makeBoard(id, onSelect, onPreview) {
  const board = byId(id);
  function addAxis(label) {
    const axis = document.createElement("span");
    axis.className = "axis";
    axis.setAttribute("aria-hidden", "true");
    axis.textContent = label;
    board.append(axis);
  }

  addAxis("");
  for (let col = 1; col <= size; col++) addAxis(col);

  const cells = Array.from({ length: size * size }, (_, index) => {
    const col = index % size;
    const row = Math.floor(index / size);
    if (col === 0) addAxis(letters[row]);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.tabIndex = index === 0 ? 0 : -1;
    cell.addEventListener("click", () => onSelect(index));
    cell.addEventListener("pointerenter", () => onPreview?.(index));
    cell.addEventListener("focus", () => {
      cells[activeIndex].tabIndex = -1;
      activeIndex = index;
      cell.tabIndex = 0;
    });
    cell.addEventListener("keydown", (event) => {
      const moves = {
        ArrowUp: row > 0 ? index - size : index,
        ArrowDown: row < size - 1 ? index + size : index,
        ArrowLeft: col > 0 ? index - 1 : index,
        ArrowRight: col < size - 1 ? index + 1 : index,
      };
      if (!Object.hasOwn(moves, event.key)) return;
      event.preventDefault();
      cells[moves[event.key]].focus();
    });
    board.append(cell);
    return cell;
  });
  let activeIndex = 0;
  board.addEventListener("pointerleave", () => onPreview?.(null));
  return {
    cells,
    refresh(tiles, canAct) {
      cells.forEach((cell, index) => {
        const tile = tiles[index];
        cell.className = "cell" + (tile ? " " + tile : "");
        cell.setAttribute("aria-label", coordinate(index) + (tile ? ", " + tile : ""));
        cell.setAttribute("aria-disabled", String(!canAct(index)));
        cell.tabIndex = canAct() && index === activeIndex ? 0 : -1;
      });
    },
    focus() {
      cells[activeIndex].focus();
    },
  };
}

function placement(ships, ship, index, vertical) {
  const space = vertical ? size - Math.floor(index / size) : size - index % size;
  if (space < ship.length) return null;
  const tiles = Array.from({ length: ship.length }, (_, offset) =>
    index + offset * (vertical ? size : 1));
  if (ships.some((placed) => placed.tiles.some((tile) => tiles.includes(tile)))) return null;
  return { ...ship, tiles };
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomFleet() {
  const ships = [];
  for (const ship of fleet) {
    const options = [];
    for (let index = 0; index < size * size; index++) {
      for (const vertical of [false, true]) {
        const option = placement(ships, ship, index, vertical);
        if (option) options.push(option);
      }
    }
    if (options.length === 0) return randomFleet();
    ships.push(randomItem(options));
  }
  return ships;
}

function afloat(ship, shots) {
  return ship.tiles.some((tile) => !shots.has(tile));
}

function mapTiles(ships, shots, reveal) {
  const tiles = Array(size * size).fill("");
  for (const shot of shots) tiles[shot] = "miss";
  for (const ship of ships) {
    const struck = afloat(ship, shots) ? "hit" : "sunk";
    for (const tile of ship.tiles) {
      if (shots.has(tile)) tiles[tile] = struck;
      else if (reveal) tiles[tile] = "ship";
    }
  }
  return tiles;
}

function fire(ships, shots, index) {
  shots.add(index);
  const ship = ships.find((candidate) => candidate.tiles.includes(index));
  if (!ship) return "missed";
  return afloat(ship, shots) ? "hit a ship" : "sank the " + ship.name;
}

function nextComputerShot() {
  const targets = new Set();
  for (const ship of ownShips) {
    if (!afloat(ship, computerShots)) continue;
    for (const tile of ship.tiles) {
      if (!computerShots.has(tile)) continue;
      const row = Math.floor(tile / size);
      const col = tile % size;
      for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const y = row + dy;
        const x = col + dx;
        const neighbor = y * size + x;
        if (y >= 0 && y < size && x >= 0 && x < size && !computerShots.has(neighbor)) {
          targets.add(neighbor);
        }
      }
    }
  }
  if (targets.size) return randomItem([...targets]);
  const available = Array.from({ length: size * size }, (_, index) => index)
    .filter((index) => !computerShots.has(index));
  return randomItem(available);
}

let ownShips, enemyShips, playerShots, computerShots, vertical, phase;
const ownBoard = makeBoard("own-board", place, preview);
const enemyBoard = makeBoard("enemy-board", attack);

function render(message) {
  const setup = phase === "setup";
  const ship = fleet[ownShips.length];
  byId("phase").textContent = { setup: "FLEET SETUP", battle: "BATTLE IN PROGRESS", won: "VICTORY", lost: "DEFEAT" }[phase];
  byId("own-count").textContent = setup
    ? ownShips.length + " / " + fleet.length + " placed"
    : ownShips.filter((entry) => afloat(entry, computerShots)).length + " afloat";
  byId("enemy-count").textContent = setup
    ? "Awaiting battle"
    : enemyShips.filter((entry) => afloat(entry, playerShots)).length + " afloat";
  rotate.textContent = vertical ? "Rotate: vertical" : "Rotate: horizontal";
  rotate.hidden = !setup;
  shuffle.hidden = !setup;
  start.hidden = !setup;
  start.disabled = Boolean(ship);
  reset.hidden = setup && ownShips.length === 0;
  ownBoard.refresh(mapTiles(ownShips, computerShots, true), () => setup && Boolean(ship));
  enemyBoard.refresh(mapTiles(enemyShips, playerShots, phase === "won" || phase === "lost"),
    (index) => phase === "battle" && !playerShots.has(index));
  status.textContent = message ?? (ship
    ? "Place your " + ship.name + " (" + ship.length + " squares). Use arrow keys to move on the map."
    : "Fleet ready. Start battle when you're ready.");
}

function preview(index) {
  for (const cell of ownBoard.cells) cell.classList.remove("preview");
  const ship = fleet[ownShips.length];
  if (phase !== "setup" || !ship || index === null) return;
  const target = placement(ownShips, ship, index, vertical);
  target?.tiles.forEach((tile) => ownBoard.cells[tile].classList.add("preview"));
}

function place(index) {
  const ship = fleet[ownShips.length];
  if (phase !== "setup" || !ship) return;
  const target = placement(ownShips, ship, index, vertical);
  if (!target) {
    status.textContent = "The " + ship.name + " won't fit at " + coordinate(index) + ". Choose another square or rotate.";
    return;
  }
  ownShips.push(target);
  render();
  if (ownShips.length === fleet.length) start.focus();
}

function attack(index) {
  if (phase !== "battle" || playerShots.has(index)) return;
  const result = "You " + fire(enemyShips, playerShots, index) + " at " + coordinate(index) + ".";
  if (enemyShips.every((ship) => !afloat(ship, playerShots))) {
    phase = "won";
    render(result + " You won!");
    reset.focus();
    return;
  }
  const reply = nextComputerShot();
  const response = " Opponent " + fire(ownShips, computerShots, reply) + " at " + coordinate(reply) + ".";
  if (ownShips.every((ship) => !afloat(ship, computerShots))) phase = "lost";
  render(result + response + (phase === "lost" ? " Your fleet was sunk." : ""));
  if (phase === "lost") reset.focus();
}

function newGame() {
  ownShips = [];
  enemyShips = [];
  playerShots = new Set();
  computerShots = new Set();
  vertical = false;
  phase = "setup";
  render();
}

rotate.addEventListener("click", () => {
  vertical = !vertical;
  render();
});
shuffle.addEventListener("click", () => {
  ownShips = randomFleet();
  render();
});
start.addEventListener("click", () => {
  if (phase !== "setup" || ownShips.length !== fleet.length) return;
  enemyShips = randomFleet();
  phase = "battle";
  render("Choose a square in hostile waters to fire.");
  enemyBoard.focus();
});
reset.addEventListener("click", () => {
  newGame();
  ownBoard.focus();
});

newGame();
