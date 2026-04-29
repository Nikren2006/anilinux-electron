document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded');
  initializeApp();
  setupEventListeners();
  
  // Check if electronAPI is available
  if (window.electronAPI) {
    console.log('electronAPI is available');
    loadAnimeList();
    checkOAuthStatus();
  } else {
    console.error('electronAPI is not available');
    // Fallback: show sample data
    displayAnimeList(getSampleData());
  }
});

let currentAnime = null;
let currentView = 'home';
let currentPage = 1;
let isLoadingMore = false;
let hasMoreAnime = true;
let selectedResolution = '720';

function initializeApp() {
  document.querySelector('.sidebar-item[data-view="home"]').classList.add('active');
  
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', function() {
      const view = this.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  currentView = view;
  
  document.querySelectorAll('.sidebar-item').forEach(i => {
    i.classList.remove('active');
  });
  const activeItem = document.querySelector(`.sidebar-item[data-view="${view}"]`);
  if (activeItem) {
    activeItem.classList.add('active');
  }
  
  document.querySelectorAll('section').forEach(section => {
    section.style.display = 'none';
  });
  
  const parserSection = document.querySelector('.parser-section');
  if (parserSection) {
    parserSection.style.display = 'none';
  }
  
  switch(view) {
    case 'home':
      document.getElementById('homeSection').style.display = 'block';
      if (parserSection) {
        parserSection.style.display = 'block';
      }
      loadAnimeList();
      break;
    case 'history':
      document.getElementById('historySection').style.display = 'block';
      loadHistory();
      break;
    case 'favorites':
      document.getElementById('favoritesSection').style.display = 'block';
      loadFavorites();
      break;
    case 'settings':
      document.getElementById('settingsSection').style.display = 'block';
      loadSettings();
      break;
  }
}

function setupEventListeners() {
  const searchBar = document.querySelector('.search-bar');
  searchBar.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    filterAnimeList(searchTerm);
  });
  
  // Resolution selector
  const resolutionSelect = document.getElementById('resolutionSelect');
  if (resolutionSelect) {
    resolutionSelect.addEventListener('change', function() {
      selectedResolution = this.value;
      console.log('Selected resolution:', selectedResolution);
    });
  }
  
  window.electronAPI.receive('oauth-info', (data) => {
    console.log('OAuth info:', data.message);
    alert(data.message);
  });
  
  window.electronAPI.receive('oauth-response', (data) => {
    handleOAuthResponse(data);
  });
  
  window.electronAPI.receive('oauth-error', (data) => {
    alert('OAuth error: ' + data.error);
  });
  
  window.electronAPI.receive('anime-list-response', (data) => {
    console.log('Anime list fetched:', data);
    console.log('Page:', data.page, 'Has more:', data.hasMore, 'Anime count:', data.animeList.length);
    
    if (data.page === 1) {
      // First page, replace the list
      displayAnimeList(data.animeList);
    } else {
      // Subsequent pages, append to the list
      appendAnimeList(data.animeList);
    }
    hasMoreAnime = data.hasMore;
    isLoadingMore = false;
    console.log('Updated hasMoreAnime:', hasMoreAnime, 'isLoadingMore:', isLoadingMore);
  });
  
  window.electronAPI.receive('anime-list-error', (data) => {
    console.error('Error loading anime list:', data.error);
    document.querySelector('.anime-grid').innerHTML = '<div class="no-results">Ошибка загрузки</div>';
  });
  
  window.electronAPI.receive('anime-details-response', (data) => {
    displayAnimeDetails(data);
  });
  
  window.electronAPI.receive('anime-watch-progress-response', (data) => {
    console.log('Watch progress received:', data);
    window.currentAnimeWatchProgress = data.progress || {};
    window.currentAnimeLastEpisode = data.lastEpisode;
    window.currentShikimoriProgress = data.shikimoriProgress;
    updateEpisodesWatchStatus();
  });
  
  window.electronAPI.receive('anime-details-error', (data) => {
    console.error('Error loading anime details:', data.error);
    alert('Ошибка загрузки деталей аниме');
  });
  
  const parserSelector = document.querySelector('#parser-selector');
  parserSelector.addEventListener('change', function() {
    const selectedParser = this.value;
    loadAnimeList(selectedParser);
  });
  
  document.getElementById('backBtn')?.addEventListener('click', () => {
    switchView('home');
  });
  
  document.getElementById('favoriteBtn')?.addEventListener('click', toggleFavorite);
  
  document.getElementById('oauthLoginBtn')?.addEventListener('click', () => {
    window.electronAPI.send('oauth-login');
  });
  
  document.getElementById('oauthSubmitBtn')?.addEventListener('click', () => {
    const code = document.getElementById('oauthCode').value.trim();
    if (code) {
      window.electronAPI.send('oauth-callback', { code });
    } else {
      alert('Введите код авторизации');
    }
  });
  
  document.getElementById('oauthLogoutBtn')?.addEventListener('click', () => {
    window.electronAPI.send('oauth-logout');
  });
  
  window.electronAPI.receive('oauth-logout-response', () => {
    updateOAuthUI(false);
  });
  
  document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
    if (confirm('Очистить историю просмотра?')) {
      window.electronAPI.send('clear-history');
    }
  });
  
  document.getElementById('clearFavoritesBtn')?.addEventListener('click', () => {
    if (confirm('Очистить избранное?')) {
      window.electronAPI.send('clear-favorites');
    }
  });
  
  window.electronAPI.receive('clear-history-response', () => {
    loadHistory();
  });
  
  window.electronAPI.receive('clear-favorites-response', () => {
    loadFavorites();
  });
}

