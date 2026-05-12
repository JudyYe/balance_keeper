#!/usr/bin/env node
/**
 * Unit tests for Balance Keeper core logic.
 * Run: node test.js
 */

// === Copy core logic from app.js (no DOM dependencies) ===

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatMessage(date, items, memos, prevBalance) {
  const d = new Date(date + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  const itemTexts = items.map(it => `${it.label} ${Math.abs(it.amount)}`);
  let expr = String(prevBalance);
  let balance = prevBalance;
  for (const it of items) {
    if (it.amount < 0) expr += `-${Math.abs(it.amount)}`;
    else expr += `+${it.amount}`;
    balance += it.amount;
  }
  expr += `=${balance}`;
  let msg = `雨菲记账：${month}/${day} ${weekday}${itemTexts.join('，')}。${expr}`;
  msg += `\n余额：${balance}`;
  if (memos.length > 0) {
    msg += '\n备忘：';
    memos.forEach((m, i) => { msg += `\n${i + 1} ${m}`; });
  }
  return { message: msg, newBalance: balance };
}

function getCurrentBalance(logData) {
  let balance = 0;
  for (const entry of logData) {
    if (entry.type === 'init') balance = entry.balance;
    else if (entry.type === 'entry') balance = entry.new_balance;
  }
  return balance;
}

function getBalanceBefore(logData, date) {
  let balance = 0;
  for (const entry of logData) {
    if (entry.type === 'init') balance = entry.balance;
    else if (entry.type === 'entry' && entry.date < date) balance = entry.new_balance;
  }
  return balance;
}

function saveEntryToLog(logData, entry) {
  const newLogData = [...logData];
  const existingIdx = newLogData.findIndex(e => e.type === 'entry' && e.date === entry.date);
  if (existingIdx >= 0) {
    newLogData[existingIdx] = entry;
  } else {
    newLogData.push(entry);
  }
  return newLogData;
}

// === Test runner ===

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.log(`  FAIL: ${name}`);
  }
}

