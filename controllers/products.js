const router = require("express").Router()
const Product = require("../models/Product")
const jwt = require("jsonwebtoken")
let sessionValidation = require("../middlewares/sessionValidation")
const aws = require("aws-sdk");
const multer = require("multer");
const multers3 = require("multer-s3");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
let chosenItemsID = [];
let chosenItemsQuantity = [];


const s3 = new aws.S3({
    accessKeyId: process.env.POTTERY_ACCESS_KEY,
    secretAccessKey: process.env.POTTERY_SECRET_KEY,
    region: process.env.S3_BUCKET_REGION,
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
})


router.post("/checkout", async (req, res) => {

    const items = req.body.items;

    const chosenItemsID = items.map((item) => item._id);
    const chosenItemsQuantity = items.map((item) => item.quantity);
    // This is an array of line items. Each line item contains the price and quantity of a product.
    const pricePromises = items.map(async (item) => {

        const product = await stripe.products.create({
            name: item.productName,
            images: [item.imageUrl]
        });

        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: item.price * 100,
            currency: 'usd',
        });

        return price;
    });

    const prices = await Promise.all(pricePromises);

    let lineItems = [];
    items.forEach((item, index) => {
        lineItems.push(
            // This creates a line item object.
            {
                price: prices[index].id,
                quantity: item.quantity
            }
        )
    });

    try {

        // This creates a Stripe checkout session.
        const session = await stripe.checkout.sessions.create({
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 0,
                            currency: 'usd',
                        },
                        display_name: 'Pick up order',
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 1,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 7,
                            },
                        },
                    },
                },
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 1500,
                            currency: 'usd',
                        },
                        display_name: 'Ground shipping',
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 3,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 10,
                            },
                        },
                    },
                },
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 2500,
                            currency: 'usd',
                        },
                        display_name: 'Next day air',
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 1,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 1,
                            },
                        },
                    },
                },
            ],
            line_items: lineItems,
            shipping_address_collection: {
                allowed_countries: ['US'],
            },
            payment_method_types: ['card'],
            mode: 'payment',
            automatic_tax: {
                enabled: true,
            },
            success_url: `http://localhost:5173/success?ids=${chosenItemsID}&quantities=${chosenItemsQuantity}`,
            cancel_url: "http://localhost:5173/cancel"
        });

        res.json({ url: session.url });



    } catch (error) {
        // This logs the error and returns an error message to the client.
        console.error("Error creating session:", error);
        res.status(500).json({ error: "An error occurred while creating the payment session." });
    }
})



router.put("/retrieve", async (req, res) => {
    try {
        const { ids, quantities } = req.body;

        if (ids.length !== quantities.length) {
            return res
                .status(400)
                .json({ error: "Number of IDs and quantities do not match" });
        }

        const objects = ids.map((id, index) => ({
            _id: id,
            quantity: parseInt(quantities[index]),
        }));

        const updatePromises = objects.map((obj) =>
            Product.updateOne({ _id: obj._id }, { $inc: { quantity: -obj.quantity } })
        );

        await Promise.all(updatePromises);

        const soldProducts = await Promise.all(
            objects.map(async (obj) => {
                const product = await Product.findOne({ _id: obj._id });
                return {
                    name: product.productName,
                    quantity: obj.quantity,
                };
            })
        );

        // Create the HTML table template
        const htlm = `
            <html>
                <head>
                    <style>
                        /* Custom styles */
                        table {
                        border-collapse: collapse;
                        width: 50%;
                        margin: auto; /* Center the table */
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* Add box shadow */
                        font-family: "Salsa-Regular", sans-serif;
                        }
                        th {
                        background-color: #a04d31;
                        color: white;
                        padding: 8px;
                        font-weight: bold;
                        }
                        td {
                        border: 1px solid black;
                        padding: 8px;
                        }
                    </style>
                </head>
                <body>
                <table>
                    <tr>
                        <th>Product Name</th>
                        <th>Quantity Sold</th>
                    </tr>
                    ${soldProducts.map(
                        (product) => `
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.quantity}</td>
                    </tr>
                    `
                    ).join("")}
                </table>
                </body>
            </html>
        `;
    

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.NOTIFICATION_EMAIL, // Change this to the recipient email address
            subject: "Product Update",
            /* text: `Product Update Notification: The following products have been updated: ${JSON.stringify(soldProducts, null, 2)}
            Thank you for using our service.`, */
            html: htlm,
        };
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASSWORD
            }
        })

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log("Error sending email:", error);
                // Handle the error, e.g., return an error response to the client
                return res.status(500).json({ error: "Failed to send email notification" });
            } else {
                console.log("Email sent: " + info.response);
                // Send the success response to the client after the email is sent
                return res.status(200).json({ message: "success" });
            }
        });

    } catch (err) {
        res.status(500).json({
            message: "not working",
        });
    }
});


