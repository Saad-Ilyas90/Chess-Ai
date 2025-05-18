import React, { Component } from 'react';
import './Chat.css';
import { sendChatMessage, listenToChat } from './firebase';
import TextField from 'material-ui/TextField';
import FlatButton from 'material-ui/FlatButton';

class Chat extends Component {
  constructor(props) {
    super(props);
    this.state = {
      messages: [],
      newMessage: '',
      error: null
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
  }

  componentDidUpdate(prevProps) {
    // Set up new listener if game ID changes
    if (prevProps.gameId !== this.props.gameId && this.props.gameId) {
      this.setupChatListener();
    }
    
    // Scroll to bottom when new messages arrive
    this.scrollToBottom();
  }

  componentWillUnmount() {
    // Clean up listener
    if (this.chatListener) {
      this.chatListener();
    }
  }

  setupChatListener = () => {
    // Stop existing listener
    if (this.chatListener) {
      this.chatListener();
    }

    // Set up new listener
    this.chatListener = listenToChat(this.props.gameId, (messages) => {
      if (messages) {
        this.setState({ messages });
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
    } catch (error) {
      console.error("Error sending message:", error);
      this.setState({ error: "Failed to send message. Please try again." });
    }
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  render() {
    const { messages, newMessage, error } = this.state;

    return (
      <div className="chat-container">
        <div className="chat-header">
          <h3>Chat</h3>
        </div>
        
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="no-messages">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={index} 
                className={`message ${msg.color === this.props.playerColor ? 'own-message' : 'other-message'}`}
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
            value={newMessage}
            onChange={this.handleMessageChange}
            style={{ marginBottom: 10 }}
          />
          <FlatButton 
            label="Send" 
            primary={true} 
            type="submit"
            disabled={!newMessage.trim()}
            style={{ width: '100%' }}
          />
        </form>
      </div>
    );
  }
}

export default Chat; 