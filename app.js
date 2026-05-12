// === Version ===
const VERSION = 'v0.3.0';

// === Constants ===
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const PRESETS = [
  { label: '雨菲上课', amount: 180, type: 'debit' },
  { label: '穿拍', amount: 18, type: 'debit' },
  { label: '充值', amount: '', type: 'credit' },
];

// === Config (localStorage) ===
function getConfig(key) { return localStorage.getItem('bk_' + key) || ''; }
function setConfig(key, val) { localStorage.setItem('bk_' + key, val); }

// === GitHub API ===
function utf8ToBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
function base64ToUtf8(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))); }

// On localhost, route through our proxy server (needed for HTTPS_PROXY)
// On GitHub Pages, call api.github.com directly
function apiBase() {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return '/api/github';
  return 'https://api.github.com';
}

async function githubGet(path) {
  const owner = getConfig('owner');
  const repo = getConfig('repo');
  const token = getConfig('token');
  const url = `${apiBase()}/repos/${owner}/${repo}/contents/${path}`;
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    throw new Error(`网络错误: 无法连接 GitHub API (${e.message})`);
  }
  if (res.status === 404) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${data.message || 'unknown error'}`);
  return data;
}

async function githubPut(path, content, sha, msg) {
  const owner = getConfig('owner');
  const repo = getConfig('repo');
  const token = getConfig('token');
  const url = `${apiBase()}/repos/${owner}/${repo}/contents/${path}`;
  const body = { message: msg, content: utf8ToBase64(content) };
  if (sha) body.sha = sha;
  let res;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`网络错误: 无法连接 GitHub API (${e.message})`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${data.message || 'unknown error'}`);
  return data;
}

// === Data Layer ===
let logData = [];
let logSha = null;

async function loadLog() {
  const file = await githubGet('data/log.json');
  if (!file) {
    logData = [];
    logSha = null;
    return;
  }
  logSha = file.sha;
  logData = JSON.parse(base64ToUtf8(file.content));
}

function getCurrentBalance() {
  let balance = 0;
  for (const entry of logData) {
    if (entry.type === 'init') balance = entry.balance;
    else if (entry.type === 'entry') balance = entry.new_balance;
  }
  return balance;
}

// Balance as of just before a given date (excludes that date's entry)
function getBalanceBefore(date) {
  let balance = 0;
  for (const entry of logData) {
    if (entry.type === 'init') balance = entry.balance;
    else if (entry.type === 'entry' && entry.date < date) balance = entry.new_balance;
  }
  return balance;
}

async function saveEntry(entry) {
  // Defensive: refresh sha if missing
  if (!logSha) await loadLog();

  // Date-based dedup: overwrite existing entry for same date
  const newLogData = [...logData];
  const existingIdx = newLogData.findIndex(e => e.type === 'entry' && e.date === entry.date);
  if (existingIdx >= 0) {
    newLogData[existingIdx] = entry;
  } else {
    newLogData.push(entry);
  }
  const content = JSON.stringify(newLogData, null, 2);
  const result = await githubPut('data/log.json', content, logSha, `entry: ${entry.date}`);
  // Only update state after successful API call
  logData = newLogData;
  logSha = result.content.sha;
}

async function initLog(startingBalance) {
  // Ensure we have the current sha (file may already exist)
  if (!logSha) await loadLog();
  const newLogData = [{ type: 'init', balance: startingBalance, timestamp: new Date().toISOString() }];
  const content = JSON.stringify(newLogData, null, 2);
  const result = await githubPut('data/log.json', content, logSha, `init: balance ${startingBalance}`);
  // Only update state after successful API call
  logData = newLogData;
  logSha = result.content.sha;
}

async function resetLog(startingBalance) {
  await initLog(startingBalance);
}

// === Connection Test ===
async function testConnection() {
  const owner = getConfig('owner');
  const repo = getConfig('repo');
  const token = getConfig('token');
  if (!token || !owner || !repo) return '请先填写 Token、Owner、Repo';
  try {
    const res = await fetch(
      `${apiBase()}/repos/${owner}/${repo}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) return 'Token 无效或已过期';
    if (res.status === 403) return 'Token 权限不足';
    if (res.status === 404) return `仓库 ${owner}/${repo} 不存在或无权限`;
    if (res.ok) return 'OK';
    return `GitHub ${res.status}`;
  } catch (e) {
    return `网络错误: ${e.message}`;
  }
}

// === Message Formatter ===
function formatMessage(date, items, memos, prevBalance) {
  const d = new Date(date + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];

  // Item texts: "label amount" joined by Chinese comma
  const itemTexts = items.map(it => `${it.label} ${Math.abs(it.amount)}`);

  // Balance expression: prev-item1-item2+topup=new
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

// === UI: Item & Memo Rows ===
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function createItemRow(preset) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" class="item-label" placeholder="项目名称" value="${preset ? escapeHtml(preset.label) : ''}">
    <input type="number" class="item-amount" placeholder="金额" value="${preset && preset.amount ? preset.amount : ''}">
    <select class="item-type">
      <option value="debit">支出</option>
      <option value="credit">充值</option>
    </select>
    <button class="remove-btn" onclick="this.parentElement.remove(); updatePreview();">&times;</button>
  `;
  if (preset && preset.type === 'credit') row.querySelector('.item-type').value = 'credit';
  row.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', updatePreview);
    el.addEventListener('change', updatePreview);
  });
  return row;
}

