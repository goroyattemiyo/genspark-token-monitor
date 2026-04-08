document.addEventListener('DOMContentLoaded', () => {
  const limitInput = document.getElementById('limitInput');
  const saveBtn = document.getElementById('saveBtn');
  const savedMsg = document.getElementById('savedMsg');

  // 保存済みの値を読み込む
  chrome.storage.sync.get(['tokenLimit'], (result) => {
    if (result.tokenLimit) {
      limitInput.value = result.tokenLimit;
    }
  });

  // 保存ボタン
  saveBtn.addEventListener('click', () => {
    const limit = parseInt(limitInput.value, 10);
    if (!limit || limit < 1000) return;

    chrome.storage.sync.set({ tokenLimit: limit }, () => {
      savedMsg.style.display = 'block';
      setTimeout(() => {
        savedMsg.style.display = 'none';
      }, 2000);
    });
  });
});
