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
import { red500, amber500, green500, blue500, grey700 } from 'material-ui/styles/colors';

class Analysis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      analyzing: false,
      moves: [],
      currentMoveIndex: 0,
      userColor: 'w' // Assuming user plays white by default
    };
  }

  componentDidMount() {
    if (this.props.open && !this.state.analyzing && this.state.moves.length === 0) {
      this.analyzeGame();
    }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.open && this.props.open && !this.state.analyzing && this.state.moves.length === 0) {
      this.analyzeGame();
    }
  }

  analyzeGame = () => {
    this.setState({ analyzing: true });
    
    const { historicalStates } = this.props;
    if (!historicalStates || historicalStates.length <= 2) {
      this.setState({ analyzing: false });
      return;
    }

    let sf = null;
    if (window.stockfish) {
      sf = window.stockfish;
    } else {
      sf = eval('stockfish');
    }
    
    // Keep track of move evaluations and best moves
    const moveEvaluations = [];
    const bestMoves = [];
    let currentMoveIndex = 0;
    
    sf.onmessage = (event) => {
      const message = event.data ? event.data : event;
      console.log("Stockfish message:", message);
      
      if (message.startsWith('info') && message.includes('score cp')) {
        // Extract evaluation score
        const scoreMatch = message.match(/score cp ([-\d]+)/);
        const mateMatch = message.match(/score mate ([-\d]+)/);
        let score = 0;
        
        if (scoreMatch) {
          score = parseInt(scoreMatch[1]) / 100; // Convert to pawns
        } else if (mateMatch) {
          const movesToMate = parseInt(mateMatch[1]);
          score = movesToMate > 0 ? 100 : -100; // Represent mate as ±100
        }
        
        // Get depth and best move
        const depthMatch = message.match(/depth (\d+)/);
        const pv = message.match(/pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
        
        if (depthMatch && parseInt(depthMatch[1]) >= 15) {
          moveEvaluations[currentMoveIndex] = score;
          if (pv && pv[1]) {
            bestMoves[currentMoveIndex] = pv[1];
          }
        }
      } else if (message.startsWith('bestmove')) {
        const bestMove = message.split(' ')[1];
        if (bestMove && bestMove !== '(none)') {
          bestMoves[currentMoveIndex] = bestMove;
        }
        
        // Move to next position
        currentMoveIndex++;
        
        // If we've analyzed all positions
        if (currentMoveIndex >= historicalStates.length - 1) {
          this.analyzeMoves(moveEvaluations, bestMoves);
        } else {
          // Analyze next position with higher depth
          sf.postMessage(`position fen ${historicalStates[currentMoveIndex]}`);
          sf.postMessage('go depth 18 multipv 2'); // Increased depth and added multipv
        }
      }
    };
    
    // Start analysis from first position with more depth
    sf.postMessage(`position fen ${historicalStates[0]}`);
    sf.postMessage('go depth 18 multipv 2');
  }
  
  analyzeMoves = (evaluations, bestMoves) => {
    const moves = [];
    const { historicalStates } = this.props;
    
    console.log("Full evaluations data:", evaluations);
    console.log("Best moves data:", bestMoves);
    
    // Calculate the final outcome of the game
    const finalPosition = historicalStates[historicalStates.length-1];
    const finalChess = new (require('./chess.js').Chess)(finalPosition);
    const isGameOver = finalChess.game_over();
    const finalEval = evaluations[evaluations.length-1] || 0;
    
    // Determine if white lost quickly
    const isQuickLoss = isGameOver && historicalStates.length <= 15; // about 7 moves per side
    const whiteLost = finalEval < -3 || (isGameOver && finalChess.turn() === 'w' && finalChess.in_checkmate());
    
    console.log(`Game status: over=${isGameOver}, quickLoss=${isQuickLoss}, whiteLost=${whiteLost}, finalEval=${finalEval}`);
    
    // Loop through evaluations
    for (let i = 1; i < evaluations.length; i++) {
      const prevEval = evaluations[i-1];
      const currEval = evaluations[i];
      
      if (prevEval !== undefined && currEval !== undefined) {
        // Determine if move was played by white or black
        const chess = new (require('./chess.js').Chess)(historicalStates[i-1]);
        const player = chess.turn() === 'w' ? 'White' : 'Black';
        const isWhiteMove = player === 'White';
        
        // For display
        const evalBefore = prevEval.toFixed(2);
        const evalAfter = currEval.toFixed(2);
        
        // Calculate raw difference
        const rawDiff = currEval - prevEval;
        
        // Calculate perspective-aware difference
        let evalDiff;
        
        if (isWhiteMove) {
          // For white, positive changes are good
          evalDiff = rawDiff;
        } else {
          // For black, negative changes are good
          evalDiff = -rawDiff;
        }
        
        // Determine move quality with more realistic thresholds
        let magnitude, color;
        
        // For white's moves
        if (isWhiteMove) {
          if (rawDiff < -1.5) {
            magnitude = 'blunder';
            color = red500;
          } else if (rawDiff < -0.5) {
            magnitude = 'mistake';
            color = amber500;
          } else if (rawDiff > 1.0) {
            magnitude = 'excellent move';
            color = blue500;
          } else if (rawDiff > 0.3) {
            magnitude = 'good move';
            color = green500;
          } else {
            // Skip neutral moves
            continue;
          }
        }
        // For black's moves
        else {
          if (rawDiff > 1.5) {
            magnitude = 'blunder';
            color = red500;
          } else if (rawDiff > 0.5) {
            magnitude = 'mistake';
            color = amber500;
          } else if (rawDiff < -1.0) {
            magnitude = 'excellent move';
            color = blue500;
          } else if (rawDiff < -0.3) {
            magnitude = 'good move';
            color = green500;
          } else {
            // Skip neutral moves
            continue;
          }
        }
        
        // If a position becomes very bad after a move, it's likely a blunder
        if (isWhiteMove && currEval < -2.0 && prevEval > -1.0) {
          magnitude = 'blunder';
          color = red500;
        } else if (!isWhiteMove && currEval > 2.0 && prevEval < 1.0) {
          magnitude = 'blunder';
          color = red500;
        }
        
        // Log move info
        console.log(`Move ${i} (${player}): ${evalBefore} → ${evalAfter}, diff=${evalDiff.toFixed(2)}, quality=${magnitude}`);
        
        // Add to results
        moves.push({
          move: i,
          player,
          evalBefore,
          evalAfter,
          evalDiff: evalDiff.toFixed(2),
          magnitude,
          color,
          fen: historicalStates[i],
          bestMove: bestMoves[i-1]
        });
      }
    }
    
    // NO SORTING - keep in order of play
    
    console.log("Final moves analysis:", moves);
    this.setState({ analyzing: false, moves });
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
    switch(magnitude) {
      case 'blunder':
        return <Error />;
      case 'mistake':
        return <Warning />;
      case 'good move':
        return <ActionThumbUp />;
      case 'excellent move':
        return <ActionGrade />;
      default:
        return <Warning />;
    }
  }

  render() {
    const { open } = this.props;
    const { analyzing, moves, userColor } = this.state;
    
    // Don't filter moves - show both sides' moves
    const allMoves = [...moves];
    
    // Sort moves by move number
    allMoves.sort((a, b) => a.move - b.move);
    
    const customContentStyle = {
      position: 'relative',
      paddingTop: '0px'
    };
    
    const titleStyle = {
      paddingBottom: '8px'
    };
    
    const closeButtonStyle = {
      position: 'absolute',
      right: '5px',
      top: '5px',
      padding: '0'
    };
    
    const actions = [
      <FlatButton
        label="Close"
        primary={true}
        style={{ color: '#333' }}
        onClick={this.handleClose}
      />
    ];

    return (
      <Dialog
        title="Game Analysis"
        actions={actions}
        modal={false}
        open={open}
        onRequestClose={this.handleClose}
        autoScrollBodyContent={true}
        contentStyle={customContentStyle}
        titleStyle={titleStyle}
      >
        <IconButton 
          style={closeButtonStyle} 
          onClick={this.handleClose}
          tooltip="Close"
        >
          <CloseIcon color={grey700} />
        </IconButton>
        
        {analyzing ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            Analyzing game moves...
          </div>
        ) : allMoves.length > 0 ? (
          <div>
            <p>All moves in this game:</p>
            <p style={{ fontSize: '0.8em', fontStyle: 'italic', marginBottom: '15px' }}>Click on a move to view the position on the board</p>
            <List>
              {allMoves.map((move, index) => (
                <div key={index}>
                  <ListItem
                    leftAvatar={
                      <Avatar
                        icon={this.getIcon(move.magnitude)}
                        backgroundColor={move.color}
                      />
                    }
                    primaryText={`Move ${Math.ceil(move.move/2)} - ${move.player}`}
                    secondaryText={
                      <p>
                        Evaluation changed from {move.evalBefore} to {move.evalAfter}.
                        This was a {move.magnitude}.
                      </p>
                    }
                    secondaryTextLines={2}
                    onClick={() => this.jumpToPosition(move.fen, move.move)}
                    style={{cursor: 'pointer'}}
                  />
                  <Divider inset={true} />
                </div>
              ))}
            </List>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            No significant moves were found in this game.
          </div>
        )}
      </Dialog>
    );
  }
}

export default Analysis; 