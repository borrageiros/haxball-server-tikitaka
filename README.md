# Tikitaka

Headless HaxBall room server built with [node-haxball](https://github.com/wxyz-abcd/node-haxball). It creates and hosts a configurable room, loads stadium maps, balances players automatically, and handles chat commands.

## Features

- Configurable room via `.env` (name, password, player limit, geo, maps, etc.)
- Headless host mode (`NO_PLAYER=true`)
- Automatic connection queue, balanced teams, and spectator overflow
- Two fill modes via `FILL_MODE`: wait for even teams (`pairs`) or enter on connect (`instant`)
- Dynamic small/big map switching on natural pauses (score resets)
- Chat command system (`!command`)
- Player chat shown in team colors (red / blue / white for spectators)
- Custom kits in `match/kits.ts`: three shirt styles (half split, diagonal sash, vertical stripe) built from the team color (red/blue) over a white or black base; a random pair is applied when each match starts, and `kits-viewer/index.html` previews and exports all combinations
- Admin access with `!admin <password>` using `ADMIN_PASSWORD`
- Hidden sub-admin access with `!subadmin <password>` using `SUBADMIN_PASSWORD` (no visible room admin)
- Moderation commands `!kick`, `!ban`, `!unban`, and `!mute` for room admins and sub-admins
- Hidden team priority with `!priority` (moderators keep a per-moderator list of players who are placed on their team; supports `list` and `clear`)
- Voluntary AFK with `!afk` (hold queue spot as spectator without playing)
- Yellow/red card for touching the ball while the chat input is open (temporary AFK on second offense)
- End-of-match summary announcing the final score, scorers (with goal minute and own goals), and ball possession per team
- Queue position with `!queue` and automatic private notifications when the position changes
- Command list with `!help` (private message); moderators also see the hidden commands
- Localization (`es` / `en`) driven by `LANGUAGE`
- Optional Discord bot (`DISCORD_BOT_TOKEN`) whose status shows the current player count as "Playing X/MAX_PLAYERS", optionally mirrors public chat to `DISCORD_CHAT_CHANNEL_ID`, and can post application logs to `DISCORD_LOGS_CHANNEL_ID`
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
- `SUBADMIN_PASSWORD`
- `LANGUAGE` (`es` by default)

Run in development (auto-restarts on file changes):

```bash
yarn dev
```

On each change, the process closes the HaxBall room with `leave()` and creates a new one. Open the new room link printed in the console (the previous browser tab will be dead).

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
│   ├── moderation.ts     # Shared kick/mute permission helpers
│   ├── help.ts           # !help
│   ├── afk.ts            # !afk
│   ├── queue.ts          # !queue
│   ├── admin.ts          # !admin
│   ├── subadmin.ts       # !subadmin (hidden)
│   ├── kick.ts           # !kick
│   ├── ban.ts            # !ban
│   ├── unban.ts          # !unban
│   ├── mute.ts           # !mute
│   └── priority.ts       # !priority (hidden)
├── match/                # Matchmaking, teams, and map switching
│   ├── constants.ts      # Team ids, max size, map thresholds
│   ├── helpers.ts        # Pure match helpers
│   ├── kits.ts           # Team kit definitions and random match selection
│   ├── types.ts          # Queue entry and match types
│   ├── controls.ts       # Match API bridge for commands
│   ├── stats.ts          # Match stats: scorers and possession tracking
│   └── setupMatch.ts     # Queue, roster sync, map/score logic
├── discord/
│   └── index.ts          # Optional Discord bot (player count, chat mirror, logs)
├── utils/
│   ├── config.ts         # Loads .env.example then .env
│   ├── i18n.ts           # Translation helper `t()`
│   ├── askToken.ts       # Token from env or interactive prompt
│   └── loadStadium.ts    # Loads map JSON from maps/
├── kits-viewer/          # Static page to preview all kits and download them as PNG
│   └── index.html
├── locales/              # Translation files (es.json, en.json)
├── maps/                 # Stadium JSON files
│   ├── small-map.json    # 3vs3 stadium
│   ├── big-map.json      # Large stadium (4vs4+)
│   └── credit-by-borrageiros.json  # Optional map credit stamp (not loaded)
├── .env.example          # Documented environment variables
└── Dockerfile
```

## Match rules

These rules are enforced automatically by `match/setupMatch.ts`. There is no manual team picker.

### Maps

| Map | File env | Time limit env | Score limit env | Used when |
| --- | --- | --- | --- | --- |
| Small (3vs3 stadium) | `SMALL_MAP_FILE` | `SMALL_MAP_TIME_LIMIT` (default: 3 min) | `SMALL_MAP_SCORE_LIMIT` (default: 3) | Non-AFK connected players are `<= MAP_SWITCH_TO_SMALL_MAX_PLAYERS` (default: 6) |
| Big (large stadium) | `BIG_MAP_FILE` | `BIG_MAP_TIME_LIMIT` (default: 5 min) | `BIG_MAP_SCORE_LIMIT` (default: 3) | Non-AFK connected players are `>= MAP_SWITCH_TO_BIG_PLAYERS` (default: 8) |
| Current map kept | — | — | — | Between those thresholds (default: 7 players) |

### Connection queue

- Every join is appended to a **connection queue** (oldest first).
- On join, the player receives a **private welcome message** pointing them to `!help`.
- Each queue entry is an object `{ id, name, afk, admin, auth }`:
  - `id` — player id
  - `name` — player display name at join time
  - `afk` — voluntary AFK flag (`!afk`); distinct from the inactivity kick
  - `admin` — sub-admin flag (`!subadmin`); grants `!kick` / `!mute` without visible room admin
  - `auth` — stable public auth string of the client (`null` if the client does not provide one); used to restore moderation state across rejoins
- The queue is the source of truth for who has priority to play.
- Field size is computed from **non-AFK** players only (AFK players keep their place but do not count toward fill).
- Leaving the room removes the player from the queue and from the field history.

### Moderation persistence by auth

- Sub-admin status, mutes, bans, and `!priority` lists are keyed by the player's **auth string**, so they survive leaving and rejoining the room with the same HaxBall client.
- On rejoin, a restored sub-admin or mute is announced privately to the player; no password re-entry is needed for sub-admin.
- A banned player who rejoins with the same client (auth) is allowed to finish joining so they can see the ban kick reason, then kicked before entering the queue, until a moderator lifts the ban with `!unban`.
- Priority list targets that go offline stay on the list (shown as offline in `!priority list`) and regroup with their moderator once they rejoin; while offline they do not affect reshuffles.
- Everything lives **in memory only**: restarting the server process clears all of it. There is no disk/DB persistence and no command to revoke sub-admin.
- Players whose client reports no auth (`null`) keep the previous session-only behavior: their sub-admin, mute, and priority state is lost on leave, and they cannot be added to priority lists.

### Visible queue position

- The **visible queue** contains only the players actually waiting: connected, non-AFK, and not on the field. For example, with `MAX_TEAM_SIZE=6` and 14 players connected, 12 are on the field and the 2 waiting spectators hold visible positions 1 and 2.
- When a player starts waiting (teams full or uneven roster), they receive a **private message** with the waiting reason followed by their visible queue position.
- Whenever their position changes (someone leaves, is kicked, or the queue advances), they receive a private message with the updated position.
- `!queue` returns the current position at any time (see [Commands](#commands)).

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

In both modes, when the field is empty (server just started or everyone left), the first player to enter is always assigned to the **red team**.

In both modes, mid-game promotions do **not** stop the match.

### Kickoff countdown

- Before every kickoff (first start, rematch after a finished game, or restart after a map change), the room announces a **3-second countdown**, then starts.
- At kickoff the room also announces the match duration and score limit for the current map (`SMALL_MAP_TIME_LIMIT` / `BIG_MAP_TIME_LIMIT` and `SMALL_MAP_SCORE_LIMIT` / `BIG_MAP_SCORE_LIMIT`; `0` = unlimited).
- The countdown is cancelled if there are no longer enough players for a 1vs1.
- Join/leave updates the roster and can schedule a start when the lobby is idle; **end of match also schedules a start on its own** (no join/leave required).
- A **start watchdog** runs every 5 seconds as a safety net: if no game is active, no countdown is running, and there are enough players, it re-applies any pending map change and schedules the start. It also clears the internal action flag, so a start missed by the event-driven flow (e.g. after an unexpected error) recovers automatically.

### Field history (LIFO)

- Players who enter the pitch are pushed onto a **field history** stack.
- If the room shrinks (disconnect), the **last players who entered** are moved back to spectators until teams are equal again at the new size.
- After every roster change, teams are **rebalanced**: equal counts in `pairs` mode, difference of at most one in `instant` mode.
- Example: 2vs2 → one disconnect → last entrant leaves the field → back to 1vs1.
- Whenever a player is moved off the field for roster balance, they get a **private message** with the reason.

### Typing while on the ball

- During live play (`Playing`, not paused), if an on-field player has the **chat input focused** (typing indicator) and their disc collides with the ball, they receive a **yellow card** announced globally.
- A second collision under the same conditions triggers a **red card** announcement and simulates `!afk` twice: AFK is toggled on immediately, then toggled off again after `TYPING_BALL_AFK_MS` (5s), with the same private messages as the command.
- Continuous contact is debounced (`TYPING_BALL_TOUCH_COOLDOWN_MS`, 1s) so one prolonged touch does not fire yellow and red in the same frame burst; after the cooldown, another touch while still typing counts as the next offense.
- After a yellow card, escalation is blocked for `TYPING_BALL_CARD_ESCALATION_DELAY_MS` (3s): further ball touches in that window are ignored, so a single prolonged contact detected as multiple collisions cannot turn straight into a red card.
- The yellow warning resets after the red-card AFK is applied, so the cycle can start again.
- The typing indicator is tracked via `onPlayerChatIndicatorChange`; warnings and pending AFK timers are cleared when the player leaves the room.
- Closing the chat input before touching the ball avoids the penalty.
- Manual `!afk` is not blocked during the automatic window; the second simulated toggle still runs after 5s regardless.

### AFK

There are two separate AFK behaviours:

#### Inactivity kick (automatic)

- During a live match in the **Playing** state (after kickoff, not paused), if an on-field player shows no activity for `AFK_TIMEOUT_MS` (default **10000** ms), they are **kicked from the room**.
- AFK is **not** checked during kickoff wait, after a goal, during the victory screen (~5s after the match ends), or while the game is paused. Timers reset when those phases begin.
- The kick itself re-checks that a match is live (started, not paused, in the Playing state) right before executing, so nobody is ever kicked for inactivity while the game has not started.
- Activity includes movement, keyboard/input changes, typing (chat indicator), and sending chat messages.
- At **half** of that timeout, the player receives a **private countdown** warning (only they see it), updated each second until kick or activity.
- The room announces `{name} ha sido expulsado por inactividad` (or the English equivalent) when the kick happens.
- This kick does **not** set the voluntary AFK flag; the player is removed from the room entirely.
- Leaving triggers the normal roster sync: a waiting spectator enters if available, otherwise the match shrinks and another player may move to spectators with the uneven-roster message.

#### Voluntary AFK (`!afk`)

- Toggled by the `!afk` command, and also by the typing-while-on-the-ball red card (simulated `!afk` on / off after 5s).
- Sets `afk: true` on the player's queue entry and keeps their position in the connection queue.
- If they are on the field, they are moved to spectators immediately; their spot can be filled by the next eligible (non-AFK) player in queue order.
- While AFK they are never promoted onto the field, even if there is a free spot.
- `!afk` again clears the flag; they become eligible again and enter when their turn and a spot allow it.
- Confirmation is sent as a **private** message to the player.

### Spectators and team-size cap

- Maximum on-field size is `MAX_TEAM_SIZE` vs `MAX_TEAM_SIZE` (default **6vs6**, 12 players).
- Extra players stay as spectators, ordered by the connection queue.
- If the match is full and an on-field player leaves while spectators exist, the **oldest spectator** enters immediately to keep the match at the capped size when enough people remain.

### Map switching

- The map target is computed from **connected non-AFK players** (voluntary `!afk` does not count).
- The room targets the **big** map at `MAP_SWITCH_TO_BIG_PLAYERS` or above (default `8`, true **4vs4**).
- The room targets the **small** map at `MAP_SWITCH_TO_SMALL_MAX_PLAYERS` or below (default `6`).
- Between those thresholds (default **7**), the room **keeps the current map** (hysteresis), so dropping from 8 to 7 does not immediately leave the big map.
- If a game is in progress, a map change is announced when the count crosses a threshold and applied on the next **goal** (on positions reset). **Every goal rechecks** the current non-AFK count and switches if needed — including when players joined or left after the previous announcement.
- When a match stops, the target map is **recomputed** again before the rematch countdown.
- After the stadium swap the **score resets** (new kickoff on the new map).
- If no game is running, the map changes immediately.

### End of match

- There is **no pick/choose system**.
- When a match ends naturally (score or time limit), the room announces a **match summary**: final score, scorers per team with the goal minute (own goals marked), and ball possession percentages. Tracking lives in `match/stats.ts`: the last player to kick or touch the ball is credited with the goal (an opponent touch counts as an own goal), and possession accumulates per game tick for the team of the last toucher while the ball is in play. Stats reset at every game start, and the summary is skipped on internal stops (e.g. map changes).
- When a match ends, players still eligible by the connection queue stay on the field (same teams during the victory pause).
- After the engine finishes the victory pause (~5s) and the game fully stops, those players are **randomly reassigned** between red and blue (still balanced) and a new countdown starts automatically (no player join/leave needed).
- If moderators set **team priority lists** (`!priority`), each moderator and the players on their list form a **group** that is kept on the same team during the reshuffle; everyone else stays random. Groups from different moderators that share a player are merged into one. If a group does not fit into one team, the overflow players are moved to the other team so teams always stay balanced (difference of at most 1 player).
- If a map change is pending at that point, the stadium is applied first and then the reshuffle and countdown run.

### Kits

- Kit definitions live in `match/kits.ts` (`KIT_STYLES`), three shirt styles shared by both teams: half split (team color on top, base below), diagonal sash, and vertical stripe of the team color over the base.
- Each match start picks one style at random per team and applies it with `setTeamColors`.
- The base color (white or black) is randomized per match and always opposite between teams: if one side gets a white base, the other gets black.
- Red kits always use red and blue kits always use blue as the team color, so the sides stay distinct.
- Add more entries to `KIT_STYLES` to expand the pool later.
- `kits-viewer/index.html` is a standalone static page (open it directly in a browser, no build step) that renders every kit combination (3 styles x 2 base colors per team) exactly as HaxBall draws them and offers a **Download PNG** button to export the full sheet as a single image. If you change `KIT_STYLES` or the palette in `match/kits.ts`, mirror the change in the viewer script.

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
| `SUBADMIN_PASSWORD` | Password for hidden `!subadmin` |
| `ROOM_PASSWORD` | Join password (empty = open room) |
| `MAX_TEAM_SIZE` | Max players per team on the field (default `6`) |
| `MAP_SWITCH_TO_BIG_PLAYERS` | Non-AFK connected players required to switch to big map (default `8`) |
| `MAP_SWITCH_TO_SMALL_MAX_PLAYERS` | Max non-AFK connected players to use small map (default `6`; in between keeps current map) |
| `AFK_TIMEOUT_MS` | Ms without activity during live play before AFK kick (default `10000`) |
| `FILL_MODE` | Field fill mode: `instant` (default) or `pairs` |
| `SMALL_MAP_FILE` | Small stadium file inside `maps/` |
| `BIG_MAP_FILE` | Big stadium file inside `maps/` |
| `SMALL_MAP_TIME_LIMIT` | Match time limit in minutes for the small map (default `3`; `0` = unlimited) |
| `BIG_MAP_TIME_LIMIT` | Match time limit in minutes for the big map (default `5`; `0` = unlimited) |
| `SMALL_MAP_SCORE_LIMIT` | Goals needed to win on the small map (default `3`; `0` = unlimited) |
| `BIG_MAP_SCORE_LIMIT` | Goals needed to win on the big map (default `3`; `0` = unlimited) |
| `LANGUAGE` | `es` or `en` |
| `TOKEN` / `HAXBALL_TOKEN` | Headless token |
| `DISCORD_BOT_TOKEN` | Discord bot token (empty = bot disabled) |
| `DISCORD_CHAT_CHANNEL_ID` | Discord text channel id for mirrored public chat (empty = off) |
| `DISCORD_LOGS_CHANNEL_ID` | Discord text channel id for application logs (empty = off) |
| `GEO_LAT` / `GEO_LON` / `GEO_FLAG` | Room list location and flag |

## Commands

Public chat is rebroadcast as announcements colored by the sender's team (red, blue, or white for spectators). Messages starting with `!` are treated as commands and are not shown in public chat.

| Command | Description |
| --- | --- |
| `!help` | Private list of available commands. Room admins and sub-admins also see the hidden moderation commands |
| `!afk` | Toggle voluntary AFK (spectator, keep queue spot, skip field) |
| `!queue` | Private message with your visible queue position (or a notice if you are on the field or AFK) |
| `!admin <password>` | Grants room admin if the password matches `ADMIN_PASSWORD` |
| `!kick <id or name>` | Kicks a player (room admins and sub-admins). Listed in `!help` only for moderators |
| `!ban <id or name>` | Bans a player (room admins and sub-admins). The ban is keyed by auth: rejoining with the same client kicks them again immediately, until `!unban` or a server restart. Players without an auth string cannot be banned (use `!kick`). Listed in `!help` only for moderators |
| `!unban <name or auth>` | Lifts a ban (room admins and sub-admins). Matches banned players by name (exact, then partial) or auth prefix. `!unban list` (or `!unban` with no arguments) shows the banned players with their short auth. Listed in `!help` only for moderators |
| `!mute <id or name>` | Toggles chat mute for a player (room admins and sub-admins). Muted players stay muted if they rejoin with the same client (auth), until the server process restarts. Listed in `!help` only for moderators |

### Hidden commands

These are omitted from `!help` for regular players. Moderation commands appear in `!help` only for room admins and sub-admins:

| Command | Description |
| --- | --- |
| `!subadmin <password>` | Grants sub-admin (`admin: true` on the queue entry) if the password matches `SUBADMIN_PASSWORD`. Does **not** call `setPlayerAdmin`, so the player is not a visible room admin. Unlocks `!kick`, `!mute`, and `!priority`. Persisted by auth: rejoining with the same client restores sub-admin without re-entering the password (until the server process restarts). |
| `!priority <id or name>` | Room admins and sub-admins only. Toggles the target player in the caller's **priority list**: players on the list land on the **same team** as the caller in every pre-countdown reshuffle; everyone else stays random. Each moderator has an independent list; overlapping lists merge into one same-team group, and groups larger than a team are split to keep teams balanced. `!priority list` shows the caller's list (offline targets are shown by short auth) and `!priority clear` empties it. Lists are keyed by auth, so they survive rejoins; offline targets simply do not affect reshuffles until they return. Players without an auth string cannot use or be added to priority lists. Non-moderators get the regular "unknown command" reply, so the command stays invisible to them. |

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

## Discord bot

Optional. Create a bot in the [Discord developer portal](https://discord.com/developers/applications), copy its token into `DISCORD_BOT_TOKEN`, and invite it to your server (it needs permission to send messages in the target channels). On startup the bot connects and keeps its status as "Playing X/MAX_PLAYERS" with the current number of connected players, updated on every join and leave. If `DISCORD_CHAT_CHANNEL_ID` is set, every public HaxBall chat message (`name: text`) is also posted there; commands (`!…`), muted players, and private announcements are not mirrored. Mentions in game chat are stripped of Discord ping power. If `DISCORD_LOGS_CHANNEL_ID` is set, application logs can be posted there via `sendDiscordLog` (no log events are wired yet). Leave `DISCORD_BOT_TOKEN` empty to disable the bot.

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
| `yarn dev` | Run with `tsx watch` (recreates the HaxBall room on TS/locale/map changes) |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Run compiled `dist/index.js` |
| `./deploy.sh` | Docker build + print `docker run` with `.env` vars |
| `node scripts/matchE2E.ts <roomId\|link>` | Join bots and verify roster/map switching edge cases against a live room |

## Development notes

- Package manager: **Yarn**
- Language for code, file names, and docs: **English**
- Do not add comments inside source code
- Keep README and `.env.example` in sync when behavior or config changes
