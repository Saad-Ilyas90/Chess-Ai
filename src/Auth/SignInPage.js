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
      resetEmail: '',
      // Validation states
      emailError: '',
      passwordError: '',
      confirmPasswordError: '',
      displayNameError: '',
      resetEmailError: ''
    };
  }

  handleInputChange = (field) => (event) => {
    const value = event.target.value;
    this.setState({ [field]: value }, () => {
      // Run validation as user types
      this.validateField(field, value);
    });
  }
  
  validateField = (field, value) => {
    let error = '';
    
    switch (field) {
      case 'email':
      case 'resetEmail':
        // Email validation
        if (!value) {
          error = 'Email is required';
        } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
          error = 'Invalid email address';
        }
        this.setState({ [field + 'Error']: error });
        break;
        
      case 'password':
        // Password validation
        if (!value) {
          error = 'Password is required';
        } else if (value.length < 6) {
          error = 'Password must be at least 6 characters';
        } else if (this.state.isSignUp && !/[0-9]/.test(value)) {
          error = 'Password must contain at least one number';
        }
        this.setState({ passwordError: error });
        
        // Check confirmation password match if already entered
        if (this.state.confirmPassword && this.state.isSignUp) {
          const confirmError = value !== this.state.confirmPassword ? 'Passwords do not match' : '';
          this.setState({ confirmPasswordError: confirmError });
        }
        break;
        
      case 'confirmPassword':
        // Confirm password validation
        if (this.state.isSignUp) {
          if (!value) {
            error = 'Please confirm your password';
          } else if (value !== this.state.password) {
            error = 'Passwords do not match';
          }
          this.setState({ confirmPasswordError: error });
        }
        break;
        
      case 'displayName':
        // Display name validation
        if (this.state.isSignUp && !value) {
          error = 'Display name is required';
        } else if (value && value.length < 2) {
          error = 'Display name must be at least 2 characters';
        }
        this.setState({ displayNameError: error });
        break;
        
      default:
        break;
    }
    
    return !error; // Return true if valid, false if invalid
  }

  handleEmailPasswordAuth = async () => {
    const { isSignUp, email, password, confirmPassword, displayName } = this.state;
    
    // Validate all fields first
    const isEmailValid = this.validateField('email', email);
    const isPasswordValid = this.validateField('password', password);
    let isConfirmPasswordValid = true;
    let isDisplayNameValid = true;
    
    if (isSignUp) {
      isConfirmPasswordValid = this.validateField('confirmPassword', confirmPassword);
      isDisplayNameValid = this.validateField('displayName', displayName);
    }
    
    // Show the first validation error encountered
    if (!isEmailValid) {
      this.showError(this.state.emailError || 'Please enter a valid email');
      return;
    }
    
    if (!isPasswordValid) {
      this.showError(this.state.passwordError || 'Please enter a valid password');
      return;
    }
    
    if (isSignUp && !isConfirmPasswordValid) {
      this.showError(this.state.confirmPasswordError || 'Please confirm your password');
      return;
    }
    
    if (isSignUp && !isDisplayNameValid) {
      this.showError(this.state.displayNameError || 'Please enter a valid display name');
      return;
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
    
    const isResetEmailValid = this.validateField('resetEmail', resetEmail);
    
    if (!isResetEmailValid) {
      this.showError(this.state.resetEmailError || 'Please enter a valid email address');
      return;
    }

    this.setState({ loading: true });
    
    try {
      // First check if the user exists before sending a reset email
      let userExists = false;
      try {
        // Try to sign in with an empty password to trigger a specific error
        // that confirms the email exists (but obviously with wrong password)
        await auth.signInWithEmailAndPassword(resetEmail, 'temp-password-for-check');
        userExists = true; // This would rarely execute as the password should be wrong
      } catch (checkError) {
        // If error is 'wrong-password', then user exists
        userExists = checkError.code === 'auth/wrong-password';
        
        // If user doesn't exist, show error and return
        if (checkError.code === 'auth/user-not-found') {
          this.showError('No account exists with this email address');
          this.setState({ loading: false });
          return;
        }
      }
      
      // If we get here, either the user exists or we couldn't determine
      // In either case, attempt to send the reset email
      await auth.sendPasswordResetEmail(resetEmail);
      this.showError('Password reset email sent! Check your inbox.');
      this.setState({ showForgotPassword: false, resetEmail: '', loading: false });
    } catch (error) {
      let errorMessage = 'Failed to send reset email';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account exists with this email address';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Please try again later';
          break;
        default:
          errorMessage = error.message;
      }
      
      this.showError(errorMessage);
      this.setState({ loading: false });
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
      displayName: '',
      // Reset validation errors
      emailError: '',
      passwordError: '',
      confirmPasswordError: '',
      displayNameError: ''
    });
  }

  toggleForgotPassword = () => {
    this.setState({ 
      showForgotPassword: !this.state.showForgotPassword,
      error: '',
      showError: false,
      resetEmail: '',
      resetEmailError: ''
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
              value={resetEmail}
              onChange={this.handleInputChange('resetEmail')}
              style={textFieldStyle}
              errorText={this.state.resetEmailError}
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
              errorText={this.state.displayNameError}
            />
          )}
          
          <TextField
            hintText="Email"
            type="email"
            value={email}
            onChange={this.handleInputChange('email')}
            style={textFieldStyle}
            errorText={this.state.emailError}
          />
          
          <TextField
            hintText="Password"
            type="password"
            value={password}
            onChange={this.handleInputChange('password')}
            style={textFieldStyle}
            errorText={this.state.passwordError}
          />
          
          {isSignUp && (
            <TextField
              hintText="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={this.handleInputChange('confirmPassword')}
              style={textFieldStyle}
              errorText={this.state.confirmPasswordError}
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