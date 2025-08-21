/**
 * @fileoverview Voice settings component for TTS configuration
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { settingsService } from '@/lib/settings';
import { ttsService } from '@/lib/tts';
import { debugError } from '@/lib/debug';
import { Volume2, Play, Loader2, CheckCircle, Gauge } from 'lucide-react';

export const VoiceSettings: React.FC = () => {
  const { toast } = useToast();
  const [currentVoice, setCurrentVoice] = useState<string>('');
  const [currentProvider, setCurrentProvider] = useState<string>('elevenlabs');
  const [currentSpeed, setCurrentSpeed] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testComplete, setTestComplete] = useState(false);

  const availableVoices = ttsService.getAvailableVoices();

  // Load current voice settings
  useEffect(() => {
    const loadVoiceSettings = async () => {
      setIsLoading(true);
      try {
        const settings = await settingsService.getVoiceSettings();
        if (settings) {
          setCurrentVoice(settings.voiceId);
          setCurrentProvider(settings.provider);
          setCurrentSpeed(settings.speed);
        } else {
          // Set defaults
          setCurrentVoice('BNgbHR0DNeZixGQVzloa'); // Your Voice
          setCurrentProvider('elevenlabs');
          setCurrentSpeed(1.0);
        }
      } catch {
        debugError('Error loading voice settings:');
      } finally {
        setIsLoading(false);
      }
    };

    loadVoiceSettings();
  }, []);

  const handleSaveVoiceSettings = async () => {
    if (!currentVoice || !currentProvider) {
      toast({
        title: "Invalid Selection",
        description: "Please select both a voice and provider.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await settingsService.saveVoiceSettings(
        currentVoice, 
        currentProvider as 'elevenlabs' | 'openai' | 'auto',
        currentSpeed
      );
      
      toast({
        title: "Voice Settings Saved",
        description: "Your TTS voice and speed preferences have been updated.",
      });
    } catch {
      debugError('Error saving voice settings:');
      toast({
        title: "Save Error",
        description: "Failed to save voice settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestVoice = async () => {
    if (!currentVoice) {
      toast({
        title: "No Voice Selected",
        description: "Please select a voice to test.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestComplete(false);
    
    try {
      const testText = "Hello! This is how your chosen voice will sound in your D&D adventures.";
      
      const audioUrl = await ttsService.generateSpeech(testText, {
        voice: currentVoice,
        provider: currentProvider as 'elevenlabs' | 'openai' | 'auto',
        speed: currentSpeed
      });
      
      await ttsService.play(audioUrl, currentSpeed);
      
      setTestComplete(true);
      setTimeout(() => setTestComplete(false), 3000);
      
    } catch {
      debugError('Error testing voice:');
      toast({
        title: "Test Failed",
        description: "Could not test the selected voice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getVoiceName = (voiceId: string): string => {
    for (const [name, id] of Object.entries(availableVoices.elevenlabs)) {
      if (id === voiceId) return name;
    }
    return voiceId;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="size-5" />
          Voice Settings
        </CardTitle>
        <CardDescription>
          Configure your preferred text-to-speech voice for D&D narration
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">TTS Provider</label>
          <Select
            value={currentProvider}
            onValueChange={setCurrentProvider}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="elevenlabs">
                ElevenLabs (Premium Quality)
                <Badge variant="secondary" className="ml-2">Recommended</Badge>
              </SelectItem>
              <SelectItem value="openai">OpenAI (Good Quality)</SelectItem>
              <SelectItem value="auto">Auto (Try ElevenLabs, fallback to OpenAI)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Voice Selection */}
        {currentProvider === 'elevenlabs' || currentProvider === 'auto' ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">ElevenLabs Voice</label>
            <Select
              value={currentVoice}
              onValueChange={setCurrentVoice}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(availableVoices.elevenlabs).map(([name, id]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                    {name === 'Your Voice' && (
                      <Badge variant="outline" className="ml-2">Custom</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium">OpenAI Voice</label>
            <Select
              value={currentVoice}
              onValueChange={setCurrentVoice}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.openai.map((voice) => (
                  <SelectItem key={voice} value={voice}>
                    {voice.charAt(0).toUpperCase() + voice.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Speed Control */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Speech Speed</label>
            <Gauge className="size-4" />
          </div>
          <div className="space-y-3">
            <Slider
              value={[currentSpeed]}
              onValueChange={(value) => setCurrentSpeed(value[0])}
              min={0.5}
              max={2.0}
              step={0.1}
              disabled={isLoading}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5x (Slow)</span>
              <span className="font-medium">
                {currentSpeed.toFixed(1)}x
              </span>
              <span>2.0x (Fast)</span>
            </div>
          </div>
        </div>

        {/* Current Selection Display */}
        {currentVoice && (
          <Alert>
            <Volume2 className="size-4" />
            <AlertDescription>
              <strong>Selected Voice:</strong> {getVoiceName(currentVoice)} ({currentProvider}) at {currentSpeed.toFixed(1)}x speed
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleTestVoice}
            variant="outline"
            disabled={!currentVoice || isTesting || isLoading}
            className="flex-1"
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Testing...
              </>
            ) : testComplete ? (
              <>
                <CheckCircle className="mr-2 size-4 text-green-500" />
                Test Complete
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" />
                Test Voice
              </>
            )}
          </Button>
          
          <Button
            onClick={handleSaveVoiceSettings}
            disabled={!currentVoice || isLoading || isTesting}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};