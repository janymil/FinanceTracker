import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Demo video scripts for marketing
const videoScripts = {
  'en-us': {
    categorization: "Welcome to FinanzerPro's intelligent transaction categorization. Watch as our AI instantly recognizes a Starbucks receipt and automatically categorizes it as Food and Beverages with 95% accuracy. No manual tagging required - our AI learns your spending patterns and gets smarter over time. Transform your financial tracking from tedious to effortless with FinanzerPro.",
    tips: "Discover FinanzerPro's AI financial advisor that analyzes your spending patterns to provide personalized recommendations. See how it identifies opportunities to reduce coffee expenses by 20% and suggests optimized saving strategies. Get insights that adapt to your lifestyle and help you reach your financial goals faster.",
    health: "Experience FinanzerPro's comprehensive financial health analysis. Our AI examines your income, expenses, debts, and savings to calculate a detailed health score. Get specific improvement strategies to boost your score from 78 to 90 plus. Turn complex financial data into clear, actionable insights."
  },
  'es-pe': {
    categorization: "Bienvenido a la categorización inteligente de transacciones de FinanzerPro. Observe cómo nuestra IA reconoce instantáneamente un recibo de Starbucks y lo categoriza automáticamente como Comida y Bebidas con 95% de precisión. No se requiere etiquetado manual: nuestra IA aprende sus patrones de gasto y se vuelve más inteligente con el tiempo.",
    tips: "Descubra el asesor financiero IA de FinanzerPro que analiza sus patrones de gasto para brindar recomendaciones personalizadas. Vea cómo identifica oportunidades para reducir los gastos de café en un 20% y sugiere estrategias de ahorro optimizadas. Obtenga insights que se adaptan a su estilo de vida.",
    health: "Experimente el análisis integral de salud financiera de FinanzerPro. Nuestra IA examina sus ingresos, gastos, deudas y ahorros para calcular una puntuación detallada de salud. Obtenga estrategias específicas de mejora para aumentar su puntuación de 78 a más de 90."
  },
  'sk-sk': {
    categorization: "Vitajte v inteligentnej kategorizácii transakcií FinanzerPro. Sledujte, ako naša AI okamžite rozpozná účtenku zo Starbucks a automaticky ju kategorizuje ako Jedlo a Nápoje s 95% presnosťou. Nie je potrebné manuálne označovanie - naša AI sa učí vaše výdavkové vzory a stáva sa inteligentnejšou.",
    tips: "Objavte AI finančného poradcu FinanzerPro, ktorý analyzuje vaše výdavkové vzory a poskytuje personalizované odporúčania. Pozrite si, ako identifikuje príležitosti na zníženie výdavkov na kávu o 20% a navrhuje optimalizované stratégie šetrenia.",
    health: "Zažite komplexnú analýzu finančného zdravia FinanzerPro. Naša AI skúma vaše príjmy, výdavky, dlhy a úspory na výpočet detailného skóre zdravia. Získajte konkrétne stratégie zlepšenia na zvýšenie vášho skóre z 78 na viac ako 90."
  }
};

async function generateDemoVideo(demoType, language) {
  const outputDir = path.join(__dirname, 'public', 'demo-videos');
  await fs.mkdir(outputDir, { recursive: true });

  const videoPath = path.join(outputDir, `${demoType}-demo-${language}.mp4`);
  const script = videoScripts[language]?.[demoType] || videoScripts['en-us'][demoType];

  console.log(`Creating ${demoType} demo video in ${language}...`);

  // Step 1: Download stock footage from Pixabay
  const stockFootage = await downloadStockFootage(demoType);

  // Step 2: Generate audio narration using ElevenLabs
  const audioPath = await generateNarration(script, language, demoType);

  // Step 3: Create professional video with stock footage and narration
  await createProfessionalVideo(stockFootage, audioPath, videoPath, demoType, language);

  console.log(`✅ Created: ${videoPath}`);
  
  // Cleanup temporary files
  await cleanupTempFiles([audioPath, ...stockFootage.map(f => f.path)]);
}

