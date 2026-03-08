const io = require('socket.io-client');
const axios = require('axios');

async function run() {
    const baseUrl = 'http://localhost:4001/api';
    // Setup users
    const hostEmail = 'host' + Date.now() + '@example.com';
    const adminEmail = 'admin' + Date.now() + '@example.com';
    const userEmail = 'user' + Date.now() + '@example.com';

    const hostRes = await axios.post(`${baseUrl}/auth/register`, { username: 'Host', email: hostEmail, password: 'testpassword123' });
    const adminRes = await axios.post(`${baseUrl}/auth/register`, { username: 'Admin', email: adminEmail, password: 'testpassword123' });
    const userRes = await axios.post(`${baseUrl}/auth/register`, { username: 'User', email: userEmail, password: 'testpassword123' });

    // Host Creates Room
    const roomRes = await axios.post(`${baseUrl}/rooms`, { name: 'WebSockets Test' }, { headers: { Authorization: `Bearer ${hostRes.data.token}` } });
    const roomId = roomRes.data.id;

    // Others join via API (to get on participant DB list)
    await axios.post(`${baseUrl}/rooms/${roomId}/join`, {}, { headers: { Authorization: `Bearer ${adminRes.data.token}` } });
    await axios.post(`${baseUrl}/rooms/${roomId}/join`, {}, { headers: { Authorization: `Bearer ${userRes.data.token}` } });

    console.log('Room Created:', roomId);

    // Socket connections
    const hostSocket = io('http://localhost:4001', { auth: { token: hostRes.data.token } });
    const adminSocket = io('http://localhost:4001', { auth: { token: adminRes.data.token } });
    const userSocket = io('http://localhost:4001', { auth: { token: userRes.data.token } });

    await new Promise(r => setTimeout(r, 1000));

    // Join room sockets
    hostSocket.emit('join_room', roomId, (res) => console.log('Host join:', res.success ? 'OK' : res.error));
    adminSocket.emit('join_room', roomId, (res) => console.log('Admin join:', res.success ? 'OK' : res.error));
    userSocket.emit('join_room', roomId, (res) => console.log('User join:', res.success ? 'OK' : res.error));

    await new Promise(r => setTimeout(r, 1000));

    // Promote
    hostSocket.emit('promote_admin', { roomId, targetUserId: adminRes.data.user.id }, (res) => console.log('Host Promoted Admin:', res.success ? 'OK' : res.error));

    await new Promise(r => setTimeout(r, 500));

    // User tests voting to skip
    userSocket.emit('vote_skip', roomId);
    adminSocket.on('skip_vote_updated', (data) => console.log('Skip votes:', data.currentVotes, '/', data.outOf));

    await new Promise(r => setTimeout(r, 500));

    // Host forcefully skips
    hostSocket.emit('vote_skip', roomId);
    userSocket.on('skip_song', (data) => console.log('Song skipped! Forced:', data.forcedByHost));

    await new Promise(r => setTimeout(r, 1000));

    // Validate Kick mechanism
    adminSocket.emit('kick_user', { roomId, targetUserId: userRes.data.user.id }, (res) => console.log('Admin kicked User:', res.success ? 'OK' : res.error));
    userSocket.on('kicked', (data) => console.log('User was kicked! Reason:', data.reason));

    await new Promise(r => setTimeout(r, 2000));
    console.log('Tests Completed successfully');
    process.exit(0);
}
run();
