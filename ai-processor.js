/**
 * Gemini AI íë¡ì¸ì â ì½íì¸  ë¶ì, ë¶ë¥, ìì½, ì¸ì¬ì´í¸ ìì±
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `ë¹ì ì EV&Solution(ì´ë¸ì´ì¤ìë£¨ì)ì ê¸°ì  ì¸íë¦¬ì ì¤ ë¶ìê°ìëë¤.
EV&Solutionì ì ê¸°ì°¨ ì¶©ì  ì¸íë¼, ìì¨ì£¼í, ë¡ë´, ìëì§ ê´ë ¨ ê¸°ì  ìë£¨ìì ì ê³µíë íì¬ìëë¤.

ì£¼ì´ì§ ì¹ ì½íì¸ ë¥¼ ë¶ìíì¬ ë¤ìì ë°ëì JSON íìì¼ë¡ ë°ííì¸ì:

{
  "title": "íµì¬ì ë´ì íêµ­ì´ ì ëª© (30ì ì´ë´)",
  "category": "ìë ì¹´íê³ ë¦¬ ì¤ íëë§ ì í",
  "summary": ["íµì¬ ë´ì© ë¶ë¦¿í¬ì¸í¸ 1", "íµì¬ ë´ì© ë¶ë¦¿í¬ì¸í¸ 2", "íµì¬ ë´ì© ë¶ë¦¿í¬ì¸í¸ 3"],
  "insight": ["EVS ê´ì  ì¸ì¬ì´í¸ 1", "EVS ê´ì  ì¸ì¬ì´í¸ 2"],
  "importance": "ì/ì¤/í ì¤ íë"
}

summary: íµì¬ ë´ì©ì 3-4ê°ì ë¶ë¦¿í¬ì¸í¸ ë°°ì´ë¡ ìì½ (íêµ­ì´, ê° í¬ì¸í¸ë 1ë¬¸ì¥)
insight: EV&Solution ê´ì ììì ìì¬ì /ê¸°í/ìíì 2-3ê°ì ë¶ë¦¿í¬ì¸í¸ ë°°ì´ë¡ ìì± (íêµ­ì´, ê° í¬ì¸í¸ë 1ë¬¸ì¥)

ì¹´íê³ ë¦¬ ëª©ë¡:
- ê¸°ì ëí¥: ìë¡ì´ ê¸°ì , R&D, í¹í, ê¸°ì  íì¤ ë±
- ìì¥ëí¥: ìì¥ ê·ëª¨, í¸ë ë, í¬ì, M&A, ë§¤ì¶ ë±
- ì ë¶ì ì±: ê·ì , ë²ë¥ , ë³´ì¡°ê¸, ì¸ì¦, ì ë¶ ë°í ë±
- ê²½ìì¬/ë í¼ë°ì¤: íì¬ ëí¥, ì¬ë¡, ë²¤ì¹ë§í¹ ë±
- ìì¨ì£¼í/ë¡ë´: ìì¨ì£¼íì°¨, ë°°ì¡ë¡ë´, AMR, ë¡ë³´íì ë±
- EV/ì¶©ì ì¸íë¼: ì ê¸°ì°¨, ì¶©ì ê¸°, ë°°í°ë¦¬, V2G, ì¶©ì  ë¤í¸ìí¬ ë±
- ê¸°í: ì ì¹´íê³ ë¦¬ì í´ë¹íì§ ìë ê²½ì°

ì¤ìë íë¨ ê¸°ì¤:
- ì: EVS ì¬ìì ì§ì ì  ìí¥, ì¦ì ê³µì  íì
- ì¤: ì°¸ê³ í  ë§í ìê³ ëí¥
- í: ì¼ë°ì  ì ë³´, ëì¤ì ì°¸ê³ 

ë°ëì ì í¨í JSONë§ ë°ííì¸ì. ë¤ë¥¸ íì¤í¸ë í¬í¨íì§ ë§ì¸ì.`;

const POLISH_PROMPT = `ë¹ì ì EV&Solution(ì´ë¸ì´ì¤ìë£¨ì)ì ê¸°ì  ì¸íë¦¬ì ì¤ ë¶ìê°ìëë¤.
EV&Solutionì ì ê¸°ì°¨ ì¶©ì  ì¸íë¼, ìì¨ì£¸í, ë¡ë´, ìëì§ ê´ë ¨ ê¸°ì  ìë£¨ìì ì ê³µíë íì¬ìëë¤.

ì¬ì©ìê° ì§ì  ìì±í ìì½/ì¸ì¬ì´í¸ íì¤í¸ë¥¼ ë¤ë¬ì´ì ì ëë ë¶ë¦¿í¬ì¸í¸ íìì¼ë¡ ì ë¦¬í´ì£¼ì¸ì.
ë¬¸ì¥ì ë§¤ëë½ê² ë¤ë¬ë, ìë ìë¯¸ì íµì¬ ì ë³´ë ì ì§íì¸ì.

ë¤ìì ë°ëì JSON íìì¼ë¡ ë°ííì¸ì:

{
  "title": "íµì¬ì ë´ì íêµ­ì´ ì ëª© (30ì ì´ë´)",
  "category": "ìë ì¹´íê³ ë¦¬ ì¤ íëë§ ì í",
  "summary": ["ìì½ ë¶ë¦¿í¬ì¸í¸ 1", "ìì½ ë¶ë¦¿í¬ì¸í¸ 2", "ìì½ ë¶ë¦¿í¬ì¸í¸ 3"],
  "insight": ["ì¸ì¬ì´í¸ ë¶ë¦¿í¬ì¸í¸ 1", "ì¸ì¬ì´í¸ ë¶ë¦¿í¬ì¸í¸ 2"],
  "importance": "ì/ì¤/í ì¤ íë"
}

ì¹´íê³ ë¦¬ ëª©ë¡:
- ê¸°ì ëí¥ / ìì¥ëí¥ / ì ë¶ì ì± / ê²½ìì¬/ë í¼ë°ì¤ / ìì¨ì£¼í/ë¡ë´ / EV/ì¶©ì ì¸íë¼ / ê¸°í

ë°ëì ì í¨í JSONë§ ë°ííì¸ì. ë¤ë¥¸ íì¤í¸ë í¬í¨íì§ ë§ì¸ì.`;

/**
 * JSON íì± í¬í¼ â ë¤ìí íìì AI ìëµìì JSONì ìì íê² ì¶ì¶
 */
