const http = require('http');

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: data ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(data))
            } : {}
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testAPIs() {
    console.log('=== Testing User Management APIs ===\n');

    // 1. Get all users
    console.log('1. Getting all users...');
    const users = await makeRequest('GET', '/api/users');
    console.log('Users:', JSON.stringify(users, null, 2), '\n');

    // 2. Create a test user
    console.log('2. Creating test user "testuser"...');
    const newUser = await makeRequest('POST', '/api/users', {
        username: 'testuser',
        password: 'testpass123',
        role: 'user',
        permissions: ['messages', 'queue']
    });
    console.log('Created user:', JSON.stringify(newUser, null, 2), '\n');

    // 3. Get users again to see the new user
    console.log('3. Getting all users again...');
    const usersAfterCreate = await makeRequest('GET', '/api/users');
    console.log('Users count:', usersAfterCreate.length, '\n');

    const testUser = usersAfterCreate.find(u => u.username === 'testuser');
    if (!testUser) {
        console.log('ERROR: Test user not found!');
        return;
    }

    // 4. Test blocking user
    console.log('4. Blocking testuser (id:', testUser.id, ')...');
    const blockResult = await makeRequest('PUT', `/api/users/${testUser.id}/block`, { blocked: true });
    console.log('Block result:', JSON.stringify(blockResult, null, 2), '\n');

    // 5. Verify user is blocked
    console.log('5. Verifying user is blocked...');
    const usersAfterBlock = await makeRequest('GET', '/api/users');
    const blockedUser = usersAfterBlock.find(u => u.username === 'testuser');
    console.log('User blocked status:', blockedUser.blocked, '(should be 1)\n');

    // 6. Test login with blocked user
    console.log('6. Testing login with blocked user...');
    try {
        const loginResult = await makeRequest('POST', '/api/auth/login', {
            username: 'testuser',
            password: 'testpass123'
        });
        console.log('Login result:', JSON.stringify(loginResult, null, 2));
        if (loginResult.error && loginResult.error.includes('bloqueado')) {
            console.log('✓ Blocked user correctly denied login!\n');
        } else {
            console.log('✗ ERROR: Blocked user was able to login!\n');
        }
    } catch (err) {
        console.log('Login error:', err.message, '\n');
    }

    // 7. Unblock user
    console.log('7. Unblocking testuser...');
    const unblockResult = await makeRequest('PUT', `/api/users/${testUser.id}/block`, { blocked: false });
    console.log('Unblock result:', JSON.stringify(unblockResult, null, 2), '\n');

    // 8. Delete user
    console.log('8. Deleting testuser...');
    const deleteResult = await makeRequest('DELETE', `/api/users/${testUser.id}`);
    console.log('Delete result:', JSON.stringify(deleteResult, null, 2), '\n');

    // 9. Verify user is deleted
    console.log('9. Verifying user is deleted...');
    const usersAfterDelete = await makeRequest('GET', '/api/users');
    const deletedUser = usersAfterDelete.find(u => u.username === 'testuser');
    console.log('User found after delete:', deletedUser ? 'YES (ERROR!)' : 'NO (Correct!)', '\n');

    console.log('=== All tests completed! ===');
}

testAPIs().catch(console.error);
