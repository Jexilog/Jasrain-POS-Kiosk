#!/usr/bin/env python3
"""
JASRAIN cart camera for the Raspberry Pi.

The USB webcam plugs into the Pi. This program runs the same cart.onnx model the kiosk used in the
browser, works out "is the cart there" and "is something inside it", and answers the kiosk over the network.

Run:                 python3 cart_pi.py
Different camera:    python3 cart_pi.py --camera 1          (number, try 0, 1, 2 ...)
Test with a picture: python3 cart_pi.py --image test.jpg    (no camera needed)
Check the maths:     python3 cart_pi.py --selftest
"""
import argparse
import json
import math
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, 'cart.onnx')
PHOTO_PATH = os.path.join(HERE, 'empty_cart.json')   # the saved "empty cart" photo
PORT = 8766

# ---- same numbers as the kiosk used in the browser ----
CART_SIZE = 320
CHECK_EVERY = 0.5            # seconds between checks (the kiosk used 500 ms)
GRID_W, GRID_H = 64, 36
PIXEL_DIFF = 35
INSIDE = 0.12
# Webcam settings. If the picture shows torn lines, try CAM_FORMAT = '' (the webcam's own default), then CAM_FPS = 15.
CAM_FORMAT = 'MJPG'          # 'MJPG' = compressed pictures, or '' to leave the webcam's default
CAM_WIDTH = 640
CAM_HEIGHT = 360
CAM_FPS = 30
PREVIEW_EVERY = 0.1          # live preview picture refreshed this often (10 per second)
IDLE_AFTER = 10              # no kiosk question for this many seconds = stop looking, free the camera


# ------------------------------------------------------------------ the model
class CartDetector:
    def __init__(self, path):
        import onnxruntime as ort
        self.session = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
        self.input_name = self.session.get_inputs()[0].name

    def detect(self, frame, min_score):
        """frame: BGR picture. Returns (boxes, best). boxes: [{score,x,y,w,h}] with x,y,w,h as 0..1 of the picture."""
        h, w = frame.shape[:2]
        scale = min(CART_SIZE / w, CART_SIZE / h)
        rw, rh = round(w * scale), round(h * scale)
        pad_x, pad_y = (CART_SIZE - rw) // 2, (CART_SIZE - rh) // 2
        canvas = np.full((CART_SIZE, CART_SIZE, 3), 114, np.uint8)       # grey padding, as in training
        canvas[pad_y:pad_y + rh, pad_x:pad_x + rw] = cv2.resize(frame, (rw, rh), interpolation=cv2.INTER_LINEAR)
        rgb = canvas[:, :, ::-1].astype(np.float32) / 255.0
        data = np.ascontiguousarray(rgb.transpose(2, 0, 1)[None])
        out = self.session.run(None, {self.input_name: data})[0][0]       # shape [5, 2100]
        scores = out[4]
        best = float(scores.max())
        found = []
        for i in np.where(scores >= min_score)[0]:
            cx, cy, bw, bh = out[0, i], out[1, i], out[2, i], out[3, i]
            found.append({'score': float(scores[i]),
                          'x': float((cx - bw / 2 - pad_x) / rw), 'y': float((cy - bh / 2 - pad_y) / rh),
                          'w': float(bw / rw), 'h': float(bh / rh)})
        found.sort(key=lambda b: -b['score'])
        kept = []
        for b in found:                          # boxes on top of each other: keep the most sure one
            if not any(overlap(k, b) > 0.5 for k in kept):
                kept.append(b)
        return kept, best


def overlap(a, b):
    x1, y1 = max(a['x'], b['x']), max(a['y'], b['y'])
    x2, y2 = min(a['x'] + a['w'], b['x'] + b['w']), min(a['y'] + a['h'], b['y'] + b['h'])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    union = a['w'] * a['h'] + b['w'] * b['h'] - inter
    return inter / union if union > 0 else 0


# ------------------------------------------------------------ "is the cart there"
class Presence:
    """Cart counts as there after 2 of the last 3 checks. Once there, gone only after 6 misses in a row."""
    def __init__(self, look=3, need=2, exit_after=6):
        self.look, self.need, self.exit_after = look, need, exit_after
        self.reset()

    def reset(self):
        self.recent, self.present, self.misses, self.seen = [], False, 0, 0

    def push(self, found):
        self.seen += 1
        self.recent.append(bool(found))
        self.recent = self.recent[-self.look:]
        self.misses = 0 if found else self.misses + 1
        if not self.present and sum(self.recent) >= self.need:
            self.present = True
        elif self.present and self.misses >= self.exit_after:
            self.present, self.recent = False, []

    def ready(self):
        return self.seen >= 3 or self.present


