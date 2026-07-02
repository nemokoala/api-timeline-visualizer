import type { ConsoleEntry } from '../types/console';

const POLL_INTERVAL_MS = 160;
const MAX_SERIALIZE_DEPTH = 64;

export function canInspectConsole(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.devtools?.inspectedWindow?.eval);
}

export async function installConsoleCapture(preserveLog = true): Promise<void> {
  if (!canInspectConsole()) {
    throw new Error('Console capture is available only inside the Chrome DevTools panel.');
  }

  await evalInInspectedPage(buildInstallScript(preserveLog));
}

export type ConsoleDrainResult = {
  /**
   * 검사 대상 페이지에 캡처 훅이 실제로 살아있는지. 페이지가 새로고침/이동되면
   * window 전역이 통째로 날아가므로 false가 되며, 이때 호출부가 재설치해야 한다.
   */
  installed: boolean;
  entries: ConsoleEntry[];
};

export async function drainConsoleEntries(): Promise<ConsoleDrainResult> {
  if (!canInspectConsole()) return { installed: false, entries: [] };

  const raw = await evalInInspectedPage(
    `window.__API_FLOW_CONSOLE_INSTALLED__
      ? { installed: true, entries: window.__API_FLOW_CONSOLE_DRAIN__() }
      : { installed: false, entries: [] }`,
  );

  const result = (raw && typeof raw === 'object' ? raw : {}) as {
    installed?: unknown;
    entries?: unknown;
  };

  return {
    installed: result.installed === true,
    entries: normalizeEntries(result.entries),
  };
}

export async function clearInspectedConsoleBuffer(): Promise<void> {
  if (!canInspectConsole()) return;
  await evalInInspectedPage('window.__API_FLOW_CONSOLE_CLEAR__?.() ?? true');
}

function evalInInspectedPage(expression: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo?.isException) {
        reject(new Error(exceptionInfo.value ?? exceptionInfo.description ?? 'Failed to inspect page console.'));
        return;
      }

      resolve(result);
    });
  });
}

function normalizeEntries(value: unknown): ConsoleEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is ConsoleEntry => {
      if (!item || typeof item !== 'object') return false;
      const entry = item as Partial<ConsoleEntry>;
      return (
        typeof entry.id === 'string' &&
        typeof entry.level === 'string' &&
        typeof entry.timestamp === 'number' &&
        Array.isArray(entry.args) &&
        typeof entry.text === 'string'
      );
    })
    .map((entry) => ({
      id: entry.id,
      level: entry.level,
      timestamp: entry.timestamp,
      args: entry.args,
      text: entry.text,
      stack: entry.stack,
      source: entry.source,
      repeatCount: entry.repeatCount,
    }));
}

function buildInstallScript(preserveLog: boolean): string {
  return `
(() => {
  window.__API_FLOW_CONSOLE_MAX_DEPTH__ = ${MAX_SERIALIZE_DEPTH};

  if (window.__API_FLOW_CONSOLE_INSTALLED__) {
    window.__API_FLOW_CONSOLE_PRESERVE_LOG__ = ${preserveLog ? 'true' : 'false'};
    return true;
  }

  window.__API_FLOW_CONSOLE_INSTALLED__ = true;
  window.__API_FLOW_CONSOLE_PRESERVE_LOG__ = ${preserveLog ? 'true' : 'false'};

  const buffer = window.__API_FLOW_CONSOLE_BUFFER__ = window.__API_FLOW_CONSOLE_BUFFER__ || [];
  let entryCounter = 0;

  const serializeValue = (value, depth, seen) => {
    const maxSerializeDepth = window.__API_FLOW_CONSOLE_MAX_DEPTH__ ?? ${MAX_SERIALIZE_DEPTH};
    if (depth > maxSerializeDepth) return '[MaxDepth]';
    if (value === null) return null;
    if (value === undefined) return undefined;

    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value;
    if (valueType === 'bigint') return value.toString() + 'n';
    if (valueType === 'symbol') return value.toString();
    if (valueType === 'function') return '[Function: ' + (value.name || 'anonymous') + ']';

    if (value instanceof Error) {
      return {
        __type: 'Error',
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (typeof Element !== 'undefined' && value instanceof Element) {
      return {
        __type: 'Element',
        nodeType: value.nodeType,
        tagName: value.tagName,
        id: value.id || undefined,
        className: value.className || undefined,
      };
    }

    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);

      if (Array.isArray(value)) {
        return value.map((item) => serializeValue(item, depth + 1, seen));
      }

      const result = {};
      for (const key of Object.keys(value)) {
        try {
          result[key] = serializeValue(value[key], depth + 1, seen);
        } catch {
          result[key] = '[Unserializable]';
        }
      }
      return result;
    }

    return String(value);
  };

  const formatArgText = (value) => {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    try {
      return JSON.stringify(serializeValue(value, 0, new WeakSet()));
    } catch {
      return String(value);
    }
  };

  const pushEntry = (level, args, extra) => {
    const serializedArgs = args.map((arg) => serializeValue(arg, 0, new WeakSet()));
    const text = serializedArgs.map((arg) => formatArgText(arg)).join(' ');
    entryCounter += 1;

    buffer.push({
      id: 'console_' + Date.now() + '_' + entryCounter,
      level,
      timestamp: Date.now(),
      args: serializedArgs,
      text,
      stack: extra && extra.stack ? String(extra.stack) : undefined,
      source: extra && extra.source ? String(extra.source) : undefined,
    });
  };

  window.__API_FLOW_CONSOLE_DRAIN__ = () => {
    if (!buffer.length) return [];
    return buffer.splice(0, buffer.length);
  };

  window.__API_FLOW_CONSOLE_CLEAR__ = () => {
    buffer.length = 0;
    return true;
  };

  const wrapLevel = (level) => {
    const original = console[level];
    if (typeof original !== 'function') return;

    console[level] = function (...args) {
      pushEntry(level, args);
      return original.apply(console, args);
    };
  };

  ['log', 'info', 'warn', 'error', 'debug', 'table', 'dir'].forEach(wrapLevel);

  const originalClear = console.clear;
  console.clear = function (...args) {
    if (!window.__API_FLOW_CONSOLE_PRESERVE_LOG__) {
      buffer.length = 0;
    }
    pushEntry('clear', []);
    return originalClear.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    pushEntry('error', [event.message], {
      stack: event.error && event.error.stack ? event.error.stack : undefined,
      source: [event.filename, event.lineno, event.colno].filter((part) => part !== undefined).join(':'),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : formatArgText(reason);
    pushEntry('error', [message], {
      stack: reason instanceof Error ? reason.stack : undefined,
      source: 'unhandledrejection',
    });
  });

  return true;
})()
`;
}

export function getConsolePollInterval(): number {
  return POLL_INTERVAL_MS;
}
