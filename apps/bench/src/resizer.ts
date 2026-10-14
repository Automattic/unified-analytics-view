/* A corner to drag a frame by. CSS `resize` would do, but Safari gives the frame no grip when a view covers its corner.
 * The frame keeps its width when dragged, and its height too when it is a row, which is when it has been handed a box. */
export function resizable(frame: HTMLElement): void {
  const grip = frame.appendChild(document.createElement('span'));
  grip.className = 'grip';
  grip.setAttribute('aria-hidden', 'true');
  grip.addEventListener('pointerdown', (down) => {
    down.preventDefault();
    grip.setPointerCapture(down.pointerId);
    const { width, height } = frame.getBoundingClientRect();
    const move = (e: PointerEvent) => {
      frame.style.inlineSize = Math.max(40, width + e.clientX - down.clientX) + 'px';
      if (frame.classList.contains('ua-row')) frame.style.blockSize = Math.max(24, height + e.clientY - down.clientY) + 'px';
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('lostpointercapture', () => grip.removeEventListener('pointermove', move), { once: true });
  });
}
