class ApiConstants {
  // ─── Base URL ───────────────────────────────────────────────────────────────
  // Physical device via USB + `adb reverse tcp:3001 tcp:3001` → 127.0.0.1:3001
  // Android Emulator                                           → 10.0.2.2:3001
  // Physical device on same WiFi (no USB)                     → 192.168.0.184:3001
  //
  // ⚠️  Change this one line to switch environment:
  static const String _host = '127.0.0.1'; // USB physical device (adb reverse)
  // static const String _host = '10.0.2.2';          // Android Emulator
  // static const String _host = '192.168.0.184';     // WiFi (no USB needed)

  static const String defaultBaseUrl = 'http://$_host:3001/api/v1';


  // Auth Endpoints
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String setup = '/auth/setup';
  static const String verifySetupToken = '/auth/verify-setup-token';
  static const String completeUserSetup = '/auth/complete-setup';
  static const String getTenantBySlug = '/auth/tenant';
  static const String getWsToken = '/auth/ws-token';

  // Users Endpoints
  static const String userProfile = '/users/me';
  static const String changePassword = '/users/me/password';
  static const String uploadAvatar = '/users/me/avatar';
  static const String deleteAvatar = '/users/me/avatar';
  static const String userPermissions = '/users/permissions';
  static const String dashboardStats = '/users/dashboard-stats';
  static const String homeDashboard = '/users/home-dashboard';
  static const String myAttachments = '/users/me/attachments';
  static const String userList = '/users/list';
  static const String orgChartTree = '/users/org-chart';

  // Attendance Endpoints
  static const String myAttendance = '/attendance/my-records';
  static const String mySchedule = '/attendance/my-schedule';
  static const String clockIn = '/attendance/clock-in';
  static const String clockOut = '/attendance/clock-out';
  static const String secureClockIn = '/attendance/secure-clock-in';
  static const String secureClockOut = '/attendance/secure-clock-out';
  static const String qrCode = '/attendance/qr-code';
  static const String registerDevice = '/attendance/device/register';
  static const String myDevices = '/attendance/device/my-devices';
  static const String networkCheck = '/attendance/network-check';

  // Leave Endpoints
  static const String leaveTypes = '/leave/types';
  static const String myLeaveRequests = '/leave/my-requests';
  static const String myLeaveBalances = '/leave/my-balances';
  static const String applyLeave = '/leave/apply';
  static const String leaveStatus = '/leave/status';

  // Admin Attendance Endpoints
  static const String allAttendanceRecords = '/attendance/records';

  // Payroll Endpoints
  static const String myPayslips = '/payroll/my-payslips';
  static const String myLoans = '/payroll/loans/my-requests';
  static const String loanConfig = '/payroll/loans/config';
  static const String payrollRuns = '/payroll/runs';
  static const String runPayroll = '/payroll/run';

  // Per Diem Endpoints
  static const String myPerDiemClaims = '/per-diem/my-claims';
  static const String perDiemChoice = '/per-diem/choice';
  static const String perDiemUploadReceipt = '/per-diem/upload-receipt';

  // PMS Endpoints
  static const String pmsTasks = '/pms/tasks';
  static const String logTime = '/pms/tasks/log-time';
  static const String pmsProjects = '/pms/projects';

  // Communication & Notifications
  static const String announcements = '/announcements';
  static const String events = '/events';
  static const String calendarEvents = '/calendar/events';
  static const String calendarSources = '/calendar/sources';
  static const String notifications = '/notifications';
  static const String unreadNotificationsCount = '/notifications/unread-count';

  // Messaging – Conversations
  static const String messagingConversations = '/messaging/conversations';
  static const String messagingMessages = '/messaging/messages';
  static const String messagingUsersSearch = '/messaging/users/search';
  static const String messagingSettings = '/messaging/settings';

  // Messaging – helpers
  static String messagingConvMessages(String id) => '/messaging/conversations/$id/messages';
  static String messagingConvRead(String id) => '/messaging/conversations/$id/read';
  static String messagingConvMembers(String id) => '/messaging/conversations/$id/members';
  static String messagingConvMember(String id, String uid) => '/messaging/conversations/$id/members/$uid';
  static String messagingConvMemberRole(String id, String uid) => '/messaging/conversations/$id/members/$uid/role';
  static String messagingMessageEdit(String id) => '/messaging/messages/$id';
  static String messagingMessageDelete(String id) => '/messaging/messages/$id';
  static String messagingMessageForward(String id) => '/messaging/messages/$id/forward';
  static String messagingMessageReact(String id) => '/messaging/messages/$id/react';

  // AI Endpoint
  static const String aiChat = '/ai/chat';
  static const String aiChatWithFile = '/ai/chat-with-file';

  // Biometric Devices Endpoints
  static const String biometricDevices = '/biometric-devices';
  static const String biometricDeviceServerInfo = '/biometric-devices/server-info';
  static String biometricDeviceAuthorize(String id) => '/biometric-devices/$id/authorize';
  static String biometricDeviceSyncUsers(String id) => '/biometric-devices/$id/sync-users';
  static String biometricDeviceDelete(String id) => '/biometric-devices/$id';
  static String biometricDeviceUserStatus(String userId) => '/biometric-devices/users/$userId/biometric-status';

  // Additional Admin Endpoints
  static const String attendanceCorrections = '/attendance/corrections';
  static const String allPayslips = '/payroll/all-payslips';
}
