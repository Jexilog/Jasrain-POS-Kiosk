// Files that come from a phone, Messenger or email (see backend/src/routes/incoming.js)
import { api } from '../api';

const head = (name) => ({ 'X-File-Name': encodeURIComponent(name) });

// kiosk: phone upload
export const createSession = () => api.post('/incoming/sessions');
export const sessionStatus = (code) => api.get(`/incoming/sessions/${code}`);
export const dropSession = (code) => api.del(`/incoming/used/${code}`);

// phone page
export const sendFromPhone = (code, file) => api.put(`/incoming/sessions/${code}/file`, file, head(file.name));

// kiosk: Messenger / email
export const findFiles = (source, who) => api.get(`/incoming/find?source=${source}&who=${encodeURIComponent(who)}`);

// turns a downloaded blob into a File, like the one a USB pick gives
async function download(path, name, type) {
  const blob = await api.blob(path);
  return new File([blob], name, { type: type || blob.type });
}
export const downloadPhoneFile = (code, name, type) => download(`/incoming/sessions/${code}/file`, name, type);
export const downloadOnlineFile = (ref, name, type) => download(`/incoming/files/${ref}/file`, name, type);
export const dropFile = (ref) => api.del(`/incoming/used/${ref}`);

// staff
export const listOnlineFiles = () => api.get('/incoming/files');
export const attachOnlineFile = (source, owner, file) =>
  api.put('/incoming/files', file, { ...head(file.name), 'X-Source': source, 'X-Owner': encodeURIComponent(owner) });
export const removeOnlineFile = (id) => api.del(`/incoming/files/${id}`);
