import React from "react";

/**
 * 기술 질문 짧은 답변 (HTML → JSX)
 * - 전역(:root/body) 스타일 없음 (페이지 UI 유지)
 * - 한/일 토글 유지
 * - kw(빨간 강조) 유지
 */

type TechItem = {
  title: React.ReactNode;
  ko: React.ReactNode;
  jp: React.ReactNode;
};

export default function TechStackInterviewQA() {
  const styleText = `
    .tiqa {
      --tiqa-text: var(--foreground);
      --tiqa-muted: var(--muted-foreground);
      --tiqa-border: var(--border);
      --tiqa-card: var(--card);
      --tiqa-kw: #ef4444;

      color: var(--tiqa-text);
      line-height: 1.7;
      font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Arial, sans-serif;
    }

    .tiqa .wrap {
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .tiqa header h1 {
      margin: 0 0 6px;
      font-size: 22px;
      letter-spacing: .2px;
    }

    .tiqa header p {
      margin: 0 0 18px;
      color: var(--tiqa-muted);
      font-size: 13px;
    }

    .tiqa .card {
      border: 1px solid var(--tiqa-border);
      border-radius: 14px;
      padding: 16px 16px 14px;
      background: var(--tiqa-card);
      margin: 12px 0;
    }

    .tiqa h2 {
      margin: 0 0 10px;
      font-size: 18px;
    }

    .tiqa .block {
      margin-top: 10px;
    }

    .tiqa .label {
      font-weight: 700;
      font-size: 12px;
      color: var(--tiqa-muted);
      margin-bottom: 6px;
    }

    .tiqa .txt {
      color: var(--tiqa-text);
      opacity: .95;
    }

    .tiqa .toggle {
      margin-top: 12px;
      border-top: 1px dashed var(--tiqa-border);
      padding-top: 10px;
    }

    .tiqa summary {
      cursor: pointer;
      font-weight: 700;
      color: var(--tiqa-muted);
      user-select: none;
    }

    .tiqa summary:hover {
      color: var(--tiqa-text);
      opacity: .85;
    }

    .tiqa .kw {
      color: var(--tiqa-kw);
      font-weight: 700;
    }

    .tiqa .note {
      font-size: 12px;
      color: var(--tiqa-muted);
      margin-top: 10px;
    }

    /* 섹션 구분선(회색) - 필요 없으면 지워도 됨 */
    .tiqa .section-divider {
      height: 1px;
      background: #3f3f46;
      margin: 18px 0;
    }
  `;

  const kw = (text: string) => <span className="kw">{text}</span>;

  const items: TechItem[] = [
    {
      title: <>{kw("Java")} (主に 1.8)</>,
      ko: (
        <>
          {kw("Java8")} 환경에서 개발했고, {kw("Stream")} / {kw("Lambda")}를
          활용해 컬렉션 데이터를 처리했습니다.
          {kw("Optional")}을 사용해 {kw("NPE")}를 줄였고,{" "}
          {kw("try-with-resources")}로 자원 관리를 했습니다. 엔티티 비교를 위해{" "}
          {kw("equals")} / {kw("hashCode")}를 오버라이딩한 경험도 있습니다.
        </>
      ),
      jp: (
        <>
          {kw("Java8")} 環境で開発を行い、{kw("Stream")} や {kw("Lambda")}{" "}
          を使ってコレクション処理を行いました。
          {kw("Optional")} を利用して {kw("NPE")} を防ぎ、
          {kw("try-with-resources")} によるリソース管理も実装しました。
          エンティティ比較のために {kw("equals")} / {kw("hashCode")}{" "}
          をオーバーライドした経験があります。
        </>
      ),
    },
    {
      title: <>{kw("Spring Boot")}</>,
      ko: (
        <>
          {kw("Spring Boot")}의 {kw("Auto Configuration")}을 활용해 빠르게
          환경을 구성했고, {kw("application.yml")}과 {kw("Profile")}({kw("dev")}
          /{kw("prod")}) 로 환경을 분리해 운영했습니다. 또한 {kw("Controller")}
          는 요청/응답 처리에 집중하고, 비즈니스 로직은 {kw("Service")} 계층에
          분리해 유지보수성과 테스트 용이성을 고려했습니다.
        </>
      ),
      jp: (
        <>
          {kw("Spring Boot")} の {kw("Auto Configuration")}{" "}
          を利用して開発環境を構築し、{kw("application.yml")} と {kw("Profile")}
          （{kw("dev")} / {kw("prod")}）を使って環境を分離しました。
          {kw("Controller")} はリクエスト/レスポンス処理に集中し、
          ビジネスロジックは {kw("Service")}{" "}
          層へ分離して保守性とテスト容易性を意識しました。
        </>
      ),
    },
    {
      title: <>{kw("Spring Security")}</>,
      ko: (
        <>
          {kw("Authentication")} / {kw("Authorization")}을 분리해 설계했고,{" "}
          {kw("UserDetailsService")}를 커스터마이징해 인증을 처리했습니다.
          비밀번호는 {kw("BCryptPasswordEncoder")}로 암호화했습니다.
        </>
      ),
      jp: (
        <>
          {kw("Authentication")} / {kw("Authorization")} を分けて設計し、
          {kw("UserDetailsService")} をカスタマイズして認証処理を実装しました。
          パスワードは {kw("BCryptPasswordEncoder")} で暗号化しました。
        </>
      ),
    },
    {
      title: <>{kw("JPA")}</>,
      ko: (
        <>
          엔티티 중심으로 설계했고, {kw("@OneToMany")} / {kw("@ManyToOne")}{" "}
          관계를 사용했습니다. 기본 Fetch 전략은 {kw("LAZY")}로 설정했으며,
          {kw("N+1")} 이슈는 상황에 따라 {kw("fetch join")} 기반 {kw("JPQL")}로
          개선했습니다. 필요 시 조회 성능을 기준으로 쿼리와 연관관계를
          조정했습니다.
        </>
      ),
      jp: (
        <>
          エンティティ中心で設計し、{kw("@OneToMany")} / {kw("@ManyToOne")}{" "}
          の関連を使用しました。FetchType は {kw("LAZY")} を基本とし、
          {kw("N+1")} 問題は状況に応じて {kw("fetch join")} を用いた{" "}
          {kw("JPQL")}{" "}
          で改善しました。性能を見ながら関連とクエリを調整しました。
        </>
      ),
    },
    {
      title: <>{kw("MyBatis")}</>,
      ko: (
        <>
          복잡한 {kw("SQL")}이나 튜닝이 필요한 경우 {kw("MyBatis")}{" "}
          {kw("Mapper XML")}을 사용했습니다. {kw("Dynamic SQL")},{" "}
          {kw("resultMap")}을 활용해 조인 결과를 매핑했습니다.
        </>
      ),
      jp: (
        <>
          複雑な {kw("SQL")} やチューニングが必要な場合は {kw("MyBatis")} の{" "}
          {kw("Mapper XML")} を使用しました。
          {kw("Dynamic SQL")} や {kw("resultMap")}{" "}
          を利用したマッピングを行いました。
        </>
      ),
    },
    {
      title: <>{kw("REST")} API</>,
      ko: (
        <>
          {kw("GET")} / {kw("POST")} / {kw("PUT")} / {kw("DELETE")} 를 용도에
          맞게 사용했고, {kw("HTTP")} {kw("Status Code")}를 상황에 맞게
          반환했습니다. 요청·응답은 {kw("DTO")}로 분리했습니다.
        </>
      ),
      jp: (
        <>
          {kw("GET")} / {kw("POST")} / {kw("PUT")} / {kw("DELETE")}{" "}
          を用途に応じて使い分け、{kw("HTTP")}{" "}
          ステータスコードを適切に返却しました。 リクエスト・レスポンスは{" "}
          {kw("DTO")} で分離しました。
        </>
      ),
    },
    {
      title: <>{kw("Thymeleaf")}</>,
      ko: (
        <>
          서버 사이드 렌더링으로 화면을 구성했고, {kw("th:text")} /{" "}
          {kw("th:if")} / {kw("th:each")} 를 사용했습니다.
        </>
      ),
      jp: (
        <>
          サーバーサイドレンダリングで画面を実装し、{kw("th:text")} /{" "}
          {kw("th:if")} / {kw("th:each")} を使用しました。
        </>
      ),
    },
    {
      title: (
        <>
          {kw("JSP")} / {kw("Servlet")}
        </>
      ),
      ko: (
        <>
          레거시 시스템에서 {kw("JSP")} / {kw("Servlet")} 유지보수를 했고,{" "}
          {kw("request")} / {kw("response")} / {kw("session")} 기반 처리를
          경험했습니다.
        </>
      ),
      jp: (
        <>
          レガシーシステムで {kw("JSP")} / {kw("Servlet")} の保守を担当し、
          {kw("request")} / {kw("response")} / {kw("session")}{" "}
          を使用した処理を行いました。
        </>
      ),
    },
    {
      title: <>{kw("Excel VBA")}</>,
      ko: (
        <>
          반복 업무를 자동화하기 위해 {kw("Excel VBA")} {kw("매크로")}를
          작성했습니다.
        </>
      ),
      jp: (
        <>
          定型作業を自動化するために {kw("Excel VBA")} {kw("マクロ")}
          を作成しました。
        </>
      ),
    },
    {
      title: <>{kw("Apache POI")}</>,
      ko: (
        <>
          서버에서 {kw("Excel")} 다운로드 기능을 구현했습니다. {kw("Workbook")}{" "}
          / {kw("Sheet")} / {kw("Cell")} 단위로 처리했습니다.
        </>
      ),
      jp: (
        <>
          サーバー側で {kw("Excel")} 出力機能 を実装し、{kw("Workbook")} /{" "}
          {kw("Sheet")} / {kw("Cell")} 単位で処理しました。
        </>
      ),
    },
    {
      title: (
        <>
          {kw("JUnit")} / {kw("Mockito")}
        </>
      ),
      ko: (
        <>
          서비스 로직 중심으로 {kw("JUnit")} {kw("단위 테스트")}를 작성했고,
          외부 의존성은 {kw("Mockito")}로 {kw("mock")} 처리했습니다.
        </>
      ),
      jp: (
        <>
          サービスロジックを中心に {kw("JUnit")} の{kw("単体テスト")}
          を作成し、外部依存は {kw("Mockito")} でモック化しました。
        </>
      ),
    },
    {
      title: (
        <>
          {kw("GitHub")} / {kw("GitBucket")} / {kw("SVN")}
        </>
      ),
      ko: (
        <>
          Git 기반으로 {kw("브랜치")} 전략, {kw("Pull Request")} 리뷰를
          경험했고, 레거시 프로젝트에서는 {kw("SVN")}도 사용했습니다.
        </>
      ),
      jp: (
        <>
          Git を使用して ブランチ運用 や {kw("Pull Request")} {kw("レビュー")}
          を行い、レガシー案件では {kw("SVN")} も使用しました。
        </>
      ),
    },
    {
      title: <>{kw("SourceTree")}</>,
      ko: (
        <>
          {kw("SourceTree")}로 Git/{kw("SVN")}을 {kw("GUI")} 환경에서
          관리했습니다.
        </>
      ),
      jp: (
        <>
          {kw("SourceTree")} を使って Git / {kw("SVN")} を {kw("GUI")}{" "}
          で管理しました。
        </>
      ),
    },
    {
      title: <>{kw("Eclipse")}</>,
      ko: (
        <>
          {kw("Eclipse")} 환경에서 개발했고, 브레이크포인트 {kw("디버깅")}을
          사용했습니다.
        </>
      ),
      jp: (
        <>
          {kw("Eclipse")} 環境で開発を行い、{kw("ブレークポイント")}を使った
          {kw("デバッグ")}を行いました。
        </>
      ),
    },
    {
      title: (
        <>
          {kw("Slack")} / {kw("Jira")}
        </>
      ),
      ko: (
        <>
          {kw("Slack")}으로 커뮤니케이션했고, {kw("Jira")}로 {kw("이슈")}·작업
          단위를 관리했습니다.
        </>
      ),
      jp: (
        <>
          {kw("Slack")} を使ってコミュニケーションを行い、{kw("Jira")} で
          {kw("課題")}や作業を管理しました。
        </>
      ),
    },
    {
      title: <>{kw("Frontend")} 협업 경험</>,
      ko: (
        <>
          프론트엔드 개발자 및 디자이너와 협업하며 {kw("API")} 명세를 조율했고,
          응답 포맷({kw("DTO")})과 에러 처리({kw("Status Code")}) 기준을 맞추며
          개발을 진행했습니다.
        </>
      ),
      jp: (
        <>
          フロントエンド担当やデザイナーと連携し、{kw("API")}{" "}
          仕様を調整しました。レスポンス形式（{kw("DTO")}）やエラー設計（
          {kw("Status Code")}）の方針を揃えながら開発を進めました。
        </>
      ),
    },
  ];

  return (
    <div className="tiqa">
      <style>{styleText}</style>

      <div className="wrap">
        <header>
          <h1>기술 스택 면접 답변 (한국어 + 일본어 토글)</h1>
          <p>
            각 기술은 한국어 답변이 먼저 나오고, 토글을 열면 일본어 답변이
            표시됩니다. 키워드는 빨간색으로 강조됩니다.
          </p>
        </header>

        {items.map((it, idx) => (
          <React.Fragment key={idx}>
            {idx !== 0 && <div className="section-divider" />}

            <section className="card">
              <h2>{it.title}</h2>

              <div className="block">
                <div className="label">한국어</div>
                <div className="txt">{it.ko}</div>
              </div>

              <details className="toggle">
                <summary>日本語を表示</summary>
                <div className="block">
                  <div className="label">日本語</div>
                  <div className="txt">{it.jp}</div>
                </div>
              </details>
            </section>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
