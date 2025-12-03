const fetch = require('node-fetch');

async function testGenerateByDate() {
    try {
        const response = await fetch('http://localhost:3002/api/queue/generate-by-date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startDate: '2025-12-01', // Format sent by input type="date"
                endDate: '2025-12-31'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', response.status, errorText);
        } else {
            const data = await response.json();
            console.log('Success:', data.length, 'items found');
        }
    } catch (error) {
        console.error('Request failed:', error);
    }
}

testGenerateByDate();
