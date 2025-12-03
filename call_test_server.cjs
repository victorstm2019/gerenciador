async function test() {
    try {
        const res = await fetch('http://localhost:3003/api/test-description', {
            method: 'POST'
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Erro:', err.message);
    }
}

test();
