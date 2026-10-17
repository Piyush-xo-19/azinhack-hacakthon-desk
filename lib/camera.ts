type CameraCapabilities = MediaTrackCapabilities & { focusMode?:string[]; torch?:boolean };
type CameraConstraint = MediaTrackConstraintSet & { focusMode?:string; torch?:boolean };
export function cameraConstraints(deviceId?:string):MediaStreamConstraints {
  return {audio:false,video:{...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}}),width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:24,max:30}}};
}
function errorName(error:unknown){return error&&typeof error==='object'&&'name'in error?String(error.name):'';}
export async function requestScannerCamera(media:Pick<MediaDevices,'getUserMedia'>,deviceId?:string){
  try{return await media.getUserMedia(cameraConstraints(deviceId));}
  catch(error){
    // Retry only unsupported constraints; permission and hardware failures need user action.
    if(errorName(error)!=='OverconstrainedError')throw error;
    return media.getUserMedia({audio:false,video:deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}}});
  }
}
export function cameraCapabilities(track:MediaStreamTrack):CameraCapabilities {
  try{return track.getCapabilities?.()||{};}catch{return {};}
}
function withCameraSetting(track:MediaStreamTrack,setting:CameraConstraint){
  const current=track.getConstraints();
  return {...current,advanced:[Object.assign({},...(current.advanced||[]),setting)]};
}
export async function focusCamera(track:MediaStreamTrack,refocus=false){
  const modes=cameraCapabilities(track).focusMode||[];
  const mode=refocus&&modes.includes('single-shot')?'single-shot':modes.includes('continuous')?'continuous':modes.includes('single-shot')?'single-shot':null;
  if(!mode)return false;
  await track.applyConstraints(withCameraSetting(track,{focusMode:mode} as CameraConstraint));return true;
}
export async function setCameraTorch(track:MediaStreamTrack,on:boolean){
  await track.applyConstraints(withCameraSetting(track,{torch:on} as CameraConstraint));
}
export function cameraErrorMessage(error:unknown){
  switch(errorName(error)){
    case 'NotAllowedError':case 'SecurityError':return 'Camera access was blocked. Allow Camera in this site’s browser settings, then retry. If using an in-app browser, open this page directly in Chrome, Edge or Safari.';
    case 'NotFoundError':return 'This camera is no longer available. Choose another camera or upload a QR image.';
    case 'NotReadableError':return 'The camera could not be opened. Close other apps using it and check your phone or computer camera privacy settings.';
    case 'OverconstrainedError':return 'This camera cannot provide the requested video. Choose another camera and retry.';
    case 'AbortError':return 'Camera startup was interrupted. Tap Start camera again.';
    default:return 'Camera preview could not start. Retry or open this page directly in Chrome, Edge or Safari. You can also upload a QR image.';
  }
}
