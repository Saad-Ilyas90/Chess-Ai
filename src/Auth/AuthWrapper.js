import React, { Component } from 'react';
import { auth, createUserProfileDocument, updateUserOnlineStatus } from '../firebase';
import SignInPage from './SignInPage';

class AuthWrapper extends Component {
  constructor(props) {
    super(props);
    
    // Check if we need to show sign-in page from landing page navigation
    const needsAuth = localStorage.getItem('needsAuth') === 'true';
    if (needsAuth) {
      // Clear the flag
      localStorage.removeItem('needsAuth');
    }
    
    this.state = {
      currentUser: null,
      loading: true,
      isGuest: false,
      forceSignIn: needsAuth
    };
  }

  unsubscribeFromAuth = null;

  componentDidMount() {
    this.unsubscribeFromAuth = auth.onAuthStateChanged(async userAuth => {
      if (userAuth) {
        try {
          const userRef = await createUserProfileDocument(userAuth);
          
          if (userRef) {
            userRef.onSnapshot(snapShot => {
              this.setState({
                currentUser: {
                  id: snapShot.id,
                  ...snapShot.data()
                },
                loading: false,
                isGuest: false
              });
            }, (error) => {
              console.warn('Firestore snapshot error:', error);
              // Fallback to basic user data if Firestore fails
              this.setState({
                currentUser: {
                  id: userAuth.uid,
                  displayName: userAuth.displayName || 'User',
                  email: userAuth.email,
                  photoURL: userAuth.photoURL || null,
                  isOnline: true,
                  rating: 1200,
                  gamesPlayed: 0,
                  gamesWon: 0
                },
                loading: false,
                isGuest: false
              });
            });
          } else {
            // If createUserProfileDocument fails, use basic user data
            this.setState({
              currentUser: {
                id: userAuth.uid,
                displayName: userAuth.displayName || 'User',
                email: userAuth.email,
                photoURL: userAuth.photoURL || null,
                isOnline: true,
                rating: 1200,
                gamesPlayed: 0,
                gamesWon: 0
              },
              loading: false,
              isGuest: false
            });
          }

          // Update online status (optional, won't break if it fails)
          try {
            await updateUserOnlineStatus(userAuth.uid, true);
          } catch (error) {
            console.warn('Could not update online status:', error);
          }
          
          // Set up offline status update when user leaves
          window.addEventListener('beforeunload', () => {
            updateUserOnlineStatus(userAuth.uid, false).catch(err => 
              console.warn('Could not update offline status:', err)
            );
          });
        } catch (error) {
          console.error('Error in authentication flow:', error);
          // Fallback to basic user data if everything fails
          this.setState({
            currentUser: {
              id: userAuth.uid,
              displayName: userAuth.displayName || 'User',
              email: userAuth.email,
              photoURL: userAuth.photoURL || null,
              isOnline: true,
              rating: 1200,
              gamesPlayed: 0,
              gamesWon: 0
            },
            loading: false,
            isGuest: false
          });
        }
      } else {
        this.setState({ currentUser: null, loading: false, isGuest: false });
      }
    });
  }

  componentWillUnmount() {
    if (this.unsubscribeFromAuth) {
      this.unsubscribeFromAuth();
    }
    
    // Update offline status when component unmounts
    if (this.state.currentUser && !this.state.isGuest) {
      updateUserOnlineStatus(this.state.currentUser.id, false);
    }
  }

  handlePlayAsGuest = () => {
    this.setState({ 
      isGuest: true, 
      currentUser: { 
        id: 'guest',
        displayName: 'Guest',
        isGuest: true,
        rating: null,
        gamesPlayed: 0,
        gamesWon: 0
      },
      loading: false 
    });
  }

  handleSignOut = async () => {
    if (this.state.currentUser && !this.state.isGuest) {
      await updateUserOnlineStatus(this.state.currentUser.id, false);
      await auth.signOut();
    }
    this.setState({ 
      currentUser: null, 
      isGuest: false, 
      loading: false 
    });
  }

  render() {
    const { loading, currentUser, isGuest, forceSignIn } = this.state;
    
    if (loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '20px' }}>Loading...</div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #333',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      );
    }

    if (!currentUser && !isGuest || forceSignIn) {
      return <SignInPage onPlayAsGuest={this.handlePlayAsGuest} />;
    }

    return React.cloneElement(this.props.children, { 
      currentUser, 
      isGuest,
      onSignOut: this.handleSignOut 
    });
  }
}

export default AuthWrapper; 