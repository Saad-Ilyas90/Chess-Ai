import './App.css';
import React, { Component } from 'react';
import darkBaseTheme from 'material-ui/styles/baseThemes/darkBaseTheme';
import Header from './Header.js';
import Footer from './Footer.js';
import ChessBoard from './ChessBoard.js';
import ChessBoardMultiplayer from './ChessBoardMultiplayer.js';
import { WindowResizeListener } from 'react-window-resize-listener'
import Dialog from 'material-ui/Dialog';
import {fenToBoard} from './Fen.js';
import FlatButton from 'material-ui/FlatButton';
import Slider from 'material-ui/Slider';
import Analysis from './Analysis.js';
import MultiplayerAnalysis from './MultiplayerAnalysis.js';
import GameModeDialog from './GameModeDialog';
import Timer from './Timer.js';
import Chat from './Chat.js';
import FriendsPanel from './Friends/FriendsPanel.js';
import UserProfile from './Profile/UserProfile.js';
// Firebase services
import { 
  createGameSession, 
  joinGame, 
  listenToGameChanges, 
  updateGameState, 
  checkGameExists,
  getGameData,
  updatePlayerTimer,
  declareTimeoutWin,
  getUserNotifications,
  firestore
} from './firebase';

// Use require for Chess because it uses CommonJS export
const Chess = require('./chess.js').Chess;
let startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let sf = null;

function resized(w, h) {
  if (w < 700) {
    var elements = document.getElementsByClassName('seperator');
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      element.style.marginTop = ((-31.0 / 200.0) * w + (1443.0 / 200.0)) + "px";
    }
    elements = document.getElementsByClassName('chess-board');
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      element.style.fontSize = ((1.0 / 8.0) * w - (5.0 / 8.0)) + "px";
    }
    element = document.getElementById('graves');
    element.style.marginTop = ((-137.0/300.0) * w + 337.0)+"px";
  }
}

class App extends Component {

  constructor(props) {
    super(props);
    
    // Check if we have a saved position in session storage
    let savedPosition = null;
    try {
      const posStr = sessionStorage.getItem('lockedPosition');
      if (posStr) {
        savedPosition = parseInt(posStr);
      }
    } catch (e) {
      console.error("Error reading from session storage:", e);
    }
    
    this.state = {
      boardIndex: 0,
      newGameDiaOpen: false,
      intelligenceDiaOpen: false,
      gameModeDialogOpen: false,
      analysisConfirmationOpen: false,
      analysisOpen: false,
      gameOver: false,
      isReviewingPosition: false,
      positionLocked: false,
      savedPosition: savedPosition,
      historicalStates: [startFen],
      intelligenceLevel: localStorage.getItem("intelligenceLevel") ? localStorage.getItem("intelligenceLevel") : "10",
      // Multiplayer states
      gameMode: 'ai',
      userColor: 'w',
      gameId: null,
      isWaitingForOpponent: false,
      opponent: null,
      opponentSelectedPiece: null,
      isSecondPlayer: false,
      // Timer states
      timeControl: 'none',
      whiteTimeRemaining: 0,
      blackTimeRemaining: 0,
      activePlayer: 'w',
      // UI states for friends and profile
      showFriendsPanel: false,
      showUserProfile: false,
      friendRequestCount: 0
    };
  }

  componentDidMount() {
    // Get the intelligence level from localStorage
    let savedLevel = localStorage.getItem("intelligenceLevel");
    if (savedLevel != null) {
      this.setState({ intelligenceLevel: savedLevel });
    }
    
    // Add event listener for analysis popup
    window.addEventListener('show-analysis-confirmation', this.showAnalysisConfirmation);
    
    // For existing games, we want to listen for changes if in multiplayer mode
    if (this.state.gameMode === 'multiplayer' && this.state.gameId) {
      this.setupGameListener();
    }
    
    // Open the game mode dialog automatically when the app starts
    this.setState({ gameModeDialogOpen: true });
  }

  componentWillUnmount() {
    // Clean up any listeners
    if (this.gameListener) {
      this.gameListener();
    }
    
    if (this.notificationListener) {
      this.notificationListener();
    }
    
    // Remove event listener for analysis popup
    window.removeEventListener('show-analysis-confirmation', this.showAnalysisConfirmation);
  }

