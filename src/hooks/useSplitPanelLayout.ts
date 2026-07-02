import { useEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react';
import {
  DEFAULT_DETAIL_PANEL_WIDTH,
  getDefaultStackedPrimaryHeight,
  getDetailPanelWidth,
  getStackedPrimaryHeight,
  getSplitLayoutOverride,
  saveDetailPanelWidth,
  saveStackedPrimaryHeight,
  saveSplitLayoutOverride,
  type SplitLayoutOverride,
} from '../utils/panelLayoutPrefs';

const STACKED_LAYOUT_QUERY = '(max-width: 820px)';
const MIN_DETAIL_PANEL_WIDTH = 320;
const MIN_STACKED_PRIMARY_HEIGHT = 140;
const MIN_STACKED_SECONDARY_HEIGHT = 160;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

export function useSplitPanelLayout(workspaceRef: RefObject<HTMLElement | null>) {
  const isStackedFromMedia = useMediaQuery(STACKED_LAYOUT_QUERY);
  const [splitLayoutOverride, setSplitLayoutOverride] = useState<SplitLayoutOverride>(() => getSplitLayoutOverride());
  const [detailPanelWidth, setDetailPanelWidth] = useState(() => getDetailPanelWidth());
  const [stackedPrimaryHeight, setStackedPrimaryHeight] = useState(() => getStackedPrimaryHeight());
  const [resizeAxis, setResizeAxis] = useState<'width' | 'height' | null>(null);

  const isStacked =
    splitLayoutOverride === 'vertical' ? true : splitLayoutOverride === 'horizontal' ? false : isStackedFromMedia;

  useEffect(() => {
    if (!resizeAxis) return;

    const handleMouseMove = (event: MouseEvent) => {
      const bounds = workspaceRef.current?.getBoundingClientRect();
      if (!bounds) return;

      if (resizeAxis === 'width') {
        // 상세 패널은 컨테이너(도킹 패널) 오른쪽 끝에 붙으므로, 창이 아니라
        // 컨테이너 기준으로 폭을 계산해야 도킹 패널 안에서도 정확하다.
        const nextWidth = bounds.right - event.clientX;
        const next = clamp(nextWidth, MIN_DETAIL_PANEL_WIDTH, Math.min(820, bounds.width * 0.72));
        setDetailPanelWidth(next);
        saveDetailPanelWidth(next);
        return;
      }

      const nextHeight = event.clientY - bounds.top;
      const maxHeight = bounds.height - MIN_STACKED_SECONDARY_HEIGHT;
      const next = clamp(nextHeight, MIN_STACKED_PRIMARY_HEIGHT, maxHeight);
      setStackedPrimaryHeight(next);
      saveStackedPrimaryHeight(next);
    };

    const handleMouseUp = () => {
      setResizeAxis(null);
    };

    document.body.classList.add(
      resizeAxis === 'width' ? 'resizing-split-panel-width' : 'resizing-split-panel-height',
    );
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.classList.remove('resizing-split-panel-width', 'resizing-split-panel-height');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeAxis, workspaceRef]);

  const layoutStyle = useMemo((): CSSProperties => {
    if (isStacked) {
      // 상단(Flow/Timeline)은 저장된 높이까지 커지되 컨테이너가 짧아지면 줄어들고,
      // 세부 패널은 최소 높이를 보장해 아래에 다른 창을 도킹해도 사라지지 않게 한다.
      return {
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: `minmax(0, ${stackedPrimaryHeight}px) 8px minmax(${MIN_STACKED_SECONDARY_HEIGHT}px, 1fr)`,
      };
    }

    return {
      gridTemplateColumns: `minmax(0, 1fr) 8px minmax(${MIN_DETAIL_PANEL_WIDTH}px, ${detailPanelWidth}px)`,
    };
  }, [detailPanelWidth, isStacked, stackedPrimaryHeight]);

  const startWidthResize = () => setResizeAxis('width');
  const startHeightResize = () => setResizeAxis('height');

  const resetWidth = () => {
    setDetailPanelWidth(DEFAULT_DETAIL_PANEL_WIDTH);
    saveDetailPanelWidth(DEFAULT_DETAIL_PANEL_WIDTH);
  };

  const resetHeight = () => {
    const nextHeight = getDefaultStackedPrimaryHeight();
    setStackedPrimaryHeight(nextHeight);
    saveStackedPrimaryHeight(nextHeight);
  };

  const toggleSplitLayout = () => {
    const next: SplitLayoutOverride = isStacked ? 'horizontal' : 'vertical';
    setSplitLayoutOverride(next);
    saveSplitLayoutOverride(next);
  };

  return {
    isStacked,
    layoutStyle,
    startWidthResize,
    startHeightResize,
    resetWidth,
    resetHeight,
    toggleSplitLayout,
  };
}
