# CreateSuite Video Tour

This directory contains the Remotion project for creating the CreateSuite video tour.

## Prerequisites

- Node.js 18 or later
- Chrome/Chromium (automatically downloaded by Remotion on first render)

## Structure

- `src/Root.tsx` - Main Remotion root component
- `src/CreateSuiteTour.tsx` - Video composition with all scenes
- `src/index.ts` - Entry point
- `remotion.config.ts` - Remotion configuration

## Development

### Preview the video in Remotion Studio

```bash
npm run remotion:preview
```

This will open the Remotion Studio in your browser where you can:
- Preview the video
- Adjust timing and animations
- Export individual frames
- Make live edits

### Render the video

```bash
npm run video:build
```

This will render the full video to `public/tour.mp4`.

### CLI Commands

From the main project:

```bash
# Build the video
cs video

# Preview in Remotion Studio
cs video --preview

# View the landing page with the video
cs tour
```

## Video Specifications

- **Duration**: 18 seconds (540 frames at 30 FPS)
- **Resolution**: 1920x1080 (Full HD)
- **Format**: MP4
- **Codec**: H.264

## Scenes

1. **Title Scene**: Sassy introduction
2. **First-Class Agents**: "Actual Workers"
3. **Git-Based Tracking**: "Git-Backed Drama"
4. **Convoy Orchestration**: "Squad Goals"
5. **CLI Demo**: Fast-paced CLI showoff
6. **Call to Action**: Demanding installation instructions

## Customization

To customize the video:

1. Edit `src/CreateSuiteTour.tsx`
2. Adjust colors, timing, or content
3. Preview changes with `npm run remotion:preview`
4. Render the final video with `npm run video:build`

## Troubleshooting

### Chrome Download Issues

If you encounter issues downloading Chrome, you can:

1. Set `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
2. Point to an existing Chrome installation with `CHROME_PATH`
3. Use the `--browser-executable` flag

### Memory Issues

For large videos, increase Node.js memory:

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run video:build
```

## Learn More

- [Remotion Documentation](https://www.remotion.dev/)
- [CreateSuite Documentation](../README.md)
