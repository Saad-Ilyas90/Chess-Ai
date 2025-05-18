import React, { Component } from 'react';
import './Timer.css';

class Timer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      timeLeft: props.initialTime * 60, // Convert minutes to seconds
      isRunning: false,
      intervalId: null
    };
  }

  componentDidMount() {
    // Start the timer if it's this player's turn
    if (this.props.isActive && !this.state.isRunning) {
      this.startTimer();
    }
  }

  componentDidUpdate(prevProps) {
    // Handle timer start/stop when active state changes
    if (prevProps.isActive !== this.props.isActive) {
      if (this.props.isActive) {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }

    // Update time if the parent component provides new time
    if (prevProps.timeLeft !== this.props.timeLeft && this.props.timeLeft !== undefined) {
      this.setState({ timeLeft: this.props.timeLeft });
    }
  }

  componentWillUnmount() {
    this.stopTimer();
  }

  startTimer = () => {
    if (!this.state.isRunning && this.state.timeLeft > 0) {
      const intervalId = setInterval(() => {
        const newTime = this.state.timeLeft - 1;
        this.setState({ timeLeft: newTime });
        
        // Call onTimeUpdate to inform parent component
        if (this.props.onTimeUpdate) {
          this.props.onTimeUpdate(newTime);
        }
        
        // Handle time running out
        if (newTime <= 0) {
          this.stopTimer();
          // Show the timeout message
          if (this.props.playerName.includes('You')) {
            alert("Time's up! You lost the game.");
            // Show analysis popup
            window.dispatchEvent(new CustomEvent('show-analysis-confirmation'));
          }
          if (this.props.onTimeUp) {
            this.props.onTimeUp();
          }
        }
      }, 1000);
      
      this.setState({ isRunning: true, intervalId });
    }
  }

  stopTimer = () => {
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId);
      this.setState({ isRunning: false, intervalId: null });
    }
  }

  formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  render() {
    const { timeLeft } = this.state;
    const { isActive, playerName, className } = this.props;
    
    // Determine when we need to show critical time warning (under 30 seconds)
    const isLowTime = timeLeft <= 30;
    // Determine when we need to show very critical time warning (under 10 seconds)
    const isCriticalTime = timeLeft <= 10;
    
    return (
      <div className={`timer ${isActive ? 'active' : ''} ${isLowTime ? 'low-time' : ''} ${isCriticalTime ? 'critical-time' : ''} ${className || ''}`}>
        <div className="player-name">{playerName}</div>
        <div className="time-display">{this.formatTime(timeLeft)}</div>
      </div>
    );
  }
}

export default Timer; 