class Event {
  final String id;
  final String title;
  final String? description;
  final EventLocation? location;
  final DateTime? startTime;
  final DateTime? endTime;
  final String creatorId;
  final EventData? eventData;
  final String status;
  final int participantCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final List<EventParticipant>? participants;

  Event({
    required this.id,
    required this.title,
    this.description,
    this.location,
    this.startTime,
    this.endTime,
    required this.creatorId,
    this.eventData,
    required this.status,
    this.participantCount = 0,
    this.createdAt,
    this.updatedAt,
    this.participants,
  });

  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      location: json['location'] != null 
          ? EventLocation.fromJson(json['location']) 
          : null,
      startTime: json['startTime'] != null 
          ? DateTime.parse(json['startTime']) 
          : null,
      endTime: json['endTime'] != null 
          ? DateTime.parse(json['endTime']) 
          : null,
      creatorId: json['creatorId'],
      eventData: json['eventData'] != null 
          ? EventData.fromJson(json['eventData']) 
          : null,
      status: json['status'],
      participantCount: json['participantCount'] ?? 0,
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt']) 
          : null,
      updatedAt: json['updatedAt'] != null 
          ? DateTime.parse(json['updatedAt']) 
          : null,
      participants: json['participants'] != null
          ? (json['participants'] as List)
              .map((p) => EventParticipant.fromJson(p))
              .toList()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'location': location?.toJson(),
      'startTime': startTime?.toIso8601String(),
      'endTime': endTime?.toIso8601String(),
      'creatorId': creatorId,
      'eventData': eventData?.toJson(),
      'status': status,
      'participantCount': participantCount,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'participants': participants?.map((p) => p.toJson()).toList(),
    };
  }

  bool get isDraft => status == 'draft';
  bool get isPublished => status == 'published';
  bool get isActive => status == 'active';
  bool get isCompleted => status == 'completed';
  
  bool get hasStarted => startTime != null && DateTime.now().isAfter(startTime!);
  bool get hasEnded => endTime != null && DateTime.now().isAfter(endTime!);
}

class EventLocation {
  final String? address;
  final double? latitude;
  final double? longitude;
  final List<LatLng>? boundaries;

  EventLocation({
    this.address,
    this.latitude,
    this.longitude,
    this.boundaries,
  });

  factory EventLocation.fromJson(Map<String, dynamic> json) {
    return EventLocation(
      address: json['address'],
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      boundaries: json['boundaries'] != null
          ? (json['boundaries'] as List)
              .map((b) => LatLng.fromJson(b))
              .toList()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'boundaries': boundaries?.map((b) => b.toJson()).toList(),
    };
  }
}

class LatLng {
  final double lat;
  final double lng;

  LatLng({required this.lat, required this.lng});

  factory LatLng.fromJson(Map<String, dynamic> json) {
    return LatLng(
      lat: json['lat'].toDouble(),
      lng: json['lng'].toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'lat': lat,
      'lng': lng,
    };
  }
}

class EventData {
  final EventTimeline? timeline;
  final Map<String, EventRole>? roles;
  final EventSafety? safety;

  EventData({
    this.timeline,
    this.roles,
    this.safety,
  });

  factory EventData.fromJson(Map<String, dynamic> json) {
    return EventData(
      timeline: json['timeline'] != null 
          ? EventTimeline.fromJson(json['timeline']) 
          : null,
      roles: json['roles'] != null
          ? (json['roles'] as Map<String, dynamic>).map(
              (key, value) => MapEntry(key, EventRole.fromJson(value)))
          : null,
      safety: json['safety'] != null 
          ? EventSafety.fromJson(json['safety']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'timeline': timeline?.toJson(),
      'roles': roles?.map((key, value) => MapEntry(key, value.toJson())),
      'safety': safety?.toJson(),
    };
  }
}

class EventTimeline {
  final int duration;
  final List<EventAction> actions;

  EventTimeline({
    required this.duration,
    required this.actions,
  });

  factory EventTimeline.fromJson(Map<String, dynamic> json) {
    return EventTimeline(
      duration: json['duration'],
      actions: (json['actions'] as List)
          .map((a) => EventAction.fromJson(a))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'duration': duration,
      'actions': actions.map((a) => a.toJson()).toList(),
    };
  }
}

class EventAction {
  final int time;
  final String type;
  final String description;
  final List<String> roles;
  final ActionSynchronization? synchronization;

  EventAction({
    required this.time,
    required this.type,
    required this.description,
    required this.roles,
    this.synchronization,
  });

  factory EventAction.fromJson(Map<String, dynamic> json) {
    return EventAction(
      time: json['time'],
      type: json['type'],
      description: json['description'],
      roles: List<String>.from(json['roles']),
      synchronization: json['synchronization'] != null
          ? ActionSynchronization.fromJson(json['synchronization'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'time': time,
      'type': type,
      'description': description,
      'roles': roles,
      'synchronization': synchronization?.toJson(),
    };
  }
}

class ActionSynchronization {
  final String precision;
  final String cue;

  ActionSynchronization({
    required this.precision,
    required this.cue,
  });

  factory ActionSynchronization.fromJson(Map<String, dynamic> json) {
    return ActionSynchronization(
      precision: json['precision'],
      cue: json['cue'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'precision': precision,
      'cue': cue,
    };
  }
}

class EventRole {
  final int capacity;
  final String positions;
  final List<String> equipment;

  EventRole({
    required this.capacity,
    required this.positions,
    required this.equipment,
  });

  factory EventRole.fromJson(Map<String, dynamic> json) {
    return EventRole(
      capacity: json['capacity'],
      positions: json['positions'],
      equipment: List<String>.from(json['equipment']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'capacity': capacity,
      'positions': positions,
      'equipment': equipment,
    };
  }
}

class EventSafety {
  final List<EmergencyExit> emergencyExits;
  final String dispersalSignal;
  final int maxDuration;
  final Map<String, dynamic>? weatherLimits;

  EventSafety({
    required this.emergencyExits,
    required this.dispersalSignal,
    required this.maxDuration,
    this.weatherLimits,
  });

  factory EventSafety.fromJson(Map<String, dynamic> json) {
    return EventSafety(
      emergencyExits: (json['emergencyExits'] as List)
          .map((e) => EmergencyExit.fromJson(e))
          .toList(),
      dispersalSignal: json['dispersalSignal'],
      maxDuration: json['maxDuration'],
      weatherLimits: json['weatherLimits'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'emergencyExits': emergencyExits.map((e) => e.toJson()).toList(),
      'dispersalSignal': dispersalSignal,
      'maxDuration': maxDuration,
      'weatherLimits': weatherLimits,
    };
  }
}

class EmergencyExit {
  final String direction;
  final String description;

  EmergencyExit({
    required this.direction,
    required this.description,
  });

  factory EmergencyExit.fromJson(Map<String, dynamic> json) {
    return EmergencyExit(
      direction: json['direction'],
      description: json['description'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'direction': direction,
      'description': description,
    };
  }
}

class EventParticipant {
  final String userId;
  final String username;
  final String role;
  final DateTime joinedAt;

  EventParticipant({
    required this.userId,
    required this.username,
    required this.role,
    required this.joinedAt,
  });

  factory EventParticipant.fromJson(Map<String, dynamic> json) {
    return EventParticipant(
      userId: json['userId'],
      username: json['username'],
      role: json['role'],
      joinedAt: DateTime.parse(json['joinedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'username': username,
      'role': role,
      'joinedAt': joinedAt.toIso8601String(),
    };
  }
}