class Vote:
    """Looks at the last 5 answers so one odd frame does not flip the result."""
    def __init__(self, size=5):
        self.size, self.last = size, []

    def push(self, v):
        self.last = (self.last + [bool(v)])[-self.size:]

    def reset(self):
        self.last = []

    def ready(self):
        return len(self.last) >= self.size

    def not_empty(self):
        return sum(self.last) > self.size / 2


# ------------------------------------------------------ "is something inside it"
def cart_grid(frame, box):
    """Cuts the inside of the cart out of the picture and shrinks it to a small grey grid."""
    vh, vw = frame.shape[:2]
    sx = max(0, (box['x'] + box['w'] * INSIDE) * vw)
    sy = max(0, (box['y'] + box['h'] * INSIDE) * vh)
    sw = min(vw - sx, box['w'] * (1 - 2 * INSIDE) * vw)
    sh = min(vh - sy, box['h'] * (1 - 2 * INSIDE) * vh)
    x0, y0 = int(sx), int(sy)
    x1, y1 = max(x0 + 1, int(round(sx + sw))), max(y0 + 1, int(round(sy + sh)))
    crop = frame[y0:y1, x0:x1]
    small = cv2.resize(crop, (GRID_W, GRID_H), interpolation=cv2.INTER_AREA).astype(np.float32)
    b, g, r = small[:, :, 0], small[:, :, 1], small[:, :, 2]
    return 0.299 * r + 0.587 * g + 0.114 * b


def inside_changed(reference, grid, margin=0.05):
    """How much of the inside is different from the empty cart: 0 (same) to 1 (all different)."""
    a, b = reference - reference.mean(), grid - grid.mean()   # ignore the room getting lighter or darker
    x0, y0 = int(GRID_W * margin), int(GRID_H * margin)
    diff = np.abs(a - b)[y0:GRID_H - y0, x0:GRID_W - x0]
    return float((diff > PIXEL_DIFF).mean()) if diff.size else 0.0


def load_photo():
    try:
        with open(PHOTO_PATH) as f:
            saved = json.load(f)
        grid = np.array(saved['data'], np.float32)
        if grid.size == GRID_W * GRID_H:
            return grid.reshape(GRID_H, GRID_W), saved.get('savedAt')
    except (OSError, ValueError, KeyError):
        pass
    return None, None


def save_photo(grid):
    saved_at = int(time.time() * 1000)
    with open(PHOTO_PATH, 'w') as f:
        json.dump({'data': [int(round(v)) for v in grid.flatten()], 'savedAt': saved_at}, f)
    return saved_at


