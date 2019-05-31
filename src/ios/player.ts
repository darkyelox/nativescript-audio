import * as app from 'tns-core-modules/application';
import * as utils from 'tns-core-modules/utils/utils';
import { isString } from 'tns-core-modules/utils/types';
import { knownFolders, path } from 'tns-core-modules/file-system';
import { TNSPlayerI, TNSPlayerUtil, TNS_Player_Log } from '../common';
import { AudioPlayerOptions, AudioPlayerEvents } from '../options';
import { Deferred } from 'ts-deferred';

declare var AVAudioPlayer;

export class TNSPlayer extends NSObject implements TNSPlayerI {
  // public static ObjCProtocols = [AVAudioPlayerDelegate];

  public static ObjCExposedMethods = {
    // 'observeValueForKeyPathOfObjectChangeContext': { returns: interop.types.void, params: [interop.types.id, interop.types.id, interop.types.id, interop.types.id] },
    audioPlayerDidFinishPlayingSuccessfully: { returns: interop.types.void, params: [interop.types.id] }
  };

  private _player: AVPlayer;
  private _task: NSURLSessionDataTask;
  private _completeCallback: any;
  private _errorCallback: any;
  private _infoCallback: any;

  private prepareDeferred: Deferred<boolean>;
  private playDeferred: Deferred<boolean>;

  get ios(): any {
    return this._player;
  }

  set debug(value: boolean) {
    TNSPlayerUtil.debug = value;
  }

  public get volume(): number {
    return this._player ? this._player.volume : 0;
  }

  public set volume(value: number) {
    if (this._player && value >= 0) {
      this._player.volume = value;
    }
  }

  public get duration() {
    if (this._player) {
      const duration = CMTimeGetSeconds(this._player.currentItem.asset.duration);
      TNS_Player_Log('duration', duration);
      return duration;
    } else {
      return 0;
    }
  }

  get currentTime(): number {
    return this._player ? CMTimeGetSeconds(this._player.currentItem.currentTime()) : 0;
  }

