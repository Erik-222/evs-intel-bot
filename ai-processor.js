/**
 * Gemini AI 프로세서 — 콘텐츠 분석, 분류, 요약, 수정
 * v5.3: 3섹션 x 3불릿 구조 (summary_what, summary_analysis, summary_evs)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `당신은 EV&Solution(이브이앤솔루션)의 기술 인텔리전스 분석가입니다.
EV&Solution은 전기차 충전 인프라, 자율주행, 로봇, 에너지 관련 기술 솔루션을 제공하는 회사입니다.

주어진 웹 콘텐츠를 분석하여 반드시 아래 JSON 형식으로 반환하세요.

■■■ 출력 JSON 형식 (반드시 이 구조를 따르세요) ■■■

{
  "title": "핵심을 담은 한국어 제목 (30자 이내)",
  "category": "카테고리",
  "summary_what": [
    "이게 뭔지 설명하는 불릿 1",
    "이게 뭔지 설명하는 불릿 2",
    "이게 뭔지 설명하는 불릿 3"
  ],
  "summary_analysis": [
    "핵심 분석 불릿 1",
    "핵심 분석 불릿 2",
    "핵심 분석 불릿 3"
  ],
  "summary_evs": [
    "EVS 활용 방안 불릿 1",
    "EVS 활용 방안 불릿 2",
    "EVS 활용 방안 불릿 3"
  ],
  "importance": "상/중/하"
}

■■■ 각 섹션 작성 가이드 ■■■

summary_what — "이게 무엇인가?"
: 이 콘텐츠가 무엇인지 설명하는 불릿포인트 3개
: 핵심 내용, 배경, 주요 사실을 각각 한 문장으로

summary_analysis — "핵심 분석"
: 카테고리에 맞는 심층 분석 불릿포인트 3개
: 기술적 우수성, 시장 의미, 정책 영향, 경쟁사 시사점 등

summary_evs — "EVS 활용"
: EV&Solution이 이걸 어떻게 사업에 활용할 수 있는지 불릿포인트 3개
: 충전 인프라, 자율주행, 로봇, 에너지 사업과의 연결

■■■ 카테고리별 summary_analysis 관점 ■■■

- 기술동향: "기술적으로 어떤 점이 뛰어난가?" — 핵심 성능, 차별점, 기술적 의의
- 시장동향: "시장에서 어떤 의미가 있는가?" — 시장 규모, 성장성, 트렌드 영향
- 정부정책: "정책적으로 어떤 영향이 있는가?" — 규제 변화, 보조금, 인증 요건 영향
- 경쟁사/레퍼런스: "경쟁사 전략에서 배울 점은?" — 타사 접근법, 성과, 시사점
- 자율주행/로봇: "기술적으로 어떤 점이 뛰어난가?" — 핵심 기술, 성능, 차별점
- EV/충전인프라: "기술적으로 어떤 점이 뛰어난가?" — 충전/배터리 핵심 기술, 성능
- 기타: "핵심 포인트는 무엇인가?" — 주요 분석 내용

■■■ 올바른 출력 예시 ■■■

{
  "title": "테슬라, 차세대 NACS 충전 커넥터 공개",
  "category": "기술동향",
  "summary_what": [
    "테슬라가 1MW급 초고속 충전이 가능한 차세대 NACS 커넥터를 공개함",
    "기존 CCS 규격과의 호환성을 유지하면서 독자 표준 확장을 추진함",
    "북미 주요 완성차 OEM 5곳이 NACS 채택을 선언한 상태임"
  ],
  "summary_analysis": [
    "기존 CCS 대비 충전 속도 3배, 커넥터 크기 절반으로 줄여 사용자 편의성 대폭 향상됨",
    "액냉식 케이블 기술 적용으로 1MW급 대전력 전송에도 케이블 무게와 발열 문제를 해결함",
    "충전 표준 주도권 확보를 통해 충전 네트워크 생태계 전체를 장악하려는 전략임"
  ],
  "summary_evs": [
    "NACS 호환 충전기 선제 개발로 북미 시장 진출 기회 확보 가능함",
    "국내 NACS 도입 시 충전기 교체/업그레이드 수요 선점이 필요함",
    "액냉식 케이블 등 초고속 충전 핵심 부품 기술 내재화 검토가 필요함"
  ],
  "importance": "상"
}

■■■ 문체 규칙 (매우 중요) ■■■

- 간결체로 작성: "~임", "~함", "~됨", "~전망", "~예정", "~필요" 등 간결한 종결어미 사용
- 절대 경어체 금지: "~입니다", "~합니다", "~있습니다", "~됩니다" 등 사용 금지

카테고리 목록:
- 기술동향 / 시장동향 / 정부정책 / 경쟁사/레퍼런스 / 자율주행/로봇 / EV/충전인프라 / 기타

중요도 판단 기준:
- 상: EVS 사업에 직접적 영향, 즉시 공유 필요
- 중: 참고할 만한 업계 동향
- 하: 일반적 정보, 나중에 참고

반드시 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.`;

const POLISH_PROMPT = `당신은 EV&Solution(이브이앤솔루션)의 기술 인텔리전스 분석가입니다.
EV&Solution은 전기차 충전 인프라, 자율주행, 로봇, 에너지 관련 기술 솔루션을 제공하는 회사입니다.

사용자가 직접 작성한 요약 텍스트를 다듬어서 정돈된 형식으로 정리해주세요.
문장을 매끄럽게 다듬되, 원래 의미와 핵심 정보는 유지하세요.

반드시 아래 JSON 형식으로 반환하세요:

{
  "title": "핵심을 담은 한국어 제목 (30자 이내)",
  "category": "카테고리",
  "summary_what": ["이게 뭔지 불릿 1", "불릿 2", "불릿 3"],
  "summary_analysis": ["핵심 분석 불릿 1", "불릿 2", "불릿 3"],
  "summary_evs": ["EVS 활용 불릿 1", "불릿 2", "불릿 3"],
  "importance": "상/중/하"
}

summary_what: 이게 무엇인지 설명 3개
summary_analysis: 핵심 분석 (기술/시장/정책 등 주제에 맞게) 3개
summary_evs: EVS가 어떻게 활용할 수 있는지 3개

카테고리: 기술동향 / 시장동향 / 정부정책 / 경쟁사/레퍼런스 / 자율주행/로봇 / EV/충전인프라 / 기타

문체 규칙: 간결체 사용 (~임, ~함, ~됨). 경어체 금지 (~입니다, ~합니다 등).

반드시 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.`;

const REVISE_PROMPT = `당신은 EV&Solution(이브이앤솔루션)의 기술 인텔리전스 분석가입니다.
이전에 작성한 분석 결과에 대해 사용자가 수정 요청을 보냈습니다.
사용자의 수정 요청을 정확히 반영하여 분석 결과를 수정해주세요.
수정 요청에서 언급하지 않은 부분은 기존 내용을 유지하세요.

반드시 아래 JSON 형식으로 반환하세요:

{
  "title": "수정된 제목 (30자 이내)",
  "category": "카테고리",
  "summary_what": ["이게 뭔지 불릿 1", "불릿 2", "불릿 3"],
  "summary_analysis": ["핵심 분석 불릿 1", "불릿 2", "불릿 3"],
  "summary_evs": ["EVS 활용 불릿 1", "불릿 2", "불릿 3"],
  "importance": "상/중/하"
}

summary_what: 이게 무엇인지 설명 3개
summary_analysis: 핵심 분석 3개
summary_evs: EVS 활용 방안 3개

카테고리: 기술동향 / 시장동향 / 정부정책 / 경쟁사/레퍼런스 / 자율주행/로봇 / EV/충전인프라 / 기타

문체 규칙: 간결체 사용 (~임, ~함, ~됨). 경어체 금지 (~입니다, ~합니다 등).

반드시 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.`;

/**
 * JSON 파싱 여퍼 — 다양한 형식의 AI 응답에서 JSON을 안전하게 추출
 */