  setupGameListener = () => {
    // Stop any existing listener
    if (this.gameListener) {
      this.gameListener();
      this.gameListener = null;
    }

    // Set up a new listener
    if (this.state.gameId) {
      console.log(`Setting up game listener for game ID: ${this.state.gameId}, user color: ${this.state.userColor}`);
      
      this.gameListener = listenToGameChanges(this.state.gameId, (gameData) => {
        if (!gameData) {
          console.log("No game data received");
          return;
        }
        
        console.log("Game data received:", gameData);
        
        // If position is locked, don't update the board position at all
        if (this.state.positionLocked) {
          console.log("Position locked, ignoring board update");
          return;
        }
        
        // If we're reviewing a position in analysis mode, don't update the board
        if (this.state.isReviewingPosition) {
          console.log("Reviewing position, ignoring board update");
          return;
        }
        
        // Check if opponent joined - set isWaitingForOpponent to false
        const opponentColor = this.state.userColor === 'w' ? 'b' : 'w';
        
        // Log players data for debugging
        console.log(`[setupGameListener] Current players data:`, gameData.players || 'No players data');
        console.log(`[setupGameListener] Looking for opponent color: ${opponentColor}`);
        console.log(`[setupGameListener] Current waiting state: ${this.state.isWaitingForOpponent}`);
        
        // Check if both players have joined
        const bothPlayersJoined = gameData.players && 
                                 gameData.players.w && 
                                 gameData.players.b;
                                 
        if (bothPlayersJoined) {
          console.log(`[setupGameListener] Both players have joined the game`);
          
          if (this.state.isWaitingForOpponent) {
            console.log(`[setupGameListener] Updating state: no longer waiting for opponent`);
            this.setState({ 
              isWaitingForOpponent: false,
              opponent: gameData.players[opponentColor]
            });
          }
        } else if (gameData.players && gameData.players[opponentColor]) {
          console.log(`[setupGameListener] Opponent (${opponentColor}) has joined the game`);
          
          if (this.state.isWaitingForOpponent) {
            console.log(`[setupGameListener] Updating state: no longer waiting for opponent`);
            this.setState({ 
              isWaitingForOpponent: false,
              opponent: gameData.players[opponentColor]
            });
          }
        }
        
        // Only update board if the FEN is different from our current one
        if (gameData.fen && this.state.historicalStates[this.state.boardIndex] !== gameData.fen) {
          // Create a clean copy of the historicalStates array up to the current boardIndex
          const historicalStates = this.state.historicalStates.slice(0, this.state.boardIndex + 1);
          
          // Add the new state if it's not already the last one
          if (historicalStates[historicalStates.length - 1] !== gameData.fen) {
            historicalStates.push(gameData.fen);
          }
          
          // Check if the game just ended based on opponent's move
          const gameJustEnded = !this.state.gameOver && gameData.gameOver;
          
          this.setState({
            historicalStates: historicalStates,
            boardIndex: historicalStates.length - 1,
            gameOver: gameData.gameOver || false
          });
          
          // If game just ended based on opponent's move, verify the checkmate locally
          if (gameJustEnded) {
            if (gameData.gameOverReason === 'timeout') {
              // Handle timeout game over
              const winner = gameData.winner;
              const loser = winner === 'w' ? 'b' : 'w';
              if (this.state.userColor === loser) {
                setTimeout(() => {
                  alert('You lost on time!');
                  // Show analysis confirmation
                  this.setState({ analysisConfirmationOpen: true });
                }, 500);
              }
            } else {
              // Handle checkmate game over
            const chess = new Chess(gameData.fen);
            if (chess.in_checkmate()) {
              const loser = chess.turn();
              // If this player is the loser, show the popup
              if (loser === this.state.userColor) {
                setTimeout(() => {
                  alert('Checkmate! You lost!');
                  // Show analysis confirmation
                  this.setState({ analysisConfirmationOpen: true });
                }, 500);
              }
            }
          }
          }
        }
        
        // Update timer information if available
        if (gameData.timers && gameData.timeControl !== 'none') {
          this.setState({
            whiteTimeRemaining: gameData.timers.w,
            blackTimeRemaining: gameData.timers.b,
            activePlayer: gameData.activePlayer || 'w',
            timeControl: gameData.timeControl
          });
        }
        
        // Track opponent's selected piece
        const currentSelectedPiece = this.state.opponentSelectedPiece;
        const newSelectedPiece = gameData.selectedPiece !== undefined ? gameData.selectedPiece : null;
        
        if (currentSelectedPiece !== newSelectedPiece) {
          console.log("Opponent selected piece updated:", newSelectedPiece);
          this.setState({ opponentSelectedPiece: newSelectedPiece });
        }
      });
    }
  }

