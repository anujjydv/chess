const boardElement = document.getElementById('chessboard');
let selectedSquare = null;
let turn = 'white';
let isAnimating = false; 

const GAME_MODES = {
    bullet:   { label: 'Bullet',    seconds: 60,  increment: 0, icon: '⚡' },
    bullet1i: { label: '1+1',       seconds: 60,  increment: 1, icon: '⚡' },
    blitz3:   { label: 'Blitz 3',   seconds: 180, increment: 0, icon: '🔥' },
    blitz3i:  { label: '3+2',       seconds: 180, increment: 2, icon: '🔥' },
    blitz5:   { label: 'Blitz 5',   seconds: 300, increment: 0, icon: '🔥' },
    blitz5i:  { label: '5+2',       seconds: 300, increment: 2, icon: '🔥' },
    rapid:    { label: 'Rapid',     seconds: 600, increment: 0, icon: '⏱️' },
    rapid10i: { label: '10+2',      seconds: 600, increment: 2, icon: '⏱️' },
};

let timers = { white: 0, black: 0 };
let timerInterval = null;
let gameMode = null;
let gameActive = false;

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

const capturedPieces = { white: [], black: [] }; 

const pieceOrder = ['q', 'r', 'b', 'n', 'p'];
const pieceValue = { q: 9, r: 5, b: 3, n: 3, p: 1 };

function addCapturedPiece(pieceCode) {
    const color = getPieceColor(pieceCode); 
    const capturedBy = color === 'black' ? 'white' : 'black';
    capturedPieces[capturedBy].push(pieceCode.toLowerCase());
    renderCapturedPieces(capturedBy);
}

