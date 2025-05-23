import axios from 'axios';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQN0Y7U2dD4NL1lXjP9we4k9cpx8hPuRI",
  projectId: "chess-ed556",
  databaseURL: "https://chess-ed556-default-rtdb.firebaseio.com",
  authDomain: "chess-ed556.firebaseapp.com"
};

// Configuration - set this to false if you want to disable Firestore features
const ENABLE_FIRESTORE = true;

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Get Firebase services
export const auth = firebase.auth();
export const firestore = ENABLE_FIRESTORE ? firebase.firestore() : null;

// Configure Auth providers
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => auth.signInWithPopup(googleProvider);

// Firebase Realtime Database REST API base URL (keeping for game data)
const dbBaseUrl = firebaseConfig.databaseURL || "https://chess-ed556-default-rtdb.firebaseio.com";

// Sign in anonymously if needed
export const ensureAuthenticated = async () => {
  if (!auth.currentUser) {
    console.log('[ensureAuthenticated] No user is signed in, attempting anonymous sign in');
    try {
      await auth.signInAnonymously();
      console.log('[ensureAuthenticated] Anonymous authentication successful');
      return true;
    } catch (error) {
      console.error('[ensureAuthenticated] Anonymous authentication failed:', error);
      return false;
    }
  }
  console.log('[ensureAuthenticated] User is already signed in');
  return true;
};

// Helper function to get the current user's auth token
const getAuthToken = async () => {
  // Ensure user is authenticated
  await ensureAuthenticated();
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("[getAuthToken] No user is currently signed in, even after authentication attempt");
    return null;
  }
  
  try {
    const token = await currentUser.getIdToken();
    return token;
  } catch (error) {
    console.error("[getAuthToken] Error getting auth token:", error);
    return null;
  }
};