  handleTimeUpdate = async (color, timeRemaining) => {
    if (this.state.gameMode === 'multiplayer' && this.state.gameId && !this.state.gameOver) {
      try {
        // Update the timer in Firebase
        await updatePlayerTimer(this.state.gameId, color, timeRemaining);
        
        // If time ran out, update game state
        if (timeRemaining <= 0) {
          const winnerColor = color === 'w' ? 'b' : 'w';
          await declareTimeoutWin(this.state.gameId, winnerColor);
          
          if (this.state.userColor === winnerColor) {
            setTimeout(() => {
              alert('You won on time!');
              this.setState({ gameOver: true });
              // Show analysis confirmation
              this.setState({ analysisConfirmationOpen: true });
            }, 500);
          }
        }
      } catch (error) {
        console.error("Error updating timer:", error);
      }
    }
  }

  requestCloseNewGame = () => {
    this.setState({ newGameDiaOpen: false });
  };
  
  requestOpenNewGame = () => {
    // Clean up any existing game state before opening the game mode dialog
    
    // Stop any existing Firebase listeners
    if (this.gameListener) {
      this.gameListener();
      this.gameListener = null;
    }
    
    // Reset the game state to ensure clean switching between modes
    this.setState({ 
      isWaitingForOpponent: false,
      analysisOpen: false,
      gameOver: false,
      positionLocked: false,
      isReviewingPosition: false,
      gameModeDialogOpen: true  // Open the game mode dialog with fresh state
    });
  };

  closeGameModeDialog = () => {
    this.setState({ gameModeDialogOpen: false });
  };

  handleGameModeSubmit = async (options) => {
    const { gameMode, joinGame: isJoining, gameId, playerColor, timeControl } = options;
    
    // Always reset game-related states first regardless of mode
    // This ensures clean state transition between game modes
    const baseResetState = {
      gameModeDialogOpen: false,
      analysisOpen: false,
      gameOver: false,
      isReviewingPosition: false,
      positionLocked: false,
      boardIndex: 0,
      historicalStates: [startFen]
    };
    
    // Clean up any listeners from previous games
    if (this.gameListener) {
      this.gameListener();
      this.gameListener = null;
    }
    
    if (gameMode === 'ai') {
      // Remove multiplayer body class for AI mode
      document.body.classList.remove('multiplayer-active');
      
      // Handle AI game mode (existing functionality)
      this.setState({ 
        ...baseResetState,
        gameMode: 'ai',
        userColor: 'w',
        isWaitingForOpponent: false,
        gameId: null,
        opponent: null,
        opponentSelectedPiece: null,
        isSecondPlayer: false,
        timeControl: 'none'
      });
    } else if (gameMode === 'multiplayer') {
      // Add multiplayer body class for auto-scroll prevention
      document.body.classList.add('multiplayer-active');
      try {
        if (isJoining) {
          // Check if game exists
          const gameExists = await checkGameExists(gameId);
          if (!gameExists) {
            alert("Game not found. Please check the game ID and try again.");
            return;
          }

          // Get current game state including selected piece and timer info
          const gameData = await getGameData(gameId);
          const selectedPiece = gameData && gameData.selectedPiece ? gameData.selectedPiece : null;
          
          // Get time control and timer values
          const retrievedTimeControl = gameData && gameData.timeControl ? gameData.timeControl : 'none';
          const whiteTime = gameData && gameData.timers ? gameData.timers.w : parseInt(retrievedTimeControl) * 60;
          const blackTime = gameData && gameData.timers ? gameData.timers.b : parseInt(retrievedTimeControl) * 60;
          const activePlayer = gameData && gameData.activePlayer ? gameData.activePlayer : 'w';

          // Join existing game
          await joinGame(gameId, playerColor);
          
          // Set up listener for the game
          this.setState({
            ...baseResetState,
            gameMode: 'multiplayer',
            userColor: playerColor,
            gameId: gameId,
            historicalStates: [gameData && gameData.fen ? gameData.fen : startFen],
            gameOver: gameData && gameData.gameOver ? gameData.gameOver : false,
            isSecondPlayer: true,
            isWaitingForOpponent: false,
            opponentSelectedPiece: selectedPiece,
            timeControl: retrievedTimeControl,
            whiteTimeRemaining: whiteTime,
            blackTimeRemaining: blackTime,
            activePlayer: activePlayer
          }, this.setupGameListener);
        } else {
          // Set time in seconds for both players
          const timeInSeconds = timeControl === 'none' ? 0 : parseInt(timeControl) * 60;
          
          // Create new game session with time control
          await createGameSession(gameId, startFen, timeControl);
          await joinGame(gameId, playerColor);
          
          // Set up listener and show waiting for opponent message
          this.setState({
            ...baseResetState,
            gameMode: 'multiplayer',
            userColor: playerColor,
            gameId: gameId,
            isWaitingForOpponent: true,
            isSecondPlayer: false,
            opponentSelectedPiece: null,
            opponent: null,
            timeControl: timeControl,
            whiteTimeRemaining: timeInSeconds,
            blackTimeRemaining: timeInSeconds,
            activePlayer: 'w'
          }, this.setupGameListener);
        }
      } catch (error) {
        console.error("Error setting up multiplayer game:", error);
        alert("There was an error connecting to the multiplayer service. Please try again.");
      }
    }
  };

