const { createCanvas } = require('canvas');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class DemoVideoCreator {
  constructor() {
    this.width = 1280;
    this.height = 720;
    this.fps = 30;
    this.outputDir = path.join(__dirname, 'public', 'demo-videos');
  }

  async createAllDemoVideos() {
    console.log('Creating demo videos...');
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    const demoTypes = ['categorization', 'tips', 'health'];
    const languages = ['en-us', 'es-pe', 'sk-sk'];

    for (const demoType of demoTypes) {
      for (const language of languages) {
        console.log(`Creating ${demoType} video for ${language}...`);
        await this.createDemoVideo(demoType, language);
      }
    }

    console.log('All demo videos created successfully!');
  }

  async createDemoVideo(demoType, language) {
    const scenes = this.getDemoScenes(demoType, language);
    const outputPath = path.join(this.outputDir, `${demoType}-demo-${language}.mp4`);
    
    // Generate frames for each scene
    const framePaths = [];
    let frameCounter = 0;

    for (const scene of scenes) {
      const framesForScene = Math.floor(scene.duration * this.fps);
      
      for (let i = 0; i < framesForScene; i++) {
        const progress = i / framesForScene;
        const framePath = await this.generateFrame(scene, progress, frameCounter, demoType);
        framePaths.push(framePath);
        frameCounter++;
      }
    }

    // Create video from frames using FFmpeg
    await this.createVideoFromFrames(framePaths, outputPath);
    
    // Clean up frame files
    for (const framePath of framePaths) {
      try {
        await fs.unlink(framePath);
      } catch (error) {
        console.warn('Failed to cleanup frame:', framePath);
      }
    }

    console.log(`Created: ${outputPath}`);
  }

  getDemoScenes(demoType, language) {
    const translations = {
      'en-us': {
        categorization: [
          { title: 'Smart Transaction Categorization', subtitle: '1. Upload Receipt', duration: 2.5 },
          { title: 'AI Analysis in Progress', subtitle: 'Analyzing merchant patterns...', duration: 3.0 },
          { title: 'Categorization Complete', subtitle: '✓ Food & Beverages - 95% confidence', duration: 2.5 }
        ],
        tips: [
          { title: 'Financial Insights Generation', subtitle: '1. Analyzing spending patterns', duration: 2.5 },
          { title: 'AI Processing', subtitle: 'Generating personalized tips...', duration: 3.0 },
          { title: 'Recommendations Ready', subtitle: '• Reduce coffee spending\n• Increase savings rate', duration: 2.5 }
        ],
        health: [
          { title: 'Financial Health Analysis', subtitle: '1. Comprehensive financial scan', duration: 2.5 },
          { title: 'Calculating Health Score', subtitle: 'Analyzing income, expenses, debts...', duration: 3.0 },
          { title: 'Health Score: 78/100', subtitle: 'Good financial health with improvement areas', duration: 2.5 }
        ]
      },
      'es-pe': {
        categorization: [
          { title: 'Categorización Inteligente', subtitle: '1. Subir Recibo', duration: 2.5 },
          { title: 'Análisis IA en Progreso', subtitle: 'Analizando patrones de comerciantes...', duration: 3.0 },
          { title: 'Categorización Completa', subtitle: '✓ Comida y Bebidas - 95% confianza', duration: 2.5 }
        ],
        tips: [
          { title: 'Generación de Insights', subtitle: '1. Analizando patrones de gasto', duration: 2.5 },
          { title: 'Procesamiento IA', subtitle: 'Generando consejos personalizados...', duration: 3.0 },
          { title: 'Recomendaciones Listas', subtitle: '• Reducir gasto en café\n• Aumentar tasa de ahorro', duration: 2.5 }
        ],
        health: [
          { title: 'Análisis de Salud Financiera', subtitle: '1. Escaneo financiero integral', duration: 2.5 },
          { title: 'Calculando Puntuación', subtitle: 'Analizando ingresos, gastos, deudas...', duration: 3.0 },
          { title: 'Puntuación: 78/100', subtitle: 'Buena salud financiera con áreas de mejora', duration: 2.5 }
        ]
      },
      'sk-sk': {
        categorization: [
          { title: 'Inteligentná Kategorizácia', subtitle: '1. Nahrať Účtenku', duration: 2.5 },
          { title: 'AI Analýza Prebieha', subtitle: 'Analyzujem vzory obchodníkov...', duration: 3.0 },
          { title: 'Kategorizácia Dokončená', subtitle: '✓ Jedlo a Nápoje - 95% spoľahlivosť', duration: 2.5 }
        ],
        tips: [
          { title: 'Generovanie Poznatkov', subtitle: '1. Analyzujem výdavkové vzory', duration: 2.5 },
          { title: 'AI Spracovanie', subtitle: 'Generujem personalizované rady...', duration: 3.0 },
          { title: 'Odporúčania Pripravené', subtitle: '• Znížiť výdavky na kávu\n• Zvýšiť mieru úspor', duration: 2.5 }
        ],
        health: [
          { title: 'Analýza Finančného Zdravia', subtitle: '1. Komplexný finančný sken', duration: 2.5 },
          { title: 'Počítam Skóre Zdravia', subtitle: 'Analyzujem príjmy, výdavky, dlhy...', duration: 3.0 },
          { title: 'Skóre Zdravia: 78/100', subtitle: 'Dobré finančné zdravie s oblasťami na zlepšenie', duration: 2.5 }
        ]
      }
    };

    return translations[language][demoType] || translations['en-us'][demoType];
  }

  async generateFrame(scene, progress, frameNumber, demoType) {
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, this.width, this.height);
    gradient.addColorStop(0, '#3B82F6');
    gradient.addColorStop(1, '#8B5CF6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Title
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(scene.title, this.width / 2, 150);

    // Subtitle
    if (scene.subtitle) {
      ctx.font = '32px Arial';
      const lines = scene.subtitle.split('\n');
      lines.forEach((line, index) => {
        ctx.fillText(line, this.width / 2, 250 + (index * 50));
      });
    }

    // Demo-specific graphics
    this.addDemoGraphics(ctx, scene, demoType, progress);

    // Progress bar
    const barWidth = this.width * 0.6;
    const barHeight = 8;
    const barX = (this.width - barWidth) / 2;
    const barY = this.height - 80;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = 'white';
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    // Save frame
    const framePath = path.join(this.outputDir, `temp_frame_${frameNumber.toString().padStart(6, '0')}.png`);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(framePath, buffer);

    return framePath;
  }

  addDemoGraphics(ctx, scene, demoType, progress) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Simple animated elements based on scene content
    if (scene.subtitle.includes('Upload') || scene.subtitle.includes('Subir') || scene.subtitle.includes('Nahrať')) {
      // Receipt mockup
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(centerX - 150, centerY + 50, 300, 200);
      
      ctx.fillStyle = 'black';
      ctx.font = '24px Arial';
      ctx.fillText('Starbucks Coffee', centerX, centerY + 120);
      ctx.fillText('$4.95', centerX, centerY + 160);
      
    } else if (scene.subtitle.includes('Processing') || scene.subtitle.includes('Analizando') || scene.subtitle.includes('Analyzujem')) {
      // Loading animation
      const angle = progress * Math.PI * 4;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(centerX, centerY + 100, 50, 0, angle);
      ctx.stroke();
      
    } else if (scene.subtitle.includes('Complete') || scene.subtitle.includes('Ready') || scene.subtitle.includes('Score')) {
      // Success indicator
      ctx.fillStyle = '#10B981';
      ctx.fillRect(centerX - 200, centerY + 80, 400, 80);
      
      ctx.fillStyle = 'white';
      ctx.font = '28px Arial';
      
      if (demoType === 'categorization') {
        ctx.fillText('☕ Food & Beverages', centerX, centerY + 130);
      } else if (demoType === 'health') {
        ctx.fillText('Health Score: 78/100', centerX, centerY + 130);
      } else {
        ctx.fillText('✓ Tips Generated', centerX, centerY + 130);
      }
    }
  }

  async createVideoFromFrames(framePaths, outputPath) {
    return new Promise((resolve, reject) => {
      // Create a list file for FFmpeg
      const listPath = path.join(this.outputDir, 'temp_frames_list.txt');
      const listContent = framePaths.map(p => `file '${p}'`).join('\n');
      
      fs.writeFile(listPath, listContent).then(() => {
        const ffmpegArgs = [
          '-y', // overwrite
          '-f', 'concat',
          '-safe', '0',
          '-i', listPath,
          '-vf', `fps=${this.fps}`,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          outputPath
        ];

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);

        ffmpeg.stdout.on('data', (data) => {
          // console.log(`FFmpeg stdout: ${data}`);
        });

        ffmpeg.stderr.on('data', (data) => {
          // console.log(`FFmpeg stderr: ${data}`);
        });

        ffmpeg.on('close', async (code) => {
          // Clean up list file
          try {
            await fs.unlink(listPath);
          } catch (error) {
            console.warn('Failed to cleanup list file');
          }

          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`));
          }
        });

        ffmpeg.on('error', (error) => {
          reject(error);
        });
      }).catch(reject);
    });
  }
}

// Create demo videos
const creator = new DemoVideoCreator();
creator.createAllDemoVideos().catch(console.error);