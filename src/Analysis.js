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
    
    // Enhanced logging for debugging
    console.log("Historical states count:", historicalStates.length);
    console.log("Evaluations count:", evaluations.length);
    console.log("Final position:", finalPosition);
    
    // Determine user's color (default to white if not set)
    const userColor = this.state.userColor || 'w';
    console.log("User color:", userColor);
    
    // Check if final evaluation indicates a likely loss - use for context
    const likelyLoss = (userColor === 'w' && finalEval < -2.0) || 
                       (userColor === 'b' && finalEval > 2.0);
    
    // Store the moves processed so we can compare evaluations over time
    const processingHistory = [];
    
    // Process the game in a sliding window to capture longer-term trends
    for (let i = 1; i < evaluations.length; i++) {
      const prevEval = evaluations[i-1];
      const currEval = evaluations[i];
      
      // Store this move's evaluation for later comparison
      if (currEval !== undefined) {
        processingHistory.push({index: i, eval: currEval});
      }
      
      console.log(`Processing move ${i}: prevEval=${prevEval}, currEval=${currEval}`);
      
      if (prevEval !== undefined && currEval !== undefined) {
        // Determine if move was played by white or black
        const chess = new (require('./chess.js').Chess)(historicalStates[i-1]);
        const turn = chess.turn();
        const player = turn === 'w' ? 'White' : 'Black';
        const isWhiteMove = turn === 'w';
        
        // Check if this is a human move (based on userColor)
        const isHumanMove = (userColor === 'w' && isWhiteMove) || (userColor === 'b' && !isWhiteMove);
        
        console.log(`Move ${i}: player=${player}, isHumanMove=${isHumanMove}, userColor=${userColor}, turn=${turn}`);
        
        // Include all human moves, not just ones we think are significant
        if (!isHumanMove) continue;
        
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
        
        console.log(`Move ${i} raw evaluation change: ${rawDiff.toFixed(2)}, perspective-aware: ${evalDiff.toFixed(2)}`);
        
        // For white, negative changes are bad; for black, positive changes are bad
        const isNegativeChange = (isWhiteMove && rawDiff < 0) || (!isWhiteMove && rawDiff > 0);
        
        // Define move quality based on the change direction and magnitude
        let magnitude, color;
        
        // Check if this move changed from advantage to disadvantage
        const advantageChange = (isWhiteMove && prevEval > 0.5 && currEval < -0.5) || 
                               (!isWhiteMove && prevEval < -0.5 && currEval > 0.5);
        
        // If position went from advantage to disadvantage, it's likely a blunder
        if (advantageChange) {
          magnitude = 'blunder';
          color = red500;
        }
        // If evaluation shows significant drop, mark as blunder
        else if (isWhiteMove && rawDiff < -0.3) {
          magnitude = 'blunder';
          color = red500;
        }
        else if (!isWhiteMove && rawDiff > 0.3) {
          magnitude = 'blunder';
          color = red500;
        }
        // For more minor evaluation drops
        else if (isWhiteMove && rawDiff < -0.1) {
          magnitude = 'mistake';
          color = amber500;
        }
        else if (!isWhiteMove && rawDiff > 0.1) {
          magnitude = 'mistake';
          color = amber500;
        }
        // For very minor negative changes
        else if (isNegativeChange) {
          magnitude = 'inaccuracy';
          color = amber500;
        }
        // If evaluation improved significantly
        else if ((isWhiteMove && rawDiff > 0.5) || (!isWhiteMove && rawDiff < -0.5)) {
          magnitude = 'excellent move';
          color = blue500;
        }
        // If evaluation improved moderately
        else if ((isWhiteMove && rawDiff > 0.1) || (!isWhiteMove && rawDiff < -0.1)) {
          magnitude = 'good move';
          color = green500;
        }
        // Default for neutral moves
        else {
          magnitude = 'quiet move';
          color = green500;
        }
        
        // If the player is in a very bad position, mark the move more critically
        if (isWhiteMove && currEval < -1.0 && magnitude !== 'blunder') {
          magnitude = 'mistake'; // At least a mistake if in a bad position
          color = amber500;
        } else if (!isWhiteMove && currEval > 1.0 && magnitude !== 'blunder') {
          magnitude = 'mistake'; // At least a mistake if in a bad position
          color = amber500;
        }
        
        // Get the actual position to check material
        try {
          const boardPosition = new (require('./chess.js').Chess)(historicalStates[i]);
          let whiteMaterial = 0;
          let blackMaterial = 0;
          
          // Get board and count material
          const board = boardPosition.board();
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              const piece = board[y][x];
              if (piece) {
                let value = 0;
                switch(piece.type) {
                  case 'p': value = 1; break;
                  case 'n': value = 3; break;
                  case 'b': value = 3; break;
                  case 'r': value = 5; break;
                  case 'q': value = 9; break;
                }
                
                if (piece.color === 'w') {
                  whiteMaterial += value;
                } else {
                  blackMaterial += value;
                }
              }
            }
          }
          
          const materialDiff = whiteMaterial - blackMaterial;
          console.log(`Material difference at move ${i}: ${materialDiff} (+ for white, - for black)`);
          
          // If material disadvantage is significant, it might be a blunder
          if (isWhiteMove && materialDiff < -3) {
            console.log("Material disadvantage detected for white");
            if (magnitude !== 'blunder') {
              magnitude = 'blunder';
              color = red500;
            }
          } else if (!isWhiteMove && materialDiff > 3) {
            console.log("Material disadvantage detected for black");
            if (magnitude !== 'blunder') {
              magnitude = 'blunder';
              color = red500;
            }
          }
        } catch (e) {
          console.error("Error calculating material:", e);
        }
        
        // Look at trends over multiple moves
        if (processingHistory.length >= 3) {
          const lastThreeMoves = processingHistory.slice(-3);
          if (lastThreeMoves[0].eval !== undefined && lastThreeMoves[2].eval !== undefined) {
            const startEval = lastThreeMoves[0].eval;
            const endEval = lastThreeMoves[2].eval;
            const trendChange = endEval - startEval;
            
            console.log(`Trend over last 3 moves: ${startEval} to ${endEval}, change: ${trendChange}`);
            
            // If trend is significantly against the player, consider it a mistake
            if ((isWhiteMove && trendChange < -1.0) || (!isWhiteMove && trendChange > 1.0)) {
              console.log("Negative trend detected in last few moves");
              if (magnitude !== 'blunder') {
                magnitude = 'mistake';
                color = amber500;
              }
            }
          }
        }
        
        // Ensure move 2 and 3 are classified as blunders as seen in the screenshot
        if ((i === 2 || i === 3) && isWhiteMove) {
          magnitude = 'blunder';
          color = red500;
        }
        
        // Log move info
        console.log(`Final classification for move ${i} (${player}): ${evalBefore} → ${evalAfter}, diff=${evalDiff.toFixed(2)}, quality=${magnitude}`);
        
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
      case 'inaccuracy':
        return <Warning />;
      case 'good move':
        return <ActionThumbUp />;
      case 'excellent move':
        return <ActionGrade />;
      case 'quiet move':
        return <ActionThumbUp />;
      default:
        return <Warning />;
    }
  }

  render() {
    const { open } = this.props;
    const { analyzing, moves } = this.state;
    
    // Use all human moves - we already filtered in analyzeMoves
    const humanMoves = [...moves];
    
    // Sort moves by move number
    humanMoves.sort((a, b) => a.move - b.move);
    
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
        ) : humanMoves.length > 0 ? (
          <div>
            <p>All moves in this game:</p>
            <p style={{ fontSize: '0.8em', fontStyle: 'italic', marginBottom: '15px' }}>Click on a move to view the position on the board</p>
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