function parseAIResponse(responseText) {
  // 1차 시도: 직접 파싱
  try {
    return JSON.parse(responseText);
  } catch {}

  // 2차 시도: 마크다운 코드블록 제거 후 파싱
  let cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 3차 시도: 정규식으로 JSON 객체 추출
  const fi = cleaned.indexOf('{');
  const li = cleaned.lastIndexOf('}');
  if (fi !== -1 && li > fi) {
    return JSON.parse(cleaned.substring(fi, li + 1));
  }

  throw new Error('AI 응답에서 JSON 추출 실패');
}

/**
 * 값을 배열로 정규화
 */
function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(/\n/)
      .map(line => line.replace(/^[-•·]\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  return ['내용 없음'];
}

/**
 * 웹 콘텐츠 분석 (크롤링 성공 시)
 */
async function analyzeContent(title, content, url, userMemo) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const userPrompt = `다음 웹 콘텐츠를 분석해주세요.

제목: ${title}
URL: ${url}
${userMemo ? `사용자 메모: ${userMemo}` : ''}

본문:
${content.substring(0, 4000)}`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = result.response.text();
    console.log('AI 원본 응답 (앞 500자):', responseText.substring(0, 500));

    const analysis = parseAIResponse(responseText);

    return {
      title: analysis.title || title,
      category: analysis.category || '기타',
      summary_what: normalizeToArray(analysis.summary_what),
      summary_analysis: normalizeToArray(analysis.summary_analysis),
      summary_evs: normalizeToArray(analysis.summary_evs),
      importance: analysis.importance || '중',
    };

  } catch (error) {
    console.error('AI 분석 오류:', error.message);

    return {
      title: title || 'Untitled',
      category: '기타',
      summary_what: [`AI 분석 실패. 원문 제목: ${title}`],
      summary_analysis: ['수동 분석이 필요함'],
      summary_evs: ['수동 검토 필요'],
      importance: '중',
    };
  }
}

