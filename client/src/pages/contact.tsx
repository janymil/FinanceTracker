import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MapPin, Clock, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/AppLayout";
import { useUser } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('contact.page_title')} - FinanzerPro`;
  }, [t]);

  const handleLogin = () => {
    setLocation('/auth');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          subject,
          message
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: t('contact.success_title'),
          description: t('contact.success_description'),
        });

        // Reset form
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        toast({
          title: t('contact.error_title'),
          description: data.error || t('contact.error_description'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('contact.error_title'),
        description: t('contact.error_network'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout isPublicPage={true}>
      <SEO 
        title={t('contact.seo_title')}
        description={t('contact.seo_description')}
        keywords={t('contact.seo_keywords')}
        canonical="https://finanzerpro.com/contact"
      />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('contact.page_title')}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('contact.page_description')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>{t('contact.form_title')}</CardTitle>
              <CardDescription>
                {t('contact.form_description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                      {t('contact.form_name')}
                    </label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('contact.form_name_placeholder')}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      {t('contact.form_email')}
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('contact.form_email_placeholder')}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    {t('contact.form_subject')}
                  </label>
                  <Input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t('contact.form_subject_placeholder')}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    {t('contact.form_message')}
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('contact.form_message_placeholder')}
                    rows={5}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('contact.form_sending') : t('contact.form_send')}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('contact.info_title')}</CardTitle>
                <CardDescription>
                  {t('contact.info_description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{t('contact.info_email')}</p>
                    <p className="text-sm text-muted-foreground">info@finanzerpro.com</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{t('contact.info_address')}</p>
                    <p className="text-sm text-muted-foreground">
                      NutriNova LLC<br />
                      2105 Vista Oeste NW<br />
                      Albuquerque, NM 87120
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{t('contact.info_hours')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('contact.info_hours_weekdays')}<br />
                      {t('contact.info_hours_weekends')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('contact.faq_title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium mb-2">{t('contact.faq_q1')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('contact.faq_a1')}
                  </p>
                </div>

                <div>
                  <p className="font-medium mb-2">{t('contact.faq_q2')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('contact.faq_a2')}
                  </p>
                </div>

                <div>
                  <p className="font-medium mb-2">{t('contact.faq_q3')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('contact.faq_a3')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}