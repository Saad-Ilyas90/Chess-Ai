// friendRequestDebug.js - Debugging utilities for friend requests
import firebase from 'firebase/app';
import 'firebase/firestore';

/**
 * Create a test friend request in Firestore
 * @param {string} fromUserId - The user sending the request
 * @param {string} toUserId - The user receiving the request
 * @returns {Promise<string>} - The notification ID or null if failed
 */
export const createTestFriendRequest = async (fromUserId, toUserId) => {
  try {
    const firestore = firebase.firestore();
    
    // Create notification
    const notificationRef = firestore.collection('notifications').doc();
    await notificationRef.set({
      type: 'friend_request',
      fromUserId,
      toUserId,
      createdAt: new Date(),
      read: false
    });
    
    return notificationRef.id;
  } catch (error) {
    console.error('[DEBUG] Error creating test friend request:', error);
    return null;
  }
};

/**
 * Reset read status of all friend requests for a user
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - Number of notifications updated
 */
export const resetFriendRequestsReadStatus = async (userId) => {
  try {
    const firestore = firebase.firestore();
    const snapshot = await firestore
      .collection('notifications')
      .where('toUserId', '==', userId)
      .where('type', '==', 'friend_request')
      .get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    let count = 0;
    const batch = firestore.batch();
    
    snapshot.forEach(doc => {
      batch.update(doc.ref, { read: false });
      count++;
    });
    
    await batch.commit();
    return count;
  } catch (error) {
    console.error('[DEBUG] Error resetting friend request read status:', error);
    return 0;
  }
};

/**
 * Get all friend requests (read and unread) for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} - Array of friend request notifications
 */
export const getAllFriendRequests = async (userId) => {
  try {
    const firestore = firebase.firestore();
    const snapshot = await firestore
      .collection('notifications')
      .where('toUserId', '==', userId)
      .where('type', '==', 'friend_request')
      .get();
    
    const requests = [];
    snapshot.forEach(doc => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return requests;
  } catch (error) {
    console.error('[DEBUG] Error getting friend requests:', error);
    return [];
  }
};

/**
 * Check if user IDs in notifications exist and have complete profiles
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - Report of notification status
 */
export const validateNotifications = async (userId) => {
  try {
    const firestore = firebase.firestore();
    const snapshot = await firestore
      .collection('notifications')
      .where('toUserId', '==', userId)
      .get();
    
    const report = {
      total: snapshot.size,
      valid: 0,
      invalid: 0,
      details: []
    };
    
    for (const doc of snapshot.docs) {
      const notification = {
        id: doc.id,
        ...doc.data()
      };
      
      const fromUserExists = await firestore.doc(`users/${notification.fromUserId}`).get()
        .then(doc => doc.exists)
        .catch(() => false);
      
      const status = fromUserExists ? 'valid' : 'invalid';
      
      report.details.push({
        id: notification.id,
        type: notification.type,
        fromUserId: notification.fromUserId,
        userExists: fromUserExists,
        status
      });
      
      if (fromUserExists) {
        report.valid++;
      } else {
        report.invalid++;
      }
    }
    
    return report;
  } catch (error) {
    console.error('[DEBUG] Error validating notifications:', error);
    return { total: 0, valid: 0, invalid: 0, details: [], error: error.message };
  }
};

export default {
  createTestFriendRequest,
  resetFriendRequestsReadStatus,
  getAllFriendRequests,
  validateNotifications
};