router.post("/create", upload.single("file"), async (req, res) => { //upload.single("image") is middlware that processes an incoming file - this is part of multer

    try {
        let file = req.file
        const imageUrl = file.buffer //file.buffer is a property of multer middleware. Processed file's buffer is accessible Access binary data
        const { altText, productName, price, description, quantity, tag } = req.body
        console.log(altText, productName, price, quantity, tag)
        if (!altText || !productName || !price || !quantity || !tag) throw new Error("All fields are required")


        const s3Params = {
            Bucket: process.env.POTTERY_BUCKET_NAME,
            Key: `${Date.now()}-${req.file.originalname}`,//req.file is a propery of multer middleware and "originalname" is one of its properties
            Body: imageUrl,
            ACL: "public-read",//bucket is private, but will allow users to see image on client side. ACL = Access Control List (controls aces to objects store in S3 bucket)
            ContentType: req.file.mimtype,
        };

        const data = await s3.upload(s3Params).promise();

        const newProduct = new Product({
            imageUrl: data.Location,
            altText,
            productName,
            price,
            description,
            quantity,
            tag,
        })

        console.log(newProduct)
        await newProduct.save()

        res.status(200).json({
            message: "Product added",
            newProduct
        })

    } catch (err) {
        res.status(500).json({
            message: err.message
        }),
            console.log(err)
    }
})


router.get("/all", async (req, res) => {
    try {
        let allProducts = await Product.find()
        if (allProducts.length == 0) throw new Error("No products found")
        res.status(200).json(allProducts)
    }

    catch (err) {
        res.status(500).json({
            message: err.message
        }),
            console.log(err)
    }

})

router.get("/:id", async (req, res) => {
    try {
        let { id } = req.params
        let oneProduct = await Product.findOne({ _id: id })
        if (!oneProduct) throw new Error("No products found")
        res.status(200).json(oneProduct)
    }

    catch (err) {
        res.status(500).json({
            message: err.message
        }),
            console.log(err)
    }

})

router.delete("/delete/:id", sessionValidation, async (req, res) => {
    try {
        let { id } = req.params
        let oneProduct = await Product.deleteOne({ _id: id })
        console.log(oneProduct)
        if (oneProduct.deletedCount == 0) throw Error("No products found")
        res.status(200).json({
            message: "Product deleted"
        })
    }

    catch (err) {
        res.status(500).json({
            message: err.message
        }),
            console.log(err)
    }

})

router.put("/update/:id", sessionValidation, upload.none(), async (req, res) => {
    try {
        console.log("HERE")
        let { id } = req.params
        let message = req.body
        Object.keys(message).forEach(key => {
            if (message[key] == "") delete message[key]
        })

        let oneProduct = await Product.updateOne({ _id: id }, { $set: message })
        console.log(oneProduct)
        if (oneProduct.matchedCount == 0) throw Error("No products found")
        res.status(200).json({
            message: "Product updated"
        })
    }

    catch (err) {
        res.status(500).json({
            message: err.message
        }),
            console.log(err)
    }
})


router.put("/updateImg/:_id", upload.single("file"), sessionValidation, async (req, res) => {
    try {
        let { _id } = req.params
        let file = req.file
        const image = file.buffer
        const s3Params = {
            Bucket: process.env.POTTERY_BUCKET_NAME,
            Key: `${Date.now()}-${req.file.originalname}`,//req.file is a propery of multer middleware and "originalname" is one of its properties
            Body: image,
            ACL: "public-read",//bucket is private, but will allow users to see image on client side. ACL = Access Control List (controls aces to objects store in S3 bucket)
            ContentType: req.file.mimtype,
        };
        const data = await s3.upload(s3Params).promise();

        let imageUrl = data.Location
        console.log(imageUrl)

        let oneProduct = await Product.updateOne({ _id: _id }, { imageUrl: imageUrl })
        console.log(oneProduct)
        if (oneProduct.matchedCount == 0) throw Error("No products found")
        res.status(200).json({
            message: "Product updated"
        })
    }

    catch (err) {
        res.status(500).json({
            message: err.message
        }),
            console.log(err)
    }
})

module.exports = router