/**
 * EVS Intel Bot - ì¹´ì¹´ì¤í¡ ì±ë´ ì¹í ìë²
 *
 * íë¦ A: ì¹´í¡ URL ìì  â í¬ë¡¤ë§ â Gemini AI ë¶ì â Teams í¬ì¤í (ë¶ë¦¿í¬ì¸í¸) â ì¹´í¡ ìëµ
 * íë¦ B: í¬ë¡ë§ ì¤í¨ â ì ì ìê² ì§ì  ìì½ ìì²­ â ì ì ê° íì¤í¸ ì ì¡ â AI ë¤ë¬ê¸° â Teams í¬ì¤í
 */

require('dotenv').config();
const express = require('express');
const { crawlUrl } = require('./crawler');
const { analyzeContent, polishUserSummary } = require('./ai-processor');
const { postToTeams } = require('./teams-client');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== ë¶ë¦¿í¬ì¸í¸ í¬ë§· í¬í¼ =====
function formatBullets(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => `â¢ ${item}`).join('\n');
}

// ===== ì¬ì¤ì²´í¬ =====
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', bot: 'EVS Intel Bot', version: '3.0.0' });
});

// ===== ì¹´ì¹´ì¤ ì¤íë¹ë ì¤í¬ íì¤í¸ì© GET =====
app.get('/webhook', (req, res) => {
  res.status(200).json({ status: 'ok', endpoint: 'webhook ready' });
});

// ===== ì¹´ì¹´ì¤ ì¤íë¹ë ì¹í ìëí¬ì¸í¸ =====
app.post('/webhook', async (req, res) => {
  const startTime = Date.now();

  try {
    const body = req.body || {};
    const userRequest = body.userRequest || {};
    const userMessage = userRequest.utterance || '';

    console.log(`[${new Date().toISOString()}] ìì : ${userMessage.substring(0, 100)}`);

    // URL ì¶ì¶
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = userMessage.match(urlRegex);

    if (!urls || urls.length === 0) {
      // URL ìì â ìë ìì½ íì¤í¸ì¸ì§ íë¨
      const trimmed = userMessage.trim();

      if (trimmed.length >= 15) {
        // 15ì ì´ìì´ë©´ ìë ìì½ì¼ë¡ ì²ë¦¬
        console.log(`[ìë ìì½] íì¤í¸ ê¸¸ì´: ${trimmed.length}`);

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
            .then(r => console.log('ìë ìì½ ë°±ê·¸ë¼ì´ë ìë£:', r))
            .catch(err => console.error('ìë ìì½ ë°±ê·¸ë¼ì´ë ì¤ë¥:', err));
          response = buildTextResponse(
            'ð¥ ìì½ ì ì ìë£!\n\në¤ë¬ì´ì Teamsì ì¬ë¦¬ë ì¤ì´ìì. ì ìë§ ê¸°ë¤ë ¤ì£¼ì¸ì.'
          );
        }

        const elapsed = Date.now() - startTime;
        console.log(`[DEBUG] ìë ìì½ ìëµ (${elapsed}ms)`);
        return res.status(200).json(response);
      }

      // ì§§ì íì¤í¸ â ìë´ ë©ìì§
      const response = buildTextResponse(
        'ð ë§í¬ë¥¼ ë³´ë´ì£¼ìë©´ ìëì¼ë¡ ë¶ìí´ì Teamsì í¬ì¤íí´ëë ¤ì!\n\n' +
        'ëë ìì½/ì¸ì¬ì´í¸ë¥¼ ì§ì  ìë ¥íìë©´ ë¤ë¬ì´ì Teamsì ì¬ë ¤ëë¦´ê²ì.\n\n' +
        'ìì 1: https://example.com/article\n' +
        'ìì 2: ì ê¸°ì°¨ ì¶©ì  ìì¥ì´ 2025ë 10ì¡°ì ê·ëª¨ë¡ ì±ì¥...'
      );
      return res.status(200).json(response);
    }

    // URL ìì â ê¸°ì¡´ í¬ë¡¤ë§+ë¶ì íë¡ì°
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
        .then(r => console.log('ë°±ê·¸ë¼ì´ë ì²ë¦¬ ìë£:', r))
        .catch(err => console.error('ë°±ê·¸ë¼ì´ë ì¤ë¥:', err));
      response = buildTextResponse(
        `ð¥ ë§í¬ ì ì ìë£!\n${url}\n\në¶ì ì¤ì´ìì. ì ì í Teams ì±ëìì íì¸íì¸ì.`
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`[DEBUG] ìëµ ì ì¡ (${elapsed}ms)`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('ì¹í ì²ë¦¬ ì¤ë¥:', error);
    const response = buildTextResponse('ì²ë¦¬ ì¤ ì¤ë¥ê° ë°ìíì´ì. ë¤ì ìëí´ì£¼ì¸ì.');
    return res.status(200).json(response);
  }
});

