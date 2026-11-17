#!/usr/bin/env python3
"""
JASRAIN cash reader for the Raspberry Pi 4B.

Counts the pulses from the coin slot and the bill acceptor, turns them into pesos,
and hands them to the kiosk when it asks (GET /cash/take).

Run:      python3 cash_pi.py
Test pulses only (no kiosk):   python3 cash_pi.py --test   (also opens a test page at http://<Pi address>:8765/test)
No wiring yet, just test the link:  python3 cash_pi.py --fake
"""
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---------------- SETTINGS: check these against your parts ----------------
COIN_PIN = 17          # GPIO number (physical pin 11). Signal from the coin slot's opto-isolator.
BILL_PIN = 27          # GPIO number (physical pin 13). Signal from the bill acceptor's opto-isolator.

# Pesos for ONE pulse. Set these after running --test and inserting known coins and bills.
COIN_PESO_PER_PULSE = 1    # 1239 coin slot: usually 1 pulse = 1 peso, but check
BILL_PESO_PER_PULSE = 1    # TB74: ₱50 gave 50 pulses, so 1 pulse = ₱1 (changes if you change the DIP switches)

# How each acceptor's signal reaches the Pi (set each one on its own):
#   'direct' or 'opto' = signal pulls the Pi pin LOW for each pulse (bill acceptor blue wire straight to the pin,
#                        or any signal that goes through a PC817)
#   'divider_idle_low'  = 10k + 3.3k divider, the signal sits at 0 V and goes UP to 12 V for a pulse
#   'divider_idle_high' = 10k + 3.3k divider, the signal sits at 12 V and drops to 0 V for a pulse
COIN_WIRING = 'divider_idle_high'
BILL_WIRING = 'direct'

GAP_SECONDS = 0.6      # no pulse for this long = the coin or bill is finished
PORT = 8765

# Only fill these in if your acceptor has an inhibit/enable wire AND you wired it
# through a relay or opto-isolator. Leave as None otherwise.
COIN_INHIBIT_PIN = None
BILL_INHIBIT_PIN = None
INHIBIT_ACTIVE_LOW = True   # True: output LOW switches the acceptor off
# --------------------------------------------------------------------------

HERE = os.path.dirname(os.path.abspath(__file__))
GROUPS = {}          # the two PulseGroups, for the test page
lock = threading.Lock()
events = []          # cash waiting for the kiosk to take
enabled = True
last_enable_at = time.time()


def add_event(amount, kind):
    with lock:
        events.append({'amount': amount, 'kind': kind, 'at': time.strftime('%Y-%m-%dT%H:%M:%S')})
    print(f'[cash] {kind} {amount} pesos queued')


class PulseGroup:
    """Counts pulses from one acceptor and closes the group after a quiet gap."""

    def __init__(self, kind, peso_per_pulse, test=False, pin=None, wiring=''):
        self.kind = kind
        self.peso = peso_per_pulse
        self.test = test
        self.pin = pin
        self.wiring = wiring
        self.count = 0
        self.last = 0.0
        self.first = 0.0
        self.total = 0
        self.history = []        # newest first, for the test page
        self.on_times = []       # how long each pulse was ON (ms)
        self.periods = []        # time from one pulse to the next (ms)
        self.pressed_at = 0.0
        self.level = lambda: False   # is the line active right now? (set in main)
        self.lock = threading.Lock()

    def pulse(self):
        now = time.time()
        with self.lock:
            if self.count == 0:
                self.first = now
            elif len(self.periods) < 200:
                self.periods.append((now - self.last) * 1000)
            self.count += 1
            self.total += 1
            self.last = now
            self.pressed_at = now

    def released(self):
        with self.lock:
            if self.pressed_at and len(self.on_times) < 200:
                self.on_times.append((time.time() - self.pressed_at) * 1000)

    def check(self):
        with self.lock:
            if self.count and time.time() - self.last >= GAP_SECONDS:
                n, self.count = self.count, 0
                secs = self.last - self.first
                self.history.insert(0, {'n': n, 'pesos': n * self.peso, 'secs': secs})
                del self.history[8:]
            else:
                return
        if self.test:
            print(f'[test] {self.kind}: {n} pulse(s)  ->  with {self.peso} peso per pulse = {n * self.peso} pesos')
        else:
            add_event(n * self.peso, self.kind)

    def snapshot(self):
        with self.lock:
            on = sum(self.on_times) / len(self.on_times) if self.on_times else None
            per = sum(self.periods) / len(self.periods) if self.periods else None
            return {
                'pin': self.pin, 'wiring': self.wiring, 'peso': self.peso,
                'live': self.count, 'live_secs': (self.last - self.first) if self.count else 0,
                'active': bool(self.level()), 'total': self.total,
                'on_ms': round(on) if on is not None else None,
                'off_ms': round(per - on) if (on is not None and per is not None) else None,
                'history': list(self.history),
            }

    def clear(self):
        with self.lock:
            self.history = []
            self.on_times = []
            self.periods = []
            self.total = 0


