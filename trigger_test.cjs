const fetch = require('node-fetch');

async function trigger() {
    try {
        const response = await fetch('http://localhost:3002/api/queue/generate-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageType: 'reminder', limit: 1 })
        });
        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

trigger();
