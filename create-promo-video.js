import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Professional promotional script
const promoScript = "Transform your financial life with Kaptia. Upload receipts and watch AI instantly categorize expenses with 95% accuracy. Get personalized financial insights, track spending patterns, and receive actionable recommendations. Set budgets, achieve savings goals, and gain complete control over your money. Join thousands who've revolutionized their finances with our intelligent platform. Start your free account today and experience the future of personal finance management.";

async function createPromoVideo() {
  console.log('🎬 Creating Kaptia promotional video...');
  
  const outputDir = path.join(__dirname, 'public', 'demo-videos');
  await fs.mkdir(outputDir, { recursive: true });
  
  try {
    // Step 1: Generate narration with ElevenLabs
    console.log('🎤 Generating professional narration...');
    const audioPath = await generateNarration(promoScript, 'Rachel');
    
    if (!audioPath) {
      throw new Error('Failed to generate narration');
    }
    
    // Step 2: Get stock footage from Pixabay
    console.log('🎥 Fetching stock footage...');
    const videoPath = await getStockFootage('finance technology success business professional');
    
    if (!videoPath) {
      throw new Error('Failed to get stock footage');
    }
    
    // Step 3: Create final video
    console.log('🎬 Creating promotional video...');
    const outputPath = path.join(outputDir, 'kaptia-promo.mp4');
    
    const audioDuration = await getAudioDuration(audioPath);
    await createProfessionalVideo(audioPath, videoPath, outputPath, audioDuration);
    
    console.log(`✅ Promotional video created: ${outputPath}`);
    
    // Verify file
    const stats = await fs.stat(outputPath);
    console.log(`📊 Video file size: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);
    
    if (stats.size < 1024) {
      throw new Error('Video file too small - creation failed');
    }
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Error creating promotional video:', error.message);
    throw error;
  }
}

async function generateNarration(text, voice) {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.buffer();
    const audioPath = path.join(__dirname, 'temp-promo-narration.mp3');
    await fs.writeFile(audioPath, audioBuffer);
    
    console.log(`🎤 Narration generated: ${audioPath}`);
    return audioPath;
    
  } catch (error) {
    console.error('ElevenLabs narration error:', error.message);
    return null;
  }
}

async function getStockFootage(query) {
  try {
    const response = await fetch(`https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&category=business&min_duration=60&video_type=film&per_page=10`);
    
    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.hits && data.hits.length > 0) {
      // Get the first high-quality video
      const video = data.hits[0];
      const videoUrl = video.videos.large?.url || video.videos.medium?.url || video.videos.small?.url;
      
      if (videoUrl) {
        const videoResponse = await fetch(videoUrl);
        const videoBuffer = await videoResponse.buffer();
        const videoPath = path.join(__dirname, 'temp-promo-footage.mp4');
        await fs.writeFile(videoPath, videoBuffer);
        
        console.log(`🎥 Stock footage downloaded: ${videoPath}`);
        return videoPath;
      }
    }
    
    throw new Error('No suitable stock footage found');
    
  } catch (error) {
    console.error('Pixabay footage error:', error.message);
    return null;
  }
}

async function createProfessionalVideo(audioPath, videoPath, outputPath, duration) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', videoPath,
      '-i', audioPath,
      '-filter_complex', `
        [0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setpts=PTS*${duration/60}[v];
        [v]drawtext=text='Kaptia':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=50:fontfile=/System/Library/Fonts/Arial.ttf:enable='between(t,1,3)'[v1];
        [v1]drawtext=text='Smart Personal Finance Management':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=150:fontfile=/System/Library/Fonts/Arial.ttf:enable='between(t,1,3)'[v2];
        [v2]drawtext=text='AI-Powered • Receipt Scanning • Budget Tracking':fontsize=28:fontcolor=white:x=(w-text_w)/2:y=h-100:fontfile=/System/Library/Fonts/Arial.ttf:enable='between(t,${duration-3},${duration})'[vout]
      `,
      '-map', '[vout]',
      '-map', '1:a',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:v', '2M',
      '-b:a', '128k',
      '-r', '30',
      '-t', duration.toString(),
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    ffmpeg.stderr.on('data', (data) => {
      console.log(`FFmpeg: ${data}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Video creation completed');
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}`));
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
        reject(new Error('Failed to get audio duration'));
      }
    });
  });
}

// Run the video creation
createPromoVideo()
  .then((videoPath) => {
    console.log('🎉 Promotional video creation completed!');
    console.log(`📁 Video saved to: ${videoPath}`);
  })
  .catch((error) => {
    console.error('💥 Video creation failed:', error.message);
    process.exit(1);
  });