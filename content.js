// Genspark Token Monitor - Content Script

const TOKEN_LIMITS = {
  default: 100000
};

// トークン推定（日英混在対応）
function estimateTokens(text) {
  if (!text) return 0;
  let count = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // 日本語・中国語・韓国語
    if (code >= 0x3000 && code <= 0x9FFF) {
      count += 1;
    } else if (code >= 0xAC00 && code <= 0xD7AF) {
      count += 1;
    } else {
      count += 0.25; // 英数字は4文字で1トークン
    }
  }
  return Math.ceil(count);
}

// メッセージ収集
function collectMessages() {
  const inputTokens = { text: '', tokens: 0 };
  const outputTokens = { text: '', tokens: 0 };

  // 汎用セレクタ（後で調整可能）
  const userMessages = document.querySelectorAll(
    '[class*="user"], [class*="human"], [data-role="user"], [class*="message-user"]'
  );
  const aiMessages = document.querySelectorAll(
    '[class*="assistant"], [class*="ai-"], [data-role="assistant"], [class*="message-assistant"], [class*="bot"]'
  );

  userMessages.forEach(el => {
    inputTokens.text += el.innerText + ' ';
  });
  aiMessages.forEach(el => {
    outputTokens.text += el.innerText + ' ';
  });

  inputTokens.tokens = estimateTokens(inputTokens.text);
  outputTokens.tokens = estimateTokens(outputTokens.text);

  return { inputTokens, outputTokens };
}

// オーバーレイUI作成
function createOverlay() {
  const existing = document.getElementById('gspark-token-monitor');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'gspark-token-monitor';
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 220px;
    background: rgba(20, 20, 30, 0.92);
    color: #e0e0e0;
    border: 1px solid #444;
    border-radius: 10px;
    padding: 12px 14px;
    font-family: monospace;
    font-size: 12px;
    z-index: 999999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    cursor: pointer;
    user-select: none;
  `;

  overlay.innerHTML = `
    <div style="font-size:11px; color:#888; margin-bottom:6px;">⚡ Token Monitor</div>
    <div id="gspark-input-bar" style="margin-bottom:6px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
        <span>Input</span><span id="gspark-input-count">0</span>
      </div>
      <div style="background:#333; border-radius:3px; height:6px;">
        <div id="gspark-input-gauge" style="height:6px; border-radius:3px; background:#4a9eff; width:0%; transition:width 0.3s;"></div>
      </div>
    </div>
    <div id="gspark-output-bar">
      <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
        <span>Output</span><span id="gspark-output-count">0</span>
      </div>
      <div style="background:#333; border-radius:3px; height:6px;">
        <div id="gspark-output-gauge" style="height:6px; border-radius:3px; background:#a78bfa; width:0%; transition:width 0.3s;"></div>
      </div>
    </div>
    <div id="gspark-warning" style="margin-top:8px; font-size:11px; color:#fbbf24; display:none;"></div>
    <div style="margin-top:8px; font-size:10px; color:#555;">Limit: <span id="gspark-limit-display">100,000</span> tokens</div>
  `;

  document.body.appendChild(overlay);
}

// ゲージ更新
function updateOverlay(inputTokens, outputTokens) {
  chrome.storage.sync.get(['tokenLimit'], (result) => {
    const limit = result.tokenLimit || TOKEN_LIMITS.default;

    const inputEl = document.getElementById('gspark-input-count');
    const outputEl = document.getElementById('gspark-output-count');
    const inputGauge = document.getElementById('gspark-input-gauge');
    const outputGauge = document.getElementById('gspark-output-gauge');
    const warning = document.getElementById('gspark-warning');
    const limitDisplay = document.getElementById('gspark-limit-display');

    if (!inputEl) return;

    const inputPct = Math.min((inputTokens.tokens / limit) * 100, 100);
    const outputPct = Math.min((outputTokens.tokens / limit) * 100, 100);
    const totalPct = Math.min(((inputTokens.tokens + outputTokens.tokens) / limit) * 100, 100);

    inputEl.textContent = inputTokens.tokens.toLocaleString();
    outputEl.textContent = outputTokens.tokens.toLocaleString();
    limitDisplay.textContent = limit.toLocaleString();

    // ゲージ色変化
    const getColor = (pct) => {
      if (pct >= 95) return '#ef4444';
      if (pct >= 80) return '#fbbf24';
      return pct > 50 ? '#a78bfa' : '#4a9eff';
    };

    inputGauge.style.width = inputPct + '%';
    inputGauge.style.background = getColor(inputPct);
    outputGauge.style.width = outputPct + '%';
    outputGauge.style.background = getColor(outputPct);

    // 警告表示
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

// メイン処理
function run() {
  createOverlay();
  const { inputTokens, outputTokens } = collectMessages();
  updateOverlay(inputTokens, outputTokens);
}

// MutationObserverでDOM変化を監視
const observer = new MutationObserver(() => {
  run();
});

// 初回実行
run();

// 監視開始（少し遅延させてSPA読み込みを待つ）
setTimeout(() => {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}, 2000);
