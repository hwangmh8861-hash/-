# 학교영업CRM Phase 5 프론트엔드

Phase 5는 Phase 4 최종본 위에 학교 상세 페이지와 기회 상세 페이지를 추가한 버전입니다. 학교 1개 안에서 여러 부서와 여러 영업기회를 동시에 관리하는 구조를 기준으로 구현했습니다.

## 포함 범위

- 학교 상세 `#/school/:school_id`
  - 학교 헤더
  - 부서·기회 트리
  - 학교정보 편집
  - 부서 추가와 부서정보 편집
  - 같은 학교 내 새 기회 빠른 생성
- 기회 상세 직접 진입 `#/opp/:opp_id`
  - 해당 기회가 속한 학교 상세로 이동
  - 선택된 기회 탭으로 자동 포커스
- 기회 상세 4개 탭
  - 기본정보
  - 영업검증 BANT/MEDDIC
  - 활동로그
  - 다음액션
- 단계 변경 공통 모달
  - 단계 변경 사유 입력
  - 자동 제안 태그
  - TM시도 → EVD예정 이동 시 다음액션 필수 입력
  - 변경 시 활동 로그 자동 생성
- 담당자 카드
  - 전화, 문자, 이메일 빠른 액션
  - 챔피언 토글
  - 담당자 추가, 편집, 제거
- 활동 로그
  - 새 활동 추가
  - 활동 편집, 삭제
  - 결과태그 저장
  - 다음액션 동시 등록
  - Web Speech API 기반 음성메모 받아쓰기
- 다음액션
  - 오픈 액션 날짜순 표시
  - 미니 캘린더 분포
  - 액션 완료 후 후속 액션 등록

## 로컬 실행

```bash
cd crm_phase5_frontend
python3 -m http.server 5173
```

브라우저에서 접속합니다.

```text
http://localhost:5173
```

목업 모드에서는 로그인 비밀번호에 아무 값이나 입력하면 됩니다.

## 실제 GAS API 연결

`/js/api.js`의 `CONFIG.GAS_URL`을 Phase 1에서 배포한 Web App URL로 바꿉니다.

```js
export const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/여기에_GAS_웹앱_URL을_입력하세요/exec',
  TOKEN_KEY: 'crm_token',
  TOKEN_TTL_MS: 30 * 60 * 1000
};
```

그리고 `index.html`의 목업 설정을 끕니다.

```html
<script>
  window.__USE_MOCK = false;
</script>
```

## Phase 5 주요 파일

```text
js/views/schoolDetail.js
js/components/oppTabs.js
js/components/bantMeddicForm.js
js/components/activityTimeline.js
js/components/contactCard.js
js/components/stageChangeModal.js
js/utils/voiceRecognition.js
css/schoolDetail.css
```

## 목업 API 추가 동작

Phase 5 화면 검증을 위해 `/js/api.js`의 목업 API에 아래 동작을 보강했습니다.

```text
school.update
dept.create
dept.update
dept.delete
contact.create
contact.update
contact.delete
activity.update
activity.delete
opp.update 우선순위 자동 재계산
```

실제 GAS API도 Phase 1 명세와 동일한 action 이름을 사용하면 프론트 코드를 크게 바꾸지 않고 연결할 수 있습니다.

## Vercel 배포

1. 프로젝트 폴더를 GitHub에 업로드합니다.
2. Vercel에서 새 프로젝트로 가져옵니다.
3. Framework Preset은 Other 또는 Static으로 둡니다.
4. Build Command는 비워둡니다.
5. Output Directory도 비워두거나 `.`로 둡니다.
6. 배포 후 발급된 URL로 접속합니다.

`vercel.json`은 정적 파일 캐싱과 SPA 라우팅을 위한 rewrite 설정을 포함합니다.

## 외부 CDN

- Pretendard
- SortableJS
- Chart.js 4.4.0
- SheetJS 0.18.5

이미지 base64는 사용하지 않았습니다.

## Phase 6 운영 도구 추가 사항

이번 버전은 Phase 5 상세 페이지까지 포함한 프론트엔드에 운영 단계 기능을 추가한 누적본입니다.

추가 경로:

- `#/migrate` 기존 CRM 마이그레이션 위저드
- `#/settings` 설정, 백업·복원, 알림, 마이그레이션 로그
- `#/settings/notifications` 알림 설정
- `#/reports` 월간 리포트 열람
- `#/help` 사용자 도움말

추가 백엔드:

- `Code.gs` 파일은 Phase 1 GAS 코드에 붙여넣는 운영 기능 추가분입니다.
- 붙여넣은 뒤 `initializeOperationSheets()`를 1회 실행합니다.
- 이후 `installOperationTriggers()`를 1회 실행하면 자동 백업, 일일 알림, 월간 리포트 트리거가 설치됩니다.

추가 문서:

- `docs/migration-guide.md` 기존 CRM 이관 가이드
- `docs/user-manual.md` 전체 사용자 매뉴얼
- `docs/operations.md` 백업·복원·트러블슈팅

로컬 실행:

```bash
cd crm_phase6_frontend
python3 -m http.server 5173
```

접속:

```text
http://localhost:5173
```

목업 모드에서는 비밀번호에 아무 값이나 입력하면 로그인됩니다.