// Helper function to create URL with auth token
const getUrlWithAuth = async (url) => {
  const token = await getAuthToken();
  if (token) {
    // Add auth token as a query parameter
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}auth=${token}`;
  }
  return url;
};

// Authentication Functions
export const createUserProfileDocument = async (userAuth, additionalData) => {
  if (!userAuth || !firestore || !ENABLE_FIRESTORE) return null;
  
  try {
    const userRef = firestore.doc(`users/${userAuth.uid}`);
    const snapShot = await userRef.get();
    
    if (!snapShot.exists) {
      const { displayName, email, photoURL } = userAuth;
      const createdAt = new Date();
      
      try {
        await userRef.set({
          displayName,
          email,
          photoURL,
          createdAt,
          rating: 1200,
          gamesPlayed: 0,
          gamesWon: 0,
          isOnline: true,
          lastSeen: createdAt,
          friends: [],
          friendRequests: {
            sent: [],
            received: []
          },
          ...additionalData
        });
      } catch (error) {
        console.warn('Could not create user profile in Firestore:', error.message);
        return null; // Return null if we can't create the profile
      }
    }
    
    return userRef;
  } catch (error) {
    console.warn('Firestore connection error:', error.message);
    return null; // Return null if Firestore is not available
  }
};

export const updateUserOnlineStatus = async (userId, isOnline) => {
  if (!userId) return;
  
  try {
    const userRef = firestore.doc(`users/${userId}`);
    await userRef.update({
      isOnline,
      lastSeen: new Date()
    });
  } catch (error) {
    console.error('Error updating online status:', error);
  }
};

// Friend System Functions
export const sendFriendRequest = async (fromUserId, toUserId) => {
  try {
    console.log('[sendFriendRequest] Sending request from', fromUserId, 'to', toUserId);
    
    if (!firestore) {
      console.error('[sendFriendRequest] Firestore is not available');
      throw new Error('Database connection error');
    }
    
    const fromUserRef = firestore.doc(`users/${fromUserId}`);
    const toUserRef = firestore.doc(`users/${toUserId}`);
    
    // Check if users exist
    const [fromUserDoc, toUserDoc] = await Promise.all([
      fromUserRef.get(),
      toUserRef.get()
    ]);
    
    if (!fromUserDoc.exists) {
      console.error('[sendFriendRequest] From user does not exist:', fromUserId);
      throw new Error('Sender account not found');
    }
    
    if (!toUserDoc.exists) {
      console.error('[sendFriendRequest] To user does not exist:', toUserId);
      throw new Error('Recipient account not found');
    }
    
    // Get user data
    const fromUserData = fromUserDoc.data();
    const toUserData = toUserDoc.data();
    
    // Check if already friends or request already sent
    const fromFriends = fromUserData.friends || [];
    const sentRequests = (fromUserData.friendRequests && fromUserData.friendRequests.sent) || [];
    const receivedRequests = (toUserData.friendRequests && toUserData.friendRequests.received) || [];
    
    console.log('[sendFriendRequest] From user friends:', fromFriends);
    console.log('[sendFriendRequest] Sent requests:', sentRequests);
    console.log('[sendFriendRequest] To user received requests:', receivedRequests);
    
    if (fromFriends.includes(toUserId)) {
      console.log('[sendFriendRequest] Users are already friends');
      throw new Error('You are already friends with this user');
    }
    
    if (sentRequests.includes(toUserId)) {
      console.log('[sendFriendRequest] Friend request already sent from', fromUserId, 'to', toUserId);
      throw new Error('Friend request already sent to this user');
    }
    
    if (receivedRequests.includes(fromUserId)) {
      console.log('[sendFriendRequest] Friend request already exists from', fromUserId, 'to', toUserId);
      throw new Error('Friend request already pending for this user');
    }
    
    console.log('[sendFriendRequest] Both users exist, creating transaction');
    
    // Use transaction to ensure atomicity
    const result = await firestore.runTransaction(async (transaction) => {
      // Read documents again in transaction
      const fromUserSnapshot = await transaction.get(fromUserRef);
      const toUserSnapshot = await transaction.get(toUserRef);
      
      if (!fromUserSnapshot.exists || !toUserSnapshot.exists) {
        throw new Error('User documents do not exist');
      }
      
      const fromData = fromUserSnapshot.data();
      const toData = toUserSnapshot.data();
      
      // Ensure friendRequests field exists
      const fromFriendRequests = fromData.friendRequests || { sent: [], received: [] };
      const toFriendRequests = toData.friendRequests || { sent: [], received: [] };
      
      // Check again for existing requests or friendship
      if ((fromData.friends || []).includes(toUserId)) {
        throw new Error('You are already friends with this user');
      }
      
      const fromSentRequests = (fromData.friendRequests && fromData.friendRequests.sent) || [];
      const toReceivedRequests = (toData.friendRequests && toData.friendRequests.received) || [];
      
      console.log('[sendFriendRequest] Transaction - From sent requests:', fromSentRequests);
      console.log('[sendFriendRequest] Transaction - To received requests:', toReceivedRequests);
      
      if (fromSentRequests.includes(toUserId)) {
        throw new Error('Friend request already sent to this user');
      }
      
      if (toReceivedRequests.includes(fromUserId)) {
        throw new Error('Friend request already pending for this user');
      }
      
      // Update sender's sent requests
      transaction.update(fromUserRef, {
        'friendRequests.sent': firebase.firestore.FieldValue.arrayUnion(toUserId)
      });
      
      // Update receiver's received requests
      transaction.update(toUserRef, {
        'friendRequests.received': firebase.firestore.FieldValue.arrayUnion(fromUserId)
      });
      
      // Create notification
      const notificationRef = firestore.collection('notifications').doc();
      transaction.set(notificationRef, {
        type: 'friend_request',
        fromUserId,
        toUserId,
        createdAt: new Date(),
        read: false
      });
      
      console.log('[sendFriendRequest] Notification created with ID:', notificationRef.id);
      
      return true;
    });
    
    console.log('[sendFriendRequest] Transaction completed successfully');
    return result;
  } catch (error) {
    console.error('[sendFriendRequest] Error sending friend request:', error);
    // Re-throw the error with the specific message for UI handling
    throw error;
  }
};

export const acceptFriendRequest = async (userId, friendId) => {
  try {
    console.log('[acceptFriendRequest] Accepting request from', friendId, 'for user', userId);
    
    if (!firestore) {
      console.error('[acceptFriendRequest] Firestore is not available');
      return false;
    }
    
    const userRef = firestore.doc(`users/${userId}`);
    const friendRef = firestore.doc(`users/${friendId}`);
    
    // Check if users exist
    const [userDoc, friendDoc] = await Promise.all([
      userRef.get(),
      friendRef.get()
    ]);
    
    if (!userDoc.exists) {
      console.error('[acceptFriendRequest] User does not exist:', userId);
      return false;
    }
    
    if (!friendDoc.exists) {
      console.error('[acceptFriendRequest] Friend does not exist:', friendId);
      return false;
    }
    
    // Check if friend request exists
    const userData = userDoc.data();
    if (!userData.friendRequests || 
        !userData.friendRequests.received || 
        !userData.friendRequests.received.includes(friendId)) {
      console.error('[acceptFriendRequest] No friend request found from', friendId, 'to', userId);
      return false;
    }
    
    console.log('[acceptFriendRequest] Creating batch');
    const batch = firestore.batch();
    
    // Add to both users' friends lists
    batch.update(userRef, {
      friends: firebase.firestore.FieldValue.arrayUnion(friendId),
      'friendRequests.received': firebase.firestore.FieldValue.arrayRemove(friendId)
    });
    
    batch.update(friendRef, {
      friends: firebase.firestore.FieldValue.arrayUnion(userId),
      'friendRequests.sent': firebase.firestore.FieldValue.arrayRemove(userId)
    });
    
    console.log('[acceptFriendRequest] Committing batch');
    await batch.commit();
    console.log('[acceptFriendRequest] Friend request accepted successfully');
    return true;
  } catch (error) {
    console.error('[acceptFriendRequest] Error accepting friend request:', error);
    return false;
  }
};

export const rejectFriendRequest = async (userId, friendId) => {
  try {
    console.log('[rejectFriendRequest] Rejecting request from', friendId, 'for user', userId);
    
    if (!firestore) {
      console.error('[rejectFriendRequest] Firestore is not available');
      return false;
    }
    
    const userRef = firestore.doc(`users/${userId}`);
    const friendRef = firestore.doc(`users/${friendId}`);
    
    // Check if users exist
    const [userDoc, friendDoc] = await Promise.all([
      userRef.get(),
      friendRef.get()
    ]);
    
    if (!userDoc.exists) {
      console.error('[rejectFriendRequest] User does not exist:', userId);
      return false;
    }
    
    if (!friendDoc.exists) {
      console.error('[rejectFriendRequest] Friend does not exist:', friendId);
      return false;
    }
    
    console.log('[rejectFriendRequest] Creating batch');
    const batch = firestore.batch();
    
    // Remove from both users' request lists
    batch.update(userRef, {
      'friendRequests.received': firebase.firestore.FieldValue.arrayRemove(friendId)
    });
    
    batch.update(friendRef, {
      'friendRequests.sent': firebase.firestore.FieldValue.arrayRemove(userId)
    });
    
    console.log('[rejectFriendRequest] Committing batch');
    await batch.commit();
    console.log('[rejectFriendRequest] Friend request rejected successfully');
    return true;
  } catch (error) {
    console.error('[rejectFriendRequest] Error rejecting friend request:', error);
    return false;
  }
};

export const removeFriend = async (userId, friendId) => {
  try {
    const userRef = firestore.doc(`users/${userId}`);
    const friendRef = firestore.doc(`users/${friendId}`);
    
    const batch = firestore.batch();
    
    // Remove from both users' friends lists
    batch.update(userRef, {
      friends: firebase.firestore.FieldValue.arrayRemove(friendId)
    });
    
    batch.update(friendRef, {
      friends: firebase.firestore.FieldValue.arrayRemove(userId)
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error removing friend:', error);
    return false;
  }
};

export const searchUsers = async (searchTerm) => {
  if (!firestore) {
    console.error('Firestore is not available');
    return [];
  }
  
  try {
    console.log('[searchUsers] Searching users with displayName containing:', searchTerm);
    const usersRef = firestore.collection('users');
    
    // Get all users and filter them client-side
    // This is a workaround for Firestore's limitations with case-insensitive search
    const snapshot = await usersRef.get();
    
    const results = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.displayName && 
          userData.displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push({
          id: doc.id,
          ...userData
        });
      }
    });
    
    console.log('[searchUsers] Found', results.length, 'results');
    return results;
  } catch (error) {
    console.error('[searchUsers] Error searching users by username:', error);
    return [];
  }
};

export const searchUsersByEmail = async (email) => {
  if (!firestore) {
    console.error('[searchUsersByEmail] Firestore is not available');
    return [];
  }
  
  try {
    console.log('[searchUsersByEmail] Searching users with email containing:', email);
    const usersRef = firestore.collection('users');
    
    // Get all users and filter them client-side
    // This is necessary because we need case-insensitive search
    const snapshot = await usersRef.get();
    console.log('[searchUsersByEmail] Total users in database:', snapshot.size);
    
    const results = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      console.log('[searchUsersByEmail] Checking user:', userData.email);
      if (userData.email && 
          userData.email.toLowerCase().includes(email.toLowerCase())) {
        console.log('[searchUsersByEmail] Found match:', userData.email);
        results.push({
          id: doc.id,
          ...userData
        });
      }
    });
    
    console.log('[searchUsersByEmail] Found', results.length, 'results');
    return results;
  } catch (error) {
    console.error('[searchUsersByEmail] Error searching users by email:', error);
    return [];
  }
};

export const getUserFriends = async (userId) => {
  try {
    const userDoc = await firestore.doc(`users/${userId}`).get();
    if (!userDoc.exists) return [];
    
    const userData = userDoc.data();
    const friendIds = userData.friends || [];
    
    if (friendIds.length === 0) return [];
    
    const friendsData = [];
    for (const friendId of friendIds) {
      const friendDoc = await firestore.doc(`users/${friendId}`).get();
      if (friendDoc.exists) {
        friendsData.push({
          id: friendDoc.id,
          ...friendDoc.data()
        });
      }
    }
    
    return friendsData;
  } catch (error) {
    console.error('Error getting user friends:', error);
    return [];
  }
};

export const challengeFriend = async (fromUserId, toUserId, timeControl = 'none', gameId = null, challengerColor = 'w') => {
  try {
    console.log('[challengeFriend] Creating challenge from', fromUserId, 'to', toUserId);
    console.log('[challengeFriend] Time control:', timeControl);
    console.log('[challengeFriend] Game ID provided:', gameId);
    console.log('[challengeFriend] Challenger color:', challengerColor);
    
    // If no gameId is provided, generate one
    if (!gameId) {
      gameId = generateGameId();
      console.log('[challengeFriend] Generated new game ID:', gameId);
    }
    
    const challengeRef = firestore.collection('challenges').doc();
    await challengeRef.set({
      fromUserId,
      toUserId,
      timeControl,
      status: 'pending',
      createdAt: new Date(),
      gameId: gameId,
      challengerColor: challengerColor // Store the challenger's color preference
    });
    
    console.log('[challengeFriend] Created challenge document with ID:', challengeRef.id);
    console.log('[challengeFriend] Challenge data includes gameId:', gameId, 'and challengerColor:', challengerColor);
    
    // Create notification
    const notificationRef = firestore.collection('notifications').doc();
    await notificationRef.set({
      type: 'game_challenge',
      fromUserId,
      toUserId,
      challengeId: challengeRef.id,
      gameId: gameId,
      timeControl,
      challengerColor: challengerColor, // Include the challenger's color in the notification
      createdAt: new Date(),
      read: false
    });
    
    console.log('[challengeFriend] Created notification document with ID:', notificationRef.id);
    console.log('[challengeFriend] Notification data includes gameId:', gameId, 'and challengerColor:', challengerColor);
    
    return challengeRef.id;
  } catch (error) {
    console.error('[challengeFriend] Error challenging friend:', error);
    return null;
  }
};

export const getUserNotifications = (userId, callback) => {
  console.log('[getUserNotifications] Setting up listener for user:', userId);
  
  return firestore
    .collection('notifications')
    .where('toUserId', '==', userId)
    .where('read', '==', false)
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      (snapshot) => {
        console.log('[getUserNotifications] Received snapshot with', snapshot.size, 'notifications');
        snapshot.forEach((doc) => {
          console.log('[getUserNotifications] Notification:', doc.id, doc.data());
        });
        callback(snapshot);
      },
      (error) => {
        console.error('[getUserNotifications] Error in notification listener:', error);
      }
    );
};

// Game history functions
export const saveGameResult = async (gameData) => {
  try {
    const gameRef = firestore.collection('gameHistory').doc();
    await gameRef.set({
      ...gameData,
      createdAt: new Date()
    });
    
    // Update player ratings and stats
    if (gameData.whitePlayerId && gameData.blackPlayerId) {
      await updatePlayerStats(gameData.whitePlayerId, gameData.result === 'white');
      await updatePlayerStats(gameData.blackPlayerId, gameData.result === 'black');
    }
    
    return gameRef.id;
  } catch (error) {
    console.error('Error saving game result:', error);
    return null;
  }
};

export const updatePlayerStats = async (userId, won) => {
  try {
    const userRef = firestore.doc(`users/${userId}`);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const currentRating = userData.rating || 1200;
      const gamesPlayed = (userData.gamesPlayed || 0) + 1;
      const gamesWon = (userData.gamesWon || 0) + (won ? 1 : 0);
      
      // Simple rating calculation (can be improved with ELO system)
      const ratingChange = won ? 20 : -15;
      const newRating = Math.max(800, currentRating + ratingChange);
      
      await userRef.update({
        rating: newRating,
        gamesPlayed,
        gamesWon
      });
    }
  } catch (error) {
    console.error('Error updating player stats:', error);
  }
};

// Create a new game session
export const createGameSession = async (gameId, initialFen, timeControl = 'none') => {
  try {
    const gameData = {
      fen: initialFen,
      createdAt: Date.now(),
      lastMoveAt: Date.now(),
      gameOver: false,
      timeControl: timeControl
    };
    
    // If time control is enabled, set up initial timers for both players
    if (timeControl !== 'none') {
      const timeInSeconds = parseInt(timeControl) * 60;
      gameData.timers = {
        w: timeInSeconds,
        b: timeInSeconds
      };
      gameData.lastTimerUpdate = Date.now();
      gameData.activePlayer = 'w'; // White starts
    }
    
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    await axios.put(url, gameData);
    console.log('[createGameSession] Successfully created game with ID:', gameId);
    return true;
  } catch (error) {
    console.error("Error creating game session:", error);
    return false;
  }
};

// Join an existing game
export const joinGame = async (gameId, playerColor) => {
  try {
    console.log(`[joinGame] Joining game ${gameId} as ${playerColor}`);
    
    // Ensure user is authenticated before trying to join
    const authSuccess = await ensureAuthenticated();
    if (!authSuccess) {
      console.error("[joinGame] Authentication failed");
      throw new Error("Authentication failed");
    }
    
    const token = await getAuthToken();
    if (!token) {
      console.error("[joinGame] Failed to get auth token");
      throw new Error("Failed to get auth token");
    }
    console.log("[joinGame] Auth token obtained successfully");
    
    // First check if this player has already joined the game
    const gameUrl = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    const gameResponse = await axios.get(gameUrl);
    const gameData = gameResponse.data;
    
    if (gameData && gameData.players && gameData.players[playerColor]) {
      console.log(`[joinGame] Already joined game ${gameId} as ${playerColor}`);
      return true;
    }
    
    const updateData = {
      [`players/${playerColor}`]: {
        joinedAt: Date.now(),
        lastActive: Date.now()
      }
    };
    
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    console.log(`[joinGame] Using authenticated URL: ${url.replace(/auth=.*/, 'auth=REDACTED')}`);
    
    const response = await axios.patch(url, updateData);
    console.log(`[joinGame] Successfully joined game ${gameId} as ${playerColor}`, response.status);
    
    // Verify the join was successful by checking the updated game data
    const verifyUrl = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    const verifyResponse = await axios.get(verifyUrl);
    const updatedGameData = verifyResponse.data;
    
    if (updatedGameData && updatedGameData.players && updatedGameData.players[playerColor]) {
      console.log(`[joinGame] Successfully verified join for game ${gameId} as ${playerColor}`);
      console.log(`[joinGame] Game now has players:`, updatedGameData.players);
      return true;
    } else {
      console.error(`[joinGame] Join verification failed for game ${gameId} as ${playerColor}`);
      console.error(`[joinGame] Updated game data:`, updatedGameData);
      return false;
    }
  } catch (error) {
    console.error("Error joining game:", error);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    return false;
  }
};

// Listen to game state changes - using polling instead of real-time listeners
export const listenToGameChanges = (gameId, callback) => {
  const intervalId = setInterval(async () => {
    try {
      const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
      const response = await axios.get(url);
      if (response.data) {
        callback(response.data);
      }
    } catch (error) {
      console.error("Error polling game changes:", error);
    }
  }, 2000); // Poll every 2 seconds
  
  // Return a function to stop polling
  return () => clearInterval(intervalId);
};

// Update game state with new move
export const updateGameState = async (gameId, newFen, gameOver = false, nextPlayer = null) => {
  try {
    const updateData = {
      fen: newFen,
      lastMoveAt: Date.now(),
      gameOver: gameOver
    };
    
    // If we know which player's turn is next, update the active player
    if (nextPlayer) {
      updateData.activePlayer = nextPlayer;
    }
    
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    await axios.patch(url, updateData);
    return true;
  } catch (error) {
    console.error("Error updating game state:", error);
    return false;
  }
};

// Update timer for a player
export const updatePlayerTimer = async (gameId, color, timeRemaining) => {
  try {
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}/timers.json`);
    await axios.patch(url, {
      [color]: timeRemaining,
      lastUpdate: Date.now()
    });
    return true;
  } catch (error) {
    console.error("Error updating player timer:", error);
    return false;
  }
};

