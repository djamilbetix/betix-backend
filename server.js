const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors());
app.use(express.json());

// ============================================================
// 0. SUPABASE CONFIGURATION
// ============================================================
const SUPABASE_URL = "https://tycebwzgsujiazgopkri.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5Y2Vid3pnc3VqaWF6Z29wa3JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODg2NTMsImV4cCI6MjA5Nzk2NDY1M30.7x1rouTbMJE2WcY008vRnqGuAWq3yM_eZCS4Q8_3TrQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

console.log("Supabase connected");

// ============================================================
// PI API KEY
// ============================================================
const PI_API_KEY = process.env.PI_API_KEY;
const PI_API_URL = "https://api.minepi.com";

console.log("Betix Server - Sandbox Mode");

// ============================================================
// 1. APPROVE PAYMENT
// ============================================================
app.post('/api/pi/approve', async (req, res) => {
    const { paymentId } = req.body;
    console.log("Approve request for:", paymentId);
    
    if (!PI_API_KEY) {
        console.error("PI_API_KEY is missing");
        return res.status(500).json({ error: "Pi API key not configured" });
    }
    
    try {
        const response = await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/approve`, {}, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        console.log("Payment approved by Pi:", response.data);
        res.json({ success: true });
    } catch (error) {
        console.error("Approval error:", error.response?.data || error.message);
        res.status(500).json({ error: "Approval failed" });
    }
});

// ============================================================
// 2. COMPLETE PAYMENT
// ============================================================
app.post('/api/pi/complete', async (req, res) => {
    const { paymentId, txid } = req.body;
    console.log("Complete request for:", paymentId, txid);
    
    try {
        const response = await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/complete`, { txid }, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        console.log("Payment completed by Pi:", response.data);
        res.json({ success: true });
    } catch (error) {
        console.error("Completion error:", error.response?.data || error.message);
        res.status(500).json({ error: "Completion failed" });
    }
});

