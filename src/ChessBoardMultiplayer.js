import React, { Component } from 'react';
import {fenToBoard} from './Fen.js';
const Chess = require('./chess.js').Chess;

class ChessBoardMultiplayer extends Component {
    constructor(props) {
        super(props);
        this.state = { 
            selectMode: false,
            from: '',
            to: ''
        };
    }
    refreshBoard() {
        // Clear all cell classes first
        const cells = document.getElementsByClassName("cell");
        for (let i = 0; i < cells.length; i++) {
            cells[i].classList = ['cell'];
        }
        
        const chess = new Chess(this.props.board);
        const currentTurn = chess.turn();
        
        console.log("Current turn:", currentTurn);
        console.log("User color:", this.props.userColor);
        
        // Only make pieces selectable if it's the player's turn
        if (currentTurn === this.props.userColor) {
            // Get all pieces of the current player's color
            for (let rank = 1; rank <= 8; rank++) {
                for (let file = 'a'.charCodeAt(0); file <= 'h'.charCodeAt(0); file++) {
                    const square = String.fromCharCode(file) + rank;
                    const piece = chess.get(square);
                    
                    if (piece && piece.color === this.props.userColor) {
                        // Check if this piece has legal moves
                        const moves = chess.moves({ square: square, verbose: true });
                        if (moves.length > 0) {
                            const cellElement = document.getElementById("cell-" + square);
                            if (cellElement) {
                                cellElement.classList.add("selectable");
                                console.log("Made selectable:", square);
                            }
                        }
                    }
                }
            }
        }
    }

