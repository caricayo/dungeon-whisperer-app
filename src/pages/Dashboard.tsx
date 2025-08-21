import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Star, Scroll } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useSessionManager } from '@/hooks/useSessionManager';
import DnDChatBot from '@/components/DnDChatBot';

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { clearAllSessions } = useSessionManager();

  // Developer reset hook: /maindashboard?reset=1
  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      clearAllSessions().finally(() => {
        navigate('/maindashboard', { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="min-h-screen bg-background"
      style={{
        background: `
          radial-gradient(circle at 25% 25%, hsl(270 50% 25% / 0.1) 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, hsl(45 100% 70% / 0.05) 0%, transparent 50%),
          linear-gradient(180deg, hsl(220 13% 6%), hsl(220 15% 4%))
        `,
        backgroundColor: 'hsl(220 13% 6%)' // Solid fallback
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      
      {/* Animated floating elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute size-32 rounded-full bg-primary/5 blur-3xl"
            style={{
              left: `${20 + i * 30}%`,
              top: `${10 + i * 20}%`,
            }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.1, 0.3, 0.1],
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 15 + i * 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Quick Access Buttons */}
      {user && (
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <Button
            onClick={() => navigate('/sessions?source=dashboard')}
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur-sm"
          >
            <Scroll className="mr-2 size-4" />
            All Adventures
          </Button>
          <Button
            onClick={() => navigate('/sessions?tab=multiplayer&source=dashboard')}
            size="sm"
            className="bg-gradient-to-r from-primary/90 to-accent/90 backdrop-blur-sm hover:from-primary hover:to-accent"
          >
            <Star className="mr-2 size-4" />
            Multiplayer Adventures
          </Button>
        </div>
      )}

      <DnDChatBot />
    </motion.div>
  );
};

export default Dashboard;
