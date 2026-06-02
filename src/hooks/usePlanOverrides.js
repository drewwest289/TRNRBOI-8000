import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export function usePlanOverrides() {
  const rows = useLiveQuery(() => db.planOverrides.toArray(), [], []);
  const map = {};
  for (const r of rows) map[r.date] = r.dayStr;
  return map;
}
