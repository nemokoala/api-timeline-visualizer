export type HarHeader = {
  name: string;
  value: string;
};

export type HarCookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string | null;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

export type HarPostData = {
  mimeType?: string;
  text?: string;
  params?: Array<{ name: string; value?: string }>;
};

export type HarRequest = {
  method: string;
  url: string;
  headers?: HarHeader[];
  cookies?: HarCookie[];
  queryString?: HarHeader[];
  postData?: HarPostData;
};

export type HarResponse = {
  status: number;
  statusText?: string;
  headers?: HarHeader[];
  cookies?: HarCookie[];
  content?: {
    mimeType?: string;
    size?: number;
    text?: string;
  };
};

/**
 * HAR entry.timings. 각 값은 ms이며 -1은 "해당 없음/알 수 없음"을 뜻한다.
 * (예: 재사용된 커넥션은 dns/connect/ssl이 -1로 온다.)
 */
export type HarTimings = {
  blocked?: number;
  dns?: number;
  connect?: number;
  ssl?: number;
  send?: number;
  wait?: number;
  receive?: number;
};

export type DevtoolsNetworkRequest = chrome.devtools.network.Request & {
  startedDateTime?: string;
  time?: number;
  timings?: HarTimings;
  request?: HarRequest;
  response?: HarResponse;
  _resourceType?: string | null;
};
