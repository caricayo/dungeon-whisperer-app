/**
 * @fileoverview Loading indicator for chat messages
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot } from 'lucide-react';

export const LoadingIndicator = memo(() => {
  return (
    <div className="flex gap-3 px-4 py-2">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback>
          <Bot className="size-4" />
        </AvatarFallback>
      </Avatar>
      
      <div className="rounded-lg bg-muted p-3">
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="size-2 rounded-full bg-muted-foreground"
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

LoadingIndicator.displayName = 'LoadingIndicator';