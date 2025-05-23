import React, { Component } from 'react';
import { firestore } from '../firebase';
import Paper from 'material-ui/Paper';
import Avatar from 'material-ui/Avatar';
import TextField from 'material-ui/TextField';
import RaisedButton from 'material-ui/RaisedButton';
import Chip from 'material-ui/Chip';

class UserProfile extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isEditing: false,
      displayName: (props.currentUser && props.currentUser.displayName) || '',
      originalDisplayName: (props.currentUser && props.currentUser.displayName) || '',
      saving: false
    };
  }

  handleSaveProfile = async () => {
    const { currentUser } = this.props;
    const { displayName } = this.state;
    
    if (!currentUser || this.props.isGuest) return;
    
    this.setState({ saving: true });

    try {
      if (firestore) {
        await firestore.doc(`users/${currentUser.id}`).update({
          displayName: displayName.trim()
        });
      }
      
      this.setState({ 
        isEditing: false,
        originalDisplayName: displayName.trim(),
        saving: false
      });
      
      // Update the display name in the parent component
      if (this.props.onUpdateProfile) {
        this.props.onUpdateProfile({ displayName: displayName.trim() });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      this.setState({ saving: false });
    }
  }

  handleCancelEdit = () => {
    this.setState({
      isEditing: false,
      displayName: this.state.originalDisplayName
    });
  }

  render() {
    const { currentUser, isGuest } = this.props;
    const { isEditing, displayName, saving } = this.state;

    if (isGuest) {
      return (
        <Paper style={{ padding: '20px', margin: '20px', textAlign: 'center' }}>
          <h3>Guest Profile</h3>
          <Avatar style={{ margin: 'auto', marginBottom: '20px' }}>G</Avatar>
          <p>You are playing as a guest. Sign in to save your progress and play with friends!</p>
        </Paper>
      );
    }

    if (!currentUser) return null;

    const winRate = currentUser.gamesPlayed > 0 
      ? ((currentUser.gamesWon / currentUser.gamesPlayed) * 100).toFixed(1)
      : 0;

    return (
      <Paper style={{ padding: '20px', margin: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          {currentUser.photoURL ? (
            <Avatar 
              src={currentUser.photoURL} 
              size={80}
              style={{ margin: 'auto', marginBottom: '20px' }}
            />
          ) : (
            <Avatar 
              size={80}
              style={{ margin: 'auto', marginBottom: '20px' }}
            >
              {currentUser.displayName.charAt(0)}
            </Avatar>
          )}
          
          {isEditing ? (
            <div>
              <TextField
                value={displayName}
                onChange={(e) => this.setState({ displayName: e.target.value })}
                hintText="Display Name"
                style={{ marginBottom: '10px' }}
              />
              <br />
              <RaisedButton
                label={saving ? "Saving..." : "Save"}
                primary={true}
                onClick={this.handleSaveProfile}
                disabled={saving || !displayName.trim()}
                style={{ marginRight: '10px' }}
              />
              <RaisedButton
                label="Cancel"
                onClick={this.handleCancelEdit}
                disabled={saving}
              />
            </div>
          ) : (
            <div>
              <h2 style={{ margin: '10px 0' }}>{currentUser.displayName}</h2>
              <RaisedButton
                label="Edit Profile"
                onClick={() => this.setState({ isEditing: true })}
                style={{ marginBottom: '20px' }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
          <Chip style={{ margin: '5px' }}>
            Rating: {currentUser.rating || 1200}
          </Chip>
          <Chip style={{ margin: '5px' }}>
            Games Played: {currentUser.gamesPlayed || 0}
          </Chip>
          <Chip style={{ margin: '5px' }}>
            Games Won: {currentUser.gamesWon || 0}
          </Chip>
          <Chip style={{ margin: '5px' }}>
            Win Rate: {winRate}%
          </Chip>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Member since: {currentUser.createdAt && typeof currentUser.createdAt.toDate === 'function' 
              ? new Date(currentUser.createdAt.toDate()).toLocaleDateString()
              : new Date().toLocaleDateString()}
          </p>
          {currentUser.isOnline ? (
            <Chip backgroundColor="#4CAF50" labelColor="white">
              Online
            </Chip>
          ) : (
            <Chip backgroundColor="#757575" labelColor="white">
              Offline
            </Chip>
          )}
        </div>
      </Paper>
    );
  }
}

export default UserProfile; 