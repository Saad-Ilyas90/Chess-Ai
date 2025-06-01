import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import AppBar from 'material-ui/AppBar';
import IconMenu from 'material-ui/IconMenu';
import IconButton from 'material-ui/IconButton';
import MenuItem from 'material-ui/MenuItem';
import NavigationMoreVert from 'material-ui/svg-icons/navigation/more-vert';
import LinearProgress from 'material-ui/LinearProgress';
import Chip from 'material-ui/Chip';
import Avatar from 'material-ui/Avatar';
import Badge from 'material-ui/Badge';

class Header extends Component {
    handleBackNavigation = () => {
        // Check if user is in an active game
        if (this.props.gameMode) {
            // Show confirmation dialog with warning
            const gameType = this.props.gameMode || 'singleplayer';
            const leaveMessage = gameType === 'multiplayer' ? 
                'You are in an active multiplayer game. If you leave now, you will forfeit the match. Are you sure you want to leave?' :
                'You are in an active game. If you leave now, your progress will be lost. Are you sure you want to leave?';
                
            const shouldLeave = window.confirm(leaveMessage);
            
            if (shouldLeave) {
                // User confirmed they want to leave the game
                if (window.chessAIApp && typeof window.chessAIApp.showLandingPage === 'function') {
                    // Set game as inactive
                    if (window.chessAIApp) {
                        window.chessAIApp.inActiveGame = false;
                        window.chessAIApp.gameType = null;
                    }
                    
                    // Call the function to show landing page
                    window.chessAIApp.showLandingPage(true);
                    
                    // Also try setting the active tab to home
                    if (window.chessAIApp && window.chessAIApp.setActiveTab) {
                        window.chessAIApp.setActiveTab('home');
                    }
                    
                    // Reload entire page if exiting multiplayer
                    if (gameType === 'multiplayer') {
                        window.location.reload();
                    } else {
                        this.props.history.push('/');
                    }
                } else {
                    // Fallback if the global function isn't available
                    this.props.history.push('/');
                }
            }
        } else {
            // No active game, just navigate back
            this.props.history.push('/');
        }
    }

    render() {
        const { gameMode, gameId, currentUser, isGuest, onSignOut, onOpenFriends, onOpenUserProfile, onNewGameClick, onAnalysisClick, friendRequestCount, hideUserIcons } = this.props;
        const isAIMode = gameMode === 'ai';
        
        const styles = {
            chip: {
                margin: 4,
                height: 28,
                backgroundColor: '#f5f5f5',
                marginRight: 10
            },
            chipLabel: {
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#666'
            },
            userSection: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            },
            avatar: {
                width: 32,
                height: 32
            },
            userName: {
                fontSize: '14px',
                color: '#333',
                marginRight: '10px'
            }
        };

        const userSection = (!hideUserIcons && currentUser) ? (
            <div style={styles.userSection}>
                {!isGuest && (
                    <div>
                        <Badge
                            badgeContent={friendRequestCount || 0}
                            primary={true}
                            badgeStyle={{ display: friendRequestCount > 0 ? 'block' : 'none' }}
                        >
                            <IconButton 
                                title="Friends" 
                                onClick={() => this.props.history.push('/friends')}
                            >
                                <span style={{ fontSize: '18px' }}>👥</span>
                            </IconButton>
                        </Badge>
                        
                        <IconButton 
                            title="Profile" 
                            onClick={() => this.props.history.push('/profile')}
                        >
                            {currentUser.photoURL ? (
                                <Avatar 
                                    src={currentUser.photoURL} 
                                    size={32}
                                    style={styles.avatar}
                                />
                            ) : (
                                <Avatar 
                                    size={32}
                                    style={styles.avatar}
                                >
                                    {(currentUser.displayName || 'U').charAt(0)}
                                </Avatar>
                            )}
                        </IconButton>
                    </div>
                )}
                
                <span style={styles.userName}>
                    {currentUser.displayName}{isGuest && ' (Guest)'}
                </span>
                
                <IconMenu
                    iconButtonElement={<IconButton><NavigationMoreVert /></IconButton>}
                    anchorOrigin={{horizontal: 'right', vertical: 'top'}}
                    targetOrigin={{horizontal: 'right', vertical: 'top'}}
                >
                    {!isGuest && (
                        <MenuItem 
                            primaryText="Profile" 
                            onClick={() => this.props.history.push('/profile')}
                        />
                    )}
                    {!isGuest && (
                        <MenuItem 
                            primaryText="Friends" 
                            onClick={() => this.props.history.push('/friends')}
                        />
                    )}
                    <MenuItem 
                        primaryText="Sign Out" 
                        onClick={onSignOut}
                    />
                </IconMenu>
            </div>
        ) : null;

