import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Professional demo scripts for each feature and language
const demoScripts = {
  'en-us': {
    categorization: "Experience FinanzerPro's intelligent AI categorization system. Simply upload your receipt, and watch our advanced AI instantly analyze and categorize your expense with 95% accuracy. No more manual entry - just smart, automatic organization of your financial data.",
    tips: "Discover FinanzerPro's personalized AI financial insights. Our advanced algorithms analyze your spending patterns, identify opportunities for savings, and provide actionable recommendations tailored specifically to your financial goals and lifestyle.",
    health: "Unlock your complete financial picture with FinanzerPro's AI health analysis. Our comprehensive system examines your income, expenses, debts, and savings to calculate a detailed health score and provide specific improvement strategies."
  },
  'es-pe': {
    categorization: "Experimenta el sistema inteligente de categorización AI de FinanzerPro. Simplemente sube tu recibo y observa cómo nuestra IA avanzada analiza y categoriza instantáneamente tu gasto con 95% de precisión. No más entrada manual - solo organización inteligente y automática de tus datos financieros.",
    tips: "Descubre los insights financieros personalizados de FinanzerPro. Nuestros algoritmos avanzados analizan tus patrones de gasto, identifican oportunidades de ahorro y proporcionan recomendaciones accionables adaptadas específicamente a tus metas financieras y estilo de vida.",
    health: "Desbloquea tu panorama financiero completo con el análisis de salud AI de FinanzerPro. Nuestro sistema integral examina tus ingresos, gastos, deudas y ahorros para calcular un puntaje detallado de salud y proporcionar estrategias específicas de mejora."
  },
  'sk-sk': {
    categorization: "Zažite inteligentný AI kategorizačný systém FinanzerPro. Jednoducho nahrajte svoj účet a sledujte, ako naša pokročilá AI okamžite analyzuje a kategorizuje váš výdavok s 95% presnosťou. Žiadne manuálne zadávanie - len inteligentná, automatická organizácia vašich finančných údajov.",
    tips: "Objavte personalizované AI finančné poznatky FinanzerPro. Naše pokročilé algoritmy analyzují vaše vzory útrat, identifikujú príležitosti na úspory a poskytujú realizovateľné odporúčania prispôsobené špecificky vašim finančným cieľom a životnému štýlu.",
    health: "Odomknite váš kompletný finančný obraz s AI analýzou zdravia FinanzerPro. Náš komplexný systém skúma vaše príjmy, výdavky, dlhy a úspory na výpočet detailného skóre zdravia a poskytnutie špecifických stratégií zlepšenia."
  }
};

// Voice settings for each language
const voiceSettings = {
  'en-us': 'Rachel',    // Professional female English voice
  'es-pe': 'Domi',      // Professional Spanish voice  
  'sk-sk': 'Freya'      // Professional European voice for Slovak
};

async function createAllDemoVideos() {
  console.log('🎬 Creating all FinanzerPro demo videos with ElevenLabs narration...');
  
  const outputDir = path.join(__dirname, 'public', 'demo-videos');
  await fs.mkdir(outputDir, { recursive: true });
  
  const features = ['categorization', 'tips', 'health'];
  const languages = ['en-us', 'es-pe', 'sk-sk'];
  
  let successful = 0;
  let failed = 0;

  for (const feature of features) {
    for (const language of languages) {
      try {
        console.log(`\n📹 Creating ${feature} demo in ${language}...`);
        await createDemoVideo(feature, language, outputDir);
        successful++;
        console.log(`✅ Success: ${feature}-demo-${language}.mp4`);
      } catch (error) {
        failed++;
        console.error(`❌ Failed ${feature}-${language}:`, error.message);
      }
    }
  }
  
  console.log(`\n🎉 Demo video creation complete!`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Videos saved to: public/demo-videos/`);
}

async function createDemoVideo(feature, language, outputDir) {
  const script = demoScripts[language][feature];
  const voice = voiceSettings[language];
  const videoPath = path.join(outputDir, `${feature}-demo-${language}.mp4`);
  
  // Step 1: Generate professional narration with ElevenLabs
  console.log(`🎙️ Generating ${voice} narration...`);
  const audioResponse = await fetch('http://localhost:5000/api/demo/generate-narration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: script,
      voice: voice,
      language: language
    })
  });
  
  if (!audioResponse.ok) {
    throw new Error(`Narration failed: ${audioResponse.status}`);
  }
  
  const audioBuffer = await audioResponse.arrayBuffer();
  const audioPath = path.join(__dirname, `temp-audio-${feature}-${language}.mp3`);
  await fs.writeFile(audioPath, Buffer.from(audioBuffer));
  
  // Step 2: Get audio duration
  const duration = await getAudioDuration(audioPath);
  console.log(`⏱️ Duration: ${duration.toFixed(1)}s`);
  
  // Step 3: Create professional video with branding
  console.log(`🎬 Creating video...`);
  await createProfessionalVideo(audioPath, videoPath, feature, language, duration);
  
  // Cleanup
  await fs.unlink(audioPath);
}

async function createProfessionalVideo(audioPath, outputPath, feature, language, duration) {
  const titles = {
    'en-us': {
      categorization: 'Smart AI Categorization',
      tips: 'AI Financial Insights', 
      health: 'Financial Health Analysis'
    },
    'es-pe': {
      categorization: 'Categorización IA Inteligente',
      tips: 'Insights Financieros IA',
      health: 'Análisis de Salud Financiera'
    },
    'sk-sk': {
      categorization: 'Inteligentná AI Kategorizácia', 
      tips: 'AI Finančné Poznatky',
      health: 'Analýza Finančného Zdravia'
    }
  };

  const colors = {
    categorization: '#3B82F6', // Blue
    tips: '#10B981',           // Green  
    health: '#8B5CF6'          // Purple
  };

  const title = titles[language][feature];
  const color = colors[feature];
  
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', `color=c=${color}:size=1280x720:duration=${duration}`,
      '-i', audioPath,
      '-vf', [
        // Animated gradient background
        `fade=in:0:30,fade=out:${Math.max(0, (duration*30)-30)}:30`,
        // Semi-transparent overlay
        'drawbox=x=0:y=0:w=1280:h=720:color=black@0.4:t=fill',
        // FinanzerPro branding
        'drawtext=text=FinanzerPro:fontsize=48:fontcolor=white:x=50:y=50:fontfile=/System/Library/Fonts/Arial.ttf',
        // Feature title
        `drawtext=text='${title}':fontsize=36:fontcolor=white:x=50:y=120:fontfile=/System/Library/Fonts/Arial.ttf`,
        // AI-powered badge
        'drawtext=text="AI-Powered":fontsize=24:fontcolor=#FFD700:x=50:y=180:fontfile=/System/Library/Fonts/Arial.ttf',
        // Call to action
        'drawtext=text="Try FinanzerPro Today":fontsize=28:fontcolor=white:x=(w-text_w)/2:y=600:fontfile=/System/Library/Fonts/Arial.ttf'
      ].join(','),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-preset', 'medium',
      '-crf', '23',
      '-shortest',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    let errorOutput = '';
    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`));
      }
    });
  });
}

async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      audioPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(duration);
      } else {
        reject(new Error(`ffprobe failed: ${code}`));
      }
    });
  });
}

createAllDemoVideos();