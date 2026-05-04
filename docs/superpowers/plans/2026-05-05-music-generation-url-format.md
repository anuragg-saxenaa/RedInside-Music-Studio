# Music Generation URL Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix music generation timeout by using `output_format: url` and downloading from URL instead of hex inline

**Architecture:** Add `output_format: 'url'` to MiniMax request, parse URL from response, download file using axios

**Tech Stack:** Node.js, axios, MiniMax API

---

## Task 1: Update Music Service Request

**Files:**
- Modify: `backend/src/modules/music/music.service.js:44-65`

- [ ] **Step 1: Read current music.service.js request building section**

Read lines 44-65 to see current request construction.

- [ ] **Step 2: Add output_format to request params**

In `generateMusic()` method, find the requestParams construction and add `output_format: 'url'`:

```javascript
// Build request to MiniMax
const requestParams: any = {
  model,
  audio_setting: audioSettings || {},
  output_format: 'url',  // ADD THIS
};
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/music/music.service.js
git commit -m "feat: add output_format url to music generation request"
```

---

## Task 2: Update Music Service Response Handling

**Files:**
- Modify: `backend/src/modules/music/music.service.js:65-95`

- [ ] **Step 1: Read current response handling section**

Read lines 65-95 to see how response is currently processed.

- [ ] **Step 2: Update response handling for URL format**

Replace the hex buffer handling with URL download:

```javascript
// OLD code (hex format):
// const response = await this.client.generateMusic(requestParams);
// if (!response || !response.data) {
//   throw new Error('Invalid response from MiniMax API: missing data field');
// }
// if (response.data.status !== 2) {
//   throw new Error(`Music generation not ready, status: ${response.data.status}`);
// }
// const audioBuffer = Buffer.from(response.data.audio, 'hex');

// NEW code (url format):
const response = await this.client.generateMusic(requestParams);

if (!response || !response.data) {
  throw new Error('Invalid response from MiniMax API: missing data field');
}

if (response.data.status !== 2) {
  throw new Error(`Music generation not ready, status: ${response.data.status}`);
}

const audioUrl = response.data.audio;
if (!audioUrl || typeof audioUrl !== 'string') {
  throw new Error('Invalid response: audio URL not found');
}

// Download file from URL
logger.info('Downloading audio from URL', { audioUrl: audioUrl.substring(0, 50) + '...' });
const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
const audioBuffer = Buffer.from(audioResponse.data);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/music/music.service.js
git commit -m "feat: download audio from URL instead of hex decode"
```

---

## Task 3: Test Music Generation

**Files:**
- Test via: Postman or curl

- [ ] **Step 1: Verify server is running**

```bash
curl http://localhost:3000/health
```

- [ ] **Step 2: Create test project**

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"URL Format Test"}'
```

- [ ] **Step 3: Generate lyrics**

```bash
curl -X POST http://localhost:3000/api/lyrics/generate \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<project-id>","prompt":"Emotional Hindi song","stylePreset":"hinglish-urban"}'
```

- [ ] **Step 4: Queue music generation job**

```bash
curl -X POST http://localhost:3000/api/music/generate \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<project-id>","lyricsId":"<lyrics-id>","model":"music-2.6"}'
```

- [ ] **Step 5: Poll job until completed**

```bash
curl http://localhost:3000/api/jobs/<job-id>
```

- [ ] **Step 6: Verify music file exists**

Check `storage/projects/<project-id>/generations/music/` for file.

---

## Verification Checklist

- [ ] Health check returns `{"status":"ok"}`
- [ ] Project created successfully
- [ ] Lyrics generated successfully
- [ ] Music job queued and returns jobId
- [ ] Job completes without timeout error
- [ ] Music file saved to storage
- [ ] Music record exists in database with correct metadata
