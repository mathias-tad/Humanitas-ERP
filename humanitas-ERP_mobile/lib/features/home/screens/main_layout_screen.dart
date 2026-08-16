import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../messaging/providers/messaging_provider.dart';
import 'home_screen.dart';
import '../../messaging/screens/conversations_screen.dart';
import '../../attendance/screens/attendance_screen.dart';
import '../../leave/screens/leave_screen.dart';
import '../../profile/screens/profile_screen.dart';

class MainLayoutScreen extends ConsumerStatefulWidget {
  const MainLayoutScreen({super.key});

  @override
  ConsumerState<MainLayoutScreen> createState() => _MainLayoutScreenState();
}

class _MainLayoutScreenState extends ConsumerState<MainLayoutScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    HomeScreen(),
    ConversationsScreen(),
    AttendanceScreen(),
    LeaveScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Watch conversations to calculate total unread messages count
    final conversationsAsync = ref.watch(conversationsProvider);
    final totalUnread = conversationsAsync.asData?.value.fold<int>(
      0, (sum, c) => sum + c.unreadCount,
    ) ?? 0;

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
          border: Border(
            top: BorderSide(
              color: isDark ? AppColors.borderDark : AppColors.borderLight,
              width: 1,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.06),
              blurRadius: 12,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: (index) => setState(() => _currentIndex = index),
            backgroundColor: Colors.transparent,
            elevation: 0,
            type: BottomNavigationBarType.fixed,
            selectedItemColor: AppColors.primary,
            unselectedItemColor: isDark ? AppColors.navInactive : AppColors.textSecondaryLight,
            selectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 11),
            unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 11),
            items: [
              const BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined),
                activeIcon: Icon(Icons.home_rounded),
                label: 'Home',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: totalUnread > 0,
                  label: Text(
                    totalUnread > 99 ? '99+' : '$totalUnread',
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 10),
                  ),
                  backgroundColor: AppColors.primary,
                  textColor: Colors.black,
                  child: const Icon(Icons.chat_bubble_outline_rounded),
                ),
                activeIcon: Badge(
                  isLabelVisible: totalUnread > 0,
                  label: Text(
                    totalUnread > 99 ? '99+' : '$totalUnread',
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 10),
                  ),
                  backgroundColor: AppColors.primary,
                  textColor: Colors.black,
                  child: const Icon(Icons.chat_bubble_rounded),
                ),
                label: 'Messages',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.access_time_outlined),
                activeIcon: Icon(Icons.access_time_filled_rounded),
                label: 'Attendance',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.beach_access_outlined),
                activeIcon: Icon(Icons.beach_access_rounded),
                label: 'Leave',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.person_outline_rounded),
                activeIcon: Icon(Icons.person_rounded),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
