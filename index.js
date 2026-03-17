/**
 * EVS Intel Bot - 카카오톡 챗봇 웹훅 서버 v5.0
 *
 * 흐름: 카톡 수신 → 크롤링/분석 → Teams 즉시 포스팅 + 카톡 결과 알림
 *
 * 1. URL 또는 텍스트 수신 → AI 분석 → Teams 바로 포스팅 → 카톡으로 결과 알림
 * 2. 수정의견 입력 → AI 재수정 → Teams 재포스팅
 * 3. "확인" 불필요 (자동 전송)
 */

require('dotenv').config();
const express = require('express');
const { crawlUrl } = require('./crawler');
const { analyzeContent, polishUserSummary, reviseAnalysis } = require('./ai-processor');
const { postToTeams } = require('./teams-client');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== 상태 관리: 확인 대기 중인 포스트 =====
const pendingPosts = new Map();

// 만료 시간 (30분)
const PENDING_EXPIRY_MS = 30 * 60 * 1000;

// 주기적으로 만료된 항목 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingPosts.entries()) {
    if (now - value.createdAt > PENDING_EXPIRY_MS) {
      pendingPosts.delete(key);
      console.log(`[만료 삭제] userId: ${key}`);
    }
  }
}, 5 * 60 * 1000);

// ===== 불릿포인트 포맷 헬퍼 =====
function formatBullets(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => `• ${item}`).join('\n');
}

// ===== 포스팅 완료 알림 텍스트 생성 =====
function buildPostedText(analysis, url) {
  const categoryEmoji = {
    '기술동향': '🔬', '시장동향': '📈', '정부정책': '🏛️',
    '경쟁사/레퍼런스': '🏢', '자율주행/로봇': '🤖',
    'EV/충전인프라': '⚡', '기타': '📌',
  };
  const emoji = categoryEmoji[analysis.category] || '📌';

  let text =
    `✅ Teams 포스팅 완료!\n` +
    `━━━━━━━━━━━━━━━\n` +
    `${emoji} [${analysis.category}] ${analysis.title}\n\n` +
    `📝 요약:\n${formatBullets(analysis.summary)}\n\n` +
    `💡 인사이트:\n${formatBullets(analysis.insight)}`;

  if (url) {
    text += `\n🔗 ${url}`;
  }

  text += `\n━━━━━━━━━━━━━━━\n`;
  text += `✏️ 수정사항 입력 → 재수정 후 Teams 재포스팅`;

  return text;
}