def set_inhibit(on):
    """on=True lets cash in, on=False switches the acceptors off. Does nothing unless the inhibit pins are set."""
    if not (COIN_INHIBIT_PIN or BILL_INHIBIT_PIN):
        return
    from gpiozero import DigitalOutputDevice
    for pin in (COIN_INHIBIT_PIN, BILL_INHIBIT_PIN):
        if pin is None:
            continue
        if pin not in _outs:
            _outs[pin] = DigitalOutputDevice(pin, initial_value=True)
        # active-low inhibit: HIGH = cash allowed, LOW = off
        high = on if INHIBIT_ACTIVE_LOW else (not on)
        _outs[pin].value = 1 if high else 0


_outs = {}


class Handler(BaseHTTPRequestHandler):
    fake = False

    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        global events
        if self.path.startswith('/test/state'):
            return self._send(200, {k: g.snapshot() for k, g in GROUPS.items()})
        if self.path.split('?')[0] == '/test':
            data = open(os.path.join(HERE, 'test_page.html'), 'rb').read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path.startswith('/cash/take'):
            with lock:
                out, events = events, []
            return self._send(200, {'events': out})
        if self.path.startswith('/health'):
            with lock:
                waiting = len(events)
            return self._send(200, {'ok': True, 'enabled': enabled, 'waiting': waiting, 'fake': self.fake})
        self._send(404, {'error': 'not found'})

    def do_POST(self):
        global enabled
        n = int(self.headers.get('Content-Length') or 0)
        try:
            body = json.loads(self.rfile.read(n) or b'{}')
        except ValueError:
            return self._send(400, {'error': 'bad json'})
        if self.path.startswith('/test/reset'):
            for g in GROUPS.values():
                g.clear()
            return self._send(200, {'ok': True})
        if self.path.startswith('/enable'):
            enabled = bool(body.get('on'))
            set_inhibit(enabled)
            return self._send(200, {'enabled': enabled})
        if self.path.startswith('/fake') and self.fake:
            add_event(int(body.get('amount', 0)), body.get('kind', 'cash'))
            return self._send(200, {'ok': True})
        self._send(404, {'error': 'not found'})

    def log_message(self, *a):
        pass


def main():
    test = '--test' in sys.argv
    fake = '--fake' in sys.argv
    coin = PulseGroup('coin', COIN_PESO_PER_PULSE, test, COIN_PIN, COIN_WIRING)
    bill = PulseGroup('bill', BILL_PESO_PER_PULSE, test, BILL_PIN, BILL_WIRING)
    GROUPS['bill'] = bill
    GROUPS['coin'] = coin

    if not fake:
        from gpiozero import Button
        # The opto-isolator pulls the pin LOW for each pulse, so use the internal pull-up.
        def make(pin, wiring):
            if wiring in ('direct', 'opto'):
                return Button(pin, pull_up=True, bounce_time=0.005)
            if wiring == 'divider_idle_low':
                return Button(pin, pull_up=False, bounce_time=0.005)
            if wiring == 'divider_idle_high':
                return Button(pin, pull_up=None, active_state=False, bounce_time=0.005)
            raise SystemExit("WIRING must be 'direct', 'opto', 'divider_idle_low' or 'divider_idle_high'")
        coin_in = make(COIN_PIN, COIN_WIRING)
        bill_in = make(BILL_PIN, BILL_WIRING)
        coin_in.when_pressed = coin.pulse
        bill_in.when_pressed = bill.pulse
        coin_in.when_released = coin.released
        bill_in.when_released = bill.released
        coin.level = lambda: coin_in.is_pressed
        bill.level = lambda: bill_in.is_pressed
        print(f'Listening: coin GPIO{COIN_PIN}, bill GPIO{BILL_PIN}')

    if test:
        srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
        Handler.fake = fake
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        print('TEST MODE. Insert a coin or bill and read how many pulses it gives. Ctrl+C to stop.')
        print(f'Test page: open  http://<this Pi address>:{PORT}/test  in your PC browser')
    else:
        srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
        Handler.fake = fake
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        print(f'Kiosk link ready on port {PORT}' + ('  (FAKE mode: POST /fake {"amount":20,"kind":"bill"})' if fake else ''))

    try:
        while True:
            coin.check()
            bill.check()
            time.sleep(0.05)
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
