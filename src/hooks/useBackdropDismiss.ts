import { useRef, type MouseEvent as ReactMouseEvent } from 'react';

/**
 * 모달 배경 클릭으로 닫기. 단, "누르기 시작한 지점이 배경 자신일 때"만 닫는다.
 *
 * 입력 안에서 텍스트를 드래그하다 배경에서 손을 떼면, click은 mousedown·mouseup의
 * 공통 조상(=배경)에서 발생한다. 그래서 배경 onClick만으로 닫으면 실수로 닫힌다.
 * press 시작 지점을 기억해 그 경우를 걸러낸다.
 *
 * 반환값을 배경 요소에 그대로 펼쳐 준다.
 */
export function useBackdropDismiss(onClose: () => void) {
  const pressedOnBackdropRef = useRef(false);

  return {
    onMouseDown: (event: ReactMouseEvent) => {
      pressedOnBackdropRef.current = event.target === event.currentTarget;
    },
    onClick: (event: ReactMouseEvent) => {
      if (event.target === event.currentTarget && pressedOnBackdropRef.current) onClose();
    },
  };
}
