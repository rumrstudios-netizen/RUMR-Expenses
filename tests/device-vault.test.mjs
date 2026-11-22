import test from 'node:test';
import assert from 'node:assert/strict';
import {createVault,openVault,seal,validPin} from '../lib/auth/vault.mjs';
const session={access_token:'private-access-token',refresh_token:'private-refresh-token'};
test('device vault encrypts tokens, unlocks with the PIN, and rejects incorrect PINs',async()=>{
 const {vault}=await createVault('58319472',session);
 const stored=JSON.stringify(vault);
 assert.ok(!stored.includes(session.access_token));assert.ok(!stored.includes(session.refresh_token));assert.ok(!stored.includes('58319472'));
 assert.deepEqual((await openVault('58319472',vault)).session,session);
 await assert.rejects(openVault('58319473',vault),/PIN did not unlock/);
});
test('vault detects tampering and uses fresh encryption nonces when refreshing',async()=>{
 const {vault,key}=await createVault('819372',session);
 const updated=await seal({...session,refresh_token:'rotated-token'},key,vault.salt);
 assert.notEqual(vault.iv,updated.iv);assert.equal((await openVault('819372',updated)).session.refresh_token,'rotated-token');
 updated.ciphertext=(updated.ciphertext[0]==='A'?'B':'A')+updated.ciphertext.slice(1);
 await assert.rejects(openVault('819372',updated));
});
test('PIN setup rejects short, nonnumeric, and overly long PINs',async()=>{
 for(const pin of ['12345','password','1234567890123','']){assert.equal(validPin(pin),false);await assert.rejects(createVault(pin,session))}
});
