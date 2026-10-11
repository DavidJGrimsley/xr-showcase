export const COMBAT_CONTROLS = [
  'strafeLeft',
  'strafeRight',
  'jump-back',
  'advance',
  'block',
  'punch',
  'uppercut',
] as const;
/** Icon targets remain fixed through every combat/availability state. */
export function combatControlLayout(
  _fontScale: number,
  availableWidth = 820,
  availableHeight = 300
) {
  const gap = 8;
  const stacked = availableWidth < 240;
  const rows = stacked ? 4 : 2;
  const width = Math.max(44, Math.min(56, (availableWidth - gap * 3) / 4));
  const height = Math.max(44, Math.min(56, (availableHeight - (rows - 1) * gap) / rows));
  const controlsHeight = rows * height + (rows - 1) * gap;
  const right = availableWidth - (stacked ? width : 2 * width + gap);
  const rect = (left: number, row: number) => ({ left, top: row * (height + gap), width, height });
  const rectangles = stacked
    ? {
        strafeLeft: rect(0, 0),
        strafeRight: rect(0, 1),
        'jump-back': rect(0, 2),
        advance: rect(0, 3),
        block: rect(right, 1),
        punch: rect(right, 2),
        uppercut: rect(right, 3),
      }
    : {
        strafeLeft: rect(0, 0),
        strafeRight: rect(width + gap, 0),
        'jump-back': rect(0, 1),
        advance: rect(width + gap, 1),
        block: rect(right + width + gap, 0),
        punch: rect(right + width + gap, 1),
        uppercut: { ...rect(right, 0), height: controlsHeight },
      };
  return {
    width,
    height,
    gap,
    stacked,
    progressHeight: 0,
    panelHeight: controlsHeight,
    controlsHeight,
    right,
    groupWidth: stacked ? width : 2 * width + gap,
    rectangles,
  };
}
