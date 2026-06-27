const boardElement = document.getElementById('chessboard');
let selectedSquare = null;
let turn = 'white';
let isAnimating = false;

const GAME_MODES = {
    bullet:   { label: 'Bullet',  seconds: 60,  increment: 0 },
    bullet1i: { label: '1+1',     seconds: 60,  increment: 1 },
    blitz3:   { label: 'Blitz 3', seconds: 180, increment: 0 },
    blitz3i:  { label: '3+2',     seconds: 180, increment: 2 },
    blitz5:   { label: 'Blitz 5', seconds: 300, increment: 0 },
    blitz5i:  { label: '5+2',     seconds: 300, increment: 2 },
    rapid:    { label: 'Rapid',   seconds: 600, increment: 0 },
    rapid10i: { label: '10+2',    seconds: 600, increment: 2 },
};

let timers = { white: 0, black: 0 };
let timerInterval = null;
let gameMode = null;
let gameActive = false;

const capturedPieces = { white: [], black: [] };
const pieceValue = { q: 9, r: 5, b: 3, n: 3, p: 1 };

const hasMoved = {
    K: false, k: false,
    WR_left: false, WR_right: false,
    BR_left: false, BR_right: false,
};

let enPassantTarget = null;

const pieceImages = {
    'r': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    'n': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    'b': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    'q': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    'k': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
    'p': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    'R': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    'N': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    'B': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    'Q': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    'K': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    'P': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg'
};

const initialBoardSetup = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R']
];

function buildGameWrapper() {
    const wrapper = document.createElement('div');
    wrapper.id = 'game-wrapper';

    const topPanel = document.createElement('div');
    topPanel.className = 'timer-panel top';
    topPanel.id = 'panel-black';
    topPanel.innerHTML = `
        <span class="player-label">P2 <span class="pawn-icon black-pawn">&#9823;</span></span>
        <span class="captured-strip" id="captured-by-black"></span>
        <span class="timer-display" id="timer-black">--:--</span>
        <span class="mode-badge" id="mode-label"></span>`;

    const botPanel = document.createElement('div');
    botPanel.className = 'timer-panel bottom';
    botPanel.id = 'panel-white';
    botPanel.innerHTML = `
        <span class="player-label">P1 <span class="pawn-icon white-pawn">&#9817;</span></span>
        <span class="captured-strip" id="captured-by-white"></span>
        <span class="timer-display" id="timer-white">--:--</span>
        <span class="mode-badge"></span>`;

    boardElement.parentNode.insertBefore(wrapper, boardElement);
    wrapper.appendChild(topPanel);
    wrapper.appendChild(boardElement);
    wrapper.appendChild(botPanel);
}

function addCapturedPiece(pieceCode) {
    const color = getPieceColor(pieceCode);
    const capturedBy = color === 'black' ? 'white' : 'black';
    capturedPieces[capturedBy].push(pieceCode.toLowerCase());
    renderCapturedPieces(capturedBy);
}

function renderCapturedPieces(capturedBy) {
    const strip = document.getElementById(capturedBy === 'white' ? 'captured-by-white' : 'captured-by-black');
    if (!strip) return;
    const sorted = [...capturedPieces[capturedBy]].sort((a, b) => pieceValue[b] - pieceValue[a]);
    strip.innerHTML = '';
    sorted.forEach(code => {
        const img = document.createElement('img');
        img.src = pieceImages[capturedBy === 'white' ? code : code.toUpperCase()];
        img.className = 'captured-piece-img';
        strip.appendChild(img);
    });
}

function resetCapturedPieces() {
    capturedPieces.white = [];
    capturedPieces.black = [];
    const s1 = document.getElementById('captured-by-white');
    const s2 = document.getElementById('captured-by-black');
    if (s1) s1.innerHTML = '';
    if (s2) s2.innerHTML = '';
}

function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimerDisplay(color) {
    const el = document.getElementById('timer-' + color);
    const secs = timers[color];
    el.textContent = formatTime(secs);
    el.classList.remove('low-time');
    if (secs <= 30) el.classList.add('low-time');
}

function setActivePanel(color) {
    document.getElementById('panel-white').classList.toggle('active', color === 'white');
    document.getElementById('panel-black').classList.toggle('active', color === 'black');
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!gameActive) return;
        timers[turn]--;
        updateTimerDisplay(turn);
        if (timers[turn] <= 0) {
            timers[turn] = 0;
            updateTimerDisplay(turn);
            clearInterval(timerInterval);
            gameActive = false;
            const winner = turn === 'white' ? 'black' : 'white';
            const winnerLabel = winner === 'white' ? 'P1' : 'P2';
            const winnerName = winner === 'white' ? 'White' : 'Black';
            const board = getBoardState();
            if (hasInsufficientMaterial(board, winner)) {
                playSound('gameover');
                setTimeout(() => showEndModal('Draw — insufficient material vs. time! \uD83E\uDD1D'), 100);
            } else {
                playSound('gameover');
                setTimeout(() => showEndModal(winnerLabel + ' (' + winnerName + ') wins on time! \u23F0'), 100);
            }
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function applyIncrement(color) {
    if (!gameMode) return;
    const inc = GAME_MODES[gameMode].increment || 0;
    if (inc > 0) {
        timers[color] += inc;
        updateTimerDisplay(color);
    }
}

function hasInsufficientMaterial(board, color) {
    const pieces = [];
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && getPieceColor(p) === color) pieces.push(p.toLowerCase());
        }
    if (pieces.length === 1) return true;
    if (pieces.length === 2 && (pieces.includes('n') || pieces.includes('b'))) return true;
    return false;
}