  getFallenOnes = () => {
    // Check if we have valid historical states
    if (!this.state.historicalStates || 
        this.state.boardIndex < 0 || 
        this.state.boardIndex >= this.state.historicalStates.length ||
        !this.state.historicalStates[this.state.boardIndex]) {
      return ""; // Return empty string if no valid state exists
    }
    
    var orig = "tJnWlNjTOoOoOoOoZ+Z+Z+Z++Z+Z+Z+ZZ+Z+Z+Z++Z+Z+Z+ZpPpPpPpPRhBqKbHr".toLowerCase();
    var curr = fenToBoard(this.state.historicalStates[this.state.boardIndex]).toLowerCase();
    orig = orig.replace(/z/g,"");
    orig = orig.replace(/\+/g,"");
    curr = curr.replace(/z/g,"");
    curr = curr.replace(/\+/g,"");
    orig = orig.split("");
    curr = curr.split("");
    for(let i = 0;i<curr.length;i++){
      if(orig.includes(curr[i]))
        orig.splice(orig.indexOf(curr[i]),1)
    }
    return orig.join("");
  }

  handleChessMove = async (fen, gameOver = false) => {
    // Create a clean copy of the historicalStates array up to the current boardIndex
    const historicalStates = this.state.historicalStates.slice(0, this.state.boardIndex + 1);
    
    // Add the new position if it's not already the last one
    if (historicalStates[historicalStates.length - 1] !== fen) {
      historicalStates.push(fen);
    }
    
    // Parse the FEN to determine whose turn it is next
    const parts = fen.split(' ');
    const nextPlayer = parts[1] === 'w' ? 'w' : 'b';
    
    this.setState({ 
      boardIndex: historicalStates.length - 1, 
      historicalStates: historicalStates,
      gameOver: gameOver,
      activePlayer: nextPlayer
    });
    
    // In multiplayer mode, update the Firebase database
    if (this.state.gameMode === 'multiplayer' && this.state.gameId) {
      try {
        await updateGameState(this.state.gameId, fen, gameOver, nextPlayer);
      } catch (error) {
        console.error("Error updating game state:", error);
      }
    }
    
    // Show analysis confirmation when game is over in any game mode
    if (gameOver) {
      this.setState({ analysisConfirmationOpen: true });
    }
    
    this.getFallenOnes();
  }

  requestCloseIntelligenceDia = () => {
    this.setState({ intelligenceDiaOpen: false });
  };
  requestOpenIntelligenceDia = () => {
    this.setState({ intelligenceDiaOpen: true });
  }
  onChangeIntelligenceLevel = (event, value) => {
    localStorage.setItem("intelligenceLevel", `${value}`);
    this.setState({ intelligenceLevel: `${value}` });
  }
  handleGotoPreviousState = () => {
    if (this.state.boardIndex > 0) {
      // Use our lockBoardPosition method to ensure the position stays fixed
      this.lockBoardPosition(this.state.boardIndex - 1);
    }
  }
  handlePlayForHuman = () => {
    // Only allow AI to play for human in AI mode
    if (this.state.gameMode !== 'ai') {
      return;
    }
    
    if (sf == null) {
      sf = eval('stockfish');
    }
    sf.postMessage(`position fen ${this.state.historicalStates[this.state.boardIndex]}`);
    sf.postMessage(`go depth ${this.state.intelligenceLevel}`);
    this.state.historicalStates = this.state.historicalStates.slice(0, this.state.boardIndex + 1);
  }
  handleGotoNextState = () => {
    if (this.state.boardIndex < this.state.historicalStates.length - 1) {
      // Use our lockBoardPosition method to ensure the position stays fixed
      this.lockBoardPosition(this.state.boardIndex + 1);
    }
  }
  requestCreateNewGame = () => {
    // Instead of creating a game directly, we'll open the game mode dialog
    this.setState({ 
      newGameDiaOpen: false, 
      gameModeDialogOpen: true
    });
  }

