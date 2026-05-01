const TOKEN_LIMIT_DEFAULT = 100000;
const SERVICE = location.hostname === 'claude.ai' ? 'claude' : 'codex';
const SELECTORS = {
  claude: {
    user: 'p.whitespace-pre-wrap.break-words',
    ai: 'p[class*="font-claude-response-body"], div[class*="font-claude-response-body"]'
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
  let inputText = '';
  let outputText = '';
  document.querySelectorAll(selector.user).forEach(el => { inputText += el.innerText + ' '; });
  document.querySelectorAll(selector.ai).forEach(el => { outputText += el.innerText + ' '; });
  return {
    inputTokens: estimateTokens(inputText),
    outputTokens: estimateTokens(outputText)
  };
}

function addDrag(overlay) {
  let isDragging = false;
  let startX, startY, origX, origY;
  overlay.style.cursor = 'move';
  overlay.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = overlay.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    overlay.style.left = (origX + dx) + 'px';
    overlay.style.top = (origY + dy) + 'px';
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });
}

function createOverlay() {
  if (document.getElementById('ai-token-monitor')) return;
  const overlay = document.createElement('div');
  overlay.id = 'ai-token-monitor';
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 230px;
    background: rgba(15, 15, 26, 0.93);
    color: #e0e0e0;
    border: 1px solid #444;
    border-radius: 10px;
    padding: 12px 14px;
    font-family: monospace;
    font-size: 12px;
    z-index: 999999;
    line-height: 1.6;
    user-select: none;
  `;
  const badge = SERVICE === 'claude' ? '🟠 CLAUDE' : '🟢 CODEX';
  overlay.innerHTML = `
    <div style="font-size:11px;color:#888;margin-bottom:6px;letter-spacing:1px;">⚡ AI TOKEN MONITOR</div>
    <div style="font-size:11px;color:#aaa;margin-bottom:8px;">${badge}</div>
    <div style="margin-bottom:4px;">Input: <span id="atm-input">0</span></div>
    <div style="background:#222;border-radius:4px;height:6px;margin-bottom:8px;">
      <div id="atm-input-gauge" style="height:6px;border-radius:4px;background:#4a9eff;width:0%;transition:width 0.3s;"></div>
    </div>
    <div style="margin-bottom:4px;">Output: <span id="atm-output">0</span></div>
    <div style="background:#222;border-radius:4px;height:6px;margin-bottom:8px;">
      <div id="atm-output-gauge" style="height:6px;border-radius:4px;background:#a78bfa;width:0%;transition:width 0.3s;"></div>
    </div>
    <div style="margin-bottom:4px;">Total: <span id="atm-total">0</span></div>
    <div style="background:#222;border-radius:4px;height:6px;margin-bottom:8px;">
      <div id="atm-total-gauge" style="height:6px;border-radius:4px;background:#4ade80;width:0%;transition:width 0.3s;"></div>
    </div>
    <div id="atm-warning" style="display:none;font-size:11px;margin-top:4px;"></div>
  `;
  document.body.appendChild(overlay);
  addDrag(overlay);
}

function updateOverlay(inputTokens, outputTokens) {
  chrome.storage.local.get(['tokenLimit'], (result) => {
    const limit = result.tokenLimit || TOKEN_LIMIT_DEFAULT;
    const total = inputTokens + outputTokens;
    const inputPct = Math.min((inputTokens / limit) * 100, 100);
    const outputPct = Math.min((outputTokens / limit) * 100, 100);
    const totalPct = Math.min((total / limit) * 100, 100);

    document.getElementById('atm-input').textContent = inputTokens.toLocaleString();
    document.getElementById('atm-output').textContent = outputTokens.toLocaleString();
    document.getElementById('atm-total').textContent = total.toLocaleString();

    const getColor = (pct) => pct >= 95 ? '#ef4444' : pct >= 80 ? '#fbbf24' : null;
    document.getElementById('atm-input-gauge').style.width = inputPct + '%';
    document.getElementById('atm-output-gauge').style.width = outputPct + '%';
    document.getElementById('atm-total-gauge').style.width = totalPct + '%';
    if (getColor(totalPct)) document.getElementById('atm-total-gauge').style.background = getColor(totalPct);

    const warning = document.getElementById('atm-warning');
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
