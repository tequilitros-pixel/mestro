import assert from "node:assert/strict";
import test from "node:test";
import { initialShiftBranch, shiftBranchOptions } from "../../lib/workforce/scheduling/shiftBranchSelection";
const branches=[{id:"bar"},{id:"center"}];
const worker={assignments:[{branchId:"center",type:"HOME"}]};
test("aggregate filter never becomes a shift branch",()=>{
 for(const filter of [null,"all"]){assert.equal(initialShiftBranch(branches,filter),"");assert.equal(initialShiftBranch(branches,filter,worker),"center");}
});
test("HOME Centro does not prevent selecting Veliz",()=>{
 assert.equal(initialShiftBranch(branches,"bar",worker),"bar");
 assert.deepEqual(shiftBranchOptions(branches),branches);
});
test("selected real ALLOWED branch is preserved",()=>{
 const employee={assignments:[...worker.assignments,{branchId:"bar",type:"ALLOWED"}]};
 assert.equal(initialShiftBranch(branches,"bar",employee),"bar");
});
test("employee without HOME can select any active branch",()=>{
 for(const employee of [{assignments:[]},{assignments:[{branchId:"inactive",type:"HOME"}]}]){
  assert.deepEqual(shiftBranchOptions(branches),branches);
  assert.equal(initialShiftBranch(branches,"bar",employee),"bar");
 }
});