function loadAnimeList(parser = 'animevost', page = 1) {
  const animeGrid = document.querySelector('.anime-grid');
  if (!animeGrid) {
    console.error('Anime grid not found');
    return;
  }
  
  if (page === 1) {
    animeGrid.innerHTML = '<div class="loading">Загрузка...</div>';
    currentPage = 1;
    hasMoreAnime = true;
  }
  
  console.log('Sending get-anime-list IPC message with page:', page);
  window.electronAPI.send('get-anime-list', { parser, page });
  
  // Add timeout fallback only for first page
  if (page === 1) {
    setTimeout(() => {
      if (animeGrid.querySelector('.loading')) {
        console.log('Timeout reached, showing sample data');
        displayAnimeList(getSampleData());
      }
    }, 5000);
  }
  
  console.log('Loading anime list with parser:', parser);
}

function appendAnimeList(animeList) {
  const animeGrid = document.querySelector('.anime-grid');
  if (!animeGrid) return;
  
  // Remove loading indicator if exists
  const loadingIndicator = animeGrid.querySelector('.loading-more');
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
  
  // Get current index for animation
  const currentCards = animeGrid.querySelectorAll('.anime-card');
  const startIndex = currentCards.length;
  
  // Append new anime cards
  animeList.forEach((anime, index) => {
    const cardHTML = `
      <div class="anime-card fade-in" style="--i: ${startIndex + index};" data-id="${anime.id}" data-link="${anime.link || ''}">
        <img src="${anime.image}" alt="${anime.title}" class="anime-image">
        <div class="anime-info">
          <div class="anime-title">${anime.title}</div>
          ${anime.rating ? `<div class="anime-rating">★ ${anime.rating}</div>` : ''}
        </div>
      </div>
    `;
    
    animeGrid.insertAdjacentHTML('beforeend', cardHTML);
  });
  
  // Add click handlers to new cards
  const newCards = animeGrid.querySelectorAll('.anime-card');
  newCards.forEach((card, index) => {
    if (index >= startIndex) {
      card.addEventListener('click', function() {
        const animeId = parseInt(this.dataset.id);
        const link = this.dataset.link;
        const title = this.querySelector('.anime-title').textContent;
        const image = this.querySelector('.anime-image').src;
        
        currentAnime = { id: animeId, title, image, link };
        showAnimeDetails(animeId, link);
      });
    }
  });
  
  // Move sentinel to bottom
  let sentinel = document.querySelector('.scroll-sentinel');
  if (sentinel) {
    animeGrid.appendChild(sentinel);
  }
  
  // Add loading indicator at bottom if there might be more
  if (hasMoreAnime) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-more';
    loadingDiv.innerHTML = '<div class="loading-spinner"></div><p>Загрузка...</p>';
    animeGrid.appendChild(loadingDiv);
  }
}