  public initFromFile(options: AudioPlayerOptions): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      // init only
      options.autoPlay = false;
      this.playFromFile(options).then(resolve, reject);
    });
  }

  public playFromFile(options: AudioPlayerOptions): Promise<boolean> {
    // only if not explicitly set, default to true
    if (options.autoPlay !== false) {
      options.autoPlay = true;
    }

    try {
      let audioPath;

      let fileName = isString(options.audioFile) ? options.audioFile.trim() : '';
      if (fileName.indexOf('~/') === 0) {
        fileName = path.join(knownFolders.currentApp().path, fileName.replace('~/', ''));
      }
      TNS_Player_Log('fileName', fileName);

      this._completeCallback = options.completeCallback;
      this._errorCallback = options.errorCallback;
      this._infoCallback = options.infoCallback;

      let audioSession = AVAudioSession.sharedInstance();
      let output = audioSession.currentRoute.outputs.lastObject.portType;
      TNS_Player_Log('output', output);

      if (output.match(/Receiver/)) {
        try {
          audioSession.setCategoryError(AVAudioSessionCategoryPlayAndRecord);
          audioSession.overrideOutputAudioPortError(AVAudioSessionPortOverride.Speaker);
          audioSession.setActiveError(true);
          TNS_Player_Log('audioSession category set and active');
        } catch (err) {
          TNS_Player_Log('setting audioSession category failed');
        }
      }

      const errorRef = new interop.Reference();

      const fileUrl = NSURL.fileURLWithPath(fileName);

      const fileAsset = AVAsset.assetWithURL(fileUrl);

      const playerItem = AVPlayerItem.alloc().initWithAsset(fileAsset);

      this._player = AVPlayer.alloc().initWithPlayerItem(playerItem);

      NSNotificationCenter.defaultCenter.addObserverSelectorNameObject(
        this,
        'audioPlayerDidFinishPlayingSuccessfully',
        AVPlayerItemDidPlayToEndTimeNotification,
        this._player.currentItem
      );

      this._player.addObserverForKeyPathOptionsContext(this, 'status', NSKeyValueObservingOptions.New, null);
      this._player.addObserverForKeyPathOptionsContext(this, 'timeControlStatus', NSKeyValueObservingOptions.New, null);

      if (options.autoPlay) {
        this.playDeferred = new Deferred();
        this._player.play();
      } else {
        this.prepareDeferred = new Deferred();
      }

      // TODO: enable metering

      // TODO: enable looping
    } catch (ex) {
      if (this._errorCallback) {
        this._errorCallback({ ex });
      }
      if (options.autoPlay) {
        this.playDeferred.reject();
      } else {
        this.prepareDeferred.reject();
      }
    }

    return options.autoPlay ? this.playDeferred.promise : this.prepareDeferred.promise;
  }

  public initFromUrl(options: AudioPlayerOptions): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      // init only
      options.autoPlay = false;
      this.playFromUrl(options).then(resolve, reject);
    });
  }

  public playFromUrl(options: AudioPlayerOptions): Promise<boolean> {
    TNS_Player_Log('playFromUrl');

    // only if not explicitly set, default to true
    if (options.autoPlay !== false) {
      options.autoPlay = true;
    }

    try {
      this._completeCallback = options.completeCallback;
      this._errorCallback = options.errorCallback;
      this._infoCallback = options.infoCallback;

      let audioSession = AVAudioSession.sharedInstance();
      let output = audioSession.currentRoute.outputs.lastObject.portType;
      TNS_Player_Log('output', output);

      if (output.match(/Receiver/)) {
        try {
          audioSession.setCategoryError(AVAudioSessionCategoryPlayAndRecord);
          audioSession.overrideOutputAudioPortError(AVAudioSessionPortOverride.Speaker);
          audioSession.setActiveError(true);
          TNS_Player_Log('audioSession category set and active');
        } catch (err) {
          TNS_Player_Log('setting audioSession category failed');
        }
      }

      const errorRef = new interop.Reference();

      const playerItem = AVPlayerItem.alloc().initWithURL(NSURL.URLWithString(options.audioFile));

      this._player = AVPlayer.alloc().initWithPlayerItem(playerItem);

      NSNotificationCenter.defaultCenter.addObserverSelectorNameObject(
        this,
        'audioPlayerDidFinishPlayingSuccessfully',
        AVPlayerItemDidPlayToEndTimeNotification,
        this._player.currentItem
      );

      this._player.addObserverForKeyPathOptionsContext(this, 'status', NSKeyValueObservingOptions.New, null);
      this._player.addObserverForKeyPathOptionsContext(this, 'timeControlStatus', NSKeyValueObservingOptions.New, null);

      if (options.autoPlay) {
        this.playDeferred = new Deferred();
        this._player.play();
      } else {
        this.prepareDeferred = new Deferred();
      }
    } catch (ex) {
      if (this._errorCallback) {
        this._errorCallback({ ex });
      }
      if (options.autoPlay) {
        this.playDeferred.reject();
      } else {
        this.prepareDeferred.reject();
      }
    }

    return options.autoPlay ? this.playDeferred.promise : this.prepareDeferred.promise;
  }

  public pause(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        if (this._player && this.isAudioPlaying()) {
          TNS_Player_Log('pausing player...');
          this._player.pause();
          resolve(true);
        }
      } catch (ex) {
        if (this._errorCallback) {
          this._errorCallback({ ex });
        }
        TNS_Player_Log('pause error', ex);
        reject(ex);
      }
    });
  }

  public play(): Promise<boolean> {
    if (this.playDeferred == undefined) {
      this.playDeferred = new Deferred();
    }

    try {
      if (!this.isAudioPlaying()) {
        TNS_Player_Log('player play...');
        this._player.play();
      }
    } catch (ex) {
      if (this._errorCallback) {
        this._errorCallback({ ex });
      }
      TNS_Player_Log('play error', ex);
      this.playDeferred.reject(ex);
    }

    return this.playDeferred.promise;

    /* return new Promise((resolve, reject) => {
      try {
        if (!this.isAudioPlaying()) {
          TNS_Player_Log('player play...');
          this._player.play();
          resolve(true);
        }
      } catch (ex) {
        if (this._errorCallback) {
          this._errorCallback({ ex });
        }
        TNS_Player_Log('play error', ex);
        reject(ex);
      }
    }); */
  }

  public resume(): Promise<boolean> {
    TNS_Player_Log('resuming player...');
    return this.play();
    /* if (this._player) {
      TNS_Player_Log('resuming player...');
      this._player.play();
    } */
  }

  public playAtTime(time: number): Promise<boolean> {
    if (this.playDeferred == undefined) {
      this.playDeferred = new Deferred();
    }

    try {
      if (this._player) {
        TNS_Player_Log('playAtTime', time);
        // this._player.playAtTime(time);
        this._player.seekToTimeCompletionHandler(CMTimeMakeWithSeconds(time, 1000), completed => {
          if (completed) {
            setTimeout(() => {
              this._player.play();
            }, 500);
          }
        });
      }
    } catch (ex) {
      TNS_Player_Log('playAtTime error', ex);
      this.playDeferred.reject();
    }

    return this.playDeferred.promise;
  }

  public seekTo(time: number): Promise<any> {
    const wasPlaying = this.isAudioPlaying();

    if (wasPlaying) {
      this.playDeferred = new Deferred();
    } else if (this.prepareDeferred === undefined) {
      this.prepareDeferred = new Deferred();
    }

    try {
      if (this._player) {
        TNS_Player_Log('seekTo', time);

        if (wasPlaying) {
          this._player.pause();
        }

        // this._player.currentItem.seekToTime(CMTimeMakeWithSeconds(time, 1000));
        this._player.currentItem.seekToTimeCompletionHandler(CMTimeMakeWithSeconds(time, 1000), completed => {
          if (completed) {
            if (wasPlaying) {
              setTimeout(() => {
                this._player.play();
              }, 500);
            }
          }
        });
      }
    } catch (ex) {
      TNS_Player_Log('seekTo error', ex);
      wasPlaying ? this.playDeferred.reject(ex) : this.prepareDeferred.reject(ex);
    }

    return wasPlaying ? this.playDeferred.promise : this.prepareDeferred.promise;
  }

  public dispose(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        TNS_Player_Log('disposing TNSPlayer...');
        if (this._player && this.isAudioPlaying()) {
          this._player.pause();
        }
        this._reset();
        resolve();
      } catch (ex) {
        if (this._errorCallback) {
          this._errorCallback({ ex });
        }
        TNS_Player_Log('dispose error', ex);
        reject(ex);
      }
    });
  }

  public isAudioPlaying(): boolean {
    return this._player ? this._player.rate != 0 && this._player.error == null : false;
  }

  public getAudioTrackDuration(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const duration = this._player ? CMTimeGetSeconds(this._player.currentItem.asset.duration) : 0;
        TNS_Player_Log('audio track duration ', duration);
        resolve(duration.toString());
      } catch (ex) {
        if (this._errorCallback) {
          this._errorCallback({ ex });
        }
        TNS_Player_Log('getAudioTrackDuration error', ex);
        reject(ex);
      }
    });
  }

  public changePlayerSpeed(speed) {
    if (this._player && speed) {
      // make sure speed is a number/float
      if (typeof speed === 'string') {
        speed = parseFloat(speed);
      }
      this._player.rate = speed;
    }
  }

  /* public audioPlayerDidFinishPlayingSuccessfully(player?: any, flag?: boolean) {
    if (flag && this._completeCallback) {
      this._completeCallback({ player, flag });
    } else if (!flag && this._errorCallback) {
      this._errorCallback({ player, flag });
    }
  } */

  public audioPlayerDidFinishPlayingSuccessfully(notification: NSNotification) {
    TNS_Player_Log('player finished');
    if (this._completeCallback) {
      const player = this._player;
      const flag = true;
      this._completeCallback({ player, flag });
    }
  }

  public audioPlayerDecodeErrorDidOccurError(player: any, error: NSError) {
    if (this._errorCallback) {
      this._errorCallback({ player, error });
    }
  }

  public observeValueForKeyPathOfObjectChangeContext(
    keyPath: string,
    obj: Object,
    change: NSDictionary<any, any>,
    context: any
  ) {
    if (this._player == undefined || this._player == null) {
      return;
    }

    if (keyPath == 'status') {
      if (this._player.status == AVPlayerStatus.ReadyToPlay) {
        TNS_Player_Log('on ready to play');
        if (this.playDeferred != undefined) {
          this.playDeferred.resolve(true);
        }

        if (this.prepareDeferred != undefined) {
          this.prepareDeferred.resolve(true);
        }
      } else if (this._player.status == AVPlayerStatus.Failed) {
        if (this.playDeferred != undefined) {
          this.playDeferred.reject();
        }

        if (this.prepareDeferred != undefined) {
          this.prepareDeferred.reject();
        }
      }
    } else if (keyPath == 'timeControlStatus') {
      if (this._player.timeControlStatus == AVPlayerTimeControlStatus.Playing) {
        TNS_Player_Log('on playing');
        if (this.playDeferred != undefined) {
          this.playDeferred.resolve(true);
        }

        if (this.prepareDeferred != undefined) {
          this.prepareDeferred.resolve(true);
        }
      }
    }
  }

  private _reset() {
    if (this._player) {
      NSNotificationCenter.defaultCenter.removeObserverNameObject(
        this,
        'audioPlayerDidFinishPlayingSuccessfully',
        this._player.currentItem
      );

      this._player.removeObserverForKeyPath(this, 'timeControlStatus');

      this._player.replaceCurrentItemWithPlayerItem(null);
      this._player = undefined;
    }
    /* if (this._task) {
      this._task.cancel();
      this._task = undefined;
    } */
  }
}
