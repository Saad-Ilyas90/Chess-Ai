import React, { Component } from "react";
import { fenToBoard } from "./Fen.js";
const Chess = require("./chess.js").Chess;
let sf = null;

function showThinkingBar(value) {
  const thinkingBar = document.getElementById("thinking-bar");
  if (thinkingBar) {
    thinkingBar.style.height = "2px";
    thinkingBar.style.opacity = value ? "1" : "0";
  }
}

class ChessBoard extends Component {
  constructor(props) {
    super(props);
    var chess = new Chess();
    this.state = { selectMode: false, userColor: "w", selectedPiece: null };
    if (this.state.userColor === "b") {
      // make AI do the first move
      var moves = chess.moves();
      var move = moves[Math.floor(Math.random() * moves.length)];
      chess.move(move);
      this.props.onMove(chess.fen());
    }
  }

  refreshBoard(board) {
    for (var row = 0; row < board.length; row++) {
      for (var col = 0; col < board[row].length; col++) {
        if (board[row][col] !== null)
          if (board[row][col].color === this.state.userColor) {
            var cellId =
              "cell-" + String.fromCharCode(97 + col) + -1 * (row - 8);
            const cellElement = document.getElementById(cellId);
            if (cellElement) {
              cellElement.classList.add("selectable");
            }
          }
      }
    }

    // Highlight king if in check
    this.highlightKingInCheck();
  }

  // New method to highlight king in check
  highlightKingInCheck() {
    // Check if we have a valid board prop
    if (!this.props.board) return;

    const chess = new Chess(this.props.board);
    if (chess.in_check()) {
      // Get the king's square for the current turn
      const color = chess.turn();
      const board = chess.board();

      // Find the king on the board
      for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
          const piece = board[row][col];
          if (piece && piece.type === "k" && piece.color === color) {
            // Convert position to algebraic notation
            const square = String.fromCharCode(97 + col) + (8 - row);
            const cellId = "cell-" + square;
            const kingCell = document.getElementById(cellId);
            if (kingCell) {
              kingCell.classList.add("king-in-check");
            }
            return;
          }
        }
      }
    }
  }

  componentDidMount() {
    // Use a small delay to ensure the DOM is fully rendered
    setTimeout(() => {
      var chess = new Chess(this.props.board);
      var cells = document.getElementsByClassName("cell");
      var board = chess.board();
      this.refreshBoard(board);
      this.forceUpdate();
    }, 100);

    // Mark game as active in the global state
    if (window.chessAIApp && window.chessAIApp.setGameActive) {
      window.chessAIApp.setGameActive(true, "singleplayer");
    }
  }

  componentDidUpdate(prevProps) {
    // If board prop changed, refresh the board
    if (prevProps.board !== this.props.board) {
      console.log("Board updated, refreshing...");
      var chess = new Chess(this.props.board);
      var board = chess.board();

      // Clear all cell classes first
      var cells = document.getElementsByClassName("cell");
      for (var i = 0; i < cells.length; i++) {
        cells[i].classList.remove("king-in-check");
        cells[i].classList = ["cell"];
      }

      // Refresh the board with new positions
      this.refreshBoard(board);
    }
  }

  nextState(cellCode) {
    var chess = new Chess(this.props.board);
    if (sf === null) {
      sf = window.stockfish;
      sf.onmessage = (event) => {
        let message = event.data ? event.data : event;
        console.log(message);
        if (message.startsWith("bestmove")) {
          showThinkingBar(false);
          chess = new Chess(this.props.board);
          var move = message.split(" ")[1];
          var moveResult = chess.move(move, { sloppy: true });
          if (!moveResult) {
            // no valid move returned (game over or invalid move), skip further processing
            return;
          }

          if (moveResult.flags.indexOf("c") != -1) {
            const fromCell = document.getElementById(
              `cell-${move.substr(0, 2)}`
            );
            const toCell = document.getElementById(`cell-${move.substr(2, 4)}`);
            if (fromCell) fromCell.classList.add("ai-bloody-footprint-in-sand");
            if (toCell) toCell.classList.add("ai-bloody-footprint-in-sand");
          } else {
            const fromCell = document.getElementById(
              `cell-${move.substr(0, 2)}`
            );
            const toCell = document.getElementById(`cell-${move.substr(2, 4)}`);
            if (fromCell) fromCell.classList.add("ai-footprint-in-sand");
            if (toCell) toCell.classList.add("ai-footprint-in-sand");
          }

          // Check if game is over after AI move
          const gameOver = this.checkGameOver(chess);
          this.props.onMove(chess.fen(), gameOver);

          if (!gameOver && !(chess.turn() === this.state.userColor)) {
            sf.postMessage("position fen " + chess.fen());
            sf.postMessage(`go depth ${this.props.intelligenceLevel}`);
          }
        }
      };
    }

    if (this.state.selectMode) {
      this.state.to = cellCode;
      var legatTos = chess
        .moves({ square: this.state.from, verbose: true })
        .map((move) => {
          return move.to;
        });
      var pieceToBeMoved = chess.get(this.state.from);
      if (legatTos.includes(cellCode)) {
        // Check and perform a pawn promotion
        if (
          (cellCode[1] === "8" &&
            this.state.userColor === "w" &&
            pieceToBeMoved.type === "p" &&
            pieceToBeMoved.color === this.state.userColor) ||
          (cellCode[1] === "1" &&
            this.state.userColor === "b" &&
            pieceToBeMoved.type === "p" &&
            pieceToBeMoved.color === this.state.userColor)
        )
          chess.move({ from: this.state.from, to: cellCode, promotion: "q" });
        else chess.move({ from: this.state.from, to: cellCode }); // if not a promotion, be normal

        // Check if game is over after player move
        const gameOver = this.checkGameOver(chess);

        if (!gameOver) {
          showThinkingBar(true);
          sf.postMessage(`position fen ${chess.fen()}`);
          sf.postMessage(`go depth ${this.props.intelligenceLevel}`);
        }

        this.props.onMove(chess.fen(), gameOver);
      }
      this.state.to = "";
      this.state.from = "";
      this.setState({ selectMode: false });
      var cells = document.getElementsByClassName("cell");
      for (var i = 0; i < cells.length; i++) {
        cells[i].classList.remove("king-in-check");
        cells[i].classList = ["cell"];
      }
    } else {
      var selectableCells = Array.from(
        document.getElementsByClassName("selectable")
      ).map((cellNode) => {
        return cellNode.id.split("-")[1];
      });
      if (selectableCells.includes(cellCode)) {
        this.setState({ from: cellCode });
        this.setState({ selectMode: true });
        var selectedCell = document.getElementById("cell-" + cellCode);
        if (selectedCell) {
          selectedCell.classList.add("selected");
        }
        var legatTos = chess
          .moves({ square: cellCode, verbose: true })
          .map((move) => {
            return move.to;
          });
        for (var i = 0; i < legatTos.length; i++) {
          const legalCell = document.getElementById("cell-" + legatTos[i]);
          if (legalCell) {
            legalCell.classList.add("legalnext");
          }
        }
      }
    }
    this.refreshBoard(chess.board());
  }

  checkGameOver(chess) {
    if (chess.game_over()) {
      let result = "";
      if (chess.in_checkmate()) {
        const winner = chess.turn() === "w" ? "Black" : "White";
        result = `Checkmate! ${winner} wins.`;
      } else if (chess.in_draw()) {
        if (chess.in_stalemate()) {
          result = "Game drawn by stalemate.";
        } else if (chess.in_threefold_repetition()) {
          result = "Game drawn by threefold repetition.";
        } else if (chess.insufficient_material()) {
          result = "Game drawn due to insufficient material.";
        } else {
          result = "Game drawn by the 50-move rule.";
        }
      }

      alert(result);
      return true;
    }
    return false;
  }

  render() {
    // Convert the board string to an array of individual cells
    const renderableBoard = fenToBoard(this.props.board).split("");
    const cells = renderableBoard.map((piece, i) => {
      const file = i % 8;
      const rank = 8 - Math.floor(i / 8);
      const cellCode = String.fromCharCode(97 + file) + rank;
      return (
        <Cell
          key={cellCode}
          cellCode={cellCode}
          onClick={(code) => this.nextState(code)}
          piece={piece}
        />
      );
    });
    return <div className="chess-board">{cells}</div>;
  }
}

