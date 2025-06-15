import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

  // Fetch collaborative goals
  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ["/api/collaborative-goals"],
  });

  // Fetch friends
  const { data: friends = [] } = useQuery({
    queryKey: ["/api/friends"],
  });

  // Fetch friend requests
  const { data: friendRequests = [] } = useQuery({
    queryKey: ["/api/friends/requests"],
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
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
      const response = await apiRequest("POST", "/api/collaborative-goals", processedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-goals"] });
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
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send friend request mutation
  const sendFriendRequestMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/friends/request", { recipientEmail: email });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      setAddFriendOpen(false);
      setFriendEmail("");
      toast({
        title: "Success!",
        description: "Friend request sent successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Accept friend request mutation
  const acceptFriendMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await apiRequest("POST", `/api/friends/accept/${requestId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      toast({
        title: "Success!",
        description: "Friend request accepted",
      });
    },
  });

  // Reject friend request mutation
  const rejectFriendMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await apiRequest("DELETE", `/api/friends/reject/${requestId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      toast({
        title: "Friend request rejected",
      });
    },
  });

  const handleCreateGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount || !newGoal.targetDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createGoalMutation.mutate(newGoal);
  };

  const handleSendFriendRequest = () => {
    if (!friendEmail) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    sendFriendRequestMutation.mutate(friendEmail);
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
              Collaborative Savings Goals
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Team up with friends to achieve your savings goals together
            </p>
          </div>

          <Tabs defaultValue="goals" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="goals">My Goals</TabsTrigger>
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
            </TabsList>

            <TabsContent value="goals" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Active Challenges</h2>
                <Dialog open={createGoalOpen} onOpenChange={setCreateGoalOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Challenge
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Create Collaborative Goal</DialogTitle>
                      <DialogDescription>
                        Set up a new savings challenge to complete with friends
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Goal Name</Label>
                        <Input
                          id="name"
                          value={newGoal.name}
                          onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                          placeholder="e.g., Summer Vacation Fund"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newGoal.description}
                          onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                          placeholder="Describe your savings goal..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="targetAmount">Target Amount ($)</Label>
                          <Input
                            id="targetAmount"
                            type="number"
                            value={newGoal.targetAmount}
                            onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                            placeholder="5000"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="targetDate">Target Date</Label>
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
                          <Label htmlFor="category">Category</Label>
                          <Select value={newGoal.category} onValueChange={(value) => setNewGoal({ ...newGoal, category: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vacation">Vacation</SelectItem>
                              <SelectItem value="emergency">Emergency Fund</SelectItem>
                              <SelectItem value="home">Home Purchase</SelectItem>
                              <SelectItem value="education">Education</SelectItem>
                              <SelectItem value="investment">Investment</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="challengeType">Challenge Type</Label>
                          <Select value={newGoal.challengeType} onValueChange={(value) => setNewGoal({ ...newGoal, challengeType: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="collaborative">Collaborative</SelectItem>
                              <SelectItem value="competitive">Competitive</SelectItem>
                              <SelectItem value="milestone">Milestone-based</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleCreateGoal}
                        disabled={createGoalMutation.isPending}
                      >
                        {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
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
                      No collaborative goals yet
                    </h3>
                    <p className="text-gray-500 text-center mb-4">
                      Create your first collaborative savings goal and invite friends to join
                    </p>
                    <Button onClick={() => setCreateGoalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Goal
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
                              {goal.challengeType}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <span>${goal.currentAmount} raised</span>
                              <span>${goal.targetAmount} goal</span>
                            </div>
                            <Progress value={progress} className="h-3" />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>{progress.toFixed(1)}% complete</span>
                              <span>{daysLeft > 0 ? `${daysLeft} days left` : "Overdue"}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {goal.participants.length} participant{goal.participants.length !== 1 ? 's' : ''}
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

                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => window.location.href = `/collaborative-goals/${goal.id}`}
                          >
                            View Challenge
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="friends" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Friends & Connections</h2>
                <Dialog open={addFriendOpen} onOpenChange={setAddFriendOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Friend
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Friend</DialogTitle>
                      <DialogDescription>
                        Send a friend request by email address
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={friendEmail}
                          onChange={(e) => setFriendEmail(e.target.value)}
                          placeholder="friend@example.com"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleSendFriendRequest}
                        disabled={sendFriendRequestMutation.isPending}
                      >
                        {sendFriendRequestMutation.isPending ? "Sending..." : "Send Request"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-6">
                {/* Friend Requests */}
                {friendRequests.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Pending Requests</h3>
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
                                onClick={() => acceptFriendMutation.mutate(request.id)}
                                disabled={acceptFriendMutation.isPending}
                              >
                                Accept
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => rejectFriendMutation.mutate(request.id)}
                                disabled={rejectFriendMutation.isPending}
                              >
                                Decline
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
                  <h3 className="text-lg font-medium mb-4">Your Friends ({friends.length})</h3>
                  {friends.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <UserPlus className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No friends yet
                        </h3>
                        <p className="text-gray-500 text-center mb-4">
                          Add friends to start collaborative savings challenges together
                        </p>
                        <Button onClick={() => setAddFriendOpen(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Your First Friend
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
                            <Badge variant="secondary">Friends</Badge>
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
                <h2 className="text-xl font-semibold mb-4">Your Achievements</h2>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Trophy className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No achievements yet
                    </h3>
                    <p className="text-gray-500 text-center">
                      Complete collaborative goals to earn achievements and badges
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