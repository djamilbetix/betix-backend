const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

console.log("✅ Serveur Betix démarré");

app.post('/api/pi/approve', (req, res) => {
    console.log("✅ Approbation reçue:", req.body.paymentId);
    res.status(200).json({ success: true });
});

app.post('/api/pi/complete', (req, res) => {
    console.log("💰 Complétion reçue:", req.body.paymentId, req.body.txid);
    res.status(200).json({ success: true });
});

app.post('/api/pi/cancel', (req, res) => {
    console.log("❌ Annulation reçue:", req.body.paymentId);
    res.status(200).json({ success: true });
});

app.get('/api/health', (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur sur le port ${PORT}`);
});