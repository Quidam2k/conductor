const ip = require('ip');
const portfinder = require('portfinder');
const natUpnp = require('nat-upnp');

class NetworkUtils {
    async getServerInfo() {
        const localIP = ip.address();
        const port = await this.getAvailablePort();
        
        return {
            port,
            localIP,
            localUrl: `http://${localIP}:${port}`,
            qrUrl: `http://${localIP}:${port}`,
            externalIP: null // Will be set by UPnP if available
        };
    }

    async getAvailablePort(preferredPort = 3000) {
        try {
            portfinder.basePort = preferredPort;
            const port = await portfinder.getPortPromise();
            return port;
        } catch (error) {
            console.warn('Could not find available port, using default 3000');
            return 3000;
        }
    }

    async setupPortForwarding(localPort) {
        try {
            const client = natUpnp.createClient();
            
            // Try to get external IP
            const externalIP = await new Promise((resolve, reject) => {
                client.externalIp((err, ip) => {
                    if (err) reject(err);
                    else resolve(ip);
                });
            });

            // Try to set up port mapping
            await new Promise((resolve, reject) => {
                client.portMapping({
                    public: localPort,
                    private: localPort,
                    ttl: 3600 // 1 hour
                }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log(`✅ UPnP port forwarding configured: ${externalIP}:${localPort}`);
            return externalIP;

        } catch (error) {
            console.warn('⚠️  UPnP port forwarding failed:', error.message);
            console.warn('   Manual port forwarding may be required for external access');
            return null;
        }
    }

    async getNetworkInterfaces() {
        const interfaces = require('os').networkInterfaces();
        const addresses = [];

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    addresses.push({
                        name,
                        address: iface.address,
                        netmask: iface.netmask
                    });
                }
            }
        }

        return addresses;
    }

    generateConnectionInfo(serverInfo) {
        return {
            serverUrl: serverInfo.localUrl,
            serverIP: serverInfo.localIP,
            serverPort: serverInfo.port,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
    }
}

module.exports = new NetworkUtils();