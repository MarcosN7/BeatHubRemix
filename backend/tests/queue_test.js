const io = require('socket.io-client');
const axios = require('axios');

async function run() {
    const baseUrl = 'http://localhost:4002/api';

    try {
        // Quick connectivity check (accept any status — just checking the server responds)
        await axios.get(`${baseUrl}/health`, { validateStatus: () => true });
        console.log('Server is up!');
    } catch (e) {
        console.error('Server not reachable at', baseUrl);
        process.exit(1);
    }

    const ts = Date.now();
    const hostEmail = `host_q${ts}@test.com`;
    const userEmail = `user_q${ts}@test.com`;

    // Register users
    const hostRes = await axios.post(`${baseUrl}/auth/register`, { username: 'QHost', email: hostEmail, password: 'testpassword123' });
    const userRes = await axios.post(`${baseUrl}/auth/register`, { username: 'QUser', email: userEmail, password: 'testpassword123' });
    console.log('Users registered');

    // Host Creates Room
    const roomRes = await axios.post(`${baseUrl}/rooms`, { name: 'QueueTest' }, { headers: { Authorization: `Bearer ${hostRes.data.token}` } });
    const roomId = roomRes.data.id;

    // User joins via API
    await axios.post(`${baseUrl}/rooms/${roomId}/join`, {}, { headers: { Authorization: `Bearer ${userRes.data.token}` } });
    console.log('Room Created:', roomId);

    // Socket connections
    const hostSocket = io('http://localhost:4002', { auth: { token: hostRes.data.token } });
    const userSocket = io('http://localhost:4002', { auth: { token: userRes.data.token } });

    await new Promise(r => setTimeout(r, 1500));

    // Join room sockets
    await new Promise((resolve) => {
        hostSocket.emit('join_room', roomId, (res) => { console.log('Host join:', res.success ? 'OK' : res.error); resolve(); });
    });
    await new Promise((resolve) => {
        userSocket.emit('join_room', roomId, (res) => { console.log('User join:', res.success ? 'OK' : res.error); resolve(); });
    });

    await new Promise(r => setTimeout(r, 500));

    // ===== TEST 1: Add First Song (should auto-play) =====
    console.log('\n=== TEST 1: Auto-Play First Song ===');
    const songPlayingPromise = new Promise(resolve => {
        userSocket.once('song_playing', (song) => {
            console.log('PASS: Auto-play broadcast received. Now playing:', song.title);
            resolve();
        });
    });

    const addResult = await new Promise(resolve => {
        userSocket.emit('add_song', { roomId, youtubeVideoId: 'ABC-123', title: 'First Song', durationSeconds: 3 }, resolve);
    });
    console.log('Add Song 1:', addResult.success ? 'PASS' : 'FAIL - ' + addResult.error);
    await songPlayingPromise;

    // ===== TEST 2: Duplicate Protection =====
    console.log('\n=== TEST 2: Duplicate Protection ===');
    const dupResult = await new Promise(resolve => {
        userSocket.emit('add_song', { roomId, youtubeVideoId: 'ABC-123', title: 'First Song', durationSeconds: 3 }, resolve);
    });
    console.log('Duplicate check:', dupResult.error ? 'PASS - ' + dupResult.error : 'FAIL - should have been rejected');

    // ===== TEST 3: Add songs sequentially up to limit =====
    console.log('\n=== TEST 3: User Limit (5 active songs) ===');
    for (let i = 2; i <= 5; i++) {
        const r = await new Promise(resolve => {
            userSocket.emit('add_song', { roomId, youtubeVideoId: `SONG-${i}`, title: `Song ${i}`, durationSeconds: 120 }, resolve);
        });
        console.log(`Song ${i}:`, r.success ? 'PASS (added)' : 'FAIL - ' + r.error);
    }

    // This 6th should be REJECTED (5 active: 1 playing + 4 queued)
    const sixthResult = await new Promise(resolve => {
        userSocket.emit('add_song', { roomId, youtubeVideoId: 'SONG-6', title: 'Song 6', durationSeconds: 120 }, resolve);
    });
    console.log('Song 6 (should fail):', sixthResult.error ? 'PASS - ' + sixthResult.error : 'FAIL - was accepted but should be rejected');

    // ===== TEST 4: Wait for auto-progression timer =====
    console.log('\n=== TEST 4: Auto-Progression (3s timer) ===');
    const nextSongPromise = new Promise(resolve => {
        userSocket.once('song_playing', (song) => {
            console.log('PASS: Backend timer triggered auto-progression. Now playing:', song.title);
            resolve();
        });
        setTimeout(() => { console.log('FAIL: Auto-progression did not fire in time'); resolve(); }, 5000);
    });
    await nextSongPromise;

    // ===== TEST 5: Remove song =====
    console.log('\n=== TEST 5: Remove Song ===');
    const badRemove = await new Promise(resolve => {
        hostSocket.emit('remove_song', { roomId, songId: 'nonexistent-id' }, resolve);
    });
    console.log('Remove bad ID:', badRemove.error ? 'PASS - ' + badRemove.error : 'FAIL');

    console.log('\n=============================');
    console.log('All Queue Tests Completed!');
    console.log('=============================');
    process.exit(0);
}

run().catch(err => {
    if (err.response) {
        console.error('Test failed:', err.response.status, JSON.stringify(err.response.data));
    } else {
        console.error('Test failed:', err.message);
    }
    process.exit(1);
});
