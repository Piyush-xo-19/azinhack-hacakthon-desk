'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,QrCode,Focus,Flashlight} from 'lucide-react';
import jsQR from 'jsqr';
import {cameraCapabilities,cameraErrorMessage,focusCamera,requestScannerCamera,setCameraTorch} from '@/lib/camera';
export default function QrScanner({onScan}:{onScan:(code:string)=>void}){
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),generation=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [running,setRunning]=useState(false),[starting,setStarting]=useState(false),[error,setError]=useState('');
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[deviceId,setDeviceId]=useState(''),[resolution,setResolution]=useState('');
  const [canFocus,setCanFocus]=useState(false),[focusing,setFocusing]=useState(false),[canTorch,setCanTorch]=useState(false),[torch,setTorch]=useState(false);
  function release(){generation.current++;if(timer.current)clearTimeout(timer.current);timer.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;}
  function stop(){release();setRunning(false);setStarting(false);setFocusing(false);setTorch(false);setResolution('');}
  useEffect(()=>()=>release(),[]);
  async function start(selected=deviceId){
    stop();setError('');setStarting(true);setCanFocus(false);setCanTorch(false);const run=generation.current;
    try{
      if(!window.isSecureContext)throw new DOMException('HTTPS required','SecurityError');
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera capture unsupported');
      const capture=await requestScannerCamera(navigator.mediaDevices,selected||undefined);
      if(run!==generation.current){capture.getTracks().forEach(t=>t.stop());return;}
      stream.current=capture;const track=capture.getVideoTracks()[0];
      if(!track)throw new Error('Camera has no video track');
      const caps=cameraCapabilities(track);setCanFocus(!!caps.focusMode?.some(mode=>mode==='continuous'||mode==='single-shot'));setCanTorch(caps.torch===true);
      // Optional camera controls must never prevent a valid stream from starting.
      try{await focusCamera(track);}catch{/* Some browsers advertise focus but reject applying it. */}
      if(run!==generation.current)return;
      const element=video.current;if(!element){stop();return;}
      element.muted=true;element.srcObject=capture;await element.play();
      if(run!==generation.current)return;
      setRunning(true);setStarting(false);
      const settings=track.getSettings();setDeviceId(settings.deviceId||selected);setResolution(`${element.videoWidth||settings.width||'?'} × ${element.videoHeight||settings.height||'?'}`);
      // Labels become available after permission. Keep the chosen lens; let the user switch explicitly.
      if(navigator.mediaDevices.enumerateDevices)navigator.mediaDevices.enumerateDevices().then(list=>{if(run===generation.current)setDevices(list.filter(d=>d.kind==='videoinput'));}).catch(()=>{});
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('QR decoding unavailable');
      function tick(){
        if(run!==generation.current)return;
        try{
          if(element!.readyState>=2&&element!.videoWidth>0&&element!.videoHeight>0){
            // The preview retains full capture resolution; decoding is capped to keep phones responsive.
            const scale=Math.min(1,1280/Math.max(element!.videoWidth,element!.videoHeight));
            canvas.width=Math.round(element!.videoWidth*scale);canvas.height=Math.round(element!.videoHeight*scale);
            context!.drawImage(element!,0,0,canvas.width,canvas.height);
            const frame=context!.getImageData(0,0,canvas.width,canvas.height),hit=jsQR(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
            if(hit){stop();onScan(hit.data);return;}
          }
          timer.current=setTimeout(tick,250);
        }catch(e){if(run===generation.current){stop();setError(cameraErrorMessage(e));}}
      }
      tick();
    }catch(e){if(run===generation.current){stop();setError(cameraErrorMessage(e));}}
  }
  async function refocus(){const track=stream.current?.getVideoTracks()[0];if(!track)return;const run=generation.current;setFocusing(true);try{await focusCamera(track,true);if(cameraCapabilities(track).focusMode?.includes('continuous')){await new Promise(resolve=>setTimeout(resolve,500));if(run===generation.current)await focusCamera(track);}if(run===generation.current)setError('');}catch{if(run===generation.current)setError('This browser could not adjust focus. Move the QR a little farther away, or choose another rear camera.');}finally{if(run===generation.current)setFocusing(false);}}
  async function toggleTorch(){const track=stream.current?.getVideoTracks()[0];if(!track)return;const run=generation.current;try{await setCameraTorch(track,!torch);if(run===generation.current){setTorch(!torch);setError('');}}catch{if(run===generation.current)setError('The camera light is unavailable in this browser. Try brighter room lighting.');}}
  async function scanImage(file:File){setError('');try{const bitmap=await createImageBitmap(file);try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d')!;context.drawImage(bitmap,0,0);const frame=context.getImageData(0,0,canvas.width,canvas.height);const hit=jsQR(frame.data,frame.width,frame.height);if(!hit)throw new Error('No readable QR found. Center the square QR and use a sharper image.');stop();onScan(hit.data);}finally{bitmap.close();}}catch(e){setError((e as Error).message);}}
  return <><div className="camera-box"><video ref={video} muted playsInline autoPlay className={running?'':'hidden'}/>{!running&&<div><div className="scan-frame"><QrCode size={68} strokeWidth={1.2}/></div><p>{starting?'Opening camera…':'Point your camera at the square QR'}</p><small>Keep the QR inside the guide</small></div>}{running&&<div className="camera-guide"/>}</div>
  <div className="camera-actions"><button className="primary" onClick={()=>running||starting?stop():void start()}><Camera size={17}/>{starting?'Cancel':running?'Stop camera':'Start camera'}</button><label className="secondary">Upload QR image<input type="file" accept="image/*" hidden onChange={e=>{if(e.target.files?.[0])void scanImage(e.target.files[0]);e.target.value='';}}/></label></div>
  {(running||devices.length>1)&&<div className="camera-controls">{devices.length>1&&<label>Camera<select aria-label="Select camera" disabled={starting} value={deviceId} onChange={e=>{const id=e.target.value;setDeviceId(id);if(running)void start(id);}}>{!devices.some(d=>d.deviceId===deviceId)&&<option value={deviceId}>Current camera</option>}{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`Camera ${i+1}`}</option>)}</select></label>}<div className="camera-control-buttons">{running&&canFocus&&<button className="secondary" disabled={focusing} onClick={()=>void refocus()}><Focus size={15}/>{focusing?'Focusing…':'Refocus'}</button>}{running&&canTorch&&<button className="secondary" aria-pressed={torch} onClick={()=>void toggleTorch()}><Flashlight size={15}/>{torch?'Light off':'Light on'}</button>}{running&&resolution&&<small className="camera-resolution">{resolution}</small>}</div><p>Center the square QR, not the long barcode. If it looks blurry, move it slightly farther away or try another rear camera.</p></div>}
  {error&&<p className="inline-error" role="alert">{error}</p>}</>;
}
