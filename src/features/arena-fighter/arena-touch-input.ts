/** A native touch batch can contain fingers targeting multiple sibling controls. */
export function updateHeldTouches(
  active: Set<string>,
  changed: readonly { identifier: string; target: string }[],
  controlTarget: number | null,
  down: boolean
) {
  for (const touch of changed) {
    if (!down) active.delete(touch.identifier);
    else if (controlTarget !== null && String(touch.target) === String(controlTarget)) {
      active.add(touch.identifier);
    }
  }
  return active.size > 0;
}
