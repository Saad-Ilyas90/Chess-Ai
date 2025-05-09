import React, { Component } from 'react';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import { List, ListItem } from 'material-ui/List';
import Divider from 'material-ui/Divider';
import Avatar from 'material-ui/Avatar';
import Warning from 'material-ui/svg-icons/alert/warning';
import Error from 'material-ui/svg-icons/alert/error';
import IconButton from 'material-ui/IconButton';
import CloseIcon from 'material-ui/svg-icons/navigation/close';
import { red500, amber500, grey700 } from 'material-ui/styles/colors';

class BlunderAnalysis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      analyzing: false,
      blunders: [],
      currentMoveIndex: 0
    };
  }

  componentDidMount() {
    if (this.props.open && !this.state.analyzing && this.state.blunders.length === 0) {
      this.analyzeGame();
    }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.open && this.props.open && !this.state.analyzing && this.state.blunders.length === 0) {
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
    
    // Keep track of move evaluations
    const moveEvaluations = [];
    let currentMoveIndex = 0;
    
    sf.onmessage = (event) => {
      const message = event.data ? event.data : event;
      
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
        
        // Get depth
        const depthMatch = message.match(/depth (\d+)/);
        if (depthMatch && parseInt(depthMatch[1]) >= 15) {
          moveEvaluations[currentMoveIndex] = score;
        }
      } else if (message.startsWith('bestmove')) {
        // Move to next position
        currentMoveIndex++;
        
        // If we've analyzed all positions
        if (currentMoveIndex >= historicalStates.length - 1) {
          this.findBlunders(moveEvaluations);
        } else {
          // Analyze next position
          sf.postMessage(`position fen ${historicalStates[currentMoveIndex]}`);
          sf.postMessage('go depth 15');
        }
      }
    };
    
    // Start analysis from first position
    sf.postMessage(`position fen ${historicalStates[0]}`);
    sf.postMessage('go depth 15');
  }
  
  findBlunders = (evaluations) => {
    const blunders = [];
    const { historicalStates } = this.props;
    
    // Loop through evaluations and find significant swings
    for (let i = 1; i < evaluations.length; i++) {
      const prevEval = evaluations[i-1];
      const currEval = evaluations[i];
      
      if (prevEval && currEval) {
        // Calculate evaluation difference
        const evalDiff = Math.abs(prevEval - currEval);
        
        // Determine if move was played by white or black
        const chess = new (require('./chess.js').Chess)(historicalStates[i-1]);
        const player = chess.turn() === 'w' ? 'White' : 'Black';
        
        // Check if the move was a mistake or blunder
        if (evalDiff >= 3.0) {
          blunders.push({
            move: i,
            player,
            evalBefore: prevEval.toFixed(2),
            evalAfter: currEval.toFixed(2),
            magnitude: 'blunder',
            fen: historicalStates[i]
          });
        } else if (evalDiff >= 1.0) {
          blunders.push({
            move: i,
            player,
            evalBefore: prevEval.toFixed(2),
            evalAfter: currEval.toFixed(2),
            magnitude: 'mistake',
            fen: historicalStates[i]
          });
        }
      }
    }
    
    this.setState({ analyzing: false, blunders });
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

  render() {
    const { open } = this.props;
    const { analyzing, blunders } = this.state;
    
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
        ) : blunders.length > 0 ? (
          <div>
            <p>The following blunders and mistakes were found:</p>
            <p style={{ fontSize: '0.8em', fontStyle: 'italic', marginBottom: '15px' }}>Click on a blunder to view the position on the board</p>
            <List>
              {blunders.map((blunder, index) => (
                <div key={index}>
                  <ListItem
                    leftAvatar={
                      <Avatar
                        icon={blunder.magnitude === 'blunder' ? <Error /> : <Warning />}
                        backgroundColor={blunder.magnitude === 'blunder' ? red500 : amber500}
                      />
                    }
                    primaryText={`Move ${Math.ceil(blunder.move/2)} - ${blunder.player}`}
                    secondaryText={
                      <p>
                        Evaluation changed from {blunder.evalBefore} to {blunder.evalAfter}.
                        This was a {blunder.magnitude}.
                      </p>
                    }
                    secondaryTextLines={2}
                    onClick={() => this.jumpToPosition(blunder.fen, blunder.move)}
                    style={{cursor: 'pointer'}}
                  />
                  <Divider inset={true} />
                </div>
              ))}
            </List>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            No significant blunders were found in this game.
          </div>
        )}
      </Dialog>
    );
  }
}

export default BlunderAnalysis; 