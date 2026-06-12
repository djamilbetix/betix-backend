const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const TRANSACTIONS_FILE = path.join(__dirname, 'data', 'transactions.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

function loadTransactions() {
    if (!fs.existsSync(TRANSACTIONS_FILE)) {
        return [];
    }
    const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf-8');
    return JSON.parse(data);
}

function saveTransactions(transactions) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
}

app.post('/api/pi/approve', async (req, res) => {
    const { paymentId, transactionId } = req.body;
    
    console.log(`Approve payment: ${paymentId}`);
    
    const transactions = loadTransactions();
    const pendingTx = transactions.find(t => t.paymentId === paymentId);
    
    if (pendingTx) {
        pendingTx.status = 'approved';
        pendingTx.approvedAt = new Date().toISOString();
        saveTransactions(transactions);
    }
    
    res.json({
        success: true,
        message: 'Paiement approuvé côté serveur'
    });
});

app.post('/api/pi/complete', async (req, res) => {
    const { paymentId, txid, amount, memo, metadata } = req.body;
    
    console.log(`Complete payment: ${paymentId}`);
    console.log(`Transaction ID: ${txid}`);
    console.log(`Event: ${metadata?.eventTitle || 'N/A'}`);
    
    let transactions = loadTransactions();
    
    const existingTx = transactions.find(t => t.paymentId === paymentId);
    
    if (existingTx) {
        existingTx.status = 'completed';
        existingTx.txid = txid;
        existingTx.completedAt = new Date().toISOString();
    } else {
        transactions.push({
            paymentId,
            txid,
            amount,
            memo,
            metadata,
            status: 'completed',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
        });
    }
    
    saveTransactions(transactions);
    
    res.json({
        success: true,
        message: 'Paiement complété avec succès',
        ticketValidated: true
    });
});

app.post('/api/pi/cancel', async (req, res) => {
    const { paymentId } = req.body;
    
    console.log(`Cancel payment: ${paymentId}`);
    
    const transactions = loadTransactions();
    const tx = transactions.find(t => t.paymentId === paymentId);
    
    if (tx) {
        tx.status = 'cancelled';
        tx.cancelledAt = new Date().toISOString();
        saveTransactions(transactions);
    }
    
    res.json({ success: true });
});

app.get('/api/pi/status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const transactions = loadTransactions();
    const tx = transactions.find(t => t.paymentId === paymentId);
    
    if (tx) {
        res.json({ success: true, transaction: tx });
    } else {
        res.json({ success: false, message: 'Transaction non trouvée' });
    }
});

app.get('/api/pi/transactions', (req, res) => {
    const { adminCode } = req.query;
    
    if (adminCode !== process.env.ADMIN_CODE) {
        return res.status(403).json({ error: 'Accès refusé' });
    }
    
    const transactions = loadTransactions();
    res.json({ success: true, transactions });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sandbox: process.env.PI_SANDBOX === 'true'
    });
});

app.listen(PORT, () => {
    console.log(`Serveur Betix démarré sur http://localhost:${PORT}`);
    console.log(`Mode sandbox: ${process.env.PI_SANDBOX === 'true' ? 'OUI' : 'NON'}`);
});