import { IconButton } from './Button';

type SearchOptionTogglesProps = {
  matchCase: boolean;
  wholeWord: boolean;
  onMatchCaseChange: (next: boolean) => void;
  onWholeWordChange: (next: boolean) => void;
  /** 레이아웃용 래퍼 클래스(패널/뷰어마다 배치가 다르다). */
  className: string;
};

/** 검색 입력 옆에 붙는 Aa(대소문자)/ab(단어 단위) 토글 쌍. */
export function SearchOptionToggles({
  matchCase,
  wholeWord,
  onMatchCaseChange,
  onWholeWordChange,
  className,
}: SearchOptionTogglesProps) {
  return (
    <div className={className} aria-label="Search options">
      <IconButton
        size="xs"
        ghost
        active={matchCase}
        aria-pressed={matchCase}
        title="Match case"
        onClick={() => onMatchCaseChange(!matchCase)}
      >
        Aa
      </IconButton>
      <IconButton
        size="xs"
        ghost
        active={wholeWord}
        aria-pressed={wholeWord}
        title="Match whole word"
        className="text-[10px] leading-none tracking-[-0.02em]"
        onClick={() => onWholeWordChange(!wholeWord)}
      >
        ab
      </IconButton>
    </div>
  );
}
