export type JapaneseLevel = "N1" | "N2" | "N3" | "N4" | "N5";

export type GeneratedWritingPrompt = {
  id: string;
  level: JapaneseLevel;
  promptKo: string;
  hint: string;
};

export type WritingReviewResult = {
  result: "ok" | "fix";
  userText: string;
  correctedText: string;
  comment: string;
};

function normalizeLevel(v: string): JapaneseLevel {
  const value = String(v ?? "").toUpperCase().trim();
  if (value === "N1" || value === "N2" || value === "N3" || value === "N4" || value === "N5") {
    return value;
  }
  throw new Error("Invalid level");
}

type PromptItem = {
  id: string;
  promptKo: string;
  hint: string;
  correctedText: string;
};

function alignCorrectedTextWithHint(item: PromptItem): PromptItem {
  const hint = String(item.hint ?? "");
  let correctedText = String(item.correctedText ?? "");

  // Generic rule:
  // If hint includes explicit Japanese form like 〜xxxx (or 〜a/〜b),
  // make sure corrected text uses the same cited form.
  const citedForms = Array.from(
    hint.matchAll(/〜([ぁ-んァ-ン一-龥ー]+(?:\/〜[ぁ-んァ-ン一-龥ー]+)*)/g),
  )
    .flatMap((m) => m[1].split("/〜"))
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  for (const form of citedForms) {
    if (correctedText.includes(form)) continue;

    // Common mismatch: hinted plain past form(〜た) vs polite past(〜ました).
    if (form.endsWith("た")) {
      const politePast = `${form.slice(0, -1)}ました`;
      if (correctedText.includes(politePast)) {
        correctedText = correctedText.replaceAll(politePast, form);
      }
    }
  }

  return {
    ...item,
    correctedText,
  };
}

type Segment = { kr: string; ja: string };

function buildPromptSet(args: {
  level: JapaneseLevel;
  openings: Segment[];
  endings: Segment[];
  hints: string[];
  limit?: number;
}) {
  const limit = args.limit ?? 60;
  const result: PromptItem[] = [];
  let seq = 1;

  for (const opening of args.openings) {
    for (const ending of args.endings) {
      if (result.length >= limit) break;
      const hint = args.hints[result.length % args.hints.length] ?? "";
      result.push({
        id: `${args.level}-${String(seq).padStart(3, "0")}`,
        promptKo: `${opening.kr} ${ending.kr}`,
        hint,
        correctedText: `${opening.ja}${ending.ja}`,
      });
      seq += 1;
    }
    if (result.length >= limit) break;
  }

  return result;
}

function buildN5Prompts() {
  return buildPromptSet({
    level: "N5",
    openings: [
      { kr: "오늘 아침에는", ja: "今朝は" },
      { kr: "어제 저녁에는", ja: "昨日の夕方は" },
      { kr: "학교가 끝난 뒤에는", ja: "学校が終わったあと" },
      { kr: "주말에는", ja: "週末は" },
      { kr: "비가 오던 날에는", ja: "雨の日は" },
      { kr: "시간이 날 때마다", ja: "時間があるたびに" },
      { kr: "집에 돌아오면", ja: "家に帰ると" },
      { kr: "점심시간에는", ja: "昼休みには" },
      { kr: "시험이 끝난 날에는", ja: "試験が終わった日は" },
      { kr: "친구를 만나는 날에는", ja: "友達に会う日は" },
      { kr: "월요일 아침에는", ja: "月曜日の朝は" },
      { kr: "피곤한 날에는", ja: "疲れた日は" },
    ],
    endings: [
      { kr: "도서관에서 숙제를 하고 집에 천천히 돌아갔다.", ja: "図書館で宿題をしてから、ゆっくり家に帰りました。" },
      { kr: "친구와 공원을 산책하고 근처 가게에서 빵을 샀다.", ja: "友達と公園を散歩して、近くの店でパンを買いました。" },
      { kr: "가족과 저녁을 먹고 하루 있었던 일을 이야기했다.", ja: "家族と夕飯を食べながら、その日の出来事を話しました。" },
      { kr: "방을 정리한 다음 음악을 들으며 쉬었다.", ja: "部屋を片づけたあと、音楽を聞きながら休みました。" },
      { kr: "버스를 놓치지 않으려고 서둘러 준비했다.", ja: "バスに遅れないように、急いで準備しました。" },
      { kr: "집에서 책을 읽으며 조용하게 시간을 보냈다.", ja: "家で本を読みながら、静かに時間を過ごしました。" },
    ],
    hints: [
      "시간 순서(먼저/다음)를 자연스럽게 표현해 보세요.",
      "일상 동작을 과거형으로 연결해 보세요.",
      "〜ながら에 해당하는 동시 동작 표현을 의식해 보세요.",
      "이유와 목적 표현을 한 문장에 담아 보세요.",
    ],
  });
}

