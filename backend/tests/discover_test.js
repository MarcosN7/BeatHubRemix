const io = require('socket.io-client');
const axios = require('axios');

async function run() {
    const baseUrl = 'http://localhost:4002/api';
    const ts = Date.now();

    // Register 3 users
    const hRes = await axios.post(`${baseUrl}/auth/register`, { username: 'Host', email: `host_${ts}@test.com`, password: 'testpassword123' });
    const u1Res = await axios.post(`${baseUrl}/auth/register`, { username: 'User1', email: `l1_${ts}@test.com`, password: 'testpassword123' });
    const u2Res = await axios.post(`${baseUrl}/auth/register`, { username: 'User2', email: `l2_${ts}@test.com`, password: 'testpassword123' });

    // Host creates room
    const rRes = await axios.post(`${baseUrl}/rooms`, { name: `DiscoverMe-${ts}` }, { headers: { Authorization: `Bearer ${hRes.data.token}` } });
    const roomId = rRes.data.id;

    // Join room sockets (this registers initial presence via join_room handler)
    const hostSocket = io('http://localhost:4002', { auth: { token: hRes.data.token } });
    const u1Socket = io('http://localhost:4002', { auth: { token: u1Res.data.token } });
    const u2Socket = io('http://localhost:4002', { auth: { token: u2Res.data.token } });

    await new Promise(r => setTimeout(r, 500));
    await new Promise(r => hostSocket.emit('join_room', roomId, r));
    await new Promise(r => u1Socket.emit('join_room', roomId, r));
    await new Promise(r => u2Socket.emit('join_room', roomId, r));

    // Send explicit heartbeats
    hostSocket.emit('heartbeat', roomId);
    u1Socket.emit('heartbeat', roomId);
    u2Socket.emit('heartbeat', roomId);
    await new Promise(r => setTimeout(r, 500));

    // Add a song so it shows up in discovery queue
    await new Promise(resolve => {
        hostSocket.emit('add_song', { roomId, youtubeVideoId: 'DISC-001', title: 'Discover Hit', durationSeconds: 60 }, resolve);
    });
    await new Promise(r => setTimeout(r, 1000));

    // TEST: Hit the discovery API
    console.log('\n=== TEST 1: Discovery API ===');
    const discoverRes = await axios.get(`${baseUrl}/rooms/discover`);
    const rooms = discoverRes.data;
    const targetRoom = rooms.find(r => r.id === roomId);

    console.log(`Found rooms: ${rooms.length > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`Target room found: ${targetRoom ? 'PASS' : 'FAIL'}`);

    if (targetRoom) {
        console.log(`Listener count = 3: ${targetRoom.listeners === 3 ? 'PASS' : 'FAIL'} (got ${targetRoom.listeners})`);
        console.log(`Current song title: ${targetRoom.currentSong?.title === 'Discover Hit' ? 'PASS' : 'FAIL'}`);
        console.log(`Host username present: ${targetRoom.host?.username === 'Host' ? 'PASS' : 'FAIL'}`);
    }

    // Disconnect one user, check presence update
    console.log('\n=== TEST 2: Presence update on disconnect ===');
    u2Socket.disconnect();
    await new Promise(r => setTimeout(r, 1000));

    const discoverRes2 = await axios.get(`${baseUrl}/rooms/discover`);
    const targetRoom2 = discoverRes2.data.find(r => r.id === roomId);

    if (targetRoom2) {
        console.log(`Listener count decreased to 2: ${targetRoom2.listeners === 2 ? 'PASS' : 'FAIL'} (got ${targetRoom2.listeners})`);
    }

    console.log('\n================================');
    console.log('Discovery Tests Completed!');
    console.log('================================');
    process.exit(0);
}

run().catch(err => {
    console.error('Test failed:', err.response?.data || err.message);
    process.exit(1);
});
