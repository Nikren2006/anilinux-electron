const axios = require('axios');
const cheerio = require('cheerio');

const animevostConfig = {
  baseURL: 'https://animevost.org'
};

// Create axios instance with proper headers
const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// Generate a unique ID from a link
function generateId(link) {
  if (!link) return Date.now();
  // Create a hash from the link
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    const char = link.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

async function getAnimeList(page = 1) {
  try {
    const url = page === 1 ? animevostConfig.baseURL : `${animevostConfig.baseURL}/page/${page}/`;
    console.log('Fetching anime list from:', url);
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);
    
    const animeList = [];
    
    // Try multiple selectors for anime items
    const selectors = [
      '.shortstory',
      '.anime-item',
      '.anime-card',
      '.story'
    ];
    
    let foundSelector = null;
    for (const selector of selectors) {
      const items = $(selector);
      if (items.length > 0) {
        foundSelector = selector;
        console.log(`Found anime with selector: ${selector} count: ${items.length}`);
        
        items.each((_, element) => {
          const $el = $(element);
          
          const title = $el.find('h2, h3, .title, .mov-title').first().text().trim();
          const link = $el.find('a').first().attr('href');
          const image = $el.find('img').first().attr('src');
          const rating = $el.find('.rating, .kp-rating, .imdb-rating').first().text().trim();
          
          if (title && link) {
            animeList.push({
              id: generateId(link),
              title: title,
              link: link.startsWith('http') ? link : `${animevostConfig.baseURL}${link}`,
              image: image ? (image.startsWith('http') ? image : `${animevostConfig.baseURL}${image}`) : '',
              rating: rating || ''
            });
          }
        });
        
        break;
      }
    }
    
    console.log('Total parsed anime list:', animeList.length, 'items');
    
    if (animeList.length === 0) {
      console.log('No anime found, returning empty array for page', page);
      return [];
    }
    
    return animeList;
  } catch (error) {
    console.error('Error fetching anime list:', error.message);
    return getSampleData();
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

async function getAnimeDetails(animeId, link) {
  try {
    const url = link || `${animevostConfig.baseURL}`;
    console.log('Fetching anime details from:', url);
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);
    
    // Extract title - try multiple selectors, avoiding promotional content
    const title = $('h1').first().text().trim() || 
                  $('.title').first().text().trim() ||
                  $('.mov-title').first().text().trim() ||
                  $('h2').first().text().trim();
    
    console.log('Parsed title:', title);
    
    // Filter out promotional titles aggressively
    const promoKeywords = ['реклама', 'партнер', 'banner', 'promo', 'ad', 'advertisement', 'спонсор'];
    const isPromo = promoKeywords.some(keyword => title.toLowerCase().includes(keyword));
    
    if (isPromo || title.length < 3) {
      console.log('Detected promotional content, using fallback');
      // Return fallback data if promotional content detected
      return getFallbackAnimeDetails(animeId, title);
    }
    
    // Extract description - avoid promotional content
    let description = $('.shortstoryContent').first().text().trim() || 
                     $('div#story').text().trim();
    
    // Filter out promotional descriptions
    if (description.toLowerCase().includes('реклама') || 
        description.toLowerCase().includes('партнер') ||
        description.length < 20) {
      description = 'Описание недоступно';
    }
    
    // Extract image - avoid banners
    let image = $('img[src*="uploads"]').first().attr('src') || 
                $('img[itemprop="image"]').first().attr('src') ||
                $('.poster img').first().attr('src');
    
    // Check if image is a banner (too wide or has banner in filename)
    if (image) {
      if (image.toLowerCase().includes('banner') ||
          image.toLowerCase().includes('promo')) {
        image = '';
      } else if (!image.startsWith('http')) {
        image = `${animevostConfig.baseURL}${image}`;
      }
    }
    
    // Extract metadata from table
    let year = '';
    let genre = '';
    let status = '';
    
    const metaTable = $('.shortinf').first() || $('table').first();
    if (metaTable) {
      metaTable.find('tr').each((_, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const keyText = cells.eq(0).text().trim().toLowerCase();
          const valText = cells.eq(1).text().trim();
          
          if (keyText.includes('год') || keyText.includes('year')) {
            year = valText;
          } else if (keyText.includes('жанр') || keyText.includes('genre')) {
            genre = valText;
          } else if (keyText.includes('статус') || keyText.includes('status')) {
            status = valText;
          }
        }
      });
    }
    
    // Extract rating if available
    const ratingText = $('.rating').text().trim() || 
                      $('.kp-rating').text().trim() ||
                      $('.imdb-rating').text().trim();
    const rating = parseFloat(ratingText) || 0;
    
    // Parse episodes from JavaScript object: var data = {"1 серия":"ID",...}
    const episodes = parseEpisodes(response.data);
    console.log('Parsed episodes:', episodes.length);
    
    return {
      id: animeId,
      title: title || 'Без названия',
      description: description || 'Описание недоступно',
      image: image || '',
      rating: rating,
      year: year,
      genre: genre,
      status: status,
      episodes: episodes
    };
  } catch (error) {
    console.error('Error fetching anime details:', error.message);
    // Return fallback data
    return getFallbackAnimeDetails(animeId);
  }
}