function buildN4Prompts() {
  return buildPromptSet({
    level: "N4",
    openings: [
      { kr: "지난주에는 일이 많아서 바빴지만,", ja: "先週は仕事が多くて忙しかったですが、" },
      { kr: "주말에 새로 생긴 카페에 갔는데,", ja: "週末に新しくできたカフェへ行ったところ、" },
      { kr: "아침에 일찍 일어나 운동을 하면,", ja: "朝早く起きて運動をすると、" },
      { kr: "처음에는 일본어가 어려웠지만,", ja: "最初は日本語が難しかったものの、" },
      { kr: "요즘은 통학 시간이 길어서,", ja: "最近は通学時間が長いため、" },
      { kr: "회의 준비를 하느라 늦게까지 남았지만,", ja: "会議の準備で遅くまで残りましたが、" },
      { kr: "친구와 같이 공부하면,", ja: "友達と一緒に勉強すると、" },
      { kr: "비가 와서 외출하기 어려웠지만,", ja: "雨で外出しにくかったですが、" },
      { kr: "새로운 취미를 시작한 뒤로,", ja: "新しい趣味を始めてから、" },
      { kr: "회사에서 맡은 일이 늘어났지만,", ja: "会社で任される仕事が増えましたが、" },
      { kr: "여행을 다녀온 후에는,", ja: "旅行から戻ったあとは、" },
      { kr: "시험을 준비하는 동안,", ja: "試験を準備している間は、" },
    ],
    endings: [
      { kr: "매일 계획을 세워서 하나씩 끝내니 성취감을 느꼈다.", ja: "毎日計画を立てて一つずつ終えることで、達成感を覚えました。" },
      { kr: "분위기가 좋아서 다음에도 다시 가고 싶다고 생각했다.", ja: "雰囲気がよく、次もまた行きたいと思いました。" },
      { kr: "하루 종일 집중이 잘되어 업무 효율이 높아졌다.", ja: "一日中集中しやすくなり、仕事の効率が上がりました。" },
      { kr: "실수를 줄이기 위해 메모하는 습관을 들이게 되었다.", ja: "ミスを減らすために、メモを取る習慣が身につきました。" },
      { kr: "쉬는 시간을 잘 활용하니 피로가 훨씬 줄었다.", ja: "休憩時間をうまく使うことで、疲れがかなり減りました。" },
      { kr: "주변의 도움을 받아 마감 전에 무사히 끝낼 수 있었다.", ja: "周囲の助けを受けて、締め切り前に無事終えることができました。" },
    ],
    hints: [
      "원인과 결과를 자연스럽게 연결해 보세요.",
      "감상(〜と思う)에 해당하는 마무리를 의식해 보세요.",
      "대비 표현(〜지만/〜が)을 부드럽게 사용해 보세요.",
      "습관/변화 표현을 문장 후반에 넣어 보세요.",
    ],
  });
}

