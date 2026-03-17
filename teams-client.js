/**
 * Microsoft Teams Workflows 클라이언트 — Adaptive Card로 분석 결과를 Teams 채널에 포스팅
 *
 * Teams Workflows webhook URL로 POST 요청을 보내 채널에 메시지를 게시합니다.
 * (기존 Incoming Webhook 커넥터의 공식 대체 방식)
 */

const axios = require('axios');

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

/**
 * 불릿포인트 배열을 Adaptive Card용 텍스트로 변환
 * \n\n (이중 줄바꿈)으로 각 불릿 사이에 간격 확보
 */
function formatBullets(arr) {
  if (Array.isArray(arr)) {
    return arr.map(item => `• ${item}`).join('\n\n');
  }
  return arr || '';
}

/**
 * Adaptive Card를 만들어 Teams 채널에 포스팅
 */
async function postToTeams({ title, url, userMemo, category, summary_what, summary_analysis, summary_evs, importance, author }) {
  if (!TEAMS_WEBHOOK_URL) {
    console.error('TEAMS_WEBHOOK_URL이 설정되지 않았습니다.');
    return { success: false, error: 'TEAMS_WEBHOOK_URL 미설정' };
  }

  try {
    // 카테고리별 색상
    const categoryColors = {
      '기술동향': 'Good',
      '시장동향': 'Accent',
      '정부정책': 'Warning',
      '경쟁사/레퍼런스': 'Accent',
      '자율주행/로봇': 'Good',
      'EV/충전인프라': 'Attention',
      '기타': 'Default',
    };

    // 중요도 표시
    const importanceDisplay = {
      '상': '🔴 상 (즉시 확인)',
      '중': '🟡 중 (참고)',
      '하': '🟢 하 (일반)',
    };

    const categoryEmoji = {
      '기술동향': '🔬', '시장동향': '📈', '정부정책': '🏛️',
      '경쟁사/레퍼런스': '🏢', '자율주행/로봇': '🤖',
      'EV/충전인프라': '⚡', '기타': '📌',
    };

    const emoji = categoryEmoji[category] || '📌';
    const color = categoryColors[category] || 'Default';
    const today = new Date().toISOString().split('T')[0];

    // 3섹션 불릿포인트 텍스트로 변환
    const whatText = formatBullets(summary_what);
    const analysisText = formatBullets(summary_analysis);
    const evsText = formatBullets(summary_evs);

    // 작성자 표시
    const authorDisplay = author && author !== '알 수 없음' ? author : '';

    // Adaptive Card v1.4 (Teams 호환)
    const cardBody = [
      // 헤더: 카테고리 + 제목
      {
        type: 'TextBlock',
        text: `${emoji} [${category}] ${title}`,
        weight: 'Bolder',
        size: 'Medium',
        wrap: true,
        style: color,
      },
      // 메타 정보: 중요도 + 날짜 + 작성자
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [
              {
                type: 'TextBlock',
                text: `중요도: ${importanceDisplay[importance] || '🟡 중'}`,
                size: 'Small',
                isSubtle: true,
              },
            ],
          },
          {
            type: 'Column',
            width: 'auto',
            items: [
              {
                type: 'TextBlock',
                text: `📅 ${today}`,
                size: 'Small',
                isSubtle: true,
              },
            ],
          },
          ...(authorDisplay ? [{
            type: 'Column',
            width: 'auto',
            items: [
              {
                type: 'TextBlock',
                text: `✍️ ${authorDisplay}`,
                size: 'Small',
                isSubtle: true,
              },
            ],
          }] : []),
        ],
      },
      // 구분선
      {
        type: 'TextBlock',
        text: '───────────────────',
        size: 'Small',
        isSubtle: true,
        spacing: 'Small',
      },
      // ❓ 이게 무엇인가?
      {
        type: 'TextBlock',
        text: '❓ **이게 무엇인가?**',
        weight: 'Bolder',
        size: 'Small',
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: whatText,
        wrap: true,
        size: 'Default',
      },
      // 🔍 핵심 분석
      {
        type: 'TextBlock',
        text: '🔍 **핵심 분석**',
        weight: 'Bolder',
        size: 'Small',
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: analysisText,
        wrap: true,
        size: 'Default',
      },
      // 💡 EVS 활용
      {
        type: 'TextBlock',
        text: '💡 **EVS 활용**',
        weight: 'Bolder',
        size: 'Small',
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: evsText,
        wrap: true,
        size: 'Default',
      },
    ];

    // 사용자 메모 (있는 경우)
    if (userMemo) {
      cardBody.push(
        {
          type: 'TextBlock',
          text: '✏️ **메모**',
          weight: 'Bolder',
          size: 'Small',
          spacing: 'Medium',
        },
        {
          type: 'TextBlock',
          text: userMemo,
          wrap: true,
          size: 'Small',
          isSubtle: true,
        }
      );
    }

    // 액션 버튼 (URL이 있는 경우에만)
    const actions = [];
    if (url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: '🔗 원문 보기',
        url: url,
      });
    }

    const adaptiveCard = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: cardBody,
            ...(actions.length > 0 ? { actions } : {}),
          },
        },
      ],
    };

    const response = await axios.post(TEAMS_WEBHOOK_URL, adaptiveCard, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    console.log(`✅ Teams 포스팅 성공: ${title} (작성자: ${authorDisplay || 'N/A'})`);
    return { success: true };

  } catch (error) {
    console.error('Teams 포스팅 오류:', error.message);

    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', JSON.stringify(error.response.data).substring(0, 500));
    }

    return { success: false, error: error.message };
  }
}

module.exports = { postToTeams };
