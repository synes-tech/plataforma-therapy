export interface DayActionAnchor {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface DayActionMenuState {
  dateISO: string;
  anchor: DayActionAnchor;
}

export function rectToAnchor(rect: DOMRect): DayActionAnchor {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}