function parseAIResponse(responseText) {
  // 1ì°¨ ìë: ì§ì  íì±
  try {
    return JSON.parse(responseText);
  } catch {}

  // 2ì°¨ ìë: ë§í¬ë¤ì´ ì½ëë¸ë¡ ì ê±° í íì±
  let cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 3ì°¨ ìë: ì ê·ìì¼ë¡ JSON ê°ì²´ ì¶ì¶
  const fi = cleaned.indexOf('{');
  const li = cleaned.lastIndexOf('}');
  if (fi !== -1 && li > fi) {
    return JSON.parse(cleaned.substring(fi, li + 1));
  }

  throw new Error('AI ìëµìì JSON ì¶ì¶ ì¤í¨');
}

/**
 * summary/insightë¥¼ ë°°ì´ë¡ ì ê·í (íì í¸í)
 */
function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // ì¤ë°ê¿ì´ë ë¶ë¦¿ì¼ë¡ êµ¬ë¶ë ê²½ì° ë°°ì´ë¡ ë³í
    return value
      .split(/\n/)
      .map(line => line.replace(/^[-â¢Â·]\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  return ['ë´ì© ìì'];
}

/**
 * ì¹ ì½íì¸  ë¶ì (í¬ë¡ë§ ì±ê³µ ì)
 */
async function analyzeContent(title, content, url, userMemo) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const userPrompt = `ë¤ì ì¹ ì½íì¸ ë¥¼ ë¶ìí´ì£¼ì¸ì.

ì ëª©: ${title}
URL: ${url}
${userMemo ? `ì¬ì©ì ë©ëª¨: ${userMemo}` : ''}

ë³¸ë¬¸:
${content.substring(0, 4000)}`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = result.response.text();
    console.log('AI ìë³¸ ìëµ (ì 500ì):', responseText.substring(0, 500));

    const analysis = parseAIResponse(responseText);

    return {
      title: analysis.title || title,
      category: analysis.category || 'ê¸°í',
      summary: normalizeToArray(analysis.summary),
      insight: normalizeToArray(analysis.insight),
      importance: analysis.importance || 'ì¤',
    };

  } catch (error) {
    console.error('AI ë¶ì ì¤ë¥:', error.message);

    return {
      title: title || 'Untitled',
      category: 'ê¸°í',
      summary: [`AI ë¶ì ì¤í¨. ìë¬¸ ì ëª©: ${title}`],
      insight: ['ìë ë¶ìì´ íìí©ëë¤.'],
      importance: 'ì¤',
    };
  }
}

/**
 * ì¬ì©ì ì§ì  ìë ¥ íì¤í¸ë¥¼ ë¤ë¬ì´ì ë¶ë¦¿í¬ì¸í¸ë¡ ì ë¦¬ (í¬ë¡ë§ ì¤í¨ ì)
 */
async function polishUserSummary(userText, url) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const userPrompt = `ì¬ì©ìê° ì§ì  ìì±í íì¤í¸ë¥¼ ë¤ë¬ì´ì£¼ì¸ì.
${url ? `ê´ë ¨ URL: ${url}` : ''}

ì¬ì©ì ìë ¥:
${userText.substring(0, 3000)}`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: POLISH_PROMPT + '\n\n' + userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = result.response.text();
    console.log('Polish AI ìëµ (ì 500ì):', responseText.substring(0, 500));

    const analysis = parseAIResponse(responseText);

    return {
      title: analysis.title || 'ì¬ì©ì ìì½',
      category: analysis.category || 'ê¸°í',
      summary: normalizeToArray(analysis.summary),
      insight: normalizeToArray(analysis.insight),
      importance: analysis.importance || 'ì¤',
    };

  } catch (error) {
    console.error('Polish AI ì¤ë¥:', error.message);

    // í´ë°±: ì¬ì©ì íì¤í¸ë¥¼ ê·¸ëë¡ ë¶ë¦¿í¬ì¸í¸ë¡
    const lines = userText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    return {
      title: 'ì¬ì©ì ìì½',
      category: 'ê¸°í',
      summary: lines.length > 0 ? lines : ['ì¬ì©ì ìë ¥ ë´ì©'],
      insight: ['AI ë¤ë¬ê¸° ì¤í¨ â ìë¬¸ ê·¸ëë¡ ê²ì'],
      importance: 'ì¤',
    };
  }
}

module.exports = { analyzeContent, polishUserSummary };
