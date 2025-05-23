import React, { Component } from 'react';
import { auth, signInWithGoogle } from '../firebase';
import RaisedButton from 'material-ui/RaisedButton';
import TextField from 'material-ui/TextField';
import Paper from 'material-ui/Paper';
import Divider from 'material-ui/Divider';
import Snackbar from 'material-ui/Snackbar';

class SignInPage extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isSignUp: false,
      email: '',
      password: '',
      confirmPassword: '',
      displayName: '',
      error: '',
      showError: false,
      loading: false,
      showForgotPassword: false,
      resetEmail: ''
    };
  }

  handleInputChange = (field) => (event) => {
    this.setState({ [field]: event.target.value });
  }

  handleEmailPasswordAuth = async () => {
    const { isSignUp, email, password, confirmPassword, displayName } = this.state;
    
    if (!email || !password) {
      this.showError('Please fill in all required fields');
      return;
    }
    
    if (isSignUp) {
      if (password !== confirmPassword) {
        this.showError('Passwords do not match');
        return;
      }
      if (!displayName) {
        this.showError('Please enter a display name');
        return;
      }
      if (password.length < 6) {
        this.showError('Password must be at least 6 characters');
        return;
      }
    }

    this.setState({ loading: true });

    try {
      let userCredential;
      
      if (isSignUp) {
        userCredential = await auth.createUserWithEmailAndPassword(email, password);
        // Update profile with display name
        await userCredential.user.updateProfile({
          displayName: displayName
        });
      } else {
        userCredential = await auth.signInWithEmailAndPassword(email, password);
      }
      
      // Reset form
      this.setState({
        email: '',
        password: '',
        confirmPassword: '',
        displayName: '',
        loading: false
      });
    } catch (error) {
      let errorMessage = 'Authentication failed';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email already exists';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        default:
          errorMessage = error.message;
      }
      
      this.showError(errorMessage);
      this.setState({ loading: false });
    }
  }

  handleGoogleSignIn = async () => {
    this.setState({ loading: true });
    
    try {
      await signInWithGoogle();
    } catch (error) {
      this.showError('Google sign-in failed: ' + error.message);
      this.setState({ loading: false });
    }
  }

  handleForgotPassword = async () => {
    const { resetEmail } = this.state;
    
    if (!resetEmail) {
      this.showError('Please enter your email address');
      return;
    }

    try {
      await auth.sendPasswordResetEmail(resetEmail);
      this.showError('Password reset email sent! Check your inbox.');
      this.setState({ showForgotPassword: false, resetEmail: '' });
    } catch (error) {
      this.showError('Failed to send reset email: ' + error.message);
    }
  }

  showError = (error) => {
    this.setState({ error, showError: true });
  }

  toggleAuthMode = () => {
    this.setState({ 
      isSignUp: !this.state.isSignUp,
      error: '',
      showError: false,
      email: '',
      password: '',
      confirmPassword: '',
      displayName: ''
    });
  }

  toggleForgotPassword = () => {
    this.setState({ 
      showForgotPassword: !this.state.showForgotPassword,
      error: '',
      showError: false,
      resetEmail: ''
    });
  }

  render() {
    const { 
      isSignUp, 
      email, 
      password, 
      confirmPassword, 
      displayName,
      error,
      showError,
      loading,
      showForgotPassword,
      resetEmail
    } = this.state;

    const containerStyle = {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    };

    const paperStyle = {
      padding: '40px',
      maxWidth: '400px',
      width: '100%',
      textAlign: 'center'
    };

    const titleStyle = {
      fontSize: '28px',
      marginBottom: '10px',
      color: '#333',
      fontFamily: 'ultraminimal, sans-serif'
    };

    const subtitleStyle = {
      fontSize: '16px',
      color: '#666',
      marginBottom: '30px'
    };

    const buttonStyle = {
      width: '100%',
      marginBottom: '15px'
    };

    const textFieldStyle = {
      width: '100%',
      marginBottom: '15px'
    };

    const linkStyle = {
      color: '#4CAF50',
      cursor: 'pointer',
      textDecoration: 'underline',
      fontSize: '14px'
    };

    if (showForgotPassword) {
      return (
        <div style={containerStyle} className="auth-container">
          <Paper style={paperStyle}>
            <h1 style={titleStyle}>Reset Password</h1>
            <p style={subtitleStyle}>Enter your email to receive a password reset link</p>
            
            <TextField
              hintText="Email"
              type="email"
              value={resetEmail}
              onChange={this.handleInputChange('resetEmail')}
              style={textFieldStyle}
            />
            
            <RaisedButton
              label="Send Reset Email"
              primary={true}
              onClick={this.handleForgotPassword}
              style={buttonStyle}
              disabled={loading}
              backgroundColor="#4CAF50"
              labelColor="#fff"
            />
            
            <div style={{ marginTop: '20px' }}>
              <span style={linkStyle} onClick={this.toggleForgotPassword}>
                Back to Sign In
              </span>
            </div>
          </Paper>
          
          <Snackbar
            open={showError}
            message={error}
            autoHideDuration={4000}
            onRequestClose={() => this.setState({ showError: false })}
          />
        </div>
      );
    }

    return (
      <div style={containerStyle} className="auth-container">
        <Paper style={paperStyle}>
          <h1 style={titleStyle}>Chess AI</h1>
          <p style={subtitleStyle}>
            {isSignUp ? 'Create an account to play with friends' : 'Sign in to play with friends'}
          </p>
          
          {/* Google Sign In */}
          <RaisedButton
            label="Continue with Google"
            onClick={this.handleGoogleSignIn}
            style={buttonStyle}
            disabled={loading}
            backgroundColor="#4285f4"
            labelColor="#fff"
          />
          
          <Divider style={{ margin: '20px 0' }} />
          
          {/* Email/Password Form */}
          {isSignUp && (
            <TextField
              hintText="Display Name"
              value={displayName}
              onChange={this.handleInputChange('displayName')}
              style={textFieldStyle}
            />
          )}
          
          <TextField
            hintText="Email"
            type="email"
            value={email}
            onChange={this.handleInputChange('email')}
            style={textFieldStyle}
          />
          
          <TextField
            hintText="Password"
            type="password"
            value={password}
            onChange={this.handleInputChange('password')}
            style={textFieldStyle}
          />
          
          {isSignUp && (
            <TextField
              hintText="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={this.handleInputChange('confirmPassword')}
              style={textFieldStyle}
            />
          )}
          
          <RaisedButton
            label={isSignUp ? 'Sign Up' : 'Sign In'}
            primary={true}
            onClick={this.handleEmailPasswordAuth}
            style={buttonStyle}
            disabled={loading}
            backgroundColor="#4CAF50"
            labelColor="#fff"
          />
          
          {!isSignUp && (
            <div style={{ marginBottom: '20px' }}>
              <span style={linkStyle} onClick={this.toggleForgotPassword}>
                Forgot Password?
              </span>
            </div>
          )}
          
          <Divider style={{ margin: '20px 0' }} />
          
          {/* Play as Guest */}
          <RaisedButton
            label="Play as Guest"
            onClick={this.props.onPlayAsGuest}
            style={buttonStyle}
            disabled={loading}
            backgroundColor="#757575"
            labelColor="#fff"
          />
          
          {/* Toggle between sign in/up */}
          <div style={{ marginTop: '20px' }}>
            <span style={{ color: '#666', fontSize: '14px' }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </span>
            <span style={linkStyle} onClick={this.toggleAuthMode}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </span>
          </div>
        </Paper>
        
        <Snackbar
          open={showError}
          message={error}
          autoHideDuration={4000}
          onRequestClose={() => this.setState({ showError: false })}
        />
      </div>
    );
  }
}

export default SignInPage; 