// ============================================================
// 3. CANCEL PAYMENT
// ============================================================
app.post('/api/pi/cancel', async (req, res) => {
    const { paymentId } = req.body;
    console.log("Cancel request for:", paymentId);
    try {
        await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/cancel`, {}, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Cancel error:", error.response?.data || error.message);
        res.status(500).json({ error: "Cancellation failed" });
    }
});

// ============================================================
// 4. RESOLVE INCOMPLETE PAYMENT
// ============================================================
app.post('/api/pi/resolve', async (req, res) => {
    const { paymentId } = req.body;
    console.log("Resolve request for:", paymentId);

    if (!paymentId) {
        return res.status(400).json({ error: 'paymentId required' });
    }

    try {
        const paymentRes = await axios.get(`${PI_API_URL}/v2/payments/${paymentId}`, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        const payment = paymentRes.data;

        if (payment.transaction && payment.transaction.txid) {
            await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/complete`, 
                { txid: payment.transaction.txid },
                { headers: { 'Authorization': `Key ${PI_API_KEY}` } }
            );
            console.log(`Payment ${paymentId} completed automatically.`);
            return res.status(200).json({ status: 'completed', paymentId });
        } else {
            await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/cancel`, {}, {
                headers: { 'Authorization': `Key ${PI_API_KEY}` }
            });
            console.log(`Payment ${paymentId} cancelled automatically.`);
            return res.status(200).json({ status: 'cancelled', paymentId });
        }
    } catch (error) {
        console.error("Resolve error:", error.response?.data || error.message);
        return res.status(500).json({ error: "Resolution failed" });
    }
});

// ============================================================
// 5. VALIDATE QR CODE TICKET (AVEC purchase_date)
// ============================================================
app.post('/api/tickets/validate', async (req, res) => {
    const { ticketId } = req.body;
    console.log("Ticket validation request for:", ticketId);

    if (!ticketId) {
        return res.status(400).json({ 
            success: false, 
            message: "Ticket ID missing" 
        });
    }

    try {
        const { data: ticket, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticketId)
            .single();

        if (error || !ticket) {
            console.error("Ticket not found:", ticketId);
            return res.status(404).json({ 
                success: false, 
                message: "Ticket not found" 
            });
        }

        console.log("Ticket found:", ticket.id, "| Status:", ticket.status);

        if (ticket.status === 'Used') {
            console.warn("Ticket already used:", ticketId);
            return res.status(400).json({ 
                success: false, 
                message: "This ticket has already been used" 
            });
        }

        if (ticket.expiration_date && new Date(ticket.expiration_date) < new Date()) {
            console.warn("Event expired for:", ticketId);
            return res.status(400).json({ 
                success: false, 
                message: "Event has expired" 
            });
        }

        const { error: updateError } = await supabase
            .from('tickets')
            .update({ 
                status: 'Used',
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (updateError) {
            console.error("Supabase update error:", updateError);
            return res.status(500).json({ 
                success: false, 
                message: "Error updating ticket" 
            });
        }

        console.log("Ticket marked as used:", ticketId);
        res.json({
            success: true,
            message: `Ticket ${ticketId} validated successfully`,
            ticket: {
                id: ticket.id,
                event_title: ticket.event_title,
                ticket_type: ticket.ticket_type,
                buyer_name: ticket.buyer_name,
                purchase_date: ticket.purchase_date || ticket.created_at || ticket.purchaseDateTime
            }
        });

    } catch (error) {
        console.error("Validation error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
});

// ============================================================
// 6. TEST ENDPOINT (AVEC purchase_date)
// ============================================================
app.get('/api/tickets/test/:id', async (req, res) => {
    const ticketId = req.params.id;
    console.log("Test - Fetching ticket:", ticketId);

    try {
        const { data: ticket, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticketId)
            .single();

        if (error || !ticket) {
            return res.status(404).json({ 
                success: false, 
                message: "Ticket not found" 
            });
        }

        res.json({ 
            success: true, 
            ticket: {
                id: ticket.id,
                event_title: ticket.event_title,
                status: ticket.status,
                ticket_type: ticket.ticket_type,
                buyer_name: ticket.buyer_name,
                purchase_date: ticket.purchase_date || ticket.created_at || ticket.purchaseDateTime
            }
        });
    } catch (error) {
        console.error("Test error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================
// 7. HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ============================================================
// 8. CLEANUP ROUTINE AT STARTUP
// ============================================================
async function cleanIncompletePayments() {
    if (!PI_API_KEY) {
        console.warn("No API key, cleanup skipped.");
        return;
    }
    try {
        console.log("Cleaning incomplete payments...");
        const response = await axios.get(`${PI_API_URL}/v2/payments/incomplete_server_payments`, {
            headers: { 'Authorization': `Key ${PI_API_KEY}` }
        });
        const payments = response.data.payments || [];
        if (payments.length === 0) {
            console.log("No incomplete payments found.");
            return;
        }
        console.log(`${payments.length} incomplete payment(s) found. Resolving...`);
        
        for (const p of payments) {
            const paymentId = p.identifier;
            try {
                if (p.transaction && p.transaction.txid) {
                    await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/complete`, 
                        { txid: p.transaction.txid },
                        { headers: { 'Authorization': `Key ${PI_API_KEY}` } }
                    );
                    console.log(`Cleanup: payment ${paymentId} completed.`);
                } else {
                    await axios.post(`${PI_API_URL}/v2/payments/${paymentId}/cancel`, {}, {
                        headers: { 'Authorization': `Key ${PI_API_KEY}` }
                    });
                    console.log(`Cleanup: payment ${paymentId} cancelled.`);
                }
            } catch (e) {
                console.error(`Cleanup error for ${paymentId}:`, e.response?.data || e.message);
            }
        }
        console.log("Cleanup completed.");
    } catch (error) {
        console.error("Cleanup error:", error.response?.data || error.message);
    }
}

// ============================================================
// 9. START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    setTimeout(async () => {
        await cleanIncompletePayments();
    }, 2000);
});