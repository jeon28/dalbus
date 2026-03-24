
const testEmailCheck = async (email) => {
    try {
        const response = await fetch('http://localhost:3000/api/auth/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        console.log(`Email: ${email}`);
        console.log(`Status: ${response.status}`);
        console.log(`Result: ${JSON.stringify(data)}`);
        console.log('---');
    } catch (err) {
        console.error(`Error checking ${email}:`, err.message);
    }
};

const runTests = async () => {
    console.log('Starting API Tests...');
    await testEmailCheck('jeon28+11@gmail.com');
    await testEmailCheck('chchun@naver.com');
    await testEmailCheck('new_unique_test_' + Date.now() + '@example.com');
};

runTests();
