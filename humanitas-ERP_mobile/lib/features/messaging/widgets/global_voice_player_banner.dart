import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../services/voice_player_service.dart';

/// Floating Telegram-style voice playback banner shown at the top of screens.
class GlobalVoicePlayerBanner extends ConsumerWidget {
  const GlobalVoicePlayerBanner({super.key});

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final voiceState = ref.watch(voicePlayerProvider);
    if (voiceState.activeMessageId == null) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final notifier = ref.read(voicePlayerProvider.notifier);

    final current = voiceState.position;
    final total = voiceState.duration;
    final progress = total.inMilliseconds > 0
        ? (current.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      color: isDark ? const Color(0xFF1E2C3A) : const Color(0xFFE8F1FA),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: [
                // Play / Pause button
                GestureDetector(
                  onTap: () {
                    if (voiceState.isPlaying) {
                      notifier.pause();
                    } else {
                      notifier.resume();
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      voiceState.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      size: 18,
                      color: Colors.black87,
                    ),
                  ),
                ),
                const SizedBox(width: 10),

                // Title + Elapsed time / Total duration
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        voiceState.title ?? 'Voice Message',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '${_formatDuration(current)} / ${_formatDuration(total)}',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: isDark ? Colors.white60 : Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),

                // Close button
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18),
                  color: isDark ? Colors.white70 : Colors.black54,
                  onPressed: () => notifier.stop(),
                ),
              ],
            ),
          ),

          // Interactive progress bar
          SliderTheme(
            data: SliderThemeData(
              trackHeight: 2,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 4),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 8),
              activeTrackColor: AppColors.primary,
              inactiveTrackColor: isDark ? Colors.white24 : Colors.black12,
              thumbColor: AppColors.primary,
            ),
            child: Slider(
              value: progress,
              onChanged: (val) {
                if (total.inMilliseconds > 0) {
                  final targetMs = (val * total.inMilliseconds).round();
                  notifier.seek(Duration(milliseconds: targetMs));
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}
