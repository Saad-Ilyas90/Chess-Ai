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
    
    await axios.put(`${dbBaseUrl}/games/${gameId}.json`, gameData);
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
      [`players/${playerColor}`]: {
        joinedAt: Date.now(),
        lastActive: Date.now()
      }
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
    
    await axios.patch(`${dbBaseUrl}/games/${gameId}.json`, updateData);
    return true;
  } catch (error) {
    console.error("Error updating game state:", error);
    return false;
  }
};

// Update timer for a player
export const updatePlayerTimer = async (gameId, color, timeRemaining) => {
  try {
    await axios.patch(`${dbBaseUrl}/games/${gameId}/timers.json`, {
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
    await axios.patch(`${dbBaseUrl}/games/${gameId}.json`, {
      selectedPiece: selectedPiece
    });
    return true;
  } catch (error) {
    console.error("Error updating selected piece:", error);
    return false;
  }
};

// Get game data directly
export const getGameData = async (gameId) => {
  try {
    const response = await axios.get(`${dbBaseUrl}/games/${gameId}.json`);
    return response.data;
  } catch (error) {
    console.error("Error getting game data:", error);
    return null;
  }
};

// Check if a color is already taken in a game
export const isColorTaken = async (gameId, color) => {
  try {
    const response = await axios.get(`${dbBaseUrl}/games/${gameId}/players/${color}.json`);
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
    const response = await axios.get(`${dbBaseUrl}/games/${gameId}.json`);
    return !!response.data;
  } catch (error) {
    console.error("Error checking game exists:", error);
    return false;
  }
};

// Declare game over by timeout
export const declareTimeoutWin = async (gameId, winnerColor) => {
  try {
    await axios.patch(`${dbBaseUrl}/games/${gameId}.json`, {
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
  declareTimeoutWin
}; 