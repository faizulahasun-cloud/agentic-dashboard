# Agentic Dashboard

A crystal-glass daily dashboard for [Obsidian](https://obsidian.md): a video hero with a live clock, quick capture to your Inbox, today's tasks, a monthly calendar, vault stats, meetings, recent notes and your Inbox — all in one custom view.

**No Dataview, no Templater, no other plugins required.** Works on desktop and mobile. Agent-agnostic: point its folder settings at any vault layout — it doesn't care which agent or workflow feeds your notes.

## Features

- ✦ **Hero banner** — animated video (or poster image) with your live clock and today's date / ISO week
- ＋ **Quick capture** — send thoughts, ideas, reflections, books, articles to your Inbox folder with one Enter press; chips pick the note type
- **Tasks today** — open tasks from today's daily note plus every task across the vault that is due today or overdue (📅 / ⏳ / 🛫 emoji dates), click to toggle done
- **Calendar** — Monday-start month view, dots on days with a daily note, click any day to open/create that daily note
- **At a glance** — notes, open tasks, done tasks, inbox count, today's meetings, files modified in the last 7 days
- **Meetings today** — notes in the meetings folder whose frontmatter `date` is today
- **Recent notes** — 7 most recently modified notes
- **Inbox** — 10 newest captures with their type tag
- **Auto-refresh** — the dashboard updates when your vault changes
- **Open at startup** — automatically opens when Obsidian starts (toggle in settings)
- **Agent & automation actions** — official Obsidian CLI commands (`obsidian agentic-dashboard:add-task text="..."`) plus `obsidian://agentic-dashboard` URI actions; agents and scripts can drive the vault with no extra plugin or server

## Install

1. Open **Settings → Community plugins** and make sure Restricted mode is off
2. **Browse**, search for **Agentic Dashboard**, install and enable
3. Click the ✦ sparkles ribbon icon or run **"Open Agentic Dashboard"** from the command palette

### Manual install

Download `manifest.json`, `main.js` and `styles.css` from the latest release into
`<vault>/.obsidian/plugins/agentic-dashboard/`, then enable the plugin in settings.

## Configuration (Settings → Agentic Dashboard)

| Setting | Default | What it does |
| --- | --- | --- |
| Open dashboard at startup | on | Auto-opens the dashboard when Obsidian starts |
| --- | --- | --- |
| Journal folder | `Journal` | Where `YYYY-MM-DD.md` daily notes live |
| Inbox folder | `Inbox` | Where quick captures are stored |
| Meetings folder | `Meetings` | Where new meetings are created |
| Hero video path | *(empty)* | Video behind the hero (empty → gradient) |
| Poster (desktop / mobile) | *(empty)* | Fallback image when there is no video |
| Max tasks shown | `18` | Cap for the Tasks today card |
| Auto refresh | `60` s | Background refresh interval (0 = off) |

Point the three folder settings at any folders in your vault and the dashboard adapts to your layout. Daily notes, meetings and captures are created with sensible frontmatter (`type`, `date`, `time`, `tag`) so they stay Dataview-friendly.

## Agent & automation actions

Any agent, script or shortcut can drive the vault — no extra plugin or server needed. Two native channels are built in:

### Obsidian CLI (desktop, Obsidian 1.12.7+)

Requires the Obsidian CLI to be enabled (**Settings → General → Command line interface**). Commands return text output, so agents get feedback directly:

| Command | What it does |
|---|---|
| `obsidian agentic-dashboard` | Opens the dashboard |
| `obsidian agentic-dashboard:add-task text="Call plumber"` | Appends `- [ ] Call plumber` to today's daily note (creates it if missing) |
| `obsidian agentic-dashboard:add-task text="Call plumber" date=2026-11-14` | Adds to that day's daily note |
| `obsidian agentic-dashboard:capture text="Read X" type=idea` | Creates an Inbox note (type: thought/idea/reflection/to-watch/book/article) |
| `obsidian agentic-dashboard:meeting title="Design review" time=14:30` | Creates a meeting note (time optional) |
| `obsidian agentic-dashboard:new-daily date=2026-11-14` | Creates (if missing) and opens that daily note |
| `obsidian agentic-dashboard:open-note path="folder/note.md"` | Opens that exact vault path |
| `obsidian agentic-dashboard:find-note query=dashboard` | Best-match search over note names, opens the winner |

Add `vault="<name>"` before the command to target a specific vault. Example:

```powershell
obsidian vault="Ai diary" agentic-dashboard:add-task text="Water the plants"
```

### obsidian:// URI (desktop & mobile)

The plugin registers `obsidian://agentic-dashboard?action=...` — useful for links inside notes, iOS Shortcuts, and environments without a terminal:

| Action | URL | What it does |
|---|---|---|
| Add task | `...?action=add-task&text=Call plumber` | Appends to today's daily note |
| Add task on a date | `...?action=add-task&text=Call plumber&date=2026-11-14` | Adds to that day's daily note |
| Capture to inbox | `...?action=capture&text=Read X&type=idea` | Creates an Inbox note |
| New meeting | `...?action=meeting&title=Design review&time=14:30` | Creates a meeting note |
| Daily note | `...?action=new-daily` (`&date=` optional) | Creates if missing and opens it |
| Open a note | `...?action=open-note&path=open code/Journal/2026-11-13.md` | Opens that exact vault path |
| Find a note | `...?action=find-note&query=dashboard` | Best-match search, opens the winner |
| Open dashboard | `...?action=open-dashboard` | Focuses the dashboard |

Base: `obsidian://agentic-dashboard?action=<action>&...`. Spaces in parameters should be URL-encoded (`%20`). URI actions confirm with an in-app notice.

Agents can also just write notes directly (plain file edits) — the dashboard listens to vault events and refreshes itself.

## Compatibility

Requires Obsidian **1.4.0+**. Works on desktop and mobile. Themes (like [Hermes Crystal](https://github.com/faizulahasun-cloud/hermes-crystal)) style it automatically; without a theme it uses its own built-in crystal-glass dark look.

## Companion theme: Hermes Crystal

The theme this dashboard was designed around is also a community theme: [Hermes Crystal](https://github.com/faizulahasun-cloud/hermes-crystal) — amethyst crystal-glass styling with a nebula background, matching the dashboard's look. It's optional: the dashboard ships with its own built-in crystal-glass dark look and works with any theme.

## License

[MIT](LICENSE) © 2026 Hermes
