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

function isVisibleInContainer(target: Element, container: HTMLElement): boolean {
  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const padding = 4;

  return (
    targetRect.top >= containerRect.top + padding &&
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
