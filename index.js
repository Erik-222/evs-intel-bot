/**
 * EVS Intel Bot - 카카오톡 챗봇 웹훅 서버
 *
 * 흐름 A: 카톡 URL 수신 → 크롤링 → Gemini AI 분석 → Teams 포스팅 (불릿포인트) → 카톡 응답
 * 흐름 B: 크롤링 실패 → 유저에게 직접 요약 요청 → 유저가 텍스트 전송 → AI 다듬기 → Teams 포스팅
 */

require('dotenv').config();
const express = require('express');
const { crawlUrl } = require('./crawler');
const { analyzeContent, polishUserSummary } = require('./ai-processor');
const { postToTeams } = require('./teams-client');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== 불릿포인트 포맷 헬퍼 =====
function formatBullets(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => `• ${item}`).join('\n');
}

// ===== 여스체크 =====
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', bot: 'EVS Intel Bot', version: '3.0.0' });
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

    // URL 추출
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = userMessage.match(urlRegex);

    if (!urls || urls.length === 0) {
      // URL 없음 → 수동 요약 텍스트인지 판단
      const trimmed = userMessage.trim();

      if (trimmed.length >= 15) {
        // 15자 이상이면 수동 요약으로 처리
        console.log(`[수동 요약] 텍스트 길이: ${trimmed.length}`);

        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => resolve(null), 3500);
        });

        const processPromise = processManualSummary(trimmed);
        const result = await Promise.race([processPromise, timeoutPromise]);

        let response;
        if (result) {
          response = buildTextResponse(result);
        } else {
          processPromise
            .then(r => console.log('수동 요약 백그라운드 완료:', r))
            .catch(err => console.error('수동 요약 백그라운드 오류:', err));
          response = buildTextResponse(
            '📥 요약 접수 완료!\n\n다듬어서 Teams에 올리는 중이에요. 잠시만 기다려주세요.'
          );
        }

        const elapsed = Date.now() - startTime;
        console.log(`[DEBUG] 수동 요약 응답 (${elapsed}ms)`);
        return res.status(200).json(response);
      }

      // 짧은 텍스트 → 안내 메시지
      const response = buildTextResponse(
        '📎 링크를 보내주시면 자동으로 분석해서 Teams에 포스팅해드려요!\n\n' +
        '또는 요약/인사이트를 직접 입력하시면 다듬어서 Teams에 올려드릴게요.\n\n' +
        '예시 1: https://example.com/article\n' +
        '예시 2: 전기차 충전 시장이 2025년 10조원 규모로 성장...'
      );
      return res.status(200).json(response);
    }

    // URL 있음 → 기존 크롤링+분석 플로우
    const url = urls[0];
    const userMemo = userMessage.replace(urlRegex, '').trim();

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(null), 3500);
    });

    const processPromise = processLink(url, userMemo);
    const result = await Promise.race([processPromise, timeoutPromise]);

    let response;
    if (result) {
      response = buildTextResponse(result);
    } else {
      processPromise
        .then(r => console.log('백그라운드 처리 완료:', r))
        .catch(err => console.error('백그라운드 오류:', err));
      response = buildTextResponse(
        `📥 링크 접수 완료!\n${url}\n\n분석 중이에요. 잠시 후 Teams 채널에서 확인하세요.`
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] 응답 전송 (${elapsed}ms)`);
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
      // 크롤링 실패 → 유저에게 직접 요약 요청
      console.log(`[크롤링 실패] ${url}: ${crawled.error}`);
      return (
        `⚠️ 링크를 읽을 수 없었어요.\n${url}\n\n` +
        `사유: ${crawled.error}\n\n` +
        `📝 요약본/인사이트를 직접 입력해주시면 다듬어서 Teams에 올려드릴게요!`
      );
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
      '기술동향': '🔬', '시장동향': '📈', '정부정책': '🏛️',
      '경쟁사/레퍼런스': '🏢', '자율주행/로봇': '🤖',
      'EV/충전인프라': '⚡', '기타': '📌',
    };

    const emoji = categoryEmoji[analysis.category] || '📌';
    const importanceStars = { '상': '⭐⭐⭐', '중': '⭐⭐', '하': '⭐' };
    const teamsStatus = teamsResult.success ? '✅ Teams 포스팅 완료' : '⚠️ Teams 포스팅 실패 (로그 확인)';

    return (
      `${emoji} [${analysis.category}] ${analysis.title}\n\n` +
      `📝 요약:\n${formatBullets(analysis.summary)}\n\n` +
      `💡 EVS 인사이트:\n${formatBullets(analysis.insight)}\n\n` +
      `중요도: ${importanceStars[analysis.importance] || '⭐⭐'}\n` +
      teamsStatus
    );
  } catch (error) {
    console.error('processLink 오류:', error);
    return `❌ 처리 중 오류 발생\n${url}\n\n사유: ${error.message}`;
  }
}

// ===== 수동 요약 처리 파이프라인 =====
async function processManualSummary(userText) {
  try {
    // 1. AI로 다듬기
    console.log(`[수동 요약 처리] 텍스트: ${userText.substring(0, 50)}...`);
    const analysis = await polishUserSummary(userText);

    // 2. Teams 포스팅
    console.log(`[Teams 포스팅] ${analysis.title} (수동 요약)`);
    const teamsResult = await postToTeams({
      title: analysis.title,
      url: '',
      userMemo: '',
      category: analysis.category,
      summary: analysis.summary,
      insight: analysis.insight,
      importance: analysis.importance,
    });

    // 3. 카톡 응답
    const categoryEmoji = {
      '기술동향': '🔬', '시장동향': '📈', '정부정책': '🏛️',
      '경쟁사/레퍼런스': '🏢', '자율주행/로봇': '🤖',
      'EV/충전인프라': '⚡', '기타': '📌',
    };

    const emoji = categoryEmoji[analysis.category] || '📌';
    const teamsStatus = teamsResult.success ? '✅ Teams 포스팅 완료' : '⚠️ Teams 포스팅 실패';

    return (
      `${emoji} [${analysis.category}] ${analysis.title}\n\n` +
      `📝 요약:\n${formatBullets(analysis.summary)}\n\n` +
      `💡 EVS 인사이트:\n${formatBullets(analysis.insight)}\n\n` +
      teamsStatus
    );
  } catch (error) {
    console.error('processManualSummary 오류:', error);
    return `❌ 요약 처리 중 오류가 발생했어요.\n사유: ${error.message}\n\n다시 시도해주세요.`;
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
            text: text.substring(0, 1000)
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
