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
    
    // Skip the email verification step entirely
    // Firebase will automatically handle sending reset emails only to valid accounts
    // But we'll show a generic message that doesn't reveal account existence
    try {
      await auth.sendPasswordResetEmail(resetEmail);
      this.showError('If an account exists with this email, a password reset link has been sent.');
      this.setState({ showForgotPassword: false, resetEmail: '', loading: false });
    } catch (error) {
      console.error('Password reset error:', error);
      
      // For security reasons, we'll show a generic message for most errors
      // This prevents account enumeration attacks
      let errorMessage;
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email format. Please check and try again.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Please try again later.';
          break;
        case 'auth/user-not-found':
          // For security, use the same message as success
          errorMessage = 'If an account exists with this email, a password reset link has been sent.';
          break;
        default:
          // Generic error without revealing if an account exists
          errorMessage = 'Unable to process your request. Please try again later.';
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

    if (showForgotPassword) {
      return (
        <div className="auth-container">
          <Paper className="login-paper">
            <div className="login-logo">
              <span className="login-logo-icon">♟</span>
              CHESS
            </div>
            <p className="login-subtitle">Enter your email to receive a password reset link</p>
            
            <TextField
              hintText="Email"
              value={resetEmail}
              onChange={this.handleInputChange('resetEmail')}
              className="login-text-field"
              fullWidth={true}
              errorText={this.state.resetEmailError}
              errorStyle={{color: '#ffccbc'}}
              underlineFocusStyle={{borderColor: '#e0c9a6'}}
            />
            
            <RaisedButton
              label="Send Reset Email"
              onClick={this.handleForgotPassword}
              className="login-button"
              disabled={loading}
            />
            
            <div style={{ marginTop: '20px' }}>
              <span className="login-link" onClick={this.toggleForgotPassword}>
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
      <div className="auth-container">
        <Paper className="login-paper">
          <div className="login-logo">
            <span className="login-logo-icon">♛</span>
            CHE
            <span className="login-logo-knights">
              <span className="login-logo-knight-left">♘</span>
              <span className="login-logo-knight-right">♘</span>
            </span>
          </div>
          <p className="login-subtitle">
            {isSignUp ? 'Create an account to play with friends' : 'Sign in to play with friends'}
          </p>
          
          {/* Email/Password Form */}
          {isSignUp && (
            <TextField
              hintText="Display Name"
              value={displayName}
              onChange={this.handleInputChange('displayName')}
              className="login-text-field"
              fullWidth={true}
              errorText={this.state.displayNameError}
              errorStyle={{color: '#ffccbc'}}
              underlineFocusStyle={{borderColor: '#e0c9a6'}}
            />
          )}
          
          <TextField
            hintText="Email"
            type="email"
            value={email}
            onChange={this.handleInputChange('email')}
            className="login-text-field"
            fullWidth={true}
            errorText={this.state.emailError}
            errorStyle={{color: '#ffccbc'}}
            underlineFocusStyle={{borderColor: '#e0c9a6'}}
          />
          
          <TextField
            hintText="Password"
            type="password"
            value={password}
            onChange={this.handleInputChange('password')}
            className="login-text-field"
            fullWidth={true}
            errorText={this.state.passwordError}
            errorStyle={{color: '#ffccbc'}}
            underlineFocusStyle={{borderColor: '#e0c9a6'}}
          />
          
          {isSignUp && (
            <TextField
              hintText="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={this.handleInputChange('confirmPassword')}
              className="login-text-field"
              fullWidth={true}
              errorText={this.state.confirmPasswordError}
              errorStyle={{color: '#ffccbc'}}
              underlineFocusStyle={{borderColor: '#e0c9a6'}}
            />
          )}
          
          <RaisedButton
            label={isSignUp ? 'Sign Up' : 'Sign In'}
            onClick={this.handleEmailPasswordAuth}
            className="login-button"
            disabled={loading}
          />
          
          {!isSignUp && (
            <div style={{ marginBottom: '20px' }}>
              <span className="login-link" onClick={this.toggleForgotPassword}>
                Forgot Password?
              </span>
            </div>
          )}
          
          <Divider style={{ margin: '20px 0', backgroundColor: 'rgba(224, 201, 166, 0.3)' }} />
          
          {/* Google Sign In */}
          <RaisedButton
            label={<span>
              <img 
                src="https://developers.google.com/identity/images/g-logo.png" 
                alt="Google" 
                className="login-google-icon" 
              />
              Continue with Google
            </span>}
            onClick={this.handleGoogleSignIn}
            className="login-google-button"
            disabled={loading}
          />
          
          {/* Continue as Guest */}
          <RaisedButton
            label={<span>
              <span className="login-guest-icon">👥</span>
              Continue as Guest
            </span>}
            onClick={this.props.onPlayAsGuest}
            className="login-guest-button"
            disabled={loading}
          />
          
          {/* Toggle between sign in/up */}
          <div style={{ marginTop: '20px' }}>
            <span style={{ color: '#e0c9a6', fontSize: '14px' }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </span>
            <span className="login-link" onClick={this.toggleAuthMode}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </span>
          </div>
        </Paper>
        
        <Snackbar
          open={showError}
          message={error}
          autoHideDuration={4000}
          bodyStyle={{ backgroundColor: '#5d4037', color: '#e0c9a6' }}
          onRequestClose={() => this.setState({ showError: false })}
        />
      </div>
    );
  }
}

export default SignInPage; 