function renderCapturedPieces(capturedBy) {
    const stripId = capturedBy === 'white' ? 'captured-by-white' : 'captured-by-black';
    const strip = document.getElementById(stripId);
    if (!strip) return;

    const sorted = [...capturedPieces[capturedBy]].sort(
        (a, b) => pieceValue[b] - pieceValue[a]
    );

    strip.innerHTML = '';
    sorted.forEach(code => {
        const img = document.createElement('img');
        
        const actualCode = capturedBy === 'white' ? code : code.toUpperCase();
        img.src = pieceImages[actualCode];
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

            const loser  = turn;
            const winner = loser === 'white' ? 'black' : 'white';
            const winnerLabel = winner === 'white' ? 'P1' : 'P2';
            const winnerName  = winner === 'white' ? 'White' : 'Black';

            const board = getBoardState();
            if (hasInsufficientMaterial(board, winner)) {
                setTimeout(() => showEndModal('Draw — insufficient material vs. time! \uD83E\uDD1D'), 100);
            } else {
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

    addModeRow(modal, overlay, {
        icon: '⚡', label: 'Bullet',
        chips: [
            { key: 'bullet',   label: '1 min' },
            { key: 'bullet1i', label: '1+1' },
        ]
    });

    addModeRow(modal, overlay, {
        icon: '🔥', label: 'Blitz',
        chips: [
            { key: 'blitz3',  label: '3 min' },
            { key: 'blitz3i', label: '3+2' },
            { key: 'blitz5',  label: '5 min' },
            { key: 'blitz5i', label: '5+2' },
        ]
    });

    addModeRow(modal, overlay, {
        icon: '⏱️', label: 'Rapid',
        chips: [
            { key: 'rapid',    label: '10 min' },
            { key: 'rapid10i', label: '10+2' },
        ]
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function addModeRow(modal, overlay, { icon, label, chips }) {
    const row = document.createElement('div');
    row.className = 'mode-btn mode-row';

    const chipsHTML = chips.map(function(c) {
        return '<button class="blitz-chip" data-key="' + c.key + '">' + c.label + '</button>';
    }).join('');

    row.innerHTML =
        '<span class="mode-icon">' + icon + '</span>' +
        '<span class="mode-info" style="flex:1">' +
          '<strong>' + label + '</strong>' +
        '</span>' +
        '<span class="blitz-chips">' + chipsHTML + '</span>';

    row.querySelectorAll('.blitz-chip').forEach(function(chip) {
        chip.addEventListener('click', function(e) {
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

            square.addEventListener('click', () => handleSquareClick(square));
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
    
    if (piece && piece.toLowerCase() === 'p' && fc !== tc && b[tr][tc] !== '' && enPassantTarget
        && tr === enPassantTarget.row && tc === enPassantTarget.col) {
        const capturedRow = piece === piece.toUpperCase() ? tr + 1 : tr - 1;
        b[capturedRow][tc] = '';
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
    if (piece === 'r') { return (fr === tr || fc === tc) && isPathClearOnBoard(board, fr, fc, tr, tc); }
    if (piece === 'b') { return ar === ac && isPathClearOnBoard(board, fr, fc, tr, tc); }
    if (piece === 'q') { return (fr === tr || fc === tc || ar === ac) && isPathClearOnBoard(board, fr, fc, tr, tc); }
    if (piece === 'k') { return ar <= 1 && ac <= 1 && ar + ac > 0; }
    if (piece === 'n') { return (ar === 2 && ac === 1) || (ar === 1 && ac === 2); }
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
    const sr = parseInt(startSq.dataset.row),  sc = parseInt(startSq.dataset.col);
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
        if (cd === 0 && rd === 2 * dir && sr === startRow) {
            return !targetPiece && !getSquare(sr + dir, sc).querySelector('.piece');
        }
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

    const kingSq  = getSquare(row, 4);
    const rookSq  = getSquare(row, rookCol);
    const kingImg = kingSq.querySelector('.piece');
    const rookImg = rookSq.querySelector('.piece');
    const kingTargetSq = getSquare(row, kingTargetCol);
    const rookTargetSq = getSquare(row, rookTargetCol);

    animateMove(kingImg, kingSq, kingTargetSq, () => {
        kingTargetSq.appendChild(kingImg);
        animateMove(rookImg, rookSq, rookTargetSq, () => {
            rookTargetSq.appendChild(rookImg);

            const kingCode = color === 'white' ? 'K' : 'k';
            const rookKey  = color === 'white'
                ? (side === 'kingside' ? 'WR_right' : 'WR_left')
                : (side === 'kingside' ? 'BR_right' : 'BR_left');
            hasMoved[kingCode] = true;
            hasMoved[rookKey]  = true;
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
            const winner = color === 'white' ? 'Black' : 'White';
            setTimeout(() => showEndModal(`Checkmate! ${winner} wins! 🎉`), 150);
        }
        return true;
    }
    if (!hasAnyLegalMove(color)) {
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

            let valid = false;

            const castleSide = isCastlingMove(fromSquare, targetSq, pieceCode);
            if (castleSide) {
                valid = canCastle(turn, castleSide);
            } else {
                valid = isValidMove(fromSquare, targetSq, pieceCode);
            }

            if (!valid) continue;

            const after = applyMove(board, fr, fc, tr, tc);
            if (isKingInCheck(after, turn)) continue;

            if (targetPiece) {
                targetSq.classList.add('legal-capture');
            } else {
                targetSq.classList.add('legal-move');
            }
        }
    }
}

function clearLegalMoves() {
    document.querySelectorAll('.legal-move, .legal-capture')
        .forEach(sq => sq.classList.remove('legal-move', 'legal-capture'));
}

function handleSquareClick(clickedSquare) {
    if (isAnimating) return; 
    if (!gameActive) return; 

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
        }
        clickedSquare.appendChild(selectedPieceImg);

        if (pieceCode.toLowerCase() === 'p' && fc !== tc && !clickedPiece) {
            const capturedRow = pieceCode === 'P' ? tr + 1 : tr - 1;
            const capturedSq = getSquare(capturedRow, tc);
            const capturedPawn = capturedSq && capturedSq.querySelector('.piece');
            if (capturedPawn) {
                addCapturedPiece(capturedPawn.dataset.pieceCode);
                capturedPawn.remove();
            }
        }

        if (pieceCode.toLowerCase() === 'p' && Math.abs(tr - fr) === 2) {
            enPassantTarget = { row: (fr + tr) / 2, col: fc };
        } else {
            enPassantTarget = null;
        }

        if (pieceCode === 'K') hasMoved['K'] = true;
        if (pieceCode === 'k') hasMoved['k'] = true;
        if (pieceCode === 'R' && fc === 0) hasMoved['WR_left'] = true;
        if (pieceCode === 'R' && fc === 7) hasMoved['WR_right'] = true;
        if (pieceCode === 'r' && fc === 0) hasMoved['BR_left'] = true;
        if (pieceCode === 'r' && fc === 7) hasMoved['BR_right'] = true;

        isAnimating = false;

        checkPawnPromotion(clickedSquare, pieceCode, () => {
            applyIncrement(turn);
            turn = turn === 'white' ? 'black' : 'white';
            setActivePanel(turn);
            updateCheckHighlight(turn);
        });
    });
}

function showMessage(msg) {
    
    const old = document.getElementById('check-notify');
    if (old) old.remove();

    const notify = document.createElement('div');
    notify.id = 'check-notify';

    const vignette = document.createElement('div');
    vignette.id = 'check-vignette';

    const badge = document.createElement('div');
    badge.id = 'check-badge';
    badge.textContent = msg;

    notify.appendChild(vignette);
    notify.appendChild(badge);
    document.body.appendChild(notify);

    clearTimeout(notify._t);
    notify._t = setTimeout(() => {
        notify.classList.add('check-notify-out');
        notify.addEventListener('animationend', () => notify.remove(), { once: true });
    }, 1800);
}

function showEndModal(msg) {
    gameActive = false;
    stopTimer();

    const isCheckmate  = msg.includes('Checkmate');
    const isTimeout    = msg.includes('on time');
    const isDraw       = msg.includes('Draw') || msg.includes('Stalemate');
    const winsWhite    = msg.includes('White') && !isDraw;
    const winsBlack    = msg.includes('Black') && !isDraw;

    const trophy   = isDraw ? '🤝' : winsWhite ? '♕' : '♛';
    const headline = isDraw
        ? (msg.includes('Stalemate') ? 'Stalemate' : 'Draw')
        : (winsWhite ? 'White Wins' : 'Black Wins');
    const sub = isDraw
        ? (msg.includes('Stalemate') ? 'No legal moves remaining' : 'Insufficient material vs. time')
        : (isCheckmate ? 'by Checkmate' : isTimeout ? 'on Time' : 'Game over');

    const accentColor = isDraw ? '#a0784a' : winsWhite ? '#d4af37' : '#888';
    const glowColor   = isDraw ? 'rgba(160,120,74,0.4)' : winsWhite ? 'rgba(212,175,55,0.35)' : 'rgba(140,140,140,0.3)';

    const overlay = document.createElement('div');
    overlay.id = 'end-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;
        background:rgba(0,0,0,0.82);
        display:flex;align-items:center;justify-content:center;
        z-index:2000;
        animation:endFadeIn 0.35s ease forwards;`;

    overlay.innerHTML = `
        <div id="end-box" style="
            background:linear-gradient(160deg,#2a1c0e 0%,#3b2a1a 60%,#2a1c0e 100%);
            border:2px solid ${accentColor};
            border-radius:20px;
            padding:48px 56px;
            text-align:center;
            font-family:'Georgia',serif;
            color:#f0dbb5;
            min-width:320px;
            box-shadow:0 0 60px ${glowColor}, 0 8px 32px rgba(0,0,0,0.6);
            animation:endBoxIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
        ">
            <div style="font-size:56px;margin-bottom:12px;line-height:1;color:${isDraw ? '#a0784a' : winsWhite ? '#ffffff' : '#222222'};text-shadow:0 0 16px ${glowColor};">${trophy}</div>
            <div style="
                font-size:32px;font-weight:bold;
                color:${accentColor};
                letter-spacing:2px;
                text-transform:uppercase;
                margin-bottom:6px;
                text-shadow:0 0 20px ${glowColor};
            ">${headline}</div>
            <div style="
                font-size:14px;
                color:#7a5a30;
                letter-spacing:2px;
                text-transform:uppercase;
                margin-bottom:36px;
            ">${sub}</div>
            <button id="restart-btn" style="
                background:transparent;
                border:2px solid ${accentColor};
                color:${accentColor};
                padding:12px 40px;
                border-radius:10px;
                font-size:15px;
                font-family:'Georgia',serif;
                font-weight:bold;
                letter-spacing:1px;
                cursor:pointer;
                transition:background 0.2s,color 0.2s,transform 0.1s;
            "
            onmouseover="this.style.background='${accentColor}';this.style.color='#1a0e05';"
            onmouseout="this.style.background='transparent';this.style.color='${accentColor}';"
            onmousedown="this.style.transform='scale(0.96)'"
            onmouseup="this.style.transform='scale(1)'"
            >Play Again</button>
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
    const msg = document.getElementById('status-msg');
    if (msg) msg.style.display = 'none';

    document.getElementById('timer-white').textContent = '--:--';
    document.getElementById('timer-black').textContent = '--:--';
    document.getElementById('timer-white').classList.remove('low-time');
    document.getElementById('timer-black').classList.remove('low-time');
    document.getElementById('panel-white').classList.remove('active');
    document.getElementById('panel-black').classList.remove('active');

    createBoard();
    showModeModal();
}

buildGameWrapper();
createBoard();
showModeModal();