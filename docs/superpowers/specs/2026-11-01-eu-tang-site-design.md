# 으-탱 프로젝트 홈페이지 설계

사용자가 제공한 YouTube 소개 영상과 Google Drive의 실제 비트 두 곡을 중심으로 프로젝트를 소개한다. 확인된 채널은 박이삭 세끼, 비트 파일은 Beat by DJ Juice Type A.mp3와 Type B.mp3다. 영상의 설명은 '재미로 시작했습니다. 재미로 끝날 겁니다.'이며, 상업적 목적 또는 개인 용도의 사용을 금지한다. 이 사용 조건을 비트 영역에 그대로 알린다. 이 페이지를 프로젝트 주최자의 공식 홈페이지라고 단정하거나 실제 Wu-Tang Clan과의 공식 제휴를 주장하지 않는다.

첫 화면은 음악 프로젝트에 어울리는 편집 디자인으로 으-탱이라는 이름과 비트를 듣는 행동을 강조한다. 크림색·먹색·산성 노랑 포인트, 큰 한글 타이포, 직접 그린 레코드 시각물, 실제 영상 썸네일을 사용한다. 이름/수치/후기/모집 일정/미확인 연락처를 만들지 않는다.

화면은 #home, #about, #beats, #story, #guide로 직접 공유한다. 비트 두 곡은 한 플레이어로 재생·일시정지·곡 전환·탐색·음량 조정하고 재생 오류 및 재시도를 제공한다. 자동 재생은 하지 않는다. 영상은 명시적인 재생 버튼을 누를 때만 dialog에 YouTube iframe을 생성한다. 다운로드는 제공된 프로젝트 비트의 로컬 복사본과 원본 Drive 링크로 안내한다. 녹음 업로드·회원·신청 양식·새 개인정보 저장은 만들지 않는다.

HTML/JS/CSS를 분리한 빌드 없는 정적 사이트로 개발하고 Node의 의존성 없는 빌드로 내용 식별 경로를 만든다. JS는 ProjectService, AudioPlayer, VersionService, HomeScreen 책임을 분리한다. HTML에 로드 버전을 포함하고 동일 출처 version.json과 비교한다. 포커스/복원 및 메뉴 이동에서 확인하고 새 버전은 다음 안전한 이동에서 새 문서로 적용한다. 음악 재생 중에는 재생을 보호하고 다음 이동으로 미룬다. 양식이 없어 미저장 입력/저장 요청은 없다. 버전 확인 실패가 현재 페이지나 음악을 망가뜨리지 않게 한다.

Sites가 만든 새 비공개 사이트에 소스와 일치하는 아카이브를 게시한다. 권한을 공개로 확대하지 않는다. 기능·390px 레이아웃·키보드·실제 미디어 파일·캐시/버전 전환을 Aside CLI로 확인한다. 확인하지 않은 항목을 통과로 쓰지 않는다.

## 분업 계약

- UI: src/index.html, src/styles/tokens.css, base.css, components.css, src/static/favicon.svg. JS와 빌드 설정은 수정하지 않는다.
- 자료: source-media/type-a.mp3, type-b.mp3, video-poster.jpg 및 evidence/source-assets.json만 작성한다. 다운로드 원본은 공개 Drive 두 file ID와 영상 og:image다.
- 주 구현: src/js/**, src/data/project.json, scripts/**, tests/**, hosting manifest, 최종 빌드·Aside 검증·배포를 맡는다.

## UI/JS 계약

HTML 플레이 버튼: button[data-play="type-a"], button[data-play="type-b"]. 카드: [data-track="type-a"], [data-track="type-b"]. 다운로드: a[data-download="type-a"], a[data-download="type-b"], href는 초기 원본 Drive 링크여도 된다.

미니 플레이어: #player-bar(hidden 시작), #player-toggle, #player-close, #player-title, #player-current, #player-duration, #player-seek(range 0..1000), #player-volume(range 0..1 step .01), #player-status(role=status). 재생 카드의 .is-playing과 body.is-playing에 스타일을 제공한다. 각 data-play 버튼은 data-icon-play와 data-icon-pause 요소를 가지거나 JS가 aria-label/aria-pressed로 제어해도 된다. 직접 document 전역의 중복 ID를 만들지 않는다.

영상: button[data-open-video], dialog#video-dialog, button[data-close-video], #video-mount. 프로젝트 데이터 실패: #load-status(role=status), button#retry-load(hidden 시작). 새 버전 안내: #update-notice(role=status hidden 시작). 햄버거: button#menu-toggle(aria-controls=site-nav), nav#site-nav. 내부 앵커는 a[data-nav]이며 href=#home/#about/#beats/#story/#guide다.

빌드 치환 토큰: {{BUILD_ID}}, {{STYLE_URL}}, {{APP_URL}}, {{POSTER_URL}}, {{FAVICON_URL}}. HTML은 meta[name=app-build] content={{BUILD_ID}}, link href={{STYLE_URL}}, script type=module src={{APP_URL}}, video poster img src={{POSTER_URL}}를 사용한다. 인라인 JS·이벤트·스타일 속성은 사용하지 않는다. SVG는 마크업에 직접 넣어도 된다.


## Hosting change (2026-11-01)

The user subsequently requested public GitHub Pages hosting. The current deployment uses a sanitized standalone repository and /eu-tang-project/ base path. The earlier private Sites instructions above describe the first implementation, not the current publishing target. No Sites identity, token, or private source history is included.