function displayAnimeList(animeList) {
  const animeGrid = document.querySelector('.anime-grid');
  
  console.log('Displaying anime list:', animeList);
  
  if (!animeGrid) {
    console.error('Anime grid element not found');
    return;
  }
  
  animeGrid.innerHTML = '';
  
  if (!animeList || animeList.length === 0) {
    animeGrid.innerHTML = '<div class="no-results">Аниме не найдено</div>';
    return;
  }
  
  animeGrid.innerHTML = animeList.map((anime, index) => `
    <div class="anime-card fade-in" style="--i: ${index};" data-id="${anime.id}" data-link="${anime.link || ''}">
      <img src="${anime.image}" alt="${anime.title}" class="anime-image">
      <div class="anime-info">
        <div class="anime-title">${anime.title}</div>
        ${anime.rating ? `<div class="anime-rating">★ ${anime.rating}</div>` : ''}
      </div>
    </div>
  `).join('');
  
  console.log('Anime cards rendered:', animeList.length);
  
  document.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', function() {
      const animeId = parseInt(this.dataset.id);
      const link = this.dataset.link;
      const title = this.querySelector('.anime-title').textContent;
      const image = this.querySelector('.anime-image').src;
      
      currentAnime = { id: animeId, title, image, link };
      showAnimeDetails(animeId, link);
    });
  });
  
  // Add loading indicator at bottom if there might be more
  if (hasMoreAnime) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-more';
    loadingDiv.innerHTML = '<div class="loading-spinner"></div><p>Загрузка...</p>';
    animeGrid.appendChild(loadingDiv);
  }
  
  // Setup infinite scroll
  setupInfiniteScroll();
}

function setupInfiniteScroll() {
  console.log('Setting up infinite scroll');
  
  // Remove existing scroll listener if any
  window.removeEventListener('scroll', handleScroll);
  
  // Add scroll listener
  window.addEventListener('scroll', handleScroll);
  
  console.log('Scroll listener attached to window');
  
  // Also try IntersectionObserver as fallback
  setupIntersectionObserver();
}

function setupIntersectionObserver() {
  const animeGrid = document.querySelector('.anime-grid');
  if (!animeGrid) return;
  
  // Create a sentinel element at the bottom
  let sentinel = document.querySelector('.scroll-sentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.className = 'scroll-sentinel';
    sentinel.style.height = '100px';
    animeGrid.appendChild(sentinel);
  }
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        console.log('Sentinel intersected, loading more...');
        loadMoreAnime();
      }
    });
  }, {
    root: null,
    rootMargin: '200px',
    threshold: 0.1
  });
  
  observer.observe(sentinel);
  console.log('IntersectionObserver set up');
}

function handleScroll() {
  if (isLoadingMore || !hasMoreAnime) return;
  
  const animeGrid = document.querySelector('.anime-grid');
  if (!animeGrid) return;
  
  const scrollPosition = window.scrollY + window.innerHeight;
  const gridPosition = animeGrid.getBoundingClientRect().top + window.scrollY;
  const gridHeight = animeGrid.offsetHeight;
  const gridBottom = gridPosition + gridHeight;
  
  console.log('Scroll position:', scrollPosition, 'Grid bottom:', gridBottom, 'Diff:', gridBottom - scrollPosition);
  
  // Load more when user is within 200px of bottom
  if (scrollPosition >= gridBottom - 200) {
    console.log('Loading more anime...');
    loadMoreAnime();
  }
}

function loadMoreAnime() {
  if (isLoadingMore || !hasMoreAnime) {
    console.log('Cannot load more - isLoadingMore:', isLoadingMore, 'hasMoreAnime:', hasMoreAnime);
    return;
  }
  
  console.log('Loading more anime - current page:', currentPage);
  isLoadingMore = true;
  currentPage++;
  
  const parserSelector = document.querySelector('#parser-selector');
  const parser = parserSelector ? parserSelector.value : 'animevost';
  
  console.log('Calling loadAnimeList with parser:', parser, 'page:', currentPage);
  loadAnimeList(parser, currentPage);
}

