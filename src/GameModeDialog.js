import React, { Component } from 'react';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import { RadioButton, RadioButtonGroup } from 'material-ui/RadioButton';
import TextField from 'material-ui/TextField';
import { generateGameId, isColorTaken, getGameData } from './firebase';
import Paper from 'material-ui/Paper';
import Divider from 'material-ui/Divider';
import CircularProgress from 'material-ui/CircularProgress';
import SelectField from 'material-ui/SelectField';
import MenuItem from 'material-ui/MenuItem';

class GameModeDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      gameMode: 'ai',
      joinGame: false,
      gameId: generateGameId(),
      playerColor: 'w',
      error: '',
      loading: false,
      oppositeColorSelected: false,
      gameData: null,
      timeControl: 'none' // Default to no timer
    };
  }

  handleGameModeChange = (event, value) => {
    this.setState({ 
      gameMode: value, 
      joinGame: false, 
      oppositeColorSelected: false,
      gameData: null
    });
  };

  handleJoinTypeChange = (event, value) => {
    const joinGame = value === 'join';
    const gameId = joinGame ? this.state.gameId : generateGameId();
    this.setState({ 
      joinGame, 
      gameId, 
      oppositeColorSelected: false,
      gameData: null,
      error: ''
    });
  };

  handleGameIdChange = async (event) => {
    const gameId = event.target.value;
    this.setState({ gameId, loading: true, error: '' });
    
    // If we're joining a game, check if it exists and which colors are taken
    if (gameId) {
      try {
        const gameData = await getGameData(gameId);
        if (gameData && gameData.players) {
          // Check which colors are taken
          const whiteIsTaken = !!gameData.players.w;
          const blackIsTaken = !!gameData.players.b;
          
          let playerColor = this.state.playerColor;
          let oppositeColorSelected = false;
          
          // Auto-select the opposite color
          if (whiteIsTaken && !blackIsTaken) {
            playerColor = 'b'; // White is taken, select black
            oppositeColorSelected = true;
          } else if (blackIsTaken && !whiteIsTaken) {
            playerColor = 'w'; // Black is taken, select white
            oppositeColorSelected = true;
          }
          
          // Get time control from existing game
          const timeControl = gameData.timeControl || 'none';
          
          this.setState({ 
            playerColor, 
            oppositeColorSelected, 
            gameData, 
            loading: false,
            timeControl
          });
        } else {
          this.setState({ 
            loading: false, 
            error: 'Game not found' 
          });
        }
      } catch (error) {
        console.error("Error checking game:", error);
        this.setState({ 
          loading: false,
          error: 'Error checking game'
        });
      }
    } else {
      this.setState({ loading: false });
    }
  };

  handleColorChange = (event, value) => {
    this.setState({ playerColor: value });
  };

  handleTimeControlChange = (event, index, value) => {
    this.setState({ timeControl: value });
  };

  handleSubmit = async () => {
    const { gameMode, joinGame, gameId, playerColor, timeControl } = this.state;
    
    if (gameMode === 'multiplayer' && joinGame && !gameId) {
      this.setState({ error: 'Please enter a game ID' });
      return;
    }
    
    if (gameMode === 'multiplayer' && joinGame) {
      // For joining games, verify the game exists and color is available
      try {
        const gameExists = await isColorTaken(gameId, playerColor);
        if (gameExists) {
          this.setState({ error: `The color ${playerColor === 'w' ? 'white' : 'black'} is already taken in this game` });
          return;
        }
      } catch (error) {
        console.error("Error checking color:", error);
      }
    }
    
    this.props.onSubmit({
      gameMode,
      joinGame,
      gameId: gameMode === 'multiplayer' ? gameId : null,
      playerColor: gameMode === 'multiplayer' ? playerColor : 'w',
      timeControl
    });
  };

  render() {
    const { open, onClose } = this.props;
    const { gameMode, joinGame, gameId, playerColor, error, loading, oppositeColorSelected, gameData, timeControl } = this.state;
    
    const actions = [
      <FlatButton
        label="CANCEL"
        primary={true}
        style={{ color: '#333' }}
        onClick={onClose}
      />,
      <FlatButton
        label="START GAME"
        primary={true}
        style={{ color: '#333' }}
        onClick={this.handleSubmit}
        disabled={loading || (joinGame && !gameId)}
      />
    ];
    
    // Determine which color is available for joining
    let whiteDisabled = false;
    let blackDisabled = false;
    
    if (joinGame && gameData && gameData.players) {
      whiteDisabled = !!gameData.players.w;
      blackDisabled = !!gameData.players.b;
    }
    
    const styles = {
      radioButton: {
        marginBottom: 16,
      },
      disabledRadioButton: {
        marginBottom: 16,
        color: '#999',
        cursor: 'not-allowed'
      },
      group: {
        padding: '10px 0',
      },
      container: {
        padding: '20px',
        marginTop: '10px',
        marginBottom: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
      },
      title: {
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '15px',
        color: '#333'
      },
      header: {
        marginBottom: '20px',
        textAlign: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#333'
      },
      gameId: {
        fontSize: '20px',
        fontWeight: 'bold',
        padding: '10px',
        backgroundColor: '#e0e0e0',
        borderRadius: '4px',
        display: 'inline-block',
        marginTop: '10px'
      },
      loadingContainer: {
        display: 'flex',
        justifyContent: 'center',
        marginTop: '10px'
      }
    };

    return (
      <Dialog
        title="Choose Game Mode"
        actions={actions}
        modal={false}
        open={open}
        onRequestClose={onClose}
        autoScrollBodyContent={true}
        contentStyle={{ width: '90%', maxWidth: '500px' }}
      >
        <div style={styles.header}>
          Select how you want to play
        </div>
        
        <Paper style={styles.container}>
          <div style={styles.title}>Game Mode</div>
          <RadioButtonGroup 
            name="gameMode" 
            valueSelected={gameMode} 
            onChange={this.handleGameModeChange}
            style={styles.group}
          >
            <RadioButton
              value="ai"
              label="Play against AI"
              style={styles.radioButton}
            />
            <RadioButton
              value="multiplayer"
              label="Play with a friend"
              style={styles.radioButton}
            />
          </RadioButtonGroup>
        </Paper>
        
        {gameMode === 'multiplayer' && (
          <Paper style={styles.container}>
            <div style={styles.title}>Multiplayer Options</div>
            <RadioButtonGroup 
              name="joinType" 
              valueSelected={joinGame ? 'join' : 'create'} 
              onChange={this.handleJoinTypeChange}
              style={styles.group}
            >
              <RadioButton
                value="create"
                label="Create a new game"
                style={styles.radioButton}
              />
              <RadioButton
                value="join"
                label="Join an existing game"
                style={styles.radioButton}
              />
            </RadioButtonGroup>
            
            {joinGame ? (
              <div>
                <TextField
                  floatingLabelText="Enter Game ID"
                  fullWidth={true}
                  value={gameId}
                  onChange={this.handleGameIdChange}
                  errorText={error}
                />
                {loading && (
                  <div style={styles.loadingContainer}>
                    <CircularProgress size={24} />
                  </div>
                )}
                {oppositeColorSelected && (
                  <div style={{color: '#4caf50', marginTop: '10px'}}>
                    Auto-selected {playerColor === 'w' ? 'white' : 'black'} as it's the only available color
                  </div>
                )}
              </div>
            ) : (
              <div style={{textAlign: 'center', marginTop: '15px'}}>
                <p>Your Game ID:</p>
                <div style={styles.gameId}>{gameId}</div>
                <p style={{marginTop: '15px'}}>Share this ID with your opponent</p>
              </div>
            )}
            
            <Divider style={{margin: '20px 0'}} />
            
            <div style={styles.title}>Choose your color</div>
            <RadioButtonGroup 
              name="playerColor" 
              valueSelected={playerColor} 
              onChange={this.handleColorChange}
              style={styles.group}
            >
              <RadioButton
                value="w"
                label="Play as White (moves first)"
                style={whiteDisabled ? styles.disabledRadioButton : styles.radioButton}
                disabled={whiteDisabled}
              />
              <RadioButton
                value="b"
                label="Play as Black"
                style={blackDisabled ? styles.disabledRadioButton : styles.radioButton}
                disabled={blackDisabled}
              />
            </RadioButtonGroup>
            {(whiteDisabled && blackDisabled) && (
              <div style={{color: '#f44336', marginTop: '10px'}}>
                This game is full - both colors are already taken.
              </div>
            )}
            
            <Divider style={{margin: '20px 0'}} />
            
            <div style={{...styles.title, fontSize: '20px', color: '#2196F3'}}>Time Control</div>
            <div style={{marginBottom: '15px', color: '#666'}}>
              Select how much time each player will have for the entire game:
            </div>
            <SelectField
              floatingLabelText="Time per player"
              value={timeControl}
              onChange={this.handleTimeControlChange}
              fullWidth={true}
              disabled={joinGame && gameData && gameData.timeControl}
              style={{marginBottom: '15px'}}
            >
              <MenuItem value="none" primaryText="No time limit" />
              <MenuItem value="3" primaryText="3 minutes" leftIcon={<div style={{color: '#2196F3'}}>⏱</div>} />
              <MenuItem value="5" primaryText="5 minutes" leftIcon={<div style={{color: '#2196F3'}}>⏱</div>} />
              <MenuItem value="10" primaryText="10 minutes" leftIcon={<div style={{color: '#2196F3'}}>⏱</div>} />
              <MenuItem value="15" primaryText="15 minutes" leftIcon={<div style={{color: '#2196F3'}}>⏱</div>} />
            </SelectField>
            {joinGame && gameData && gameData.timeControl && (
              <div style={{color: '#4caf50', marginTop: '10px'}}>
                Using time control from existing game: {gameData.timeControl === 'none' ? 'No time limit' : `${gameData.timeControl} minutes`}
              </div>
            )}
          </Paper>
        )}
      </Dialog>
    );
  }
}

export default GameModeDialog; 