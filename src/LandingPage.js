import React, { Component } from 'react';
import './LandingPage.css';
import RaisedButton from 'material-ui/RaisedButton';
import FlatButton from 'material-ui/FlatButton';
import Paper from 'material-ui/Paper';
import Avatar from 'material-ui/Avatar';
import Menu from 'material-ui/Menu';
import MenuItem from 'material-ui/MenuItem';
import Popover from 'material-ui/Popover';
import Divider from 'material-ui/Divider';
import {Tabs, Tab} from 'material-ui/Tabs';
import UserProfile from './Profile/UserProfile';
import FriendsPanel from './Friends/FriendsPanel';

class LandingPage extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      profileMenuOpen: false,
      anchorEl: null,
      activeTab: 'home',
      showProfile: false,
      showFriends: false,
      mobileMenuOpen: false
    };
  }
  
  handleProfileClick = (event) => {
    // This prevents ghost click.
    event.preventDefault();
    
    this.setState({
      profileMenuOpen: true,
      anchorEl: event.currentTarget
    });
  };
  
  handleRequestClose = () => {
    this.setState({
      profileMenuOpen: false
    });
  };
  
  handleProfileOptionClick = (action) => {
    this.setState({ profileMenuOpen: false });
    
    // Handle the selected action
    if (action === 'profile') {
      this.setState({ activeTab: 'profile', showProfile: true });
    } else if (action === 'friends') {
      this.setState({ activeTab: 'friends', showFriends: true });
    } else if (action === 'signout') {
      this.props.onSignOut();
    }
  };
  
  handleTabChange = (value) => {
    this.setState({
      activeTab: value,
      showProfile: value === 'profile',
      showFriends: value === 'friends'
    });
  };

  handleMobileMenuToggle = () => {
    this.setState(prevState => ({
      mobileMenuOpen: !prevState.mobileMenuOpen
    }));
  };

  handleNavLinkClick = () => {
    // Close mobile menu when a navigation link is clicked
    this.setState({ mobileMenuOpen: false });
  };
  
  componentDidMount() {
    // Expose the tab change function globally for back button handler
    window.chessAIApp = window.chessAIApp || {};
    window.chessAIApp.setActiveTab = this.handleTabChange;
  }
  render() {
    const { onStartGame, onSignIn, currentUser, onSignOut, isGuest, onGameChallengeAccepted } = this.props;
    const { activeTab, showProfile, showFriends } = this.state;
    
    return (
      <div className="landing-page">
        {/* Tabs for navigation between Home, Profile, and Friends */}
        <Tabs
          value={activeTab}
          onChange={this.handleTabChange}
          className="landing-tabs"
          tabItemContainerStyle={{
            backgroundColor: '#5d4037',
            position: 'fixed',
            width: '100%',
            zIndex: 100,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            justifyContent: 'center',
            height: '48px'
          }}
          inkBarStyle={{ backgroundColor: '#e0c9a6' }}
        >
          <Tab
            label="Home"
            value="home"
            buttonStyle={{ color: '#e0c9a6', fontWeight: 'bold', fontSize: '16px' }}
            style={{ maxWidth: '200px' }}
          />
          {currentUser && (
            <Tab
              label="Profile"
              value="profile"
              buttonStyle={{ color: '#e0c9a6', fontWeight: 'bold', fontSize: '16px' }}
              style={{ maxWidth: '200px' }}
            />
          )}
          {currentUser && (
            <Tab
              label="Friends"
              value="friends"
              buttonStyle={{ color: '#e0c9a6', fontWeight: 'bold', fontSize: '16px' }}
              style={{ maxWidth: '200px' }}
            />
          )}
        </Tabs>
        
        {/* Main content based on active tab */}
        {activeTab === 'profile' && currentUser && (
          <div className="landing-page-content profile-content">
            <div className="profile-header">
              <h2 className="section-title">Your Profile</h2>
              <div className="section-title-underline"></div>
            </div>
            <UserProfile currentUser={currentUser} />
          </div>
        )}
        
        {activeTab === 'friends' && currentUser && (
          <div className="landing-page-content friends-content">
            <div className="friends-header">
              <h2 className="section-title">Friends</h2>
              <div className="section-title-underline"></div>
            </div>
            <FriendsPanel 
              currentUser={currentUser}
              isGuest={isGuest}
              onGameChallengeAccepted={onGameChallengeAccepted}
            />
          </div>
        )}
        
        {/* Only show the landing page content when on home tab */}
        {activeTab === 'home' && (
        <div className="landing-home-content">
        {/* Navigation Header */}
      <header className="landing-header">
        {/* Mobile menu overlay */}
        <div 
          className={`mobile-menu-overlay ${this.state.mobileMenuOpen ? 'active' : ''}`}
          onClick={this.handleNavLinkClick}
        ></div>
        
        <div className="landing-nav-container">
          <div className="landing-logo-header">
            <span className="landing-logo-icon">♚</span>
            <div className="landing-logo-text">
              <span>C</span>
              <span>H</span>
              <span>E</span>
            </div>
            <span className="landing-logo-knights">
              <span className="landing-logo-knight-left">♘</span>
              <span className="landing-logo-knight-right">♘</span>
            </span>
          </div>
          
          {/* Hamburger Menu Button */}
          <button 
            className="hamburger-menu-button"
            onClick={this.handleMobileMenuToggle}
            aria-label="Toggle mobile menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          
          <nav className={`landing-nav ${this.state.mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
            <a href="#features" className="nav-link" onClick={this.handleNavLinkClick}>Features</a>
            <a href="#game-modes" className="nav-link" onClick={this.handleNavLinkClick}>Game Modes</a>
            <a href="#about" className="nav-link" onClick={this.handleNavLinkClick}>About</a>
            {currentUser ? (
              <div className="user-profile-container">
                <FlatButton
                  label={currentUser.displayName || "Profile"}
                  className="nav-button profile-button"
                  onClick={this.handleProfileClick}
                  labelStyle={{ color: '#e0c9a6' }}
                  icon={currentUser.photoURL ? <Avatar src={currentUser.photoURL} size={24} /> : null}
                />
                <Popover
                  open={this.state.profileMenuOpen}
                  anchorEl={this.state.anchorEl}
                  anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
                  targetOrigin={{horizontal: 'right', vertical: 'top'}}
                  onRequestClose={this.handleRequestClose}
                  style={{backgroundColor: '#2d2d2d'}}
                >
                  <div style={{backgroundColor: '#5d4037', padding: '16px', display: 'flex', alignItems: 'center'}}>
                    {currentUser.photoURL ? (
                      <Avatar src={currentUser.photoURL} size={40} style={{marginRight: '10px'}} />
                    ) : (
                      <Avatar size={40} style={{marginRight: '10px'}}>
                        {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                      </Avatar>
                    )}
                    <div>
                      <div style={{color: '#e0c9a6', fontWeight: 'bold'}}>{currentUser.displayName}</div>
                      <div style={{color: '#e0c9a6', fontSize: '12px'}}>{currentUser.email}</div>
                    </div>
                  </div>
                  <Menu width={250} style={{backgroundColor: '#2d2d2d'}}>
                    <MenuItem 
                      primaryText="View Profile" 
                      onClick={() => this.handleProfileOptionClick('profile')} 
                      style={{color: '#e0c9a6'}}
                    />
                    <MenuItem 
                      primaryText="Friends" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleProfileOptionClick('friends');
                      }} 
                      style={{color: '#e0c9a6'}}
                    />
                    <Divider style={{backgroundColor: 'rgba(224, 201, 166, 0.2)'}} />
                    <MenuItem 
                      primaryText="Sign Out" 
                      onClick={() => this.handleProfileOptionClick('signout')} 
                      style={{color: '#e0c9a6'}}
                    />
                  </Menu>
                </Popover>
              </div>
            ) : (
              <RaisedButton
                label="Sign In"
                className="nav-button"
                onClick={onSignIn}
                data-testid="signin-button"
              />
            )}
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
          {!currentUser && (
            <RaisedButton
              label="Create Account"
              className="cta-button secondary-button"
              onClick={onSignIn}
            />
          )}
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
            </div>
            <span className="footer-logo-knights">
              <span className="footer-logo-knight-left">♘</span>
              <span className="footer-logo-knight-right">♘</span>
            </span>
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
        )}
        </div>
    );
  }
}

export default LandingPage;
