import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import fetch from 'node-fetch';

// Simple demo creation with just narration over stock footage
async function createSimpleDemo() {
  console.log('Creating simple demo video...');
  
  const outputDir = path.join(process.cwd(), 'public', 'demo-videos');
  await fs.mkdir(outputDir, { recursive: true });
  
  try {
    // Generate narration
    const audioResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: "Transform your financial life with FinanzerPro. Upload receipts and watch AI instantly categorize expenses with 95% accuracy. Get personalized financial insights and take control of your money today.",
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      })
    });

    if (!audioResponse.ok) {
      throw new Error(`ElevenLabs API error: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioPath = path.join(process.cwd(), 'temp-demo-audio.mp3');
    await fs.writeFile(audioPath, Buffer.from(audioBuffer));
    
    console.log('Audio generated successfully');
    
    // Get stock footage
    const pixabayResponse = await fetch(`https://pixabay.com/api/videos/?key=${process.env.PIXABAY_API_KEY}&q=finance+business+technology&category=business&min_duration=20&per_page=5`);
    
    if (!pixabayResponse.ok) {
      throw new Error(`Pixabay API error: ${pixabayResponse.status}`);
    }
    
    const pixabayData = await pixabayResponse.json();
    
    if (!pixabayData.hits || pixabayData.hits.length === 0) {
      throw new Error('No stock footage found');
    }
    
    const video = pixabayData.hits[0];
    const videoUrl = video.videos.medium?.url || video.videos.small?.url;
    
    if (!videoUrl) {
      throw new Error('No video URL found');
    }
    
    const videoResponse = await fetch(videoUrl);
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoPath = path.join(process.cwd(), 'temp-demo-video.mp4');
    await fs.writeFile(videoPath, Buffer.from(videoBuffer));
    
    console.log('Stock footage downloaded successfully');
    
    // Create simple combined video
    const outputPath = path.join(outputDir, 'categorization-demo-en-us.mp4');
    
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-i', audioPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        '-y',
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('Video created successfully');
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });
      
      ffmpeg.stderr.on('data', (data) => {
        console.log(`FFmpeg: ${data}`);
      });
    });
    
    // Check file size
    const stats = await fs.stat(outputPath);
    console.log(`Video file size: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);
    
    if (stats.size > 1024) {
      console.log('✅ Demo video created successfully!');
      return outputPath;
    } else {
      throw new Error('Video file too small');
    }
    
  } catch (error) {
    console.error('Error creating demo:', error.message);
    throw error;
  }
}

// Run the creation
createSimpleDemo()
  .then(() => console.log('Demo creation completed'))
  .catch(error => {
    console.error('Demo creation failed:', error.message);
    process.exit(1);
  });