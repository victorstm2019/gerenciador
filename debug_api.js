const http = require('http');

http.get('http://localhost:3002/api/queue/today', (resp) => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', (chunk) => {
        data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
        try {
            const items = JSON.parse(data);
            console.log('Total items:', items.length);
            const blocked = items.filter(i => i.status === 'BLOCKED');
            console.log('Blocked items:', blocked.length);
            if (blocked.length > 0) {
                console.log('First blocked item:', blocked[0]);
            } else {
                console.log('Sample item:', items[0]);
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data);
        }
    });

}).on("error", (err) => {
    console.log("Error: " + err.message);
});
