import axios from 'axios';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQN0Y7U2dD4NL1lXjP9we4k9cpx8hPuRI",
  projectId: "chess-ed556",
  databaseURL: "https://chess-ed556-default-rtdb.firebaseio.com"
};

// Firebase Realtime Database REST API base URL
const dbBaseUrl = firebaseConfig.databaseURL || "https://chess-ed556-default-rtdb.firebaseio.com";

// Create a new game session
export const createGameSession = async (gameId, initialFen) => {
  try {
    await axios.put(`${dbBaseUrl}/games/${gameId}.json`, {
      fen: initialFen,
      createdAt: Date.now(),
      lastMoveAt: Date.now(),
      gameOver: false
    });
    return true;
  } catch (error) {
    console.error("Error creating game session:", error);
    return false;
  }
};

// Join an existing game
export const joinGame = async (gameId, playerColor) => {
  try {
    const updateData = {
      [`players/${playerColor}`]: true,
      lastJoinedAt: Date.now()
    };
    await axios.patch(`${dbBaseUrl}/games/${gameId}.json`, updateData);
    return true;
  } catch (error) {
    console.error("Error joining game:", error);
    return false;
  }
};

// Listen to game state changes - using polling instead of real-time listeners
export const listenToGameChanges = (gameId, callback) => {
  const intervalId = setInterval(async () => {
    try {
      const response = await axios.get(`${dbBaseUrl}/games/${gameId}.json`);
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
export const updateGameState = async (gameId, newFen, gameOver = false) => {
  try {
    await axios.patch(`${dbBaseUrl}/games/${gameId}.json`, {
      fen: newFen,
      lastMoveAt: Date.now(),
      gameOver: gameOver
    });
    return true;
  } catch (error) {
    console.error("Error updating game state:", error);
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
    const response = await axios.get(`${dbBaseUrl}/games/${gameId}.json`);
    return !!response.data;
  } catch (error) {
    console.error("Error checking game exists:", error);
    return false;
  }
};

export default { createGameSession, joinGame, listenToGameChanges, updateGameState, generateGameId, checkGameExists }; 