async function downloadStockFootage(demoType) {
  console.log(`📥 Downloading stock footage for ${demoType}...`);
  
  const searchTerms = {
    categorization: ['artificial intelligence', 'receipt scanning', 'mobile payment'],
    tips: ['financial planning', 'data analysis', 'business growth'],
    health: ['financial health', 'investment planning', 'money management']
  };

  const terms = searchTerms[demoType] || searchTerms.categorization;
  const footage = [];

  for (let i = 0; i < terms.length; i++) {
    try {
      const term = terms[i];
      const apiUrl = `https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(term)}&category=business&video_type=film&min_duration=5&per_page=3`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.hits && data.hits.length > 0) {
        const video = data.hits[0];
        const videoUrl = video.videos.medium.url;
        const localPath = path.join(__dirname, `temp-footage-${demoType}-${i}.mp4`);
        
        await downloadFile(videoUrl, localPath);
        footage.push({
          path: localPath,
          duration: video.duration,
          tags: video.tags
        });
        
        console.log(`✅ Downloaded: ${term} footage`);
        break; // Use first successful download for this scene
      }
    } catch (error) {
      console.warn(`⚠️ Failed to download footage for ${terms[i]}:`, error.message);
    }
  }

  // If no videos found, create a simple background
  if (footage.length === 0) {
    console.log('📹 Creating fallback background...');
    const fallbackPath = await createFallbackBackground(demoType);
    footage.push({ path: fallbackPath, duration: 10, tags: 'generated' });
  }

  return footage;
}

async function downloadFile(url, filepath) {
  const response = await fetch(url);
  const buffer = await response.buffer();
  await fs.writeFile(filepath, buffer);
}

async function createFallbackBackground(demoType) {
  const fallbackPath = path.join(__dirname, `temp-background-${demoType}.mp4`);
  
  // Create animated gradient background with FFmpeg
  return new Promise((resolve, reject) => {
    const colors = {
      categorization: '#3B82F6:#8B5CF6',
      tips: '#10B981:#3B82F6', 
      health: '#8B5CF6:#EC4899'
    };

    const colorGradient = colors[demoType] || colors.categorization;
    
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', `color=c=${colorGradient.split(':')[0]}:size=1280x720:duration=10`,
      '-vf', `fade=in:0:30,fade=out:270:30`,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-y',
      fallbackPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(fallbackPath);
      else reject(new Error(`Fallback creation failed: ${code}`));
    });
  });
}

async function generateNarration(text, language, demoType) {
  console.log('Generating narration with ElevenLabs...');
  
  const audioPath = path.join(__dirname, `temp-narration-${demoType}-${language}.mp3`);
  
  // Call the existing ElevenLabs service from the application
  const response = await fetch('http://localhost:5000/api/demo/generate-narration', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text,
      language: language
    })
  });

  if (!response.ok) {
    throw new Error(`Narration generation failed: ${response.statusText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  await fs.writeFile(audioPath, Buffer.from(audioBuffer));
  
  console.log('✅ Narration generated');
  return audioPath;
}

async function createProfessionalVideo(stockFootage, audioPath, outputPath, demoType, language) {
  console.log('🎬 Creating professional video with stock footage and narration...');

  const duration = await getAudioDuration(audioPath);
  
  // Step 1: Create background video first
  const tempVideoPath = path.join(__dirname, `temp-video-${demoType}-${language}.mp4`);
  
  // Scale and loop stock footage, add text overlays
  const videoResult = await new Promise((resolve, reject) => {
    const textOverlay = getSimplifiedOverlays(demoType, language, duration);
    
    const ffmpegArgs = [
      '-i', stockFootage[0].path,
      '-vf', `scale=1280:720,${textOverlay}`,
      '-t', duration.toString(),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-y',
      tempVideoPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    ffmpeg.stderr.on('data', (data) => {
      console.log(`Video creation: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Video creation failed: ${code}`));
    });
  });

  // Step 2: Add audio to video
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', tempVideoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    ffmpeg.stderr.on('data', (data) => {
      console.log(`Audio mixing: ${data}`);
    });

    ffmpeg.on('close', async (code) => {
      // Cleanup temp file
      try {
        await fs.unlink(tempVideoPath);
      } catch (error) {
        // Ignore cleanup errors
      }
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Audio mixing failed: ${code}`));
      }
    });
  });
}

