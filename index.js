/**
 * EVS Intel Bot - 카카오톡 챗봇 웹훅 서버 v5.4
 *
 * 흐름: 카톡 수신 → 크롤링/분석 → 카톡 프리뷰 → 확인/수정 → Teams 게시
 *
 * 1. URL 또는 텍스트 수신 → AI 분석 → 카톡으로 요약 프리뷰 전송
 * 2. "확인" → Teams 게시
 * 3. 수정의견 입력 → AI 재수정 → 카톡으로 수정본 재전송
 * 4. 다시 "확인" → Teams 게시
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
  if (!Array.isArray(arr)) return arr || '';
  return arr.map(item => `• ${item}`).join('\n');
}

// ===== 프리뷰 텍스트 생성 (카톡으로 전송) =====
function buildPreviewText(analysis, url) {
  const categoryEmoji = {
    '기술동향': '🔬', '시장동향': '📈', '정부정책': '🏛️',
    '경쟁사/레퍼런스': '🏢', '자율주행/로봇': '🤖',
    'EV/충전인프라': '⚡', '기타': '📌',
  };
  const emoji = categoryEmoji[analysis.category] || '📌';

  let text =
    `📋 요약 프리뷰\n` +
    `━━━━━━━━━━━━━━━\n` +
    `${emoji} [${analysis.category}] ${analysis.title}\n\n` +
    `❓ 이게 무엇인가?\n${formatBullets(analysis.summary_what)}\n\n` +
    `🔍 핵심 분석\n${formatBullets(analysis.summary_analysis)}\n\n` +
    `💡 EVS 활용\n${formatBullets(analysis.summary_evs)}`;

  if (url) {
    text += `\n🔗 ${url}`;
  }

  text += `\n━━━━━━━━━━━━━━━\n`;
  text += `✅ "확인" → Teams 게시\n`;
  text += `✏️ 수정사항 입력 → 재수정 후 다시 프리뷰`;

  return text;
}

// ===== 포스팅 완료 알림 텍스트 =====
function buildPostedText(analysis, url) {
  const categoryEmoji = {
    '기술동향': '🔬', '시장동향': '📈', '정부정책': '🏛️',
    '경쟁사/레퍼런스': '🏢', '자율주행/로봇': '🤖',
    'EV/충전인프라': '⚡', '기타': '📌',
  };
  const emoji = categoryEmoji[analysis.category] || '📌';

  let text =
    `✅ Teams 게시 완료!\n` +
    `━━━━━━━━━━━━━━━\n` +
    `${emoji} [${analysis.category}] ${analysis.title}`;

  if (url) {
    text += `\n🔗 ${url}`;
  }

  return text;
}

// ===== 여스체크 =====
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', bot: 'EVS Intel Bot', version: '5.4.0' });
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

    // ===== 1. "확인" → Teams 게시 =====
    if (trimmed === '확인') {
      const pending = pendingPosts.get(userId);
      if (!pending) {
        return res.status(200).json(buildTextResponse(
          '⚠️ 대기 중인 포스팅이 없어요.\n링크나 요약 텍스트를 보내주세요!'
        ));
      }
      if (pending.posted) {
        return res.status(200).json(buildTextResponse('✅ 이미 Teams에 게시되었어요!'));
      }

      // Teams에 포스팅
      console.log(`[Teams 게시] ${pending.analysis.title}`);
      const postResult = await postToTeams({
        title: pending.analysis.title,
        url: pending.url || '',
        userMemo: pending.userMemo || '',
        category: pending.analysis.category,
        summary_what: pending.analysis.summary_what,
        summary_analysis: pending.analysis.summary_analysis,
        summary_evs: pending.analysis.summary_evs,
        importance: pending.analysis.importance,
        author: pending.author,
      });

      if (postResult.success) {
        pending.posted = true;
        pendingPosts.set(userId, pending);
        const elapsed = Date.now() - startTime;
        console.log(`[Teams 게시 완료] (${elapsed}ms)`);
        return res.status(200).json(buildTextResponse(
          buildPostedText(pending.analysis, pending.url)
        ));
      } else {
        return res.status(200).json(buildTextResponse(
          `⚠️ Teams 게시 실패\n사유: ${postResult.error}\n\n다시 "확인"을 입력해주세요.`
        ));
      }
    }

    // ===== 2. URL 추출 =====
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = userMessage.match(urlRegex);

    if (urls && urls.length > 0) {
      // URL 있음 → 크롤링+분석 → 카톡 프리뷰
      const url = urls[0];
      const userMemo = userMessage.replace(urlRegex, '').trim();

      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const processPromise = processLinkPreview(url, userMemo, userId, userNickname);
      const result = await Promise.race([processPromise, timeoutPromise]);

      let response;
      if (result) {
        // 3.5초 안에 분석 완료 → 프리뷰 바로 전송
        const p = pendingPosts.get(userId);
        if (p) { p.previewShown = true; pendingPosts.set(userId, p); }
        response = buildTextResponse(result);
      } else {
        // 3.5초 초과 → 백그라운드 분석 계속, 완료되면 pendingPosts에 저장됨
        processPromise
          .then(r => {
            console.log('백그라운드 링크 분석 완료 — 다음 메시지에 프리뷰 전송 예정');
          })
          .catch(err => console.error('백그라운드 링크 오류:', err));
        response = buildTextResponse(
          `📥 링크 접수!\n${url}\n\n분석 중이에요. 완료되메 아무 말이나 입력해주세요!`
        );
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] URL 처리 응답 (${elapsed}ms)`);
      return res.status(200).json(response);
    }

    // ===== 3. 대기 중인 포스트 확인 =====
    const pending = pendingPosts.get(userId);

    if (pending && !pending.posted) {
      // 3-A. 프리뷰가 아직 안 보여진 경우 → 저장된 프리뷰 바로 전송
      if (!pending.previewShown && pending.analysis) {
        pending.previewShown = true;
        pendingPosts.set(userId, pending);
        console.log(`[프리뷰 재전송] userId: ${userId.substring(0, 8)}, title: ${pending.analysis.title}`);
        const elapsed = Date.now() - startTime;
        console.log(`[DEBUG] 저장된 프리뷰 전송 (${elapsed}ms)`);
        return res.status(200).json(buildTextResponse(
          buildPreviewText(pending.analysis, pending.url)
        ));
      }

      // 3-B. 프리뷰는 봤고 + 수정 피드백 입력 (2자 이상)
      if (pending.previewShown && trimmed.length >= 2) {
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
        const revisePromise = processRevision(userId, trimmed, userNickname);
        const result = await Promise.race([revisePromise, timeoutPromise]);

        let response;
        if (result) {
          // 수정 완료 → 프리뷰 다시 보여줌 (previewShown 유지)
          response = buildTextResponse(result);
        } else {
          revisePromise
            .then(r => {
              console.log('백그라운드 수정 완료 — 다음 메시지에 수정본 전송 예정');
              // 수정 완료 후 previewShown을 false로 → 다음 메시지에 바로 보여줌
              const p = pendingPosts.get(userId);
              if (p) { p.previewShown = false; pendingPosts.set(userId, p); }
            })
            .catch(err => console.error('백그라운드 수정 오류:', err));
          response = buildTextResponse(
            '📝 수정 반영 중이에요. 완료되면 아무 말이나 입력해주세요!'
          );
        }

        const elapsed = Date.now() - startTime;
        console.log(`[DEBUG] 수정 처리 응답 (${elapsed}ms)`);
        return res.status(200).json(response);
      }
    }

    // ===== 4. URL 없음 + 대기 없음 + 15자 이상 → 수동 요약 → 카톡 프리뷰 =====
    if (trimmed.length >= 15) {
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
      const processPromise = processManualPreview(trimmed, userId, userNickname);
      const result = await Promise.race([processPromise, timeoutPromise]);

      let response;
      if (result) {
        const p = pendingPosts.get(userId);
        if (p) { p.previewShown = true; pendingPosts.set(userId, p); }
        response = buildTextResponse(result);
      } else {
        processPromise
          .then(r => {
            console.log('수동 요약 백그라운드 완료 — 다음 메시지에 프리뷰 전송 예정');
          })
          .catch(err => console.error('수동 요약 백그라운드 오류:', err));
        response = buildTextResponse(
          '📥 요약 접수!\n\n분석 중이에요. 완료되면 아무 말이나 입력해주세요!'
        );
      }

      const elapsed = Date.now() - startTime;
      console.log(`[DEBUG] 수동 요약 응답 (${elapsed}ms)`);
      return res.status(200).json(response);
    }

    // ===== 5. 짧은 텍스트 → 안내 메시지 =====
    return res.status(200).json(buildTextResponse(
      '📎 링크를 보내주시메 자동으로 분석해서 프리뷰를 보내드려요!\n\n' +
      '또는 요약/인사이트를 직접 입력하시메 다들어서 프리뷰를 보내드릴게요.\n\n' +
      '예시 1: https://example.com/article\n' +
      '예시 2: 전기차 충전 시장이 2025년 10조원 규모로 성장...'
    ));

  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    return res.status(200).json(buildTextResponse('처리 중 오류가 발생했어요. 다시 시도해주세요.'));
  }
});

// ===== 링크 처리 → 분석 → 카톡 프리뷰 (Teams 미전송) =====
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
        `📝 요약본/인사이트를 직접 입력해주시면 다듬어서 프리뷰를 보내드릴게요!`
      );
    }

    // 2. Gemini AI 분석
    console.log(`[AI 분석] ${crawled.title}`);
    const analysis = await analyzeContent(crawled.title, crawled.content, url, userMemo);

    // 3. 프리뷰 대기 상태 저장 (Teams 미전송, previewShown은 호출자가 설정)
    pendingPosts.set(userId, {
      analysis,
      url,
      userMemo,
      author: userNickname,
      posted: false,
      previewShown: false,
      createdAt: Date.now(),
    });

    console.log(`[프리뷰 준비] userId: ${userId.substring(0, 8)}, title: ${analysis.title}`);

    // 4. 카톡 프리뷰 텍스트 리턴
    return buildPreviewText(analysis, url);
  } catch (error) {
    console.error('processLinkPreview 오류:', error);
    return `❌ 처리 중 오류 발생\n${url}\n\n사유: ${error.message}`;
  }
}

// ===== 수동 요약 → 분석 → 카톡 프리뷰 (Teams 미전송) =====
async function processManualPreview(userText, userId, userNickname) {
  try {
    console.log(`[수동 요약 처리] 텍스트: ${userText.substring(0, 50)}...`);
    const analysis = await polishUserSummary(userText);

    // 프리뷰 대기 상태 저장 (Teams 미전송, previewShown은 호출자가 설정)
    pendingPosts.set(userId, {
      analysis,
      url: '',
      userMemo: '',
      author: userNickname,
      posted: false,
      previewShown: false,
      createdAt: Date.now(),
    });

    console.log(`[프리뷰 준비] userId: ${userId.substring(0, 8)}, title: ${analysis.title}`);

    return buildPreviewText(analysis, '');
  } catch (error) {
    console.error('processManualPreview 오류:', error);
    return `❌ 요약 처리 중 오류가 발생했어요.\n사유: ${error.message}\n\n다시 시도해주세요.`;
  }
}

// ===== 수정 피드백 → 재수정 → 카톡 프리뷰 재전송 (Teams 미전송) =====
async function processRevision(userId, feedback, userNickname) {
  try {
    const pending = pendingPosts.get(userId);
    if (!pending) return '⚠️ 수정할 포스팅이 없어요.';

    console.log(`[수정 요청] 피드백: ${feedback.substring(0, 50)}...`);
    const revised = await reviseAnalysis(pending.analysis, feedback);

    // 대기 상태 업데이트 (Teams 미전송)
    pendingPosts.set(userId, {
      ...pending,
      analysis: revised,
      posted: false,
      createdAt: Date.now(),
    });

    console.log(`[수정 프리뷰] title: ${revised.title}`);

    // 카톡 프리뷰 재전송
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

// ===== 서버 시작 =====
app.listen(PORT, () => {
  console.log(`🚀 EVS Intel Bot v5.4 서버 시작: http://localhost:${PORT}`);
  console.log(`📡 웹훅 URL: http://localhost:${PORT}/webhook`);
});
