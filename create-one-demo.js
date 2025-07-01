import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Just create one demo video for testing
const script = "Experience FinanzerPro's intelligent AI categorization system. Simply upload your receipt, and watch our advanced AI instantly analyze and categorize your expense with 95% accuracy. No more manual entry - just smart, automatic organization of your financial data.";

async function createQuickDemo() {
  console.log('🎬 Creating quick demo video...');
  
  const outputDir = path.join(__dirname, 'public', 'demo-videos');
  await fs.mkdir(outputDir, { recursive: true });
  
  const videoPath = path.join(outputDir, 'categorization-demo-en-us.mp4');
  
  try {
    // Step 1: Generate ElevenLabs narration
    console.log('🎙️ Generating narration...');
    const audioResponse = await fetch('http://localhost:5000/api/demo/generate-narration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: script,
        voice: 'Rachel', // Professional female voice
        language: 'en-us'
      })
    });
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioPath = path.join(__dirname, 'temp-audio.mp3');
    await fs.writeFile(audioPath, Buffer.from(audioBuffer));
    console.log('✅ Narration generated');
    
    // Step 2: Get audio duration
    const duration = await getAudioDuration(audioPath);
    console.log(`🕐 Audio duration: ${duration}s`);
    
    // Step 3: Create simple video with gradient background and text
    console.log('🎬 Creating video...');
    await createSimpleVideo(audioPath, videoPath, duration);
    
    // Cleanup
    await fs.unlink(audioPath);
    
    console.log(`✅ Demo video created: ${videoPath}`);
    
  } catch (error) {
    console.error('❌ Error creating demo:', error);
  }
}

async function createSimpleVideo(audioPath, outputPath, duration) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', `color=c=#1e40af:size=1280x720:duration=${duration}`,
      '-i', audioPath,
      '-vf', [
        'drawbox=x=0:y=0:w=1280:h=720:color=black@0.4:t=fill',
        'drawtext=text=FinanzerPro:fontsize=48:fontcolor=white:x=50:y=50',
        'drawtext=text="Smart AI Categorization":fontsize=36:fontcolor=white:x=50:y=120',
        'drawtext=text="Try FinanzerPro Today":fontsize=28:fontcolor=#3B82F6:x=(w-text_w)/2:y=600'
      ].join(','),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed: ${code}`));
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

createQuickDemo();