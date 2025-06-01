let fenToBoard = (fen) => {
    // Safety check for undefined or null fen
    if (!fen) {
        console.warn("Received undefined or null FEN string");
        return "";
    }
    
    let tempRow = '';
    // Expand FEN numbers to '.' for empty squares and preserve case for pieces
    let fenBoard = fen.split(' ')[0].split("/").join("");
    for (let cell = 0; cell < fenBoard.length; cell++) {
        if (!parseInt(fenBoard[cell]))
            tempRow += fenBoard[cell];
        else {
            for (let i = 0; i < parseInt(fenBoard[cell]); i++) {
                tempRow += ".";
            }
        }
    }
    // Return the 64-character board string (letters for pieces, '.' for empty)
    return tempRow;
}

export {fenToBoard}