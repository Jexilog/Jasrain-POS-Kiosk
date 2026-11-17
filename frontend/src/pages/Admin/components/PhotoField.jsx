import React, { useEffect, useRef, useState } from 'react';
import Icon from '../../../components/Icon';
import { imageUrl } from '../../../api';
import { toSquareJpeg } from '../../../utils/photo';

// Lets the owner add a product picture by taking a photo or choosing a file.
//   value:   the picture the product has now
//   pending: a new picture that is not saved yet (a Blob)
export default function PhotoField({ value, pending, onPick, onRemove }) {
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  // show the new picture before it is saved
  useEffect(() => {
    if (!pending) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(pending);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopCamera, []); // let go of the camera when the form closes

  // connect the camera to the video box once it is on the screen
  useEffect(() => {
    if (camera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camera]);

  const openCamera = async () => {
    setMessage('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage('The camera needs a secure page (https or localhost). Use "Choose picture" instead.');
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
      setCamera(true);
    } catch (e) {
      setMessage(e.name === 'NotAllowedError'
        ? 'The camera is blocked. Allow it in the address bar, or use "Choose picture".'
        : 'No camera was found. Use "Choose picture" instead.');
    }
  };

  const closeCamera = () => {
    stopCamera();
    setCamera(false);
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const blob = await toSquareJpeg(video);
    closeCamera();
    if (blob) onPick(blob);
  };

  const chosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setMessage('');
    try {
      onPick(await toSquareJpeg(file));
    } catch (err) {
      setMessage('That file is not a picture we can read.');
    }
  };

  const shown = previewUrl || imageUrl(value);

  return (
    <div className="admPhoto">
      <div className="admPhotoBox">
        {camera ? <video ref={videoRef} muted playsInline />
          : shown ? <img src={shown} alt="The product" />
            : <span className="admMuted"><Icon name="image" size={30} /></span>}
      </div>
      <div className="admPhotoActions">
        {camera ? (
          <>
            <button type="button" className="admBtn primary" onClick={capture}><Icon name="camera" size={16} /> Capture</button>
            <button type="button" className="admBtn" onClick={closeCamera}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className="admBtn" onClick={openCamera}><Icon name="camera" size={16} /> Take photo</button>
            <button type="button" className="admBtn" onClick={() => fileRef.current && fileRef.current.click()}><Icon name="upload" size={16} /> Choose picture</button>
            {shown && <button type="button" className="admBtn" onClick={onRemove}><Icon name="trash" size={16} /> Remove</button>}
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={chosen} />
      </div>
      {message && <p className="admFieldError" role="alert">{message}</p>}
    </div>
  );
}
