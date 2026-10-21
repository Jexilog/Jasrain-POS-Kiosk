// Print files are kept by the backend (in the print_file table).
// The kiosk uploads the file, staff download it from the staff screen.
import { api } from '../api';

export const saveFile = (id, file) => api.put(`/print-jobs/${id}/file`, file);

// returns { blob } or undefined when the job has no file
export async function getFile(id) {
  try {
    return { blob: await api.blob(`/print-jobs/${id}/file`) };
  } catch (e) {
    if (e.status === 404) return undefined;
    throw e;
  }
}

export const deleteFile = (id) => api.del(`/print-jobs/${id}/file`);
