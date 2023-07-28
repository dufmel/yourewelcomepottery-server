ireconst { mongoose } = require("../db")

const Product = new mongoose.Schema({

    imageUrl:{
        type: String,
        required: true,
    },

    altText:{
        type: String,
        required: true,
    },

    productName:{
        type: String,
        required: true,
    },

    price:{
        type: Number,
        required: true,
    },

    description:{
        type: String,
        required: false,
    },

    quantity:{
        type: Number,
        required: true,
    },

    tag:{
        type: String,
        required: true
    },

    priceID:{
        type: String,
        required: false,
    }


})

module.exports = mongoose.model("products", Product)
