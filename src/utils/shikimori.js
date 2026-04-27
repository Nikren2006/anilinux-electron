const axios = require('axios');

const shikimoriConfig = {
  baseURL: 'https://shikimori.one',
  apiURL: 'https://shikimori.one/api',
  clientID: 'kpMwiHiZJgWR6OY8qx9yoVxUkBjSpKUwajy-DP4YaLc',
  clientSecret: 'VK34pr7ZMbSqQ7frvcU0Nje8pRwS_BarfJ_WMgZretg',
  redirectURI: 'http://localhost:3000/auth/shikimori/callback'
};

// Create axios instance with proper headers
const axiosInstance = axios.create({
  baseURL: shikimoriConfig.apiURL,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://shikimori.one'
  }
});

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: shikimoriConfig.clientID,
    redirect_uri: shikimoriConfig.redirectURI,
    response_type: 'code',
    scope: 'user_rates'
  });
  
  return `${shikimoriConfig.baseURL}/oauth/authorize?${params.toString()}`;
}

async function getAccessToken(code) {
  try {
    console.log('Exchanging code for access token...');
    console.log('Code:', code);
    
    // Use URL-encoded form data as required by OAuth2
    const params = new URLSearchParams();
    params.append('client_id', shikimoriConfig.clientID);
    params.append('client_secret', shikimoriConfig.clientSecret);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', shikimoriConfig.redirectURI);
    
    const response = await axios.post(`${shikimoriConfig.baseURL}/oauth/token`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });
    
    console.log('Access token received');
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    throw error;
  }
}

async function getUserInfo(accessToken) {
  try {
    const response = await axios.get(`${shikimoriConfig.apiURL}/users/whoami`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting user info:', error.response?.data || error.message);
    throw error;
  }
}

async function searchAnime(query, limit = 20) {
  try {
    const response = await axiosInstance.get('/animes', {
      params: {
        search: query,
        limit: limit,
        order: 'popularity'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error searching anime:', error.response?.data || error.message);
    return [];
  }
}

async function getAnimeList(options = {}) {
  try {
    const params = {
      limit: options.limit || 20,
      page: options.page || 1,
      order: options.order || 'popularity'
    };
    
    if (options.status) params.status = options.status;
    if (options.season) params.season = options.season;
    if (options.year) params.season_year = options.year;
    if (options.genre) params.genre = options.genre;
    
    const response = await axiosInstance.get('/animes', { params });
    
    return response.data;
  } catch (error) {
    console.error('Error getting anime list:', error.response?.data || error.message);
    return [];
  }
}

async function getAnimeDetails(animeId) {
  try {
    const response = await axiosInstance.get(`/animes/${animeId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting anime details:', error.response?.data || error.message);
    return null;
  }
}

async function getAnimeEpisodes(animeId) {
  try {
    const response = await axiosInstance.get(`/animes/${animeId}/episodes`);
    return response.data;
  } catch (error) {
    console.error('Error getting anime episodes:', error.response?.data || error.message);
    return [];
  }
}

async function getUserAnimeList(accessToken, status = null) {
  try {
    const params = { user_id: 'me' };
    if (status) params.status = status;
    
    const response = await axios.get(`${shikimoriConfig.apiURL}/v2/user_rates`, {
      params: params,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting user anime list:', error.response?.data || error.message);
    return [];
  }
}

async function updateAnimeStatus(accessToken, animeId, episodes, status = 'watching', score = null) {
  try {
    const data = {
      user_rate: {
        target_id: animeId,
        target_type: 'Anime',
        episodes: episodes,
        status: status
      }
    };
    
    if (score !== null) {
      data.user_rate.score = score;
    }
    
    const response = await axios.post(`${shikimoriConfig.apiURL}/v2/user_rates`, data, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error updating anime status:', error.response?.data || error.message);
    throw error;
  }
}

async function syncEpisodes(animeId, episodes, accessToken) {
  try {
    await updateAnimeStatus(accessToken, animeId, episodes, 'watching');
    return { success: true };
  } catch (error) {
    console.error('Error syncing episodes:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getAuthUrl,
  getAccessToken,
  getUserInfo,
  searchAnime,
  getAnimeList,
  getAnimeDetails,
  getAnimeEpisodes,
  getUserAnimeList,
  updateAnimeStatus,
  syncEpisodes
};