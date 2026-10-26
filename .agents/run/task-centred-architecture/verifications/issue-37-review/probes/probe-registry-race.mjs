import { RepositoryRegistry } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/server/repositories.ts';
let now = 1_000_000; let release; let calls = 0;
const gate = new Promise(r => { release = r; });
const alpha = { id: 101, owner:'owner', name:'alpha', full:'owner/alpha', archived:false, hasIssues:true, disabled:false, private:false };
const client = { async listRepositories() {
  calls++;
  if (calls === 1) return { repositories:[alpha], pages:1, truncated:false };
  await gate;
  return { repositories:[], pages:1, truncated:false };
}};
const reg = new RepositoryRegistry({ client, now: () => now, ttlMs: 60_000 });
const first = await reg.view();
console.log('first', first.visibleCount, first.discoveryFailed);
now += 61_000;
const refreshing = reg.view();       // starts slow second discovery
const during = await reg.resolve('owner','alpha');
console.log('resolve during refresh:', during.full, 'available', during.available, 'calls', calls);
release();
const after = await refreshing;
console.log('after refresh visible', after.visibleCount, 'failed', after.discoveryFailed);
