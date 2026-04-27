const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const animevost = require('../utils/animevost');
const shikimori = require('../utils/shikimori');

const userDataPath = app.getPath('userData');
const storePath = path.join(userDataPath, 'anilinux-store.json');

const store = {
  get: (key, defaultValue) => {
    try {
      if (fs.existsSync(storePath)) {
        const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
        return data[key] !== undefined ? data[key] : defaultValue;
      }
      return defaultValue;
    } catch (error) {
      console.error('Error reading store:', error);
      return defaultValue;
    }
  },
  set: (key, value) => {
    try {
      let data = {};
      if (fs.existsSync(storePath)) {
        data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      }
      data[key] = value;
      fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing store:', error);
    }
  },
  delete: (key) => {
    try {
      if (fs.existsSync(storePath)) {
        const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
        delete data[key];
        fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('Error deleting from store:', error);
    }
  }
};

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#36393F',
    frame: false
  });

  mainWindow.loadFile('src/renderer/index.html');
}

app.on('ready', () => {
  createWindow();

  // OAuth server for handling callback
  let oauthServer = null;

  // Handle OAuth login with automatic callback
  ipcMain.on('oauth-login', async (event) => {
    try {
      // Close existing server if any
      if (oauthServer) {
        oauthServer.close();
        oauthServer = null;
      }
      
      // Create a simple HTTP server to handle the callback
      oauthServer = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        console.log('OAuth server received request:', parsedUrl.pathname);
        
        if (parsedUrl.pathname === '/auth/shikimori/callback') {
          const code = parsedUrl.query.code;
          const error = parsedUrl.query.error;
          
          console.log('Code:', code, 'Error:', error);
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h1>Ошибка авторизации</h1><p>${error}</p></body></html>`);
            event.reply('oauth-error', { error: error });
            oauthServer.close();
            oauthServer = null;
            return;
          }
          
          if (code) {
            // Send success response with styling
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Авторизация успешна</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 100%;
        }
        .icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: bounce 1s ease infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 15px;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 25px;
        }
        .success-badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✅</div>
        <div class="success-badge">Успешно</div>
        <h1>Авторизация выполнена!</h1>
        <p>Вы успешно авторизовались через Shikimori. Теперь вы можете закрыть это окно и вернуться к приложению.</p>
    </div>
</body>
</html>
`);
            
            // Exchange code for token
            try {
              const accessToken = await shikimori.getAccessToken(code);
              const userInfo = await shikimori.getUserInfo(accessToken);
              
              console.log('User info received:', userInfo.nickname);
              
              // Store token and user info
              store.set('shikimori.accessToken', accessToken);
              store.set('shikimori.userInfo', userInfo);
              
              // Notify renderer
              event.reply('oauth-response', { success: true, username: userInfo.nickname });
              
              // Close server
              oauthServer.close();
              oauthServer = null;
            } catch (error) {
              console.error('Error exchanging code:', error);
              event.reply('oauth-error', { error: error.message });
              oauthServer.close();
              oauthServer = null;
            }
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Ошибка: код не найден</h1></body></html>');
            event.reply('oauth-error', { error: 'Код авторизации не найден' });
            oauthServer.close();
            oauthServer = null;
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      
      oauthServer.listen(3000, () => {
        console.log('OAuth server listening on port 3000');
        const authUrl = shikimori.getAuthUrl();
        console.log('Opening auth URL:', authUrl);
        shell.openExternal(authUrl);
        event.reply('oauth-info', { message: 'Откройте браузер для авторизации' });
      });
      
      oauthServer.on('error', (err) => {
        console.error('OAuth server error:', err);
        if (err.code === 'EADDRINUSE') {
          event.reply('oauth-error', { error: 'Порт 3000 уже занят' });
        } else {
          event.reply('oauth-error', { error: 'Не удалось запустить OAuth сервер' });
        }
        oauthServer = null;
      });
    } catch (error) {
      console.error('OAuth login error:', error);
      event.reply('oauth-error', { error: error.message });
    }
  });

  // Handle getting anime details
  ipcMain.on('get-anime-details', async (event, { animeId, link }) => {
    try {
      const details = await animevost.getAnimeDetails(animeId, link);
      event.reply('anime-details-response', details);
    } catch (error) {
      console.error('Error fetching anime details:', error);
      event.reply('anime-details-error', { error: error.message });
    }
  });

  // Handle OAuth logout
  ipcMain.on('oauth-logout', async (event) => {
    store.delete('shikimori.accessToken');
    store.delete('shikimori.userInfo');
    event.reply('oauth-logout-response', { success: true });
  });

  // Handle getting OAuth status
  ipcMain.on('oauth-status', async (event) => {
    const userInfo = store.get('shikimori.userInfo');
    const isConnected = !!userInfo;
    event.reply('oauth-status-response', { connected: isConnected, username: userInfo?.nickname });
  });

  // Handle getting anime list
  ipcMain.on('get-anime-list', async (event, { parser, page = 1 }) => {
    try {
      console.log('Fetching anime list with parser:', parser, 'page:', page);
      let animeList = [];
      
      if (parser === 'animevost') {
        animeList = await animevost.getAnimeList(page);
      } else if (parser === 'shikimori') {
        animeList = await shikimori.getAnimeList(page);
      }
      
      event.reply('anime-list-response', { animeList, page, hasMore: animeList.length > 0 });
    } catch (error) {
      console.error('Error fetching anime list:', error);
      event.reply('anime-list-error', { error: error.message });
    }
  });

  // Handle getting anime details
  ipcMain.on('get-anime-details', async (event, { animeId, link }) => {
    try {
      const details = await animevost.getAnimeDetails(animeId, link);
      event.reply('anime-details-response', details);
    } catch (error) {
      console.error('Error fetching anime details:', error);
      event.reply('anime-details-error', { error: error.message });
    }
  });

  // Handle fetching episode video URL
  ipcMain.on('get-episode-video-url', async (event, { ajaxId, episodeNum }) => {
    try {
      console.log('Fetching episode video URL for ajax ID:', ajaxId);
      const videoUrl = await animevost.getEpisodeVideoUrl(ajaxId, episodeNum);
      if (videoUrl) {
        event.reply('episode-video-url-response', { videoUrl });
      } else {
        event.reply('episode-video-url-error', { error: 'Не удалось получить URL видео' });
      }
    } catch (error) {
      console.error('Error fetching episode video URL:', error);
      event.reply('episode-video-url-error', { error: error.message });
    }
  });

  // Handle sync with Shikimori
  ipcMain.on('sync-episodes', async (event) => {
    try {
      const accessToken = store.get('shikimori.accessToken');
      if (!accessToken) {
        event.reply('sync-status', { success: false, error: 'Not logged in' });
        return;
      }
      
      const history = store.get('history', []);
      const result = await shikimori.syncEpisodes(accessToken, history);
      event.reply('sync-status', result);
    } catch (error) {
      console.error('Error syncing episodes:', error);
      event.reply('sync-status', { success: false, error: error.message });
    }
  });

  // Handle history operations
  ipcMain.on('get-history', async (event) => {
    const history = store.get('history', []);
    event.reply('history-response', history);
  });

  ipcMain.on('add-to-history', async (event, { anime }) => {
    const history = store.get('history', []);
    const existingIndex = history.findIndex(item => item.id === anime.id);
    
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1);
    }
    
    history.unshift({
      ...anime,
      watchedAt: new Date().toISOString()
    });
    
    store.set('history', history.slice(0, 100)); // Keep last 100 items
    event.reply('add-to-history-response', { success: true });
  });

  ipcMain.on('clear-history', async (event) => {
    store.delete('history');
    event.reply('clear-history-response', { success: true });
  });

  // Handle favorites operations
  ipcMain.on('get-favorites', async (event) => {
    const favorites = store.get('favorites', []);
    event.reply('favorites-response', favorites);
  });

  ipcMain.on('add-to-favorites', async (event, { anime }) => {
    const favorites = store.get('favorites', []);
    const exists = favorites.some(item => item.id === anime.id);
    
    if (!exists) {
      favorites.push(anime);
      store.set('favorites', favorites);
      event.reply('add-to-favorites-response', { success: true, added: true });
    } else {
      event.reply('add-to-favorites-response', { success: true, added: false });
    }
  });

  ipcMain.on('remove-from-favorites', async (event, { animeId }) => {
    const favorites = store.get('favorites', []);
    const filtered = favorites.filter(item => item.id !== animeId);
    store.set('favorites', filtered);
    event.reply('remove-from-favorites-response', { success: true });
  });

  ipcMain.on('clear-favorites', async (event) => {
    store.delete('favorites');
    event.reply('clear-favorites-response', { success: true });
  });

  // Handle settings operations
  ipcMain.on('get-settings', async (event) => {
    const settings = store.get('settings', {
      defaultParser: 'animevost'
    });
    event.reply('settings-response', settings);
  });

  ipcMain.on('save-settings', async (event, { settings }) => {
    store.set('settings', settings);
    event.reply('save-settings-response', { success: true });
  });

  // Handle playing episode with mpv
  ipcMain.on('play-episode', async (event, { videoUrl, title, resolution }) => {
    try {
      console.log('Playing episode with mpv:', videoUrl, 'resolution:', resolution);
      
      if (!videoUrl) {
        console.error('No video URL provided');
        event.reply('play-episode-error', { error: 'URL видео не указан' });
        return;
      }
      
      const mpvArgs = [
        videoUrl,
        `--title=${title || 'AniLinux'}`,
        '--volume=70',
        '--no-border'
      ];
      
      // Add resolution setting if provided
      if (resolution) {
        mpvArgs.push(`--vf=scale=${resolution}:-2`);
      }
      
      console.log('mpv args:', mpvArgs);
      
      const mpvProcess = spawn('mpv', mpvArgs, {
        detached: true,
        stdio: 'ignore'
      });
      
      mpvProcess.on('error', (err) => {
        console.error('mpv spawn error:', err);
        event.reply('play-episode-error', { error: 'mpv не установлен или не найден. Установите: sudo pacman -S mpv' });
      });
      
      mpvProcess.unref();
      
      console.log('mpv started successfully');
      event.reply('play-episode-response', { success: true });
    } catch (error) {
      console.error('Error playing episode:', error);
      event.reply('play-episode-error', { error: error.message });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});