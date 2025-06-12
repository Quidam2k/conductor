import 'package:flutter/material.dart';

class CreateEventScreen extends StatelessWidget {
  const CreateEventScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Event'),
      ),
      body: const Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Create New Event',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 24),
            Text(
              'This is a placeholder for the event creation form. The full implementation will include:',
              style: TextStyle(fontStyle: FontStyle.italic),
            ),
            SizedBox(height: 16),
            Text('• Event title and description'),
            Text('• Date and time selection'),
            Text('• Location picker with map'),
            Text('• Timeline and action planning'),
            Text('• Role assignment'),
            Text('• Safety planning'),
            Text('• Privacy and visibility settings'),
          ],
        ),
      ),
    );
  }
}