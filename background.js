chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.url.includes("youtube.com/watch")) {
    const queryParameters = tab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);

    chrome.tabs.sendMessage(tabId, {
      type: "NEW",
      videoId: urlParameters.get("v"),
    }).catch((error) => {
        if (chrome.runtime.lastError) { /* ignore */ }
    });
  }
});

// Listen for sync requests from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SYNC_TO_NOTION") {
    handleNotionSync(request.bookmark, request.videoUrl)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleNotionSync(bookmark, videoUrl) {
  const { notionKey, notionDbId } = await chrome.storage.sync.get(['notionKey', 'notionDbId']);
  
  if (!notionKey || !notionDbId) {
    throw new Error("Notion API Key or Database ID missing in settings.");
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      parent: { database_id: notionDbId },
      properties: {
        "Title": {
          title: [{ text: { content: bookmark.desc } }]
        },
        "URL": {
          url: `${videoUrl}&t=${Math.floor(bookmark.time)}s`
        },
        "Timestamp": {
          rich_text: [{ text: { content: bookmark.desc.split("at ")[1] || "00:00:00" } }]
        }
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to sync to Notion");
  }

  return await response.json();
}