import { useEffect, useRef, useState } from 'react';
import { Runner } from '../icons/PixelIcons';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from '../icons/PixelIcons-extra';

const PALETTES = [
  { name: 'GRAPE', bg: '#120A24', text: '#ECE4FB', glow: 'rgba(179,107,255,0.26)' },
  { name: 'BERRY', bg: '#200A1C', text: '#FCE4EE', glow: 'rgba(255,92,168,0.28)' },
  { name: 'OCEAN', bg: '#06141F', text: '#DFF1FF', glow: 'rgba(77,163,255,0.28)' },
];
const PALETTE_KEY = 'trnr_gb_palette';
const DEVICE_W = 392;
const DEVICE_H = 844;
const MARGIN = 48;
const KEY_TO_ACTION = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'a', A: 'a', b: 'b', B: 'b', Enter: 'start', Shift: 'select',
};

/**
 * Game Boy Color hardware shell — wraps the app's screen content.
 * D-pad / A / B forward to onDpad / onA / onB (each receives a `showToast`
 * helper). START toggles power (boot splash); SELECT cycles the screen
 * color palette, persisted to localStorage.
 */
export default function DeviceShell({ children, onDpad, onA, onB }) {
  const [power, setPower] = useState(true);
  const [palette, setPalette] = useState(() => {
    const saved = parseInt(localStorage.getItem(PALETTE_KEY), 10);
    return Number.isInteger(saved) && saved >= 0 && saved < PALETTES.length ? saved : 0;
  });
  const [toast, setToast] = useState('');
  const [scale, setScale] = useState(1);
  const screenRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    localStorage.setItem(PALETTE_KEY, String(palette));
    const p = PALETTES[palette];
    const el = screenRef.current;
    if (!el) return;
    el.style.setProperty('--scr-bg', p.bg);
    el.style.setProperty('--scr-text', p.text);
    el.style.setProperty('--scr-glow', p.glow);
  }, [palette]);

  useEffect(() => {
    function fit() {
      const s = Math.min((window.innerWidth - MARGIN) / DEVICE_W, (window.innerHeight - MARGIN) / DEVICE_H);
      setScale(Math.min(s, 1.25));
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1300);
  }

  function handleAction(act) {
    if (act === 'start') { setPower((p) => !p); return; }
    if (!power) return;
    switch (act) {
      case 'up':    onDpad?.('up', showToast);    break;
      case 'down':  onDpad?.('down', showToast);  break;
      case 'left':  onDpad?.('left', showToast);  break;
      case 'right': onDpad?.('right', showToast); break;
      case 'a':     onA?.(showToast); break;
      case 'b':     onB?.(showToast); break;
      case 'select': {
        const next = (palette + 1) % PALETTES.length;
        setPalette(next);
        showToast('PALETTE · ' + PALETTES[next].name);
        break;
      }
      default: break;
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      const act = KEY_TO_ACTION[e.key];
      if (!act) return;
      e.preventDefault();
      const btn = document.querySelector(`[data-gb-act="${act}"]`);
      press(btn);
      handleAction(act);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  function press(btn) {
    if (!btn) return;
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 90);
  }

  return (
    <div className="gb-viewport">
      <div className="gb-scaler" style={{ transform: `scale(${scale})` }}>
        <div className="gb-device">
          <div className="gb-topstrip">
            <div className={`gb-led${power ? ' on' : ''}`} />
            <span className="gb-led-label">POWER</span>
            <span className="gb-tag"><span className="gb-acc">━</span> TRAIN. RUN. LEVEL UP. <span className="gb-acc">━</span></span>
          </div>

          <div className="gb-bezel">
            <div className="gb-micro">
              <span>TRNRBOI</span>
              <span className="gb-dot" />
              <span>COLOR · STEREO SOUND</span>
            </div>
            <div className="gb-screen" ref={screenRef}>
              <div className={`gb-toast${toast ? ' show' : ''}`}>{toast}</div>
              {power ? (
                <div className="gb-sc">{children}</div>
              ) : (
                <div className="gb-splash">
                  <div className="gb-logo">TRNRBOI 8000</div>
                  <div className="gb-blink">▶ PRESS START</div>
                </div>
              )}
            </div>
          </div>

          <div className="gb-wordmark">
            <Runner size={26} color="var(--label-ink)" />
            <span className="gb-wt">TRNRBOI</span>
            <span className="gb-n8">8000</span>
          </div>

          <div className="gb-deck">
            <div className="dpad">
              <button className="dpad-btn dpad-up" data-gb-act="up" onClick={() => handleAction('up')} aria-label="Up">
                <ChevronUp size={13} color="var(--key-deep)" />
              </button>
              <button className="dpad-btn dpad-left" data-gb-act="left" onClick={() => handleAction('left')} aria-label="Left">
                <ChevronLeft size={13} color="var(--key-deep)" />
              </button>
              <div className="dpad-hub" />
              <button className="dpad-btn dpad-right" data-gb-act="right" onClick={() => handleAction('right')} aria-label="Right">
                <ChevronRight size={13} color="var(--key-deep)" />
              </button>
              <button className="dpad-btn dpad-down" data-gb-act="down" onClick={() => handleAction('down')} aria-label="Down">
                <ChevronDown size={13} color="var(--key-deep)" />
              </button>
            </div>

            <div className="gb-mid">
              <div className="gb-startsel">
                <button className="pill-key" data-gb-act="select" onClick={() => handleAction('select')}>
                  <span className="cap-el" /><span>SELECT</span>
                </button>
                <button className="pill-key" data-gb-act="start" onClick={() => handleAction('start')}>
                  <span className="cap-el" /><span>START</span>
                </button>
              </div>
            </div>

            <div className="gb-ab-cluster">
              <div style={{ textAlign: 'center' }}>
                <button className="ab-key" data-gb-act="b" onClick={() => handleAction('b')}>B</button>
                <span className="ab-label">BACK</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button className="ab-key lifted" data-gb-act="a" onClick={() => handleAction('a')}>A</button>
                <span className="ab-label">LOG</span>
              </div>
            </div>
          </div>

          <div className="gb-speaker"><i /><i /><i /><i /><i /></div>
        </div>
      </div>
    </div>
  );
}
