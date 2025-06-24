import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MapPin, Clock, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

export default function Contact() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Contact Us - FinanzerPro";
  }, []);

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
          title: "Message sent successfully",
          description: "Thank you for contacting us. We'll get back to you within 24 hours.",
        });

        // Reset form
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        toast({
          title: "Failed to send message",
          description: data.error || "Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header for anonymous users */}
      {!user && (
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <button 
                onClick={() => setLocation('/')} 
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <TrendingUp className="h-8 w-8 text-primary mr-3" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">FinanzerPro</span>
              </button>
              <div className="flex items-center space-x-4">
                {/* Help and Contact links hidden on mobile - available in footer */}
                <button 
                  onClick={() => setLocation('/help')} 
                  className="hidden sm:block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Help
                </button>
                <button 
                  onClick={() => setLocation('/contact')} 
                  className="hidden sm:block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Contact
                </button>
                <Button onClick={handleLogin} className="bg-primary hover:bg-primary/90">
                  Sign In
                </Button>
              </div>
            </div>
          </div>
        </header>
      )}

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have questions about FinanzerPro? We're here to help. Get in touch with our support team 
            and we'll respond as quickly as possible.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send us a message</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                      Name
                    </label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    Subject
                  </label>
                  <Input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What's this about?"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us how we can help..."
                    rows={5}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Get in touch</CardTitle>
                <CardDescription>
                  Here are the different ways you can reach us.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">info@finanzerpro.com</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Address</p>
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
                    <p className="font-medium">Business Hours</p>
                    <p className="text-sm text-muted-foreground">
                      Monday - Friday: 9:00 AM - 6:00 PM (PST)<br />
                      Saturday - Sunday: 10:00 AM - 4:00 PM (PST)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium mb-2">How do I upgrade my plan?</p>
                  <p className="text-sm text-muted-foreground">
                    Visit your account settings and click on "Upgrade Plan" to choose between Standard and Premium plans.
                  </p>
                </div>

                <div>
                  <p className="font-medium mb-2">Is my financial data secure?</p>
                  <p className="text-sm text-muted-foreground">
                    Yes, we use industry-standard encryption and security measures to protect your data. Read our Privacy Policy for details.
                  </p>
                </div>

                <div>
                  <p className="font-medium mb-2">Can I export my data?</p>
                  <p className="text-sm text-muted-foreground">
                    Standard and Premium users can export their data in various formats through the Data Management page.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}