function showModeModal() {
    const overlay = document.createElement('div');
    overlay.id = 'mode-modal-overlay';

    const modal = document.createElement('div');
    modal.id = 'mode-modal';
    modal.innerHTML = '<div style="font-size:52px;line-height:1;margin-bottom:8px;color:#d4af37;text-shadow:0 0 20px rgba(212,175,55,0.5);">♛</div><h2>Checkz</h2><p>Pick a format and play</p><div class="modal-divider"></div>';

    addModeRow(modal, overlay, { icon: '⚡', label: 'Bullet', chips: [{ key: 'bullet', label: '1 min' }, { key: 'bullet1i', label: '1+1' }] });
    addModeRow(modal, overlay, { icon: '🔥', label: 'Blitz',  chips: [{ key: 'blitz3', label: '3 min' }, { key: 'blitz3i', label: '3+2' }, { key: 'blitz5', label: '5 min' }, { key: 'blitz5i', label: '5+2' }] });
    addModeRow(modal, overlay, { icon: '⏱️', label: 'Rapid',  chips: [{ key: 'rapid', label: '10 min' }, { key: 'rapid10i', label: '10+2' }] });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function addModeRow(modal, overlay, { icon, label, chips }) {
    const row = document.createElement('div');
    row.className = 'mode-btn mode-row';
    const chipsHTML = chips.map(c => '<button class="blitz-chip" data-key="' + c.key + '">' + c.label + '</button>').join('');
    row.innerHTML =
        '<span class="mode-icon">' + icon + '</span>' +
        '<span class="mode-info" style="flex:1"><strong>' + label + '</strong></span>' +
        '<span class="blitz-chips">' + chipsHTML + '</span>';
    row.querySelectorAll('.blitz-chip').forEach(chip => {
        chip.addEventListener('click', e => {
            e.stopPropagation();
            document.body.removeChild(overlay);
            startGame(chip.dataset.key);
        });
    });
    modal.appendChild(row);
}

function startGame(modeKey) {
    gameMode = modeKey;
    const m = GAME_MODES[modeKey];
    timers.white = m.seconds;
    timers.black = m.seconds;
    gameActive = true;
    const label = document.getElementById('mode-label');
    if (label) label.textContent = m.label;
    updateTimerDisplay('white');
    updateTimerDisplay('black');
    setActivePanel('white');
    startTimer();
}

function createBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square', (row + col) % 2 === 0 ? 'white' : 'black');
            square.dataset.row = row;
            square.dataset.col = col;
            if (col === 0) {
                const r = document.createElement('span');
                r.classList.add('coordinate', 'rank');
                r.innerText = 8 - row;
                square.appendChild(r);
            }
            if (row === 7) {
                const f = document.createElement('span');
                f.classList.add('coordinate', 'file');
                f.innerText = String.fromCharCode(97 + col);
                square.appendChild(f);
            }
            const pieceCode = initialBoardSetup[row][col];
            if (pieceCode) square.appendChild(makePieceImg(pieceCode));
            boardElement.appendChild(square);
        }
    }
}

function makePieceImg(pieceCode) {
    const img = document.createElement('img');
    img.src = pieceImages[pieceCode];
    img.classList.add('piece');
    img.dataset.pieceCode = pieceCode;
    return img;
}

function animateMove(pieceImg, fromSquare, toSquare, onDone) {
    const boardRect = boardElement.getBoundingClientRect();
    const fromRect  = fromSquare.getBoundingClientRect();
    const toRect    = toSquare.getBoundingClientRect();
    const clone = document.createElement('img');
    clone.src = pieceImg.src;
    clone.classList.add('piece-flying');
    const startLeft = fromRect.left - boardRect.left + (fromRect.width  - 66) / 2;
    const startTop  = fromRect.top  - boardRect.top  + (fromRect.height - 66) / 2;
    const endLeft   = toRect.left   - boardRect.left + (toRect.width    - 66) / 2;
    const endTop    = toRect.top    - boardRect.top  + (toRect.height   - 66) / 2;
    clone.style.left = startLeft + 'px';
    clone.style.top  = startTop  + 'px';
    pieceImg.style.opacity = '0';
    boardElement.appendChild(clone);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            clone.style.left = endLeft + 'px';
            clone.style.top  = endTop  + 'px';
        });
    });
    clone.addEventListener('transitionend', () => {
        clone.remove();
        pieceImg.style.opacity = '1';
        onDone();
    }, { once: true });
}

function shakeSquare(square) {
    playSound('illegal');
    square.classList.remove('shake');
    void square.offsetWidth;
    square.classList.add('shake');
    square.addEventListener('animationend', () => square.classList.remove('shake'), { once: true });
}

function getPieceColor(pieceCode) {
    if (!pieceCode) return null;
    return pieceCode === pieceCode.toUpperCase() ? 'white' : 'black';
}

function getSquare(row, col) {
    return document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
}

function isPathClear(sr, sc, tr, tc) {
    const rs = sr === tr ? 0 : (tr > sr ? 1 : -1);
    const cs = sc === tc ? 0 : (tc > sc ? 1 : -1);
    let r = sr + rs, c = sc + cs;
    while (r !== tr || c !== tc) {
        if (getSquare(r, c).querySelector('.piece')) return false;
        r += rs; c += cs;
    }
    return true;
}

function isPathClearOnBoard(board, sr, sc, tr, tc) {
    const rs = sr === tr ? 0 : (tr > sr ? 1 : -1);
    const cs = sc === tc ? 0 : (tc > sc ? 1 : -1);
    let r = sr + rs, c = sc + cs;
    while (r !== tr || c !== tc) {
        if (board[r][c] !== '') return false;
        r += rs; c += cs;
    }
    return true;
}

