import test from "node:test";
import assert from "node:assert/strict";
import { createTestWorkforceClock, systemWorkforceClock } from "../../lib/workforce/clock/time";

test("system Workforce clock returns Date",()=>assert.ok(systemWorkforceClock.now() instanceof Date));
test("fake Workforce clock is deterministic",()=>{const c=createTestWorkforceClock({initial:new Date("2031-01-06T15:00:00Z"),nodeEnv:"test",certificationEnabled:true});assert.equal(c.now().toISOString(),"2031-01-06T15:00:00.000Z");const copy=c.now();copy.setUTCFullYear(1999);assert.equal(c.now().getUTCFullYear(),2031)});
test("fake Workforce clock advances",()=>{const c=createTestWorkforceClock({initial:new Date("2031-01-06T15:00:00Z"),nodeEnv:"test",certificationEnabled:true});c.advanceMinutes(30);c.advanceHours(2);assert.equal(c.now().toISOString(),"2031-01-06T17:30:00.000Z")});
test("production rejects fake Workforce clock",()=>assert.throws(()=>createTestWorkforceClock({initial:new Date(),nodeEnv:"production",certificationEnabled:true}),/FORBIDDEN_IN_PRODUCTION/));
test("fake clock requires explicit flag",()=>assert.throws(()=>createTestWorkforceClock({initial:new Date(),nodeEnv:"test",certificationEnabled:false}),/EXPLICIT_CERTIFICATION_FLAG/));
