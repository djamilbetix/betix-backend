const express = require('express');
const cors = require('cors');
const app = express();

// CORS correct pour Pi Browser
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.options('*', cors());

// Routes
app.post('/api/pi/approve', (req, res) => {
    console.log('✅ Approve:', req.body.paymentId);
    res.json({ success: true });
});

app.post('/api/pi/complete', (req, res) => {
    console.log('💰 Complete:', req.body.paymentId, req.body.txid);
    res.json({ success: true });
});

app.post('/api/pi/cancel', (req, res) => {
    console.log('❌ Cancel:', req.body.paymentId);
    res.json({ success: true });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur sur port ${PORT}`);
});