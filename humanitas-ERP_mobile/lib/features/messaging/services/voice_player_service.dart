import 'dart:async';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_constants.dart';

class VoicePlayerState {
  final String? activeMessageId;
  final String? title;
  final String? audioUrl;
  final bool isPlaying;
  final bool isPaused;
  final Duration position;
  final Duration duration;

  VoicePlayerState({
    this.activeMessageId,
    this.title,
    this.audioUrl,
    this.isPlaying = false,
    this.isPaused = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
  });

  VoicePlayerState copyWith({
    String? activeMessageId,
    String? title,
    String? audioUrl,
    bool? isPlaying,
    bool? isPaused,
    Duration? position,
    Duration? duration,
    bool clearActive = false,
  }) {
    return VoicePlayerState(
      activeMessageId: clearActive ? null : (activeMessageId ?? this.activeMessageId),
      title: clearActive ? null : (title ?? this.title),
      audioUrl: clearActive ? null : (audioUrl ?? this.audioUrl),
      isPlaying: clearActive ? false : (isPlaying ?? this.isPlaying),
      isPaused: clearActive ? false : (isPaused ?? this.isPaused),
      position: clearActive ? Duration.zero : (position ?? this.position),
      duration: clearActive ? Duration.zero : (duration ?? this.duration),
    );
  }
}

class VoicePlayerNotifier extends StateNotifier<VoicePlayerState> {
  final AudioPlayer _player = AudioPlayer();
  StreamSubscription? _posSub;
  StreamSubscription? _durSub;
  StreamSubscription? _stateSub;
  StreamSubscription? _completeSub;

  VoicePlayerNotifier() : super(VoicePlayerState()) {
    _initListeners();
  }

  void _initListeners() {
    _posSub = _player.onPositionChanged.listen((pos) {
      state = state.copyWith(position: pos);
    });

    _durSub = _player.onDurationChanged.listen((dur) {
      state = state.copyWith(duration: dur);
    });

    _stateSub = _player.onPlayerStateChanged.listen((s) {
      if (s == PlayerState.playing) {
        state = state.copyWith(isPlaying: true, isPaused: false);
      } else if (s == PlayerState.paused) {
        state = state.copyWith(isPlaying: false, isPaused: true);
      } else if (s == PlayerState.stopped || s == PlayerState.completed) {
        state = state.copyWith(isPlaying: false, isPaused: false, position: Duration.zero);
      }
    });

    _completeSub = _player.onPlayerComplete.listen((_) {
      state = state.copyWith(isPlaying: false, isPaused: false, position: Duration.zero);
    });
  }

  Source _resolveSource(String rawUrl) {
    // 1. If local file exists on device filesystem
    if (File(rawUrl).existsSync()) {
      debugPrint('[VoicePlayer] Loading local file: $rawUrl');
      return DeviceFileSource(rawUrl);
    }

    // 2. HTTP URL resolution
    String fullUrl = rawUrl;
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      final baseUrl = ApiConstants.defaultBaseUrl.replaceAll(RegExp(r'/api/v1/?$'), '');
      fullUrl = rawUrl.startsWith('/') ? '$baseUrl$rawUrl' : '$baseUrl/$rawUrl';
    }

    // On Android physical device, replace 127.0.0.1 with 192.168.0.184 if 127.0.0.1 is unreachable
    if (Platform.isAndroid && fullUrl.contains('127.0.0.1')) {
      fullUrl = fullUrl.replaceAll('127.0.0.1', '192.168.0.184');
    }

    debugPrint('[VoicePlayer] Loading remote URL: $fullUrl');
    return UrlSource(fullUrl);
  }

  Future<void> play({
    required String messageId,
    required String audioUrl,
    String? title,
  }) async {
    if (state.activeMessageId == messageId) {
      if (state.isPaused) {
        await _player.resume();
      } else if (state.isPlaying) {
        await _player.pause();
      } else {
        final source = _resolveSource(audioUrl);
        await _player.play(source);
      }
      return;
    }

    // Play new voice track
    await _player.stop();
    state = VoicePlayerState(
      activeMessageId: messageId,
      title: title ?? 'Voice Message',
      audioUrl: audioUrl,
      isPlaying: true,
    );

    try {
      final source = _resolveSource(audioUrl);
      await _player.play(source);
    } catch (e) {
      debugPrint('[VoicePlayer] Play error: $e');
      state = state.copyWith(clearActive: true);
    }
  }

  Future<void> pause() async {
    await _player.pause();
  }

  Future<void> resume() async {
    await _player.resume();
  }

  Future<void> seek(Duration pos) async {
    await _player.seek(pos);
  }

  Future<void> stop() async {
    await _player.stop();
    state = state.copyWith(clearActive: true);
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _stateSub?.cancel();
    _completeSub?.cancel();
    _player.dispose();
    super.dispose();
  }
}

final voicePlayerProvider =
    StateNotifierProvider<VoicePlayerNotifier, VoicePlayerState>((ref) {
  return VoicePlayerNotifier();
});
