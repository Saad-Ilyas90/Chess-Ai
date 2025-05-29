import React, { Component } from 'react';
import { firestore } from '../firebase';
import Paper from 'material-ui/Paper';
import Avatar from 'material-ui/Avatar';
import TextField from 'material-ui/TextField';
import RaisedButton from 'material-ui/RaisedButton';
import FlatButton from 'material-ui/FlatButton';
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
        <Paper style={{ padding: '30px', margin: '20px auto', maxWidth: '800px', textAlign: 'center', backgroundColor: '#2a2a2a', color: '#e0c9a6', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)' }}>
          <h3 style={{ fontSize: '24px', color: '#e0c9a6', marginBottom: '20px' }}>Guest Profile</h3>
          <div style={{ width: '120px', height: '120px', margin: '0 auto 30px', borderRadius: '60px', backgroundColor: '#5d4037', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '3px solid #e0c9a6', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)' }}>
            <span style={{ fontSize: '60px', color: '#e0c9a6' }}>G</span>
          </div>
          <p style={{ color: '#e0c9a6', fontSize: '16px', lineHeight: '1.6', maxWidth: '80%', margin: '0 auto' }}>You are playing as a guest. Sign in to save your progress and play with friends!</p>
          <RaisedButton
            label="Sign In"
            primary={true}
            backgroundColor="#5d4037"
            labelColor="#e0c9a6"
            style={{ marginTop: '25px' }}
            onClick={this.props.onSignIn}
          />
        </Paper>
      );
    }

    if (!currentUser) return null;

    const winRate = currentUser.gamesPlayed > 0 
      ? ((currentUser.gamesWon / currentUser.gamesPlayed) * 100).toFixed(1)
      : 0;

    return (
      <Paper style={{ padding: '40px', margin: '20px auto', maxWidth: '800px', backgroundColor: '#2a2a2a', color: '#e0c9a6', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)', borderRadius: '8px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          {currentUser.photoURL ? (
            <div style={{ width: '120px', height: '120px', margin: '0 auto 30px', borderRadius: '60px', overflow: 'hidden', border: '3px solid #e0c9a6', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)' }}>
              <img src={currentUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={currentUser.displayName} />
            </div>
          ) : (
            <div style={{ width: '120px', height: '120px', margin: '0 auto 30px', borderRadius: '60px', backgroundColor: '#5d4037', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '3px solid #e0c9a6', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)' }}>
              <span style={{ fontSize: '60px', color: '#e0c9a6' }}>{currentUser.displayName.charAt(0)}</span>
            </div>
          )}
          
          {isEditing ? (
            <div>
              <TextField
                value={displayName}
                onChange={(e) => this.setState({ displayName: e.target.value })}
                hintText="Display Name"
                style={{ marginBottom: '20px', color: '#e0c9a6' }}
                inputStyle={{ color: '#e0c9a6' }}
                hintStyle={{ color: 'rgba(224, 201, 166, 0.5)' }}
              />
              <br />
              <RaisedButton
                label={saving ? "Saving..." : "Save"}
                primary={true}
                backgroundColor="#5d4037"
                labelColor="#e0c9a6"
                onClick={this.handleSaveProfile}
                disabled={saving || !displayName.trim()}
                style={{ marginRight: '10px' }}
                disabledBackgroundColor="rgba(93, 64, 55, 0.5)"
                disabledLabelColor="rgba(224, 201, 166, 0.5)"
              />
              <RaisedButton
                label="Cancel"
                onClick={this.handleCancelEdit}
                disabled={saving}
                backgroundColor="#2d2d2d"
                labelColor="#e0c9a6"
                disabledBackgroundColor="rgba(45, 45, 45, 0.5)"
                disabledLabelColor="rgba(224, 201, 166, 0.5)"
              />
            </div>
          ) : (
            <div>
              <h2 style={{ margin: '15px 0', color: '#e0c9a6', fontSize: '32px', fontWeight: 'bold' }}>{currentUser.displayName}</h2>
              <FlatButton
                label="Edit Profile"
                onClick={() => this.setState({ isEditing: true })}
                backgroundColor="#5d4037"
                hoverColor="#6d5047"
                labelStyle={{ color: '#e0c9a6', fontWeight: 'bold', padding: '0 16px' }}
                style={{ marginBottom: '20px', border: '2px solid #e0c9a6', borderRadius: '4px' }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', margin: '30px 0', backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
          <Chip style={{ margin: '10px', backgroundColor: '#5d4037', color: '#e0c9a6', border: '1px solid #e0c9a6', height: '32px', borderRadius: '16px' }} labelStyle={{ color: '#e0c9a6', fontWeight: 'bold' }}>
            Rating: {currentUser.rating || 1200}
          </Chip>
          <Chip style={{ margin: '10px', backgroundColor: '#5d4037', color: '#e0c9a6', border: '1px solid #e0c9a6', height: '32px', borderRadius: '16px' }} labelStyle={{ color: '#e0c9a6', fontWeight: 'bold' }}>
            Games Played: {currentUser.gamesPlayed || 0}
          </Chip>
          <Chip style={{ margin: '10px', backgroundColor: '#5d4037', color: '#e0c9a6', border: '1px solid #e0c9a6', height: '32px', borderRadius: '16px' }} labelStyle={{ color: '#e0c9a6', fontWeight: 'bold' }}>
            Games Won: {currentUser.gamesWon || 0}
          </Chip>
          <Chip style={{ margin: '10px', backgroundColor: '#5d4037', color: '#e0c9a6', border: '1px solid #e0c9a6', height: '32px', borderRadius: '16px' }} labelStyle={{ color: '#e0c9a6', fontWeight: 'bold' }}>
            Win Rate: {winRate}%
          </Chip>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center', backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
          <p style={{ color: '#e0c9a6', fontSize: '16px', marginBottom: '15px' }}>
            Member since: {currentUser.createdAt && typeof currentUser.createdAt.toDate === 'function' 
              ? new Date(currentUser.createdAt.toDate()).toLocaleDateString()
              : new Date().toLocaleDateString()}
          </p>
          {currentUser.isOnline ? (
            <Chip backgroundColor="#5d4037" labelColor="#e0c9a6">
              Online
            </Chip>
          ) : (
            <Chip backgroundColor="#5d4037" labelColor="#e0c9a6">
              Offline
            </Chip>
          )}
        </div>
      </Paper>
    );
  }
}

export default UserProfile; 