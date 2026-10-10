import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion, useDragControls } from 'motion/react';
import { slideDirectionForIndexDelta, dragToIndexDelta } from '../utils/rtlSwipe.js';

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 48 : direction < 0 ? -48 : 0, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -48 : direction < 0 ? 48 : 0, opacity: 0 }),
};

const reducedVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

// True when the pointer went down inside a horizontally scrollable element
// (e.g. a wide table) between the target and the panel itself.
function isInHorizontalScroller(target, panel) {
  for (let el = target; el && el !== panel; el = el.parentElement) {
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true;
  }
  return false;
}

// Drives both tap-triggered tab switches (arbitrary index jump) and
// drag-to-swipe (always adjacent, clamped, no wraparound) through the same
// activeKey diff, so slide direction is computed identically either way.
export function useSwipeableTabs({ tabKeys, activeKey, onSwipe }) {
  const reducedMotion = useReducedMotion();
  const prevIndexRef = useRef(tabKeys.indexOf(activeKey));
  const [direction, setDirection] = useState(0);
  const dragControls = useDragControls();

  useLayoutEffect(() => {
    const newIndex = tabKeys.indexOf(activeKey);
    const prevIndex = prevIndexRef.current;
    if (newIndex !== prevIndex) {
      setDirection(slideDirectionForIndexDelta(newIndex - prevIndex));
      prevIndexRef.current = newIndex;
    }
  }, [activeKey, tabKeys]);

  function handleDragEnd(_event, { offset, velocity }) {
    const delta = dragToIndexDelta(offset.x, velocity.x);
    if (!delta) return;
    const currentIndex = tabKeys.indexOf(activeKey);
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), tabKeys.length - 1);
    if (nextIndex !== currentIndex) onSwipe(tabKeys[nextIndex]);
  }

  const panelMotionProps = {
    custom: direction,
    variants: reducedMotion ? reducedVariants : slideVariants,
    initial: 'enter',
    animate: 'center',
    exit: 'exit',
    transition: reducedMotion
      ? { duration: 0.1 }
      : { x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } },
    ...(reducedMotion
      ? {}
      : {
          drag: 'x',
          dragConstraints: { left: 0, right: 0 },
          dragElastic: 0.15,
          dragMomentum: false,
          onDragEnd: handleDragEnd,
          // Drag is started manually so a pan that begins inside a nested
          // horizontal scroller scrolls it instead of swiping the tab
          // (otherwise touch devices can't scroll wide tables at all).
          dragControls,
          dragListener: false,
          onPointerDown: e => {
            if (!isInHorizontalScroller(e.target, e.currentTarget)) dragControls.start(e);
          },
        }),
  };

  return { direction, panelMotionProps };
}