function buildN3Prompts() {
  return buildPromptSet({
    level: "N3",
    openings: [
      { kr: "오늘은 해야 할 일이 많아서 피곤했지만,", ja: "今日はやるべきことが多くて疲れていたものの、" },
      { kr: "처음 제안은 바로 받아들여지지 않았지만,", ja: "最初の提案はすぐには受け入れられませんでしたが、" },
      { kr: "최근에는 한국어 원문을 일본어로 바꾸는 연습을 하면서,", ja: "最近は韓国語の原文を日本語に変換する練習を続けるうちに、" },
      { kr: "회의에서 다양한 의견이 나왔고,", ja: "会議ではさまざまな意見が出て、" },
      { kr: "발표를 준비하는 과정에서,", ja: "発表を準備する過程で、" },
      { kr: "새로운 환경에 적응하는 동안,", ja: "新しい環境に適応する間に、" },
      { kr: "실패를 반복하면서도,", ja: "失敗を繰り返しながらも、" },
      { kr: "처음에는 말이 잘 나오지 않았지만,", ja: "最初は言葉がうまく出ませんでしたが、" },
      { kr: "팀원들과 역할을 나누어 진행하니,", ja: "チームメンバーと役割を分担して進めると、" },
      { kr: "문장을 직접 써 보고 고쳐 보는 훈련을 통해,", ja: "文を自分で書いて直す訓練を通じて、" },
      { kr: "어려운 과제를 맡게 되었지만,", ja: "難しい課題を任されましたが、" },
      { kr: "피드백을 받은 뒤에는,", ja: "フィードバックを受けたあとは、" },
    ],
    endings: [
      { kr: "미루지 않고 끝까지 해내려고 노력했다.", ja: "後回しにせず最後までやり遂げようと努力した。" },
      { kr: "논의하는 과정에서 더 나은 방향을 찾을 수 있었다.", ja: "議論する中で、よりよい方向性を見つけることができた。" },
      { kr: "문장 구조를 이전보다 정확하게 이해할 수 있게 되었다.", ja: "文の構造を以前より正確に理解できるようになった。" },
      { kr: "작은 습관을 바꾸는 것만으로도 결과가 크게 달라졌다.", ja: "小さな習慣を変えるだけでも、結果が大きく変わった。" },
      { kr: "부족한 부분을 확인하고 다음 시도에 반영할 수 있었다.", ja: "不足している点を確認し、次の試行に反映できた。" },
      { kr: "시간은 걸렸지만 결국 목표를 달성할 수 있었다.", ja: "時間はかかったが、最終的に目標を達成できた。" },
    ],
    hints: [
      "역접과 결과를 한 문장 안에서 정리해 보세요.",
      "가능/변화 표현을 자연스럽게 활용해 보세요.",
      "과정 설명 뒤에 결론을 명확히 제시해 보세요.",
      "원인-행동-결과 흐름을 유지해 보세요.",
    ],
  });
}

