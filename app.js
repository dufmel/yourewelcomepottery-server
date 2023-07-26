require("dotenv").config()
const express = require("express")
const cors = require("cors")
const app = express()
const { dbConnect } = require("./db")
let userController = require("./controllers/auth")
let passwordController = require("./controllers/password")
let productController = require("./controllers/products")
let contactUserController = require("./controllers/contactUs")

const PORT = process.env.PORT || 4000
const HOST = process.env.HOST || "127.0.0.1"

app.use(cors())
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
