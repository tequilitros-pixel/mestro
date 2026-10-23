import assert from "node:assert/strict";
import test from "node:test";
import { paymentSummary, money } from "../lib/pos2/ui/payment";
import { cashierIssue } from "../lib/pos2/ui/errors";
import { filterCatalogProducts, nextCatalogLimit } from "../lib/pos2/ui/catalog";
import type { CatalogCategoryDto } from "../lib/pos2/ui/types";

test("cash, card and transfer can compose an exact mixed payment",()=>{const summary=paymentSummary("150",[{method:"CASH",amount:"50",tendered:"50"},{method:"CARD",amount:"75",reference:"A-1"},{method:"TRANSFER",amount:"25",reference:"T-1"}]);assert.deepEqual(summary,{paid:"150.00",remaining:"0.00",change:"0.00",valid:true})});
test("cash tender calculates change without increasing applied payment",()=>{const summary=paymentSummary("99",[{method:"CASH",amount:"99",tendered:"200"}]);assert.equal(summary.paid,"99.00");assert.equal(summary.change,"101.00");assert.equal(summary.valid,true)});
test("underpayment remains invalid and invalid money is rejected",()=>{assert.equal(paymentSummary("100",[{method:"CARD",amount:"90"}]).valid,false);assert.throws(()=>money("-1"),/INVALID_MONEY/)});
test("cashier error mapper never exposes internal capability language",()=>{const permission=cashierIssue("PERMISSION_DENIED"),terminal=cashierIssue("TERMINAL_REVOKED");assert.equal(permission.title,"Se requiere autorización");assert.doesNotMatch(permission.message,/capability|403/i);assert.match(terminal.message,/revocada/i)});
test("price and promotion conflicts direct the UI to refresh",()=>{assert.equal(cashierIssue("PRICE_CHANGED").action,"REFRESH_ORDER");assert.equal(cashierIssue("PROMOTION_CHANGED").action,"REFRESH_ORDER")});
test("1,000-product local search and category filtering remain deterministic",()=>{const products=Array.from({length:1_000},(_,index)=>({id:`p${index}`,name:`Producto ${index}`,sku:`SKU-${index}`,internalCode:null,barcode:index===777?"SPECIAL-777":null,icon:null,imageAlt:null,available:true,variants:[],price:"10.00"}));const categories:CatalogCategoryDto[]=[{id:"all",name:"Todos",icon:null,products}];const started=performance.now(),result=filterCatalogProducts(categories,"ALL","SPECIAL-777");assert.equal(result[0]?.id,"p777");assert.ok(performance.now()-started<50);assert.equal(nextCatalogLimit(48,1_000),96);assert.equal(nextCatalogLimit(990,1_000),1_000)});