def jpeg_of(frame):
    small = cv2.resize(frame, (480, int(480 * frame.shape[0] / frame.shape[1])))
    ok, jpg = cv2.imencode('.jpg', small, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return jpg.tobytes() if ok else None


# ----------------------------------------------------------------- the worker
class Worker:
    def __init__(self, camera, image=None):
        self.camera_arg = camera
        self.image = cv2.imread(image) if image else None
        if image and self.image is None:
            raise SystemExit(f'Could not read the picture {image}')
        self.lock = threading.Lock()
        self.params = {'on': True, 'score': 0.6, 'limit': 0.06, 'items': True}
        self.last_ask = 0.0
        self.frame = None
        self.cap = None
        self.latest = None           # newest picture from the webcam (kept fresh by the reader thread)
        self.latest_at = 0.0
        self.reader = None
        self.reader_stop = False
        self.cap_error = ''
        self.detector = None
        self.model_error = ''
        self.presence = Presence()
        self.vote = Vote()
        self.last_box = None
        self.was_some = False
        self.reference, self.photo_saved_at = load_photo()
        self.times = []
        self.state = self.fresh_state('off')
        self.save_request = None
        self.save_result = None
        threading.Thread(target=self.run, daemon=True).start()

    def fresh_state(self, camera, message=''):
        return {'camera': camera, 'basket': 'unknown', 'items': 'unknown', 'inside': None, 'boxes': [],
                'score': None, 'best': None, 'ms': None, 'message': message,
                'hasPhoto': self.reference is not None, 'photoSavedAt': self.photo_saved_at}

    # the kiosk asks; this also tells us what it wants
    def ask(self, params):
        with self.lock:
            self.params.update(params)
            self.last_ask = time.time()
            return dict(self.state)

    def wanted(self):
        with self.lock:
            return self.params['on'] and time.time() - self.last_ask < IDLE_AFTER

    def open_camera(self):
        if self.image is not None:
            return True
        arg = self.camera_arg
        cap = cv2.VideoCapture(int(arg) if str(arg).isdigit() else arg, cv2.CAP_V4L2)
        if CAM_FORMAT:
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*CAM_FORMAT))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAM_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_HEIGHT)
        cap.set(cv2.CAP_PROP_FPS, CAM_FPS)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            cap.release()
            self.cap_error = 'No camera found. Check the USB cable, or try --camera 1.'
            return False
        self.cap = cap
        self.cap_error = ''
        self.latest = None
        self.reader_stop = False
        self.reader = threading.Thread(target=self.read_loop, args=(cap,), daemon=True)
        self.reader.start()
        return True

    def close_camera(self):
        self.reader_stop = True
        if self.reader is not None:
            self.reader.join(2)
            self.reader = None
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.latest = None

    # Runs on its own: always keeps the newest webcam picture, and refreshes the live preview about 10 times a second.
    def read_loop(self, cap):
        last_jpg = 0.0
        while not self.reader_stop:
            ok, frame = cap.read()
            if not ok:
                time.sleep(0.05)
                continue
            self.latest = frame
            self.latest_at = time.time()
            if self.latest_at - last_jpg >= PREVIEW_EVERY:
                last_jpg = self.latest_at
                self.frame = jpeg_of(frame)

    def grab(self):
        if self.image is not None:
            return self.image.copy()
        if self.cap is None:
            return None
        waited = 0.0
        while self.latest is None and waited < 3:       # camera just started: wait for its first picture
            time.sleep(0.05)
            waited += 0.05
        frame = self.latest
        if frame is None or time.time() - self.latest_at > 2:
            return None             # the reader has stopped getting pictures
        return frame.copy()

    def reset_vision(self):
        self.presence.reset()
        self.vote.reset()
        self.last_box = None
        self.was_some = False

    def run(self):
        try:
            self.detector = CartDetector(MODEL_PATH)
        except Exception as e:      # model file missing or broken
            self.model_error = str(e)
        while True:
            if not self.wanted():
                if self.cap is not None:
                    self.close_camera()
                    self.reset_vision()
                with self.lock:
                    self.state = self.fresh_state('off')
                time.sleep(0.3)
                continue
            if self.cap is None and self.image is None and not self.open_camera():
                with self.lock:
                    self.state = self.fresh_state('missing', self.cap_error)
                time.sleep(2)
                continue
            started = time.time()
            frame = self.grab()
            if frame is None:
                with self.lock:
                    self.state = self.fresh_state('error', 'The camera gave no picture.')
                self.close_camera()
                time.sleep(2)
                continue
            self.step(frame)
            time.sleep(max(0.0, CHECK_EVERY - (time.time() - started)))

    def step(self, frame):
        with self.lock:
            p = dict(self.params)
        if self.image is not None:
            self.frame = jpeg_of(frame)     # with a webcam the reader thread does this

        if self.detector is None:
            with self.lock:
                st = self.fresh_state('ready')
                st['basket'] = 'noModel'
                st['message'] = self.model_error or 'cart.onnx not found next to cart_pi.py'
                self.state = st
            return

        started = time.time()
        bar = p['score'] * 0.7 if self.presence.present else p['score']
        boxes, best = self.detector.detect(frame, bar)
        self.presence.push(len(boxes) > 0)
        present = self.presence.present
        if boxes:
            self.last_box = boxes[0]
        box = boxes[0] if boxes else (self.last_box if present else None)

        # staff pressed "save empty cart photo"
        if self.save_request is not None:
            self.save_result = self.save_empty(frame, box)
            self.save_request = None

        items, inside = 'unknown', None
        if box and present:
            if self.reference is None:
                items = 'noPhoto'
            else:
                inside = inside_changed(self.reference, cart_grid(frame, box))
                limit = p['limit'] * (0.7 if self.was_some else 1)
                self.vote.push(inside > limit)
                if self.vote.ready():
                    items = 'some' if self.vote.not_empty() else 'none'
                    self.was_some = items == 'some'
        else:
            self.vote.reset()
            self.was_some = False

        self.times = (self.times + [(time.time() - started) * 1000])[-5:]
        with self.lock:
            prev = self.state
            if present and items == 'unknown' and prev.get('items') in ('some', 'none'):
                items = prev['items']          # keep the last answer while the vote refills
            self.state = {
                'camera': 'ready',
                'basket': ('present' if present else 'empty') if self.presence.ready() else 'unknown',
                'items': items if present else 'unknown',
                'inside': inside, 'boxes': boxes,
                'score': max((b['score'] for b in boxes), default=None),
                'best': best, 'ms': round(sum(self.times) / len(self.times)), 'message': '',
                'hasPhoto': self.reference is not None, 'photoSavedAt': self.photo_saved_at,
            }

    def save_empty(self, frame, box):
        if box is None:
            return {'ok': False, 'error': 'The cart is not in view. Put the empty cart under the camera first.'}
        grids = []
        for i in range(5):
            f = frame if i == 0 else self.grab()
            if f is None:
                return {'ok': False, 'error': 'The camera is not ready yet.'}
            grids.append(cart_grid(f, box))
            time.sleep(0.15)
        grid = np.mean(grids, axis=0)
        try:
            self.photo_saved_at = save_photo(grid)
        except OSError as e:
            return {'ok': False, 'error': f'Could not save it: {e}'}
        self.reference = grid
        self.vote.reset()
        return {'ok': True}

    def request_save(self):
        self.save_result = None
        self.save_request = True
        for _ in range(60):
            time.sleep(0.1)
            if self.save_result is not None:
                return self.save_result
        self.save_request = None
        return {'ok': False, 'error': 'The camera is not running. Open the camera in Settings first.'}


