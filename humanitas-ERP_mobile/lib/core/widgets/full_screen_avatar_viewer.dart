import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import '../constants/app_colors.dart';

/// Interactive full-screen image viewer for user and group avatars.
class FullScreenAvatarViewer extends StatelessWidget {
  final String? avatarUrl;
  final String title;
  final String? heroTag;
  final VoidCallback? onEditAvatar;
  final VoidCallback? onDeleteAvatar;

  const FullScreenAvatarViewer({
    super.key,
    required this.avatarUrl,
    required this.title,
    this.heroTag,
    this.onEditAvatar,
    this.onDeleteAvatar,
  });

  static void show(
    BuildContext context, {
    required String? avatarUrl,
    required String title,
    String? heroTag,
    VoidCallback? onEditAvatar,
    VoidCallback? onDeleteAvatar,
  }) {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (context, _, __) => FullScreenAvatarViewer(
          avatarUrl: avatarUrl,
          title: title,
          heroTag: heroTag,
          onEditAvatar: onEditAvatar,
          onDeleteAvatar: onDeleteAvatar,
        ),
        transitionsBuilder: (context, animation, _, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final initials = title.trim().isNotEmpty ? title.trim()[0].toUpperCase() : 'U';

    Widget imageContent;
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      imageContent = CachedNetworkImage(
        imageUrl: avatarUrl!,
        fit: BoxFit.contain,
        placeholder: (context, url) => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        errorWidget: (context, url, error) => Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.broken_image_rounded, size: 64, color: Colors.white54),
            const SizedBox(height: 12),
            Text(
              'Could not load photo',
              style: GoogleFonts.inter(color: Colors.white70, fontSize: 14),
            ),
          ],
        ),
      );
    } else {
      imageContent = Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.primary.withValues(alpha: 0.2),
          border: Border.all(color: AppColors.primary, width: 3),
        ),
        alignment: Alignment.center,
        child: Text(
          initials,
          style: GoogleFonts.inter(
            fontSize: 80,
            fontWeight: FontWeight.bold,
            color: AppColors.primary,
          ),
        ),
      );
    }

    if (heroTag != null && heroTag!.isNotEmpty) {
      imageContent = Hero(tag: heroTag!, child: imageContent);
    }

    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.black.withValues(alpha: 0.6),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          title,
          style: GoogleFonts.inter(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          if (onEditAvatar != null)
            IconButton(
              icon: const Icon(Icons.camera_alt_rounded, color: AppColors.primary, size: 22),
              tooltip: 'Change Photo',
              onPressed: () {
                Navigator.of(context).pop();
                onEditAvatar?.call();
              },
            ),
          if (onDeleteAvatar != null && avatarUrl != null && avatarUrl!.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFFF5252), size: 22),
              tooltip: 'Delete Photo',
              onPressed: () {
                Navigator.of(context).pop();
                onDeleteAvatar?.call();
              },
            ),
        ],
      ),
      body: InteractiveViewer(
        minScale: 0.8,
        maxScale: 4.0,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: imageContent,
          ),
        ),
      ),
    );
  }
}

/// Helper bottom sheet for viewing, updating, or deleting a profile photo.
Future<void> showAvatarPickerSheet({
  required BuildContext context,
  required String? currentAvatarUrl,
  required String name,
  required Future<void> Function(List<int> bytes, String filename, String mime) onImagePicked,
  Future<void> Function()? onDelete,
}) async {
  final isDark = Theme.of(context).brightness == Brightness.dark;

  showModalBottomSheet(
    context: context,
    backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? Colors.white24 : Colors.black26,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Profile Photo',
              style: GoogleFonts.inter(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 16),
            if (currentAvatarUrl != null && currentAvatarUrl.isNotEmpty)
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.fullscreen_rounded, color: AppColors.primary),
                ),
                title: Text('View Full Photo', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(ctx);
                  FullScreenAvatarViewer.show(
                    context,
                    avatarUrl: currentAvatarUrl,
                    title: name,
                    onEditAvatar: () => showAvatarPickerSheet(
                      context: context,
                      currentAvatarUrl: currentAvatarUrl,
                      name: name,
                      onImagePicked: onImagePicked,
                      onDelete: onDelete,
                    ),
                    onDeleteAvatar: onDelete,
                  );
                },
              ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF43A047).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.photo_library_rounded, color: Color(0xFF43A047)),
              ),
              title: Text('Choose from Gallery', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              onTap: () async {
                Navigator.pop(ctx);
                final picked = await ImagePicker().pickImage(
                  source: ImageSource.gallery,
                  imageQuality: 85,
                  maxWidth: 1200,
                  maxHeight: 1200,
                );
                if (picked != null) {
                  final bytes = await picked.readAsBytes();
                  final filename = picked.name;
                  final mime = picked.mimeType ?? 'image/jpeg';
                  await onImagePicked(bytes, filename, mime);
                }
              },
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF00ACC1).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.camera_alt_rounded, color: Color(0xFF00ACC1)),
              ),
              title: Text('Take Photo', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              onTap: () async {
                Navigator.pop(ctx);
                final picked = await ImagePicker().pickImage(
                  source: ImageSource.camera,
                  imageQuality: 85,
                  maxWidth: 1200,
                  maxHeight: 1200,
                );
                if (picked != null) {
                  final bytes = await picked.readAsBytes();
                  final filename = picked.name;
                  final mime = picked.mimeType ?? 'image/jpeg';
                  await onImagePicked(bytes, filename, mime);
                }
              },
            ),
            if (onDelete != null && currentAvatarUrl != null && currentAvatarUrl.isNotEmpty)
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF5252).withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFFF5252)),
                ),
                title: Text(
                  'Remove Photo',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFFFF5252),
                  ),
                ),
                onTap: () async {
                  Navigator.pop(ctx);
                  await onDelete();
                },
              ),
            const SizedBox(height: 12),
          ],
        ),
      );
    },
  );
}
