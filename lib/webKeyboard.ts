import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// The phone browser's keyboard, for the web build. react-native-web fires no Keyboard events, so tabBarHideOnKeyboard never
// hears about it. Comparing the window with the visual viewport (useDockLift) finds nothing on Chrome either: it honors
// `interactive-widget=resizes-content` (app/+html.tsx), so the window shrinks with the keyboard. What holds on Chrome and on
// Safari alike: a text field has the focus and the visual viewport is much shorter than it has been at this width.
//
// A gap under this many px is the URL bar, not a keyboard.
export const WEB_KEYBOARD_MIN_PX = 80;

// Chrome centers the focused field in its scroller right after the viewport settles (seen 13 ms after the last resize).
const SETTLE_MS = 600;
const FIELD_GAP = 8;
// The tap that takes the focus off the field is still on its way to its button: bringing the tab bar back at once moves Check
// out from under the finger and the tap is lost (seen on the emulator, it only closed the keyboard).
const LEFT_FIELD_MS = 300;

const listeners = new Set<() => void>();
let open = false;
let tallest = 0;
let width = 0;
let stopSettling: (() => void) | null = null;
let leftField: ReturnType<typeof setTimeout> | undefined;

function isTextField(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'submit'].includes((el as HTMLInputElement).type);
}

// Where the scroller's scrollTop has to be for the field to sit right above the docked bar: that shows the most of the card
// above the field, which is where the prompt the learner is translating is. A field too tall for the room keeps its top edge.
export function alignedScrollTop(
  scrollTop: number,
  field: { top: number; bottom: number },
  visible: { top: number; bottom: number },
): number {
  const bottomAligned = scrollTop + field.bottom + FIELD_GAP - visible.bottom;
  const topAligned = scrollTop + field.top - FIELD_GAP - visible.top;
  return Math.max(0, Math.min(bottomAligned, topAligned));
}

function closestScroller(el: Element): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

// Only a typed card: its Check bar (DockedAction, next to the scroller) is the one thing the learner needs below the field.
// A form like sign-in keeps the browser's own scrolling, it has buttons under the field.
function settleField() {
  stopSettling?.();
  stopSettling = null;
  const field = document.activeElement;
  if (!field || !isTextField(field)) return;
  const scroller = closestScroller(field);
  const dock = scroller?.parentElement?.querySelector('[data-testid="learn-dock"]');
  if (!scroller || !dock) return;

  const align = () => {
    const box = scroller.getBoundingClientRect();
    const visible = { top: box.top, bottom: Math.min(box.bottom, dock.getBoundingClientRect().top) };
    const next = alignedScrollTop(scroller.scrollTop, field.getBoundingClientRect(), visible);
    if (Math.abs(next - scroller.scrollTop) >= 1) scroller.scrollTop = next;
  };
  const frame = requestAnimationFrame(align);
  scroller.addEventListener('scroll', align);
  const timer = setTimeout(() => stopSettling?.(), SETTLE_MS);
  stopSettling = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    scroller.removeEventListener('scroll', align);
    stopSettling = null;
  };
}

function update() {
  const vv = window.visualViewport;
  if (!vv) return;
  // times the scale, so that a pinch zoom (a shorter visual viewport with no keyboard) does not read as a keyboard
  const height = vv.height * vv.scale;
  if (window.innerWidth !== width) {
    width = window.innerWidth;
    tallest = 0;
  }
  tallest = Math.max(tallest, height, window.innerHeight);
  const next = isTextField(document.activeElement) && tallest - height >= WEB_KEYBOARD_MIN_PX;
  if (next !== open) {
    open = next;
    listeners.forEach((fn) => fn());
  }
  if (open) settleField();
}

function onFocusChange() {
  clearTimeout(leftField);
  if (isTextField(document.activeElement)) update();
  else leftField = setTimeout(update, LEFT_FIELD_MS);
}

function subscribe(listener: () => void) {
  if (Platform.OS !== 'web' || !window.visualViewport) return () => {};
  const vv = window.visualViewport;
  if (listeners.size === 0) {
    vv.addEventListener('resize', update);
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);
    update();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    vv.removeEventListener('resize', update);
    document.removeEventListener('focusin', onFocusChange);
    document.removeEventListener('focusout', onFocusChange);
    clearTimeout(leftField);
    stopSettling?.();
    open = false;
    tallest = 0;
    width = 0;
  };
}

// A typed screen's container while the keyboard is open: the 20 px under the content only pushes the card away from Check.
export const WEB_TYPING_PADDING = { paddingTop: 8, paddingBottom: 0 };

// Whether a phone browser's keyboard is open. Always false in the phone app, whose keyboard has real events.
export function useWebKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
