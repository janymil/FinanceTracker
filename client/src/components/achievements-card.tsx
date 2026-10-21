import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/dateUtils";

interface Achievement {
  id: number;
  title: string;
  description?: string | null;
  achievedAt?: string | null;
  rewardType?: string | null;
}

interface AchievementsCardProps {
  className?: string;
}

/**
 * Shows milestones reached on the user's collaborative goals.
 * Backed by GET /api/achievements (group milestones included since 2026-10-21).
 */
export default function AchievementsCard({ className }: AchievementsCardProps) {
  const { isReady, user } = useClerkUserReady();
  const { t } = useTranslation();

  const { data: achievements = [], isLoading } = useQuery<Achievement[]>({
    queryKey: ["achievements", user?.id],
    enabled: isReady && !!user?.id,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/achievements");
      return response.json();
    },
    staleTime: 60_000,
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          {t("achievements", "Achievements")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : achievements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noAchievements", "No achievements yet")}
          </p>
        ) : (
          <ul className="space-y-3">
            {achievements.map((achievement) => (
              <li key={achievement.id} className="flex items-start gap-3">
                <span className="mt-0.5 text-lg" aria-hidden="true">🏆</span>
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{achievement.title}</p>
                  {achievement.description && (
                    <p className="text-sm text-muted-foreground">{achievement.description}</p>
                  )}
                  {achievement.achievedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(achievement.achievedAt, { dateStyle: "medium" })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
