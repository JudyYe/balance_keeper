# Engineer Documentation

## Architecture

```
GitHub Pages (static HTML/JS/CSS)
        |
        v
GitHub API (repos/contents)
        |
        v
data/log.json (in this repo)
```

No server. The static site reads/writes `data/log.json` directly via the GitHub Contents API.
User settings (token, repo info) are stored in the browser's localStorage.

## File Structure

```
index.html        — single-page app
app.js            — all logic (formatter, GitHub API, UI)
style.css         — mobile-first responsive styles
data/log.json     — append-only transaction log
README.md         — user-facing workflow guide
docs/engineer.md  — this file
research/         — planning & design docs
```

## Data Model

`data/log.json` is a JSON array of entries:

### Init entry
```json
{
  "type": "init",
  "balance": 742,
  "timestamp": "2025-04-19T10:00:00.000Z"
}
```

### Transaction entry
```json
{
  "type": "entry",
  "id": "2025-04-19-001",
  "date": "2025-04-19",
  "weekday": "周日",
  "items": [
    {"label": "雨菲上课", "amount": -180},
    {"label": "充值", "amount": 900}
  ],
  "memos": ["今日内容 推球跟封直线"],
  "prev_balance": 742,
  "new_balance": 562,
  "message": "雨菲记账：4/19 周日雨菲上课 180。742-180=562\n备忘：\n1 今日内容 推球跟封直线",
  "timestamp": "2025-04-19T20:00:00.000Z"
}
```

**Amounts**: negative = debit (money out), positive = credit (money in).

**Balance**: computed by walking the log. `init` sets the starting balance; each `entry` updates via `new_balance`.

## GitHub API Usage

- **Read**: `GET /repos/{owner}/{repo}/contents/data/log.json` — returns base64 content + SHA
- **Write**: `PUT /repos/{owner}/{repo}/contents/data/log.json` — sends new base64 content + current SHA + commit message
- **Auth**: `Authorization: Bearer {token}` — fine-grained PAT with `contents: read+write` on this repo

The SHA is required for updates (optimistic concurrency). The app tracks it in memory after each read/write.

## Message Format Spec

```
雨菲记账：{M}/{D} {weekday}{item1 amount1}[，{item2 amount2}...]。{balance_expr}
[备忘：
1 {memo1}
2 {memo2}
...]
```

**Balance expression**: `{prev}[-{debit}][+{credit}]...={new}`

Example: `202-90-18+900-200=794`

## iMessage Integration

The "Send" button triggers an iOS Shortcut via URL scheme:

```
shortcuts://run-shortcut?name=SendBalance&input=text&text={url_encoded_message}
```

The Shortcut (`SendBalance`) receives the text and sends it as an iMessage to the configured phone number. This is the only way to auto-send iMessages from a web app — Apple provides no direct iMessage API.

Fallback: the "Copy" button copies the formatted text to the clipboard.

## Init / Reset

- **Init**: creates `data/log.json` with a single `init` entry (sets starting balance)
- **Reset**: overwrites `data/log.json` with a fresh `init` entry (clears history). Git history preserves old data.

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `bk_token` | GitHub personal access token |
| `bk_owner` | GitHub repo owner |
| `bk_repo` | GitHub repo name |
| `bk_phone` | Coach's phone number |
