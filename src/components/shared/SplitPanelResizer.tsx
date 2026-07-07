type SplitPanelResizerProps = {
  orientation: 'vertical' | 'horizontal';
  ariaLabel: string;
  onMouseDown: () => void;
  onDoubleClick: () => void;
};

export function SplitPanelResizer({
  orientation,
  ariaLabel,
  onMouseDown,
  onDoubleClick,
}: SplitPanelResizerProps) {
  return (
    <button
      className={`detail-resizer detail-resizer-${orientation}`}
      type="button"
      aria-label={ariaLabel}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown();
      }}
      onDoubleClick={onDoubleClick}
    />
  );
}
