/**
 * Test seed endpoints - ONLY for E2E testing
 * Creates music records directly without MiniMax API
 */
import { MusicModel } from '../../database/models/music.model.js';
import { ProjectModel } from '../../database/models/project.model.js';
import storage from '../../utils/storage.util.js';
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
          // Create project directories
          storage.createProjectDirs(project.id);
          const lyricsFilePath = storage.getLyricsFilePath(project.id, 1);
          fs.writeFileSync(lyricsFilePath, JSON.stringify({ content: 'Test lyrics content for E2E testing', style: 'hinglish-urban' }));

          // Update project with lyrics version
          await ProjectModel.update(project.id, {
            current_lyrics_version: 1
          });
        }

        if (music) {
          // Create project directories using storage utility
          storage.createProjectDirs(project.id);

          // Copy test fixture as music file using storage paths
          const fixtureSrc = path.join(process.cwd(), 'tests/fixtures/test-audio.mp3');
          const musicFilePath = storage.getMusicFilePath(project.id, 1, 'processed');
          if (fs.existsSync(fixtureSrc)) {
            fs.copyFileSync(fixtureSrc, musicFilePath);
          }

          // Create music record
          const musicRecord = MusicModel.create({
            projectId: project.id,
            version: 1,
            title: 'Test Music v1',
            originalFilePath: musicFilePath,
            processedFilePath: musicFilePath,
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
        const project = await ProjectModel.findById(projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Create project directories using storage utility
        storage.createProjectDirs(projectId);

        // Create music directory
        const musicDir = storage.getMusicDir(projectId);
        fs.mkdirSync(musicDir, { recursive: true });

        // Get next version
        const existingMusic = await MusicModel.getProjectMusic(projectId);
        const version = existingMusic.length > 0 ? Math.max(...existingMusic.map(m => m.version)) + 1 : 1;

        // Copy test fixture as music file using storage paths
        const fixtureSrc = path.join(process.cwd(), 'tests/fixtures/test-audio.mp3');
        const musicFilePath = storage.getMusicFilePath(projectId, version, 'processed');
        if (fs.existsSync(fixtureSrc)) {
          fs.copyFileSync(fixtureSrc, musicFilePath);
        }

        // Create music record
        const musicRecord = MusicModel.create({
          projectId,
          version,
          title: `Test Music v${version}`,
          originalFilePath: musicFilePath,
          processedFilePath: musicFilePath,
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