function filterAnimeList(searchTerm) {
  const animeCards = document.querySelectorAll('.anime-card');
  
  animeCards.forEach(card => {
    const title = card.querySelector('.anime-title').textContent.toLowerCase();
    if (title.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

function showAnimeDetails(animeId, link) {
  console.log('showAnimeDetails called with animeId:', animeId, 'link:', link, 'currentAnime:', currentAnime);
  
  document.querySelectorAll('section').forEach(section => {
    section.style.display = 'none';
  });
  document.querySelector('.parser-section').style.display = 'none';
  document.getElementById('animeDetailsSection').style.display = 'block';
  
  // Load watch progress for this anime
  console.log('Sending get-anime-watch-progress with animeId:', animeId, 'animeTitle:', currentAnime?.title);
  window.electronAPI.send('get-anime-watch-progress', { animeId, animeTitle: currentAnime?.title });
  
  window.electronAPI.send('get-anime-details', { animeId, link });
}

function displayAnimeDetails(details) {
  console.log('Displaying anime details:', details);
  
  document.getElementById('animeDetailsCover').src = details.image;
  document.getElementById('animeDetailsTitle').textContent = details.title;
  document.getElementById('animeDetailsRating').textContent = details.rating ? `★ ${details.rating}` : 'Рейтинг не указан';
  document.getElementById('animeDetailsDescription').textContent = details.description;
  
  // Store episodes in currentAnime for playback
  currentAnime = {
    ...currentAnime,
    episodes: details.episodes
  };
  
  console.log('Episodes:', details.episodes);
  
  const episodesList = document.getElementById('episodesList');
  if (!details.episodes || details.episodes.length === 0) {
    episodesList.innerHTML = '<div class="no-results">Серии не найдены</div>';
  } else {
    episodesList.innerHTML = details.episodes.map(ep => `
      <div class="episode-item" data-episode-id="${ep.id}" data-url="${ep.url || ''}" data-ajax-id="${ep.ajaxId || ''}">
        <div class="episode-number">${ep.id}</div>
        <div class="episode-title">${ep.title}</div>
        <div class="episode-progress"></div>
      </div>
    `).join('');
  }
  
  document.querySelectorAll('.episode-item').forEach(item => {
    item.addEventListener('click', function() {
      const episodeId = parseInt(this.dataset.episodeId);
      const episodeUrl = this.dataset.url;
      const episodeAjaxId = this.dataset.ajaxId;
      playEpisode(episodeId, episodeUrl, episodeAjaxId);
    });
  });
  
  updateFavoriteButton();
  
  // Update watch status if progress data is already loaded
  if (window.currentAnimeWatchProgress) {
    updateEpisodesWatchStatus();
  }
}

function playEpisode(episodeId, episodeUrl, episodeAjaxId) {
  console.log('Playing episode:', episodeId, 'url:', episodeUrl, 'ajaxId:', episodeAjaxId);
  
  if (currentAnime) {
    window.electronAPI.send('add-to-history', { anime: { ...currentAnime, lastEpisode: episodeId } });
    
    // Store current playing episode for video URL response
    window.currentPlayingEpisode = episodeId;
    
    // Mark current episode as watched
    document.querySelectorAll('.episode-item').forEach(item => {
      const itemEpisodeId = parseInt(item.dataset.episodeId);
      if (itemEpisodeId === episodeId) {
        item.classList.add('watched');
      }
    });
    
    // Use provided URL/AjaxId or get from episodes array
    let finalUrl = episodeUrl;
    let finalAjaxId = episodeAjaxId;
    
    if (!finalUrl && currentAnime.episodes) {
      const episodeData = currentAnime.episodes[episodeId - 1];
      if (episodeData) {
        finalUrl = episodeData.url;
        finalAjaxId = episodeData.ajaxId;
      }
    }
    
    console.log('Final URL:', finalUrl, 'Final Ajax ID:', finalAjaxId);
    
    if (finalUrl) {
      // If it's an ajax URL, we need to fetch the actual video URL
      if (finalUrl.startsWith('ajax:')) {
        console.log('Fetching video URL for ajax episode');
        window.electronAPI.send('get-episode-video-url', { 
          ajaxId: finalAjaxId, 
          episodeNum: episodeId.toString() 
        });
      } else {
        // Play directly with mpv
        console.log('Sending play-episode IPC with URL:', finalUrl);
        window.electronAPI.send('play-episode', {
          videoUrl: finalUrl,
          title: currentAnime.title,
          resolution: selectedResolution,
          animeId: currentAnime.id,
          episodeNum: episodeId
        });
      }
    } else {
      alert('URL серии не найден');
    }
  }
}

// Add handler for play-episode response to refresh progress
window.electronAPI.receive('play-episode-response', (data) => {
  console.log('Play episode response:', data);
  // Reload watch progress after starting playback
  if (currentAnime && currentAnime.id) {
    setTimeout(() => {
      window.electronAPI.send('get-anime-watch-progress', { animeId: currentAnime.id });
    }, 1000);
  }
});

// Add handler for episode video URL response
window.electronAPI.receive('episode-video-url-response', (data) => {
  console.log('Received episode video URL:', data.videoUrl);
  if (currentAnime && data.videoUrl) {
    window.electronAPI.send('play-episode', {
      videoUrl: data.videoUrl,
      title: currentAnime.title,
      resolution: selectedResolution,
      animeId: currentAnime.id,
      episodeNum: window.currentPlayingEpisode
    });
  }
});

window.electronAPI.receive('episode-video-url-error', (data) => {
  console.error('Error fetching episode video URL:', data.error);
  alert('Ошибка загрузки видео: ' + data.error);
});

function toggleFavorite() {
  if (!currentAnime) return;
  
  window.electronAPI.send('add-to-favorites', { anime: currentAnime });
  
  window.electronAPI.receive('add-to-favorites-response', (data) => {
    if (data.added) {
      document.getElementById('favoriteBtn').classList.add('active');
      document.getElementById('favoriteBtn').textContent = '❤️ В избранном';
    } else {
      document.getElementById('favoriteBtn').classList.remove('active');
      document.getElementById('favoriteBtn').textContent = '❤️ В избранное';
    }
  });
}

function updateFavoriteButton() {
  if (!currentAnime) return;
  
  window.electronAPI.send('get-favorites');
  
  window.electronAPI.receive('favorites-response', (favorites) => {
    const isFavorite = favorites.some(f => f.id === currentAnime.id);
    const btn = document.getElementById('favoriteBtn');
    if (isFavorite) {
      btn.classList.add('active');
      btn.textContent = '❤️ В избранном';
    } else {
      btn.classList.remove('active');
      btn.textContent = '❤️ В избранное';
    }
  });
}

function loadHistory() {
  window.electronAPI.send('get-history');
  
  window.electronAPI.receive('history-response', (history) => {
    displayHistory(history);
  });
}

function displayHistory(history) {
  const grid = document.getElementById('historyGrid');
  const emptyState = document.getElementById('historyEmptyState');
  
  if (!history || history.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  emptyState.style.display = 'none';
  
  grid.innerHTML = history.map(anime => `
    <div class="anime-card fade-in" data-id="${anime.id}">
      <img src="${anime.image}" alt="${anime.title}" class="anime-image">
      <div class="anime-info">
        <div class="anime-title">${anime.title}</div>
        <div class="anime-episodes">${anime.lastEpisode ? `Серия ${anime.lastEpisode}` : 'Не просмотрено'}</div>
      </div>
    </div>
  `).join('');
  
  grid.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', function() {
      const animeId = parseInt(this.dataset.id);
      const link = this.dataset.link;
      currentAnime = {
        id: animeId,
        title: this.querySelector('.anime-title').textContent,
        image: this.querySelector('.anime-image').src,
        link
      };
      showAnimeDetails(animeId, link);
    });
  });
}

function loadFavorites() {
  window.electronAPI.send('get-favorites');
  
  window.electronAPI.receive('favorites-response', (favorites) => {
    displayFavorites(favorites);
  });
}

function displayFavorites(favorites) {
  const grid = document.getElementById('favoritesGrid');
  const emptyState = document.getElementById('favoritesEmptyState');
  
  if (!favorites || favorites.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  emptyState.style.display = 'none';
  
  grid.innerHTML = favorites.map(anime => `
    <div class="anime-card fade-in" data-id="${anime.id}">
      <img src="${anime.image}" alt="${anime.title}" class="anime-image">
      <div class="anime-info">
        <div class="anime-title">${anime.title}</div>
        <div class="anime-episodes">${anime.episodes} серий</div>
      </div>
    </div>
  `).join('');
  
  grid.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', function() {
      const animeId = parseInt(this.dataset.id);
      const link = this.dataset.link;
      currentAnime = {
        id: animeId,
        title: this.querySelector('.anime-title').textContent,
        image: this.querySelector('.anime-image').src,
        link
      };
      showAnimeDetails(animeId, link);
    });
  });
}

