# Korea Invest Fear Greed

한국 주식 가격 움직임과 FOMO, 공포, 탐욕, 빚투 위험을 함께 보는 심리 지수 대시보드입니다.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Environment Variables

네이버 데이터랩 검색 트렌드를 실데이터로 연결하려면 `.env.local`에 다음 값을 넣습니다.

```bash
NAVER_DATALAB_CLIENT_ID=...
NAVER_DATALAB_CLIENT_SECRET=...
```

두 값은 네이버 개발자센터에서 데이터랩 검색어트렌드 API를 사용하도록 등록한 애플리케이션의 Client ID와 Client Secret입니다. 저장소에는 실제 키를 커밋하지 않습니다.

Google 웹 언급량 프록시를 연결하려면 Google Custom Search JSON API용 값도 추가합니다.

```bash
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_CX=...
```

`GOOGLE_SEARCH_CX`는 Google Programmable Search Engine의 Search Engine ID입니다.

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
