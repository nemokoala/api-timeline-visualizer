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
