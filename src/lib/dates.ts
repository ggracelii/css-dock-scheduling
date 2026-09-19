export const datesOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) => startA <= endB && startB <= endA;

export const dateRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const daysInclusive = (start: string, end: string) =>
  Math.round(
    (new Date(`${end}T12:00:00`).getTime() -
      new Date(`${start}T12:00:00`).getTime()) /
      86_400_000,
  ) + 1;
