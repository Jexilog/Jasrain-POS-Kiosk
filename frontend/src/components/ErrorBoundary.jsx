import React from 'react';

// shows a recovery screen instead of a blank page when something crashes
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <h1>Something went wrong</h1>
          <p>Please tap the button to restart.</p>
          <button
            style={{ padding: '12px 24px', fontSize: 18, cursor: 'pointer' }}
            onClick={() => window.location.assign('/')}
          >
            Restart
          </button>
        </div>
      </div>
    );
  }
}
