// Which camera the kiosk uses. Staff pick it in Admin > Settings > Camera.
const KEY = 'jasrain_camera_id';

export function getCameraId() {
  try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
}

export function setCameraId(id) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
    return true;
  } catch (e) {
    return false;
  }
}

// Staff can switch the camera off in Admin > Settings > Camera to save the computer's power.
// Off = self checkout and the start screen do not open the camera at all.
const ON_KEY = 'jasrain_camera_on';

export function isCameraOn() {
  try { return localStorage.getItem(ON_KEY) !== 'off'; } catch (e) { return true; }
}

export function setCameraOn(on) {
  try { localStorage.setItem(ON_KEY, on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
}

// Opens the chosen camera. If it is gone or none was chosen, it tries the default camera.
export async function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const err = new Error('This page is not secure, so the browser blocks the camera. Use localhost or https.');
    err.name = 'NotSupportedError';
    throw err;
  }
  const id = getCameraId();
  const tries = [];
  if (id) tries.push({ video: { deviceId: { exact: id } } });
  tries.push({ video: { width: 640, height: 360 } });
  tries.push({ video: true });
  let last;
  for (const constraints of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      last = e;
      if (e.name === 'NotAllowedError') throw e;
    }
  }
  throw last;
}

export async function listCameras() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput');
}
