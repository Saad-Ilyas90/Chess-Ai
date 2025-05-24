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
    try {
      await auth.signInAnonymously();
      return true;
    } catch (error) {
      return false;
    }
  }
  return true;
};

// Helper function to get the current user's auth token
const getAuthToken = async () => {
  // Ensure user is authenticated
  await ensureAuthenticated();
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }
  
  try {
    const token = await currentUser.getIdToken();
    return token;
  } catch (error) {
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
        return null; // Return null if we can't create the profile
      }
    }
    
    return userRef;
  } catch (error) {
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
    // Silently fail
  }
};

// Friend System Functions
export const sendFriendRequest = async (fromUserId, toUserId) => {
  try {
    if (!firestore) {
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
      throw new Error('Sender account not found');
    }
    
    if (!toUserDoc.exists) {
      throw new Error('Recipient account not found');
    }
    
    // Get user data
    const fromUserData = fromUserDoc.data();
    const toUserData = toUserDoc.data();
    
    // Check if already friends or request already sent
    const fromFriends = fromUserData.friends || [];
    const sentRequests = (fromUserData.friendRequests && fromUserData.friendRequests.sent) || [];
    const receivedRequests = (toUserData.friendRequests && toUserData.friendRequests.received) || [];
    
    if (fromFriends.includes(toUserId)) {
      throw new Error('You are already friends with this user');
    }
    
    if (sentRequests.includes(toUserId)) {
      throw new Error('Friend request already sent to this user');
    }
    
    if (receivedRequests.includes(fromUserId)) {
      throw new Error('Friend request already pending for this user');
    }
    
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
      
      return true;
    });
    
    return result;
  } catch (error) {
    // Re-throw the error with the specific message for UI handling
    throw error;
  }
};

export const acceptFriendRequest = async (userId, friendId) => {
  try {
    if (!firestore) {
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
      return false;
    }
    
    if (!friendDoc.exists) {
      return false;
    }
    
    // Check if friend request exists
    const userData = userDoc.data();
    if (!userData.friendRequests || 
        !userData.friendRequests.received || 
        !userData.friendRequests.received.includes(friendId)) {
      return false;
    }
    
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
    
    await batch.commit();
    return true;
  } catch (error) {
    return false;
  }
};

export const rejectFriendRequest = async (userId, friendId) => {
  try {
    if (!firestore) {
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
      return false;
    }
    
    if (!friendDoc.exists) {
      return false;
    }
    
    const batch = firestore.batch();
    
    // Remove from both users' request lists
    batch.update(userRef, {
      'friendRequests.received': firebase.firestore.FieldValue.arrayRemove(friendId)
    });
    
    batch.update(friendRef, {
      'friendRequests.sent': firebase.firestore.FieldValue.arrayRemove(userId)
    });
    
    await batch.commit();
    return true;
  } catch (error) {
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
    return false;
  }
};

export const searchUsers = async (searchTerm) => {
  if (!firestore) {
    return [];
  }
  
  try {
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
    
    return results;
  } catch (error) {
    return [];
  }
};

export const searchUsersByEmail = async (email) => {
  if (!firestore) {
    return [];
  }
  
  try {
    const usersRef = firestore.collection('users');
    
    // Get all users and filter them client-side
    // This is necessary because we need case-insensitive search
    const snapshot = await usersRef.get();
    
    const results = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.email && 
          userData.email.toLowerCase().includes(email.toLowerCase())) {
        results.push({
          id: doc.id,
          ...userData
        });
      }
    });
    
    return results;
  } catch (error) {
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
    return [];
  }
};

export const challengeFriend = async (fromUserId, toUserId, timeControl = 'none', gameId = null, challengerColor = 'w') => {
  try {
    // If no gameId is provided, generate one
    if (!gameId) {
      gameId = generateGameId();
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
    
    return challengeRef.id;
  } catch (error) {
    return null;
  }
};

export const getUserNotifications = (userId, callback) => {
  return firestore
    .collection('notifications')
    .where('toUserId', '==', userId)
    .where('read', '==', false)
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      (snapshot) => {
        callback(snapshot);
      },
      (error) => {
        // Silently fail
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
    // Silently fail
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
    return true;
  } catch (error) {
    return false;
  }
};

// Join an existing game
export const joinGame = async (gameId, playerColor) => {
  try {
    // Ensure user is authenticated before trying to join
    const authSuccess = await ensureAuthenticated();
    if (!authSuccess) {
      throw new Error("Authentication failed");
    }
    
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Failed to get auth token");
    }
    
    // First check if this player has already joined the game
    const gameUrl = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    const gameResponse = await axios.get(gameUrl);
    const gameData = gameResponse.data;
    
    if (gameData && gameData.players && gameData.players[playerColor]) {
      return true;
    }
    
    const updateData = {
      [`players/${playerColor}`]: {
        joinedAt: Date.now(),
        lastActive: Date.now()
      }
    };
    
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    
    const response = await axios.patch(url, updateData);
    
    // Verify the join was successful by checking the updated game data
    const verifyUrl = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    const verifyResponse = await axios.get(verifyUrl);
    const updatedGameData = verifyResponse.data;
    
    if (updatedGameData && updatedGameData.players && updatedGameData.players[playerColor]) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
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
      // Silently fail
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
    return false;
  }
};

// Get game data directly with retry mechanism
export const getGameData = async (gameId, retryCount = 3, retryDelay = 500) => {
  try {
    const url = await getUrlWithAuth(`${dbBaseUrl}/games/${gameId}.json`);
    const response = await axios.get(url);
    
    // If data is null but we have retries left, try again after a delay
    if (!response.data && retryCount > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return getGameData(gameId, retryCount - 1, retryDelay * 1.5);
    }
    
    return response.data;
  } catch (error) {
    // Retry on network/server errors if we have retries left
    if (retryCount > 0) {
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
      // Silently fail
    }
  }, 1000); // Poll every second for more responsive chat
  
  // Return a function to stop polling
  return () => clearInterval(intervalId);
};

// Test Firestore permissions
export const testFirestorePermissions = async () => {
  if (!firestore) {
    return false;
  }
  
  try {
    // Try to write to a test document
    const testRef = firestore.collection('_test_permissions').doc('test');
    await testRef.set({
      timestamp: new Date(),
      test: true
    });
    
    // Clean up the test document
    await testRef.delete();
    
    return true;
  } catch (error) {
    return false;
  }
};

// Clear stale friend requests for debugging purposes
export const clearStaleRequests = async (userId) => {
  if (!firestore) {
    return false;
  }
  
  try {
    const userRef = firestore.doc(`users/${userId}`);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return false;
    }
    
    const userData = userDoc.data();
    const friendRequests = userData.friendRequests || { sent: [], received: [] };
    
    // Clear all sent and received requests
    await userRef.update({
      'friendRequests.sent': [],
      'friendRequests.received': []
    });
    
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
    }
    
    return true;
  } catch (error) {
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