# Chess AI with Firebase Authentication & Friends System

A React-based chess application with AI capabilities, Firebase authentication, and a comprehensive social features including friends system and multiplayer functionality.

## 🚀 Features

### Authentication System
- **Google Sign-In**: One-click authentication with Google accounts
- **Email/Password Authentication**: Traditional email and password registration/login
- **Forgot Password**: Password recovery via email
- **Guest Mode**: Play without creating an account
- **Session Persistence**: Stay logged in across browser sessions

### Friends System
- **Send/Accept/Reject Friend Requests**: Full friend request management similar to chess.com
- **Online/Offline Status**: Real-time visibility of friends' online status
- **User Search**: Find other users by username
- **Friend Profiles**: View friends' stats, ratings, and game history
- **Challenge Friends**: Direct game invitations to friends
- **Real-time Notifications**: Instant notifications for friend requests and game challenges

### Chess Game Features
- **AI Opponent**: Play against Stockfish AI with adjustable difficulty (1-20 depth)
- **Multiplayer Games**: Real-time multiplayer chess with friends or random opponents
- **Time Controls**: Support for various time formats (5, 10, 15, 30 minutes or unlimited)
- **Game Analysis**: Post-game analysis with move evaluation
- **Chat System**: In-game chat for multiplayer games
- **Move History**: Review and analyze previous moves
- **Game State Persistence**: Games saved automatically to Firebase

### User Profile System
- **Customizable Profiles**: Edit display name and view statistics
- **Rating System**: ELO-based rating system for competitive play
- **Game Statistics**: Track games played, wins, and win rate
- **Achievement Tracking**: View personal chess achievements

## 🛠️ Technical Stack

- **Frontend**: React 15.6.1 with Material-UI 0.19.1
- **Authentication**: Firebase Authentication (v8 SDK)
- **Database**: Firebase Firestore for user profiles and friend data
- **Real-time Data**: Firebase Realtime Database for game states
- **Chess Engine**: Stockfish integration for AI gameplay
- **Styling**: CSS3 with custom chess piece fonts

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/chess-ai.git
cd chess-ai
```

2. Install dependencies:
```bash
npm install
```

3. Firebase Configuration:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication with Google and Email/Password providers
   - Create a Firestore database
   - Update the Firebase configuration in `src/firebase.js` with your project credentials

4. Start the development server:
```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🎮 How to Use

### Getting Started
1. **Sign Up/Sign In**: Create an account or sign in with Google
2. **Play as Guest**: Skip registration and play immediately against AI
3. **Choose Game Mode**: Select between AI opponent or multiplayer

### Playing Against AI
1. Click "New Game" and select "AI Opponent"
2. Adjust AI difficulty in settings (1-20 depth)
3. Make moves by clicking and dragging pieces
4. Use analysis tools to review your game

### Playing with Friends
1. Sign in to access social features
2. Add friends by searching usernames
3. Send game challenges with preferred time controls
4. Accept challenges from the notifications panel

### Managing Friends
1. Click the friends icon (👥) in the header
2. Search for users and send friend requests
3. Accept/reject incoming requests from notifications
4. View friends' profiles and challenge them to games

### Multiplayer Games
1. Create a game and share the Game ID
2. Or join an existing game with a Game ID
3. Chat with your opponent during the game
4. Review the game with built-in analysis tools

## 🔧 Firebase Setup

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Allow reading other users for friend search
    }
    
    // Notifications - users can read their own notifications
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
        (resource.data.toUserId == request.auth.uid || resource.data.fromUserId == request.auth.uid);
    }
    
    // Game challenges
    match /challenges/{challengeId} {
      allow read, write: if request.auth != null && 
        (resource.data.toUserId == request.auth.uid || resource.data.fromUserId == request.auth.uid);
    }
    
    // Game history
    match /gameHistory/{gameId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Authentication Providers
Enable the following in Firebase Authentication:
- Google Sign-In
- Email/Password
- Configure authorized domains for production deployment

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to GitHub Pages
```bash
npm run deploy
```

### Environment Variables
For production deployment, ensure Firebase configuration is properly set and security rules are configured.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues

- Material-UI v0.19.1 is quite old - consider upgrading for production use
- Some chess piece fonts may not load properly on certain browsers
- Firebase v8 SDK is used for consistency with axios-style syntax

## 🙏 Acknowledgments

- Stockfish chess engine for AI gameplay
- Firebase for backend services
- Material-UI for component library
- Chess.js for game logic validation