    componentDidMount() {
        setTimeout(() => {
            this.refreshBoard();
        }, 100);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.board !== this.props.board || prevProps.userColor !== this.props.userColor) {
            console.log("Board updated in multiplayer mode");
            
            // Reset selection state when board updates
            this.setState({ 
                selectMode: false,
                from: '',
                to: ''
            });
            
            // Clear visual highlights
            const cells = document.getElementsByClassName("cell");
            for (let i = 0; i < cells.length; i++) {
                cells[i].classList.remove("selected", "legalnext");
            }
            
            this.refreshBoard();
        }
    }

    nextState(cellCode) {
        console.log("Clicked:", cellCode);
        const chess = new Chess(this.props.board);
        
        // Verify it's this player's turn
        if (chess.turn() !== this.props.userColor) {
            console.log("Not your turn!");
            return;
        }
        
        // Get the cell containing this piece
        const cell = document.getElementById(`cell-${cellCode}`);
        if (!cell) {
            console.log("Cell not found");
            return;
        }
        
        if (this.state.selectMode) {
            // We're selecting a destination square
            const legalMoves = chess.moves({ 
                square: this.state.from, 
                verbose: true 
            }).map(move => move.to);
            
            console.log("Legal moves:", legalMoves);
            
            if (legalMoves.includes(cellCode)) {
                // Valid move
                const pieceToBeMoved = chess.get(this.state.from);
                
                // Check for pawn promotion
                if ((cellCode[1] === '8' && this.props.userColor === 'w' && 
                     pieceToBeMoved.type === 'p') || 
                    (cellCode[1] === '1' && this.props.userColor === 'b' && 
                     pieceToBeMoved.type === 'p')) {
                    chess.move({ 
                        from: this.state.from, 
                        to: cellCode, 
                        promotion: 'q'  // Always promote to queen for simplicity
                    });
                } else {
                    chess.move({ 
                        from: this.state.from, 
                        to: cellCode 
                    });
                }
                
                // Check for game over
                const gameOver = this.checkGameOver(chess);
                
                // Update the game state
                this.props.onMove(chess.fen(), gameOver);
            }
            
            // Reset selection state
            this.setState({ 
                selectMode: false,
                from: '',
                to: ''
            });
            
            // Clear visual highlights
            const cells = document.getElementsByClassName("cell");
            for (let i = 0; i < cells.length; i++) {
                cells[i].classList.remove("selected", "legalnext");
            }
        } else {
            // We're selecting a piece to move
            const selectableCells = Array.from(
                document.getElementsByClassName("selectable")
            ).map(cell => cell.id.split("-")[1]);
            
            if (selectableCells.includes(cellCode)) {
                // Verify this is player's own piece
                const piece = chess.get(cellCode);
                if (!piece || piece.color !== this.props.userColor) {
                    console.log("You can only move your own pieces!");
                    return;
                }
                
                // Valid piece selection
                this.setState({ 
                    selectMode: true,
                    from: cellCode
                });
                
                // Highlight the selected piece
                const selectedCell = document.getElementById("cell-" + cellCode);
                if (selectedCell) {
                    selectedCell.classList.add("selected");
                }
                
                // Highlight legal moves
                const legalMoves = chess.moves({ 
                    square: cellCode, 
                    verbose: true 
                }).map(move => move.to);
                
                legalMoves.forEach(move => {
                    const legalCell = document.getElementById("cell-" + move);
                    if (legalCell) {
                        legalCell.classList.add("legalnext");
                    }
                });
            }
        }
    }

    checkGameOver(chess) {
        if (chess.game_over()) {
            let result = '';
            if (chess.in_checkmate()) {
                const loser = chess.turn(); // The player who's turn it is has lost
                const winner = loser === 'w' ? 'b' : 'w';
                
                // Determine if the current user won or lost
                if (winner === this.props.userColor) {
                    result = `Checkmate! You win!`;
                } else {
                    result = `Checkmate! You lost!`;
                }
                
                // Make sure we show the alert to both players
                setTimeout(() => {
                    alert(result);
                }, 100);
            } else if (chess.in_draw()) {
                if (chess.in_stalemate()) {
                    result = 'Game drawn by stalemate.';
                } else if (chess.in_threefold_repetition()) {
                    result = 'Game drawn by threefold repetition.';
                } else if (chess.insufficient_material()) {
                    result = 'Game drawn due to insufficient material.';
                } else {
                    result = 'Game drawn by the 50-move rule.';
                }
                alert(result);
            }
            
            return true;
        }
        return false;
    }

    renderBoard() {
        // Determine if board should be flipped based on player color
        const rows = [];
        const boardArray = fenToBoard(this.props.board);
        
        // Create rows
        for (let rank = 0; rank < 8; rank++) {
            // Add separator between rows
            if (rank > 0) {
                rows.push(<p key={`sep-${rank}`} className="seperator" />);
            }
            
            // Create cells for each rank
            const rankCells = [];
            const displayRank = 8 - rank;  // Always display from white's perspective in the data model
            
            for (let file = 0; file < 8; file++) {
                // Determine cell position in algebraic notation
                const displayFile = file;
                const cellCode = String.fromCharCode(97 + displayFile) + displayRank;
                
                // Get piece from the board array
                const index = rank * 8 + file;
                const piece = boardArray[index];
                
                rankCells.push(
                    <Cell
                        key={`cell-${cellCode}`}
                        cellCode={cellCode}
                        onClick={() => this.nextState(cellCode)}
                        piece={piece}
                    />
                );
            }
            
            rows.push(...rankCells);
        }
        
        return rows;
    }

    render() {
        return (
            <div className={`chess-board ${this.props.userColor === 'b' ? 'flipped' : ''}`}>
                {this.renderBoard()}
            </div>
        );
    }
}

class Cell extends Component {
    handleClick = (e) => {
        e.stopPropagation();
        this.props.onClick();
    }
    
    render() {
        return (
            <span 
                id={`cell-${this.props.cellCode}`} 
                onClick={this.handleClick} 
                className="cell"
                style={{ 
                    pointerEvents: 'auto',
                    zIndex: 10
                }}
            >
                {this.props.piece}
            </span>
        );
    }
}

export default ChessBoardMultiplayer; 