function assertEqual(actual, expected, name) {
  if (actual === expected) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    expected: ${expected}`);
    console.log(`    actual:   ${actual}`);
  }
}

// === Tests ===

console.log('\n=== formatMessage ===');

{
  const r = formatMessage('2025-04-19', [{label:'雨菲上课', amount:-180}], ['今日内容 推球跟封直线'], 742);
  assertEqual(r.newBalance, 562, 'simple lesson: balance');
  assert(r.message.includes('4/19'), 'simple lesson: date');
  assert(r.message.includes('雨菲上课 180'), 'simple lesson: item text');
  assert(r.message.includes('742-180=562'), 'simple lesson: expression');
  assert(r.message.includes('余额：562'), 'simple lesson: remaining balance line');
  assert(r.message.includes('1 今日内容 推球跟封直线'), 'simple lesson: memo');
}

{
  const r = formatMessage('2025-05-07', [
    {label:'雨菲上课 w/ Ashley', amount:-90},
    {label:'穿拍', amount:-18},
    {label:'充值', amount:900},
    {label:'Louis上课', amount:-200},
  ], ['今日内容 双打封网 后场进攻'], 202);
  assertEqual(r.newBalance, 794, 'multi-item: balance');
  assert(r.message.includes('202-90-18+900-200=794'), 'multi-item: expression');
  assert(r.message.includes('余额：794'), 'multi-item: remaining balance line');
  assert(r.message.includes('雨菲上课 w/ Ashley 90，穿拍 18，充值 900，Louis上课 200'), 'multi-item: item texts');
}

{
  const r = formatMessage('2025-04-30', [{label:'雨菲上课', amount:-180}], ['今日内容 中前场跟球封网', '穿拍 25磅～'], 382);
  assertEqual(r.newBalance, 202, 'multi-memo: balance');
  assert(r.message.includes('382-180=202'), 'multi-memo: expression');
  assert(r.message.includes('1 今日内容 中前场跟球封网'), 'multi-memo: memo 1');
  assert(r.message.includes('2 穿拍 25磅～'), 'multi-memo: memo 2');
}

{
  const r = formatMessage('2025-05-12', [{label:'雨菲上课', amount:-180}], [], 360);
  assertEqual(r.newBalance, 180, 'no memo: balance');
  assert(!r.message.includes('备忘'), 'no memo: no memo section');
  assert(r.message.includes('余额：180'), 'no memo: remaining balance');
}

{
  const r = formatMessage('2025-05-12', [{label:'充值', amount:500}], [], 100);
  assertEqual(r.newBalance, 600, 'credit only: balance');
  assert(r.message.includes('100+500=600'), 'credit only: expression shows +');
}

{
  const r = formatMessage('2025-05-12', [{label:'雨菲上课', amount:-180}], [], -50);
  assertEqual(r.newBalance, -230, 'negative balance: calc');
  assert(r.message.includes('-50-180=-230'), 'negative balance: expression');
  assert(r.message.includes('余额：-230'), 'negative balance: remaining line');
}

console.log('\n=== getCurrentBalance ===');

{
  assertEqual(getCurrentBalance([]), 0, 'empty log');
}
{
  const log = [{ type: 'init', balance: 742 }];
  assertEqual(getCurrentBalance(log), 742, 'init only');
}
{
  const log = [
    { type: 'init', balance: 742 },
    { type: 'entry', date: '2025-04-19', new_balance: 562 },
  ];
  assertEqual(getCurrentBalance(log), 562, 'init + one entry');
}
{
  const log = [
    { type: 'init', balance: 742 },
    { type: 'entry', date: '2025-04-19', new_balance: 562 },
    { type: 'entry', date: '2025-04-23', new_balance: 382 },
  ];
  assertEqual(getCurrentBalance(log), 382, 'init + two entries');
}

console.log('\n=== getBalanceBefore ===');

{
  assertEqual(getBalanceBefore([], '2025-05-12'), 0, 'empty log');
}
{
  const log = [{ type: 'init', balance: 742 }];
  assertEqual(getBalanceBefore(log, '2025-05-12'), 742, 'init only: returns init balance');
}
{
  const log = [
    { type: 'init', balance: 742 },
    { type: 'entry', date: '2025-04-19', new_balance: 562 },
  ];
  assertEqual(getBalanceBefore(log, '2025-04-19'), 742, 'before same date: excludes that date');
  assertEqual(getBalanceBefore(log, '2025-04-20'), 562, 'after entry date: includes entry');
  assertEqual(getBalanceBefore(log, '2025-04-18'), 742, 'before entry date: init only');
}
{
  const log = [
    { type: 'init', balance: 742 },
    { type: 'entry', date: '2025-04-19', new_balance: 562 },
    { type: 'entry', date: '2025-04-23', new_balance: 382 },
    { type: 'entry', date: '2025-04-30', new_balance: 202 },
  ];
  assertEqual(getBalanceBefore(log, '2025-04-23'), 562, 'middle date: balance from prior entry');
  assertEqual(getBalanceBefore(log, '2025-05-01'), 202, 'after all: last entry balance');
  assertEqual(getBalanceBefore(log, '2025-04-19'), 742, 'first entry date: init balance');
}
{
  // Resubmit scenario: entry for 4/23 already exists, resubmitting should use 4/19's balance
  const log = [
    { type: 'init', balance: 742 },
    { type: 'entry', date: '2025-04-19', new_balance: 562 },
    { type: 'entry', date: '2025-04-23', new_balance: 382 },
  ];
  assertEqual(getBalanceBefore(log, '2025-04-23'), 562, 'resubmit: prev_balance from day before, not current entry');
}

console.log('\n=== saveEntryToLog (date dedup) ===');

{
  const log = [{ type: 'init', balance: 742 }];
  const entry = { type: 'entry', date: '2025-04-19', new_balance: 562 };
  const result = saveEntryToLog(log, entry);
  assertEqual(result.length, 2, 'append: new entry added');
}
{
  const log = [
    { type: 'init', balance: 742 },
    { type: 'entry', date: '2025-04-19', new_balance: 562 },
  ];
  const entry = { type: 'entry', date: '2025-04-19', new_balance: 600 };
  const result = saveEntryToLog(log, entry);
  assertEqual(result.length, 2, 'overwrite: same length');
  assertEqual(result[1].new_balance, 600, 'overwrite: updated balance');
}
{
  const log = [
    { type: 'init', balance: 742 },
    { type: 'entry', date: '2025-04-19', new_balance: 562 },
    { type: 'entry', date: '2025-04-23', new_balance: 382 },
  ];
  const entry = { type: 'entry', date: '2025-04-19', new_balance: 500 };
  const result = saveEntryToLog(log, entry);
  assertEqual(result.length, 3, 'overwrite middle: same length');
  assertEqual(result[1].new_balance, 500, 'overwrite middle: updated');
  assertEqual(result[2].new_balance, 382, 'overwrite middle: other entry unchanged');
}

// === Full workflow test ===
console.log('\n=== Full workflow (init -> entries -> resubmit) ===');

{
  let log = [{ type: 'init', balance: 360 }];

  // Day 1: lesson
  const prev1 = getBalanceBefore(log, '2025-05-10');
  assertEqual(prev1, 360, 'workflow: prev before first entry');
  const r1 = formatMessage('2025-05-10', [{label:'雨菲上课', amount:-180}], ['今日内容 推球'], prev1);
  assertEqual(r1.newBalance, 180, 'workflow: day 1 balance');
  log = saveEntryToLog(log, { type:'entry', date:'2025-05-10', new_balance:r1.newBalance, message:r1.message });

  // Day 2: lesson + topup
  const prev2 = getBalanceBefore(log, '2025-05-12');
  assertEqual(prev2, 180, 'workflow: prev before day 2');
  const r2 = formatMessage('2025-05-12', [{label:'雨菲上课', amount:-180},{label:'充值', amount:500}], [], prev2);
  assertEqual(r2.newBalance, 500, 'workflow: day 2 balance');
  log = saveEntryToLog(log, { type:'entry', date:'2025-05-12', new_balance:r2.newBalance, message:r2.message });

  assertEqual(getCurrentBalance(log), 500, 'workflow: final balance');

  // Resubmit day 2 with different items
  const prev2b = getBalanceBefore(log, '2025-05-12');
  assertEqual(prev2b, 180, 'workflow: resubmit prev_balance unchanged');
  const r2b = formatMessage('2025-05-12', [{label:'雨菲上课', amount:-180},{label:'充值', amount:300}], [], prev2b);
  assertEqual(r2b.newBalance, 300, 'workflow: resubmit new balance');
  log = saveEntryToLog(log, { type:'entry', date:'2025-05-12', new_balance:r2b.newBalance, message:r2b.message });

  assertEqual(log.length, 3, 'workflow: resubmit did not add entry');
  assertEqual(getCurrentBalance(log), 300, 'workflow: final balance after resubmit');
}

// === Summary ===
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
