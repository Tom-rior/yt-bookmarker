chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only send the message if the updated tab is fully loaded
  if (changeInfo.status === "complete" && tab.url && tab.url.includes("youtube.com/watch")) {
    const queryParameters = tab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);

    chrome.tabs.sendMessage(tabId, {
      type: "NEW",
      videoId: urlParameters.get("v"),
    }).catch((error) => {
        // Silently ignore "Receiving end does not exist" errors
        // This happens if the content script hasn't loaded yet or the tab was closed
        if (chrome.runtime.lastError) {
            // Do nothing
        }
    });
  }
});