function loadSettings() {
  window.electronAPI.send('oauth-status');
  window.electronAPI.send('get-settings');
  
  window.electronAPI.receive('oauth-status-response', (data) => {
    updateOAuthUI(data.connected, data.username);
  });
  
  window.electronAPI.receive('settings-response', (settings) => {
    document.getElementById('defaultParser').value = settings.defaultParser || 'animevost';
  });
  
  document.getElementById('defaultParser').addEventListener('change', function() {
    window.electronAPI.send('save-settings', { settings: { defaultParser: this.value } });
  });
}

function updateOAuthUI(connected, username) {
  const statusEl = document.getElementById('oauthStatus');
  const loginBtn = document.getElementById('oauthLoginBtn');
  const logoutBtn = document.getElementById('oauthLogoutBtn');
  
  if (connected) {
    statusEl.textContent = `Подключено: ${username}`;
    statusEl.classList.add('connected');
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-flex';
  } else {
    statusEl.textContent = 'Не подключено';
    statusEl.classList.remove('connected');
    loginBtn.style.display = 'inline-flex';
    logoutBtn.style.display = 'none';
  }
}

function checkOAuthStatus() {
  window.electronAPI.send('oauth-status');
}

function handleOAuthUrl(url) {
  window.electronAPI.receive('oauth-status-response', (data) => {
    if (data.connected) {
      updateOAuthUI(true, data.username);
    }
  });
}

