import test from "node:test";
import assert from "node:assert/strict";
import { assertAvailabilityAccess } from "../../lib/workforce/availability/authorization";
import { effectiveAvailability, requiresManagerAttention, schedulingEligibility, validateTimeRange } from "../../lib/workforce/availability/rules";
import { calendarStatus, latestPublishedRevisions, staysOnBusinessDate, type PublishedRevision } from "../../lib/workforce/calendar/rules";

const date=(value:string)=>new Date(`${value}T00:00:00.000Z`);
const available={state:"AVAILABLE",startTime:null,endTime:null,source:"RECURRING",reason:null} as const;

test("recurring AVAILABLE resolves for the weekday",()=>assert.equal(effectiveAvailability({date:date("2026-08-31"),rules:[{dayOfWeek:1,available:true,startTime:"09:00",endTime:"18:00",effectiveFrom:null,effectiveTo:null}]}).state,"AVAILABLE"));
test("recurring UNAVAILABLE resolves for the weekday",()=>assert.equal(effectiveAvailability({date:date("2026-08-31"),rules:[{dayOfWeek:1,available:false,startTime:null,endTime:null,effectiveFrom:null,effectiveTo:null}]}).state,"UNAVAILABLE"));
test("date exception wins over recurring rule",()=>assert.equal(effectiveAvailability({date:date("2026-08-31"),rules:[{dayOfWeek:1,available:true,startTime:null,endTime:null,effectiveFrom:null,effectiveTo:null}],exception:{type:"UNAVAILABLE",startTime:null,endTime:null,reason:"QA"}}).source,"EXCEPTION"));
test("no declaration is UNKNOWN",()=>assert.deepEqual(effectiveAvailability({date:date("2026-08-31"),rules:[]}),{state:"UNKNOWN",startTime:null,endTime:null,source:"NONE",reason:"NO_AVAILABILITY_DECLARED"}));
test("cross-midnight availability is valid",()=>assert.doesNotThrow(()=>validateTimeRange("18:00","01:00")));
test("inactive employment is a hard block",()=>assert.deepEqual(schedulingEligibility({employmentStatus:"INACTIVE",branchAuthorized:true,overlapsShift:false,availability:available}).hardBlocks,["INACTIVE_EMPLOYMENT"]));
test("unauthorized branch and overlap are hard blocks",()=>assert.deepEqual(schedulingEligibility({employmentStatus:"ACTIVE",branchAuthorized:false,overlapsShift:true,availability:available}).hardBlocks,["UNAUTHORIZED_BRANCH","OVERLAPPING_SHIFT"]));
test("employee can access own linked Employee",()=>assert.doesNotThrow(()=>assertAvailabilityAccess({actorUserId:"u1",actorRole:"OPERATOR",employeeUserId:"u1",employeeId:"e1",requestedEmployeeId:"e1"})));
test("employee cannot access another Employee",()=>assert.throws(()=>assertAvailabilityAccess({actorUserId:"u1",actorRole:"OPERATOR",employeeUserId:"u2",employeeId:"e2",requestedEmployeeId:"e2"}),/No autorizado/));
test("admin can access any Employee",()=>assert.doesNotThrow(()=>assertAvailabilityAccess({actorUserId:"admin",actorRole:"ADMIN",employeeUserId:null,employeeId:"e2",requestedEmployeeId:"e2"})));
test("24-hour window requires manager attention",()=>assert.equal(requiresManagerAttention({now:new Date("2026-08-30T12:00:00Z"),effectiveDate:date("2026-08-31"),publishedShiftDates:[]}).required,true));
test("published shift requires attention without mutating it",()=>{const shifts=[date("2026-09-02")];const before=shifts[0].getTime();assert.equal(requiresManagerAttention({now:new Date("2026-08-01T00:00:00Z"),effectiveDate:date("2026-09-02"),publishedShiftDates:shifts}).publishedShift,true);assert.equal(shifts[0].getTime(),before)});

const revision=(overrides:Partial<PublishedRevision>={}):PublishedRevision=>({shiftId:"s1",publicationPublishedAt:new Date("2026-08-01T00:00:00Z"),revisionNumber:1,revisionStatus:"PUBLISHED",businessDate:date("2026-09-05"),startAt:new Date("2026-09-06T00:00:00Z"),endAt:new Date("2026-09-06T07:00:00Z"),branchName:"Sucursal Norte",branchTimezone:"America/Mexico_City",...overrides});
test("draft Shift without publication link is absent",()=>assert.deepEqual(latestPublishedRevisions([]),[]));
test("published Shift is visible",()=>assert.equal(latestPublishedRevisions([revision()]).length,1));
test("latest publication wins and exposes CHANGED",()=>{const row=latestPublishedRevisions([revision(),revision({publicationPublishedAt:new Date("2026-08-02T00:00:00Z"),revisionNumber:2})])[0];assert.equal(row.revisionNumber,2);assert.equal(calendarStatus(row),"CHANGED")});
test("cancelled revision is visible as CANCELLED",()=>assert.equal(calendarStatus(revision({revisionStatus:"CANCELLED"})),"CANCELLED"));
test("overnight Shift stays on businessLocalDate",()=>assert.equal(staysOnBusinessDate(revision()),"2026-09-05"));
test("multi-branch calendar preserves textual branch labels",()=>assert.deepEqual(latestPublishedRevisions([revision(),revision({shiftId:"s2",branchName:"Sucursal Centro",businessDate:date("2026-09-06"),startAt:new Date("2026-09-07T00:00:00Z"),endAt:new Date("2026-09-07T06:00:00Z")})]).map((row)=>row.branchName),["Sucursal Norte","Sucursal Centro"]));
