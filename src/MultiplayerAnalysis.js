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
import Tabs from 'material-ui/Tabs/Tabs';
import Tab from 'material-ui/Tabs/Tab';

class MultiplayerAnalysis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      analyzing: false,
      moves: [],
      currentMoveIndex: 0,
      activeTab: 'player',
      userColor: props.playerColor
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
    
    const { historicalStates, playerColor } = this.props;
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
    const { historicalStates, playerColor } = this.props;
    
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
    console.log("Player color:", playerColor);
    
    // Check if final evaluation indicates a likely loss - use for context
    const likelyLoss = (playerColor === 'w' && finalEval < -2.0) || 
                       (playerColor === 'b' && finalEval > 2.0);
    
    // Check if game ended in checkmate
    const isCheckmate = finalChess.in_checkmate();
    const losingPlayer = isCheckmate ? finalChess.turn() : null;
    
    console.log("Game ended in checkmate:", isCheckmate, "Losing player:", losingPlayer);
    
    // Store the moves processed so we can compare evaluations over time
    const processingHistory = [];
    
    // First pass to identify all evaluation changes
    for (let i = 1; i < evaluations.length; i++) {
      const prevEval = evaluations[i-1];
      const currEval = evaluations[i];
      
      if (prevEval !== undefined && currEval !== undefined) {
        // Store this move's evaluation for comparison
        processingHistory.push({index: i, eval: currEval});
        
        // Determine if move was played by white or black
        const chess = new (require('./chess.js').Chess)(historicalStates[i-1]);
        const turn = chess.turn();
        const player = turn === 'w' ? 'White' : 'Black';
        const isWhiteMove = turn === 'w';

        // Check how close to the end of game
        const distanceFromEnd = historicalStates.length - i;
        
        console.log(`Move ${i}: player=${player}, userColor=${playerColor}, turn=${turn}, distance from end: ${distanceFromEnd}`);
        
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
        
        // Define move quality based on evaluation change
        let magnitude = 'quiet move';
        let color = green500;
        
        // For white, negative changes are bad; for black, positive changes are bad
        const isNegativeChange = (isWhiteMove && rawDiff < 0) || (!isWhiteMove && rawDiff > 0);
        
        // Check for losing moves
        if (isCheckmate && losingPlayer === turn && distanceFromEnd <= 3) {
          magnitude = 'blunder';
          color = red500;
          console.log(`Move ${i} marked as BLUNDER because it leads to checkmate in ${distanceFromEnd} moves`);
        }
        // If evaluation shows significant drop, mark as blunder
        else if ((isWhiteMove && rawDiff < -0.8) || (!isWhiteMove && rawDiff > 0.8)) {
          magnitude = 'blunder';
          color = red500;
          console.log(`Move ${i} marked as BLUNDER due to significant evaluation drop`);
        }
        // For more minor evaluation drops
        else if ((isWhiteMove && rawDiff < -0.3) || (!isWhiteMove && rawDiff > 0.3)) {
          magnitude = 'mistake';
          color = amber500;
          console.log(`Move ${i} marked as MISTAKE due to evaluation drop`);
        }
        // For very minor negative changes
        else if (isNegativeChange) {
          magnitude = 'inaccuracy';
          color = amber500;
          console.log(`Move ${i} marked as INACCURACY due to slight negative change`);
        }
        // If evaluation improved significantly
        else if ((isWhiteMove && rawDiff > 0.5) || (!isWhiteMove && rawDiff < -0.5)) {
          magnitude = 'excellent move';
          color = blue500;
          console.log(`Move ${i} marked as EXCELLENT MOVE due to significant improvement`);
        }
        // If evaluation improved moderately
        else if ((isWhiteMove && rawDiff > 0.2) || (!isWhiteMove && rawDiff < -0.2)) {
          magnitude = 'good move';
          color = green500;
          console.log(`Move ${i} marked as GOOD MOVE due to moderate improvement`);
        }
        // Default for neutral moves
        else {
          magnitude = 'quiet move';
          color = green500;
          console.log(`Move ${i} marked as QUIET MOVE`);
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
          bestMove: bestMoves[i-1],
          isWhite: isWhiteMove
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
    console.log('Jumping to position in MultiplayerAnalysis:', index, 'FEN:', fen);
    
    // First hide the dialog temporarily
    if (this.props.onClose) {
      this.props.onClose();
    }
    
    // Small delay to allow the board to be visible
    setTimeout(() => {
      // Ensure we're passing a numeric index
      if (this.props.onJumpToPosition) {
        const moveIndex = parseInt(index, 10);
        console.log('Calling parent onJumpToPosition with index:', moveIndex);
        this.props.onJumpToPosition(moveIndex);
      }
      
      // Reopen the dialog after a longer delay to show the board position first
      setTimeout(() => {
        if (this.props.open) {
          this.setState({ analyzing: false });
        }
      }, 2000); // Increased from 500ms to 2000ms (2 seconds)
    }, 100);
  }

  handleTabChange = (tab) => {
    this.setState({ activeTab: tab });
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

  // Add this helper method to determine if moves should be included in the list
  shouldIncludeMove = (move, playerPerspective) => {
    // Include moves that are particularly good
    if (move.magnitude === 'good move' || move.magnitude === 'excellent move') {
      return true;
    }
    
    // Include moves that are particularly bad
    if (move.magnitude === 'blunder' || move.magnitude === 'mistake' || move.magnitude === 'inaccuracy') {
      return true;
    }
    
    // Include quiet but important moves
    return true;
  }

  render() {
    const { open, playerColor } = this.props;
    const { analyzing, moves, activeTab } = this.state;
    
    // Filter moves by color for the tabs
    const whiteMoves = moves.filter(move => move.isWhite);
    const blackMoves = moves.filter(move => !move.isWhite);
    
    // Get only the player's moves based on their color
    const playerMoves = playerColor === 'w' ? whiteMoves : blackMoves;
    
    // Calculate move quality counts
    const whiteGoodMoves = whiteMoves.filter(m => m.magnitude === 'good move' || m.magnitude === 'excellent move').length;
    const whiteBadMoves = whiteMoves.filter(m => m.magnitude === 'blunder' || m.magnitude === 'mistake' || m.magnitude === 'inaccuracy').length;
    const blackGoodMoves = blackMoves.filter(m => m.magnitude === 'good move' || m.magnitude === 'excellent move').length;
    const blackBadMoves = blackMoves.filter(m => m.magnitude === 'blunder' || m.magnitude === 'mistake' || m.magnitude === 'inaccuracy').length;
    
    // Sort moves by move number
    whiteMoves.sort((a, b) => a.move - b.move);
    blackMoves.sort((a, b) => a.move - b.move);
    
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
    
    const tabStyle = {
      backgroundColor: '#f5f5f5',
      color: '#333'
    };
    
    const actions = [
      <FlatButton
        label="Close"
        primary={true}
        style={{ color: '#333' }}
        onClick={this.handleClose}
      />
    ];

    const renderMovesList = (movesToShow) => {
      if (movesToShow.length === 0) {
        return (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            No significant moves were found.
          </div>
        );
      }

      return (
        <List>
          {movesToShow.map((move, index) => (
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
                onClick={() => {
                  console.log(`Clicked on move index ${move.move} from tab ${activeTab}`);
                  this.jumpToPosition(move.fen, move.move);
                }}
                style={{cursor: 'pointer'}}
              />
              <Divider inset={true} />
            </div>
          ))}
        </List>
      );
    };

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
        ) : moves.length > 0 ? (
          <div>
            <p>Analysis of the game:</p>
            
            {/* Add move quality summary */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-around', 
              margin: '10px 0 15px',
              padding: '8px',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px'
            }}>
              <div>
                <strong>White:</strong> {whiteGoodMoves} good moves, {whiteBadMoves} mistakes
              </div>
              <div>
                <strong>Black:</strong> {blackGoodMoves} good moves, {blackBadMoves} mistakes
              </div>
            </div>
            
            <p style={{ fontSize: '0.8em', fontStyle: 'italic', marginBottom: '15px' }}>
              Click on a move to view the position on the board
            </p>
            
            <Tabs
              value={activeTab}
              onChange={this.handleTabChange}
            >
              <Tab 
                label="My Moves" 
                value="player"
                style={tabStyle}
              >
                <div style={{ padding: '10px' }}>
                  {renderMovesList(playerMoves)}
                </div>
              </Tab>
              <Tab 
                label="White Moves" 
                value="white"
                style={tabStyle}
              >
                <div style={{ padding: '10px' }}>
                  {renderMovesList(whiteMoves)}
                </div>
              </Tab>
              <Tab 
                label="Black Moves" 
                value="black"
                style={tabStyle}
              >
                <div style={{ padding: '10px' }}>
                  {renderMovesList(blackMoves)}
                </div>
              </Tab>
            </Tabs>
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

export default MultiplayerAnalysis; 