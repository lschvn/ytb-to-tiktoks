import ffmpeg, {ffprobe} from "fluent-ffmpeg"
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import ffprobeInstaller from "@ffprobe-installer/ffprobe"

import fs from "node:fs";

import consola from "consola";
import cliProgress from "cli-progress";
import exec from "node:child_process";
import path from "node:path";


/**
 * TODO:
 *  Make a query builder for the ffmpeg commands
 *  And add a last method execute() to execute the command
 *
 * - Options number of parts, from when, time for each parts,
 * - Options for output file name
 * - Options for output directory
 * - Options for subtitles
 * - Options for audio
 *
 * Method to cut the video in parts
 * Method to addSubs
 * Method to change font size, font color, font family
 * Method to add title
 *
 * Method to add audio
 * Method to change audio volume
 *
 * Method to convert a 16;9 video to a 9:16 video
 * Method to merge to video as a short format on video on top of the other (topVideoPath, bottomVideoPath)
 *
 * Method to add a watermark (not important)
 *
 * Method to formatText
 * @class Editor
 */
export default class Editor {
    constructor() {
        this.ffmpegInit();
    }

    private ffmpegInit() {
        consola.info("Initializing ffmpeg and ffprobe...");
        try {
            // Définir le chemin de FFmpeg depuis le package
            ffmpeg.setFfmpegPath(ffmpegInstaller.path);

            // Vérifier si FFprobe est disponible globalement
            const globalFfprobePath = this.findGlobalExecutable("ffprobe");
            if (globalFfprobePath) {
                ffmpeg.setFfprobePath(globalFfprobePath);
                consola.success(`Using global FFprobe: ${globalFfprobePath}`);
            } else {
                // Fallback vers le chemin fourni par @ffprobe-installer
                ffmpeg.setFfprobePath(ffprobeInstaller.path);
                consola.success(`Using FFprobe from installer: ${ffprobeInstaller.path}`);
            }

            consola.success("FFmpeg and FFprobe initialized successfully");
        } catch (e) {
            consola.error("Error initializing FFmpeg/FFprobe:", e);
        }
    }

    private findGlobalExecutable(executable) {
        try {
            const { execSync } = require("child_process");
            const command = process.platform === "win32" ? `where ${executable}` : `which ${executable}`;
            const path = execSync(command).toString().trim();
            return path || null;
        } catch {
            return null;
        }
    }

