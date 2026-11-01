# 으-탱 프로젝트 홈페이지

제공된 프로젝트 영상과 DJ Juice의 Type A·B 두 비트를 연결한 한국어 음악 프로젝트 사이트다. 정적인 소개 페이지, 실제 MP3 플레이어, 클릭 시 여는 영상, 프로젝트 원본 링크를 제공한다. 프로젝트 주최자의 공식 홈페이지나 Wu-Tang Clan과의 공식 제휴를 주장하지 않는다.

## GitHub Pages

- 저장소: [Technoetic/eu-tang-project](https://github.com/Technoetic/eu-tang-project)
- 예정 주소: [https://technoetic.github.io/eu-tang-project/](https://technoetic.github.io/eu-tang-project/)

배포 완료와 예정 주소의 실제 응답은 아직 확인하지 않았다. GitHub Pages의 프로젝트 경로는 `/eu-tang-project/`이며, 배포 소스로 GitHub Actions를 사용한다. 워크플로는 테스트, 해당 기본 경로를 지정한 빌드, `dist/` 아티팩트 업로드와 Pages 배포 순서로 구성한다. 저장소 소스에는 배포 자격증명을 넣지 않는다.

## 로컬 실행

Node.js 20 이상과 Python 3을 사용한다. 별도 npm 의존성 설치는 필요하지 않다. PowerShell에서 Pages와 같은 경로로 빌드하고 확인한다.

```powershell
npm test
$env:BASE_PATH = '/eu-tang-project/'
npm run build
python scripts/preview.py --port 5185 --base /eu-tang-project/
```

로컬 주소는 `http://127.0.0.1:5185/eu-tang-project/`다. `#home`, `#about`, `#beats`, `#story`, `#guide`를 직접 공유하고 일반 새로고침·뒤로·앞으로 이동할 수 있다. 미리보기 서버의 응답은 GitHub Pages 운영 환경의 응답과 별도로 검증한다.

## 원본과 사용 조건

- 영상: https://www.youtube.com/watch?v=3WUmK-k2OYM&t=6s
- 채널: https://www.youtube.com/@issacsekki
- 비트 원본: https://drive.google.com/drive/folders/1AchBWcekp0otNgUtezgbLMMKKqJWQh87
- 파일: `Beat by DJ Juice Type A.mp3`, `Beat by DJ Juice Type B.mp3`

영상 설명의 조건을 그대로 표시한다: **상업적 목적의 사용 혹은 개인 용도의 사용은 금지합니다.** 공개 열람이나 이 사이트를 만드는 작업으로 다른 용도의 허락이 생기는 것은 아니다. 원본 바이트·공개 출처·해시·형식 검증은 `evidence/source-assets.json`에 기록했다.

## 구조와 업데이트

소스의 JS는 화면·오디오·프로젝트 데이터·버전 확인·공통 형식으로 나누고 CSS는 토큰·기본·컴포넌트로 나눴다. `scripts/build.mjs`는 내용 기반 build ID와 자산 경로를 만들며, `BASE_PATH`로 Pages의 프로젝트 경로를 지정한다. HTML에 포함한 실행 build와 동일 출처의 `version.json`을 비교하고, 다른 버전은 다음 안전한 메뉴 이동에서 새 문서로 연다. 재생 중인 음악은 백그라운드 버전 검사로 끊지 않는다. 이 정적 사이트에는 미저장 양식이나 서버 저장 요청이 없다.

GitHub Pages에서는 `_headers` 같은 파일로 사용자 지정 응답 헤더를 적용할 수 없다. 따라서 내용으로 식별한 자산 경로, 최신 버전 조회를 위한 새 쿼리, 안전한 문서 이동을 사용한다. 로컬 서버나 `_headers` 파일에 적힌 캐시 정책이 Pages에서도 적용된다고 간주하지 않는다. 연속 로컬 빌드가 남긴 과거 자산과 별개로 새 배포에 포함할 파일을 확인해야 한다. 없는 경로는 생성된 `404.html`로 안내한다.

## 검증 범위

동작 시험은 네이티브 오디오의 비동기 전환·재시도, 버전 롤백·통신 실패·재생 중 보호, 잘못된 프로젝트 목록을 검사한다. 실제 화면·음원·390px iframe·새 문서 전환은 Aside CLI로 별도 확인하며 실행 결과는 로컬 `.artifacts/`에 보존한다. iframe 검사는 실물 모바일 기기 시험이 아니며 외부 YouTube 스트림 전체 재생을 대신하지 않는다.

GitHub Pages 운영 환경의 실제 캐시 동작과 배포 간 버전 전환은 아직 인증하지 않았다. 게시 후 문서·자산·`version.json`의 실제 응답과 새 버전 이동을 확인해야 한다.