// ===== ë§í¬ ì²ë¦¬ íì´íë¼ì¸ =====
async function processLink(url, userMemo) {
  try {
    // 1. í¬ë¡¤ë§
    console.log(`[í¬ë¡ë§] ${url}`);
    const crawled = await crawlUrl(url);

    if (!crawled.success) {
      // í¬ë¡¤ë§ ì¤í¨ â ì ì ìê² ì§ì  ìì½ ìì²­
      console.log(`[í¬ë¡¤ë§ ì¤í¨] ${url}: ${crawled.error}`);
      return (
        `â ï¸ ë§í¬ë¥¼ ì½ì ì ììì´ì.\n${url}\n\n` +
        `ì¬ì : ${crawled.error}\n\n` +
        `ð ìì½ë³¸/ì¸ì¬ì´í¸ë¥¼ ì§ì  ìë ¥í´ì£¼ìë©´ ë¤ë¬ì´ì Teamsì ì¬ë ¤ëë¦´ê²ì!`
      );
    }

    // 2. Gemini AI ë¶ì
    console.log(`[AI ë¶ì] ${crawled.title}`);
    const analysis = await analyzeContent(crawled.title, crawled.content, url, userMemo);

    // 3. Teams ì±ë í¬ì¤í
    console.log(`[Teams í¬ì¤í] ${analysis.title}`);
    const teamsResult = await postToTeams({
      title: analysis.title,
      url: url,
      userMemo: userMemo,
      category: analysis.category,
      summary: analysis.summary,
      insight: analysis.insight,
      importance: analysis.importance,
    });

    // 4. ì¹´í¡ ìëµ ìì±
    const categoryEmoji = {
      'ê¸°ì ëí¥': 'ð¬', 'ìì¥ëí¥': 'ð', 'ì ë¶ì ì±': 'ðï¸',
      'ê²½ìì¬/ë í¼ë°ì¤': 'ð¢', 'ìì¨ì£¼í/ë¡ë´': 'ð¤',
      'EV/ì¶©ì ì¸íë¼': 'â¡', 'ê¸°í': 'ð',
    };

    const emoji = categoryEmoji[analysis.category] || 'ð';
    const importanceStars = { 'ì': 'â­â­â­', 'ì¤': 'â­â­', 'í': 'â­' };
    const teamsStatus = teamsResult.success ? 'â Teams í¬ì¤í ìë£' : 'â ï¸ Teams í¬ì¤í ì¤í¨ (ë¡ê·¸ íì¸)';

    return (
      `${emoji} [${analysis.category}] ${analysis.title}\n\n` +
      `ð ìì½:\n${formatBullets(analysis.summary)}\n\n` +
      `ð¡ EVS ì¸ì¬ì´í¸:\n${formatBullets(analysis.insight)}\n\n` +
      `ì¤ìë: ${importanceStars[analysis.importance] || 'â­â­'}\n` +
      teamsStatus
    );
  } catch (error) {
    console.error('processLink ì¤ë¥:', error);
    return `â ì²ë¦¬ ì¤ ì¤ë¥ ë°ì\n${url}\n\nì¬ì : ${error.message}`;
  }
}

// ===== ìë ìì½ ì²ë¦¬ íì´íë¼ì¸ =====
async function processManualSummary(userText) {
  try {
    // 1. AIë¡ ë¤ë¬ê¸°
    console.log(`[ìë ìì½ ì²ë¦¬] íì¤í¸: ${userText.substring(0, 50)}...`);
    const analysis = await polishUserSummary(userText);

    // 2. Teams í¬ì¤í
    console.log(`[Teams í¬ì¤í] ${analysis.title} (ìë ìì½)`);
    const teamsResult = await postToTeams({
      title: analysis.title,
      url: '',
      userMemo: '',
      category: analysis.category,
      summary: analysis.summary,
      insight: analysis.insight,
      importance: analysis.importance,
    });

    // 3. ì¹´í¡ ìëµ
    const categoryEmoji = {
      'ê¸°ì ëí¥': 'ð¬', 'ìì¥ëí¥': 'ð', 'ì ë¶ì ì±': 'ðï¸',
      'ê²½ìì¬/ë í¼ë°ì¤': 'ð¢', 'ìì¨ì£¼í/ë¡ë´': 'ð¤',
      'EV/ì¶©ì ì¸íë¼': 'â¡', 'ê¸°í': 'ð',
    };

    const emoji = categoryEmoji[analysis.category] || 'ð';
    const teamsStatus = teamsResult.success ? 'â Teams í¬ì¤í ìë£' : 'â ï¸ Teams í¬ì¤í ì¤í¨';

    return (
      `${emoji} [${analysis.category}] ${analysis.title}\n\n` +
      `ð ìì½:\n${formatBullets(analysis.summary)}\n\n` +
      `ð¡ EVS ì¸ì¬ì´í¸:\n${formatBullets(analysis.insight)}\n\n` +
      teamsStatus
    );
  } catch (error) {
    console.error('processManualSummary ì¤ë¥:', error);
    return `â ìì½ ì²ë¦¬ ì¤ ì¤ë¥ê° ë°ìíì´ì.\nì¬ì : ${error.message}\n\në¤ì ìëí´ì£¼ì¸ì.`;
  }
}

// ===== ì¹´ì¹´ì¤ ìëµ í¬ë§· =====
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

// ===== ìë² ìì =====
app.listen(PORT, () => {
  console.log(`ð EVS Intel Bot ìë² ìì: http://localhost:${PORT}`);
  console.log(`ð¡ ì¹í URL: http://localhost:${PORT}/webhook`);
});
