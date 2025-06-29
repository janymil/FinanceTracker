import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import RequirePlan from "@/components/require-plan";
import { 
  Users, 
  Plus, 
  Target, 
  Calendar, 
  Trophy, 
  DollarSign, 
  UserPlus, 
  Mail, 
  Crown,
  TrendingUp,
  Activity,
  Gift
} from "lucide-react";
import { format } from "date-fns";

interface CollaborativeGoal {
  id: number;
  name: string;
  description: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  category: string;
  challengeType: string;
  status: string;
  joinCode: string;
  participants: Array<{
    id: number;
    userId: string;
    personalTarget: string;
    currentContribution: string;
    role: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string;
    };
  }>;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string;
  };
}

interface Friend {
  id: number;
  status: string;
  friend: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string;
  };
}

interface FriendRequest {
  id: number;
  status: string;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string;
  };
}

export default function CollaborativeGoalsPage() {
  const { toast } = useToast();
  const { user, isReady, getAuthHeaders } = useClerkUserReady();
  const { t } = useTranslation();
  const displayCurrency = '$';
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: "",
    description: "",
    targetAmount: "",
    targetDate: "",
    category: "",
    challengeType: "collaborative",
  });
  const [friendEmail, setFriendEmail] = useState("");
  
  // State for data
  const [goals, setGoals] = useState<CollaborativeGoal[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);

  // Fetch data when user is ready
  useEffect(() => {
    if (isReady && user?.id) {
      fetchGoals();
      fetchFriends();
      fetchFriendRequests();
    }
  }, [isReady, user?.id]);

  const fetchGoals = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/collaborative-goals', { headers });
      if (response.ok) {
        const data = await response.json();
        setGoals(data);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setGoalsLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/friends', { headers });
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/friends/requests', { headers });
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  // Create goal function
  const createGoal = async (goalData: any) => {
    try {
      const headers = await getAuthHeaders();
      
      // Debug logging to see what format we're getting
      console.log("Goal data before processing:", goalData);
      
      // Handle different date formats that might come from the input
      let targetDate: Date;
      if (goalData.targetDate) {
        // Try parsing the date - handle both ISO strings and DD/MM/YYYY format
        const dateStr = goalData.targetDate;
        if (dateStr.includes('/')) {
          // Handle DD/MM/YYYY or MM/DD/YYYY format
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            // Assume DD/MM/YYYY format based on your screenshot
            targetDate = new Date(parts[2], parts[1] - 1, parts[0]);
          } else {
            targetDate = new Date(dateStr);
          }
        } else {
          targetDate = new Date(dateStr);
        }
      } else {
        targetDate = new Date();
      }
      
      const processedData = {
        ...goalData,
        targetDate: targetDate
      };
      
      console.log("Goal data after processing:", processedData);
      
      const response = await fetch("/api/collaborative-goals", {
        method: "POST",
        headers,
        body: JSON.stringify(processedData),
      });

      if (response.ok) {
        fetchGoals();
        setCreateGoalOpen(false);
        setNewGoal({
          name: "",
          description: "",
          targetAmount: "",
          targetDate: "",
          category: "",
          challengeType: "collaborative",
        });
        toast({
          title: "Success!",
          description: "Collaborative goal created successfully",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Send friend request function
  const sendFriendRequestAction = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers,
        body: JSON.stringify({ recipientEmail: friendEmail }),
      });

      if (response.ok) {
        fetchFriends();
        fetchFriendRequests();
        setAddFriendOpen(false);
        setFriendEmail("");
        toast({
          title: "Success!",
          description: "Friend request sent successfully",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Accept friend request function
  const acceptFriendRequest = async (requestId: number) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/friends/accept/${requestId}`, {
        method: "POST",
        headers,
      });
      
      if (response.ok) {
        fetchFriends();
        fetchFriendRequests();
        toast({
          title: t('collaborative_goals.messages.success'),
          description: t('collaborative_goals.messages.friend_accepted'),
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Reject friend request function
  const rejectFriendRequest = async (requestId: number) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/friends/reject/${requestId}`, {
        method: "DELETE",
        headers,
      });
      
      if (response.ok) {
        fetchFriendRequests();
        toast({
          title: t('collaborative_goals.messages.friend_rejected'),
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount || !newGoal.targetDate) {
      toast({
        title: t('collaborative_goals.messages.error'),
        description: t('collaborative_goals.messages.fill_required_fields'),
        variant: "destructive",
      });
      return;
    }

    createGoal(newGoal);
  };

  const handleSendFriendRequest = () => {
    if (!friendEmail) {
      toast({
        title: t('collaborative_goals.messages.error'),
        description: t('collaborative_goals.messages.enter_email'),
        variant: "destructive",
      });
      return;
    }

    sendFriendRequestAction();
  };

  const getProgressPercentage = (current: string, target: string) => {
    const currentNum = parseFloat(current);
    const targetNum = parseFloat(target);
    return targetNum > 0 ? (currentNum / targetNum) * 100 : 0;
  };

  const getChallengeTypeIcon = (type: string) => {
    switch (type) {
      case "competitive":
        return <Trophy className="h-4 w-4" />;
      case "milestone":
        return <Target className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getChallengeTypeBadge = (type: string) => {
    const variants = {
      collaborative: "default",
      competitive: "destructive",
      milestone: "secondary",
    };
    return variants[type as keyof typeof variants] || "default";
  };

  return (
    <RequirePlan plan="standard" feature="Collaborative Savings Goals">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('collaborative_goals.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('collaborative_goals.subtitle')}
            </p>
          </div>

          <Tabs defaultValue="goals" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="goals">{t('collaborative_goals.tabs.my_goals')}</TabsTrigger>
              <TabsTrigger value="friends">{t('collaborative_goals.tabs.friends')}</TabsTrigger>
              <TabsTrigger value="achievements">{t('collaborative_goals.tabs.achievements')}</TabsTrigger>
            </TabsList>

            <TabsContent value="goals" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">{t('collaborative_goals.sections.active_challenges')}</h2>
                <Dialog open={createGoalOpen} onOpenChange={setCreateGoalOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('collaborative_goals.buttons.create_challenge')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>{t('collaborative_goals.dialogs.create.title')}</DialogTitle>
                      <DialogDescription>
                        {t('collaborative_goals.dialogs.create.description')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">{t('collaborative_goals.form.goal_name')}</Label>
                        <Input
                          id="name"
                          value={newGoal.name}
                          onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                          placeholder={t('collaborative_goals.form.goal_name_placeholder')}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="description">{t('collaborative_goals.form.description')}</Label>
                        <Textarea
                          id="description"
                          value={newGoal.description}
                          onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                          placeholder={t('collaborative_goals.form.description_placeholder')}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="targetAmount">{t('collaborative_goals.form.target_amount')}</Label>
                          <Input
                            id="targetAmount"
                            type="number"
                            value={newGoal.targetAmount}
                            onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                            placeholder="5000"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="targetDate">{t('collaborative_goals.form.target_date')}</Label>
                          <Input
                            id="targetDate"
                            type="date"
                            value={newGoal.targetDate}
                            onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="category">{t('collaborative_goals.form.category')}</Label>
                          <Select value={newGoal.category} onValueChange={(value) => setNewGoal({ ...newGoal, category: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('collaborative_goals.form.select_category')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vacation">{t('collaborative_goals.categories.vacation')}</SelectItem>
                              <SelectItem value="emergency">{t('collaborative_goals.categories.emergency')}</SelectItem>
                              <SelectItem value="home">{t('collaborative_goals.categories.home')}</SelectItem>
                              <SelectItem value="education">{t('collaborative_goals.categories.education')}</SelectItem>
                              <SelectItem value="investment">{t('collaborative_goals.categories.investment')}</SelectItem>
                              <SelectItem value="other">{t('collaborative_goals.categories.other')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="challengeType">{t('collaborative_goals.form.challenge_type')}</Label>
                          <Select value={newGoal.challengeType} onValueChange={(value) => setNewGoal({ ...newGoal, challengeType: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="collaborative">{t('collaborative_goals.challenge_types.collaborative')}</SelectItem>
                              <SelectItem value="competitive">{t('collaborative_goals.challenge_types.competitive')}</SelectItem>
                              <SelectItem value="milestone">{t('collaborative_goals.challenge_types.milestone')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleCreateGoal}
                      >
                        {t('collaborative_goals.buttons.create_goal')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {goalsLoading ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                      <CardHeader>
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-2 bg-gray-200 rounded animate-pulse mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : goals.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {t('collaborative_goals.empty_state.title')}
                    </h3>
                    <p className="text-gray-500 text-center mb-4">
                      {t('collaborative_goals.empty_state.description')}
                    </p>
                    <Button onClick={() => setCreateGoalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('collaborative_goals.buttons.create_first_goal')}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {goals.map((goal: CollaborativeGoal) => {
                    const progress = getProgressPercentage(goal.currentAmount, goal.targetAmount);
                    const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-2">
                                {getChallengeTypeIcon(goal.challengeType)}
                                {goal.name}
                              </CardTitle>
                              <CardDescription>{goal.description}</CardDescription>
                            </div>
                            <Badge variant={getChallengeTypeBadge(goal.challengeType) as any}>
                              {t(`collaborative_goals.challenge_types.${goal.challengeType}`)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <span>{t('collaborative_goals.card.raised', { amount: `$${goal.currentAmount}` })}</span>
                              <span>{t('collaborative_goals.card.goal', { amount: `$${goal.targetAmount}` })}</span>
                            </div>
                            <Progress value={progress} className="h-3" />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>{t('collaborative_goals.card.complete', { percentage: progress.toFixed(1) })}</span>
                              <span>{daysLeft > 0 ? t('collaborative_goals.card.days_left', { days: daysLeft }) : t('collaborative_goals.card.overdue')}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {t('collaborative_goals.card.participants', { count: goal.participants.length })} 
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {format(new Date(goal.targetDate), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          </div>

                          <div className="flex -space-x-2">
                            {goal.participants.slice(0, 4).map((participant) => (
                              <Avatar key={participant.id} className="border-2 border-white dark:border-gray-800 w-8 h-8">
                                <AvatarImage src={participant.user?.profileImageUrl || ''} />
                                <AvatarFallback className="text-xs">
                                  {participant.user?.firstName?.[0] || '?'}{participant.user?.lastName?.[0] || ''}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {goal.participants.length > 4 && (
                              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                <span className="text-xs font-medium">+{goal.participants.length - 4}</span>
                              </div>
                            )}
                          </div>

                          <Link href={`/collaborative-goals/${goal.id}`}>
                            <Button 
                              variant="outline" 
                              className="w-full"
                            >
                              {t('collaborative_goals.buttons.view_challenge')}
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="friends" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">{t('collaborative_goals.sections.friends')}</h2>
                <Dialog open={addFriendOpen} onOpenChange={setAddFriendOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('collaborative_goals.buttons.add_friend')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('collaborative_goals.dialogs.add_friend.title')}</DialogTitle>
                      <DialogDescription>
                        {t('collaborative_goals.dialogs.add_friend.description')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email">{t('collaborative_goals.form.email_address')}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={friendEmail}
                          onChange={(e) => setFriendEmail(e.target.value)}
                          placeholder={t('collaborative_goals.form.email_placeholder')}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleSendFriendRequest}
                      >
                        {t('collaborative_goals.buttons.send_request')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-6">
                {/* Friend Requests */}
                {friendRequests.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-4">{t('collaborative_goals.sections.pending_requests')}</h3>
                    <div className="grid gap-4">
                      {friendRequests.map((request: FriendRequest) => (
                        <Card key={request.id}>
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={request.requester.profileImageUrl} />
                                <AvatarFallback>
                                  {request.requester.firstName?.[0]}{request.requester.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {request.requester.firstName} {request.requester.lastName}
                                </p>
                                <p className="text-sm text-gray-500">{request.requester.email}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => acceptFriendRequest(request.id)}
                              >
                                {t('collaborative_goals.buttons.accept')}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => rejectFriendRequest(request.id)}
                              >
                                {t('collaborative_goals.buttons.decline')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Separator className="my-6" />
                  </div>
                )}

                {/* Friends List */}
                <div>
                  <h3 className="text-lg font-medium mb-4">{t('collaborative_goals.sections.your_friends', { count: friends.length })}</h3>
                  {friends.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <UserPlus className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          {t('collaborative_goals.empty_friends.title')}
                        </h3>
                        <p className="text-gray-500 text-center mb-4">
                          {t('collaborative_goals.empty_friends.description')}
                        </p>
                        <Button onClick={() => setAddFriendOpen(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          {t('collaborative_goals.buttons.add_first_friend')}
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {friends.map((friendship: Friend) => (
                        <Card key={friendship.id}>
                          <CardContent className="flex items-center gap-3 p-4">
                            <Avatar>
                              <AvatarImage src={friendship.friend.profileImageUrl} />
                              <AvatarFallback>
                                {friendship.friend.firstName?.[0]}{friendship.friend.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium">
                                {friendship.friend.firstName} {friendship.friend.lastName}
                              </p>
                              <p className="text-sm text-gray-500">{friendship.friend.email}</p>
                            </div>
                            <Badge variant="secondary">{t('collaborative_goals.status.friends')}</Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">{t('collaborative_goals.sections.achievements')}</h2>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Trophy className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {t('collaborative_goals.empty_achievements.title')}
                    </h3>
                    <p className="text-gray-500 text-center">
                      {t('collaborative_goals.empty_achievements.description')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </RequirePlan>
  );
}