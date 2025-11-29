const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
    console.log('Starting verification...');

    // 1. Create User
    console.log('1. Creating user "test_block"...');
    const createRes = await fetch(`${BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'test_block',
            password: 'password123',
            role: 'user',
            permissions: ['connections']
        })
    });
    const user = await createRes.json();
    if (!user.id) {
        console.error('Failed to create user:', user);
        return;
    }
    console.log('User created:', user.id);

    // 2. Login (Should succeed)
    console.log('2. Testing login (should succeed)...');
    const loginRes1 = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test_block', password: 'password123' })
    });
    if (loginRes1.ok) {
        console.log('Login successful.');
    } else {
        console.error('Login failed:', await loginRes1.json());
    }

    // 3. Block User
    console.log('3. Blocking user...');
    await fetch(`${BASE_URL}/users/${user.id}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: true })
    });
    console.log('User blocked.');

    // 4. Login (Should fail)
    console.log('4. Testing login (should fail)...');
    const loginRes2 = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test_block', password: 'password123' })
    });
    if (loginRes2.status === 403) {
        console.log('Login failed as expected (403 Forbidden).');
    } else {
        console.error('Login did not fail as expected:', loginRes2.status, await loginRes2.json());
    }

    // 5. Unblock User
    console.log('5. Unblocking user...');
    await fetch(`${BASE_URL}/users/${user.id}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: false })
    });
    console.log('User unblocked.');

    // 6. Login (Should succeed)
    console.log('6. Testing login (should succeed)...');
    const loginRes3 = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test_block', password: 'password123' })
    });
    if (loginRes3.ok) {
        console.log('Login successful.');
    } else {
        console.error('Login failed:', await loginRes3.json());
    }

    // 7. Delete User
    console.log('7. Deleting user...');
    await fetch(`${BASE_URL}/users/${user.id}`, {
        method: 'DELETE'
    });
    console.log('User deleted.');

    console.log('Verification complete.');
}

runTests().catch(console.error);
