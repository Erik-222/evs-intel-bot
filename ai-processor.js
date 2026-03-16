/**
 * Gemini AI 프로세서 — 콘텐츠 분석, 분류, 요약, 인사이트 생성
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `당신은 EV&Solution(이브이앤솔루션)의 기술 인텔리전스 분석가입니다.
EV&Solution은 전기차 충전 인프라, 자율주행, 로봇, 에너지 관련 기술 솔루션을 제공하는 회사입니다.

주어진 웹 콘텐츠를 분석하여 다음을 반드시 JSON 형식으로 반환하세요:

{
  "title": "핵심을 담은 한국어 제목 (30자 이내)",
  "category": "아래 카테고리 중 하나만 선택",
  "summary": "핵심 내용 3-4줄 요약 (한국어)",
  "insight": "EV&Solution 관점에서의 시사점/기회/위협 2-3줄 (한국어)",
  "importance": "상/중/하 중 하나"
}

카테고리 목록:
- 기술동향: 새로운 기술, R&D, 특허, 기술 표준 등
- 시장동향: 시장 규모, 트렌드, 투자, M&A, 매출 등
- 정부정책: 규제, 법률, 보조금, 인증, 정부 발표 등
- 경쟁사/레퍼런스: 타사 동향, 사례, 벤치마킹 등
- 자율주행/로봇: 자율주행차, 배송로봇, AMR, 로보택시 등
- EV/충전인프라: 전기차, 충전기, 배터리, V2G, 충전 네트워크 등
- 기타: 위 카테고리에 해당하지 않는 경우

중요도 판단 기준:
- 상: EVS 사업에 직접적 영향, 즉시 공유 필요
- 중: 참고할 만한 업계 동향
- 하: 일반적 정보, 나중에 참고

반드시 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.`;

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
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\\n\\n' + userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const responseText = result.response.text();
    console.log('AI 원본 응답 (앞 500자):', responseText.substring(0, 500));

    // JSON 파싱
    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      // JSON 파싱 실패 시 다양한 방법으로 JSON 추출 시도
      let cleaned = responseText;

      // 마크다운 코드블록 제거
      cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      // 앞뒤 공백 제거
      cleaned = cleaned.trim();

      try {
        analysis = JSON.parse(cleaned);
      } catch {
        // 정규식으로 JSON 객체 추출
        const fi = cleaned.indexOf('{'); const li = cleaned.lastIndexOf('}'); const jsonMatch = (fi !== -1 && li > fi) ? [cleaned.substring(fi, li + 1)] : null;
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          console.error('JSON 추출 실패. 원본 응답:', responseText.substring(0, 300));
          throw new Error('AI 응답에서 JSON 추출 실패');
        }
      }
    }

    // 기본값 설정
    return {
      title: analysis.title || title,
      category: analysis.category || '기타',
      summary: analysis.summary || '요약을 생성하지 못했습니다.',
      insight: analysis.insight || '인사이트를 생성하지 못했습니다.',
      importance: analysis.importance || '중',
    };

  } catch (error) {
    console.error('AI 분석 오류:', error.message);

    // 폴백: AI 실패 시 기본 정보만 반환
    return {
      title: title || 'Untitled',
      category: '기타',
      summary: `AI 분석 실패. 원문 제목: ${title}`,
      insight: '수동 분석이 필요합니다.',
      importance: '중',
    };
  }
}

module.exports = { analyzeContent };
