const router = require("express").Router()
const Product = require("../models/Product")
const jwt = require("jsonwebtoken")
let sessionValidation = require("../middlewares/sessionValidation")
const aws = require("aws-sdk");
const multer = require("multer");
const multers3 = require("multer-s3");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const bodyParser = require('body-parser');
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
        });

        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: item.price*100,
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
          line_items: lineItems,
          payment_method_types: ["card"],
          mode: "payment",
          success_url: `http://localhost:5173/success?ids=${chosenItemsID}&quantities=${chosenItemsQuantity}`,
          cancel_url: "http://localhost:5173/cancel",
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

    console.log(ids, quantities)

    if (ids.length !== quantities.length) {
      return res
        .status(400)
        .json({ error: "Number of IDs and quantities do not match" });
    }

    const objects = ids.map((id, index) => ({
      _id: id,
      quantity: parseInt(quantities[index]),
    }));

    console.log(objects)

     const updatePromises = objects.map((obj) =>
       Product.updateOne({ _id: obj._id }, { $inc: { quantity: -obj.quantity } })
     );

     await Promise.all(updatePromises);

    res.status(200).json({
        message: "success",
        objects,
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
        const { altText, productName, price, description, quantity, tag, priceID } = req.body
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
            priceID
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
