// Keyboard and mouse state for the game. The rest of the game reads plain
// fields (keys held, edges pressed this frame, the pointer in field
// coordinates); only this file touches DOM events.

export function createInput(canvas, toField) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    touch: { active: false, moveX: 0, moveY: 0, firing: false },
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.code);
    input.pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = toField(event.clientX, event.clientY);
    input.mouse.x = point.x;
    input.mouse.y = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    input.mouse.x = point.x;
    input.mouse.y = point.y;
    input.mouse.down = true;
    input.mouse.clicked = true;
    if (event.pointerType === 'touch') input.touch.active = true;
  });
  window.addEventListener('pointerup', () => {
    input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  /** The held movement direction as a unit-ish vector from keys or touch. */
  input.moveVector = () => {
    let x = 0;
    let y = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  };

  /** Called once per frame after the game has read the edge-triggered state. */
  input.endFrame = () => {
    input.pressed.clear();
    input.mouse.clicked = false;
  };

  return input;
}
