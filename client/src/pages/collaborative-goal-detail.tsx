import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { ArrowLeft, Users, Target, Calendar, Plus, DollarSign, Activity, Trophy, Mail, Share2, Heart, MapPin, Gift, Sparkles, TrendingUp, Clock, MessageCircle, Send } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

// Goal categories with their specific details
const GOAL_CATEGORIES = {
  vacation: {
    icon: MapPin,
    color: "bg-blue-500",
    fields: ["destination", "duration", "activities", "accommodation"]
  },
  wedding: {
    icon: Heart,
    color: "bg-pink-500", 
    fields: ["venue", "date", "guestCount", "style"]
  },
  home: {
    icon: Gift,
    color: "bg-green-500",
    fields: ["propertyType", "location", "features", "timeline"]
  },
  education: {
    icon: Sparkles,
    color: "bg-purple-500",
    fields: ["course", "institution", "duration", "certification"]
  },
  emergency: {
    icon: Target,
    color: "bg-red-500",
    fields: ["purpose", "coverage", "timeline"]
  },
  investment: {
    icon: TrendingUp,
    color: "bg-indigo-500",
    fields: ["investmentType", "riskLevel", "expectedReturn", "timeline"]
  }
};

interface Goal {
  id: number;
  name: string;
  description: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  category: string;
  status: string;
  createdBy: string;
  isPublic: boolean;
  goalDetails?: any;
  coverImage?: string;
  participants: Array<{
    id: number;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    currentContribution: string;
    joinedAt: string;
  }>;
  contributions: Array<{
    id: number;
    userId: string;
    firstName: string;
    lastName: string;
    amount: string;
    description?: string;
    createdAt: string;
  }>;
}

