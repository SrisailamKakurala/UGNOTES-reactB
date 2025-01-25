const Razorpay = require('razorpay');
const crypto = require('crypto');
const userModel = require('./models/users'); // Adjust the path to your user model

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Middleware to create a Razorpay order
const createOrder = async (req, res, next) => {
    try {
        const options = {
            amount: 200, // ₹2 in paise
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        req.razorpayOrder = order;
        next();
    } catch (err) {
        console.error('Razorpay order creation error:', err);
        res.status(500).json({ error: 'Failed to create Razorpay order' });
    }
};

// Middleware to verify Razorpay payment
const verifyPayment = async (req, res, next) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature === razorpay_signature) {
            req.paymentSuccess = true;
            next();
        } else {
            res.status(400).json({ error: 'Invalid payment signature' });
        }
    } catch (err) {
        console.error('Razorpay payment verification error:', err);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
};

// Function to handle withdrawals
const handleWithdrawal = async (req, res) => {
    try {
        const { userId, amount, accountNumber, ifscCode } = req.body;
        console.log(userId, amount, accountNumber, ifscCode);

        // Find the user
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if the user has sufficient balance
        if (user.amount < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Create a Razorpay contact
        const contactResponse = await razorpay.contacts.create({
            name: user.username,
            email: user.email,
            contact: user.phone, // Optional: Add user's phone number
            type: 'customer',
        });
        console.log('Contact created:', contactResponse);

        // Create a Razorpay fund account
        const fundAccountResponse = await razorpay.fundAccount.create({
            contact_id: contactResponse.id,
            account_type: 'bank_account',
            bank_account: {
                name: user.username,
                ifsc: ifscCode,
                account_number: accountNumber,
            },
        });
        console.log('Fund account created:', fundAccountResponse);

        // Initiate a payout using Razorpay Payouts
        const payoutResponse = await razorpay.payouts.create({
            account_number: accountNumber,
            fund_account_id: fundAccountResponse.id,
            amount: amount * 100, // Amount in paise (₹1 = 100 paise)
            currency: 'INR',
            mode: 'IMPS', // Transfer mode (IMPS, NEFT, RTGS, etc.)
            purpose: 'payout', // Purpose of the payout
        });
        console.log('Payout initiated:', payoutResponse);

        // Update the user's balance
        user.amount = 0; // Set balance to 0 after withdrawal
        await user.save();

        res.json({ message: 'Withdrawal successful', payoutResponse });
    } catch (err) {
        console.error('Withdrawal error:', err);
        res.status(500).json({ error: 'Withdrawal failed', details: err.message });
    }
};

module.exports = { createOrder, verifyPayment, handleWithdrawal };