function buildN2Prompts() {
  return buildPromptSet({
    level: "N2",
    openings: [
      { kr: "온라인 수업은 접근성이 높다는 장점이 있지만,", ja: "オンライン授業にはアクセス性が高いという利点がある一方で、" },
      { kr: "재택근무는 통근 부담을 줄여 주지만,", ja: "在宅勤務は通勤負担を軽減する反面、" },
      { kr: "도시 생활은 기회가 많다는 점에서 매력적이지만,", ja: "都市生活は機会が多い点で魅力的ですが、" },
      { kr: "성과 중심의 문화는 효율을 높일 수 있지만,", ja: "成果重視の文化は効率を高めうるものの、" },
      { kr: "새로운 기술 도입은 생산성을 높여 주지만,", ja: "新技術の導入は生産性を向上させますが、" },
      { kr: "조직의 규칙을 강화하면 혼란은 줄일 수 있지만,", ja: "組織の規則を強化すれば混乱を減らせますが、" },
      { kr: "개인의 자율성을 존중하는 정책은 긍정적이지만,", ja: "個人の自律性を尊重する方針は前向きですが、" },
      { kr: "빠른 의사결정은 경쟁력 확보에 유리하지만,", ja: "迅速な意思決定は競争力の確保に有利ですが、" },
      { kr: "국제 협업은 다양한 관점을 얻는 데 도움이 되지만,", ja: "国際協働は多様な視点を得るうえで有益ですが、" },
      { kr: "데이터 기반 의사결정은 객관성을 보장하지만,", ja: "データに基づく意思決定は客観性を担保しますが、" },
      { kr: "평등한 기회 제공은 사회적으로 중요하지만,", ja: "機会の平等を提供することは社会的に重要ですが、" },
      { kr: "고객 중심 전략은 만족도를 높일 수 있지만,", ja: "顧客中心の戦略は満足度を高められる一方で、" },
    ],
    endings: [
      { kr: "집중도와 상호작용 측면에서는 보완 장치가 필요하다고 본다.", ja: "集中度と相互作用の面では補完的な仕組みが必要だと考える。" },
      { kr: "협업 속도와 소속감을 유지하기 위한 제도 설계가 함께 요구된다.", ja: "協働の速度と帰属意識を維持するための制度設計も同時に求められる。" },
      { kr: "단기 효율만이 아니라 장기 지속 가능성까지 함께 고려해야 한다.", ja: "短期的効率だけでなく、長期的持続可能性まで含めて検討すべきである。" },
      { kr: "장점과 한계를 균형 있게 평가해야 실질적인 개선이 가능하다.", ja: "利点と限界を均衡的に評価してこそ、実質的な改善が可能になる。" },
      { kr: "정책 실행 단계에서 예상치 못한 부작용을 점검하는 절차가 중요하다.", ja: "施策の実行段階では、想定外の副作用を点検する手続きが重要になる。" },
      { kr: "결국 핵심은 상황별 우선순위를 명확히 설정하는 데 있다고 생각한다.", ja: "結局のところ、要点は状況ごとの優先順位を明確に設定することにあると思う。" },
    ],
    hints: [
      "장단점 비교 후 결론을 분명히 제시해 보세요.",
      "반면/한편에 해당하는 대조 구조를 살려 보세요.",
      "객관적 설명과 개인 판단을 균형 있게 연결해 보세요.",
      "문장 후반에서 정책적 시사점을 정리해 보세요.",
    ],
  });
}

function buildN1Prompts() {
  return buildPromptSet({
    level: "N1",
    openings: [
      { kr: "기술의 고도화는 생산성과 접근성을 비약적으로 확장했지만,", ja: "技術の高度化は生産性とアクセス性を飛躍的に拡張した一方で、" },
      { kr: "개인의 자유는 민주사회에서 절대적으로 중요하지만,", ja: "個人の自由は民主社会において決定的に重要であるものの、" },
      { kr: "효율성을 최우선으로 삼는 운영 방식은 단기 성과에 유리하지만,", ja: "効率性を最優先とする運営方式は短期的成果に有利である反面、" },
      { kr: "알고리즘 기반 추천 시스템은 편의성을 높여 주지만,", ja: "アルゴリズム型推薦システムは利便性を高めるが、" },
      { kr: "세계화는 시장과 지식의 경계를 허물었지만,", ja: "グローバル化は市場と知識の境界を解体した一方で、" },
      { kr: "위기 상황에서의 신속한 통제는 피해를 줄일 수 있지만,", ja: "危機局面における迅速な統制は被害の抑制に資するが、" },
      { kr: "공정성을 제도적으로 보장하려는 시도는 필수적이지만,", ja: "公正性を制度的に担保しようとする試みは不可欠であるが、" },
      { kr: "지속 가능한 발전을 강조하는 담론은 설득력이 있지만,", ja: "持続可能な発展を強調する言説には説得力があるものの、" },
      { kr: "전문성의 세분화는 정밀한 분석을 가능하게 했지만,", ja: "専門性の細分化は精密な分析を可能にした反面、" },
      { kr: "인공지능의 보편화는 의사결정 비용을 낮추지만,", ja: "AIの普及は意思決定コストを低下させる一方で、" },
      { kr: "사회적 신뢰는 제도의 안정성을 떠받치는 핵심 자원이지만,", ja: "社会的信頼は制度の安定性を支える中核資源であるが、" },
      { kr: "다원적 가치가 공존하는 사회는 창의성을 촉진하지만,", ja: "多元的価値が共存する社会は創造性を促進する反面、" },
    ],
    endings: [
      { kr: "동시에 인간의 판단과 책임 소재를 흐릴 위험을 구조적으로 내포하고 있다.", ja: "同時に人間の判断と責任所在を曖昧化する危険を構造的に内包しているといえる。" },
      { kr: "따라서 제도 설계는 권리 보장과 공적 책임의 긴장을 정교하게 조율해야 한다.", ja: "したがって制度設計は、権利保障と公的責任の緊張関係を精緻に調整しなければならない。" },
      { kr: "문제의 본질은 기술 자체가 아니라 그것을 배치하는 사회적 맥락에 달려 있다.", ja: "問題の本質は技術それ自体ではなく、それを配置する社会的文脈に依存している。" },
      { kr: "결국 규범의 정당성은 선언이 아니라 지속적인 검증 절차를 통해서만 확보된다.", ja: "結局のところ規範の正当性は宣言によってではなく、継続的検証手続きによってのみ確保される。" },
      { kr: "이 때문에 단일한 해법보다 상황별 다층 전략이 현실적인 대안으로 기능한다.", ja: "このため単一解ではなく、状況依存的な多層戦略こそが現実的代案として機能する。" },
      { kr: "장기적으로는 효율과 형평의 균형을 어떻게 제도화하느냐가 성패를 가른다.", ja: "長期的には効率と衡平性の均衡をいかに制度化するかが成否を分ける。" },
    ],
    hints: [
      "추상 개념을 인과 구조로 논리적으로 전개해 보세요.",
      "대립 가치의 긴장을 조정하는 논지를 분명히 제시해 보세요.",
      "문제 제기 이후 규범적 결론으로 연결해 보세요.",
      "단기/장기 관점을 대비해 논증을 완성해 보세요.",
    ],
  });
}

