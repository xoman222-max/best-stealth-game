# best-stealth-game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/xoman222-max/best-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/xoman222-max/best-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Shadow Courier is a top-down stealth game: slip past patrolling guards and their vision cones, hide behind crates and in the dark, toss coins to lure guards away, grab every parcel, and reach the exit unseen across three night levels.

## Run it

```sh
python3 -m http.server 8000
# open http://localhost:8000/game/index.html
```

Or open `game/index.html` directly in a desktop browser — the game is plain static files and runs fully offline with no network requests.

## How to play

- **WASD / Arrow keys** — move
- **Hold Shift** — sneak (slower, quieter, harder to spot)
- **Click** — toss a coin decoy toward the mouse (lures guards to the noise)
- **M** — mute, **P** — pause, **R** — restart level

Guards patrol fixed routes. If one spots you, its suspicion meter fills — break line of sight and it drains again. At full suspicion the guard chases you; get caught and the level restarts. Footsteps make noise: walking is louder than sneaking, and shadows hide you. Collect every parcel to unlock the exit.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ag1zr0tn&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
