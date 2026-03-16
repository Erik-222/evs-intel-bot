/**
 * Microsoft Teams Workflows í´ë¼ì´ì¸í¸ â Adaptive Cardë¡ ë¶ì ê²°ê³¼ë¥¼ Teams ì±ëì í¬ì¤í
 *
 * Teams Workflows webhook URLë¡ POST ìì²­ì ë³´ë´ ì±ëì ë©ìì§ë¥¼ ê²ìí©ëë¤.
 * (ê¸°ì¡´ Incoming Webhook ì»¤ë¥í°ì ê³µì ëì²´ ë°©ì)
 */

const axios = require('axios');

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

/**
 * ë¶ë¦¿í¬ì¸í¸ ë°°ì´ì Adaptive Cardì© íì¤í¸ë¡ ë³í
 */
function formatBullets(arr) {
  if (Array.isArray(arr)) {
    return arr.map(item => `â¢ ${item}`).join('\n');
  }
  return arr || '';
}

/**
 * Adaptive Cardë¥¼ ë§ë¤ì´ Teams ì±ëì í¬ì¤í
 */
async function postToTeams({ title, url, userMemo, category, summary, insight, importance }) {
  if (!TEAMS_WEBHOOK_URL) {
    console.error('TEAMS_WEBHOOK_URLì´ ì¤ì ëì§ ìììµëë¤.');
    return { success: false, error: 'TEAMS_WEBHOOK_URL ë¯¸ì¤ì ' };
  }

  try {
    // ì¹´íê³ ë¦¬ë³ ìì
    const categoryColors = {
      'ê¸°ì ëí¥': 'Good',
      'ìì¥ëí¥': 'Accent',
      'ì ë¶ì ì±': 'Warning',
      'ê²½ìì¬/ë í¼ë°ì¤': 'Accent',
      'ìì¨ì£¼í/ë¡ë´': 'Good',
      'EV/ì¶©ì ì¸íë¼': 'Attention',
      'ê¸°í': 'Default',
    };

    // ì¤ìë íì
    const importanceDisplay = {
      'ì': 'ð´ ì (ì¦ì íì¸)',
      'ì¤': 'ð¡ ì¤ (ì°¸ê³ )',
      'í': 'ð¢ í (ì¼ë°)',
    };

    const categoryEmoji = {
      'ê¸°ì ëí¥': 'ð¬', 'ìì¥ëí¥': 'ð', 'ì ë¶ì ì±': 'ðï¸',
      'ê²½ìì¬/ë í¼ë°ì¤': 'ð¢', 'ìì¨ì£¼í/ë¡ë´': 'ð¤',
      'EV/ì¶©ì ì¸íë¼': 'â¡', 'ê¸°í': 'ð',
    };

    const emoji = categoryEmoji[category] || 'ð';
    const color = categoryColors[category] || 'Default';
    const today = new Date().toISOString().split('T')[0];

    // summary/insightë¥¼ ë¶ë¦¿í¬ì¸í¸ íì¤í¸ë¡ ë³í
    const summaryText = formatBullets(summary);
    const insightText = formatBullets(insight);

    // Adaptive Card v1.4 (Teams í¸í)
    const cardBody = [
      // í¤ë: ì¹´íê³ ë¦¬ + ì ëª©
      {
        type: 'TextBlock',
        text: `${emoji} [${category}] ${title}`,
        weight: 'Bolder',
        size: 'Medium',
        wrap: true,
        style: color,
      },
      // ë©í ì ë³´
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [
              {
                type: 'TextBlock',
                text: `ì¤ìë: ${importanceDisplay[importance] || 'ð¡ ì¤'}`,
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
                text: `ð ${today}`,
                size: 'Small',
                isSubtle: true,
              },
            ],
          },
        ],
      },
      // êµ¬ë¶ì 
      {
        type: 'TextBlock',
        text: 'âââââââââââââââââââ',
        size: 'Small',
        isSubtle: true,
        spacing: 'Small',
      },
      // AI ìì½ (ë¶ë¦¿í¬ì¸í°)
      {
        type: 'TextBlock',
        text: 'ð **AI ìì½**',
        weight: 'Bolder',
        size: 'Small',
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: summaryText,
        wrap: true,
        size: 'Default',
      },
      // EVS ì¸ì¬ì´í¸ (ë¶ë¦¿í¬ì¸í¸)
      {
        type: 'TextBlock',
        text: 'ð¡ **EVS ì¸ì¬ì´í¸**',
        weight: 'Bolder',
        size: 'Small',
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: insightText,
        wrap: true,
        size: 'Default',
      },
    ];

    // ì¬ì©ì ë©ëª¨ (ìë ê²½ì°)
    if (userMemo) {
      cardBody.push(
        {
          type: 'TextBlock',
          text: 'âï¸ **ë©ëª¨**',
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

    // ì¡ì ë²í¼ (URLì´ ìë ê²½ì°ìë§)
    const actions = [];
    if (url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'ð ìë¬¸ ë³´ê¸°',
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

    console.log(`â Teams í¬ì¤í ì±ê³µ: ${title}`);
    return { success: true };

  } catch (error) {
    console.error('Teams í¬ì¤í ì¤ë¥:', error.message);

    if (error.response) {
      console.error('ìëµ ìí:', error.response.status);
      console.error('ìëµ ë°ì´í°:', JSON.stringify(error.response.data).substring(0, 500));
    }

    return { success: false, error: error.message };
  }
}

module.exports = { postToTeams };
