import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import '../onboarding/welcome_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        children: [
          Consumer<AuthService>(
            builder: (context, authService, child) {
              final user = authService.currentUser;
              
              return ListTile(
                leading: const Icon(Icons.person),
                title: Text(user?.username ?? 'Unknown User'),
                subtitle: Text(user?.email ?? 'No email'),
                trailing: Chip(
                  label: Text(user?.role.toUpperCase() ?? 'UNKNOWN'),
                  backgroundColor: Theme.of(context).primaryColor.withOpacity(0.1),
                ),
              );
            },
          ),
          
          const Divider(),
          
          ListTile(
            leading: const Icon(Icons.cloud),
            title: const Text('Server Connection'),
            subtitle: Consumer<AuthService>(
              builder: (context, authService, child) {
                return Text(authService.serverUrl ?? 'Not connected');
              },
            ),
            onTap: () {
              // TODO: Implement server connection management
            },
          ),
          
          ListTile(
            leading: const Icon(Icons.sync),
            title: const Text('Data Sync'),
            subtitle: const Text('Manage offline data and synchronization'),
            onTap: () {
              // TODO: Implement sync settings
            },
          ),
          
          ListTile(
            leading: const Icon(Icons.security),
            title: const Text('Privacy & Security'),
            subtitle: const Text('Encryption and security settings'),
            onTap: () {
              // TODO: Implement security settings
            },
          ),
          
          const Divider(),
          
          ListTile(
            leading: const Icon(Icons.info),
            title: const Text('About'),
            subtitle: const Text('Version 1.0.0'),
            onTap: () => _showAboutDialog(context),
          ),
          
          ListTile(
            leading: const Icon(Icons.help),
            title: const Text('Help & Support'),
            onTap: () {
              // TODO: Implement help system
            },
          ),
          
          const Divider(),
          
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Logout', style: TextStyle(color: Colors.red)),
            onTap: () => _logout(context),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('About Conductor'),
        content: const Text(
          'Conductor v1.0.0\n\n'
          'A decentralized flash mob organization app for coordinating '
          'synchronized events with privacy and security in mind.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _logout(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await context.read<AuthService>().logout();
              if (context.mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const WelcomeScreen(),
                  ),
                  (route) => false,
                );
              }
            },
            child: const Text('Logout', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}