  closeAnalysisConfirmation = () => {
    this.setState({ analysisConfirmationOpen: false });
  }
  
  showAnalysisConfirmation = () => {
    this.setState({ analysisConfirmationOpen: true });
  }
  
  showAnalysis = () => {
    this.setState({ 
      analysisConfirmationOpen: false,
      analysisOpen: true 
    });
  }
  
  closeAnalysis = () => {
    // When closing analysis, we need to determine if this is a temporary close or a real close
    
    // If we're in review mode, it's likely a temporary close to show a position
    if (this.state.isReviewingPosition) {
      console.log("Temporarily closing analysis dialog to show position");
      this.setState({ 
        analysisOpen: false,
      });
      return;
    }
    
    // Otherwise, this is a permanent close, so reset everything
    if (this.state.historicalStates.length > 0) {
      this.setState({ 
        analysisOpen: false,
        isReviewingPosition: false,
        boardIndex: this.state.historicalStates.length - 1
      }, () => {
        // Restart Firebase listeners ONLY after analysis is closed
        if (this.state.gameMode === 'multiplayer' && this.state.gameId) {
          console.log("Restarting Firebase listeners after analysis");
          this.setupGameListener();
        }
      });
    } else {
      this.setState({ 
        analysisOpen: false,
        isReviewingPosition: false
      });
    }
  }
  
  lockBoardPosition = (index) => {
    // Set the board index and lock it from being changed by listeners
    console.log(`Locking board position at index ${index}`);
    
    this.setState({
      boardIndex: index,
      isReviewingPosition: true,
      positionLocked: true // Add this flag to completely lock the position
    });
    
    // Store this state in session storage as well for extra persistence
    try {
      sessionStorage.setItem('lockedPosition', index.toString());
    } catch (e) {
      console.error("Could not save position to session storage:", e);
    }
  }
  
  jumpToPosition = (index) => {
    console.log('App: Setting board index to', index, 'from current', this.state.boardIndex);
    
    // Validate the index
    if (index === undefined || index === null || isNaN(index)) {
      console.error('Invalid index passed to jumpToPosition:', index);
      return;
    }
    
    // Ensure index is within bounds
    const actualIndex = Math.max(0, Math.min(parseInt(index, 10), this.state.historicalStates.length - 1));
    console.log('Using validated index:', actualIndex);
    
    // Disable all Firebase listeners temporarily
    if (this.gameListener) {
      console.log("Disabling Firebase listeners to prevent auto-resets");
      this.gameListener();
      this.gameListener = null;
    }
    
    // Set the board index directly without any listener complications
    this.setState({ 
      boardIndex: actualIndex,
      isReviewingPosition: true,
      // Analysis dialog is closed temporarily, will be reopened by the child component
      analysisOpen: false
    });
    
    // Reopen the analysis dialog after a delay to let the board render
    setTimeout(() => {
      this.setState({ analysisOpen: true });
    }, 2500); // Increased from 800ms to 2500ms (2.5 seconds)
    
    // Don't restart listeners - this is key to preventing auto-resets
  }

  // Add a method to exit review mode
  exitReviewMode = () => {
    // Return to the final position when exiting review mode
    if (this.state.historicalStates.length > 0) {
      this.setState({
        boardIndex: this.state.historicalStates.length - 1,
        isReviewingPosition: false
      });
    }
  }

  renderChessBoard() {
    // Use the appropriate chess board component based on game mode
    if (this.state.gameMode === 'multiplayer') {
      return (
        <ChessBoardMultiplayer 
          onMove={this.handleChessMove}
          board={this.state.historicalStates[this.state.boardIndex]}
          userColor={this.state.userColor}
          gameId={this.state.gameId}
          opponentSelectedPiece={this.state.opponentSelectedPiece}
          isSecondPlayer={this.state.isSecondPlayer}
        />
      );
    } else {
      // Default to AI mode
      return (
        <ChessBoard 
          onMove={this.handleChessMove}
          intelligenceLevel={this.state.intelligenceLevel}
          board={this.state.historicalStates[this.state.boardIndex]}
          userColor={this.state.userColor}
        />
      );
    }
  }

