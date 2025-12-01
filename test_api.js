// Test API response
async function test() {
    try {
        const response = await fetch('http://localhost:3002/api/queue/today');
        const data = await response.json();
        console.log("API Response:");
        console.log(JSON.stringify(data, null, 2));

        if (data.length > 0) {
            console.log("\nFirst item keys:", Object.keys(data[0]));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
