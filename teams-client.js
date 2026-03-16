/**
 * Microsoft Teams Workflows 클라이언트 — Adaptive Card로 분석 결과를 Teams 채널에 포스팅
 *
 * Teams Workflows webhook URL로 POST 요청을 보내 채널에 메시지를 게시합니다.
 * (기존 Incoming Webhook 커넥터의 공식 대체 방식)
 */

const axios = require('axios');

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

/**
 * Adaptive Card를 만들어 Teams 채널에 포스팅
 */
async function postToTeams({ title, url, userMemo, category, summary, insight, importance }) {
  if (!TEAMS_WEBHOOK_URL) {
    console.error('TEAMS_WEBHOOK_URL이 설정되지 않았습니다.');
    return { success: false, error: 'TEAMS_WEBHOOK_URL 미설정' };
  }

  try {
    // 카테고리별 색상
    const categoryColors = {
      '기술동향': 'Good',        // 초록
      '시장동향': 'Accent',      // 파랑
      '정부정책': 'Warning',     // 노랑
      '경쟁사/레퍼런스': 'Accent',
      '자율주행/로봇': 'Good',
      'EV/충전인프라': 'Attention', // 빨강
      '기타': 'Default',
    };

    // 중요도 표시
    const importanceDisplay = {
      '상': '🔴 상 (즉시 확인)',
      '중': '🟡 중 (참고)',
      '하': '🟢 하 (일반)',
    };

    const categoryEmoji = {
      '기술동향': '🔬',
      '시장동향': '📈',
      '정부정책': '🏛️',
      '경쟁사/레퍼런스': '🏢',
      '자율죽행/로봇': '🤖',
      'EV/충전인프라': '⚡',
      '기타': '📌',
    };

    const emoji = categoryEmoji[category] || '📌';
    const color = categoryColors[category] || 'Default';
    const today = new Date().toISOString().split('T')[0];

    // Adaptive Card v1.4 (Teams 호환)
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
            body: [
              // 헤더: 카테고리 + 제목
              {
                type: 'TextBlock',
                text: `${emoji} [${category}] ${title}`,
                weight: 'Bolder',
                size: 'Medium',
                wrap: true,
                style: color,
              },
              // 메타 정보
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
              // AI 요약
              {
                type: 'TextBlock',
                text: '📝 **AI 요앹**',
                weight: 'Bolder',
                size: 'Small',
                spacing: 'Medium',
              },
              {
                type: 'TextBlock',
                text: summary,
                wrap: true,
                size: 'Default',
              },
              // EVS 인사이트
              {
                type: 'TextBlock',
                text: '💡 **EVS 인사이트**',
                weight: 'Bolder',
                size: 'Small',
                spacing: 'Medium',
              },
              {
                type: 'TextBlock',
                text: insight,
                wrap: true,
                size: 'Default',
              },
              // 사용자 메모 (있는 경우)
              ...(userMemo
                ? [
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
                    },
                  ]
                : []),
            ],
            actions: [
              {
                type: 'Action.OpenUrl',
                title: '🔗 원문 보기',
                url: url,
              },
            ],
          },
        },
      ],
    };

    const response = await axios.post(TEAMS_WEBHOOK_URL, adaptiveCard, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    console.log(`✅ Teams 포스팅 성공: ${title}`);
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
