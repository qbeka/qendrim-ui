/** One hairline: a real sequence of measured heights. It is drawn only from data. */
export function Trajectory({ points, height = 64, width = 280 }: { points: number[]; height?: number; width?: number }) {
  if (points.length < 2) {
    return <svg className="d-line" viewBox={`0 0 ${width} ${height}`} aria-hidden><line x1="0" y1={height - 1} x2={width} y2={height - 1} /></svg>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points, min + 1);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * width).toFixed(1)} ${(height - 1 - ((p - min) / (max - min)) * (height - 2)).toFixed(1)}`).join('');
  return <svg className="d-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Height over ${points.length} changes, from ${Math.round(min)} to ${Math.round(max)} pixels`}><path d={path} /></svg>;
}
