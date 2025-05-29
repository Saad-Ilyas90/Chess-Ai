import React, { Component } from 'react';
import './FriendsPanel.custom.css';
import { 
  getUserFriends, 
  sendFriendRequest, 
  acceptFriendRequest, 
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  searchUsersByEmail,
  challengeFriend,
  getUserNotifications,
  firestore,
  testFirestorePermissions,
  clearStaleRequests,
  generateGameId,
  createGameSession,
  joinGame,
  ensureAuthenticated,
  checkGameExists,
  getGameData
} from '../firebase';
import {
  resetFriendRequestsReadStatus,
  getAllFriendRequests,
  validateNotifications
} from '../debug/friendRequestDebug';
import Paper from 'material-ui/Paper';
import TextField from 'material-ui/TextField';
import RaisedButton from 'material-ui/RaisedButton';
import FlatButton from 'material-ui/FlatButton';
import List from 'material-ui/List';
import ListItem from 'material-ui/List/ListItem';
import Avatar from 'material-ui/Avatar';
import Badge from 'material-ui/Badge';
import Dialog from 'material-ui/Dialog';
import Divider from 'material-ui/Divider';
import Chip from 'material-ui/Chip';
import IconButton from 'material-ui/IconButton';
import PersonIcon from 'material-ui/svg-icons/social/person';