/**
 * 사용자 직접 입력 텍스트를 다듬어서 정리 (크록링 실패 시)
 */
async function polishUserSummary(userText, url) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const userPrompt = `사용자가 직접 작성한 텍스트를 다듬어주세요.
${url ? `관련 URL: ${url}` : ''}

사용자 입력:
${userText.substring(0, 3000)}`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: POLISH_PROMPT + '\n\n' + userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = result.response.text();
    console.log('Polish AI 응답 (앞 500자):', responseText.substring(0, 500));

    const analysis = parseAIResponse(responseText);

    return {
      title: analysis.title || '사용자 요약',
      category: analysis.category || '기타',
      summary_what: normalizeToArray(analysis.summary_what),
      summary_analysis: normalizeToArray(analysis.summary_analysis),
      summary_evs: normalizeToArray(analysis.summary_evs),
      importance: analysis.importance || '중',
    };

  } catch (error) {
    console.error('Polish AI 오류:', error.message);

    const lines = userText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    return {
      title: '사용자 요약',
      category: '기타',
      summary_what: lines.length > 0 ? lines : ['사용자 입력 내용'],
      summary_analysis: ['AI 다듬기 실패'],
      summary_evs: ['수동 검토 필요'],
      importance: '중',
    };
  }
}

/**
 * 사용자 수정 피드백을 반영하여 기존 분석 결과를 재수정
 */
async function reviseAnalysis(originalAnalysis, userFeedback) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const userPrompt = `기존 분석 결과:
${JSON.stringify(originalAnalysis, null, 2)}

사용자 수정 요청:
${userFeedback.substring(0, 2000)}

위 수정 요청을 반영하여 분석 결과를 수정해주세요.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: REVISE_PROMPT + '\n\n' + userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = result.response.text();
    console.log('Revise AI 응답 (앞 500자):', responseText.substring(0, 500));

    const analysis = parseAIResponse(responseText);

    return {
      title: analysis.title || originalAnalysis.title,
      category: analysis.category || originalAnalysis.category,
      summary_what: normalizeToArray(analysis.summary_what),
      summary_analysis: normalizeToArray(analysis.summary_analysis),
      summary_evs: normalizeToArray(analysis.summary_evs),
      importance: analysis.importance || originalAnalysis.importance,
    };

  } catch (error) {
    console.error('Revise AI 오류:', error.message);
    return originalAnalysis;
  }
}

module.exports = { analyzeContent, polishUserSummary, reviseAnalysis };