function getBoardState() {
    const board = [];
    for (let row = 0; row < 8; row++) {
        board[row] = [];
        for (let col = 0; col < 8; col++) {
            const p = getSquare(row, col).querySelector('.piece');
            board[row][col] = p ? p.dataset.pieceCode : '';
        }
    }
    return board;
}

function applyMove(board, fr, fc, tr, tc) {
    const b = board.map(r => [...r]);
    const piece = b[fr][fc];
    b[tr][tc] = piece;
    b[fr][fc] = '';
    if (piece && piece.toLowerCase() === 'p' && fc !== tc && enPassantTarget
        && tr === enPassantTarget.row && tc === enPassantTarget.col) {
        b[piece === piece.toUpperCase() ? tr + 1 : tr - 1][tc] = '';
    }
    return b;
}

function findKing(board, color) {
    const k = color === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] === k) return { row: r, col: c };
    return null;
}

function canPieceAttack(board, fr, fc, tr, tc, pieceCode) {
    const rd = tr - fr, cd = tc - fc;
    const ar = Math.abs(rd), ac = Math.abs(cd);
    const piece = pieceCode.toLowerCase();
    const isWhite = pieceCode === pieceCode.toUpperCase();
    if (piece === 'p') { const d = isWhite ? -1 : 1; return rd === d && ac === 1; }
    if (piece === 'r') return (fr === tr || fc === tc) && isPathClearOnBoard(board, fr, fc, tr, tc);
    if (piece === 'b') return ar === ac && isPathClearOnBoard(board, fr, fc, tr, tc);
    if (piece === 'q') return (fr === tr || fc === tc || ar === ac) && isPathClearOnBoard(board, fr, fc, tr, tc);
    if (piece === 'k') return ar <= 1 && ac <= 1 && ar + ac > 0;
    if (piece === 'n') return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
    return false;
}

function isKingInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return false;
    const enemy = color === 'white' ? 'black' : 'white';
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && getPieceColor(p) === enemy && canPieceAttack(board, r, c, king.row, king.col, p))
                return true;
        }
    return false;
}

function hasAnyLegalMove(color) {
    const board = getBoardState();
    if (canCastle(color, 'kingside') || canCastle(color, 'queenside')) return true;
    for (let fr = 0; fr < 8; fr++)
        for (let fc = 0; fc < 8; fc++) {
            const p = board[fr][fc];
            if (!p || getPieceColor(p) !== color) continue;
            for (let tr = 0; tr < 8; tr++)
                for (let tc = 0; tc < 8; tc++) {
                    if (fr === tr && fc === tc) continue;
                    if (board[tr][tc] && getPieceColor(board[tr][tc]) === color) continue;
                    if (!isValidMove(getSquare(fr, fc), getSquare(tr, tc), p)) continue;
                    if (!isKingInCheck(applyMove(board, fr, fc, tr, tc), color)) return true;
                }
        }
    return false;
}

function isValidMove(startSq, targetSq, pieceCode) {
    const sr = parseInt(startSq.dataset.row), sc = parseInt(startSq.dataset.col);
    const tr = parseInt(targetSq.dataset.row), tc = parseInt(targetSq.dataset.col);
    const rd = tr - sr, cd = tc - sc;
    const ar = Math.abs(rd), ac = Math.abs(cd);
    const piece = pieceCode.toLowerCase();
    const isWhite = pieceCode === pieceCode.toUpperCase();
    const targetPiece = targetSq.querySelector('.piece');
    if (piece === 'p') {
        const dir = isWhite ? -1 : 1;
        const startRow = isWhite ? 6 : 1;
        if (cd === 0 && rd === dir) return !targetPiece;
        if (cd === 0 && rd === 2 * dir && sr === startRow)
            return !targetPiece && !getSquare(sr + dir, sc).querySelector('.piece');
        if (ac === 1 && rd === dir) {
            if (targetPiece) return true;
            if (enPassantTarget && tr === enPassantTarget.row && tc === enPassantTarget.col) return true;
        }
        return false;
    }
    if (piece === 'r') return (sr === tr || sc === tc) && isPathClear(sr, sc, tr, tc);
    if (piece === 'b') return ar === ac && isPathClear(sr, sc, tr, tc);
    if (piece === 'q') return (sr === tr || sc === tc || ar === ac) && isPathClear(sr, sc, tr, tc);
    if (piece === 'k') return ar <= 1 && ac <= 1 && ar + ac > 0;
    if (piece === 'n') return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
    return false;
}

function isCastlingMove(startSq, targetSq, pieceCode) {
    if (pieceCode.toLowerCase() !== 'k') return null;
    const sc = parseInt(startSq.dataset.col), tc = parseInt(targetSq.dataset.col);
    const sr = parseInt(startSq.dataset.row), tr = parseInt(targetSq.dataset.row);
    if (sr !== tr || sc !== 4) return null;
    if (tc === 6) return 'kingside';
    if (tc === 2) return 'queenside';
    return null;
}

function canCastle(color, side) {
    const isWhite = color === 'white';
    const row = isWhite ? 7 : 0;
    const kingCode = isWhite ? 'K' : 'k';
    const rookCode = isWhite ? 'R' : 'r';
    const rookKey = isWhite
        ? (side === 'kingside' ? 'WR_right' : 'WR_left')
        : (side === 'kingside' ? 'BR_right' : 'BR_left');
    if (hasMoved[kingCode] || hasMoved[rookKey]) return false;
    const rookCol = side === 'kingside' ? 7 : 0;
    const rookPiece = getSquare(row, rookCol).querySelector('.piece');
    if (!rookPiece || rookPiece.dataset.pieceCode !== rookCode) return false;
    const clearCols = side === 'kingside' ? [5, 6] : [1, 2, 3];
    for (const c of clearCols)
        if (getSquare(row, c).querySelector('.piece')) return false;
    const board = getBoardState();
    if (isKingInCheck(board, color)) return false;
    const passCols = side === 'kingside' ? [5, 6] : [2, 3];
    for (const c of passCols)
        if (isKingInCheck(applyMove(board, row, 4, row, c), color)) return false;
    return true;
}

