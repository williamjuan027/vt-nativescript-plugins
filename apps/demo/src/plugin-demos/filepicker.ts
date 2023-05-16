import { EventData, Page, File, Frame, StackLayout, GridLayout, Color, Label, Image, alert, isAndroid, isIOS, knownFolders, Utils } from '@nativescript/core';
import { DemoSharedFilepicker } from '@demo/shared';
import { filePicker, galleryPicker, MediaType, getFreeMBs } from '@angelengineering/filepicker';
import { CheckBox } from '@nstudio/nativescript-checkbox';
import { TempFile } from '@angelengineering/filepicker/files';
import { check as checkPermission, request as requestPermission } from '@nativescript-community/perms';
import { FFmpeg } from '@triniwiz/nativescript-ffmpeg';
import { Video } from 'nativescript-videoplayer';

export function navigatingTo(args: EventData) {
  const page = <Page>args.object;
  page.bindingContext = new DemoModel();
}

export class DemoModel extends DemoSharedFilepicker {
  async pickDocs() {
    let pickedFiles: File[];
    const checkBox: CheckBox = Frame.topmost().getViewById('demoCheckbox');

    try {
      pickedFiles = await filePicker(MediaType.DOCUMENT, checkBox.checked);
    } catch (err) {
      if (err) alert(err?.message);
    } finally {
      this.handleFiles(pickedFiles);
    }
  }

  async pickImages() {
    let pickedFiles: File[];
    const checkBox: CheckBox = Frame.topmost().getViewById('demoCheckbox');

    try {
      pickedFiles = await filePicker(MediaType.IMAGE, checkBox.checked);
    } catch (err) {
      if (err) alert(err?.message);
    } finally {
      this.handleFiles(pickedFiles);
    }
  }
  async pickVideos() {
    let pickedFiles: File[];
    const checkBox: CheckBox = Frame.topmost().getViewById('demoCheckbox');
    try {
      let tempPath = TempFile.getPath('tempfile', 'tmp');
      let freeSpace = getFreeMBs(tempPath);

      console.log('free MBs on file picker temp directory', freeSpace);
      console.log('temp directory path: ', tempPath);
      if (freeSpace > 400) {
        //check before allowing picker to create temp copy of selected files
        pickedFiles = await filePicker(MediaType.VIDEO, checkBox.checked);
      } else alert('Low free space on device, picking not allowed');
    } catch (err) {
      if (err) alert(err?.message);
    } finally {
      this.handleFiles(pickedFiles);
    }
  }

  transcodeVideo(file: File): void {
    const inputFileType = file.extension.replace(/^\./, '');
    const outputPath = this.getPath('transcoded', `.${inputFileType}`);
    if (File.exists(outputPath)) {
      File.fromPath(outputPath).removeSync();
    }
    console.log('-- outputPath', outputPath);
    let duration = 0;
    FFmpeg.resetStatistics();
    FFmpeg.disableLogs();

    FFmpeg.enableStatisticsCallback((statisticsData) => {
      const time = statisticsData.time;
      const percentage = (time / 1000 / duration) * 100;
      console.log('Percent completed', percentage);
    });
    FFmpeg.executeWithArguments(['-i', file.path, '-vcodec', 'libx264', '-profile:v', 'baseline', '-level', '30', '-preset', 'veryfast', '-r', '15', '-g', '15', outputPath])
      .then((result) => {
        const compressedFile = File.fromPath(outputPath);
        const size = compressedFile ? compressedFile.size : 0;
        this.displayVideo(file, File.fromPath(outputPath));
      })
      .catch((error) => {
        console.log('Error', error);
      });
  }

