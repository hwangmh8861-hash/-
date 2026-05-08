export async function render(target) {
  target.innerHTML = `
    <section class="page-head">
      <div>
        <h1 class="page-title">도움말</h1>
        <p class="page-desc">처음 로그인한 뒤 5분 안에 핵심 흐름을 이해할 수 있도록 정리했습니다.</p>
      </div>
      <a class="primary-button" href="./docs/user-manual.md" target="_blank" rel="noreferrer">전체 매뉴얼 열기</a>
    </section>
    <div class="help-layout">
      <nav class="help-nav">
        ${sections.map((section) => `<a href="#${section.id}">${section.title}</a>`).join('')}
      </nav>
      <main>
        ${sections.map((section) => `<section id="${section.id}" class="help-section"><h2>${section.title}</h2>${section.body}</section>`).join('')}
      </main>
    </div>
  `;
}

const sections = [
  {
    id: 'start',
    title: '1. 시작하기',
    body: `<ol><li>로그인 후 칸반에서 오늘 움직일 카드를 확인합니다.</li><li>글로벌 검색으로 학교 또는 담당자를 찾습니다.</li><li>기회 카드를 열어 활동로그와 다음액션을 남깁니다.</li><li>대시보드에서 정체 알림과 이번 주 액션을 확인합니다.</li></ol>`
  },
  {
    id: 'funnel',
    title: '2. 영업 퍼널 단계 정의',
    body: `<table><thead><tr><th>단계</th><th>진입 조건</th></tr></thead><tbody>${['리드:학교 정보는 있으나 컨택 전','TM시도:전화 발신 1회 이상','자료발송:자료만 요청받아 발송','EVD예정:방문 미팅 약속 확정','EVD완료:학교 방문 시연 종료','제안서발송:맞춤 제안서 송부','계약검토:품의·행정 절차 진입','계약완료:사인 완료','보류:시점 지연 또는 장기 무응답','드랍:명시적 거절 또는 매칭 실패'].map((row) => { const [a,b] = row.split(':'); return `<tr><td>${a}</td><td>${b}</td></tr>`; }).join('')}</tbody></table>`
  },
  {
    id: 'department',
    title: '3. 부서별 기회 분리 운영',
    body: `<p>같은 학교라도 진로부와 창체부가 다른 예산과 다른 니즈로 움직이면 별도 영업기회로 관리합니다. 예를 들어 분당아람고 진로부는 흑백창업가 EVD완료, 창체부는 필터버블 TM시도 상태로 동시에 존재할 수 있습니다.</p>`
  },
  {
    id: 'bant',
    title: '4. BANT/MEDDIC 작성 가이드',
    body: `<p>TM~EVD 단계에서는 BANT로 예산·권한·니즈·시점을 빠르게 확인합니다. 제안 단계부터는 MEDDIC으로 성과지표, 실제 사인자, 결정 절차, 학교의 실제 고통, 우리 편이 되어줄 챔피언을 구체화합니다.</p>`
  },
  {
    id: 'priority',
    title: '5. 우선순위 자동 산정 규칙',
    body: `<p>예산상태, 권한, 니즈키워드 개수, 시점, 챔피언 여부를 합산하여 S/A/B/C를 산정합니다. 수동오버라이드가 켜져 있으면 자동 변경하지 않습니다.</p>`
  },
  {
    id: 'tags',
    title: '6. 태그 시스템 활용법',
    body: `<p>태그는 카드 클릭 없이 팔로우업 대상을 추출하기 위한 장치입니다. 예를 들어 오늘 재콜할 곳은 부재중-재콜필요 태그와 마지막활동일 3일 이상 조건을 함께 저장해 빠른 필터로 사용합니다.</p>`
  },
  {
    id: 'shortcuts',
    title: '7. 단축키 일람',
    body: `<ul><li>Ctrl/⌘+K: 글로벌 검색</li><li>G+K: 칸반</li><li>G+D: 대시보드</li><li>G+L: 리스트</li><li>N: 새 기회</li><li>?: 도움말</li><li>상세 페이지 E/A/S: 편집·활동추가·단계변경</li></ul>`
  },
  {
    id: 'backup',
    title: '8. 백업·복원 절차',
    body: `<p>설정의 백업·복원 탭에서 지금 백업을 만들거나 전체 JSON을 내려받을 수 있습니다. 복원은 전체 덮어쓰기이므로 비밀번호 재확인 후 실행합니다.</p>`
  },
  {
    id: 'faq',
    title: '9. FAQ',
    body: `<p><strong>한 학교에 카드가 여러 개인 게 맞나요?</strong> 네. 이 시스템은 학교+부서 단위 기회를 기준으로 설계되었습니다.</p><p><strong>보류와 드랍은 삭제인가요?</strong> 아닙니다. 영업 상태 분류이며 데이터는 유지됩니다.</p>`
  }
];
