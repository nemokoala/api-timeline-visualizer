export type HarHeader = {
  name: string;
  value: string;
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
  queryString?: HarHeader[];
  postData?: HarPostData;
};

export type HarResponse = {
  status: number;
  statusText?: string;
  headers?: HarHeader[];
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
