import type { ConsoleEntry } from '../types/console';
import type { ApiRequest } from '../types/network';
import type { HarTimings } from '../types/chrome-har';
import type { CookieSnapshot, PageStorageSnapshot } from '../types/storage';
import { parseResponseContent } from '../utils/requestParser';
import { normalizeTimings } from '../utils/requestTimings';

/**
 * 목업 데이터는 로컬 UI 개발/테스트 전용이다.
 * `npm run dev`로 띄우면 Chrome DevTools 컨텍스트가 아니어서
 * chrome.devtools.* API가 전부 없고, 네트워크/콘솔/스토리지가 모두 빈 화면이 된다.
 * 이때만(개발 모드 + 확장 컨텍스트 아님) 아래 목업을 주입해 실제 데이터처럼 렌더한다.
 * 확장 프로그램(dist) 빌드에서는 import.meta.env.DEV가 false라 절대 실행되지 않는다.
 */
export function shouldUseMockData(): boolean {
  if (!import.meta.env.DEV) return false;
  const hasDevtools =
    typeof chrome !== 'undefined' && Boolean(chrome.devtools?.inspectedWindow?.eval);
  return !hasDevtools;
}

const HOST = 'api.example.com';
const BASE = Date.now() - 8_000;

type MockRequestSeed = {
  id: string;
  method: string;
  path: string;
  status: number;
  statusText?: string;
  offset: number; // BASE로부터의 시작 시각(ms)
  duration: number;
  // 원시 HAR 타이밍. 있으면 정규화해 단계별 바를 그린다(-1은 해당 없음). 없으면 단일 바.
  harTimings?: HarTimings;
  type: ApiRequest['type'];
  mimeType?: string;
  queryParams?: Record<string, string>;
  requestBody?: unknown;
  response: unknown;
  error?: string;
};

