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

async function githubGet(path) {
  const res = await fetch(
    `https://api.github.com/repos/${getConfig('owner')}/${getConfig('repo')}/contents/${path}`,
    { headers: { Authorization: `Bearer ${getConfig('token')}` } }
  );
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.message) throw new Error(data.message);
  return data;
}

async function githubPut(path, content, sha, msg) {
  const body = { message: msg, content: utf8ToBase64(content) };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${getConfig('owner')}/${getConfig('repo')}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${getConfig('token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'GitHub API error');
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

async function saveEntry(entry) {
  logData.push(entry);
  const content = JSON.stringify(logData, null, 2);
  const result = await githubPut('data/log.json', content, logSha, `entry: ${entry.date}`);
  logSha = result.content.sha;
}

async function initLog(startingBalance) {
  logData = [{ type: 'init', balance: startingBalance, timestamp: new Date().toISOString() }];
  const content = JSON.stringify(logData, null, 2);
  const result = await githubPut('data/log.json', content, logSha, `init: balance ${startingBalance}`);
  logSha = result.content.sha;
}

async function resetLog(startingBalance) {
  await initLog(startingBalance);
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
  if (memos.length > 0) {
    msg += '\n备忘：';
    memos.forEach((m, i) => { msg += `\n${i + 1} ${m}`; });
  }

  return { message: msg, newBalance: balance };
}

// === UI: Item & Memo Rows ===
function createItemRow(preset) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" class="item-label" placeholder="项目名称" value="${preset ? preset.label : ''}">
    <input type="number" class="item-amount" placeholder="金额" value="${preset && preset.amount ? preset.amount : ''}">
    <select class="item-type">
      <option value="debit">支出</option>
      <option value="credit">充值</option>
    </select>
    <button class="remove-btn" onclick="this.parentElement.remove(); updatePreview();">&times;</button>
  `;
  if (preset && preset.type === 'credit') row.querySelector('.item-type').value = 'credit';
  row.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updatePreview));
  row.querySelector('.item-type').addEventListener('change', updatePreview);
  return row;
}

function createMemoRow(text) {
  const row = document.createElement('div');
  row.className = 'memo-row';
  row.innerHTML = `
    <input type="text" class="memo-input" placeholder="备忘内容" value="${text || ''}">
    <button class="remove-btn" onclick="this.parentElement.remove(); updatePreview();">&times;</button>
  `;
  row.querySelector('input').addEventListener('input', updatePreview);
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
  const prevBalance = getCurrentBalance();

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
  document.getElementById('balance-display').textContent = `余额: ${getCurrentBalance()}`;
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const entries = logData.filter(e => e.type === 'entry').reverse();
  if (entries.length === 0) {
    list.innerHTML = '<p class="muted">暂无记录</p>';
    return;
  }
  list.innerHTML = entries.map(e =>
    `<div class="history-entry">${e.message.replace(/\n/g, '<br>')}</div>`
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
  const prevBalance = getCurrentBalance();

  if (!date || items.length === 0) {
    alert('请填写日期和至少一个项目');
    return;
  }

  const { message, newBalance } = formatMessage(date, items, memos, prevBalance);
  const entry = {
    type: 'entry',
    id: `${date}-${String(logData.length).padStart(3, '0')}`,
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

  await saveEntry(entry);
  updateBalanceDisplay();
  renderHistory();
  resetForm();

  btn.textContent = '已保存';
  // Trigger iMessage after a brief pause so UI updates are visible
  setTimeout(() => {
    triggerShortcut(message);
    btn.textContent = '发送 & 保存';
    btn.disabled = false;
  }, 300);
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

async function handleInit() {
  const balance = parseFloat(document.getElementById('cfg-init-balance').value);
  if (isNaN(balance)) { alert('请输入起始余额'); return; }
  await initLog(balance);
  updateBalanceDisplay();
  renderHistory();
  alert('初始化完成');
}

async function handleReset() {
  if (!confirm('确定要清空所有记录？此操作不可撤销。')) return;
  const balance = parseFloat(document.getElementById('cfg-init-balance').value);
  if (isNaN(balance)) { alert('请输入新的起始余额'); return; }
  await resetLog(balance);
  updateBalanceDisplay();
  renderHistory();
  alert('已重置');
}

// === Init ===
function todayStr() { return new Date().toISOString().slice(0, 10); }

async function loadData() {
  if (!getConfig('token') || !getConfig('owner') || !getConfig('repo')) {
    document.getElementById('balance-display').textContent = '余额: -- (请先设置)';
    return;
  }
  await loadLog();
  updateBalanceDisplay();
  renderHistory();
  updatePreview();
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
  document.getElementById('cfg-save').addEventListener('click', () => {
    saveSettingsUI();
    toggleSettings();
    loadData();
  });
  document.getElementById('add-item').addEventListener('click', () => addItemRow());
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

  await loadData();
});
