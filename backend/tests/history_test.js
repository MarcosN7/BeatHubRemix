const io = require('socket.io-client');
const axios = require('axios');

async function run() {
    const baseUrl = 'http://localhost:4002/api';
    const ts = Date.now();

    // Register 1 user
    const hRes = await axios.post(`${baseUrl}/auth/register`, { username: 'HistoryHost', email: `hhistory_${ts}@test.com`, password: 'testpassword' });

    // Host creates room
    const rRes = await axios.post(`${baseUrl}/rooms`, { name: `HistoryTest-${ts}` }, { headers: { Authorization: `Bearer ${hRes.data.token}` } });
    const roomId = rRes.data.id;

    // Join room socket
    const hostSocket = io('http://localhost:4002', { auth: { token: hRes.data.token } });
    await new Promise(r => setTimeout(r, 500));
    await new Promise(r => hostSocket.emit('join_room', roomId, r));

    // Add 2 songs
    console.log('Adding 2 songs to queue...');
    await new Promise(resolve => {
        hostSocket.emit('add_song', { roomId, youtubeVideoId: 'HIST-001', title: 'History Song 1', durationSeconds: 60 }, resolve);
    });

    // First song auto-plays immediately since queue was empty.
    await new Promise(r => setTimeout(r, 1000));

    await new Promise(resolve => {
        hostSocket.emit('add_song', { roomId, youtubeVideoId: 'HIST-002', title: 'History Song 2', durationSeconds: 60 }, resolve);
    });

    await new Promise(r => setTimeout(r, 1000));

    // Now song 1 is playing, song 2 is queued.
    // Let's emit 'song_finished' to simulate song 1 ending (bypassing the 3s tolerance for testing by manually calling playNext on the server? Actually song_finished enforces the 3s tolerance. So we either need a short song, or we just vote skip).
    // Vote skip is easier!
    console.log('Voting to skip Song 1...');
    await new Promise(resolve => hostSocket.emit('vote_skip', roomId, resolve));

    await new Promise(r => setTimeout(r, 2000)); // wait for database write

    // Hit the History API
    console.log('\n=== TEST 1: Room History API ===');
    const historyRes = await axios.get(`${baseUrl}/rooms/${roomId}/history`);
    const history = historyRes.data;

    console.log(`History length > 0: ${history.length > 0 ? 'PASS' : 'FAIL'} (got ${history.length})`);

    if (history.length > 0) {
        console.log(`History records Song 1: ${history[0].title === 'History Song 1' ? 'PASS' : 'FAIL'}`);
        console.log(`History recorded video ID: ${history[0].youtubeVideoId === 'HIST-001' ? 'PASS' : 'FAIL'}`);
    }

    console.log('\n================================');
    console.log('History Tests Completed!');
    console.log('================================');
    process.exit(0);
}

run().catch(err => {
    console.error('Test failed:', err.response?.data || err.message);
    process.exit(1);
});
