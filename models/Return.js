const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema({
    seller:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true,
    },
    order:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Order',
        required:true,
    },
    product:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Product',
        required:true,
    },
    quantity:{
        type:Number,
        required:true,
        min:1,
    },
    reason:{
        type:String,
        enum : [
            "Damaged Product",
            "Wrong Product",
            "Size Issue",
            "Quality Issue",
            "Customer Changed Mind",
            "Other",
        ],
        required:true,
    },
    returnStatus:{
        type:String,
        enum:[
            "Requested",
            "Approved",
            "Pending",
            "Rejected",
            "Completed",
        ],
        default:"Requested",
    },
    returnCost:{
        type:Number,
        required:true,
        min:0,
        default:0,
    },
    returnDate:{
        type:Date,
        default:Date.now(),
    },
},
{
    timestamps:true
})

const Return = mongoose.model('Return', returnSchema);

module.exports = Return;