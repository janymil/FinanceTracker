import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { ArrowLeft, Users, Target, Calendar, Plus, DollarSign, Activity, Trophy, Mail } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export default function CollaborativeGoalDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [goal, setGoal] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isContributionPending, setIsContributionPending] = useState(false);
  const [isInvitePending, setIsInvitePending] = useState(false);

  const { user, isReady, getAuthHeaders } = useClerkUserReady();

  const fetchGoal = async () => {
    if (!isReady || !user?.id || !id) return;
    
    try {
      setIsLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/collaborative-goals/${id}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setGoal(data);
      }
    } catch (error) {
      console.error('Error fetching goal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isReady && user?.id) {
      fetchGoal();
    }
  }, [isReady, user?.id, id]);

  const addContribution = async (data: { amount: string; note: string }) => {
    try {
      setIsContributionPending(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/collaborative-goals/${id}/contributions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        fetchGoal(); // Refresh goal data
        setContributionAmount("");
        setContributionNote("");
        toast({
          title: t('collaborative_goal_detail.messages.contribution_added'),
          description: t('collaborative_goal_detail.messages.contribution_success'),
        });
      }
    } catch (error) {
      toast({
        title: t('collaborative_goal_detail.messages.error'),
        description: t('collaborative_goal_detail.messages.contribution_failed'),
        variant: "destructive",
      });
    } finally {
      setIsContributionPending(false);
    }
  };

  const inviteFriend = async (email: string) => {
    try {
      setIsInvitePending(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/collaborative-goals/${id}/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setInviteEmail("");
        if (result.existingUser) {
          toast({
            title: t('collaborative_goal_detail.messages.friend_added'),
            description: t('collaborative_goal_detail.messages.friend_added_description', { email: result.email }),
          });
        } else {
          toast({
            title: t('collaborative_goal_detail.messages.invitation_sent'),
            description: t('collaborative_goal_detail.messages.invitation_sent_description', { email: result.email }),
          });
        }
        fetchGoal(); // Refresh goal data
      }
    } catch (error: any) {
      toast({
        title: t('collaborative_goal_detail.messages.error'),
        description: error.message || t('collaborative_goal_detail.messages.invitation_failed'),
        variant: "destructive",
      });
    } finally {
      setIsInvitePending(false);
    }
  };

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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('collaborative_goal_detail.errors.goal_not_found')}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{t('collaborative_goal_detail.errors.goal_not_found_description')}</p>
        <Link href="/collaborative-goals">
          <Button>{t('collaborative_goal_detail.buttons.back_to_goals')}</Button>
        </Link>
      </div>
    );
  }

  const currentAmount = parseFloat(goal?.currentAmount || '0');
  const targetAmount = parseFloat(goal?.targetAmount || '0');
  const progressPercentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
  const daysRemaining = goal?.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      toast({
        title: t('collaborative_goal_detail.messages.invalid_amount'),
        description: t('collaborative_goal_detail.messages.invalid_amount_description'),
        variant: "destructive",
      });
      return;
    }
    addContribution({
      amount: contributionAmount,
      note: contributionNote,
    });
  };

  const handleInviteFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({
        title: t('collaborative_goal_detail.messages.invalid_email'),
        description: t('collaborative_goal_detail.messages.invalid_email_description'),
        variant: "destructive",
      });
      return;
    }
    inviteFriend(inviteEmail);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/collaborative-goals">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('collaborative_goal_detail.buttons.back')}
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{goal?.name || 'Loading...'}</h1>
            <p className="text-gray-600 dark:text-gray-400">{goal?.description || ''}</p>
          </div>
        </div>
        <Badge variant={goal?.status === 'active' ? 'default' : 'secondary'}>
          {t(`collaborative_goal_detail.statuses.${goal?.status || 'unknown'}`)}
        </Badge>
      </div>

      {/* Goal Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('collaborative_goal_detail.cards.progress')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{t('collaborative_goal_detail.cards.of')} ${targetAmount.toLocaleString()}</p>
            <Progress value={progressPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('collaborative_goal_detail.cards.participants')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goal?.participants?.length || 0}</div>
            <p className="text-xs text-muted-foreground">{t('collaborative_goal_detail.cards.active_members')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('collaborative_goal_detail.cards.days_remaining')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{daysRemaining > 0 ? daysRemaining : 0}</div>
            <p className="text-xs text-muted-foreground">{t('collaborative_goal_detail.cards.until')} {goal?.targetDate ? format(new Date(goal.targetDate), 'MMM dd, yyyy') : t('collaborative_goal_detail.cards.no_date_set')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('collaborative_goal_detail.cards.category')}</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">{goal?.category || t('collaborative_goal_detail.cards.general')}</div>
            <p className="text-xs text-muted-foreground">{t('collaborative_goal_detail.cards.goal_type')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Contribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              {t('collaborative_goal_detail.forms.add_contribution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddContribution} className="space-y-4">
              <div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={t('collaborative_goal_detail.forms.amount_placeholder')}
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Textarea
                  placeholder={t('collaborative_goal_detail.forms.note_placeholder')}
                  value={contributionNote}
                  onChange={(e) => setContributionNote(e.target.value)}
                  rows={3}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isContributionPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isContributionPending ? t('collaborative_goal_detail.forms.adding') : t('collaborative_goal_detail.forms.add_contribution_button')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Invite Friends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              {t('collaborative_goal_detail.forms.invite_friends')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInviteFriend} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder={t('collaborative_goal_detail.forms.email_placeholder')}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isInvitePending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {isInvitePending ? t('collaborative_goal_detail.forms.sending') : t('collaborative_goal_detail.forms.send_invitation')}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              {t('collaborative_goal_detail.forms.invite_description')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            {t('collaborative_goal_detail.participants.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goal?.participants?.length > 0 ? (
              goal.participants.map((participant: any) => (
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
              ))
            ) : (
              <div className="col-span-full text-center text-muted-foreground py-8">
                {t('collaborative_goal_detail.participants.no_participants')}
              </div>
            )}
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
                        {contribution.createdAt ? format(new Date(contribution.createdAt), 'MMM dd, yyyy') : 'No date'}
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
                      {activity.createdAt ? format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm') : 'No date'}
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