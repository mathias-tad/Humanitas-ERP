class DeviceModel {
  final String id;
  final String? serialNumber;
  final String? alias;
  final String? deviceType;
  final bool isAuthorized;
  final bool isOnline;
  final String? lastSeen;
  final String? ipAddress;
  final String? firmwareVersion;
  final String? location;
  final int? userCount;

  const DeviceModel({
    required this.id,
    this.serialNumber,
    this.alias,
    this.deviceType,
    required this.isAuthorized,
    required this.isOnline,
    this.lastSeen,
    this.ipAddress,
    this.firmwareVersion,
    this.location,
    this.userCount,
  });

  factory DeviceModel.fromJson(Map<String, dynamic> json) {
    return DeviceModel(
      id: json['id']?.toString() ?? '',
      serialNumber: json['serial_number']?.toString(),
      alias: json['alias']?.toString(),
      deviceType: json['device_type']?.toString(),
      isAuthorized: json['is_authorized'] as bool? ?? false,
      isOnline: json['is_online'] as bool? ?? false,
      lastSeen: json['last_seen']?.toString(),
      ipAddress: json['ip_address']?.toString(),
      firmwareVersion: json['firmware_version']?.toString(),
      location: json['location']?.toString(),
      userCount: (json['user_count'] as num?)?.toInt(),
    );
  }
}
