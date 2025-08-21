import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Info, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface GenerationLogsProps {
  logs: LogEntry[];
  isVisible: boolean;
  className?: string;
}

export function GenerationLogs({ logs, isVisible, className = '' }: GenerationLogsProps) {
  if (!isVisible) return null;

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="size-4 text-destructive" />;
      case 'success':
        return <CheckCircle className="size-4 text-success" />;
      default:
        return <Info className="size-4 text-info" />;
    }
  };

  const getLogVariant = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'success':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`${className}`}
    >
      <Card className="border border-border-elevated bg-card-premium shadow-premium backdrop-blur-sm">
        <div className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h3 className="text-gradient-primary font-heading font-semibold">Generation Logs</h3>
            <Badge variant="outline" className="text-xs">
              {logs.length} entries
            </Badge>
          </div>
          
          <ScrollArea className="h-64 w-full">
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {logs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-8 text-center text-muted-foreground"
                  >
                    <Info className="mx-auto mb-2 size-8 opacity-50" />
                    <p>No generation logs yet</p>
                    <p className="text-xs">Logs will appear when you generate content</p>
                  </motion.div>
                ) : (
                  logs.slice().reverse().map((log, _index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className="flex items-start gap-3 rounded-lg border border-border-elevated/50 bg-muted/20 p-3"
                    >
                      <div className="mt-0.5 shrink-0">
                        {getLogIcon(log.type)}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant={getLogVariant(log.type)} className="text-xs">
                            {log.type.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <p className="break-words text-sm text-foreground">
                          {log.message}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      </Card>
    </motion.div>
  );
}