function getSimplifiedOverlays(demoType, language, duration) {
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

  const title = titles[language]?.[demoType] || titles['en-us'][demoType];
  
  return [
    // Semi-transparent overlay
    `drawbox=x=0:y=0:w=1280:h=720:color=black@0.4:t=fill`,
    // FinanzerPro brand
    `drawtext=text='FinanzerPro':fontsize=48:fontcolor=white:x=50:y=50`,
    // Feature title
    `drawtext=text='${title}':fontsize=36:fontcolor=white:x=50:y=120`,
    // Call to action
    `drawtext=text='Try FinanzerPro Today':fontsize=28:fontcolor=#3B82F6:x=(w-text_w)/2:y=600`
  ].join(',');
}

async function downloadBackgroundMusic() {
  console.log('🎵 Downloading background music...');
  
  try {
    // Search for royalty-free background music on Pixabay
    const musicUrl = `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=background+music+corporate&category=music&audio_type=music&per_page=3`;
    const response = await fetch(musicUrl);
    const data = await response.json();
    
    if (data.hits && data.hits.length > 0) {
      const music = data.hits[0];
      const audioUrl = music.webformatURL; // Use preview for demo
      const musicPath = path.join(__dirname, 'temp-background-music.mp3');
      
      await downloadFile(audioUrl, musicPath);
      console.log('✅ Background music downloaded');
      return musicPath;
    }
  } catch (error) {
    console.warn('⚠️ Failed to download background music, using silence');
  }
  
  // Create silent background as fallback
  const silentPath = path.join(__dirname, 'temp-silent-bg.mp3');
  await createSilentAudio(silentPath, 10);
  return silentPath;
}

async function createSilentAudio(outputPath, duration) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
      '-t', duration.toString(),
      '-c:a', 'mp3',
      '-y',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Silent audio creation failed: ${code}`));
    });
  });
}

function getProfessionalOverlays(demoType, language, duration) {
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

  const title = titles[language]?.[demoType] || titles['en-us'][demoType];
  
  // Professional overlay with branding, title, and feature highlights
  return [
    // Semi-transparent overlay
    `drawbox=x=0:y=0:w=1280:h=720:color=black@0.3:t=fill`,
    // FinanzerPro logo/brand
    `drawtext=text='FinanzerPro':fontsize=48:fontcolor=white:x=50:y=50:enable='between(t,0,${duration})'`,
    // Feature title with fade in
    `drawtext=text='${title}':fontsize=36:fontcolor=white:x=50:y=120:enable='between(t,1,${duration})'`,
    // Feature highlights that appear sequentially  
    ...getFeatureHighlights(demoType, language, duration),
    // Call to action at the end
    `drawtext=text='Try FinanzerPro Today':fontsize=32:fontcolor=#3B82F6:x=(w-text_w)/2:y=600:enable='between(t,${duration-3},${duration})'`
  ].join(':');
}

