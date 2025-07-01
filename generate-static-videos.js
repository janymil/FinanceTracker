const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('node-fetch');

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

async function createVideoWithNarration(audioPath, outputPath, demoType, language) {
  console.log('Creating video with narration...');

  // Get audio duration first
  const duration = await getAudioDuration(audioPath);
  
  // Create video with text overlays and smooth animations
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', `color=c=#1e40af:size=1280x720:duration=${duration}`,
      '-i', audioPath,
      '-vf', getVideoFilters(demoType, language, duration),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stderr.on('data', (data) => {
      // console.log(`FFmpeg: ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
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

// Generate all demo videos
async function generateAllVideos() {
  const demoTypes = ['categorization', 'tips', 'health'];
  const languages = ['en-us', 'es-pe', 'sk-sk'];

  console.log('🎬 Starting demo video generation...');

  for (const demoType of demoTypes) {
    for (const language of languages) {
      try {
        await generateDemoVideo(demoType, language);
      } catch (error) {
        console.error(`❌ Failed to create ${demoType} video in ${language}:`, error.message);
      }
    }
  }

  console.log('🎉 All demo videos completed!');
}

// Run the generator
generateAllVideos().catch(console.error);