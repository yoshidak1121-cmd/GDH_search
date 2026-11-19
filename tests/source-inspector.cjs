'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('extension/source-inspector.js','utf8'),c);
const r=c.analyzeGdhSource([`function createRequestData(){var req={};req.contract_id='PRIVATE-ID';req.notes="PRIVATE-MEMO";return req;} function registdata(olddata,newdata){/* PRIVATE-COMMENT */ var token='PRIVATE-TOKEN';server.regist(olddata,newdata,'PRIVATE-SOURCE','PRIVATE-TABLE');} function allocateSerial(){return 'PRIVATE-SERIAL';}`],['contract_id']);
assert.equal(r.functions.length,3);assert(!JSON.stringify(r).includes('PRIVATE'));assert(r.functions[0].assignedRequestKeys.includes('contract_id'));assert.equal(r.updateIdentity.oldDataArgumentObserved,true);assert.equal(r.numbering.status,'unconfirmed');assert.equal(r.numbering.candidates[0],'allocateSerial');
const unknown=c.analyzeGdhSource(['function save(){return /PRIVATE-REGEX/.test(x)} function update(){return `PRIVATE-TEMPLATE`}'],[]);assert.equal(unknown.functions.length,0);assert.equal(unknown.skippedSourcesOrFunctions,2);
assert.equal(c.analyzeGdhSource(['function harmless(){return "PRIVATE"}'],[]).transmission.status,'unconfirmed');
console.log('source inspection: literal/comment redaction, request keys, old-data evidence, unconfirmed numbering and unsupported syntax passed');
