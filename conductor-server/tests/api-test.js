#!/usr/bin/env node

const http = require('http');
const https = require('https');

const DEFAULT_BASE_URL = 'http://localhost:3000';
const TEST_USER = {
    username: 'testuser_' + Date.now(),
    password: 'testpassword123',
    email: 'test@example.com',
    inviteCode: 'conductor2024'
};

class APITester {
    constructor(baseUrl = DEFAULT_BASE_URL) {
        this.baseUrl = baseUrl;
        this.authToken = null;
        this.testResults = [];
    }

    async makeRequest(method, path, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: method.toUpperCase(),
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Conductor-API-Tester/1.0',
                    ...headers
                }
            };

            if (this.authToken) {
                options.headers.Authorization = `Bearer ${this.authToken}`;
            }

            const req = client.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const jsonBody = body ? JSON.parse(body) : {};
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: jsonBody
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: body
                        });
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    log(test, result, details = '') {
        const status = result ? '✅' : '❌';
        console.log(`${status} ${test} ${details}`);
        this.testResults.push({ test, result, details });
    }

    async testHealthCheck() {
        try {
            const response = await this.makeRequest('GET', '/api/health');
            const isHealthy = response.statusCode === 200 && response.body.status === 'ok';
            this.log('Health Check', isHealthy, `(${response.statusCode})`);
            return isHealthy;
        } catch (error) {
            this.log('Health Check', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testUserRegistration() {
        try {
            const response = await this.makeRequest('POST', '/api/auth/register', TEST_USER);
            const isSuccess = response.statusCode === 201 && response.body.token;
            
            if (isSuccess) {
                this.authToken = response.body.token;
            }
            
            this.log('User Registration', isSuccess, `(${response.statusCode})`);
            return isSuccess;
        } catch (error) {
            this.log('User Registration', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testUserLogin() {
        try {
            const response = await this.makeRequest('POST', '/api/auth/login', {
                username: TEST_USER.username,
                password: TEST_USER.password
            });
            
            const isSuccess = response.statusCode === 200 && response.body.token;
            
            if (isSuccess) {
                this.authToken = response.body.token;
            }
            
            this.log('User Login', isSuccess, `(${response.statusCode})`);
            return isSuccess;
        } catch (error) {
            this.log('User Login', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testTokenVerification() {
        try {
            const response = await this.makeRequest('GET', '/api/auth/verify');
            const isSuccess = response.statusCode === 200 && response.body.valid;
            this.log('Token Verification', isSuccess, `(${response.statusCode})`);
            return isSuccess;
        } catch (error) {
            this.log('Token Verification', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testUserProfile() {
        try {
            const response = await this.makeRequest('GET', '/api/users/profile');
            const isSuccess = response.statusCode === 200 && response.body.user;
            this.log('User Profile', isSuccess, `(${response.statusCode})`);
            return isSuccess;
        } catch (error) {
            this.log('User Profile', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testEventsList() {
        try {
            const response = await this.makeRequest('GET', '/api/events');
            const isSuccess = response.statusCode === 200 && Array.isArray(response.body.events);
            this.log('Events List', isSuccess, `(${response.statusCode}, ${response.body.events?.length || 0} events)`);
            return isSuccess;
        } catch (error) {
            this.log('Events List', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testEventCreation() {
        try {
            const testEvent = {
                title: 'Test Event ' + Date.now(),
                description: 'This is a test event created by the API tester',
                startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
                location: {
                    address: 'Test Location',
                    latitude: 40.7589,
                    longitude: -73.9851
                }
            };

            const response = await this.makeRequest('POST', '/api/events', testEvent);
            const isSuccess = response.statusCode === 201 && response.body.event;
            this.log('Event Creation', isSuccess, `(${response.statusCode})`);
            return isSuccess;
        } catch (error) {
            this.log('Event Creation', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testQRCodePage() {
        try {
            const response = await this.makeRequest('GET', '/qr');
            const isSuccess = response.statusCode === 200;
            this.log('QR Code Page', isSuccess, `(${response.statusCode})`);
            return isSuccess;
        } catch (error) {
            this.log('QR Code Page', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testInvalidEndpoint() {
        try {
            const response = await this.makeRequest('GET', '/api/nonexistent');
            const isSuccess = response.statusCode === 404;
            this.log('404 Handling', isSuccess, `(${response.statusCode})`);
            return isSuccess;
        } catch (error) {
            this.log('404 Handling', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async testRateLimiting() {
        try {
            // Make multiple rapid requests
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(this.makeRequest('GET', '/api/health'));
            }
            
            const responses = await Promise.all(promises);
            const allSuccessful = responses.every(r => r.statusCode === 200);
            this.log('Rate Limiting (Burst)', allSuccessful, '(10 rapid requests)');
            return allSuccessful;
        } catch (error) {
            this.log('Rate Limiting (Burst)', false, `(Error: ${error.message})`);
            return false;
        }
    }

    async runAllTests() {
        console.log('🧪 Conductor API Test Suite');
        console.log('============================\n');
        console.log(`Testing against: ${this.baseUrl}\n`);

        const tests = [
            'testHealthCheck',
            'testQRCodePage',
            'testInvalidEndpoint',
            'testUserRegistration',
            'testTokenVerification',
            'testUserProfile',
            'testEventsList',
            'testEventCreation',
            'testUserLogin',
            'testRateLimiting'
        ];

        let passed = 0;
        let total = tests.length;

        for (const test of tests) {
            try {
                const result = await this[test]();
                if (result) passed++;
            } catch (error) {
                console.log(`❌ ${test} failed with error: ${error.message}`);
            }
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('\n📊 Test Results');
        console.log('================');
        console.log(`Passed: ${passed}/${total}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        if (passed === total) {
            console.log('\n🎉 All tests passed! API is working correctly.');
            process.exit(0);
        } else {
            console.log('\n⚠️  Some tests failed. Check server logs for details.');
            process.exit(1);
        }
    }
}

async function main() {
    const baseUrl = process.argv[2] || DEFAULT_BASE_URL;
    const tester = new APITester(baseUrl);
    await tester.runAllTests();
}

if (require.main === module) {
    main();
}