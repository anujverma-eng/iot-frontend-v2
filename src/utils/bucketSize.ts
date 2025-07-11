/**
 * Pick an optimal down-sampling bucket given a time-range and desired point cap.
 * Keeps the chart snappy on wide zoom-outs without client-side decimation.
 * Optimized for better performance with mobile devices.
 */
export function chooseBucketSize(
  start: string | Date,
  end: string | Date,
  targetPoints = 400, // Reduced from 600 for better performance
  isMobile = false
): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = ms / 1_000;
  
  // Further reduce target points on mobile for better performance
  const effectiveTargetPoints = isMobile ? Math.min(targetPoints, 250) : targetPoints;
  const ideal = secs / effectiveTargetPoints;   // seconds / bucket

  /* human-friendly rungs the backend understands           */
  if (ideal <= 60) return "1m";
  if (ideal <= 5 * 60) return "5m";
  if (ideal <= 15 * 60) return "15m";
  if (ideal <= 60 * 60) return "1h";
  if (ideal <= 6 * 60 * 60) return "6h";
  return "1d";
}
