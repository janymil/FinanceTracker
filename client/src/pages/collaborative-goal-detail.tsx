import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Users, Target, Calendar, Plus, DollarSign, Activity, Trophy, Mail } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function CollaborativeGoalDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: goal, isLoading } = useQuery({
    queryKey: ['/api/collaborative-goals', id],
    enabled: !!id,
  });

  const addContributionMutation = useMutation({
    mutationFn: async (data: { amount: string; note: string }) => {
      return apiRequest('POST', `/api/collaborative-goals/${id}/contributions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaborative-goals', id] });
      setContributionAmount("");
      setContributionNote("");
      toast({
        title: "Contribution Added",
        description: "Your contribution has been recorded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add contribution. Please try again.",
        variant: "destructive",
      });
    },
  });

  const inviteFriendMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('POST', `/api/collaborative-goals/${id}/invite`, { email });
    },
    onSuccess: (response) => {
      setInviteEmail("");
      if (response.existingUser) {
        toast({
          title: "Friend Added",
          description: `${response.email} has been added to the goal.`,
        });
      } else {
        toast({
          title: "Invitation Sent",
          description: `An invitation email has been sent to ${response.email}.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/collaborative-goals', id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Goal Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">The collaborative goal you're looking for doesn't exist.</p>
        <Link href="/collaborative-goals">
          <Button>Back to Collaborative Goals</Button>
        </Link>
      </div>
    );
  }

  const currentAmount = parseFloat(goal.currentAmount);
  const targetAmount = parseFloat(goal.targetAmount);
  const progressPercentage = (currentAmount / targetAmount) * 100;
  const daysRemaining = Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid contribution amount.",
        variant: "destructive",
      });
      return;
    }
    addContributionMutation.mutate({
      amount: contributionAmount,
      note: contributionNote,
    });
  };

  const handleInviteFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    inviteFriendMutation.mutate(inviteEmail);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/collaborative-goals">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{goal.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">{goal.description}</p>
          </div>
        </div>
        <Badge variant={goal.status === 'active' ? 'default' : 'secondary'}>
          {goal.status}
        </Badge>
      </div>

      {/* Goal Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">of ${targetAmount.toLocaleString()}</p>
            <Progress value={progressPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goal.participants.length}</div>
            <p className="text-xs text-muted-foreground">Active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysRemaining > 0 ? daysRemaining : 0}</div>
            <p className="text-xs text-muted-foreground">Until {format(new Date(goal.targetDate), 'MMM dd, yyyy')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Category</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">{goal.category}</div>
            <p className="text-xs text-muted-foreground">Goal type</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Contribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Add Contribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddContribution} className="space-y-4">
              <div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Amount ($)"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Textarea
                  placeholder="Optional note..."
                  value={contributionNote}
                  onChange={(e) => setContributionNote(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={addContributionMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                {addContributionMutation.isPending ? 'Adding...' : 'Add Contribution'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Invite Friends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Invite Friends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInviteFriend} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Friend's email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={inviteFriendMutation.isPending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {inviteFriendMutation.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              We'll automatically detect if they have an account or send them an invitation to join.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Participants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goal.participants.map((participant: any) => (
              <div key={participant.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                <Avatar>
                  <AvatarImage src={participant.user?.profileImageUrl || ''} />
                  <AvatarFallback>
                    {participant.user?.firstName?.[0] || '?'}{participant.user?.lastName?.[0] || ''}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {participant.user?.firstName} {participant.user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{participant.user?.email}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {participant.role}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Contributions */}
      {goal.contributions && goal.contributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Recent Contributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goal.contributions.slice(0, 10).map((contribution: any) => (
                <div key={contribution.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contribution.user?.profileImageUrl || ''} />
                      <AvatarFallback className="text-xs">
                        {contribution.user?.firstName?.[0] || '?'}{contribution.user?.lastName?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {contribution.user?.firstName} {contribution.user?.lastName}
                      </p>
                      {contribution.note && (
                        <p className="text-xs text-muted-foreground">{contribution.note}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(contribution.createdAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">+${parseFloat(contribution.amount).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activities */}
      {goal.activities && goal.activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goal.activities.slice(0, 10).map((activity: any) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={activity.user?.profileImageUrl || ''} />
                    <AvatarFallback className="text-xs">
                      {activity.user?.firstName?.[0] || '?'}{activity.user?.lastName?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  {activity.amount && (
                    <div className="text-right">
                      <Badge variant="outline">${parseFloat(activity.amount).toLocaleString()}</Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}