# ---------------------------------------------------------------------- HTTP
worker = None


def num(q, name, default, lo, hi):
    try:
        v = float(q[name][0])
        return v if lo <= v <= hi else default
    except (KeyError, ValueError, IndexError):
        return default


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='application/json'):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204, b'')

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == '/cart/state':
            on = q.get('on', ['1'])[0] != '0'
            params = {'on': on,
                      'score': num(q, 'score', 0.6, 0.1, 0.99),
                      'limit': num(q, 'limit', 0.06, 0.02, 0.6),
                      'items': q.get('items', ['1'])[0] != '0'}
            return self._send(200, worker.ask(params))
        if u.path == '/cart/preview.jpg':
            if worker.frame is None:
                return self._send(404, {'error': 'no picture yet'})
            return self._send(200, worker.frame, 'image/jpeg')
        if u.path == '/health':
            return self._send(200, {'ok': True, 'model': worker.detector is not None, 'modelError': worker.model_error})
        self._send(404, {'error': 'not found'})

    def do_POST(self):
        if urlparse(self.path).path == '/cart/empty-photo':
            return self._send(200, worker.request_save())
        self._send(404, {'error': 'not found'})

    def log_message(self, *a):
        pass


# ------------------------------------------------------------------ self test
def selftest():
    # presence: needs 2 of 3 to appear, 6 misses in a row to go away
    p = Presence()
    for v in (0, 0, 0):
        p.push(v)
    assert p.ready() and not p.present
    p.push(1)
    assert not p.present
    p.push(1)
    assert p.present
    for _ in range(5):
        p.push(0)
    assert p.present
    p.push(0)
    assert not p.present
    # inside check: same picture = 0, a dark patch = changed
    ref = np.full((GRID_H, GRID_W), 150, np.float32)
    assert inside_changed(ref, ref.copy()) == 0
    cur = ref.copy()
    cur[12:17, 20:30] = 20                           # a small dark item
    assert 0.01 < inside_changed(ref, cur) < 0.1
    brighter = ref + 30
    assert inside_changed(ref, brighter) == 0          # whole room lighter is not an item
    # vote
    v = Vote()
    for x in (1, 1, 0, 1, 0):
        v.push(x)
    assert v.ready() and v.not_empty()
    # letterbox maths on a blank picture (needs the model file)
    if os.path.exists(MODEL_PATH):
        det = CartDetector(MODEL_PATH)
        boxes, best = det.detect(np.full((360, 640, 3), 90, np.uint8), 0.6)
        assert boxes == [] and 0 <= best <= 1
    print('self test passed')


def main():
    global worker
    ap = argparse.ArgumentParser()
    ap.add_argument('--camera', default='0')
    ap.add_argument('--image')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--port', type=int, default=PORT)
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    worker = Worker(a.camera, a.image)
    srv = ThreadingHTTPServer(('0.0.0.0', a.port), Handler)
    print(f'Cart camera ready on port {a.port}. Waiting for the kiosk.')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
