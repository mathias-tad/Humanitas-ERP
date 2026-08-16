import 'package:flutter/material.dart';

/// Humanitas Brand Color System
/// Primary: Shiny Gold — matches web `--primary: oklch(0.76 0.14 85)` ≈ #D4AF37
/// Accent:  Teal/Cyan  — matches web `--brand-blue: #35C9C9`
/// Dark BG: Dark Chocolate — matches web dark `--background: oklch(0.12 0.04 85)` ≈ #1C1408
class AppColors {
  // ── Brand Primary: Shiny Gold ──────────────────────────────
  static const Color primary        = Color(0xFFD4AF37); // Gold
  static const Color primaryDark    = Color(0xFFB8961E); // Darker Gold
  static const Color primaryLight   = Color(0xFFEDD97A); // Light Gold
  static const Color primarySurface = Color(0xFFF5ECC8); // Very light gold tint

  // ── Brand Accent: Teal/Cyan ────────────────────────────────
  static const Color teal           = Color(0xFF35C9C9); // Brand teal
  static const Color tealDark       = Color(0xFF259393);
  static const Color tealSurface    = Color(0xFFD4F5F5);

  // ── Semantic Colors ────────────────────────────────────────
  static const Color success        = Color(0xFF10B981);
  static const Color warning        = Color(0xFFF59E0B);
  static const Color error          = Color(0xFFEF4444);
  static const Color info           = Color(0xFF35C9C9); // Teal as info

  // ── Light Mode ────────────────────────────────────────────
  static const Color backgroundLight    = Color(0xFFFDFAF5); // Warm white
  static const Color surfaceLight       = Color(0xFFFFFFFF);
  static const Color cardLight          = Color(0xFFFFFFFF);
  static const Color textPrimaryLight   = Color(0xFF1A1F3D); // Navy dark
  static const Color textSecondaryLight = Color(0xFF6B6040); // Warm brown-grey
  static const Color borderLight        = Color(0xFFEDE8D0); // Warm light border

  // ── Dark Mode ─────────────────────────────────────────────
  static const Color backgroundDark     = Color(0xFF1C1408); // Dark chocolate
  static const Color surfaceDark        = Color(0xFF231A0A); // Slightly lighter
  static const Color cardDark           = Color(0xFF2A1F0D); // Card surface
  static const Color textPrimaryDark    = Color(0xFFF5EFE0); // Warm off-white
  static const Color textSecondaryDark  = Color(0xFFB5A47A); // Muted gold
  static const Color borderDark         = Color(0xFF3D2E12); // Dark gold border

  // ── Sidebar / Nav ─────────────────────────────────────────
  static const Color navBackground      = Color(0xFF1C1408);
  static const Color navActive          = Color(0xFFD4AF37);
  static const Color navInactive        = Color(0xFF8A7A50);
}
