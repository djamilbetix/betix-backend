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

// ============================================================
// 1. ENDPOINT D'APPROBATION (existant, légèrement amélioré)
// ============================================================
app.post('/api/pi/approve', async (req, res) => {
    const { paymentId } = req.body;
    console.log("📝 Approbation reçue pour:", paymentId);
    
    if (!PI_API_KEY) {
        console.error("❌ PI_API_KEY manquante!");
        return res.status(500).json({ error: "Clé API Pi non configurée" });
    }
    
    try {
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

// ============================================================
// 2. ENDPOINT DE COMPLÉTION (existant)
// ============================================================
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

// ============================================================
// 3. ENDPOINT D'ANNULATION (existant)
// ============================================================
app.post('/api/pi/cancel', async (req, res) => {
    const { paymentId } = req.body;
    console.log("❌ Annulation reçue pour:", paymentId);
    // On appelle l'API Pi pour annuler
    try {
        await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/cancel`, {}, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Erreur annulation:", error.response?.data || error.message);
        res.status(500).json({ error: "Annulation échouée" });
    }
});

// ============================================================
// 4. 🆕 NOUVEAU : ENDPOINT DE RÉSOLUTION AUTOMATIQUE
//    (Appelé par le frontend via onIncompletePaymentFound)
// ============================================================
app.post('/api/pi/resolve', async (req, res) => {
    const { paymentId } = req.body;
    console.log("🔄 Résolution demandée pour:", paymentId);

    if (!paymentId) {
        return res.status(400).json({ error: 'paymentId requis' });
    }

    try {
        // 4a. Récupérer les détails du paiement
        const paymentRes = await axios.get(`${PI_API_URL}/v2/payments/${paymentId}`, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        const payment = paymentRes.data;

        // 4b. Si txid existe → on complète
        if (payment.transaction && payment.transaction.txid) {
            await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/complete`, 
                { txid: payment.transaction.txid },
                { headers: { 'Authorization': `Key ${PI_API_KEY}` } }
            );
            console.log(`✅ Paiement ${paymentId} complété automatiquement.`);
            return res.status(200).json({ status: 'completed', paymentId });
        } 
        // 4c. Sinon → on annule
        else {
            await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/cancel`, {}, {
                headers: { 'Authorization': `Key ${PI_API_KEY}` }
            });
            console.log(`✅ Paiement ${paymentId} annulé automatiquement.`);
            return res.status(200).json({ status: 'cancelled', paymentId });
        }
    } catch (error) {
        console.error("❌ Erreur résolution:", error.response?.data || error.message);
        return res.status(500).json({ error: "Résolution échouée" });
    }
});

// ============================================================
// 5. 🆕 ROUTINE DE NETTOYAGE AU DÉMARRAGE
//    (récupère et résout tous les paiements bloqués)
// ============================================================
async function cleanIncompletePayments() {
    if (!PI_API_KEY) {
        console.warn("⚠️ Pas de clé API, nettoyage ignoré.");
        return;
    }
    try {
        console.log("🧹 Nettoyage des paiements incomplets...");
        const response = await axios.get(`${PI_API_URL}/v2/payments/incomplete_server_payments`, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        const payments = response.data.payments || [];
        if (payments.length === 0) {
            console.log("✅ Aucun paiement incomplet trouvé.");
            return;
        }
        console.log(`📦 ${payments.length} paiement(s) incomplet(s) trouvés. Résolution...`);
        
        for (const p of payments) {
            const paymentId = p.identifier;
            try {
                if (p.transaction && p.transaction.txid) {
                    await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/complete`, 
                        { txid: p.transaction.txid },
                        { headers: { 'Authorization': `Key ${PI_API_KEY}` } }
                    );
                    console.log(`✅ Nettoyage : paiement ${paymentId} complété.`);
                } else {
                    await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/cancel`, {}, {
                        headers: { 'Authorization': `Key ${PI_API_KEY}` }
                    });
                    console.log(`✅ Nettoyage : paiement ${paymentId} annulé.`);
                }
            } catch (e) {
                console.error(`❌ Erreur nettoyage ${paymentId}:`, e.response?.data || e.message);
            }
        }
        console.log("🧹 Nettoyage terminé.");
    } catch (error) {
        console.error("❌ Erreur lors du nettoyage:", error.response?.data || error.message);
    }
}

// ============================================================
// 6. HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ============================================================
// 7. DÉMARRAGE DU SERVEUR + NETTOYAGE
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Serveur sur le port ${PORT}`);
    // Lance le nettoyage au démarrage (attends 2 secondes pour laisser le temps à l'API)
    setTimeout(async () => {
        await cleanIncompletePayments();
    }, 2000);
});