# 펭곰이 (Android)

인스타그램·유튜브·틱톡에서 화면을 넘긴 횟수를 세고, 아침에 한 약속을 넘기면 펭곰이가 끼어드는 앱.

## 구조

| 파일 | 하는 일 |
|---|---|
| `ScrollCounterService.kt` | 접근성 서비스. 대상 앱의 스크롤 이벤트를 받아 "넘기기"로 셈 |
| `CounterStore.kt` | 오늘 횟수·약속·개입 지점 저장 (폰 안에만). 자정에 어제 기록으로 넘김 |
| `OverlayController.kt` | 다른 앱 위의 카운터 `↕ 37 · 56 남음`, 펭곰이 한마디, 약속 초과 시트 |
| `MainActivity.kt` | 앱 본 화면. `../scroll-melt/index.html`을 WebView로 띄우고 `PengomNative`로 연결 |

앱 화면은 웹 프로토타입과 같은 파일을 쓴다. 빌드할 때 `scroll-melt/index.html`이 자동으로 복사된다.

## 넘기기를 세는 기준

1. 대상 앱(인스타, 유튜브, 틱톡)의 스크롤 이벤트
2. 스크롤된 화면이 세로로 화면의 55% 이상 (댓글창 등 제외)
3. 위로 되돌아가는 스크롤 제외
4. 650ms 안의 이벤트는 한 번으로 봄

실기기에서 숫자를 보며 `ScrollCounterService.kt`의 `DEBOUNCE_MS`, `MIN_HEIGHT_RATIO`를 조정한다.

## 빌드

JDK 17과 Android SDK(플랫폼 34)가 필요하다.

```bash
gradle -p pengom-android assembleDebug
```

결과물: `pengom-android/app/build/outputs/apk/debug/app-debug.apk`

Android Studio에서는 `pengom-android` 폴더를 열고 Run을 누르면 된다.

## 폰에서 처음 켤 때

1. APK 설치 (출처를 알 수 없는 앱 허용 필요)
2. 펭곰이 열기 → 아침 약속 → "스크롤 세기 켜기"
3. 설정 > 접근성 > 설치된 앱 > 펭곰이 스크롤 카운터 켜기
   - Android 13 이상에서 사이드로드한 앱은 "제한된 설정"으로 막힐 수 있다. 앱 정보 > 오른쪽 위 ⋮ > "제한된 설정 허용" 후 다시 켠다.
4. 인스타 릴스나 유튜브 쇼츠를 열면 화면 위에 카운터가 뜬다.