const SEEDS: MockRequestSeed[] = [
  {
    id: 'mock-1',
    method: 'GET',
    path: '/v1/users/me',
    status: 200,
    offset: 0,
    duration: 142,
    // 새 커넥션: 모든 단계가 잡힌다.
    harTimings: { blocked: 2, dns: 5, connect: 12, ssl: 8, send: 1, wait: 100, receive: 14 },
    type: 'fetch',
    mimeType: 'application/json',
    response: {
      id: 'usr_8f21',
      name: 'Jane Cooper',
      email: 'jane.cooper@example.com',
      role: 'admin',
      createdAt: '2025-11-02T09:12:44Z',
    },
  },
  {
    // mock-1과 같은 엔드포인트의 두 번째 호출(응답 비교 diff 테스트용).
    id: 'mock-1b',
    method: 'GET',
    path: '/v1/users/me',
    status: 200,
    offset: 5200,
    duration: 128,
    type: 'fetch',
    mimeType: 'application/json',
    response: {
      id: 'usr_8f21',
      name: 'Jane B. Cooper',
      email: 'jane.cooper@example.com',
      role: 'member',
      createdAt: '2025-11-02T09:12:44Z',
      lastLoginAt: '2026-07-08T11:02:10Z',
    },
  },
  {
    id: 'mock-2',
    method: 'GET',
    path: '/v1/projects',
    status: 200,
    offset: 220,
    duration: 318,
    // 재사용된 커넥션: dns/connect/ssl은 -1이라 정규화에서 빠진다.
    harTimings: { blocked: 1, dns: -1, connect: -1, ssl: -1, send: 1, wait: 300, receive: 15 },
    type: 'fetch',
    mimeType: 'application/json',
    queryParams: { page: '1', pageSize: '20', sort: 'updatedAt:desc' },
    response: {
      total: 3,
      items: [
        { id: 'prj_01', name: 'Timeline Visualizer', stars: 42, archived: false },
        { id: 'prj_02', name: 'DevLens Core', stars: 128, archived: false },
        { id: 'prj_03', name: 'Legacy Dashboard', stars: 7, archived: true },
      ],
    },
  },
  {
    id: 'mock-3',
    method: 'POST',
    path: '/v1/projects',
    status: 201,
    statusText: 'Created',
    offset: 640,
    duration: 275,
    type: 'fetch',
    mimeType: 'application/json',
    requestBody: { name: 'New Experiment', visibility: 'private' },
    response: { id: 'prj_04', name: 'New Experiment', visibility: 'private', stars: 0 },
  },
  {
    id: 'mock-4',
    method: 'GET',
    path: '/v1/projects/prj_02/analytics',
    status: 200,
    offset: 980,
    duration: 1240, // 느린 요청 (isSlow)
    // 대부분이 서버 대기(wait)인 느린 요청.
    harTimings: { blocked: 3, dns: 10, connect: 40, ssl: 25, send: 2, wait: 1100, receive: 60 },
    type: 'xhr',
    mimeType: 'application/json',
    queryParams: { range: '30d', granularity: 'day' },
    response: {
      range: '30d',
      series: [
        { date: '2026-06-08', views: 1203, uniques: 842 },
        { date: '2026-06-09', views: 1580, uniques: 991 },
        { date: '2026-06-10', views: 1344, uniques: 903 },
      ],
    },
  },
  {
    id: 'mock-5',
    method: 'PATCH',
    path: '/v1/users/me/preferences',
    status: 204,
    statusText: 'No Content',
    offset: 1180,
    duration: 96,
    type: 'fetch',
    requestBody: { theme: 'dark', density: 'compact' },
    response: '',
  },
  {
    id: 'mock-6',
    method: 'GET',
    path: '/v1/notifications',
    status: 304,
    statusText: 'Not Modified',
    offset: 1500,
    duration: 54,
    type: 'fetch',
    mimeType: 'application/json',
    response: 'Response body is empty.',
  },
  {
    id: 'mock-7',
    method: 'GET',
    path: '/v1/projects/prj_99',
    status: 404,
    statusText: 'Not Found',
    offset: 2100,
    duration: 88,
    type: 'fetch',
    mimeType: 'application/json',
    response: { error: 'not_found', message: 'Project prj_99 does not exist.' },
  },
  {
    id: 'mock-8',
    method: 'DELETE',
    path: '/v1/sessions/expired',
    status: 500,
    statusText: 'Internal Server Error',
    offset: 2600,
    duration: 410,
    harTimings: { blocked: 1, dns: 6, connect: 18, ssl: 12, send: 2, wait: 360, receive: 11 },
    type: 'fetch',
    mimeType: 'application/json',
    response: { error: 'internal_error', requestId: 'req_a91f3c', message: 'Unexpected failure.' },
  },
  {
    id: 'mock-9',
    method: 'GET',
    path: '/graphql',
    status: 200,
    offset: 3200,
    duration: 660,
    // 재사용된 커넥션(dns/connect/ssl 없음), 서버 대기 위주.
    harTimings: { blocked: 2, dns: -1, connect: -1, ssl: -1, send: 3, wait: 600, receive: 55 },
    type: 'fetch',
    mimeType: 'application/json',
    requestBody: { query: 'query Me { viewer { id login } }' },
    response: { data: { viewer: { id: 'usr_8f21', login: 'janecooper' } } },
  },
  {
    id: 'mock-10',
    method: 'GET',
    path: '/assets/logo.svg',
    status: 200,
    offset: 3600,
    duration: 34,
    type: 'image',
    mimeType: 'image/svg+xml',
    response:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#7048e8"/></svg>',
  },
  {
    id: 'mock-11',
    method: 'GET',
    path: '/assets/app.css',
    status: 200,
    offset: 60,
    duration: 22,
    type: 'stylesheet',
    mimeType: 'text/css',
    response: ':root{--brand:#3b82f6}body{margin:0}',
  },
  {
    id: 'mock-12',
    method: 'GET',
    path: '/assets/main.js',
    status: 200,
    offset: 80,
    duration: 118,
    type: 'script',
    mimeType: 'application/javascript',
    response: 'console.log("bundle loaded");',
  },
  {
    id: 'mock-13',
    method: 'GET',
    path: '/assets/fonts/Inter.woff2',
    status: 200,
    offset: 120,
    duration: 46,
    type: 'font',
    mimeType: 'font/woff2',
    response: 'Response body is not available.',
  },
  {
    id: 'mock-14',
    method: 'GET',
    path: '/private/development/:id/:id/analysis-output/:id/videos/74754257-8123-4abc-9def-intro.mp4',
    status: 206,
    statusText: 'Partial Content',
    offset: 4200,
    duration: 890,
    type: 'media',
    mimeType: 'video/mp4',
    response: 'Response body is not available.',
  },
  {
    id: 'mock-15',
    method: 'GET',
    path: '/assets/avatar.png',
    status: 200,
    offset: 140,
    duration: 52,
    type: 'image',
    mimeType: 'image/png',
    // 실제 확장에서 getContent가 돌려주는 것과 동일한 bare base64(썸네일 경로 검증용).
    response:
      'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAE0lEQVR4nGNQyf9GEDGMKhqMigBKrd0RN+JkhwAAAABJRU5ErkJggg==',
  },
];