    public progressBar(text: string = 'In Progress') {
        return new cliProgress.SingleBar({
            format: `◐ ${text} |{bar}| {percentage}% || {value}/{total} seconds`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
    }

    private onError(err: Error) {
        if(err != null && typeof err === 'object') {
            consola.error(err.message);
        } else {
            consola.error(err);
        }
        process.exit(1);
    }

    private formatText(text: string): string {
        let result = [];
        let index = 0;
        while (index < text.length) {
            let endIndex = index + 25;
            if (endIndex < text.length && text[endIndex] !== ' ' && text.lastIndexOf(' ', endIndex) > index) {
                endIndex = text.lastIndexOf(' ', endIndex);
            }
            result.push(text.substring(index, endIndex));
            index = endIndex + 1;
        }
        return result.join("\\\n");
    }

    public async addMusic(videoPath: string, audioPath: string, output: string): Promise<void> {
        const videoHasAudio = await this.checkForAudio(videoPath);

        return new Promise((resolve, reject) => {
            const progressBar = this.progressBar();

            let duration = 0;
            let started = false;

            let filterComplex = ['[0:a][1:a]amix=inputs=2:duration=longest[aout]'];
            if(!videoHasAudio) {
                filterComplex = ['[1:a]apad[aout]'];
            }

            ffmpeg()
                .input(videoPath)
                .input(audioPath)
                .complexFilter(filterComplex)
                .outputOptions([
                    '-map 0:v',
                    '-map [aout]',
                    '-c:v copy',
                    '-c:a aac',
                    '-shortest'
                ])
                .toFormat('mp4')
                .save(output)
                .on('start', (commandLine) => {
                    consola.start('Spawned Ffmpeg with command: ' + commandLine);
                })
                .on("codecData", (data) => {
                    duration = parseInt(data.duration.replace(/:/g, ''));
                    progressBar.start(duration, 0);
                    started = true;
                })
                .on("progress", (progress) => {
                    if (started) {
                        const time = parseInt(progress.timemark.replace(/:/g, ''));
                        progressBar.update(time);
                    }
                })
                .on('end', () => {
                    progressBar.stop();
                    consola.success('Music added successfully');
                    consola.info('Find the file at:', output);
                    resolve();
                })
                .on('error', (err, stdout, stderr) => {
                    progressBar.stop();
                    consola.error('Error:', err.message);
                    consola.error('ffmpeg stdout:', stdout);
                    consola.error('ffmpeg stderr:', stderr);
                    reject(err);
                });
        });
    }

    public async removeMusic(videoPath: string, output: string = videoPath): Promise<void> {

        if (videoPath === output) {
            output = videoPath.replace('.mp4', '_no_music_video.mp4');
        }

        console.log(videoPath, output, videoPath === output);

        return new Promise((resolve, reject) => {
            const progressBar = this.progressBar();

            let duration = 0;
            let started = false;

            ffmpeg()
                .input(videoPath)
                .outputOptions([
                    '-c:v copy',
                    '-an'
                ])
                .toFormat('mp4')
                .save(output)
                .on('start', (commandLine) => {
                    consola.start('Spawned Ffmpeg with command: ' + commandLine);
                })
                .on("codecData", (data) => {
                    duration = parseInt(data.duration.replace(/:/g, ''));
                    progressBar.start(duration, 0);
                    started = true;
                })
                .on("progress", (progress) => {
                    if (started) {
                        const time = parseInt(progress.timemark.replace(/:/g, ''));
                        progressBar.update(time);
                    }
                })
                .on('end', () => {
                    progressBar.stop();
                    consola.success('Music removed successfully');
                    consola.info('Find the file at:', output);
                    resolve();
                })
                .on('error', (err, stdout, stderr) => {
                    progressBar.stop();
                    consola.error('Error:', err.message);
                    consola.error('ffmpeg stdout:', stdout);
                    consola.error('ffmpeg stderr:', stderr);
                    reject(err);
                });
        });
    }

    public async makeVertical(videoPath: string, outputPath: string = videoPath): Promise<void> {
        return new Promise((resolve, reject) => {
            const progressBar = this.progressBar();

            if (videoPath === outputPath) {
                outputPath = videoPath.replace('.mp4', '_vertical.mp4');
            }

            let duration = 0;
            let started = false;

            ffmpeg(videoPath)
                .videoFilters([
                    {
                        filter: 'crop',
                        options: 'ih*9/16:ih'
                    },
                    {
                        filter: 'scale',
                        options: '1080:1920'
                    }
                ])
                .outputOptions(['-c:a copy'])
                .save(outputPath)
                .on('start', (commandLine) => {
                    consola.start('Spawned Ffmpeg with command: ' + commandLine);
                })
                .on("codecData", (data) => {
                    duration = parseInt(data.duration.replace(/:/g, ''));
                    progressBar.start(duration, 0);
                    started = true;
                })
                .on("progress", (progress) => {
                    if (started) {
                        const time = parseInt(progress.timemark.replace(/:/g, ''));
                        progressBar.update(time);
                    }
                })
                .on('end', () => {
                    progressBar.stop();
                    consola.success('Video converted to vertical format successfully');
                    consola.info('Find the file at:', outputPath);
                    resolve();
                })
                .on('error', (err, stdout, stderr) => {
                    progressBar.stop();
                    consola.error('Error:', err.message);
                    consola.error('ffmpeg stdout:', stdout);
                    consola.error('ffmpeg stderr:', stderr);
                    reject(err);
                });
        });
    }

    public makeShorts(topVideoPath: string, bottomVideoPath: string, output: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const progressBar = this.progressBar();
            let duration = 0;
            let started = false;

            if (typeof topVideoPath !== 'string' || typeof bottomVideoPath !== 'string') {
                reject(new Error('Les chemins des vidéos doivent être des chaînes de caractères'));
                return;
            }
            if (!fs.existsSync(topVideoPath) || !fs.existsSync(bottomVideoPath)) {
                reject(new Error('Un ou les deux fichiers vidéo n\'existent pas'));
                return;
            }

            function hasAudioStream(metadata: any): boolean {
                return metadata.streams.some((stream: { codec_type: string; }) => stream.codec_type === 'audio');
            }

            ffprobe(topVideoPath, (err, topMetadata) => {
                if (err) {
                    reject(new Error('Impossible de lire les métadonnées de la première vidéo'));
                    return;
                }

                ffprobe(bottomVideoPath, (err, bottomMetadata) => {
                    if (err) {
                        reject(new Error('Impossible de lire les métadonnées de la deuxième vidéo'));
                        return;
                    }

                    const topHasAudio = hasAudioStream(topMetadata);
                    const bottomHasAudio = hasAudioStream(bottomMetadata);

                    const topVideoDuration = topMetadata.format.duration;
                    consola.start('Merging videos..., this may take a while depending on the video size');
                    consola.info('Duration of the top video:', topVideoDuration);
                    consola.info('Top video has audio:', topHasAudio);
                    consola.info('Bottom video has audio:', bottomHasAudio);

                    let complexFilter;
                    if (topHasAudio && bottomHasAudio) {
                        complexFilter = [
                            '[0:v]crop=iw*9/16:ih,scale=1080:960[top]',
                            '[1:v]crop=iw*9/16:ih,scale=1080:960[bottom]',
                            '[top][bottom]vstack[v]',
                            '[0:a][1:a]amix=inputs=2[a]'
                        ];
                    } else if (topHasAudio) {
                        complexFilter = [
                            '[0:v]crop=iw*9/16:ih,scale=1080:960[top]',
                            '[1:v]crop=iw*9/16:ih,scale=1080:960[bottom]',
                            '[top][bottom]vstack[v]',
                            '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a]'
                        ];
                    } else if (bottomHasAudio) {
                        complexFilter = [
                            '[0:v]crop=iw*9/16:ih,scale=1080:960[top]',
                            '[1:v]crop=iw*9/16:ih,scale=1080:960[bottom]',
                            '[top][bottom]vstack[v]',
                            '[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a]'
                        ];
                    } else {
                        complexFilter = [
                            '[0:v]crop=iw*9/16:ih,scale=1080:960[top]',
                            '[1:v]crop=iw*9/16:ih,scale=1080:960[bottom]',
                            '[top][bottom]vstack[v]'
                        ];
                    }

                    let outputOptions = [
                        '-c:v libx264',
                        '-crf 18',
                        '-preset slow',
                        '-r 60',
                        `-t ${topVideoDuration}`
                    ];

                    if (topHasAudio || bottomHasAudio) {
                        outputOptions.push('-c:a aac', '-b:a 192k');
                    }

                    consola.info('Starting FFmpeg process...');

                    ffmpeg()
                        .input(topVideoPath)
                        .input(bottomVideoPath)
                        .complexFilter(complexFilter, ['v', 'a'])
                        .outputOptions(outputOptions)
                        .output(output)
                        .on('start', (commandLine) => {
                            consola.start('Spawned Ffmpeg with command: ' + commandLine);
                        })
                        .on("codecData", (data) => {
                            duration = parseInt(data.duration.replace(/:/g, ''));
                            progressBar.start(duration, 0);
                            started = true;
                        })
                        .on("progress", (progress) => {
                            if (started) {
                                const time = parseInt(progress.timemark.replace(/:/g, ''));
                                progressBar.update(time);
                            }
                        })
                        .on('end', () => {
                            progressBar.stop();
                            consola.success('Videos merged successfully');
                            consola.info('Find the file at:', output);
                            resolve();
                        })
                        .on('error', (err, stdout, stderr) => {
                            progressBar.stop();
                            consola.error('Error:', err.message);
                            consola.error('ffmpeg stdout:', stdout);
                            consola.error('ffmpeg stderr:', stderr);
                            reject(err);
                        })
                        .run();
                });
            });
        });
    }

