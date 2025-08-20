import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Dice6, Sparkles, Crown, Sword } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { debugLog, debugError } from '@/lib/debug';

interface PremiumHeroProps {
  onGetStarted?: () => void;
  onLearnMore?: () => void;
}

export function PremiumHero({ onGetStarted, onLearnMore }: PremiumHeroProps) {
  const navigate = useNavigate();
  
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-premium-pattern">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-1/4 top-1/4 size-32 rounded-full bg-primary/10 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 size-48 rounded-full bg-secondary-glow/10 blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Floating Dice Animation */}
      <div className="pointer-events-none absolute inset-0">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              rotate: [0, 180, 360],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 5,
            }}
          >
            <Dice6 className="size-8 text-primary/20" />
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="border-border-elevated mb-8 inline-flex items-center gap-2 rounded-full border bg-card-elevated/50 px-6 py-3 backdrop-blur-sm"
        >
          <Crown className="size-4 text-primary" />
          <span className="text-sm font-medium text-foreground-muted">
            Premium AI-Powered RPG Experience
          </span>
          <Sparkles className="size-4 animate-pulse text-primary" />
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-6 font-heading text-6xl font-bold leading-tight md:text-8xl"
        >
          <span className="text-gradient-primary">D&D Master</span>
          <br />
          <span className="text-foreground">Redefined</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mx-auto mb-12 max-w-3xl text-xl leading-relaxed text-foreground-muted md:text-2xl"
        >
          Experience the future of tabletop RPG with our premium AI Dungeon Master. 
          Create immersive campaigns, generate dynamic content, and collaborate with 
          players in a beautifully crafted digital realm.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button
            onClick={() => {
              debugLog('Begin Your Quest clicked - starting adventure');
              if (onGetStarted) {
                onGetStarted();
              } else {
                debugError('No onGetStarted handler provided');
              }
            }}
            className="group rounded-xl bg-gradient-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-lg"
          >
            <Sword className="mr-2 size-5 transition-transform group-hover:rotate-12" />
            Begin Your Quest
          </Button>
          
          <Button
            onClick={onLearnMore}
            variant="outline"
            className="border-border-elevated group rounded-xl bg-card/50 px-8 py-4 text-lg font-semibold backdrop-blur-sm transition-all duration-300 hover:bg-card-elevated"
          >
            <Sparkles className="mr-2 size-5 group-hover:animate-pulse" />
            Discover Features
          </Button>
        </motion.div>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {[
            {
              icon: <Dice6 className="size-8" />,
              title: "AI Dungeon Master",
              description: "Intelligent storytelling that adapts to your choices"
            },
            {
              icon: <Crown className="size-8" />,
              title: "Premium Design",
              description: "Luxury interface worthy of epic adventures"
            },
            {
              icon: <Sparkles className="size-8" />,
              title: "Real-time Magic",
              description: "Collaborative features that bring stories to life"
            }
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 + index * 0.1 }}
              className="bg-card-premium group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-elevated"
            >
              <div className="mb-4 text-primary transition-transform duration-300 group-hover:scale-110">
                {feature.icon}
              </div>
              <h3 className="mb-2 font-heading text-xl font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="leading-relaxed text-foreground-muted">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}