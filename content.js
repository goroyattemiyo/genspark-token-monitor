const TOKEN_LIMIT_DEFAULT = 100000;
const SERVICE = location.hostname === 'claude.ai' ? 'claude' : 'codex';

const SELECTORS = {
  claude: {
    user: 'div.whitespace-pre-wrap.break-words',
    ai: 'div[class*="font-claude-response-body"]'
  },
  codex: {
    user: 'div.px-4.text-sm.break-words.whitespace-pre-wrap',
    ai: 'div[class*="markdown"][class*="prose"]'
  }
};

function estimateTokens(text) {
  if (!text) return 0;
  let count = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if ((code >= 0x3000 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7af)) {
      count += 1;
    } else {
      count += 0.25;
    }
  }
  return Math.ceil(count);
}

function collectMessages() {
  const selector = SELECTORS[SERVICE];
  const inputText = Array.from(document.querySelectorAll(selector.user))
    .map((el) => el.innerText)
    .join(' ');
  const outputText = Array.from(document.querySelectorAll(selector.ai))
    .map((el) => el.innerText)
    .join(' ');

  return {
    inputTokens: estimateTokens(inputText),
    outputTokens: estimateTokens(outputText)
  };
}

function createOverlay() {
  if (document.getElementById('ai-token-monitor')) return;

  const overlay = document.createElement('div');
  overlay.id = 'ai-token-monitor';
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 240px;
    background: rgba(20, 20, 30, 0.94);
    color: #e0e0e0;
    border: 1px solid #444;
    border-radius: 10px;
    padding: 12px 14px;
    font-family: monospace;
    font-size: 12px;
    z-index: 999999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    user-select: none;
  `;

  const serviceLabel = SERVICE === 'claude' ? 'CLAUDE' : 'CODEX';

  overlay.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="font-size:11px; color:#888;">⚡ AI Token Monitor</span>
      <span style="font-size:10px; padding:2px 6px; border-radius:999px; background:#2b2b3c; color:#9cc0ff;">${serviceLabel}</span>
    </div>
    ${renderBar('入力', 'input', '#4a9eff')}
    ${renderBar('出力', 'output', '#a78bfa')}
    <div style="border-top:1px solid #333; margin:8px 0 6px;"></div>
    ${renderBar('合計', 'total', '#4ade80')}
    <div id="tm-warning" style="margin-top:6px; font-size:11px; display:none;"></div>
    <div style="margin-top:6px; font-size:10px; color:#666;">Limit: <span id="tm-limit">100,000</span></div>
  `;

  document.body.appendChild(overlay);
}

function renderBar(label, key, color) {
  return `
    <div style="margin-bottom:6px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
        <span>${label}</span><span id="tm-${key}-count">0</span>
      </div>
      <div style="background:#333; border-radius:3px; height:6px;">
        <div id="tm-${key}-gauge" style="height:6px; border-radius:3px; background:${color}; width:0%; transition:width 0.3s;"></div>
      </div>
    </div>
  `;
}

function getColor(pct) {
  if (pct >= 95) return '#ef4444';
  if (pct >= 80) return '#fbbf24';
  return '#4a9eff';
}

function updateOverlay(inputTokens, outputTokens) {
  chrome.storage.local.get(['tokenLimit'], (result) => {
    const limit = result.tokenLimit || TOKEN_LIMIT_DEFAULT;
    const totalTokens = inputTokens + outputTokens;

    const inputPct = Math.min((inputTokens / limit) * 100, 100);
    const outputPct = Math.min((outputTokens / limit) * 100, 100);
    const totalPct = Math.min((totalTokens / limit) * 100, 100);

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const setGauge = (id, pct) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.width = `${pct}%`;
        el.style.background = getColor(pct);
      }
    };

    setText('tm-input-count', inputTokens.toLocaleString());
    setText('tm-output-count', outputTokens.toLocaleString());
    setText('tm-total-count', totalTokens.toLocaleString());
    setText('tm-limit', limit.toLocaleString());

    setGauge('tm-input-gauge', inputPct);
    setGauge('tm-output-gauge', outputPct);
    setGauge('tm-total-gauge', totalPct);

    const warning = document.getElementById('tm-warning');
    if (!warning) return;

    if (totalPct >= 95) {
      warning.style.display = 'block';
      warning.style.color = '#ef4444';
      warning.textContent = '🚨 制限まであとわずか！';
    } else if (totalPct >= 80) {
      warning.style.display = 'block';
      warning.style.color = '#fbbf24';
      warning.textContent = '⚠️ トークン使用量が多くなっています';
    } else {
      warning.style.display = 'none';
    }
  });
}

function run() {
  createOverlay();
  const { inputTokens, outputTokens } = collectMessages();
  updateOverlay(inputTokens, outputTokens);
}

let debounceTimer;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 300);
});

run();
setTimeout(() => {
  observer.observe(document.body, { childList: true, subtree: true });
}, 2000);
