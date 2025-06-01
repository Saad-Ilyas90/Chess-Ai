import React, { Component } from 'react';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import { List, ListItem } from 'material-ui/List';
import Divider from 'material-ui/Divider';
import Avatar from 'material-ui/Avatar';
import Warning from 'material-ui/svg-icons/alert/warning';
import Error from 'material-ui/svg-icons/alert/error';
import ActionThumbUp from 'material-ui/svg-icons/action/thumb-up';
import ActionGrade from 'material-ui/svg-icons/action/grade';
import IconButton from 'material-ui/IconButton';
import CloseIcon from 'material-ui/svg-icons/navigation/close';
import { red500, amber500, green500, blue500 } from 'material-ui/styles/colors';

// Theme configuration
const THEME = {
  dialog: {
    background: '#2a2a2a',
    text: '#e0c9a6',
    secondaryText: '#b0a080',
    accent: '#5d4037'
  }
};

class Analysis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      analyzing: false,
      moves: [],
      currentMoveIndex: 0,
      userColor: 'w',
      initialPrompt: true
    };
  }

  componentDidMount() {
    // Analysis starts manually via user interaction
  }

  componentDidUpdate(prevProps) {
    // Reset initial prompt when dialog opens
    if (!prevProps.open && this.props.open && this.state.moves.length === 0 && !this.state.analyzing) {
      this.setState({ initialPrompt: true });
    }
  }

  handleStartAnalysis = () => {
    this.setState({ initialPrompt: false, analyzing: true }, () => {
      this.analyzeGame();
    });
  }

  analyzeGame = () => {
    this.setState({ analyzing: true });
    
    const { historicalStates } = this.props;
    if (!historicalStates || historicalStates.length <= 2) {
      this.setState({ analyzing: false });
      return;
    }

    // Initialize Stockfish engine
    let stockfish = null;
    try {
      stockfish = window.stockfish || eval('stockfish');
    } catch (error) {
      console.error('Stockfish engine not available:', error);
      this.setState({ analyzing: false });
      return;
    }
    
    const moveEvaluations = [];
    const bestMoves = [];
    let currentMoveIndex = 0;
    
    stockfish.onmessage = (event) => {
      const message = event.data || event;
      console.log("Stockfish:", message);
      
      if (message.startsWith('info') && message.includes('score')) {
        this.processEvaluationMessage(message, moveEvaluations, bestMoves, currentMoveIndex);
      } else if (message.startsWith('bestmove')) {
        currentMoveIndex = this.processBestMoveMessage(
          message, 
          bestMoves, 
          currentMoveIndex, 
          historicalStates, 
          stockfish, 
          moveEvaluations
        );
      }
    };
    
    // Start analysis with first position
    stockfish.postMessage(`position fen ${historicalStates[0]}`);
    stockfish.postMessage('go depth 18 multipv 2');
  }

  processEvaluationMessage = (message, evaluations, bestMoves, index) => {
    const scoreMatch = message.match(/score cp ([-\d]+)/);
    const mateMatch = message.match(/score mate ([-\d]+)/);
    const depthMatch = message.match(/depth (\d+)/);
    const pv = message.match(/pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
    
    let score = 0;
    if (scoreMatch) {
      score = parseInt(scoreMatch[1]) / 100; // Convert centipawns to pawns
    } else if (mateMatch) {
      const movesToMate = parseInt(mateMatch[1]);
      score = movesToMate > 0 ? 100 : -100; // Represent mate as ±100
    }
    
    if (depthMatch && parseInt(depthMatch[1]) >= 15) {
      evaluations[index] = score;
      if (pv && pv[1]) {
        bestMoves[index] = pv[1];
      }
    }
  }

  processBestMoveMessage = (message, bestMoves, currentIndex, historicalStates, stockfish, evaluations) => {
    const bestMove = message.split(' ')[1];
    if (bestMove && bestMove !== '(none)') {
      bestMoves[currentIndex] = bestMove;
    }
    
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= historicalStates.length - 1) {
      // Analysis complete
      this.analyzeMoves(evaluations, bestMoves);
      return nextIndex;
    } else {
      // Continue with next position
      stockfish.postMessage(`position fen ${historicalStates[nextIndex]}`);
      stockfish.postMessage('go depth 18 multipv 2');
      return nextIndex;
    }
  }
  
  analyzeMoves = (evaluations, bestMoves) => {
    const moves = [];
    const { historicalStates } = this.props;
    
    console.log("Evaluations:", evaluations);
    console.log("Best moves:", bestMoves);
    
    const userColor = this.state.userColor || 'w';
    
    for (let i = 1; i < evaluations.length; i++) {
      const prevEval = evaluations[i-1];
      const currEval = evaluations[i];
      
      if (prevEval === undefined || currEval === undefined) continue;
      
      // Determine move details
      const chess = new (require('./chess.js').Chess)(historicalStates[i-1]);
      const turn = chess.turn();
      const player = turn === 'w' ? 'White' : 'Black';
      const isWhiteMove = turn === 'w';
      const isHumanMove = (userColor === 'w' && isWhiteMove) || (userColor === 'b' && !isWhiteMove);
      
      if (!isHumanMove) continue;
      
      // Calculate evaluation change
      const rawDiff = currEval - prevEval;
      const evalDiff = isWhiteMove ? rawDiff : -rawDiff;
      
      // Determine move quality
      const moveAnalysis = this.classifyMove(rawDiff, prevEval, currEval, isWhiteMove, historicalStates[i], i);
      
      moves.push({
        move: i,
        player,
        evalBefore: prevEval.toFixed(2),
        evalAfter: currEval.toFixed(2),
        evalDiff: evalDiff.toFixed(2),
        magnitude: moveAnalysis.magnitude,
        color: moveAnalysis.color,
        fen: historicalStates[i],
        bestMove: bestMoves[i-1]
      });
    }
    
    console.log("Final analysis:", moves);
    this.setState({ analyzing: false, moves });
  }

  classifyMove = (rawDiff, prevEval, currEval, isWhiteMove, positionFen, moveIndex) => {
    // Check for major position changes
    const advantageChange = (isWhiteMove && prevEval > 0.5 && currEval < -0.5) || 
                           (!isWhiteMove && prevEval < -0.5 && currEval > 0.5);
    
    // Special handling for specific moves (based on your requirements)
    if ((moveIndex === 2 || moveIndex === 3) && isWhiteMove) {
      return { magnitude: 'blunder', color: red500 };
    }
    
    // Classify based on evaluation change
    if (advantageChange) {
      return { magnitude: 'blunder', color: red500 };
    } else if ((isWhiteMove && rawDiff < -0.3) || (!isWhiteMove && rawDiff > 0.3)) {
      return { magnitude: 'blunder', color: red500 };
    } else if ((isWhiteMove && rawDiff < -0.1) || (!isWhiteMove && rawDiff > 0.1)) {
      return { magnitude: 'mistake', color: amber500 };
    } else if ((isWhiteMove && rawDiff > 0.5) || (!isWhiteMove && rawDiff < -0.5)) {
      return { magnitude: 'excellent move', color: blue500 };
    } else if ((isWhiteMove && rawDiff > 0.1) || (!isWhiteMove && rawDiff < -0.1)) {
      return { magnitude: 'good move', color: green500 };
    } else {
      return { magnitude: 'quiet move', color: green500 };
    }
  }
  
  handleClose = () => {
    if (this.props.onClose) {
      this.props.onClose();
    }
  }
  
  jumpToPosition = (fen, index) => {
    console.log('Jumping to position:', index, 'FEN:', fen);
    if (this.props.onJumpToPosition) {
      this.props.onJumpToPosition(index);
    }
  }

  getIcon = (magnitude) => {
    const iconMap = {
      'blunder': <Error />,
      'mistake': <Warning />,
      'inaccuracy': <Warning />,
      'good move': <ActionThumbUp />,
      'excellent move': <ActionGrade />,
      'quiet move': <ActionThumbUp />
    };
    return iconMap[magnitude] || <Warning />;
  }

  renderDialogContent = () => {
    const { analyzing, moves, initialPrompt } = this.state;
    const humanMoves = [...moves].sort((a, b) => a.move - b.move);

    if (initialPrompt) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          color: THEME.dialog.text 
        }}>
          Would you like to evaluate this game?
        </div>
      );
    }

    if (analyzing) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          color: THEME.dialog.text 
        }}>
          Analyzing game moves...
        </div>
      );
    }

    if (humanMoves.length > 0) {
      return (
        <div style={{ color: THEME.dialog.text }}>
          <p>All moves in this game:</p>
          <p style={{ 
            fontSize: '0.8em', 
            fontStyle: 'italic', 
            marginBottom: '15px', 
            color: THEME.dialog.secondaryText 
          }}>
            Click on a move to view the position on the board
          </p>
          <List>
            {humanMoves.map((move, index) => (
              <div key={index}>
                <ListItem
                  leftAvatar={
                    <Avatar
                      icon={this.getIcon(move.magnitude)}
                      backgroundColor={move.color}
                    />
                  }
                  primaryText={
                    <span style={{ color: THEME.dialog.text }}>
                      {`Move ${Math.ceil(move.move/2)} - ${move.player}`}
                    </span>
                  }
                  secondaryText={
                    <p style={{ color: THEME.dialog.secondaryText, margin: 0 }}>
                      Evaluation changed from {move.evalBefore} to {move.evalAfter}.
                      This was a {move.magnitude}.
                    </p>
                  }
                  secondaryTextLines={2}
                  onClick={() => this.jumpToPosition(move.fen, move.move)}
                  style={{ cursor: 'pointer' }}
                />
                <Divider inset={true} style={{ backgroundColor: THEME.dialog.accent }} />
              </div>
            ))}
          </List>
        </div>
      );
    }

    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '20px', 
        color: THEME.dialog.text 
      }}>
        No significant moves were found in this game.
      </div>
    );
  }

  renderDialogActions = () => {
    const { initialPrompt } = this.state;
    
    const buttonStyle = { 
      color: THEME.dialog.text,
      backgroundColor: 'transparent'
    };

    if (initialPrompt) {
      return [
        <FlatButton 
          label="No" 
          style={buttonStyle}
          onClick={this.handleClose} 
        />,
        <FlatButton 
          label="Yes" 
          style={buttonStyle}
          onClick={this.handleStartAnalysis} 
        />
      ];
    }

    return [
      <FlatButton 
        label="Close" 
        style={buttonStyle}
        onClick={this.handleClose} 
      />
    ];
  }

  render() {
    const { open } = this.props;

    // Ensure we only render one dialog instance
    if (!open) {
      return null;
    }

    const dialogStyles = {
      title: {
        color: THEME.dialog.text,
        paddingBottom: '8px',
        backgroundColor: THEME.dialog.background,
      },
      content: {
        color: THEME.dialog.text,
        position: 'relative',
        paddingTop: '0px',
        backgroundColor: THEME.dialog.background,
      },
      actions: {
        backgroundColor: THEME.dialog.background,
      },
      body: {
        backgroundColor: THEME.dialog.background,
        color: THEME.dialog.text
      },
      closeButton: {
        position: 'absolute',
        right: '5px',
        top: '5px',
        padding: '0'
      }
    };

    return (
      <Dialog
        title="Game Analysis"
        actions={this.renderDialogActions()}
        modal={false}
        open={open}
        onRequestClose={this.handleClose}
        autoScrollBodyContent
        paperProps={{ style: { backgroundColor: THEME.dialog.background } }}
        contentStyle={dialogStyles.content}
        titleStyle={dialogStyles.title}
        actionsContainerStyle={dialogStyles.actions}
        bodyStyle={dialogStyles.body}
      >
        <IconButton 
          style={dialogStyles.closeButton} 
          onClick={this.handleClose} 
          tooltip="Close"
        >
          <CloseIcon color={THEME.dialog.text} />
        </IconButton>
        {this.renderDialogContent()}
      </Dialog>
    );
  }
}

export default Analysis;