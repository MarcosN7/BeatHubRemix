const io = require('socket.io-client');
const axios = require('axios');

async function run() {
    const baseUrl = 'http://localhost:4002/api';

    try {
        await axios.get(`${baseUrl}/health`, { validateStatus: () => true });
        console.log('Server is up!');
    } catch (e) {
        console.error('Server not reachable at', baseUrl);
        process.exit(1);
    }

    const ts = Date.now();
    const hostEmail = `moderator_at${ts}@test.com`;
    const trollEmail = `troll_at${ts}@test.com`;

    // Register users
    const hostRes = await axios.post(`${baseUrl}/auth/register`, { username: 'AdminHost', email: hostEmail, password: 'testpassword123' });
    const trollRes = await axios.post(`${baseUrl}/auth/register`, { username: 'TrollUser', email: trollEmail, password: 'testpassword123' });
    console.log('Users registered');

    // Host Creates Room
    const roomRes = await axios.post(`${baseUrl}/rooms`, { name: 'AntiTroll Room' }, { headers: { Authorization: `Bearer ${hostRes.data.token}` } });
    const roomId = roomRes.data.id;

    // Troll joins via API
    await axios.post(`${baseUrl}/rooms/${roomId}/join`, {}, { headers: { Authorization: `Bearer ${trollRes.data.token}` } });
    console.log('Room Created:', roomId);

    // Socket connections
    const hostSocket = io('http://localhost:4002', { auth: { token: hostRes.data.token } });
    const trollSocket = io('http://localhost:4002', { auth: { token: trollRes.data.token } });

    await new Promise(r => setTimeout(r, 1000));

    // Join room sockets
    await new Promise((resolve) => hostSocket.emit('join_room', roomId, resolve));
    await new Promise((resolve) => trollSocket.emit('join_room', roomId, resolve));

    await new Promise(r => setTimeout(r, 500));

    // Listen for moderation events
    let mutedFired = false;
    let rateLimitedFired = false;
    let kickedFired = false;

    trollSocket.on('rate_limited', (data) => {
        console.log(`[EVENT] Troll rate limited! Action: ${data.action}, Message: ${data.message}`);
        rateLimitedFired = true;
    });

    trollSocket.on('user_muted', (data) => {
        console.log(`[EVENT] Troll muted! Reason: ${data.reason}`);
        mutedFired = true;
    });

    trollSocket.on('kicked', (data) => {
        console.log(`[EVENT] Troll kicked! Reason: ${data.reason}`);
        kickedFired = true;
    });

    // ===== TEST 1: CHAT SPAM (5 messages in 10s) =====
    console.log('\n=== TEST 1: Chat Spam Limit (5 msgs / 10s) ===');
    for (let i = 1; i <= 6; i++) {
        const res = await new Promise(resolve => {
            trollSocket.emit('send_message', { roomId, content: `Spam ${i}` }, resolve);
        });
        if (res && res.error) {
            console.log(`Message ${i} rejected: ${res.error}`);
        } else {
            console.log(`Message ${i} sent successfully`);
        }
    }

    await new Promise(r => setTimeout(r, 500));
    console.log(`Rate Limited Event Fired: ${rateLimitedFired ? 'PASS' : 'FAIL'}`);

    // Wait a sec for rate limiter block (30s block is active right now for Troll!)

    // ===== TEST 2: ATTEMPT TO ADD SONG WHILE BLOCKED =====
    console.log('\n=== TEST 2: Add Song while Blocked ===');
    const songRes = await new Promise(resolve => {
        trollSocket.emit('add_song', { roomId, youtubeVideoId: 'TEST-123', title: 'Test', durationSeconds: 100 }, resolve);
    });
    console.log('Add Song response:', songRes.error ? `PASS (Rejected: ${songRes.error})` : 'FAIL (Accepted!)');


    // ===== TEST 3: TRIGGER MUTE (5 STRIKES) =====
    console.log('\n=== TEST 3: Trigger 10-Minute Mute ===');
    console.log('Flooding chat to rack up 5 spam strikes...');
    for (let i = 1; i <= 15; i++) {
        trollSocket.emit('send_message', { roomId, content: `More spam ${i}` });
        await new Promise(r => setTimeout(r, 50)); // faster loop
    }
    await new Promise(r => setTimeout(r, 2000));
    console.log(`User Muted Event Fired: ${mutedFired ? 'PASS' : 'FAIL'}`);

    // ===== TEST 4: KICK SYSTEM =====
    console.log('\n=== TEST 4: Kick System & 5-Min Ban ===');
    const kickRes = await new Promise(resolve => {
        hostSocket.emit('kick_user', { roomId, targetUserId: trollRes.data.user.id }, resolve);
    });
    console.log('Host kicked troll:', kickRes.success ? 'PASS' : `FAIL (${kickRes.error})`);

    await new Promise(r => setTimeout(r, 500));
    console.log(`Socket Kicked Event Fired: ${kickedFired ? 'PASS' : 'FAIL'}`);

    // Attempt to rejoin room immediately
    console.log('\n=== TEST 5: Rejoin Protection (Active Ban) ===');
    const rejoinRes = await new Promise(resolve => {
        trollSocket.emit('join_room', roomId, resolve);
    });
    console.log('Rejoin response:', rejoinRes.error ? `PASS (Rejected: ${rejoinRes.error})` : 'FAIL (Rejoined successfully!)');

    console.log('\n================================');
    console.log('Anti-Troll Tests Completed!');
    console.log('================================');
    process.exit(0);
}

run().catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
});
