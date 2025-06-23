# Fresh Fly.io Deployment Instructions

## Current Status
- Old deployment has cached issues running `server.js` instead of `index.js`
- All files are now correctly configured for fresh deployment

## Steps to Deploy Fresh

1. **Delete existing Fly.io app:**
   ```bash
   cd external-services/ai-processor
   fly apps destroy finanserpro-ai-processor
   ```

2. **Create new Fly.io app:**
   ```bash
   fly apps create finanserpro-ai-processor-v2
   ```

3. **Update fly.toml with new app name:**
   ```toml
   app = "finanserpro-ai-processor-v2"
   ```

4. **Set environment variable:**
   ```bash
   fly secrets set OPENAI_API_KEY=your_openai_key
   ```

5. **Deploy fresh:**
   ```bash
   fly deploy
   ```

## Verified Configuration

✅ **index.ts** - Imports sophisticated functions from openai-functions.ts
✅ **openai-functions.ts** - Original TypeScript with all sophisticated AI logic  
✅ **package.json** - Correct dependencies (express, cors, dotenv, openai, typescript)
✅ **Dockerfile** - Compiles TypeScript and runs index.js
✅ **fly.toml** - Explicit process definition and dockerfile specification

## Expected Result
- Service will run `node index.js` (not server.js)
- TypeScript compilation during Docker build
- All dependencies properly installed
- Sophisticated AI functions working via /execute-gpt-task endpoint