import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure media directory exists
const mediaDir = path.join(__dirname, 'media');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
    console.log(`Created media directory at ${mediaDir}`);
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Simple route to serve the video player page
app.get('/', (_req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Start Express server
app.listen(PORT, () => {
        console.log(`Express server listening on port ${PORT}`);
});

// MediaMTX configuration
const mediaMtxConfig = {
    rtmpPort: 1935,
    httpApiPort: 9997,
    hlsPort: 8000
};

// Path to MediaMTX executable (can be overridden with environment variable)
const mediaMtxPath = "./Frontend/mediamtx.exe" || 'mediamtx';

// Launch MediaMTX as a separate process
let mediaMtx;
try {
    console.log(`Attempting to start MediaMTX from: ${mediaMtxPath}`);
    
    // Check if the executable exists when a full path is provided
    if (mediaMtxPath.includes('/') || mediaMtxPath.includes('\\')) {
        if (!fs.existsSync(mediaMtxPath)) {
            throw new Error(`MediaMTX executable not found at path: ${mediaMtxPath}`);
        }
    }
    
    mediaMtx = spawn(mediaMtxPath, [
        `./Frontend/mediamtx.yml`
    ]);
    
    mediaMtx.stdout.on('data', (data) => {
        console.log(`MediaMTX: ${data}`);
    });
    
    mediaMtx.stderr.on('data', (data) => {
        console.error(`MediaMTX Error: ${data}`);
    });
    
    mediaMtx.on('close', (code) => {
        console.log(`MediaMTX process exited with code ${code}`);
    });
    
    console.log('MediaMTX started successfully');
} catch (error) {
    console.error('Failed to start MediaMTX:', error);
    console.error('To fix this issue:');
    console.error('1. Install MediaMTX from https://github.com/bluenviron/mediamtx/releases');
    console.error('2. Make sure it\'s in your PATH, or');
    console.error('3. Set the MEDIAMTX_PATH environment variable to the full path of the executable');
    console.error('   Example: MEDIAMTX_PATH=/path/to/mediamtx node server.js');
    console.error('The server will continue running without MediaMTX functionality.');
}

// Make sure MediaMTX is properly closed when Node.js exits
process.on('exit', () => {
    if (mediaMtx) {
        mediaMtx.kill();
    }
});

// API endpoint to list active streams
app.get('/api/streams', async (_req, res) => {
    try {
        // Query MediaMTX API for active streams
        const response = await axios.get(`http://localhost:${mediaMtxConfig.httpApiPort}/v1/paths`);
        res.json({
            active_streams: Object.keys(response.data),
            streams_details: response.data
        });
    } catch (error) {
        console.error('Failed to get streams from MediaMTX:', error);
        res.status(500).json({ error: 'Failed to fetch streams' });
    }
});

console.log(`RTMP server started on rtmp://localhost:${mediaMtxConfig.rtmpPort}`);
console.log(`HTTP server for streaming started on http://localhost:${mediaMtxConfig.hlsPort}`);
console.log('To view streams, visit: http://localhost:3000');
console.log('\nTo stream from OBS:');
console.log('1. In OBS, go to Settings > Stream');
console.log('2. Choose "Custom" service');
console.log(`3. Server: rtmp://localhost:${mediaMtxConfig.rtmpPort}/live`);
console.log('4. Stream Key: STREAM_NAME (can be anything you choose)');
console.log('\nFor HLS playback in browser, use:');
console.log(`http://localhost:${mediaMtxConfig.hlsPort}/live/STREAM_NAME/index.m3u8`);