        const rightButtons = (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {/* In multiplayer mode, only show game ID and the dialog button */}
                {gameMode === 'multiplayer' && (
                    <div>
                        {gameId && (
                            <Chip
                              style={styles.chip}
                              labelStyle={styles.chipLabel}
                            >
                              Game ID: {gameId}
                            </Chip>
                        )}
                        
                        {/* Only rectangular dialog box icon in multiplayer mode */}
                        <IconButton title="Game Dialog" onClick={onNewGameClick}>
                            <svg width="24" height="24" viewBox="0 0 24 24">
                                <path d="M3,3H21V21H3V3M5,5V19H19V5H5Z" fill="#e0c9a6" />
                            </svg>
                        </IconButton>
                    </div>
                )}
                
                {/* Only show these buttons in AI mode */}
                {isAIMode && (
                    <IconButton title="New Game" onClick={onNewGameClick}>
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <path d="M3,3H21V21H3V3M5,5V12H12V19H19V12H12V5H5Z" fill="#e0c9a6" />
                        </svg>
                    </IconButton>
                )}
                
                {isAIMode && (
                    <IconButton title="AI Settings" onClick={onAnalysisClick}>
                        <svg width="24" height="24" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <path d="M0,15.089434 C0,16.3335929 5.13666091,24.1788679 14.9348958,24.1788679 C24.7325019,24.1788679 29.8697917,16.3335929 29.8697917,15.089434 C29.8697917,13.8456167 24.7325019,6 14.9348958,6 C5.13666091,6 0,13.8456167 0,15.089434 Z" id="outline"></path>
                                <mask id="mask">
                                    <rect width="100%" height="100%" fill="#ffffff"></rect>
                                    <use href="#outline" id="lid" fill="black" />
                                </mask>
                            </defs>
                            <g id="eye">
                                <path d="M0,15.089434 C0,16.3335929 5.13666091,24.1788679 14.9348958,24.1788679 C24.7325019,24.1788679 29.8697917,16.3335929 29.8697917,15.089434 C29.8697917,13.8456167 24.7325019,6 14.9348958,6 C5.13666091,6 0,13.8456167 0,15.089434 Z M14.9348958,22.081464 C11.2690863,22.081464 8.29688487,18.9510766 8.29688487,15.089434 C8.29688487,11.2277914 11.2690863,8.09740397 14.9348958,8.09740397 C18.6007053,8.09740397 21.5725924,11.2277914 21.5725924,15.089434 C21.5725924,18.9510766 18.6007053,22.081464 14.9348958,22.081464 L14.9348958,22.081464 Z M18.2535869,15.089434 C18.2535869,17.0200844 16.7673289,18.5857907 14.9348958,18.5857907 C13.1018339,18.5857907 11.6162048,17.0200844 11.6162048,15.089434 C11.6162048,13.1587835 13.1018339,11.593419 14.9348958,11.593419 C15.9253152,11.593419 14.3271242,14.3639878 14.9348958,15.089434 C15.451486,15.7055336 18.2535869,14.2027016 18.2535869,15.089434 L18.2535869,15.089434 Z" fill="#333"></path>
                                <use href="#outline" mask="url(#mask)" fill="#333" />
                            </g>
                        </svg>
                    </IconButton>
                )}
                
                {/* Only show user section if not in multiplayer mode */}
                {gameMode !== 'multiplayer' && userSection}
            </div>
        );

        return (<div>
          <AppBar
            style={{ backgroundColor: 'rgba(93, 64, 55, 0.95)' }}
            zDepth={0}
            iconElementLeft={<span />}
            iconElementRight={rightButtons}
            title={
              <div 
                onClick={this.handleBackNavigation}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center',
                  backgroundColor: 'rgba(93, 64, 55, 0.95)',
                  padding: '0 12px',
                  height: '36px'
                }}
              >
                <span style={{ fontSize: '26px', color: '#e0c9a6', marginRight: '-17px', marginTop: '-14px' }}>♚</span>
                <div style={{ 
                  fontFamily: 'serif', 
                  fontSize: '26px',
                  fontWeight: 'bold', 
                  color: '#e0c9a6',
                  letterSpacing: '-2px',
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: '-10px'
                }}>
                  CHE
                </div>
                <div style={{ display: 'flex', marginLeft: '-10px', marginTop: '-2px' }}>
                  <span style={{ fontSize: '26px', color: '#e0c9a6', marginRight: '-25px', transform: 'scaleX(-1)' }}>♘</span>
                  <span style={{ fontSize: '26px', color: '#e0c9a6', transform: 'scaleX(-1)' }}>♘</span>
                </div>
              </div>
            }
            titleStyle={{ height: 'auto', lineHeight: 'normal', padding: '8px 0' }}
          />
          <LinearProgress id="thinking-bar" style={{backgroundColor:"#333"}} mode="indeterminate"> </LinearProgress>
        </div>
        )
    }
}

export default withRouter(Header);