function getFeatureHighlights(demoType, language, duration) {
  const highlights = {
    'en-us': {
      categorization: ['✓ 95% Accuracy', '✓ Instant Results', '✓ Smart Learning'],
      tips: ['✓ Personalized Advice', '✓ Pattern Analysis', '✓ Goal Optimization'],
      health: ['✓ Complete Health Scan', '✓ Improvement Strategies', '✓ Progress Tracking']
    },
    'es-pe': {
      categorization: ['✓ 95% Precisión', '✓ Resultados Instantáneos', '✓ Aprendizaje Inteligente'],
      tips: ['✓ Consejos Personalizados', '✓ Análisis de Patrones', '✓ Optimización de Metas'],
      health: ['✓ Escaneo Completo', '✓ Estrategias de Mejora', '✓ Seguimiento de Progreso']
    },
    'sk-sk': {
      categorization: ['✓ 95% Presnosť', '✓ Okamžité Výsledky', '✓ Inteligentné Učenie'],
      tips: ['✓ Personalizované Rady', '✓ Analýza Vzorov', '✓ Optimalizácia Cieľov'],
      health: ['✓ Kompletný Sken', '✓ Stratégie Zlepšenia', '✓ Sledovanie Pokroku']
    }
  };

  const features = highlights[language]?.[demoType] || highlights['en-us'][demoType];
  
  return features.map((feature, index) => {
    const startTime = 2 + (index * 1.5);
    const endTime = Math.min(startTime + 2, duration);
    const yPos = 250 + (index * 50);
    
    return `drawtext=text='${feature}':fontsize=28:fontcolor=white:x=50:y=${yPos}:enable='between(t,${startTime},${endTime})'`;
  });
}

function getVideoFilters(demoType, language, duration) {
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

  const title = titles[language]?.[demoType] || titles['en-us'][demoType];
  
  // Create animated text overlays with fade effects
  const filters = [
    // Background gradient
    `color=c=#1e40af:size=1280x720:duration=${duration}[bg]`,
    // Logo/title text
    `[bg]drawtext=text='FinanzerPro':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=100:enable='between(t,0,${duration})'[title]`,
    // Feature title
    `[title]drawtext=text='${title}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=200:enable='between(t,1,${duration})'[feature]`,
    // Demo scenes with fade effects
    getDemoSceneFilters(demoType, language, duration)
  ].filter(Boolean).join(',');

  return filters;
}

function getDemoSceneFilters(demoType, language, duration) {
  const scenes = {
    categorization: [
      { text: '1. Upload Receipt', start: 2, end: 4 },
      { text: '2. AI Analysis', start: 4, end: 6 },
      { text: '3. Instant Results', start: 6, end: duration }
    ],
    tips: [
      { text: '1. Pattern Analysis', start: 2, end: 4 },
      { text: '2. AI Processing', start: 4, end: 6 },
      { text: '3. Smart Recommendations', start: 6, end: duration }
    ],
    health: [
      { text: '1. Financial Scan', start: 2, end: 4 },
      { text: '2. Health Calculation', start: 4, end: 6 },
      { text: '3. Improvement Plan', start: 6, end: duration }
    ]
  };

  const demoScenes = scenes[demoType] || scenes.categorization;
  
  return demoScenes.map((scene, index) => {
    const y = 350 + (index * 60);
    return `drawtext=text='${scene.text}':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=${y}:enable='between(t,${scene.start},${scene.end})'`;
  }).join(':');
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
        resolve(duration || 10); // fallback to 10 seconds
      } else {
        resolve(10); // fallback duration
      }
    });

    ffprobe.on('error', () => {
      resolve(10); // fallback duration
    });
  });
}

async function cleanupTempFiles(files) {
  for (const file of files) {
    try {
      await fs.unlink(file);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Generate all demo videos
async function generateAllVideos() {
  const demoTypes = ['categorization', 'tips', 'health'];
  const languages = ['en-us', 'es-pe', 'sk-sk'];

  console.log('🎬 Starting professional demo video generation with ElevenLabs + Pixabay...');
  console.log('Features: ✅ Stock footage ✅ Professional narration ✅ Background music ✅ Multilingual');

  for (const demoType of demoTypes) {
    for (const language of languages) {
      try {
        await generateDemoVideo(demoType, language);
      } catch (error) {
        console.error(`❌ Failed to create ${demoType} video in ${language}:`, error.message);
      }
    }
  }

  console.log('🎉 All professional demo videos completed!');
  console.log('📁 Videos saved to: public/demo-videos/');
  console.log('🔗 Available formats: categorization-demo-{lang}.mp4, tips-demo-{lang}.mp4, health-demo-{lang}.mp4');
}

// Run the generator
generateAllVideos().catch(console.error);