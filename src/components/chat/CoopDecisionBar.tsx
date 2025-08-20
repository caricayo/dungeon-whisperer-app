import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { useCoopDecision } from '@/hooks/useCoopDecision';

interface CoopDecisionBarProps {
  sessionId: string;
  onSendCombined: (content: string) => Promise<void>;
}

export const CoopDecisionBar = memo(({ sessionId, onSendCombined }: CoopDecisionBarProps) => {
  const {
    myAction,
    isReady,
    peers,
    everyoneReady,
    combinedPrompt,
    setAction,
    toggleReady,
    reset,
  } = useCoopDecision(sessionId);

  const handleSend = async () => {
    if (!combinedPrompt) return;
    await onSendCombined(combinedPrompt);
    reset();
  };

  return (
    <div className="border-b border-border bg-card/40">
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Party Planning</div>
          {everyoneReady && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Ready to send
            </Badge>
          )}
        </div>

        {/* My intent */}
        <div className="flex items-start gap-2">
          <Textarea
            value={myAction}
            onChange={(e) => setAction(e.target.value)}
            placeholder="What will you do this turn? (e.g., Retreat, Fight, Cast a spell)"
            className="min-h-[60px] text-sm"
          />
          <Button
            variant={isReady ? 'default' : 'outline'}
            onClick={toggleReady}
            className="whitespace-nowrap"
          >
            {isReady ? 'Ready' : 'Mark Ready'}
          </Button>
        </div>

        {/* Peers list */}
        {peers.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {peers.map((p) => (
              <Badge key={p.user_id} variant={p.ready ? 'default' : 'outline'}>
                {p.username}: {p.action ? `"${p.action}"` : '…'}
              </Badge>
            ))}
          </div>
        )}

        {/* Combined prompt */}
        {combinedPrompt && (
          <Card className="bg-muted/30">
            <CardContent className="space-y-2 p-3">
              <div className="text-xs font-medium text-muted-foreground">Combined party action</div>
              <Textarea value={combinedPrompt} readOnly className="min-h-[80px] text-sm" />
              <div className="flex justify-end">
                <Button onClick={handleSend} disabled={!everyoneReady}>Send to DM</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
});

CoopDecisionBar.displayName = 'CoopDecisionBar';
