import { useEffect, useMemo } from 'react';
import type { ReplayDraft } from '../../types/network';
import { createReplayHeader, draftHasBody } from '../../utils/requestCodeSnippets';
import { validateReplayDraft } from '../../utils/requestResend';
import { useT } from '../../i18n';
import { useBackdropDismiss } from '../../hooks/useBackdropDismiss';
import { Button, IconButton } from '../ui/Button';
import { Input, Select, TextArea } from '../ui/Input';
import { DetailPanelCloseButton } from '../shared/DetailPanelCloseButton';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

type ReplayEditorModalProps = {
  draft: ReplayDraft;
  /** 원 요청에서 바뀐 부분이 있는지(Reset 노출 여부). */
  isDirty: boolean;
  isSending: boolean;
  /** 직전 전송 실패 메시지. */
  error: string | null;
  onChange: (draft: ReplayDraft) => void;
  onReset: () => void;
  onSend: () => void;
  onClose: () => void;
};

/** 본문이 JSON이면 파싱 결과, 아니면 파싱 에러 메시지를 돌려준다. 본문이 없으면 null. */
function inspectJsonBody(body: string | null): { valid: boolean; error?: string } | null {
  if (!body || !body.trim()) return null;
  const trimmed = body.trim();
  // 객체/배열 리터럴로 보이는 것만 JSON으로 취급한다(form-urlencoded 등은 검사 대상 아님).
  if (!/^[[{]/.test(trimmed)) return null;
  try {
    JSON.parse(trimmed);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
}

/**
 * 캡처된 요청을 고쳐서 다시 보내는 편집기.
 *
 * 편집 내용은 상위(draft)에 바로 반영된다 — 모달을 닫아도 스니펫 미리보기와 Resend가
 * 같은 draft를 쓰므로 실수로 닫아도 편집이 날아가지 않는다. 원본 복구는 Reset.
 */
export function ReplayEditorModal({
  draft,
  isDirty,
  isSending,
  error,
  onChange,
  onReset,
  onSend,
  onClose,
}: ReplayEditorModalProps) {
  const t = useT();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const validationError = useMemo(() => validateReplayDraft(draft), [draft]);
  const json = inspectJsonBody(draft.body);
  const method = draft.method.toUpperCase();
  const bodyIgnored = Boolean(draft.body) && !draftHasBody(draft);

  const backdropDismiss = useBackdropDismiss(onClose);

  const patch = (changes: Partial<ReplayDraft>) => onChange({ ...draft, ...changes });

  const updateHeader = (id: string, changes: { name?: string; value?: string }) => {
    patch({
      headers: draft.headers.map((header) =>
        header.id === id ? { ...header, ...changes } : header,
      ),
    });
  };

  const formatJson = () => {
    if (!draft.body || !json?.valid) return;
    patch({ body: JSON.stringify(JSON.parse(draft.body), null, 2) });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-backdrop p-7"
      role="presentation"
      {...backdropDismiss}
    >
      <section
        className="flex max-h-full w-[min(760px,100%)] flex-col overflow-hidden rounded-2xl border border-line-weak bg-surface shadow-float"
        role="dialog"
        aria-modal="true"
        aria-label="Edit and resend request"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
          <div className="min-w-0">
            <span className="block text-[10px] leading-[1.2] text-ink-weak">Edit &amp; resend</span>
            <h2 className="m-0 mt-1 text-sm">{t('replay.title')}</h2>
          </div>
          <DetailPanelCloseButton onClick={onClose} label="Close replay editor" />
        </div>

        <div className="grid min-h-0 flex-auto gap-3.5 overflow-auto px-4 pb-3">
          <div className="flex items-center gap-2">
            <Select
              value={method}
              onChange={(event) => patch({ method: event.currentTarget.value })}
              aria-label={t('replay.method')}
              className="w-[104px] flex-none"
            >
              {/* PROPFIND 같은 비표준 메서드도 그대로 유지할 수 있게 목록에 끼워 넣는다. */}
              {METHODS.includes(method) ? null : <option value={method}>{method}</option>}
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select>
            <Input
              value={draft.url}
              onChange={(event) => patch({ url: event.currentTarget.value })}
              aria-label={t('replay.url')}
              spellCheck={false}
              className="flex-1"
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-ink-sub">
                Headers ({draft.headers.length})
              </span>
              <Button
                size="sm"
                onClick={() => patch({ headers: [...draft.headers, createReplayHeader()] })}
              >
                + Add
              </Button>
            </div>
            {draft.headers.length ? (
              <div className="grid max-h-[168px] gap-1 overflow-auto">
                {draft.headers.map((header) => (
                  <div key={header.id} className="flex items-center gap-1.5">
                    <Input
                      size="sm"
                      value={header.name}
                      placeholder="name"
                      spellCheck={false}
                      aria-label={t('replay.headerName')}
                      onChange={(event) => updateHeader(header.id, { name: event.currentTarget.value })}
                      className="w-[36%] flex-none"
                    />
                    <Input
                      size="sm"
                      value={header.value}
                      placeholder="value"
                      spellCheck={false}
                      aria-label={t('replay.headerValue')}
                      onChange={(event) => updateHeader(header.id, { value: event.currentTarget.value })}
                      className="flex-1"
                    />
                    <IconButton
                      size="xs"
                      tone="danger"
                      aria-label={t('replay.deleteHeaderAria', {
                        name: header.name || t('replay.emptyHeaderName'),
                      })}
                      title={t('replay.deleteHeader')}
                      onClick={() =>
                        patch({ headers: draft.headers.filter((item) => item.id !== header.id) })
                      }
                    >
                      ×
                    </IconButton>
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[11px] text-ink-faint">{t('replay.noHeaders')}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-ink-sub">Body</span>
              {json?.valid ? (
                <Button size="sm" onClick={formatJson}>
                  Format JSON
                </Button>
              ) : null}
            </div>
            <TextArea
              value={draft.body ?? ''}
              onChange={(event) => patch({ body: event.currentTarget.value || null })}
              spellCheck={false}
              aria-label={t('replay.body')}
              rows={8}
              placeholder={t('replay.bodyPlaceholder')}
              className="min-h-[120px] resize-y px-2.5 py-2 text-[11px] leading-[1.55] [font-family:SFMono-Regular,Consolas,'Liberation_Mono',monospace]"
            />
            {json && !json.valid ? (
              <p className="m-0 text-[11px] text-danger">
                {t('replay.jsonParseFail', { error: json.error ?? '' })}
              </p>
            ) : null}
            {bodyIgnored ? (
              <p className="m-0 text-[11px] text-ink-weak">
                {t('replay.noBodyForMethod', { method })}
              </p>
            ) : null}
          </div>
        </div>

        {error || validationError ? (
          <p
            className="mx-4 mb-2 rounded-[10px] bg-danger-soft px-2.5 py-[5px] text-[11px] text-danger"
            role="alert"
          >
            {error ?? (validationError ? t(validationError) : '')}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-line-weak px-4 py-2.5">
          <Button onClick={onReset} disabled={!isDirty} title={t('replay.resetTitle')}>
            Reset
          </Button>
          <div className="flex items-center gap-1.5">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              tone="accent"
              onClick={onSend}
              disabled={isSending || Boolean(validationError)}
              title={t('replay.sendTitle')}
            >
              {isSending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
