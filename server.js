const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const port = 8080;

const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/cliente', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cliente.html'));
});

app.get('/entregador', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'entregador.html'));
});

app.get('/', (req, res) => {
    res.redirect('/cliente');
});

const locations = {}; // Armazena as localizações dos clientes
const cooldowns = {}; // Armazena o último tempo de envio de localização

const COOLDOWN_TIME = 100; //
const LOCATION_THRESHOLD = 0.0001; // Limite para considerar mudança significativa (latitude/longitude)

function hasSignificantChange(lat1, lon1, lat2, lon2) {
    return Math.abs(lat1 - lat2) > LOCATION_THRESHOLD || Math.abs(lon1 - lon2) > LOCATION_THRESHOLD;
}

app.post('/location', express.json(), (req, res) => {
    const { clientId, latitude, longitude, address } = req.body;
    console.log(`Recebido: clientId=${clientId}, latitude=${latitude}, longitude=${longitude}, address=${address}`);

    const now = Date.now();
    const lastUpdate = cooldowns[clientId] || 0;

    if (now - lastUpdate < COOLDOWN_TIME) {
        console.log(`Atualização frequente detectada para clientId=${clientId}`);
        return res.json({ status: 'Too frequent updates' });
    }

    cooldowns[clientId] = now;

    if (address) {
        console.log(`Endereço recebido: Cliente ${clientId} - ${address}`);
        locations[clientId] = { address };
        io.emit('locationUpdate', { clientId, address });
        return res.json({ status: 'Address received' });
    } else if (latitude && longitude) {
        const previousLocation = locations[clientId];

        if (previousLocation && !hasSignificantChange(previousLocation.latitude, previousLocation.longitude, latitude, longitude)) {
            console.log(`Sem mudança significativa na localização para clientId=${clientId}`);
            return res.json({ status: 'No significant change in location' });
        }

        console.log(`Localização recebida: Cliente ${clientId} - Latitude ${latitude}, Longitude ${longitude}`);
        locations[clientId] = { latitude, longitude };
        io.emit('locationUpdate', { clientId, latitude, longitude });
        return res.json({ status: 'Location received' });
    } else {
        console.log(`Dados inválidos recebidos: ${JSON.stringify(req.body)}`);
        return res.status(400).json({ status: 'Invalid data' });
    }
});

server.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

io.on('connection', (socket) => {
    console.log('Um cliente se conectou:', socket.id);

    socket.on('disconnect', () => {
        console.log('Um cliente se desconectou:', socket.id);
    });
});
