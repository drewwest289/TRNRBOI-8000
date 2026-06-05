import Dexie from 'dexie';

export const db = new Dexie('HalfMarathonTrainer');

db.version(1).stores({
  runs: '++id, date, user, type',
  runners: '++id, &name',
});

db.version(2).stores({
  runs: '++id, date, user, type',
  runners: '++id, &name',
  planOverrides: '&date',
});

db.version(3).stores({
  runs: '++id, date, user, type, stravaId',
  runners: '++id, &name',
  planOverrides: '&date',
});

