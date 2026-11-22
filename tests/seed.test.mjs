import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
const js=ts.transpileModule(fs.readFileSync(new URL('../lib/seed.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};vm.runInNewContext(js,{exports});
test('Initial migration reconciles to verified Kerala source controls',()=>{const d=exports.seed();assert.equal(d.projects.length,1);assert.equal(d.expenses.length,13);assert.equal(d.expenses.filter(e=>!e.personal).reduce((t,e)=>t+e.amount,0),821300);assert.equal(d.expenses.filter(e=>e.personal).reduce((t,e)=>t+e.amount,0),13800);assert.equal(new Set(d.expenses.map(e=>e.id)).size,13);assert.ok(d.expenses.every(e=>e.method==='Not recorded'));assert.equal(d.expenses.find(e=>e.name==='Venue to hotel').date,'2026-11-20');});
test('Workspace seed has no shared mutable state',()=>{const first=exports.seed();first.projects[0].name='Changed';first.expenses[0].amount=0;const next=exports.seed();assert.equal(next.projects[0].name,'Kerala Shoot');assert.equal(next.expenses[0].amount,95200)});
