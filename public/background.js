// Background service worker for the extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Music Detector extension installed');
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    chrome.tabCapture.capture(
      { audio: true, video: false },
      (stream) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse({ success: true });
      }
    );
    return true; // Keep channel open for async response
  }
});