  transcodeAudio(file: File): void {
    const inputFileType = file.extension.replace(/^\./, '');
    const outputPath = this.getPath('transcoded', `.${inputFileType}`);
    if (File.exists(outputPath)) {
      File.fromPath(outputPath).removeSync();
    }
    let duration = 0;
    FFmpeg.resetStatistics();
    FFmpeg.disableLogs();

    FFmpeg.enableStatisticsCallback((statisticsData) => {
      const time = statisticsData.time;
      const percentage = (time / 1000 / duration) * 100;
      console.log('Percent completed', percentage);
    });
    FFmpeg.executeWithArguments(['-i', file.path, '-vn', '-ac', '2', outputPath])
      .then((result) => {
        const compressedFile = File.fromPath(outputPath);
        const size = compressedFile ? compressedFile.size : 0;
        this.displayVideo(file, File.fromPath(outputPath));
      })
      .catch((error) => {
        console.log('Error', error);
      });
  }

  async pickAudio() {
    let pickedFiles: File[];
    const checkBox: CheckBox = Frame.topmost().getViewById('demoCheckbox');
    try {
      pickedFiles = await filePicker(MediaType.AUDIO, checkBox.checked);
    } catch (err) {
      if (err) alert(err?.message);
    } finally {
      // this.handleFiles(pickedFiles);
      this.transcodeAudio(pickedFiles[0]);
    }
  }

  async pickArchives() {
    let pickedFiles: File[];
    const checkBox: CheckBox = Frame.topmost().getViewById('demoCheckbox');
    try {
      pickedFiles = await filePicker(MediaType.ARCHIVE, checkBox.checked);
    } catch (err) {
      if (err) alert(err?.message);
    } finally {
      this.handleFiles(pickedFiles);
    }
  }

  async pickAll() {
    let pickedFiles: File[];
    const checkBox: CheckBox = Frame.topmost().getViewById('demoCheckbox');
    try {
      pickedFiles = await filePicker(MediaType.ALL, checkBox.checked);
    } catch (err) {
      if (err) alert(err?.message);
    } finally {
      this.handleFiles(pickedFiles);
    }
  }

  async pickImageVideo() {
    let pickedFiles: File[];
    const checkBox: CheckBox = Frame.topmost().getViewById('demoCheckbox');
    //on Android, thils will not trigger a perm request
    //on iOS, this will ask user only the first time. Once denied, user has to change in settings
    checkPermission('photo').then(async (permres) => {
      if (permres[0] == 'undetermined' || permres[0] == 'authorized') {
        await requestPermission('photo').then(async (result) => {
          if (result[0] == 'authorized') {
            try {
              pickedFiles = await galleryPicker(MediaType.IMAGE + MediaType.VIDEO, checkBox.checked);
            } catch (err) {
              if (err) alert(err?.message);
            } finally {
              const pickedFile = pickedFiles[0];
              if (['.mp4', '.mov', '.m4a'].includes(pickedFile.extension)) {
                this.transcodeVideo(pickedFile);
              } else {
                this.handleFiles(pickedFiles);
              }
            }
          } else alert("No permission for files, can't open picker");
        });
      } else alert("No permission for files, can't open  Grant this permission in app settings first");
    });
  }

