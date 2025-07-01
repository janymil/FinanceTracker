import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Download, Loader2, Video, FileVideo } from 'lucide-react';

interface VideoDemoGeneratorProps {
  title: string;
  description: string;
  demoType: 'categorization' | 'tips' | 'health';
}

export function VideoDemoGenerator({ title, description, demoType }: VideoDemoGeneratorProps) {
  const { t, i18n } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const generateDemoVideo = async () => {
    setIsGenerating(true);
    setProgress(0);
    setVideoUrl(null);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not available');

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Set canvas size for video
      canvas.width = 1280;
      canvas.height = 720;

      // Create video recorder
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setIsGenerating(false);
      };

      // Start recording
      mediaRecorder.start();

      // Generate demo content based on type
      await renderDemoAnimation(ctx, canvas.width, canvas.height, demoType);

      // Stop recording after animation completes
      setTimeout(() => {
        mediaRecorder.stop();
      }, 100);

    } catch (error) {
      console.error('Video generation error:', error);
      setIsGenerating(false);
    }
  };

  const renderDemoAnimation = async (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    type: string
  ): Promise<void> => {
    const duration = 8000; // 8 seconds
    const startTime = Date.now();

    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setProgress(Math.round(progress * 100));

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Set background gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#3B82F6');
        gradient.addColorStop(1, '#8B5CF6');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Render demo content based on type and progress
        renderDemoContent(ctx, width, height, type, progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  };

  const renderDemoContent = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    type: string,
    progress: number
  ) => {
    // Set common styles
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';

    // Title
    ctx.font = 'bold 48px Arial';
    ctx.fillText('FinanzerPro AI Demo', width / 2, 100);

    // Subtitle based on demo type
    ctx.font = '32px Arial';
    const subtitles = {
      categorization: t('features.video_demos.categorization.title', 'Smart Transaction Categorization'),
      tips: t('features.video_demos.tips.title', 'AI Financial Insights'),
      health: t('features.video_demos.health.title', 'Financial Health Analysis')
    };
    ctx.fillText(subtitles[type as keyof typeof subtitles], width / 2, 160);

    // Demo-specific animations
    switch (type) {
      case 'categorization':
        renderCategorizationDemo(ctx, width, height, progress);
        break;
      case 'tips':
        renderTipsDemo(ctx, width, height, progress);
        break;
      case 'health':
        renderHealthDemo(ctx, width, height, progress);
        break;
    }

    // Progress bar at bottom
    const barWidth = width * 0.8;
    const barHeight = 8;
    const barX = (width - barWidth) / 2;
    const barY = height - 60;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = 'white';
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);
  };

  const renderCategorizationDemo = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    progress: number
  ) => {
    const centerY = height / 2;

    if (progress < 0.3) {
      // Stage 1: Receipt upload
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('1. Upload Receipt', width / 2, centerY - 50);
      
      // Draw receipt mockup
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(width / 2 - 100, centerY - 20, 200, 150);
      
      ctx.fillStyle = 'black';
      ctx.font = '16px Arial';
      ctx.fillText('Starbucks Coffee', width / 2, centerY + 20);
      ctx.fillText('$4.95', width / 2, centerY + 50);
      
    } else if (progress < 0.7) {
      // Stage 2: AI Analysis
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('2. AI Analysis', width / 2, centerY - 50);
      
      // Animated processing
      const dots = '.'.repeat(Math.floor((progress - 0.3) * 10) % 4);
      ctx.fillText(`Analyzing${dots}`, width / 2, centerY + 20);
      
    } else {
      // Stage 3: Categorization result
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('3. Smart Categorization', width / 2, centerY - 50);
      
      // Result badge
      ctx.fillStyle = '#10B981';
      ctx.fillRect(width / 2 - 120, centerY, 240, 50);
      
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('☕ Food & Beverages', width / 2, centerY + 30);
    }
  };

  const renderTipsDemo = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    progress: number
  ) => {
    const centerY = height / 2;

    if (progress < 0.4) {
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('1. Analyzing Spending Patterns', width / 2, centerY - 50);

      // Draw chart mockup
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 100, centerY + 50);
      for (let i = 0; i <= 100; i += 10) {
        const x = width / 2 - 100 + i * 2;
        const y = centerY + 30 + Math.sin(i * 0.1) * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      
    } else if (progress < 0.7) {
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('2. Generating AI Insights', width / 2, centerY - 50);
      
      const dots = '.'.repeat(Math.floor((progress - 0.4) * 10) % 4);
      ctx.fillText(`Processing${dots}`, width / 2, centerY + 20);
      
    } else {
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('3. Personalized Recommendations', width / 2, centerY - 80);
      
      ctx.font = '18px Arial';
      ctx.fillText('• Reduce coffee spending by 20%', width / 2, centerY - 20);
      ctx.fillText('• Set up automatic savings', width / 2, centerY + 10);
      ctx.fillText('• Optimize monthly budget', width / 2, centerY + 40);
    }
  };

  const renderHealthDemo = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    progress: number
  ) => {
    const centerY = height / 2;

    if (progress < 0.3) {
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('1. Financial Health Scan', width / 2, centerY - 50);
      
      // Scanning effect
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width / 2, centerY + 20, 50, 0, 2 * Math.PI * progress * 3);
      ctx.stroke();
      
    } else if (progress < 0.7) {
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('2. Calculating Health Score', width / 2, centerY - 50);
      
      // Score circle
      const score = Math.round(78 * (progress - 0.3) / 0.4);
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(width / 2, centerY + 20, 60, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (score / 100));
      ctx.stroke();
      
      ctx.fillStyle = 'white';
      ctx.font = '36px Arial';
      ctx.fillText(score.toString(), width / 2, centerY + 30);
      
    } else {
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('3. Improvement Strategies', width / 2, centerY - 80);
      
      ctx.font = '18px Arial';
      ctx.fillText('Emergency Fund: +15 pts', width / 2, centerY - 20);
      ctx.fillText('Debt Reduction: +10 pts', width / 2, centerY + 10);
      ctx.fillText('Investment Plan: +12 pts', width / 2, centerY + 40);
    }
  };

  const downloadVideo = () => {
    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `finanzerpro-${demoType}-demo-${i18n.language}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Canvas for video generation (hidden) */}
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
          width={1280}
          height={720}
        />

        {/* Video preview area */}
        <div className="relative aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full object-cover"
              poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4MCIgaGVpZ2h0PSI3MjAiIHZpZXdCb3g9IjAgMCAxMjgwIDcyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMzQjgyRjY7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6IzhCNUNGNjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxMjgwIiBoZWlnaHQ9IjcyMCIgZmlsbD0idXJsKCNncmFkKSIvPgogIDx0ZXh0IHg9IjY0MCIgeT0iMzYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjQ4IiBmb250LXdlaWdodD0iYm9sZCI+RmluYW56ZXJQCM8gQUkgRGVtbzwvdGV4dD4KPC9zdmc+"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <FileVideo className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                  {title}
                </h4>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                  {description}
                </p>
                {isGenerating && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600">Generating video... {progress}%</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {description}
          </p>

          <div className="flex gap-2">
            {!videoUrl && !isGenerating && (
              <Button
                onClick={generateDemoVideo}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Video className="h-4 w-4 mr-2" />
                {t('features.demo.generate_video', 'Generate Demo Video')}
              </Button>
            )}

            {isGenerating && (
              <Button disabled className="flex-1">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('features.demo.generating', 'Generating...')}
              </Button>
            )}

            {videoUrl && (
              <>
                <Button
                  onClick={() => videoRef.current?.play()}
                  variant="outline"
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {t('features.demo.play', 'Play')}
                </Button>
                <Button
                  onClick={downloadVideo}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t('features.demo.download', 'Download')}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}