    private async checkForAudio(filePath: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }

                const audioStreams = metadata.streams.filter(stream => stream.codec_type === 'audio');
                resolve(audioStreams.length > 0);
            });
        });
    }

    public async splitVideo(inputPath: string, partDuration: number, title: string, outputFolder: string): Promise<string[]> {
        // Vérifier si le fichier d'entrée existe
        if (!fs.existsSync(inputPath)) {
            throw new Error(`Le fichier d'entrée n'existe pas : ${inputPath}`);
        }

        // Créer le dossier de sortie s'il n'existe pas
        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }

        const outputPaths: string[] = [];
        partDuration = partDuration / 1000;

        try {
            const totalDuration = await this.getVideoDuration(inputPath);
            if (!totalDuration) {
                throw new Error("Impossible de déterminer la durée de la vidéo");
            }

            consola.warn("Ce processus peut prendre du temps selon la taille de la vidéo");
            console.log('Durée totale:', totalDuration);
            const numParts = Math.ceil(totalDuration / partDuration);
            consola.info('Durée totale de la vidéo:', totalDuration);
            consola.info('Nombre de parties:', numParts);

            for (let i = 0; i < numParts; i++) {
                const start = i * partDuration;
                const outputPath = path.join(outputFolder, `${title}-${i + 1}.mp4`);
                outputPaths.push(outputPath);

                const progressBar = this.progressBar();
                let duration = 0;
                let started = false;


                consola.start(`Creating part ${i + 1}...`);
                await new Promise<void>((resolve, reject) => {
                    ffmpeg(inputPath)
                        .setStartTime(start)
                        .setDuration(partDuration)
                        .videoFilters([
                            // First text (large and centered on a black box)
                            {
                                filter: 'drawtext',
                                options: {
                                    text: this.formatText(`Partie ${i + 1}`),
                                    fontcolor: 'white',
                                    fontsize: '100', // Increased font size
                                    box: '1',
                                    boxcolor: 'black@1',
                                    boxborderw: '20',
                                    //boxborderradius: '25',
                                    x: '(w-text_w)/2', // Centered horizontally
                                    y: '(h-text_h*2+65)/2', // Positioned to make room for second text
                                }
                            },
                            // Second text (black on a red box)
                            {
                                filter: 'drawtext',
                                options: {
                                    text: this.formatText(title),
                                    fontcolor: 'black',
                                    fontsize: '100',
                                    box: '1',
                                    boxcolor: 'red@0.8',
                                    boxborderw: '25',
                                    //boxborderradius: '25',
                                    x: '(w-text_w)/2', // Centered horizontally
                                    y: '((h-text_h*2)/2)+text_h+75', // Positioned below the first text
                                }
                            }
                        ])
                        .output(outputPath)
                        .on("codecData", (data) => {
                            duration = parseInt(data.duration.replace(/:/g, ''));
                            progressBar.start(duration, 0);
                            started = true;
                        })
                        .on("progress", (progress) => {
                            if (started) {
                                const time = parseInt(progress.timemark.replace(/:/g, ''));
                                progressBar.update(time);
                            }
                        })
                        .on('end', () => {
                            consola.success(`Part ${i + 1} created: ${outputPath}`);
                            resolve();
                        })
                        .on('error', (err) => {
                            consola.error(`Error creating part ${i + 1}:`, err);
                            reject(err);
                        })
                        .run();
                });
            }

            return outputPaths;
        } catch (error) {
            consola.error("Erreur lors du traitement de la vidéo:", error);
            throw error;
        }
    }

    private async getVideoDuration(inputPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(inputPath)) {
                reject(new Error(`Le fichier n'existe pas : ${inputPath}`));
                return;
            }

            ffmpeg.ffprobe(inputPath, (err, metadata) => {
                if (err) {
                    consola.error('Erreur lors de la lecture des métadonnées:', err);
                    reject(err);
                } else {
                    resolve(metadata.format.duration);
                }
            });
        });
    }
}