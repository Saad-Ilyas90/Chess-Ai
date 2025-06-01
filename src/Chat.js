import React, { Component } from 'react';
import './Chat.css';
import { sendChatMessage, listenToChat } from './firebase';
import TextField from 'material-ui/TextField';
import FlatButton from 'material-ui/FlatButton';
import ChatIcon from 'material-ui/svg-icons/communication/chat';
import CloseIcon from 'material-ui/svg-icons/navigation/close';

class Chat extends Component {
  constructor(props) {
    super(props);
    this.state = {
      messages: [],
      newMessage: '',
      error: null,
      isChatVisible: false,
      unreadCount: 0
    };
    this.chatEndRef = null;
    this.setChatEndRef = (element) => {
      this.chatEndRef = element;
    };
  }

  componentDidMount() {
    // Set up chat listener if we have a game ID
    if (this.props.gameId) {
      this.setupChatListener();
    }
    
    // Set default chat visibility based on screen size
    const isSmallScreen = window.innerWidth <= 768;
    if (!isSmallScreen) {
      // On larger screens, chat should be visible by default
      this.setState({ isChatVisible: true });
    }
    
    // Add window resize listener
    window.addEventListener('resize', this.handleResize);
  }

  componentDidUpdate(prevProps, prevState) {
    // Set up new listener if game ID changes
    if (prevProps.gameId !== this.props.gameId && this.props.gameId) {
      this.setupChatListener();
    }
    
    // Scroll to bottom when new messages arrive or when chat becomes visible
    if (prevState.messages.length !== this.state.messages.length || 
        (!prevState.isChatVisible && this.state.isChatVisible)) {
      this.scrollToBottom();
    }
    
    // Update unread count when new messages arrive and chat is not visible
    if (prevState.messages.length !== this.state.messages.length && !this.state.isChatVisible) {
      this.setState(prevState => ({
        unreadCount: prevState.unreadCount + (this.state.messages.length - prevState.messages.length)
      }));
    }
  }

  componentWillUnmount() {
    // Clean up listeners
    if (this.chatListener) {
      this.chatListener();
    }
    window.removeEventListener('resize', this.handleResize);
  }

  setupChatListener = () => {
    // Stop existing listener
    if (this.chatListener) {
      this.chatListener();
    }

    // Set up new listener
    this.chatListener = listenToChat(this.props.gameId, (messages) => {
      if (messages) {
        const currentMsgCount = this.state.messages.length;
        this.setState({ messages });
        
        // If chat is not visible and there are new messages, increment unread count
        if (!this.state.isChatVisible && messages.length > currentMsgCount) {
          this.setState(prevState => ({
            unreadCount: prevState.unreadCount + (messages.length - currentMsgCount)
          }));
        }
      }
    });
  }

  scrollToBottom = () => {
    if (this.chatEndRef) {
      this.chatEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  }

  handleMessageChange = (e) => {
    this.setState({ newMessage: e.target.value });
  }

  handleSendMessage = async (e) => {
    e.preventDefault();
    
    const { newMessage } = this.state;
    const { gameId, playerName, playerColor } = this.props;
    
    if (!newMessage.trim()) return;
    
    try {
      await sendChatMessage(gameId, {
        text: newMessage,
        sender: playerName || `Player (${playerColor === 'w' ? 'White' : 'Black'})`,
        color: playerColor,
        timestamp: Date.now()
      });
      
      this.setState({ newMessage: '', error: null });
      this.scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
      this.setState({ error: "Failed to send message. Please try again." });
    }
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  toggleChat = () => {
    this.setState(prevState => ({
      isChatVisible: !prevState.isChatVisible,
      unreadCount: 0 // Reset unread count when opening chat
    }));
    console.log('Chat visibility toggled:', !this.state.isChatVisible);
  }
  
  handleResize = () => {
    const isSmallScreen = window.innerWidth <= 768;
    
    // On larger screens, chat should always be visible
    if (!isSmallScreen && !this.state.isChatVisible) {
      this.setState({ isChatVisible: true });
    }
  }

  render() {
    const { messages, newMessage, error, isChatVisible, unreadCount } = this.state;
    // Check if we're on a small screen to determine behavior
    const isSmallScreen = window.innerWidth <= 768;
    
    // Only show toggle button on small screens
    const showChatButton = isSmallScreen;
    
    // On small screens, use the visible class to toggle display
    // On large screens, always show the chat container
    let chatContainerClass = 'chat-container';
    if (isSmallScreen) {
      chatContainerClass = `chat-container ${isChatVisible ? 'visible' : ''}`;
    }
    
    // Add a class to the body to adjust timer positions
    if (isSmallScreen && isChatVisible) {
      document.body.classList.add('chat-visible');
    } else {
      document.body.classList.remove('chat-visible');
    }

    return (
      <div className="chat-wrapper" style={{ position: 'relative' }}>
        {/* Chat container */}
        <div className={chatContainerClass}>
          <div className="chat-header">
            <h3>Chat</h3>
            {isSmallScreen && (
              <FlatButton 
                icon={<CloseIcon color="#e0c9a6" />}
                onClick={this.toggleChat}
                style={{ minWidth: '36px' }}
                backgroundColor="transparent"
              />)
            }
          </div>
          
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages" style={{ color: '#e0c9a6', fontStyle: 'italic' }}>
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`chat-message ${msg.color === this.props.playerColor ? 'own-message' : 'other-message'}`}
                >
                  <div className="message-sender">{msg.sender}</div>
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">{this.formatTimestamp(msg.timestamp)}</div>
                </div>
              ))
            )}
            <div ref={this.setChatEndRef} />
          </div>
          
          <form className="message-form" onSubmit={this.handleSendMessage}>
            {error && <div className="error-message">{error}</div>}
            <TextField
              hintText="Type a message..."
              fullWidth
              underlineShow={false}
              style={{ 
                marginBottom: 10,
                backgroundColor: '#3a3a3a',
                border: '1px solid #5d4037',
                borderRadius: '4px',
                padding: '0 10px',
                width: '100%',
                boxSizing: 'border-box'
              }}
              value={newMessage}
              onChange={this.handleMessageChange}
              inputStyle={{ color: '#e0c9a6' }}
              hintStyle={{ color: '#a09080' }}
              underlineStyle={{ display: 'none' }}
              underlineFocusStyle={{ display: 'none' }}
            />
            <FlatButton 
              label="Send" 
              type="submit"
              disabled={!newMessage.trim()}
              style={{ 
                width: '100%',
                backgroundColor: '#e0c9a6',
                color: '#2a2a2a',
                marginTop: '5px'
              }}
              labelStyle={{ color: '#2a2a2a', fontWeight: 'bold' }}
              hoverColor="#d0b996"
            />
          </form>
        </div>
        
        {/* Chat toggle button for mobile */}
        {showChatButton && (
          <button 
            className="chat-toggle-button"
            onClick={this.toggleChat}
            aria-label="Toggle chat"
          >
            <ChatIcon color="#2a2a2a" />
            {unreadCount > 0 && (
              <span className="chat-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
        )}
      </div>
    );
  }
}

export default Chat; 