function createMemoRow(text) {
  const row = document.createElement('div');
  row.className = 'memo-row';
  row.innerHTML = `
    <input type="text" class="memo-input" placeholder="备忘内容" value="${escapeHtml(text || '')}">
    <button class="remove-btn" onclick="this.parentElement.remove(); updatePreview();">&times;</button>
  `;
  const input = row.querySelector('input');
  input.addEventListener('input', updatePreview);
  input.addEventListener('change', updatePreview);
  return row;
}

function addItemRow(preset) {
  document.getElementById('items-container').appendChild(createItemRow(preset));
  updatePreview();
}

function addMemoRow(text) {
  document.getElementById('memos-container').appendChild(createMemoRow(text));
  updatePreview();
}

// === UI: Form Data ===
function getFormData() {
  const date = document.getElementById('entry-date').value;
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const label = row.querySelector('.item-label').value.trim();
    const amount = parseFloat(row.querySelector('.item-amount').value) || 0;
    const type = row.querySelector('.item-type').value;
    if (label && amount > 0) {
      items.push({ label, amount: type === 'credit' ? amount : -amount });
    }
  });
  const memos = [];
  document.querySelectorAll('.memo-row').forEach(row => {
    const text = row.querySelector('.memo-input').value.trim();
    if (text) memos.push(text);
  });
  return { date, items, memos };
}

function updatePreview() {
  const { date, items, memos } = getFormData();
  const prevBalance = date ? getBalanceBefore(date) : 0;

  // Update weekday
  if (date) {
    const d = new Date(date + 'T00:00:00');
    document.getElementById('entry-weekday').textContent = WEEKDAYS[d.getDay()];
  }

  if (!date || items.length === 0) {
    document.getElementById('preview-text').textContent = '(填写项目后预览)';
    return;
  }
  const { message } = formatMessage(date, items, memos, prevBalance);
  document.getElementById('preview-text').textContent = message;
}

function updateBalanceDisplay() {
  const balance = getCurrentBalance();
  const lastEntry = [...logData].reverse().find(e => e.type === 'entry');
  if (lastEntry) {
    const d = lastEntry.date.slice(5).replace('-', '/');
    document.getElementById('balance-display').textContent = `余额: ${balance} (${d})`;
  } else {
    document.getElementById('balance-display').textContent = `余额: ${balance}`;
  }
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const entries = logData.filter(e => e.type === 'entry').reverse();
  if (entries.length === 0) {
    list.innerHTML = '<p class="muted">暂无记录</p>';
    return;
  }
  list.innerHTML = entries.map(e =>
    `<div class="history-entry">${escapeHtml(e.message).replace(/\n/g, '<br>')}</div>`
  ).join('');
}

function resetForm() {
  document.getElementById('items-container').innerHTML = '';
  document.getElementById('memos-container').innerHTML = '';
  addItemRow(PRESETS[0]);
  addMemoRow('今日内容 ');
  document.getElementById('entry-date').value = todayStr();
  updatePreview();
}

// === Actions ===
async function handleSendAndSave() {
  const { date, items, memos } = getFormData();
  const prevBalance = getBalanceBefore(date);

  if (!date || items.length === 0) {
    alert('请填写日期和至少一个项目');
    return;
  }

  const { message, newBalance } = formatMessage(date, items, memos, prevBalance);
  const entry = {
    type: 'entry',
    id: `${date}`,
    date,
    weekday: WEEKDAYS[new Date(date + 'T00:00:00').getDay()],
    items,
    memos,
    prev_balance: prevBalance,
    new_balance: newBalance,
    message,
    timestamp: new Date().toISOString(),
  };

  const btn = document.getElementById('btn-send');
  btn.disabled = true;
  btn.textContent = '保存中...';

  try {
    await saveEntry(entry);
    updateBalanceDisplay();
    renderHistory();
    resetForm();

    btn.textContent = '已保存';
    setTimeout(() => {
      triggerShortcut(message);
      btn.textContent = '发送 & 保存';
      btn.disabled = false;
    }, 300);
  } catch (err) {
    alert('保存失败: ' + err.message);
    btn.textContent = '发送 & 保存';
    btn.disabled = false;
  }
}