// ===== 헬스체크 =====
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', bot: 'EVS Intel Bot', version: '5.0.0' });
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

    // 사용자 정보 추출
    const userId = (userRequest.user && userRequest.user.id) || 'unknown';
    const userProps = (userRequest.user && userRequest.user.properties) || {};
    const userNickname = userProps.nickname || userProps.nickName || '알 수 없음';

    console.log(`[${new Date().toISOString()}] 수신 (${userNickname}/${userId.substring(0, 8)}): ${userMessage.substring(0, 100)}`);

    const trimmed = userMessage.trim();

    // ===== 1. "확인" 명령 처리 (하위 호환 유지) =====
    if (trimmed === '확인') {
      const pending = pendingPosts.get(userId);
      if (!pending) {
        return res.status(200).json(buildTextResponse(
          '⚠️ 대기 중인 포스팅이 없어요.\n링크나 요약 텍스트를 보내주세요!'
        ));
      }
      // 이미 포스팅 완료된 경우
      if (pending.posted) {
        pendingPosts.delete(userId);
        return res.status(200).json(buildTextResponse('✅ 이미 Teams에 포스팅되었어요!'));
      }
      // 아직 포스팅 안 된 경우 (폴백)
      pendingPosts.delete(userId);
      return res.status(200).json(buildTextResponse('✅ 확인 완료!'));
    }

    // ===== 2. URL 추출 =====
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = userMessage.match(urlRegex);

    if (urls && urls.length > 0) {
      // URL 있음 → 크롤링+분석 → Teams 바로 전송
      const url = urls[0];
      const userMemo = userMessage.replace(urlRegex, '').trim();

      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const processPromise = processLinkAndPost(url, userMemo, userId, userNickname);
      const result = await Promise.race([processPromise, timeoutPromise]);

      let response;
      if (result) {
        response = buildTextResponse(result);
      } else {
        processPromise
          .then(r => {
            console.log('백그라운드 링크+포스팅 완료');
          })
          .catch(err => console.error('백그라운드 링크 오류:', err));
        response = buildTextResponse(
          `📥 링크 접수!\n${url}\n\n분석 후 Teams에 바로 포스팅할게요!`
        );
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] URL 처리 응답 (${elapsed}ms)`);
      return res.status(200).json(response);
    }

    // ===== 3. 대기 중인 포스트 확인 (수정 피드백) =====
    const pending = pendingPosts.get(userId);

    if (pending && trimmed.length >= 2) {
      // 수정 피드백 → AI 재수정 → Teams 재포스팅
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const revisePromise = processRevisionAndRepost(userId, trimmed, userNickname);
      const result = await Promise.race([revisePromise, timeoutPromise]);

      let response;
      if (result) {
        response = buildTextResponse(result);
      } else {
        revisePromise
          .then(r => {
            console.log('백그라운드 수정+재포스팅 완료');
          })
          .catch(err => console.error('백그라운드 수정 오류:', err));
        response = buildTextResponse(
          '📝 수정 반영 후 Teams에 재포스팅할게요!'
        );
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] 수정 처리 응답 (${elapsed}ms)`);
      return res.status(200).json(response);
    }

    // ===== 4. URL 없음 + 대기 없음 + 15자 이상 → 수동 요약 → Teams 바로 전송 =====
    if (trimmed.length >= 15) {
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const processPromise = processManualAndPost(trimmed, userId, userNickname);
      const result = await Promise.race([processPromise, timeoutPromise]);

      let response;
      if (result) {
        response = buildTextResponse(result);
      } else {
        processPromise
          .then(r => {
            console.log('수동 요약+포스팅 백그라운드 완료');
          })
          .catch(err => console.error('수동 요약 백그라운드 오류:', err));
        response = buildTextResponse(
          '📥 요약 접수!\n\n분석 후 Teams에 바로 포스팅할게요!'
        );
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] 수동 요약 응답 (${elapsed}ms)`);
      return res.status(200).json(response);
    }

    // ===== 5. 짧은 텍스트 → 안내 메시지 =====
    return res.status(200).json(buildTextResponse(
      '📎 링크를 보내주시면 자동으로 분석해서 Teams에 포스팅해드려요!\n\n' +
      '또는 요약/인사이트를 직접 입력하시면 다듬어서 Teams에 올려드릴게요.\n\n' +
      '예시 1: https://example.com/article\n' +
      '예시 2: 전기차 충전 시장이 2025년 10조원 �ל모로 성장...'
    ));

  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    return res.status(200).json(buildTextResponse('처리 중 오류가 발생했어요. 다시 시도해주세요.'));
  }
});

// ===== 링크 처리 → 분석 → Teams 바로 포스팅 =====
async function processLinkAndPost(url, userMemo, userId, userNickname) {
  try {
    // 1. 크롤링
    console.log(`[크롤링] ${url}`);
    const crawled = await crawlUrl(url);

    if (!crawled.success) {
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

    // 3. Teams에 바로 포스팅
    console.log(`[Teams 포스팅] ${analysis.title}`);
    const postResult = await postToTeams({
      title: analysis.title,
      url: url,
      userMemo: userMemo,
      category: analysis.category,
      summary: analysis.summary,
      insight: analysis.insight,
      importance: analysis.importance,
      author: userNickname,
    });

    // 4. 수정 대비 대기 상태 저장
    pendingPosts.set(userId, {
      analysis,
      url,
      userMemo,
      author: userNickname,
      posted: true,
      createdAt: Date.now(),
    });

    console.log(`[포스팅 완료] userId: ${userId.substring(0, 8)}, 성공: ${postResult.success}`);

    if (postResult.success) {
      return buildPostedText(analysis, url);
    } else {
      return `⚠️ Teams 포스팅 실패\n사유: ${postResult.error}\n\n다시 링크를 보내주세요.`;
    }
  } catch (error) {
    console.error('processLinkAndPost 오류:', error);
    return `❌ 처리 중 오류 발생\n${url}\n\n사유: ${error.message}`;
  }
}

// ===== 수동 요약 → 분석 → Teams 바로 포스팅 =====
async function processManualAndPost(userText, userId, userNickname) {
  try {
    console.log(`[수동 요약 처리] 텍스트: ${userText.substring(0, 50)}...`);
    const analysis = await polishUserSummary(userText);

    // Teams에 바로 포스팅
    console.log(`[Teams 포스팅] ${analysis.title}`);
    const postResult = await postToTeams({
      title: analysis.title,
      url: '',
      userMemo: '',
      category: analysis.category,
      summary: analysis.summary,
      insight: analysis.insight,
      importance: analysis.importance,
      author: userNickname,
    });

    // 수정 대비 대기 상태 저장
    pendingPosts.set(userId, {
      analysis,
      url: '',
      userMemo: '',
      author: userNickname,
      posted: true,
      createdAt: Date.now(),
    });

    if (postResult.success) {
      return buildPostedText(analysis, '');
    } else {
      return `⚠️ Teams 포스팅 실패\n사유: ${postResult.error}\n\n다시 시도해주세요.`;
    }
  } catch (error) {
    console.error('processManualAndPost 오류:', error);
    return `❌ 요약 처리 중 오류가 발생했어요.\n사유: ${error.message}\n\n다시 시도해주세요.`;
  }
}

// ===== 수정 피드백 → 재수정 → Teams 재포스팅 =====
async function processRevisionAndRepost(userId, feedback, userNickname) {
  try {
    const pending = pendingPosts.get(userId);
    if (!pending) return '⚠️ 수정할 포스팅이 없어요.';

    console.log(`[수정 요청] 피드백: ${feedback.substring(0, 50)}...`);
    const revised = await reviseAnalysis(pending.analysis, feedback);

    // Teams에 재포스팅
    console.log(`[Teams 재포스팅] ${revised.title}`);
    const postResult = await postToTeams({
      title: revised.title,
      url: pending.url || '',
      userMemo: pending.userMemo || '',
      category: revised.category,
      summary: revised.summary,
      insight: revised.insight,
      importance: revised.importance,
      author: pending.author || userNickname,
    });

    // 대기 상태 업데이트
    pendingPosts.set(userId, {
      ...pending,
      analysis: revised,
      posted: true,
      createdAt: Date.now(),
    });

    console.log(`[재포스팅 완료] title: ${revised.title}`);

    if (postResult.success) {
      return buildPostedText(revised, pending.url);
    } else {
      return `⚠️ Teams 재포스팅 실패\n사유: ${postResult.error}`;
    }
  } catch (error) {
    console.error('processRevisionAndRepost 오류:', error);
    return `❌ 수정 중 오류가 발생했어요.\n사유: ${error.message}\n\n다시 시도해주세요.`;
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
  console.log(`🚀 EVS Intel Bot v5.0 서버 시작: http://localhost:${PORT}`);
  console.log(`📡 웹훅 URL: http://localhost:${PORT}/webhook`);
});
