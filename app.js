require("dotenv").config()
const express = require("express")
const cors = require("cors")
const app = express()
const { dbConnect } = require("./db")
let userController = require("./controllers/auth")
let passwordController = require("./controllers/password")
let productController = require("./controllers/products")
// let checkoutController = require("./checkout/stripe")
let contactUserController = require("./controllers/contactUs")


const PORT = process.env.PORT || 4000
const HOST = process.env.HOST || "127.0.0.1"

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
//     const sig = req.headers['stripe-signature'];
//     const payload = req.body;
//     let event;
  
//     try {
//       event = stripe.webhooks.constructEvent(payload, sig, stripeWebhookSecret);
//       console.log("HEREHEHEEHHE", event.type);
//     } catch (err) {
//         console.error('Error processing webhook:', err);
//         res.status(400).send(`Webhook Error: ${err.message}`);
//         return;
//     }

//     switch (event.type) {
//         case 'checkout.session.completed':
//           const checkoutSessionCompleted = event.data.object;
//           // Then define and call a function to handle the event checkout.session.completed
//           break;
//         case 'checkout.session.expired':
//           const checkoutSessionExpired = event.data.object;
//           // Then define and call a function to handle the event checkout.session.expired
//           break;
//         case 'payment_intent.payment_failed':
//           const paymentIntentPaymentFailed = event.data.object;
//           // Then define and call a function to handle the event payment_intent.payment_failed
//           break;
//         case 'payment_intent.succeeded':
//           const paymentIntentSucceeded = event.data.object;
//           // Then define and call a function to handle the event payment_intent.succeeded
//           break;
//         // ... handle other event types
//         default:
//           console.log(`Unhandled event type ${event.type}`);
//       }
//       res.status(200).end();
//     })
    

app.use(cors())
app.use(express.static("public"))
// app.use("/stripe", express.raw({ type: '*/*' }), checkoutController)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use("/password", passwordController)
app.use("/admin", userController)
app.use("/products", productController)
app.use("/form", contactUserController)


app.listen(PORT, HOST, () => {
    dbConnect()
    console.log(`[server] listening on ${HOST}: ${PORT}`
    )  
})
