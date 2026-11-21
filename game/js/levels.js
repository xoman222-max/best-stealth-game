// Level definitions for Shadow Courier.
// Tile legend: '#' wall, '.' floor, ',' shadow floor (dark, hides you),
// 'C' crate (blocks movement and sight), 'P' player start,
// '*' parcel to collect, 'E' exit.
// Guards patrol the waypoint lists (tile coordinates); their routes are
// straight lines between waypoints, so every leg must stay on open floor.

export const TILE = 32;
export const MAP_COLS = 30;
export const MAP_ROWS = 20;

export const LEVELS = [
  {
    name: 'LEVEL 1 — THE DEPOT',
    sub: 'Three parcels. Two guards. Learn the patrols.',
    decoys: 3,
    map: [
      '##############################',
      '#P....,,,,,,,#......*........#',
      '#.....,,,,,,,#...............#',
      '#..C..,.....,,#...C.....C....#',
      '#.....,,,,,,,#...............#',
      '#.....,,,,,,,#.......#.......#',
      '#..*..,.....,,#.......#...E..#',
      '#.....,,,,,,,#...C...#.......#',
      '#.....,,,,,,,#.......#.......#',
      '######.#######.######.########',
      '#............................#',
      '#..C.......C.......C....C....#',
      '#............................#',
      '#.....*..........C...........#',
      '#............................#',
      '#..C.......C.......C....C....#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
    ],
    guards: [
      { path: [[4, 12], [12, 12], [12, 16], [4, 16]], pause: 1.2 },
      { path: [[21, 12], [27, 12], [27, 16], [21, 16]], pause: 1.0 },
    ],
  },
  {
    name: 'LEVEL 2 — THE GALLERY',
    sub: 'Four parcels, three guards, and long dark halls.',
    decoys: 3,
    map: [
      '##############################',
      '#P....#........#......*......#',
      '#.....#........#.............#',
      '#.C...#...C....#...C....C....#',
      '#.....#........#.............#',
      '#..*..#....,,,,#.....#.......#',
      '#.....#....,,,,#..C..#...E...#',
      '#.....#....,,,,#.....#.......#',
      '#.....#........#.....#.......#',
      '###.#####.######.#####.#######',
      '#............................#',
      '#..C.......C.......C......C..#',
      '#............................#',
      '#.....*.....,,,,,,....*......#',
      '#..........,,,,,,............#',
      '#..C.......,,,,,,...C........#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
    ],
    guards: [
      { path: [[5, 12], [13, 12], [13, 15], [5, 15]], pause: 1.0 },
      { path: [[18, 12], [27, 12], [27, 16], [18, 16]], pause: 1.2 },
      { path: [[23, 2], [27, 2], [27, 6], [23, 6]], pause: 0.8 },
    ],
  },
  {
    name: 'LEVEL 3 — THE VAULT',
    sub: 'Five parcels, four guards, nowhere to hide for long.',
    decoys: 4,
    map: [
      '##############################',
      '#P...#......#.......#....*...#',
      '#....#......#.......#........#',
      '#.C..#..C...#...C...#...C....#',
      '#....#......#.......#........#',
      '#.*..#..,,,,#.......#........#',
      '#....#..,,,,#...C...#....#..E#',
      '#....#..,,,,#.......#.......*#',
      '#....#......#.......#....#...#',
      '##.####.######.#######.#######',
      '#............................#',
      '#..C......C.......C......C...#',
      '#............................#',
      '#....*.....,,,,,,,...*.......#',
      '#..........,,,,,,,...........#',
      '#..C.......,,,,,,,....C......#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
    ],
    guards: [
      { path: [[5, 12], [13, 12], [13, 15], [5, 15]], pause: 0.9 },
      { path: [[20, 12], [27, 12], [27, 16], [20, 16]], pause: 1.0 },
      { path: [[14, 2], [18, 2], [18, 5], [14, 5]], pause: 0.7 },
      { path: [[22, 2], [27, 2], [27, 7], [22, 7]], pause: 0.8 },
    ],
  },
];

// Turn a level definition's string map into the structures the engine uses.
export function parseLevel(def) {
  const walls = new Set();
  const crates = new Set();
  const shadows = new Set();
  let playerStart = null;
  const parcels = [];
  let exit = null;

  def.map.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx];
      const key = tx + ',' + ty;
      if (ch === '#') walls.add(key);
      else if (ch === 'C') crates.add(key);
      else if (ch === ',') shadows.add(key);
      else if (ch === 'P') playerStart = { tx, ty };
      else if (ch === '*') parcels.push({ tx, ty, taken: false });
      else if (ch === 'E') exit = { tx, ty };
    }
  });

  return {
    def,
    walls,
    crates,
    shadows,
    playerStart,
    parcels,
    exit,
    exitOpen: false,
  };
}

// Tile helpers. Crates and walls both block movement and sight.
export function tileKey(tx, ty) {
  return tx + ',' + ty;
}

export function isSolid(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return true;
  return level.walls.has(tileKey(tx, ty)) || level.crates.has(tileKey(tx, ty));
}

export function isShadow(level, tx, ty) {
  return level.shadows.has(tileKey(tx, ty));
}

export function tileAt(level, px, py) {
  return { tx: Math.floor(px / TILE), ty: Math.floor(py / TILE) };
}
