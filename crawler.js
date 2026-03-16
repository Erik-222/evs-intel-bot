/**
 * URL 크롤러 — 웹페이지에서 텍스트 콘텐츠 추출
 */

const axios = require('axios');
const cheerio = require('cheerio');

async function crawlUrl(url) {
  try {
    // 유튜브 URL 처리
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return await crawlYoutube(url);
    }

    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
                'Referer': 'https://www.google.com/',
                'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'cross-site',
                'sec-fetch-user': '?1',
                'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // 불필요한 요소 제거
    $('script, style, nav, footer, header, aside, .ads, .advertisement, .sidebar').remove();

    // 제목 추출
    const title = $('meta[property="og:title"]').attr('content')
      || $('title').text()
      || $('h1').first().text()
      || 'Untitled';

    // 본문 추출 (우선순위: article > main > body)
    let content = '';
    const selectors = ['article', 'main', '.post-content', '.article-body', '.entry-content', 'body'];

    for (const selector of selectors) {
      const el = $(selector);
      if (el.length > 0) {
        content = el.text().replace(/\s+/g, ' ').trim();
        if (content.length > 200) break;
      }
    }

    // 콘텐츠 길이 제한 (Gemini 토큰 절약)
    if (content.length > 5000) {
      content = content.substring(0, 5000) + '...';
    }

    return {
      success: true,
      title: title.trim(),
      content: content,
      url: url,
    };

  } catch (error) {
    console.error(`크롤링 실패 [${url}]:`, error.message);
    return {
      success: false,
      error: error.message,
      title: '',
      content: '',
      url: url,
    };
  }
}

async function crawlYoutube(url) {
  try {
    const videoId = extractYoutubeId(url);
    if (!videoId) {
      return { success: false, error: 'YouTube ID 추출 실패', title: '', content: '', url };
    }

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await axios.get(oembedUrl, { timeout: 5000 });

    return {
      success: true,
      title: response.data.title || 'YouTube Video',
      content: `[YouTube 영상] 제목: ${response.data.title}. 채널: ${response.data.author_name}. URL: ${url}`,
      url: url,
    };
  } catch (error) {
    return {
      success: true,
      title: 'YouTube Video',
      content: `[YouTube 영상] URL: ${url}. 영상 메타데이터를 가져올 수 없어 URL 기반으로 분석합니다.`,
      url: url,
    };
  }
}

function extractYoutubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^? \s]+)/,
    /(?:youtube\.com\/shorts\/)([^?\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

module.exports = { crawlUrl };
