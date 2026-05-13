/**
 * Test seed endpoints - ONLY for E2E testing
 * Creates music records directly without MiniMax API
 */
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import path from 'path';
import fs from 'fs';

export const TestRoutes = [
  {
    method: 'post',
    path: '/api/test/seed-project',
    handler: async (req, res, next) => {
      try {
        const { name = 'Test Project', lyrics = true, music = true } = req.body;

        // Create project
        const project = await ProjectModel.create({ name });

        if (lyrics) {
          // Create lyrics record
          const lyricsDir = path.join(process.cwd(), 'storage/projects', project.id, 'generations/lyrics');
          fs.mkdirSync(lyricsDir, { recursive: true });
          const lyricsFile = path.join(lyricsDir, 'v1.txt');
          fs.writeFileSync(lyricsFile, 'Test lyrics content for E2E testing');

          // Update project with lyrics version
          await ProjectModel.update(project.id, {
            current_lyrics_version: 1
          });
        }

        if (music) {
          // Create music directory
          const musicDir = path.join(process.cwd(), 'storage/projects', project.id, 'generations/music');
          fs.mkdirSync(musicDir, { recursive: true });

          // Copy test fixture as music file
          const fixtureSrc = path.join(process.cwd(), 'tests/fixtures/test-audio.mp3');
          const fixtureDest = path.join(musicDir, 'v1.mp3');
          if (fs.existsSync(fixtureSrc)) {
            fs.copyFileSync(fixtureSrc, fixtureDest);
          }

          // Create music record
          const musicRecord = MusicModel.create({
            projectId: project.id,
            version: 1,
            title: 'Test Music v1',
            originalFilePath: fixtureDest,
            processedFilePath: fixtureDest,
            model: 'test',
            durationSeconds: 30,
          });

          // Update project with music version
          await ProjectModel.update(project.id, {
            current_music_version: 1
          });
        }

        res.json({ project });
      } catch (error) {
        next(error);
      }
    }
  },
  {
    method: 'post',
    path: '/api/test/seed-music/:projectId',
    handler: async (req, res, next) => {
      try {
        const { projectId } = req.params;
        const { durationSeconds = 30 } = req.body;

        // Check project exists
        const project = await ProjectModel.get(projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Create music directory
        const musicDir = path.join(process.cwd(), 'storage/projects', projectId, 'generations/music');
        fs.mkdirSync(musicDir, { recursive: true });

        // Get next version
        const existingMusic = await MusicModel.getProjectMusic(projectId);
        const version = existingMusic.length > 0 ? Math.max(...existingMusic.map(m => m.version)) + 1 : 1;

        // Copy test fixture as music file
        const fixtureSrc = path.join(process.cwd(), 'tests/fixtures/test-audio.mp3');
        const fixtureDest = path.join(musicDir, `v${version}.mp3`);
        if (fs.existsSync(fixtureSrc)) {
          fs.copyFileSync(fixtureSrc, fixtureDest);
        }

        // Create music record
        const musicRecord = MusicModel.create({
          projectId,
          version,
          title: `Test Music v${version}`,
          originalFilePath: fixtureDest,
          processedFilePath: fixtureDest,
          model: 'test',
          durationSeconds,
        });

        // Update project music version
        await ProjectModel.update(projectId, {
          current_music_version: version
        });

        res.json({ music: musicRecord });
      } catch (error) {
        next(error);
      }
    }
  }
];
