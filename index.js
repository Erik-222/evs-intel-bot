/**
 * EVS Intel Bot - 카카오톁 챗봇 웹훅 서버 v4.1
 *
 * 흐름: 카톡 수신 → 크롤링/분석 → 미리보기 → 수정 피드백 → "확인" → Teams 포스팅
 *
 * 1. URL 또는 텍스트 수신 → AI 분석 → 카톡으로 미리보기 전송
 * 2. 사용자 수정의견 → AI 재수정 → 새 미리보기 전송
 * 3. "확인" 입력 → Teams 채널에 포스팅
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

// ===== 불릿포인트 포맷 여퍼 =====
function formatBullets(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => `• ${item}`).join('\n');
}

// ===== 미리보기 텍스트 생성 =====
function buildPreviewText(analysis, url) {
  const categoryEmoji = {
    '기술동향': '🔬', '시장동향': '📈', '정부정책': '🏛️',
    '경쟁사/레퍼런스': '🏢', '자율주행/로봇': '🤖',
    'EV/충전인프라': '⚡', '기타': '📌',
  };
  const emoji = categoryEmoji[analysis.category] || '📌';
  const importanceStars = { '상': '⭐⭐⭐', '중': '⭐⭐', '하': '⭐' };

  let preview =
    `📋 Teams 포스팅 미리보기\n` +
    `━━━━━━━━━━━━━━━\n` +
    `${emoji} [${analysis.category}] ${analysis.title}\n\n` +
    `📝 요약:\n${formatBullets(analysis.summary)}\n\n` +
    `💡 인사이트:\n${formatBullets(analysis.insight)}\n\n` +
    `중요도: ${importanceStars[analysis.importance] || '⭐⭐'}`;

  if (url) {
    preview += `\n🔗 ${url}`;
  }

  preview += `\n━━━━━━━━━━━━━━━\n`;
  preview += `✅ "확인" → Teams에 포스팅\n`;
  preview += `✏️ 수정사항 입력 → 재수정`;

  return preview;
}

// ===== 헬스체크 =====
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', bot: 'EVS Intel Bot', version: '4.1.0' });
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

    // ===== 1. "확인" 명령 처리 =====
    if (trimmed === '확인') {
      const pending = pendingPosts.get(userId);
      if (!pending) {
        const elapsed = Date.now() - startTime;
        console.log(`[DEBUG] 확인 - 대기 없음 (${elapsed}ms)`);
        return res.status(200).json(buildTextResponse(
          '⚠️ 확인할 대기 중인 포스팅이 없어요.\n\n' +
          '링크나 요약 텍스트를 먼저 보내주세요!'
        ));
      }

      // Teams에 포스팅
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const postPromise = postToTeams({
        title: pending.analysis.title,
        url: pending.url || '',
        userMemo: pending.userMemo || '',
        category: pending.analysis.category,
        summary: pending.analysis.summary,
        insight: pending.analysis.insight,
        importance: pending.analysis.importance,
        author: pending.author || userNickname,
      });

      const result = await Promise.race([postPromise, timeoutPromise]);

      if (result) {
        pendingPosts.delete(userId);
        const emoji = result.success ? '✅' : '⚠️';
        const msg = result.success
          ? '✅ Teams 포스팅 완료!'
          : '⚠️ Teams 포스팅 실패. 다시 "확인"을 입력해주세요.';
        const elapsed = Date.now() - startTime;
        console.log(`[DEBUG] 확인 처리 (${elapsed}ms) - ${result.success ? '성공' : '실패'}`);
        return res.status(200).json(buildTextResponse(msg));
      } else {
        // 백그라운드 포스팅
        postPromise.then(r => {
          if (r && r.success) pendingPosts.delete(userId);
          console.log('백그라운드 Teams 포스팅 결과:', r);
        }).catch(err => console.error('백그라운드 Teams 오류:', err));

        const elapsed = Date.now() - startTime;
        console.log(`[DEBUG] 확인 - 타임아웃, 백그라운드 처리 (${elapsed}ms)`);
        return res.status(200).json(buildTextResponse(
          '📤 Teams에 포스팅 중이에요. 잠시만 기다려주세요!'
        ));
      }
    }

    // ===== 2. URL 추출 =====
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = userMessage.match(urlRegex);

    if (urls && urls.length > 0) {
      // URL 있음 → 크로링+분석 후 미리보기
      const url = urls[0];
      const userMemo = userMessage.replace(urlRegex, '').trim();

      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const processPromise = processLinkPreview(url, userMemo, userId, userNickname);
      const result = await Promise.race([processPromise, timeoutPromise]);

      let response;
      if (result) {
        // 시간 내 완료 → 미리보기 표시됨
        const p = pendingPosts.get(userId);
        if (p) p.previewed = true;
        response = buildTextResponse(result);
      } else {
        processPromise
          .then(r => {
            // 백그라운드 완료 → previewed는 false 유지 (다음 메시지에서 미리보기 표시)
            console.log('백그라운드 링크 처리 완료');
          })
          .catch(err => console.error('백그라운드 링크 오류:', err));
        response = buildTextResponse(
          `📥 링크 접수 완료!\n${url}\n\n분석 중이에요. 잠시 후 아무 메시지나 보내주세요!`
        );
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] URL 처리 응답 (${elapsed}ms)`);
      return res.status(200).json(response);
    }

    // ===== 3. 대기 중인 포스트 확인 =====
    const pending = pendingPosts.get(userId);

    // 3-A. 미리보기가 아직 안 된 대기 포스트 → 미리보기 표시
    if (pending && !pending.previewed) {
      pending.previewed = true;
      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] 미리보기 재전송 (${elapsed}ms)`);
      return res.status(200).json(buildTextResponse(buildPreviewText(pending.analysis, pending.url)));
    }

    // 3-B. 미리보기 완료 + 텍스트 입력 → 수정 피드백
    if (pending && pending.previewed && trimmed.length >= 2) {
      // 수정 시작 → previewed를 false로 (수정 완료 후 다시 미리보기 필요)
      pending.previewed = false;

      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const revisePromise = processRevision(userId, trimmed, userNickname);
      const result = await Promise.race([revisePromise, timeoutPromise]);

      let response;
      if (result) {
        const p = pendingPosts.get(userId);
        if (p) p.previewed = true;
        response = buildTextResponse(result);
      } else {
        revisePromise
          .then(r => {
            console.log('백그라운드 수정 완료');
          })
          .catch(err => console.error('백그라운드 수정 오류:', err));
        response = buildTextResponse(
          '📝 수정 반영 중이에요. 잠시 후 아무 메시지나 보내주세요!'
        );
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] 수정 처리 응답 (${elapsed}ms)`);
      return res.status(200).json(response);
    }

    // ===== 4. URL 없음 + 대기 없음 + 15자 이상 → 수동 요약 =====
    if (trimmed.length >= 15) {
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const processPromise = processManualSummaryPreview(trimmed, userId, userNickname);
      const result = await Promise.race([processPromise, timeoutPromise]);

      let response;
      if (result) {
        // 시간 내 완료 → 미리보기 표시됨
        const p = pendingPosts.get(userId);
        if (p) p.previewed = true;
        response = buildTextResponse(result);
      } else {
        processPromise
          .then(r => {
            console.log('수동 요약 백그라운드 완료');
          })
          .catch(err => console.error('수동 요약 백그라운드 오류:', err));
        response = buildTextResponse(
          '📥 요약 접수 완료!\n\n분석 중이에요. 잠시 후 아무 메시지나 보내주세요!'
        );
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] 수동 요약 응답 (${elapsed}ms)`);
      return res.status(200).json(response);
    }

    // ===== 5. 짧은 텍스트 → 안내 메시지 =====
    return res.status(200).json(buildTextResponse(
      '📎 �{크를 보내주시면 자동으로 분석해서 Teams에 포스팅해드려요!\n\n' +
      '또는 요약/인사이트를 직접 입력하시면 다들어서 Teams에 올려드릴게요.\n\n' +
      '예시 1: https://example.com/article\n' +
      '예시 2: 전기차 충전 시장이 2025년 10조원 규모로 성장...'
    ));

  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    return res.status(200).json(buildTextResponse('처리 중 오류가 발생했어요. 다시 시도해주세요.'));
  }
});

// ===== 링크 처리 → 미리보기 (Teams에 바로 안 올릸) =====
async function processLinkPreview(url, userMemo, userId, userNickname) {
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

    // 3. 대기 상태에 저장 (Teams에 바로 안 올릸)
    pendingPosts.set(userId, {
      analysis,
      url,
      userMemo,
      author: userNickname,
      createdAt: Date.now(),
    });

    console.log(`[미리보기 저장] userId: ${userId.substring(0, 8)}, title: ${analysis.title}`);

    // 4. 미리보기 반환
    return buildPreviewText(analysis, url);
  } catch (error) {
    console.error('processLinkPreview 오류:', error);
    return `❌ 처리 중 오류 발생\n${url}\n\n사유: ${error.message}`;
  }
}

// ===== 수동 요약 → 미리보기 (Teams에 바로 안 올림) =====
async function processManualSummaryPreview(userText, userId, userNickname) {
  try {
    console.log(`[수동 요약 처리] 텍스트: ${userText.substring(0, 50)}...`);
    const analysis = await polishUserSummary(userText);

    // 대기 상태에 저장
    pendingPosts.set(userId, {
      analysis,
      url: '',
      userMemo: '',
      author: userNickname,
      createdAt: Date.now(),
    });

    console.log(`[미리보기 저장] userId: ${userId.substring(0, 8)}, title: ${analysis.title}`);
    return buildPreviewText(analysis, '');
  } catch (error) {
    console.error('processManualSummaryPreview 오류:', error);
    return `❌ 요약 처리 중 오류가 발생했어요.\n사유: ${error.message}\n\n다시 시도해주세요.`;
  }
}

// ===== 수정 피드백 처리 =====
async function processRevision(userId, feedback, userNickname) {
  try {
    const pending = pendingPosts.get(userId);
    if (!pending) return '⚠️ 수정할 대기 중인 포스팅이 없어요.';

    console.log(`[수정 요청] 피드백: ${feedback.substring(0, 50)}...`);
    const revised = await reviseAnalysis(pending.analysis, feedback);

    // 대기 상태 업데이트
    pendingPosts.set(userId, {
      ...pending,
      analysis: revised,
      createdAt: Date.now(),
    });

    console.log(`[수정 완료] title: ${revised.title}`);
    return buildPreviewText(revised, pending.url);
  } catch (error) {
    console.error('processRevision 오류:', error);
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

// ===== 서버 포스팅 =====
app.listen(PORT, () => {
  console.log(`🚀 EVS Intel Bot v4.1 서버 포스팅: http://localhost:${PORT}`);
  console.log(`📡 웹훅 URL: http://localhost:${PORT}/webhook`);
});
