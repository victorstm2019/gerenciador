
// const fetch = require('node-fetch'); // Using native fetch

async function testGenerateBatch() {
    try {
        console.log("Testing /api/queue/generate-batch...");
        const response = await fetch('http://localhost:3002/api/queue/generate-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ types: ['reminder'] })
        });

        const status = response.status;
        const text = await response.text();

        console.log(`Status: ${status}`);
        console.log(`Body: ${text}`);

        try {
            const json = JSON.parse(text);
            console.log("Parsed JSON:", json);
        } catch (e) {
            console.log("Response is not JSON");
        }

    } catch (error) {
        console.error("Request failed:", error);
    }
}

testGenerateBatch();
