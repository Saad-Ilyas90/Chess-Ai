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
    this.state = {
      boardIndex: 0,
      newGameDiaOpen: false,
      intelligenceDiaOpen: false,
      gameModeDialogOpen: false,
      analysisConfirmationOpen: false,
      analysisOpen: false,
      gameOver: false,
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
    }

    // Set up a new listener
    if (this.state.gameId) {
      this.gameListener = listenToGameChanges(this.state.gameId, (gameData) => {
        if (!gameData) return;
        
        // Only update board if the FEN is different from our current one
        if (gameData.fen && this.state.historicalStates[this.state.boardIndex] !== gameData.fen) {
          // Create a clean copy of the historicalStates array up to the current boardIndex
          const historicalStates = this.state.historicalStates.slice(0, this.state.boardIndex + 1);
          
          // Add the new state if it's not already the last one
          if (historicalStates[historicalStates.length - 1] !== gameData.fen) {
            historicalStates.push(gameData.fen);
          }
          
          this.setState({
            historicalStates: historicalStates,
            boardIndex: historicalStates.length - 1,
            gameOver: gameData.gameOver || false
          });
        }
        
        // Check if opponent joined
        if (gameData.players && gameData.players[this.state.userColor === 'w' ? 'b' : 'w']) {
          this.setState({ isWaitingForOpponent: false });
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
    // Open game mode dialog directly instead of the new game dialog
    this.setState({ gameModeDialogOpen: true });
  };

  closeGameModeDialog = () => {
    this.setState({ gameModeDialogOpen: false });
  };

  handleGameModeSubmit = async (options) => {
    const { gameMode, joinGame: isJoining, gameId, playerColor } = options;
    
    if (gameMode === 'ai') {
      // Handle AI game mode (existing functionality)
      this.setState({ 
        gameModeDialogOpen: false,
        gameMode: 'ai',
        userColor: 'w',
        boardIndex: 0, 
        historicalStates: [startFen], 
        gameOver: false
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
            gameModeDialogOpen: false,
            gameMode: 'multiplayer',
            userColor: playerColor,
            gameId: gameId,
            boardIndex: 0,
            historicalStates: [gameData && gameData.fen ? gameData.fen : startFen],
            gameOver: gameData && gameData.gameOver ? gameData.gameOver : false,
            isSecondPlayer: true,
            opponentSelectedPiece: selectedPiece
          }, this.setupGameListener);
        } else {
          // Create new game session
          await createGameSession(gameId, startFen);
          await joinGame(gameId, playerColor);
          
          // Set up listener and show waiting for opponent message
          this.setState({
            gameModeDialogOpen: false,
            gameMode: 'multiplayer',
            userColor: playerColor,
            gameId: gameId,
            isWaitingForOpponent: true,
            boardIndex: 0,
            historicalStates: [startFen],
            gameOver: false,
            isSecondPlayer: false
          }, this.setupGameListener);
        }
      } catch (error) {
        console.error("Error setting up multiplayer game:", error);
        alert("There was an error connecting to the multiplayer service. Please try again.");
      }
    }
  };

  getFallenOnes = () => {
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
    
    // Show analysis confirmation when game is over, but only in AI mode
    if (gameOver && this.state.gameMode === 'ai') {
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
      this.setState({ boardIndex: this.state.boardIndex - 2 });
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
    if (this.state.boardIndex < this.state.historicalStates.length - 2) {
      this.setState({ boardIndex: this.state.boardIndex + 2 });
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
    this.setState({ analysisOpen: false });
  }
  
  jumpToPosition = (index) => {
    console.log('App: Setting board index to', index, 'from current', this.state.boardIndex);
    
    // Close the dialog when jumping to a position and set a timer to reopen it
    this.setState({ 
      boardIndex: index,
      analysisOpen: false 
    });
    
    // Reopen the analysis dialog after 2 seconds
    setTimeout(() => {
      this.setState({ analysisOpen: true });
    }, 2000);
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
          
          <Analysis 
            open={this.state.analysisOpen} 
            onClose={this.closeAnalysis}
            historicalStates={this.state.historicalStates}
            onJumpToPosition={this.jumpToPosition}
          />
          
          <Footer 
            fallenOnes={this.getFallenOnes()} 
            playForHuman={this.handlePlayForHuman} 
            gotoPreviousState={this.handleGotoPreviousState} 
            gotoNextState={this.handleGotoNextState}
            gameMode={this.state.gameMode}
          />
        </div>
      </MuiThemeProvider>
    );
  }
}

export default App;