const PROMPT_BANK: Record<JapaneseLevel, PromptItem[]> = {
  N1: buildN1Prompts(),
  N2: buildN2Prompts(),
  N3: buildN3Prompts(),
  N4: buildN4Prompts(),
  N5: buildN5Prompts(),
};

function pickRandomPrompt(args: {
  level: JapaneseLevel;
  excludePrompt?: string;
  excludeId?: string;
  excludeIds?: string[];
}) {
  const source = PROMPT_BANK[args.level] ?? PROMPT_BANK.N3;
  const trimmedExclude = String(args.excludePrompt ?? "").trim();
  const excludeId = String(args.excludeId ?? "").trim();
  const excludeIds = new Set(
    (args.excludeIds ?? []).map((v) => String(v ?? "").trim()).filter(Boolean),
  );
  if (excludeId) excludeIds.add(excludeId);
  const candidates =
    trimmedExclude.length > 0 || excludeIds.size > 0
      ? source.filter(
          (c) =>
            c.promptKo.trim() !== trimmedExclude &&
            !excludeIds.has(c.id.trim()),
        )
      : source;
  const finalCandidates = candidates.length > 0 ? candidates : [];
  if (finalCandidates.length === 0) return null;
  const idx = Math.floor(Math.random() * finalCandidates.length);
  return alignCorrectedTextWithHint(finalCandidates[idx]);
}

function findPrompt(args: {
  level: JapaneseLevel;
  promptKo: string;
  promptId?: string;
}) {
  const list = PROMPT_BANK[args.level] ?? PROMPT_BANK.N3;
  const promptId = String(args.promptId ?? "").trim();
  if (promptId) {
    const byId = list.find((item) => item.id === promptId);
    if (byId) return alignCorrectedTextWithHint(byId);
  }
  const promptKo = String(args.promptKo ?? "").trim();
  if (!promptKo) return null;
  const found = list.find((item) => item.promptKo.trim() === promptKo) ?? null;
  return found ? alignCorrectedTextWithHint(found) : null;
}

function isGenericCorrectedText(text: string) {
  const t = String(text ?? "").trim();
  if (!t) return true;
  return /(日本語で書いてください|日本語で作成|見直してください|もう一度|再入力)/.test(t);
}

