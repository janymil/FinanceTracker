import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const lang = location.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || localStorage.getItem('preferredLanguage') || 'en';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-indigo-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("notFound.title")}</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            {t("notFound.description")}
          </p>

          <Button asChild className="mt-6">
            <Link href={`/${lang}`}>{t("notFound.home")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
