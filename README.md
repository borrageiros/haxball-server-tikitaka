# Tikitaka

Headless HaxBall room server built with [node-haxball](https://github.com/wxyz-abcd/node-haxball). It creates and hosts a configurable room, loads stadium maps, balances players automatically, and handles chat commands.

## Features

- Configurable room via `.env` (name, password, player limit, geo, maps, etc.)
- Headless host mode (`NO_PLAYER=true`)
- Automatic connection queue, balanced teams, and spectator overflow
- Two fill modes via `FILL_MODE`: wait for even teams (`pairs`) or enter on connect (`instant`)
- Dynamic small/big map switching on natural pauses (score resets)
- Chat command system (`!command`)
- Admin access with `!admin <password>` using `ADMIN_PASSWORD`
- Localization (`es` / `en`) driven by `LANGUAGE`
- Docker-ready production image

## Requirements

- Node.js 18+
- Yarn
- A HaxBall headless token ([get one here](https://www.haxball.com/headlesstoken))

## Quick start

```bash
yarn install
cp .env.example .env
```

Edit `.env` and set at least:

- `TOKEN` or `HAXBALL_TOKEN` (or leave empty to paste it at startup)
- `ADMIN_PASSWORD`
- `LANGUAGE` (`es` by default)

Run in development:

```bash
yarn dev
```

Build and run in production:

```bash
yarn build
yarn start
```

When the room opens, the console prints the room link.

## Project structure

```text
.
├── index.ts              # Room bootstrap
├── commands/             # Chat commands (one file per command)
│   ├── index.ts          # Command registry and dispatcher
│   ├── types.ts          # Shared command types
│   └── admin.ts          # !admin
├── match/                # Matchmaking, teams, and map switching
│   ├── constants.ts      # Team ids, max size, map thresholds
│   ├── helpers.ts        # Pure match helpers
│   └── setupMatch.ts     # Queue, roster sync, map/score logic
├── utils/
│   ├── config.ts         # Loads .env.example then .env
│   ├── i18n.ts           # Translation helper `t()`
│   ├── askToken.ts       # Token from env or interactive prompt
│   └── loadStadium.ts    # Loads map JSON from maps/
├── locales/              # Translation files (es.json, en.json)
├── maps/                 # Stadium JSON files
│   ├── small-map.json    # 3vs3 stadium
│   └── big-map.json      # Large stadium (4vs4+)
├── .env.example          # Documented environment variables
└── Dockerfile
```

## Match rules

These rules are enforced automatically by `match/setupMatch.ts`. There is no manual team picker.

### Maps

| Map | File env | Used when |
| --- | --- | --- |
| Small (3vs3 stadium) | `SMALL_MAP_FILE` | Match size is **1vs1–3vs3** |
| Big (large stadium) | `BIG_MAP_FILE` | Match size is **4vs4 and above** (up to `MAX_TEAM_SIZE`) |

### Connection queue

- Every join is appended to a **connection queue** (oldest first).
- The queue is the source of truth for who has priority to play.
- Leaving the room removes the player from the queue and from the field history.

### Fill modes (`FILL_MODE`)

The way players enter the field depends on the `FILL_MODE` variable:

#### `instant` (default)

- Players enter the field **as soon as they connect**, up to the per-team cap; no one waits for an even count (e.g. 3 connected → 2vs1).
- Teams are kept balanced with a difference of **at most one player**, always assigning newcomers to the smaller team.
- If a team loses players (e.g. two leave blue), the roster is **compensated** by moving players from the bigger team (e.g. one red moves to blue).
- When both teams are full, extra players wait as spectators and receive a private message; they enter as soon as a spot opens.
- The game starts as soon as there is at least **1 player** on the field, after a short countdown.

#### `pairs`

- Teams always stay even: match size is `NvsN` where  
  `N = min(maxTeamSize, floor(connectedPlayers / 2))`.
- The game starts as soon as there is a **1vs1** (2 players), after a short countdown.
- An odd player waits as spectator until another player joins; then both enter together (e.g. 3 connected → still 1vs1; 4 connected → 2vs2). They receive a private message explaining they will return when teams can be balanced.

In both modes, mid-game promotions do **not** stop the match.

### Kickoff countdown

- Before every kickoff (first start, rematch after a finished game, or restart after a map change), the room announces a **3-second countdown**, then starts.
- The countdown is cancelled if there are no longer enough players for a 1vs1.
- Join/leave updates the roster and can schedule a start when the lobby is idle; **end of match also schedules a start on its own** (no join/leave required).

### Field history (LIFO)

- Players who enter the pitch are pushed onto a **field history** stack.
- If the room shrinks (disconnect), the **last players who entered** are moved back to spectators until teams are equal again at the new size.
- After every roster change, teams are **rebalanced**: equal counts in `pairs` mode, difference of at most one in `instant` mode.
- Example: 2vs2 → one disconnect → last entrant leaves the field → back to 1vs1.
- Whenever a player is moved off the field for roster balance, they get a **private message** with the reason.

### AFK

- During a live (unpaused) match, if an on-field player shows no activity for `AFK_TIMEOUT_MS` (default **10000** ms), they are **kicked from the room**.
- Activity includes movement, keyboard/input changes, typing (chat indicator), and sending chat messages.
- At **half** of that timeout, the player receives a **private countdown** warning (only they see it), updated each second until kick or activity.
- The room announces `{name} ha sido expulsado por inactividad` (or the English equivalent) when the kick happens.
- Leaving triggers the normal roster sync: a waiting spectator enters if available, otherwise the match shrinks and another player may move to spectators with the uneven-roster message.

### Spectators and team-size cap

- Maximum on-field size is `MAX_TEAM_SIZE` vs `MAX_TEAM_SIZE` (default **6vs6**, 12 players).
- Extra players stay as spectators, ordered by the connection queue.
- If the match is full and an on-field player leaves while spectators exist, the **oldest spectator** enters immediately to keep the match at the capped size when enough people remain.

### Map switching

- Only when **both** teams would have at least **4** players (true **4vs4**, i.e. **8** on the field), the room targets the **big** map. A **4vs3** stays on the small map.
- When the smaller team drops to **3 or below** (3vs3 or uneven sizes like 4vs3), it targets the **small** map.
- If a game is in progress, the stadium change is **queued** and applied on the next **natural pause** (after a goal, on positions reset). There is no forced mid-play freeze.
- After the stadium swap the **score resets** (new kickoff on the new map).
- If no game is running, the map changes immediately.

### End of match

- There is **no pick/choose system**.
- When a match ends, players still eligible by the connection queue stay on the field.
- Those players are **randomly reassigned** between red and blue (still balanced) as soon as the match ends.
- After the engine finishes the victory pause (~5s) and the game fully stops, a new countdown starts automatically (no player join/leave needed).
- If a map change is pending at that point, the stadium is applied first and then the countdown runs.

### Manual control

- Teams are locked.
- Non-host players cannot change teams, start/stop/pause the game, or change the stadium/limits.

## Configuration

All runtime settings live in `.env`. `.env.example` is loaded first as defaults, then `.env` overrides them.

See `.env.example` for the full variable list and descriptions.

Important variables:

| Variable | Purpose |
| --- | --- |
| `ROOM_NAME` | Room name in the public list |
| `ADMIN_PASSWORD` | Password for `!admin` |
| `ROOM_PASSWORD` | Join password (empty = open room) |
| `MAX_TEAM_SIZE` | Max players per team on the field (default `6`) |
| `AFK_TIMEOUT_MS` | Ms without activity (move/input/typing) before AFK kick (default `10000`) |
| `FILL_MODE` | Field fill mode: `instant` (default) or `pairs` |
| `SMALL_MAP_FILE` | Small stadium file inside `maps/` |
| `BIG_MAP_FILE` | Big stadium file inside `maps/` |
| `LANGUAGE` | `es` or `en` |
| `TOKEN` / `HAXBALL_TOKEN` | Headless token |
| `GEO_LAT` / `GEO_LON` / `GEO_FLAG` | Room list location and flag |

## Commands

Chat messages starting with `!` are treated as commands and are not shown in public chat.

| Command | Description |
| --- | --- |
| `!admin <password>` | Grants room admin if the password matches `ADMIN_PASSWORD` |

### Adding a new command

1. Create `commands/myCommand.ts` exporting a `Command`:

```typescript
import t from "../utils/i18n";
import type { Command } from "./types";

const myCommand: Command = {
  name: "mycommand",
  execute({ room, playerId, args }) {
    room.sendAnnouncement(t("mycommand.ok"), playerId, 0x44ff44, "bold", 1);
  },
};

export default myCommand;
```

2. Register it in `commands/index.ts` inside `commandList`.
3. Add the new strings to `locales/es.json` and `locales/en.json`.
4. Update this README and `.env.example` if the command introduces new config.

## Localization

Translations live in `locales/<language>.json`.

Usage:

```typescript
import t from "./utils/i18n";

t("admin.success");
t("room.link", { link: roomLink });
```

Rules:

- Default language is `es`
- Unknown `LANGUAGE` values fall back to `es`
- Missing keys fall back to the Spanish file, then to the key itself
- User-facing strings must go through `t()` — never hardcode them

## Docker

HaxBall rooms use WebRTC (UDP). Inside Docker’s default bridge network players usually **cannot connect**, even if the room link appears in the logs. Always run with `--network host`.

Build the image and print a ready-to-paste `docker run` command from `.env`:

```bash
./deploy.sh
```

Defaults:

| Variable | Default |
| --- | --- |
| `IMAGE` | `borrageiros/haxball-tikitaka` |
| `CONTAINER_NAME` | `haxball-tikitaka` |
| `ENV_FILE` | `.env` |

Example override:

```bash
IMAGE=myregistry/tikitaka CONTAINER_NAME=tikitaka-prod ./deploy.sh
```

Manual alternative:

```bash
docker build -t borrageiros/haxball-tikitaka .
docker run -d \
  --name haxball-tikitaka \
  --network host \
  --restart unless-stopped \
  --env-file .env \
  borrageiros/haxball-tikitaka
docker logs -f haxball-tikitaka
```

Checklist if you cannot join the room:

1. Container was started with `--network host`
2. `TOKEN` or `HAXBALL_TOKEN` is set (detached mode cannot ask for a token)
3. Local `yarn start` is **stopped** (one room per token / IP)
4. Room link comes from `docker logs`, not from an old local run

The image includes compiled JS, `match/`, `maps/`, `locales/`, and `.env.example`. Provide a real `.env` (or env vars) with a valid token at runtime.

## Scripts

| Script | Description |
| --- | --- |
| `yarn dev` | Run with `tsx` (TypeScript directly) |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Run compiled `dist/index.js` |
| `./deploy.sh` | Docker build + print `docker run` with `.env` vars |

## Development notes

- Package manager: **Yarn**
- Language for code, file names, and docs: **English**
- Do not add comments inside source code
- Keep README and `.env.example` in sync when behavior or config changes
