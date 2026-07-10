function isScrollable(element: HTMLElement): boolean {
  const { overflowY, overflow } = getComputedStyle(element);
  const allowsScroll =
    overflowY === 'auto' ||
    overflowY === 'scroll' ||
    overflowY === 'overlay' ||
    overflow === 'auto' ||
    overflow === 'scroll';

  return allowsScroll && element.scrollHeight > element.clientHeight + 1;
}

function collectScrollParents(element: Element): HTMLElement[] {
  const parents: HTMLElement[] = [];
  let node: Element | null = element.parentElement;

  while (node instanceof HTMLElement) {
    if (isScrollable(node)) parents.push(node);
    node = node.parentElement;
  }

  return parents;
}

/**
 * 대상이 sticky 헤더 등에 가려지는 높이. 행에 걸어 둔 scroll-margin-top을 그대로 읽는다
 * (DataTable이 헤더 높이를 그 값으로 넣는다). 히트가 검색 하이라이트처럼 행 안쪽 요소면
 * 가장 가까운 조상 행의 값을 쓴다.
 */
function occludedTop(target: Element): number {
  const row = target.closest('[data-row-id]') ?? target;
  const value = Number.parseFloat(getComputedStyle(row).scrollMarginTop);
  return Number.isFinite(value) ? value : 0;
}

function isVisibleInContainer(target: Element, container: HTMLElement): boolean {
  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const padding = 4;

  return (
    targetRect.top >= containerRect.top + occludedTop(target) + padding &&
    targetRect.bottom <= containerRect.bottom - padding
  );
}

function scrollWithinContainer(target: Element, container: HTMLElement): void {
  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const targetCenter = targetRect.top + targetRect.height / 2;
  const containerCenter = containerRect.top + containerRect.height / 2;

  container.scrollTop += targetCenter - containerCenter;
}

export function scrollSearchHitIntoView(target: Element): void {
  const scrollParents = collectScrollParents(target);

  for (const container of scrollParents) {
    if (isVisibleInContainer(target, container)) continue;
    scrollWithinContainer(target, container);
  }
}
