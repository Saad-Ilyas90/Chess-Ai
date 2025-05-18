import React, { Component } from 'react';
import ContentUndo from 'material-ui/svg-icons/content/undo';
import FloatingActionButton from 'material-ui/FloatingActionButton';
import { BottomNavigation, BottomNavigationItem } from 'material-ui/BottomNavigation';
import Paper from 'material-ui/Paper';
import AVPlayArrow from 'material-ui/svg-icons/av/play-arrow';
import AVFastRewind from 'material-ui/svg-icons/av/fast-rewind';
import AVFastForward from 'material-ui/svg-icons/av/fast-forward';
import ActionAssessment from 'material-ui/svg-icons/action/assessment';
import FlatButton from 'material-ui/FlatButton';

const aVPlayArrow = <AVPlayArrow />;
const aVFastForward = <AVFastForward />;
const aVFastRewind = <AVFastRewind />;
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
                    <Paper zDepth={10}>
                        <BottomNavigation zDepth={0}>
                            <BottomNavigationItem
                                label=" "
                                icon={aVFastRewind}
                                style={{ color: '#333' }}
                                onClick={() => { this.props.gotoPreviousState() }}
                                disabled={!gameOver}
                            />
                            {isAIMode ? (
                                <BottomNavigationItem
                                    label=" "
                                    icon={aVPlayArrow}
                                    style={{ color: '#333' }}
                                    onClick={() => { this.props.playForHuman() }}
                                />
                            ) : isMultiplayerGameOver ? (
                                <BottomNavigationItem
                                    label="Analysis"
                                    icon={actionAssessment}
                                    style={{ color: '#333' }}
                                    onClick={() => { showAnalysis && showAnalysis() }}
                                />
                            ) : (
                                <BottomNavigationItem
                                    label=" "
                                    icon={aVPlayArrow}
                                    style={{ color: '#333' }}
                                    disabled={true}
                                />
                            )}
                            <BottomNavigationItem
                                label=" "
                                icon={aVFastForward}
                                style={{ color: '#333' }}
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