// Update selected piece
export const updateSelectedPiece = async (gameId, selectedPiece) => {
  try {
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    await axios.patch(url, {
      selectedPiece: selectedPiece
    });
    return true;
  } catch (error) {
    console.error("Error updating selected piece:", error);
    return false;
  }
};

// Get game data directly with retry mechanism
export const getGameData = async (gameId, retryCount = 3, retryDelay = 500) => {
  console.log(`[getGameData] Attempting to get game data for ID: ${gameId}, retry: ${retryCount}`);
  try {
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    const response = await axios.get(url);
    console.log(`[getGameData] Response for game ${gameId}:`, response.data);
    
    // If data is null but we have retries left, try again after a delay
    if (!response.data && retryCount > 0) {
      console.log(`[getGameData] No data found for game ${gameId}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return getGameData(gameId, retryCount - 1, retryDelay * 1.5);
    }
    
    return response.data;
  } catch (error) {
    console.error(`[getGameData] Error getting game data for ID: ${gameId}:`, error);
    
    // Retry on network/server errors if we have retries left
    if (retryCount > 0) {
      console.log(`[getGameData] Retrying after error for game ${gameId}...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return getGameData(gameId, retryCount - 1, retryDelay * 1.5);
    }
    
    return null;
  }
};

// Check if a color is already taken in a game
export const isColorTaken = async (gameId, color) => {
  try {
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}/players/${color}.json`);
    const response = await axios.get(url);
    return !!response.data;
  } catch (error) {
    console.error("Error checking if color is taken:", error);
    return false;
  }
};

// Generate a random game ID
export const generateGameId = () => {
  return Math.random().toString(36).substring(2, 8);
};

// Check if a game exists
export const checkGameExists = async (gameId) => {
  try {
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    const response = await axios.get(url);
    return !!response.data;
  } catch (error) {
    console.error("Error checking game exists:", error);
    return false;
  }
};

// Declare game over by timeout
export const declareTimeoutWin = async (gameId, winnerColor) => {
  try {
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    await axios.patch(url, {
      gameOver: true,
      gameOverReason: 'timeout',
      winner: winnerColor
    });
    return true;
  } catch (error) {
    console.error("Error declaring timeout win:", error);
    return false;
  }
};

// Send a chat message
export const sendChatMessage = async (gameId, message) => {
  try {
    // Get current chat messages
    const getUrl = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}/chat.json`);
    const response = await axios.get(getUrl);
    let messages = response.data || [];
    
    // If messages is not an array, convert it to an array
    if (!Array.isArray(messages)) {
      messages = Object.values(messages);
    }
    
    // Add new message
    messages.push(message);
    
    // Keep only the last 50 messages to prevent the database from growing too large
    if (messages.length > 50) {
      messages = messages.slice(messages.length - 50);
    }
    
    // Update the chat messages
    const putUrl = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}/chat.json`);
    await axios.put(putUrl, messages);
    return true;
  } catch (error) {
    console.error("Error sending chat message:", error);
    return false;
  }
};

// Listen to chat messages
export const listenToChat = (gameId, callback) => {
  const intervalId = setInterval(async () => {
    try {
      const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}/chat.json`);
      const response = await axios.get(url);
      let messages = response.data || [];
      
      // If messages is not an array, convert it to an array
      if (!Array.isArray(messages) && messages) {
        messages = Object.values(messages);
      }
      
      callback(messages);
    } catch (error) {
      console.error("Error polling chat messages:", error);
    }
  }, 1000); // Poll every second for more responsive chat
  
  // Return a function to stop polling
  return () => clearInterval(intervalId);
};

