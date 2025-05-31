import React, { Component } from 'react';

import { BottomNavigation, BottomNavigationItem } from 'material-ui/BottomNavigation';
import Paper from 'material-ui/Paper';
import AVPlayArrow from 'material-ui/svg-icons/av/play-arrow';
import AVFastRewind from 'material-ui/svg-icons/av/fast-rewind';
import AVFastForward from 'material-ui/svg-icons/av/fast-forward';
import ActionAssessment from 'material-ui/svg-icons/action/assessment';

const aVPlayArrow = <AVPlayArrow color="#e0c9a6" />;
const aVFastForward = <AVFastForward color="#e0c9a6" />;
const aVFastRewind = <AVFastRewind color="#e0c9a6" />;
const actionAssessment = <ActionAssessment />;

class Footer extends Component {

    state = {
        selectedIndex: 0,
    };

    select = (index) => this.setState({ selectedIndex: index });

    render() {
        const { gameMode = 'ai', gameOver = false, showAnalysis } = this.props;
        const isAIMode = gameMode === 'ai';
        const isMultiplayerGameOver = gameMode === 'multiplayer' && gameOver;

        return (
            <div>
                <p className="graveyard"><div id="graves">{this.props.fallenOnes}</div> </p>
                <div className="footer">
                    <Paper zDepth={10} style={{ backgroundColor: '#2a2a2a', boxShadow: '0 5px 15px rgba(0, 0, 0, 0.25)' }}>
                        <BottomNavigation
                            zDepth={0}
                            style={{
                                backgroundColor: 'transparent',
                                borderTop: 'none',
                                borderBottom: 'none'
                            }}
                        >
                            <BottomNavigationItem
                                label=" "
                                icon={aVFastRewind}
                                style={{ color: '#e0c9a6' }}
                                onClick={() => { this.props.gotoPreviousState() }}
                                disabled={!gameOver}
                            />
                            {isAIMode ? (
                                <BottomNavigationItem
                                    label=" "
                                    icon={aVPlayArrow}
                                    style={{ color: '#e0c9a6' }}
                                    onClick={() => { this.props.playForHuman() }}
                                />
                            ) : isMultiplayerGameOver ? (
                                <BottomNavigationItem
                                    label="Analysis"
                                    icon={actionAssessment}
                                    style={{ color: '#e0c9a6' }}
                                    onClick={() => { showAnalysis && showAnalysis() }}
                                />
                            ) : (
                                <BottomNavigationItem
                                    label=" "
                                    icon={aVPlayArrow}
                                    style={{ color: '#e0c9a6' }}
                                    disabled={true}
                                />
                            )}
                            <BottomNavigationItem
                                label=" "
                                icon={aVFastForward}
                                style={{ color: '#e0c9a6' }}
                                onClick={() => { this.props.gotoNextState() }}
                                disabled={!gameOver}
                            />
                        </BottomNavigation>
                    </Paper>
                </div>
            </div>
        )
    }
}

export default Footer;