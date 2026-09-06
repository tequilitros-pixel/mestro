import assert from "node:assert/strict";
import test from "node:test";
import { initialShiftBranch, shiftBranchOptions } from "../../lib/workforce/scheduling/shiftBranchSelection";
const branches=[{id:"bar"},{id:"center"}];
const worker={assignments:[{branchId:"center",type:"HOME"}]};
test("aggregate filter never becomes a shift branch",()=>{
 for(const filter of [null,"all"]){assert.equal(initialShiftBranch(branches,filter),"");assert.equal(initialShiftBranch(branches,filter,worker),"center");}
});
test("changing employee replaces an unauthorized default with their real HOME",()=>{
 assert.equal(initialShiftBranch(branches,"bar",worker),"center");
 assert.deepEqual(shiftBranchOptions(branches,worker),[{id:"center"}]);
});
test("selected real ALLOWED branch is preserved",()=>{
 const employee={assignments:[...worker.assignments,{branchId:"bar",type:"ALLOWED"}]};
 assert.equal(initialShiftBranch(branches,"bar",employee),"bar");
});
test("unassigned employee or assignments to inactive/inaccessible branches cannot pick a branch",()=>{
 for(const employee of [{assignments:[]},{assignments:[{branchId:"inactive",type:"HOME"}]}]){
  assert.deepEqual(shiftBranchOptions(branches,employee),[]);
  assert.equal(initialShiftBranch(branches,"bar",employee),"");
 }
});
