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

export type DevtoolsNetworkRequest = chrome.devtools.network.Request & {
  startedDateTime?: string;
  time?: number;
  request?: HarRequest;
  response?: HarResponse;
  _resourceType?: string | null;
};
