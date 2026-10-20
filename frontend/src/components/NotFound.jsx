import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <div>
        <h1>Page not found</h1>
        <Link to="/">Back to menu</Link>
      </div>
    </div>
  );
}

