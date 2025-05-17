import React, { Component } from 'react';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import { RadioButton, RadioButtonGroup } from 'material-ui/RadioButton';
import TextField from 'material-ui/TextField';
import { generateGameId } from './firebase';
import Paper from 'material-ui/Paper';
import Divider from 'material-ui/Divider';

class GameModeDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      gameMode: 'ai',
      joinGame: false,
      gameId: generateGameId(),
      playerColor: 'w',
      error: ''
    };
  }

  handleGameModeChange = (event, value) => {
    this.setState({ gameMode: value, joinGame: false });
  };

  handleJoinTypeChange = (event, value) => {
    const joinGame = value === 'join';
    const gameId = joinGame ? this.state.gameId : generateGameId();
    this.setState({ joinGame, gameId });
  };

  handleColorChange = (event, value) => {
    this.setState({ playerColor: value });
  };

  handleGameIdChange = (event) => {
    this.setState({ gameId: event.target.value });
  };

  handleSubmit = () => {
    const { gameMode, joinGame, gameId, playerColor } = this.state;
    
    if (gameMode === 'multiplayer' && joinGame && !gameId) {
      this.setState({ error: 'Please enter a game ID' });
      return;
    }
    
    this.props.onSubmit({
      gameMode,
      joinGame,
      gameId: gameMode === 'multiplayer' ? gameId : null,
      playerColor: gameMode === 'multiplayer' ? playerColor : 'w'
    });
  };

  render() {
    const { open, onClose } = this.props;
    const { gameMode, joinGame, gameId, playerColor, error } = this.state;
    
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
      />
    ];
    
    const styles = {
      radioButton: {
        marginBottom: 16,
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
              <TextField
                floatingLabelText="Enter Game ID"
                fullWidth={true}
                value={gameId}
                onChange={this.handleGameIdChange}
                errorText={error}
              />
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
                style={styles.radioButton}
              />
              <RadioButton
                value="b"
                label="Play as Black"
                style={styles.radioButton}
              />
            </RadioButtonGroup>
          </Paper>
        )}
      </Dialog>
    );
  }
}

export default GameModeDialog; 