function handleCopy() {
  const text = document.getElementById('preview-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy');
    btn.textContent = '已复制';
    setTimeout(() => { btn.textContent = '复制'; }, 2000);
  });
}

function triggerShortcut(message) {
  // Only trigger on iOS (Shortcuts app doesn't exist on desktop)
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!isIOS) return;
  const encoded = encodeURIComponent(message);
  window.location.href = `shortcuts://run-shortcut?name=SendBalance&input=text&text=${encoded}`;
}

// === Settings ===
function toggleSettings() {
  document.getElementById('settings-panel').classList.toggle('hidden');
}

function loadSettingsUI() {
  document.getElementById('cfg-token').value = getConfig('token');
  document.getElementById('cfg-owner').value = getConfig('owner');
  document.getElementById('cfg-repo').value = getConfig('repo');
  document.getElementById('cfg-phone').value = getConfig('phone');
}

function saveSettingsUI() {
  setConfig('token', document.getElementById('cfg-token').value.trim());
  setConfig('owner', document.getElementById('cfg-owner').value.trim());
  setConfig('repo', document.getElementById('cfg-repo').value.trim());
  setConfig('phone', document.getElementById('cfg-phone').value.trim());
}

async function handleSaveSettings() {
  saveSettingsUI();
  // Test connection before closing settings
  const status = document.getElementById('cfg-status');
  status.textContent = '测试连接...';
  status.className = '';
  const result = await testConnection();
  if (result === 'OK') {
    status.textContent = '连接成功';
    status.className = 'status-ok';
    toggleSettings();
    await loadData();
  } else {
    status.textContent = result;
    status.className = 'status-err';
  }
}

async function handleInit() {
  // Must save settings first
  if (!getConfig('token') || !getConfig('owner') || !getConfig('repo')) {
    alert('请先点击 "保存 & 测试连接"');
    return;
  }
  // Only allow init once
  if (logData.some(e => e.type === 'init')) {
    alert('已初始化。如需重新设置余额，请使用 重置 Reset。');
    return;
  }
  const balance = parseFloat(document.getElementById('cfg-init-balance').value);
  if (isNaN(balance)) { alert('请输入起始余额'); return; }
  try {
    await initLog(balance);
    updateBalanceDisplay();
    renderHistory();
    updatePreview();
    alert(`初始化完成，余额: ${balance}`);
  } catch (err) {
    alert('初始化失败: ' + err.message);
  }
}

async function handleReset() {
  if (!getConfig('token') || !getConfig('owner') || !getConfig('repo')) {
    alert('请先点击 "保存 & 测试连接"');
    return;
  }
  if (!confirm('确定要清空所有记录？此操作不可撤销。')) return;
  const balance = parseFloat(document.getElementById('cfg-init-balance').value);
  if (isNaN(balance)) { alert('请输入新的起始余额'); return; }
  try {
    await resetLog(balance);
    updateBalanceDisplay();
    renderHistory();
    updatePreview();
    alert(`已重置，余额: ${balance}`);
  } catch (err) {
    alert('重置失败: ' + err.message);
  }
}

// === Init ===
function todayStr() { return new Date().toISOString().slice(0, 10); }

async function loadData() {
  if (!getConfig('token') || !getConfig('owner') || !getConfig('repo')) {
    document.getElementById('balance-display').textContent = '余额: -- (请先设置)';
    return;
  }
  try {
    await loadLog();
    updateBalanceDisplay();
    renderHistory();
    updatePreview();
  } catch (err) {
    document.getElementById('balance-display').textContent = `余额: -- (${err.message})`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  loadSettingsUI();

  // Default date
  document.getElementById('entry-date').value = todayStr();
  document.getElementById('entry-date').addEventListener('change', updatePreview);

  // Default rows
  addItemRow(PRESETS[0]);
  addMemoRow('今日内容 ');

  // Buttons
  document.getElementById('settings-btn').addEventListener('click', toggleSettings);
  document.getElementById('cfg-save').addEventListener('click', handleSaveSettings);
  document.getElementById('add-memo').addEventListener('click', () => addMemoRow());
  document.getElementById('btn-send').addEventListener('click', handleSendAndSave);
  document.getElementById('btn-copy').addEventListener('click', handleCopy);
  document.getElementById('cfg-init').addEventListener('click', handleInit);
  document.getElementById('cfg-reset').addEventListener('click', handleReset);

  // Preset quick-add buttons
  PRESETS.forEach(p => {
    const btn = document.getElementById(`preset-${p.type === 'credit' ? 'topup' : p.label === '穿拍' ? 'string' : 'lesson'}`);
    if (btn) btn.addEventListener('click', () => addItemRow(p));
  });
  document.getElementById('preset-custom').addEventListener('click', () => addItemRow());

  // Version display
  document.getElementById('version-footer').textContent = VERSION;

  await loadData();
});
