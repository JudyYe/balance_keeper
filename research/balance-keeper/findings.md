# Findings & Decisions

## Requirements (from sketch.md)

- Track lesson balance with badminton coach via text messages
- Format: Chinese text like "雨菲记账：4/19 周日雨菲上课 180。742-180=562"
- Each message includes: date, day-of-week, line items, balance calculation, memo
- Multiple items per entry (lesson, stringing, top-up, other students' lessons)
- Desired workflow: form input -> preview -> edit -> send via iMessage
- Append-only log file
- Single user (yufei)

## Message Format Analysis

Simple (one item):
```
雨菲记账：4/19 周日雨菲上课 180。742-180=562
备忘：
1 今日内容 推球跟封直线
```

Complex (multiple items):
```
雨菲记账：5/7 周四雨菲上课 w/ Ashley 90，穿拍18，充值900，Louis上课200。202-90-18+900-200=794
备忘：
1 今日内容 双打封网 后场进攻
```

Pattern:
- Header: `雨菲记账：{M}/{D} {weekday}` + comma-separated items with amounts
- Balance: `{prev}{operations}={new}`
- Debits: shown as `-amount` in formula
- Credits (充值): shown as `+amount` in formula
- Memo: numbered lines, free-form

## Architecture: GitHub Pages + Repo Storage

- Static site on GitHub Pages (index.html + app.js + style.css)
- Data in `data/log.json` committed to repo via GitHub API
- GitHub personal access token stored in browser localStorage (entered once)
- iOS Shortcut receives text via `shortcuts://` URL, sends iMessage

## GitHub API Notes

- Read file: `GET /repos/{owner}/{repo}/contents/{path}`
- Update file: `PUT /repos/{owner}/{repo}/contents/{path}` (needs SHA of current file)
- Auth: `Authorization: Bearer {token}` header
- Token needs `repo` scope (or `public_repo` if public)

## iOS Shortcut Design

- Name: "SendBalance" (or similar)
- Input: text (the formatted message)
- Action: Send Message to coach's phone number
- Trigger: `shortcuts://run-shortcut?name=SendBalance&input=text&text={url_encoded_message}`
- Caveat: URL length limit (~2000 chars). Long messages may need clipboard fallback.

## Resources

- Project repo: balance_keeper (to be initialized as git repo + pushed to GitHub)
- GitHub API docs: https://docs.github.com/en/rest/repos/contents
- Shortcuts URL scheme: https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624431f21/ios
