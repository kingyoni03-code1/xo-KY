// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('ServiceWorker registered');
        }).catch(err => {
            console.log('ServiceWorker error: ', err);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('game-grid');
    const scoreXEl = document.getElementById('score-x');
    const scoreOEl = document.getElementById('score-o');
    const turnIcon = document.getElementById('current-turn-icon');
    const statusText = document.getElementById('status-text');
    const resetBtn = document.getElementById('btn-reset');
    
    // Nav elements
    const navPvPWeb = document.getElementById('nav-pvp-web');
    const navAIWeb = document.getElementById('nav-ai-web');
    const navPvPMob = document.getElementById('nav-pvp-mobile');
    const navAIMob = document.getElementById('nav-ai-mobile');
    const difficultySelector = document.getElementById('difficulty-selector');
    const diffBtns = document.querySelectorAll('.diff-btn');

    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const html = document.documentElement;
            html.classList.toggle('dark');
            if (html.classList.contains('dark')) {
                themeIcon.textContent = 'light_mode';
            } else {
                themeIcon.textContent = 'dark_mode';
            }
        });
    }

    let board = Array(9).fill(null);
    let currentPlayer = 'X';
    let gameActive = true;
    let mode = 'pvp'; // pvp or ai
    let difficulty = 'easy'; // easy, medium, hard, impossible
    let scores = { X: 0, O: 0 };
    
    let audioCtx = null;
    function getAudioCtx() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playPointSound() {
        const ctx = getAudioCtx();
        if (!ctx) return;
        
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // A nice "ding" or "power up" sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // Slide up to A6
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
    }

    function playPlaceSound() {
        const ctx = getAudioCtx();
        if (!ctx) return;
        
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // A low "thump" or vibrate sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    }

    function playWinnerVoice(winner) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Player ${winner} wins the match!`);
            utterance.pitch = 1.1;
            utterance.rate = 1;
            utterance.volume = 1;
            window.speechSynthesis.speak(utterance);
        } else {
            // Fallback triumphant sound if speech synth isn't available
            const ctx = getAudioCtx();
            if (!ctx) return;
            
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.2); // C#
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.4); // E
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.6); // A
            
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1.0);
        }
    }

    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    // Initialize grid
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.classList.add('local-cell', 'border', 'border-primary/20', 'flex', 'items-center', 'justify-center', 'cursor-pointer', 'relative');
        cell.dataset.index = i;
        cell.addEventListener('click', () => handleCellClick(i));
        // Hover effect for ghost symbol
        cell.addEventListener('mouseenter', () => handleCellEnter(i));
        cell.addEventListener('mouseleave', () => handleCellLeave(i));
        grid.appendChild(cell);
    }

    const cells = document.querySelectorAll('.local-cell');

    function handleCellEnter(index) {
        if (!gameActive || board[index] || (mode === 'ai' && currentPlayer === 'O')) return;
        const cell = cells[index];
        const ghost = document.createElement('span');
        ghost.classList.add('material-symbols-outlined', 'ghost-symbol', 'text-6xl', 'scanline-flicker');
        ghost.textContent = currentPlayer === 'X' ? 'close' : 'circle';
        ghost.classList.add(currentPlayer === 'X' ? 'text-primary' : 'text-secondary');
        cell.appendChild(ghost);
    }

    function handleCellLeave(index) {
        const cell = cells[index];
        const ghost = cell.querySelector('.ghost-symbol');
        if (ghost) ghost.remove();
    }

    function updateTurnUI() {
        turnIcon.textContent = currentPlayer === 'X' ? 'close' : 'circle';
        turnIcon.classList.remove('text-primary', 'text-secondary');
        turnIcon.classList.add(currentPlayer === 'X' ? 'text-primary' : 'text-secondary');
        turnIcon.style.filter = currentPlayer === 'X' ? 'drop-shadow(0 0 8px #81ecff)' : 'drop-shadow(0 0 8px #ff51fa)';
        
        const turnIndX = document.getElementById('turn-indicator-x');
        const turnIndO = document.getElementById('turn-indicator-o');
        if (currentPlayer === 'X') {
            turnIndX.classList.remove('opacity-30');
            turnIndO.classList.add('opacity-30');
            turnIndX.classList.add('shadow-[0_0_10px_theme(colors.primary)]');
            turnIndO.classList.remove('shadow-[0_0_10px_theme(colors.secondary)]');
        } else {
            turnIndO.classList.remove('opacity-30');
            turnIndX.classList.add('opacity-30');
            turnIndO.classList.add('shadow-[0_0_10px_theme(colors.secondary)]');
            turnIndX.classList.remove('shadow-[0_0_10px_theme(colors.primary)]');
        }
    }

    function handleCellClick(index) {
        if (!gameActive || board[index]) return;
        if (mode === 'ai' && currentPlayer === 'O') return; // Wait for AI

        makeMove(index, currentPlayer);
    }

    function makeMove(index, player) {
        board[index] = player;
        const cell = cells[index];
        
        // Remove ghost
        const ghost = cell.querySelector('.ghost-symbol');
        if (ghost) ghost.remove();

        // Add actual symbol
        const symbol = document.createElement('span');
        symbol.classList.add('material-symbols-outlined', 'text-6xl', 'font-bold');
        symbol.textContent = player === 'X' ? 'close' : 'circle';
        symbol.classList.add(player === 'X' ? 'text-primary' : 'text-secondary');
        symbol.classList.add(player === 'X' ? 'neon-text-primary' : 'neon-text-secondary');
        
        // Add particle effect here
        createParticles(cell, player);
        playPlaceSound();

        cell.appendChild(symbol);
        
        // Camera shake
        document.getElementById('3d-container').classList.add('animate-shake');
        setTimeout(() => document.getElementById('3d-container').classList.remove('animate-shake'), 200);

        if (checkWin(player)) {
            endGame(player);
        } else if (board.every(c => c !== null)) {
            endGame('draw');
        } else {
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            updateTurnUI();
            
            if (mode === 'ai' && currentPlayer === 'O' && gameActive) {
                setTimeout(makeAIMove, 500);
            }
        }
    }

    function createParticles(container, player) {
        const color = player === 'X' ? '#81ecff' : '#ff51fa';
        for (let i = 0; i < 8; i++) {
            const p = document.createElement('div');
            p.classList.add('particle');
            p.style.backgroundColor = color;
            p.style.left = '50%';
            p.style.top = '50%';
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 30;
            p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            container.appendChild(p);
            setTimeout(() => p.remove(), 600);
        }
    }

    function checkWin(player) {
        return winPatterns.some(pattern => {
            if (pattern.every(index => board[index] === player)) {
                pattern.forEach(idx => {
                    cells[idx].querySelector('span').classList.add('critical-bloom');
                });
                return true;
            }
            return false;
        });
    }

    function endGame(winner) {
        gameActive = false;
        if (winner !== 'draw') {
            scores[winner]++;
            updateScores();
            playPointSound();
            
            if (scores[winner] >= 5) {
                playWinnerVoice(winner);
                statusText.textContent = `${winner} WINS MATCH!`;
                
                const overlay = document.getElementById('match-winner-overlay');
                const overlayText = document.getElementById('match-winner-text');
                if (overlay && overlayText) {
                    overlayText.textContent = `PLAYER ${winner} WINS!`;
                    overlayText.className = `text-5xl md:text-8xl font-headline font-bold uppercase tracking-widest scale-50 transition-transform duration-500 text-center ${winner === 'X' ? 'text-primary drop-shadow-[0_0_20px_theme(colors.primary)]' : 'text-secondary drop-shadow-[0_0_20px_theme(colors.secondary)]'}`;
                    
                    overlay.classList.remove('opacity-0', 'pointer-events-none');
                    overlay.classList.add('opacity-100');
                    setTimeout(() => overlayText.classList.replace('scale-50', 'scale-100'), 50);
                }

                setTimeout(() => {
                    if (overlay && overlayText) {
                        overlay.classList.remove('opacity-100');
                        overlay.classList.add('opacity-0', 'pointer-events-none');
                        overlayText.classList.replace('scale-100', 'scale-50');
                    }
                    resetScores();
                    resetGame();
                }, 3000); // Wait 3s to show winner then reset
            } else {
                statusText.textContent = `${winner} WINS`;
            }
        } else {
            statusText.textContent = 'DRAW';
        }
    }

    function updateScores() {
        scoreXEl.textContent = scores.X.toString().padStart(2, '0');
        scoreOEl.textContent = scores.O.toString().padStart(2, '0');
    }

    function resetGame() {
        board = Array(9).fill(null);
        currentPlayer = 'X';
        gameActive = true;
        statusText.textContent = 'Turn';
        
        cells.forEach(c => {
            c.innerHTML = '';
            c.className = 'local-cell border border-primary/20 flex items-center justify-center cursor-pointer relative';
        });
        
        document.getElementById('laser-layer').innerHTML = '';
        updateTurnUI();

        if (mode === 'ai' && currentPlayer === 'O') {
            setTimeout(makeAIMove, 500); // In case AI starts first, but X always starts
        }
    }

    // AI Logic
    function makeAIMove() {
        if (!gameActive) return;
        let emptyIndices = board.map((v, i) => v === null ? i : null).filter(v => v !== null);
        if (emptyIndices.length === 0) return;

        let moveIndex;

        if (difficulty === 'easy') {
            // Random move
            moveIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        } else if (difficulty === 'medium') {
            // 50% random, 50% best move
            if (Math.random() > 0.5) {
                moveIndex = getBestMove('O');
            } else {
                moveIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            }
        } else if (difficulty === 'hard') {
            // 80% best move, 20% random
            if (Math.random() > 0.2) {
                moveIndex = getBestMove('O');
            } else {
                moveIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            }
        } else {
            // Impossible
            moveIndex = getBestMove('O');
        }

        makeMove(moveIndex, 'O');
    }

    function getBestMove(player) {
        let bestVal = -Infinity;
        let bestMove = -1;

        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = player;
                let moveVal = minimax(board, 0, false);
                board[i] = null;

                if (moveVal > bestVal) {
                    bestMove = i;
                    bestVal = moveVal;
                }
            }
        }
        return bestMove;
    }

    function minimax(boardState, depth, isMax) {
        let score = evaluate(boardState);

        if (score === 10) return score - depth;
        if (score === -10) return score + depth;
        if (boardState.every(c => c !== null)) return 0;

        if (isMax) {
            let best = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (boardState[i] === null) {
                    boardState[i] = 'O';
                    best = Math.max(best, minimax(boardState, depth + 1, !isMax));
                    boardState[i] = null;
                }
            }
            return best;
        } else {
            let best = Infinity;
            for (let i = 0; i < 9; i++) {
                if (boardState[i] === null) {
                    boardState[i] = 'X';
                    best = Math.min(best, minimax(boardState, depth + 1, !isMax));
                    boardState[i] = null;
                }
            }
            return best;
        }
    }

    function evaluate(b) {
        for (let i = 0; i < winPatterns.length; i++) {
            const [p1, p2, p3] = winPatterns[i];
            if (b[p1] && b[p1] === b[p2] && b[p2] === b[p3]) {
                if (b[p1] === 'O') return 10;
                else if (b[p1] === 'X') return -10;
            }
        }
        return 0;
    }

    // Nav setup
    function setMode(newMode) {
        mode = newMode;
        
        [navPvPWeb, navPvPMob].forEach(el => {
            if (!el) return;
            if(mode === 'pvp') {
                el.classList.add('text-primary', 'bg-primary/10', 'drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]');
                el.classList.remove('text-on-surface-variant', 'bg-transparent', 'hover:text-primary', 'hover:bg-surface-container-highest', 'text-slate-600', 'hover:text-[#d575ff]');
            } else {
                el.classList.remove('text-primary', 'bg-primary/10', 'drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]');
                el.classList.add('text-on-surface-variant', 'hover:text-primary');
            }
        });

        [navAIWeb, navAIMob].forEach(el => {
            if (!el) return;
            if(mode === 'ai') {
                el.classList.add('text-tertiary', 'bg-tertiary/10', 'drop-shadow-[0_0_8px_rgba(213,117,255,0.8)]');
                el.classList.remove('text-on-surface-variant', 'hover:text-tertiary', 'hover:bg-surface-container-highest', 'text-slate-600', 'hover:text-[#d575ff]');
            } else {
                el.classList.remove('text-tertiary', 'bg-tertiary/10', 'drop-shadow-[0_0_8px_rgba(213,117,255,0.8)]');
                el.classList.add('text-on-surface-variant', 'hover:text-tertiary');
            }
        });

        difficultySelector.style.display = mode === 'ai' ? 'flex' : 'none';
        
        resetScores();
        resetGame();
    }

    function resetScores() {
        scores = { X: 0, O: 0 };
        updateScores();
    }

    if (navPvPWeb) navPvPWeb.addEventListener('click', (e) => { e.preventDefault(); setMode('pvp'); });
    if (navPvPMob) navPvPMob.addEventListener('click', (e) => { e.preventDefault(); setMode('pvp'); });
    if (navAIWeb) navAIWeb.addEventListener('click', (e) => { e.preventDefault(); setMode('ai'); });
    if (navAIMob) navAIMob.addEventListener('click', (e) => { e.preventDefault(); setMode('ai'); });

    // Difficulty setup
    diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            difficulty = btn.dataset.diff;
            // Update active style
            diffBtns.forEach(b => {
                if(b.dataset.diff === 'impossible') {
                    b.className = 'diff-btn px-4 py-1 rounded border border-tertiary/50 text-xs font-label uppercase text-tertiary hover:bg-tertiary/10 transition-all';
                } else {
                    b.className = 'diff-btn px-4 py-1 rounded border border-primary/30 text-xs font-label uppercase text-on-surface-variant hover:text-primary hover:border-primary transition-all';
                }
            });
            if (difficulty === 'impossible') {
                btn.className = 'diff-btn px-4 py-1 rounded border border-tertiary/50 text-xs font-label uppercase text-tertiary transition-all shadow-[0_0_10px_theme(colors.tertiary)] bg-tertiary/20';
            } else {
                btn.className = 'diff-btn px-4 py-1 rounded border border-primary text-xs font-label uppercase text-primary transition-all shadow-[0_0_10px_rgba(129,236,255,0.4)] bg-primary/20';
            }
            resetScores();
            resetGame();
        });
    });

    // Default difficulty initialization
    const defaultDiff = document.querySelector('.diff-btn[data-diff="easy"]');
    if(defaultDiff) defaultDiff.click();

    resetBtn.addEventListener('click', resetGame);
    
    const resetScoresBtn = document.getElementById('btn-reset-scores');
    if (resetScoresBtn) {
        resetScoresBtn.addEventListener('click', () => {
            resetScores();
            resetGame();
        });
    }

    // Initial setup
    setMode('pvp');
});