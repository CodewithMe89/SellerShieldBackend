const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    productId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"Product",
        required: true,
    },
    orderNumber:{
        type:String,
        required:true,
        trim:true,
    },
    quantity:{
        type:Number,
        required:true,
        min: 1,
    },
    sellingPriceSnapshot:{
        type:Number,
        required:true,
        min:0,
    },
    costPriceSnapshot:{
        type:Number,
        required:true,
        min:0,
    },
    orderStatus:{
        type:String,
        enum:[
            "Pending",
            "Confirmed",
            "Shipped",
            "Delivered",
            "Cancelled",
            "Returned",
        ],
        default:"Pending",
    },
    customerLocation:{
        type:String,
        trim:true,
        default:""
    },
    orderDate:{
        type:Date,
        default:Date.now
    }
},
{
    timestamps:true,
})

orderSchema.index(
    {seller:1, orderNumber:1},
    {unique:true}
)
const Order = mongoose.model("Order",orderSchema);

module.exports = Order;