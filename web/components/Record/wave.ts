/**
 * Draws loudness samples as the wavy line in the designs (Record, DRecord, Share): the
 * louder the voice, the further the line swings. The swing pattern is the designs' own.
 */
export function wavePath(levels: number[], xAt: (index: number) => number, mid: number, amplitude: number): string {
  if (levels.length === 0) return "";
  const points = levels.map((level, i) => {
    const swing = Math.sin(i * 1.7) * 0.62 + Math.sin(i * 0.53 + 1.1) * 0.38;
    const y = i === 0 ? mid : mid + amplitude * level * swing;
    return `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${y.toFixed(1)}`;
  });
  return `${points.join(" ")} L${xAt(levels.length - 1).toFixed(1)} ${mid}`;
}