function toApiRequest(seed: MockRequestSeed): ApiRequest {
  const startedAt = BASE + seed.offset;
  const endedAt = startedAt + seed.duration;
  const query = seed.queryParams
    ? '?' + new URLSearchParams(seed.queryParams).toString()
    : '';
  const url = `https://${HOST}${seed.path}${query}`;
  const responseContent =
    typeof seed.response === 'string' ? seed.response : JSON.stringify(seed.response, null, 2);

  return {
    id: seed.id,
    url,
    host: HOST,
    path: seed.path + query,
    normalizedPath: seed.path,
    method: seed.method,
    status: seed.status,
    statusText: seed.statusText,
    startedAt,
    endedAt,
    duration: seed.duration,
    timings: normalizeTimings(seed.harTimings, seed.duration),
    type: seed.type,
    mimeType: seed.mimeType,
    requestHeaders: {
      accept: 'application/json',
      authorization: 'Bearer mock.jwt.token',
      'user-agent': 'DevLens-Mock/0.1',
    },
    responseHeaders: {
      'content-type': seed.mimeType ?? 'application/json',
      'cache-control': 'no-cache',
      'x-request-id': `req_${seed.id}`,
    },
    requestCookies: [
      { name: 'sid', value: 's%3Amock.session.token' },
      { name: 'locale', value: 'ko-KR' },
    ],
    responseCookies: [
      {
        name: 'sid',
        value: 's%3Amock.session.token',
        domain: '.example.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ],
    queryParams: seed.queryParams,
    requestBody: seed.requestBody,
    responseContent,
    responsePreview: parseResponseContent(responseContent, seed.mimeType),
    size: responseContent.length,
    error: seed.error,
  };
}

export function getMockRequests(): ApiRequest[] {
  return SEEDS.map(toApiRequest);
}

export function getMockConsoleEntries(): ConsoleEntry[] {
  const base = BASE;
  return [
    {
      id: 'log-1',
      level: 'info',
      timestamp: base + 40,
      args: ['App booted', { env: 'development', version: '0.1.0' }],
      text: 'App booted { env: "development", version: "0.1.0" }',
      source: 'main.tsx:12',
    },
    {
      id: 'log-2',
      level: 'log',
      timestamp: base + 260,
      args: ['Fetching projects…'],
      text: 'Fetching projects…',
      source: 'projects.ts:44',
    },
    {
      id: 'log-3',
      level: 'debug',
      timestamp: base + 300,
      args: ['cache miss', { key: 'projects:list' }],
      text: 'cache miss { key: "projects:list" }',
      source: 'cache.ts:88',
    },
    {
      id: 'log-4',
      level: 'warn',
      timestamp: base + 1020,
      args: ['Analytics request is slow (>1s)', { path: '/v1/projects/prj_02/analytics' }],
      text: 'Analytics request is slow (>1s) { path: "/v1/projects/prj_02/analytics" }',
      source: 'analytics.ts:31',
      repeatCount: 2,
    },
    {
      id: 'log-5',
      level: 'table',
      timestamp: base + 1300,
      args: [
        [
          { project: 'Timeline Visualizer', stars: 42 },
          { project: 'DevLens Core', stars: 128 },
        ],
      ],
      text: '[table] 2 rows',
      source: 'projects.ts:70',
    },
    {
      id: 'log-6',
      level: 'error',
      timestamp: base + 2700,
      args: ['Failed to delete session', new Error('Internal Server Error')],
      text: 'Failed to delete session Error: Internal Server Error',
      stack:
        'Error: Internal Server Error\n    at deleteSession (sessions.ts:52:11)\n    at async flushExpired (sessions.ts:18:5)',
      source: 'sessions.ts:52',
    },
    {
      id: 'log-7',
      level: 'dir',
      timestamp: base + 3300,
      args: [{ viewer: { id: 'usr_8f21', login: 'janecooper', roles: ['admin', 'billing'] } }],
      text: '{ viewer: { id: "usr_8f21", login: "janecooper", roles: Array(2) } }',
      source: 'graphql.ts:24',
    },
  ];
}

export function getMockStorageSnapshot(): PageStorageSnapshot {
  const entry = (key: string, value: string) => ({ key, value, size: key.length + value.length });
  return {
    origin: 'https://app.example.com',
    href: 'https://app.example.com/dashboard',
    capturedAt: new Date().toISOString(),
    localStorage: [
      entry('auth.token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.payload'),
      entry('auth.refreshToken', 'rt_9f2c1a7b4e8d'),
      entry('theme', 'dark'),
      entry('feature.flags', JSON.stringify({ newTimeline: true, betaFlow: false })),
      entry('recentProjects', JSON.stringify(['prj_02', 'prj_01', 'prj_03'])),
    ],
    sessionStorage: [
      entry('nav.lastPath', '/dashboard/projects'),
      entry('form.draft', JSON.stringify({ name: 'New Experiment', dirty: true })),
      entry('analytics.sessionId', 'sess_7b3d9f2a'),
    ],
    indexedDB: [
      {
        name: 'devlens-cache',
        version: 3,
        stores: [
          {
            name: 'requests',
            keyPath: 'id',
            autoIncrement: false,
            count: 2,
            records: [
              { key: 'prj_01', value: JSON.stringify({ id: 'prj_01', name: 'Timeline Visualizer' }) },
              { key: 'prj_02', value: JSON.stringify({ id: 'prj_02', name: 'DevLens Core' }) },
            ],
          },
          {
            name: 'meta',
            keyPath: null,
            autoIncrement: true,
            count: 1,
            records: [{ key: '1', value: JSON.stringify({ lastSync: '2026-07-07T00:00:00Z' }) }],
          },
        ],
      },
    ],
    errors: [],
  };
}

export function getMockCookieSnapshot(): CookieSnapshot {
  const size = (name: string, value: string) => name.length + value.length;
  const cookie = (
    name: string,
    value: string,
    overrides: Partial<CookieSnapshot['cookies'][number]> = {},
  ) => ({
    name,
    value,
    domain: '.example.com',
    path: '/',
    expires: Math.round(Date.now() / 1000) + 60 * 60 * 24 * 30,
    size: size(name, value),
    httpOnly: false,
    secure: true,
    sameSite: 'lax' as const,
    hostOnly: false,
    ...overrides,
  });

  return {
    url: 'https://app.example.com/dashboard',
    capturedAt: new Date().toISOString(),
    cookies: [
      cookie('sid', 's%3Amock.session.token', { httpOnly: true, sameSite: 'strict' }),
      cookie('csrftoken', 'xY7bQ2mock', { httpOnly: false }),
      cookie('_ga', 'GA1.2.1234567890.1720000000', {
        domain: '.example.com',
        secure: false,
        sameSite: 'none',
      }),
      cookie('locale', 'ko-KR', { domain: 'app.example.com', hostOnly: true, secure: false }),
      cookie('consent', 'true', { expires: null }),
    ],
    errors: [],
  };
}
