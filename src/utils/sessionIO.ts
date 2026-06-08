import type { ApiRequest } from '../types/network';

const SESSION_VERSION = 1;

type ExportedSession = {
  version: typeof SESSION_VERSION;
  exportedAt: string;
  requests: ApiRequest[];
};

function isApiRequest(value: unknown): value is ApiRequest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ApiRequest>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.method === 'string' &&
    typeof candidate.startedAt === 'number'
  );
}

function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = objectUrl;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function serializeSession(requests: ApiRequest[]): string {
  const payload: ExportedSession = {
    version: SESSION_VERSION,
    exportedAt: new Date().toISOString(),
    requests,
  };

  return JSON.stringify(payload, null, 2);
}

export function parseSession(content: string): ApiRequest[] {
  const parsed: unknown = JSON.parse(content);

  if (Array.isArray(parsed)) {
    if (!parsed.every(isApiRequest)) {
      throw new Error('Invalid request list in session file.');
    }
    return parsed;
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    (parsed as ExportedSession).version === SESSION_VERSION &&
    Array.isArray((parsed as ExportedSession).requests)
  ) {
    const requests = (parsed as ExportedSession).requests;
    if (!requests.every(isApiRequest)) {
      throw new Error('Invalid request entries in session file.');
    }
    return requests;
  }

  throw new Error('Unsupported session file format.');
}

export function exportSession(requests: ApiRequest[]): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadJson(serializeSession(requests), `api-flow-session-${timestamp}.json`);
}

export function pickSessionFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }

      file
        .text()
        .then(resolve)
        .catch(() => reject(new Error('Failed to read session file.')));
    });

    input.click();
  });
}