  renderTimers() {
    // Only render timers in multiplayer mode with time control enabled
    if (this.state.gameMode === 'multiplayer' && this.state.timeControl !== 'none') {
      const { userColor, activePlayer, whiteTimeRemaining, blackTimeRemaining, gameOver } = this.state;
      
      return (
        <div className="timers-container">
          {/* When userColor is white, white pieces are at bottom, black at top */}
          {/* When userColor is black, black pieces are at bottom, white at top */}
          
          {/* Top-left timer (opponent's timer) */}
          <div className="side-timer-container top-left">
            <Timer 
              initialTime={this.state.timeControl}
              timeLeft={userColor === 'w' ? blackTimeRemaining : whiteTimeRemaining}
              isActive={(userColor === 'w' ? activePlayer === 'b' : activePlayer === 'w') && !gameOver}
              playerName={userColor === 'w' ? 'Opponent (Black)' : 'Opponent (White)'}
              onTimeUpdate={(time) => userColor === 'b' && this.handleTimeUpdate('w', time) || userColor === 'w' && this.handleTimeUpdate('b', time)}
              onTimeUp={() => userColor === 'b' && this.handleTimeUpdate('w', 0) || userColor === 'w' && this.handleTimeUpdate('b', 0)}
              className={userColor === 'w' ? 'black-timer' : 'white-timer'}
            />
          </div>
          
          {/* Bottom-left timer (player's timer) */}
          <div className="side-timer-container bottom-left">
            <Timer 
              initialTime={this.state.timeControl}
              timeLeft={userColor === 'w' ? whiteTimeRemaining : blackTimeRemaining}
              isActive={(userColor === 'w' ? activePlayer === 'w' : activePlayer === 'b') && !gameOver}
              playerName={userColor === 'w' ? 'You (White)' : 'You (Black)'}
              onTimeUpdate={(time) => userColor === 'w' && this.handleTimeUpdate('w', time) || userColor === 'b' && this.handleTimeUpdate('b', time)}
              onTimeUp={() => userColor === 'w' && this.handleTimeUpdate('w', 0) || userColor === 'b' && this.handleTimeUpdate('b', 0)}
              className={userColor === 'w' ? 'white-timer' : 'black-timer'}
            />
          </div>
        </div>
      );
    }
    
    return null;
  }

