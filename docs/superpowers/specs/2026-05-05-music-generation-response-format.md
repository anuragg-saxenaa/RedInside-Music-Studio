# Music Generation API - Response Format Fix

**Date**: 2026-05-05
**Issue**: Music generation times out (60s) when using hex audio format
**Root Cause**: `output_format` defaults to `hex` which returns large audio inline

## Problem

MiniMax music generation API supports two response formats:
1. **hex** (default) - Audio returned as hex-encoded string inline
2. **url** - Audio returned as signed download URL

For songs > ~30s, hex format exceeds timeout threshold.

## Solution

Set `output_format: "url"` in request and parse URL from response.

## Request Format

```json
{
  "model": "music-2.6",
  "prompt": "<style description>",
  "lyrics": "<full lyrics with structure tags>",
  "audio_setting": {
    "sample_rate": 44100,
    "bitrate": 256000,
    "format": "mp3"
  },
  "output_format": "url"
}
```

## Response Format (url mode)

```json
{
  "data": {
    "audio": "https://minimax-algeng-chat-tts-us.oss-us-east-1.aliyuncs.com/music%2Fprod%2Ftts-20260505052323-VULEFXJrSEIhcjJh.mp3?Expires=...&Signature=...",
    "status": 2
  },
  "extra_info": {
    "music_duration": 128470,
    "music_sample_rate": 44100,
    "music_channel": 2,
    "bitrate": 256000,
    "music_size": 4117180
  },
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

**Note:** `music_duration` is in milliseconds. Divide by 1000 for seconds.

## Implementation Changes

### music.service.js
1. Add `output_format: 'url'` to request params
2. Parse `data.audio` as URL string (not hex buffer)
3. Download file from URL using axios
4. Save downloaded buffer to storage

### Changes Required

**Request construction:**
```javascript
const requestParams = {
  model,
  lyrics: lyricsContent,
  audio_setting: audioSettings || {},
  output_format: 'url',  // ADD THIS
};
```

**Response handling:**
```javascript
// OLD (hex format):
const audioBuffer = Buffer.from(response.data.audio, 'hex');

// NEW (url format):
const audioUrl = response.data.audio;  // URL string
const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
const audioBuffer = Buffer.from(audioResponse.data);
```

## Verification

Test with working Postman collection - same request body should succeed via our API.
