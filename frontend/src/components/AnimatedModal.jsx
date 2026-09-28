import { useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

export default function AnimatedModal({ open, children, onBackdropClick, zIndex = 40, backdropClassName = 'bg-black/40' }) {
  const reducedMotion = useReducedMotion();
  // Caller gates `children` on the same state as `open`, so by the render
  // where `open` flips false, `children` is already null — cache the last
  // real content so it can keep rendering through the exit animation.
  const cachedChildren = useRef(children);
  if (open && children != null) cachedChildren.current = children;

  const cardVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, scale: 0.95, y: 8 }, visible: { opacity: 1, scale: 1, y: 0 } };
  const transition = { duration: reducedMotion ? 0.1 : 0.18 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 ${backdropClassName} flex items-center justify-center p-4`}
          style={{ zIndex }}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={transition}
          onClick={onBackdropClick ? (e => { if (e.target === e.currentTarget) onBackdropClick(); }) : undefined}
        >
          <motion.div variants={cardVariants} initial="hidden" animate="visible" exit="hidden" transition={transition}>
            {cachedChildren.current}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
