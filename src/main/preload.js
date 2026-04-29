const { ipcRenderer } = require('electron');

// Since contextIsolation is false, we can directly assign to window
window.electronAPI = {
  send: (channel, data) => {
    // whitelist channels
    const validChannels = [
      'oauth-login',
      'oauth-logout',
      'oauth-status',
      'get-anime-list',
      'get-anime-details',
      'get-episode-video-url',
      'sync-episodes',
      'play-episode',
      'get-history',
      'add-to-history',
      'clear-history',
      'get-favorites',
      'add-to-favorites',
      'remove-from-favorites',
      'clear-favorites',
      'get-settings',
      'save-settings',
      'get-anime-watch-progress'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    const validChannels = [
      'oauth-url',
      'oauth-info',
      'oauth-response',
      'oauth-error',
      'oauth-logout-response',
      'oauth-status-response',
      'anime-list-response',
      'anime-list-error',
      'anime-details-response',
      'anime-details-error',
      'episode-video-url-response',
      'episode-video-url-error',
      'sync-status',
      'play-episode-response',
      'play-episode-error',
      'history-response',
      'add-to-history-response',
      'clear-history-response',
      'favorites-response',
      'add-to-favorites-response',
      'remove-from-favorites-response',
      'clear-favorites-response',
      'settings-response',
      'save-settings-response',
      'anime-watch-progress-response'
    ];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
};