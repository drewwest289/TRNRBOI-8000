import Dexie from 'dexie';

export const db = new Dexie('HalfMarathonTrainer');

db.version(1).stores({
  runs: '++id, date, user, type',
  runners: '++id, &name',
});

db.on('ready', async () => {
  const count = await db.runners.count();
  if (count === 0) {
    await db.runners.add({ name: 'Drew', initials: 'DR', color: '#1D9E75' });
  }
});
