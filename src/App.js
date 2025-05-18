import './App.css';
import React, { Component } from 'react';
import darkBaseTheme from 'material-ui/styles/baseThemes/darkBaseTheme';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
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
// Firebase services
import { 
  createGameSession, 
  joinGame, 
  listenToGameChanges, 
  updateGameState, 
  checkGameExists,
  getGameData
} from './firebase';

// Use require for Chess because it uses CommonJS export
const Chess = require('./chess.js').Chess;
let startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let sf = null;

const chessLight = getMuiTheme({
  palette: {
    primary1Color: 'white',
    textColor: '#333',
  },
  appBar: {
    textColor: '#333',
  },
  slider: {
    trackColor: '#aaa',
    selectionColor: '#333'
  },
});

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
      isSecondPlayer: false
    };
  }

  componentDidMount() {
    // For existing games, we want to listen for changes if in multiplayer mode
    if (this.state.gameMode === 'multiplayer' && this.state.gameId) {
      this.setupGameListener();
    }
    
    // Open the game mode dialog automatically when the app starts
    this.setState({ gameModeDialogOpen: true });
  }

  componentWillUnmount() {
    // Clean up Firebase listeners if any
    if (this.gameListener) {
      this.gameListener();
      this.gameListener = null;
    }
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
        if (gameData.players && gameData.players[opponentColor]) {
          console.log(`Opponent (${opponentColor}) has joined the game`);
          if (this.state.isWaitingForOpponent) {
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
    const { gameMode, joinGame: isJoining, gameId, playerColor } = options;
    
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
      // Handle AI game mode (existing functionality)
      this.setState({ 
        ...baseResetState,
        gameMode: 'ai',
        userColor: 'w',
        isWaitingForOpponent: false,
        gameId: null,
        opponent: null,
        opponentSelectedPiece: null,
        isSecondPlayer: false
      });
    } else if (gameMode === 'multiplayer') {
      // Handle multiplayer game mode
      try {
        if (isJoining) {
          // Check if game exists
          const gameExists = await checkGameExists(gameId);
          if (!gameExists) {
            alert("Game not found. Please check the game ID and try again.");
            return;
          }

          // Get current game state including selected piece
          const gameData = await getGameData(gameId);
          const selectedPiece = gameData && gameData.selectedPiece ? gameData.selectedPiece : null;

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
            opponentSelectedPiece: selectedPiece
          }, this.setupGameListener);
        } else {
          // Create new game session
          await createGameSession(gameId, startFen);
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
            opponent: null
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
    
    this.setState({ 
      boardIndex: historicalStates.length - 1, 
      historicalStates: historicalStates,
      gameOver: gameOver
    });
    
    // In multiplayer mode, update the Firebase database
    if (this.state.gameMode === 'multiplayer' && this.state.gameId) {
      try {
        await updateGameState(this.state.gameId, fen, gameOver);
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

  render() {
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
      <MuiThemeProvider muiTheme={getMuiTheme(chessLight)}>
        <div className="App">
          <div id="thinking-bar"></div>
          <Header 
            requestOpenNewGame={this.requestOpenNewGame} 
            requestOpenIntelligenceDia={this.requestOpenIntelligenceDia} 
            gameMode={this.state.gameMode}
            gameId={this.state.gameId}
          />
          <WindowResizeListener onResize={windowSize => { resized(windowSize.windowWidth, windowSize.windowHeight) }} />
          
          {this.state.isWaitingForOpponent ? (
            <div className="waiting-message">
              <h2>Waiting for opponent...</h2>
              <p>Share this game ID with your opponent: <strong>{this.state.gameId}</strong></p>
            </div>
          ) : (
            this.renderChessBoard()
          )}
          
          <Dialog title="New Game" actions={newGameActions} modal={false} open={this.state.newGameDiaOpen} onRequestClose={this.handleClose} >
            Start a new game?
          </Dialog>
          
          <GameModeDialog 
            open={this.state.gameModeDialogOpen}
            onClose={this.closeGameModeDialog}
            onSubmit={this.handleGameModeSubmit}
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
      </MuiThemeProvider>
    );
  }
}

export default App;
