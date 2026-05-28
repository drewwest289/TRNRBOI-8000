import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export function useRunners() {
  return useLiveQuery(() => db.runners.toArray(), [], []);
}