  render() {
    const { currentUser, isGuest, onSignOut } = this.props;
    
    const newGameActions = [
      <FlatButton label="Cancel" primary={true} style={{ color: '#333' }} onClick={this.requestCloseNewGame} />,
      <FlatButton label="OK" primary={true} style={{ color: '#333' }} onClick={this.requestCreateNewGame} />,
    ];

    const intelligenceActions = [
      <FlatButton label="Cancel" primary={true} style={{ color: '#333' }} onClick={this.requestCloseIntelligenceDia} />,
      <FlatButton label="OK" primary={true} style={{ color: '#333' }} onClick={this.requestCloseIntelligenceDia} />,
    ];
    
    const analysisConfirmationActions = [
      <FlatButton label="No" primary={true} style={{ color: '#333' }} onClick={this.closeAnalysisConfirmation} />,
      <FlatButton label="Yes" primary={true} style={{ color: '#333' }} onClick={this.showAnalysis} />,
    ];

    return (
      <div className="App">
        <div id="thinking-bar"></div>
        <Header 
          requestOpenNewGame={this.requestOpenNewGame} 
          requestOpenIntelligenceDia={this.requestOpenIntelligenceDia} 
          gameMode={this.state.gameMode}
          gameId={this.state.gameId}
          currentUser={currentUser}
          isGuest={isGuest}
          onSignOut={onSignOut}
          onShowFriends={this.handleShowFriends}
          onShowProfile={this.handleShowProfile}
          friendRequestCount={this.state.friendRequestCount}
        />
        <WindowResizeListener onResize={windowSize => { resized(windowSize.windowWidth, windowSize.windowHeight) }} />
        
        {/* Friends and Profile Panels */}
        {this.state.showFriendsPanel && (
          <Dialog
            title="Friends"
            modal={false}
            open={this.state.showFriendsPanel}
            onRequestClose={this.handleClosePanel}
            autoScrollBodyContent={true}
            contentStyle={{ width: '90%', maxWidth: '600px' }}
          >
            <FriendsPanel 
              currentUser={currentUser}
              isGuest={isGuest}
              onGameChallengeAccepted={this.handleGameChallengeAccepted}
            />
          </Dialog>
        )}
        
        {this.state.showUserProfile && (
          <Dialog
            title="Profile"
            modal={false}
            open={this.state.showUserProfile}
            onRequestClose={this.handleClosePanel}
            autoScrollBodyContent={true}
            contentStyle={{ width: '90%', maxWidth: '500px' }}
          >
            <UserProfile 
              currentUser={currentUser}
              isGuest={isGuest}
            />
          </Dialog>
        )}
        
        {this.state.isWaitingForOpponent ? (
          <div className="waiting-message">
            <h2>Waiting for opponent...</h2>
            <p>Share this game ID with your opponent: <strong>{this.state.gameId}</strong></p>
          </div>
        ) : (
          <div className="board-with-timers">
            {this.renderTimers()}
            {this.renderChessBoard()}
            {this.state.gameMode === 'multiplayer' && !this.state.isWaitingForOpponent && (
              <Chat
                gameId={this.state.gameId}
                playerColor={this.state.userColor}
                playerName={`Player (${this.state.userColor === 'w' ? 'White' : 'Black'})`}
              />
            )}
          </div>
        )}
        
        <Dialog title="New Game" actions={newGameActions} modal={false} open={this.state.newGameDiaOpen} onRequestClose={this.handleClose} >
          Start a new game?
        </Dialog>
        
        <GameModeDialog 
          open={this.state.gameModeDialogOpen}
          onClose={this.closeGameModeDialog}
          onSubmit={this.handleGameModeSubmit}
          currentUser={this.props.currentUser}
          isGuest={this.props.isGuest}
        />
        
        <Dialog title="Artificial Intelligence Settings" actions={intelligenceActions} modal={false} open={this.state.intelligenceDiaOpen} onRequestClose={this.requestCloseIntelligenceDia} >
          <div className="label">Depth {this.state.intelligenceLevel}</div>
          <Slider step={1} value={this.state.intelligenceLevel} min={1} max={20} defaultValue={this.state.intelligenceLevel} onChange={this.onChangeIntelligenceLevel} />
        </Dialog>
        
        <Dialog 
          title="Game Analysis" 
          actions={analysisConfirmationActions} 
          modal={false} 
          open={this.state.analysisConfirmationOpen} 
          onRequestClose={this.closeAnalysisConfirmation}
        >
          Would you like to evaluate this game?
        </Dialog>
        
        {this.state.gameMode === 'multiplayer' ? (
          <MultiplayerAnalysis 
            open={this.state.analysisOpen} 
            onClose={this.closeAnalysis}
            historicalStates={this.state.historicalStates}
            onJumpToPosition={this.jumpToPosition}
            playerColor={this.state.userColor}
          />
        ) : (
          <Analysis 
            open={this.state.analysisOpen} 
            onClose={this.closeAnalysis}
            historicalStates={this.state.historicalStates}
            onJumpToPosition={this.jumpToPosition}
            userColor={this.state.userColor}
          />
        )}
        
        <Footer 
          fallenOnes={this.getFallenOnes()} 
          playForHuman={this.handlePlayForHuman} 
          gotoPreviousState={this.handleGotoPreviousState} 
          gotoNextState={this.handleGotoNextState}
          gameMode={this.state.gameMode}
          gameOver={this.state.gameOver}
          showAnalysis={this.showAnalysis}
        />
      </div>
    );
  }

  // Friends and Profile UI methods
  handleShowFriends = () => {
    this.setState({ showFriendsPanel: true, showUserProfile: false });
  }

  handleShowProfile = () => {
    this.setState({ showUserProfile: true, showFriendsPanel: false });
  }

  handleClosePanel = () => {
    this.setState({ showFriendsPanel: false, showUserProfile: false });
  }
  
