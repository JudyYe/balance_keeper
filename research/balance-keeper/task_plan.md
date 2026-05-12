# Task Plan: Balance Keeper

## Goal
Build a GitHub Pages static site (vanilla HTML/JS) for tracking badminton lesson balance, generating formatted Chinese text messages, with data persisted to this GitHub repo and iMessage auto-send via iOS Shortcut.

## Architecture
```
Phone browser → GitHub Pages (static HTML/JS)
                    ↓ read/write
              GitHub repo JSON file (via GitHub API)
                    = append-only log + balance state

"Send" button → shortcuts:// URL → iOS Shortcut → iMessage to coach
```

## Current Phase
Phase 1 (Discussion — finalizing plan)

## Phases

### Phase 1: Requirements & Discussion
- [x] Analyze sketch.md and extract requirements
- [x] Research iMessage integration options
- [x] Resolve open questions with user
- [x] Finalize architecture: GitHub Pages + repo storage
- **Status:** complete

### Phase 2: Core Logic (JavaScript)
- [ ] Message formatter: Chinese text with balance calculation
- [ ] Balance calculator: chain from previous entry
- [ ] Item types: lesson (debit), stringing (debit), topup (credit), custom label
- [ ] Chinese weekday mapping
- **Status:** pending

### Phase 3: Data Layer (GitHub API)
- [ ] Read entries from repo JSON file via GitHub API
- [ ] Write new entry: commit to repo via GitHub API
- [ ] GitHub token handling (stored in localStorage, entered once)
- [ ] Compute current balance from log on load
- [ ] **Init/Reset**: initialize `data/log.json` (empty array + optional starting balance)
- [ ] **Reset**: clear log and set a new starting balance (with confirmation prompt)
- **Status:** pending

### Phase 4: Web UI (vanilla HTML/JS)
- [ ] Form: date picker (default today), dynamic item rows (add/remove)
- [ ] Each item row: label (dropdown + custom), amount, credit/debit toggle
- [ ] Memo: dynamic text rows (add/remove), free-form
- [ ] Auto-fill: today's date, Chinese weekday
- [ ] Preview panel: formatted Chinese message text
- [ ] Edit flow: modify form fields → preview updates live
- [ ] Current balance display
- [ ] History view (past entries)
- [ ] Settings panel: token, repo, phone number, init/reset controls
- **Status:** pending

### Phase 5: iMessage Integration (iOS Shortcut)
- [ ] Create iOS Shortcut: receive text input → send iMessage to coach number
- [ ] "Send" button on web UI: triggers `shortcuts://run-shortcut?name=...&input=text&text=...`
- [ ] Fallback: copy-to-clipboard button if not on iPhone
- [ ] Test phone number: 4124031931
- **Status:** pending

### Phase 6: Documentation
- [ ] README.md: user-facing workflow guide (setup, daily usage, iOS Shortcut setup)
- [ ] docs/engineer.md: implementation details, architecture, data model, API usage
- **Status:** pending

### Phase 7: Deploy & Test
- [ ] Enable GitHub Pages on this repo
- [ ] Test full flow: form → preview → save to repo → send via Shortcut
- [ ] Test with real message formats from sketch.md
- [ ] Test send to 4124031931
- [ ] Edge cases: multiple items, credits + debits mixed
- [ ] Mobile UI check (phone is primary device for this)
- **Status:** pending

## Resolved Questions

| # | Answer |
|---|--------|
| Q1 | Vanilla HTML/JS (static site, no Python server) |
| Q2 | Auto-send via iOS Shortcut |
| Q3 | GitHub Pages (accessible from phone anywhere) |
| Q4 | Single user only |
| Q5 | JSON file in repo (git history = audit trail) |
| Q6 | Multiple memo lines, free-form text |
| Q7 | GitHub Pages solves the network problem |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| GitHub Pages static site | Free hosting, accessible from phone, no server needed |
| Repo JSON file as storage | Append-only log with git history as audit trail |
| GitHub API for read/write | Static site can read/write repo files via API |
| Vanilla JS, no framework | Minimal complexity for a single-page form app |
| iOS Shortcut for iMessage | Only way to auto-send; triggered via shortcuts:// URL scheme |
| No reply-threading | Not possible via any Apple API |
| Test phone: 4124031931 | User-provided test number |
| README = user guide, docs/engineer.md = implementation | Clean separation of audience |

## File Structure (planned)
```
balance_keeper/
  index.html          — main app (single page)
  style.css           — styling (mobile-first)
  app.js              — form logic, preview, GitHub API, Shortcut trigger
  data/log.json       — append-only entry log (committed via API)
  README.md           — user-facing workflow guide
  docs/engineer.md    — implementation details
  research/           — planning files
```

## Data Model (planned)
```json
// data/log.json — array of entries
[
  {
    "id": "2025-04-19-001",
    "date": "2025-04-19",
    "weekday": "周日",
    "items": [
      {"label": "雨菲上课", "amount": -180}
    ],
    "memos": ["今日内容 推球跟封直线"],
    "prev_balance": 742,
    "new_balance": 562,
    "message": "雨菲记账：4/19 周日雨菲上课 180。742-180=562\n备忘：\n1 今日内容 推球跟封直线",
    "timestamp": "2025-04-19T20:00:00+08:00"
  }
]
```

## Notes
- Message format: `雨菲记账：{M}/{D} {weekday}{items}。{balance_expr}`
- Chinese weekdays: 周一 周二 周三 周四 周五 周六 周日
- Items in message: comma-separated, debits shown as positive numbers, credits as 充值{amount}
- Balance expression: `{prev}{-item1}{-item2}{+topup}={new}`
- shortcuts:// URL has a length limit — long messages may need clipboard fallback
- Init/Reset: settings panel allows initializing log with a starting balance or clearing all data
