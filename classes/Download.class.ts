import * as path from "node:path";
import { promises as fsPromises } from 'node:fs';
import youtubedl, {exec} from 'youtube-dl-exec';
import consola from "consola";
import ffmpeg from "fluent-ffmpeg";

const lineBreak = '\n';

interface DownloadOptions {
    outputDir: string;
    outputFile: string;
    defaultQuality: string;
    defaultVideoQuality: string;
    defaultAudioQuality: string;
}

export default class Download {
    private readonly url: string;
    private title: string | undefined;
    private info: any | undefined;

    private readonly options: DownloadOptions;

    public constructor(url: string) {
        this.url = url;
        this.options = {
            outputDir: '.output',
            outputFile: 'video.mp4',
            defaultQuality: 'bestvideo+bestaudio/best',
            defaultVideoQuality: 'bestvideo',
            defaultAudioQuality: 'bestaudio',
        };
    }

    /**
     * Initialize the download process
     * @returns Promise<void>
     */
    public async init(): Promise<void> {
        consola.box(this.url);
        consola.info(`Your video will be downloaded in the '${this.options.outputDir}' folder` + lineBreak);
        consola.start('Initializing video information...');
        try {
            this.info = await youtubedl(this.url, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                preferFreeFormats: true,
                addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
            });
        } catch (error) {
            consola.error(error)
        }
        this.title = await this.info.title;
        consola.success('Initialization complete' + lineBreak);
    }

    public getUrl(): string {
        return this.url;
    }

    public getInfo(): any | undefined {
        return this.info;
    }

    public getTitle(): string | undefined {
        return this.title;
    }

    /**
     * Slugify the title
     * @returns {string} The slugified title
     */
    public slugifyTitle(): string {
        return this.getTitle()!
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();
    }

    /**
     * Set the output file
     * @param file
     * @returns {string} The output file
     */
    public setOutputFile(file: string): string {
        this.options.outputFile = file;
        return this.options.outputFile;
    }

    public getOutputFile(): string {
        return this.options.outputFile
    }

    /**
     * Set the output directory
     * @param dir
     * @returns {string} The output directory
     */
    public setOutputDir(dir: string): string {
        this.options.outputDir = dir;
        return this.options.outputDir;
    }

    public getOutputDir(): string {
        return this.options.outputDir
    }

    /**
     * Set the default quality
     * @param quality
     * @returns {string} The default quality
     */
    public setDefaultQuality(quality: string): string {
        this.options.defaultQuality = quality;
        return this.options.defaultQuality;
    }

    public getDefaultQuality(): string {
        return this.options.defaultQuality
    }

    /**
     * Set the audio format
     * @param format
     * @returns {string} The audio format
     */
    public setAudioFormat(format: string): string {
        this.options.defaultAudioQuality = format;
        return this.options.defaultAudioQuality;
    }

    public getAudioFormat(): string {
        return this.options.defaultAudioQuality
    }

    /**
     * Set the video format
     * @param format
     * @returns {string} The video format
     */
    public setVideoFormat(format: string): string {
        this.options.defaultVideoQuality = format;
        return this.options.defaultVideoQuality;
    }

    public getVideoFormat(): string {
        return this.options.defaultVideoQuality
    }

    public getOptions(): DownloadOptions {
        return this.options;
    }

    public getOutputPath(): string {
        return path.join(this.options.outputDir!, this.options.outputFile);
    }

    /**
     * Ensure the directory exists
     * @param filePath
     * @private
     */
    private async ensureDirectoryExists(filePath: string): Promise<void> {
        const directory = path.dirname(filePath);
        try {
            await fsPromises.access(directory);
        } catch (error) {
            await fsPromises.mkdir(directory, { recursive: true });
        }
    }

    /**
     * Download the video
     * @returns The path to the downloaded video
     * @throws Error if the download fails
     */
    public async download(format: string = this.options.defaultQuality): Promise<string> {
        try {
            await this.init();

            consola.start('Starting download process');
            const outputPath = await this.downloadProcess(format);
            consola.success('Download complete');
            consola.info(`Downloaded video to: '${outputPath}'` + lineBreak);
            return outputPath;
        } catch (error) {
            consola.error('An error occurred while downloading the video:', error);
            throw error;
        }
    }

    /**
     * Start the download process
     * @param format
     */
    public async downloadProcess(format: string = this.options.defaultQuality): Promise<string | Error> {
        try {
            const outputPath = path.join(this.options.outputDir!, this.options.outputFile);
            await this.ensureDirectoryExists(outputPath);
            const downloadProcess = youtubedl.exec(this.url, {
                format: format,
                recodeVideo: "mp4",
                output: outputPath,
                verbose: true,
            });
            await downloadProcess;
            await new Promise(resolve => setTimeout(resolve, 5000));
            return outputPath;
        } catch(error) {
            consola.error('An error occurred while downloading the video', error);
        }
    }

}