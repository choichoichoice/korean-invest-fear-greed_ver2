# Korea Invest Fear Greed

한국 주식 가격 움직임과 FOMO, 공포, 탐욕, 빚투 위험을 함께 보는 심리 지수 대시보드입니다.
개인용 시장 레이더에 맞춰 글로벌 반도체 온톨로지도 함께 봅니다.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Environment Variables

네이버 데이터랩 검색 트렌드와 무료 언급 레이더를 실데이터로 연결하려면 `.env.local`에 다음 값을 넣습니다.

```bash
NAVER_DATALAB_CLIENT_ID=...
NAVER_DATALAB_CLIENT_SECRET=...
```

두 값은 네이버 개발자센터에서 데이터랩 검색어트렌드 API와 검색 API를 사용하도록 등록한 애플리케이션의 Client ID와 Client Secret입니다. 저장소에는 실제 키를 커밋하지 않습니다.

무료 언급 레이더는 X API를 쓰지 않고 네이버 검색 API의 뉴스, 블로그, 카페글 공개 검색 결과를 합산합니다. 한 번 갱신에 36회 호출하며, 개인용 사용량에서는 네이버 검색 API 일일 한도 안에서 동작하도록 설계했습니다.

Google 웹 언급량 프록시를 연결하려면 Google Custom Search JSON API용 값도 추가합니다.

```bash
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_CX=...
```

`GOOGLE_SEARCH_CX`는 Google Programmable Search Engine의 Search Engine ID입니다.

## Semiconductor Ontology

반도체 시장은 한국 종목만으로 읽지 않고 다음 글로벌 레이어로 나눠 봅니다.

- AI 수요: GPU, hyperscaler capex, HBM 수요
- 메모리 사이클: DRAM/NAND 가격, 재고, 감산
- 파운드리/패키징: 선단 공정, CoWoS, 수율
- 장비/소재: EUV, 식각, 증착, 테스트 장비
- 최종 수요: PC, 모바일, 차량용, 산업재
- 정책/지정학: 수출규제, 보조금, 대만 리스크, 환율

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
