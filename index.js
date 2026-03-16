/**
 * EVS Intel Bot - 카카오톡 챗봇 웹훅 서버
 *
 * 흐름: 카톡 메시지 수신 → URL 추출 → 크롤링 → Gemini AI 분석 → Teams 포스팅 → 카톡 응답
 */

require('dotenv').config();
const express = require('express');
const { crawlUrl } = require('./crawler');
const { analyzeContent } = require('./ai-processor');
const { postToTeams } = require('./teams-client');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== 헬스체크 =====
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', bot: 'EVS Intel Bot', version: '2.1.0' });
});

// ===== 카카오 오픈빌더 스킬 테스트용 GET =====
app.get('/webhook', (req, res) => {
  res.status(200).json({ status: 'ok', endpoint: 'webhook ready' });
});

// ===== 카카오 오픈빌더 웹훅 엔드포인트 =====
app.post('/webhook', async (req, res) => {
  const startTime = Date.now();

  try {
    const body = req.body || {};
    const userRequest = body.userRequest || {};
    const userMessage = userRequest.utterance || '';

    console.log(`[${new Date().toISOString()}] 수신: ${userMessage.substring(0, 100)}`);
    console.log(`[DEBUG] 요청 body keys: ${Object.keys(body).join(', ')}`);

    // URL 추출
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = userMessage.match(urlRegex);

    if (!urls || urls.length === 0) {
      // URL이 없으면 안내 메시지
      const response = buildTextResponse(
        '링크를 보내주시면 자동으로 분석해서 Teams에 포스팅해드려요!\n\n' +
        '예시:\nhttps://example.com/article\n자율주행 관련 좋은 기사'
      );
      console.log(`[DEBUG] 응답 (URL없음): ${JSON.stringify(response).substring(0, 200)}`);
      return res.status(200).json(response);
    }

    const url = urls[0];
    // URL을 제외한 나머지 텍스트를 메모로 사용
    const userMemo = userMessage.replace(urlRegex, '').trim();

    // 즉시 "처리중" 응답 보내고 백그라운드 처리
    // 카카오 오픈빌더는 5초 타임아웃이므로, 빠른 응답 필요
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(null), 3500); // 3.5초 타임아웃 (여유 확보)
    });

    const processPromise = processLink(url, userMemo);

    const result = await Promise.race([processPromise, timeoutPromise]);

    let response;
    if (result) {
      response = buildTextResponse(result);
    } else {
      // 타임아웃 — 백그라운드에서 계속 처리
      processPromise.then(r => console.log('백그라운드 처리 완료:', r)).catch(err => console.error('백그라운드 오류:', err));
      response = buildTextResponse(
        `📥 링크 접수 완료!\n${url}\n\n분석 중이에요. 잠시 후 Teams 채널에서 확인하세요.`
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] 응답 전송 (${elapsed}ms): ${JSON.stringify(response).substring(0, 300)}`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    const response = buildTextResponse('처리 중 오류가 발생했어요. 다시 시도해주세요.');
    return res.status(200).json(response);
  }
});

// ===== 링크 처리 파이프라인 =====
async function processLink(url, userMemo) {
  try {
    // 1. 크롤링
    console.log(`[크롤링] ${url}`);
    const crawled = await crawlUrl(url);

    if (!crawled.success) {
      return `❌ 링크를 읽을 수 없었어요.\n${url}\n\n사유: ${crawled.error}`;
    }

    // 2. Gemini AI 분석
    console.log(`[AI 분석] ${crawled.title}`);
    const analysis = await analyzeContent(crawled.title, crawled.content, url, userMemo);

    // 3. Teams 채널 포스팅
    console.log(`[Teams 포스팅] ${analysis.title}`);
    const teamsResult = await postToTeams({
      title: analysis.title,
      url: url,
      userMemo: userMemo,
      category: analysis.category,
      summary: analysis.summary,
      insight: analysis.insight,
      importance: analysis.importance,
    });

    // 4. 카톡 응답 생성
    const categoryEmoji = {
      '기술동향': '🔬',
      '시장동향': '📈',
      '정부정책': '🏛️',
      '경쟁사/레퍼런스': '🏢',
      '자율주행/로봇': '🤖',
      'EV/충전인프라': '⚡',
      '기타': '📌',
    };

    const emoji = categoryEmoji[analysis.category] || '📌';
    const importanceStars = { '상': '⭐⭐⭐', '중': '⭐⭐', '하': '⭐' };
    const teamsStatus = teamsResult.success ? '✅ Teams 포스팅 완료' : '⚠️ Teams 포스팅 실패 (로그 확인)';

    return (
      `${emoji} [${analysis.category}] ${analysis.title}\n\n` +
      `📝 요약:\n${analysis.summary}\n\n` +
      `💡 EVS 인사이트:\n${analysis.insight}\n\n` +
      `중요도: ${importanceStars[analysis.importance] || '⭐⭐'}\n` +
      teamsStatus
    );
  } catch (error) {
    console.error('processLink 오류:', error);
    return `❌ 처리 중 오류 발생\n${url}\n\n사유: ${error.message}`;
  }
}

// ===== 카카오 응답 포맷 =====
function buildTextResponse(text) {
  return {
    version: '2.0',
    template: {
      outputs: [
        {
          simpleText: {
            text: text.substring(0, 1000) // 카카오톡 글자수 제한
          }
        }
      ]
    }
  };
}

// ===== 서버 시작 =====
app.listen(PORT, () => {
  console.log(`🚀 EVS Intel Bot 서버 시작: http://localhost:${PORT}`);
  console.log(`📡 웹훅 URL: http://localhost:${PORT}/webhook`);
});
