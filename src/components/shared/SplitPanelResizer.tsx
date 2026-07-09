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
  const knob =
    "after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-[var(--resizer)] after:content-['']";
  const orientationClass =
    orientation === 'vertical'
      ? `h-full w-2 min-w-2 cursor-col-resize border-y-0 border-x border-line-weak [.split-layout-stacked_&]:hidden after:h-9 after:w-[3px] ${knob} [.resizing-split-panel-width_&]:bg-fill-hover [.resizing-split-panel-width_&]:after:bg-accent`
      : `hidden h-2 min-h-2 w-full min-w-0 cursor-row-resize border-x-0 border-y border-line-weak [.split-layout-stacked_&]:block after:h-[3px] after:w-9 ${knob} [.resizing-split-panel-height_&]:bg-fill-hover [.resizing-split-panel-height_&]:after:bg-accent`;

  return (
    <button
      className={`relative border-0 p-0 bg-bg hover:bg-fill-hover hover:after:bg-accent ${orientationClass}`}
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
