import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Check, X } from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface UsernameSetupModalProps {
  isOpen: boolean;
}

export const UsernameSetupModal = ({ isOpen }: UsernameSetupModalProps) => {
  const { checkUsernameAvailability, createProfile, isLoading } = useUserProfile();
  
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'none' | 'checking' | 'available' | 'taken'>('none');
  const [error, setError] = useState('');
  
  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setUsername('');
      setDisplayName('');
      setUsernameStatus('none');
      setError('');
      setIsChecking(false);
    }
  }, [isOpen]);

  const validateUsername = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 3) return false;
    if (trimmed.length > 20) return false;
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return false;
    return true;
  };

  const handleUsernameChange = async (value: string) => {
    setUsername(value);
    setError('');
    
    if (!validateUsername(value)) {
      setUsernameStatus('none');
      if (value.trim()) {
        setError('Username must be 3-20 characters and contain only letters, numbers, and underscores');
      }
      return;
    }

    setIsChecking(true);
    setUsernameStatus('checking');
    
    try {
      const isAvailable = await checkUsernameAvailability(value);
      setUsernameStatus(isAvailable ? 'available' : 'taken');
      if (!isAvailable) {
        setError('This username is already taken');
      }
    } catch (error) {
      setUsernameStatus('none');
      setError('Error checking username availability');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (usernameStatus !== 'available') return;

    const success = await createProfile(username, displayName || undefined);
    // The modal will automatically close when needsUsername becomes false in the parent component
  };

  const getUsernameIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
      case 'available':
        return <Check className="size-4 text-green-500" />;
      case 'taken':
        return <X className="size-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} modal={true} onOpenChange={undefined}>
      <DialogContent className="sm:max-w-[425px]" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set Your Username</DialogTitle>
          <DialogDescription>
            Create a unique username to connect with other adventurers. Choose wisely - this represents you in the world!
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username *</Label>
              <div className="relative">
                <Input
                  id="username"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`pr-10 ${
                    usernameStatus === 'available' ? 'border-green-500' : 
                    usernameStatus === 'taken' ? 'border-red-500' : ''
                  }`}
                  disabled={isLoading}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {getUsernameIcon()}
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                3-20 characters, letters, numbers, and underscores only
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name (Optional)</Label>
              <Input
                id="displayName"
                placeholder="Your Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                This is what others will see in game sessions
              </p>
            </div>
          </div>
          
          {usernameStatus === 'available' && (
            <Alert className="mb-4">
              <Check className="size-4" />
              <AlertDescription>
                Great! "{username}" is available.
              </AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button 
              type="submit" 
              disabled={usernameStatus !== 'available' || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating Profile...
                </>
              ) : (
                'Create Profile'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};