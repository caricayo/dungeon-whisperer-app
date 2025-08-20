import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SystemStatus } from '@/components/SystemStatus';
import { UsageTracker } from '@/components/UsageTracker';
import { VoiceSettings } from '@/components/VoiceSettings';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity, TrendingUp, Volume2, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUserSettings } from '@/hooks/useUserSettings';

const Settings = () => {
  const navigate = useNavigate();
  const { settings, updateSetting, isLoading } = useUserSettings();

  const handleRetryFailed = () => {
    // Retry failed operations (would implement actual retry logic here)
  };

  const handleUsageWarning = (service: string, usage: number) => {
    // Handle usage warning (would implement actual warning handling here)
    // Service: ${service}, Usage: ${usage}%
  };

  return (
    <div className="min-h-screen space-y-6 bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/maindashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="size-4" />
            Back to Main
          </Button>
          <div>
            <h1 className="text-gradient-primary text-3xl font-bold">Settings</h1>
            <p className="text-foreground-muted">Manage your preferences and monitor system status</p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="system" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Activity className="size-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <TrendingUp className="size-4" />
            API Usage
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Volume2 className="size-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <BookOpen className="size-4" />
            Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <SystemStatus onRetry={handleRetryFailed} />
          </motion.div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <UsageTracker onLimitWarning={handleUsageWarning} />
          </motion.div>
        </TabsContent>

        <TabsContent value="voice" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="size-5" />
                  Voice Settings
                </CardTitle>
                <CardDescription>
                  Configure your text-to-speech preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VoiceSettings />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5" />
                  Documentation Settings
                </CardTitle>
                <CardDescription>
                  Configure Context7 documentation assistance and other help features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="context7-enabled">Context7 Documentation Suggestions</Label>
                    <p className="text-sm text-muted-foreground">
                      Show smart documentation links when technical terms are detected in your messages
                    </p>
                  </div>
                  <Switch
                    id="context7-enabled"
                    checked={settings.context7Enabled}
                    onCheckedChange={(checked) => updateSetting('context7Enabled', checked)}
                    disabled={isLoading}
                  />
                </div>
                
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="mb-2 text-sm font-medium">How Context7 Works</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Automatically detects technical terms in your messages</li>
                    <li>• Shows contextual documentation links to Context7.com</li>
                    <li>• Provides up-to-date AI development resources</li>
                    <li>• Works with React, TypeScript, Supabase, and more</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open('https://context7.com', '_blank')}
                  >
                    Visit Context7
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open('/docs/CONTEXT7.md', '_blank')}
                  >
                    View Integration Guide
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;