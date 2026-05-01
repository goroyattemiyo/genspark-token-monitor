document.addEventListener('DOMContentLoaded', () => {
  const limitInput = document.getElementById('limitInput');
  const saveBtn = document.getElementById('saveBtn');
  const savedMsg = document.getElementById('savedMsg');

  chrome.storage.local.get(['tokenLimit'], (result) => {
    if (result.tokenLimit) limitInput.value = result.tokenLimit;
  });

  saveBtn.addEventListener('click', () => {
    const limit = parseInt(limitInput.value, 10);
    if (!limit || limit < 1000) return;

    chrome.storage.local.set({ tokenLimit: limit }, () => {
      savedMsg.style.display = 'block';
      setTimeout(() => { savedMsg.style.display = 'none'; }, 1500);
    });
  });
});