function handleOAuthResponse(data) {
  if (data.success) {
    updateOAuthUI(true, data.username);
  } else {
    alert('OAuth login failed');
  }
}

function getSampleData() {
  return [
    {
      id: 1,
      title: 'Cowboy Bebop',
      image: 'https://cdn.nostrum.space/v2/resize/300x450/nostrum.animevost.org/images/1.jpg',
      episodes: 26,
      link: 'https://animevost.org/tip/anim/cowboy-bebop'
    },
    {
      id: 2,
      title: 'Monster',
      image: 'https://cdn.nostrum.space/v2/resize/300x450/nostrum.animevost.org/images/70.jpg',
      episodes: 74,
      link: 'https://animevost.org/tip/anim/monster'
    },
    {
      id: 3,
      title: 'Fullmetal Alchemist: Brotherhood',
      image: 'https://cdn.nostrum.space/v2/resize/300x450/nostrum.animevost.org/images/86.jpg',
      episodes: 64,
      link: 'https://animevost.org/tip/anim/fullmetal-alchemist-brotherhood'
    },
    {
      id: 4,
      title: 'Steins;Gate',
      image: 'https://cdn.nostrum.space/v2/resize/300x450/nostrum.animevost.org/images/105.jpg',
      episodes: 24,
      link: 'https://animevost.org/tip/anim/steins-gate'
    },
    {
      id: 5,
      title: 'Attack on Titan',
      image: 'https://cdn.nostrum.space/v2/resize/300x450/nostrum.animevost.org/images/1.jpg',
      episodes: 87,
      link: 'https://animevost.org/tip/anim/attack-on-titan'
    },
    {
      id: 6,
      title: 'Death Note',
      image: 'https://cdn.nostrum.space/v2/resize/300x450/nostrum.animevost.org/images/2.jpg',
      episodes: 37,
      link: 'https://animevost.org/tip/anim/death-note'
    }
  ];
}

function updateEpisodesWatchStatus() {
  console.log('updateEpisodesWatchStatus called');
  console.log('currentAnimeWatchProgress:', window.currentAnimeWatchProgress);
  console.log('currentShikimoriProgress:', window.currentShikimoriProgress);
  console.log('currentAnimeLastEpisode:', window.currentAnimeLastEpisode);
  
  const progress = window.currentAnimeWatchProgress || {};
  const shikimoriProgress = window.currentShikimoriProgress;
  
  const episodeItems = document.querySelectorAll('.episode-item');
  console.log('Found episode items:', episodeItems.length);
  
  episodeItems.forEach(item => {
    const episodeId = parseInt(item.dataset.episodeId);
    const watchedTime = progress[episodeId] || 0;
    
    console.log('Episode', episodeId, 'watched time:', watchedTime);
    
    // Mark as watched if more than 90% watched or if it's the last watched episode
    if (watchedTime > 0) {
      item.classList.add('has-progress');
      const progressEl = item.querySelector('.episode-progress');
      console.log('Progress element for episode', episodeId, ':', progressEl);
      if (progressEl) {
        progressEl.textContent = formatTime(watchedTime);
        console.log('Set progress text:', formatTime(watchedTime));
      } else {
        console.error('Progress element not found for episode', episodeId);
      }
    }
    
    // Mark episodes based on Shikimori progress
    if (shikimoriProgress && shikimoriProgress.episodes && episodeId <= shikimoriProgress.episodes) {
      item.classList.add('watched');
      console.log('Marked episode', episodeId, 'as watched from Shikimori');
    }
    
    // Mark episodes up to last watched as watched (local history)
    if (window.currentAnimeLastEpisode && episodeId <= window.currentAnimeLastEpisode) {
      item.classList.add('watched');
      console.log('Marked episode', episodeId, 'as watched from history');
    }
  });
}

function formatTime(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}с`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }
}