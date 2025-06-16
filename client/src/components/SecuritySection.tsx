import { useUser, useClerk } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function SecuritySection() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation don't match",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long",
        variant: "destructive"
      });
      return;
    }

    try {
      await user?.updatePassword({ currentPassword, newPassword });
      toast({
        title: "Password updated",
        description: "Your password has been successfully changed",
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (error) {
      toast({
        title: "Password change failed",
        description: "Please check your current password and try again",
        variant: "destructive"
      });
    }
  };

  const handleEnable2FA = async () => {
    try {
      // Redirect to Clerk's 2FA setup
      window.open(`${user?.id}/two-factor`, '_blank');
    } catch (error) {
      toast({
        title: "2FA setup failed",
        description: "Unable to open 2FA setup. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Password Section */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-sm">Password</h4>
            <p className="text-sm text-muted-foreground">Change your account password</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChangingPassword(!isChangingPassword)}
          >
            {isChangingPassword ? 'Cancel' : 'Change Password'}
          </Button>
        </div>

        {isChangingPassword && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 gap-4 max-w-md">
              <div>
                <Label htmlFor="current-password" className="text-sm">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="new-password" className="text-sm">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-sm">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Button onClick={handlePasswordChange} size="sm" className="w-fit">
                Update Password
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">Two-Factor Authentication</h4>
            <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnable2FA}
          >
            Setup 2FA
          </Button>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">Connected Accounts</h4>
            <p className="text-sm text-muted-foreground">Manage your connected social accounts</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/user-profile#/security', '_blank')}
          >
            Manage Accounts
          </Button>
        </div>
      </div>

      {/* Session Management */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">Active Sessions</h4>
            <p className="text-sm text-muted-foreground">View and manage your active sessions</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut()}
          >
            Sign Out All Devices
          </Button>
        </div>
      </div>
    </div>
  );
}