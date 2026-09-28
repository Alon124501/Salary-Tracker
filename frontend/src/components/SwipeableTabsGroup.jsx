import { AnimatePresence } from 'motion/react';

export default function SwipeableTabsGroup({ children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {children}
    </AnimatePresence>
  );
}