function performCastle(color, side, onDone) {
    const row = color === 'white' ? 7 : 0;
    const rookCol = side === 'kingside' ? 7 : 0;
    const kingTargetCol = side === 'kingside' ? 6 : 2;
    const rookTargetCol = side === 'kingside' ? 5 : 3;
    const kingSq = getSquare(row, 4);
    const rookSq = getSquare(row, rookCol);
    const kingImg = kingSq.querySelector('.piece');
    const rookImg = rookSq.querySelector('.piece');
    const kingTargetSq = getSquare(row, kingTargetCol);
    const rookTargetSq = getSquare(row, rookTargetCol);
    animateMove(kingImg, kingSq, kingTargetSq, () => {
        kingTargetSq.appendChild(kingImg);
        animateMove(rookImg, rookSq, rookTargetSq, () => {
            rookTargetSq.appendChild(rookImg);
            playSound('castle');
            const kingCode = color === 'white' ? 'K' : 'k';
            const rookKey = color === 'white'
                ? (side === 'kingside' ? 'WR_right' : 'WR_left')
                : (side === 'kingside' ? 'BR_right' : 'BR_left');
            hasMoved[kingCode] = true;
            hasMoved[rookKey] = true;
            onDone();
        });
    });
}

function checkPawnPromotion(targetSq, pieceCode, callback) {
    const isWhite = pieceCode === pieceCode.toUpperCase();
    const tr = parseInt(targetSq.dataset.row);
    if (pieceCode.toLowerCase() !== 'p' || (isWhite ? tr !== 0 : tr !== 7)) return callback(false);
    const options = isWhite
        ? [['Q','Queen'],['R','Rook'],['B','Bishop'],['N','Knight']]
        : [['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']];
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);
        display:flex;align-items:center;justify-content:center;z-index:1000;
        animation:endFadeIn 0.35s ease forwards;`;
    const modal = document.createElement('div');
    modal.style.cssText = `
        background:linear-gradient(160deg,#2a1c0e 0%,#3b2a1a 60%,#2a1c0e 100%);
        border:2px solid #d4af37;border-radius:20px;
        padding:36px 40px;text-align:center;
        font-family:'Georgia',serif;color:#f0dbb5;
        box-shadow:0 0 60px rgba(212,175,55,0.3),0 8px 40px rgba(0,0,0,0.7);
        animation:endBoxIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards;`;
    modal.innerHTML = `
        <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#7a5a30;margin-bottom:4px;">Pawn Promotion</div>
        <div style="width:50px;height:1px;background:linear-gradient(to right,transparent,#d4af37,transparent);margin:10px auto 20px;"></div>`;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:14px;justify-content:center;';
    options.forEach(([code, label]) => {
        const btn = document.createElement('div');
        btn.style.cssText = `
            width:76px;height:96px;
            background:rgba(255,255,255,0.04);
            border:1px solid rgba(212,175,55,0.25);
            border-radius:12px;display:flex;flex-direction:column;align-items:center;
            justify-content:center;cursor:pointer;gap:8px;
            transition:background 0.2s,border-color 0.2s,transform 0.15s,box-shadow 0.2s;`;
        btn.onmouseenter = () => {
            btn.style.background = 'rgba(212,175,55,0.1)';
            btn.style.borderColor = 'rgba(212,175,55,0.6)';
            btn.style.transform = 'translateY(-3px)';
            btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'rgba(255,255,255,0.04)';
            btn.style.borderColor = 'rgba(212,175,55,0.25)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'none';
        };
        const img = document.createElement('img');
        img.src = pieceImages[code];
        img.style.cssText = 'width:46px;height:46px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6))';
        const lbl = document.createElement('span');
        lbl.textContent = label;
        lbl.style.cssText = 'font-size:11px;color:#d4af37;letter-spacing:1px;text-transform:uppercase;font-family:Georgia,serif;';
        btn.appendChild(img);
        btn.appendChild(lbl);
        btn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            const pieceImg = targetSq.querySelector('.piece');
            if (pieceImg) {
                pieceImg.src = pieceImages[code];
                pieceImg.dataset.pieceCode = code;
            }
            callback(true);
        });
        btnRow.appendChild(btn);
    });
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function updateCheckHighlight(color) {
    document.querySelectorAll('.in-check').forEach(sq => sq.classList.remove('in-check'));
    const board = getBoardState();
    if (isKingInCheck(board, color)) {
        const king = findKing(board, color);
        if (king) getSquare(king.row, king.col).classList.add('in-check');
        if (!hasAnyLegalMove(color)) {
            playSound('gameover');
            const winner = color === 'white' ? 'Black' : 'White';
            setTimeout(() => showEndModal(`Checkmate! ${winner} wins! 🎉`), 150);
        } else {
            playSound('check');
        }
        return true;
    }
    if (!hasAnyLegalMove(color)) {
        playSound('gameover');
        setTimeout(() => showEndModal("Stalemate! It's a draw. 🤝"), 150);
    }
    return false;
}

function showLegalMoves(fromSquare, pieceCode) {
    clearLegalMoves();
    const board = getBoardState();
    const fr = parseInt(fromSquare.dataset.row);
    const fc = parseInt(fromSquare.dataset.col);
    for (let tr = 0; tr < 8; tr++) {
        for (let tc = 0; tc < 8; tc++) {
            if (fr === tr && fc === tc) continue;
            const targetSq = getSquare(tr, tc);
            const targetPiece = targetSq.querySelector('.piece');
            if (targetPiece && getPieceColor(targetPiece.dataset.pieceCode) === turn) continue;
            const castleSide = isCastlingMove(fromSquare, targetSq, pieceCode);
            const valid = castleSide ? canCastle(turn, castleSide) : isValidMove(fromSquare, targetSq, pieceCode);
            if (!valid) continue;
            if (isKingInCheck(applyMove(board, fr, fc, tr, tc), turn)) continue;
            targetSq.classList.add(targetPiece ? 'legal-capture' : 'legal-move');
        }
    }
}

function clearLegalMoves() {
    document.querySelectorAll('.legal-move, .legal-capture')
        .forEach(sq => sq.classList.remove('legal-move', 'legal-capture'));
}

function handleSquareClick(clickedSquare) {
    if (isAnimating || !gameActive) return;
    const clickedPiece = clickedSquare.querySelector('.piece');
    if (selectedSquare === null && clickedPiece) {
        if (getPieceColor(clickedPiece.dataset.pieceCode) !== turn) return;
        selectedSquare = clickedSquare;
        clickedSquare.classList.add('selected');
        showLegalMoves(clickedSquare, clickedPiece.dataset.pieceCode);
        return;
    }
    if (selectedSquare === null) return;
    const selectedPieceImg = selectedSquare.querySelector('.piece');
    const pieceCode = selectedPieceImg.dataset.pieceCode;
    if (clickedPiece && getPieceColor(clickedPiece.dataset.pieceCode) === turn) {
        selectedSquare.classList.remove('selected');
        clearLegalMoves();
        selectedSquare = clickedSquare;
        clickedSquare.classList.add('selected');
        showLegalMoves(clickedSquare, clickedPiece.dataset.pieceCode);
        return;
    }
    const castleSide = isCastlingMove(selectedSquare, clickedSquare, pieceCode);
    if (castleSide) {
        if (!canCastle(turn, castleSide)) {
            shakeSquare(selectedSquare);
            selectedSquare.classList.remove('selected');
            clearLegalMoves();
            selectedSquare = null;
            return;
        }
        selectedSquare.classList.remove('selected');
        clearLegalMoves();
        const castleColor = turn;
        isAnimating = true;
        selectedSquare = null;
        performCastle(castleColor, castleSide, () => {
            enPassantTarget = null;
            isAnimating = false;
            applyIncrement(castleColor);
            turn = turn === 'white' ? 'black' : 'white';
            setActivePanel(turn);
            updateCheckHighlight(turn);
        });
        return;
    }
    if (!isValidMove(selectedSquare, clickedSquare, pieceCode)) {
        shakeSquare(selectedSquare);
        selectedSquare.classList.remove('selected');
        clearLegalMoves();
        selectedSquare = null;
        return;
    }
    const fr = parseInt(selectedSquare.dataset.row), fc = parseInt(selectedSquare.dataset.col);
    const tr = parseInt(clickedSquare.dataset.row),  tc = parseInt(clickedSquare.dataset.col);
    if (isKingInCheck(applyMove(getBoardState(), fr, fc, tr, tc), turn)) {
        shakeSquare(selectedSquare);
        selectedSquare.classList.remove('selected');
        clearLegalMoves();
        selectedSquare = null;
        return;
    }
    const fromSq = selectedSquare;
    selectedSquare.classList.remove('selected');
    clearLegalMoves();
    selectedSquare = null;
    isAnimating = true;
    animateMove(selectedPieceImg, fromSq, clickedSquare, () => {
        if (clickedPiece && clickedPiece.parentNode === clickedSquare) {
            addCapturedPiece(clickedPiece.dataset.pieceCode);
            clickedPiece.remove();
            playSound('capture');
        } else {
            playSound('move');
        }
        clickedSquare.appendChild(selectedPieceImg);
        if (pieceCode.toLowerCase() === 'p' && fc !== tc && !clickedPiece) {
            const capturedRow = pieceCode === 'P' ? tr + 1 : tr - 1;
            const capturedSq = getSquare(capturedRow, tc);
            const capturedPawn = capturedSq && capturedSq.querySelector('.piece');
            if (capturedPawn) {
                addCapturedPiece(capturedPawn.dataset.pieceCode);
                capturedPawn.remove();
                playSound('capture');
            }
        }
        enPassantTarget = (pieceCode.toLowerCase() === 'p' && Math.abs(tr - fr) === 2)
            ? { row: (fr + tr) / 2, col: fc }
            : null;
        if (pieceCode === 'K') hasMoved['K'] = true;
        if (pieceCode === 'k') hasMoved['k'] = true;
        if (pieceCode === 'R' && fc === 0) hasMoved['WR_left'] = true;
        if (pieceCode === 'R' && fc === 7) hasMoved['WR_right'] = true;
        if (pieceCode === 'r' && fc === 0) hasMoved['BR_left'] = true;
        if (pieceCode === 'r' && fc === 7) hasMoved['BR_right'] = true;
        isAnimating = false;
        checkPawnPromotion(clickedSquare, pieceCode, (promoted) => {
            if (promoted) playSound('promote');
            applyIncrement(turn);
            turn = turn === 'white' ? 'black' : 'white';
            setActivePanel(turn);
            updateCheckHighlight(turn);
        });
    });
}

function showEndModal(msg) {
    gameActive = false;
    stopTimer();
    const isCheckmate = msg.includes('Checkmate');
    const isTimeout   = msg.includes('on time');
    const isDraw      = msg.includes('Draw') || msg.includes('Stalemate');
    const winsWhite   = msg.includes('White') && !isDraw;
    const trophy   = isDraw ? '🤝' : winsWhite ? '♕' : '♛';
    const headline = isDraw ? (msg.includes('Stalemate') ? 'Stalemate' : 'Draw') : (winsWhite ? 'White Wins' : 'Black Wins');
    const sub      = isDraw ? (msg.includes('Stalemate') ? 'No legal moves remaining' : 'Insufficient material vs. time') : (isCheckmate ? 'by Checkmate' : isTimeout ? 'on Time' : 'Game over');
    const accentColor = isDraw ? '#a0784a' : winsWhite ? '#d4af37' : '#888';
    const glowColor   = isDraw ? 'rgba(160,120,74,0.4)' : winsWhite ? 'rgba(212,175,55,0.35)' : 'rgba(140,140,140,0.3)';
    const overlay = document.createElement('div');
    overlay.id = 'end-overlay';
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.82);
        display:flex;align-items:center;justify-content:center;z-index:2000;
        animation:endFadeIn 0.35s ease forwards;`;
    overlay.innerHTML = `
        <div id="end-box" style="
            background:linear-gradient(160deg,#2a1c0e 0%,#3b2a1a 60%,#2a1c0e 100%);
            border:2px solid ${accentColor};border-radius:20px;
            padding:48px 56px;text-align:center;font-family:'Georgia',serif;
            color:#f0dbb5;min-width:320px;
            box-shadow:0 0 60px ${glowColor},0 8px 32px rgba(0,0,0,0.6);
            animation:endBoxIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards;">
            <div style="font-size:56px;margin-bottom:12px;line-height:1;color:${isDraw ? '#a0784a' : winsWhite ? '#ffffff' : '#222222'};text-shadow:0 0 16px ${glowColor};">${trophy}</div>
            <div style="font-size:32px;font-weight:bold;color:${accentColor};letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;text-shadow:0 0 20px ${glowColor};">${headline}</div>
            <div style="font-size:14px;color:#7a5a30;letter-spacing:2px;text-transform:uppercase;margin-bottom:36px;">${sub}</div>
            <button id="restart-btn" style="background:transparent;border:2px solid ${accentColor};color:${accentColor};
                padding:12px 40px;border-radius:10px;font-size:15px;font-family:'Georgia',serif;
                font-weight:bold;letter-spacing:1px;cursor:pointer;transition:background 0.2s,color 0.2s,transform 0.1s;"
                onmouseover="this.style.background='${accentColor}';this.style.color='#1a0e05';"
                onmouseout="this.style.background='transparent';this.style.color='${accentColor}';"
                onmousedown="this.style.transform='scale(0.96)'"
                onmouseup="this.style.transform='scale(1)'">Play Again</button>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('restart-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        restartGame();
    });
}

function restartGame() {
    selectedSquare = null;
    turn = 'white';
    isAnimating = false;
    gameActive = false;
    enPassantTarget = null;
    stopTimer();
    resetCapturedPieces();
    Object.keys(hasMoved).forEach(k => hasMoved[k] = false);
    document.querySelectorAll('.in-check').forEach(sq => sq.classList.remove('in-check'));
    document.getElementById('timer-white').textContent = '--:--';
    document.getElementById('timer-black').textContent = '--:--';
    document.getElementById('timer-white').classList.remove('low-time');
    document.getElementById('timer-black').classList.remove('low-time');
    document.getElementById('panel-white').classList.remove('active');
    document.getElementById('panel-black').classList.remove('active');
    createBoard();
    showModeModal();
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const VOL = 0.35;

function makeNoise(ctx, duration) {
    const len = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
}

function woodThud(ctx, freq, gain, attack, decay, startTime) {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2.1, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.012);
    oscGain.gain.setValueAtTime(0, startTime);
    oscGain.gain.linearRampToValueAtTime(gain * VOL, startTime + attack);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + decay);
    osc.connect(oscGain);
    osc.start(startTime);
    osc.stop(startTime + decay + 0.05);
    return oscGain;
}

function clickTransient(ctx, gain, startTime) {
    const n = makeNoise(ctx, 0.025);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(5000, startTime);
    filter.frequency.exponentialRampToValueAtTime(1200, startTime + 0.02);
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * VOL, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.022);
    n.connect(filter); filter.connect(g);
    n.start(startTime); n.stop(startTime + 0.025);
    return g;
}

function playSound(type) {
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const out = ctx.destination;
    const now = ctx.currentTime;

    if (type === 'move') {
        const thud = woodThud(ctx, 220, 0.55, 0.003, 0.09, now);
        thud.connect(out);
        const click = clickTransient(ctx, 0.4, now);
        click.connect(out);
        const body = makeNoise(ctx, 0.07);
        const bodyF = ctx.createBiquadFilter();
        bodyF.type = 'bandpass'; bodyF.frequency.value = 900; bodyF.Q.value = 2;
        const bodyG = ctx.createGain();
        bodyG.gain.setValueAtTime(0.12 * VOL, now);
        bodyG.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        body.connect(bodyF); bodyF.connect(bodyG); bodyG.connect(out);
        body.start(now); body.stop(now + 0.07);

    } else if (type === 'capture') {
        const thud1 = woodThud(ctx, 160, 0.7, 0.002, 0.12, now);
        thud1.connect(out);
        const thud2 = woodThud(ctx, 110, 0.5, 0.003, 0.18, now + 0.015);
        thud2.connect(out);
        const click = clickTransient(ctx, 0.65, now);
        click.connect(out);
        const scatter = makeNoise(ctx, 0.15);
        const scatterF = ctx.createBiquadFilter();
        scatterF.type = 'bandpass'; scatterF.frequency.value = 1800; scatterF.Q.value = 1.2;
        const scatterG = ctx.createGain();
        scatterG.gain.setValueAtTime(0, now);
        scatterG.gain.linearRampToValueAtTime(0.18 * VOL, now + 0.008);
        scatterG.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        scatter.connect(scatterF); scatterF.connect(scatterG); scatterG.connect(out);
        scatter.start(now); scatter.stop(now + 0.15);

    } else if (type === 'check') {
        [[0, 523, 0.22], [0.14, 659, 0.2], [0.28, 784, 0.28]].forEach(([delay, freq, vol]) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq, now + delay);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(vol * VOL, now + delay + 0.01);
            g.gain.setValueAtTime(vol * VOL * 0.7, now + delay + 0.06);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
            o.connect(g); g.connect(out);
            o.start(now + delay); o.stop(now + delay + 0.35);
            const ting = clickTransient(ctx, 0.15, now + delay);
            ting.connect(out);
        });

    } else if (type === 'castle') {
        [0, 0.16].forEach((delay, i) => {
            const thud = woodThud(ctx, [200, 170][i], [0.5, 0.45][i], 0.003, 0.1, now + delay);
            thud.connect(out);
            const click = clickTransient(ctx, [0.35, 0.3][i], now + delay);
            click.connect(out);
        });

    } else if (type === 'promote') {
        const thud = woodThud(ctx, 260, 0.5, 0.003, 0.1, now);
        thud.connect(out);
        const click = clickTransient(ctx, 0.4, now);
        click.connect(out);
        [[0.08, 392, 0.18], [0.2, 523, 0.2], [0.33, 659, 0.22], [0.47, 784, 0.26]].forEach(([delay, freq, vol]) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, now + delay);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(vol * VOL, now + delay + 0.015);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
            o.connect(g); g.connect(out);
            o.start(now + delay); o.stop(now + delay + 0.32);
        });

    } else if (type === 'gameover') {
        [[0, 392], [0.32, 349], [0.65, 294], [1.05, 196]].forEach(([delay, freq], i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, now + delay);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime((0.28 - i * 0.02) * VOL, now + delay + 0.02);
            g.gain.setValueAtTime((0.28 - i * 0.02) * VOL, now + delay + 0.18);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.55);
            o.connect(g); g.connect(out);
            o.start(now + delay); o.stop(now + delay + 0.6);
            const o2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            o2.type = 'sine';
            o2.frequency.setValueAtTime(freq * 1.5, now + delay);
            g2.gain.setValueAtTime(0, now + delay);
            g2.gain.linearRampToValueAtTime(0.08 * VOL, now + delay + 0.02);
            g2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
            o2.connect(g2); g2.connect(out);
            o2.start(now + delay); o2.stop(now + delay + 0.4);
        });

    } else if (type === 'illegal') {
        const n = makeNoise(ctx, 0.18);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.setValueAtTime(600, now);
        f.frequency.exponentialRampToValueAtTime(150, now + 0.15);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.3 * VOL, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        const dist = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 5);
        dist.curve = curve;
        n.connect(dist); dist.connect(f); f.connect(g); g.connect(out);
        n.start(now); n.stop(now + 0.18);
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(120, now);
        o.frequency.exponentialRampToValueAtTime(70, now + 0.16);
        og.gain.setValueAtTime(0.18 * VOL, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        o.connect(og); og.connect(out); o.start(now); o.stop(now + 0.18);
    }
}

function playSound(type) {
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const out = ctx.destination;
    const now = ctx.currentTime;

    if (type === 'move') {
        const thud = woodThud(ctx, 220, 0.55, 0.003, 0.09, now);
        thud.connect(out);
        const click = clickTransient(ctx, 0.4, now);
        click.connect(out);
        const body = makeNoise(ctx, 0.07);
        const bodyF = ctx.createBiquadFilter();
        bodyF.type = 'bandpass'; bodyF.frequency.value = 900; bodyF.Q.value = 2;
        const bodyG = ctx.createGain();
        bodyG.gain.setValueAtTime(0.12, now);
        bodyG.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        body.connect(bodyF); bodyF.connect(bodyG); bodyG.connect(out);
        body.start(now); body.stop(now + 0.07);

    } else if (type === 'capture') {
        const thud1 = woodThud(ctx, 160, 0.7, 0.002, 0.12, now);
        thud1.connect(out);
        const thud2 = woodThud(ctx, 110, 0.5, 0.003, 0.18, now + 0.015);
        thud2.connect(out);
        const click = clickTransient(ctx, 0.65, now);
        click.connect(out);
        const scatter = makeNoise(ctx, 0.15);
        const scatterF = ctx.createBiquadFilter();
        scatterF.type = 'bandpass'; scatterF.frequency.value = 1800; scatterF.Q.value = 1.2;
        const scatterG = ctx.createGain();
        scatterG.gain.setValueAtTime(0, now);
        scatterG.gain.linearRampToValueAtTime(0.18, now + 0.008);
        scatterG.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        scatter.connect(scatterF); scatterF.connect(scatterG); scatterG.connect(out);
        scatter.start(now); scatter.stop(now + 0.15);

    } else if (type === 'check') {
        [[0, 523, 0.22], [0.14, 659, 0.2], [0.28, 784, 0.28]].forEach(([delay, freq, vol]) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq, now + delay);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(vol, now + delay + 0.01);
            g.gain.setValueAtTime(vol * 0.7, now + delay + 0.06);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
            o.connect(g); g.connect(out);
            o.start(now + delay); o.stop(now + delay + 0.35);
            const ting = clickTransient(ctx, 0.15, now + delay);
            ting.connect(out);
        });

    } else if (type === 'castle') {
        [0, 0.16].forEach((delay, i) => {
            const thud = woodThud(ctx, [200, 170][i], [0.5, 0.45][i], 0.003, 0.1, now + delay);
            thud.connect(out);
            const click = clickTransient(ctx, [0.35, 0.3][i], now + delay);
            click.connect(out);
        });

    } else if (type === 'promote') {
        const thud = woodThud(ctx, 260, 0.5, 0.003, 0.1, now);
        thud.connect(out);
        const click = clickTransient(ctx, 0.4, now);
        click.connect(out);
        [[0.08, 392, 0.18], [0.2, 523, 0.2], [0.33, 659, 0.22], [0.47, 784, 0.26]].forEach(([delay, freq, vol]) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, now + delay);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(vol, now + delay + 0.015);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
            o.connect(g); g.connect(out);
            o.start(now + delay); o.stop(now + delay + 0.32);
        });

    } else if (type === 'gameover') {
        [[0, 392], [0.32, 349], [0.65, 294], [1.05, 196]].forEach(([delay, freq], i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, now + delay);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(0.28 - i * 0.02, now + delay + 0.02);
            g.gain.setValueAtTime(0.28 - i * 0.02, now + delay + 0.18);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.55);
            o.connect(g); g.connect(out);
            o.start(now + delay); o.stop(now + delay + 0.6);
            const o2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            o2.type = 'sine';
            o2.frequency.setValueAtTime(freq * 1.5, now + delay);
            g2.gain.setValueAtTime(0, now + delay);
            g2.gain.linearRampToValueAtTime(0.08, now + delay + 0.02);
            g2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
            o2.connect(g2); g2.connect(out);
            o2.start(now + delay); o2.stop(now + delay + 0.4);
        });

    } else if (type === 'illegal') {
        const n = makeNoise(ctx, 0.18);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.setValueAtTime(600, now);
        f.frequency.exponentialRampToValueAtTime(150, now + 0.15);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.3, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        const dist = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 5);
        dist.curve = curve;
        n.connect(dist); dist.connect(f); f.connect(g); g.connect(out);
        n.start(now); n.stop(now + 0.18);
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(120, now);
        o.frequency.exponentialRampToValueAtTime(70, now + 0.16);
        og.gain.setValueAtTime(0.18, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        o.connect(og); og.connect(out); o.start(now); o.stop(now + 0.18);
    }
}

buildGameWrapper();
createBoard();
showModeModal();

let dragMoved = false;

function getSquareFromPoint(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
        if (el.classList.contains('square')) return el;
    }
    return null;
}

function startDrag(pieceImg, originSquare, clientX, clientY) {
    if (isAnimating || !gameActive) return;
    if (getPieceColor(pieceImg.dataset.pieceCode) !== turn) return;
    isDragging = true;
    dragMoved = false;
    dragPiece = pieceImg;
    dragOriginSquare = originSquare;
    dragClone = document.createElement('img');
    dragClone.src = pieceImg.src;
    dragClone.style.cssText = `
        position:fixed;width:70px;height:70px;
        pointer-events:none;z-index:1000;
        filter:drop-shadow(0 6px 12px rgba(0,0,0,0.7));
        transform:translate(-50%,-50%);transition:none;`;
    dragClone.style.left = clientX + 'px';
    dragClone.style.top  = clientY + 'px';
    document.body.appendChild(dragClone);
    pieceImg.style.opacity = '0.3';
    if (!originSquare.classList.contains('selected')) {
        selectedSquare?.classList.remove('selected');
        clearLegalMoves();
        selectedSquare = originSquare;
        originSquare.classList.add('selected');
        showLegalMoves(originSquare, pieceImg.dataset.pieceCode);
    }
}

function onDragMove(clientX, clientY) {
    if (!isDragging || !dragClone) return;
    dragMoved = true;
    dragClone.style.left = clientX + 'px';
    dragClone.style.top  = clientY + 'px';
    document.querySelectorAll('.drag-hover').forEach(s => s.classList.remove('drag-hover'));
    const sq = getSquareFromPoint(clientX, clientY);
    if (sq && sq !== dragOriginSquare) sq.classList.add('drag-hover');
}

function endDrag(clientX, clientY) {
    if (!isDragging) return;
    isDragging = false;
    document.querySelectorAll('.drag-hover').forEach(s => s.classList.remove('drag-hover'));
    dragClone?.remove();
    dragClone = null;
    if (dragPiece) dragPiece.style.opacity = '1';
    if (dragMoved) {
        const targetSq = getSquareFromPoint(clientX, clientY);
        if (targetSq && targetSq !== dragOriginSquare) {
            handleSquareClick(targetSq);
        }
    }
    dragPiece = null;
    dragOriginSquare = null;
}

boardElement.addEventListener('mousedown', e => {
    const square = e.target.closest('.square');
    if (!square) return;
    const pieceImg = square.querySelector('.piece');
    if (!pieceImg) return;
    e.preventDefault();
    startDrag(pieceImg, square, e.clientX, e.clientY);
});

boardElement.addEventListener('click', e => {
    if (dragMoved) { dragMoved = false; return; }
    const square = e.target.closest('.square');
    if (square) handleSquareClick(square);
}, true);

document.addEventListener('mousemove', e => {
    if (isDragging) onDragMove(e.clientX, e.clientY);
});

document.addEventListener('mouseup', e => {
    if (isDragging) endDrag(e.clientX, e.clientY);
});

boardElement.addEventListener('touchstart', e => {
    const square = e.target.closest('.square');
    if (!square) return;
    const pieceImg = square.querySelector('.piece');
    if (!pieceImg) return;
    const t = e.touches[0];
    startDrag(pieceImg, square, t.clientX, t.clientY);
}, { passive: true });

document.addEventListener('touchmove', e => {
    if (!isDragging) return;
    e.preventDefault();
    const t = e.touches[0];
    onDragMove(t.clientX, t.clientY);
}, { passive: false });

document.addEventListener('touchend', e => {
    if (!isDragging) return;
    const t = e.changedTouches[0];
    endDrag(t.clientX, t.clientY);
});