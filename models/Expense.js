const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    seller:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    type:{
        type:String,
        enum:[
            "Platform Fee",
            'Shipping',
            "Advertising",
            "Packaging",
            "Miscellaneous",
        ],
        required:true
    },
    amount:{
        type:Number,
        required: true,
        min:0,
    },
    description:{
        type:String,
        trim:true,
        default:"",
    },
    date:{
        type:Date,
        default: Date.now,
    },
},
{
    timestamps:true
});

const Expense = mongoose.model('Expense',expenseSchema);

module.exports = Expense;