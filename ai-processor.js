/**
 * Gemini AI 프로세서 — 콘텐츠 분석, 분류, 요약, 인사이트 생성, 수정
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `당신은 EV&Solution(이브이앤솔루션)의 기술 인텔리전스 분석가입니다.
EV&Solution은 전기차 충전 인프라, 자율주행, 로봇, 에너지 관련 기술 솔루션을 제공하는 회사입니다.

주어진 웹 콘텐츠를 분석하여 다음을 반드시 JSON 형식으로 반환하세요:

{
  "title": "핵심을 담은 한국어 제목 (30자 이내)",
  "category": "아래 카테고리 중 하나만 선택",
  "summary": ["이것이 무엇인지 1문장 설명", "핵심 포인트/차별점 1문장", "추가 핵심 포인트 1문장"],
  "insight": ["EVS 활용 방안 1", "EVS 활용 방안 2"],
  "importance": "상/중/하 중 하나"
}

summary 작성 규칙 (반드시 3개 불릿, 카테고리별 3가지 질문에 답변):

[기술동향]
  1번째: "이게 무엇인가?" — 핵심 기술/발표 내용을 한 문장으로 설명
  2번째: "기술적으로 어떤 점이 뛰어난가?" — 핵심 성능, 차별점, 기술적 의의
  3번째: "EVS는 이걸 어떻게 활용할 수 있는가?" — 충전/자율주행/로봇/에너지 사업 연결

[시장동향]
  1번째: "이게 무엇인가?" — 시장 이벤트/변화를 한 문장으로 설명
  2번째: "시장에서 어떤 의미가 있는가?" — 시장 규모, 성장성, 트렌드 영향
  3번째: "EVS는 이걸 어떻게 활용할 수 있는가?" — EVS 사업 기회/대응 방향

[정부정책]
  1번째: "이게 무엇인가?" — 정책/규제 내용을 한 문장으로 설명
  2번째: "정책적으로 어떤 영향이 있는가?" — 규제 변화, 보조금, 인증 요건 영향
  3번째: "EVS는 이걸 어떻게 활용할 수 있는가?" — EVS 사업 대응/기회

[경쟁사/레퍼런스]
  1번째: "이게 무엇인가?" — 경쟁사/타사 동향을 한 문장으로 설명
  2번째: "경쟁사 전략에서 배울 점은?" — 타사 접근법, 성과, 시사점
  3번째: "EVS는 이걸 어떻게 활용할 수 있는가?" — EVS 벤치마킹/적용 방안

[자율주행/로봇]
  1번째: "이게 무엇인가?" — 자율주행/로봇 기술/동향을 한 문장으로 설명
  2번째: "기술적으로 어떤 점이 뛰어난가?" — 핵심 기술, 성능, 차별점
  3번째: "EVS는 이걸 어떻게 활용할 수 있는가?" — EVS 로봇/자율주행 사업 연결

[EV/충전인프라]
  1번째: "이게 무엇인가?" — 전기차/충전 관련 내용을 한 문장으로 설명
  2번째: "기술적으로 어떤 점이 뛰어난가?" — 충전/배터리 핵심 기술, 성능
  3번째: "EVS는 이걸 어떻게 활용할 수 있는가?" — EVS 충전 사업 활용 방안

[기타]
  1번째: "이게 무엇인가?" — 핵심 내용을 한 문장으로 설명
  2번째: "핵심 포인트는 무엇인가?" — 주요 분석 내용
  3번째: "EVS는 이걸 어떻게 활용할 수 있는가?" — EVS 사업 관련성

insight 작성 규칙:
- "EV&Solution은 이걸 어디에 활용 가능한가?" 관점으로 작성
- EVS의 사업 영역(충전 인프라, 자율죸행, 로봇, 에너지)과 연결하여 구체적 활용 방안 제시
- 2~3개 불릿포인트

문체 규칙 (매우 중요):
- 간결체로 작성: "~임", "~함", "~됨", "~전망", "~예정", "~필요" 듲 간결한 종결어미 사용
- 절대 경어체 금지: "~입니다", "~합니다", "~있습니다", "~됩니다", "~됐습니다" 등 사용 금지
- 예시: "테슬라가 NACS 표준을 채택함" (O), "테슬라가 NACS 표준을 채택했습니다" (X)
- 예시: "국내 충전 인프라 재편 불가피할 전망" (O), "국내 충전 인프라 재편이 불가피할 것으로 전망됩니다" (X)

카테고리 목록:
- 기술동향: 새로운 기술, R&D, 특허, 기술 표준 등
- 시장동향: 시장 규모, 트렌드, 투자, M&A, 매출 등
- 정부정책: 규제, 법률, 보조금, 인증, 정부 발표 등
- 경쟁사/레퍼런스: 타사 동향, 사례, 벤치마킹 등
- 자율죸행/로봇: 자율죸행차, 배송로봇, AMR, 로보택시 등
- EV/충전인프라: 전기차, 충전기, 배터리, V2G, 충전 네트워크 등
- 기타: 위 카테고리에 해당하지 않는 경우

중요도 판단 기준:
- 상: EVS 사업에 직접적 영향, 즉시 공유 필요
- 중: 참고할 만한 업계 동향
- 하: 일반적 정보, 나중에 참고

반드시 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.`;

const POLISH_PROMPT = `당신은 EV&Solution(이브이앤솔루션)의 기술 인텔리전스 분석가입니다.
EV&Solution은 전기차 충전 인프라, 자율주행, 로봇, 에너지 관련 기술 솔루션을 제공하는 회사입니다.

사용자가 직접 작성한 요약/인사이트 텍스트를 다듬어서 정돈된 불릿포인트 형식으로 정리해주세요.
문장을 매끅럽게 다든되, 원래 의미와 핵심 정보는 유지하세요.

다음을 반드시 JSON 형식으로 반환하세요:

{
  "title": "핵심을 담은 한국어 제목 (30자 이내)",
  "category": "아래 카테고리 중 하나만 선택",
  "summary": ["이것이 무엇인지 1문장 설명", "핵심 포인트/차별점 1문장", "추가 핵심 포인트 1문장"],
  "insight": ["EVS 활용 방안 1", "EVS 활용 방안 2"],
  "importance": "상/중/하 중 하나"
}

summary 작성 규칙 (반드시 3개 불릿):
1번째: "이게 무엇인가?" — 핵심을 한 문장으로 설명
2번째: 주제에 맞는 핵심 분석 (기술적 우수성, 정책적 영향, 시장 의미 등)
3번째: "EVS는 이걸 어떻게 활용할 수 있는가?" — EVS 사업 연결 방안

insight 작성 규칙:
- "EV&Solution은 이걸 어디에 활용 가능한가?" 관점으로 작성
- 2~3개 불릿포인트

카테고리 목록:
- 기술동향 / 시장동향 / 정부정책 / 경쟁사/레퍼런스 / 자율주행/로봇 / EV/충전인프라 / 기타

문체 규칙 (매우 중요):
- 간결체로 작성: "~임", "~함", "~됨", "~전망", "~예정", "~필요" 등 간결한 종결어미 사용
- 절대 경어체 금지: "~입니다", "~합니다", "~있습니다" 등 사용 금지
- 예시: "충전 인프라 재편 불가피함" (O), "충전 인프라 재편이 불가피합니다" (X)

반드시 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.`;

const REVISE_PROMPT = `당싨은 EV&Solution(이브이앤솔루션)의 기술 인텔리전스 분석가입니다.
이전에 작성한 분석 결과에 대해 사용자가 수정 요청을 보냈습니다.
사용자의 수정 요청을 정확히 반영하여 분석 결과를 수정해주세요.
수정 요청에서 언급하지 않은 부분은 기존 내용을 유지하세요.

반드시 JSON 형식으로 반환하세요:

{
  "title": "수정된 제목 (30자 이내)",
  "category": "카테고리",
  "summary": ["이것이 무엇인지 1문장", "핵심 분석 1문장", "추가 분석 1문장"],
  "insight": ["EVS 활용 방안 1", "EVS 활용 방안 2"],
  "importance": "상/중/하 중 하나"
}

summary 구조: 1번째=이게 무엇인가, 2번째=핵심 분석(기술/정책/시장 등 주제에 맞게), 3번째=EVS 활용 가능성
insight 구조: EVS가 이걸 어디에 활용 가능한가

카테고리 목록:
- 기술동향 / 시장동향 / 정부정책 / 경쟁사/레퍼런스 / 자율주행/로봇 / EV/충전인프라 / 기타

문체 규칙 (매우 중요):
- 간결체로 작성: "~임", "~함", "~됨", "~전망", "~예정", "~필요" 등 간결한 종결어미 사용
- 절대 경어체 금지: "~입니다", "~합니다", "~있습니다" 등 사용 금지
- 예시: "충전 인프라 재편 불가피함" (O), "충전 인프라 재편이 불가피합니다" (X)

반드시 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.`;

/**
 * JSON 파싱 헬퍼 — 다양한 형식의 AI 응답에서 JSON을 안전하게 추출
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
 * summary/insight를 배열로 정규화 (하위 호환)
 */
function normalizeToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // 줄바꿈이나 불릿으로 구분된 경우 배열로 변환
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
        maxOutputTokens: 1024,
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
      summary: normalizeToArray(analysis.summary),
      insight: normalizeToArray(analysis.insight),
      importance: analysis.importance || '중',
    };

  } catch (error) {
    console.error('AI 분석 오류:', error.message);

    return {
      title: title || 'Untitled',
      category: '기타',
      summary: [`AI 분석 실패. 원문 제목: ${title}`],
      insight: ['수동 분석이 필요합니다.'],
      importance: '중',
    };
  }
}

/**
 * 사용자 직접 입력 텍스트를 다듬어서 불릿포인트로 정리 (크롤링 실패 시)
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
        maxOutputTokens: 1024,
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
      summary: normalizeToArray(analysis.summary),
      insight: normalizeToArray(analysis.insight),
      importance: analysis.importance || '중',
    };

  } catch (error) {
    console.error('Polish AI 오류:', error.message);

    // 폴백: 사용자 텍스트를 그대로 불릿포인튼로
    const lines = userText.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    return {
      title: '사용자 요약',
      category: '기타',
      summary: lines.length > 0 ? lines : ['사용자 입력 내용'],
      insight: ['AI 다듬기 실패 — 원문 그대로 게시'],
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
        maxOutputTokens: 1024,
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
      summary: normalizeToArray(analysis.summary),
      insight: normalizeToArray(analysis.insight),
      importance: analysis.importance || originalAnalysis.importance,
    };

  } catch (error) {
    console.error('Revise AI 오류:', error.message);
    // 폴백: 원래 분석 결과 그대로 반환
    return originalAnalysis;
  }
}

module.exports = { analyzeContent, polishUserSummary, reviseAnalysis };
