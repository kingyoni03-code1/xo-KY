# Implement Interactive Tic-Tac-Toe with Cyberpunk Aesthetics

We will transform the static HTML template into a fully functional and highly interactive tic-tac-toe game, integrating the requested advanced VFX, sound effects, and animations.

## Proposed Changes

### 1. Game State & Logic Integration
- Add JavaScript to manage the 3x3 grid state, current turn (Player 1 / Player 2), and win detection.
- Clear the static `X` and `O` from the template cells to make them playable.

### 2. Audio Effects (Web Audio API)
To avoid loading external audio files and ensure immediate playback, we will synthesize the sound effects using the Web Audio API.
- **Valid Move Sound**: Combine a low-frequency "clunk" (using a lowpass-filtered square wave or noise) and a fast "zap" (using a rapidly descending frequency oscillator).
- **Error Sound**: A harsh, low-pitched buzz for invalid moves.

### 3. Visual Effects (VFX)

#### Camera Shake
- Create a CSS `@keyframes` animation for `camera-shake`.
- Apply it to the main grid container (`.perspective-1000`) for 0.2s upon placing a symbol.

#### Particle Burst
- On a valid click, dynamically generate `div` elements representing particles at the cell's center.
- Use CSS animations to scatter them radially and fade them out. Color will be cyan (`theme(colors.primary)`) for X and magenta (`theme(colors.secondary)`) for O.

#### Hover / Ghost Symbol
- Add `mouseenter`/`mouseleave` listeners to empty cells.
- Display a symbol (X or O depending on the turn) with `opacity: 0.3`.
- Apply a custom CSS animation (`scanline-flicker`) combining horizontal scanlines (via `repeating-linear-gradient` background clipped to text) and opacity flickering to simulate an unstable hologram.

#### Invalid Move Overload
- When clicking an already filled cell, apply an `error-overload` CSS class to the grid container.
- This will pulse a deep red (`#ff716c` or `theme(colors.error)`) box-shadow and text-shadow through the grid.

#### Win State Animations
- **Critical State**: Winning symbols get a `critical-bloom` class increasing `text-shadow` intensity by 300%.
- **Laser Beam (Heat Distortion)**: Draw an SVG line or a rotated `div` across the winning cells. We'll use CSS `backdrop-filter: blur(2px) brightness(1.5)` or a custom SVG `<filter>` with `<feTurbulence>` and `<feDisplacementMap>` to create the heat refraction effect over the background.
- **Loser Glitch**: Apply a `glitch-dim` CSS animation to the non-winning symbols, causing them to rapidly flicker in opacity and then stay dimmed at 20% opacity.

## Target Files

#### [MODIFY] code.html
We will inject all CSS for the animations and the JS logic into this single file to keep it self-contained.

## User Review Required

> [!IMPORTANT]  
> The sound effects will be generated synthetically via the Web Audio API. Browsers require the user to interact with the page (e.g., the first click) before audio can be played. The first click will initialize the audio context and play the sound.

> [!NOTE]  
> The laser beam connection will be drawn using an SVG overlay positioned precisely over the grid to ensure accurate alignment between winning cells.

Please approve this plan so we can begin execution!
