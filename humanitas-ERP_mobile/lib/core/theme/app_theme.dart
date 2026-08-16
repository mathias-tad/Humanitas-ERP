import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

class AppTheme {
  // ── Text Themes ──────────────────────────────────────────────
  static TextTheme _buildTextTheme(Color primary, Color secondary) {
    return GoogleFonts.interTextTheme().copyWith(
      displayLarge:  GoogleFonts.inter(color: primary, fontWeight: FontWeight.w700),
      displayMedium: GoogleFonts.inter(color: primary, fontWeight: FontWeight.w700),
      headlineLarge: GoogleFonts.inter(color: primary, fontWeight: FontWeight.w700),
      headlineMedium:GoogleFonts.inter(color: primary, fontWeight: FontWeight.w600),
      headlineSmall: GoogleFonts.inter(color: primary, fontWeight: FontWeight.w600),
      titleLarge:    GoogleFonts.inter(color: primary, fontWeight: FontWeight.w600),
      titleMedium:   GoogleFonts.inter(color: primary, fontWeight: FontWeight.w500),
      titleSmall:    GoogleFonts.inter(color: primary, fontWeight: FontWeight.w500),
      bodyLarge:     GoogleFonts.inter(color: primary),
      bodyMedium:    GoogleFonts.inter(color: primary),
      bodySmall:     GoogleFonts.inter(color: secondary),
      labelLarge:    GoogleFonts.inter(color: primary, fontWeight: FontWeight.w600),
      labelMedium:   GoogleFonts.inter(color: secondary),
      labelSmall:    GoogleFonts.inter(color: secondary),
    );
  }

  // ── Light Theme ──────────────────────────────────────────────
  static ThemeData get lightTheme {
    final textTheme = _buildTextTheme(
      AppColors.textPrimaryLight,
      AppColors.textSecondaryLight,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      textTheme: textTheme,
      primaryColor: AppColors.primary,
      scaffoldBackgroundColor: AppColors.backgroundLight,

      colorScheme: const ColorScheme.light(
        primary:       AppColors.primary,
        onPrimary:     Color(0xFF1A1200),
        secondary:     AppColors.teal,
        onSecondary:   Colors.white,
        surface:       AppColors.surfaceLight,
        onSurface:     AppColors.textPrimaryLight,
        error:         AppColors.error,
        onError:       Colors.white,
        outline:       AppColors.borderLight,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surfaceLight,
        foregroundColor: AppColors.textPrimaryLight,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          color: AppColors.textPrimaryLight,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        iconTheme: const IconThemeData(color: AppColors.textPrimaryLight),
        surfaceTintColor: Colors.transparent,
      ),

      cardTheme: CardThemeData(
        color: AppColors.cardLight,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.borderLight, width: 1),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: const Color(0xFF1A1200),
          minimumSize: const Size(double.infinity, 52),
          elevation: 2,
          shadowColor: AppColors.primary.withValues(alpha: 0.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          minimumSize: const Size(double.infinity, 52),
          side: const BorderSide(color: AppColors.primary, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceLight,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        labelStyle: GoogleFonts.inter(color: AppColors.textSecondaryLight),
        hintStyle: GoogleFonts.inter(color: AppColors.textSecondaryLight.withValues(alpha: 0.6)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        prefixIconColor: AppColors.textSecondaryLight,
        suffixIconColor: AppColors.textSecondaryLight,
      ),

      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: AppColors.surfaceLight,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondaryLight,
        elevation: 8,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 12),
        unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 12),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: AppColors.primarySurface,
        labelStyle: GoogleFonts.inter(color: AppColors.primaryDark, fontWeight: FontWeight.w500),
        side: const BorderSide(color: AppColors.borderLight),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),

      dividerTheme: const DividerThemeData(
        color: AppColors.borderLight,
        thickness: 1,
      ),
    );
  }

  // ── Dark Theme ───────────────────────────────────────────────
  static ThemeData get darkTheme {
    final textTheme = _buildTextTheme(
      AppColors.textPrimaryDark,
      AppColors.textSecondaryDark,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      textTheme: textTheme,
      primaryColor: AppColors.primary,
      scaffoldBackgroundColor: AppColors.backgroundDark,

      colorScheme: const ColorScheme.dark(
        primary:       AppColors.primary,
        onPrimary:     Color(0xFF1A1200),
        secondary:     AppColors.teal,
        onSecondary:   Colors.white,
        surface:       AppColors.surfaceDark,
        onSurface:     AppColors.textPrimaryDark,
        error:         AppColors.error,
        onError:       Colors.white,
        outline:       AppColors.borderDark,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surfaceDark,
        foregroundColor: AppColors.textPrimaryDark,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          color: AppColors.textPrimaryDark,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        iconTheme: const IconThemeData(color: AppColors.textPrimaryDark),
        surfaceTintColor: Colors.transparent,
      ),

      cardTheme: CardThemeData(
        color: AppColors.cardDark,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.borderDark, width: 1),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: const Color(0xFF1A1200),
          minimumSize: const Size(double.infinity, 52),
          elevation: 4,
          shadowColor: AppColors.primary.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          minimumSize: const Size(double.infinity, 52),
          side: const BorderSide(color: AppColors.primary, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.cardDark,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        labelStyle: GoogleFonts.inter(color: AppColors.textSecondaryDark),
        hintStyle: GoogleFonts.inter(color: AppColors.textSecondaryDark.withValues(alpha: 0.6)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        prefixIconColor: AppColors.textSecondaryDark,
        suffixIconColor: AppColors.textSecondaryDark,
      ),

      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: AppColors.surfaceDark,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.navInactive,
        elevation: 8,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 12),
        unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 12),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: AppColors.borderDark,
        labelStyle: GoogleFonts.inter(color: AppColors.primaryLight, fontWeight: FontWeight.w500),
        side: const BorderSide(color: AppColors.borderDark),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),

      dividerTheme: const DividerThemeData(
        color: AppColors.borderDark,
        thickness: 1,
      ),
    );
  }
}
