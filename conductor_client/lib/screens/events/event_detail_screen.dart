import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/event_service.dart';
import '../../models/event.dart';

class EventDetailScreen extends StatelessWidget {
  final String eventId;

  const EventDetailScreen({
    super.key,
    required this.eventId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Event Details'),
      ),
      body: Consumer<EventService>(
        builder: (context, eventService, child) {
          final event = eventService.getLocalEvent(eventId);
          
          if (event == null) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }
          
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 16),
                if (event.description != null)
                  Text(
                    event.description!,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                const SizedBox(height: 24),
                const Text(
                  'This is a placeholder for the detailed event view. The full implementation will include:',
                  style: TextStyle(fontStyle: FontStyle.italic),
                ),
                const SizedBox(height: 16),
                const Text('• Event timeline and actions'),
                const Text('• Participant list and roles'),
                const Text('• Location and map view'),
                const Text('• Safety information'),
                const Text('• Join/leave functionality'),
                const Text('• Real-time synchronization status'),
              ],
            ),
          );
        },
      ),
    );
  }
}