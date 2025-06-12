enum SyncStatus {
  idle,
  syncing,
  success,
  error,
  offline,
}

class SyncInfo {
  final SyncStatus status;
  final DateTime? lastSync;
  final String? error;
  final int pendingChanges;
  final bool isOnline;

  const SyncInfo({
    required this.status,
    this.lastSync,
    this.error,
    this.pendingChanges = 0,
    this.isOnline = true,
  });

  factory SyncInfo.fromJson(Map<String, dynamic> json) {
    return SyncInfo(
      status: SyncStatus.values.firstWhere(
        (e) => e.toString() == json['status'],
        orElse: () => SyncStatus.idle,
      ),
      lastSync: json['lastSync'] != null 
          ? DateTime.parse(json['lastSync']) 
          : null,
      error: json['error'],
      pendingChanges: json['pendingChanges'] ?? 0,
      isOnline: json['isOnline'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'status': status.toString(),
      'lastSync': lastSync?.toIso8601String(),
      'error': error,
      'pendingChanges': pendingChanges,
      'isOnline': isOnline,
    };
  }
}