  getSizeInMb(size: number, decimals: number = 2): string {
    if (!size) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

    const i = Math.floor(Math.log(size) / Math.log(k));

    return `${parseFloat((size / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }
  displayVideo(og: File, compressed: File): void {
    const itemList: StackLayout = Frame.topmost().getViewById('pickedFiles');
    itemList.removeChildren();
    const fileContainer = new GridLayout();
    fileContainer['rows'] = 'auto, auto, auto';
    fileContainer['columns'] = '*, 8, *';
    fileContainer['padding'] = 5;
    fileContainer['margin'] = '1 5';
    fileContainer['borderBottomColor'] = new Color('black');
    fileContainer['borderBottomWidth'] = 1;

    const videoLabelOg = new Label();
    videoLabelOg.text = 'Original';
    videoLabelOg.fontSize = 16;
    videoLabelOg.row = 0;
    videoLabelOg.col = 0;
    fileContainer.addChild(videoLabelOg);

    const videoSizeOg = new Label();
    videoSizeOg.text = `Size: ${(this, this.getSizeInMb(og.size))}`;
    videoSizeOg.fontSize = 14;
    videoSizeOg.row = 1;
    videoSizeOg.col = 0;
    fileContainer.addChild(videoSizeOg);

    const ogVideo = new Video();
    ogVideo.height = 300;
    ogVideo.src = og.path;
    ogVideo.backgroundColor = new Color('#dedede');
    ogVideo.borderRadius = 5;
    ogVideo.row = 3;
    ogVideo.col = 0;
    fileContainer.addChild(ogVideo);

    const videoLabelCompressed = new Label();
    videoLabelCompressed.text = 'Compressed';
    videoLabelCompressed.fontSize = 16;
    videoLabelCompressed.row = 0;
    videoLabelCompressed.col = 2;
    fileContainer.addChild(videoLabelCompressed);

    const videoSizeCompressed = new Label();
    videoSizeCompressed.text = `Size: ${(this, this.getSizeInMb(compressed.size))}`;
    videoSizeCompressed.fontSize = 14;
    videoSizeCompressed.row = 1;
    videoSizeCompressed.col = 2;
    fileContainer.addChild(videoSizeCompressed);

    const compressedVideo = new Video();
    compressedVideo.height = 300;
    compressedVideo.src = compressed.path;
    compressedVideo.backgroundColor = new Color('#dedede');
    compressedVideo.borderRadius = 5;
    compressedVideo.row = 3;
    compressedVideo.col = 2;
    fileContainer.addChild(compressedVideo);
    itemList.addChild(fileContainer);
  }

  handleFiles(results: File[]): void {
    console.log('showed the picker, results:', results);
    const itemList: StackLayout = Frame.topmost().getViewById('pickedFiles');
    itemList.removeChildren();
    if (results)
      results.forEach((file: File) => {
        const fileContainer = new GridLayout();
        fileContainer['rows'] = 'auto';
        fileContainer['columns'] = 'auto, 8, *';
        fileContainer['padding'] = 5;
        fileContainer['margin'] = '1 5';
        fileContainer['borderBottomColor'] = new Color('black');
        fileContainer['borderBottomWidth'] = 1;

        const textContainer = new StackLayout();
        textContainer['row'] = 0;
        textContainer['col'] = 2;
        const fileLabel = new Label();
        fileLabel.text = file['originalFilename'];
        fileLabel.textWrap = true;
        fileLabel.color = new Color('black');
        fileLabel.row = 0;
        fileLabel.col = 2;
        textContainer.addChild(fileLabel);

        const pathLabel = new Label();
        pathLabel.text = `Path: ${file.path}`;
        pathLabel.textWrap = true;
        pathLabel.color = new Color('black');
        pathLabel.verticalAlignment = 'top';
        pathLabel.row = 1;
        pathLabel.col = 2;
        textContainer.addChild(pathLabel);
        fileContainer.addChild(textContainer);

        const previewImage = new Image();
        previewImage.width = 100;
        previewImage.height = 100;
        previewImage.src = file.path;
        previewImage.backgroundColor = new Color('yellow');
        previewImage.borderRadius = 5;
        previewImage.stretch = 'aspectFit';
        previewImage.row = 0;
        previewImage.rowSpan = 2;
        previewImage.col = 0;
        fileContainer.addChild(previewImage);
        itemList.addChild(fileContainer);
      });
  }

  getPath(prefix: string, suffix: string): string {
    let path: string = null;
    if (isAndroid) {
      const context = Utils.android.getApplicationContext();
      const dir = context.getExternalCacheDir() || context.getCacheDir();
      const file = java.io.File.createTempFile(prefix, suffix, dir);
      path = file.getAbsolutePath();
    } else if (isIOS) {
      const name: string = NSUUID.UUID().UUIDString;
      path = knownFolders.temp().getFile(prefix + name + suffix).path;
    }
    return path;
  }
}