class Cell extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  onCellClick() {
    alert("hello");
  }
  render() {
    // Determine square color based on file (a-h) and rank (1-8)
    const fileIndex = this.props.cellCode.charCodeAt(0) - "a".charCodeAt(0);
    const rankIndex = parseInt(this.props.cellCode[1], 10) - 1;
    const isLightSquare = (fileIndex + rankIndex) % 2 === 0;
    const cellColor = isLightSquare ? "#cba974" : "#845c38";
    // Map FEN char to filled glyph
    const fenChar = this.props.piece;
    const glyphMap = {
      p: "\u265F",
      r: "\u265C",
      n: "\u265E",
      b: "\u265D",
      q: "\u265B",
      k: "\u265A",
    };
    const glyph =
      fenChar && fenChar !== "." ? glyphMap[fenChar.toLowerCase()] : "";
    // Determine piece color by FEN case (uppercase = white)
    const isWhitePiece = fenChar && fenChar === fenChar.toUpperCase();
    const pieceColor = isWhitePiece ? "#f2d1b7" : "#000000";
    return (
      <span
        id={"cell-" + this.props.cellCode}
        onClick={() => this.props.onClick(this.props.cellCode)}
        className="cell"
        style={{
          backgroundColor: cellColor,
          color: glyph ? pieceColor : "inherit",
          display: "inline-flex",
          width: "1em",
          height: "1em",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {glyph}
      </span>
    );
  }
}

export default ChessBoard;
