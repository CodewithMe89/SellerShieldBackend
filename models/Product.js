const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
    seller:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"User",
        required: true,
    },

    name:{
        type:String,
        required:true,
        trim:true,
    },

    sku:{
        type:String,
        required:true,
        trim:true,
    },

    category:{
        type:String,
        required: true,
        trim: true,
    },

    sellingPrice:{
        type:Number,
        required:true,
        min: 0,
    },

    costPrice:{
        type: Number,
        required:true,
        min: 0,
    },

    stock:{
        type:Number,
        required: true,
        min: 0,
        default: 0,
    },

    lowStockThreshold: {
        type:Number,
        required: true,
        min:0,
        default:5,
    },

    description:{
        type: String,
        trim: true,
        default: "",
    },
},
{
    timestamps: true,
}
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;