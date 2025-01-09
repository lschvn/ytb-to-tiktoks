import { promises as fs } from 'fs';
import youtubedl from 'youtube-dl-exec';
import consola from 'consola';
import Editor from './classes/Editor.class';
import Ffmpeg from 'fluent-ffmpeg';
import path from 'path';

async function downloadVideo(url: string, quality = 'best', outputFile) {
    consola.info(`Téléchargement de la vidéo depuis : ${url} avec la qualité ${quality}...`);
    try {
        const options = {
            format: quality,
            output: outputFile,
            recodeVideo: 'mp4',
        };

        // Utilisation directe de exec avec await
        await youtubedl.exec(url, options);
        consola.success(`Téléchargement terminé : ${outputFile}`);
        return outputFile;
    } catch (error) {
        consola.error(`Erreur lors du téléchargement : ${error.message}`);
        throw error;
    }
}

async function mergeVideoAudio(videoPath, audioPath, outputPath) {
    return new Promise((resolve, reject) => {
        Ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions([
                '-c:v copy',
                '-c:a aac',
                '-strict experimental'
            ]).save(outputPath)
            .on('end', () => {
                consola.success(`Fusion terminée : ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                consola.error('Erreur lors de la fusion :', err);
                reject(err);
            });
    });
}

async function downloadVideoAndAudio(url, outputDir = '.output') {
    try {
        // Télécharger la vidéo
        const videoOptions = {
            format: 'bestvideo[ext=mp4]',
            output: path.join(outputDir, 'temp_video.mp4'),
        };

        // Télécharger l'audio
        const audioOptions = {
            format: 'bestaudio[ext=m4a]',
            output: path.join(outputDir, 'temp_audio.m4a'),
        };

        consola.info('Téléchargement de la vidéo...');
        await youtubedl.exec(url, videoOptions);

        consola.info('Téléchargement de l\'audio...');
        await youtubedl.exec(url, audioOptions);

        return {
            videoPath: videoOptions.output,
            audioPath: audioOptions.output
        };
    } catch (error) {
        consola.error(`Erreur lors du téléchargement : ${error.message}`);
        throw error;
    }
}

async function main() {
    try {
        // Création du dossier .output s'il n'existe pas
        const outputDir = '.output';
        await fs.mkdir(outputDir, { recursive: true });

        const urlTop = 'https://www.youtube.com/watch?v=XzALa9BXSHQ';
        const urlBottom = 'https://www.youtube.com/watch?v=YNC8bJnwwxo';

        // Téléchargement de la première vidéo
        consola.info('Téléchargement de la première vidéo...');
        const { audioPath, videoPath } = await downloadVideoAndAudio(urlTop, outputDir);

        // Fusion audio/vidéo
        const pathTop = path.join(outputDir, 'output.mp4');
        await mergeVideoAudio(videoPath, audioPath, pathTop);

        // Téléchargement de la seconde vidéo
        consola.info('Téléchargement de la seconde vidéo...');
        const pathBottom = path.join(outputDir, 'video-bottom.mp4');
        await downloadVideo(urlBottom, 'bestvideo[ext=mp4]', pathBottom);

        // Création du short
        const editor = new Editor();
        const outputShortPath = path.join(outputDir, 'output-short.mp4');
        await editor.makeShorts(pathTop, pathBottom, outputShortPath);

        // Découpage en parties
        const partDuration = 1000 * 105;
        const title = 'LES OBJETS INSOLITES';
        const outputFolder = path.join(outputDir, 'short');

        await fs.mkdir(outputFolder, { recursive: true });
        const outputPaths = await editor.splitVideo(outputShortPath, partDuration, title, outputFolder);
        consola.success('Vidéos créées :', outputPaths);

        // Nettoyage des fichiers temporaires
        await fs.unlink(videoPath);
        await fs.unlink(audioPath);
    } catch (error) {
        consola.error('Une erreur est survenue :', error);
        process.exit(1);
    }
}

main().catch((error) => {
    consola.error('Une erreur inattendue est survenue :', error.message);
});