class FriendsPanel extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      friends: [],
      searchResults: [],
      searchTerm: '',
      isSearching: false,
      notifications: [],
      showSearchDialog: false,
      showNotifications: false,
      showFriendRequests: false,
      challengingFriendId: null,
      timeControlForChallenge: 'none',
      searchByEmail: true, // Default to email search
      emailError: null,
      successMessage: null,
      isProcessingRequest: false,
      showDebugPanel: false // Debug panel toggle state
    };
  }

  unsubscribeFromNotifications = null;

  componentDidMount() {
    this.loadFriends();
    this.setupNotificationListener();
    console.log('Initial search mode:', this.state.searchByEmail ? 'Email' : 'Username');
    
    // Test Firestore permissions
    this.testPermissions();
  }

  componentDidUpdate(prevProps, prevState) {
    // Reload friends when user or guest status changes
    if (prevProps.currentUser !== this.props.currentUser || prevProps.isGuest !== this.props.isGuest) {
      this.loadFriends();
    }
    if (prevState.searchByEmail !== this.state.searchByEmail) {
      console.log('Search mode changed to:', this.state.searchByEmail ? 'Email' : 'Username');
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeFromNotifications) {
      this.unsubscribeFromNotifications();
    }
  }

  // Debug functions for testing
  debugClearRequests = async () => {
    if (!this.props.currentUser) return;
    
    try {
      console.log('[DEBUG] Clearing stale friend requests...');
      const result = await clearStaleRequests(this.props.currentUser.id);
      if (result) {
        this.setState({ 
          successMessage: 'Debug: Cleared all friend requests successfully!' 
        });
      } else {
        this.setState({ 
          successMessage: 'Debug: Failed to clear friend requests' 
        });
      }
      setTimeout(() => this.setState({ successMessage: null }), 3000);
    } catch (error) {
      console.error('[DEBUG] Error clearing requests:', error);
      this.setState({ 
        successMessage: `Debug Error: ${error.message}` 
      });
      setTimeout(() => this.setState({ successMessage: null }), 3000);
    }
  }

  debugTestPermissions = async () => {
    try {
      console.log('[DEBUG] Testing Firestore permissions...');
      const result = await testFirestorePermissions();
      if (result) {
        this.setState({ 
          successMessage: 'Debug: Firestore permissions are working!' 
        });
      } else {
        this.setState({ 
          successMessage: 'Debug: Firestore permissions failed - check rules deployment' 
        });
      }
      setTimeout(() => this.setState({ successMessage: null }), 5000);
    } catch (error) {
      console.error('[DEBUG] Error testing permissions:', error);
      this.setState({ 
        successMessage: `Debug Error: ${error.message}` 
      });
      setTimeout(() => this.setState({ successMessage: null }), 5000);
    }
  }

  setupNotificationListener = () => {
    console.log('[FriendsPanel] Setting up notification listener');
    console.log('[FriendsPanel] Current user:', this.props.currentUser);
    console.log('[FriendsPanel] Is guest:', this.props.isGuest);
    
    if (!this.props.currentUser || this.props.isGuest) {
      console.log('[FriendsPanel] No current user or is guest, skipping notification listener');
      return;
    }

    try {
      // Cancel previous listener if exists
      if (this.unsubscribeFromNotifications) {
        this.unsubscribeFromNotifications();
        console.log('[FriendsPanel] Cancelled previous notification listener');
      }
      
      console.log('[FriendsPanel] Creating notification listener for user:', this.props.currentUser.id);
      this.unsubscribeFromNotifications = getUserNotifications(
        this.props.currentUser.id,
        (snapshot) => {
          console.log('[FriendsPanel] Notification snapshot received:', snapshot.size, 'notifications');
          const notifications = [];
          snapshot.forEach((doc) => {
            const notificationData = {
              id: doc.id,
              ...doc.data()
            };
            console.log('[FriendsPanel] Processing notification:', notificationData);
            
            // Make sure we have all required fields
            if (!notificationData.type) {
              console.warn('[FriendsPanel] Notification missing type field:', notificationData);
              notificationData.type = 'unknown';
            }
            
            // Make sure read status is defined
            if (notificationData.read === undefined) {
              console.warn('[FriendsPanel] Notification missing read field, defaulting to false:', notificationData);
              notificationData.read = false;
            }
            
            notifications.push(notificationData);
          });
          
          console.log('[FriendsPanel] Friend requests:', notifications.filter(n => n.type === 'friend_request' && !n.read).length);
          console.log('[FriendsPanel] Setting notifications state:', notifications);
          this.setState({ notifications }, this.fetchNotificationUserDetails);
        }
      );
      console.log('[FriendsPanel] Notification listener created successfully');
    } catch (error) {
      console.error('[FriendsPanel] Error setting up notification listener:', error);
      this.setState({ notifications: [] });
    }
  }

  fetchNotificationUserDetails = async () => {
    if (!firestore) return;

    const { notifications } = this.state;
    if (notifications.length === 0) return;

    try {
      const updatedNotifications = [...notifications];
      
      for (let i = 0; i < updatedNotifications.length; i++) {
        const notification = updatedNotifications[i];
        
        // Ensure gameId is properly set for game challenges
        if (notification.type === 'game_challenge' && notification.gameId === null) {
          console.log('[fetchNotificationUserDetails] Found game challenge with null gameId:', notification.id);
          
          // Try to fetch the challenge document to get the gameId
          if (notification.challengeId) {
            try {
              const challengeDoc = await firestore.collection('challenges').doc(notification.challengeId).get();
              if (challengeDoc.exists) {
                const challengeData = challengeDoc.data();
                if (challengeData.gameId) {
                  console.log('[fetchNotificationUserDetails] Retrieved gameId from challenge document:', challengeData.gameId);
                  updatedNotifications[i] = {
                    ...notification,
                    gameId: challengeData.gameId
                  };
                }
              }
            } catch (error) {
              console.error('[fetchNotificationUserDetails] Error fetching challenge document:', error);
            }
          }
        }
        
        // Fetch user details for the notification sender
        if (!notification.fromUserDetails && notification.fromUserId) {
          const userDoc = await firestore.doc(`users/${notification.fromUserId}`).get();
          
          if (userDoc.exists) {
            updatedNotifications[i] = {
              ...notification,
              fromUserDetails: {
                id: userDoc.id,
                ...userDoc.data()
              }
            };
          }
        }
      }
      
      this.setState({ notifications: updatedNotifications });
    } catch (error) {
      console.error('Error fetching notification user details:', error);
    }
  }

  loadFriends = async () => {
    if (!this.props.currentUser || this.props.isGuest) return;

    try {
      const friends = await getUserFriends(this.props.currentUser.id);
      console.log('[FriendsPanel] getUserFriends returned:', friends);
      this.setState({ friends });
    } catch (error) {
      console.warn('Could not load friends (Firestore offline):', error);
      this.setState({ friends: [] }); // Show empty friends list if offline
    }
  }

  validateEmail = (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  handleSearch = async () => {
    const { searchTerm, searchByEmail } = this.state;
    if (!searchTerm.trim()) return;

    // Validate email format if searching by email
    if (searchByEmail && !this.validateEmail(searchTerm.trim())) {
      this.setState({ emailError: 'Please enter a valid email address' });
      return;
    } else {
      this.setState({ emailError: null });
    }

    this.setState({ isSearching: true, searchResults: [] });
    console.log(`[FriendsPanel] Starting search by ${searchByEmail ? 'email' : 'username'}: "${searchTerm}"`);

    try {
      let results = [];
      const searchTermTrimmed = searchTerm.trim();
      
      if (searchByEmail) {
        // Search by email (contains match)
        console.log('[FriendsPanel] Calling searchUsersByEmail with:', searchTermTrimmed);
        results = await searchUsersByEmail(searchTermTrimmed);
        console.log('[FriendsPanel] Email search results:', results);
      } else {
        // Search by username (contains match)
        console.log('[FriendsPanel] Calling searchUsers with:', searchTermTrimmed);
        results = await searchUsers(searchTermTrimmed);
        console.log('[FriendsPanel] Username search results:', results);
      }
      
      // Filter out current user and existing friends
      console.log('[FriendsPanel] Current user ID:', this.props.currentUser ? this.props.currentUser.id : 'none');
      console.log('[FriendsPanel] Current friends:', this.state.friends.map(f => f.id));
      
      const filteredResults = results.filter(user => {
        const isCurrentUser = user.id === (this.props.currentUser ? this.props.currentUser.id : null);
        const isAlreadyFriend = this.state.friends.some(friend => friend.id === user.id);
        if (isCurrentUser) console.log('[FriendsPanel] Filtering out current user:', user.id);
        if (isAlreadyFriend) console.log('[FriendsPanel] Filtering out existing friend:', user.id);
        return !isCurrentUser && !isAlreadyFriend;
      });
      
      console.log('[FriendsPanel] Final filtered results:', filteredResults);
      this.setState({ searchResults: filteredResults, isSearching: false });
    } catch (error) {
      console.error('[FriendsPanel] Error searching users:', error);
      this.setState({ isSearching: false, searchResults: [] });
    }
  }

  handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      this.handleSearch();
    }
  }

  handleSendFriendRequest = async (toUserId, userName) => {
    if (!this.props.currentUser || this.props.isGuest) {
      console.error('[FriendsPanel] Cannot send friend request: User not logged in or is guest');
      this.setState({ 
        successMessage: 'You need to be logged in to add friends.' 
      });
      setTimeout(() => this.setState({ successMessage: null }), 3000);
      return;
    }

    try {
      console.log('[FriendsPanel] Sending friend request from', this.props.currentUser.id, 'to', toUserId, '(', userName, ')');
      
      if (toUserId === this.props.currentUser.id) {
        this.setState({ 
          successMessage: 'You cannot add yourself as a friend.' 
        });
        setTimeout(() => this.setState({ successMessage: null }), 3000);
        return;
      }
      
      // Show pending message
      this.setState({
        successMessage: `Sending friend request to ${userName || 'user'}...`,
        isProcessingRequest: true
      });
      
      const success = await sendFriendRequest(this.props.currentUser.id, toUserId);
      console.log('[FriendsPanel] Friend request result:', success);
      
      if (success) {
        this.setState({
          searchResults: this.state.searchResults.filter(user => user.id !== toUserId),
          successMessage: `Friend request sent to ${userName || 'user'}!`,
          isProcessingRequest: false
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.setState({ successMessage: null });
        }, 3000);
      } else {
        this.setState({
          successMessage: 'Failed to send friend request. Please try again.',
          isProcessingRequest: false
        });
        setTimeout(() => this.setState({ successMessage: null }), 3000);
      }
    } catch (error) {
      console.error('[FriendsPanel] Error sending friend request:', error);
      this.setState({
        successMessage: `Error: ${error.message || 'Failed to send friend request'}`,
        isProcessingRequest: false
      });
      setTimeout(() => this.setState({ successMessage: null }), 3000);
    }
  }

  handleAcceptFriendRequest = async (friendId, notificationId) => {
    try {
      console.log('[FriendsPanel] Accepting friend request from', friendId, 'notification:', notificationId);
      
      // Show pending message
      this.setState({
        successMessage: 'Accepting friend request...',
        isProcessingRequest: true
      });
      
      const success = await acceptFriendRequest(this.props.currentUser.id, friendId);
      
      if (success) {
        console.log('[FriendsPanel] Friend request accepted successfully');
        
        // Mark notification as read
        await firestore.doc(`notifications/${notificationId}`).update({ read: true });
        
        // Reload friends list
        await this.loadFriends();
        
        this.setState({
          successMessage: 'Friend request accepted!',
          isProcessingRequest: false,
          showFriendRequests: false // Close friend requests dialog
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.setState({ successMessage: null });
        }, 3000);
      } else {
        console.error('[FriendsPanel] Failed to accept friend request');
        this.setState({
          successMessage: 'Failed to accept friend request. Please try again.',
          isProcessingRequest: false
        });
        
        setTimeout(() => {
          this.setState({ successMessage: null });
        }, 3000);
      }
    } catch (error) {
      console.error('[FriendsPanel] Error accepting friend request:', error);
      this.setState({
        successMessage: `Error: ${error.message || 'Failed to accept friend request'}`,
        isProcessingRequest: false
      });
      
      setTimeout(() => {
        this.setState({ successMessage: null });
      }, 3000);
    }
  }

  handleRejectFriendRequest = async (friendId, notificationId) => {
    try {
      console.log('[FriendsPanel] Rejecting friend request from', friendId, 'notification:', notificationId);
      
      // Show pending message
      this.setState({
        successMessage: 'Rejecting friend request...',
        isProcessingRequest: true
      });
      
      const success = await rejectFriendRequest(this.props.currentUser.id, friendId);
      
      if (success) {
        console.log('[FriendsPanel] Friend request rejected successfully');
        
        // Mark notification as read
        await firestore.doc(`notifications/${notificationId}`).update({ read: true });
        
        this.setState({
          successMessage: 'Friend request rejected.',
          isProcessingRequest: false,
          showFriendRequests: false // Close notifications dialog
        });
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.setState({ successMessage: null });
        }, 3000);
      } else {
        console.error('[FriendsPanel] Failed to reject friend request');
        this.setState({
          successMessage: 'Failed to reject friend request. Please try again.',
          isProcessingRequest: false
        });
        
        setTimeout(() => {
          this.setState({ successMessage: null });
        }, 3000);
      }
    } catch (error) {
      console.error('[FriendsPanel] Error rejecting friend request:', error);
      this.setState({
        successMessage: `Error: ${error.message || 'Failed to reject friend request'}`,
        isProcessingRequest: false
      });
      
      setTimeout(() => {
        this.setState({ successMessage: null });
      }, 3000);
    }
  }

  handleRemoveFriend = async (friendId) => {
    try {
      const success = await removeFriend(this.props.currentUser.id, friendId);
      if (success) {
        this.loadFriends();
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  }

  handleChallengeFriend = async (friendId) => {
    if (!this.props.currentUser || this.props.isGuest) return;

    try {
      // Ensure user is authenticated for Firebase Realtime Database access
      await ensureAuthenticated();
      
      // Generate a game ID
      const gameId = generateGameId();
      console.log('[handleChallengeFriend] Generated game ID:', gameId);
      
      const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Create the game session
      await createGameSession(gameId, initialFen, this.state.timeControlForChallenge || 'none');
      console.log('[handleChallengeFriend] Created game session with ID:', gameId);
      
      // Join the game as the creator (black)
      await joinGame(gameId, 'b');
      console.log('[handleChallengeFriend] Joined game as black player');
      
      // Send a challenge notification with the game ID
      const challengeId = await challengeFriend(
        this.props.currentUser.id, 
        friendId, 
        this.state.timeControlForChallenge || 'none',
        gameId // Pass the game ID
      );
      
      console.log('[handleChallengeFriend] Challenge sent with ID:', challengeId, 'for game ID:', gameId);
      
      if (challengeId) {
        this.setState({ challengingFriendId: null });
        alert('Challenge sent! Game ID: ' + gameId);
        
        // Use the callback to navigate to the game
        if (this.props.onGameChallengeAccepted) {
          console.log('[handleChallengeFriend] Calling onGameChallengeAccepted with gameId:', gameId);
          // Pass 'b' as the player color since we joined as black
          this.props.onGameChallengeAccepted(gameId, 'b');
        }
      }
    } catch (error) {
      console.error('Error challenging friend:', error);
      alert('Failed to create game challenge. Please try again.');
    }
  }

  handleDirectChallenge = async (friendId) => {
    if (!this.props.currentUser || this.props.isGuest) return;

    try {
      // Ensure user is authenticated for Firebase Realtime Database access
      await ensureAuthenticated();
      
      // Generate a game ID
      const gameId = generateGameId();
      console.log('[handleDirectChallenge] Generated game ID:', gameId);
      
      const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Create the game session
      await createGameSession(gameId, initialFen, 'none');
      console.log('[handleDirectChallenge] Created game session with ID:', gameId);
      
      // Join the game as the creator (black)
      await joinGame(gameId, 'b');
      console.log('[handleDirectChallenge] Joined game as black player');
      
      // Send a challenge notification with the game ID
      const challengeId = await challengeFriend(
        this.props.currentUser.id, 
        friendId, 
        'none',
        gameId // Pass the game ID
      );
      
      console.log('[handleDirectChallenge] Challenge sent with ID:', challengeId, 'for game ID:', gameId);
      
      if (challengeId) {
        alert('Game challenge sent! Starting the game...');
        
        // Use the callback to navigate to the game
        if (this.props.onGameChallengeAccepted) {
          console.log('[handleDirectChallenge] Calling onGameChallengeAccepted with gameId:', gameId);
          // Pass 'b' as the player color since we joined as black
          this.props.onGameChallengeAccepted(gameId, 'b');
        }
      }
    } catch (error) {
      console.error('Error challenging friend:', error);
      alert('Failed to create game. Please try again.');
    }
  }

  handleAcceptGameChallenge = async (notification) => {
    try {
      console.log('[handleAcceptGameChallenge] Notification received:', notification);
      console.log('[handleAcceptGameChallenge] Notification keys:', Object.keys(notification));
      console.log('[handleAcceptGameChallenge] gameId property:', notification.gameId);
      
      // Mark notification as read
      await firestore.collection('notifications').doc(notification.id).update({
        read: true
      });
      
      // Get the gameId from the notification
      const gameId = notification.gameId;
      
      if (!gameId) {
        console.error('[handleAcceptGameChallenge] No gameId found in notification');
        alert('Error: Invalid game challenge. No game ID provided.');
        return;
      }

      console.log('[handleAcceptGameChallenge] Using game ID from notification:', gameId);
      
      // Get the challenge data to determine the challenger's color
      let challengerColor = 'b'; // Default: assume challenger is black
      if (notification.challengeId) {
        try {
          // First update the challenge status to 'accepted'
          await firestore.collection('challenges').doc(notification.challengeId).update({
            status: 'accepted',
            acceptedAt: new Date()
          });
          console.log('[handleAcceptGameChallenge] Updated challenge status to accepted');
          
          // Then get the challenge document to check if color preference was specified
          const challengeDoc = await firestore.collection('challenges').doc(notification.challengeId).get();
          if (challengeDoc.exists) {
            const challengeData = challengeDoc.data();
            // If the challenger specified a color, use it
            if (challengeData.challengerColor) {
              challengerColor = challengeData.challengerColor;
              console.log('[handleAcceptGameChallenge] Challenger selected color:', challengerColor);
            }
          }
        } catch (error) {
          console.error('[handleAcceptGameChallenge] Error with challenge document:', error);
        }
      }
      
      // Get game data to see if challenger already joined
      const gameData = await getGameData(gameId);
      console.log('[handleAcceptGameChallenge] Current game data:', gameData);
      
      // Determine if challenger has already joined and with what color
      if (gameData && gameData.players) {
        if (gameData.players.w) {
          challengerColor = 'w'; // Challenger is white
          console.log('[handleAcceptGameChallenge] Detected challenger joined as white');
        } else if (gameData.players.b) {
          challengerColor = 'b'; // Challenger is black
          console.log('[handleAcceptGameChallenge] Detected challenger joined as black');
        }
      }
      
      // Use opposite color of challenger
      const acceptorColor = challengerColor === 'w' ? 'b' : 'w';
      console.log('[handleAcceptGameChallenge] Using color for acceptor:', acceptorColor);

      // Join the game with the opposite color of the challenger
      const joinSuccess = await joinGame(gameId, acceptorColor);
      console.log('[handleAcceptGameChallenge] Join game result:', joinSuccess);

      // Close the notifications dialog
      this.setState({ showNotifications: false });
      
      // Use the callback to notify parent component to handle all game setup
      if (this.props.onGameChallengeAccepted) {
        console.log('[handleAcceptGameChallenge] Calling onGameChallengeAccepted with gameId:', gameId);
        // Pass the acceptor's color and the full notification
        this.props.onGameChallengeAccepted(gameId, acceptorColor, notification);
      } else {
        console.error('[handleAcceptGameChallenge] No onGameChallengeAccepted callback provided');
        alert('Game started! Please use the game ID: ' + gameId);
      }
    } catch (error) {
      console.error('Error accepting game challenge:', error);
      alert('Failed to start the game. Please try again.');
    }
  }

  formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }

  testPermissions = async () => {
    try {
      const hasPermissions = await testFirestorePermissions();
      console.log('[FriendsPanel] Firestore write permissions:', hasPermissions ? 'Granted' : 'Denied');
      
      if (!hasPermissions) {
        this.setState({
          successMessage: 'Warning: You do not have permission to write to Firestore. Friend requests will not work.',
        });
        
        setTimeout(() => {
          this.setState({ successMessage: null });
        }, 5000);
      }
    } catch (error) {
      console.error('[FriendsPanel] Error testing permissions:', error);
    }
  }

  toggleDebugPanel = () => {
    this.setState({ showDebugPanel: !this.state.showDebugPanel });
  }

  showFriendRequestsDialog = () => {
    console.log('[DEBUG] Friend requests in state:', this.state.notifications.filter(n => n.type === 'friend_request' && !n.read));
    this.setState({ showFriendRequests: true });
  }

  forceShowUnread = () => {
    const updatedNotifications = this.state.notifications.map(notification => {
      if (notification.type === 'friend_request') {
        return { ...notification, read: false };
      }
      return notification;
    });
    console.log('[DEBUG] Updating notifications to show as unread:', updatedNotifications);
    this.setState({ notifications: updatedNotifications });
  }

  debugCheckGameChallenges = () => {
    const { notifications } = this.state;
    const gameChallenges = notifications.filter(n => n.type === 'game_challenge');
    
    console.log('[DEBUG] Game challenges found:', gameChallenges.length);
    console.log('[DEBUG] Game challenge details:');
    
    gameChallenges.forEach((challenge, index) => {
      console.log(`[DEBUG] Challenge ${index + 1}:`, challenge);
      console.log(`[DEBUG] Challenge ${index + 1} gameId:`, challenge.gameId);
      console.log(`[DEBUG] Challenge ${index + 1} keys:`, Object.keys(challenge));
    });
    
    if (gameChallenges.length > 0) {
      alert(`Found ${gameChallenges.length} game challenges. Check console for details.`);
    } else {
      alert('No game challenges found.');
    }
  }

  render() {
    const { currentUser, isGuest } = this.props;
    console.log('[FriendsPanel] render, state.friends:', this.state.friends);
    const { 
      friends, 
      searchResults, 
      searchTerm, 
      isSearching, 
      notifications,
      showSearchDialog,
      showNotifications,
      showFriendRequests,
      challengingFriendId,
      timeControlForChallenge,
      searchByEmail,
      emailError,
      successMessage,
      isProcessingRequest,
      showDebugPanel
    } = this.state;

    if (isGuest) {
      return (
        <Paper style={{ padding: '30px', margin: '20px auto', maxWidth: '800px', textAlign: 'center', backgroundColor: '#2a2a2a', color: '#e0c9a6', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)' }}>
          <h3 style={{ fontSize: '24px', color: '#e0c9a6', marginBottom: '20px' }}>Friends System</h3>
          <p style={{ color: '#e0c9a6', fontSize: '16px', lineHeight: '1.6', maxWidth: '80%', margin: '0 auto 20px' }}>Sign in to add friends and challenge them to games!</p>
          <RaisedButton
            label="Sign In"
            primary={true}
            backgroundColor="#5d4037"
            labelColor="#e0c9a6"
            style={{ marginTop: '10px' }}
            onClick={this.props.onSignIn}
          />
        </Paper>
      );
    }

    // Separate notifications and friend requests
    const friendRequests = notifications.filter(n => n.type === 'friend_request' && !n.read);
    const otherNotifications = notifications.filter(n => n.type !== 'friend_request' && !n.read);
    
    const notificationActions = [
      <FlatButton
        label="Accept"
        primary={true}
        onClick={() => this.handleAcceptFriendRequest(challengingFriendId, notifications.find(n => n.fromUserId === challengingFriendId).id)}
        style={{ marginRight: '10px' }}
        disabled={isProcessingRequest}
        labelStyle={{ fontWeight: 'bold' }}
        backgroundColor="#4267B2"
      />,
      <FlatButton
        label="Reject"
        onClick={() => this.handleRejectFriendRequest(challengingFriendId, notifications.find(n => n.fromUserId === challengingFriendId).id)}
        disabled={isProcessingRequest}
        style={{ backgroundColor: '#2a2a2a' }}
        labelStyle={{ color: 'rgba(255, 221, 153, 0.4)' }}
      />
    ];

    return (
      <div>
        <Paper style={{ padding: '20px', margin: '20px auto', maxWidth: '800px', backgroundColor: '#2a2a2a', color: '#e0c9a6', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#e0c9a6', fontSize: '22px', fontWeight: 'bold' }}>Friends ({friends.length})</h3>
              
              {/* Debug button - only visible in development */}
              {process.env.NODE_ENV !== 'production' && (
                <IconButton 
                  onClick={this.toggleDebugPanel}
                  title="Debug Panel"
                  style={{ marginLeft: '10px' }}
                >
                  <span>🛠️</span>
                </IconButton>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {/* Friend Requests Icon - Redesigned */}
              {friendRequests.length > 0 ? (
                <Badge
                  badgeContent={friendRequests.length}
                  primary={true}
                  badgeStyle={{ 
                    backgroundColor: '#ffdd99', 
                    color: '#5d4037', 
                    fontWeight: 'bold',
                    fontSize: '14px',
                    padding: '0 6px',
                    minWidth: '22px',
                    height: '22px',
                    borderRadius: '11px',
                    border: '1px solid #8d6050',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 3px rgba(255, 221, 153, 0.4)' 
                  }}
                  style={{ marginRight: '15px' }}
                >
                  <IconButton 
                    onClick={() => this.setState({ showFriendRequests: true })}
                    title="Friend Requests"
                    style={{ 
                      backgroundColor: '#5d4037', 
                      border: '2px solid #8d6e63', 
                      padding: '8px',
                      boxShadow: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '28px', color: '#ffdd99', textShadow: 'none' }}>👥</span>
                      <span style={{ fontSize: '11px', color: '#ffdd99', fontWeight: 'bold', marginTop: '3px', textAlign: 'center' }}>REQUESTS</span>
                    </div>
                  </IconButton>
                </Badge>
              ) : (
                <IconButton 
                  onClick={() => this.setState({ showFriendRequests: true })}
                  title="Friend Requests"
                  className="friend-request-icon"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '30px', color: '#ffdd99', textShadow: '0 0 3px rgba(255, 221, 153, 0.5)' }}>👥</span>
                    <span style={{ fontSize: '12px', color: '#ffdd99', fontWeight: 'bold', marginTop: '2px', textAlign: 'center' }}>REQUESTS</span>
                  </div>
                </IconButton>
              )}
              
              {/* Other Notifications Icon */}
              {otherNotifications.length > 0 && (
                <Badge
                  badgeContent={otherNotifications.length}
                  primary={true}
                  badgeStyle={{ 
                    backgroundColor: '#ffdd99', 
                    color: '#5d4037', 
                    fontWeight: 'bold',
                    fontSize: '14px',
                    padding: '0 6px',
                    minWidth: '22px',
                    height: '22px',
                    borderRadius: '11px',
                    border: '2px solid #8d6050',
                    boxShadow: '0 0 8px #ffdd99'
                  }}
                  style={{ marginRight: '15px' }}
                >
                  <IconButton 
                    onClick={() => this.setState({ showNotifications: true })}
                    title="Notifications"
                    style={{ 
                      backgroundColor: '#5d4037', 
                      border: '3px solid #e0c9a6', 
                      padding: '8px',
                      boxShadow: '0 0 10px rgba(224, 201, 166, 0.7)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span className="icon-text">🔔</span>
                      <span className="icon-label">ALERTS</span>
                    </div>
                  </IconButton>
                </Badge>
              )}
              
              <RaisedButton
                label="ADD FRIENDS"
                primary={true}
                backgroundColor="#3e2723"
                labelColor="#ffdd99"
                labelStyle={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}
                style={{
                  height: '45px',
                  borderRadius: '6px',
                  border: '2px solid #8d6e63',
                  boxShadow: 'none'
                }}
                className="add-friends-button"
                labelClassName="add-friends-label"
                onClick={() => this.setState({ showSearchDialog: true })}
              />
            </div>
          </div>
          
          {/* Debug Panel */}
          {showDebugPanel && process.env.NODE_ENV !== 'production' && (
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
              <h4 style={{ marginTop: 0 }}>Debug Panel</h4>
              <div style={{ marginBottom: '10px' }}>
                <div><strong>Total notifications:</strong> {notifications.length}</div>
                <div><strong>Friend requests:</strong> {friendRequests.length}</div>
                <div><strong>Current user ID:</strong> {currentUser ? currentUser.id : 'Not logged in'}</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <RaisedButton
                  label="Show Friend Requests Dialog"
                  onClick={this.showFriendRequestsDialog}
                  backgroundColor="#ff9800"
                  labelColor="#fff"
                />
                <RaisedButton
                  label="Mark Requests Unread"
                  onClick={this.forceShowUnread}
                  backgroundColor="#2196f3"
                  labelColor="#fff"
                />
                <RaisedButton
                  label="Reload Notifications"
                  onClick={() => {
                    this.setupNotificationListener();
                    console.log('[DEBUG] Reloading notifications');
                  }}
                  backgroundColor="#4caf50"
                  labelColor="#fff"
                />
                <RaisedButton
                  label="Clear Console"
                  onClick={() => console.clear()}
                  backgroundColor="#9e9e9e"
                  labelColor="#fff"
                />
                <RaisedButton
                  label="Check Game Challenges"
                  onClick={this.debugCheckGameChallenges}
                  style={{ marginLeft: '10px', backgroundColor: '#ff5722', color: 'white' }}
                />
              </div>
              
              {currentUser && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <RaisedButton
                    label="Reset Friend Requests Status"
                    onClick={async () => {
                      if (currentUser) {
                        const count = await resetFriendRequestsReadStatus(currentUser.id);
                        console.log(`[DEBUG] Reset ${count} friend requests`);
                        this.setupNotificationListener();
                      }
                    }}
                    backgroundColor="#673ab7"
                    labelColor="#fff"
                  />
                  <RaisedButton
                    label="Get All Friend Requests"
                    onClick={async () => {
                      if (currentUser) {
                        const requests = await getAllFriendRequests(currentUser.id);
                        console.log('[DEBUG] All friend requests:', requests);
                      }
                    }}
                    backgroundColor="#009688"
                    labelColor="#fff"
                  />
                  <RaisedButton
                    label="Validate Notifications"
                    onClick={async () => {
                      if (currentUser) {
                        const report = await validateNotifications(currentUser.id);
                        console.log('[DEBUG] Validation report:', report);
                      }
                    }}
                    backgroundColor="#795548"
                    labelColor="#fff"
                  />
                </div>
              )}
              
              {notifications.length > 0 && (
                <div style={{ 
                  marginTop: '15px',
                  padding: '10px',
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  <h4 style={{ marginTop: 0 }}>Raw Notifications Data:</h4>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap',
                    fontSize: '12px'
                  }}>
                    {JSON.stringify(notifications, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {friends.length === 0 && (
            <div className="no-friends-message">
              <span style={{ marginRight: '10px', fontSize: '24px' }}>👋</span>
              <span>No friends yet. Add some friends to start playing!</span>
            </div>
          )}
          
          {friends.length > 0 && (
            <div className="friend-grid">
              {friends.map(friend => (
                <Paper key={friend.id} className="friend-card">
                  {friend.photoURL ? (
                    <Avatar src={friend.photoURL} className="friend-avatar" />
                  ) : (
                    <Avatar className="friend-avatar">
                      <PersonIcon color="#e0c9a6" />
                    </Avatar>
                  )}
                  <div className="friend-details">
                    <div className="friend-name">{friend.displayName}</div>
                    <div className="friend-stats">Rating: {friend.rating || 'Unrated'}</div>
                    <div className="friend-stats">Games: {friend.gamesPlayed || 0} | Wins: {friend.gamesWon || 0}</div>
                    <div className="friend-stats">Last seen: {this.formatLastSeen(friend.lastSeen)}</div>
                  </div>
                  <div className="friend-actions">
                    <FlatButton
                      label="Remove"
                      secondary={true}
                      onClick={e => { e.stopPropagation(); this.handleRemoveFriend(friend.id); }}
                    />
                  </div>
                </Paper>
              ))}
            </div>
          )}
        </Paper>

        <Dialog
          title={searchByEmail ? "Add Friends by Email" : "Add Friends by Username"}
          modal={false}
          open={showSearchDialog}
          onRequestClose={() => this.setState({ showSearchDialog: false, searchResults: [], searchTerm: '', emailError: null })}
          contentStyle={{ backgroundColor: '#2a2a2a', color: '#e0c9a6', maxWidth: '600px', width: '90%' }}
          titleStyle={{ backgroundColor: '#5d4037', color: '#e0c9a6', padding: '15px' }}
          bodyStyle={{ backgroundColor: '#2a2a2a', padding: '0' }}
        >
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                <FlatButton
                  label="Search by Email"
                  primary={searchByEmail}
                  onClick={() => this.setState({ 
                    searchByEmail: true, 
                    emailError: null,
                    searchResults: [],
                    searchTerm: ''
                  })}
                  style={{
                    margin: '0 5px',
                    backgroundColor: searchByEmail ? '#5d4037' : 'transparent',
                    color: '#e0c9a6',
                    border: searchByEmail ? '1px solid #e0c9a6' : 'none'
                  }}
                  hoverColor="#6d5047"
                  labelStyle={{ color: '#e0c9a6' }}
                />
                <FlatButton
                  label="Search by Username"
                  primary={!searchByEmail}
                  onClick={() => this.setState({ 
                    searchByEmail: false,
                    emailError: null,
                    searchResults: [],
                    searchTerm: ''
                  })}
                  style={{
                    margin: '0 5px',
                    backgroundColor: !searchByEmail ? '#5d4037' : 'transparent',
                    color: '#e0c9a6',
                    border: !searchByEmail ? '1px solid #e0c9a6' : 'none'
                  }}
                  hoverColor="#6d5047"
                  labelStyle={{ color: '#e0c9a6' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', marginBottom: '20px' }}>
              <TextField
                hintText={searchByEmail ? "Enter friend's exact email address" : "Search by username"}
                value={searchTerm}
                onChange={(e) => this.setState({ searchTerm: e.target.value, emailError: null })}
                onKeyPress={this.handleSearchKeyPress}
                style={{ flex: 1, marginRight: '10px' }}
                errorText={emailError}
                inputStyle={{ color: '#e0c9a6' }}
                hintStyle={{ color: 'rgba(224, 201, 166, 0.7)' }}
                underlineStyle={{ borderColor: 'rgba(224, 201, 166, 0.5)' }}
                underlineFocusStyle={{ borderColor: '#e0c9a6' }}
                errorStyle={{ color: '#ff6d6d' }}
              />
              <RaisedButton
                label={isSearching ? "Searching..." : "Search"}
                onClick={this.handleSearch}
                disabled={isSearching || !searchTerm.trim()}
                backgroundColor="#5d4037"
                labelColor="#e0c9a6"
                disabledBackgroundColor="rgba(93, 64, 55, 0.5)"
                disabledLabelColor="rgba(224, 201, 166, 0.5)"
                buttonStyle={{ backgroundColor: '#5d4037', border: '1px solid #e0c9a6', borderRadius: '4px' }}
                labelStyle={{ color: '#e0c9a6' }}
              />
            </div>

            {isSearching && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  margin: '0 auto',
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #4CAF50',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ marginTop: '10px', color: '#666' }}>
                  Searching for users...
                </p>
              </div>
            )}

            {successMessage && (
              <div style={{ 
                backgroundColor: successMessage.startsWith('Error') ? '#ffebee' : '#4CAF50', 
                color: successMessage.startsWith('Error') ? '#c62828' : 'white', 
                padding: '10px', 
                borderRadius: '4px',
                marginBottom: '15px',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                {successMessage}
              </div>
            )}

            {searchResults.length > 0 ? (
              <div>
                <div style={{ 
                  backgroundColor: '#e8f5e9', 
                  color: '#2e7d32', 
                  padding: '10px', 
                  borderRadius: '4px',
                  marginBottom: '15px',
                  textAlign: 'center'
                }}>
                  Found {searchResults.length} user{searchResults.length > 1 ? 's' : ''}
                </div>
                
                <div style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '10px' }}>
                  {console.log('[FriendsPanel] Rendering search results:', searchResults)}
                  {searchResults.map((user, index) => {
                    try {
                      console.log('[FriendsPanel] Rendering user:', user);
                      return (
                        <div key={user.id || index} style={{ 
                          padding: '15px',
                          borderBottom: index < searchResults.length - 1 ? '1px solid #e0e0e0' : 'none',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <div style={{ 
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            backgroundColor: '#5d4037',
                            color: '#e0c9a6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '15px',
                            fontSize: '22px',
                            border: '2px solid #e0c9a6'
                          }}>
                            {(user.displayName || '?').charAt(0).toUpperCase()}
                          </div>
                          
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#e0c9a6' }}>
                              {user.displayName || 'Unknown User'}
                            </div>
                            <div style={{ color: '#cccccc', fontSize: '14px' }}>
                              Email: {user.email || 'Not available'}
                            </div>
                            <div style={{ color: '#cccccc', fontSize: '14px' }}>
                              Rating: {user.rating || 'Unrated'}
                            </div>
                          </div>
                          
                          <div>
                            <RaisedButton
                              label={isProcessingRequest ? "Sending..." : "Add Friend"}
                              backgroundColor="#5d4037"
                              labelColor="#e0c9a6"
                              style={{ border: '1px solid #e0c9a6', borderRadius: '4px' }}
                              onClick={() => {
                                console.log('[FriendsPanel] Add Friend button clicked for user:', user.id, user.displayName);
                                this.handleSendFriendRequest(user.id, user.displayName);
                              }}
                              primary={true}
                              disabled={isProcessingRequest}
                            />
                          </div>
                        </div>
                      );
                    } catch (error) {
                      console.error('[FriendsPanel] Error rendering user:', error);
                      return (
                        <div key={user.id || `error-${index}`} style={{
                          padding: '15px',
                          borderBottom: index < searchResults.length - 1 ? '1px solid #e0e0e0' : 'none',
                          color: 'red'
                        }}>
                          Error displaying user: {error.message}
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            ) : (
              searchTerm && !isSearching && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No users found. Please check the {searchByEmail ? 'email address' : 'username'} and try again.
                </div>
              )
            )}
          </div>
        </Dialog>

        {/* Friend Requests Dialog - Facebook-style */}
        <Dialog
          title="Friend Requests"
          modal={false}
          open={showFriendRequests}
          onRequestClose={() => this.setState({ showFriendRequests: false })}
          contentStyle={{ backgroundColor: '#2a2a2a', color: '#e0c9a6', maxWidth: '500px', width: '90%' }}
          titleStyle={{ backgroundColor: '#5d4037', color: '#e0c9a6', padding: '15px' }}
          bodyStyle={{ backgroundColor: '#2a2a2a', padding: '20px' }}
        >
          <div style={{ padding: '20px' }}>
            {/* Friend Requests Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '15px',
              marginBottom: '15px'
            }}>
              <h3 style={{ margin: 0, color: '#3b5998' }}>Friend Requests</h3>
              <span style={{ color: '#666', fontSize: '14px' }}>
                {friendRequests.length} pending request{friendRequests.length !== 1 ? 's' : ''}
              </span>
            </div>

            {friendRequests.length === 0 ? (
              <div style={{ 
                padding: '30px 20px', 
                textAlign: 'center', 
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                color: '#666'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>👥</div>
                <p style={{ color: '#e0c9a6', fontSize: '16px', textAlign: 'center' }}>No friend requests at the moment</p>
              </div>
            ) : (
              <div>
                {friendRequests.map((request) => {
                  const fromUser = request.fromUserDetails || { displayName: 'Unknown User' };
                  
                  return (
                    <Paper key={request.id} style={{ 
                      marginBottom: '15px', 
                      padding: '15px', 
                      borderRadius: '8px',
                      boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid rgba(224, 201, 166, 0.2)'
                    }}>
                      <div style={{ display: 'flex' }}>
                        <div style={{ marginRight: '15px' }}>
                          {fromUser.photoURL ? (
                            <Avatar 
                              src={fromUser.photoURL} 
                              size={60}
                              style={{ border: '2px solid #5d4037' }}
                            />
                          ) : (
                            <Avatar 
                              style={{
                                backgroundColor: '#5d4037',
                                color: '#e0c9a6',
                                fontSize: '24px',
                                width: 60,
                                height: 60,
                                border: '2px solid #e0c9a6'
                              }}
                            >
                              {(fromUser.displayName || '?').charAt(0).toUpperCase()}
                            </Avatar>
                          )}
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontWeight: 'bold', 
                            fontSize: '18px',
                            marginBottom: '5px',
                            color: '#e0c9a6'
                          }}>
                            {fromUser.displayName || 'Unknown User'}
                            <span style={{ 
                              fontSize: '12px', 
                              color: '#cccccc', 
                              fontWeight: 'normal',
                              marginLeft: '10px'
                            }}>
                              {new Date(request.createdAt.seconds * 1000).toLocaleString()}
                            </span>
                          </div>
                          
                          {fromUser.email && (
                            <div style={{ 
                              fontSize: '14px', 
                              color: '#cccccc',
                              marginBottom: '5px'
                            }}>
                              {fromUser.email}
                            </div>
                          )}
                          
                          {fromUser.rating && (
                            <div style={{ 
                              fontSize: '14px', 
                              color: '#666',
                              marginBottom: '10px'
                            }}>
                              Rating: {fromUser.rating}
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', marginTop: '10px' }}>
                            <RaisedButton
                              label="Confirm"
                              primary={true}
                              onClick={() => this.handleAcceptFriendRequest(request.fromUserId, request.id)}
                              style={{ marginRight: '10px', border: '1px solid #e0c9a6', borderRadius: '4px' }}
                              disabled={isProcessingRequest}
                              labelStyle={{ fontWeight: 'bold', color: '#e0c9a6' }}
                              backgroundColor="#5d4037"
                              disabledBackgroundColor="rgba(93, 64, 55, 0.5)"
                              disabledLabelColor="rgba(224, 201, 166, 0.5)"
                            />
                            <RaisedButton
                              label="Delete Request"
                              onClick={() => this.handleRejectFriendRequest(request.fromUserId, request.id)}
                              disabled={isProcessingRequest}
                              style={{ backgroundColor: '#2a2a2a', border: '1px solid #e0c9a6', borderRadius: '4px' }}
                              labelStyle={{ color: '#e0c9a6' }}
                              disabledBackgroundColor="rgba(42, 42, 42, 0.5)"
                              disabledLabelColor="rgba(224, 201, 166, 0.5)"
                              hoverColor="#3a3a3a"
                            />
                          </div>
                        </div>
                      </div>
                    </Paper>
                  );
                })}
              </div>
            )}
          </div>
        </Dialog>

        {/* Other Notifications Dialog */}
        <Dialog
          title="Notifications"
          modal={false}
          open={showNotifications}
          onRequestClose={() => this.setState({ showNotifications: false })}
          contentStyle={{ backgroundColor: '#2a2a2a', color: '#e0c9a6', maxWidth: '500px', width: '90%' }}
          titleStyle={{ backgroundColor: '#5d4037', color: '#e0c9a6', padding: '15px' }}
          bodyStyle={{ backgroundColor: '#2a2a2a', padding: '20px' }}
        >
          <div style={{ padding: '20px' }}>
            {otherNotifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔔</div>
                <p style={{ color: '#e0c9a6', fontSize: '16px' }}>No notifications at the moment</p>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '15px', color: '#e0c9a6', fontSize: '16px', fontWeight: 'bold' }}>
                  You have {otherNotifications.length} notification{otherNotifications.length !== 1 ? 's' : ''}
                </div>
                <List style={{ border: '1px solid #e0c9a6', borderRadius: '8px', backgroundColor: '#1a1a1a' }}>
                  {otherNotifications.map((notification) => {
                    const fromUser = notification.fromUserDetails || { displayName: 'Unknown User' };
                    
                    return (
                      <div key={notification.id}>
                        <ListItem
                          leftAvatar={
                            fromUser.photoURL ? (
                              <Avatar 
                                src={fromUser.photoURL} 
                                style={{ border: '2px solid #5d4037' }}
                              />
                            ) : (
                              <Avatar style={{
                                backgroundColor: '#5d4037',
                                color: '#e0c9a6',
                                border: '2px solid #e0c9a6'
                              }}>
                                {(fromUser.displayName || 'U').charAt(0).toUpperCase()}
                              </Avatar>
                            )
                          }
                          primaryText={
                            <div style={{ fontWeight: 'bold', color: '#e0c9a6', fontSize: '16px' }}>
                              Game Challenge
                            </div>
                          }
                          secondaryText={
                            <div>
                              <div style={{ color: '#cccccc' }}>From: {fromUser.displayName || 'Unknown User'}</div>
                              {fromUser.email && <div style={{ color: '#cccccc' }}>Email: {fromUser.email}</div>}
                              {notification.gameId && <div style={{ color: '#cccccc' }}>Game ID: {notification.gameId}</div>}
                              <div style={{ color: '#a0a0a0', fontSize: '12px' }}>
                                {new Date(notification.createdAt.seconds * 1000).toLocaleString()}
                              </div>
                            </div>
                          }
                          rightIconButton={
                            <RaisedButton
                              label="Accept Challenge"
                              onClick={() => this.handleAcceptGameChallenge(notification)}
                              primary={true}
                              backgroundColor="#5d4037"
                              labelColor="#e0c9a6"
                              style={{ border: '1px solid #e0c9a6', borderRadius: '4px', marginRight: '10px' }}
                            />
                          }
                        />
                        <Divider />
                      </div>
                    );
                  })}
                </List>
              </div>
            )}
          </div>
        </Dialog>

        {/* Challenge Dialog */}
        <Dialog
          title="Challenge Friend"
          modal={false}
          open={!!challengingFriendId}
          onRequestClose={() => this.setState({ challengingFriendId: null })}
          actions={notificationActions}
        >
          <div style={{ padding: '20px' }}>
            <h4>Select Time Control:</h4>
            <div>
              {['none', '5', '10', '15', '30'].map(time => (
                <FlatButton
                  key={time}
                  label={time === 'none' ? 'No Time Limit' : `${time} minutes`}
                  onClick={() => this.setState({ timeControlForChallenge: time })}
                  style={{
                    margin: '5px',
                    backgroundColor: timeControlForChallenge === time ? '#e0e0e0' : 'transparent'
                  }}
                />
              ))}
            </div>
          </div>
        </Dialog>

        {/* Debug Panel */}
        {showDebugPanel && (
          <Paper style={{ padding: '20px', margin: '20px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
            <h4>Debug Panel</h4>
            <div style={{ marginBottom: '10px' }}>
              <FlatButton
                label="Log Friend Requests"
                onClick={this.showFriendRequestsDialog}
                style={{ marginRight: '10px' }}
              />
              <FlatButton
                label="Force Show Unread"
                onClick={this.forceShowUnread}
                secondary={true}
              />
              <FlatButton
                label="Check Game Challenges"
                onClick={this.debugCheckGameChallenges}
                style={{ marginLeft: '10px', backgroundColor: '#ff5722', color: 'white' }}
              />
            </div>
            <div>
              <strong>Friend Requests (Debug):</strong>
              <pre style={{ 
                maxHeight: '150px', 
                overflow: 'auto', 
                backgroundColor: '#fff',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}>
                {JSON.stringify(friendRequests, null, 2)}
              </pre>
            </div>
          </Paper>
        )}
      </div>
    );
  }
}

export default FriendsPanel;