import { useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '../ui/Input';

type ConsoleReplInputProps = {
  disabled: boolean;
  onSubmit: (expression: string) => void;
};

/**
 * 콘솔 하단 REPL 입력줄. Enter로 표현식을 제출하고 ↑/↓로 이전 입력을 오간다.
 * 평가할 페이지가 없는 개발 서버(npm run dev)에서는 비활성화하고 안내 문구를 보여준다.
 */
export function ConsoleReplInput({ disabled, onSubmit }: ConsoleReplInputProps) {
  const [value, setValue] = useState('');
  const historyRef = useRef<string[]>([]);
  // null이면 새 줄을 편집 중, 숫자면 히스토리의 그 위치를 보고 있다.
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const expression = value.trim();
      if (!expression) return;
      historyRef.current.push(expression);
      setHistoryIndex(null);
      setValue('');
      onSubmit(expression);
      return;
    }

    if (event.key === 'ArrowUp') {
      const history = historyRef.current;
      if (!history.length) return;
      event.preventDefault();
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setValue(history[nextIndex]);
      return;
    }

    if (event.key === 'ArrowDown') {
      if (historyIndex === null) return;
      event.preventDefault();
      const history = historyRef.current;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setValue('');
      } else {
        setHistoryIndex(nextIndex);
        setValue(history[nextIndex]);
      }
    }
  };

  return (
    <div className="flex flex-none items-center gap-2 border-t border-line-weak bg-surface px-3.5 py-2">
      <span aria-hidden className="select-none text-[13px] font-bold leading-none text-accent">
        ›
      </span>
      <Input
        size="sm"
        className="flex-auto text-xs [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]"
        placeholder={
          disabled
            ? 'Console REPL is available only inside Chrome DevTools.'
            : 'Evaluate an expression in the inspected page…'
        }
        disabled={disabled}
        value={value}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="Console expression input"
        onChange={(event) => {
          setValue(event.target.value);
          setHistoryIndex(null);
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
