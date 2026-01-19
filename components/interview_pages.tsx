import React from "react";

/**
 * 공통 질문 필수 (HTML → TSX)
 * - 기존 페이지(UI)와 충돌하지 않도록 전역(:root/body) 스타일을 제거하고
 *   컴포넌트 내부(.ciqa) 범위로만 스타일을 적용합니다.
 * - 다크/라이트 테마는 프로젝트의 CSS 변수(--card/--border/--foreground 등)를 그대로 사용합니다.
 */

type QAItem = {
  id: string;
  title: React.ReactNode;
  koQ: React.ReactNode;
  koA: React.ReactNode;
  jpQ: React.ReactNode;
  jpA: React.ReactNode;
};

export default function CommonInterviewQA() {
  const styleText = `
    .ciqa {
      /* 프로젝트(shadcn) 테마 변수 사용 */
      --ciqa-text: var(--foreground);
      --ciqa-muted: var(--muted-foreground);
      --ciqa-border: var(--border);
      --ciqa-card: var(--card);
      --ciqa-kw: #ef4444;

      color: var(--ciqa-text);
      line-height: 1.7;
      font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Arial, sans-serif;
    }

    .ciqa .wrap {
      /* 기존 페이지 레이아웃을 그대로 쓰기 위해 레이아웃 강제값은 최소화 */
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .ciqa header h1 {
      margin: 0 0 6px;
      font-size: 22px;
      letter-spacing: .2px;
    }

    .ciqa header p {
      margin: 0 0 18px;
      color: var(--ciqa-muted);
      font-size: 13px;
    }

    .ciqa .card {
      border: 1px solid var(--ciqa-border);
      border-radius: 14px;
      padding: 16px 16px 14px;
      background: var(--ciqa-card);
      margin: 12px 0;
    }

    .ciqa h2 {
      margin: 0 0 10px;
      font-size: 18px;
    }

    .ciqa .qa .q {
      font-weight: 700;
      margin: 10px 0 6px;
    }

    .ciqa .qa .a {
      color: var(--ciqa-text);
      white-space: normal;
    }

    .ciqa .toggle {
      margin-top: 12px;
      border-top: 1px dashed var(--ciqa-border);
      padding-top: 10px;
    }

    .ciqa summary {
      cursor: pointer;
      font-weight: 700;
      color: var(--ciqa-muted);
      user-select: none;
    }

    .ciqa summary:hover {
      color: var(--ciqa-text);
      opacity: .85;
    }

    .ciqa .jp {
      margin-top: 10px;
    }

    .ciqa .kw {
      color: var(--ciqa-kw);
      font-weight: 700;
    }

    .ciqa .note {
      font-size: 12px;
      color: var(--ciqa-muted);
      margin-top: 10px;
    }

    /* ✅ 섹션 구분 실선 */
    .ciqa .section-divider {
      height: 1px;
      background: none;
      border-top: 1px solid #3f3f46;
      opacity: 1;
      margin: 18px 0;
    }
  `;

  const kw = (text: string) => <span className="kw">{text}</span>;

  const items: QAItem[] = [
    {
      id: "s1",
      title: kw("기본설계서"),
      koQ: <>Q. {kw("기본설계서")} 작성해 보셨나요?</>,
      koA: (
        <>
          {kw("기본설계서")}는 {kw("요구정의서")}에 있는 내용을 기준으로, 기능이
          어떤 조건에서 어떤 흐름으로 동작하는지를 정리했습니다. 화면이나 기능
          단위로 {kw("정상")} 흐름과 {kw("예외")} 흐름을 정리해서, 개발 전에
          전체적인 동작을 팀원들이 공통으로 이해할 수 있도록 작성했습니다.
        </>
      ),
      jpQ: <>Q. {kw("基本設計書")}を作成したことはありますか？</>,
      jpA: (
        <>
          {kw("基本設計書")}は、{kw("要件定義書")}
          に記載されている内容を基に、機能がどのような条件で、どのような流れで動作するかを整理して作成しました。画面や機能単位で
          {kw("正常系")}と{kw("例外系")}
          の流れを整理し、開発前にチームメンバー全員が全体の動作を共通認識できるようにしています。
        </>
      ),
    },
    {
      id: "s2",
      title: kw("상세설계서"),
      koQ: <>Q. {kw("상세설계서")}를 작성해 보셨나요?</>,
      koA: (
        <>
          네, 작성해 본 경험이 있습니다. {kw("상세설계서")}는 {kw("기본설계서")}
          에서 정리한 내용을 바탕으로, 클래스 구조나 메서드의 역할, 사용하는
          데이터 항목 등을 구현 단계까지 내려서 정리했습니다. 특히 처리 흐름과
          조건 분기, 입력값과 출력값이 한눈에 보이도록 의식하면서 작성했습니다.
        </>
      ),
      jpQ: <>Q. {kw("詳細設計書")}は作成しましたか？</>,
      jpA: (
        <>
          はい、作成しました。{kw("詳細設計書")}では、{kw("基本設計書")}
          で整理した内容を基に、クラス構成やメソッドの役割、使用するデータ項目など、実装レベルまで落とし込んで整理しました。特に、処理の流れや条件分岐、入力値と出力値が分かるように意識して作成しました。
        </>
      ),
    },
    {
      id: "s3",
      title: kw("테스트 사양서"),
      koQ: <>Q. {kw("테스트 사양서")}를 작성해 본 적 있나요?</>,
      koA: (
        <>
          네, 작성해 본 경험이 있습니다. {kw("테스트 사양서")}는 기능 단위로{" "}
          <span className="kw">
            <span className="kw">정상</span> 케이스
          </span>
          ,{" "}
          <span className="kw">
            <span className="kw">예외</span> 케이스
          </span>
          , {kw("경계값")}을 기준으로 정리했고, 각 테스트마다 입력 조건, 사전
          조건, 기대 결과를 명확하게 작성했습니다. 개발자가 아닌 사람도 테스트
          내용을 이해할 수 있도록, 처리 흐름과 확인 포인트를 중심으로 정리하는
          데 신경 썼습니다.
        </>
      ),
      jpQ: <>Q. {kw("テスト仕様書")}を作成したことはありますか？</>,
      jpA: (
        <>
          はい、作成した経験があります。{kw("テスト仕様書")}は機能単位で、
          {kw("正常系")}・{kw("例外系")}・{kw("境界値")}
          を基準に整理し、各テストケースごとに入力条件、事前条件、期待結果を明確に記載しました。開発者以外のメンバーでも内容を理解できるように、処理の流れや確認ポイントを意識して作成しました。
        </>
      ),
    },
    {
      id: "s4",
      title: kw("단위 테스트"),
      koQ: <>Q. {kw("단위 테스트")}는 어떻게 실시했나요?</>,
      koA: (
        <>
          {kw("단위 테스트")}는 {kw("JUnit")}으로 서비스 로직 중심으로 작성했고,
          외부 의존성은 {kw("Mockito")}로 분리해서 테스트했습니다. {kw("정상")}·
          {kw("예외")}·{kw("경계값")} 케이스를 {kw("Given-When-Then")} 구조로
          작성해서 테스트를 구성했고, 테스트 결과는 {kw("커버리지")} 도구를 통해
          확인했습니다.
        </>
      ),
      jpQ: <>Q. {kw("単体テスト")}はどのように実施しましたか？</>,
      jpA: (
        <>
          {kw("単体テスト")}は、{kw("JUnit")}
          を使用してサービスロジックを中心に作成しました。外部依存については
          {kw("Mockito")}で分離し、テスト対象のロジックを単独で検証しました。
          {kw("正常系")}・{kw("例外系")}・{kw("境界値")}のケースを、
          {kw("Given-When-Then")}
          の構成でテストケースとして作成し、テスト結果はカバレッジツールで確認しました。
        </>
      ),
    },
    {
      id: "s5",
      title: kw("통합 테스트"),
      koQ: <>Q. {kw("통합 테스트")}는 어떻게 실시했나요?</>,
      koA: (
        <>
          {kw("통합 테스트")}는 여러 컴포넌트가 실제로 연동되는 흐름을 기준으로
          실시했습니다.{" "}
          <span className="kw">
            <span className="kw">정상</span> 케이스
          </span>
          뿐만 아니라{" "}
          <span className="kw">
            <span className="kw">예외</span> 케이스
          </span>
          도 포함해서 테스트했고, 실제 사용 시나리오 기준으로 기능이 문제없이
          동작하는지를 확인했습니다. 에비던스로는 시나리오의 시작부터 검증
          항목까지의 화면 캡처와 로그를 함께 취득해서 관리했습니다.
        </>
      ),
      jpQ: <>Q. {kw("結合テスト")}はどのように実施しましたか？</>,
      jpA: (
        <>
          {kw("結合テスト")}
          は、複数のコンポーネントが実際に連携する処理フローを基準に実施しました。
          {kw("正常系")}だけでなく{kw("例外系")}
          も含めてテストを行い、実際の利用シナリオを想定して、機能が問題なく動作することを確認しました。エビデンスとしては、シナリオの開始から検証項目までの画面キャプチャやログを取得し、管理しました。
        </>
      ),
    },
    {
      id: "s6",
      title: (
        <>
          {kw("불량")}({kw("버그")}) 대응
        </>
      ),
      koQ: (
        <>
          Q. {kw("불량")}({kw("버그")})이 발생했을 때 어떻게 대응했나요?
        </>
      ),
      koA: (
        <>
          {kw("불량")}이 발생했을 경우에는 먼저 {kw("불량")} 관리 엑셀 시트에
          해당 {kw("불량")}이 어느 시나리오에서 발생했는지, 그리고 어떤 내용의{" "}
          {kw("불량")}인지 정리해서 기록했습니다. 그 다음, 문제 원인을 파악하기
          위해 {kw("Linux")} 환경에서 {kw("cat")}이나 {kw("tail")} 명령어로
          로그를 확인했고, 어느 지점에서 어떤 이유로 에러가 발생했는지
          분석했습니다. 원인이 되는 부분은 {kw("디버깅")}으로 소스 코드를 확인한
          후 수정했고, 수정 후에는 {kw("JUnit")}으로 {kw("단위 테스트")}를 다시
          실행하여 {kw("커버리지")}가 100%가 되는지 확인했습니다. 이후 로컬
          환경에서 {kw("정상")} 동작을 확인한 뒤 운영 서버에 {kw("릴리스")}
          했습니다. 마지막으로 로직 재검토와 {kw("영향도 조사")}를 통해 다른
          기능에 동일 문제가 없는지, 수정 영향이 없는지도 확인했습니다.
        </>
      ),
      jpQ: (
        <>
          Q. {kw("不具合")}（{kw("バグ")}
          ）が発生した場合、どのように対応しましたか？
        </>
      ),
      jpA: (
        <>
          {kw("不具合")}が発生した場合は、まず{kw("不具合")}
          管理用のExcelシートに、どのシナリオで発生した{kw("不具合")}か、また
          {kw("不具合")}
          の内容を整理して記載しました。その後、原因を特定するために、
          {kw("Linux")}環境で{kw("cat")}や{kw("tail")}
          コマンドを使用してログを確認し、どの箇所で、どのような理由でエラーが発生しているかを分析しました。原因となる部分については、
          {kw("デバッグ")}
          を行いソースコードを直接確認した上で修正対応を行い、修正後は
          {kw("JUnit")}で{kw("単体テスト")}
          を再実行し、カバレッジが100％になることを確認しました。その後、ローカル環境で問題なく動作することを確認した上で、本番サーバーへ
          {kw("リリース")}する形で対応しました。また、同様の{kw("不具合")}
          が他の機能でも発生する可能性がないかを確認するため、ロジックの見直しを行い、自分が修正した箇所が他機能に影響していないかについても
          {kw("影響調査")}を実施しました。
        </>
      ),
    },
    {
      id: "s7",
      title: <>배치 처리 경험</>,
      koQ: <>Q. 배치 처리 경험에 대해 구체적으로 설명해 주세요.</>,
      koA: (
        <>
          1) 히타치 현장 + 파일배치
          <br />
          제가 담당했던 배치 처리는 파일 연계형 배치 프로그램이었습니다. 각 배치
          클래스마다 {kw("입력 파일")}과 {kw("출력 파일")}이 명확하게 정의되어
          있었고, 한 클래스에서 {kw("입력 파일")}을 받아 비즈니스 로직으로
          데이터를 처리한 뒤, 그 결과를 {kw("출력 파일")}로 생성해서 다음 배치
          클래스에 전달하는 구조였습니다. 다음 클래스에서는 이 {kw("출력 파일")}
          을 다시 {kw("입력 파일")}로 받아 처리했고, 비즈니스 로직을 적용한 후
          데이터를 여러 파일로 분할해서 다음 단계의 여러 배치 클래스에 넘기는
          방식으로 구현했습니다. 배치 실행과 스케줄 관리는 {kw("Hitachi JP1")}
          으로 했고, JP1 화면에서 배치 흐름이 {kw("정상")} 기동/연계/종료되는지
          직접 확인했습니다. 배치 실행 후에는 입력/{kw("출력 파일")}과 로그를
          확인해 {kw("정상")} 처리 여부와 에러 여부를 점검했습니다.
          <br />
          <br />
          2) {kw("Spring Boot")} 배치
          <br />
          Java·{kw("Spring Boot")}·{kw("MyBatis")}를 사용해 {kw("DB")} 연계형
          배치 처리 구현, 신규 기능 추가, {kw("불량")} 대응을 담당했습니다.{" "}
          {kw("Spring Boot")} 환경에서 {kw("@Scheduled")}로 정해진 시간에 자동
          실행되도록 구성했고, {kw("Job")} → {kw("Step")} → ({kw("ItemReader")}{" "}
          → {kw("ItemProcessor")} → {kw("ItemWriter")}) 구조로 설계했습니다.{" "}
          {kw("ItemReader")}에서는 {kw("MyBatis")}로 처리 대상을 조회했고,{" "}
          {kw("ItemProcessor")}에서 비즈니스 로직으로 처리 여부를 판단했습니다.{" "}
          {kw("ItemWriter")}에서는 {kw("JavaMailSender")}로 메일을 발송하거나,
          잔여 좌석 해제는 상태 플래그 업데이트로 처리했습니다. 각 {kw("Step")}
          은 트랜잭션 단위로 관리해 {kw("예외")} 시 롤백되도록 했고,{" "}
          {kw("불량")} 발생 시 로그 분석 후 수정 및 {kw("JUnit")} 재테스트로{" "}
          {kw("정상")} 동작을 확인했습니다.
        </>
      ),
      jpQ: <>Q. バッチ処理の経験について具体的に教えてください。</>,
      jpA: (
        <>
          1) 日立現場でのファイルバッチ処理経験
          <br />
          私が担当していたバッチ処理は、ファイル連携型のバッチプログラムでした。各バッチクラスごとに
          {kw("入力ファイル")}と{kw("出力ファイル")}
          が明確に定義されており、1つのクラスで{kw("入力ファイル")}
          を受け取り、ビジネスロジックでデータを処理した後、その結果を
          {kw("出力ファイル")}
          として生成し、次のバッチクラスへ連携する構成でした。次のクラスでは、その
          {kw("出力ファイル")}を{kw("入力ファイル")}
          として再度受け取り、ビジネスロジックを適用した上で、データを複数のファイルに分割し、次の段階の複数のバッチクラスへ渡す方式で実装しました。バッチの実行およびスケジュール管理には
          {kw("Hitachi JP1")}
          を使用しており、JP1の画面上でバッチが正常に起動しているか、前処理のバッチ終了後に次のバッチへ正常に遷移しているか、また途中でエラーなく全体の処理フローが維持されているかを直接確認していました。さらに、バッチ実行後にはサーバー上に生成された
          {kw("入力ファイル")}・{kw("出力ファイル")}
          およびログを確認し、データが正しく処理されていることや、エラーが発生していないことも併せてチェックしていました。
          <br />
          <br />
          2) {kw("Spring Boot")} バッチ処理
          <br />
          Java・{kw("Spring Boot")}・{kw("MyBatis")}を使用して、{kw("DB")}
          連携型バッチ処理の実装、新規機能追加および{kw("不具合")}
          対応を担当しました。バッチは {kw("Spring Boot")} 環境にて
          {kw("@Scheduled")}
          を使用し、定期的に自動実行されるように構成しました。処理構成は
          {kw("Job")} → {kw("Step")} →（{kw("ItemReader")} →{" "}
          {kw("ItemProcessor")} → {kw("ItemWriter")}）として設計し、
          {kw("ItemReader")}では {kw("MyBatis")}{" "}
          を利用してデータベースから処理対象データを取得しました。
          {kw("ItemProcessor")}
          では、取得したデータにビジネスロジックを適用し、処理対象かどうかの判定を行いました。
          {kw("ItemWriter")}では、メール送信バッチの場合は{" "}
          {kw("JavaMailSender")}{" "}
          を使用してメール送信を行い、残席解放バッチの場合はステータスフラグを更新する形で処理しました。各
          {kw("Step")}
          はトランザクション単位で管理し、処理途中で例外が発生した場合でもロールバックされるように対応しました。また、
          {kw("不具合")}発生時にはログを分析して原因を特定し、ソース修正後に
          {kw("JUnit")}による再テストを実施して、正常動作を確認しました。
        </>
      ),
    },
    {
      id: "s8",
      title: kw("GitHub"),
      koQ: <>Q. {kw("GitHub")} 사용 방법에 대해 말씀해 주세요.</>,
      koA: (
        <>
          {kw("GitHub")}는 소스 코드 관리와 팀 협업을 위해 사용했습니다.
          기본적으로 {kw("GitHub")} {kw("리포지토리")}를 중심으로 개발을
          진행했고, 작업 단위별로 {kw("브랜치")}를 나눠서 작업했습니다. 기능이나
          수정 작업마다{" "}
          <span className="kw">
            <span className="kw">feature</span>{" "}
            <span className="kw">브랜치</span>
          </span>
          를 생성해 개발했고, 작업이 완료되면 {kw("Pull Request")}를 생성해서
          리뷰를 받은 뒤 {kw("main")} 또는 {kw("develop")} {kw("브랜치")}로
          병합했습니다.
        </>
      ),
      jpQ: <>Q. {kw("GitHub")}の使用方法について教えてください。</>,
      jpA: (
        <>
          {kw("GitHub")}
          は、ソースコード管理とチーム開発のために使用していました。基本的には
          {kw("GitHub")}上の{kw("リポジトリ")}
          を中心に開発を進め、作業単位ごとにブランチを分けて作業していました。機能追加や修正作業ごとに
          <span className="kw">
            <span className="kw">feature</span>ブランチ
          </span>
          を作成して開発を行い、作業完了後は{kw("Pull Request")}
          を作成してレビューを受け、{kw("main")}または{kw("develop")}
          ブランチへマージしていました。
        </>
      ),
    },
    {
      id: "s9",
      title: <>고객 커뮤니케이션</>,
      koQ: <>Q. 고객과 커뮤니케이션 한 경험이 있나요?</>,
      koA: (
        <>
          네, 있습니다. 요건에 따라 개발을 진행하고 구현이 완료된 이후, 테스트를
          수행하는 과정에서 요건을 일부 재검토해야 하는 상황이 발생한 적이
          있습니다. 그때 {kw("불량")}이나 사양상의 문제점을 정리한 뒤, 고객과
          직접 {kw("미팅")}을 진행했고, 참조하고 있던 {kw("테이블")} 구조를
          변경하는 방향으로 합의했습니다.
        </>
      ),
      jpQ: <>Q. お客様とのコミュニケーション経験はありますか？</>,
      jpA: (
        <>
          はい、あります。要件通りに開発を進め、実装が完了した後にテストを実施している段階で、要件を一部見直す必要がある状況が発生したことがありました。その際、
          {kw("不具合")}や仕様上の課題点を整理した上で、お客様と直接
          {kw("打ち合わせ")}
          を行い、参照しているテーブル構成を変更する方向で合意しました。
        </>
      ),
    },
  ];

  return (
    <div className="ciqa">
      <style>{styleText}</style>

      <div className="wrap">
        <header>
          <h1>면접 Q&A (한국어 답변 + 일본어 토글)</h1>
          <p>
            한국어 답변이 먼저 나오고, 토글을 열면 일본어 답변이 표시됩니다.
            키워드는 빨간색으로 표시됩니다.
          </p>
        </header>

        {items.map((it, idx) => (
          <React.Fragment key={it.id}>
            {/* ✅ 첫 섹션 위엔 선 안 넣고, 그 다음부터 섹션 사이에 실선 */}
            {idx !== 0 && <div className="section-divider" />}

            <section className="card" id={it.id}>
              <h2>{it.title}</h2>

              <div className="qa">
                <div className="q">{it.koQ}</div>
                <div className="a">{it.koA}</div>
              </div>

              <details className="toggle">
                <summary>日本語回答を表示</summary>
                <div className="qa jp">
                  <div className="q">{it.jpQ}</div>
                  <div className="a">{it.jpA}</div>
                </div>
              </details>
            </section>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
