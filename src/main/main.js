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

  // Handle watch progress operations
  ipcMain.on('get-watch-progress', async (event) => {
    const watchProgress = store.get('watchProgress', {});
    event.reply('watch-progress-response', watchProgress);
  });

  ipcMain.on('save-watch-progress', async (event, { animeId, episodeNum, position }) => {
    const watchProgress = store.get('watchProgress', {});
    const episodeKey = `${animeId}_ep${episodeNum}`;
    watchProgress[episodeKey] = position;
    store.set('watchProgress', watchProgress);
    event.reply('save-watch-progress-response', { success: true });
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

  // Handle getting anime watch progress
  ipcMain.on('get-anime-watch-progress', async (event, { animeId, animeTitle }) => {
    console.log('get-anime-watch-progress IPC received with animeId:', animeId, 'animeTitle:', animeTitle);
    
    const watchProgress = store.get('watchProgress', {});
    const history = store.get('history', []);
    
    // Get all episode progress for this anime
    const animeProgress = {};
    Object.keys(watchProgress).forEach(key => {
      if (key.startsWith(`${animeId}_ep`)) {
        const episodeNum = parseInt(key.replace(`${animeId}_ep`, ''));
        animeProgress[episodeNum] = watchProgress[key];
      }
    });
    
    console.log('Local watch progress for anime', animeId, ':', animeProgress);
    
    // Get last watched episode from history
    const historyItem = history.find(item => item.id === animeId);
    const lastEpisode = historyItem?.lastEpisode || null;
    
    // Try to get progress from Shikimori if logged in
    const accessToken = store.get('shikimori.accessToken');
    let shikimoriProgress = null;
    if (accessToken) {
      try {
        console.log('Fetching Shikimori user rates...');
        const userRates = await shikimori.getUserAnimeList(accessToken);
        console.log('Shikimori user rates count:', userRates.length);
        
        // Try to match by anime ID first
        let animeRate = userRates.find(rate => {
          const rateAnimeId = rate.anime?.id;
          const rateTargetId = rate.target_id;
          return rateAnimeId === animeId || rateTargetId === animeId;
        });
        
        // If not found by ID, try to match by title
        if (!animeRate && animeTitle) {
          console.log('Trying to match by title:', animeTitle);
          const normalizedTitle = animeTitle.toLowerCase().replace(/[^a-zа-я0-9\s]/g, '');
          
          animeRate = userRates.find(rate => {
            const rateTitle = rate.anime?.name || '';
            const normalizedRateTitle = rateTitle.toLowerCase().replace(/[^a-zа-я0-9\s]/g, '');
            return normalizedRateTitle.includes(normalizedTitle) || normalizedTitle.includes(normalizedRateTitle);
          });
          
          if (animeRate) {
            console.log('Matched by title:', animeRate.anime?.name);
          }
        }
        
        if (animeRate) {
          shikimoriProgress = {
            episodes: animeRate.episodes,
            status: animeRate.status,
            animeId: animeRate.anime?.id,
            targetId: animeRate.targetId,
            animeName: animeRate.anime?.name
          };
          console.log('Shikimori progress for anime', animeId, ':', shikimoriProgress);
        } else {
          console.log('No Shikimori progress found for anime ID:', animeId, 'or title:', animeTitle);
        }
      } catch (error) {
        console.error('Error getting Shikimori progress:', error);
      }
    } else {
      console.log('Not logged in to Shikimori');
    }
    
    console.log('Sending anime-watch-progress-response');
    event.reply('anime-watch-progress-response', { 
      progress: animeProgress, 
      lastEpisode,
      shikimoriProgress
    });
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
  ipcMain.on('play-episode', async (event, { videoUrl, title, resolution, animeId, episodeNum }) => {
    try {
      console.log('Playing episode with mpv:', videoUrl, 'resolution:', resolution, 'animeId:', animeId, 'episodeNum:', episodeNum);
      
      if (!videoUrl) {
        console.error('No video URL provided');
        event.reply('play-episode-error', { error: 'URL видео не указан' });
        return;
      }
      
      // Create IPC socket path for mpv
      const ipcSocketPath = path.join(userDataPath, 'mpv-socket');
      
      // Remove old socket if exists
      if (fs.existsSync(ipcSocketPath)) {
        fs.unlinkSync(ipcSocketPath);
      }
      
      // Get saved watch progress for this episode
      const watchProgress = store.get('watchProgress', {});
      const episodeKey = `${animeId}_ep${episodeNum}`;
      const savedPosition = watchProgress[episodeKey] || 0;
      
      const mpvArgs = [
        videoUrl,
        `--title=${title || 'AniLinux'}`,
        '--volume=70',
        '--no-border',
        '--keep-open=no',
        `--input-ipc-server=${ipcSocketPath}`
      ];
      
      // Add start position if saved
      if (savedPosition > 0) {
        mpvArgs.push(`--start=${savedPosition}`);
      }
      
      // Add resolution setting if provided
      if (resolution) {
        mpvArgs.push(`--vf=scale=${resolution}:-2`);
      }
      
      console.log('mpv args:', mpvArgs);
      
      const mpvProcess = spawn('mpv', mpvArgs, {
        detached: true,
        stdio: 'ignore'
      });
      
      let lastPosition = 0;
      let positionInterval = null;
      
      // Wait for socket to be created, then connect to it
      const connectToSocket = () => {
        setTimeout(async () => {
          if (!fs.existsSync(ipcSocketPath)) {
            console.log('Socket not created yet, retrying...');
            connectToSocket();
            return;
          }
          
          try {
            const net = require('net');
            const client = net.createConnection({ path: ipcSocketPath });
            
            client.on('connect', () => {
              console.log('Connected to mpv IPC socket');
              
              // Request time position every 5 seconds
              positionInterval = setInterval(() => {
                try {
                  const command = JSON.stringify({ command: ['get_property', 'time-pos'] });
                  client.write(command + '\n');
                } catch (e) {
                  console.error('Error sending command to mpv:', e);
                }
              }, 5000);
              
              // Also request initial position
              const command = JSON.stringify({ command: ['get_property', 'time-pos'] });
              client.write(command + '\n');
            });
            
            client.on('data', (data) => {
              try {
                const response = JSON.parse(data.toString());
                if (response.data !== undefined && typeof response.data === 'number') {
                  lastPosition = response.data;
                  console.log('Current position:', lastPosition);
                }
              } catch (e) {
                // Ignore parse errors for incomplete JSON
              }
            });
            
            client.on('error', (err) => {
              console.error('IPC socket error:', err);
            });
            
            client.on('close', () => {
              console.log('IPC socket closed');
              if (positionInterval) {
                clearInterval(positionInterval);
              }
            });
          } catch (error) {
            console.error('Error connecting to mpv socket:', error);
          }
        }, 1000);
      };
      
      connectToSocket();
      
      // Save position when mpv exits
      mpvProcess.on('close', async (code) => {
        console.log('mpv closed with code:', code, 'last position:', lastPosition);
        
        // Clean up socket
        if (fs.existsSync(ipcSocketPath)) {
          try {
            fs.unlinkSync(ipcSocketPath);
          } catch (e) {
            console.error('Error removing socket:', e);
          }
        }
        
        // Clean up interval
        if (positionInterval) {
          clearInterval(positionInterval);
        }
        
        if (lastPosition > 0 && animeId && episodeNum) {
          const watchProgress = store.get('watchProgress', {});
          const episodeKey = `${animeId}_ep${episodeNum}`;
          watchProgress[episodeKey] = lastPosition;
          store.set('watchProgress', watchProgress);
          console.log('Saved watch progress:', episodeKey, '=', lastPosition);
          
          // Sync with Shikimori if logged in
          const accessToken = store.get('shikimori.accessToken');
          if (accessToken && code === 0) {
            try {
              console.log('Syncing episode', episodeNum, 'with Shikimori for anime', animeId);
              
              // Try to find matching Shikimori anime ID by title
              const userRates = await shikimori.getUserAnimeList(accessToken);
              let shikimoriAnimeId = animeId;
              
              // Try to match by title if direct ID doesn't work
              const matchedRate = userRates.find(rate => {
                const rateAnimeId = rate.anime?.id;
                const rateTargetId = rate.target_id;
                if (rateAnimeId === animeId || rateTargetId === animeId) {
                  shikimoriAnimeId = rateAnimeId || rateTargetId;
                  return true;
                }
                return false;
              });
              
              if (!matchedRate && title) {
                // Try to match by title
                const normalizedTitle = title.toLowerCase().replace(/[^a-zа-я0-9\s]/g, '');
                const titleMatchedRate = userRates.find(rate => {
                  const rateTitle = rate.anime?.name || '';
                  const normalizedRateTitle = rateTitle.toLowerCase().replace(/[^a-zа-я0-9\s]/g, '');
                  return normalizedRateTitle.includes(normalizedTitle) || normalizedTitle.includes(normalizedRateTitle);
                });
                
                if (titleMatchedRate) {
                  shikimoriAnimeId = titleMatchedRate.anime?.id || titleMatchedRate.target_id;
                  console.log('Matched by title:', title, '-> Shikimori ID:', shikimoriAnimeId);
                }
              }
              
              await shikimori.syncEpisodes(shikimoriAnimeId, episodeNum, accessToken, title);
              console.log('Shikimori sync successful for anime ID:', shikimoriAnimeId);
            } catch (error) {
              console.error('Error syncing with Shikimori:', error);
            }
          }
        }
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