/**
 * Trava o viewport no PWA: sem pinch, sem gesto de zoom do iOS.
 * O zoom automático ao focar input é tratado no CSS (fonte ≥ 16px).
 */

export function isMultiTouch(touchCount: number): boolean {
  return touchCount > 1;
}

export function lockMobileViewport(): () => void {
  const prevent = (event: Event) => {
    event.preventDefault();
  };

  const onTouchMove = (event: TouchEvent) => {
    if (isMultiTouch(event.touches.length)) {
      event.preventDefault();
    }
  };

  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('gesturechange', prevent, { passive: false });
  document.addEventListener('gestureend', prevent, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });

  return () => {
    document.removeEventListener('gesturestart', prevent);
    document.removeEventListener('gesturechange', prevent);
    document.removeEventListener('gestureend', prevent);
    document.removeEventListener('touchmove', onTouchMove);
  };
}
