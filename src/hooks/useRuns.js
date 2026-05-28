import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getDateForCell } from '../lib/plan';

export function useRuns() {
  return useLiveQuery(() => db.runs.orderBy('date').reverse().toArray(), [], []);
}

export function useWeekRuns(week) {
  return useLiveQuery(
    () => {
      const dates = Array.from({ length: 7 }, (_, i) => getDateForCell(week, i));
      return db.runs.where('date').anyOf(dates).toArray();
    },
    [week],
    []
  );
}
