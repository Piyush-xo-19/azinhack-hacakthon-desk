import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraConstraints,requestScannerCamera,focusCamera,setCameraTorch,cameraErrorMessage} from '../lib/camera.ts';
test('prefer HD rear capture without requiring unsupported resolution',()=>{
  const c=cameraConstraints();assert.equal(c.audio,false);assert.deepEqual(c.video.facingMode,{ideal:'environment'});assert.deepEqual(c.video.width,{ideal:1920});assert.equal(c.video.height.ideal,1080);assert.deepEqual(cameraConstraints('rear-main').video.deviceId,{exact:'rear-main'});
});
test('unsupported constraints retry at native defaults while preserving chosen lens',async()=>{
  const calls=[],stream={};const media={async getUserMedia(c){calls.push(c);if(calls.length===1)throw {name:'OverconstrainedError'};return stream;}};
  assert.equal(await requestScannerCamera(media,'rear-main'),stream);assert.equal(calls.length,2);assert.equal(calls[1].video.width,undefined);assert.deepEqual(calls[1].video.deviceId,{exact:'rear-main'});
});
test('denied permissions are not repeatedly requested',async()=>{
  let calls=0;await assert.rejects(()=>requestScannerCamera({async getUserMedia(){calls++;throw Object.assign(new Error('Denied'),{name:'NotAllowedError'});}}));assert.equal(calls,1);
});
test('focus and light controls preserve resolution and each other',async()=>{
  let current=cameraConstraints('main').video;
  const track={getCapabilities:()=>({focusMode:['continuous','single-shot'],torch:true}),getConstraints:()=>current,async applyConstraints(c){current=c;}};
  assert.equal(await focusCamera(track),true);await setCameraTorch(track,true);assert.equal(current.advanced[0].focusMode,'continuous');assert.equal(current.advanced[0].torch,true);assert.equal(current.width.ideal,1920);
  await focusCamera(track,true);assert.equal(current.advanced[0].focusMode,'single-shot');assert.equal(current.advanced[0].torch,true);
  await focusCamera(track);await setCameraTorch(track,false);assert.equal(current.advanced[0].focusMode,'continuous');assert.equal(current.advanced[0].torch,false);
});
test('unsupported autofocus is optional and errors provide specific recovery',async()=>{
  let applied=false;assert.equal(await focusCamera({getCapabilities:()=>({}),applyConstraints:()=>{applied=true;}}),false);assert.equal(applied,false);
  assert.match(cameraErrorMessage({name:'NotAllowedError'}),/site’s browser settings/);assert.match(cameraErrorMessage({name:'NotReadableError'}),/Close other apps/);
});
