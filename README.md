# Balance Keeper 记账

Track badminton lesson balance and send formatted text messages to your coach.

## Setup

### 1. GitHub Pages

This site is hosted at: `https://JudyYe.github.io/balance_keeper/`

### 2. First-time app setup

1. Open the site on your phone
2. Tap the gear icon (top right)
3. Enter:
   - **GitHub Token**: your personal access token
   - **Repo Owner**: `JudyYe`
   - **Repo Name**: `balance_keeper`
   - **Coach Phone**: your coach's phone number
4. Tap **Save**

### 3. Initialize balance

1. In Settings, enter your current balance in **Starting Balance**
2. Tap **Init**

### 4. iOS Shortcut (for auto-send)

Create a Shortcut on your iPhone:

1. Open the **Shortcuts** app
2. Tap **+** to create a new shortcut
3. Name it: **SendBalance**
4. Add action: **Send Message**
   - To: your coach's phone number
   - Body: tap "Shortcut Input" (this receives the message text)
5. Save

## Daily Workflow

After each training session:

1. Open the site on your phone
2. Date is auto-filled to today
3. Tap **+ 上课** (lesson) — amount pre-fills to 180
4. Add more items if needed: **+ 穿拍** (stringing), **+ 充值** (top-up), **+ 自定义** (custom)
5. Add memo lines (training content, notes)
6. Check the **Preview** — edit items if anything looks wrong
7. Tap **发送 & 保存** — saves to GitHub and auto-sends via iMessage

If auto-send doesn't trigger, tap **复制 Copy** and paste into Messages manually.

## Message Format

```
雨菲记账：5/11 周日雨菲上课 180。562-180=382
备忘：
1 今日内容 推球跟封直线
```

## Reset

To start over with a new balance:
1. Open Settings (gear icon)
2. Enter new starting balance
3. Tap **Reset** (clears all history)
