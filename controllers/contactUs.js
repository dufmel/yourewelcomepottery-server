let router = require('express').Router();
let nodemailer = require('nodemailer');
let BodyParser = require('body-parser');


router.use(BodyParser.urlencoded({ extended: true }));




let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASSWORD
        }
    })

    router.post("/contactUs", (req, res) => {
        let {name, email, message} = req.body;
        console.log(req.body);
        let mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: 'Contact Form',
            text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            res.status(500).json({message: 'Error sending email'});
        } else {
            console.log('Email sent:'+ info.response);
            res.status(200).json({message: 'Email sent'});
        }
    })
    })

    module.exports = router;