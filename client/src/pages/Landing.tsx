import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleAction = () => {
    if (user) {
      navigate('/rooms');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="landing-page">
      <header className="navbar">
        <div className="logo">CollabCode</div>
        <nav>
          <a href="#">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>
        <div className="nav-buttons">
          {user ? (
            <button className="join" onClick={() => navigate('/rooms')}>Dashboard</button>
          ) : (
            <>
              <button className="login" onClick={() => navigate('/login')}>Login</button>
              <button className="join" onClick={() => navigate('/register')}>Sign Up</button>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <h1>Code Together. Build Faster.</h1>
        <p>
          A real-time collaborative code editor where developers can
          write, edit, and debug code simultaneously with their team.
          Perfect for pair programming, interviews, and remote learning.
        </p>
        <div className="hero-buttons">
          <button className="primary" onClick={handleAction}>
            Create Room
          </button>
          <button className="secondary" onClick={handleAction}>
            Join Room
          </button>
        </div>
      </section>

      <section className="features" id="features">
        <h2>Powerful Collaboration Features</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>Real-Time Editing</h3>
            <p>Multiple users can write and edit code simultaneously with instant synchronization.</p>
          </div>
          <div className="feature-card">
            <h3>Secure Room Access</h3>
            <p>Join coding sessions using secure room IDs shared by collaborators.</p>
          </div>
          <div className="feature-card">
            <h3>Low Latency Sync</h3>
            <p>Powered by WebSockets to ensure instant code updates across all users.</p>
          </div>
          <div className="feature-card">
            <h3>Browser Based IDE</h3>
            <p>No installation required. Start coding instantly from your browser.</p>
          </div>
          <div className="feature-card">
            <h3>Multi Language Support</h3>
            <p>Supports multiple programming languages with syntax highlighting.</p>
          </div>
          <div className="feature-card">
            <h3>Developer Friendly UI</h3>
            <p>Clean and minimal interface designed for productivity.</p>
          </div>
        </div>
      </section>

      <section className="about" id="about">
        <h2>About the Project</h2>
        <p>
          CollabCode is a real-time collaborative code editor designed
          to help developers and students work together efficiently.
          Using WebSocket communication and modern web technologies,
          the platform ensures instant code synchronization across all
          connected users. The system allows users to create private
          coding rooms and collaborate securely from anywhere.
        </p>
      </section>

      <section className="cta">
        <h2>Start Coding Together Today</h2>
        <button onClick={() => navigate('/rooms')}>
          Create Your Room
        </button>
      </section>

      <footer>
        <p>© 2026 CollabCode | Real-Time Collaborative Code Editor</p>
      </footer>
    </div>
  );
}
