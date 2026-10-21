import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MapPin, Clock, TrendingUp, Send, CheckCircle2, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/AppLayout";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const [location, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Language from route
  const langMatch = location.match(/^\/([a-z]{2})(?:\/|$)/);
  const currentLang = langMatch ? langMatch[1] : (localStorage.getItem('preferredLanguage') || 'en');

  useEffect(() => {
    document.title = `${t('contact.page_title', 'Contact Us')} - Kaptia`;
  }, [t]);

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
          title: t('contact.success_title', 'Message Sent Successfully'),
          description: t('contact.success_description', 'Thank you for reaching out. We will respond within 24 hours.'),
        });

        // Reset form
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        toast({
          title: t('contact.error_title', 'Failed to Send Message'),
          description: data.error || t('contact.error_description', 'Please try again later.'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('contact.error_title', 'Connection Error'),
        description: t('contact.error_network', 'Please check your connection and try again.'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout isPublicPage={true}>
      <SEO 
        title={`${t('contact.page_title', 'Contact Us')} | Kaptia`}
        description={t('contact.page_description', 'Have questions about Kaptia? We are here to help. Get in touch with our support team.')}
        keywords="kaptia contact, support, help, email"
        canonical="https://kaptia.app/contact"
      />

      <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#07080f] text-gray-900 dark:text-white relative bg-grid pb-20">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          {/* Header */}
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 dark:border-white/10 bg-indigo-50/70 dark:bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              <Mail className="h-3.5 w-3.5" />
              {t("Contact")}
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mt-4">
              {t('contact.page_title', 'Contact Us')}
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 mt-3 max-w-2xl mx-auto">
              {t('contact.page_description', 'Have questions about Kaptia? We are here to help. Get in touch with our support team and we will respond as soon as possible.')}
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-8 items-start">
            {/* Contact Form */}
            <div className="md:col-span-7 glass-card rounded-2xl p-6 sm:p-8 border border-gray-200/80 dark:border-white/10">
              <h2 className="font-display text-xl font-bold mb-2 text-gray-900 dark:text-white">
                {t('contact.form_title', 'Send Us a Message')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {t('contact.form_description', 'Fill out the form below and we will respond within 24 hours.')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                      {t('contact.form_name', 'Name')}
                    </label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('contact.form_name_placeholder', 'Your name')}
                      required
                      className="rounded-xl bg-white/90 dark:bg-[#0f111a]/90 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                      {t('contact.form_email', 'Email')}
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('contact.form_email_placeholder', 'your@email.com')}
                      required
                      className="rounded-xl bg-white/90 dark:bg-[#0f111a]/90 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                    {t('contact.form_subject', 'Subject')}
                  </label>
                  <Input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t('contact.form_subject_placeholder', 'What is this regarding?')}
                    required
                    className="rounded-xl bg-white/90 dark:bg-[#0f111a]/90 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
                    {t('contact.form_message', 'Message')}
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('contact.form_message_placeholder', 'Tell us how we can help you...')}
                    rows={5}
                    required
                    className="rounded-xl bg-white/90 dark:bg-[#0f111a]/90 text-sm"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl h-11 font-medium shadow-md shadow-indigo-500/20" 
                  disabled={isSubmitting}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? t('contact.form_sending', 'Sending...') : t('contact.form_send', 'Send Message')}
                </Button>
              </form>
            </div>

            {/* Contact Information */}
            <div className="md:col-span-5 space-y-6">
              <div className="glass-card rounded-2xl p-6 border border-gray-200/80 dark:border-white/10 space-y-5">
                <h3 className="font-display text-lg font-bold text-gray-900 dark:text-white">
                  {t('contact.info_title', 'Get in Touch')}
                </h3>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('contact.info_email', 'Email')}</p>
                    <a href="mailto:info@kaptia.app" className="text-sm font-medium hover:text-indigo-600 transition-colors">
                      info@kaptia.app
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('contact.info_address', 'Address')}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      NutriNova LLC<br />
                      2105 Vista Oeste NW<br />
                      Albuquerque, NM 87120
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t('contact.info_hours', 'Support Hours')}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {t('contact.info_hours_weekdays', 'Monday - Friday: 9:00 - 18:00 (PST)')}<br />
                      {t('contact.info_hours_weekends', 'Saturday - Sunday: 10:00 - 16:00 (PST)')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Card to Help Center */}
              <div className="glass-card rounded-2xl p-6 border border-indigo-200/60 dark:border-white/10 bg-indigo-50/40 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-2">
                  <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-display font-bold text-gray-900 dark:text-white">
                    {t("Looking for instant answers?")}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {t("Complete guide to mastering your spending with Kaptia's powerful features")}
                </p>
                <Button
                  onClick={() => setLocation(`/${currentLang}/help`)}
                  variant="outline"
                  className="w-full rounded-xl text-xs sm:text-sm bg-white dark:bg-white/5 border-indigo-200 dark:border-white/10"
                >
                  {t("Visit Help Center")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