export default function CollaborativeGoalDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isReady, user, getAuthHeaders } = useClerkUserReady();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contributions, setContributions] = useState([]);
  const [showAddContribution, setShowAddContribution] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [contributionParticipant, setContributionParticipant] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // Fetch goal data
  const fetchGoal = async () => {
    if (!isReady || !user?.id || !id) return;
    
    try {
      setIsLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/collaborative-goals/${id}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setGoal(data);
        
        // Fetch contributions
        const contribResponse = await fetch(`/api/collaborative-goals/${id}/contributions`, { headers });
        if (contribResponse.ok) {
          const contribData = await contribResponse.json();
          setContributions(contribData);
        }

        // Fetch messages
        const messagesResponse = await fetch(`/api/collaborative-goals/${id}/messages`, { headers });
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setMessages(messagesData);
        }
      } else {
        toast({
          title: t('collaborative_goal_detail.errors.goal_not_found'),
          description: t('collaborative_goal_detail.errors.goal_not_found_description'),
          variant: "destructive"
        });
        setLocation('/collaborative-goals');
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

  // Handle contribution submission
  const handleAddContribution = async () => {
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      toast({
        title: t('collaborative_goal_detail.messages.invalid_amount'),
        description: t('collaborative_goal_detail.messages.invalid_amount_description'),
        variant: "destructive"
      });
      return;
    }

    if (!contributionParticipant) {
      toast({
        title: t('collaborative_goal_detail.messages.participant_required'),
        description: t('collaborative_goal_detail.messages.participant_required_description'),
        variant: "destructive"
      });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/collaborative-goals/${id}/contributions`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: contributionAmount,
          note: contributionNote,
          participantId: contributionParticipant
        })
      });

      if (response.ok) {
        toast({
          title: t('collaborative_goal_detail.messages.contribution_added'),
          description: t('collaborative_goal_detail.messages.contribution_added_description')
        });
        setContributionAmount("");
        setContributionNote("");
        setContributionParticipant("");
        setShowAddContribution(false);
        fetchGoal(); // Refresh data
      }
    } catch (error) {
      console.error('Error adding contribution:', error);
      toast({
        title: t('collaborative_goal_detail.messages.error'),
        description: "Failed to add contribution",
        variant: "destructive"
      });
    }
  };

  // Handle friend invitation
  const handleInviteFriend = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({
        title: t('collaborative_goal_detail.messages.invalid_email'),
        description: t('collaborative_goal_detail.messages.invalid_email_description'),
        variant: "destructive"
      });
      return;
    }

    try {
      setIsInviting(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/collaborative-goals/${id}/invite`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: inviteEmail })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: t('collaborative_goal_detail.messages.invitation_sent'),
          description: result.existingUser 
            ? t('collaborative_goal_detail.messages.user_added_to_goal') 
            : t('collaborative_goal_detail.messages.invitation_email_sent')
        });
        setInviteEmail("");
        setShowInviteFriends(false);
        if (result.existingUser) {
          fetchGoal(); // Refresh to show new participant
        }
      } else {
        // Handle error response from server
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        toast({
          title: t('collaborative_goal_detail.messages.error'),
          description: errorData.message || t('collaborative_goal_detail.messages.invitation_failed'),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error inviting friend:', error);
      toast({
        title: t('collaborative_goal_detail.messages.error'),
        description: "Failed to send invitation",
        variant: "destructive"
      });
    } finally {
      setIsInviting(false);
    }
  };

  // Handle sending a message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/collaborative-goals/${id}/messages`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage,
          messageType: 'text',
        }),
      });

      if (response.ok) {
        setNewMessage("");
        fetchGoal(); // Refresh to get latest messages
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('collaborative_goal_detail.errors.goal_not_found')}
          </h1>
          <Link href="/collaborative-goals">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('collaborative_goal_detail.buttons.back')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.min((parseFloat(goal.currentAmount) / parseFloat(goal.targetAmount)) * 100, 100);
  const isCreator = goal.createdBy === user?.id;
  const categoryInfo = GOAL_CATEGORIES[goal.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.investment;
  const CategoryIcon = categoryInfo.icon;

  // Calculate days remaining
  const targetDate = new Date(goal.targetDate);
  const today = new Date();
  const daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Prepare chart data - group by user and sum their contributions
  const contributionsByUser = contributions.reduce((acc: any, contrib: any) => {
    const userName = contrib.firstName && contrib.lastName 
      ? `${contrib.firstName} ${contrib.lastName}` 
      : t('collaborative_goal_detail.sections.unknown_user');
    
    if (acc[userName]) {
      acc[userName] += parseFloat(contrib.amount);
    } else {
      acc[userName] = parseFloat(contrib.amount);
    }
    return acc;
  }, {});

  const contributionChartData = Object.entries(contributionsByUser)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a: any, b: any) => b.amount - a.amount)
    .slice(0, 10);

  // Get top contributor
  const topContributor = contributions.length > 0 ? 
    contributions.reduce((top, current) => 
      parseFloat(current.amount) > parseFloat(top.amount) ? current : top
    ) : null;

  const timelineData = contributions.reduce((acc: any[], contrib: any) => {
    const date = new Date(contrib.createdAt).toISOString().split('T')[0];
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.amount += parseFloat(contrib.amount);
    } else {
      acc.push({ date, amount: parseFloat(contrib.amount) });
    }
    return acc;
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header Navigation */}
      <div className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/collaborative-goals">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('collaborative_goal_detail.buttons.back')}
              </Button>
            </Link>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const text = `Join me in saving for "${goal?.name}"! Target: $${parseFloat(goal?.targetAmount || '0').toLocaleString()} - ${window.location.href}`;
                  
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: `Collaborative Goal: ${goal?.name}`,
                        text: text,
                        url: window.location.href
                      });
                    } catch (error) {
                      try {
                        await navigator.clipboard.writeText(text);
                        toast({
                          title: t('collaborative_goal_detail.messages.link_copied'),
                          description: t('collaborative_goal_detail.messages.link_copied_description'),
                        });
                      } catch (clipboardError) {
                        toast({
                          title: t('collaborative_goal_detail.messages.error'),
                          description: t('collaborative_goal_detail.messages.share_failed'),
                          variant: "destructive"
                        });
                      }
                    }
                  } else {
                    try {
                      await navigator.clipboard.writeText(text);
                      toast({
                        title: t('collaborative_goal_detail.messages.link_copied'),
                        description: t('collaborative_goal_detail.messages.link_copied_description'),
                      });
                    } catch (clipboardError) {
                      toast({
                        title: t('collaborative_goal_detail.messages.error'),
                        description: t('collaborative_goal_detail.messages.copy_failed'),
                        variant: "destructive"
                      });
                    }
                  }
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                {t('collaborative_goal_detail.actions.share_goal')}
              </Button>
              
              {isCreator && (
                <Dialog open={showInviteFriends} onOpenChange={setShowInviteFriends}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Mail className="w-4 h-4 mr-2" />
                      {t('collaborative_goal_detail.actions.invite_friends')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('collaborative_goal_detail.actions.invite_friends')}</DialogTitle>
                      <DialogDescription>
                        {t('collaborative_goal_detail.actions.invite_description')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        type="email"
                        placeholder={t('collaborative_goal_detail.actions.email_placeholder')}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleInviteFriend}
                          disabled={isInviting}
                          className="flex-1"
                        >
                          {isInviting ? t('collaborative_goal_detail.actions.sending') : t('collaborative_goal_detail.actions.send_invitation')}
                        </Button>
                        <Button variant="outline" onClick={() => setShowInviteFriends(false)}>
                          {t('collaborative_goal_detail.buttons.cancel')}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative p-8 md:p-12">
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${categoryInfo.color} bg-opacity-20 backdrop-blur-sm`}>
                <CategoryIcon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <Badge variant="secondary" className="mb-2 bg-white/20 text-white">
                  {goal.category.charAt(0).toUpperCase() + goal.category.slice(1)}
                </Badge>
                <h1 className="text-3xl md:text-4xl font-bold mb-3">{goal.name}</h1>
                <p className="text-lg opacity-90 max-w-2xl">{goal.description}</p>
              </div>
            </div>

            {/* Progress Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Target className="w-6 h-6" />
                  <span className="font-semibold">{t('collaborative_goal_detail.hero.target')}</span>
                </div>
                <div className="text-2xl font-bold">${parseFloat(goal.targetAmount).toLocaleString()}</div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <DollarSign className="w-6 h-6" />
                  <span className="font-semibold">{t('collaborative_goal_detail.hero.raised')}</span>
                </div>
                <div className="text-2xl font-bold">${parseFloat(goal.currentAmount).toLocaleString()}</div>
                <div className="text-sm opacity-75">{progressPercentage.toFixed(1)}% {t('collaborative_goal_detail.hero.complete')}</div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-6 h-6" />
                  <span className="font-semibold">{t('collaborative_goal_detail.hero.target_date')}</span>
                </div>
                <div className="text-lg font-bold">
                  {new Date(goal.targetDate).toLocaleDateString()}
                </div>
                <div className="text-sm opacity-75">
                  {Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} {t('collaborative_goal_detail.hero.days_left')}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white/20 rounded-full h-4 mb-4">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-orange-500 h-4 rounded-full transition-all duration-700"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Dialog open={showAddContribution} onOpenChange={setShowAddContribution}>
                <DialogTrigger asChild>
                  <Button size="lg" className="bg-white text-indigo-600 hover:bg-gray-50">
                    <Plus className="w-5 h-5 mr-2" />
                    {t('collaborative_goal_detail.hero.add_contribution')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('collaborative_goal_detail.hero.add_contribution')}</DialogTitle>
                    <DialogDescription>
                      {t('collaborative_goal_detail.forms.contribute_description', { goalName: goal.name })}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('collaborative_goal_detail.forms.participant_label')}</label>
                      <Select value={contributionParticipant} onValueChange={setContributionParticipant}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('collaborative_goal_detail.forms.select_participant')} />
                        </SelectTrigger>
                        <SelectContent>
                          {goal.participants?.map((participant) => (
                            <SelectItem key={participant.id} value={participant.userId}>
                              {participant.user?.firstName && participant.user?.lastName 
                                ? `${participant.user.firstName} ${participant.user.lastName}` 
                                : t('collaborative_goal_detail.sections.unknown_user')
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('collaborative_goal_detail.forms.amount_label')}</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('collaborative_goal_detail.forms.note_label')}</label>
                      <Textarea
                        placeholder={t('collaborative_goal_detail.forms.note_placeholder')}
                        value={contributionNote}
                        onChange={(e) => setContributionNote(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddContribution} className="flex-1">
                        {t('collaborative_goal_detail.forms.add_contribution')}
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddContribution(false)}>
                        {t('collaborative_goal_detail.buttons.cancel')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Users className="w-5 h-5 mr-2" />
                {goal.participants?.length || 0} {t('collaborative_goal_detail.hero.participants_count')}
              </Button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Charts & Analytics */}
          <div className="lg:col-span-2 space-y-6">


            {/* Contribution Timeline */}
            {timelineData.length > 0 && (
              <Card className="p-6">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {t('collaborative_goal_detail.charts.contribution_timeline')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${value}`, t('collaborative_goal_detail.charts.amount')]} />
                      <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Contributor Leaderboard */}
            {contributions.length > 0 && (
              <Card className="p-6">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    {t('collaborative_goal_detail.charts.top_contributors')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={contributionChartData.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${value}`, t('collaborative_goal_detail.charts.contribution')]} />
                      <Bar dataKey="amount" fill="#8884d8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Goal Details (Category-specific) */}
            {goal.goalDetails && (
              <Card className="p-6">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <CategoryIcon className="w-5 h-5" />
                    {t('collaborative_goal_detail.charts.goal_details')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(goal.goalDetails).map(([key, value]) => (
                      <div key={key} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {t(`collaborative_goal_detail.goal_fields.${key}`) || key.charAt(0).toUpperCase() + key.slice(1)}
                        </div>
                        <div className="text-gray-900 dark:text-white">{value as string}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Participants & Recent Activity */}
          <div className="space-y-6">
            {/* Participants */}
            <Card className="p-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {t('collaborative_goal_detail.hero.participants_count')} ({goal.participants?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {goal.participants?.map((participant) => (
                    <div key={participant.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>
                          {participant.firstName?.[0]}{participant.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">
                          {participant.firstName && participant.lastName 
                            ? `${participant.firstName} ${participant.lastName}` 
                            : t('collaborative_goal_detail.sections.unknown_user')
                          }
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          ${parseFloat(participant.currentContribution || '0').toLocaleString()} {t('collaborative_goal_detail.sections.contributed')}
                        </div>
                      </div>
                      {participant.role === 'creator' && (
                        <Badge variant="secondary">{t('collaborative_goal_detail.sections.creator')}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Contributions */}
            <Card className="p-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  {t('collaborative_goal_detail.sections.recent_activity')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contributions.slice(0, 5).map((contrib: any) => (
                    <div key={contrib.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {contrib.firstName?.[0]}{contrib.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm">
                          <span className="font-medium">
                            {contrib.firstName && contrib.lastName 
                              ? `${contrib.firstName} ${contrib.lastName}` 
                              : t('collaborative_goal_detail.sections.unknown_user')
                            }
                          </span>
                          <span className="text-green-600 dark:text-green-400 ml-1">
                            {t('collaborative_goal_detail.sections.contributed')} ${parseFloat(contrib.amount).toLocaleString()}
                          </span>
                        </div>
                        {contrib.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            "{contrib.description}"
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(contrib.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {contributions.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      {t('collaborative_goal_detail.sections.no_contributions')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Participant Chat */}
            <Card className="p-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  {t('collaborative_goal_detail.chat.group_chat')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Messages */}
                  <div className="space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {messages.map((message: any) => (
                      <div key={message.id} className="flex items-start space-x-3">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>
                            {message.user?.firstName ? message.user.firstName[0] : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {message.user?.firstName} {message.user?.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-sm mt-1">{message.message}</div>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        {t('collaborative_goal_detail.chat.no_messages')}
                      </div>
                    )}
                  </div>

                  {/* Message input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('collaborative_goal_detail.chat.type_message')}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}