function shouldReplaceCorrectedText(correctedText: string, userText: string) {
  if (!containsJapaneseText(correctedText)) return true;
  if (correctedText === userText) return true;
  if (isGenericCorrectedText(correctedText)) return true;
  if (correctedText.length < 8) return true;
  return false;
}

export function enforceCorrectedText(args: {
  review: WritingReviewResult;
  userText: string;
  referenceAnswer: string;
}) {
  const review = { ...args.review };
  const userText = String(args.userText ?? "").trim();
  const referenceAnswer = String(args.referenceAnswer ?? "").trim();

  if (review.result === "fix" && shouldReplaceCorrectedText(review.correctedText, userText)) {
    review.correctedText = referenceAnswer || review.correctedText;
  }

  if (!containsJapaneseText(userText)) {
    review.result = "fix";
    review.comment = "일본어로 작성해 주세요. 현재 입력은 일본어 문장이 아닙니다.";
    if (referenceAnswer) {
      review.correctedText = referenceAnswer;
    }
  }

  if (review.result === "ok" && !review.comment.trim()) {
    review.comment = "自然で正しい表現です。";
  }

  if (review.result === "fix" && !review.comment.trim()) {
    review.comment = "문법, 조사, 어휘, 문장 흐름을 자연스럽게 수정했습니다.";
  }

  return review;
}

export function containsJapaneseText(input: string) {
  const text = String(input ?? "");
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

export async function generateJapaneseWritingPrompt(args: {
  level: JapaneseLevel;
  excludePrompt?: string;
  excludeId?: string;
  excludeIds?: string[];
}) {
  const normalizedLevel = normalizeLevel(args.level);
  const picked = pickRandomPrompt({
    level: normalizedLevel,
    excludePrompt: args.excludePrompt,
    excludeId: args.excludeId,
    excludeIds: args.excludeIds,
  });
  if (!picked) {
    throw new Error("해당 레벨의 모든 문장을 완료했습니다.");
  }
  return {
    id: picked.id,
    level: normalizedLevel,
    promptKo: picked.promptKo,
    hint: picked.hint,
  } satisfies GeneratedWritingPrompt;
}

export async function reviewJapaneseWriting(args: {
  level: JapaneseLevel;
  promptKo: string;
  userText: string;
  promptId?: string;
}): Promise<WritingReviewResult> {
  const normalizedLevel = normalizeLevel(args.level);
  const promptKo = String(args.promptKo ?? "").trim();
  const userText = String(args.userText ?? "").trim();

  if (!promptKo) throw new Error("promptKo is required");
  if (!userText) throw new Error("userText is required");
  const source = findPrompt({
    level: normalizedLevel,
    promptKo,
    promptId: args.promptId,
  });
  const correctedText =
    source?.correctedText ||
    "模範解答が見つかりませんでした。問題を再生成してもう一度お試しください。";

  if (!containsJapaneseText(userText)) {
    return {
      result: "fix",
      userText,
      correctedText,
      comment: "일본어로 작성해 주세요. 현재 입력은 일본어 문장이 아닙니다.",
    };
  }

  const exactMatch = userText === correctedText;
  if (exactMatch) {
    return {
      result: "ok",
      userText,
      correctedText,
      comment: "自然で正しい表現です。よくできました。",
    };
  }

  return {
    result: "fix",
    userText,
    correctedText,
    comment: "모범 답안과 표현/문법/조사 사용이 달라 수정 예시를 확인해 주세요.",
  };
}

export async function generateJapaneseReferenceAnswer(args: {
  level: JapaneseLevel;
  promptKo: string;
  promptId?: string;
}) {
  const normalizedLevel = normalizeLevel(args.level);
  const promptKo = String(args.promptKo ?? "").trim();
  const source = findPrompt({
    level: normalizedLevel,
    promptKo,
    promptId: args.promptId,
  });
  if (!source) {
    throw new Error("Reference answer not found");
  }
  return source.correctedText;
}
