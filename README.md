# You’re Welcome Pottery E-Commerce Site
This project was a collaborative project to present a proof-of-concept to a client.

The front end is built using React Router6 and Material UI. It allows site users to view the seller’s products and sort them by product line, add them to a cart and adjust quantities within the cart.

The backend is built using Express, MongoDB, and AWS S3 Buckets (for images). Projected endpoints are included to build out a front-end administrative page where items for purchase can be uploaded, edited or deleted.

Finally, the project uses a custom built cart that is integrated into the STRIPE ecosystem for secure purchases which then updates the artist/owner’s inventory.

Installing and Running the Project
======================================

After cloning the project, be sure to run npm i to install the necessary dependencies. You will need an active account with AWS, MongoDB and Stripe. With these accounts activated you can access the necessary connections and API keys to include in a .env file that you create on your local machine. Check the documentation to ensure you are using the correct API keys:

* _AWS_ _S3_ _Buckets_ _Access_ _Keys__:  (https://docs.aws.amazon.com/AmazonS3/latest/userguide/creating-buckets-s3.html)
* _MongoDB_ _Connection_ _String_: (https://www.mongodb.com/docs/guides/atlas/connection-string/)
* _STRIPE_: (https://stripe.com/docs/keys)

In the *.env* file, you will also need to ensure that you create a *SALT* variable and a *JWT_KEY* variable.

Credits: 
============

Jonathan Amasalem, Melissa Dufrechou, Enoch Ikunda
Upright Education Capstone Project in partial fulfillment of Software Development Certification 

Alt- Licensing:
==============

All images are subject to copyright and may not be reused without the express permission of You’re Welcome Pottery.

Alt- All code is open source.
============================
