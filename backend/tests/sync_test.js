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
    const hostEmail = `synchost_${ts}@test.com`;
    const userEmail = `syncjoin_${ts}@test.com`;

    // Register users
    const hostRes = await axios.post(`${baseUrl}/auth/register`, { username: 'SyncHost', email: hostEmail, password: 'testpassword123' });
    const userRes = await axios.post(`${baseUrl}/auth/register`, { username: 'SyncJoiner', email: userEmail, password: 'testpassword123' });
    console.log('Users registered');

    // Host Creates Room
    const roomRes = await axios.post(`${baseUrl}/rooms`, { name: 'SyncTest Room' }, { headers: { Authorization: `Bearer ${hostRes.data.token}` } });
    const roomId = roomRes.data.id;

    // User joins via API
    await axios.post(`${baseUrl}/rooms/${roomId}/join`, {}, { headers: { Authorization: `Bearer ${userRes.data.token}` } });
    console.log('Room Created:', roomId);

    // Socket connections
    const hostSocket = io('http://localhost:4002', { auth: { token: hostRes.data.token } });
    const userSocket = io('http://localhost:4002', { auth: { token: userRes.data.token } });

    await new Promise(r => setTimeout(r, 1000));

    // Join room sockets
    await new Promise(resolve => hostSocket.emit('join_room', roomId, resolve));
    await new Promise(resolve => userSocket.emit('join_room', roomId, resolve));
    await new Promise(r => setTimeout(r, 500));

    // ===== TEST 1: play_song event includes sync data =====
    console.log('\n=== TEST 1: play_song includes sync timestamps ===');
    const playSongPromise = new Promise(resolve => {
        userSocket.once('play_song', (data) => {
            console.log('play_song received:', JSON.stringify(data, null, 2).substring(0, 200));
            resolve(data);
        });
    });

    await new Promise(resolve => {
        hostSocket.emit('add_song', { roomId, youtubeVideoId: 'SYNC-001', title: 'Sync Song 1', durationSeconds: 30 }, resolve);
    });

    const playSongData = await playSongPromise;
    console.log(`Has song object: ${playSongData.song ? 'PASS' : 'FAIL'}`);
    console.log(`Has startedAt: ${playSongData.startedAt !== undefined ? 'PASS' : 'FAIL'}`);
    console.log(`Has isPlaying: ${playSongData.isPlaying !== undefined ? 'PASS' : 'FAIL'}`);

    // ===== TEST 2: sync_state returns current playback position =====
    console.log('\n=== TEST 2: sync_state returns current time ===');
    await new Promise(r => setTimeout(r, 2000)); // wait 2 seconds

    const syncState = await new Promise(resolve => {
        userSocket.emit('sync_state', roomId, resolve);
    });
    console.log(`sync_state response:`, JSON.stringify(syncState));
    console.log(`currentTime > 1s: ${syncState.currentTime > 1 ? 'PASS' : 'FAIL'} (got ${syncState.currentTime.toFixed(2)}s)`);
    console.log(`isPlaying: ${syncState.isPlaying ? 'PASS' : 'FAIL'}`);
    console.log(`Has currentSongId: ${syncState.currentSongId ? 'PASS' : 'FAIL'}`);

    // ===== TEST 3: Pause updates sync state =====
    console.log('\n=== TEST 3: Pause/Resume sync ===');
    const pausePromise = new Promise(resolve => {
        userSocket.once('pause_song', (data) => {
            console.log(`pause_song received! currentTime: ${data.currentTime.toFixed(2)}s`);
            resolve(data);
        });
    });

    hostSocket.emit('playback_control', { roomId, action: 'pause' });
    const pauseData = await pausePromise;
    console.log(`pause_song has currentTime: ${pauseData.currentTime > 0 ? 'PASS' : 'FAIL'}`);

    // Verify sync_state while paused
    const pausedSync = await new Promise(resolve => {
        userSocket.emit('sync_state', roomId, resolve);
    });
    console.log(`While paused - isPlaying: ${pausedSync.isPlaying === false ? 'PASS' : 'FAIL'}`);
    console.log(`While paused - currentTime frozen: ${Math.abs(pausedSync.currentTime - pauseData.currentTime) < 0.5 ? 'PASS' : 'FAIL'}`);

    // Resume
    const resumePromise = new Promise(resolve => {
        userSocket.once('resume_song', (data) => {
            console.log(`resume_song received! currentTime: ${data.currentTime.toFixed(2)}s`);
            resolve(data);
        });
    });

    hostSocket.emit('playback_control', { roomId, action: 'play' });
    const resumeData = await resumePromise;
    console.log(`resume_song has currentTime: ${resumeData.currentTime > 0 ? 'PASS' : 'FAIL'}`);

    // ===== TEST 4: Late joiner gets sync state =====
    console.log('\n=== TEST 4: Late joiner sync ===');
    const lateEmail = `late_${ts}@test.com`;
    const lateRes = await axios.post(`${baseUrl}/auth/register`, { username: 'LateJoiner', email: lateEmail, password: 'testpassword123' });
    await axios.post(`${baseUrl}/rooms/${roomId}/join`, {}, { headers: { Authorization: `Bearer ${lateRes.data.token}` } });

    const lateSocket = io('http://localhost:4002', { auth: { token: lateRes.data.token } });
    await new Promise(r => setTimeout(r, 500));

    const latePlaySong = new Promise(resolve => {
        lateSocket.once('play_song', resolve);
    });
    const lateSyncState = new Promise(resolve => {
        lateSocket.once('sync_state', resolve);
    });

    await new Promise(resolve => lateSocket.emit('join_room', roomId, resolve));

    const latePlay = await latePlaySong;
    const lateSync = await lateSyncState;
    console.log(`Late joiner got play_song: ${latePlay.song ? 'PASS' : 'FAIL'}`);
    console.log(`Late joiner got sync_state: ${lateSync.currentSongId ? 'PASS' : 'FAIL'}`);
    console.log(`Late joiner currentTime > 0: ${lateSync.currentTime > 0 ? 'PASS' : 'FAIL'} (${lateSync.currentTime.toFixed(2)}s)`);

    lateSocket.disconnect();

    // ===== TEST 5: song_finished verification =====
    console.log('\n=== TEST 5: song_finished verification ===');
    // Should be rejected — song is not near its end
    const earlyFinish = await new Promise(resolve => {
        hostSocket.emit('song_finished', roomId, resolve);
    });
    console.log(`Early song_finished rejected: ${earlyFinish.error ? 'PASS' : 'FAIL'}`);

    console.log('\n================================');
    console.log('All Sync Tests Completed!');
    console.log('================================');
    process.exit(0);
}

run().catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
});
