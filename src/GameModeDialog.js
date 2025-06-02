import React, { Component } from 'react';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import RaisedButton from 'material-ui/RaisedButton';
import { RadioButton, RadioButtonGroup } from 'material-ui/RadioButton';
import TextField from 'material-ui/TextField';
import { generateGameId, isColorTaken, getGameData, getUserFriends, challengeFriend } from './firebase';
import Paper from 'material-ui/Paper';
import Divider from 'material-ui/Divider';
import CircularProgress from 'material-ui/CircularProgress';
import SelectField from 'material-ui/SelectField';
import MenuItem from 'material-ui/MenuItem';
import List from 'material-ui/List/List';
import ListItem from 'material-ui/List/ListItem';
import Avatar from 'material-ui/Avatar';
import Chip from 'material-ui/Chip';
import './GameModeDialog.css';

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
      timeControl: 'none', // Default to no timer
      friends: []
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
    // For custom radio buttons, value is passed directly as 'join' or 'create'
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

  componentDidMount() {
    this.fetchFriends();
  }

  fetchFriends = async () => {
    if (!this.props.currentUser || this.props.isGuest) {
      return;
    }
    
    try {
      const friends = await getUserFriends(this.props.currentUser.id);
      this.setState({ friends });
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  };

  render() {
    const { open, onClose } = this.props;
    const { gameMode, joinGame, gameId, playerColor, error, loading, oppositeColorSelected, gameData, timeControl, friends } = this.state;
    
    const actions = [
      <FlatButton
        label="CANCEL"
        primary={false}
        style={{ 
          color: '#e0c9a6', 
          margin: '0 12px',
          minWidth: '120px',
          borderRadius: '4px',
          border: '1px solid rgba(224, 201, 166, 0.4)'
        }}
        onClick={onClose}
        hoverColor="rgba(224, 201, 166, 0.1)"
        className="game-mode-button-cancel"
      />,
      <RaisedButton
        label="START GAME"
        backgroundColor="#e0c9a6"
        onClick={this.handleSubmit}
        disabled={loading || (joinGame && !gameId)}
        disabledBackgroundColor="rgba(224, 201, 166, 0.3)"
        className="game-mode-button-start"
        style={{ 
          margin: '0 12px',
          minWidth: '120px',
          borderRadius: '4px'
        }}
        labelStyle={{
          color: '#5d4037',
          fontWeight: 'bold'
        }}
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
        color: '#e0c9a6',
        textShadow: '0 1px 1px rgba(0, 0, 0, 0.5)'
      },
      disabledRadioButton: {
        marginBottom: 16,
        color: 'rgba(224, 201, 166, 0.5)',
        cursor: 'not-allowed',
        opacity: 0.6
      },
      group: {
        padding: '10px 0',
      },
      container: {
        padding: '20px',
        marginTop: '20px',
        marginBottom: '20px',
        backgroundColor: '#2d2d2d',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
      },
      title: {
        fontSize: '22px',
        fontWeight: 'bold',
        marginBottom: '5px',
        color: '#e0c9a6',
        letterSpacing: '1px'
      },
      titleUnderline: {
        width: '60px',
        height: '2px',
        backgroundColor: '#e0c9a6',
        marginBottom: '15px'
      },
      header: {
        marginBottom: '30px',
        textAlign: 'center',
        fontSize: '26px',
        fontWeight: 'bold',
        color: '#e0c9a6',
        letterSpacing: '2px'
      },
      gameId: {
        fontSize: '20px',
        fontWeight: 'bold',
        padding: '10px',
        backgroundColor: '#5d4037',
        color: '#e0c9a6',
        borderRadius: '4px',
        display: 'inline-block',
        marginTop: '10px',
        letterSpacing: '1px'
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
        bodyStyle={{ backgroundColor: '#1a1a1a', padding: '20px' }}
        titleStyle={{ backgroundColor: '#5d4037', color: '#e0c9a6', fontWeight: 'bold', letterSpacing: '2px', textAlign: 'center' }}
        actionsContainerStyle={{ 
          backgroundColor: '#1a1a1a', 
          borderTop: '1px solid rgba(224, 201, 166, 0.2)', 
          padding: '16px',
          display: 'flex', 
          justifyContent: 'center'
        }}
      >
        <div style={styles.header}>
          SELECT HOW YOU WANT TO PLAY
        </div>
        
        <Paper style={styles.container} className="game-mode-container">
          <div style={styles.title}>GAME MODE</div>
          <div style={styles.titleUnderline} className="section-title-underline"></div>
          
          {/* Custom radio buttons with full clickable areas */}
          <div className="custom-radio-group">
            {/* AI Option - Explicitly first */}
            <div 
              className={`custom-radio-option radio-option-ai ${gameMode === 'ai' ? 'selected' : ''}`}
              onClick={(e) => this.handleGameModeChange(e, 'ai')}
            >
              <div className="radio-circle">
                {gameMode === 'ai' && <div className="radio-inner-circle"></div>}
              </div>
              <div className="radio-label">Play against AI</div>
            </div>
            
            {/* Friend Option - Explicitly second */}
            <div 
              className={`custom-radio-option radio-option-friend ${gameMode === 'multiplayer' ? 'selected' : ''}`}
              onClick={(e) => this.handleGameModeChange(e, 'multiplayer')}
            >
              <div className="radio-circle">
                {gameMode === 'multiplayer' && <div className="radio-inner-circle"></div>}
              </div>
              <div className="radio-label">Play with a friend</div>
            </div>
          </div>
        </Paper>
        
        {gameMode === 'multiplayer' && (
          <Paper style={styles.container}>
            <div style={styles.title}>MULTIPLAYER OPTIONS</div>
            <div style={styles.titleUnderline}></div>
            
            {/* Custom radio buttons for multiplayer options */}
            <div className="custom-radio-group multiplayer-options-group">
              {/* Create game option */}
              <div 
                className={`custom-radio-option radio-option-create ${!joinGame ? 'selected' : ''}`}
                onClick={(e) => this.handleJoinTypeChange(e, 'create')}
              >
                <div className="radio-circle">
                  {!joinGame && <div className="radio-inner-circle"></div>}
                </div>
                <div className="radio-label">Create a new game</div>
              </div>
              
              {/* Join game option */}
              <div 
                className={`custom-radio-option radio-option-join ${joinGame ? 'selected' : ''}`}
                onClick={(e) => this.handleJoinTypeChange(e, 'join')}
              >
                <div className="radio-circle">
                  {joinGame && <div className="radio-inner-circle"></div>}
                </div>
                <div className="radio-label">Join an existing game</div>
              </div>
            </div>
            
            {/* Friends List Section */}
            {this.props.currentUser && !this.props.isGuest && (
              <div style={{ marginTop: '20px', marginBottom: '20px', backgroundColor: '#2d2d2d', padding: '20px', borderRadius: '4px', boxShadow: '0 3px 10px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ ...styles.title, color: '#e0c9a6', textAlign: 'center', fontSize: '22px', letterSpacing: '1.5px', textShadow: '0 2px 4px rgba(0, 0, 0, 0.7)' }}>PLAY WITH FRIENDS</div>
                <div style={{...styles.titleUnderline, margin: '0 auto 20px auto'}} className="section-title-underline"></div>
                {friends.length > 0 ? (
                  <List style={{ maxHeight: '250px', overflowY: 'auto', border: '2px solid rgba(224, 201, 166, 0.6)', borderRadius: '8px', backgroundColor: '#262626', padding: '15px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
                    {friends.map(friend => (
                      <ListItem
                        key={friend.id}
                        style={{ 
                          cursor: 'pointer',
                          backgroundColor: '#3c3c3c',
                          marginBottom: '8px',
                          borderRadius: '4px',
                          border: '1px solid #4e4e4e',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          paddingTop: '4px',
                          paddingBottom: '4px'
                        }}
                        leftAvatar={
                          friend.photoURL ? (
                            <Avatar src={friend.photoURL} style={{border: '1px solid #e0c9a6', width: 36, height: 36}} />
                          ) : (
                            <Avatar style={{backgroundColor: '#e0c9a6', color: '#3c3c3c', border: '1px solid #5d4037', width: 36, height: 36, fontWeight: 'bold'}}>{friend.displayName.charAt(0)}</Avatar>
                          )
                        }
                        primaryText={
                          <div style={{color: '#FFFFFF', fontWeight: '600', fontSize: '18px', textShadow: '0 1px 1px rgba(0, 0, 0, 0.9)', letterSpacing: '0.5px', padding: '1px 0', textAlign: 'center', margin: '0', marginTop: '-12px'}}>
                            {friend.displayName}
                          </div>
                        }
                        secondaryText={
                          <div style={{marginTop: '3px', marginBottom: '0', position: 'relative'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                              <span style={{color: '#e0c9a6', fontWeight: 'bold', fontSize: '15px', textShadow: '0 1px 1px rgba(0, 0, 0, 0.7)'}}>Rating: {friend.rating || 'Unrated'}</span>
                              {friend.isOnline ? (
                                <div style={{marginRight: '5px'}}>
                                  <div style={{backgroundColor: '#4CAF50', color: 'white', fontWeight: 'bold', fontSize: '14px', padding: '2px 10px', borderRadius: '4px', border: '2px solid #388E3C', boxShadow: '0 2px 4px rgba(0,0,0,0.7)', display: 'inline-block'}}>
                                    Online
                                  </div>
                                </div>
                              ) : (
                                <div style={{marginRight: '5px'}}>
                                  <div style={{backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '14px', padding: '2px 10px', borderRadius: '4px', border: '2px solid #5d4037', boxShadow: '0 2px 4px rgba(0,0,0,0.7)', display: 'inline-block'}}>
                                    Offline
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        }
                        onClick={() => {
                          // Generate a game ID and use it to challenge this friend
                          const newGameId = generateGameId();
                          this.setState({ gameId: newGameId }, () => {
                            // Challenge this friend with the game ID
                            challengeFriend(this.props.currentUser.id, friend.id, this.state.timeControl, newGameId);
                            // Start the game
                            this.handleSubmit();
                          });
                        }}
                      />
                    ))}
                  </List>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#ffffff', fontWeight: '500', backgroundColor: 'rgba(93, 64, 55, 0.3)', borderRadius: '4px', border: '1px solid rgba(224, 201, 166, 0.2)', marginTop: '10px' }}>
                    No friends found. Add friends to challenge them directly!
                  </div>
                )}
              </div>
            )}
            
            {joinGame ? (
              <div>
                <div style={{display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '15px'}}>
                  <TextField
                    floatingLabelText="Enter Game ID"
                    underlineShow={false}
                    style={{flex: 1, backgroundColor: '#2a2a2a', border: '1px solid #e0c9a6', borderRadius: '4px', padding: '8px'}}
                    value={gameId}
                    onChange={this.handleGameIdChange}
                    errorText={error}
                    underlineStyle={{display: 'none'}}
                    underlineFocusStyle={{display: 'none'}}
                    inputStyle={{color: '#ffffff'}}
                    floatingLabelStyle={{color: '#e0c9a6'}}
                    errorStyle={{color: '#ff7043'}}
                  />
                  <RaisedButton
                    label="Search"
                    style={{minWidth: '100px', marginBottom: error ? '20px' : '0px'}}
                    backgroundColor="#e0c9a6"
                    labelStyle={{color: '#5d4037', fontWeight: 'bold'}}
                    onClick={() => this.handleGameIdChange({target: {value: gameId}})}
                    disabled={!gameId || loading}
                  />
                </div>
                {loading && (
                  <div style={styles.loadingContainer}>
                    <CircularProgress size={24} color="#e0c9a6" />
                  </div>
                )}
                {oppositeColorSelected && (
                  <div style={{color: '#e0c9a6', marginTop: '10px', textAlign: 'center'}}>
                    Auto-selected {playerColor === 'w' ? 'white' : 'black'} as it's the only available color
                  </div>
                )}
              </div>
            ) : (
              <div style={{textAlign: 'center', marginTop: '15px'}}>
                <p style={{color: '#e0c9a6', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px'}}>YOUR GAME ID:</p>
                <div style={{...styles.gameId, maxWidth: '200px', margin: '0 auto', padding: '12px', fontSize: '22px', fontWeight: 'bold', letterSpacing: '2px', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(224, 201, 166, 0.3)'}}>{gameId}</div>
                <p style={{marginTop: '15px', color: '#ffffff', fontStyle: 'italic', opacity: 0.9}}>Share this ID with your opponent</p>
              </div>
            )}
            
            <Divider style={{margin: '20px 0'}} />
            
            <div style={styles.title}>CHOOSE YOUR COLOR</div>
            <div style={styles.titleUnderline}></div>
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
                labelStyle={{color: whiteDisabled ? 'rgba(255, 255, 255, 0.4)' : '#ffffff', fontWeight: 500}}
                iconStyle={{fill: whiteDisabled ? 'rgba(224, 201, 166, 0.4)' : '#e0c9a6'}}
                disabled={whiteDisabled}
              />
              <RadioButton
                value="b"
                label="Play as Black"
                style={blackDisabled ? styles.disabledRadioButton : styles.radioButton}
                labelStyle={{color: blackDisabled ? 'rgba(255, 255, 255, 0.4)' : '#ffffff', fontWeight: 500}}
                iconStyle={{fill: blackDisabled ? 'rgba(224, 201, 166, 0.4)' : '#e0c9a6'}}
                disabled={blackDisabled}
              />
            </RadioButtonGroup>
            {(whiteDisabled && blackDisabled) && (
              <div style={{color: '#ff7043', marginTop: '10px'}}>
                This game is full - both colors are already taken.
              </div>
            )}
            
            <Divider style={{margin: '20px 0'}} />
            
            <div style={{...styles.title, fontSize: '20px', color: '#e0c9a6'}}>TIME CONTROL</div>
            <div style={styles.titleUnderline}></div>
            <div style={{marginBottom: '15px', color: '#ffffff', fontWeight: 400, textShadow: '0 1px 1px rgba(0, 0, 0, 0.5)'}}>
              Select how much time each player will have for the entire game:
            </div>
            <SelectField
              floatingLabelText="Time per player"
              value={timeControl}
              onChange={this.handleTimeControlChange}
              fullWidth={true}
              disabled={joinGame && gameData && gameData.timeControl}
              style={{marginBottom: '15px'}}
              labelStyle={{color: '#ffffff'}}
              floatingLabelStyle={{color: '#e0c9a6'}}
              underlineStyle={{display: 'none'}}
              underlineFocusStyle={{display: 'none'}}
              menuItemStyle={{color: '#e0c9a6'}}
              iconStyle={{fill: '#e0c9a6'}}
            >
              <MenuItem value="none" primaryText="No time limit" style={{color: '#e0c9a6'}} />
              <MenuItem value="3" primaryText="3 minutes" leftIcon={<div style={{color: '#e0c9a6'}}>⏱</div>} style={{color: '#e0c9a6'}} />
              <MenuItem value="5" primaryText="5 minutes" leftIcon={<div style={{color: '#e0c9a6'}}>⏱</div>} style={{color: '#e0c9a6'}} />
              <MenuItem value="10" primaryText="10 minutes" leftIcon={<div style={{color: '#e0c9a6'}}>⏱</div>} style={{color: '#e0c9a6'}} />
              <MenuItem value="15" primaryText="15 minutes" leftIcon={<div style={{color: '#e0c9a6'}}>⏱</div>} style={{color: '#e0c9a6'}} />
            </SelectField>
            {joinGame && gameData && gameData.timeControl && (
              <div style={{color: '#e0c9a6', marginTop: '10px'}}>
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