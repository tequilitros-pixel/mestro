import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('Workforce geofence enforcement is opt-in at branch level',()=>{
 const action=readFileSync(new URL('../../app/actions/workforceBranches.ts',import.meta.url),'utf8');
 assert.doesNotMatch(action,/if \(input.enabled\) return \{ error:/);
 assert.match(action,/persistBranchGeofence/);
});
test('HOME assignment never silently applies a schedule',()=>{
 const source=readFileSync(new URL('../../app/actions/workforceEmployment.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/applyScheduleTemplate|AUTO_CREATE_DRAFT/);
});