// Test Firestore permissions
export const testFirestorePermissions = async () => {
  if (!firestore) {
    console.error('[testFirestorePermissions] Firestore is not available');
    return false;
  }
  
  try {
    console.log('[testFirestorePermissions] Testing write permissions...');
    // Try to write to a test document
    const testRef = firestore.collection('_test_permissions').doc('test');
    await testRef.set({
      timestamp: new Date(),
      test: true
    });
    
    console.log('[testFirestorePermissions] Write successful');
    
    // Clean up the test document
    await testRef.delete();
    console.log('[testFirestorePermissions] Test document deleted');
    
    return true;
  } catch (error) {
    console.error('[testFirestorePermissions] Write permission denied:', error);
    return false;
  }
};

// Clear stale friend requests for debugging purposes
export const clearStaleRequests = async (userId) => {
  if (!firestore) {
    console.error('[clearStaleRequests] Firestore is not available');
    return false;
  }
  
  try {
    console.log('[clearStaleRequests] Clearing stale requests for user:', userId);
    
    const userRef = firestore.doc(`users/${userId}`);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error('[clearStaleRequests] User does not exist:', userId);
      return false;
    }
    
    const userData = userDoc.data();
    const friendRequests = userData.friendRequests || { sent: [], received: [] };
    
    console.log('[clearStaleRequests] Current friend requests:', friendRequests);
    
    // Clear all sent and received requests
    await userRef.update({
      'friendRequests.sent': [],
      'friendRequests.received': []
    });
    
    console.log('[clearStaleRequests] Cleared all friend requests for user:', userId);
    
    // Also clean up related notifications
    const notificationsQuery = firestore
      .collection('notifications')
      .where('toUserId', '==', userId)
      .where('type', '==', 'friend_request');
    
    const notificationsSnapshot = await notificationsQuery.get();
    const batch = firestore.batch();
    
    notificationsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (!notificationsSnapshot.empty) {
      await batch.commit();
      console.log('[clearStaleRequests] Deleted', notificationsSnapshot.size, 'friend request notifications');
    }
    
    return true;
  } catch (error) {
    console.error('[clearStaleRequests] Error clearing stale requests:', error);
    return false;
  }
};

export default { 
  createGameSession, 
  joinGame, 
  listenToGameChanges, 
  updateGameState, 
  updateSelectedPiece, 
  getGameData, 
  isColorTaken, 
  generateGameId, 
  checkGameExists,
  updatePlayerTimer,
  declareTimeoutWin,
  sendChatMessage,
  listenToChat,
  createUserProfileDocument,
  updateUserOnlineStatus,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  searchUsersByEmail,
  getUserFriends,
  challengeFriend,
  getUserNotifications,
  saveGameResult,
  updatePlayerStats,
  testFirestorePermissions,
  clearStaleRequests,
  ensureAuthenticated
};