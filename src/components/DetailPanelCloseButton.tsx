type DetailPanelCloseButtonProps = {
  onClick: () => void;
  label?: string;
};

export function DetailPanelCloseButton({
  onClick,
  label = 'Close detail panel',
}: DetailPanelCloseButtonProps) {
  return (
    <button type="button" className="detail-panel-close" onClick={onClick} aria-label={label} title={label}>
      <span aria-hidden="true">×</span>
    </button>
  );
}

export function SplitLayoutToggleButton({
  isStacked,
  onClick,
}: {
  isStacked: boolean;
  onClick: () => void;
}) {
  const label = isStacked ? 'Switch to side-by-side layout' : 'Switch to stacked layout';
  return (
    <button type="button" className="split-layout-toggle" onClick={onClick} aria-label={label} title={label}>
      {isStacked ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="12" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="8" width="12" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="1" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
    </button>
  );
}