function getFallbackAnimeDetails(animeId, title = 'Без названия') {
  return {
    id: animeId,
    title: title,
    description: 'Описание недоступно. Попробуйте другой источник.',
    image: '',
    rating: 0,
    year: '',
    genre: '',
    status: '',
    episodes: Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `Серия ${i + 1}`,
      url: '',
      ajaxId: ''
    }))
  };
}

async function getEpisodeVideoUrl(ajaxId, episodeNum = '1') {
  try {
    console.log('Fetching video URL for ajax ID:', ajaxId);
    
    // Step 1: frame.php -> iframe on frame5.php
    const frameUrl = `${animevostConfig.baseURL}/frame.php?play=${ajaxId}`;
    const frameResponse = await axiosInstance.get(frameUrl);
    const $ = cheerio.load(frameResponse.data);
    
    const iframe = $('iframe').first();
    if (!iframe) {
      console.error('No iframe found in frame.php');
      return null;
    }
    
    let iframeSrc = iframe.attr('src') || '';
    if (!iframeSrc.startsWith('http')) {
      iframeSrc = `${animevostConfig.baseURL}${iframeSrc}`;
    }
    
    console.log('Iframe src:', iframeSrc);
    
    // Step 2: Load frame5.php and extract video URL
    const frame5Response = await axiosInstance.get(iframeSrc);
    const html = frame5Response.data;
    const $2 = cheerio.load(html);
    
    console.log('Frame5 HTML length:', html.length);
    
    // Look for video URL in multiple patterns
    let videoUrl = '';
    
    // Pattern 1: file: "url" in scripts
    const fileMatch = html.match(/file["\']?\s*[:=]\s*["\']([^"\']+)["\']/i);
    if (fileMatch) {
      videoUrl = fileMatch[1];
      console.log('Found video URL via file pattern:', videoUrl);
    }
    
    // Pattern 2: video: "url" in scripts
    if (!videoUrl) {
      const videoMatch = html.match(/video["\']?\s*[:=]\s*["\']([^"\']+)["\']/i);
      if (videoMatch) {
        videoUrl = videoMatch[1];
        console.log('Found video URL via video pattern:', videoUrl);
      }
    }
    
    // Pattern 3: url: "url" in scripts
    if (!videoUrl) {
      const urlMatch = html.match(/url["\']?\s*[:=]\s*["\']([^"\']+(?:\.mp4|\.m3u8)[^"\']*)["\']/i);
      if (urlMatch) {
        videoUrl = urlMatch[1];
        console.log('Found video URL via url pattern:', videoUrl);
      }
    }
    
    // Pattern 4: Direct mp4 links
    if (!videoUrl) {
      const mp4Match = html.match(/https?:\/\/[^"'\s\)]+\.mp4[^"'\s\)]*/);
      if (mp4Match) {
        videoUrl = mp4Match[0];
        console.log('Found video URL via mp4 pattern:', videoUrl);
      }
    }
    
    // Pattern 5: m3u8 links
    if (!videoUrl) {
      const m3u8Match = html.match(/https?:\/\/[^"'\s\)]+\.m3u8[^"'\s\)]*/);
      if (m3u8Match) {
        videoUrl = m3u8Match[0];
        console.log('Found video URL via m3u8 pattern:', videoUrl);
      }
    }
    
    // Pattern 6: Check video tags
    if (!videoUrl) {
      const videoTag = $2('video').first();
      if (videoTag) {
        videoUrl = videoTag.attr('src') || videoTag.find('source').first().attr('src') || '';
        if (videoUrl) {
          console.log('Found video URL in video tag:', videoUrl);
        }
      }
    }
    
    // Pattern 7: Check for data-url attributes
    if (!videoUrl) {
      const dataUrl = $2('[data-url]').first().attr('data-url');
      if (dataUrl) {
        videoUrl = dataUrl;
        console.log('Found video URL in data-url:', videoUrl);
      }
    }
    
    // Pattern 8: Look for player configuration
    if (!videoUrl) {
      const playerMatch = html.match(/player["\']?\s*[:=]\s*\{[^}]*["\']?file["\']?\s*[:=]\s*["\']([^"\']+)["\']/i);
      if (playerMatch) {
        videoUrl = playerMatch[1];
        console.log('Found video URL via player config:', videoUrl);
      }
    }
    
    if (videoUrl) {
      // Remove any trailing quotes or commas
      videoUrl = videoUrl.replace(/["',]$/, '');
      
      // Add protocol if missing
      if (!videoUrl.startsWith('http')) {
        if (videoUrl.startsWith('//')) {
          videoUrl = 'https:' + videoUrl;
        } else {
          videoUrl = 'https://' + videoUrl;
        }
      }
    }
    
    console.log('Final video URL:', videoUrl);
    return videoUrl || null;
  } catch (error) {
    console.error('Error fetching episode video URL:', error.message);
    console.error('Error stack:', error.stack);
    return null;
  }
}

function parseEpisodes(html) {
  const episodes = [];
  
  // Try to parse JavaScript object: var data = {...}
  const dataStart = html.indexOf('var data = {');
  if (dataStart === -1) {
    const dataStartAlt = html.indexOf('var data={');
    if (dataStartAlt !== -1) {
      return parseEpisodesFromVar(html, dataStartAlt);
    }
  } else {
    return parseEpisodesFromVar(html, dataStart);
  }
  
  // Alternative: look for select with id=season
  const selectMatch = html.match(/<select[^>]*id="season"[^>]*>([\s\S]*?)<\/select>/);
  if (selectMatch) {
    const $ = cheerio.load(selectMatch[0]);
    $('option').each((index, option) => {
      const text = $(option).text().trim();
      const value = $(option).attr('value') || '';
      episodes.push({
        id: index + 1,
        title: text || `Серия ${index + 1}`,
        url: value
      });
    });
    return episodes;
  }
  
  // Alternative: look for div with id=scroll
  const scrollMatch = html.match(/<div[^>]*id="scroll"[^>]*>([\s\S]*?)<\/div>/);
  if (scrollMatch) {
    const $ = cheerio.load(scrollMatch[0]);
    $('a').each((_, a) => {
      const onclick = $(a).attr('onclick') || '';
      const match = onclick.match(/ajax\((\d+),\s*(\d+)\)/);
      if (match) {
        const epNum = parseInt(match[2]);
        episodes.push({
          id: epNum,
          title: `Серия ${epNum}`,
          url: `ajax:${match[1]}:${epNum}`,
          ajaxId: match[1]
        });
      }
    });
    return episodes.sort((a, b) => a.id - b.id);
  }
  
  // Fallback: generate default episodes
  const episodeCount = 12;
  for (let i = 1; i <= episodeCount; i++) {
    episodes.push({
      id: i,
      title: `Серия ${i}`,
      url: ''
    });
  }
  
  return episodes;
}

function parseEpisodesFromVar(html, startPos) {
  const episodes = [];
  
  // Find the end of the object by counting braces
  let braceCount = 0;
  let endPos = startPos;
  let started = false;
  
  for (let i = startPos; i < Math.min(startPos + 200000, html.length); i++) {
    if (html[i] === '{') {
      braceCount++;
      started = true;
    } else if (html[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        endPos = i + 1;
        break;
      }
    }
  }
  
  const dataStr = html.substring(startPos, endPos);
  
  // Extract JSON part
  const jsonMatch = dataStr.match(/var\s+data\s*=\s*(\{.*\})/);
  if (jsonMatch) {
    try {
      let jsonStr = jsonMatch[1];
      // Remove trailing commas
      jsonStr = jsonStr.replace(/,\s*}/, '}');
      const seriesData = JSON.parse(jsonStr);
      
      for (const [key, value] of Object.entries(seriesData)) {
        const epNumMatch = key.match(/^(\d+)/);
        if (epNumMatch) {
          const epNum = parseInt(epNumMatch[1]);
          episodes.push({
            id: epNum,
            title: key.trim(),
            url: `ajax:${value}`,
            ajaxId: value
          });
        }
      }
      
      episodes.sort((a, b) => a.id - b.id);
    } catch (e) {
      console.error('Error parsing episode JSON:', e.message);
    }
  }
  
  return episodes;
}

async function searchAnime(query) {
  try {
    const searchUrl = `${animevostConfig.baseURL}/index.php?do=search`;
    const data = {
      do: 'search',
      subaction: 'search',
      search_start: 0,
      full_search: 0,
      result_from: 1,
      story: query
    };
    
    const response = await axiosInstance.post(searchUrl, data);
    const $ = cheerio.load(response.data);
    
    const results = [];
    
    $('.shortstory').each((index, element) => {
      const $el = $(element);
      
      const img = $el.find('img[src*="uploads"]').first();
      const image = img.attr('src') || '';
      
      let link = $el.find('a[href*="/tip/"]').first().attr('href');
      if (!link) {
        link = $el.find('a[href*="/anime"]').first().attr('href');
      }
      
      let title = '';
      if (link) {
        title = $el.find(`a[href="${link}"]`).first().text().trim();
      }
      if (!title && img) {
        title = img.attr('alt') || '';
      }
      
      const description = $el.find('.shortstoryContent').text().trim();
      
      if (title) {
        results.push({
          id: index + 1,
          title: title.trim(),
          image: image.startsWith('http') ? image : `${animevostConfig.baseURL}${image}`,
          link: link ? (link.startsWith('http') ? link : `${animevostConfig.baseURL}${link}`) : '',
          description: description.substring(0, 200) + '...'
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('Error searching anime:', error.message);
    return [];
  }
}

module.exports = {
  getAnimeList,
  getAnimeDetails,
  searchAnime,
  getEpisodeVideoUrl
};