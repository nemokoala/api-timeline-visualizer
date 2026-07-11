import { Fragment, type ReactNode } from 'react';
import { useSearchOptions } from '../../contexts/SearchOptionsContext';
import { highlightSearchText } from '../../utils/searchHighlight';
import { groupJsonTextLines, tokenizeJsonText, type JsonTextTokenKind } from '../../utils/jsonTextTokens';
import { cn } from '../../utils/cn';
import { useT } from '../../i18n';
import { IconButton } from '../ui/Button';

/** 값이 JSON 객체·배열이거나 그렇게 보이는 문자열인지. 펼치기 가능 여부를 가른다. */
export function isJsonLikeValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return true;
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

/* 접힌 상태 미리보기의 토큰 색. 펼친 트리(renderJsonValue)와 같은 팔레트를 쓴다. */
const TOKEN_COLOR: Record<JsonTextTokenKind, string> = {
  plain: '',
  key: 'text-accent',
  string: 'text-json-string',
  number: 'text-json-number',
  boolean: 'text-purple',
  null: 'text-danger-bg',
  punct: 'text-ink-weak',
};

/**
 * 접힌 행의 한 줄 미리보기. JSON 구간만 키·값 색을 입힌다.
 *
 * 하이라이트는 토큰마다 따로 그리지만 토큰이 원본을 순서대로 덮으므로
 * `.search-highlight` 마크의 DOM 순서는 그대로다.
 */
export function JsonInlinePreview({
  preview,
  searchText,
  wrapLines = false,
}: {
  preview: string;
  searchText: string;
  /** true면 줄바꿈해 전부 보여준다. false면 줄마다 말줄임. */
  wrapLines?: boolean;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());
  const lines = groupJsonTextLines(tokenizeJsonText(preview));

  return (
    <>
      {lines.map((tokens, lineIndex) => (
        <span
          key={lineIndex}
          className={cn('block', !wrapLines && 'overflow-hidden text-ellipsis whitespace-nowrap')}
        >
          {tokens.map((token, index) => {
            const content = hasSearch
              ? highlightSearchText(token.text, searchText, searchOptions)
              : token.text;
            const color = TOKEN_COLOR[token.kind];
            return color ? (
              <span key={index} className={color}>
                {content}
              </span>
            ) : (
              <Fragment key={index}>{content}</Fragment>
            );
          })}
        </span>
      ))}
    </>
  );
}

/** 행 앞머리의 JSON 펼치기 토글. 펼칠 게 없는 행은 같은 폭의 자리만 차지한다. */
export function JsonRowToggle({
  expandable,
  expanded,
  onToggle,
}: {
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  if (!expandable) return <span className="w-[17px] shrink-0" aria-hidden="true" />;

  return (
    <IconButton
      size="xs"
      ghost
      aria-expanded={expanded}
      aria-label={expanded ? t('jsonRowPreview.collapse') : t('jsonRowPreview.expand')}
      className="h-[17px] min-w-[17px] shrink-0 rounded px-0 text-[8px]"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <span className={cn('transition-transform duration-[120ms]', expanded && 'rotate-90')}>▶</span>
    </IconButton>
  );
}

/**
 * 행을 펼쳤을 때 셀 아래로 이어지는 JSON 트리를 감싸는 컨테이너.
 * 행 클릭(선택)과 키 입력은 여기서 막아, 트리를 만져도 행이 선택되지 않게 한다.
 */
export function JsonRowSubTree({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid gap-1 pb-1 pl-[34px]"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      role="presentation"
    >
      {children}
    </div>
  );
}
