const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Récupérer la clé API depuis les variables d'environnement
const PI_API_KEY = process.env.PI_API_KEY;
const PI_API_URL = "https://api.minepi.com";

console.log("🚀 Serveur Betix - Mode Sandbox");

// Endpoint d'approbation (appelé par le SDK Pi)
app.post('/api/pi/approve', async (req, res) => {
    const { paymentId } = req.body;
    console.log("📝 Approbation reçue pour:", paymentId);
    
    if (!PI_API_KEY) {
        console.error("❌ PI_API_KEY manquante!");
        return res.status(500).json({ error: "Clé API Pi non configurée" });
    }
    
    try {
        // Appel à l'API Pi pour approuver le paiement
        const response = await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/approve`, {}, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        console.log("✅ Paiement approuvé par Pi:", response.data);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Erreur approbation:", error.response?.data || error.message);
        res.status(500).json({ error: "Approbation échouée" });
    }
});

// Endpoint de complétion (appelé par le SDK Pi)
app.post('/api/pi/complete', async (req, res) => {
    const { paymentId, txid } = req.body;
    console.log("💰 Complétion reçue pour:", paymentId, txid);
    
    try {
        const response = await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/complete`, { txid }, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        console.log("✅ Paiement complété par Pi:", response.data);
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Erreur complétion:", error.response?.data || error.message);
        res.status(500).json({ error: "Complétion échouée" });
    }
});

// Endpoint d'annulation
app.post('/api/pi/cancel', async (req, res) => {
    const { paymentId } = req.body;
    console.log("❌ Annulation reçue pour:", paymentId);
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur sur le port ${PORT}`);
});