  handleGameChallengeAccepted = async (gameId, playerColor = 'w') => {
    // Close the friends panel
    console.log('[handleGameChallengeAccepted] Received gameId:', gameId, 'playerColor:', playerColor);
    
    try {
      // Get current game state
      const gameData = await getGameData(gameId);
      console.log('[handleGameChallengeAccepted] Game data:', gameData);
      
      if (!gameData) {
        console.error('[handleGameChallengeAccepted] No game data found for ID:', gameId);
        alert('Error: Could not find the game. Please try again.');
        return;
      }
      
      // Only join the game if we haven't already (when accepting a challenge)
      // If we're the creator (from handleDirectChallenge), we've already joined
      const opponentColor = playerColor === 'w' ? 'b' : 'w';
      let hasPlayerJoined = gameData.players && gameData.players[playerColor];
      let hasOpponentJoined = gameData.players && gameData.players[opponentColor];
      
      console.log('[handleGameChallengeAccepted] Player color:', playerColor);
      console.log('[handleGameChallengeAccepted] Opponent color:', opponentColor);
      console.log('[handleGameChallengeAccepted] Has player joined:', hasPlayerJoined);
      console.log('[handleGameChallengeAccepted] Has opponent joined:', hasOpponentJoined);
      
      // If this player hasn't joined yet, join the game
      if (!hasPlayerJoined) {
        await joinGame(gameId, playerColor);
        console.log(`[handleGameChallengeAccepted] Successfully joined game as ${playerColor === 'w' ? 'white' : 'black'} player`);
        hasPlayerJoined = true;
      } else {
        console.log(`[handleGameChallengeAccepted] Already joined as ${playerColor === 'w' ? 'white' : 'black'} player`);
      }
      
      // Fetch updated game data after joining with a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      const updatedGameData = await getGameData(gameId);
      console.log('[handleGameChallengeAccepted] Updated game data after joining:', updatedGameData);
      
      // Update the opponent joined status based on the refreshed data
      hasOpponentJoined = updatedGameData.players && updatedGameData.players[opponentColor];
      console.log('[handleGameChallengeAccepted] Updated opponent joined status:', hasOpponentJoined);
      
      // Get time control and timer values
      const retrievedTimeControl = updatedGameData.timeControl || 'none';
      const whiteTime = updatedGameData.timers ? updatedGameData.timers.w : (retrievedTimeControl !== 'none' ? parseInt(retrievedTimeControl) * 60 : 0);
      const blackTime = updatedGameData.timers ? updatedGameData.timers.b : (retrievedTimeControl !== 'none' ? parseInt(retrievedTimeControl) * 60 : 0);
      const activePlayer = updatedGameData.activePlayer || 'w';
      
      // Start with waiting state false to fix the initial display
      // The game listener will correctly update this if needed
      const isWaitingForOpponent = false;
      console.log('[handleGameChallengeAccepted] Setting initial waiting for opponent state to false');
      
      // Update state and set up game
      this.setState({ 
        showFriendsPanel: false,
        gameId: gameId,
        gameMode: 'multiplayer',
        userColor: playerColor,
        gameOver: updatedGameData.gameOver || false,
        isWaitingForOpponent: isWaitingForOpponent,
        historicalStates: [updatedGameData.fen || startFen],
        boardIndex: 0,
        timeControl: retrievedTimeControl,
        whiteTimeRemaining: whiteTime,
        blackTimeRemaining: blackTime,
        activePlayer: activePlayer
      }, () => {
        console.log('[handleGameChallengeAccepted] State updated with gameId:', this.state.gameId, 'userColor:', this.state.userColor);
        // Set up game listener
        this.setupGameListener();
      });
    } catch (error) {
      console.error('[handleGameChallengeAccepted] Error setting up game:', error);
      alert('Error setting up the game. Please try again.');
    }
  }

  setupNotificationListener = () => {
    const { currentUser, isGuest } = this.props;
    
    if (!currentUser || isGuest) return;

    // Clean up existing listener
    if (this.notificationListener) {
      this.notificationListener();
    }

    this.notificationListener = getUserNotifications(
      currentUser.id,
      (snapshot) => {
        const notifications = [];
        snapshot.forEach((doc) => {
          notifications.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Count friend requests
        const friendRequests = notifications.filter(n => n.type === 'friend_request' && !n.read);
        this.setState({ friendRequestCount: friendRequests.length });
      }
    );
  }

  // Call this when user changes (from AuthWrapper)
  componentDidUpdate(prevProps) {
    const { currentUser, isGuest } = this.props;
    
    // Setup notification listener when user signs in
    if (currentUser && !isGuest && (!prevProps.currentUser || prevProps.isGuest)) {
      this.setupNotificationListener();
    }
    
    // Clean up when user signs out
    if ((!currentUser || isGuest) && prevProps.currentUser && !prevProps.isGuest) {
      if (this.notificationListener) {
        this.notificationListener();
        this.notificationListener = null;
      }
      this.setState({ friendRequestCount: 0 });
    }
  }
}

export default App;
