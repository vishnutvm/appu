import React from 'react';

const RELEASES_URL = 'https://github.com/vishnutvm/appu/releases';

/**
 * Shown when the bundle is opened outside Electron (e.g. bare Vite URL).
 * Appu ships as a desktop companion only.
 */
export const DesktopOnlyGate: React.FC = () => (
  <div
    className="desktop-only-gate"
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      background: 'radial-gradient(ellipse at 50% 30%, #1a1d26 0%, #0d0f14 70%)',
      color: '#e8eaef',
      textAlign: 'center',
    }}
  >
    <div style={{ maxWidth: 420 }}>
      <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }} aria-hidden>
        🤖
      </p>
      <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.35rem', fontWeight: 600 }}>Desktop companion only</h1>
      <p style={{ margin: '0 0 1.25rem', lineHeight: 1.55, color: '#aeb4c0' }}>
        Appu runs on your desktop as a floating AI companion — not in the browser. Install a release or run the app
        with Electron from source.
      </p>
      <p style={{ margin: 0, fontSize: '0.9rem', color: '#8b919c' }}>
        From source: <code style={{ color: '#f6c344' }}>npm ci && npm start</code>
        <br />
        <a href={RELEASES_URL} style={{ color: '#f6c344' }}>
          Download from GitHub Releases
        </a>
      </p>
    </div>
  </div>
);
