import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { workforceGeolocationEnabled } from '../../lib/workforce/geolocation-release';

test('Monday scheduling release cannot enable location enforcement',()=>{
 assert.equal(workforceGeolocationEnabled,false);
 const action=readFileSync(new URL('../../app/actions/workforceBranches.ts',import.meta.url),'utf8');
 assert.match(action,/if \(input.enabled\) return \{ error:/);
});
test('HOME assignment never silently applies a schedule',()=>{
 const source=readFileSync(new URL('../../app/actions/workforceEmployment.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/applyScheduleTemplate|AUTO_CREATE_DRAFT/);
});
