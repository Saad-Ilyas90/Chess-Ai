import React from 'react';
import './LandingPage.css';
import RaisedButton from 'material-ui/RaisedButton';
import Paper from 'material-ui/Paper';

const LandingPage = ({ onStartGame, onSignIn }) => {
  return (
    <div className="landing-page">
      {/* Navigation Header */}
      <header className="landing-header">
        <div className="landing-nav-container">
          <div className="landing-logo-header">
            <span className="landing-logo-icon">♚</span>
            <div className="landing-logo-text">
              <span>C</span>
              <span>H</span>
              <span>E</span>
              <span>S</span>
              <span>S</span>
            </div>
            <span className="landing-logo-knights">
              <span className="landing-logo-knight-left">♘</span>
              <span className="landing-logo-knight-right">♘</span>
            </span>
          </div>
          
          <nav className="landing-nav">
            <a href="#features" className="nav-link">Features</a>
            <a href="#game-modes" className="nav-link">Game Modes</a>
            <a href="#about" className="nav-link">About</a>
            <RaisedButton
              label="Sign In"
              className="nav-button"
              onClick={onSignIn}
              data-testid="signin-button"
            />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">MASTER THE GAME OF CHESS</h1>
          <p className="hero-subtitle">Play, analyze, and improve your skills with our advanced chess platform</p>
          <div className="hero-buttons">
            <RaisedButton
              label="Play Now"
              className="hero-button primary-button"
              onClick={onStartGame}
            />
            <RaisedButton
              label="Watch Tutorial"
              className="hero-button secondary-button"
              onClick={() => {/* To be implemented later */}}
            />
          </div>
        </div>
        <div className="hero-image">
          <div className="chess-board-display">
            <div className="chess-piece-animated king">♔</div>
            <div className="chess-piece-animated queen">♕</div>
            <div className="chess-piece-animated rook">♖</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="section-title-container">
          <h2 className="section-title">FEATURES</h2>
          <div className="section-title-underline"></div>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">♟</div>
            <h3 className="feature-title">Advanced AI</h3>
            <p className="feature-description">Challenge our intelligent chess engine with multiple difficulty levels from beginner to grandmaster</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">♞</div>
            <h3 className="feature-title">Multiplayer</h3>
            <p className="feature-description">Play with friends or match with players worldwide in competitive online matches</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">♝</div>
            <h3 className="feature-title">Game Analysis</h3>
            <p className="feature-description">Review your games move by move with powerful analytical tools to identify mistakes</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">♜</div>
            <h3 className="feature-title">Custom Timers</h3>
            <p className="feature-description">Customize game time controls for casual blitz or serious tournament play</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">♚</div>
            <h3 className="feature-title">User Profiles</h3>
            <p className="feature-description">Track your progress, manage friends, and view your game statistics</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">♛</div>
            <h3 className="feature-title">In-Game Chat</h3>
            <p className="feature-description">Communicate with your opponent during multiplayer games</p>
          </div>
        </div>
      </section>

      {/* Game Modes Section */}
      <section className="game-modes-section" id="game-modes">
        <div className="section-title-container">
          <h2 className="section-title">GAME MODES</h2>
          <div className="section-title-underline"></div>
        </div>
        
        <div className="game-modes-container">
          <div className="game-mode">
            <div className="game-mode-icon-container">
              <div className="game-mode-icon ai-mode">♟</div>
            </div>
            <div className="game-mode-content">
              <h3 className="game-mode-title">Single Player</h3>
              <p className="game-mode-description">Challenge the AI at multiple difficulty levels. Perfect for beginners and grandmasters alike.</p>
              <RaisedButton
                label="Play vs AI"
                className="game-mode-button"
                onClick={onStartGame}
              />
            </div>
          </div>
          
          <div className="game-mode reversed">
            <div className="game-mode-content">
              <h3 className="game-mode-title">Multiplayer</h3>
              <p className="game-mode-description">Challenge friends or random opponents in real-time matches with customizable time controls.</p>
              <RaisedButton
                label="Play Multiplayer"
                className="game-mode-button"
                onClick={onStartGame}
              />
            </div>
            <div className="game-mode-icon-container">
              <div className="game-mode-icon multiplayer-mode">♞</div>
            </div>
          </div>
          
          <div className="game-mode">
            <div className="game-mode-icon-container">
              <div className="game-mode-icon analysis-mode">♝</div>
            </div>
            <div className="game-mode-content">
              <h3 className="game-mode-title">Analysis Mode</h3>
              <p className="game-mode-description">Review your games, analyze positions, and improve your strategy with our powerful analysis tools.</p>
              <RaisedButton
                label="Try Analysis"
                className="game-mode-button"
                onClick={onStartGame}
              />
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section" id="about">
        <div className="section-title-container">
          <h2 className="section-title">ABOUT</h2>
          <div className="section-title-underline"></div>
        </div>
        
        <div className="about-content">
          <p className="about-text">
            Our chess platform provides a comprehensive environment for players of all skill levels. Whether you're a beginner looking to learn the basics or a seasoned player seeking competitive matches, our application offers everything you need to enjoy the royal game.
          </p>
          <p className="about-text">
            Built with modern web technologies, our platform features responsive design, real-time multiplayer functionality, and advanced game analysis tools. Join our community today and start your journey to chess mastery!
          </p>
        </div>
      </section>

      {/* Call to Action */}
      <section className="cta-section">
        <h2 className="cta-title">Ready to play?</h2>
        <p className="cta-subtitle">Join thousands of players worldwide and start your chess journey today</p>
        <div className="cta-buttons">
          <RaisedButton
            label="Play as Guest"
            className="cta-button primary-button"
            onClick={onStartGame}
          />
          <RaisedButton
            label="Create Account"
            className="cta-button secondary-button"
            onClick={onSignIn}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <span className="footer-logo-icon">♚</span>
            <div className="footer-logo-text">
              <span>C</span>
              <span>H</span>
              <span>E</span>
              <span>S</span>
              <span>S</span>
            </div>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Contact Us</a>
          </div>
          <div className="footer-copyright">
            © 2025 Chess Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
