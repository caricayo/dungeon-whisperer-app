import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTypingIndicators } from '@/hooks/useTypingIndicators';
import { getDisplayName } from '@/lib/displayNameResolver';

interface TypingIndicatorProps {
  sessionId: string | null;
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  sessionId,
  className = "" 
}) => {
  const { typingUsers } = useTypingIndicators(sessionId);

  if (typingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      const user = typingUsers[0];
      const displayName = getDisplayName({
        id: user.id,
        username: user.username,
        display_name: user.display_name
      });
      return `${displayName} is typing...`;
    } else if (typingUsers.length === 2) {
      const names = typingUsers.map(u => getDisplayName({
        id: u.id,
        username: u.username,
        display_name: u.display_name
      }));
      return `${names[0]} and ${names[1]} are typing...`;
    } else {
      return `${typingUsers.length} people are typing...`;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground ${className}`}
      >
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="size-1.5 rounded-full bg-primary"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
        <span>{getTypingText()}</span>
      </motion.div>
    </AnimatePresence>
  );
};