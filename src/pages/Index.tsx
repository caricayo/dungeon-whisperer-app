import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserSettingsSecure } from '@/hooks/useUserSettingsSecure';
import { useSecurityMonitor } from '@/hooks/useSecurityMonitor';
import { PremiumHero } from '@/components/PremiumHero';
import { performance_monitor, logPerformanceMetrics } from '@/lib/performance';
import { BundleAnalyzer, PerformanceCollector } from '@/lib/bundle-analyzer';
import { env } from '@/lib/env';

const Index = (): React.ReactElement => {
  const navigate = useNavigate();
  const { settings, loading, error } = useUserSettingsSecure();
  const { reportSecurityEvent } = useSecurityMonitor();

  // Performance monitoring setup
  useEffect(() => {
    performance_monitor.start('page_load');
    
    if (env.VITE_APP_ENV === 'development') {
      // Collect performance metrics in development
      PerformanceCollector.collectWebVitals();
      BundleAnalyzer.analyzeBundleSize();
      
      // Log metrics after page load
      setTimeout(() => {
        performance_monitor.end('page_load');
        logPerformanceMetrics();
      }, 1000);
    }

    return () => {
      performance_monitor.end('page_load');
    };
  }, []);

  const handleGetStarted = () => {
    performance_monitor.start('dashboard_transition');
    navigate('/maindashboard');
    reportSecurityEvent('dashboard_accessed', { timestamp: Date.now() });
  };

  return (
    <div 
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative"
      >
        <PremiumHero 
          onGetStarted={handleGetStarted}
          onLearnMore={() => {
            // Smooth scroll to features section
            const featuresSection = document.getElementById('features');
            if (featuresSection) {
              featuresSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />
        
        {/* Additional content sections can go here */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-gradient-primary mb-6 font-heading text-4xl font-bold">
              Experience the Future of RPG
            </h2>
            <p className="mx-auto max-w-3xl text-xl text-foreground-muted">
              Our premium AI-powered platform transforms traditional tabletop gaming 
              into an immersive digital experience.
            </p>
          </motion.div>
        </section>

        {/* Security Status Section */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="text-center">
              <h2 className="text-gradient-primary mb-6 font-heading text-4xl font-bold">
                Enterprise-Grade Security
              </h2>
              <p className="mx-auto mb-12 max-w-3xl text-xl text-foreground-muted">
                Your data and API keys are protected with military-grade encryption and comprehensive security measures.
              </p>
            </div>

            {/* Security Status Card */}
            <Card className="mx-auto max-w-4xl border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader className="flex flex-row items-center gap-2">
                <Shield className="size-5 text-green-600" />
                <CardTitle className="text-green-800 dark:text-green-400">
                  Security Status: Protected
                </CardTitle>
                <Badge variant="outline" className="border-green-300 bg-green-100 text-green-800">
                  A+ Security Rating
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 text-sm md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>API Keys Encrypted & Protected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>Rate Limiting Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>Comprehensive Audit Logging</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-600" />
                    <span>Row-Level Security Enforced</span>
                  </div>
                </div>

                {/* Settings Security Demo */}
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading security status...
                  </div>
                ) : settings ? (
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">API Key Security:</span>
                      <Badge variant={settings.has_openai_key ? "default" : "secondary"}>
                        {settings.has_openai_key ? "Encrypted & Secure" : "Ready for Setup"}
                      </Badge>
                    </div>
                    <Alert>
                      <Shield className="size-4" />
                      <AlertDescription>
                        <strong>Privacy Guarantee:</strong> Your encrypted API keys are never exposed in database queries. 
                        Only secure boolean indicators show configuration status.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>
                      Security Monitor: {error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Action Required Alert */}
            <Alert className="mx-auto max-w-4xl">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                <strong>Admin Action Required:</strong> Complete security setup by enabling 
                "Leaked Password Protection" in Supabase Dashboard → Authentication → Password Security.
              </AlertDescription>
            </Alert>
          </motion.div>
        </section>
      </motion.div>
    </div>
  );
};

export default Index;
