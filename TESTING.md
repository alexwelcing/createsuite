# Testing the CreateSuite Video Tour

This document outlines how to test the video tour functionality.

## Prerequisites

- Node.js 18 or later installed
- Chrome or Chromium browser installed
- Internet connection for downloading Chrome Headless Shell (first render only)

## Build and Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

## Testing the Video Tour Feature

### 1. Test the Landing Page

Open the landing page directly in a browser:

```bash
# Using the CLI
npm run start tour

# Or directly open
open public/index.html  # macOS
xdg-open public/index.html  # Linux
start public/index.html  # Windows
```

**Expected Result:**
- Browser opens showing the CreateSuite landing page
- Page displays features, quick start guide, and CTA section
- Video player is visible (may show placeholder if video not rendered)

### 2. Test Video Preview (Remotion Studio)

Preview the video composition in Remotion Studio:

```bash
# Using npm script
npm run remotion:preview

# Or using CLI
npm run start video -- --preview
```

**Expected Result:**
- Remotion Studio opens in browser (usually at http://localhost:3000)
- Video composition "CreateSuiteTour" is visible in the sidebar
- Can play, pause, and scrub through the video timeline
- All 6 scenes render correctly:
  1. Title Scene (frames 0-150)
  2. First-Class Agents (frames 150-300)
  3. Git-Based Tracking (frames 300-450)
  4. Convoy Orchestration (frames 450-600)
  5. CLI Demo (frames 600-750)
  6. Call to Action (frames 750-900)

### 3. Test Video Rendering

Render the final video:

```bash
# Using npm script
npm run video:build

# Or using CLI
npm run start video
```

**Expected Result:**
- Chrome Headless Shell downloads (first time only)
- Rendering progress displays in terminal
- Video renders frame by frame
- Final video saved to `public/tour.mp4`
- File size should be approximately 5-10 MB
- Video duration should be 30 seconds (900 frames at 30 FPS)

### 4. Test Complete Flow

Test the complete user flow:

```bash
# 1. Build the video
npm run start video

# 2. Open the landing page with video
npm run start tour
```

**Expected Result:**
- Landing page opens with fully rendered video
- Video plays automatically (muted) and loops
- User can control playback (play/pause/seek)
- Video displays all scenes smoothly

## Verifying Agent Skills Configuration

Check that agent skills are properly defined:

```bash
cat agent-skills.json
```

**Expected Result:**
- JSON file with agent skill categories
- Five main categories: Frontend, Backend, Testing, DevOps, Documentation
- Best practices and communication guidelines included

## Troubleshooting

### Issue: Chrome Download Fails

**Solution:**
- Check internet connection
- Try manually setting Chrome path:
  ```bash
  export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
  ```

### Issue: Video Rendering is Slow

**Solution:**
- Close other applications
- Increase Node.js memory:
  ```bash
  NODE_OPTIONS=--max-old-space-size=4096 npm run video:build
  ```

### Issue: Landing Page Opens but Video Doesn't Play

**Solution:**
- Ensure video file exists at `public/tour.mp4`
- Check browser console for errors
- Verify video format is MP4 with H.264 codec

### Issue: TypeScript Compilation Errors

**Solution:**
- Run `npm install` to ensure all dependencies are installed
- Check that React types are installed:
  ```bash
  npm install --save-dev @types/react @types/react-dom
  ```

## Manual Testing Checklist

- [ ] Landing page opens in browser
- [ ] Video player is visible on landing page
- [ ] Features section displays correctly
- [ ] Quick start commands are readable
- [ ] CTA section displays install command
- [ ] Remotion Studio launches successfully
- [ ] All 6 video scenes render in preview
- [ ] Video can be scrubbed through timeline
- [ ] Final video renders to MP4 file
- [ ] Video plays in browser from landing page
- [ ] Video quality is acceptable (1080p)
- [ ] Video duration is correct (30 seconds)
- [ ] CLI commands work as expected
- [ ] Documentation is clear and accurate

## Performance Expectations

- **Build time:** 1-2 minutes
- **Video render time:** 3-5 minutes (first time), 2-3 minutes (subsequent)
- **Landing page load time:** < 1 second
- **Video file size:** 5-10 MB
- **Preview startup time:** 10-15 seconds

## Success Criteria

✅ All CLI commands execute without errors
✅ Landing page displays correctly in multiple browsers
✅ Video renders successfully with all scenes
✅ Video plays smoothly on landing page
✅ Agent skills configuration is valid JSON
✅ Documentation is complete and accurate
